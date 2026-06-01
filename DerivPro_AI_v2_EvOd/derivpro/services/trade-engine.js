// services/trade-engine.js — DerivPro AI | Trade Execution Engine
'use strict';

export class TradeEngine {
  constructor(ws, strategy, martingale, riskManager, aiEngine, logger) {
    this.ws          = ws;
    this.strategy    = strategy;
    this.martingale  = martingale;
    this.riskManager = riskManager;
    this.aiEngine    = aiEngine;
    this.logger      = logger;

    this._active          = false;
    this._pendingProposal = null;
    this._activeTrades    = new Map();
    this._listeners       = [];

    // Stats
    this.stats = {
      total: 0, wins: 0, losses: 0, pnl: 0,
      evenWins: 0, evenLosses: 0, oddWins: 0, oddLosses: 0,
      maxWinStreak: 0, maxLossStreak: 0,
      currentWinStreak: 0, currentLossStreak: 0,
    };
  }

  // Place a real trade via WebSocket buy
  async placeRealTrade({ contractType, stake, symbol, currency = 'USD', duration = 1, durationUnit = 't' }) {
    if (!this.ws?.isConnected()) {
      this.logger?.error('WebSocket not connected', 'TRADE');
      return { success: false, error: 'Not connected' };
    }

    // Risk check
    const riskCheck = this.riskManager.canTrade({ stake, martDepth: this.strategy.martingaleDepth });
    if (!riskCheck.allowed) {
      this.logger?.warn(`Trade blocked: ${riskCheck.reason}`, 'RISK');
      this._emit('blocked', riskCheck);
      return { success: false, error: riskCheck.message };
    }

    const params = {
      buy: 1,
      subscribe: 1,
      price: stake,
      parameters: {
        amount:        stake,
        basis:         'stake',
        contract_type: contractType,
        currency,
        duration,
        duration_unit: durationUnit,
        symbol,
      }
    };

    this.ws.send(params);
    this.riskManager.onTrade(stake);
    this.logger?.info(`Trade placed: ${contractType} | $${stake} | ${symbol}`, 'TRADE');
    this._emit('placed', { contractType, stake, symbol });
    return { success: true };
  }

  // Handle proposal response
  onProposal(data) {
    if (data.error) {
      this.logger?.error(`Proposal error: ${data.error.message}`, 'TRADE');
      return;
    }
    this._pendingProposal = data.proposal;
    this._emit('proposal', data.proposal);
  }

  // Handle buy response
  onBuy(data) {
    if (data.error) {
      this.logger?.error(`Buy error: ${data.error.message}`, 'TRADE');
      this._emit('error', data.error);
      return;
    }
    const buy = data.buy;
    this._activeTrades.set(buy.contract_id, {
      id:           buy.contract_id,
      type:         buy.shortcode?.includes('EVEN') ? 'DIGITEVEN' : 'DIGITODD',
      stake:        buy.buy_price,
      openTime:     Date.now(),
      shortcode:    buy.shortcode,
    });
    this.logger?.info(`Contract open: ${buy.contract_id}`, 'TRADE');
    this._emit('buy', buy);
  }

  // Handle contract settlement
  onSettle(data) {
    const contract = data.proposal_open_contract || data;
    if (!contract?.is_sold) return;

    const id     = contract.contract_id;
    const profit = parseFloat(contract.profit || 0);
    const win    = profit > 0;
    const type   = contract.contract_type;

    this._activeTrades.delete(id);
    this.stats.total++;
    if (win) {
      this.stats.wins++;
      this.stats.currentWinStreak++;
      this.stats.currentLossStreak = 0;
      this.stats.maxWinStreak = Math.max(this.stats.maxWinStreak, this.stats.currentWinStreak);
      if (type === 'DIGITEVEN') this.stats.evenWins++;
      else this.stats.oddWins++;
    } else {
      this.stats.losses++;
      this.stats.currentLossStreak++;
      this.stats.currentWinStreak = 0;
      this.stats.maxLossStreak = Math.max(this.stats.maxLossStreak, this.stats.currentLossStreak);
      if (type === 'DIGITEVEN') this.stats.evenLosses++;
      else this.stats.oddLosses++;
    }
    this.stats.pnl += profit;

    // Update risk manager
    win ? this.riskManager.onWin(profit) : this.riskManager.onLoss(Math.abs(profit));

    // Update strategy
    const stratResult = win ? this.strategy.onWin(profit) : this.strategy.onLoss(Math.abs(profit));

    // Update AI feedback
    this.aiEngine?.onFeedback(win);

    this.logger?.trade(`${win ? 'WIN' : 'LOSS'} | ${type} | $${profit.toFixed(2)} | P&L: $${this.stats.pnl.toFixed(2)}`, win ? 'win' : 'loss');

    this._emit('settled', { contract, profit, win, stratResult, stats: this.stats });
    return { win, profit, stratResult };
  }

  // Virtual trade simulation
  simulateTrade({ contractType, stake, lastDigit }) {
    const isEven = lastDigit % 2 === 0;
    const win = (contractType === 'DIGITEVEN' && isEven) || (contractType === 'DIGITODD' && !isEven);
    const profit = win ? parseFloat((stake * 0.95).toFixed(2)) : -parseFloat(stake);

    this.stats.total++;
    if (win) { this.stats.wins++; this.stats.currentWinStreak++; this.stats.currentLossStreak = 0; }
    else { this.stats.losses++; this.stats.currentLossStreak++; this.stats.currentWinStreak = 0; }
    this.stats.pnl += profit;

    return { win, profit, digit: lastDigit, type: contractType };
  }

  // Getters
  isActive()         { return this._active; }
  getStats()         { return { ...this.stats, winRate: this.stats.total ? (this.stats.wins / this.stats.total * 100).toFixed(1) : 0 }; }
  getActiveTrades()  { return Array.from(this._activeTrades.values()); }
  getPendingProposal(){ return this._pendingProposal; }

  start()  { this._active = true;  this._emit('start', {}); }
  stop()   { this._active = false; this._emit('stop', {}); }

  reset() {
    this.stats = { total: 0, wins: 0, losses: 0, pnl: 0, evenWins: 0, evenLosses: 0, oddWins: 0, oddLosses: 0, maxWinStreak: 0, maxLossStreak: 0, currentWinStreak: 0, currentLossStreak: 0 };
    this._activeTrades.clear();
    this._pendingProposal = null;
  }

  on(event, callback) {
    this._listeners.push({ event, callback });
    return () => { this._listeners = this._listeners.filter(l => l.callback !== callback); };
  }

  _emit(event, data) {
    this._listeners.filter(l => l.event === event || l.event === '*').forEach(l => { try { l.callback(data); } catch {} });
  }
}
