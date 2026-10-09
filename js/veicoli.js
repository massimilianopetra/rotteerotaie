// Veicoli: treni, autobus e camion, aerei. Acquisto, percorso a fermate, viaggio, carico e scarico, guasti.
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO;
  const T = G.T;

  const RETE = { treno: 'binario', strada: 'strada', aereo: 'aria' };
  const TIPO_STAZ = G.TIPO_STAZ = { treno: 'stazione', strada: 'deposito', aereo: 'aeroporto' };
  const TM = C.tempi, ORA = 1 / 24, MINUTO = 1 / 1440;
  // unità caricate o scaricate in un giorno; le stazioni ferroviarie grandi caricano più in fretta
  const ritmo = (v, s) => TM.caricoOra[v.tipo] * 24 * (s ? G.defStazione(s).carico || 1 : 1);
  const sostaMinima = v => TM.sostaMinuti[v.tipo] * MINUTO;
  // il percorso più breve fino alla stazione: va bene una qualsiasi delle sue caselle toccate dalla rete
  G.percorsoVersoStazione = function (st, da, s, rete) {
    const mask = rete === 'binario' ? st.mondo.mBin : st.mondo.mStr;
    let meglio = null;
    for (const i of G.caselleStazione(st, s)) {
      if (!mask[i]) continue;
      const p = rete === 'binario' ? G.cercaPercorsoTreno(st, da, i) : G.cercaPercorso(st, da, i, rete);
      if (p && (!meglio || p.length < meglio.length)) meglio = p;
    }
    return meglio;
  };
  const NOMI = { treno: 'Treno', bus: 'Autobus', camion: 'Camion', aereo: 'Aereo' };

  G.modello = id => C.veicoli.find(v => v.id === id);
  G.modelliDisponibili = function (st, tipo) {
    const a = G.anno(st);
    return C.veicoli.filter(v => v.tipo === tipo && v.anno <= a && (v.fine || 9999) >= a);
  };
  G.merciPermesse = function (mod) {
    const tutte = Object.keys(C.merci);
    if (mod.tipo === 'aereo' || mod.classe === 'bus') return ['passeggeri', 'posta'];
    if (mod.classe === 'camion') return tutte.filter(k => k !== 'passeggeri' && k !== 'posta');
    return tutte;
  };
  G.capacita = function (mod, merce, vagoni) {
    if (mod.tipo === 'treno') return vagoni * C.vagone.capacita[merce];
    return merce === 'posta' ? Math.round(mod.capacita * 0.8) : mod.capacita;
  };
  G.prezzoVeicolo = (mod, vagoni) => mod.costo + (mod.tipo === 'treno' ? vagoni * C.vagone.costo : 0);
  G.esercizioVeicolo = function (v) {
    const mod = G.modello(v.modello);
    return (mod.esercizio + v.vagoni * C.vagone.esercizio) * (1 + 0.04 * v.eta);
  };
  G.valoreVeicolo = v => v.prezzo * Math.max(0.1, 1 - 0.07 * v.eta);

  G.compraVeicolo = function (st, modId, merce, vagoni, sid) {
    const mod = G.modello(modId), s = st.stazioni[sid];
    if (!s || s.tipo !== TIPO_STAZ[mod.tipo]) return 'Stazione non adatta a questo mezzo';
    if (!G.modelliDisponibili(st, mod.tipo).includes(mod)) return `${mod.nome} non è in vendita quest'anno`;
    if (!G.merciPermesse(mod).includes(merce)) return 'Questo mezzo non trasporta ' + C.merci[merce].nome.toLowerCase();
    vagoni = mod.tipo === 'treno' ? Math.max(1, Math.min(mod.vagoni, vagoni | 0)) : 0;
    const prezzo = G.prezzoVeicolo(mod, vagoni);
    if (st.soldi < prezzo) return 'Fondi insufficienti';
    const classe = mod.tipo === 'strada' ? mod.classe : mod.tipo;
    st.contatori[classe] = (st.contatori[classe] || 0) + 1;
    const c = G.centroStazione(s), t0 = G.casellaStazione(st, s), W = st.mondo.W;
    if (mod.tipo !== 'aereo') { c.x = t0 % W + 0.5; c.y = ((t0 / W) | 0) + 0.5; }
    const v = {
      id: ++st.contatori.veicolo, nome: `${NOMI[classe]} ${st.contatori[classe]}`,
      modello: modId, tipo: mod.tipo, classe, merce, vagoni,
      cap: G.capacita(mod, merce, vagoni), fermate: [{ s: sid, pieno: false }], idx: 0,
      stato: 'sosta', timer: TM.sostaMinuti[mod.tipo] * MINUTO, attesa: 0, motivo: '',
      caselle: null, punti: null, lun: null, lunTot: 0, pos: 0, seg: 0,
      x: c.x, y: c.y, ang: 0, tile: t0,
      carico: [], qta: 0, profittoAnno: 0, profittoScorso: 0, eta: 0, prezzo, guasti: 0, fermoManuale: false
    };
    if (mod.tipo === 'treno') { // circolazione: caselle prenotate e distanza percorsa
      Object.assign(v, { pr: [], odo: 0, odo0: 0, limite: 0, bloccatoDa: 0, attesaSegnale: 0, stallo: false, ricalcolo: -1 });
      G.prendiCasella(st, v, t0, 0);
    }
    st.veicoli.push(v);
    G.spendi(st, prezzo, 'veicoli');
    G.aggiornaServizi(st);
    return v;
  };

  G.vendiVeicolo = function (st, v) {
    const k = st.veicoli.indexOf(v);
    if (k < 0) return;
    G.incassa(st, G.valoreVeicolo(v), 'vendite');
    if (v.tipo === 'treno') G.liberaTutto(st, v);
    st.veicoli.splice(k, 1);
    G.aggiornaServizi(st);
  };

  // la stazione va bene per questo veicolo?
  G.fermataAdatta = (v, s) => s && s.tipo === TIPO_STAZ[v.tipo];

  G.aggiungiFermata = function (st, v, sid) {
    const s = st.stazioni[sid];
    if (!G.fermataAdatta(v, s)) return `Un ${NOMI[v.classe].toLowerCase()} non può fermarsi qui`;
    const ultima = v.fermate[v.fermate.length - 1];
    if (ultima && ultima.s === sid) return 'È già l\'ultima fermata';
    if (v.tipo !== 'aereo') {
      const da = ultima ? st.stazioni[ultima.s] : null;
      if (da && !G.percorsoVersoStazione(st, G.casellaStazione(st, da), s, RETE[v.tipo])) {
        v.fermate.push({ s: sid, pieno: false });
        G.aggiornaServizi(st);
        return 'Fermata aggiunta, ma non c\'è ancora un collegamento con la precedente!';
      }
    }
    v.fermate.push({ s: sid, pieno: false });
    if (v.stato === 'fermo') { v.stato = 'sosta'; v.timer = sostaMinima(v); v.idx = v.fermate.length - 1; }
    G.aggiornaServizi(st);
    return null;
  };

  G.togliFermata = function (st, v, k) {
    const versoQuesta = k === v.idx && (v.stato === 'viaggio' || v.stato === 'guasto');
    v.fermate.splice(k, 1);
    const n = v.fermate.length;
    if (!n) { v.stato = 'fermo'; v.idx = 0; }
    else if (k < v.idx) v.idx--;
    else if (k === v.idx) {
      if (versoQuesta) { v.idx %= n; ripianifica(st, v); }
      else v.idx = (v.idx - 1 + n) % n; // in sosta: la prossima partenza va alla fermata successiva
    }
    if (n) v.idx %= n;
    G.aggiornaServizi(st);
  };

  G.togliFermateStazione = function (st, v, sid) {
    for (let k = v.fermate.length - 1; k >= 0; k--) if (v.fermate[k].s === sid) {
      const eraSosta = v.stato === 'sosta' && k === v.idx;
      G.togliFermata(st, v, k);
      if (eraSosta && v.fermate.length) v.timer = 0;
    }
  };

  // ---------------------------------------------------------------- movimento
  function calcolaLunghezze(v) {
    const p = v.punti, lun = [0];
    for (let k = 1; k < p.length; k++) lun.push(lun[k - 1] + Math.hypot(p[k].x - p[k - 1].x, p[k].y - p[k - 1].y));
    v.lun = lun; v.lunTot = lun[lun.length - 1];
  }

  // punto (e direzione) a distanza s lungo il percorso; parte dal segmento k0 per fare prima
  G.puntoSu = function (v, s, k0) {
    const p = v.punti, L = v.lun, n = p.length;
    if (!p || n === 0) return { x: v.x, y: v.y, ang: v.ang };
    if (n === 1) return { x: p[0].x, y: p[0].y, ang: v.ang };
    s = Math.max(0, Math.min(v.lunTot, s));
    let k = Math.min(k0 === undefined ? 0 : k0, n - 2);
    while (k > 0 && L[k] > s) k--;
    while (k < n - 2 && L[k + 1] < s) k++;
    const seg = L[k + 1] - L[k], f = seg > 0 ? (s - L[k]) / seg : 0;
    const a = p[k], b = p[k + 1];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, ang: Math.atan2(b.y - a.y, b.x - a.x), k, f };
  };

  function posiziona(st, v) {
    const q = G.puntoSu(v, v.pos, v.seg);
    v.x = q.x; v.y = q.y; v.ang = q.ang; v.seg = q.k || 0;
    if (v.caselle) v.tile = v.caselle[Math.min(v.caselle.length - 1, v.seg + (q.f > 0.5 ? 1 : 0))];
    else v.tile = Math.floor(v.y) * st.mondo.W + Math.floor(v.x);
  }

  function pianifica(st, v) {
    const f = v.fermate[v.idx], s = f && st.stazioni[f.s];
    if (!s) { v.stato = 'fermo'; return; }
    const arrivo = G.centroStazione(s);
    if (v.tipo === 'aereo') {
      v.caselle = null;
      v.punti = [{ x: v.x, y: v.y }, arrivo];
    } else {
      const caselle = v.tipo === 'treno' ? G.percorsoTreno(st, v.tile, s, v) : G.percorsoVersoStazione(st, v.tile, s, RETE[v.tipo]);
      if (!caselle) {
        v.stato = 'bloccato'; v.timer = TM.riprovaOre * ORA;
        v.motivo = `Nessun ${v.tipo === 'treno' ? 'binario' : 'collegamento stradale'} fino a ${s.nome}`;
        return;
      }
      const W = st.mondo.W;
      v.caselle = caselle;
      v.punti = caselle.map(i => ({ x: i % W + 0.5, y: ((i / W) | 0) + 0.5 }));
    }
    calcolaLunghezze(v);
    v.pos = 0; v.seg = 0; v.stato = 'viaggio'; v.motivo = '';
    if (v.tipo === 'treno') {
      v.odo0 = v.odo; v.limite = 0; v.bloccatoDa = 0; v.attesaSegnale = 0;
      G.prendiCasella(st, v, v.caselle[0], v.odo);
      G.estendiPrenotazione(st, v); // subito: chi parte dopo vede il binario occupato e ne sceglie un altro
    }
    if (v.lunTot < 0.01) arriva(st, v);
  }

  // treno fermo al segnale: prova una strada diversa che eviti i binari occupati
  // (un binario parallelo, un raddoppio, un altro binario della stazione)
  function cercaAlternativa(st, v) {
    // subito appena fermo al segnale; poi al massimo ogni 30 minuti e solo se qualche treno ha preso
    // o lasciato del binario (il calcolo costa: con molti treni fermi rallenterebbe il gioco)
    if (v.stallo || v.ricalcolo === st.versionePren) return false; // in stallo: aspetta il giocatore
    if (v.ricalcolo !== -1 && st.giorno - (v.ricalcoloT || 0) < 30 * MINUTO) return false;
    v.ricalcolo = st.versionePren; v.ricalcoloT = st.giorno;
    const f = v.fermate[v.idx], s = f && st.stazioni[f.s];
    if (!s) return false;
    // il treno continua nel suo senso di marcia (in stazione, fermo all'inizio del percorso, può anche invertirlo)
    const qui = v.caselle[v.limite], dir = v.limite > 0 ? G.direzione(st.mondo, v.caselle[v.limite - 1], qui) : -1;
    const nuovo = G.percorsoTreno(st, qui, s, v, dir);
    if (!nuovo || nuovo.length < 2 || nuovo.join() === v.caselle.slice(v.limite).join()) return false;
    if (!G.trattoLibero(st, v, nuovo)) return false; // anche la strada nuova è occupata: meglio aspettare dove si è
    const W = st.mondo.W;
    v.caselle = nuovo;
    v.punti = nuovo.map(i => ({ x: i % W + 0.5, y: ((i / W) | 0) + 0.5 }));
    calcolaLunghezze(v);
    v.pos = 0; v.seg = 0; v.odo0 = v.odo; v.limite = 0;
    return G.estendiPrenotazione(st, v);
  }

  // movimento di un treno: avanza solo fin dove ha prenotato il binario
  function muoviTreno(st, v, dt) {
    let avanti = velocita(st, v) * dt;
    for (;;) {
      const fin = v.lun[v.limite];
      if (v.limite >= v.caselle.length - 1 || v.pos + avanti <= fin) { v.pos = Math.min(v.pos + avanti, v.lunTot); break; }
      avanti -= Math.max(0, fin - v.pos);
      v.pos = fin;
      if (!G.estendiPrenotazione(st, v) && !cercaAlternativa(st, v)) { v.attesaSegnale += dt; break; }
    }
    v.odo = v.odo0 + v.pos;
    G.liberaDietro(st, v);
  }
  function ripianifica(st, v) {
    if (v.punti && v.punti.length) { const p = v.punti[Math.min(v.seg, v.punti.length - 1)]; if (v.tipo !== 'aereo') { v.x = p.x; v.y = p.y; } }
    if (v.caselle) v.tile = v.caselle[Math.min(v.seg, v.caselle.length - 1)];
    if (v.tipo === 'treno' && v.pr) G.liberaAvanti(st, v); // il binario prenotato sulla vecchia strada non serve più
    pianifica(st, v);
  }

  // il giocatore rimanda indietro un mezzo alla fermata da cui è partito (per sciogliere uno stallo sui binari)
  G.tornaIndietro = function (st, v) {
    if (v.tipo === 'aereo') return 'Un aereo in volo non può tornare indietro';
    if (v.stato === 'guasto') return 'Il mezzo è guasto: aspetta la riparazione';
    if (v.stato !== 'viaggio' && v.stato !== 'bloccato') return 'Il mezzo non è in viaggio';
    const n = v.fermate.length;
    if (n < 2) return 'Il mezzo non ha una fermata a cui tornare';
    v.idx = (v.idx - 1 + n) % n;
    if (v.tipo === 'treno') { v.stallo = false; v.bloccatoDa = 0; v.attesaSegnale = 0; v.ricalcolo = -1; }
    ripianifica(st, v);
    return null;
  };

  function arriva(st, v) {
    const f = v.fermate[v.idx], s = f && st.stazioni[f.s];
    v.stato = 'sosta'; v.attesa = 0; v.timer = sostaMinima(v);
    if (v.tipo === 'treno') G.liberaTutto(st, v); // in stazione il treno non occupa più la linea
    if (!s) { v.stato = 'fermo'; return; }
    const c = G.centroStazione(s);
    // treni e mezzi su strada restano sulla casella dove sono arrivati (le stazioni grandi ne hanno più d'una)
    if (v.tipo === 'aereo' || !v.caselle) { v.x = c.x; v.y = c.y; v.tile = G.casellaStazione(st, s); }
    if (!s.primoArrivo) {
      s.primoArrivo = true;
      const chi = { treno: 'Il primo treno', strada: 'Il primo ' + NOMI[v.classe].toLowerCase(), aereo: 'Il primo aereo' }[v.tipo];
      G.notizia(st, `${chi} arriva ${/^[AEIOU]/.test(s.nome) ? 'ad' : 'a'} ${s.nome}: festa in piazza!`, c.x, c.y);
    }
    if (s.servite[v.merce]) s.ultimoRitiro[v.merce] = st.giornoInt;
    if (v.qta > 0 && s.accetta[v.merce]) {
      const def = C.merci[v.merce];
      let incasso = 0;
      for (const p of v.carico) {
        const o = st.stazioni[p.o], co = o ? G.centroStazione(o) : c;
        const dist = Math.hypot(co.x - c.x, co.y - c.y) * G.kmCasella(st); // in km
        const giorni = st.giorno - p.g;
        const ft = Math.max(0.25, Math.min(1, 1 - (giorni - def.giorni) / (def.giorni * 2)));
        incasso += p.q * def.prezzo * dist * ft;
      }
      G.consegna(st, s, v.merce, v.qta);
      v.timer += v.qta / ritmo(v, s);
      v.carico = []; v.qta = 0;
      incasso = Math.round(incasso);
      if (incasso > 0) {
        G.incassa(st, incasso, v.merce);
        v.profittoAnno += incasso;
        st.effetti.push({ x: c.x, y: c.y, testo: '+' + G.lire(incasso), t: 0 });
      }
    }
  }

  function carica(st, v, s, dt) {
    if (!s.servite[v.merce]) return;
    const disp = s.attesa[v.merce] || 0, spazio = v.cap - v.qta;
    if (disp < 0.01 || spazio <= 0.01) return;
    const q = Math.min(disp, spazio, ritmo(v, s) * dt);
    s.attesa[v.merce] = disp - q;
    s.ultimoRitiro[v.merce] = st.giornoInt;
    let p = v.carico.find(k => k.o === s.id);
    if (!p) { p = { o: s.id, q: 0, g: st.giorno }; v.carico.push(p); }
    p.g = (p.g * p.q + st.giorno * q) / (p.q + q);
    p.q += q; v.qta += q;
    if (v.merce === 'passeggeri' && s.citta >= 0) st.citta[s.citta].mese.partiti += q;
    if (v.merce === 'posta' && s.citta >= 0) st.citta[s.citta].mese.posta += q;
  }

  function sosta(st, v, dt) {
    const f = v.fermate[v.idx], s = f && st.stazioni[f.s];
    v.timer -= dt; v.attesa += dt;
    if (s) carica(st, v, s, dt);
    if (v.timer > 0 || v.fermate.length < 2 || v.fermoManuale) return;
    // se in stazione resta merce e c'è ancora posto, finisce di caricare (al massimo mezza giornata)
    const resta = s && s.servite[v.merce] && (s.attesa[v.merce] || 0) >= 1 && v.qta < v.cap - 0.5;
    if (resta && v.attesa < 0.5) return;
    if (f && f.pieno && v.qta < v.cap - 0.5 && v.attesa < 120) return; // aspetta il carico pieno (al massimo 4 mesi)
    // attesa a tempo: resta fino all'ora indicata per riempirsi di più, ma parte prima se è pieno
    if (f && f.attesaMin > 0 && v.qta < v.cap - 0.5 && v.attesa < f.attesaMin * MINUTO) return;
    v.idx = (v.idx + 1) % v.fermate.length;
    pianifica(st, v);
  }

  function velocita(st, v) {
    // caselle al giorno: km/h × 24 ore ÷ km per casella
    const mod = G.modello(v.modello), m = st.mondo, K = G.kmCasella(st) / 24;
    let vel = mod.kmh / K;
    if (v.tipo === 'treno') {
      vel *= 1 - 0.3 * v.vagoni / mod.vagoni;
      const t = m.tipo[v.tile];
      if (t === T.COLLINA) vel *= 0.85; else if (t === T.MONTAGNA) vel *= 0.65;
    } else if (v.tipo === 'strada') {
      vel = Math.min(mod.kmh, m.tipoStr[v.tile] === 2 ? 130 : 80) / K;
      const t = m.tipo[v.tile];
      if (t === T.COLLINA) vel *= 0.9; else if (t === T.MONTAGNA) vel *= 0.8;
    } else {
      vel *= C.fattoreAerei;
      const d = Math.min(v.pos, v.lunTot - v.pos);
      if (d < 4) vel *= 0.3 + 0.7 * d / 4; // decollo e atterraggio
    }
    return vel;
  }

  function viaggio(st, v, dt) {
    if (v.tipo === 'treno') muoviTreno(st, v, dt);
    else v.pos += velocita(st, v) * dt;
    if (!v.bloccatoDa && Math.random() < dt * 0.0012 * (1 + v.eta / 6)) {
      v.stato = 'guasto'; v.timer = (TM.guastoOre[0] + Math.random() * (TM.guastoOre[1] - TM.guastoOre[0])) * ORA; v.guasti++;
      if (v.tipo === 'aereo') v.stato = 'viaggio'; // gli aerei non si fermano in volo
    }
    if (v.pos >= v.lunTot) { v.pos = v.lunTot; posiziona(st, v); arriva(st, v); return; }
    posiziona(st, v);
  }

  G.aggiornaVeicoli = function (st, dt) {
    for (const v of st.veicoli) {
      switch (v.stato) {
        case 'sosta': sosta(st, v, dt); break;
        case 'viaggio': viaggio(st, v, dt); break;
        case 'guasto': v.timer -= dt; if (v.timer <= 0) v.stato = 'viaggio'; break;
        case 'bloccato': v.timer -= dt; if (v.timer <= 0) pianifica(st, v); break;
        case 'fermo': if (v.fermate.length) { v.stato = 'sosta'; v.timer = sostaMinima(v); } break;
      }
    }
    G.controllaStalli(st);
  };

  // dopo una modifica alla rete: chi viaggia su un tratto sparito ricalcola la strada
  G.verificaPercorsi = function (st) {
    const m = st.mondo;
    for (const v of st.veicoli) {
      if (v.tipo === 'aereo' || !v.caselle) continue;
      if (v.stato !== 'viaggio' && v.stato !== 'guasto') continue;
      const mask = v.tipo === 'treno' ? m.mBin : m.mStr;
      let ok = true;
      for (let k = v.seg; k + 1 < v.caselle.length; k++) {
        const d = G.direzione(m, v.caselle[k], v.caselle[k + 1]);
        if (d < 0 || !((mask[v.caselle[k]] >> d) & 1)) { ok = false; break; }
      }
      if (!ok) ripianifica(st, v);
    }
  };

  // dopo il caricamento di una partita i percorsi vanno ricalcolati
  G.riprendiVeicoli = function (st) {
    G.ricostruisciPrenotazioni(st);
    for (const v of st.veicoli) {
      if (v.stato === 'viaggio' || v.stato === 'guasto') {
        if (v.tipo !== 'aereo') { v.x = (v.tile % st.mondo.W) + 0.5; v.y = ((v.tile / st.mondo.W) | 0) + 0.5; }
        pianifica(st, v);
      }
    }
  };

  // minuti → "2 g 3 h 15 min"
  G.testoDurata = function (min) {
    min = Math.max(0, Math.round(min));
    const g = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60, p = [];
    if (g) p.push(g + ' g');
    if (h) p.push(h + ' h');
    if (m || !p.length) p.push(m + ' min');
    return p.join(' ');
  };

  G.statoVeicolo = function (st, v) {
    const f = v.fermate[v.idx], s = f && st.stazioni[f.s];
    switch (v.stato) {
      case 'sosta': {
        if (!s) return 'In sosta';
        const pieno = v.qta >= v.cap - 0.5;
        if (f.pieno && !pieno && v.timer <= 0) return `Attende il carico pieno a ${s.nome}`;
        if (f.attesaMin > 0 && !pieno && v.timer <= 0) {
          const resta = f.attesaMin - v.attesa * 1440;
          if (resta > 0) return `Attende a ${s.nome} (ancora ${G.testoDurata(resta)})`;
        }
        return `In sosta a ${s.nome}`;
      }
      case 'viaggio': {
        if (v.bloccatoDa) {
          const altro = st.veicoli.find(k => k.id === v.bloccatoDa);
          if (v.stallo) return `Stallo! ${altro ? altro.nome + ' e questo treno' : 'I treni'} si bloccano a vicenda: premi «Torna indietro»`;
          return `Fermo al segnale: binario occupato${altro ? ' da ' + altro.nome : ''}`;
        }
        return s ? `Diretto a ${s.nome}` : 'In viaggio';
      }
      case 'guasto': return 'Guasto! Riparazione in corso';
      case 'bloccato': return v.motivo || 'Bloccato';
      default: return 'Fermo: aggiungi delle fermate';
    }
  };
})();
