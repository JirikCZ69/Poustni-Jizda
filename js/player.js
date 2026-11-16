// player.js – chůze v první osobě, nošení věcí, zdraví
const Player = {
  init(camera) {
    this.cam = camera;
    this.holder = new THREE.Group(); this.holder.position.set(0.34, -0.34, -0.62);
    camera.add(this.holder);
    this.fist = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.22), U.mat(0xc68a5e));
    this.fist.position.set(0.28, -0.3, -0.45); camera.add(this.fist);
    this.fist.visible = false;
    this.heldHands = Hands.holder(this.holder);
    this.heldHands.forEach(h => { h.visible = false; });
    this.reset(0, 0, 0);
  },
  reset(x, z, yaw) {
    this.x = x; this.z = z; this.y = World.pts ? World.groundAt(x, z) : 0; this.vy = 0;
    this.yaw = yaw; this.pitch = 0; this.lookYaw = 0; this.lookPitch = 0;
    this.maxHealth = Perks.has('rvac') ? 130 : 100;
    this.health = this.maxHealth; this.alive = true; this.inCar = false; this.onGround = true;
    this.punchT = 0; this.bob = 0;
    if (this.held) this.dropHeld();
  },
  look(dx, dy) {
    const s = 0.0022 * Settings.s.sens; if (Settings.s.invertY) dy = -dy;
    if (this.inCar) {
      this.lookYaw = U.wrapAngle(this.lookYaw - dx * s);              // v autě se dá koukat úplně kamkoli
      this.lookPitch = U.clamp(this.lookPitch - dy * s, -1.5, 1.5);
    } else {
      this.yaw -= dx * s;
      this.pitch = U.clamp(this.pitch - dy * s, -1.5, 1.5);
    }
  },
  eyePos(out) { return out.set(this.x, this.y + 1.65, this.z); },
  lookDir(out) { return out.set(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')); },

  update(dt, keys, car) {
    if (!this.alive || this.inCar) return;
    const fwd = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), str = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const run = keys.ShiftLeft || keys.ShiftRight;
    const heavy = this.held && (this.held.type === 'engine' || this.held.type === 'gearbox' || this.held.type === 'tire');
    let sp = (run ? 7 : 4.3) * (heavy ? 0.6 : 1);
    const sx = -Math.sin(this.yaw), sz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let mx = sx * fwd + rx * str, mz = sz * fwd + rz * str;
    const ml = Math.hypot(mx, mz);
    if (ml > 0) { mx /= ml; mz /= ml; this.bob += dt * sp * 2.2; }
    this.x += mx * sp * dt; this.z += mz * sp * dt;
    // kolize
    for (let it = 0; it < 2; it++) {
      World.forCols(this.x, this.z, (c) => { const r = U.circleVs(this.x, this.z, 0.35, c); if (r) { this.x += r.nx * r.depth; this.z += r.nz * r.depth; } });
      if (car && !car.exploded) {
        const r = U.circleVs(this.x, this.z, 0.35, { t: 'b', x: car.x, z: car.z, hw: 0.92, hd: 2.2, ry: car.yaw });
        if (r) { this.x += r.nx * r.depth; this.z += r.nz * r.depth; }
      }
    }
    // gravitace
    const gy = World.groundAt(this.x, this.z);
    if (keys.Space && this.onGround) { this.vy = 6; this.onGround = false; }
    this.vy -= 20 * dt; this.y += this.vy * dt;
    if (this.y <= gy) { this.y = gy; this.vy = 0; this.onGround = true; }
    else if (this.y - gy > 0.05 && this.vy <= 0 && this.y - gy < 0.6 && this.onGround) this.y = gy; // schody
    else this.onGround = this.y - gy < 0.05;
    // kroky (na podlaze domu dřevo, venku písek)
    const ph = Math.floor(this.bob / Math.PI);
    if (ph !== this._ph) { this._ph = ph; if (this.onGround && ml > 0) Sfx.step(gy > World.height(this.x, this.z) + 0.05); }
    // úder
    if (this.punchT > 0) this.punchT -= dt;
    this.fist.visible = !this.held && this.punchT > 0;
    this.fist.position.z = -0.45 - Math.sin(Math.max(0, this.punchT) / 0.3 * Math.PI) * 0.3;
    // kamera
    this.cam.position.set(this.x, this.y + 1.65 + (Settings.s.bob ? Math.sin(this.bob) * 0.04 : 0), this.z);
    this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.holder.position.y = -0.34 + Math.sin(this.bob * 0.5) * 0.015;
    for (const h of this.heldHands) h.visible = !!this.held;
  },
  punch() { if (this.punchT <= 0) { this.punchT = 0.3; return true; } return false; },

  hold(it) {
    Items.take(it);
    this.held = it;
    const m = it.mesh;
    const box = new THREE.Box3().setFromObject(m), size = new THREE.Vector3(); box.getSize(size);
    const sc = 0.38 / Math.max(size.x, size.y, size.z, 0.01);
    m.position.set(0, -0.08, 0); m.rotation.set(0.2, 0.6, 0); m.scale.setScalar(Math.min(1, sc));
    this.holder.add(m);
  },
  dropHeld() {
    const it = this.held; if (!it) return;
    this.holder.remove(it.mesh);
    const dx = -Math.sin(this.yaw) * 0.9, dz = -Math.cos(this.yaw) * 0.9;
    Items.putDown(it, this.x + dx, World.groundAt(this.x + dx, this.z + dz), this.z + dz);
    this.held = null;
  },
  consumeHeld() { if (this.held) { this.holder.remove(this.held.mesh); this.held = null; } },

  damage(n, reason) {
    if (!this.alive) return;
    this.health -= n;
    Game.flash(Math.min(0.6, n / 30));
    if (this.health <= 0) { this.health = 0; Game.die(reason); }
  },
};
