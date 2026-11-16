// util.js – matematika, šum, náhoda, slučování geometrie, kolize
const U = {};
U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
U.lerp = (a, b, t) => a + (b - a) * t;
U.smooth = (e0, e1, x) => { const t = U.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
U.wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

U.hash = (x, z, s) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
U.rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
U.vnoise = (x, z, s) => {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = U.hash(xi, zi, s), b = U.hash(xi + 1, zi, s), c = U.hash(xi, zi + 1, s), d = U.hash(xi + 1, zi + 1, s);
  return U.lerp(U.lerp(a, b, u), U.lerp(c, d, u), v) * 2 - 1;
};
U.fbm = (x, z, s, oct) => {
  let f = 1, a = 1, sum = 0, n = 0;
  for (let i = 0; i < oct; i++) { sum += U.vnoise(x * f, z * f, s + i * 17) * a; n += a; f *= 2.03; a *= 0.5; }
  return sum / n;
};
U.pickWeighted = (r, table) => { // table: [[value, weight], ...]
  let tot = 0; for (const t of table) tot += t[1];
  let x = r * tot;
  for (const t of table) { x -= t[1]; if (x <= 0) return t[0]; }
  return table[table.length - 1][0];
};

// --- low-poly materiály a geometrie ---
U.mat = (color, extra) => new THREE.MeshLambertMaterial(Object.assign({ color }, extra || {}));
U.flat = (geo) => { const g = geo.index ? geo.toNonIndexed() : geo; g.computeVertexNormals(); return g; };
U.vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });

// Slučovač: spoustu malých objektů slije do jednoho meshe s barvami ve vrcholech (1 draw call)
// slunce sleduje hráče po celých texelech stínové mapy → stíny na autě a zemi se při pohybu netřepí
U.snapSun = function (sun, eye, dir, dist) {
  const c = sun.shadow.camera, tx = (c.right - c.left) / sun.shadow.mapSize.x;
  const sr = U._sr || (U._sr = new THREE.Vector3()), su = U._su || (U._su = new THREE.Vector3()), d = U._sd || (U._sd = new THREE.Vector3());
  d.copy(dir).normalize(); sr.set(0, 1, 0).cross(d).normalize(); su.copy(d).cross(sr);
  const a = Math.round((eye.x * sr.x + eye.y * sr.y + eye.z * sr.z) / tx) * tx;
  const b = Math.round((eye.x * su.x + eye.y * su.y + eye.z * su.z) / tx) * tx, k = eye.x * d.x + eye.y * d.y + eye.z * d.z;
  sun.target.position.set(sr.x * a + su.x * b + d.x * k, sr.y * a + su.y * b + d.y * k, sr.z * a + su.z * b + d.z * k);
  sun.position.copy(sun.target.position).addScaledVector(d, dist);
};
// plynulý pohyb vzdáleného hráče: poslední zpráva + rychlost (z časových razítek odesílatele) = odhad „teď“,
// a rozdíl mezi tím, co je vidět, a novým odhadem se rozpustí během ~0,1 s → žádné cukání ani skoky, minimální zpoždění
U.NetSmooth = class {
  constructor(keys, angKeys, tau) { this.keys = keys; this.ang = new Set(angKeys || []); this.tau = tau || 0.15; this.d = null; this.vel = {}; this.err = {}; this.cur = {}; }
  age(now) { return U.clamp(now - this.off - this.d.ts, 0, 0.3); }
  pred(k, now) { const v = this.d.v[k]; return typeof v === 'number' ? v + (this.vel[k] || 0) * this.age(now) : undefined; }
  dif(k, a, b) { return this.ang.has(k) ? U.wrapAngle(a - b) : a - b; }
  push(d) {
    const now = performance.now() / 1000, ts = typeof d.ts === 'number' ? d.ts : now, P = this.d;
    if (P && ts <= P.ts) return false;            // stará / zdvojená zpráva
    // co je vidět právě teď (starý odhad + zbytek chyby) – na tohle se navážeme, ať nic neskočí
    const shown = {};
    if (P) for (const k of this.keys) { const pv = this.pred(k, now); if (pv !== undefined) shown[k] = pv + (this.err[k] || 0); }
    const dtS = P ? ts - P.ts : 0;
    for (const k of this.keys) {
      const v = d[k]; if (typeof v !== 'number') continue;
      if (P && typeof P.v[k] === 'number' && dtS > 0.004 && dtS < 0.6) { const nv = this.dif(k, v, P.v[k]) / dtS; this.vel[k] = this.vel[k] === undefined ? nv : this.vel[k] + (nv - this.vel[k]) * 0.6; }
      else if (!P) this.vel[k] = 0;
    }
    // posun hodin odesílatele: nejrychleji doručená zpráva = základ (kolísání zpoždění pak neovlivní odhad polohy)
    const o = now - ts;
    this.off = this.off === undefined || o < this.off ? o : this.off;
    this.d = { ts, v: Object.assign({}, d) };
    for (const k of this.keys) {
      const pv = this.pred(k, now);
      if (pv === undefined || shown[k] === undefined) { this.err[k] = 0; continue; }
      const e = this.dif(k, shown[k], pv);
      this.err[k] = Math.abs(e) > (this.ang.has(k) ? 1.2 : 8) ? 0 : e;   // velký rozdíl = teleport (respawn) → skočit
    }
    return true;
  }
  update(dt) {
    const D = this.d; if (!D) return null;
    const now = performance.now() / 1000, f = Math.exp(-dt / this.tau);
    this.off += dt * 0.002;   // pomalu povolí (kdyby se hodiny rozjely), nejbližší rychlá zpráva ho zase srazí
    for (const k of this.keys) {
      if (typeof D.v[k] !== 'number') continue;
      this.err[k] = (this.err[k] || 0) * f;
      this.cur[k] = this.pred(k, now) + this.err[k];
    }
    return this.cur;
  }
};
U.Merger = class {
  constructor() { this.pos = []; this.col = []; this._v = new THREE.Vector3(); }
  add(geo, matrix, color) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, v = this._v;
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      this.pos.push(v.x, v.y, v.z); this.col.push(c.r, c.g, c.b);
    }
  }
  addBox(w, h, d, x, y, z, ry, color, rx, rz) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')), new THREE.Vector3(w, h, d));
    this.add(U.unitBox, m, color);
  }
  build(mat) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat || U.vcMat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
};
U.unitBox = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
U.compose = (x, y, z, rx, ry, rz, sx, sy, sz) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));

// --- kolize: kruh proti kruhu / otočenému obdélníku ---
// collider: {t:'c', x,z,r} nebo {t:'b', x,z,hw,hd,ry}
U.circleVs = (x, z, r, c) => {
  if (c.t === 'c') {
    const dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz, R = r + c.r;
    if (d2 >= R * R) return null;
    const d = Math.sqrt(d2) || 1e-4;
    return { nx: dx / d, nz: dz / d, depth: R - d };
  }
  const cs = Math.cos(c.ry), sn = Math.sin(c.ry);
  const dx = x - c.x, dz = z - c.z;
  const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
  if (Math.abs(lx) > c.hw + r || Math.abs(lz) > c.hd + r) return null;
  let nlx, nlz, depth;
  if (Math.abs(lx) <= c.hw && Math.abs(lz) <= c.hd) {
    const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz);
    if (px < pz) { nlx = Math.sign(lx) || 1; nlz = 0; depth = px + r; }
    else { nlx = 0; nlz = Math.sign(lz) || 1; depth = pz + r; }
  } else {
    const cx = U.clamp(lx, -c.hw, c.hw), cz = U.clamp(lz, -c.hd, c.hd);
    const ex = lx - cx, ez = lz - cz, d = Math.sqrt(ex * ex + ez * ez);
    if (d >= r) return null;
    nlx = ex / (d || 1e-4); nlz = ez / (d || 1e-4); depth = r - d;
  }
  return { nx: nlx * cs + nlz * sn, nz: -nlx * sn + nlz * cs, depth };
};

// Canvas → textura s textem (cedule apod.)
U.textTexture = (text, w, h, bg, fg, font) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = font || `bold ${Math.floor(h * 0.5)}px Arial`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2);
  return new THREE.CanvasTexture(cv);
};

U.store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* nic */ } },
};
