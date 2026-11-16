// game.js – hlavní smyčka, vstupy, míření na díly (raycast), kufr, obchod, vylepšení, smrt a respawn
const $ = (id) => document.getElementById(id);

const PERKS = [
  { id: 'mechanik', name: 'Mechanik', desc: 'díly se opotřebovávají o 30 % pomaleji', cost: 40 },
  { id: 'setrny', name: 'Šetrná noha', desc: 'spotřeba benzínu −15 %', cost: 30 },
  { id: 'kufr', name: 'Velký kufr', desc: '+4 místa v kufru', cost: 20 },
  { id: 'vybava', name: 'Výbava na cestu', desc: 'v kufru začínáš s opravnou sadou, kanystrem a kolem', cost: 25 },
  { id: 'lepsistart', name: 'Lepší start', desc: 've stodole jsou kvalitnější díly', cost: 35 },
  { id: 'sberac', name: 'Sběrač šrotu', desc: '+50 % šrotu z vraků a prodeje', cost: 30 },
  { id: 'rvac', name: 'Rváč', desc: 'dvojnásobná rána a 130 zdraví', cost: 25 },
  { id: 'tuhy', name: 'Tuhý kořínek', desc: 'smrtelná bouračka až od 90 km/h', cost: 50 },
];
const Perks = {
  owned: U.store.get('pj_perks', []),
  has(id) { return this.owned.includes(id); },
  xp() { return U.store.get('pj_xp', 0); },
  addXp(n) { U.store.set('pj_xp', this.xp() + n); },
  buy(id) {
    const p = PERKS.find(q => q.id === id), xp = this.xp();
    if (!p || this.has(id) || xp < p.cost) return false;
    U.store.set('pj_xp', xp - p.cost); this.owned.push(id); U.store.set('pj_perks', this.owned);
    return true;
  },
};

// konfety na obrazovce vítěze
const Confetti = {
  parts: [], run: false,
  start() {
    const cv = $('confetti'); cv.width = innerWidth; cv.height = innerHeight;
    const cols = ['#ffcf86', '#ff6a50', '#8fe38a', '#7fe8ff', '#ffffff', '#c08aff', '#ffd040'];
    this.parts = [];
    for (let i = 0; i < 220; i++) this.parts.push({ x: Math.random() * cv.width, y: -20 - Math.random() * cv.height * 0.8, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, c: cols[i % cols.length] });
    this.t0 = performance.now();
    if (!this.run) { this.run = true; this.tick(); }
  },
  stop() { this.run = false; const cv = $('confetti'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); },
  tick() {
    if (!this.run) return;
    const cv = $('confetti'), g = cv.getContext('2d'), age = (performance.now() - this.t0) / 1000;
    g.clearRect(0, 0, cv.width, cv.height);
    for (const p of this.parts) {
      p.x += p.vx + Math.sin(age * 2 + p.r) * 0.6; p.y += p.vy; p.r += p.vr;
      if (p.y > cv.height + 20 && age < 5) { p.y = -20; p.x = Math.random() * cv.width; }
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(age * 6 + p.r)), p.w, p.h * Math.abs(Math.cos(age * 6 + p.r))); g.restore();
    }
    if (age > 9) return this.stop();
    requestAnimationFrame(() => this.tick());
  },
};

const Game = {
  keys: {}, playing: false, paused: false, inCar: false, uiOpen: false, maxS: 0, best: 0, biomeName: '',
  scrap: 0, trunk: [], stage: 0, xpKm: 0, xpStage: 0, holdT: 0, lockT: 0,
  init() {
    // logaritmický hloubkový buffer = žádné blikání ploch (z-fighting) ani na dálku
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });   // notebook se dvěma grafikami → výkonnější
    r.setPixelRatio(1);
    r.setSize(innerWidth, innerHeight);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap; // PCF s poloměrem = měkké okraje bez schodů
    r.shadowMap.autoUpdate = false; // stíny se počítají jednou za snímek (ne znovu pro každé zrcátko)
    document.body.appendChild(r.domElement);
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf2d9a6);
    scene.fog = new THREE.Fog(0xf2d9a6, 70, 430);
    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 800);
    this.camera.rotation.order = 'YXZ';
    scene.add(this.camera);
    const hemi = new THREE.HemisphereLight(0xfff4e0, 0x8a6a4a, 0.6); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1d8, 1.1);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = -50; sc.right = 50; sc.top = 50; sc.bottom = -50; sun.shadow.radius = 2.5; sc.near = 1; sc.far = 300;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.085; // bez pruhovaných stínových artefaktů
    scene.add(sun); scene.add(sun.target);
    this.lights = { scene, sun, hemi };
    Player.init(this.camera);
    Weapons.init(this.camera, scene);
    this._fdir = new THREE.Vector3();
    this.buildWorld(Math.floor(Math.random() * 1e6));
    this.ray = new THREE.Raycaster();
    this.best = U.store.get('pj_best', 0);
    $('best').textContent = this.best > 0 ? `Nejlepší dojezd: ${this.best.toFixed(2)} km` : '';
    this.renderPerks();
    Settings.bindUI(); Settings.apply();
    this.bindInput();
    this.clock = new THREE.Clock();
    this._eye = new THREE.Vector3(); this._dir = new THREE.Vector3(); this._hudT = 0;
    this.loop();
  },

  // ---------------- vstup ----------------
  bindInput() {
    const cv = this.renderer.domElement;
    addEventListener('resize', () => { this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); });
    $('playBtn').onclick = () => this.begin();
    // dílna a ovládání v okně nad menu (menu se tak vejde na jednu obrazovku)
    const modal = (what) => { $('perks').style.display = what === 'perks' ? '' : 'none'; $('mmKeys').style.display = what === 'keys' ? '' : 'none'; $('mmModal').classList.toggle('on', !!what); };
    $('perksBtn').onclick = () => modal('perks'); $('keysBtn').onclick = () => modal('keys');
    $('mmClose').onclick = () => modal(null);
    $('mmModal').addEventListener('click', (e) => { if (e.target.id === 'mmModal') modal(null); });
    addEventListener('keydown', (e) => { if (e.code === 'Escape' && $('mmModal').classList.contains('on')) modal(null); });
    // přezdívka (pamatuje si ji prohlížeč)
    Account.init();
    $('boardBtn').onclick = () => Account.openBoard();
    // multiplayer menu
    Net.ui = (t, cls) => { this._lbStatus = t ? `<span class="${cls || ''}">${t}</span>` : ''; this.renderLobby(); };
    Net.onLobby = () => this.renderLobby();
    $('mpBtn').onclick = () => { Sfx.init(); this.openLobby(); };
    $('dragBtn').onclick = () => Drag.enterGarage();
    $('rallyBtn').onclick = () => Rally.enterGarage();
    $('airBtn').onclick = () => Air.enter();
    $('dealerBtn').onclick = () => Dealer.open();
    $('lobbyBox').addEventListener('click', (e) => this.lobbyClick(e));
    $('lobbyBox').addEventListener('input', (e) => { if (e.target.id === 'lbCode') this._lbCode = e.target.value; });
    $('lobbyBox').addEventListener('keydown', (e) => { if (e.target.id === 'lbCode' && e.key === 'Enter') Net.join(this._lbCode); });
    // rádio: ovládání v menu a v garáži
    Radio.onChange = () => { this.renderRadioW(); if (this.playing && Radio.ready) { const i = Radio.info(); this.msg(i.on ? `📻 ${i.name} ${i.freq} – ${i.title} (${i.artist})` : '📻 Rádio vypnuto'); } };
    $('radioW').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; Sfx.init(); if (!Radio.ready) Radio.init(); const a = b.dataset.r; if (a === 'pw') Radio.toggle(); else Radio.next(a === 'nx' ? 1 : -1); });
    $('radioW').addEventListener('input', (e) => { if (e.target.type === 'range') { Settings.s.radio = +e.target.value; Settings.save(); Radio.apply(); } });
    addEventListener('pointerdown', () => { Sfx.init(); if (Sfx.ctx && Sfx.ctx.state === 'suspended') Sfx.ctx.resume(); if (Sfx.ctx && !Radio.ready) Radio.init(); });
    Drag.bindUI();
    Rally.bindUI();
    Air.bindUI();
    $('pause').onclick = (e) => { if (e.target.id !== 'pauseSet') this.lock(); };
    $('pauseMenu').onclick = (e) => {   // druhé kliknutí potvrdí odchod
      e.stopPropagation(); const b = $('pauseMenu');
      if (b.dataset.sure) { if (Net.active) Net.leave(); location.reload(); return; }
      b.dataset.sure = 1; b.textContent = 'Opravdu? Jízda skončí'; b.style.background = '#c0392b';
      setTimeout(() => { delete b.dataset.sure; b.textContent = '🏠 Hlavní menu'; b.style.background = ''; }, 3000);
    };
    $('pauseSet').onclick = (e) => { e.stopPropagation(); $('pause').style.display = 'none'; Settings.open('game'); };
    $('setBtn').onclick = () => Settings.open('menu');
    $('btnRestart').onclick = () => location.reload();
    $('btnRespawn').onclick = () => this.respawn();
    $('panelBox').onclick = (e) => { const b = e.target.closest('button'); if (b) this.panelAct(b.dataset.act, +b.dataset.i); };
    cv.addEventListener('click', () => { if (this.playing && !this.paused && !this.uiOpen) this.lock(); });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === cv;
      if (locked) { this.paused = false; this.lockT = performance.now(); $('pause').style.display = 'none'; }
      else if (this.playing && Player.alive && !this.uiOpen) { this.paused = true; $('pause').style.display = 'flex'; }
    });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== cv || !this.playing || !Player.alive || this.uiOpen) return;
      // prohlížeče občas po zamčení myši pošlou obří skok – ten zahodíme, aby kamera neuskočila
      if (performance.now() - this.lockT < 150) return;
      const dx = e.movementX, dy = e.movementY, m = Math.hypot(dx, dy);
      // filtr falešných skoků (chyba prohlížečů): pohyb mnohem větší než ty předchozí se zahodí
      const avg = this._mAvg || 20;
      if (m > 60 && m > avg * 7) { this._mSkip = (this._mSkip || 0) + 1; if (this._mSkip < 3) return; }
      this._mSkip = 0; this._mAvg = avg * 0.8 + Math.min(m, 400) * 0.2;
      const k = Weapons.zoom ? 0.22 : 1; // v puškohledu jemnější míření
      Player.look(dx * k, dy * k);
    });
    addEventListener('mousedown', (e) => {
      if (!this.playing || this.paused || this.uiOpen || !Player.alive) return;
      if (e.button === 0 && this.inCar && this.radioAim) { this.radioAct(this.radioAim); return; }
      if (e.button === 0) { this.mouseDown = true; this.clickQueued = true; }
      if (e.button === 2) this.aim = true;
    });
    addEventListener('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; if (e.button === 2) this.aim = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('wheel', (e) => {
      if (!this.playing || this.uiOpen || this.paused) return;
      if (this.inCar && this.radioAim) { Radio.volume(e.deltaY > 0 ? -5 : 5); this.car.radioAnim = 0.4; return; }
      Weapons.cycle(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });
    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.target && e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') e.preventDefault();
      if ($('settings').style.display === 'flex') return;
      const acts = Settings.actionsFor(e.code), has = (a) => acts.includes(a);
      if (this.uiOpen) { if (!e.repeat && (has('interact') || e.code === 'Escape')) this.closePanel(); return; }
      if (e.repeat || !this.playing) return;
      if (has('settings')) { this.paused = true; Settings.open('game'); return; }
      if (this.paused || !Player.alive) return;
      const car = this.car, inCar = this.inCar;
      if (has('interact')) this.interact();
      if (has('drop') && !inCar && Player.held) Player.dropHeld();
      if (has('radio')) Radio.toggle();
      if (has('radioNext')) { Radio.next(); if (inCar) car.radioAnim = 0.5; }
      if (has('help')) { Settings.s.help = this.showHelp = !this.showHelp; Settings.save(); }
      if (inCar && has('engine')) car.toggleEngine();
      if (inCar && has('gearmode')) car.toggleAuto();
      if (inCar && !car.auto && has('shiftUp')) car.shiftUp();
      else if (has('reload')) Weapons.reload();
      if (inCar && has('shiftDown')) car.shiftDown();
      if (inCar && has('horn')) Sfx.horn();
      if (inCar && has('lights')) {
        if (!car.battery || car.battery.charge <= 0) this.msg('Světla nefungují – není baterka', 'bad');
        else { car.lights = !car.lights; Sfx.click(); }
      }
      if (/^Digit[1-8]$/.test(e.code) && !acts.length) Weapons.select(+e.code.slice(5) - 1);
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; this.mouseDown = false; this.aim = false; });
    this.showHelp = Settings.s.help;
  },
  nick() { return Account.name || (U.store.get('pj_nick', '') || '').trim() || 'Řidič'; },
  lock() {
    const el = this.renderer.domElement;
    const plain = () => { try { const p = el.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* nic */ } };
    if (!Settings.s.rawMouse) return plain();
    try { const p = el.requestPointerLock({ unadjustedMovement: true }); if (p && p.catch) p.catch(plain); } catch (e) { plain(); }
  },
  // postaví (nebo přestaví) celý svět pro daný seed – v multiplayeru mají oba hráči stejný seed
  buildWorld(seed) {
    const L = this.lights, scene = this.scene;
    for (const o of [...scene.children]) if (o !== this.camera && o !== L.sun && o !== L.sun.target && o !== L.hemi) scene.remove(o);
    this.seed = seed;
    Items.init(scene);
    World.finishS = Net.active ? RACE_KM * 1000 : 0; World.finishDone = false;
    World.init(scene, seed);
    this.car = new Car(scene);
    this.car.onMsg = (t, c) => this.msg(t, c);
    this.car.onCrash = (sp, fatal) => this.onCrash(sp, fatal);
    Player.reset(-2.5, 11.5, Math.atan2(-2.5, -3));
    if (Net.active) { // v závodě stojí auta ve stodole vedle sebe (3. a 4. hráč před stodolou)
      const [ox, oz] = Net.spawnFor(Net.slot);
      this.car.reset(ox, oz, Math.PI); this.car.hoodOpen = true;
      if (oz > 10) Player.reset(ox * 2.2, 11.0, Math.PI); else Player.reset(ox + Math.sign(ox) * 2.2, oz, Math.PI);
    }
    Hazards.init(scene, L);
    Weather.init(scene);
    Ambient.init(scene);
    if (Net.active) Net.attach(scene);
    this.maxS = 0; this.stage = 0; this.scrap = 0; this.trunk = []; this.xpKm = 0; this.xpStage = 0; this.inCar = false;
  },
  // multiplayer: start závodu (volá se u obou hráčů se stejným seedem)
  startRace(seed) {
    if (Drag.active) Drag.exit();
    if (Rally.active) Rally.exit();
    if (Air.active) Air.exit();
    if (this.playing) { location.reload(); return; }
    Net.active = true; Net.raceOver = false;
    $('lobby').style.display = 'none'; $('race').style.display = 'none';
    this.buildWorld(seed);
    this.begin();
    this.freezeT = 3.99;
    this.msg(`Závod na ${RACE_KM} km, ${Object.keys(Net.players).length} hráči! Kdo dřív dojede do cíle, vyhrává.`, 'warn');
    this.msg('Klikni do hry, aby šla ovládat myš.');
  },
  raceEnd(winSlot, text) {
    if (Net.raceOver) return;
    Net.raceOver = true; Net.inRace = false;
    const win = winSlot === Net.slot;
    Account.mp(win); Account.run(this.maxS / 1000, false);
    const rows = [{ slot: Net.slot, nick: this.nick(), km: this.maxS / 1000 }].concat(Net.others().map(p => ({ slot: p.slot, nick: p.nick, km: p.km || 0 })));
    rows.sort((a, b) => (b.slot === winSlot) - (a.slot === winSlot) || b.km - a.km);
    const r = rows.map(q => ({ me: q.slot === Net.slot, col: SLOT_COL[q.slot], cells: [String(q.nick).replace(/[<>&]/g, ''), (q.slot === winSlot ? '🏁 ' : '') + q.km.toFixed(2) + ' km'] }));
    setTimeout(() => this.showResults({ win, title: win ? 'VYHRÁL JSI!' : 'PROHRÁL JSI', text, cols: ['Hráč', 'Dojeto'], rows: r,
      buttons: [{ label: 'Zpět do menu', fn: () => location.reload() }] }), win ? 300 : 1500);
  },
  // společná obrazovka výsledků (pouštní závod i drag): tabulka pořadí, odměny, fanfáry / smutný trombon, konfety
  showResults(o) {
    const R = $('race');
    R.className = 'overlay ' + (o.win ? 'win' : 'lose');
    $('raceTitle').textContent = o.title; $('raceText').innerHTML = o.text || '';
    const medal = ['🥇', '🥈', '🥉', '4.'];
    $('raceTable').innerHTML = `<tr><th></th>${o.cols.map(c => `<th>${c}</th>`).join('')}</tr>` +
      o.rows.map((row, i) => `<tr class="${row.me ? 'me' : ''}" style="animation-delay:${0.25 + i * 0.12}s"><td class="pl">${medal[i] || i + 1 + '.'}</td>${row.cells.map((c, k) => `<td${k === 0 && row.col ? ` style="color:${row.col}"` : ''}>${c}</td>`).join('')}</tr>`).join('');
    $('raceReward').innerHTML = o.reward || '';
    const bx = $('raceBtns'); bx.innerHTML = '';
    for (const b of o.buttons) { const e = document.createElement('button'); e.className = 'btn' + (b.alt ? ' alt' : ''); e.textContent = b.label; e.onclick = () => { Confetti.stop(); R.style.display = 'none'; b.fn(); }; bx.appendChild(e); }
    R.style.display = 'flex';
    if (document.exitPointerLock) document.exitPointerLock();
    Radio.duck(5);
    if (o.win) { Sfx.fanfare(); Confetti.start(); } else Sfx.sadTrombone();
  },
  // ---------- lobby pro multiplayer ----------
  openLobby() { $('lobby').style.display = 'flex'; this.renderLobby(); },
  renderLobby() {
    if ($('lobby').style.display !== 'flex') return;
    const esc = (t) => String(t).replace(/[<>&"]/g, '');
    const inLobby = Net.connected() || Object.keys(Net.players).length > 0;
    let h = '<h2>Multiplayer – až 4 hráči</h2>';
    if (!inLobby) h += `<div class="lbJoin"><button class="btn" data-lb="host">Založit lobby</button><span>nebo</span><input id="lbCode" maxlength="4" placeholder="kód" inputmode="numeric" value="${esc(this._lbCode || '')}"><button class="btn alt" data-lb="join">Připojit se</button></div>`;
    h += `<div id="lbStatus">${this._lbStatus || ''}</div>`;
    if (inLobby) {
      const pl = Object.values(Net.players).sort((a, b) => a.slot - b.slot);
      h += '<div class="lbSlots">' + [0, 1, 2, 3].map(i => { const p = pl[i]; return p ? `<div class="lbSlot" style="border-color:${SLOT_COL[p.slot]}"><b style="color:${SLOT_COL[p.slot]}">${esc(p.nick)}</b>${p.slot === 0 ? ' 👑' : ''}${p.slot === Net.slot ? ' (ty)' : ''}</div>` : '<div class="lbSlot empty">volné místo…</div>'; }).join('') + '</div>';
      const modes = [['desert', '🏜 Pouštní závod', `${RACE_KM} km pouští, každý si poskládá svoje auto. Smrt = minuta penalizace.`], ['drag', '🏁 Drag race', 'Čtvrt míle rovně, každý se svým autem z drag garáže. Vítěz bere nejvíc peněz a XP.'], ['dragsb', '🧪 Drag sandbox', 'Každý si navolí cokoliv – 25× výkon, Měsíc, rakety. Bez odměn, jen kraviny.']];
      const rm = String(Net.mode).startsWith('rally'), rf = String(Net.mode).startsWith('rallyf'), rp = String(Net.mode).split(':'), rs = rp[2] === 's', myRs = ((Rally.sv || U.store.get('pj_rally', {})).stage) || 0, ri = rm ? +rp[1] || 0 : myRs;
      modes.push(['rally:' + ri + (rs ? ':s' : ''), '🗺 Rally (koop)', 'Dvojice = řidič + spolujezdec s tabletem. Spolujezdec hlásí zatáčky, řidič jede podle něj.']);
      modes.push(['rallyf:' + ri, '🏆 Rally – každý sám', 'Každý řídí svoje auto z rally servisu, hlásí mu AI spolujezdec. Nejrychlejší čas vyhrává.']);
      const am = String(Net.mode).startsWith('air'), ati = am ? U.clamp(+String(Net.mode).split(':')[1] || 0, 0, AIR_TRACKS.length - 1) : ((Air.sv || U.store.get('pj_air', {})).track || 0);
      modes.push(['air:' + ati, '✈ Letecký závod', 'Každý si vybere letadlo v hangáru. Letmý start, brány a pylony, 2 kola.']);
      const dis = Net.isHost ? '' : 'disabled';
      h += '<h3>Režim</h3><div class="lbModes">' + modes.map(([id, n, d]) => `<button class="lbMode${Net.mode === id || (rm && id.startsWith(rf ? 'rallyf' : 'rally:')) || (am && id.startsWith('air')) ? ' on' : ''}" data-lb="mode:${id}" ${dis}><b>${n}</b><br><span>${d}</span></button>`).join('') + '</div>';
      if (am) h += '<h3>Trať</h3><div class="lbModes">' + AIR_TRACKS.map((t, i) => `<button class="lbMode${i === ati ? ' on' : ''}" data-lb="mode:air:${i}" ${dis}><b>${t.name}</b><br><span>${t.gates} bran · ${t.laps} kola</span></button>`).join('') + '</div><div style="margin-top:6px;opacity:.8;font-size:13px">Letadlo si každý vybírá v ✈ hangáru (hlavní menu → Letecké závody).</div>';
      if (rm) {
        const sl = Object.values(Net.players).map(p => p.slot).sort((a, b) => a - b), pairs = [];
        if (rf) for (const s of sl) pairs.push(`🚗 <b style="color:${SLOT_COL[s]}">${esc(Net.nickOf(s))}</b> · 📋 AI spolujezdec`);
        else for (let i = 0; i < sl.length; i += 2) { const pr = sl.slice(i, i + 2), dr = rs && pr.length === 2 ? pr[1] : pr[0]; pairs.push(`🚗 <b>${esc(Net.nickOf(dr))}</b> řídí${pr.length === 2 ? ` · 📋 <b>${esc(Net.nickOf(pr.find(x => x !== dr)))}</b> spolujezdec` : ' · 📋 AI spolujezdec'}`); }
        const rst = rallyStage(ri);
        h += `<h3>Etapa ${ri + 1}</h3><div class="lbModes"><div class="lbMode on"><b>${esc(rst.name)}</b> · ${RALLY_BIOMES[rst.biome].name}<br><span>${(rst.len / 1000).toFixed(1)} km · ${Object.keys(rst.mix).map(k => RALLY_SURF[k].name).join(', ')} · etapa podle postupu hostitele, po dojetí jede další</span></div></div>`;
        h += `<div style="margin-top:8px;text-align:left">${pairs.join('<br>')}</div>${rf ? '' : `<button class="btn alt" style="margin-top:6px" data-lb="mode:rally:${ri}${rs ? '' : ':s'}" ${dis}>🔄 Prohodit řidiče a spolujezdce</button>`}`;
      }
      h += '<div style="margin-top:12px">' + (Net.isHost ? `<button class="btn" data-lb="start" ${Net.others().length ? '' : 'disabled'}>SPUSTIT${Net.others().length ? '' : ' (čeká se na hráče)'}</button>` : '<span style="opacity:.8">Čeká se, až hostitel spustí hru…</span>') + ' <button class="btn alt" data-lb="leave">Odejít z lobby</button></div>';
    }
    h += '<button class="close" data-lb="close">Zavřít</button>';
    $('lobbyBox').innerHTML = h;
  },
  lobbyClick(e) {
    const b = e.target.closest('[data-lb]'); if (!b) return;
    const a = b.dataset.lb;
    if (a === 'host') Net.host();
    else if (a === 'join') Net.join(this._lbCode || ($('lbCode') && $('lbCode').value));
    else if (a === 'start') Net.start();
    else if (a === 'leave') Net.leave();
    else if (a === 'close') $('lobby').style.display = 'none';
    else if (a.startsWith('mode:')) Net.setMode(a.slice(5));
  },
  renderRadioW() {
    const w = $('radioW'), show = !this.playing && !(Drag.active && Drag.mode === 'race') && !(Rally.active && Rally.mode === 'stage') && !(Air.active && Air.mode === 'fly');
    w.style.display = show ? 'flex' : 'none';
    if (!show) return;
    const i = Radio.info();
    w.innerHTML = `<span style="font-size:20px">📻</span><div class="rinfo">${Radio.ready ? (i.on ? `<b>${i.name} ${i.freq}</b><div>${i.title} – ${i.artist}</div>` : '<b>Rádio vypnuto</b>') : '<b>Rádio</b><div>klikni kamkoli pro zvuk</div>'}</div>` +
      `<button data-r="pv" title="předchozí stanice">◀</button><button data-r="pw" title="zapnout/vypnout">⏻</button><button data-r="nx" title="další stanice">▶</button><input type="range" min="0" max="100" value="${i.vol}" title="hlasitost">`;
  },
  radioAct(a) {
    const car = this.car; car.radioAnim = 0.5;
    if (a === 'power') Radio.toggle();
    else if (a === 'tune') Radio.next();
    else if (a.startsWith('st')) Radio.setStation(+a.slice(2));
    Sfx.click();
  },
  begin() {
    Account.newRun();
    $('menu').style.display = 'none'; $('hud').style.display = 'block';
    Sfx.init(); this.playing = true;
    Player.maxHealth = Perks.has('rvac') ? 130 : 100; Player.health = Player.maxHealth;
    if (Perks.has('vybava')) this.trunk.push(Items.make('repairkit'), Items.make('canister'), Items.make('tire', { tier: 1, cond: 100 }));
    this.lock();
    this.msg(`Ahoj ${this.nick()}! Auto je rozebrané – všechny díly najdeš ve stodole kolem něj.`, 'warn');
    setTimeout(() => this.msg('Podívej se na předek auta a otevři kapotu (E). Díl v ruce namontuješ dalším E.'), 4500);
  },

  // ---------------- míření a interakce ----------------
  visible(o) { while (o) { if (!o.visible) return false; o = o.parent; } return true; },
  computeTarget() {
    const eye = this._eye, dir = this._dir, car = this.car;
    Player.lookDir(dir);
    let best = null;
    const it = Items.findLook(eye, dir, 3);
    if (it) best = { kind: 'item', it, d: it._d };
    if (!car.exploded && Math.hypot(Player.x - car.x, Player.z - car.z) < 7) {
      car.parts.root.updateMatrixWorld(true);
      this.ray.set(eye, dir); this.ray.far = 3.3;
      for (const h of this.ray.intersectObject(car.parts.root, true)) {
        if (!h.object.isMesh || !this.visible(h.object)) continue;
        if (!best || h.distance < best.d - 0.05) best = { kind: 'car', zone: h.object.userData.zone || 'body', d: h.distance };
        break;
      }
    }
    if (best) return best;
    for (const o of World.wrecks) {
      if (o.dismantled) continue;
      const dx = o.x - Player.x, dz = o.z - Player.z, d = Math.hypot(dx, dz);
      if (d < 4.2 && (dx * dir.x + dz * dir.z) / (d * Math.hypot(dir.x, dir.z) || 1) > 0.7) return { kind: 'wreck', o };
    }
    for (const h of World.houses) {
      if (!h.npc) continue;
      const dx = h.npc.x - Player.x, dz = h.npc.z - Player.z, d = Math.hypot(dx, dz);
      if (d < 3.6 && (dx * dir.x + dz * dir.z) / (d * Math.hypot(dir.x, dir.z) || 1) > 0.75) return { kind: 'npc', h };
    }
    return null;
  },
  actionFor(t) {
    const held = Player.held, car = this.car;
    const lab = held ? `<span style="color:${Items.color(held)}">${Items.label(held)}</span>` : '';
    if (held && held.type === 'medkit' && (!t || t.kind !== 'item')) return { text: '<b>E</b> ošetřit se · <b>G</b> zahodit', run: () => this.heal() };
    if (!t) return held ? { text: `V ruce: ${lab} · <b>G</b> zahodit` } : null;
    if (held && t.kind === 'car' && (held.def.cat === 'cosm' || held.def.cat === 'spray' || held.type === 'tire'))
      return { text: `<b>E</b> ${held.def.cat === 'spray' ? 'přestříkat auto' : held.type === 'tire' ? 'přezout všechna 4 kola' : 'namontovat'}: ${lab}`, run: () => this.useHeld(t.zone) };
    if (t.kind === 'item' && (t.it.def.cat === 'weapon' || t.it.def.cat === 'ammo')) {
      return { text: `<b>E</b> sebrat: <span style="color:${Items.color(t.it)}">${Items.label(t.it)}</span>`, run: () => this.pickWeapon(t.it) };
    }
    if (t.kind === 'item') return { text: `<b>E</b> vzít: <span style="color:${Items.color(t.it)}">${Items.label(t.it)}</span>`, run: () => { if (held) Player.dropHeld(); Player.hold(t.it); Sfx.pickup(); } };
    if (t.kind === 'wreck') return { text: '<b>Drž E</b> – rozebrat vrak (šrot + díly)', hold: true };
    if (t.kind === 'npc') return { text: '<b>E</b> obchodovat', run: () => this.openShop(t.h) };
    const z = t.zone;
    if (z === 'trunk') return { text: '<b>E</b> otevřít kufr', run: () => this.openTrunk() };
    if (z.startsWith('tire:')) {
      const i = +z.slice(5), tr = car.tires[i];
      const info = `Kolo ${TIRE_NAMES[i]}: <span style="color:${TIERS[tr.tier].color}">${TIERS[tr.tier].name}</span> ${Math.round(tr.cond)} %${tr.cond <= 0 ? ' – PÍCHLÉ' : ''}`;
      return held ? { text: `<b>E</b> ${held.type === 'tire' ? 'nasadit' : 'použít'}: ${lab} · ${info}`, run: () => this.useHeld(z) } : { text: info };
    }
    const bayItem = held && ((PARTS[held.type] && PARTS[held.type].bay) || held.type === 'oil' || held.type === 'coolant');
    if (z === 'hood' || (z === 'bay' && !car.hoodOpen)) {
      if (bayItem && car.hoodOpen) return { text: `<b>E</b> namontovat: ${lab}`, run: () => this.useHeld(z) };
      return { text: `<b>E</b> ${car.hoodOpen ? 'zavřít' : 'otevřít'} kapotu`, run: () => car.toggleHood() };
    }
    if (z.startsWith('slot:') || z === 'bay') {
      const slot = z.startsWith('slot:') ? z.slice(5) : null;
      if (held) return { text: `<b>E</b> ${PARTS[held.type] ? 'namontovat' : 'použít'}: ${lab}`, run: () => this.useHeld(z) };
      if (slot && car.slots[slot]) {
        const p = car.slots[slot];
        return { text: `<b>E</b> vyndat: <span style="color:${TIERS[p.tier].color}">${Items.name({ type: slot, data: p })}</span> (${Math.round(p.cond)} %)`, run: () => this.removePart(slot) };
      }
      if (slot) return { text: `Prázdné místo: <b>${PARTS[slot].name}</b>${PARTS[slot].req ? ' (nutné k jízdě)' : ''}` };
      return { text: 'Motorový prostor · <b>E</b> zavřít kapotu', run: () => car.toggleHood() };
    }
    if (held) return { text: `<b>E</b> použít na auto: ${lab}`, run: () => this.useHeld(z) };
    return { text: '<b>E</b> nastoupit', run: () => this.enterCar() };
  },
  interact() {
    const car = this.car;
    if (this.inCar && this.radioAim) return this.radioAct(this.radioAim);
    if (this.inCar) { if (car.speed > 3) return this.msg('Nejdřív zastav', 'warn'); return this.exitCar(); }
    const a = this.actionFor(this.target);
    if (a && a.run) a.run();
  },
  pickWeapon(it) {
    Items.take(it); Sfx.pickup();
    if (it.def.cat === 'weapon') this.msg(Weapons.add(it.def.id), 'good');
    else { Weapons.ammo[it.type] += it.data.amount; this.msg(`+${it.data.amount} ks: ${it.def.name}`, 'good'); }
  },
  heal() {
    if (Player.health >= Player.maxHealth) return this.msg('Jsi zdravý', 'warn');
    Player.health = Math.min(Player.maxHealth, Player.health + 50); Player.consumeHeld(); Sfx.install();
    this.msg('Ošetřeno (+50 zdraví)', 'good');
  },
  feet() { const a = Player.yaw; return [Player.x - Math.sin(a) * 0.8, Player.z - Math.cos(a) * 0.8]; },
  dropAtFeet(type, data) { const [x, z] = this.feet(); return Items.spawn(type, x, World.groundAt(x, z), z, data); },
  useHeld(zone) {
    const res = this.car.useItem(Player.held, zone);
    this.msg(res.msg, res.ok ? 'good' : 'warn');
    if (!res.ok) return;
    Sfx.install();
    if (res.consumed) Player.consumeHeld();
    if (res.drop) { const it = this.dropAtFeet(res.drop[0], res.drop[1]); this.msg(`Starý díl leží u tebe: ${Items.label(it)}`); }
  },
  removePart(slot) {
    const res = this.car.removePart(slot);
    if (!res.ok) { if (res.msg) this.msg(res.msg, 'warn'); return; }
    const it = this.dropAtFeet(res.item[0], res.item[1]); Player.hold(it); Sfx.ratchet();
  },
  enterCar() {
    if (Player.held) Player.dropHeld();
    this.inCar = true; Player.inCar = true;
    Player.lookYaw = 0; Player.lookPitch = 0;
    this.car.parts.root.add(this.camera);
    this.camera.position.set(0.38, 1.25, -0.3);
    this.camera.rotation.set(Player.lookPitch, Math.PI, 0);
    if (!this.car.running) this.msg('C = nastartovat, T = automat/manuál, L = světla, E = vystoupit');
  },
  exitCar() {
    const c = this.car;
    this.inCar = false; Player.inCar = false;
    this.scene.add(this.camera);
    const x = c.x + Math.cos(c.yaw) * 1.7, z = c.z - Math.sin(c.yaw) * 1.7;
    Player.x = x; Player.z = z; Player.y = World.groundAt(x, z); Player.vy = 0;
    Player.yaw = c.yaw + Math.PI + Player.lookYaw; Player.pitch = Player.lookPitch; // díváš se tam, kam ses díval v autě
  },
  finishWreck(o) {
    o.dismantled = true;
    const g = Math.round((6 + Math.random() * 9) * (Perks.has('sberac') ? 1.5 : 1));
    this.scrap += g; Sfx.coin();
    let txt = `Vrak rozebrán: +${g} kg šrotu`;
    if (Math.random() < 0.6) {
      const type = U.pickWeighted(Math.random(), [['tire', 2], ['starter', 1.5], ['alternator', 1.5], ['carb', 1], ['fuelpump', 1.5], ['radiator', 1], ['battery', 1], ['belt', 2], ['plugs', 2], ['airfilter', 2], ['engine', 1.2], ['gearbox', 0.8], ['cosm', 1.2], ['spray', 0.6]]);
      const [t, d] = Items.rollOne(type, o.km || 0, Math.random, 0, true);
      const it = this.dropAtFeet(t, d); txt += ` a ${Items.name(it).toLowerCase()}`;
    }
    this.msg(txt, 'good');
  },

  // ---------------- panely: kufr a obchod ----------------
  trunkCap() { return 6 + (Perks.has('kufr') ? 4 : 0); },
  scrapVal(it) { return Math.max(1, Math.round(Items.value(it) * 0.5 * (Perks.has('sberac') ? 1.5 : 1))); },
  sellVal(it) { return Math.max(1, Math.round(Items.value(it) * (Perks.has('sberac') ? 1.5 : 1))); },
  buyPrice(it) { return Math.max(2, Math.round(Items.value(it) * 2.2)); },
  openPanel(render) {
    this.uiOpen = true; this.panelRender = render;
    this.keys = {};
    $('panel').style.display = 'flex'; this.renderPanel();
    if (document.exitPointerLock) document.exitPointerLock();
  },
  renderPanel() { $('panelBox').innerHTML = this.panelRender(); },
  closePanel() { this.uiOpen = false; $('panel').style.display = 'none'; this.lock(); },
  itemRow(it, buttons) { return `<div class="row"><span class="nm" style="color:${Items.color(it)}">${Items.label(it)}</span>${buttons}</div>`; },
  openTrunk() { this.panelMode = 'trunk'; this.openPanel(() => this.renderTrunk()); },
  renderTrunk() {
    const held = Player.held, cap = this.trunkCap();
    let h = `<h2>Kufr</h2><div>${this.trunk.length}/${cap} míst · Šrot: <b>${this.scrap} kg</b></div>`;
    if (held) h += `<h3>V ruce</h3>` + this.itemRow(held, `<button data-act="store" ${this.trunk.length >= cap ? 'disabled' : ''}>Uložit do kufru</button>`);
    h += '<h3>Obsah</h3>' + (this.trunk.length ? this.trunk.map((it, i) => this.itemRow(it,
      `<button data-act="take" data-i="${i}" ${held ? 'disabled' : ''}>Vzít</button><button data-act="scrap" data-i="${i}">Rozebrat (+${this.scrapVal(it)} kg)</button>`)).join('') : '<div class="row">Prázdno</div>');
    return h + '<button class="close" data-act="close">Zavřít (E)</button>';
  },
  openShop(h) {
    if (!h.stock) {
      const km = (h.km || 0) + 2;
      h.stock = ['canister', 'oil', 'coolant', 'repairkit', 'medkit', 'ammo_pistol', 'ammo_shotgun', 'ammo_rifle'].map(t => Items.make(t));
      for (let i = 0; i < 2; i++) { const [t, d] = Items.rollOne(i ? 'spray' : 'cosm', km, Math.random); h.stock.push(Items.make(t, d)); }
      const guns = ['w_machete', 'w_bat', 'w_pistol', 'w_shotgun', 'w_sniper', 'w_smg'].filter(t => !(t in WEAPON_GATE) || km >= WEAPON_GATE[t]);
      h.stock.push(Items.make(guns[Math.floor(Math.random() * guns.length)]));
      const pool = ['engine', 'engine', 'gearbox', 'battery', 'starter', 'alternator', 'plugs', 'carb', 'fuelpump', 'radiator', 'belt', 'airfilter', 'tire', 'tank'];
      for (let i = 0; i < 6; i++) { const [t, d] = Items.rollOne(pool[Math.floor(Math.random() * pool.length)], km, Math.random, 0.5); d.cond = 85 + Math.random() * 15; h.stock.push(Items.make(t, d)); }
    }
    this.shop = h; this.panelMode = 'shop'; this.openPanel(() => this.renderShop());
  },
  renderShop() {
    const h = this.shop, held = Player.held, carNear = Math.hypot(this.car.x - Player.x, this.car.z - Player.z) < 40;
    let s = `<h2>Obchodník</h2><div>„Šrot za díly, díly za šrot. Nic jinýho tu neplatí.“ · Máš <b>${this.scrap} kg šrotu</b></div><h3>Nabídka</h3>`;
    s += h.stock.map((it, i) => this.itemRow(it, `<button data-act="buy" data-i="${i}" ${this.scrap < this.buyPrice(it) ? 'disabled' : ''}>Koupit za ${this.buyPrice(it)} kg</button>`)).join('');
    s += '<h3>Prodat</h3>';
    if (held) s += this.itemRow(held, `<button data-act="sellHeld">Prodat za ${this.sellVal(held)} kg</button>`);
    if (carNear) s += this.trunk.map((it, i) => this.itemRow(it, `<button data-act="sellTrunk" data-i="${i}">Z kufru: ${this.sellVal(it)} kg</button>`)).join('');
    if (!held && (!carNear || !this.trunk.length)) s += '<div class="row">Nemáš nic v ruce ani v kufru (auto musí být blízko).</div>';
    return s + '<button class="close" data-act="close">Zavřít (E)</button>';
  },
  panelAct(act, i) {
    const held = Player.held;
    switch (act) {
      case 'close': return this.closePanel();
      case 'store': if (held && this.trunk.length < this.trunkCap()) { Player.consumeHeld(); this.trunk.push(held); Sfx.click(); } break;
      case 'take': if (!held) { Player.hold(this.trunk.splice(i, 1)[0]); Sfx.pickup(); } break;
      case 'scrap': { const it = this.trunk.splice(i, 1)[0]; this.scrap += this.scrapVal(it); Sfx.coin(); break; }
      case 'buy': {
        const st = this.shop.stock, it = st[i], price = this.buyPrice(it);
        if (this.scrap < price) break;
        this.scrap -= price; Sfx.coin();
        let got = it;
        if ((SUPPLIES[it.type] && it.type !== 'spray') || AMMO[it.type]) got = Items.make(it.type); else st.splice(i, 1);
        if (got.def.cat === 'weapon') this.msg(Weapons.add(got.def.id), 'good');
        else if (got.def.cat === 'ammo') { Weapons.ammo[got.type] += got.data.amount; this.msg(`+${got.data.amount} ks: ${got.def.name}`, 'good'); }
        else if (!held) Player.hold(got);
        else { const [x, z] = this.feet(); Items.putDown(got, x, World.groundAt(x, z), z); this.msg('Koupeno – leží u tvých nohou'); }
        break;
      }
      case 'sellHeld': if (held) { this.scrap += this.sellVal(held); Player.consumeHeld(); Sfx.coin(); } break;
      case 'sellTrunk': { const it = this.trunk.splice(i, 1)[0]; this.scrap += this.sellVal(it); Sfx.coin(); break; }
    }
    this.renderPanel();
  },
  renderPerks() {
    const xp = Perks.xp();
    if ($('perksBtnSub')) $('perksBtnSub').textContent = xp + ' XP';
    $('perks').innerHTML = `<h3>Dílna – trvalá vylepšení · ${xp} XP</h3><div style="font-size:13px;opacity:.8;margin-bottom:6px">XP dostaneš po každé smrti: 10 XP za kilometr a 15 XP za etapu. Vylepšení platí ve všech dalších hrách.</div>` +
      PERKS.map(p => `<div class="row"><span class="nm"><b>${p.name}</b> – ${p.desc}</span>${Perks.has(p.id) ? '<span style="color:#8fd36b">✔ máš</span>' : `<button data-perk="${p.id}" ${xp < p.cost ? 'disabled' : ''}>${p.cost} XP</button>`}</div>`).join('');
    $('perks').onclick = (e) => {
      const b = e.target.closest('button[data-perk]');
      if (b && Perks.buy(b.dataset.perk)) { if (b.dataset.perk === 'lepsistart') return location.reload(); this.renderPerks(); }
    };
  },

  // ---------------- smrt ----------------
  onCrash(sp, fatal) {
    if (fatal) {
      if (!this.inCar) { this.car.impact(15, true, 'x'); return; }
      this.car.explode(); Sfx.crash(1); this.flash(0.9);
      this.die(`Nabouráno v ${Math.round(sp * 3.6)} km/h – auto se rozsypalo`);
    } else {
      Sfx.crash(Math.min(1, sp / 20)); this.flash(Math.min(0.4, sp / 40));
      if (sp > 6) this.msg(`Bouračka! Karoserie ${Math.round(this.car.body)} %`, 'bad');
    }
  },
  die(reason) {
    if (!Player.alive) return;
    Player.alive = false;
    if (Net.active) {
      Net.send({ t: 'dead', reason });
      this.penaltyT = 60;
      $('deathReason').textContent = reason;
      $('deathXp').textContent = 'Závod pokračuje – ostatní ti mezitím ujíždějí.';
      $('btnRestart').style.display = 'none'; $('btnRespawn').style.display = ''; $('btnRespawn').disabled = true;
      if (this.uiOpen) { this.uiOpen = false; $('panel').style.display = 'none'; }
      setTimeout(() => { $('death').style.display = 'flex'; if (document.exitPointerLock) document.exitPointerLock(); }, 1200);
      return;
    }
    const km = this.maxS / 1000;
    Account.run(km, true);
    if (km > this.best) { this.best = km; U.store.set('pj_best', km); }
    const xp = Math.floor((km - this.xpKm) * 10) + (this.stage - this.xpStage) * 15;
    this.xpKm = km; this.xpStage = this.stage; Perks.addXp(Math.max(0, xp));
    // sólo: smrt je konečná – žádný respawn, jen nová hra
    $('btnRespawn').style.display = 'none'; $('btnRestart').style.display = '';
    $('deathReason').textContent = reason;
    $('deathDist').textContent = `Dojel jsi ${km.toFixed(2)} km (rekord ${this.best.toFixed(2)} km)`;
    $('deathXp').textContent = `+${Math.max(0, xp)} XP do dílny (celkem ${Perks.xp()} XP)`;
    if (this.uiOpen) { this.uiOpen = false; $('panel').style.display = 'none'; }
    setTimeout(() => { $('death').style.display = 'flex'; if (document.exitPointerLock) document.exitPointerLock(); }, 1600);
  },
  respawn() {
    if (!Net.active || this.penaltyT > 0) return;   // v sólo hře se po smrti nedá vrátit
    $('death').style.display = 'none';
    Hazards.clearCreatures();
    const c = this.car;
    if (this.inCar) this.exitCar();
    if (c.exploded) {
      c.reassemble();
      const bx = c.x + Math.cos(c.yaw) * 2.6 + Math.sin(c.yaw) * 1.5, bz = c.z - Math.sin(c.yaw) * 2.6 + Math.cos(c.yaw) * 1.5;
      Items.spawn('repairkit', bx, World.groundAt(bx, bz), bz);
      Player.x = c.x + Math.cos(c.yaw) * 2; Player.z = c.z - Math.sin(c.yaw) * 2; Player.yaw = c.yaw + Math.PI;
      this.msg('Auto je slepené dohromady, ale je na tom bledě. U auta leží opravná sada.', 'warn');
    }
    Player.y = World.groundAt(Player.x, Player.z); Player.vy = 0; Player.pitch = 0;
    Player.alive = true; Player.health = Math.round(Player.maxHealth * 0.6);
    this.lock();
  },
  flash(a) { const f = $('flash'); f.style.transition = 'none'; f.style.opacity = a; setTimeout(() => { f.style.transition = 'opacity .5s'; f.style.opacity = 0; }, 30); },
  // klávesnice + volant/gamepad (analogově) → vstup auta
  carInp(raw, hb) {
    const K = (a) => (Settings.kdown(raw, a) ? 1 : 0);
    const m = this.freezeT > 0 ? { thr: 0, brk: 0, steer: 0, direct: false, ss: 1 } : Pad.mix(K('forward'), K('back'), K('left') - K('right'));
    return { throttle: m.thr, brake: m.brk, steer: m.steer, handbrake: hb, direct: m.direct, ss: m.ss };
  },
  msg(text, cls) {
    const box = $('msgs'), d = document.createElement('div');
    d.className = 'msg ' + (cls || ''); d.textContent = text; box.appendChild(d);
    while (box.children.length > 4) box.removeChild(box.firstChild);
    setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 700); }, 4200);
  },
  bigText(t) { const b = $('biome'); b.textContent = t; b.style.opacity = 1; clearTimeout(this._bt); this._bt = setTimeout(() => { b.style.opacity = 0; }, 3000); },

  // ---------------- smyčka ----------------
  loop() {
    requestAnimationFrame(() => this.loop());
    const rawDt = this.clock.getDelta();
    this.autoRes(rawDt);
    const dt = this.smoothDt(rawDt);
    if (Sfx.ctx && !Radio.ready) Radio.init();
    this._rwT = (this._rwT || 0) - dt; if (this._rwT <= 0) { this._rwT = 1; this.renderRadioW(); }
    if (Drag.active) { Weather.silence(); Drag.frame(dt); return; }
    if (Rally.active) { Weather.silence(); Rally.frame(dt); return; }
    if (Air.active) { Weather.silence(); Air.frame(dt); return; }
    if (Dealer.active) { Weather.silence(); Dealer.frame(dt); return; }
    Radio.setMuffle(this.playing && !this.inCar ? 1 : 0);
    if (Player.holder) Player.holder.visible = this.playing;   // v menu žádná ruka s věcí před kamerou
    if (!this.playing) { if (Player.fist) Player.fist.visible = false; if (Weapons.vm) Weapons.vm.visible = false; }
    if (this.playing && !this.paused && !this.uiOpen) this.update(dt);
    else if (!this.playing) { World.update(this.camera.position.x, this.camera.position.z); this.menuCam(dt); }
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    if (this.inCar && this.playing) this.renderMirrors();
  },
  // automatické rozlišení: hlídá opožděné snímky (ty jsou vidět jako škubnutí, i když průměr FPS vypadá dobře).
  // Cíl je obnovovací frekvence monitoru, nejvýš ale 60 FPS (na 144Hz monitoru se nesnižuje kvůli tomu, že to nedá 144).
  // Když se opozdí víc než ~4 % snímků, sníží se rozlišení (nejvýš na 50 %); s rezervou se pomalu vrací.
  autoRes(raw) {
    if (!Settings.s.autoRes) { if (this._arK && this._arK !== 1) { this._arK = 1; Settings.apply && Settings.apply(); } return; }
    if (document.hidden || raw <= 0.002 || raw > 0.25 || !(Rally.active || Drag.active || Air.active || (this.playing && !this.paused))) { this._arS = this._arN = this._arL = 0; return; }   // menu/pauza/zásek při načítání se nepočítá
    this._arMin = Math.min(this._arMin || 1, raw);
    const target = Math.max(this._arRef || 1 / 60, 1 / 61);
    this._arS = (this._arS || 0) + raw; this._arN = (this._arN || 0) + 1;
    if (raw > target * 1.45) this._arL = (this._arL || 0) + 1;
    if (this._arS < 1.5) return;
    const late = (this._arL || 0) / this._arN, avg = this._arS / this._arN;
    this._arRef = this._arMin * 1.02; this._arMin = 1;   // obnovovací interval monitoru = nejkratší snímek okna
    this._arS = this._arN = this._arL = 0;
    let k = this._arK || 1;
    const now = performance.now();
    if (late > 0.04 && k > 0.51) { k = Math.max(0.5, k - (late > 0.3 ? 0.15 : 0.07)); this._arUp = 0; this._arHold = now + 10000; }   // po snížení chvíli nezvyšovat
    else if (late < 0.005 && avg < target * 1.08 && k < 1 && now > (this._arHold || 0)) { if (++this._arUp >= 3) { k = Math.min(1, k + 0.05); this._arUp = 0; } }
    else this._arUp = 0;
    if (k !== (this._arK || 1)) {
      this._arK = k = Math.round(k * 100) / 100;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, Settings.s.scale / 100) * k);
      this.renderer.setSize(innerWidth, innerHeight);
    }
  },
  // vyhlazený krok: rozptyl časů mezi snímky (16,2 / 17,1 / 15,9 ms…) dělá „sekání“ – auto se posune pokaždé o jinak velký kus,
  // i když monitor ukazuje snímky pravidelně. Použije se průměr; skutečný čas se dohání po malých kouscích (nic se neztratí).
  // Opravdový zásek (snímek trvá výrazně déle) se vezme celý, ať hra nezpomalí.
  smoothDt(raw) {
    raw = Math.min(0.1, Math.max(0, raw));
    if (!this._dtAvg) { this._dtAvg = raw || 1 / 60; this._dtErr = 0; }
    const avg = this._dtAvg;
    let dt;
    if (raw > avg * 1.7 || raw < avg * 0.4) { dt = raw; this._dtErr = 0; }
    else {
      this._dtAvg += (raw - avg) * 0.05;
      this._dtErr += raw - this._dtAvg;
      const fix = U.clamp(this._dtErr * 0.15, -this._dtAvg * 0.2, this._dtAvg * 0.2);
      dt = this._dtAvg + fix; this._dtErr -= fix;
    }
    if (raw > avg * 1.7) this._dtAvg += (Math.min(raw, avg * 2) - avg) * 0.02;
    return Math.min(0.05, dt);
  },
  // zpětná zrcátka: kamera v každém zrcátku renderuje do textury (každý druhý snímek)
  renderMirrors() {
    if (!Settings.s.mirrors) return;
    const ms = this.car.parts.mirrors; if (!ms || !ms.length) return;
    // každý snímek jen jedno zrcátko (střídavě), aby to nezatěžovalo slabší grafiky
    this._mf = !this._mf; if (this._mf) return;           // zrcátka jen každý druhý snímek
    this._mi = ((this._mi || 0) + 1) % ms.length;
    const r = this.renderer, m = ms[this._mi];
    for (const q of ms) q.glass.visible = false;
    Weapons.vm.visible = false;
    r.setRenderTarget(m.rt); r.render(this.scene, m.cam); r.setRenderTarget(null);
    for (const q of ms) q.glass.visible = true;
  },
  menuCam(dt) {
    Weather.silence();
    this._mt = (this._mt || 0) + dt * 0.05;
    // výška podle terénu (náhodný svět může mít v místě kopec → dřív byla kamera pod zemí)
    const x = Math.sin(this._mt) * 22, z = 8 + Math.cos(this._mt) * 22;
    let gy = World.height(x, z);
    for (const [ax, az] of [[x * 0.7, z], [x, z * 0.85], [x * 0.4, (z + 12) / 2]]) gy = Math.max(gy, World.height(ax, az) - 1);   // ani ve výhledu nic nezakryje
    const ty = World.height(0, 12);
    if (!isFinite(gy)) gy = 0;
    this._my = this._my === undefined || Math.abs(this._my - gy) > 20 ? gy : this._my + (gy - this._my) * Math.min(1, dt * 2);
    this.camera.position.set(x, Math.max(this._my, ty) + 7, z);
    this.camera.lookAt(0, (isFinite(ty) ? ty : 0) + 1.5, 12);
    this._eye.copy(this.camera.position);
    Hazards.update(0, { player: Player, car: this.car, inCar: false, km: 0, eye: this._eye });
    Ambient.update(dt, this._eye, Hazards.env, World.biome(this._eye.z).name, Hazards.df || 1);
  },
  update(dt) {
    const car = this.car;
    // odpočet před startem závodu – nic se neovládá
    if (this.freezeT > 0) {
      this.freezeT -= dt;
      const n = Math.ceil(this.freezeT);
      if (n !== this._lastCount) { this._lastCount = n; this.bigText(n > 0 ? String(n) : 'START!'); Sfx.tone(n > 0 ? 440 : 880, 0.25, 0.2, 'square'); }
    }
    // odpočet penalizace po smrti v závodě
    if (this.penaltyT > 0) {
      this.penaltyT -= dt;
      const n = Math.ceil(Math.max(0, this.penaltyT));
      $('deathDist').innerHTML = n > 0 ? `Penalizace: respawn za <b style="font-size:40px;color:#ffcf86">${n} s</b>` : 'Můžeš se vrátit do závodu!';
      $('btnRespawn').disabled = n > 0; $('btnRespawn').textContent = n > 0 ? `Respawn za ${n} s` : 'Spawnout se u vraku';
    }
    const raw = this.freezeT > 0 ? {} : this.keys, D = (a) => Settings.down(raw, a);
    const k = { KeyW: D('forward'), KeyS: D('back'), KeyA: D('left'), KeyD: D('right'), Space: D('jump'), ShiftLeft: D('run'), KeyE: D('interact'), HB: D('handbrake') };
    const driving = this.inCar && Player.alive;
    const inp = driving
      ? this.carInp(raw, k.HB)
      : { throttle: 0, brake: car.speed > 0.5 ? 0.6 : 0, steer: 0, handbrake: true };
    car.update(dt, inp, Hazards.env);
    Hands.updateCar(car.handsRig, car, this.inCar && Player.alive, dt);
    if (this.inCar) {
      Player.x = car.x; Player.z = car.z; Player.y = car.y;
      if (!car.exploded) {
        this._sh = (this._sh || 0) + dt * 37;
        const sh = car.shake * 0.02;
        this.camera.position.set(0.38 + Math.sin(this._sh) * sh, 1.25 + Math.sin(this._sh * 1.3) * sh, -0.3);
        this.camera.rotation.set(Player.lookPitch, Math.PI + Player.lookYaw, 0);
      }
    } else Player.update(dt, k, car);
    if (!Player.alive) this.camera.rotation.z = U.lerp(this.camera.rotation.z, 0.9, dt * 2);
    else if (!this.inCar) this.camera.rotation.z = 0;
    this.camera.getWorldPosition(this._eye);
    // zbraně: z auta jen střelné, s věcí v ruce se nestřílí
    const canFire = Player.alive && !Player.held && !(this.inCar && Weapons.w.melee);
    this.camera.updateMatrixWorld(); this.camera.getWorldDirection(this._fdir);
    Weapons.update(dt, { firing: canFire && this.mouseDown, click: this.clickQueued, origin: this._eye, dir: this._fdir, inCar: this.inCar,
      aim: canFire && this.aim, show: !this.inCar && Player.alive && !Player.held });
    this.clickQueued = false;
    World.update(this._eye.x, this._eye.z);
    const pr = World.progress(Player.x, Player.z);
    if (pr && pr.d < 60 && pr.s > this.maxS) this.maxS = pr.s;
    const km = this.maxS / 1000;
    Account.tick(km);
    const st = Math.floor(this.maxS / 5000);
    if (st > this.stage) { this.stage = st; this.scrap += 15; this.bigText(`ETAPA ${st + 1}`); this.msg(`Ujel jsi ${st * 5} km! Bonus +15 kg šrotu`, 'good'); Sfx.coin(); }
    Hazards.update(dt, { player: Player, car, inCar: this.inCar, km, eye: this._eye });
    Weather.update(dt, { player: Player, car, inCar: this.inCar, km, eye: this._eye });
    Ambient.update(dt, this._eye, Hazards.env, World.biome(this._eye.z).name, Hazards.df);
    if (Net.active) {
      Net.update(dt);
      if (!Net.raceOver && this.maxS >= RACE_KM * 1000) { Net.send({ t: 'win', km }); this.raceEnd(Net.slot, `Dojel jsi do cíle (${RACE_KM} km) jako první!`); }
    }
    const es = car.espec, sp = this.inCar ? car.speed : 0;
    Sfx.engine({ rpm: car.rpm * (car.misfireT > 0 ? 0.8 : 1), throttle: car.throttle, running: car.running && !car.exploded, speed: sp, slip: this.inCar ? car.slip : 0,
      wspin: car.wspin, lock: (car._brakeVis && sp > 8 ? 0.3 : 0) + (car.handbrake && sp > 5 ? 0.55 : 0), onRoad: car.onRoad, inCar: this.inCar,
      dist: Math.hypot(Player.x - car.x, Player.z - car.z), lay: es ? car.slots.engine.lay : 'i4', cyl: es ? es.cyl : 4, ind: es ? es.ind : 0,
      boost: car.boost, exhaust: !!car.cosm.exhaust });
    // rádio v autě: míření na displej / knoflíky
    this.radioAim = null;
    if (this.inCar && Player.alive && car.parts.radio) {
      this.ray.set(this._eye, this._fdir); this.ray.far = 1.4;
      const hit = this.ray.intersectObjects(car.parts.radio.meshes, false)[0];
      if (hit) this.radioAim = hit.object.userData.radio;
    }
    this._radT = (this._radT || 0) - dt;
    if (this.inCar && this._radT <= 0) { this._radT = 0.1; CarModel.drawRadio(car.parts, Radio.info(), true, !!this.radioAim); }
    // míření a držení E u vraku
    this.target = (!this.inCar && Player.alive) ? this.computeTarget() : null;
    if (this.target && this.target.kind === 'wreck' && k.KeyE) {
      this.holdT += dt;
      if ((this._rt = (this._rt || 0) - dt) <= 0) { this._rt = 0.3; Sfx.ratchet(); }
      if (this.holdT >= 3) { this.holdT = 0; this.finishWreck(this.target.o); }
    } else this.holdT = 0;
    this._fpsN = (this._fpsN || 0) + 1; this._fpsT = (this._fpsT || 0) + dt;
    if (this._fpsT >= 0.5) { $('fps').textContent = Settings.s.fps ? Math.round(this._fpsN / this._fpsT) + ' FPS' : ''; this._fpsN = 0; this._fpsT = 0; }
    this._hudT -= dt;
    if (this._hudT <= 0) { this._hudT = 0.1; this.updateHud(km); }
    $('hold').style.display = this.holdT > 0 ? 'block' : 'none';
    $('hold').firstChild.style.width = (this.holdT / 3 * 100) + '%';
  },

  updateHud(km) {
    const car = this.car, bio = World.biome(Player.z);
    if (bio.name !== this.biomeName) { this.biomeName = bio.name; this.bigText(bio.name.toUpperCase()); }
    let html = `<div style="opacity:.85">👤 <b>${this.nick()}</b></div>`;
    html += Net.active ? `<div style="color:#ffcf86"><b>ZÁVOD DO ${RACE_KM} KM</b></div>` + [{ slot: Net.slot, nick: this.nick(), km }].concat(Net.others().map(p => ({ slot: p.slot, nick: p.nick, km: p.km || 0, dead: p.dead })))
      .sort((a, b) => b.km - a.km).map((p, i) => `<div style="color:${SLOT_COL[p.slot]}">${i + 1}. ${String(p.nick).replace(/[<>&]/g, '')}: ${p.km.toFixed(2)} km</div>`).join('') : '';
    html += `<div class="big">${km.toFixed(2)} km</div>Rekord: ${Math.max(this.best, km).toFixed(2)} km · Etapa ${this.stage + 1}<br>${bio.name} · ${Hazards.clock()}${Hazards.isNight() ? ' 🌙' : ''}<br>Šrot: <b>${this.scrap} kg</b> · Kufr ${this.trunk.length}/${this.trunkCap()}`;
    if (this.maxS < 60) {
      const ok = (b) => b ? '✔' : '✘';
      const inst = BAY_SLOTS.filter(s => car.slots[s]).length, miss = car.missing();
      html += `<br><br><b>Úkol: zprovozni auto</b><br>${ok(car.hoodOpen || inst === BAY_SLOTS.length)} kapota otevřená (E na předek)<br>${ok(!miss.length)} díly motoru ${inst}/${BAY_SLOTS.length}`;
      if (miss.length) html += `<br><span style="opacity:.8;font-size:13px">chybí: ${miss.join(', ')}</span>`;
      html += `<br>${ok(car.fuel > 10)} benzín (${car.fuel.toFixed(0)} l)<br>${ok(car.oil > 2.5)} olej<br>${ok(car.coolant > 4)} chladicí kapalina<br>${ok(car.running)} nastartovat (C v autě)`;
    }
    if (!this.inCar && !car.exploded) {
      const d = Math.hypot(Player.x - car.x, Player.z - car.z);
      if (d > 25) html += `<br>Auto: ${Math.round(d)} m`;
    }
    $('stats').innerHTML = html;
    $('healthFill').style.width = (Player.health / Player.maxHealth * 100) + '%';
    $('held').innerHTML = Player.held ? `V ruce: <span style="color:${Items.color(Player.held)}">${Items.label(Player.held)}</span>` : '';
    $('crosshair').style.display = (this.inCar && Weapons.w.melee) || Weapons.zoom ? 'none' : 'block';
    $('weapon').innerHTML = Weapons.hud();
    $('weapon').style.display = this.inCar && Weapons.w.melee ? 'none' : 'block';
    $('scope').style.display = Weapons.zoom ? 'block' : 'none';
    // diagnostika u otevřené kapoty
    const near = !this.inCar && !car.exploded && car.hoodOpen && Math.hypot(Player.x - car.x, Player.z - car.z) < 5;
    if (near) {
      const row = (n, p, req) => {
        if (!p) return `<div>${n}${req ? ' *' : ''}: <b style="color:#ff6a50">chybí</b></div>`;
        const c = p.cond, col = c < 25 ? '#ff5a4a' : c < 50 ? '#ffb347' : '#6be38a';
        return `<div><span style="color:${TIERS[p.tier].color}">■</span> ${n}<span class="bar"><i style="width:${c}%;background:${col}"></i></span>${Math.round(c)} %</div>`;
      };
      $('diag').innerHTML = '<b>MOTOROVÝ PROSTOR</b> <span style="opacity:.7">(* nutné k jízdě)</span>' + BAY_SLOTS.map(s => row(PARTS[s].name, car.slots[s], PARTS[s].req)).join('') +
        car.tires.map((t, i) => row('Kolo ' + TIRE_NAMES[i], t)).join('') + `<div style="margin-top:4px">Nádrž ${car.tankCap} l · Karoserie ${Math.round(car.body)} %</div>`;
    }
    $('diag').style.display = near ? 'block' : 'none';
    $('help').style.display = this.showHelp && !near ? 'block' : 'none';
    let p = '';
    if (Player.alive && !this.inCar) { const a = this.actionFor(this.target); if (a) p = a.text; }
    else if (this.inCar && Player.alive && this.radioAim) p = { power: '<b>E</b> / klik: rádio zapnout/vypnout', tune: '<b>E</b> / klik: další stanice', st0: '<b>E</b> / klik: předvolba 1', st1: '<b>E</b> / klik: předvolba 2', st2: '<b>E</b> / klik: předvolba 3', st3: '<b>E</b> / klik: předvolba 4' }[this.radioAim] + ' · kolečko: hlasitost';
    else if (this.inCar && Player.alive && !car.running) p = `<b>C</b> nastartovat · <b>E</b> vystoupit`;
    const KN = (x) => Settings.keyName(Settings.key(x));
    p = p.replace(/<b>Drž E<\/b>/g, `<b>Drž ${KN('interact')}</b>`).replace(/<b>E<\/b>/g, `<b>${KN('interact')}</b>`).replace(/<b>G<\/b>/g, `<b>${KN('drop')}</b>`).replace(/<b>C<\/b>/g, `<b>${KN('engine')}</b>`);
    const pe = $('prompt'); pe.innerHTML = p; pe.style.display = p ? 'block' : 'none';
    const K = (a) => `<b>${Settings.keyName(Settings.key(a))}</b>`;
    $('help').innerHTML = this.inCar
      ? `${K('forward')} plyn · ${K('back')} brzda/couvání<br>${K('left')}/${K('right')} zatáčení · ${K('handbrake')} ručka<br>${K('engine')} motor · ${K('gearmode')} automat/manuál<br>${K('shiftUp')}/${K('shiftDown')} řazení (manuál) · ${K('lights')} světla<br>${K('horn')} klakson · <b>LMB</b> střelba z okna<br>${K('radio')} rádio · ${K('radioNext')} stanice · nebo se podívej na rádio<br>${K('interact')} vystoupit · ${K('help')} skrýt · ${K('settings')} nastavení`
      : `${K('forward')}${K('left')}${K('back')}${K('right')} chůze · ${K('run')} běh · ${K('jump')} skok<br><b>LMB</b> útok/výstřel · <b>PMB</b> puškohled<br>${K('reload')} nabít · <b>1–8 / kolečko</b> zbraně<br>${K('interact')} vzít / použít / kapota / kufr<br>Drž ${K('interact')} rozebrat vrak<br>${K('drop')} zahodit · ${K('help')} skrýt · ${K('settings')} nastavení`;
  },
};

window.Game = Game;
Game.init();
