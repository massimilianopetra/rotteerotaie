// Interfaccia: barra in alto, attrezzi, pannello informazioni, finestre, mouse e tastiera.
// I pulsanti usano l'attributo data-az="nomeAzione": un unico gestore di clic chiama AZIONI[nomeAzione].
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO, OCC = G.OCC;
  const $ = s => document.querySelector(s);
  const D = G.disegno;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const st = () => G.st;

  const ui = G.ui = {
    strumento: 'info', pannello: null, trascina: null, anteprima: null, bacino: null, cursore: -1,
    selVeicolo: null, segui: false, griglia: false, velocita: 1, percorso: false, tasti: new Set(),
    mouseSuPannello: false, ultimaVel: 1, tagliaStazione: 'media'
  };

  // icone delle stazioni ferroviarie (SVG 40×40): binario e banchina in basso, fabbricato sopra
  const BINARIO_SVG = '<rect x="1" y="30" width="38" height="7" fill="#6b5136"/><rect x="1" y="31" width="38" height="1.6" fill="#d4d7db"/>' +
    '<rect x="1" y="34.4" width="38" height="1.6" fill="#d4d7db"/><rect x="2" y="25.5" width="36" height="4" rx="1" fill="#d9d2c1"/>';
  const ICONE_STAZIONE = {
    fermata: BINARIO_SVG +
      '<path d="M10 17 L20 11.5 L30 17 Z" fill="#8c5a3c"/><rect x="12" y="17" width="16" height="8.5" fill="#ead9b0"/>' +
      '<rect x="18" y="19.5" width="4" height="6" fill="#5a3a24"/><rect x="13.5" y="19" width="3" height="3" fill="#7fb2d9"/><rect x="23.5" y="19" width="3" height="3" fill="#7fb2d9"/>' +
      '<rect x="33" y="13" width="1.4" height="12.5" fill="#3b3b3b"/><rect x="30" y="10.5" width="7.4" height="4" rx="1" fill="#2f6db5"/>',
    media: BINARIO_SVG +
      '<path d="M4 15 L20 6 L36 15 Z" fill="#b04a32"/><path d="M20 6 L36 15 L20 15 Z" fill="#8f3a27"/><rect x="6" y="15" width="28" height="10.5" fill="#ead9b0"/>' +
      '<path d="M17.5 25.5 V20.5 A2.5 2.5 0 0 1 22.5 20.5 V25.5 Z" fill="#5a3a24"/>' +
      '<rect x="8.5" y="18" width="3.5" height="4" fill="#7fb2d9"/><rect x="13" y="18" width="3.5" height="4" fill="#7fb2d9"/>' +
      '<rect x="23.5" y="18" width="3.5" height="4" fill="#7fb2d9"/><rect x="28" y="18" width="3.5" height="4" fill="#7fb2d9"/>' +
      '<circle cx="20" cy="11.3" r="2.6" fill="#f7f1e0" stroke="#3a2a1a" stroke-width="0.8"/><path d="M20 11.3 V9.6 M20 11.3 H21.3" stroke="#3a2a1a" stroke-width="0.6"/>',
    grande: BINARIO_SVG +
      '<path d="M1.5 18 L6 13 H34 L38.5 18 Z" fill="#8f3a27"/><rect x="2.5" y="18" width="35" height="7.5" fill="#ead9b0"/>' +
      '<path d="M12 10 L20 3.5 L28 10 Z" fill="#c95b3f"/><rect x="13" y="10" width="14" height="15.5" fill="#f1e3c0"/>' +
      '<path d="M17.5 25.5 V21 A2.5 2.5 0 0 1 22.5 21 V25.5 Z" fill="#5a3a24"/>' +
      '<rect x="4.5" y="20" width="3" height="3.5" fill="#7fb2d9"/><rect x="9" y="20" width="3" height="3.5" fill="#7fb2d9"/>' +
      '<rect x="28" y="20" width="3" height="3.5" fill="#7fb2d9"/><rect x="32.5" y="20" width="3" height="3.5" fill="#7fb2d9"/>' +
      '<circle cx="20" cy="15" r="3" fill="#f7f1e0" stroke="#3a2a1a" stroke-width="0.8"/><path d="M20 15 V13 M20 15 H21.5" stroke="#3a2a1a" stroke-width="0.6"/>',
    centrale: BINARIO_SVG +
      '<path d="M3 24 Q20 1 37 24 Z" fill="#a9c2d6" stroke="#5b6770" stroke-width="1"/>' +
      '<path d="M8 24 Q20 6 32 24 M14 24 Q20 11 26 24 M20 5.5 V24" fill="none" stroke="#5b6770" stroke-width="0.6"/>' +
      '<rect x="6" y="17" width="28" height="8.5" fill="#ead9b0"/><rect x="6" y="15.5" width="28" height="2" fill="#b04a32"/>' +
      '<rect x="3" y="9" width="6" height="16.5" fill="#d9c79e"/><path d="M2.5 9 L6 4.5 L9.5 9 Z" fill="#5b6770"/>' +
      '<rect x="31" y="9" width="6" height="16.5" fill="#d9c79e"/><path d="M30.5 9 L34 4.5 L37.5 9 Z" fill="#5b6770"/>' +
      '<path d="M16.5 25.5 V21.5 A3.5 3.5 0 0 1 23.5 21.5 V25.5 Z" fill="#5a3a24"/>' +
      '<rect x="10" y="19" width="3" height="3.5" fill="#7fb2d9"/><rect x="27" y="19" width="3" height="3.5" fill="#7fb2d9"/>' +
      '<circle cx="20" cy="13.5" r="2.8" fill="#f7f1e0" stroke="#3a2a1a" stroke-width="0.8"/><path d="M20 13.5 V11.7 M20 13.5 H21.4" stroke="#3a2a1a" stroke-width="0.6"/>'
  };
  const iconaStazione = t => `<svg viewBox="0 0 40 40" aria-hidden="true">${ICONE_STAZIONE[t] || ICONE_STAZIONE.media}</svg>`;
  G.iconaStazione = iconaStazione;

  const STRUMENTI = [
    { id: 'info', icona: '🔍', nome: 'Informazioni / sposta la mappa', tasto: 'I' },
    { id: 'binario', icona: '🛤️', nome: 'Costruisci ferrovia (trascina)', tasto: 'B' },
    { id: 'strada', icona: '🛣️', nome: 'Costruisci strada (trascina)', tasto: 'R' },
    { id: 'autostrada', icona: '🚧', nome: 'Costruisci autostrada (trascina)', tasto: 'U' },
    { id: 'stazione', icona: '🚉', nome: 'Stazione ferroviaria: clic per scegliere le dimensioni', tasto: 'T' },
    { id: 'deposito', icona: '🚏', nome: 'Autostazione (bus e camion)', tasto: 'F' },
    { id: 'aeroporto', icona: '✈️', nome: 'Aeroporto', tasto: 'A' },
    { id: 'demolisci', icona: '💥', nome: 'Demolisci', tasto: 'X' }
  ];
  const RETI = ['binario', 'strada', 'autostrada'];
  const STAZIONI = ['stazione', 'deposito', 'aeroporto'];

  // ---------------------------------------------------------------- avvisi
  let timerAvviso = 0;
  G.avviso = function (testo, errore) {
    const a = $('#avviso');
    a.textContent = testo;
    a.className = errore ? 'visibile errore' : 'visibile';
    clearTimeout(timerAvviso);
    timerAvviso = setTimeout(() => { a.className = ''; }, 2600);
  };

  G.suNotizia = function (n) {
    const box = $('#notizie');
    const div = document.createElement('div');
    div.className = 'notizia nuova';
    if (n.x !== undefined) { div.dataset.az = 'vaiA'; div.dataset.x = n.x; div.dataset.y = n.y; div.title = 'Clic per andare sul posto'; }
    div.innerHTML = `<b>${esc(n.data)}</b> ${esc(n.testo)}`;
    box.prepend(div);
    while (box.children.length > 4) box.lastChild.remove();
    setTimeout(() => div.classList.remove('nuova'), 1500);
  };

  // ---------------------------------------------------------------- camera
  G.vaiA = function (x, y, ts) {
    D.cam.x = x; D.cam.y = y;
    if (ts) D.cam.ts = ts;
    limitaCamera();
  };
  function limitaCamera() {
    const s = st(); if (!s) return;
    D.cam.x = Math.max(0, Math.min(s.mondo.W, D.cam.x));
    D.cam.y = Math.max(0, Math.min(s.mondo.H, D.cam.y));
  }
  function zoom(f, sx, sy) {
    const cv = $('#mappa');
    if (sx === undefined) { sx = cv.clientWidth / 2; sy = cv.clientHeight / 2; }
    // il punto sotto il mouse si calcola dalla camera, non dall'ultimo fotogramma disegnato:
    // con più scatti di rotellina fra due fotogrammi la vista altrimenti scivolerebbe via
    const p = { x: D.cam.x + (sx - cv.clientWidth / 2) / D.cam.ts, y: D.cam.y + (sy - cv.clientHeight / 2) / D.cam.ts };
    D.cam.ts = Math.max(3, Math.min(48, D.cam.ts * f));
    D.cam.x = p.x - (sx - cv.clientWidth / 2) / D.cam.ts;
    D.cam.y = p.y - (sy - cv.clientHeight / 2) / D.cam.ts;
    limitaCamera();
  }
  ui.aggiornaCamera = function (dt) {
    const v = 700 * dt / D.cam.ts;
    if (ui.tasti.has('ArrowLeft')) D.cam.x -= v;
    if (ui.tasti.has('ArrowRight')) D.cam.x += v;
    if (ui.tasti.has('ArrowUp')) D.cam.y -= v;
    if (ui.tasti.has('ArrowDown')) D.cam.y += v;
    if (ui.segui && ui.selVeicolo && st()) {
      const veic = st().veicoli.find(k => k.id === ui.selVeicolo);
      if (veic) { D.cam.x += (veic.x - D.cam.x) * Math.min(1, dt * 5); D.cam.y += (veic.y - D.cam.y) * Math.min(1, dt * 5); }
      else ui.segui = false;
    }
    limitaCamera();
  };

  // ---------------------------------------------------------------- strumenti
  // ---------------------------------------------------------------- menu delle dimensioni delle stazioni
  function aggiornaPulsanteStazione() {
    const b = document.querySelector('#attrezzi button[data-id="stazione"]');
    if (b) b.innerHTML = iconaStazione(ui.tagliaStazione) + '<span class="freccina">▸</span>';
  }
  function apriMenuStazioni() {
    const s0 = st(), menu = $('#menuStazioni'), b = document.querySelector('#attrezzi button[data-id="stazione"]');
    const anno = s0 ? G.anno(s0) : 0;
    let h = '<div class="titolo">Dimensioni della stazione</div>';
    for (const k in C.taglieStazione) {
      const t = G.defStazione('stazione', k), lb = t.lato + 2 * t.raggio, ok = anno >= t.anno;
      h += `<button data-az="taglia" data-t="${k}" class="${k === ui.tagliaStazione ? 'attivo' : ''}" ${ok ? '' : 'disabled'}>
        ${iconaStazione(k)}<span><b>${t.nome}</b><span class="sotto">${t.lato}×${t.lato} caselle · bacino ${lb}×${lb}<br>
        ${G.lire(t.costo)} · manutenzione ${G.lire(t.manutenzione)} l'anno<br>carico e scarico ×${String(t.carico).replace('.', ',')}${ok ? '' : ` · dal ${t.anno}`}</span></span></button>`;
    }
    menu.innerHTML = h;
    const r = b.getBoundingClientRect();
    menu.classList.remove('nascosto'); // prima si mostra, poi si misura l'altezza
    menu.style.top = Math.max(50, Math.min(r.top, window.innerHeight - menu.offsetHeight - 10)) + 'px';
  }
  const chiudiMenuStazioni = () => $('#menuStazioni').classList.add('nascosto');
  const menuStazioniAperto = () => !$('#menuStazioni').classList.contains('nascosto');

  function scegliStrumento(id) {
    if (id !== 'stazione') chiudiMenuStazioni();
    ui.strumento = id; ui.trascina = null; ui.anteprima = null; ui.bacino = null;
    if (id !== 'info') ui.percorso = false;
    document.querySelectorAll('#attrezzi button').forEach(b => b.classList.toggle('attivo', b.dataset.id === id));
    $('#suggerimento').style.display = 'none';
    const s = st();
    if (s && RETI.includes(id) && G.anno(s) < C.reti[id].anno) G.avviso(`${C.reti[id].nome}: disponibile dal ${C.reti[id].anno}`, true);
    if (s && STAZIONI.includes(id) && G.anno(s) < G.defStazione(id, ui.tagliaStazione).anno) G.avviso(`${C.stazioni[id].nome}: disponibile dal ${C.stazioni[id].anno}`, true);
    $('#mappa').style.cursor = id === 'info' ? 'grab' : 'crosshair';
  }

  function impostaVelocita(v) {
    if (v > 0) ui.ultimaVel = v;
    ui.velocita = v;
    document.querySelectorAll('#velocita button').forEach(b => b.classList.toggle('attivo', +b.dataset.v === v));
  }

  // ---------------------------------------------------------------- pannello informazioni
  function barra(frac, colore) {
    return `<div class="barra"><div style="width:${Math.round(Math.max(0, Math.min(1, frac)) * 100)}%;background:${colore || '#5b8def'}"></div></div>`;
  }
  const nomeMerce = k => C.merci[k].nome;
  const pallino = k => `<span class="pallino" style="background:${C.merci[k].colore}"></span>`;
  const elencoMerci = o => Object.keys(o).filter(k => o[k]).map(k => pallino(k) + nomeMerce(k)).join(', ') || '—';

  // per ogni merce che la stazione fornisce: quanta ne aspetta in stazione, pronta per partire.
  // La barra mostra quanti carichi pieni sono: la riempie un carico del mezzo più capiente che la ritira qui.
  function schedeFornisce(s0, s) {
    const merci = Object.keys(C.merci).filter(k => s.fornisce[k] || (s.attesa[k] || 0) >= 1);
    if (!merci.length) return '<h4>Fornisce</h4><div class="sotto">Nulla: nel bacino non ci sono case né industrie che producono.</div>';
    let h = '<h4>Fornisce · pronti a partire</h4><div class="schede-merci">';
    for (const k of merci) {
      const def = C.merci[k], q = Math.floor(s.attesa[k] || 0);
      const mezzi = s0.veicoli.filter(v => v.merce === k && v.fermate.some(f => f.s === s.id));
      const cap = Math.max(0, ...mezzi.map(v => v.cap));
      let nota, frac = 0;
      if (!s.servite[k]) nota = '<span class="avviso-merce">Nessun mezzo la ritira: compra un mezzo per farla partire</span>';
      else {
        const val = G.valutazione(s0, s, k), pv = Math.round(val * 100);
        const colVal = pv >= 66 ? 'var(--verde)' : pv >= 33 ? 'var(--accento)' : 'var(--rosso)';
        frac = cap ? q / cap : 0;
        const carichi = cap ? (frac >= 10 ? Math.round(frac) : frac.toFixed(1).replace('.', ',')) : '—';
        nota = `≈ ${carichi} ${frac >= 0.95 && frac < 1.05 ? 'carico' : 'carichi'} · ${mezzi.length} ${mezzi.length === 1 ? 'mezzo' : 'mezzi'} · valutazione <b style="color:${colVal}">${pv}%</b>`;
      }
      h += `<div class="scheda-merce${s.servite[k] ? '' : ' spenta'}" style="--c:${def.colore}" title="${def.nome}: ${G.numero(q)} ${def.unita} in attesa in stazione">
        <div class="sm-icona">${def.icona}</div>
        <div class="sm-corpo">
          <div class="sm-riga"><span class="sm-nome">${def.nome}</span><span class="sm-num">${G.numero(q)}<small> ${def.unita}</small></span></div>
          <div class="sm-barra"><div style="width:${Math.round(Math.min(1, frac) * 100)}%"></div>${frac > 1 ? `<span class="sm-pieno">×${Math.floor(frac)}</span>` : ''}</div>
          <div class="sm-nota">${nota}</div>
        </div></div>`;
    }
    return h + '</div><div class="nota">La valutazione sale quando i mezzi passano spesso: più è alta, più passeggeri e merci arrivano alla stazione.</div>';
  }

  function htmlStazione(s0, s) {
    const def = G.defStazione(s);
    const icona = s.tipo === 'stazione' ? `<span class="icona-titolo">${iconaStazione(def.taglia)}</span>` : def.icona;
    let h = `<h3>${icona} ${esc(s.nome)}</h3><div class="sotto">${G.nomeTipoStazione(s)}</div>`;
    if (s.tipo === 'stazione') {
      const lb = s.lato + 2 * def.raggio;
      h += `<p><b>Dimensioni:</b> ${s.lato}×${s.lato} caselle · bacino ${lb}×${lb} · carico ×${String(def.carico).replace('.', ',')}</p>`;
    }
    if (!G.stazioneCollegata(s0, s)) {
      h += `<p class="rosso">⚠ ${s.tipo === 'stazione'
        ? 'Nessun binario passa sulla stazione: i treni non possono arrivarci. Trascina una ferrovia fin sopra una delle sue caselle.'
        : 'Nessuna strada arriva all\'autostazione: costruiscine una fin sopra la sua casella.'}</p>`;
    }
    h += `<p><b>Abitanti nel bacino:</b> ${G.numero(s.popBacino)}</p>`;
    h += schedeFornisce(s0, s);
    const acc = Object.keys(C.merci).filter(k => s.accetta[k]);
    h += `<h4>Accetta</h4><div class="chips">${acc.length ? acc.map(k => `<span class="chip" style="--c:${C.merci[k].colore}">${C.merci[k].icona} ${nomeMerce(k)}</span>`).join('') : '<span class="sotto">nulla</span>'}</div>`;
    if (s.industrie.length) {
      h += '<h4>Industrie vicine</h4>';
      for (const id of s.industrie) { const ind = s0.industrie[id]; h += `<div class="link" data-az="apriIndustria" data-id="${id}">${C.industrie[ind.tipo].icona} ${esc(ind.nome)}</div>`; }
    }
    const veic = s0.veicoli.filter(v => v.fermate.some(f => f.s === s.id));
    h += `<h4>Mezzi che si fermano qui (${veic.length})</h4>`;
    for (const v of veic) h += `<div class="link" data-az="apriVeicolo" data-id="${v.id}">${esc(v.nome)} · ${pallino(v.merce)}${nomeMerce(v.merce)}</div>`;
    const cosa = { stazione: 'un treno', deposito: 'un autobus o un camion', aeroporto: 'un aereo' }[s.tipo];
    h += `<div class="pulsanti"><button class="primario" data-az="acquista" data-id="${s.id}">🛒 Compra ${cosa}</button>`;
    h += `<button data-az="demolisciStazione" data-id="${s.id}">💥 Demolisci</button></div>`;
    return h;
  }

  function htmlCitta(s0, c) {
    const ms = c.meseScorso;
    let h = `<h3>🏙️ ${esc(c.nome)}</h3><div class="sotto">${G.classeCitta(c.pop)} · ${G.numero(c.pop)} abitanti · ${c.case} edifici</div>`;
    h += `<p><b>Crescita del mese scorso:</b> ${c.crescita >= 0 ? '+' : ''}${G.numero(c.crescita)} abitanti</p>`;
    h += `<p><b>Stazioni servite:</b> ${c.nServite}</p><h4>Mese scorso</h4><table>
      <tr><td>Passeggeri partiti</td><td class="num">${G.numero(ms.partiti)}</td></tr>
      <tr><td>Passeggeri arrivati</td><td class="num">${G.numero(ms.arrivati)}</td></tr>
      <tr><td>Posta</td><td class="num">${G.numero(ms.posta)}</td></tr>
      <tr><td>Merci consegnate</td><td class="num">${G.numero(ms.merci)}</td></tr>
      <tr><td>Cibo consegnato</td><td class="num">${G.numero(ms.cibo)}</td></tr>
      <tr><td>Carburante consegnato</td><td class="num">${G.numero(ms.carburante)}</td></tr></table>`;
    h += grafico(c.storico.slice(-120), '#f2c94c');
    h += '<div class="nota">Una città cresce se è collegata: stazioni servite, passeggeri e posta in movimento, e consegne di merci, cibo e carburante. Le case nuove nascono lungo le strade e attorno alle stazioni.</div>';
    return h;
  }

  function grafico(valori, colore) {
    if (valori.length < 2) return '';
    const w = 260, h = 50, max = Math.max(...valori), min = Math.min(...valori), d = max - min || 1;
    const pts = valori.map((v, k) => `${(k / (valori.length - 1) * w).toFixed(1)},${(h - 2 - (v - min) / d * (h - 4)).toFixed(1)}`).join(' ');
    return `<svg class="grafico" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${colore}" stroke-width="2"/></svg>`;
  }

  function htmlIndustria(s0, ind) {
    const def = C.industrie[ind.tipo];
    let h = `<h3>${def.icona} ${esc(ind.nome)}</h3>`;
    if (ind.chiusa) return h + '<p>Chiusa.</p>';
    if (def.produce) {
      h += `<p><b>Produce:</b> ${pallino(def.produce)}${nomeMerce(def.produce)}, circa ${G.numero(ind.produzione)} ${C.merci[def.produce].unita} al mese</p>`;
      h += `<p><b>Trasportato il mese scorso:</b> ${Math.round(ind.perc * 100)}% ${barra(ind.perc, '#4caf50')}</p>`;
      if (def.riserva) {
        const f = ind.riserva / ind.riservaIniziale;
        h += `<p><b>Riserva del giacimento:</b> ${G.numero(ind.riserva)} ${C.merci[def.produce].unita} ${barra(f, f < 0.2 ? '#e74c3c' : '#c9a227')}</p>`;
        const anni = ind.produzione > 0 ? ind.riserva / ind.produzione / 12 : 0;
        h += `<div class="nota">Al ritmo attuale si esaurisce in circa ${anni.toFixed(1)} anni.</div>`;
      } else h += '<div class="nota">Risorsa rinnovabile: non si esaurisce.</div>';
    }
    if (def.accetta) {
      h += `<p><b>Accetta:</b> ${def.accetta.map(k => pallino(k) + nomeMerce(k)).join(', ')}</p>`;
      if (def.uscita) {
        h += `<p><b>Produce:</b> ${pallino(def.uscita)}${nomeMerce(def.uscita)} (${Math.round(def.resa * 100)}% di quanto riceve)</p>`;
        h += `<p><b>Prodotto il mese scorso:</b> ${G.numero(ind.prodScorso)} · trasportato ${Math.round(ind.perc * 100)}%</p>`;
      } else h += '<div class="nota">Consuma il carbone per produrre elettricità: paga le consegne ma non produce merci.</div>';
      const ric = ind.ricevutoScorso || {};
      if (Object.keys(ric).length) h += '<p><b>Ricevuto il mese scorso:</b> ' + Object.keys(ric).map(k => `${G.numero(ric[k])} ${C.merci[k].unita} di ${nomeMerce(k).toLowerCase()}`).join(', ') + '</p>';
    }
    const staz = ind.stazioni.map(id => s0.stazioni[id]).filter(Boolean);
    h += `<p><b>Stazioni vicine:</b> ${staz.length ? staz.map(s => `<span class="link" data-az="apriStazione" data-id="${s.id}">${esc(s.nome)}</span>`).join(', ') : 'nessuna'}</p>`;
    return h;
  }

  function htmlVeicolo(s0, v) {
    const mod = G.modello(v.modello);
    let h = `<h3>${{ treno: '🚂', bus: '🚌', camion: '🚚', aereo: '✈️' }[v.classe]} ${esc(v.nome)}</h3>`;
    h += `<div class="sotto">${esc(mod.nome)}${v.vagoni ? ` · ${v.vagoni} vagoni` : ''} · ${mod.kmh} km/h · ${v.eta} anni</div>`;
    h += `<p class="${v.stato === 'bloccato' || v.stato === 'guasto' ? 'rosso' : ''}"><b>Stato:</b> ${esc(G.statoVeicolo(s0, v))}</p>`;
    h += `<p><b>Carico:</b> ${pallino(v.merce)}${G.numero(Math.floor(v.qta))} / ${G.numero(v.cap)} ${C.merci[v.merce].unita} di ${nomeMerce(v.merce).toLowerCase()} ${barra(v.qta / v.cap, C.merci[v.merce].colore)}</p>`;
    h += `<table><tr><td>Profitto quest'anno</td><td class="num ${v.profittoAnno < 0 ? 'rosso' : 'verde'}">${G.lire(v.profittoAnno)}</td></tr>
      <tr><td>Profitto anno scorso</td><td class="num ${v.profittoScorso < 0 ? 'rosso' : 'verde'}">${G.lire(v.profittoScorso)}</td></tr>
      <tr><td>Costo annuo</td><td class="num">${G.lire(G.esercizioVeicolo(v))}</td></tr>
      <tr><td>Valore</td><td class="num">${G.lire(G.valoreVeicolo(v))}</td></tr>
      <tr><td>Guasti</td><td class="num">${v.guasti}</td></tr></table>`;
    h += '<h4>Percorso</h4>';
    if (ui.percorso) h += '<div class="banda">Clicca sulle stazioni da aggiungere al percorso. <b>Esc</b> o il pulsante qui sotto per finire.</div>';
    h += '<ol class="fermate">';
    v.fermate.forEach((f, k) => {
      const s = s0.stazioni[f.s];
      let avv = '';
      if (s && !s.accetta[v.merce] && !s.fornisce[v.merce]) avv = `<span class="rosso" title="Qui ${nomeMerce(v.merce).toLowerCase()} non si carica e non si scarica">⚠</span> `;
      else if (s && !s.accetta[v.merce]) avv = `<span class="sotto" title="Qui si carica soltanto">⬆</span> `;
      else if (s && !s.fornisce[v.merce]) avv = `<span class="sotto" title="Qui si scarica soltanto">⬇</span> `;
      // come aspetta in questa fermata: parte subito, aspetta il pieno, o aspetta un certo tempo
      const modo = f.pieno ? 'pieno' : f.attesaMin > 0 ? 'tempo' : '';
      const am = f.attesaMin || 0;
      const campo = (u, val, max) => `<input type="number" class="durata" data-az="durata" data-k="${k}" data-u="${u}" min="0" max="${max}" value="${val}">`;
      h += `<li class="${k === v.idx ? 'attuale' : ''}">${avv}<span class="link" data-az="apriStazione" data-id="${f.s}">${s ? esc(s.nome) : '?'}</span>
        <button class="mini" data-az="suFermata" data-k="${k}" title="Sposta su">▲</button><button class="mini" data-az="togliFermata" data-k="${k}" title="Togli">✕</button>
        <div class="attesaFermata"><select data-az="modoAttesa" data-k="${k}" title="Quanto aspetta in questa stazione prima di ripartire">
          <option value="" ${modo === '' ? 'selected' : ''}>parte appena carico</option>
          <option value="pieno" ${modo === 'pieno' ? 'selected' : ''}>attende il pieno</option>
          <option value="tempo" ${modo === 'tempo' ? 'selected' : ''}>attende fino a…</option></select>
        ${modo === 'tempo' ? `<span class="durate" title="Riparte allo scadere del tempo, o prima se è pieno">${campo('g', Math.floor(am / 1440), 120)} g ${campo('h', Math.floor((am % 1440) / 60), 23)} h ${campo('m', am % 60, 59)} min</span>` : ''}</div></li>`;
    });
    h += '</ol>';
    if (v.fermate.length) h += '<div class="nota">⬆ qui si carica soltanto · ⬇ qui si scarica soltanto · ⚠ qui questa merce non si carica né si scarica</div>';
    if (v.fermate.length < 2 && !ui.percorso) h += '<div class="nota">Servono almeno due fermate: premi «Aggiungi fermate» e clicca sulle stazioni.</div>';
    h += `<div class="pulsanti">
      <button class="${ui.percorso ? 'attivo' : 'primario'}" data-az="fermate">${ui.percorso ? '✔ Fine fermate' : '➕ Aggiungi fermate'}</button>
      <button class="${ui.segui ? 'attivo' : ''}" data-az="segui">🎥 Segui</button>
      <button data-az="fermaVeicolo">${v.fermoManuale ? '▶ Riparti' : '⏸ Resta in stazione'}</button>
      ${v.tipo !== 'aereo' && (v.stato === 'viaggio' || v.stato === 'bloccato') ? `<button class="${v.stallo ? 'attivo' : ''}" data-az="tornaIndietro" title="Torna alla fermata precedente (per sbloccare due treni che si bloccano a vicenda)">↩ Torna indietro</button>` : ''}
      <button data-az="vendi">💰 Vendi (${G.lire(G.valoreVeicolo(v))})</button></div>`;
    return h;
  }

  function htmlCasella(s0, i) {
    const m = s0.mondo, x = i % m.W, y = (i / m.W) | 0, t = G.NOMI_TERRENO[m.tipo[i]];
    let h = `<h3>📍 Casella ${x}, ${y}</h3><p><b>Terreno:</b> ${t}${m.bosco[i] ? ', bosco' : ''}</p>`;
    if (m.tipo[i] !== G.T.ACQUA) {
      h += `<p><b>Costo per casella:</b> ferrovia ${G.lire(C.reti.binario.costo * C.moltTerreno[t])}, strada ${G.lire(C.reti.strada.costo * C.moltTerreno[t])}</p>`;
      if (m.tipo[i] === G.T.FIUME) h += '<div class="nota">Sul fiume serve un ponte: costa di più.</div>';
    }
    const c = G.cittaVicina(s0, x, y);
    if (c) h += `<p><b>Città più vicina:</b> <span class="link" data-az="apriCitta" data-id="${c.id}">${esc(c.nome)}</span></p>`;
    if (m.mBin[i]) h += '<p>🛤️ Binario</p>';
    if (m.mStr[i]) h += `<p>${m.tipoStr[i] === 2 ? '🚧 Autostrada' : m.strCitta[i] ? '🛣️ Strada comunale' : '🛣️ Strada'}</p>`;
    return h;
  }

  ui.apriPannello = function (tipo, id) {
    ui.pannello = { tipo, id };
    if (tipo !== 'veicolo') { ui.percorso = false; if (tipo !== 'stazione') ui.selVeicolo = null; }
    if (tipo === 'veicolo') ui.selVeicolo = id;
    disegnaPannello();
  };
  function chiudiPannello() {
    ui.pannello = null; ui.selVeicolo = null; ui.percorso = false; ui.segui = false;
    $('#pannello').classList.add('nascosto');
  }
  function disegnaPannello() {
    const s0 = st(), p = ui.pannello, el = $('#pannello');
    if (!p || !s0) { el.classList.add('nascosto'); return; }
    let h = '';
    if (p.tipo === 'stazione') { const s = s0.stazioni[p.id]; if (s) h = htmlStazione(s0, s); }
    else if (p.tipo === 'citta') h = htmlCitta(s0, s0.citta[p.id]);
    else if (p.tipo === 'industria') h = htmlIndustria(s0, s0.industrie[p.id]);
    else if (p.tipo === 'veicolo') { const v = s0.veicoli.find(k => k.id === p.id); if (v) h = htmlVeicolo(s0, v); }
    else if (p.tipo === 'casella') h = htmlCasella(s0, p.id);
    if (!h) { chiudiPannello(); return; }
    el.innerHTML = '<button class="chiudi" data-az="chiudiPannello" title="Chiudi (Esc)">✕</button>' + h;
    el.classList.remove('nascosto');
  }

  // ---------------------------------------------------------------- finestre
  function apriFinestra(titolo, corpo, larga) {
    $('#finestra .testa span').textContent = titolo;
    $('#finestra .corpo').innerHTML = corpo;
    $('#finestra .riquadro').classList.toggle('larga', !!larga);
    $('#finestra').classList.remove('nascosto');
    ui.finestra = titolo;
  }
  function chiudiFinestra() {
    if (!st()) return; // senza partita la finestra di avvio resta
    $('#finestra').classList.add('nascosto');
    ui.finestra = null;
  }

  function finestraAcquisto(sid) {
    const s0 = st(), s = s0.stazioni[sid];
    const tipo = { stazione: 'treno', deposito: 'strada', aeroporto: 'aereo' }[s.tipo];
    const mod = G.modelliDisponibili(s0, tipo);
    if (!mod.length) { G.avviso('Nessun mezzo disponibile in questo anno', true); return; }
    let h = `<p>Il mezzo parte da <b>${esc(s.nome)}</b>. Dopo l'acquisto aggiungi le altre fermate cliccando sulle stazioni.</p>`;
    h += `<label>Modello<select id="acqModello" data-cambia="acquisto">${mod.map(k => `<option value="${k.id}">${esc(k.nome)} — ${k.kmh} km/h — ${G.lire(k.costo)}</option>`).join('')}</select></label>`;
    h += '<label>Merce<select id="acqMerce" data-cambia="acquisto"></select></label>';
    if (tipo === 'treno') h += '<label>Vagoni: <b id="acqNumVag">3</b><input type="range" id="acqVagoni" min="1" max="4" value="3" data-cambia="acquisto"></label>';
    h += `<div id="acqRiepilogo" class="riepilogo"></div><div class="pulsanti"><button class="primario" data-az="confermaAcquisto" data-id="${sid}">🛒 Compra</button><button data-az="chiudiFinestra">Annulla</button></div>`;
    apriFinestra('Acquista un mezzo', h);
    // merce suggerita: la prima che la stazione fornisce
    aggiornaAcquisto(true, s);
  }
  function aggiornaAcquisto(primo, s) {
    const mod = G.modello($('#acqModello').value);
    const selM = $('#acqMerce'), prima = selM.value;
    const permesse = G.merciPermesse(mod);
    selM.innerHTML = permesse.map(k => `<option value="${k}">${C.merci[k].nome}</option>`).join('');
    if (permesse.includes(prima)) selM.value = prima;
    if (primo && s) { const f = permesse.find(k => s.fornisce[k]); if (f) selM.value = f; }
    let vag = 0;
    const r = $('#acqVagoni');
    if (r) { r.max = mod.vagoni; if (+r.value > mod.vagoni) r.value = mod.vagoni; vag = +r.value; $('#acqNumVag').textContent = vag; }
    const merce = selM.value, cap = G.capacita(mod, merce, vag);
    const prezzo = G.prezzoVeicolo(mod, vag);
    $('#acqRiepilogo').innerHTML = `Capacità: <b>${G.numero(cap)} ${C.merci[merce].unita}</b> · Prezzo: <b class="${prezzo > st().soldi ? 'rosso' : ''}">${G.lire(prezzo)}</b> · Costo annuo: ${G.lire(mod.esercizio + vag * C.vagone.esercizio)}`;
  }

  function finestraVeicoli() {
    const s0 = st();
    let h = '';
    if (!s0.veicoli.length) h = '<p>Non hai ancora mezzi. Costruisci due stazioni collegate, poi clicca su una stazione e premi «Compra».</p>';
    else {
      h = '<table class="elenco"><tr><th>Mezzo</th><th>Merce</th><th>Stato</th><th>Profitto anno</th><th>Anno scorso</th><th>Età</th></tr>';
      for (const v of [...s0.veicoli].sort((a, b) => b.profittoAnno - a.profittoAnno)) {
        h += `<tr class="link" data-az="apriVeicolo" data-id="${v.id}"><td>${esc(v.nome)}<div class="sotto">${esc(G.modello(v.modello).nome)}</div></td>
          <td>${pallino(v.merce)}${nomeMerce(v.merce)}</td><td>${esc(G.statoVeicolo(s0, v))}</td>
          <td class="num ${v.profittoAnno < 0 ? 'rosso' : 'verde'}">${G.lire(v.profittoAnno)}</td>
          <td class="num ${v.profittoScorso < 0 ? 'rosso' : 'verde'}">${G.lire(v.profittoScorso)}</td><td class="num">${v.eta}</td></tr>`;
      }
      h += '</table>';
    }
    apriFinestra(`Mezzi (${s0.veicoli.length})`, h, true);
  }

  function finestraMondo(scheda) {
    const s0 = st();
    scheda = scheda || 'citta';
    let h = `<div class="schede">${['citta', 'industrie', 'stazioni'].map(k => `<button class="${k === scheda ? 'attivo' : ''}" data-az="schedaMondo" data-s="${k}">${{ citta: '🏙️ Città', industrie: '🏭 Industrie', stazioni: '🚉 Stazioni' }[k]}</button>`).join('')}</div>`;
    if (scheda === 'citta') {
      if (s0.citta.length > 200) h += '<input id="cercaCitta" class="cerca" placeholder="🔍 Cerca una città per nome…" autocomplete="off">';
      h += `<table class="elenco"><thead><tr><th>Città</th><th>Abitanti</th><th>Crescita</th><th>Stazioni servite</th></tr></thead><tbody id="elencoCitta">${righeCitta('')}</tbody>`;
    } else if (scheda === 'industrie') {
      h += '<table class="elenco"><tr><th>Industria</th><th>Produzione / mese</th><th>Trasportato</th><th>Riserva</th></tr>';
      for (const ind of s0.industrie.filter(k => !k.chiusa).sort((a, b) => a.tipo.localeCompare(b.tipo))) {
        const def = C.industrie[ind.tipo];
        const prod = def.produce ? `${G.numero(ind.produzione)} ${C.merci[def.produce].unita}` : def.uscita ? `${G.numero(ind.prodScorso)} ${C.merci[def.uscita].unita}` : '—';
        h += `<tr class="link" data-az="apriIndustria" data-id="${ind.id}" data-vai="1"><td>${def.icona} ${esc(ind.nome)}</td><td class="num">${prod}</td><td class="num">${Math.round(ind.perc * 100)}%</td><td>${def.riserva ? barra(ind.riserva / ind.riservaIniziale, '#c9a227') : ''}</td></tr>`;
      }
    } else {
      h += '<table class="elenco"><tr><th>Stazione</th><th>Tipo</th><th>In attesa</th></tr>';
      for (const s of s0.stazioni.filter(Boolean)) {
        const att = Object.keys(s.attesa).filter(k => s.attesa[k] >= 1).map(k => `${pallino(k)}${G.numero(s.attesa[k])}`).join(' ') || '—';
        h += `<tr class="link" data-az="apriStazione" data-id="${s.id}" data-vai="1"><td>${esc(s.nome)}</td><td>${G.nomeTipoStazione(s)}</td><td>${att}</td></tr>`;
      }
    }
    h += '</table>';
    apriFinestra('Il mondo', h, true);
  }

  // righe della tabella delle città: sulle mappe reali sono migliaia, quindi solo le 200 più grandi e quelle
  // servite, oppure quelle che contengono il testo cercato
  function righeCitta(cerca) {
    const s0 = st(), t = cerca.trim().toLowerCase();
    let el = [...s0.citta].sort((a, b) => b.pop - a.pop);
    if (t) el = el.filter(c => c.nome.toLowerCase().includes(t)).slice(0, 200);
    else if (el.length > 200) el = el.filter((c, k) => k < 200 || c.nServite > 0);
    let h = '';
    for (const c of el) {
      h += `<tr class="link" data-az="apriCitta" data-id="${c.id}" data-vai="1"><td>${esc(c.nome)}<div class="sotto">${G.classeCitta(c.pop)}</div></td><td class="num">${G.numero(c.pop)}</td><td class="num">${c.crescita >= 0 ? '+' : ''}${c.crescita}</td><td class="num">${c.nServite}</td></tr>`;
    }
    const altre = s0.citta.length - el.length;
    if (altre > 0 && !t) h += `<tr><td colspan="4" class="sotto">… e altre ${G.numero(altre)} città e paesi: cercali per nome.</td></tr>`;
    if (!el.length) h += '<tr><td colspan="4" class="sotto">Nessuna città con questo nome.</td></tr>';
    return h;
  }

  function finestraFinanze() {
    const s0 = st(), co = s0.conti;
    const anni = [...co.storico.slice(-3), { anno: co.anno, entrate: co.corrente.entrate, uscite: co.corrente.uscite, corrente: true }];
    const voceE = new Set(), voceU = new Set();
    for (const a of anni) { Object.keys(a.entrate).forEach(k => voceE.add(k)); Object.keys(a.uscite).forEach(k => voceU.add(k)); }
    const nomiU = { costruzione: 'Costruzioni', veicoli: 'Acquisto mezzi', esercizio: 'Esercizio mezzi', manutenzione: 'Manutenzione', interessi: 'Interessi' };
    const nomiE = k => (C.merci[k] ? 'Trasporto ' + C.merci[k].nome.toLowerCase() : k === 'vendite' ? 'Vendita mezzi' : k);
    let h = '<table class="elenco conti"><tr><th></th>' + anni.map(a => `<th>${a.anno}${a.corrente ? ' (in corso)' : ''}</th>`).join('') + '</tr>';
    h += '<tr class="titoletto"><td colspan="9">Entrate</td></tr>';
    for (const k of voceE) h += `<tr><td>${nomiE(k)}</td>${anni.map(a => `<td class="num">${a.entrate[k] ? G.lire(a.entrate[k]) : ''}</td>`).join('')}</tr>`;
    h += '<tr class="titoletto"><td colspan="9">Uscite</td></tr>';
    for (const k of voceU) h += `<tr><td>${nomiU[k] || k}</td>${anni.map(a => `<td class="num">${a.uscite[k] ? G.lire(-a.uscite[k]) : ''}</td>`).join('')}</tr>`;
    h += `<tr class="totale"><td>Utile</td>${anni.map(a => { const u = G.somma(a.entrate) - G.somma(a.uscite); return `<td class="num ${u < 0 ? 'rosso' : 'verde'}">${G.lire(u)}</td>`; }).join('')}</tr></table>`;
    const inf = G.costiInfrastruttura(s0);
    h += `<p><b>Manutenzione annua:</b> binari ${G.lire(inf.binari)}, strade ${G.lire(inf.strade)}, stazioni ${G.lire(inf.stazioni)}</p>`;
    h += `<p><b>Valore dell'azienda:</b> ${G.lire(G.valoreAzienda(s0))}</p>`;
    h += `<p><b>Prestito:</b> ${G.lire(s0.prestito)} su ${G.lire(C.inizio.prestitoMax)} (interesse ${Math.round(C.inizio.interesse * 100)}% l'anno)</p>`;
    h += `<div class="pulsanti"><button data-az="prestito" data-d="1">🏦 Prendi ${G.lire(C.inizio.passoPrestito)}</button><button data-az="prestito" data-d="-1">↩ Restituisci ${G.lire(C.inizio.passoPrestito)}</button></div>`;
    if (co.storico.length > 1) h += '<h4>Valore dell\'azienda negli anni</h4>' + grafico(co.storico.map(a => a.valore), '#4caf50');
    apriFinestra('Finanze', h, true);
  }

  function finestraAiuto() {
    apriFinestra('Come si gioca', `
      <p>Sei a capo di una compagnia di trasporti. Costruisci <b>ferrovie</b>, <b>strade</b>, <b>autostrade</b> (dal 1955) e
      <b>aeroporti</b> (dal 1925), compra i mezzi e porta passeggeri e merci dove servono. Ogni consegna viene pagata in base
      alla <b>distanza</b> e alla <b>velocità</b> del viaggio.</p>
      <h4>Primi passi</h4>
      <ol><li>Clicca sul pulsante della stazione e scegli le <b>dimensioni</b> (fermata, stazione, grande, centrale), poi mettila in
      una città: il riquadro azzurro è il <b>bacino</b> da cui arrivano passeggeri e merci. Le stazioni più grandi hanno un bacino più
      ampio e caricano più in fretta.</li>
      <li>Mettine un'altra in una seconda città e collegale con 🛤️ (tieni premuto e trascina: vedi il costo prima di costruire).
      Una stazione è <b>collegata</b> quando il binario passa sopra una delle sue caselle o ci finisce: non basta passarle accanto.</li>
      <li>Clicca su una stazione e premi «Compra un treno». Poi «Aggiungi fermate» e clicca sull'altra stazione.</li></ol>
      <h4>Binari, segnali e incroci</h4>
      <p>Su un tratto di binario passa <b>un treno alla volta</b>: i segnali sono automatici e un treno aspetta (🔴) in
      stazione o prima di uno scambio finché la strada è libera. Su una linea a <b>binario unico</b> i treni in senso
      opposto si incrociano solo in stazione o in un <b>binario d'incrocio</b> (un breve raddoppio); con una
      <b>linea doppia</b> e le stazioni grandi passano molti più treni. Se due treni si bloccano a vicenda (stallo)
      una notizia ti avvisa: seleziona uno dei due e premi <b>«↩ Torna indietro»</b>.</p>
      <p>In ogni fermata puoi scegliere se il mezzo <b>parte appena carico</b>, <b>attende il pieno</b> oppure
      <b>attende fino a</b> un certo tempo (giorni, ore, minuti) per riempirsi di più: riparte allo scadere o prima, se è pieno.</p>
      <h4>Le catene delle merci</h4>
      <p>⛏️ Carbone + ⛰️ Ferro → 🏭 Acciaieria → Acciaio · Acciaio + 🌲 Legname → 🏗️ Fabbrica → Merci → città<br>
      🌾 Grano → 🍝 Pastificio → Cibo → città · 🛢️ Petrolio → ⚗️ Raffineria → Carburante → città · ⚡ La centrale compra il carbone.</p>
      <p>Miniere e pozzi hanno una <b>riserva</b>: prima o poi si esauriscono e ne vengono scoperti di nuovi.
      Le <b>città crescono</b> se le servi bene; le case nuove nascono lungo le strade e attorno alle stazioni.</p>
      <h4>Comandi</h4>
      <table class="elenco"><tr><td>Sposta la mappa</td><td>trascina col tasto destro (o sinistro con 🔍), frecce</td></tr>
      <tr><td>Zoom</td><td>rotellina, tasti + e −</td></tr>
      <tr><td>Strumenti</td><td>I info · B ferrovia · R strada · U autostrada · T stazione (apre le dimensioni) · F autostazione · A aeroporto · X demolisci</td></tr>
      <tr><td>Finestre</td><td>V mezzi · M mondo · E finanze · H aiuto · G griglia</td></tr>
      <tr><td>Tempo</td><td>spazio pausa · 1 normale (1 secondo = 5 minuti) · 2 veloce (1 ora al secondo) · 3 velocissimo (1 giorno al secondo) · 4 turbo (1 settimana al secondo)</td></tr>
      <tr><td>Annulla / chiudi</td><td>Esc</td></tr></table>`, true);
  }

  // versione e build (da js/versione.js, generato da "npm run versione")
  G.testoVersione = function (lungo) {
    const V = window.VERSIONE;
    if (!V) return 'versione di sviluppo';
    const base = `v${V.versione} · build ${V.build} (${V.commit}${V.modifiche ? ', con modifiche' : ''})`;
    return lungo ? `${base} · ${V.data}` : base;
  };

  function finestraInfo() {
    apriFinestra('Informazioni', `
      <div class="info-testa"><span class="info-logo">🚂</span><div><div class="info-titolo">Rotaie &amp; Rotte</div>
      <div class="sotto">Gioco di strategia dei trasporti nel browser</div></div></div>
      <table class="elenco">
        <tr><td>Autore</td><td><b>Massimiliano Petra</b></td></tr>
        <tr><td>Versione</td><td><b>${window.VERSIONE ? window.VERSIONE.versione : 'sviluppo'}</b></td></tr>
        <tr><td>Build</td><td>${window.VERSIONE ? `${window.VERSIONE.build} · commit ${window.VERSIONE.commit}${window.VERSIONE.modifiche ? ' (con modifiche)' : ''} · ${window.VERSIONE.data}` : '—'}</td></tr>
        <tr><td>Licenza</td><td>GPL-3.0 o successiva: software libero</td></tr>
        <tr><td>Codice</td><td><a href="https://github.com/massimilianopetra/rotteerotaie" target="_blank" rel="noopener">github.com/massimilianopetra/rotteerotaie</a></td></tr>
        <tr><td>Sito</td><td><a href="https://massimilianopetra.github.io/rotteerotaie/" target="_blank" rel="noopener">massimilianopetra.github.io/rotteerotaie</a></td></tr>
      </table>
      <p>Costruisci ferrovie, strade, autostrade e aeroporti, compra i mezzi e porta passeggeri e merci fra città
      inventate o vere (l'Italia) che crescono grazie a te, dall'Ottocento ai giorni nostri.</p>` +
      (st() ? '' : '<div class="pulsanti"><button data-az="menuIniziale">← Torna al menu</button></div>'));
  }

  function finestraMenu(avvio) {
    const salv = G.esisteSalvataggio && G.esisteSalvataggio();
    const seme = Math.floor(Math.random() * 1e6);
    let h = avvio ? '<p class="intro">Costruisci un impero dei trasporti: ferrovie, strade, autostrade e aeroporti fra città inventate, oppure sulla mappa vera dell\'Italia.</p>' : '';
    const mappe = (C.mappeReali || []).map(k => `<option value="${k.id}">${k.nome} (mappa reale)</option>`).join('');
    h += `<label>Nome della compagnia<input id="npNome" value="Ferrovie Riunite" maxlength="40"></label>
      <label>Mondo<select id="npMappa" data-az="sceltaMappa"><option value="">Inventato (dal seme)</option>${mappe}</select></label>
      <div class="nota" id="npDescr"></div>
      <div class="riga"><label>Anno di inizio<select id="npAnno"><option>1850</option><option>1880</option><option>1920</option><option>1950</option><option>1980</option></select></label>
      <label>Mappa<select id="npDim"><option value="128x96">piccola</option><option value="192x144" selected>media</option><option value="256x192">grande</option></select></label></div>
      <div class="riga"><label>Città<select id="npCitta"><option>8</option><option selected>14</option><option>20</option><option>28</option></select></label>
      <label>Seme del mondo<input id="npSeme" type="number" value="${seme}"></label></div>
      <div class="pulsanti"><button class="primario" data-az="iniziaPartita">🚂 Nuova partita</button>
      ${salv ? '<button data-az="carica">📂 Continua la partita salvata</button>' : ''}
      ${!avvio ? '<button data-az="salva">💾 Salva</button><button data-az="chiudiFinestra">Annulla</button>' : ''}</div>
      <div class="nota">Con lo stesso seme si ottiene lo stesso mondo. La partita si salva nel browser (anche da sola ogni 1° gennaio).</div>
      <div class="versione">Rotaie &amp; Rotte ${G.testoVersione()} · di Massimiliano Petra · <span class="link" data-az="finestra" data-f="info">ℹ️ Informazioni</span></div>`;
    apriFinestra(avvio ? 'Rotaie & Rotte' : 'Partita', h);
  }
  ui.finestraMenu = finestraMenu;

  // ---------------------------------------------------------------- azioni dei pulsanti
  const AZIONI = {
    strumento: d => {
      if (d.id !== 'stazione') { scegliStrumento(d.id); return; }
      // il pulsante della stazione apre (o chiude) il menu delle dimensioni
      const aperto = menuStazioniAperto();
      scegliStrumento('stazione');
      if (aperto) chiudiMenuStazioni(); else apriMenuStazioni();
    },
    taglia: d => {
      ui.tagliaStazione = d.t;
      aggiornaPulsanteStazione();
      chiudiMenuStazioni();
      scegliStrumento('stazione');
    },
    vel: d => impostaVelocita(+d.v),
    chiudiPannello,
    chiudiFinestra,
    vaiA: d => G.vaiA(+d.x, +d.y),
    finestra: d => ({ veicoli: finestraVeicoli, mondo: finestraMondo, finanze: finestraFinanze, aiuto: finestraAiuto, info: finestraInfo, menu: () => finestraMenu(false) })[d.f](),
    schedaMondo: d => finestraMondo(d.s),
    apriStazione: d => { const s = st().stazioni[+d.id]; if (!s) return; ui.apriPannello('stazione', +d.id); if (d.vai) { G.vaiA(s.x + 0.5, s.y + 0.5); chiudiFinestra(); } },
    apriCitta: d => { const c = st().citta[+d.id]; ui.apriPannello('citta', +d.id); if (d.vai) { G.vaiA(c.x + 0.5, c.y + 0.5); chiudiFinestra(); } },
    apriIndustria: d => { const k = st().industrie[+d.id]; ui.apriPannello('industria', +d.id); if (d.vai) { G.vaiA(k.x + 1, k.y + 1); chiudiFinestra(); } },
    apriVeicolo: d => {
      const v = st().veicoli.find(k => k.id === +d.id); if (!v) return;
      ui.apriPannello('veicolo', v.id);
      if (ui.finestra) { chiudiFinestra(); G.vaiA(v.x, v.y); }
    },
    acquista: d => finestraAcquisto(+d.id),
    confermaAcquisto: d => {
      const r = $('#acqVagoni');
      const v = G.compraVeicolo(st(), $('#acqModello').value, $('#acqMerce').value, r ? +r.value : 0, +d.id);
      if (typeof v === 'string') { G.avviso(v, true); return; }
      chiudiFinestra();
      ui.apriPannello('veicolo', v.id);
      scegliStrumento('info');
      ui.percorso = true;
      disegnaPannello();
      G.avviso(`${v.nome} acquistato! Ora clicca sulle stazioni del percorso.`);
    },
    fermate: () => {
      const attiva = !ui.percorso;
      if (attiva) scegliStrumento('info');
      ui.percorso = attiva;
      disegnaPannello();
    },
    modoAttesa: (d, el) => {
      const v = veicoloSel(); if (!v) return;
      const f = v.fermate[+d.k];
      f.pieno = el.value === 'pieno';
      f.attesaMin = el.value === 'tempo' ? (f.attesaMin || 60) : 0; // di partenza un'ora
      disegnaPannello();
    },
    durata: d => {
      const v = veicoloSel(); if (!v) return;
      const val = u => Math.max(0, parseInt(($(`#pannello input.durata[data-k="${d.k}"][data-u="${u}"]`) || {}).value, 10) || 0);
      v.fermate[+d.k].attesaMin = Math.min(120 * 1440, val('g') * 1440 + Math.min(23, val('h')) * 60 + Math.min(59, val('m')));
    },
    tornaIndietro: () => {
      const v = veicoloSel(); if (!v) return;
      const e = G.tornaIndietro(st(), v);
      G.avviso(e || `${v.nome} torna indietro`, !!e);
      disegnaPannello();
    },
    suFermata: d => { const v = veicoloSel(), k = +d.k; if (v && k > 0) { const t = v.fermate[k]; v.fermate[k] = v.fermate[k - 1]; v.fermate[k - 1] = t; disegnaPannello(); } },
    togliFermata: d => { const v = veicoloSel(); if (v) { G.togliFermata(st(), v, +d.k); disegnaPannello(); } },
    segui: () => { ui.segui = !ui.segui; disegnaPannello(); },
    fermaVeicolo: () => { const v = veicoloSel(); if (v) { v.fermoManuale = !v.fermoManuale; disegnaPannello(); } },
    vendi: () => {
      const v = veicoloSel(); if (!v) return;
      if (!confirm(`Vendere ${v.nome} per ${G.lire(G.valoreVeicolo(v))}?`)) return;
      G.vendiVeicolo(st(), v); chiudiPannello(); G.avviso('Mezzo venduto');
    },
    demolisciStazione: d => {
      const s = st().stazioni[+d.id]; if (!s) return;
      if (!confirm(`Demolire ${s.nome}? I mezzi perderanno questa fermata.`)) return;
      const e = G.demolisciStazione(st(), +d.id);
      if (e) G.avviso(e, true); else chiudiPannello();
    },
    prestito: d => { const e = +d.d > 0 ? G.prendiPrestito(st()) : G.rendiPrestito(st()); if (e) G.avviso(e, true); finestraFinanze(); },
    salva: () => { const e = G.salvaPartita(st()); G.avviso(e || 'Partita salvata', !!e); },
    carica: () => {
      G.avviso('Caricamento della partita…');
      // un attimo di respiro perché l'avviso si veda: le mappe reali richiedono qualche secondo
      setTimeout(() => G.caricaPartita(e => {
        if (e) { G.avviso(e, true); return; }
        $('#finestra').classList.add('nascosto'); ui.finestra = null; G.avviso('Partita caricata');
      }), 30);
    },
    // con una mappa reale dimensioni e numero di città vengono dalla mappa
    sceltaMappa: () => {
      const def = (C.mappeReali || []).find(k => k.id === $('#npMappa').value);
      $('#npDim').disabled = $('#npCitta').disabled = !!def;
      $('#npDescr').textContent = def ? def.descrizione : '';
    },
    iniziaPartita: (d, el) => {
      const [W, H] = $('#npDim').value.split('x').map(Number);
      const seme = Math.abs(parseInt($('#npSeme').value, 10) || 1), mappa = $('#npMappa').value || undefined;
      const opz = { nome: $('#npNome').value.trim() || 'Ferrovie Riunite', anno: +$('#npAnno').value, W, H, numCitta: +$('#npCitta').value, seme, mappa };
      if (mappa) { G.avviso('Preparo la mappa: qualche secondo…'); el.disabled = true; }
      setTimeout(() => G.nuovaPartita(opz, e => {
        el.disabled = false;
        if (e) { G.avviso(e, true); return; }
        $('#finestra').classList.add('nascosto'); ui.finestra = null;
        if (mappa) G.avviso('Buon viaggio!');
      }), 30);
    },
    menuIniziale: () => finestraMenu(true),
    griglia: () => { ui.griglia = !ui.griglia; }
  };
  const veicoloSel = () => ui.selVeicolo && st() && st().veicoli.find(k => k.id === ui.selVeicolo);

  // ---------------------------------------------------------------- mouse sulla mappa
  function casellaDa(e) {
    const r = $('#mappa').getBoundingClientRect();
    const p = G.schermoAMondo(e.clientX - r.left, e.clientY - r.top);
    const m = st().mondo, x = Math.floor(p.x), y = Math.floor(p.y);
    return { wx: p.x, wy: p.y, x, y, i: x >= 0 && y >= 0 && x < m.W && y < m.H ? y * m.W + x : -1, sx: e.clientX, sy: e.clientY };
  }

  function suggerisci(testo, e) {
    const s = $('#suggerimento');
    if (!testo) { s.style.display = 'none'; return; }
    s.innerHTML = testo; s.style.display = 'block';
    s.style.left = (e.clientX + 16) + 'px'; s.style.top = (e.clientY + 16) + 'px';
  }

  function aggiornaAnteprima(c, e) {
    const s0 = st(), rete = ui.strumento;
    if (c.i < 0) return;
    const tr = G.cercaTracciato(s0, ui.trascina.da, c.i, rete);
    if (!tr) { ui.anteprima = { caselle: [ui.trascina.da, c.i], ok: false }; suggerisci('<span class="rosso">Impossibile passare di qui</span>', e); return; }
    const ok = tr.costo <= s0.soldi;
    ui.anteprima = { caselle: tr.caselle, costo: tr.costo, ok, tr };
    const km = G.kmCasella(s0), lun = km === 1 ? '' : ` (${G.numero(Math.round((tr.caselle.length - 1) * km))} km)`;
    suggerisci(`${C.reti[rete].nome}: <b class="${ok ? '' : 'rosso'}">${G.lire(tr.costo)}</b> · ${tr.caselle.length} caselle${lun}`, e);
  }

  function anteprimaStazione(c, e) {
    const s0 = st(), tipo = ui.strumento, taglia = tipo === 'stazione' ? ui.tagliaStazione : undefined;
    const def = G.defStazione(tipo, taglia), L = def.lato;
    // lato pari (2×2): si centra sull'incrocio di caselle più vicino al mouse; lato dispari: sulla casella
    const x = L % 2 ? c.x - (L - 1) / 2 : Math.round(c.wx) - L / 2, y = L % 2 ? c.y - (L - 1) / 2 : Math.round(c.wy) - L / 2;
    const r = G.puoCostruireStazione(s0, tipo, x, y, taglia);
    const ok = typeof r !== 'string' && r.costo <= s0.soldi;
    ui.bacino = { x, y, lato: L, raggio: def.raggio, ok };
    const finta = { tipo, taglia, x, y, lato: L };
    const b = G.calcolaBacino(s0, finta);
    let h = `<b>${def.nome}</b> · ${typeof r === 'string' ? `<span class="rosso">${r}</span>` : `<span class="${ok ? '' : 'rosso'}">${G.lire(r.costo)}</span>`}`;
    h += `<br>Accetta: ${elencoMerci(b.accetta)}<br>Fornisce: ${elencoMerci(b.fornisce)}`;
    suggerisci(h, e);
    return { x, y };
  }

  function clicInfo(c) {
    const s0 = st(), m = s0.mondo;
    if (c.i < 0) return;
    if (ui.percorso && ui.selVeicolo) {
      const v = veicoloSel();
      if (v && m.occ[c.i] === OCC.STAZIONE) {
        const e = G.aggiungiFermata(s0, v, m.rif[c.i]);
        G.avviso(e || `Fermata aggiunta: ${s0.stazioni[m.rif[c.i]].nome}`, !!e);
        disegnaPannello();
      } else G.avviso('Clicca su una stazione per aggiungerla al percorso (Esc per finire)', true);
      return;
    }
    let best = null, bd = Math.max(0.6, 10 / D.cam.ts);
    for (const v of s0.veicoli) { const d = Math.hypot(v.x - c.wx, v.y - c.wy); if (d < bd) { bd = d; best = v; } }
    if (best) { ui.apriPannello('veicolo', best.id); return; }
    const o = m.occ[c.i];
    if (o === OCC.STAZIONE) ui.apriPannello('stazione', m.rif[c.i]);
    else if (o === OCC.INDUSTRIA) ui.apriPannello('industria', m.rif[c.i]);
    else if (o === OCC.CASA) ui.apriPannello('citta', m.cittaDi[c.i]);
    else {
      const ct = G.cittaVicina(s0, c.wx, c.wy);
      if (ct && Math.hypot(ct.x + 0.5 - c.wx, ct.y + 0.5 - c.wy) < 1.5) ui.apriPannello('citta', ct.id);
      else ui.apriPannello('casella', c.i);
    }
  }

  function demolisciQui(c) {
    if (c.i < 0 || (ui.trascina && ui.trascina.ultima === c.i)) return;
    if (ui.trascina) ui.trascina.ultima = c.i;
    const s0 = st();
    if (s0.mondo.occ[c.i] === OCC.STAZIONE) {
      const s = s0.stazioni[s0.mondo.rif[c.i]];
      if (!confirm(`Demolire ${s.nome}?`)) { ui.trascina = null; return; }
    }
    const e = G.demolisci(s0, c.i);
    if (e && e !== 'Niente da demolire') G.avviso(e, true);
  }

  function preparaMouse() {
    const cv = $('#mappa');
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      if (!st()) return;
      cv.setPointerCapture(e.pointerId);
      const c = casellaDa(e);
      if (e.button === 2 || e.button === 1 || (e.button === 0 && ui.strumento === 'info')) {
        ui.pan = { sx: e.clientX, sy: e.clientY, cx: D.cam.x, cy: D.cam.y, mosso: false, sinistro: e.button === 0 };
        if (ui.strumento === 'info') cv.style.cursor = 'grabbing';
        return;
      }
      if (e.button !== 0 || c.i < 0) return;
      const s0 = st();
      if (RETI.includes(ui.strumento)) {
        if (G.anno(s0) < C.reti[ui.strumento].anno) { G.avviso(`${C.reti[ui.strumento].nome}: disponibile dal ${C.reti[ui.strumento].anno}`, true); return; }
        ui.trascina = { da: c.i };
        aggiornaAnteprima(c, e);
      } else if (STAZIONI.includes(ui.strumento)) {
        const p = anteprimaStazione(c, e);
        chiudiMenuStazioni();
        const r = G.costruisciStazione(s0, ui.strumento, p.x, p.y, ui.strumento === 'stazione' ? ui.tagliaStazione : undefined);
        if (typeof r === 'string') G.avviso(r, true);
        else { G.avviso(`Costruita: ${r.nome}`); ui.apriPannello('stazione', r.id); }
      } else if (ui.strumento === 'demolisci') {
        ui.trascina = { demolisci: true };
        demolisciQui(c);
      }
    });
    cv.addEventListener('pointermove', e => {
      if (!st()) return;
      const c = casellaDa(e);
      ui.cursore = c.i;
      if (ui.pan) {
        const dx = e.clientX - ui.pan.sx, dy = e.clientY - ui.pan.sy;
        if (Math.abs(dx) + Math.abs(dy) > 4) ui.pan.mosso = true;
        if (ui.pan.mosso) { D.cam.x = ui.pan.cx - dx / D.cam.ts; D.cam.y = ui.pan.cy - dy / D.cam.ts; ui.segui = false; limitaCamera(); }
        return;
      }
      if (ui.trascina && ui.trascina.demolisci) { demolisciQui(c); return; }
      if (ui.trascina) {
        if (c.i !== ui.trascina.ultima) { ui.trascina.ultima = c.i; aggiornaAnteprima(c, e); }
        else suggerisci($('#suggerimento').innerHTML, e);
        return;
      }
      if (STAZIONI.includes(ui.strumento)) anteprimaStazione(c, e);
      else if (RETI.includes(ui.strumento) && c.i >= 0) {
        const t = G.NOMI_TERRENO[st().mondo.tipo[c.i]];
        suggerisci(`${C.reti[ui.strumento].nome} · ${t}: ${isFinite(C.moltTerreno[t]) ? G.lire(C.reti[ui.strumento].costo * C.moltTerreno[t]) + ' a casella' : 'impossibile'}<br><span class="sotto">Tieni premuto e trascina</span>`, e);
      } else suggerisci('', e);
    });
    cv.addEventListener('pointerup', e => {
      if (!st()) return;
      const c = casellaDa(e);
      if (ui.pan) {
        const p = ui.pan; ui.pan = null;
        if (ui.strumento === 'info') cv.style.cursor = 'grab';
        if (!p.mosso && p.sinistro) clicInfo(c);
        else if (!p.mosso && !p.sinistro && e.button === 2 && ui.strumento !== 'info') scegliStrumento('info');
        return;
      }
      if (ui.trascina && !ui.trascina.demolisci && ui.anteprima && ui.anteprima.tr) {
        const e2 = G.costruisciTracciato(st(), ui.anteprima.tr, ui.strumento);
        if (e2) G.avviso(e2, true); else G.avviso(`Costruito: ${G.lire(ui.anteprima.tr.costo)}`);
      }
      ui.trascina = null; ui.anteprima = null;
      suggerisci('', e);
    });
    cv.addEventListener('pointerleave', () => { ui.cursore = -1; if (!ui.trascina) { ui.bacino = null; $('#suggerimento').style.display = 'none'; } });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });

    const mini = $('#mini');
    const vaiMini = e => {
      const r = mini.getBoundingClientRect(), m = st().mondo;
      G.vaiA((e.clientX - r.left) / r.width * m.W, (e.clientY - r.top) / r.height * m.H);
      ui.segui = false;
    };
    mini.addEventListener('pointerdown', e => { if (!st()) return; mini.setPointerCapture(e.pointerId); vaiMini(e); mini._giu = true; });
    mini.addEventListener('pointermove', e => { if (mini._giu) vaiMini(e); });
    mini.addEventListener('pointerup', () => { mini._giu = false; });
  }

  // ---------------------------------------------------------------- tastiera (mai con Ctrl: Ctrl+W chiude la scheda!)
  function preparaTastiera() {
    window.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (!st()) return;
      const k = e.key;
      if (k.startsWith('Arrow')) { ui.tasti.add(k); e.preventDefault(); return; }
      if (k === 'Escape') {
        if (menuStazioniAperto()) chiudiMenuStazioni();
        else if (ui.trascina) { ui.trascina = null; ui.anteprima = null; }
        else if (ui.finestra) chiudiFinestra();
        else if (ui.percorso) { ui.percorso = false; disegnaPannello(); }
        else if (ui.strumento !== 'info') scegliStrumento('info');
        else chiudiPannello();
        return;
      }
      if (ui.finestra) return;
      if (k === ' ') { impostaVelocita(ui.velocita ? 0 : ui.ultimaVel); e.preventDefault(); return; }
      if (k === '1' || k === '2' || k === '3' || k === '4') { impostaVelocita(+k); return; }
      if (k === '+') { zoom(1.25); return; }
      if (k === '-') { zoom(0.8); return; }
      const t = STRUMENTI.find(s => s.tasto.toLowerCase() === k.toLowerCase());
      if (t) { AZIONI.strumento({ id: t.id }); return; }
      const f = { v: 'veicoli', m: 'mondo', e: 'finanze', h: 'aiuto' }[k.toLowerCase()];
      if (f) { AZIONI.finestra({ f }); return; }
      if (k.toLowerCase() === 'g') ui.griglia = !ui.griglia;
    });
    window.addEventListener('keyup', e => ui.tasti.delete(e.key));
    window.addEventListener('blur', () => ui.tasti.clear());
  }

  // ---------------------------------------------------------------- avvio
  ui.prepara = function () {
    $('#attrezzi').innerHTML = STRUMENTI.map(s => `<button data-az="strumento" data-id="${s.id}" title="${s.nome} (${s.tasto})">${s.icona}</button>`).join('');
    aggiornaPulsanteStazione();
    // il menu delle dimensioni si chiude cliccando altrove
    // (un clic sulla mappa col menu aperto lo chiude soltanto, senza costruire)
    document.addEventListener('pointerdown', e => {
      if (!menuStazioniAperto() || e.target.closest('#menuStazioni, #attrezzi button[data-id="stazione"]')) return;
      chiudiMenuStazioni();
      if (e.target.id === 'mappa' && e.button === 0) e.stopPropagation();
    }, true);
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-az]');
      if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.disabled) return;
      AZIONI[el.dataset.az](el.dataset, el);
    });
    document.addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.az && (el.tagName === 'INPUT' || el.tagName === 'SELECT')) AZIONI[el.dataset.az](el.dataset, el);
      if (el.dataset.cambia === 'acquisto') aggiornaAcquisto(false);
    });
    document.addEventListener('input', e => {
      if (e.target.dataset.cambia === 'acquisto') aggiornaAcquisto(false);
      if (e.target.id === 'cercaCitta') $('#elencoCitta').innerHTML = righeCitta(e.target.value);
    });
    $('#finestra').addEventListener('pointerdown', e => { if (e.target.id === 'finestra') chiudiFinestra(); });
    const p = $('#pannello');
    p.addEventListener('pointerenter', () => { ui.mouseSuPannello = true; });
    p.addEventListener('pointerleave', () => { ui.mouseSuPannello = false; });
    preparaMouse();
    preparaTastiera();
    console.info('Rotaie & Rotte ' + G.testoVersione(true) + ' — di Massimiliano Petra');
    scegliStrumento('info');
    impostaVelocita(1);
    // aggiornamenti periodici di barra e pannello
    setInterval(() => {
      const s0 = st(); if (!s0) return;
      $('#azienda').textContent = s0.opz.nome;
      const soldi = $('#soldi');
      soldi.textContent = G.lire(s0.soldi); soldi.classList.toggle('rosso', s0.soldi < 0);
      $('#prestito').textContent = s0.prestito ? 'debito ' + G.lire(s0.prestito) : '';
      $('#data').textContent = G.testoData(s0) + ' · ' + G.testoOra(s0);
    }, 250);
    setInterval(() => { if (ui.pannello && !ui.mouseSuPannello) disegnaPannello(); }, 1000);
  };

  ui.nuovaPartitaPronta = function () {
    chiudiPannello();
    scegliStrumento('info');
    $('#notizie').innerHTML = '';
    for (const n of st().notizie.slice(0, 4).reverse()) G.suNotizia(n);
  };
})();
