// airplane.js – letadla pro letecké závody: 3D modely a realistický letový model (6 stupňů volnosti)
// Tělo letadla: osa x = vpravo, y = nahoru, z = dozadu (nos míří na −z, stejně jako kamera).
// Aerodynamika přes součinitele stability (jako skutečné letové simulátory): vztlak podle úhlu náběhu včetně
// pádu (stall) a autorotace do vývrtky, odpor (tvarový + indukovaný + klapky + podvozek), boční síla ze skluzu,
// momenty: podélná stabilita, tlumení, vzepětí křídel, směrová stabilita, nepříznivé zatáčení od křidélek,
// vrtule (tah klesá s rychlostí, kroutící moment motoru, ofukování ocasních ploch), přízemní efekt,
// podvozek s pružinami, tlumiči, třením, brzdami a řiditelným ostruhovým kolem.
const AIR_RHO = 1.225, AIR_G = 9.81;

const PLANES = {
  cmelak: {
    name: 'Čmelák', cls: 'Cvičný hornoplošník', desc: 'Pomalý a hodný. Odpustí skoro všechno, přistaneš s ním i na louce. Ideální na první lety.',
    m: 620, S: 16.2, b: 10.7, c: 1.6, P: 85e3, eta: 0.8, Vp: 26, CD0: 0.036, e: 0.78,
    CL0: 0.28, CLa: 4.8, aStall: 0.26, Cm0: 0.04, Cma: -1.6, Cmq: -12, Cmde: 1.2, de: 0.42,
    Clb: -0.1, Clp: -0.5, Clr: 0.1, Clda: 0.17, da: 0.35, Cnb: 0.07, Cnr: -0.1, Cndr: 0.07, dr: 0.45, Cnda: -0.02, CYb: -0.35,
    I: [1300, 2000, 1100], nLim: 3.8, nMax: 6, rpmIdle: 650, rpmMax: 2700, cyl: 4, blades: 2, propR: 0.95,
    flapCL: [0, 0.35, 0.7], flapCD: [0, 0.02, 0.06], retract: false, gearCD: 0.006, Vrace: 52, Vmin: 22,
    col: 0xe8b830, col2: 0x2a2620, look: 'high',
  },
  sokol: {
    name: 'Sokol', cls: 'Akrobatický speciál', desc: 'Lehký a nervózní. Výkrut 400°/s, vydrží 10 G. Na závody mezi pylony jak stvořený.',
    m: 780, S: 10.7, b: 7.5, c: 1.45, P: 250e3, eta: 0.82, Vp: 40, CD0: 0.024, e: 0.8,
    CL0: 0, CLa: 5.0, aStall: 0.28, Cm0: 0, Cma: -1.0, Cmq: -10, Cmde: 1.1, de: 0.5,
    Clb: -0.03, Clp: -0.45, Clr: 0.05, Clda: 0.25, da: 0.5, Cnb: 0.06, Cnr: -0.09, Cndr: 0.09, dr: 0.5, Cnda: -0.01, CYb: -0.4,
    I: [1100, 1500, 550], nLim: 9, nMax: 12, rpmIdle: 700, rpmMax: 2700, cyl: 6, blades: 3, propR: 0.98,
    flapCL: [0], flapCD: [0], retract: false, gearCD: 0.004, Vrace: 92, Vmin: 30,
    col: 0xd8332a, col2: 0xf2f2ee, look: 'low',
  },
  strela: {
    name: 'Střela', cls: 'Závodní stíhačka (V12)', desc: '1 500 kW, 600+ km/h, těžká jak cihla. V kaňonu je to sebevražda – a o to jde. Zatahovací podvozek (G).',
    m: 3400, S: 21.6, b: 11.3, c: 2.0, P: 1500e3, eta: 0.85, Vp: 75, CD0: 0.019, e: 0.78,
    CL0: 0.15, CLa: 5.2, aStall: 0.24, Cm0: 0, Cma: -1.2, Cmq: -14, Cmde: 1.0, de: 0.4,
    Clb: -0.05, Clp: -0.45, Clr: 0.06, Clda: 0.15, da: 0.35, Cnb: 0.08, Cnr: -0.12, Cndr: 0.07, dr: 0.4, Cnda: -0.015, CYb: -0.5,
    I: [12000, 20000, 9000], nLim: 7, nMax: 9, rpmIdle: 800, rpmMax: 3000, cyl: 12, blades: 4, propR: 1.75,
    flapCL: [0, 0.3, 0.6], flapCD: [0, 0.018, 0.05], retract: true, gearCD: 0.016, Vrace: 150, Vmin: 45,
    col: 0x2f5a3a, col2: 0xc8ccd0, look: 'racer',
  },
};
const PLANE_IDS = Object.keys(PLANES);
const AIR_PAINTS = [null, 0x2a6ad8, 0x1c1c1c, 0xf0f0ea, 0x8a2ad8, 0xff7a1a, 0x18a878];

// ---------------------------------------------------------------- fyzika
class AirPhys {
  constructor(id) {
    this.id = id; this.P = PLANES[id];
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.q = new THREE.Quaternion(); this.w = new THREE.Vector3();
    this.thr = 0.7; this.flaps = 0; this.gearDown = true; this.gearPos = 1; this.brake = 0; this.rpm = this.P.rpmIdle;
    this.da = 0; this.de = 0; this.dr = 0; this.steer = 0; this.trim = 0;
    this.n = 1; this.alpha = 0; this.beta = 0; this.V = 0; this.stall = 0; this.onGround = false; this.crashed = null;
    this.gearPts = PlaneModel.gearPts(id); this.comp = [0, 0, 0]; this.wv = [0, 0, 0]; this.cv = [0, 0, 0];
    const L = id === 'strela' ? 9.8 : 6.7, hb = this.P.b / 2;
    this.hard = [[0, 0, -L / 2 - 0.3, 'nos'], [-hb, id === 'cmelak' ? 1.0 : -0.3, 0, 'křídlo'], [hb, id === 'cmelak' ? 1.0 : -0.3, 0, 'křídlo'], [0, 1.3, L / 2, 'ocas'], [0, -0.7, 0, 'břicho']];
    this.assist = 2; this.torqueK = 0;
    // pracovní vektory (žádné alokace ve smyčce)
    this._a = new THREE.Vector3(); this._b = new THREE.Vector3(); this._c = new THREE.Vector3(); this._d = new THREE.Vector3();
    this._F = new THREE.Vector3(); this._T = new THREE.Vector3(); this._qi = new THREE.Quaternion(); this._qd = new THREE.Quaternion();
    this._n = new THREE.Vector3(); this._f = new THREE.Vector3(); this._s = new THREE.Vector3(); this._r = new THREE.Vector3();
  }
  // postaví letadlo do vzduchu (nebo na zem) s daným směrem letu
  place(x, y, z, yaw, speed, pitch) {
    this.pos.set(x, y, z); this.q.setFromEuler(new THREE.Euler(pitch || 0, yaw, 0, 'YXZ'));
    this.vel.set(0, 0, -(speed || 0)).applyQuaternion(this.q); this.w.set(0, 0, 0);
    this.crashed = null; this.stall = 0; this.n = 1; this.gStress = 0; this.trimInit = false; this.V = speed || 0; this.alpha = 0; this.bank = 0;
    if (speed > 10) { this.gearDown = !this.P.retract; this.gearPos = this.gearDown ? 1 : 0; this.thr = 0.85; this.flaps = 0; this.rpm = this.P.rpmMax * 0.92; }
    else { this.gearDown = true; this.gearPos = 1; this.thr = 0; this.flaps = this.P.flapCL.length > 1 ? 1 : 0; this.rpm = this.P.rpmIdle; }
  }
  CL(a, fl) {
    const P = this.P, as = P.aStall - fl * 0.012, an = -P.aStall * 0.8;
    const lin = P.CL0 + P.CLa * a + (P.flapCL[fl] || 0), fp = 1.05 * Math.sin(2 * a);
    if (a > as) {
      const peak = P.CL0 + P.CLa * as + (P.flapCL[fl] || 0), w = U.smooth(as, as + 0.35, a);
      return U.lerp(peak * (1 - 0.32 * U.smooth(as, as + 0.07, a)), fp, w);
    }
    if (a < an) { const peak = P.CL0 + P.CLa * an, w = U.smooth(-an, -an + 0.35, -a); return U.lerp(peak * (1 - 0.32 * U.smooth(-an, -an + 0.07, -a)), fp, w); }
    return lin;
  }
  // úhel náběhu, při kterém má letadlo daný vztlak
  alphaFor(CL) { const P = this.P; return (CL - P.CL0 - (P.flapCL[this.flaps] || 0)) / P.CLa; }
  step(h, inp, env) {
    if (this.crashed) return;
    const P = this.P, I = P.I, a = this._a, F = this._F, T = this._T;
    const qi = this._qi.copy(this.q).invert();
    // vzduch v soustavě letadla
    const va = this._b.copy(this.vel).sub(env.wind).applyQuaternion(qi);
    const V = va.length(), Vs = Math.max(V, 4), u = -va.z;
    const alpha = Math.atan2(-va.y, u), beta = V > 1 ? Math.asin(U.clamp(va.x / V, -1, 1)) : 0;
    const qd = 0.5 * AIR_RHO * V * V;
    this.alpha = alpha; this.beta = beta; this.V = V;
    // úhlové rychlosti v pilotních znaménkách: p = výkrut doprava, qr = nos nahoru, r = nos doprava
    const p = -this.w.z, qr = this.w.x, r = -this.w.y;
    // ---- motor a vrtule ----
    const rpmT = P.rpmIdle + (P.rpmMax - P.rpmIdle) * Math.pow(this.thr, 0.75) + Math.max(0, u) * 4 * (1 - this.thr * 0.6);
    this.rpm += (Math.min(rpmT, P.rpmMax * 1.08) - this.rpm) * Math.min(1, h / 0.5);
    const pw = P.P * Math.pow(this.rpm / P.rpmMax, 2.2) * U.clamp(this.thr * 1.05, 0, 1);
    const thrust = pw * P.eta / Math.max(u, P.Vp) - (1 - this.thr) * qd * 0.0035 * P.S;   // na volnoběh vrtule brzdí
    this.thrust = thrust;
    // ofukování ocasu vrtulí → kormidla fungují i při pojíždění
    const qTail = qd + Math.max(0, thrust) * 2.4 / P.S;
    // ---- řízení ----
    const fl = this.flaps, S = P.S;
    // výškovka: s asistencí knipl určuje úhel náběhu (= přetížení, jako „síla na kniplu na 1 G“), bez ní přímo výchylku
    const CLreq = P.m * AIR_G * Math.cos(this.bank || 0) / Math.max(qd * S, 1);
    const a1 = U.clamp(this.alphaFor(CLreq), -0.2, P.aStall * 0.95);
    const trimDe = -(P.Cm0 + P.Cma * a1) / P.Cmde;
    if (!this.trimInit) { this.trim = trimDe; this.trimInit = true; }
    this.trim += (U.clamp(trimDe, -P.de, P.de) - this.trim) * Math.min(1, h / (this.assist ? 0.6 : 2.5));
    let deCmd;
    if (this.assist) {
      const nLim = this.assist === 2 ? P.nLim : P.nMax;
      const aMaxN = this.alphaFor(nLim * P.m * AIR_G / Math.max(qd * S, 1)), aMinN = this.alphaFor(-nLim * 0.45 * P.m * AIR_G / Math.max(qd * S, 1));
      const aHi = Math.min(this.assist === 2 ? P.aStall * 0.85 : P.aStall * 1.25, aMaxN), aLo = Math.max(-P.aStall * 0.7, aMinN);
      const s = inp.pitch, aT = s >= 0 ? U.lerp(a1, Math.max(aHi, Math.min(a1, aHi)), s) : U.lerp(Math.min(a1, aHi), Math.min(aLo, a1), -s);
      // dopředná výchylka pro cílový úhel náběhu + zpětná vazba na skutečný úhel (drží α pod pádem i při ztrátě rychlosti)
      deCmd = (-(P.Cm0 + P.Cma * aT) / P.Cmde + 1.6 * (aT - alpha) - 0.07 * qr) * (qd / Math.max(qTail, 1));
    } else deCmd = this.trim * (qd / Math.max(qTail, 1)) + inp.pitch * P.de;
    this.de = U.clamp(deCmd, -P.de, P.de);
    this.da = inp.roll * P.da;
    if (this.assist === 2 && Math.abs(inp.roll) < 0.05 && Math.abs(this.bank) < 0.6 && !this.onGround) this.da += U.clamp(-this.bank * 0.5 - p * 0.05, -0.15, 0.15);   // vyrovnání křídel
    let drc = inp.yaw * P.dr;
    if (this.assist && !this.onGround) drc += U.clamp(beta * 2.2 - r * 0.15, -P.dr * 0.6, P.dr * 0.6);   // koordinace zatáčky (kulička uprostřed)
    this.dr = U.clamp(drc, -P.dr, P.dr);
    this.steer = this.dr / P.dr * 0.45;
    this.brake = inp.brake;
    // ---- součinitele ----
    let CL = this.CL(alpha, fl);
    const st = U.smooth(P.aStall - 0.02, P.aStall + 0.08, Math.abs(alpha)) * U.smooth(6, 14, V);
    this.stall = st;
    const AR = P.b * P.b / S;
    const hAGL = env.agl;
    const ge = hAGL < P.b ? (16 * hAGL / P.b) ** 2 / (1 + (16 * hAGL / P.b) ** 2) : 1;   // přízemní efekt
    const CDi = CL * CL / (Math.PI * AR * P.e) * ge;
    const CD = P.CD0 + CDi + (P.flapCD[fl] || 0) + P.gearCD * this.gearPos + 1.1 * Math.sin(Math.abs(alpha)) ** 2 * 0.9 + Math.abs(beta) * 0.15;
    const ph = p * P.b / (2 * Vs), qh = qr * P.c / (2 * Vs), rh = r * P.b / (2 * Vs);
    const t = this.tt = (this.tt || 0) + h;
    const drop = st * (0.035 * Math.sin(t * 1.7 + this.seed) + 0.02 * Math.sin(t * 4.3)) * (alpha > 0 ? 1 : -1);
    const Cm = P.Cm0 + P.Cma * alpha + P.Cmq * qh * (1 - 0.5 * st) + P.Cmde * this.de * qTail / Math.max(qd, 1) - st * 0.08 * Math.sign(alpha);
    const Cl = P.Clb * beta + P.Clp * ph * (1 - 1.7 * st) + P.Clr * rh + P.Clda * this.da * (1 - 0.6 * st) + drop;
    const Cn = P.Cnb * beta + P.Cnr * rh + P.Cndr * this.dr * qTail / Math.max(qd, 1) + P.Cnda * this.da;
    // ---- síly v soustavě letadla ----
    F.set(0, 0, 0);
    if (V > 0.5) {
      // vztlak ⟂ na proudění v rovině souměrnosti
      const ly = u, lz = va.y, ll = Math.hypot(ly, lz) || 1;
      F.y += qd * S * CL * ly / ll; F.z += qd * S * CL * lz / ll;
      F.addScaledVector(va, -qd * S * CD / V);
      F.x += qd * S * P.CYb * beta;
    }
    F.z -= thrust;
    T.set(qd * S * P.c * Cm, -qd * S * P.b * Cn, -qd * S * P.b * Cl);
    // kroutící moment motoru (při realismu): letadlo se točí proti vrtuli, P-faktor táhne nos doleva při velkém úhlu
    if (this.torqueK) { const om = Math.max(this.rpm, 300) / 60 * Math.PI * 2, lo = 0.25 + 0.75 * (1 - U.smooth(P.Vp * 0.6, P.Vp * 2, u)); T.z += this.torqueK * pw / om * 0.5 * lo; T.y += this.torqueK * Math.max(0, thrust) * alpha * 0.25; }
    // ---- podvozek a kontakty se zemí ----
    this.onGround = false;
    const Fw = this._c.set(0, 0, 0), Tw = this._d.set(0, 0, 0);
    this.contacts(h, env, Fw, Tw, qi);
    // přetížení (specifická síla ve svislé ose letadla)
    const nzNow = (F.y + Fw.y) / (P.m * AIR_G);
    this.n += (nzNow - this.n) * Math.min(1, h / 0.08);
    F.add(Fw); T.add(Tw);
    // ---- integrace ----
    a.copy(F).applyQuaternion(this.q).multiplyScalar(1 / P.m); a.y -= AIR_G;
    this.vel.addScaledVector(a, h);
    this.pos.addScaledVector(this.vel, h);
    // Eulerovy rovnice: I·ω̇ = T − ω × Iω
    const w = this.w, Ix = I[0], Iy = I[1], Iz = I[2];
    const gx = w.y * Iz * w.z - w.z * Iy * w.y, gy = w.z * Ix * w.x - w.x * Iz * w.z, gz = w.x * Iy * w.y - w.y * Ix * w.x;
    w.x += (T.x - gx) / Ix * h; w.y += (T.y - gy) / Iy * h; w.z += (T.z - gz) / Iz * h;
    if (w.lengthSq() > 400) w.setLength(20);
    const qd2 = this._qd.set(w.x * h * 0.5, w.y * h * 0.5, w.z * h * 0.5, 0);
    const q = this.q, nq = qd2.multiplyQuaternions(q, qd2);
    q.set(q.x + nq.x, q.y + nq.y, q.z + nq.z, q.w + nq.w).normalize();
    // náklon (pro asistenci)
    const up = this._r.set(0, 1, 0).applyQuaternion(q), rt = this._s.set(1, 0, 0).applyQuaternion(q);
    this.bank = Math.atan2(-rt.y, up.y);
    // vývrtka / přetížení konstrukce
    if (this.n > P.nMax * 1.6 || this.n < -P.nMax * 0.9) this.crash('Ulomené křídlo – přetížení ' + this.n.toFixed(1) + ' G', 'over');
    // voda
    if (env.water !== null && this.pos.y < env.water + 0.4 && env.overWater) this.crash('Přistál jsi ve vodě', 'water');
  }
  contacts(h, env, Fw, Tw, qi) {
    const P = this.P, q = this.q, n = this._n, f = this._f, s = this._s, r = this._r;
    const k = P.m * AIR_G / (3 * 0.09) * 1.15, cdamp = 2 * Math.sqrt(k * P.m / 3) * 0.55;
    const fwd = this._a2 || (this._a2 = new THREE.Vector3()), tmp = this._t2 || (this._t2 = new THREE.Vector3()), pv = this._p2 || (this._p2 = new THREE.Vector3());
    const ww = this._w2 || (this._w2 = new THREE.Vector3());
    ww.copy(this.w).applyQuaternion(q);
    const touch = (bx, by, bz) => {
      r.set(bx, by, bz).applyQuaternion(q);
      const x = this.pos.x + r.x, y = this.pos.y + r.y, z = this.pos.z + r.z;
      const gh = env.height(x, z);
      return { pen: gh - y, r: r.clone(), x, z };
    };
    for (let i = 0; i < this.gearPts.length; i++) {
      const g = this.gearPts[i];
      this.wv[i] *= 0.995;
      if (this.gearPos < 0.95) { this.comp[i] = 0; continue; }
      const c = touch(g.p[0], g.p[1], g.p[2]);
      if (c.pen <= 0) { this.comp[i] = 0; continue; }
      this.onGround = true;
      env.normal(c.x, c.z, n);
      pv.copy(ww).cross(c.r).add(this.vel);
      const vn = pv.dot(n), travel = g.tail ? 0.12 : 0.28;
      if (vn < -(g.tail ? 5 : 4.2) && c.pen > travel * 0.7) { this.crash('Rozbitý podvozek – tvrdé přistání (' + (-vn).toFixed(1) + ' m/s)', 'gear'); return; }
      let Fn = k * (g.tail ? 0.6 : 1) * Math.min(c.pen, travel) - cdamp * (g.tail ? 0.6 : 1) * vn;
      if (c.pen > travel) Fn += k * 12 * (c.pen - travel) - cdamp * 3 * Math.min(0, vn);
      Fn = Math.max(0, Fn);
      this.comp[i] = Math.min(c.pen, travel);
      // směr valení: osa letadla promítnutá do roviny země (ostruha zatáčí směrovkou)
      fwd.set(0, 0, -1);
      if (g.tail) fwd.applyAxisAngle(tmp.set(0, 1, 0), -this.steer * (this.V < 15 ? 1 : 0.3));
      fwd.applyQuaternion(q); fwd.addScaledVector(n, -fwd.dot(n)).normalize();
      s.copy(fwd).cross(n);
      const vl = pv.dot(fwd), vs = pv.dot(s);
      const brk = g.tail ? 0 : this.brake;
      const roll = 0.025 + brk * 0.55;
      const Fl = -U.clamp(vl * P.m * 2, -roll * Fn, roll * Fn);
      const mu = 0.85 * Fn, Fs = -U.clamp(vs * P.m * 3.5 / 3, -mu, mu);
      this.wv[i] = vl / g.r;
      f.copy(n).multiplyScalar(Fn).addScaledVector(fwd, Fl).addScaledVector(s, Fs);
      // do soustavy těla
      const fb = tmp.copy(f).applyQuaternion(qi);
      Fw.add(fb);
      const rb = c.r.applyQuaternion(qi);
      Tw.add(rb.cross(fb));
    }
    // pevné body (nos, konce křídel, ocas, břicho): náraz = havárie, pomalé škrtnutí jen klouže
    for (const hp of this.hard) {
      if (hp[3] === 'břicho' && this.gearPos > 0.5) continue;
      const c = touch(hp[0], hp[1], hp[2]);
      if (c.pen <= 0) continue;
      env.normal(c.x, c.z, n);
      pv.copy(ww).cross(c.r).add(this.vel);
      const sp = pv.length(), vn = pv.dot(n);
      if (sp > 14 || vn < -3) { this.crash(hp[3] === 'nos' ? 'Zapíchnul ses do země' : hp[3] === 'křídlo' ? 'Zachytil jsi křídlem o zem' : hp[3] === 'břicho' ? 'Přistání na břicho' : 'Ocas o zem', 'ground'); return; }
      this.onGround = true;
      const Fn = Math.max(0, k * 2 * c.pen - cdamp * 2 * vn);
      f.copy(n).multiplyScalar(Fn).addScaledVector(pv.addScaledVector(n, -vn), -P.m * 1.5);
      const fb = this._t2.copy(f).applyQuaternion(qi);
      Fw.add(fb); Tw.add(c.r.applyQuaternion(qi).cross(fb));
    }
  }
  crash(why, kind) { if (!this.crashed) this.crashed = { why, kind, v: this.vel.clone() }; }
  // eulerovy úhly pro síť a AI (YXZ: kurz, sklon, náklon)
  euler() { const e = this._e || (this._e = new THREE.Euler(0, 0, 0, 'YXZ')); return e.setFromQuaternion(this.q, 'YXZ'); }
}
AirPhys.prototype.seed = 0;
