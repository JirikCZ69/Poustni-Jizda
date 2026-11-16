// audio.js – syntetizované zvuky přes WebAudio (žádné soubory)
// Motor: zákl. frekvence = zapalování (ot/min / 60 × válce / 2), podharmonické + zkreslení + filtr; charakter podle konstrukce
// (V8 bublá, boxer duní, tříválec drnčí), turbo píská a upouští tlak, kompresor kvílí. Pneumatiky pískají při smyku na asfaltu.
// charakter motorů: saw = ostrost, sub = dunění (polovina frekvence), hi = vyšší harmonická, cut = jas, q = nosovost,
// drive = zkreslení, burble/lfo = nepravidelné bublání (podíl frekvence), noise = chraplavost, vol = hlasitost, pitch = posun výšky
const ENGINE_SOUND = {
  i3: { saw: 0.9, sub: 0.25, hi: 0.1, cut: 0.9, q: 4.5, drive: 1.6, burble: 0.75, lfo: 1 / 3, noise: 0.5, vol: 0.85, pitch: 1.0, wave: 'sawtooth' },
  i4: { saw: 1.0, sub: 0.15, hi: 0.35, cut: 1.35, q: 2.5, drive: 1.2, burble: 0.12, lfo: 0.5, noise: 0.6, vol: 0.9, pitch: 1.0, wave: 'square' },
  boxer: { saw: 0.7, sub: 0.9, hi: 0.08, cut: 0.7, q: 1.5, drive: 1.5, burble: 0.85, lfo: 0.5, noise: 0.35, vol: 1.05, pitch: 0.85, wave: 'sawtooth' },
  i6: { saw: 0.55, sub: 0.2, hi: 0.75, cut: 1.7, q: 1.0, drive: 0.8, burble: 0.04, lfo: 0.5, noise: 0.2, vol: 0.95, pitch: 1.0, wave: 'triangle' },
  v6: { saw: 0.85, sub: 0.55, hi: 0.3, cut: 1.1, q: 2.0, drive: 1.4, burble: 0.4, lfo: 1 / 3, noise: 0.4, vol: 1.05, pitch: 0.95, wave: 'sawtooth' },
  v8: { saw: 1.0, sub: 1.3, hi: 0.15, cut: 0.6, q: 1.2, drive: 2.4, burble: 0.95, lfo: 0.25, noise: 0.3, vol: 1.3, pitch: 0.8, wave: 'sawtooth' },
};
const Sfx = {
  ctx: null,
  ducking(on) {
    if (!this.duck) return;
    const t = this.ctx.currentTime; this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setTargetAtTime(on ? 0.32 : 1, t, on ? 0.04 : 0.3);
  },
  init() {
    if (this.ctx) return;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.ctx;
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(c.destination);
    // master → duck (ztlumí motor a rádio, když mluví spolujezdec) → kompresor; hlas jde vlastní cestou mimo duck
    this.duck = c.createGain(); this.duck.connect(comp);
    this.master = c.createGain(); this.master.gain.value = 0.55; this.master.connect(this.duck);
    this.voiceBus = c.createGain(); this.voiceBus.connect(comp);
    // dozvuk (uměle vytvořená odezva) pro výstřely a rány
    const ir = c.createBuffer(2, c.sampleRate * 1.8, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
    this.verb = c.createConvolver(); this.verb.buffer = ir;
    this.verbIn = c.createGain(); this.verbIn.gain.value = 0.35; this.verbIn.connect(this.verb); this.verb.connect(this.master);
    // šum
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    const noise = () => { const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
    const filt = (type, f, q) => { const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || 0.7; return fl; };
    const gain = (v) => { const g = c.createGain(); g.gain.value = v; return g; };
    const osc = (type, f) => { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.start(); return o; };

    // ---- motor ----
    this.eOut = gain(0); this.eOut.connect(this.master);
    this.eAM = gain(1); this.eAM.connect(this.eOut);                 // "bublání" – amplitudová modulace
    this.eLow = filt('lowpass', 600, 0.9); this.eLow.connect(this.eAM);
    this.eBass = c.createBiquadFilter(); this.eBass.type = 'lowshelf'; this.eBass.frequency.value = 160; this.eBass.gain.value = 4; this.eBass.connect(this.eLow);
    this.shaper = c.createWaveShaper();
    const curve = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 2.6); }
    this.shaper.curve = curve; this.shaper.connect(this.eBass);
    this.drive = gain(0.8); this.drive.connect(this.shaper);
    this.oF = osc('sawtooth', 40); this.gF = gain(1); this.oF.connect(this.gF); this.gF.connect(this.drive);   // zapalování
    this.oS = osc('square', 20); this.gS = gain(0.4); this.oS.connect(this.gS); this.gS.connect(this.drive);   // podharmonická (dunění)
    this.oH = osc('triangle', 80); this.gH = gain(0.2); this.oH.connect(this.gH); this.gH.connect(this.drive);  // vyšší harmonická
    this.cNoise = filt('bandpass', 300, 1.2); this.gN = gain(0); noise().connect(this.cNoise); this.cNoise.connect(this.gN); this.gN.connect(this.drive); // spalování
    this.lfo = osc('sine', 10); this.lfoD = gain(0.1); this.lfo.connect(this.lfoD); this.lfoD.connect(this.eAM.gain);
    // turbo (pískání) a kompresor (kvílení)
    this.oT = osc('sine', 3000); this.tF = filt('bandpass', 3000, 6); this.gT = gain(0); this.oT.connect(this.tF); this.tF.connect(this.gT); this.gT.connect(this.master);
    this.oT2 = osc('triangle', 4600); this.oT2.connect(this.tF);
    this.oC = osc('sawtooth', 900); this.cF = filt('bandpass', 1200, 5); this.gC = gain(0); this.oC.connect(this.cF); this.cF.connect(this.gC); this.gC.connect(this.master);

    // ---- pneumatiky: pískání (dva tóny s vibratem + šum), štěrk, valení ----
    this.sqGain = gain(0); this.sqF = filt('bandpass', 1000, 1.6); this.sqF.connect(this.sqGain); this.sqGain.connect(this.master);
    this.sq1 = osc('triangle', 820); this.sq2 = osc('square', 1240); const g2 = gain(0.25); this.sq1.connect(this.sqF); this.sq2.connect(g2); g2.connect(this.sqF);
    const vib = osc('sine', 7.5), vibD = gain(28); vib.connect(vibD); vibD.connect(this.sq1.frequency); vibD.connect(this.sq2.frequency);
    const sqN = filt('bandpass', 2200, 2); noise().connect(sqN); const sqNg = gain(0.6); sqN.connect(sqNg); sqNg.connect(this.sqGain);
    const mk = (type, f, q) => { const fl = filt(type, f, q), g = gain(0); noise().connect(fl); fl.connect(g); g.connect(this.master); return { g, fl }; };
    this.gravel = mk('bandpass', 700, 0.6);
    this.road = mk('lowpass', 180, 0.7);
    this.windN = mk('bandpass', 520, 0.45);
    this.amb = mk('lowpass', 380, 0.4);                            // tichý pouštní vítr v pozadí
    this.lay = 'i4';
  },
  // hlavní zvuk auta – volá se každý snímek
  engine(o) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, set = (p, v, k) => p.setTargetAtTime(v, t, k || 0.04);
    const S = ENGINE_SOUND[o.lay] || ENGINE_SOUND.i4, cyl = o.cyl || 4, loud = o.exhaust ? 1.45 : 1;
    if (this.lay !== o.lay) { this.lay = o.lay; this.oF.type = S.wave; }
    const f = Math.max(8, o.rpm / 60 * cyl / 2 * S.pitch), thr = o.throttle, on = o.running ? 1 : 0;
    const vol = (o.inCar ? 1 : 1.3 / (1 + o.dist / 5)) * on * (this.engVol === undefined ? 1 : this.engVol);
    set(this.oF.frequency, f); set(this.oS.frequency, f * 0.5); set(this.oH.frequency, f * (S.hi > 0.5 ? 1.5 : 2));
    set(this.gF.gain, S.saw); set(this.gS.gain, S.sub * (o.exhaust ? 1.3 : 1)); set(this.gH.gain, S.hi);
    set(this.gN.gain, S.noise * (0.3 + thr)); set(this.cNoise.frequency, f * 3);
    set(this.drive.gain, (0.4 + thr * 1.1) * S.drive + (o.exhaust ? 0.6 : 0));
    set(this.eLow.frequency, (160 + f * 4 + thr * 800) * S.cut * (o.inCar ? 0.85 : 1)); set(this.eLow.Q, S.q);
    set(this.eBass.gain, (o.exhaust ? 9 : 3) + S.sub * 4);
    set(this.lfo.frequency, f * S.lfo);
    const bd = Math.min(0.95, (S.burble + (o.exhaust ? 0.2 : 0)) * (1 - 0.55 * U.smooth(2500, 6000, o.rpm)) * (1 - 0.3 * thr));
    set(this.lfoD.gain, bd * 0.5); set(this.eAM.gain, 1 - bd * 0.5);
    set(this.eOut.gain, vol * (0.1 + thr * 0.12) * loud * S.vol, 0.06);
    // turbo / kompresor
    const b = o.boost || 0;
    set(this.oT.frequency, 2200 + b * 5200 + o.rpm * 0.25); set(this.oT2.frequency, (2200 + b * 5200) * 1.53); set(this.tF.frequency, 2400 + b * 5000);
    set(this.gT.gain, o.ind === 1 ? vol * b * b * 0.05 : 0, 0.08);
    set(this.oC.frequency, o.rpm / 60 * 14); set(this.cF.frequency, o.rpm / 60 * 14);
    set(this.gC.gain, o.ind === 2 ? vol * (0.012 + b * 0.05) : 0, 0.06);
    // pneumatiky a podklad
    const sp = o.speed, squeal = o.onRoad && o.inCar ? U.clamp(Math.max((o.slip - 0.085) * 4.5, o.wspin * 0.9, o.lock), 0, 1) : 0;
    set(this.sqGain.gain, squeal * squeal * 0.16 * Math.min(1, sp / 4 + o.wspin), 0.05);
    set(this.sq1.frequency, 760 + Math.min(sp, 40) * 6); set(this.sqF.frequency, 900 + squeal * 400);
    const off = o.inCar && !o.onRoad ? 1 : 0;
    set(this.gravel.g.gain, off * Math.min(0.22, sp / 70 + o.slip * 0.4), 0.1);
    set(this.road.g.gain, o.inCar ? Math.min(0.25, sp / 110) * (o.onRoad ? 1 : 1.5) : 0, 0.1);
    set(this.windN.g.gain, Math.min(0.3, sp * sp / 5000), 0.2);
    set(this.windN.fl.frequency, 400 + sp * 12, 0.2);
  },
  // vítězné fanfáry: žesťové akordy + tympány + jásot davu
  fanfare() {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + 0.05, f = (m) => 440 * Math.pow(2, (m - 69) / 12);
    const brass = (t, m, dur, v) => {
      for (const dt of [-7, 0, 7]) {
        const o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
        o.type = 'sawtooth'; o.frequency.value = f(m); o.detune.value = dt;
        fl.type = 'lowpass'; fl.frequency.setValueAtTime(700, t); fl.frequency.linearRampToValueAtTime(3600, t + 0.07); fl.frequency.linearRampToValueAtTime(2200, t + dur);
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.03); g.gain.setValueAtTime(v * 0.8, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(fl); fl.connect(g); g.connect(this.master); g.connect(this.verbIn); o.start(t); o.stop(t + dur + 0.05);
      }
    };
    const seq = [[0, 67, 0.13], [0.15, 67, 0.13], [0.3, 67, 0.13], [0.45, 72, 0.55], [1.02, 71, 0.18], [1.22, 72, 0.18], [1.44, 76, 1.6]];
    for (const [dt, m, d] of seq) { brass(t0 + dt, m, d, 0.07); brass(t0 + dt, m - 12, d, 0.04); }
    for (const m of [60, 64, 67]) brass(t0 + 1.44, m, 1.6, 0.04);
    for (let i = 0; i < 10; i++) this.tone(70, 0.25, 0.25, 'sine', 50, true, 1.0 + i * 0.045);   // tympánové víření
    this.tone(55, 0.9, 0.5, 'sine', 40, true, 1.44);
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 0.6;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.16, t0 + 1.2); g.gain.linearRampToValueAtTime(0.0001, t0 + 4.5);
    s.connect(bp); bp.connect(g); g.connect(this.master); s.start(t0); s.stop(t0 + 4.6);
  },
  // smutný trombon pro poraženého
  sadTrombone() {
    const c = this.ctx; if (!c) return;
    const t0 = c.currentTime + 0.05, f = (m) => 440 * Math.pow(2, (m - 69) / 12);
    [[0, 63, 0.42], [0.45, 62, 0.42], [0.9, 61, 0.42], [1.35, 60, 1.5]].forEach(([dt, m, d], i) => {
      const t = t0 + dt, o = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(f(m) * 1.02, t); o.frequency.linearRampToValueAtTime(f(m), t + 0.1);
      if (i === 3) { const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 6; lg.gain.value = 9; l.connect(lg); lg.connect(o.frequency); l.start(t + 0.3); l.stop(t + d); }
      fl.type = 'lowpass'; fl.frequency.setValueAtTime(500, t); fl.frequency.linearRampToValueAtTime(1300, t + 0.15); fl.frequency.linearRampToValueAtTime(700, t + d);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(fl); fl.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.05);
    });
  },
  // drag: proudový motor (hučení + pískot), raketa (řev), nitro (syčení)
  thrust(o) {
    const c = this.ctx; if (!c) return;
    if (!this._thr) {
      const mk = (type, f, q) => { const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.start(); const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.master); return { g, fl }; };
      const jo = c.createOscillator(); jo.type = 'sine'; jo.frequency.value = 2000; const jg = c.createGain(); jg.gain.value = 0; jo.connect(jg); jg.connect(this.master); jo.start();
      this._thr = { jet: mk('bandpass', 400, 0.5), jetW: { o: jo, g: jg }, rocket: mk('lowpass', 300, 0.8), nitro: mk('highpass', 4000, 0.6) };
    }
    const T = this._thr, t = c.currentTime, set = (p, v, k) => p.setTargetAtTime(v, t, k || 0.08);
    set(T.jet.g.gain, (o.jet || 0) * 0.5); set(T.jet.fl.frequency, 300 + (o.jet || 0) * 900);
    set(T.jetW.g.gain, (o.jet || 0) * 0.025); set(T.jetW.o.frequency, 1800 + (o.jet || 0) * 2600);
    set(T.rocket.g.gain, (o.rocket || 0) * 0.9, 0.03); set(T.nitro.g.gain, (o.nitro || 0) * 0.12, 0.04);
  },
  wind(s) { if (this.ctx) this.amb.g.gain.setTargetAtTime(0.025 + s * 0.45, this.ctx.currentTime, 0.4); },
  burst(dur, freq, vol, type, verb, sweepTo) {
    if (!this.ctx) return;
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = freq;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, c.currentTime + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    s.connect(f); f.connect(g); g.connect(this.master); if (verb) g.connect(this.verbIn);
    s.start(); s.stop(c.currentTime + dur);
    return g;
  },
  tone(freq, dur, vol, type, slideTo, verb, delay) {
    if (!this.ctx) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + (delay || 0);
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master); if (verb) g.connect(this.verbIn); o.start(c.currentTime); o.stop(t0 + dur);
  },
  // náraz: tupá rána + plechové cinknutí (neharmonické tóny) + dozvuk
  crash(v) {
    if (typeof Pad !== 'undefined') Pad.rumble(v);
    this.burst(0.6 + v * 0.6, 700, 0.5 + v * 0.5, 'lowpass', true);
    this.tone(60, 0.5, 0.45 * v, 'square', 28, true);
    for (const f of [317, 523, 871, 1290]) this.tone(f * (0.9 + Math.random() * 0.2), 0.4 + v * 0.5, 0.05 * v, 'triangle', null, true);
    if (v > 0.5) setTimeout(() => this.burst(0.5, 4000, 0.15 * v, 'highpass', true), 120);   // sklo
  },
  bump() { this.burst(0.25, 260, 0.45); this.tone(55, 0.18, 0.25, 'sine', 35); },
  // startér: bzučení elektromotoru s rytmem komprese
  crank() {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(), am = c.createOscillator(), amg = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(95, t + 0.9);
    am.type = 'square'; am.frequency.value = 6.5; amg.gain.value = 0.12; am.connect(amg); amg.connect(g.gain);
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0.16, t); g.gain.setValueAtTime(0.16, t + 0.85); g.gain.linearRampToValueAtTime(0, t + 0.95);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t); am.start(t); o.stop(t + 1); am.stop(t + 1);
  },
  shift(cond) {
    this.burst(0.06, 1800, 0.18, 'bandpass'); this.tone(140, 0.07, 0.12, 'square', 90);
    if (cond < 30) this.burst(0.35, 3200, 0.22 * (1 - cond / 30), 'bandpass', false, 1200);   // skřípání
  },
  // turbo: upuštění tlaku "pššt" s třepotáním
  blowoff(b) {
    if (!this.ctx) return;
    const g = this.burst(0.45, 5000, 0.28 * b, 'bandpass', false, 1400);
    if (!g) return;
    const c = this.ctx, fl = c.createOscillator(), fg = c.createGain(); fl.type = 'square'; fl.frequency.value = 26; fg.gain.value = 0.1 * b;
    fl.connect(fg); fg.connect(g.gain); fl.start(); fl.stop(c.currentTime + 0.45);
  },
  backfire(loud) { const n = loud ? 3 : 1; for (let i = 0; i < n; i++) setTimeout(() => { this.burst(0.09, 500, loud ? 0.55 : 0.3, 'lowpass', true); this.tone(70, 0.08, 0.3, 'square', 40); }, i * (70 + Math.random() * 90)); },
  spray() { for (let i = 0; i < 3; i++) setTimeout(() => this.burst(0.35, 6000, 0.18, 'highpass'), i * 380); },
  step(wood) { if (wood) { this.tone(110, 0.07, 0.12, 'sine', 70); this.burst(0.05, 900, 0.07, 'lowpass'); } else this.burst(0.11, 1100 + Math.random() * 500, 0.07, 'bandpass'); },
  click() { this.tone(900, 0.04, 0.15, 'square'); },
  pickup() { this.tone(600, 0.08, 0.15, 'triangle', 900); },
  install() { this.burst(0.15, 2500, 0.3, 'highpass'); setTimeout(() => this.tone(400, 0.1, 0.2, 'square', 300), 120); },
  punch() { this.burst(0.12, 600, 0.35); this.tone(90, 0.08, 0.2, 'sine', 50); },
  bite() { this.burst(0.15, 1500, 0.3, 'bandpass'); this.tone(220, 0.15, 0.15, 'sawtooth', 120); },
  howl() { this.tone(500, 1.4, 0.12, 'sine', 820, true); setTimeout(() => this.tone(780, 1.2, 0.1, 'sine', 420, true), 900); },
  horn() { this.tone(330, 0.5, 0.2, 'sawtooth'); this.tone(415, 0.5, 0.15, 'sawtooth'); },
  shot(id) {
    if (id === 'shotgun') { this.burst(0.4, 2200, 0.8, 'lowpass', true); this.tone(80, 0.3, 0.45, 'square', 35, true); setTimeout(() => this.tone(300, 0.06, 0.12, 'square', 200), 420); }
    else if (id === 'sniper') { this.burst(0.55, 3200, 0.85, 'lowpass', true); this.tone(65, 0.45, 0.45, 'square', 28, true); this.burst(0.05, 6000, 0.3, 'highpass'); }
    else if (id === 'smg') { this.burst(0.09, 2600, 0.45, 'highpass', true); this.tone(150, 0.05, 0.15, 'square', 80); }
    else { this.burst(0.18, 2400, 0.55, 'highpass', true); this.tone(140, 0.12, 0.28, 'square', 60, true); }
  },
  swish() { this.burst(0.14, 2200, 0.18, 'bandpass', false, 900); },
  // zaklepnutý kužel: dutý plastový „tok“, odraz o zem a cinknutí počítadla
  coneKnock(k, goal) {
    this.tone(430 + Math.random() * 60, 0.09, 0.32, 'triangle', 240);
    this.burst(0.07, 1900, 0.28, 'bandpass');
    setTimeout(() => { this.tone(310, 0.06, 0.16, 'triangle', 200); this.burst(0.05, 1400, 0.12, 'bandpass'); }, 140);
    setTimeout(() => { this.tone(260, 0.05, 0.09, 'triangle', 180); }, 250);
    if (k === goal) { this.tone(1047, 0.14, 0.16, 'square', null, false, 0.05); this.tone(1319, 0.14, 0.16, 'square', null, false, 0.18); this.tone(1568, 0.3, 0.18, 'square', null, true, 0.31); }
    else this.tone(990 + k * 18, 0.1, 0.12, 'sine', null, false, 0.05);
  },
  pop() { this.burst(0.08, 800, 0.35, 'bandpass'); },
  coin() { this.tone(880, 0.08, 0.15, 'square'); setTimeout(() => this.tone(1320, 0.12, 0.15, 'square'), 80); },
  ratchet() { this.burst(0.05, 3000, 0.2, 'highpass'); },
  hurt() { this.tone(180, 0.2, 0.25, 'sawtooth', 90); },
};
