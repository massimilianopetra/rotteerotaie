// Avvio, ciclo principale (tempo di gioco e disegno), nuova partita, salvataggio nel browser.
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO;
  const cv = document.getElementById('mappa'), ctx = cv.getContext('2d');
  const mini = document.getElementById('mini');
  const CHIAVE = 'rotaie-e-rotte-salvataggio';
  const GRIGLIE = ['tipo', 'bosco', 'occ', 'rif', 'liv', 'cittaDi', 'mBin', 'mStr', 'tipoStr', 'strCitta', 'copertura'];

  function ridimensiona() {
    const dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(cv.clientWidth * dpr); cv.height = Math.round(cv.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (G.st) {
      const m = G.st.mondo, w = mini.clientWidth;
      mini.style.height = Math.round(w * m.H / m.W) + 'px';
      mini.width = Math.round(w * dpr); mini.height = Math.round(w * m.H / m.W * dpr);
    }
  }
  window.addEventListener('resize', ridimensiona);

  // ---------------------------------------------------------------- tempo
  function avanza(st, dt) {
    G.aggiornaVeicoli(st, dt);
    st.giorno += dt;
    while (Math.floor(st.giorno) > st.giornoInt) {
      st.giornoInt++;
      const prima = G.data(st, st.giornoInt - 1), ora = G.data(st, st.giornoInt);
      G.giornaliero(st);
      if (ora.mese !== prima.mese) G.mensile(st);
      if (ora.anno !== prima.anno) G.annuale(st, ora.anno);
    }
  }
  G.avanza = function (st, giorni) { // usato anche per le prove
    while (giorni > 0) { const p = Math.min(giorni, 0.25); avanza(st, p); giorni -= p; }
  };

  let ultimo = performance.now();
  function ciclo(ora) {
    const dtReale = Math.min(0.1, (ora - ultimo) / 1000);
    ultimo = ora;
    const st = G.st;
    if (st) {
      G.avanza(st, C.velocita[G.ui.velocita] * dtReale);
      for (const e of st.effetti) e.t += dtReale;
      st.effetti = st.effetti.filter(e => e.t < 2.5);
      G.ui.aggiornaCamera(dtReale);
      G.disegna(st, ctx, cv.clientWidth, cv.clientHeight, G.ui);
      G.disegnaMinimappa(st, mini, cv.clientWidth, cv.clientHeight);
    }
    requestAnimationFrame(ciclo);
  }

  // ---------------------------------------------------------------- partite
  function avvia(st) {
    G.st = st;
    G.preparaTerreno(st);
    G.aggiornaServizi(st);
    const capitale = [...st.citta].sort((a, b) => b.pop - a.pop)[0];
    if (capitale) G.vaiA(capitale.x + 0.5, capitale.y + 0.5, 18);
    ridimensiona();
    G.ui.nuovaPartitaPronta();
    G.debug = { st, G, C };
  }

  G.nuovaPartita = function (opz) {
    const st = G.generaMondo(opz);
    G.notizia(st, `Nasce la ${opz.nome}! Hai ${G.lire(st.soldi)} per cominciare: collega le città e porta le merci alle industrie. Premi H per l'aiuto.`);
    avvia(st);
  };

  // ---------------------------------------------------------------- salvataggio (localStorage)
  function inBase64(arr) {
    const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function daBase64(s, Tipo) {
    const bin = atob(s), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Tipo(u8.buffer);
  }

  G.salvaPartita = function (st) {
    const griglie = {};
    for (const k of GRIGLIE) griglie[k] = inBase64(st.mondo[k]);
    const stato = {};
    for (const k of ['citta', 'industrie', 'stazioni', 'soldi', 'prestito', 'giorno', 'giornoInt', 'versioneRete',
      'conti', 'notizie', 'contatori', 'valoreInfra', 'mesiInRosso', 'industrieIniziali']) stato[k] = st[k];
    stato.veicoli = st.veicoli.map(v => Object.assign({}, v, { punti: null, lun: null, caselle: null }));
    try {
      localStorage.setItem(CHIAVE, JSON.stringify({ versione: 1, opz: st.opz, stato, griglie }));
      return null;
    } catch (e) {
      return 'Impossibile salvare: ' + e.message;
    }
  };
  G.salvaAutomatico = st => G.salvaPartita(st);

  G.esisteSalvataggio = function () {
    try { return !!localStorage.getItem(CHIAVE); } catch (e) { return false; }
  };

  G.caricaPartita = function () {
    let dati;
    try { dati = JSON.parse(localStorage.getItem(CHIAVE)); } catch (e) { return 'Salvataggio illeggibile'; }
    if (!dati) return 'Nessuna partita salvata';
    const m = G.generaTerreno(dati.opz);
    for (const k of GRIGLIE) m[k] = daBase64(dati.griglie[k], m[k].constructor);
    const st = Object.assign(G.statoVuoto(dati.opz, m), dati.stato);
    avvia(st);
    G.riprendiVeicoli(st);
    return null;
  };

  // ---------------------------------------------------------------- avvio
  G.ui.prepara();
  ridimensiona();
  requestAnimationFrame(ciclo);
  // #rapida (anche #rapida,seme=123) salta il menu: comodo per le prove
  const h = location.hash;
  if (h.includes('rapida')) {
    const ms = /seme=(\d+)/.exec(h);
    G.nuovaPartita({ nome: 'Ferrovie Riunite', anno: 1850, W: 192, H: 144, numCitta: 14, seme: ms ? +ms[1] : 12345 });
  } else G.ui.finestraMenu(true);
})();
