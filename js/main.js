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

  let ultimo = performance.now();
  function ciclo(ora) {
    const dtReale = Math.min(0.1, (ora - ultimo) / 1000);
    ultimo = ora;
    const st = G.st;
    if (st) {
      G.avanza(st, C.velocita[G.ui.velocita] / 1440 * dtReale); // velocita: minuti di gioco al secondo
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

  // opz.mappa = id di una mappa reale: prima si carica il suo file (solo quello), poi si crea il mondo.
  // fatto(errore) si chiama alla fine (errore = null se tutto bene).
  G.nuovaPartita = function (opz, fatto) {
    fatto = fatto || (e => { if (e) G.avviso(e, true); });
    const crea = () => {
      if (opz.mappa) {
        const R = window.MAPPE_REALI[opz.mappa];
        Object.assign(opz, { W: R.W, H: R.H, km: R.km, nomeMappa: R.nome });
      }
      const st = G.generaMondo(opz);
      G.notizia(st, `Nasce la ${opz.nome}${opz.mappa ? ' in ' + opz.nomeMappa : ''}! Hai ${G.lire(st.soldi)} per cominciare: collega le città e porta le merci alle industrie. Premi H per l'aiuto.`);
      avvia(st);
      fatto(null);
    };
    if (opz.mappa) G.caricaMappaReale(opz.mappa, e => (e ? fatto(e) : crea()));
    else crea();
  };

  // ---------------------------------------------------------------- salvataggio (localStorage)
  function inBase64(arr) {
    const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function byteDaBase64(s) {
    const bin = atob(s), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }

  // PackBits: le griglie sono quasi tutte zeri (o -1), le sequenze uguali diventano due byte.
  // Intestazione 0..127 = seguono n+1 byte copiati; 129..254 = il byte dopo si ripete 257-n volte.
  function impacca(u8) {
    const out = [], n = u8.length;
    let i = 0;
    while (i < n) {
      let r = 1;
      while (i + r < n && r < 128 && u8[i + r] === u8[i]) r++;
      if (r >= 3) { out.push(257 - r, u8[i]); i += r; continue; }
      let j = i;
      while (j < n && j - i < 128 && !(j + 2 < n && u8[j] === u8[j + 1] && u8[j] === u8[j + 2])) j++;
      out.push(j - i - 1);
      for (let k = i; k < j; k++) out.push(u8[k]);
      i = j;
    }
    return Uint8Array.from(out);
  }
  function spacchetta(b, lun) {
    const out = new Uint8Array(lun);
    let p = 0;
    for (let i = 0; i < b.length && p < lun;) {
      const h = b[i++];
      if (h < 128) { out.set(b.subarray(i, i + h + 1), p); p += h + 1; i += h + 1; } else { out.fill(b[i++], p, p + 257 - h); p += 257 - h; }
    }
    return out;
  }
  // griglia -> testo ("~" + PackBits in base64) e ritorno; le partite salvate prima hanno solo base64
  const grigliaInTesto = arr => '~' + inBase64(impacca(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)));
  function testoInGriglia(s, Tipo, n) {
    const u8 = s[0] === '~' ? spacchetta(byteDaBase64(s.slice(1)), n * Tipo.BYTES_PER_ELEMENT) : byteDaBase64(s);
    return new Tipo(u8.buffer);
  }

  // LZW sui byte UTF-8 del salvataggio: un codice (256..32767) per carattere della stringa salvata.
  // Con migliaia di città (mappe reali) il testo supererebbe i 5 MB che il browser concede.
  // Quando il dizionario è pieno si ricomincia da capo (lo fanno allo stesso punto chi comprime e chi decomprime).
  const LIMITE = 32768;
  function comprimi(testo) {
    const b = new TextEncoder().encode(testo), pezzi = [];
    if (!b.length) return '';
    let diz = new Map(), prossimo = 256, w = b[0], pezzo = [];
    const emetti = c => {
      pezzo.push(c + 32);
      if (pezzo.length === 8192) { pezzi.push(String.fromCharCode.apply(null, pezzo)); pezzo = []; }
    };
    for (let i = 1; i < b.length; i++) {
      const c = b[i], v = diz.get(w * 256 + c);
      if (v !== undefined) { w = v; continue; }
      emetti(w);
      if (prossimo < LIMITE) diz.set(w * 256 + c, prossimo++);
      else { diz = new Map(); prossimo = 256; }
      w = c;
    }
    emetti(w);
    pezzi.push(String.fromCharCode.apply(null, pezzo));
    return pezzi.join('');
  }
  function decomprimi(s) {
    if (!s.length) return '';
    // per ogni codice: prefisso, ultimo byte, primo byte, lunghezza
    const pre = new Int32Array(LIMITE), ult = new Uint8Array(LIMITE), primo = new Uint8Array(LIMITE), lun = new Int32Array(LIMITE);
    let out = new Uint8Array(s.length * 4 + 16), p = 0, prossimo = 256;
    const scrivi = c => {
      const L = c < 256 ? 1 : lun[c];
      if (p + L > out.length) { const n = new Uint8Array((p + L) * 2); n.set(out); out = n; }
      let q = p + L - 1;
      while (c >= 256) { out[q--] = ult[c]; c = pre[c]; }
      out[q] = c;
      p += L;
    };
    let prec = s.charCodeAt(0) - 32;
    scrivi(prec);
    for (let i = 1; i < s.length; i++) {
      const c = s.charCodeAt(i) - 32;
      if (prossimo === LIMITE) { prossimo = 256; scrivi(c); prec = c; continue; }
      const pc = prec < 256 ? prec : primo[prec];
      // c >= prossimo: è proprio il codice che si sta creando (prec + il suo primo byte)
      const inizio = c >= prossimo ? pc : (c < 256 ? c : primo[c]);
      pre[prossimo] = prec; ult[prossimo] = inizio; primo[prossimo] = pc; lun[prossimo] = (prec < 256 ? 1 : lun[prec]) + 1;
      prossimo++;
      scrivi(c);
      prec = c;
    }
    return new TextDecoder().decode(out.subarray(0, p));
  }
  G._prove = { comprimi, decomprimi, impacca, spacchetta }; // per le prove in Node

  G.salvaPartita = function (st) {
    const griglie = {};
    for (const k of GRIGLIE) griglie[k] = grigliaInTesto(st.mondo[k]);
    const stato = {};
    for (const k of ['citta', 'industrie', 'stazioni', 'soldi', 'prestito', 'giorno', 'giornoInt', 'oraInt', 'versioneRete',
      'conti', 'notizie', 'contatori', 'valoreInfra', 'mesiInRosso', 'industrieIniziali']) stato[k] = st[k];
    stato.veicoli = st.veicoli.map(v => Object.assign({}, v, { punti: null, lun: null, caselle: null, pr: [] }));
    try {
      localStorage.setItem(CHIAVE, 'Z1' + comprimi(JSON.stringify({ versione: 2, opz: st.opz, stato, griglie })));
      return null;
    } catch (e) {
      return 'Impossibile salvare: ' + e.message;
    }
  };
  G.salvaAutomatico = st => G.salvaPartita(st);

  G.esisteSalvataggio = function () {
    try { return !!localStorage.getItem(CHIAVE); } catch (e) { return false; }
  };

  // fatto(errore): sulle mappe reali bisogna prima caricare il file della mappa, quindi la risposta arriva dopo
  G.caricaPartita = function (fatto) {
    let dati;
    try {
      const t = localStorage.getItem(CHIAVE);
      dati = t && JSON.parse(t.startsWith('Z1') ? decomprimi(t.slice(2)) : t);
    } catch (e) { fatto('Salvataggio illeggibile'); return; }
    if (!dati) { fatto('Nessuna partita salvata'); return; }
    const prosegui = () => {
      const m = G.generaTerreno(dati.opz);
      for (const k of GRIGLIE) m[k] = testoInGriglia(dati.griglie[k], m[k].constructor, m.N);
      const st = Object.assign(G.statoVuoto(dati.opz, m), dati.stato);
      if (dati.stato.oraInt === undefined) st.oraInt = Math.floor(st.giorno * 24);
      avvia(st);
      G.riprendiVeicoli(st);
      fatto(null);
    };
    if (dati.opz.mappa) G.caricaMappaReale(dati.opz.mappa, e => (e ? fatto(e) : prosegui()));
    else prosegui();
  };

  // ---------------------------------------------------------------- avvio
  G.ui.prepara();
  ridimensiona();
  requestAnimationFrame(ciclo);
  // #rapida (anche #rapida,seme=123) salta il menu: comodo per le prove
  const h = location.hash;
  // #debug (anche #rapida,debug) mostra gli aiuti per le prove, come il binario prenotato dai treni;
  // si attiva anche dalla console con GIOCO.modoDebug = true
  G.modoDebug = h.includes('debug');
  // #rapida,mappa=italia avvia subito una mappa reale
  if (h.includes('rapida')) {
    const ms = /seme=(\d+)/.exec(h), mm = /mappa=(\w+)/.exec(h);
    G.nuovaPartita({ nome: 'Ferrovie Riunite', anno: 1850, W: 192, H: 144, numCitta: 14, seme: ms ? +ms[1] : 12345, mappa: mm ? mm[1] : undefined });
  } else G.ui.finestraMenu(true);
})();
