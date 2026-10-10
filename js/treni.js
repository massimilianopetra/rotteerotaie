// Disegno di locomotive e vagoni visti dall'alto (vista 2D, e tetti della vista 3D).
// Un pezzo misura 0,4 × 0,22 caselle; il davanti è verso +x locale. Le locomotive cambiano secondo il tipo
// (vapore, elettrica, diesel, alta velocità), i vagoni secondo la merce e l'epoca del modello.
// Da lontano (meno di 10 px per casella) restano rettangoli col colore del modello o della merce.
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO;
  const T = G.treni = {};

  // ---------------------------------------------------------------- aiutanti
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  // f > 0 schiarisce verso il bianco, f < 0 scurisce verso il nero (risultato in esadecimale, con cache)
  const cache = new Map();
  function tinta(hex, f) {
    const k = hex + f;
    let r = cache.get(k);
    if (!r) {
      const c = rgb(hex), t = f > 0 ? 255 : 0, a = Math.abs(f);
      r = '#' + c.map(v => Math.round(v + (t - v) * a).toString(16).padStart(2, '0')).join('');
      cache.set(k, r);
    }
    return r;
  }
  function hash(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); }
  function box(ctx, x, y, w, h, col, r) { ctx.fillStyle = col; if (r) { rr(ctx, x, y, w, h, r); ctx.fill(); } else ctx.fillRect(x, y, w, h); }
  function cerchio(ctx, x, y, r, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  // cilindro (caldaia, cisterna, tetto curvo) visto dall'alto: luce dal lato giusto (LY = ±1)
  let LY = 1;
  function sfumaY(ctx, w, col, forza) {
    const k = forza || 1, g = ctx.createLinearGradient(0, -LY * w / 2, 0, LY * w / 2);
    g.addColorStop(0, tinta(col, -0.25 * k)); g.addColorStop(0.28, tinta(col, 0.32 * k));
    g.addColorStop(0.5, tinta(col, 0.08 * k)); g.addColorStop(1, tinta(col, -0.5 * k));
    return g;
  }

  // ---------------------------------------------------------------- modelli
  const LOCO = {
    leopolda: 'vaporeAntico', gr552: 'vapore', gr640: 'vapore', gr685: 'vapore',
    e626: 'elettrica', d341: 'diesel', e444: 'muso', e402: 'muso', etr500: 'alta'
  };
  // i modelli aggiunti a mano al catalogo si riconoscono dal nome
  function tipoLoco(id) {
    if (LOCO[id]) return LOCO[id];
    const m = G.modello(id), n = (m && m.nome || '').toLowerCase(), anno = m ? m.anno : 1900;
    if (n.includes('vapore') || n.includes('steam')) return anno < 1860 ? 'vaporeAntico' : 'vapore';
    if (n.includes('diesel')) return 'diesel';
    if (n.includes('alta') || n.includes('high') || n.includes('etr')) return 'alta';
    return anno < 1960 ? 'elettrica' : 'muso';
  }
  T.aVapore = mod => /^vapore/.test(tipoLoco(mod.id));
  // epoca dei vagoni dall'anno del modello: 0 legno, 1 castano, 2 grigio ardesia, 3 moderno
  T.epoca = anno => anno < 1890 ? 0 : anno < 1955 ? 1 : anno < 1985 ? 2 : 3;
  // i dati per disegnare il pezzo k del treno v (0 = la locomotiva)
  T.dati = function (v, k, mod) {
    if (k === 0) return { genere: 'loco', modello: mod.id, colore: mod.colore };
    return { genere: 'vagone', merce: v.merce, coloreMerce: C.merci[v.merce].colore, epoca: T.epoca(mod.anno),
      alta: tipoLoco(mod.id) === 'alta' && v.merce === 'passeggeri', vuoto: !v.qta, seme: v.id * 31 + k };
  };
  // orologio del fumo: in secondi veri, fermo quando il gioco è in pausa
  let orologio = 0, ultimo = 0;
  T.tempo = function () {
    const ora = performance.now();
    if (ultimo && C.velocita[G.ui.velocita] > 0) orologio += Math.min(0.1, (ora - ultimo) / 1000);
    ultimo = ora;
    return orologio;
  };
  const CARROZZE = [
    { corpo: '#6e4426', tetto: '#46423c', vetri: '#e8d9a8' },
    { corpo: '#5b3125', tetto: '#4d4c49', vetri: '#c9d6dd' },
    { corpo: '#56655f', tetto: '#6c706e', vetri: '#c9d6dd' },
    { corpo: '#e6e9e4', tetto: '#868b8f', vetri: '#9fb9c9', fascia: '#2f7d4f', fascia2: '#2a4f8f' }
  ];
  const ALTA = { corpo: '#d2d5d8', tetto: '#8f969c', vetri: '#38434c', fascia: '#c4271d' };
  const CONTAINER = ['#2f6db5', '#b8382e', '#2e8b57', '#d08a2a', '#7a5a9a', '#3d8f9a'];

  // ---------------------------------------------------------------- pezzi comuni
  function respingenti(ctx, det, dietro, davanti) {
    if (!det) return;
    for (const s of [-1, 1]) {
      if ((s < 0 && !dietro) || (s > 0 && !davanti)) continue;
      ctx.fillStyle = '#1c1c1c';
      ctx.fillRect(s > 0 ? 0.197 : -0.207, -0.085, 0.01, 0.028); ctx.fillRect(s > 0 ? 0.197 : -0.207, 0.057, 0.01, 0.028);
      ctx.fillRect(s > 0 ? 0.2 : -0.222, -0.007, 0.022, 0.014); // gancio
    }
  }
  function soffietto(ctx) { // mantice fra le carrozze
    ctx.fillStyle = '#202020'; ctx.fillRect(0.196, -0.05, 0.024, 0.1); ctx.fillRect(-0.22, -0.05, 0.024, 0.1);
  }

  // ---------------------------------------------------------------- locomotive
  function vapore(ctx, p, det, antica) {
    const col = p.colore, ottone = '#c9a24a';
    // tender: cassa, carbone davanti, passo d'uomo dell'acqua dietro
    box(ctx, -0.2, -0.102, 0.122, 0.204, tinta(col, -0.1), 0.012);
    box(ctx, -0.142, -0.082, 0.058, 0.164, '#141414', 0.008);
    if (det) for (let k = 0; k < 14; k++) cerchio(ctx, -0.138 + hash(k, 3) * 0.05, -0.075 + hash(k, 7) * 0.15, 0.008, k % 2 ? '#3c3c3c' : '#262626');
    cerchio(ctx, -0.172, 0, 0.022, tinta(col, -0.35)); if (det) cerchio(ctx, -0.172, 0, 0.014, tinta(col, 0.15));
    // passerella sotto la caldaia
    box(ctx, -0.075, -0.1, 0.25, 0.2, '#35302b');
    // caldaia
    ctx.fillStyle = sfumaY(ctx, 0.13, col, 1.2); ctx.fillRect(-0.004, -0.065, 0.142, 0.13);
    ctx.fillStyle = sfumaY(ctx, 0.13, '#202020', 1); ctx.fillRect(0.132, -0.065, 0.042, 0.13); // camera a fumo
    if (det) { ctx.fillStyle = antica ? ottone : tinta(col, 0.45); for (const x of [0.03, 0.075, 0.12]) ctx.fillRect(x, -0.065, 0.005, 0.13); }
    // duomi e camino
    const gd = (x, r, c) => { const g = ctx.createRadialGradient(x - 0.3 * r, -LY * 0.3 * r, r * 0.1, x, 0, r); g.addColorStop(0, tinta(c, 0.5)); g.addColorStop(1, tinta(c, -0.3)); cerchio(ctx, x, 0, r, g); };
    gd(0.09, 0.03, antica ? ottone : col);
    if (!antica) gd(0.045, 0.022, col);
    cerchio(ctx, 0.154, 0, antica ? 0.034 : 0.026, '#151515'); cerchio(ctx, 0.154, 0, antica ? 0.022 : 0.016, '#000');
    if (antica && det) { ctx.strokeStyle = ottone; ctx.lineWidth = 0.005; ctx.beginPath(); ctx.arc(0.154, 0, 0.032, 0, Math.PI * 2); ctx.stroke(); }
    if (det) cerchio(ctx, 0.008, 0, 0.012, ottone); // valvole di sicurezza
    // cabina (la Leopolda ha solo la piattaforma scoperta)
    if (antica) {
      box(ctx, -0.075, -0.1, 0.07, 0.2, '#4a3a2a');
      if (det) { ctx.strokeStyle = ottone; ctx.lineWidth = 0.006; ctx.strokeRect(-0.07, -0.092, 0.06, 0.184); }
    } else {
      box(ctx, -0.078, -0.108, 0.078, 0.216, tinta(col, 0.18), 0.012);
      if (det) { ctx.fillStyle = tinta(col, 0.35); ctx.fillRect(-0.06, -0.02, 0.04, 0.04); ctx.strokeStyle = tinta(col, -0.3); ctx.lineWidth = 0.004; ctx.strokeRect(-0.075, -0.104, 0.072, 0.208); }
    }
    // traversa rossa con i respingenti
    box(ctx, 0.174, -0.104, 0.02, 0.208, '#b3261e');
    respingenti(ctx, det, true, true);
  }

  function pantografo(ctx, x, det) {
    if (!det) { box(ctx, x - 0.006, -0.07, 0.012, 0.14, '#222'); return; }
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.005;
    ctx.beginPath();
    ctx.moveTo(x - 0.04, -0.045); ctx.lineTo(x, -0.06); ctx.lineTo(x + 0.04, -0.045);
    ctx.moveTo(x - 0.04, 0.045); ctx.lineTo(x, 0.06); ctx.lineTo(x + 0.04, 0.045);
    ctx.moveTo(x, -0.06); ctx.lineTo(x, 0.06);
    ctx.stroke();
    for (const [a, b] of [[-0.04, -0.045], [0.04, -0.045], [-0.04, 0.045], [0.04, 0.045]]) cerchio(ctx, x + a, b, 0.008, '#e3dccb');
    box(ctx, x - 0.007, -0.08, 0.014, 0.16, '#3a3a3a', 0.004); // strisciante
  }

  function elettrica(ctx, p, det) {
    const col = p.colore;
    box(ctx, -0.2, -0.11, 0.4, 0.22, col, 0.025);
    ctx.fillStyle = sfumaY(ctx, 0.17, '#74777a', 0.8); rr(ctx, -0.18, -0.085, 0.36, 0.17, 0.02); ctx.fill();
    if (det) { // resistenze e passerella sul tetto
      box(ctx, -0.045, -0.04, 0.09, 0.08, '#4b4e51', 0.006);
      ctx.strokeStyle = '#2f3133'; ctx.lineWidth = 0.004; ctx.beginPath();
      for (let x = -0.035; x <= 0.04; x += 0.015) { ctx.moveTo(x, -0.035); ctx.lineTo(x, 0.035); }
      ctx.stroke();
      ctx.strokeStyle = tinta(col, -0.35); ctx.lineWidth = 0.004; ctx.beginPath(); ctx.moveTo(0, -0.11); ctx.lineTo(0, -0.085); ctx.moveTo(0, 0.085); ctx.lineTo(0, 0.11); ctx.stroke(); // snodo
    }
    for (const s of [-1, 1]) { // vetri delle due cabine
      ctx.fillStyle = '#1b2731'; ctx.fillRect(s > 0 ? 0.181 : -0.193, -0.075, 0.012, 0.15);
      if (det) { ctx.fillStyle = 'rgba(200,225,240,0.5)'; ctx.fillRect(s > 0 ? 0.184 : -0.19, -0.065, 0.004, 0.05); }
    }
    pantografo(ctx, 0.11, det); pantografo(ctx, -0.11, det);
    respingenti(ctx, det, true, true);
  }

  // elettriche moderne col muso inclinato (E.444, E.402)
  function muso(ctx, p, det) {
    const col = p.colore, w = 0.11, n = 0.035, m = 0.07;
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(-0.2 + n, -w); ctx.lineTo(0.2 - n, -w); ctx.lineTo(0.2, -m); ctx.lineTo(0.2, m); ctx.lineTo(0.2 - n, w);
    ctx.lineTo(-0.2 + n, w); ctx.lineTo(-0.2, m); ctx.lineTo(-0.2, -m); ctx.closePath(); ctx.fill();
    if (p.modello === 'e402') { ctx.fillStyle = '#eeeeea'; ctx.fillRect(-0.165, -0.11, 0.33, 0.012); ctx.fillRect(-0.165, 0.098, 0.33, 0.012); }
    ctx.fillStyle = sfumaY(ctx, 0.16, '#7b7f83', 0.7); rr(ctx, -0.15, -0.08, 0.3, 0.16, 0.02); ctx.fill();
    for (const s of [-1, 1]) { // parabrezza inclinato
      ctx.fillStyle = '#18232c'; ctx.beginPath();
      ctx.moveTo(s * 0.152, -0.075); ctx.lineTo(s * 0.188, -0.06); ctx.lineTo(s * 0.188, 0.06); ctx.lineTo(s * 0.152, 0.075); ctx.closePath(); ctx.fill();
      if (det) { ctx.fillStyle = 'rgba(200,225,240,0.45)'; ctx.fillRect(s * 0.165 - 0.002, -0.05, 0.005, 0.04); }
    }
    if (det) { box(ctx, -0.04, -0.035, 0.08, 0.07, '#55595d', 0.006); for (const s of [-1, 1]) cerchio(ctx, s * 0.065, 0, 0.018, '#3c4044'); }
    if (p.modello === 'e444') { pantografo(ctx, 0.105, det); pantografo(ctx, -0.105, det); } else pantografo(ctx, -0.1, det);
    respingenti(ctx, det, true, true);
  }

  function diesel(ctx, p, det) {
    const col = p.colore;
    box(ctx, -0.2, -0.11, 0.4, 0.22, tinta(col, -0.15), 0.022);
    ctx.fillStyle = sfumaY(ctx, 0.18, col, 0.6); rr(ctx, -0.185, -0.092, 0.37, 0.184, 0.02); ctx.fill();
    for (const s of [-1, 1]) { ctx.fillStyle = '#1b2731'; ctx.fillRect(s > 0 ? 0.178 : -0.19, -0.07, 0.012, 0.14); }
    if (det) {
      for (const x of [-0.07, 0.05]) { // ventilatori
        cerchio(ctx, x, 0, 0.042, '#2a2a2a'); ctx.strokeStyle = '#5a5a5a'; ctx.lineWidth = 0.004; ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; ctx.moveTo(x, 0); ctx.lineTo(x + Math.cos(a) * 0.038, Math.sin(a) * 0.038); }
        ctx.stroke(); cerchio(ctx, x, 0, 0.01, '#777');
      }
      box(ctx, 0.11, -0.012, 0.03, 0.024, '#151515', 0.004); // scarico
      ctx.fillStyle = '#e7c34a'; ctx.fillRect(-0.185, -0.092, 0.37, 0.007); ctx.fillRect(-0.185, 0.085, 0.37, 0.007);
    }
    respingenti(ctx, det, true, true);
  }

  // motrice dell'alta velocità: muso a punta davanti, dietro attaccata alle carrozze
  function alta(ctx, p, det) {
    const c = ALTA;
    ctx.fillStyle = sfumaY(ctx, 0.22, c.corpo, 0.5); ctx.beginPath();
    ctx.moveTo(-0.2, -0.11); ctx.lineTo(0.06, -0.11);
    ctx.bezierCurveTo(0.16, -0.105, 0.2, -0.05, 0.205, 0); ctx.bezierCurveTo(0.2, 0.05, 0.16, 0.105, 0.06, 0.11);
    ctx.lineTo(-0.2, 0.11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = c.fascia; ctx.fillRect(-0.2, -0.11, 0.26, 0.016); ctx.fillRect(-0.2, 0.094, 0.26, 0.016);
    ctx.fillStyle = sfumaY(ctx, 0.15, c.tetto, 0.6); rr(ctx, -0.19, -0.075, 0.2, 0.15, 0.02); ctx.fill();
    ctx.fillStyle = '#1a242c'; ctx.beginPath(); // parabrezza
    ctx.moveTo(0.075, -0.075); ctx.bezierCurveTo(0.12, -0.07, 0.15, -0.04, 0.155, 0); ctx.bezierCurveTo(0.15, 0.04, 0.12, 0.07, 0.075, 0.075); ctx.closePath(); ctx.fill();
    if (det) { ctx.fillStyle = 'rgba(210,230,245,0.4)'; ctx.fillRect(0.095, -0.045, 0.006, 0.035); }
    pantografo(ctx, -0.09, det);
    if (det) soffietto(ctx);
  }

  // ---------------------------------------------------------------- vagoni
  function carrozza(ctx, c, det, alta) {
    box(ctx, -0.2, -0.11, 0.4, 0.22, c.corpo, 0.02);
    if (c.fascia) { ctx.fillStyle = c.fascia; ctx.fillRect(-0.195, -0.11, 0.39, 0.012); ctx.fillRect(-0.195, 0.098, 0.39, 0.012); }
    if (c.fascia2 && det) { ctx.fillStyle = c.fascia2; ctx.fillRect(-0.195, -0.098, 0.39, 0.005); ctx.fillRect(-0.195, 0.093, 0.39, 0.005); }
    if (det) { // i finestrini si intravedono sui fianchi
      ctx.fillStyle = c.vetri;
      const n = alta ? 9 : 7;
      for (let k = 0; k < n; k++) {
        const x = -0.17 + (k + 0.15) * 0.34 / n;
        ctx.fillRect(x, -0.104, 0.34 / n * 0.62, 0.007); ctx.fillRect(x, 0.097, 0.34 / n * 0.62, 0.007);
      }
    }
    ctx.fillStyle = sfumaY(ctx, 0.19, c.tetto, 1); rr(ctx, -0.192, -0.094, 0.384, 0.188, alta ? 0.04 : 0.025); ctx.fill();
    if (det) {
      if (c === CARROZZE[0]) { // lanterne a olio sul tetto
        for (const x of [-0.12, 0, 0.12]) { cerchio(ctx, x, 0, 0.014, '#2d2b28'); cerchio(ctx, x, 0, 0.007, '#8e8a7e'); }
      } else if (!alta) {
        for (let x = -0.15; x <= 0.151; x += 0.06) cerchio(ctx, x, 0, 0.008, tinta(c.tetto, -0.35));
      }
      if (alta) { ctx.fillStyle = tinta(c.tetto, -0.2); ctx.fillRect(-0.06, -0.03, 0.12, 0.06); }
      soffietto(ctx);
    }
  }

  function postale(ctx, ep, det) {
    const corpo = ep >= 3 ? '#e6e9e4' : ep >= 2 ? '#56655f' : '#5b3125';
    box(ctx, -0.2, -0.11, 0.4, 0.22, corpo, 0.02);
    ctx.fillStyle = sfumaY(ctx, 0.19, '#a9adae', 0.9); rr(ctx, -0.192, -0.094, 0.384, 0.188, 0.025); ctx.fill();
    if (det) {
      box(ctx, -0.04, -0.03, 0.08, 0.06, '#f4f4f4', 0.004); // busta
      ctx.strokeStyle = '#b3261e'; ctx.lineWidth = 0.006; ctx.beginPath(); ctx.moveTo(-0.04, -0.03); ctx.lineTo(0, 0.005); ctx.lineTo(0.04, -0.03); ctx.stroke();
      soffietto(ctx);
    }
  }

  // carro aperto pieno di carbone o di minerale (vuoto: si vede il pianale)
  function aperto(ctx, ep, det, merce, vuoto) {
    const legno = ep === 0;
    box(ctx, -0.2, -0.11, 0.4, 0.22, legno ? '#6b4a2e' : '#4a4038', 0.008);
    if (det) { ctx.strokeStyle = legno ? '#4e351f' : '#2f2924'; ctx.lineWidth = 0.005; ctx.beginPath();
      for (let x = -0.15; x <= 0.151; x += 0.075) { ctx.moveTo(x, -0.11); ctx.lineTo(x, -0.096); ctx.moveTo(x, 0.096); ctx.lineTo(x, 0.11); }
      ctx.stroke(); }
    if (vuoto) { box(ctx, -0.186, -0.096, 0.372, 0.192, legno ? '#4a3420' : '#2d2723'); return respingenti(ctx, det, true, true); }
    const c = merce === 'ferro' ? '#8f4a2d' : '#262626';
    ctx.fillStyle = sfumaY(ctx, 0.192, c, merce === 'ferro' ? 1 : 1.6); ctx.fillRect(-0.186, -0.096, 0.372, 0.192);
    if (det) for (let k = 0; k < 40; k++) {
      const x = -0.18 + hash(k, 11) * 0.36, y = -0.088 + hash(k, 13) * 0.176;
      cerchio(ctx, x, y, 0.006 + hash(k, 17) * 0.006, merce === 'ferro' ? (k % 2 ? '#a85d3a' : '#6e3520') : (k % 2 ? '#4a4a4a' : '#111'));
    }
    respingenti(ctx, det, true, true);
  }

  function pianaleLegname(ctx, ep, det, seme) {
    box(ctx, -0.2, -0.11, 0.4, 0.22, '#5a4632', 0.006);
    if (det) { ctx.strokeStyle = '#47372a'; ctx.lineWidth = 0.003; ctx.beginPath(); for (let y = -0.08; y <= 0.081; y += 0.032) { ctx.moveTo(-0.2, y); ctx.lineTo(0.2, y); } ctx.stroke(); }
    for (let k = 0; k < 4; k++) {
      const y = -0.078 + k * 0.052, d = (hash(seme, k) - 0.5) * 0.03;
      ctx.fillStyle = sfumaY(ctx, 0.05, '#7a5130', 1); ctx.save(); ctx.translate(0, y);
      ctx.fillRect(-0.18 + d, -0.024, 0.36, 0.048);
      ctx.fillStyle = '#c99a62'; ctx.fillRect(-0.186 + d, -0.022, 0.008, 0.044); ctx.fillRect(0.178 + d, -0.022, 0.008, 0.044);
      ctx.restore();
    }
    if (det) { // stanti e catene
      for (const x of [-0.13, 0, 0.13]) for (const s of [-1, 1]) box(ctx, x - 0.006, s * 0.11 - 0.006, 0.012, 0.012, '#1f1f1f');
      ctx.strokeStyle = 'rgba(30,30,30,0.85)'; ctx.lineWidth = 0.004; ctx.beginPath();
      for (const x of [-0.13, 0, 0.13]) { ctx.moveTo(x, -0.105); ctx.lineTo(x, 0.105); } ctx.stroke();
    }
    respingenti(ctx, det, true, true);
  }

  function pianaleAcciaio(ctx, ep, det) {
    box(ctx, -0.2, -0.11, 0.4, 0.22, '#474747', 0.006);
    if (ep < 2) { // putrelle e rotaie
      for (let k = 0; k < 5; k++) { const y = -0.08 + k * 0.04; ctx.fillStyle = sfumaY(ctx, 0.03, '#8fa3b8', 0.9); ctx.save(); ctx.translate(0, y); ctx.fillRect(-0.185, -0.014, 0.37, 0.028); ctx.restore(); }
    } else for (const x of [-0.12, 0, 0.12]) { // rotoli di lamiera
      const g = ctx.createRadialGradient(x - 0.015, -LY * 0.015, 0.005, x, 0, 0.058);
      g.addColorStop(0, '#e2e8ee'); g.addColorStop(1, '#6f7c88'); cerchio(ctx, x, 0, 0.058, g);
      if (det) { ctx.strokeStyle = 'rgba(60,70,80,0.5)'; ctx.lineWidth = 0.003; for (const r of [0.045, 0.034]) { ctx.beginPath(); ctx.arc(x, 0, r, 0, Math.PI * 2); ctx.stroke(); } }
      cerchio(ctx, x, 0, 0.022, '#2a2e33');
    }
    respingenti(ctx, det, true, true);
  }

  function cisterna(ctx, ep, det, merce) {
    box(ctx, -0.2, -0.105, 0.4, 0.21, '#262626', 0.006);
    const c = merce === 'petrolio' ? '#2c2c2e' : '#d9d9d4';
    ctx.fillStyle = sfumaY(ctx, 0.18, c, merce === 'petrolio' ? 2.2 : 1); rr(ctx, -0.19, -0.09, 0.38, 0.18, 0.045); ctx.fill();
    if (merce !== 'petrolio') { ctx.fillStyle = '#c0392b'; ctx.fillRect(-0.03, -0.09, 0.06, 0.18); }
    if (det) {
      ctx.fillStyle = 'rgba(200,200,200,0.35)'; ctx.fillRect(-0.012, -0.105, 0.024, 0.21); // passerella
      cerchio(ctx, 0, 0, 0.032, merce === 'petrolio' ? '#3a3a3c' : '#bcbcb6'); cerchio(ctx, 0, 0, 0.02, merce === 'petrolio' ? '#1c1c1c' : '#8d8d88');
    }
    respingenti(ctx, det, true, true);
  }

  function tramoggia(ctx, ep, det) { // grano
    box(ctx, -0.2, -0.11, 0.4, 0.22, '#9c8f6c', 0.012);
    ctx.fillStyle = sfumaY(ctx, 0.2, '#cdbf96', 0.8); rr(ctx, -0.19, -0.1, 0.38, 0.2, 0.03); ctx.fill();
    if (det) {
      ctx.strokeStyle = 'rgba(90,80,55,0.45)'; ctx.lineWidth = 0.004; ctx.beginPath();
      for (let x = -0.15; x <= 0.151; x += 0.05) { ctx.moveTo(x, -0.1); ctx.lineTo(x, 0.1); } ctx.stroke();
    }
    for (const x of [-0.11, 0, 0.11]) box(ctx, x - 0.03, -0.022, 0.06, 0.044, '#8f8466', 0.008);
    respingenti(ctx, det, true, true);
  }

  function chiuso(ctx, ep, det, corpo, tetto) { // carro coperto
    box(ctx, -0.2, -0.11, 0.4, 0.22, corpo, 0.012);
    ctx.fillStyle = sfumaY(ctx, 0.19, tetto, 0.9); rr(ctx, -0.19, -0.095, 0.38, 0.19, 0.02); ctx.fill();
    if (det) { ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 0.004; ctx.beginPath(); for (let x = -0.14; x <= 0.141; x += 0.07) { ctx.moveTo(x, -0.095); ctx.lineTo(x, 0.095); } ctx.stroke(); }
    if (det) { ctx.fillStyle = tinta(corpo, -0.3); ctx.fillRect(-0.03, -0.11, 0.06, 0.008); ctx.fillRect(-0.03, 0.102, 0.06, 0.008); } // porte
    respingenti(ctx, det, true, true);
  }

  function frigo(ctx, ep, det) { // cibo
    box(ctx, -0.2, -0.11, 0.4, 0.22, '#e7e5dd', 0.012);
    ctx.fillStyle = '#5f9f45'; ctx.fillRect(-0.195, -0.11, 0.39, 0.01); ctx.fillRect(-0.195, 0.1, 0.39, 0.01);
    ctx.fillStyle = sfumaY(ctx, 0.19, '#d2d0c8', 0.7); rr(ctx, -0.19, -0.094, 0.38, 0.188, 0.02); ctx.fill();
    if (det) for (const x of [-0.15, 0.15]) for (const y of [-0.055, 0.055]) box(ctx, x - 0.022, y - 0.022, 0.044, 0.044, '#a9a79e', 0.005);
    respingenti(ctx, det, true, true);
  }

  function container(ctx, det, seme) {
    box(ctx, -0.2, -0.1, 0.4, 0.2, '#383838', 0.004);
    for (const s of [-1, 1]) {
      const c = CONTAINER[Math.floor(hash(seme, s + 5) * CONTAINER.length)], x0 = s < 0 ? -0.192 : 0.004;
      ctx.fillStyle = sfumaY(ctx, 0.2, c, 0.35); ctx.fillRect(x0, -0.1, 0.188, 0.2);
      if (det) {
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.003; ctx.beginPath();
        for (let x = x0 + 0.02; x < x0 + 0.18; x += 0.02) { ctx.moveTo(x, -0.096); ctx.lineTo(x, 0.096); } ctx.stroke();
        ctx.fillStyle = tinta(c, -0.45); for (const a of [x0, x0 + 0.178]) for (const b of [-0.1, 0.09]) ctx.fillRect(a, b, 0.01, 0.01);
      }
    }
    respingenti(ctx, det, true, true);
  }

  function vagone(ctx, p, det) {
    const ep = p.epoca, m = p.merce;
    if (m === 'passeggeri') return carrozza(ctx, p.alta ? ALTA : CARROZZE[ep], det, p.alta);
    if (m === 'posta') return postale(ctx, ep, det);
    if (m === 'carbone' || m === 'ferro') return aperto(ctx, ep, det, m, p.vuoto);
    if (m === 'legname') return pianaleLegname(ctx, ep, det, p.seme || 1);
    if (m === 'acciaio') return pianaleAcciaio(ctx, ep, det);
    if (m === 'petrolio' || m === 'carburante') return cisterna(ctx, ep, det, m);
    if (m === 'grano') return ep === 0 ? chiuso(ctx, ep, det, '#6b4a2e', '#7d7259') : tramoggia(ctx, ep, det);
    if (m === 'cibo') return ep === 0 ? chiuso(ctx, ep, det, '#d8d2c0', '#9a978c') : frigo(ctx, ep, det);
    return ep >= 2 ? container(ctx, det, p.seme || 1) : chiuso(ctx, ep, det, '#6b3a24', '#5a564f');
  }

  // ---------------------------------------------------------------- punto d'ingresso
  // p = { genere: 'loco'|'vagone', modello, colore, merce, epoca, alta, vuoto, seme }
  // scalaPx = pixel per casella sullo schermo (per il livello di dettaglio)
  T.pezzo = function (ctx, x, y, ang, ts, p, scalaPx) {
    const px = scalaPx || ts;
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(ts, ts);
    // la luce viene da nord-ovest: quale fianco del pezzo è illuminato?
    LY = (0.7 * Math.sin(ang) - 0.7 * Math.cos(ang)) > 0 ? 1 : -1;
    if (px < 10) { // da lontano: rettangolo col colore del modello o della merce, largo almeno 2 px
      const w = Math.max(0.22, 2 / px);
      ctx.fillStyle = p.genere === 'loco' ? p.colore : p.coloreMerce; ctx.fillRect(-0.2, -w / 2, 0.4, w);
    } else {
      const det = px >= 22;
      if (p.genere === 'loco') {
        const t = tipoLoco(p.modello);
        if (t === 'vapore' || t === 'vaporeAntico') vapore(ctx, p, det, t === 'vaporeAntico');
        else if (t === 'elettrica') elettrica(ctx, p, det);
        else if (t === 'muso') muso(ctx, p, det);
        else if (t === 'diesel') diesel(ctx, p, det);
        else alta(ctx, p, det);
      } else vagone(ctx, p, det);
    }
    ctx.restore();
  };

  // ombra morbida del pezzo sul terreno (prima di tutti i pezzi)
  T.ombra = function (ctx, x, y, ang, ts) {
    ctx.save(); ctx.translate(x + ts * 0.035, y + ts * 0.05); ctx.rotate(ang); ctx.scale(ts, ts);
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; rr(ctx, -0.205, -0.115, 0.41, 0.23, 0.03); ctx.fill();
    ctx.restore();
  };

  // sbuffi di fumo delle locomotive a vapore in viaggio (dopo tutti i pezzi): t in secondi
  T.fumo = function (ctx, x, y, ang, ts, t) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let k = 0; k < 7; k++) {
      const f = (t * 0.9 + k / 7) % 1, d = 0.154 - f * 1.1, lat = f * f * 0.12;
      const px = x + (ca * d - sa * lat) * ts, py = y + (sa * d + ca * lat) * ts;
      ctx.fillStyle = 'rgba(225,225,222,' + (0.55 * (1 - f)).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(px, py, (0.035 + f * 0.11) * ts, 0, Math.PI * 2); ctx.fill();
    }
  };

  // ---------------------------------------------------------------- miniature per finestre e pannelli
  // Nell'HTML si mette T.htmlMiniatura(...): un <canvas class="miniTreno"> con i dati nel dataset; dopo ogni
  // innerHTML si chiama T.dipingiMiniature(radice). Le immagini si preparano una volta sola (cache).
  // mod = id della locomotiva ('' = solo vagoni), n = vagoni, ts = pixel per casella, anno = epoca dei vagoni
  T.htmlMiniatura = (mod, merce, n, ts, anno, titolo) =>
    `<canvas class="miniTreno" data-mod="${mod}" data-merce="${merce}" data-n="${n}" data-ts="${ts}" data-anno="${anno || ''}"${titolo ? ` title="${titolo}"` : ''}></canvas>`;
  const miniature = new Map();
  function miniatura(modId, merce, n, ts, anno) {
    const k = [modId, merce, n, ts, anno].join('|');
    let c = miniature.get(k);
    if (c) return c;
    const mod = modId ? G.modello(modId) : null, pezzi = (mod ? 1 : 0) + n, passo = 0.44 * ts;
    const w = Math.ceil(pezzi * passo + 0.12 * ts), h = Math.ceil(0.36 * ts), r = 2;
    c = document.createElement('canvas'); c.width = w * r; c.height = h * r; c.w = w; c.h = h;
    const ctx = c.getContext('2d'); ctx.scale(r, r);
    const v = { merce, id: 1, qta: 1 }, ep = T.epoca(mod ? mod.anno : (anno || 1900));
    const lista = [];
    if (mod) lista.push(T.dati(v, 0, mod));
    for (let j = 1; j <= n; j++) lista.push(mod ? T.dati(v, j, mod) : { genere: 'vagone', merce, coloreMerce: C.merci[merce].colore, epoca: ep, seme: 31 + j });
    // la locomotiva a sinistra, rivolta a sinistra (angolo π), i vagoni dietro verso destra
    const X = j => 0.26 * ts + j * passo, Y = h / 2 - 0.02 * ts;
    lista.forEach((p, j) => T.ombra(ctx, X(j), Y, Math.PI, ts));
    for (let j = lista.length - 1; j >= 0; j--) T.pezzo(ctx, X(j), Y, Math.PI, ts, lista[j]);
    miniature.set(k, c);
    return c;
  }
  T.dipingiMiniature = function (radice) {
    for (const el of radice.querySelectorAll('canvas.miniTreno')) {
      const d = el.dataset, m = miniatura(d.mod, d.merce, +d.n, +d.ts, +d.anno || 0);
      el.width = m.width; el.height = m.height; el.style.width = m.w + 'px'; el.style.height = m.h + 'px';
      el.getContext('2d').drawImage(m, 0, 0);
    }
  };

  // ---------------------------------------------------------------- 3D: volumi di ogni pezzo
  // [x0, x1, larghezza, z0, z1, colore dei fianchi, finestre?]; il tetto è il disegno 2D ritagliato
  T.volumi = function (p) {
    const fondo = [-0.19, 0.19, 0.17, 0, 0.04, '#1c1c1c'];
    if (p.genere === 'loco') {
      const t = tipoLoco(p.modello), c = p.colore;
      if (t === 'vapore' || t === 'vaporeAntico') return [fondo,
        [-0.2, -0.078, 0.204, 0.04, 0.14, tinta(c, -0.1)], [-0.078, 0.174, 0.2, 0.04, 0.065, '#35302b'],
        [-0.004, 0.174, 0.13, 0.065, 0.15, c], [0.13, 0.178, 0.05, 0.15, t === 'vaporeAntico' ? 0.25 : 0.2, '#151515'],
        t === 'vaporeAntico' ? [-0.075, -0.005, 0.2, 0.04, 0.07, '#4a3a2a'] : [-0.078, 0, 0.216, 0.04, 0.2, c, 'cabina'],
        [0.174, 0.194, 0.208, 0.025, 0.07, '#b3261e']];
      if (t === 'alta') return [fondo, [-0.2, 0.07, 0.22, 0.04, 0.16, ALTA.corpo, 'muso'], [0.07, 0.15, 0.17, 0.04, 0.12, ALTA.corpo], [0.15, 0.2, 0.09, 0.04, 0.08, ALTA.corpo]];
      return [fondo, [-0.2, 0.2, 0.22, 0.04, 0.17, t === 'diesel' ? tinta(c, -0.15) : c, 'cabine']];
    }
    const m = p.merce, ep = p.epoca;
    let h = 0.15, c = '#4a4038', fin = null;
    if (m === 'passeggeri') { const k = p.alta ? ALTA : CARROZZE[ep]; c = k.corpo; fin = k.vetri; h = 0.16; }
    else if (m === 'posta') c = ep >= 3 ? '#e6e9e4' : ep >= 2 ? '#56655f' : '#5b3125';
    else if (m === 'carbone' || m === 'ferro') { h = 0.1; c = ep === 0 ? '#6b4a2e' : '#4a4038'; }
    else if (m === 'legname' || m === 'acciaio') { h = 0.1; c = '#4a4038'; }
    else if (m === 'petrolio' || m === 'carburante') { h = 0.13; c = m === 'petrolio' ? '#2c2c2e' : '#d9d9d4'; }
    else if (m === 'grano') c = ep === 0 ? '#6b4a2e' : '#b9ac85';
    else if (m === 'cibo') c = ep === 0 ? '#d8d2c0' : '#e7e5dd';
    else if (ep >= 2) { h = 0.15; c = CONTAINER[Math.floor(hash(p.seme || 1, 4) * CONTAINER.length)]; }
    else c = '#6b3a24';
    return [fondo, [-0.2, 0.2, 0.22, 0.04, h, c, fin]];
  };
})();
