// Disegno della mappa vista dall'alto su un canvas 2D.
// Il terreno è preparato una volta in un'immagine (8 pixel per casella) e poi ridimensionato con lo zoom;
// strade, binari, case, industrie, stazioni e veicoli si ridisegnano a ogni fotogramma (solo la parte visibile).
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO, T = G.T, OCC = G.OCC;
  // pixel per casella del terreno pre-disegnato: 8 sulle mappe inventate, meno su quelle reali (grandi),
  // perché l'immagine resti sotto i 12 milioni di pixel (circa 50 MB)
  let PX = 8;
  const D = G.disegno = { cam: { x: 0, y: 0, ts: 16 }, terreno: null, mini: null, ox: 0, oy: 0 };

  // ---------------------------------------------------------------- terreno
  function altA(m, fx, fy) {
    const u = Math.max(0, Math.min(m.W - 1.001, fx - 0.5)), v = Math.max(0, Math.min(m.H - 1.001, fy - 0.5));
    const x0 = u | 0, y0 = v | 0, ax = u - x0, ay = v - y0, W = m.W, i = y0 * W + x0;
    const a = m.alt[i], b = m.alt[i + 1], c = m.alt[i + W], d = m.alt[i + W + 1];
    return a + (b - a) * ax + (c - a) * ay + (a - b - c + d) * ax * ay;
  }

  function coloreTerra(m, a) {
    const tappe = [
      [m.livMare, 98, 156, 74], [m.livPian, 146, 166, 90], [m.livColl, 150, 134, 100], [m.livNeve, 126, 116, 108]
    ];
    if (a <= tappe[0][0]) return [tappe[0][1], tappe[0][2], tappe[0][3]];
    for (let k = 1; k < tappe.length; k++) {
      if (a <= tappe[k][0]) {
        const p = tappe[k - 1], q = tappe[k], f = (a - p[0]) / (q[0] - p[0]);
        return [p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f, p[3] + (q[3] - p[3]) * f];
      }
    }
    const f = Math.min(0.85, (a - m.livNeve) * 60), u = tappe[3];
    return [u[1] + (222 - u[1]) * f, u[2] + (226 - u[2]) * f, u[3] + (234 - u[3]) * f];
  }

  function pixelCasella(m, x, y, data, larg, ox, oy) {
    const i = y * m.W + x, t = m.tipo[i], mare = m.livMare;
    // alberi: tre chiome per casella in posizioni pseudo-casuali
    const alberi = [];
    if (m.bosco[i]) for (let k = 0; k < 3; k++) {
      const u = PX / 8;
      alberi.push([(1.6 + G.hash(x * 3 + k, y) * 4.8) * u, (1.6 + G.hash(x, y * 3 + k + 7) * 4.8) * u, (1.5 + G.hash(x + k, y + 11) * 0.9) * u]);
    }
    for (let py = 0; py < PX; py++) for (let px = 0; px < PX; px++) {
      const fx = x + (px + 0.5) / PX, fy = y + (py + 0.5) / PX;
      const n = (G.hash(x * PX + px, y * PX + py) - 0.5) * 10;
      let r, g, b;
      if (t === T.ACQUA) {
        const p = Math.max(0, Math.min(1, (mare - altA(m, fx, fy)) / (mare * 0.45)));
        r = 66 - 36 * p; g = 134 - 54 * p; b = 188 - 40 * p;
        r += n * 0.4; g += n * 0.4; b += n * 0.4;
      } else if (t === T.FIUME) {
        r = 72 + n * 0.5; g = 140 + n * 0.5; b = 202 + n * 0.5;
      } else {
        const a = altA(m, fx, fy);
        [r, g, b] = coloreTerra(m, a);
        const ombra = Math.max(-45, Math.min(45, (altA(m, fx - 0.25, fy - 0.25) - altA(m, fx + 0.25, fy + 0.25)) * 1300));
        r += ombra + n; g += ombra + n; b += ombra * 0.8 + n;
        if (alberi.length) {
          r *= 0.86; g *= 0.9; b *= 0.82;
          for (const [cx, cy, rr] of alberi) {
            const dx = px + 0.5 - cx, dy = py + 0.5 - cy;
            if (dx * dx + dy * dy <= rr * rr) {
              const luce = dx + dy < -0.6;
              r = luce ? 62 : 34; g = luce ? 116 : 82; b = luce ? 54 : 40;
              r += n * 0.5; g += n * 0.5;
            }
          }
        }
      }
      const k = ((oy + py) * larg + ox + px) * 4;
      data[k] = r; data[k + 1] = g; data[k + 2] = b; data[k + 3] = 255;
    }
  }

  G.preparaTerreno = function (st) {
    const m = st.mondo, cv = document.createElement('canvas');
    PX = Math.max(2, Math.min(8, Math.floor(Math.sqrt(12e6 / m.N))));
    cv.width = m.W * PX; cv.height = m.H * PX;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(cv.width, cv.height);
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) pixelCasella(m, x, y, img.data, cv.width, x * PX, y * PX);
    ctx.putImageData(img, 0, 0);
    D.terreno = { cv, ctx };
    D.mini = null;
    st.minimappaSporca = true;
  };

  function ridisegnaCasella(m, i) {
    const x = i % m.W, y = (i / m.W) | 0, img = D.terreno.ctx.createImageData(PX, PX);
    pixelCasella(m, x, y, img.data, PX, 0, 0);
    D.terreno.ctx.putImageData(img, x * PX, y * PX);
  }

  // ---------------------------------------------------------------- conversioni
  G.schermoAMondo = (sx, sy) => ({ x: (sx - D.ox) / D.cam.ts, y: (sy - D.oy) / D.cam.ts });

  // ---------------------------------------------------------------- reti
  // salta(i, j): tratti da non disegnare (da lontano le vie comunali stanno nell'immagine dell'abitato)
  function percorsiRete(V, mask, divisore, salta) {
    const { m, ts, ox, oy } = V, p1 = new Path2D(), p2 = new Path2D();
    let n1 = 0, n2 = 0;
    for (let y = Math.max(0, V.y0 - 1); y <= Math.min(m.H - 1, V.y1 + 1); y++) {
      for (let x = Math.max(0, V.x0 - 1); x <= Math.min(m.W - 1, V.x1 + 1); x++) {
        const i = y * m.W + x, mk = mask[i];
        if (!mk) continue;
        const cx = ox + (x + 0.5) * ts, cy = oy + (y + 0.5) * ts;
        for (let d = 1; d <= 4; d++) if ((mk >> d) & 1) {
          const j = i + G.DY[d] * m.W + G.DX[d];
          if (salta && salta(i, j)) continue;
          const secondo = divisore && divisore(i, j);
          const p = secondo ? p2 : p1;
          p.moveTo(cx, cy); p.lineTo(cx + G.DX[d] * ts, cy + G.DY[d] * ts);
          if (secondo) n2++; else n1++;
        }
      }
    }
    return { p1, p2, n1, n2 };
  }

  function disegnaPonti(V) {
    const { m, ts, ox, oy, ctx } = V;
    ctx.fillStyle = '#7d6b55';
    for (let y = V.y0; y <= V.y1; y++) for (let x = V.x0; x <= V.x1; x++) {
      const i = y * m.W + x;
      if (m.tipo[i] === T.FIUME && ((m.mBin[i] && V.vis.ferrovie) || (m.mStr[i] && (m.strCitta[i] ? V.vis.vie : V.vis.strade)))) {
        ctx.fillRect(ox + (x + 0.12) * ts, oy + (y + 0.12) * ts, ts * 0.76, ts * 0.76);
      }
    }
  }

  function disegnaStrade(V) {
    const { m, ts, ctx } = V;
    // le vie comunali non si disegnano da lontano (stanno nell'immagine dell'abitato) né quando sono nascoste;
    // le strade del giocatore quando è nascosto il loro livello
    const vie = !V.lontano && V.vis.vie, strade = V.vis.strade;
    const r = percorsiRete(V, m.mStr, (i, j) => m.tipoStr[i] === 2 && m.tipoStr[j] === 2,
      vie && strade ? null : (i, j) => (m.strCitta[i] && m.strCitta[j] ? !vie : !strade));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (r.n1) {
      ctx.strokeStyle = '#5f5b52'; ctx.lineWidth = Math.max(1.6, ts * 0.36); ctx.stroke(r.p1);
      if (ts >= 6) { ctx.strokeStyle = '#aaa595'; ctx.lineWidth = ts * 0.24; ctx.stroke(r.p1); }
    }
    if (r.n2) {
      ctx.strokeStyle = '#2b2e33'; ctx.lineWidth = Math.max(2.2, ts * 0.56); ctx.stroke(r.p2);
      if (ts >= 6) {
        ctx.strokeStyle = '#4b5058'; ctx.lineWidth = ts * 0.44; ctx.stroke(r.p2);
        ctx.strokeStyle = '#f0d264'; ctx.lineWidth = Math.max(1, ts * 0.04);
        ctx.setLineDash([ts * 0.18, ts * 0.18]); ctx.lineCap = 'butt'; ctx.stroke(r.p2); ctx.setLineDash([]); ctx.lineCap = 'round';
      }
    }
  }

  function disegnaBinari(V) {
    const { m, ts, ctx } = V;
    const r = percorsiRete(V, m.mBin, null);
    if (!r.n1) return;
    if (ts < 10) {
      ctx.lineCap = 'round';
      // sul terreno attenuato i binari hanno un bordo chiaro e si vedono anche da lontano
      if (V.vis.attenua) { ctx.strokeStyle = '#f3e3bf'; ctx.lineWidth = Math.max(3.5, ts * 0.5); ctx.stroke(r.p1); }
      ctx.strokeStyle = '#3a281a'; ctx.lineWidth = Math.max(1.5, ts * 0.28); ctx.stroke(r.p1);
      return;
    }
    ctx.lineCap = 'butt';
    ctx.strokeStyle = '#6b5136'; ctx.lineWidth = ts * 0.38;
    ctx.setLineDash([ts * 0.06, ts * 0.09]); ctx.stroke(r.p1); ctx.setLineDash([]);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#c9ccd0'; ctx.lineWidth = ts * 0.2; ctx.stroke(r.p1);
    ctx.strokeStyle = '#6e5841'; ctx.lineWidth = ts * 0.1; ctx.stroke(r.p1);
  }

  // ---------------------------------------------------------------- edifici
  const COL_CASE = [null, ['#c8694a', '#b85e43', '#d07a52'], ['#b5503a', '#a8473a', '#c2603f'],
    ['#cdbb9c', '#bfae90', '#d6c6a8'], ['#8d99a8', '#7f8b9b', '#9aa6b4']];
  const DIM = [0, 0.46, 0.6, 0.74, 0.88];

  // da lontano case e vie comunali sono troppe per disegnarle una per una (sulle mappe reali decine di
  // migliaia): si usa un'immagine già pronta con PA pixel per casella, rifatta solo quando le città cambiano.
  // "Lontano" = meno di 6 pixel per casella, sulle mappe reali (fittissime) meno di 12.
  const PA = 4;
  G.lontano = (m, ts) => ts < (m.reale ? 12 : 6);
  function preparaAbitato(st) {
    const m = st.mondo, L = m.W * PA;
    if (!D.abitato || D.abitato.width !== L || D.abitato.height !== m.H * PA) {
      D.abitato = document.createElement('canvas'); D.abitato.width = L; D.abitato.height = m.H * PA;
    }
    const c = D.abitato.getContext('2d'), img = c.createImageData(L, m.H * PA), d = img.data;
    const col = COL_CASE.map(l => l && l.map(coloreHex)), via = [125, 120, 108];
    const px = (X, Y, k) => { const o = (Y * L + X) * 4; d[o] = k[0]; d[o + 1] = k[1]; d[o + 2] = k[2]; d[o + 3] = 255; };
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const i = y * m.W + x, X = x * PA, Y = y * PA;
      if (m.occ[i] === OCC.CASA && G.ui.livelli.case) { // un quadrato più grande per i palazzi
        const l = m.liv[i], k = col[l][Math.floor(G.hash(x, y) * 3)], s = l >= 3 ? 3 : 2, o = l >= 3 ? 0 : 1;
        for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) px(X + o + b, Y + o + a, k);
      } else if (m.strCitta[i] && m.mStr[i] && G.ui.livelli.vie) { // il centro e i tratti verso le vie vicine
        const mk = m.mStr[i];
        px(X + 1, Y + 1, via); px(X + 2, Y + 1, via); px(X + 1, Y + 2, via); px(X + 2, Y + 2, via);
        for (let dd = 0; dd < 8; dd++) if ((mk >> dd) & 1) {
          const dx = G.DX[dd], dy = G.DY[dd];
          if (dx && dy) px(X + (dx > 0 ? 3 : 0), Y + (dy > 0 ? 3 : 0), via);
          else if (dx) { px(X + (dx > 0 ? 3 : 0), Y + 1, via); px(X + (dx > 0 ? 3 : 0), Y + 2, via); }
          else { px(X + 1, Y + (dy > 0 ? 3 : 0), via); px(X + 2, Y + (dy > 0 ? 3 : 0), via); }
        }
      }
    }
    c.putImageData(img, 0, 0);
    D.abitatoSporco = false;
  }

  function disegnaCase(V) {
    const { m, ts, ox, oy, ctx } = V;
    if (V.lontano) {
      if (!V.vis.case && !V.vis.vie) return;
      if (!D.abitato || D.abitatoSporco) preparaAbitato(V.st);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(D.abitato, V.x0 * PA, V.y0 * PA, (V.x1 - V.x0 + 1) * PA, (V.y1 - V.y0 + 1) * PA,
        ox + V.x0 * ts, oy + V.y0 * ts, (V.x1 - V.x0 + 1) * ts, (V.y1 - V.y0 + 1) * ts);
      return;
    }
    if (!V.vis.case) return;
    for (let y = V.y0; y <= V.y1; y++) for (let x = V.x0; x <= V.x1; x++) {
      const i = y * m.W + x;
      if (m.occ[i] !== OCC.CASA) continue;
      const l = m.liv[i], s = ts * DIM[l], h1 = G.hash(x, y), h2 = G.hash(y + 91, x);
      const gioco = ts * (0.92 - DIM[l]) * 0.5;
      const cx = ox + (x + 0.5) * ts + (h1 - 0.5) * gioco, cy = oy + (y + 0.5) * ts + (h2 - 0.5) * gioco;
      if (ts >= 5) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(cx - s / 2 + ts * 0.06, cy - s / 2 + ts * 0.08, s, s); }
      ctx.fillStyle = COL_CASE[l][Math.floor(h1 * 3)];
      ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
      if (ts >= 10) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        if (h2 < 0.5) ctx.fillRect(cx - s / 2, cy - s / 2, s, s / 2); else ctx.fillRect(cx - s / 2, cy - s / 2, s / 2, s);
        if (l >= 3) { ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(cx - s / 2 + 0.5, cy - s / 2 + 0.5, s - 1, s - 1); }
      }
    }
  }

  function emoji(ctx, testo, x, y, dim) {
    ctx.font = `${Math.round(dim)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(testo, x, y);
  }

  function visibile(V, x, y, lato) {
    return x + lato >= V.x0 - 1 && x <= V.x1 + 1 && y + lato >= V.y0 - 1 && y <= V.y1 + 1;
  }

  function disegnaIndustrie(st, V) {
    const { ts, ox, oy, ctx } = V;
    for (const ind of st.industrie) {
      if (ind.chiusa || !visibile(V, ind.x, ind.y, 2)) continue;
      const def = C.industrie[ind.tipo], x = ox + ind.x * ts, y = oy + ind.y * ts, s = 2 * ts, b = ts * 0.1;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + b + ts * 0.1, y + b + ts * 0.12, s - 2 * b, s - 2 * b);
      ctx.fillStyle = def.colore; ctx.fillRect(x + b, y + b, s - 2 * b, s - 2 * b);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.max(1, ts * 0.06);
      ctx.strokeRect(x + b, y + b, s - 2 * b, s - 2 * b);
      if (ts >= 6) emoji(ctx, def.icona, x + ts, y + ts, ts * 1.1);
    }
  }

  // ---------------------------------------------------------------- stazioni ferroviarie
  // piazzale e banchine sotto i binari; sopra i binari pensiline e fabbricato viaggiatori
  function strisceBanchina(V, i, larg, dist, colore) {
    const { m, ts, ox, oy, ctx } = V, mk = m.mBin[i];
    const cx = ox + (i % m.W + 0.5) * ts, cy = oy + (((i / m.W) | 0) + 0.5) * ts;
    ctx.strokeStyle = colore; ctx.lineWidth = ts * larg; ctx.lineCap = 'butt';
    ctx.beginPath();
    for (let d = 0; d < 8; d++) if ((mk >> d) & 1) {
      const dx = G.DX[d], dy = G.DY[d], l = Math.hypot(dx, dy), nx = -dy / l * ts * dist, ny = dx / l * ts * dist;
      for (const sgn of [1, -1]) { ctx.moveTo(cx + sgn * nx, cy + sgn * ny); ctx.lineTo(cx + sgn * nx + dx * ts * 0.5, cy + sgn * ny + dy * ts * 0.5); }
    }
    ctx.stroke();
  }

  function disegnaBasiStazioni(st, V) {
    const { m, ts, ox, oy, ctx } = V;
    if (ts < 6) return;
    for (const s of st.stazioni) {
      if (!s || s.tipo !== 'stazione' || !visibile(V, s.x, s.y, s.lato)) continue;
      ctx.fillStyle = '#9d978a';
      ctx.fillRect(ox + s.x * ts, oy + s.y * ts, s.lato * ts, s.lato * ts);
      for (const i of G.caselleStazione(st, s)) if (m.mBin[i]) strisceBanchina(V, i, 0.2, 0.33, '#d9d2c1');
    }
  }

  function tetto(ctx, x, y, w, h, colore, scuro) {
    // tetto a padiglione visto dall'alto: due falde e il colmo lungo il lato più lungo
    ctx.fillStyle = colore; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = scuro;
    if (w >= h) ctx.fillRect(x, y + h / 2, w, h / 2); else ctx.fillRect(x + w / 2, y, w / 2, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    if (w >= h) { ctx.moveTo(x + h / 2, y + h / 2); ctx.lineTo(x + w - h / 2, y + h / 2); }
    else { ctx.moveTo(x + w / 2, y + w / 2); ctx.lineTo(x + w / 2, y + h - w / 2); }
    ctx.stroke();
  }

  function orologio(ctx, cx, cy, r) {
    ctx.fillStyle = '#f7f1e0'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = Math.max(1, r * 0.25); ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.18); ctx.beginPath();
    ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - r * 0.7); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.5, cy); ctx.stroke();
  }

  // fabbricato viaggiatori nel rettangolo (in pixel); taglia: fermata, media, grande, centrale
  function fabbricato(ctx, x, y, w, h, taglia, ts) {
    const b = Math.min(w, h) * 0.1;
    x += b; y += b; w -= 2 * b; h -= 2 * b;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + ts * 0.07, y + ts * 0.09, w, h);
    if (taglia === 'fermata') { // casello con tettoia
      tetto(ctx, x, y, w, h, '#8c5a3c', '#6f4630');
      return;
    }
    ctx.fillStyle = '#ead9b0'; ctx.fillRect(x, y, w, h);
    const r = Math.min(w, h) * 0.12;
    tetto(ctx, x + r, y + r, w - 2 * r, h - 2 * r, '#b04a32', '#8f3a27');
    ctx.strokeStyle = '#4a3a28'; ctx.lineWidth = Math.max(1, ts * 0.04); ctx.strokeRect(x, y, w, h);
    if (taglia === 'grande' || taglia === 'centrale') { // corpo centrale più alto con l'orologio
      const cw = Math.min(w, h) * 0.55, cx = x + w / 2, cy = y + h / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(cx - cw / 2 + ts * 0.05, cy - cw / 2 + ts * 0.06, cw, cw);
      tetto(ctx, cx - cw / 2, cy - cw / 2, cw, cw, '#c95b3f', '#a3462f');
      if (ts >= 12) orologio(ctx, cx, cy, cw * 0.28);
    }
    if (taglia === 'centrale' && ts >= 8) { // quattro torrette agli angoli
      const t = Math.min(w, h) * 0.22;
      for (const [tx, ty] of [[x, y], [x + w - t, y], [x, y + h - t], [x + w - t, y + h - t]]) {
        ctx.fillStyle = '#5b6770'; ctx.fillRect(tx, ty, t, t);
        ctx.fillStyle = '#7f8c96'; ctx.fillRect(tx, ty, t, t / 2);
      }
    } else if (taglia === 'media' && ts >= 14) orologio(ctx, x + w / 2, y + h / 2, Math.min(w, h) * 0.16);
  }

  function disegnaStazioneFerroviaria(st, V, s) {
    const { m, ts, ox, oy, ctx } = V, taglia = s.taglia || 'media';
    const x = ox + s.x * ts, y = oy + s.y * ts, L = s.lato * ts;
    if (ts < 6) { // da lontano: un segno semplice
      ctx.fillStyle = '#ead9b0'; ctx.fillRect(x, y, L, L);
      ctx.fillStyle = '#b04a32'; ctx.fillRect(x, y, L, L * 0.45);
      return;
    }
    const caselle = G.caselleStazione(st, s), libere = caselle.filter(i => !m.mBin[i]);
    // pensiline sopra le banchine (la fermata ha solo il casello)
    if (taglia !== 'fermata') for (const i of caselle) if (m.mBin[i]) strisceBanchina(V, i, 0.14, 0.34, 'rgba(120,52,36,0.9)');
    if (s.lato === 1) {
      const mk = m.mBin[caselle[0]];
      if (!mk) { fabbricato(ctx, x, y, ts, ts, taglia, ts); return; }
      // il fabbricato si mette di fianco al binario: bit 2 e 6 = est-ovest, bit 0 e 4 = nord-sud
      const oriz = (mk & 0x44) && !(mk & 0x11), vert = (mk & 0x11) && !(mk & 0x44);
      const p = taglia === 'fermata' ? 0.28 : 0.34;
      if (oriz) fabbricato(ctx, x + ts * 0.08, y - ts * 0.04, ts * 0.84, ts * p, taglia, ts);
      else if (vert) fabbricato(ctx, x - ts * 0.04, y + ts * 0.08, ts * p, ts * 0.84, taglia, ts);
      else {
        // binari in diagonale o incroci: un piccolo edificio in un angolo libero
        const q = ts * 0.4, ne = mk & 0x22; // diagonale NE-SO: liberi gli angoli NO e SE
        fabbricato(ctx, ne ? x : x + ts - q, y, q, q, taglia, ts);
      }
      return;
    }
    if (!libere.length) return;
    // le caselle senza binari si dividono in blocchi contigui: il blocco più grande è il fabbricato principale,
    // gli altri sono ali più semplici; un blocco rettangolare diventa un solo edificio
    const blocchi = [], visto = new Set();
    for (const i of libere) {
      if (visto.has(i)) continue;
      const b = [], coda = [i];
      visto.add(i);
      while (coda.length) {
        const k = coda.pop();
        b.push(k);
        for (const j of [k - 1, k + 1, k - m.W, k + m.W]) {
          if (libere.includes(j) && !visto.has(j) && (Math.abs(j - k) !== 1 || ((j / m.W) | 0) === ((k / m.W) | 0))) { visto.add(j); coda.push(j); }
        }
      }
      blocchi.push(b);
    }
    blocchi.sort((a, b) => b.length - a.length);
    blocchi.forEach((b, n) => {
      const tb = n === 0 ? taglia : 'media2';
      const xs = b.map(i => i % m.W), ys = b.map(i => (i / m.W) | 0);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      if ((x1 - x0 + 1) * (y1 - y0 + 1) === b.length) fabbricato(ctx, ox + x0 * ts, oy + y0 * ts, (x1 - x0 + 1) * ts, (y1 - y0 + 1) * ts, tb, ts);
      else for (const i of b) fabbricato(ctx, ox + (i % m.W) * ts, oy + ((i / m.W) | 0) * ts, ts, ts, 'media2', ts);
    });
  }

  function disegnaStazioni(st, V, ui) {
    const { ts, ox, oy, ctx } = V;
    for (const s of st.stazioni) {
      if (!s || !visibile(V, s.x, s.y, s.lato)) continue;
      const x = ox + s.x * ts, y = oy + s.y * ts;
      if (s.tipo === 'stazione') {
        disegnaStazioneFerroviaria(st, V, s);
      } else if (s.tipo === 'deposito') {
        const b = ts * 0.2, l = ts - 2 * b;
        ctx.fillStyle = '#2f6db5'; ctx.fillRect(x + b, y + b, l, l);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, ts * 0.06); ctx.strokeRect(x + b, y + b, l, l);
        if (ts >= 12) { ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(ts * 0.45)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('A', x + ts / 2, y + ts / 2 + 1); }
      } else {
        const s2 = 2 * ts;
        ctx.fillStyle = '#a7ab9f'; ctx.fillRect(x + ts * 0.05, y + ts * 0.05, s2 - ts * 0.1, s2 - ts * 0.1);
        ctx.fillStyle = '#45484c'; ctx.fillRect(x + ts * 0.12, y + ts * 1.1, s2 - ts * 0.24, ts * 0.42);
        if (ts >= 8) {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, ts * 0.04); ctx.setLineDash([ts * 0.15, ts * 0.12]);
          ctx.beginPath(); ctx.moveTo(x + ts * 0.25, y + ts * 1.31); ctx.lineTo(x + s2 - ts * 0.25, y + ts * 1.31); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(x + ts * 0.2, y + ts * 0.2, ts * 0.9, ts * 0.55);
        ctx.fillStyle = '#c0392b'; ctx.fillRect(x + ts * 1.4, y + ts * 0.2, ts * 0.22, ts * 0.6);
      }
      // merce in attesa: quadratini colorati
      if (ts >= 16) {
        let riga = 0;
        const q = ts * 0.16;
        for (const k in s.attesa) {
          const n = Math.min(8, Math.ceil(s.attesa[k] / 25));
          if (s.attesa[k] < 1) continue;
          ctx.fillStyle = C.merci[k].colore;
          for (let j = 0; j < n; j++) ctx.fillRect(x + s.lato * ts + 2 + j * (q + 1), y + riga * (q + 1), q, q);
          riga++;
        }
      }
    }
  }

  // ---------------------------------------------------------------- veicoli
  function rettangolo(ctx, x, y, ang, lun, larg, colore, bordo) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    ctx.fillStyle = colore; ctx.fillRect(-lun / 2, -larg / 2, lun, larg);
    if (bordo) { ctx.strokeStyle = bordo; ctx.lineWidth = 1; ctx.strokeRect(-lun / 2, -larg / 2, lun, larg); }
    ctx.restore();
  }

  function sagomaAereo(ctx, x, y, ang, dim, colore) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(dim, dim);
    ctx.fillStyle = colore;
    ctx.beginPath();
    ctx.moveTo(0.5, 0); ctx.lineTo(0.38, 0.06); ctx.lineTo(0.08, 0.07); ctx.lineTo(-0.05, 0.5); ctx.lineTo(-0.15, 0.5);
    ctx.lineTo(-0.1, 0.07); ctx.lineTo(-0.36, 0.06); ctx.lineTo(-0.45, 0.2); ctx.lineTo(-0.5, 0.2); ctx.lineTo(-0.47, 0);
    ctx.lineTo(-0.5, -0.2); ctx.lineTo(-0.45, -0.2); ctx.lineTo(-0.36, -0.06); ctx.lineTo(-0.1, -0.07); ctx.lineTo(-0.15, -0.5);
    ctx.lineTo(-0.05, -0.5); ctx.lineTo(0.08, -0.07); ctx.lineTo(0.38, -0.06); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function disegnaVeicoli(st, V, ui) {
    const { ts, ox, oy, ctx } = V;
    const fuori = v => v.x < V.x0 - 3 || v.x > V.x1 + 4 || v.y < V.y0 - 3 || v.y > V.y1 + 4;
    // prima treni e mezzi su strada, poi gli aerei sopra a tutto
    for (const passo of [0, 1]) for (const v of st.veicoli) {
      if ((v.tipo === 'aereo') !== (passo === 1) || fuori(v)) continue;
      const mod = G.modello(v.modello), sel = ui.selVeicolo === v.id;
      if (v.tipo === 'treno') {
        const pezzi = 1 + v.vagoni, passoV = 0.44;
        for (let k = pezzi - 1; k >= 0; k--) {
          const q = v.punti ? G.puntoSu(v, v.pos - k * passoV, v.seg) : { x: v.x, y: v.y, ang: v.ang };
          rettangolo(ctx, ox + q.x * ts, oy + q.y * ts, q.ang, ts * 0.4, Math.max(2, ts * 0.22),
            k === 0 ? mod.colore : C.merci[v.merce].colore, ts >= 10 ? 'rgba(0,0,0,0.6)' : null);
        }
      } else if (v.tipo === 'strada') {
        const off = ts * 0.1, px = -Math.sin(v.ang) * off, py = Math.cos(v.ang) * off;
        const x = ox + v.x * ts + px, y = oy + v.y * ts + py;
        rettangolo(ctx, x, y, v.ang, Math.max(3, ts * 0.32), Math.max(2, ts * 0.17), v.classe === 'bus' ? mod.colore : C.merci[v.merce].colore, 'rgba(0,0,0,0.6)');
      } else {
        const prog = v.stato === 'viaggio' && v.lunTot > 0 ? Math.min(1, Math.min(v.pos, v.lunTot - v.pos) / 2) : 0;
        const dim = Math.max(12, ts * 0.9) * (1 + prog * 0.3);
        sagomaAereo(ctx, ox + (v.x + prog * 0.7) * ts, oy + (v.y + prog * 0.9) * ts, v.ang, dim, 'rgba(0,0,0,0.3)');
        sagomaAereo(ctx, ox + v.x * ts, oy + v.y * ts, v.ang, dim, mod.colore);
      }
      if (sel) {
        ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(ox + v.x * ts, oy + v.y * ts, Math.max(8, ts * 0.5), 0, Math.PI * 2); ctx.stroke();
      }
    }
  }

  // segnale rosso davanti ai treni che aspettano che il binario si liberi
  function disegnaSegnali(st, V) {
    const { m, ts, ox, oy, ctx } = V;
    if (ts < 8) return;
    for (const v of st.veicoli) {
      if (v.tipo !== 'treno' || v.stato !== 'viaggio' || !v.bloccatoDa || !v.caselle) continue;
      const i = v.caselle[Math.min(v.limite + 1, v.caselle.length - 1)], j = v.caselle[v.limite];
      // a metà fra la testa del treno e la casella occupata, spostato di lato
      const x = ox + ((i % m.W + j % m.W) / 2 + 0.5) * ts, y = oy + ((((i / m.W) | 0) + ((j / m.W) | 0)) / 2 + 0.5) * ts;
      const r = Math.max(3, ts * 0.13), dx = -Math.sin(v.ang) * ts * 0.32, dy = Math.cos(v.ang) * ts * 0.32;
      ctx.fillStyle = '#1b1b1b'; ctx.fillRect(x + dx - r * 1.3, y + dy - r * 1.3, r * 2.6, r * 2.6);
      ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---------------------------------------------------------------- scritte e sovrapposizioni
  function etichetta(ctx, testo, x, y, dim, colore) {
    ctx.font = `bold ${Math.round(dim)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, dim / 4); ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineJoin = 'round';
    ctx.strokeText(testo, x, y);
    ctx.fillStyle = colore || '#fff'; ctx.fillText(testo, x, y);
  }

  function disegnaEtichette(st, V) {
    const { ts, ox, oy, ctx } = V;
    const dim = Math.max(11, Math.min(20, ts * 0.8));
    // le città più grandi per prime; si salta la scritta che coprirebbe una già messa
    // (sulle mappe reali le città sono migliaia: da lontano si leggono solo le maggiori)
    if (!st._cittaOrd || st._cittaOrd.n !== st.citta.length || st._cittaOrd.giorno !== st.giornoInt) {
      st._cittaOrd = { n: st.citta.length, giorno: st.giornoInt, elenco: [...st.citta].sort((a, b) => b.pop - a.pop) };
    }
    const LATO = 120, settori = new Map(), messe = [];
    const libero = (x0, y0, x1, y1) => {
      for (let sy = Math.floor(y0 / LATO); sy <= Math.floor(y1 / LATO); sy++) for (let sx = Math.floor(x0 / LATO); sx <= Math.floor(x1 / LATO); sx++) {
        for (const r of settori.get(sx * 10007 + sy) || []) if (x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]) return false;
      }
      return true;
    };
    const occupa = r => {
      for (let sy = Math.floor(r[1] / LATO); sy <= Math.floor(r[3] / LATO); sy++) for (let sx = Math.floor(r[0] / LATO); sx <= Math.floor(r[2] / LATO); sx++) {
        const k = sx * 10007 + sy;
        if (!settori.has(k)) settori.set(k, []);
        settori.get(k).push(r);
      }
    };
    for (const c of V.vis.nomi ? st._cittaOrd.elenco : []) {
      if (!visibile(V, c.x - 4, c.y - 2, 8)) continue;
      const x = ox + (c.x + 0.5) * ts, y = oy + (c.y + 0.5) * ts - Math.max(ts * 1.2, 16);
      const mezza = Math.max(c.nome.length * dim * 0.3, 2.2 * dim) + 3;
      const r = [x - mezza, y - dim * 0.6, x + mezza, y + dim * 1.4];
      if (!libero(r[0], r[1], r[2], r[3])) continue;
      occupa(r);
      messe.push([c, x, y]);
    }
    for (const [c, x, y] of messe) {
      etichetta(ctx, c.nome, x, y, dim, '#fff');
      etichetta(ctx, G.numero(c.pop) + ' ab.', x, y + dim * 0.95, dim * 0.68, '#ffe9a8');
    }
    if (ts >= 20 && V.vis.stazioni) {
      for (const s of st.stazioni) {
        if (!s || !visibile(V, s.x, s.y, s.lato)) continue;
        etichetta(ctx, s.nome, ox + (s.x + s.lato / 2) * ts, oy + (s.y + s.lato) * ts + 7, 10, '#cfe6ff');
      }
    }
    if (ts >= 22 && V.vis.industrie) {
      for (const ind of st.industrie) {
        if (ind.chiusa || !visibile(V, ind.x, ind.y, 2)) continue;
        etichetta(ctx, C.industrie[ind.tipo].nome, ox + (ind.x + 1) * ts, oy + (ind.y + 2) * ts + 7, 10, '#e8e0ff');
      }
    }
  }

  function rettCaselle(V, x, y, w, h, riempi, bordo) {
    const { ts, ox, oy, ctx } = V;
    if (riempi) { ctx.fillStyle = riempi; ctx.fillRect(ox + x * ts, oy + y * ts, w * ts, h * ts); }
    if (bordo) { ctx.strokeStyle = bordo; ctx.lineWidth = 1.5; ctx.strokeRect(ox + x * ts + 0.5, oy + y * ts + 0.5, w * ts - 1, h * ts - 1); }
  }

  function disegnaSovrapposizioni(st, V, ui) {
    const { m, ts, ox, oy, ctx } = V;
    // bacino della stazione selezionata o in costruzione
    let b = ui.bacino;
    if (!b && ui.pannello && ui.pannello.tipo === 'stazione') {
      const s = st.stazioni[ui.pannello.id];
      if (s) b = { x: s.x, y: s.y, lato: s.lato, raggio: G.defStazione(s).raggio, ok: true, esistente: true };
    }
    if (b) {
      const r = b.raggio;
      rettCaselle(V, b.x - r, b.y - r, b.lato + 2 * r, b.lato + 2 * r, 'rgba(90,170,255,0.16)', 'rgba(140,200,255,0.8)');
      if (!b.esistente) rettCaselle(V, b.x, b.y, b.lato, b.lato, b.ok ? 'rgba(80,220,120,0.45)' : 'rgba(240,70,60,0.5)', '#fff');
    }
    // percorso del veicolo selezionato
    const v = ui.selVeicolo && st.veicoli.find(k => k.id === ui.selVeicolo);
    if (v && v.fermate.length) {
      ctx.strokeStyle = 'rgba(255,235,59,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
      ctx.beginPath();
      v.fermate.forEach((f, k) => {
        const s = st.stazioni[f.s]; if (!s) return;
        const c = G.centroStazione(s);
        if (k === 0) ctx.moveTo(ox + c.x * ts, oy + c.y * ts); else ctx.lineTo(ox + c.x * ts, oy + c.y * ts);
      });
      if (v.fermate.length > 2) ctx.closePath();
      ctx.stroke(); ctx.setLineDash([]);
      v.fermate.forEach((f, k) => {
        const s = st.stazioni[f.s]; if (!s) return;
        const c = G.centroStazione(s);
        ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(ox + c.x * ts, oy + c.y * ts - ts * 0.7, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(k + 1), ox + c.x * ts, oy + c.y * ts - ts * 0.7);
      });
    }
    // binario prenotato dal treno selezionato (davanti alla testa): solo in modalità debug
    if (G.modoDebug && v && v.tipo === 'treno' && v.pr && ts >= 6) {
      ctx.fillStyle = 'rgba(255,170,40,0.28)';
      for (const e of v.pr) if (e.d > v.odo + 0.3) ctx.fillRect(ox + (e.i % m.W) * ts, oy + ((e.i / m.W) | 0) * ts, ts, ts);
    }
    // anteprima del tracciato
    const a = ui.anteprima;
    if (a && a.caselle) {
      ctx.strokeStyle = a.ok ? 'rgba(90,255,140,0.85)' : 'rgba(255,80,70,0.85)';
      ctx.lineWidth = Math.max(3, ts * 0.3); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      a.caselle.forEach((i, k) => {
        const x = ox + (i % m.W + 0.5) * ts, y = oy + (((i / m.W) | 0) + 0.5) * ts;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      if (a.caselle.length === 1) ctx.lineTo(ox + (a.caselle[0] % m.W + 0.5) * ts + 0.1, oy + (((a.caselle[0] / m.W) | 0) + 0.5) * ts);
      ctx.stroke();
    }
    // casella sotto il mouse
    if (ui.cursore >= 0 && ui.strumento !== 'info' && !ui.bacino) {
      rettCaselle(V, ui.cursore % m.W, (ui.cursore / m.W) | 0, 1, 1, null, 'rgba(255,255,255,0.8)');
    }
  }

  function disegnaEffetti(st, V) {
    const { ts, ox, oy, ctx } = V;
    if (ts < 8) return;
    for (const e of st.effetti) {
      ctx.globalAlpha = Math.max(0, 1 - e.t / 2.5);
      etichetta(ctx, e.testo, ox + e.x * ts, oy + e.y * ts - ts * 0.6 - e.t * 22, 13, '#ffe066');
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- fotogramma
  G.disegna = function (st, ctx, w, h, ui) {
    const m = st.mondo, cam = D.cam, ts = cam.ts;
    while (st.sporchi.length) { ridisegnaCasella(m, st.sporchi.pop()); st.minimappaSporca = true; }
    if (st.minimappaSporca) D.abitatoSporco = true;
    const ox = Math.round(w / 2 - cam.x * ts), oy = Math.round(h / 2 - cam.y * ts);
    D.ox = ox; D.oy = oy;
    const x0 = Math.max(0, Math.floor(-ox / ts)), y0 = Math.max(0, Math.floor(-oy / ts));
    const x1 = Math.min(m.W - 1, Math.ceil((w - ox) / ts)), y1 = Math.min(m.H - 1, Math.ceil((h - oy) / ts));
    ctx.fillStyle = '#121c26'; ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = ts < PX;
    ctx.drawImage(D.terreno.cv, x0 * PX, y0 * PX, (x1 - x0 + 1) * PX, (y1 - y0 + 1) * PX,
      ox + x0 * ts, oy + y0 * ts, (x1 - x0 + 1) * ts, (y1 - y0 + 1) * ts);
    const vis = ui.livelliVisibili ? ui.livelliVisibili() : { case: true, vie: true, strade: true, ferrovie: true, stazioni: true, industrie: true, mezzi: true, nomi: true };
    const V = { m, st, ts, ox, oy, x0, y0, x1, y1, ctx, lontano: G.lontano(m, ts), vis };
    if (vis.attenua) { // terreno più scuro e meno colorato: binari e stazioni risaltano
      ctx.fillStyle = 'rgba(16, 24, 32, 0.55)';
      ctx.fillRect(ox + x0 * ts, oy + y0 * ts, (x1 - x0 + 1) * ts, (y1 - y0 + 1) * ts);
    }
    if (vis.griglia && ts >= 8) {
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = x0; x <= x1 + 1; x++) { ctx.moveTo(ox + x * ts + 0.5, oy + y0 * ts); ctx.lineTo(ox + x * ts + 0.5, oy + (y1 + 1) * ts); }
      for (let y = y0; y <= y1 + 1; y++) { ctx.moveTo(ox + x0 * ts, oy + y * ts + 0.5); ctx.lineTo(ox + (x1 + 1) * ts, oy + y * ts + 0.5); }
      ctx.stroke();
    }
    disegnaPonti(V);
    disegnaStrade(V);
    if (vis.stazioni) disegnaBasiStazioni(st, V);
    if (vis.ferrovie) disegnaBinari(V);
    disegnaCase(V);
    if (vis.industrie) disegnaIndustrie(st, V);
    if (vis.stazioni) disegnaStazioni(st, V, ui);
    disegnaSovrapposizioni(st, V, ui);
    if (vis.mezzi) disegnaVeicoli(st, V, ui);
    if (vis.ferrovie) disegnaSegnali(st, V);
    disegnaEtichette(st, V);
    disegnaEffetti(st, V);
  };

  // ---------------------------------------------------------------- minimappa
  function coloreHex(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }

  function costruisciMini(st) {
    const m = st.mondo;
    if (!D.mini) { D.mini = document.createElement('canvas'); D.mini.width = m.W; D.mini.height = m.H; }
    const c = D.mini.getContext('2d');
    c.imageSmoothingEnabled = true;
    c.drawImage(D.terreno.cv, 0, 0, m.W, m.H);
    const img = c.getImageData(0, 0, m.W, m.H), d = img.data;
    const colInd = {};
    for (const k in C.industrie) colInd[k] = coloreHex(C.industrie[k].colore);
    for (let i = 0; i < m.N; i++) {
      let col = null;
      // sulle mappe reali i paesi sono ovunque: case appena accennate e niente vie comunali,
      // altrimenti la minimappa diventa una macchia rossa
      if (m.reale && (m.occ[i] === OCC.CASA || (m.strCitta[i] && !m.mBin[i]))) {
        if (m.occ[i] === OCC.CASA) { d[i * 4] = (d[i * 4] + 214) / 2; d[i * 4 + 1] = (d[i * 4 + 1] + 92) / 2; d[i * 4 + 2] = (d[i * 4 + 2] + 64) / 2; }
        continue;
      }
      if (m.occ[i] === OCC.CASA) col = [214, 92, 64];
      else if (m.occ[i] === OCC.INDUSTRIA) col = colInd[st.industrie[m.rif[i]].tipo];
      else if (m.occ[i] === OCC.STAZIONE) col = [255, 255, 255];
      else if (m.mBin[i]) col = [40, 22, 10];
      else if (m.tipoStr[i] === 2) col = [30, 30, 36];
      else if (m.mStr[i]) col = m.strCitta[i] ? [200, 110, 90] : [120, 120, 120];
      if (col) { d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; }
    }
    c.putImageData(img, 0, 0);
  }

  G.disegnaMinimappa = function (st, cv, w, h) {
    const m = st.mondo, ctx = cv.getContext('2d');
    if (!D.mini || st.minimappaSporca) { costruisciMini(st); st.minimappaSporca = false; }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(D.mini, 0, 0, cv.width, cv.height);
    const sx = cv.width / m.W, sy = cv.height / m.H, ts = D.cam.ts;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.strokeRect((D.cam.x - w / 2 / ts) * sx, (D.cam.y - h / 2 / ts) * sy, w / ts * sx, h / ts * sy);
    // veicoli come puntini
    ctx.fillStyle = '#ffeb3b';
    for (const v of st.veicoli) ctx.fillRect(v.x * sx - 1, v.y * sy - 1, 2.5, 2.5);
  };
})();
