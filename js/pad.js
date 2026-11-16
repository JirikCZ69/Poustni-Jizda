// pad.js – volant s pedály a gamepad (Gamepad API)
// • analogové řízení / plyn / brzda (volant = přímé natočení kol, gamepad = páčka)
// • průvodce kalibrací (osa volantu, plyn, brzda, pádla a tlačítka) – funguje pro každý volant (Logitech, Thrustmaster, Fanatec, Moza…)
// • tlačítka → akce hry (posílají se jako stisk klávesy z Nastavení, takže fungují ve všech režimech)
// • vibrace při nárazu (gamepady, které to umí)
const PAD_WHEEL_RE = /wheel|g29|g920|g923|g27|g25|driving force|thrustmaster|t300|t150|t248|t128|t500|tmx|t-gt|fanatec|moza|simagic|simucube|steering|racing|ferrari|volant/i;
// standardní gamepad (Xbox / PlayStation): A, B, X, Y, LB, RB, LT, RT, Back, Start, LS, RS, ↑, ↓, ←, →
const PAD_STD_BTN = { 0: 'interact', 1: 'handbrake', 2: 'reload', 3: 'engine', 4: 'shiftDown', 5: 'shiftUp', 8: 'camera', 9: '#pause', 10: 'run', 11: 'horn', 12: 'lights', 13: 'drop', 14: 'radioNext', 15: 'radio' };
const PAD_WHEEL_BTN = { 4: 'shiftUp', 5: 'shiftDown', 0: 'interact', 1: 'handbrake', 2: 'engine', 3: 'lights', 9: '#pause' };
const PAD_EXTRA = [['#pause', 'Pauza / menu']];
const PAD_CAL_STEPS = [
  { id: 'center', txt: 'Dej volant <b>rovně</b> a pusť všechny pedály.<br>Pak klikni na <b>Další</b>.', manual: true },
  { id: 'steer', txt: 'Otoč volantem <b>doprava</b> tak daleko, kolik má ve hře znamenat <b>plný rejd</b> (doporučeno ¼ až ½ otáčky) a <b>drž</b>.<br><span>Gamepad: dej levou páčku úplně doprava.</span>' },
  { id: 'thr', txt: 'Sešlápni <b>plyn</b> úplně dolů a drž…<br><span>Gamepad: zmáčkni pravou spoušť (RT/R2).</span>', rel: 'Teď plyn <b>pusť</b>…' },
  { id: 'brk', txt: 'Sešlápni <b>brzdu</b> úplně dolů a drž…<br><span>Gamepad: levá spoušť (LT/L2).</span>', rel: 'Teď brzdu <b>pusť</b>…' },
  { id: 'b:shiftUp', txt: 'Zmáčkni pádlo / tlačítko pro <b>řazení nahoru</b>' },
  { id: 'b:shiftDown', txt: 'Zmáčkni pádlo / tlačítko pro <b>řazení dolů</b>' },
  { id: 'b:handbrake', txt: 'Zmáčkni tlačítko pro <b>ruční brzdu</b> (taky skok a start v dragu)' },
  { id: 'b:interact', txt: 'Zmáčkni tlačítko pro <b>nastoupit / vzít / použít</b>' },
  { id: 'b:engine', txt: 'Zmáčkni tlačítko pro <b>nastartování motoru</b>' },
  { id: 'b:#pause', txt: 'Zmáčkni tlačítko pro <b>pauzu / menu</b>' },
];

const Pad = {
  gp: null, id: '', kind: '', a: { steer: 0, sx: 0, thr: 0, brk: 0, mx: 0, my: 0, rx: 0, ry: 0 }, heldA: {}, prev: [], cal: null, wait: null, lastBtn: -1, synth: false, _t: 0,

  init() {
    addEventListener('gamepadconnected', (e) => {
      const kind = PAD_WHEEL_RE.test(e.gamepad.id) ? 'volant' : 'gamepad';
      this.note(`🎮 Připojen ${kind}: ${this.short(e.gamepad.id)}${kind === 'volant' && !this.cfgFor(e.gamepad).cal ? ' – zkalibruj ho v Nastavení (průvodce)' : ''}`, 'good');
    });
    addEventListener('gamepaddisconnected', () => { this.release(); this.note('🎮 Ovladač odpojen', 'bad'); });
    let last = performance.now();
    const loop = (t) => { const dt = Math.min(0.1, (t - last) / 1000); last = t; try { this.poll(dt); } catch (e) { /* ovladač nesmí shodit hru */ } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  },
  note(t, c) { if (typeof Game !== 'undefined' && Game.msg) Game.msg(t, c); },
  short(id) { return String(id || '').replace(/\s*\(.*?Vendor.*?\)/i, '').replace(/[<>&"]/g, '').slice(0, 48); },

  // ---------- konfigurace (uložená zvlášť pro každé zařízení) ----------
  defaults(gp) {
    const wheel = PAD_WHEEL_RE.test(gp.id) || gp.mapping !== 'standard' && gp.axes.length >= 3 && gp.buttons.length >= 10 && !/xbox|playstation|dualshock|dualsense|gamepad|controller/i.test(gp.id);
    if (wheel) return { kind: 'wheel', cal: false, steer: { i: 0, c: 0, r: 1 }, thr: null, brk: null, btn: Object.assign({}, PAD_WHEEL_BTN), sens: 1, lin: 1, dz: 0.01, ss: 0.35, rumble: true };
    return { kind: 'pad', cal: true, steer: { i: 0, c: 0, r: 1 }, thr: { t: 'b', i: 7, rest: 0, full: 1 }, brk: { t: 'b', i: 6, rest: 0, full: 1 }, btn: Object.assign({}, PAD_STD_BTN), sens: 1, lin: 1.6, dz: 0.12, ss: 1, rumble: true };
  },
  key(gp) { return String(gp.id).slice(0, 100); },
  cfgFor(gp) {
    const all = Settings.s.pads || (Settings.s.pads = {}), k = this.key(gp);
    if (!all[k] || typeof all[k] !== 'object') all[k] = this.defaults(gp);
    return all[k];
  },
  cfg() { return this.gp ? this.cfgFor(this.gp) : null; },
  save() { Settings.save(); },
  resetCfg() { if (!this.gp) return; Settings.s.pads[this.key(this.gp)] = this.defaults(this.gp); this.save(); },
  ok() { const c = this.cfg(); return !!(c && c.cal); },

  // ---------- čtení ----------
  pick() {
    const list = navigator.getGamepads ? [...navigator.getGamepads()].filter(g => g && g.connected !== false) : [];
    if (!list.length) return null;
    const same = list.find(g => this.gp && g.index === this.gp.index && g.id === this.gp.id);
    return same || list.find(g => PAD_WHEEL_RE.test(g.id)) || list[0];
  },
  ax(gp, i) { const v = gp.axes[i]; return typeof v === 'number' && isFinite(v) ? v : 0; },
  bv(gp, i) { const b = gp.buttons[i]; return b ? (typeof b === 'object' ? (b.value || (b.pressed ? 1 : 0)) : +b) : 0; },
  pedal(gp, p) {
    if (!p) return 0;
    const v = p.t === 'b' ? this.bv(gp, p.i) : this.ax(gp, p.i), span = p.full - p.rest;
    if (Math.abs(span) < 0.05) return 0;
    const x = (v - p.rest) / span;
    return x < 0.04 ? 0 : x > 0.97 ? 1 : (x - 0.04) / 0.93;
  },
  steerOf(gp, c) {
    const s = c.steer; if (!s) return 0;
    const span = s.r - s.c; if (Math.abs(span) < 0.02) return 0;
    let x = U.clamp((this.ax(gp, s.i) - s.c) / span, -1.5, 1.5);
    const dz = c.dz || 0, a = Math.abs(x);
    x = a < dz ? 0 : Math.sign(x) * (a - dz) / (1 - dz);
    x = Math.sign(x) * Math.pow(Math.abs(x), c.lin || 1) * (c.sens || 1);
    return U.clamp(x, -1, 1);
  },
  pedalBtns(c) { return new Set([c.thr, c.brk].filter(p => p && p.t === 'b').map(p => p.i)); },

  poll(dt) {
    const gp = this.pick();
    if (!gp) { if (this.gp) this.release(); this.gp = null; this.liveUI(); return; }
    if (!this.gp || this.gp.id !== gp.id) this.prev = [];
    this.gp = gp;
    const c = this.cfgFor(gp), A = this.a;
    if (this.cal) { this.calStep(gp, dt); this.liveUI(); return; }
    A.sx = this.steerOf(gp, c); A.steer = -A.sx;          // hra: + = doleva
    A.thr = c.thr ? this.pedal(gp, c.thr) : 0; A.brk = c.brk ? this.pedal(gp, c.brk) : 0;
    if (c.kind === 'pad') {
      const d = (v) => Math.abs(v) < 0.18 ? 0 : (v - Math.sign(v) * 0.18) / 0.82;
      A.mx = d(this.ax(gp, 0)); A.my = d(this.ax(gp, 1)); A.rx = d(this.ax(gp, 2)); A.ry = d(this.ax(gp, 3));
    } else A.mx = A.my = A.rx = A.ry = 0;
    if (!c.cal) A.steer = A.sx = A.thr = A.brk = 0;     // nezkalibrovaný volant: radši nic (pedály by mohly „jet samy“)
    // tlačítka
    const pb = this.pedalBtns(c);
    for (let i = 0; i < gp.buttons.length; i++) {
      const on = this.bv(gp, i) > 0.5, was = !!this.prev[i];
      this.prev[i] = on;
      if (on === was || pb.has(i) && !this.wait) continue;
      if (on) this.lastBtn = i;
      if (this.wait) { if (on) this.bindBtn(i, this.wait); continue; }
      const act = c.btn && c.btn[i]; if (!act) continue;
      if (act === '#pause') { if (on) this.pause(); continue; }
      this.heldA[act] = on;
      this.fire(on ? 'keydown' : 'keyup', Settings.key(act));
    }
    this.onFoot(dt, c);
    this.liveUI();
  },
  fire(type, code) {
    if (!code) return;
    this.synth = true;
    try { dispatchEvent(new KeyboardEvent(type, { code, key: '', bubbles: true, cancelable: true })); } finally { this.synth = false; }
  },
  release() {
    for (const act of Object.keys(this.heldA)) if (this.heldA[act]) this.fire('keyup', Settings.key(act));
    this.heldA = {}; this.prev = []; Object.assign(this.a, { steer: 0, sx: 0, thr: 0, brk: 0, mx: 0, my: 0, rx: 0, ry: 0 });
  },
  // je akce držená ovladačem? (tlačítko nebo páčka/pedál jako „klávesa“)
  held(action) {
    if (!this.gp) return false;
    if (this.heldA[action]) return true;
    const A = this.a;
    switch (action) {
      case 'forward': return A.thr > 0.5 || A.my < -0.5;
      case 'back': return A.brk > 0.5 || A.my > 0.5;
      case 'left': return A.sx < -0.5 || A.mx < -0.5;
      case 'right': return A.sx > 0.5 || A.mx > 0.5;
    }
    return false;
  },
  thr() { return this.gp && this.ok() ? this.a.thr : 0; },
  // spojení klávesnice a ovladače pro řízení auta (klávesnice má přednost, když se drží)
  mix(kThr, kBrk, kSteer) {
    const c = this.cfg();
    if (!this.gp || !c || !c.cal) return { thr: kThr, brk: kBrk, steer: kSteer, direct: false, ss: 1 };
    const A = this.a, useKb = kSteer !== 0;
    return { thr: Math.max(kThr, A.thr), brk: Math.max(kBrk, A.brk), steer: useKb ? kSteer : A.steer, direct: !useKb && c.kind === 'wheel', ss: c.ss === undefined ? 1 : c.ss };
  },
  // pěšky s gamepadem: pravá páčka = rozhlížení, RT = střelba, LT = míření
  onFoot(dt, c) {
    if (c.kind !== 'pad' || typeof Game === 'undefined' || !Game.playing || Game.paused || Game.uiOpen || typeof Player === 'undefined' || !Player.alive) return;
    if ((typeof Rally !== 'undefined' && Rally.active) || (typeof Drag !== 'undefined' && Drag.active)) return;
    const A = this.a;
    if (A.rx || A.ry) { const k = (typeof Weapons !== 'undefined' && Weapons.zoom ? 0.3 : 1) * 1100 * dt; Player.look(A.rx * Math.abs(A.rx) * k, A.ry * Math.abs(A.ry) * k * 0.75); }
    if (Game.inCar) return;
    const fire = this.bv(this.gp, 7) > 0.5, aim = this.bv(this.gp, 6) > 0.5;
    if (fire !== !!this._fire) { this._fire = fire; Game.mouseDown = fire; if (fire) Game.clickQueued = true; }
    if (aim !== !!this._aim) { this._aim = aim; Game.aim = aim; }
  },
  pause() {
    if ($('settings').style.display === 'flex') { if (!this.cal && !this.wait) Settings.close(); return; }
    if (typeof Game === 'undefined' || !Game.playing || (typeof Rally !== 'undefined' && Rally.active) || (typeof Drag !== 'undefined' && Drag.active)) { Settings.open('menu'); return; }
    if (!Player.alive) return;
    if (Game.paused) { Game.paused = false; $('pause').style.display = 'none'; }
    else { Game.paused = true; $('pause').style.display = 'flex'; if (document.exitPointerLock) document.exitPointerLock(); }
  },
  rumble(v) {
    const gp = this.gp, c = this.cfg();
    if (!gp || !c || !c.rumble || !gp.vibrationActuator || !gp.vibrationActuator.playEffect) return;
    v = U.clamp(v, 0, 1);
    try { const p = gp.vibrationActuator.playEffect('dual-rumble', { duration: 120 + v * 280, strongMagnitude: v, weakMagnitude: Math.min(1, v * 0.7 + 0.2) }); if (p && p.catch) p.catch(() => {}); } catch (e) { /* nic */ }
  },

  // ---------- přiřazení tlačítka ----------
  bindBtn(i, action) {
    const c = this.cfg(); if (!c) return;
    c.btn = c.btn || {};
    for (const k of Object.keys(c.btn)) if (c.btn[k] === action) delete c.btn[k];
    c.btn[i] = action;
    this.wait = null; this.save(); Sfx.click && Sfx.click(); Settings.render();
  },
  btnOf(action) { const c = this.cfg(); if (!c || !c.btn) return null; const k = Object.keys(c.btn).find(k => c.btn[k] === action); return k === undefined ? null : +k; },

  // ---------- průvodce kalibrací ----------
  calStart() {
    if (!this.gp) return;
    this.release();
    const c = this.cfg();
    this.cal = { k: 0, phase: 0, st: 0, cand: null, last: 0, pend: null, nc: JSON.parse(JSON.stringify(c)), needRel: true };
    this.cal.nc.btn = Object.assign({}, c.btn || {});
    Settings.render();
  },
  calCancel() { this.cal = null; this.prev = []; Settings.render(); },
  calNext(skip) {
    const C = this.cal, step = PAD_CAL_STEPS[C.k], gp = this.gp;
    if (!C || !gp) return;
    if (step.id === 'center') { C.rest = gp.axes.map((v, i) => this.ax(gp, i)); C.restB = gp.buttons.map((b, i) => this.bv(gp, i)); }
    else if (!skip && step.id === 'steer' && C.cand) C.nc.steer = { i: C.cand.i, c: C.rest[C.cand.i], r: this.ax(gp, C.cand.i) };
    C.k++; C.phase = 0; C.st = 0; C.cand = null; C.pend = null; C.needRel = true;
    if (C.k >= PAD_CAL_STEPS.length) return this.calDone();
    Settings.render();
  },
  calDone() {
    const nc = this.cal.nc;
    nc.cal = !!(nc.steer && nc.thr && nc.brk);
    if (nc.kind === 'wheel') { nc.sens = 1; nc.lin = nc.lin || 1; }   // plný rejd je přímo tam, kam jsi volant otočil
    Settings.s.pads[this.key(this.gp)] = nc;
    this.cal = null; this.prev = []; this.save();
    this.note(nc.cal ? '🎮 Kalibrace hotová – můžeš jet!' : '🎮 Kalibrace nedokončená – chybí plyn nebo brzda', nc.cal ? 'good' : 'bad');
    Settings.render();
  },
  // najde osu / analogové tlačítko s největší změnou proti klidu
  calCand(gp, exA, exB) {
    const C = this.cal; let best = null;
    gp.axes.forEach((_, i) => { if (exA.has(i)) return; const v = this.ax(gp, i), d = v - (C.rest[i] || 0); if (!best || Math.abs(d) > Math.abs(best.d)) best = { t: 'a', i, v, d }; });
    gp.buttons.forEach((_, i) => { if (exB.has(i)) return; const v = this.bv(gp, i), d = v - (C.restB[i] || 0); if (!best || Math.abs(d) > Math.abs(best.d)) best = { t: 'b', i, v, d }; });
    return best;
  },
  calStep(gp, dt) {
    const C = this.cal, step = PAD_CAL_STEPS[C.k], nc = C.nc;
    let prog = 0, info = '';
    const stable = (cand, need) => {
      if (C.cand && cand && C.cand.t === cand.t && C.cand.i === cand.i && Math.abs(cand.v - C.last) < 0.03) C.st += dt; else C.st = 0;
      C.cand = cand; C.last = cand ? cand.v : 0;
      return Math.min(1, C.st / need);
    };
    if (step.id === 'steer') {
      const cand = this.calCand(gp, new Set(), new Set(gp.buttons.map((_, i) => i)));
      if (cand && Math.abs(cand.d) > 0.2) { prog = stable(cand, 0.8); info = `osa ${cand.i}: ${cand.v.toFixed(2)}`; if (prog >= 1) return this.calNext(); }
      else { C.st = 0; C.cand = null; }
    } else if (step.id === 'thr' || step.id === 'brk') {
      const exA = new Set([nc.steer ? nc.steer.i : -1]), exB = new Set();
      const other = step.id === 'brk' ? nc.thr : null;
      if (other) (other.t === 'a' ? exA : exB).add(other.i);
      if (C.phase === 0) {
        const cand = this.calCand(gp, exA, exB);
        if (cand && Math.abs(cand.d) > 0.35) { prog = stable(cand, 0.7); info = `${cand.t === 'a' ? 'osa' : 'tlačítko'} ${cand.i}: ${cand.v.toFixed(2)}`; if (prog >= 1) { C.pend = { t: cand.t, i: cand.i, full: cand.v }; C.phase = 1; C.st = 0; C.last = cand.v; Settings.render(); } }
        else { C.st = 0; C.cand = null; }
      } else {
        // puštěný pedál: hodnota se vrátí a ustálí → to je klid (některé volanty hlásí do prvního pohybu 0)
        const p = C.pend, v = p.t === 'a' ? this.ax(gp, p.i) : this.bv(gp, p.i);
        if (Math.abs(v - p.full) > 0.5) { if (Math.abs(v - C.last) < 0.02) C.st += dt; else C.st = 0; C.last = v; prog = Math.min(1, C.st / 0.5); info = `klid ${v.toFixed(2)}`; }
        else { C.st = 0; C.last = v; }
        if (prog >= 1) { nc[step.id] = { t: p.t, i: p.i, rest: v, full: p.full }; return this.calNext(); }
      }
    } else if (step.id.startsWith('b:')) {
      const pb = this.pedalBtns(nc), pressed = [];
      gp.buttons.forEach((_, i) => { if (!pb.has(i) && this.bv(gp, i) > 0.5) pressed.push(i); });
      if (C.needRel) { if (!pressed.length) C.needRel = false; info = pressed.length ? 'pusť tlačítka…' : ''; }
      else if (pressed.length) {
        const act = step.id.slice(2);
        for (const k of Object.keys(nc.btn)) if (nc.btn[k] === act) delete nc.btn[k];
        nc.btn[pressed[0]] = act;
        return this.calNext();
      }
    }
    const el = $('padCalProg'); if (el) el.style.width = Math.round(prog * 100) + '%';
    const ei = $('padCalInfo'); if (ei) ei.textContent = info;
  },
  calHTML() {
    const C = this.cal, step = PAD_CAL_STEPS[C.k];
    const txt = C.phase === 1 && step.rel ? step.rel : step.txt;
    const btnStep = step.id.startsWith('b:');
    return `<h2>🎮 Kalibrace ovladače</h2><div style="opacity:.7;font-size:13px">${this.short(this.gp && this.gp.id)} · krok ${C.k + 1} / ${PAD_CAL_STEPS.length}</div>
      <div class="padCal"><div class="padCalTxt">${txt}</div><div class="padBar"><i id="padCalProg"></i></div><div id="padCalInfo" class="padCalInfo"></div></div>
      <div style="margin-top:12px">${step.manual || step.id === 'steer' ? '<button class="close" data-padnext="1">Další ▶</button> ' : ''}${btnStep ? '<button class="close" data-padskip="1">Přeskočit</button> ' : ''}<button class="close" data-padcancel="1">Zrušit</button></div>`;
  },

  // ---------- živé ukazatele v Nastavení ----------
  liveUI() {
    if ((this._t = (this._t + 1) % 3) || $('settings').style.display !== 'flex') return;
    const el = $('padLive');
    if (!el) return;
    if (!this.gp) { if (el.dataset.on !== '0') { el.dataset.on = '0'; Settings.render(); } return; }
    if (el.dataset.on !== '1') { Settings.render(); return; }
    const A = this.a, set = (id, w, l) => { const e = $(id); if (e) { e.style.width = w + '%'; if (l !== undefined) e.style.left = l + '%'; } };
    const s = U.clamp(A.sx, -1, 1);
    set('padSt', Math.abs(s) * 50, s < 0 ? 50 + s * 50 : 50); set('padTh', A.thr * 100); set('padBr', A.brk * 100);
    const lb = $('padLb'); if (lb) lb.textContent = this.lastBtn >= 0 ? 'Tl. ' + this.lastBtn : '—';
  },
  settingsHTML() {
    const gp = this.gp, c = this.cfg();
    let h = '<h3>Volant a gamepad</h3>';
    if (!gp) return h + '<div id="padLive" data-on="0" class="padNone">Nic není připojené. Připoj volant nebo gamepad a <b>zmáčkni na něm libovolné tlačítko</b> (prohlížeč ho ukáže až potom).</div>';
    const range = (id, label, min, max, step, val, unit) => `<div class="srow"><span>${label}</span><input type="range" data-pset="${id}" data-unit="${unit}" min="${min}" max="${max}" step="${step}" value="${val}"><b>${unit === ' %' ? Math.round(val * 100) : val}${unit}</b></div>`;
    h += `<div id="padLive" data-on="1"><div class="padDev">${c.kind === 'wheel' ? '🛞 Volant' : '🎮 Gamepad'}: <b>${this.short(gp.id)}</b>${c.cal ? ' <span class="gOk">✔ připraven</span>' : ' <span style="color:#ff8a6a">⚠ nezkalibrováno – spusť průvodce</span>'}</div>
      <div class="padRow"><span>Řízení</span><div class="padBar mid"><i id="padSt"></i></div></div>
      <div class="padRow"><span>Plyn</span><div class="padBar"><i id="padTh"></i></div></div>
      <div class="padRow"><span>Brzda</span><div class="padBar br"><i id="padBr"></i></div></div>
      <div class="padRow"><span>Poslední tlačítko</span><b id="padLb">—</b></div></div>
      <div style="margin:6px 0"><button class="kb" data-padcal="1">🎯 Kalibrovat (průvodce)</button> <button class="kb" data-padreset="1">Výchozí pro tohle zařízení</button></div>`;
    h += range('sens', 'Citlivost řízení', 0.3, 4, 0.05, c.sens, '×') + range('lin', 'Křivka řízení (1 = lineární, víc = jemnější střed)', 0.5, 3, 0.05, c.lin, '')
      + range('dz', 'Mrtvá zóna uprostřed', 0, 0.3, 0.01, c.dz, ' %') + range('ss', 'Menší rejd ve vysoké rychlosti', 0, 1, 0.05, c.ss, ' %')
      + `<div class="srow"><span>Vibrace při nárazu (gamepad)</span><input type="checkbox" data-pset="rumble" ${c.rumble ? 'checked' : ''}></div>`;
    h += '<div style="font-size:13px;opacity:.75;margin:6px 0 4px">Tlačítka ovladače – klikni a zmáčkni tlačítko na volantu / gamepadu (Esc = zrušit, Delete = smazat).</div>';
    h += ACTIONS.concat(PAD_EXTRA).map(([id, label]) => { const b = this.btnOf(id); return `<div class="srow"><span>${label}</span><button class="kb${this.wait === id ? ' wait' : ''}" data-padbind="${id}">${this.wait === id ? 'zmáčkni tlačítko…' : b === null ? '—' : 'Tl. ' + b}</button></div>`; }).join('');
    return h;
  },
};
Pad.init();
