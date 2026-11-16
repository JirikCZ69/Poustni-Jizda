// weapons.js – zbraně v první osobě: chladné zbraně, střelné zbraně, náboje, nabíjení, puškohled
// animace chladných zbraní: klíčové pózy [čas s, pozice xyz, rotace xyz (pořadí YXZ: y = špička doleva, x = špička nahoru, z = natočení), easing]
// nápřah → rychlý úder (zrychluje do zásahu) → dotažení → návrat. hit = kdy se počítá zásah.
const MELEE_ANIM = {
  bat: { hit: 0.17, keys: [
    [0, [0.05, -0.02, 0.05], [1.2, 0.3, -0.3]],                 // klid: pálka opřená o pravé rameno
    [0.11, [0.07, 0.02, 0.06], [1.4, 0.05, -0.45], 'io'],       // nápřah za hlavu
    [0.18, [0, -0.05, -0.12], [0.25, 0.45, -1.3], 'in'],        // švih vodorovně před sebou
    [0.27, [-0.12, -0.14, -0.06], [0.05, 1.0, -1.2], 'out'],    // dotažení doleva
    [0.55, [0.05, -0.02, 0.05], [1.2, 0.3, -0.3], 'io'] ] },
  knife: { hit: 0.1, keys: [
    [0, [0, 0, 0], [0.2, 0.15, 0]],
    [0.07, [0.05, -0.02, 0.08], [0.35, -0.15, 0.5], 'io'],      // stáhnout ruku
    [0.12, [-0.1, 0.04, -0.2], [0.25, 0.3, -0.4], 'in'],        // bodnutí doprostřed
    [0.2, [-0.12, 0.02, -0.22], [0.2, 0.35, -0.5], 'out'],
    [0.42, [0, 0, 0], [0.2, 0.15, 0], 'io'] ] },
  machete: { hit: 0.18, keys: [
    [0, [0, 0, 0], [0.6, 0.2, -0.2]],
    [0.12, [0.1, 0.15, 0.06], [1.5, -0.2, 0.3], 'io'],          // nápřah nad hlavu
    [0.2, [-0.08, -0.12, -0.16], [-0.5, 0.4, -0.2], 'in'],      // sek šikmo dolů
    [0.29, [-0.15, -0.2, -0.05], [-0.8, 0.6, -0.3], 'out'],
    [0.58, [0, 0, 0], [0.6, 0.2, -0.2], 'io'] ] },
  boxer: { hit: 0.08, keys: [
    [0, [0, -0.02, 0.04], [0.1, 0, 0]],
    [0.05, [0.03, -0.03, 0.1], [0.15, -0.1, 0.1], 'io'],
    [0.1, [-0.1, 0.04, -0.3], [0.05, 0.15, -0.2], 'in'],        // přímý direkt
    [0.3, [0, -0.02, 0.04], [0.1, 0, 0], 'io'] ] },
};
const meleeEase = { io: (t) => t * t * (3 - 2 * t), in: (t) => t * t, out: (t) => 1 - (1 - t) * (1 - t) };
function meleePose(A, t) {
  const K = A.keys; if (t <= 0) return [K[0][1], K[0][2]];
  for (let i = 1; i < K.length; i++) if (t <= K[i][0]) {
    const a = K[i - 1], b = K[i], u = (meleeEase[b[3]] || meleeEase.io)((t - a[0]) / (b[0] - a[0]));
    return [a[1].map((v, j) => v + (b[1][j] - v) * u), a[2].map((v, j) => v + (b[2][j] - v) * u)];
  }
  const L = K[K.length - 1]; return [L[1], L[2]];
}

const Weapons = {
  init(camera, scene) {
    this.cam = camera; this.scene = scene;
    this.owned = ['knife']; this.cur = 0;
    this.ammo = { ammo_pistol: 0, ammo_shotgun: 0, ammo_rifle: 0 };
    this.mag = {};
    this.cd = 0; this.reloadT = 0; this.kick = 0; this.swing = 0; this.pendingHit = 0; this.zoom = false;
    this.vm = new THREE.Group(); this.vm.position.set(0.2, -0.2, -0.4); this.vm.scale.setScalar(0.65); camera.add(this.vm);
    this.models = {};
    this.flash = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flash.rotation.x = -Math.PI / 2; this.flash.visible = false;
    this.tracers = [];
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, opacity: 0.9 });
    this.select(0);
  },
  get id() { return this.owned[this.cur]; },
  get w() { return WEAPONS[this.id]; },
  model(id) {
    if (!this.models[id]) { const m = Items.weaponMesh(id); Hands.attachToWeapon(m, id); m.rotation.order = 'YXZ'; m.traverse(o => { o.castShadow = false; }); this.models[id] = m; }
    return this.models[id];
  },
  select(i) {
    if (i < 0 || i >= this.owned.length) return;
    this.cur = i; this.reloadT = 0; this.zoom = false;
    while (this.vm.children.length) this.vm.remove(this.vm.children[0]);
    const m = this.model(this.id); this.vm.add(m);
    m.add(this.flash); this.flash.position.copy(m.userData.muzzle);
    this.swing = 0; this.draw = 1; this.atkT = -1; // vytažení zbraně
    Sfx.click();
  },
  cycle(d) { if (this.owned.length > 1) this.select((this.cur + d + this.owned.length) % this.owned.length); },
  add(id) {
    const w = WEAPONS[id];
    if (this.owned.includes(id)) {
      if (w.ammo) { const n = Math.ceil(w.mag / 2) + 4; this.ammo[w.ammo] += n; return `Už máš ${w.name} – vzal sis ${n} nábojů`; }
      return `${w.name} už máš`;
    }
    this.owned.push(id);
    if (w.ammo) this.mag[id] = Math.ceil(w.mag / 2);
    this.select(this.owned.length - 1);
    return `Nová zbraň: ${w.name}${w.ammo ? ` (${this.mag[id]} v zásobníku)` : ''} – přepínání 1–${this.owned.length} nebo kolečkem`;
  },
  reload() {
    const w = this.w, id = this.id;
    if (!w.ammo || this.reloadT > 0 || (this.mag[id] || 0) >= w.mag) return;
    if (this.ammo[w.ammo] <= 0) { Game.msg(`Došly ti ${AMMO[w.ammo].name.toLowerCase()}`, 'warn'); return; }
    this.reloadT = w.reload; this.zoom = false; Sfx.ratchet();
  },
  // origin/dir ve světových souřadnicích
  tryFire(origin, dir, inCar) {
    const w = this.w, id = this.id;
    if (this.cd > 0 || this.reloadT > 0) return;
    if (w.melee) {
      if (inCar) return;
      const A = MELEE_ANIM[id];
      this.cd = w.rate; this.atkT = 0; this.pendingHit = A ? A.hit : 0.1; this.draw = 0;
      setTimeout(() => Sfx.swish(), A ? Math.max(0, A.hit - 0.08) * 1000 : 0);   // svist až při švihu, ne při nápřahu
      this._mo = origin.clone(); this._md = dir.clone();
      return;
    }
    if ((this.mag[id] || 0) <= 0) { this.cd = 0.25; Sfx.click(); this.reload(); return; }
    this.mag[id]--; this.cd = w.rate; this.kick = 1;
    this.flash.visible = true; this._ft = 0.05;
    Sfx.shot(id);
    const from = inCar ? origin.clone().addScaledVector(dir, 0.8) : this.muzzleWorld();
    const pellets = w.pellets || 1, sp = this.zoom ? w.spread * 0.3 : w.spread;
    const v = new THREE.Vector3();
    for (let i = 0; i < pellets; i++) {
      v.copy(dir).add(new THREE.Vector3((Math.random() - 0.5) * 2 * sp, (Math.random() - 0.5) * 2 * sp, (Math.random() - 0.5) * 2 * sp)).normalize();
      const hit = Hazards.shootRay(origin, v, w.range, w.dmg);
      const end = hit ? hit.point : origin.clone().addScaledVector(v, Math.min(w.range, 150));
      this.tracer(from, end);
    }
    // zpětný ráz
    const rec = id === 'sniper' ? 0.05 : id === 'shotgun' ? 0.04 : id === 'smg' ? 0.008 : 0.015;
    if (inCar) Player.lookPitch = Math.min(1.5, Player.lookPitch + rec); else Player.pitch = Math.min(1.5, Player.pitch + rec);
    if (this.mag[id] <= 0) this.reload();
  },
  muzzleWorld() { const m = this.model(this.id); return m.localToWorld(m.userData.muzzle.clone()); },
  tracer(a, b) {
    const g = new THREE.BufferGeometry().setFromPoints([a, b]);
    const l = new THREE.Line(g, this.tracerMat.clone()); l.frustumCulled = false;
    this.scene.add(l); this.tracers.push({ l, t: 0.07 });
  },

  update(dt, o) {
    const w = this.w, id = this.id;
    this.cd = Math.max(0, this.cd - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const need = w.mag - (this.mag[id] || 0), take = Math.min(need, this.ammo[w.ammo]);
        this.mag[id] = (this.mag[id] || 0) + take; this.ammo[w.ammo] -= take; Sfx.ratchet();
      }
    }
    if (this.pendingHit > 0) {
      if (o.origin && o.dir) { this._mo = o.origin.clone(); this._md = o.dir.clone(); }   // zásah tam, kam míříš v okamžiku švihu
      this.pendingHit -= dt;
      if (this.pendingHit <= 0) {
        const dmg = w.dmg * (Perks.has('rvac') ? 2 : 1);
        if (Hazards.meleeHit(this._mo, this._md, w.range, dmg, w.knock || 2.5)) Sfx.punch();
      }
    }
    if (o.firing && (w.auto || o.click)) this.tryFire(o.origin, o.dir, o.inCar);
    // puškohled jen u odstřelovačky
    this.zoom = !!(o.aim && w.scope && this.reloadT <= 0);
    const fov = this.zoom ? 18 : Settings.s.fov;
    if (Math.abs(this.cam.fov - fov) > 0.1) { this.cam.fov = U.lerp(this.cam.fov, fov, Math.min(1, dt * 14)); this.cam.updateProjectionMatrix(); }
    // animace modelu
    this.vm.visible = o.show && !this.zoom;
    this.kick = Math.max(0, this.kick - dt * 8); this.swing = Math.max(0, this.swing - dt * 3.2);
    const m = this.vm.children[0];
    if (m) {
      const rl = this.reloadT > 0 ? Math.sin(Math.min(1, this.reloadT / w.reload) * Math.PI) : 0;
      this.draw = Math.max(0, (this.draw || 0) - dt * 3.5);
      const dr = this.draw * this.draw;   // vytažení: zbraň vyjede zespodu
      const A = w.melee && MELEE_ANIM[id];
      if (A) {
        if (this.atkT >= 0) { this.atkT += dt; if (this.atkT > A.keys[A.keys.length - 1][0]) this.atkT = -1; }
        const [ps, rt] = meleePose(A, Math.max(0, this.atkT));
        m.position.set(ps[0], ps[1] - dr * 0.4, ps[2]);
        m.rotation.set(rt[0] - dr * 0.9, rt[1], rt[2]);
      } else {
        m.rotation.set(this.kick * 0.25 + rl * 0.6 - dr * 0.9, 0, rl * 0.4);
        m.position.set(0, -rl * 0.12 - dr * 0.4, this.kick * 0.06);
      }
    }
    if (this._ft !== undefined) { this._ft -= dt; if (this._ft <= 0) this.flash.visible = false; }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i]; t.t -= dt; t.l.material.opacity = Math.max(0, t.t / 0.07);
      if (t.t <= 0) { this.scene.remove(t.l); t.l.geometry.dispose(); this.tracers.splice(i, 1); }
    }
  },
  hud() {
    const w = this.w;
    const list = this.owned.map((id, i) => `<span style="${i === this.cur ? 'color:#ffb347;font-weight:800' : 'opacity:.6'}">${i + 1} ${WEAPONS[id].name}</span>`).join(' · ');
    const ammo = w.ammo ? `<div class="big">${this.mag[this.id] || 0} <span style="font-size:16px;opacity:.75">/ ${this.ammo[w.ammo]}</span></div>${this.reloadT > 0 ? 'nabíjím…' : AMMO[w.ammo].name}` : `<div class="big">${w.name}</div>chladná zbraň`;
    return `${ammo}<div style="margin-top:4px;font-size:12px">${list}</div>${w.scope ? '<div style="font-size:12px;opacity:.75">pravé tlačítko = puškohled</div>' : ''}`;
  },
};
