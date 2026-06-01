// core/websocket.js — DerivPro AI | Enterprise WebSocket Engine
'use strict';

export class DerivWebSocket {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.authorized = false;
    this.listeners = {};
    this.queue = [];
    this.pingInterval = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 2000;
    this.maxReconnectDelay = 30000;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 99;
    this.pingTimeout = null;
    this.lastPing = null;
    this.latency = 0;
    this.token = null;
    this._destroyed = false;
  }

  connect() {
    if (this._destroyed) return;
    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen    = () => this._onOpen();
      this.ws.onmessage = (e) => this._onMessage(e);
      this.ws.onclose   = (e) => this._onClose(e);
      this.ws.onerror   = (e) => this._onError(e);
    } catch (err) {
      this._emit('error', { error: { message: `Connection failed: ${err.message}` } });
      this._scheduleReconnect();
    }
  }

  _onOpen() {
    this.connected = true;
    this.reconnectAttempts = 0;
    this.reconnectDelay = 2000;
    this._emit('open', {});
    this._flushQueue();
    this._startPing();
  }

  _onMessage(event) {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    const type = data.msg_type;
    if (!type) return;

    // Pong / latency
    if (type === 'ping') {
      this.latency = Date.now() - (this.lastPing || Date.now());
      this._emit('ping', { latency: this.latency });
      clearTimeout(this.pingTimeout);
      return;
    }
    if (data.error) { this._emit('error', data); }

    // Route messages
    switch (type) {
      case 'authorize':        this.authorized = true; this.token = data.authorize?.loginid; this._emit('authorized', data); break;
      case 'tick':             this._emit('tick', data); break;
      case 'history':          this._emit('history', data); break;
      case 'candles':          this._emit('candles', data); break;
      case 'ohlc':             this._emit('ohlc', data); break;
      case 'buy':              this._emit('buy', data); break;
      case 'sell':             this._emit('sell', data); break;
      case 'proposal':         this._emit('proposal', data); break;
      case 'proposal_open_contract': this._emit('sold_contract', data); break;
      case 'balance':          this._emit('balance', data); break;
      case 'portfolio':        this._emit('portfolio', data); break;
      case 'profit_table':     this._emit('profit_table', data); break;
      case 'statement':        this._emit('statement', data); break;
      case 'asset_index':      this._emit('asset_index', data); break;
      case 'active_symbols':   this._emit('active_symbols', data); break;
      case 'forget':           this._emit('forget', data); break;
      case 'forget_all':       this._emit('forget_all', data); break;
      case 'contracts_for':    this._emit('contracts_for', data); break;
      default:                 this._emit(type, data); break;
    }
    this._emit('message', data);
  }

  _onClose(event) {
    this.connected = false;
    this.authorized = false;
    this._stopPing();
    this._emit('close', { code: event.code, reason: event.reason });
    if (!this._destroyed) this._scheduleReconnect();
  }

  _onError(event) {
    this._emit('error', { error: { message: 'WebSocket error', event } });
  }

  _scheduleReconnect() {
    if (this._destroyed || this.reconnectAttempts >= this.maxReconnectAttempts) return;
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(this.reconnectDelay * Math.pow(1.4, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this._emit('reconnecting', { attempt: this.reconnectAttempts, delay });
      this.connect();
    }, delay);
  }

  _startPing() {
    this._stopPing();
    this.pingInterval = setInterval(() => {
      if (this.connected) {
        this.lastPing = Date.now();
        this.send({ ping: 1 });
        this.pingTimeout = setTimeout(() => {
          // No pong in 10s — reconnect
          if (this.ws) { try { this.ws.close(); } catch {} }
        }, 10000);
      }
    }, 30000);
  }

  _stopPing() {
    clearInterval(this.pingInterval);
    clearTimeout(this.pingTimeout);
    this.pingInterval = null;
  }

  _flushQueue() {
    while (this.queue.length) {
      const msg = this.queue.shift();
      this._sendRaw(msg);
    }
  }

  _sendRaw(data) {
    try { this.ws.send(JSON.stringify(data)); } catch (err) {
      this._emit('error', { error: { message: `Send failed: ${err.message}` } });
    }
  }

  send(data) {
    if (this.connected && this.ws?.readyState === WebSocket.OPEN) {
      this._sendRaw(data);
    } else {
      // Queue for after reconnect (max 50 items)
      if (this.queue.length < 50) this.queue.push(data);
    }
  }

  authorize(token) {
    this.send({ authorize: token });
  }

  forget(id) { this.send({ forget: id }); }
  forgetAll(type) { this.send({ forget_all: type }); }

  subscribeTicks(symbol) {
    this.send({ ticks: symbol, subscribe: 1 });
  }

  subscribeBalance() {
    this.send({ balance: 1, subscribe: 1 });
  }

  subscribePortfolio() {
    this.send({ portfolio: 1, subscribe: 1 });
  }

  getTicks(symbol, count = 100) {
    this.send({ ticks_history: symbol, count, end: 'latest', style: 'ticks' });
  }

  getCandles(symbol, granularity = 60, count = 100) {
    this.send({ ticks_history: symbol, count, end: 'latest', style: 'candles', granularity });
  }

  getActiveSymbols() {
    this.send({ active_symbols: 'brief', product_type: 'basic' });
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  _emit(event, data) {
    (this.listeners[event] || []).forEach(cb => { try { cb(data); } catch {} });
  }

  isConnected() { return this.connected && this.ws?.readyState === WebSocket.OPEN; }
  isAuthorized() { return this.authorized; }
  getLatency() { return this.latency; }

  destroy() {
    this._destroyed = true;
    this._stopPing();
    clearTimeout(this.reconnectTimer);
    if (this.ws) { try { this.ws.close(1000, 'Destroyed'); } catch {} }
    this.listeners = {};
    this.queue = [];
  }
}
