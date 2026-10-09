// Generazione del mondo: terreno, fiumi, boschi, città inventate e industrie con le loro riserve.
// Anche le funzioni che fanno crescere le città (case e strade comunali) stanno qui.
(function () {
  'use strict';
  const G = window.GIOCO = window.GIOCO || {};
  const C = window.CATALOGO;

  const T = G.T = { ACQUA: 0, PIANURA: 1, COLLINA: 2, MONTAGNA: 3, FIUME: 4 };
  G.NOMI_TERRENO = ['acqua', 'pianura', 'collina', 'montagna', 'fiume'];
  const OCC = G.OCC = { LIBERO: 0, CASA: 1, INDUSTRIA: 2, STAZIONE: 3 };

  // tutte le griglie del mondo (una cella per casella)
  G.creaGriglie = function (W, H) {
    const N = W * H;
    return {
      W, H, N,
      alt: new Float32Array(N),    // quota 0..1
      tipo: new Uint8Array(N),     // T.*
      bosco: new Uint8Array(N),    // 1 = alberi
      occ: new Uint8Array(N),      // OCC.*
      rif: new Int32Array(N).fill(-1), // id di industria o stazione
      liv: new Uint8Array(N),      // livello della casa
      cittaDi: new Int16Array(N).fill(-1),
      mBin: new Uint8Array(N),     // binari: un bit per ciascuna delle 8 direzioni
      mStr: new Uint8Array(N),     // strade: idem
      tipoStr: new Uint8Array(N),  // 1 strada, 2 autostrada
      strCitta: new Uint8Array(N), // strada comunale (gratis, non demolibile)
      copertura: new Uint8Array(N) // quante stazioni coprono la casella
    };
  };

  // terreno libero dove si può costruire un edificio (industria, stazione)
  G.solido = function (m, i) {
    const t = m.tipo[i];
    return (t === T.PIANURA || t === T.COLLINA || t === T.MONTAGNA) && m.occ[i] === OCC.LIBERO;
  };
  // casella buona per una casa o per una strada comunale
  // (sulle mappe reali anche in montagna: L'Aquila, Cortina, i paesi delle Alpi)
  G.edificabile = function (m, i) {
    const t = m.tipo[i];
    return (t === T.PIANURA || t === T.COLLINA || (t === T.MONTAGNA && m.reale)) && m.occ[i] === OCC.LIBERO && !m.mBin[i] && !m.mStr[i];
  };

  // lato di una casella in km: 1 sulle mappe inventate, di più su quelle reali (Italia 2, Europa 6)
  G.kmCasella = st => (st && st.opz && st.opz.km) || C.kmPerCasella;

  // ---------------------------------------------------------------- mappe reali
  // Ogni mappa reale è un file dati/mappe/<id>.js (generato da scripts/mappe.js) che si carica solo quando serve,
  // aggiungendo un <script> alla pagina: funziona anche aprendo index.html con un doppio clic (niente fetch).
  // Si tiene in memoria solo la mappa in uso.
  G.caricaMappaReale = function (id, fatto) {
    const M = window.MAPPE_REALI = window.MAPPE_REALI || {};
    for (const k of Object.keys(M)) if (k !== id) delete M[k];
    if (M[id]) { fatto(null); return; }
    const def = (C.mappeReali || []).find(k => k.id === id);
    if (!def) { fatto('Mappa sconosciuta: ' + id); return; }
    const s = document.createElement('script');
    s.src = def.file;
    s.onload = () => { s.remove(); fatto(M[id] ? null : 'Il file della mappa non è valido: ' + def.file); };
    s.onerror = () => { s.remove(); fatto('Impossibile caricare la mappa ' + def.file); };
    document.head.appendChild(s);
  };

  function daBase64(s) {
    const bin = atob(s), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  // terreno di una mappa reale: tipi e quote vengono dal file, i boschi dal seme
  function terrenoReale(opz) {
    const R = window.MAPPE_REALI && window.MAPPE_REALI[opz.mappa];
    if (!R) throw new Error('Mappa non caricata: ' + opz.mappa);
    const m = G.creaGriglie(R.W, R.H), alt = daBase64(R.alt);
    m.tipo.set(daBase64(R.tipo));
    for (let i = 0; i < m.N; i++) m.alt[i] = alt[i] / 255;
    // soglie fisse (vedi quotaGioco in scripts/mappe.js): mare, 250 m, 700 m, 2300 m
    m.livMare = 0.2; m.livPian = 0.45; m.livColl = 0.65; m.livNeve = 0.95;
    m.reale = true;
    const rnd = G.creaCasuale(opz.seme), r3 = G.creaRumore(rnd);
    const soglia = [0, 0.62, 0.53, 0.5, 0]; // meno boschi in pianura (campi coltivati)
    for (let y = 0; y < m.H; y++) for (let x = 0; x < m.W; x++) {
      const i = y * m.W + x, t = m.tipo[i];
      if (!soglia[t] || m.alt[i] > m.livNeve - 0.06) continue;
      if (r3(x / 12, y / 12, 3) > soglia[t]) m.bosco[i] = 1;
    }
    return m;
  }

  // ---------------------------------------------------------------- terreno
  // dipende solo dal seme (o dal file della mappa reale): al caricamento di una partita si rigenera identico
  G.generaTerreno = function (opz) {
    if (opz.mappa) return terrenoReale(opz);
    const rnd = G.creaCasuale(opz.seme);
    const W = opz.W, H = opz.H, m = G.creaGriglie(W, H), N = m.N;
    const r1 = G.creaRumore(rnd), r2 = G.creaRumore(rnd), r3 = G.creaRumore(rnd);
    // da quali lati c'è il mare (nord, est, sud, ovest)
    const lati = [0, 1, 2, 3].map(() => rnd() < 0.4);
    if (!lati.some(Boolean)) lati[Math.floor(rnd() * 4)] = true;
    const e = new Float32Array(N);
    const sc = 1 / 36, costa = Math.min(W, H) * 0.25;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = r1(x * sc, y * sc, 5);
      const catena = r2(x * sc * 0.6 + 31, y * sc * 0.6 + 7, 4);
      v += Math.max(0, catena - 0.52) * 1.8;
      const dist = [y, W - 1 - x, H - 1 - y, x];
      for (let k = 0; k < 4; k++) if (lati[k]) {
        const f = Math.max(0, 1 - dist[k] / costa);
        v -= f * f * 0.8;
      }
      e[y * W + x] = v;
    }
    // soglie a quantili: la proporzione fra mare, pianura, colline e monti è sempre simile
    const ord = Float32Array.from(e).sort();
    const q = p => ord[Math.floor(p * (N - 1))];
    const lMare = q(0.16), lPian = q(0.6), lColl = q(0.83), emin = ord[0], emax = ord[N - 1];
    for (let i = 0; i < N; i++) {
      const v = e[i];
      m.tipo[i] = v < lMare ? T.ACQUA : v < lPian ? T.PIANURA : v < lColl ? T.COLLINA : T.MONTAGNA;
      m.alt[i] = (v - emin) / (emax - emin);
    }
    m.livMare = (lMare - emin) / (emax - emin);
    m.livPian = (lPian - emin) / (emax - emin);
    m.livColl = (lColl - emin) / (emax - emin);
    m.livNeve = (q(0.995) - emin) / (emax - emin);
    togliPozzanghere(m);
    tracciaFiumi(m, e, rnd);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, t = m.tipo[i];
      const adatto = t === T.PIANURA || t === T.COLLINA || (t === T.MONTAGNA && m.alt[i] < m.livNeve - 0.04);
      if (adatto && r3(x / 12, y / 12, 3) > 0.57) m.bosco[i] = 1;
    }
    return m;
  };

  // laghetti di poche caselle: diventano pianura
  function togliPozzanghere(m) {
    const visto = new Uint8Array(m.N), W = m.W;
    for (let s = 0; s < m.N; s++) {
      if (visto[s] || m.tipo[s] !== T.ACQUA) continue;
      const pila = [s], zona = [];
      visto[s] = 1;
      while (pila.length) {
        const i = pila.pop(); zona.push(i);
        const x = i % W, y = (i / W) | 0;
        const vic = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < m.H - 1 ? i + W : -1];
        for (const j of vic) if (j >= 0 && !visto[j] && m.tipo[j] === T.ACQUA) { visto[j] = 1; pila.push(j); }
      }
      if (zona.length < 8) for (const i of zona) m.tipo[i] = T.PIANURA;
    }
  }

  // i fiumi partono dai monti e scendono finché trovano il mare, un lago o un altro fiume
  function tracciaFiumi(m, e, rnd) {
    const W = m.W, H = m.H, n = 2 + Math.round(m.N / 6000);
    const monti = [];
    for (let i = 0; i < m.N; i++) if (m.tipo[i] === T.MONTAGNA) monti.push(i);
    if (!monti.length) return;
    const D4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let fatti = 0;
    for (let f = 0; f < n * 4 && fatti < n; f++) {
      let cur = monti[Math.floor(rnd() * monti.length)];
      const visti = new Set(), tratto = [];
      let arrivato = false;
      for (let passo = 0; passo < 700; passo++) {
        visti.add(cur);
        if (m.tipo[cur] === T.ACQUA || m.tipo[cur] === T.FIUME) { arrivato = true; break; }
        tratto.push(cur);
        const x = cur % W, y = (cur / W) | 0;
        let migliore = -1, em = Infinity;
        for (const [dx, dy] of D4) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (visti.has(j)) continue;
          const v = e[j] + rnd() * 0.004;
          if (v < em) { em = v; migliore = j; }
        }
        if (migliore < 0) break;
        cur = migliore;
      }
      if (arrivato && tratto.length > 10) {
        for (const i of tratto) m.tipo[i] = T.FIUME;
        fatti++;
      }
    }
  }

  // ---------------------------------------------------------------- stato iniziale
  G.statoVuoto = function (opz, m) {
    return {
      opz, mondo: m, citta: [], industrie: [], stazioni: [], veicoli: [],
      soldi: C.inizio.soldi, prestito: 0, giorno: 7 / 24, giornoInt: 0, oraInt: 7, versioneRete: 1, // si comincia alle 7 del mattino
      conti: { anno: opz.anno, corrente: G.nuovoConto(), storico: [] },
      notizie: [], contatori: { veicolo: 0 }, valoreInfra: 0,
      sporchi: [], effetti: [], mesiInRosso: 0
    };
  };

  G.generaMondo = function (opz) {
    const m = G.generaTerreno(opz);
    const st = G.statoVuoto(opz, m);
    const rnd = G.creaCasuale((opz.seme * 7 + 13) >>> 0);
    if (opz.mappa) piazzaCittaReali(st, rnd); else piazzaCitta(st, rnd);
    // sulle mappe reali conta solo la terraferma (le inventate ne hanno circa l'84%)
    let caselle = m.N;
    if (m.reale) { caselle = 0; for (let i = 0; i < m.N; i++) if (m.tipo[i] !== T.ACQUA) caselle++; caselle /= 0.84; }
    for (const tipo of Object.keys(C.industrie)) {
      const def = C.industrie[tipo];
      if (def.dalAnno && opz.anno < def.dalAnno) continue;
      const n = Math.max(1, Math.round(def.densita * caselle / 10000));
      for (let k = 0; k < n; k++) G.fondaIndustria(st, tipo, rnd);
    }
    return st;
  };

  // ---------------------------------------------------------------- città
  G.inventaNome = function (rnd, usati, costiera, montana) {
    const P = C.nomi;
    const unisci = (a, b) => (a.slice(-1) === b[0] ? a + b.slice(1) : a + b);
    for (let k = 0; k < 60; k++) {
      let n;
      const r = rnd();
      if (costiera && r < 0.25) n = 'Porto ' + rnd.scegli(P.marini);
      else if (r < 0.5) n = unisci(rnd.scegli(montana && rnd() < 0.7 ? P.prefissiMonte : P.prefissi), rnd.scegli(P.radici));
      else if (r < 0.65) {
        const santo = rnd() < 0.6 ? rnd.scegli(P.santi) : rnd.scegli(P.sante);
        const femm = P.sante.includes(santo);
        n = /^[AEIOU]/.test(santo) ? "Sant'" + santo : (femm ? 'Santa ' : 'San ') + santo;
      } else n = rnd.scegli(P.tronchi) + rnd.scegli(P.suffissi);
      if (rnd() < 0.12) n += rnd.scegli(costiera ? P.aggiunteMare : montana ? P.aggiunteMonte : P.aggiunte);
      if (!usati.has(n)) { usati.add(n); return n; }
    }
    return 'Borgo Nuovo ' + usati.size;
  };

  function contaIntorno(m, x, y, r, tipo) {
    let n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < m.W && ny < m.H && m.tipo[ny * m.W + nx] === tipo) n++;
    }
    return n;
  }

  G.nuovoMese = () => ({ partiti: 0, arrivati: 0, posta: 0, merci: 0, cibo: 0, carburante: 0 });

  function piazzaCitta(st, rnd) {
    const m = st.mondo, W = m.W, H = m.H, n = st.opz.numCitta;
    const cand = [];
    for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) {
      const t = m.tipo[y * W + x];
      if (t !== T.PIANURA && t !== T.COLLINA) continue;
      let p = rnd() + (t === T.PIANURA ? 0.6 : 0);
      if (contaIntorno(m, x, y, 3, T.ACQUA) || contaIntorno(m, x, y, 2, T.FIUME)) p += 0.4;
      cand.push([p, x, y]);
    }
    cand.sort((a, b) => b[0] - a[0]);
    const usati = new Set();
    let dmin = Math.sqrt(m.N / n) * 0.65;
    for (let tentativo = 0; tentativo < 4 && st.citta.length < n; tentativo++, dmin *= 0.8) {
      for (const [, x, y] of cand) {
        if (st.citta.length >= n) break;
        if (st.citta.some(c => Math.hypot(c.x - x, c.y - y) < dmin)) continue;
        const costiera = contaIntorno(m, x, y, 5, T.ACQUA) > 0;
        const montana = contaIntorno(m, x, y, 6, T.MONTAGNA) > 12;
        st.citta.push({
          id: st.citta.length, nome: G.inventaNome(rnd, usati, costiera, montana), x, y,
          pop: 0, case: 0, mese: G.nuovoMese(), meseScorso: G.nuovoMese(), storico: [], nServite: 0, crescita: 0
        });
      }
    }
    // la prima è la "capitale", le altre più piccole
    st.citta.forEach((c, k) => {
      const obiettivo = k === 0 ? 1600 + rnd() * 900 : 120 + Math.pow(rnd(), 2) * 1000;
      fondaCitta(st, c, rnd, obiettivo);
      c.storico.push(c.pop);
    });
  }

  // città vere dal file della mappa: "nome|x|y|abitanti" per riga, già in ordine di grandezza.
  // Gli abitanti del gioco crescono con la radice di quelli veri (R.abitanti × √abitanti):
  // così un paese ha qualche casa e Roma qualche migliaio di abitanti del gioco, come una capitale inventata.
  function piazzaCittaReali(st, rnd) {
    const m = st.mondo, R = window.MAPPE_REALI[st.opz.mappa], obiettivi = [];
    for (const riga of R.citta.split('\n')) {
      const p = riga.split('|');
      let x = +p[1], y = +p[2];
      const veri = +p[3];
      // il centro può stare su una casella libera o su una via di un paese vicino (le vie si condividono);
      // se c'è già una casa si cerca il posto buono più vicino entro due caselle
      const adatto = i => (G.edificabile(m, i) || (m.mStr[i] && m.occ[i] === OCC.LIBERO && m.tipo[i] !== T.ACQUA && m.tipo[i] !== T.FIUME));
      if (!adatto(y * m.W + x)) {
        let best = null;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx, ny = y + dy, d = dx * dx + dy * dy;
          if (nx > 0 && ny > 0 && nx < m.W - 1 && ny < m.H - 1 && adatto(ny * m.W + nx) && (!best || d < best[2])) best = [nx, ny, d];
        }
        if (!best) continue;
        x = best[0]; y = best[1];
      }
      const c = {
        id: st.citta.length, nome: p[0], x, y, veri,
        pop: 0, case: 0, mese: G.nuovoMese(), meseScorso: G.nuovoMese(), storico: [], nServite: 0, crescita: 0
      };
      st.citta.push(c);
      // prima solo il nucleo (croce di vie e qualche casa): così ogni paese si prende il suo posto
      // prima che le città grandi, cresciute, occupino tutto quello che hanno attorno
      const obiettivo = Math.min(9000, (R.abitanti || 3) * Math.sqrt(veri));
      fondaCitta(st, c, rnd, obiettivo, 60);
      if (c.pop === 0) { st.citta.pop(); continue; } // nessuno spazio: il paese resta fuori
      obiettivi.push(obiettivo);
    }
    // poi ognuna cresce fino alla sua grandezza, dalle più grandi
    st.citta.forEach((c, k) => { cresciFino(st, c, rnd, obiettivi[k]); c.storico.push(c.pop); });
  }

  // primo = abitanti a cui fermarsi per ora (le vie iniziali però sono già quelle della città intera)
  function fondaCitta(st, c, rnd, obiettivo, primo) {
    const m = st.mondo, centro = c.y * m.W + c.x;
    if (m.bosco[centro]) m.bosco[centro] = 0;
    // sulle mappe reali le città sono fitte: vie iniziali più corte
    const L = m.reale ? 1 + Math.round(Math.sqrt(obiettivo) / 14) : 2 + Math.round(Math.sqrt(obiettivo) / 9);
    for (let d = 0; d < 8; d += 2) { // la croce delle vie principali
      let prec = centro;
      const len = Math.max(1, L + rnd.intero(-1, 1));
      for (let k = 0; k < len; k++) {
        const nx = G.vicino(m, prec, d);
        if (nx < 0 || !G.edificabile(m, nx)) break;
        G.collega(st, prec, nx, 'strada', true);
        prec = nx;
      }
    }
    cresciFino(st, c, rnd, Math.min(obiettivo, primo || Infinity));
  }

  // sulle mappe reali le case nascono già della grandezza adatta alla città finale (c.obiettivo) e,
  // se attorno è tutto occupato dai paesi vicini, si alzano quelle che ci sono
  function cresciFino(st, c, rnd, obiettivo) {
    let tent = 0, falliti = 0;
    if (st.mondo.reale) c.obiettivo = obiettivo;
    while (c.pop < obiettivo && tent++ < 3000 && falliti < 30) {
      if (G.aggiungiCasa(st, c, rnd, 0)) falliti = 0;
      else if (G.estendiStrada(st, c, rnd)) continue;
      else if (st.mondo.reale && G.miglioraCasa(st, c, rnd)) falliti = 0;
      else falliti++;
    }
    delete c.obiettivo;
  }

  // raggio dell'abitato: dipende dal numero di edifici, non dagli abitanti (i palazzi sono più fitti)
  G.raggioCitta = c => 2.5 + Math.sqrt(c.case) * 0.8;

  // le vie comunali seguono una griglia: una via ogni 3 caselle, così fra due vie stanno due file di case.
  // Le caselle della griglia restano libere per le vie future: le case occupano solo gli isolati.
  const PASSO_VIE = 3;
  const sullaGriglia = (v, centro) => (((v - centro) % PASSO_VIE) + PASSO_VIE) % PASSO_VIE === 0;
  G.livelloMax = pop => (pop < 250 ? 2 : pop < 1200 ? 3 : 4);
  G.classeCitta = pop => (pop < 300 ? 'villaggio' : pop < 1000 ? 'paese' : pop < 3000 ? 'cittadina' : pop < 10000 ? 'città' : 'metropoli');

  function livelloNuovaCasa(c, d, R, rnd) {
    const max = G.livelloMax(Math.max(c.pop, c.obiettivo || 0)); // obiettivo: grandezza finale durante la fondazione
    const vic = Math.max(0, 1 - d / (R + 0.01));
    return Math.max(1, Math.min(max, 1 + Math.floor(vic * max * 0.9 + rnd() * 0.8)));
  }

  // accanto a una strada o a una stazione
  function servita(m, x, y) {
    const W = m.W;
    const v = [y * W + x - 1, y * W + x + 1, (y - 1) * W + x, (y + 1) * W + x];
    for (const j of v) if (m.mStr[j] || m.occ[j] === OCC.STAZIONE) return true;
    return false;
  }

  // prova a costruire una casa vicino al centro (o vicino a cx,cy entro R)
  G.aggiungiCasa = function (st, c, rnd, livello, cx, cy, R) {
    const m = st.mondo, W = m.W, H = m.H;
    if (cx === undefined) { cx = c.x; cy = c.y; R = G.raggioCitta(c); }
    const Rc = G.raggioCitta(c);
    for (let k = 0; k < 50; k++) {
      const a = rnd() * Math.PI * 2, d = Math.pow(rnd(), 0.75) * R;
      const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
      if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1) continue;
      const i = y * W + x;
      if (!G.edificabile(m, i) || !servita(m, x, y)) continue;
      if (sullaGriglia(x, c.x) || sullaGriglia(y, c.y)) continue;
      const l = livello || livelloNuovaCasa(c, Math.hypot(x - c.x, y - c.y), Rc, rnd);
      G.poniCasa(st, c, i, l);
      return true;
    }
    return false;
  };

  G.poniCasa = function (st, c, i, l) {
    const m = st.mondo;
    m.occ[i] = OCC.CASA; m.liv[i] = l; m.cittaDi[i] = c.id;
    if (m.bosco[i]) { m.bosco[i] = 0; st.sporchi.push(i); }
    c.pop += C.case.pop[l]; c.case++;
  };

  G.togliCasa = function (st, i) {
    const m = st.mondo, c = st.citta[m.cittaDi[i]];
    if (c) { c.pop -= C.case.pop[m.liv[i]]; c.case--; }
    m.occ[i] = OCC.LIBERO; m.liv[i] = 0; m.cittaDi[i] = -1;
  };

  // una casa esistente diventa più grande
  G.miglioraCasa = function (st, c, rnd) {
    const m = st.mondo, R = G.raggioCitta(c), max = G.livelloMax(Math.max(c.pop, c.obiettivo || 0));
    for (let k = 0; k < 40; k++) {
      const x = Math.round(c.x + (rnd() * 2 - 1) * R), y = Math.round(c.y + (rnd() * 2 - 1) * R);
      if (x < 0 || y < 0 || x >= m.W || y >= m.H) continue;
      const i = y * m.W + x;
      if (m.occ[i] !== OCC.CASA || m.cittaDi[i] !== c.id || m.liv[i] >= max) continue;
      c.pop += C.case.pop[m.liv[i] + 1] - C.case.pop[m.liv[i]];
      m.liv[i]++;
      return true;
    }
    return false;
  };

  // il comune allunga una via esistente di qualche casella
  G.estendiStrada = function (st, c, rnd) {
    const m = st.mondo, Rc = G.raggioCitta(c), R = Math.ceil(Rc);
    const vie = [];
    for (let y = Math.max(1, c.y - R); y <= Math.min(m.H - 2, c.y + R); y++) {
      for (let x = Math.max(1, c.x - R); x <= Math.min(m.W - 2, c.x + R); x++) if (m.mStr[y * m.W + x]) vie.push(y * m.W + x);
    }
    for (let k = 0; k < 40 && vie.length; k++) {
      const i = rnd.scegli(vie), x = i % m.W, y = (i / m.W) | 0;
      const d = rnd.intero(0, 3) * 2;
      // in orizzontale solo sulle righe della griglia, in verticale solo sulle colonne
      if ((d === 2 || d === 6) ? !sullaGriglia(y, c.y) : !sullaGriglia(x, c.x)) continue;
      let prec = i, fatti = 0;
      const len = rnd.intero(1, 3);
      for (let s = 0; s < len; s++) {
        const nx = G.vicino(m, prec, d);
        if (nx < 0 || Math.hypot(nx % m.W - c.x, ((nx / m.W) | 0) - c.y) > Rc + 1.5) break;
        if (m.mStr[nx]) { // incontra un'altra via: la collega e si ferma
          if (m.occ[nx] === OCC.LIBERO && !(m.mStr[prec] & (1 << d))) { G.collega(st, prec, nx, 'strada', true); fatti++; }
          break;
        }
        if (!G.edificabile(m, nx)) break;
        G.collega(st, prec, nx, 'strada', true);
        if (m.bosco[nx]) { m.bosco[nx] = 0; st.sporchi.push(nx); }
        prec = nx; fatti++;
      }
      if (fatti) { G.reteCambiata(st); return true; }
    }
    return false;
  };

  // città divise in settori di 16 × 16 caselle: sulle mappe reali sono migliaia e scorrerle tutte
  // a ogni ricerca sarebbe lento. Le città non cambiano posto: l'indice si rifà solo se cambia il numero.
  function indiceCitta(st) {
    const X = st._indiceCitta;
    if (X && X.n === st.citta.length && X.mondo === st.mondo) return X;
    const L = 16, col = Math.ceil(st.mondo.W / L), righe = Math.ceil(st.mondo.H / L);
    const sett = Array.from({ length: col * righe }, () => []);
    for (const c of st.citta) sett[((c.y / L) | 0) * col + ((c.x / L) | 0)].push(c);
    return (st._indiceCitta = { n: st.citta.length, mondo: st.mondo, L, col, righe, sett });
  }

  G.cittaVicina = function (st, x, y, maxD) {
    const X = indiceCitta(st), L = X.L, sx = Math.floor(x / L), sy = Math.floor(y / L);
    let best = null, bd = maxD === undefined ? Infinity : maxD;
    // anelli di settori sempre più larghi: ci si ferma quando sono più lontani della città migliore
    for (let r = 0; r <= X.col + X.righe && (r - 1) * L <= bd; r++) {
      for (let qy = sy - r; qy <= sy + r; qy++) {
        if (qy < 0 || qy >= X.righe) continue;
        const bordo = qy === sy - r || qy === sy + r;
        for (let qx = sx - r; qx <= sx + r; qx += bordo ? 1 : 2 * r) {
          if (qx >= 0 && qx < X.col) {
            for (const c of X.sett[qy * X.col + qx]) {
              const d = Math.hypot(c.x - x, c.y - y);
              if (d < bd) { bd = d; best = c; }
            }
          }
          if (r === 0) break;
        }
      }
    }
    return best;
  };

  // ---------------------------------------------------------------- industrie
  const ROMANI = ['', '', ' II', ' III', ' IV', ' V', ' VI'];

  G.fondaIndustria = function (st, tipo, rnd) {
    const m = st.mondo, W = m.W, H = m.H, def = C.industrie[tipo];
    for (let t = 0; t < 400; t++) {
      const x = rnd.intero(2, W - 4), y = rnd.intero(2, H - 4);
      let adatte = 0, ok = true;
      for (let dy = 0; dy < 2 && ok; dy++) for (let dx = 0; dx < 2; dx++) {
        const i = (y + dy) * W + x + dx;
        if (!G.solido(m, i) || m.mBin[i] || m.mStr[i]) { ok = false; break; }
        if (def.bosco ? m.bosco[i] : def.terreno ? def.terreno.includes(G.NOMI_TERRENO[m.tipo[i]]) : m.tipo[i] !== T.MONTAGNA) adatte++;
      }
      if (!ok || adatte < (def.bosco ? 3 : 2)) continue;
      const c = G.cittaVicina(st, x + 1, y + 1);
      const dc = c ? Math.hypot(c.x - x - 1, c.y - y - 1) : 99;
      // sulle mappe reali i paesi sono fitti: le industrie stanno più vicine alle case
      if (m.reale ? (def.vicinoCitta ? (dc < 2 || dc > 10) : dc < 3) : (def.vicinoCitta ? (dc < 4 || dc > 14) : dc < 6)) continue;
      if (st.industrie.some(s => !s.chiusa && Math.abs(s.x - x) < 5 && Math.abs(s.y - y) < 5)) continue;
      const base = def.nome + ' di ' + (c ? c.nome : 'Campagna');
      let nome = base, k = 1;
      // II, III… VI, poi 7, 8…: sulle mappe reali le industrie omonime possono essere molte
      while (st.industrie.some(s => s.nome === nome)) { k++; nome = base + (k <= 6 ? ROMANI[k] : ' ' + k); }
      const riserva = def.riserva ? rnd.intero(def.riserva[0], def.riserva[1]) : 0;
      const ind = {
        id: st.industrie.length, tipo, x, y, nome,
        produzione: def.produce ? rnd.intero(def.base[0], def.base[1]) : 0,
        riserva, riservaIniziale: riserva, inUscita: 0,
        prodMese: 0, trasMese: 0, prodScorso: 0, perc: 0, ricevuto: {}, ricevutoScorso: {},
        stazioni: [], chiusa: false
      };
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const i = (y + dy) * W + x + dx;
        m.occ[i] = OCC.INDUSTRIA; m.rif[i] = ind.id;
        if (m.bosco[i] && !def.bosco) { m.bosco[i] = 0; st.sporchi.push(i); }
      }
      st.industrie.push(ind);
      return ind;
    }
    return null;
  };
})();
