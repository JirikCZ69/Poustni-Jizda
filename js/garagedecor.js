// garagedecor.js – vybavení drag garáže: regály, motor na stojanu, turbína, raketa, nitro, ponk, plakáty, trofeje, TV…
const GarageDecor = {
  build(sc) {
    const anim = [], R = 13;                       // místnost 26 × 26 m, auto na točně uprostřed
    const M = (c, e) => U.mat(c, e), basic = (c, e) => new THREE.MeshBasicMaterial(Object.assign({ color: c }, e || {}));
    const add = (geo, mat, x, y, z, par, rx, ry, rz) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0); m.receiveShadow = true; (par || sc).add(m); return m; };
    const box = (w, h, d, mat, x, y, z, par, rx, ry, rz) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, par, rx, ry, rz);
    const cyl = (rt, rb, h, mat, x, y, z, par, seg, rx, ry, rz) => add(new THREE.CylinderGeometry(rt, rb, h, seg || 14), mat, x, y, z, par, rx, ry, rz);
    const grp = (x, z, ry, y) => { const g = new THREE.Group(); g.position.set(x, y || 0, z); g.rotation.y = ry || 0; sc.add(g); return g; };
    const canvasMat = (w, h, draw, basicM) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
      const t = new THREE.CanvasTexture(cv); t.anisotropy = 4;
      const m = basicM ? new THREE.MeshBasicMaterial({ map: t }) : new THREE.MeshLambertMaterial({ map: t }); m.userData.cv = cv; m.userData.tex = t; return m;
    };
    const plane = (w, h, mat, x, y, z, ry, par) => add(new THREE.PlaneGeometry(w, h), mat, x, y, z, par, 0, ry);
    const chrome = M(0xc8ccd0), dark = M(0x222222), steel = M(0x6a6e72), red = M(0xb3261e), orange = M(0xe0701a), yellow = M(0xe8b81a);

    // ---------- stěny, podlaha, strop ----------
    const wallM = canvasMat(512, 256, (g, w, h) => {      // betonové tvárnice
      g.fillStyle = '#4a433d'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < w; x += 64) {
        const v = 66 + Math.random() * 14; g.fillStyle = `rgb(${v + 4},${v},${v - 6})`; g.fillRect(x + 2, y + 2, 60, 28);
      }
      for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    });
    wallM.map.wrapS = wallM.map.wrapT = THREE.RepeatWrapping; wallM.map.repeat.set(4, 2);
    for (const [x, z, ry] of [[0, -R, 0], [-R, 0, Math.PI / 2], [R, 0, -Math.PI / 2], [0, R, Math.PI]]) {
      plane(2 * R, 9, wallM, x, 4.5, z, ry);
      const n = new THREE.Vector3(Math.sin(ry), 0, Math.cos(ry)), px = x + n.x * 0.02, pz = z + n.z * 0.02;
      plane(2 * R, 1.1, M(0x2b2522), px, 0.55, pz, ry);                                  // tmavý sokl
      const hz = canvasMat(256, 16, (g, w, h) => { for (let i = -2; i < 20; i++) { g.fillStyle = i % 2 ? '#111' : '#e8b81a'; g.beginPath(); g.moveTo(i * 16, h); g.lineTo(i * 16 + 16, 0); g.lineTo(i * 16 + 32, 0); g.lineTo(i * 16 + 16, h); g.fill(); } });
      hz.map.wrapS = THREE.RepeatWrapping; hz.map.repeat.set(8, 1);
      plane(2 * R, 0.18, hz, px + n.x * 0.01, 1.15, pz + n.z * 0.01, ry);                // výstražný pruh
    }
    // podlahové značení a mastné skvrny
    const floorLine = basic(0xd8b020);
    for (const s of [-1, 1]) { add(new THREE.PlaneGeometry(0.15, 9), floorLine, s * 4.6, 0.012, 0, null, -Math.PI / 2); add(new THREE.PlaneGeometry(9.35, 0.15), floorLine, 0, 0.012, s * 4.6, null, -Math.PI / 2); }
    const stainM = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
    for (let i = 0; i < 14; i++) { const a = Math.random() * 6.28, r = 5 + Math.random() * 6.5, s = 0.3 + Math.random() * 0.9; const st = add(new THREE.CircleGeometry(s, 16), stainM, Math.cos(a) * r, 0.01 + i * 0.0005, Math.sin(a) * r, null, -Math.PI / 2); st.scale.set(1, 0.6 + Math.random() * 0.6, 1); }
    box(0.8, 0.02, 0.8, M(0x1e1e1e), 5.5, 0.01, 5.5);                                  // kanálek
    for (let i = 0; i < 6; i++) box(0.04, 0.025, 0.7, steel, 5.5 - 0.3 + i * 0.12, 0.02, 5.5);
    // strop: příhradové nosníky, zářivky a praporky
    for (const z of [-8, 0, 8]) {
      box(2 * R, 0.25, 0.25, M(0x3a3f44), 0, 8.2, z);
      for (let x = -11; x <= 11; x += 5.5) {
        const lamp = grp(x, z, 0, 7.4);
        cyl(0.02, 0.02, 0.8, dark, 0, 0.4, 0, lamp, 4);
        box(1.6, 0.08, 0.3, M(0x2a2a2a), 0, 0, 0, lamp);
        box(1.5, 0.05, 0.18, basic(0xfff4dc), 0, -0.05, 0, lamp);
      }
    }
    const flagM = [basic(0x111111, { side: THREE.DoubleSide }), basic(0xf2f2f2, { side: THREE.DoubleSide }), basic(0xe0701a, { side: THREE.DoubleSide })];
    for (const [x0, z0, x1, z1] of [[-12, -12, 12, 12], [-12, 12, 12, -12]]) {
      const n = 26;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, x = U.lerp(x0, x1, t), z = U.lerp(z0, z1, t), y = 7.1 - Math.sin(t * Math.PI) * 1.2;
        const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, -0.45, 0], 3));
        add(tri, flagM[i % 3], x, y, z, null, 0, Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2);
      }
    }

    // ---------- zadní stěna: neon, plakáty, děrovaná deska s nářadím, ponk ----------
    const back = grp(0, -R + 0.05, 0);
    const signM = new THREE.MeshBasicMaterial({ map: U.textTexture('DRAG GARÁŽ', 512, 112, '#1a1410', '#ffb347') });
    plane(7, 1.5, signM, 0, 6.1, 0.05, 0, back);
    const neonM = basic(0xff7a2a), neon = [];
    for (const [w, h, x, y] of [[7.4, 0.08, 0, 6.9], [7.4, 0.08, 0, 5.3], [0.08, 1.6, -3.7, 6.1], [0.08, 1.6, 3.7, 6.1]]) neon.push(box(w, h, 0.08, neonM, x, y, 0.12, back));
    anim.push((dt, t) => { const on = Math.sin(t * 23) > -0.97 && !(t % 7 > 6.6 && Math.sin(t * 60) > 0); neonM.color.setHex(on ? 0xff7a2a : 0x5a2a10); signM.color.setScalar(on ? 1 : 0.55); });
    const posters = [
      ['1/4 MÍLE', '402 m · bez brzd', '#e0701a', '#1a0e05', 'check'],
      ['NITRO', 'ještě o kapku víc', '#1a4fa0', '#e8f2ff', 'bolt'],
      ['DRAGSTRIP', 'Poušť · 1987', '#f0e2c0', '#5a2a10', 'sun'],
      ['HLEDÁ SE', 'Pouštní duch', '#d8c8a0', '#2a1a0a', 'ghost'],
    ];
    posters.forEach(([t1, t2, bg, fg, kind], i) => {
      const m = canvasMat(256, 360, (g, w, h) => {
        g.fillStyle = bg; g.fillRect(0, 0, w, h);
        g.fillStyle = fg; g.textAlign = 'center';
        if (kind === 'check') for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2) g.fillRect(x * 32, 250 + y * 27, 32, 27);
        if (kind === 'bolt') { g.beginPath(); g.moveTo(150, 120); g.lineTo(90, 230); g.lineTo(135, 230); g.lineTo(105, 330); g.lineTo(180, 200); g.lineTo(135, 200); g.lineTo(165, 120); g.fill(); }
        if (kind === 'sun') { g.fillStyle = '#e0701a'; g.beginPath(); g.arc(128, 270, 70, Math.PI, 0); g.fill(); g.fillStyle = fg; for (let k = 0; k < 6; k++) g.fillRect(0, 275 + k * 14, w, 5); }
        if (kind === 'ghost') { g.beginPath(); g.arc(128, 220, 60, Math.PI, 0); g.lineTo(188, 320); for (let k = 0; k < 4; k++) g.lineTo(173 - k * 30, k % 2 ? 320 : 300); g.lineTo(68, 320); g.fill(); g.fillStyle = bg; g.fillRect(100, 205, 16, 22); g.fillRect(140, 205, 16, 22); g.fillStyle = fg; g.font = 'bold 22px Arial'; g.fillText('ODMĚNA 50 000 Kč', 128, 352); }
        g.font = 'bold 54px Arial'; g.fillText(t1, 128, 70); g.font = '24px Arial'; g.fillText(t2, 128, 105);
        g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
      });
      plane(1.8, 2.5, m, [-9.5, -6.5, 6.5, 9.5][i], 3.4, 0.03, 0, back).rotation.z = (Math.random() - 0.5) * 0.06;
    });
    // děrovaná deska s nářadím
    const peg = canvasMat(512, 220, (g, w, h) => {
      g.fillStyle = '#7a6448'; g.fillRect(0, 0, w, h); g.fillStyle = '#4a3a28';
      for (let y = 8; y < h; y += 14) for (let x = 8; x < w; x += 14) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
      const tool = (x, y, len, head, col) => { g.fillStyle = col; g.fillRect(x - 3, y, 6, len); g.beginPath(); g.arc(x, y, head, 0, 7); g.fill(); g.fillStyle = '#7a6448'; g.beginPath(); g.arc(x, y - head * 0.4, head * 0.45, 0, 7); g.fill(); };
      for (let i = 0; i < 9; i++) tool(30 + i * 22, 30, 60 + i * 9, 9 + i, '#b8bcc0');
      for (let i = 0; i < 4; i++) { g.fillStyle = ['#c0392b', '#e8b81a', '#2a6ab0', '#c0392b'][i]; g.fillRect(260 + i * 40, 90, 14, 90); g.fillStyle = '#9a9ea2'; g.fillRect(264 + i * 40, 30, 6, 60); }
      g.fillStyle = '#5a3a1a'; g.fillRect(430, 40, 16, 120); g.fillStyle = '#9a9ea2'; g.fillRect(410, 30, 56, 22);
    });
    plane(5.2, 2.2, peg, 0, 2.6, 0.04, 0, back);
    // ponk se svěrákem, turbem a bednou
    box(5.4, 0.12, 1.0, M(0x7a5232), 0, 1.0, 0.6, back);
    for (const x of [-2.5, 2.5]) for (const z of [0.2, 1.0]) box(0.08, 1, 0.08, steel, x, 0.5, z, back);
    box(5.2, 0.06, 0.9, steel, 0, 0.25, 0.6, back);
    box(0.7, 0.45, 0.5, red, -1.9, 1.29, 0.55, back); box(0.72, 0.05, 0.52, M(0x8a1a12), -1.9, 1.53, 0.55, back);   // bedna s nářadím
    box(0.25, 0.2, 0.25, steel, 1.8, 1.16, 0.4, back); box(0.4, 0.12, 0.12, M(0x2a5aa0), 1.8, 1.32, 0.4, back);        // svěrák
    const turbo = grp(0.4, 0, 0); turbo.position.set(0.4, 1.33, 0.7); back.add(turbo);
    add(new THREE.TorusGeometry(0.17, 0.09, 8, 16), M(0x8a8e92), 0, 0, 0, turbo, 0, 0.3); cyl(0.1, 0.1, 0.25, M(0x8a8e92), 0.18, 0, 0, turbo, 12, 0, 0, Math.PI / 2);
    cyl(0.07, 0.07, 0.24, M(0x2a6ab0), -0.6, 1.18, 0.5, back); cyl(0.07, 0.07, 0.24, M(0xc0392b), -0.35, 1.18, 0.75, back); // plechovky oleje
    // zadní roh: auto pod plachtou (další projekt)
    const tarp = grp(-9, -8.6, 0.55);
    const tg = new THREE.BoxGeometry(2, 1.15, 4.4, 6, 3, 10), tp = tg.attributes.position;
    for (let i = 0; i < tp.count; i++) { const x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i); const roof = y > 0 ? 1 - Math.pow(Math.abs(z) / 2.2, 3) * 0.7 : 1; tp.setXYZ(i, x * (y > 0 ? 0.82 : 1.04), y > 0 ? y * roof + 0.35 * (1 - Math.abs(z) / 2.2) + (Math.random() - 0.5) * 0.06 : y, z * 1.02); }
    tg.computeVertexNormals();
    add(tg, M(0x3a4a5a), 0, 0.72, 0, tarp).castShadow = true;
    for (const [x, z] of [[0.95, 1.4], [-0.95, 1.4], [0.95, -1.4], [-0.95, -1.4]]) cyl(0.33, 0.33, 0.22, dark, x, 0.33, z, tarp, 16, 0, 0, Math.PI / 2);

    // ---------- levá stěna: regál se slicky, motor na stojanu, dílenské skříně ----------
    const left = grp(-R + 0.05, 0, Math.PI / 2);
    const rackM = M(0x2a5aa0);
    for (const x of [-9.5, -4.5]) for (const z of [0.15, 1.15]) box(0.1, 3.6, 0.1, rackM, x, 1.8, z, left);
    for (const y of [0.15, 1.35, 2.55]) {
      box(5.1, 0.08, 1.1, rackM, -7, y, 0.65, left);
      for (let i = 0; i < 6; i++) { cyl(0.42, 0.42, 0.42, M(0x161514), -9.1 + i * 0.83, y + 0.47, 0.65, left, 18, 0, 0, Math.PI / 2); }
    }
    const slickTxt = canvasMat(256, 64, (g, w, h) => { g.fillStyle = '#161514'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e2d0'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.fillText('DRAG SLICK', w / 2, 44); });
    plane(5, 0.6, slickTxt, -7, 3.75, 0.12, 0, left);
    // dílenské skříně
    for (let k = 0; k < 2; k++) {
      const cab = grp(0, 0, 0); cab.position.set(3.5 + k * 1.45, 0, 0.45); left.add(cab);
      box(1.4, 1.05, 0.65, red, 0, 0.6, 0, cab); box(1.4, 0.04, 0.7, M(0x3a3a3a), 0, 1.14, 0, cab);
      for (let d = 0; d < 6; d++) { box(1.3, 0.02, 0.01, dark, 0, 0.18 + d * 0.16, 0.33, cab); box(0.5, 0.03, 0.03, chrome, 0, 0.24 + d * 0.16, 0.345, cab); }
      for (const x of [-0.6, 0.6]) cyl(0.05, 0.05, 0.05, dark, x, 0.05, 0.25, cab, 8);
    }
    box(1.2, 1.4, 0.6, red, 4.2, 1.9, 0.35, left);                                   // horní skříňka
    // motor V8 s kompresorem na stojanu
    const eng = grp(-10.9, 3.3, 0.9);
    box(0.08, 0.9, 0.08, orange, 0, 0.45, 0, eng); box(0.9, 0.06, 0.08, orange, 0, 0.03, 0, eng); box(0.08, 0.06, 0.9, orange, 0, 0.03, 0, eng);
    for (const [x, z] of [[-0.45, 0], [0.45, 0], [0, -0.45], [0, 0.45]]) cyl(0.05, 0.05, 0.06, dark, x, 0.03, z, eng, 8);
    const blk = grp(0, 0, 0); blk.position.set(0.55, 1.05, 0); eng.add(blk);
    box(0.9, 0.5, 0.6, M(0x3c4044), 0, 0, 0, blk);
    for (const s of [-1, 1]) {
      box(0.9, 0.22, 0.28, M(0x50555a), 0, 0.3, s * 0.32, blk, s * 0.6);
      box(0.85, 0.08, 0.22, M(0xc0392b), 0, 0.42, s * 0.4, blk, s * 0.6);                 // víka ventilů
      for (let i = 0; i < 4; i++) cyl(0.035, 0.035, 0.35, chrome, -0.3 + i * 0.2, -0.05, s * 0.5, blk, 8, s * 1.1, 0, 0);   // svody
    }
    box(0.6, 0.3, 0.32, M(0x8a8e92), 0, 0.5, 0, blk); box(0.5, 0.18, 0.25, M(0x2a2a2a), 0, 0.72, 0, blk);                  // kompresor + vzduch
    box(0.12, 0.35, 0.42, M(0x6a6e72), 0.5, 0.15, 0, blk);
    cyl(0.12, 0.12, 0.05, chrome, 0.58, 0.15, 0, blk, 14, 0, 0, Math.PI / 2);
    // plakát s kalendářem
    const cal = canvasMat(200, 260, (g, w, h) => { g.fillStyle = '#f2ead8'; g.fillRect(0, 0, w, h); g.fillStyle = '#c0392b'; g.fillRect(0, 0, w, 60); g.fillStyle = '#fff'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.fillText('SRPEN', w / 2, 42); g.fillStyle = '#333'; g.font = '16px Arial'; for (let i = 0; i < 31; i++) g.fillText(i + 1, 22 + (i % 7) * 26, 90 + Math.floor(i / 7) * 34); g.strokeStyle = '#c0392b'; g.lineWidth = 3; g.beginPath(); g.arc(22 + 5 * 26, 90 + 2 * 34 - 6, 14, 0, 7); g.stroke(); });
    plane(0.9, 1.2, cal, 6.5, 3.2, 0.03, 0, left);
    // nástěnný ventilátor
    const fan = grp(0, 0, 0); fan.position.set(9.5, 5.2, 0.35); left.add(fan);
    add(new THREE.TorusGeometry(0.6, 0.04, 6, 24), steel, 0, 0, 0, fan); const blades = new THREE.Group(); fan.add(blades);
    for (let i = 0; i < 4; i++) box(0.5, 0.14, 0.02, M(0x9aa0a6), Math.cos(i * 1.57) * 0.28, Math.sin(i * 1.57) * 0.28, 0, blades, 0, 0.3, i * 1.57);
    anim.push((dt) => { blades.rotation.z += dt * 9; });

    // ---------- pravá stěna: proudový motor, raketa, nitro ----------
    const right = grp(R - 0.05, 0, -Math.PI / 2);
    // proudový motor na podstavci
    const jet = grp(0, 0, 0); jet.position.set(4.5, 1.7, 2.1); right.add(jet);
    for (const x of [-1.1, 1.1]) { box(0.12, 1.2, 0.12, yellow, x, -1.1, 0, jet); box(0.6, 0.08, 0.9, yellow, x, -1.66, 0, jet); }
    const nac = cyl(1.0, 0.85, 3.6, M(0xb8bcc0), 0, 0, 0, jet, 26, 0, 0, Math.PI / 2); nac.castShadow = true;
    add(new THREE.TorusGeometry(1.0, 0.09, 8, 26), M(0x3a3a3a), 1.8, 0, 0, jet, 0, Math.PI / 2);
    add(new THREE.CircleGeometry(0.97, 26), dark, 1.78, 0, 0, jet, 0, Math.PI / 2);
    cyl(0.55, 0.8, 0.6, dark, -2.05, 0, 0, jet, 18, 0, 0, Math.PI / 2);
    const fanJ = new THREE.Group(); fanJ.position.x = 1.75; jet.add(fanJ);
    add(new THREE.ConeGeometry(0.22, 0.4, 12), chrome, 0.12, 0, 0, fanJ, 0, 0, -Math.PI / 2);
    for (let i = 0; i < 14; i++) box(0.03, 0.82, 0.16, M(0x9aa0a6), 0, Math.cos(i / 14 * 6.28) * 0.5, Math.sin(i / 14 * 6.28) * 0.5, fanJ, i / 14 * 6.28, 0.4, 0);
    anim.push((dt) => { fanJ.rotation.x += dt * 3.5; });
    const jetSign = new THREE.MeshLambertMaterial({ map: U.textTexture('TURBÍNA Z DOPRAVNÍHO LETADLA · 120 kN', 512, 48, '#1a1410', '#ffcf86') });
    plane(3, 0.28, jetSign, 0, -1.0, 1.0, 0, jet);
    // raketový booster na stojanu
    const rk = grp(0, 0, 0); rk.position.set(-3, 0, 1.4); right.add(rk);
    const hzb = canvasMat(128, 128, (g, w, h) => { g.fillStyle = '#e8b81a'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; for (let i = -4; i < 8; i++) { g.beginPath(); g.moveTo(i * 32, h); g.lineTo(i * 32 + 16, h); g.lineTo(i * 32 + 16 + h, 0); g.lineTo(i * 32 + h, 0); g.fill(); } });
    box(1.8, 0.25, 1.8, hzb, 0, 0.12, 0, rk);
    const rb = cyl(0.55, 0.55, 5, M(0xece6da), 0, 3.0, 0, rk, 22); rb.castShadow = true;
    for (const y of [1.2, 2.6, 4.0]) cyl(0.57, 0.57, 0.12, red, 0, y, 0, rk, 22);
    add(new THREE.ConeGeometry(0.55, 1.3, 22), red, 0, 6.15, 0, rk);
    cyl(0.4, 0.62, 0.55, dark, 0, 0.52, 0, rk, 18);
    for (let i = 0; i < 4; i++) box(0.05, 1.2, 0.7, red, Math.cos(i * 1.57) * 0.75, 1.3, Math.sin(i * 1.57) * 0.75, rk, 0, -i * 1.57);
    for (const s of [-1, 1]) box(0.1, 3.5, 0.1, steel, s * 0.75, 1.9, -0.55, rk);
    const warn = canvasMat(256, 96, (g, w, h) => { g.fillStyle = '#e8b81a'; g.fillRect(0, 0, w, h); g.fillStyle = '#111'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.fillText('⚠ NEZAPALOVAT', w / 2, 40); g.font = '20px Arial'; g.fillText('V GARÁŽI', w / 2, 72); });
    plane(1.3, 0.5, warn, 0, 1.0, 0.95, 0, rk);
    // stojan s nitro lahvemi
    const nitro = grp(0, 0, 0); nitro.position.set(-8.5, 0, 0.5); right.add(nitro);
    box(2.6, 0.08, 0.6, steel, 0, 0.04, 0, nitro); box(2.6, 0.06, 0.06, steel, 0, 1.0, -0.1, nitro);
    for (let i = 0; i < 5; i++) { cyl(0.16, 0.16, 1.3, M(0x1a4fa0), -1 + i * 0.5, 0.73, 0, nitro, 16).castShadow = true; cyl(0.06, 0.08, 0.16, chrome, -1 + i * 0.5, 1.46, 0, nitro, 10); }
    const nos = new THREE.MeshBasicMaterial({ map: U.textTexture('NITRO', 256, 64, '#0a1a3a', '#7ad0ff') });
    plane(1.6, 0.4, nos, 0, 2.2, -0.25, 0, nitro);
    anim.push((dt, t) => { nos.color.setScalar(0.75 + 0.25 * Math.sin(t * 3)); });
    // hasicí přístroj
    cyl(0.12, 0.12, 0.55, red, 8.5, 1.3, 0.2, right, 12); box(0.18, 0.06, 0.08, dark, 8.5, 1.62, 0.25, right);

    // ---------- přední stěna: vrata, sudy, kompresor, trofeje, TV ----------
    const front = grp(0, R - 0.05, Math.PI);
    const door = canvasMat(256, 256, (g, w, h) => { for (let y = 0; y < h; y += 16) { const gr = g.createLinearGradient(0, y, 0, y + 16); gr.addColorStop(0, '#9aa0a4'); gr.addColorStop(0.5, '#c4c8cc'); gr.addColorStop(1, '#6a7074'); g.fillStyle = gr; g.fillRect(0, y, w, 16); } });
    plane(7, 5, door, 0, 2.5, 0.03, 0, front);
    for (const x of [-3.6, 3.6]) box(0.2, 5.2, 0.15, hzb, x, 2.6, 0.06, front); box(7.4, 0.2, 0.15, hzb, 0, 5.1, 0.06, front);
    plane(6.8, 0.06, basic(0xfff2d0), 0, 0.03, 0.08, 0, front);                       // denní světlo pod vraty
    // sudy
    [[-6, 0.5, 0x2a6ab0], [-6.9, 0.6, 0xe0701a], [-6.45, 1.0, 0x3a6a3a]].forEach(([x, z, c], i) => cyl(0.32, 0.32, 0.9, M(c), x, i === 2 ? 1.35 : 0.45, z, front, 16).castShadow = true);
    // kompresor
    cyl(0.3, 0.3, 1.1, red, -9, 0.4, 0.5, front, 16, 0, 0, Math.PI / 2); box(0.4, 0.3, 0.3, dark, -9, 0.9, 0.5, front); cyl(0.12, 0.12, 0.08, chrome, -8.6, 0.95, 0.68, front, 12, Math.PI / 2);
    // police s trofejemi
    const gold = M(0xd4a020, { emissive: 0x2a1a00 }), silver = M(0xc8ccd0), bronze = M(0xa86a30);
    for (const y of [1.6, 2.6]) box(3.2, 0.08, 0.45, M(0x6a4a2a), 6.5, y, 0.25, front);
    [[5.2, 1.64, gold, 1.2], [6.0, 1.64, silver, 0.9], [6.8, 1.64, bronze, 0.8], [7.6, 1.64, gold, 1.0], [5.6, 2.64, silver, 0.8], [6.6, 2.64, gold, 1.4], [7.6, 2.64, bronze, 0.7]].forEach(([x, y, m, s]) => {
      const tr = grp(0, 0, 0); tr.position.set(x, y, 0.25); tr.scale.setScalar(s); front.add(tr);
      box(0.2, 0.08, 0.2, M(0x2a2a2a), 0, 0.04, 0, tr); cyl(0.025, 0.04, 0.15, m, 0, 0.15, 0, tr, 8);
      add(new THREE.CylinderGeometry(0.12, 0.04, 0.2, 14, 1, true), m, 0, 0.32, 0, tr).material.side = THREE.DoubleSide;
      add(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), m, 0.12, 0.33, 0, tr, 0, 0, -Math.PI / 2);
      add(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), m, -0.12, 0.33, 0, tr, 0, 0, Math.PI / 2);
    });
    // televize se statistikami hráče
    const tv = canvasMat(512, 288, () => {}, true);
    box(2.5, 1.5, 0.12, M(0x111111), -6.3, 3.6, 0.1, front);
    plane(2.35, 1.33, tv, -6.3, 3.6, 0.17, 0, front);
    // ---------- drobnosti kolem točny ----------
    const cone = (x, z) => { const c = grp(x, z, 0); box(0.4, 0.04, 0.4, orange, 0, 0.02, 0, c); add(new THREE.ConeGeometry(0.15, 0.55, 12), orange, 0, 0.3, 0, c); cyl(0.105, 0.125, 0.1, M(0xf2f2f2), 0, 0.26, 0, c, 12); };
    cone(5.6, -5.2); cone(6.2, -4.6); cone(-6, 5.4);
    const jack = grp(-6.3, -4.2, 0.8); box(1.1, 0.12, 0.35, red, 0, 0.12, 0, jack); cyl(0.06, 0.06, 0.9, dark, -0.8, 0.45, 0, jack, 8, 0, 0, 0.8); for (const [x, z] of [[0.45, 0.15], [0.45, -0.15], [-0.4, 0.15], [-0.4, -0.15]]) cyl(0.06, 0.06, 0.05, dark, x, 0.06, z, jack, 8, Math.PI / 2);
    const creeper = grp(6.4, 4.4, -0.4); box(0.5, 0.05, 1.2, M(0x2a5aa0), 0, 0.12, 0, creeper); box(0.4, 0.06, 0.22, M(0x1a1a1a), 0, 0.17, 0.45, creeper);
    for (const [x, z] of [[0.2, 0.5], [-0.2, 0.5], [0.2, -0.5], [-0.2, -0.5]]) cyl(0.04, 0.04, 0.05, dark, x, 0.05, z, creeper, 8, Math.PI / 2);
    const spare = cyl(0.42, 0.42, 0.35, M(0x161514), -5.2, 0.45, 6.2, null, 18, 0, 0.3, 0.25); spare.castShadow = true;
    cyl(0.25, 0.25, 0.36, chrome, -5.2, 0.45, 6.2, null, 14, 0, 0.3, 0.25);
    // ---------- světla ----------
    const warm = new THREE.PointLight(0xffc890, 0.8, 14); warm.position.set(0, 4, -10); sc.add(warm);
    const cool = new THREE.PointLight(0x80c8ff, 0.7, 14); cool.position.set(9, 4, -4); sc.add(cool);
    const fl = new THREE.PointLight(0xffe0b0, 0.5, 16); fl.position.set(-8, 5, 6); sc.add(fl);
    this.ctx = { anim, tv, t: 0 };
    return this.ctx;
  },
  // TV na stěně: aktuální auto a profil hráče
  drawTv(lines, ctx) {
    const tvm = (ctx || this.ctx || {}).tv; if (!tvm) return;
    const cv = tvm.userData.cv, g = cv.getContext('2d'), w = cv.width, h = cv.height;
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0e1a2a'); gr.addColorStop(1, '#04080e'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffb347'; g.font = 'bold 34px Arial'; g.fillText('📺 DRAG TV', 22, 48);
    g.font = 'bold 30px Arial';
    lines.forEach((l, i) => { g.fillStyle = i === 0 ? '#7ad0ff' : '#e8f2ff'; g.fillText(l, 22, 100 + i * 46); });
    g.fillStyle = 'rgba(255,255,255,.04)'; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 2);
    tvm.userData.tex.needsUpdate = true;
  },
  update(dt, ctx) { ctx = ctx || this.ctx; if (!ctx) return; ctx.t += dt; for (const f of ctx.anim) f(dt, ctx.t); },
};
