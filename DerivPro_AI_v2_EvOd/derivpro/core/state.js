// core/state.js — DerivPro AI | Reactive State Manager
'use strict';

export class AppState {
  constructor() {
    this._state = {
      balance: 0, currency: 'USD', loginid: null,
      lastPrice: null, lastDigit: null,
      sessionData: { trades: 0, wins: 0, losses: 0, pnl: 0, dailyLoss: 0, consecLosses: 0 },
      aiMode: 'balanced', aiThreshold: 65,
      strategyConfig: { type: 2, stake: 0.5, martingale: 2, takeProfit: 8, stopLoss: 30, useMartingale: true },
      riskConfig: { maxDailyLoss: 100, maxConsecLosses: 8, maxMartDepth: 6, maxTrades: 200 },
      selectedMarket: 'R_25', isAutoTrading: false, isVirtualAuto: false,
      reconnects: 0, errors: 0, startTime: Date.now(),
    };
    this._listeners = {};
    this._db = null;
    this._saveTimer = null;
  }

  async load(db) {
    this._db = db;
    try {
      const saved = await db.loadState('appState');
      if (saved) {
        // Merge saved state (non-sensitive fields)
        const safe = ['aiMode', 'aiThreshold', 'strategyConfig', 'riskConfig', 'selectedMarket'];
        safe.forEach(k => { if (saved[k] !== undefined) this._state[k] = saved[k]; });
      }
    } catch {}
  }

  get(key) { return this._state[key]; }

  set(key, value) {
    const prev = this._state[key];
    this._state[key] = value;
    this._emit(key, value, prev);
    this._emit('*', { key, value, prev });
    this._debounceSave();
  }

  update(key, updater) {
    this.set(key, updater(this._state[key]));
  }

  getAll() { return { ...this._state }; }

  on(key, callback) {
    if (!this._listeners[key]) this._listeners[key] = [];
    this._listeners[key].push(callback);
    return () => this.off(key, callback);
  }

  off(key, callback) {
    if (this._listeners[key]) {
      this._listeners[key] = this._listeners[key].filter(cb => cb !== callback);
    }
  }

  _emit(key, value, prev) {
    (this._listeners[key] || []).forEach(cb => { try { cb(value, prev); } catch {} });
  }

  _debounceSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._persist(), 2000);
  }

  async _persist() {
    if (!this._db) return;
    try {
      const toSave = {
        aiMode: this._state.aiMode,
        aiThreshold: this._state.aiThreshold,
        strategyConfig: this._state.strategyConfig,
        riskConfig: this._state.riskConfig,
        selectedMarket: this._state.selectedMarket,
      };
      await this._db.saveState('appState', toSave);
    } catch {}
  }

  reset() {
    this._state.sessionData = { trades: 0, wins: 0, losses: 0, pnl: 0, dailyLoss: 0, consecLosses: 0 };
    this._state.startTime = Date.now();
    this._emit('sessionData', this._state.sessionData, null);
  }

  incrementStat(key, amount = 1) {
    const session = this._state.sessionData;
    session[key] = (session[key] || 0) + amount;
    this.set('sessionData', { ...session });
  }

  getUptime() {
    const ms = Date.now() - this._state.startTime;
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
    return `${h ? h + 'h ' : ''}${m ? m + 'm ' : ''}${s}s`;
  }
}
