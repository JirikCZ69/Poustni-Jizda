// items.js – díly auta (kvalita + stav), motory různých konstrukcí, převodovky, kosmetika, spreje, zásoby, loot a jeho značky
const TIERS = [
  { name: 'Rezavý', color: '#a8a8a8', hex: 0x9a9a9a },
  { name: 'Běžný', color: '#f0ead8', hex: 0xe8e2d0 },
  { name: 'Sportovní', color: '#4aa3ff', hex: 0x4aa3ff },
  { name: 'Závodní', color: '#c27bff', hex: 0xb060ff },
  { name: 'Legendární', color: '#ffc23a', hex: 0xffb020 },
];
const WEAR_MUL = [1.6, 1, 0.75, 0.55, 0.4];
// konstrukce motoru: každá má jiný tvar, velikost, výkon i zvuk
const ENGINE_LAY = {
  i3: { n: 'tříválec 1.2', cyl: 3, tq: 0.85, cons: 0.8, heat: 0.95, len: 0.46, w: 0.42 },
  i4: { n: 'čtyřválec 1.6', cyl: 4, tq: 1.0, cons: 1.0, heat: 1.0, len: 0.62, w: 0.45 },
  boxer: { n: 'boxer 2.0', cyl: 4, tq: 1.12, cons: 1.05, heat: 1.0, len: 0.5, w: 0.76 },
  i6: { n: 'řadový šestiválec 3.0', cyl: 6, tq: 1.38, cons: 1.3, heat: 1.08, len: 0.86, w: 0.45 },
  v6: { n: 'V6 3.2', cyl: 6, tq: 1.45, cons: 1.4, heat: 1.1, len: 0.56, w: 0.64 },
  v8: { n: 'V8 5.0', cyl: 8, tq: 1.9, cons: 1.85, heat: 1.22, len: 0.7, w: 0.68 },
};
const INDUCTION = [
  { n: '', tq: 1, cons: 1, heat: 1 },
  { n: 'Turbo', tq: 1.45, cons: 1.12, heat: 1.12 },
  { n: 'Kompresor', tq: 1.3, cons: 1.15, heat: 1.08 },
];
const ENGINE_TIER_TQ = [0.85, 1, 1.18, 1.38, 1.6];
// převodovky: počet stupňů, převody, stálý převod a rychlost řazení
const GEARBOXES = [
  { n: '4stupňová', r: [3.5, 2.0, 1.3, 0.95], fin: 3.9, shift: 0.45 },
  { n: '5stupňová', r: [3.3, 2.1, 1.45, 1.1, 0.86], fin: 3.7, shift: 0.3 },
  { n: '5stupňová sportovní', r: [3.2, 2.15, 1.55, 1.18, 0.92], fin: 3.85, shift: 0.2 },
  { n: '6stupňová závodní', r: [3.1, 2.2, 1.62, 1.28, 1.02, 0.84], fin: 3.8, shift: 0.13 },
  { n: '6stupňová sekvenční', r: [3.0, 2.2, 1.65, 1.3, 1.04, 0.82], fin: 3.9, shift: 0.06 },
];
// sloty v motorovém prostoru + kola a nádrž
const PARTS = {
  engine: { name: 'Motor', bay: true, req: true, base: 40 },
  gearbox: { name: 'Převodovka', bay: true, req: true, base: 24 },
  battery: { name: 'Baterie', bay: true, req: true, base: 10, stat: [0.7, 1, 1.6, 2.3, 3] },           // kapacita
  starter: { name: 'Startér', bay: true, req: true, base: 8, stat: [0.55, 0.85, 0.95, 1, 1] },         // spolehlivost
  alternator: { name: 'Alternátor', bay: true, req: false, base: 8, stat: [0.25, 0.4, 0.55, 0.7, 0.9] },  // dobíjení
  plugs: { name: 'Zapalovací svíčky', bay: true, req: true, base: 4, stat: [0.95, 1, 1.05, 1.1, 1.15] }, // výkon
  carb: { name: 'Karburátor', bay: true, req: true, base: 9, stat: [0.94, 1, 1.12, 1.25, 1.4] },        // výkon
  fuelpump: { name: 'Palivové čerpadlo', bay: true, req: true, base: 6 },
  radiator: { name: 'Chladič', bay: true, req: false, base: 9, stat: [0.7, 1, 1.5, 2.1, 2.8] },          // chlazení
  belt: { name: 'Klínový řemen', bay: true, req: false, base: 3 },
  airfilter: { name: 'Vzduchový filtr', bay: true, req: false, base: 3, stat: [0.95, 1, 1.05, 1.08, 1.12] },
  tire: { name: 'Sada kol (4×)', bay: false, base: 16, stat: [0.88, 1, 1.12, 1.25, 1.38] },              // přilnavost
  tank: { name: 'Nádrž', bay: false, base: 8, stat: [40, 55, 70, 85, 100] },                            // litry
};
const BAY_SLOTS = ['engine', 'gearbox', 'battery', 'starter', 'alternator', 'plugs', 'carb', 'fuelpump', 'radiator', 'belt', 'airfilter'];
const SUPPLIES = {
  canister: { name: 'Kanystr benzínu', cat: 'fluid', fluid: 'fuel', amount: 20, unit: 'l', value: 6 },
  oil: { name: 'Motorový olej', cat: 'fluid', fluid: 'oil', amount: 2, unit: 'l', value: 4 },
  coolant: { name: 'Chladicí kapalina', cat: 'fluid', fluid: 'coolant', amount: 3, unit: 'l', value: 3 },
  repairkit: { name: 'Opravná sada', cat: 'repair', value: 12 },
  medkit: { name: 'Lékárnička', cat: 'medkit', value: 8 },
  spray: { name: 'Sprej na auto', cat: 'spray', value: 5 },
};
// barvy sprejů
const SPRAYS = [
  ['červená', 0xb02a22], ['modrá', 0x2a4f9a], ['černá', 0x1c1c1e], ['bílá', 0xe8e6e0], ['žlutá', 0xe0b020], ['zelená', 0x3a7a3a],
  ['oranžová', 0xe0701e], ['růžová', 0xd0608a], ['stříbrná', 0xa8acb0], ['tyrkysová', 0x2a9a9a], ['fialová', 0x6a3a9a], ['olivová', 0x5a6040],
  ['vínová', 0x6a1a26], ['pískovaná', 0xc8a878], ['původní tyrkys', 0x4f7f86],
];
// kosmetické doplňky (slot = místo na autě, kam se dávají)
const COSM = {
  spoiler: { name: 'Spoiler na kufr', slot: 'rear', value: 10 },
  wing: { name: 'Závodní křídlo', slot: 'rear', value: 18 },
  scoop: { name: 'Nasávání na kapotu', slot: 'hood', value: 10 },
  bullbar: { name: 'Bullbar (−25 % poškození zepředu)', slot: 'front', value: 14 },
  lightbar: { name: 'Rampa světel na střechu', slot: 'roof', value: 14 },
  roofrack: { name: 'Střešní nosič s kanystrem', slot: 'roof', value: 8 },
  stripes: { name: 'Závodní pruhy', slot: 'stripes', value: 6 },
  fenders: { name: 'Rozšířené blatníky', slot: 'fenders', value: 12 },
  exhaust: { name: 'Sportovní výfuk (hlasitější)', slot: 'exhaust', value: 12 },
  rims_chrome: { name: 'Chromová kola', slot: 'rims', value: 12, rim: 0xe4e4ea },
  rims_gold: { name: 'Zlatá kola', slot: 'rims', value: 16, rim: 0xd8a830 },
  rims_black: { name: 'Černá kola', slot: 'rims', value: 10, rim: 0x1c1c1c },
};
// zbraně (na začátku jen nůž) a náboje
const WEAPONS = {
  knife: { name: 'Nůž', melee: true, dmg: 1.5, range: 2.2, rate: 0.45, value: 3 },
  boxer: { name: 'Boxer', melee: true, dmg: 2, range: 1.9, rate: 0.32, value: 6 },
  machete: { name: 'Mačeta', melee: true, dmg: 3, range: 2.6, rate: 0.6, value: 10 },
  bat: { name: 'Baseballka', melee: true, dmg: 2.5, range: 2.6, rate: 0.55, knock: 5, value: 8 },
  pistol: { name: 'Pistole', ammo: 'ammo_pistol', dmg: 2, mag: 8, rate: 0.28, spread: 0.012, range: 120, reload: 1.3, value: 20 },
  shotgun: { name: 'Brokovnice', ammo: 'ammo_shotgun', dmg: 1.1, pellets: 7, mag: 2, rate: 0.8, spread: 0.07, range: 45, reload: 2.0, value: 30 },
  sniper: { name: 'Odstřelovačka', ammo: 'ammo_rifle', dmg: 8, mag: 5, rate: 1.2, spread: 0.0015, range: 500, reload: 2.4, scope: true, value: 55 },
  smg: { name: 'Samopal', ammo: 'ammo_rifle', dmg: 1.4, mag: 30, rate: 0.09, spread: 0.03, range: 150, reload: 2.0, auto: true, value: 60 },
};
const AMMO = {
  ammo_pistol: { name: 'Náboje 9 mm', amount: 16, value: 5 },
  ammo_shotgun: { name: 'Broky', amount: 8, value: 6 },
  ammo_rifle: { name: 'Puškové náboje', amount: 15, value: 8 },
};
const WEAPON_GATE = { w_pistol: 0.4, w_sniper: 3, w_smg: 6 };
// jednotná definice pro herní logiku
const ITEM_DEFS = new Proxy({}, { get: (_, t) => {
  if (PARTS[t]) return Object.assign({ cat: 'part', slot: t }, PARTS[t]);
  if (typeof t === 'string' && t.startsWith('w_')) return Object.assign({ cat: 'weapon', id: t.slice(2) }, WEAPONS[t.slice(2)]);
  if (typeof t === 'string' && t.startsWith('c_')) return Object.assign({ cat: 'cosm', kind: t.slice(2) }, COSM[t.slice(2)]);
  if (AMMO[t]) return Object.assign({ cat: 'ammo' }, AMMO[t]);
  return SUPPLIES[t];
} });

const Items = {
  list: [], scene: null,
  init(scene) { this.scene = scene; this.list = []; },

  // parametry motoru podle kvality, konstrukce a přeplňování
  engineSpec(d) {
    const lay = ENGINE_LAY[d.lay] || ENGINE_LAY.i4, ind = d.ind || 0, I = INDUCTION[ind];
    const torque = 150 * lay.tq * ENGINE_TIER_TQ[d.tier];
    return { lay, ind, indTq: I.tq, torque, cons: lay.cons * I.cons * (1 + d.tier * 0.04), heat: lay.heat * I.heat, cyl: lay.cyl,
      hp: Math.round(torque * I.tq * 0.68) };
  },
  rollTier(km, rand, bonus) {
    const w = [Math.max(1, 26 - km * 2.5), 48, 9 + km * 3, Math.max(0.5, km * 1.8 - 2), Math.max(0, km * 0.9 - 4)];
    let t = U.pickWeighted(rand(), w.map((x, i) => [i, x]));
    if (bonus && rand() < bonus) t = Math.min(4, t + 1);
    return t;
  },
  rollEngine(km, rand) {
    return {
      lay: U.pickWeighted(rand(), [['i3', 2.5], ['i4', 4], ['boxer', 1.6], ['i6', 1.3 + km * 0.15], ['v6', 1.1 + km * 0.2], ['v8', 0.6 + km * 0.18]]),
      ind: U.pickWeighted(rand(), [[0, 6], [1, 1.6 + km * 0.35], [2, 1.1 + km * 0.25]]),
    };
  },
  rollLoot(type, km, rand) {
    const tables = {
      house: [['canister', 3], ['oil', 3], ['coolant', 3], ['medkit', 3], ['repairkit', 1.5], ['plugs', 2], ['airfilter', 2.5], ['belt', 1.5], ['tire', 0.8], ['battery', 1], ['fuelpump', 0.8],
        ['engine', 0.6], ['gearbox', 0.3], ['spray', 1.2], ['cosm', 0.6],
        ['w_boxer', 0.6], ['w_bat', 0.7], ['w_machete', 0.5], ['w_pistol', 0.7], ['w_shotgun', 1.0], ['w_sniper', 0.25], ['ammo_pistol', 1.2], ['ammo_shotgun', 1.1], ['ammo_rifle', 0.5]],
      garage: [['engine', 2.6], ['gearbox', 1.6], ['starter', 2], ['alternator', 2], ['plugs', 2], ['carb', 2], ['fuelpump', 2], ['radiator', 1.5], ['belt', 2], ['airfilter', 1.5],
        ['battery', 1.5], ['tire', 2], ['tank', 1], ['repairkit', 2], ['oil', 1.5], ['spray', 1.6], ['cosm', 2.2],
        ['w_machete', 0.5], ['w_shotgun', 0.8], ['w_sniper', 0.35], ['w_smg', 0.25], ['ammo_rifle', 0.8], ['ammo_pistol', 0.8], ['ammo_shotgun', 0.6]],
      pumpa: [['canister', 6], ['oil', 3], ['coolant', 2.5], ['airfilter', 1.5], ['tire', 0.8], ['repairkit', 1], ['belt', 1], ['engine', 0.5], ['spray', 1.8], ['cosm', 1],
        ['ammo_pistol', 1], ['ammo_shotgun', 1], ['w_pistol', 0.4], ['w_shotgun', 0.5]],
      motel: [['medkit', 3], ['canister', 2], ['ammo_pistol', 2], ['ammo_shotgun', 1.4], ['w_pistol', 0.7], ['w_bat', 0.6], ['w_boxer', 0.6], ['w_shotgun', 0.9], ['repairkit', 1.2],
        ['oil', 1], ['plugs', 1], ['airfilter', 1], ['battery', 0.6], ['coolant', 1], ['spray', 0.8], ['cosm', 0.5], ['engine', 0.4]],
      vrakoviste: [['tire', 2.5], ['starter', 1.5], ['alternator', 1.5], ['carb', 1.5], ['fuelpump', 1.5], ['radiator', 1.5], ['battery', 1.5], ['engine', 2.2], ['gearbox', 1.4], ['tank', 1], ['belt', 1],
        ['cosm', 1.4], ['spray', 0.6], ['w_bat', 0.6], ['w_shotgun', 0.4], ['ammo_rifle', 0.6]],
    };
    for (const k in tables) tables[k] = tables[k].filter(([t]) => !(t in WEAPON_GATE) || km >= WEAPON_GATE[t]);
    // víc lootu a lepší šance na kvalitní díly (garáže nejlepší)
    const n = { house: 4 + Math.floor(rand() * 4), garage: 4 + Math.floor(rand() * 3), pumpa: 4 + Math.floor(rand() * 2), motel: 4 + Math.floor(rand() * 3), vrakoviste: 4 + Math.floor(rand() * 3) }[type] || 3;
    const bonus = { house: 0.25, garage: 0.45, pumpa: 0.15, motel: 0.2, vrakoviste: 0 }[type] || 0;
    const out = [];
    for (let i = 0; i < n; i++) out.push(this.rollOne(U.pickWeighted(rand(), tables[type]), km, rand, bonus, type === 'vrakoviste'));
    return out;
  },
  rollOne(type, km, rand, bonus, junk) {
    if (type === 'cosm') {
      const kind = U.pickWeighted(rand(), [['spoiler', 2], ['wing', 1.2], ['scoop', 1.5], ['bullbar', 1.5], ['lightbar', 1.2], ['roofrack', 1.2], ['stripes', 2], ['fenders', 1.3], ['exhaust', 1.5],
        ['rims_chrome', 1.2], ['rims_gold', 0.7], ['rims_black', 1]]);
      return ['c_' + kind, kind === 'stripes' ? { col: SPRAYS[Math.floor(rand() * SPRAYS.length)][1] } : {}];
    }
    if (type === 'spray') return ['spray', { col: Math.floor(rand() * SPRAYS.length) }];
    if (!PARTS[type]) return [type, {}];
    const tier = this.rollTier(km, rand, bonus);
    const cond = junk ? 15 + rand() * 45 : 40 + rand() * 60;
    const d = { tier, cond };
    if (type === 'engine') Object.assign(d, this.rollEngine(km, rand));
    return [type, d];
  },

  // přívlastek kvality ve správném rodě (rezavý motor / rezavá převodovka / rezavé svíčky)
  tierName(t, tier) {
    const g = { gearbox: 'f', battery: 'f', tank: 'f', tire: 'f', plugs: 'n', fuelpump: 'n' }[t];
    const n = TIERS[tier].name;
    return g === 'f' ? n.replace(/ý$/, 'á') : g === 'n' ? n.replace(/ý$/, 'é') : n;
  },
  name(it) {
    const t = it.type, d = it.data, TN = () => this.tierName(t, d.tier);
    if (t === 'engine') { const e = this.engineSpec(d); return `${TIERS[d.tier].name} motor ${e.lay.n}${INDUCTION[e.ind].n ? ' ' + INDUCTION[e.ind].n : ''} (${e.hp} koní)`; }
    if (t === 'gearbox') return `${TN()} převodovka ${GEARBOXES[d.tier].n}`;
    if (t === 'tank') return `${TN()} nádrž ${PARTS.tank.stat[d.tier]} l`;
    if (t === 'tire') return `${TN()} sada kol (4×)`;
    if (PARTS[t]) return `${TN()} ${PARTS[t].name.toLowerCase()}`;
    if (t.startsWith('w_')) return WEAPONS[t.slice(2)].name;
    if (t.startsWith('c_')) return COSM[t.slice(2)].name;
    if (t === 'spray') return `Sprej: ${SPRAYS[d.col][0]}`;
    if (AMMO[t]) return AMMO[t].name;
    return SUPPLIES[t].name;
  },
  label(it) {
    const d = it.data, n = this.name(it);
    if (AMMO[it.type]) return `${n} (${d.amount} ks)`;
    if (SUPPLIES[it.type] && SUPPLIES[it.type].cat === 'fluid') return `${n} (${d.amount.toFixed(1)} ${SUPPLIES[it.type].unit})`;
    if (it.type === 'tank') return n;
    if (PARTS[it.type]) return `${n} · stav ${Math.round(d.cond)} %${it.type === 'battery' ? ` · nabito ${Math.round(d.charge)} %` : ''}`;
    return n;
  },
  color(it) {
    if (PARTS[it.type]) return TIERS[it.data.tier].color;
    if (it.type.startsWith('w_')) return '#ff8a5a';
    if (it.type.startsWith('c_')) return '#7af0ff';
    if (it.type === 'spray') return '#' + SPRAYS[it.data.col][1].toString(16).padStart(6, '0');
    return AMMO[it.type] ? '#e8d070' : '#ffd28a';
  },
  value(it) {
    if (it.type.startsWith('w_')) return WEAPONS[it.type.slice(2)].value;
    if (it.type.startsWith('c_')) return COSM[it.type.slice(2)].value;
    if (AMMO[it.type]) return Math.max(1, Math.round(AMMO[it.type].value * it.data.amount / AMMO[it.type].amount));
    if (SUPPLIES[it.type]) return Math.round(SUPPLIES[it.type].value * (it.data.amount !== undefined ? it.data.amount / SUPPLIES[it.type].amount : 1));
    const p = PARTS[it.type], t = it.data.tier;
    let v = p.base * (1 + t * 0.8 + t * t * 0.5) * (it.type === 'tank' ? 1 : 0.3 + 0.7 * it.data.cond / 100);
    if (it.type === 'engine') { const e = this.engineSpec(it.data); v *= e.lay.tq * (e.ind ? 1.35 : 1); }
    return Math.round(v);
  },
  defaults(type, data) {
    const d = Object.assign({}, data || {});
    if (PARTS[type]) { if (d.tier === undefined) d.tier = 1; if (d.cond === undefined) d.cond = 100; }
    if (type === 'engine') { if (!d.lay) d.lay = 'i4'; if (d.ind === undefined) d.ind = 0; }
    if (type === 'battery' && d.charge === undefined) d.charge = 60 + Math.random() * 40;
    if (type === 'spray' && d.col === undefined) d.col = Math.floor(Math.random() * SPRAYS.length);
    if (type === 'c_stripes' && d.col === undefined) d.col = 0xf0f0f0;
    if (SUPPLIES[type] && SUPPLIES[type].cat === 'fluid' && d.amount === undefined) d.amount = SUPPLIES[type].amount;
    if (AMMO[type] && d.amount === undefined) d.amount = AMMO[type].amount;
    return d;
  },

  // ---------- modely ----------
  // motor: tvar podle konstrukce (řadový / boxer / V), přeplňování (turbo / kompresor), kvalita = barva víka ventilů
  engineMesh(g, data, box, cyl) {
    const e = this.engineSpec(data), L = e.lay, tier = data.tier, rust = tier === 0;
    const top = [0x6a5a4a, 0x8a8f94, 0x3f8a4a, 0x2f5fa8, 0xc0302a][tier], blockC = rust ? 0x5a4a3e : tier >= 3 ? 0x5a5e62 : 0x4a4d50;
    const len = L.len, half = len / 2;
    const lay = data.lay || 'i4';
    box(L.w * 0.75, 0.1, len * 0.9, 0, 0.05, 0, 0x2a2a2a);                                      // olejová vana
    if (lay === 'boxer') {
      box(0.3, 0.26, len, 0, 0.22, 0, blockC);                                                    // kliková skříň
      for (const s of [-1, 1]) {
        box(0.2, 0.2, len * 0.92, s * 0.25, 0.24, 0, blockC);                                     // válce do stran
        box(0.08, 0.24, len * 0.88, s * 0.38, 0.24, 0, 0x5a5d60);                                 // hlavy
        box(0.04, 0.2, len * 0.8, s * 0.43, 0.24, 0, top);                                        // víka ventilů
        for (let i = 0; i < 2; i++) box(0.04, 0.03, 0.03, s * 0.46, 0.3, -half * 0.5 + i * half, 0xbdbdb0);
      }
      box(0.22, 0.1, len * 0.7, 0, 0.42, 0, 0x9a9a92);                                            // sání nahoře
    } else if (lay === 'v6' || lay === 'v8') {
      box(L.w * 0.7, 0.3, len, 0, 0.25, 0, blockC);
      const n = L.cyl / 2;
      for (const s of [-1, 1]) {
        box(0.22, 0.1, len * 0.94, s * 0.17, 0.46, 0, 0x5a5d60, 0, 0, s * 0.5);
        box(0.18, 0.06, len * 0.88, s * 0.2, 0.52, 0, tier >= 3 ? 0xd8d8d0 : top, 0, 0, s * 0.5);
        for (let i = 0; i < n; i++) cyl(0.014, 0.08, s * 0.29, 0.5, -half * 0.75 + i * len * 0.75 / (n - 1), 0x202020, 0, s * 1.1, 6);
      }
      box(0.16, 0.12, len * 0.8, 0, 0.53, 0, 0x9a9a92);                                          // sací potrubí mezi hlavami
    } else {
      box(L.w, 0.3, len, 0, 0.25, 0, blockC);
      box(L.w * 0.93, 0.1, len * 0.97, 0, 0.45, 0, 0x5a5d60);
      box(L.w * 0.8, 0.07, len * 0.9, 0, 0.535, 0, top);
      for (let i = 0; i < L.cyl; i++) box(0.05, 0.02, 0.02, 0, 0.575, -half * 0.8 + i * len * 0.8 / (L.cyl - 1), 0xbdbdb0);
      box(0.07, 0.12, len * 0.75, -L.w / 2 - 0.04, 0.42, 0, 0x9a9a92);                           // sání
      box(0.07, 0.09, len * 0.75, L.w / 2 + 0.04, 0.36, 0, 0x7a4a2a);                            // výfukové svody
    }
    box(0.3, 0.3, 0.04, 0, 0.3, half + 0.02, 0x3a3a3a);                                         // rozvody
    cyl(0.08, 0.04, 0, 0.18, half + 0.06, 0x1a1a1a, Math.PI / 2);                                // řemenice
    cyl(0.03, 0.08, 0.1, lay === 'boxer' ? 0.38 : 0.6, -half * 0.5, 0xe0b020);                   // zátka oleje
    if (e.ind === 1) {                                                                           // turbo: šnek na výfukové straně + trubka k sání
      const tx = lay === 'boxer' ? 0.42 : L.w / 2 + 0.12;
      const sn = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.045, 6, 12), U.mat(0xb8b0a0)); sn.position.set(tx, 0.4, half * 0.3); sn.rotation.y = Math.PI / 2; g.add(sn);
      cyl(0.06, 0.08, tx, 0.4, half * 0.3, 0x8a5a3a, 0, Math.PI / 2, 10);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, len * 0.8, 8), U.mat(0xc8c8c8)); p.rotation.x = Math.PI / 2; p.position.set(tx * 0.7, 0.55, -half * 0.1); g.add(p);
      cyl(0.025, 0.05, tx * 0.7, 0.62, half * 0.25, 0x2a6ac0);                                    // přepouštěcí ventil
    } else if (e.ind === 2) {                                                                    // kompresor: blower nahoře s žebry a řemenicí
      box(0.2, 0.14, len * 0.6, 0.08, 0.66, 0, 0xc8c8c0);
      for (let i = 0; i < 5; i++) box(0.22, 0.015, 0.02, 0.08, 0.72, -len * 0.25 + i * len * 0.125, 0x9a9a92);
      cyl(0.06, 0.03, 0.08, 0.66, len * 0.3 + 0.02, 0x1a1a1a, Math.PI / 2);
      box(0.012, 0.36, 0.02, 0.08, 0.45, len * 0.3 + 0.04, 0x151515);                             // řemen kompresoru
    }
  },
  makeMesh(type, data, inBay) {
    const g = new THREE.Group(), tier = data && data.tier !== undefined ? data.tier : 1, tc = TIERS[tier].hex;
    const add = (geo, col, x, y, z, rx, ry, rz) => { const m = new THREE.Mesh(geo, U.mat(col)); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); m.castShadow = true; g.add(m); return m; };
    const box = (w, h, d, x, y, z, col, rx, ry, rz) => add(new THREE.BoxGeometry(w, h, d), col, x, y, z, rx, ry, rz);
    const cyl = (r, h, x, y, z, col, rx, rz, seg) => add(new THREE.CylinderGeometry(r, r, h, seg || 8), col, x, y, z, rx, 0, rz);
    const rust = tier === 0;
    switch (type) {
      case 'engine': this.engineMesh(g, Object.assign({ lay: 'i4', ind: 0 }, data, { tier }), box, cyl); break;
      case 'gearbox': {
        const al = rust ? 0x7a6a58 : 0xa8aaa6;
        add(new THREE.CylinderGeometry(0.17, 0.11, 0.16, 10), al, 0, 0.17, 0.12, Math.PI / 2);   // zvon spojky
        box(0.2, 0.2, 0.24, 0, 0.14, -0.06, al);                                                  // skříň
        cyl(0.03, 0.12, 0, 0.12, -0.23, 0x3a3a3a, Math.PI / 2);                                   // výstupní hřídel
        box(0.21, 0.03, 0.18, 0, 0.255, -0.06, tc);                                               // víko = kvalita
        cyl(0.012, 0.1, 0.03, 0.31, -0.08, 0x222222);                                             // řadicí tyč
        for (let i = 0; i < 3; i++) box(0.205, 0.01, 0.01, 0, 0.08 + i * 0.05, -0.06, 0x7a7a74);  // žebrování
        break;
      }
      case 'battery':
        box(0.32, 0.22, 0.18, 0, 0.11, 0, 0x1d1d1d);
        box(0.32, 0.03, 0.18, 0, 0.235, 0, tc);
        cyl(0.025, 0.05, -0.1, 0.27, 0, 0xc0392b); cyl(0.025, 0.05, 0.1, 0.27, 0, 0x333333);
        break;
      case 'starter':
        cyl(0.065, 0.22, 0, 0.07, 0, rust ? 0x5a4a3e : 0x3a3d40, Math.PI / 2);
        cyl(0.035, 0.14, 0, 0.14, 0.02, tc, Math.PI / 2);
        cyl(0.03, 0.04, 0, 0.07, 0.13, 0xb8a060, Math.PI / 2);
        break;
      case 'alternator':
        cyl(0.09, 0.12, 0, 0.09, 0, rust ? 0x7a6a5a : 0xb0b0a8, Math.PI / 2, 0, 10);
        cyl(0.092, 0.02, 0, 0.09, 0.0, tc, Math.PI / 2, 0, 10);
        cyl(0.045, 0.03, 0, 0.09, 0.08, 0x1a1a1a, Math.PI / 2);
        break;
      case 'plugs':
        for (let i = 0; i < 4; i++) {
          const x = -0.09 + i * 0.06;
          cyl(0.013, 0.05, x, 0.025, 0, 0x8a8a8a, 0, 0, 6);
          cyl(0.011, 0.05, x, 0.07, 0, 0xf2efe6, 0, 0, 6);
          cyl(0.008, 0.03, x, 0.11, 0, tc, 0, 0, 6);
        }
        break;
      case 'carb':
        box(0.13, 0.08, 0.13, 0, 0.04, 0, rust ? 0x6a5a48 : 0x9a968a);
        cyl(0.04, 0.03, 0, 0.095, 0, tc);
        box(0.03, 0.04, 0.06, 0.08, 0.04, 0, 0x555555);
        break;
      case 'airfilter':
        cyl(0.14, 0.05, 0, 0.025, 0, tier >= 2 ? tc : rust ? 0x3a3530 : 0x2a2a2a, 0, 0, 14);
        cyl(0.03, 0.02, 0, 0.06, 0, 0xc0c0b8);
        break;
      case 'fuelpump':
        cyl(0.04, 0.12, 0, 0.06, 0, rust ? 0x6a5a48 : 0x4a4a4a);
        cyl(0.012, 0.05, 0.045, 0.08, 0, tc, 0, Math.PI / 2); cyl(0.012, 0.05, -0.045, 0.04, 0, tc, 0, Math.PI / 2);
        break;
      case 'radiator':
        box(0.7, 0.48, 0.06, 0, 0.27, 0, rust ? 0x6a5a48 : 0xa0a6aa);
        for (let i = -3; i <= 3; i++) box(0.02, 0.44, 0.07, i * 0.09, 0.27, 0, 0x4a4f53);
        box(0.72, 0.04, 0.08, 0, 0.52, 0, tc); box(0.72, 0.04, 0.08, 0, 0.03, 0, tc);
        break;
      case 'belt': {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 5, 18), U.mat(tier >= 2 ? 0x2a2a3a : 0x151515));
        if (inBay) t.position.y = 0; else { t.rotation.x = Math.PI / 2; t.position.y = 0.012; }
        g.add(t);
        break;
      }
      case 'tire':                                                                                // sada = 4 kola na sobě
        for (let i = 0; i < 4; i++) {
          cyl(0.33, 0.2, 0, 0.1 + i * 0.205, 0, 0x1c1c1c, 0, 0, 12);
          cyl(0.2, 0.205, 0, 0.1 + i * 0.205, 0, tier === 0 ? 0x6a5a48 : tc, 0, 0, 8);
        }
        break;
      case 'tank':
        box(0.9, 0.3, 0.6, 0, 0.15, 0, 0x2b2d2f); box(0.92, 0.04, 0.62, 0, 0.3, 0, tc); cyl(0.06, 0.1, 0.3, 0.35, 0.15, 0x777777);
        break;
      case 'canister': box(0.34, 0.44, 0.18, 0, 0.22, 0, 0xb8261c); box(0.2, 0.05, 0.05, 0, 0.47, 0, 0x8a1c14); cyl(0.03, 0.08, 0.12, 0.47, 0, 0x222222); break;
      case 'oil': box(0.18, 0.28, 0.1, 0, 0.14, 0, 0xe0b020); cyl(0.03, 0.05, 0.04, 0.31, 0, 0x222222); break;
      case 'coolant': box(0.22, 0.3, 0.14, 0, 0.15, 0, 0x2fa8c8); cyl(0.035, 0.05, 0.05, 0.33, 0, 0xffffff); break;
      case 'repairkit': box(0.46, 0.2, 0.28, 0, 0.1, 0, 0xe0711c); box(0.18, 0.04, 0.04, 0, 0.23, 0, 0x333333); break;
      case 'medkit': box(0.34, 0.24, 0.12, 0, 0.12, 0, 0xf2f2f2); box(0.16, 0.05, 0.125, 0, 0.12, 0, 0xd02a2a); box(0.05, 0.16, 0.125, 0, 0.12, 0, 0xd02a2a); break;
      case 'spray': {
        const col = SPRAYS[data.col][1];
        cyl(0.045, 0.22, 0, 0.11, 0, 0xd0d0d0, 0, 0, 10); cyl(0.046, 0.12, 0, 0.12, 0, col, 0, 0, 10);
        cyl(0.04, 0.05, 0, 0.245, 0, col, 0, 0, 10); cyl(0.012, 0.02, 0, 0.28, 0, 0x222222);
        break;
      }
      case 'ammo_pistol': case 'ammo_shotgun': case 'ammo_rifle':
        box(0.22, 0.1, 0.14, 0, 0.05, 0, type === 'ammo_shotgun' ? 0xa02020 : type === 'ammo_rifle' ? 0x3a5a2a : 0x2a3a5a);
        for (let i = 0; i < 4; i++) cyl(0.012, 0.05, -0.06 + i * 0.04, 0.12, 0, 0xd8b040);
        break;
      default:
        if (type.startsWith('w_')) { const w = this.weaponMesh(type.slice(2)); w.rotation.set(0, Math.PI / 2, Math.PI / 2); w.position.y = 0.04; g.add(w); }
        else if (type.startsWith('c_')) g.add(CarModel.cosmItemMesh(type.slice(2), data));
    }
    return g;
  },
  // modely zbraní (míří do -z, střed rukojeti v počátku) – stejné pro zem i pro ruku
  weaponMesh(id) {
    const g = new THREE.Group();
    const box = (w, h, d, x, y, z, col, rx) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), U.mat(col)); m.position.set(x, y, z); if (rx) m.rotation.x = rx; m.castShadow = true; g.add(m); return m; };
    const cyl = (r1, r2, h, x, y, z, col) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 8), U.mat(col)); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    const steel = 0xb8bcc0, dark = 0x262626, wood = 0x6b4426;
    let muzzle = -0.3;
    switch (id) {
      case 'knife': box(0.03, 0.035, 0.11, 0, 0, 0.02, 0x3a2416); box(0.05, 0.05, 0.015, 0, 0, -0.04, steel); box(0.008, 0.035, 0.17, 0, 0.005, -0.13, 0xdfe3e6); break;
      case 'boxer': box(0.12, 0.035, 0.035, 0, 0.02, -0.03, 0xc8a040); for (let i = 0; i < 4; i++) box(0.022, 0.05, 0.05, -0.045 + i * 0.03, 0.05, -0.03, 0xd8b050); box(0.1, 0.08, 0.1, 0, 0, 0.04, 0xc68a5e); break;
      case 'machete': box(0.03, 0.035, 0.12, 0, 0, 0.03, 0x2a2a2a); box(0.01, 0.055, 0.45, 0, 0.01, -0.25, 0xc8ccd0); break;
      case 'bat': cyl(0.018, 0.045, 0.75, 0, 0, -0.3, 0xb8864a); cyl(0.022, 0.022, 0.05, 0, 0, 0.08, dark); break;
      case 'pistol': box(0.035, 0.05, 0.19, 0, 0.03, -0.06, dark); box(0.03, 0.1, 0.045, 0, -0.03, 0.02, 0x3a3a3a, 0.25); muzzle = -0.16; break;
      case 'shotgun': cyl(0.018, 0.018, 0.62, 0, 0.03, -0.3, dark); cyl(0.016, 0.016, 0.5, 0, 0.0, -0.26, 0x3a3a3a); box(0.04, 0.06, 0.22, 0, 0.0, 0.08, wood); box(0.04, 0.09, 0.2, 0, -0.03, 0.26, wood); muzzle = -0.62; break;
      case 'sniper': cyl(0.013, 0.016, 0.85, 0, 0.03, -0.4, dark); box(0.045, 0.07, 0.3, 0, 0.0, 0.05, 0x4a5a3a); box(0.04, 0.1, 0.25, 0, -0.02, 0.3, 0x4a5a3a);
        cyl(0.028, 0.028, 0.26, 0, 0.1, -0.02, 0x1a1a1a); box(0.02, 0.04, 0.03, 0, 0.065, -0.02, dark); box(0.03, 0.08, 0.03, 0, -0.06, 0.05, dark); muzzle = -0.83; break;
      case 'smg': box(0.045, 0.07, 0.3, 0, 0.02, -0.05, 0x2e2e2e); cyl(0.012, 0.012, 0.2, 0, 0.03, -0.28, dark); box(0.03, 0.14, 0.04, 0, -0.07, -0.08, 0x3a3a2a, -0.25);
        box(0.03, 0.09, 0.04, 0, -0.05, 0.06, 0x3a3a3a, 0.2); box(0.03, 0.05, 0.18, 0, 0.0, 0.2, 0x2e2e2e); muzzle = -0.39; break;
    }
    g.userData.muzzle = new THREE.Vector3(0, 0.03, muzzle);
    return g;
  },
  makeMarker(it) {
    const g = new THREE.Group(), part = !!PARTS[it.type], weap = it.type.startsWith('w_'), cosm = it.type.startsWith('c_');
    const col = part ? TIERS[it.data.tier].hex : weap ? 0xff7a40 : cosm ? 0x7af0ff : it.type === 'spray' ? SPRAYS[it.data.col][1] : AMMO[it.type] ? 0xe8d070 : 0xffd28a;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.38, 0.46, 20), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; g.add(ring);
    if ((part && (it.data.tier >= 2 || it.type === 'engine' || it.type === 'gearbox')) || weap || cosm) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 5, 6, 1, true),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.position.y = 2.5; g.add(beam);
    }
    return g;
  },

  spawn(type, x, y, z, data) {
    const it = { type, def: ITEM_DEFS[type], data: this.defaults(type, data) };
    it.mesh = this.makeMesh(type, it.data, false);
    it.marker = this.makeMarker(it);
    this.place(it, x, y, z);
    this.list.push(it);
    return it;
  },
  place(it, x, y, z) {
    it.mesh.position.set(x, y, z); it.mesh.rotation.set(0, Math.random() * Math.PI * 2, 0); it.mesh.scale.setScalar(1);
    it.marker.position.set(x, y, z);
    this.scene.add(it.mesh); this.scene.add(it.marker);
  },
  take(it) {
    this.scene.remove(it.mesh); this.scene.remove(it.marker);
    const i = this.list.indexOf(it); if (i >= 0) this.list.splice(i, 1);
  },
  putDown(it, x, y, z) { this.place(it, x, y, z); this.list.push(it); },
  // virtuální předmět (kufr, obchod) – bez meshe ve scéně
  make(type, data) {
    const it = { type, def: ITEM_DEFS[type], data: this.defaults(type, data) };
    it.mesh = this.makeMesh(type, it.data, false); it.marker = this.makeMarker(it);
    return it;
  },
  findLook(pos, dir, maxDist) {
    let best = null, bestScore = 1e9;
    const v = new THREE.Vector3();
    for (const it of this.list) {
      v.copy(it.mesh.position); v.y += 0.12; v.sub(pos);
      const d = v.length();
      if (d > maxDist) continue;
      const ang = Math.acos(U.clamp(v.dot(dir) / (d || 1), -1, 1));
      if (ang > 0.4) continue;
      const score = ang * 3 + d * 0.3;
      if (score < bestScore) { bestScore = score; best = it; best._d = d; }
    }
    return best;
  },
};
