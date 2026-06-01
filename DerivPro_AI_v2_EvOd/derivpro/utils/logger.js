// utils/logger.js — DerivPro AI | Logging System
'use strict';

export class Logger {
  constructor(maxEntries = 5000) {
    this._entries   = [];
    this._maxEntries = maxEntries;
    this._listeners = {};
    this._db        = null;
  }

  setDB(db) { this._db = db; }

  _log(type, message, tag = 'INFO', category = 'system') {
    const entry = { id: Date.now() + Math.random(), time: Date.now(), type, message, tag, category };
    this._entries.push(entry);
    if (this._entries.length > this._maxEntries) this._entries.shift();
    this._emit('entry', entry);
    this._emit(type, entry);
    if (this._db) { try { this._db.saveLog(entry); } catch {} }
    return entry;
  }

  info(message, tag = 'INFO')    { return this._log('info',   message, tag, this._catFromTag(tag)); }
  warn(message, tag = 'WARN')    { return this._log('warn',   message, tag, this._catFromTag(tag)); }
  error(message, tag = 'ERROR')  { return this._log('error',  message, tag, this._catFromTag(tag)); }
  trade(message, type = 'info')  { return this._log(type,    message, type === 'win' ? 'WIN' : type === 'loss' ? 'LOSS' : 'TRADE', 'trade'); }
  ai(message)                    { return this._log('ai',     message, 'AI', 'ai'); }
  system(message)                { return this._log('info',   message, 'SYS', 'system'); }

  _catFromTag(tag) {
    const t = tag.toUpperCase();
    if (['WIN','LOSS','TRADE'].includes(t)) return 'trade';
    if (t === 'AI') return 'ai';
    if (['SYS','SYSTEM','WS'].includes(t)) return 'system';
    return 'system';
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this._listeners[event]) this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(cb => { try { cb(data); } catch {} });
  }

  getAll(category) {
    return category ? this._entries.filter(e => e.category === category) : [...this._entries];
  }

  getRecent(n = 100) { return this._entries.slice(-n).reverse(); }

  exportCSV() {
    const headers = ['Time', 'Type', 'Tag', 'Category', 'Message'];
    const rows = this._entries.map(e => [new Date(e.time).toISOString(), e.type, e.tag, e.category, `"${e.message.replace(/"/g, '""')}"`]);
    return [headers, ...rows].map(r => r.join(',')).join('\n');
  }

  clear() { this._entries = []; }
  count() { return this._entries.length; }
}
