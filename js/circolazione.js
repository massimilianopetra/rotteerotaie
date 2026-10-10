// Circolazione dei treni: ogni casella di binario può essere occupata da un solo treno.
// Segnali automatici: un treno può fermarsi ad aspettare solo sui binari di una stazione o subito prima di uno
// scambio; prima di muoversi prenota tutto il tratto fino al prossimo di questi punti, così due treni non entrano
// mai da lati opposti nello stesso binario unico. Se due o più treni si aspettano a vicenda (stallo) il gioco
// lo segnala: il giocatore rimanda indietro un treno e costruisce un binario d'incrocio o una linea doppia.
(function () {
  'use strict';
  const G = window.GIOCO;
  const OCC = G.OCC;
  const PASSO_VAGONE = 0.44; // distanza fra i pezzi del treno (come nel disegno)
  const PENALITA = 3;        // costo in più per una casella prenotata da un treno che va nello stesso senso
  const CONTROMANO = 60;     // ... e da un treno che viene incontro (cerca un binario parallelo)
  const BINARIO_OCCUPATO = 6; // binario di stazione dove c'è già un treno
  const INVERSIONE = 40;     // costo in più per una curva a gomito (più di 90°)

  // st.pren[i] = id del treno che ha prenotato la casella i (0 = libera); st.prenDir[i] = suo senso di marcia
  // (0-7, -1 se non si sa). Non si salvano: si ricostruiscono.
  function pren(st) {
    if (!st.pren || st.pren.length !== st.mondo.N) { st.pren = new Int32Array(st.mondo.N); st.prenDir = new Int8Array(st.mondo.N).fill(-1); }
    return st.pren;
  }
  // due sensi di marcia opposti (o quasi): i treni si verrebbero incontro
  const opposti = (a, b) => a >= 0 && b >= 0 && Math.min(Math.abs(a - b), 8 - Math.abs(a - b)) >= 3;
  G.prenotazioni = pren;

  G.lunghezzaTreno = v => (1 + v.vagoni) * PASSO_VAGONE + 0.3;

  // prende la casella i (d = distanza percorsa dal treno quando la sua testa sarà al centro della casella).
  // I binari delle stazioni non si prenotano: una stazione accoglie sempre i treni in arrivo
  // (altrimenti due treni in due stazioni a un solo binario si aspetterebbero per sempre).
  G.prendiCasella = function (st, v, i, d, dir) {
    const p = pren(st);
    if (st.mondo.occ[i] === OCC.STAZIONE) return true;
    if (p[i] === 0) { p[i] = v.id; st.prenDir[i] = dir === undefined ? -1 : dir; v.pr.push({ i, d }); return true; }
    if (p[i] === v.id) {
      if (dir !== undefined) st.prenDir[i] = dir;
      const e = v.pr.find(k => k.i === i);
      if (e) e.d = Math.max(e.d, d); else v.pr.push({ i, d });
      return true;
    }
    return false;
  };

  // libera le caselle che la coda del treno ha già lasciato
  G.liberaDietro = function (st, v) {
    const p = pren(st), coda = v.odo - G.lunghezzaTreno(v);
    if (!v.pr.length || v.pr[0].d + 0.6 >= coda) return;
    st.versionePren = (st.versionePren || 0) + 1;
    v.pr = v.pr.filter(e => {
      if (e.d + 0.6 >= coda) return true;
      if (p[e.i] === v.id) p[e.i] = 0;
      return false;
    });
  };

  // libera il binario prenotato davanti alla testa (quando il treno cambia strada o torna indietro)
  G.liberaAvanti = function (st, v) {
    const p = pren(st);
    v.pr = v.pr.filter(e => {
      if (e.d <= v.odo + 0.5) return true;
      if (p[e.i] === v.id) p[e.i] = 0;
      return false;
    });
    st.versionePren = (st.versionePren || 0) + 1;
  };

  G.liberaTutto = function (st, v) {
    const p = pren(st);
    for (const e of v.pr || []) if (p[e.i] === v.id) p[e.i] = 0;
    v.pr = [];
    st.versionePren = (st.versionePren || 0) + 1;
  };

  // dopo il caricamento o un cambio di stazione: ogni treno tiene solo le caselle in cui si trova
  G.ricostruisciPrenotazioni = function (st) {
    pren(st).fill(0);
    st.prenDir.fill(-1);
    for (const v of st.veicoli) {
      if (v.tipo !== 'treno') continue;
      v.pr = []; v.limite = 0; v.bloccatoDa = 0; v.attesaSegnale = 0; v.stallo = false; v.ricalcolo = -1; v.morbido = false; v.ignoraSguardo = false;
      if (v.odo === undefined) v.odo = 0;
      v.odo0 = v.odo;
      G.prendiCasella(st, v, v.tile, v.odo);
    }
  };

  function grado(m, i) {
    let b = m.mBin[i], n = 0;
    while (b) { n += b & 1; b >>= 1; }
    return n;
  }

  // il treno può fermarsi sulla casella k del percorso? (capolinea, prima di uno scambio, stazione con più binari).
  // Una stazione con un solo binario attraversata senza fermarsi non va bene: due treni opposti
  // ci entrerebbero insieme dai due lati e non potrebbero più ripartire.
  function puntoDiAttesa(st, cas, k) {
    const m = st.mondo, i = cas[k];
    if (k >= cas.length - 1) return true;
    if (m.occ[i] === OCC.STAZIONE) {
      const s = st.stazioni[m.rif[i]];
      if (s && G.caselleStazione(st, s).filter(j => m.mBin[j]).length >= 2) return true;
    }
    // mai fermi sopra uno scambio (bloccherebbe l'altro binario): si aspetta sulla casella prima
    if (grado(m, i) > 2 || grado(m, cas[k + 1]) < 3) return false;
    // e mai fermi sugli scambi d'ingresso di una stazione (a meno di 3 caselle): si sbarrerebbe la strada
    // ai treni che entrano ed escono; quel tratto si attraversa tutto in una volta
    return !vicinoAStazione(m, i);
  }

  function vicinoAStazione(m, i) {
    const x = i % m.W, y = (i / m.W) | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < m.W && yy < m.H && m.occ[yy * m.W + xx] === OCC.STAZIONE && m.mBin[yy * m.W + xx]) return true;
    }
    return false;
  }

  // il tratto dalla casella 0 del percorso al primo punto di attesa è tutto libero?
  G.trattoLibero = function (st, v, cas) {
    const p = pren(st);
    for (let k = 1; k < cas.length; k++) {
      const o = p[cas[k]];
      if (o !== 0 && o !== v.id) return false;
      if (puntoDiAttesa(st, cas, k)) return true;
    }
    return true;
  };

  // prova a prenotare il tratto dopo v.limite fino al prossimo punto di attesa.
  // Restituisce true se ci è riuscito; altrimenti segna in v.bloccatoDa chi occupa il binario.
  G.estendiPrenotazione = function (st, v) {
    const cas = v.caselle, n = cas.length, p = pren(st), m = st.mondo;
    if (v.limite >= n - 1) return true;
    let fine = v.limite + 1;
    while (!puntoDiAttesa(st, cas, fine)) fine++;
    for (let k = v.limite + 1; k <= fine; k++) {
      const o = p[cas[k]];
      if (o !== 0 && o !== v.id) { v.bloccatoDa = o; v.morbido = false; return false; }
    }
    // sguardo al tratto dopo: se c'è un treno che viene incontro è meglio aspettare qui, altrimenti ci si
    // fermerebbe davanti a lui (per esempio due treni nello stesso senso nei due rami di un raddoppio, con
    // un terzo che aspetta all'ingresso). È un'attesa "morbida": se due treni si aspettano così a vicenda,
    // uno dei due va avanti lo stesso (vedi controllaStalli).
    if (!v.ignoraSguardo && fine < n - 1) {
      let k = fine + 1;
      for (;;) {
        const o = p[cas[k]];
        if (o !== 0 && o !== v.id && opposti(st.prenDir[cas[k]], G.direzione(m, cas[k - 1], cas[k]))) { v.bloccatoDa = o; v.morbido = true; return false; }
        if (puntoDiAttesa(st, cas, k)) break;
        k++;
      }
    }
    for (let k = v.limite + 1; k <= fine; k++) G.prendiCasella(st, v, cas[k], v.odo0 + v.lun[k], G.direzione(m, cas[k - 1], cas[k]));
    v.limite = fine; v.bloccatoDa = 0; v.attesaSegnale = 0; v.stallo = false; v.ignoraSguardo = false; v.morbido = false; v.ricalcolo = -1;
    st.versionePren = (st.versionePren || 0) + 1;
    return true;
  };

  // ---------------------------------------------------------------- percorso dei treni
  // A* sui binari dove lo stato è (casella, direzione di arrivo): una curva di più di 90° fra una casella e
  // l'altra (un'inversione a gomito sugli scambi) costa moltissimo, così il treno la fa solo se non c'è altra
  // strada (per esempio una diramazione presa "contromano"). Alla partenza (dir = -1) può andare in qualsiasi
  // direzione, come quando cambia senso in stazione. extra(i, d) = costo in più per entrare nella casella i in direzione d.
  // I buffer si riusano: si chiama spesso.
  // Gli stati si numerano solo sulle caselle con binari (indice ricostruito quando la rete cambia):
  // sulle mappe reali, grandi, un array per ogni casella e direzione occuperebbe decine di MB.
  let buf = null, indice = null;
  function indiceBinari(st) {
    const m = st.mondo;
    if (indice && indice.mondo === m && indice.ver === st.versioneRete) return indice;
    const pos = indice && indice.mondo === m ? indice.pos : new Int32Array(m.N);
    const celle = [];
    for (let i = 0; i < m.N; i++) if (m.mBin[i]) { pos[i] = celle.length; celle.push(i); } else pos[i] = -1;
    indice = { mondo: m, ver: st.versioneRete, pos, celle };
    return indice;
  }
  // b = casella d'arrivo, oppure un elenco di caselle (va bene la prima che si raggiunge: i binari di una stazione)
  function cercaBinario(st, a, b, dir, extra) {
    const mete = Array.isArray(b) ? b : [b];
    const m = st.mondo, W = m.W, X = indiceBinari(st), pos = X.pos, celle = X.celle, S = celle.length * 9;
    if (pos[a] < 0) return null;
    if (!buf || buf.S < S) {
      const n = Math.ceil(S * 1.5) + 900;
      buf = { S: n, g: new Float64Array(n), da: new Int32Array(n), visto: new Uint32Array(n), chiuso: new Uint32Array(n), giro: 0 };
    }
    const B = buf;
    if (++B.giro > 4e9) { B.visto.fill(0); B.chiuso.fill(0); B.giro = 1; }
    const giro = B.giro;
    const h = i => {
      let min = Infinity;
      for (const b of mete) {
        const dx = Math.abs(i % W - b % W), dy = Math.abs(((i / W) | 0) - ((b / W) | 0));
        const d = Math.max(dx, dy) + 0.414 * Math.min(dx, dy);
        if (d < min) min = d;
      }
      return min;
    };
    const coda = new G.Coda();
    const s0 = pos[a] * 9 + (dir >= 0 ? dir : 8);
    B.g[s0] = 0; B.da[s0] = -1; B.visto[s0] = giro; coda.metti(s0, h(a));
    let fine = -1;
    while (!coda.vuota()) {
      const s = coda.togli();
      if (B.chiuso[s] === giro) continue;
      B.chiuso[s] = giro;
      const i = celle[(s / 9) | 0], din = s % 9;
      if (mete.includes(i)) { fine = s; break; }
      const mk = m.mBin[i];
      for (let d = 0; d < 8; d++) {
        if (!((mk >> d) & 1)) continue;
        let inversione = 0;
        if (din < 8) { const giro8 = Math.abs(d - din); if (Math.min(giro8, 8 - giro8) > 2) inversione = INVERSIONE; }
        const j = G.vicino(m, i, d);
        if (j < 0 || pos[j] < 0) continue;
        const sj = pos[j] * 9 + d;
        if (B.chiuso[sj] === giro) continue;
        let f = 1;
        const t = m.tipo[j];
        if (t === G.T.COLLINA) f = 1.15; else if (t === G.T.MONTAGNA) f = 1.35;
        let ng = B.g[s] + G.LUN[d] * f + inversione;
        if (extra) ng += extra(j, d);
        if (B.visto[sj] !== giro || ng < B.g[sj]) { B.visto[sj] = giro; B.g[sj] = ng; B.da[sj] = s; coda.metti(sj, ng + h(j)); }
      }
    }
    if (fine < 0) return null;
    const cas = [];
    for (let s = fine; s !== -1; s = B.da[s]) cas.push(celle[(s / 9) | 0]);
    cas.reverse();
    return { caselle: cas, costo: B.g[fine] };
  }

  // percorso più breve senza tener conto degli altri treni (in memoria finché la rete non cambia)
  G.cercaPercorsoTreno = function (st, a, b) {
    if (st._cacheVer !== st.versioneRete) { st._cache = new Map(); st._cacheVer = st.versioneRete; }
    const chiave = 'T:' + a + ':' + b;
    if (!st._cache.has(chiave)) {
      const r = st.mondo.mBin[a] && st.mondo.mBin[b] ? cercaBinario(st, a, b, -1, null) : null;
      st._cache.set(chiave, r && r.caselle);
    }
    return st._cache.get(chiave);
  };

  // binari di stazione dove c'è già un treno fermo o diretto (per scegliere, se c'è, un binario libero)
  function binariStazioneOccupati(st, v) {
    const occ = new Set(), m = st.mondo;
    for (const w of st.veicoli) {
      if (w === v || w.tipo !== 'treno') continue;
      if (w.stato === 'sosta' && m.occ[w.tile] === OCC.STAZIONE) occ.add(w.tile);
      else if (w.stato === 'viaggio' && w.caselle) occ.add(w.caselle[w.caselle.length - 1]);
    }
    return occ;
  }

  function occupatoDaAltri(st, v, cas, binariOccupati) {
    const p = pren(st);
    for (const i of cas) if ((p[i] !== 0 && p[i] !== v.id) || binariOccupati.has(i)) return true;
    return false;
  }

  // percorso del treno fino alla stazione: quello solito (in memoria) se è libero,
  // altrimenti uno che preferisce i binari liberi (binari paralleli, raddoppi, altri binari della stazione)
  // dir = direzione in cui sta andando il treno (-1 se parte da fermo in stazione e può cambiare senso)
  G.percorsoTreno = function (st, da, s, v, dir) {
    const binariOccupati = binariStazioneOccupati(st, v), p = pren(st);
    if (dir === undefined || dir < 0) {
      dir = -1;
      const solito = G.percorsoVersoStazione(st, da, s, 'binario');
      if (!solito || !occupatoDaAltri(st, v, solito, binariOccupati)) return solito;
    }
    const pd = st.prenDir;
    const extra = (j, d) => (p[j] !== 0 && p[j] !== v.id ? (opposti(pd[j], d) ? CONTROMANO : PENALITA) : 0) + (binariOccupati.has(j) ? BINARIO_OCCUPATO : 0);
    const binari = G.caselleStazione(st, s).filter(i => st.mondo.mBin[i]);
    const r = binari.length ? cercaBinario(st, da, binari, dir, extra) : null;
    return r && r.caselle;
  };

  // ---------------------------------------------------------------- stalli
  // Se una catena di treni in attesa torna su sé stessa nessuno può più muoversi.
  // Se nel giro c'è un'attesa "morbida" (prudenza, non binario occupato) quel treno va avanti e basta;
  // altrimenti è uno stallo vero: il gioco non lo risolve da solo, lo segnala. Tocca al giocatore
  // rimandare indietro uno dei treni (pulsante «Torna indietro») e costruire un raddoppio.
  const piuPaziente = el => el.reduce((a, b) => (b.attesaSegnale > a.attesaSegnale ? b : a));
  G.controllaStalli = function (st) {
    const perId = new Map();
    for (const v of st.veicoli) if (v.tipo === 'treno') perId.set(v.id, v);
    const inAttesa = v => v && v.stato === 'viaggio' && v.bloccatoDa && !v.ignoraSguardo &&
      v.attesaSegnale > (v.morbido ? 0 : 1 / 24); // stallo vero solo dopo un'ora: prima si cercano altre strade
    for (const v of st.veicoli) {
      if (!inAttesa(v)) continue;
      const catena = [v];
      let w = perId.get(v.bloccatoDa);
      while (inAttesa(w) && !catena.includes(w) && catena.length <= perId.size) { catena.push(w); w = perId.get(w.bloccatoDa); }
      if (!w || !catena.includes(w)) continue;
      const ciclo = catena.slice(catena.indexOf(w));
      const morbidi = ciclo.filter(k => k.morbido);
      if (morbidi.length) { piuPaziente(morbidi).ignoraSguardo = true; continue; }
      if (ciclo.every(k => k.stallo)) continue; // già segnalato
      for (const k of ciclo) k.stallo = true;
      st.stalli = (st.stalli || 0) + 1;
      const nomi = ciclo.map(G.nomeMezzo), e = _(' e ');
      const elenco = nomi.length === 2 ? nomi.join(e) : nomi.slice(0, -1).join(', ') + e + nomi[nomi.length - 1];
      G.notizia(st, _`Stallo sui binari: ${elenco} si bloccano a vicenda. Seleziona uno dei treni e premi «Torna indietro»; per il futuro costruisci un binario d'incrocio o una linea doppia.`, v.x, v.y);
    }
  };
})();
