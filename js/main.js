// Avvio, ciclo principale (tempo di gioco e disegno), nuova partita, salvataggio nel browser.
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO;
  const cv = document.getElementById('mappa'), ctx = cv.getContext('2d');
  const mini = document.getElementById('mini');
  const CHIAVE = 'rotaie-e-rotte-salvataggio';
  const GRIGLIE = ['tipo', 'bosco', 'occ', 'rif', 'liv', 'cittaDi', 'mBin', 'mStr', 'tipoStr', 'strCitta', 'copertura',
    'operaBin', 'operaStr', 'quotaBin', 'quotaStr'];

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
      G.notizia(st, _`Nasce la ${opz.nome}${opz.mappa ? _(' in ') + opz.nomeMappa : ''}! Hai ${G.lire(st.soldi)} per cominciare: collega le città e porta le merci alle industrie. Premi H per l'aiuto.`);
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

  // la partita intera in un testo (lo stesso nel browser e nei file)
  function testoPartita(st) {
    const griglie = {};
    for (const k of GRIGLIE) griglie[k] = grigliaInTesto(st.mondo[k]);
    const stato = {};
    for (const k of ['citta', 'industrie', 'stazioni', 'soldi', 'prestito', 'giorno', 'giornoInt', 'oraInt', 'versioneRete',
      'conti', 'notizie', 'contatori', 'valoreInfra', 'mesiInRosso', 'industrieIniziali', 'banca', 'depositoVagoni']) stato[k] = st[k];
    stato.veicoli = st.veicoli.map(v => Object.assign({}, v, { punti: null, lun: null, caselle: null, pr: [] }));
    return 'Z1' + comprimi(JSON.stringify({ versione: 2, opz: st.opz, stato, griglie }));
  }

  // Più partite nel browser: un elenco (ELENCO) e una chiave per ciascuna (PREFISSO + id).
  // La partita in corso ricorda in quale posto sta (st.posto): «Salva» e il salvataggio automatico scrivono lì.
  const ELENCO = 'rotaie-e-rotte-elenco', PREFISSO = 'rotaie-e-rotte-partita-';
  function leggiElenco() {
    let el = [];
    try { el = JSON.parse(localStorage.getItem(ELENCO) || '[]'); } catch (e) { return []; }
    // il vecchio salvataggio unico diventa il primo dell'elenco
    try {
      const vecchio = localStorage.getItem(CHIAVE);
      if (vecchio) {
        const id = 'v' + Date.now();
        localStorage.setItem(PREFISSO + id, vecchio);
        el.unshift({ id, nome: _('Partita salvata'), quando: Date.now() });
        localStorage.setItem(ELENCO, JSON.stringify(el));
        localStorage.removeItem(CHIAVE);
      }
    } catch (e) { /* si riproverà la prossima volta */ }
    return el;
  }
  const scriviElenco = el => localStorage.setItem(ELENCO, JSON.stringify(el));
  // le partite salvate, dalla più recente
  G.elencoSalvataggi = () => leggiElenco().sort((a, b) => b.quando - a.quando);
  G.esisteSalvataggio = () => G.elencoSalvataggi().length > 0;

  // nuova = true: in un posto nuovo anche se la partita ne ha già uno
  G.salvaPartita = function (st, nuova) {
    try {
      const el = leggiElenco();
      let voce = !nuova && st.posto && el.find(v => v.id === st.posto);
      if (!voce) {
        voce = { id: Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36) };
        el.push(voce);
      }
      Object.assign(voce, { nome: st.opz.nome, mappa: st.opz.nomeMappa || '', data: G.testoData(st), soldi: st.soldi, quando: Date.now() });
      localStorage.setItem(PREFISSO + voce.id, testoPartita(st));
      scriviElenco(el);
      st.posto = voce.id;
      return null;
    } catch (e) {
      return /quota/i.test(e.name + e.message)
        ? _('Spazio del browser esaurito: elimina qualche vecchia partita oppure usa «Salva su file»')
        : _('Impossibile salvare: ') + e.message;
    }
  };
  G.salvaAutomatico = st => G.salvaPartita(st);

  G.eliminaSalvataggio = function (id) {
    try {
      localStorage.removeItem(PREFISSO + id);
      scriviElenco(leggiElenco().filter(v => v.id !== id));
      if (G.st && G.st.posto === id) G.st.posto = null;
    } catch (e) { /* niente da fare */ }
  };

  // fatto(errore): sulle mappe reali bisogna prima caricare il file della mappa, quindi la risposta arriva dopo
  G.caricaPartita = function (id, fatto) {
    let t = null;
    try { t = localStorage.getItem(PREFISSO + id); } catch (e) { /* sotto */ }
    if (!t) { fatto(_('Partita salvata non trovata')); return; }
    caricaDaTesto(t, id, fatto);
  };

  // posto = dove salvare d'ora in poi (null per le partite aperte da file: la prima volta se ne crea uno)
  function caricaDaTesto(t, posto, fatto) {
    let dati;
    try {
      t = t.trim();
      dati = JSON.parse(t.startsWith('Z1') ? decomprimi(t.slice(2)) : t);
      if (!dati || !dati.opz || !dati.griglie) throw new Error();
    } catch (e) { fatto(_('Salvataggio illeggibile')); return; }
    const prosegui = () => {
      const m = G.generaTerreno(dati.opz);
      // le partite vecchie non hanno le griglie più nuove (gallerie e quote): restano quelle vuote
      for (const k of GRIGLIE) if (dati.griglie[k]) m[k] = testoInGriglia(dati.griglie[k], m[k].constructor, m.N);
      const st = Object.assign(G.statoVuoto(dati.opz, m), dati.stato);
      if (dati.stato.oraInt === undefined) st.oraInt = Math.floor(st.giorno * 24);
      st.posto = posto;
      G.nomiNellaLingua(st);
      avvia(st);
      G.riprendiVeicoli(st);
      fatto(null);
    };
    if (dati.opz.mappa) G.caricaMappaReale(dati.opz.mappa, e => (e ? fatto(e) : prosegui()));
    else prosegui();
  }

  // ---------------------------------------------------------------- partite su file
  // Si scarica un file .rotaie (va nella cartella Download del browser) e lo si riapre con la scelta dei file:
  // niente fetch, quindi funziona anche aprendo index.html dal disco.
  G.salvaSuFile = function (st) {
    try {
      const nome = `${st.opz.nome} ${G.testoData(st)}`.replace(/[\\/:*?"<>|]+/g, '').trim() + '.rotaie';
      const url = URL.createObjectURL(new Blob([testoPartita(st)], { type: 'application/octet-stream' }));
      const a = document.createElement('a');
      a.href = url; a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return null;
    } catch (e) { return _('Impossibile creare il file: ') + e.message; }
  };
  G.caricaDaFile = function (file, fatto) {
    const r = new FileReader();
    r.onload = () => caricaDaTesto(String(r.result), null, fatto);
    r.onerror = () => fatto(_('Impossibile leggere il file'));
    r.readAsText(file);
  };

  // ---------------------------------------------------------------- cambio di lingua
  // tutti i testi (anche quelli preparati all'avvio, come il catalogo) cambiano ricaricando la pagina:
  // la partita in corso passa dalla memoria della scheda (sessionStorage) e riprende subito
  const RIPRENDI = 'rotaie-e-rotte-riprendi';
  G.dopoCambioLingua = function () {
    const st = G.st;
    if (st) {
      try { sessionStorage.setItem(RIPRENDI, JSON.stringify({ posto: st.posto || null, testo: testoPartita(st), vel: G.ui.velocita })); }
      catch (e) { G.avviso(_('Partita troppo grande per riprenderla da sola: salvala, poi cambia lingua'), true); return; }
    }
    location.reload();
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
  let ripresa = null;
  try { ripresa = JSON.parse(sessionStorage.getItem(RIPRENDI) || 'null'); sessionStorage.removeItem(RIPRENDI); } catch (e) { /* niente */ }
  if (ripresa) {
    caricaDaTesto(ripresa.testo, ripresa.posto, e => {
      if (e) { G.avviso(e, true); G.ui.finestraMenu(true); } else if (ripresa.vel !== undefined) G.ui.impostaVelocita(ripresa.vel);
    });
  } else if (h.includes('rapida')) {
    // #rapida,mappa=italia avvia subito una mappa reale
    const ms = /seme=(\d+)/.exec(h), mm = /mappa=(\w+)/.exec(h);
    G.nuovaPartita({ nome: _('Ferrovie Riunite'), anno: 1850, W: 192, H: 144, numCitta: 14, seme: ms ? +ms[1] : 12345, mappa: mm ? mm[1] : undefined });
  } else G.ui.finestraMenu(true);
})();
