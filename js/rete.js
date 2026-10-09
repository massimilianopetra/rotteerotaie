// Reti di trasporto: binari, strade e autostrade su una griglia a 8 direzioni.
// Ogni casella tiene una maschera di bit: il bit d dice che la casella è collegata alla vicina in direzione d.
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO;
  const T = G.T, OCC = G.OCC;

  // direzioni: 0 N, 1 NE, 2 E, 3 SE, 4 S, 5 SO, 6 O, 7 NO
  const DX = G.DX = [0, 1, 1, 1, 0, -1, -1, -1];
  const DY = G.DY = [-1, -1, 0, 1, 1, 1, 0, -1];
  const LUN = G.LUN = [1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2];

  G.vicino = function (m, i, d) {
    const x = i % m.W + DX[d], y = ((i / m.W) | 0) + DY[d];
    return (x < 0 || y < 0 || x >= m.W || y >= m.H) ? -1 : y * m.W + x;
  };
  G.direzione = function (m, a, b) {
    const dx = b % m.W - a % m.W, dy = ((b / m.W) | 0) - ((a / m.W) | 0);
    for (let d = 0; d < 8; d++) if (DX[d] === dx && DY[d] === dy) return d;
    return -1;
  };

  G.collega = function (st, a, b, rete, comunale) {
    const m = st.mondo, d = G.direzione(m, a, b);
    if (d < 0) return;
    const o = (d + 4) & 7;
    if (rete === 'binario') { m.mBin[a] |= 1 << d; m.mBin[b] |= 1 << o; return; }
    if (comunale) {
      if (!m.mStr[a]) m.strCitta[a] = 1;
      if (!m.mStr[b]) m.strCitta[b] = 1;
    }
    m.mStr[a] |= 1 << d; m.mStr[b] |= 1 << o;
    const t = rete === 'autostrada' ? 2 : 1;
    if (m.tipoStr[a] < t) m.tipoStr[a] = t;
    if (m.tipoStr[b] < t) m.tipoStr[b] = t;
  };

  // ogni modifica alla rete invalida i percorsi calcolati
  G.reteCambiata = function (st) {
    st.versioneRete++;
    st.minimappaSporca = true;
    if (G.verificaPercorsi) G.verificaPercorsi(st);
  };

  // coda con priorità (heap binario)
  function Coda() { this.k = []; this.p = []; }
  G.Coda = Coda;
  Coda.prototype.vuota = function () { return this.k.length === 0; };
  Coda.prototype.metti = function (k, p) {
    const K = this.k, P = this.p;
    let i = K.length;
    K.push(k); P.push(p);
    while (i > 0) {
      const g = (i - 1) >> 1;
      if (P[g] <= p) break;
      K[i] = K[g]; P[i] = P[g]; i = g;
    }
    K[i] = k; P[i] = p;
  };
  Coda.prototype.togli = function () {
    const K = this.k, P = this.p, top = K[0];
    const k = K.pop(), p = P.pop();
    const n = K.length;
    if (n) {
      let i = 0;
      for (;;) {
        let f = 2 * i + 1;
        if (f >= n) break;
        if (f + 1 < n && P[f + 1] < P[f]) f++;
        if (P[f] >= p) break;
        K[i] = K[f]; P[i] = P[f]; i = f;
      }
      K[i] = k; P[i] = p;
    }
    return top;
  };

  // array delle ricerche A* grandi quanto la mappa: si riusano (sulle mappe reali ogni ricerca ne creerebbe
  // di nuovi per qualche MB). Una casella vale solo se porta il "giro" della ricerca in corso.
  let bufA = null;
  function bufferRicerca(N) {
    if (!bufA || bufA.N !== N) bufA = { N, g: new Float64Array(N), da: new Int32Array(N), visto: new Uint32Array(N), chiuso: new Uint32Array(N), giro: 0 };
    if (++bufA.giro > 4e9) { bufA.visto.fill(0); bufA.chiuso.fill(0); bufA.giro = 1; }
    return bufA;
  }

  // ---------------------------------------------------------------- costruzione
  // costo in lire per far passare la rete nella casella (0 se c'è già, Infinity se impossibile)
  G.costoCasella = function (st, i, rete) {
    const m = st.mondo, t = m.tipo[i];
    if (t === T.ACQUA) return Infinity;
    const o = m.occ[i];
    if (o === OCC.CASA || o === OCC.INDUSTRIA) return Infinity;
    if (o === OCC.STAZIONE) {
      const s = st.stazioni[m.rif[i]];
      if (rete === 'binario') return s.tipo === 'stazione' ? 0 : Infinity;
      return s.tipo === 'deposito' ? 0 : Infinity;
    }
    if (rete === 'binario' && m.mBin[i]) return 0;
    if (rete === 'strada' && m.mStr[i]) return 0;
    if (rete === 'autostrada' && m.tipoStr[i] === 2) return 0;
    const km = G.kmCasella(st); // sulle mappe reali una casella è lunga più di un chilometro
    let c = C.reti[rete].costo * km * C.moltTerreno[G.NOMI_TERRENO[t]];
    if (rete === 'autostrada' && m.mStr[i]) c *= 0.6; // allargare una strada costa meno
    if (m.bosco[i]) c += C.costoBosco * km;
    return c;
  };

  // perché la rete non può passare da una casella (null se può passare)
  G.motivoCasella = function (st, i, rete) {
    const m = st.mondo;
    if (i < 0) return 'fuori dalla mappa';
    if (m.tipo[i] === T.ACQUA) return 'c\'è acqua (mare o lago): non si costruisce';
    const o = m.occ[i];
    if (o === OCC.CASA) {
      const c = st.citta[m.cittaDi[i]];
      return `c'è una casa${c ? ' di ' + c.nome : ''}: prima va demolita (💥 Demolisci, ${G.lire(C.costoCasa * m.liv[i])})`;
    }
    if (o === OCC.INDUSTRIA) {
      const k = st.industrie[m.rif[i]];
      return `c'è ${k ? k.nome : 'un\'industria'}: le industrie non si attraversano`;
    }
    if (o === OCC.STAZIONE) {
      const s = st.stazioni[m.rif[i]];
      if (rete === 'binario' && s.tipo !== 'stazione') return `c'è ${s.nome} (${G.nomeTipoStazione(s).toLowerCase()}): i binari passano solo nelle stazioni ferroviarie`;
      if (rete !== 'binario' && s.tipo !== 'deposito') return `c'è ${s.nome} (${G.nomeTipoStazione(s).toLowerCase()}): le strade passano solo nelle autostazioni`;
    }
    return null;
  };

  // Il tracciato fra a e b non si trova: perché? { testo, blocchi: caselle da segnare in rosso }
  G.motivoTracciato = function (st, a, b, rete) {
    const ma = G.motivoCasella(st, a, rete), mb = G.motivoCasella(st, b, rete);
    if (ma) return { testo: 'Non si parte da qui: ' + ma, blocchi: [a] };
    if (mb) return { testo: 'Non si arriva qui: ' + mb, blocchi: [b] };
    // uno dei due punti è chiuso tutto intorno? si esplora un po' attorno a ciascuno
    const m = st.mondo, W = m.W;
    const chiuso = (da, max) => {
      const visti = new Set([da]), coda = [da], bordo = new Set();
      while (coda.length) {
        const i = coda.pop();
        for (let d = 0; d < 8; d++) {
          const j = G.vicino(m, i, d);
          if (j < 0 || visti.has(j)) continue;
          if (G.motivoCasella(st, j, rete)) { bordo.add(j); continue; }
          visti.add(j); coda.push(j);
          if (visti.size > max) return null; // c'è spazio: non è chiuso
        }
      }
      return [...bordo];
    };
    const ba = chiuso(a, 4000);
    if (ba) return { testo: 'La partenza è chiusa tutto intorno da case, industrie o acqua: demolisci una casa per aprire un varco', blocchi: ba.slice(0, 300) };
    const bb = chiuso(b, 4000);
    if (bb) return { testo: 'L\'arrivo è chiuso tutto intorno da case, industrie o acqua: demolisci una casa per aprire un varco', blocchi: bb.slice(0, 300) };
    const dist = Math.max(Math.abs(a % W - b % W), Math.abs(((a / W) | 0) - ((b / W) | 0)));
    if (dist > 120) return { testo: 'Tratto troppo lungo o tortuoso da calcolare in una volta: costruiscilo in più pezzi', blocchi: [] };
    return { testo: 'Fra i due punti c\'è una barriera di acqua, case o industrie: prova un altro giro o costruisci in più pezzi', blocchi: [] };
  };

  function giaCollegati(m, i, d, rete) {
    if (rete === 'binario') return (m.mBin[i] >> d) & 1;
    if (!((m.mStr[i] >> d) & 1)) return 0;
    if (rete === 'strada') return 1;
    const j = G.vicino(m, i, d);
    return m.tipoStr[i] === 2 && m.tipoStr[j] === 2 ? 1 : 0;
  }

  // ---------------------------------------------------------------- pendenze, gallerie e viadotti
  const NESSUNA = -32768; // quota della rete mai calcolata (reti di prima): vale quella del terreno
  const OPERA = G.OPERA = { SUPERFICIE: 0, GALLERIA: 1, VIADOTTO: 2 };
  const grQuota = rete => (rete === 'binario' ? 'quotaBin' : 'quotaStr');
  const grOpera = rete => (rete === 'binario' ? 'operaBin' : 'operaStr');

  // quota del terreno in metri: dalle soglie del tipo di terreno (mare 0 m, fine pianura 250, fine collina 700,
  // neve 2300, la vetta più alta 4500); sulle mappe reali sono le soglie usate per crearle, quindi metri veri
  G.metriTerreno = function (m) {
    if (m._metri) return m._metri;
    const p = [[m.livMare, 0], [m.livPian, 250], [m.livColl, 700], [m.livNeve, 2300], [1, 4500]], q = new Float32Array(m.N);
    for (let i = 0; i < m.N; i++) {
      const a = m.alt[i];
      if (a <= p[0][0]) continue;
      let k = 1;
      while (k < p.length - 1 && a > p[k][0]) k++;
      q[i] = p[k - 1][1] + (p[k][1] - p[k - 1][1]) * Math.min(1, (a - p[k - 1][0]) / Math.max(1e-6, p[k][0] - p[k - 1][0]));
    }
    return (m._metri = q);
  };
  // quota della rete in una casella (in galleria è sotto il terreno, sul viadotto sopra)
  G.quotaRete = function (st, i, rete) {
    const q = st.mondo[grQuota(rete)][i];
    return q === NESSUNA ? G.metriTerreno(st.mondo)[i] : q;
  };
  G.operaRete = (st, i, rete) => st.mondo[grOpera(rete)][i];
  // la rete se ne va dalla casella: si dimentica anche la sua quota
  function liberaQuota(m, i, rete) { m[grQuota(rete)][i] = NESSUNA; m[grOpera(rete)][i] = 0; }

  // Profilo di un tracciato: la linea segue il terreno ma non sale né scende più della pendenza massima.
  // Si fa una passata in avanti e una all'indietro: davanti a un monte la linea sale al massimo e poi lo
  // attraversa (galleria), su una valle scende al massimo e la scavalca (viadotto). Restano fisse le quote dei
  // tratti già costruiti, delle stazioni e dei due estremi. Restituisce quote, opere, costo per casella e riepilogo.
  G.profiloTracciato = function (st, caselle, rete) {
    const m = st.mondo, n = caselle.length, Hm = G.metriTerreno(m), km = G.kmCasella(st), O = C.opere;
    const pmax = O.pendenzaMax[rete] / 1000, qR = m[grQuota(rete)], oR = m[grOpera(rete)];
    const terra = new Float64Array(n), h = new Float64Array(n), L = new Float64Array(n), fisso = new Uint8Array(n), c0 = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      const i = caselle[k];
      terra[k] = h[k] = Hm[i];
      c0[k] = G.costoCasella(st, i, rete);
      if (qR[i] !== NESSUNA) { h[k] = qR[i]; fisso[k] = 1; } else if (c0[k] === 0 || k === 0 || k === n - 1) fisso[k] = 1;
      if (k) L[k] = km * 1000 * LUN[G.direzione(m, caselle[k - 1], i)];
    }
    for (let k = 1; k < n; k++) if (!fisso[k]) h[k] = Math.min(h[k - 1] + pmax * L[k], Math.max(h[k - 1] - pmax * L[k], h[k]));
    for (let k = n - 2; k >= 0; k--) if (!fisso[k]) h[k] = Math.min(h[k + 1] + pmax * L[k + 1], Math.max(h[k + 1] - pmax * L[k + 1], h[k]));
    const prezzo = C.reti[rete].costo * km, opere = new Uint8Array(n), costi = new Float64Array(n);
    const r = { quote: h, opere, costi, costo: 0, pendenza: 0, gallerie: 0, kmGallerie: 0, viadotti: 0, kmViadotti: 0, scavo: 0 };
    for (let k = 0; k < n; k++) {
      const i = caselle[k];
      if (k) r.pendenza = Math.max(r.pendenza, Math.abs(h[k] - h[k - 1]) / L[k] * 1000);
      if (c0[k] === 0) { opere[k] = oR[i]; continue; } // c'è già (o è una stazione): niente da pagare
      const d = h[k] - terra[k];
      let c;
      if (d < -O.sogliaMetri && m.occ[i] !== OCC.STAZIONE) { opere[k] = OPERA.GALLERIA; c = prezzo * O.galleria; }
      else if (d > O.sogliaMetri) { opere[k] = OPERA.VIADOTTO; c = prezzo * O.viadotto; }
      else { const s = Math.abs(d) * O.scavoAlMetro * km; c = c0[k] + s; r.scavo += s; }
      costi[k] = c; r.costo += c;
      if (opere[k]) {
        const nuova = k === 0 || opere[k - 1] !== opere[k] || costi[k - 1] === 0;
        if (opere[k] === OPERA.GALLERIA) { r.kmGallerie += km; if (nuova) r.gallerie++; } else { r.kmViadotti += km; if (nuova) r.viadotti++; }
      }
    }
    r.costo = Math.round(r.costo);
    return r;
  };

  // il tracciato più economico fra due caselle (A*); restituisce { caselle, costo, profilo } o null.
  // La ricerca tiene conto delle pendenze: un passo troppo ripido costa quanto una galleria o un viadotto,
  // così la linea gira attorno ai monti quando conviene.
  G.cercaTracciato = function (st, a, b, rete) {
    const m = st.mondo, W = m.W, N = m.N;
    if (!isFinite(G.costoCasella(st, a, rete)) || !isFinite(G.costoCasella(st, b, rete))) return null;
    if (a === b) { const p = G.profiloTracciato(st, [a], rete); return { caselle: [a], costo: p.costo, profilo: p }; }
    const km = G.kmCasella(st), base = C.reti[rete].costo * km * 0.35;
    const Hm = G.metriTerreno(m), O = C.opere, pmax = O.pendenzaMax[rete] / 1000, prezzo = C.reti[rete].costo * km;
    const B = bufferRicerca(N), g = B.g, da = B.da, visto = B.visto, chiuso = B.chiuso, giro = B.giro;
    const bx = b % W, by = (b / W) | 0;
    const h = i => {
      const dx = Math.abs(i % W - bx), dy = Math.abs(((i / W) | 0) - by);
      return base * (Math.max(dx, dy) + 0.414 * Math.min(dx, dy));
    };
    const coda = new Coda();
    g[a] = 0; da[a] = -1; visto[a] = giro; coda.metti(a, h(a));
    let iter = 0;
    while (!coda.vuota()) {
      const i = coda.togli();
      if (chiuso[i] === giro) continue;
      chiuso[i] = giro;
      if (i === b || ++iter > 150000) break;
      for (let d = 0; d < 8; d++) {
        const j = G.vicino(m, i, d);
        if (j < 0 || chiuso[j] === giro) continue;
        let cj = G.costoCasella(st, j, rete);
        if (!isFinite(cj)) continue;
        if (cj > 0) { // casella da costruire: quanto è ripido il passo?
          const dh = Math.abs(Hm[j] - Hm[i]), p = dh / (km * 1000 * LUN[d]);
          if (p > pmax) cj = Math.max(cj, prezzo * (Hm[j] > Hm[i] ? O.galleria : O.viadotto) * Math.min(1, 0.5 + (p - pmax) / pmax));
          else cj += Math.min(dh, O.sogliaMetri) * 0.5 * O.scavoAlMetro * km;
        }
        const passo = giaCollegati(m, i, d, rete) ? base * 0.5 * LUN[d] : (cj + base) * LUN[d];
        const ng = g[i] + passo;
        if (visto[j] !== giro || ng < g[j]) { visto[j] = giro; g[j] = ng; da[j] = i; coda.metti(j, ng + h(j)); }
      }
    }
    if (chiuso[b] !== giro) return null;
    const caselle = [];
    for (let i = b; i !== -1; i = da[i]) caselle.push(i);
    caselle.reverse();
    const profilo = G.profiloTracciato(st, caselle, rete);
    return { caselle, costo: profilo.costo, profilo };
  };

  G.costruisciTracciato = function (st, tr, rete) {
    if (G.anno(st) < C.reti[rete].anno) return `${C.reti[rete].nome}: disponibile dal ${C.reti[rete].anno}`;
    if (st.soldi < tr.costo) return 'Fondi insufficienti';
    const m = st.mondo, p = tr.profilo || G.profiloTracciato(st, tr.caselle, rete), qR = m[grQuota(rete)], oR = m[grOpera(rete)];
    for (let k = 0; k + 1 < tr.caselle.length; k++) G.collega(st, tr.caselle[k], tr.caselle[k + 1], rete, false);
    tr.caselle.forEach((i, k) => {
      if (qR[i] === NESSUNA) qR[i] = Math.round(p.quote[k]); // le caselle che c'erano già tengono la loro quota
      if (p.costi[k] > 0) oR[i] = p.opere[k];
      // il bosco si taglia solo dove la linea passa in superficie
      if (m.bosco[i] && p.opere[k] === OPERA.SUPERFICIE) { m.bosco[i] = 0; st.sporchi.push(i); }
    });
    G.spendi(st, tr.costo, 'costruzione');
    st.valoreInfra += tr.costo * 0.5;
    G.reteCambiata(st);
    return null;
  };

  // ---------------------------------------------------------------- percorsi dei veicoli
  // A* sui collegamenti esistenti. rete: 'binario' o 'strada'. Restituisce l'elenco delle caselle o null.
  G.cercaPercorso = function (st, a, b, rete) {
    if (st._cacheVer !== st.versioneRete) { st._cache = new Map(); st._cacheVer = st.versioneRete; }
    const chiave = rete + ':' + a + ':' + b;
    if (st._cache.has(chiave)) return st._cache.get(chiave);
    const m = st.mondo, W = m.W, N = m.N;
    const mask = rete === 'binario' ? m.mBin : m.mStr;
    let ris = null;
    if (a === b) ris = [a];
    else if (mask[a] && mask[b]) {
      const B = bufferRicerca(N), g = B.g, da = B.da, visto = B.visto, chiuso = B.chiuso, giro = B.giro;
      const bx = b % W, by = (b / W) | 0, fh = rete === 'binario' ? 1 : 0.6;
      const h = i => {
        const dx = Math.abs(i % W - bx), dy = Math.abs(((i / W) | 0) - by);
        return fh * (Math.max(dx, dy) + 0.414 * Math.min(dx, dy));
      };
      const coda = new Coda();
      g[a] = 0; da[a] = -1; visto[a] = giro; coda.metti(a, h(a));
      while (!coda.vuota()) {
        const i = coda.togli();
        if (chiuso[i] === giro) continue;
        chiuso[i] = giro;
        if (i === b) break;
        const mk = mask[i];
        for (let d = 0; d < 8; d++) {
          if (!((mk >> d) & 1)) continue;
          const j = G.vicino(m, i, d);
          if (j < 0 || chiuso[j] === giro) continue;
          let f = 1;
          if (rete === 'binario') {
            const t = m.tipo[j];
            if (t === T.COLLINA) f = 1.15; else if (t === T.MONTAGNA) f = 1.35;
          } else if (m.tipoStr[i] === 2 && m.tipoStr[j] === 2) f = 0.6;
          const ng = g[i] + LUN[d] * f;
          if (visto[j] !== giro || ng < g[j]) { visto[j] = giro; g[j] = ng; da[j] = i; coda.metti(j, ng + h(j)); }
        }
      }
      if (chiuso[b] === giro) {
        ris = [];
        for (let i = b; i !== -1; i = da[i]) ris.push(i);
        ris.reverse();
      }
    }
    st._cache.set(chiave, ris);
    return ris;
  };

  // ---------------------------------------------------------------- demolizione
  function stacca(m, i, maschera) {
    const rete = maschera === m.mBin ? 'binario' : 'strada';
    for (let d = 0; d < 8; d++) if ((maschera[i] >> d) & 1) {
      const j = G.vicino(m, i, d);
      if (j >= 0) {
        maschera[j] &= ~(1 << ((d + 4) & 7));
        if (maschera === m.mStr && !m.mStr[j]) { m.tipoStr[j] = 0; m.strCitta[j] = 0; }
        if (!maschera[j]) liberaQuota(m, j, rete);
      }
    }
    maschera[i] = 0;
    liberaQuota(m, i, rete);
  }

  // restituisce null se fatto, altrimenti il motivo
  G.demolisci = function (st, i) {
    const m = st.mondo, o = m.occ[i];
    const spesa = c => { if (st.soldi < c) return false; G.spendi(st, c, 'costruzione'); return true; };
    if (o === OCC.STAZIONE) return G.demolisciStazione(st, m.rif[i]);
    if (o === OCC.INDUSTRIA) return 'Le industrie non si possono demolire';
    if (m.mBin[i]) {
      if (!spesa(C.costoDemolizione)) return 'Fondi insufficienti';
      stacca(m, i, m.mBin); G.reteCambiata(st); return null;
    }
    if (m.mStr[i]) {
      if (m.strCitta[i]) return 'Le strade comunali non si possono demolire';
      if (!spesa(C.costoDemolizione)) return 'Fondi insufficienti';
      stacca(m, i, m.mStr); m.tipoStr[i] = 0; G.reteCambiata(st); return null;
    }
    if (o === OCC.CASA) {
      if (!spesa(C.costoCasa * m.liv[i])) return 'Fondi insufficienti';
      G.togliCasa(st, i); return null;
    }
    if (m.bosco[i]) {
      if (!spesa(C.costoBosco)) return 'Fondi insufficienti';
      m.bosco[i] = 0; st.sporchi.push(i); return null;
    }
    return 'Niente da demolire';
  };
})();
