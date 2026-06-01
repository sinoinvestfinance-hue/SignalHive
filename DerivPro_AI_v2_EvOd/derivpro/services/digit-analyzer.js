// services/digit-analyzer.js — DerivPro AI | Last Digit Statistical Analysis
'use strict';

export class DigitAnalyzer {
  constructor(maxBuffer = 5000) {
    this._digits   = [];        // raw digit history (0-9)
    this._maxBuf   = maxBuffer;
    this._freq     = new Array(10).fill(0);
    this._totalAdded = 0;

    // Streak tracking
    this._currentStreak = 0;
    this._currentType   = null;  // 'even' | 'odd'
    this._maxEvenStreak = 0;
    this._maxOddStreak  = 0;
    this._streakHistory = [];
  }

  // Add a single last digit
  addDigit(digit) {
    const d = parseInt(digit);
    if (isNaN(d) || d < 0 || d > 9) return;

    this._digits.push(d);
    this._freq[d]++;
    this._totalAdded++;

    // Maintain buffer size
    if (this._digits.length > this._maxBuf) {
      const removed = this._digits.shift();
      this._freq[removed] = Math.max(0, this._freq[removed] - 1);
    }

    // Update streak
    const isEven = d % 2 === 0;
    const type = isEven ? 'even' : 'odd';
    if (type === this._currentType) {
      this._currentStreak++;
    } else {
      if (this._currentType !== null) {
        this._streakHistory.push({ type: this._currentType, length: this._currentStreak });
        if (this._streakHistory.length > 1000) this._streakHistory.shift();
      }
      this._currentType = type;
      this._currentStreak = 1;
    }
    if (type === 'even') this._maxEvenStreak = Math.max(this._maxEvenStreak, this._currentStreak);
    else                 this._maxOddStreak  = Math.max(this._maxOddStreak,  this._currentStreak);
  }

  // Bulk add (from history)
  addDigits(digits) { digits.forEach(d => this.addDigit(d)); }

  // Get last N digits
  getDigits(n) {
    return n ? this._digits.slice(-n) : [...this._digits];
  }

  // Frequency distribution for last N digits
  getFrequency(n) {
    const digits = this.getDigits(n);
    const freq = new Array(10).fill(0);
    digits.forEach(d => freq[d]++);
    const total = digits.length || 1;
    return freq.map((count, digit) => ({
      digit, count,
      pct: parseFloat((count / total * 100).toFixed(2)),
      expected: 10.0,
      deviation: parseFloat(((count / total * 100) - 10).toFixed(2)),
    }));
  }

  // Even/Odd distribution
  getEvenOdd(n = 100) {
    const digits = this.getDigits(n);
    const evens = digits.filter(d => d % 2 === 0);
    const odds  = digits.filter(d => d % 2 !== 0);
    return {
      evens: evens.length, odds: odds.length, total: digits.length,
      evenPct: parseFloat((evens.length / (digits.length || 1) * 100).toFixed(2)),
      oddPct:  parseFloat((odds.length  / (digits.length || 1) * 100).toFixed(2)),
      bias:    evens.length > odds.length ? 'even' : odds.length > evens.length ? 'odd' : 'neutral',
      biasStrength: parseFloat((Math.abs(evens.length - odds.length) / (digits.length || 1) * 100).toFixed(2)),
    };
  }

  // Streak information
  getStreakInfo() {
    return {
      streak:  this._currentStreak,
      type:    this._currentType,
      maxEven: this._maxEvenStreak,
      maxOdd:  this._maxOddStreak,
      history: this._streakHistory.slice(-20),
    };
  }

  // Check ALL_EVEN or ALL_ODD for last N digits (mirrors DBot XML condition)
  checkCondition(n, condition) {
    const lastN = this.getDigits(n);
    if (lastN.length < n) return false;
    if (condition === 'ALL_EVEN') return lastN.every(d => d % 2 === 0);
    if (condition === 'ALL_ODD')  return lastN.every(d => d % 2 !== 0);
    return false;
  }

  // ── Statistical Anomaly Detection ──
  detectAnomalies(n = 100) {
    const freq  = this.getFrequency(n);
    const eo    = this.getEvenOdd(n);
    const streak = this.getStreakInfo();
    const anomalies = [];

    // Chi-squared style detection — expected 10% per digit
    freq.forEach(({ digit, pct, deviation }) => {
      if (Math.abs(deviation) > 4) anomalies.push(`Digit ${digit}: ${pct.toFixed(1)}% (${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}% vs expected 10%)`);
    });

    // Even/Odd extreme bias
    if (eo.biasStrength > 15) anomalies.push(`E/O bias: ${eo.evenPct.toFixed(1)}% Even / ${eo.oddPct.toFixed(1)}% Odd (${eo.biasStrength.toFixed(1)}% skew)`);

    // Extreme streak
    if (streak.streak >= 6) anomalies.push(`🔥 Active ${streak.streak}-digit ${streak.type} streak — high signal`);

    // Hot/Cold digits
    const hot  = freq.filter(f => f.deviation > 3).map(f => f.digit);
    const cold = freq.filter(f => f.deviation < -3).map(f => f.digit);
    if (hot.length)  anomalies.push(`Hot digits (over-represented): ${hot.join(', ')}`);
    if (cold.length) anomalies.push(`Cold digits (under-represented): ${cold.join(', ')}`);

    return anomalies;
  }

  // Hot/Cold digits
  getHotColdDigits(n = 200) {
    const freq = this.getFrequency(n);
    const sorted = [...freq].sort((a, b) => b.pct - a.pct);
    return { hot: sorted.slice(0, 3), cold: sorted.slice(-3).reverse() };
  }

  // Digit cycle detection (looks for repeating patterns)
  detectCycles(n = 100) {
    const digits = this.getDigits(n);
    const cycles = [];
    for (let period = 2; period <= 10; period++) {
      let matches = 0, checks = 0;
      for (let i = period; i < digits.length; i++) {
        if (digits[i] === digits[i - period]) matches++;
        checks++;
      }
      const matchRate = checks ? matches / checks : 0;
      if (matchRate > 0.2) cycles.push({ period, matchRate: parseFloat((matchRate * 100).toFixed(1)) });
    }
    return cycles.sort((a, b) => b.matchRate - a.matchRate);
  }

  // Consecutive same digit detection
  getConsecutiveReps(n = 50) {
    const digits = this.getDigits(n);
    let max = 1, cur = 1, repDigit = digits[0];
    for (let i = 1; i < digits.length; i++) {
      if (digits[i] === digits[i-1]) { cur++; if (cur > max) { max = cur; repDigit = digits[i]; } }
      else cur = 1;
    }
    return { maxConsecutive: max, digit: repDigit };
  }

  // Probability matrix for next digit
  getProbabilityMatrix(lookback = 100) {
    // Transition probabilities: given last digit, what's the probability of each next digit?
    const digits = this.getDigits(lookback);
    const matrix = {};
    for (let d = 0; d <= 9; d++) {
      matrix[d] = new Array(10).fill(0);
    }
    for (let i = 1; i < digits.length; i++) {
      matrix[digits[i-1]][digits[i]]++;
    }
    // Normalize
    for (let d = 0; d <= 9; d++) {
      const total = matrix[d].reduce((s, v) => s + v, 0) || 1;
      matrix[d] = matrix[d].map(v => parseFloat((v / total).toFixed(3)));
    }
    return matrix;
  }

  // Even/Odd probability given current streak
  getEOProbability(streakType, streakLength) {
    // P(continuation after N) = historical rate
    const history = this._streakHistory.filter(s => s.type === streakType && s.length >= streakLength);
    const continued = history.filter(s => s.length > streakLength).length;
    if (!history.length) return 0.5;
    return parseFloat((continued / history.length).toFixed(3));
  }

  getBufferSize()  { return this._digits.length; }
  getTotalAdded()  { return this._totalAdded; }
  getLastDigit()   { return this._digits[this._digits.length - 1] ?? null; }
  getLast(n = 10)  { return this._digits.slice(-n); }

  reset() {
    this._digits = [];
    this._freq = new Array(10).fill(0);
    this._totalAdded = 0;
    this._currentStreak = 0;
    this._currentType = null;
    this._maxEvenStreak = 0;
    this._maxOddStreak = 0;
    this._streakHistory = [];
  }
}
