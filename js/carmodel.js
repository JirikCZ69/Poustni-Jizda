// carmodel.js – low-poly model auta: tvarované boky s podběhy, odpružení, motorový prostor, interiér a přístroje
// Lokální osy auta: +z dopředu, +x doleva, y nahoru. Počátek = zem uprostřed mezi nápravami.
const WHEEL_R = 0.36, ARCH_R = 0.47, BODY_Y0 = 0.38, BODY_Y1 = 0.91, SPRING_TOP = 0.86;
const SLOT_POS = {
  engine: { p: [0, 0.3, 1.3], s: 0.78, ghost: [0.36, 0.45, 0.5] },
  gearbox: { p: [0, 0.2, 0.93], ghost: [0.3, 0.26, 0.4] },
  battery: { p: [-0.42, 0.32, 1.86], ghost: [0.32, 0.25, 0.18] },
  starter: { p: [-0.27, 0.3, 1.12], ghost: [0.14, 0.14, 0.24] },
  alternator: { p: [0.2, 0.48, 1.56], ghost: [0.12, 0.18, 0.18] },
  plugs: { p: [0, 0.74, 1.3], ry: Math.PI / 2, ghost: [0.06, 0.1, 0.24] },
  carb: { p: [-0.13, 0.7, 1.2], ghost: [0.14, 0.1, 0.14] },
  airfilter: { p: [-0.13, 0.8, 1.2], ghost: [0.28, 0.05, 0.28] },
  fuelpump: { p: [0.3, 0.36, 1.0], ghost: [0.1, 0.13, 0.1] },
  radiator: { p: [0, 0.36, 2.0], ghost: [0.7, 0.5, 0.07] },
  belt: { p: [0, 0.46, 1.6], ghost: [0.22, 0.22, 0.03] },
};
const CarModel = {
  tag(obj, zone) { obj.traverse(o => { o.userData.zone = zone; }); },
  outlineMat: new THREE.LineBasicMaterial({ color: 0x1a120c }),
  outline(m) {
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 28), this.outlineMat);
    l.raycast = () => {}; l.userData.zone = m.userData.zone; m.add(l);
  },
  // textury pneumatik (dezén a bok s nápisem) – vytvořené jednou a sdílené
  tireMats() {
    if (this._tm) return this._tm;
    const tread = document.createElement('canvas'); tread.width = 256; tread.height = 64;
    let g = tread.getContext('2d');
    g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, 256, 64);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = '#2e2e2e'; g.fillRect(i * 16 + 2, 4, 6, 24); g.fillRect(i * 16 + 10, 36, 6, 24);
      g.fillStyle = '#111'; g.fillRect(i * 16, 30, 16, 4);
    }
    const side = document.createElement('canvas'); side.width = 256; side.height = 256;
    g = side.getContext('2d');
    g.fillStyle = '#202020'; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#2c2c2c'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 118, 0, 7); g.stroke();
    g.strokeStyle = '#151515'; g.lineWidth = 3; g.beginPath(); g.arc(128, 128, 84, 0, 7); g.stroke();
    g.fillStyle = '#8a8478'; g.font = 'bold 20px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const txt = 'DESERT RUNNER  •  235/75 R15  •  ';
    for (let i = 0; i < txt.length; i++) {
      const a = i / txt.length * Math.PI * 2;
      g.save(); g.translate(128 + Math.cos(a) * 101, 128 + Math.sin(a) * 101); g.rotate(a + Math.PI / 2); g.fillText(txt[i], 0, 0); g.restore();
    }
    const tt = new THREE.CanvasTexture(tread); tt.wrapS = THREE.RepeatWrapping; tt.repeat.set(3, 1);
    const st = new THREE.CanvasTexture(side);
    this._tm = [new THREE.MeshLambertMaterial({ map: tt }), new THREE.MeshLambertMaterial({ map: st }), new THREE.MeshLambertMaterial({ map: st })];
    return this._tm;
  },
  // bok karoserie jako vytažený tvar s vykrojeným podběhem
  sidePanel(z0, z1, archC) {
    const s = new THREE.Shape(), a = Math.asin((BODY_Y0 - WHEEL_R) / ARCH_R), dz = Math.cos(a) * ARCH_R;
    s.moveTo(z0, BODY_Y0);
    if (archC !== null) { s.lineTo(archC - dz, BODY_Y0); s.absarc(archC, WHEEL_R, ARCH_R, Math.PI - a, a, true); }
    s.lineTo(z1, BODY_Y0); s.lineTo(z1, BODY_Y1); s.lineTo(z0, BODY_Y1); s.lineTo(z0, BODY_Y0);
    return new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: false, curveSegments: 14 });
  },
  spring() {
    if (this._spr) return this._spr;
    const pts = [];
    for (let i = 0; i <= 96; i++) { const t = i / 96, a = t * Math.PI * 2 * 6; pts.push(new THREE.Vector3(Math.cos(a) * 0.05, t, Math.sin(a) * 0.05)); }
    this._spr = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.009, 4, false);
    return this._spr;
  },

  build(paint, body) {
    const root = new THREE.Group();
    const parts = { root, wheels: [], steerPivots: [], debris: [], slots: {}, ghosts: {} };
    const P = U.mat(paint); parts.paintMat = P; parts.cosm = {}; parts.cabin = [];   // cabin = prosklená nástavba (autosalon ji může vyměnit za jiný tvar)
    const dark = U.mat(0x2a2a2a), chrome = U.mat(0xc8c8be), rust = U.mat(0x8a4a28), bay = U.mat(0x5e5850);
    const trim = U.mat(0x2a2622), under = U.mat(0x2e2a26);
    parts.bayLight = new THREE.PointLight(0xfff0d0, 0, 2.6, 1.5);
    parts.bayLight.position.set(0, 1.25, 1.35); root.add(parts.bayLight);
    const glass = parts.glassMat = new THREE.MeshLambertMaterial({ color: 0x9fc6d0, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide });
    const add = (geo, mat, x, y, z, rx, ry, rz, parent, ext, zone) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, rz || 0, 'YXZ');
      m.castShadow = true; m.receiveShadow = true; m.userData.zone = zone || 'body'; (parent || root).add(m);
      if (ext !== false) { parts.debris.push(m); CarModel.outline(m); }
      return m;
    };
    const box = (w, h, d, mat, x, y, z, rx, ry, rz, parent, ext, zone) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz, parent, ext, zone);
    const cyl = (r, h, mat, x, y, z, rx, ry, rz, seg, ext, zone) => add(new THREE.CylinderGeometry(r, r, h, seg || 10), mat, x, y, z, rx, ry, rz, null, ext, zone);

    // --- boky s podběhy (předek / dveře / záď) ---
    for (const s of [1, -1]) {
      const px = s > 0 ? 0.91 : -0.84;
      add(this.sidePanel(0.725, 2.15, 1.3), P, px, 0, 0, 0, -Math.PI / 2, 0, null, true, 'bay');
      add(this.sidePanel(-2.15, -0.8, -1.3), P, px, 0, 0, 0, -Math.PI / 2, 0, null, true, 'trunk');
      box(0.07, BODY_Y1 - BODY_Y0, 1.525, P, s * 0.875, (BODY_Y0 + BODY_Y1) / 2, -0.0375);           // dveře
      box(0.09, 0.5, 0.012, dark, s * 0.875, 0.64, 0.69, 0, 0, 0, null, false);                       // spáry dveří
      box(0.09, 0.5, 0.012, dark, s * 0.875, 0.64, -0.77, 0, 0, 0, null, false);
      box(0.025, 0.03, 0.14, chrome, s * 0.922, 0.82, -0.45, 0, 0, 0, null, false);                   // klika
      box(0.02, 0.02, 1.5, chrome, s * 0.918, 0.89, -0.04, 0, 0, 0, null, false);                     // lišta
      // lemy podběhů a vany kol
      for (const zc of [1.3, -1.3]) {
        add(new THREE.TorusGeometry(ARCH_R + 0.02, 0.035, 4, 16, Math.PI), trim, s * 0.9, WHEEL_R, zc, 0, Math.PI / 2, 0, null, false, zc > 0 ? 'bay' : 'trunk');
        const tub = new THREE.Mesh(new THREE.CylinderGeometry(ARCH_R, ARCH_R, 0.32, 14, 1, true, 0, Math.PI), new THREE.MeshLambertMaterial({ color: 0x1e1b18, side: THREE.DoubleSide }));
        tub.rotation.z = Math.PI / 2; tub.position.set(s * 0.71, WHEEL_R, zc); tub.userData.zone = zc > 0 ? 'bay' : 'trunk'; root.add(tub);
        // vnitřní stěna podběhu – zevnitř auta už nejsou vidět kola
        const cap = new THREE.Mesh(new THREE.CircleGeometry(ARCH_R, 14, 0, Math.PI), tub.material);
        cap.rotation.y = Math.PI / 2; cap.position.set(s * 0.55, WHEEL_R, zc); cap.userData.zone = tub.userData.zone; root.add(cap);
      }
      box(0.14, 0.03, 0.03, P, s * 0.96, 0.97, 0.62, 0, 0, 0, null, false);                         // držák zrcátka
      box(0.08, 0.1, 1.55, under, s * 0.86, 0.357, -0.04, 0, 0, 0, null, false);                       // práh
      // boční okno přesně v rámu (šikmý A-sloupek vpředu, C-sloupek vzadu)
      const ws = new THREE.Shape();
      ws.moveTo(-0.7, 0.925); ws.lineTo(0.7, 0.925); ws.lineTo(0.465, 1.465); ws.lineTo(-0.7, 1.465); ws.lineTo(-0.7, 0.925);
      const win = new THREE.Mesh(new THREE.ShapeGeometry(ws), glass); win.rotation.y = -Math.PI / 2; win.position.x = s * 0.86; root.add(win); parts.cabin.push(win);
      parts.cabin.push(box(0.05, 0.54, 0.05, P, s * 0.85, 1.195, -0.12));                                 // B-sloupek
      parts.cabin.push(box(0.03, 0.03, 1.36, chrome, s * 0.85, 1.47, -0.2, 0, 0, 0, null, false));      // okap
    }
    // --- předek ---
    box(1.1, 0.04, 1.3, under, 0, 0.3, 1.45, 0, 0, 0, null, false, 'bay');                           // dno
    box(1.68, BODY_Y1 - BODY_Y0, 0.1, P, 0, (BODY_Y0 + BODY_Y1) / 2, 2.1, 0, 0, 0, null, true, 'bay'); // čelo
    box(1.7, 0.56, 0.06, bay, 0, 0.63, 0.77, 0, 0, 0, null, false, 'bay');                           // přepážka
    box(1.67, 0.04, 0.1, P, 0, 0.93, 0.73, 0, 0, 0, null, false, 'bay');                            // torpédo
    box(1.0, 0.24, 0.03, dark, 0, 0.7, 2.165, 0, 0, 0, null, false, 'bay');                          // maska
    for (let i = -4; i <= 4; i++) box(0.018, 0.22, 0.02, chrome, i * 0.11, 0.7, 2.185, 0, 0, 0, null, false, 'bay');
    for (const sx of [-0.66, 0.66]) {
      cyl(0.11, 0.05, parts.headMat = parts.headMat || new THREE.MeshLambertMaterial({ color: 0xfff6d8, emissive: 0x000000 }), sx, 0.72, 2.17, Math.PI / 2, 0, 0, 14, false, 'bay');
      add(new THREE.TorusGeometry(0.115, 0.016, 4, 16), chrome, sx, 0.72, 2.195, 0, 0, 0, null, false, 'bay');
      box(0.1, 0.05, 0.03, U.mat(0xe08a20), sx * 1.25, 0.55, 2.17, 0, 0, 0, null, false, 'bay');   // blinkr
    }
    box(1.86, 0.16, 0.18, chrome, 0, 0.46, 2.24, 0, 0, 0, null, true, 'bay');                        // nárazníky
    box(1.86, 0.16, 0.18, chrome, 0, 0.46, -2.24, 0, 0, 0, null, true, 'trunk');
    box(0.012, 0.12, 0.22, rust, 0.92, 0.47, 1.98, 0, 0, 0, null, false, 'bay');                      // rez
    box(0.012, 0.1, 0.38, rust, 0.92, 0.45, -0.3, 0, 0, 0, null, false);
    box(0.012, 0.09, 0.25, rust, -0.92, 0.5, -1.95, 0, 0, 0, null, false, 'trunk');
    box(0.04, 0.03, 1.2, under, 0.15, 0.27, 1.0, 0, 0, 0, null, false);                              // podvozek
    cyl(0.035, 3.2, U.mat(0x4a4540), -0.35, 0.24, -0.6, Math.PI / 2, 0, 0, 6, false);               // výfuk
    box(0.28, 0.16, 0.6, U.mat(0x3a3530), -0.33, 0.26, -1.25, 0, 0, 0, null, false);                 // tlumič výfuku
    box(0.8, 0.22, 0.5, under, 0.2, 0.32, -0.55, 0, 0, 0, null, false);                              // nádrž
    // kapota na pantu
    parts.hood = new THREE.Group(); parts.hood.position.set(0, 0.95, 0.78); root.add(parts.hood);
    box(1.72, 0.06, 1.4, P, 0, 0, 0.7, 0, 0, 0, parts.hood, true, 'hood');
    box(1.5, 0.02, 1.2, U.mat(0x4a4038), 0, -0.04, 0.7, 0, 0, 0, parts.hood, false, 'hood');
    box(0.03, 0.03, 0.7, chrome, 0.5, -0.058, 0.4, 0, 0, 0, parts.hood, false, 'hood');
    parts.hoodProp = parts.hood.children[2];
    // --- záď ---
    box(1.68, BODY_Y1 - BODY_Y0, 0.1, P, 0, (BODY_Y0 + BODY_Y1) / 2, -2.1, 0, 0, 0, null, true, 'trunk');
    box(1.1, 0.04, 1.3, under, 0, 0.4, -1.5, 0, 0, 0, null, false, 'trunk');
    box(1.7, 0.06, 0.9, P, 0, 0.94, -1.67, 0, 0, 0, null, true, 'trunk');                            // víko kufru
    box(1.7, 0.06, 0.38, P, 0, 0.94, -1.02);                                                         // zadní plato
    box(0.5, 0.25, 0.01, rust, 0.5, 0.6, -2.157, 0, 0, 0, null, false, 'trunk');
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.12), new THREE.MeshLambertMaterial({ map: U.textTexture('PJ·1987', 256, 64, '#e8e0c0', '#1a1a1a') }));
    plate.position.set(0, 0.68, -2.158); plate.rotation.y = Math.PI; plate.userData.zone = 'trunk'; root.add(plate);
    cyl(0.06, 0.02, U.mat(0x111111), -0.92, 0.78, -1.95, 0, 0, Math.PI / 2, 10, false, 'body');    // víčko nádrže
    parts.tailMat = new THREE.MeshLambertMaterial({ color: 0x8a1010, emissive: 0x000000 });
    for (const sx of [-0.62, 0.62]) box(0.32, 0.12, 0.05, parts.tailMat, sx, 0.78, -2.165, 0, 0, 0, null, false, 'trunk');
    // --- kabina ---
    parts.cabin.push(
      box(0.07, 0.62, 0.08, P, 0.8, 1.2, 0.6, -0.45),
      box(0.07, 0.62, 0.08, P, -0.8, 1.2, 0.6, -0.45),
      box(0.1, 0.58, 0.3, P, 0.8, 1.2, -0.84),
      box(0.1, 0.58, 0.3, P, -0.8, 1.2, -0.84),
      box(1.68, 0.07, 1.36, P, 0, 1.5, -0.2),
      box(1.6, 0.64, 0.02, glass, 0, 1.2, 0.6, -0.45, 0, 0, null, false),                              // čelní sklo
      box(1.6, 0.6, 0.02, glass, 0, 1.2, -0.95, 0.35, 0, 0, null, false));                              // zadní sklo
    parts.spot = new THREE.SpotLight(0xfff0cc, 0, 90, 0.55, 0.5, 1.3);
    parts.spot.position.set(0, 0.8, 2.2); root.add(parts.spot);
    parts.spot.target.position.set(0, -1.5, 22); root.add(parts.spot.target);

    // --- kola s odpružením ---
    const tm = this.tireMats();
    const tGeo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.26, 20), rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.27, 14);
    const spokeGeo = new THREE.BoxGeometry(0.03, 0.17, 0.045), capGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.29, 10);
    const springMat = U.mat(0xd8a020), shockMat = U.mat(0x333333), armMat = U.mat(0x3a3a3a);
    const shockGeo = new THREE.CylinderGeometry(0.022, 0.022, 1, 6); shockGeo.translate(0, 0.5, 0);
    [[0.78, 1.3], [-0.78, 1.3], [0.78, -1.3], [-0.78, -1.3]].forEach(([x, z], i) => {
      const sgn = Math.sign(x);
      const pivot = new THREE.Group(); pivot.position.set(x, WHEEL_R, z); root.add(pivot);
      const spin = new THREE.Group(); pivot.add(spin);
      const t = new THREE.Mesh(tGeo, tm); t.rotation.z = Math.PI / 2; t.castShadow = true; spin.add(t); CarModel.outline(t);
      const rimMat = U.mat(0x9a9a92);
      const rim = new THREE.Mesh(rimGeo, rimMat); rim.rotation.z = Math.PI / 2; spin.add(rim);
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2, sp = new THREE.Mesh(spokeGeo, chrome);
        sp.position.set(sgn * 0.13, Math.cos(a) * 0.1, Math.sin(a) * 0.1); sp.rotation.x = a; spin.add(sp);
      }
      const cap = new THREE.Mesh(capGeo, chrome); cap.rotation.z = Math.PI / 2; spin.add(cap);
      CarModel.tag(pivot, 'tire:' + i);
      // pružina + tlumič + rameno
      const susp = new THREE.Group(); susp.position.set(sgn * 0.6, WHEEL_R, z); susp.scale.y = SPRING_TOP - WHEEL_R; root.add(susp);
      susp.add(new THREE.Mesh(this.spring(), springMat));
      susp.add(new THREE.Mesh(shockGeo, shockMat));
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.08), armMat); arm.position.set(sgn * 0.42, WHEEL_R - 0.04, z); root.add(arm);
      parts.wheels.push({ pivot, spin, rimMat, front: z > 0, susp, arm, x, z });
      if (z > 0) parts.steerPivots.push(pivot);
      parts.debris.push(t);
    });
    parts.axle = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.08), armMat); parts.axle.position.set(0, WHEEL_R, -1.3); root.add(parts.axle);
    parts.diff = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), armMat); parts.diff.position.set(0, WHEEL_R, -1.3); root.add(parts.diff);

    // --- interiér ---
    const intM = U.mat(0x3a302a), seatM = U.mat(0x5a3d2a);
    box(1.66, 0.24, 0.4, intM, 0, 0.9, 0.70, 0, 0, 0, null, false);                                 // palubka
    box(0.7, 0.27, 0.04, intM, 0.38, 0.95, 0.515, 0, 0, 0, null, false);                            // zadní stěna budíků
    for (const sx of [0.4, -0.4]) {
      box(0.5, 0.14, 0.5, seatM, sx, 0.52, -0.35, 0, 0, 0, null, false);
      box(0.5, 0.6, 0.12, seatM, sx, 0.85, -0.62, 0.15, 0, 0, null, false);
    }
    box(0.22, 0.25, 0.9, intM, 0, 0.5, -0.15, 0, 0, 0, null, false);
    box(0.3, 0.22, 0.15, intM, 0, 0.62, 0.56, -0.3, 0, 0, null, false);
    box(0.05, 0.3, 1.5, intM, 0.8, 0.78, -0.1, 0, 0, 0, null, false);
    box(0.05, 0.3, 1.5, intM, -0.8, 0.78, -0.1, 0, 0, 0, null, false);
    box(1.62, 0.55, 0.05, intM, 0, 0.67, -0.86, 0, 0, 0, null, false);   // zadní přepážka
    box(1.74, 0.04, 1.72, U.mat(0x2a2420), 0, 0.33, -0.06, 0, 0, 0, null, false);                    // podlaha kabiny (koberec)
    box(1.6, 0.04, 0.3, intM, 0, 0.94, -1.0, 0, 0, 0, null, false);                                // odkládací police
    // --- zrcátka se skutečným obrazem (render do textury z kamery v místě zrcátka) ---
    const EYE = new THREE.Vector3(0.38, 1.25, -0.3);
    parts.mirrors = [];
    const mirror = (pos, w, hgt, rear, rtW, rtH, fov, mat) => {
      const toEye = EYE.clone().sub(pos).normalize(), n = toEye.clone().add(rear.clone().normalize()).normalize();
      const g = new THREE.Group(); g.position.copy(pos); root.add(g); g.lookAt(pos.clone().add(n));
      const hs = new THREE.Mesh(new THREE.BoxGeometry(w + 0.035, hgt + 0.035, 0.05), mat); hs.position.z = -0.028; hs.castShadow = true; g.add(hs);
      const rt = new THREE.WebGLRenderTarget(rtW, rtH);
      rt.texture.wrapS = THREE.RepeatWrapping; rt.texture.repeat.x = -1; rt.texture.offset.x = 1;
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(w, hgt), new THREE.MeshBasicMaterial({ map: rt.texture })); gl.position.z = 0.002; g.add(gl);
      const d = pos.clone().sub(EYE).normalize(), rdir = d.clone().sub(n.clone().multiplyScalar(2 * d.dot(n)));
      const cam = new THREE.PerspectiveCamera(fov, w / hgt, 0.2, 500); cam.position.copy(pos); root.add(cam); cam.lookAt(pos.clone().add(rdir));
      parts.mirrors.push({ cam, rt, glass: gl });
    };
    mirror(new THREE.Vector3(1.05, 1.0, 0.6), 0.17, 0.11, new THREE.Vector3(0.12, 0, -1), 256, 168, 32, P);
    mirror(new THREE.Vector3(-1.05, 1.0, 0.6), 0.17, 0.11, new THREE.Vector3(-0.12, 0, -1), 256, 168, 32, P);
    mirror(new THREE.Vector3(0, 1.39, 0.47), 0.27, 0.075, new THREE.Vector3(0, -0.03, -1), 512, 142, 26, dark);
    const mkCanvas = (w, h, pw, ph, x, y, z, rx, ry) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.set(x, y, z); m.rotation.set(rx, ry, 0, 'YXZ'); m.userData.zone = 'body'; root.add(m);
      return { cv, tex };
    };
    // budíky nad volantem (celé vidět), diagnostika vedle nich natočená k řidiči
    const d1 = mkCanvas(1024, 400, 0.66, 0.258, 0.38, 0.94, 0.44, -0.25, Math.PI);
    parts.dashCanvas = d1.cv; parts.dashTex = d1.tex;
    const d2 = mkCanvas(512, 440, 0.3, 0.258, -0.1, 0.92, 0.36, -0.25, 2.62);
    parts.diagCanvas = d2.cv; parts.diagTex = d2.tex;
    // autorádio v palubní desce (natočené k řidiči): displej, knoflík zap/hlasitost, ladění a 4 předvolby (ovládá se pohledem + E / klikem, kolečko = hlasitost)
    {
      const rg = new THREE.Group(); rg.position.set(-0.53, 0.86, 0.45); rg.rotation.set(-0.12, 2.6, 0, 'YXZ'); rg.scale.setScalar(1.4); root.add(rg);
      const rb = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.105, 0.03), U.mat(0x161412)); rb.position.z = -0.014; rg.add(rb);
      const cv = document.createElement('canvas'); cv.width = 384; cv.height = 140;
      const tex = new THREE.CanvasTexture(cv);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.158, 0.058), new THREE.MeshBasicMaterial({ map: tex })); scr.position.set(0, 0.014, 0.002); rg.add(scr);
      const knobM = U.mat(0x8a8a86), btnM = U.mat(0x2e2a26), meshes = [];
      const knob = (x, act) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.022, 12), knobM); k.rotation.x = Math.PI / 2; k.position.set(x, 0.006, 0.01); k.userData.radio = act; rg.add(k); meshes.push(k); return k; };
      const kp = knob(-0.112, 'power'), kt = knob(0.112, 'tune');
      scr.userData.radio = 'tune'; meshes.push(scr);
      const btns = [];
      for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.013, 0.01), btnM); b.position.set(-0.054 + i * 0.036, -0.032, 0.004); b.userData.radio = 'st' + i; rg.add(b); meshes.push(b); btns.push(b); }
      parts.radio = { group: rg, cv, tex, meshes, kp, kt, btns, btnM, btnOn: U.mat(0xffb347) };
    }
    parts.wheelGrp = new THREE.Group(); parts.wheelGrp.position.set(0.38, 0.83, 0.2); parts.wheelGrp.rotation.x = -0.35; root.add(parts.wheelGrp);
    parts.wheelGrp.add(new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 16), U.mat(0x1d1a18)));
    for (const a of [Math.PI, 1.2, -1.2]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.015), U.mat(0x1d1a18));
      s.position.set(Math.sin(a) * 0.08, -Math.cos(a) * 0.08, 0); s.rotation.z = -a; parts.wheelGrp.add(s);
    }
    box(0.07, 0.07, 0.25, U.mat(0x1d1a18), 0.38, 0.8, 0.33, -0.35, 0, 0, null, false);
    parts.gearStick = new THREE.Group(); parts.gearStick.position.set(0, 0.63, 0.1); root.add(parts.gearStick);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.25, 5), chrome); st.position.y = 0.12; parts.gearStick.add(st);
    const kn = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), U.mat(0x111111)); kn.position.y = 0.25; parts.gearStick.add(kn);
    parts.hbLever = new THREE.Group(); parts.hbLever.position.set(0.02, 0.64, -0.32); root.add(parts.hbLever);
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.28), U.mat(0x222222)); hl.position.z = 0.13; parts.hbLever.add(hl);
    if (body && typeof Dealer !== 'undefined') Dealer.kit(parts, body, P);   // vzhled auta z autosalonu
    root.traverse(o => { if (!o.userData.zone) o.userData.zone = 'body'; });

    // --- sloty dílů + "duchové" prázdných míst ---
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.22, depthWrite: false });
    for (const [name, sp] of Object.entries(SLOT_POS)) {
      const g = new THREE.Group(); g.position.set(...sp.p); if (sp.ry) g.rotation.y = sp.ry; if (sp.s) g.scale.setScalar(sp.s);
      root.add(g); parts.slots[name] = g;
      const gh = new THREE.Mesh(new THREE.BoxGeometry(...sp.ghost), ghostMat);
      gh.position.set(sp.p[0], sp.p[1] + sp.ghost[1] / 2, sp.p[2]); gh.userData.zone = 'slot:' + name;
      root.add(gh); parts.ghosts[name] = gh;
    }
    return parts;
  },

  // ---------- kosmetika ----------
  // vrací { root: věci v souřadnicích auta, hood: věci na kapotě, lamp: materiál světel }
  cosmBuild(kind, data, P) {
    const root = new THREE.Group(), hood = new THREE.Group(), dark = U.mat(0x1e1e1e), chrome = U.mat(0xd8d8d0);
    let lamp = null;
    const b = (par, w, h, d, m, x, y, z, rx, ry, rz) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, rz || 0); o.castShadow = true; par.add(o); return o; };
    const c = (par, r, len, m, x, y, z, rx, rz, seg) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 8), m); o.position.set(x, y, z); o.rotation.set(rx || 0, 0, rz || 0); o.castShadow = true; par.add(o); return o; };
    switch (kind) {
      case 'spoiler':
        b(root, 1.62, 0.05, 0.18, P, 0, 1.0, -2.05, -0.38);
        for (const s of [-1, 1]) b(root, 0.03, 0.05, 0.12, dark, s * 0.7, 0.975, -2.0);
        break;
      case 'wing':
        for (const s of [-1, 1]) { b(root, 0.05, 0.25, 0.14, dark, s * 0.6, 1.09, -1.92, 0.15); b(root, 0.02, 0.17, 0.42, dark, s * 0.9, 1.23, -1.97); }
        b(root, 1.78, 0.04, 0.36, P, 0, 1.225, -1.97, 0.1);
        b(root, 1.78, 0.02, 0.06, dark, 0, 1.235, -2.17, -0.5);
        break;
      case 'scoop':
        b(hood, 0.52, 0.1, 0.46, P, 0, 0.075, 0.84, 0.05);
        b(hood, 0.42, 0.06, 0.03, dark, 0, 0.085, 1.07);
        for (let i = -1; i <= 1; i++) b(hood, 0.012, 0.05, 0.02, chrome, i * 0.12, 0.085, 1.085);
        break;
      case 'bullbar':
        for (const s of [-1, 1]) { c(root, 0.032, 0.52, dark, s * 0.44, 0.67, 2.43); b(root, 0.07, 0.07, 0.22, dark, s * 0.44, 0.47, 2.33); }
        c(root, 0.032, 0.96, dark, 0, 0.92, 2.43, 0, Math.PI / 2); c(root, 0.028, 0.96, dark, 0, 0.6, 2.45, 0, Math.PI / 2);
        for (let i = -1; i <= 1; i++) c(root, 0.018, 0.3, dark, i * 0.18, 0.76, 2.44);
        break;
      case 'lightbar':
        lamp = new THREE.MeshLambertMaterial({ color: 0xfff6d8, emissive: 0x000000 });
        b(root, 1.34, 0.08, 0.12, dark, 0, 1.62, 0.32);
        for (const s of [-1, 1]) b(root, 0.04, 0.09, 0.05, dark, s * 0.56, 1.57, 0.32);
        for (let i = 0; i < 5; i++) c(root, 0.045, 0.03, lamp, -0.52 + i * 0.26, 1.62, 0.385, Math.PI / 2, 0, 10);
        break;
      case 'roofrack': {
        for (const s of [-1, 1]) { b(root, 0.04, 0.05, 1.22, dark, s * 0.66, 1.565, -0.2); for (const z of [-0.75, 0.35]) b(root, 0.06, 0.05, 0.06, dark, s * 0.66, 1.555, z); }
        for (const z of [-0.7, -0.2, 0.3]) b(root, 1.36, 0.03, 0.04, dark, 0, 1.6, z);
        b(root, 0.34, 0.2, 0.46, U.mat(0xb8261c), 0.32, 1.715, -0.35); b(root, 0.2, 0.05, 0.05, U.mat(0x8a1c14), 0.32, 1.84, -0.2);
        const t = c(root, 0.3, 0.17, U.mat(0x1c1c1c), -0.3, 1.7, -0.25, 0, 0, 14); c(root, 0.17, 0.175, U.mat(0x9a9a92), -0.3, 1.7, -0.25, 0, 0, 8); t.rotation.set(0, 0, 0);
        break;
      }
      case 'stripes': {
        const m = U.mat(data && data.col !== undefined ? data.col : 0xf0f0f0);
        for (const s of [-1, 1]) {
          b(hood, 0.16, 0.006, 1.38, m, s * 0.13, 0.034, 0.7);
          b(root, 0.16, 0.006, 1.34, m, s * 0.13, 1.538, -0.2);
          b(root, 0.16, 0.006, 0.88, m, s * 0.13, 0.974, -1.67);
          b(root, 0.16, 0.006, 0.38, m, s * 0.13, 0.974, -1.02);
        }
        break;
      }
      case 'fenders':
        for (const s of [1, -1]) for (const zc of [1.3, -1.3]) {
          const o = new THREE.Mesh(new THREE.TorusGeometry(ARCH_R + 0.06, 0.065, 5, 16, Math.PI), P);
          o.position.set(s * 0.94, WHEEL_R, zc); o.rotation.set(0, Math.PI / 2, 0); o.castShadow = true; root.add(o);
        }
        break;
      case 'exhaust':
        for (const x of [-0.24, -0.46]) { c(root, 0.055, 0.24, chrome, x, 0.28, -2.28, Math.PI / 2); c(root, 0.04, 0.245, dark, x, 0.28, -2.28, Math.PI / 2); }
        b(root, 0.36, 0.18, 0.5, U.mat(0x8a8a86), -0.35, 0.27, -1.85);
        break;
    }
    return { root, hood, lamp };
  },
  // model doplňku ležící na zemi / v ruce
  cosmItemMesh(kind, data) {
    const g = new THREE.Group();
    if (kind.startsWith('rims_')) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.24, 16), U.mat(0x1c1c1c)); t.position.y = 0.12; g.add(t);
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.25, 12), U.mat(COSM[kind].rim)); r.position.y = 0.12; g.add(r);
      return g;
    }
    if (kind === 'stripes') {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 10), U.mat(data && data.col !== undefined ? data.col : 0xf0f0f0));
      r.rotation.z = Math.PI / 2; r.position.y = 0.07; g.add(r); return g;
    }
    const res = this.cosmBuild(kind, data, U.mat(0x8a4a3a));
    const hoodG = new THREE.Group(); hoodG.position.set(0, 0.95, 0.78); hoodG.add(res.hood);
    g.add(res.root); g.add(hoodG);
    const box = new THREE.Box3().setFromObject(g), c = new THREE.Vector3(); box.getCenter(c);
    const w = new THREE.Group(); g.position.set(-c.x, -box.min.y, -c.z); w.add(g);
    return w;
  },
  applyCosm(parts, slot, kind, data) {
    const old = parts.cosm[slot];
    if (old) { if (old.root) parts.root.remove(old.root); if (old.hood) parts.hood.remove(old.hood); }
    parts.cosm[slot] = null;
    if (!kind || kind.startsWith('rims_')) { if (kind) parts.cosm[slot] = { kind }; return; }
    const r = this.cosmBuild(kind, data, parts.paintMat);
    this.tag(r.root, 'body'); this.tag(r.hood, 'hood');
    parts.root.add(r.root); parts.hood.add(r.hood);
    parts.cosm[slot] = { kind, root: r.root, hood: r.hood, lamp: r.lamp };
  },

  // ---------- přístroje ----------
  drawDash(car, parts) {
    const cv = parts.dashCanvas, g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.fillStyle = '#14100d'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#3a2f26'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
    const bat = car.slots.battery, lit = bat && bat.charge > 0;
    const fg = lit ? '#f4e6c8' : '#5a5045', accent = lit ? '#ffb347' : '#5a4a35';
    const dial = (cx, cy, r, val, max, step, label, unit, redFrom) => {
      g.fillStyle = '#0b0907'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
      g.strokeStyle = '#4a3c30'; g.lineWidth = 4; g.stroke();
      const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
      if (redFrom !== undefined) { g.strokeStyle = '#a3241a'; g.lineWidth = 10; g.beginPath(); g.arc(cx, cy, r - 12, a0 + (a1 - a0) * redFrom / max, a1); g.stroke(); }
      g.fillStyle = fg; g.strokeStyle = fg; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let v = 0; v <= max + 0.001; v += step) {
        const a = a0 + (a1 - a0) * v / max;
        g.lineWidth = 3; g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 6), cy + Math.sin(a) * (r - 6));
        g.lineTo(cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22)); g.stroke();
        g.fillText(String(Math.round(v)), cx + Math.cos(a) * (r - 42), cy + Math.sin(a) * (r - 42));
      }
      const a = a0 + (a1 - a0) * U.clamp(val / max, 0, 1.03);
      g.strokeStyle = accent; g.lineWidth = 6; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * (r - 18), cy + Math.sin(a) * (r - 18)); g.stroke();
      g.fillStyle = '#2a221c'; g.beginPath(); g.arc(cx, cy, 12, 0, 7); g.fill();
      g.fillStyle = fg; g.font = 'bold 34px Arial'; g.fillText(label, cx, cy + r * 0.42);
      if (unit) { g.font = '20px Arial'; g.fillText(unit, cx, cy + r * 0.64); }
    };
    const kmh = Math.abs(car.vf) * 3.6;
    dial(150, 190, 140, kmh, 220, 20, Math.round(kmh) + '', 'km/h');
    dial(874, 190, 140, car.rpm / 1000, 7, 1, 'x1000', 'ot/min', 6);
    const gearTxt = car.gear === -1 ? 'R' : car.gear === 0 ? 'N' : String(car.gear);
    g.fillStyle = '#0b0907'; g.fillRect(330, 18, 364, 118);
    g.fillStyle = accent; g.font = 'bold 86px Arial'; g.textAlign = 'center'; g.fillText(gearTxt, 430, 80);
    g.font = 'bold 30px Arial'; g.fillStyle = fg; g.fillText(car.auto ? 'AUTO' : 'MANUÁL', 590, 58);
    g.font = '24px Arial'; g.fillText((car.odo / 1000).toFixed(1) + ' km', 590, 100);
    if (car.espec && car.espec.ind) {
      g.font = 'bold 14px Arial'; g.fillStyle = fg; g.fillText(car.espec.ind === 1 ? 'TURBO' : 'KOMPR.', 530, 126);
      g.fillStyle = '#2a221c'; g.fillRect(560, 120, 124, 12); g.fillStyle = lit ? '#5fd3ff' : '#3a3028'; g.fillRect(560, 120, 124 * U.clamp(car.boost || 0, 0, 1), 12);
    }
    const bars = [
      ['PALIVO', car.fuel / car.tankCap, `${car.fuel.toFixed(1)} l`, car.fuel / car.tankCap < 0.15],
      ['OLEJ', car.oil / 5, `${car.oil.toFixed(1)} l`, car.oil < 1],
      ['T OLEJE', (car.oilTemp - 20) / 130, `${Math.round(car.oilTemp)}°C`, car.oilTemp > 130],
      ['T MOTORU', (car.engineTemp - 20) / 115, `${Math.round(car.engineTemp)}°C`, car.engineTemp > 115],
      ['CHLADIČ', car.coolant / 7, `${car.coolant.toFixed(1)} l`, car.coolant < 2],
      ['BATERIE', bat ? bat.charge / 100 : 0, bat ? `${Math.round(bat.charge)}%` : '—', !bat || bat.charge < 20],
    ];
    bars.forEach(([lab, v, txt, warn], i) => {
      const x = 318 + i * 64, y0 = 150, hh = 150;
      g.fillStyle = '#0b0907'; g.fillRect(x, y0, 60, hh);
      const f = U.clamp(v, 0, 1);
      g.fillStyle = !lit ? '#3a3028' : warn ? '#e0442f' : '#e9a23b';
      g.fillRect(x + 8, y0 + 6 + (hh - 12) * (1 - f), 44, (hh - 12) * f);
      g.fillStyle = warn && lit ? '#ff6a50' : fg; g.font = 'bold 14px Arial';
      g.fillText(lab, x + 30, y0 + hh + 16); g.font = 'bold 19px Arial'; g.fillText(txt, x + 30, y0 + hh + 38);
    });
    const s = car.slots, low = (k, v) => !s[k] || s[k].cond < v;
    const lamps = [['(P)', car.handbrake, '#e0442f'], ['MOTOR', low('engine', 40), '#ff9a2a'], ['TEPLO', car.engineTemp > 115, '#e0442f'],
      ['AKU', !bat || bat.charge < 15, '#e0442f'], ['SVĚTLA', car.lights, '#5fd36b'], ['ŘEMEN', low('belt', 20), '#ff9a2a'],
      ['SVÍČKY', low('plugs', 25), '#ff9a2a'], ['FILTR', low('airfilter', 25), '#ff9a2a'], ['PNEU', car.tires.some(t => t.cond < 20), '#ff9a2a'],
      ['KAROS', car.body < 35, '#ff9a2a']];
    g.font = 'bold 15px Arial';
    lamps.forEach(([t, on, c], i) => { g.fillStyle = on && lit ? c : '#3a3028'; g.fillText(t, 56 + i * 101, 380); });
    if (!car.running) { g.fillStyle = lit ? '#e0442f' : '#3a3028'; g.font = 'bold 20px Arial'; g.fillText('MOTOR VYP', 512, 140); }
    parts.dashTex.needsUpdate = true;
  },
  // displej autorádia
  drawRadio(parts, info, lit, hi) {
    const R = parts.radio; if (!R) return;
    const g = R.cv.getContext('2d'), W = R.cv.width, H = R.cv.height;
    g.fillStyle = '#05080a'; g.fillRect(0, 0, W, H);
    if (lit && info.on) {
      g.fillStyle = '#7fe8ff'; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.font = 'bold 40px monospace'; g.fillText(info.freq, 12, 30);
      g.font = 'bold 26px Arial'; g.fillText(info.name.toUpperCase(), 130, 30);
      g.font = '22px Arial'; g.fillStyle = '#c8f4ff';
      const t = `${info.title} – ${info.artist}`, w = g.measureText(t).width;
      const off = w > W - 24 ? ((performance.now() / 40) % (w + 60)) : 0;
      g.save(); g.beginPath(); g.rect(10, 52, W - 20, 34); g.clip();
      g.fillText(t, 12 - off, 70); if (off) g.fillText(t, 12 - off + w + 60, 70); g.restore();
      g.fillStyle = '#16323a'; g.fillRect(12, 100, W - 24, 14);
      g.fillStyle = '#7fe8ff'; g.fillRect(12, 100, (W - 24) * info.vol / 100, 14);
      g.font = '18px Arial'; g.fillStyle = '#8fbfcc'; g.fillText(info.genre + ' · hlasitost ' + info.vol + ' %', 12, 128);
    } else if (lit) { g.fillStyle = '#2a4a52'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('RÁDIO VYP', W / 2, H / 2); }
    if (hi) { g.strokeStyle = '#ffb347'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6); }
    R.btns.forEach((b, i) => { b.material = lit && info.on && info.st === i ? R.btnOn : R.btnM; });
    R.tex.needsUpdate = true;
  },
  drawDiag(car, parts) {
    const cv = parts.diagCanvas, g = cv.getContext('2d'), W = cv.width, H = cv.height;
    const lit = car.slots.battery && car.slots.battery.charge > 0;
    g.fillStyle = '#0d1410'; g.fillRect(0, 0, W, H);
    if (!lit) { parts.diagTex.needsUpdate = true; return; }
    g.fillStyle = '#7dff9a'; g.font = 'bold 30px monospace'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('DIAGNOSTIKA', 16, 24);
    const rows = BAY_SLOTS.map(k => [PARTS[k].name, car.slots[k]]).concat(car.tires.map((t, i) => [['Kolo LP', 'Kolo PP', 'Kolo LZ', 'Kolo PZ'][i], t]));
    rows.forEach(([n, p], i) => {
      const y = 54 + i * 25.4;
      g.font = '19px monospace'; g.fillStyle = '#bfe8c8'; g.fillText(n.slice(0, 16), 14, y);
      if (!p) { g.fillStyle = '#ff5a4a'; g.fillText('CHYBÍ', 300, y); return; }
      const c = p.cond / 100;
      g.fillStyle = '#20302a'; g.fillRect(250, y - 8, 200, 16);
      g.fillStyle = c < 0.25 ? '#ff5a4a' : c < 0.5 ? '#ffb347' : '#6be38a'; g.fillRect(250, y - 8, 200 * U.clamp(c, 0, 1), 16);
      g.fillStyle = TIERS[p.tier].color; g.fillRect(460, y - 8, 16, 16);
      g.fillStyle = '#e8f4ea'; g.font = '15px monospace'; g.fillText(Math.round(p.cond) + '%', 480, y);
    });
    parts.diagTex.needsUpdate = true;
  },
};
