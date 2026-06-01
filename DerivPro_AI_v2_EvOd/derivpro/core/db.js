// core/db.js — DerivPro AI | IndexedDB Architecture
'use strict';

export class AppDB {
  constructor() {
    this.dbName = 'DerivProAI';
    this.version = 3;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Trades store
        if (!db.objectStoreNames.contains('trades')) {
          const trades = db.createObjectStore('trades', { keyPath: 'id', autoIncrement: true });
          trades.createIndex('time', 'time', { unique: false });
          trades.createIndex('win', 'win', { unique: false });
          trades.createIndex('type', 'type', { unique: false });
          trades.createIndex('strategy', 'strategy', { unique: false });
        }
        // Logs store
        if (!db.objectStoreNames.contains('logs')) {
          const logs = db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
          logs.createIndex('time', 'time', { unique: false });
          logs.createIndex('type', 'type', { unique: false });
        }
        // State store (key/value)
        if (!db.objectStoreNames.contains('state')) {
          db.createObjectStore('state', { keyPath: 'key' });
        }
        // Digits store
        if (!db.objectStoreNames.contains('digits')) {
          const digits = db.createObjectStore('digits', { keyPath: 'id', autoIncrement: true });
          digits.createIndex('time', 'time', { unique: false });
          digits.createIndex('symbol', 'symbol', { unique: false });
        }
        // Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = (e) => { this.db = e.target.result; resolve(this); };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  // ── GENERIC ──
  async put(store, data) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(data);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async get(store, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(store, indexName, query, limit) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readonly');
      const os = tx.objectStore(store);
      const source = indexName ? os.index(indexName) : os;
      const req = limit ? source.getAll(query, limit) : source.getAll(query);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(store, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async clear(store) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async count(store) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readonly');
      const req = tx.objectStore(store).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // ── TRADES ──
  async saveTrade(trade) {
    return this.put('trades', { ...trade, time: trade.time || Date.now() });
  }

  async getTrades(limit = 200) {
    const all = await this.getAll('trades');
    return all.sort((a, b) => b.time - a.time).slice(0, limit);
  }

  async getTradesByType(type) {
    return this.getAll('trades', 'type', type);
  }

  async getTradeStats() {
    const trades = await this.getAll('trades');
    const wins = trades.filter(t => t.win);
    const losses = trades.filter(t => !t.win);
    const totalPnL = trades.reduce((s, t) => s + (t.profit || 0), 0);
    const grossWin = wins.reduce((s, t) => s + (t.profit || 0), 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.profit || 0), 0));
    return {
      total: trades.length, wins: wins.length, losses: losses.length,
      winRate: trades.length ? (wins.length / trades.length * 100).toFixed(2) : 0,
      totalPnL: totalPnL.toFixed(2),
      profitFactor: grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : '∞',
      avgWin: wins.length ? (grossWin / wins.length).toFixed(2) : 0,
      avgLoss: losses.length ? (grossLoss / losses.length).toFixed(2) : 0,
    };
  }

  // ── LOGS ──
  async saveLog(log) {
    return this.put('logs', { ...log, time: log.time || Date.now() });
  }

  async getLogs(limit = 500) {
    const all = await this.getAll('logs');
    return all.sort((a, b) => b.time - a.time).slice(0, limit);
  }

  // ── STATE ──
  async saveState(key, value) {
    return this.put('state', { key, value, updated: Date.now() });
  }

  async loadState(key) {
    const rec = await this.get('state', key);
    return rec?.value;
  }

  // ── DIGITS ──
  async saveDigits(symbol, digits) {
    return this.put('digits', { symbol, digits, time: Date.now() });
  }

  async loadDigits(symbol) {
    const all = await this.getAll('digits', 'symbol', symbol);
    return all.sort((a, b) => b.time - a.time)[0]?.digits || [];
  }

  // ── SESSION ──
  async saveSession(session) {
    return this.put('sessions', { ...session, endTime: Date.now() });
  }

  // ── EXPORT ──
  async exportCSV() {
    const trades = await this.getTrades(10000);
    const headers = ['ID', 'Time', 'Type', 'Stake', 'Profit', 'Win', 'Martingale Depth', 'Strategy', 'AI Confidence'];
    const rows = trades.map(t => [
      t.id, new Date(t.time).toISOString(), t.type, t.stake,
      t.profit, t.win ? 'WIN' : 'LOSS', t.martDepth || 0, t.strategy || 'EvOdDirectional', t.aiConf || 0
    ]);
    return [headers, ...rows].map(r => r.join(',')).join('\n');
  }

  // ── MAINTENANCE ──
  async pruneOldLogs(maxAge = 7 * 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - maxAge;
    const all = await this.getAll('logs');
    const old = all.filter(l => l.time < cutoff);
    for (const l of old) await this.delete('logs', l.id);
    return old.length;
  }

  async pruneOldTrades(keep = 5000) {
    const all = await this.getAll('trades');
    if (all.length <= keep) return 0;
    const sorted = all.sort((a, b) => b.time - a.time);
    const toDelete = sorted.slice(keep);
    for (const t of toDelete) await this.delete('trades', t.id);
    return toDelete.length;
  }
}
