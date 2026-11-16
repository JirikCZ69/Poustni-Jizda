// car.js – fyzika (jednostopý model s driftem), převodovka, díly s opotřebením, kola, kapaliny, poškození
const WR = 0.33, IDLE = 850, REDLINE = 6300;
const TIRE_NAMES = ['levé přední', 'pravé přední', 'levé zadní', 'pravé zadní'];

class Car {
  constructor(scene) {
    this.scene = scene;
    const dc = Dealer.car(Dealer.sel());   // auto z autosalonu (jen jiný vzhled, jezdí stejně)
    this.parts = CarModel.build(dc.paint, dc.id);
    scene.add(this.parts.root);
    this.handsRig = Hands.carRig(this.parts);
    this.shiftAnim = 0;
    this.m = 1250; this.I = 1700; this.a = 1.25; this.b = 1.35;
    this.debris = [];
    this.onMsg = () => {}; this.onCrash = () => {};
    this.slots = {}; this.warned = {};
    BAY_SLOTS.forEach(k => { this.slots[k] = null; });
    this.tires = []; this.cosm = {}; this.paint = 0x4f7f86; this.espec = null; this.boost = 0;
    for (let i = 0; i < 4; i++) this.setTire(i, { tier: 0, cond: 55 + Math.random() * 20 });
    this.tankTier = 0;
    this.reset(0, 14.5, Math.PI);
    this.fuel = 2; this.oil = 1.2; this.coolant = 2;
    this.hoodOpen = true; this.hoodAngle = -1.15;
  }
  reset(x, z, yaw) {
    this.x = x; this.z = z; this.yaw = yaw; this.y = World.L(x, z); this.pitch = 0; this.roll = 0;
    this.vx = 0; this.vz = 0; this.w = 0; this.steer = 0; this.vf = 0; this.vl = 0;
    this.rpm = 0; this.gear = 0; this.auto = true; this.running = false; this.crank = 0; this.shiftT = 0;
    this.lights = false; this.handbrake = true; this.throttle = 0; this.onRoad = true;
    this.engineTemp = 30; this.oilTemp = 30; this.body = 100; this.wrecked = false; this.exploded = false;
    this.odo = 0; this.holeCd = 0; this.shake = 0; this.slip = 0; this._dashT = 0; this._diagT = 0;
    this.powerMul = 1; this.misfireT = 0; this.boost = 0; this.wspin = 0; this._pthr = 0;
  }
  get tankCap() { return PARTS.tank.stat[this.tankTier]; }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get battery() { return this.slots.battery; }
  get engineHP() { return this.slots.engine ? this.slots.engine.cond : 0; }
  wm(p) { return WEAR_MUL[p.tier] * (Perks.has('mechanik') ? 0.7 : 1); }

  // ---------- díly ----------
  setPart(slot, data) {
    const g = this.parts.slots[slot];
    while (g.children.length) g.remove(g.children[0]);
    this.slots[slot] = data ? Object.assign({}, data) : null;
    this.warned[slot] = false;
    if (slot === 'engine') this.espec = data ? Items.engineSpec(data) : null;
    if (data) { const m = Items.makeMesh(slot, data, true); CarModel.tag(m, 'slot:' + slot); m.traverse(o => { o.castShadow = false; }); g.add(m); }
  }
  setTire(i, data) {
    this.tires[i] = { tier: data.tier, cond: data.cond };
    const wh = this.parts.wheels[i];
    const rims = this.cosm && this.cosm.rims;
    wh.rimMat.color.setHex(rims ? COSM[rims.kind].rim : data.tier === 0 ? 0x6a5a48 : TIERS[data.tier].hex);
    this.warned['tire' + i] = false;
  }
  // převodovka
  gb() { const g = this.slots.gearbox; return GEARBOXES[g ? g.tier : 1]; }
  maxGear() { return this.gb().r.length; }
  ratio(gear) { return gear === -1 ? -3.4 : gear === 0 ? 0 : this.gb().r[Math.min(gear, this.maxGear()) - 1]; }
  shiftTime() { const g = this.slots.gearbox; return this.gb().shift * (g && g.cond < 30 ? 1.7 : 1); }
  shifted() {
    this.shiftT = this.shiftTime(); this.shiftAnim = 0.45;
    const g = this.slots.gearbox; if (g && this.running) g.cond = Math.max(0, g.cond - 0.04 * this.wm(g));
    Sfx.shift(g ? g.cond : 100);
    if (this.espec && this.espec.ind === 1 && this.boost > 0.35) { Sfx.blowoff(this.boost); this.boost *= 0.3; }
  }
  // kosmetika a lak
  setCosm(slot, kind, data) {
    const old = this.cosm[slot] || null;
    this.cosm[slot] = kind ? { kind, data: Object.assign({}, data || {}) } : null;
    CarModel.applyCosm(this.parts, slot, kind, data);
    if (slot === 'rims') this.tires.forEach((t, i) => this.setTire(i, t));
    return old;
  }
  setPaint(hex) { this.paint = hex; this.parts.paintMat.color.setHex(hex); }
  tireGrip(i) { const t = this.tires[i]; return PARTS.tire.stat[t.tier] * (t.cond > 0 ? 0.75 + 0.25 * t.cond / 100 : 0.45); }
  missing() { return BAY_SLOTS.filter(k => PARTS[k].req && !this.slots[k]).map(k => PARTS[k].name); }
  toggleHood() { this.hoodOpen = !this.hoodOpen; Sfx.click(); }

  // použití předmětu z ruky na auto; vrací {ok, msg, consumed, drop:[type,data]}
  useItem(it, zone) {
    const t = it.type, P = PARTS[t];
    if (P) {
      if (t === 'tire') {
        if (this.speed > 0.5) return { ok: false, msg: 'Auto musí stát' };
        // celá sada najednou – auto je vyvážené
        const old = { tier: Math.min(...this.tires.map(x => x.tier)), cond: this.tires.reduce((a, x) => a + x.cond, 0) / 4 };
        for (let i = 0; i < 4; i++) this.setTire(i, it.data);
        return { ok: true, consumed: true, drop: ['tire', old], msg: `Přezuto: ${Items.name(it).toLowerCase()} – všechna 4 kola` };
      }
      if (t === 'tank') {
        if (it.data.tier <= this.tankTier) return { ok: false, msg: 'Už máš stejnou nebo větší nádrž' };
        const old = this.tankTier; this.tankTier = it.data.tier;
        return { ok: true, consumed: true, drop: ['tank', { tier: old, cond: 100 }], msg: `Nová nádrž: ${this.tankCap} l` };
      }
      if (!this.hoodOpen) return { ok: false, msg: 'Nejdřív otevři kapotu (podívej se na ni a zmáčkni E)' };
      if (this.running) return { ok: false, msg: 'Nejdřív vypni motor (C v autě)' };
      const old = this.slots[t];
      this.setPart(t, it.data);
      return { ok: true, consumed: true, drop: old ? [t, old] : null, msg: `Namontováno: ${Items.name(it)}` };
    }
    const d = it.def;
    if (d.cat === 'cosm') {
      if (this.speed > 0.5) return { ok: false, msg: 'Auto musí stát' };
      const old = this.setCosm(d.slot, d.kind, it.data);
      return { ok: true, consumed: true, drop: old ? ['c_' + old.kind, old.data] : null, msg: `Namontováno: ${d.name}` };
    }
    if (d.cat === 'spray') {
      const [nm, hex] = SPRAYS[it.data.col];
      if (hex === this.paint) return { ok: false, msg: 'Auto už tuhle barvu má' };
      this.setPaint(hex); Sfx.spray();
      return { ok: true, consumed: true, msg: `Auto přestříkáno: ${nm}` };
    }
    if (d.cat === 'fluid') {
      const key = d.fluid;
      if (key !== 'fuel' && !this.hoodOpen) return { ok: false, msg: 'Olej a chladicí kapalina se lijí pod kapotou – otevři ji' };
      const cap = key === 'fuel' ? this.tankCap : key === 'oil' ? 5 : 7;
      const space = cap - this[key];
      if (space < 0.05) return { ok: false, msg: 'Už je plno' };
      const put = Math.min(space, it.data.amount);
      this[key] += put; it.data.amount -= put;
      const nm = key === 'fuel' ? 'benzínu' : key === 'oil' ? 'oleje' : 'chladicí kapaliny';
      return { ok: true, consumed: it.data.amount < 0.05, msg: `Doplněno ${put.toFixed(1)} l ${nm}` };
    }
    if (d.cat === 'repair') {
      const s = this.slots;
      this.body = Math.min(100, this.body + 45);
      if (s.radiator) s.radiator.cond = Math.min(100, s.radiator.cond + 40);
      if (s.engine && !s.engine.seized) s.engine.cond = Math.min(100, s.engine.cond + 20);
      this.wrecked = false;
      return { ok: true, consumed: true, msg: 'Karoserie, chladič a motor opraveny' };
    }
    return { ok: false, msg: 'Tohle se do auta nedává' };
  }
  removePart(slot) {
    if (this.running) return { ok: false, msg: 'Nejdřív vypni motor (C v autě)' };
    const p = this.slots[slot];
    if (!p) return { ok: false };
    this.setPart(slot, null);
    return { ok: true, item: [slot, p] };
  }

  toggleEngine() {
    if (this.running) { this.running = false; this.onMsg('Motor vypnut'); return; }
    if (this.crank > 0) return;
    const miss = this.missing();
    if (miss.length) return this.onMsg('Chybí: ' + miss.join(', '), 'bad');
    const s = this.slots;
    if (s.engine.seized || s.engine.cond <= 0) return this.onMsg('Motor je zničený – sežeň jiný', 'bad');
    if (s.starter.cond <= 0) return this.onMsg('Startér je mrtvý – vyměň ho', 'bad');
    if (s.battery.charge < 4) return this.onMsg('Baterka je vybitá', 'bad');
    if (this.wrecked) return this.onMsg('Auto je na kusy – použij opravnou sadu', 'bad');
    this.crank = 0.9; s.battery.charge -= 5 / PARTS.battery.stat[s.battery.tier];
    s.starter.cond = Math.max(0, s.starter.cond - 2 * this.wm(s.starter));
    const chance = PARTS.starter.stat[s.starter.tier] * (0.45 + 0.55 * s.starter.cond / 100) * (s.plugs.cond > 0 ? 0.6 + 0.4 * s.plugs.cond / 100 : 0);
    this.crankOk = Math.random() < 0.3 + 0.7 * chance;
    Sfx.crank();
  }
  shiftUp() { if (!this.auto && this.gear < this.maxGear()) { this.gear++; this.shifted(); } }
  shiftDown() { if (!this.auto && this.gear > -1) { this.gear--; this.shifted(); } }
  toggleAuto() { this.auto = !this.auto; this.onMsg(this.auto ? 'Převodovka: AUTOMAT' : 'Převodovka: MANUÁL (R/F)'); if (this.auto && this.gear === 0) this.gear = 1; }

  // ---------- hlavní update ----------
  update(dt, inp, env) {
    if (this.exploded) { this.updateDebris(dt); return; }
    if (this.crank > 0) {
      this.crank -= dt;
      if (this.crank <= 0) {
        if (!this.crankOk) this.onMsg('Motor nechytil – zkus to znovu (C)', 'warn');
        else if (this.fuel <= 0.01) this.onMsg('Motor chytá, ale nemá benzín', 'warn');
        else if (this.slots.fuelpump.cond <= 0) this.onMsg('Motor nedostává benzín – vadné čerpadlo', 'bad');
        else { this.running = true; this.rpm = 1200; if (this.auto && this.gear === 0) this.gear = 1; this.onMsg('Motor běží', 'good'); }
      }
    }
    this.handbrake = inp.handbrake;
    this.shiftAnim = Math.max(0, this.shiftAnim - dt);
    this._brakeVis = inp.brake > 0 && this.vf > 0.5;
    // ubrání plynu: turbo upustí tlak (pšš), výfuk prskne
    if (this.running && this._pthr > 0.6 && inp.throttle < 0.2) {
      if (this.espec && this.espec.ind === 1 && this.boost > 0.4) { Sfx.blowoff(this.boost); this.boost *= 0.3; }
      if (this.rpm > 3800 && Math.random() < (this.cosm.exhaust ? 0.85 : 0.3)) Sfx.backfire(!!this.cosm.exhaust);
    }
    this._pthr = this.running ? inp.throttle : 0;
    const N = 4, h = dt / N;
    for (let i = 0; i < N; i++) this.step(h, inp, env);
    this.updateSystems(dt, env);
    this.updateVisual(dt);
  }

  step(h, inp, env) {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), lx = Math.cos(this.yaw), lz = -Math.sin(this.yaw);
    let vf = this.vx * fx + this.vz * fz, vl = this.vx * lx + this.vz * lz;
    const speed = Math.hypot(vf, vl), g = 9.81, m = this.m, L = this.a + this.b;
    const surf = World.nearestRoad(this.x, this.z, 1);
    this.onRoad = !!(surf && surf.d < ROAD_HW + 0.3);
    const mu = (this.onRoad ? 1.2 : env.offroadMu * 1.1) * (env.gripMul || 1);
    const muF = mu * (this.tireGrip(0) + this.tireGrip(1)) / 2, muRb = mu * (this.tireGrip(2) + this.tireGrip(3)) / 2;
    const maxSteer = 0.62 / (1 + speed / 16);
    if (inp.direct) {   // volant: kola přesně podle volantu (jen mírně menší rejd v rychlosti podle nastavení)
      const ms = 0.62 / (1 + speed / 16 * inp.ss);
      this.steer += U.clamp(inp.steer * ms - this.steer, -14 * h, 14 * h);
    } else this.steer += U.clamp(inp.steer * maxSteer - this.steer, -4.2 * h, 4.2 * h);   // rychlejší, ostřejší odezva volantu
    let thrIn = inp.throttle, brkIn = inp.brake;
    if (this.shiftT > 0) this.shiftT -= h;
    if (this.auto && this.running) {
      if (brkIn > 0 && vf < 0.8 && this.gear >= 1 && thrIn === 0) this.gear = -1;
      else if (thrIn > 0 && vf > -0.8 && this.gear <= 0) this.gear = 1;
      if (this.gear === 0) this.gear = 1;
      // řazení podle zatížení: s lehkou nohou nahoru už kolem 2700 ot., naplno až u 5600 (dřív jel vůz ve 2. až do 90 km/h a přehříval se)
      this._ld = (this._ld || 0) + ((thrIn > 0.1 ? thrIn : 0) - (this._ld || 0)) * Math.min(1, h * 1.2);
      this.gHold = Math.max(0, (this.gHold || 0) - h);
      if (this.gear >= 1 && this.shiftT <= 0 && this.gHold <= 0) {
        const up = 2700 + 2900 * this._ld, dn = 1250 + 1300 * this._ld, rw = Math.abs(vf) / WR * this.ratio(this.gear) * this.gb().fin * 9.549;   // otáčky podle kol (ne prokluzující spojky)
        if (rw > up && this.gear < this.maxGear() && thrIn > 0.05) { this.gear++; this.shifted(); this.shiftT += 0.08; this.gHold = 1; }
        else if (rw < dn && this.gear > 1) { this.gear--; this.shifted(); this.gHold = 0.8; }
      }
      if (this.gear === -1) { const t = thrIn; thrIn = brkIn; brkIn = t; }
    }
    const gbox = this.slots.gearbox, gbDead = gbox && gbox.cond <= 0;
    const ratio = gbDead ? 0 : this.ratio(this.gear), FIN = this.gb().fin;
    let thr = this.running && !this.wrecked ? thrIn : 0;
    if (this.running) {
      if (ratio === 0) this.rpm += ((IDLE + thr * 5600) - this.rpm) * Math.min(1, h * 6);
      else {
        const wheelRpm = Math.abs(vf) / WR * Math.abs(ratio) * FIN * 9.549;
        const slipRpm = IDLE + thr * (Math.abs(this.gear) === 1 ? 2400 : 1000);
        this.rpm = Math.max(wheelRpm, Math.min(slipRpm, this.rpm + 8000 * h));
      }
      if (this.rpm > REDLINE) { thr = 0; this.rpm = REDLINE + Math.random() * 80; }
    } else this.rpm = Math.max(0, this.rpm - 3000 * h);
    this.throttle = thr;
    // přeplňování: turbo se roztáčí se zpožděním, kompresor táhne hned
    const es = this.espec;
    if (es && es.ind === 1) { const tgt = this.running ? thr * U.smooth(1800, 4200, this.rpm) : 0; this.boost += (tgt - this.boost) * Math.min(1, h * (tgt > this.boost ? 1.5 : 4)); }
    else if (es && es.ind === 2) this.boost = this.running ? thr * U.smooth(700, 5200, this.rpm) : 0;
    else this.boost = 0;
    let Fd = 0;
    if (this.running && ratio !== 0 && this.shiftT <= 0 && es) {
      const curve = U.clamp(1 - Math.pow((this.rpm - 4000) / 4200, 2), 0.35, 1);
      const indMul = es.ind === 1 ? 1 + (es.indTq - 1) * this.boost : es.ind === 2 ? 1 + (es.indTq - 1) * (0.55 + 0.45 * U.smooth(700, 5200, this.rpm)) : 1;
      Fd = es.torque * indMul * curve * thr * this.powerMul * env.powerMul * ratio * FIN * 0.85 / WR;
      if (thr === 0) Fd -= Math.sign(vf) * (this.rpm / 6000) * 500 * Math.abs(ratio) / 3;
    }
    const Nr = m * g * this.a / L, Nf = m * g * this.b / L, lim = muRb * Nr * 1.1;
    const fRatio = Math.abs(Fd) / lim;
    this.wspin = fRatio > 1 && Math.abs(vf) < 18 ? U.clamp((fRatio - 1) * 2, 0, 1) : 0;
    Fd = U.clamp(Fd, -lim, lim);
    let Fb = brkIn * 11000 + (inp.handbrake ? 3800 : 0);
    if (Math.abs(vf) < 0.4 && (brkIn > 0 || inp.handbrake) && Math.abs(Fd) < 50) { vf *= 0.5; Fb = 0; }
    const Fbrake = -Math.sign(vf) * Math.min(Fb, Math.abs(vf) * m / h * 0.9);
    const flats = this.tires.filter(t => t.cond <= 0).length;
    const Froll = -Math.sign(vf) * Math.min(Math.abs(vf), 1) * ((this.onRoad ? 180 : 900) + flats * 700) - vf * (this.onRoad ? 8 : 45) - 0.55 * vf * Math.abs(vf);
    const Fslope = -m * g * Math.sin(this.pitch);
    const vfa = Math.max(Math.abs(vf), 2.5), sgn = vf >= 0 ? 1 : -1;
    const af = Math.atan2(vl + this.w * this.a, vfa) - this.steer * sgn;
    const ar = Math.atan2(vl - this.w * this.b, vfa);
    // v plazivé rychlosti boční síly slábnou (úhel skluzu je u stojícího auta nesmyslný) – jinak natočená kola brzdila a auto se z místa nerozjelo
    const lowK = U.clamp(speed / 2.5, 0.1, 1);
    const Ff = U.clamp(-80000 * af, -muF * Nf, muF * Nf) * lowK;
    // zadek ujíždí jen když se kola opravdu protáčejí (silné motory jdou ovládat, smyk se dá vyvolat plynem)
    const powerSlide = 1 - 0.18 * Math.min(1, fRatio) - 0.25 * U.smooth(1, 1.8, fRatio);
    const muR = muRb * (inp.handbrake ? 0.45 : 1) * powerSlide;
    const Fr = U.clamp(-80000 * ar, -muR * Nr, muR * Nr) * lowK;
    this.slip = Math.max(Math.abs(ar), Math.abs(af)) * (speed > 5 ? 1 : 0);
    const cs = Math.cos(this.steer), sn = Math.sin(this.steer);
    const accF = (Fd + Fbrake + Froll + Fslope - Ff * sn) / m + this.w * vl;
    const accL = (Fr + Ff * cs) / m - this.w * vf;
    this.w += (this.a * Ff * cs - this.b * Fr) / this.I * h;
    this.w -= this.w * 0.9 * h;
    // píchlé kolo táhne na stranu
    const pull = ((this.tires[0].cond <= 0) + (this.tires[2].cond <= 0) - (this.tires[1].cond <= 0) - (this.tires[3].cond <= 0)) * 0.012 * vf;
    this.w += pull * h;
    vf += accF * h; vl += accL * h;
    if (speed < 3) { const bl = 1 - speed / 3; this.w = U.lerp(this.w, vf * Math.tan(this.steer) / L, bl * 0.5); vl *= 1 - bl * 0.3; }
    this.yaw += this.w * h;
    const nfx = Math.sin(this.yaw), nfz = Math.cos(this.yaw), nlx = Math.cos(this.yaw), nlz = -Math.sin(this.yaw);
    // vítr v bouři auto jen postrkuje (hlavně do boku) – dřív byl tak silný, že poškozené auto proti větru couvalo i na plný plyn a stojící auto ujíždělo
    const wk = 0.35 * Math.min(1, speed / 6) * h;
    this.vx = nfx * vf + nlx * vl + env.windX * wk; this.vz = nfz * vf + nlz * vl + env.windZ * wk;
    this.vf = vf; this.vl = vl;
    this.x += this.vx * h; this.z += this.vz * h;
    this.odo += Math.abs(vf) * h;
    this.collide();
  }

  collide() {
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    for (const off of [1.25, -1.25]) {
      World.forCols(this.x + fx * off, this.z + fz * off, (c) => {
        const r = U.circleVs(this.x + fx * off, this.z + fz * off, 0.98, c);
        if (!r) return;
        this.x += r.nx * r.depth; this.z += r.nz * r.depth;
        const vn = this.vx * r.nx + this.vz * r.nz;
        if (vn < 0) {
          this.vx -= 1.3 * vn * r.nx; this.vz -= 1.3 * vn * r.nz;
          this.vx *= 0.85; this.vz *= 0.85;
          this.w += (Math.random() - 0.5) * 0.15 * Math.min(-vn, 10);
          this.impact(-vn, off > 0, c.kind);
        }
      });
    }
  }
  fatalSpeed() { return Perks.has('tuhy') ? 25 : 19.5; }
  impact(sp, front, kind) {
    if (sp < 3) return;
    const eff = kind === 'cactus' || (kind === 'pole' && sp < 25) ? sp * 0.7 : sp;
    if (eff > this.fatalSpeed()) { this.onCrash(sp, true); return; }
    const dmg = (eff - 3) * 3.2 * (front && this.cosm.front ? 0.75 : 1), s = this.slots;
    this.body = Math.max(0, this.body - dmg);
    if (front && s.radiator) s.radiator.cond = Math.max(0, s.radiator.cond - dmg * 0.9);
    if (s.engine && !s.engine.seized) s.engine.cond = Math.max(0, s.engine.cond - dmg * 0.25);
    if (front && Math.random() < 0.5) { const i = Math.random() < 0.5 ? 0 : 1; this.damageTire(i, dmg * 0.8); }
    this.shake = Math.min(1, eff / 12);
    if (this.body <= 0 && !this.wrecked) { this.wrecked = true; this.running = false; this.onMsg('Auto je rozbité – potřebuješ opravnou sadu', 'bad'); }
    this.onCrash(sp, false);
  }
  damageTire(i, amt) {
    const t = this.tires[i], was = t.cond;
    t.cond = Math.max(0, t.cond - amt);
    if (was > 0 && t.cond <= 0) this.onMsg(`Píchnul jsi ${TIRE_NAMES[i]} kolo! Vyměň ho za jiné`, 'bad');
  }
  hitBy(nx, nz, sp) {
    this.vx += nx * sp * 0.6; this.vz += nz * sp * 0.6; this.w += (Math.random() - 0.5) * sp * 0.08;
    this.impact(sp, true, 'car');
  }

  updateSystems(dt, env) {
    const sp = this.speed, s = this.slots, e = s.engine;
    const dKm = Math.abs(this.vf) * dt / 1000;
    let heatGen = 0;
    // --- opotřebení dílů ---
    const wear = (k, rate) => { const p = s[k]; if (p && p.cond > 0) p.cond = Math.max(0, p.cond - rate * this.wm(p)); };
    if (this.running) {
      wear('plugs', 2.5 * dKm + 0.001 * dt);
      wear('airfilter', 2.5 * dKm * (1 + env.storm * 4) * (this.onRoad ? 1 : 2));
      wear('belt', 2 * dKm * (this.engineTemp > 115 ? 2 : 1));
      wear('fuelpump', 1.2 * dKm);
      wear('alternator', 0.9 * dKm);
      wear('engine', 0.3 * dKm * (s.airfilter ? 1 : 8));
      wear('radiator', 0.3 * dKm);
      wear('gearbox', 0.5 * dKm * (this.espec ? 0.7 + this.espec.torque / 300 : 1));
    }
    for (let i = 0; i < 4; i++) {
      const t = this.tires[i];
      if (t.cond > 0) t.cond = Math.max(0, t.cond - 1.6 * dKm * WEAR_MUL[t.tier] * (this.onRoad ? 1 : 2) * (1 + this.slip * 5));
      if (t.cond < 20 && !this.warned['tire' + i]) { this.warned['tire' + i] = true; this.onMsg(`Kolo ${TIRE_NAMES[i]} je sjeté (${Math.round(t.cond)} %)`, 'warn'); }
    }
    for (const k of BAY_SLOTS) {
      const p = s[k];
      if (p && k !== 'battery' && p.cond < 25 && !this.warned[k]) { this.warned[k] = true; this.onMsg(`${PARTS[k].name}: skoro odešlo (${Math.round(p.cond)} %)`, 'warn'); }
    }
    // --- výkon ---
    if (this.misfireT > 0) this.misfireT -= dt;
    if (this.running) {
      const pl = s.plugs, af = s.airfilter, fp = s.fuelpump;
      if (pl.cond < 35 && Math.random() < (35 - pl.cond) / 35 * 2.5 * dt) { this.misfireT = 0.12 + Math.random() * 0.12; Sfx.pop(); }
      if (fp.cond < 25 && this.throttle > 0.6 && Math.random() < (25 - fp.cond) / 25 * 2 * dt) { this.misfireT = 0.3; Sfx.pop(); }
      let pm = PARTS.plugs.stat[pl.tier] * PARTS.carb.stat[s.carb.tier] * (0.85 + 0.15 * s.carb.cond / 100);
      pm *= af ? PARTS.airfilter.stat[af.tier] * (0.85 + 0.15 * af.cond / 100) : 1.05;
      pm *= 0.55 + 0.45 * e.cond / 100;
      if (this.misfireT > 0) pm *= 0.25;
      this.powerMul = pm;
      const load = this.throttle * this.rpm / 6000;
      const cons = this.espec.cons * (1 + this.boost * 0.25) * [1.15, 1, 1.05, 1.1, 1.0][s.carb.tier] * (Perks.has('setrny') ? 0.85 : 1);
      this.fuel -= (0.012 + 0.11 * load) * cons * dt;
      this.oil -= 0.0035 * (1 + (100 - e.cond) / 60) * dt;
      heatGen = (0.3 + 2.3 * load) * this.espec.heat * (1 + this.boost * 0.15) * env.heatMul;
      const beltOk = s.belt && s.belt.cond > 0;
      if (s.alternator && beltOk && s.alternator.cond > 0 && this.rpm > 1200)
        s.battery.charge = Math.min(100, s.battery.charge + PARTS.alternator.stat[s.alternator.tier] * (0.3 + 0.7 * s.alternator.cond / 100) * dt / PARTS.battery.stat[s.battery.tier]);
      if (s.belt && s.belt.cond <= 0 && !this.warned.beltSnap) { this.warned.beltSnap = true; this.onMsg('Praskl řemen! Nedobíjí se a motor se přehřívá', 'bad'); Sfx.pop(); }
      if (s.gearbox && s.gearbox.cond <= 0 && !this.warned.gbDead) { this.warned.gbDead = true; this.onMsg('Převodovka odešla – kola se netočí! Sežeň jinou', 'bad'); Sfx.shift(0); }
      else if (s.gearbox && s.gearbox.cond < 20 && this.gear > 1 && this.throttle > 0.8 && Math.random() < 0.08 * dt) { this.shiftT = 0.6; Sfx.shift(0); this.onMsg('Převodovka skřípe, vyskočil převod!', 'warn'); }
      if (!s.airfilter && !this.warned.noFilter) { this.warned.noFilter = true; this.onMsg('Bez vzduchového filtru motor žere písek!', 'warn'); }
    }
    const rad = s.radiator;
    const leak = rad ? 0.0022 * (1 + (1 - rad.cond / 100) * 6) : 0.04;
    this.coolant = Math.max(0, this.coolant - leak * dt * (this.running ? 1 : 0.3));
    this.fuel = Math.max(0, this.fuel); this.oil = Math.max(0, this.oil);
    // --- teplota ---
    const coolFrac = U.clamp(this.coolant / 4, 0, 1);
    const radEff = rad ? PARTS.radiator.stat[rad.tier] * (0.3 + 0.7 * rad.cond / 100) : 0;
    const pump = s.belt && s.belt.cond > 0 ? 1 : 0.2;
    let k = 0.05 * radEff * coolFrac * pump * (0.55 + 0.6 * Math.min(sp / 25, 1));
    if (this.engineTemp < 88) k *= 0.12;
    k += 0.008;
    this.engineTemp += (heatGen - k * (this.engineTemp - env.ambient)) * dt;
    const oilFrac = U.clamp(this.oil / 3, 0, 1);
    const oilTarget = this.running ? this.engineTemp + 8 + (1 - oilFrac) * 45 : this.engineTemp;
    this.oilTemp += (oilTarget - this.oilTemp) * 0.15 * dt;
    if (this.running) {
      if (this.engineTemp > 122) e.cond -= (this.engineTemp - 122) * 0.5 * dt;
      if (this.oilTemp > 145) e.cond -= (this.oilTemp - 145) * 0.4 * dt;
      if (this.engineTemp > 115 && !this._hotWarn) { this._hotWarn = true; this.onMsg('Motor se přehřívá! Zastav a nech ho vychladnout', 'warn'); }
      if (this.engineTemp < 105) this._hotWarn = false;
      const stall = (t) => { this.running = false; this.onMsg(t, 'bad'); };
      if (this.oil <= 0) { e.seized = true; e.cond = 0; stall('Došel olej – motor se zadřel!'); Sfx.crash(0.5); }
      else if (e.cond <= 0) { e.cond = 0; e.seized = true; stall('Motor odešel – sežeň jiný'); }
      else if (this.fuel <= 0) stall('Došel benzín!');
      else if (s.plugs.cond <= 0) stall('Svíčky odešly – motor zhasl');
      else if (s.fuelpump.cond <= 0) stall('Palivové čerpadlo odešlo – motor zhasl');
      else if (s.airfilter && s.airfilter.cond <= 0) stall('Ucpaný vzduchový filtr – motor se udusil');
    }
    if (this.lights) {
      if (s.battery && s.battery.charge > 0) s.battery.charge -= 0.12 * dt / PARTS.battery.stat[s.battery.tier];
      else this.lights = false;
    }
    if (s.battery) s.battery.charge = Math.max(0, s.battery.charge);
    // díry v silnici
    this.holeCd -= dt;
    const holes = World.holesNear(this.x, this.z);
    if (holes && sp > 7 && this.holeCd <= 0) for (const hl of holes) {
      if (Math.hypot(hl.x - this.x, hl.z - this.z) < hl.r + 0.9) {
        this.holeCd = 0.6; this.shake = 0.6; this.body = Math.max(0, this.body - sp * 0.2);
        if (Math.random() < 0.4) this.damageTire(Math.floor(Math.random() * 4), 40 + Math.random() * 70);
        this.onMsg('Díra v silnici!', 'warn'); Sfx.bump(); break;
      }
    }
  }

  updateVisual(dt) {
    const p = this.parts, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), lx = Math.cos(this.yaw), lz = -Math.sin(this.yaw);
    const hAt = (f, l) => World.height(this.x + fx * f + lx * l, this.z + fz * f + lz * l);
    const hFL = hAt(1.3, 0.78), hFR = hAt(1.3, -0.78), hRL = hAt(-1.3, 0.78), hRR = hAt(-1.3, -0.78);
    const ty = (hFL + hFR + hRL + hRR) / 4;
    // výška: auto jede přesně po terénu (žádné zpoždění na svahu → žádné „doskočení“), jen náhlé schody v terénu se rozpustí
    const moved = this._vx === undefined ? 99 : Math.hypot(this.x - this._vx, this.z - this._vz);
    this._vx = this.x; this._vz = this.z;
    if (moved > 6 || this._ty === undefined) this._yo = 0;   // teleport / respawn
    else this._yo = U.clamp(((this._yo || 0) + this._ty - ty) * Math.exp(-dt * 14), -0.6, 0.6);
    this._ty = ty; this.y = ty + this._yo;
    this.pitch = U.lerp(this.pitch, Math.atan2((hFL + hFR - hRL - hRR) / 2, 2.6), Math.min(1, dt * 8));
    this.roll = U.lerp(this.roll, Math.atan2((hFL + hRL - hFR - hRR) / 2, 1.56), Math.min(1, dt * 8));
    this.shake = Math.max(0, this.shake - dt * 2);
    this._bt = (this._bt || 0) + dt * 40;
    const bump = this.shake * Math.sin(this._bt) * 0.04;
    // náklon karoserie při zrychlení/brzdění a v zatáčkách – kola zůstávají na zemi, pružiny se stlačují
    const acc = (this.vf - (this._pvf === undefined ? this.vf : this._pvf)) / Math.max(dt, 1e-3); this._pvf = this.vf;
    this._lp = U.lerp(this._lp || 0, U.clamp(acc * 0.004, -0.025, 0.025), Math.min(1, dt * 5));
    this._lr = U.lerp(this._lr || 0, U.clamp(this.vf * this.w * 0.005, -0.04, 0.04), Math.min(1, dt * 5));
    const pitchT = this.pitch + this._lp, rollT = this.roll + this._lr;
    p.root.position.set(this.x, this.y + bump, this.z);
    p.root.rotation.set(-pitchT, this.yaw, rollT, 'YXZ');
    const spin = this.vf / WR * dt, hs = [hFL, hFR, hRL, hRR];
    p.wheels.forEach((wh, i) => {
      wh.spin.rotation.x += spin;
      const flat = this.tires[i].cond <= 0, r = flat ? WHEEL_R * 0.75 : WHEEL_R;
      const ground = hs[i] - (this.y + bump + wh.z * Math.sin(pitchT) + wh.x * Math.sin(rollT));
      const py = U.clamp(ground + r, WHEEL_R - 0.16, WHEEL_R + 0.12);
      wh.pivot.position.y = py;
      wh.spin.scale.set(1, flat ? 0.75 : 1, flat ? 0.75 : 1);
      wh.susp.position.y = py; wh.susp.scale.y = Math.max(0.1, SPRING_TOP - py);
      wh.arm.position.y = py - 0.04;
    });
    p.axle.position.y = p.diff.position.y = (p.wheels[2].pivot.position.y + p.wheels[3].pivot.position.y) / 2;
    p.steerPivots.forEach(pv => { pv.rotation.y = this.steer; });
    p.wheelGrp.rotation.z = -this.steer * 2.6;
    this.hoodAngle = U.lerp(this.hoodAngle, this.hoodOpen ? -1.15 : 0, Math.min(1, dt * 6));
    p.hood.rotation.x = this.hoodAngle;
    p.hoodProp.visible = this.hoodOpen;
    p.bayLight.intensity = this.hoodOpen ? 1.6 * (-this.hoodAngle / 1.15) : 0;
    for (const k of BAY_SLOTS) p.ghosts[k].visible = this.hoodOpen && !this.slots[k];
    p.gearStick.rotation.set(this.gear === -1 ? 0.3 : this.gear === 0 ? 0 : (this.gear % 2 ? -0.3 : 0.3), 0, this.gear >= 3 ? -0.25 : this.gear >= 1 ? 0.15 : 0.35);
    p.hbLever.rotation.x = this.handbrake ? -0.5 : 0;
    const bat = this.slots.battery, lit = this.lights && bat && bat.charge > 0;
    p.headMat.emissive.setHex(lit ? 0xfff2c0 : 0x000000);
    const bar = this.cosm.roof && this.cosm.roof.kind === 'lightbar' && p.cosm.roof;
    p.spot.intensity = lit ? (bar ? 3.8 : 2.4) : 0; p.spot.angle = bar ? 0.8 : 0.55;
    if (bar && p.cosm.roof.lamp) p.cosm.roof.lamp.emissive.setHex(lit ? 0xfff2c0 : 0);
    p.tailMat.emissive.setHex(this._brakeVis && bat ? 0xff2010 : lit ? 0x601008 : 0x000000);
    this._dashT -= dt; this._diagT -= dt;
    if (this._dashT <= 0) { this._dashT = 1 / 15; CarModel.drawDash(this, p); }
    if (this._diagT <= 0) { this._diagT = 0.5; CarModel.drawDiag(this, p); }
  }

  // ---------- smrtelná bouračka ----------
  explode() {
    this.exploded = true; this.running = false;
    const p = this.parts, v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    p.root.updateMatrixWorld(true);
    for (const m of p.debris) {
      const piece = new THREE.Mesh(m.geometry, m.material);
      m.matrixWorld.decompose(v, q, s);
      piece.position.copy(v); piece.quaternion.copy(q); piece.scale.copy(s); piece.castShadow = true;
      this.scene.add(piece);
      this.debris.push({ mesh: piece, vx: this.vx * (0.4 + Math.random() * 0.5) + (Math.random() - 0.5) * 8,
        vy: 3 + Math.random() * 7, vz: this.vz * (0.4 + Math.random() * 0.5) + (Math.random() - 0.5) * 8,
        ax: (Math.random() - 0.5) * 12, ay: (Math.random() - 0.5) * 12, az: (Math.random() - 0.5) * 12 });
    }
    p.root.visible = false;
  }
  updateDebris(dt) {
    for (const d of this.debris) {
      const m = d.mesh; d.vy -= 9.81 * dt;
      m.position.x += d.vx * dt; m.position.y += d.vy * dt; m.position.z += d.vz * dt;
      m.rotation.x += d.ax * dt; m.rotation.y += d.ay * dt; m.rotation.z += d.az * dt;
      const gy = World.height(m.position.x, m.position.z) + 0.15;
      if (m.position.y < gy) { m.position.y = gy; d.vy = Math.abs(d.vy) * 0.3; d.vx *= 0.6; d.vz *= 0.6; d.ax *= 0.6; d.ay *= 0.6; d.az *= 0.6; }
    }
  }
  reassemble() {
    for (const d of this.debris) this.scene.remove(d.mesh);
    this.debris = [];
    const r = World.nearestRoad(this.x, this.z, 3);
    if (r) {
      const p = World.pts[r.i];
      this.x = p.x + Math.cos(p.t) * 1.75; this.z = p.z + Math.sin(p.t) * 1.75;
      this.yaw = Math.atan2(Math.sin(p.t), -Math.cos(p.t));
    }
    this.vx = this.vz = this.w = this.vf = this.vl = 0; this.steer = 0;
    this.exploded = false; this.parts.root.visible = true;
    this.body = 15; this.wrecked = false;
    const s = this.slots;
    if (s.radiator) s.radiator.cond = Math.min(s.radiator.cond, 30);
    if (s.engine && !s.engine.seized) s.engine.cond = Math.max(15, s.engine.cond * 0.5);
    this.tires.forEach(t => { t.cond = Math.max(5, t.cond - 30); });
    this.running = false; this.gear = this.auto ? 1 : 0;
  }
}
