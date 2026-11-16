// rallycar.js – fyzika rally auta: 4 kola s přenosem zatížení, kombinovaný skluz pneumatik podle povrchu a směsi,
// pohon 4×4 s viskózní spojkou, motor s turbem, převodovka, ruční brzda, skoky a poškození
// Souřadnice: dopředu = (sin h, cos h), doleva = (cos h, −sin h); kladné r = otáčení doleva. Kola: 0 LP, 1 PP, 2 LZ, 3 PZ.
// ochota zatáčet: víc přilnavosti vpředu, míň setrvačnosti kolem svislé osy → auto se rychleji stáčí do zatáčky
const RC_TURN = { front: 1.12, rear: 1.18, inertia: 1.12 };   // záď drží (na asfaltu se auto samo nerozhodí do smyku), pořád ochotně zatáčí
// rozměry: rozvor 2,6 m, rozchod 1,56 m (kola na ±0,78 m jako na modelu), těžiště 0,5 m nad zemí
const RC_A = 1.3, RC_B = 1.3, RC_HT = 1.56, RC_R = 0.36, RC_H = 0.46;
// podvozek: 4 nezávislé pružiny + tlumiče (odskok tvrdší než stlačení), dorazy, stabilizátory.
// sag = statické stlačení (měkčí podvozek = větší), down/up = zdvih kola dolů/nahoru od klidové polohy,
// Ip/Ir = moment setrvačnosti karoserie pro klopení/náklon (× hmotnost), arb = stabilizátor (× tuhost pružiny)
const RC_SUS = { sag: 0.075, down: 0.15, up: 0.13, zeta: 0.5, arbF: 0.95, arbR: 0.6, Ip: 1.45, Ir: 0.42 };   // tužší, pevně tlumené – auto sedí na silnici
// drobné nerovnosti povrchu (amplituda v m) – deterministické podle místa, takže se nic „netřese“ náhodně
const RC_HUB = 0.22;
// neodpružená hmota: kolo (38 kg) na pružné pneumatice – filtruje drobné nerovnosti, kolo může poskočit
const RC_UNS = { m: 38, kt: 210000, ct: 900 };   // o kolik klesne roh bez kola, než náboj dosedne na zem
const RC_TEX = { asphalt: 0.0006, gravel: 0.0025, sand: 0.002, off: 0.005 };
// přilnavost směsi na povrchu (násobí μ povrchu)
const RALLY_COMPOUND = {
  road: { asphalt: 1.12, gravel: 0.78, sand: 0.6, off: 0.55 },
  gravel: { asphalt: 0.9, gravel: 1.04, sand: 0.8, off: 0.78 },
  sand: { asphalt: 0.78, gravel: 0.86, sand: 1.06, off: 0.92 },
  all: { asphalt: 0.95, gravel: 0.92, sand: 0.84, off: 0.74 },
};
const RC_PEAK = { asphalt: [0.1, 0.13], gravel: [0.16, 0.2], sand: [0.22, 0.26], off: [0.2, 0.24] };   // [κp, αp]

class RallyCar {
  constructor(s) {
    this.s = s;   // {hp, mass, ratios[], final, red, shift, boost, lag, als, tire:{c, tier}, brake, susp, skid, bull}
    this.reset(0, 0, 0, 0);
  }
  reset(x, z, h, y) {
    Object.assign(this, { x, z, y: y || 0, h, vx: 0, vz: 0, vy: 0, r: 0, steer: 0, ax: 0, ay: 0, wF: 0, wR: 0, gear: 1, shiftT: 0, rpm: 900, boost: 0,
      air: false, airT: 0, pitch: 0, roll: 0, pv: 0, rv: 0, bz: 0, bp: 0, br: 0, droop: 0, thr: 0, brk: 0, hb: false, slip: [0, 0, 0, 0], wspin: 0, onGround: true, limiter: false, lastLand: 0,
      wy: [0, 0, 0, 0], fz: [0, 0, 0, 0], fzg: null, wz: null, wv: [0, 0, 0, 0], tipT: 0 });
    if (!this.dmg) this.dmg = { front: 0, rear: 0, left: 0, right: 0, engine: 0, wheel: [0, 0, 0, 0], off: [false, false, false, false] };
    this.surf = ['gravel', 'gravel', 'gravel', 'gravel']; this.gh = [y || 0, y || 0, y || 0, y || 0];
  }
  get speed() { return Math.hypot(this.vx, this.vz); }
  get vf() { return this.vx * Math.sin(this.h) + this.vz * Math.cos(this.h); }
  torque(rpm) {
    const s = this.s, r = U.clamp(rpm / s.red, 0.12, 1.05);
    const base = s.hp * 745.7 / (s.red * 0.78 * Math.PI / 30) * 1.18;     // Nm z výkonu (maximum kolem 78 % otáček)
    return base * (0.62 + 0.9 * r - 0.75 * r * r);
  }
  ratio() { const s = this.s; return this.gear === -1 ? -3.4 * s.final : this.gear === 0 ? 0 : s.ratios[this.gear - 1] * s.final; }
  shiftUp() { if (this.gear < this.s.ratios.length && this.shiftT <= 0) { this.gear = this.gear === -1 ? 1 : this.gear + 1; this.shiftT = this.s.shift; return true; } return false; }
  shiftDown() { if (this.gear > 1 && this.shiftT <= 0) { this.gear--; this.shiftT = this.s.shift; return true; } if (this.gear === 1 && this.speed < 1.5) { this.gear = -1; this.shiftT = 0.3; return true; } return false; }
  // tr = RallyTrack, inp = {thr, brk, steer(−1..1, + vlevo), hb}
  step(dt, inp, tr) {
    const s = this.s, N = 8, h = dt / N, m = s.mass, g = 9.81, L = RC_A + RC_B;
    // povrch a výška pod každým kolem (jednou za snímek)
    const sh = Math.sin(this.h), ch = Math.cos(this.h);
    const wpos = [[RC_HT / 2, RC_A], [-RC_HT / 2, RC_A], [RC_HT / 2, -RC_B], [-RC_HT / 2, -RC_B]];
    // výška země pod koly teď a tam, kde kolo bude na konci snímku (podkroky mezi tím interpolují → plynulý průběh)
    const hE = this.h + this.r * dt, sE = Math.sin(hE), cE = Math.cos(hE), xE = this.x + this.vx * dt, zE = this.z + this.vz * dt;
    const g0 = [0, 0, 0, 0], g1 = [0, 0, 0, 0];
    const cont = !!(this._g1 && this._pE && Math.hypot(this.x - this._pE[0], this.z - this._pE[1]) < 0.3);
    for (let i = 0; i < 4; i++) {
      const [lx, lz] = wpos[i];
      const wx = this.x + ch * lx + sh * lz, wz = this.z - sh * lx + ch * lz, nr = RallyTrack.nearest(tr, wx, wz);
      this.surf[i] = RallyTrack.surfAt(tr, wx, wz, nr);
      // navázat přesně na konec minulého snímku (jinak by zem pod kolem každý snímek „poskočila“ o pár mm a pneumatika by se rozkmitala)
      g0[i] = cont ? this._g1[i] : RallyTrack.height(tr, wx, wz, nr) + RallyCar.tex(wx, wz, this.surf[i]);
      const ex = xE + cE * lx + sE * lz, ez = zE - sE * lx + cE * lz;
      g1[i] = RallyTrack.height(tr, ex, ez) + RallyCar.tex(ex, ez, this.surf[i]);
    }
    this._g1 = g1; this._pE = [xE, zE]; this.gh = g0.slice();
    const gy = (g0[0] + g0[1] + g0[2] + g0[3]) / 4;
    // podvozek: tuhost z hmotnosti a statického stlačení (lepší podvozek = tužší), kritické tlumení
    const mUn = RC_UNS.m, mb = m - 4 * mUn, pen0 = m * g / 4 / RC_UNS.kt;
    const sag = RC_SUS.sag / (s.springK || 1), Ks = mb * g / 4 / sag, Cs = 2 * RC_SUS.zeta * Math.sqrt(Ks * mb / 4);
    const Ip = m * RC_SUS.Ip, Ir = m * RC_SUS.Ir, Fz0 = m * g / 4;
    if (!this.wz) { this.wz = g0.map(v => v - pen0); this.wv = [0, 0, 0, 0]; }
    // tlumič: do ~0,3 m/s lineární, nad tím ventil povolí (degresivní) – ostrá nerovnost nekopne do karoserie
    const damp = (v) => { const a = Math.abs(v), f = a < 0.3 ? a : 0.3 + (a - 0.3) * 0.3; return Cs * Math.sign(v) * f * (v > 0 ? 0.7 : 1.35); };
    const gvel = [0, 1, 2, 3].map(i => (g1[i] - g0[i]) / Math.max(dt, 1e-4));
    // řízení: rychlost natočení a menší rejd ve vysoké rychlosti
    const v0 = this.speed, maxSt = RallyCar.maxSteer(inp.direct ? v0 * Math.sqrt(inp.ss) : v0);   // volant: rejd podle nastavení
    const want = inp.steer * maxSt + (this.dmg.wheel[0] - this.dmg.wheel[1]) * 0.0006 + (this.dmg.front > 40 ? 0.012 : 0);
    const sr = inp.direct ? 30 * maxSt : (Math.abs(want) < Math.abs(this.steer) || want * this.steer < 0 ? 11 : 6.5) * maxSt;   // ~0,15 s na plný rejd, rychlejší návrat
    this.steer += U.clamp(want - this.steer, -dt * sr, dt * sr);
    this.thr += U.clamp((inp.thr || 0) - this.thr, -dt * 8, dt * 6);
    this.brk += U.clamp((inp.brk || 0) - this.brk, -dt * 8, dt * 4); this.hb = !!inp.hb;
    // automatická převodovka
    if (this.shiftT > 0) this.shiftT -= dt;
    // Automat rozhoduje podle otáček, které by motor měl v daném převodu při AKTUÁLNÍ rychlosti kol
    // (ne podle otáček, které během řazení ještě „doznívají“ – to dřív řadilo v kaskádě 6→1→6).
    // Hystereze + minimální doba v převodu → žádné přeskakování sem a tam.
    this.gearHold = Math.max(0, (this.gearHold || 0) - dt);
    if (s.auto && this.shiftT <= 0 && this.gear > 0) {
      const n = s.ratios.length, wA = Math.abs(this.wF + this.wR) / 2, wV = Math.abs(this.vf) / RC_R;
      const rpmAt = (gi, w) => w * s.ratios[gi - 1] * s.final * 30 / Math.PI;
      const load = Math.max(this.thr, 0.15);
      const up = s.red * (0.62 + 0.32 * load), down = s.red * (0.28 + 0.24 * load);   // plný plyn: řadí až u omezovače; lehce: dřív a níž
      const rNow = rpmAt(this.gear, Math.max(wA, wV));
      if (this.gear < n && rNow > up && (this.gearHold <= 0 || rNow > s.red * 0.98) && !this.air && (Math.max(this.brk, inp.brk || 0) < 0.1 || rNow > s.red * 0.98) && rpmAt(this.gear + 1, wA) > down * 1.15) {   // při brzdění nepřeřazuje nahoru
        this.gear++; this.shiftT = s.shift; this.gearHold = 0.6;
      } else if (this.gear > 1 && this.gearHold <= 0 && rpmAt(this.gear, wV) < down && rpmAt(this.gear - 1, wV) < s.red * 0.86) {
        this.gear--; this.shiftT = s.shift * 0.7; this.gearHold = 0.45;
      }
    }
    if (s.auto) {   // automat: S při stání = zpátečka, W = jedna
      // zpátečka až když auto stojí a brzdu držíš ještě chvilku (ne při dobrzďování)
      this.revT = !s.noRev && this.gear > 0 && (inp.brk || 0) > 0.5 && Math.abs(this.vf) < 0.25 && this.thr < 0.1 ? (this.revT || 0) + dt : 0;
      if (this.revT > 0.35) { this.gear = -1; this.shiftT = 0.25; this.revT = 0; }
      else if (this.gear === -1 && (inp.thr > 0.5 || s.noRev) && this.vf > -0.6) { this.gear = 1; this.shiftT = 0.25; }
    }
    const rev = this.gear === -1, brkIn = rev && s.auto ? this.thr : this.brk;
    let thrIn = rev && s.auto ? this.brk : this.thr;
    // launch control: z místa drží ideální otáčky spojky a ~3,5 s hlídá prokluz (ubere plyn, když se kola hrabou)
    if (s.lc) {
      if (this.speed < 0.6) this.lcT = 0; else this.lcT = (this.lcT || 0) + dt;
      this.lcOn = !rev && this.gear >= 1 && this.gear <= 2 && this.lcT < 3.5 && thrIn > 0.3;
      const slip = Math.max(this._kR || 0, this._kF || 0), lim = (this._kpR || 0.15) * 1.15;
      this.lcK = this.lcOn ? U.clamp((this.lcK || 1) + (slip > lim ? -dt * 7 : dt * 2.5), 0.4, 1) : 1;
      thrIn *= this.lcK;
    } else this.lcOn = false;
    // turbo
    const spool = U.clamp((this.rpm - s.red * 0.32) / (s.red * 0.3), 0, 1), bt = s.boost ? (s.als ? Math.max(0.75, thrIn) : thrIn) * spool : 0;
    this.boost += (bt - this.boost) * Math.min(1, dt * (bt > this.boost ? 1.6 / (s.lag || 1) : 4));
    const engHealth = 1 - this.dmg.engine * 0.0065;
    let slipSum = 0, spinSum = 0;
    this.slip = [0, 0, 0, 0];
    for (let k = 0; k < N; k++) {
      const shh = Math.sin(this.h), chh = Math.cos(this.h);
      let vf = this.vx * shh + this.vz * chh, vl = this.vx * chh - this.vz * shh;
      // ---- podvozek: síla každé pružiny+tlumiče = zatížení kola (přenos hmotnosti vzniká sám z klopení/náklonu karoserie)
      const fr = (k + 1) / N, cP = Math.cos(this.pitch), sP = Math.sin(this.pitch), cR = Math.cos(this.roll), sR = Math.sin(this.roll);
      const Fz = [0, 0, 0, 0], FS = [0, 0, 0, 0], X = [0, 0, 0, 0], XD = [0, 0, 0, 0], G = [0, 0, 0, 0], VB = [0, 0, 0, 0], YB = [0, 0, 0, 0];
      let contacts = 0, imp = 0;
      for (let i = 0; i < 4; i++) {
        const [lx, lz] = wpos[i];
        G[i] = g0[i] + (g1[i] - g0[i]) * fr;
        YB[i] = this.y + lz * sP + lx * sR; VB[i] = this.vy + lz * cP * this.pv + lx * cR * this.rv;
        if (this.dmg.off[i]) { this.wz[i] = G[i] - pen0; this.wv[i] = gvel[i]; X[i] = G[i] - YB[i] + sag; XD[i] = gvel[i] - VB[i]; continue; }
        // kolo se nevysune pod spodní doraz a nezajede nad horní
        const xMin = sag - RC_SUS.down, xMax = sag + RC_SUS.up + 0.07;
        if (this.wz[i] - YB[i] + sag < xMin) { this.wz[i] = YB[i] - sag + xMin; if (this.wv[i] < VB[i]) this.wv[i] = VB[i]; }
        if (this.wz[i] - YB[i] + sag > xMax) { this.wz[i] = YB[i] - sag + xMax; if (this.wv[i] > VB[i]) this.wv[i] = VB[i]; }
        X[i] = this.wz[i] - YB[i] + sag; XD[i] = this.wv[i] - VB[i];
      }
      for (let i = 0; i < 4; i++) {
        if (this.dmg.off[i]) {                                  // chybí kolo: roh nese náboj/kotouč, když klesne až k zemi
          const e = X[i] - sag - RC_HUB;
          if (e > 0) { Fz[i] = FS[i] = Math.max(0, Ks * 25 * e + Cs * 3 * XD[i]); contacts++; }
          continue;
        }
        // pružina + tlumič + stabilizátor + pryžový doraz (s hysterezí – energii pohltí, nevrací)
        const j = i ^ 1, arb = (i < 2 ? RC_SUS.arbF : RC_SUS.arbR) * Ks * (X[i] - (this.dmg.off[j] ? X[i] : X[j]));
        let f = Ks * Math.max(0, X[i]) + damp(XD[i]) + arb;
        const e = X[i] - sag - RC_SUS.up;
        if (e > 0) f += Ks * (8 * e + 900 * e * e) * (XD[i] < 0 ? 0.45 : 1) + Cs * 3 * Math.max(0, XD[i]);
        FS[i] = Math.max(0, f);
        // pneumatika: stlačení proti zemi
        const pen = G[i] - this.wz[i], Ft = pen > 0 ? Math.max(0, RC_UNS.kt * pen + RC_UNS.ct * (gvel[i] - this.wv[i])) : 0;
        if (Ft > 0) { contacts++; if (this.air) imp = Math.max(imp, gvel[i] - this.wv[i]); }
        Fz[i] = Ft;
        // kolo: tlačí ho zem nahoru, pružina dolů
        this.wv[i] += ((Ft - FS[i]) / mUn - g) * h; this.wz[i] += this.wv[i] * h;
      }
      // dopad po skoku
      if (this.air && contacts > 0) {
        if (this.airT > 0.12) this.lastLand = Math.max(this.lastLand, imp);
        this.air = false;
      } else if (!this.air && contacts === 0) { this.air = true; this.airT = 0; }
      if (this.air) this.airT += h;
      this.fz = Fz;
      // pneumatika nereaguje na změnu zatížení okamžitě – síla se ustálí až po ~0,4 m odvalení (relaxační délka).
      // Přilnavost proto nepulzuje s každým drobným hrbolem → plynulý rozjezd a předvídatelné zatáčení.
      if (!this.fzg) this.fzg = Fz.slice();
      { const vv0 = Math.hypot(this.vx, this.vz), tau = Math.max(0.02, 0.4 / Math.max(vv0, 1)), kf = h / (tau + h);
        for (let i = 0; i < 4; i++) this.fzg[i] += (Fz[i] - this.fzg[i]) * kf; }
      const FzG = this.fzg;
      // pneumatika: s rostoucím zatížením přilnavost mírně klesá (proto se přenos hmotnosti projeví na ovladatelnosti)
      const loadK = FzG.map(f => U.clamp(1.1 - 0.1 * f / Fz0, 0.78, 1.12));
      // motor → nápravy
      const ratio = this.ratio(), shifting = this.shiftT > 0, wAvg = (this.wF + this.wR) / 2;
      let rpm = Math.abs(wAvg * ratio) * 30 / Math.PI;
      const clutchRpm = this.lcOn ? s.red * 0.58 : 1000 + thrIn * (s.red * 0.42);   // launch control: spojka na ideálních otáčkách
      const slipping = (this.gear === 1 || rev) && rpm < clutchRpm;
      if (slipping || shifting || !ratio) rpm = U.lerp(this.rpm, shifting ? this.rpm * 0.985 : Math.max(900, clutchRpm * (slipping ? 1 : thrIn)), Math.min(1, h * 6));
      rpm = Math.max(800, rpm);
      this.limiter = rpm > s.red;
      let Te = 0;
      if (!shifting && ratio) {
        Te = this.limiter ? 0 : this.torque(rpm) * thrIn * (1 + (s.boost || 0) * this.boost) * engHealth;
        if (thrIn < 0.05 && !slipping) Te -= 0.02 * this.torque(rpm) * rpm / 1000;   // brzdění motorem
      }
      this.rpm = rpm;
      const Tdrive = Te * ratio * 0.88, Ie = shifting || slipping || !ratio ? 0 : 0.22 * ratio * ratio;
      // brzdy: 62/38, ruční zamkne zadní nápravu
      const bMax = (s.brake || 1) * 1900;
      // ABS: když kolo začne blokovat, povolí tlak (ruční brzda jde mimo ABS)
      const absF = (this._kF || 0) < -(this._kpF || 0.15) * 0.7 ? 0.2 : 1, absR = (this._kR || 0) < -(this._kpR || 0.15) * 0.7 ? 0.2 : 1;
      const TbF = brkIn * bMax * 0.7 * 2 * absF, TbR = brkIn * bMax * 0.3 * 2 * absR + (this.hb ? 4200 : 0);
      // síly pneumatik
      let Fx = 0, Fy = 0, Mz = 0;
      const axle = [[0, 1], [2, 3]], wAx = [this.wF, this.wR], Kax = [0, 0], Tt = [0, 0];
      for (let i = 0; i < 4; i++) {
        const [lx, lz] = wpos[i], front = i < 2, d = front ? this.steer : 0, cd = Math.cos(d), sd = Math.sin(d);
        const pvL = vl + this.r * lz, pvF = vf - this.r * lx;
        const vxw = pvL * sd + pvF * cd, vyw = pvL * cd - pvF * sd;
        if (this.dmg.off[i]) {   // chybí kolo: náboj dře o zem
          const sp = Math.hypot(pvL, pvF);
          if (sp > 0.05 && Fz[i] > 0) {
            const f = Math.min(sp * 4000, 0.75 * Fz[i]), fl = -pvL / sp * f, ff = -pvF / sp * f;
            Fx += ff; Fy += fl; Mz += lz * fl - lx * ff;
          }
          continue;
        }
        const surf = this.surf[i], S = RALLY_SURF[surf], [kp, ap] = RC_PEAK[surf];
        const mu = S.mu * (RALLY_COMPOUND[s.tire.c] || RALLY_COMPOUND.all)[surf] * s.tire.tier * (1 - this.dmg.wheel[i] * 0.002) * (front ? RC_TURN.front : RC_TURN.rear) * loadK[i];
        const w = wAx[front ? 0 : 1], den = Math.max(Math.abs(vxw), 2.5);
        const kap = (w * RC_R - vxw) / den, alp = Math.atan2(vyw, Math.max(Math.abs(vxw), 1.2));
        if (front) { this._kF = kap * Math.sign(vxw || 1); this._kpF = kp; } else { this._kR = kap * Math.sign(vxw || 1); this._kpR = kp; }
        const sx = kap / kp, sy = Math.tan(U.clamp(alp, -1.4, 1.4)) / ap, sn = Math.hypot(sx, sy);
        let fx = 0, fy = 0;
        if (sn > 1e-6 && FzG[i] > 1) {
          const F = mu * FzG[i] * Math.sin(1.3 * Math.atan(2.2 * sn));   // vrchol kolem sn≈1,2, za ním mírný pokles
          fx = F * sx / sn; fy = -F * sy / sn;
        }
        // valivý odpor (písek a mimo trať brzdí)
        fx -= Math.sign(vxw) * Math.min(Math.abs(vxw) * 2, 1) * S.roll * FzG[i];
        const fL = fx * sd + fy * cd, fF = fx * cd - fy * sd;
        Fx += fF; Fy += fL; Mz += lz * fL - lx * fF;
        Tt[front ? 0 : 1] -= fx * RC_R;
        Kax[front ? 0 : 1] += RC_R * RC_R * mu * FzG[i] * 2.86 / (kp * den) / (1 + 2 * sn * sn);
        slipSum += Math.min(1, Math.max(0, sn - 1)) * (FzG[i] > 1 ? 1 : 0);
        this.slip[i] = Math.max(this.slip[i], Math.min(1.5, sn));
        if (Math.abs(kap) > kp * 2.2) spinSum++;
      }
      // nápravy: hnací moment půl na půl + viskózní spojka, semi-implicitně
      const Iw = 2.4, kc = this.hb ? 0 : 380;
      const tF = Tdrive * 0.5 + Tt[0] - kc * (this.wF - this.wR), tR = Tdrive * 0.5 + Tt[1] - kc * (this.wR - this.wF);
      const IF = Iw + Ie * 0.5, IR = Iw + Ie * 0.5;
      let nF = this.wF + h * tF / (IF + h * (Kax[0] + kc)), nR = this.wR + h * tR / (IR + h * (Kax[1] + kc));
      const brake = (w, Tb, I, K) => { const dw = h * Tb / (I + h * K); return Math.abs(w) <= dw ? 0 : w - Math.sign(w) * dw; };
      nF = brake(nF, TbF, IF, Kax[0]); nR = brake(nR, TbR, IR, Kax[1]);
      if (this.hb) nR = 0;
      if (this.air) { nF *= 1 - h * 0.3; nR *= 1 - h * 0.3; }
      this.wF = nF; this.wR = nR;
      // odpor vzduchu a gravitace ze svahu
      const vv = Math.hypot(vf, vl), drag = 0.36 * (1 + (s.aero || 0)) * vv;
      Fx -= drag * vf; Fy -= drag * vl;
      const FxT = Fx, FyT = Fy;   // síly na úrovni země → klopí a naklání karoserii
      {
        const fzS = Fz[0] + Fz[1] + Fz[2] + Fz[3];
        if (fzS > 0) {
          const gP = ((G[0] + G[1]) - (G[2] + G[3])) / (2 * L), gR = ((G[0] + G[2]) - (G[1] + G[3])) / (2 * RC_HT);   // sklon pod koly
          Fx -= fzS * gP; Fy -= fzS * gR;
        }
      }
      // integrace v lokálním rámu
      // integrace ve světových souřadnicích (rychlost se s karoserií sama neotáčí)
      const axl = Fx / m, ayl = Fy / m;
      this.vx += (axl * shh + ayl * chh) * h; this.vz += (axl * chh - ayl * shh) * h;
      this.r += Mz / (m * RC_TURN.inertia) * h;
      if (!this.air) this.r *= 1 - h * 0.3;
      this.h += this.r * h;
      this.x += this.vx * h; this.z += this.vz * h;
      this.ax += (axl - this.ax) * Math.min(1, h * 12); this.ay += (ayl - this.ay) * Math.min(1, h * 12);
      // ---- karoserie: zdvih, klopení, náklon (pružiny + setrvačnost z tyre sil v těžišti nad zemí)
      let FzS = 0, Mp = m * FxT / m * RC_H, Mr = m * FyT / m * RC_H;
      for (let i = 0; i < 4; i++) { FzS += FS[i]; Mp += FS[i] * wpos[i][1] * cP; Mr += FS[i] * wpos[i][0] * cR; }
      this.vy += (FzS / mb - g) * h; this.y += this.vy * h;
      this.pv += Mp / Ip * h; this.rv += Mr / Ir * h;
      if (this.air) { this.pv *= 1 - h * 0.15; this.rv *= 1 - h * 0.4; }
      this.pitch += this.pv * h; this.roll += this.rv * h;
      // pojistka: karoserie nikdy neprojde zemí (kdyby náraz přetlačil doraz)
      // (jen u kol, která na autě jsou – roh bez kola nese náboj)
      let lowest = -1e9;
      for (let i = 0; i < 4; i++) if (!this.dmg.off[i]) lowest = Math.max(lowest, G[i] - wpos[i][1] * sP - wpos[i][0] * sR - RC_SUS.up - 0.15);
      if (this.y < lowest) { this.y = lowest; if (this.vy < 0) this.vy = 0; }
      // stání: nechvěj se
      if (vv < 0.15 && thrIn < 0.05 && !this.air) { this.vx *= 0.9; this.vz *= 0.9; this.r *= 0.9; }
    }
    // náklony v rozumných mezích (střecha se tu neřeší) a vizuální poloha kol vůči karoserii
    if (Math.abs(this.pitch) >= 1.2) { this.pitch = Math.sign(this.pitch) * 1.2; this.pv = 0; }
    if (Math.abs(this.roll) >= 0.9) { this.roll = Math.sign(this.roll) * 0.9; this.rv = 0; }
    // auto na boku/na čumáku a stojí → po chvíli ho „diváci“ postaví zpátky na kola
    this.tipT = (Math.abs(this.roll) > 0.6 || Math.abs(this.pitch) > 0.8) && this.speed < 2 ? this.tipT + dt : 0;
    if (this.tipT > 1.5) { this.tipT = 0; this.roll = this.pitch = this.pv = this.rv = 0; this.y = gy + 0.25; this.vy = 0; this.wz = null; }
    this.onGround = !this.air;
    this.springs(dt);
    this.slipAmt = slipSum / (4 * N); this.wspin = spinSum / (4 * N);
    const land = this.lastLand; this.lastLand = 0;
    return land;
  }
  // poloha kol vůči karoserii (pro model): kolo leží na zemi, dokud mu to zdvih dovolí, pak visí
  springs(dt) {
    const sag = RC_SUS.sag / (this.s.springK || 1), sP = Math.sin(this.pitch), sR = Math.sin(this.roll);
    const wpos = [[RC_HT / 2, RC_A], [-RC_HT / 2, RC_A], [RC_HT / 2, -RC_B], [-RC_HT / 2, -RC_B]], G = this._g1 || this.gh;
    for (let i = 0; i < 4; i++) {
      const [lx, lz] = wpos[i], x = (this.wz && !this.dmg.off[i] ? this.wz[i] : G[i]) - (this.y + lz * sP + lx * sR);
      const t = U.clamp(x, -RC_SUS.down, RC_SUS.up), cur = this.wy[i];
      this.wy[i] = this.wz ? t : t > cur ? t : cur + (t - cur) * Math.min(1, dt * 25);
    }
    this.bz = this.bp = this.br = this.droop = 0;
  }
  // drobný „asfalt/šotolina“ reliéf – součet pár vln, spojitý v prostoru
  static tex(x, z, surf) {
    const a = RC_TEX[surf] !== undefined ? RC_TEX[surf] : 0.003;
    return a * (Math.sin(x * 1.9 + z * 0.7) * Math.sin(z * 2.3 - x * 0.5) + 0.6 * Math.sin(x * 4.1 - z * 3.3) * Math.cos(z * 3.7 + x * 1.3));
  }
  // ruční odhad, kde je bod karoserie ve světě
  // rejd kol podle rychlosti (větší než dřív – auto zatáčí ochotněji i v rychlosti)
  static maxSteer(v) { return 0.64 / (1 + v * v * 0.0021); }
  local2world(lx, lz) { const sh = Math.sin(this.h), ch = Math.cos(this.h); return [this.x + ch * lx + sh * lz, this.z - sh * lx + ch * lz]; }
  world2local(wx, wz) { const dx = wx - this.x, dz = wz - this.z, sh = Math.sin(this.h), ch = Math.cos(this.h); return [dx * ch - dz * sh, dx * sh + dz * ch]; }
}
