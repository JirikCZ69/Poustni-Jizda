// radio.js – rádio s hudbou skládanou za běhu (WebAudio, žádné soubory, žádné cizí písničky)
// Každá stanice má svůj žánr; písničky se generují ze semínka: tempo, tónina, akordy, melodie, sloka/refrén.
const STATIONS = [
  { id: 'rock', name: 'Rádio Duna', freq: '98.4', genre: 'pouštní rock', bpm: [124, 148], swing: 0, scale: [0, 2, 3, 5, 7, 8, 10],
    progs: [[0, 6, 5, 6], [0, 5, 3, 4], [0, 3, 6, 4], [0, 0, 5, 6]], root: [40, 45, 43, 38] },
  { id: 'synth', name: 'Neon FM', freq: '104.2', genre: 'synthwave', bpm: [96, 116], swing: 0, scale: [0, 2, 3, 5, 7, 8, 10],
    progs: [[0, 5, 2, 6], [0, 3, 5, 4], [5, 3, 0, 4], [0, 6, 5, 4]], root: [45, 41, 43, 40] },
  { id: 'country', name: 'Kaktus Country', freq: '88.7', genre: 'country', bpm: [100, 128], swing: 0.16, scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [[0, 3, 4, 0], [0, 0, 3, 4], [0, 3, 0, 4], [0, 4, 5, 3]], root: [43, 45, 40, 38] },
  { id: 'lofi', name: 'Oáza Lo-fi', freq: '91.1', genre: 'lo-fi', bpm: [72, 86], swing: 0.22, scale: [0, 2, 4, 5, 7, 9, 11],
    progs: [[1, 4, 0, 0], [3, 2, 1, 4], [0, 5, 1, 4], [3, 4, 2, 5]], root: [41, 43, 38, 40] },
];
const SONG_ADJ = ['Rozpálený', 'Pouštní', 'Půlnoční', 'Rezavý', 'Zlatý', 'Ztracený', 'Nekonečný', 'Prašný', 'Neonový', 'Divoký', 'Tichý', 'Rychlý', 'Poslední', 'Osamělý'];
const SONG_NOUN = ['asfalt', 'horizont', 'kaktus', 'motel', 'vítr', 'západ slunce', 'kojot', 'benzín', 'měsíc', 'kaňon', 'sen', 'prach', 'vrak', 'oheň', 'blues', 'karburátor'];
const SONG_ART = ['Los Kaktusos', 'Rezavé svíčky', 'DJ Fata Morgana', 'Kojot & Benzín', 'Neonoví jezdci', 'Sestry Prachovy', 'Johnny Výfuk', 'Oáza Beats', 'Dálniční duo', 'Karburátor Band', 'Mirage 84', 'Pepa a Supi'];

const Radio = {
  ready: false, on: true, st: 0, song: null, step: 0, nextT: 0, gapT: 0, vol: 0.6, muffle: 0,
  init() {
    if (this.ready || !Sfx.ctx) return;
    const c = this.ctx = Sfx.ctx;
    this.ready = true;
    const saved = U.store.get('pj_radio', {});
    this.on = saved.on !== false; this.st = saved.st || 0;
    this.out = c.createGain(); this.out.gain.value = 0; this.out.connect(Sfx.master);
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 18000; this.lp.connect(this.out);
    this.bus = c.createGain(); this.bus.gain.value = 0.5; this.bus.connect(this.lp);
    this.verb = c.createGain(); this.verb.gain.value = 0.25; this.verb.connect(Sfx.verbIn);
    // zkreslení kytary
    this.dist = c.createWaveShaper();
    const cu = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cu[i] = Math.tanh(x * 9) * 0.6; }
    this.dist.curve = cu;
    this.distF = c.createBiquadFilter(); this.distF.type = 'lowpass'; this.distF.frequency.value = 2600; this.distF.Q.value = 1.2;
    this.dist.connect(this.distF); this.distF.connect(this.bus);
    // praskání vinylu pro lo-fi
    const n = c.createBufferSource(); n.buffer = Sfx.noiseBuf; n.loop = true;
    const nf = c.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 3000;
    this.crackle = c.createGain(); this.crackle.gain.value = 0; n.connect(nf); nf.connect(this.crackle); this.crackle.connect(this.bus); n.start();
    this.newSong(true);
    setInterval(() => this.tick(), 25);
    this.apply();
  },
  save() { U.store.set('pj_radio', { on: this.on, st: this.st }); },
  apply() {
    if (!this.ready) return;
    const v = (Settings.s.radio === undefined ? 60 : Settings.s.radio) / 100;
    this.out.gain.setTargetAtTime(this.on ? v * 0.9 * (1 - this.muffle * 0.55) : 0, this.ctx.currentTime, 0.15);
    this.lp.frequency.setTargetAtTime(this.muffle > 0.5 ? 900 : 18000, this.ctx.currentTime, 0.2);
    this.crackle.gain.value = STATIONS[this.st].id === 'lofi' ? 0.012 : 0;
  },
  // v autě čistě, venku přidušeně (hraje z auta)
  // ztlumení během fanfár
  duck(sec) {
    if (!this.ready) return;
    const t = this.ctx.currentTime, g = this.out.gain, v = g.value;
    g.cancelScheduledValues(t); g.setValueAtTime(v, t); g.linearRampToValueAtTime(v * 0.15, t + 0.3);
    clearTimeout(this._dk); this._dk = setTimeout(() => this.apply(), sec * 1000);
  },
  setMuffle(m) { if (this.ready && m !== this.muffle) { this.muffle = m; this.apply(); } },
  toggle() { this.on = !this.on; this.save(); this.apply(); if (this.ready) Sfx.click(); this.onChange && this.onChange(); },
  next(d) {
    this.st = (this.st + (d || 1) + STATIONS.length) % STATIONS.length; this.on = true; this.save();
    if (!this.ready) return;
    Sfx.burst(0.35, 3000, 0.12, 'bandpass');   // šum ladění
    this.newSong(true); this.apply(); this.onChange && this.onChange();
  },
  setStation(i) { if (i === this.st) return; this.st = i; this.next(0); },
  volume(d) { Settings.s.radio = U.clamp((Settings.s.radio === undefined ? 60 : Settings.s.radio) + d, 0, 100); Settings.save(); this.apply(); this.onChange && this.onChange(); },
  info() {
    const S = STATIONS[this.st], s = this.song;
    return { on: this.on, name: S.name, freq: S.freq, genre: S.genre, title: s ? s.title : '', artist: s ? s.artist : '', vol: Settings.s.radio === undefined ? 60 : Settings.s.radio, st: this.st };
  },

  // ---------- skladba ----------
  newSong(now) {
    const S = STATIONS[this.st], r = U.rng(Math.floor(Math.random() * 1e9));
    const pick = (a) => a[Math.floor(r() * a.length)];
    const song = {
      bpm: S.bpm[0] + r() * (S.bpm[1] - S.bpm[0]), root: pick(S.root) + (r() < 0.3 ? 2 : 0), prog: pick(S.progs), prog2: pick(S.progs),
      title: r() < 0.25 ? 'Jízda přes ' + pick(SONG_NOUN) : pick(SONG_ADJ) + ' ' + pick(SONG_NOUN), artist: pick(SONG_ART),
      form: pick([['I', 'V', 'V', 'C', 'C', 'V', 'C', 'C', 'B', 'C', 'C', 'O'], ['I', 'C', 'V', 'V', 'C', 'C', 'B', 'B', 'C', 'C', 'O'], ['I', 'V', 'C', 'V', 'C', 'B', 'C', 'C', 'V', 'C', 'O'], ['I', 'I', 'V', 'V', 'C', 'C', 'V', 'V', 'C', 'C', 'B', 'C', 'C', 'O']]), r,
      groove: Math.floor(r() * 3), octL: r() < 0.3 ? 0 : 1, half: r() < 0.2,   // varianta rytmu, poloha melodie, půlený beat
    };
    song.title = song.title.charAt(0).toUpperCase() + song.title.slice(1);
    // motivy melodie (2 takty po 16 šestnáctinách): čísla = stupně stupnice, null = pauza
    const motif = (dens) => { const m = []; let deg = Math.floor(r() * 5); for (let i = 0; i < 32; i++) { if (r() < dens * (i % 4 === 0 ? 1.6 : i % 2 ? 0.5 : 1)) { deg = U.clamp(deg + Math.round((r() - 0.5) * 4), -2, 9); m.push(deg); } else m.push(null); } return m; };
    song.mV = motif(0.28); song.mC = motif(0.42); song.mB = motif(0.2);
    song.bars = song.form.length * 4;
    this.song = song; this.step = 0;
    if (now) this.step = (4 + Math.floor(r() * (song.bars - 12))) * 16;   // naladění = skočíš doprostřed běžící písničky, ne pořád do stejného intra
    this.nextT = this.ctx.currentTime + (now ? 0.12 : 0.05);
    this.onChange && this.onChange();
  },
  tick() {
    if (!this.ready) return;
    const c = this.ctx;
    if (c.state !== 'running') return;
    if (this.nextT < c.currentTime - 0.5) this.nextT = c.currentTime + 0.05;   // po uspání záložky nedohánět
    const s = this.song, S = STATIONS[this.st];
    while (this.nextT < c.currentTime + 0.15) {
      const t = this.nextT, sixteenth = 60 / s.bpm / 4;
      if (this.on) this.play(s, S, this.step, t, sixteenth);
      const sw = this.step % 2 === 0 ? 1 + S.swing : 1 - S.swing;
      this.nextT += sixteenth * sw;
      this.step++;
      if (this.step >= s.bars * 16) {   // konec písničky: znělka stanice a další
        if (this.on) this.jingle(this.nextT + 0.3);
        this.newSong(); this.nextT += 1.8; break;
      }
    }
  },
  midi(m) { return 440 * Math.pow(2, (m - 69) / 12); },
  deg(s, S, d, oct) { const n = S.scale.length, o = Math.floor(d / n), i = ((d % n) + n) % n; return s.root + 12 * (o + (oct || 0)) + S.scale[i]; },
  play(s, S, step, t, six) {
    const bar = Math.floor(step / 16), q = step % 16, sec = s.form[Math.floor(bar / 4)], bi = bar % 4;
    const prog = sec === 'B' ? s.prog2 : s.prog, cd = prog[bi];
    const chord = [cd, cd + 2, cd + 4, cd + 6].map(d => this.deg(s, S, d, 1));
    const root = this.deg(s, S, cd, 0);
    const chorus = sec === 'C', intro = sec === 'I' || sec === 'O', fill = bi === 3 && q >= 12 && !intro;
    const mot = sec === 'C' ? s.mC : sec === 'B' ? s.mB : s.mV, mi = (bi % 2) * 16 + q;
    const mel = (oct) => {
      if (mot[mi] === null || intro) return null;
      let d = mot[mi];
      if (q % 4 === 0) {   // na dobách tóny z akordu, ať melodie ladí s doprovodem
        let best = d, bd = 99;
        for (const ct of [cd, cd + 2, cd + 4]) for (const o of [-7, 0, 7]) { const x = ct + o; if (Math.abs(x - d) < bd) { bd = Math.abs(x - d); best = x; } }
        d = best;
      }
      return this.deg(s, S, d, oct);
    };
    const id = S.id, beat = six * 4;
    if (sec === 'O' && bi === 3 && q > 0) return;   // konec
    if (id === 'rock') {
      if (q === 0 || q === 8 || (q === 10 && chorus) || (s.groove === 1 && q === 6) || (s.groove === 2 && (q === 3 || q === 11)) || (fill && q % 2 === 0)) this.kick(t, 1);
      if (q === 4 || q === 12 || (fill && q % 2)) this.snare(t, fill ? 0.6 : 1, 0.2);
      if (s.groove === 2 ? q % 4 === 2 : q % 2 === 0) this.hat(t, chorus ? 0.5 : 0.35, chorus ? 0.09 : 0.04);
      if (q === 0 && bi === 0 && (chorus || sec === 'B')) this.crash(t);
      if (!intro || bar >= 2) { if (q % 2 === 0) this.bass(t, root, six * 1.8, 0.9, 520); }
      if (chorus || sec === 'B') { if (q % 2 === 0) this.guitar(t, root + 12, six * 1.7, 0.55); }
      else if (!intro && q === 0) this.guitar(t, root + 12, beat * 3.6, 0.45);
      const m = chorus || (s.groove === 1 && sec === 'V' && bi > 1) ? mel(s.octL) : null; if (m) this.lead(t, m + (s.octL ? 0 : 12), six * 2.2, 0.32, s.groove === 2 ? 'square' : 'sawtooth');
    } else if (id === 'synth') {
      if ((s.half ? q === 0 || q === 10 : q % 4 === 0) && !(intro && bar < 2)) this.kick(t, 0.9);
      if (s.half ? q === 8 : q === 4 || q === 12) this.snare(t, 0.9, 0.55);
      if (q % 4 === 2) this.hat(t, 0.32, 0.05);
      if (!intro) this.bass(t, root + (q % 2 ? 12 : 0), six * 0.9, 0.7, 700);
      if (q === 0) this.pad(t, chord.slice(0, 3), beat * 4, 0.16);
      if ((!intro || bar >= 2) && (s.groove !== 1 || q % 2 === 0)) this.arp(t, chord[s.groove === 2 ? [0, 2, 1, 3][q % 4] : q % 3] + 12, six * 0.9, 0.13);
      const m = mel(1); if (m && (chorus || sec === 'B')) this.lead(t, m, six * 2.5, 0.22, 'square');
    } else if (id === 'country') {
      if (q === 0 || q === 8 || (s.groove === 2 && q === 14)) { this.kick(t, 0.7); this.bass(t, q === 8 ? root + 7 : root, beat * 0.9, 0.85, 450); }
      if (s.groove === 1 && (q === 2 || q === 10) && !intro) this.bass(t, root + 4 + (q === 10 ? 3 : 0), six * 1.6, 0.5, 450);   // walking bas
      if (q === 4 || q === 12) { this.snare(t, 0.45, 0.15, true); this.strum(t, chord.slice(0, 3), 0.3); }
      if (q % 2 === 0) this.hat(t, 0.16, 0.03);
      const m = mel(1); if (m && !intro) this.pluck(t, m, six * 3, chorus ? 0.35 : 0.24);
      if (fill && q % 2 === 0) this.pluck(t, chord[(q >> 1) % 3] + 12, six * 2, 0.2);
    } else {   // lo-fi
      if (q === 0 || (s.groove === 1 ? q === 6 || q === 11 : q === 7 || q === 10) || (s.groove === 2 && q === 14)) this.kick(t, 0.65);
      if (q === 4 || q === 12) this.snare(t, 0.4, 0.3);
      if (q % 2 === 0) this.hat(t, 0.18, 0.03);
      if (q === 0 || q === 6) this.keys(t, chord, beat * (q === 0 ? 1.4 : 2.4), 0.14);
      if (q === 0) this.bass(t, root, beat * 1.8, 0.75, 300); if (q === 10) this.bass(t, root + 7, beat * 1.2, 0.6, 300);
      const m = mel(1); if (m && !intro && (chorus || q % 4 === 0)) this.lead(t, m + 12, six * 3, 0.13, 'sine');
    }
  },
  jingle(t) {
    const S = STATIONS[this.st], base = this.midi(this.deg(this.song || { root: 60 }, S, 0, 2));
    [0, 4, 7, 12].forEach((iv, i) => this.note(t + i * 0.13, base * Math.pow(2, iv / 12), 0.5, 0.12, 'triangle', 3500, true));
  },

  // ---------- nástroje ----------
  env(g, t, a, peak, dur, rel) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + Math.max(a, dur - rel)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); },
  note(t, f, dur, vol, type, cut, verb, dest) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
    o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = cut || 4000;
    o.connect(fl); fl.connect(g); g.connect(dest || this.bus); if (verb) g.connect(this.verb);
    this.env(g, t, 0.005, vol, dur, dur * 0.5); o.start(t); o.stop(t + dur + 0.05);
    return o;
  },
  kick(t, v) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(0.9 * v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.35);
  },
  noiseHit(t, type, f, q, vol, dur, verb) {
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = Sfx.noiseBuf; s.playbackRate.value = 1; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.bus); if (verb) g.connect(this.verb);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  },
  snare(t, v, verb, rim) {
    if (rim) { this.noiseHit(t, 'bandpass', 2500, 3, 0.35 * v, 0.06); this.note(t, 420, 0.05, 0.2 * v, 'square', 2000); return; }
    this.noiseHit(t, 'bandpass', 1900, 0.8, 0.55 * v, 0.2, verb > 0.3);
    this.note(t, 190, 0.1, 0.3 * v, 'triangle', 1200);
  },
  hat(t, v, dur) { this.noiseHit(t, 'highpass', 7500, 0.7, 0.22 * v, dur); },
  crash(t) { this.noiseHit(t, 'highpass', 5000, 0.5, 0.25, 1.3, true); },
  bass(t, m, dur, v, cut) { this.note(t, this.midi(m), dur, 0.32 * v, 'sawtooth', cut); this.note(t, this.midi(m - 12), dur, 0.18 * v, 'sine', 400); },
  guitar(t, m, dur, v) {   // power chord přes zkreslení
    for (const iv of [0, 7, 12]) { const o = this.note(t, this.midi(m + iv) * (1 + (Math.random() - 0.5) * 0.004), dur, 0.12 * v, 'sawtooth', 6000, false, this.dist); o.detune.value = (Math.random() - 0.5) * 12; }
  },
  lead(t, m, dur, v, type) {
    const o = this.note(t, this.midi(m), dur, v * 0.6, type, type === 'sine' ? 2500 : 3200, true);
    const lfo = this.ctx.createOscillator(), lg = this.ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 9; lfo.connect(lg); lg.connect(o.detune); lfo.start(t); lfo.stop(t + dur + 0.05);
  },
  pad(t, notes, dur, v) {
    for (const m of notes) for (const dt of [-8, 8]) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain(), fl = c.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = this.midi(m); o.detune.value = dt; fl.type = 'lowpass'; fl.frequency.value = 1100;
      o.connect(fl); fl.connect(g); g.connect(this.bus); g.connect(this.verb);
      this.env(g, t, dur * 0.25, v * 0.35, dur, dur * 0.3); o.start(t); o.stop(t + dur + 0.05);
    }
  },
  arp(t, m, dur, v) { this.note(t, this.midi(m), dur, v, 'square', 2200, true); },
  pluck(t, m, dur, v) {   // "twang": trojúhelník + pila, rychlý útlum, malé sklouznutí
    const o = this.note(t, this.midi(m), dur, v, 'sawtooth', 2400, true);
    o.frequency.setValueAtTime(this.midi(m) * 0.97, t); o.frequency.exponentialRampToValueAtTime(this.midi(m), t + 0.06);
    this.note(t, this.midi(m + 12), dur * 0.5, v * 0.3, 'triangle', 5000);
  },
  strum(t, notes, v) { notes.forEach((m, i) => this.note(t + i * 0.012, this.midi(m), 0.25, v * 0.35, 'triangle', 3000)); },
  keys(t, notes, dur, v) {   // měkké elektrické piano
    notes.forEach((m, i) => { this.note(t + i * 0.01, this.midi(m), dur, v, 'sine', 3000, true); this.note(t + i * 0.01, this.midi(m + 12), dur * 0.4, v * 0.25, 'triangle', 2500); });
  },
};
