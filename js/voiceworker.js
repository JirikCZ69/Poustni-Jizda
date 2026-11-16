// voiceworker.js – přeladění hlasu spolujezdce (WSOLA časové natažení). Načítá se jako obyčejný skript (funkce wsolaStretch)
// i jako Web Worker – tam počítá mimo hlavní vlákno, takže hlášení spolujezdce nezasekne hru.
function wsolaStretch(x, sr, f) {
    const N = Math.round(sr * 0.046) & ~1, Hs = N / 2, Ha = Hs / f, tol = Math.round(sr * 0.012);
    const win = new Float32Array(N); for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    const frames = Math.max(1, Math.floor((x.length - N - tol) / Ha)), out = new Float32Array(frames * Hs + N);
    let prev = 0;
    for (let k = 0; k < frames; k++) {
      const nom = Math.round(k * Ha); let best = Math.min(nom, x.length - N);
      if (k > 0) {
        const ref = prev + Hs; let bc = -Infinity;
        if (ref + N / 2 <= x.length) for (let d = -tol; d <= tol; d += 2) {
          const q = nom + d; if (q < 0 || q + N > x.length) continue;
          let c = 0; for (let i = 0; i < N / 2; i += 3) c += x[ref + i] * x[q + i];
          if (c > bc) { bc = c; best = q; }
        }
      }
      const o = k * Hs; for (let i = 0; i < N; i++) out[o + i] += x[best + i] * win[i];
      prev = best;
    }
    return out;
  }
if (typeof window === 'undefined' && typeof onmessage !== 'undefined') {
  onmessage = (e) => { const { id, x, sr, f } = e.data; const out = wsolaStretch(x, sr, f); postMessage({ id, out }, [out.buffer]); };
}
