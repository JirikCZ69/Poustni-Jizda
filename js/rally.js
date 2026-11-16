// rally.js – režim Rally: garáž s díly a vzhledem, etapy na čas, spolujezdec (AI nebo kámoš s tabletem),
// reálné škody (promáčklé plechy, odpadlá kapota, utržená kola), peníze/XP a žebříček časů
const RALLY_CATS = [
  { id: 'tires', name: 'Pneumatiky', items: [
    { n: 'Ojeté univerzální', d: 'Ze šrotu. Drží všude stejně špatně.', c: 'all', tier: 0.88, price: 0, lvl: 1 },
    { n: 'Silniční sport', d: 'Nejlepší na asfaltu, na šotolině plavou.', c: 'road', tier: 1, price: 800, lvl: 1 },
    { n: 'Šotolinové', d: 'Hrubý vzorek – šotolina a tvrdá hlína.', c: 'gravel', tier: 1, price: 900, lvl: 1 },
    { n: 'Pouštní balónové', d: 'Široké a měkké – písek a duny.', c: 'sand', tier: 1, price: 1100, lvl: 2 },
    { n: 'Silniční závodní slick', d: 'Asfaltový král. Mimo asfalt nebezpečné.', c: 'road', tier: 1.1, price: 2600, lvl: 4 },
    { n: 'Šotolinové závodní', d: 'Tvrdá směs pro rychlou šotolinu.', c: 'gravel', tier: 1.1, price: 2800, lvl: 4 },
    { n: 'Písečné závodní', d: 'Lopatkový vzorek pro hluboký písek.', c: 'sand', tier: 1.1, price: 3000, lvl: 5 },
    { n: 'Univerzální WRC', d: 'Kompromis, který drží skoro všude.', c: 'all', tier: 1.13, price: 6500, lvl: 8 },
  ] },
  { id: 'engine', name: 'Motor', items: [
    { n: '1.6 sériový', d: '110 k, líný, ale vydrží.', hp: 110, red: 6500, price: 0, lvl: 1 },
    { n: '2.0 16V', d: '165 k a ostřejší vačky.', hp: 165, red: 7000, price: 1500, lvl: 1 },
    { n: '2.0 ostrý', d: '210 k, kované písty.', hp: 210, red: 7300, price: 3200, lvl: 2 },
    { n: 'Závodní 2.0', d: '260 k, suchá kliková skříň.', hp: 260, red: 7600, price: 5500, lvl: 4 },
    { n: 'Kitcar', d: '320 k, točí jako motorka.', hp: 320, red: 8200, price: 9000, lvl: 6 },
    { n: 'WRC 1.6T blok', d: '380 k s restriktorem.', hp: 380, red: 7800, price: 15000, lvl: 8 },
    { n: 'Group B', d: '500 k. Legenda a sebevražda.', hp: 500, red: 8000, price: 26000, lvl: 10 },
  ] },
  { id: 'turbo', name: 'Turbo', items: [
    { n: 'Bez turba', d: 'Atmosféra, okamžitá odezva.', boost: 0, lag: 0, price: 0, lvl: 1 },
    { n: 'Malé turbo', d: '+20 % točivého momentu, skoro bez prodlevy.', boost: 0.2, lag: 0.5, price: 1200, lvl: 2 },
    { n: 'Střední turbo', d: '+35 %, chce udržet otáčky.', boost: 0.35, lag: 0.85, price: 3000, lvl: 3 },
    { n: 'Velké turbo', d: '+55 %, ale dlouhá turbodíra.', boost: 0.55, lag: 1.4, price: 6000, lvl: 6 },
    { n: 'Turbo s antilagem', d: '+50 % a ALS drží plnicí tlak i mimo plyn. Střílí z výfuku.', boost: 0.5, lag: 0.5, als: true, price: 11000, lvl: 8 },
  ] },
  { id: 'gearbox', name: 'Převodovka', items: [
    { n: '5st manuál', d: 'Dlouhé převody, řazení 0,35 s.', ratios: [3.45, 2.1, 1.45, 1.1, 0.86], final: 4.1, shift: 0.35, price: 0, lvl: 1 },
    { n: '5st sportovní', d: 'Kratší převody, řazení 0,22 s.', ratios: [3.2, 2.2, 1.65, 1.3, 1.05], final: 4.4, shift: 0.22, price: 1400, lvl: 2 },
    { n: '6st sekvenční', d: 'Zuby místo synchronů, 0,09 s.', ratios: [3.0, 2.2, 1.75, 1.42, 1.18, 1.0], final: 4.6, shift: 0.09, price: 4500, lvl: 4 },
    { n: '6st WRC pádla', d: 'Pneumatické řazení za 0,04 s.', ratios: [2.9, 2.15, 1.72, 1.42, 1.2, 1.03], final: 4.75, shift: 0.04, price: 9000, lvl: 7 },
  ] },
  { id: 'susp', name: 'Podvozek', items: [
    { n: 'Sériový', d: 'Měkký, na skoky nestavěný.', grip: 1, land: 1, k: 0.85, price: 0, lvl: 1 },
    { n: 'Rally šotolina', d: 'Delší zdvih: +3 % přilnavosti, dopady −40 % škod.', grip: 1.03, land: 0.6, k: 1, price: 1800, lvl: 2 },
    { n: 'Závodní Reiger', d: '+6 % přilnavosti, dopady −65 % škod.', grip: 1.06, land: 0.35, k: 1.3, price: 5000, lvl: 5 },
  ] },
  { id: 'brakes', name: 'Brzdy', items: [
    { n: 'Sériové', d: 'Bubny vzadu.', brake: 1, price: 0, lvl: 1 },
    { n: 'Sportovní kotouče', d: '+30 % brzdné síly.', brake: 1.3, price: 900, lvl: 1 },
    { n: 'Závodní 4pístky', d: '+60 % brzdné síly.', brake: 1.6, price: 3000, lvl: 4 },
  ] },
  { id: 'weight', name: 'Odlehčení', items: [
    { n: 'Sériová karoserie', d: '1250 kg.', mass: 1250, price: 0, lvl: 1 },
    { n: 'Bez zadních sedaček', d: '1180 kg.', mass: 1180, price: 1200, lvl: 2 },
    { n: 'Karbonové díly', d: '1100 kg.', mass: 1100, price: 4000, lvl: 5 },
    { n: 'Kevlar a plexi', d: '1030 kg.', mass: 1030, price: 8000, lvl: 8 },
  ] },
];
// doplňky: [klíč, cena, popis]; extra = vlastní rally doplňky, ostatní jsou společné COSM
const RALLY_LOOK = [
  ['num', 450, 'Startovní čísla a sponzoři', 'extra'], ['mud', 300, 'Lapače bláta', 'extra'], ['skid', 1200, 'Kryt podvozku (−50 % škod při dopadu)', 'extra'],
  ['vent', 300, 'Střešní nasávání', 'extra'], ['lightbar', 700, 'Rampa světel', 'cosm'], ['bullbar', 900, 'Bullbar (−25 % škod zepředu)', 'cosm'],
  ['spoiler', 400, 'Spoiler', 'cosm'], ['wing', 900, 'Závodní křídlo', 'cosm'], ['fenders', 600, 'Rozšířené blatníky', 'cosm'], ['stripes', 300, 'Pruhy', 'cosm'],
  ['rims_black', 300, 'Černá kola', 'cosm'], ['rims_chrome', 400, 'Chromová kola', 'cosm'], ['rims_gold', 900, 'Zlatá kola', 'cosm'],
];
const RALLY_CALLS = [['Levá!', 'Digit1'], ['Pravá!', 'Digit2'], ['Vracák!', 'Digit3'], ['Brzdi!', 'Digit4'], ['Naplno!', 'Digit5'], ['Skok!', 'Digit6'], ['Pomalu, opatrně', 'Digit7'], ['Dobrý, dobrý!', 'Digit8']];
const RALLY_TEAM_COL = ['#ffb347', '#5ab0ff'];
const RALLY_HIT = { tree: 4.6, joshua: 3.6, rock: 5.6, cactus: 1.2, pole: 0.25, pine: 4.8, oak: 5.2, bush: 0.3, rail: 1.3, cone: 0 };

const Rally = {
  active: false, mode: null, tab: 'stage', sel: 0, stages: {},
  // ---------- profil ----------
  load() {
    const d = { money: 1500, xp: 0, lvl: 1, own: {}, eq: {}, paint: 0x2a5ab0, cosm: {}, ex: {}, lookOwn: [], best: {}, stage: 0, num: 1 + Math.floor(Math.random() * 98), auto: true, tts: true, cam: 'chase' };
    this.sv = Object.assign(d, U.store.get('pj_rally', {}));
    for (const c of RALLY_CATS) { if (!this.sv.own[c.id]) this.sv.own[c.id] = [0]; if (this.sv.eq[c.id] === undefined) this.sv.eq[c.id] = 0; }
  },
  store() { U.store.set('pj_rally', this.sv); },
  xpNeed(l) { return Math.round(150 * Math.pow(l, 1.4)); },
  addXp(n) {
    const sv = this.sv, ups = []; sv.xp += n;
    while (sv.xp >= this.xpNeed(sv.lvl)) { sv.xp -= this.xpNeed(sv.lvl); sv.lvl++; const b = 400 * sv.lvl; sv.money += b; ups.push([sv.lvl, b]); }
    return ups;
  },
  part(cat, sv) { sv = sv || this.sv; const c = RALLY_CATS.find(q => q.id === cat); return c.items[sv.eq[cat]] || c.items[0]; },
  stats(sv) {
    sv = sv || this.sv;
    const e = this.part('engine', sv), t = this.part('turbo', sv), g = this.part('gearbox', sv), s = this.part('susp', sv), b = this.part('brakes', sv), w = this.part('weight', sv), ti = this.part('tires', sv);
    const extraKg = (sv.cosm.front === 'bullbar' ? 18 : 0) + (sv.ex.skid ? 14 : 0) + (sv.cosm.roof === 'lightbar' ? 8 : 0);
    return { hp: e.hp, red: e.red, boost: t.boost, lag: t.lag, als: !!t.als, ratios: g.ratios, final: g.final, shift: g.shift, mass: w.mass + extraKg, brake: b.brake,
      land: s.land * (sv.ex.skid ? 0.5 : 1), springK: s.k || 1, tire: { c: ti.c, tier: ti.tier * s.grip }, tireName: ti.n, bull: sv.cosm.front === 'bullbar', aero: sv.cosm.rear === 'wing' ? 0.06 : 0, auto: !!sv.auto };
  },
  look(sv) { sv = sv || this.sv; return { body: Dealer.sel(), paint: sv.paint, cosm: Object.assign({}, sv.cosm), ex: Object.assign({}, sv.ex), num: sv.num }; },
  gripOn(st, surf) { return RALLY_SURF[surf].mu * RALLY_COMPOUND[st.tire.c][surf] * st.tire.tier; },
  stageGrip(st, stage) { let a = 0, n = 0; for (const [k, w] of Object.entries(stage.mix)) { a += this.gripOn(st, k) / RALLY_SURF[k].mu * w; n += w; } return a / n; },
  fmt(t) { if (t === undefined || t === null || !isFinite(t)) return '—'; const m = Math.floor(t / 60); return `${m}:${(t - m * 60).toFixed(2).padStart(5, '0')}`; },
  medal(stage, t, par) { const r = t / par; return r <= 1.06 ? 3 : r <= 1.2 ? 2 : r <= 1.38 ? 1 : 0; },

  // ---------- garáž ----------
  enterGarage() {
    this.load(); this.active = true; this.mode = 'garage';
    Sfx.init();
    for (const id of ['menu', 'race', 'rallyHud', 'lobby']) $(id).style.display = 'none';
    $('rGarage').style.display = 'block';
    if (!this.gScene) this.buildGarage();
    this.refreshCar(); this.renderGarage();
    Sfx.engine({ rpm: 0, throttle: 0, running: false, speed: 0, slip: 0, wspin: 0, lock: 0, onRoad: true, inCar: false, dist: 99, lay: 'i4', cyl: 4 });
    if (!this.wr) Account.rallyBoard().then(d => { if (d) { this.wr = d; if (this.mode === 'garage') this.renderGarage(); } });
  },
  exit() {
    if (!this.active) return;
    this.active = false; this.mode = null; this.say(null);
    for (const id of ['rGarage', 'rallyHud']) $(id).style.display = 'none';
    Sfx.engine({ rpm: 0, throttle: 0, running: false, speed: 0, slip: 0, wspin: 0, lock: 0, onRoad: true, inCar: false, dist: 99, lay: 'i4', cyl: 4 });
  },
  toMenu() { this.exit(); $('menu').style.display = 'flex'; },
  buildGarage() {
    const sc = this.gScene = new THREE.Scene();
    sc.background = new THREE.Color(0x14110e);
    sc.add(new THREE.HemisphereLight(0xfff0e0, 0x3a3028, 0.6));
    const key = new THREE.SpotLight(0xfff0d8, 1.25, 40, 0.75, 0.5, 1); key.position.set(-4, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); sc.add(key); sc.add(key.target);
    const rim = new THREE.PointLight(0x50ff90, 0.6, 18); rim.position.set(5, 3, -4); sc.add(rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: 0x585450, map: Tex.get('floor') }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
    // rally servisní zóna: plachta na zemi, pneumatiky, hever
    const tarp = new THREE.Mesh(new THREE.PlaneGeometry(7, 8), U.mat(0x2a4a32)); tarp.rotation.x = -Math.PI / 2; tarp.position.y = 0.01; tarp.receiveShadow = true; sc.add(tarp);
    const m = new U.Merger();
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) m.add(new THREE.CylinderGeometry(0.36, 0.36, 0.25, 14), U.compose(-4.6 + i * 0.85, 0.13 + k * 0.26, 3.2, 0, 0, 0, 1, 1, 1), 0x1c1c1c);
    m.addBox(1.8, 0.05, 0.9, 4.4, 0.7, 3.4, 0.3, 0x8a8a86); for (const x of [3.7, 5.1]) for (const z of [3.1, 3.7]) m.addBox(0.05, 0.7, 0.05, x, 0.35, z, 0.3, 0x3a3a3a);
    sc.add(m.build());
    this.gDecor = GarageDecor.build(sc);
    this.gTurn = new THREE.Group(); sc.add(this.gTurn);
    this.gCam = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
    this.gYaw = 0.75; this.gPitch = 0.2; this.gDist = 8.5;
    const cv = Game.renderer.domElement;
    cv.addEventListener('pointerdown', (e) => { if (this.mode === 'garage') this._drag = [e.clientX, e.clientY]; });
    addEventListener('pointerup', () => { this._drag = null; });
    addEventListener('pointermove', (e) => {
      if (this.mode !== 'garage' || !this._drag) return;
      this.gYaw -= (e.clientX - this._drag[0]) * 0.008; this.gPitch = U.clamp(this.gPitch + (e.clientY - this._drag[1]) * 0.004, 0.02, 0.9);
      this._drag = [e.clientX, e.clientY]; this.gIdle = 0;
    });
    cv.addEventListener('wheel', (e) => { if (this.mode === 'garage') this.gDist = U.clamp(this.gDist + e.deltaY * 0.005, 5, 11); }, { passive: true });
  },
  refreshCar() {
    if (this.gParts) this.gTurn.remove(this.gParts.root);
    this.gParts = this.makeCar(this.look()); this.gTurn.add(this.gParts.root);
  },
  // model auta s rally doplňky
  makeCar(lk) {
    const p = CarModel.build(lk.paint, lk.body);
    p.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    let rim = null;
    for (const [slot, kind] of Object.entries(lk.cosm || {})) { if (!kind || !COSM[kind]) continue; CarModel.applyCosm(p, slot, kind, { col: 0xf0f0f0 }); if (COSM[kind].rim) rim = COSM[kind].rim; }
    p.wheels.forEach(w => w.rimMat.color.setHex(rim || 0xd8d8d0));
    const ex = lk.ex || {}, g = new THREE.Group(); p.root.add(g);
    if (ex.num) {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const c = cv.getContext('2d');
      c.fillStyle = '#f4f4f0'; c.beginPath(); c.arc(128, 128, 120, 0, 7); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 10; c.stroke();
      c.fillStyle = '#111'; c.font = 'bold 130px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(lk.num || 7), 128, 136);
      const tex = new THREE.CanvasTexture(cv), mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true });
      for (const s of [1, -1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mat); d.position.set(s * 0.925, 0.66, 0.05); d.rotation.y = s * Math.PI / 2; g.add(d); }
      const sp = U.textTexture('POUŠŤ RALLY', 512, 96, '#ffcf3a', '#111', 'bold 62px Arial'), smat = new THREE.MeshLambertMaterial({ map: sp });
      for (const s of [1, -1]) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.17), smat); d.position.set(s * 0.925, 0.5, -1.45); d.rotation.y = s * Math.PI / 2; g.add(d); }
      const hn = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), mat); hn.rotation.x = -Math.PI / 2; hn.position.set(0, 0.036, 0.75); p.hood.add(hn);
    }
    if (ex.mud) for (const w of p.wheels) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.02), U.mat(0xd02a1a)); f.position.set(w.x * 1.02, 0.24, w.z - 0.5); g.add(f);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.05, 0.025), U.mat(0xf0f0f0)); l.position.set(w.x * 1.02, 0.3, w.z - 0.5); g.add(l);
    }
    if (ex.skid) { const s = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 1.1), U.mat(0x9a9aa0)); s.position.set(0, 0.24, 1.65); s.rotation.x = -0.12; g.add(s); }
    if (ex.vent) { const v = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.4), p.paintMat); v.position.set(0, 1.59, 0.15); g.add(v); const o = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.02), U.mat(0x111111)); o.position.set(0, 1.6, 0.36); g.add(o); }
    // předpřipravené stavy pro škody
    // díly, které při nárazu můžou odpadnout
    const bump = (sg) => p.debris.find(m => m.position.z * sg > 2.2 && m.position.y < 0.6 && m.geometry.parameters && m.geometry.parameters.width > 1.8);
    p.det = { hood: p.hood, fbump: bump(1), rbump: bump(-1) };
    for (const mr of p.mirrors || []) { const mg = mr.glass.parent; if (mg && mg.position.y < 1.2) p.det[mg.position.x > 0 ? 'mirL' : 'mirR'] = mg; }
    if (p.cosm.rear && p.cosm.rear.root) p.det.wing = p.cosm.rear.root;
    if (p.cosm.roof && p.cosm.roof.root) p.det.roof = p.cosm.roof.root;
    if (p.cosm.front && p.cosm.front.root) p.det.bull = p.cosm.front.root;
    p.tireMeshes = new Set(); p.wheels.forEach(w => w.spin.traverse(o => p.tireMeshes.add(o)));
    return p;
  },
  // etapa vybraná v servisu: další neprojetá, nebo některá už projetá (opakování)
  curIdx() { const nx = this.sv.stage || 0; return this.pick != null && this.pick >= 0 && this.pick < nx ? this.pick : nx; },
  renderGarage() {
    const sv = this.sv, st = this.stats(), need = this.xpNeed(sv.lvl), stage = rallyStage(this.curIdx()), replay = stage.n < (sv.stage || 0);
    const esc = (t) => String(t).replace(/[<>&]/g, '');
    $('rgProfile').innerHTML = `<div class="gLvl" style="background:linear-gradient(135deg,#7ad88a,#2f8a4a)">${sv.lvl}</div><div><b>${esc(Game.nick())}</b> · rally level ${sv.lvl}<div class="gXp"><i style="width:${Math.min(100, sv.xp / need * 100)}%"></i></div><span>${sv.xp} / ${need} XP · startovní číslo ${sv.num}</span></div>`;
    $('rgMoney').innerHTML = `💰 <b>${sv.money.toLocaleString('cs-CZ')} Kč</b>`;
    const bar = (v, max) => `<span class="gBar"><i style="width:${U.clamp(v / max, 0, 1) * 100}%"></i></span>`;
    const pw = st.hp * (1 + st.boost * 0.7) / st.mass * 1000;
    let h = '<h3>Tvoje rally auto</h3>';
    h += `<div class="gRow">Výkon ${bar(st.hp * (1 + st.boost * 0.7), 800)} <b>${Math.round(st.hp * (1 + st.boost * 0.7))} k</b></div>`;
    h += `<div class="gRow">Hmotnost ${bar(1300 - st.mass, 300)} <b>${Math.round(st.mass)} kg</b></div>`;
    h += `<div class="gRow">Koně na tunu ${bar(pw, 600)} <b>${Math.round(pw)}</b></div>`;
    h += `<div class="gRow">Převodovka <b>${st.ratios.length} st. · ${Math.round(st.shift * 1000)} ms</b></div>`;
    h += `<div class="gRow">Brzdy ${bar(st.brake, 1.6)} <b>${Math.round(st.brake * 100)} %</b></div>`;
    h += `<div style="margin-top:8px;font-weight:700;color:#ffcf86">Přilnavost: ${esc(st.tireName)}</div>`;
    for (const k of ['asphalt', 'gravel', 'sand']) h += `<div class="gRow">${RALLY_SURF[k].name} ${bar(this.gripOn(st, k), 1.25)} <b>${this.gripOn(st, k).toFixed(2)}</b></div>`;
    const sg = this.stageGrip(st, stage);
    h += `<div class="gEst">Etapa <b style="font-size:15px">${stage.name}</b><br>vhodnost pneumatik: <b>${Math.round(sg * 100)} %</b><br><span>${sg > 1.02 ? 'výborná volba' : sg > 0.92 ? 'ujde to' : 'špatné gumy na tenhle povrch!'}</span></div>`;
    h += `<label class="gAuto"><input type="checkbox" id="rgAuto" ${sv.auto ? 'checked' : ''}> Automatické řazení</label>`;
    h += `<label class="gAuto"><input type="checkbox" id="rgTts" ${sv.tts ? 'checked' : ''}> Spolujezdec mluví (hlas prohlížeče)</label>`;
    $('rgStats').innerHTML = h;
    const tabs = [['stage', '🗺 Etapa'], ...RALLY_CATS.map(c => [c.id, c.name]), ['look', 'Vzhled']];
    $('rgTabs').innerHTML = tabs.map(([id, n]) => `<button class="gTab${this.tab === id ? ' on' : ''}" data-rtab="${id}">${n}</button>`).join('');
    let l = '';
    if (this.tab === 'stage') {
      const B = RALLY_BIOMES[stage.biome], pb = sv.best[stage.id], wr = this.wr && this.wr[stage.id] && this.wr[stage.id][0];
      const mix = Object.entries(stage.mix).map(([k, w]) => `${RALLY_SURF[k].name} ${Math.round(w * 100)} %`).join(' · ');
      const stars = '★'.repeat(Math.round(stage.diff / 2)) + '☆'.repeat(5 - Math.round(stage.diff / 2));
      l += (replay ? `<h3>Opakování etapy ${stage.n + 1} <button data-rpick="-1" style="margin-left:8px;font-size:12px">↩ zpět na další etapu (${(sv.stage || 0) + 1})</button></h3>` : `<h3>Další etapa: ${stage.n + 1}</h3>`) + `<div class="gItem eq"><div><b>${stage.name}</b> <span style="color:#ffcf86">${stars}</span><span>${B.name} · ${(stage.len / 1000).toFixed(1)} km · ${mix}</span><i>${stage.desc}</i>` +
        `<i>🔶 úkol: Zaklepat 20 kuželů – stojí v zatáčkách na okraji, smykem je smeteš</i>` +
        `<i>zatáčky ${Math.round(stage.curvy * 10) / 10}× · kopce ${Math.round(stage.hills * 10) / 10}× · skoky ${stage.jumps}</i>` +
        `<i>odměna ${stage.reward.toLocaleString('cs-CZ')} Kč + ${stage.xp} XP${pb ? ' · tvůj čas ' + this.fmt(pb.t) : ''}${wr ? ` · rekord ${this.fmt(wr.t)} (${esc(wr.name)})` : ''}</i></div></div>`;
      l += '<div style="font-size:13px;opacity:.8;margin:6px 0">Etapy jdou po sobě – když dojedeš do cíle, odemkne se další, těžší (ostřejší zatáčky, větší kopce, víc skoků). Prostředí se střídá: poušť, les, kaňon, duny, hory.</div>';
      if ((sv.stage || 0) > 0) {
        l += '<h3>Projeté etapy – můžeš si je kdykoli zajet znovu</h3>';
        for (let i = (sv.stage || 0) - 1; i >= 0; i--) {
          const q = rallyStage(i), b = sv.best[q.id], on = i === stage.n;
          l += `<div class="gItem${on ? ' eq' : ''}"><div><b>${i + 1}. ${q.name}</b> ${b ? ['', '🥉', '🥈', '🥇'][b.medal || 0] : ''}<span>${RALLY_BIOMES[q.biome].name} · ${(q.len / 1000).toFixed(1)} km · ${b ? 'tvůj čas ' + this.fmt(b.t) : 'bez času'}</span></div>${on ? '<span class="gOk">✔ vybráno</span>' : `<button data-rpick="${i}">Jet znovu</button>`}</div>`;
        }
      }
    } else if (this.tab === 'look') {
      l += '<h3>Barva (zdarma)</h3><div class="gPaint">' + SPRAYS.map(([n, c]) => `<button title="${n}" data-rpaint="${c}" style="background:#${c.toString(16).padStart(6, '0')}" class="${sv.paint === c ? 'on' : ''}"></button>`).join('') + '</div>';
      l += `<div class="gRow" style="margin:8px 0">Startovní číslo <input id="rgNum" type="number" min="1" max="99" value="${sv.num}" style="width:60px"></div><h3>Doplňky</h3>`;
      for (const [k, price, name, type] of RALLY_LOOK) {
        const own = sv.lookOwn.includes(k), on = type === 'extra' ? !!sv.ex[k] : sv.cosm[COSM[k].slot] === k;
        l += `<div class="gItem${on ? ' eq' : ''}"><div><b>${name}</b></div>${own ? `<button data-rlook="${k}">${on ? 'Sundat' : 'Nasadit'}</button>` : `<button data-rlbuy="${k}" ${sv.money < price ? 'disabled' : ''}>Koupit ${price} Kč</button>`}</div>`;
      }
    } else {
      const cat = RALLY_CATS.find(c => c.id === this.tab), own = sv.own[cat.id];
      if (cat.id === 'tires') l += `<div style="font-size:13px;opacity:.85;margin-bottom:6px">Každá směs drží nejlíp na svém povrchu. Další etapa: <b>${Object.entries(stage.mix).map(([k, w]) => `${RALLY_SURF[k].name} ${Math.round(w * 100)} %`).join(', ')}</b></div>`;
      cat.items.forEach((it, i) => {
        const has = own.includes(i), eq = sv.eq[cat.id] === i, locked = sv.lvl < it.lvl;
        let extra = '';
        if (cat.id === 'tires') extra = `<i>asfalt ${(RALLY_COMPOUND[it.c].asphalt * it.tier).toFixed(2)} · šotolina ${(RALLY_COMPOUND[it.c].gravel * it.tier).toFixed(2)} · písek ${(RALLY_COMPOUND[it.c].sand * it.tier).toFixed(2)}</i>`;
        const btn = eq ? '<span class="gOk">✔ namontováno</span>' : has ? `<button data-req="${i}">Namontovat</button>` : locked ? `<span class="gLock">🔒 lvl ${it.lvl}</span>` : `<button data-rbuy="${i}" ${sv.money < it.price ? 'disabled' : ''}>Koupit ${it.price.toLocaleString('cs-CZ')} Kč</button>`;
        l += `<div class="gItem${eq ? ' eq' : ''}${locked && !has ? ' lock' : ''}"><div><b>${it.n}</b><span>${it.d}</span>${extra}</div>${btn}</div>`;
      });
    }
    $('rgList').innerHTML = l;
    $('rgStart').textContent = `🏁 START: ${stage.name}`;
    GarageDecor.drawTv(['RALLY SERVIS', stage.name.toUpperCase(), `${(stage.len / 1000).toFixed(1)} km`, sv.best[stage.id] ? 'PB ' + this.fmt(sv.best[stage.id].t) : 'BEZ ČASU'], this.gDecor);
  },
  garageClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const sv = this.sv, d = b.dataset;
    if (d.rtab) this.tab = d.rtab;
    else if (d.rpick !== undefined) { this.pick = +d.rpick < 0 ? null : +d.rpick; if (this.tab === 'stage') $('rgList').scrollTop = 0; }
    else if (d.rbuy !== undefined) {
      const it = RALLY_CATS.find(c => c.id === this.tab).items[+d.rbuy];
      if (sv.money < it.price || sv.lvl < it.lvl) return;
      sv.money -= it.price; sv.own[this.tab].push(+d.rbuy); sv.eq[this.tab] = +d.rbuy; Sfx.coin(); Sfx.install();
    } else if (d.req !== undefined) { sv.eq[this.tab] = +d.req; Sfx.install(); }
    else if (d.rpaint) { sv.paint = +d.rpaint; Sfx.spray(); this.refreshCar(); }
    else if (d.rlbuy) { const L = RALLY_LOOK.find(x => x[0] === d.rlbuy); if (sv.money < L[1]) return; sv.money -= L[1]; sv.lookOwn.push(L[0]); this.toggleLook(L); Sfx.coin(); }
    else if (d.rlook) { this.toggleLook(RALLY_LOOK.find(x => x[0] === d.rlook)); Sfx.install(); }
    this.store(); this.renderGarage();
  },
  toggleLook(L) {
    const sv = this.sv, [k, , , type] = L;
    if (type === 'extra') sv.ex[k] = !sv.ex[k];
    else { const slot = COSM[k].slot; sv.cosm[slot] = sv.cosm[slot] === k ? null : k; }
    this.refreshCar();
  },
  bindUI() {
    // volné rozhlížení: klikni do hry (myš se zamkne) nebo táhni myší se stisknutým tlačítkem
    const cv = Game.renderer.domElement, inStage = () => this.active && this.mode === 'stage';
    cv.addEventListener('mousedown', (e) => {
      if (!inStage()) return;
      this._mDrag = true; this._mx = e.clientX; this._my = e.clientY;
      if (document.pointerLockElement !== cv) Game.lock();
    });
    addEventListener('mouseup', () => { this._mDrag = false; });
    addEventListener('mousemove', (e) => {
      if (!inStage()) return;
      let dx, dy;
      if (document.pointerLockElement === cv) { dx = e.movementX; dy = e.movementY; if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return; }
      else if (this._mDrag) { dx = e.clientX - this._mx; dy = e.clientY - this._my; this._mx = e.clientX; this._my = e.clientY; }
      else return;
      const k = 0.0024 * (Settings.s.sens || 1);
      // venkovní kamera obíhá auto dokola, z kokpitu jen otáčení hlavy
      const ny = (this.lookYaw || 0) - dx * k;
      this.lookYaw = this.camMode === 'chase' ? Math.atan2(Math.sin(ny), Math.cos(ny)) : U.clamp(ny, -2.6, 2.6);
      this.lookPitch = U.clamp((this.lookPitch || 0) - dy * k * (Settings.s.invertY ? -1 : 1), -0.9, 0.7);
      this.lookIdle = 0;
    });
    $('rGarage').addEventListener('click', (e) => {
      const id = e.target.id;
      if (id === 'rgStart') return this.startSolo(this.curIdx());
      if (id === 'rgAi') return this.startSolo(this.curIdx(), true);
      if (id === 'rgMp') { const md = 'rally:' + (this.curIdx()); if (Net.isHost || !Net.connected()) Net.mode = md; Game.openLobby(); if (Net.isHost) Net.setMode(md); return; }
      if (id === 'rgBoard') { Account.openBoard(); Account.rsTab = this.curIdx(); return; }
      if (id === 'rgBack') return this.toMenu();
      this.garageClick(e);
    });
    $('rGarage').addEventListener('change', (e) => {
      const sv = this.sv;
      if (e.target.id === 'rgAuto') sv.auto = e.target.checked;
      if (e.target.id === 'rgTts') sv.tts = e.target.checked;
      if (e.target.id === 'rgNum') { sv.num = U.clamp(Math.round(+e.target.value) || 1, 1, 99); this.refreshCar(); }
      this.store();
    });
    $('rGarage').addEventListener('keydown', (e) => e.stopPropagation());
    addEventListener('keydown', (e) => this.key(e));
    addEventListener('pointerdown', () => this.unlockVoice(), { once: true });
    addEventListener('keydown', () => this.unlockVoice(), { once: true });
    $('rhTabBtns').addEventListener('click', (e) => { const b = e.target.closest('button[data-call]'); if (b) this.codriverCall(+b.dataset.call); });
  },

  // ---------- start etapy ----------
  startSolo(idx, ai) {
    if (!this.sv) this.load();
    const st = this.stats();
    this.setup({ idx, net: false, ai: !!ai, teams: [{ id: 0, nick: Game.nick(), crew: ai ? Game.nick() : Game.nick() + ' + AI', driver: -1, co: -1, mine: true, stats: st, look: this.look() }], myTeam: 0, role: 'driver' });
  },
  startNet(seed, slots, mode) {
    if (Game.playing) { location.reload(); return; }
    if (Drag.active) Drag.exit();
    this.load();
    if (!this.gScene) this.buildGarage();
    const parts = String(mode).split(':'), idx = U.clamp(+parts[1] || 0, 0, 999), swap = parts[2] === 's';
    const order = slots.slice().sort((a, b) => a - b), teams = [];
    for (let i = 0; i < order.length; i += 2) {
      const pair = order.slice(i, i + 2), drv = swap && pair.length === 2 ? pair[1] : pair[0], co = pair.length === 2 ? (drv === pair[0] ? pair[1] : pair[0]) : -1;
      teams.push({ id: teams.length, driver: drv, co, nick: Net.nickOf(drv), crew: Net.nickOf(drv) + (co >= 0 ? ' + ' + Net.nickOf(co) : ' + AI') });
    }
    const mt = teams.find(t => t.driver === Net.slot || t.co === Net.slot);
    for (const t of teams) { t.mine = t === mt; if (t.driver === Net.slot) { t.stats = this.stats(); t.look = this.look(); } else t.look = { paint: SLOT_PAINT[t.driver] || 0x888888, cosm: {}, ex: { num: true }, num: t.driver + 1 }; }
    $('menu').style.display = 'none'; $('lobby').style.display = 'none';
    this.setup({ idx, net: true, teams, myTeam: mt.id, role: mt.driver === Net.slot ? 'driver' : 'codriver' });
    if (this.role === 'driver') Net.send({ t: 'rcar', team: mt.id, look: mt.look });
    for (const d of this.pending || []) this.onNet(d);
    this.pending = [];
  },
  stageScene(idx) {
    if (this.stages[idx]) return this.stages[idx];
    for (const k of Object.keys(this.stages)) if (+k !== idx && (!this.cur || this.cur !== this.stages[k])) { this.stages[k].sc.traverse(o => { if (o.geometry) o.geometry.dispose(); }); delete this.stages[k]; }
    const stage = rallyStage(idx), tr = RallyTrack.generate(stage), sc = new THREE.Scene(), B = RALLY_BIOMES[stage.biome];
    const sky = B.sky;
    sc.background = new THREE.Color(sky); sc.fog = new THREE.Fog(sky, B.dens > 2 ? 110 : 150, B.mountN >= 0.8 ? 1000 : 620);
    sc.add(new THREE.HemisphereLight(0xfff4e0, B.hemi, 0.7));
    const sun = new THREE.DirectionalLight(0xfff1d8, 1.0); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera; c.left = -40; c.right = 40; c.top = 40; c.bottom = -40; c.near = 1; c.far = 220; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.06;
    sc.add(sun); sc.add(sun.target);
    RallyTrack.build(sc, tr);
    // prach a kouř
    const sm = document.createElement('canvas'); sm.width = sm.height = 64; const g = sm.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(sm), dust = [];
    for (let i = 0; i < 140; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false })); s.visible = false; sc.add(s); dust.push({ s, life: 0 }); }
    const cam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.08, 1600); cam.rotation.order = 'YXZ'; sc.add(cam);
    return (this.stages[idx] = { tr, sc, sun, dust, cam, stage });
  },
  setup(opt) {
    this.active = true; this.mode = 'stage'; this.opt = opt; this.role = opt.role;
    for (const id of ['rGarage', 'race', 'lobby', 'menu']) $(id).style.display = 'none';
    $('rallyHud').style.display = 'block'; $('rallyHud').className = this.role;
    if (Confetti) Confetti.stop();
    const S = this.cur = this.stageScene(opt.idx), tr = S.tr;
    // obnov rozbité tyčky a kaktusy z minulé jízdy
    for (const o of tr.objs) if (o.broken) { o.broken = false; for (const e of o.inst) { e.im.setMatrixAt(e.i, e.m); e.im.instanceMatrix.needsUpdate = true; } }
    if (this.teams) for (const t of this.teams) this.disposeTeam(t);
    this.aiClear();
    for (const p of S.dust) { p.life = 0; p.s.visible = false; }
    this.teams = opt.teams;
    const p0 = tr.pts[1];
    for (const t of this.teams) {
      t.parts = this.makeCar(t.look); S.sc.add(t.parts.root); t.res = null; t.loose = [];
      t.dmgVis = { off: [false, false, false, false] };
      if (t.mine && this.role === 'driver') {
        t.car = new RallyCar(t.stats); t.car.dmg = null; t.car.reset(p0.x, p0.z, Math.PI - p0.t, p0.y);
      }
      t.pose = { x: p0.x, z: p0.z, y: p0.y, h: Math.PI - p0.t, p: 0, r: 0, st: 0, v: 0, rpm: 900, s: 0 };
    }
    this.my = this.teams.find(t => t.mine);
    this.my.hands = Hands.carRig(this.my.parts);
    this.clock = -5.5; this.started = false; this.finished = false; this.over = false; this.overT = 0; this._shown = false;
    this.sProg = 0; this.nc = 0; this.callT = 0; this.splitsHit = []; this.penalty = 0; this.repair = 0; this.helpOn = false; this.remoteHelp = false;
    this.sendT = 0; this.msgT = 0; this.escT = 0; this.coLeft = false; this.aiCodriverOn = undefined; this._preCall = false; this.wheelT = 0; this._cp = null; this.tabT = 0; this.cdNext = 0; this.lastCount = 99; this.hits = 0; this.cones = 0;
    if (this.role === 'codriver') this.makeTablet(this.my.parts);
    this.camMode = this.role === 'codriver' ? 'co' : (this.sv.cam || 'chase'); this.setCam(this.camMode);
    try { this.czVoice(); } catch (e) { /* bez hlasu */ }
    if (this.role === 'driver') this.voicePrefetch();
    this.say(null); this.callT = 0; $('rhCall').style.opacity = 0; $('rhCount').style.opacity = 0; $('rhRepair').style.display = 'none';
    this.msg(this.role === 'codriver' ? `Jsi spolujezdec! Řiď ${this.my.nick} hlasem – rozpis máš na tabletu v rukou (1–8 a Enter)` : opt.net && this.my.co >= 0 ? `Řídíš! ${Net.nickOf(this.my.co)} ti bude hlásit trať` : 'Spolujezdec AI hlásí zatáčky. Vydrž do cíle!', 4);
    $('rhStage').textContent = S.stage.name;
    if (opt.ai) { this.aiSetup(); { const ms = this.meSlot || 0; this.msg(`Závod se ${RALLY_AI_N} AI soupeři – los: startuješ ${ms + 1}. z 4${ms === 0 ? ' – pole position!' : ', předjeď je!'}`, 4); } }
    $('rhTabBtns').innerHTML = RALLY_CALLS.map(([t], i) => `<button data-call="${i}"><b>${i + 1}</b> ${t}</button>`).join('') + '<button data-call="-1" class="next"><b>Enter</b> další pokyn</button>';
  },
  // fyzický tablet v rukou spolujezdce (textura = plátno rozpisu)
  makeTablet(parts) {
    const g = new THREE.Group(), cv = $('rhTablet');
    if (!this.tabTex) this.tabTex = new THREE.CanvasTexture(cv);
    const W = 0.2, H = W * cv.height / cv.width;
    const body = new THREE.Mesh(new THREE.BoxGeometry(W + 0.022, H + 0.022, 0.012), U.mat(0x1a1a1c)); body.position.z = -0.007; g.add(body);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: this.tabTex })); g.add(scr);
    // ruce spolujezdce drží tablet za boky
    const skin = U.mat(0xc68a5e), sleeve = U.mat(0x2f6a3a);
    for (const sx of [-1, 1]) {
      const hand = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.09, 0.05), skin); hand.position.set(sx * (W / 2 + 0.024), -0.02, -0.014); g.add(hand);
      const th = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.02, 0.012), skin); th.position.set(sx * (W / 2 + 0.006), 0.0, 0.004); g.add(th);
      const fa = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.3), sleeve); fa.position.set(sx * (W / 2 + 0.05), -0.09, -0.16); fa.rotation.set(0.55, sx * -0.25, 0); g.add(fa);
    }
    g.position.set(-0.35, 1.04, 0.1);
    parts.root.add(g); parts.root.updateMatrixWorld(true);
    g.lookAt(parts.root.localToWorld(new THREE.Vector3(-0.38, 1.2, -0.25)));
    parts.tablet = g;
    return g;
  },
  disposeTeam(t) { if (t.parts) this.cur.sc.remove(t.parts.root); for (const l of t.loose || []) this.cur.sc.remove(l.obj); },
  setCam(m) {
    this.camMode = m;
    const cam = this.cur.cam, t = this.my;
    if (m === 'cockpit' || m === 'co' || m === 'bonnet') {
      t.parts.root.add(cam);
      if (m === 'cockpit') { cam.position.set(0.38, 1.22, -0.25); cam.rotation.set(-0.06, Math.PI, 0); }
      else if (m === 'co') { cam.position.set(-0.38, 1.2, -0.25); cam.rotation.set(-0.08, Math.PI + 0.06, 0); }
      else { cam.position.set(0, 1.34, 0.95); cam.rotation.set(-0.07, Math.PI, 0); }
      this._camBase = { x: cam.rotation.x, y: cam.rotation.y };
    } else { this.cur.sc.add(cam); this._cp = null; }
    this.lookYaw = this.lookPitch = 0;
    if (this.role === 'driver' && m !== 'co') { this.sv.cam = m; this.store(); }
    $('rallyHud').classList.toggle('inhand', m === 'co'); $('rallyHud').classList.toggle('incar', m === 'cockpit');
  },

  // ---------- ovládání ----------
  key(e) {
    if (!this.active || this.mode !== 'stage') return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if ($('settings').style.display === 'flex') return;
    if (e.code === 'Space' || e.code === 'Tab') e.preventDefault();
    const acts = Settings.actionsFor(e.code), has = (a) => acts.includes(a);
    if (e.repeat) return;
    if (has('radio')) Radio.toggle();
    if (has('radioNext')) Radio.next();
    if (e.code === 'Escape') return this.forfeit();
    if (this.role === 'codriver') {
      const i = RALLY_CALLS.findIndex(c => c[1] === e.code);
      if (i >= 0) this.codriverCall(i);
      if (e.code === 'Enter' || e.code === 'NumpadEnter') this.codriverCall(-1);
      if (has('camera')) this.setCam(this.camMode === 'co' ? 'chase' : 'co');
      return;
    }
    const c = this.my.car; if (!c) return;
    if (has('camera')) this.setCam({ chase: 'bonnet', bonnet: 'cockpit', cockpit: 'chase' }[this.camMode] || 'chase');
    if (has('gearmode')) { c.s.auto = !c.s.auto; this.msg(c.s.auto ? 'Automat' : 'Manuál – řadíš sám (R / F)', 1.5); }
    if (!c.s.auto && has('shiftUp')) { if (c.shiftUp()) Sfx.shift(90); }
    if (!c.s.auto && has('shiftDown')) { if (c.shiftDown()) Sfx.shift(90); }
    if (e.code === 'KeyX' && this.started && !this.finished) this.resetToRoad();
  },
  forfeit() {
    if (this.over) return;
    if (this.opt.net) {
      if (this.role === 'codriver') { this.msg('Vzdát může jen řidič', 1.5); return; }
      if (this.escT > 0) this.finish(true, 'Posádka to vzdala'); else { this.escT = 2; this.msg('Esc znovu = vzdát etapu', 2); }
      return;
    }
    if (this.escT > 0) { this.say(null); this.exit(); this.enterGarage(); } else { this.escT = 2; this.msg('Esc znovu = zpět do garáže (bez odměny)', 2); }
  },
  resetToRoad() {
    const c = this.my.car, tr = this.cur.tr, nr = RallyTrack.nearest(tr, c.x, c.z, true); if (!nr) return;
    const p = tr.pts[Math.max(1, nr.i)];
    c.x = p.x; c.z = p.z; c.y = p.y + 0.15; c.h = Math.PI - p.t; c.vx = c.vz = c.r = c.vy = 0; c.wF = c.wR = 0; c.gear = 1;
    c.pitch = c.roll = c.pv = c.rv = 0; c.wz = null;
    this.penalty += 5; this.msg('Vráceno na trať: +5 s', 1.8, 'bad'); Sfx.tone(300, 0.2, 0.15, 'square');
  },
  msg(t, dur, cls) { const e = $('rhMsg'); e.textContent = t; e.className = cls || ''; e.style.opacity = 1; this.msgT = dur || 2; },
  // ---------- spolujezdec ----------
  say(txt, voice) {
    if (!txt) { try { speechSynthesis.cancel(); } catch (e) { /* nic */ } if (this._ttsAudio) this._ttsAudio.pause(); this.stopVoice(); return; }
    const e = $('rhCall'); e.textContent = txt; e.style.opacity = 1; e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); this.callT = 2.6;
    Sfx.tone(1180, 0.06, 0.08, 'sine');
    if (voice === false || !this.sv.tts) return;
    const clean = this.speechText(txt);
    this._sayEnd = performance.now() / 1000 + 0.25 + clean.length * 0.11;   // odhad délky věty (aby ji další pokyn neusekl)
    try {
      // spolujezdec je chlap: 1) mužský český hlas prohlížeče, 2) hlas ze serveru převedený na mužský (interkom v helmě),
      // 3) ženský český hlas prohlížeče posazený níž, 4) online hlas napřímo (níž). Anglicky nikdy.
      const v = window.speechSynthesis ? this.czVoice() : null;
      if (v && this.isMale(v)) return this.browserSpeak(v, clean, 1);
      if (this._srvTts !== false && Sfx.ctx) {
        this._srvFail = this._srvFail || 0;   // hlas ze serveru se vypne až po několika chybách (jedna pomalá hláška ho nezabije)
        this.srvSpeak(clean).catch(() => { if (++this._srvFail >= 3) this._srvTts = false; if (v) this.browserSpeak(v, clean, 0.45); else this.netSpeak(clean); });
        return;
      }
      if (v) return this.browserSpeak(v, clean, 0.45);
      this.netSpeak(clean);
    } catch (err) { /* bez hlasu */ }
  },
  speechText(t) { return t.replace(/\s*…\s*/g, '. ').replace(/!/g, '').replace(/\s+/g, ' ').trim(); },
  isMale(v) { return /jakub|anton[ií]n|male|muž|mu[zž]sk/i.test(v.name) && !/female|žensk/i.test(v.name); },
  browserSpeak(v, txt, pitch) {
    if (speechSynthesis.pending || speechSynthesis.speaking) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(txt.replace(/,/g, ' '));
    u.voice = v; u.lang = v.lang || 'cs-CZ'; u.rate = 1.2; u.pitch = pitch; u.volume = 1; speechSynthesis.speak(u);
  },
  stopVoice() { if (this._vSrc) { const s = this._vSrc; this._vSrc = null; try { s.stop(); } catch (e) { /* nic */ } } Sfx.ducking && Sfx.ducking(false); },
  // hlas ze serveru (cache), převedený na hlubší mužský a přehraný přes „interkom“
  async srvSpeak(txt) {
    const ctx = Sfx.ctx; this._vCache = this._vCache || new Map();
    const id = (this._vId = (this._vId || 0) + 1);
    const v = await this.voiceLoad(txt);
    if (id !== this._vId) return;   // mezitím přišel novější pokyn
    this.stopVoice();
    this._sayEnd = performance.now() / 1000 + v.buf.duration / (v.male ? 1 : this.VOICE_PITCH);   // skutečná délka věty
    const src = ctx.createBufferSource(); src.buffer = v.buf; src.playbackRate.value = v.male ? 1 : this.VOICE_PITCH;   // skutečný hlas bez přelaďování = nejsrozumitelnější
    // srozumitelnost: ořezat dunění, zvýraznit souhlásky (2–4 kHz), srovnat hlasitost
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 3000; pk.Q.value = 0.7; pk.gain.value = 5;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 10000;
    const cmp = ctx.createDynamicsCompressor(); cmp.threshold.value = -26; cmp.ratio.value = 4; cmp.attack.value = 0.003; cmp.release.value = 0.12;
    const g = ctx.createGain(); g.gain.value = 2.2 * Math.max(0.2, (Settings.s.master || 80) / 100);
    src.connect(hp); hp.connect(pk); pk.connect(lp); lp.connect(cmp); cmp.connect(g); g.connect(Sfx.voiceBus || Sfx.master);
    // motor a rádio se po dobu hlášení ztiší
    Sfx.ducking && Sfx.ducking(true);
    src.onended = () => { if (this._vSrc === src) { this._vSrc = null; Sfx.ducking && Sfx.ducking(false); } };
    src.start(); this._vSrc = src;
  },
  // načtení hlášky ze serveru: věta se skládá z kousků („Levá 3 dlouhá“ · „utahuje se“ · „150“), které má server
  // namluvené předem → hláška je hned, i když je server slabý. Kousky se slepí s krátkou pauzou (čárka) / delší (tečka).
  voiceLoad(txt) {
    this._vCache = this._vCache || new Map();
    let p = this._vCache.get(txt);
    if (!p) {
      p = (async () => {
        const parts = [], re = /([^,.]+)([,.]?)/g; let m;
        while ((m = re.exec(txt))) { const t = m[1].trim(); if (t) parts.push([t, m[2] === '.' ? 0.26 : 0.1]); }
        if (!parts.length) throw new Error('prázdná hláška');
        const bufs = await Promise.all(parts.map(([t]) => this.voicePart(t)));
        const ctx = Sfx.ctx, sr = bufs[0].buf.sampleRate, male = bufs.every(b => b.male);
        let len = 0; bufs.forEach((b, i) => { len += b.buf.length + (i < bufs.length - 1 ? Math.round(parts[i][1] * sr) : 0); });
        const out = ctx.createBuffer(1, len, sr), o = out.getChannelData(0);
        let at = 0; bufs.forEach((b, i) => { o.set(b.buf.getChannelData(0).subarray(0, Math.min(b.buf.length, len - at)), at); at += b.buf.length + Math.round(parts[i][1] * sr); });
        this.voiceKind = male ? 'male' : 'shifted';
        // skutečná délka „jádra“ hlášky (bez vzdálenosti na konci) – podle ní se načasuje, kdy začít mluvit
        let core = 0; bufs.forEach((b, i) => { if (!/^\d+$/.test(parts[i][0])) core = Math.max(core, bufs.slice(0, i + 1).reduce((a, q, k) => a + q.buf.duration + (k < i ? parts[k][1] : 0), 0)); });
        (this._vDur = this._vDur || new Map()).set(txt, core / (male ? 1 : this.VOICE_PITCH));
        return { buf: male ? out : await this.maleVoiceAsync(ctx, out, this.VOICE_PITCH), male };
      })();
      p.catch(() => this._vCache.delete(txt));
      if (this._vCache.size > 500) this._vCache.clear();
      this._vCache.set(txt, p);
    }
    return p;
  },
  voicePart(t) {
    this._vPart = this._vPart || new Map();
    let p = this._vPart.get(t);
    if (!p) {
      p = (async () => {
        const r = await fetch('/api/tts?q=' + encodeURIComponent(t));
        if (!r.ok) throw new Error('tts ' + r.status);
        const male = r.headers.get('X-Voice') === 'male';   // server má skutečný mužský hlas (Piper) → nic nepřelaďujeme
        const raw = await Sfx.ctx.decodeAudioData(await r.arrayBuffer());
        // ticho na začátku/konci kousku ořezat, ať slepená věta nemá díry
        const d = raw.getChannelData(0), th = 0.03; let a = 0, b = d.length - 1;
        while (a < b && Math.abs(d[a]) < th) a++; while (b > a && Math.abs(d[b]) < th) b--;
        a = Math.max(0, a - Math.round(raw.sampleRate * 0.02)); b = Math.min(d.length, b + Math.round(raw.sampleRate * 0.04));
        const buf = Sfx.ctx.createBuffer(1, Math.max(1, b - a), raw.sampleRate); buf.getChannelData(0).set(d.subarray(a, b));
        return { buf, male };
      })();
      p.catch(() => this._vPart.delete(t));
      if (this._vPart.size > 400) this._vPart.clear();
      this._vPart.set(t, p);
    }
    return p;
  },
  // na startu etapy si spolujezdec „přečte rozpis“: hlášky se připraví dopředu, ať zazní hned (ne se zpožděním)
  async voicePrefetch() {
    if (!this.sv.tts || !Sfx.ctx || this._srvTts === false) return;
    const v = window.speechSynthesis ? this.czVoice() : null;
    if (v && this.isMale(v)) return;
    const tok = (this._pfTok = (this._pfTok || 0) + 1), notes = this.cur.tr.notes, cl = (t) => this.speechText(t);
    const list = [];
    // přesně ty věty, které spolujezdec řekne (jednotlivě i spojené navazující zatáčky)
    for (let i = 0; i < notes.length; i++) { list.push(cl(notes[i].txt)); const k = this.chainLen(notes, i); if (k > 1) list.push(cl(this.chainTxt(notes, i, k))); }
    for (const t of list) {
      if (tok !== this._pfTok || !this.active) return;
      try { await this.voiceLoad(t); } catch (e) { return; }
      if (this.voiceKind !== 'male') return;   // přeladěný záložní hlas se nepřednačítá
    }
  },
  VOICE_PITCH: 0.84,   // jen záložní přeladění ženského hlasu (menší posun = míň robotické)
  // WSOLA: zkrátí nahrávku (beze změny výšky), aby po zpomaleném přehrání (= hlubší hlas) měla zase normální tempo
  // přeladění hlasu ve Web Workeru – výpočet trvá 10–20 ms a na hlavním vlákně při každém hlášení spolujezdce zasekl hru
  maleVoiceAsync(ctx, buf, f) {
    if (!window.Worker || !window.Blob) return Promise.resolve(this.maleVoice(ctx, buf, f));
    if (!this._vw) {
      try { this._vw = new Worker('js/voiceworker.js?v=2'); } catch (e) { return Promise.resolve(this.maleVoice(ctx, buf, f)); }
      this._vwJobs = new Map(); this._vwId = 0;
      this._vw.onmessage = (e) => { const j = this._vwJobs.get(e.data.id); if (j) { this._vwJobs.delete(e.data.id); j.done(e.data.out); } };
      // worker nejde spustit (staré prohlížeče, zásady) → spočítat na hlavním vlákně jako dřív
      this._vw.onerror = () => { this._vwBad = true; for (const j of this._vwJobs.values()) j.done(wsolaStretch(j.x0, j.sr, j.f)); this._vwJobs.clear(); };
    }
    if (this._vwBad) return Promise.resolve(this.maleVoice(ctx, buf, f));
    const id = ++this._vwId, x0 = buf.getChannelData(0), x = x0.slice(), sr = buf.sampleRate;
    return new Promise((res) => {
      this._vwJobs.set(id, { x0, sr, f, done: (out) => { const b = ctx.createBuffer(1, out.length, sr); b.getChannelData(0).set(out); res(b); } });
      this._vw.postMessage({ id, x, sr, f }, [x.buffer]);
    });
  },
  maleVoice(ctx, buf, f) {
    const out = this.wsola(buf.getChannelData(0), buf.sampleRate, f);
    const res = ctx.createBuffer(1, out.length, buf.sampleRate); res.getChannelData(0).set(out);
    return res;
  },
  wsola(x, sr, f) { return wsolaStretch(x, sr, f); },
  netSpeak(txt) {
    if (this._ttsFail >= 3) { if (!this._noCz) { this._noCz = true; this.msg('Český hlas není dostupný – spolujezdec hlásí jen textem', 4, 'warn'); } return; }
    const a = this.ttsAudio();
    a.pause();
    a.src = 'https://translate.google.com/translate_tts?ie=UTF-8&tl=cs&client=tw-ob&q=' + encodeURIComponent(txt.slice(0, 180));
    a.preservesPitch = a.mozPreservesPitch = a.webkitPreservesPitch = false; a.playbackRate = 0.84; a.volume = 1;   // níž = mužštější
    const p = a.play(); if (p && p.catch) p.catch(() => { this._ttsFail = (this._ttsFail || 0) + 1; });
  },
  // přehrávač pro online hlas – odemkne se při kliknutí (Safari/iOS jinak zvuk bez dotyku nepustí)
  ttsAudio() {
    if (!this._ttsAudio) {
      const a = this._ttsAudio = new Audio(); a.preload = 'auto';
      a.addEventListener('error', () => { if (a.src.startsWith('https')) this._ttsFail = (this._ttsFail || 0) + 1; });
      a.addEventListener('playing', () => { this._ttsFail = 0; });
    }
    return this._ttsAudio;
  },
  unlockVoice() {
    try {
      const a = this.ttsAudio();
      if (!a.src) { a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='; const p = a.play(); if (p && p.catch) p.catch(() => {}); }
      if (window.speechSynthesis) speechSynthesis.getVoices();
    } catch (e) { /* nic */ }
  },
  // najde český hlas (nejlíp přirozený/online), seznam hlasů se v prohlížeči načítá se zpožděním
  czVoice() {
    if (this.voice && this.voice.lang && /^cs/i.test(this.voice.lang)) return this.voice;
    if (!window.speechSynthesis) return null;
    if (!this._vcHook) { this._vcHook = true; try { speechSynthesis.addEventListener('voiceschanged', () => { this.voice = null; this._noCz = false; }); } catch (e) { /* starší prohlížeč */ } }
    const cz = speechSynthesis.getVoices().filter(v => /^cs([-_]|$)/i.test(v.lang) || /czech|čeština|zuzana|jakub|vlasta|antonin/i.test(v.name));
    const score = (v) => (this.isMale(v) ? 2 : 0) + (/natural|online|premium|enhanced/i.test(v.name) ? 1 : 0);
    cz.sort((a, b) => score(b) - score(a));
    this.voice = cz[0] || null;
    return this.voice;
  },
  codriverCall(i) {
    if (this.role !== 'codriver' || !this.started && this.clock < -4) return;
    let txt;
    if (i < 0) { const n = this.cur.tr.notes[this.cdNext]; if (!n) return; txt = n.txt; this.cdNext++; }
    else txt = RALLY_CALLS[i][0];
    Net.send({ t: 'rcall', team: this.my.id, txt });
    this.say(txt, false);
  },
  aiCodriver(force) {
    const notes = this.cur.tr.notes, v = Math.abs(this.my.car.speed), now = performance.now() / 1000;
    // pokyny, které už jsou za autem, přeskočit (po resetu / smyku)
    while (this.nc < notes.length && (notes[this.nc].end || notes[this.nc].s) < this.sProg - 5) this.nc++;
    if (this.nc >= notes.length) return;
    const n = notes[this.nc], dist = n.s - this.sProg;
    // spojit jen zatáčky, které na sebe navazují („…, hned“), ne zatáčku o sto metrů dál
    const chain = this.chainLen(notes, this.nc), txt = this.chainTxt(notes, this.nc, chain);
    // kdy hlásit: jádro věty („Levá 3, utahuje se“ – vzdálenost na konci se počítá až za zatáčkou) má doznít
    // chvilku před místem, kde se musí začít brzdit → řidič to slyší akorát, aby stihl zareagovat
    const sp = this.speechText(txt), dur = this._vDur && this._vDur.get(sp);
    const talk = dur || 0.15 + sp.replace(/,\s*\d+\s*$/, '').length * 0.095;
    let brake = 0;
    if (n.kind === 'corner') { const vt = Math.sqrt(7 * [16, 26, 38, 55, 80, 115, 165][n.sev]); brake = Math.max(0, v * v - vt * vt) / (2 * 8); }
    const lead = U.clamp(v * (talk + 0.35) + brake * 0.85, 18, 130);
    if (dist > lead && !force) return;
    // nepřerušovat rozjetou větu – počkat, dokud to nedořekne (jen když už zatáčka opravdu hoří, skočit do řeči)
    if (now < (this._sayEnd || 0) && dist > 12 + v * 1.1) return;
    this.nc += chain;
    this.say(txt);
  },
  // kolik pokynů od i se řekne v jedné větě: navazující zatáčky (mezera < 35 m), nejvýš tři
  chainLen(notes, i) {
    let k = 1;
    while (k < 3 && i + k < notes.length) {
      const a = notes[i + k - 1], b = notes[i + k];
      if (a.kind !== 'corner' || b.kind !== 'corner' || b.s - (a.end || a.s) >= 35) break;
      k++;
    }
    return k;
  },
  chainTxt(notes, i, k) { return notes.slice(i, i + k).map(n => n.txt).join(' … '); },

  // ---------- smyčka ----------
  frame(dt) {
    const r = Game.renderer;
    if (this.mode === 'garage') {
      this.gIdle = (this.gIdle || 0) + dt;
      if (this.gIdle > 3 && !this._drag) this.gYaw += dt * 0.22;
      const cam = this.gCam; cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
      cam.position.set(Math.sin(this.gYaw) * Math.cos(this.gPitch) * this.gDist, 1 + Math.sin(this.gPitch) * this.gDist, Math.cos(this.gYaw) * Math.cos(this.gPitch) * this.gDist);
      cam.lookAt(-1.2 * Math.cos(this.gYaw), 0.8, 1.2 * Math.sin(this.gYaw));
      GarageDecor.update(dt, this.gDecor);
      r.shadowMap.needsUpdate = true; r.render(this.gScene, cam);
      return;
    }
    if (this.mode !== 'stage') return;
    const S = this.cur, tr = S.tr, me = this.my;
    this.clock += dt; this.escT -= dt;
    // odpočet
    const cd = Math.ceil(-this.clock);
    if (!this.started && cd !== this.lastCount && cd <= 5 && cd >= 1) { this.lastCount = cd; Sfx.tone(cd <= 3 ? 620 : 440, 0.14, 0.18, 'square'); $('rhCount').textContent = cd; $('rhCount').style.opacity = 1; }
    if (!this.started && this.clock >= 0) { this.started = true; Sfx.tone(1100, 0.4, 0.22, 'square'); $('rhCount').textContent = 'START!'; setTimeout(() => { $('rhCount').style.opacity = 0; }, 700); }
    if (this.role === 'driver') this.driveStep(dt);
    else this.followStep(dt);
    if (this.ais) this.aiStep(dt);
    // ostatní posádky (a moje auto u spolujezdce) podle síťového stavu
    for (const t of this.teams) if (!t.car) this.interp(t, dt);
    for (const t of this.teams) this.updateVis(t, dt);
    if (this.ais) this.aiVis(dt);
    this.updateDust(dt);
    this.updateCam(dt);
    this.hud(dt);
    if (this.role === 'codriver' || this.opt.net && this._showTab) this.drawTablet(dt);
    // síť
    if (this.opt.net && this.role === 'driver') {
      this.sendT -= dt;
      if (this.sendT <= 0) { this.sendT = 1 / 30; Net.send(this.stateMsg()); }
    }
    // konec
    if (!this.over && this.teams.every(t => t.res)) { this.over = true; this.overT = 2.6; }
    if (this.over) { this.overT -= dt; if (this.overT <= 0 && !this._shown) { this._shown = true; this.results(); } }
    const sun = S.sun, p = me.pose; U.snapSun(sun, p, this._sunDir || (this._sunDir = new THREE.Vector3(30, 70, 25)), 80);
    r.shadowMap.needsUpdate = true;
    r.render(S.sc, S.cam);
  },
  driveStep(dt) {
    const me = this.my, c = me.car, tr = this.cur.tr, K = Game.keys;
    const go = this.started && !this.finished && !me.res;
    const KD = (a) => (Settings.kdown(K, a) ? 1 : 0);
    const inp = go ? Object.assign(Pad.mix(KD('forward'), KD('back'), KD('left') - KD('right')), { hb: Settings.down(K, 'handbrake') })
      : { thr: 0, brk: this.started ? 0.6 : 0, steer: 0, hb: !this.started };   // před startem drží ruční (automat nepřeřadí na R)
    if (!this.started) inp.thr = Math.max(KD('forward'), Pad.thr());   // před startem můžeš vytočit motor
    if (!this.started) { c.vx = c.vz = 0; c.wF = c.wR = 0; }
    const land = c.step(dt, inp, tr);
    if (land > 5.5) this.landing(land);
    this.collide(dt);
    // postup tratí (bez zkratek)
    const nr = RallyTrack.nearest(tr, c.x, c.z);
    if (nr && nr.s > this.sProg && nr.s - this.sProg < 30) this.sProg = nr.s;
    this.nr = nr;
    // první zatáčku hned za startem přečte spolujezdec už na startu (za jízdy by ji nestihl)
    if (!this.started && !this._preCall && this.clock > -3.5 && (!this.opt.net || me.co < 0)) {
      this._preCall = true; const n0 = tr.notes[this.nc || 0];
      if (n0 && n0.s - this.sProg < 170) this.aiCodriver(true);
    }
    if (go) {
      this.aiCodriverOn = !this.opt.net || me.co < 0 || this.coLeft;
      if (this.aiCodriverOn) this.aiCodriver();
      // mezičasy
      tr.splits.forEach((s, i) => {
        if (this.sProg >= s && !this.splitsHit[i]) {
          const t = this.clock + this.penalty; this.splitsHit[i] = t;
          const pb = this.sv.best[tr.stage.id], ref = pb && pb.splits ? pb.splits[i] : null;
          this.msg(`Mezičas ${i + 1}: ${this.fmt(t)}${ref ? ` (${t <= ref ? '−' : '+'}${Math.abs(t - ref).toFixed(2)})` : ''}`, 2.5, ref && t > ref ? 'bad' : 'good');
        }
      });
      if (this.sProg >= tr.len - 12) this.finish(false);
      if (c.dmg.engine >= 100) this.finish(true, 'Motor je na odpis');
      if (nr && nr.d > 45) this.msg('Jsi daleko od trati – X = návrat (+5 s)', 0.5, 'warn');
    }
    // oprava utrženého kola
    const off = c.dmg.off.findIndex(o => o);
    const helper = this.opt.net && me.co >= 0 && !this.coLeft ? this.remoteHelp : (this.aiCodriverOn !== false);
    if (off >= 0 && c.speed < 1 && !c.air) {
      const eDown = Settings.down(K, 'interact'), rate = (eDown ? 1 : 0) + (helper && (eDown || this.opt.net) ? 0.7 : 0);
      this.repair += dt * rate;
      if (this.repair >= 7) this.attachWheel(me, off);
      this.repairOn = true;
    } else { this.repair = Math.max(0, this.repair - dt * 0.5); this.repairOn = off >= 0; }
    // poloha pro vizuál a síť
    Object.assign(me.pose, { x: c.x, z: c.z, y: c.y, h: c.h, p: c.pitch, r: c.roll, st: c.steer, v: c.vf, rpm: c.rpm, s: this.sProg, w: (c.wF + c.wR) / 2 });
    // zvuk
    const surf = c.surf[0];
    Sfx.engine({ rpm: c.rpm, throttle: c.thr, running: true, speed: c.speed, slip: c.slipAmt, wspin: c.wspin, lock: c.hb && c.speed > 3 ? 0.6 : 0, onRoad: surf === 'asphalt', inCar: this.camMode !== 'chase',
      dist: 0, lay: 'i4', cyl: 4, ind: c.s.boost ? 1 : 0, boost: c.boost, exhaust: true });
    if (c.s.als && c.thr < 0.1 && c.rpm > 3500 && Math.random() < dt * 9) Sfx.burst(0.05, 220 + Math.random() * 200, 0.22, 'square');
    this._wasShift = c.shiftT > 0;
  },
  // spolujezdec: vidí auto podle stavu od řidiče
  followStep(dt) {
    const me = this.my;
    this.sProg = me.pose.s || 0;
    const K = Game.keys, help = Settings.down(K, 'interact');
    if (help !== this.helpOn) { this.helpOn = help; Net.send({ t: 'rhelp', team: me.id, on: help }); }
    const ps = me.pose;
    Sfx.engine({ rpm: ps.rpm || 900, throttle: ps.thr || 0, running: true, speed: Math.abs(ps.v || 0), slip: 0, wspin: 0, lock: 0, onRoad: true, inCar: this.camMode === 'co', dist: 0, lay: 'i4', cyl: 4, exhaust: true });
  },
  stateMsg() {
    const c = this.my.car, d = c.dmg;
    return { t: 'rs', team: this.my.id, x: +c.x.toFixed(2), z: +c.z.toFixed(2), y: +c.y.toFixed(2), h: +c.h.toFixed(3), p: +c.pitch.toFixed(3), r: +c.roll.toFixed(3), st: +c.steer.toFixed(3),
      v: +c.vf.toFixed(2), vx: +c.vx.toFixed(2), vz: +c.vz.toFixed(2), rpm: Math.round(c.rpm), thr: +c.thr.toFixed(2), g: c.gear, s: Math.round(this.sProg), tm: +(this.clock + this.penalty).toFixed(2),
      dm: [d.front, d.rear, d.left, d.right, d.engine].map(Math.round), off: d.off.reduce((a, o, i) => a | (o ? 1 << i : 0), 0), rep: +this.repair.toFixed(1), surf: c.surf[0], cn: this.cones };
  },
  interp(t, dt) {
    const n = t.net; if (!n) return;
    const ps = t.pose, sm = t.sm && t.sm.update(dt);
    if (sm) { ps.x = sm.x; ps.z = sm.z; ps.y = sm.y; ps.h = sm.h; ps.p = sm.p; ps.r = sm.r; }
    ps.st = n.st; ps.v = n.v; ps.rpm = n.rpm; ps.s = n.s; ps.thr = n.thr; ps.g = n.g; ps.w = n.v / RC_R;
  },

  // ---------- kolize a škody ----------
  collide(dt) {
    const me = this.my, c = me.car, tr = this.cur.tr, objs = RallyTrack.objsNear(tr, c.x, c.z), m = c.s.mass, I = m * 1.25;
    for (const lz of [1.45, 0, -1.45]) {
      const [cx, cz] = c.local2world(0, lz), R = 0.92;
      for (const o of objs) {
        if (o.broken) continue;
        const dx = cx - o.x, dz = cz - o.z, d = Math.hypot(dx, dz), pen = R + o.r - d;
        if (pen <= 0 || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d;
        const px = (cx - nx * R) - c.x, pz = (cz - nz * R) - c.z;
        const vpx = c.vx + c.r * pz, vpz = c.vz - c.r * px, vn = vpx * nx + vpz * nz;
        // kužel: vždycky odletí, nic nepoškodí a počítá se do úkolu
        if (o.kind === 'cone') {
          this.breakObj(o, nx, nz, true); this.cones++; c.vx *= 0.995; c.vz *= 0.995;
          const k = this.cones, G = RALLY_CONE_GOAL;
          if (k === G) this.msg(`Zaklepat 20 kuželů – SPLNĚNO!`, 2.4, 'good');
          else this.msg(`🔶 Zaklepáno ${k}/${G}`, 1, k > G ? 'good' : 'warn');
          Sfx.coneKnock(k, G);
          continue;
        }
        // tyčka a kaktus se zlomí
        if ((o.kind === 'pole' || o.kind === 'cactus' || o.kind === 'bush') && Math.abs(vn) > 1.5) {
          this.breakObj(o, nx, nz);
          const slow = o.kind === 'pole' ? 0.985 : o.kind === 'bush' ? 0.96 : 0.93; c.vx *= slow; c.vz *= slow;
          this.damage(px, pz, nx, nz, Math.max(0, -vn - 2) * RALLY_HIT[o.kind], o.kind);
          continue;
        }
        c.x += nx * pen; c.z += nz * pen;
        if (vn >= 0) continue;
        const rail = o.kind === 'rail', arm = pz * nx - px * nz, e = rail ? 0.12 : 0.22, J = -(1 + e) * vn / (1 / m + arm * arm / I);
        c.vx += J * nx / m; c.vz += J * nz / m; c.r += J * arm / I;
        // tření po boku
        const tx = -nz, tz = nx, vt = vpx * tx + vpz * tz; const fr = rail ? 0.04 : 0.25; c.vx -= tx * vt * fr; c.vz -= tz * vt * fr;
        if (!rail) { c.wF *= 0.6; c.wR *= 0.6; }
        if (-vn > 2.2) this.damage(px, pz, nx, nz, (-vn - 2.2) * (RALLY_HIT[o.kind] || 4), o.kind, -vn);
      }
    }
  },
  breakObj(o, nx, nz, quiet) {
    o.broken = true;
    const ang = Math.atan2(-nx, -nz), M = new THREE.Matrix4().compose(new THREE.Vector3(o.x - nx * 0.6, o.y + 0.08, o.z - nz * 0.6), new THREE.Quaternion().setFromEuler(new THREE.Euler(1.45, ang, 0, 'YXZ')), new THREE.Vector3(o.sc || 1, o.sc || 1, o.sc || 1));
    for (const e of o.inst) { e.im.setMatrixAt(e.i, M); e.im.instanceMatrix.needsUpdate = true; }
    if (!quiet) Sfx.burst(0.12, o.kind === 'pole' ? 900 : 300, 0.2, 'lowpass');
  },
  // px, pz = bod nárazu relativně ke středu auta (svět), n = normála ven z překážky
  damage(px, pz, nx, nz, amt, kind, speed) {
    if (amt <= 0.3) return;
    const me = this.my, c = me.car, d = c.dmg, sh = Math.sin(c.h), ch = Math.cos(c.h);
    const lx = px * ch - pz * sh, lz = px * sh + pz * ch;
    let zone = lz > 0.9 ? 'front' : lz < -0.9 ? 'rear' : lx > 0 ? 'left' : 'right';
    if (zone === 'front' && c.s.bull) amt *= 0.75;
    d[zone] = Math.min(100, d[zone] + amt);
    if (zone === 'front') d.engine = Math.min(100, d.engine + amt * 0.55);
    // kolo v rohu nárazu
    if (Math.abs(lz) > 0.55 && Math.abs(lx) > 0.25 || zone === 'left' || zone === 'right') {
      const wi = (lz >= 0 ? 0 : 2) + (lx >= 0 ? 0 : 1);
      if (!d.off[wi]) { d.wheel[wi] += amt * (zone === 'front' || zone === 'rear' ? 1.8 : 2.2); if (d.wheel[wi] >= 100) this.detachWheel(me, wi, true); }
    }
    // odpadávání dílů podle místa a síly nárazu
    const lost = d.lost || (d.lost = []);
    const lose = (name, cond, txt) => {
      if (!cond || lost.includes(name) || !me.parts.det || !me.parts.det[name]) return;
      lost.push(name); this.detachPart(me, name); this.msg(txt, 1.8, 'bad');
      if (this.opt.net) Net.send({ t: 'rpart', team: me.id, name });
    };
    lose('fbump', zone === 'front' && d.front >= 28 && amt > 6, 'Upadl ti přední nárazník!');
    lose('bull', zone === 'front' && d.front >= 50 && amt > 8, 'Rám před maskou je pryč!');
    lose('hood', zone === 'front' && d.front >= 60 && amt > 7, 'KAPOTA ODLETĚLA!');
    lose('rbump', zone === 'rear' && d.rear >= 28 && amt > 6, 'Upadl zadní nárazník!');
    lose('wing', zone === 'rear' && d.rear >= 40 && amt > 5, 'Utrhls křídlo!');
    lose('roof', (d.front + d.rear + d.left + d.right) / 4 > 45 && amt > 10, 'Rampa světel uletěla!');
    lose('mirL', (zone === 'left' && amt > 3) || (zone === 'front' && lx > 0.4 && amt > 10), 'Ulétlo levé zrcátko!');
    lose('mirR', (zone === 'right' && amt > 3) || (zone === 'front' && lx < -0.4 && amt > 10), 'Ulétlo pravé zrcátko!');
    // promáčknutí plechu (v lokálu auta: dovnitř = −n)
    const nlx = nx * ch - nz * sh, nlz = nx * sh + nz * ch;
    const dep = Math.min(0.3, amt * 0.008);
    this.dent(me.parts, lx, 0.65, lz, nlx, nlz, dep);
    if (this.opt.net) Net.send({ t: 'rhit', team: me.id, lx: +lx.toFixed(2), lz: +lz.toFixed(2), nx: +nlx.toFixed(2), nz: +nlz.toFixed(2), dep: +dep.toFixed(3) });
    if (amt > 4) { Sfx.crash(Math.min(1, amt / 40)); this.shake = Math.min(1, amt / 30); }
    if (amt > 12) this.msg(['Au! To byl ' + ({ tree: 'strom', rock: 'kámen', joshua: 'strom', cactus: 'kaktus', car: 'soupeř', pine: 'strom', oak: 'strom', rail: 'svodidlo' }[kind] || 'náraz'), 'Tohle bude stát peníze…', 'Plechy jsou v háji!'][this.hits++ % 3], 1.5, 'bad');
    if (d.engine > 60 && d.engine - amt * 0.55 <= 60) this.msg('Motor kouří! Šetři ho', 2, 'warn');
  },
  // deformace karoserie: posun vrcholů blízko místa nárazu
  dent(parts, lx, ly, lz, nlx, nlz, dep) {
    if (dep < 0.01) return;
    const root = parts.root; root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), M = new THREE.Matrix4(), Mi = new THREE.Matrix4(), v = new THREE.Vector3();
    const R = 0.75 + dep * 2;
    for (const m of parts.debris) {
      if (parts.tireMeshes.has(m) || !m.geometry || !m.geometry.attributes.position) continue;
      M.multiplyMatrices(inv, m.matrixWorld); Mi.copy(M).invert();
      const pos = m.geometry.attributes.position;
      let touched = false;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(M);
        const dd = Math.hypot(v.x - lx, (v.y - ly) * 0.8, v.z - lz);
        if (dd > R) continue;
        if (!touched) { if (!m.userData.dentGeo) { m.geometry = m.geometry.clone(); m.userData.dentGeo = true; } touched = true; }
        const f = dep * (1 - dd / R) * (0.75 + Math.random() * 0.5);
        v.x -= nlx * f; v.z -= nlz * f; v.y -= f * 0.25;
        v.applyMatrix4(Mi);
        m.geometry.attributes.position.setXYZ(i, v.x, v.y, v.z);
      }
      if (touched) {
        const g = m.geometry; g.attributes.position.needsUpdate = true; g.computeVertexNormals();
        const old = m.children.find(o => o.isLineSegments); if (old) { m.remove(old); old.geometry.dispose(); }
        CarModel.outline(m);
      }
    }
  },
  landing(v) {
    const c = this.my.car, amt = (v - 5.5) * 4.5 * c.s.land;
    if (amt <= 0) return;
    c.dmg.engine = Math.min(100, c.dmg.engine + amt * 0.35);
    for (let i = 0; i < 4; i++) if (!c.dmg.off[i]) { c.dmg.wheel[i] += amt * 0.5; if (c.dmg.wheel[i] >= 100) this.detachWheel(this.my, i, true); }
    c.dmg.front = Math.min(100, c.dmg.front + amt * 0.4);
    this.shake = Math.min(1, amt / 20); Sfx.crash(Math.min(1, amt / 30));
    if (amt > 5) this.msg('Tvrdý dopad! ' + (c.s.land < 0.6 ? 'Podvozek to ustál' : 'Podvozek trpí'), 1.4, 'warn');
  },
  // odpadlý díl karoserie (kapota, nárazník, zrcátko, křídlo…) – odletí a zůstane ležet na trati
  detachPart(t, name) {
    const P = t.parts, o = P.det && P.det[name];
    if (!o || !o.parent || (t.lostVis = t.lostVis || []).includes(name)) return;
    t.lostVis.push(name);
    P.root.updateMatrixWorld(true);
    this.cur.sc.attach(o);
    const ps = t.pose, sh = Math.sin(ps.h), ch = Math.cos(ps.h);
    const lp = o.position.clone(); P.root.worldToLocal(lp);
    const lx = name === 'mirL' ? 1 : name === 'mirR' ? -1 : (Math.random() - 0.5) * 0.6, lz = name === 'fbump' || name === 'hood' || name === 'bull' ? 1 : name === 'rbump' || name === 'wing' ? -1 : 0;
    const out = [ch * lx + sh * lz, -sh * lx + ch * lz];
    const vx = t.car ? t.car.vx : (t.net ? t.net.vx || 0 : 0), vz = t.car ? t.car.vz : (t.net ? t.net.vz || 0 : 0), big = name === 'hood' ? 1.4 : 1;
    t.loose.push({ obj: o, part: name, vx: vx * 0.55 + out[0] * 3 * big, vz: vz * 0.55 + out[1] * 3 * big, vy: (name === 'hood' ? 6 : 3.5) + Math.random() * 2.5,
      sx: (Math.random() - 0.5) * 10, sz: (Math.random() - 0.5) * 12, rest: false, flip: Math.random() < 0.4, drag: name === 'hood' || name === 'wing' ? 0.9 : 0.25 });
    Sfx.burst(0.25, 2600, 0.35, 'highpass'); Sfx.tone(180, 0.18, 0.2, 'triangle', 90);
  },
  detachWheel(t, i, local) {
    const w = t.parts.wheels[i], sc = this.cur.sc;
    if (local) { const d = t.car.dmg; if (d.off[i]) return; d.off[i] = true; d.wheel[i] = 100; this.repair = 0; }
    if (t.dmgVis.off[i]) return;
    t.dmgVis.off[i] = true;
    t.parts.root.updateMatrixWorld(true);
    sc.attach(w.pivot);
    const ps = t.pose, sh = Math.sin(ps.h), ch = Math.cos(ps.h), side = w.x > 0 ? 1 : -1;
    const vx = t.car ? t.car.vx : (t.net ? t.net.vx || 0 : 0), vz = t.car ? t.car.vz : (t.net ? t.net.vz || 0 : 0);
    t.loose.push({ obj: w.pivot, i, vx: vx * 0.8 + ch * side * 3.5, vz: vz * 0.8 - sh * side * 3.5, vy: 3 + Math.random() * 2, sx: (Math.random() - 0.5) * 8, sz: 10 + Math.random() * 10, rest: false });
    w.susp.visible = false;
    if (t.mine) { this.msg(t === this.my && this.role === 'driver' ? 'UTRHL SES KOLO! Zastav a drž E – nasadíš ho zpátky' : 'Utrhli jste kolo! Drž E a pomoz s výměnou', 4, 'bad'); Sfx.crash(1); }
  },
  attachWheel(t, i) {
    const w = t.parts.wheels[i];
    const L = t.loose.find(l => l.i === i); if (L) t.loose.splice(t.loose.indexOf(L), 1);
    t.parts.root.add(w.pivot); w.pivot.position.set(w.x, WHEEL_R, w.z); w.pivot.rotation.set(0, 0, 0); w.spin.rotation.set(0, 0, 0);
    w.susp.visible = true; t.dmgVis.off[i] = false;
    if (t.car) { t.car.dmg.off[i] = false; t.car.dmg.wheel[i] = 45; this.repair = 0; this.msg('Kolo je zpátky! Jeď, jeď!', 2, 'good'); Sfx.install(); }
  },

  // ---------- vizuál ----------
  updateVis(t, dt) {
    const p = t.parts, ps = t.pose, c = t.car;
    const sh = this.shake && t === this.my ? this.shake * 0.04 : 0;
    p.root.position.set(ps.x, ps.y + (c ? c.bz : 0) + (Math.random() - 0.5) * sh, ps.z);
    // náklon z přetížení + terén
    // odpružení: vlastní auto má plnou simulaci pružin, vzdálené auto přibližný náklon z pohybu
    let bz = 0, bp = 0, br = 0, droop = 0;
    if (c) { bz = c.bz; bp = c.bp; br = c.br; droop = c.droop; }
    else {
      const n = t.net, dv = ((ps.v || 0) - (t._pv || 0)) / Math.max(dt, 1e-3), yr = U.wrapAngle(ps.h - (t._ph ?? ps.h)) / Math.max(dt, 1e-3);
      t._pv = ps.v || 0; t._ph = ps.h;
      // náklon karoserie už je v p/r ze sítě
    }
    t._bz = bz;
    const off = c ? c.dmg.off : t.dmgVis.off, tilt = (off[0] || off[2] ? -0.07 : 0) + (off[1] || off[3] ? 0.07 : 0), ptilt = (off[0] || off[1] ? 0.05 : 0) + (off[2] || off[3] ? -0.05 : 0);
    p.root.rotation.set(-(ps.p || 0) - bp + ptilt, ps.h, (ps.r || 0) + br + tilt, 'YXZ');
    if (sh) this.shake = Math.max(0, this.shake - dt * 2.5);
    const spin = (c ? null : (ps.w || 0) * dt);
    p.wheels.forEach((w, i) => {
      if (w.pivot.parent !== p.root) return;
      w.spin.rotation.x += c ? (i < 2 ? c.wF : c.wR) * dt : spin;
      // kolo zůstává na zemi, karoserie se nad ním houpe (stlačení/roztažení pružiny)
      w.pivot.position.y = WHEEL_R + (c && c.wy ? c.wy[i] : U.clamp(-bz - w.z * bp - w.x * br - droop * 0.1, -0.16, 0.14));
      if (w.susp.visible) { w.susp.position.y = w.pivot.position.y; w.susp.scale.y = SPRING_TOP - w.pivot.position.y; }
      const wd = c ? c.dmg.wheel[i] : 0; w.pivot.rotation.z = wd > 50 ? (w.x > 0 ? 1 : -1) * (wd - 50) * 0.0025 : 0;
    });
    p.steerPivots.forEach(pv => { pv.rotation.y = ps.st || 0; });
    p.wheelGrp.rotation.z = -(ps.st || 0) * 2.6;
    // kapota: nad 45 % předku odskočí a plápolá
    const dm = c ? c.dmg : t.netDm || {};
    const front = dm.front || (Array.isArray(dm) ? dm[0] : 0);
    const hoodT = front > 45 ? -0.35 - Math.sin(this.clock * 23) * 0.06 * Math.min(1, Math.abs(ps.v || 0) / 15) : 0;
    if (p.hood.parent === p.root) p.hood.rotation.x = U.lerp(p.hood.rotation.x, hoodT, Math.min(1, dt * 8));
    p.tailMat.emissive.setHex(c && c.brk > 0.1 ? 0xff2010 : 0x300804);
    // kouř z motoru
    const eng = c ? c.dmg.engine : (t.netEng || 0);
    t.smT = (t.smT || 0) - dt;
    if (eng > 55 && t.smT <= 0) {
      t.smT = eng > 85 ? 0.05 : 0.12;
      const [wx, wz] = this.l2w(ps, 0, 1.6); this.puff(wx, ps.y + 1.05, wz, eng > 85 ? 0x2a2622 : 0x8a8680, 1.3, 0, 1.1, 0);
    }
    // prach od kol
    const v = Math.abs(ps.v || 0);
    if (v > 4) {
      t.dT = (t.dT || 0) - dt * v * 0.12;
      if (t.dT <= 0) {
        t.dT = 1;
        const surf = c ? c.surf[2] : (t.net && t.net.surf) || 'gravel', S = RALLY_SURF[surf];
        if (S.dust) for (const sx of [0.78, -0.78]) { const [wx, wz] = this.l2w(ps, sx, -1.6); this.puff(wx, ps.y + 0.3, wz, S.col, 1 + S.dust * 0.6, (Math.random() - 0.5), 0.6, 0); }
      }
    }
    // utržená kola
    for (const L of t.loose) {
      if (L.rest) continue;
      const o = L.obj; L.vy -= 9.81 * dt;
      if (L.part) { const k = 1 - Math.min(0.5, dt * L.drag); L.vx *= k; L.vz *= k; if (L.vy < 0) L.vy *= 1 - Math.min(0.5, dt * L.drag * 0.8); }
      o.position.x += L.vx * dt; o.position.y += L.vy * dt; o.position.z += L.vz * dt;
      o.rotation.x += L.sz * dt; o.rotation.z += L.sx * dt * (L.part ? 1 : 0.2);
      const gy = RallyTrack.height(this.cur.tr, o.position.x, o.position.z) + (L.part ? 0.06 : WHEEL_R * 0.4);
      if (o.position.y < gy) {
        o.position.y = gy; L.vy = Math.abs(L.vy) * (L.part ? 0.25 : 0.35); L.vx *= L.part ? 0.6 : 0.75; L.vz *= L.part ? 0.6 : 0.75; L.sz *= 0.6; L.sx *= 0.6;
        if (Math.hypot(L.vx, L.vz) < 0.4 && Math.abs(L.vy) < 0.6) { L.rest = true; o.rotation.set(L.part ? (L.flip ? Math.PI : 0) : 0, o.rotation.y, L.part ? 0 : Math.PI / 2); }
      }
    }
    // při opravě kolo „přiletí“ zpátky k náboji
    const rep = t === this.my ? this.repair / 7 : (t.netRep || 0) / 7;
    if (rep > 0.05) for (const L of t.loose) {
      if (L.part) continue;
      const w = t.parts.wheels[L.i], [hx, hz] = this.l2w(ps, w.x * 1.6, w.z), k = Math.min(1, dt * 3 * rep);
      L.obj.position.x += (hx - L.obj.position.x) * k; L.obj.position.z += (hz - L.obj.position.z) * k; L.obj.position.y += (ps.y + 0.5 - L.obj.position.y) * k; L.rest = true;
    }
    // poškození u síťových aut
    if (!c && t.netOff !== undefined) for (let i = 0; i < 4; i++) { const o = !!(t.netOff & (1 << i)); if (o && !t.dmgVis.off[i]) this.detachWheel(t, i, false); else if (!o && t.dmgVis.off[i]) this.attachWheel(t, i); }
  },
  l2w(ps, lx, lz) { const sh = Math.sin(ps.h), ch = Math.cos(ps.h); return [ps.x + ch * lx + sh * lz, ps.z - sh * lx + ch * lz]; },
  puff(x, y, z, col, size, vx, vy, vz) {
    const p = this.cur.dust.find(q => q.life <= 0); if (!p) return;
    p.life = 1; p.s.visible = true; p.s.position.set(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4); p.s.material.color.setHex(col); p.size = size;
    p.vx = vx || 0; p.vy = vy || 0.4; p.vz = vz || 0;
  },
  updateDust(dt) {
    for (const p of this.cur.dust) {
      if (p.life <= 0) continue;
      p.life -= dt * 0.7; p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      const sc = p.size * (1 + (1 - p.life) * 3.5); p.s.scale.set(sc, sc, sc);
      p.s.material.opacity = Math.max(0, p.life) * 0.5; if (p.life <= 0) p.s.visible = false;
    }
  },
  updateCam(dt) {
    const cam = this.cur.cam, ps = this.my.pose, v = Math.abs(ps.v || 0);
    cam.aspect = innerWidth / innerHeight;
    // rozhlížení myší: pohled zůstane, kam ho otočíš (žádné samovolné vracení dopředu); reset = přepnutí kamery
    this.lookIdle = (this.lookIdle || 0) + dt;
    const ly = this.lookYaw || 0, lp = this.lookPitch || 0;
    if (this.camMode === 'chase') {
      const f = [Math.sin(ps.h + ly), Math.cos(ps.h + ly)], up = Math.sin(U.clamp(-lp, -0.3, 0.9));
      const dist = 6.4 * Math.cos(U.clamp(-lp, -0.3, 0.9) * 0.8);
      const want = new THREE.Vector3(ps.x - f[0] * dist, ps.y + 2.5 + up * 5, ps.z - f[1] * dist);
      if (!this._cp) this._cp = want.clone(); else this._cp.lerp(want, Math.min(1, dt * 10));
      const gy = RallyTrack.height(this.cur.tr, this._cp.x, this._cp.z) + 0.8; if (this._cp.y < gy) this._cp.y = gy;
      cam.position.copy(this._cp);
      const sh = (this.shake || 0) * 0.2; cam.position.x += (Math.random() - 0.5) * sh; cam.position.y += (Math.random() - 0.5) * sh;
      cam.lookAt(ps.x + f[0] * 4, ps.y + 1.0, ps.z + f[1] * 4);
      cam.fov = Settings.s.fov - 6 + Math.min(18, v * 0.3);
    } else {
      cam.fov = Settings.s.fov + Math.min(14, v * 0.2);
      if (this._camBase) cam.rotation.set(this._camBase.x + lp, this._camBase.y + ly, 0);
      if (this.camMode === 'cockpit' && this.my.hands) Hands.updateCar(this.my.hands, { parts: this.my.parts, shiftAnim: 0, handbrake: this.my.car && this.my.car.hb, speed: v, radioAnim: 0 }, true, dt);
    }
    if (this.my.hands) this.my.hands.rig.visible = this.camMode === 'cockpit';
    cam.updateProjectionMatrix();
  },

  // ---------- přístroje ----------
  // kulatý ciferník jako v autě: stupnice, červené pole, ručička
  dial(g, cx, cy, r, val, max, step, o) {
    o = o || {};
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, fg = o.fg || '#f4ecd8';
    const grd = g.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r);
    grd.addColorStop(0, '#2a2622'); grd.addColorStop(1, '#0a0908');
    g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a8a90'; g.lineWidth = r * 0.06; g.stroke();
    g.strokeStyle = '#2a2a2e'; g.lineWidth = r * 0.02; g.beginPath(); g.arc(cx, cy, r * 0.96, 0, Math.PI * 2); g.stroke();
    if (o.redFrom !== undefined) { g.strokeStyle = '#c8281a'; g.lineWidth = r * 0.08; g.beginPath(); g.arc(cx, cy, r * 0.84, a0 + (a1 - a0) * o.redFrom / max, a1); g.stroke(); }
    g.fillStyle = fg; g.strokeStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `bold ${Math.round(r * 0.15)}px Arial`;
    const minor = o.minor || step / 2;
    for (let v = 0; v <= max + 1e-6; v += minor) {
      const a = a0 + (a1 - a0) * v / max, major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
      g.lineWidth = major ? r * 0.035 : r * 0.018; g.beginPath();
      g.moveTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92); g.lineTo(cx + Math.cos(a) * r * (major ? 0.76 : 0.84), cy + Math.sin(a) * r * (major ? 0.76 : 0.84)); g.stroke();
      if (major && Math.round(v / step) % (o.labelEvery || 1) === 0) g.fillText(String(Math.round(v)), cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62);
    }
    if (o.label) { g.font = `${Math.round(r * 0.11)}px Arial`; g.fillStyle = '#b8b0a0'; g.fillText(o.label, cx, cy - r * 0.3); }
    if (o.center) { g.font = `bold ${Math.round(r * (o.centerSize || 0.3))}px Arial`; g.fillStyle = o.centerCol || fg; g.fillText(o.center, cx, cy + r * 0.42); }
    if (o.sub) { g.font = `bold ${Math.round(r * 0.11)}px Arial`; g.fillStyle = '#b8b0a0'; g.fillText(o.sub, cx, cy + r * 0.66); }
    const a = a0 + (a1 - a0) * U.clamp(val / max, 0, 1.04);
    g.strokeStyle = o.needle || '#ff5a2a'; g.lineWidth = r * 0.045; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx - Math.cos(a) * r * 0.14, cy - Math.sin(a) * r * 0.14); g.lineTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86); g.stroke(); g.lineCap = 'butt';
    g.fillStyle = '#3a3a3e'; g.beginPath(); g.arc(cx, cy, r * 0.08, 0, Math.PI * 2); g.fill();
  },
  // HUD ve třetí osobě: otáčkoměr + tachometr vpravo dole
  drawCluster(g, W, H, f) {
    g.clearRect(0, 0, W, H);
    const vmax = f.c && f.c.s.hp > 260 ? 260 : 220, rmax = Math.ceil(f.red / 1000) + 1;
    const gearTxt = f.gear === -1 ? 'R' : f.gear === 0 ? 'N' : String(f.gear);
    this.dial(g, 128, 262, 120, f.rpm / 1000, rmax, 1, { redFrom: f.red / 1000, label: 'x1000 ot/min', center: gearTxt, centerSize: 0.42, centerCol: f.limiter ? '#ff5a4a' : '#ffcf86', sub: f.auto ? 'AUTOMAT' : 'MANUÁL' });
    this.dial(g, 388, 208, 166, f.spd, vmax, 20, { minor: 10, labelEvery: 2, label: 'km/h', center: String(Math.round(f.spd)), centerSize: 0.26 });
    if (f.boost >= 0) {
      g.fillStyle = 'rgba(10,9,8,.8)'; g.fillRect(70, 392, 140, 16); g.fillStyle = '#5ab0ff'; g.fillRect(72, 394, 136 * U.clamp(f.boost, 0, 1), 12);
      g.fillStyle = '#cfe6ff'; g.font = 'bold 14px Arial'; g.textAlign = 'center'; g.fillText('TURBO', 140, 380);
    }
    if (f.c) {
      const surf = f.c.surf[0], gq = this.gripOn(f.c.s, surf) / RALLY_SURF[surf].mu;
      g.font = 'bold 22px Arial'; g.textAlign = 'center'; g.fillStyle = 'rgba(10,9,8,.75)'; g.fillRect(270, 384, 220, 32);
      g.fillStyle = gq > 1.02 ? '#7adf8a' : gq > 0.9 ? '#ffcf3a' : '#ff6a5a';
      g.fillText(RALLY_SURF[surf].name + (gq > 1.02 ? ' ✔' : gq > 0.9 ? ' ~' : ' ✖ gumy'), 380, 401);
    }
  },
  // budíky v palubní desce (kokpit)
  drawCockpit(parts, f) {
    const cv = parts.dashCanvas, g = cv.getContext('2d'), W = cv.width, H = cv.height, c = f.c;
    g.fillStyle = '#100d0b'; g.fillRect(0, 0, W, H);
    const vmax = c && c.s.hp > 260 ? 260 : 220, rmax = Math.ceil(f.red / 1000) + 1;
    this.dial(g, 190, 200, 175, f.spd, vmax, 20, { minor: 10, labelEvery: 2, label: 'km/h', center: String(Math.round(f.spd)), centerSize: 0.24 });
    this.dial(g, 834, 200, 175, f.rpm / 1000, rmax, 1, { redFrom: f.red / 1000, label: 'x1000 ot/min' });
    const n = 10; for (let i = 0; i < n; i++) { const on = f.rpm / f.red > 0.6 + i * 0.04; g.fillStyle = on ? (i > 7 ? '#ff3a2a' : i > 4 ? '#ffcf3a' : '#5adf6a') : '#2a2420'; g.beginPath(); g.arc(413 + i * 22, 36, 8, 0, 7); g.fill(); }
    g.fillStyle = '#0a0908'; g.fillRect(400, 60, 224, 150);
    g.fillStyle = f.limiter ? '#ff4a3a' : '#ffb347'; g.font = 'bold 120px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(f.gear === -1 ? 'R' : f.gear === 0 ? 'N' : String(f.gear), 512, 140);
    g.fillStyle = '#d8ccb0'; g.font = 'bold 22px Arial'; g.fillText(f.auto ? 'AUTO' : 'MANUÁL', 512, 232);
    if (f.boost >= 0) { g.fillStyle = '#2a2420'; g.fillRect(410, 256, 204, 16); g.fillStyle = '#5fd3ff'; g.fillRect(412, 258, 200 * U.clamp(f.boost, 0, 1), 12); g.fillStyle = '#9ad0ff'; g.font = 'bold 16px Arial'; g.fillText('TURBO', 512, 290); }
    if (c) {
      const d = c.dmg, lamps = [['(P)', c.hb, '#e0442f'], ['MOTOR', d.engine > 40, '#ff9a2a'], ['KOLO', d.off.some(o => o), '#e0442f'], ['ABS', c.brk > 0.3 && Math.abs(c._kF || 0) > 0.08, '#ffcf3a'], ['ŠKODY', (d.front + d.rear + d.left + d.right) / 4 > 40, '#ff9a2a']];
      g.font = 'bold 18px Arial';
      lamps.forEach(([t, on, col], i) => { g.fillStyle = on ? col : '#3a3028'; g.fillText(t, 412 + (i % 3) * 100, 326 + Math.floor(i / 3) * 30); });
      g.fillStyle = '#d8ccb0'; g.font = 'bold 20px Arial'; g.fillText(RALLY_SURF[c.surf[0]].name.toUpperCase(), 512, 384);
    }
    parts.dashTex.needsUpdate = true;
    if (parts.diagCanvas) {   // vedlejší displej: čas a kužely
      const q = parts.diagCanvas.getContext('2d'), w = parts.diagCanvas.width, h = parts.diagCanvas.height, k = this.cones || 0;
      q.fillStyle = '#0a1418'; q.fillRect(0, 0, w, h); q.textAlign = 'center'; q.textBaseline = 'middle';
      q.fillStyle = '#9ad0ff'; q.font = 'bold 34px Arial'; q.fillText('RALLY', w / 2, 50);
      q.font = 'bold 64px Arial'; q.fillStyle = '#f4ecd8'; q.fillText($('rhTime').textContent.split(' ')[0], w / 2, 150);
      q.font = 'bold 40px Arial'; q.fillStyle = k >= RALLY_CONE_GOAL ? '#8fff9a' : '#ffb347';
      q.font = 'bold 30px Arial'; q.fillText('ZAKLEPAT 20 KUŽELŮ', w / 2, 235); q.font = 'bold 48px Arial'; q.fillText(`${k} / ${RALLY_CONE_GOAL}`, w / 2, 290);
      q.font = 'bold 28px Arial'; q.fillStyle = '#d8ccb0'; q.fillText(Math.round(this.sProg) + ' / ' + Math.round(this.cur.tr.len) + ' m', w / 2, 350);
      parts.diagTex.needsUpdate = true;
    }
  },

  // ---------- HUD ----------
  hud(dt) {
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) $('rhMsg').style.opacity = 0; }
    if (this.callT > 0) { this.callT -= dt; if (this.callT <= 0) $('rhCall').style.opacity = 0; }
    const me = this.my, c = me.car, ps = me.pose;
    const tm = c ? (this.started ? (this.finished ? this.finalT : this.clock + this.penalty) : 0) : (me.net ? me.net.tm || 0 : 0);
    { const tt = this.fmt(Math.max(0, tm)) + (this.penalty ? ` (+${this.penalty} s)` : ''), te = $('rhTime'); if (te._t !== tt) { te._t = tt; te.textContent = tt; } }
    {
      const k = this.cones || 0, G = RALLY_CONE_GOAL, el = $('rhCones'), left = this.cur.tr.objs.filter(o => o.kind === 'cone' && !o.broken && o.s > this.sProg).length;
      const html = `🔶 Zaklepat 20 kuželů<b style="display:block;font-size:22px">${k} / ${G}</b><i>${k >= G ? 'SPLNĚNO! ✔' : `zbývá ${G - k} · na trati ještě ${left}`}</i>`;
      if (el._h !== html) { el._h = html; el.innerHTML = html; el.className = k >= G ? 'ok' : ''; }
    }
    const tr = this.cur.tr;
    { const w = (U.clamp(this.sProg / tr.len, 0, 1) * 100).toFixed(1) + '%', pe = $('rhProg'); if (pe._w !== w) { pe._w = w; pe.style.width = w; } }
    // přístroje
    const cv = $('rhDash'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
    this.dashT = (this.dashT || 0) - dt;
    if (this.dashT <= 0) {
      this.dashT = 1 / 30;
      const red = c ? c.s.red : 7500, rpm = c ? c.rpm : ps.rpm || 900, gear = c ? c.gear : ps.g || 1, spd = Math.abs(ps.v || 0) * 3.6;
      const info = { spd, rpm, red, gear, c, auto: c ? c.s.auto : true, boost: c && c.s.boost ? c.boost : -1, limiter: c && c.limiter };
      if (this.camMode === 'cockpit' && me.parts.dashCanvas) this.drawCockpit(me.parts, info);
      else if (this.camMode !== 'co') this.drawCluster(g, W, H, info);
    }
    // schéma poškození
    const dc = $('rhDmg'), q = dc.getContext('2d'), dm = c ? c.dmg : this.netDmg(me);
    q.clearRect(0, 0, dc.width, dc.height);
    q.fillStyle = 'rgba(12,8,4,.72)'; q.fillRect(0, 0, dc.width, dc.height);
    const col = (v) => v > 75 ? '#ff4a3a' : v > 40 ? '#ffb030' : v > 10 ? '#e8e070' : '#6ad07a';
    const cx = 60, cy = 104;
    q.fillStyle = col(dm.front); q.fillRect(cx - 26, cy - 72, 52, 34);
    q.fillStyle = col(dm.rear); q.fillRect(cx - 26, cy + 38, 52, 30);
    q.fillStyle = col(dm.left); q.fillRect(cx - 30, cy - 36, 12, 72);
    q.fillStyle = col(dm.right); q.fillRect(cx + 18, cy - 36, 12, 72);
    q.fillStyle = col(dm.engine); q.fillRect(cx - 14, cy - 64, 28, 18);
    [[-38, -54], [38, -54], [-38, 50], [38, 50]].forEach(([x, y], i) => { q.fillStyle = dm.off[i] ? '#000' : col(dm.wheel[i]); q.fillRect(cx + x - 7, cy + y - 13, 14, 26); if (dm.off[i]) { q.strokeStyle = '#ff4a3a'; q.lineWidth = 2; q.strokeRect(cx + x - 7, cy + y - 13, 14, 26); } });
    const tot = Math.round((dm.front + dm.rear + dm.left + dm.right) / 4 * 0.6 + dm.engine * 0.4);
    q.fillStyle = '#f4e9d2'; q.font = 'bold 13px Arial'; q.textAlign = 'center'; q.fillText(`ŠKODY ${tot} %`, cx, 194);
    q.fillText(`MOTOR ${Math.round(dm.engine)} %`, cx, 14);
    // oprava kola
    const rp = $('rhRepair'), rep = c ? this.repair : (me.netRep || 0);
    if (this.repairOn || (!c && dm.off.some(o => o))) {
      rp.style.display = 'block';
      rp.innerHTML = `<b>🔧 Nasazování kola</b> <span><i style="width:${U.clamp(rep / 7, 0, 1) * 100}%"></i></span><div>${c ? (c.speed > 1 ? 'Zastav auto!' : `Drž <b>${Settings.keyName(Settings.key('interact'))}</b>${this.opt.net && me.co >= 0 ? ' – spolujezdec pomáhá taky' : ' – spolujezdec pomáhá'}`) : `Drž <b>${Settings.keyName(Settings.key('interact'))}</b> = pomáháš řidiči${this.helpOn ? ' ✔' : ''}`}</div>`;
    } else rp.style.display = 'none';
    // pokyny na pruhu (jen se spolujezdcem AI – v koopu je hlásí kámoš)
    this._hudT = (this._hudT || 0) - dt;
    if (this._hudT <= 0) {
      this._hudT = 0.15;
      const strip = $('rhNotes');
      if (this.role === 'driver' && this.aiCodriverOn !== false && (!this.opt.net || me.co < 0 || this.coLeft)) {
        const up = tr.notes.filter(nn => nn.s > this.sProg - 5).slice(0, 3);
        const h = up.map(nn => `<div class="rn ${nn.kind}"><b>${this.noteIcon(nn)}</b><span>${nn.txt.split(',')[0]}</span><i>${Math.max(0, Math.round(nn.s - this.sProg))} m</i></div>`).join('');
        if (strip._h !== h) { strip._h = h; strip.innerHTML = h; }
        if (strip.style.display !== 'flex') strip.style.display = 'flex';
      } else if (strip.style.display !== 'none') strip.style.display = 'none';
      const K = (x) => Settings.keyName(Settings.key(x));
      const kh = this.role === 'codriver'
        ? `<b>1–8</b> rychlé povely · <b>Enter</b> přečti další pokyn z rozpisu · <b>${K('interact')}</b> pomoc s kolem · <b>${K('camera')}</b> kamera`
        : `<b>${K('forward')}/${K('back')}</b> plyn/brzda · <b>${K('left')}/${K('right')}</b> řízení · <b>${K('handbrake')}</b> ručka · ${c && !c.s.auto ? `<b>${K('shiftUp')}/${K('shiftDown')}</b> řazení · ` : ''}<b>${K('gearmode')}</b> automat · <b>${K('camera')}</b> kamera · <b>X</b> na trať (+5 s) · <b>myš</b> rozhlížení · <b>Esc</b> vzdát`;
      const ke = $('rhKeys'); if (ke._h !== kh) { ke._h = kh; ke.innerHTML = kh; }
      // ostatní posádky
      const th = this.ais ? this.aiBoard() : this.teams.length > 1 ? this.teams.map(t => `<div style="color:${RALLY_TEAM_COL[t.id % 2]}">${t.mine ? '▶ ' : ''}${String(t.crew).replace(/[<>&]/g, '')} <b>${t.res ? (t.res.dnf ? 'DNF' : this.fmt(t.res.time)) : Math.round((t.pose.s || 0) / tr.len * 100) + ' %'}</b></div>`).join('') : '';
      const te = $('rhTeams'); if (te._h !== th) { te._h = th; te.innerHTML = th; }
    }
  },
  netDmg(t) { const a = t.netDm || [0, 0, 0, 0, 0], off = t.netOff || 0; return { front: a[0], rear: a[1], left: a[2], right: a[3], engine: a[4], wheel: [0, 0, 0, 0], off: [0, 1, 2, 3].map(i => !!(off & (1 << i))) }; },
  noteIcon(n) {
    if (n.kind === 'jump') return '⤴'; if (n.kind === 'crest') return '⌒'; if (n.kind === 'surf') return '◈'; if (n.kind === 'finish') return '🏁';
    return (n.dir > 0 ? '↱' : '↰') + (n.sev === 0 ? 'V' : n.sev);
  },
  // tablet spolujezdce: mapa natočená po směru jízdy + rozpis
  drawTablet(dt) {
    this.tabT -= dt; if (this.tabT > 0) return; this.tabT = 1 / 15;
    const cv = $('rhTablet'), g = cv.getContext('2d'), W = cv.width, H = cv.height, tr = this.cur.tr, ps = this.my.pose, P = tr.pts;
    g.fillStyle = '#10151a'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1c2630'; g.fillRect(0, 0, W, 44);
    g.fillStyle = '#9ad0ff'; g.font = 'bold 20px Arial'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('📋 ROZPIS · ' + tr.stage.name, 14, 22);
    g.textAlign = 'right'; g.fillStyle = '#f4e9d2'; g.fillText(Math.round(Math.abs(ps.v || 0) * 3.6) + ' km/h', W - 14, 22);
    // mapa: auto dole uprostřed, nahoru = směr jízdy
    const mx = W / 2, my = 400, sc = 0.82, MH = 360;
    g.save(); g.beginPath(); g.rect(10, 52, W - 20, MH); g.clip();
    g.fillStyle = '#18222c'; g.fillRect(10, 52, W - 20, MH);
    const s0 = Math.max(0, Math.round((this.sProg - 60) / RT_STEP)), s1 = Math.min(P.length - 1, Math.round((this.sProg + 480) / RT_STEP));
    const hh = ps.h, toS = (x, z) => { const dx = x - ps.x, dz = z - ps.z, lx = dx * Math.cos(hh) - dz * Math.sin(hh), lz = dx * Math.sin(hh) + dz * Math.cos(hh); return [mx - lx * sc, my - lz * sc]; };
    const surfCol = { asphalt: '#8a8a92', gravel: '#c8a878', sand: '#f0d090' };
    g.lineCap = 'round'; g.lineWidth = 9;
    for (let i = s0; i < s1; i++) { const a = toS(P[i].x, P[i].z), b = toS(P[i + 1].x, P[i + 1].z); g.strokeStyle = surfCol[P[i].surf]; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); }
    // značky pokynů
    g.font = 'bold 15px Arial'; g.textAlign = 'center';
    for (const n of tr.notes) {
      if (n.s < this.sProg - 20 || n.s > this.sProg + 470) continue;
      const p = P[Math.min(P.length - 1, Math.round(n.s / RT_STEP))], [x, y] = toS(p.x, p.z);
      const col = n.kind === 'corner' ? (n.sev <= 1 ? '#ff5a4a' : n.sev <= 3 ? '#ffb347' : '#7adf8a') : n.kind === 'jump' ? '#ff7aff' : '#9ad0ff';
      g.fillStyle = col; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill();
      const lab = this.noteIcon(n), tw = g.measureText(lab).width + 10;
      g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(x + 9, y - 11, tw, 22); g.fillStyle = col; g.textAlign = 'left'; g.fillText(lab, x + 14, y + 1); g.textAlign = 'center';
    }
    // ostatní posádky
    for (const t of this.teams) if (!t.mine) { const [x, y] = toS(t.pose.x, t.pose.z); g.fillStyle = RALLY_TEAM_COL[t.id % 2]; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); }
    g.fillStyle = '#ffcf3a'; g.beginPath(); g.moveTo(mx, my - 14); g.lineTo(mx - 9, my + 9); g.lineTo(mx + 9, my + 9); g.closePath(); g.fill();
    g.restore();
    // přehled celé trati
    const bx = W - 130, by = 58, bw = 112, bh = 112;
    let xa = 1e9, xb = -1e9, za = 1e9, zb = -1e9; for (let i = 0; i < P.length; i += 4) { xa = Math.min(xa, P[i].x); xb = Math.max(xb, P[i].x); za = Math.min(za, P[i].z); zb = Math.max(zb, P[i].z); }
    const k = Math.min(bw / (xb - xa || 1), bh / (zb - za || 1)) * 0.9;
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(bx - 4, by - 4, bw + 8, bh + 8); g.strokeStyle = '#6a7a8a'; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i < P.length; i += 4) { const x = bx + bw / 2 + (P[i].x - (xa + xb) / 2) * k, y = by + bh / 2 + (P[i].z - (za + zb) / 2) * k; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.fillStyle = '#ffcf3a'; g.beginPath(); g.arc(bx + bw / 2 + (ps.x - (xa + xb) / 2) * k, by + bh / 2 + (ps.z - (za + zb) / 2) * k, 4, 0, 7); g.fill();
    // seznam dalších pokynů
    while (this.cdNext < tr.notes.length && tr.notes[this.cdNext].s < this.sProg - 10) this.cdNext++;
    let y = 52 + MH + 22;
    g.textAlign = 'left'; g.fillStyle = '#9ad0ff'; g.font = 'bold 16px Arial'; g.fillText('DALŠÍ POKYNY  (Enter = přečti zvýrazněný)', 16, y); y += 28;
    tr.notes.filter(n => n.s > this.sProg - 10).slice(0, 5).forEach((n, i) => {
      const idx = tr.notes.indexOf(n), hi = idx === this.cdNext;
      g.fillStyle = hi ? 'rgba(255,207,58,.22)' : 'rgba(255,255,255,.04)'; g.fillRect(12, y - 16, W - 24, 32);
      g.fillStyle = hi ? '#ffcf3a' : '#f4e9d2'; g.font = `bold ${hi ? 19 : 17}px Arial`; g.fillText(this.noteIcon(n) + '  ' + n.txt, 20, y);
      g.textAlign = 'right'; g.fillStyle = '#9ab0c0'; g.fillText(Math.max(0, Math.round(n.s - this.sProg)) + ' m', W - 20, y); g.textAlign = 'left';
      y += 36;
    });
    // stav auta
    const dm = this.netDmg(this.my);
    if (this.tabTex) this.tabTex.needsUpdate = true;
    g.fillStyle = '#9ab0c0'; g.font = 'bold 15px Arial'; g.fillText(`Motor ${Math.round(dm.engine)} % · předek ${Math.round(dm.front)} %${dm.off.some(o => o) ? ' · ⚠ CHYBÍ KOLO' : ''}`, 16, H - 16);
  },

  // ---------- cíl a výsledky ----------
  finish(dnf, why) {
    if (this.finished) return;
    const me = this.my, c = me.car;
    this.finished = true; this.finalT = this.clock + this.penalty;
    me.res = { dnf: !!dnf, time: dnf ? null : this.finalT, dmg: this.dmgCost(c.dmg), why, splits: this.splitsHit.slice() };
    if (this.opt.net) Net.send({ t: 'rfin', team: me.id, dnf: !!dnf, time: me.res.time, dmg: me.res.dmg, why });
    if (dnf) this.msg('DNF – ' + (why || 'konec'), 3, 'bad');
    else { this.msg(`CÍL! ${this.fmt(this.finalT)}`, 3, 'good'); this.say('Cíl! Výborně!', true); }
  },
  dmgCost(d) {
    const zones = (d.front + d.rear + d.left + d.right) / 4;
    return Math.round(zones * 14 + d.engine * 18 + d.wheel.reduce((a, b) => a + Math.min(100, b), 0) * 4 + d.off.filter(o => o).length * 400 + (d.lost || []).length * 300);
  },
  results() {
    const me = this.my, sv = this.sv, stage = this.cur.stage, tr = this.cur.tr, res = me.res;
    const ai = !!this.ais;
    const ranked = ai ? this.aiRanked() : this.teams.slice().sort((a, b) => (a.res.dnf ? 1 : 0) - (b.res.dnf ? 1 : 0) || (a.res.time || 1e9) - (b.res.time || 1e9));
    const multi = this.teams.length > 1, won = !res.dnf && ranked[0] === me;
    const medal = res.dnf ? 0 : this.medal(stage, res.time, tr.par);
    const pos = ai ? ranked.indexOf(me) + 1 : 0, posK = ai && !res.dnf ? [1.5, 1.3, 1.15][pos - 1] || 1 : 1;   // bonus za umístění v závodě s AI
    let money = 0, xp;
    if (!res.dnf) money = Math.round(stage.reward * [1, 1.1, 1.25, 1.5][medal] * (multi && won ? 1.25 : 1) * posK);
    xp = Math.round(stage.xp * (res.dnf ? 0.3 : [1, 1.1, 1.25, 1.5][medal]) * (multi && won ? 1.25 : 1) * posK);
    const coneOk = !res.dnf && this.cones >= RALLY_CONE_GOAL, coneBonus = coneOk ? 500 + stage.n * 90 : 0;
    if (coneOk) { money += coneBonus; xp += 60; }
    const clean = !res.dnf && (res.dmg || 0) < 40;
    if (clean) { money += Math.round(stage.reward * 0.15); xp += 20; }
    const repair = Math.round((res.dmg || 0) * (this.opt.net && me.co >= 0 ? 0.5 : 1));
    const before = sv.money;
    sv.money = Math.max(0, sv.money + money - repair);
    const net = sv.money - before;
    const ups = this.addXp(xp);
    let pbTxt = '';
    const advanced = !res.dnf && stage.n >= (sv.stage || 0);
    if (!res.dnf) sv.stage = Math.max(sv.stage || 0, stage.n + 1);
    if (!res.dnf && !ai) {   // v závodě s AI (hromadný start, provoz) se osobní rekordy ani žebříček nezapisují
      const pb = sv.best[stage.id];
      if (!pb || res.time < pb.t) { sv.best[stage.id] = { t: res.time, splits: res.splits, medal: Math.max(medal, pb ? pb.medal || 0 : 0) }; pbTxt = pb ? ` Nový osobní rekord (o ${(pb.t - res.time).toFixed(2)} s)!` : ' První čas na této etapě!'; }
      else { pb.medal = Math.max(pb.medal || 0, medal); pbTxt = ` Osobní rekord ${this.fmt(pb.t)}.`; }
      Account.rally(stage.id, res.time, me.crew).then(d => { if (d && d.record) Game.msg && Game.msg('🏆 Čas zapsán do rally žebříčku!', 'good'); });
      this.wr = null;
    }
    this.store();
    if (multi) Account.mp(won);
    const mName = ['bez medaile', 'bronz 🥉', 'stříbro 🥈', 'zlato 🥇'][medal];
    let txt = res.dnf ? `Nedojeli jste – ${res.why || 'DNF'}.` : `Čas ${this.fmt(res.time)} · ${mName} (zlato pod ${this.fmt(tr.par * 1.06)}).${pbTxt}`;
    if (multi) txt = (won ? 'Vaše posádka vyhrála! ' : res.dnf ? '' : 'Druhá posádka byla rychlejší. ') + txt;
    if (ai && !res.dnf) txt = `Dojel jsi ${pos}. z ${ranked.length}!${posK > 1 ? ` Bonus za umístění ×${posK}.` : ''} ` + txt;
    const rows = ranked.map((t, i) => ({ me: t.mine, col: t.col || RALLY_TEAM_COL[t.id % 2], cells: [(ai ? i + 1 + '. ' : '') + String(t.crew).replace(/[<>&]/g, ''), t.res.dnf ? (t.res.left ? 'odpojen' : 'DNF') : (t.res.est ? '~' : '') + this.fmt(t.res.time), t.res.dnf || !ranked[0].res.time ? '—' : '+' + (t.res.time - ranked[0].res.time).toFixed(2), t.res.dmg !== undefined ? t.res.dmg.toLocaleString('cs-CZ') + ' Kč' : '—'] }));
    let rew = `<div class="rwd"><span>💰 +${money.toLocaleString('cs-CZ')} Kč</span><span>🔧 oprava −${repair.toLocaleString('cs-CZ')} Kč</span><span>⭐ +${xp} XP</span></div>`;
    rew += `<div style="margin-top:4px;font-weight:700;color:${coneOk ? '#8fff9a' : '#ffb347'}">🔶 Zaklepat 20 kuželů: ${this.cones}/${RALLY_CONE_GOAL} – ${coneOk ? `splněno! +${coneBonus.toLocaleString('cs-CZ')} Kč, +60 XP` : res.dnf ? 'nedojeli jste' : `chybělo ${RALLY_CONE_GOAL - this.cones}, úkol nesplněn`}</div>`;
    rew += `<div style="opacity:.85;margin-top:4px">Celkem ${net >= 0 ? '+' : ''}${net.toLocaleString('cs-CZ')} Kč${clean ? ' · bonus za čistou jízdu' : ''}</div>`;
    for (const [l, b] of ups) rew += `<div class="lvlup">LEVEL ${l}! Bonus ${b.toLocaleString('cs-CZ')} Kč a nové díly v servisu</div>`;
    const btns = [];
    const nx = rallyStage(sv.stage || 0);
    if (advanced) rew += `<div class="lvlup">Odemčena etapa ${nx.name}${nx.name.includes(RALLY_BIOMES[nx.biome].name) ? '' : ' (' + RALLY_BIOMES[nx.biome].name.toLowerCase() + ')'} – zase o kus těžší!</div>`;
    if (this.opt.net) {
      if (Net.isHost) btns.push(res.dnf ? { label: '🔁 Znovu', fn: () => Net.start() } : { label: '🏁 Další etapa', fn: () => { Net.mode = 'rally:' + (sv.stage || 0) + (String(Net.mode).endsWith(':s') ? ':s' : ''); Net.setMode && Net.setMode(Net.mode); Net.start(); } });
      else rew += '<div style="opacity:.8;margin-top:6px">Hostitel může spustit další etapu.</div>';
    } else if (res.dnf) btns.push({ label: '🔁 Zkusit znovu', fn: () => this.startSolo(this.opt.idx, ai) });
    else {
      btns.push({ label: `🏁 Další etapa: ${nx.name}`, fn: () => { this.pick = null; this.startSolo(sv.stage || 0, ai); } });
      btns.push({ label: ai ? '🔁 Odvetu!' : '🔁 Jet znovu', alt: true, fn: () => this.startSolo(this.opt.idx, ai) });
    }
    btns.push({ label: '🔧 Do servisu', alt: true, fn: () => { this.exit(); this.enterGarage(); } });
    this.say(null);
    Game.showResults({ win: ai ? !res.dnf && pos <= 3 : !res.dnf && (!multi || won) && medal > 0, title: res.dnf ? 'NEDOJELI JSTE' : ai ? (pos === 1 ? 'VYHRÁL JSI!' : `${pos}. MÍSTO`) : multi ? (won ? 'VYHRÁLI JSTE!' : 'DRUZÍ') : medal ? 'V CÍLI!' : 'DOJELI JSTE', text: txt, cols: ['Posádka', 'Čas', 'Ztráta', 'Oprava'], rows, reward: rew, buttons: btns });
  },

  // ---------- síť ----------
  onNet(d) {
    if (!this.teams || this.mode !== 'stage' || !this.opt || !this.opt.net) { (this.pending = this.pending || []).push(d); return; }
    const t = this.teams.find(q => q.id === d.team); if (!t) return;
    if (d.t === 'rs') {
      if (t.car) return;
      if (!t.net) { t.pose.x = d.x; t.pose.z = d.z; t.pose.y = d.y; t.pose.h = d.h; }
      if (!t.sm) t.sm = new U.NetSmooth(['x', 'y', 'z', 'h', 'p', 'r'], ['h', 'p', 'r']);
      if (!t.sm.push(d)) return;
      t.net = d; if (t.mine && d.cn !== undefined) this.cones = d.cn; t.netDm = d.dm; t.netEng = d.dm[4]; t.netOff = d.off; t.netRep = d.rep;
    } else if (d.t === 'rcar') {
      if (t.car) return;
      this.cur.sc.remove(t.parts.root); for (const l of t.loose) this.cur.sc.remove(l.obj); t.loose = []; t.dmgVis = { off: [false, false, false, false] };
      t.look = d.look; t.parts = this.makeCar(d.look); this.cur.sc.add(t.parts.root);
      if (t.mine) { if (this.role === 'codriver') this.makeTablet(t.parts); const cm = this.camMode; this.setCam('chase'); this.setCam(cm); }
    } else if (d.t === 'rcall') { if (t.mine && this.role === 'driver') this.say(String(d.txt).slice(0, 80)); }
    else if (d.t === 'rhelp') { if (t.mine) this.remoteHelp = !!d.on; }
    else if (d.t === 'rpart') { if (!t.car) this.detachPart(t, String(d.name)); }
    else if (d.t === 'rhit') { if (!t.car) this.dent(t.parts, d.lx, 0.65, d.lz, d.nx, d.nz, d.dep); }
    else if (d.t === 'rfin') { if (!t.res) t.res = { dnf: d.dnf, time: d.time, dmg: d.dmg, why: d.why }; if (t.mine && this.role === 'codriver') { this.finished = true; this.msg(d.dnf ? 'DNF – ' + (d.why || '') : 'CÍL! ' + this.fmt(d.time), 3, d.dnf ? 'bad' : 'good'); } }
  },
  netLeft(slot) {
    if (!this.teams) return;
    for (const t of this.teams) {
      if (slot >= 0 && t.co === slot && t.mine && this.role === 'driver') { this.coLeft = true; this.msg('Spolujezdec se odpojil – hlásí AI', 3, 'warn'); continue; }
      if ((slot < 0 && !t.car) || t.driver === slot) if (!t.res) { t.res = { dnf: true, left: true }; if (!t.car) this.msg('Posádka se odpojila', 2, 'bad'); }
    }
  },
};
