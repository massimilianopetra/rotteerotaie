// Disegno delle navi viste dall'alto (vista 2D, e ponte della vista 3D), come treni.js per i treni.
// Ogni modello ha la sua sagoma: brigantino a vele, piroscafo a ruote, piroscafi a elica e postale con i
// fumaioli, motonave con il ponte di comando a poppa, traghetto, aliscafo, portacontainer. Le navi da carico
// mostrano la merce nelle stive (vuote se non c'è carico); in navigazione c'è la scia, i piroscafi fanno fumo.
// Coordinate locali in caselle: la prua verso +x. Da lontano (meno di 10 px per casella) una sagoma semplice.
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO;
  const N = G.navi = {};

  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const cache = new Map();
  function tinta(hex, f) {
    const k = hex + f;
    let r = cache.get(k);
    if (!r) { const c = rgb(hex), t = f > 0 ? 255 : 0, a = Math.abs(f); r = '#' + c.map(v => Math.round(v + (t - v) * a).toString(16).padStart(2, '0')).join(''); cache.set(k, r); }
    return r;
  }
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function box(ctx, x, y, w, h, col, r) { ctx.fillStyle = col; ctx.beginPath(); if (r) ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else ctx.rect(x, y, w, h); ctx.fill(); }
  function cerchio(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  // modelli: tipo di disegno, lunghezza e larghezza in caselle
  const MODELLI = {
    ruote: { t: 'ruote', L: 0.62, W: 0.15 }, brigantino: { t: 'vela', L: 0.62, W: 0.16 }, elica: { t: 'vapore', L: 0.8, W: 0.16 },
    postale: { t: 'postale', L: 0.86, W: 0.17 }, motonave: { t: 'motonave', L: 0.95, W: 0.18 }, traghetto: { t: 'traghetto', L: 1.0, W: 0.23 },
    aliscafo: { t: 'aliscafo', L: 0.56, W: 0.13 }, container: { t: 'container', L: 1.25, W: 0.23 }
  };
  N.forma = mod => MODELLI[mod.id] || (mod.classe === 'traghetto' ? { t: 'traghetto', L: 0.9, W: 0.2 } : { t: 'motonave', L: 0.95, W: 0.18 });
  N.aVapore = mod => ['ruote', 'vapore', 'postale'].includes(N.forma(mod).t);
  // i dati per disegnare la nave v
  N.dati = (v, mod) => {
    const f = N.forma(mod);
    return { t: f.t, L: f.L, W: f.W, colore: mod.colore, merce: v.merce, coloreMerce: C.merci[v.merce].colore, carica: v.qta >= 1, seme: v.id };
  };

  // lo scafo: poppa arrotondata, prua a punta (più affilata per l'aliscafo e i velieri)
  function scafo(ctx, L, W, punta) {
    const l = L / 2, w = W / 2, p = punta || 0.25;
    ctx.beginPath();
    ctx.moveTo(-l + w * 0.5, -w);
    ctx.lineTo(l * (1 - 2 * p), -w);
    ctx.quadraticCurveTo(l * (1 - p * 0.6), -w * 0.95, l, 0);
    ctx.quadraticCurveTo(l * (1 - p * 0.6), w * 0.95, l * (1 - 2 * p), w);
    ctx.lineTo(-l + w * 0.5, w);
    ctx.quadraticCurveTo(-l, w, -l, w * 0.5);
    ctx.lineTo(-l, -w * 0.5);
    ctx.quadraticCurveTo(-l, -w, -l + w * 0.5, -w);
    ctx.closePath();
  }
  const PUNTA = { vela: 0.3, aliscafo: 0.38, traghetto: 0.18, container: 0.16 };
  // stiva: aperta con la merce (colore della merce, a mucchio) o chiusa e vuota
  function stiva(ctx, x, w, h, p, k, det) {
    box(ctx, x - w / 2, -h / 2, w, h, '#2a2622', 0.008);
    if (!p.carica) return;
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, tinta(p.coloreMerce, -0.35)); g.addColorStop(0.45, tinta(p.coloreMerce, 0.2)); g.addColorStop(1, tinta(p.coloreMerce, -0.45));
    box(ctx, x - w / 2 + 0.006, -h / 2 + 0.006, w - 0.012, h - 0.012, g, 0.006);
    if (det) for (let j = 0; j < 6; j++) cerchio(ctx, x - w / 2 + 0.01 + hash(p.seme + k, j) * (w - 0.02), -h / 2 + 0.01 + hash(j, p.seme + k) * (h - 0.02), 0.006, tinta(p.coloreMerce, j % 2 ? 0.35 : -0.4));
  }
  function fumaiolo(ctx, x, r, col, fascia) {
    cerchio(ctx, x, 0, r, '#1a1a1a');
    if (fascia) { ctx.strokeStyle = fascia; ctx.lineWidth = r * 0.45; ctx.beginPath(); ctx.arc(x, 0, r * 0.72, 0, Math.PI * 2); ctx.stroke(); }
    cerchio(ctx, x, 0, r * 0.45, '#050505');
  }
  function lancia(ctx, x, y, col) { box(ctx, x - 0.03, y - 0.011, 0.06, 0.022, col, 0.01); } // scialuppa
  function finestrini(ctx, x0, x1, y, col, passo) {
    ctx.fillStyle = col;
    for (let x = x0; x < x1; x += passo) ctx.fillRect(x, y - 0.003, passo * 0.55, 0.006);
  }

  // ---------------------------------------------------------------- i modelli
  function vela(ctx, p, det) {
    const L = p.L, W = p.W, l = L / 2;
    // bompresso
    ctx.strokeStyle = '#3b2a1c'; ctx.lineWidth = 0.008; ctx.beginPath(); ctx.moveTo(l, 0); ctx.lineTo(l + 0.08, 0); ctx.stroke();
    scafo(ctx, L, W, PUNTA.vela); ctx.fillStyle = tinta(p.colore, -0.25); ctx.fill();
    ctx.save(); ctx.scale(0.86, 0.78); scafo(ctx, L, W, PUNTA.vela); ctx.fillStyle = '#b48a5a'; ctx.fill(); ctx.restore();
    if (det) { ctx.strokeStyle = 'rgba(80,50,25,0.35)'; ctx.lineWidth = 0.003; ctx.beginPath(); for (let y = -W * 0.3; y <= W * 0.31; y += W * 0.15) { ctx.moveTo(-l * 0.8, y); ctx.lineTo(l * 0.6, y); } ctx.stroke(); }
    stiva(ctx, 0, L * 0.22, W * 0.42, p, 0, det);
    // due alberi con le vele quadre: viste dall'alto sono strisce curve più larghe della nave
    for (const xm of [L * 0.2, -L * 0.17]) {
      // la vela gonfia dal vento: una fascia curva, più larga dello scafo, con il pennone scuro
      const g = ctx.createLinearGradient(xm - 0.03, 0, xm + 0.06, 0);
      g.addColorStop(0, '#cfc5ad'); g.addColorStop(0.55, '#f6f1e4'); g.addColorStop(1, '#d8cfb8');
      ctx.fillStyle = g; ctx.beginPath();
      ctx.moveTo(xm - 0.02, -W * 0.9); ctx.quadraticCurveTo(xm + 0.09, 0, xm - 0.02, W * 0.9);
      ctx.lineTo(xm - 0.03, W * 0.86); ctx.quadraticCurveTo(xm + 0.02, 0, xm - 0.03, -W * 0.86); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#4a3523'; ctx.lineWidth = 0.007; ctx.beginPath(); ctx.moveTo(xm - 0.025, -W * 0.92); ctx.lineTo(xm - 0.025, W * 0.92); ctx.stroke();
      cerchio(ctx, xm - 0.01, 0, 0.012, '#3b2a1c');
    }
  }

  function ruote(ctx, p, det) {
    const L = p.L, W = p.W;
    // le ruote a pale, sporgenti ai fianchi
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.ellipse(0, s * W * 0.55, 0.06, W * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      if (det) { ctx.strokeStyle = '#8a3a2a'; ctx.lineWidth = 0.005; ctx.beginPath(); for (let k = -2; k <= 2; k++) { ctx.moveTo(k * 0.022, s * W * 0.38); ctx.lineTo(k * 0.022, s * W * 0.72); } ctx.stroke(); }
    }
    scafo(ctx, L, W); ctx.fillStyle = tinta(p.colore, -0.1); ctx.fill();
    ctx.save(); ctx.scale(0.9, 0.78); scafo(ctx, L, W); ctx.fillStyle = '#b48a5a'; ctx.fill(); ctx.restore();
    box(ctx, -L * 0.36, -W * 0.3, L * 0.26, W * 0.6, '#efe8d8', 0.01); // la tuga dei passeggeri
    if (det) finestrini(ctx, -L * 0.34, -L * 0.12, -W * 0.27, '#3a4a5a', 0.022), finestrini(ctx, -L * 0.34, -L * 0.12, W * 0.27, '#3a4a5a', 0.022);
    fumaiolo(ctx, L * 0.08, 0.026, '#1a1a1a', '#b3261e');
    cerchio(ctx, L * 0.3, 0, 0.01, '#3b2a1c');
  }

  function vapore(ctx, p, det, postale) {
    const L = p.L, W = p.W;
    scafo(ctx, L, W); ctx.fillStyle = p.colore; ctx.fill();
    ctx.save(); ctx.scale(0.92, 0.8); scafo(ctx, L, W); ctx.fillStyle = '#a98258'; ctx.fill(); ctx.restore();
    if (postale) {
      box(ctx, -L * 0.3, -W * 0.34, L * 0.5, W * 0.68, '#f1ece0', 0.012);
      if (det) { for (const s of [-1, 1]) for (const x of [-L * 0.22, -L * 0.06, L * 0.1]) lancia(ctx, x, s * W * 0.42, '#f7f4ec'); }
      fumaiolo(ctx, -L * 0.1, 0.026, '#1a1a1a', '#d8a020'); fumaiolo(ctx, L * 0.05, 0.026, '#1a1a1a', '#d8a020');
      box(ctx, L * 0.25, -W * 0.22, L * 0.12, W * 0.44, '#3a3a3a', 0.006); // stiva della posta
    } else {
      stiva(ctx, L * 0.26, L * 0.16, W * 0.5, p, 0, det);
      stiva(ctx, -L * 0.28, L * 0.14, W * 0.5, p, 1, det);
      box(ctx, -L * 0.1, -W * 0.32, L * 0.2, W * 0.64, '#ece6d8', 0.01);
      fumaiolo(ctx, -L * 0.02, 0.025, '#1a1a1a', '#b3261e');
      if (det) for (const x of [L * 0.14, -L * 0.17]) { cerchio(ctx, x, 0, 0.009, '#3b3b3b'); }
    }
  }

  function motonave(ctx, p, det) {
    const L = p.L, W = p.W;
    scafo(ctx, L, W); ctx.fillStyle = p.colore; ctx.fill();
    ctx.save(); ctx.scale(0.93, 0.8); scafo(ctx, L, W); ctx.fillStyle = '#8b8e8a'; ctx.fill(); ctx.restore();
    for (let k = 0; k < 3; k++) stiva(ctx, L * (0.28 - k * 0.2), L * 0.15, W * 0.55, p, k, det);
    if (det) { ctx.strokeStyle = '#d6b23a'; ctx.lineWidth = 0.006; ctx.beginPath(); for (const x of [L * 0.18, -L * 0.02]) { ctx.moveTo(x, -W * 0.3); ctx.lineTo(x + 0.03, W * 0.3); } ctx.stroke(); }
    box(ctx, -L * 0.44, -W * 0.36, L * 0.16, W * 0.72, '#f2efe8', 0.01); // il ponte di comando, a poppa
    if (det) finestrini(ctx, -L * 0.3, -L * 0.29, 0, '#2a3a4a', 0.01), box(ctx, -L * 0.29, -W * 0.33, 0.008, W * 0.66, '#2a3a4a');
    fumaiolo(ctx, -L * 0.38, 0.022, '#1a1a1a', tinta(p.colore, 0.2));
  }

  function traghetto(ctx, p, det) {
    const L = p.L, W = p.W;
    scafo(ctx, L, W, PUNTA.traghetto); ctx.fillStyle = '#e9ebee'; ctx.fill();
    ctx.fillStyle = '#1f5fa8'; ctx.fillRect(-L / 2 + 0.03, -W / 2, L * 0.75, 0.01); ctx.fillRect(-L / 2 + 0.03, W / 2 - 0.01, L * 0.75, 0.01);
    box(ctx, L * 0.28, -W * 0.3, L * 0.14, W * 0.6, '#9aa0a6', 0.01); // la rampa delle auto a prua
    const g = ctx.createLinearGradient(0, -W * 0.4, 0, W * 0.4);
    g.addColorStop(0, '#d7dbe0'); g.addColorStop(0.35, '#ffffff'); g.addColorStop(1, '#c4c9cf');
    box(ctx, -L * 0.42, -W * 0.38, L * 0.66, W * 0.76, g, 0.02);
    if (det) for (const s of [-1, 1]) for (let x = -L * 0.34; x < L * 0.18; x += L * 0.12) lancia(ctx, x, s * W * 0.42, '#f08a24');
    box(ctx, L * 0.14, -W * 0.36, L * 0.06, W * 0.72, '#2a3a4a', 0.006); // vetri della plancia
    cerchio(ctx, -L * 0.22, 0, 0.03, '#1f5fa8'); cerchio(ctx, -L * 0.22, 0, 0.016, '#0c1e33'); // fumaiolo
  }

  function aliscafo(ctx, p, det) {
    const L = p.L, W = p.W;
    // le ali immerse (si vedono sporgere ai fianchi)
    ctx.fillStyle = '#2b3138'; ctx.fillRect(L * 0.18, -W * 0.85, 0.02, W * 1.7); ctx.fillRect(-L * 0.3, -W * 0.75, 0.02, W * 1.5);
    scafo(ctx, L, W, PUNTA.aliscafo); ctx.fillStyle = '#f2f4f6'; ctx.fill();
    ctx.fillStyle = '#c4271d'; ctx.fillRect(-L / 2 + 0.01, -W / 2, L * 0.7, 0.008); ctx.fillRect(-L / 2 + 0.01, W / 2 - 0.008, L * 0.7, 0.008);
    box(ctx, -L * 0.38, -W * 0.34, L * 0.62, W * 0.68, '#dfe4ea', 0.03);
    if (det) for (const s of [-1, 1]) box(ctx, -L * 0.34, s * W * 0.3 - 0.004, L * 0.54, 0.008, '#28435e');
    ctx.fillStyle = '#28435e'; ctx.beginPath(); ctx.moveTo(L * 0.22, -W * 0.3); ctx.quadraticCurveTo(L * 0.3, 0, L * 0.22, W * 0.3); ctx.lineTo(L * 0.18, W * 0.3); ctx.lineTo(L * 0.18, -W * 0.3); ctx.fill();
  }

  const CONT = ['#2f6db5', '#b8382e', '#2e8b57', '#d08a2a', '#7a5a9a', '#3d8f9a', '#c9c9c9', '#8a2f5a'];
  function container(ctx, p, det) {
    const L = p.L, W = p.W;
    scafo(ctx, L, W, PUNTA.container); ctx.fillStyle = p.colore; ctx.fill();
    ctx.save(); ctx.scale(0.95, 0.86); scafo(ctx, L, W, PUNTA.container); ctx.fillStyle = '#7c4a3a'; ctx.fill(); ctx.restore();
    // le file di container (vuota: si vedono le stive)
    const x0 = -L * 0.3, x1 = L * 0.4, nb = 8, nr = 5, bw = (x1 - x0) / nb, rh = W * 0.8 / nr;
    for (let b = 0; b < nb; b++) for (let r = 0; r < nr; r++) {
      const x = x0 + b * bw, y = -W * 0.4 + r * rh;
      if (!p.carica) { box(ctx, x + 0.002, y + 0.002, bw - 0.004, rh - 0.004, '#3a3530'); continue; }
      box(ctx, x + 0.002, y + 0.002, bw - 0.004, rh - 0.004, CONT[Math.floor(hash(p.seme * 7 + b, r) * CONT.length)]);
    }
    box(ctx, -L * 0.44, -W * 0.4, L * 0.1, W * 0.8, '#f2efe8', 0.01); // ponte di comando
    if (det) box(ctx, -L * 0.36, -W * 0.37, 0.008, W * 0.74, '#2a3a4a');
    fumaiolo(ctx, -L * 0.47, 0.02, '#1a1a1a', '#e0c040');
  }

  const DISEGNO = { vela, ruote, vapore: (c, p, d) => vapore(c, p, d, false), postale: (c, p, d) => vapore(c, p, d, true), motonave, traghetto, aliscafo, container };

  // la nave: x, y in pixel, ts pixel per casella, scalaPx per il livello di dettaglio (vista 3D)
  N.nave = function (ctx, x, y, ang, ts, p, scalaPx) {
    const px = scalaPx || ts;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(ts, ts);
    if (px < 10) { // da lontano: lo scafo del colore del modello, con il ponte del colore della merce
      const k = Math.max(1, 9 / (p.L * px));
      ctx.scale(k, k);
      scafo(ctx, p.L, p.W * 1.2); ctx.fillStyle = p.t === 'traghetto' || p.t === 'aliscafo' ? '#e9ebee' : p.colore; ctx.fill();
      box(ctx, -p.L * 0.3, -p.W * 0.25, p.L * 0.5, p.W * 0.5, p.coloreMerce);
    } else DISEGNO[p.t](ctx, p, px >= 22);
    ctx.restore();
  };
  // ombra dello scafo sull'acqua (un po' spostata) e scia se naviga: si disegnano prima della nave
  N.scia = function (ctx, x, y, ang, ts, p, naviga, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(ts, ts);
    ctx.save(); ctx.translate(0.03, 0.03); scafo(ctx, p.L, p.W); ctx.fillStyle = 'rgba(0,20,40,0.28)'; ctx.fill(); ctx.restore();
    if (naviga) {
      const l = p.L / 2, w = p.W / 2, lun = p.t === 'aliscafo' ? 1.6 : 1.1;
      ctx.lineCap = 'round';
      // le due onde che si allargano dietro la poppa, e la schiuma dell'elica
      for (const s of [-1, 1]) {
        const g = ctx.createLinearGradient(-l, 0, -l - lun, 0);
        g.addColorStop(0, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = g; ctx.lineWidth = 0.022;
        ctx.beginPath(); ctx.moveTo(l * 0.6, s * w); ctx.quadraticCurveTo(-l, s * w * 1.6, -l - lun, s * (w + lun * 0.36)); ctx.stroke();
      }
      const g = ctx.createLinearGradient(-l, 0, -l - lun * 0.7, 0);
      g.addColorStop(0, 'rgba(240,250,255,0.75)'); g.addColorStop(1, 'rgba(240,250,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-l, -w * 0.5); ctx.lineTo(-l - lun * 0.7, -w * 1.2); ctx.lineTo(-l - lun * 0.7, w * 1.2); ctx.lineTo(-l, w * 0.5); ctx.fill();
      // l'onda di prua
      ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 0.014;
      ctx.beginPath(); ctx.moveTo(l * 0.55, -w * 1.15); ctx.quadraticCurveTo(l * 1.06, 0, l * 0.55, w * 1.15); ctx.stroke();
      if (p.t === 'ruote') { // schiuma delle ruote a pale
        for (const s of [-1, 1]) cerchio(ctx, -0.05, s * w * 1.1, 0.05 + 0.01 * Math.sin((t || 0) * 6), 'rgba(255,255,255,0.45)');
      }
    }
    ctx.restore();
  };
  // fumo dei piroscafi in navigazione (dopo la nave): parte dal fumaiolo e va indietro
  const FUMAIOLO = { ruote: 0.08, vapore: -0.02, postale: -0.02 };
  N.fumo = function (ctx, x, y, ang, ts, p, t) {
    const ca = Math.cos(ang), sa = Math.sin(ang), x0 = (FUMAIOLO[p.t] || 0) * p.L;
    for (let k = 0; k < 8; k++) {
      const f = (t * 0.7 + k / 8) % 1, d = x0 - f * 1.2, lat = f * f * 0.15;
      ctx.fillStyle = 'rgba(90,90,90,' + (0.45 * (1 - f)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(x + (ca * d - sa * lat) * ts, y + (sa * d + ca * lat) * ts, (0.035 + f * 0.13) * ts, 0, Math.PI * 2); ctx.fill();
    }
  };
  N.posizioneFumaiolo = p => (FUMAIOLO[p.t] || 0) * p.L;
  // solo la sagoma dello scafo, di un colore (per la fiancata nella vista 3D)
  N.sagoma = function (ctx, x, y, ang, ts, p, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(ts, ts);
    scafo(ctx, p.L, p.W, PUNTA[p.t]); ctx.fillStyle = col; ctx.fill();
    ctx.restore();
  };

  // 3D: le sovrastrutture come solidi [x0, x1, larghezza, z0, z1, colore, finestre], sopra il ponte (z = 0)
  N.volumi = function (p) {
    const L = p.L, W = p.W, b = '#f1ece0', f = '#2a3a4a';
    switch (p.t) {
      case 'vela': return [[L * 0.2 - 0.008, L * 0.2 + 0.008, 0.016, 0, 0.32, '#3b2a1c'], [-L * 0.17 - 0.008, -L * 0.17 + 0.008, 0.016, 0, 0.28, '#3b2a1c'],
        [L * 0.2 - 0.006, L * 0.2 + 0.006, W * 1.5, 0.08, 0.28, '#efe8d6'], [-L * 0.17 - 0.006, -L * 0.17 + 0.006, W * 1.4, 0.07, 0.25, '#efe8d6']];
      case 'ruote': return [[-0.06, 0.06, W * 1.5, -0.03, 0.06, '#2b2b2b'], [-L * 0.36, -L * 0.1, W * 0.6, 0, 0.07, b, '#3a4a5a'], [L * 0.08 - 0.022, L * 0.08 + 0.022, 0.044, 0, 0.2, '#1a1a1a']];
      case 'vapore': return [[-L * 0.1, L * 0.1, W * 0.64, 0, 0.08, b, f], [-L * 0.02 - 0.022, -L * 0.02 + 0.022, 0.044, 0, 0.2, '#1a1a1a']];
      case 'postale': return [[-L * 0.3, L * 0.2, W * 0.68, 0, 0.09, b, f], [-L * 0.1 - 0.022, -L * 0.1 + 0.022, 0.044, 0, 0.22, '#1a1a1a'], [L * 0.05 - 0.022, L * 0.05 + 0.022, 0.044, 0, 0.22, '#1a1a1a']];
      case 'motonave': return [[-L * 0.44, -L * 0.28, W * 0.72, 0, 0.14, b, f], [-L * 0.38 - 0.02, -L * 0.38 + 0.02, 0.04, 0, 0.2, '#1a1a1a']];
      case 'traghetto': return [[-L * 0.42, L * 0.24, W * 0.76, 0, 0.12, '#f4f5f7', f], [-L * 0.22 - 0.028, -L * 0.22 + 0.028, 0.056, 0.12, 0.2, '#1f5fa8']];
      case 'aliscafo': return [[-L * 0.38, L * 0.24, W * 0.68, 0, 0.05, '#dfe4ea', '#28435e']];
      case 'container': return [[-L * 0.3, L * 0.4, W * 0.8, 0, p.carica ? 0.09 : 0.01, p.carica ? '#7c6a5a' : '#3a3530'], [-L * 0.44, -L * 0.34, W * 0.8, 0, 0.2, b, f]];
    }
    return [];
  };
})();
