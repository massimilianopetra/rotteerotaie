// Numeri casuali con seme (stesso seme = stesso mondo) e rumore per il terreno.
(function () {
  'use strict';
  const G = window.GIOCO = window.GIOCO || {};

  function aggiungiAiuti(f) {
    f.intero = (min, max) => min + Math.floor(f() * (max - min + 1));
    f.scegli = arr => arr[Math.floor(f() * arr.length)];
    return f;
  }

  // generatore mulberry32
  G.creaCasuale = function (seme) {
    let a = seme >>> 0;
    return aggiungiAiuti(function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    });
  };

  // durante la partita va bene il caso "vero"
  G.casualeLibero = aggiungiAiuti(() => Math.random());

  // rumore a valori interpolati, sommato su più ottave (risultato circa 0..1)
  G.creaRumore = function (rnd) {
    const perm = new Uint8Array(512), val = new Float32Array(256);
    for (let i = 0; i < 256; i++) { perm[i] = i; val[i] = rnd(); }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = perm[i]; perm[i] = perm[j]; perm[j] = t;
    }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const v = (ix, iy) => val[perm[(ix & 255) + perm[iy & 255]]];
    const liscia = t => t * t * (3 - 2 * t);
    function base(x, y) {
      const ix = Math.floor(x), iy = Math.floor(y), fx = liscia(x - ix), fy = liscia(y - iy);
      const a = v(ix, iy), b = v(ix + 1, iy), c = v(ix, iy + 1), d = v(ix + 1, iy + 1);
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    }
    return function (x, y, ottave) {
      let s = 0, amp = 1, tot = 0, f = 1;
      for (let o = 0; o < (ottave || 4); o++) {
        s += base(x * f + o * 17.3, y * f + o * 9.1) * amp;
        tot += amp; amp *= 0.5; f *= 2;
      }
      return s / tot;
    };
  };

  // hash veloce di due interi in 0..1 (per i dettagli del disegno)
  G.hash = function (x, y) {
    let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
})();
