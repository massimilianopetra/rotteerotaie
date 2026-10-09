// Economia: calendario, conti, stazioni e loro bacino, produzione di città e industrie,
// crescita delle città, eventi del mese e dell'anno.
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO;
  const OCC = G.OCC;

  // ---------------------------------------------------------------- conti
  G.nuovoConto = () => ({ entrate: {}, uscite: {} });
  // conto del mese in corso (entrate, uscite, unità consegnate per merce): si chiude in G.mensile e va in
  // st.conti.mesi, la storia mese per mese dei grafici del quadro di gestione (le partite vecchie non l'hanno)
  G.contoMese = function (st) {
    const co = st.conti;
    if (!co.mesi) co.mesi = [];
    if (!co.mese) co.mese = { entrate: {}, uscite: {}, unita: {} };
    return co.mese;
  };
  G.incassa = function (st, lire, voce) {
    st.soldi += lire;
    const e = st.conti.corrente.entrate, m = G.contoMese(st).entrate;
    e[voce] = (e[voce] || 0) + lire;
    m[voce] = (m[voce] || 0) + lire;
  };
  G.spendi = function (st, lire, voce) {
    st.soldi -= lire;
    const u = st.conti.corrente.uscite, m = G.contoMese(st).uscite;
    u[voce] = (u[voce] || 0) + lire;
    m[voce] = (m[voce] || 0) + lire;
  };
  G.somma = o => Object.values(o).reduce((a, b) => a + b, 0);

  // Le voci del conto si dividono in due famiglie:
  // - gestione: ricavi delle consegne e costi che si pagano sempre (esercizio dei mezzi, manutenzione, interessi);
  //   profitto = ricavi − costi: dice se la compagnia guadagna;
  // - investimenti: costruzioni e acquisto di mezzi meno le vendite dei mezzi: spese una tantum che restano
  //   nel valore dell'azienda. Saldo di cassa = profitto − investimenti.
  G.VOCI_INVESTIMENTO = ['costruzione', 'veicoli'];
  G.bilancio = function (conto) {
    const e = conto.entrate || {}, u = conto.uscite || {};
    let ricavi = 0, costi = 0, investimenti = 0;
    for (const k in e) if (k === 'vendite') investimenti -= e[k]; else ricavi += e[k];
    for (const k in u) if (G.VOCI_INVESTIMENTO.includes(k)) investimenti += u[k]; else costi += u[k];
    return { ricavi, costi, profitto: ricavi - costi, investimenti, cassa: ricavi - costi - investimenti };
  };
  G.lire = n => (n < 0 ? '−' : '') + 'L. ' + Math.abs(Math.round(n)).toLocaleString('it-IT');
  G.numero = n => Math.round(n).toLocaleString('it-IT');

  G.valoreAzienda = function (st) {
    let v = st.soldi - st.prestito + st.valoreInfra;
    for (const veic of st.veicoli) v += G.valoreVeicolo(veic);
    return v;
  };

  G.prendiPrestito = function (st) {
    const p = C.inizio.passoPrestito;
    if (st.prestito + p > C.inizio.prestitoMax) return 'Hai raggiunto il prestito massimo';
    st.prestito += p; st.soldi += p;
    return null;
  };
  G.rendiPrestito = function (st) {
    const p = Math.min(C.inizio.passoPrestito, st.prestito);
    if (p <= 0) return 'Non hai debiti';
    if (st.soldi < p) return 'Fondi insufficienti';
    st.prestito -= p; st.soldi -= p;
    return null;
  };

  // ---------------------------------------------------------------- calendario
  const MESI = G.MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  G.data = function (st, giorno) {
    const g = Math.floor(giorno === undefined ? st.giorno : giorno);
    const d = new Date(Date.UTC(st.opz.anno, 0, 1) + g * 86400000);
    return { anno: d.getUTCFullYear(), mese: d.getUTCMonth(), giorno: d.getUTCDate() };
  };
  G.testoData = function (st, g) { const d = G.data(st, g); return `${d.giorno} ${MESI[d.mese]} ${d.anno}`; };
  G.testoOra = function (st) {
    const min = Math.floor((st.giorno - Math.floor(st.giorno)) * 1440);
    return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
  };
  G.anno = st => G.data(st).anno;

  G.notizia = function (st, testo, x, y) {
    const n = { data: G.testoData(st), testo, x, y };
    st.notizie.unshift(n);
    if (st.notizie.length > 80) st.notizie.length = 80;
    if (G.suNotizia) G.suNotizia(n);
  };

  // ---------------------------------------------------------------- stazioni
  // dati di catalogo di una stazione: per le ferroviarie contano anche le dimensioni (taglia)
  G.defStazione = function (tipo, taglia) {
    if (typeof tipo === 'object') { taglia = tipo.taglia; tipo = tipo.tipo; }
    const def = C.stazioni[tipo];
    if (tipo !== 'stazione') return def;
    const t = C.taglieStazione[taglia] || C.taglieStazione.media;
    return Object.assign({}, def, t, { taglia: taglia in C.taglieStazione ? taglia : 'media' });
  };
  G.nomeTipoStazione = s => s.tipo === 'stazione' ? 'Stazione ferroviaria · ' + G.defStazione(s).breve.toLowerCase() : C.stazioni[s.tipo].nome;

  G.centroStazione = s => ({ x: s.x + s.lato / 2, y: s.y + s.lato / 2 });
  G.caselleStazione = function (st, s) {
    const W = st.mondo.W, el = [];
    for (let dy = 0; dy < s.lato; dy++) for (let dx = 0; dx < s.lato; dx++) el.push((s.y + dy) * W + s.x + dx);
    return el;
  };
  // una casella della stazione toccata dalla rete giusta (binari per le ferroviarie, strade per le autostazioni)
  G.casellaStazione = function (st, s) {
    const m = st.mondo, mask = s.tipo === 'stazione' ? m.mBin : s.tipo === 'deposito' ? m.mStr : null;
    const el = G.caselleStazione(st, s);
    if (mask) for (const i of el) if (mask[i]) return i;
    return el[0];
  };
  // la stazione è collegata se almeno una sua casella ha un binario (o una strada)
  G.stazioneCollegata = function (st, s) {
    if (s.tipo === 'aeroporto') return true;
    const m = st.mondo, mask = s.tipo === 'stazione' ? m.mBin : m.mStr;
    return G.caselleStazione(st, s).some(i => mask[i]);
  };

  G.bacino = function (st, s) {
    const m = st.mondo, r = G.defStazione(s).raggio;
    return {
      x0: Math.max(0, s.x - r), y0: Math.max(0, s.y - r),
      x1: Math.min(m.W - 1, s.x + s.lato - 1 + r), y1: Math.min(m.H - 1, s.y + s.lato - 1 + r)
    };
  };

  G.puoCostruireStazione = function (st, tipo, x, y, taglia) {
    const def = G.defStazione(tipo, taglia), m = st.mondo, T = G.T;
    if (G.anno(st) < def.anno) return `${def.nome}: disponibile dal ${def.anno}`;
    let costo = def.costo;
    for (let dy = 0; dy < def.lato; dy++) for (let dx = 0; dx < def.lato; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= m.W || yy >= m.H) return 'Fuori dalla mappa';
      const i = yy * m.W + xx, t = m.tipo[i];
      if (t === T.ACQUA || t === T.FIUME) return "Non si costruisce sull'acqua";
      if (m.occ[i]) return 'Casella occupata';
      if (tipo === 'aeroporto' && (m.mBin[i] || m.mStr[i])) return 'Togli prima strade e binari';
      if (t === T.MONTAGNA) costo += def.costo * 0.5 / (def.lato * def.lato);
      if (m.bosco[i]) costo += C.costoBosco;
    }
    return { costo: Math.round(costo) };
  };

  function nomeStazione(st, s) {
    const c0 = G.centroStazione(s);
    const c = G.cittaVicina(st, c0.x, c0.y, 14);
    let base;
    if (c) {
      base = c.nome;
      const dx = c0.x - c.x - 0.5, dy = c0.y - c.y - 0.5;
      if (Math.hypot(dx, dy) > G.raggioCitta(c) * 0.6 + 1) {
        base += Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? ' Est' : ' Ovest') : (dy > 0 ? ' Sud' : ' Nord');
      }
    } else {
      const v = G.cittaVicina(st, c0.x, c0.y);
      const ind = st.industrie.find(k => !k.chiusa && Math.abs(k.x + 1 - c0.x) < 6 && Math.abs(k.y + 1 - c0.y) < 6);
      base = (v ? v.nome : 'Campagna') + ' ' + (ind ? C.industrie[ind.tipo].breve : 'Bivio');
    }
    const pre = s.tipo === 'aeroporto' ? 'Aeroporto di ' : s.tipo === 'deposito' ? 'Autostazione ' : s.taglia === 'fermata' ? 'Fermata ' : '';
    if (s.taglia === 'centrale') base += ' Centrale';
    let nome = pre + base, k = 1;
    while (st.stazioni.some(o => o && o !== s && o.nome === nome)) nome = pre + base + ' ' + (++k);
    return nome;
  }

  G.copertura = function (st, s, delta) {
    const m = st.mondo, b = G.bacino(st, s);
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) m.copertura[y * m.W + x] += delta;
  };

  // cosa c'è nel bacino: abitanti, industrie, merci accettate e fornite. Funziona anche su una stazione "finta"
  G.calcolaBacino = function (st, s) {
    const m = st.mondo, b = G.bacino(st, s), popLiv = C.case.pop;
    let pop = 0;
    const ind = new Set(), perCitta = {};
    for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
      const i = y * m.W + x;
      if (m.occ[i] === OCC.CASA) {
        pop += popLiv[m.liv[i]];
        perCitta[m.cittaDi[i]] = (perCitta[m.cittaDi[i]] || 0) + popLiv[m.liv[i]];
      } else if (m.occ[i] === OCC.INDUSTRIA) ind.add(m.rif[i]);
    }
    const r = { pop, industrie: [...ind].filter(id => !st.industrie[id].chiusa), accetta: {}, fornisce: {}, citta: -1 };
    for (const k of Object.keys(C.accettazione)) if (pop >= C.accettazione[k]) r.accetta[k] = true;
    if (pop > 0) { r.fornisce.passeggeri = true; r.fornisce.posta = true; }
    for (const id of r.industrie) {
      const def = C.industrie[st.industrie[id].tipo];
      for (const a of def.accetta || []) r.accetta[a] = true;
      if (def.produce) r.fornisce[def.produce] = true;
      if (def.uscita) r.fornisce[def.uscita] = true;
    }
    let best = 0;
    for (const id in perCitta) if (perCitta[id] > best) { best = perCitta[id]; r.citta = +id; }
    if (r.citta < 0) {
      const c0 = G.centroStazione(s), c = G.cittaVicina(st, c0.x, c0.y, 14);
      if (c) r.citta = c.id;
    }
    if (s.tipo === 'aeroporto') { // gli aerei portano solo passeggeri e posta
      for (const k of Object.keys(r.accetta)) if (k !== 'passeggeri' && k !== 'posta') delete r.accetta[k];
      for (const k of Object.keys(r.fornisce)) if (k !== 'passeggeri' && k !== 'posta') delete r.fornisce[k];
    }
    return r;
  };

  G.aggiornaBacino = function (st, s) {
    const r = G.calcolaBacino(st, s);
    s.popBacino = r.pop; s.industrie = r.industrie; s.accetta = r.accetta; s.fornisce = r.fornisce; s.citta = r.citta;
  };

  // per ogni industria, quali stazioni la coprono
  G.aggiornaIndustrieStazioni = function (st) {
    for (const ind of st.industrie) ind.stazioni = [];
    for (const s of st.stazioni) if (s) for (const id of s.industrie) st.industrie[id].stazioni.push(s.id);
  };

  G.costruisciStazione = function (st, tipo, x, y, taglia) {
    const r = G.puoCostruireStazione(st, tipo, x, y, taglia);
    if (typeof r === 'string') return r;
    if (st.soldi < r.costo) return 'Fondi insufficienti';
    const def = G.defStazione(tipo, taglia), m = st.mondo;
    const s = {
      id: st.stazioni.length, tipo, x, y, lato: def.lato, nome: '',
      attesa: {}, ultimoRitiro: {}, accetta: {}, fornisce: {}, servite: {}, industrie: [],
      popBacino: 0, citta: -1, primoArrivo: false
    };
    if (tipo === 'stazione') s.taglia = def.taglia;
    st.stazioni.push(s);
    for (let dy = 0; dy < def.lato; dy++) for (let dx = 0; dx < def.lato; dx++) {
      const i = (y + dy) * m.W + x + dx;
      m.occ[i] = OCC.STAZIONE; m.rif[i] = s.id;
      if (m.bosco[i]) { m.bosco[i] = 0; st.sporchi.push(i); }
    }
    s.nome = nomeStazione(st, s);
    G.copertura(st, s, +1);
    G.aggiornaBacino(st, s);
    G.aggiornaIndustrieStazioni(st);
    G.spendi(st, r.costo, 'costruzione');
    st.valoreInfra += r.costo * 0.5;
    G.reteCambiata(st);
    return s;
  };

  G.demolisciStazione = function (st, id) {
    const s = st.stazioni[id], m = st.mondo;
    if (st.soldi < C.costoDemolizione) return 'Fondi insufficienti';
    for (const v of st.veicoli) G.togliFermateStazione(st, v, id);
    G.copertura(st, s, -1);
    for (let dy = 0; dy < s.lato; dy++) for (let dx = 0; dx < s.lato; dx++) {
      const i = (s.y + dy) * m.W + s.x + dx;
      m.occ[i] = OCC.LIBERO; m.rif[i] = -1;
    }
    st.stazioni[id] = null;
    G.spendi(st, C.costoDemolizione, 'costruzione');
    G.aggiornaIndustrieStazioni(st);
    G.aggiornaServizi(st);
    G.reteCambiata(st);
    return null;
  };

  // quali merci vengono ritirate in ogni stazione (secondo i percorsi dei veicoli)
  G.aggiornaServizi = function (st) {
    for (const s of st.stazioni) if (s) s.servite = {};
    for (const v of st.veicoli) for (const f of v.fermate) {
      const s = st.stazioni[f.s];
      if (!s || s.servite[v.merce]) continue;
      s.servite[v.merce] = true;
      if (s.ultimoRitiro[v.merce] === undefined) s.ultimoRitiro[v.merce] = st.giornoInt;
    }
    for (const c of st.citta) c.nServite = 0;
    for (const s of st.stazioni) {
      if (s && s.citta >= 0 && Object.keys(s.servite).length) st.citta[s.citta].nServite++;
    }
  };

  // valutazione 0..1: quanta della produzione arriva alla stazione
  G.valutazione = function (st, s, merce) {
    const ult = s.ultimoRitiro[merce];
    if (ult === undefined) return 0;
    const gg = st.giornoInt - ult;
    let v = 0.33 + 0.45 * Math.max(0, 1 - gg / 45);
    const a = s.attesa[merce] || 0;
    if (a < 60) v += 0.17; else if (a < 200) v += 0.08; else if (a > 500) v -= 0.1;
    return Math.max(0.05, Math.min(1, v));
  };

  G.aggiungiAttesa = function (st, s, merce, q) {
    s.attesa[merce] = Math.min(5000, (s.attesa[merce] || 0) + q);
  };

  // merce scaricata in una stazione che la accetta
  G.consegna = function (st, s, merce, q) {
    const u = G.contoMese(st).unita;
    u[merce] = (u[merce] || 0) + q;
    if (s.citta >= 0) {
      const c = st.citta[s.citta];
      if (merce === 'passeggeri') c.mese.arrivati += q;
      else if (c.mese[merce] !== undefined) c.mese[merce] += q;
    }
    const ind = s.industrie.map(id => st.industrie[id]).filter(k => !k.chiusa && (C.industrie[k.tipo].accetta || []).includes(merce));
    for (const k of ind) {
      const parte = q / ind.length, def = C.industrie[k.tipo];
      k.ricevuto[merce] = (k.ricevuto[merce] || 0) + parte;
      if (def.uscita) k.inUscita += parte * def.resa;
    }
  };

  // ---------------------------------------------------------------- produzione (ogni ora: f = frazione di giorno)
  G.produzione = function (st, f) {
    const m = st.mondo, pc = C.produzioneCitta, popLiv = C.case.pop;
    // le case producono passeggeri e posta per le stazioni che li ritirano
    for (const s of st.stazioni) {
      if (!s || (!s.servite.passeggeri && !s.servite.posta)) continue;
      const b = G.bacino(st, s);
      let pop = 0;
      for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) {
        const i = y * m.W + x;
        if (m.occ[i] === OCC.CASA) pop += popLiv[m.liv[i]] / m.copertura[i];
      }
      for (const merce of ['passeggeri', 'posta']) {
        if (s.servite[merce]) G.aggiungiAttesa(st, s, merce, pop * pc[merce] * f * G.valutazione(st, s, merce));
      }
    }
    // le industrie producono; la parte trasportata va alle stazioni che servono la merce
    for (const ind of st.industrie) {
      if (ind.chiusa) continue;
      const def = C.industrie[ind.tipo];
      let q = 0, merce = null;
      if (def.produce) {
        merce = def.produce;
        q = ind.produzione / 30 * f;
        if (def.riserva) {
          if (ind.riserva < ind.riservaIniziale * 0.15) q *= 0.6;
          q = Math.min(q, ind.riserva);
          ind.riserva -= q;
        }
      } else if (def.uscita) {
        merce = def.uscita; q = ind.inUscita; ind.inUscita = 0;
      }
      if (q > 0) {
        ind.prodMese += q;
        let somma = 0, migliore = 0;
        const el = [];
        for (const sid of ind.stazioni) {
          const s = st.stazioni[sid];
          if (!s || !s.servite[merce]) continue;
          const v = G.valutazione(st, s, merce);
          el.push([s, v]); somma += v; if (v > migliore) migliore = v;
        }
        if (el.length) {
          const tras = q * migliore;
          ind.trasMese += tras;
          for (const [s, v] of el) G.aggiungiAttesa(st, s, merce, tras * v / somma);
        }
      }
      if (def.riserva && ind.riserva <= 0) chiudiIndustria(st, ind);
    }
  };

  // ---------------------------------------------------------------- un giorno
  G.giornaliero = function (st) {
    // la merce che aspetta troppo si rovina un po'
    for (const s of st.stazioni) if (s) for (const k in s.attesa) if (s.attesa[k] > 300) s.attesa[k] *= 0.997;
  };

  function chiudiIndustria(st, ind) {
    const m = st.mondo;
    ind.chiusa = true;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = (ind.y + dy) * m.W + ind.x + dx;
      m.occ[i] = OCC.LIBERO; m.rif[i] = -1;
    }
    for (const s of st.stazioni) if (s) G.aggiornaBacino(st, s);
    G.aggiornaIndustrieStazioni(st);
    st.minimappaSporca = true;
    G.notizia(st, `${ind.nome} ha esaurito il giacimento e chiude.`, ind.x + 1, ind.y + 1);
  }

  // ---------------------------------------------------------------- un mese
  G.cresciCitta = function (st, c, rnd) {
    const ms = c.mese;
    // punti di crescita del mese: ogni punto è una casa nuova o più grande
    let punti = 0.05 + 0.15 * c.nServite + ms.partiti / 3000 + ms.arrivati / 4000 + ms.posta / 2400 +
      ms.merci / 100 + ms.cibo / 100 + ms.carburante / 150;
    punti = Math.min(punti, 10);
    const n = Math.floor(punti) + (rnd() < punti % 1 ? 1 : 0);
    const prima = c.pop;
    const vicine = st.stazioni.filter(s => s && s.citta === c.id && Object.keys(s.servite).length);
    for (let k = 0; k < n; k++) {
      const r = rnd();
      if (r < 0.3 && G.miglioraCasa(st, c, rnd)) continue;
      if (vicine.length && r < 0.6) { // le stazioni attirano case nuove
        const s = rnd.scegli(vicine);
        if (G.aggiungiCasa(st, c, rnd, 0, s.x + (s.lato - 1) / 2, s.y + (s.lato - 1) / 2, 3.5)) continue;
      }
      if (!G.aggiungiCasa(st, c, rnd, 0)) G.estendiStrada(st, c, rnd);
    }
    c.crescita = c.pop - prima;
    for (const t of [1000, 2500, 5000, 10000, 25000]) {
      if (prima < t && c.pop >= t) {
        const cl = G.classeCitta(c.pop), art = cl === 'villaggio' || cl === 'paese' ? 'un' : 'una';
        G.notizia(st, `${c.nome} supera i ${G.numero(t)} abitanti: ora è ${art} ${cl}!`, c.x, c.y);
      }
    }
  };

  G.costiInfrastruttura = function (st) {
    const m = st.mondo;
    let bin = 0, str = 0, aut = 0, staz = 0;
    for (let i = 0; i < m.N; i++) {
      if (m.mBin[i]) bin++;
      if (m.mStr[i] && !m.strCitta[i]) { if (m.tipoStr[i] === 2) aut++; else str++; }
    }
    for (const s of st.stazioni) if (s) staz += G.defStazione(s).manutenzione;
    const km = G.kmCasella(st); // la manutenzione è a chilometro
    bin *= km; str *= km; aut *= km;
    return {
      binari: bin * C.reti.binario.manutenzione,
      strade: str * C.reti.strada.manutenzione + aut * C.reti.autostrada.manutenzione,
      stazioni: staz
    };
  };

  G.mensile = function (st) {
    // con migliaia di città (mappe reali) si tengono 20 anni di storia, altrimenti 50: il salvataggio resta piccolo
    const maxStorico = st.citta.length > 300 ? 240 : 600;
    const rnd = G.casualeLibero;
    for (const c of st.citta) {
      G.cresciCitta(st, c, rnd);
      c.meseScorso = c.mese; c.mese = G.nuovoMese();
      c.storico.push(c.pop);
      if (c.storico.length > maxStorico) c.storico.shift();
    }
    for (const s of st.stazioni) if (s) G.aggiornaBacino(st, s);
    G.aggiornaIndustrieStazioni(st);
    G.aggiornaServizi(st);
    for (const ind of st.industrie) {
      if (ind.chiusa) continue;
      const def = C.industrie[ind.tipo];
      ind.perc = ind.prodMese > 0 ? ind.trasMese / ind.prodMese : 0;
      ind.prodScorso = ind.prodMese; ind.prodMese = 0; ind.trasMese = 0;
      ind.ricevutoScorso = ind.ricevuto; ind.ricevuto = {};
      if (def.produce) {
        if (ind.perc > 0.6 && rnd() < 0.05) {
          ind.produzione = Math.round(ind.produzione * 1.25);
          G.notizia(st, `${ind.nome}: ben servita, aumenta la produzione a ${ind.produzione} ${C.merci[def.produce].unita} al mese.`, ind.x + 1, ind.y + 1);
        } else if (ind.perc < 0.05 && ind.produzione > 20 && rnd() < 0.015) {
          ind.produzione = Math.round(ind.produzione * 0.8);
        }
      }
    }
    // spese del mese
    let esercizio = 0;
    for (const v of st.veicoli) {
      const c = G.esercizioVeicolo(v) / 12;
      esercizio += c; G.contoVeicolo(v, 0, c);
    }
    if (esercizio) G.spendi(st, esercizio, 'esercizio');
    const inf = G.costiInfrastruttura(st);
    const man = G.somma(inf) / 12;
    if (man) G.spendi(st, man, 'manutenzione');
    if (st.prestito) G.spendi(st, st.prestito * C.inizio.interesse / 12, 'interessi');
    st.mesiInRosso = st.soldi < 0 ? st.mesiInRosso + 1 : 0;
    if (st.mesiInRosso === 3) G.notizia(st, 'Attenzione: i conti sono in rosso da tre mesi! Chiedi un prestito o vendi qualche veicolo.');
    st.minimappaSporca = true;
    // si chiude il conto del mese appena finito (con le spese qui sopra) e se ne apre uno nuovo: 20 anni di storia
    const cm = G.contoMese(st), d = G.data(st, st.giornoInt - 1), tondi = o => { for (const k in o) o[k] = Math.round(o[k]); return o; };
    st.conti.mesi.push({ anno: d.anno, mese: d.mese, entrate: tondi(cm.entrate), uscite: tondi(cm.uscite), unita: tondi(cm.unita),
      soldi: Math.round(st.soldi), valore: Math.round(G.valoreAzienda(st)), prestito: st.prestito });
    if (st.conti.mesi.length > 240) st.conti.mesi.shift();
    st.conti.mese = { entrate: {}, uscite: {}, unita: {} };
  };

  // ---------------------------------------------------------------- un anno
  G.annuale = function (st, anno) {
    const c = st.conti, vecchio = c.corrente;
    const b = G.bilancio(vecchio);
    c.storico.push({ anno: c.anno, entrate: vecchio.entrate, uscite: vecchio.uscite, soldi: st.soldi, valore: G.valoreAzienda(st) });
    if (c.storico.length > 40) c.storico.shift();
    c.anno = anno; c.corrente = G.nuovoConto();
    for (const v of st.veicoli) { G.chiudiAnnoVeicolo(v); v.eta++; }
    G.notizia(st, `Bilancio del ${anno - 1}: ricavi ${G.lire(b.ricavi)}, costi ${G.lire(b.costi)}, ` +
      `${b.profitto >= 0 ? 'profitto' : 'perdita'} di ${G.lire(Math.abs(b.profitto))}` +
      (b.investimenti > 0 ? `; investiti ${G.lire(b.investimenti)} in rete e mezzi` : '') + `. Valore dell'azienda: ${G.lire(G.valoreAzienda(st))}.`);
    for (const mod of C.veicoli) if (mod.anno === anno) G.notizia(st, `Novità del ${anno}: è in vendita ${mod.nome} (${mod.kmh} km/h).`);
    for (const k in C.reti) if (C.reti[k].anno === anno) G.notizia(st, `Da quest'anno si possono costruire le ${C.reti[k].nome.toLowerCase()}!`);
    for (const k in C.stazioni) if (C.stazioni[k].anno === anno) G.notizia(st, `Inizia l'era del volo: ora si possono costruire gli aeroporti!`);
    // nuove industrie: le miniere esaurite vengono rimpiazzate da nuovi giacimenti
    const rnd = G.casualeLibero;
    const tipi = Object.keys(C.industrie).filter(t => !C.industrie[t].dalAnno || C.industrie[t].dalAnno <= anno);
    // se le industrie aperte sono già tante, se ne aprono di nuove più di rado
    const aperte = st.industrie.filter(k => !k.chiusa).length;
    if (!st.industrieIniziali) st.industrieIniziali = aperte;
    const nuove = rnd() < (aperte < st.industrieIniziali * 1.15 ? 0.6 : 0.1) ? 1 : 0;
    for (let k = 0; k < nuove; k++) {
      const tipo = rnd.scegli(tipi), ind = G.fondaIndustria(st, tipo, rnd);
      if (ind) {
        const def = C.industrie[tipo];
        G.notizia(st, def.riserva ? `Scoperto un nuovo giacimento: apre ${ind.nome}.` : `Inaugurata ${ind.nome}.`, ind.x + 1, ind.y + 1);
        for (const s of st.stazioni) if (s) G.aggiornaBacino(st, s);
        G.aggiornaIndustrieStazioni(st);
      }
    }
    if (G.salvaAutomatico) G.salvaAutomatico(st);
  };

  // ---------------------------------------------------------------- il tempo che passa
  // i mezzi si muovono a piccoli passi; la produzione è oraria; poi giorno, mese e anno
  function passo(st, dt) {
    G.aggiornaVeicoli(st, dt);
    st.giorno += dt;
    while (Math.floor(st.giorno * 24) > st.oraInt) {
      st.oraInt++;
      G.produzione(st, 1 / 24);
      if (Math.floor(st.oraInt / 24) > st.giornoInt) {
        st.giornoInt++;
        const prima = G.data(st, st.giornoInt - 1), ora = G.data(st, st.giornoInt);
        G.giornaliero(st);
        if (ora.mese !== prima.mese) G.mensile(st);
        if (ora.anno !== prima.anno) G.annuale(st, ora.anno);
      }
    }
  }
  G.avanza = function (st, giorni) {
    const p = C.tempi.passoMinuti / 1440;
    if (st.oraInt === undefined) st.oraInt = Math.floor(st.giorno * 24);
    while (giorni > 1e-9) { const d = Math.min(giorni, p); passo(st, d); giorni -= d; }
  };
})();
