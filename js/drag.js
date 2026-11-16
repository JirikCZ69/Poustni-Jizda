// drag.js – režim DRAG RACE: garáž s levely, penězi a šílenými díly, čtvrtmílová dráha, AI soupeři a závody v multiplayeru
const DRAG_LEN = 402.3, DRAG_GREEN = 3.6, LANE_W = 4.6;
const DRAG_CATS = [
  { id: 'engine', name: 'Motor', items: [
    { n: 'Felicie 1.3 MPI', d: '68 koní, poctivá škodovka', hp: 68, lay: 'i4', cyl: 4, red: 6200, kg: 0, lvl: 1, price: 0 },
    { n: 'Golf 1.8 16V', d: 'Točí se jak vrták', hp: 140, lay: 'i4', cyl: 4, red: 7200, kg: 10, lvl: 1, price: 900 },
    { n: 'Subaru 2.0 boxer', d: 'Bublá a táhne', hp: 230, lay: 'boxer', cyl: 4, red: 7300, kg: 20, lvl: 2, price: 2600 },
    { n: 'BMW 3.0 řadová šestka', d: 'Hladká jak hedvábí', hp: 340, lay: 'i6', cyl: 6, red: 7400, kg: 45, lvl: 4, price: 6500 },
    { n: 'Americký V8 6.2', d: 'Zvuk, ze kterého padají okna', hp: 540, lay: 'v8', cyl: 8, red: 6900, kg: 90, lvl: 6, price: 15000 },
    { n: 'V12 z italského supersportu', d: 'Dvanáct válců, nula rozumu', hp: 820, lay: 'v6', cyl: 12, red: 8600, kg: 120, lvl: 9, price: 32000 },
    { n: 'Dvojitý V12 (24 válců!)', d: 'Dva motory svařené za sebou', hp: 1650, lay: 'v8', cyl: 24, red: 8000, kg: 260, lvl: 13, price: 80000 },
    { n: 'Lodní diesel z trajektu', d: 'Váží jak tank, táhne jak trajekt', hp: 3300, lay: 'v8', cyl: 16, red: 4300, kg: 650, lvl: 18, price: 190000 },
  ] },
  { id: 'ind', name: 'Přeplňování', items: [
    { n: 'Bez přeplňování', mul: 1, lvl: 1, price: 0 },
    { n: 'Malé turbo', d: 'Pšššt!', mul: 1.3, lag: 0.8, ind: 1, lvl: 2, price: 1500 },
    { n: 'Kompresor', d: 'Táhne hned od volnoběhu a kvílí', mul: 1.35, ind: 2, blower: 1, lvl: 3, price: 3600 },
    { n: 'Twin turbo', d: 'Dvě turba, dvojnásobné pšššt', mul: 1.6, lag: 1.0, ind: 1, lvl: 5, price: 9500 },
    { n: 'Turbo z kamionu', d: 'Chvíli trvá, než se roztočí… pak trhá kola', mul: 2.0, lag: 1.8, ind: 1, lvl: 8, price: 24000 },
    { n: 'Dva kompresory z lokomotivy', d: 'Trčí z kapoty jak komíny', mul: 2.4, ind: 2, blower: 2, lvl: 12, price: 62000 },
  ] },
  { id: 'gb', name: 'Převodovka', items: [
    { n: '4stupňová z Felicie', d: 'Řazení jak v traktoru', gears: 4, shift: 0.5, lvl: 1, price: 0 },
    { n: '5stupňová sportovní', gears: 5, shift: 0.32, lvl: 2, price: 1200 },
    { n: '6stupňová sekvenční', gears: 6, shift: 0.16, lvl: 4, price: 5200 },
    { n: '8stupňová dvouspojková', gears: 8, shift: 0.07, lvl: 7, price: 17000 },
    { n: 'Převodovka z formule 1', d: 'Řadí rychleji, než mrkneš', gears: 8, shift: 0.02, lvl: 11, price: 48000 },
  ] },
  { id: 'tires', name: 'Pneumatiky', items: [
    { n: 'Ojeté zimní', d: 'Hlavně že jsou kulaté', mu: 0.85, lvl: 1, price: 0 },
    { n: 'Sportovní', mu: 1.05, lvl: 1, price: 700 },
    { n: 'Semi-slicky', mu: 1.3, slick: 0.3, lvl: 3, price: 3000 },
    { n: 'Drag slicky', mu: 1.7, slick: 0.8, lvl: 5, price: 8500 },
    { n: 'Slicky z dragsteru Top Fuel', mu: 2.3, slick: 1.2, lvl: 9, price: 27000 },
    { n: 'Pneumatiky namazané lepidlem', d: 'Drží na asfaltu jak přišroubované', mu: 3.2, slick: 1.4, lvl: 14, price: 72000 },
  ] },
  { id: 'nitro', name: 'Nitro', items: [
    { n: 'Bez nitra', hp: 0, dur: 0, lvl: 1, price: 0 },
    { n: 'Nitro +75 koní', hp: 75, dur: 4, lvl: 2, price: 1800 },
    { n: 'Nitro +200 koní', hp: 200, dur: 4, lvl: 4, price: 6000 },
    { n: 'Nitro +500 koní', hp: 500, dur: 4, lvl: 7, price: 19000 },
    { n: 'Nitro z ponorky', d: '+1500 koní na pět vteřin', hp: 1500, dur: 5, lvl: 12, price: 56000 },
    { n: 'Palivo z raketoplánu', d: '+4000 koní. Nedoporučujeme.', hp: 4000, dur: 4, lvl: 17, price: 155000 },
  ] },
  { id: 'weight', name: 'Odlehčení', items: [
    { n: 'Sériová karoserie', kg: 0, lvl: 1, price: 0 },
    { n: 'Vyhozené zadní sedačky', kg: -60, lvl: 1, price: 500 },
    { n: 'Karbonová kapota a dveře', kg: -140, lvl: 3, price: 4000 },
    { n: 'Vyvrtané úplně všechno', kg: -280, lvl: 6, price: 12500 },
    { n: 'Karoserie z alobalu', d: 'Hlavně nekýchat', kg: -420, lvl: 10, price: 42000 },
  ] },
  { id: 'jet', name: 'Proudový motor', items: [
    { n: 'Žádný', N: 0, lvl: 1, price: 0 },
    { n: 'Turbína ze sekačky na trávu', d: 'Tah 1,5 kN – nepotřebuje přilnavost', N: 1500, size: 0.55, lvl: 5, price: 10000 },
    { n: 'Turbína z Cessny', d: 'Tah 5 kN', N: 5000, size: 0.72, lvl: 8, price: 29000 },
    { n: 'Proudový motor ze stíhačky', d: 'Tah 16 kN a plamen jak z pekla', N: 16000, size: 0.95, lvl: 12, price: 92000 },
    { n: 'Turbína z dopravního letadla', d: 'Tah 40 kN. Vozík na turbínu není součástí balení.', N: 40000, size: 1.35, lvl: 16, price: 250000 },
  ] },
  { id: 'rocket', name: 'Raketa', items: [
    { n: 'Žádná', N: 0, dur: 0, lvl: 1, price: 0 },
    { n: 'Silvestrovské rakety', d: 'Tah 3 kN na 3 s (klávesa E)', N: 3000, dur: 3, size: 0.5, lvl: 4, price: 5000 },
    { n: 'Vojenský raketový motor', d: 'Tah 20 kN na 2,5 s', N: 20000, dur: 2.5, size: 0.8, lvl: 10, price: 66000 },
    { n: 'Booster z raketoplánu', d: 'Tah 90 kN na 2 s. Drž se.', N: 90000, dur: 2, size: 1.2, lvl: 15, price: 210000 },
  ] },
  { id: 'wbar', name: 'Wheelie bar', items: [
    { n: 'Bez wheelie baru', on: 0, lvl: 1, price: 0 },
    { n: 'Wheelie bar', d: 'Nedovolí autu postavit se na zadní kola', on: 1, lvl: 3, price: 2500 },
  ] },
  { id: 'chute', name: 'Padák', items: [
    { n: 'Bez padáku', on: 0, lvl: 1, price: 0 },
    { n: 'Brzdicí padák', d: 'Po cíli rychle zastavíš (a vypadá to cool)', on: 1, lvl: 4, price: 3000 },
  ] },
];
const DRAG_COSM = [['wing', 600], ['spoiler', 300], ['scoop', 400], ['stripes', 300], ['fenders', 500], ['exhaust', 500], ['rims_chrome', 400], ['rims_gold', 900], ['rims_black', 300]];
// sandbox: posuvníky na šílenosti
const SB_SLIDERS = [
  ['hp', 'Výkon motoru', '×', 0.5, 25, 0.5], ['kg', 'Zátěž navíc', 'kg', -700, 4000, 50], ['mu', 'Přilnavost pneumatik', '×', 0.3, 6, 0.1],
  ['g', 'Gravitace', '×', 0.15, 3, 0.05], ['jet', 'Proudový tah navíc', 'kN', 0, 600, 10], ['rocket', 'Raketa navíc', 'kN', 0, 2000, 25], ['nitro', 'Síla nitra', '×', 1, 15, 0.5],
];
const SB_DEF = { hp: 1, kg: 0, mu: 1, g: 1, jet: 0, rocket: 0, nitro: 1, inf: false, rinf: false };
const SB_PRESETS = [
  ['🔄 Původní', {}], ['🌙 Měsíc', { g: 0.17, hp: 3 }], ['🪐 Jupiter', { g: 2.5, hp: 6, mu: 2 }], ['🧈 Mýdlo', { mu: 0.3, hp: 4 }],
  ['🚀 Raketový šílenec', { rocket: 1500, rinf: true, mu: 3 }], ['✈ Letiště', { jet: 450, kg: 1500 }], ['💥 Všechno na max', { hp: 25, mu: 6, jet: 600, rocket: 2000, nitro: 15, inf: true, rinf: true }], ['🐌 Traktor', { hp: 0.5, kg: 4000 }],
];
const RIVALS = [
  { n: 'Děda Franta', car: 'Škoda 105 s kufrem plným brambor', hp: 46, kg: 980, mu: 0.85, gears: 4, shift: 0.6, red: 5600, lay: 'i4', cyl: 4, paint: 0x8a9a6a, rt: [0.42, 0.7], money: 250, xp: 50 },
  { n: 'Pepa z vesnice', car: 'Felicie s laděným výfukem', hp: 82, kg: 960, mu: 0.95, gears: 5, shift: 0.45, red: 6400, lay: 'i4', cyl: 4, paint: 0xd8c040, rt: [0.35, 0.55], money: 400, xp: 70 },
  { n: 'Kluci z benzínky', car: 'Golf GTI na spodku', hp: 185, kg: 1150, mu: 1.05, gears: 5, shift: 0.32, red: 7000, lay: 'i4', cyl: 4, paint: 0x2a2a2a, rt: [0.28, 0.48], money: 750, xp: 100 },
  { n: 'Lucka Rychlá', car: 'Subaru Impreza s turbem', hp: 290, ind: 1, indMul: 1.25, lag: 0.8, kg: 1250, mu: 1.3, gears: 6, shift: 0.22, red: 7300, lay: 'boxer', cyl: 4, paint: 0x2a4aa8, rt: [0.24, 0.42], money: 1400, xp: 150 },
  { n: 'Big Mike', car: 'Mustang s V8', hp: 520, kg: 1500, mu: 1.45, gears: 6, shift: 0.18, red: 6900, lay: 'v8', cyl: 8, paint: 0xd85a1a, rt: [0.22, 0.4], money: 2500, xp: 210, wing: 1 },
  { n: 'Pan Inženýr', car: 'Bavorák s twin turbem', hp: 480, ind: 1, indMul: 1.55, lag: 1, kg: 1450, mu: 1.7, gears: 8, shift: 0.08, red: 7400, lay: 'i6', cyl: 6, paint: 0xeeeeee, rt: [0.2, 0.36], money: 4200, xp: 290 },
  { n: 'Sestry Novákovy', car: 'Japonská raketa na slickách', hp: 820, ind: 1, indMul: 1.4, lag: 1, kg: 1400, mu: 2.1, gears: 8, shift: 0.06, red: 7800, lay: 'v6', cyl: 6, nitro: [300, 4], paint: 0xe04080, rt: [0.18, 0.32], money: 7000, xp: 400, wing: 1 },
  { n: 'Šílený Ota', car: 'Dragster s dvěma kompresory', hp: 1500, ind: 2, indMul: 1.6, blower: 2, kg: 1150, mu: 2.5, gears: 6, shift: 0.04, red: 7600, lay: 'v8', cyl: 8, wbar: 1, chute: 1, paint: 0x40c040, rt: [0.17, 0.3], money: 11000, xp: 520 },
  { n: 'Kapitán Raketa', car: 'Kombík s vojenskou raketou', hp: 1300, ind: 1, indMul: 1.6, lag: 1, kg: 1100, mu: 2.4, gears: 8, shift: 0.03, red: 8000, lay: 'v8', cyl: 8, rocket: [20000, 2.5, 0.8], wbar: 1, chute: 1, paint: 0xc0c0c0, rt: [0.15, 0.28], money: 17000, xp: 680 },
  { n: 'Baron Turbína', car: 'Auto s motorem ze stíhačky', hp: 1600, ind: 2, indMul: 1.8, kg: 1050, mu: 2.6, gears: 8, shift: 0.02, red: 8200, lay: 'v8', cyl: 12, jet: [16000, 0.95], nitro: [500, 4], wbar: 1, chute: 1, paint: 0x1a1a1a, rt: [0.14, 0.26], money: 28000, xp: 850 },
  { n: 'Pouštní duch', car: 'Nikdo neví, co má pod kapotou', hp: 3300, ind: 2, indMul: 2.4, blower: 2, kg: 950, mu: 2.9, gears: 8, shift: 0.02, red: 8000, lay: 'v8', cyl: 24, jet: [40000, 1.35], rocket: [60000, 2, 1.2], nitro: [4000, 4], wbar: 1, chute: 1, paint: 0xf4efe2, rt: [0.12, 0.22], money: 65000, xp: 1600, wing: 1 },
];

// ---------- fyzika jednoho auta na dráze (1D: zrychlení, prokluz, wheelie, turbo, nitro, tah) ----------
class DragCar {
  constructor(s) { this.s = s; this.reset(); }
  reset() {
    Object.assign(this, { x: 0, v: 0, ws: 0, rpm: 900, gear: 0, launched: false, shiftT: 0, clutchT: 0, boost: 0, jet: 0, wh: 0, spin: false, acc: 0,
      finished: false, done: false, foul: false, t: 0, launchT: null, finishT: null, trap: 0, rt: null, chuteOut: false, nitroOn: false, rocketOn: false,
      thr: 0, limiter: false, nitroLeft: this.s.nitroDur, rocketT: -1, auto: false, autoAt: 0.95, autoSlow: 1.3, launchRpm: 900, lastQ: null, dnf: false });
  }
  launch(green) {
    if (this.launched) return;
    this.launched = true; this.gear = 1; this.clutchT = 0.5; this.launchRpm = this.rpm; this.launchT = this.t;
    this.rt = this.t - green; this.foul = this.rt < 0;
  }
  shiftUp() {
    const n = this.s.ratios.length;
    if (!this.launched || this.finished || this.gear >= n || this.shiftT > 0) return null;
    const q = this.rpm / this.s.red;
    this.gear++; this.shiftT = this.s.shift * (this.auto ? this.autoSlow : 1); this.lastQ = q;
    return q;
  }
  shiftDown() { if (this.launched && this.gear > 1 && this.shiftT <= 0) { this.gear--; this.shiftT = this.s.shift; } }
  step(h, inp) {
    const s = this.s, g = s.g || 9.81, m = s.mass;
    this.t += h;
    const thr = this.finished ? 0 : inp.thr;
    this.thr = thr;
    const r0 = this.rpm / s.red;
    const bt = s.ind === 1 ? thr * U.smooth(0.3, 0.75, r0) : s.ind === 2 ? thr * (0.55 + 0.45 * r0) : 0;
    this.boost += (bt - this.boost) * Math.min(1, h * (s.ind === 1 ? (bt > this.boost ? 1 / Math.max(0.25, s.lag) : 5) : 12));
    this.nitroOn = !!inp.nitro && this.nitroLeft > 0 && this.launched && !this.finished && s.nitroHP > 0 && thr > 0;
    if (this.nitroOn) this.nitroLeft -= h;
    const P = (s.hp * (1 + (s.indMul - 1) * this.boost) + (this.nitroOn ? s.nitroHP : 0)) * 745.7;
    this.jet += ((s.jetN && thr > 0 && !this.finished ? 1 : 0) - this.jet) * Math.min(1, h * 0.8);
    let Fext = this.launched ? s.jetN * this.jet : 0;
    if (inp.rocket && this.rocketT < 0 && s.rocketN && this.launched && !this.finished) this.rocketT = 0;
    this.rocketOn = this.rocketT >= 0 && this.rocketT < s.rocketDur;
    if (this.rocketOn) { this.rocketT += h; Fext += s.rocketN; }
    if (!this.launched) {   // stojí na startu, motor se dá vytočit
      const tgt = 900 + thr * (s.red * 1.03 - 900);
      this.rpm += (tgt - this.rpm) * Math.min(1, h * (thr > 0 ? 6 : 3));
      this.limiter = this.rpm >= s.red; if (this.limiter) this.rpm = s.red - Math.random() * 180;
      if (this.t > DRAG_GREEN + 25 && !this.dnf) this.dnf = true;
      return;
    }
    const n = s.ratios.length;
    if (this.auto && !this.finished && this.shiftT <= 0 && this.clutchT <= 0 && this.gear < n && this.rpm / s.red >= this.autoAt) this.shiftUp();
    const ratio = s.ratios[this.gear - 1] * s.fin;
    const wheelRpm = this.ws / WR * ratio * 30 / Math.PI;
    if (this.shiftT > 0) { this.shiftT -= h; this.rpm += (Math.max(wheelRpm, 900) - this.rpm) * Math.min(1, h * 14); }
    else if (this.clutchT > 0) { const k = this.clutchT / 0.5; this.rpm = Math.max(wheelRpm, this.launchRpm * k + wheelRpm * (1 - k), 900); this.clutchT -= h; }
    else this.rpm = Math.max(wheelRpm, 900);
    this.limiter = this.rpm >= s.red;
    if (this.limiter) this.rpm = s.red;
    let Fd = 0;
    if (this.shiftT <= 0 && !this.limiter && !this.finished) {
      const r = this.rpm / s.red, f = U.clamp(1 - Math.pow((r - 0.85) / 0.85, 2), 0.18, 1);
      const T = P * f / (Math.max(this.rpm, 1300) * Math.PI / 30);
      Fd = thr * T * ratio * 0.9 / WR;
    }
    // přilnavost zadních kol roste s přenosem hmotnosti dozadu
    const tr = m * this.acc * 0.5 / 2.6;
    const Nr = U.clamp(m * g * 0.48 + tr, m * g * 0.3, m * g), Fmax = s.mu * Nr;
    let Ft;
    if (this.spin) { Ft = Fmax * 0.75; this.ws += (Fd - Ft) / 70 * h; if (this.ws <= this.v) { this.ws = this.v; this.spin = false; } }
    else if (Fd > Fmax) { this.spin = true; Ft = Fmax * 0.75; this.ws = this.v + 0.05; }
    else Ft = Fd;
    this.ws = Math.min(this.ws, this.v + 35);
    // wheelie: když přenos hmotnosti přeroste zatížení předku, auto se zvedne
    const lift = (tr - m * g * 0.52) / (m * g);
    let whT = lift > 0 ? Math.min(0.75, lift * 2.2) : 0;
    if (s.wbar) whT = Math.min(whT, 0.05);
    this.wh += (whT - this.wh) * Math.min(1, h * (whT > this.wh ? 3 : 5));
    if (this.wh > 0.25) Ft *= 0.8;
    let Fb = 0;
    if (this.finished) Fb = Math.min(this.v * m / h, m * 9.81 * 0.65 + (this.chuteOut ? 1.6 * this.v * this.v : 0));
    const Fdrag = 0.45 * this.v * this.v + (this.v > 0.1 ? 0.012 * m * g : 0);
    const a = (Ft + Fext - Fdrag - Fb) / m;
    this.acc += (a - this.acc) * Math.min(1, h * 10);
    this.v = Math.max(0, this.v + a * h);
    if (!this.spin) this.ws = this.v;
    this.x += this.v * h;
    if (!this.finished && this.x >= DRAG_LEN) { this.finished = true; this.finishT = this.t; this.trap = this.v; if (s.chute) this.chuteOut = true; }
    if (this.finished && this.v < 0.3) this.done = true;
    if (!this.finished && this.t > DRAG_GREEN + 30) { this.dnf = true; }
  }
}

const Drag = {
  active: false, mode: null, tab: 'engine',
  // ---------- uložený profil ----------
  load() {
    this.loadSb();
    const d = U.store.get('pj_drag', null) || {};
    this.sv = Object.assign({ money: 1500, xp: 0, lvl: 1, own: {}, eq: {}, paint: 0xc8302a, cosm: {}, cosmOwn: [], auto: true, beaten: 0, wins: 0, races: 0 }, d);
    for (const c of DRAG_CATS) { if (!this.sv.own[c.id]) this.sv.own[c.id] = [0]; if (this.sv.eq[c.id] === undefined) this.sv.eq[c.id] = 0; }
  },
  store() { U.store.set('pj_drag', this.sv); U.store.set('pj_dragsb', this.sbv); },
  loadSb() {
    const d = U.store.get('pj_dragsb', null) || {};
    this.sbv = Object.assign({ eq: {}, paint: 0x3a8ae0, cosm: {}, auto: true }, d);
    this.sbv.mul = Object.assign({}, SB_DEF, d.mul || {});
    for (const c of DRAG_CATS) if (this.sbv.eq[c.id] === undefined) this.sbv.eq[c.id] = c.items.length - 1;
  },
  P() { return this.sb ? this.sbv : this.sv; },
  // stavba auta v sandboxu: díly + posuvníky
  sbBuild() {
    const P = this.sbv, m = P.mul, b = this.eqBuild(P);
    b.engine = Object.assign({}, b.engine, { hp: b.engine.hp * m.hp });
    b.weight = { kg: (b.weight.kg || 0) + m.kg };
    b.tires = Object.assign({}, b.tires, { mu: b.tires.mu * m.mu, slick: b.tires.slick || (m.mu > 1.6 ? 1 : 0) });
    b.nitro = Object.assign({}, b.nitro);
    if (b.nitro.hp || m.inf) { b.nitro.hp = (b.nitro.hp || 200) * m.nitro; b.nitro.dur = m.inf ? 9999 : b.nitro.dur; }
    b.jet = Object.assign({}, b.jet, { N: (b.jet.N || 0) + m.jet * 1000, size: b.jet.size || (m.jet ? Math.min(2.2, 0.8 + m.jet / 300) : 0) });
    b.rocket = Object.assign({}, b.rocket, { N: (b.rocket.N || 0) + m.rocket * 1000, dur: m.rinf ? 9999 : (b.rocket.dur || 4), size: b.rocket.size || (m.rocket ? Math.min(2, 0.8 + m.rocket / 1000) : 0) });
    const st = this.stats(b, 250); st.g = 9.81 * m.g;
    return { b, st };
  },
  xpNeed(l) { return Math.round(120 * Math.pow(l, 1.45)); },
  addXp(n) {
    const sv = this.sv, ups = [];
    sv.xp += n;
    while (sv.xp >= this.xpNeed(sv.lvl)) { sv.xp -= this.xpNeed(sv.lvl); sv.lvl++; const bonus = 300 * sv.lvl; sv.money += bonus; ups.push([sv.lvl, bonus]); }
    return ups;
  },
  eqBuild(sv) {
    const b = {}; for (const c of DRAG_CATS) b[c.id] = c.items[sv.eq[c.id]] || c.items[0];
    return b;
  },
  rivalBuild(r) {
    return { engine: { hp: r.hp, red: r.red, kg: 0, lay: r.lay, cyl: r.cyl }, ind: { mul: r.indMul || 1, ind: r.ind || 0, lag: r.lag || 0, blower: r.blower || 0 },
      gb: { gears: r.gears, shift: r.shift }, tires: { mu: r.mu, slick: r.mu > 1.4 ? 1 : 0 }, nitro: { hp: r.nitro ? r.nitro[0] : 0, dur: r.nitro ? r.nitro[1] : 0 },
      weight: { kg: r.kg - 1100 }, jet: { N: r.jet ? r.jet[0] : 0, size: r.jet ? r.jet[1] : 0 }, rocket: { N: r.rocket ? r.rocket[0] : 0, dur: r.rocket ? r.rocket[1] : 0, size: r.rocket ? r.rocket[2] : 0 },
      wbar: { on: r.wbar || 0 }, chute: { on: r.chute || 0 } };
  },
  stats(b, minMass) {
    const e = b.engine, n = b.gb.gears;
    const mass = Math.max(minMass || 650, 1100 + (e.kg || 0) + (b.weight.kg || 0) + (b.jet.N ? 140 * b.jet.size : 0) + (b.rocket.N ? 90 * b.rocket.size : 0) + (b.nitro.hp ? 25 : 0));
    const r1 = 3.3, rn = 0.8, k = Math.pow(rn / r1, 1 / (n - 1)), ratios = [];
    for (let i = 0; i < n; i++) ratios.push(r1 * Math.pow(k, i));
    const P = e.hp * (b.ind.mul || 1) * 745.7 * 0.88, vtop = Math.min(135, Math.cbrt(2 * P / (1.2 * 0.75)) * 1.03);
    const fin = (e.red * Math.PI / 30 * WR) / (vtop * ratios[n - 1]);
    return { hp: e.hp, red: e.red, mass, mu: b.tires.mu, ratios, fin, shift: b.gb.shift, ind: b.ind.ind || 0, indMul: b.ind.mul || 1, lag: b.ind.lag || 0,
      nitroHP: b.nitro.hp || 0, nitroDur: b.nitro.dur || 0, jetN: b.jet.N || 0, rocketN: b.rocket.N || 0, rocketDur: b.rocket.dur || 0,
      wbar: !!b.wbar.on, chute: !!b.chute.on, lay: e.lay, cyl: e.cyl, vtop };
  },
  vis(b) { return { jet: b.jet.N ? b.jet.size : 0, rocket: b.rocket.N ? b.rocket.size : 0, slick: b.tires.slick || 0, wbar: b.wbar.on ? 1 : 0, chute: b.chute.on ? 1 : 0, blower: b.ind.blower || 0, turbo: b.ind.ind === 1 ? 1 : 0 }; },
  // odhad času na čtvrt míle (simulace s ideálním řidičem)
  estimate(s) {
    let best = null;
    for (const lr of [0.35, 0.5, 0.65, 0.8]) {
      const c = new DragCar(s); c.auto = true; c.autoSlow = 1; c.autoAt = 0.96;
      const h = 1 / 120; let guard = 0;
      while (c.t < DRAG_GREEN - 0.01) c.step(h, { thr: lr });
      c.launch(DRAG_GREEN);
      while (!c.finished && guard++ < 6000) c.step(h, { thr: 1, nitro: true, rocket: c.t > DRAG_GREEN + 0.4 });
      if (c.finished && (!best || c.finishT < best.t)) best = { t: c.finishT, et: c.finishT - DRAG_GREEN, trap: c.trap * 3.6, lr };
    }
    return best || { et: 99, trap: 0, lr: 0.5 };
  },

  // ---------- garáž ----------
  enterGarage() {
    this.load(); this.active = true; this.mode = 'garage';
    Sfx.init();
    $('menu').style.display = 'none'; $('race').style.display = 'none'; $('dragHud').style.display = 'none';
    $('garage').style.display = 'block';
    if (!this.gScene) this.buildGarage();
    this.refreshCar(); this.renderGarage();
    Sfx.engine({ rpm: 0, throttle: 0, running: false, speed: 0, slip: 0, wspin: 0, lock: 0, onRoad: true, inCar: false, dist: 99, lay: 'i4', cyl: 4 }); Sfx.thrust({});
  },
  exit() {
    if (!this.active) return;
    this.active = false; this.mode = null;
    $('garage').style.display = 'none'; $('dragHud').style.display = 'none'; $('rivals').style.display = 'none';
    Sfx.thrust({}); Sfx.engine({ rpm: 0, throttle: 0, running: false, speed: 0, slip: 0, wspin: 0, lock: 0, onRoad: true, inCar: false, dist: 99, lay: 'i4', cyl: 4 });
  },
  toMenu() { this.exit(); $('menu').style.display = 'flex'; },
  buildGarage() {
    const sc = this.gScene = new THREE.Scene();
    sc.background = new THREE.Color(0x15110e);
    sc.add(new THREE.HemisphereLight(0xfff0e0, 0x3a3028, 0.55));
    const key = new THREE.SpotLight(0xffe8c8, 1.3, 40, 0.7, 0.5, 1); key.position.set(4, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); sc.add(key); sc.add(key.target);
    const rim = new THREE.PointLight(0xff6a30, 0.9, 18); rim.position.set(-5, 3, -4); sc.add(rim);
    const neon = new THREE.PointLight(0x40c8ff, 0.7, 16); neon.position.set(5, 3, -5); sc.add(neon);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: 0x5a5650, map: Tex.get('floor') }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
    const tt = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 0.18, 40), U.mat(0x2a2624)); tt.position.y = 0.09; tt.receiveShadow = true; sc.add(tt);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.04, 6, 60), new THREE.MeshBasicMaterial({ color: 0xff8a2a })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.19; sc.add(ring);
    for (const [x, c] of [[-6, 0xff6a30], [6, 0x40c8ff]]) { const n = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 9), new THREE.MeshBasicMaterial({ color: c })); n.position.set(x, 5.2, -4); sc.add(n); }
    this.gDecor = GarageDecor.build(sc);
    this.gTurn = new THREE.Group(); this.gTurn.position.y = 0.18; sc.add(this.gTurn);
    this.gCam = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
    this.gYaw = 0.7; this.gPitch = 0.22; this.gDist = 9;
    const cv = Game.renderer.domElement;
    cv.addEventListener('pointerdown', (e) => { if (this.mode === 'garage') { this._drag = [e.clientX, e.clientY]; } });
    addEventListener('pointerup', () => { this._drag = null; });
    addEventListener('pointermove', (e) => {
      if (this.mode !== 'garage' || !this._drag) return;
      this.gYaw -= (e.clientX - this._drag[0]) * 0.008; this.gPitch = U.clamp(this.gPitch + (e.clientY - this._drag[1]) * 0.004, 0.02, 0.9);
      this._drag = [e.clientX, e.clientY]; this.gIdle = 0;
    });
    cv.addEventListener('wheel', (e) => { if (this.mode === 'garage') this.gDist = U.clamp(this.gDist + e.deltaY * 0.005, 5.5, 11); }, { passive: true });
  },
  refreshCar() {
    if (this.gParts) { this.gTurn.remove(this.gParts.root); this.dispose(this.gParts); }
    const P = this.P(), sbb = this.sb ? this.sbBuild() : null, b = sbb ? sbb.b : this.eqBuild(P);
    this.gParts = this.makeCarModel(P.paint, P.cosm, Object.assign(this.vis(b), { body: this.sb ? null : Dealer.sel() }));
    this.gTurn.add(this.gParts.root);
    this.gStats = sbb ? sbb.st : this.stats(b); this.gEst = this.estimate(this.gStats);
  },
  makeCarModel(paint, cosm, vis) {
    const p = CarModel.build(paint, vis && vis.body);
    p.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    let rim = null;
    for (const [slot, kind] of Object.entries(cosm || {})) { if (!kind || !COSM[kind]) continue; CarModel.applyCosm(p, slot, kind, { col: 0xf0f0f0 }); if (COSM[kind].rim) rim = COSM[kind].rim; }
    p.wheels.forEach(w => w.rimMat.color.setHex(rim || 0x9a9a92));
    this.addMods(p, vis || {});
    return p;
  },
  dispose(p) { for (const m of p.mirrors || []) m.rt.dispose(); },
  // vizuální úpravy: proudový motor, raketa, slicky, wheelie bar, padák, kompresory, plameny
  addMods(p, v) {
    const g = new THREE.Group(); p.root.add(g); p.mods = g;
    const metal = U.mat(0xb8bcc0), dark = U.mat(0x222222), add = (geo, m, x, y, z, rx, ry, rz, par) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, rz || 0); o.castShadow = true; (par || g).add(o); return o; };
    const flame = (r, len, col) => {
      const geo = new THREE.ConeGeometry(r, len, 12, 1, true); geo.translate(0, -len / 2, 0); geo.rotateX(Math.PI / 2);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.y = Math.PI; m.visible = false; g.add(m); return m;
    };
    p.flames = [];
    if (v.jet) {
      const s = v.jet, y = 1.62 + s * 0.42, z = -0.7;
      add(new THREE.CylinderGeometry(0.36 * s, 0.3 * s, 2.3 * s, 18), metal, 0, y, z, Math.PI / 2);
      add(new THREE.TorusGeometry(0.36 * s, 0.05 * s, 6, 18), dark, 0, y, z + 1.15 * s);
      add(new THREE.CircleGeometry(0.33 * s, 18), U.mat(0x3a3a40), 0, y, z + 1.12 * s);
      add(new THREE.CylinderGeometry(0.22 * s, 0.28 * s, 0.5 * s, 14, 1, true), dark, 0, y, z - 1.35 * s, Math.PI / 2);
      for (const sx of [-0.35, 0.35]) add(new THREE.BoxGeometry(0.06, 0.45 * s, 0.6), dark, sx * s, y - 0.32 * s, z);
      p.jetFlame = flame(0.24 * s, 3.2 * s, 0xff8a3a); p.jetFlame.position.set(0, y, z - 1.6 * s);
      p.jetCore = flame(0.12 * s, 2 * s, 0xa8d8ff); p.jetCore.position.copy(p.jetFlame.position);
    }
    if (v.rocket) {
      const s = v.rocket, y = 1.08, z = -1.7;
      add(new THREE.CylinderGeometry(0.17 * s, 0.17 * s, 1.5 * s, 14), U.mat(0xe8e2d8), 0, y, z, Math.PI / 2);
      add(new THREE.ConeGeometry(0.17 * s, 0.4 * s, 14), U.mat(0xc02a1a), 0, y, z + 0.95 * s, Math.PI / 2);
      add(new THREE.CylinderGeometry(0.13 * s, 0.24 * s, 0.35 * s, 14, 1, true), dark, 0, y, z - 0.9 * s, Math.PI / 2);
      for (const a of [0, 2.1, 4.2]) add(new THREE.BoxGeometry(0.02, 0.3 * s, 0.4 * s), U.mat(0xc02a1a), Math.sin(a) * 0.2 * s, y + Math.cos(a) * 0.2 * s, z - 0.5 * s, 0, 0, -a);
      p.rocketFlame = flame(0.3 * s, 5 * s, 0xffb040); p.rocketFlame.position.set(0, y, z - 1.1 * s);
      p.rocketCore = flame(0.14 * s, 3 * s, 0xffffff); p.rocketCore.position.copy(p.rocketFlame.position);
    }
    if (v.slick) for (const i of [2, 3]) p.wheels[i].spin.scale.set(1 + v.slick * 0.55, 1 + v.slick * 0.1, 1 + v.slick * 0.1);
    if (v.wbar) {
      for (const sx of [-0.35, 0.35]) { add(new THREE.BoxGeometry(0.05, 0.05, 1.3), metal, sx, 0.34, -2.75, 0.08); add(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), dark, sx, 0.13, -3.38, 0, 0, Math.PI / 2); }
      add(new THREE.BoxGeometry(0.75, 0.04, 0.04), metal, 0, 0.3, -3.3);
    }
    if (v.chute) {
      add(new THREE.BoxGeometry(0.4, 0.28, 0.25), U.mat(0x1a1a1a), 0, 0.92, -2.25);
      const c = new THREE.Group(); g.add(c); c.visible = false; p.chute = c;
      const can = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      can.rotation.x = Math.PI / 2; can.position.z = -7.5; c.add(can);
      const stripe = new THREE.Mesh(new THREE.SphereGeometry(1.52, 14, 6, 0, Math.PI * 2, 0.5, 0.35), new THREE.MeshLambertMaterial({ color: 0xd02a1a, side: THREE.DoubleSide }));
      stripe.rotation.x = Math.PI / 2; stripe.position.z = -7.5; c.add(stripe);
      for (const a of [0, 1.57, 3.14, 4.71]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 5.4), dark); l.position.set(Math.cos(a) * 0.65, 0.9 + Math.sin(a) * 0.65, -4.9); l.lookAt(0, 0.92, -2.3); c.add(l); }
      c.position.y = 0.0;
    }
    if (v.blower) {
      for (let i = 0; i < v.blower; i++) {
        const x = v.blower === 2 ? (i ? 0.38 : -0.38) : 0;
        add(new THREE.BoxGeometry(0.42, 0.28, 0.6), metal, x, 0.16, 0.6, 0, 0, 0, p.hood);
        add(new THREE.BoxGeometry(0.36, 0.22, 0.32), U.mat(0xd0b040), x, 0.4, 0.62, 0, 0, 0, p.hood);
        for (let k = 0; k < 4; k++) add(new THREE.BoxGeometry(0.43, 0.02, 0.04), dark, x, 0.16, 0.36 + k * 0.16, 0, 0, 0, p.hood);
      }
    }
    if (v.turbo) add(new THREE.TorusGeometry(0.1, 0.05, 6, 12), metal, 0.62, 1.0, 1.75, 0, Math.PI / 2);
    // plameny z výfuků (řazení, nitro)
    for (const sx of [-0.45, 0.45]) { const f = flame(0.07, 0.7, 0x5ab0ff); f.position.set(sx, 0.32, -2.2); p.flames.push(f); }
    return g;
  },

  renderGarage() {
    const sv = this.sv, st = this.gStats, est = this.gEst, need = this.xpNeed(sv.lvl), sb = this.sb, P = this.P();
    const esc = (t) => String(t).replace(/[<>&]/g, '');
    $('garage').classList.toggle('sb', !!sb);
    $('gSb').textContent = sb ? '🔧 KARIÉRA' : '🧪 SANDBOX';
    if (sb && this.tab !== 'crazy' && this.tab !== 'look' && !DRAG_CATS.some(c => c.id === this.tab)) this.tab = 'crazy';
    if (!sb && this.tab === 'crazy') this.tab = 'engine';
    if (sb) $('gProfile').innerHTML = `<div class="gLvl">🧪</div><div><b>SANDBOX</b> · všechno odemčené a zadarmo<div style="font-size:13px;opacity:.85;margin-top:3px">Závody tu nedávají peníze ani XP – jen sranda. Hraj s kámošema přes 👥.</div></div>`;
    else $('gProfile').innerHTML = `<div class="gLvl">${sv.lvl}</div><div><b>${esc(Game.nick())}</b> · level ${sv.lvl}<div class="gXp"><i style="width:${Math.min(100, sv.xp / need * 100)}%"></i></div><span>${sv.xp} / ${need} XP · výher ${sv.wins} z ${sv.races}</span></div>`;
    $('gMoney').innerHTML = sb ? '💰 <b>∞ Kč</b>' : `💰 <b>${sv.money.toLocaleString('cs-CZ')} Kč</b>`;
    const pw = st.hp * st.indMul / st.mass * 1000;
    const bar = (v, max) => `<span class="gBar"><i style="width:${U.clamp(v / max, 0, 1) * 100}%"></i></span>`;
    let h = '<h3>Tvoje drag auto</h3>';
    h += `<div class="gRow">Výkon ${bar(st.hp * st.indMul, 4000)} <b>${Math.round(st.hp * st.indMul)} k</b></div>`;
    if (sb && st.g !== 9.81) h += `<div class="gRow">Gravitace <b>${(st.g / 9.81).toFixed(2)} g</b></div>`;
    h += `<div class="gRow">Hmotnost ${bar(1700 - st.mass, 1100)} <b>${Math.round(st.mass)} kg</b></div>`;
    h += `<div class="gRow">Koně na tunu ${bar(pw, 3000)} <b>${Math.round(pw)}</b></div>`;
    h += `<div class="gRow">Přilnavost ${bar(st.mu, 3.2)} <b>${st.mu.toFixed(2)}</b></div>`;
    h += `<div class="gRow">Převodovka <b>${st.ratios.length} st. · ${Math.round(st.shift * 1000)} ms</b></div>`;
    if (st.nitroHP) h += `<div class="gRow">Nitro <b>+${st.nitroHP} k / ${st.nitroDur} s</b></div>`;
    if (st.jetN) h += `<div class="gRow">Proudový tah <b>${(st.jetN / 1000).toFixed(1)} kN</b></div>`;
    if (st.rocketN) h += `<div class="gRow">Raketa <b>${(st.rocketN / 1000).toFixed(0)} kN / ${st.rocketDur} s</b></div>`;
    h += `<div class="gEst">Odhad na čtvrt míle: <b>${est.et.toFixed(2)} s</b> · ${Math.round(est.trap)} km/h<br><span>ideální start při ${Math.round(est.lr * 100)} % otáček</span></div>`;
    h += `<label class="gAuto"><input type="checkbox" id="gAutoCb" ${P.auto ? 'checked' : ''}> Automatické řazení (pomalejší řazení, jednodušší)</label>`;
    $('gStats').innerHTML = h;
    $('gTabs').innerHTML = (sb ? `<button class="gTab crazy${this.tab === 'crazy' ? ' on' : ''}" data-gtab="crazy">🧪 Šílenosti</button>` : '') + DRAG_CATS.map(c => `<button class="gTab${this.tab === c.id ? ' on' : ''}" data-gtab="${c.id}">${c.name}</button>`).join('') + `<button class="gTab${this.tab === 'look' ? ' on' : ''}" data-gtab="look">Vzhled</button>`;
    let l = '';
    if (this.tab === 'crazy') {
      const m = P.mul;
      l += '<h3>Rychlé předvolby</h3><div class="sbPre">' + SB_PRESETS.map(([n], i) => `<button data-sbpre="${i}">${n}</button>`).join('') + '</div><h3>Posuvníky</h3>';
      for (const [k, n, u, mn, mx, stp] of SB_SLIDERS) {
        l += `<div class="sbRow"><span>${n}</span><input type="range" data-sb="${k}" min="${mn}" max="${mx}" step="${stp}" value="${m[k]}"><b id="sbv_${k}">${this.sbTxt(k, m[k])}</b></div>`;
      }
      l += `<label class="gAuto"><input type="checkbox" data-sbc="inf" ${m.inf ? 'checked' : ''}> Nekonečné nitro (i bez nitro dílu)</label>`;
      l += `<label class="gAuto"><input type="checkbox" data-sbc="rinf" ${m.rinf ? 'checked' : ''}> Raketa hoří až do cíle</label>`;
      l += '<div style="opacity:.7;font-size:12px;margin-top:6px">Díly v ostatních záložkách jsou zdarma. Posuvníky se násobí s namontovanými díly.</div>';
    } else if (this.tab === 'look') {
      l += '<h3>Barva (zdarma)</h3><div class="gPaint">' + SPRAYS.map(([n, c]) => `<button title="${n}" data-gpaint="${c}" style="background:#${c.toString(16).padStart(6, '0')}" class="${P.paint === c ? 'on' : ''}"></button>`).join('') + '</div><h3>Doplňky</h3>';
      for (const [k, price] of DRAG_COSM) {
        const own = sb || sv.cosmOwn.includes(k), slot = COSM[k].slot, on = P.cosm[slot] === k;
        l += `<div class="gItem${on ? ' eq' : ''}"><div><b>${COSM[k].name}</b></div>${own ? `<button data-gcosm="${k}">${on ? 'Sundat' : 'Nasadit'}</button>` : `<button data-gcbuy="${k}" ${sv.money < price ? 'disabled' : ''}>Koupit ${price} Kč</button>`}</div>`;
      }
    } else {
      const cat = DRAG_CATS.find(c => c.id === this.tab), own = sv.own[cat.id];
      cat.items.forEach((it, i) => {
        const has = sb || own.includes(i), eq = P.eq[cat.id] === i, locked = !sb && sv.lvl < it.lvl;
        let btn;
        if (eq) btn = '<span class="gOk">✔ namontováno</span>';
        else if (has) btn = `<button data-geq="${i}">Namontovat</button>`;
        else if (locked) btn = `<span class="gLock">🔒 level ${it.lvl}</span>`;
        else btn = `<button data-gbuy="${i}" ${sv.money < it.price ? 'disabled' : ''}>Koupit ${it.price.toLocaleString('cs-CZ')} Kč</button>`;
        const info = cat.id === 'engine' ? `${it.hp} koní · ${it.cyl} válců` : cat.id === 'ind' ? (it.mul > 1 ? `+${Math.round((it.mul - 1) * 100)} % výkonu` : '') : cat.id === 'gb' ? `${it.gears} stupňů · řazení ${Math.round(it.shift * 1000)} ms` : cat.id === 'tires' ? `přilnavost ${it.mu}` : cat.id === 'weight' ? (it.kg ? `${it.kg} kg` : '') : '';
        l += `<div class="gItem${eq ? ' eq' : ''}${locked && !has ? ' lock' : ''}"><div><b>${it.n}</b>${info ? `<span>${info}</span>` : ''}${it.d ? `<i>${it.d}</i>` : ''}</div>${btn}</div>`;
      });
    }
    $('gList').innerHTML = l;
    GarageDecor.drawTv(sb ? ['SANDBOX – bez limitů', `Výkon ${Math.round(st.hp * st.indMul)} k · ${Math.round(st.mass)} kg`, `Odhad: ${est.et.toFixed(2)} s`, `Max: ${Math.round(est.trap)} km/h`]
      : [`${Game.nick()} · level ${sv.lvl}`, `Výkon ${Math.round(st.hp * st.indMul)} k · ${Math.round(st.mass)} kg`, `Odhad 1/4 míle: ${est.et.toFixed(2)} s`, `Výhry ${sv.wins} z ${sv.races} · ${sv.money.toLocaleString('cs-CZ')} Kč`], this.gDecor);
    const nx = RIVALS[Math.min(sv.beaten, RIVALS.length - 1)];
    $('gRace').innerHTML = sb ? '🏁 ZÁVOD PROTI AI<br><span style="font-size:13px;font-weight:600">kdokoliv, bez odměn</span>' : `🏁 ZÁVOD PROTI AI<br><span style="font-size:13px;font-weight:600">další: ${nx.n}</span>`;
  },
  sbTxt(k, v) {
    const u = SB_SLIDERS.find(x => x[0] === k)[2];
    return u === '×' ? `${+(+v).toFixed(2)}×` : `${v > 0 && k === 'kg' ? '+' : ''}${v} ${u}`;
  },
  garageClick(e) {
    const b = e.target.closest('button'); if (!b) return;
    const sv = this.sv, d = b.dataset, P = this.P();
    if (d.gtab) this.tab = d.gtab;
    else if (d.sbpre !== undefined) { this.sbv.mul = Object.assign({}, SB_DEF, SB_PRESETS[+d.sbpre][1]); Sfx.install(); this.store(); this.refreshCar(); }
    else if (this.sb && d.geq !== undefined) { P.eq[this.tab] = +d.geq; Sfx.install(); this.store(); this.refreshCar(); }
    else if (this.sb && d.gcosm) { const k = d.gcosm, slot = COSM[k].slot; P.cosm[slot] = P.cosm[slot] === k ? null : k; Sfx.install(); this.store(); this.refreshCar(); }
    else if (this.sb && d.gpaint) { P.paint = +d.gpaint; Sfx.spray(); this.store(); this.refreshCar(); }
    else if (d.gbuy !== undefined) {
      const it = DRAG_CATS.find(c => c.id === this.tab).items[+d.gbuy];
      if (sv.money < it.price || sv.lvl < it.lvl) return;
      sv.money -= it.price; sv.own[this.tab].push(+d.gbuy); sv.eq[this.tab] = +d.gbuy; Sfx.coin(); Sfx.install();
      this.store(); this.refreshCar();
    } else if (d.geq !== undefined) { sv.eq[this.tab] = +d.geq; Sfx.install(); this.store(); this.refreshCar(); }
    else if (d.gpaint) { sv.paint = +d.gpaint; Sfx.spray(); this.store(); this.refreshCar(); }
    else if (d.gcbuy) { const pr = DRAG_COSM.find(x => x[0] === d.gcbuy)[1]; if (sv.money < pr) return; sv.money -= pr; sv.cosmOwn.push(d.gcbuy); sv.cosm[COSM[d.gcbuy].slot] = d.gcbuy; Sfx.coin(); this.store(); this.refreshCar(); }
    else if (d.gcosm) { const k = d.gcosm, slot = COSM[k].slot; sv.cosm[slot] = sv.cosm[slot] === k ? null : k; Sfx.install(); this.store(); this.refreshCar(); }
    this.renderGarage();
  },
  openRivals() {
    const sv = this.sv;
    let h = '<h2>Soupeři</h2><div style="opacity:.8;font-size:14px;margin-bottom:8px">Poraž soupeře a odemkneš dalšího. Vítěz bere peníze a XP, poražený jen drobné.</div>';
    h += RIVALS.map((r, i) => {
      const open = this.sb || i <= sv.beaten, beat = !this.sb && i < sv.beaten;
      if (!r._est) r._est = this.estimate(this.stats(this.rivalBuild(r)));
      return `<div class="gItem${open ? '' : ' lock'}"><div><b>${i + 1}. ${r.n}</b>${beat ? ' <span class="gOk">✔ poražen</span>' : ''}<span>${r.car}</span><i>odhad ${r._est.et.toFixed(2)} s${this.sb ? '' : ` · výhra ${Math.round(r.money * (beat ? 0.6 : 1)).toLocaleString('cs-CZ')} Kč + ${Math.round(r.xp * (beat ? 0.6 : 1))} XP`}</i></div>${open ? `<button data-rival="${i}">Vyzvat</button>` : '<span class="gLock">🔒</span>'}</div>`;
    }).join('');
    h += `<div style="margin-top:8px;opacity:.85">Tvůj odhad: <b>${this.gEst.et.toFixed(2)} s</b></div><button class="close" data-rival="close">Zavřít</button>`;
    $('rivalsBox').innerHTML = h; $('rivals').style.display = 'flex';
  },
  bindUI() {
    $('garage').addEventListener('click', (e) => {
      if (e.target.id === 'gRace' || e.target.closest('#gRace')) return this.openRivals();
      if (e.target.id === 'gMp') { const md = this.sb ? 'dragsb' : 'drag'; if (Net.isHost || !Net.connected()) Net.mode = md; Game.openLobby(); if (Net.isHost) Net.setMode(md); return; }
      if (e.target.id === 'gSb') { this.sb = !this.sb; this.tab = this.sb ? 'crazy' : 'engine'; Sfx.install(); this.refreshCar(); this.renderGarage(); return; }
      if (e.target.id === 'gBack') return this.toMenu();
      this.garageClick(e);
    });
    $('garage').addEventListener('change', (e) => {
      if (e.target.id === 'gAutoCb') { this.P().auto = e.target.checked; this.store(); }
      const d = e.target.dataset;
      if (d.sbc) { this.sbv.mul[d.sbc] = e.target.checked; this.store(); this.refreshCar(); this.renderGarage(); }
      if (d.sb) { this.sbv.mul[d.sb] = +e.target.value; this.store(); this.refreshCar(); this.renderGarage(); }
    });
    $('garage').addEventListener('input', (e) => {   // živý popisek posuvníku
      const k = e.target.dataset.sb; if (!k) return;
      this.sbv.mul[k] = +e.target.value; $('sbv_' + k).textContent = this.sbTxt(k, +e.target.value);
    });
    $('rivalsBox').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-rival]'); if (!b) return;
      $('rivals').style.display = 'none';
      if (b.dataset.rival !== 'close') this.startAI(+b.dataset.rival);
    });
    addEventListener('keydown', (e) => this.key(e));
    addEventListener('keyup', (e) => { if (this.mode === 'race' && Settings.actionsFor(e.code).includes('nitro')) this.nitroKey = false; });
  },

  // ---------- závod ----------
  myBuild() {
    if (this.sb) { const { b, st } = this.sbBuild(); return { stats: st, vis: this.vis(b), paint: this.sbv.paint, cosm: Object.assign({}, this.sbv.cosm) }; }
    const b = this.eqBuild(this.sv); return { stats: this.stats(b), vis: Object.assign(this.vis(b), { body: Dealer.sel() }), paint: this.sv.paint, cosm: Object.assign({}, this.sv.cosm) }; },
  startAI(i) {
    const r = RIVALS[i], b = this.rivalBuild(r);
    const mine = this.myBuild();
    const cosm = r.wing ? { rear: 'wing' } : {};
    this.setupRace([
      { kind: 'me', nick: Game.nick(), col: SLOT_COL[0], stats: mine.stats, vis: mine.vis, paint: mine.paint, cosm: mine.cosm },
      { kind: 'ai', nick: r.n, col: '#ff8a6a', stats: this.stats(b), vis: this.vis(b), paint: r.paint, cosm, rival: r, idx: i },
    ], { ai: i, sb: this.sb });
  },
  startNet(seed, slots, sb) {
    if (Game.playing) { location.reload(); return; }   // z pouštní hry rovnou do dragu nejde – načti znovu
    this.load();
    if (!this.gScene) this.buildGarage();
    this.active = true; this.sb = !!sb;
    $('menu').style.display = 'none'; $('lobby').style.display = 'none';
    const mine = this.myBuild();
    const lanes = slots.map(sl => sl === Net.slot
      ? { kind: 'me', slot: sl, nick: Game.nick(), col: SLOT_COL[sl], stats: mine.stats, vis: mine.vis, paint: mine.paint, cosm: mine.cosm }
      : { kind: 'net', slot: sl, nick: Net.nickOf(sl), col: SLOT_COL[sl], stats: null, vis: {}, paint: SLOT_PAINT[sl], cosm: {} });
    this.setupRace(lanes, { net: true, sb: this.sb });
    Net.send({ t: 'dcar', vis: mine.vis, paint: mine.paint, cosm: mine.cosm, lay: mine.stats.lay, cyl: mine.stats.cyl });
    // zprávy, které dorazily dřív než dráha
    for (const d of this.pending || []) this.onNet(d);
    this.pending = [];
  },
  setupRace(lanes, opt) {
    this.active = true; this.mode = 'race'; this.opt = opt;
    if (this.lanes) for (const L of this.lanes) if (L.parts) this.dispose(L.parts);
    this.estLr = null; this._tl = -1; this._shown = false; this._cp = null; this._hudT = 0;
    $('garage').style.display = 'none'; $('race').style.display = 'none'; $('dragHud').style.display = 'block'; $('rivals').style.display = 'none';
    if (Confetti) Confetti.stop();
    this.buildTrack(lanes.length);
    const n = lanes.length;
    lanes.forEach((L, i) => {
      L.lx = (i - (n - 1) / 2) * LANE_W;
      if (L.stats) { L.car = new DragCar(L.stats); L.car.auto = L.kind === 'ai' || (L.kind === 'me' && this.P().auto); }
      if (L.kind === 'ai') {
        const r = L.rival, c = L.car; c.autoSlow = 1; c.autoAt = 0.92 + Math.random() * 0.05;
        L.aiRt = r.rt[0] + Math.random() * (r.rt[1] - r.rt[0]); L.aiLr = this.estimate(L.stats).lr;
      }
      L.parts = this.makeCarModel(L.paint, L.cosm, L.vis);
      this.tScene.add(L.parts.root);
      L.x = 0; L.v = 0; L.res = null; L.wh = 0; L.smokeT = 0;
    });
    this.lanes = lanes; this.me = lanes.find(L => L.kind === 'me');
    this.me.hands = Hands.carRig(this.me.parts);
    this.clock = 0; this.over = false; this.overT = 0; this.sendT = 0; this.nitroKey = false; this.rocketReq = false; this.fx = [];
    this.camMode = this.camMode || 'chase'; this.setCam(this.camMode);
    this.msgT = 0; this.hudMsg(opt.sb && opt.net ? 'Sandbox drag! Na zelenou MEZERNÍK – a ať to bouchne.' : opt.net ? 'Multiplayer drag! Na zelenou zmáčkni MEZERNÍK (pustíš spojku).' : `Soupeř: ${lanes[1].nick} – ${lanes[1].rival.car}`, 4);
    $('dragLanes').innerHTML = lanes.map((L, i) => `<div class="dl"><span style="color:${L.col}">${L.kind === 'me' ? '▶ ' : ''}${String(L.nick).replace(/[<>&]/g, '')}</span><div class="dlb"><i id="dlb${i}" style="background:${L.col}"></i></div></div>`).join('');
  },
  buildTrack(n) {
    const sc = this.tScene = new THREE.Scene();
    sc.background = new THREE.Color(0xf0d6a2); sc.fog = new THREE.Fog(0xf0d6a2, 260, 1500);
    sc.add(new THREE.HemisphereLight(0xfff4e0, 0x8a6a4a, 0.65));
    const sun = this.tSun = new THREE.DirectionalLight(0xfff1d8, 1.05);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera; c.left = -30; c.right = 30; c.top = 30; c.bottom = -30; c.near = 1; c.far = 200; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
    sc.add(sun); sc.add(sun.target);
    const W = n * LANE_W + 3, L0 = -90, L1 = 820, len = L1 - L0;
    const gt = Tex.get('ground').clone(); gt.needsUpdate = true; gt.repeat.set(300, 300);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), U.noTile(new THREE.MeshLambertMaterial({ color: 0xe0c08a, map: gt })));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.03; ground.receiveShadow = true; sc.add(ground);
    const at = Tex.get('asphalt').clone(); at.needsUpdate = true; at.repeat.set(W / 7.2, len / 7.2);
    const track = new THREE.Mesh(new THREE.PlaneGeometry(W, len), U.noTile(new THREE.MeshLambertMaterial({ color: 0x8a8682, map: at }), false));
    track.rotation.x = -Math.PI / 2; track.position.set(0, 0, (L0 + L1) / 2); track.receiveShadow = true; sc.add(track);
    const flat = (w, l, x, z, col, op, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshBasicMaterial({ color: col, transparent: op < 1, opacity: op, depthWrite: op >= 1 })); m.rotation.x = -Math.PI / 2; m.position.set(x, y || 0.012, z); sc.add(m); return m; };
    for (let i = 0; i < n; i++) {
      const lx = (i - (n - 1) / 2) * LANE_W;
      flat(1.7, 110, lx - 0.78, 50, 0x1a1816, 0.45, 0.008); flat(1.7, 110, lx + 0.78, 50, 0x1a1816, 0.45, 0.009);   // gumové stopy po startech
      flat(LANE_W - 0.6, 22, lx, -16, 0x2a2624, 0.5, 0.01);   // burnout box
    }
    for (let i = 0; i <= n; i++) { const x = (i - n / 2) * LANE_W; flat(i === 0 || i === n ? 0.18 : 0.12, len, x, (L0 + L1) / 2, i === 0 || i === n ? 0xe8c040 : 0xf2f0e8, 1, 0.014); }
    flat(W, 0.35, 0, 0, 0xffffff, 1, 0.016);
    const ck = document.createElement('canvas'); ck.width = 256; ck.height = 32; const cg = ck.getContext('2d');
    for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { cg.fillStyle = (x + y) % 2 ? '#111' : '#fff'; cg.fillRect(x * 16, y * 16, 16, 16); }
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(W, 1.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ck) }));
    fin.rotation.x = -Math.PI / 2; fin.position.set(0, 0.016, DRAG_LEN); sc.add(fin);
    // svodidla, tribuna s diváky, osvětlení, brány
    const conc = U.mat(0xc8c2b8), stripeM = U.mat(0xd0402a);
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, len), conc); b.position.set(sx * (W / 2 + 0.5), 0.42, (L0 + L1) / 2); b.castShadow = b.receiveShadow = true; sc.add(b);
      for (let z = L0; z < L1; z += 8) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 4), stripeM); s.position.set(sx * (W / 2 + 0.5), 0.6, z); sc.add(s); }
      for (let z = -40; z < L1; z += 90) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 15, 8), U.mat(0x6a6a6a)); pole.position.set(sx * (W / 2 + 4), 7.5, z); sc.add(pole);
        const head = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1, 0.5), U.mat(0x3a3a3a)); head.position.set(sx * (W / 2 + 4), 15, z); sc.add(head);
      }
    }
    const mg = new U.Merger(), st0 = -W / 2 - 5;
    for (let r = 0; r < 9; r++) {
      mg.addBox(1.1, 0.5 + r * 0.55, 190, st0 - r * 1.1, (0.5 + r * 0.55) / 2, 40, 0, 0x9a948c);
      for (let z = -52; z < 133; z += 0.75 + ((r * 7 + z * 13) % 5) * 0.12) {
        if (((r * 31 + Math.floor(z * 3)) % 7) === 0) continue;
        const col = [0xd04030, 0x3060c0, 0xf0e0c0, 0x40a050, 0xe0b030, 0x2a2a2a, 0xffffff, 0xa040a0][(r * 5 + Math.floor(z * 7)) % 8];
        mg.addBox(0.42, 0.55, 0.3, st0 - r * 1.1, 0.5 + r * 0.55 + 0.28, z, 0, col);
        mg.addBox(0.24, 0.24, 0.24, st0 - r * 1.1, 0.5 + r * 0.55 + 0.68, z, 0, 0xc68a5e);
      }
    }
    this.crowd = mg.build(U.vcMat); this.crowd.castShadow = true; sc.add(this.crowd);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(11, 0.3, 192), U.mat(0x7a2a1a)); roof.position.set(st0 - 4.4, 8.6, 40); sc.add(roof);
    for (let z = -50; z <= 130; z += 30) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.25, 8.6, 0.25), U.mat(0x5a5a5a)); p.position.set(st0 - 9.6, 4.3, z); sc.add(p); }
    const gantry = (z, text, bg, fg) => {
      for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.5, 0.4), U.mat(0x3a3a3a)); p.position.set(sx * (W / 2 + 1.3), 3.75, z); sc.add(p); }
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(W + 3, 1.6), new THREE.MeshBasicMaterial({ map: U.textTexture(text, 512, 64, bg, fg), side: THREE.DoubleSide }));
      ban.position.set(0, 7, z); ban.rotation.y = Math.PI; sc.add(ban);
    };
    gantry(-14, 'POUŠTNÍ DRAGSTRIP', '#1a1410', '#ffb347'); gantry(DRAG_LEN, 'CÍL · 1/4 MÍLE', '#f4efe2', '#111111');
    for (const [d, t] of [[18.3, '60 ft'], [100.6, '330 ft'], [201.2, '1/8 míle'], [304.8, '1000 ft']]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), new THREE.MeshBasicMaterial({ map: U.textTexture(t, 256, 80, '#f4efe2', '#111'), side: THREE.DoubleSide }));
      s.position.set(W / 2 + 1.6, 2.2, d); s.rotation.y = -Math.PI / 2; sc.add(s);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2, 0.1), U.mat(0x5a5a5a)); p.position.set(W / 2 + 1.6, 1, d); sc.add(p);
    }
    // semafor ("vánoční stromeček"): pro každou dráhu sloupec světel
    const tx = n % 2 ? LANE_W / 2 : 0, tree = new THREE.Group(); tree.position.set(tx, 0, 7); sc.add(tree);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.16), U.mat(0x2a2a2a)); pole.position.y = 1.1; tree.add(pole);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3 + n * 0.32, 1.9, 0.18), U.mat(0x1a1a1a)); body.position.y = 3.1; tree.add(body);
    this.tree = [];
    const lampG = new THREE.SphereGeometry(0.09, 10, 8);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 0.32, col = [], mk = (y, c) => { const m = new THREE.Mesh(lampG, new THREE.MeshBasicMaterial({ color: 0x222222 })); m.position.set(x, y, -0.12); m.userData.on = c; tree.add(m); col.push(m); return m; };
      this.tree.push({ pre: mk(3.85, 0xfff4c0), a: [mk(3.5, 0xffa020), mk(3.2, 0xffa020), mk(2.9, 0xffa020)], g: mk(2.55, 0x30ff60), r: mk(2.25, 0xff2a20) });
    }
    // hory v dálce
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * Math.PI * 2, d = 900 + (i * 137 % 400), h = 60 + (i * 53 % 120);
      const m = new THREE.Mesh(new THREE.ConeGeometry(h * 1.6, h, 6), U.mat([0xc08a5a, 0xb07a4e, 0xcc9a68][i % 3])); m.position.set(Math.cos(a) * d, h / 2 - 5, 300 + Math.sin(a) * d); sc.add(m);
    }
    // kouř z kol
    const sm = document.createElement('canvas'); sm.width = sm.height = 64; const sg = sm.getContext('2d');
    const gr = sg.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); sg.fillStyle = gr; sg.fillRect(0, 0, 64, 64);
    this.smokeTex = new THREE.CanvasTexture(sm); this.smoke = [];
    for (let i = 0; i < 60; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.smokeTex, transparent: true, opacity: 0, depthWrite: false, color: 0xdedad4 })); s.visible = false; sc.add(s); this.smoke.push({ s, life: 0 }); }
    this.tCam = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.08, 3000); this.tCam.rotation.order = 'YXZ';
    sc.add(this.tCam);
  },
  setCam(m) {
    this.camMode = m;
    const cam = this.tCam, me = this.me;
    if (m === 'cockpit') { me.parts.root.add(cam); cam.position.set(0.38, 1.25, -0.3); cam.rotation.set(-0.06, Math.PI, 0); }
    else { this.tScene.add(cam); this._cp = null; }
  },
  puff(x, y, z, big) {
    const p = this.smoke.find(q => q.life <= 0); if (!p) return;
    p.life = 1; p.s.visible = true; p.s.position.set(x + (Math.random() - 0.5) * 0.4, y, z); p.big = big;
    p.vx = (Math.random() - 0.5) * 1.5; p.vy = 0.6 + Math.random(); p.vz = -1 - Math.random() * 2;
  },
  key(e) {
    if (!this.active || this.mode !== 'race') return;
    if (e.target && e.target.tagName === 'INPUT') return;
    if ($('settings').style.display === 'flex') return;
    const acts = Settings.actionsFor(e.code), has = (a) => acts.includes(a);
    if (has('nitro')) this.nitroKey = true;
    if (e.repeat) return;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'Escape') { if (!this.over) this.forfeit(); return; }
    const c = this.me.car; if (!c || this.over && c.done) return;
    if (e.code === 'Space' || has('shiftUp')) {
      if (!c.launched) {
        if (this.clock < 1.2) return;
        c.launch(DRAG_GREEN);
        if (c.foul) { this.hudMsg('ČERVENÁ! Předčasný start – prohráváš', 3, 'bad'); Sfx.tone(180, 0.5, 0.3, 'square'); }
        else this.hudMsg(`Reakce ${c.rt.toFixed(3)} s${c.rt < 0.2 ? ' – BLESK!' : c.rt < 0.35 ? ' – dobrý start' : ''}`, 2, c.rt < 0.2 ? 'good' : '');
      } else if (!c.auto) {
        const q = c.shiftUp();
        if (q !== null) { this.me.parts.root.updateMatrixWorld(); this.shiftFx(this.me, q); }
      }
    }
    if (has('shiftDown') && !c.auto) c.shiftDown();
    if (has('rocket')) this.rocketReq = true;
    if (has('camera')) this.setCam(this.camMode === 'chase' ? 'cockpit' : 'chase');
    if (has('radio')) Radio.toggle();
    if (has('radioNext')) Radio.next();
    if (has('settings')) Settings.open('drag');
  },
  shiftFx(L, q) {
    Sfx.shift(100);
    if (L.stats.ind === 1 && L.car.boost > 0.4) Sfx.blowoff(L.car.boost);
    if (q > 0.86 && q <= 0.99) this.hudMsg('PERFEKTNÍ ŘAZENÍ!', 0.9, 'good');
    else if (q < 0.7) this.hudMsg('Brzo! Motor se dusí', 0.9, 'warn');
    L.flameT = 0.12;
  },
  forfeit() {
    if (this.opt.net) { const c = this.me.car; if (!this.me.res) { c.dnf = true; } this.hudMsg('Vzdal jsi to', 2, 'bad'); return; }
    this.exit(); this.enterGarage();
  },
  hudMsg(t, dur, cls) { const e = $('dragMsg'); e.textContent = t; e.className = cls || ''; e.style.fontSize = t.length > 30 ? '22px' : '40px'; e.style.opacity = 1; this.msgT = dur || 2; },
  onNet(d) {
    if (!this.lanes || this.mode !== 'race' || !this.opt || !this.opt.net) { (this.pending = this.pending || []).push(d); return; }
    const L = this.lanes.find(q => q.slot === d.from); if (!L || L.kind !== 'net') return;
    if (d.t === 'dcar') {
      this.tScene.remove(L.parts.root); this.dispose(L.parts);
      L.vis = d.vis || {}; L.paint = d.paint; L.cosm = d.cosm || {}; L.parts = this.makeCarModel(L.paint, L.cosm, L.vis); this.tScene.add(L.parts.root);
    } else if (d.t === 'ds') { if (!L.sm) L.sm = new U.NetSmooth(['x']); if (!L.sm.push(d)) return; L.tx = d.x; L.v = d.v; L.rpm = d.rpm; L.wht = d.wh; L.fl = d.fl; L.launched = d.l; if (L.x === undefined) L.x = d.x; }
    else if (d.t === 'dfin') L.res = { total: d.total, et: d.et, rt: d.rt, trap: d.trap, foul: d.foul, dnf: d.dnf };
  },
  netLeft(slot) {
    if (!this.lanes) return;
    for (const L of this.lanes) if (L.kind === 'net' && (slot < 0 || L.slot === slot) && !L.res) { L.res = { dnf: true, left: true }; this.hudMsg(`${L.nick} se odpojil`, 2, 'bad'); }
  },

  frame(dt) {
    const r = Game.renderer;
    if (this.mode === 'garage') {
      this.gIdle = (this.gIdle || 0) + dt;
      if (this.gIdle > 3 && !this._drag) this.gYaw += dt * 0.25;
      const cam = this.gCam; cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
      cam.position.set(Math.sin(this.gYaw) * Math.cos(this.gPitch) * this.gDist, 1 + Math.sin(this.gPitch) * this.gDist, Math.cos(this.gYaw) * Math.cos(this.gPitch) * this.gDist);
      cam.lookAt(-1.2 * Math.cos(this.gYaw), 0.9, 1.2 * Math.sin(this.gYaw));
      GarageDecor.update(dt, this.gDecor);
      r.shadowMap.needsUpdate = true; r.render(this.gScene, cam);
      return;
    }
    if (this.mode !== 'race') return;
    this.clock += dt;
    const keys = Game.keys, thr = Math.max(Settings.kdown(keys, 'forward') ? 1 : 0, Pad.thr());   // plyn i z pedálu (analogově)
    const me = this.me, N = 8, h = dt / N;
    // vstupy a fyzika
    for (const L of this.lanes) {
      if (!L.car) continue;
      let inp;
      if (L.kind === 'me') inp = { thr, nitro: this.nitroKey, rocket: this.rocketReq };
      else {   // AI: vytočí motor, na zelenou vyrazí, nitro a raketa po startu
        const c = L.car, t = c.t;
        if (!c.launched && t >= DRAG_GREEN + L.aiRt) c.launch(DRAG_GREEN);
        inp = { thr: c.launched ? 1 : t > 1.5 ? L.aiLr : 0, nitro: c.launched && t > c.launchT + 0.3, rocket: c.launched && t > c.launchT + 0.6 };
      }
      for (let i = 0; i < N; i++) {
        const g0 = L.car.gear;
        L.car.step(h, inp);
        if (L.kind === 'ai' && L.car.gear !== g0) { L.flameT = 0.1; L.car.autoAt = 0.92 + Math.random() * 0.06; }
        if (L.kind === 'me' && L.car.gear !== g0 && L.car.auto) this.shiftFx(L, L.car.lastQ || 0.9);
      }
      L.x = L.car.x; L.v = L.car.v; L.wh = L.car.wh; L.rpm = L.car.rpm;
      if (!L.res && (L.car.finished || L.car.dnf)) {
        const c = L.car;
        L.res = c.dnf && !c.finished ? { dnf: true, foul: c.foul } : { total: c.finishT - DRAG_GREEN, et: c.finishT - c.launchT, rt: c.rt, trap: c.trap * 3.6, foul: c.foul };
        if (L.kind === 'me') {
          if (this.opt.net) Net.send(Object.assign({ t: 'dfin' }, L.res));
          if (c.finished) this.hudMsg(`CÍL! ${L.res.et.toFixed(3)} s · ${Math.round(L.res.trap)} km/h`, 3, 'good');
        }
      }
    }
    this.rocketReq = false;
    // síť: poloha ostatních hráčů
    if (this.opt.net) {
      this.sendT -= dt;
      if (this.sendT <= 0 && me.car) {
        this.sendT = 1 / 30; const c = me.car;
        Net.send({ t: 'ds', x: c.x, v: c.v, rpm: Math.round(c.rpm), wh: c.wh, l: c.launched ? 1 : 0, fl: (c.nitroOn ? 1 : 0) | (c.jet > 0.1 ? 2 : 0) | (c.rocketOn ? 4 : 0) | (c.chuteOut ? 8 : 0) | (c.spin ? 16 : 0) });
      }
      for (const L of this.lanes) if (L.kind === 'net' && L.tx !== undefined) { const sm = L.sm && L.sm.update(dt); if (sm && sm.x !== undefined) L.x = sm.x; else { L.tx += (L.v || 0) * dt; L.x += (L.tx - L.x) * Math.min(1, dt * 8); } L.wh += ((L.wht || 0) - (L.wh || 0)) * Math.min(1, dt * 8); }
    }
    // semafor
    const tc = this.clock;
    this.tree.forEach((T, i) => {
      const L = this.lanes[i], c = L.car, fl = c ? c.foul : false, launched = c ? c.launched : L.launched;
      const on = (m, v) => { m.material.color.setHex(v ? m.userData.on : 0x222222); };
      on(T.pre, tc > 0.8 && !(launched && tc > DRAG_GREEN + 1.5));
      T.a.forEach((m, k) => on(m, tc >= DRAG_GREEN - 1.5 + k * 0.5 && tc < DRAG_GREEN && !fl));
      on(T.g, tc >= DRAG_GREEN && !fl); on(T.r, fl);
    });
    const tl = tc < 0.8 ? 0 : tc < DRAG_GREEN - 1.5 ? 1 : tc < DRAG_GREEN ? 2 + Math.floor((tc - (DRAG_GREEN - 1.5)) / 0.5) : 5;
    if (tl !== this._tl) {
      this._tl = tl;
      if (tl >= 2 && tl <= 4) Sfx.tone(520, 0.12, 0.15, 'square');
      if (tl === 5) Sfx.tone(1040, 0.3, 0.2, 'square');
      $('dragTree').innerHTML = [0, 1, 2].map(k => `<i class="${tl >= 2 + k && tl < 5 ? 'am' : ''}"></i>`).join('') + `<i class="${tl === 5 && !(me.car && me.car.foul) ? 'gr' : ''}"></i><i class="${me.car && me.car.foul ? 'rd' : ''}"></i>`;
    }
    if (me.car && me.car.foul) $('dragTree').lastChild.className = 'rd';
    // vizuál aut
    for (const L of this.lanes) this.updateLaneVis(L, dt);
    // kouř
    for (const p of this.smoke) {
      if (p.life <= 0) continue;
      p.life -= dt * 0.55; p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      const sc = (p.big ? 2.5 : 1.4) + (1 - p.life) * (p.big ? 6 : 3.5); p.s.scale.set(sc, sc, sc);
      p.s.material.opacity = Math.max(0, p.life) * 0.55; if (p.life <= 0) p.s.visible = false;
    }
    // kamera
    const cam = this.tCam; cam.aspect = innerWidth / innerHeight;
    const v = me.car ? me.car.v : 0;
    if (this.camMode === 'chase') {
      const intro = U.smooth(0, 2.2, tc), tx = me.lx, tz = me.x;
      const want = new THREE.Vector3(tx + U.lerp(9, 0.6, intro), U.lerp(4.5, 2.4, intro), tz - U.lerp(-4, 7.5 + Math.min(4, v * 0.04), intro));
      if (!this._cp) this._cp = want.clone(); else this._cp.lerp(want, Math.min(1, dt * 6));
      const shake = (me.car && (me.car.nitroOn || me.car.rocketOn || me.car.spin) ? 0.06 : 0) + Math.min(0.04, v * 0.0004);
      cam.position.copy(this._cp).add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0));
      cam.lookAt(tx, 1.0, tz + 6);
      cam.fov = Settings.s.fov - 5 + Math.min(28, v * 0.12);
    } else {
      cam.fov = Settings.s.fov + Math.min(18, v * 0.08);
      Hands.updateCar(me.hands, { parts: me.parts, shiftAnim: this._sa || 0, handbrake: false, speed: v, radioAnim: 0 }, true, dt);
    }
    if (this.camMode !== 'cockpit') me.hands.rig.visible = false;
    cam.updateProjectionMatrix();
    const sun = this.tSun; U.snapSun(sun, { x: me.lx, y: 0, z: me.x + 10 }, this._sunDir || (this._sunDir = new THREE.Vector3(30, 60, 10)), 70);
    // zvuk
    const c = me.car;
    if (c) {
      Sfx.engine({ rpm: c.rpm, throttle: c.thr, running: true, speed: c.v, slip: c.spin ? 0.5 : 0, wspin: c.spin ? 1 : 0, lock: c.finished && c.v > 5 ? 0.4 : 0, onRoad: true, inCar: true,
        dist: 0, lay: c.s.lay, cyl: Math.min(16, c.s.cyl), ind: c.s.ind, boost: c.boost, exhaust: true });
      Sfx.thrust({ jet: c.jet, rocket: c.rocketOn ? 1 : 0, nitro: c.nitroOn ? 1 : 0 });
    }
    this.updateHud(dt);
    // konec závodu
    if (!this.over && this.lanes.every(L => L.res)) { this.over = true; this.overT = 2.2; }
    if (this.over) { this.overT -= dt; if (this.overT <= 0 && !this._shown) { this._shown = true; this.results(); } } else this._shown = false;
    r.shadowMap.needsUpdate = true;
    r.render(this.tScene, cam);
  },
  updateLaneVis(L, dt) {
    const p = L.parts, c = L.car, x = L.x || 0, wh = L.wh || 0;
    const fl = c ? (c.nitroOn ? 1 : 0) | (c.jet > 0.1 ? 2 : 0) | (c.rocketOn ? 4 : 0) | (c.chuteOut ? 8 : 0) | (c.spin ? 16 : 0) : (L.fl || 0);
    const jetLv = c ? c.jet : (fl & 2 ? 1 : 0);
    p.root.position.set(L.lx, Math.sin(wh) * 1.3, x - (1 - Math.cos(wh)) * 1.3);
    p.root.rotation.set(-wh, 0, 0);
    const sp = (L.v || 0) * dt / WHEEL_R;
    p.wheels.forEach((w, i) => { w.spin.rotation.x += i >= 2 && (fl & 16) ? sp * 2.5 : sp; });
    if (p.jetFlame) { const k = jetLv * (0.85 + Math.random() * 0.3); p.jetFlame.visible = p.jetCore.visible = jetLv > 0.05; p.jetFlame.scale.set(1, 1, k); p.jetCore.scale.set(1, 1, k); }
    if (p.rocketFlame) { const on = !!(fl & 4), k = 0.8 + Math.random() * 0.4; p.rocketFlame.visible = p.rocketCore.visible = on; p.rocketFlame.scale.set(1, 1, k); p.rocketCore.scale.set(1, 1, k); }
    L.flameT = Math.max(0, (L.flameT || 0) - dt);
    for (const f of p.flames) { f.visible = !!(fl & 1) || L.flameT > 0; f.material.color.setHex(fl & 1 ? 0x5ab0ff : 0xff9a3a); f.scale.set(1, 1, (fl & 1 ? 1.6 : 1) * (0.7 + Math.random() * 0.6)); }
    if (p.chute) { p.chute.visible = !!(fl & 8); p.chute.scale.setScalar(U.lerp(p.chute.scale.x || 0.1, 1, Math.min(1, dt * 3))); }
    p.tailMat.emissive.setHex(c && c.finished ? 0xff2010 : 0x300804);
    L.smokeT -= dt;
    if ((fl & 16) && L.smokeT <= 0) { L.smokeT = 0.03; for (const sx of [-0.8, 0.8]) this.puff(L.lx + sx, 0.3, x - 1.3, (L.v || 0) < 5); }
  },
  updateHud(dt) {
    const me = this.me, c = me.car;
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) $('dragMsg').style.opacity = 0; }
    // otáčkoměr
    const cv = $('dragTach'), g = cv.getContext('2d'), W = cv.width, H = cv.height, cx = W / 2, cy = H / 2 + 10, R = 108;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(12,8,4,.78)'; g.beginPath(); g.arc(cx, cy, R + 14, 0, 7); g.fill();
    const red = c.s.red, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, ang = (v) => a0 + (a1 - a0) * U.clamp(v / (red * 1.08), 0, 1.02);
    g.lineWidth = 12;
    g.strokeStyle = '#2a7a3a'; g.beginPath(); g.arc(cx, cy, R - 6, ang(red * 0.86), ang(red * 0.97)); g.stroke();
    g.strokeStyle = '#a3241a'; g.beginPath(); g.arc(cx, cy, R - 6, ang(red), a1); g.stroke();
    if (!c.launched) { const e = this.estLr || (this.estLr = this.estimate(c.s).lr); g.strokeStyle = '#d8a030'; g.beginPath(); g.arc(cx, cy, R - 20, ang(900 + e * (red - 900) - red * 0.06), ang(900 + e * (red - 900) + red * 0.06)); g.stroke(); }
    g.strokeStyle = '#f4e9d2'; g.fillStyle = '#f4e9d2'; g.lineWidth = 3; g.font = 'bold 15px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const step = red > 7000 ? 2000 : 1000;
    for (let v = 0; v <= red * 1.08; v += step / 2) { const a = ang(v), big = v % step === 0; g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * (R - (big ? 16 : 8)), cy + Math.sin(a) * (R - (big ? 16 : 8))); g.stroke(); if (big) g.fillText(v / 1000, cx + Math.cos(a) * (R - 30), cy + Math.sin(a) * (R - 30)); }
    const a = ang(c.rpm), shiftLight = c.launched && c.clutchT <= 0 && c.rpm / red > 0.86 && !c.auto;
    g.strokeStyle = shiftLight ? '#40ff70' : '#ffb347'; g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (R - 10), cy + Math.sin(a) * (R - 10)); g.stroke();
    g.fillStyle = '#2a221c'; g.beginPath(); g.arc(cx, cy, 10, 0, 7); g.fill();
    g.fillStyle = shiftLight ? '#40ff70' : c.limiter ? '#ff5a4a' : '#ffcf86'; g.font = 'bold 54px Arial'; g.fillText(c.gear === 0 ? 'N' : c.gear, cx, cy + 46);
    g.fillStyle = '#f4e9d2'; g.font = 'bold 20px Arial'; g.fillText(Math.round(c.v * 3.6) + ' km/h', cx, cy - 36);
    if (shiftLight) { g.fillStyle = '#40ff70'; g.font = 'bold 16px Arial'; g.fillText('ŘAĎ!', cx, cy + 84); }
    this._hudT = (this._hudT || 0) - dt;
    if (this._hudT > 0) return;
    this._hudT = 0.08;
    const tSince = this.clock - DRAG_GREEN;
    let info = `<div class="dt">${c.launched && !c.finished ? (c.t - c.launchT).toFixed(2) : c.finished ? (c.finishT - c.launchT).toFixed(3) : tSince > 0 ? '+' + tSince.toFixed(2) : '0.00'} s</div>`;
    info += `<div>${Math.max(0, DRAG_LEN - c.x).toFixed(0)} m do cíle</div>`;
    if (c.s.nitroHP) info += `<div class="nb">NITRO <span><i style="width:${U.clamp(c.nitroLeft / c.s.nitroDur, 0, 1) * 100}%"></i></span></div>`;
    if (c.s.rocketN) info += `<div>RAKETA: ${c.rocketT < 0 ? `<b>připravena (${Settings.keyName(Settings.key('rocket'))})</b>` : c.rocketOn ? '<b style="color:#ffb040">HOŘÍ!</b>' : 'vyhořelá'}</div>`;
    if (c.s.jetN) info += `<div>TURBÍNA ${Math.round(c.jet * 100)} %</div>`;
    if (c.ind === 1 || c.s.ind) info += `<div>${c.s.ind === 1 ? 'TURBO' : 'KOMPRESOR'} ${Math.round(c.boost * 100)} %</div>`;
    if (c.wh > 0.12 && !c.finished) info += '<div style="color:#ffcf86;font-weight:800">WHEELIE!</div>';
    if (c.spin && c.launched && !c.finished) info += '<div style="color:#ff8a6a;font-weight:800">PROKLUZ!</div>';
    $('dragInfo').innerHTML = info;
    this.lanes.forEach((L, i) => { const e = $('dlb' + i); if (e) e.style.width = U.clamp((L.x || 0) / DRAG_LEN, 0, 1) * 100 + '%'; });
    const K = (x) => Settings.keyName(Settings.key(x));
    $('dragKeys').innerHTML = !c.launched
      ? `Drž <b>${K('forward')}</b> = vytoč motor do žluté zóny · na <b style="color:#40ff70">ZELENOU</b> zmáčkni <b>Mezerník</b> · nedřív!`
      : `<b>${K('forward')}</b> plyn · ${c.auto ? 'automat řadí sám' : `<b>Mezerník / ${K('shiftUp')}</b> řadit (v zelené zóně)`} · <b>${K('nitro')}</b> nitro · <b>${K('rocket')}</b> raketa · <b>${K('camera')}</b> kamera · <b>Esc</b> vzdát`;
  },
  // ---------- výsledky a odměny ----------
  results() {
    const lanes = this.lanes, me = this.me;
    const rank = lanes.slice().sort((a, b) => {
      const ka = a.res.dnf ? 2 : a.res.foul ? 1 : 0, kb = b.res.dnf ? 2 : b.res.foul ? 1 : 0;
      return ka - kb || (a.res.total || 99) - (b.res.total || 99);
    });
    const place = rank.indexOf(me) + 1, win = place === 1 && !me.res.foul && !me.res.dnf, sv = this.sv;
    let money, xp, txt;
    if (this.opt.sb) {
      money = 0; xp = 0;
      txt = win ? (this.opt.net ? 'Vyhrál jsi sandbox jízdu!' : `${rank[1].nick} nestačil na tvoje šílenství!`) : `Vyhrál ${rank[0].nick}.`;
    } else if (this.opt.net) {
      const n = lanes.length, base = (700 + 350 * sv.lvl) * (1 + 0.3 * (n - 2));
      money = Math.round(base * (win ? 1 : 0.3)); xp = Math.round((110 + 30 * sv.lvl) * (win ? 1 : 0.4));
      txt = win ? `Porazil jsi ${n - 1 === 1 ? rank[1].nick : (n - 1) + ' soupeře'}!` : `Vyhrál ${rank[0].nick}.`;
    } else {
      const i = this.opt.ai, r = RIVALS[i], replay = i < sv.beaten;
      money = Math.round(r.money * (replay ? 0.6 : 1) * (win ? 1 : 0.15)); xp = Math.round(r.xp * (replay ? 0.6 : 1) * (win ? 1 : 0.3));
      if (win && i === sv.beaten && sv.beaten < RIVALS.length) sv.beaten++;
      txt = win ? (i === RIVALS.length - 1 ? 'Porazil jsi Pouštního ducha. Jsi legenda dragstripu!' : `${r.n} je poražen${replay ? '' : ` – odemkl jsi dalšího soupeře: ${RIVALS[Math.min(i + 1, RIVALS.length - 1)].n}`}!`) : `${r.n} byl rychlejší. Vylepši auto a zkus to znovu.`;
    }
    if (me.res.foul) txt = 'Předčasný start = červená. ' + txt;
    if (me.res.dnf && !me.res.left) txt = 'Nedojel jsi. ' + txt;
    let ups = [];
    if (this.opt.net && !this.opt.sb) Account.mp(win);
    if (!this.opt.sb) { sv.money += money; sv.races++; if (win) sv.wins++; ups = this.addXp(xp); }
    this.store();
    const fmt = (v, d) => (v === undefined || v === null ? '—' : v.toFixed(d));
    const rows = rank.map(L => ({ me: L === me, col: L.col, cells: [String(L.nick).replace(/[<>&]/g, ''), L.res.dnf ? 'nedojel' : L.res.foul ? 'ČERVENÁ' : fmt(L.res.rt, 3), L.res.dnf ? '—' : fmt(L.res.et, 3) + ' s', L.res.dnf ? '—' : fmt(L.res.total, 3) + ' s', L.res.dnf ? '—' : Math.round(L.res.trap) + ' km/h'] }));
    let rew = this.opt.sb ? '<div class="rwd"><span>🧪 Sandbox – bez odměn, jen sranda</span></div>' : `<div class="rwd"><span>💰 +${money.toLocaleString('cs-CZ')} Kč</span><span>⭐ +${xp} XP</span></div>`;
    for (const [l, b] of ups) rew += `<div class="lvlup">LEVEL ${l}! Bonus ${b.toLocaleString('cs-CZ')} Kč a nové díly v garáži</div>`;
    const btns = [];
    if (this.opt.net) { if (Net.isHost) btns.push({ label: '🏁 Další jízda', fn: () => Net.start() }); else rew += '<div style="opacity:.8;margin-top:6px">Hostitel může spustit další jízdu.</div>'; }
    else {
      const nxt = this.opt.ai + 1;
      if (nxt < RIVALS.length && (this.sb || nxt <= sv.beaten)) btns.push({ label: `⏭ Další soupeř: ${RIVALS[nxt].n}`, fn: () => this.startAI(nxt) });
      btns.push({ label: '🔁 Znovu', alt: nxt < RIVALS.length && (this.sb || nxt <= sv.beaten), fn: () => this.startAI(this.opt.ai) });
    }
    btns.push({ label: '🔧 Do garáže', alt: true, fn: () => { this.exit(); this.enterGarage(); } });
    Game.showResults({ win, title: win ? 'VYHRÁL JSI!' : place === 2 && lanes.length > 2 && !me.res.foul && !me.res.dnf ? 'DRUHÝ!' : 'PROHRÁL JSI', text: txt, cols: ['Řidič', 'Reakce', 'Čas', 'Celkem', 'Rychlost'], rows, reward: rew, buttons: btns, drag: true });
    Sfx.thrust({});
  },
};
