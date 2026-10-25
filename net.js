/* =========================================================
 *  net.js  ― ロビーの通信（最大4人）
 *
 *  ホストが「ロビーID（6桁）」でロビーを開き、
 *  ゲストは ロビーID + パスワード で参加します。
 *  パスワードの照合と人数制限はホスト側で行います。
 *
 *  通信方式（Transport）は2種類あり、同じ使い方で切り替えられます。
 *   - PeerTransport : PeerJS（WebRTC）。別の端末どうしでつながる。サーバー不要。
 *   - LocalTransport: BroadcastChannel。同じブラウザのタブどうし（開発・テスト用）。
 *
 *  使い方:
 *    const s = await DS.net.createLobby({ password, stage, profile });
 *    const s = await DS.net.joinLobby({ lobbyId, password, profile });
 *    s.on('state', st => ...)   // メンバーやステージが変わった
 *    s.on('start', st => ...)   // ホストが出撃した
 *    s.on('closed', reason => ...)
 * ========================================================= */
(function () {
  const C = DS.config;
  const NC = C.NET;
  const MAX = C.MAX_PLAYERS;
  const CHANNEL = 'survivors-arena-net-v1';

  const err = (code) => { const e = new Error(code); e.code = code; return e; };
  const randLobbyId = () => String(Math.floor(100000 + Math.random() * 900000));
  const randClientId = () => 'c' + Math.random().toString(36).slice(2, 10);

  /* ---------- 接続ひとつ分の共通ラッパー ---------- */
  class Conn {
    constructor() { this.open = true; this._m = []; this._c = []; }
    onMessage(fn) { this._m.push(fn); }
    onClose(fn) { this._c.push(fn); }
    send(obj) { if (this.open) { try { this._send(obj); } catch (e) { /* 送信失敗は無視 */ } } }
    close() {
      if (!this.open) return;
      try { if (this._close) this._close(); } catch (e) { /* noop */ }
      this._closed();
    }
    _emit(d) { if (this.open) this._m.forEach((f) => f(d)); }
    _closed() {
      if (!this.open) return;
      this.open = false;
      if (this._onEnd) this._onEnd();
      this._c.forEach((f) => f());
    }
  }

  /* =========================================================
   *  LocalTransport（同じブラウザのタブどうし）
   * ========================================================= */
  const LocalTransport = {
    name: 'local',
    label: 'ローカル',
    makeConn(ch, lobby, self, peer, onEnd) {
      const c = new Conn();
      c._send = (data) => ch.postMessage({ k: 'msg', lobby, from: self, to: peer, data });
      c._close = () => ch.postMessage({ k: 'fin', lobby, from: self, to: peer });
      c._onEnd = onEnd;
      return c;
    },
    async host(lobby, onConn) {
      if (typeof BroadcastChannel === 'undefined') throw err('unsupported');
      const ch = new BroadcastChannel(CHANNEL);
      // 同じ ID のロビーが既にあるか確認
      const taken = await new Promise((res) => {
        const h = (e) => { const m = e.data; if (m && m.k === 'here' && m.lobby === lobby) { clearTimeout(t); ch.removeEventListener('message', h); res(true); } };
        const t = setTimeout(() => { ch.removeEventListener('message', h); res(false); }, 250);
        ch.addEventListener('message', h);
        ch.postMessage({ k: 'probe', lobby });
      });
      if (taken) { ch.close(); throw err('idtaken'); }

      const conns = new Map();
      ch.onmessage = (e) => {
        const m = e.data;
        if (!m || m.lobby !== lobby) return;
        if (m.k === 'probe') ch.postMessage({ k: 'here', lobby });
        else if (m.k === 'syn' && !conns.has(m.from)) {
          const c = LocalTransport.makeConn(ch, lobby, 'host', m.from, () => conns.delete(m.from));
          conns.set(m.from, c);
          ch.postMessage({ k: 'ack', lobby, to: m.from });
          onConn(c);
        } else if (m.to === 'host') {
          const c = conns.get(m.from);
          if (!c) return;
          if (m.k === 'msg') c._emit(m.data);
          else if (m.k === 'fin') c._closed();
        }
      };
      return { close() { [...conns.values()].forEach((c) => c.close()); ch.close(); } };
    },
    connect(lobby) {
      if (typeof BroadcastChannel === 'undefined') return Promise.reject(err('unsupported'));
      const ch = new BroadcastChannel(CHANNEL);
      const me = randClientId();
      return new Promise((res, rej) => {
        let conn = null;
        const t = setTimeout(() => { ch.close(); rej(err('notfound')); }, 1500);
        ch.onmessage = (e) => {
          const m = e.data;
          if (!m || m.lobby !== lobby) return;
          if (m.k === 'ack' && m.to === me && !conn) {
            clearTimeout(t);
            conn = LocalTransport.makeConn(ch, lobby, me, 'host', () => ch.close());
            res(conn);
          } else if (conn && m.to === me && m.from === 'host') {
            if (m.k === 'msg') conn._emit(m.data);
            else if (m.k === 'fin') conn._closed();
          }
        };
        ch.postMessage({ k: 'syn', lobby, from: me });
      });
    },
  };

  /* =========================================================
   *  PeerTransport（PeerJS / WebRTC：別端末どうし）
   *  ホストは「ID_PREFIX + ロビーID」という Peer ID で待ち受けます。
   * ========================================================= */
  function getPeerCtor() {
    const P = window.Peer || (window.peerjs && window.peerjs.Peer);
    if (typeof P === 'function') return P;
    if (P && typeof P.Peer === 'function') return P.Peer;
    if (P && typeof P.default === 'function') return P.default;
    return null;
  }
  function loadScript(src, timeout) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      const t = setTimeout(() => { s.remove(); rej(err('timeout')); }, timeout);
      s.onload = () => { clearTimeout(t); res(); };
      s.onerror = () => { clearTimeout(t); s.remove(); rej(err('load')); };
      document.head.appendChild(s);
    });
  }
  let peerLoading = null;
  function loadPeerJS() {
    if (getPeerCtor()) return Promise.resolve(getPeerCtor());
    if (!peerLoading) {
      peerLoading = (async () => {
        for (const url of NC.PEERJS_URLS) {
          try { await loadScript(url, 7000); if (getPeerCtor()) return getPeerCtor(); } catch (e) { /* 次の CDN を試す */ }
        }
        throw err('offline');
      })();
      peerLoading.catch(() => { peerLoading = null; });
    }
    return peerLoading;
  }

  function wrapDataConnection(dc, onEnd) {
    const c = new Conn();
    const queue = [];
    c._send = (d) => { if (dc.open) dc.send(d); else queue.push(d); };
    dc.on('open', () => { while (queue.length) dc.send(queue.shift()); });
    dc.on('data', (d) => {
      let m = d;
      if (typeof m === 'string') { try { m = JSON.parse(m); } catch (e) { return; } }
      c._emit(m);
    });
    dc.on('close', () => c._closed());
    dc.on('error', () => c._closed());
    c._close = () => { try { dc.close(); } catch (e) { /* noop */ } };
    c._onEnd = onEnd;
    return c;
  }

  const PeerTransport = {
    name: 'online',
    label: 'オンライン',
    host(lobby, onConn) {
      const Peer = getPeerCtor();
      return new Promise((res, rej) => {
        const peer = new Peer(NC.ID_PREFIX + lobby, Object.assign({ debug: 0 }, NC.PEER_OPTIONS));
        let opened = false;
        const kill = () => { try { peer.destroy(); } catch (e) { /* noop */ } };
        const t = setTimeout(() => { if (!opened) { kill(); rej(err('server')); } }, 12000);
        peer.on('open', () => {
          opened = true; clearTimeout(t);
          res({ close: kill });
        });
        peer.on('connection', (dc) => onConn(wrapDataConnection(dc)));
        // シグナリングサーバーから切れても、既存の接続は生きているので再接続を試みる
        peer.on('disconnected', () => {
          setTimeout(() => { try { if (!peer.destroyed && peer.disconnected) peer.reconnect(); } catch (e) { /* noop */ } }, 1500);
        });
        peer.on('error', (e) => {
          if (opened) return;
          clearTimeout(t); kill();
          rej(err(e && e.type === 'unavailable-id' ? 'idtaken' : e && e.type === 'browser-incompatible' ? 'unsupported' : 'server'));
        });
      });
    },
    connect(lobby) {
      const Peer = getPeerCtor();
      return new Promise((res, rej) => {
        const peer = new Peer(Object.assign({ debug: 0 }, NC.PEER_OPTIONS));
        let done = false;
        const kill = () => { try { peer.destroy(); } catch (e) { /* noop */ } };
        const fail = (code) => { if (done) return; done = true; clearTimeout(t); kill(); rej(err(code)); };
        const t = setTimeout(() => fail('timeout'), 15000);
        peer.on('error', (e) => fail(e && e.type === 'peer-unavailable' ? 'notfound'
          : e && e.type === 'browser-incompatible' ? 'unsupported' : 'server'));
        peer.on('open', () => {
          const dc = peer.connect(NC.ID_PREFIX + lobby, { reliable: true, serialization: 'json' });
          dc.on('open', () => {
            if (done) return;
            done = true; clearTimeout(t);
            res(wrapDataConnection(dc, kill));
          });
          dc.on('error', () => fail('server'));
        });
      });
    },
  };

  /* ---------- 通信方式の決定 ---------- */
  function requestedMode() {
    const q = new URLSearchParams(location.search).get('net');
    return ['local', 'online', 'auto'].includes(q) ? q : NC.MODE;
  }
  let fellBack = false;
  async function resolveTransport() {
    const mode = requestedMode();
    if (mode === 'local') return LocalTransport;
    try {
      await loadPeerJS();
      return PeerTransport;
    } catch (e) {
      if (mode === 'online') throw err('offline');
      fellBack = true;
      return LocalTransport;
    }
  }

  /* =========================================================
   *  ロビーのセッション（ホスト / ゲスト共通）
   * ========================================================= */
  function cleanProfile(p) {
    p = p || {};
    const w = p.weapon && C.ITEMS[p.weapon] && C.ITEMS[p.weapon].slot === 'weapon' ? p.weapon : 'kunai';
    const r = DS.state.RARITY[p.weaponRarity] ? p.weaponRarity : 'common';
    const okItem = (k, slot) => (k && C.ITEMS[k] && C.ITEMS[k].slot === slot ? k : null);
    // 装備（アイテム名:レアリティ）。パッシブの判定に使う
    const gear = {};
    C.SLOTS.forEach(({ key }) => {
      const [it, rr] = String((p.gear && p.gear[key]) || '').split(':');
      gear[key] = C.ITEMS[it] && C.ITEMS[it].slot === key && DS.state.RARITY[rr] ? it + ':' + rr : null;
    });
    return {
      name: String(p.name || 'ゲスト').slice(0, 10),
      atk: Math.max(0, Math.min(1e13, Number(p.atk) || 0)),
      hp: Math.max(0, Math.min(1e13, Number(p.hp) || 0)),
      gear,
      spd: Math.max(10, Math.min(300, Number(p.spd) || 100)),
      weapon: w, weaponRarity: r,
      weaponLv: Math.max(0, Math.min(C.FUSION.max, p.weaponLv | 0)),
      belt: okItem(p.belt, 'belt'), boots: okItem(p.boots, 'boots'),
      char: p.char && C.CHARACTERS[p.char] ? p.char : '',
      look: p.look && C.CHARACTERS[p.look] ? p.look : '',
    };
  }

  /** ミニゲームの設定（ゲームの種類と制限時間）を正しい値にする */
  function cleanMg(mg) {
    const list = C.MINIGAMES.list;
    const def = list.find((g) => g.key === (mg && mg.game)) || list[0];
    const t = mg && +mg.time;
    return { game: def.key, time: def.times ? (def.times.includes(t) ? t : def.time) : 0 };
  }

  class Session {
    constructor(role, transport) {
      this.role = role;
      this.transport = transport;
      this.handlers = {};
      this.state = null;
      this.selfId = null;
      this.ended = false;
      this.password = '';
      this.conns = new Map();      // host: memberId -> Conn
      this.lastSeen = new Map();   // host: memberId -> time
      this._seq = 0;
      this._timer = null;
    }
    get isHost() { return this.role === 'host'; }
    get me() { return this.state && this.state.members.find((m) => m.id === this.selfId); }
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; }
    off(ev, fn) { this.handlers[ev] = (this.handlers[ev] || []).filter((f) => f !== fn); return this; }
    /** ゲーム中のデータ送信。ホストは to を省略すると全員へ。ゲストはホストへ */
    sendGame(data, to) {
      if (this.ended) return;
      const msg = { t: 'g', d: data };
      if (this.isHost) {
        if (to) { const c = this.conns.get(to); if (c) c.send(msg); }
        else this.conns.forEach((c) => c.send(msg));
      } else if (this.conn) this.conn.send(msg);
    }
    emit(ev, ...a) { (this.handlers[ev] || []).forEach((f) => { try { f(...a); } catch (e) { console.error(e); } }); }

    /* ----- ホスト ----- */
    _onConn(conn) {
      conn.onMessage((m) => {
        if (!m || typeof m !== 'object' || this.ended) return;
        if (m.t === 'join') return this._onJoin(conn, m);
        const id = conn.memberId;
        if (!id) return;
        this.lastSeen.set(id, Date.now());
        const mem = this.state.members.find((x) => x.id === id);
        if (!mem) return;
        if (m.t === 'g') this.emit('game', id, m.d);
        else if (m.t === 'ready') { mem.ready = !!m.v; this._sync(); }
        else if (m.t === 'leave') this._remove(id, 'leave');
      });
      conn.onClose(() => { if (conn.memberId) this._remove(conn.memberId, 'disconnect'); });
    }
    _onJoin(conn, m) {
      const reject = (reason) => { conn.send({ t: 'reject', reason }); setTimeout(() => conn.close(), 400); };
      if (conn.memberId) return;
      if (String(m.password || '') !== this.password) return reject('password');
      if (this.state.status !== 'waiting') return reject('started');
      if (this.state.members.length >= MAX) return reject('full');
      const used = this.state.members.map((x) => x.slot);
      const slot = [0, 1, 2, 3].find((i) => !used.includes(i));
      const id = 'p' + (++this._seq) + Math.random().toString(36).slice(2, 5);
      conn.memberId = id;
      this.conns.set(id, conn);
      this.lastSeen.set(id, Date.now());
      const mem = Object.assign({ id, slot, isHost: false, ready: false }, cleanProfile(m.profile));
      this.state.members.push(mem);
      this.state.members.sort((a, b) => a.slot - b.slot);
      conn.send({ t: 'welcome', you: id, state: this.state });
      this._sync();
      this.emit('joined', mem);
    }
    _remove(id, reason) {
      const mem = this.state.members.find((x) => x.id === id);
      const conn = this.conns.get(id);
      this.conns.delete(id);
      this.lastSeen.delete(id);
      if (conn) conn.close();
      if (!mem) return;
      this.state.members = this.state.members.filter((x) => x.id !== id);
      this._sync();
      this.emit('left', mem, reason);
    }
    _sync(extra) {
      const msg = Object.assign({ t: 'state', state: this.state }, extra);
      this.conns.forEach((c) => c.send(msg));
      this.emit('state', this.state);
    }
    setStage(index) {
      if (!this.isHost || this.state.status !== 'waiting') return;
      // ホストが遊べるステージの中だけで選べる（ゲストはどこでも参加できる）
      const n = Math.max(1, Math.min(C.STAGES.length, (this.state.maxStage != null ? this.state.maxStage : C.STAGES.length - 1) + 1));
      this.state.stage = ((index % n) + n) % n;
      this.state.members.forEach((x) => { if (!x.isHost) x.ready = false; });
      this._sync();
    }
    /** ミニゲームのロビー：ゲームと制限時間を変える（ホストのみ） */
    setMinigame(game, time) {
      if (!this.isHost || this.state.status !== 'waiting' || this.state.mode !== 'mini') return;
      const cur = this.state.mg || {};
      this.state.mg = cleanMg({ game: game || cur.game, time: time != null ? time : (game && game !== cur.game ? null : cur.time) });
      this.state.members.forEach((x) => { if (!x.isHost) x.ready = false; });
      this._sync();
    }
    canStart() {
      if (!this.isHost || this.state.status !== 'waiting') return false;
      if (this.state.mode === 'mini' && this.state.members.length < C.MINIGAMES.minPlayers) return false;
      return this.state.members.every((x) => x.isHost || x.ready);
    }
    start() {
      if (!this.canStart()) return false;
      this.state.status = 'playing';
      this.conns.forEach((c) => c.send({ t: 'start', state: this.state }));
      this.emit('state', this.state);
      this.emit('start', this.state);
      return true;
    }
    /** ゲーム終了後、ロビーに戻る（ホストのみ） */
    endGame() {
      if (!this.isHost) return;
      this.state.status = 'waiting';
      this.state.members.forEach((x) => { if (!x.isHost) x.ready = false; });
      this._sync();
    }

    /* ----- ゲスト ----- */
    setReady(v) {
      if (this.isHost || !this.conn) return;
      this.conn.send({ t: 'ready', v: !!v });
    }

    /* ----- 共通 ----- */
    _startHeartbeat() {
      this._timer = setInterval(() => {
        const now = Date.now();
        if (this.isHost) {
          this.conns.forEach((c) => c.send({ t: 'ping' }));
          this.lastSeen.forEach((tm, id) => { if (now - tm > NC.TIMEOUT_MS) this._remove(id, 'timeout'); });
        } else {
          this.conn.send({ t: 'ping' });
          if (now - this.lastHost > NC.TIMEOUT_MS) this._end('disconnect');
        }
      }, NC.HEARTBEAT_MS);
    }
    leave() {
      if (this.ended) return;
      if (this.isHost) {
        this.conns.forEach((c) => c.send({ t: 'closed', reason: 'host-left' }));
      } else if (this.conn) {
        this.conn.send({ t: 'leave' });
      }
      // 送信が届くよう少し待ってから切断
      const conns = [...this.conns.values()], conn = this.conn, ep = this.endpoint;
      setTimeout(() => {
        conns.forEach((c) => c.close());
        if (conn) conn.close();
        if (ep) ep.close();
      }, 150);
      this.ended = true;
      clearInterval(this._timer);
    }
    _end(reason) {
      if (this.ended) return;
      this.ended = true;
      clearInterval(this._timer);
      this.conns.forEach((c) => c.close());
      if (this.conn) this.conn.close();
      if (this.endpoint) this.endpoint.close();
      this.emit('closed', reason);
    }
  }

  async function createLobby({ password, stage = 0, profile, maxStage, mode, mg }) {
    const T = await resolveTransport();
    const s = new Session('host', T);
    let lobbyId;
    for (let i = 0; i < 6; i++) {
      lobbyId = randLobbyId();
      try { s.endpoint = await T.host(lobbyId, (c) => s._onConn(c)); break; }
      catch (e) { if (e.code !== 'idtaken' || i === 5) throw e; }
    }
    s.password = String(password || '');
    s.selfId = 'host';
    s.state = {
      lobbyId, transport: T.name, stage, status: 'waiting', maxStage: maxStage != null ? maxStage : C.STAGES.length - 1,
      mode: mode === 'mini' ? 'mini' : 'battle', mg: mode === 'mini' ? cleanMg(mg) : null,
      members: [Object.assign({ id: 'host', slot: 0, isHost: true, ready: true }, cleanProfile(profile))],
    };
    s._startHeartbeat();
    return s;
  }

  async function joinLobby({ lobbyId, password, profile }) {
    lobbyId = String(lobbyId || '').replace(/\D/g, '');
    if (lobbyId.length !== 6) throw err('badid');
    const T = await resolveTransport();
    const conn = await T.connect(lobbyId);
    const s = new Session('guest', T);
    s.conn = conn;
    s.password = String(password || '');
    return new Promise((res, rej) => {
      let welcomed = false;
      const t = setTimeout(() => { if (!welcomed) { conn.close(); rej(err('timeout')); } }, 10000);
      conn.onMessage((m) => {
        if (!m || typeof m !== 'object') return;
        s.lastHost = Date.now();
        if (!welcomed) {
          if (m.t === 'welcome') {
            welcomed = true; clearTimeout(t);
            s.selfId = m.you; s.state = m.state;
            s._startHeartbeat();
            res(s);
          } else if (m.t === 'reject') {
            clearTimeout(t); welcomed = true; conn.close(); rej(err(m.reason));
          }
          return;
        }
        if (s.ended) return;
        if (m.t === 'g') s.emit('game', 'host', m.d);
        else if (m.t === 'state') { s.state = m.state; s.emit('state', s.state); }
        else if (m.t === 'start') { s.state = m.state; s.emit('state', s.state); s.emit('start', s.state); }
        else if (m.t === 'closed') s._end(m.reason || 'host-left');
      });
      conn.onClose(() => {
        if (!welcomed) { clearTimeout(t); welcomed = true; rej(err('closed')); }
        else s._end('disconnect');
      });
      conn.send({ t: 'join', password: s.password, profile });
    });
  }

  const MESSAGES = {
    badid: 'ロビーIDは6桁の数字で入力してください。',
    notfound: 'ロビーが見つかりません。IDを確認してください。',
    password: 'パスワードが違います。',
    full: 'ロビーが満員です（最大4人）。',
    started: 'このロビーはすでに出撃中（ミニゲーム中）です。',
    offline: 'オンライン通信を読み込めませんでした。通信環境を確認してください。',
    server: '通信サーバーに接続できませんでした。時間をおいて試してください。',
    timeout: '接続がタイムアウトしました。',
    unsupported: 'このブラウザは通信機能に対応していません。',
    closed: '接続が切れました。',
    'host-left': 'ホストがロビーを解散しました。',
    disconnect: 'ホストとの接続が切れました。',
  };

  DS.net = {
    createLobby, joinLobby, cleanMg,
    message: (code) => MESSAGES[code] || '通信エラーが発生しました。',
    get fellBackToLocal() { return fellBack; },
    _transports: { LocalTransport, PeerTransport },
  };
})();
