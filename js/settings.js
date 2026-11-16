// settings.js – nastavení (ovládání, citlivost, grafika, zvuk, rádio) uložené v prohlížeči
const ACTIONS = [
  ['forward', 'Dopředu / plyn', 'KeyW'], ['back', 'Dozadu / brzda / couvání', 'KeyS'], ['left', 'Doleva', 'KeyA'], ['right', 'Doprava', 'KeyD'],
  ['run', 'Běh', 'ShiftLeft'], ['jump', 'Skok', 'Space'], ['handbrake', 'Ruční brzda', 'Space'],
  ['interact', 'Vzít / použít / nastoupit', 'KeyE'], ['drop', 'Zahodit věc z ruky', 'KeyG'], ['reload', 'Nabít zbraň', 'KeyR'],
  ['engine', 'Nastartovat / vypnout motor', 'KeyC'], ['gearmode', 'Automat / manuál', 'KeyT'], ['shiftUp', 'Řadit nahoru', 'KeyR'], ['shiftDown', 'Řadit dolů', 'KeyF'],
  ['lights', 'Světla', 'KeyL'], ['horn', 'Klakson', 'KeyQ'], ['help', 'Nápověda', 'KeyH'], ['settings', 'Nastavení', 'KeyO'],
  ['radio', 'Rádio zap/vyp', 'KeyM'], ['radioNext', 'Rádio: další stanice', 'KeyN'], ['nitro', 'Drag: nitro', 'ShiftLeft'], ['rocket', 'Drag: raketa', 'KeyE'], ['camera', 'Drag: kamera', 'KeyV'],
];
const SETTINGS_DEF = {
  v: 4, sens: 1, invertY: false, rawMouse: true, fov: 75, master: 80, engine: 100, radio: 60, viewDist: 6, shadows: 'low', scale: 100, mirrors: true, autoRes: true, help: true, fps: false, bob: true,
  keys: Object.fromEntries(ACTIONS.map(a => [a[0], a[2]])),
};
const Settings = {
  s: null,
  load() {
    const st = U.store.get('pj_settings', {});
    if (!st.v || st.v < 2) { delete st.shadows; delete st.scale; }
    if (!st.v || st.v < 3) { delete st.rawMouse; if (st.keys && st.keys.dev === 'F2') delete st.keys.dev; st.v = 3; }   // nové výchozí hodnoty pro plynulost
    if (st.v < 4) { if (st.keys) delete st.keys.dev; st.v = 4; }
    this.s = Object.assign({}, SETTINGS_DEF, st, { keys: Object.assign({}, SETTINGS_DEF.keys, st.keys || {}) });
  },
  save() { U.store.set('pj_settings', this.s); },
  key(action) { return this.s.keys[action]; },
  down(keys, action) { return !!keys[this.s.keys[action]] || (typeof Pad !== 'undefined' && Pad.held(action)); },
  kdown(keys, action) { return !!keys[this.s.keys[action]]; },   // jen klávesnice (analog z volantu se přidává zvlášť)
  actionsFor(code) { return ACTIONS.filter(a => this.s.keys[a[0]] === code).map(a => a[0]); },
  keyName(code) {
    if (!code) return '—';
    const m = { Space: 'Mezerník', ShiftLeft: 'Levý Shift', ShiftRight: 'Pravý Shift', ControlLeft: 'Levý Ctrl', ControlRight: 'Pravý Ctrl', AltLeft: 'Levý Alt', Tab: 'Tab', Enter: 'Enter',
      ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: ';', CapsLock: 'Caps Lock', Backspace: 'Backspace' };
    return m[code] || code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
  },
  // použije nastavení na renderer, svět, zvuk
  apply() {
    const s = this.s, G = window.Game;
    if (!G || !G.renderer) return;
    const r = G.renderer;
    G._arK = 1;   // automatické rozlišení začne znovu od plného
    r.setPixelRatio(Math.min(window.devicePixelRatio, s.scale / 100));   // 100 % = 1 pixel na bod obrazovky (na retina/125% displejích výrazně rychlejší)
    r.setSize(innerWidth, innerHeight);
    const sun = G.lights.sun, on = s.shadows !== 'off';
    if (r.shadowMap.enabled !== on) { r.shadowMap.enabled = on; G.scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); }); }
    const size = s.shadows === 'high' ? 4096 : 2048;
    if (sun.shadow.mapSize.x !== size) { sun.shadow.mapSize.set(size, size); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    World.viewR = s.viewDist;
    G.camera.fov = s.fov; G.camera.updateProjectionMatrix();
    if (Sfx.master) Sfx.master.gain.value = 0.7 * s.master / 100;
    Sfx.engVol = s.engine / 100;
    if (window.Radio) Radio.apply();
    G.showHelp = s.help;
  },

  // ---------- okno nastavení ----------
  open(from) {
    this.from = from; this.waiting = null;
    $('settings').style.display = 'flex';
    if (document.exitPointerLock) document.exitPointerLock();
    this.render();
  },
  close() {
    $('settings').style.display = 'none'; this.waiting = null; if (typeof Pad !== 'undefined') { Pad.wait = null; Pad.cal = null; } this.save(); this.apply();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (this.from === 'air' && typeof Air !== 'undefined' && Air.active) { Air.paused = false; Game.lock(); }
    if (this.from === 'game' && Game.playing) { if (Player.alive) $('pause').style.display = 'flex'; Game.lock(); }
  },
  render() {
    const s = this.s;
    if (typeof Pad !== 'undefined' && Pad.cal) { $('settingsBox').innerHTML = Pad.calHTML(); return; }
    const range = (id, label, min, max, step, val, unit) => `<div class="srow"><span>${label}</span><input type="range" data-set="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><b>${val}${unit || ''}</b></div>`;
    const check = (id, label) => `<div class="srow"><span>${label}</span><input type="checkbox" data-set="${id}" ${s[id] ? 'checked' : ''}></div>`;
    const select = (id, label, opts) => `<div class="srow"><span>${label}</span><select data-set="${id}">${opts.map(([v, t]) => `<option value="${v}" ${String(s[id]) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
    let h = '<h2>Nastavení</h2><div class="stabs">';
    h += '<h3>Myš a pohled</h3>' + range('sens', 'Citlivost myši', 0.2, 3, 0.05, s.sens, '×') + check('invertY', 'Obrátit osu Y') + check('rawMouse', 'Surový vstup myši (doporučeno – bez akcelerace a bez skoků)') + range('fov', 'Zorné pole (FOV)', 60, 105, 1, s.fov, '°') + check('bob', 'Houpání kamery při chůzi');
    h += '<h3>Grafika</h3>' + select('viewDist', 'Dohlednost', [[3, 'Krátká (rychlé)'], [4, 'Nižší'], [5, 'Střední'], [6, 'Vysoká'], [7, 'Maximální']])
      + select('shadows', 'Stíny', [['off', 'Vypnuté'], ['low', 'Nízké'], ['high', 'Vysoké (ostré)']]) + range('scale', 'Rozlišení vykreslování (víc = ostřejší, pomalejší)', 50, 200, 5, s.scale, ' %')
      + check('autoRes', 'Automaticky snížit rozlišení, když klesnou FPS') + check('mirrors', 'Zrcátka v autě') + check('fps', 'Ukazovat FPS');
    h += '<h3>Zvuk</h3>' + range('master', 'Celková hlasitost', 0, 100, 1, s.master, ' %') + range('engine', 'Hlasitost motoru', 0, 150, 1, s.engine, ' %') + range('radio', 'Hlasitost rádia', 0, 100, 1, s.radio, ' %');
    h += '<h3>Rozhraní</h3>' + check('help', 'Nápověda s klávesami');
    if (typeof Pad !== 'undefined') h += Pad.settingsHTML();
    h += '<h3>Ovládání</h3><div style="font-size:13px;opacity:.75;margin-bottom:4px">Klikni na klávesu a zmáčkni novou (Esc = zrušit). Myš: levé tlačítko útok, pravé puškohled.</div>';
    h += ACTIONS.map(([id, label]) => `<div class="srow"><span>${label}</span><button class="kb${this.waiting === id ? ' wait' : ''}" data-bind="${id}">${this.waiting === id ? 'zmáčkni klávesu…' : this.keyName(s.keys[id])}</button></div>`).join('');
    h += '</div><div style="margin-top:12px"><button class="close" data-sact="reset">Výchozí nastavení</button> <button class="close" data-sact="close">Hotovo</button></div>';
    $('settingsBox').innerHTML = h;
  },
  bindUI() {
    const box = $('settingsBox');
    box.addEventListener('input', (e) => {
      const el = e.target;
      if (el.dataset.pset) {   // nastavení volantu / gamepadu (pro připojené zařízení)
        const c = Pad.cfg(); if (!c) return;
        const v = el.type === 'checkbox' ? el.checked : +el.value; c[el.dataset.pset] = v;
        if (el.type === 'range') el.nextElementSibling.textContent = (el.dataset.unit === ' %' ? Math.round(v * 100) : v) + el.dataset.unit;
        Pad.save(); return;
      }
      const id = el.dataset.set; if (!id) return;
      const v = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? (isNaN(+el.value) ? el.value : +el.value) : +el.value;
      this.s[id] = v;
      if (el.type === 'range') el.nextElementSibling.textContent = v + (id === 'sens' ? '×' : id === 'fov' ? '°' : ' %');
      this.save(); this.apply();
    });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.bind) { this.waiting = b.dataset.bind; Pad.wait = null; this.render(); }
      else if (b.dataset.padbind) { Pad.wait = Pad.wait === b.dataset.padbind ? null : b.dataset.padbind; this.waiting = null; this.render(); }
      else if (b.dataset.padcal) Pad.calStart();
      else if (b.dataset.padnext) Pad.calNext(false);
      else if (b.dataset.padskip) Pad.calNext(true);
      else if (b.dataset.padcancel) Pad.calCancel();
      else if (b.dataset.padreset) { Pad.resetCfg(); this.render(); }
      else if (b.dataset.sact === 'close') this.close();
      else if (b.dataset.sact === 'reset') { this.s = JSON.parse(JSON.stringify(SETTINGS_DEF)); this.save(); this.apply(); this.render(); }
    });
    // zachycení nové klávesy
    addEventListener('keydown', (e) => {
      if (typeof Pad !== 'undefined' && Pad.wait && !Pad.synth) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.code === 'Delete' || e.code === 'Backspace') { const c = Pad.cfg(); if (c && c.btn) for (const k of Object.keys(c.btn)) if (c.btn[k] === Pad.wait) delete c.btn[k]; Pad.save(); }
        Pad.wait = null; this.render(); return;
      }
      if (!this.waiting || (typeof Pad !== 'undefined' && Pad.synth)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.code !== 'Escape') this.s.keys[this.waiting] = e.code;
      this.waiting = null; this.save(); this.render();
    }, true);
    $('settings').addEventListener('click', (e) => { if (e.target.id === 'settings') this.close(); });
  },
};
Settings.load();

