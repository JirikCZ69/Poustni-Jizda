// aircourse.js – letecké tratě: výšková mapa s údolím vyhloubeným podél trati, brány (kruhy a pylony), dráha, stromy, mraky
// Trať = uzavřená křivka (Catmull-Rom) přes kontrolní body [x, z, výška letu]. Terén se kolem ní sníží, takže
// se letí kaňonem / údolím a brány nikdy nejsou zapíchnuté ve skále. Všechny tratě jsou pevné (stejné u všech hráčů).
const AIR_TRACKS = [
  { id: 'jezero', name: 'Jezerní okruh', desc: 'Nízko nad vodou a loukami mezi nafukovacími pylony. Pylony s nápisem VODOROVNĚ prolétni s křídly v rovině.',
    biome: 'lake', scale: 0.75, halfW: 160, wallW: 260, clear: 16, water: 0, gate: 'pylon', gates: 14, laps: 2, sky: 0x9fc8ee, fog: 0xc4d8ea, zenith: 0x3d7ad0,
    pts: [[0, -950, 18], [450, -950, 18], [900, -950, 18], [1200, -550, 22], [1050, -120, 18], [720, 260, 16], [950, 720, 24], [430, 1020, 18], [-180, 820, 18], [-520, 420, 20], [-950, 640, 22], [-1250, 120, 18], [-1250, -500, 16], [-900, -950, 18], [-450, -950, 18]] },
  { id: 'kanon', name: 'Pouštní kaňon', desc: 'Úzký rudý kaňon, stěny 150 metrů. Kdo se moc nakloní, škrtne křídlem o skálu.',
    biome: 'canyon', scale: 0.7, halfW: 62, wallW: 50, clear: 30, water: null, gate: 'ring', gates: 15, laps: 2, sky: 0xa8c8e8, fog: 0xe6d6bc, zenith: 0x3f7fcf,
    pts: [[0, -1200, 40], [450, -1200, 40], [900, -1200, 40], [1200, -700, 44], [950, -250, 48], [1250, 250, 44], [1000, 750, 40], [450, 1050, 46], [-100, 750, 40], [-600, 1050, 44], [-1150, 700, 48], [-950, 100, 42], [-1300, -550, 40], [-900, -1200, 40], [-450, -1200, 40]] },
  { id: 'hory', name: 'Horský průsmyk', desc: 'Údolím mezi zasněženými štíty a přes sedlo ve 400 metrech. Dlouhá trať na jedno kolo, velké výškové rozdíly.',
    biome: 'alpine', scale: 0.8, halfW: 150, wallW: 380, clear: 55, water: 2, gate: 'ring', gates: 16, laps: 1, sky: 0x8ab8e8, fog: 0xc6d6e8, zenith: 0x2a66c4,
    pts: [[0, -1300, 70], [450, -1300, 70], [900, -1300, 70], [1350, -800, 140], [1400, -200, 240], [1000, 400, 360], [1300, 1000, 280], [600, 1300, 190], [0, 900, 150], [-600, 1300, 210], [-1300, 900, 270], [-1100, 200, 200], [-1450, -600, 120], [-900, -1300, 70], [-450, -1300, 70]] },
];

const AirCourse = {
  E: 3000, N: 480,        // terén: čtverec ±E metrů, N×N buněk (12,5 m – dřív 25 m a bylo to „rozpixelované“)
  build(ti) {
    const T = AIR_TRACKS[ti], c = { T, ti };
    // ---- křivka trati ----
    const P = T.pts.map(([x, z, y]) => [x * T.scale, y, z * T.scale]), n = P.length, smp = [];
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      for (let k = 0; k < 30; k++) {
        const t = k / 30, t2 = t * t, t3 = t2 * t, o = [];
        for (let d = 0; d < 3; d++) o.push(0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3));
        smp.push(o);
      }
    }
    // rovnoměrné převzorkování po 8 m
    const raw = smp, cum = [0];
    for (let i = 1; i <= raw.length; i++) { const a = raw[i - 1], b = raw[i % raw.length]; cum.push(cum[i - 1] + Math.hypot(b[0] - a[0], b[2] - a[2])); }
    const L = cum[cum.length - 1], step = 8, M = Math.round(L / step), pts = [];
    let j = 0;
    for (let i = 0; i < M; i++) {
      const s = i * L / M; while (cum[j + 1] < s) j++;
      const a = raw[j], b = raw[(j + 1) % raw.length], t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
      pts.push(new THREE.Vector3(U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t)));
    }
    c.pts = pts; c.L = L; c.M = M; c.ds = L / M;
    // výška letu → dno údolí; vyhlazení výšky, ať trať nemá schody
    c.floor = pts.map(p => p.y - T.clear);
    // ---- terén ----
    const N = this.N, E = this.E, cell = 2 * E / N, H = new Float32Array((N + 1) * (N + 1));
    const coarse = []; for (let i = 0; i < M; i += 6) coarse.push(i);
    const nat = this.natural(T);
    c.rw = this.runway(c);
    const reach = T.halfW + T.wallW + 40;
    for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) {
      const x = -E + ix * cell, z = -E + iz * cell;
      let h = nat(x, z);
      // nejbližší bod trati (hrubě, pak jemně)
      let bi = 0, bd = 1e18, flr = null;
      for (const i of coarse) { const p = pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; bi = i; } }
      if (bd < (reach + 60) ** 2) {
        for (let k = -6; k <= 6; k++) { const i = (bi + k + M) % M, p = pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; bi = i; } }
        const d = Math.sqrt(bd), wob = 1 + 0.25 * U.fbm(x / 140, z / 140, 77, 2);
        const w = 1 - U.smooth(T.halfW * wob, T.halfW * wob + T.wallW, d), fl = c.floor[bi] + U.fbm(x / 60, z / 60, 5, 2) * 2;
        if (h > fl) h = U.lerp(h, fl, w);
        flr = fl;
      }
      // kaňon: vodorovné vrstvy pískovce → stupňovité stěny (terasy jen snižují terén, trať tím nic neztratí)
      if (T.biome === 'canyon') {
        const S = 15, t = h / S, f = Math.floor(t), th = S * (f + U.smooth(0.45, 0.95, t - f));
        h = U.lerp(h, th, 0.6 * (flr === null ? 1 : U.smooth(flr + 8, flr + 24, h)));
      }
      // dráha: zarovnat
      const rw = c.rw, lx = (x - rw.x) * rw.cx + (z - rw.z) * rw.cz, lz = -(x - rw.x) * rw.cz + (z - rw.z) * rw.cx;
      // na straně +lz je letiště (odstavná plocha, hangáry) → širší rovina
      const fw = (1 - (lz > 0 ? U.smooth(rw.hw + 160, rw.hw + 230, lz) : U.smooth(rw.hw + 14, rw.hw + 60, -lz))) * (1 - U.smooth(rw.hl + 40, rw.hl + 140, Math.abs(lx)));
      if (fw > 0) h = U.lerp(h, rw.y, fw);
      H[iz * (N + 1) + ix] = h;
    }
    c.H = H; c.cell = cell;
    c.height = (x, z) => this.height(c, x, z);
    c.normal = (x, z, out) => this.normal(c, x, z, out);
    c.water = T.water;
    c.overWater = (x, z) => T.water !== null && c.height(x, z) < T.water - 0.05;
    // ---- brány ----
    c.gates = [];
    for (let g = 0; g < T.gates; g++) {
      const i = Math.round(g * M / T.gates) % M, p = pts[i], q = pts[(i + 2) % M], q0 = pts[(i - 2 + M) % M];
      const tan = new THREE.Vector3(q.x - q0.x, q.y - q0.y, q.z - q0.z).normalize();
      let type = T.gate;
      if (T.id === 'kanon' && g % 5 === 3) type = 'pylon';
      if (T.id === 'jezero' && g % 4 === 2) type = 'ring';
      if (T.id === 'hory' && g % 6 === 4) type = 'pylon';
      const gh = c.height(p.x, p.z), gnd = Math.max(gh, T.water === null ? -1e9 : T.water);
      const gate = { i, idx: g, s: i * c.ds, type, pos: p.clone(), tan, gnd, level: type === 'pylon' && g % 2 === 1 && T.id === 'jezero' };
      gate.right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      gate.up = new THREE.Vector3().crossVectors(gate.right, tan).normalize();
      if (type === 'ring') { gate.R = 17; gate.pos.y = Math.max(p.y, gnd + 21); }
      else { gate.W = 34; gate.top = gnd + Math.max(26, p.y - gnd + 12); gate.pos.y = (gnd + gate.top) / 2; }
      if (g === 0) { gate.start = true; }
      c.gates.push(gate);
    }
    return c;
  },
  // přírodní terén bez trati
  natural(T) {
    if (T.biome === 'canyon') return (x, z) => {
      const r = Math.hypot(x, z), mesa = U.smooth(0.15, 0.3, U.fbm(x / 500, z / 500, 31, 3)) * 45;
      return 150 + U.fbm(x / 700, z / 700, 11, 4) * 30 + mesa + U.smooth(1900, 2900, r) * 160 + U.fbm(x / 55, z / 55, 61, 2) * 2.5;
    };
    if (T.biome === 'alpine') return (x, z) => {
      const r = Math.hypot(x, z);
      // hřebeny s ubývajícím jemným reliéfem → svahy 25–40° jako ve skutečných Alpách, ne jehly
      let rid = 0, a = 1, f = 1 / 1150;
      for (let o = 0; o < 6; o++) { rid += (1 - Math.abs(U.vnoise(x * f, z * f, 50 + o))) ** 2 * a; a *= 0.4; f *= 2.05; }
      return 210 + rid * 520 + U.smooth(1800, 2900, r) * 300;
    };
    return (x, z) => {   // jezero: louky, jezírka, kopce na obzoru
      const r = Math.hypot(x, z), lake = U.fbm(x / 650, z / 650, 91, 3);
      let h = 6 + U.fbm(x / 300, z / 300, 21, 3) * 10;
      h = U.lerp(h, -9, U.smooth(-0.02, 0.12, -lake) );
      return h + U.smooth(1400, 2700, r) * (180 + U.fbm(x / 400, z / 400, 3, 3) * 120);
    };
  },
  // vzletová dráha podél trati u startu
  runway(c) {
    const p = c.pts[0], q = c.pts[6], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz);
    const cx = dx / l, cz = dz / l, back = 420;
    return { x: p.x - cx * back, z: p.z - cz * back, cx, cz, hw: 15, hl: 420, y: c.floor[0], yaw: Math.atan2(-cx, -cz) };
  },
  // výška přesně podle trojúhelníků sítě terénu
  height(c, x, z) {
    const N = this.N, E = this.E, cell = c.cell;
    let fx = (x + E) / cell, fz = (z + E) / cell;
    fx = U.clamp(fx, 0, N - 1e-4); fz = U.clamp(fz, 0, N - 1e-4);
    const ix = Math.floor(fx), iz = Math.floor(fz), u = fx - ix, v = fz - iz, H = c.H, W = N + 1;
    const h00 = H[iz * W + ix], h10 = H[iz * W + ix + 1], h01 = H[(iz + 1) * W + ix], h11 = H[(iz + 1) * W + ix + 1];
    return u + v < 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
  },
  normal(c, x, z, out) {
    const e = 1.5, hx = this.height(c, x + e, z) - this.height(c, x - e, z), hz = this.height(c, x, z + e) - this.height(c, x, z - e);
    return out.set(-hx, 2 * e, -hz).normalize();
  },
  // nejbližší bod trati (index) k poloze – hledá kolem nápovědy
  nearest(c, x, z, hint) {
    const M = c.M; let bi = hint || 0, bd = 1e18;
    const span = hint === undefined ? M : 60;
    for (let k = -span; k <= span; k += hint === undefined ? 4 : 1) { const i = ((bi + k) % M + M) % M, p = c.pts[i], d = (p.x - x) ** 2 + (p.z - z) ** 2; if (d < bd) { bd = d; bi = i; } }
    return bi;
  },

  // ---------------------------------------------------------------- 3D scéna
  mesh(c, scene) {
    c.obst = new Map(); c.keep = new Map(); c.roadLines = [];
    this.sky(c, scene);
    this.terrainMesh(c, scene);
    const mg = new U.Merger();
    this.airfield(c, scene);
    this.settle(c, scene, mg);
    this.gatesMesh(c, scene);
    this.vegetation(c, mg);
    const props = mg.build(); if (props) { props.receiveShadow = false; scene.add(props); }
    this.clouds(c, scene);
    // ---- čára trati na minimapu ----
    c.minX = Math.min(...c.pts.map(p => p.x)); c.maxX = Math.max(...c.pts.map(p => p.x)); c.minZ = Math.min(...c.pts.map(p => p.z)); c.maxZ = Math.max(...c.pts.map(p => p.z));
  },

  // ---------- pomocné: překážky (do nich se dá narazit) a „zabraná“ místa (aby se věci nepřekrývaly) ----------
  gridAdd(g, x, z, r, top) {
    const x0 = Math.floor((x - r) / 40), x1 = Math.floor((x + r) / 40), z0 = Math.floor((z - r) / 40), z1 = Math.floor((z + r) / 40);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 4096 + j; let a = g.get(k); if (!a) g.set(k, a = []); a.push(x, z, r, top); }
  },
  addObst(c, x, z, r, top) { this.gridAdd(c.obst, x, z, r, top); },
  addKeep(c, x, z, r) { this.gridAdd(c.keep, x, z, r, 0); },
  // je bod (x,y,z) uvnitř nějaké překážky?
  obstAt(c, x, y, z) {
    const a = c.obst && c.obst.get(Math.floor(x / 40) * 4096 + Math.floor(z / 40)); if (!a) return false;
    for (let i = 0; i < a.length; i += 4) { const dx = x - a[i], dz = z - a[i + 1]; if (dx * dx + dz * dz < a[i + 2] * a[i + 2] && y < a[i + 3]) return true; }
    return false;
  },
  kept(c, x, z, m) {
    const a = c.keep.get(Math.floor(x / 40) * 4096 + Math.floor(z / 40)); if (!a) return false;
    for (let i = 0; i < a.length; i += 4) { const dx = x - a[i], dz = z - a[i + 1], r = a[i + 2] + m; if (dx * dx + dz * dz < r * r) return true; }
    return false;
  },
  inAirfield(c, x, z, m) {
    const rw = c.rw, dx = x - rw.x, dz = z - rw.z, al = dx * rw.cx + dz * rw.cz, lat = -dx * rw.cz + dz * rw.cx;
    return Math.abs(al) < rw.hl + 40 + m && lat > -(rw.hw + 25 + m) && lat < rw.hw + 165 + m;
  },
  // místní souřadnice letiště (x napříč, zl podél dráhy) → svět
  afW(c, lx, zl) { const rw = c.rw; return [rw.x - lx * rw.cz - zl * rw.cx, rw.z + lx * rw.cx - zl * rw.cz]; },
  distCourse(c, x, z) { const p = c.pts[this.nearest(c, x, z)]; return Math.hypot(p.x - x, p.z - z); },
  // les: 0..1 – podle toho se barví zem i sází stromy
  forest(c, x, z) {
    const T = c.T; if (T.biome === 'canyon') return 0;
    const f = U.fbm(x / 520, z / 520, 13 + c.ti, 3) + U.fbm(x / 130, z / 130, 17, 2) * 0.22;
    return T.biome === 'alpine' ? U.smooth(-0.12, 0.06, f) : U.smooth(0.08, 0.24, f);
  },
  // políčka u jezera (pruhy polí natočené jako skutečné lány)
  field(x, z) {
    const a = 0.42, u = x * Math.cos(a) - z * Math.sin(a), v = x * Math.sin(a) + z * Math.cos(a);
    const fv = Math.floor(v / 110), fu = Math.floor(u / 170 + U.hash(fv, 0, 9) * 3);
    return [0x74903f, 0x9e8c54, 0x7a6446, 0x62863a, 0xa89e3e, 0x86984f, 0x6e7c3c, 0x928654][Math.floor(U.hash(fu, fv, 5) * 8)];
  },

  // ---------- obloha: přechod od oparu u obzoru do sytě modré nahoře + slunce ----------
  sky(c, scene) {
    const T = c.T, R = 10000, g = new THREE.SphereGeometry(R, 32, 16), p = g.attributes.position, cl = [];
    const zen = new THREE.Color(T.zenith), hor = new THREE.Color(T.fog), tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / R; tmp.copy(hor).lerp(zen, Math.pow(U.clamp(y * 1.4, 0, 1), 0.55)); cl.push(tmp.r, tmp.g, tmp.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10; sky.frustumCulled = false;
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,248,1)'); gr.addColorStop(0.1, 'rgba(255,252,236,1)'); gr.addColorStop(0.16, 'rgba(255,240,205,0.45)'); gr.addColorStop(0.45, 'rgba(255,232,190,0.12)'); gr.addColorStop(1, 'rgba(255,230,180,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    const sun = new THREE.Mesh(new THREE.PlaneGeometry(3200, 3200), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    sun.position.copy(c.sunDir || new THREE.Vector3(0.45, 0.8, 0.35).normalize()).multiplyScalar(R * 0.9); sun.lookAt(0, 0, 0); sun.renderOrder = -9; sky.add(sun);
    scene.add(sky); c.sky = sky;
  },

  // jemná dlaždicová textura (tráva / písek / kamínky) – násobí barvy terénu ve dvou měřítcích, takže zblízka není vidět
  // hladký přechod barev mezi vrcholy a zdálky se neopakuje vzor
  detailTex() {
    if (this._dTex) return this._dTex;
    const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    // dlaždicový šum: periodická hodnotová mřížka ve více oktávách
    const per = (x, y, p, sd) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const h = (a, b) => U.hash(((a % p) + p) % p, ((b % p) + p) % p, sd);
      return U.lerp(U.lerp(h(xi, yi), h(xi + 1, yi), u), U.lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
    };
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let a = 0, b = 0, w = 0, amp = 1;
      // nejhrubší oktáva má 8 buněk na dlaždici (dřív 4 → z výšky byla vidět pravidelná mřížka skvrn)
      let c = 0, wc = 0, ac = 1;
      for (let o = 0; o < 5; o++) { const p = 8 << o, k = p / S; a += per(x * k, y * k, p, 7 + o) * amp; b += per(x * k, y * k, p, 31 + o) * amp; w += amp; amp *= 0.6; }
      for (let o = 0; o < 3; o++) { const p = 32 << o, k = p / S; c += per(x * k, y * k, p, 61 + o) * ac; wc += ac; ac *= 0.6; }   // jemné zrno (dřív bílý šum = moaré)
      const i = (y * S + x) * 4; d[i] = a / w * 255; d[i + 1] = b / w * 255; d[i + 2] = c / wc * 255; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = this._dTex = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  },
  terrainMat(T) {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true }), tex = this.detailTex();
    const k = T.biome === 'canyon' ? [0.68, 0.3, 0.26, 0.08] : T.biome === 'alpine' ? [0.7, 0.32, 0.22, 0.1] : [0.72, 0.3, 0.2, 0.08];
    m.onBeforeCompile = (sh) => {
      sh.uniforms.dTex = { value: tex };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
varying vec3 vWp; varying vec3 vWn; varying float vDst;`).replace('#include <begin_vertex>', `#include <begin_vertex>
vWp = transformed; vWn = objectNormal;`).replace('#include <project_vertex>', `#include <project_vertex>
vDst = -mvPosition.z;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D dTex;
varying vec3 vWp; varying vec3 vWn; varying float vDst;
` + U.NT_GLSL + `
// každá vrstva se čte „bez opakování“ (náhodně posunuté a otočené varianty dlaždice plynule míchané podle šumu)
vec3 dtl(vec2 p) {
  return vec3(texNT(dTex, p / 19.3).r, texNT(dTex, p / 137.0 + 0.37).g, texNT(dTex, p / 4.3).b);
}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 p = vWp.xz;
          // triplanární projekce: strmé stěny se texturují z boku, ne natažené shora
          vec3 n = normalize(vWn), w = pow(abs(n), vec3(4.0)); w /= (w.x + w.y + w.z);
          vec3 d = dtl(p) * w.y;
          if (w.x > 0.02) d += dtl(vWp.zy * vec2(1.0, 1.7) + 31.0) * w.x;
          if (w.z > 0.02) d += dtl(vWp.xy * vec2(1.0, 1.7) + 57.0) * w.z;
          float dA = clamp(0.5 + (d.x - 0.5) * 1.25, 0.0, 1.0), dB = clamp(0.5 + (d.y - 0.5) * 1.25, 0.0, 1.0), dC = d.z;
          // jemné vrstvy do dálky slábnou (zdálky by z nich zbyl jen vzor), velké skvrny zůstávají
          float fN = 1.0 - smoothstep(150.0, 900.0, vDst), fC = 1.0 - smoothstep(25.0, 120.0, vDst);
          float macro = 0.88 + 0.24 * (ntN(p / 900.0) * 0.6 + ntN(p / 310.0 + 4.1) * 0.4);
          diffuseColor.rgb *= macro * (${k[0].toFixed(2)} + ${k[1].toFixed(2)} * mix(0.5, dA, fN) + ${k[2].toFixed(2)} * dB + ${k[3].toFixed(2)} * (dC - 0.5) * 2.0 * fC);`);
    };
    return m;
  },
  // voda: procedurální vlnky (normála ze součtu vln), odraz oblohy podle Fresnela, odlesk slunce, mlha a log. hloubka
  waterMat(c) {
    const T = c.T, sd = c.sunDir || new THREE.Vector3(0.45, 0.8, 0.35).normalize();
    const u = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uT: { value: 0 }, uSun: { value: sd.clone() },
      uDeep: { value: new THREE.Color(T.biome === 'alpine' ? 0x1d4a62 : 0x1e5674) }, uSky: { value: new THREE.Color(T.fog) }, uZen: { value: new THREE.Color(T.zenith) },
    }]);
    const m = new THREE.ShaderMaterial({
      uniforms: u, fog: true, transparent: true,
      vertexShader: `varying vec3 vW;
#include <common>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
#include <logdepthbuf_vertex>
#include <fog_vertex>
}`,
      fragmentShader: `uniform float uT; uniform vec3 uSun, uDeep, uSky, uZen; varying vec3 vW;
#include <common>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
vec2 wv(vec2 p, vec2 d, float f, float a, float s) { float ph = dot(p, d) * f + uT * s; return d * cos(ph) * f * a; }
void main() {
#include <logdepthbuf_fragment>
  vec2 p = vW.xz, g = vec2(0.0); float dc = length(cameraPosition - vW);   // drobné vlny ve větší dálce mizí (jinak moaré)
  g += wv(p, normalize(vec2(1.0, 0.3)), 0.11, 0.35, 1.1) * (1.0 - smoothstep(400.0, 1800.0, dc));
  g += wv(p, normalize(vec2(-0.4, 1.0)), 0.23, 0.16, 1.6) * (1.0 - smoothstep(180.0, 800.0, dc));
  g += wv(p, normalize(vec2(0.7, -0.8)), 0.57, 0.06, 2.4) * (1.0 - smoothstep(70.0, 320.0, dc));
  g += wv(p, normalize(vec2(-0.9, -0.2)), 1.31, 0.025, 3.3) * (1.0 - smoothstep(30.0, 140.0, dc));
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 v = normalize(cameraPosition - vW);
  float fr = 0.03 + 0.97 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  vec3 r = reflect(-v, n);
  vec3 sky = mix(uSky, uZen, clamp(r.y * 1.6, 0.0, 1.0));
  vec3 col = mix(uDeep, sky, clamp(fr, 0.0, 1.0));
  col += vec3(1.0, 0.95, 0.85) * pow(max(dot(r, uSun), 0.0), 280.0) * 2.2;
  gl_FragColor = vec4(col, 0.9 + fr * 0.1);
#include <fog_fragment>
}`,
    });
    c.waterU = u;
    return m;
  },
  // ---------- terén s barvami ve vrcholech (trojúhelníky stejně jako height()) ----------
  terrainMesh(c, scene) {
    const T = c.T, N = this.N, E = this.E, W = N + 1, H = c.H, cell = c.cell, wl = T.water === null ? -1e9 : T.water;
    const pos = new Float32Array(W * W * 3), col = new Float32Array(W * W * 3), idx = [];
    const K = (h) => new THREE.Color(h);
    const P = {
      meadow: K(0x557532), meadow2: K(0x687c42), forest: K(0x2a4524), rock: K(0x77736a), sand: K(0xd6c48e), mud: K(0x4f5a40),
      aGrass: K(0x7d8656), snow: K(0xf2f5f8), scree: K(0x9a948a),
      cSand: K(0xc9a070), cTop: K(0xc89a62), cRock: K(0xb8653a), cDark: K(0x8a3a22), cPale: K(0xc4a07a), cRed: K(0xb06a40), cWhite: K(0xe2cba4), cVarn: K(0x5a3022), cBush: K(0x8a8452),
    };
    const tmp = new THREE.Color(), fc = new THREE.Color(), nn = new THREE.Vector3();
    for (let iz = 0; iz <= N; iz++) for (let ix = 0; ix <= N; ix++) {
      const k = iz * W + ix, x = -E + ix * cell, z = -E + iz * cell, h = H[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      this.normal(c, x, z, nn);
      const slope = 1 - nn.y, nz = U.fbm(x / 90, z / 90, 8, 2);
      if (T.biome === 'canyon') {
        const cliff = U.smooth(0.08, 0.3, slope), band = (Math.sin(h * 0.42 + nz * 1.2) + 1) / 2;
        const big = U.fbm(x / 420, z / 420, 23, 3);
        tmp.copy(P.cSand).lerp(P.cTop, U.smooth(110, 150, h) * 0.6).lerp(P.cRed, U.smooth(-0.1, 0.35, big) * 0.55).lerp(P.cBush, U.smooth(0.1, 0.5, nz) * 0.4 * (1 - cliff));
        tmp.lerp(P.cRock, cliff).lerp(P.cDark, band * cliff * 0.65).lerp(P.cWhite, U.smooth(0.55, 0.9, Math.sin(h * 0.13 + 1.3)) * cliff * 0.5);
        tmp.lerp(P.cVarn, cliff * U.smooth(0.05, 0.45, U.fbm(x / 22, z / 22, 19, 2)) * 0.55);   // pouštní lak – tmavé šmouhy na stěnách
        if (h < c.floor[0] + 8 && slope < 0.08) tmp.lerp(P.cPale, 0.35 + U.smooth(-0.2, 0.3, nz) * 0.25);                       // vyschlé koryto na dně
      } else if (T.biome === 'alpine') {
        const fo = this.forest(c, x, z) * (1 - U.smooth(470, 540, h)) * (1 - U.smooth(0.5, 0.64, slope));
        tmp.copy(P.meadow).lerp(P.meadow2, U.smooth(-0.2, 0.4, nz)).lerp(P.aGrass, U.smooth(430, 520, h));
        tmp.lerp(P.forest, fo * 0.9);
        tmp.lerp(P.scree, U.smooth(0.4, 0.55, slope) * 0.6 * (1 - fo)).lerp(P.rock, U.clamp(U.smooth(0.5, 0.68, slope) + U.smooth(600, 700, h) * 0.4, 0, 1));
        tmp.lerp(P.snow, U.smooth(560 + nz * 70, 640 + nz * 70, h) * (1 - U.smooth(0.5, 0.78, slope) * 0.75));
        if (h < wl + 1.5) tmp.lerp(P.mud, 0.6);
      } else {
        tmp.copy(P.meadow).lerp(P.meadow2, U.smooth(-0.3, 0.5, nz));
        if (h > wl + 2.5 && h < 60) tmp.lerp(fc.setHex(this.field(x, z)), 0.8 * (1 - U.smooth(0.03, 0.07, slope)));
        tmp.lerp(P.forest, this.forest(c, x, z) * 0.9);
        tmp.lerp(P.rock, U.smooth(0.2, 0.45, slope)).lerp(P.aGrass, U.smooth(80, 200, h) * 0.4);
        if (h < wl + 1.0) tmp.lerp(P.sand, U.smooth(wl + 1.0, wl + 0.2, h) * 0.85);
        if (h < wl - 0.6) tmp.lerp(P.mud, U.smooth(wl - 0.6, wl - 4, h));
      }
      tmp.offsetHSL(0, 0, (U.hash(ix, iz, 3) - 0.5) * 0.025);
      col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
    }
    for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
      const a = iz * W + ix, b = a + 1, d = a + W, e = d + 1;
      idx.push(a, d, b, e, b, d);   // dělení u+v=1 jako v height()
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const terr = new THREE.Mesh(g, this.terrainMat(T));
    terr.receiveShadow = true; scene.add(terr);
    // okolí za okrajem mapy
    let edgeMin = 1e9; for (let i = 0; i <= N; i++) edgeMin = Math.min(edgeMin, H[i], H[N * W + i], H[i * W], H[i * W + N]);
    // jen rám KOLEM mapy (dřív to byla celá deska, která nad ~100 m překryla jezero i letiště)
    const farM = U.mat(T.biome === 'canyon' ? 0xc89a6a : T.biome === 'alpine' ? 0x7a8a6a : 0x7a9a5a), F = 20000;
    for (const [w, d, x, z] of [[F - E, 2 * F, -(F + E) / 2, 0], [F - E, 2 * F, (F + E) / 2, 0], [2 * E, F - E, 0, -(F + E) / 2], [2 * E, F - E, 0, (F + E) / 2]]) {
      const far = new THREE.Mesh(new THREE.PlaneGeometry(w, d), farM); far.rotation.x = -Math.PI / 2; far.position.set(x, edgeMin - 4, z); scene.add(far);
    }
    // voda
    if (T.water !== null) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(2 * E, 2 * E), this.waterMat(c)); w.rotation.x = -Math.PI / 2; w.position.y = T.water; scene.add(w); c.waterMesh = w;
    }
  },

  // ---------- letiště: dráha se značením, pojezdové dráhy, odstavná plocha, hangáry, věž, nádrže, zaparkovaná letadla ----------
  airfield(c, scene) {
    const rw = c.rw, T = c.T, hw = rw.hw, hl = rw.hl;
    const rwg = new THREE.Group(); rwg.position.set(rw.x, rw.y + 0.06, rw.z); rwg.rotation.y = rw.yaw; scene.add(rwg);
    const flat = (w, l, x, z, col, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), col instanceof THREE.Material ? col : U.mat(col)); m.rotation.x = -Math.PI / 2; m.position.set(x, y || 0, z); m.receiveShadow = true; rwg.add(m); return m; };
    const ob = (lx, zl, r, top) => { const [x, z] = this.afW(c, lx, zl); this.addObst(c, x, z, r, rw.y + top); };
    // dráha
    flat(hw * 2, hl * 2, 0, 0, 0x45464a);
    const wm = new THREE.MeshBasicMaterial({ color: 0xeeeeea }), am = new U.Merger();
    for (let zz = -hl + 90; zz < hl - 90; zz += 40) am.addBox(0.9, 0.02, 18, 0, 0.02, zz, 0, 0xeeeeea);
    for (const e of [-1, 1]) {
      for (let k = -5; k <= 5; k++) if (k) am.addBox(1.6, 0.02, 28, k * 2.4, 0.02, e * (hl - 22), 0, 0xeeeeea);
      for (const s of [-1, 1]) for (let j = 0; j < 3; j++) am.addBox(1.8, 0.02, 18, s * 6.5, 0.02, e * (hl - 160 - j * 60), 0, 0xeeeeea);   // dotykové zóny
      for (const s of [-1, 1]) am.addBox(0.6, 0.02, hl * 2 - 8, s * (hw - 1), 0.02, 0, 0, 0xeeeeea);                                         // okrajové čáry
    }
    // čísla dráhy podle kurzu
    const hdg = ((Math.atan2(rw.cx, -rw.cz) * 180 / Math.PI) + 360) % 360, n1 = Math.round(hdg / 10) || 36, n2 = ((n1 + 17) % 36) + 1;
    for (const [n, e] of [[n1, 1], [n2, -1]]) {
      const tx = U.textTexture(String(n).padStart(2, '0'), 128, 128, 'rgba(0,0,0,0)', '#eeeeea', 'bold 104px Arial');
      const m = flat(13, 13, 0, e * (hl - 62), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false }), 0.03);
      if (e < 0) m.rotation.set(-Math.PI / 2, 0, Math.PI);
    }
    // světla podél dráhy
    for (let zz = -hl + 10; zz <= hl - 10; zz += 60) for (const s of [-1, 1]) { am.addBox(0.35, 0.45, 0.35, s * (hw + 1.5), 0.22, zz, 0, 0xf2f2e0); }
    for (let k = -6; k <= 6; k++) for (const e of [-1, 1]) am.addBox(0.35, 0.45, 0.35, k * 2.3, 0.22, e * (hl + 2), 0, e > 0 ? 0x30d050 : 0xd03030);
    // pojezdové dráhy a odstavná plocha
    const taxi = U.mat(0x55565a);
    flat(34, 16, hw + 17, -hl + 150, taxi); flat(34, 16, hw + 17, -hl + 300, taxi);
    flat(78, 230, hw + 72, -hl + 225, 0x5d5e62, -0.01);
    am.addBox(0.5, 0.02, 220, hw + 40, 0.02, -hl + 225, 0, 0xe0c020);   // žlutá vodicí čára
    // hangáry (oblouk + čela s vraty) – otevřené směrem k dráze
    const G = this._afg || (this._afg = (() => {
      const arch = new THREE.CylinderGeometry(13, 13, 34, 14, 1, true, 0, Math.PI); arch.rotateZ(Math.PI / 2);
      const back = new THREE.CircleGeometry(13, 14, 0, Math.PI); back.rotateY(Math.PI / 2);
      const front = new THREE.CircleGeometry(13, 14, 0, Math.PI); front.rotateY(-Math.PI / 2);
      const door = new THREE.PlaneGeometry(19, 9); door.rotateY(-Math.PI / 2);
      const tank = new THREE.CylinderGeometry(2.4, 2.4, 7, 12); tank.rotateZ(Math.PI / 2);
      return { arch: arch.toNonIndexed(), back: back.toNonIndexed(), front: front.toNonIndexed(), door: door.toNonIndexed(), tank: tank.toNonIndexed() };
    })());
    for (const [zl, colr] of [[-hl + 165, 0x9aa3ab], [-hl + 285, 0x8c969e]]) {
      const x0 = hw + 128;
      am.add(G.arch, U.compose(x0, 0, zl, 0, 0, 0, 1, 1, 1), colr);
      am.add(G.back, U.compose(x0 + 17, 0, zl, 0, 0, 0, 1, 1, 1), colr);
      am.add(G.front, U.compose(x0 - 17, 0, zl, 0, 0, 0, 1, 1, 1), 0xd8dcdf);
      am.add(G.door, U.compose(x0 - 17.08, 4.5, zl, 0, 0, 0, 1, 1, 1), 0x2a2e34);
      am.addBox(19.6, 0.5, 0.4, x0 - 17.2, 9.2, zl, 0, 0xc04a2a);   // barevný pruh nad vraty
      ob(x0, zl, 18, 13.5);
    }
    // řídicí věž
    const tx = hw + 60, tz = -hl + 400;
    am.addBox(6, 14, 6, tx, 7, tz, 0, 0xe8e4dc); am.addBox(8.6, 3.6, 8.6, tx, 15.8, tz, 0, 0x2a3a4c); am.addBox(9.6, 0.6, 9.6, tx, 17.9, tz, 0, 0xd8d8d8);
    am.addBox(0.2, 5, 0.2, tx + 3, 20.6, tz + 3, 0, 0x888888); am.addBox(14, 4, 10, tx + 2, 2, tz + 12, 0, 0xd8d0c0); am.addBox(14.6, 0.5, 10.6, tx + 2, 4.2, tz + 12, 0, 0x6a6a6a);
    ob(tx, tz, 6, 21); ob(tx + 2, tz + 12, 9, 4.5);
    // palivové nádrže
    for (const k of [0, 1]) { const zz = -hl + 70 + k * 7; am.add(G.tank, U.compose(hw + 100, 3.2, zz, 0, 0, 0, 1, 1, 1), 0xf0f0f0); am.addBox(0.4, 1.2, 4.2, hw + 97, 0.6, zz, 0, 0x777777); am.addBox(0.4, 1.2, 4.2, hw + 103, 0.6, zz, 0, 0x777777); }
    ob(hw + 100, -hl + 73, 7, 6);
    // plot kolem letiště
    for (let zz = -hl + 20; zz < hl - 20; zz += 4) am.addBox(0.08, 1.6, 0.08, hw + 158, 0.8, zz, 0, 0x777777);
    am.addBox(0.04, 0.05, hl * 2 - 40, hw + 158, 1.5, 0, 0, 0x888888);
    const afm = am.build(); if (afm) { afm.receiveShadow = true; rwg.add(afm); }
    // větrný rukáv
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 6), U.mat(0xdddddd)); pole.position.set(hw + 12, 3, -hl + 120); rwg.add(pole);
    const sock = new THREE.Mesh(new THREE.ConeGeometry(0.5, 3, 10, 1, true), U.mat(0xff6a1a, { side: THREE.DoubleSide })); sock.rotation.x = Math.PI / 2; sock.position.set(hw + 12, 5.8, -hl + 121.5); rwg.add(sock);
    // zaparkovaná letadla (statické modely, ocasem dolů na ostruze)
    if (typeof PlaneModel !== 'undefined') {
      const park = [['sokol', 0xd02a2a, -hl + 205], ['cmelak', 0x2a6ad8, -hl + 250], ['cmelak', 0x18a878, -hl + 330]];
      for (const [id, paint, zl] of park) {
        const m = PlaneModel.build(id, paint), gp = m.gearPts, mw = gp[0].p, tw = gp[2].p;
        const th = Math.atan2(tw[1] - mw[1], tw[2] - mw[2]);
        m.root.rotation.set(th, Math.PI / 2, 0, 'YXZ');
        m.root.position.set(hw + 62, -(mw[1] * Math.cos(th) - mw[2] * Math.sin(th)) - 0.06, zl);
        m.blades.rotation.z = Math.random() * 3; m.disc.visible = false; rwg.add(m.root);
        ob(hw + 62, zl, 5.5, 3.2);
      }
    }
    // klíčové body pro silnici k letišti
    c.afGate = this.afW(c, hw + 175, -hl + 225);
    c.roadLines.push({ pts: [this.afW(c, hw + 112, -hl + 225), this.afW(c, hw + 178, -hl + 225)], w: 6, col: 0x56575c });
    this.addKeep(c, rw.x, rw.z, 0);
  },

  // ---------- trasování silnic: A* po mřížce 40 m, cena = délka × (1 + strmost²), voda a letiště drahé ----------
  route(c, a, b) {
    const S = 40, E = this.E, n = Math.floor(2 * E / S) + 1, wl = c.T.water === null ? -1e9 : c.T.water;
    if (!c.rH) { c.rH = new Float32Array(n * n); for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) c.rH[j * n + i] = c.height(-E + i * S, -E + j * S); }
    const H = c.rH, toI = (v) => U.clamp(Math.round((v + E) / S), 1, n - 2);
    const si = toI(a[0]), sj = toI(a[1]), ti = toI(b[0]), tj = toI(b[1]), start = sj * n + si, goal = tj * n + ti;
    const g = new Float32Array(n * n).fill(Infinity), from = new Int32Array(n * n).fill(-1), done = new Uint8Array(n * n);
    const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    g[start] = 0; push(start, 0);
    const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    while (heap.length) {
      const [, k] = pop(); if (done[k]) continue; done[k] = 1; if (k === goal) break;
      const i = k % n, j = (k - i) / n;
      for (const [di, dj] of D) {
        const ni = i + di, nj = j + dj; if (ni < 1 || nj < 1 || ni > n - 2 || nj > n - 2) continue;
        const nk = nj * n + ni; if (done[nk]) continue;
        const len = S * Math.hypot(di, dj), gr = Math.abs(H[nk] - H[k]) / len;
        if (gr > 0.22) continue;
        const x = -E + ni * S, z = -E + nj * S;
        let cost = len * (1 + 90 * gr * gr);
        if (H[nk] < wl + 1) cost += len * 6;
        if (nk !== goal && this.inAirfield(c, x, z, 0)) cost += len * 40;
        const ng = g[k] + cost;
        if (ng < g[nk]) { g[nk] = ng; from[nk] = k; push(nk, ng + Math.hypot(ni - ti, nj - tj) * S); }
      }
    }
    if (!done[goal]) return null;
    let path = []; for (let k = goal; k !== -1; k = from[k]) { const i = k % n, j = (k - i) / n; path.push([-E + i * S, -E + j * S]); }
    path.reverse(); path[0] = a.slice(); path[path.length - 1] = b.slice();
    for (let it = 0; it < 3; it++) {   // Chaikin – zakulacení zatáček
      const q = [path[0]];
      for (let i = 0; i + 1 < path.length; i++) { const p = path[i], r = path[i + 1]; q.push([p[0] * 0.75 + r[0] * 0.25, p[1] * 0.75 + r[1] * 0.25], [p[0] * 0.25 + r[0] * 0.75, p[1] * 0.25 + r[1] * 0.75]); }
      q.push(path[path.length - 1]); path = q;
    }
    return path;
  },
  // silnice položená na terén (pás trojúhelníků po ~5 m)
  roadMesh(c, scene) {
    const pos = [], col = [], C = new THREE.Color(), wl = c.T.water === null ? -1e9 : c.T.water;
    const H = (x, z) => Math.max(c.height(x, z) + 0.32, wl + 0.6);
    for (const L of c.roadLines) {
      const s = [];   // převzorkování
      for (let i = 0; i + 1 < L.pts.length; i++) {
        const a = L.pts[i], b = L.pts[i + 1], d = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(d / 5));
        for (let j = 0; j < k; j++) s.push([U.lerp(a[0], b[0], j / k), U.lerp(a[1], b[1], j / k)]);
      }
      s.push(L.pts[L.pts.length - 1]);
      C.setHex(L.col);
      let pl = null, pr = null;
      for (let i = 0; i < s.length; i++) {
        const p = s[i], q = s[Math.min(i + 1, s.length - 1)], o = s[Math.max(i - 1, 0)];
        let tx = q[0] - o[0], tz = q[1] - o[1]; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const nx = -tz * L.w / 2, nz = tx * L.w / 2;
        const l = [p[0] + nx, H(p[0] + nx, p[1] + nz), p[1] + nz], r = [p[0] - nx, H(p[0] - nx, p[1] - nz), p[1] - nz];
        const mid = H(p[0], p[1]); l[1] = r[1] = Math.max(Math.min(l[1], r[1]) + 0.0, (l[1] + r[1]) / 2, mid);
        if (pl) {
          for (const v of [pl, pr, l, pr, r, l]) { pos.push(v[0], v[1], v[2]); col.push(C.r, C.g, C.b); }
        }
        pl = l; pr = r;
        if (i % 2 === 0) this.addKeep(c, p[0], p[1], L.w / 2 + 1.5);
      }
    }
    if (!pos.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); m.receiveShadow = true; scene.add(m);
  },

  // ---------- osídlení: vesnice (domy, kostel), ranč v poušti, silnice, loďky na jezeře ----------
  settle(c, scene, mg) {
    const T = c.T, rnd = U.rng(4242 + c.ti * 131), wl = T.water === null ? -1e9 : T.water;
    const prism = this._prism || (this._prism = (() => { const g = new THREE.CylinderGeometry(1, 1, 1, 3); g.rotateX(-Math.PI / 2); g.translate(0, 0.5, 0); g.scale(1 / Math.sqrt(3), 1 / 1.5, 1); return g.toNonIndexed(); })());
    const spire = this._spire || (this._spire = new THREE.ConeGeometry(1, 1, 4).toNonIndexed());
    const rough = (x, z, R) => { let lo = 1e9, hi = -1e9; for (let a = 0; a < 6.28; a += 1.05) for (const rr of [0, R * 0.5, R]) { const h = c.height(x + Math.cos(a) * rr, z + Math.sin(a) * rr); if (h < lo) lo = h; if (h > hi) hi = h; } return [lo, hi]; };
    // odstup od osy trati: střed vesnice (vC) a jednotlivé domy (hC); v horách stojí vesnice na okraji dna údolí
    const vC = T.biome === 'canyon' ? T.halfW + T.wallW + 200 : T.biome === 'alpine' ? T.halfW * 0.8 : T.halfW * 0.8 + 110;
    const hC = T.biome === 'canyon' ? T.halfW + T.wallW + 100 : T.biome === 'alpine' ? T.halfW * 0.62 : T.halfW * 0.8 + 10;
    const roadCol = T.biome === 'lake' ? 0x56575c : T.biome === 'alpine' ? 0x6a6660 : 0xb39672;
    // --- místa pro vesnice ---
    const cand = [];
    for (let x = -2400; x <= 2400; x += 100) for (let z = -2400; z <= 2400; z += 100) {
      const [lo, hi] = rough(x, z, T.biome === 'alpine' ? 55 : 80);
      if (lo < wl + 2.5 || hi - lo > (T.biome === 'alpine' ? 14 : 9)) continue;
      if (this.inAirfield(c, x, z, 140)) continue;
      if (this.distCourse(c, x, z) < vC) continue;
      cand.push({ x, z, s: hi - lo });
    }
    const nV = T.biome === 'canyon' ? 1 : T.biome === 'alpine' ? 3 : 4, cen = [], af = c.afGate;
    while (cen.length < nV && cand.length) {
      let best = null, bs = -1e9;
      for (const q of cand) {
        const da = Math.hypot(q.x - af[0], q.z - af[1]);
        let dm = 1e9; for (const v of cen) dm = Math.min(dm, Math.hypot(q.x - v.x, q.z - v.z));
        if (cen.length && dm < 750) continue;
        const sc = (cen.length ? Math.min(dm, 1600) : -Math.abs(da - 900)) - q.s * 15 + U.hash(q.x, q.z, 3) * 120;
        if (sc > bs) { bs = sc; best = q; }
      }
      if (!best) break;
      cen.push(best);
    }
    // --- silnice: každá vesnice k nejbližšímu už napojenému místu (letiště nebo vesnice) ---
    const linked = [af];
    for (const v of cen) {
      let tgt = linked[0], bd = 1e18; for (const l of linked) { const d = (l[0] - v.x) ** 2 + (l[1] - v.z) ** 2; if (d < bd) { bd = d; tgt = l; } }
      const path = this.route(c, [v.x, v.z], tgt);
      if (path) c.roadLines.push({ pts: path, w: T.biome === 'lake' ? 6 : 5, col: roadCol });
      else if (T.biome === 'canyon') {   // ranč nad kaňonem: cesta k okraji mapy
        const e = [v.x > 0 ? this.E - 60 : -this.E + 60, v.z], p2 = this.route(c, [v.x, v.z], e);
        if (p2) c.roadLines.push({ pts: p2, w: 5, col: roadCol });
      }
      linked.push([v.x, v.z]);
    }
    // hlavní ulice vesnic
    const streets = cen.map(v => {
      const ni = this.nearest(c, v.x, v.z), pa = c.pts[ni], pb = c.pts[(ni + 3) % c.M];
      const ang = T.biome === 'alpine' ? Math.atan2(pb.z - pa.z, pb.x - pa.x) : rnd() * Math.PI, dx = Math.cos(ang), dz = Math.sin(ang), L = T.biome === 'canyon' ? 45 : T.biome === 'alpine' ? 55 + rnd() * 30 : 85 + rnd() * 50;
      const line = { pts: [[v.x - dx * L, v.z - dz * L], [v.x + dx * L, v.z + dz * L]], w: 5.5, col: roadCol };
      c.roadLines.push(line);
      return { v, dx, dz, L };
    });
    this.roadMesh(c, scene);
    // --- domy ---
    const pal = T.biome === 'lake' ? { wall: [0xf2efe6, 0xe8dcc0, 0xf0e2b0, 0xdedad2, 0xe6c8a0], roof: [0xa8452c, 0x8a3a28, 0x6a4a3a, 0xb85a34, 0x4a4a52] }
      : T.biome === 'alpine' ? { wall: [0x7a5232, 0x6a4628, 0x8a6040], roof: [0x5a4a3c, 0x4a4040, 0x6a5a48] }
        : { wall: [0xc89a6a, 0xd6b080, 0xb8865a], roof: [0xa8845a, 0x9a7650] };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    const house = (x, z, ry, big) => {
      const w = (T.biome === 'alpine' ? 9 : 7) + rnd() * 3 + (big ? 3 : 0), d = w + 2 + rnd() * 4, r = Math.max(w, d) * 0.62;
      if (this.kept(c, x, z, r)) return false;
      const [lo, hi] = rough(x, z, r); if (lo < wl + 1 || hi - lo > 4) return false;
      if (this.distCourse(c, x, z) < hC) return false;
      const base = lo - 0.4, hh = (T.biome === 'canyon' ? 3.2 : 3 + rnd() * 2.6) + (hi - lo);
      let top;
      if (T.biome === 'alpine') {   // horská chata: kamenný sokl, dřevěné patro, plochá široká střecha
        mg.addBox(w, 2.6 + (hi - lo), d, x, base + (2.6 + hi - lo) / 2, z, ry, 0xd2cec4);
        mg.addBox(w, 2.8, d, x, base + 2.6 + (hi - lo) + 1.4, z, ry, pick(pal.wall));
        const rh = w * 0.32, y0 = base + 5.4 + (hi - lo);
        mg.add(prism, U.compose(x, y0, z, 0, ry, 0, w + 2.4, rh, d + 2.2), pick(pal.roof)); top = y0 + rh;
        if (rnd() < 0.6) mg.addBox(w + 0.4, 0.25, 1.4, x + Math.sin(ry) * (d / 2 + 0.7), base + 2.9 + (hi - lo), z + Math.cos(ry) * (d / 2 + 0.7), ry, 0x5a3a20);   // balkon
      } else if (T.biome === 'canyon') {   // nepálené cihly, rovná střecha
        mg.addBox(w, hh, d, x, base + hh / 2, z, ry, pick(pal.wall)); mg.addBox(w + 0.5, 0.4, d + 0.5, x, base + hh + 0.2, z, ry, pick(pal.roof)); top = base + hh + 0.4;
      } else {
        mg.addBox(w, hh, d, x, base + hh / 2, z, ry, pick(pal.wall));
        const rh = w * 0.55; mg.add(prism, U.compose(x, base + hh, z, 0, ry, 0, w + 0.8, rh, d + 0.8), pick(pal.roof)); top = base + hh + rh;
        if (rnd() < 0.5) mg.addBox(0.7, 1.6, 0.7, x + Math.cos(ry) * w * 0.2, base + hh + rh * 0.7, z - Math.sin(ry) * w * 0.2, ry, 0x8a5a48);   // komín
      }
      this.addObst(c, x, z, r * 0.9, top); this.addKeep(c, x, z, r + 2);
      return true;
    };
    for (const st of streets) {
      const { v, dx, dz, L } = st, nx = -dz, nz = dx, ry = Math.atan2(dx, dz);
      // kostel / v poušti stodola a vodojem
      const cx = v.x + nx * 22, cz = v.z + nz * 22, h0 = c.height(cx, cz) - 0.5;
      if (T.biome !== 'canyon' && !this.kept(c, cx, cz, 14)) {
        mg.addBox(10, 8, 20, cx, h0 + 4, cz, ry, 0xf2f0ea); mg.add(prism, U.compose(cx, h0 + 8, cz, 0, ry, 0, 11, 5, 21), T.biome === 'alpine' ? 0x4a4a4a : 0x6a6e78);
        const tx = cx + dx * 11, tz = cz + dz * 11;
        mg.addBox(4.6, 19, 4.6, tx, h0 + 9.5, tz, ry, 0xf2f0ea); mg.add(spire, U.compose(tx, h0 + 19 + 4.5, tz, 0, ry + Math.PI / 4, 0, 3.4, 9, 3.4), 0x3a5a4a);
        this.addObst(c, cx, cz, 12, h0 + 13); this.addObst(c, tx, tz, 4, h0 + 28); this.addKeep(c, cx, cz, 16);
      } else if (T.biome === 'canyon') {
        mg.addBox(12, 7, 16, cx, h0 + 3.5, cz, ry, 0x8a2a1a); mg.add(prism, U.compose(cx, h0 + 7, cz, 0, ry, 0, 12.6, 4.5, 16.6), 0x5a5a5a);
        const tx = cx + dx * 20, tz = cz + dz * 20;
        for (const [ox, oz] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) mg.addBox(0.3, 9, 0.3, tx + ox, h0 + 4.5, tz + oz, 0, 0x6a5040);
        mg.add(this._tank || (this._tank = new THREE.CylinderGeometry(2.6, 2.6, 4, 10).toNonIndexed()), U.compose(tx, h0 + 11, tz, 0, 0, 0, 1, 1, 1), 0x8a7a6a);
        this.addObst(c, cx, cz, 11, h0 + 11.5); this.addObst(c, tx, tz, 3.5, h0 + 13); this.addKeep(c, cx, cz, 14); this.addKeep(c, tx, tz, 5);
      }
      for (let s = -L + 8; s <= L - 8; s += 15 + rnd() * 7) for (const side of [-1, 1]) {
        if (rnd() < 0.15) continue;
        const off = 12 + rnd() * 4;
        house(v.x + dx * s + nx * side * off, v.z + dz * s + nz * side * off, ry + (side > 0 ? Math.PI : 0) + (rnd() - 0.5) * 0.12);
      }
      // pár samot v okolí
      for (let k = 0; k < (T.biome === 'canyon' ? 2 : 6); k++) { const a = rnd() * 6.28, d = L + 40 + rnd() * 160; house(v.x + Math.cos(a) * d, v.z + Math.sin(a) * d, rnd() * 6.28); }
    }
    // --- loďky na jezeře ---
    if (T.biome === 'lake') {
      let n = 0;
      for (let k = 0; k < 400 && n < 9; k++) {
        const x = (rnd() * 2 - 1) * 2400, z = (rnd() * 2 - 1) * 2400;
        if (c.height(x, z) > wl - 2.5 || this.distCourse(c, x, z) < 80 || this.kept(c, x, z, 30)) continue;
        const ry = rnd() * 6.28, sx = Math.sin(ry), sz = Math.cos(ry);
        mg.addBox(2.2, 0.9, 6.5, x, wl + 0.3, z, ry, 0xf4f4f0); mg.add(prism, U.compose(x + sx * 3.4, wl - 0.15, z + sz * 3.4, Math.PI / 2, ry, 0, 2.2, 1.6, 0.9), 0xf4f4f0);
        mg.addBox(0.14, 8, 0.14, x + sx * 0.8, wl + 4.6, z + sz * 0.8, ry, 0xcccccc);
        mg.add(prism, U.compose(x - sx * 0.6, wl + 1.1, z - sz * 0.6, 0, ry + Math.PI / 2, -0.0, 0.06, 6.6, 3.2), rnd() < 0.3 ? 0xd84a3a : 0xfafafa);
        this.addObst(c, x, z, 3.5, wl + 8.6); this.addKeep(c, x, z, 40); n++;
      }
    }
  },

  // ---------- vegetace: lesy ve shlucích, osamělé stromy v polích, topoly podél silnic, kaktusy a skály v poušti ----------
  vegetation(c, mg) {
    const T = c.T, E = this.E, rnd = U.rng(1234 + c.ti * 77), nn = new THREE.Vector3(), wl = T.water === null ? -1e9 : T.water;
    const G = this._tg || (this._tg = {
      cone: new THREE.ConeGeometry(1, 1, 7, 1, true).toNonIndexed(), trunk: new THREE.CylinderGeometry(0.7, 1, 1, 5, 1, true).toNonIndexed(),
      ico: new THREE.IcosahedronGeometry(1, 0).toNonIndexed(), dod: new THREE.DodecahedronGeometry(1, 0).toNonIndexed(),
    });
    const tc = new THREE.Color(), col = (hex, v) => tc.setHex(hex).offsetHSL((rnd() - 0.5) * 0.03, 0, (rnd() - 0.5) * v);
    const spruce = (x, h, z, s) => {
      mg.add(G.trunk, U.compose(x, h + 1.2 * s, z, 0, 0, 0, 0.32 * s, 2.4 * s, 0.32 * s), 0x4a3424);
      const cl = col(rnd() < 0.5 ? 0x26452a : 0x2f5232, 0.06), ry = rnd() * 3;
      mg.add(G.cone, U.compose(x, h + 6 * s, z, 0, ry, 0, 3.2 * s, 8 * s, 3.2 * s), cl);
      mg.add(G.cone, U.compose(x, h + 9.5 * s, z, 0, ry + 0.4, 0, 2.2 * s, 6 * s, 2.2 * s), cl);
      return [2.4 * s, h + 12.5 * s];
    };
    const larch = (x, h, z, s) => {
      mg.add(G.trunk, U.compose(x, h + 1.5 * s, z, 0, 0, 0, 0.28 * s, 3 * s, 0.28 * s), 0x5a3a24);
      mg.add(G.cone, U.compose(x, h + 6.5 * s, z, 0, rnd() * 3, 0, 2.3 * s, 9 * s, 2.3 * s), col(0x6a8a3a, 0.08));
      return [1.8 * s, h + 11 * s];
    };
    const broad = (x, h, z, s) => {
      mg.add(G.trunk, U.compose(x, h + 1.6 * s, z, 0, 0, 0, 0.4 * s, 3.2 * s, 0.4 * s), 0x5a4030);
      const cl = col([0x4a7a2a, 0x5a8a34, 0x3f6e2a, 0x6a8a30][Math.floor(rnd() * 4)], 0.08);
      mg.add(G.dod, U.compose(x, h + 5.2 * s, z, rnd(), rnd() * 3, 0, 3.6 * s, 3.2 * s, 3.6 * s), cl);
      if (rnd() < 0.5) mg.add(G.ico, U.compose(x + 1.5 * s, h + 4.3 * s, z + (rnd() - 0.5) * 2 * s, rnd(), rnd(), 0, 2.4 * s, 2.2 * s, 2.4 * s), cl);
      return [3 * s, h + 8.4 * s];
    };
    const birch = (x, h, z, s) => {
      mg.add(G.trunk, U.compose(x, h + 2.4 * s, z, 0, 0, 0, 0.22 * s, 4.8 * s, 0.22 * s), 0xe8e4dc);
      mg.add(G.ico, U.compose(x, h + 6.4 * s, z, rnd(), rnd() * 3, 0, 1.9 * s, 3.2 * s, 1.9 * s), col(0x8aaa44, 0.08));
      return [1.6 * s, h + 9.6 * s];
    };
    const poplar = (x, h, z, s) => {
      mg.add(G.trunk, U.compose(x, h + 1.5 * s, z, 0, 0, 0, 0.3 * s, 3 * s, 0.3 * s), 0x5a4a38);
      mg.add(G.ico, U.compose(x, h + 8 * s, z, 0, rnd() * 3, 0, 1.6 * s, 6.5 * s, 1.6 * s), col(0x4f7a30, 0.06));
      return [1.4 * s, h + 14.5 * s];
    };
    const bush = (x, h, z, s, hex) => { mg.add(G.ico, U.compose(x, h + 0.6 * s, z, rnd(), rnd() * 3, 0, 1.4 * s, 1.0 * s, 1.4 * s), col(hex, 0.08)); return [1.2 * s, h + 1.6 * s]; };
    const rock = (x, h, z, s, hex) => { mg.add(G.dod, U.compose(x, h + 0.4 * s, z, rnd(), rnd() * 3, rnd(), 2.2 * s, 1.5 * s, 1.8 * s), col(hex, 0.1)); return [1.8 * s, h + 1.8 * s]; };
    const cactus = (x, h, z, s) => {
      mg.addBox(0.55 * s, 5 * s, 0.55 * s, x, h + 2.5 * s, z, 0, 0x4a7a3a);
      const a = rnd() * 3;
      mg.addBox(1.4 * s, 0.45 * s, 0.45 * s, x, h + 2.4 * s, z, a, 0x4a7a3a);
      mg.addBox(0.42 * s, 1.6 * s, 0.42 * s, x + Math.cos(a) * 0.7 * s, h + 3.1 * s, z - Math.sin(a) * 0.7 * s, a, 0x4a7a3a);
      return [0.8 * s, h + 5 * s];
    };
    const ok = (x, z, h, corr) => {
      if (h < wl + 0.8) return false;
      if (this.inAirfield(c, x, z, 25)) return false;
      if (this.kept(c, x, z, 2)) return false;
      return this.distCourse(c, x, z) >= corr;
    };
    const plant = (fn, x, h, z, s, hex) => { const [r, top] = fn(x, h, z, s, hex); this.addObst(c, x, z, r * 0.75, top); };
    // topoly podél silnic (jen u jezera)
    if (T.biome === 'lake') for (const L of c.roadLines) {
      if (L.pts.length < 4) continue;
      let acc = 0, side = 1;
      for (let i = 1; i < L.pts.length; i++) {
        const a = L.pts[i - 1], b = L.pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]); acc += d;
        if (acc < 24) continue; acc = 0; side = -side;
        if (rnd() < 0.35) continue;
        const nx = -(b[1] - a[1]) / (d || 1), nz = (b[0] - a[0]) / (d || 1), x = b[0] + nx * side * 7.5, z = b[1] + nz * side * 7.5, h = c.height(x, z);
        if (h < wl + 0.8 || this.inAirfield(c, x, z, 10) || this.distCourse(c, x, z) < T.halfW * 0.55) continue;
        plant(poplar, x, h - 0.2, z, 0.85 + rnd() * 0.3);
      }
    }
    const want = T.biome === 'canyon' ? 1300 : T.biome === 'alpine' ? 6500 : 5200, corr = T.halfW * 0.55;
    for (let k = 0, tries = 0; k < want && tries < want * 25; tries++) {
      const x = (rnd() * 2 - 1) * (E - 100), z = (rnd() * 2 - 1) * (E - 100), h = c.height(x, z);
      this.normal(c, x, z, nn);
      const slope = 1 - nn.y, s = 0.75 + rnd() * 0.5;
      if (T.biome === 'canyon') {
        if (slope > 0.3 || !ok(x, z, h, corr * 0.6)) continue;
        const r = rnd();
        if (r < 0.32) { if (slope > 0.1) continue; plant(cactus, x, h, z, s); }
        else if (r < 0.75) plant(bush, x, h, z, s * 1.2, rnd() < 0.5 ? 0x5a6a3a : 0x7a7a4a);
        else plant(rock, x, h - 0.3, z, s * (1 + rnd() * 1.5), rnd() < 0.5 ? 0x9a5a3a : 0xb07850);
        k++; continue;
      }
      if (T.biome === 'alpine') {
        if (slope > 0.62 || !ok(x, z, h, corr)) continue;
        if ((slope > 0.45 || h > 520) && rnd() < 0.12 && h < 700) { plant(rock, x, h - 0.4, z, s * (1 + rnd() * 2), 0x8a8680); k++; continue; }
        const f = this.forest(c, x, z) * 0.95 * (1 - U.smooth(470, 540, h)) * (1 - U.smooth(0.5, 0.64, slope)) + 0.02 * (1 - U.smooth(520, 560, h));
        if (rnd() > f) continue;
        plant(h > 440 && rnd() < 0.6 ? larch : spruce, x, h - 0.2, z, s); k++; continue;
      }
      // jezero
      if (slope > 0.3 || !ok(x, z, h, corr)) continue;
      const f = this.forest(c, x, z);
      if (rnd() > f * 0.95 + 0.025) continue;
      if (f > 0.3) { const r = rnd(); plant(r < 0.52 ? broad : r < 0.84 ? spruce : birch, x, h - 0.2, z, s); }
      else plant(rnd() < 0.85 ? broad : birch, x, h - 0.2, z, s * 1.1);
      k++;
    }
  },

  // ---------- mraky: kupy s plochou spodní základnou, spodek do šeda ----------
  clouds(c, scene) {
    const T = c.T, rnd = U.rng(999 + c.ti * 7), cm = new U.Merger();
    const ico = this._cico || (this._cico = new THREE.IcosahedronGeometry(1, 1).toNonIndexed());
    const n = T.biome === 'canyon' ? 26 : 44, tc = new THREE.Color();
    for (let k = 0; k < n; k++) {
      const x = (rnd() * 2 - 1) * 4200, z = (rnd() * 2 - 1) * 4200, base = 700 + rnd() * 380 + (T.biome === 'alpine' ? 380 : 0), S = 0.7 + rnd() * 0.8;
      const lumps = 6 + Math.floor(rnd() * 5);
      for (let j = 0; j < lumps; j++) {
        const r = (36 + rnd() * 34) * S, ox = (rnd() - 0.5) * 220 * S, oz = (rnd() - 0.5) * 130 * S, up = rnd() * r * 0.9;
        tc.setHex(0xffffff).lerp(new THREE.Color(0xc8ced8), 1 - up / (r * 0.9 + 1) * 0.8);
        cm.add(ico, U.compose(x + ox, base + up + r * 0.35, z + oz, 0, rnd() * 3, 0, r * 1.25, r * 0.7, r), tc);
      }
    }
    const clouds = cm.build(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x8c929e, transparent: true, opacity: 0.9, flatShading: true }));
    if (clouds) { clouds.castShadow = false; clouds.receiveShadow = false; scene.add(clouds); }
  },

  // sloučení geometrií [geo, matice] do jedné (bez barev – jeden materiál)
  geoMerge(items) {
    const pos = [], nrm = [];
    for (const [g0, mt] of items) {
      const g = (g0.index ? g0.toNonIndexed() : g0.clone()).applyMatrix4(mt), p = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nrm.push(n.getX(i), n.getY(i), n.getZ(i)); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    return g;
  },
  // ---------- brány ----------
  gatesMesh(c, scene) {
    c.gateObjs = [];
    const ringMat = (cl) => new THREE.MeshLambertMaterial({ color: cl, emissive: 0x000000 });
    for (const gt of c.gates) {
      const grp = new THREE.Group(); grp.position.copy(gt.pos); scene.add(grp);
      grp.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(gt.right, gt.up, gt.tan.clone().negate()));
      const o = { gt, grp, mats: [] };
      if (gt.type === 'ring') {
        const m1 = ringMat(0xff3a2a), m2 = ringMat(0xf4f4f0);
        const sg = new THREE.TorusGeometry(gt.R, 0.9, 6, 4, Math.PI * 2 / 16 + 0.01);
        for (const odd of [0, 1]) {
          const parts = []; for (let k = odd; k < 16; k += 2) parts.push([sg, U.compose(0, 0, 0, 0, 0, k * Math.PI * 2 / 16, 1, 1, 1)]);
          grp.add(new THREE.Mesh(this.geoMerge(parts), odd ? m2 : m1));
        }
        o.mats.push(m1);
        // stojan k zemi
        const hgt = gt.pos.y - gt.R - gt.gnd;
        if (hgt > 1 && hgt < 80) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, hgt, 6), U.mat(0x5a5a5a)); leg.position.set(0, -gt.R - hgt / 2, 0); grp.add(leg); }
      } else {
        const hgt = gt.top - gt.gnd;
        grp.position.y = gt.gnd;
        for (const s of [-1, 1]) {
          const cl = s < 0 ? 0xff3a2a : 0x2a7aff, m1 = ringMat(cl), m2 = ringMat(0xf4f4f0);
          const pg = new THREE.Group(); pg.position.x = s * gt.W / 2; grp.add(pg);
          const segs = 6;
          for (const odd of [0, 1]) {
            const parts = [];
            for (let k = odd; k < segs; k += 2) { const r0 = U.lerp(2.6, 0.9, k / segs), r1 = U.lerp(2.6, 0.9, (k + 1) / segs); parts.push([new THREE.CylinderGeometry(r1, r0, hgt / segs, 12), U.compose(0, (k + 0.5) * hgt / segs, 0, 0, 0, 0, 1, 1, 1)]); }
            const m = new THREE.Mesh(this.geoMerge(parts), odd ? m2 : m1); m.castShadow = true; pg.add(m);
          }
          o.mats.push(m1); (o.pyl = o.pyl || []).push(pg);
        }
        if (gt.level) {
          const tx = U.textTexture('VODOROVNĚ', 256, 48, 'rgba(0,0,0,0)', '#ffffff', 'bold 34px Arial');
          const lab = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.6), new THREE.MeshBasicMaterial({ map: tx, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
          lab.position.y = hgt + 3; grp.add(lab);
        }
      }
      if (gt.start) {   // start/cíl: šachovnicová páska
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 16; const x = cv.getContext('2d');
        for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#111' : '#fff'; x.fillRect(i * 8, j * 8, 8, 8); }
        const tx = new THREE.CanvasTexture(cv);
        const w = gt.type === 'ring' ? gt.R * 2.4 : gt.W, y = gt.type === 'ring' ? gt.R + 3 : gt.top - gt.gnd + 2.5;
        const ban = new THREE.Mesh(new THREE.PlaneGeometry(w, 2.5), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide }));
        ban.position.y = y; grp.add(ban);
      }
      c.gateObjs.push(o);
    }
  },
};
