// net.js – multiplayer až pro 4 hráče přes PeerJS (peer-to-peer; veřejný server jen spáruje hráče podle kódu)
// Hvězda: hostitel drží spojení se všemi a přeposílá zprávy. Každý hráč má vlastní loot – posílá se jen poloha a postup.
const RACE_KM = 10, MAX_PLAYERS = 4;
const SLOT_COL = ['#ffcf86', '#ff8a6a', '#8fe38a', '#8ac8ff'];
const SLOT_PAINT = [0x4f7f86, 0xb04030, 0x3a7a3a, 0x6a4a9a];
// Záložní spojení přes náš server (WebSocket) – stejné rozhraní jako PeerJS DataConnection (on/send/close/open)
class RelayConn {
  constructor(send, close) { this.h = {}; this.open = false; this.relay = true; this._send = send; this._close = close; this._closed = false; }
  on(ev, fn) { (this.h[ev] = this.h[ev] || []).push(fn); return this; }
  emit(ev, a) { for (const f of this.h[ev] || []) try { f(a); } catch (e) { console.error(e); } }
  send(d) { if (this.open) this._send(d); }
  up() { if (this._closed || this.open) return; this.open = true; this.emit('open'); }
  down() { if (this._closed) return; this._closed = true; const was = this.open; this.open = false; if (was) this.emit('close'); }
  close() { if (this._closed) return; this._close(); this.down(); }
}
const Net = {
  active: false, isHost: false, peer: null, conn: null, conns: [], code: '', slot: 0, players: {}, mode: 'desert',
  sendT: 0, raceOver: false, inRace: false, ui: () => {}, onLobby: () => {},
  loadLib() {
    return new Promise((res, rej) => {
      if (window.Peer) return res();
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js';
      s.integrity = 'sha384-nlUQ8ZqCbvStErob+biJNzSgltf6urV3VGqhfIfzhmg9RXmpeRm76ELw0pYnKlTR'; s.crossOrigin = 'anonymous';   // podvržená knihovna se nespustí
      s.onload = () => res(); s.onerror = () => rej(new Error('Knihovnu PeerJS se nepodařilo načíst (jsi online?)'));
      document.head.appendChild(s);
    });
  },
  // STUN/TURN servery: server je zná z nastavení hostingu (TURN = záložní přenos, když přímé spojení nejde)
  async ice() {
    if (this._ice && performance.now() - this._iceT < 12e5) return this._ice;   // TURN údaje platí jen pár hodin
    let list = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
    try {
      const ac = new AbortController(), tm = setTimeout(() => ac.abort(), 4000);
      const r = await fetch('/api/ice', { signal: ac.signal }); clearTimeout(tm);
      if (r.ok) { const d = await r.json(); if (Array.isArray(d.iceServers) && d.iceServers.length) list = d.iceServers; }
    } catch (e) { /* jen STUN */ }
    this.hasTurn = list.some(s => [].concat(s.urls).some(u => /^turns?:/.test(u)));
    this._iceT = performance.now();
    return (this._ice = list);
  },
  peerOpt(ice) { return { config: { iceServers: ice }, debug: 0 }; },
  canRelay() { return /^https?:$/.test(location.protocol) && 'WebSocket' in window; },
  wsUrl(role, code) { return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws?room=' + encodeURIComponent(code) + '&role=' + role; },
  wsSend(ws, o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); },
  wsPing(ws) { const iv = setInterval(() => { if (ws.readyState > 1) clearInterval(iv); else this.wsSend(ws, { t: 'p' }); }, 15000); },
  showCode() { this.ui(`Kód lobby: <b style="font-size:26px;color:#ffcf86">${this.code}</b> – pošli ho kámošům (max ${MAX_PLAYERS} hráči).`); this.onLobby(); },
  // hostitel: místnost i na serveru, aby se šlo připojit, i když přímé spojení nejde
  hostRelay() {
    if (!this.canRelay()) return;
    let ws; try { ws = new WebSocket(this.wsUrl('host', this.code)); } catch (e) { return; }
    this.hws = ws; const map = {};
    ws.onopen = () => this.wsPing(ws);
    ws.onmessage = (ev) => {
      if (this.hws !== ws) return;
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m || typeof m !== 'object') return;
      if (m.t === 'h') { if (!this.relayOk) { this.relayOk = true; if (!this.peerOk) this.showCode(); } }
      else if (m.t === 'j' && Number.isInteger(m.c)) {
        const id = m.c, c = new RelayConn((d) => this.wsSend(ws, { c: id, d }), () => this.wsSend(ws, { t: 'k', c: id }));
        map[id] = c; this.accept(c); setTimeout(() => c.up(), 0);
      } else if (m.t === 'm') { const c = map[m.c]; if (c && c.open) c.emit('data', m.d); }
      else if (m.t === 'l') { const c = map[m.c]; delete map[m.c]; if (c) c.down(); }
    };
    ws.onclose = () => { for (const k in map) map[k].down(); if (this.hws === ws) this.hws = null; };
  },
  // hráč: spojení přes server (když přímé nejde)
  joinRelay(code) {
    let ws; try { ws = new WebSocket(this.wsUrl('join', code)); } catch (e) { return this.joinFail(); }
    this.cws = ws;
    const c = new RelayConn((d) => this.wsSend(ws, { d }), () => { try { ws.close(); } catch (e) { /* nic */ } });
    ws.onopen = () => this.wsPing(ws);
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (!m || typeof m !== 'object') return;
      if (m.t === 'o') c.up();
      else if (m.t === 'x') { if (this.conn === c) { this.conn = null; c._closed = true; this.joinFail('Lobby s tímhle kódem neexistuje, nebo je plné / právě hraje.'); } }
      else if ('d' in m) { if (c.open) c.emit('data', m.d); }
    };
    ws.onerror = () => { if (this.conn === c && !c.open) { this.conn = null; c._closed = true; this.joinFail(); } };
    ws.onclose = () => c.down();
    this.conn = c; this.bindJoin(c);
  },
  joinFail(msg) {
    clearTimeout(this._joinT); clearTimeout(this._relayT);
    this.reset(); this.players = {}; this.onLobby();
    this.ui(msg || 'Spojení s hostitelem se nepodařilo navázat. Zkontrolujte kód a zkuste to znovu.', 'bad');
  },
  bindJoin(c) {
    c.on('open', () => {
      if (this.conn !== c) { try { c.close(); } catch (e) { /* nic */ } return; }
      clearTimeout(this._joinT); clearTimeout(this._relayT);
      this.send({ t: 'hi', nick: Game.nick() }); this.ui('Připojeno' + (c.relay ? ' (přes server)' : '') + '! Čeká se, až hostitel spustí hru…', 'good');
    });
    c.on('data', (d) => { if (this.conn !== c) return; d = this.clean(d); if (d) this.onData(d); });
    c.on('close', () => {
      if (this.conn !== c) return;
      this.conn = null;
      if (this.inRace && !this.raceOver) { Game.msg('Hostitel se odpojil – hra skončila', 'bad'); this.hostGone(); }
      else this.ui('Hostitel lobby zavřel.', 'bad');
      this.players = {}; this.onLobby();
    });
  },
  // kolik dat jde přes záložní TURN server → server hlídá měsíční limit zdarma
  turnWatch() {
    if (this._tw) return;
    this._tw = setInterval(async () => {
      if (!this.hasTurn || !this.peer) return;
      const pcs = (this.isHost ? this.conns : [this.conn]).filter(c => c && c.peerConnection).map(c => c.peerConnection);
      let add = 0;
      for (const pc of pcs) {
        try {
          const st = await pc.getStats(); let pair = null; const loc = {};
          st.forEach(r => { if (r.type === 'local-candidate') loc[r.id] = r.candidateType; });
          st.forEach(r => { if (r.type === 'transport' && r.selectedCandidatePairId) pair = st.get(r.selectedCandidatePairId); });
          if (!pair) st.forEach(r => { if (r.type === 'candidate-pair' && (r.selected || r.nominated && r.state === 'succeeded')) pair = r; });
          if (!pair || loc[pair.localCandidateId] !== 'relay') continue;
          const tot = (pair.bytesSent || 0) + (pair.bytesReceived || 0), prev = pc._pjTurn || 0;
          pc._pjTurn = tot; add += Math.max(0, tot - prev);
        } catch (e) { /* nic */ }
      }
      if (add > 0) fetch('/api/turnuse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ b: add }) }).catch(() => {});
    }, 60000);
  },
  errText(e) {
    return { 'peer-unavailable': 'Lobby s tímhle kódem neexistuje (nebo ho hostitel zavřel)', 'unavailable-id': 'Kód je obsazený, zkus to znovu', network: 'Chyba sítě – jsi online?', 'server-error': 'Párovací server neodpovídá, zkus to za chvíli' }[e.type] || ('Chyba spojení: ' + e.type);
  },
  // zprávy od ostatních hráčů jsou nedůvěryhodné: texty bez HTML znaků a s limitem délky, žádné prototypové klíče,
  // omezená hloubka/velikost → nikdo nemůže přes nick či jinou zprávu podstrčit kód do stránky ostatních
  HOST_ONLY: new Set(['welcome', 'full', 'lobby', 'left', 'start']),
  clean(v, dep = 0) {
    if (typeof v === 'string') return v.replace(/[<>&"'`\\]/g, '').slice(0, 120);
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'boolean' || v === null) return v;
    if (dep > 5 || typeof v !== 'object') return undefined;
    if (Array.isArray(v)) return v.slice(0, 128).map(x => this.clean(x, dep + 1));
    const o = {}; let n = 0;
    for (const k of Object.keys(v)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype' || ++n > 80) continue;
      const x = this.clean(v[k], dep + 1); if (x !== undefined) o[k] = x;
    }
    return o;
  },
  connected() { return this.isHost ? !!(this.peer || this.hws) : !!(this.conn && this.conn.open); },
  others() { return Object.values(this.players).filter(p => p.slot !== this.slot).sort((a, b) => a.slot - b.slot); },
  list() { return Object.values(this.players).sort((a, b) => a.slot - b.slot).map(p => ({ slot: p.slot, nick: p.nick })); },
  nickOf(slot) { const p = this.players[slot]; return p ? p.nick : 'Hráč ' + (slot + 1); },

  async host() {
    let lib = true; try { await this.loadLib(); } catch (e) { lib = false; if (!this.canRelay()) return this.ui(e.message, 'bad'); }
    const ice = lib ? await this.ice() : null;
    this.reset(); this.isHost = true; this.slot = 0; this.peerOk = this.relayOk = false;
    this.code = String(1000 + Math.floor(Math.random() * 9000));
    this.players = { 0: { slot: 0, nick: Game.nick() } };
    this.ui('Zakládám lobby…');
    this.hostRelay();
    if (lib) {
      const peer = this.peer = new Peer('pouste-jizda-' + this.code, this.peerOpt(ice)); this.turnWatch();
      peer.on('open', () => { if (!this.peerOk && !this.relayOk) this.showCode(); this.peerOk = true; });
      peer.on('connection', (c) => this.accept(c));
      // bez párovacího serveru PeerJS to pořád jede přes náš server – chybu ukázat jen když nefunguje ani to
      peer.on('error', (e) => { if (this.peer === peer && !this.relayOk) this.ui(this.errText(e), 'bad'); });
    }
    this.onLobby();
  },
  accept(c) {
    const used = new Set(Object.keys(this.players).map(Number));
    if (used.size >= MAX_PLAYERS || this.inRace) {
      c.on('open', () => { c.send({ t: 'full', inRace: this.inRace }); setTimeout(() => c.close(), 400); });
      return;
    }
    let slot = -1; this.conns.push(c);
    // když se spojení do 20 s neotevře (síť nepustí přímé spojení), zahodit ho – žádný „duch“ v lobby
    const dead = setTimeout(() => { if (!c.open) { this.conns = this.conns.filter(x => x !== c); try { c.close(); } catch (e) { /* nic */ } } }, 20000);
    c.on('open', () => {
      clearTimeout(dead);
      if (this.inRace || Object.keys(this.players).length >= MAX_PLAYERS) { c.send({ t: 'full', inRace: this.inRace }); setTimeout(() => c.close(), 400); return; }
      slot = 1; while (this.players[slot]) slot++;   // slot až po otevření – nepovedené pokusy nic neblokují
      c.slot = slot; this.players[slot] = { slot, nick: 'Hráč ' + (slot + 1) };
      c.send({ t: 'welcome', slot, code: this.code }); this.lobbyBroadcast();
    });
    c.on('data', (d) => { d = this.clean(d); if (!d || !d.t || this.HOST_ONLY.has(d.t) || !this.players[slot]) return; d.from = slot; this.relay(d, c); this.onData(d); });
    c.on('close', () => this.dropPeer(slot, c));
    c.on('error', () => this.dropPeer(slot, c));
  },
  async join(code) {
    code = String(code || '').trim();
    if (!/^\d{4}$/.test(code)) return this.ui('Zadej čtyřmístný kód od kámoše', 'bad');
    let lib = true; try { await this.loadLib(); } catch (e) { lib = false; if (!this.canRelay()) return this.ui(e.message, 'bad'); }
    const ice = lib ? await this.ice() : null;
    this.reset(); this.isHost = false; this.code = code;
    this.ui('Připojuju se…');
    clearTimeout(this._joinT); clearTimeout(this._relayT);
    const sess = this._sess = {};
    // přímé spojení nejde do 6 s (nebo PeerJS hlásí chybu) → přes náš server
    const toRelay = () => {
      if (this._sess !== sess || sess.relay || (this.conn && this.conn.open)) return;
      if (!this.canRelay()) return this.joinFail(lib ? undefined : 'Knihovnu PeerJS se nepodařilo načíst.');
      sess.relay = true; clearTimeout(this._relayT);
      const old = this.conn; this.conn = null; if (old) try { old.close(); } catch (e) { /* nic */ }
      if (this.peer) { try { this.peer.destroy(); } catch (e) { /* nic */ } this.peer = null; }
      this.joinRelay(code);
    };
    this._joinT = setTimeout(() => { if (this._sess === sess && !(this.conn && this.conn.open)) this.joinFail(); }, 22000);
    if (!lib) return toRelay();
    this._relayT = setTimeout(toRelay, 6000);
    const peer = this.peer = new Peer(this.peerOpt(ice)); this.turnWatch();
    peer.on('open', () => {
      if (this.peer !== peer) return;
      const c = this.conn = peer.connect('pouste-jizda-' + code, { reliable: true });
      this.bindJoin(c);
    });
    peer.on('error', () => { if (this.peer === peer) toRelay(); });
  },
  leave() { this.reset(); this.players = {}; this.code = ''; this.ui(''); this.onLobby(); },
  reset() {
    for (const c of this.conns) try { c.close(); } catch (e) { /* nic */ }
    if (this.conn) try { this.conn.close(); } catch (e) { /* nic */ }
    if (this.peer) this.peer.destroy();
    for (const w of [this.hws, this.cws]) if (w) try { w.close(); } catch (e) { /* nic */ }
    this.conn = null; this.conns = []; this.peer = null; this.isHost = false; this.slot = 0; this.hws = this.cws = null; this.relayOk = this.peerOk = false; this._sess = null;
  },
  send(o) {
    if (o.ts === undefined) o.ts = Math.round(performance.now()) / 1000;   // čas odesílatele → přesná rychlost u příjemce
    o.from = this.slot;
    if (this.isHost) { for (const c of this.conns) if (c.open) c.send(o); }
    else if (this.conn && this.conn.open) this.conn.send(o);
  },
  relay(d, except) { for (const c of this.conns) if (c !== except && c.open) c.send(d); },
  lobbyBroadcast() { if (!this.isHost) return; this.send({ t: 'lobby', players: this.list(), mode: this.mode }); this.onLobby(); },
  setMode(m) { this.mode = m; this.lobbyBroadcast(); },
  dropPeer(slot, c) {
    this.conns = this.conns.filter(x => x !== c);
    if (!this.players[slot]) return;
    const nick = this.nickOf(slot);
    this.removeRemote(slot); delete this.players[slot];
    this.send({ t: 'left', slot });
    this.lobbyBroadcast();
    this.onLeft(slot, nick);
  },
  onLeft(slot, nick) {
    if (!this.inRace || this.raceOver) return;
    if (String(this.mode).startsWith('drag')) { Drag.netLeft(slot); return; }
    if (String(this.mode).startsWith('rally')) { Rally.netLeft(slot); return; }
    if (String(this.mode).startsWith('air')) { Air.netLeft(slot); return; }
    Game.msg(`${nick} se odpojil`, 'bad');
    if (!this.others().length) Game.raceEnd(this.slot, 'Všichni ostatní se odpojili – vyhráváš.');
  },
  hostGone() {
    if (String(this.mode).startsWith('drag')) { Drag.netLeft(-1); return; }
    if (String(this.mode).startsWith('rally')) { Rally.netLeft(-1); return; }
    if (String(this.mode).startsWith('air')) { Air.netLeft(-1); return; }
    Game.raceEnd(this.slot, 'Hostitel se odpojil.');
  },
  start() {
    if (!this.isHost || !this.others().length) return;
    const seed = Math.floor(Math.random() * 1e6);
    const o = { t: 'start', seed, mode: this.mode, slots: Object.keys(this.players).map(Number).sort() };
    this.send(o); this.onData(Object.assign({}, o, { from: 0 }));
  },
  onData(d) {
    if (!d || !d.t) return;
    const p = this.players[d.from];
    switch (d.t) {
      case 'hi': if (this.isHost && p) { p.nick = String(d.nick || p.nick).replace(/[<>&"]/g, '').slice(0, 16) || p.nick; this.lobbyBroadcast(); } break;
      case 'welcome': this.slot = d.slot; this.code = d.code; break;
      case 'full': this.ui(d.inRace ? 'Lobby právě hraje, zkus to po závodě' : `Lobby je plné (max ${MAX_PLAYERS} hráči)`, 'bad'); break;
      case 'lobby': {
        const keep = this.players; this.players = {};
        for (const q of d.players) this.players[q.slot] = Object.assign(keep[q.slot] || {}, q);
        for (const k of Object.keys(keep)) if (!this.players[k]) this.removeRemote(+k);
        this.mode = d.mode; this.onLobby(); break;
      }
      case 'left': if (this.players[d.slot]) { const n = this.nickOf(d.slot); this.removeRemote(d.slot); delete this.players[d.slot]; this.onLobby(); this.onLeft(d.slot, n); } break;
      case 'start':
        this.mode = d.mode; this.inRace = true; this.raceOver = false; this.active = true;
        for (const pl of Object.values(this.players)) { pl.km = 0; pl.dead = false; }
        if (!String(d.mode).startsWith('air') && typeof Air !== 'undefined' && Air.active) Air.exit();
        if (String(d.mode).startsWith('drag')) { if (Rally.active) Rally.exit(); Drag.startNet(d.seed, d.slots, d.mode === 'dragsb'); } else if (String(d.mode).startsWith('rally')) Rally.startNet(d.seed, d.slots, d.mode); else if (String(d.mode).startsWith('air')) { if (Rally.active) Rally.exit(); if (Drag.active) Drag.exit(); Air.startNet(d.seed, d.slots, d.mode); } else Game.startRace(d.seed);
        break;
      case 's': if (p) {
        if (!p.sm) p.sm = new U.NetSmooth(['cx', 'cy', 'cz', 'cp', 'cr', 'px', 'py', 'pz', 'cyaw', 'pyaw'], ['cyaw', 'pyaw', 'cp', 'cr']);
        if (!p.sm.push(d)) break;
        if (d.co) { p.co = d.co; p.pc = d.pc; }
        p.target = d; p.km = d.km;
      } break;
      case 'dead': if (p && !this.raceOver) { p.dead = true; Game.msg(`${p.nick} umřel (${d.reason}) – minuta penalizace, jeď!`, 'good'); } break;
      case 'win': if (!this.raceOver) Game.raceEnd(d.from, `${this.nickOf(d.from)} dojel do cíle (${RACE_KM} km) jako první.`); break;
      case 'ds': case 'dcar': case 'dfin': Drag.onNet(d); break;
      case 'as': case 'aplane': case 'afin': Air.onNet(d); break;
      case 'rs': case 'rcar': case 'rcall': case 'rhelp': case 'rhit': case 'rpart': case 'rfin': Rally.onNet(d); break;
    }
  },
  // pořadí slotů -> výchozí místa ve stodole a před ní
  spawnFor(slot) {
    const order = Object.keys(this.players).map(Number).sort(), i = Math.max(0, order.indexOf(slot));
    return [[-1.45, 14.5], [1.45, 14.5], [-2.6, 3.5], [2.6, 3.5]][i];
  },

  // ---------- auta a postavy ostatních hráčů ----------
  attach(scene) {
    this.scene = scene;
    for (const p of this.others()) this.makeRemote(p);
  },
  makeRemote(pl) {
    const scene = this.scene;
    const parts = CarModel.build(SLOT_PAINT[pl.slot]); parts.mirrors = [];
    scene.add(parts.root); parts.root.position.set(0, -500, 0);
    const g = new THREE.Group(), cloth = U.mat(SLOT_PAINT[pl.slot]), pants = U.mat(0x3a4a6a), skin = U.mat(0xc68a5e);
    const box = (w, h, d, x, y, z, m, parent) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; (parent || g).add(o); return o; };
    const legs = [], arms = [];
    for (const sd of [-1, 1]) {
      const lp = new THREE.Group(); lp.position.set(sd * 0.12, 0.9, 0); g.add(lp); box(0.16, 0.9, 0.18, 0, -0.45, 0, pants, lp); legs.push(lp);
      const ap = new THREE.Group(); ap.position.set(sd * 0.3, 1.5, 0); g.add(ap); box(0.12, 0.62, 0.14, 0, -0.3, 0, cloth, ap); arms.push(ap);
    }
    box(0.48, 0.62, 0.26, 0, 1.22, 0, cloth); box(0.26, 0.28, 0.26, 0, 1.68, 0, skin);
    box(0.44, 0.05, 0.44, 0, 1.85, 0, U.mat(0x6b4a2a)); box(0.28, 0.14, 0.28, 0, 1.93, 0, U.mat(0x6b4a2a));
    g.userData = { legs, arms, ph: 0 };
    g.visible = false; scene.add(g);
    const tagCv = document.createElement('canvas'); tagCv.width = 256; tagCv.height = 64;
    const tagTex = new THREE.CanvasTexture(tagCv);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, depthTest: false, transparent: true }));
    tag.scale.set(4, 1, 1); tag.renderOrder = 10; scene.add(tag);
    const col = { t: 'b', x: 0, z: -99999, hw: 0.95, hd: 2.2, ry: 0, kind: 'car' };
    World.staticCols.push(col);
    pl.r = { parts, avatar: g, tag, tagCv, tagTex, col, cur: null, _pc: undefined, _co: undefined, tt: 0 };
    pl.target = null; pl.km = pl.km || 0;
    this.drawTag(pl);
  },
  removeRemote(slot) {
    const pl = this.players[slot]; if (!pl || !pl.r) return;
    const r = pl.r, sc = this.scene;
    if (sc) { sc.remove(r.parts.root); sc.remove(r.avatar); sc.remove(r.tag); }
    r.col.z = -99999; pl.r = null;
  },
  drawTag(pl) {
    const r = pl.r, g = r.tagCv.getContext('2d');
    g.clearRect(0, 0, 256, 64);
    g.fillStyle = 'rgba(20,10,5,.75)'; g.fillRect(8, 8, 240, 48);
    g.fillStyle = SLOT_COL[pl.slot]; g.font = 'bold 24px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`${pl.nick} · ${(pl.km || 0).toFixed(2)} km`, 128, 33);
    r.tagTex.needsUpdate = true;
  },
  update(dt) {
    if (!this.active) return;
    const c = Game.car;
    this.sendT -= dt;
    if (this.sendT <= 0) {
      this.sendT = 1 / 30;
      this.cosT = (this.cosT || 0) - 1;
      const o = { t: 's', cx: c.x, cy: c.y, cz: c.z, cyaw: c.yaw, cp: c.pitch, cr: c.roll, st: c.steer, vf: c.vf, lt: c.lights ? 1 : 0, ex: c.exploded ? 1 : 0,
        px: Player.x, py: Player.y, pz: Player.z, pyaw: Player.yaw, in: Game.inCar ? 1 : 0, km: Game.maxS / 1000 };
      if (this.cosT <= 0) { this.cosT = 30; o.pc = c.paint; o.co = Object.keys(c.cosm).filter(k => c.cosm[k]).map(k => [k, c.cosm[k].kind, c.cosm[k].data.col]); }
      this.send(o);
    }
    for (const pl of this.others()) this.updateRemote(pl, dt);
  },
  updateRemote(pl, dt) {
    const t = pl.target; if (!pl.r) { if (this.scene) this.makeRemote(pl); return; }
    if (!t) return;
    const r = pl.r;
    if (!r.cur) r.cur = Object.assign({}, t);
    const cu = r.cur, k = Math.min(1, dt * 15), sm = pl.sm && pl.sm.update(dt);
    if (sm) Object.assign(cu, sm);
    // výška vzdáleného auta z terénu v odhadnuté poloze (odhad rychlostí přes horizont by auto vystřelil/zabořil)
    if (typeof World !== 'undefined' && World.height && typeof t.cy === 'number') {
      const off = U.clamp(t.cy - World.height(t.cx, t.cz), -0.8, 0.8);
      r._yo = r._yo === undefined ? off : r._yo + (off - r._yo) * Math.min(1, dt * 8);
      cu.cy = World.height(cu.cx, cu.cz) + r._yo;
    }
    for (const f of ['st', 'vf']) cu[f] += (t[f] - cu[f]) * k;
    const p = r.parts;
    p.root.visible = !t.ex;
    if (pl.pc !== undefined && pl.pc !== r._pc) { r._pc = pl.pc; p.paintMat.color.setHex(pl.pc); }
    const cs = pl.co ? JSON.stringify(pl.co) : r._co;
    if (cs !== r._co) {
      r._co = cs;
      for (const kk of Object.keys(p.cosm)) CarModel.applyCosm(p, kk, null);
      let rim = null;
      for (const [slot, kind, col] of (pl.co || [])) { if (!COSM[kind]) continue; CarModel.applyCosm(p, slot, kind, { col }); if (slot === 'rims') rim = COSM[kind].rim; }
      p.wheels.forEach(w => w.rimMat.color.setHex(rim || 0x9a9a92));
    }
    p.root.position.set(cu.cx, cu.cy, cu.cz);
    p.root.rotation.set(-cu.cp, cu.cyaw, cu.cr, 'YXZ');
    p.wheels.forEach(w => { w.spin.rotation.x += cu.vf / WHEEL_R * dt; });
    p.steerPivots.forEach(pv => { pv.rotation.y = cu.st; });
    p.hood.rotation.x = 0;
    p.headMat.emissive.setHex(t.lt ? 0xfff2c0 : 0); p.spot.intensity = t.lt ? 2.2 : 0;
    r.col.x = t.ex ? 0 : cu.cx; r.col.z = t.ex ? -99999 : cu.cz; r.col.ry = cu.cyaw;
    const av = r.avatar; av.visible = !t.in;
    const moved = pl.sm ? Math.hypot(pl.sm.vel.px || 0, pl.sm.vel.pz || 0) * 0.12 : 0;
    av.position.set(cu.px, cu.py, cu.pz); av.rotation.y = cu.pyaw + Math.PI;
    av.userData.ph += Math.min(moved * 6, 1) * dt * 9;
    av.userData.legs.forEach((l, i) => { l.rotation.x = Math.sin(av.userData.ph + i * Math.PI) * 0.6 * Math.min(1, moved * 4); });
    av.userData.arms.forEach((a, i) => { a.rotation.x = -Math.sin(av.userData.ph + i * Math.PI) * 0.5 * Math.min(1, moved * 4); });
    r.tag.position.set(t.in ? cu.cx : cu.px, (t.in ? cu.cy : cu.py) + 3, t.in ? cu.cz : cu.pz);
    r.tt -= dt; if (r.tt <= 0) { r.tt = 0.5; this.drawTag(pl); }
  },
};
