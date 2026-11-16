// dealer.js – autosalon: auta s jiným tvarem karoserie, odemykají se postupem v módech a kupují za peníze z rally a dragu
// Vybrané auto se použije všude (HRÁT SÁM, drag, rally). Jezdí a funguje úplně stejně – liší se jen vzhledem.
const DEALER_CARS = [
  { id: 'kara', n: 'Stará kára', d: 'Tvoje první auto ze stodoly – klasický sedan s kufrem.', price: 0, paint: 0x4f7f86, req: [] },
  { id: 'pickup', n: 'Pouštní pickup', d: 'Krátká kabina s rovnou zádí, korba s rámem a rezervou.', price: 2500, paint: 0xb8742a, req: [['km', 3]] },
  { id: 'rally', n: 'Rally hatchback', d: 'Zkrácená šikmá záď s pátými dveřmi, spoiler na střeše, mlhovky.', price: 6000, paint: 0x2a5ab0, req: [['rstage', 4]] },
  { id: 'muscle', n: 'Muscle kupé', d: 'Nízká střecha, záď svažující se až ke kufru (fastback), kompresor z kapoty.', price: 9000, paint: 0xd85a1a, req: [['dbeat', 3]] },
  { id: 'offroad', n: 'Pouštní 4×4', d: 'Vysoká hranatá karoserie až dozadu, kolmé čelní sklo, nosič se světly.', price: 14000, paint: 0x6a7a4a, req: [['km', 10], ['rstage', 8]] },
  { id: 'stihac', n: 'Pouštní stíhač', d: 'Nízký klín se střílnami místo oken, pancéřování a výfuky nad střechu.', price: 30000, paint: 0x2e2a26, req: [['km', 25], ['rstage', 14], ['dbeat', 7]] },
];
// tvar prosklené nástavby: p = [čelní sklo dole, střecha vpředu, střecha vzadu, zadní sklo dole] jako [z, y]; w = boční okna (mnohoúhelníky [z, y])
const DEALER_CABIN = {
  pickup: { p: [[0.75, 0.93], [0.5, 1.5], [-0.86, 1.5], [-0.9, 0.93]],
    w: [[[0.66, 0.96], [0.47, 1.43], [-0.1, 1.43], [-0.1, 0.96]], [[-0.2, 0.96], [-0.2, 1.43], [-0.78, 1.43], [-0.8, 0.96]]] },
  rally: { p: [[0.75, 0.93], [0.42, 1.47], [-1.25, 1.47], [-2.05, 1.0]],
    w: [[[0.66, 0.96], [0.43, 1.41], [-0.1, 1.41], [-0.1, 0.96]], [[-0.2, 0.96], [-0.2, 1.41], [-1.05, 1.41], [-1.35, 0.96]]] },
  muscle: { p: [[0.76, 0.93], [0.22, 1.46], [-0.48, 1.46], [-1.9, 1.0]],
    w: [[[0.64, 0.96], [0.25, 1.41], [-0.48, 1.41], [-0.95, 1.13], [-0.95, 0.96]]] },
  offroad: { p: [[0.74, 0.93], [0.58, 1.7], [-2.02, 1.7], [-2.06, 0.93]], cw: 0.14,
    w: [[[0.68, 0.96], [0.57, 1.64], [-0.1, 1.64], [-0.1, 0.96]], [[-0.2, 0.96], [-0.2, 1.64], [-1.0, 1.64], [-1.0, 0.96]], [[-1.1, 0.96], [-1.1, 1.64], [-1.92, 1.64], [-1.92, 0.96]]] },
  stihac: { p: [[0.78, 0.93], [0.12, 1.46], [-0.65, 1.46], [-1.4, 0.96]],
    w: [[[0.45, 1.13], [0.16, 1.4], [-0.55, 1.4], [-0.6, 1.13]]] },
};
const DEALER_REQ = {
  km: { n: (v) => `dojeď ${v} km v HRÁT SÁM`, have: () => +(U.store.get('pj_best', 0)) || 0, fmt: (x) => x.toFixed(1) + ' km' },
  rstage: { n: (v) => `projeď ${v} rally etap`, have: () => (Rally.sv || U.store.get('pj_rally', {})).stage || 0, fmt: (x) => String(x) },
  dbeat: { n: (v) => `poraz ${v} soupeřů v dragu`, have: () => (Drag.sv || U.store.get('pj_drag', {})).beaten || 0, fmt: (x) => String(x) },
};

const Dealer = {
  active: false, prev: null,
  sv() { if (!this._sv) this._sv = Object.assign({ own: ['kara'], sel: 'kara' }, U.store.get('pj_cars', {})); return this._sv; },
  store() { U.store.set('pj_cars', this._sv); },
  car(id) { return DEALER_CARS.find(c => c.id === id) || DEALER_CARS[0]; },
  sel() { const s = this.sv(); return s.own.includes(s.sel) ? s.sel : 'kara'; },
  unlocked(c) { return c.req.every(([k, v]) => DEALER_REQ[k].have() >= v); },
  // peníze: rally + drag (nejdřív se bere z rally peněženky)
  wallets() {
    if (!Rally.sv) Rally.load(); if (!Drag.sv) Drag.load();
    return { rally: Rally.sv.money || 0, drag: Drag.sv.money || 0 };
  },
  buy(id) {
    const c = this.car(id), s = this.sv(), w = this.wallets();
    if (s.own.includes(id) || !this.unlocked(c) || w.rally + w.drag < c.price) return false;
    const fromR = Math.min(w.rally, c.price);
    Rally.sv.money -= fromR; Drag.sv.money -= c.price - fromR;
    Rally.store(); Drag.store();
    s.own.push(id); s.sel = id; this.store();
    return true;
  },
  // ---------- vzhled: jiný tvar karoserie + doplňky ----------
  // nová prosklená nástavba místo původní (sloupky, střecha, skla, boční plech s okny)
  cabin(parts, P, S) {
    const g = parts.kit, glass = parts.glassMat, chrome = U.mat(0xd0d0c8);
    const old = new Set(parts.cabin); for (const m of old) m.visible = false;
    parts.debris = parts.debris.filter(m => !old.has(m));   // schované díly nesmí při výbuchu létat
    const add = (m, deb) => { m.castShadow = true; m.userData.zone = 'body'; g.add(m); if (deb) { parts.debris.push(m); CarModel.outline(m); } return m; };
    const strip = (a, b, w, t, mat, x, deb) => {   // kvádr natažený mezi dvěma body [z, y]
      const dz = b[0] - a[0], dy = b[1] - a[1], m = add(new THREE.Mesh(new THREE.BoxGeometry(w, Math.hypot(dz, dy), t), mat), deb);
      m.position.set(x, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2); m.rotation.x = Math.atan2(dz, dy); return m;
    };
    const [a, b, c, d] = S.p;
    strip(a, b, 1.6, 0.02, glass, 0); strip(c, d, 1.6, 0.02, glass, 0);                  // čelní a zadní sklo
    for (const sx of [0.81, -0.81]) strip(a, b, 0.08, 0.08, P, sx, true);                  // A-sloupky
    for (const sx of [0.8, -0.8]) strip(c, d, S.cw || 0.1, 0.1, P, sx, true);              // C-sloupky
    strip(b, c, 1.76, 0.07, P, 0, true);                                                    // střecha
    const sh = new THREE.Shape(); [[a[0], 0.9], a, b, c, d, [d[0], 0.9]].forEach(([z, y], i) => i ? sh.lineTo(z, y) : sh.moveTo(z, y));
    for (const w of S.w) { const h = new THREE.Path(); w.forEach(([z, y], i) => i ? h.lineTo(z, y) : h.moveTo(z, y)); sh.holes.push(h); }
    const side = new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }), panes = new THREE.ShapeGeometry(S.w.map(w => new THREE.Shape(w.map(([z, y]) => new THREE.Vector2(z, y)))));
    for (const s of [1, -1]) {
      const m = add(new THREE.Mesh(s > 0 ? side : side.clone(), P), true); m.rotation.y = -Math.PI / 2; m.position.x = s > 0 ? 0.885 : -0.845;   // bok s okny
      const gl = new THREE.Mesh(panes, glass); gl.rotation.y = -Math.PI / 2; gl.position.x = s * 0.865; gl.userData.zone = 'body'; g.add(gl);
      strip([b[0], b[1] - 0.045], [c[0], c[1] - 0.045], 0.03, 0.03, chrome, s * 0.885);      // okap
    }
    // vnitřní zrcátko pod přední hranu střechy (u nízké střechy by viselo venku)
    const rm = parts.mirrors && parts.mirrors[2];
    if (rm && b[1] < 1.55) { const grp = rm.glass.parent, dv = new THREE.Vector3(0, b[1] - 0.11, Math.min(0.47, b[0] - 0.1)).sub(grp.position); grp.position.add(dv); rm.cam.position.add(dv); }
  },
  kit(parts, id, P) {
    if (!id || id === 'kara') return;
    const root = parts.root, g = new THREE.Group(); root.add(g); parts.kit = g;
    if (DEALER_CABIN[id]) this.cabin(parts, P, DEALER_CABIN[id]);
    const dark = U.mat(0x1e1c1a), chrome = U.mat(0xd0d0c8), white = U.mat(0xf2efe6), black = U.mat(0x141414);
    const b = (w, h, d, m, x, y, z, rx, ry, rz, par) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, rz || 0, 'YXZ'); o.castShadow = true; o.userData.zone = 'body'; (par || g).add(o); return o; };
    const c = (r, len, m, x, y, z, rx, ry, rz, par, seg) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg || 10), m); o.position.set(x, y, z); o.rotation.set(rx || 0, ry || 0, rz || 0, 'YXZ'); o.castShadow = true; o.userData.zone = 'body'; (par || g).add(o); return o; };
    const lamp = new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0x3a3010 });
    const spare = (x, y, z, rx, ry) => { c(0.33, 0.22, black, x, y, z, rx, ry, 0, null, 16); c(0.19, 0.23, U.mat(0x8a8a82), x, y, z, rx, ry, 0, null, 12); };
    const flares = (m) => { for (const s of [1, -1]) for (const zc of [1.3, -1.3]) { const f = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 4, 14, Math.PI), m); f.position.set(s * 0.93, WHEEL_R, zc); f.rotation.y = Math.PI / 2; f.castShadow = true; g.add(f); } };
    switch (id) {
      case 'pickup':
        for (const s of [1, -1]) b(0.07, 0.26, 1.24, P, s * 0.87, 1.09, -1.52);                          // bočnice korby
        b(1.74, 0.26, 0.07, P, 0, 1.09, -2.13);                                                          // zadní čelo
        b(1.6, 0.02, 1.15, dark, 0, 0.975, -1.52);                                                       // vana korby
        for (const s of [1, -1]) b(0.07, 0.6, 0.07, dark, s * 0.76, 1.25, -1.0);                          // rám za kabinou
        b(1.6, 0.07, 0.07, dark, 0, 1.55, -1.0);
        b(0.07, 0.07, 0.6, dark, 0.76, 1.55, -1.3, 0.75); b(0.07, 0.07, 0.6, dark, -0.76, 1.55, -1.3, 0.75);
        spare(0, 1.1, -1.65, 0, 0);                                                                      // rezerva v korbě
        for (const s of [1, -1]) b(0.3, 0.32, 0.02, black, s * 0.78, 0.25, -1.82);                        // lapače bláta
        b(1.9, 0.2, 0.2, dark, 0, 0.46, 2.26);                                                           // tmavý nárazník přes chrom
        break;
      case 'rally':
        b(1.66, 0.04, 0.34, P, 0, 1.53, -1.36, 0.14); for (const s of [-1, 1]) b(0.03, 0.06, 0.2, dark, s * 0.6, 1.5, -1.3);   // spoiler na hraně střechy
        b(0.42, 0.1, 0.42, P, 0, 1.54, 0.0); b(0.36, 0.06, 0.02, black, 0, 1.55, 0.21);                  // nasávání na střeše
        for (const sx of [-0.62, -0.32, 0.32, 0.62]) { c(0.075, 0.06, lamp, sx, 0.66, 2.33, Math.PI / 2); c(0.085, 0.07, dark, sx, 0.66, 2.3, Math.PI / 2); }  // mlhovky
        for (const s of [1, -1]) { b(0.02, 0.07, 3.5, white, s * 0.925, 0.52, -0.05); b(0.1, 0.08, 1.5, dark, s * 0.9, 0.33, -0.04); }  // pruh + prahy
        for (const s of [1, -1]) b(0.3, 0.32, 0.02, U.mat(0xd02a1a), s * 0.78, 0.25, -1.82);
        b(1.2, 0.03, 0.5, black, 0, 0.022, 0.8, 0, 0, 0, parts.hood);                                   // černý pruh přes kapotu
        break;
      case 'muscle': {
        const hb = new THREE.Group(); parts.hood.add(hb);
        b(0.44, 0.16, 0.5, U.mat(0x8a8a86), 0, 0.11, 0.55, 0, 0, 0, hb);                                 // kompresor
        b(0.5, 0.05, 0.56, chrome, 0, 0.2, 0.55, 0, 0, 0, hb);
        for (const sx of [-0.1, 0.1]) b(0.14, 0.12, 0.16, black, sx, 0.28, 0.62, 0, 0, 0, hb);           // klapky sání
        for (const sx of [-0.18, 0.18]) b(0.14, 0.012, 1.42, white, sx, 0.035, 0.7, 0, 0, 0, hb);        // pruhy na kapotě
        for (const sx of [-0.18, 0.18]) { b(0.14, 0.01, 0.72, white, sx, 1.5, -0.13); b(0.14, 0.01, 0.2, white, sx, 0.975, -2.02); }
        flares(dark);
        for (const s of [1, -1]) { c(0.05, 1.3, chrome, s * 0.95, 0.3, -0.05, Math.PI / 2); c(0.06, 0.06, black, s * 0.95, 0.3, 0.62, Math.PI / 2); }  // boční výfuky
        b(1.7, 0.05, 0.2, P, 0, 0.99, -2.07, -0.35);                                                     // kachní záď
        break;
      }
      case 'offroad':
        for (const sx of [-0.7, 0.7]) c(0.04, 0.6, chrome, sx, 0.62, 2.42);                             // ochranný rám
        b(1.5, 0.08, 0.08, chrome, 0, 0.88, 2.42); b(1.5, 0.08, 0.08, chrome, 0, 0.5, 2.42);
        for (const sx of [-0.35, 0.35]) b(0.06, 0.42, 0.06, chrome, sx, 0.69, 2.42);
        for (const s of [1, -1]) b(0.05, 0.05, 2.3, dark, s * 0.78, 1.78, -0.75);                       // střešní nosič
        for (const z of [-1.8, -1.2, -0.6, 0.0, 0.4]) b(1.56, 0.04, 0.05, dark, 0, 1.78, z);
        for (const s of [1, -1]) for (const z of [-1.8, 0.4]) b(0.04, 0.08, 0.04, dark, s * 0.78, 1.74, z);
        for (const sx of [-0.54, -0.18, 0.18, 0.54]) { b(0.18, 0.13, 0.08, dark, sx, 1.88, 0.42); b(0.14, 0.09, 0.01, lamp, sx, 1.88, 0.465); }
        c(0.055, 1.25, dark, -0.95, 1.2, 0.68); c(0.055, 0.22, dark, -0.95, 1.82, 0.76, Math.PI / 2);    // šnorchl
        spare(0, 1.15, -2.36, Math.PI / 2);                                                               // rezerva na zádi
        flares(dark);
        for (const s of [1, -1]) c(0.045, 1.5, dark, s * 0.94, 0.3, -0.04, Math.PI / 2);                // ochranné trubky na prazích
        break;
      case 'stihac':
        { const w = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.7), dark); w.position.set(0, 0.32, 2.42); w.rotation.x = 0.55; w.castShadow = true; g.add(w); }  // klín
        for (let i = -3; i <= 3; i++) b(0.03, 0.03, 0.22, chrome, i * 0.26, 0.42, 2.62, -0.5);          // hroty v klínu
        for (const s of [1, -1]) for (const z of [-0.35, -0.1, 0.15]) b(0.03, 0.3, 0.035, dark, s * 0.9, 1.27, z);  // mříže ve střílnách
        for (const s of [1, -1]) { c(0.07, 1.1, chrome, s * 0.68, 1.52, -1.58); c(0.085, 0.12, black, s * 0.68, 2.1, -1.58); }  // výfuky nad střechu
        for (const sx of [-0.28, 0.28]) b(0.3, 0.38, 0.22, U.mat(0xb02a1a), sx, 1.16, -1.92);         // kanystry
        b(0.8, 0.05, 0.05, dark, 0, 1.34, -1.92);
        flares(U.mat(0x3a3632));
        for (const s of [1, -1]) b(0.03, 0.5, 1.4, U.mat(0x4a4642), s * 0.94, 0.62, -0.05);            // pancéřové pláty na dveřích
        for (const s of [1, -1]) for (const z of [-0.6, -0.1, 0.4]) c(0.025, 0.03, chrome, s * 0.96, 0.62, z, 0, 0, Math.PI / 2);  // nýty
        break;
    }
  },

  // ---------- showroom ----------
  open() {
    this.active = true; this.prev = this.sel(); this.selAtOpen = this.sel();
    Sfx.init();
    if (!Rally.sv) Rally.load(); if (!Drag.sv) Drag.load();
    $('menu').style.display = 'none'; $('dealer').style.display = 'block';
    if (!this.sc) this.build();
    this.show(this.prev); this.render();
  },
  close() {
    this.active = false; $('dealer').style.display = 'none'; $('menu').style.display = 'flex';
    // jiné auto → v HRÁT SÁM ho najdeš ve stodole (svět v menu se postaví znovu s novým autem)
    if (this.sel() !== this.selAtOpen && !Game.playing && !Net.active) Game.buildWorld(Math.floor(Math.random() * 1e6));
  },
  build() {
    const sc = this.sc = new THREE.Scene();
    sc.background = new THREE.Color(0x15120f);
    sc.add(new THREE.HemisphereLight(0xfff0e0, 0x3a3028, 0.65));
    const key = new THREE.SpotLight(0xfff0d8, 1.3, 40, 0.75, 0.5, 1); key.position.set(-4, 7, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); sc.add(key); sc.add(key.target);
    const rim = new THREE.PointLight(0xffc060, 0.7, 18); rim.position.set(5, 3, -4); sc.add(rim);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshLambertMaterial({ color: 0x5a5650, map: Tex.get('floor') }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; sc.add(floor);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.5, 0.08, 40), U.mat(0x2a2622)); disc.position.y = 0.04; disc.receiveShadow = true; sc.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.45, 0.04, 6, 48), new THREE.MeshBasicMaterial({ color: 0xffb347 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.085; sc.add(ring);
    this.decor = GarageDecor.build(sc);
    this.turn = new THREE.Group(); this.turn.position.y = 0.08; sc.add(this.turn);
    this.cam = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.1, 200);
    this.yaw = 0.75; this.pitch = 0.2; this.dist = 8.5;
    const cv = Game.renderer.domElement;
    cv.addEventListener('pointerdown', (e) => { if (this.active) this._drag = [e.clientX, e.clientY]; });
    addEventListener('pointerup', () => { this._drag = null; });
    addEventListener('pointermove', (e) => {
      if (!this.active || !this._drag) return;
      this.yaw -= (e.clientX - this._drag[0]) * 0.008; this.pitch = U.clamp(this.pitch + (e.clientY - this._drag[1]) * 0.004, 0.02, 0.9);
      this._drag = [e.clientX, e.clientY]; this.idle = 0;
    });
    cv.addEventListener('wheel', (e) => { if (this.active) this.dist = U.clamp(this.dist + Math.sign(e.deltaY) * 0.6, 5, 14); }, { passive: true });
    $('dealer').addEventListener('click', (e) => this.click(e));
  },
  show(id) {
    this.prev = id;
    if (this.parts) { this.turn.remove(this.parts.root); for (const m of this.parts.mirrors || []) m.rt.dispose(); }
    const c = this.car(id);
    this.parts = CarModel.build(c.paint, id);
    this.parts.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.turn.add(this.parts.root);
  },
  render() {
    const s = this.sv(), w = this.wallets(), c = this.car(this.prev);
    $('dlTitle').innerHTML = `<b style="font-size:20px;color:#ffcf86">🚗 AUTOSALON</b><br><span style="font-size:13px;opacity:.85">Za postup v módech se odemykají další auta. Vybrané auto jezdí v HRÁT SÁM, dragu i rally.</span>`;
    $('dlMoney').innerHTML = `💰 <b>${(w.rally + w.drag).toLocaleString('cs-CZ')} Kč</b><br><span style="font-size:12px;opacity:.8">rally ${w.rally.toLocaleString('cs-CZ')} · drag ${w.drag.toLocaleString('cs-CZ')}</span>`;
    let h = `<h3>${c.n}</h3><div style="font-size:14px;opacity:.9;margin-bottom:8px">${c.d}</div>`;
    h += `<div class="gEst" style="font-size:13px">Jezdí a funguje úplně stejně jako stará kára (díly, opravy, tuning) – liší se jen tvarem a vzhledem.</div>`;
    $('dlInfo').innerHTML = h;
    let l = '<h3>Auta na prodej</h3>';
    for (const q of DEALER_CARS) {
      const own = s.own.includes(q.id), on = this.sel() === q.id, open = this.unlocked(q), view = this.prev === q.id;
      const reqs = q.req.map(([k, v]) => { const R = DEALER_REQ[k], hv = R.have(), ok = hv >= v; return `<i style="color:${ok ? '#8fd36b' : '#ffb08a'}">${ok ? '✔' : '✘'} ${R.n(v)}${ok ? '' : ` (máš ${R.fmt(hv)})`}</i>`; }).join('');
      const btn = on ? '<span class="gOk">✔ jezdíš s ním</span>' : own ? `<button data-dsel="${q.id}">Vybrat</button>`
        : !open ? '<span class="gLock">🔒 zamčeno</span>' : `<button data-dbuy="${q.id}" ${w.rally + w.drag < q.price ? 'disabled' : ''}>Koupit ${q.price.toLocaleString('cs-CZ')} Kč</button>`;
      l += `<div class="gItem dlCar${on ? ' eq' : ''}${!open && !own ? ' lock' : ''}${view ? ' view' : ''}" data-dview="${q.id}"><div><b>${q.n}</b><span>${q.d}</span>${own ? '' : reqs}</div>${btn}</div>`;
    }
    l += '<div style="font-size:12px;opacity:.7;margin-top:8px">Klikni na auto = prohlédnout si ho. Platí se z peněz z rally a dragu (nejdřív z rally).</div>';
    $('dlList').innerHTML = l;
  },
  click(e) {
    if (e.target.id === 'dlBack') { this.close(); return; }
    const bt = e.target.closest('button'), row = e.target.closest('[data-dview]');
    if (bt && bt.dataset.dbuy) { if (this.buy(bt.dataset.dbuy)) { Sfx.coin && Sfx.coin(); Game.msg && Game.msg(`Koupil sis ${this.car(bt.dataset.dbuy).n}!`, 'good'); this.show(bt.dataset.dbuy); } }
    else if (bt && bt.dataset.dsel) { this.sv().sel = bt.dataset.dsel; this.store(); Sfx.click && Sfx.click(); this.show(bt.dataset.dsel); }
    else if (row && row.dataset.dview !== this.prev) this.show(row.dataset.dview);
    else return;
    this.render();
  },
  frame(dt) {
    this.idle = (this.idle || 0) + dt;
    if (this.idle > 3 && !this._drag) this.yaw += dt * 0.25;
    const cam = this.cam; cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix();
    cam.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist, 1 + Math.sin(this.pitch) * this.dist, Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist);
    cam.lookAt(1.0 * Math.cos(this.yaw), 0.7, -1.0 * Math.sin(this.yaw));   // auto trochu vlevo – vpravo je seznam aut
    GarageDecor.update(dt, this.decor);
    const r = Game.renderer; r.shadowMap.needsUpdate = true; r.render(this.sc, cam);
  },
};
