// buildings.js – texturované budovy s místnostmi, skutečnými okny (díry + sklo), nábytkem a místy pro loot
const Buildings = (() => {
  const C = (h) => (typeof h === 'number' ? new THREE.Color(h) : h);
  const glassMat = new THREE.MeshLambertMaterial({ color: 0xa8d0dc, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const pick = (r, a) => a[Math.floor(r() * a.length)];

  // kontext jedné budovy: lokální souřadnice (dveře míří na +z), volitelné zrcadlení v ose x
  function ctx(h, cols, floors, mir) {
    const c = Math.cos(h.ry), s = Math.sin(h.ry), y0 = h.y, M = {}, glass = new U.Merger();
    const toW = (lx, lz) => { lx *= mir; return [h.x + lx * c + lz * s, h.z - lx * s + lz * c]; };
    const get = (mat) => M[mat] || (M[mat] = mat === 'vc' ? new U.Merger() : new U.TexMerger());
    const b = {
      toW, y0, mir,
      box(mat, w, hh, d, lx, ly, lz, color, collide, tile, ry2) {
        const [wx, wz] = toW(lx, lz), ry = h.ry + (ry2 || 0) * mir;
        if (mat === 'vc') get('vc').addBox(w, hh, d, wx, y0 + ly, wz, ry, C(color));
        else get(mat).addBox(w, hh, d, wx, y0 + ly, wz, ry, C(color), tile || 2);
        if (collide) cols.push({ t: 'b', x: wx, z: wz, hw: w / 2, hd: d / 2, ry, kind: 'wall' });
      },
      prism(mat, W, Hr, Lz, lx, yb, lz, color, ry2) {
        const [wx, wz] = toW(lx, lz), sz = Hr / 1.5;
        const m4 = U.compose(wx, y0 + yb + 0.5 * sz, wz, -Math.PI / 2, h.ry + (ry2 || 0) * mir, 0, W / 1.732, Lz, sz);
        if (mat === 'vc') get('vc').add(Props.T.prism, m4, C(color)); else get(mat).add(Props.T.prism, m4, C(color), Lz / 1.5, W / 1.5);
      },
      cyl(mat, r, hh, lx, ly, lz, color, collide) {
        const [wx, wz] = toW(lx, lz), m4 = U.compose(wx, y0 + ly, wz, 0, 0, 0, r, hh, r);
        if (mat === 'vc') get('vc').add(Props.T.cyl8, m4, C(color)); else get(mat).add(Props.T.cyl8, m4, C(color), 2, hh);
        if (collide) cols.push({ t: 'c', x: wx, z: wz, r, kind: 'wall' });
      },
      glass(w, hh, d, lx, ly, lz, ry2) { const [wx, wz] = toW(lx, lz); glass.addBox(w, hh, d, wx, y0 + ly, wz, h.ry + (ry2 || 0) * mir, C(0xffffff)); },
      floor(lx, lz, hw, hd, top) { const [wx, wz] = toW(lx, lz); floors.push({ t: 'b', x: wx, z: wz, hw, hd, ry: h.ry, y: y0 + top }); },
      // zeď podél osy 'x' (v hloubce fixed) nebo 'z'; otvory {c, w, y0, y1, win}
      wall(mat, color, axis, fixed, a0, a1, H, t, base, openings, tile) {
        const seg = (a, e, ya, yb, col) => {
          if (e - a < 0.01 || yb - ya < 0.01) return;
          const mid = (a + e) / 2, len = e - a, cy = base + (ya + yb) / 2;
          if (axis === 'x') this.box(mat, len, yb - ya, t, mid, cy, fixed, color, col, tile);
          else this.box(mat, t, yb - ya, len, fixed, cy, mid, color, col, tile);
        };
        let cur = a0;
        for (const o of (openings || []).slice().sort((p, q) => p.c - q.c)) {
          const a = o.c - o.w / 2, e = o.c + o.w / 2;
          seg(cur, a, 0, H, true);
          seg(a, e, 0, o.y0, true);
          seg(a, e, o.y1, H, o.y0 > 0);
          const fr = 0.06, fc = o.win ? 0xf0ece0 : 0x5a3a24, oh = o.y1 - o.y0, oc = base + (o.y0 + o.y1) / 2;
          const P = (along, y, w, hh) => (axis === 'x' ? this.box('vc', w, hh, t + 0.05, along, y, fixed, fc) : this.box('vc', t + 0.05, hh, w, fixed, y, along, fc));
          P(a + fr / 2, oc, fr, oh); P(e - fr / 2, oc, fr, oh); P(o.c, base + o.y1 - fr / 2, o.w, fr);
          if (o.win) {
            P(o.c, base + o.y0 + fr / 2, o.w, fr); P(o.c, oc, 0.04, oh);                         // parapet + příčka
            if (axis === 'x') this.glass(o.w, oh, 0.02, o.c, oc, fixed); else this.glass(0.02, oh, o.w, fixed, oc, o.c);
          }
          cur = e;
        }
        seg(cur, a1, 0, H, true);
      },
      build(group) {
        for (const k in M) { const mesh = k === 'vc' ? M[k].build() : M[k].build(Tex.mat(k)); if (mesh) group.add(mesh); }
        const gm = glass.build(glassMat); if (gm) { gm.castShadow = false; group.add(gm); }
      },
    };
    return b;
  }
  // posun v lokálním otočení (pro nábytek natočený o ry)
  const rot = (lx, lz, ox, oz, ry) => [lx + ox * Math.cos(ry) + oz * Math.sin(ry), lz - ox * Math.sin(ry) + oz * Math.cos(ry)];

  // ---------- nábytek ----------
  const F = {
    table(b, B, x, z, w, d, ht, ry) {
      ry = ry || 0; b.box('floor', w, 0.05, d, x, B + ht, z, 0xd0a878, true, 1, ry);
      for (const [ox, oz] of [[w / 2 - 0.06, d / 2 - 0.06], [-w / 2 + 0.06, d / 2 - 0.06], [w / 2 - 0.06, -d / 2 + 0.06], [-w / 2 + 0.06, -d / 2 + 0.06]]) {
        const [px, pz] = rot(x, z, ox, oz, ry); b.box('vc', 0.06, ht, 0.06, px, B + ht / 2, pz, 0x6a4a30, false, 0, ry);
      }
      return B + ht + 0.03;
    },
    chair(b, B, x, z, ry) {
      b.box('vc', 0.45, 0.05, 0.45, x, B + 0.45, z, 0x8a6040, false, 0, ry);
      const [bx, bz] = rot(x, z, 0, -0.2, ry); b.box('vc', 0.45, 0.5, 0.05, bx, B + 0.72, bz, 0x8a6040, false, 0, ry);
      for (const [ox, oz] of [[0.18, 0.18], [-0.18, 0.18], [0.18, -0.18], [-0.18, -0.18]]) { const [px, pz] = rot(x, z, ox, oz, ry); b.box('vc', 0.04, 0.45, 0.04, px, B + 0.22, pz, 0x5a3a24, false, 0, ry); }
    },
    sofa(b, B, x, z, ry, col) {
      b.box('fabric', 2.0, 0.42, 0.85, x, B + 0.21, z, col, true, 1, ry);
      let [px, pz] = rot(x, z, 0, -0.33, ry); b.box('fabric', 2.0, 0.5, 0.2, px, B + 0.62, pz, col, false, 1, ry);
      for (const sx of [-0.95, 0.95]) { [px, pz] = rot(x, z, sx, 0, ry); b.box('fabric', 0.12, 0.62, 0.85, px, B + 0.31, pz, col, false, 1, ry); }
      [px, pz] = rot(x, z, 0.5, 0.05, ry); b.box('fabric', 0.85, 0.12, 0.6, px, B + 0.48, pz, C(col).clone().multiplyScalar(0.9), false, 1, ry);
      return B + 0.48;
    },
    bed(b, B, x, z, ry, col) {
      b.box('vc', 1.6, 0.35, 2.1, x, B + 0.175, z, 0x6a4a30, true, 0, ry);
      b.box('fabric', 1.5, 0.2, 2.0, x, B + 0.45, z, 0xf2eee6, false, 1, ry);
      let [px, pz] = rot(x, z, 0, 0.25, ry); b.box('fabric', 1.55, 0.06, 1.4, px, B + 0.58, pz, col, false, 1, ry);
      [px, pz] = rot(x, z, 0, -0.8, ry); b.box('fabric', 1.0, 0.12, 0.35, px, B + 0.61, pz, 0xffffff, false, 1, ry);
      [px, pz] = rot(x, z, 0, -1.02, ry); b.box('planks', 1.7, 0.9, 0.08, px, B + 0.45, pz, 0x8a6040, false, 1, ry);
      return B + 0.62;
    },
    wardrobe(b, B, x, z, ry) {
      b.box('planks', 1.2, 2.0, 0.6, x, B + 1.0, z, 0xa07850, true, 1, ry);
      const [px, pz] = rot(x, z, 0, 0.305, ry); b.box('vc', 0.02, 1.8, 0.02, px, B + 1.0, pz, 0x3a2416, false, 0, ry);
      return B + 2.02;
    },
    shelf(b, B, x, z, w, ry, r) {
      for (const sx of [-w / 2, w / 2]) { const [px, pz] = rot(x, z, sx, 0, ry); b.box('vc', 0.04, 1.8, 0.4, px, B + 0.9, pz, 0x6a4a30, true, 0, ry); }
      for (let k = 0; k < 4; k++) {
        b.box('floor', w, 0.03, 0.4, x, B + 0.1 + k * 0.55, z, 0xb08860, false, 1, ry);
        for (let i = 0; i < 4; i++) if (r() < 0.6) {
          const [px, pz] = rot(x, z, -w / 2 + 0.15 + i * (w - 0.3) / 3, 0, ry), hh = 0.15 + r() * 0.2;
          b.box('vc', 0.12 + r() * 0.1, hh, 0.22, px, B + 0.12 + k * 0.55 + hh / 2, pz, pick(r, [0x8a3a2a, 0x2a5a8a, 0xd8b040, 0x4a7a3a, 0xe8e0d0]), false, 0, ry);
        }
      }
      return [B + 0.67, B + 1.22];
    },
    counter(b, B, x, z, len, ry, withSink, withStove) {
      b.box('planks', len, 0.85, 0.6, x, B + 0.425, z, 0xe8e0d0, true, 1, ry);
      b.box('concrete', len + 0.04, 0.05, 0.64, x, B + 0.875, z, 0xffffff, false, 1, ry);
      if (withSink) { const [px, pz] = rot(x, z, -len / 2 + 0.5, 0, ry); b.box('vc', 0.5, 0.02, 0.4, px, B + 0.905, pz, 0x8a9090, false, 0, ry); }
      if (withStove) for (const [ox, oz] of [[0.15, 0.12], [-0.15, 0.12], [0.15, -0.12], [-0.15, -0.12]]) {
        const [px, pz] = rot(x, z, len / 2 - 0.45 + ox, oz, ry); b.cyl('vc', 0.08, 0.02, px, B + 0.91, pz, 0x222222);
      }
      return B + 0.9;
    },
    fridge(b, B, x, z, ry) {
      b.box('vc', 0.75, 1.8, 0.7, x, B + 0.9, z, 0xf0f0ea, true, 0, ry);
      const [px, pz] = rot(x, z, 0.3, 0.36, ry); b.box('vc', 0.03, 0.5, 0.03, px, B + 1.1, pz, 0x9a9a9a, false, 0, ry);
      return B + 1.82;
    },
    bathtub(b, B, x, z, ry) {
      b.box('vc', 1.8, 0.55, 0.8, x, B + 0.275, z, 0xf4f4f0, true, 0, ry);
      b.box('vc', 1.6, 0.02, 0.6, x, B + 0.56, z, 0xb8d0d8, false, 0, ry);
    },
    toilet(b, B, x, z, ry) {
      b.cyl('vc', 0.2, 0.4, x, B + 0.2, z, 0xf4f4f0, true);
      const [px, pz] = rot(x, z, 0, -0.25, ry); b.box('vc', 0.4, 0.4, 0.18, px, B + 0.6, pz, 0xf4f4f0, false, 0, ry);
    },
    rug(b, B, x, z, w, d, col, ry) { b.box('fabric', w, 0.02, d, x, B + 0.02, z, col, false, 0.6, ry); },
    lamp(b, B, x, z) { b.cyl('vc', 0.03, 1.4, x, B + 0.7, z, 0x3a3a3a); b.cyl('vc', 0.2, 0.25, x, B + 1.5, z, 0xf0d8a0); },
    tv(b, B, x, z, ry) {
      b.box('vc', 1.0, 0.5, 0.4, x, B + 0.25, z, 0x5a3a24, true, 0, ry);
      b.box('vc', 0.7, 0.5, 0.45, x, B + 0.75, z, 0x2a2a2a, false, 0, ry);
      const [px, pz] = rot(x, z, 0, 0.23, ry); b.box('vc', 0.55, 0.38, 0.01, px, B + 0.77, pz, 0x3a4a50, false, 0, ry);
      return B + 0.52;
    },
    crate(b, B, x, z, s, ry) { b.box('planks', s, s, s, x, B + s / 2, z, 0xc09a6a, true, 0.6, ry); return B + s + 0.01; },
    barrel(b, B, x, z, col) { b.cyl('metal', 0.3, 0.9, x, B + 0.45, z, col, true); return B + 0.91; },
    picture(b, B, x, y, z, ry, r) { b.box('vc', 0.6, 0.45, 0.03, x, B + y, z, 0x5a3a24, false, 0, ry); const [px, pz] = rot(x, z, 0, 0.02, ry); b.box('vc', 0.5, 0.35, 0.01, px, B + y, pz, pick(r, [0x7aa0c8, 0xc8a070, 0x8ab070, 0xd88060]), false, 0, ry); },
  };

  // ---------- typy budov ----------
  const win = (c, w) => ({ c, w: w || 1.2, y0: 0.9, y1: 2.0, win: true }), door = (c, w) => ({ c, w: w || 1.05, y0: 0, y1: 2.15 });
  const TYPES = {
    house(h, b, r, group) {
      const W = 12, D = 10, H = 2.9, t = 0.25, B = 0.25, ti = 0.14;
      const ext = pick(r, ['plaster', 'plaster', 'planks', 'brick']);
      const extC = ext === 'plaster' ? pick(r, [0xf0dcc0, 0xe8d8c0, 0xd8e2e2, 0xf4e6d6]) : ext === 'planks' ? pick(r, [0xd8a878, 0xb88a60, 0xa0a8a8]) : 0xffffff;
      const innC = pick(r, [0xffffff, 0xf4e6d4, 0xe0ecf0, 0xf4e0e0]), roofC = pick(r, [0xffffff, 0xd09080, 0x9a9aa8, 0xb08a6a]);
      b.box('floor', W, 0.5, D, 0, 0, 0, 0xffffff, false, 2); b.floor(0, 0, W / 2, D / 2, B);
      b.box('planks', W, 0.25, 2.4, 0, 0.125, D / 2 + 1.2, 0xc09870, false, 1.5); b.floor(0, D / 2 + 1.2, W / 2, 1.2, 0.25);
      for (const px of [-W / 2 + 0.2, -1.5, 1.5, W / 2 - 0.2]) b.box('vc', 0.16, H, 0.16, px, 0.25 + H / 2, D / 2 + 2.25, 0x6a4a30, true);
      b.box('roof', W + 0.4, 0.12, 2.9, 0, B + H + 0.1, D / 2 + 1.3, roofC, false, 1.5, 0);
      b.wall(ext, extC, 'x', D / 2 - t / 2, -W / 2 + t, W / 2 - t, H, t, B, [win(-4.6), door(-2.5), win(1.4), win(4.2)]);
      b.wall(ext, extC, 'x', -D / 2 + t / 2, -W / 2 + t, W / 2 - t, H, t, B, [win(-3.7), door(-1.6), { c: 3.6, w: 0.6, y0: 1.4, y1: 2.0, win: true }]);
      b.box('planks', 1.6, 0.25, 1.2, -1.6, 0.125, -D / 2 - 0.6, 0xc09870, false, 1.5); b.floor(-1.6, -D / 2 - 0.6, 0.8, 0.6, 0.25);
      b.wall(ext, extC, 'z', -W / 2 + t / 2, -D / 2, D / 2, H, t, B, [win(-2.6), win(2.6)]);
      b.wall(ext, extC, 'z', W / 2 - t / 2, -D / 2, D / 2, H, t, B, [win(-2.6), win(2.6)]);
      b.wall('wallpaper', innC, 'z', 0, -D / 2 + t, D / 2 - t, H, ti, B, [{ c: 2.6, w: 1.0, y0: 0, y1: 2.1 }]);
      b.wall('wallpaper', innC, 'x', 0, -W / 2 + t, -ti / 2, H, ti, B, [{ c: -2.6, w: 0.95, y0: 0, y1: 2.1 }]);
      b.wall('tile', 0xffffff, 'x', 0, ti / 2, W / 2 - t, H, ti, B, [{ c: 4.6, w: 0.95, y0: 0, y1: 2.1 }], 1);
      b.box('plaster', W - 2 * t, 0.08, D - 2 * t, 0, B + H + 0.04, 0, 0xf4f0e8, false, 3);
      b.prism('roof', W + 1.0, 2.3, D + 0.8, 0, B + H + 0.08, 0, roofC);
      b.box('brick', 0.7, 2.8, 0.7, W / 2 - 2, B + H + 1.0, -1.5, 0xffffff, false, 1);
      // obývák
      const s1 = F.sofa(b, B, -5.0, 2.2, Math.PI / 2, pick(r, [0x8a4a3a, 0x4a6a8a, 0x6a7a4a]));
      const s2 = F.table(b, B, -3.4, 2.2, 1.0, 0.6, 0.45);
      F.tv(b, B, -0.5, 0.75, -Math.PI / 2);
      F.rug(b, B, -3.4, 2.2, 2.4, 1.8, pick(r, [0xa04a3a, 0x3a5a8a, 0xc0a060]));
      const [s4, s5] = F.shelf(b, B, -4.5, 4.5, 1.2, Math.PI, r);
      F.lamp(b, B, -5.4, 0.5); F.picture(b, B, -5.74, 1.6, 2.2, Math.PI / 2, r);
      // kuchyň
      const s6 = F.counter(b, B, 2.1, 0.45, 3.2, 0, true, true);
      const s7 = F.fridge(b, B, 5.3, 2.0, -Math.PI / 2);
      const s8 = F.table(b, B, 3.0, 3.1, 1.3, 0.85, 0.76);
      F.chair(b, B, 2.4, 2.4, 0); F.chair(b, B, 3.6, 3.8, Math.PI);
      // ložnice
      const s9 = F.bed(b, B, -4.0, -3.6, 0, pick(r, [0x7a3a5a, 0x3a6a5a, 0x8a6a3a, 0x4a4a7a]));
      const s10 = F.table(b, B, -5.3, -4.5, 0.45, 0.4, 0.55);
      F.wardrobe(b, B, -0.45, -3.4, -Math.PI / 2); F.rug(b, B, -3.6, -1.7, 1.8, 1.2, 0xd0c0a0);
      // koupelna
      F.bathtub(b, B, 4.6, -4.25, 0); F.toilet(b, B, 1.0, -4.4, 0);
      const s11 = F.counter(b, B, 0.4, -2.0, 0.9, -Math.PI / 2, true, false);
      return [[-3.4, s2 - h.y + h.y, 2.2], [-4.8, s4, 4.5], [-4.2, s5, 4.5], [2.6, s6, 0.45], [3.0, s8, 3.1], [5.0, 0, 3.4], [-4.0, s9, -3.6],
        [-5.3, s10, -4.5], [-2.2, 0, -1.2], [0.4, s11, -2.0], [3.0, 0, -2.5], [-1.2, 0, 3.6], [0.5, 0.25, 5.8], [-4.6, s1, 2.2], [5.3, 0, 1.0]];
    },
    garage(h, b, r) {
      const W = 9, D = 10, H = 3.6, t = 0.2, B = 0.1;
      const mc = pick(r, [0xffffff, 0xd8e0e8, 0xe8d8c8, 0xc8d8c8]);
      b.box('concrete', W, 0.2, D, 0, 0, 0, 0xffffff, false, 3); b.floor(0, 0, W / 2, D / 2, B);
      b.wall('metal', mc, 'x', D / 2 - t / 2, -W / 2 + t, W / 2 - t, H, t, B, [{ c: -0.8, w: 5.4, y0: 0, y1: 3.1 }, win(3.4, 1.0)], 1.5);
      b.wall('metal', mc, 'x', -D / 2 + t / 2, -W / 2 + t, W / 2 - t, H, t, B, [win(-2.5), win(1.0)], 1.5);
      b.wall('metal', mc, 'z', -W / 2 + t / 2, -D / 2, D / 2, H, t, B, [win(1.5)], 1.5);
      b.wall('metal', mc, 'z', W / 2 - t / 2, -D / 2, D / 2, H, t, B, [], 1.5);
      b.box('metal', W + 0.6, 0.15, D + 0.6, 0, B + H + 0.08, 0, 0xc8c8c8, false, 1.5);
      // kancelář v rohu
      b.wall('planks', 0xd8b088, 'x', -1.6, 1.8, W / 2 - t, H - 0.6, 0.12, B, [door(2.5, 0.9), win(3.7, 0.9)], 1.5);
      b.wall('planks', 0xd8b088, 'z', 1.8, -D / 2 + t, -1.6, H - 0.6, 0.12, B, [], 1.5);
      const o1 = F.table(b, B, 3.3, -3.8, 1.4, 0.7, 0.76); F.chair(b, B, 3.3, -3.1, Math.PI);
      const [o2] = F.shelf(b, B, 2.4, -4.55, 0.9, 0, r);
      // dílna
      const w1 = F.counter(b, B, -4.05, -0.5, 3.2, Math.PI / 2, false, false);
      b.box('planks', 0.05, 1.2, 2.6, -4.27, B + 1.7, -0.5, 0x9a7a5a, false, 1);
      for (let i = 0; i < 6; i++) b.box('vc', 0.03, 0.25 + r() * 0.2, 0.05, -4.22, B + 1.7, -1.6 + i * 0.42, pick(r, [0x8a8a8a, 0xb02020, 0x2050a0]));
      const [w2, w3] = F.shelf(b, B, -2.6, -4.55, 1.6, 0, r);
      for (let i = 0; i < 4; i++) b.cyl('vc', 0.36, 0.22, -3.6, B + 0.11 + i * 0.23, 3.8, 0x1e1e1e, i === 0);
      const w4 = F.barrel(b, B, 0.6, -4.3, 0x2f5a8a); F.barrel(b, B, 1.25, -4.4, 0xb03020);
      for (const px of [-2.2, 0.6]) b.box('vc', 0.25, 2.2, 0.25, px, B + 1.1, -1.6, 0xd0b020, true);
      b.box('vc', 3.0, 0.1, 0.4, -0.8, B + 0.3, -1.6, 0x3a3a3a);
      const w5 = F.crate(b, B, 2.6, 3.4, 0.7, 0.3);
      return [[-4.05, w1, -1.4], [-4.05, w1, 0.4], [-2.6, w2, -4.55], [-2.6, w3, -4.55], [0.6, w4, -4.3], [3.3, o1, -3.8], [2.4, o2, -4.55], [2.6, w5, 3.4], [0, 0, 1.0], [-1.0, 0, 3.0]];
    },
    pumpa(h, b, r, group) {
      // přístřešek se stojany
      for (const sx of [-1, 1]) for (const sz of [2.6, 6.4]) b.box('vc', 0.3, 4.2, 0.3, sx * 3.6, 2.1, sz, 0xd8d4cc, true);
      b.box('vc', 9, 0.45, 5.8, 0, 4.4, 4.5, 0xb83a2a); b.box('vc', 9.1, 0.12, 5.9, 0, 4.12, 4.5, 0xeeeeee);
      for (const px of [-1.6, 1.6]) {
        b.box('concrete', 1.4, 0.15, 3.4, px, 0.075, 4.5, 0xffffff, false, 1);
        b.box('vc', 0.7, 1.6, 0.5, px, 0.95, 4.5, 0xc9452f, true); b.box('vc', 0.5, 0.35, 0.52, px, 1.35, 4.5, 0xf1e7c8);
        b.box('vc', 0.04, 0.6, 0.04, px + 0.38, 1.1, 4.5, 0x222222);
      }
      // obchod
      const W = 8, D = 6, H = 3.0, t = 0.22, B = 0.15, zc = -2.5;
      const ext = pick(r, ['brick', 'plaster']), extC = ext === 'brick' ? 0xffffff : pick(r, [0xf4ecd8, 0xe0e8e8]);
      b.box('tile', W, 0.3, D, 0, 0, zc, 0xe8e8e8, false, 1); b.floor(0, zc, W / 2, D / 2, B);
      b.wall(ext, extC, 'x', zc + D / 2 - t / 2, -W / 2 + t, W / 2 - t, H, t, B, [door(-2.6, 1.1), { c: 0.4, w: 2.6, y0: 0.6, y1: 2.3, win: true }, win(2.9, 1.3)]);
      b.wall(ext, extC, 'x', zc - D / 2 + t / 2, -W / 2 + t, W / 2 - t, H, t, B, [win(-2.0, 0.8)]);
      b.wall(ext, extC, 'z', -W / 2 + t / 2, zc - D / 2, zc + D / 2, H, t, B, [win(zc + 0.8)]);
      b.wall(ext, extC, 'z', W / 2 - t / 2, zc - D / 2, zc + D / 2, H, t, B, [win(zc + 0.8)]);
      b.wall('wallpaper', 0xf0f0e8, 'x', zc - 1.4, -W / 2 + t, W / 2 - t, H, 0.12, B, [door(2.6, 0.9)]);
      b.box('concrete', W + 0.6, 0.2, D + 0.6, 0, B + H + 0.1, zc, 0xd8d0c8, false, 2);
      const c1 = F.counter(b, B, -2.6, zc - 0.2, 1.8, Math.PI / 2);
      const [p1, p2] = F.shelf(b, B, 0.6, zc - 0.3, 1.8, Math.PI / 2, r);
      const [p3] = F.shelf(b, B, 2.0, zc - 0.3, 1.8, Math.PI / 2, r);
      const f1 = F.fridge(b, B, 3.45, zc + 1.6, -Math.PI / 2);
      const [p4, p5] = F.shelf(b, B, -1.0, zc - 2.75, 2.4, 0, r);
      const c2 = F.crate(b, B, 2.4, zc - 2.5, 0.6, 0.2); F.crate(b, B, 3.1, zc - 2.6, 0.5, 0.6);
      const tex = U.textTexture('BENZIN', 256, 64, '#c9452f', '#fff4dc');
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      sign.userData.ownMat = true; const [sx, sz] = b.toW(0, 7.43); sign.position.set(sx, b.y0 + 4.4, sz); sign.rotation.y = h.ry; group.add(sign);
      return [[-2.6, c1, zc - 0.6], [0.6, p1, zc - 0.3], [0.6, p2, zc - 0.3], [2.0, p3, zc - 0.3], [3.0, 0, zc + 1.6], [-1.0, p4, zc - 2.75],
        [-1.6, p5, zc - 2.75], [2.4, c2, zc - 2.5], [-1.6, 0.15, 3.0], [1.6, 0.15, 6.0], [-3.0, 0, 1.4]];
    },
    motel(h, b, r, group) {
      const W = 16, D = 6, H = 2.8, t = 0.22, B = 0.2, rw = W / 3;
      const extC = pick(r, [0xf4e0c8, 0xe8f0e8, 0xf0d8d8]);
      b.box('concrete', W, 0.4, D, 0, 0, 0, 0xffffff, false, 2); b.floor(0, 0, W / 2, D / 2, B);
      b.box('concrete', W, 0.2, 2.2, 0, 0.1, D / 2 + 1.1, 0xe0dcd4, false, 2); b.floor(0, D / 2 + 1.1, W / 2, 1.1, 0.2);
      const front = [], back = [];
      for (let i = 0; i < 3; i++) { const cx = -W / 2 + rw / 2 + i * rw; front.push(door(cx - 1.2, 0.95), win(cx + 1.0, 1.3)); back.push({ c: cx + 1.4, w: 0.6, y0: 1.4, y1: 2.0, win: true }); }
      b.wall('plaster', extC, 'x', D / 2 - t / 2, -W / 2 + t, W / 2 - t, H, t, B, front);
      b.wall('plaster', extC, 'x', -D / 2 + t / 2, -W / 2 + t, W / 2 - t, H, t, B, back);
      b.wall('plaster', extC, 'z', -W / 2 + t / 2, -D / 2, D / 2, H, t, B, []);
      b.wall('plaster', extC, 'z', W / 2 - t / 2, -D / 2, D / 2, H, t, B, []);
      for (const px of [-W / 2 + rw, -W / 2 + 2 * rw]) b.wall('wallpaper', 0xf0e8d8, 'z', px, -D / 2 + t, D / 2 - t, H, 0.14, B, []);
      b.box('plaster', W - 2 * t, 0.08, D - 2 * t, 0, B + H + 0.04, 0, 0xf4f0e8, false, 3);
      b.prism('roof', D + 3.2, 1.6, W + 0.8, 0, B + H + 0.08, 0.8, 0xc8a090, Math.PI / 2);
      for (let i = 0; i <= 4; i++) b.box('vc', 0.14, H, 0.14, -W / 2 + 0.2 + i * (W - 0.4) / 4, B + H / 2, D / 2 + 2.0, 0x6a4a30, true);
      const slots = [];
      for (let i = 0; i < 3; i++) {
        const cx = -W / 2 + rw / 2 + i * rw;
        const bed = F.bed(b, B, cx + 0.9, -1.6, 0, pick(r, [0x8a3a3a, 0x3a5a7a, 0x6a6a3a]));
        const ns = F.table(b, B, cx - 0.4, -2.4, 0.45, 0.4, 0.55);
        const tb = F.table(b, B, cx + 1.4, 1.9, 0.8, 0.6, 0.72); F.chair(b, B, cx + 0.7, 1.9, Math.PI / 2);
        const tv = F.tv(b, B, cx - 1.6, -0.2, Math.PI / 2);
        F.rug(b, B, cx + 0.2, 0.6, 1.6, 1.0, pick(r, [0xa04a3a, 0x3a5a8a]));
        slots.push([cx + 0.9, bed, -1.6], [cx - 0.4, ns, -2.4], [cx + 1.4, tb, 1.9], [cx - 1.6, tv, -0.2], [cx - 0.6, 0, 1.6]);
      }
      const tex = U.textTexture('MOTEL', 256, 64, '#2a4a7a', '#ffd870');
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      sign.userData.ownMat = true; const [sx, sz] = b.toW(W / 2 + 1.4, D / 2 + 2.5); sign.position.set(sx, b.y0 + 4.6, sz); sign.rotation.y = h.ry; group.add(sign);
      b.box('vc', 0.15, 4.2, 0.15, W / 2 + 1.4, 2.1, D / 2 + 2.45, 0x5a5a5a, true);
      return slots;
    },
    barn(h, b, r) {
      const w = 10, d = 13, H = 4.6, t = 0.3;
      b.wall('planks', 0xc06048, 'x', -d / 2 + t / 2, -w / 2 + t, w / 2 - t, H, t, 0, [win(2.5, 1.0)]);
      b.wall('planks', 0xc06048, 'z', -w / 2 + t / 2, -d / 2, d / 2, H, t, 0, [win(-3, 1.0), win(2, 1.0)]);
      b.wall('planks', 0xc06048, 'z', w / 2 - t / 2, -d / 2, d / 2, H, t, 0, [win(-3, 1.0)]);
      b.wall('planks', 0xc06048, 'x', d / 2 - t / 2, -w / 2 + t, w / 2 - t, H, t, 0, [{ c: 0, w: 5.6, y0: 0, y1: 3.9 }]);
      b.prism('roof', w + 1, 3, d + 0.8, 0, H, 0, 0x8a7a70);
      b.box('planks', w - 0.6, 0.12, 4, 0, 3.0, -d / 2 + 2.3, 0xb08860, false, 1.5);                 // seník
      for (const px of [-2, 2]) b.box('vc', 0.18, 3.0, 0.18, px, 1.5, -d / 2 + 4.2, 0x6a4a30, true);
      for (let i = 0; i < 4; i++) b.box('vc', 1.3, 0.6, 0.9, -3.5 + i * 1.5, 3.36, -d / 2 + 1.6, 0xd6bc70);
      F.counter(b, 0, 3.3, -5.6, 3, 0);
      b.box('vc', 1.4, 1, 1, -3.7, 0.5, -5.3, 0xcdb366, true); b.box('vc', 1.4, 1, 1, -3.7, 1.5, -5.3, 0xd6bc70, true); b.box('vc', 1.4, 1, 1, -3.7, 0.5, -4.1, 0xc8ae60, true);
      b.box('vc', 1.3, 0.15, 1.1, -3.3, 0.08, 1.5, 0x7b5a3a);
      F.barrel(b, 0, 4.2, 2.5, 0x6a4a2a); const [sh1, sh2] = F.shelf(b, 0, 4.4, -2.0, 1.4, -Math.PI / 2, r);
      return [[-3.3, 0.16, 1.5], [4.4, sh1, -2.4], [4.4, sh1, -1.6], [4.4, sh2, -2.0], [-3.6, 0, 0.2], [-1.5, 0, -4.0], [0.2, 0, -4.2], [1.6, 0, -3.9], [3.0, 0.92, -5.6], [2.1, 0.92, -5.6], [4.1, 0.92, -5.6], [-3.7, 0, -2.6], [-3.6, 0, -1.0], [3.8, 0, -3.6], [4.0, 0, 0.6], [3.7, 0, 1.4]];
    },
    obchod(h, b, r, group) {
      const w = 7, d = 6, H = 3, t = 0.25;
      b.box('floor', w, 0.2, d, 0, 0, 0, 0xffffff, false, 2); b.floor(0, 0, w / 2, d / 2, 0.1);
      b.wall('planks', 0xc8a070, 'x', -d / 2 + t / 2, -w / 2 + t, w / 2 - t, H, t, 0, [win(-2, 1)]);
      b.wall('planks', 0xc8a070, 'z', -w / 2 + t / 2, -d / 2, d / 2, H, t, 0, [win(0, 1)]);
      b.wall('planks', 0xc8a070, 'z', w / 2 - t / 2, -d / 2, d / 2, H, t, 0, [win(0, 1)]);
      b.wall('planks', 0xc8a070, 'x', d / 2 - t / 2, -w / 2 + t, w / 2 - t, H, t, 0, [{ c: 0, w: 3.2, y0: 0, y1: 2.4 }]);
      b.box('roof', w + 1.6, 0.15, d + 2.4, 0, H + 0.08, 0.6, 0xc09080, false, 1.5);
      for (const sx of [-1, 1]) b.box('vc', 0.15, H, 0.15, sx * (w / 2 + 0.6), H / 2, d / 2 + 1.6, 0x5a3a22);
      F.counter(b, 0, 0, 0.3, 3.6, 0);
      F.shelf(b, 0, -1.6, -d / 2 + 0.5, 2.6, 0, r); F.shelf(b, 0, 1.6, -d / 2 + 0.5, 2.6, 0, r);
      const skin = 0xc68a5e;
      b.box('vc', 0.5, 0.75, 0.3, 0, 1.35, -0.6, 0x3d5a7a); b.box('vc', 0.3, 0.3, 0.3, 0, 1.92, -0.6, skin);
      b.box('vc', 0.55, 0.08, 0.55, 0, 2.11, -0.6, 0x6b4a2a); b.box('vc', 0.32, 0.18, 0.32, 0, 2.2, -0.6, 0x6b4a2a);
      b.box('vc', 0.5, 0.75, 0.25, 0, 0.6, -0.6, 0x3a3a3a);
      const [nx, nz] = b.toW(0, -0.6); h.npc = { x: nx, z: nz, y: b.y0 + 1.9 };
      const tex = U.textTexture('OBCHOD', 256, 64, '#2f5a3a', '#f6ecd0');
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      sign.userData.ownMat = true; const [sx, sz] = b.toW(0, d / 2 + 0.05); sign.position.set(sx, b.y0 + H + 0.6, sz); sign.rotation.y = h.ry; group.add(sign);
      return [];
    },
  };

  function build(world, h, group, cols, floors) {
    const r = U.rng(Math.floor(h.x * 13 + h.z * 7) ^ world.seed);
    if (h.type === 'vrakoviste') return Props.junkyard(world, h, group, cols, r);
    const mir = h.type === 'barn' ? 1 : (r() < 0.5 ? -1 : 1);
    const b = ctx(h, cols, floors, mir);
    let slots = TYPES[h.type](h, b, r, group);
    b.build(group);
    if (!h.spawned) {
      h.spawned = true;
      if (h.type !== 'barn') slots = slots.map(s => [s, r()]).sort((p, q) => p[1] - q[1]).map(p => p[0]);
      h.loot.forEach(([type, data], i) => {
        const sl = slots[i % slots.length], [wx, wz] = b.toW(sl[0], sl[2] + (i >= slots.length ? 0.5 : 0));
        // podlaha domu ještě není ve world.floors (přidá se až po dostavění chunku) – jinak věci padaly 25 cm pod podlahu
        let y = sl[1] > 0 ? b.y0 + sl[1] : world.groundAt(wx, wz);
        if (sl[1] <= 0) for (const f of floors) if (f.y > y && U.circleVs(wx, wz, 0.01, f)) y = f.y;
        Items.spawn(type, wx, y, wz, data);
      });
    }
  }
  return { build, ctx, F };
})();
