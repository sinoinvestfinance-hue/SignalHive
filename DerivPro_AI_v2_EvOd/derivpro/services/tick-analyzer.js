// services/tick-analyzer.js — DerivPro AI | Tick Intelligence Engine
'use strict';

export class TickAnalyzer {
  constructor(maxBuffer = 1000) {
    this._ticks   = [];
    this._maxBuf  = maxBuffer;
    this._changes = [];
    this._times   = [];
  }

  addTick(price, timestamp) {
    const t = timestamp || Date.now();
    const prev = this._ticks[this._ticks.length - 1] ?? price;
    const change = price - prev;
    this._ticks.push(price);
    this._changes.push(change);
    this._times.push(t);
    if (this._ticks.length > this._maxBuf) {
      this._ticks.shift(); this._changes.shift(); this._times.shift();
    }
  }

  getTicks(n) { return n ? this._ticks.slice(-n) : [...this._ticks]; }

  // Tick direction: +1 rise, -1 fall, 0 flat
  getDirections(n = 50) {
    const changes = this._changes.slice(-n);
    return changes.map(c => c > 0 ? 1 : c < 0 ? -1 : 0);
  }

  // Consecutive rise/fall streak
  getDirectionStreak() {
    const dirs = this.getDirections(30);
    if (!dirs.length) return { streak: 0, direction: 0 };
    let streak = 1, dir = dirs[dirs.length - 1];
    for (let i = dirs.length - 2; i >= 0; i--) {
      if (dirs[i] === dir && dir !== 0) streak++;
      else break;
    }
    return { streak, direction: dir, label: dir > 0 ? 'RISE' : dir < 0 ? 'FALL' : 'FLAT' };
  }

  // Price velocity (rate of change per second)
  getVelocity(n = 10) {
    const ticks = this._ticks.slice(-n);
    const times = this._times.slice(-n);
    if (ticks.length < 2) return 0;
    const dt = (times[times.length - 1] - times[0]) / 1000; // seconds
    const dp = ticks[ticks.length - 1] - ticks[0];
    return dt > 0 ? parseFloat((dp / dt).toFixed(8)) : 0;
  }

  // Acceleration (change in velocity)
  getAcceleration(n = 20) {
    const velRecent = this.getVelocity(Math.floor(n / 2));
    const velOlder  = this.getVelocity(n);
    return parseFloat((velRecent - velOlder).toFixed(8));
  }

  // Volatility (std deviation of changes)
  getVolatility(n = 50) {
    const changes = this._changes.slice(-n);
    if (changes.length < 2) return 0;
    const mean = changes.reduce((s, v) => s + v, 0) / changes.length;
    const variance = changes.reduce((s, v) => s + (v - mean) ** 2, 0) / changes.length;
    return parseFloat(Math.sqrt(variance).toFixed(8));
  }

  // Tick clustering (how many ticks in bursts)
  getTickRate(windowMs = 1000) {
    const now = Date.now();
    const recent = this._times.filter(t => now - t < windowMs);
    return recent.length;
  }

  // Detect momentum shift
  getMomentumShift(shortN = 5, longN = 20) {
    const shortVel = this.getVelocity(shortN);
    const longVel  = this.getVelocity(longN);
    const shift = shortVel - longVel;
    return { shift: parseFloat(shift.toFixed(8)), bullish: shift > 0, bearish: shift < 0 };
  }

  // Rise/Fall bias
  getRiseFallBias(n = 50) {
    const dirs = this.getDirections(n);
    const rises = dirs.filter(d => d > 0).length;
    const falls = dirs.filter(d => d < 0).length;
    const total = dirs.length || 1;
    return {
      rises, falls, total,
      risePct:  parseFloat((rises / total * 100).toFixed(1)),
      fallPct:  parseFloat((falls / total * 100).toFixed(1)),
      bias:     rises > falls ? 'bullish' : falls > rises ? 'bearish' : 'neutral',
    };
  }

  // Tick noise level (0 = trending, 1 = pure noise)
  getNoiseLevel(n = 30) {
    const dirs = this.getDirections(n);
    let transitions = 0;
    for (let i = 1; i < dirs.length; i++) { if (dirs[i] !== dirs[i-1] && dirs[i] !== 0) transitions++; }
    return dirs.length > 1 ? parseFloat((transitions / (dirs.length - 1)).toFixed(3)) : 0.5;
  }

  getState() {
    return {
      count:        this._ticks.length,
      lastPrice:    this._ticks[this._ticks.length - 1] ?? null,
      velocity:     this.getVelocity(10),
      acceleration: this.getAcceleration(20),
      volatility:   this.getVolatility(50),
      noiseLevel:   this.getNoiseLevel(30),
      streak:       this.getDirectionStreak(),
      bias:         this.getRiseFallBias(50),
      momentumShift: this.getMomentumShift(),
    };
  }

  reset() { this._ticks = []; this._changes = []; this._times = []; }
}
