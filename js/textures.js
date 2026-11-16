// textures.js – procedurální textury (kreslené do canvasu, žádné soubory) a texturované materiály
const Tex = {
  cache: {}, mats: {},
  canvas(n, draw) {
    const cv = document.createElement('canvas'); cv.width = cv.height = n;
    const g = cv.getContext('2d'); draw(g, n, U.rng(n * 7 + draw.length));
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
    return t;
  },
  noise(g, n, r, a, cols) { for (let i = 0; i < n * n * a; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(r() * n, r() * n, 1 + r() * 2, 1 + r() * 2); } },
  get(name) {
    if (this.cache[name]) return this.cache[name];
    const D = {
      plaster: (g, n, r) => {
        g.fillStyle = '#e9e2d4'; g.fillRect(0, 0, n, n);
        this.noise(g, n, r, 0.25, ['#ddd5c5', '#f2ece0', '#d6cdbb', '#e2dacb']);
        g.strokeStyle = 'rgba(120,100,80,.35)'; g.lineWidth = 1;
        for (let i = 0; i < 4; i++) { g.beginPath(); let x = r() * n, y = r() * n; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 30; y += r() * 18; g.lineTo(x, y); } g.stroke(); }
      },
      planks: (g, n, r) => {
        const h = n / 8;
        for (let i = 0; i < 8; i++) {
          const v = 200 + r() * 40; g.fillStyle = `rgb(${v},${v - 8},${v - 20})`; g.fillRect(0, i * h, n, h);
          g.fillStyle = 'rgba(60,40,20,.55)'; g.fillRect(0, i * h + h - 3, n, 3);
          g.strokeStyle = 'rgba(90,70,40,.25)';
          for (let k = 0; k < 5; k++) { g.beginPath(); const y = i * h + 4 + r() * (h - 8); g.moveTo(0, y); g.bezierCurveTo(n * 0.3, y + 3, n * 0.6, y - 3, n, y); g.stroke(); }
          g.fillStyle = 'rgba(50,35,20,.6)'; g.fillRect(r() * n, i * h + 6, 3, 3);
        }
      },
      floor: (g, n, r) => {
        const w = n / 6;
        for (let i = 0; i < 6; i++) {
          const v = 190 + r() * 40; g.fillStyle = `rgb(${v},${v - 20},${v - 50})`; g.fillRect(i * w, 0, w, n);
          g.fillStyle = 'rgba(50,30,15,.6)'; g.fillRect(i * w, 0, 2, n); g.fillRect(i * w, r() * n, w, 2);
          g.strokeStyle = 'rgba(90,60,30,.25)';
          for (let k = 0; k < 4; k++) { g.beginPath(); const x = i * w + 4 + r() * (w - 8); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 6, n); g.stroke(); }
        }
      },
      brick: (g, n, r) => {
        g.fillStyle = '#cfc6b8'; g.fillRect(0, 0, n, n);
        const bh = n / 8, bw = n / 4;
        for (let y = 0; y < 8; y++) for (let x = -1; x < 5; x++) {
          const v = 170 + r() * 60; g.fillStyle = `rgb(${v},${v * 0.62 | 0},${v * 0.5 | 0})`;
          g.fillRect(x * bw + (y % 2) * bw / 2 + 2, y * bh + 2, bw - 4, bh - 4);
        }
      },
      roof: (g, n, r) => {
        g.fillStyle = '#6a5a50'; g.fillRect(0, 0, n, n);
        const rh = n / 8, sw = n / 6;
        for (let y = 0; y < 8; y++) for (let x = -1; x < 7; x++) {
          const v = 150 + r() * 70; g.fillStyle = `rgb(${v},${v * 0.85 | 0},${v * 0.78 | 0})`;
          g.fillRect(x * sw + (y % 2) * sw / 2 + 1, y * rh + 1, sw - 2, rh - 3);
          g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x * sw + (y % 2) * sw / 2 + 1, y * rh + rh - 4, sw - 2, 3);
        }
      },
      metal: (g, n, r) => {
        for (let x = 0; x < n; x++) { const v = 175 + Math.sin(x / n * Math.PI * 16) * 45; g.fillStyle = `rgb(${v},${v + 3},${v + 6})`; g.fillRect(x, 0, 1, n); }
        g.fillStyle = 'rgba(140,70,30,.35)';
        for (let i = 0; i < 30; i++) g.fillRect(r() * n, r() * n, 2 + r() * 10, 4 + r() * 30);
      },
      tile: (g, n, r) => {
        g.fillStyle = '#9aa0a0'; g.fillRect(0, 0, n, n);
        const s = n / 8;
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 225 + r() * 25; g.fillStyle = `rgb(${v},${v},${v - 4})`; g.fillRect(x * s + 1, y * s + 1, s - 2, s - 2); }
      },
      wallpaper: (g, n, r) => {
        g.fillStyle = '#ece4d2'; g.fillRect(0, 0, n, n);
        g.fillStyle = 'rgba(170,140,100,.35)';
        for (let x = 0; x < n; x += n / 8) g.fillRect(x, 0, n / 32, n);
        g.fillStyle = 'rgba(150,90,70,.3)';
        for (let i = 0; i < 24; i++) { g.beginPath(); g.arc((i % 4) * n / 4 + n / 16, Math.floor(i / 4) * n / 6 + 10, 5, 0, 7); g.fill(); }
      },
      concrete: (g, n, r) => { g.fillStyle = '#c8c4bc'; g.fillRect(0, 0, n, n); this.noise(g, n, r, 0.4, ['#bcb8b0', '#d2cec6', '#b0aca4']); },
      fabric: (g, n, r) => { g.fillStyle = '#d8d0c8'; g.fillRect(0, 0, n, n); g.strokeStyle = 'rgba(0,0,0,.08)'; for (let i = 0; i < n; i += 4) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, n); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(n, i); g.stroke(); } },
      // jemná struktura země (šedá – násobí se barvou terénu): zrnka písku, vlnky od větru, kamínky, praskliny; navazuje do všech stran
      ground: (g, n, r) => {
        const wrap = (fn) => { for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
        g.fillStyle = 'rgb(228,228,228)'; g.fillRect(0, 0, n, n);
        for (let i = 0; i < 70; i++) {
          const x = r() * n, y = r() * n, rad = 20 + r() * 70, v = r() < 0.5 ? 0 : 255;
          wrap(() => { const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${v},${v},${v},.09)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); });
        }
        g.lineWidth = 2;
        for (let i = 0; i < 26; i++) {
          const y0 = r() * n, k = 2 + Math.floor(r() * 3), ph = r() * 6.28, a = 3 + r() * 5;
          g.strokeStyle = i % 2 ? 'rgba(255,255,255,.09)' : 'rgba(0,0,0,.07)';
          wrap(() => { g.beginPath(); for (let x = 0; x <= n; x += 8) { const y = y0 + Math.sin(x / n * Math.PI * 2 * k + ph) * a; if (x) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); });
        }
        for (let i = 0; i < 60000; i++) { const v = 165 + Math.floor(r() * 90); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.floor(r() * n), Math.floor(r() * n), 1, 1); }
        for (let i = 0; i < 160; i++) {
          const x = r() * n, y = r() * n, rx = 1.5 + r() * 3.5, ry = rx * (0.6 + r() * 0.4), v = 120 + Math.floor(r() * 80), a = r() * 3;
          wrap(() => { g.fillStyle = `rgba(0,0,0,.25)`; g.beginPath(); g.ellipse(x + 1, y + 1.2, rx, ry, a, 0, 7); g.fill();
            g.fillStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, 7); g.fill();
            g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(x - rx * 0.3, y - ry * 0.3, rx * 0.4, ry * 0.35, a, 0, 7); g.fill(); });
        }
        g.strokeStyle = 'rgba(40,30,20,.13)'; g.lineWidth = 1;
        for (let i = 0; i < 9; i++) { let x = r() * n, y = r() * n; const pts = [[x, y]]; for (let k = 0; k < 7; k++) { x += (r() - 0.5) * 40; y += (r() - 0.5) * 40; pts.push([x, y]); }
          wrap(() => { g.beginPath(); pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); }); }
      },
      asphalt: (g, n, r) => {
        const wrap = (fn) => { for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
        g.fillStyle = 'rgb(225,225,225)'; g.fillRect(0, 0, n, n);
        for (let i = 0; i < 14; i++) { const x = r() * n, y = r() * n, w = 30 + r() * 90, h = 20 + r() * 70, v = r() < 0.6 ? 0 : 255;
          wrap(() => { g.fillStyle = `rgba(${v},${v},${v},.07)`; g.fillRect(x, y, w, h); }); }
        for (let i = 0; i < 70000; i++) { const v = 150 + Math.floor(r() * 105); g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.floor(r() * n), Math.floor(r() * n), 1 + (r() < 0.2), 1); }
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(0,0,0,.35)';
        for (let i = 0; i < 7; i++) { let x = r() * n, y = r() * n; const pts = [[x, y]]; for (let k = 0; k < 9; k++) { x += (r() - 0.5) * 30; y += r() * 26; pts.push([x, y]); }
          wrap(() => { g.beginPath(); pts.forEach(([px, py], j) => (j ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke(); }); }
        g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.18)';
        for (let i = 0; i < 3; i++) { const y = r() * n; wrap(() => { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(n * 0.3, y + 10, n * 0.6, y - 12, n, y); g.stroke(); }); }
      },
    };
    const t = this.canvas(name === 'ground' || name === 'asphalt' ? 512 : 256, D[name]);
    if (name === 'ground' || name === 'asphalt') t.anisotropy = 8;
    return (this.cache[name] = t);
  },
  // texturovaný materiál s barvami ve vrcholech (textura se tónuje barvou každé budovy)
  mat(name) {
    if (!this.mats[name]) this.mats[name] = new THREE.MeshLambertMaterial({ map: this.get(name), vertexColors: true });
    return this.mats[name];
  },
};

// Slučovač s UV souřadnicemi: textura se opakuje podle skutečné velikosti stěny (tile = metry na jedno opakování)
U.TexMerger = class {
  constructor() { this.pos = []; this.col = []; this.uv = []; this._v = new THREE.Vector3(); }
  add(geo, matrix, color, su, sv, faceScale) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, uv = g.attributes.uv, v = this._v;
    const c = color instanceof THREE.Color ? color : new THREE.Color(color);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(matrix);
      this.pos.push(v.x, v.y, v.z); this.col.push(c.r, c.g, c.b);
      let a = su, b = sv;
      if (faceScale) { const f = faceScale[Math.floor(i / 6)]; a = f[0]; b = f[1]; }
      this.uv.push(uv.getX(i) * a, uv.getY(i) * b);
    }
  }
  addBox(w, h, d, x, y, z, ry, color, tile, rx, rz) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0, 'YXZ')), new THREE.Vector3(w, h, d));
    const t = tile || 1;
    // pořadí stěn BoxGeometry: +x, -x, +y, -y, +z, -z
    this.add(U.unitBoxUV, m, color, 1, 1, [[d / t, h / t], [d / t, h / t], [w / t, d / t], [w / t, d / t], [w / t, h / t], [w / t, h / t]]);
  }
  build(mat) {
    if (!this.pos.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
    return m;
  }
};
U.unitBoxUV = new THREE.BoxGeometry(1, 1, 1).toNonIndexed();
