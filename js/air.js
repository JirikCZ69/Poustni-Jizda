// air.js – režim LETECKÉ ZÁVODY: hangár (výběr letadla, barvy, trati, asistence), závod s AI, časovka, volný let z letiště,
// multiplayer až pro 4 (každý se svým letadlem), přístroje (umělý horizont, rychlost, výška, variometr, G, úhel náběhu),
// G-efekty (zatmění / zčervenání), varování před pádem a terénem, kouřová stopa, exploze, zvuk motoru, vrtule a větru.
const AIR_AI = [
  { n: 'Pepa Vrtule', k: 0.9, col: '#ff8a6a', paint: 0x2a6ad8 },
  { n: 'Jarka Křidélko', k: 0.95, col: '#8fe38a', paint: 0xf0f0ea },
  { n: 'Láďa Looping', k: 1.0, col: '#8ac8ff', paint: 0x8a2ad8 },
];
const AIR_ASSIST = ['Realismus', 'Částečná', 'Plná'];
const Air = {
  active: false, mode: null, paused: false,
  load() {
    this.sv = Object.assign({ plane: 'cmelak', paint: 0, track: 0, assist: 2, cam: 'chase', yoke: false, smoke: true, pb: {} }, U.store.get('pj_air', {}));
    if (!PLANES[this.sv.plane]) this.sv.plane = 'cmelak';
  },
  store() { U.store.set('pj_air', this.sv); },
  fmt(t) { if (!isFinite(t)) return '—'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; },
  esc(t) { return String(t).replace(/[<>&"]/g, ''); },
  // odhad maximální rychlosti ve vodorovném letu (tah = odpor)
  vmax(id) {
    const P = PLANES[id];
    for (let V = 20; V < 260; V += 0.5) {
      const qd = 0.5 * AIR_RHO * V * V, CL = P.m * AIR_G / (qd * P.S), D = qd * P.S * (P.CD0 + P.gearCD * (P.retract ? 0 : 1) + CL * CL / (Math.PI * P.b * P.b / P.S * P.e));
      if (P.P * P.eta / Math.max(V, P.Vp) < D) return V;
    }
    return 260;
  },
  vstall(id) { const P = PLANES[id]; return Math.sqrt(2 * P.m * AIR_G / (AIR_RHO * P.S * (P.CL0 + P.CLa * P.aStall))); },

  // ---------------------------------------------------------------- scéna
  ensureScene(ti) {
    if (this.scene && this.ti === ti) return;
    if (this.scene) this.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    const T = AIR_TRACKS[ti];
    const sc = this.scene = new THREE.Scene(); this.ti = ti;
    sc.background = new THREE.Color(T.sky); sc.fog = new THREE.Fog(T.fog, 900, 4200);
    sc.add(new THREE.HemisphereLight(0xeaf4ff, 0x7a6a50, 0.62));
    const sun = this.sun = new THREE.DirectionalLight(0xfff2dc, 1.05);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera; c.left = -70; c.right = 70; c.top = 70; c.bottom = -70; c.near = 1; c.far = 900; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.08;
    sc.add(sun); sc.add(sun.target);
    this.sunDir = new THREE.Vector3(0.45, 0.8, 0.35).normalize();
    this.course = AirCourse.build(ti); this.course.sunDir = this.sunDir;
    AirCourse.mesh(this.course, sc);
    if (!this.cam) { this.cam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.3, 12000); }
    sc.add(this.cam);
    this.fx = new AirFx(sc);
    this.racers = []; this.mapBg = null;
  },
  env(x, z) {
    const c = this.course;
    const e = this._env || (this._env = { wind: new THREE.Vector3(), height: (xx, zz) => this.course.height(xx, zz), normal: (xx, zz, o) => this.course.normal(xx, zz, o), water: null, agl: 100, overWater: false, gnd: 0 });
    e.water = c.water; e.overWater = c.overWater(x, z); e.gnd = c.height(x, z);
    // turbulence: jemné poryvy, v kaňonu silnější
    const t = performance.now() / 1000, k = (c.T.biome === 'canyon' ? 1.6 : 1) * (this.sv.assist === 2 ? 0.5 : 1);
    e.wind.set(U.vnoise(t * 0.35, 1.7, 3) * 2.2 * k, U.vnoise(t * 0.6, 4.1, 9) * 1.2 * k, U.vnoise(t * 0.3, 8.3, 5) * 2.2 * k);
    return e;
  },

  // ---------------------------------------------------------------- hangár (menu)
  enter() {
    this.load(); this.active = true; this.mode = 'menu'; this.paused = false;
    Sfx.init();
    $('menu').style.display = 'none'; $('race').style.display = 'none'; $('airHud').style.display = 'none'; $('airPause').style.display = 'none';
    $('airMenu').style.display = 'flex';
    Sfx.engine({ rpm: 0, throttle: 0, running: false, speed: 0, slip: 0, wspin: 0, lock: 0, onRoad: true, inCar: false, dist: 99, lay: 'i4', cyl: 4 });
    this.ensureScene(this.sv.track);
    this.demo();
    this.renderMenu();
  },
  exit() {
    if (!this.active) return;
    this.active = false; this.mode = null;
    $('airMenu').style.display = 'none'; $('airHud').style.display = 'none'; $('airPause').style.display = 'none';
    this.sndOff();
    if (document.pointerLockElement) document.exitPointerLock();
  },
  toMenu() { this.exit(); if (Net.active && Net.inRace) { Net.leave(); } $('menu').style.display = 'flex'; },
  // ukázkové letadlo za menu: letí po trati, kamera kolem
  demo() {
    this.clearRacers();
    const r = this.makeRacer({ kind: 'ai', plane: this.sv.plane, paint: AIR_PAINTS[this.sv.paint], nick: '', ai: { k: 0.85 } });
    r.ai.s = 0; r.ai.lat = 0; this.demoR = r; this.camYaw = 0;
  },
  renderMenu() {
    const sv = this.sv, P = PLANES[sv.plane];
    let h = '<div class="amHead"><h2>✈ LETECKÉ ZÁVODY</h2><div style="opacity:.85">Brány, pylony a kaňony. Realistický letový model.</div></div><div class="amSide amL">';
    h += '<h3>Letadlo</h3><div class="amCards">' + PLANE_IDS.map(id => {
      const q = PLANES[id], vm = this.vmax(id) * 3.6, vs = this.vstall(id) * 3.6;
      return `<button class="amCard${sv.plane === id ? ' on' : ''}" data-ap="plane:${id}"><b>${q.name}</b> <span class="amCls">${q.cls}</span><br><span>${q.desc}</span><div class="amSt">⚡ ${Math.round(q.P / 1000 * 1.36)} k · ⚖ ${q.m} kg · ⇢ ${Math.round(vm)} km/h · pád ${Math.round(vs)} km/h · ${q.nMax} G</div></button>`;
    }).join('') + '</div>';
    h += '<h3>Barva</h3><div class="amPaints">' + AIR_PAINTS.map((c, i) => `<button class="amPaint${sv.paint === i ? ' on' : ''}" data-ap="paint:${i}" style="background:#${(c === null ? P.col : c).toString(16).padStart(6, '0')}"></button>`).join('') + '</div>';
    h += '</div><div class="amSide amR">';
    h += '<h3>Trať</h3><div class="amCards">' + AIR_TRACKS.map((t, i) => {
      const pb = sv.pb[t.id + '_' + sv.plane];
      return `<button class="amCard${sv.track === i ? ' on' : ''}" data-ap="track:${i}"><b>${t.name}</b> <span class="amCls">${t.gates} bran · ${t.laps} kola</span><br><span>${t.desc}</span><div class="amSt">🏆 rekord (${P.name}): ${pb ? this.fmt(pb) : '—'}</div></button>`;
    }).join('') + '</div>';
    h += '<h3>Asistence</h3><div class="amRow">' + [2, 1, 0].map(a => `<button class="amOpt${sv.assist === a ? ' on' : ''}" data-ap="assist:${a}">${AIR_ASSIST[a]}</button>`).join('') + '</div>';
    h += `<div class="amHint">${['Žádná pomoc: kormidla přímo, kroutící moment vrtule táhne letadlo do strany, přetáhneš ho do pádu i do vývrtky, přetížení si hlídáš sám.', 'Knipl ovládá přetížení (do maxima letadla), zatáčky se samy koordinují. Pád a vývrtka jsou možné.', 'Knipl = přetížení s ochranou proti pádu, zatáčky koordinované, křídla se při puštění vyrovnají. Méně turbulence.'][sv.assist]}</div>`;
    h += `<div class="amRow"><label><input type="checkbox" data-apc="yoke" ${sv.yoke ? 'checked' : ''}> Myš jako knipl</label><label><input type="checkbox" data-apc="smoke" ${sv.smoke ? 'checked' : ''}> Kouřová stopa</label></div>`;
    h += '<details class="keysWrap"><summary>⌨ Ovládání letadla</summary><div class="keys">' +
      `<span><b>${Settings.keyName(Settings.key('forward'))} / ${Settings.keyName(Settings.key('back'))}</b> potlačit / přitáhnout (nos dolů / nahoru)</span><span><b>${Settings.keyName(Settings.key('left'))} / ${Settings.keyName(Settings.key('right'))}</b> křidélka (náklon)</span>` +
      '<span><b>Q / E</b> směrovka (pedály)</span><span><b>Shift / Ctrl</b> plyn + / − (nebo kolečko)</span><span><b>F</b> klapky</span><span><b>G</b> podvozek (Střela)</span>' +
      '<span><b>Mezerník</b> brzdy kol</span><span><b>V</b> kamera</span><span><b>X</b> kouř</span><span><b>R</b> zpět na poslední bránu</span><span><b>Myš</b> rozhlížení (nebo knipl)</span><span><b>Gamepad</b> páčky + spouště</span><span><b>Esc</b> pauza</span>' +
      '</div></details>';
    h += `</div><div class="amCenter"><div class="amSel"><b>${P.name}</b><span>${P.cls} · ${AIR_TRACKS[sv.track].name}</span></div></div>`;
    h += '<div class="amBot"><div class="amBtns"><button class="btn" data-ap="go:ai">🏁 ZÁVOD S AI (3)</button><button class="btn" data-ap="go:solo">⏱ ČASOVKA</button><button class="btn alt" data-ap="go:free">🛫 VOLNÝ LET Z LETIŠTĚ</button><button class="btn alt" data-ap="mp">👥 MULTIPLAYER</button><button class="btn alt" data-ap="back">← MENU</button></div></div>';
    $('airMenuBox').innerHTML = h;
  },
  menuClick(e) {
    const cb = e.target.closest('[data-apc]');
    if (cb) { this.sv[cb.dataset.apc] = cb.checked; this.store(); return; }
    const b = e.target.closest('[data-ap]'); if (!b) return;
    const [a, v] = b.dataset.ap.split(':'), sv = this.sv;
    Sfx.click();
    if (a === 'plane') { sv.plane = v; this.store(); this.demo(); }
    else if (a === 'paint') { sv.paint = +v; this.store(); this.demo(); }
    else if (a === 'track') { sv.track = +v; this.store(); this.ensureScene(sv.track); this.demo(); }
    else if (a === 'assist') { sv.assist = +v; this.store(); }
    else if (a === 'go') return this.start(v);
    else if (a === 'mp') { const md = 'air:' + sv.track; if (Net.isHost || !Net.connected()) Net.mode = md; Game.openLobby(); if (Net.isHost) Net.setMode(md); return; }
    else if (a === 'back') return this.toMenu();
    this.renderMenu();
  },
  bindUI() {
    $('airMenuBox').addEventListener('click', (e) => this.menuClick(e));
    $('airMenuBox').addEventListener('change', (e) => this.menuClick(e));
    $('airPause').addEventListener('click', (e) => {
      const b = e.target.closest('[data-apause]'); if (!b) return;
      const a = b.dataset.apause;
      if (a === 'go') this.setPause(false);
      else if (a === 'restart') { this.setPause(false); this.start(this.kind); }
      else if (a === 'hangar') { if (this.net) { Net.leave(); } this.setPause(false); this.enter(); }
    });
    const cv = Game.renderer.domElement, flying = () => this.active && this.mode === 'fly';
    cv.addEventListener('mousedown', () => { if (flying() && !this.paused && document.pointerLockElement !== cv) Game.lock(); });
    document.addEventListener('pointerlockchange', () => {
      if (!flying()) return;
      if (document.pointerLockElement !== cv && !this.done && !this.net && $('settings').style.display !== 'flex') this.setPause(true);
    });
    addEventListener('mousemove', (e) => {
      if (!flying() || this.paused || document.pointerLockElement !== cv) return;
      const dx = e.movementX, dy = e.movementY; if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return;
      const k = 0.0024 * (Settings.s.sens || 1), inv = Settings.s.invertY ? -1 : 1;
      if (this.sv.yoke) { this.mStick.x = U.clamp(this.mStick.x + dx * k * 1.4, -1, 1); this.mStick.y = U.clamp(this.mStick.y + dy * k * 1.4 * inv, -1, 1); this.mIdle = 0; }
      else { this.lookYaw = U.clamp(this.lookYaw - dx * k, -2.8, 2.8); this.lookPitch = U.clamp(this.lookPitch - dy * k * inv, -1.2, 1.1); this.lookIdle = 0; }
    });
    addEventListener('wheel', (e) => { if (flying() && !this.paused && this.me && this.me.phys) this.me.phys.thr = U.clamp(this.me.phys.thr - Math.sign(e.deltaY) * 0.08, 0, 1); }, { passive: true });
    addEventListener('keydown', (e) => this.key(e));
  },
  setPause(on) {
    if (this.net) on = false;
    this.paused = on;
    $('airPause').style.display = on ? 'flex' : 'none';
    if (on && document.pointerLockElement) document.exitPointerLock();
    if (!on) Game.lock();
  },
  key(e) {
    if (!this.active || this.mode !== 'fly' || e.repeat) return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if ($('settings').style.display === 'flex') return;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'Escape') { if (this.done) return; this.setPause(!this.paused); return; }
    if (this.paused) return;
    const me = this.me, ph = me && me.phys; if (!ph) return;
    switch (e.code) {
      case 'KeyF': if (ph.P.flapCL.length > 1) { ph.flaps = (ph.flaps + 1) % ph.P.flapCL.length; this.msg(['Klapky zasunuté', 'Klapky 1 (vzlet)', 'Klapky 2 (přistání)'][ph.flaps], 1.2); Sfx.ratchet(); } break;
      case 'KeyG': if (ph.P.retract) { if (ph.onGround && ph.gearDown) { this.msg('Na zemi podvozek nezatáhneš', 1.2); break; } ph.gearDown = !ph.gearDown; this.msg(ph.gearDown ? 'Podvozek vysouvám' : 'Podvozek zatahuji', 1.2); Sfx.install(); } break;
      case 'KeyV': case 'KeyC': { const L = ['chase', 'cockpit', 'wide']; this.sv.cam = L[(L.indexOf(this.sv.cam) + 1) % L.length]; this.store(); this.lookYaw = 0; this.lookPitch = 0; break; }
      case 'KeyX': this.sv.smoke = !this.sv.smoke; this.store(); this.msg(this.sv.smoke ? 'Kouř zapnutý' : 'Kouř vypnutý', 1); break;
      case 'KeyR': if (!me.done && this.countT <= 0 && !me.crashT) this.respawn(me, true); break;
      case 'KeyH': $('ahKeys').style.display = $('ahKeys').style.display === 'none' ? 'block' : 'none'; break;
    }
    const acts = Settings.actionsFor(e.code);
    if (acts.includes('settings')) { Settings.open('air'); if (!this.net) this.paused = true; }
    if (acts.includes('radio')) Radio.toggle();
  },

  // ---------------------------------------------------------------- závodníci
  clearRacers() {
    for (const r of this.racers || []) { if (r.model) this.scene.remove(r.model.root); if (r.smoke) r.smoke.dispose(); if (r.tag) this.scene.remove(r.tag); }
    this.racers = [];
  },
  makeRacer(o) {
    const r = Object.assign({ passes: 0, done: false, time: 0, pen: 0, crashT: 0 }, o);
    r.model = PlaneModel.build(r.plane, r.paint);
    this.scene.add(r.model.root);
    r.P = PLANES[r.plane];
    r.smoke = new AirSmoke(this.scene, r.kind === 'me' ? 0xffffff : new THREE.Color(r.col || '#ffffff').lerp(new THREE.Color(0xffffff), 0.55).getHex());
    r.pos = new THREE.Vector3(); r.q = new THREE.Quaternion(); r.prev = new THREE.Vector3(); r.vel = new THREE.Vector3();
    if (r.kind === 'ai') r.ai = Object.assign({ s: 0, v: r.P.Vrace, lat: 0, ph: Math.random() * 6, bank: 0, sTot: 0 }, r.ai || {});
    if (r.kind !== 'me' && r.nick) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48; const g = cv.getContext('2d');
      g.fillStyle = 'rgba(10,15,25,.6)'; g.fillRect(0, 4, 256, 40); g.fillStyle = r.col || '#fff'; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(this.esc(r.nick).slice(0, 16), 128, 25);
      r.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
      r.tag.renderOrder = 10; this.scene.add(r.tag);
    }
    this.racers.push(r);
    return r;
  },
  gateS(p) { const c = this.course, G = c.gates.length; return c.gates[p % G].i + Math.floor(p / G) * c.M; },
  totalPasses() { return this.laps * this.course.gates.length + 1; },
  // start: kind = 'ai' | 'solo' | 'free' | 'net'
  start(kind, netSlots) {
    this.ensureScene(this.net ? this.ti : this.sv.track);
    $('airMenu').style.display = 'none'; $('race').style.display = 'none'; $('airHud').style.display = 'block'; $('airPause').style.display = 'none'; $('lobby').style.display = 'none';
    Confetti.stop();
    this.kind = kind; this.net = kind === 'net'; this.mode = 'fly'; this.active = true; this.paused = false; this.done = false; this.doneT = 0;
    const c = this.course; this.laps = c.T.laps;
    this.clearRacers(); this.fx.clear();
    this.mStick = { x: 0, y: 0 }; this.stick = { p: 0, r: 0, y: 0 }; this.lookYaw = 0; this.lookPitch = 0; this.lookIdle = 0; this.gStress = 0; this.red = 0; this.maxG = 0;
    this.camQ = null; this.clock = 0; this.sendT = 0; this.hudT = 0; this.touch = null;
    const sv = this.sv;
    const me = this.me = this.makeRacer({ kind: 'me', plane: sv.plane, paint: AIR_PAINTS[sv.paint], nick: Game.nick(), col: SLOT_COL[this.net ? Net.slot : 0], slot: this.net ? Net.slot : 0 });
    me.phys = new AirPhys(sv.plane); me.phys.assist = sv.assist; me.phys.torqueK = sv.assist === 0 ? 1 : 0; me.phys.seed = Math.random() * 10;
    if (kind === 'ai') AIR_AI.forEach((a, i) => this.makeRacer({ kind: 'ai', plane: sv.plane, paint: a.paint, nick: a.n, col: a.col, ai: { k: a.k * (0.97 + Math.random() * 0.04) }, slot: i + 1 }));
    if (kind === 'net') for (const sl of netSlots) if (sl !== Net.slot) {
      const r = this.makeRacer({ kind: 'net', plane: 'cmelak', paint: SLOT_PAINT[sl], nick: Net.nickOf(sl), col: SLOT_COL[sl], slot: sl });
      r.model.root.visible = false;
    }
    // startovní pozice: letmý start za bránou 0 (formace), volný let = na dráze
    const order = this.racers.slice().sort((a, b) => a.slot - b.slot);
    order.forEach((r, k) => this.placeStart(r, k));
    this.countT = kind === 'free' ? 0 : 3.5; this._cd = -1;
    if (kind === 'free') { this.msg('Volný let – plyn Shift, rozjeď se a přitáhni kolem ' + Math.round(this.vstall(sv.plane) * 3.6 * 1.25) + ' km/h', 5); }
    else this.msg(kind === 'net' ? 'Multiplayer! Letmý start za 3…' : 'Letmý start – připrav se', 2);
    this.initSnd();
    $('ahKeys').innerHTML = `<b>${Settings.keyName(Settings.key('forward'))}/${Settings.keyName(Settings.key('back'))}</b> nos dolů/nahoru · <b>${Settings.keyName(Settings.key('left'))}/${Settings.keyName(Settings.key('right'))}</b> náklon · <b>Q/E</b> směrovka · <b>Shift/Ctrl</b> plyn · <b>F</b> klapky${PLANES[sv.plane].retract ? ' · <b>G</b> podvozek' : ''} · <b>Mezerník</b> brzdy · <b>V</b> kamera · <b>X</b> kouř · <b>R</b> reset · <b>H</b> skrýt`;
    this.mapBg = null;
    Game.lock();
  },
  placeStart(r, k) {
    const c = this.course, ds = c.ds;
    if (this.kind === 'free') {
      const rw = c.rw, back = rw.hl - 30 - k * 0;
      const x = rw.x - rw.cx * back + (k ? (k % 2 ? 1 : -1) * 8 : 0), z = rw.z - rw.cz * back;
      if (r.phys) {
        const g = r.phys.gearPts, mainY = g[0].p[1], tailY = g[2].p[1], dz = g[2].p[2] - g[0].p[2];
        const pitch = Math.atan2(tailY - mainY, dz);
        r.phys.place(x, c.height(x, z) - mainY + 0.05, z, rw.yaw, 0, pitch);
        r.phys.flaps = r.phys.P.flapCL.length > 1 ? 1 : 0;
        this.sync(r);
      }
      return;
    }
    const i0 = Math.round(-(240 + k * 55) / ds);
    const ii = ((i0 % c.M) + c.M) % c.M, p = c.pts[ii], q = c.pts[(ii + 3) % c.M];
    const tan = new THREE.Vector3().subVectors(q, p).normalize(), right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const lat = k === 0 ? 0 : (k % 2 ? 1 : -1) * 22 * Math.ceil(k / 2);
    const x = p.x + right.x * lat, z = p.z + right.z * lat, y = Math.max(p.y + (k % 2) * 6, c.height(x, z) + 25);
    const yaw = Math.atan2(-tan.x, -tan.z), pitch = Math.asin(U.clamp(tan.y, -1, 1));
    r.passes = 0; r.done = false; r.time = 0; r.pen = 0; r.crashT = 0; r.lastGate = -1;
    if (r.phys) { r.phys.place(x, y, z, yaw, r.P.Vrace * 0.85, pitch); this.sync(r); }
    if (r.ai) { r.ai.s = i0; r.ai.sTot = i0; r.ai.lat = lat; r.ai.lat0 = lat; r.ai.v = r.P.Vrace * 0.85; this.aiPose(r, 0); }
    r.prev.copy(r.pos);
  },
  sync(r) { r.pos.copy(r.phys.pos); r.q.copy(r.phys.q); r.vel.copy(r.phys.vel); },

  // ---------------------------------------------------------------- AI (letí po ideální stopě s fyzikálními limity zatáčení)
  aiPose(r, dt) {
    const c = this.course, M = c.M, a = r.ai, P = r.P;
    const idx = (s) => ((Math.floor(s) % M) + M) % M;
    const at = (s) => { const i = idx(s), j = (i + 1) % M, f = s - Math.floor(s), A = c.pts[i], B = c.pts[j]; return this._v1.set(U.lerp(A.x, B.x, f), U.lerp(A.y, B.y, f), U.lerp(A.z, B.z, f)); };
    this._v1 = this._v1 || new THREE.Vector3(); this._v2 = this._v2 || new THREE.Vector3();
    // křivost dopředu → maximální rychlost zatáčky v = √(g·n·R)
    const look = Math.max(6, a.v * 1.2 / c.ds);
    const h0 = this.heading(c, a.s), h1 = this.heading(c, a.s + look), turn = U.wrapAngle(h1 - h0) / (look * c.ds);
    const nAI = Math.min(P.nLim, 6), R = 1 / Math.max(Math.abs(turn), 1e-4), vTurn = Math.sqrt(AIR_G * nAI * R);
    const vT = Math.min(P.Vrace * a.k * (this.mode === 'menu' ? 0.9 : 1), vTurn);
    a.v += U.clamp(vT - a.v, -9 * dt, 4 * dt);
    a.s += a.v * dt / c.ds; a.sTot += a.v * dt / c.ds;
    // pozice: stopa + boční odchylka (kvůli rozestupům), u bran se srovná na střed
    let gd = 1e9; for (const g of c.gates) { let d = Math.abs(((a.s - g.i) % M + M) % M); d = Math.min(d, M - d); gd = Math.min(gd, d * c.ds); }
    a.ph += dt * 0.3;
    const latT = (a.lat0 || 0) * U.smooth(150, 400, gd) * 0.6 + Math.sin(a.ph) * 4;
    a.lat += (latT - a.lat) * Math.min(1, dt * 0.6);
    const p = at(a.s), tn = this._v2.copy(at(a.s + 2)).sub(at(a.s - 2)).normalize(); const pp = at(a.s);
    const rx = -tn.z, rz = tn.x, rl = Math.hypot(rx, rz) || 1;
    r.pos.set(pp.x + rx / rl * a.lat, pp.y, pp.z + rz / rl * a.lat);
    const gh = this.course.height(r.pos.x, r.pos.z); if (r.pos.y < gh + 12) r.pos.y = gh + 12;
    // náklon podle zatáčky: tan(φ) = v·ω / g
    const tNow = U.wrapAngle(this.heading(c, a.s + 3) - this.heading(c, a.s - 3)) / (6 * c.ds);
    const bankT = Math.atan(a.v * a.v * -tNow / AIR_G);
    a.bank += (bankT - a.bank) * Math.min(1, dt * 3);
    const yaw = Math.atan2(-tn.x, -tn.z), pitch = Math.asin(U.clamp(tn.y, -1, 1));
    r.q.setFromEuler(this._e1 || (this._e1 = new THREE.Euler(0, 0, 0, 'YXZ')).set(pitch + 0.03, yaw, -a.bank, 'YXZ'));
    r.vel.set(-tn.x * a.v, tn.y * a.v, -tn.z * a.v);
    r.aiSt = { da: U.clamp((bankT - a.bank) * 0.6, -0.3, 0.3), de: 0.05 + Math.abs(a.bank) * 0.08, dr: 0, flaps: 0, rpm: P.rpmMax * 0.95, gearPos: P.retract ? 0 : 1 };
  },
  heading(c, s) {
    const M = c.M, i = ((Math.floor(s) % M) + M) % M, j = (i + 4) % M, A = c.pts[i], B = c.pts[j];
    return Math.atan2(-(B.x - A.x), -(B.z - A.z));
  },

  // ---------------------------------------------------------------- brány
  checkGates(r) {
    if (r.done || this.countT > 0) return;
    const c = this.course, G = c.gates.length, gi = r.passes % G, gt = c.gates[gi];
    const p0 = r.prev, p1 = r.pos;
    const d0 = (p0.x - gt.pos.x) * gt.tan.x + (p0.y - gt.pos.y) * gt.tan.y + (p0.z - gt.pos.z) * gt.tan.z;
    const d1 = (p1.x - gt.pos.x) * gt.tan.x + (p1.y - gt.pos.y) * gt.tan.y + (p1.z - gt.pos.z) * gt.tan.z;
    // pylony: náraz = penalizace
    if (gt.type === 'pylon' && r.kind === 'me') {
      const o = c.gateObjs[gi];
      for (const s of [-1, 1]) {
        const px = gt.pos.x + gt.right.x * s * gt.W / 2, pz = gt.pos.z + gt.right.z * s * gt.W / 2;
        if (Math.hypot(p1.x - px, p1.z - pz) < 2.4 + r.P.b * 0.35 && p1.y < gt.top + 1 && !r['hit' + gi + s]) {
          r['hit' + gi + s] = true; this.penalty(r, 3, 'Náraz do pylonu +3 s'); Sfx.pop(); Sfx.burst(0.3, 400, 0.4);
          o.wob = 1; o.wobS = s;
        }
      }
    }
    if (!(d0 < 0 && d1 >= 0)) return;
    const f = d0 / (d0 - d1), x = U.lerp(p0.x, p1.x, f) - gt.pos.x, y = U.lerp(p0.y, p1.y, f) - gt.pos.y, z = U.lerp(p0.z, p1.z, f) - gt.pos.z;
    const lx = x * gt.right.x + y * gt.right.y + z * gt.right.z, ly = x * gt.up.x + y * gt.up.y + z * gt.up.z;
    if (Math.abs(lx) > 260 || Math.abs(ly) > 260) return;          // úplně jinde – nepočítá se, musíš se vrátit
    let clean = gt.type === 'ring' ? Math.hypot(lx, ly) <= gt.R - 0.6 : Math.abs(lx) <= gt.W / 2 - 1 && (U.lerp(p0.y, p1.y, f) <= gt.top);
    r.passes++; r.lastGate = gi;
    if (r.kind !== 'me') { if (r.passes >= this.totalPasses()) this.finish(r); return; }
    if (!clean) this.penalty(r, 5, 'Minul jsi bránu +5 s');
    else {
      if (gt.level && Math.abs(r.phys.bank) > 0.42) this.penalty(r, 2, 'Nesprávný průlet – křídla do vodorovna! +2 s');
      else { Sfx.coin(); this.flashGate(gi); }
    }
    for (const s of [-1, 1]) delete r['hit' + gi + s];
    const lapNow = Math.floor((r.passes - 1) / G) + 1;
    if (r.passes >= this.totalPasses()) this.finish(r);
    else if (gi === 0 && r.passes > 1) { this.msg(`Kolo ${lapNow}/${this.laps} · ${this.fmt(this.clock)}${lapNow === this.laps ? ' – POSLEDNÍ KOLO!' : ''}`, 2.5); Sfx.tone(880, 0.2, 0.2, 'triangle', 1320); }
  },
  penalty(r, s, t) { r.pen += s; if (r.kind === 'me') { this.msg(t, 2, 'bad'); Sfx.tone(160, 0.35, 0.3, 'square'); } },
  flashGate(gi) { const o = this.course.gateObjs[gi]; if (o) o.flash = 1; },
  finish(r) {
    if (r.done) return;
    r.done = true; r.time = this.clock; r.total = r.time + r.pen;
    if (r.kind === 'me') {
      this.msg(`CÍL! ${this.fmt(r.total)}${r.pen ? ` (penalizace ${r.pen} s)` : ''}`, 4, 'good');
      Sfx.tone(1046, 0.4, 0.25, 'triangle');
      if (this.net) Net.send({ t: 'afin', time: r.time, pen: r.pen });
      this.doneT = 0;
    }
  },
  // po havárii / resetu: zpět k poslední proleténé bráně ve stejném směru
  respawn(r, manual) {
    const c = this.course, ph = r.phys;
    if (this.kind === 'free') { this.placeStart(r, 0); r.crashT = 0; r.model.root.visible = true; this.camQ = null; return; }
    const G = c.gates.length;
    let x, y, z, tan;
    if (r.passes === 0) { this.placeStart(r, 0); r.model.root.visible = true; r.crashT = 0; this.camQ = null; return; }
    const gt = c.gates[(r.passes - 1) % G];
    tan = gt.tan; x = gt.pos.x + tan.x * 30; z = gt.pos.z + tan.z * 30; y = Math.max(gt.type === 'ring' ? gt.pos.y : (gt.gnd + gt.top) / 2 + 2, c.height(x, z) + 20);
    ph.place(x, y, z, Math.atan2(-tan.x, -tan.z), r.P.Vrace * 0.8, Math.asin(U.clamp(tan.y, -0.3, 0.3)));
    ph.assist = this.sv.assist; this.sync(r); r.prev.copy(r.pos);
    r.crashT = 0; r.model.root.visible = true; this.camQ = null;
    if (manual) this.msg('Zpět na poslední bránu', 1.5);
  },

  // ---------------------------------------------------------------- multiplayer
  startNet(seed, slots, mode) {
    if (Game.playing) { location.reload(); return; }
    if (Drag.active) Drag.exit(); if (Rally.active) Rally.exit();
    this.load();
    this.net = true; this.netEnd = false;
    const ti = U.clamp(+(String(mode).split(':')[1]) || 0, 0, AIR_TRACKS.length - 1);
    $('menu').style.display = 'none'; $('lobby').style.display = 'none';
    this.ensureScene(ti); this.ti = ti;
    this.start('net', slots);
    Net.send({ t: 'aplane', pl: this.sv.plane, pt: this.sv.paint });
    for (const d of this.pending || []) this.onNet(d);
    this.pending = [];
  },
  onNet(d) {
    if (!this.active || this.mode !== 'fly' || !this.net) { (this.pending = this.pending || []).push(d); return; }
    const r = this.racers.find(q => q.kind === 'net' && q.slot === d.from); if (!r) return;
    if (d.t === 'aplane') {
      const pl = PLANES[d.pl] ? d.pl : 'cmelak', pt = AIR_PAINTS[U.clamp(d.pt | 0, 0, AIR_PAINTS.length - 1)];
      this.scene.remove(r.model.root);
      r.plane = pl; r.P = PLANES[pl]; r.model = PlaneModel.build(pl, pt === null ? null : pt); this.scene.add(r.model.root); r.model.root.visible = !!r.got;
    } else if (d.t === 'as') {
      if (!r.sm) r.sm = new U.NetSmooth(['x', 'y', 'z', 'yw', 'pt', 'rl'], ['yw', 'pt', 'rl']);
      if (!r.sm.push(d)) return;
      r.got = true; r.net = d; r.passes = Math.max(r.passes, d.p | 0); r.frac = d.fr || 0;
      if (d.cr && !r.wasCr) { this.fx.boom(r.pos, r.vel, r.model); r.model.root.visible = false; }
      r.wasCr = !!d.cr;
    } else if (d.t === 'afin') { r.done = true; r.time = d.time; r.pen = d.pen; r.total = d.time + d.pen; this.msg(`${this.esc(r.nick)} je v cíli: ${this.fmt(r.total)}`, 2.5); }
  },
  netLeft(slot) {
    for (const r of this.racers || []) if (r.kind === 'net' && (slot < 0 || r.slot === slot) && !r.done) { r.left = true; r.done = true; r.total = Infinity; this.msg(`${this.esc(r.nick)} se odpojil`, 2.5, 'bad'); if (r.model) r.model.root.visible = false; }
  },
  updateRemote(r, dt) {
    if (!r.sm) return;
    const s = r.sm.update(dt); if (!s) return;
    r.prev.copy(r.pos);
    r.pos.set(s.x, s.y, s.z);
    r.q.setFromEuler((this._e2 || (this._e2 = new THREE.Euler(0, 0, 0, 'YXZ'))).set(s.pt, s.yw, s.rl, 'YXZ'));
    if (dt > 0) r.vel.copy(r.pos).sub(r.prev).divideScalar(dt);
    const d = r.net;
    r.model.root.visible = !d.cr && !r.left;
    r.aiSt = { da: d.da || 0, de: d.de || 0, dr: d.dr || 0, flaps: d.fl | 0, rpm: d.rpm || 2000, gearPos: d.gp === undefined ? 1 : d.gp, comp: [0, 0, 0] };
    r.smokeOn = !!d.sm;
  },

  // ---------------------------------------------------------------- hlavní smyčka
  frame(dt) {
    const rd = Game.renderer;
    if (this.mode === 'menu') {
      const r = this.demoR; this.aiPose(r, dt); this.poseModel(r, dt);
      this.camYaw += dt * 0.12;
      const fw = this._v3 || (this._v3 = new THREE.Vector3()); fw.set(0, 0, -1).applyQuaternion(r.q);
      const cam = this.cam, a = this.camYaw, d = 15;
      cam.position.set(r.pos.x + Math.sin(a) * d, r.pos.y + 3 + Math.sin(a * 0.7) * 2, r.pos.z + Math.cos(a) * d);
      cam.up.set(0, 1, 0); cam.lookAt(r.pos.x + fw.x * 2, r.pos.y + 1.2, r.pos.z + fw.z * 2);
      this.renderScene(rd, r.pos, dt);
      return;
    }
    if (this.mode !== 'fly') return;
    if (this.paused) { this.renderScene(rd, this.me.pos, 0); return; }
    this.clock += this.countT > 0 ? 0 : dt;
    const me = this.me, ph = me.phys;
    // ---- odpočet letmého startu ----
    if (this.countT > 0) {
      this.countT -= dt; const n = Math.ceil(this.countT);
      if (n !== this._cd && n <= 3) { this._cd = n; if (n > 0) { this.msg(String(n), 0.9, 'big'); Sfx.tone(660, 0.15, 0.3, 'square'); } }
      if (this.countT <= 0) { this.msg('LEŤ!', 1.2, 'big'); Sfx.tone(1320, 0.4, 0.35, 'square'); this.clock = 0; }
    }
    // ---- vstup ----
    this.input(dt);
    // ---- fyzika hráče ----
    me.prev.copy(me.pos);
    if (me.crashT > 0) {
      me.crashT -= dt; if (me.crashT <= 0) this.respawn(me);
    } else if (this.countT > 0) {
      // letmý start: drž letadlo na místě (rychlost zůstává)
      ph.thr = Math.max(ph.thr, 0.85);
      if (this.kind !== 'free') this.placeStart(me, this.racers.slice().sort((a, b) => a.slot - b.slot).indexOf(me));
    } else {
      const n = Math.min(12, Math.ceil(dt / 0.004)), h = dt / n;
      const inp = { pitch: this.stick.p, roll: this.stick.r, yaw: this.stick.y, brake: this.brakeIn };
      for (let i = 0; i < n; i++) {
        const env = this.env(ph.pos.x, ph.pos.z);
        env.agl = ph.pos.y - Math.max(env.gnd, env.water === null ? -1e9 : env.water);
        ph.gearPos = U.clamp(ph.gearPos + (ph.gearDown ? h : -h) / 3.5, 0, 1);
        ph.step(h, inp, env);
        if (ph.crashed) break;
      }
      // mimo mapu
      if (Math.abs(ph.pos.x) > AirCourse.E - 40 || Math.abs(ph.pos.z) > AirCourse.E - 40) ph.crash('Vyletěl jsi z prostoru závodu', 'out');
      if (ph.pos.y > 2500) ph.crash('Moc vysoko – motor se dusí', 'out');
      // stromy, domy, hangáry, loďky: střed letadla, konce křídel a nos
      if (!ph.crashed && this.course.obst) {
        const v = this._v6 || (this._v6 = new THREE.Vector3()), m = me.model;
        for (const [ox, oz] of [[0, 0], [m.half * 0.95, 0], [-m.half * 0.95, 0], [0, -m.L * 0.45]]) {
          v.set(ox, 0, oz).applyQuaternion(ph.q).add(ph.pos);
          if (AirCourse.obstAt(this.course, v.x, v.y, v.z)) { ph.crash(ox ? 'Zachytil jsi křídlem o překážku' : 'Náraz do překážky', 'ground'); break; }
        }
      }
      this.sync(me);
      if (ph.crashed) this.onCrash(me);
      this.checkGates(me);
      this.landing(ph, dt);
      this.gfx(ph, dt);
    }
    // ---- AI a ostatní hráči ----
    for (const r of this.racers) {
      if (r.kind === 'ai') {
        if (this.countT > 0) this.placeStart(r, this.racers.slice().sort((a, b) => a.slot - b.slot).indexOf(r));
        else { r.prev.copy(r.pos); this.aiPose(r, dt); this.aiPasses(r); }
      } else if (r.kind === 'net') this.updateRemote(r, dt);
      this.poseModel(r, dt);
      // kouř
      const on = r.kind === 'me' ? this.sv.smoke && !r.crashT && this.kind !== 'free' || (r.kind === 'me' && this.sv.smoke && this.kind === 'free' && !ph.onGround) : r.kind === 'net' ? r.smokeOn : this.sv.smoke;
      r.smoke.update(dt, on && r.model.root.visible && this.countT <= 0, r.pos, r.q, r.model.L);
      if (r.tag) { r.tag.visible = r.model.root.visible; r.tag.position.copy(r.pos).y += 6; const dd = this.cam.position.distanceTo(r.pos); r.tag.scale.set(dd * 0.06 + 4, (dd * 0.06 + 4) * 0.19, 1); }
    }
    // gate animace
    for (const o of this.course.gateObjs) {
      if (o.wob > 0) { o.wob = Math.max(0, o.wob - dt * 0.8); for (const pg of o.pyl || []) pg.rotation.z = Math.sin(o.wob * 18) * o.wob * 0.25; }
      const nextI = me.passes % this.course.gates.length, isNext = o.gt.idx === nextI && !me.done && this.kind !== 'free';
      const fl = o.flash > 0 ? (o.flash = Math.max(0, o.flash - dt * 2)) : 0;
      const em = isNext ? 0.35 + 0.35 * Math.sin(this.clock * 6) : fl * 0.8;
      for (const m of o.mats) m.emissive.setRGB(em, em * (isNext ? 0.75 : 1), isNext ? 0 : em);
    }
    // ---- síť ----
    if (this.net) this.netSend(dt);
    // ---- konec závodu ----
    this.checkEnd(dt);
    // ---- kamera, efekty, HUD, zvuk ----
    this.camera(dt);
    this.fx.update(dt, this.course);
    this.hud(dt);
    this.snd(dt);
    this.renderScene(rd, me.pos, dt);
  },
  aiPasses(r) {
    if (this.kind === 'free') return;
    while (!r.done && r.ai.sTot >= this.gateS(r.passes)) {
      r.passes++;
      if (r.passes >= this.totalPasses()) { r.done = true; r.time = this.clock; r.total = r.time; }
    }
  },
  onCrash(me) {
    const ph = me.phys;
    me.crashT = 3.2; this.fx.boom(me.pos, ph.vel, me.model); me.model.root.visible = false;
    this.msg('💥 ' + ph.crashed.why, 3, 'bad'); Sfx.crash(1); if (Pad.rumble) Pad.rumble(1);
    this.crashes = (this.crashes || 0) + 1;
  },
  // dosednutí: změř svislou rychlost (pro radost z pěkného přistání)
  landing(ph, dt) {
    if (!this._air && ph.onGround) return;
    if (!ph.onGround) { this._air = true; this._vy = ph.vel.y; this._airT = (this._airT || 0) + dt; return; }
    if (this._air && this._airT > 3) {
      const v = -this._vy;
      this.msg(v < 0.8 ? `Přistání jak na peřinu (${v.toFixed(1)} m/s) 👌` : v < 1.8 ? `Pěkné přistání (${v.toFixed(1)} m/s)` : v < 3 ? `Tvrdší dosednutí (${v.toFixed(1)} m/s)` : `Au! Podvozek to skoro nevydržel (${v.toFixed(1)} m/s)`, 3, v < 1.8 ? 'good' : '');
    }
    this._air = false; this._airT = 0;
  },
  // G-efekty: krev odtéká z hlavy (zatmění) při velkém kladném G, při záporném zčervenání
  gfx(ph, dt) {
    const n = ph.n;
    this.maxG = Math.max(this.maxG * Math.exp(-dt * 0.05), n);
    if (n > 5.5) this.gStress += 0.085 * Math.pow(n - 5.5, 1.5) * dt; else this.gStress -= dt * (n < 3 ? 0.45 : 0.15);
    this.gStress = U.clamp(this.gStress, 0, 1.3);
    if (n < -2) this.red += (-n - 2) * 0.25 * dt; else this.red -= dt * 0.5;
    this.red = U.clamp(this.red, 0, 1);
  },
  input(dt) {
    const K = Game.keys, kd = (a) => Settings.kdown(K, a), me = this.me, ph = me.phys;
    let kp = (kd('back') || K.ArrowDown ? 1 : 0) - (kd('forward') || K.ArrowUp ? 1 : 0);
    let kr = (kd('right') || K.ArrowRight ? 1 : 0) - (kd('left') || K.ArrowLeft ? 1 : 0);
    let ky = (K.KeyE ? 1 : 0) - (K.KeyQ ? 1 : 0);
    let thrD = (K.ShiftLeft || K.ShiftRight ? 1 : 0) - (K.ControlLeft || K.ControlRight ? 1 : 0);
    this.brakeIn = K.Space || K.KeyB ? 1 : 0;
    // gamepad (standardní rozložení): levá páčka = knipl, spouště = plyn, bumpery = směrovka
    let gp = null; try { const gps = navigator.getGamepads ? navigator.getGamepads() : []; for (const g of gps) if (g && g.mapping === 'standard') { gp = g; break; } } catch (e) { /* nic */ }
    let ap = 0, ar = 0, ay = 0;
    if (gp) {
      const dz = (v) => Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88;
      ar = dz(gp.axes[0] || 0); ap = dz(gp.axes[1] || 0); ay = dz(gp.axes[2] || 0) * 0.5 + ((gp.buttons[5] && gp.buttons[5].pressed ? 1 : 0) - (gp.buttons[4] && gp.buttons[4].pressed ? 1 : 0));
      const rt = gp.buttons[7] ? gp.buttons[7].value : 0, lt = gp.buttons[6] ? gp.buttons[6].value : 0; thrD += rt - lt;
      if (gp.buttons[0] && gp.buttons[0].pressed) this.brakeIn = 1;
    }
    // myš jako knipl: pomalu se vrací do středu
    this.mIdle = (this.mIdle || 0) + dt;
    if (this.sv.yoke && this.mIdle > 0.25) { const f = Math.exp(-dt * 1.6); this.mStick.x *= f; this.mStick.y *= f; }
    if (!this.sv.yoke) { this.mStick.x = 0; this.mStick.y = 0; }
    const ramp = (cur, tgt, up, down) => { const r = Math.abs(tgt) > Math.abs(cur) || Math.sign(tgt) !== Math.sign(cur) ? up : down; return cur + U.clamp(tgt - cur, -r * dt, r * dt); };
    const S = this.stick;
    const tp = U.clamp(kp + ap + this.mStick.y, -1, 1), tr = U.clamp(kr + ar + this.mStick.x, -1, 1), ty = U.clamp(ky + ay, -1, 1);
    S.p = (ap || this.mStick.y) && !kp ? tp : ramp(S.p, tp, 2.6, 5);
    S.r = (ar || this.mStick.x) && !kr ? tr : ramp(S.r, tr, 4.5, 7);
    S.y = ramp(S.y, ty, 3, 5);
    // zatmění: ruce slábnou
    if (this.gStress > 1) S.p *= 0.4;
    if (thrD && ph) ph.thr = U.clamp(ph.thr + thrD * 0.6 * dt, 0, 1);
    // volné rozhlížení se vrací
    this.lookIdle += dt;
    if (this.lookIdle > 1.4) { const f = Math.exp(-dt * 3); this.lookYaw *= f; this.lookPitch *= f; }
  },
  poseModel(r, dt) {
    const m = r.model; m.root.position.copy(r.pos); m.root.quaternion.copy(r.q);
    const st = r.phys || r.aiSt; if (!st) return;
    PlaneModel.pose(m, st, dt);
    const inCk = r.kind === 'me' && this.sv.cam === 'cockpit';
    if (m.head) m.head.visible = !inCk;
    if (m.torso) m.torso.visible = !inCk;
    if (m.glass) m.glass.visible = !inCk;
    if (m.deck) m.deck.visible = !inCk;   // zevnitř by plochy skla jen rušily
    if (m.cockpit) {
      m.cockpit.visible = inCk;
      if (inCk) {
        AirCockpit.build(m);
        AirCockpit.pose(m, { p: this.stick.p, r: this.stick.r, y: this.stick.y, thr: r.phys ? r.phys.thr : 0 });
      }
    }
  },
  camera(dt) {
    const me = this.me, cam = this.cam, q = me.q, P = me.P;
    const camMode = this.sv.cam, scale = me.model.L / 7;
    cam.fov = Settings.s.fov || 70;
    if (!this.camQ) { this.camQ = q.clone(); this.camP = null; }
    const look = this._lq || (this._lq = new THREE.Quaternion()), e = this._le || (this._le = new THREE.Euler(0, 0, 0, 'YXZ'));
    e.set(this.lookPitch, this.lookYaw, 0, 'YXZ'); look.setFromEuler(e);
    if (camMode === 'cockpit') {
      const eye = this._eye || (this._eye = new THREE.Vector3());
      eye.copy(me.model.eye).applyQuaternion(q).add(me.pos);
      // hlava se pod přetížením lehce propadá, při pádu třese
      const shake = (me.phys ? me.phys.stall * 0.012 + Math.min(0.02, me.phys.V * me.phys.V * 2e-7) : 0);
      cam.position.copy(eye).add(this._v4 = (this._v4 || new THREE.Vector3()).set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake - (me.phys ? U.clamp((me.phys.n - 1) * 0.008, -0.03, 0.05) : 0), 0).applyQuaternion(q));
      cam.quaternion.copy(q).multiply(look);
      // pohled pilota: lehce dolů a aspoň 70° zorné pole, aby byla vidět celá přístrojová deska i krajina před nosem
      cam.quaternion.multiply(this._ckTilt || (this._ckTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -7.5 * Math.PI / 180)));
      cam.fov = Math.max(cam.fov, 72);
      cam.near = 0.05;
    } else {
      // sledovací kamera: plynule dohání orientaci letadla (náklon trochu méně), hledí kus před letadlo
      const k = camMode === 'wide' ? 2.2 : 4.5;
      this.camQ.slerp(q, Math.min(1, dt * k));
      const off = this._v5 || (this._v5 = new THREE.Vector3());
      const dist = (camMode === 'wide' ? 32 : 13) * scale, up = (camMode === 'wide' ? 7 : 3.2) * scale;
      off.set(0, up, dist).applyQuaternion(look).applyQuaternion(this.camQ);
      cam.position.copy(me.pos).add(off);
      // kamera nesmí pod terén
      const gh = this.course.height(cam.position.x, cam.position.z) + 1.5; if (cam.position.y < gh) cam.position.y = gh;
      const upv = this._v6 || (this._v6 = new THREE.Vector3()); upv.set(0, 1, 0).applyQuaternion(this.camQ);
      cam.up.copy(upv);
      const tgt = this._v7 || (this._v7 = new THREE.Vector3()); tgt.set(0, up * 0.35, -20 * scale).applyQuaternion(look).applyQuaternion(this.camQ).add(me.pos);
      cam.lookAt(tgt);
      cam.near = 0.3;
      if (me.crashT > 0) { cam.lookAt(me.pos); }
    }
    cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
  },
  renderScene(rd, focus, dt) {
    U.snapSun(this.sun, focus, this.sunDir, 400);
    if (this.course && this.course.sky) this.course.sky.position.copy(this.cam.position);
    if (this.course && this.course.waterU) this.course.waterU.uT.value = performance.now() / 1000;
    rd.shadowMap.needsUpdate = true;
    rd.render(this.scene, this.cam);
  },
  netSend(dt) {
    this.sendT -= dt; if (this.sendT > 0) return; this.sendT = 1 / 20;
    const me = this.me, ph = me.phys, e = ph.euler();
    Net.send({ t: 'as', x: +me.pos.x.toFixed(2), y: +me.pos.y.toFixed(2), z: +me.pos.z.toFixed(2), yw: +e.y.toFixed(3), pt: +e.x.toFixed(3), rl: +e.z.toFixed(3),
      da: +ph.da.toFixed(2), de: +ph.de.toFixed(2), dr: +ph.dr.toFixed(2), fl: ph.flaps, rpm: Math.round(ph.rpm), gp: +ph.gearPos.toFixed(2),
      p: me.passes, fr: +this.frac(me).toFixed(3), cr: me.crashT > 0 ? 1 : 0, sm: this.sv.smoke ? 1 : 0 });
  },
  frac(r) {
    const c = this.course, G = c.gates.length, gt = c.gates[r.passes % G], pg = r.passes > 0 ? c.gates[(r.passes - 1) % G] : null;
    const dn = r.pos.distanceTo(gt.pos), seg = pg ? pg.pos.distanceTo(gt.pos) : 400;
    return U.clamp(1 - dn / Math.max(seg, 1), 0, 0.99);
  },
  standings() {
    return this.racers.slice().sort((a, b) => {
      if (a.done && b.done) return (a.total || 1e9) - (b.total || 1e9);
      if (a.done !== b.done) return a.done ? -1 : 1;
      const pa = a.passes + (a.kind === 'net' ? a.frac || 0 : this.frac(a)), pb = b.passes + (b.kind === 'net' ? b.frac || 0 : this.frac(b));
      return pb - pa;
    });
  },
  checkEnd(dt) {
    if (this.kind === 'free' || this.done) return;
    const me = this.me;
    if (!me.done) return;
    this.doneT += dt;
    const others = this.racers.filter(r => r !== me);
    const allDone = others.every(r => r.done);
    if (allDone || this.doneT > (this.net ? 60 : 25)) {
      for (const r of others) if (!r.done) { r.done = true; r.dnf = true; r.total = Infinity; }
      this.done = true;
      setTimeout(() => this.results(), 1500);
    }
  },
  results() {
    const me = this.me, st = this.standings(), sv = this.sv, key = this.course.T.id + '_' + sv.plane;
    const old = sv.pb[key], pb = !old || me.total < old;
    if (pb && this.kind !== 'free') { sv.pb[key] = me.total; this.store(); }
    const pos = st.indexOf(me) + 1;
    if (this.net) Account.mp(pos === 1);
    const rows = st.map(r => ({ me: r === me, col: r.col, cells: [this.esc(r.nick) + (r.kind === 'ai' ? ' 🤖' : ''), r.dnf || r.left ? 'nedoletěl' : this.fmt(r.total), r.pen ? `+${r.pen} s` : '—', PLANES[r.plane].name] }));
    const win = this.kind === 'solo' ? pb : pos === 1;
    if (document.exitPointerLock) document.exitPointerLock();
    this.sndOff();
    Game.showResults({ win, title: this.kind === 'solo' ? (pb ? 'NOVÝ REKORD!' : 'CÍL') : pos === 1 ? 'VYHRÁL JSI!' : `${pos}. MÍSTO`,
      text: `${this.course.T.name} · ${PLANES[sv.plane].name} · ${this.laps} kola${pb && old ? ` · zlepšení o ${(old - me.total).toFixed(2)} s` : ''}${!pb && old ? ` · rekord ${this.fmt(old)}` : ''}${this.crashes ? ` · havárie: ${this.crashes}` : ''}`,
      cols: ['Pilot', 'Čas', 'Penalizace', 'Letadlo'], rows,
      buttons: this.net ? [{ label: '✈ Zpět do hangáru', fn: () => { Net.leave(); this.net = false; this.enter(); } }]
        : [{ label: '🔁 Letět znovu', fn: () => { this.crashes = 0; this.start(this.kind); } }, { label: '✈ Hangár', alt: true, fn: () => { this.crashes = 0; this.enter(); } }] });
  },

  // ---------------------------------------------------------------- HUD
  msg(t, dur, cls) { const e = $('ahMsg'); e.textContent = t; e.className = cls || ''; e.style.opacity = 1; clearTimeout(this._mt); this._mt = setTimeout(() => { e.style.opacity = 0; }, (dur || 2) * 1000); },
  hud(dt) {
    const me = this.me, ph = me.phys, c = this.course, G = c.gates.length;
    // zatmění / zčervenání
    const v = $('ahVig'), gs = this.gStress, rd = this.red;
    if (gs > 0.05 || rd > 0.05) {
      v.style.display = 'block';
      const a = U.smooth(0.05, 1, gs), hole = U.lerp(70, 0, U.smooth(0.3, 1.15, gs));
      v.style.background = rd > gs ? `radial-gradient(circle, rgba(160,0,0,${rd * 0.25}) ${U.lerp(70, 10, rd)}%, rgba(140,0,0,${rd * 0.85}) 100%)` : `radial-gradient(circle, rgba(0,0,0,0) ${hole}%, rgba(0,0,0,${a}) ${hole + 30}%)`;
      if (gs > 1.05) v.style.background = 'rgba(0,0,0,.94)';
    } else v.style.display = 'none';
    // značka další brány
    const mk = $('ahMark');
    if (this.kind !== 'free' && !me.done) {
      const gt = c.gates[me.passes % G], p = this._v8 || (this._v8 = new THREE.Vector3());
      p.copy(gt.pos).project(this.cam);
      const behind = p.z > 1, W = innerWidth, H = innerHeight;
      let x = (p.x * 0.5 + 0.5) * W, y = (-p.y * 0.5 + 0.5) * H;
      if (behind) { x = W - x; y = H - y; }
      const off = behind || x < 30 || x > W - 30 || y < 30 || y > H - 30;
      if (off) { const cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy, k = Math.min((W / 2 - 40) / Math.abs(dx || 1), (H / 2 - 40) / Math.abs(dy || 1)); x = cx + dx * k; y = cy + dy * k; }
      mk.style.display = 'block'; mk.style.left = x + 'px'; mk.style.top = y + 'px';
      mk.className = off ? 'off' : '';
      mk.innerHTML = `<i style="transform:rotate(${off ? Math.atan2(y - H / 2, x - W / 2) * 180 / Math.PI + 90 : 0}deg)">${off ? '▲' : '◇'}</i><b>${Math.round(me.pos.distanceTo(gt.pos))} m${gt.level ? ' · ⟷' : ''}</b>`;
    } else mk.style.display = 'none';
    // varování
    const warn = $('ahWarn');
    let w = '';
    if (ph && !me.crashT) {
      const vs = ph.vel.y, agl = ph.pos.y - Math.max(c.height(ph.pos.x, ph.pos.z), c.water === null ? -1e9 : c.water);
      if (ph.stall > 0.25 || (ph.alpha > ph.P.aStall - 0.025 && ph.V > 8 && !ph.onGround)) w = 'PÁD! POVOL KNIPL';
      else if (!ph.onGround && vs < -8 && agl / -vs < 3.2) w = 'TERÉN! VYTÁHNI!';
      else if (ph.n > ph.P.nMax * 0.95) w = 'PŘETÍŽENÍ!';
      else if (ph.V < this.vstall(me.plane) * 1.15 && !ph.onGround && ph.V > 5) w = 'MALÁ RYCHLOST';
    }
    warn.textContent = w; warn.style.display = w ? 'block' : 'none';
    this.hudT -= dt; if (this.hudT > 0) return; this.hudT = 1 / 15;
    // horní lišta
    if (this.kind === 'free') $('ahTop').innerHTML = `<b>VOLNÝ LET</b> · ${c.T.name}${me.crashT > 0 ? '' : ''} <span class="dim">· R = zpět na dráhu</span>`;
    else {
      const lap = Math.min(this.laps, Math.max(1, Math.floor(Math.max(0, me.passes - 1) / G) + 1)), st = this.standings(), pos = st.indexOf(me) + 1;
      const pb = this.sv.pb[c.T.id + '_' + this.sv.plane];
      $('ahTop').innerHTML = `<span class="big">${this.fmt(me.done ? me.time : this.clock)}</span>${me.pen ? `<span class="bad"> +${me.pen} s</span>` : ''} · Kolo <b>${lap}/${this.laps}</b> · Brána <b>${Math.min(me.passes, this.totalPasses())}/${this.totalPasses()}</b>${this.racers.length > 1 ? ` · <b>${pos}.</b> z ${this.racers.length}` : ''}${pb ? ` <span class="dim">· rekord ${this.fmt(pb)}</span>` : ''}`;
      $('ahBoard').innerHTML = this.racers.length > 1 ? st.map((r, i) => `<div class="${r === me ? 'me' : ''}"><span>${i + 1}.</span> <b style="color:${r.col}">${this.esc(r.nick)}</b> ${r.done ? (r.dnf || r.left ? '—' : '🏁 ' + this.fmt(r.total)) : ''}</div>`).join('') : '';
    }
    $('ahInst').style.opacity = this.sv.cam === 'cockpit' ? '0' : '1';
    if (ph) {
      if (this.sv.cam === 'cockpit') {
        // budíky v kokpitu: 30× za sekundu
        this._ckT = (this._ckT || 0) - dt;
        if (this._ckT <= 0 && this.me.model.ck) {
          this._ckT = 1 / 30; const me = this.me, c = this.course;
          AirCockpit.draw(me.model, ph, { time: this.fmt(Math.max(0, me.done ? me.time : this.clock || 0)), gate: this.kind === 'free' ? 'VOLNÝ LET' : `BRÁNA ${Math.min(me.passes, this.totalPasses())}/${this.totalPasses()}`, agl: ph.pos.y - Math.max(c.height(ph.pos.x, ph.pos.z), c.water === null ? -1e9 : c.water), smoke: this.sv.smoke });
        }
      } else this.drawInst(ph);
    }
    this.drawMap();
  },
  drawInst(ph) {
    const cv = $('ahInst'), g = cv.getContext('2d'), W = cv.width, H = cv.height, P = ph.P;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(8,14,22,.62)'; g.beginPath(); g.roundRect ? g.roundRect(0, 0, W, H, 14) : g.rect(0, 0, W, H); g.fill();
    const e = ph.euler(), pitch = e.x, bank = ph.bank || 0;
    // umělý horizont
    const cx = W / 2, cy = 112, R = 92;
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    g.translate(cx, cy); g.rotate(-bank);
    const ppd = R / 30, off = pitch * 180 / Math.PI * ppd;
    g.fillStyle = '#3a8ad8'; g.fillRect(-R * 2, -R * 3 + off, R * 4, R * 3);
    g.fillStyle = '#8a5a2a'; g.fillRect(-R * 2, off, R * 4, R * 3);
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-R * 2, off); g.lineTo(R * 2, off); g.stroke();
    g.font = '11px Arial'; g.fillStyle = '#fff'; g.textAlign = 'left';
    for (let d = -60; d <= 60; d += 10) { if (!d) continue; const y = off - d * ppd, l = d % 20 ? 14 : 26; g.beginPath(); g.moveTo(-l, y); g.lineTo(l, y); g.stroke(); if (!(d % 20)) g.fillText(Math.abs(d), l + 4, y + 4); }
    g.restore();
    // pevný symbol letadla + stupnice náklonu
    g.strokeStyle = '#ffd040'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - 46, cy); g.lineTo(cx - 14, cy); g.lineTo(cx - 6, cy + 8); g.moveTo(cx + 46, cy); g.lineTo(cx + 14, cy); g.lineTo(cx + 6, cy + 8); g.stroke();
    g.fillStyle = '#ffd040'; g.fillRect(cx - 2, cy - 2, 4, 4);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2;
    for (const a of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) { const r = a * Math.PI / 180 - Math.PI / 2; g.beginPath(); g.moveTo(cx + Math.cos(r) * (R - 2), cy + Math.sin(r) * (R - 2)); g.lineTo(cx + Math.cos(r) * (R - (a % 30 ? 8 : 14)), cy + Math.sin(r) * (R - (a % 30 ? 8 : 14))); g.stroke(); }
    const br = -bank - Math.PI / 2; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx + Math.cos(br) * (R - 16), cy + Math.sin(br) * (R - 16)); g.lineTo(cx + Math.cos(br + 0.07) * (R - 28), cy + Math.sin(br + 0.07) * (R - 28)); g.lineTo(cx + Math.cos(br - 0.07) * (R - 28), cy + Math.sin(br - 0.07) * (R - 28)); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    // kulička skluzu
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(cx - 40, cy + R + 4, 80, 12); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + U.clamp(ph.beta * 180, -34, 34), cy + R + 10, 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#000'; g.beginPath(); g.moveTo(cx - 7, cy + R + 4); g.lineTo(cx - 7, cy + R + 16); g.moveTo(cx + 7, cy + R + 4); g.lineTo(cx + 7, cy + R + 16); g.stroke();
    // rychlost (vlevo) a výška (vpravo)
    const kmh = ph.V * 3.6, vs = this.vstall(this.me.plane) * 3.6;
    const box = (x, label, val, unit, col, sub) => {
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x, 40, 120, 84);
      g.fillStyle = '#9ab'; g.font = '12px Arial'; g.textAlign = 'center'; g.fillText(label, x + 60, 56);
      g.fillStyle = col; g.font = 'bold 34px Arial'; g.fillText(val, x + 60, 94);
      g.fillStyle = '#cde'; g.font = '13px Arial'; g.fillText(unit, x + 60, 112);
      if (sub) { g.fillStyle = '#cde'; g.font = '13px Arial'; g.fillText(sub, x + 60, 142); }
    };
    const agl = ph.pos.y - Math.max(this.course.height(ph.pos.x, ph.pos.z), this.course.water === null ? -1e9 : this.course.water);
    box(14, 'RYCHLOST', Math.round(kmh), 'km/h', kmh < vs * 1.15 ? '#ff5a4a' : kmh > this.vmax(this.me.plane) * 3.6 * 1.25 ? '#ffb347' : '#fff', `max ${Math.round(this.vmax(this.me.plane) * 3.6)}`);
    box(W - 134, 'VÝŠKA', Math.round(ph.pos.y), 'm n. m.', '#fff', `nad zemí ${Math.round(Math.max(0, agl))} m`);
    // variometr
    const vsi = ph.vel.y; g.fillStyle = vsi > 0.5 ? '#8fe38a' : vsi < -0.5 ? '#ffb347' : '#cde'; g.font = 'bold 16px Arial'; g.textAlign = 'center';
    g.fillText(`${vsi > 0 ? '▲' : vsi < 0 ? '▼' : ''} ${Math.abs(vsi).toFixed(1)} m/s`, W - 74, 168);
    // přetížení
    const n = ph.n; g.fillStyle = n > P.nMax * 0.85 || n < -2.5 ? '#ff5a4a' : n > P.nLim * 0.8 ? '#ffb347' : '#fff';
    g.fillText(`${n.toFixed(1)} G`, 74, 168); g.fillStyle = '#9ab'; g.font = '12px Arial'; g.fillText(`max ${this.maxG.toFixed(1)}`, 74, 184);
    // plyn, otáčky, klapky, podvozek, úhel náběhu
    const by = H - 30;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(14, by, 120, 14); g.fillStyle = '#ffb347'; g.fillRect(14, by, 120 * ph.thr, 14);
    g.fillStyle = '#fff'; g.font = '12px Arial'; g.textAlign = 'left'; g.fillText(`PLYN ${Math.round(ph.thr * 100)} % · ${Math.round(ph.rpm)} ot/min`, 14, by - 4);
    g.textAlign = 'right'; g.fillText(`${P.flapCL.length > 1 ? 'KLAPKY ' + ['0', '1', '2'][ph.flaps] : ''}${P.retract ? ' · PODVOZEK ' + (ph.gearPos > 0.98 ? 'DOLE' : ph.gearPos < 0.02 ? 'NAHOŘE' : '…') : ''}${ph.brake ? ' · BRZDY' : ''}`, W - 14, by - 4);
    const aRatio = U.clamp(ph.alpha / P.aStall, -0.4, 1.3);
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(W - 134, by, 120, 14); g.fillStyle = '#c03020'; g.fillRect(W - 134 + 120 * (0.95 / 1.7 + 0.4 / 1.7), by, 120 * (0.35 / 1.7), 14);
    g.fillStyle = aRatio > 0.92 ? '#ff5a4a' : '#8fe38a'; g.fillRect(W - 134 + 120 * (aRatio + 0.4) / 1.7 - 2, by - 2, 4, 18);
    g.fillStyle = '#9ab'; g.textAlign = 'center'; g.fillText('úhel náběhu', W - 74, by + 26);
    // knipl (myš / pozice)
    if (this.sv.yoke) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.strokeRect(cx - 20, H - 44, 40, 40); g.fillStyle = '#ffd040'; g.beginPath(); g.arc(cx + this.stick.r * 18, H - 24 + this.stick.p * 18, 4, 0, Math.PI * 2); g.fill(); }
  },
  drawMap() {
    const cv = $('ahMap'), g = cv.getContext('2d'), W = cv.width, c = this.course;
    const sx = c.maxX - c.minX, sz = c.maxZ - c.minZ, sc = (W - 24) / Math.max(sx, sz), ox = W / 2 - (c.minX + sx / 2) * sc, oz = W / 2 - (c.minZ + sz / 2) * sc;
    const X = (x) => ox + x * sc, Z = (z) => oz + z * sc;
    if (!this.mapBg) {
      const b = this.mapBg = document.createElement('canvas'); b.width = W; b.height = W; const q = b.getContext('2d');
      q.fillStyle = 'rgba(8,14,22,.55)'; q.beginPath(); q.arc(W / 2, W / 2, W / 2, 0, Math.PI * 2); q.fill();
      q.strokeStyle = 'rgba(255,255,255,.55)'; q.lineWidth = 3; q.beginPath();
      c.pts.forEach((p, i) => i ? q.lineTo(X(p.x), Z(p.z)) : q.moveTo(X(p.x), Z(p.z))); q.closePath(); q.stroke();
      const rw = c.rw; q.strokeStyle = '#ccc'; q.lineWidth = 4; q.beginPath(); q.moveTo(X(rw.x - rw.cx * rw.hl), Z(rw.z - rw.cz * rw.hl)); q.lineTo(X(rw.x + rw.cx * rw.hl), Z(rw.z + rw.cz * rw.hl)); q.stroke();
    }
    g.clearRect(0, 0, W, W); g.drawImage(this.mapBg, 0, 0);
    const G = c.gates.length, nx = this.me.passes % G;
    c.gates.forEach((gt, i) => { g.fillStyle = i === nx && this.kind !== 'free' ? '#ffd040' : gt.start ? '#fff' : gt.type === 'ring' ? '#ff6a50' : '#6ab0ff'; g.beginPath(); g.arc(X(gt.pos.x), Z(gt.pos.z), i === nx ? 5 : 3, 0, Math.PI * 2); g.fill(); });
    for (const r of this.racers) {
      if (!r.model.root.visible && r !== this.me) continue;
      const fw = this._v9 || (this._v9 = new THREE.Vector3()); fw.set(0, 0, -1).applyQuaternion(r.q);
      const a = Math.atan2(fw.z, fw.x), x = X(r.pos.x), z = Z(r.pos.z);
      g.fillStyle = r.kind === 'me' ? '#ffd040' : r.col || '#fff'; g.beginPath();
      g.moveTo(x + Math.cos(a) * 8, z + Math.sin(a) * 8); g.lineTo(x + Math.cos(a + 2.5) * 6, z + Math.sin(a + 2.5) * 6); g.lineTo(x + Math.cos(a - 2.5) * 6, z + Math.sin(a - 2.5) * 6); g.fill();
    }
  },

  // ---------------------------------------------------------------- zvuk
  initSnd() {
    const c = Sfx.ctx; if (!c || this.sn) return;
    const gain = (v, to) => { const g = c.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
    const filt = (t, f, q, to) => { const x = c.createBiquadFilter(); x.type = t; x.frequency.value = f; x.Q.value = q || 0.7; if (to) x.connect(to); return x; };
    const osc = (t, f, to) => { const o = c.createOscillator(); o.type = t; o.frequency.value = f; o.start(); if (to) o.connect(to); return o; };
    const noise = (to) => { const s = c.createBufferSource(); s.buffer = Sfx.noiseBuf; s.loop = true; s.start(); s.connect(to); return s; };
    const out = gain(0, Sfx.master), lp = filt('lowpass', 900, 0.8, out), shp = c.createWaveShaper();
    const cu = new Float32Array(512); for (let i = 0; i < 512; i++) { const x = i / 256 - 1; cu[i] = Math.tanh(x * 2.2); } shp.curve = cu; shp.connect(lp);
    const drv = gain(0.9, shp);
    const s = this.sn = { out, lp };
    s.o1 = osc('sawtooth', 60, gain(0.55, drv)); s.o2 = osc('square', 30, gain(0.3, drv));
    s.nG = gain(0.25, drv); noise(filt('bandpass', 260, 1.2, s.nG));
    s.pG = gain(0, Sfx.master); s.pF = filt('bandpass', 120, 2.5, s.pG); s.o3 = osc('sawtooth', 80, s.pF);
    s.wG = gain(0, Sfx.master); s.wF = filt('bandpass', 500, 0.6, s.wG); noise(s.wF);
    // varování před pádem: tón → modulace (0..1, přerušování 4 Hz) → hlasitost sG; bez pádu sG = 0 → ticho
    // (dřív šla modulace přímo do sG.gain a tón 880 Hz pískal pořád napůl hlasitě)
    s.sG = gain(0, Sfx.master); const sM = gain(0.5, filt('lowpass', 2000, 0.7, s.sG)); osc('square', 880, sM); s.sL = osc('square', 4, gain(0.5, sM.gain));
    s.rG = gain(0, Sfx.master); noise(filt('lowpass', 150, 0.8, s.rG));
    s.xG = gain(0, Sfx.master); s.xF = filt('lowpass', 700, 0.8, s.xG); s.ox = osc('sawtooth', 60, s.xF); s.ox2 = osc('square', 30, s.xF);
  },
  sndOff() { const s = this.sn; if (!s) return; const t = Sfx.ctx.currentTime; for (const g of [s.out, s.pG, s.wG, s.sG, s.rG, s.xG]) g.gain.setTargetAtTime(0, t, 0.05); },
  snd(dt) {
    const s = this.sn; if (!s) return;
    const c = Sfx.ctx, t = c.currentTime, me = this.me, ph = me.phys, P = me.P, vol = Sfx.engVol === undefined ? 1 : Sfx.engVol;
    const set = (p, v, k) => p.setTargetAtTime(v, t, k || 0.05);
    if (!ph || me.crashT > 0) { this.sndOff(); return; }
    const cock = this.sv.cam === 'cockpit', f = ph.rpm / 60 * P.cyl / 2;
    set(s.o1.frequency, f); set(s.o2.frequency, f / 2);
    set(s.out.gain, vol * (0.16 + 0.32 * ph.thr) * (cock ? 0.8 : 1));
    set(s.lp.frequency, (300 + 1900 * ph.thr) * (cock ? 0.55 : 1) + P.cyl * 40);
    set(s.o3.frequency, ph.rpm / 60 * P.blades); set(s.pF.frequency, ph.rpm / 60 * P.blades * 2);
    set(s.pG.gain, vol * (0.04 + 0.1 * ph.thr));
    const V = ph.V; set(s.wG.gain, Math.min(0.5, (V / 110) ** 2 * 0.28) * (cock ? 0.7 : 1) + ph.stall * 0.12); set(s.wF.frequency, 260 + V * 7);
    const stallW = !ph.onGround && (ph.alpha > P.aStall - 0.03 || ph.stall > 0.2) && V > 8;
    set(s.sG.gain, stallW ? 0.05 : 0, 0.02);
    set(s.rG.gain, ph.onGround ? Math.min(0.35, V / 30 * 0.3) : 0);
    // nejbližší jiné letadlo (průlet kolem = dopplerův jev)
    let best = null, bd = 1e9; for (const r of this.racers) { if (r === me || !r.model.root.visible) continue; const d = r.pos.distanceTo(this.cam.position); if (d < bd) { bd = d; best = r; } }
    if (best && bd < 700) {
      const rel = this._va || (this._va = new THREE.Vector3()); rel.copy(best.pos).sub(this.cam.position).normalize();
      const vr = (best.vel.dot(rel) - ph.vel.dot(rel)), dop = U.clamp(340 / (340 + vr), 0.6, 1.6), fo = best.P.rpmMax * 0.92 / 60 * best.P.cyl / 2 * dop;
      set(s.ox.frequency, fo, 0.08); set(s.ox2.frequency, fo / 2, 0.08); set(s.xG.gain, vol * 0.3 * (1 - bd / 700) ** 2, 0.08);
    } else set(s.xG.gain, 0);
  },
};

// ---------------------------------------------------------------- kouřová stopa (jeden draw call na letadlo)
class AirSmoke {
  constructor(scene, color) {
    const N = this.N = 420;
    this.scene = scene; this.p = new Float32Array(N * 3); this.a = new Float32Array(N); this.s = new Float32Array(N); this.life = new Float32Array(N); this.k = 0; this.t = 0;
    const g = this.g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3)); g.setAttribute('aA', new THREE.BufferAttribute(this.a, 1)); g.setAttribute('aS', new THREE.BufferAttribute(this.s, 1));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 }, uCol: { value: new THREE.Color(color) } }, transparent: true, depthWrite: false,
      vertexShader: 'attribute float aA; attribute float aS; varying float vA; uniform float uScale;\n#include <common>\n#include <logdepthbuf_pars_vertex>\nvoid main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vA=aA*smoothstep(3.0, 18.0, -mv.z); gl_PointSize = min(aS*uScale/max(-mv.z,0.5), 400.0); gl_Position = projectionMatrix*mv;\n#include <logdepthbuf_vertex>\n}',
      fragmentShader: 'varying float vA; uniform vec3 uCol;\n#include <common>\n#include <logdepthbuf_pars_fragment>\nvoid main(){\n#include <logdepthbuf_fragment>\nvec2 c=gl_PointCoord-0.5; float d=dot(c,c); if(d>0.25) discard; gl_FragColor=vec4(uCol, vA*(1.0-d*4.0)); }',
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts);
    this._v = new THREE.Vector3();
  }
  emit(pos, size, alpha, life) { const i = this.k; this.k = (this.k + 1) % this.N; this.p[i * 3] = pos.x; this.p[i * 3 + 1] = pos.y; this.p[i * 3 + 2] = pos.z; this.s[i] = size; this.a[i] = alpha; this.life[i] = life; this.l0 = this.l0 || new Float32Array(this.N); this.l0[i] = life; }
  update(dt, on, pos, q, L) {
    this.mat.uniforms.uScale.value = innerHeight / (2 * Math.tan((Air.cam.fov * Math.PI / 180) / 2));
    if (on) {
      this.t -= dt;
      while (this.t <= 0) { this.t += 0.035; this._v.set(0, -0.2, (L || 7) * 0.55).applyQuaternion(q).add(pos); this.emit(this._v, 1.0, 0.75, 9); }
    }
    for (let i = 0; i < this.N; i++) {
      if (this.life[i] <= 0) { this.a[i] = 0; continue; }
      this.life[i] -= dt; const f = this.life[i] / this.l0[i];
      this.s[i] += dt * 0.9; this.a[i] = Math.max(0, f) * 0.6;
      this.p[i * 3 + 1] += dt * 0.25;
    }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.aA.needsUpdate = true; this.g.attributes.aS.needsUpdate = true;
  }
  dispose() { this.scene.remove(this.pts); this.g.dispose(); this.mat.dispose(); }
}

// ---------------------------------------------------------------- exploze a trosky
class AirFx {
  constructor(scene) {
    this.scene = scene; this.items = [];
    this.smoke = new AirSmoke(scene, 0x3a3a3a);
  }
  clear() { for (const it of this.items) this.scene.remove(it.m); this.items = []; }
  boom(pos, vel, model) {
    const fire = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.95 }));
    fire.position.copy(pos); this.scene.add(fire); this.items.push({ m: fire, t: 0, fire: true });
    for (let i = 0; i < 26; i++) this.smoke.emit(new THREE.Vector3(pos.x + (Math.random() - 0.5) * 8, pos.y + Math.random() * 5, pos.z + (Math.random() - 0.5) * 8), 6 + Math.random() * 8, 0.9, 6 + Math.random() * 4);
    // trosky: kusy letadla odletí
    const mats = [model.main, U.mat(0x2a2a2a), U.mat(0x9a9ca0)];
    for (let i = 0; i < 14; i++) {
      const s = 0.3 + Math.random() * (i < 4 ? 2.2 : 0.8);
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s * 0.25, s * (0.5 + Math.random())), mats[i % 3]); m.castShadow = true;
      m.position.copy(pos); this.scene.add(m);
      const v = new THREE.Vector3((Math.random() - 0.5) * 30, 8 + Math.random() * 20, (Math.random() - 0.5) * 30).addScaledVector(vel, 0.35);
      this.items.push({ m, t: 0, v, w: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8) });
    }
  }
  update(dt, course) {
    this.smoke.update(dt, false, null, null);
    for (const it of this.items) {
      it.t += dt;
      if (it.fire) { const s = 4 + it.t * 30; it.m.scale.setScalar(s); it.m.material.opacity = Math.max(0, 0.95 - it.t * 1.4); it.m.material.color.setHSL(0.08 - it.t * 0.05, 1, 0.55 - it.t * 0.2); continue; }
      it.v.y -= AIR_G * dt; it.m.position.addScaledVector(it.v, dt);
      it.m.rotation.x += it.w.x * dt; it.m.rotation.y += it.w.y * dt;
      const gh = course.height(it.m.position.x, it.m.position.z);
      if (it.m.position.y < gh + 0.2) { it.m.position.y = gh + 0.2; it.v.multiplyScalar(0.4); it.v.y = Math.abs(it.v.y) * 0.3; it.w.multiplyScalar(0.5); }
      if (it.t < 3 && Math.random() < dt * 8) this.smoke.emit(it.m.position, 2.5, 0.5, 3);
    }
    this.items = this.items.filter(it => { if (it.t > (it.fire ? 1 : 12)) { this.scene.remove(it.m); it.m.geometry.dispose(); return false; } return true; });
  }
}
