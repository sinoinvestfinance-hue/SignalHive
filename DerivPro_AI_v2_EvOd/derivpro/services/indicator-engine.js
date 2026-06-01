// services/indicator-engine.js — DerivPro AI | Technical Analysis Engine
'use strict';

export class IndicatorEngine {
  constructor(maxBuffer = 2000) {
    this._prices  = [];
    this._volumes = [];   // synthetic (tick count proxy)
    this._maxBuf  = maxBuffer;
    this._cache   = {};
    this._dirty   = true;
  }

  addPrice(price) {
    this._prices.push(parseFloat(price));
    this._volumes.push(1);
    if (this._prices.length > this._maxBuf) {
      this._prices.shift();
      this._volumes.shift();
    }
    this._dirty = true;
    this._cache = {};
  }

  addPrices(prices) { prices.forEach(p => this.addPrice(p)); }

  // ─────────────────────────────────────────────────────────────────────────
  // MOVING AVERAGES
  // ─────────────────────────────────────────────────────────────────────────
  ema(period, prices) {
    const src = prices || this._prices;
    if (src.length < period) return null;
    const k = 2 / (period + 1);
    let ema = src.slice(0, period).reduce((s, v) => s + v, 0) / period;
    for (let i = period; i < src.length; i++) ema = src[i] * k + ema * (1 - k);
    return parseFloat(ema.toFixed(6));
  }

  sma(period, prices) {
    const src = prices || this._prices;
    if (src.length < period) return null;
    const slice = src.slice(-period);
    return parseFloat((slice.reduce((s, v) => s + v, 0) / period).toFixed(6));
  }

  wma(period, prices) {
    const src = prices || this._prices;
    if (src.length < period) return null;
    const slice = src.slice(-period);
    let sum = 0, weights = 0;
    slice.forEach((v, i) => { const w = i + 1; sum += v * w; weights += w; });
    return parseFloat((sum / weights).toFixed(6));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MACD (12/26/9)
  // ─────────────────────────────────────────────────────────────────────────
  macd(fast = 12, slow = 26, signal = 9) {
    if (this._prices.length < slow + signal) return { macd: null, signal: null, histogram: null };
    // Build EMA arrays
    const buildEMA = (period) => {
      const k = 2 / (period + 1);
      let ema = this._prices.slice(0, period).reduce((s, v) => s + v, 0) / period;
      const emas = [ema];
      for (let i = period; i < this._prices.length; i++) { ema = this._prices[i] * k + ema * (1 - k); emas.push(ema); }
      return emas;
    };
    const fastEMA = buildEMA(fast);
    const slowEMA = buildEMA(slow);
    const offset  = slow - fast;
    const macdLine = slowEMA.map((v, i) => fastEMA[i + offset] - v).filter(v => !isNaN(v));
    const signalLine = this._buildEMAFromArray(macdLine, signal);
    const hist = signalLine !== null ? macdLine[macdLine.length - 1] - signalLine : null;
    return {
      macd:      parseFloat((macdLine[macdLine.length - 1] || 0).toFixed(8)),
      signal:    signalLine !== null ? parseFloat(signalLine.toFixed(8)) : null,
      histogram: hist !== null ? parseFloat(hist.toFixed(8)) : null,
    };
  }

  _buildEMAFromArray(arr, period) {
    if (arr.length < period) return null;
    const k = 2 / (period + 1);
    let ema = arr.slice(0, period).reduce((s, v) => s + v, 0) / period;
    for (let i = period; i < arr.length; i++) ema = arr[i] * k + ema * (1 - k);
    return ema;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RSI (Wilder's)
  // ─────────────────────────────────────────────────────────────────────────
  rsi(period = 14) {
    if (this._prices.length < period + 1) return null;
    const changes = [];
    for (let i = 1; i < this._prices.length; i++) changes.push(this._prices[i] - this._prices[i-1]);
    let gains = 0, losses = 0;
    changes.slice(0, period).forEach(c => { if (c > 0) gains += c; else losses += Math.abs(c); });
    let avgGain = gains / period, avgLoss = losses / period;
    for (let i = period; i < changes.length; i++) {
      const c = changes[i];
      avgGain = (avgGain * (period - 1) + (c > 0 ? c : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (c < 0 ? Math.abs(c) : 0)) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    return parseFloat((100 - 100 / (1 + rs)).toFixed(2));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STOCHASTIC RSI (%K, %D)
  // ─────────────────────────────────────────────────────────────────────────
  stochasticRSI(rsiPeriod = 14, stochPeriod = 14, smoothK = 3, smoothD = 3) {
    if (this._prices.length < rsiPeriod * 2) return { k: null, d: null };
    const rsiValues = [];
    for (let i = rsiPeriod; i <= this._prices.length; i++) {
      const slice = this._prices.slice(0, i);
      const r = this._rsiFromPrices(slice, rsiPeriod);
      if (r !== null) rsiValues.push(r);
    }
    if (rsiValues.length < stochPeriod) return { k: null, d: null };
    const window = rsiValues.slice(-stochPeriod);
    const minRSI = Math.min(...window);
    const maxRSI = Math.max(...window);
    const rawK = maxRSI === minRSI ? 50 : (rsiValues[rsiValues.length - 1] - minRSI) / (maxRSI - minRSI) * 100;
    return { k: parseFloat(rawK.toFixed(2)), d: null };
  }

  _rsiFromPrices(prices, period) {
    if (prices.length < period + 1) return null;
    const changes = prices.slice(-period - 1).map((v, i, a) => i ? v - a[i-1] : 0).slice(1);
    const gains = changes.filter(c => c > 0), losses = changes.filter(c => c < 0).map(Math.abs);
    const ag = gains.reduce((s,v) => s+v, 0) / period;
    const al = losses.reduce((s,v) => s+v, 0) / period;
    const rs = al === 0 ? 100 : ag / al;
    return 100 - 100 / (1 + rs);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BOLLINGER BANDS
  // ─────────────────────────────────────────────────────────────────────────
  bollingerBands(period = 20, stdDev = 2) {
    if (this._prices.length < period) return { upper: null, middle: null, lower: null, width: null };
    const slice = this._prices.slice(-period);
    const mean = slice.reduce((s, v) => s + v, 0) / period;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    return {
      upper:  parseFloat((mean + stdDev * std).toFixed(6)),
      middle: parseFloat(mean.toFixed(6)),
      lower:  parseFloat((mean - stdDev * std).toFixed(6)),
      width:  parseFloat((stdDev * std * 2).toFixed(6)),
      squeeze: std < this._historicalStd(period * 2, period) * 0.8,
    };
  }

  _historicalStd(lookback, period) {
    if (this._prices.length < lookback) return 0.01;
    const slice = this._prices.slice(-lookback, -period);
    if (!slice.length) return 0.01;
    const mean = slice.reduce((s, v) => s + v, 0) / slice.length;
    return Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / slice.length);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ATR (Average True Range)
  // ─────────────────────────────────────────────────────────────────────────
  atr(period = 14) {
    if (this._prices.length < period + 1) return null;
    const trueRanges = [];
    for (let i = 1; i < this._prices.length; i++) {
      const h = this._prices[i] * 1.0001; // synthetic high (no OHLC)
      const l = this._prices[i] * 0.9999;
      const prevC = this._prices[i - 1];
      trueRanges.push(Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC)));
    }
    if (trueRanges.length < period) return null;
    let atr = trueRanges.slice(0, period).reduce((s, v) => s + v, 0) / period;
    for (let i = period; i < trueRanges.length; i++) atr = (atr * (period - 1) + trueRanges[i]) / period;
    return parseFloat(atr.toFixed(8));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ADX (Average Directional Index) — simplified
  // ─────────────────────────────────────────────────────────────────────────
  adx(period = 14) {
    if (this._prices.length < period * 2) return { adx: null, plus: null, minus: null };
    const prices = this._prices;
    let plusDM = 0, minusDM = 0, trSum = 0;
    for (let i = 1; i <= period; i++) {
      const up = prices[prices.length - i] - prices[prices.length - i - 1];
      const down = prices[prices.length - i - 1] - prices[prices.length - i];
      const tr = Math.abs(prices[prices.length - i] - prices[prices.length - i - 1]);
      if (up > down && up > 0) plusDM += up;
      if (down > up && down > 0) minusDM += down;
      trSum += tr;
    }
    const plusDI = trSum ? (plusDM / trSum) * 100 : 0;
    const minusDI = trSum ? (minusDM / trSum) * 100 : 0;
    const dx = (plusDI + minusDI) ? Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100 : 0;
    return { adx: parseFloat(dx.toFixed(2)), plus: parseFloat(plusDI.toFixed(2)), minus: parseFloat(minusDI.toFixed(2)) };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VWAP (Volume-Weighted Average Price)
  // ─────────────────────────────────────────────────────────────────────────
  vwap(period = 100) {
    const prices = this._prices.slice(-period);
    const vols   = this._volumes.slice(-period);
    if (!prices.length) return null;
    const sumPV = prices.reduce((s, p, i) => s + p * (vols[i] || 1), 0);
    const sumV  = vols.reduce((s, v) => s + v, 0);
    return parseFloat((sumPV / sumV).toFixed(6));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WILLIAMS %R
  // ─────────────────────────────────────────────────────────────────────────
  williamsR(period = 14) {
    if (this._prices.length < period) return null;
    const slice = this._prices.slice(-period);
    const highest = Math.max(...slice);
    const lowest  = Math.min(...slice);
    const last    = slice[slice.length - 1];
    return parseFloat(((highest - last) / (highest - lowest || 1) * -100).toFixed(2));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CCI (Commodity Channel Index)
  // ─────────────────────────────────────────────────────────────────────────
  cci(period = 20) {
    if (this._prices.length < period) return null;
    const slice = this._prices.slice(-period);
    const mean = slice.reduce((s, v) => s + v, 0) / period;
    const meanDev = slice.reduce((s, v) => s + Math.abs(v - mean), 0) / period;
    const last = slice[slice.length - 1];
    return parseFloat(((last - mean) / (0.015 * (meanDev || 1))).toFixed(2));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MOMENTUM / ROC
  // ─────────────────────────────────────────────────────────────────────────
  momentum(period = 10) {
    if (this._prices.length < period + 1) return null;
    const prices = this._prices;
    return parseFloat((prices[prices.length - 1] - prices[prices.length - 1 - period]).toFixed(8));
  }

  roc(period = 10) {
    if (this._prices.length < period + 1) return null;
    const prices = this._prices;
    const prev = prices[prices.length - 1 - period];
    return parseFloat(((prices[prices.length - 1] - prev) / (prev || 1) * 100).toFixed(4));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SUPERTREND (simplified)
  // ─────────────────────────────────────────────────────────────────────────
  supertrend(period = 10, multiplier = 3) {
    const atrVal = this.atr(period);
    if (!atrVal) return { trend: null, value: null };
    const price = this._prices[this._prices.length - 1];
    const upper = price + multiplier * atrVal;
    const lower = price - multiplier * atrVal;
    const trend = price > lower ? 'up' : 'down';
    return { trend, upper: parseFloat(upper.toFixed(6)), lower: parseFloat(lower.toFixed(6)), value: trend === 'up' ? lower : upper };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DONCHIAN CHANNELS
  // ─────────────────────────────────────────────────────────────────────────
  donchianChannels(period = 20) {
    if (this._prices.length < period) return { upper: null, lower: null, middle: null };
    const slice = this._prices.slice(-period);
    const upper = Math.max(...slice);
    const lower = Math.min(...slice);
    return { upper: parseFloat(upper.toFixed(6)), lower: parseFloat(lower.toFixed(6)), middle: parseFloat(((upper + lower) / 2).toFixed(6)) };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // GET ALL INDICATORS (consolidated output for AI engine)
  // ─────────────────────────────────────────────────────────────────────────
  getAll() {
    const prices = this._prices;
    const last   = prices[prices.length - 1] || 0;
    return {
      lastPrice: last,
      ema9:    this.ema(9),
      ema21:   this.ema(21),
      ema55:   this.ema(55),
      ema200:  this.ema(200),
      sma20:   this.sma(20),
      sma50:   this.sma(50),
      wma10:   this.wma(10),
      vwap:    this.vwap(100),
      rsi14:   this.rsi(14),
      rsi7:    this.rsi(7),
      stochRSI: this.stochasticRSI(),
      macd:    this.macd(),
      bb:      this.bollingerBands(),
      atr14:   this.atr(14),
      atr7:    this.atr(7),
      adx:     this.adx(14),
      cci:     this.cci(20),
      williams: this.williamsR(14),
      momentum: this.momentum(10),
      roc:     this.roc(10),
      supertrend: this.supertrend(),
      donchian:   this.donchianChannels(20),
      priceCount: prices.length,
    };
  }

  getPrice()  { return this._prices[this._prices.length - 1] ?? null; }
  getCount()  { return this._prices.length; }
  getPrices(n){ return this._prices.slice(-n); }

  reset() { this._prices = []; this._volumes = []; this._cache = {}; }
}
