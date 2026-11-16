// ambient.js – mraky, kroužící supi a koulející se chuchvalce (tumbleweed)
const Ambient = {
  init(scene) {
    this.scene = scene; this.t = 0;
    this.windA = 0.7; // směr větru
    // mraky – slité low-poly kuličky, nezahalené mlhou
    this.cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.93 });
    this.clouds = [];
    const ico = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 18; i++) {
      const m = new U.Merger(), n = 4 + Math.floor(Math.random() * 5);
      for (let k = 0; k < n; k++) {
        const s = 14 + Math.random() * 16;
        m.add(ico, U.compose((k - n / 2) * 16 + Math.random() * 8, Math.random() * 6, Math.random() * 18 - 9, 0, Math.random() * 3, 0, s, s * 0.55, s * 0.8), new THREE.Color(0xffffff).multiplyScalar(0.88 + Math.random() * 0.12));
      }
      const mesh = m.build(this.cloudMat); mesh.castShadow = false; mesh.receiveShadow = false;
      mesh.position.set((Math.random() - 0.5) * 1600, 190 + Math.random() * 90, (Math.random() - 0.5) * 1600);
      scene.add(mesh); this.clouds.push(mesh);
    }
    // supi
    this.birds = [];
    const dark = U.mat(0x2a2420);
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 1.0), dark); g.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.25), U.mat(0xa04a3a)); head.position.set(0, 0.1, 0.6); g.add(head);
      const wings = [];
      for (const sd of [-1, 1]) {
        const p = new THREE.Group(); p.position.x = sd * 0.15; g.add(p);
        const w = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.6), dark); w.position.x = sd * 0.8; p.add(w);
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.4), dark); tip.position.x = sd * 1.9; tip.rotation.z = sd * 0.25; p.add(tip);
        wings.push(p);
      }
      g.userData = { wings, a: Math.random() * 6.28, r: 25 + Math.random() * 25, h: 55 + Math.random() * 35, sp: 0.15 + Math.random() * 0.1, ph: Math.random() * 6 };
      scene.add(g); this.birds.push(g);
    }
    this.birdC = new THREE.Vector3();
    // chuchvalce suché trávy
    this.tumble = [];
    const tg = new THREE.IcosahedronGeometry(0.45, 1), tm = new THREE.MeshBasicMaterial({ color: 0x8a6a40, wireframe: true });
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(tg, tm));
      const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), tm); inner.rotation.set(1, 2, 3); g.add(inner);
      g.userData = { x: 0, z: 0, v: 0, ph: Math.random() * 6, init: false };
      scene.add(g); this.tumble.push(g);
    }
  },
  update(dt, eye, env, biomeName, df) {
    this.t += dt;
    const wx = Math.cos(this.windA), wz = Math.sin(this.windA), ws = 3 + env.storm * 12;
    // mraky
    this.cloudMat.color.setScalar(0.3 + 0.7 * df);
    for (const c of this.clouds) {
      c.position.x += wx * ws * 0.6 * dt; c.position.z += wz * ws * 0.6 * dt;
      const dx = c.position.x - eye.x, dz = c.position.z - eye.z;
      if (dx > 800) c.position.x -= 1600; if (dx < -800) c.position.x += 1600;
      if (dz > 800) c.position.z -= 1600; if (dz < -800) c.position.z += 1600;
    }
    // supi krouží nad místem, kde hráč je
    this.birdC.lerp(eye, Math.min(1, dt * 0.05));
    if (this.birdC.lengthSq() === 0) this.birdC.copy(eye);
    for (const b of this.birds) {
      const u = b.userData; u.a += u.sp * dt;
      b.position.set(this.birdC.x + Math.cos(u.a) * u.r, World.L(this.birdC.x, this.birdC.z) + u.h, this.birdC.z + Math.sin(u.a) * u.r);
      b.rotation.set(0, -u.a, 0.35);
      const flap = Math.sin(this.t * 2 + u.ph); const f = flap > 0.7 ? (flap - 0.7) * 1.5 : 0;
      u.wings[0].rotation.z = f; u.wings[1].rotation.z = -f;
      b.visible = df > 0.25;
    }
    // chuchvalce jen v poušti a stepi
    const active = biomeName === 'Poušť' || biomeName === 'Step';
    for (const g of this.tumble) {
      const u = g.userData;
      g.visible = active;
      if (!active) { u.init = false; continue; }
      const dx = u.x - eye.x, dz = u.z - eye.z;
      if (!u.init || dx * dx + dz * dz > 95 * 95) {
        const a = this.windA + Math.PI + (Math.random() - 0.5) * 1.6, d = 40 + Math.random() * 45;
        u.x = eye.x + Math.cos(a) * d; u.z = eye.z + Math.sin(a) * d; u.v = 2 + Math.random() * 3; u.init = true;
      }
      const sp = (u.v + ws * 0.5) * dt;
      u.x += wx * sp; u.z += wz * sp;
      const gy = World.height(u.x, u.z);
      g.position.set(u.x, gy + 0.45 + Math.abs(Math.sin(this.t * 2.5 + u.ph)) * 0.5, u.z);
      g.rotation.x += sp / 0.45 * wz; g.rotation.z -= sp / 0.45 * wx;
    }
  },
};
