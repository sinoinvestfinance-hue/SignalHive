// ai/ai-engine.js — DerivPro AI | Multi-Layer AI Decision Engine
'use strict';

export class AIEngine {
  constructor(config = {}) {
    this.mode       = config.mode      ?? 'balanced';
    this.threshold  = config.threshold ?? 65;
    this.enabled    = true;

    // Mode configurations
    this._modes = {
      conservative: { minStreak: 5, rsiMin: 35, rsiMax: 65, freqThresh: 2.0, martMax: 3, baseBoost: -15 },
      balanced:     { minStreak: 3, rsiMin: 30, rsiMax: 70, freqThresh: 1.5, martMax: 5, baseBoost: 0   },
      aggressive:   { minStreak: 2, rsiMin: 25, rsiMax: 75, freqThresh: 1.2, martMax: 7, baseBoost: +10 },
      hyper:        { minStreak: 2, rsiMin: 20, rsiMax: 80, freqThresh: 1.0, martMax: 9, baseBoost: +20 },
    };

    // AI state
    this._lastSignal    = null;
    this._lastConf      = 0;
    this._history       = [];    // last 200 decisions
    this._wins          = 0;
    this._losses        = 0;
    this._layerScores   = {};

    // Self-learning weights (start equal)
    this._weights = {
      streak:    0.22,
      frequency: 0.15,
      momentum:  0.15,
      martingale: 0.10,
      ema:       0.13,
      rsi:       0.10,
      atr:       0.08,
      noise:     0.07,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN ANALYSIS — produces confidence score + signal
  // ─────────────────────────────────────────────────────────────────────────
  analyze({ digits = [], ticks = [], indicators = {}, strategy = {} }) {
    if (!digits.length) return this._noSignal('Insufficient digit data');

    const cfg = this._modes[this.mode] || this._modes.balanced;
    const scores = {};
    const reasons = [];

    // ── Layer 1: Even/Odd Streak Analysis ──────────────────────────────────
    const streakResult = this._analyzeStreak(digits, cfg);
    scores.streak = streakResult.score;
    reasons.push(streakResult.reason);
    document.getElementById('layer-streak')?.setAttribute('class', `badge ${this._badgeClass(streakResult.score)}`);
    document.getElementById('layer-streak')?.setAttribute('textContent', streakResult.label);
    this._updateLayerBadge('streak', streakResult);

    // ── Layer 2: Digit Frequency Bias ──────────────────────────────────────
    const freqResult = this._analyzeFrequency(digits, cfg);
    scores.frequency = freqResult.score;
    reasons.push(freqResult.reason);
    this._updateLayerBadge('freq', freqResult);

    // ── Layer 3: Momentum Oscillator ───────────────────────────────────────
    const momResult = this._analyzeMomentum(digits, ticks);
    scores.momentum = momResult.score;
    reasons.push(momResult.reason);
    this._updateLayerBadge('momentum', momResult);

    // ── Layer 4: Martingale Depth Filter ──────────────────────────────────
    const martResult = this._analyzeMartingaleRisk(strategy, cfg);
    scores.martingale = martResult.score;
    reasons.push(martResult.reason);
    this._updateLayerBadge('martfilter', martResult);

    // ── Layer 5: EMA Trend Confirmation ───────────────────────────────────
    const emaResult = this._analyzeEMA(indicators);
    scores.ema = emaResult.score;
    reasons.push(emaResult.reason);
    this._updateLayerBadge('ema', emaResult);

    // ── Layer 6: RSI Oversold/Overbought ──────────────────────────────────
    const rsiResult = this._analyzeRSI(indicators, cfg);
    scores.rsi = rsiResult.score;
    reasons.push(rsiResult.reason);
    this._updateLayerBadge('rsi', rsiResult);

    // ── Layer 7: Volatility Gate (ATR) ────────────────────────────────────
    const atrResult = this._analyzeATR(indicators);
    scores.atr = atrResult.score;
    reasons.push(atrResult.reason);
    this._updateLayerBadge('atr', atrResult);

    // ── Layer 8: Noise Filter ─────────────────────────────────────────────
    const noiseResult = this._analyzeNoise(digits);
    scores.noise = noiseResult.score;
    reasons.push(noiseResult.reason);
    this._updateLayerBadge('noise', noiseResult);

    // ── Weighted Composite Score ───────────────────────────────────────────
    let composite = 0;
    for (const [layer, weight] of Object.entries(this._weights)) {
      composite += (scores[layer] ?? 50) * weight;
    }
    composite = Math.max(0, Math.min(100, composite + cfg.baseBoost));

    // ── Signal Direction from streak ──────────────────────────────────────
    const signal = streakResult.signal || this._deriveSignal(digits);

    this._layerScores  = scores;
    this._lastConf     = Math.round(composite);
    this._lastSignal   = signal;

    const result = {
      confidence: this._lastConf,
      signal,
      allowed: this._lastConf >= this.threshold,
      mode: this.mode,
      threshold: this.threshold,
      reason: reasons.filter(Boolean).slice(0, 3).join(' | '),
      scores,
      weights: this._weights,
      layers: { streakResult, freqResult, momResult, martResult, emaResult, rsiResult, atrResult, noiseResult },
    };

    this._history.push({ time: Date.now(), ...result });
    if (this._history.length > 200) this._history.shift();

    return result;
  }

  // ── Layer 1: Streak ──
  _analyzeStreak(digits, cfg) {
    const n = Math.min(digits.length, 20);
    const last = digits.slice(-n);
    let streak = 1, type = last[last.length-1] % 2 === 0 ? 'even' : 'odd';
    for (let i = last.length - 2; i >= 0; i--) {
      const isEven = last[i] % 2 === 0;
      if ((type === 'even' && isEven) || (type === 'odd' && !isEven)) streak++;
      else break;
    }
    const signal = type === 'even' ? 'DIGITEVEN' : 'DIGITODD';
    if (streak < cfg.minStreak) return { score: 20, signal: null, reason: `Streak ${streak} < min ${cfg.minStreak}`, label: `${streak}`, ...this._lowBadge() };
    const score = Math.min(50 + streak * 8, 95);
    return { score, signal, streak, type, reason: `${streak}-digit ${type} streak → ${signal}`, label: `${streak}`, ...this._scoreBadge(score) };
  }

  // ── Layer 2: Frequency ──
  _analyzeFrequency(digits, cfg) {
    const last100 = digits.slice(-100);
    if (last100.length < 20) return { score: 50, reason: 'Insufficient frequency data', ...this._midBadge() };
    const evens = last100.filter(d => d % 2 === 0).length;
    const odds  = last100.length - evens;
    const evenPct = evens / last100.length;
    const oddPct  = odds / last100.length;
    const bias = Math.abs(evenPct - 0.5);
    const score = 50 + bias * 100; // up to +50 bonus
    const dominant = evenPct > 0.5 ? 'EVEN' : 'ODD';
    return { score: Math.min(score, 90), reason: `Freq bias ${(bias * 100).toFixed(1)}% → ${dominant}`, ...this._scoreBadge(score) };
  }

  // ── Layer 3: Momentum ──
  _analyzeMomentum(digits, ticks) {
    if (digits.length < 10) return { score: 50, reason: 'Insufficient momentum data', ...this._midBadge() };
    const recent = digits.slice(-10);
    const older  = digits.slice(-20, -10);
    const recentEvenRate = recent.filter(d => d % 2 === 0).length / recent.length;
    const olderEvenRate  = older.length ? older.filter(d => d % 2 === 0).length / older.length : 0.5;
    const momentum = recentEvenRate - olderEvenRate;
    const score = 50 + momentum * 80;
    return { score: Math.max(20, Math.min(85, score)), reason: `Momentum ${(momentum * 100).toFixed(1)}%`, ...this._scoreBadge(score) };
  }

  // ── Layer 4: Martingale Risk ──
  _analyzeMartingaleRisk(strategy, cfg) {
    const depth = strategy.martingaleDepth ?? 0;
    if (depth >= cfg.martMax) return { score: 5, reason: `Martingale depth ${depth} — BLOCK`, ...this._lowBadge() };
    const score = Math.max(10, 90 - depth * 15);
    return { score, reason: `Martingale depth: ${depth}`, ...this._scoreBadge(score) };
  }

  // ── Layer 5: EMA ──
  _analyzeEMA(indicators) {
    const { ema9, ema21, ema55 } = indicators;
    if (!ema9 || !ema21) return { score: 50, reason: 'EMA unavailable', ...this._midBadge() };
    const bullish = ema9 > ema21;
    const score = bullish ? 65 : 40;
    return { score, reason: `EMA9 ${bullish ? '>' : '<'} EMA21 — ${bullish ? 'BULL' : 'BEAR'}`, ...this._scoreBadge(score) };
  }

  // ── Layer 6: RSI ──
  _analyzeRSI(indicators, cfg) {
    const rsi = indicators.rsi14;
    if (rsi === undefined) return { score: 50, reason: 'RSI unavailable', ...this._midBadge() };
    if (rsi < cfg.rsiMin) return { score: 75, reason: `RSI ${rsi.toFixed(1)} oversold`, ...this._highBadge() };
    if (rsi > cfg.rsiMax) return { score: 75, reason: `RSI ${rsi.toFixed(1)} overbought`, ...this._highBadge() };
    const score = 50 + Math.abs(rsi - 50) * 0.5;
    return { score, reason: `RSI ${rsi.toFixed(1)} neutral`, ...this._scoreBadge(score) };
  }

  // ── Layer 7: ATR Volatility Gate ──
  _analyzeATR(indicators) {
    const atr = indicators.atr14;
    const price = indicators.lastPrice;
    if (!atr || !price) return { score: 55, reason: 'ATR unavailable', ...this._midBadge() };
    const atrPct = (atr / price) * 100;
    if (atrPct > 0.5) return { score: 70, reason: `High vol ATR ${atrPct.toFixed(3)}%`, ...this._highBadge() };
    if (atrPct < 0.05) return { score: 35, reason: `Low vol ATR ${atrPct.toFixed(3)}%`, ...this._lowBadge() };
    return { score: 60, reason: `ATR ${atrPct.toFixed(3)}%`, ...this._midBadge() };
  }

  // ── Layer 8: Noise Filter ──
  _analyzeNoise(digits) {
    if (digits.length < 20) return { score: 50, reason: 'Noise: insufficient data', ...this._midBadge() };
    const last20 = digits.slice(-20);
    // Count alternating transitions
    let transitions = 0;
    for (let i = 1; i < last20.length; i++) {
      if ((last20[i] % 2 === 0) !== (last20[i-1] % 2 === 0)) transitions++;
    }
    const noiseRate = transitions / (last20.length - 1);
    if (noiseRate > 0.7) return { score: 30, reason: `High noise ${(noiseRate * 100).toFixed(0)}%`, ...this._lowBadge() };
    if (noiseRate < 0.4) return { score: 75, reason: `Low noise — trending`, ...this._highBadge() };
    return { score: 55, reason: `Noise ${(noiseRate * 100).toFixed(0)}%`, ...this._midBadge() };
  }

  _deriveSignal(digits) {
    if (!digits.length) return null;
    const last = digits[digits.length - 1];
    return last % 2 === 0 ? 'DIGITEVEN' : 'DIGITODD';
  }

  // ── Badges ──
  _lowBadge()  { return { badgeClass: 'badge-red',    label: 'LOW'  }; }
  _midBadge()  { return { badgeClass: 'badge-amber',  label: 'MID'  }; }
  _highBadge() { return { badgeClass: 'badge-green',  label: 'HIGH' }; }
  _scoreBadge(score) {
    if (score >= 70) return this._highBadge();
    if (score >= 45) return this._midBadge();
    return this._lowBadge();
  }
  _badgeClass(score) {
    if (score >= 70) return 'badge badge-green';
    if (score >= 45) return 'badge badge-amber';
    return 'badge badge-red';
  }

  _updateLayerBadge(key, result) {
    const el = document.getElementById(`layer-${key}`);
    if (!el) return;
    el.className = `badge ${result.badgeClass || 'badge-amber'}`;
    el.textContent = result.label || '—';
  }

  _noSignal(reason) {
    return { confidence: 0, signal: null, allowed: false, reason, mode: this.mode, threshold: this.threshold, scores: {}, weights: this._weights };
  }

  // ── Feedback / Self-Learning ──
  onFeedback(win) {
    win ? this._wins++ : this._losses++;
    const last = this._history[this._history.length - 1];
    if (!last) return;
    // Simple reinforcement: boost weights of high-scoring layers on wins, reduce on losses
    const direction = win ? 0.01 : -0.01;
    for (const [layer, score] of Object.entries(last.scores)) {
      if (score > 65 && win) this._weights[layer] = Math.min(0.35, this._weights[layer] + direction);
      if (score > 65 && !win) this._weights[layer] = Math.max(0.03, this._weights[layer] - direction * 0.5);
    }
    this._normalizeWeights();
  }

  _normalizeWeights() {
    const total = Object.values(this._weights).reduce((s, v) => s + v, 0);
    for (const k in this._weights) this._weights[k] = parseFloat((this._weights[k] / total).toFixed(4));
  }

  setMode(mode) {
    if (this._modes[mode]) {
      this.mode = mode;
      const modeLabels = { conservative: '🛡️ CONSERVATIVE', balanced: '⚖️ BALANCED', aggressive: '⚡ AGGRESSIVE', hyper: '🔥 HYPER' };
    }
  }

  getStats() {
    const total = this._wins + this._losses;
    return {
      wins: this._wins, losses: this._losses, total,
      winRate: total ? (this._wins / total * 100).toFixed(1) : 0,
      lastConfidence: this._lastConf,
      lastSignal: this._lastSignal,
      mode: this.mode, threshold: this.threshold,
      weights: this._weights,
    };
  }
}
