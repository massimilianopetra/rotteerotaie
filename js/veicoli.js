// Veicoli: treni, autobus e camion, aerei, navi. Acquisto, percorso a fermate, viaggio, carico e scarico, guasti.
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO;
  const T = G.T;

  const RETE = { treno: 'binario', strada: 'strada', aereo: 'aria', nave: 'mare' };
  const TIPO_STAZ = G.TIPO_STAZ = { treno: 'stazione', strada: 'deposito', aereo: 'aeroporto', nave: 'porto' };
  const TM = C.tempi, ORA = 1 / 24, MINUTO = 1 / 1440;
  // unità caricate o scaricate in un giorno; le stazioni ferroviarie grandi caricano più in fretta
  const ritmo = (v, s) => TM.caricoOra[v.tipo] * 24 * (s ? G.defStazione(s).carico || 1 : 1);
  const sostaMinima = v => TM.sostaMinuti[v.tipo] * MINUTO;
  // il percorso più breve fino alla stazione: va bene una qualsiasi delle sue caselle toccate dalla rete
  G.percorsoVersoStazione = function (st, da, s, rete) {
    if (rete === 'mare') return G.cercaRotta(st, da, s); // le navi: sull'acqua fino al porto
    const mask = rete === 'binario' ? st.mondo.mBin : st.mondo.mStr;
    let meglio = null;
    for (const i of G.caselleStazione(st, s)) {
      if (!mask[i]) continue;
      const p = rete === 'binario' ? G.cercaPercorsoTreno(st, da, i) : G.cercaPercorso(st, da, i, rete);
      if (p && (!meglio || p.length < meglio.length)) meglio = p;
    }
    return meglio;
  };
  const NOMI = { treno: _('Treno'), bus: _('Autobus'), camion: _('Camion'), aereo: _('Aereo'), traghetto: _('Traghetto'), cargo: _('Nave') };
  // I nomi automatici dei mezzi («Treno 3») e il nome di partenza della compagnia seguono la lingua scelta, anche
  // nelle partite salvate in un'altra lingua; i nomi scelti dal giocatore restano come sono.
  const NOMI_IT = { treno: 'Treno', bus: 'Autobus', camion: 'Camion', aereo: 'Aereo', traghetto: 'Traghetto', cargo: 'Nave' };
  G.nomiNellaLingua = function (st) {
    const diz = Object.values(window.LINGUE || {}), forme = it => [it, ...diz.map(d => d[it]).filter(Boolean)];
    for (const v of st.veicoli) {
      const m = /^(.*) (\d+)$/.exec(v.nome || ''), it = NOMI_IT[v.classe];
      if (m && it && forme(it).includes(m[1])) v.nome = G.tr(it) + ' ' + m[2];
    }
    if (st.opz && forme('Ferrovie Riunite').includes(st.opz.nome)) st.opz.nome = G.tr('Ferrovie Riunite');
  };

  G.modello = id => C.veicoli.find(v => v.id === id);
  G.modelliDisponibili = function (st, tipo) {
    const a = G.anno(st);
    return C.veicoli.filter(v => v.tipo === tipo && v.anno <= a && (v.fine || 9999) >= a);
  };
  G.merciPermesse = function (mod) {
    const tutte = Object.keys(C.merci);
    if (mod.tipo === 'aereo' || mod.classe === 'bus' || mod.classe === 'traghetto') return ['passeggeri', 'posta'];
    if (mod.classe === 'camion' || mod.classe === 'cargo') return tutte.filter(k => k !== 'passeggeri' && k !== 'posta');
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

  // conti di un mezzo: ricavi (consegne) e costi (esercizio) tenuti separati; profitto = ricavi − costi.
  // profittoTot è il profitto da quando l'hai comprato: serve a capire se ha già ripagato il suo prezzo.
  G.contoVeicolo = function (v, ricavo, costo) {
    v.ricaviAnno += ricavo; v.costiAnno += costo;
    v.profittoAnno += ricavo - costo; v.profittoTot += ricavo - costo;
  };
  // fine anno: quest'anno diventa l'anno scorso
  G.chiudiAnnoVeicolo = function (v) {
    v.profittoScorso = v.profittoAnno; v.ricaviScorso = v.ricaviAnno; v.costiScorso = v.costiAnno;
    v.profittoAnno = v.ricaviAnno = v.costiAnno = 0;
  };
  // partite salvate prima che i conti dei mezzi fossero separati: una stima dai mesi già pagati
  // (per un mezzo comprato a metà anno i costi risultano un po' più alti del vero)
  function completaConti(st, v) {
    if (v.ricaviAnno !== undefined) return;
    v.costiAnno = Math.round(G.esercizioVeicolo(v) / 12 * G.data(st).mese);
    v.ricaviAnno = Math.max(0, v.profittoAnno + v.costiAnno);
    v.costiScorso = v.eta > 0 ? Math.round(G.esercizioVeicolo(v) / (1 + 0.04 * v.eta) * (1 + 0.04 * (v.eta - 1))) : 0;
    v.ricaviScorso = Math.max(0, v.profittoScorso + v.costiScorso);
    v.profittoTot = v.profittoAnno + v.profittoScorso;
  }

  G.compraVeicolo = function (st, modId, merce, vagoni, sid) {
    const mod = G.modello(modId), s = st.stazioni[sid];
    if (!s || s.tipo !== TIPO_STAZ[mod.tipo]) return _('Stazione non adatta a questo mezzo');
    if (!G.modelliDisponibili(st, mod.tipo).includes(mod)) return _`${mod.nome} non è in vendita quest'anno`;
    if (!G.merciPermesse(mod).includes(merce)) return _('Questo mezzo non trasporta ') + C.merci[merce].nome.toLowerCase();
    vagoni = mod.tipo === 'treno' ? Math.max(1, Math.min(mod.vagoni, vagoni | 0)) : 0;
    // i vagoni si prendono prima dal deposito (gratis), poi si comprano nuovi
    const usati = mod.tipo === 'treno' ? Math.min(vagoni, G.vagoniInDeposito(st, merce)) : 0;
    const prezzo = G.prezzoVeicolo(mod, vagoni), spesa = prezzo - usati * C.vagone.costo;
    if (st.soldi < spesa) return _('Fondi insufficienti');
    if (usati) deposito(st)[G.famigliaVagone(merce)] -= usati;
    const classe = mod.tipo === 'strada' || mod.tipo === 'nave' ? mod.classe : mod.tipo;
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
      carico: [], qta: 0, profittoAnno: 0, profittoScorso: 0, eta: 0, prezzo, guasti: 0, fermoManuale: false,
      ricaviAnno: 0, costiAnno: 0, ricaviScorso: 0, costiScorso: 0, profittoTot: 0
    };
    if (mod.tipo === 'treno') { // circolazione: caselle prenotate e distanza percorsa
      Object.assign(v, { pr: [], odo: 0, odo0: 0, limite: 0, bloccatoDa: 0, attesaSegnale: 0, stallo: false, ricalcolo: -1 });
      G.prendiCasella(st, v, t0, 0);
    }
    st.veicoli.push(v);
    G.spendi(st, spesa, 'veicoli');
    G.aggiornaServizi(st);
    return v;
  };

  // ---------------------------------------------------------------- vagoni e deposito
  // Un treno può avere da 1 vagone al massimo della sua locomotiva. Si cambia solo in stazione: fuori, la richiesta
  // (v.vagoniVoluti) aspetta la prossima fermata, perché la lunghezza del treno conta per i binari prenotati.
  // I vagoni tolti vanno nel deposito della compagnia (st.depositoVagoni, per famiglia: un carro aperto porta
  // carbone o ferro, una cisterna petrolio o carburante) e si rimontano gratis su altri treni; si possono vendere.
  const FAMIGLIA = { passeggeri: 'carrozza', posta: 'postale', carbone: 'aperto', ferro: 'aperto', legname: 'pianale', acciaio: 'pianale',
    petrolio: 'cisterna', carburante: 'cisterna', grano: 'tramoggia', cibo: 'frigo', merci: 'coperto' };
  // nome della famiglia e merce che la rappresenta nei disegni
  G.FAMIGLIE_VAGONI = {
    carrozza: [_('Carrozze passeggeri'), 'passeggeri'], postale: [_('Vagoni postali'), 'posta'], aperto: [_('Carri aperti (carbone, ferro)'), 'carbone'],
    pianale: [_('Carri pianale (legname, acciaio)'), 'legname'], cisterna: [_('Carri cisterna (petrolio, carburante)'), 'petrolio'],
    tramoggia: [_('Carri tramoggia (grano)'), 'grano'], frigo: [_('Carri frigo (cibo)'), 'cibo'], coperto: [_('Carri merci coperti'), 'merci']
  };
  G.famigliaVagone = merce => FAMIGLIA[merce] || 'coperto';
  G.valoreVagoneUsato = () => C.vagone.costo * 0.5;
  const deposito = st => st.depositoVagoni || (st.depositoVagoni = {});
  G.vagoniInDeposito = (st, merce) => deposito(st)[G.famigliaVagone(merce)] || 0;
  G.vagoniVoluti = v => v.vagoniVoluti || v.vagoni;

  // delta = +1 o −1: restituisce un messaggio se non si può, altrimenti null
  G.chiediVagoni = function (st, v, delta) {
    if (!v || v.tipo !== 'treno') return null;
    const mod = G.modello(v.modello), ora = G.vagoniVoluti(v), n = Math.max(1, Math.min(mod.vagoni, ora + delta));
    if (n === ora) return delta > 0 ? _`${mod.nome}: al massimo ${mod.vagoni} vagoni` : _('Il treno deve avere almeno un vagone');
    if (delta > 0 && n > v.vagoni) { // i vagoni in più: prima quelli del deposito, poi nuovi da pagare
      const nuovi = Math.max(0, n - v.vagoni - G.vagoniInDeposito(st, v.merce));
      if (nuovi * C.vagone.costo > st.soldi) return _('Fondi insufficienti per un vagone nuovo');
    }
    v.vagoniVoluti = n === v.vagoni ? 0 : n;
    return v.stato === 'sosta' ? G.applicaVagoni(st, v) : null;
  };

  // in stazione: si aggiungono o si tolgono i vagoni chiesti. Togliere un vagone pieno non si può: si aspetta
  // che il carico scenda (alla prossima fermata, dopo lo scarico).
  G.applicaVagoni = function (st, v) {
    const voluti = v.vagoniVoluti;
    if (!voluti || v.tipo !== 'treno') return null;
    const mod = G.modello(v.modello), fam = G.famigliaVagone(v.merce), dep = deposito(st);
    let msg = null;
    while (v.vagoni < voluti) {
      if (dep[fam] > 0) dep[fam]--;
      else if (st.soldi >= C.vagone.costo) G.spendi(st, C.vagone.costo, 'veicoli');
      else { msg = _('Fondi insufficienti per un vagone nuovo'); v.vagoniVoluti = 0; break; }
      v.vagoni++; v.prezzo += C.vagone.costo;
    }
    while (v.vagoni > voluti) {
      if (v.qta > G.capacita(mod, v.merce, v.vagoni - 1) + 1e-6) { msg = _('Il carico non ci sta: il vagone si stacca alla prossima fermata, dopo lo scarico'); break; }
      v.vagoni--; v.prezzo -= C.vagone.costo; dep[fam] = (dep[fam] || 0) + 1;
    }
    if (v.vagoni === voluti) v.vagoniVoluti = 0;
    v.cap = G.capacita(mod, v.merce, v.vagoni);
    return msg;
  };

  G.vendiVagoneDeposito = function (st, fam) {
    const dep = deposito(st);
    if (!(dep[fam] > 0)) return _('Nessun vagone di questo tipo nel deposito');
    dep[fam]--;
    G.incassa(st, G.valoreVagoneUsato(), 'vendite');
    return null;
  };

  // vendere: tutto il treno, oppure solo la locomotiva (tieniVagoni) con i vagoni che vanno nel deposito
  G.valoreLocomotiva = v => Math.max(0, v.prezzo - v.vagoni * C.vagone.costo) * Math.max(0.1, 1 - 0.07 * v.eta);
  G.vendiVeicolo = function (st, v, tieniVagoni) {
    const k = st.veicoli.indexOf(v);
    if (k < 0) return;
    if (tieniVagoni && v.tipo === 'treno') {
      const dep = deposito(st), fam = G.famigliaVagone(v.merce);
      dep[fam] = (dep[fam] || 0) + v.vagoni;
      G.incassa(st, G.valoreLocomotiva(v), 'vendite');
    } else G.incassa(st, G.valoreVeicolo(v), 'vendite');
    if (v.tipo === 'treno') G.liberaTutto(st, v);
    st.veicoli.splice(k, 1);
    G.aggiornaServizi(st);
  };

  // Ordine delle fermate. Giro (normale): 1 → 2 → 3 → 1 → 2 …
  // Andata e ritorno (v.andataRitorno): 1 → 2 → 3 → 2 → 1 → 2 …; v.verso (+1 o −1) dice da che parte si va.
  const giroSemplice = v => !v.andataRitorno || v.fermate.length <= 2;
  function prossimaFermata(v) {
    const n = v.fermate.length;
    if (giroSemplice(v)) { v.idx = (v.idx + 1) % n; return; }
    let d = v.verso === -1 ? -1 : 1;
    if (v.idx + d < 0 || v.idx + d >= n) d = -d; // al capolinea si torna indietro
    v.verso = d;
    v.idx = Math.max(0, Math.min(n - 1, v.idx + d));
  }
  // la fermata da cui il mezzo è arrivato (per «Torna indietro»)
  function fermataPrecedente(v) {
    const n = v.fermate.length;
    if (giroSemplice(v)) return (v.idx - 1 + n) % n;
    const k = v.idx - (v.verso === -1 ? -1 : 1);
    return k >= 0 && k < n ? k : (v.idx - 1 + n) % n;
  }
  // l'ordine in cui il mezzo visita le fermate, una volta: [0, 1, 2] col giro, [0, 1, 2, 1] in andata e ritorno
  G.ordineFermate = function (v) {
    const n = v.fermate.length, el = [];
    for (let k = 0; k < n; k++) el.push(k);
    if (!giroSemplice(v)) for (let k = n - 2; k > 0; k--) el.push(k);
    return el;
  };
  G.impostaAndataRitorno = function (st, v, si) {
    v.andataRitorno = !!si;
    v.verso = 1;
  };

  // la stazione va bene per questo veicolo?
  // i treni si fermano anche nei porti: un binario sopra il porto ne fa una stazione di scambio fra treni e navi
  G.fermataAdatta = (v, s) => s && (s.tipo === TIPO_STAZ[v.tipo] || (v.tipo === 'treno' && s.tipo === 'porto'));

  G.aggiungiFermata = function (st, v, sid) {
    const s = st.stazioni[sid];
    if (!G.fermataAdatta(v, s)) return _`Un ${NOMI[v.classe].toLowerCase()} non può fermarsi qui`;
    const ultima = v.fermate[v.fermate.length - 1];
    if (ultima && ultima.s === sid) return _('È già l\'ultima fermata');
    if (v.tipo !== 'aereo') {
      const da = ultima ? st.stazioni[ultima.s] : null;
      if (da && !G.percorsoVersoStazione(st, G.casellaStazione(st, da), s, RETE[v.tipo])) {
        v.fermate.push({ s: sid, pieno: false });
        G.aggiornaServizi(st);
        return _('Fermata aggiunta, ma non c\'è ancora un collegamento con la precedente!');
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
      // in sosta: la prossima partenza va alla fermata successiva (al ritorno, quella prima)
      else if (!giroSemplice(v) && v.verso === -1) v.idx = Math.min(v.idx, n - 1);
      else v.idx = (v.idx - 1 + n) % n;
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
        v.motivo = v.tipo === 'nave' ? _`Nessuna rotta per mare fino a ${s.nome} (è su un'altra acqua?)`
          : _`Nessun ${v.tipo === 'treno' ? 'binario' : _('collegamento stradale')} fino a ${s.nome}`;
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
    if (v.tipo === 'aereo') return _('Un aereo in volo non può tornare indietro');
    if (v.stato === 'guasto') return _('Il mezzo è guasto: aspetta la riparazione');
    if (v.stato !== 'viaggio' && v.stato !== 'bloccato') return _('Il mezzo non è in viaggio');
    const n = v.fermate.length;
    if (n < 2) return _('Il mezzo non ha una fermata a cui tornare');
    v.idx = fermataPrecedente(v);
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
      const chi = { treno: _('Il primo treno'), strada: _('Il primo ') + NOMI[v.classe].toLowerCase(), aereo: _('Il primo aereo'), nave: _('La prima nave') }[v.tipo];
      G.notizia(st, _`${chi} arriva ${/^[AEIOU]/.test(s.nome) ? _('ad') : 'a'} ${s.nome}: festa in piazza!`, c.x, c.y);
    }
    if (s.servite[v.merce]) s.ultimoRitiro[v.merce] = st.giornoInt;
    // la merce si consegna se la stazione la accetta; si lascia per il trasbordo se la fermata lo chiede, oppure se
    // qui non è accettata ma un mezzo di un altro tipo la ritira (dal treno alla nave, dalla nave al treno…)
    const lascia = v.qta > 0 && (f.trasbordo || (!s.accetta[v.merce] && altroRitira(st, s, v)));
    if (v.qta > 0 && (s.accetta[v.merce] || lascia)) {
      const def = C.merci[v.merce];
      let incasso = 0;
      for (const p of v.carico) {
        const o = st.stazioni[p.o], co = o ? G.centroStazione(o) : c;
        const dist = Math.hypot(co.x - c.x, co.y - c.y) * G.kmCasella(st); // in km
        const giorni = st.giorno - p.g;
        const ft = Math.max(0.25, Math.min(1, 1 - (giorni - def.giorni) / (def.giorni * 2)));
        incasso += p.q * def.prezzo * dist * ft;
      }
      if (lascia) { const sc = scorta(s, v.merce); sc[v.tipo] = (sc[v.tipo] || 0) + v.qta; } // il mezzo è pagato per il suo pezzo
      else G.consegna(st, s, v.merce, v.qta);
      v.timer += v.qta / ritmo(v, s);
      v.carico = []; v.qta = 0;
      incasso = Math.round(incasso);
      if (incasso > 0) {
        G.incassa(st, incasso, v.merce);
        G.contoVeicolo(v, incasso, 0);
        st.effetti.push({ x: c.x, y: c.y, testo: '+' + G.lire(incasso), t: 0 });
      }
    }
    // vagoni da aggiungere o togliere chiesti durante il viaggio
    if (v.vagoniVoluti) { const e = G.applicaVagoni(st, v); if (e && !v.vagoniVoluti) G.notizia(st, _`${v.nome}: ${e}`, c.x, c.y); }
  }

  // ---------------------------------------------------------------- trasbordo
  // La merce lasciata in una stazione per un altro mezzo sta in s.trasbordo[merce][tipo del mezzo che l'ha lasciata]
  // e la riprende solo un mezzo di un altro tipo: così un treno non si ricarica la merce che ha appena lasciato.
  // Chi la lascia è pagato per il suo pezzo di viaggio (dall'origine fin qui); chi la riprende parte da qui.
  const scorta = (s, merce) => { const t = s.trasbordo || (s.trasbordo = {}); return t[merce] || (t[merce] = {}); };
  G.trasbordoDisponibile = function (s, merce, tipo) {
    const t = s.trasbordo && s.trasbordo[merce];
    let q = 0;
    if (t) for (const k in t) if (k !== tipo) q += t[k];
    return q;
  };
  const altroRitira = G.altroRitira = (st, s, v) => st.veicoli.some(w => w !== v && w.tipo !== v.tipo && w.merce === v.merce && w.fermate.some(f => f.s === s.id));

  function carica(st, v, s, dt) {
    if (!s.servite[v.merce]) return;
    const tr = G.trasbordoDisponibile(s, v.merce, v.tipo), disp = (s.attesa[v.merce] || 0) + tr, spazio = v.cap - v.qta;
    if (disp < 0.01 || spazio <= 0.01) return;
    const q = Math.min(disp, spazio, ritmo(v, s) * dt);
    let resto = q;
    if (tr > 0) { const t = s.trasbordo[v.merce]; for (const k in t) if (k !== v.tipo && resto > 0) { const x = Math.min(t[k], resto); t[k] -= x; resto -= x; } }
    s.attesa[v.merce] = Math.max(0, (s.attesa[v.merce] || 0) - resto);
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
    const resta = s && s.servite[v.merce] && (s.attesa[v.merce] || 0) + G.trasbordoDisponibile(s, v.merce, v.tipo) >= 1 && v.qta < v.cap - 0.5;
    if (resta && v.attesa < 0.5) return;
    if (f && f.pieno && v.qta < v.cap - 0.5 && v.attesa < 120) return; // aspetta il carico pieno (al massimo 4 mesi)
    // attesa a tempo: resta fino all'ora indicata per riempirsi di più, ma parte prima se è pieno
    if (f && f.attesaMin > 0 && v.qta < v.cap - 0.5 && v.attesa < f.attesaMin * MINUTO) return;
    prossimaFermata(v);
    pianifica(st, v);
  }

  // pendenza (‰, positiva in salita) del tratto che il treno sta percorrendo; sulle linee costruite prima delle
  // quote si usa il terreno, ma senza superare la pendenza massima (non erano state progettate così)
  G.pendenzaTreno = function (st, v) {
    if (!v.caselle || v.seg + 1 >= v.caselle.length) return 0;
    const a = v.caselle[v.seg], b = v.caselle[v.seg + 1], m = st.mondo;
    const L = G.kmCasella(st) * 1000 * G.LUN[Math.max(0, G.direzione(m, a, b))];
    const p = (G.quotaRete(st, b, 'binario') - G.quotaRete(st, a, 'binario')) / L * 1000;
    const max = C.opere.pendenzaMax.binario;
    return m.quotaBin[a] === -32768 || m.quotaBin[b] === -32768 ? Math.max(-max, Math.min(max, p)) : p;
  };
  // in salita si rallenta: il vapore più delle elettriche e delle diesel, un treno lungo più di uno corto;
  // in discesa si frena un po'
  G.fattorePendenza = function (mod, v, p) {
    if (p <= 0) return Math.max(0.8, 1 + p / 150);
    const peso = 0.5 + 0.5 * (v.vagoni || 0) / (mod.vagoni || 1);
    return Math.max(0.25, 1 - p * peso / (/vapore/i.test(mod.nome) ? C.opere.salitaVapore : C.opere.salitaElettrica));
  };

  function velocita(st, v) {
    // caselle al giorno: km/h × 24 ore ÷ km per casella
    const mod = G.modello(v.modello), m = st.mondo, K = G.kmCasella(st) / 24;
    let vel = mod.kmh / K;
    if (v.tipo === 'treno') {
      vel *= 1 - 0.3 * v.vagoni / mod.vagoni;
      vel *= G.fattorePendenza(mod, v, G.pendenzaTreno(st, v));
    } else if (v.tipo === 'strada') {
      vel = Math.min(mod.kmh, m.tipoStr[v.tile] === 2 ? 130 : 80) / K;
      const t = m.tipo[v.tile];
      if (t === T.COLLINA) vel *= 0.9; else if (t === T.MONTAGNA) vel *= 0.8;
    } else if (v.tipo === 'nave') {
      const d = Math.min(v.pos, v.lunTot - v.pos);
      if (d < 1.5) vel *= 0.4 + 0.6 * d / 1.5; // manovra in porto
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
      if (v.tipo === 'aereo' || v.tipo === 'nave' || !v.caselle) continue; // l'acqua e il cielo non cambiano
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
      completaConti(st, v);
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
    if (g) p.push(g + _(' g'));
    if (h) p.push(h + _(' h'));
    if (m || !p.length) p.push(m + _(' min'));
    return p.join(' ');
  };

  G.statoVeicolo = function (st, v) {
    const f = v.fermate[v.idx], s = f && st.stazioni[f.s];
    switch (v.stato) {
      case 'sosta': {
        if (!s) return _('In sosta');
        const pieno = v.qta >= v.cap - 0.5;
        if (f.pieno && !pieno && v.timer <= 0) return _`Attende il carico pieno a ${s.nome}`;
        if (f.attesaMin > 0 && !pieno && v.timer <= 0) {
          const resta = f.attesaMin - v.attesa * 1440;
          if (resta > 0) return _`Attende a ${s.nome} (ancora ${G.testoDurata(resta)})`;
        }
        return _`In sosta a ${s.nome}`;
      }
      case 'viaggio': {
        if (v.bloccatoDa) {
          const altro = st.veicoli.find(k => k.id === v.bloccatoDa);
          if (v.stallo) return _`Stallo! ${altro ? altro.nome + _(' e questo treno') : _('I treni')} si bloccano a vicenda: premi «Torna indietro»`;
          return _`Fermo al segnale: binario occupato${altro ? _(' da ') + altro.nome : ''}`;
        }
        return s ? _`Diretto a ${s.nome}` : _('In viaggio');
      }
      case 'guasto': return _('Guasto! Riparazione in corso');
      case 'bloccato': return v.motivo || _('Bloccato');
      default: return _('Fermo: aggiungi delle fermate');
    }
  };
})();
