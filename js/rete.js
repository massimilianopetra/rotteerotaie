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

  // il tracciato più economico fra due caselle (A*); restituisce { caselle, costo } o null
  G.cercaTracciato = function (st, a, b, rete) {
    const m = st.mondo, W = m.W, N = m.N;
    if (!isFinite(G.costoCasella(st, a, rete)) || !isFinite(G.costoCasella(st, b, rete))) return null;
    if (a === b) return { caselle: [a], costo: G.costoCasella(st, a, rete) };
    const base = C.reti[rete].costo * G.kmCasella(st) * 0.35;
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
        const cj = G.costoCasella(st, j, rete);
        if (!isFinite(cj)) continue;
        const passo = giaCollegati(m, i, d, rete) ? base * 0.5 * LUN[d] : (cj + base) * LUN[d];
        const ng = g[i] + passo;
        if (visto[j] !== giro || ng < g[j]) { visto[j] = giro; g[j] = ng; da[j] = i; coda.metti(j, ng + h(j)); }
      }
    }
    if (chiuso[b] !== giro) return null;
    const caselle = [];
    for (let i = b; i !== -1; i = da[i]) caselle.push(i);
    caselle.reverse();
    let costo = 0;
    for (const i of caselle) costo += G.costoCasella(st, i, rete);
    return { caselle, costo: Math.round(costo) };
  };

  G.costruisciTracciato = function (st, tr, rete) {
    if (G.anno(st) < C.reti[rete].anno) return `${C.reti[rete].nome}: disponibile dal ${C.reti[rete].anno}`;
    if (st.soldi < tr.costo) return 'Fondi insufficienti';
    const m = st.mondo;
    for (let k = 0; k + 1 < tr.caselle.length; k++) G.collega(st, tr.caselle[k], tr.caselle[k + 1], rete, false);
    for (const i of tr.caselle) if (m.bosco[i]) { m.bosco[i] = 0; st.sporchi.push(i); }
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
    for (let d = 0; d < 8; d++) if ((maschera[i] >> d) & 1) {
      const j = G.vicino(m, i, d);
      if (j >= 0) {
        maschera[j] &= ~(1 << ((d + 4) & 7));
        if (maschera === m.mStr && !m.mStr[j]) { m.tipoStr[j] = 0; m.strCitta[j] = 0; }
      }
    }
    maschera[i] = 0;
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
