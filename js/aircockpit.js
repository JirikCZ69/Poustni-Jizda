// aircockpit.js – interiér kokpitu letadel (pohled pilota): přístrojová deska s plnou sadou analogových budíků
// (rychlost, umělý horizont, výškoměr, zatáčkoměr, kurz, variometr, otáčky, přetížení, palivo/olej, kontrolky),
// štít proti oslnění s kompasem, bočnice, podlaha, sedačka, nohy pilota, knipl / volant, plyn, pedály a ruce,
// které se hýbou podle řízení. Staví se líně – až když si hráč poprvé přepne na pohled z kokpitu.
const AirCockpit = {
  W: 1024, H: 384,   // plátno přístrojové desky
  // rozměry kokpitu (souřadnice těla: x vpravo, y nahoru, z dozadu)
  dims(id) {
    if (id === 'cmelak') return { D: 0.62, PW: 1.0, PH: 0.33, hw: 0.5, floor: -0.36, sill: 0.3, roof: 1.12, ctl: 'yoke', wall: 0x8c8474, wall2: 0x6e675a, panel: '#34363a', seat: 0x5a4a3a, suit: 0x3a4a5a };
    if (id === 'sokol') return { D: 0.6, PW: 0.76, PH: 0.31, hw: 0.4, floor: -0.32, sill: 0.5, ctl: 'stick', wall: 0x3c3f45, wall2: 0x2a2c30, panel: '#202226', seat: 0x2a2a2a, suit: 0x8a2a2a };
    return { D: 0.64, PW: 0.88, PH: 0.33, hw: 0.58, floor: -0.28, sill: 0.74, ctl: 'stick', wall: 0x5f6b55, wall2: 0x48523f, panel: '#1c1c1e', seat: 0x4a3a2a, suit: 0x4a5a3a };
  },
  // rozložení budíků na plátně (px): šestice uprostřed vlevo, motor vpravo, kontrolky a hodiny úplně vpravo
  layout() {
    const r = 64, y1 = 104, y2 = 270, X = [92, 238, 384, 530, 676];
    return {
      g: [
        { k: 'asi', x: X[0], y: y1, r }, { k: 'att', x: X[1], y: y1, r }, { k: 'alt', x: X[2], y: y1, r },
        { k: 'tc', x: X[0], y: y2, r }, { k: 'hdg', x: X[1], y: y2, r }, { k: 'vsi', x: X[2], y: y2, r },
        { k: 'rpm', x: X[3], y: y1, r }, { k: 'g', x: X[3], y: y2, r },
        { k: 'fuel', x: X[4], y: y1 - 26, r: 38 }, { k: 'oil', x: X[4], y: y1 + 62, r: 38 }, { k: 'pwr', x: X[4], y: y2 + 20, r: 50 },
      ],
      ann: { x: 760, y: 26, w: 240, h: 330 },
    };
  },

  // ---------- stavba 3D interiéru ----------
  build(o) {
    if (o.ck) return o.ck;
    const id = o.id || PLANE_IDS.find(k => PLANES[k] === o.P), d = this.dims(id), eye = o.eye, EY = eye.y, EZ = eye.z;
    const grp = o.cockpit;
    const mg = new U.Merger(), cyl = this._cyl || (this._cyl = new THREE.CylinderGeometry(1, 1, 1, 10).toNonIndexed());
    const box = (w, h, dd, x, y, z, col, rx, ry, rz) => mg.addBox(w, h, dd, x, y, z, ry || 0, col, rx || 0, rz || 0);
    const rod = (A, B, r, col, M) => {
      const a = new THREE.Vector3(...A), b = new THREE.Vector3(...B), dv = b.clone().sub(a), L = dv.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.normalize());
      (M || mg).add(cyl, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(r, L, r)), col);
    };
    // přístrojová deska: horní hrana ~13,5° pod úrovní očí (štít nad ní ~11°), aby přes ni byl vidět nos, vrtule a křídla
    const pz = EZ - d.D, top = EY - d.D * Math.tan(13.5 * Math.PI / 180), tilt = 0.22;
    const pc = new THREE.Vector3(0, top - d.PH / 2 * Math.cos(tilt), pz - d.PH / 2 * Math.sin(tilt));
    const pg = new THREE.Group(); pg.position.copy(pc); pg.rotation.x = -tilt; grp.add(pg);
    const cv = document.createElement('canvas'); cv.width = this.W; cv.height = this.H;
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(d.PW, d.PH), new THREE.MeshBasicMaterial({ map: tex, color: 0xe6e6e6 }));
    pg.add(face);
    // rámečky budíků (prstence) a šrouby
    const pm = new U.Merger(), tor = new THREE.TorusGeometry(1, 0.08, 6, 28).toNonIndexed(), sx = d.PW / this.W, sy = d.PH / this.H;
    for (const g of this.layout().g) {
      const R = g.r * sx * 1.06;
      pm.add(tor, new THREE.Matrix4().compose(new THREE.Vector3((g.x - this.W / 2) * sx, (this.H / 2 - g.y) * sy, 0.006), new THREE.Quaternion(), new THREE.Vector3(R, R, R * 3)), 0x0c0c0c);
    }
    pm.addBox(d.PW + 0.04, d.PH + 0.04, 0.05, 0, 0, -0.03, 0, 0x151515);   // skříň desky
    const pmm = pm.build(new THREE.MeshLambertMaterial({ vertexColors: true })); pmm.castShadow = false; pg.add(pmm);
    // štít proti oslnění: polštář nad deskou + kompas
    // (nízký a tenký – dřív trčel jen ~1,5° pod oči a zakrýval nos letadla)
    const gy = top + 0.012, gz = pz - 0.02;
    box(d.PW + 0.08, 0.022, 0.26, 0, gy, gz - 0.1, 0x18181a);
    rod([-(d.PW / 2 + 0.04), gy + 0.002, gz + 0.03], [d.PW / 2 + 0.04, gy + 0.002, gz + 0.03], 0.016, 0x222224);
    box(0.06, 0.035, 0.05, 0, gy + 0.028, gz - 0.07, 0x111111); box(0.045, 0.022, 0.005, 0, gy + 0.03, gz - 0.044, 0xd8d0b0);
    // spodní část desky, podlaha, firewall
    const pb = pc.y - d.PH / 2 - 0.02;
    box(d.PW + 0.02, pb - d.floor, 0.06, 0, (pb + d.floor) / 2, pz + 0.02, 0x1e1f22);
    box(d.hw * 2, 0.03, Math.max(0.6, EZ + 0.7 - pz), 0, d.floor, (pz + EZ + 0.7) / 2, 0x26272a);
    // bočnice: dolní část až po parapet, nahoře lišta
    for (const s of [-1, 1]) {
      const z0 = pz - 0.05, z1 = EZ + 0.75, zl = z1 - z0;
      box(0.03, d.sill - d.floor, zl, s * d.hw, (d.sill + d.floor) / 2, (z0 + z1) / 2, d.wall);
      for (let k = 0; k < 4; k++) box(0.012, d.sill - d.floor - 0.06, 0.025, s * (d.hw - 0.02), (d.sill + d.floor) / 2, z0 + 0.15 + k * zl / 4, d.wall2);   // výztuhy
      rod([s * (d.hw - 0.01), d.sill, z0], [s * d.hw - s * 0.01, d.sill, z1], 0.022, 0x2a2a2c);
      // sloupky čelního skla
      const wsTop = id === 'cmelak' ? d.roof : EY + 0.32;
      rod([s * (d.PW / 2 + 0.05), gy + 0.02, gz - 0.2], [s * (d.PW / 2 - 0.02), wsTop, gz - (id === 'cmelak' ? 0.05 : -0.25)], 0.022, 0x1c1c1c);
    }
    if (id === 'cmelak') {   // kabina hornoplošníku: strop, dveřní sloupky, horní rám oken
      box(d.hw * 2, 0.03, 1.5, 0, d.roof, EZ - 0.1, 0xb8b0a0);
      for (const s of [-1, 1]) {
        rod([s * d.hw, d.sill, EZ + 0.55], [s * d.hw, d.roof, EZ + 0.55], 0.03, 0x6e675a);
        rod([s * d.hw, d.roof - 0.02, pz - 0.2], [s * d.hw, d.roof - 0.02, EZ + 0.7], 0.025, 0x6e675a);
        box(0.06, 0.12, 0.28, s * (d.hw - 0.05), d.roof - 0.08, EZ - 0.05, 0x9a9282, 0.15);   // sluneční clona
      }
    }
    // sedačka
    box(0.5, 0.1, 0.48, 0, EY - 0.86, EZ + 0.1, d.seat); box(0.5, 0.7, 0.1, 0, EY - 0.45, EZ + 0.38, d.seat, -0.2);
    // pravá konzola se spínači, levá s plynem
    box(0.12, 0.08, 0.5, d.hw - 0.08, d.sill - 0.12, EZ - 0.2, 0x26272a);
    for (let k = 0; k < 5; k++) { box(0.012, 0.012, 0.035, d.hw - 0.1 + (k % 2) * 0.03, d.sill - 0.07, EZ - 0.36 + k * 0.07, 0xd8d8d8, -0.5); box(0.03, 0.006, 0.02, d.hw - 0.08, d.sill - 0.078, EZ - 0.36 + k * 0.07, k === 0 ? 0xc02020 : 0x303030); }
    rod([d.hw - 0.08, d.sill - 0.08, EZ + 0.12], [d.hw - 0.08, d.sill - 0.06, EZ + 0.12], 0.035, 0xb02020);   // palivový ventil
    const qx = -d.hw + 0.09, qy = d.sill - 0.1, qz = EZ - 0.22;
    box(0.1, 0.1, 0.32, qx, qy - 0.03, qz, 0x26272a);
    if (id === 'strela') { for (const [dx, col] of [[0.03, 0x2a5ad8], [0.055, 0xc02020]]) { rod([qx + dx, qy + 0.02, qz], [qx + dx, qy + 0.14, qz - 0.05], 0.007, 0x888888); rod([qx + dx, qy + 0.14, qz - 0.05], [qx + dx, qy + 0.15, qz - 0.055], 0.018, col); } }
    // nohy pilota (při pohledu dolů), boty na pedálech
    for (const s of [-1, 1]) {
      const hip = [s * 0.11, EY - 0.78, EZ + 0.1], knee = [s * 0.14, EY - 0.6, EZ - 0.36], foot = [s * 0.15, d.floor + 0.1, pz + 0.16];
      rod(hip, knee, 0.075, d.suit); rod(knee, foot, 0.06, d.suit);
      box(0.1, 0.09, 0.24, foot[0], foot[1] - 0.02, foot[2] - 0.04, 0x1a1a1a);
    }
    const st = mg.build(new THREE.MeshLambertMaterial({ vertexColors: true })); st.castShadow = false; st.receiveShadow = true; grp.add(st);
    // ---- pohyblivé díly ----
    const am = (g, fn) => { const m = new U.Merger(); fn(m); const mm = m.build(new THREE.MeshLambertMaterial({ vertexColors: true })); mm.castShadow = false; g.add(mm); return mm; };
    const ck = o.ck = { grp, pg, cv, tex, d, id, pz, t: 0 };
    // pedály
    ck.ped = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 0.15, d.floor + 0.06, pz + 0.12); grp.add(g); am(g, (m) => { m.addBox(0.09, 0.14, 0.02, 0, 0.05, 0, 0, 0x777777, -0.5); m.addBox(0.02, 0.1, 0.02, 0, 0, 0.04, 0, 0x444444); }); return g; });
    const glove = (m, x, y, z) => { m.addBox(0.075, 0.09, 0.1, x, y, z, 0, 0x2a2420); m.addBox(0.03, 0.04, 0.05, x + 0.04 * Math.sign(x || 1), y + 0.01, z - 0.03, 0, 0x2a2420); };
    if (d.ctl === 'stick') {
      const g = ck.stick = new THREE.Group(); g.position.set(0, EY - 0.98, EZ - 0.36); grp.add(g);
      am(g, (m) => {
        m.add(this._cone || (this._cone = new THREE.ConeGeometry(1, 1, 10).toNonIndexed()), U.compose(0, 0.06, 0, 0, 0, 0, 0.07, 0.14, 0.07), 0x1a1a1a);   // manžeta
        m.add(cyl, U.compose(0, 0.27, 0, 0, 0, 0, 0.012, 0.46, 0.012), 0x2a2a2a);
        m.add(cyl, U.compose(0, 0.52, 0, 0.15, 0, 0, 0.022, 0.12, 0.022), 0x111111);
        m.addBox(0.012, 0.012, 0.012, 0, 0.59, -0.012, 0, 0xc02020); m.addBox(0.01, 0.025, 0.015, 0, 0.52, -0.03, 0, 0x555555);
        glove(m, 0.0, 0.52, 0.01);
      });
      ck.handR = new THREE.Object3D(); ck.handR.position.set(0.02, 0.5, 0.04); g.add(ck.handR);
    } else {
      // volant (berany) na sloupku z desky
      const g = ck.yoke = new THREE.Group(); g.position.set(0, pb + 0.1, pz + 0.24); grp.add(g);
      am(g, (m) => {
        m.add(cyl, U.compose(0, 0, -0.2, Math.PI / 2, 0, 0, 0.016, 0.42, 0.016), 0x888888);
        m.addBox(0.08, 0.08, 0.05, 0, 0, 0.01, 0, 0x222222);
        m.addBox(0.34, 0.035, 0.035, 0, 0.02, 0.02, 0, 0x1c1c1c);
        for (const s of [-1, 1]) { m.add(cyl, U.compose(s * 0.17, 0.06, 0.02, 0, 0, 0, 0.022, 0.13, 0.022), 0x1c1c1c); glove(m, s * 0.17, 0.07, 0.04); }
        m.addBox(0.06, 0.03, 0.006, 0, 0.03, 0.04, 0, 0xc8c8c8);
      });
      ck.handR = new THREE.Object3D(); ck.handR.position.set(0.17, 0.06, 0.08); g.add(ck.handR);
      ck.handL = new THREE.Object3D(); ck.handL.position.set(-0.17, 0.06, 0.08); g.add(ck.handL);
    }
    // plyn: páka v levé konzole (u Čmeláka táhlo uprostřed desky)
    if (d.ctl === 'stick') {
      const g = ck.thr = new THREE.Group(); g.position.set(qx, qy + 0.01, qz + 0.04); grp.add(g);
      am(g, (m) => { m.add(cyl, U.compose(0, 0.08, 0, 0, 0, 0, 0.008, 0.16, 0.008), 0x888888); m.addBox(0.05, 0.035, 0.04, 0, 0.17, 0, 0, 0x111111); glove(m, -0.01, 0.18, 0.02); });
      ck.handL = new THREE.Object3D(); ck.handL.position.set(-0.01, 0.17, 0.05); g.add(ck.handL);
    } else {
      const g = ck.thr = new THREE.Group(); g.position.set(0, pb - 0.02, pz + 0.04); grp.add(g);
      am(g, (m) => { m.add(cyl, U.compose(0, 0, 0.04, Math.PI / 2, 0, 0, 0.006, 0.09, 0.006), 0x999999); m.add(cyl, U.compose(0, 0, 0.09, Math.PI / 2, 0, 0, 0.022, 0.02, 0.022), 0x111111); });
    }
    // předloktí: válec od lokte k ruce (nastavuje se každý snímek)
    const sleeve = new THREE.MeshLambertMaterial({ color: d.suit });
    ck.arms = [];
    for (const [h, s] of [[ck.handR, 1], [ck.handL, -1]]) {
      if (!h) continue;
      const m = new THREE.Mesh(cyl, sleeve); m.castShadow = false; grp.add(m);
      ck.arms.push({ m, hand: h, elbow: new THREE.Vector3(s * 0.21, EY - 0.52, EZ + 0.02) });
    }
    return ck;
  },

  // natočení ovládacích prvků podle vstupů (p, r, y = -1..1, thr 0..1)
  pose(o, inp) {
    const ck = o.ck; if (!ck) return;
    if (ck.stick) ck.stick.rotation.set(-inp.p * 0.26, 0, -inp.r * 0.3);
    if (ck.yoke) { ck.yoke.position.z = ck.pz + 0.24 + inp.p * 0.07; ck.yoke.rotation.z = -inp.r * 0.6; }
    if (ck.thr) { if (ck.d.ctl === 'stick') ck.thr.rotation.x = U.lerp(0.45, -0.55, inp.thr); else ck.thr.position.z = ck.pz + 0.04 + (1 - inp.thr) * 0.07; }
    ck.ped[0].position.z = ck.pz + 0.12 + inp.y * 0.05; ck.ped[1].position.z = ck.pz + 0.12 - inp.y * 0.05;
    // předloktí
    ck.grp.updateMatrixWorld(true);
    const inv = this._inv || (this._inv = new THREE.Matrix4()), hp = this._hp || (this._hp = new THREE.Vector3()), up = this._up || (this._up = new THREE.Vector3(0, 1, 0));
    inv.copy(ck.grp.matrixWorld).invert();
    for (const a of ck.arms) {
      a.hand.getWorldPosition(hp).applyMatrix4(inv);
      const dv = hp.clone().sub(a.elbow), L = dv.length();
      a.m.position.copy(a.elbow).addScaledVector(dv, 0.5);
      a.m.quaternion.setFromUnitVectors(up, dv.multiplyScalar(1 / L));
      a.m.scale.set(0.045, L, 0.045);
    }
  },

  // ---------- kreslení budíků ----------
  draw(o, ph, info) {
    const ck = o.ck; if (!ck) return;
    const g = ck.cv.getContext('2d'), W = this.W, H = this.H, P = ph.P, L = this.layout();
    // podklad desky: barva, jemný šum, šrouby
    if (!ck.bg) {
      const b = document.createElement('canvas'); b.width = W; b.height = H; const q = b.getContext('2d');
      q.fillStyle = ck.d.panel; q.fillRect(0, 0, W, H);
      for (let i = 0; i < 2600; i++) { q.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; q.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
      q.strokeStyle = 'rgba(0,0,0,.5)'; q.lineWidth = 3; q.strokeRect(1.5, 1.5, W - 3, H - 3);
      for (const [x, y] of [[12, 12], [W - 12, 12], [12, H - 12], [W - 12, H - 12], [W / 2 + 225, 12], [W / 2 + 225, H - 12]]) { q.fillStyle = '#777'; q.beginPath(); q.arc(x, y, 5, 0, 7); q.fill(); q.strokeStyle = '#333'; q.lineWidth = 1.5; q.beginPath(); q.moveTo(x - 4, y); q.lineTo(x + 4, y); q.stroke(); }
      q.fillStyle = 'rgba(255,255,255,.55)'; q.font = 'bold 13px Arial'; q.textAlign = 'center';
      const names = { asi: 'RYCHLOST', att: 'HORIZONT', alt: 'VÝŠKA', tc: 'ZATÁČKA', hdg: 'KURZ', vsi: 'STOUPÁNÍ', rpm: 'OTÁČKY', g: 'PŘETÍŽENÍ', pwr: 'VÝKON' };
      for (const k of L.g) if (names[k.k]) q.fillText(names[k.k], k.x, k.y + k.r + 15);
      q.fillText(P.name.toUpperCase(), L.ann.x + L.ann.w / 2, H - 14);
      ck.bg = b;
    }
    g.drawImage(ck.bg, 0, 0);
    const deg = Math.PI / 180, e = ph.euler(), V = ph.V * 3.6;
    const dial = (G) => {   // černý ciferník + sklo
      g.save(); g.translate(G.x, G.y);
      const gr = g.createRadialGradient(0, 0, G.r * 0.2, 0, 0, G.r); gr.addColorStop(0, '#16171a'); gr.addColorStop(1, '#08090a');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, G.r, 0, 7); g.fill();
    };
    const glass = (G) => { const gl = g.createLinearGradient(-G.r, -G.r, G.r * 0.3, G.r * 0.3); gl.addColorStop(0, 'rgba(255,255,255,.13)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); g.fillStyle = gl; g.beginPath(); g.arc(0, 0, G.r, 0, 7); g.fill(); g.restore(); };
    const scale = (G, a0, a1, v0, v1, major, minor, lab, fmt) => {   // stupnice od úhlu a0 do a1 (radiány, 0 = nahoru, po směru hodin)
      const r = G.r;
      g.strokeStyle = '#eee'; g.fillStyle = '#eee';
      for (let v = v0; v <= v1 + 1e-6; v += minor) {
        const a = a0 + (a1 - a0) * (v - v0) / (v1 - v0), M = Math.abs(v / major - Math.round(v / major)) < 1e-6;
        g.lineWidth = M ? 2.5 : 1.2; const r0 = r * (M ? 0.78 : 0.86);
        g.beginPath(); g.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0); g.lineTo(Math.sin(a) * r * 0.95, -Math.cos(a) * r * 0.95); g.stroke();
        if (M && lab) { g.font = `bold ${Math.round(r * 0.2)}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(fmt ? fmt(v) : v, Math.sin(a) * r * 0.6, -Math.cos(a) * r * 0.6); }
      }
    };
    const arc = (G, a0, a1, v0, v1, f, t, col, w) => { const A = (v) => a0 + (a1 - a0) * (v - v0) / (v1 - v0) - Math.PI / 2; g.strokeStyle = col; g.lineWidth = w || 5; g.beginPath(); g.arc(0, 0, G.r * 0.9, A(f), A(t)); g.stroke(); };
    const needle = (G, a, len, col, w) => { g.save(); g.rotate(a); g.fillStyle = col || '#f4f4f0'; g.beginPath(); g.moveTo(-(w || 3.5), G.r * 0.12); g.lineTo(0, -G.r * len); g.lineTo(w || 3.5, G.r * 0.12); g.fill(); g.restore(); g.fillStyle = '#333'; g.beginPath(); g.arc(0, 0, G.r * 0.08, 0, 7); g.fill(); };
    const lab = (t, y, sz) => { g.fillStyle = 'rgba(240,240,230,.75)'; g.font = `${sz || 11}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t, 0, y); };
    const A0 = -150 * deg, A1 = 150 * deg;
    for (const G of L.g) {
      if (G.k === 'asi') {
        const id = ck.id, vm = Math.ceil(Air.vmax(id) * 3.6 * 1.25 / 50) * 50, vs = Air.vstall(id) * 3.6, vne = Air.vmax(id) * 3.6 * 1.15;
        dial(G);
        if (P.flapCL.length > 1) arc(G, A0, A1, 0, vm, vs * 0.85, vs * 1.7, '#e8e8e8', 4);
        arc(G, A0, A1, 0, vm, vs, Air.vmax(id) * 3.6 * 0.92, '#2ac04a'); arc(G, A0, A1, 0, vm, Air.vmax(id) * 3.6 * 0.92, vne, '#e8c020'); arc(G, A0, A1, 0, vm, vne, vne + vm * 0.012, '#e02020', 7);
        scale(G, A0, A1, 0, vm, vm / 5, vm / 25, true); lab('km/h', G.r * 0.3);
        needle(G, A0 + (A1 - A0) * U.clamp(V / vm, 0, 1), 0.85);
        glass(G);
      } else if (G.k === 'att') {
        g.save(); g.translate(G.x, G.y); g.beginPath(); g.arc(0, 0, G.r, 0, 7); g.clip();
        const bank = ph.bank || 0, ppd = G.r / 28, off = U.clamp(e.x / deg, -40, 40) * ppd;
        g.save(); g.rotate(-bank);
        g.fillStyle = '#2f7ad0'; g.fillRect(-G.r * 2, -G.r * 3 + off, G.r * 4, G.r * 3); g.fillStyle = '#7a4a22'; g.fillRect(-G.r * 2, off, G.r * 4, G.r * 3);
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-G.r * 2, off); g.lineTo(G.r * 2, off); g.stroke();
        g.lineWidth = 1.4; g.font = '10px Arial'; g.fillStyle = '#fff'; g.textAlign = 'left';
        for (const pd of [-20, -10, 10, 20]) { const y = off - pd * ppd, w = Math.abs(pd) === 20 ? 22 : 14; g.beginPath(); g.moveTo(-w, y); g.lineTo(w, y); g.stroke(); g.fillText(Math.abs(pd), w + 3, y + 3); }
        for (const b of [-60, -30, -20, -10, 0, 10, 20, 30, 60]) { const a = b * deg; g.lineWidth = b % 30 ? 1.5 : 2.5; g.beginPath(); g.moveTo(Math.sin(a) * G.r * 0.8, -Math.cos(a) * G.r * 0.8); g.lineTo(Math.sin(a) * G.r, -Math.cos(a) * G.r); g.stroke(); }
        g.restore();
        g.fillStyle = '#f8f8f0'; g.beginPath(); g.moveTo(0, -G.r * 0.78); g.lineTo(-6, -G.r * 0.66); g.lineTo(6, -G.r * 0.66); g.fill();   // ukazatel náklonu
        g.strokeStyle = '#ff9a1a'; g.lineWidth = 4; g.beginPath(); g.moveTo(-G.r * 0.55, 0); g.lineTo(-G.r * 0.18, 0); g.lineTo(-G.r * 0.1, G.r * 0.1); g.moveTo(G.r * 0.55, 0); g.lineTo(G.r * 0.18, 0); g.lineTo(G.r * 0.1, G.r * 0.1); g.stroke();
        g.fillStyle = '#ff9a1a'; g.beginPath(); g.arc(0, 0, 3.5, 0, 7); g.fill();
        g.restore(); g.save(); g.translate(G.x, G.y); glass(G);
      } else if (G.k === 'alt') {
        const h = Math.max(0, ph.pos.y);
        dial(G); scale(G, 0, Math.PI * 2 - 36 * deg, 0, 900, 100, 20, true, (v) => v / 100);
        lab('m × 100', G.r * 0.32); lab('VÝŠKA n. m.', -G.r * 0.3, 9);
        needle(G, (h % 1000) / 1000 * Math.PI * 2, 0.86, '#f4f4f0', 3); needle(G, h / 10000 * Math.PI * 2, 0.55, '#f4f4f0', 6);
        g.fillStyle = '#0a0a0a'; g.fillRect(G.r * 0.18, -9, G.r * 0.62, 18); g.fillStyle = '#f0f0e0'; g.font = 'bold 13px monospace'; g.textAlign = 'right'; g.fillText(Math.round(h), G.r * 0.78, 1);
        glass(G);
      } else if (G.k === 'tc') {
        dial(G); const rate = -ph.w.y / deg, tilt = U.clamp(rate / 3, -2, 2) * 20 * deg;   // standardní zatáčka 3°/s = 20°
        g.strokeStyle = '#eee'; g.lineWidth = 3; for (const a of [-20, 0, 20]) { const r = a * deg + Math.PI / 2; g.beginPath(); g.moveTo(Math.cos(r) * G.r * 0.62, Math.sin(r) * G.r * 0.62); g.lineTo(Math.cos(r) * G.r * 0.8, Math.sin(r) * G.r * 0.8); g.stroke(); g.beginPath(); g.moveTo(-Math.cos(r) * G.r * 0.62, Math.sin(r) * G.r * 0.62); g.lineTo(-Math.cos(r) * G.r * 0.8, Math.sin(r) * G.r * 0.8); g.stroke(); }
        lab('L', G.r * 0.45, 13); g.textAlign = 'center'; g.fillText('L', -G.r * 0.62, G.r * 0.42); g.fillText('P', G.r * 0.62, G.r * 0.42);
        g.save(); g.rotate(tilt); g.fillStyle = '#f4f4f0'; g.fillRect(-G.r * 0.6, -3, G.r * 1.2, 6); g.beginPath(); g.arc(0, 0, 8, 0, 7); g.fill(); g.fillRect(-2, -16, 4, 14); g.restore();
        // kulička (skluz)
        g.fillStyle = '#c8d0b8'; g.beginPath(); g.roundRect ? g.roundRect(-G.r * 0.45, G.r * 0.5, G.r * 0.9, 16, 8) : g.rect(-G.r * 0.45, G.r * 0.5, G.r * 0.9, 16); g.fill();
        g.fillStyle = '#111'; g.beginPath(); g.arc(U.clamp(-ph.beta / deg * 2.2, -G.r * 0.38, G.r * 0.38), G.r * 0.5 + 8, 7, 0, 7); g.fill();
        g.strokeStyle = '#333'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-8, G.r * 0.5); g.lineTo(-8, G.r * 0.5 + 16); g.moveTo(8, G.r * 0.5); g.lineTo(8, G.r * 0.5 + 16); g.stroke();
        glass(G);
      } else if (G.k === 'hdg') {
        dial(G); const hd = ((-e.y / deg) % 360 + 360) % 360;
        g.save(); g.rotate(-hd * deg); g.strokeStyle = '#eee'; g.fillStyle = '#eee';
        for (let a = 0; a < 360; a += 5) { const r = a * deg, M = a % 30 === 0; g.lineWidth = M ? 2.2 : 1; g.beginPath(); g.moveTo(Math.sin(r) * G.r * (M ? 0.74 : a % 10 ? 0.86 : 0.8), -Math.cos(r) * G.r * (M ? 0.74 : a % 10 ? 0.86 : 0.8)); g.lineTo(Math.sin(r) * G.r * 0.94, -Math.cos(r) * G.r * 0.94); g.stroke(); }
        g.font = `bold ${Math.round(G.r * 0.22)}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
        for (let a = 0; a < 360; a += 30) { const t = { 0: 'S', 90: 'V', 180: 'J', 270: 'Z' }[a] || String(a / 10); g.save(); g.rotate(a * deg); g.fillStyle = a % 90 ? '#eee' : '#ffcf5a'; g.fillText(t, 0, -G.r * 0.56); g.restore(); }
        g.restore();
        g.fillStyle = '#ff9a1a'; g.beginPath(); g.moveTo(0, -G.r * 0.92); g.lineTo(-6, -G.r * 0.78); g.lineTo(6, -G.r * 0.78); g.fill();
        g.strokeStyle = '#ff9a1a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -G.r * 0.35); g.lineTo(0, G.r * 0.3); g.moveTo(-G.r * 0.25, -G.r * 0.05); g.lineTo(G.r * 0.25, -G.r * 0.05); g.moveTo(-G.r * 0.1, G.r * 0.25); g.lineTo(G.r * 0.1, G.r * 0.25); g.stroke();
        glass(G);
      } else if (G.k === 'vsi') {
        dial(G); const vs = ph.vel.y, a0 = -90 * deg - 170 * deg / 2 * 0, f = (v) => -Math.PI / 2 + U.clamp(v / 15, -1, 1) * 170 * deg;
        g.strokeStyle = '#eee'; g.fillStyle = '#eee';
        for (let v = -15; v <= 15; v += 1) { const a = f(v) + Math.PI / 2, M = v % 5 === 0; g.lineWidth = M ? 2.5 : 1.1; g.beginPath(); g.moveTo(Math.sin(a) * G.r * (M ? 0.76 : 0.85), -Math.cos(a) * G.r * (M ? 0.76 : 0.85)); g.lineTo(Math.sin(a) * G.r * 0.95, -Math.cos(a) * G.r * 0.95); g.stroke(); if (M) { g.font = `bold ${Math.round(G.r * 0.2)}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(Math.abs(v), Math.sin(a) * G.r * 0.58, -Math.cos(a) * G.r * 0.58); } }
        lab('m/s', G.r * 0.3); lab('▲', -G.r * 0.3, 10); lab('▼', G.r * 0.5, 10);
        needle(G, f(vs) + Math.PI / 2, 0.86); glass(G);
        void a0;
      } else if (G.k === 'rpm') {
        const mx = Math.ceil(P.rpmMax * 1.15 / 500) * 500;
        dial(G); arc(G, A0, A1, 0, mx, P.rpmIdle * 1.5, P.rpmMax * 0.95, '#2ac04a'); arc(G, A0, A1, 0, mx, P.rpmMax, P.rpmMax + mx * 0.012, '#e02020', 7);
        scale(G, A0, A1, 0, mx, mx >= 3000 ? 500 : 500, 100, true, (v) => v / 100); lab('ot/min × 100', G.r * 0.32, 10);
        needle(G, A0 + (A1 - A0) * U.clamp(ph.rpm / mx, 0, 1), 0.85);
        g.fillStyle = '#0a0a0a'; g.fillRect(-26, G.r * 0.42, 52, 16); g.fillStyle = '#f0f0e0'; g.font = 'bold 12px monospace'; g.textAlign = 'center'; g.fillText(Math.round(ph.rpm), 0, G.r * 0.42 + 9);
        glass(G);
      } else if (G.k === 'g') {
        const lo = -4, hi = 10;
        dial(G); arc(G, A0, A1, lo, hi, -P.nLim * 0.45, P.nLim, '#2ac04a'); arc(G, A0, A1, lo, hi, P.nLim, P.nMax, '#e8c020'); arc(G, A0, A1, lo, hi, P.nMax, hi, '#e02020');
        scale(G, A0, A1, lo, hi, 2, 1, true); lab('G', G.r * 0.32, 13);
        ck.gMax = Math.max(ck.gMax || 1, ph.n); ck.gMin = Math.min(ck.gMin || 1, ph.n);
        const ang = (v) => A0 + (A1 - A0) * (U.clamp(v, lo, hi) - lo) / (hi - lo);
        needle(G, ang(ck.gMax), 0.7, 'rgba(255,170,40,.8)', 2); needle(G, ang(ck.gMin), 0.7, 'rgba(255,170,40,.8)', 2); needle(G, ang(ph.n), 0.86);
        glass(G);
      } else if (G.k === 'fuel' || G.k === 'oil') {
        dial(G); const a0 = -60 * deg, a1 = 60 * deg;
        g.strokeStyle = '#eee'; g.lineWidth = 1.5; for (let k = 0; k <= 4; k++) { const a = a0 + (a1 - a0) * k / 4; g.beginPath(); g.moveTo(Math.sin(a) * G.r * 0.7, -Math.cos(a) * G.r * 0.7 + G.r * 0.25); g.lineTo(Math.sin(a) * G.r * 0.9, -Math.cos(a) * G.r * 0.9 + G.r * 0.25); g.stroke(); }
        let v, t1, t2;
        if (G.k === 'fuel') { ck.fuel = Math.max(0.15, (ck.fuel === undefined ? 0.92 : ck.fuel) - ph.thr * 0.00004); v = ck.fuel; t1 = 'PALIVO'; t2 = '0       1/1'; }
        else { ck.oilT = U.lerp(ck.oilT || 0.35, 0.35 + ph.thr * 0.4 + (ph.V < 25 ? 0.12 : 0), 0.002); v = ck.oilT; t1 = 'OLEJ °C'; t2 = 'stud.   hor.'; arc({ r: G.r * 0.95 }, a0, a1, 0, 1, 0.82, 1, '#e02020', 3); }
        g.save(); g.translate(0, G.r * 0.25); needle({ r: G.r }, a0 + (a1 - a0) * v, 0.85, '#f4f4f0', 2.5); g.restore();
        lab(t1, -G.r * 0.45, 10); lab(t2, G.r * 0.55, 9);
        glass(G);
      } else if (G.k === 'pwr') {
        dial(G); scale(G, A0, A1, 0, 100, 25, 5, true); lab('% plynu', G.r * 0.34, 10);
        needle(G, A0 + (A1 - A0) * ph.thr, 0.82, '#ffcf5a'); glass(G);
      }
    }
    // kontrolky a palubní počítač
    const a = L.ann, t = performance.now() / 1000;
    g.fillStyle = '#0c0d0e'; g.fillRect(a.x, a.y, a.w, a.h - 40); g.strokeStyle = '#3a3a3a'; g.lineWidth = 2; g.strokeRect(a.x, a.y, a.w, a.h - 40);
    // podvozek: 3 světla
    g.font = 'bold 11px Arial'; g.textAlign = 'center'; g.fillStyle = '#aaa'; g.fillText('PODVOZEK', a.x + 60, a.y + 18);
    const gp = ph.gearPos === undefined ? 1 : ph.gearPos;
    for (const [dx, dy] of [[0, 0], [-24, 24], [24, 24]]) {
      const on = gp > 0.98 ? '#2aff5a' : gp > 0.02 ? '#ff3a2a' : '#1a1a1a';
      g.fillStyle = on; g.beginPath(); g.arc(a.x + 60 + dx, a.y + 40 + dy, 9, 0, 7); g.fill(); g.strokeStyle = '#444'; g.stroke();
    }
    if (!P.retract) { g.fillStyle = '#777'; g.font = '10px Arial'; g.fillText('pevný', a.x + 60, a.y + 92); }
    // klapky
    g.fillStyle = '#aaa'; g.font = 'bold 11px Arial'; g.fillText('KLAPKY', a.x + 180, a.y + 18);
    if (P.flapCL.length > 1) {
      g.fillStyle = '#222'; g.fillRect(a.x + 170, a.y + 28, 20, 60);
      g.fillStyle = '#eee'; g.fillRect(a.x + 166, a.y + 28 + ph.flaps * 26, 28, 8);
      g.font = '10px Arial'; g.textAlign = 'left'; ['0', '1', '2'].forEach((s, i) => g.fillText(s, a.x + 198, a.y + 36 + i * 26)); g.textAlign = 'center';
    } else { g.fillStyle = '#777'; g.font = '10px Arial'; g.fillText('nemá', a.x + 180, a.y + 60); }
    // výstražná světla
    const warn = [
      ['PÁD', ph.stall > 0.15 || ph.alpha > P.aStall * 0.9, '#ff2a1a', true], ['PŘETÍŽENÍ', ph.n > P.nLim * 0.95, '#ffaa1a', true],
      ['BRZDY', !!ph.brake, '#ffcf3a'], ['ZEMĚ', ph.onGround, '#3aa0ff'], ['KOUŘ', !!info.smoke, '#e8e8e8'], ['NÍZKO', info.agl < 25 && !ph.onGround, '#ffaa1a', true],
    ];
    warn.forEach(([txt, on, col, blink], i) => {
      const x = a.x + 10 + (i % 3) * 76, y = a.y + 112 + Math.floor(i / 3) * 34, lit = on && (!blink || Math.sin(t * 12) > -0.3);
      g.fillStyle = lit ? col : '#1c1c1c'; g.fillRect(x, y, 68, 26); g.strokeStyle = '#444'; g.strokeRect(x, y, 68, 26);
      g.fillStyle = lit ? '#111' : '#555'; g.font = 'bold 11px Arial'; g.fillText(txt, x + 34, y + 17);
    });
    // LCD: čas závodu, brána, výška nad zemí
    const lx = a.x + 10, ly = a.y + 190;
    g.fillStyle = '#132a18'; g.fillRect(lx, ly, a.w - 20, 92);
    g.fillStyle = '#7aff8a'; g.font = 'bold 22px monospace'; g.textAlign = 'left'; g.fillText(info.time || '0:00.00', lx + 10, ly + 28);
    g.font = 'bold 14px monospace'; g.fillText(info.gate || '', lx + 10, ly + 52);
    g.fillText(`AGL ${Math.round(info.agl)} m`, lx + 10, ly + 76);
    g.textAlign = 'right'; g.fillText(`${Math.round(V)} km/h`, lx + a.w - 30, ly + 76);
    ck.tex.needsUpdate = true;
  },
};
