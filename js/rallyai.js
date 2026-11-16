// rallyai.js – závod s AI soupeři: 10 aut na stejné etapě, hromadný start, kolize auto–auto, průběžné pořadí a výsledky
const RALLY_AI_N = 3;   // závod proti AI: 4 auta včetně hráče
const RALLY_AI_NAMES = ['Pepa Kolínský', 'Míra Štěrk', 'Vláďa Turbo', 'Honza Skok', 'Zdeněk Prach', 'Láďa Drift', 'Kuba Bláto', 'Ota Šotolina', 'Franta Smyk', 'Radek Ručka', 'Tonda Výfuk', 'Petr Klopenka', 'Jarda Hrubý', 'Mirek Brzda'];
const RALLY_AI_PAINT = [0xd81e1e, 0x1e5ad8, 0x18a048, 0xf0c020, 0xf07818, 0x8a2ad0, 0x10b8c8, 0xf0f0ea, 0x26282c, 0xe0407a, 0x6a8a20, 0xa0a4ac];
const RALLY_AI_COL = '#9fd0ff';

Object.assign(Rally, {
  // zjednodušený model postavený jednou: všechny díly sloučené do pár meshů (lak / ostatní / skla / obrysy + 4 kola)
  aiTemplate() {
    if (this._aiTpl) return this._aiTpl;
    const p = CarModel.build(0xffffff);
    p.root.updateMatrixWorld(true);
    const body = new U.Merger(), paint = new U.Merger(), glass = new U.Merger(), lines = [];
    const wheelPiv = new Set(p.wheels.map(w => w.pivot)), M = new THREE.Matrix4(), v = new THREE.Vector3();
    const addLines = (o, mat) => { const a = o.geometry.attributes.position; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(mat); lines.push(v.x, v.y, v.z); } };
    const walk = (o) => {
      if (!o.visible || o.isCamera || o.isLight || wheelPiv.has(o)) return;
      if (o.isMesh) {
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        M.copy(o.matrixWorld);
        if (m === p.paintMat) paint.add(o.geometry, M, 0xffffff);
        else if (m.transparent) { if (!m.isMeshBasicMaterial) glass.add(o.geometry, M, m.color || 0x9fc6d0); }
        else body.add(o.geometry, M, m.map ? 0x2c2c2c : (m.color || 0x888888));
      } else if (o.isLineSegments) addLines(o, o.matrixWorld);
      for (const ch of o.children) walk(ch);
    };
    walk(p.root);
    const wheels = p.wheels.map(w => {
      const mg = new U.Merger(), inv = new THREE.Matrix4().copy(w.spin.matrixWorld).invert();
      w.spin.traverse(o => { if (!o.isMesh || !o.visible) return; const m = o.material; M.multiplyMatrices(inv, o.matrixWorld); mg.add(o.geometry, M, m.map ? 0x1c1c1c : m === w.rimMat ? 0xd8d8d0 : (m.color || 0x888888)); });
      return { x: w.x, y: w.pivot.position.y, z: w.z, front: w.front, g: mg.build().geometry };
    });
    for (const mr of p.mirrors || []) mr.rt.dispose();
    let lg = null;
    if (lines.length) { lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)); }
    return (this._aiTpl = {
      body: body.build().geometry, paint: paint.build().geometry, glass: glass.pos.length ? glass.build().geometry : null, lines: lg, wheels,
      glassMat: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }),
    });
  },
  aiMakeVis(paint) {
    const T = this.aiTemplate(), root = new THREE.Group();
    const add = (g, mat, sh) => { const m = new THREE.Mesh(g, mat); m.castShadow = sh; root.add(m); return m; };
    const pm = new THREE.MeshLambertMaterial({ color: paint });
    add(T.body, U.vcMat, true); add(T.paint, pm, true); if (T.glass) add(T.glass, T.glassMat, false);
    if (T.lines) root.add(new THREE.LineSegments(T.lines, CarModel.outlineMat));
    const wheels = T.wheels.map(w => {
      const pivot = new THREE.Group(); pivot.position.set(w.x, w.y, w.z); root.add(pivot);
      const spin = new THREE.Mesh(w.g, U.vcMat); spin.castShadow = true; pivot.add(spin);
      return { pivot, spin, front: w.front, x: w.x, z: w.z };
    });
    return { root, wheels, paintMat: pm };
  },
  aiClear() {
    if (this.ais && this.cur) for (const a of this.ais) { this.cur.sc.remove(a.vis.root); a.vis.paintMat.dispose(); }
    this.ais = null;
  },
  // místo na startovním roštu (s = vzdálenost na trati, lat = do strany, + vpravo)
  aiGridPos(tr, s, lat) {
    const p = tr.pts[Math.min(tr.pts.length - 2, Math.round(s / RT_STEP))], x = p.x + Math.cos(p.t) * lat, z = p.z + Math.sin(p.t) * lat;
    return { x, z, y: RallyTrack.height(tr, x, z), h: Math.PI - p.t, s: p.s };
  },
  aiSetup() {
    const S = this.cur, tr = S.tr, me = this.my, st = me.stats, stage = S.stage;
    // nejlepší směs pneumatik pro tuhle etapu (AI ji má vždycky)
    let best = st.tire.c, bg = -1;
    for (const c of Object.keys(RALLY_COMPOUND)) { const g = this.stageGrip({ tire: { c, tier: 1 } }, stage); if (g > bg) { bg = g; best = c; } }
    const slots = [];
    for (let r = 0; r < 2; r++) for (const sd of [-1, 1]) slots.push({ s: 72 - r * 8.5 - (sd > 0 ? 3 : 0), lat: sd * 1.75 });
    const meSlot = 2;   // hráč startuje ve 2. řadě – dva soupeři před ním, jeden vedle
    const names = RALLY_AI_NAMES.slice().sort(() => Math.random() - 0.5), paints = RALLY_AI_PAINT.slice().sort(() => Math.random() - 0.5);
    this.ais = [];
    let k = 0;
    slots.forEach((sl, i) => {
      if (i === meSlot) {
        const g = this.aiGridPos(tr, sl.s, sl.lat);
        me.car.reset(g.x, g.z, g.h, g.y); this.sProg = g.s; this._cp = null; this.gridS = g.s;
        Object.assign(me.pose, { x: g.x, z: g.z, y: g.y, h: g.h, s: g.s });
        return;
      }
      if (k >= RALLY_AI_N) return;
      const g = this.aiGridPos(tr, sl.s, sl.lat);
      const row = Math.floor(i / 2);
      const stats = Object.assign({}, st, { hp: st.hp * (0.9 + Math.random() * 0.22), tire: { c: best, tier: st.tire.tier }, auto: true, noRev: true });   // AI nikdy nepřeřadí na zpátečku brzdou
      const car = new RallyCar(stats); car.reset(g.x, g.z, g.h, g.y);
      const vis = this.aiMakeVis(paints[k % paints.length]); S.sc.add(vis.root);
      this.ais.push({
        ai: true, id: 100 + k, crew: names[k], car, vis, s0: g.s, sProg: g.s, res: null, nr: null,
        skill: 0.86 - k * 0.022 + Math.random() * 0.03, home: sl.lat * 0.5, lane: sl.lat, stuckT: 0, offT: 0, react: 0.15 + row * 0.55 + Math.random() * 0.25, dT: 0,   // řady startují postupně → žádný hromadný náraz
      });
      k++;
    });
  },
  // řízení AI: míří na bod před sebou ve svém pruhu, brzdí podle zatáček před sebou, předjíždí
  aiDrive(a, dt) {
    const c = a.car, tr = this.cur.tr, P = tr.pts, nr = a.nr;
    if (!nr) return { thr: 0, brk: 1, steer: 0, hb: false };
    const v = c.speed, lat = nr.lat;
    // auto těsně před námi ve stejné stopě → uhnout do druhé půlky silnice
    let want = a.home, follow = 99;
    const half0 = nr.w / 2 - 1.15;
    const others = this.racers().filter(b => b.car !== c);
    const laneFree = (L) => !others.some(b => { const ds = b.s - a.sProg; return ds > -7 && ds < 10 + v * 0.4 && Math.abs(b.lat - L) < 2.0; });
    // předjíždění: když se rozhodne, dotáhne to (žádné cuknutí ven a zase zpátky za auto)
    // předjíždět jen tam, kde je silnice před námi skoro rovná (ne v zatáčce, kde by se auta „slepila“)
    const iS = Math.round(nr.s / RT_STEP); let kAhead = 0;
    for (let i = iS; i < Math.min(P.length, iS + 14); i++) kAhead = Math.max(kAhead, Math.abs(P[i].k));
    const passOk = kAhead < 1 / 70;
    a.passT = Math.max(0, (a.passT || 0) - dt); a.passCool = Math.max(0, (a.passCool || 0) - dt);
    for (const b of others) {
      const ds = b.s - a.sProg;
      if (passOk && !a.passT && !a.passCool && ds > -2 && ds < 14 + v * 0.5 && Math.abs(b.lat - lat) < 2.3) {
        const side = b.lat > 0 ? -1 : 1, alt = U.clamp(b.lat + side * 2.4, -half0, half0);   // strana, kde je víc místa
        if (Math.abs(alt - b.lat) >= 2.0 && laneFree(alt)) { a.passT = 3; a.passB = b.car; a.passSide = side; a.passAge = 0; }
      }
    }
    if (a.passT) {
      const b = others.find(o => o.car === a.passB);
      const ds = b ? b.s - a.sProg : -99;
      a.passAge += dt;
      if (!b || ds < -7) a.passT = 0;                                     // hotovo, je za námi
      else if (a.passAge > 7) { a.passT = 0; a.passCool = 2.5; }          // nejde to → zařadit se a zkusit později
      else { want = U.clamp(b.lat + a.passSide * 2.4, -half0, half0); a.passT = Math.max(a.passT, 0.5); }
    }
    // auto před námi ve stopě (skutečné i plánované) → drž odstup, nenaraž mu do zadku
    for (const b of others) {
      const ds = b.s - a.sProg;
      if (ds > 0 && ds < 45 + v && Math.abs(b.lat - lat) < 2.0 && (Math.abs(b.lat - a.lane) < 2.0 || ds < 7)) {
        const gap = ds - 5, vb = Math.max(0, b.car.vf);
        follow = Math.min(follow, gap < 3 ? vb * 0.6 : vb + Math.sqrt(2 * 4 * Math.max(0, gap - 4)));
      }
    }
    a._want = want; a._follow = follow;   // (ladění)
    const half = nr.w / 2 - 1.15;
    a.lane += U.clamp(U.clamp(want, -half, half) - a.lane, -dt * 2.2, dt * 2.2);
    // pure pursuit: oblouk k bodu před sebou → potřebný rejd + dorovnání rychlosti otáčení (bez kličkování)
    const i0 = Math.round(nr.s / RT_STEP), q = P[Math.min(P.length - 1, Math.round((nr.s + 6 + v * 0.5) / RT_STEP))];
    const lx = q.x + Math.cos(q.t) * a.lane - c.x, lz = q.z + Math.sin(q.t) * a.lane - c.z;
    const al = U.wrapAngle(Math.atan2(lx, lz) - c.h), kap = 2 * Math.sin(al) / Math.max(3, Math.hypot(lx, lz));
    const maxSt = RallyCar.maxSteer(v);
    const steer = U.clamp(Math.atan(kap * (RC_A + RC_B)) / maxSt + (kap * v - c.r) * 0.3, -1, 1);
    const slip = v > 3 ? Math.abs(U.wrapAngle(Math.atan2(c.vx, c.vz) - c.h)) : 0;
    // rychlost: nejpomalejší průjezd zatáček v brzdné vzdálenosti
    const grip = this.gripOn(c.s, nr.surf || 'gravel');
    const band = U.clamp((this.sProg - a.sProg) / 2500, -0.04, 0.05);   // lehce dotahuje, když ujíždíš
    const sk = a.skill * 0.8 * (1 + band), dec = Math.max(3, grip * 9.81 * 0.8);
    let vt = 52;
    const iEnd = Math.min(P.length - 1, i0 + Math.round((v * v / (2 * dec) + 30) / RT_STEP));
    for (let i = i0; i <= iEnd; i++) {
      const kk = Math.abs(P[i].k); if (kk < 1 / 400) continue;
      const vc = Math.sqrt(grip * sk * 9.81 / kk), dist = Math.max(0, P[i].s - nr.s - 4);
      vt = Math.min(vt, Math.sqrt(vc * vc + 2 * dec * dist));
    }
    if (nr.d > nr.w / 2) vt = Math.min(vt, 14);   // mimo silnici opatrně zpátky
    vt = Math.min(vt, follow);
    let thr = v < vt ? 1 : U.clamp(1 - (v - vt) * 0.6, 0, 1);
    if (slip > 0.15) thr *= Math.max(0.15, 1 - (slip - 0.15) * 6);   // kontrola trakce: ve smyku ubere plyn
    const brk = v > vt + 1 ? U.clamp((v - vt) * 0.3, 0, 1) : 0;
    return { thr, brk, steer, hb: false };
  },
  // všichni na trati (hráč i AI) pro předjíždění a kolize
  racers() {
    const out = [], me = this.my;
    if (me && me.car) out.push({ car: me.car, s: this.sProg, lat: this.nr ? this.nr.lat : 0, me: true });
    for (const a of this.ais || []) if (!a.gone) out.push({ car: a.car, s: a.sProg, lat: a.nr ? a.nr.lat : 0, a });
    return out;
  },
  aiReset(a) {
    const tr = this.cur.tr, g = this.aiGridPos(tr, a.sProg + 4, a.home);
    a.car.reset(g.x, g.z, g.h, g.y); a.stuckT = a.offT = 0; a.lane = a.home;
  },
  aiStep(dt) {
    const tr = this.cur.tr, go = this.started;
    for (const a of this.ais) {
      if (a.gone) continue;
      const c = a.car;
      a.nr = RallyTrack.nearest(tr, c.x, c.z);
      let inp;
      if (!go || this.clock < a.react) inp = { thr: 0, brk: 0, steer: 0, hb: true };   // na startu drží ruční
      else if (a.res) {
        inp = { thr: 0, brk: 1, steer: 0, hb: false };
        a.goneT -= dt; if (a.goneT <= 0) { a.gone = true; a.vis.root.visible = false; continue; }
      } else inp = this.aiDrive(a, dt);
      if (!go) { c.vx = c.vz = 0; c.wF = c.wR = 0; }
      const land = c.step(dt, inp, tr);
      if (land > 5.5 && !this.devNoAiDmg) this.aiLand(a, land);
      this.aiCollideObjs(c, a);
      const nr = a.nr;
      if (nr && nr.s > a.sProg && nr.s - a.sProg < 30) a.sProg = nr.s;
      if (go && !a.res) {
        if (a.sProg >= tr.len - 12) { a.res = { dnf: false, time: this.clock }; a.goneT = 2.5; if (!this.my.res) this.msg(`${a.crew} je v cíli`, 1.4); continue; }
        if (this.clock > a.react + 2.5) {
          if (c.speed < 1.2) a.stuckT += dt; else a.stuckT = Math.max(0, a.stuckT - dt * 2);
          if (!nr || nr.d > nr.w / 2 + 5) a.offT += dt; else a.offT = 0;
          if (a.stuckT > 3 || a.offT > 2.5 || c.y < -50) this.aiReset(a);
        }
      }
    }
    if (!(this.dev && this.dev.carCol === false)) this.carCollide();
  },
  // AI auta narážejí do stromů, skal a svodidel (bez poškození); kužely, tyčky a keře nechávají hráči
  // ---- poškození AI: stejná pravidla jako pro hráče (zóna nárazu, motor, kola) ----
  aiDamage(a, px, pz, amt, why) {
    if (!a || a.res || amt <= 0.3) return;
    const c = a.car, d = c.dmg, sh = Math.sin(c.h), ch = Math.cos(c.h);
    const lx = px * ch - pz * sh, lz = px * sh + pz * ch;
    const zone = lz > 0.9 ? 'front' : lz < -0.9 ? 'rear' : lx > 0 ? 'left' : 'right';
    if (zone === 'front' && c.s.bull) amt *= 0.75;
    d[zone] = Math.min(100, d[zone] + amt);
    if (zone === 'front') d.engine = Math.min(100, d.engine + amt * 0.55);
    if (Math.abs(lz) > 0.55 && Math.abs(lx) > 0.25 || zone === 'left' || zone === 'right') {
      const wi = (lz >= 0 ? 0 : 2) + (lx >= 0 ? 0 : 1);
      if (!d.off[wi]) { d.wheel[wi] += amt * (zone === 'front' || zone === 'rear' ? 1.8 : 2.2); if (d.wheel[wi] >= 100) this.aiWheelOff(a, wi); }
    }
    if (d.engine >= 100) this.aiRetire(a, 'motor na odpis');
  },
  aiLand(a, v) {
    const c = a.car, amt = (v - 5.5) * 4.5 * (c.s.land || 1), d = c.dmg;
    d.engine = Math.min(100, d.engine + amt * 0.35);
    for (let i = 0; i < 4; i++) if (!d.off[i]) { d.wheel[i] += amt * 0.5; if (d.wheel[i] >= 100) this.aiWheelOff(a, i); }
    if (d.engine >= 100) this.aiRetire(a, 'motor na odpis');
  },
  aiWheelOff(a, i) {
    const d = a.car.dmg; if (d.off[i]) return;
    d.off[i] = true; d.wheel[i] = 100;
    const w = a.vis.wheels.find(w => (w.z > 0 ? 0 : 2) + (w.x > 0 ? 0 : 1) === i); if (w) w.pivot.visible = false;
    this.aiRetire(a, 'utržené kolo');
  },
  aiRetire(a, why) {
    if (a.res) return;
    a.res = { dnf: true, why }; a.goneT = 8;
    if (!this.my.res) this.msg(`${a.crew} odstoupil – ${why}!`, 2, 'good');
  },
  aiCollideObjs(c, a) {
    const objs = RallyTrack.objsNear(this.cur.tr, c.x, c.z), m = c.s.mass, I = m * 1.25;
    for (const lz of [1.45, 0, -1.45]) {
      const [cx, cz] = c.local2world(0, lz), R = 0.92;
      for (const o of objs) {
        if (o.broken || o.kind === 'cone' || o.kind === 'pole' || o.kind === 'cactus' || o.kind === 'bush') continue;
        const dx = cx - o.x, dz = cz - o.z, d = Math.hypot(dx, dz), pen = R + o.r - d;
        if (pen <= 0 || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d, px = (cx - nx * R) - c.x, pz = (cz - nz * R) - c.z;
        c.x += nx * pen; c.z += nz * pen;
        const vpx = c.vx + c.r * pz, vpz = c.vz - c.r * px, vn = vpx * nx + vpz * nz;
        if (vn >= 0) continue;
        const arm = pz * nx - px * nz, J = -(1 + 0.15) * vn / (1 / m + arm * arm / I);
        c.vx += J * nx / m; c.vz += J * nz / m; c.r += J * arm / I;
        if (-vn > 2.2) this.aiDamage(a, px, pz, (-vn - 2.2) * (RALLY_HIT[o.kind] || 4), o.kind);
      }
    }
  },
  // kolize auto–auto: 3 kruhy na auto, výměna impulzu, hráčovi to dělá škody
  carCollide() {
    const L = this.racers(), R = 0.92, me = this.my;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const A = L[i].car, B = L[j].car;
      if (Math.abs(A.x - B.x) > 6 || Math.abs(A.z - B.z) > 6 || Math.abs(A.y - B.y) > 1.5) continue;
      for (const la of [1.45, 0, -1.45]) for (const lb of [1.45, 0, -1.45]) {
        const [ax, az] = A.local2world(0, la), [bx, bz] = B.local2world(0, lb);
        const dx = ax - bx, dz = az - bz, d = Math.hypot(dx, dz), pen = 2 * R - d;
        if (pen <= 0 || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d, mA = A.s.mass, mB = B.s.mass, tot = mA + mB;
        A.x += nx * pen * mB / tot; A.z += nz * pen * mB / tot; B.x -= nx * pen * mA / tot; B.z -= nz * pen * mA / tot;
        const cx = (ax + bx) / 2, cz = (az + bz) / 2, rax = cx - A.x, raz = cz - A.z, rbx = cx - B.x, rbz = cz - B.z;
        const vax = A.vx + A.r * raz, vaz = A.vz - A.r * rax, vbx = B.vx + B.r * rbz, vbz = B.vz - B.r * rbx;
        const vn = (vax - vbx) * nx + (vaz - vbz) * nz;
        if (vn >= 0) continue;
        const armA = raz * nx - rax * nz, armB = rbz * nx - rbx * nz, IA = mA * 1.25, IB = mB * 1.25;
        const J = -(1 + 0.25) * vn / (1 / mA + 1 / mB + armA * armA / IA + armB * armB / IB);
        A.vx += J * nx / mA; A.vz += J * nz / mA; A.r += J * armA / IA;
        B.vx -= J * nx / mB; B.vz -= J * nz / mB; B.r -= J * armB / IB;
        // tření v místě dotyku (auta se o sebe otřou)
        const tx = -nz, tz = nx, vt = (vax - vbx) * tx + (vaz - vbz) * tz, f = U.clamp(vt * 0.08, -1.5, 1.5);
        A.vx -= tx * f * mB / tot; A.vz -= tz * f * mB / tot; B.vx += tx * f * mA / tot; B.vz += tz * f * mA / tot;
        const hit = -vn;
        // AI auta dostanou stejnou ránu jako hráč
        // auta jsou k sobě šetrnější než strom (plech o plech), a první vteřiny po startu se nepočítají vůbec
        const grace = this.clock < 8, amt = grace ? 0 : Math.max(0, hit - 4) * 2;
        if (amt > 0) { if (L[i].a) this.aiDamage(L[i].a, rax, raz, amt, 'car'); if (L[j].a) this.aiDamage(L[j].a, rbx, rbz, amt, 'car'); }
        if (L[i].me || L[j].me) {
          const sg = L[i].me ? 1 : -1, r0x = L[i].me ? rax : rbx, r0z = L[i].me ? raz : rbz;
          if (amt > 0) this.damage(r0x, r0z, nx * sg, nz * sg, amt, 'car', hit);
          else if (hit > 1) Sfx.burst(0.07, 380, Math.min(0.3, hit * 0.08), 'lowpass');
          if (hit > 2) me.lastBump = this.clock;
        }
      }
    }
  },
  aiVis(dt) {
    const me = this.my.pose;
    for (const a of this.ais) {
      if (a.gone) continue;
      const c = a.car, V = a.vis, root = V.root;
      const far = Math.hypot(c.x - me.x, c.z - me.z) > 260;
      root.visible = !far; if (far) continue;
      root.position.set(c.x, c.y, c.z);
      root.rotation.set(-c.pitch, c.h, c.roll, 'YXZ');
      for (const w of V.wheels) {
        w.spin.rotation.x += (w.front ? c.wF : c.wR) * dt;
        w.pivot.position.y = WHEEL_R + c.wy[(w.z > 0 ? 0 : 2) + (w.x > 0 ? 0 : 1)];
        if (w.front) w.pivot.rotation.y = c.steer;
      }
      // prach za koly (jen v blízkosti hráče)
      const v = Math.abs(c.vf), eng = c.dmg.engine;
      if (eng > 30 && Math.hypot(c.x - me.x, c.z - me.z) < 120) {
        a.smT = (a.smT || 0) - dt * (0.5 + eng / 25);
        if (a.smT <= 0) { a.smT = 1; const [sx, sz] = c.local2world(0, 1.6); const k = eng > 70 ? 0x222222 : 0x777777; this.puff(sx, c.y + 1, sz, k, 0.8 + eng / 60, (Math.random() - 0.5) * 0.6, 1.1, (Math.random() - 0.5) * 0.6); }
      }
      if (v > 5 && Math.hypot(c.x - me.x, c.z - me.z) < 90) {
        a.dT -= dt * v * 0.07;
        if (a.dT <= 0) {
          a.dT = 1; const S = RALLY_SURF[c.surf[2]] || RALLY_SURF.gravel;
          if (S.dust) { const ps = { x: c.x, z: c.z, h: c.h }, sx = Math.random() < 0.5 ? 0.78 : -0.78, [wx, wz] = this.l2w(ps, sx, -1.6); this.puff(wx, c.y + 0.3, wz, S.col, 1 + S.dust * 0.6, (Math.random() - 0.5), 0.6, 0); }
        }
      }
    }
  },
  // průběžné pořadí: kdo dojel (podle času), pak podle ujeté vzdálenosti
  aiOrder() {
    const me = this.my, L = [{ me: true, crew: me.crew, res: me.res, s: this.sProg }];
    for (const a of this.ais) L.push({ a, crew: a.crew, res: a.res, s: a.sProg });
    return L.sort((p, q) => (q.res && !q.res.dnf ? 1 : 0) - (p.res && !p.res.dnf ? 1 : 0) || (p.res && q.res ? (p.res.time || 1e9) - (q.res.time || 1e9) : 0) || (p.res && p.res.dnf ? 1 : 0) - (q.res && q.res.dnf ? 1 : 0) || q.s - p.s);
  },
  aiBoard() {
    const L = this.aiOrder(), mi = L.findIndex(r => r.me), esc = (t) => String(t).replace(/[<>&]/g, '');
    return `<div class="rhPos">POZICE <b>${mi + 1}</b> / ${L.length}</div>` + L.map((r, i) => (i < 3 || Math.abs(i - mi) <= 1) ? `<div style="color:${r.me ? '#ffd27a' : RALLY_AI_COL}">${i + 1}. ${r.me ? '▶ ' : ''}${esc(r.crew)} <b>${r.res ? (r.res.dnf ? 'DNF' : this.fmt(r.res.time)) : i === mi ? '' : (r.s > this.sProg ? '+' : '−') + Math.round(Math.abs(r.s - this.sProg)) + ' m'}</b></div>` : '').join('');
  },
  // konečné pořadí pro výsledky: kdo nedojel, tomu se čas dopočítá podle jeho průměrné rychlosti
  aiRanked() {
    const tr = this.cur.tr, me = this.my, T = this.clock;
    const rows = [me];
    for (const a of this.ais) {
      let res = a.res;
      if (!res) { const avg = Math.max(6, (a.sProg - a.s0) / Math.max(1, T)); res = { dnf: false, time: T + (tr.len - a.sProg) / avg, est: true }; }
      rows.push({ crew: a.crew, res, col: RALLY_AI_COL, id: a.id });
    }
    return rows.sort((p, q) => (p.res.dnf ? 1 : 0) - (q.res.dnf ? 1 : 0) || (p.res.time || 1e9) - (q.res.time || 1e9));
  },
});
