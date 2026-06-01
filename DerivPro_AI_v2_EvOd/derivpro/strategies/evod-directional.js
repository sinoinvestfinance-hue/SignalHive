// strategies/evod-directional.js — DerivPro AI
// Converted from EvOdDirectional.xml (Deriv DBot)
// Strategy: Consecutive Even/Odd digit streak → continuation trade
// Market: Volatility Indices (default R_25) | Contract: DIGITEVEN / DIGITODD
'use strict';

export class EvOdDirectionalStrategy {
  constructor(config = {}) {
    // ── Identity ──
    this.name        = 'EvOdDirectional';
    this.version     = '2.0';
    this.origin      = 'EvOdDirectional.xml';
    this.description = 'Trades Even/Odd continuation after N consecutive same-parity digits';

    // ── XML Parameters (from initialization block) ──
    this.strategyType  = config.strategyType  ?? 2;      // N digits (2–10)
    this.initialStake  = config.stake         ?? 0.50;
    this.martingale    = config.martingale    ?? 2.0;     // Martangle multiplier
    this.takeProfit    = config.takeProfit    ?? 8;       // No. of Win (Run Count target)
    this.stopLoss      = config.stopLoss      ?? 30.00;   // Stop Loss ($)
    this.useMartingale = config.useMartingale ?? true;    // Use Martingale toggle
    this.market        = config.market        ?? 'R_25';
    this.duration      = 1;                               // Fixed: 1 tick
    this.durationUnit  = 't';

    // ── Runtime State (from XML variables) ──
    this.currentStake     = this.initialStake;  // Stake
    this.runCount         = 0;                  // Run Count
    this.martingaleDepth  = 0;                  // Consecutive losses
    this.totalPnL         = 0;                  // Cumulative P&L this session
    this.winCount         = 0;
    this.lossCount        = 0;
    this.isActive         = false;
    this.lastSignal       = null;
    this.lastContractType = null;
    this.consecutiveLosses = 0;
    this.consecutiveWins   = 0;
    this.peakPnL           = 0;
    this.troughPnL         = 0;
    this.tradeCount        = 0;
    this.sessionId         = Date.now();

    // ── Strategy type label map ──
    this._typeLabels = {
      2:  'If last 2 Digits are Even trade Even and Vice Versa',
      3:  'If last 3 Digits are Even trade Even and Vice Versa',
      4:  'If last 4 Digits are Even trade Even and Vice Versa',
      5:  'If last 5 Digits are Even trade Even and Vice Versa',
      6:  'If last 6 Digits are Even trade Even and Vice Versa',
      7:  'If last 7 Digits are Even trade Even and Vice Versa',
      8:  'If last 8 Digits are Even trade Even and Vice Versa',
      9:  'If the 9 Digits are Even trade Even and Vice Versa',
      10: 'If the 10 Digits are Even trade Even and Vice Versa',
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BEFORE PURCHASE LOGIC (converted from XML before_purchase block)
  // Checks last N digits for ALL_EVEN or ALL_ODD condition
  // Returns trade signal or null if no condition met
  // ─────────────────────────────────────────────────────────────────────────
  analyze(digitHistory) {
    const n = this.strategyType;
    if (!digitHistory || digitHistory.length < n) return null;

    const lastN = digitHistory.slice(-n);
    const allEven = lastN.every(d => d % 2 === 0);
    const allOdd  = lastN.every(d => d % 2 !== 0);

    if (allEven) {
      // ALL_EVEN condition: purchase DIGITEVEN (follow the continuation)
      const signal = { signal: 'DIGITEVEN', n, digits: lastN, condition: 'ALL_EVEN', confidence: this._calcSignalConfidence(n, lastN, 'even') };
      this.lastSignal = signal;
      return signal;
    }

    if (allOdd) {
      // ALL_ODD condition: purchase DIGITODD (follow the continuation)
      const signal = { signal: 'DIGITODD', n, digits: lastN, condition: 'ALL_ODD', confidence: this._calcSignalConfidence(n, lastN, 'odd') };
      this.lastSignal = signal;
      return signal;
    }

    this.lastSignal = null;
    return null;
  }

  // Analyze all strategy types simultaneously (2-10) and return first match
  analyzeAll(digitHistory) {
    for (let n = this.strategyType; n <= 10; n++) {
      const tempType = n;
      if (digitHistory.length < n) continue;
      const lastN = digitHistory.slice(-n);
      const allEven = lastN.every(d => d % 2 === 0);
      const allOdd  = lastN.every(d => d % 2 !== 0);
      if (allEven) return { signal: 'DIGITEVEN', n, digits: lastN, condition: 'ALL_EVEN', confidence: this._calcSignalConfidence(n, lastN, 'even') };
      if (allOdd)  return { signal: 'DIGITODD',  n, digits: lastN, condition: 'ALL_ODD',  confidence: this._calcSignalConfidence(n, lastN, 'odd') };
    }
    return null;
  }

  // Signal confidence scoring
  _calcSignalConfidence(n, digits, type) {
    // Base: longer streaks are statistically rarer → higher conviction
    // P(all even for N ticks) ≈ 0.5^N
    const rarityScore = Math.min(n * 8, 60);
    // Digit value uniformity bonus (not all same digit)
    const unique = new Set(digits).size;
    const diversityBonus = unique > 1 ? Math.min(unique * 4, 20) : 0;
    // Momentum bonus based on streak length
    const momentumBonus = n >= 5 ? 10 : n >= 3 ? 5 : 0;
    return Math.min(rarityScore + diversityBonus + momentumBonus, 90);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AFTER PURCHASE LOGIC (converted from XML after_purchase block)
  // ─────────────────────────────────────────────────────────────────────────

  // Call on WIN (from contract settled)
  onWin(profit) {
    // XML: IF WIN → Stake = Initial Stake; Run Count += 1
    this.currentStake     = this.initialStake;       // Reset stake to initial
    this.runCount        += 1;                        // Increment run count
    this.totalPnL        += parseFloat(profit || 0);
    this.winCount        += 1;
    this.tradeCount      += 1;
    this.consecutiveWins += 1;
    this.consecutiveLosses = 0;
    this.martingaleDepth   = 0;
    this.peakPnL = Math.max(this.peakPnL, this.totalPnL);

    // XML: IF Run Count >= No. of Win → print success, stop
    if (this.runCount >= this.takeProfit) {
      this.isActive = false;
      return {
        action: 'STOP',
        reason: 'TAKE_PROFIT',
        message: `You have successfully hit the ${this.takeProfit} Winning Runs. Total Profit Accumulated: ${this.totalPnL.toFixed(2)}`,
        runCount: this.runCount, totalPnL: this.totalPnL
      };
    }

    return { action: 'CONTINUE', runCount: this.runCount, totalPnL: this.totalPnL };
  }

  // Call on LOSS (from contract settled)
  onLoss(loss) {
    const absLoss = parseFloat(loss || this.currentStake);

    // XML: IF LOSS AND Use Martingale == TRUE → Stake = Stake × Martangle
    //      ELSE → Stake = Initial Stake
    const prevStake = this.currentStake;
    if (this.useMartingale) {
      this.currentStake = parseFloat((this.currentStake * this.martingale).toFixed(2));
    } else {
      this.currentStake = this.initialStake;
    }

    this.totalPnL        -= absLoss;
    this.lossCount       += 1;
    this.tradeCount      += 1;
    this.martingaleDepth += 1;
    this.consecutiveLosses += 1;
    this.consecutiveWins   = 0;
    this.troughPnL = Math.min(this.troughPnL, this.totalPnL);

    // XML: IF total_profit <= -Stop_Loss → print "Sorry!!! Stop Loss Hit", stop
    if (this.totalPnL <= -this.stopLoss) {
      this.isActive = false;
      this.currentStake = this.initialStake; // Reset for next session
      return {
        action: 'STOP',
        reason: 'STOP_LOSS',
        message: 'Sorry!!! Stop Loss Hit',
        totalPnL: this.totalPnL,
        prevStake, newStake: this.currentStake
      };
    }

    // XML: ELSE → trade_again (continue)
    return {
      action: 'CONTINUE',
      newStake: this.currentStake,
      martingaleDepth: this.martingaleDepth,
      totalPnL: this.totalPnL
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UTILITY
  // ─────────────────────────────────────────────────────────────────────────

  getTradeParams() {
    return {
      amount:        this.currentStake,
      basis:         'stake',
      contract_type: this.lastSignal?.signal || 'DIGITEVEN',
      duration:      this.duration,
      duration_unit: this.durationUnit,
      symbol:        this.market,
    };
  }

  reset() {
    this.currentStake      = this.initialStake;
    this.runCount          = 0;
    this.martingaleDepth   = 0;
    this.totalPnL          = 0;
    this.winCount          = 0;
    this.lossCount         = 0;
    this.isActive          = false;
    this.lastSignal        = null;
    this.lastContractType  = null;
    this.consecutiveLosses = 0;
    this.consecutiveWins   = 0;
    this.peakPnL           = 0;
    this.troughPnL         = 0;
    this.tradeCount        = 0;
    this.sessionId         = Date.now();
  }

  softReset() {
    // Reset run count and stake but keep PnL history
    this.currentStake      = this.initialStake;
    this.runCount          = 0;
    this.martingaleDepth   = 0;
    this.isActive          = false;
    this.lastSignal        = null;
    this.consecutiveLosses = 0;
    this.consecutiveWins   = 0;
  }

  getState() {
    return {
      name:              this.name,
      origin:            this.origin,
      strategyType:      this.strategyType,
      typeLabel:         this._typeLabels[this.strategyType] || `Last ${this.strategyType} digits`,
      currentStake:      this.currentStake,
      initialStake:      this.initialStake,
      martingale:        this.martingale,
      takeProfit:        this.takeProfit,
      stopLoss:          this.stopLoss,
      useMartingale:     this.useMartingale,
      runCount:          this.runCount,
      winCount:          this.winCount,
      lossCount:         this.lossCount,
      tradeCount:        this.tradeCount,
      martingaleDepth:   this.martingaleDepth,
      totalPnL:          parseFloat(this.totalPnL.toFixed(2)),
      isActive:          this.isActive,
      lastSignal:        this.lastSignal,
      consecutiveLosses: this.consecutiveLosses,
      consecutiveWins:   this.consecutiveWins,
      peakPnL:           parseFloat(this.peakPnL.toFixed(2)),
      troughPnL:         parseFloat(this.troughPnL.toFixed(2)),
      maxDrawdown:       parseFloat(Math.abs(this.troughPnL).toFixed(2)),
      winRate:           this.tradeCount > 0 ? parseFloat((this.winCount / this.tradeCount * 100).toFixed(1)) : 0,
      profitFactor:      this.lossCount > 0 ? parseFloat((this.winCount / this.lossCount).toFixed(2)) : this.winCount > 0 ? 999 : 0,
      pnlToStopLoss:     parseFloat((this.stopLoss + this.totalPnL).toFixed(2)),
      takeProfitProgress: parseFloat((this.runCount / this.takeProfit * 100).toFixed(1)),
      martingaleProgression: this._getMartProgression(),
    };
  }

  _getMartProgression() {
    const levels = [];
    let s = this.initialStake;
    for (let i = 0; i <= 10; i++) {
      levels.push({ level: i, stake: parseFloat(s.toFixed(2)), cumLoss: parseFloat((this.initialStake * (Math.pow(this.martingale, i) - 1) / (this.martingale - 1)).toFixed(2)) });
      s *= this.martingale;
    }
    return levels;
  }

  getTypeLabel() { return this._typeLabels[this.strategyType] || `Last ${this.strategyType} digits`; }

  // Expected value analysis
  getExpectedValue(winProbability = 0.5, payoutRatio = 0.95) {
    return winProbability * payoutRatio - (1 - winProbability);
  }

  // Probability of losing N consecutive times
  getLossProbability(n) { return Math.pow(0.5, n); }

  // Risk of ruin estimate (crude)
  getRiskOfRuin(bankroll) {
    const maxLoss = this.initialStake * (Math.pow(this.martingale, this.martingaleDepth + 1) - 1) / (this.martingale - 1);
    return maxLoss >= bankroll ? 1 : maxLoss / bankroll;
  }

  serialize() { return JSON.stringify(this.getState()); }

  static fromJSON(json) {
    const s = JSON.parse(json);
    const instance = new EvOdDirectionalStrategy({ strategyType: s.strategyType, stake: s.initialStake, martingale: s.martingale, takeProfit: s.takeProfit, stopLoss: s.stopLoss, useMartingale: s.useMartingale });
    instance.runCount = s.runCount;
    instance.winCount = s.winCount;
    instance.lossCount = s.lossCount;
    instance.totalPnL = s.totalPnL;
    instance.martingaleDepth = s.martingaleDepth;
    instance.currentStake = s.currentStake;
    return instance;
  }
}
