// weather.js – další typy počasí: déšť, bouřka s blesky, tornádo a zemětřesení (k písečné bouři z hazards.js)
const WEATHER_W = {   // váhy podle biomu
  'Poušť': { rain: 0.4, thunder: 0.6, tornado: 1.0, quake: 0.6 },
  'Kaňon': { rain: 0.8, thunder: 0.8, tornado: 0.3, quake: 1.5 },
  'Solná pláň': { rain: 0.3, thunder: 0.6, tornado: 1.5, quake: 0.5 },
  'Step': { rain: 1.5, thunder: 1.2, tornado: 1.0, quake: 0.5 },
};
const WEATHER_NAME = { rain: 'Déšť', thunder: 'Bouřka', tornado: 'Tornádo', quake: 'Zemětřesení' };
const Weather = {
  init(scene) {
    if (this.scene) { for (const o of [this.drops, this.boltLight, this.tornado && this.tornado.g, ...(this.bolts || []).map(b => b.m)]) if (o) this.scene.remove(o); }
    this.scene = scene;
    this.kind = null; this.t = 0; this.dur = 0; this.s = 0; this.cd = 55 + Math.random() * 40;
    this.rain = 0; this.quakeS = 0; this.flashT = 0; this.nextBolt = 3; this.bolts = [];
    // déšť: krátké čárky padající kolem kamery
    const n = 2200, pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 60, y = Math.random() * 30 - 8, z = (Math.random() - 0.5) * 60; pos.set([x, y, z, x, y - 0.7, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.drops = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c8d8, transparent: true, opacity: 0, depthWrite: false }));
    this.drops.frustumCulled = false; this.drops.visible = false; scene.add(this.drops);
    this.boltLight = new THREE.PointLight(0xdfe8ff, 0, 400, 1.2); scene.add(this.boltLight);
    this.tornado = null;
    this._c = new THREE.Color();
  },
  start(kind, eye) {
    this.kind = kind; this.t = 0;
    this.dur = { rain: 55 + Math.random() * 40, thunder: 50 + Math.random() * 35, tornado: 75, quake: 9 + Math.random() * 7 }[kind];
    const m = { rain: ['Začíná pršet – silnice klouže!', 'warn'], thunder: ['Blíží se bouřka! Blesky a liják', 'warn'], tornado: ['TORNÁDO! Drž se od něj dál!', 'bad'], quake: ['ZEMĚTŘESENÍ!', 'bad'] }[kind];
    Game.msg(m[0], m[1]); Game.bigText(WEATHER_NAME[kind].toUpperCase());
    if (kind === 'tornado') this.spawnTornado(eye);
    if (kind === 'quake') Sfx.burst(2.5, 120, 0.6, 'lowpass', true);
  },
  end() {
    const k = this.kind; this.kind = null;
    Game.msg({ rain: 'Přestalo pršet', thunder: 'Bouřka přešla', tornado: 'Tornádo se rozpadlo', quake: 'Země se uklidnila' }[k], 'good');
    if (this.tornado) { this.scene.remove(this.tornado.g); this.tornado = null; }
  },
  // ---------- tornádo ----------
  spawnTornado(eye) {
    const r = World.nearestRoad(eye.x, eye.z, 3), p = r ? World.pts[Math.min(World.pts.length - 1, r.i + 45)] : { x: eye.x, z: eye.z - 180, t: 0 };
    const side = Math.random() < 0.5 ? 1 : -1, nx = Math.cos(p.t), nz = Math.sin(p.t);
    const g = new THREE.Group(); this.scene.add(g);
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; const c = cv.getContext('2d');
    c.fillStyle = 'rgba(120,100,80,0.0)'; c.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(${90 + Math.random() * 60},${75 + Math.random() * 50},${60 + Math.random() * 40},${0.25 + Math.random() * 0.5})`; c.fillRect(Math.random() * 128, Math.random() * 256, 2 + Math.random() * 10, 20 + Math.random() * 90); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const layers = [];
    for (const [rt, rb, h, op, rep] of [[26, 2.5, 95, 0.75, 3], [20, 1.6, 90, 0.55, 2]]) {
      const geo = new THREE.CylinderGeometry(rt, rb, h, 28, 6, true);
      const pa = geo.attributes.position;   // trochu prohnutý trychtýř
      for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / h + 0.5; pa.setX(i, pa.getX(i) + Math.sin(y * 3) * 3 * y); }
      const t2 = tex.clone(); t2.needsUpdate = true; t2.repeat.set(rep, 1);
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: t2, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false, color: 0x9a8a78 }));
      m.position.y = h / 2; g.add(m); layers.push(m);
    }
    // prach a trosky kolem paty
    const n = 500, pos = new Float32Array(n * 3), ang = new Float32Array(n), rad = new Float32Array(n), ht = new Float32Array(n);
    for (let i = 0; i < n; i++) { ang[i] = Math.random() * 6.28; rad[i] = 2 + Math.random() * 14; ht[i] = Math.random() * 25; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0x7a6650, size: 0.6, transparent: true, opacity: 0.8, depthWrite: false })); pts.frustumCulled = false; g.add(pts);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(18, 24, 8, 24, 1, true), new THREE.MeshLambertMaterial({ color: 0xb09a78, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    ring.position.y = 4; g.add(ring);
    this.tornado = { g, layers, pts, ang, rad, ht, ring, x: p.x + nx * side * 70, z: p.z + nz * side * 70, vx: -nx * side * 2.6, vz: -nz * side * 2.6 - 0.6, rot: 0, hitCd: 0 };
    g.position.set(this.tornado.x, World.groundAt(this.tornado.x, this.tornado.z), this.tornado.z);
  },
  updateTornado(dt, ctx) {
    const T = this.tornado; if (!T) return;
    const grow = U.smooth(0, 6, this.t) * (1 - U.smooth(this.dur - 8, this.dur, this.t));
    T.x += T.vx * dt + Math.sin(this.t * 0.4) * 3 * dt; T.z += T.vz * dt;
    T.rot += dt * 2.2;
    T.g.position.set(T.x, World.groundAt(T.x, T.z), T.z); T.g.scale.set(grow, Math.max(0.05, grow), grow);
    T.layers.forEach((m, i) => { m.material.map.offset.x = T.rot * (i ? 0.7 : 0.45); m.rotation.y = T.rot * (i ? -0.3 : 0.2); });
    const pa = T.pts.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) { T.ang[i] += dt * (6 - T.rad[i] * 0.25); T.ht[i] = (T.ht[i] + dt * 4) % 28; const r = T.rad[i] + T.ht[i] * 0.5; pa.setXYZ(i, Math.cos(T.ang[i]) * r, T.ht[i], Math.sin(T.ang[i]) * r); }
    pa.needsUpdate = true;
    // síla: tah ke středu a do kruhu; uvnitř vyhodí auto i hráče
    const { player, car, inCar } = ctx, px = inCar ? car.x : player.x, pz = inCar ? car.z : player.z;
    const dx = T.x - px, dz = T.z - pz, d = Math.hypot(dx, dz) || 1, R = 45 * grow;
    T.hitCd -= dt;
    this.tornadoD = d;
    if (d < R) {
      const k = (1 - d / R) * grow, ux = dx / d, uz = dz / d;
      if (inCar || !car.exploded && Math.hypot(car.x - T.x, car.z - T.z) < R) {
        const cd = Math.hypot(car.x - T.x, car.z - T.z) || 1, cu = (1 - cd / R) * grow;
        if (cu > 0) { const cx = (T.x - car.x) / cd, cz = (T.z - car.z) / cd; car.vx += (cx * 7 - cz * 9) * cu * dt; car.vz += (cz * 7 + cx * 9) * cu * dt; car.w += cu * 1.5 * dt; car.shake = Math.max(car.shake, cu * 0.8); }
        if (cd < 9 * grow && T.hitCd <= 0) { T.hitCd = 2.5; car.vx += -cz * 14; car.vz += cx * 14; car.body = Math.max(0, car.body - 18); if (inCar) { Game.flash(0.35); Sfx.crash(0.6); Game.msg('Tornádo s tebou smýklo! Karoserie ' + Math.round(car.body) + ' %', 'bad'); } }
      }
      if (!inCar && player.alive) {
        player.x += (ux * 4 - uz * 5) * k * dt; player.z += (uz * 4 + ux * 5) * k * dt;
        if (d < 8 * grow && T.hitCd <= 0) { T.hitCd = 1.5; player.damage(25, 'Odneslo tě tornádo'); player.vy = 7; Game.flash(0.3); }
      }
    }
  },
  // ---------- blesk ----------
  bolt(eye) {
    const a = Math.random() * 6.28, d = 40 + Math.random() * 180, x = eye.x + Math.cos(a) * d, z = eye.z + Math.sin(a) * d, gy = World.groundAt(x, z);
    const pts = []; let px = x, pz = z;
    for (let i = 0; i <= 14; i++) { const y = gy + 90 - i * 90 / 14; pts.push(new THREE.Vector3(px, y, pz)); px += (Math.random() - 0.5) * 7; pz += (Math.random() - 0.5) * 7; }
    pts[pts.length - 1].set(x, gy, z);
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 40, 0.35, 4, false), new THREE.MeshBasicMaterial({ color: 0xf4f8ff }));
    this.scene.add(m); this.bolts.push({ m, t: 0.22 });
    this.boltLight.position.set(x, gy + 40, z); this.boltLight.intensity = 6; this.flashT = 0.25;
    const f = $('flash'); f.style.background = '#e8f0ff'; Game.flash(0.35); setTimeout(() => { f.style.background = '#ff1a00'; }, 400);
    setTimeout(() => this.thunder(d), Math.min(3500, d / 343 * 1000));
  },
  thunder(d) {
    if (!Sfx.ctx) return;
    const v = U.clamp(1.3 - d / 250, 0.25, 1);
    Sfx.burst(0.25, 3000, 0.4 * v, 'lowpass', true);
    Sfx.burst(2.8, 220, 0.85 * v, 'lowpass', true, 60);
    setTimeout(() => Sfx.burst(2.2, 160, 0.6 * v, 'lowpass', true, 50), 300);
  },
  // ---------- zvuky (smyčky) ----------
  loops() {
    if (this._snd || !Sfx.ctx) return this._snd;
    const c = Sfx.ctx, mk = (type, f, q) => { const s = c.createBufferSource(); s.buffer = Sfx.noiseBuf; s.loop = true; s.start(); const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(Sfx.master); return g; };
    this._snd = { rain: mk('highpass', 1800, 0.5), rainLow: mk('bandpass', 600, 0.6), tornado: mk('lowpass', 260, 1.2), quake: mk('lowpass', 70, 1.5) };
    return this._snd;
  },

  update(dt, ctx) {
    this._quiet = false;
    const { eye, km } = ctx, bio = World.biome(eye.z);
    // plánování: jen když zrovna neřádí písečná bouře
    if (!this.kind) {
      this.cd -= dt;
      if (this.cd <= 0) {
        this.cd = 80 + Math.random() * 110;
        if (km > 0.4 && !Hazards.storm.active) { const w = WEATHER_W[bio.name] || WEATHER_W['Poušť']; this.start(U.pickWeighted(Math.random(), Object.entries(w)), eye); }
      }
    } else { this.t += dt; if (this.t > this.dur) this.end(); }
    const k = this.kind, ramp = k ? U.smooth(0, 7, this.t) * (1 - U.smooth(this.dur - 7, this.dur, this.t)) : 0;
    const rainT = k === 'rain' ? ramp * 0.75 : k === 'thunder' ? ramp : 0;
    this.rain += (rainT - this.rain) * Math.min(1, dt * 0.7);
    this.quakeS = k === 'quake' ? U.smooth(0, 1.5, this.t) * (1 - U.smooth(this.dur - 2.5, this.dur, this.t)) : 0;
    const dark = Math.max(this.rain, k === 'tornado' ? ramp * 0.8 : 0);
    // obloha a mlha (navazuje na hazards.js)
    const L = Hazards.L, sc = L.scene;
    if (dark > 0.01) {
      this._c.setHex(k === 'tornado' ? 0x6a6458 : 0x5a6270).multiplyScalar(0.35 + 0.65 * (Hazards.df || 1));
      sc.background.lerp(this._c, dark * 0.85); sc.fog.color.copy(sc.background);
      sc.fog.near = U.lerp(sc.fog.near, 12, dark * 0.8); sc.fog.far = U.lerp(sc.fog.far, 190, dark * 0.75);
      L.sun.intensity *= 1 - dark * 0.65; L.hemi.intensity *= 1 - dark * 0.3;
    }
    // déšť
    this.drops.visible = this.rain > 0.01;
    if (this.drops.visible) {
      this.drops.material.opacity = this.rain * 0.55;
      const pa = this.drops.geometry.attributes.position, wx = Hazards.env.windX * 0.6;
      for (let i = 0; i < pa.count; i += 2) {
        let x = pa.getX(i) + wx * dt, y = pa.getY(i) - 26 * dt, z = pa.getZ(i);
        if (y < -8) { y += 30; x = (Math.random() - 0.5) * 60; z = (Math.random() - 0.5) * 60; }
        pa.setXYZ(i, x, y, z); pa.setXYZ(i + 1, x - wx * 0.03, y - 0.75, z);
      }
      pa.needsUpdate = true; this.drops.position.copy(eye);
    }
    // blesky
    if (k === 'thunder' && ramp > 0.3) { this.nextBolt -= dt; if (this.nextBolt <= 0) { this.nextBolt = 2.5 + Math.random() * 7; this.bolt(eye); } }
    this.flashT = Math.max(0, this.flashT - dt);
    this.boltLight.intensity = this.flashT > 0 ? 6 * this.flashT / 0.25 : 0;
    if (this.flashT > 0) { L.hemi.intensity += this.flashT * 4; }
    for (const b of this.bolts) { b.t -= dt; b.m.visible = b.t > 0 && (b.t > 0.15 || Math.random() < 0.6); if (b.t <= 0) { this.scene.remove(b.m); b.m.geometry.dispose(); } }
    this.bolts = this.bolts.filter(b => b.t > 0);
    // tornádo
    if (k === 'tornado') this.updateTornado(dt, ctx);
    // zemětřesení: třese kamerou i autem
    if (this.quakeS > 0.01) {
      const q = this.quakeS, cam = Game.camera;
      cam.position.x += (Math.random() - 0.5) * 0.16 * q; cam.position.y += (Math.random() - 0.5) * 0.12 * q;
      cam.rotation.z += (Math.random() - 0.5) * 0.03 * q;
      const car = ctx.car;
      if (!car.exploded) { car.shake = Math.max(car.shake, q * 0.7); if (Math.random() < dt * 3) { car.vx += (Math.random() - 0.5) * 2.5 * q; car.vz += (Math.random() - 0.5) * 2.5 * q; } }
      if (!ctx.inCar && ctx.player.alive && Math.random() < dt * 1.5 * q) { ctx.player.x += (Math.random() - 0.5) * 0.4; ctx.player.z += (Math.random() - 0.5) * 0.4; }
      if (Math.random() < dt * 2 * q) Sfx.burst(0.3, 400, 0.15 * q, 'lowpass');
    }
    // vliv na auto: mokrá silnice klouže, déšť chladí motor
    const env = Hazards.env;
    env.gripMul = 1 - 0.28 * this.rain;
    env.ambient -= 12 * this.rain;
    // zvuk
    const S = this.loops();
    if (S) {
      const t = Sfx.ctx.currentTime, inCar = ctx.inCar;
      S.rain.gain.setTargetAtTime(this.rain * (inCar ? 0.06 : 0.12), t, 0.3);
      S.rainLow.gain.setTargetAtTime(this.rain * (inCar ? 0.14 : 0.07), t, 0.3);
      const td = this.tornado ? this.tornadoD || 999 : 999;
      S.tornado.gain.setTargetAtTime(k === 'tornado' ? ramp * U.clamp(1.4 - td / 160, 0, 1.2) * 0.9 : 0, t, 0.4);
      S.quake.gain.setTargetAtTime(this.quakeS * 1.6, t, 0.2);
    }
  },
  silence() {
    if (this._snd && !this._quiet) { for (const g of Object.values(this._snd)) g.gain.value = 0; }
    this._quiet = true; if (this.drops) this.drops.visible = false;
  },
  force(kind) { if (this.kind) this.end(); this.start(kind, Game._eye); },
  status() { return this.kind ? WEATHER_NAME[this.kind] : null; },
};
