// strategies/martingale.js — DerivPro AI | Martingale Engine
'use strict';

export class MartingaleEngine {
  constructor(config = {}) {
    this.initialStake   = config.initialStake ?? 0.50;
    this.multiplier     = config.multiplier   ?? 2.0;
    this.maxDepth       = config.maxDepth     ?? 8;
    this.currentStake   = this.initialStake;
    this.depth          = 0;
    this.active         = false;
    this.totalLost      = 0;
    this.totalRecovered = 0;
    this.history        = [];
  }

  // Called after a loss — doubles (or multiplies) stake
  onLoss(stake) {
    const lost = stake ?? this.currentStake;
    this.totalLost += lost;
    this.depth++;
    if (this.depth >= this.maxDepth) {
      // Max depth reached — don't increase further (circuit breaker)
      this.active = true;
      return { stake: this.currentStake, depth: this.depth, maxReached: true };
    }
    this.currentStake = parseFloat((this.currentStake * this.multiplier).toFixed(2));
    this.active = true;
    this.history.push({ type: 'loss', depth: this.depth, stake: this.currentStake });
    return { stake: this.currentStake, depth: this.depth, maxReached: false };
  }

  // Called after a win — resets to initial stake
  onWin(profit) {
    const recovered = profit ?? 0;
    this.totalRecovered += recovered;
    const prevDepth = this.depth;
    this.currentStake = this.initialStake;
    this.depth = 0;
    this.active = false;
    this.history.push({ type: 'win', depth: prevDepth, stake: this.currentStake });
    return { stake: this.currentStake, depth: 0, prevDepth, recovered };
  }

  reset() {
    this.currentStake   = this.initialStake;
    this.depth          = 0;
    this.active         = false;
    this.totalLost      = 0;
    this.totalRecovered = 0;
    this.history        = [];
  }

  // Get the stake for level N
  getStakeAtLevel(n) {
    return parseFloat((this.initialStake * Math.pow(this.multiplier, n)).toFixed(2));
  }

  // Maximum loss exposure up to level N
  getCumulativeLoss(levels) {
    const n = levels ?? this.depth;
    return parseFloat((this.initialStake * (Math.pow(this.multiplier, n) - 1) / (this.multiplier - 1)).toFixed(2));
  }

  // Kelly Criterion stake (fractional Kelly)
  kellyStake(winProb, payoutRatio, bankroll, kellyFraction = 0.25) {
    const q = 1 - winProb;
    const kelly = (winProb * payoutRatio - q) / payoutRatio;
    const fraction = Math.max(0, kelly * kellyFraction);
    return parseFloat((bankroll * fraction).toFixed(2));
  }

  // Fibonacci alternative to Martingale
  fibonacciStake(sequence = [0.5, 0.5, 1, 1.5, 2.5, 4, 6.5, 10.5]) {
    return sequence[Math.min(this.depth, sequence.length - 1)];
  }

  // D'Alembert alternative
  dalembert(unit = this.initialStake) {
    return parseFloat((this.initialStake + this.depth * unit).toFixed(2));
  }

  getState() {
    return {
      initialStake:   this.initialStake,
      currentStake:   this.currentStake,
      multiplier:     this.multiplier,
      depth:          this.depth,
      maxDepth:       this.maxDepth,
      active:         this.active,
      totalLost:      parseFloat(this.totalLost.toFixed(2)),
      totalRecovered: parseFloat(this.totalRecovered.toFixed(2)),
      cumulativeLoss: this.getCumulativeLoss(),
      progression:    this._buildProgression(),
    };
  }

  _buildProgression() {
    const prog = [];
    let s = this.initialStake, cumLoss = 0;
    for (let i = 0; i <= Math.min(this.maxDepth, 10); i++) {
      prog.push({ level: i, stake: parseFloat(s.toFixed(2)), cumLoss: parseFloat(cumLoss.toFixed(2)) });
      cumLoss += s;
      s = parseFloat((s * this.multiplier).toFixed(2));
    }
    return prog;
  }

  setMultiplier(m) { this.multiplier = parseFloat(m); }
  setInitialStake(s) { this.initialStake = parseFloat(s); if (this.depth === 0) this.currentStake = this.initialStake; }
  setMaxDepth(d) { this.maxDepth = parseInt(d); }
}
