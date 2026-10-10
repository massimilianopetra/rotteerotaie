// Vista 3D assonometrica: il mondo visto di sbieco, con il terreno in rilievo e gli edifici e i mezzi come solidi.
// È solo un altro modo di disegnare lo stesso stato del gioco (si passa dall'una all'altra con il tasto D).
// - Il terreno si prepara una volta in un'immagine: ogni colonna di pixel si riempie dal davanti verso il fondo
//   (come nei vecchi simulatori di volo «a voxel»), con i colori del terreno della vista 2D. Poi l'immagine si
//   ridimensiona con lo zoom; si rifà solo quando si gira la vista (tasto O).
// - Strade e binari si disegnano alla loro quota (i viadotti con i piloni), poi case, alberi, industrie, stazioni
//   e mezzi dal fondo verso il davanti, così quelli davanti coprono quelli dietro.
// Coordinate: (x, y) casella del mondo, z altezza in caselle. Girata la vista, (u, v) sono le coordinate ruotate;
// sullo schermo sx = (u − v)·A, sy = (u + v)·B − z·ZS (A = 0,707·ts, B = A/2, ZS = 0,8·ts).
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO, T = G.T, OCC = G.OCC, D = G.disegno, F = D.f;
  const KX = Math.SQRT1_2, KY = KX / 2, KZ = 0.8;
  // il rilievo: metri → caselle, esagerato perché i monti si vedano (una casella è larga 1–6 km, un monte alto 4)
  const RILIEVI = [{ nome: 'Basso', k: 2 }, { nome: 'Alto', k: 4 }, { nome: 'Altissimo', k: 6.5 }];
  G.RILIEVI = RILIEVI;
  const NESSUNA = -32768;
  const CHIAVE = 'rotaie-e-rotte-vista';

  D.iso = false; D.rot = 0; D.rilievo = 1;
  try {
    const v = JSON.parse(localStorage.getItem(CHIAVE) || '{}');
    D.iso = !!v.iso; D.rot = (v.rot | 0) & 3; if (RILIEVI[v.rilievo]) D.rilievo = v.rilievo;
  } catch (e) { /* niente */ }
  function salva() { try { localStorage.setItem(CHIAVE, JSON.stringify({ iso: D.iso, rot: D.rot, rilievo: D.rilievo })); } catch (e) { /* niente */ } }

  // ---------------------------------------------------------------- rotazione e proiezione
  // u = a1·x + b1·y + c1, v = a2·x + b2·y + c2 (la vista girata di 90° alla volta)
  function coefficienti(rot, W, H) {
    return [[1, 0, 0, 0, 1, 0], [0, -1, H, 1, 0, 0], [-1, 0, W, 0, -1, H], [0, 1, 0, -1, 0, W]][rot];
  }
  // stato della proiezione del fotogramma (aggiornato da impostaVista)
  let A = 1, B = 0.5, ZS = 1, OX = 0, OY = 0, R = coefficienti(0, 1, 1), SX = 0, SY = 0;
  let VWX = 1, VWY = 1; // direzione verso chi guarda, nel piano del mondo
  const VZ = 2 * KY / KZ; // e la sua parte verticale (verso l'alto)
  // la luce viene da davanti e da sinistra rispetto a chi guarda (gira con la vista): i versanti verso chi
  // guarda sono illuminati, come nei giochi isometrici
  function luceVista(rot) {
    const p = daUV(0.45, 1, 0, 0, rot), o = daUV(0, 0, 0, 0, rot), l = [p.x - o.x, p.y - o.y, 1.6], n = Math.hypot(...l);
    return l.map(k => k / n);
  }
  let LUCE = luceVista(0);

  function proietta(x, y, z) {
    const u = R[0] * x + R[1] * y + R[2], v = R[3] * x + R[4] * y + R[5];
    SX = OX + (u - v) * A; SY = OY + (u + v) * B - z * ZS;
  }
  // dal piano ruotato al mondo
  function daUV(u, v, W, H, rot) {
    switch (rot) {
      case 1: return { x: v, y: H - u };
      case 2: return { x: W - u, y: H - v };
      case 3: return { x: W - v, y: u };
      default: return { x: u, y: v };
    }
  }

  function impostaVista(m, w, h, ts) {
    A = KX * ts; B = KY * ts; ZS = KZ * ts;
    R = coefficienti(D.rot, m.W, m.H);
    const cx = D.cam.x, cy = D.cam.y;
    const u = R[0] * cx + R[1] * cy + R[2], v = R[3] * cx + R[4] * cy + R[5];
    OX = w / 2 - (u - v) * A; OY = h / 2 - (u + v) * B;
    // la direzione (1, 1) del piano ruotato riportata nel mondo
    const d = daUV(1, 1, 0, 0, D.rot);
    const n = Math.hypot(d.x, d.y); VWX = d.x / n; VWY = d.y / n;
    LUCE = luceVista(D.rot);
    D.isoV = { OX, OY, A, B, ZS, w, h, W: m.W, H: m.H, rot: D.rot };
  }

  // dallo schermo al mondo sul piano all'altezza z (con la proiezione dell'ultimo fotogramma)
  function schermoPiano(sx, sy, z) {
    const P = D.isoV;
    if (!P) return { x: D.cam.x, y: D.cam.y };
    const d1 = (sx - P.OX) / P.A, d2 = (sy - P.OY + z * P.ZS) / P.B;
    return daUV((d1 + d2) / 2, (d2 - d1) / 2, P.W, P.H, P.rot);
  }
  G.schermoAMondoPiano = (sx, sy) => schermoPiano(sx, sy, 0);
  // dal mondo (x, y, sul terreno) allo schermo, con la proiezione dell'ultimo fotogramma
  G.mondoASchermoIso = function (x, y) {
    const I = D.iso3d, st = G.st;
    proietta(x, y, I && st ? zTerra(I, st.mondo, x, y) : 0);
    return { x: SX, y: SY };
  };

  // spostamento della camera: dipende solo dallo zoom attuale e dalla rotazione
  G.deltaMondoIso = function (dx, dy) {
    const a = KX * D.cam.ts, b = KY * D.cam.ts, d1 = dx / a, d2 = dy / b, du = (d1 + d2) / 2, dv = (d2 - d1) / 2;
    const p = daUV(du, dv, 0, 0, D.rot), o = daUV(0, 0, 0, 0, D.rot);
    return { x: p.x - o.x, y: p.y - o.y };
  };

  // il punto del terreno sotto il mouse: si scende lungo il raggio dal davanti finché non si tocca il terreno
  G.schermoAMondoIso = function (sx, sy) {
    const P = D.isoV, I = D.iso3d, st = G.st;
    if (!P || !I || !st) return schermoPiano(sx, sy, 0);
    const m = st.mondo, d1 = (sx - P.OX) / P.A, t0 = (sy - P.OY) / P.B, k = P.ZS / P.B;
    const dentro = (t) => { const p = daUV((t + d1) / 2, (t - d1) / 2, P.W, P.H, P.rot); return p; };
    const quota = (t) => { const p = dentro(t); return p.x < 0 || p.y < 0 || p.x >= m.W || p.y >= m.H ? -1 : zTerra(I, m, p.x, p.y) - (t - t0) / k; };
    const passo = 0.25;
    for (let t = t0 + I.zmax * k; t >= t0; t -= passo) {
      if (quota(t) >= 0) { // tra t e t + passo il raggio entra nel terreno: si cerca il punto con la bisezione
        let a = t, b = t + passo;
        for (let n = 0; n < 12; n++) { const c = (a + b) / 2; if (quota(c) >= 0) a = c; else b = c; }
        return dentro(a);
      }
    }
    return dentro(t0);
  };

  // ---------------------------------------------------------------- terreno in rilievo
  // altezza (in caselle) del terreno nel punto (fx, fy), interpolata fra i centri delle caselle
  function zTerra(I, m, fx, fy) {
    const u = Math.max(0, Math.min(m.W - 1.001, fx - 0.5)), v = Math.max(0, Math.min(m.H - 1.001, fy - 0.5));
    const x0 = u | 0, y0 = v | 0, ax = u - x0, ay = v - y0, W = m.W, i = y0 * W + x0, Z = I.Z;
    const a = Z[i], b = Z[i + 1], c = Z[i + W], d = Z[i + W + 1];
    return a + (b - a) * ax + (c - a) * ay + (a - b - c + d) * ax * ay;
  }

  function scurisci(c, f) {
    return 0xff000000 | (((c >>> 16) & 255) * f) << 16 | (((c >>> 8) & 255) * f) << 8 | ((c & 255) * f);
  }
  function illumina(c, f) {
    return 0xff000000 | Math.min(255, ((c >>> 16) & 255) * f) << 16 | Math.min(255, ((c >>> 8) & 255) * f) << 8 | Math.min(255, (c & 255) * f);
  }

  // una colonna X dell'immagine: dal davanti verso il fondo, ogni pixel del terreno si disegna solo se sporge
  // sopra quanto già disegnato; i pixel sotto (i fianchi ripidi) sono più scuri, il primo fa da bordo del plastico
  function colonna(I, m, X) {
    const { Q, Ut, Vt, LW, top, base, u32, src, SW, SP, ZPX, Z } = I;
    const c = X - Vt;
    let p = Math.min(Ut - 1, Vt - 1 + c), q = p - c;
    if (p < 0 || q < 0 || q > Vt - 1) return;
    let ybuf = ((p + q + 1) >> 1) + top + base, primo = true;
    const W = m.W, H = m.H, rot = D.rot, L = luceVista(rot), L0 = L[0], L1 = L[1], L2 = L[2];
    while (p >= 0 && q >= 0) {
      const u = (p + 0.5) / Q, v = (q + 0.5) / Q;
      let x, y;
      if (rot === 0) { x = u; y = v; } else if (rot === 1) { x = v; y = H - u; } else if (rot === 2) { x = W - u; y = H - v; } else { x = W - v; y = u; }
      // altezza interpolata (come zTerra, scritta qui per la velocità)
      const fu = Math.max(0, Math.min(W - 1.001, x - 0.5)), fv = Math.max(0, Math.min(H - 1.001, y - 0.5));
      const x0 = fu | 0, y0 = fv | 0, ax = fu - x0, ay = fv - y0, i = y0 * W + x0;
      const a = Z[i], b = Z[i + 1], cc = Z[i + W], d = Z[i + W + 1];
      const z = a + (b - a) * ax + (cc - a) * ay + (a - b - cc + d) * ax * ay;
      const yt = Math.round((p + q + 1) / 2 + top - z * ZPX);
      if (yt < ybuf) {
        let col = src[Math.min(SW.h - 1, (y * SP) | 0) * SW.w + Math.min(SW.w - 1, (x * SP) | 0)];
        // luce sul pendio vero (la pendenza del rilievo 3D): versanti al sole più chiari, in ombra più scuri
        const gx = (b - a) + (a - b - cc + d) * ay, gy = (cc - a) + (a - b - cc + d) * ax;
        if (gx || gy) {
          const l = (-L0 * gx - L1 * gy + L2) / Math.sqrt(gx * gx + gy * gy + 1) / L2;
          col = illumina(col, Math.max(0.55, Math.min(1.35, 1 + (l - 1) * 0.8)));
        }
        u32[yt * LW + X] = col;
        if (ybuf - yt > 1) {
          const sc = scurisci(col, primo ? 0.42 : Math.max(0.62, 0.97 - 0.05 * (ybuf - yt)));
          for (let yy = yt + 1; yy < ybuf; yy++) u32[yy * LW + X] = sc;
        }
        ybuf = yt;
      }
      primo = false;
      p--; q--;
    }
  }

  function costruisciTerreno(st) {
    const m = st.mondo, km = G.kmCasella(st), met = G.metriTerreno(m), Z = new Float32Array(m.N);
    const fz = RILIEVI[D.rilievo].k / 1000 / Math.pow(km, 0.4);
    let zmax = 0;
    for (let i = 0; i < m.N; i++) { Z[i] = met[i] * fz; if (Z[i] > zmax) zmax = Z[i]; }
    const odd = D.rot & 1, Wr = odd ? m.H : m.W, Hr = odd ? m.W : m.H;
    // pixel per casella dell'immagine: al massimo circa 12 milioni di pixel in tutto
    const Q = Math.max(2, Math.min(12, Math.floor(Math.sqrt(24e6) / (Wr + Hr))));
    const Ut = Wr * Q, Vt = Hr * Q, ZPX = KZ / KX * Q;
    const top = Math.ceil(zmax * ZPX) + 4, base = Math.ceil(Q * 0.6) + 2;
    const LW = Ut + Vt, LH = Math.ceil((Ut + Vt) / 2) + top + base + 2;
    const cv = document.createElement('canvas'); cv.width = LW; cv.height = LH;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(LW, LH);
    const T2 = D.terreno.img;
    const I = {
      rot: D.rot, rilievo: D.rilievo, m, Z, fz, zmax, Q, Wr, Hr, Ut, Vt, ZPX, top, base, LW, LH, cv, ctx, img,
      u32: new Uint32Array(img.data.buffer), src: new Uint32Array(T2.data.buffer), SW: { w: T2.width, h: T2.height }, SP: D.terreno.px,
      sporco: null, abitato: null
    };
    for (let X = 0; X < LW; X++) colonna(I, m, X);
    ctx.putImageData(img, 0, 0);
    D.abitatoIsoSporco = true;
    return I;
  }

  function pronto(st) {
    const I = D.iso3d;
    if (I && I.rot === D.rot && I.rilievo === D.rilievo && I.m === st.mondo) return I;
    return (D.iso3d = costruisciTerreno(st));
  }

  // una casella cambiata (un bosco tagliato): si rifanno le sole colonne dell'immagine che la toccano
  G.ridisegnaCasellaIso = function (m, i) {
    const I = D.iso3d;
    if (!I || I.m !== m) return;
    const x = i % m.W, y = (i / m.W) | 0, R0 = coefficienti(I.rot, m.W, m.H);
    const u = R0[0] * (x + 0.5) + R0[1] * (y + 0.5) + R0[2], v = R0[3] * (x + 0.5) + R0[4] * (y + 0.5) + R0[5];
    const tu = Math.floor(u), tv = Math.floor(v), Q = I.Q;
    const X0 = Math.max(0, tu * Q - (tv * Q + Q - 1) + I.Vt - 1), X1 = Math.min(I.LW - 1, tu * Q + Q - 1 - tv * Q + I.Vt + 1);
    for (let X = X0; X <= X1; X++) {
      for (let Y = 0; Y < I.LH; Y++) I.u32[Y * I.LW + X] = 0;
      colonna(I, m, X);
    }
    I.sporco = I.sporco ? [Math.min(I.sporco[0], X0), Math.max(I.sporco[1], X1)] : [X0, X1];
  };

  // posizione dell'immagine del terreno sullo schermo e disegno della sola parte visibile
  function disegnaImmagine(ctx, cv, I, w, h) {
    const s = A / I.Q, dx = OX - I.Hr * A - 0.5 * s, dy = OY - I.top * s - 0.5 * s;
    const x0 = Math.max(0, Math.floor(-dx / s)), y0 = Math.max(0, Math.floor(-dy / s));
    const x1 = Math.min(I.LW, Math.ceil((w - dx) / s) + 1), y1 = Math.min(I.LH, Math.ceil((h - dy) / s) + 1);
    if (x1 <= x0 || y1 <= y0) return;
    ctx.drawImage(cv, x0, y0, x1 - x0, y1 - y0, dx + x0 * s, dy + y0 * s, (x1 - x0) * s, (y1 - y0) * s);
  }

  // ---------------------------------------------------------------- colori e solidi
  const cacheTinte = new Map();
  function tinta(hex, f) {
    const k = hex + '|' + Math.round(f * 40);
    let t = cacheTinte.get(k);
    if (!t) {
      const c = F.coloreHex(hex), q = Math.round(f * 40) / 40;
      t = `rgb(${Math.min(255, Math.round(c[0] * q))},${Math.min(255, Math.round(c[1] * q))},${Math.min(255, Math.round(c[2] * q))})`;
      cacheTinte.set(k, t);
    }
    return t;
  }
  // luce sulla faccia con normale (nx, ny, nz) del mondo
  const luce = (nx, ny, nz) => 0.62 + 0.45 * Math.max(0, (nx * LUCE[0] + ny * LUCE[1] + nz * LUCE[2]) / Math.hypot(nx, ny, nz));
  const visibile = (nx, ny, nz) => nx * VWX + ny * VWY + nz * VZ > 1e-6;

  function faccia(ctx, pts, colore) {
    ctx.fillStyle = colore; ctx.beginPath();
    for (let k = 0; k < pts.length; k += 3) { proietta(pts[k], pts[k + 1], pts[k + 2]); if (k) ctx.lineTo(SX, SY); else ctx.moveTo(SX, SY); }
    ctx.closePath(); ctx.fill();
  }

  // parallelepipedo con centro (cx, cy), lati lx (lungo l'angolo ang) e ly, dalla quota z0 alla z0 + h;
  // tetto: null (piatto, colore cTop), 'due' (a due falde lungo lx, alto ht); finestre: file di finestre sui fianchi
  function scatola(ctx, cx, cy, z0, lx, ly, ang, h, cLati, cTop, tetto, ht, finestre) {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const ex = ca * lx / 2, ey = sa * lx / 2, fx = -sa * ly / 2, fy = ca * ly / 2;
    const P = [[cx - ex - fx, cy - ey - fy], [cx + ex - fx, cy + ey - fy], [cx + ex + fx, cy + ey + fy], [cx - ex + fx, cy - ey + fy]];
    const z1 = z0 + h;
    // le normali dei fianchi: −f, +e, +f, −e
    const N = [[sa, -ca], [ca, sa], [-sa, ca], [-ca, -sa]];
    for (let k = 0; k < 4; k++) {
      const n = N[k];
      if (!visibile(n[0], n[1], 0)) continue;
      const a = P[k], b = P[(k + 1) & 3];
      faccia(ctx, [a[0], a[1], z0, b[0], b[1], z0, b[0], b[1], z1, a[0], a[1], z1], tinta(cLati, luce(n[0], n[1], 0)));
      if (finestre) {
        // una griglia di finestre: un piano ogni 0,17 caselle, una finestra ogni 0,15
        const lun = Math.hypot(b[0] - a[0], b[1] - a[1]), nc = Math.max(1, Math.floor(lun / 0.15)), nr = Math.max(1, Math.floor((h - 0.1) / 0.17));
        const fw = 0.4 / nc, fh = 0.42 * (h - 0.1) / nr;
        ctx.fillStyle = finestre;
        for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
          const t0 = (c + 0.3) / nc, t1 = t0 + fw, zz = z0 + 0.12 + (r + 0.25) * (h - 0.1) / nr;
          const p0x = a[0] + (b[0] - a[0]) * t0, p0y = a[1] + (b[1] - a[1]) * t0, p1x = a[0] + (b[0] - a[0]) * t1, p1y = a[1] + (b[1] - a[1]) * t1;
          ctx.beginPath();
          proietta(p0x, p0y, zz); ctx.moveTo(SX, SY); proietta(p1x, p1y, zz); ctx.lineTo(SX, SY);
          proietta(p1x, p1y, zz + fh); ctx.lineTo(SX, SY); proietta(p0x, p0y, zz + fh); ctx.lineTo(SX, SY);
          ctx.fill();
        }
      }
    }
    if (tetto === 'due') {
      const r0 = [cx - ex, cy - ey], r1 = [cx + ex, cy + ey], zr = z1 + ht;
      // falde: verso −f e verso +f
      const nf = [[sa * ht, -ca * ht, ly / 2], [-sa * ht, ca * ht, ly / 2]];
      if (visibile(...nf[0])) faccia(ctx, [P[0][0], P[0][1], z1, P[1][0], P[1][1], z1, r1[0], r1[1], zr, r0[0], r0[1], zr], tinta(cTop, luce(...nf[0])));
      if (visibile(...nf[1])) faccia(ctx, [P[2][0], P[2][1], z1, P[3][0], P[3][1], z1, r0[0], r0[1], zr, r1[0], r1[1], zr], tinta(cTop, luce(...nf[1])));
      // timpani (stesso colore dei muri)
      if (visibile(ca, sa, 0)) faccia(ctx, [P[1][0], P[1][1], z1, P[2][0], P[2][1], z1, r1[0], r1[1], zr], tinta(cLati, luce(ca, sa, 0)));
      if (visibile(-ca, -sa, 0)) faccia(ctx, [P[3][0], P[3][1], z1, P[0][0], P[0][1], z1, r0[0], r0[1], zr], tinta(cLati, luce(-ca, -sa, 0)));
    } else if (cTop) {
      faccia(ctx, [P[0][0], P[0][1], z1, P[1][0], P[1][1], z1, P[2][0], P[2][1], z1, P[3][0], P[3][1], z1], tinta(cTop, luce(0, 0, 1)));
    }
  }

  // trasformazione del canvas che porta il piano orizzontale all'altezza z sullo schermo; le coordinate di disegno
  // sono caselle × S (così si riusano le funzioni della vista 2D, che lavorano in pixel con ts = S)
  const S = 64;
  function piano(ctx, z) {
    const [a1, b1, c1, a2, b2, c2] = R;
    ctx.transform(A * (a1 - a2) / S, B * (a1 + a2) / S, A * (b1 - b2) / S, B * (b1 + b2) / S,
      OX + A * (c1 - c2), OY - z * ZS + B * (c1 + c2));
  }

  // ---------------------------------------------------------------- reti
  function zRete(I, m, i, bin) {
    const q = (bin ? m.quotaBin : m.quotaStr)[i];
    return q === NESSUNA || m.strCitta[i] ? I.Z[i] : q * I.fz;
  }

  // tratti di rete come Path2D (di lato di "off" caselle: per le due rotaie), alla quota zf(i)
  function trattiRete(V, mask, filtro, zf, off) {
    const { m } = V, p = new Path2D();
    let n = 0;
    for (let y = Math.max(0, V.y0 - 1); y <= Math.min(m.H - 1, V.y1 + 1); y++) {
      for (let x = Math.max(0, V.x0 - 1); x <= Math.min(m.W - 1, V.x1 + 1); x++) {
        const i = y * m.W + x, mk = mask[i];
        if (!mk) continue;
        for (let d = 1; d <= 4; d++) if ((mk >> d) & 1) {
          const j = i + G.DY[d] * m.W + G.DX[d];
          if (filtro && !filtro(i, j)) continue;
          let ox = 0, oy = 0;
          if (off) { const l = Math.hypot(G.DX[d], G.DY[d]); ox = -G.DY[d] / l * off; oy = G.DX[d] / l * off; }
          proietta(x + 0.5 + ox, y + 0.5 + oy, zf(i)); p.moveTo(SX, SY);
          proietta(x + 0.5 + G.DX[d] + ox, y + 0.5 + G.DY[d] + oy, zf(j)); p.lineTo(SX, SY);
          n++;
        }
      }
    }
    return { p, n };
  }

  const galleria = op => (i, j) => op[i] === G.OPERA.GALLERIA && op[j] === G.OPERA.GALLERIA;
  const viadotto = op => (i, j) => op[i] === G.OPERA.VIADOTTO || op[j] === G.OPERA.VIADOTTO;

  // ponti sui fiumi, viadotti con i piloni
  function disegnaOpere(V) {
    const { m, ts, ctx, I } = V;
    const reti = [];
    if (V.vis.ferrovie) reti.push([m.mBin, m.operaBin, true]);
    if (V.vis.strade) reti.push([m.mStr, m.operaStr, false]);
    for (const [mask, op, bin] of reti) {
      const zf = i => zRete(I, m, i, bin);
      // piloni: dalla quota della rete fino al terreno
      if (ts >= 5) {
        ctx.strokeStyle = '#5a4f42'; ctx.lineWidth = Math.max(1.5, ts * 0.14); ctx.lineCap = 'butt';
        ctx.beginPath();
        for (let y = V.y0; y <= V.y1; y++) for (let x = V.x0; x <= V.x1; x++) {
          const i = y * m.W + x;
          if (!mask[i] || op[i] !== G.OPERA.VIADOTTO) continue;
          proietta(x + 0.5, y + 0.5, zf(i) - 0.04); ctx.moveTo(SX, SY);
          proietta(x + 0.5, y + 0.5, I.Z[i] - 0.1); ctx.lineTo(SX, SY);
        }
        ctx.stroke();
      }
      const r = trattiRete(V, mask, viadotto(op), zf);
      if (r.n) {
        ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
        ctx.strokeStyle = '#463e35'; ctx.lineWidth = Math.max(4, ts * 0.62); ctx.stroke(r.p);
        ctx.strokeStyle = '#b9ab94'; ctx.lineWidth = Math.max(2.5, ts * 0.48); ctx.stroke(r.p);
      }
      // ponti sui fiumi: un impalcato di legno e pietra
      const pf = trattiRete(V, mask, (i, j) => (m.tipo[i] === T.FIUME || m.tipo[j] === T.FIUME) && !viadotto(op)(i, j), zf);
      if (pf.n) { ctx.strokeStyle = '#7d6b55'; ctx.lineWidth = Math.max(3, ts * 0.6); ctx.lineCap = 'butt'; ctx.stroke(pf.p); }
    }
    ctx.lineCap = 'round';
  }

  function imbocchi(V, mask, op, bin) {
    const { m, ts, ctx, I } = V;
    if (ts < 6) return;
    for (let y = V.y0; y <= V.y1; y++) for (let x = V.x0; x <= V.x1; x++) {
      const i = y * m.W + x, mk = mask[i];
      if (!mk || op[i] !== G.OPERA.GALLERIA) continue;
      let fuori = false;
      for (let d = 0; d < 8 && !fuori; d++) if ((mk >> d) & 1) { const j = G.vicino(m, i, d); if (j >= 0 && op[j] !== G.OPERA.GALLERIA) fuori = true; }
      if (!fuori) continue;
      proietta(x + 0.5, y + 0.5, Math.max(I.Z[i], zRete(I, m, i, bin)));
      const r = ts * 0.32;
      ctx.fillStyle = '#7a7266'; ctx.beginPath(); ctx.ellipse(SX, SY - r * 0.4, r, r * 0.9, 0, Math.PI, 0); ctx.lineTo(SX + r, SY); ctx.lineTo(SX - r, SY); ctx.fill();
      ctx.fillStyle = '#16120e'; ctx.beginPath(); ctx.ellipse(SX, SY - r * 0.3, r * 0.62, r * 0.6, 0, Math.PI, 0); ctx.lineTo(SX + r * 0.62, SY); ctx.lineTo(SX - r * 0.62, SY); ctx.fill();
    }
  }

  function disegnaStrade(V) {
    const { m, ts, ctx, I } = V;
    const vie = !V.lontano && V.vis.vie, strade = V.vis.strade, gal = galleria(m.operaStr);
    const mostra = (i, j) => (m.strCitta[i] && m.strCitta[j] ? vie : strade);
    const zf = i => zRete(I, m, i, false), zt = i => I.Z[i];
    const rg = trattiRete(V, m.mStr, (i, j) => gal(i, j) && mostra(i, j), zt);
    if (rg.n) {
      ctx.strokeStyle = 'rgba(40,38,34,0.55)'; ctx.lineWidth = Math.max(1.2, ts * 0.12); ctx.lineCap = 'butt';
      ctx.setLineDash([Math.max(3, ts * 0.25), Math.max(3, ts * 0.2)]); ctx.stroke(rg.p); ctx.setLineDash([]);
    }
    const auto = (i, j) => m.tipoStr[i] === 2 && m.tipoStr[j] === 2;
    const r1 = trattiRete(V, m.mStr, (i, j) => !gal(i, j) && mostra(i, j) && !auto(i, j), zf);
    const r2 = trattiRete(V, m.mStr, (i, j) => !gal(i, j) && mostra(i, j) && auto(i, j), zf);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (r1.n) {
      ctx.strokeStyle = '#5f5b52'; ctx.lineWidth = Math.max(1.6, ts * 0.3); ctx.stroke(r1.p);
      if (ts >= 6) { ctx.strokeStyle = '#aaa595'; ctx.lineWidth = ts * 0.2; ctx.stroke(r1.p); }
    }
    if (r2.n) {
      ctx.strokeStyle = '#2b2e33'; ctx.lineWidth = Math.max(2.2, ts * 0.46); ctx.stroke(r2.p);
      if (ts >= 6) {
        ctx.strokeStyle = '#4b5058'; ctx.lineWidth = ts * 0.36; ctx.stroke(r2.p);
        ctx.strokeStyle = '#f0d264'; ctx.lineWidth = Math.max(1, ts * 0.035);
        ctx.setLineDash([ts * 0.18, ts * 0.18]); ctx.lineCap = 'butt'; ctx.stroke(r2.p); ctx.setLineDash([]); ctx.lineCap = 'round';
      }
    }
    if (strade) imbocchi(V, m.mStr, m.operaStr, false);
  }

  function disegnaBinari(V) {
    const { m, ts, ctx, I } = V;
    const gal = galleria(m.operaBin), zf = i => zRete(I, m, i, true);
    const rg = trattiRete(V, m.mBin, gal, i => I.Z[i]);
    if (rg.n) {
      ctx.lineCap = 'butt'; ctx.strokeStyle = 'rgba(45,32,22,0.6)'; ctx.lineWidth = Math.max(1.4, ts * 0.13);
      ctx.setLineDash([Math.max(3, ts * 0.22), Math.max(3, ts * 0.18)]); ctx.stroke(rg.p); ctx.setLineDash([]);
    }
    imbocchi(V, m.mBin, m.operaBin, true);
    const fuori = (i, j) => !gal(i, j), r = trattiRete(V, m.mBin, fuori, zf);
    if (!r.n) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (ts < 10) {
      if (V.vis.attenua) { ctx.strokeStyle = '#f3e3bf'; ctx.lineWidth = Math.max(3.5, ts * 0.42); ctx.stroke(r.p); }
      ctx.strokeStyle = '#3a281a'; ctx.lineWidth = Math.max(1.5, ts * 0.24); ctx.stroke(r.p);
      return;
    }
    // massicciata, traversine e le due rotaie (spostate di lato nel mondo: si vedono in prospettiva)
    ctx.strokeStyle = '#8a7a66'; ctx.lineWidth = ts * 0.34; ctx.stroke(r.p);
    ctx.lineCap = 'butt'; ctx.strokeStyle = '#5a412a'; ctx.lineWidth = ts * 0.26;
    ctx.setLineDash([ts * 0.05, ts * 0.08]); ctx.stroke(r.p); ctx.setLineDash([]);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#d4d7db'; ctx.lineWidth = Math.max(1, ts * 0.035);
    ctx.stroke(trattiRete(V, m.mBin, fuori, zf, 0.075).p);
    ctx.stroke(trattiRete(V, m.mBin, fuori, zf, -0.075).p);
  }

  // ---------------------------------------------------------------- stazioni (le parti piatte)
  function quotaStazione(V, s) {
    const { m, I } = V;
    let z = 0, n = 0;
    for (const i of G.caselleStazione(V.st, s)) { z += m.mBin[i] ? zRete(I, m, i, true) : I.Z[i]; n++; }
    return n ? z / n : 0;
  }
  const VS = (V) => ({ m: V.m, st: V.st, ts: S, ox: 0, oy: 0, ctx: V.ctx });

  function disegnaBasiStazioni(st, V) {
    const { m, ctx, ts } = V;
    for (const s of st.stazioni) {
      if (!s || !vicino(V, s.x, s.y, s.lato)) continue;
      const zs = quotaStazione(V, s), c = G.centroStazione(s);
      if (s.tipo === 'stazione') {
        // il piazzale è un basamento un po' rialzato (copre il terreno in pendenza), sopra le banchine
        scatola(ctx, c.x, c.y, zs - 0.25, s.lato * 0.98, s.lato * 0.98, 0, 0.28, '#7f7a6e', '#9d978a');
        if (ts >= 6) {
          ctx.save(); piano(ctx, zs + 0.03);
          for (const i of G.caselleStazione(st, s)) if (m.mBin[i]) F.strisceBanchina(VS(V), i, 0.2, 0.33, '#d9d2c1');
          ctx.restore();
        }
      } else {
        const lato = s.lato;
        if (s.tipo !== 'porto') scatola(ctx, c.x, c.y, zs - 0.25, lato * 0.96, lato * 0.96, 0, 0.27, '#77736a', '#a7ab9f');
        ctx.save(); piano(ctx, zs + 0.02);
        const x = s.x * S, y = s.y * S;
        if (s.tipo === 'deposito') { /* solo il basamento: l'edificio è un solido */ }
        else if (s.tipo === 'porto') F.disegnaPorto(st, VS(V), s, x, y);
        else F.disegnaAeroporto(ctx, x, y, S);
        ctx.restore();
      }
    }
  }

  // ---------------------------------------------------------------- oggetti (dal fondo verso il davanti)
  const profondita = (x, y) => (R[0] + R[3]) * x + (R[1] + R[4]) * y;
  function vicino(V, x, y, lato) {
    return x + lato >= V.x0 - 1 && x <= V.x1 + 1 && y + lato >= V.y0 - 1 && y <= V.y1 + 1;
  }
  function inSchermo(V, x, y, z, marg) {
    proietta(x, y, z);
    return SX > -marg && SX < V.w + marg && SY > -marg && SY < V.h + marg * 2;
  }

  // Immagini pronte: case e gruppi di alberi sono migliaia ma di pochi tipi. Ogni tipo si disegna una volta
  // (con lo zoom e la rotazione attuali) in un piccolo canvas, poi si copia: molto più veloce che ridisegnarli.
  // Il punto d'appoggio (0, 0, 0) del solido va nel punto (w/2, ay) dell'immagine.
  const pronte = { chiave: '', mappa: new Map() };
  function pronta(ctx, chiave, larg, alto, disegna, x, y, z) {
    const ts = D.cam.ts, k0 = ts + '|' + D.rot;
    if (pronte.chiave !== k0) { pronte.chiave = k0; pronte.mappa.clear(); }
    let p = pronte.mappa.get(chiave);
    if (!p) {
      const dpr = window.devicePixelRatio || 1, w = Math.ceil(larg * A * 2) + 4, ay = Math.ceil(larg * B) + 2, h = ay + Math.ceil(alto * ZS) + 2;
      const cv = document.createElement('canvas'); cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr);
      const c = cv.getContext('2d'); c.scale(dpr, dpr);
      const oX = OX, oY = OY;
      OX = w / 2 - (R[2] - R[5]) * A; OY = h - ay - (R[2] + R[5]) * B;
      disegna(c);
      OX = oX; OY = oY;
      p = { cv, w, h, ay };
      pronte.mappa.set(chiave, p);
    }
    proietta(x, y, z);
    ctx.drawImage(p.cv, SX - p.w / 2, SY - (p.h - p.ay), p.w, p.h);
  }

  const MURI = ['#efe4cc', '#e6d6b8', '#f2ead8'];
  // palazzi (livello 3) color ocra, terracotta e crema; grattacieli (livello 4) di vetro e cemento
  const PALAZZI = ['#d9a86c', '#c98e6b', '#e6cfa6'], TORRI = ['#8fa3b8', '#a7b1bb', '#7d93a8'];
  const ALT_CASA = [0, 0.16, 0.24, 0.5, 0.95];
  function casa(V, x, y, i) {
    const { m, ts, ctx, I } = V;
    const l = m.liv[i], s = F.DIM[l], h1 = G.hash(x, y), h2 = G.hash(y + 91, x);
    const gioco = (0.92 - s) * 0.5;
    const cx = x + 0.5 + (h1 - 0.5) * gioco, cy = y + 0.5 + (h2 - 0.5) * gioco, z = I.Z[i] - 0.12;
    const ci = Math.floor(h1 * 3), col = F.COL_CASE[l][ci], hq = Math.floor(h2 * 2.999), alt = ALT_CASA[l] * (0.85 + hq * 0.15) + 0.12;
    const mi = (h2 * 3) | 0, lungo = h2 < 0.5, tetto = l <= 2 && ts >= 8;
    const fin = ts >= 14 ? (l === 4 ? 'rgba(30,45,60,0.55)' : 'rgba(50,40,30,0.5)') : null;
    pronta(ctx, 'c' + l + ci + mi + hq + (lungo ? 1 : 0) + (tetto ? 1 : 0) + (fin ? 1 : 0), s, alt + s * 0.4, c => {
      if (l <= 2) {
        const lx = lungo ? s : s * 0.8, ly = lungo ? s * 0.8 : s;
        if (!tetto) scatola(c, 0, 0, 0, lx, ly, 0, alt, MURI[mi], col);
        else scatola(c, 0, 0, 0, lx, ly, lungo ? 0 : Math.PI / 2, alt, MURI[mi], col, 'due', s * 0.32);
      } else if (l === 3) scatola(c, 0, 0, 0, s, s, 0, alt, PALAZZI[ci], '#a8553e', null, 0, fin);
      else scatola(c, 0, 0, 0, s, s, 0, alt, TORRI[ci], '#5f6b78', null, 0, fin);
    }, cx, cy, z);
  }

  // albero: chioma tonda su un tronco
  function albero(c, x, y, r) {
    const rr = r * 2.2 * A, h = rr * 1.4;
    proietta(x, y, 0);
    c.fillStyle = '#4a3422'; c.fillRect(SX - rr * 0.14, SY - rr * 0.9, rr * 0.28, rr * 0.9);
    c.fillStyle = '#25521f'; c.beginPath(); c.ellipse(SX, SY - h, rr, rr * 1.1, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3c7a2f'; c.beginPath(); c.ellipse(SX - rr * 0.3, SY - h - rr * 0.3, rr * 0.55, rr * 0.55, 0, 0, Math.PI * 2); c.fill();
  }
  // un gruppo di tre alberi su una casella (otto disposizioni diverse)
  function boschetto(V, x, y, i) {
    const n = Math.floor(G.hash(x + 5, y * 7) * 8);
    pronta(V.ctx, 'b' + n, 1.2, 1.4, c => {
      const el = [];
      for (let k = 0; k < 3; k++) el.push([(1.6 + G.hash(n * 3 + k, 3) * 4.8) / 8 - 0.5, (1.6 + G.hash(n, k * 5 + 17) * 4.8) / 8 - 0.5, (1.5 + G.hash(n + k, 29) * 0.9) / 8]);
      el.sort((a, b) => profondita(a[0], a[1]) - profondita(b[0], b[1]));
      for (const [ax, ay, r] of el) albero(c, ax, ay, r);
    }, x + 0.5, y + 0.5, V.I.Z[i]);
  }

  function industria(V, ind) {
    const { ts, ctx, I, m } = V;
    const def = C.industrie[ind.tipo], cx = ind.x + 1, cy = ind.y + 1;
    let z = 1e9;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) z = Math.min(z, I.Z[(ind.y + a) * m.W + ind.x + b]);
    z -= 0.15;
    scatola(ctx, cx, cy, z, 1.75, 1.75, 0, 0.12, '#6e675c', '#8e8778'); // cortile
    scatola(ctx, cx - 0.2, cy - 0.15, z + 0.12, 1.1, 1.0, 0, 0.45, def.colore, def.colore, ts >= 8 ? 'due' : null, 0.25);
    scatola(ctx, cx + 0.55, cy + 0.45, z + 0.12, 0.5, 0.5, 0, 0.3, def.colore, '#77706a');
    if (ts >= 5) scatola(ctx, cx + 0.55, cy - 0.55, z + 0.12, 0.16, 0.16, 0, 0.9, '#8a5a44', '#3a2a22'); // ciminiera
    if (ts >= 6) {
      proietta(cx, cy, z + 1.2);
      F.emoji(ctx, def.icona, SX, SY, ts * 0.9);
    }
  }

  // il fabbricato di una stazione: rettangolo (in caselle) e taglia come nella vista 2D
  function fabbricato3d(V, r, z) {
    const { ctx, ts } = V;
    const b = Math.min(r.w, r.h) * 0.1, x = r.x + b, y = r.y + b, w = r.w - 2 * b, h = r.h - 2 * b;
    const cx = x + w / 2, cy = y + h / 2, lungo = w >= h, ang = lungo ? 0 : Math.PI / 2, lx = lungo ? w : h, ly = lungo ? h : w;
    const tetto = ts >= 6 ? 'due' : null;
    if (r.taglia === 'fermata') { scatola(ctx, cx, cy, z, lx, ly, ang, 0.22, '#c9a77c', '#8c5a3c', tetto, ly * 0.4); return; }
    scatola(ctx, cx, cy, z, lx, ly, ang, 0.35, '#ead9b0', '#b04a32', tetto, Math.min(0.3, ly * 0.35));
    if (r.taglia === 'grande' || r.taglia === 'centrale') {
      const cw = Math.min(w, h) * 0.5;
      scatola(ctx, cx, cy, z, cw, cw, 0, r.taglia === 'centrale' ? 0.95 : 0.7, '#e2cfa0', '#c95b3f', tetto, cw * 0.35);
      if (ts >= 12) { proietta(cx + cw / 2 * VWX, cy + cw / 2 * VWY, z + 0.45); ctx.fillStyle = '#f7f1e0'; ctx.beginPath(); ctx.arc(SX, SY, ts * 0.08, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 1; ctx.stroke(); }
    }
    if (r.taglia === 'centrale' && ts >= 8) {
      const t = Math.min(w, h) * 0.2;
      for (const [tx, ty] of [[x, y], [x + w - t, y], [x, y + h - t], [x + w - t, y + h - t]]) scatola(ctx, tx + t / 2, ty + t / 2, z, t, t, 0, 0.6, '#7f8c96', '#5b6770');
    }
  }

  function stazione(V, s) {
    const { ctx, ts, st } = V;
    const zs = quotaStazione(V, s), c = G.centroStazione(s);
    if (s.tipo === 'stazione') {
      // pensiline (sollevate) e fabbricati raccolti dalla funzione della vista 2D
      D.raccogli = [];
      ctx.save(); piano(ctx, zs + 0.32);
      F.disegnaStazioneFerroviaria(st, VS(V), s);
      ctx.restore();
      const el = D.raccogli; D.raccogli = null;
      el.sort((a, b) => profondita(a.x + a.w / 2, a.y + a.h / 2) - profondita(b.x + b.w / 2, b.y + b.h / 2));
      for (const r of el) fabbricato3d(V, { x: r.x / S, y: r.y / S, w: r.w / S, h: r.h / S, taglia: r.taglia }, zs + 0.03);
    } else if (s.tipo === 'deposito') {
      scatola(ctx, c.x, c.y, zs + 0.02, 0.6, 0.6, 0, 0.22, '#dfe6ee', '#2f6db5');
    } else if (s.tipo === 'porto') {
      scatola(ctx, s.x + 0.41, s.y + 0.37, zs + 0.02, 0.5, 0.38, 0, 0.24, '#c9b48a', '#8c3b2a', ts >= 8 ? 'due' : null, 0.14);
    } else { // aeroporto: aerostazione e torre di controllo
      scatola(ctx, s.x + 0.65, s.y + 0.48, zs + 0.02, 0.9, 0.55, 0, 0.3, '#e8e8e8', '#b8bcc2');
      scatola(ctx, s.x + 1.51, s.y + 0.5, zs + 0.02, 0.14, 0.14, 0, 0.95, '#d8d8d8', '#c0392b');
      scatola(ctx, s.x + 1.51, s.y + 0.5, zs + 0.97, 0.26, 0.26, 0, 0.14, '#5d7f99', '#c0392b');
    }
    // merce in attesa: quadratini colorati accanto alla stazione
    if (ts >= 16) {
      proietta(s.x + s.lato, s.y, zs + 0.5);
      let riga = 0;
      const q = ts * 0.14;
      for (const k in s.attesa) {
        if (s.attesa[k] < 1) continue;
        const n = Math.min(8, Math.ceil(s.attesa[k] / 25));
        ctx.fillStyle = C.merci[k].colore;
        for (let j = 0; j < n; j++) ctx.fillRect(SX + 2 + j * (q + 1), SY + riga * (q + 1), q, q);
        riga++;
      }
    }
  }

  // ---------------------------------------------------------------- veicoli
  function zSuPercorso(V, v, q, bin) {
    const { m, I } = V;
    if (v.caselle && q.k !== undefined) {
      const a = v.caselle[q.k], b = v.caselle[Math.min(q.k + 1, v.caselle.length - 1)];
      const za = zRete(I, m, a, bin), zb = zRete(I, m, b, bin);
      return za + (zb - za) * (q.f || 0);
    }
    return zTerra(I, m, q.x, q.y);
  }
  function inGalleria(V, x, y) {
    const m = V.m, i = Math.floor(y) * m.W + Math.floor(x);
    return i >= 0 && i < m.N && m.operaBin[i] === G.OPERA.GALLERIA;
  }

  // un pezzo del treno (k = 0 la locomotiva): i volumi di treni.js come solidi, con i finestrini sui fianchi
  // e sul tetto il disegno della vista 2D ritagliato. Da lontano basta una scatola del colore di sempre.
  const VETRO = '#1b2731';
  function pezzoTreno(V, q, z, v, k, mod) {
    const { ctx, ts } = V, TR = G.treni;
    if (ts < 10) {
      const col = k === 0 ? mod.colore : C.merci[v.merce].colore;
      scatola(ctx, q.x, q.y, z + 0.03, 0.4, 0.2, q.ang, k === 0 ? 0.2 : 0.16, col, col);
      return;
    }
    const p = TR.dati(v, k, mod), ca = Math.cos(q.ang), sa = Math.sin(q.ang), verso = ca * VWX + sa * VWY;
    // prima le parti basse (telaio, passerella), poi le altre dal fondo verso chi guarda, per ultime quelle
    // appoggiate sopra (il camino sulla caldaia)
    const piano3 = b => b[3] >= 0.14 ? 2 : b[4] <= 0.07 ? 0 : 1;
    const vol = TR.volumi(p).sort((a, b) => piano3(a) - piano3(b) || (a[0] + a[1] - b[0] - b[1]) * verso);
    for (const b of vol) solidoTreno(V, q, z, ca, sa, b, p);
    if (k === 0 && v.stato === 'viaggio' && !v.bloccatoDa && TR.aVapore(mod)) {
      const t = TR.tempo() + v.id * 0.37;
      for (let j = 0; j < 6; j++) {
        const f = (t * 0.9 + j / 6) % 1, d = 0.154 - f * 0.9;
        proietta(q.x + ca * d, q.y + sa * d, z + 0.22 + f * 0.3);
        ctx.fillStyle = `rgba(230,230,228,${(0.5 * (1 - f)).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(SX, SY, (0.025 + f * 0.07) * ts, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  function solidoTreno(V, q, z, ca, sa, b, p) {
    const { ctx, ts } = V, [x0, x1, w, zb0, zb1, col, fin] = b;
    const z0 = z + zb0, z1 = z + zb1, fx = -sa * w / 2, fy = ca * w / 2;
    const ax = q.x + ca * x0, ay = q.y + sa * x0, bx = q.x + ca * x1, by = q.y + sa * x1;
    const P = [[ax - fx, ay - fy], [bx - fx, by - fy], [bx + fx, by + fy], [ax + fx, ay + fy]];
    // le normali dei fianchi: −f, +e (davanti), +f, −e (dietro)
    const N = [[sa, -ca], [ca, sa], [-sa, ca], [-ca, -sa]];
    for (let k = 0; k < 4; k++) {
      const n = N[k];
      if (!visibile(n[0], n[1], 0)) continue;
      const a = P[k], c = P[(k + 1) & 3];
      faccia(ctx, [a[0], a[1], z0, c[0], c[1], z0, c[0], c[1], z1, a[0], a[1], z1], tinta(col, luce(n[0], n[1], 0)));
      if (!fin) continue;
      const fz0 = z0 + (z1 - z0) * 0.45, fz1 = z0 + (z1 - z0) * 0.85;
      const vetro = (t0, t1, za, zc, colore) => {
        const p0x = a[0] + (c[0] - a[0]) * t0, p0y = a[1] + (c[1] - a[1]) * t0, p1x = a[0] + (c[0] - a[0]) * t1, p1y = a[1] + (c[1] - a[1]) * t1;
        faccia(ctx, [p0x, p0y, za, p1x, p1y, za, p1x, p1y, zc, p0x, p0y, zc], colore);
      };
      if (k === 0 || k === 2) { // fianchi lunghi: k = 0 va da dietro a davanti, k = 2 al contrario
        const tratti = fin === 'cabina' ? [[0.25, 0.75]] : fin === 'cabine' ? [[0.04, 0.13], [0.87, 0.96]] : fin === 'muso' ? [[0.8, 0.95]] : null;
        if (tratti) for (const [t0, t1] of tratti) vetro(k ? 1 - t1 : t0, k ? 1 - t0 : t1, fz0, fz1, VETRO);
        else if (ts >= 14) for (let j = 0; j < 7; j++) vetro((j + 0.2) / 7, (j + 0.75) / 7, fz0, fz1, fin);
      } else if (fin === 'cabine' || (fin === 'muso' && k === 1)) vetro(0.18, 0.82, z0 + 0.07, z1 - 0.02, VETRO); // parabrezza
    }
    // il tetto: il disegno 2D del pezzo, ritagliato sulla faccia di sopra
    ctx.save();
    ctx.beginPath();
    for (let k = 0; k < 4; k++) { proietta(P[k][0], P[k][1], z1); if (k) ctx.lineTo(SX, SY); else ctx.moveTo(SX, SY); }
    ctx.closePath(); ctx.clip();
    piano(ctx, z1);
    G.treni.pezzo(ctx, q.x * S, q.y * S, Math.atan2(sa, ca), S, p, ts);
    ctx.restore();
  }

  function anello(V, x, y, z, r) {
    const { ctx } = V;
    ctx.save(); piano(ctx, z);
    ctx.strokeStyle = '#ffeb3b'; ctx.lineWidth = S * 0.08;
    ctx.beginPath(); ctx.arc(x * S, y * S, r * S, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function veicolo(V, v, ui, parti) {
    const { ctx, ts, m, I } = V;
    const mod = G.modello(v.modello), sel = ui.selVeicolo === v.id;
    if (v.tipo === 'treno') {
      for (const p of parti) if (!inGalleria(V, p.q.x, p.q.y)) pezzoTreno(V, p.q, p.z, v, p.k, mod);
      return;
    }
    if (v.tipo === 'strada') {
      const q = v.punti ? G.puntoSu(v, v.pos, v.seg) : { x: v.x, y: v.y, ang: v.ang };
      if (m.operaStr[Math.floor(q.y) * m.W + Math.floor(q.x)] === G.OPERA.GALLERIA) return;
      const z = zSuPercorso(V, v, q, false), off = 0.1, x = q.x - Math.sin(q.ang) * off, y = q.y + Math.cos(q.ang) * off;
      scatola(ctx, x, y, z + 0.02, 0.32, 0.17, q.ang, v.classe === 'bus' ? 0.16 : 0.14, v.classe === 'bus' ? mod.colore : C.merci[v.merce].colore, v.classe === 'bus' ? '#e8e8e8' : C.merci[v.merce].colore);
      if (sel) anello(V, v.x, v.y, z + 0.1, 0.5);
      return;
    }
    if (v.tipo === 'nave') {
      const z = zTerra(I, m, v.x, v.y);
      ctx.save(); piano(ctx, z + 0.02);
      F.sagomaNave(ctx, v.x * S, v.y * S, v.ang, S * 0.85, mod.colore, C.merci[v.merce].colore, v.stato === 'viaggio');
      ctx.restore();
      scatola(ctx, v.x - Math.cos(v.ang) * 0.22, v.y - Math.sin(v.ang) * 0.22, z + 0.02, 0.14, 0.14, v.ang, 0.18, '#f0f0f0', '#d0d0d0');
      if (sel) anello(V, v.x, v.y, z + 0.05, 0.6);
      return;
    }
    // aereo: l'ombra a terra e l'aereo in quota (più alto a metà del volo)
    const prog = v.stato === 'viaggio' && v.lunTot > 0 ? Math.min(1, Math.min(v.pos, v.lunTot - v.pos) / 2) : 0;
    const zt = zTerra(I, m, v.x, v.y), z = zt + 0.15 + prog * 2.5, dim = Math.max(12 / ts, 0.9) * S;
    ctx.save(); piano(ctx, zt + 0.02); F.sagomaAereo(ctx, v.x * S, v.y * S, v.ang, dim, 'rgba(0,0,0,0.3)'); ctx.restore();
    ctx.save(); piano(ctx, z); F.sagomaAereo(ctx, v.x * S, v.y * S, v.ang, dim, mod.colore); ctx.restore();
    if (sel) anello(V, v.x, v.y, z, 0.6);
  }

  function raccogliOggetti(st, V, ui) {
    const { m, ts, I } = V, el = [];
    const pon = (k, f) => el.push({ k, f });
    // case e alberi (da vicino: da lontano le case sono nell'immagine dell'abitato)
    const alberi = !V.lontano && ts >= 14;
    if ((V.vis.case && !V.lontano) || alberi) {
      for (let y = V.y0; y <= V.y1; y++) for (let x = V.x0; x <= V.x1; x++) {
        const i = y * m.W + x;
        if (m.occ[i] === OCC.CASA) {
          if (V.vis.case && !V.lontano && inSchermo(V, x + 0.5, y + 0.5, I.Z[i], ts * 2)) pon(profondita(x + 0.5, y + 0.5), () => casa(V, x, y, i));
        } else if (alberi && m.bosco[i] && !m.occ[i] && !m.mBin[i] && !m.mStr[i] && inSchermo(V, x + 0.5, y + 0.5, I.Z[i], ts)) {
          pon(profondita(x + 0.5, y + 0.5), () => boschetto(V, x, y, i));
        }
      }
    }
    if (V.vis.industrie) for (const ind of st.industrie) {
      if (ind.chiusa || !vicino(V, ind.x, ind.y, 2)) continue;
      pon(profondita(ind.x + 1, ind.y + 1), () => industria(V, ind));
    }
    if (V.vis.stazioni) for (const s of st.stazioni) {
      if (!s || !vicino(V, s.x, s.y, s.lato)) continue;
      const c = G.centroStazione(s);
      pon(profondita(c.x, c.y), () => stazione(V, s));
    }
    const aerei = [];
    if (V.vis.mezzi) for (const v of st.veicoli) {
      if (v.x < V.x0 - 3 || v.x > V.x1 + 4 || v.y < V.y0 - 3 || v.y > V.y1 + 4) continue;
      if (v.tipo === 'aereo') { aerei.push(v); continue; }
      if (v.tipo === 'treno') {
        // ogni vagone è un oggetto a sé: un treno lungo passa davanti e dietro alle case
        const parti = [];
        for (let k = v.vagoni; k >= 0; k--) {
          const q = v.punti ? G.puntoSu(v, v.pos - k * 0.44, v.seg) : { x: v.x, y: v.y, ang: v.ang };
          parti.push({ k, q, z: zSuPercorso(V, v, q, true) });
        }
        for (const p of parti) pon(profondita(p.q.x, p.q.y), () => veicolo(V, v, ui, [p]));
        if (ui.selVeicolo === v.id) { const p = parti[parti.length - 1]; pon(profondita(p.q.x, p.q.y) + 0.01, () => anello(V, v.x, v.y, p.z + 0.1, 0.5)); }
        continue;
      }
      pon(profondita(v.x, v.y), () => veicolo(V, v, ui));
    }
    el.sort((a, b) => a.k - b.k);
    return { el, aerei };
  }

  // ---------------------------------------------------------------- abitato da lontano
  // case e vie dei paesi in un'immagine grande come quella del terreno, rifatta solo quando le città cambiano
  function preparaAbitatoIso(st, I) {
    const m = st.mondo;
    if (!I.abitato) { I.abitato = document.createElement('canvas'); I.abitato.width = I.LW; I.abitato.height = I.LH; }
    const c = I.abitato.getContext('2d'), Q = I.Q, R0 = coefficienti(I.rot, m.W, m.H);
    c.clearRect(0, 0, I.LW, I.LH);
    const XY = (x, y, z) => {
      const u = R0[0] * x + R0[1] * y + R0[2], v = R0[3] * x + R0[4] * y + R0[5];
      return [(u - v) * Q + I.Vt + 0.5, (u + v) * Q / 2 + I.top + 0.5 - z * I.ZPX];
    };
    if (G.ui.livelli.vie) {
      c.strokeStyle = '#7d786c'; c.lineWidth = Math.max(1, Q * 0.3); c.beginPath();
      for (let i = 0; i < m.N; i++) {
        if (!m.strCitta[i] || !m.mStr[i]) continue;
        const x = i % m.W, y = (i / m.W) | 0, mk = m.mStr[i];
        for (let d = 1; d <= 4; d++) if ((mk >> d) & 1) {
          const j = i + G.DY[d] * m.W + G.DX[d];
          if (!m.strCitta[j]) continue;
          const a = XY(x + 0.5, y + 0.5, I.Z[i]), b = XY(x + 0.5 + G.DX[d], y + 0.5 + G.DY[d], I.Z[j]);
          c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
        }
      }
      c.stroke();
    }
    if (G.ui.livelli.case) {
      const el = [];
      for (let i = 0; i < m.N; i++) if (m.occ[i] === OCC.CASA) {
        const x = i % m.W + 0.5, y = ((i / m.W) | 0) + 0.5;
        el.push([R0[0] * x + R0[1] * y + R0[3] * x + R0[4] * y, i]);
      }
      el.sort((a, b) => a[0] - b[0]);
      for (const [, i] of el) {
        const x = i % m.W, y = (i / m.W) | 0, l = m.liv[i], [X, Y] = XY(x + 0.5, y + 0.5, I.Z[i]);
        const w = Math.max(1.5, Q * F.DIM[l] * 1.25), hp = Math.max(1, ALT_CASA[l] * I.ZPX + Q * 0.1);
        const ci = Math.floor(G.hash(x, y) * 3);
        const muro = l <= 2 ? '#d9cdb4' : tinta(l === 3 ? PALAZZI[ci] : TORRI[ci], 0.8), tetto = l <= 2 ? F.COL_CASE[l][ci] : l === 3 ? '#a8553e' : '#5f6b78';
        c.fillStyle = muro; c.fillRect(X - w / 2, Y - hp, w, hp);
        c.fillStyle = tetto; c.fillRect(X - w / 2, Y - hp - w / 4, w, w / 2);
      }
    }
    D.abitatoIsoSporco = false;
  }

  // ---------------------------------------------------------------- sovrapposizioni
  function poligonoCaselle(V, x, y, w, h, riempi, bordo) {
    const { ctx, m, I } = V;
    const pts = [];
    const z = (a, b) => zTerra(I, m, Math.max(0.5, Math.min(m.W - 0.5, a)), Math.max(0.5, Math.min(m.H - 0.5, b))) + 0.03;
    const passo = Math.max(1, Math.ceil(Math.max(w, h) / 40));
    for (let k = 0; k < w; k += passo) pts.push([x + k, y]);
    for (let k = 0; k < h; k += passo) pts.push([x + w, y + k]);
    for (let k = w; k > 0; k -= passo) pts.push([x + k, y + h]);
    for (let k = h; k > 0; k -= passo) pts.push([x, y + k]);
    ctx.beginPath();
    pts.forEach(([a, b], k) => { proietta(a, b, z(a, b)); if (k) ctx.lineTo(SX, SY); else ctx.moveTo(SX, SY); });
    ctx.closePath();
    if (riempi) { ctx.fillStyle = riempi; ctx.fill(); }
    if (bordo) { ctx.strokeStyle = bordo; ctx.lineWidth = 1.5; ctx.stroke(); }
  }

  function lineaCaselle(V, caselle, zf) {
    const { ctx, m } = V;
    ctx.beginPath();
    caselle.forEach((i, k) => { proietta(i % m.W + 0.5, ((i / m.W) | 0) + 0.5, zf(i, k)); if (k) ctx.lineTo(SX, SY); else ctx.moveTo(SX, SY); });
  }

  function disegnaSovrapposizioni(st, V, ui) {
    const { m, ts, ctx, I } = V;
    let b = ui.bacino;
    if (!b && ui.pannello && ui.pannello.tipo === 'stazione') {
      const s = st.stazioni[ui.pannello.id];
      if (s) b = { x: s.x, y: s.y, lato: s.lato, raggio: G.defStazione(s).raggio, ok: true, esistente: true };
    }
    if (b) {
      const r = b.raggio;
      poligonoCaselle(V, b.x - r, b.y - r, b.lato + 2 * r, b.lato + 2 * r, 'rgba(90,170,255,0.16)', 'rgba(140,200,255,0.8)');
      if (!b.esistente) poligonoCaselle(V, b.x, b.y, b.lato, b.lato, b.ok ? 'rgba(80,220,120,0.45)' : 'rgba(240,70,60,0.5)', '#fff');
    }
    const v = ui.selVeicolo && st.veicoli.find(k => k.id === ui.selVeicolo);
    const bin = v && v.tipo === 'treno', zv = i => (v && v.tipo === 'nave' ? I.Z[i] : zRete(I, m, i, bin)) + 0.05;
    if (v && v.fermate.length) {
      ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.lineJoin = 'round';
      for (const t of F.trattiPercorso(st, v)) {
        ctx.strokeStyle = t.caselle || v.tipo === 'aereo' ? 'rgba(255,235,59,0.85)' : 'rgba(255,90,70,0.85)';
        if (t.caselle) lineaCaselle(V, t.caselle, zv);
        else {
          ctx.beginPath(); proietta(t.a.x, t.a.y, zTerra(I, m, t.a.x, t.a.y)); ctx.moveTo(SX, SY);
          proietta(t.b.x, t.b.y, zTerra(I, m, t.b.x, t.b.y)); ctx.lineTo(SX, SY);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      if (v.stato === 'viaggio' && v.caselle && v.caselle.length > 1) {
        ctx.strokeStyle = 'rgba(255,235,59,0.55)'; ctx.lineWidth = Math.max(3, ts * 0.2); ctx.lineCap = 'round';
        lineaCaselle(V, v.caselle.slice(Math.min(v.seg + 1, v.caselle.length - 1)), zv);
        ctx.stroke();
      }
      const numeri = new Map();
      v.fermate.forEach((f, k) => { if (st.stazioni[f.s]) numeri.set(f.s, (numeri.get(f.s) || []).concat(k + 1)); });
      ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const [sid, el] of numeri) {
        const s = st.stazioni[sid], c = G.centroStazione(s), testo = el.join('·'), w = Math.max(18, ctx.measureText(testo).width + 10);
        proietta(c.x, c.y, quotaStazione(V, s) + 0.9);
        ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.roundRect(SX - w / 2, SY - 9, w, 18, 9); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillText(testo, SX, SY);
      }
    }
    if (G.modoDebug && v && v.tipo === 'treno' && v.pr && ts >= 6) {
      for (const e of v.pr) if (e.d > v.odo + 0.3) poligonoCaselle(V, e.i % m.W, (e.i / m.W) | 0, 1, 1, 'rgba(255,170,40,0.28)', null);
    }
    const a = ui.anteprima;
    if (a && a.caselle) {
      ctx.strokeStyle = a.ok ? 'rgba(90,255,140,0.85)' : 'rgba(255,80,70,0.85)';
      ctx.lineWidth = Math.max(3, ts * 0.26); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // alla quota del profilo calcolato (gallerie sotto, viadotti sopra), se c'è
      const pr = a.tr && a.tr.profilo && a.tr.profilo.quote;
      lineaCaselle(V, a.caselle, (i, k) => (pr && pr.length === a.caselle.length ? pr[k] * I.fz : I.Z[i]) + 0.04);
      if (a.caselle.length === 1) ctx.lineTo(SX + 0.1, SY);
      ctx.stroke();
    }
    if (a && a.blocchi) for (const i of a.blocchi) poligonoCaselle(V, i % m.W, (i / m.W) | 0, 1, 1, 'rgba(240,70,60,0.35)', 'rgba(255,90,70,0.95)');
    if (ui.cursore >= 0 && ui.strumento !== 'info' && !ui.bacino) {
      poligonoCaselle(V, ui.cursore % m.W, (ui.cursore / m.W) | 0, 1, 1, null, 'rgba(255,255,255,0.85)');
    }
  }

  // ---------------------------------------------------------------- scritte, segnali, effetti
  function disegnaEtichette(st, V) {
    const { ts, ctx, m, I } = V;
    const dim = Math.max(11, Math.min(20, ts * 0.8));
    if (!st._cittaOrd || st._cittaOrd.n !== st.citta.length || st._cittaOrd.giorno !== st.giornoInt) {
      st._cittaOrd = { n: st.citta.length, giorno: st.giornoInt, elenco: [...st.citta].sort((a, b) => b.pop - a.pop) };
    }
    const messe = [];
    const settori = new Map(), LATO = 120;
    const liberoS = r => {
      for (let sy = Math.floor(r[1] / LATO); sy <= Math.floor(r[3] / LATO); sy++) for (let sx = Math.floor(r[0] / LATO); sx <= Math.floor(r[2] / LATO); sx++) {
        for (const q of settori.get(sx * 10007 + sy) || []) if (r[0] < q[2] && r[2] > q[0] && r[1] < q[3] && r[3] > q[1]) return false;
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
      if (!vicino(V, c.x - 4, c.y - 2, 8)) continue;
      proietta(c.x + 0.5, c.y + 0.5, I.Z[c.y * m.W + c.x]);
      const x = SX, y = SY - Math.max(ts * 1.5, 18);
      if (x < -200 || x > V.w + 200 || y < -50 || y > V.h + 50) continue;
      const mezza = Math.max(c.nome.length * dim * 0.3, 2.2 * dim) + 3;
      const r = [x - mezza, y - dim * 0.6, x + mezza, y + dim * 1.4];
      if (!liberoS(r)) continue;
      occupa(r);
      messe.push([c, x, y]);
    }
    for (const [c, x, y] of messe) {
      F.etichetta(ctx, c.nome, x, y, dim, '#fff');
      F.etichetta(ctx, G.numero(c.pop) + ' ab.', x, y + dim * 0.95, dim * 0.68, '#ffe9a8');
    }
    if (ts >= 20 && V.vis.stazioni) for (const s of st.stazioni) {
      if (!s || !vicino(V, s.x, s.y, s.lato)) continue;
      proietta(s.x + s.lato / 2, s.y + s.lato / 2, quotaStazione(V, s));
      F.etichetta(ctx, s.nome, SX, SY + s.lato * B + 10, 10, '#cfe6ff');
    }
    if (ts >= 22 && V.vis.industrie) for (const ind of st.industrie) {
      if (ind.chiusa || !vicino(V, ind.x, ind.y, 2)) continue;
      proietta(ind.x + 1, ind.y + 1, I.Z[ind.y * m.W + ind.x]);
      F.etichetta(ctx, C.industrie[ind.tipo].nome, SX, SY + 2 * B + 8, 10, '#e8e0ff');
    }
  }

  function disegnaSegnali(st, V) {
    const { m, ts, ctx, I } = V;
    if (ts < 8) return;
    for (const v of st.veicoli) {
      if (v.tipo !== 'treno' || v.stato !== 'viaggio' || !v.bloccatoDa || !v.caselle) continue;
      const i = v.caselle[Math.min(v.limite + 1, v.caselle.length - 1)], j = v.caselle[v.limite];
      const x = (i % m.W + j % m.W) / 2 + 0.5 - Math.sin(v.ang) * 0.32, y = (((i / m.W) | 0) + ((j / m.W) | 0)) / 2 + 0.5 + Math.cos(v.ang) * 0.32;
      const z = (zRete(I, m, i, true) + zRete(I, m, j, true)) / 2;
      proietta(x, y, z); const bx = SX, by = SY;
      proietta(x, y, z + 0.55);
      ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth = Math.max(1.5, ts * 0.05); ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(SX, SY); ctx.stroke();
      const r = Math.max(3, ts * 0.11);
      ctx.fillStyle = '#1b1b1b'; ctx.fillRect(SX - r * 1.3, SY - r * 1.3, r * 2.6, r * 2.6);
      ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(SX, SY, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function disegnaEffetti(st, V) {
    const { ts, ctx, m, I } = V;
    if (ts < 8) return;
    for (const e of st.effetti) {
      ctx.globalAlpha = Math.max(0, 1 - e.t / 2.5);
      proietta(e.x, e.y, zTerra(I, m, Math.max(0, Math.min(m.W, e.x)), Math.max(0, Math.min(m.H, e.y))));
      F.etichetta(ctx, e.testo, SX, SY - ts * 0.9 - e.t * 22, 13, '#ffe066');
    }
    ctx.globalAlpha = 1;
  }

  function disegnaGriglia(V) {
    const { m, ctx, I } = V;
    const z = (x, y) => zTerra(I, m, Math.max(0.5, Math.min(m.W - 0.5, x)), Math.max(0.5, Math.min(m.H - 0.5, y)));
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = V.x0; x <= V.x1 + 1; x++) for (let y = V.y0; y <= V.y1 + 1; y++) {
      proietta(x, y, z(x, y));
      if (y === V.y0) ctx.moveTo(SX, SY); else ctx.lineTo(SX, SY);
    }
    for (let y = V.y0; y <= V.y1 + 1; y++) for (let x = V.x0; x <= V.x1 + 1; x++) {
      proietta(x, y, z(x, y));
      if (x === V.x0) ctx.moveTo(SX, SY); else ctx.lineTo(SX, SY);
    }
    ctx.stroke();
  }

  // ---------------------------------------------------------------- fotogramma
  G.disegnaIso = function (st, ctx, w, h, ui) {
    const m = st.mondo, ts = D.cam.ts, I = pronto(st);
    impostaVista(m, w, h, ts);
    if (I.sporco) {
      I.ctx.putImageData(I.img, 0, 0, I.sporco[0], 0, I.sporco[1] - I.sporco[0] + 1, I.LH);
      I.sporco = null;
    }
    ctx.fillStyle = '#121c26'; ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    disegnaImmagine(ctx, I.cv, I, w, h);
    // le caselle che possono comparire sullo schermo: i quattro angoli riportati al livello del mare e alla
    // quota più alta (una montagna più avanti può salire fino al bordo in alto)
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [a, b] of [[0, 0], [w, 0], [0, h], [w, h]]) for (const z of [0, I.zmax + 1.6]) {
      const p = schermoPiano(a, b, z);
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
    }
    x0 = Math.max(0, Math.floor(x0) - 1); y0 = Math.max(0, Math.floor(y0) - 1);
    x1 = Math.min(m.W - 1, Math.ceil(x1) + 1); y1 = Math.min(m.H - 1, Math.ceil(y1) + 1);
    const vis = ui.livelliVisibili ? ui.livelliVisibili() : { case: true, vie: true, strade: true, ferrovie: true, stazioni: true, industrie: true, mezzi: true, nomi: true };
    const V = { m, st, ts, ctx, w, h, x0, y0, x1, y1, lontano: G.lontano(m, ts), vis, I };
    if (vis.attenua) { ctx.fillStyle = 'rgba(16, 24, 32, 0.55)'; ctx.fillRect(0, 0, w, h); }
    if (vis.griglia && ts >= 8) disegnaGriglia(V);
    disegnaOpere(V);
    disegnaStrade(V);
    if (vis.stazioni) disegnaBasiStazioni(st, V);
    if (vis.ferrovie) disegnaBinari(V);
    if (V.lontano && (vis.case || vis.vie)) {
      if (!I.abitato || D.abitatoIsoSporco) preparaAbitatoIso(st, I);
      disegnaImmagine(ctx, I.abitato, I, w, h);
    }
    const { el, aerei } = raccogliOggetti(st, V, ui);
    for (const o of el) o.f();
    if (vis.ferrovie) disegnaSegnali(st, V);
    for (const v of aerei) veicolo(V, v, ui);
    disegnaSovrapposizioni(st, V, ui);
    disegnaEtichette(st, V);
    disegnaEffetti(st, V);
  };

  // ---------------------------------------------------------------- comandi
  G.vista3d = function (si) {
    const prima = { x: D.cam.x, y: D.cam.y };
    D.iso = si === undefined ? !D.iso : !!si;
    D.cam.x = prima.x; D.cam.y = prima.y;
    salva();
    return D.iso;
  };
  G.impostaRilievo = function (n) {
    if (!RILIEVI[n]) return;
    D.rilievo = n; D.iso3d = null;
    salva();
  };
  // dir = +1 in senso orario, −1 antiorario: la camera resta sullo stesso punto del mondo
  G.ruotaVista = function (dir) {
    D.rot = (D.rot + (dir < 0 ? 3 : 1)) & 3;
    D.iso3d = null;
    salva();
    return D.rot;
  };
})();
