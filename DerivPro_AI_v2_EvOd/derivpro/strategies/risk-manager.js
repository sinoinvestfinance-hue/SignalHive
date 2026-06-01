// strategies/risk-manager.js — DerivPro AI | Risk Management System
'use strict';

export class RiskManager {
  constructor(config = {}) {
    this.maxDailyLoss    = config.maxDailyLoss    ?? 100;
    this.maxSessionLoss  = config.maxSessionLoss  ?? 50;
    this.maxConsecLosses = config.maxConsecLosses ?? 8;
    this.maxMartDepth    = config.maxMartDepth    ?? 6;
    this.maxTrades       = config.maxTrades       ?? 200;
    this.maxExposure     = config.maxExposure     ?? 20;
    this.cooldownAfter   = config.cooldownAfter   ?? 5;     // consecutive losses before cooldown
    this.cooldownMs      = config.cooldownMs      ?? 30000; // 30 second cooldown

    this._blocked        = false;
    this._blockReason    = null;
    this._blockUntil     = 0;
    this._listeners      = [];

    // Emergency stop
    this.emergencyStop   = false;

    // Session statistics
    this.session = {
      trades: 0, wins: 0, losses: 0,
      pnl: 0, dailyLoss: 0, consecLosses: 0,
      startTime: Date.now(), lastTradeTime: null,
      maxDrawdown: 0, peakPnL: 0,
    };
  }

  // Main gate: can we place a trade?
  canTrade(options = {}) {
    const { stake = 0, martDepth = 0 } = options;

    // Emergency stop
    if (this.emergencyStop) return this._block('EMERGENCY_STOP', 'Emergency stop is active');

    // Cooldown check
    if (this._blocked && Date.now() < this._blockUntil) {
      const remaining = Math.ceil((this._blockUntil - Date.now()) / 1000);
      return this._block('COOLDOWN', `Cooldown active — ${remaining}s remaining`);
    }
    if (this._blocked && Date.now() >= this._blockUntil) {
      this._unblock();
    }

    // Daily loss limit
    if (Math.abs(this.session.dailyLoss) >= this.maxDailyLoss) {
      return this._block('MAX_DAILY_LOSS', `Daily loss limit reached: $${this.maxDailyLoss}`);
    }

    // Session loss limit
    if (this.session.pnl <= -this.maxSessionLoss) {
      return this._block('MAX_SESSION_LOSS', `Session loss limit reached: $${this.maxSessionLoss}`);
    }

    // Max consecutive losses
    if (this.session.consecLosses >= this.maxConsecLosses) {
      this._setCooldown(this.cooldownMs * 2);
      return this._block('MAX_CONSEC_LOSSES', `${this.session.consecLosses} consecutive losses — forced cooldown`);
    }

    // Martingale depth limit
    if (martDepth >= this.maxMartDepth) {
      this._setCooldown(this.cooldownMs);
      return this._block('MAX_MART_DEPTH', `Martingale depth ${martDepth} reached max ${this.maxMartDepth}`);
    }

    // Max trades
    if (this.session.trades >= this.maxTrades) {
      return this._block('MAX_TRADES', `Session trade limit reached: ${this.maxTrades}`);
    }

    // Max exposure
    if (stake > this.maxExposure) {
      return { allowed: false, reason: 'MAX_EXPOSURE', message: `Stake $${stake} exceeds max exposure $${this.maxExposure}` };
    }

    // Cooldown after N consecutive losses (soft cooldown)
    if (this.session.consecLosses >= this.cooldownAfter && this.session.consecLosses < this.maxConsecLosses) {
      const delay = this.cooldownMs * (this.session.consecLosses - this.cooldownAfter + 1);
      this._setCooldown(delay);
      return { allowed: false, reason: 'SOFT_COOLDOWN', message: `Soft cooldown: ${this.session.consecLosses} consecutive losses` };
    }

    return { allowed: true };
  }

  onTrade(stake) {
    this.session.trades++;
    this.session.lastTradeTime = Date.now();
    this._emit('trade', { stake, session: this.session });
  }

  onWin(profit) {
    this.session.wins++;
    this.session.pnl += profit;
    this.session.consecLosses = 0;
    this.session.peakPnL = Math.max(this.session.peakPnL, this.session.pnl);
    this._unblock();
    this._emit('win', { profit, session: this.session });
  }

  onLoss(loss) {
    const absLoss = Math.abs(loss);
    this.session.losses++;
    this.session.pnl -= absLoss;
    this.session.dailyLoss += absLoss;
    this.session.consecLosses++;
    this.session.maxDrawdown = Math.max(this.session.maxDrawdown, this.session.peakPnL - this.session.pnl);
    this._emit('loss', { loss: absLoss, session: this.session });
  }

  _block(reason, message) {
    this._blockReason = reason;
    this._emit('blocked', { reason, message });
    return { allowed: false, reason, message };
  }

  _unblock() {
    this._blocked = false;
    this._blockReason = null;
    this._blockUntil = 0;
    this._emit('unblocked', {});
  }

  _setCooldown(ms) {
    if (!this._blocked) {
      this._blocked = true;
      this._blockUntil = Date.now() + ms;
      this._emit('cooldown', { duration: ms, until: this._blockUntil });
    }
  }

  activateEmergencyStop() {
    this.emergencyStop = true;
    this._emit('emergency_stop', { time: Date.now() });
  }

  deactivateEmergencyStop() {
    this.emergencyStop = false;
    this._unblock();
    this._emit('emergency_stop_cleared', { time: Date.now() });
  }

  resetSession() {
    this.session = {
      trades: 0, wins: 0, losses: 0,
      pnl: 0, dailyLoss: 0, consecLosses: 0,
      startTime: Date.now(), lastTradeTime: null,
      maxDrawdown: 0, peakPnL: 0,
    };
    this._unblock();
    this.emergencyStop = false;
  }

  on(event, callback) {
    this._listeners.push({ event, callback });
    return () => { this._listeners = this._listeners.filter(l => l.callback !== callback); };
  }

  _emit(event, data) {
    this._listeners.filter(l => l.event === event || l.event === '*').forEach(l => { try { l.callback(data); } catch {} });
  }

  getState() {
    const s = this.session;
    const wr = s.trades ? (s.wins / s.trades * 100).toFixed(1) : 0;
    return {
      ...s,
      winRate: parseFloat(wr),
      blocked: this._blocked,
      blockReason: this._blockReason,
      blockUntil: this._blockUntil,
      emergencyStop: this.emergencyStop,
      limits: {
        maxDailyLoss: this.maxDailyLoss,
        maxSessionLoss: this.maxSessionLoss,
        maxConsecLosses: this.maxConsecLosses,
        maxMartDepth: this.maxMartDepth,
        maxTrades: this.maxTrades,
        maxExposure: this.maxExposure,
      },
      utilization: {
        dailyLoss: parseFloat(((s.dailyLoss / this.maxDailyLoss) * 100).toFixed(1)),
        trades:    parseFloat(((s.trades / this.maxTrades) * 100).toFixed(1)),
        consecLoss: parseFloat(((s.consecLosses / this.maxConsecLosses) * 100).toFixed(1)),
      }
    };
  }
}
