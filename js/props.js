// props.js – příroda (kaktusy, juky, kytky, skály…), sloupy, překážky na silnici, vrakoviště; vše slité do jednoho meshe na chunk
const Props = (() => {
  const T = {
    cyl6: new THREE.CylinderGeometry(1, 1, 1, 6).toNonIndexed(),
    cyl8: new THREE.CylinderGeometry(1, 1, 1, 8).toNonIndexed(),
    cone5: new THREE.ConeGeometry(1, 1, 5).toNonIndexed(),
    cone3: new THREE.ConeGeometry(1, 1, 3).toNonIndexed(),
    dode: new THREE.DodecahedronGeometry(1, 0),
    ico: new THREE.IcosahedronGeometry(1, 0),
    prism: new THREE.CylinderGeometry(1, 1, 1, 3).toNonIndexed(),
  };
  const C = (h) => new THREE.Color(h);
  const vary = (hex, r, amt) => C(hex).multiplyScalar(1 - amt / 2 + r() * amt);
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  // šikmý válec od bodu v daném směru (a = azimut, th = odklon od svislice)
  const limb = (m, x, y, z, a, th, len, rad, col, g) => {
    m.add(g || T.cyl6, U.compose(x + Math.sin(th) * Math.sin(a) * len / 2, y + Math.cos(th) * len / 2, z + Math.sin(th) * Math.cos(a) * len / 2, th, a, 0, rad, len, rad), col);
    return [x + Math.sin(th) * Math.sin(a) * len, y + Math.cos(th) * len, z + Math.sin(th) * Math.cos(a) * len];
  };

  // ---- příroda ----
  const N = {
    cactus(m, cols, x, y, z, r) {
      const s = 0.7 + r() * 0.7, h = 3.2 * s, col = vary(0x4f7a3a, r, 0.25), dark = col.clone().multiplyScalar(0.8);
      m.add(T.cyl8, U.compose(x, y + h / 2, z, 0, r() * 3, 0, 0.3 * s, h, 0.3 * s), col);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.3; m.add(T.cyl6, U.compose(x + Math.cos(a) * 0.27 * s, y + h / 2, z + Math.sin(a) * 0.27 * s, 0, 0, 0, 0.05 * s, h * 0.95, 0.05 * s), dark); }
      m.add(T.cone5, U.compose(x, y + h + 0.12 * s, z, 0, 0, 0, 0.3 * s, 0.25 * s, 0.3 * s), col);
      if (r() < 0.4) m.add(T.ico, U.compose(x, y + h + 0.28 * s, z, 0, 0, 0, 0.1, 0.07, 0.1), C(pick(r, [0xf0d040, 0xe06090, 0xf4f0e0])));
      const arms = 1 + Math.floor(r() * 3);
      for (let k = 0; k < arms; k++) {
        const a = r() * Math.PI * 2 + k * 2.1, ah = h * (0.35 + r() * 0.3), dx = Math.cos(a), dz = Math.sin(a);
        m.addBox(0.75 * s, 0.24 * s, 0.24 * s, x + dx * 0.45 * s, y + ah, z + dz * 0.45 * s, -a, col);
        const vh = 0.9 * s + r() * 0.8 * s;
        m.add(T.cyl8, U.compose(x + dx * 0.8 * s, y + ah + vh / 2 - 0.1, z + dz * 0.8 * s, 0, 0, 0, 0.17 * s, vh, 0.17 * s), col);
        m.add(T.cone5, U.compose(x + dx * 0.8 * s, y + ah + vh - 0.05, z + dz * 0.8 * s, 0, 0, 0, 0.17 * s, 0.14 * s, 0.17 * s), col);
      }
      cols.push({ t: 'c', x, z, r: 0.42 * s, kind: 'cactus' });
    },
    barrel(m, cols, x, y, z, r) {
      const s = 0.35 + r() * 0.3, col = vary(0x5a8a40, r, 0.2);
      m.add(T.cyl8, U.compose(x, y + s * 0.6, z, 0, r(), 0, s, s * 1.2, s), col);
      m.add(T.ico, U.compose(x, y + s * 1.2, z, 0, 0, 0, s * 0.95, s * 0.35, s * 0.95), col);
      for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; m.add(T.ico, U.compose(x + Math.cos(a) * s * 0.35, y + s * 1.38, z + Math.sin(a) * s * 0.35, 0, 0, 0, 0.06, 0.05, 0.06), C(pick(r, [0xf0c030, 0xe8603a, 0xf06080]))); }
      cols.push({ t: 'c', x, z, r: s, kind: 'cactus' });
    },
    yucca(m, cols, x, y, z, r) {
      const th = 0.6 + r() * 1.4, col = vary(0x6a8a50, r, 0.2);
      m.add(T.cyl6, U.compose(x, y + th / 2, z, 0, 0, 0, 0.12, th, 0.12), C(0x7a6248));
      for (let k = 0; k < 16; k++) { const a = r() * 6.28, t = 0.2 + r() * 1.0; limb(m, x, y + th, z, a, t, 0.7 + r() * 0.3, 0.035, col, T.cone3); }
      if (r() < 0.5) { const [tx, ty, tz] = limb(m, x, y + th, z, 0, 0.05, 1.3, 0.025, C(0x8a7a50)); for (let k = 0; k < 6; k++) m.add(T.ico, U.compose(tx, ty - k * 0.12, tz, 0, 0, 0, 0.09, 0.07, 0.09), C(0xf4ecd0)); }
      cols.push({ t: 'c', x, z, r: 0.3, kind: 'cactus' });
    },
    agave(m, x, y, z, r) {
      const col = vary(0x6a8a8a, r, 0.2), n = 10 + Math.floor(r() * 6), s = 0.7 + r() * 0.6;
      for (let k = 0; k < n; k++) { const a = k / n * 6.28 + r() * 0.3, t = 0.5 + r() * 0.8; m.add(T.cone3, U.compose(x + Math.sin(a) * Math.sin(t) * 0.35 * s, y + Math.cos(t) * 0.35 * s, z + Math.cos(a) * Math.sin(t) * 0.35 * s, t, a, 0, 0.12 * s, 0.8 * s, 0.05 * s), col); }
    },
    ocotillo(m, cols, x, y, z, r) {
      const n = 6 + Math.floor(r() * 6), col = C(0x6a5a40), tip = C(0xd03a2a), leaf = C(0x6a9a40);
      for (let k = 0; k < n; k++) {
        const [tx, ty, tz] = limb(m, x, y, z, r() * 6.28, 0.1 + r() * 0.35, 2.5 + r() * 1.8, 0.035, col);
        m.add(T.cone3, U.compose(tx, ty + 0.12, tz, 0, 0, 0, 0.05, 0.25, 0.05), tip);
        if (r() < 0.6) m.add(T.ico, U.compose((x + tx) / 2, (y + ty) / 2 + 0.3, (z + tz) / 2, 0, 0, 0, 0.12, 0.25, 0.12), leaf);
      }
      cols.push({ t: 'c', x, z, r: 0.25, kind: 'cactus' });
    },
    flowers(m, x, y, z, r, palette) {
      const col = C(pick(r, palette)), n = 3 + Math.floor(r() * 5);
      m.add(T.ico, U.compose(x, y + 0.08, z, 0, 0, 0, 0.18, 0.1, 0.18), vary(0x6a8a40, r, 0.3));
      for (let k = 0; k < n; k++) {
        const a = r() * 6.28, d = r() * 0.35, hh = 0.2 + r() * 0.3, fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d;
        m.addBox(0.015, hh, 0.015, fx, y + hh / 2, fz, 0, C(0x4a7a30));
        m.add(T.ico, U.compose(fx, y + hh + 0.03, fz, 0, r() * 3, 0, 0.06, 0.035, 0.06), col);
      }
    },
    grass(m, x, y, z, r, hex) {
      const col = vary(hex || 0xb0a052, r, 0.3), n = 4 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const a = r() * 6.28, d = r() * 0.3, h = 0.35 + r() * 0.55;
        m.add(T.cone3, U.compose(x + Math.cos(a) * d, y + h / 2, z + Math.sin(a) * d, (r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6, 0.06, h, 0.06), col);
      }
    },
    pebbles(m, x, y, z, r, b) {
      const n = 4 + Math.floor(r() * 6), base = C(b.rock);
      for (let i = 0; i < n; i++) { const s = 0.06 + r() * 0.14; m.add(T.dode, U.compose(x + (r() - 0.5) * 2, y + s * 0.3, z + (r() - 0.5) * 2, r() * 3, r() * 3, 0, s, s * 0.6, s), base.clone().multiplyScalar(0.75 + r() * 0.5)); }
    },
    bones(m, x, y, z, r) {
      const c = C(0xece4d0), a = r() * 6.28;
      m.addBox(0.22, 0.16, 0.32, x, y + 0.08, z, a, c);
      m.add(T.cone3, U.compose(x + Math.cos(a) * 0.16, y + 0.18, z - Math.sin(a) * 0.16, 0, 0, -1.2, 0.04, 0.3, 0.04), c);
      m.add(T.cone3, U.compose(x - Math.cos(a) * 0.16, y + 0.18, z + Math.sin(a) * 0.16, 0, 0, 1.2, 0.04, 0.3, 0.04), c);
      for (let k = 0; k < 5; k++) m.addBox(0.6, 0.04, 0.04, x + Math.sin(a) * (0.5 + k * 0.12), y + 0.05, z + Math.cos(a) * (0.5 + k * 0.12), a + 0.2 * (r() - 0.5), c);
    },
    rock(m, cols, x, y, z, r, b, big) {
      const s = big ? 2.2 + r() * 2.2 : 0.35 + r() * 1.0, col = C(b.rock).multiplyScalar(0.85 + r() * 0.3);
      m.add(T.dode, U.compose(x, y + 0.25 * s, z, r() * 3, r() * 3, r() * 3, s * (1 + r() * 0.5), s * (0.55 + r() * 0.45), s * (1 + r() * 0.5)), col);
      if (big) for (let k = 0; k < 3; k++) { const a = r() * 6.28, ss = s * (0.25 + r() * 0.25); m.add(T.dode, U.compose(x + Math.cos(a) * s * 1.2, y + ss * 0.3, z + Math.sin(a) * s * 1.2, r() * 3, r() * 3, 0, ss, ss * 0.7, ss), col.clone().multiplyScalar(0.9 + r() * 0.2)); }
      if (s > 0.6) cols.push({ t: 'c', x, z, r: s * 1.05, kind: 'rock' });
    },
    outcrop(m, cols, x, y, z, r, b) {
      const s = 3 + r() * 3, base = C(b.rock), n = 3 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        const ss = s * (1 - k * 0.16), col = base.clone().multiplyScalar(k % 2 ? 1.12 : 0.88);
        m.add(T.dode, U.compose(x + (r() - 0.5) * 0.6, y + k * s * 0.42, z + (r() - 0.5) * 0.6, 0, r() * 3, 0, ss, s * 0.32, ss * (0.8 + r() * 0.4)), col);
      }
      cols.push({ t: 'c', x, z, r: s * 0.95, kind: 'rock' });
    },
    hoodoo(m, cols, x, y, z, r, b) {
      const base = C(b.rock), n = 4 + Math.floor(r() * 3), s = 0.9 + r() * 0.8;
      let hy = y;
      for (let k = 0; k < n; k++) { const ss = s * (1 - k * 0.08), hh = 1.2 + r() * 0.6; m.add(T.dode, U.compose(x, hy + hh / 2, z, 0, r() * 3, 0, ss, hh * 0.6, ss), base.clone().multiplyScalar(k % 2 ? 1.1 : 0.9)); hy += hh * 0.85; }
      m.add(T.dode, U.compose(x, hy + 0.3, z, 0, r(), 0, s * 1.4, 0.45, s * 1.3), base.clone().multiplyScalar(0.75));
      cols.push({ t: 'c', x, z, r: s, kind: 'rock' });
    },
    bush(m, x, y, z, r) {
      const s = 0.5 + r() * 0.7, col = vary(0x7d7a3e, r, 0.3);
      for (let k = 0; k < 3; k++) m.add(T.ico, U.compose(x + (r() - 0.5) * s, y + 0.3 * s + r() * 0.2, z + (r() - 0.5) * s, 0, r() * 3, 0, s * (0.6 + r() * 0.4), 0.5 * s, s * (0.6 + r() * 0.4)), col.clone().multiplyScalar(0.9 + r() * 0.2));
    },
    deadtree(m, cols, x, y, z, r) {
      const h = 3 + r() * 2, col = vary(0x6b5440, r, 0.2);
      m.add(T.cyl6, U.compose(x, y + h / 2, z, 0, 0, 0, 0.18, h, 0.18), col);
      const n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const [tx, ty, tz] = limb(m, x, y + h * (0.45 + r() * 0.5), z, r() * 6.28, 0.6 + r() * 0.6, 1 + r() * 1.5, 0.08, col);
        limb(m, tx, ty, tz, r() * 6.28, 0.4 + r() * 0.8, 0.5 + r() * 0.7, 0.04, col);
      }
      cols.push({ t: 'c', x, z, r: 0.3, kind: 'tree' });
    },
    joshua(m, cols, x, y, z, r) {
      const bark = vary(0x6a5a44, r, 0.2), leaf = vary(0x5a7a3a, r, 0.2), h = 2 + r() * 1.5;
      const [tx, ty, tz] = limb(m, x, y, z, 0, 0.05, h, 0.2, bark);
      const n = 2 + Math.floor(r() * 3);
      for (let k = 0; k < n; k++) {
        let p = limb(m, tx, ty - 0.2, tz, k / n * 6.28 + r(), 0.5 + r() * 0.5, 1.2 + r() * 0.8, 0.12, bark);
        if (r() < 0.6) p = limb(m, p[0], p[1], p[2], r() * 6.28, 0.2 + r() * 0.4, 0.8, 0.09, bark);
        for (let j = 0; j < 8; j++) limb(m, p[0], p[1], p[2], r() * 6.28, r() * 1.4, 0.45, 0.03, leaf, T.cone3);
      }
      cols.push({ t: 'c', x, z, r: 0.3, kind: 'tree' });
    },
    log(m, cols, x, y, z, r) {
      const len = 2 + r() * 2.5, a = r() * 6.28, col = vary(0x7a6248, r, 0.2);
      m.add(T.cyl6, U.compose(x, y + 0.2, z, Math.PI / 2, a, 0, 0.2, len, 0.2), col);
      cols.push({ t: 'b', x, z, hw: 0.2, hd: len / 2, ry: a, kind: 'tree' });
    },
    mesa(m, cols, x, y, z, r, b) {
      const R = 10 + r() * 12, H = 14 + r() * 20, col = C(b.rock);
      m.add(T.cyl6, U.compose(x, y + H * 0.35, z, 0, r() * 3, 0, R * 1.15, H * 0.7, R * 1.15), col.clone().multiplyScalar(0.9));
      m.add(T.cyl6, U.compose(x, y + H * 0.75, z, 0, r() * 3, 0, R * 1.05, H * 0.12, R * 1.05), col.clone().multiplyScalar(1.15));
      m.add(T.cyl6, U.compose(x, y + H * 0.88, z, 0, r() * 3, 0, R, H * 0.25, R), col.clone().multiplyScalar(1.02));
      cols.push({ t: 'c', x, z, r: R * 1.1, kind: 'rock' });
    },
    saltmound(m, x, y, z, r) { const s = 0.8 + r() * 1.8; m.add(T.cone5, U.compose(x, y + 0.12, z, 0, r() * 3, 0, s, 0.35, s), vary(0xf6f3ec, r, 0.06)); },
    saltplate(m, x, y, z, r) { const s = 0.7 + r() * 1.0; m.add(T.cyl6, U.compose(x, y + 0.03, z, 0, r() * 3, 0, s, 0.05, s), vary(0xfbf8f2, r, 0.05)); },
  };
  const FLOWERS = { 'Poušť': [0xf0c030, 0xe8742a, 0xf4f0e8], 'Kaňon': [0xd23a3a, 0xf0c030, 0x9a5ac8], 'Solná pláň': [0xf4f0e8], 'Step': [0x9a5ac8, 0xf0c030, 0xe87aa8, 0xf4f0e8, 0x5a7ad8] };

  // ---- překážky na silnici a cíl závodu ----
  function obstacle(world, o, m, cols, group) {
    const y = world.L(o.x, o.z);
    if (o.kind === 'rock') {
      m.add(T.dode, U.compose(o.x, y + 0.3 * o.r, o.z, 1, 2, 3, o.r * 1.3, o.r * 0.9, o.r * 1.2), C(0x8a7a68));
      cols.push({ t: 'c', x: o.x, z: o.z, r: o.r * 1.15, kind: 'rock' });
    } else if (o.kind === 'pole') {
      m.addBox(4.6, 0.32, 0.32, o.x, y + 0.2, o.z, o.ry, C(0x5a4330), 0, 0.05);
      cols.push({ t: 'b', x: o.x, z: o.z, hw: 2.3, hd: 0.25, ry: o.ry, kind: 'pole' });
    } else if (o.kind === 'wreck') {
      wreck(world, o, m, cols);
      const c = Math.cos(o.ry), s = Math.sin(o.ry);
      if (o.loot && !o.spawned) { o.spawned = true; Items.spawn(o.loot[0], o.x + c * 1.6, world.groundAt(o.x + c * 1.6, o.z - s * 1.6), o.z - s * 1.6, o.loot[1]); }
    } else if (o.kind === 'sign') {
      // výstražná tabule ostré zatáčky (žlutá se šipkami ve směru zatáčky)
      const gy = world.height(o.x, o.z), fx = Math.sin(o.t), fz = -Math.cos(o.t);
      m.add(T.cyl6, U.compose(o.x, gy + 0.75, o.z, 0, 0, 0, 0.05, 1.5, 0.05), C(0x8a8a86));
      if (!Props.signMats) {
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const g = cv.getContext('2d');
        g.fillStyle = '#f2c230'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#151515'; g.fillRect(0, 0, 128, 4); g.fillRect(0, 60, 128, 4);
        for (const x0 of [14, 54, 94]) { g.beginPath(); g.moveTo(x0, 10); g.lineTo(x0 + 22, 32); g.lineTo(x0, 54); g.lineTo(x0 + 10, 54); g.lineTo(x0 + 32, 32); g.lineTo(x0 + 10, 10); g.fill(); }
        const tR = new THREE.CanvasTexture(cv), tL = new THREE.CanvasTexture(cv); tL.wrapS = THREE.RepeatWrapping; tL.repeat.x = -1;
        Props.signMats = [tL, tR].map(t => new THREE.MeshLambertMaterial({ map: t }));
        Props.signGeo = new THREE.PlaneGeometry(1.3, 0.65); Props.signGeo.userData.shared = true;
      }
      const sign = new THREE.Mesh(Props.signGeo, Props.signMats[o.dir > 0 ? 1 : 0]);
      sign.position.set(o.x, gy + 1.75, o.z); sign.rotation.y = Math.atan2(-fx, -fz); group.add(sign);
      m.addBox(1.36, 0.71, 0.04, o.x + fx * 0.03, gy + 1.75, o.z + fz * 0.03, sign.rotation.y, C(0x2a2a2a));
      cols.push({ t: 'c', x: o.x, z: o.z, r: 0.12, kind: 'cactus' });
    } else if (o.kind === 'finish') {
      const nx = Math.cos(o.t), nz = Math.sin(o.t);
      for (const sd of [-1, 1]) { const px = o.x + nx * sd * 5.2, pz = o.z + nz * sd * 5.2; m.add(T.cyl8, U.compose(px, world.height(px, pz) + 3, pz, 0, 0, 0, 0.18, 6, 0.18), C(0xe8e8e8)); }
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const g = cv.getContext('2d');
      for (let i = 0; i < 32; i++) for (let j = 0; j < 6; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f4'; g.fillRect(i * 16, j * 16, 16, 16); }
      g.fillStyle = '#c0302a'; g.fillRect(150, 10, 212, 76); g.fillStyle = '#fff'; g.font = 'bold 60px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CÍL', 256, 50);
      const ban = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), side: THREE.DoubleSide }));
      ban.userData.ownMat = true; ban.position.set(o.x, y + 5.4, o.z); ban.rotation.y = -o.t; group.add(ban);
    }
  }
  function wreck(world, o, m, cols) {
    const col = C([0x7a5a3a, 0x5e6a70, 0x7a3a2a, 0x6a6a3a][Math.floor(U.hash(o.x | 0, o.z | 0, 1) * 4)]);
    const c = Math.cos(o.ry), s = Math.sin(o.ry), y = world.height(o.x, o.z);
    m.addBox(1.8, 0.7, 4.2, o.x, y + 0.45, o.z, o.ry, col, 0, 0.08);
    m.addBox(1.6, 0.6, 1.9, o.x - s * 0.3, y + 1.1, o.z - c * 0.3, o.ry, col.clone().multiplyScalar(0.8), 0, 0.08);
    m.addBox(0.9, 0.3, 0.6, o.x + s * 1.4 + c * 0.3, y + 0.9, o.z + c * 1.4 - s * 0.3, o.ry + 0.4, C(0x8a4a28), 0.3);
    for (const [lx, lz] of [[0.85, 1.3], [-0.85, 1.3], [0.85, -1.3], [-0.85, -1.3]])
      m.add(T.cyl8, U.compose(o.x + lx * c + lz * s, y + 0.25, o.z - lx * s + lz * c, 0, o.ry, Math.PI / 2, 0.3, 0.2, 0.3), C(0x1e1e1e));
    cols.push({ t: 'b', x: o.x, z: o.z, hw: 0.95, hd: 2.15, ry: o.ry, kind: 'wreck' });
  }
  function junkyard(world, h, group, cols, r) {
    const m = new U.Merger(), cs = Math.cos(h.ry), sn = Math.sin(h.ry), R = 13;
    const toW = (lx, lz) => [h.x + lx * cs + lz * sn, h.z - lx * sn + lz * cs];
    for (let a = 0; a < 30; a++) {
      const ang = a / 30 * Math.PI * 2; if (Math.abs(U.wrapAngle(ang)) < 0.35) continue;
      const [px, pz] = toW(Math.sin(ang) * R, Math.cos(ang) * R);
      m.addBox(0.12, 1.9, 0.12, px, h.y + 0.95, pz, h.ry, C(0x6a6a62)); cols.push({ t: 'c', x: px, z: pz, r: 0.3, kind: 'wall' });
      const a2 = (a + 1) / 30 * Math.PI * 2;
      if (Math.abs(U.wrapAngle(a2)) >= 0.35) { const am = (ang + a2) / 2, [wx, wz] = toW(Math.sin(am) * R, Math.cos(am) * R); m.addBox(R * 0.21, 1.5, 0.04, wx, h.y + 0.95, wz, h.ry + am, C(0x8a8a80)); }
    }
    if (!h.wreckList) {
      h.wreckList = [];
      for (let i = 0; i < 7; i++) {
        const ang = 0.9 + i * 0.75, rr = 5.5 + (i % 2) * 3;
        const [wx, wz] = toW(Math.sin(ang) * rr, Math.cos(ang) * rr);
        const o = { kind: 'wreck', x: wx, z: wz, ry: r() * 6.28, km: h.km, dismantled: false, junk: true };
        h.wreckList.push(o); World.wrecks.push(o);
      }
    }
    for (const o of h.wreckList) wreck(world, o, m, cols);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) { const [px, pz] = toW(-2 + i * 0.9, -1.5); m.add(T.cyl8, U.compose(px, h.y + 0.11 + k * 0.23, pz, 0, 0, 0, 0.36, 0.22, 0.36), C(0x1e1e1e)); }
    const mesh = m.build(); if (mesh) group.add(mesh);
    const tex = U.textTexture('VRAKOVIŠTĚ', 256, 64, '#5a4a3a', '#f6ecd0');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    sign.userData.ownMat = true; const [sx, sz] = toW(0, R + 0.3); sign.position.set(sx, h.y + 2.6, sz); sign.rotation.y = h.ry; group.add(sign);
    if (!h.spawned) {
      h.spawned = true;
      const slots = [[1.5, 2], [-2, 3], [3, -2], [-3.5, -3], [0, -5], [4.5, 3], [-5, 0.5]];
      h.loot.forEach(([type, data], i) => { const [wx, wz] = toW(slots[i % 7][0], slots[i % 7][1] + (i >= 7 ? 0.6 : 0)); Items.spawn(type, wx, world.groundAt(wx, wz), wz, data); });
    }
  }

  function* populateChunk(world, cx, cz, group, cols, floors) {
    // drobnosti (tráva, kytky, oblázky…) zvlášť: nevrhají stín a zdálky se nekreslí – měly většinu trojúhelníků v okolí
    const m = new U.Merger(), sm = new U.Merger(), r = U.rng(Math.floor(U.hash(cx, cz, world.seed) * 1e9));
    const x0 = cx * W_CHUNK, z0 = cz * W_CHUNK;
    const bw = world.biomeW(z0 + W_CHUNK / 2);
    const bio = BIOMES[r() < bw.t ? bw.b : bw.a];
    const minD = { mesa: 75, boulder: 14, outcrop: 18, hoodoo: 14, flowers: 5, drygrass: 5, grass: 5, pebbles: 4.2, saltplate: 4.5 };
    for (const [type, dens] of bio.props) {
      const cnt = Math.floor(dens * (0.6 + r() * 0.8) + r());
      for (let i = 0; i < cnt; i++) {
        const x = x0 + r() * W_CHUNK, z = z0 + r() * W_CHUNK;
        const d = world.clearDist(x, z);
        if (d < (minD[type] || 8)) continue;
        const y = world.height(x, z) - 0.05;
        const b = BIOMES[world.biomeAt(z)];
        switch (type) {
          case 'cactus': N.cactus(m, cols, x, y, z, r); break;
          case 'barrel': N.barrel(m, cols, x, y, z, r); break;
          case 'yucca': N.yucca(m, cols, x, y, z, r); break;
          case 'agave': N.agave(sm, x, y, z, r); break;
          case 'ocotillo': N.ocotillo(m, cols, x, y, z, r); break;
          case 'flowers': N.flowers(sm, x, y, z, r, FLOWERS[b.name]); break;
          case 'grass': N.grass(sm, x, y, z, r); break;
          case 'drygrass': N.grass(sm, x, y, z, r, 0xd2c08e); break;
          case 'pebbles': N.pebbles(sm, x, y, z, r, b); break;
          case 'bones': N.bones(sm, x, y, z, r); break;
          case 'rock': N.rock(m, cols, x, y, z, r, b, false); break;
          case 'boulder': N.rock(m, cols, x, y, z, r, b, true); break;
          case 'outcrop': N.outcrop(m, cols, x, y, z, r, b); break;
          case 'hoodoo': N.hoodoo(m, cols, x, y, z, r, b); break;
          case 'bush': N.bush(m, x, y, z, r); break;
          case 'deadtree': N.deadtree(m, cols, x, y, z, r); break;
          case 'joshua': N.joshua(m, cols, x, y, z, r); break;
          case 'log': N.log(m, cols, x, y, z, r); break;
          case 'mesa': N.mesa(m, cols, x, y, z, r, b); break;
          case 'saltmound': N.saltmound(m, x, y, z, r); break;
          case 'saltplate': N.saltplate(sm, x, y, z, r); break;
        }
        if (i % 6 === 5) yield;
      }
    }
    // telegrafní sloupy s dráty podél silnice
    for (let gx = 0; gx < 2; gx++) for (let gz = 0; gz < 2; gz++) {
      const arr = world.ptGrid.get(world.key(Math.floor(x0 / 32) + gx, Math.floor(z0 / 32) + gz));
      if (!arr) continue;
      for (const i of arr) {
        if (i % 12 !== 6) continue;
        const p = world.pts[i], q = world.pts[i + 12];
        const px = p.x + Math.cos(p.t) * 9, pz = p.z + Math.sin(p.t) * 9;
        if (px < x0 || px >= x0 + W_CHUNK || pz < z0 || pz >= z0 + W_CHUNK) continue;
        const py = world.height(px, pz);
        m.add(T.cyl6, U.compose(px, py + 3.75, pz, 0, 0, 0, 0.12, 7.5, 0.12), C(0x5a4330));
        m.addBox(1.8, 0.12, 0.12, px, py + 7.1, pz, -p.t, C(0x5a4330));
        for (const off of [-0.7, 0.7]) m.add(T.cyl6, U.compose(px + Math.cos(p.t) * off, py + 7.22, pz + Math.sin(p.t) * off, 0, 0, 0, 0.04, 0.12, 0.04), C(0xd8e0e0));
        cols.push({ t: 'c', x: px, z: pz, r: 0.2, kind: 'pole' });
        if (q) {
          const qx = q.x + Math.cos(q.t) * 9, qz = q.z + Math.sin(q.t) * 9, qy = world.height(qx, qz);
          for (const off of [-0.7, 0.7]) {
            const ax = px + Math.cos(p.t) * off, az = pz + Math.sin(p.t) * off, bx = qx + Math.cos(q.t) * off, bz = qz + Math.sin(q.t) * off;
            const len = Math.hypot(bx - ax, bz - az, qy - py), mid = new THREE.Vector3((ax + bx) / 2, (py + qy) / 2 + 6.9, (az + bz) / 2);
            const dir = new THREE.Vector3(bx - ax, qy - py, bz - az).normalize();
            m.add(U.unitBox, new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir), new THREE.Vector3(0.03, 0.03, len)), C(0x222222));
          }
        }
      }
    }
    const k = world.key(cx, cz);
    for (const o of world.obsByChunk.get(k) || []) obstacle(world, o, m, cols, group);
    for (const hole of world.holeByChunk.get(k) || []) m.add(T.cyl8, U.compose(hole.x, world.L(hole.x, hole.z) + 0.075, hole.z, 0, 0, 0, hole.r, 0.02, hole.r * 0.8), C(0x1f1c1a));
    yield;
    for (const h of world.houseGrid.get(k) || []) { Buildings.build(world, h, group, cols, floors); yield; }
    const mesh = m.build();
    if (mesh) group.add(mesh);
    const small = sm.build();
    if (small) { small.castShadow = false; group.add(small); group.userData.small = small; }
  }

  return { populateChunk, junkyard, T };
})();
