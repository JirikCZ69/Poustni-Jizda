// rallytrack.js – rally etapy: generování trati (zatáčky, převýšení, skoky), povrchy, terén, překážky a rozpis spolujezdce
const RALLY_SURF = {
  asphalt: { name: 'Asfalt', mu: 1.05, roll: 0.012, slip: 1.0, dust: 0, col: 0x5a5652 },
  gravel: { name: 'Šotolina', mu: 0.8, roll: 0.022, slip: 1.35, dust: 1, col: 0xa08e74 },
  sand: { name: 'Písek', mu: 0.66, roll: 0.05, slip: 1.6, dust: 1.4, col: 0xdcbc80 },
  off: { name: 'Mimo trať', mu: 0.56, roll: 0.075, slip: 1.6, dust: 1.2, col: 0xc8a870 },
};
// prostředí etap: barvy, rostliny, svodidla, hory na obzoru
const RALLY_BIOMES = {
  desert: { name: 'Poušť', ground: 0xd6b47c, sky: 0xe9d8b8, hemi: 0x8a6a4a, rock: 0xb08a62, props: [['tree', 0.32], ['joshua', 0.1], ['cactus', 0.3], ['rock', 0.28]], dens: 1, close: 0.3, mount: 0xb89a78, mountN: 0.5, rails: 0.3,
    mix: { gravel: 0.85, asphalt: 0.15 }, names: ['Pouštní šotolina', 'Kaktusová stezka', 'Suché koryto', 'Rozpálená pláň'], desc: 'Rychlá šotolina mezi kaktusy a akáciemi.' },
  forest: { name: 'Les', ground: 0x6c7a3c, sky: 0xcfdde6, hemi: 0x4a5a30, rock: 0x7a7060, props: [['pine', 0.5], ['oak', 0.3], ['bush', 0.14], ['rock', 0.06]], dens: 3.4, close: 0.6, mount: 0x52664e, mountN: 0.8, rails: 0.7,
    mix: { gravel: 0.7, asphalt: 0.3 }, names: ['Lesní šotolina', 'Borový průsek', 'Hluboký les', 'Hájovna'], desc: 'Úzká lesní cesta, stromy hned u krajnice. Chyba = strom.' },
  canyon: { name: 'Kaňon', ground: 0xc28a5a, sky: 0xeed2b0, hemi: 0x8a5a3a, rock: 0xa0603a, props: [['rock', 0.45], ['joshua', 0.2], ['cactus', 0.35]], dens: 1.2, close: 0.45, mount: 0xa8643e, mountN: 1, rails: 1,
    mix: { asphalt: 0.8, gravel: 0.2 }, names: ['Kaňonový asfalt', 'Rudé skály', 'Soutěska', 'Orlí hřbet'], desc: 'Klikatý asfalt mezi skalami, svodidla nad srázy.', hillK: 1.35, curvK: 1.15 },
  dunes: { name: 'Duny', ground: 0xe2c28a, sky: 0xf2d8a8, hemi: 0x9a7a50, rock: 0xc8a070, props: [['cactus', 0.3], ['rock', 0.3], ['bush', 0.4]], dens: 0.5, close: 0.2, mount: 0xd8b07a, mountN: 0.4, rails: 0,
    mix: { sand: 0.75, gravel: 0.25 }, names: ['Duny', 'Písečné moře', 'Vátý písek', 'Zlaté duny'], desc: 'Měkký písek a skoky přes duny. Bez pískových gum se hrabeš.', jumpK: 2 },
  alpine: { name: 'Hory', ground: 0x76875a, sky: 0xd4e2ee, hemi: 0x4a5a48, rock: 0x8a8a88, props: [['pine', 0.78], ['rock', 0.22]], dens: 2.4, close: 0.5, mount: 0x707a86, mountN: 1.3, snow: true, rails: 1.2,
    mix: { asphalt: 0.55, gravel: 0.45 }, names: ['Horský průsmyk', 'Serpentiny', 'Pod štíty', 'Ledový hřeben'], desc: 'Serpentiny v horách, lesy a svodidla nad propastí.', hillK: 1.5, curvK: 1.25 },
};
const RALLY_BIOME_ORDER = ['desert', 'forest', 'canyon', 'dunes', 'alpine'];
// etapa n (0 = první): s každou další ostřejší zatáčky, větší kopce, víc skoků a delší trať
function rallyStage(n) {
  n = Math.max(0, Math.floor(n) || 0);
  const bk = RALLY_BIOME_ORDER[n % 5], B = RALLY_BIOMES[bk], lap = Math.floor(n / 5);
  const mix = Object.assign({}, B.mix);
  if (n >= 5 && bk !== 'dunes') { const other = bk === 'desert' ? 'sand' : 'gravel'; mix[other] = (mix[other] || 0) + 0.15; }
  const st = {
    id: 'r' + (n + 1), n, biome: bk, name: `${n + 1}. ${B.names[lap % B.names.length]}`, lvl: 1,
    len: Math.min(7500, 2300 + n * 320), mix,
    curvy: Math.min(3.4, 0.85 + n * 0.17) * (B.curvK || 1), hills: Math.min(5, 0.8 + n * 0.3) * (B.hillK || 1),
    grade: Math.min(0.74, 0.42 + n * 0.022), straight: Math.max(0.05, 0.22 - n * 0.012), minR: Math.max(12, 17 - n * 0.35),
    jumps: Math.min(7, 1 + Math.floor(n / 3) + (B.jumpK || 0)), trees: B.dens * (1 + Math.min(0.6, n * 0.03)),
    reward: 800 + n * 380, xp: 110 + n * 45, seed: 1009 + n * 7919,
    desc: B.desc,
  };
  st.diff = Math.min(10, 1 + n * 0.5);
  return st;
}
// pole etap (kvůli žebříčku a lobby) – generuje se líně
const RALLY_STAGES = new Proxy([], { get(a, k) { if (typeof k === 'string' && /^\d+$/.test(k)) return a[k] || (a[k] = rallyStage(+k)); return a[k]; } });
const RT_STEP = 4, RT_CELL = 24, RT_TEX_LEN = 14;   // délka jednoho opakování textury silnice v metrech
const RALLY_CONE_GOAL = 20, RALLY_CONE_N = 40;   // úkol: Zaklepat 20 kuželů (v zatáčkách jich je kolem 40, víc nevadí)

const RallyTrack = {
  // ---------- generování ----------
  generate(stage) {
    const rnd = U.rng(stage.seed), n = Math.ceil(stage.len / RT_STEP), pts = [];
    let x = 0, z = 0, t = 0, k = 0, tk = 0, seg = 0, dir = rnd() < 0.5 ? 1 : -1;
    for (let i = 0; i <= n; i++) {
      const s = i * RT_STEP;
      if (i > 0) {
        if (seg <= 0) {
          if (s < 70 || s > stage.len - 90 || rnd() < (stage.straight ?? 0.2)) { tk = 0; seg = (40 + rnd() * 110) / Math.sqrt(stage.curvy); }
          else {
            const R = Math.max(stage.minR || 16, (18 + rnd() * rnd() * 200) / Math.sqrt(stage.curvy));
            dir = rnd() < 0.68 ? -dir : dir;
            tk = dir / R; seg = R * (0.35 + rnd() * 1.4);
          }
        }
        seg -= RT_STEP;
        // trať míří celkově k −z; nesmí se stočit zpátky (žádné křížení)
        const ahead = t + k * Math.abs(k) / 0.006 * RT_STEP / 2;
        let want = tk;
        if (ahead > 1.3) want = Math.min(want, -1 / 60); if (ahead < -1.3) want = Math.max(want, 1 / 60);
        k += U.clamp(want - k, -0.006, 0.006);
        t += k * RT_STEP;
        if (Math.abs(t) > 1.42) { t = Math.sign(t) * 1.42; k = 0; }
        x += Math.sin(t) * RT_STEP; z -= Math.cos(t) * RT_STEP;
      }
      pts.push({ x, z, t, s, k: 0, y: 0, surf: 'gravel', w: 7 });
    }
    // zakřivení
    for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)]; pts[i].k = (b.t - a.t) / ((b.s - a.s) || 1); }
    // povrchy po úsecích
    const mix = Object.entries(stage.mix);
    let si = 0;
    while (si < pts.length) {
      const surf = U.pickWeighted(rnd(), mix), L = Math.floor((240 + rnd() * 520) / RT_STEP);
      for (let j = si; j < Math.min(pts.length, si + L); j++) { pts[j].surf = surf; pts[j].w = surf === 'asphalt' ? 7.2 : surf === 'sand' ? 8 : 7.4; }
      si += L;
    }
    const tr = { stage, pts, len: pts[pts.length - 1].s, seed: stage.seed, grid: new Map(), objs: [], ogrid: new Map(), notes: [], jumps: [] };
    for (const p of pts) this.gpush(tr.grid, p.x, p.z, p);
    // výškový profil: terén vzorkovaný podél trati a vyhlazený + skoky
    const T = (xx, zz) => this.terrain(tr, xx, zz);
    const raw = pts.map(p => T(p.x, p.z));
    const W = 10;
    for (let i = 0; i < pts.length; i++) { let a = 0, c = 0; for (let j = -W; j <= W; j++) { const q = raw[U.clamp(i + j, 0, raw.length - 1)]; a += q; c++; } pts[i].y = a / c; }
    // stoupání omezíme (s obtížností víc), pak profil několikrát vyhladíme – žádné zlomy a „schody“ ze svahu
    const G = stage.grade || 0.45;
    for (let i = 1; i < pts.length; i++) pts[i].y = U.clamp(pts[i].y, pts[i - 1].y - G, pts[i - 1].y + G);
    for (let pass = 0; pass < 4; pass++) {
      const ys = pts.map(p => p.y);
      for (let i = 0; i < pts.length; i++) { let a = 0, c = 0; for (let j = -6; j <= 6; j++) { const q = U.clamp(i + j, 0, ys.length - 1), w = 7 - Math.abs(j); a += ys[q] * w; c += w; } pts[i].y = a / c; }
    }
    for (let j = 0, tries = 0; j < stage.jumps && tries < 80; tries++) {
      const sj = 300 + rnd() * (tr.len - 600), ij = Math.round(sj / RT_STEP);
      let straight = true; for (let q = ij - 15; q < ij + 25; q++) if (Math.abs(pts[q].k) > 1 / 160) straight = false;
      if (!straight || tr.jumps.some(x => Math.abs(x - sj) < 250)) continue;     // skoky jen na rovinkách
      j++;
      tr.jumps.push(sj);
      for (let i = Math.max(0, ij - 12); i < Math.min(pts.length, ij + 6); i++) {
        const d = (i - ij) * RT_STEP;
        pts[i].y += d < 0 ? 2.1 * Math.exp(-(d * d) / 380) : 2.1 * Math.max(0, 1 - d / 9) * Math.exp(-(d * d) / 380);
      }
    }
    this.objects(tr, rnd);
    this.paceNotes(tr);
    this.placeCones(tr);
    tr.par = this.parTime(tr);
    tr.splits = [Math.round(tr.len * 0.36), Math.round(tr.len * 0.7)];
    return tr;
  },
  gkey(x, z) { return Math.floor(x / RT_CELL) * 73856 + Math.floor(z / RT_CELL); },
  gpush(g, x, z, o) { const k = this.gkey(x, z); let a = g.get(k); if (!a) g.set(k, a = []); a.push(o); },
  // přirozený terén: kopce + drobné nerovnosti
  terrain(tr, x, z) {
    const st = tr.stage, sd = tr.seed;
    return st.hills * (U.fbm(x / 340, z / 340, sd + 1, 3) * 16 + U.fbm(x / 110, z / 110, sd + 2, 2) * 4) + U.fbm(x / 23, z / 23, sd + 3, 2) * 0.7;
  },
  // nejbližší bod trati: index, vzdálenost, boční odchylka (+ vpravo), s
  nearest(tr, x, z, wide) {
    let best = null, bd = 1e18;
    const cx = Math.floor(x / RT_CELL), cz = Math.floor(z / RT_CELL), R = wide ? 3 : 1;
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) {
      const a = tr.grid.get((cx + dx) * 73856 + cz + dz); if (!a) continue;
      for (const p of a) { const ex = x - p.x, ez = z - p.z, d = ex * ex + ez * ez; if (d < bd) { bd = d; best = p; } }
    }
    if (!best) return wide ? null : this.nearest(tr, x, z, true);
    const P = tr.pts, i = P.indexOf ? best : best;
    const idx = Math.round(best.s / RT_STEP);
    // projekce na sousední úsečky
    let res = null;
    for (const j of [idx - 1, idx]) {
      if (j < 0 || j + 1 >= P.length) continue;
      const a = P[j], b = P[j + 1], abx = b.x - a.x, abz = b.z - a.z, L2 = abx * abx + abz * abz;
      const u = U.clamp(((x - a.x) * abx + (z - a.z) * abz) / L2, 0, 1), px = a.x + abx * u, pz = a.z + abz * u, d = Math.hypot(x - px, z - pz);
      if (!res || d < res.d) {
        const lat = ((x - px) * Math.cos(a.t + (b.t - a.t) * u) + (z - pz) * Math.sin(a.t + (b.t - a.t) * u));
        // výška po Catmull-Rom křivce (ne lomená čára) – na zlomech po 4 m by jinak pružiny dostávaly ťukance a auto poskakovalo
        const p0 = P[Math.max(0, j - 1)].y, p3 = P[Math.min(P.length - 1, j + 2)].y, u2 = u * u, u3 = u2 * u;
        const y = 0.5 * (2 * a.y + (-p0 + b.y) * u + (2 * p0 - 5 * a.y + 4 * b.y - p3) * u2 + (-p0 + 3 * a.y - 3 * b.y + p3) * u3);
        res = { d, lat, i: j, u, s: a.s + RT_STEP * u, y, w: a.w, surf: a.surf, t: a.t + (b.t - a.t) * u };
      }
    }
    return res || { d: Math.sqrt(bd), lat: 0, i: idx, u: 0, s: best.s, y: best.y, w: best.w, surf: best.surf, t: best.t };
  },
  // výška povrchu (silnice je rovná s mírným vyklenutím, okolí přechází do terénu)
  height(tr, x, z, nr) {
    nr = nr || this.nearest(tr, x, z);
    const T = this.terrain(tr, x, z);
    if (!nr) return T;
    const hw = nr.w / 2, d = nr.d;
    if (d < hw + 0.6) return nr.y - (d / hw) * (d / hw) * 0.08;
    const b = U.smooth(hw + 0.6, hw + 24, d);
    return U.lerp(nr.y - 0.08, T, b) + U.fbm(x / 11, z / 11, tr.seed + 9, 2) * 0.12 * b;   // krajnice: mírné vlny, ne „boule“, co auto vystřelí
  },
  surfAt(tr, x, z, nr) { nr = nr || this.nearest(tr, x, z); return !nr || nr.d > nr.w / 2 + 0.7 ? 'off' : nr.surf; },

  // ---------- překážky u trati ----------
  objects(tr, rnd) {
    const st = tr.stage, P = tr.pts, add = (o) => { tr.objs.push(o); this.gpush(tr.ogrid, o.x, o.z, o); };
    const side = (p, off) => ({ x: p.x + Math.cos(p.t) * off, z: p.z + Math.sin(p.t) * off });
    const clearOf = (x, z, m) => { const nr = this.nearest(tr, x, z); return !nr || nr.d > m; };
    const B = RALLY_BIOMES[st.biome] || RALLY_BIOMES.desert;
    // svodidla: tam, kde terén vedle silnice prudce padá (sráz), a na vnější straně rychlých zatáček
    tr.rails = [];
    const railOn = [new Uint8Array(P.length), new Uint8Array(P.length)];
    if (B.rails > 0) for (const [si, sd] of [[0, -1], [1, 1]]) {
      for (let i = 8; i < P.length - 8; i++) {
        const p = P[i], q = side(p, sd * (p.w / 2 + 6)), drop = p.y - this.terrain(tr, q.x, q.z);
        const outer = Math.sign(p.k) === -sd && Math.abs(p.k) > 1 / 150 && Math.abs(p.k) < 1 / 30 && B.rails >= 0.7;
        if (drop > 3.2 / B.rails || outer) for (let j = i - 4; j <= i + 4; j++) railOn[si][j] = 1;
      }
      let run = null;
      for (let i = 0; i <= P.length; i++) {
        if (i < P.length && railOn[si][i]) { if (!run) run = { sd, a: i }; }
        else if (run) { run.b = i - 1; if (run.b - run.a >= 5) tr.rails.push(run); else for (let j = run.a; j <= run.b; j++) railOn[si][j] = 0; run = null; }
      }
    }
    for (const r of tr.rails) for (let i = r.a; i < r.b; i++) for (const u of [0, 0.5]) {
      const a = P[i], b = P[i + 1], off = r.sd * (a.w / 2 + 0.9), qa = side(a, off), qb = side(b, off);
      add({ kind: 'rail', x: qa.x + (qb.x - qa.x) * u, z: qa.z + (qb.z - qa.z) * u, r: 0.42 });
    }
    // tyčky na krajích (každých 32 m, střídavě; ne tam, kde jsou svodidla)
    for (let s = 20, i = 0; s < tr.len - 20; s += 32, i++) { const pi = Math.round(s / RT_STEP), p = P[pi], sd = i % 2 ? 1 : -1; if (railOn[sd < 0 ? 0 : 1][pi]) continue; const q = side(p, sd * (p.w / 2 + 1.3)); add({ kind: 'pole', x: q.x, z: q.z, r: 0.12 }); }
    // rostliny a kameny podle prostředí – část schválně těsně u krajnice
    const dens = st.trees, props = B.props;
    const R0 = { tree: 0.32, joshua: 0.28, cactus: 0.3, rock: 0.9, pine: 0.3, oak: 0.36, bush: 0.5 };
    const put = (q, sc) => {
      const kind = U.pickWeighted(rnd(), props);
      add({ kind, x: q.x, z: q.z, r: R0[kind] * sc, sc, ry: rnd() * 6.28 });
    };
    for (let s = 40; s < tr.len - 30; s += 6) {
      const p = P[Math.round(s / RT_STEP)];
      for (const sd of [-1, 1]) {
        if (rnd() > 0.22 * dens) continue;
        const close = rnd() < B.close, off = sd * (p.w / 2 + (close ? 2.0 + rnd() * 3.5 : 6 + rnd() * 40)), q = side(p, off);
        if (!clearOf(q.x, q.z, p.w / 2 + 1.6)) continue;
        put(q, 0.7 + rnd() * 0.7);
      }
    }
    // les dál od trati (kulisa – hustě, ať je to opravdu les)
    if (B.dens > 2) for (let s = 30; s < tr.len - 20; s += 5) {
      const p = P[Math.round(s / RT_STEP)];
      for (const sd of [-1, 1]) {
        if (rnd() > 0.55) continue;
        const q = side(p, sd * (p.w / 2 + 9 + rnd() * rnd() * 70));
        if (!clearOf(q.x, q.z, p.w / 2 + 6)) continue;
        put(q, 0.8 + rnd() * 0.8);
      }
    }
    // kužely na silnici (úkol: srazit přesně 20) – rozeseté po celé etapě, střídavě vlevo, uprostřed a vpravo
    // diváci u několika zatáček
    tr.crowds = [];
    for (let j = 0; j < 5; j++) {
      const s = tr.len * (0.12 + j * 0.18) + rnd() * 60, p = P[Math.round(s / RT_STEP)], sd = p.k > 0 ? -1 : 1, q = side(p, sd * (p.w / 2 + 7));
      if (clearOf(q.x, q.z, p.w / 2 + 4)) tr.crowds.push({ x: q.x, z: q.z, t: p.t, sd });
    }
  },
  // kužely v zatáčkách na okraji trati – na vnější straně (smykem je zadkem smeteš) a občas u vrcholu na vnitřní
  placeCones(tr) {
    const P = tr.pts, rnd = U.rng(tr.seed + 404), add = (o) => { tr.objs.push(o); this.gpush(tr.ogrid, o.x, o.z, o); };
    const corners = tr.notes.filter(n => n.kind === 'corner' && n.sev <= 5 && n.s > 100 && n.end < tr.len - 80);
    const per = U.clamp(Math.round(RALLY_CONE_N / Math.max(1, corners.length)), 2, 4);
    let total = 0;
    for (const n of corners) {
      if (total >= RALLY_CONE_N + 12) break;
      const inside = rnd() < 0.3, outer = -n.dir, sd = inside ? n.dir : outer;
      const mid = n.s + (n.end - n.s) * (inside ? 0.45 : 0.6);
      for (let k = 0; k < per; k++) {
        const s = mid + (k - (per - 1) / 2) * 3.2, p = P[U.clamp(Math.round(s / RT_STEP), 0, P.length - 1)];
        const off = sd * (p.w / 2 - 0.35 + (k % 2) * 0.45);
        add({ kind: 'cone', x: p.x + Math.cos(p.t) * off, z: p.z + Math.sin(p.t) * off, r: 0.24, sc: 1, ry: rnd() * 6.28, s: p.s });
        total++;
      }
    }
    tr.coneN = total;
  },
  objsNear(tr, x, z) {
    const out = [], cx = Math.floor(x / RT_CELL), cz = Math.floor(z / RT_CELL);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const a = tr.ogrid.get((cx + dx) * 73856 + cz + dz); if (a) for (const o of a) out.push(o); }
    return out;
  },

  // ---------- rozpis spolujezdce ----------
  paceNotes(tr) {
    const P = tr.pts, notes = [], TH = 1 / 230;
    let i = 0;
    while (i < P.length) {
      if (Math.abs(P[i].k) < TH) { i++; continue; }
      const sg = Math.sign(P[i].k); let j = i, maxK = 0, firstMax = 0, half;
      while (j < P.length && (Math.sign(P[j].k) === sg && Math.abs(P[j].k) > TH * 0.6)) { maxK = Math.max(maxK, Math.abs(P[j].k)); j++; }
      half = Math.floor((i + j) / 2);
      for (let q = i; q < half; q++) firstMax = Math.max(firstMax, Math.abs(P[q].k));
      let secondMax = 0; for (let q = half; q < j; q++) secondMax = Math.max(secondMax, Math.abs(P[q].k));
      const R = 1 / maxK, len = (j - i) * RT_STEP, angle = Math.abs(P[Math.min(j, P.length - 1)].t - P[i].t);
      if (angle > 0.14) {
        const dirTxt = sg > 0 ? 'Pravá' : 'Levá';
        let sev = R < 22 ? 0 : R < 33 ? 1 : R < 48 ? 2 : R < 68 ? 3 : R < 98 ? 4 : R < 140 ? 5 : 6;
        let txt = sev === 0 ? `Vlásenka ${sg > 0 ? 'pravá' : 'levá'}` : `${dirTxt} ${sev}`;
        if (len > 90 && sev > 0) txt += ' dlouhá';
        if (secondMax > firstMax * 1.45) txt += ', utahuje se';
        else if (firstMax > secondMax * 1.45) txt += ', otevírá';
        notes.push({ s: P[i].s, end: P[Math.min(j, P.length - 1)].s, dir: sg, sev, txt, kind: 'corner' });
      }
      i = j + 1;
    }
    for (const sj of tr.jumps) notes.push({ s: sj - 25, txt: 'Skok! Rovně, drž stopu', kind: 'jump', sev: 9 });
    // horizonty (vypouklé místo, kde není vidět dál)
    for (let q = 6; q < P.length - 6; q += 2) {
      const c = (P[q + 5].y - 2 * P[q].y + P[q - 5].y) / 400;
      if (c < -0.006 && !notes.some(n => Math.abs(n.s - P[q].s) < 60)) { notes.push({ s: P[q].s - 10, txt: 'Přes horizont', kind: 'crest', sev: 8 }); q += 15; }
    }
    // změny povrchu
    for (let q = 1; q < P.length; q++) if (P[q].surf !== P[q - 1].surf) notes.push({ s: P[q].s - 15, txt: `Pozor, ${RALLY_SURF[P[q].surf].name.toLowerCase()}`, kind: 'surf', sev: 7 });
    notes.push({ s: tr.len - 60, txt: 'Cíl! Naplno do cíle', kind: 'finish', sev: 9 });
    notes.sort((a, b) => a.s - b.s);
    // vzdálenosti mezi pokyny („… a 150“)
    for (let q = 0; q < notes.length - 1; q++) {
      const gap = notes[q + 1].s - (notes[q].end || notes[q].s);
      notes[q].gap = gap;
      if (gap < 25 && notes[q].kind === 'corner' && notes[q + 1].kind === 'corner') notes[q].txt += ', hned';
      else if (gap >= 60) notes[q].txt += `, ${Math.round(gap / 50) * 50}`;
    }
    tr.notes = notes;
  },
  // referenční čas: rychlostní profil podle poloměru zatáček
  parTime(tr) {
    const P = tr.pts, v = P.map(p => Math.min(48, Math.sqrt(RALLY_SURF[p.surf].mu * 1.02 * 9.81 / Math.max(Math.abs(p.k), 1 / 2000))));
    v[0] = 0;
    for (let i = 1; i < v.length; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] * v[i - 1] + 2 * Math.max(0.5, 5.2 * (1 - v[i - 1] / 60) - RALLY_SURF[P[i].surf].roll * 9.81 * 3) * RT_STEP));
    for (let i = v.length - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * 6.5 * RALLY_SURF[P[i].surf].mu * RT_STEP));
    let t = 0; for (let i = 1; i < v.length; i++) t += RT_STEP / Math.max(1, (v[i] + v[i - 1]) / 2);
    return t * 1.07;
  },

  // ---------- textury silnice (kreslené na plátno) ----------
  // šířka textury = celý pás (krajnice + silnice + krajnice), výška = RT_TEX_LEN metrů; svisle navazuje
  roadTex(kind, B) {
    const key = kind + (B ? B.ground : '');
    this._rt = this._rt || {};
    if (this._rt[key]) return this._rt[key];
    const W = 512, H = 1024, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'), r = U.rng(kind.length * 977 + 13);
    const road0 = W * 0.163, road1 = W * 0.837, mid = W / 2, pxm = (road1 - road0) / 7.4;   // px na metr napříč
    const col = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    // kreslení s přesahem, aby textura svisle navazovala
    const wrap = (y, h, fn) => { fn(0); if (y - h < 0) fn(H); if (y + h > H) fn(-H); };
    const blot = (x, y, rx, ry, c, a) => wrap(y, ry, (o) => { g.fillStyle = col(c, a); g.beginPath(); g.ellipse(x, y + o, rx, ry, 0, 0, 7); g.fill(); });
    const stones = (n, x0, x1, smin, smax, cols) => {
      for (let i = 0; i < n; i++) {
        const x = x0 + r() * (x1 - x0), y = r() * H, sz = smin + r() * r() * (smax - smin), c = cols[Math.floor(r() * cols.length)];
        wrap(y, sz * 2, (o) => {
          g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x + sz * 0.35, y + o + sz * 0.35, sz, sz * 0.8, r() * 3, 0, 7); g.fill();
          g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.beginPath(); g.ellipse(x, y + o, sz, sz * 0.8, r() * 3, 0, 7); g.fill();
          g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(x - sz * 0.3, y + o - sz * 0.3, sz * 0.4, sz * 0.3, 0, 0, 7); g.fill();
        });
      }
    };
    const grain = (n, x0, x1, cols, a) => { for (let i = 0; i < n; i++) { g.fillStyle = col(cols[Math.floor(r() * cols.length)], a); g.fillRect(x0 + r() * (x1 - x0), r() * H, 1 + r() * 1.6, 1 + r() * 1.6); } };
    const streaks = (x, w, c, a, n) => { for (let i = 0; i < n; i++) { const xx = x + (r() - 0.5) * w, y = r() * H, L = 30 + r() * 160; wrap(y, L, (o) => { g.fillStyle = col(c, a * (0.4 + r() * 0.6)); g.fillRect(xx, y + o, 1 + r() * 1.5, L); }); } };
    const gb = B ? new THREE.Color(B.ground) : new THREE.Color(0xc8a870), gc = [gb.r * 255 | 0, gb.g * 255 | 0, gb.b * 255 | 0];
    const shoulder = (base, cols) => {
      // krajnice: rozježděný materiál silnice, ven přechází do okolního terénu (a průhlednosti)
      for (const [x0, x1] of [[0, road0], [road1, W]]) { g.fillStyle = col(base, 1); g.fillRect(x0, 0, x1 - x0, H); }
      for (let i = 0; i < 900; i++) { const left = r() < 0.5, d = r() * road0 * 0.9, x = left ? d : W - d, y = r() * H; blot(x, y, 4 + r() * 14, 6 + r() * 30, gc, 0.12 + (1 - d / road0) * 0.45); }
      grain(9000, 0, road0, cols, 0.5); grain(9000, road1, W, cols, 0.5);
      if (B && B.dens > 1.5) for (let i = 0; i < 700; i++) { const left = r() < 0.5, d = r() * road0 * 0.85, x = left ? d : W - d, y = r() * H; g.strokeStyle = col([60 + r() * 30 | 0, 90 + r() * 40 | 0, 40], 0.7); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 5, y - 4 - r() * 7); g.stroke(); }
    };
    if (kind === 'gravel') {
      const base = [158, 140, 112];
      g.fillStyle = col(base, 1); g.fillRect(0, 0, W, H);
      for (let i = 0; i < 260; i++) blot(road0 + r() * (road1 - road0), r() * H, 20 + r() * 60, 30 + r() * 120, r() < 0.5 ? [120, 104, 82] : [184, 168, 138], 0.18);
      grain(60000, road0, road1, [[120, 106, 86], [190, 176, 150], [140, 124, 100], [96, 84, 70], [210, 196, 170]], 0.7);
      // vyjeté koleje (dvě dvojice) – udusané, tmavší a hladší
      for (const lat of [-2.55, -0.85, 0.85, 2.55]) {
        const x = mid + lat * pxm, w = 0.55 * pxm;
        const grd = g.createLinearGradient(x - w, 0, x + w, 0); grd.addColorStop(0, col([110, 96, 76], 0)); grd.addColorStop(0.5, col([104, 90, 72], 0.55)); grd.addColorStop(1, col([110, 96, 76], 0));
        g.fillStyle = grd; g.fillRect(x - w, 0, w * 2, H);
        streaks(x, w * 1.2, [80, 70, 56], 0.35, 140);
      }
      // volný štěrk mezi kolejemi a u krajů (větší kamínky)
      const sc = [[150, 136, 112], [176, 162, 136], [128, 116, 96], [198, 186, 162], [110, 100, 88]];
      for (const [a, b] of [[-3.7, -3.05], [-1.9, -1.4], [-0.35, 0.35], [1.4, 1.9], [3.05, 3.7]]) stones(700, mid + a * pxm, mid + b * pxm, 1.2, 4.5, sc);
      stones(1500, road0, road1, 0.8, 2.6, sc);
      for (let i = 0; i < 6; i++) { const x = road0 + (0.15 + r() * 0.7) * (road1 - road0), y = r() * H; blot(x, y, 14 + r() * 16, 10 + r() * 12, [86, 74, 60], 0.5); blot(x - 3, y - 2, 9, 6, [70, 60, 50], 0.4); }   // výmoly
      shoulder([150, 134, 106], [[130, 116, 92], [176, 160, 132], [110, 98, 80]]);
    } else if (kind === 'asphalt') {
      const base = [74, 74, 76];
      g.fillStyle = col(base, 1); g.fillRect(0, 0, W, H);
      for (let i = 0; i < 200; i++) blot(road0 + r() * (road1 - road0), r() * H, 30 + r() * 70, 40 + r() * 140, r() < 0.5 ? [60, 60, 62] : [92, 92, 94], 0.2);
      grain(90000, road0, road1, [[40, 40, 42], [110, 108, 104], [88, 86, 84], [130, 126, 120], [56, 56, 58]], 0.8);
      // ojeté stopy (světlejší, vyhlazené) a tmavý olejový pruh uprostřed jízdních pruhů
      for (const lat of [-2.5, -0.9, 0.9, 2.5]) { const x = mid + lat * pxm, w = 0.5 * pxm, grd = g.createLinearGradient(x - w, 0, x + w, 0); grd.addColorStop(0, col([100, 100, 100], 0)); grd.addColorStop(0.5, col([104, 104, 102], 0.35)); grd.addColorStop(1, col([100, 100, 100], 0)); g.fillStyle = grd; g.fillRect(x - w, 0, w * 2, H); }
      for (const lat of [-1.7, 1.7]) { const x = mid + lat * pxm, w = 0.35 * pxm, grd = g.createLinearGradient(x - w, 0, x + w, 0); grd.addColorStop(0, col([30, 30, 32], 0)); grd.addColorStop(0.5, col([30, 30, 32], 0.3)); grd.addColorStop(1, col([30, 30, 32], 0)); g.fillStyle = grd; g.fillRect(x - w, 0, w * 2, H); }
      // záplaty a praskliny
      for (let i = 0; i < 5; i++) { const x = road0 + r() * (road1 - road0 - 60), y = r() * (H - 120), w = 40 + r() * 90, h = 50 + r() * 140; g.fillStyle = col(r() < 0.5 ? [52, 52, 54] : [88, 88, 88], 0.75); g.fillRect(x, y, w, h); g.strokeStyle = 'rgba(25,25,25,.6)'; g.lineWidth = 1.5; g.strokeRect(x, y, w, h); grain(800, x, x + w, [[40, 40, 40], [100, 100, 100]], 0.6); }
      g.strokeStyle = 'rgba(22,22,24,.75)'; g.lineWidth = 1.3;
      for (let i = 0; i < 30; i++) { let x = road0 + r() * (road1 - road0), y = r() * H; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 22; y += 4 + r() * 16; g.lineTo(x, y); } g.stroke(); }
      // krajnicové čáry (lehce opotřebované) a přerušovaná střední
      for (const x of [road0 + 0.22 * pxm, road1 - 0.22 * pxm]) { g.fillStyle = 'rgba(236,232,220,.9)'; g.fillRect(x - 0.06 * pxm, 0, 0.12 * pxm, H); grain(2500, x - 0.07 * pxm, x + 0.07 * pxm, [[74, 74, 76], [110, 108, 104]], 0.7); }
      for (let y = 0; y < H; y += H / 4) { g.fillStyle = 'rgba(236,232,220,.8)'; g.fillRect(mid - 0.05 * pxm, y, 0.1 * pxm, H / 8); }
      shoulder([138, 124, 100], [[110, 100, 84], [160, 146, 120], [96, 90, 80]]);
      // hrana asfaltu: drobné vylomení do krajnice
      for (let i = 0; i < 260; i++) { const left = r() < 0.5, y = r() * H; blot(left ? road0 - r() * 6 : road1 + r() * 6, y, 2 + r() * 6, 3 + r() * 8, [68, 68, 70], 0.9); }
    } else {
      const base = [222, 192, 138];
      g.fillStyle = col(base, 1); g.fillRect(0, 0, W, H);
      for (let i = 0; i < 220; i++) blot(road0 + r() * (road1 - road0), r() * H, 30 + r() * 70, 40 + r() * 120, r() < 0.5 ? [206, 174, 122] : [236, 210, 160], 0.25);
      // čeřiny od větru
      g.lineWidth = 2;
      for (let y = 0; y < H; y += 7 + r() * 5) { g.strokeStyle = col([190, 158, 108], 0.25 + r() * 0.15); g.beginPath(); for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 3); g.stroke(); }
      grain(50000, 0, W, [[200, 170, 120], [240, 218, 172], [180, 150, 104]], 0.6);
      // rozbrázděné stopy kol
      for (const lat of [-2.5, -0.85, 0.85, 2.5]) { const x = mid + lat * pxm, w = 0.6 * pxm; const grd = g.createLinearGradient(x - w, 0, x + w, 0); grd.addColorStop(0, col([176, 142, 94], 0)); grd.addColorStop(0.5, col([176, 142, 94], 0.55)); grd.addColorStop(1, col([176, 142, 94], 0)); g.fillStyle = grd; g.fillRect(x - w, 0, w * 2, H); streaks(x, w, [150, 118, 76], 0.4, 160); streaks(x + w * 0.7, w * 0.3, [246, 226, 186], 0.4, 60); }
      shoulder([214, 184, 132], [[196, 166, 118], [236, 212, 166]]);
    }
    // průhledný okraj (nerovný), aby krajnice splynula s terénem
    const id = g.getImageData(0, 0, W, H), d = id.data, edge = W * 0.075;
    for (let y = 0; y < H; y++) {
      const wob = (Math.sin(y * 0.031) + Math.sin(y * 0.0123 + 2) * 1.3) * 6;
      for (let x = 0; x < W; x++) {
        const e = Math.min(x, W - 1 - x) + wob + (Math.random() - 0.5) * 10;
        if (e < edge) d[(y * W + x) * 4 + 3] = Math.max(0, Math.min(255, e / edge * 255));
      }
    }
    g.putImageData(id, 0, 0);
    const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = Game.renderer && Game.renderer.capabilities ? Math.min(8, Game.renderer.capabilities.getMaxAnisotropy()) : 4;
    return (this._rt[key] = t);
  },

  // ---------- 3D scéna etapy ----------
  build(sc, tr) {
    const P = tr.pts, st = tr.stage;
    // terén po dlaždicích jen kolem trati (jedna geometrie)
    const CH = 96, SEG = 16, cs = CH / SEG, need = new Set();
    for (let i = 0; i < P.length; i += 4) {
      const p = P[i];
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) need.add((Math.floor(p.x / CH) + dx) + ',' + (Math.floor(p.z / CH) + dz));
    }
    const B = RALLY_BIOMES[st.biome] || RALLY_BIOMES.desert;
    const pos = [], col = [], uv = [], c = new THREE.Color(), base = new THREE.Color(B.ground), rockC = new THREE.Color(B.rock), dark = new THREE.Color(B.ground).multiplyScalar(0.72);
    let minY = 1e9;
    for (const key of need) {
      const [ci, cj] = key.split(',').map(Number), x0 = ci * CH, z0 = cj * CH, H = [];
      for (let a = 0; a <= SEG; a++) for (let b = 0; b <= SEG; b++) {
        const x = x0 + b * cs, z = z0 + a * cs, nr = this.nearest(tr, x, z), y = this.height(tr, x, z, nr) - (nr && nr.d < nr.w / 2 + 3 ? 0.35 : 0);
        H.push(y); if (y < minY) minY = y;
      }
      const V = (a, b) => [x0 + b * cs, H[a * (SEG + 1) + b], z0 + a * cs];
      for (let a = 0; a < SEG; a++) for (let b = 0; b < SEG; b++) {
        const q = [V(a, b), V(a + 1, b), V(a, b + 1), V(a + 1, b), V(a + 1, b + 1), V(a, b + 1)];
        const slope = Math.abs(q[0][1] - q[4][1]) / cs, n = U.hash(ci * 31 + b, cj * 17 + a, tr.seed);
        const patch = U.clamp(U.fbm((x0 + b * cs) / 60, (z0 + a * cs) / 60, tr.seed + 5, 2) * 1.6 + 0.4, 0, 1);
        c.copy(base).lerp(dark, patch * 0.6).lerp(rockC, U.clamp(slope * 1.4 - 0.2, 0, 0.85)).multiplyScalar(0.93 + n * 0.12);
        for (const v of q) { pos.push(v[0], v[1], v[2]); col.push(c.r, c.g, c.b); uv.push(v[0] / 5, v[2] / 5); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const terr = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, map: Tex.get('ground') })); terr.receiveShadow = true; sc.add(terr);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshLambertMaterial({ color: base.clone().multiplyScalar(0.95) }));
    far.rotation.x = -Math.PI / 2; far.position.set(P[P.length >> 1].x, minY - 0.5, P[P.length >> 1].z); sc.add(far);
    // silnice: pásy podle povrchu + krajnice
    const meshes = { asphalt: [[], [], []], gravel: [[], [], []], sand: [[], [], []] };
    const vtx = (p, l, dy) => { const x = p.x + Math.cos(p.t) * l, z = p.z + Math.sin(p.t) * l; return [x, (Math.abs(l) <= p.w / 2 + 0.01 ? p.y - (l / (p.w / 2)) ** 2 * 0.08 : this.height(tr, x, z)) + 0.05 + (dy || 0), z]; };
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], M = meshes[a.surf], hw = a.w / 2;
      const lat = [-hw - 1.8, -hw, hw, hw + 1.8];
      for (let k = 0; k < 3; k++) {
        const a0 = vtx(a, lat[k]), a1 = vtx(a, lat[k + 1]), b0 = vtx(b, lat[k] * b.w / a.w), b1 = vtx(b, lat[k + 1] * b.w / a.w);
        const [pp, cc, uu] = M, shade = 1, sh = 0.95 + U.fbm(a.s / 40, k, tr.seed + 21, 2) * 0.12;
        pp.push(...a0, ...a1, ...b0, ...a1, ...b1, ...b0);
        for (let q = 0; q < 6; q++) cc.push(shade * sh, shade * sh, shade * sh);
        const W2 = hw + 1.8, u0 = (lat[k] + W2) / (2 * W2), u1 = (lat[k + 1] + W2) / (2 * W2), v0 = a.s / RT_TEX_LEN, v1 = b.s / RT_TEX_LEN;
        uu.push(u0, v0, u1, v0, u0, v1, u1, v0, u1, v1, u0, v1);
      }
    }
    const roadMat = {};
    for (const k of ['asphalt', 'gravel', 'sand']) roadMat[k] = new THREE.MeshLambertMaterial({ map: this.roadTex(k, B), vertexColors: true, transparent: true, depthWrite: true });
    for (const [k, [pp, cc, uu]] of Object.entries(meshes)) {
      if (!pp.length) continue;
      const rg = new THREE.BufferGeometry();
      rg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); rg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3)); rg.setAttribute('uv', new THREE.Float32BufferAttribute(uu, 2));
      rg.computeVertexNormals();
      const m = new THREE.Mesh(rg, roadMat[k]); m.receiveShadow = true; m.renderOrder = 1; sc.add(m);
    }
    const Q = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
    // překážky (instancované)
    const groups = {};
    const inst = (key, geo, mat, list, setM) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length); im.castShadow = true; im.receiveShadow = true;
      list.forEach((o, i) => { const mm = setM(o); im.setMatrixAt(i, mm); (o.inst = o.inst || []).push({ im, i, m: mm }); }); sc.add(im); groups[key] = im;
    };
    const mat4 = (x, y, z, ry, sx, sy, sz) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, ry || 0), new THREE.Vector3(sx, sy || sx, sz || sx));
    const by = (k) => tr.objs.filter(o => o.kind === k);
    tr.objs.forEach(o => { o.y = this.height(tr, o.x, o.z); });
    // tyčky (bílé s červenou hlavou)
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.07, 1.2, 6); poleGeo.translate(0, 0.6, 0);
    inst('pole', poleGeo, new THREE.MeshLambertMaterial({ color: 0xf2efe8 }), by('pole'), o => mat4(o.x, o.y, o.z, 0, 1));
    const capGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.22, 6); capGeo.translate(0, 1.1, 0);
    inst('poleCap', capGeo, new THREE.MeshLambertMaterial({ color: 0xd8301a, emissive: 0x300800 }), by('pole'), o => mat4(o.x, o.y, o.z, 0, 1));
    // akácie: kmen + plochá koruna
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 3, 7); trunkGeo.translate(0, 1.5, 0);
    inst('trunk', trunkGeo, U.mat(0x6a4a30), by('tree'), o => mat4(o.x, o.y, o.z, o.ry, o.sc));
    const crownGeo = new THREE.SphereGeometry(1.9, 9, 5); crownGeo.scale(1, 0.38, 1); crownGeo.translate(0, 3.2, 0);
    inst('crown', crownGeo, U.mat(0x6f8a3a), by('tree'), o => mat4(o.x, o.y, o.z, o.ry, o.sc));
    // joshua strom
    const jGeo = new THREE.CylinderGeometry(0.14, 0.22, 2.6, 6); jGeo.translate(0, 1.3, 0);
    inst('jtrunk', jGeo, U.mat(0x7a6040), by('joshua'), o => mat4(o.x, o.y, o.z, o.ry, o.sc));
    const jTop = new THREE.ConeGeometry(0.55, 0.9, 7); jTop.translate(0, 2.9, 0);
    inst('jtop', jTop, U.mat(0x5a7a3a), by('joshua'), o => mat4(o.x, o.y, o.z, o.ry, o.sc));
    // kaktusy
    const cGeo = new THREE.CylinderGeometry(0.22, 0.26, 2.2, 8); cGeo.translate(0, 1.1, 0);
    inst('cactus', cGeo, U.mat(0x3f7a3a), by('cactus'), o => mat4(o.x, o.y, o.z, o.ry, o.sc));
    const armGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.9, 7); armGeo.translate(0.42, 1.3, 0);
    inst('carm', armGeo, U.mat(0x3f7a3a), by('cactus'), o => mat4(o.x, o.y, o.z, o.ry, o.sc));
    // kameny
    const rGeo = new THREE.DodecahedronGeometry(0.95, 0); rGeo.scale(1, 0.65, 1);
    inst('rock', rGeo, U.mat(B.rock), by('rock'), o => mat4(o.x, o.y + 0.2, o.z, o.ry, o.sc));
    // kužely: oranžové s bílým pruhem a černou základnou
    const cones = by('cone');
    const cBase = new THREE.BoxGeometry(0.42, 0.04, 0.42); cBase.translate(0, 0.02, 0);
    inst('conebase', cBase, U.mat(0x1a1a1a), cones, o => mat4(o.x, o.y, o.z, o.ry, 1));
    const cBody = new THREE.ConeGeometry(0.17, 0.7, 12, 1, true); cBody.translate(0, 0.39, 0);
    inst('cone', cBody, new THREE.MeshLambertMaterial({ color: 0xff6a10, emissive: 0x401000, side: THREE.DoubleSide }), cones, o => mat4(o.x, o.y, o.z, o.ry, 1));
    const cStr = new THREE.CylinderGeometry(0.085, 0.115, 0.13, 12, 1, true); cStr.translate(0, 0.46, 0);
    inst('conestripe', cStr, new THREE.MeshLambertMaterial({ color: 0xf4f4f0, emissive: 0x303030 }), cones, o => mat4(o.x, o.y + 0.001, o.z, o.ry, 1.04));
    // smrk: kmen + tři patra jehličí
    const pines = by('pine');
    const pTrunk = new THREE.CylinderGeometry(0.12, 0.24, 3.2, 6); pTrunk.translate(0, 1.6, 0);
    inst('ptrunk', pTrunk, U.mat(0x5a3e26), pines, o => mat4(o.x, o.y, o.z, o.ry, o.sc, o.sc * 1.25, o.sc));
    [[1.7, 2.6, 2.4], [1.3, 2.2, 4.0], [0.85, 1.8, 5.4]].forEach(([r, hgt, y], k) => {
      const cg = new THREE.ConeGeometry(r, hgt, 8); cg.translate(0, y, 0);
      inst('pcone' + k, cg, U.mat(k === 1 ? 0x2f5a30 : 0x2a502c), pines, o => mat4(o.x, o.y, o.z, o.ry + k, o.sc, o.sc * 1.25, o.sc));
    });
    // listnatý strom: kmen + kulatá koruna
    const oTrunk = new THREE.CylinderGeometry(0.18, 0.3, 2.6, 7); oTrunk.translate(0, 1.3, 0);
    inst('otrunk', oTrunk, U.mat(0x5e4630), by('oak'), o => mat4(o.x, o.y, o.z, o.ry, o.sc));
    const oCrown = new THREE.IcosahedronGeometry(2.1, 1); oCrown.scale(1, 0.85, 1); oCrown.translate(0, 3.6, 0);
    inst('ocrown', oCrown, U.mat(0x4f7a32), by('oak'), o => mat4(o.x, o.y, o.z, o.ry, o.sc));
    // keře
    const bGeo = new THREE.IcosahedronGeometry(0.7, 0); bGeo.scale(1, 0.7, 1); bGeo.translate(0, 0.4, 0);
    inst('bush', bGeo, U.mat(st.biome === 'dunes' ? 0x8a8a4a : 0x4a6a2e), by('bush'), o => mat4(o.x, o.y, o.z, o.ry, o.sc));
    // svodidla: sloupky + pozinkovaná vlnovka
    const railM = new U.Merger(), Zv = new THREE.Vector3(0, 0, 1);
    for (const r of tr.rails || []) {
      let prev = null;
      for (let i = r.a; i <= r.b; i++) {
        const p = P[i], off = r.sd * (p.w / 2 + 0.9), x = p.x + Math.cos(p.t) * off, z = p.z + Math.sin(p.t) * off, y = this.height(tr, x, z);
        railM.add(U.unitBox, new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.35, z), new THREE.Quaternion().setFromAxisAngle(Y, -p.t), new THREE.Vector3(0.1, 0.9, 0.1)), 0x5a5e62);
        const cur = new THREE.Vector3(x, y + 0.6, z);
        if (prev) {
          const d = cur.clone().sub(prev), L = d.length(), mid = prev.clone().add(cur).multiplyScalar(0.5);
          const q = new THREE.Quaternion().setFromUnitVectors(Zv, d.normalize());
          railM.add(U.unitBox, new THREE.Matrix4().compose(mid, q, new THREE.Vector3(0.06, 0.32, L + 0.05)), 0xb8bcc0);
        }
        prev = cur;
      }
    }
    const rlm = railM.build(new THREE.MeshLambertMaterial({ vertexColors: true })); if (rlm) { rlm.castShadow = true; rlm.receiveShadow = true; sc.add(rlm); }
    // hory na obzoru (mimo trať, blednou do mlhy)
    if (B.mountN > 0) {
      const mrnd = U.rng(tr.seed + 77), mpos = [], mcol = [], mc = new THREE.Color(B.mount), snow = new THREE.Color(0xf4f6fa), tmpC = new THREE.Color();
      const far = (x, z) => { for (let i = 0; i < P.length; i += 6) if ((P[i].x - x) ** 2 + (P[i].z - z) ** 2 < 260 * 260) return false; return true; };
      const cnt = Math.round(tr.len / 110 * B.mountN);
      for (let k = 0, tries = 0; k < cnt && tries < cnt * 6; tries++) {
        const p = P[Math.floor(mrnd() * P.length)], sd = mrnd() < 0.5 ? -1 : 1, off = sd * (330 + mrnd() * 520), x = p.x + Math.cos(p.t) * off, z = p.z + Math.sin(p.t) * off;
        if (!far(x, z)) continue;
        k++;
        const Rm = 110 + mrnd() * 200, Hm = (70 + mrnd() * 170) * (B.snow ? 1.4 : 1), geo = new THREE.ConeGeometry(Rm, Hm, 9, 4).toNonIndexed();
        const pa = geo.attributes.position, cols = [];
        for (let v = 0; v < pa.count; v++) {
          const yy = pa.getY(v) + Hm / 2, j = U.hash(Math.round(pa.getX(v)), Math.round(pa.getZ(v) + yy), tr.seed) - 0.5;
          if (yy > 1 && yy < Hm - 1) { pa.setX(v, pa.getX(v) * (1 + j * 0.35)); pa.setZ(v, pa.getZ(v) * (1 + j * 0.35)); pa.setY(v, pa.getY(v) + j * Hm * 0.08); }
          tmpC.copy(mc).multiplyScalar(0.85 + yy / Hm * 0.3);
          if (B.snow && yy > Hm * 0.62) tmpC.copy(snow);
          cols.push(tmpC.r, tmpC.g, tmpC.b);
        }
        geo.translate(x, Hm / 2 + minY - 6, z); // pata pod rovinou vzdáleného terénu (ten leží na minY) – jinak hora visí ve vzduchu
        for (let v = 0; v < pa.count; v++) mpos.push(pa.getX(v), pa.getY(v), pa.getZ(v));
        mcol.push(...cols);
      }
      if (mpos.length) {
        const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(mpos, 3)); mg.setAttribute('color', new THREE.Float32BufferAttribute(mcol, 3)); mg.computeVertexNormals();
        sc.add(new THREE.Mesh(mg, new THREE.MeshLambertMaterial({ vertexColors: true })));
      }
    }
    tr.inst = groups;
    // diváci
    const people = new U.Merger(), cols = [0xd8402a, 0x2a6ab0, 0xe8b81a, 0x3a8a4a, 0xf2f2f2, 0x8a3ab0, 0xe07020];
    for (const cr of tr.crowds) {
      for (let k = 0; k < 16; k++) {
        const along = (k % 8 - 4) * 1.2, back = Math.floor(k / 8) * 1.1, x = cr.x + Math.sin(cr.t) * along + Math.cos(cr.t) * cr.sd * back, z = cr.z - Math.cos(cr.t) * along + Math.sin(cr.t) * cr.sd * back, y = this.height(tr, x, z);
        const cc = cols[(k * 7 + Math.floor(cr.x)) % cols.length];
        people.addBox(0.45, 0.85, 0.3, x, y + 1.1, z, -cr.t, cc); people.addBox(0.32, 0.9, 0.25, x, y + 0.45, z, -cr.t, 0x2a2e3a); people.addBox(0.26, 0.26, 0.26, x, y + 1.68, z, -cr.t, 0xc68a5e);
      }
      // páska
      for (let k = -6; k <= 6; k++) { const x = cr.x - Math.cos(cr.t) * cr.sd * 1.6 + Math.sin(cr.t) * k, z = cr.z - Math.sin(cr.t) * cr.sd * 1.6 - Math.cos(cr.t) * k; people.addBox(0.05, 0.9, 0.05, x, this.height(tr, x, z) + 0.45, z, 0, 0xd8d8d8); }
      const tx = cr.x - Math.cos(cr.t) * cr.sd * 1.6, tz = cr.z - Math.sin(cr.t) * cr.sd * 1.6;
      people.addBox(0.02, 0.06, 12, tx, this.height(tr, tx, tz) + 0.85, tz, -cr.t, 0xe8302a);
    }
    if (tr.crowds.length) { const pm = people.build(new THREE.MeshLambertMaterial({ vertexColors: true })); pm.castShadow = true; sc.add(pm); }
    // start, mezičasy a cíl (brány)
    const gate = (s, text, bg, fg) => {
      const p = P[Math.min(P.length - 1, Math.round(s / RT_STEP))], g2 = new THREE.Group(); g2.position.set(p.x, p.y, p.z); g2.rotation.y = -p.t; sc.add(g2);
      const hw = p.w / 2 + 1;
      for (const sx of [-hw, hw]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5, 0.35), U.mat(0x2a2a2a)); m.position.set(sx, 2.5, 0); m.castShadow = true; g2.add(m); }
      const ban = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.4, 1.1, 0.12), new THREE.MeshLambertMaterial({ map: U.textTexture(text, 512, 64, bg, fg) }));
      ban.position.set(0, 4.7, 0); g2.add(ban);
      const ban2 = ban.clone(); ban2.rotation.y = Math.PI; ban2.position.z = -0.01; g2.add(ban2);
      return g2;
    };
    gate(8, 'START · ' + st.name.toUpperCase(), '#1a1410', '#ffb347');
    tr.splits.forEach((s, i) => gate(s, `MEZIČAS ${i + 1}`, '#20304a', '#9ad0ff'));
    gate(tr.len - 12, '🏁 CÍL', '#f2f2f2', '#111111');
    return { minY };
  },
};
