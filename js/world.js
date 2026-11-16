// world.js – nekonečná silnice, terén, biomy, chunky, kolize
const W_CHUNK = 64, W_SEG = 22, W_STEP = 4, ZONE = 1300, ROAD_HW = 3.5;

const BIOMES = [
  { name: 'Poušť', ground: [0xdcb97c, 0xd2ad6c, 0xe4c58e, 0xcca364], rock: 0xb08a62, amp: 4.5, hill: 7, mount: 30, canyon: 0, curvy: 1.0,
    heat: 1.15, ambient: 38, sky: 0xf2d9a6, storm: 1.0,
    props: [['cactus', 9], ['barrel', 5], ['yucca', 3], ['ocotillo', 2], ['rock', 6], ['pebbles', 8], ['bush', 4], ['flowers', 6], ['drygrass', 10], ['boulder', 0.8], ['bones', 0.5], ['outcrop', 0.5]] },
  { name: 'Kaňon', ground: [0xc06a40, 0xb35e36, 0xcc7a4e, 0xa9552f], rock: 0x8f4528, amp: 3, hill: 6, mount: 55, canyon: 26, curvy: 1.8,
    heat: 1.0, ambient: 33, sky: 0xebb88c, storm: 0.3,
    props: [['rock', 12], ['boulder', 3], ['cactus', 2], ['mesa', 0.5], ['bush', 2], ['hoodoo', 1.2], ['pebbles', 8], ['agave', 3], ['flowers', 3], ['outcrop', 1]] },
  { name: 'Solná pláň', ground: [0xf0ece2, 0xe6e1d4, 0xf7f4ec, 0xddd7c8], rock: 0xa8a29a, amp: 0.5, hill: 2, mount: 20, canyon: 0, curvy: 0.5,
    heat: 1.35, ambient: 44, sky: 0xdfe9f0, storm: 0.7,
    props: [['rock', 1.5], ['saltmound', 10], ['saltplate', 14], ['pebbles', 3], ['bones', 0.3]] },
  { name: 'Step', ground: [0xb8a55c, 0xa5944b, 0xc3b16c, 0x9c8b46], rock: 0x8c8070, amp: 3.5, hill: 9, mount: 32, canyon: 0, curvy: 1.2,
    heat: 0.9, ambient: 28, sky: 0xd9dcb8, storm: 0.8,
    props: [['grass', 30], ['bush', 10], ['deadtree', 4], ['rock', 3], ['flowers', 14], ['joshua', 2], ['log', 1], ['drygrass', 10], ['pebbles', 5], ['yucca', 2]] },
];
BIOMES.forEach(b => { b.gc = b.ground.map(c => new THREE.Color(c)); b.rc = new THREE.Color(b.rock); b.skyC = new THREE.Color(b.sky); });

const World = {
  init(scene, seed) {
    this.scene = scene; this.seed = seed; this.building = null; this.rand = U.rng(seed * 7 + 3);
    this.pts = []; this.ptGrid = new Map();
    this.houses = []; this.houseGrid = new Map(); this.houseQ = [];
    this.obsByChunk = new Map(); this.holeByChunk = new Map();
    this.chunks = new Map(); this.cols = new Map(); this.floors = new Map();
    this.staticCols = []; this.wrecks = [];
    this.zoneCache = [0];
    this._bw = { a: 0, b: 0, t: 0 };
    this.dirtC = new THREE.Color(0x9c8162);
    this.roadBuiltTo = 0;
    this.roadGroup = new THREE.Group(); scene.add(this.roadGroup);
    this.roadMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: Tex.get('asphalt') });
    this.groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: Tex.get('ground') });
    this.gen = { x: 0, z: 0, t: 0, k: 0, tk: 0, seg: 90, s: 0, nextHouse: 380, nextObs: 450, nextTrader: 2600, nextJunk: 1500 };
    this.addRoadPoint();
    this.extendRoad(1800);
    this.buildStart();
    this.update(0, 0, true);
  },

  key(cx, cz) { return (cx + 30000) * 65536 + (cz + 30000); },
  gridPush(map, k, v) { let a = map.get(k); if (!a) map.set(k, a = []); a.push(v); },

  // ---------- biomy ----------
  zoneBiome(i) {
    if (i <= 0) return 0;
    while (this.zoneCache.length <= i) {
      const n = this.zoneCache.length, prev = this.zoneCache[n - 1];
      let b = Math.floor(U.hash(n, 77, this.seed) * 4);
      if (b === prev) b = (b + 1 + Math.floor(U.hash(n, 78, this.seed) * 3)) % 4;
      this.zoneCache.push(b);
    }
    return this.zoneCache[i];
  },
  biomeW(z) {
    const p = -z, zb = Math.round(p / ZONE), bw = this._bw;
    bw.a = this.zoneBiome(zb - 1); bw.b = this.zoneBiome(zb);
    bw.t = U.smooth(zb * ZONE - 90, zb * ZONE + 90, p);
    return bw;
  },
  biomeAt(z) { const bw = this.biomeW(z); return bw.t < 0.5 ? bw.a : bw.b; },
  biome(z) { return BIOMES[this.biomeAt(z)]; },

  // ---------- silnice ----------
  addRoadPoint() {
    const g = this.gen;
    if (this.pts.length) {
      // klikatá silnice: krátké rovinky, esíčka, občas ostrá zatáčka (s výstražnou značkou)
      if (g.seg <= 0) {
        const curvy = BIOMES[this.biomeAt(g.z)].curvy, r = this.rand();
        if (r < 0.14 || g.s < 150) { g.tk = 0; g.seg = 30 + this.rand() * 70; }
        else {
          const sharp = this.rand() < 0.28 + Math.min(0.2, g.s / 50000);
          const R = Math.max(32, (sharp ? 34 + this.rand() * 26 : 60 + this.rand() * 90) / Math.sqrt(Math.max(0.5, curvy)));
          g.dir = this.rand() < 0.7 ? -(g.dir || 1) : (g.dir || 1);                // většinou střídavě = esíčka
          if (g.t > 0.45) g.dir = -1; if (g.t < -0.45) g.dir = 1;
          g.tk = g.dir / R; g.seg = (sharp ? 30 : 45) + this.rand() * 80;
          if (sharp && g.s > 300) g.sign = { dir: g.dir };
        }
      }
      g.seg -= W_STEP;
      let tk = g.tk;
      // silnice nesmí zatočit moc do strany (svět je postavený podél osy -z): předvídáme, kam až dotočí
      const ahead = g.t + g.k * Math.abs(g.k) / 0.0032 * W_STEP / 2;
      if (ahead > 0.95) tk = Math.min(tk, -1 / 80);
      if (ahead < -0.95) tk = Math.max(tk, 1 / 80);
      g.k += U.clamp(tk - g.k, -0.0032, 0.0032);
      g.t += g.k * W_STEP;
      if (Math.abs(g.t) > 1.2) { g.t = Math.sign(g.t) * 1.2; g.k = 0; }
      g.x += Math.sin(g.t) * W_STEP; g.z -= Math.cos(g.t) * W_STEP; g.s += W_STEP;
    }
    const p = { x: g.x, z: g.z, t: g.t, s: g.s, y: this.L(g.x, g.z), i: this.pts.length };
    this.pts.push(p);
    this.gridPush(this.ptGrid, this.key(Math.floor(p.x / 32), Math.floor(p.z / 32)), p.i);
    // obtížnost roste se vzdáleností: baráky řidší, překážek víc
    const km = g.s / 1000;
    // budovy se stavějí se zpožděním 220 m – to už je známá i silnice za nimi, takže se dá ověřit, že nestojí
    // na silnici ani v jiné budově. Mezi dvěma budovami je vždy aspoň 120 m silnice.
    if (g.s >= (g.nextAny || 0)) {
      let t = null;
      if (g.s >= g.nextTrader) { t = 'obchod'; g.nextTrader = g.s + 4000 + this.rand() * 2000; }
      else if (g.s >= g.nextJunk) { t = 'vrakoviste'; g.nextJunk = g.s + 2500 + this.rand() * 1500; }
      else if (g.s >= g.nextHouse) { t = 'any'; g.nextHouse = g.s + 420 + this.rand() * 480 + Math.min(700, km * 22); }
      if (t) { (this.houseQ = this.houseQ || []).push({ p, t }); g.nextAny = g.s + 120; g.nextHouse = Math.max(g.nextHouse, g.s + 150); }
    }
    while (this.houseQ && this.houseQ.length && g.s - this.houseQ[0].p.s > 220) { const q = this.houseQ.shift(); this.placeHouse(q.p, q.t === 'any' ? undefined : q.t); }
    if (this.finishS && !this.finishDone && g.s >= this.finishS) {
      this.finishDone = true;
      this.gridPush(this.obsByChunk, this.key(Math.floor(p.x / W_CHUNK), Math.floor(p.z / W_CHUNK)), { kind: 'finish', x: p.x, z: p.z, t: p.t });
    }
    if (g.sign) {   // výstražná značka před ostrou zatáčkou (vpravo u silnice, čelem k řidiči)
      const nx = Math.cos(p.t), nz = Math.sin(p.t), o = { kind: 'sign', x: p.x + nx * 4.9, z: p.z + nz * 4.9, t: p.t, dir: g.sign.dir };
      this.gridPush(this.obsByChunk, this.key(Math.floor(o.x / W_CHUNK), Math.floor(o.z / W_CHUNK)), o); g.sign = null;
    }
    if (g.s >= g.nextObs) { this.placeObstacle(p); g.nextObs = g.s + (160 + this.rand() * 340) / (1 + km * 0.04); }
  },
  extendRoad(untilP) { while (-this.gen.z < untilP) this.addRoadPoint(); },

  placeHouse(p, forced) {
    const side = this.rand() < 0.5 ? 1 : -1;
    let type = forced;
    if (!type) { const r = this.rand(); type = r < 0.38 ? 'house' : r < 0.6 ? 'garage' : r < 0.8 ? 'pumpa' : 'motel'; }
    const big = { vrakoviste: 16, pumpa: 11, motel: 11, house: 9.5, garage: 8.5, obchod: 7.5 }[type] || 8;
    const nx = Math.cos(p.t), nz = Math.sin(p.t);
    // hledá volné místo: obě strany silnice, postupně dál od ní; jinak se budova vynechá
    let x, z, sd = side, ok = false;
    const off0 = big + 12 + this.rand() * 7;
    for (let k = 0; k < 6 && !ok; k++) {
      sd = k % 2 ? -side : side; const off = off0 + Math.floor(k / 2) * 8;
      x = p.x + nx * sd * off; z = p.z + nz * sd * off;
      ok = this.houseFree(x, z, big);
    }
    if (!ok) return false;
    const ry = Math.atan2(-nx * sd, -nz * sd);
    const h = { type, x, z, ry, y: this.L(x, z), rad: big, km: p.s / 1000,
      loot: type === 'obchod' ? [] : Items.rollLoot(type, p.s / 1000, this.rand), spawned: false };
    this.addHouse(h);
  },
  // je místo volné? (žádná jiná budova ani silnice v okruhu budovy + rezerva)
  houseFree(x, z, rad) {
    const cx = Math.floor(x / W_CHUNK), cz = Math.floor(z / W_CHUNK);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (const h of this.houseGrid.get(this.key(cx + dx, cz + dz)) || []) if (Math.hypot(x - h.x, z - h.z) < rad + h.rad + 8) return false;
    }
    const r = this.nearestRoad(x, z, 2);
    return !r || r.d > rad + ROAD_HW + 5;
  },
  addHouse(h) {
    this.houses.push(h);
    this.gridPush(this.houseGrid, this.key(Math.floor(h.x / W_CHUNK), Math.floor(h.z / W_CHUNK)), h);
  },
  placeObstacle(p) {
    if (p.s < 320) return;
    const nx = Math.cos(p.t), nz = Math.sin(p.t), side = this.rand() < 0.5 ? 1 : -1;
    const kind = U.pickWeighted(this.rand(), [['rock', 3], ['pole', 2], ['hole', 3], ['wreck', 2]]);
    const lat = side * (1.2 + this.rand() * 1.4);
    const ck = (x, z) => this.key(Math.floor(x / W_CHUNK), Math.floor(z / W_CHUNK));
    if (kind === 'hole') {
      const n = 2 + Math.floor(this.rand() * 4);
      for (let i = 0; i < n; i++) {
        const q = this.pts[Math.max(0, p.i - Math.floor(this.rand() * 5))];
        const l = (this.rand() * 2 - 1) * 2.6;
        const x = q.x + Math.cos(q.t) * l, z = q.z + Math.sin(q.t) * l;
        this.gridPush(this.holeByChunk, ck(x, z), { x, z, r: 0.5 + this.rand() * 0.5, y: this.L(x, z) });
      }
      return;
    }
    const o = { kind, x: p.x + nx * lat, z: p.z + nz * lat, y: p.y, t: p.t, side, r: 0.7 + this.rand() * 0.5 };
    if (kind === 'pole') { o.x = p.x + nx * side * 1.9; o.z = p.z + nz * side * 1.9; o.ry = -p.t + (this.rand() - 0.5) * 0.4; }
    if (kind === 'wreck') {
      o.ry = Math.atan2(Math.sin(p.t), -Math.cos(p.t)) + (this.rand() - 0.5) * 1.2;
      o.x = p.x + nx * side * 2.6; o.z = p.z + nz * side * 2.6;
      o.loot = this.rand() < 0.65 ? [U.pickWeighted(this.rand(), [['canister', 3], ['oil', 2], ['coolant', 2], ['repairkit', 1]]), {}] : null;
      o.spawned = false; o.km = p.s / 1000; o.dismantled = false;
      this.wrecks.push(o);
    }
    this.gridPush(this.obsByChunk, ck(o.x, o.z), o);
  },

  // nejbližší bod silnice: {d, i, s}
  nearestRoad(x, z, R) {
    R = R === undefined ? 2 : R;
    const cx = Math.floor(x / 32), cz = Math.floor(z / 32);
    let best = -1, bd = 1e18;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const arr = this.ptGrid.get(this.key(cx + dx, cz + dz));
      if (!arr) continue;
      for (let k = 0; k < arr.length; k++) {
        const p = this.pts[arr[k]], ex = x - p.x, ez = z - p.z, d = ex * ex + ez * ez;
        if (d < bd) { bd = d; best = arr[k]; }
      }
    }
    if (best < 0) return null;
    const res = { d: Math.sqrt(bd), i: best, s: this.pts[best].s };
    for (let j = best - 1; j <= best; j++) {
      if (j < 0 || j + 1 >= this.pts.length) continue;
      const a = this.pts[j], b = this.pts[j + 1], abx = b.x - a.x, abz = b.z - a.z;
      const tt = U.clamp(((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz), 0, 1);
      const px = a.x + abx * tt - x, pz = a.z + abz * tt - z, d = Math.sqrt(px * px + pz * pz);
      if (d < res.d) { res.d = d; res.i = j; res.s = a.s + tt * W_STEP; }
    }
    return res;
  },

  // ---------- výška terénu ----------
  // mírně zvlněná krajina + občas velký kopec, přes který vede silnice
  L(x, z) {
    const big = U.smooth(0, 0.6, U.fbm(x / 700, z / 700, this.seed + 31, 2));
    return 6 * U.fbm(x / 450, z / 450, this.seed + 1, 2) + 2 * U.fbm(x / 170, z / 170, this.seed + 2, 2) + 30 * big;
  },
  // přibližná boční vzdálenost od silnice (silnice vede pořád k -z, takže z je monotónní) – plynulá i daleko od ní
  roadLat(x, z) {
    const P = this.pts; if (!P.length) return 999;
    if (z >= P[0].z) return Math.hypot(x - P[0].x, z - P[0].z);
    let lo = 0, hi = P.length - 1;
    if (z <= P[hi].z) return 999;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (P[m].z >= z) lo = m; else hi = m; }
    const a = P[lo], b = P[hi], t = (a.z - z) / (a.z - b.z || 1);
    return Math.abs(x - (a.x + (b.x - a.x) * t)) * Math.cos(a.t + (b.t - a.t) * t);
  },
  clearDist(x, z) {
    const r = this.nearestRoad(x, z, 2);
    let d = r ? r.d : 999;
    this._house = null; this._houseE = 999;
    const cx = Math.floor(x / W_CHUNK), cz = Math.floor(z / W_CHUNK);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const arr = this.houseGrid.get(this.key(cx + dx, cz + dz));
      if (!arr) continue;
      for (const h of arr) { const e = Math.hypot(x - h.x, z - h.z) - h.rad; if (e < this._houseE) { this._houseE = e; this._house = h; } if (e < d) d = e; }
    }
    return d;
  },
  height(x, z) {
    const L = this.L(x, z), d = this.clearDist(x, z);
    this._lastD = d;
    // pozemek kolem domu je srovnaný na výšku domu
    const base = this._house && this._houseE < 9 ? U.lerp(this._house.y, L, U.smooth(0, 9, Math.max(0, this._houseE))) : L;
    if (d < 6) return base;
    const bw = this.biomeW(z), A = BIOMES[bw.a], B = BIOMES[bw.b], t = bw.t;
    const amp = U.lerp(A.amp, B.amp, t), can = U.lerp(A.canyon, B.canyon, t), hill = U.lerp(A.hill, B.hill, t), mount = U.lerp(A.mount, B.mount, t);
    const f = U.smooth(6, 30, d), lat = Math.min(d, this.roadLat(x, z));
    let h = base + U.fbm(x / 48, z / 48, this.seed + 5, 3) * amp * f + U.vnoise(x / 9, z / 9, this.seed + 3) * 0.35 * f + U.vnoise(x / 3.5, z / 3.5, this.seed + 4) * 0.12 * f;
    h += hill * U.fbm(x / 130, z / 130, this.seed + 11, 3) * U.smooth(12, 70, lat) * f;          // kopce
    const fr = U.fbm(x / 380, z / 380, this.seed + 21, 3), rn = 1.1 - Math.sqrt(fr * fr + 0.012);                            // vzdálené hřebeny
    h += mount * rn * rn * U.smooth(120, 380, lat);
    if (can > 0) h += U.smooth(22, 85, lat) * can * (0.75 + 0.35 * U.vnoise(x / 30, z / 30, this.seed + 9));
    return h;
  },
  // výška pro chodce (podlahy domů)
  groundAt(x, z) {
    let h = this.height(x, z);
    const arr = this.floors.get(this.key(Math.floor(x / W_CHUNK), Math.floor(z / W_CHUNK)));
    const check = (list) => { if (list) for (const f of list) { const c = U.circleVs(x, z, 0.01, f); if (c && f.y > h) h = f.y; } };
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++)
      check(this.floors.get(this.key(Math.floor(x / W_CHUNK) + dx, Math.floor(z / W_CHUNK) + dz)));
    return h;
  },
  forCols(x, z, fn) {
    const cx = Math.floor(x / W_CHUNK), cz = Math.floor(z / W_CHUNK);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const arr = this.cols.get(this.key(cx + dx, cz + dz));
      if (arr) for (let i = 0; i < arr.length; i++) fn(arr[i]);
    }
    for (let i = 0; i < this.staticCols.length; i++) fn(this.staticCols[i]);
  },
  holesNear(x, z) { return this.holeByChunk.get(this.key(Math.floor(x / W_CHUNK), Math.floor(z / W_CHUNK))); },
  skyColor(z, out) { const bw = this.biomeW(z); return out.copy(BIOMES[bw.a].skyC).lerp(BIOMES[bw.b].skyC, bw.t); },
  progress(x, z) { const r = this.nearestRoad(x, z, 3); return r ? { s: r.s, d: r.d } : null; },

  // ---------- start: stodola a statek ----------
  buildStart() {
    // všechny díly auta jsou ve stodole; v domě vedle je brokovnice, lékárnička a něco na vylepšení; s "Lepší start" jsou díly kvalitnější
    const good = Perks.has('lepsistart'), r = this.rand;
    const P = (type, lo, hi) => [type, { tier: good ? 1 + (r() < 0.3 ? 1 : 0) : (r() < 0.6 ? 0 : 1), cond: lo + r() * (hi - lo) }];
    this.addHouse({ type: 'barn', x: 0, z: 15, ry: Math.PI, y: this.L(0, 15), rad: 9, spawned: false,
      loot: [['engine', { tier: good ? 2 : 1, cond: 75, lay: ['i4', 'i4', 'boxer'][Math.floor(r() * 3)], ind: 0 }], P('gearbox', 55, 80), P('battery', 60, 80), P('starter', 50, 75),
        P('carb', 55, 85), P('radiator', 55, 80), P('alternator', 45, 70), P('plugs', 40, 70), P('fuelpump', 50, 75), P('belt', 45, 70), P('airfilter', 35, 60),
        ['canister', {}], ['oil', {}], ['coolant', {}]] });
    this.addHouse({ type: 'house', x: -21, z: 19, ry: Math.PI, y: this.L(-21, 19), rad: 9.5, spawned: false,
      loot: [['medkit', {}], ['w_shotgun', {}], ['ammo_shotgun', {}], Items.rollOne('spray', 0, r), Items.rollOne('cosm', 0, r), ['canister', {}]] });
    this.buildDriveway();
  },
  // ujetá hliněná cesta od vrat stodoly, která se nenápadně rozpadá do asfaltu.
  // Tvar, okraje i fleky písku na silnici se počítají v shaderu ze světové pozice → ostré v každé vzdálenosti.
  buildDriveway() {
    const Z0 = 9.4, Z1 = -42, W = 10, len = Z0 - Z1;
    const geo = new THREE.PlaneGeometry(W, len, 24, 130); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, (Z0 + Z1) / 2);
    const pa = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i), z = pa.getZ(i);
      pa.setY(i, Math.max(this.height(x, z), this.L(x, z) + 0.05) + 0.09);
      uv.setXY(i, x / 5, z / 5);                 // stejné mapování jako terén → zrno textury navazuje
    }
    geo.computeVertexNormals();
    const col = this.dirtC.clone().multiplyScalar(1.06);
    const mat = new THREE.MeshLambertMaterial({ map: Tex.get('ground'), color: col, transparent: true, depthWrite: false });
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying vec3 vWP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = `varying vec3 vWP;
float dwH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dwN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(dwH(i), dwH(i + vec2(1.0, 0.0)), f.x), mix(dwH(i + vec2(0.0, 1.0)), dwH(i + vec2(1.0, 1.0)), f.x), f.y); }
float dwF(vec2 p) { return dwN(p) * 0.5 + dwN(p * 2.07 + 3.1) * 0.25 + dwN(p * 4.13 + 7.7) * 0.125 + dwN(p * 8.31 + 1.3) * 0.0625; }
` + sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  {
    vec2 p = vWP.xz; float ax = abs(p.x), z = p.y;
    // příjezdová cesta: u vrat úzká, k silnici se rozšiřuje; okraje roztřepené
    float hw = mix(2.6, 3.7, smoothstep(${Z0.toFixed(1)}, -1.0, z));
    float edge = (dwF(vec2(z * 0.55, p.x > 0.0 ? 3.0 : 9.0)) - 0.47) * 1.3 + (dwN(p * 3.1) - 0.5) * 0.35;
    float drive = smoothstep(-0.15, 0.75, hw + edge - ax) * smoothstep(${Z0.toFixed(1)}, ${(Z0 - 1.2).toFixed(1)}, z);
    // na asfaltu: navátý písek – fleky řídnou se vzdáleností, déle vydrží u krajnic
    float onRoad = 1.0 - smoothstep(-0.5, 0.5, z);
    float far = -z;
    float sPat = dwF(p * 0.42 + 11.0) * 0.75 + dwN(p * 2.3) * 0.25;
    float centre = (1.0 - smoothstep(0.0, 13.0, far)) * 1.15;
    float verge = smoothstep(2.0, 3.6, ax) * (1.0 - smoothstep(4.0, 38.0, far)) * 0.95;
    float sand = smoothstep(0.0, 0.32, max(centre, verge) - (1.0 - sPat));
    float a = mix(drive, sand * smoothstep(-0.2, 0.6, hw + 0.4 + edge - ax), onRoad);
    // vyjeté koleje: o něco tmavší a hladší pruhy
    float tr = (1.0 - smoothstep(0.08, 0.32, abs(ax - 0.8 + (dwN(vec2(z * 0.4, 1.0)) - 0.5) * 0.12))) * (1.0 - smoothstep(-2.0, 6.0, far));
    float grain = 0.9 + 0.2 * dwN(p * 6.0) - 0.08 * smoothstep(0.55, 0.8, dwN(p * 1.3 + 5.0));
    diffuseColor.rgb *= grain * (1.0 - 0.13 * tr);
    diffuseColor.a *= clamp(a, 0.0, 1.0) * mix(0.93, 0.85, onRoad);
  }`);
    };
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true; m.renderOrder = 1;
    this.roadGroup.add(m);
    // drobné kamínky podél okrajů (barvou jako okolí)
    const rnd = U.rng(this.seed + 77), stoneGeo = new THREE.DodecahedronGeometry(0.06, 0), stoneMat = U.mat(0x9d8c74);
    for (let i = 0; i < 18; i++) {
      const z = U.lerp(Z0 - 0.8, -1, rnd()), side = rnd() < 0.5 ? -1 : 1, x = side * U.lerp(2.7, 4.0, rnd());
      const st = new THREE.Mesh(stoneGeo, stoneMat); st.scale.set(0.7 + rnd(), 0.4 + rnd() * 0.4, 0.7 + rnd());
      st.position.set(x, this.height(x, z) + 0.02, z); st.rotation.y = rnd() * 6; this.roadGroup.add(st);
    }
  },

  // ---------- mesh silnice ----------
  buildRoadPiece(i0, i1) {
    const LAT = [-3.6, -3.35, -0.1, 0.1, 3.35, 3.6];
    const pos = [], col = [], uv = [], c = new THREE.Color();
    const white = new THREE.Color(0xd9d3c2), yellow = new THREE.Color(0xd8b232);
    const vert = (p, l) => { const x = p.x + Math.cos(p.t) * l, z = p.z + Math.sin(p.t) * l; return [x, this.L(x, z) + 0.05, z]; };
    for (let i = i0; i < i1; i++) {
      const a = this.pts[i], b = this.pts[i + 1];
      const shade = 0.85 + U.hash(i, 3, this.seed) * 0.3;
      for (let k = 0; k < 5; k++) {
        if (k === 0 || k === 4) c.copy(white).multiplyScalar(0.9);
        else if (k === 2) c.copy(((i >> 1) & 1) ? yellow : new THREE.Color(0x3b3936).multiplyScalar(shade));
        else c.setHex(0x3b3936).multiplyScalar(shade);
        const a0 = vert(a, LAT[k]), a1 = vert(a, LAT[k + 1]), b0 = vert(b, LAT[k]), b1 = vert(b, LAT[k + 1]);
        pos.push(...a0, ...a1, ...b0, ...a1, ...b1, ...b0);
        const u0 = (LAT[k] + 3.6) / 3.6, u1 = (LAT[k + 1] + 3.6) / 3.6, va = a.s / 7.2, vb = b.s / 7.2;
        uv.push(u0, va, u1, va, u0, vb, u1, va, u1, vb, u0, vb);
        for (let q = 0; q < 6; q++) col.push(c.r, c.g, c.b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, this.roadMat);
    m.receiveShadow = true;
    this.roadGroup.add(m);
  },

  // ---------- chunky terénu ----------
  // stavba kusu krajiny po částech (generátor) – rozložená do více snímků, aby hra nezasekávala
  buildChunk(cx, cz) { const gen = this.chunkGen(cx, cz); while (!gen.next().done); },
  *chunkGen(cx, cz) {
    const k = this.key(cx, cz), x0 = cx * W_CHUNK, z0 = cz * W_CHUNK, n = W_SEG + 1, st = W_CHUNK / W_SEG;
    const H = new Float32Array(n * n), D = new Float32Array(n * n), Lh = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = x0 + i * st, z = z0 + j * st, id = j * n + i;
      H[id] = this.height(x, z); D[id] = this._lastD; Lh[id] = this.L(x, z);
      if (D[id] < 5.4) H[id] -= 0.16 * (1 - U.smooth(3.9, 5.4, D[id]));
      if (i === n - 1 && j % 6 === 5) yield;
    }
    yield;
    const pos = [], col = [], uv = [], c = new THREE.Color(), tmp = new THREE.Color();
    const tri = (ia, ib, ic, ci, cj, tw) => {
      const ids = [ia, ib, ic];
      let cxs = 0, czs = 0, d = 0, rel = 0;
      for (const id of ids) {
        const i = id % n, j = (id / n) | 0, x = x0 + i * st, z = z0 + j * st;
        pos.push(x, H[id], z); uv.push(x / 5, z / 5); cxs += x; czs += z; d += D[id]; rel += H[id] - Lh[id];
      }
      cxs /= 3; czs /= 3; d /= 3; rel /= 3;
      const bw = this.biomeW(czs), A = BIOMES[bw.a], B = BIOMES[bw.b];
      // plynulé barevné skvrny místo náhodných trojúhelníků
      const nv = (U.fbm(cxs / 30, czs / 30, this.seed + 40, 2) + 1) * 1.5, i0 = U.clamp(Math.floor(nv), 0, 3), i1 = Math.min(3, i0 + 1);
      c.copy(A.gc[i0]).lerp(A.gc[i1], nv - i0).lerp(tmp.copy(B.gc[i0]).lerp(B.gc[i1], nv - i0), bw.t);
      // strmé svahy a vysoké polohy jsou skalnaté
      const k0 = pos.length - 9, e1x = pos[k0 + 3] - pos[k0], e1y = pos[k0 + 4] - pos[k0 + 1], e1z = pos[k0 + 5] - pos[k0 + 2];
      const e2x = pos[k0 + 6] - pos[k0], e2y = pos[k0 + 7] - pos[k0 + 1], e2z = pos[k0 + 8] - pos[k0 + 2];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x, sl = Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1);
      // strmé svahy: textura se promítá ze strany (jinak by byla roztažená)
      if (sl < 0.75) {
        const u0 = uv.length - 6, side = Math.abs(nx) > Math.abs(nz);
        for (let q = 0; q < 3; q++) { const px = pos[k0 + q * 3], py = pos[k0 + q * 3 + 1], pz = pos[k0 + q * 3 + 2]; uv[u0 + q * 2] = (side ? pz : px) / 5; uv[u0 + q * 2 + 1] = py / 5; }
      }
      const rockAmt = Math.max(U.smooth(0.88, 0.62, sl), rel > 3 ? U.smooth(3, 12, rel) * 0.8 : 0);
      if (rockAmt > 0) c.lerp(tmp.copy(A.rc).lerp(B.rc, bw.t).multiplyScalar(0.9 + U.hash(ci, cj, 77) * 0.2), rockAmt);
      if (d < 7) c.lerp(this.dirtC, 0.45 * (1 - U.smooth(3.6, 7, d)) + 0.1);
      c.multiplyScalar((0.94 + U.hash(ci, cj + tw * 31, cx * 131 + cz) * 0.1) * 1.12);
      for (let q = 0; q < 3; q++) col.push(c.r, c.g, c.b);
    };
    for (let j = 0; j < W_SEG; j++) for (let i = 0; i < W_SEG; i++) {
      const a = j * n + i, b = a + 1, cc = a + n, d = cc + 1;
      tri(a, cc, b, i, j, 0); tri(b, cc, d, i, j, 1);
      if (i === W_SEG - 1 && j % 8 === 7) yield;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const group = new THREE.Group();
    const terrain = new THREE.Mesh(g, this.groundMat);
    terrain.receiveShadow = true;
    group.add(terrain);
    const cols = [], floors = [];
    yield;
    yield* Props.populateChunk(this, cx, cz, group, cols, floors);
    this.cols.set(k, cols); this.floors.set(k, floors);
    this.scene.add(group);
    this.chunks.set(k, { cx, cz, group });
  },
  disposeChunk(k, ch) {
    this.scene.remove(ch.group);
    ch.group.traverse(o => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); if (o.userData.ownMat) o.material.dispose(); });
    this.chunks.delete(k); this.cols.delete(k); this.floors.delete(k);
  },

  update(px, pz, force) {
    this.extendRoad(-pz + 1600);
    while (this.roadBuiltTo + 40 < this.pts.length) { this.buildRoadPiece(this.roadBuiltTo, this.roadBuiltTo + 40); this.roadBuiltTo += 40; }
    const ccx = Math.floor(px / W_CHUNK), ccz = Math.floor(pz / W_CHUNK), R = this.viewR || 6;
    if (!this._offs || this._offsR !== R) {
      this._offsR = R;
      this._offs = [];
      for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) if (dx * dx + dz * dz <= R * R + 1) this._offs.push([dx, dz]);
      this._offs.sort((a, b) => (a[0] * a[0] + a[1] * a[1]) - (b[0] * b[0] + b[1] * b[1]));
    }
    if (force) {
      this.building = null;
      for (const [dx, dz] of this._offs) if (!this.chunks.has(this.key(ccx + dx, ccz + dz))) this.buildChunk(ccx + dx, ccz + dz);
    } else {
      // časový rozpočet ~3 ms na snímek; nejdřív nejbližší kusy
      const t0 = performance.now();
      while (performance.now() - t0 < 3) {
        if (!this.building) {
          let next = null;
          for (const [dx, dz] of this._offs) { if (!this.chunks.has(this.key(ccx + dx, ccz + dz))) { next = [ccx + dx, ccz + dz]; break; } }
          if (!next) break;
          this.building = this.chunkGen(next[0], next[1]);
        }
        if (this.building.next().done) this.building = null;
      }
    }
    for (const [k, ch] of this.chunks) {
      const dx = ch.cx - ccx, dz = ch.cz - ccz;
      if (dx * dx + dz * dz > (R + 2) * (R + 2)) this.disposeChunk(k, ch);
    }
  },
};
