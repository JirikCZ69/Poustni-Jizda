// planemodel.js – 3D modely letadel: trup jako „loft“ superelipsových průřezů, křídla a ocasní plochy s profilem
// (NACA tvar, zúžení, šípovitost, vzepětí, zaoblené konce), oddělená kormidla na skutečné ose otáčení,
// vrtule s kroucenými listy, kryty kol, kabina se zasklením, výfuky, anténa, pitotka, poziční světla a barevné livreje.
// Ploché stínování = čistý geometrický vzhled, ale tvary odpovídají skutečným letadlům.
const PlaneModel = {
  // ---------- pomocné stavění geometrie ----------
  // kůže mezi kruhy bodů (všechny kruhy stejně bodů a stejné pořadí); normály se otočí ven automaticky
  skin(rings, col, capA, capB, filt) {
    const pos = [], cl = [], C = new THREE.Color(), N = rings[0].length;
    const ctr = rings.map(r => r.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / r.length));
    // směr navíjení: první čtyřúhelník musí mířit od středu kruhu
    let flip = false;
    {
      const a = rings[0][0], b = rings[0][1], c = rings[1][1], n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      flip = n.dot(new THREE.Vector3().subVectors(a, ctr[0]).add(new THREE.Vector3().subVectors(rings[1][0], ctr[1]))) < 0;
    }
    // barva podle středu celého čtyřúhelníku (cq), ať vzory nejsou zubaté
    let cq = null;
    const tri = (A, B, D) => {
      if (flip) { const t = B; B = D; D = t; }
      pos.push(A.x, A.y, A.z, B.x, B.y, B.z, D.x, D.y, D.z);
      C.setHex(cq !== null ? cq : col ? col((A.x + B.x + D.x) / 3, (A.y + B.y + D.y) / 3, (A.z + B.z + D.z) / 3) : 0xffffff);
      for (let k = 0; k < 3; k++) cl.push(C.r, C.g, C.b);
    };
    for (let i = 0; i + 1 < rings.length; i++) for (let j = 0; j < N; j++) {
      const a = rings[i][j], b = rings[i][(j + 1) % N], c = rings[i + 1][(j + 1) % N], d = rings[i + 1][j];
      if (filt && !filt((a.x + b.x + c.x + d.x) / 4, (a.y + b.y + c.y + d.y) / 4, (a.z + b.z + c.z + d.z) / 4)) continue;
      cq = col ? col((a.x + b.x + c.x + d.x) / 4, (a.y + b.y + c.y + d.y) / 4, (a.z + b.z + c.z + d.z) / 4) : 0xffffff;
      tri(a, b, c); tri(a, c, d);
    }
    cq = null;
    // víčka: vějíř ze středu, normála od sousedního kruhu
    const cap = (ri, nb) => {
      const r = rings[ri], c0 = ctr[ri], out = new THREE.Vector3().subVectors(c0, ctr[nb]);
      for (let j = 0; j < N; j++) {
        let A = c0, B = r[j], D = r[(j + 1) % N];
        const n = new THREE.Vector3().subVectors(B, A).cross(new THREE.Vector3().subVectors(D, A));
        if ((n.dot(out) < 0) !== flip) { const t = B; B = D; D = t; }
        tri(A, B, D);
      }
    };
    if (capA) cap(0, 1);
    if (capB) cap(rings.length - 1, rings.length - 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    g.computeVertexNormals();
    return g;
  },
  // průřez trupu: superelipsa (n=2 elipsa, víc = hranatější); 'flatB' zploští spodek
  sect(s, N) {
    const out = [], n = s.n || 2.3;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + Math.PI / 2, c = Math.cos(a), si = Math.sin(a);
      let y = s.h / 2 * Math.sign(si) * Math.pow(Math.abs(si), 2 / n);
      if (s.flatB && y < -s.h / 2 * s.flatB) y = -s.h / 2 * s.flatB;
      out.push(new THREE.Vector3((s.x || 0) + s.w / 2 * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), (s.y || 0) + y, s.z));
    }
    return out;
  },
  fuse(secs, N, col) { return this.skin(secs.map(s => this.sect(s, N)), col, true, true); },
  // profil křídla (NACA 4místný) mezi x0 a x1 tětivy: horní strana od x1 k x0, spodní zpět
  foil(t, m, x0, x1, n) {
    const yt = (x) => 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
    const yc = (x) => m ? (x < 0.4 ? m / 0.16 * (0.8 * x - x * x) : m / 0.36 * (0.2 + 0.8 * x - x * x)) : 0;
    const xs = [];
    for (let i = 0; i <= n; i++) { const u = i / n; xs.push(x0 + (x1 - x0) * (x0 === 0 ? (1 - Math.cos(u * Math.PI / 2)) : u)); }
    const up = xs.slice().reverse().map(x => [x, yc(x) + yt(x)]), lo = xs.slice(1, x1 >= 0.999 ? -1 : undefined).map(x => [x, yc(x) - yt(x)]);
    if (x1 >= 0.999) up[0][1] = yc(1);          // ostrá odtoková hrana
    return up.concat(lo);
  },
  // křídlo / ocasní plocha: stanice podél rozpětí; place(span, thick, chordZ) → bod v těle
  wingGeo(st, t, m, x0, x1, place, col, capA, capB) {
    const prof = this.foil(t, m, x0, x1, 6);
    const rings = st.map(s => prof.map(([x, y]) => place(s.s, s.y + y * s.c, s.le + x * s.c)));
    return this.skin(rings, col, capA !== false, capB !== false);
  },
  // stanice křídla v rozsahu rozpětí [a, b] (podíly 0..1 poloviny), tvar podle funkce shape(u) → {c, le, y}
  stations(half, a, b, shape, sign, n) {
    const st = [];
    for (let i = 0; i <= n; i++) { const u = a + (b - a) * i / n, q = shape(u); st.push({ s: sign * u * half, c: q.c, le: q.le, y: q.y }); }
    return st;
  },
  // kormidlo na ose otáčení (pant v x0 tětivy); vrací vnitřní skupinu, jejíž rotation.x = výchylka
  hinged(parent, half, a, b, shape, sign, t, m, x0, place, col, mat) {
    const st = this.stations(half, a, b, shape, sign, 4);
    const geo = this.wingGeo(st, t, m, x0, 1, place, col);
    const q0 = shape(a), q1 = shape(b);
    const H = (u, q) => place(sign * u * half, q.y, q.le + x0 * q.c);
    let A = H(a, q0), B = H(b, q1);
    const dir = new THREE.Vector3().subVectors(B, A).normalize();
    // osa vždy „kladným směrem“ (aby výchylka měla stejné znaménko vlevo i vpravo)
    const ref = Math.abs(dir.x) > Math.abs(dir.y) ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    if (dir.dot(ref) < 0) { dir.negate(); const T = A; A = B; B = T; }
    const qa = new THREE.Quaternion().setFromUnitVectors(ref, dir), qi = qa.clone().invert();
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).sub(A).applyQuaternion(qi); p.setXYZ(i, v.x, v.y, v.z); }
    geo.computeVertexNormals();
    const outer = new THREE.Group(); outer.position.copy(A); outer.quaternion.copy(qa); parent.add(outer);
    const inner = new THREE.Group(); outer.add(inner);
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true; inner.add(mesh);
    return inner;
  },
  mats(P) {
    return {
      paint: new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 55, specular: 0x303030 }),
      metal: new THREE.MeshPhongMaterial({ color: 0xa8acb2, flatShading: true, shininess: 80, specular: 0x666666 }),
      dark: new THREE.MeshPhongMaterial({ color: 0x1c1c1e, flatShading: true, shininess: 20 }),
      rubber: new THREE.MeshLambertMaterial({ color: 0x161616 }),
      glass: new THREE.MeshPhongMaterial({ color: 0x8ec8f0, transparent: true, opacity: 0.32, shininess: 120, specular: 0xffffff, depthWrite: false, side: THREE.DoubleSide }),
    };
  },

  // ---------- definice tvarů letadel ----------
  shape(id) {
    if (id === 'cmelak') return {
      L: 6.8, eye: [0, 0.95, -0.35], N: 14,
      fuse: [
        { z: -3.38, w: 0.42, h: 0.42, y: 0.05, n: 2 }, { z: -3.25, w: 0.86, h: 0.84, y: 0.04, n: 2.4 }, { z: -2.9, w: 1.02, h: 1.2, y: 0.12, n: 2.8 },
        { z: -2.0, w: 1.06, h: 1.24, y: 0.16, n: 3.2 }, { z: -1.45, w: 1.08, h: 1.3, y: 0.24, n: 3.4 }, { z: -1.0, w: 1.1, h: 1.66, y: 0.38, n: 3.6 },
        { z: -0.2, w: 1.1, h: 1.72, y: 0.4, n: 3.6 }, { z: 0.6, w: 1.04, h: 1.58, y: 0.38, n: 3.4 }, { z: 1.4, w: 0.82, h: 1.12, y: 0.38, n: 3 },
        { z: 2.4, w: 0.52, h: 0.74, y: 0.38, n: 2.8 }, { z: 3.3, w: 0.24, h: 0.42, y: 0.4, n: 2.6 }, { z: 3.78, w: 0.07, h: 0.22, y: 0.42, n: 2.4 }],
      wing: { y: 1.24, half: 5.35, z: -1.12, rc: 1.58, tc: 1.42, sweep: 0.0, dih: 0.025, t: 0.13, m: 0.02, flaps: [0.1, 0.48], ail: [0.52, 0.94], tip: 'round' },
      hs: { y: 0.42, half: 1.75, z: 2.95, rc: 0.86, tc: 0.62, sweep: 0.12, t: 0.09, cut: 0.62 },
      vs: { y: 0.55, h: 1.15, z: 2.72, rc: 1.05, tc: 0.55, sweep: 0.55, t: 0.09, cut: 0.6 },
      spin: { r: 0.22, len: 0.36, z: -3.38 }, gearPants: true,
    };
    if (id === 'sokol') return {
      L: 6.6, eye: [0, 0.74, 0.15], N: 14,
      fuse: [
        { z: -3.3, w: 0.36, h: 0.36, y: 0.06, n: 2 }, { z: -3.18, w: 0.74, h: 0.74, y: 0.05, n: 2.2 }, { z: -2.8, w: 0.94, h: 0.92, y: 0.05, n: 2.6 },
        { z: -1.9, w: 1.0, h: 1.02, y: 0.05, n: 2.8 }, { z: -0.9, w: 0.96, h: 1.04, y: 0.04, n: 2.8 }, { z: 0.3, w: 0.84, h: 0.98, y: 0.04, n: 2.7 },
        { z: 1.4, w: 0.6, h: 0.78, y: 0.06, n: 2.5 }, { z: 2.5, w: 0.34, h: 0.54, y: 0.1, n: 2.3 }, { z: 3.25, w: 0.14, h: 0.34, y: 0.14, n: 2.2 }, { z: 3.5, w: 0.05, h: 0.16, y: 0.15, n: 2 }],
      canopy: { z0: -0.75, z1: 1.35, w: 0.66, h: 0.5, y: 0.46 },
      wing: { y: -0.32, half: 3.75, z: -1.35, rc: 1.92, tc: 0.95, sweep: 0.42, dih: 0.0, t: 0.15, m: 0, flaps: null, ail: [0.16, 0.96], tip: 'square' },
      hs: { y: 0.14, half: 1.3, z: 2.55, rc: 0.95, tc: 0.55, sweep: 0.3, t: 0.1, cut: 0.5 },
      vs: { y: 0.3, h: 1.05, z: 2.45, rc: 1.12, tc: 0.55, sweep: 0.5, t: 0.1, cut: 0.5 },
      spin: { r: 0.18, len: 0.4, z: -3.3 }, gearPants: true,
    };
    return {
      L: 9.8, eye: [0, 1.0, 0.6], N: 16,
      fuse: [
        { z: -5.0, w: 0.5, h: 0.5, y: 0.05, n: 2 }, { z: -4.82, w: 1.08, h: 1.12, y: 0.04, n: 2.2 }, { z: -4.3, w: 1.3, h: 1.4, y: 0.04, n: 2.4 },
        { z: -3.0, w: 1.38, h: 1.5, y: 0.06, n: 2.5 }, { z: -1.4, w: 1.42, h: 1.56, y: 0.04, n: 2.5 }, { z: 0.0, w: 1.36, h: 1.56, y: 0.0, n: 2.4 },
        { z: 1.4, w: 1.12, h: 1.36, y: 0.03, n: 2.3 }, { z: 2.8, w: 0.76, h: 1.02, y: 0.1, n: 2.2 }, { z: 4.0, w: 0.4, h: 0.68, y: 0.2, n: 2.1 },
        { z: 4.85, w: 0.16, h: 0.4, y: 0.26, n: 2 }, { z: 5.1, w: 0.05, h: 0.16, y: 0.28, n: 2 }],
      canopy: { z0: -0.2, z1: 1.9, w: 0.7, h: 0.56, y: 0.66 },
      wing: { y: -0.42, half: 5.65, z: -1.25, rc: 2.65, tc: 0.9, sweep: 0.35, dih: 0.075, t: 0.14, m: 0.015, flaps: [0.12, 0.5], ail: [0.54, 0.9], tip: 'ellipse' },
      hs: { y: 0.28, half: 1.95, z: 3.9, rc: 1.15, tc: 0.55, sweep: 0.3, t: 0.09, cut: 0.6 },
      vs: { y: 0.4, h: 1.55, z: 3.55, rc: 1.45, tc: 0.6, sweep: 0.7, t: 0.09, cut: 0.62 },
      spin: { r: 0.42, len: 0.75, z: -5.0 }, gearPants: false, scoop: true,
    };
  },
  // livreje: barva podle polohy na letadle (x vpravo, y nahoru, z dozadu)
  livery(id, paint) {
    const P = PLANES[id], main = paint || P.col, sec = P.col2;
    const lighten = (h, k) => { const c = new THREE.Color(h); c.lerp(new THREE.Color(0xffffff), k); return c.getHex(); };
    if (id === 'cmelak') return {
      fuse: (x, y, z) => {
        if (z > -1.42 && z < 0.62 && y > 0.62 && Math.abs(x) > 0.28) return 0x1e2c3a;               // boční okna
        if (z > -1.45 && z < -0.95 && y > 0.62) return 0x24364a;                                   // čelní sklo
        if (Math.abs(y - 0.1) < 0.12 && Math.abs(x) > 0.3 && z > -2.9) return sec;                  // linka po boku
        if (z < -1.5 && z > -3.1 && y > 0.5) return 0x2a2a2a;                                      // antireflexní kapota
        return main;
      },
      wing: (x) => Math.abs(x) > 4.7 ? sec : main, tail: () => main, surf: () => main,
    };
    if (id === 'sokol') return {
      fuse: (x, y, z) => {
        if (z < -1.9) return main;                                                                 // barevný motorový kryt
        const d = z + y * 1.4 + Math.abs(x) * 0.3;                                                 // šikmé pruhy
        if (Math.sin(d * 2.4) > 0.55) return main;
        return 0xf2f2ee;
      },
      // paprsky „slunce“ na křídle
      wing: (x, y, z) => { const a = Math.atan2(z + 0.5, Math.abs(x) + 0.2); return Math.floor((a + 2) * 4.5) % 2 ? main : 0xf2f2ee; },
      tail: (x, y, z) => (Math.floor((y + z) * 3) % 2 ? main : 0xf2f2ee), surf: () => main,
    };
    return {
      fuse: (x, y, z) => {
        if (z < -4.2) return (Math.floor(Math.atan2(y, x) * 2.6) + Math.floor(z * 4)) % 2 ? 0xf2f2ee : 0x141414;   // šachovnice na nose
        if (y < -0.12) return lighten(sec, 0.1);                                                   // stříbrné břicho
        if (Math.abs(y - 0.12) < 0.11 && z > -4.1 && z < 4.6) return 0xf2f2ee;                      // bílá linka
        return main;
      },
      wing: (x, y, z) => (Math.abs(x) > 4.6 && Math.abs(x) < 4.9 ? 0xf2f2ee : y < -0.45 ? lighten(sec, 0.1) : main),
      tail: (x, y, z) => (y > 1.5 ? 0xf2f2ee : main), surf: () => main,
    };
  },

  // ---------- stavba letadla ----------
  build(id, paint) {
    const P = PLANES[id], S = this.shape(id), M = this.mats(P), LV = this.livery(id, paint);
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const o = { root, body, P, id, main: U.mat(paint || P.col), ail: [], flaps: [], gear: [], L: S.L, half: S.wing.half };
    const add = (geo, mat, par) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; (par || body).add(m); return m; };
    // --- trup ---
    // trup; u letadel s překrytem se horní plech nad kokpitem dá zvlášť (o.deck) – z pohledu pilota se schová,
    // jinak by zakrýval spodní řadu budíků
    if (S.canopy && typeof AirCockpit !== 'undefined') {
      const cd = AirCockpit.dims(id), pz = S.eye[2] - cd.D - 0.13, z1 = S.eye[2] + 0.7;   // deska je nakloněná, spodní hrana ~7 cm před svislicí
      // vložit průřezy přesně na hranice výřezu (jinak by okraj dlouhého dílu trupu vyčníval před desku)
      const secs = S.fuse.slice();
      for (const zc of [pz, z1]) {
        const i = secs.findIndex(f => f.z > zc); if (i <= 0) continue;
        const A = secs[i - 1], B = secs[i], t = (zc - A.z) / (B.z - A.z), L = (k) => U.lerp(A[k] || 0, B[k] || 0, t);
        secs.splice(i, 0, { z: zc, w: L('w'), h: L('h'), y: L('y'), n: L('n') || 2.3 });
      }
      const rings = secs.map(f => this.sect(f, S.N));
      const cut = (x, y, z) => z > pz && z < z1 && y > cd.sill - 0.14 && Math.abs(x) < cd.hw + 0.12;
      add(this.skin(rings, LV.fuse, true, true, (x, y, z) => !cut(x, y, z)), M.paint);
      o.deck = add(this.skin(rings, LV.fuse, false, false, cut), M.paint);
    } else add(this.fuse(S.fuse, S.N, LV.fuse), M.paint);
    // --- kabina ---
    if (S.canopy) {
      const c = S.canopy, secs = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8, k = Math.sin(Math.PI * Math.pow(u, 0.8));
        secs.push(this.sect({ z: U.lerp(c.z0, c.z1, u), w: c.w * Math.max(0.08, Math.sqrt(k)), h: c.h * Math.max(0.05, k) * 2, y: c.y, n: 2.2 }, 12).filter((v, j) => true));
      }
      // jen horní polovina bubliny
      const half = secs.map(r => r.map(v => { const w = v.clone(); if (w.y < c.y) w.y = c.y; return w; }));
      o.glass = add(this.skin(half, null, true, true), M.glass); o.glass.castShadow = false;
      // rám kabiny
      for (const zz of [c.z0 + (c.z1 - c.z0) * 0.3, c.z0 + (c.z1 - c.z0) * 0.72]) {
        const fr = new THREE.Mesh(new THREE.TorusGeometry(c.w * 0.47, 0.025, 4, 14, Math.PI), M.dark); fr.position.set(0, c.y, zz); fr.scale.set(1, c.h / c.w * 1.85, 1); body.add(fr);
      }
    } else {
      // hornoplošník: rámy oken
      for (const zz of [-1.42, -0.4, 0.6]) for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.82, 0.06), M.dark); b.position.set(s * 0.55, 0.98, zz); b.rotation.z = -s * 0.05; body.add(b); }
    }
    // --- křídlo ---
    const W = S.wing, hw = W.half;
    const wShape = (u) => {
      let c = U.lerp(W.rc, W.tc, u), le = W.z + W.sweep * u * (W.rc - W.tc) / Math.max(0.01, W.rc - W.tc) * 0 + W.sweep * u;
      if (W.tip === 'ellipse') { c = W.rc * Math.sqrt(Math.max(0.04, 1 - Math.pow(u, 2.2))); le = W.z + (W.rc - c) * 0.32; }
      if (W.tip === 'round' && u > 0.96) { const k = (u - 0.96) / 0.04; c *= 1 - 0.35 * k * k; le += W.tc * 0.18 * k * k; }
      return { c, le, y: W.y + W.dih * u * hw };
    };
    const wPlace = (s, y, z) => new THREE.Vector3(s, y, z);
    const CUT = 0.74;
    for (const sg of [-1, 1]) {
      const st = this.stations(hw, 0, 1, wShape, sg, 12);
      add(this.wingGeo(st, W.t, W.m, 0, CUT, wPlace, LV.wing), M.paint);
      // odtoková část: klapky, pevné kusy, křidélka
      const parts = [];
      let at = 0;
      const seg = (a, b, kind) => { if (b > a + 0.005) parts.push([a, b, kind]); };
      if (W.flaps && P.flapCL.length > 1) { seg(0, W.flaps[0], 'fix'); seg(W.flaps[0], W.flaps[1], 'flap'); at = W.flaps[1]; }
      seg(at, W.ail[0], 'fix'); seg(W.ail[0], W.ail[1], 'ail'); seg(W.ail[1], 1, 'fix');
      for (const [a, b, kind] of parts) {
        if (kind === 'fix') add(this.wingGeo(this.stations(hw, a, b, wShape, sg, 3), W.t, W.m, CUT, 1, wPlace, LV.wing), M.paint);
        else {
          const g = this.hinged(body, hw, sg < 0 ? b : a, sg < 0 ? a : b, wShape, sg, W.t, W.m, CUT, wPlace, LV.surf, M.paint);
          (kind === 'ail' ? o.ail : o.flaps).push(g);
        }
      }
      // poziční světla na konci křídla
      const tq = wShape(1), nl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: sg < 0 ? 0xff2a2a : 0x2aff5a }));
      nl.position.set(sg * hw * 1.0, tq.y, tq.le + tq.c * 0.15); body.add(nl);
    }
    // pořadí jako dřív: [levé, pravé]
    o.ail.sort((a, b) => a.parent.position.x - b.parent.position.x);
    // vzpěry hornoplošníku
    if (P.look === 'high') for (const s of [-1, 1]) {
      const A = new THREE.Vector3(s * 0.52, -0.25, -0.75), B = new THREE.Vector3(s * hw * 0.48, W.y - 0.05, W.z + 0.45);
      const d = new THREE.Vector3().subVectors(B, A), st = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, d.length(), 6), M.metal);
      st.position.copy(A).addScaledVector(d, 0.5); st.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); body.add(st);
    }
    // přechod křídlo-trup (aerodynamický „fillet“) u dolnoplošníků
    if (P.look !== 'high') {
      const f = S.fuse.reduce((a, b) => (Math.abs(b.z - (W.z + W.rc * 0.4)) < Math.abs(a.z - (W.z + W.rc * 0.4)) ? b : a));
      add(this.fuse([{ z: W.z - 0.1, w: 0.2, h: 0.12, y: W.y + 0.02, n: 2 }, { z: W.z + 0.3, w: f.w + 0.12, h: 0.3, y: W.y + 0.04, n: 2.4 }, { z: W.z + W.rc * 0.8, w: f.w + 0.1, h: 0.3, y: W.y + 0.04, n: 2.4 }, { z: W.z + W.rc + 0.5, w: 0.2, h: 0.12, y: W.y + 0.06, n: 2 }], 10, () => LV.fuse(0, -0.3, 0)), M.paint);
    }
    // --- vodorovná ocasní plocha + výškovka ---
    const H = S.hs, hShape = (u) => ({ c: U.lerp(H.rc, H.tc, u), le: H.z + H.sweep * u, y: H.y });
    const elevs = [];
    for (const sg of [-1, 1]) {
      add(this.wingGeo(this.stations(H.half, 0, 1, hShape, sg, 5), H.t, 0, 0, H.cut, wPlace, LV.tail), M.paint);
      elevs.push(this.hinged(body, H.half, sg < 0 ? 1 : 0.04, sg < 0 ? 0.04 : 1, hShape, sg, H.t, 0, H.cut, wPlace, LV.surf, M.paint));
    }
    // výškovka = jedna „virtuální“ skupina, která natáčí obě poloviny
    o.elev = { rotation: { set x(v) { elevs.forEach(e => { e.rotation.x = v; }); }, get x() { return elevs[0].rotation.x; } } };
    // --- svislá ocasní plocha + směrovka ---
    const V = S.vs, vShape = (u) => ({ c: U.lerp(V.rc, V.tc, u), le: V.z + V.sweep * u, y: 0 });
    const vPlace = (s, y, z) => new THREE.Vector3(y, V.y + s, z);
    add(this.wingGeo(this.stations(V.h, 0, 1, vShape, 1, 5), V.t, 0, 0, V.cut, vPlace, LV.tail), M.paint);
    // hřbetní ploutev (dorsal fin) do trupu
    add(this.wingGeo([{ s: -0.05, c: V.rc * 1.6, le: V.z - V.rc * 0.6, y: 0 }, { s: 0.25, c: V.rc * 0.9, le: V.z + 0.1, y: 0 }], V.t * 0.7, 0, 0, 0.95, vPlace, LV.tail), M.paint);
    const rd = this.hinged(body, V.h, 0.02, 1, vShape, 1, V.t, 0, V.cut, vPlace, LV.surf, M.paint);
    o.rud = { rotation: { set y(v) { rd.rotation.x = 0; rd.rotation.y = v; }, get y() { return rd.rotation.y; } } };
    // natočení kolem svislého pantu: vnitřní skupina má osu y podél pantu → rotation.y
    // --- vrtule: kužel + kroucené listy + kotouč ---
    const sp = S.spin, prop = new THREE.Group(); prop.position.set(0, S.fuse[0].y, sp.z); body.add(prop); o.prop = prop;
    const spPts = []; for (let i = 0; i <= 8; i++) { const u = i / 8; spPts.push(new THREE.Vector2(sp.r * Math.sin(u * Math.PI / 2) ** 0.8, -sp.len * (1 - u))); }
    const spg = new THREE.LatheGeometry(spPts.reverse(), 16); spg.rotateX(Math.PI / 2);
    const spM = new THREE.MeshPhongMaterial({ color: id === 'sokol' ? 0xf2f2ee : id === 'strela' ? 0xd8d8d8 : 0x222222, shininess: 90, specular: 0x777777 });
    prop.add(new THREE.Mesh(spg, spM));
    o.blades = new THREE.Group(); prop.add(o.blades);
    const R = P.propR, blade = (() => {
      const st = [], prof = this.foil(0.12, 0.04, 0, 1, 4);
      const rings = [];
      for (let i = 0; i <= 6; i++) {
        const u = i / 6, r = U.lerp(sp.r * 0.6, R, u), c = U.lerp(0.2, 0.08, u * u) * (R / 1), tw = U.lerp(0.9, 0.25, u);
        rings.push(prof.map(([x, y]) => { const px = (x - 0.35) * c, py = y * c; return new THREE.Vector3(Math.cos(tw) * px - Math.sin(tw) * py, r, Math.sin(tw) * px + Math.cos(tw) * py); }));
      }
      return this.skin(rings, (x, y) => (y > R * 0.88 ? 0xf0c020 : 0x1a1a1a), true, true);
    })();
    for (let i = 0; i < P.blades; i++) { const m = new THREE.Mesh(blade, M.paint); m.rotation.z = i * Math.PI * 2 / P.blades; m.castShadow = true; o.blades.add(m); }
    o.disc = new THREE.Mesh(new THREE.CircleGeometry(R, 32), new THREE.MeshBasicMaterial({ color: 0x202020, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    o.disc.position.z = -0.02; prop.add(o.disc);
    // --- detaily motoru ---
    if (id === 'strela') {
      for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const e = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.22, 6), M.dark); e.rotation.z = s * Math.PI / 2; e.position.set(s * 0.69, 0.32, -3.9 + i * 0.36); body.add(e); }
      // chladič pod trupem
      add(this.fuse([{ z: -0.3, w: 0.3, h: 0.1, y: -0.82, n: 2 }, { z: 0.4, w: 0.9, h: 0.5, y: -0.86, n: 2.6, flatB: 0.9 }, { z: 1.6, w: 0.9, h: 0.55, y: -0.82, n: 2.6, flatB: 0.9 }, { z: 2.3, w: 0.7, h: 0.3, y: -0.7, n: 2.4 }], 12, () => LV.fuse(0, -0.5, 0)), M.paint);
      const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.4), M.dark); mouth.position.set(0, -0.9, 0.39); mouth.rotation.y = Math.PI; body.add(mouth);
    } else {
      const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.4, 8), M.metal); ex.rotation.x = Math.PI / 2 - 0.4; ex.position.set(0.25, -0.45, -2.5); body.add(ex);
      const ex2 = ex.clone(); ex2.position.x = -0.25; body.add(ex2);
    }
    // pitotka, anténa
    const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 4), M.metal); pit.rotation.x = Math.PI / 2; pit.position.set(-hw * 0.62, wShape(0.62).y - 0.08, wShape(0.62).le - 0.15); body.add(pit);
    const ant = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.35, 0.12), M.dark); ant.position.set(0, S.fuse[6].y + S.fuse[6].h / 2 + 0.15, S.fuse[6].z + 0.4); ant.rotation.x = 0.35; body.add(ant);
    // --- podvozek (stejné body jako fyzika) ---
    const G = this.gearPts(id); o.gearPts = G;
    for (const g of G) {
      const grp = new THREE.Group(); grp.position.set(g.p[0], g.p[1] + g.r, g.p[2]); body.add(grp);
      const top = g.tail ? 0.42 : (P.look === 'high' ? -0.2 : W.y + 0.05) - (g.p[1] + g.r);
      const lean = g.tail ? 0 : (P.look === 'racer' ? 0.0 : -Math.sign(g.p[0]) * 0.32);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, top / Math.cos(lean), 6), M.metal);
      st.position.set(-Math.tan(lean) * top / 2 * -1 * 0 + Math.sin(lean) * top / 2 * -1, top / 2, 0); st.rotation.z = lean; grp.add(st);
      const wg = new THREE.CylinderGeometry(g.r, g.r, g.r * 0.62, 18); wg.rotateZ(Math.PI / 2);
      const wh = new THREE.Group(); grp.add(wh);
      wh.add(new THREE.Mesh(wg, M.rubber));
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(g.r * 0.5, g.r * 0.5, g.r * 0.66, 10), M.metal); hub.rotation.z = Math.PI / 2; wh.add(hub);
      if (!g.tail && S.gearPants) {   // aerodynamický kryt kola (kapka)
        add(this.fuse([{ z: -g.r * 2.2, w: 0.06, h: 0.06, y: 0.02, n: 2 }, { z: -g.r * 1.2, w: g.r * 0.95, h: g.r * 1.7, y: 0.02, n: 2.2 }, { z: 0, w: g.r * 1.0, h: g.r * 2.3, y: 0.04, n: 2.2 }, { z: g.r * 1.4, w: g.r * 0.7, h: g.r * 1.4, y: 0.08, n: 2.2 }, { z: g.r * 2.8, w: 0.05, h: 0.12, y: 0.12, n: 2 }], 12, () => paint || P.col), M.paint, grp);
      }
      if (P.retract && !g.tail) { const door = new THREE.Mesh(new THREE.BoxGeometry(0.03, top * 0.8, g.r * 2), new THREE.MeshPhongMaterial({ color: paint || P.col, flatShading: true })); door.position.set(Math.sign(g.p[0]) * 0.1, top * 0.45, 0); grp.add(door); }
      o.gear.push({ grp, wh, g, rest: grp.position.y });
    }
    // --- závodní číslo ---
    const num = U.textTexture(String(10 + Math.floor(Math.random() * 89)), 128, 128, 'rgba(255,255,255,0.95)', '#111', 'bold 80px Arial');
    const nf = S.fuse.find(f => f.z > (id === 'strela' ? 1.2 : 0.9)) || S.fuse[6];
    for (const s of [-1, 1]) { const n = new THREE.Mesh(new THREE.CircleGeometry(Math.min(0.32, nf.h * 0.3), 20), new THREE.MeshLambertMaterial({ map: num })); n.position.set(s * (nf.w / 2 + 0.012), nf.y, nf.z); n.rotation.y = s * Math.PI / 2; body.add(n); }
    // --- pilot ---
    const eyeY = S.eye[1], eyeZ = S.eye[2];
    o.eye = new THREE.Vector3(0, eyeY, eyeZ);
    const head = new THREE.Group(); head.position.set(0, eyeY - 0.04, eyeZ + 0.12); body.add(head); o.head = head;
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 9), new THREE.MeshPhongMaterial({ color: 0xf0f0f0, shininess: 70 })));
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.152, 12, 6, -Math.PI * 0.35, Math.PI * 0.7, Math.PI * 0.38, Math.PI * 0.24), new THREE.MeshPhongMaterial({ color: 0x202838, shininess: 120, specular: 0xffffff }));
    visor.rotation.y = Math.PI; head.add(visor);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.25), U.mat(0x3a4a5a)); torso.position.set(0, eyeY - 0.36, eyeZ + 0.2); body.add(torso); o.torso = torso;
    // --- kokpit (jen z pohledu pilota) ---
    const ck = o.cockpit = new THREE.Group(); ck.visible = false; body.add(ck);
    // interiér (deska s budíky, knipl, plyn, ruce…) staví AirCockpit.build až při prvním pohledu z kokpitu
    // slití statických dílů do jednoho meshe na skupinu (méně draw callů – letadel bývá v závodě hodně)
    o.vmat = new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 55, specular: 0x303030 });
    const keep = new Set([o.glass, o.torso, o.deck]);
    this.merge(body, o.vmat, keep);
    for (const G of o.gear) { this.merge(G.grp, o.vmat, keep); this.merge(G.wh, o.vmat, keep); }
    this.merge(o.blades, o.vmat, keep); this.merge(o.head, o.vmat, keep);
    return o;
  },
  // sloučí přímé potomky-meshe skupiny (neprůhledné, bez textury) do jednoho meshe s barvami ve vrcholech
  merge(grp, mat, keep) {
    const list = grp.children.filter(m => m.isMesh && !keep.has(m) && !m.material.transparent && !m.material.map && !m.material.isMeshBasicMaterial);
    if (list.length < 2) return;
    const pos = [], col = [], C = new THREE.Color();
    for (const m of list) {
      m.updateMatrix();
      const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrix);
      const p = g.attributes.position, cA = m.material.vertexColors ? g.attributes.color : null;
      C.copy(m.material.color);
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        if (cA) col.push(cA.getX(i) * C.r, cA.getY(i) * C.g, cA.getZ(i) * C.b); else col.push(C.r, C.g, C.b);
      }
      grp.remove(m); g.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const mm = new THREE.Mesh(g, mat); mm.castShadow = true; mm.receiveShadow = true; grp.add(mm);
  },
  // body podvozku v souřadnicích těla: p = spodek kola při plném vysunutí, r = poloměr kola
  gearPts(id) {
    const P = PLANES[id];
    if (P.look === 'high') return [{ p: [-0.95, -1.45, -1.05], r: 0.24 }, { p: [0.95, -1.45, -1.05], r: 0.24 }, { p: [0, -0.62, 3.6], r: 0.1, tail: true }];
    if (P.look === 'low') return [{ p: [-0.9, -1.28, -1.0], r: 0.22 }, { p: [0.9, -1.28, -1.0], r: 0.22 }, { p: [0, -0.55, 3.3], r: 0.09, tail: true }];
    return [{ p: [-1.75, -1.75, -0.7], r: 0.36 }, { p: [1.75, -1.75, -0.7], r: 0.36 }, { p: [0, -0.8, 4.4], r: 0.14, tail: true }];
  },
  // natočení kormidel, vrtule, podvozku podle stavu fyziky
  pose(o, st, dt) {
    const P = o.P;
    if (o.ail.length) { o.ail[0].rotation.x = st.da; o.ail[1].rotation.x = -st.da; }
    o.elev.rotation.x = -st.de;
    o.rud.rotation.y = st.dr;
    for (const f of o.flaps) f.rotation.x = U.lerp(f.rotation.x, [0, 0.35, 0.7][st.flaps] || 0, Math.min(1, dt * 2));
    const w = st.rpm / 60 * Math.PI * 2;
    o.blades.rotation.z += w * dt * (st.rpm > 1500 ? 0.07 : 1);   // stroboskop: rychlé otáčky = pomalé listy + kotouč
    o.disc.material.opacity = U.clamp((st.rpm - 500) / 1500, 0, 1) * 0.22;
    const gUp = st.gearPos === undefined ? 0 : 1 - st.gearPos;
    o.gear.forEach((G, i) => {
      const comp = st.comp ? st.comp[i] || 0 : 0;
      G.grp.position.y = G.rest + comp;
      G.wh.rotation.x += (st.wv ? st.wv[i] || 0 : 0) * dt;
      G.grp.visible = gUp < 0.98;
      G.grp.rotation.x = P.retract ? -gUp * 1.5 : 0;
      if (G.g.tail) G.grp.rotation.y = -st.steer || 0;
    });
  },
};
