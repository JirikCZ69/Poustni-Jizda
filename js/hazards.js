// hazards.js – den/noc, písečné bouře, kojoti a bandité
const Hazards = {
  init(scene, lights) {
    this.scene = scene; this.L = lights;
    this.dayT = 0.32; this.dayLen = 480;
    this.storm = { active: false, t: 0, dur: 0, s: 0, wx: 1, wz: 0 }; this.stormCd = 100 + Math.random() * 100;
    this.coyotes = []; this.bandits = []; this.banditCd = 90;
    this.wasNight = false;
    this._sky = new THREE.Color(); this._tmp = new THREE.Color();
    // částice bouře
    const n = 1800, pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) pos[i] = (Math.random() - 0.5) * 60;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xc9a066, size: 0.22, transparent: true, opacity: 0, depthWrite: false }));
    this.dust.frustumCulled = false; scene.add(this.dust);
    this.env = { ambient: 35, heatMul: 1, offroadMu: 0.75, windX: 0, windZ: 0, powerMul: 1, storm: 0 };
  },
  isNight() { return Math.sin((this.dayT - 0.25) * Math.PI * 2) < -0.05; },
  clock() { const h = (this.dayT * 24) % 24; return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; },

  update(dt, ctx) {
    const { player, car, inCar, km, eye } = ctx;
    const bio = World.biome(eye.z);
    // --- den a noc ---
    this.dayT = (this.dayT + dt / this.dayLen) % 1;
    const e = Math.sin((this.dayT - 0.25) * Math.PI * 2), df = U.smooth(-0.12, 0.3, e);
    const night = this.isNight();
    this.df = df;
    if (night && !this.wasNight) Game.msg('Stmívá se – zapni světla (L)', 'warn');
    this.wasNight = night;
    World.skyColor(eye.z, this._sky);
    const sunset = U.smooth(0.35, 0, Math.abs(e)) * df;
    this._sky.lerp(this._tmp.setHex(0xf08a4a), sunset * 0.55);
    this._sky.lerp(this._tmp.setHex(0x0a0f1e), 1 - df);
    // --- bouře ---
    const st = this.storm;
    if (!st.active) {
      this.stormCd -= dt;
      if (this.stormCd <= 0) {
        this.stormCd = 120 + Math.random() * 160;
        if (km > 0.6 && Math.random() < bio.storm) {
          st.active = true; st.t = 0; st.dur = 40 + Math.random() * 40;
          const a = Math.random() * Math.PI * 2; st.wx = Math.cos(a); st.wz = Math.sin(a);
          Game.msg('Blíží se písečná bouře!', 'warn');
        }
      }
    } else {
      st.t += dt;
      if (st.t > st.dur) { st.active = false; Game.msg('Bouře ustala', 'good'); }
    }
    const target = st.active ? U.smooth(0, 6, st.t) * (1 - U.smooth(st.dur - 6, st.dur, st.t)) : 0;
    st.s += (target - st.s) * Math.min(1, dt * 0.8);
    if (st.s > 0.01) this._sky.lerp(this._tmp.setHex(0xb88a52).multiplyScalar(0.3 + 0.7 * df), st.s * 0.85);
    this.L.scene.background.copy(this._sky);
    this.L.scene.fog.color.copy(this._sky);
    this.L.scene.fog.near = U.lerp(U.lerp(30, 70, df), 2, st.s);
    this.L.scene.fog.far = U.lerp(U.lerp(200, 430, df) * Math.min(1, (World.viewR || 6) / 6), 40, st.s);
    // světla
    // směr slunce se mění po malých skocích (ne každý snímek) – jinak se stínová mapa pořád přepočítává a na plechu „plave“ zubatý stín
    const sun = this.L.sun, ang = Math.round((this.dayT - 0.25) * 720) / 720 * Math.PI * 2;
    const sd = new THREE.Vector3(Math.cos(ang) * 0.6, Math.max(0.15, Math.abs(Math.sin(ang))), 0.45).normalize();
    // stínová kamera se posouvá po celých texelech stínové mapy – stíny se při pohybu netřepí ani "nepřeskakují"
    const sr = this._sr || (this._sr = new THREE.Vector3()), su = this._su || (this._su = new THREE.Vector3()), scam = sun.shadow.camera, tx = (scam.right - scam.left) / sun.shadow.mapSize.x;
    sr.set(0, 1, 0).cross(sd).normalize(); su.copy(sd).cross(sr);
    const a = Math.round(eye.dot(sr) / tx) * tx, b = Math.round(eye.dot(su) / tx) * tx, c = eye.dot(sd);
    sun.target.position.set(sr.x * a + su.x * b + sd.x * c, sr.y * a + su.y * b + sd.y * c, sr.z * a + su.z * b + sd.z * c);
    sun.position.copy(sun.target.position).addScaledVector(sd, 120);
    sun.intensity = (0.12 + 1.05 * df) * (1 - st.s * 0.6);
    sun.color.setHex(df > 0.2 ? 0xfff1d8 : 0x8fa6d8).lerp(this._tmp.setHex(0xffa060), sunset * 0.6);
    this.L.hemi.intensity = (0.22 + 0.5 * df);
    this.L.hemi.color.copy(this._sky).lerp(this._tmp.setHex(0xffffff), 0.4);
    // částice
    const pa = this.dust.geometry.attributes.position;
    this.dust.material.opacity = st.s * 0.75;
    if (st.s > 0.01) {
      for (let i = 0; i < pa.count; i++) {
        let x = pa.getX(i) + st.wx * 22 * dt, y = pa.getY(i) - 1.5 * dt, z = pa.getZ(i) + st.wz * 22 * dt;
        if (x > 30) x -= 60; if (x < -30) x += 60; if (z > 30) z -= 60; if (z < -30) z += 60; if (y < -10) y += 20;
        pa.setXYZ(i, x, y, z);
      }
      pa.needsUpdate = true;
    }
    this.dust.position.copy(eye);
    Sfx.wind(st.s);
    // prostředí pro auto
    const env = this.env;
    env.ambient = bio.ambient - (1 - df) * 22;
    env.heatMul = bio.heat * (1 + 0.35 * st.s) * (0.85 + 0.15 * df);
    env.offroadMu = { 'Poušť': 0.68, 'Kaňon': 0.8, 'Solná pláň': 0.9, 'Step': 0.8 }[bio.name];
    env.windX = st.wx * st.s * 2.2; env.windZ = st.wz * st.s * 2.2;
    env.powerMul = 1 - st.s * 0.1;
    env.storm = st.s;

    this.updateCoyotes(dt, player, car, inCar, km, night);
    this.updateBandits(dt, player, car, inCar, km, night);
  },

  // ---------------- kojoti ----------------
  makeCoyote() {
    const g = new THREE.Group(), fur = U.mat(0x8a7458), dark = U.mat(0x5a4a38);
    const b = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    b(0.34, 0.34, 0.95, 0, 0.62, 0, fur);
    b(0.26, 0.26, 0.32, 0, 0.82, 0.55, fur);
    b(0.13, 0.12, 0.2, 0, 0.76, 0.78, dark);
    b(0.07, 0.14, 0.05, 0.08, 1.0, 0.5, dark); b(0.07, 0.14, 0.05, -0.08, 1.0, 0.5, dark);
    const tail = b(0.1, 0.1, 0.45, 0, 0.66, -0.62, dark); tail.rotation.x = 0.6;
    const legs = [];
    for (const [x, z] of [[0.11, 0.33], [-0.11, 0.33], [0.11, -0.33], [-0.11, -0.33]]) {
      const pv = new THREE.Group(); pv.position.set(x, 0.48, z); g.add(pv);
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.48, 0.08), dark); l.position.y = -0.24; pv.add(l); legs.push(pv);
    }
    g.userData.legs = legs;
    return g;
  },
  updateCoyotes(dt, player, car, inCar, km, night) {
    const px = inCar ? car.x : player.x, pz = inCar ? car.z : player.z;
    const max = night ? 4 : 2, rate = (night ? 0.06 : 0.014) * (km > 0.4 ? 1 : 0);
    if (this.forceCoyotes || (this.coyotes.length < max && Math.random() < rate * dt && (!inCar || car.speed < 4) && player.alive)) {
      this.forceCoyotes = false;
      const n = 1 + Math.floor(Math.random() * (night ? 3 : 2));
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 15;
      for (let i = 0; i < n && this.coyotes.length < max + 1; i++) {
        const c = { mesh: this.makeCoyote(), x: px + Math.cos(a) * d + i * 1.5, z: pz + Math.sin(a) * d + i, yaw: 0, hp: 3, stun: 0, bite: 0, dead: 0, carT: 0, phase: Math.random() * 6 };
        this.scene.add(c.mesh); this.coyotes.push(c);
      }
      Game.msg(night ? 'Ze tmy se ozývá vytí… kojoti!' : 'Blíží se kojoti!', 'warn');
      Sfx.howl();
    }
    for (let i = this.coyotes.length - 1; i >= 0; i--) {
      const c = this.coyotes[i], m = c.mesh;
      const dx = px - c.x, dz = pz - c.z, dist = Math.hypot(dx, dz);
      if (c.dead > 0) {
        c.dead += dt; m.rotation.z = Math.min(Math.PI / 2, c.dead * 4);
        if (c.dead > 6) { this.scene.remove(m); this.coyotes.splice(i, 1); }
        continue;
      }
      if (dist > 140) { this.scene.remove(m); this.coyotes.splice(i, 1); continue; }
      let sp = 0, ty = Math.atan2(dx, dz);
      if (c.stun > 0) { c.stun -= dt; }
      else if (inCar) {
        c.carT += dt;
        if (c.carT > 25) { ty += Math.PI; sp = 7; }
        else if (dist < 7) { ty += Math.PI / 2; sp = 3.5; } else sp = 6;
      } else if (dist > 1.2) { sp = night ? 7.2 : 6.3; c.carT = 0; }
      c.yaw += U.clamp(U.wrapAngle(ty - c.yaw), -6 * dt, 6 * dt);
      c.x += Math.sin(c.yaw) * sp * dt; c.z += Math.cos(c.yaw) * sp * dt;
      World.forCols(c.x, c.z, (col) => { const r = U.circleVs(c.x, c.z, 0.4, col); if (r) { c.x += r.nx * r.depth; c.z += r.nz * r.depth; } });
      // kousnutí
      c.bite -= dt;
      if (!inCar && player.alive && dist < 1.5 && c.bite <= 0 && c.stun <= 0) { c.bite = 1.0; player.damage(9, 'Roztrhali tě kojoti'); Sfx.bite(); }
      // přejetí autem
      if (car && !car.exploded && Math.hypot(car.x - c.x, car.z - c.z) < 1.7 && car.speed > 4) {
        c.dead = 0.01; car.body = Math.max(0, car.body - 1.5); car.shake = 0.4; Sfx.bump();
      }
      c.phase += sp * dt * 2.5;
      m.userData.legs.forEach((l, k) => { l.rotation.x = Math.sin(c.phase + (k % 2 ? Math.PI : 0) + (k > 1 ? 1 : 0)) * 0.6 * Math.min(1, sp / 4); });
      m.position.set(c.x, World.groundAt(c.x, c.z), c.z); m.rotation.y = c.yaw;
    }
  },
  // úder chladnou zbraní
  meleeHit(pos, dir, range, dmg, knock) {
    let hit = false;
    const fl = Math.hypot(dir.x, dir.z) || 1;
    for (const c of this.coyotes) {
      if (c.dead) continue;
      const dx = c.x - pos.x, dz = c.z - pos.z, d = Math.hypot(dx, dz);
      if (d > range + 0.4 || (dx * dir.x + dz * dir.z) / (d * fl || 1) < 0.5) continue;
      this.hurtCoyote(c, dmg, dx / (d || 1), dz / (d || 1), knock); hit = true;
    }
    return hit;
  },
  // výstřel: najde nejbližší zasažený cíl (kojot nebo auto banditů)
  shootRay(origin, dir, range, dmg) {
    const r = this._ray || (this._ray = new THREE.Raycaster());
    r.set(origin, dir); r.far = range;
    let best = null;
    const test = (mesh, o) => { mesh.updateMatrixWorld(true); const h = r.intersectObject(mesh, true)[0]; if (h && (!best || h.distance < best.distance)) best = { distance: h.distance, point: h.point, o }; };
    for (const c of this.coyotes) if (!c.dead) test(c.mesh, c);
    for (const b of this.bandits) test(b.mesh, b);
    if (!best) return null;
    if (best.o.mesh.userData.legs) this.hurtCoyote(best.o, dmg, dir.x, dir.z, 1.2);
    else this.hurtBandit(best.o, dmg);
    return best;
  },
  hurtCoyote(c, dmg, nx, nz, knock) {
    c.hp -= dmg; c.stun = 0.6; c.x += nx * knock; c.z += nz * knock;
    if (c.hp <= 0 && !c.dead) { c.dead = 0.01; Game.msg('Kojot je mrtvý', 'good'); }
  },
  hurtBandit(b, dmg) {
    b.hp -= dmg; b.hitT = 0.12; Sfx.bump();
    if (b.hp > 0) return;
    const i = this.bandits.indexOf(b); if (i >= 0) this.bandits.splice(i, 1);
    this.scene.remove(b.mesh);
    const loot = Math.round((10 + Math.random() * 12) * (Perks.has('sberac') ? 1.5 : 1));
    Game.scrap += loot;
    const y = World.groundAt(b.x, b.z);
    Items.spawn(U.pickWeighted(Math.random(), [['ammo_pistol', 3], ['ammo_shotgun', 2], ['ammo_rifle', 2], ['canister', 1]]), b.x, y, b.z);
    Game.msg(`Bandité zneškodněni! +${loot} kg šrotu, něco po nich zůstalo na silnici`, 'good');
    Sfx.crash(0.8); Game.flash(0.15);
  },

  // ---------------- bandité ----------------
  makeBandit() {
    const g = new THREE.Group(), paint = U.mat(0x3a1a16), dark = U.mat(0x1a1a1a), metal = U.mat(0x8a8a80);
    const b = (w, h, d, x, y, z, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    b(1.9, 0.6, 4.4, 0, 0.7, 0, paint); b(1.7, 0.55, 2, 0, 1.25, -0.4, paint);
    b(2.0, 0.3, 0.3, 0, 0.55, 2.3, metal);
    for (let i = -3; i <= 3; i++) { const s = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 4), metal); s.rotation.x = Math.PI / 2; s.position.set(i * 0.28, 0.55, 2.6); g.add(s); }
    for (const [x, z] of [[0.85, 1.4], [-0.85, 1.4], [0.85, -1.4], [-0.85, -1.4]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 8), dark); w.rotation.z = Math.PI / 2; w.position.set(x, 0.38, z); g.add(w); }
    const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
    b(0.3, 0.15, 0.05, 0.6, 0.8, 2.21, hl); b(0.3, 0.15, 0.05, -0.6, 0.8, 2.21, hl);
    return g;
  },
  updateBandits(dt, player, car, inCar, km, night) {
    this.banditCd -= dt;
    if (this.banditCd <= 0 && this.bandits.length === 0) {
      this.banditCd = (70 + Math.random() * 80) / (1 + km * 0.03);
      if (km > 2 && inCar && car.speed > 8 && Math.random() < Math.min(0.95, (night ? 0.75 : 0.4) + km * 0.015)) {
        const r = World.nearestRoad(car.x, car.z, 3);
        if (r) {
          const p = World.pts[Math.max(0, r.i - 45)];
          const bd = { mesh: this.makeBandit(), x: p.x, z: p.z, yaw: Math.atan2(Math.sin(p.t), -Math.cos(p.t)), sp: car.speed, life: 0, cd: 0, hp: 12 + km * 0.3 };
          this.scene.add(bd.mesh); this.bandits.push(bd);
          Game.msg('Za tebou jsou bandité! Ujeď jim!', 'bad'); Sfx.horn();
        }
      }
    }
    for (let i = this.bandits.length - 1; i >= 0; i--) {
      const b = this.bandits[i];
      b.life += dt; b.cd -= dt;
      const tx = inCar ? car.x + car.vx * 0.6 : player.x, tz = inCar ? car.z + car.vz * 0.6 : player.z;
      const dx = tx - b.x, dz = tz - b.z, dist = Math.hypot(dx, dz);
      if (b.life > 80 || dist > 380 || !player.alive) {
        this.scene.remove(b.mesh); this.bandits.splice(i, 1);
        if (player.alive) Game.msg('Bandité to vzdali', 'good');
        continue;
      }
      const ty = Math.atan2(dx, dz);
      b.yaw += U.clamp(U.wrapAngle(ty - b.yaw), -1.5 * dt, 1.5 * dt);
      const tsp = b.cd > 0 ? Math.max(0, car.speed - 8) : dist > 40 ? 46 : (inCar ? car.speed + 7 : 14);
      b.sp += U.clamp(tsp - b.sp, -12 * dt, 7 * dt);
      b.x += Math.sin(b.yaw) * b.sp * dt; b.z += Math.cos(b.yaw) * b.sp * dt;
      // srážka s překážkou
      let wrecked = false;
      World.forCols(b.x + Math.sin(b.yaw) * 1.3, b.z + Math.cos(b.yaw) * 1.3, (c) => {
        const r = U.circleVs(b.x + Math.sin(b.yaw) * 1.3, b.z + Math.cos(b.yaw) * 1.3, 1, c);
        if (!r) return;
        b.x += r.nx * r.depth; b.z += r.nz * r.depth;
        if (b.sp > 16) wrecked = true; else b.sp *= -0.3;
      });
      if (wrecked) { this.scene.remove(b.mesh); this.bandits.splice(i, 1); Game.msg('Bandité se rozsekali o překážku!', 'good'); Sfx.crash(0.6); continue; }
      // srážka s autem hráče
      if (!car.exploded) {
        const cx = car.x - b.x, cz = car.z - b.z, cd = Math.hypot(cx, cz);
        if (cd < 2.6) {
          const nx = cx / cd, nz = cz / cd;
          const rel = (Math.sin(b.yaw) * b.sp - car.vx) * nx + (Math.cos(b.yaw) * b.sp - car.vz) * nz;
          car.x += nx * (2.6 - cd); car.z += nz * (2.6 - cd);
          if (rel > 2 && b.cd <= 0) { car.hitBy(nx, nz, rel); b.cd = 2.5; b.sp *= 0.6; Sfx.crash(Math.min(1, rel / 15)); }
        }
      }
      // přejetí hráče pěšky
      if (!inCar && player.alive && Math.hypot(player.x - b.x, player.z - b.z) < 1.8 && b.sp > 4 && b.cd <= 0) {
        player.damage(b.sp * 4, 'Přejeli tě bandité'); b.cd = 2;
      }
      b.mesh.position.set(b.x, World.height(b.x, b.z), b.z); b.mesh.rotation.y = b.yaw;
    }
  },
  clearCreatures() {
    for (const c of this.coyotes) this.scene.remove(c.mesh);
    for (const b of this.bandits) this.scene.remove(b.mesh);
    this.coyotes = []; this.bandits = []; this.banditCd = 90;
  },
};
