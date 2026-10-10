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
    selVeicolo: null, segui: false, velocita: 1, percorso: false, tasti: new Set(),
    mouseSuPannello: false, ultimaVel: 1, tagliaStazione: 'media', modoRete: { binario: 'normale', autostrada: 'normale' }
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
    { id: 'info', icona: '🔍', nome: _('Informazioni / sposta la mappa'), tasto: 'I' },
    { id: 'binario', icona: '🛤️', nome: _('Costruisci ferrovia (trascina)'), tasto: 'B' },
    { id: 'strada', icona: '🛣️', nome: _('Costruisci strada (trascina)'), tasto: 'R' },
    { id: 'autostrada', icona: '🚧', nome: _('Costruisci autostrada (trascina)'), tasto: 'U' },
    { id: 'stazione', icona: '🚉', nome: _('Stazione ferroviaria: clic per scegliere le dimensioni'), tasto: 'T' },
    { id: 'deposito', icona: '🚏', nome: _('Autostazione (bus e camion)'), tasto: 'F' },
    { id: 'aeroporto', icona: '✈️', nome: _('Aeroporto'), tasto: 'A' },
    { id: 'porto', icona: '⚓', nome: _('Porto (navi): sulla costa del mare o di un lago'), tasto: 'P' },
    { id: 'demolisci', icona: '💥', nome: _('Demolisci'), tasto: 'X' }
  ];
  const RETI = ['binario', 'strada', 'autostrada'];
  const STAZIONI = ['stazione', 'deposito', 'aeroporto', 'porto'];

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
    if (n.x !== undefined) { div.dataset.az = 'vaiA'; div.dataset.x = n.x; div.dataset.y = n.y; div.title = _('Clic per andare sul posto'); }
    div.innerHTML = `<button class="chiudiNotizia" data-az="chiudiNotizia" title="Chiudi">✕</button><b>${esc(n.data)}</b> ${esc(n.testo)}`;
    box.prepend(div);
    const tutte = box.querySelectorAll('.notizia');
    for (let k = 4; k < tutte.length; k++) tutte[k].remove();
    aggiornaChiudiTutte();
    setTimeout(() => div.classList.remove('nuova'), 1500);
  };
  // con due o più notizie compare anche «✕ tutte», per toglierle in una volta
  function aggiornaChiudiTutte() {
    const box = $('#notizie'), n = box.querySelectorAll('.notizia').length;
    let t = box.querySelector('.chiudiTutte');
    if (n >= 2 && !t) {
      t = document.createElement('button');
      t.className = 'chiudiTutte'; t.dataset.az = 'chiudiTutte'; t.textContent = _('✕ tutte'); t.title = _('Chiudi tutte le notizie');
      box.append(t);
    }
    if (n < 2 && t) t.remove();
  }

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
    // (G.deltaMondo vale anche nella vista 3D, girata o no)
    const d0 = G.deltaMondo(sx - cv.clientWidth / 2, sy - cv.clientHeight / 2), p = { x: D.cam.x + d0.x, y: D.cam.y + d0.y };
    D.cam.ts = Math.max(3, Math.min(128, D.cam.ts * f));
    const d1 = G.deltaMondo(sx - cv.clientWidth / 2, sy - cv.clientHeight / 2);
    D.cam.x = p.x - d1.x;
    D.cam.y = p.y - d1.y;
    limitaCamera();
  }
  ui.aggiornaCamera = function (dt) {
    // le frecce spostano la vista sullo schermo (nella vista 3D le direzioni del mondo sono di sbieco)
    const v = 700 * dt, sx = (ui.tasti.has('ArrowRight') ? v : 0) - (ui.tasti.has('ArrowLeft') ? v : 0);
    const sy = (ui.tasti.has('ArrowDown') ? v : 0) - (ui.tasti.has('ArrowUp') ? v : 0);
    if (sx || sy) { const d = G.deltaMondo(sx, sy); D.cam.x += d.x; D.cam.y += d.y; }
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
    let h = _('<div class="titolo">Dimensioni della stazione</div>');
    for (const k in C.taglieStazione) {
      const t = G.defStazione('stazione', k), lb = t.lato + 2 * t.raggio, ok = anno >= t.anno;
      h += _`<button data-az="taglia" data-t="${k}" class="${k === ui.tagliaStazione ? 'attivo' : ''}" ${ok ? '' : 'disabled'}>
        ${iconaStazione(k)}<span><b>${t.nome}</b><span class="sotto">${t.lato}×${t.lato} caselle · bacino ${lb}×${lb}<br>
        ${G.lire(t.costo)} · manutenzione ${G.lire(t.manutenzione)} l'anno<br>carico e scarico ×${G.fmt(t.carico)}${ok ? '' : _` · dal ${t.anno}`}</span></span></button>`;
    }
    menu.innerHTML = h;
    const r = b.getBoundingClientRect();
    menu.classList.remove('nascosto'); // prima si mostra, poi si misura l'altezza
    menu.style.top = Math.max(50, Math.min(r.top, window.innerHeight - menu.offsetHeight - 10)) + 'px';
  }
  // i pulsanti della ferrovia e dell'autostrada aprono lo stesso tipo di menu: rete normale oppure galleria
  const MENU_GALLERIA = {
    binario: { titolo: _('Ferrovia'), icona: '🛤️', normale: _('Ferrovia normale') },
    autostrada: { titolo: _('Autostrada'), icona: '🚧', normale: _('Autostrada normale') }
  };
  const inGalleria = rete => !!MENU_GALLERIA[rete] && ui.modoRete[rete] === 'galleria';
  const inProgetto = rete => !!MENU_GALLERIA[rete] && ui.modoRete[rete] === 'progetto';
  function aggiornaPulsanteBinario() {
    for (const id in MENU_GALLERIA) {
      const b = document.querySelector(`#attrezzi button[data-id="${id}"]`);
      if (b) b.innerHTML = (inGalleria(id) ? '🚇' : inProgetto(id) ? '📐' : MENU_GALLERIA[id].icona) + '<span class="freccina">▸</span>';
    }
  }
  function apriMenuBinario(rete) {
    const menu = $('#menuStazioni'), b = document.querySelector(`#attrezzi button[data-id="${rete}"]`), O = C.opere, M = MENU_GALLERIA[rete];
    const voce = (k, ic, nome, testo) => `<button data-az="modoBinario" data-r="${rete}" data-m="${k}" class="${ui.modoRete[rete] === k ? 'attivo' : ''}">
      <span class="icona">${ic}</span><span><b>${nome}</b><span class="sotto">${testo}</span></span></button>`;
    menu.innerHTML = `<div class="titolo">${M.titolo}</div>` +
      voce('normale', M.icona, M.normale, _`Segue il terreno, sale al massimo del ${O.pendenzaMax[rete]}‰.<br>Per scavalcare un dosso o salire a una città si sopraeleva da sola, già prima, su rilevati e viadotti (più alti, più cari). Se nemmeno così ce la fa non si costruisce: il monte da forare diventa rosso.`) +
      voce('galleria', '🚇', _('Galleria'), _`Dritta, dalla quota dell'imbocco a quella dell'uscita: può salire o scendere fino al ${O.pendenzaMax[rete]}‰.<br>Trascina dall'imbocco all'uscita, dall'altra parte del monte; sopra servono almeno ${O.sogliaMetri} m di monte. ×${O.galleria} il costo.`) +
      voce('progetto', '📐', _('Progettazione'), _('Si disegna la linea punto per punto senza costruire: vedi sulla mappa gallerie e viadotti e sotto il profilo altimetrico, la pendenza e il costo. Ogni tratto può essere normale o in galleria; quando va bene, «Costruisci tutto».'));
    const r = b.getBoundingClientRect();
    menu.classList.remove('nascosto');
    menu.style.top = Math.max(50, Math.min(r.top, window.innerHeight - menu.offsetHeight - 10)) + 'px';
  }
  const chiudiMenuStazioni = () => $('#menuStazioni').classList.add('nascosto');
  const menuStazioniAperto = () => !$('#menuStazioni').classList.contains('nascosto');

  function scegliStrumento(id) {
    if (id !== 'stazione' && !MENU_GALLERIA[id]) chiudiMenuStazioni();
    ui.strumento = id; ui.trascina = null; ui.anteprima = null; ui.bacino = null;
    if (id !== 'info') ui.percorso = false;
    document.querySelectorAll('#attrezzi button').forEach(b => b.classList.toggle('attivo', b.dataset.id === id));
    $('#suggerimento').style.display = 'none';
    const s = st();
    if (s && RETI.includes(id) && G.anno(s) < C.reti[id].anno) G.avviso(_`${C.reti[id].nome}: disponibile dal ${C.reti[id].anno}`, true);
    if (s && STAZIONI.includes(id) && G.anno(s) < G.defStazione(id, ui.tagliaStazione).anno) G.avviso(_`${C.stazioni[id].nome}: disponibile dal ${C.stazioni[id].anno}`, true);
    $('#mappa').style.cursor = id === 'info' ? 'grab' : 'crosshair';
  }

  ui.impostaVelocita = v => impostaVelocita(v);
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
    if (!merci.length) return _('<h4>Fornisce</h4><div class="sotto">Nulla: nel bacino non ci sono case né industrie che producono.</div>');
    let h = _('<h4>Fornisce · pronti a partire</h4><div class="schede-merci">');
    for (const k of merci) {
      const def = C.merci[k], q = Math.floor(s.attesa[k] || 0);
      const mezzi = s0.veicoli.filter(v => v.merce === k && v.fermate.some(f => f.s === s.id));
      const cap = Math.max(0, ...mezzi.map(v => v.cap));
      let nota, frac = 0;
      if (!s.servite[k]) nota = _('<span class="avviso-merce">Nessun mezzo la ritira: compra un mezzo per farla partire</span>');
      else {
        const val = G.valutazione(s0, s, k), pv = Math.round(val * 100);
        const colVal = pv >= 66 ? 'var(--verde)' : pv >= 33 ? 'var(--accento)' : 'var(--rosso)';
        frac = cap ? q / cap : 0;
        const carichi = cap ? (frac >= 10 ? Math.round(frac) : G.fmt(frac, { minimumFractionDigits: 1, maximumFractionDigits: 1 })) : '—';
        nota = _`≈ ${carichi} ${frac >= 0.95 && frac < 1.05 ? _('carico') : _('carichi')} · ${mezzi.length} ${mezzi.length === 1 ? _('mezzo') : _('mezzi')} · valutazione <b style="color:${colVal}">${pv}%</b>`;
      }
      h += `<div class="scheda-merce${s.servite[k] ? '' : ' spenta'}" style="--c:${def.colore}" title="${def.nome}: ${G.numero(q)} ${def.unita} in attesa in stazione">
        <div class="sm-icona">${def.icona}</div>
        <div class="sm-corpo">
          <div class="sm-riga"><span class="sm-nome">${def.nome}</span><span class="sm-num">${G.numero(q)}<small> ${def.unita}</small></span></div>
          <div class="sm-barra"><div style="width:${Math.round(Math.min(1, frac) * 100)}%"></div>${frac > 1 ? `<span class="sm-pieno">×${Math.floor(frac)}</span>` : ''}</div>
          <div class="sm-nota">${nota}</div>
        </div></div>`;
    }
    return h + _('</div><div class="nota">La valutazione sale quando i mezzi passano spesso: più è alta, più passeggeri e merci arrivano alla stazione.</div>');
  }

  // la merce lasciata da un mezzo perché la porti avanti uno di un altro tipo
  const DA_CHI = { treno: _('dai treni'), nave: _('dalle navi'), strada: _('dai mezzi su strada'), aereo: _('dagli aerei') };
  function htmlTrasbordo(s) {
    const righe = [];
    for (const k in s.trasbordo || {}) for (const t in s.trasbordo[k]) {
      const q = s.trasbordo[k][t];
      if (q >= 1) righe.push(`<div>${pallino(k)}${nomeMerce(k)}: <b>${G.numero(q)}</b> ${C.merci[k].unita} <span class="sotto">${DA_CHI[t] || ''}</span></div>`);
    }
    return righe.length ? _('<h4>⇄ In attesa di trasbordo</h4>') + righe.join('') : '';
  }

  function htmlStazione(s0, s) {
    const def = G.defStazione(s);
    const icona = s.tipo === 'stazione' ? `<span class="icona-titolo">${iconaStazione(def.taglia)}</span>` : def.icona;
    let h = `<h3>${icona} ${esc(s.nome)}</h3><div class="sotto">${G.nomeTipoStazione(s)}</div>`;
    if (s.tipo === 'stazione') {
      const lb = s.lato + 2 * def.raggio;
      h += _`<p><b>Dimensioni:</b> ${s.lato}×${s.lato} caselle · bacino ${lb}×${lb} · carico ×${G.fmt(def.carico)}</p>`;
    }
    if (!G.stazioneCollegata(s0, s)) {
      h += `<p class="rosso">⚠ ${s.tipo === 'stazione'
        ? _('Nessun binario passa sulla stazione: i treni non possono arrivarci. Trascina una ferrovia fin sopra una delle sue caselle.')
        : _('Nessuna strada arriva all\'autostazione: costruiscine una fin sopra la sua casella.')}</p>`;
    }
    h += _`<p><b>Abitanti nel bacino:</b> ${G.numero(s.popBacino)}</p>`;
    h += schedeFornisce(s0, s);
    if (s.tipo === 'porto') h += s0.mondo.mBin[G.casellaStazione(s0, s)]
      ? _('<p>🛤️ <b>Collegato alla ferrovia</b>: anche i treni si fermano qui e la merce passa dal treno alla nave e viceversa.</p>')
      : _('<div class="nota">Porta un binario sopra il porto: anche i treni potranno fermarsi qui e la merce passerà dal treno alla nave (trasbordo).</div>');
    h += htmlTrasbordo(s);
    const acc = Object.keys(C.merci).filter(k => s.accetta[k]);
    h += _`<h4>Accetta</h4><div class="chips">${acc.length ? acc.map(k => `<span class="chip" style="--c:${C.merci[k].colore}">${C.merci[k].icona} ${nomeMerce(k)}</span>`).join('') : _('<span class="sotto">nulla</span>')}</div>`;
    if (s.industrie.length) {
      h += _('<h4>Industrie vicine</h4>');
      for (const id of s.industrie) { const ind = s0.industrie[id]; h += `<div class="link" data-az="apriIndustria" data-id="${id}">${C.industrie[ind.tipo].icona} ${esc(ind.nome)}</div>`; }
    }
    const veic = s0.veicoli.filter(v => v.fermate.some(f => f.s === s.id));
    h += _`<h4>Mezzi che si fermano qui (${veic.length})</h4>`;
    for (const v of veic) h += `<div class="link" data-az="apriVeicolo" data-id="${v.id}">${esc(v.nome)} · ${pallino(v.merce)}${nomeMerce(v.merce)}</div>`;
    const cosa = { stazione: _('un treno'), deposito: _('un autobus o un camion'), aeroporto: _('un aereo'), porto: _('una nave') }[s.tipo];
    h += _`<div class="pulsanti"><button class="primario" data-az="acquista" data-id="${s.id}">🛒 Compra ${cosa}</button>`;
    h += _`<button data-az="demolisciStazione" data-id="${s.id}">💥 Demolisci</button></div>`;
    return h;
  }

  function htmlCitta(s0, c) {
    const ms = c.meseScorso;
    let h = _`<h3>🏙️ ${esc(c.nome)}</h3><div class="sotto">${G.classeCitta(c.pop)} · ${G.numero(c.pop)} abitanti · ${c.case} edifici</div>`;
    h += _`<p><b>Crescita del mese scorso:</b> ${c.crescita >= 0 ? '+' : ''}${G.numero(c.crescita)} abitanti</p>`;
    h += _`<p><b>Stazioni servite:</b> ${c.nServite}</p><h4>Mese scorso</h4><table>
      <tr><td>Passeggeri partiti</td><td class="num">${G.numero(ms.partiti)}</td></tr>
      <tr><td>Passeggeri arrivati</td><td class="num">${G.numero(ms.arrivati)}</td></tr>
      <tr><td>Posta</td><td class="num">${G.numero(ms.posta)}</td></tr>
      <tr><td>Merci consegnate</td><td class="num">${G.numero(ms.merci)}</td></tr>
      <tr><td>Cibo consegnato</td><td class="num">${G.numero(ms.cibo)}</td></tr>
      <tr><td>Carburante consegnato</td><td class="num">${G.numero(ms.carburante)}</td></tr></table>`;
    h += grafico(c.storico.slice(-120), '#f2c94c');
    h += _('<div class="nota">Una città cresce se è collegata: stazioni servite, passeggeri e posta in movimento, e consegne di merci, cibo e carburante. Le case nuove nascono lungo le strade e attorno alle stazioni.</div>');
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
    if (ind.chiusa) return h + _('<p>Chiusa.</p>');
    if (def.produce) {
      h += _`<p><b>Produce:</b> ${pallino(def.produce)}${nomeMerce(def.produce)}, circa ${G.numero(ind.produzione)} ${C.merci[def.produce].unita} al mese</p>`;
      h += _`<p><b>Trasportato il mese scorso:</b> ${Math.round(ind.perc * 100)}% ${barra(ind.perc, '#4caf50')}</p>`;
      if (def.riserva) {
        const f = ind.riserva / ind.riservaIniziale;
        h += _`<p><b>Riserva del giacimento:</b> ${G.numero(ind.riserva)} ${C.merci[def.produce].unita} ${barra(f, f < 0.2 ? '#e74c3c' : '#c9a227')}</p>`;
        const anni = ind.produzione > 0 ? ind.riserva / ind.produzione / 12 : 0;
        h += _`<div class="nota">Al ritmo attuale si esaurisce in circa ${G.fmt(anni, { maximumFractionDigits: 1 })} anni.</div>`;
      } else h += _('<div class="nota">Risorsa rinnovabile: non si esaurisce.</div>');
    }
    if (def.accetta) {
      h += _`<p><b>Accetta:</b> ${def.accetta.map(k => pallino(k) + nomeMerce(k)).join(', ')}</p>`;
      if (def.uscita) {
        h += _`<p><b>Produce:</b> ${pallino(def.uscita)}${nomeMerce(def.uscita)} (${Math.round(def.resa * 100)}% di quanto riceve)</p>`;
        h += _`<p><b>Prodotto il mese scorso:</b> ${G.numero(ind.prodScorso)} · trasportato ${Math.round(ind.perc * 100)}%</p>`;
      } else h += _('<div class="nota">Consuma il carbone per produrre elettricità: paga le consegne ma non produce merci.</div>');
      const ric = ind.ricevutoScorso || {};
      if (Object.keys(ric).length) h += _('<p><b>Ricevuto il mese scorso:</b> ') + Object.keys(ric).map(k => _`${G.numero(ric[k])} ${C.merci[k].unita} di ${nomeMerce(k).toLowerCase()}`).join(', ') + '</p>';
    }
    const staz = ind.stazioni.map(id => s0.stazioni[id]).filter(Boolean);
    h += _`<p><b>Stazioni vicine:</b> ${staz.length ? staz.map(s => `<span class="link" data-az="apriStazione" data-id="${s.id}">${esc(s.nome)}</span>`).join(', ') : _('nessuna')}</p>`;
    return h;
  }

  // il treno disegnato con i suoi vagoni, e i pulsanti per aggiungerne o toglierne
  function htmlComposizione(s0, v, mod) {
    const voluti = G.vagoniVoluti(v), ts = Math.min(110, Math.floor(280 / ((1 + v.vagoni) * 0.44 + 0.12)));
    const inDep = G.vagoniInDeposito(s0, v.merce);
    let nota;
    if (voluti !== v.vagoni) nota = _`diventeranno <b>${voluti}</b> alla prossima fermata`;
    else if (voluti >= mod.vagoni) nota = _('al completo per questa locomotiva');
    else nota = inDep ? _`il prossimo arriva dal deposito (ce ne sono ${inDep})` : _`un vagone nuovo costa ${G.lire(C.vagone.costo)}`;
    return `<div class="composizione">${G.treni.htmlMiniatura(v.modello, v.merce, v.vagoni, ts)}</div>` +
      _`<div class="vagoni"><span>Vagoni</span><button class="mini" data-az="vagoni" data-d="-1" title="Togli un vagone: va nel deposito">−</button><b>${v.vagoni}</b><button class="mini" data-az="vagoni" data-d="1" title="Aggiungi un vagone: dal deposito se c'è, altrimenti nuovo">+</button><span class="sotto">al massimo ${mod.vagoni} · ${nota}</span></div>` +
      _`<div class="sotto"><span class="link" data-az="finestra" data-f="veicoli">🏚️ Deposito dei vagoni</span> · ${inDep} adatti a questo treno</div>`;
  }

  function htmlVeicolo(s0, v) {
    const mod = G.modello(v.modello);
    let h = `<h3>${{ treno: '🚂', bus: '🚌', camion: '🚚', aereo: '✈️', traghetto: '⛴️', cargo: '🚢' }[v.classe]} ${esc(v.nome)}</h3>`;
    h += _`<div class="sotto">${esc(mod.nome)}${v.vagoni ? _` · ${v.vagoni} vagoni` : ''} · ${mod.kmh} km/h · ${v.eta} anni</div>`;
    if (v.tipo === 'treno') h += htmlComposizione(s0, v, mod);
    h += _`<p class="${v.stato === 'bloccato' || v.stato === 'guasto' ? 'rosso' : ''}"><b>Stato:</b> ${esc(G.statoVeicolo(s0, v))}</p>`;
    if (v.tipo === 'treno' && v.stato === 'viaggio') {
      const p = G.pendenzaTreno(s0, v), f = G.fattorePendenza(mod, v, p), q = Math.round(Math.abs(p));
      const op = v.caselle && G.operaRete(s0, v.caselle[v.seg], 'binario');
      h += `<p class="sotto">${q < 1 ? _('➡ In piano') : p > 0 ? _`↗ In salita ${q}‰` : _`↘ In discesa ${q}‰`}` +
        `${op === G.OPERA.GALLERIA ? _(' · 🚇 in galleria') : op === G.OPERA.VIADOTTO ? _(' · 🌉 sul viadotto') : ''}` +
        `${f < 0.995 ? _` · velocità ${Math.round(f * 100)}%` : ''}</p>`;
    }
    h += _`<p><b>Carico:</b> ${pallino(v.merce)}${G.numero(Math.floor(v.qta))} / ${G.numero(v.cap)} ${C.merci[v.merce].unita} di ${nomeMerce(v.merce).toLowerCase()} ${barra(v.qta / v.cap, C.merci[v.merce].colore)}</p>`;
    // conti del mezzo: ricavi − costi = profitto, quest'anno e l'anno scorso; il prezzo d'acquisto a parte
    const cl = n => (n < 0 ? 'rosso' : 'verde'), ripagato = v.prezzo > 0 ? Math.max(0, v.profittoTot / v.prezzo) : 0;
    h += _`<table class="contiMezzo"><tr><th></th><th class="num">${s0.conti.anno}</th><th class="num">anno scorso</th></tr>
      <tr><td title="Quanto ha incassato con le consegne">🟢 Ricavi</td><td class="num verde">${G.lire(v.ricaviAnno)}</td><td class="num sotto">${G.lire(v.ricaviScorso)}</td></tr>
      <tr><td title="Esercizio del mezzo: si paga un dodicesimo al mese">🔴 Costi</td><td class="num">${G.lire(-v.costiAnno)}</td><td class="num sotto">${G.lire(-v.costiScorso)}</td></tr>
      <tr class="totale"><td title="Ricavi − costi">📈 Profitto</td><td class="num ${cl(v.profittoAnno)}">${G.lire(v.profittoAnno)}</td><td class="num ${cl(v.profittoScorso)}">${G.lire(v.profittoScorso)}</td></tr></table>`;
    h += _`<table><tr><td>Costo annuo (esercizio)</td><td class="num">${G.lire(G.esercizioVeicolo(v))}</td></tr>
      <tr><td title="Investimento: non entra nel profitto">Prezzo d'acquisto</td><td class="num">${G.lire(v.prezzo)}</td></tr>
      <tr><td title="Profitto da quando l'hai comprato, rispetto al prezzo">Prezzo già ripagato</td><td class="num ${ripagato >= 1 ? 'verde' : ''}">${Math.round(ripagato * 100)}%${ripagato >= 1 ? ' ✔' : ''}</td></tr>
      <tr><td title="Quanto ricaveresti vendendolo oggi">Valore se lo vendi</td><td class="num">${G.lire(G.valoreVeicolo(v))}</td></tr>
      <tr><td>Guasti</td><td class="num">${v.guasti}</td></tr></table>`;
    h += _('<h4>Percorso</h4>');
    if (v.fermate.length >= 3) {
      // l'ordine vero delle fermate, con i nomi: si capisce subito da dove riparte dopo l'ultima
      const nomi = G.ordineFermate(v).map(k => { const s = s0.stazioni[v.fermate[k].s]; return s ? esc(s.nome) : '?'; });
      h += _`<select class="modoPercorso" data-az="modoPercorso" title="Che cosa fa il mezzo dopo l'ultima fermata">
        <option value="giro" ${v.andataRitorno ? '' : 'selected'}>🔁 Giro: dopo l'ultima torna alla prima</option>
        <option value="ar" ${v.andataRitorno ? 'selected' : ''}>↔ Andata e ritorno: rifà le fermate al contrario</option></select>
        <div class="nota ordineFermate">${nomi.join(' → ')} → ${nomi[0]} …</div>`;
    }
    if (ui.percorso) h += _('<div class="banda">Clicca sulle stazioni da aggiungere al percorso. <b>Esc</b> o il pulsante qui sotto per finire.</div>');
    h += '<ol class="fermate">';
    v.fermate.forEach((f, k) => {
      const s = s0.stazioni[f.s];
      let avv = '';
      if (s && (f.trasbordo || (!s.accetta[v.merce] && G.altroRitira(s0, s, v)))) avv = _`<span class="sotto" title="Qui il carico passa a un mezzo di un altro tipo (trasbordo)">⇄</span> `;
      else if (s && !s.accetta[v.merce] && !s.fornisce[v.merce]) avv = _`<span class="rosso" title="Qui ${nomeMerce(v.merce).toLowerCase()} non si carica e non si scarica">⚠</span> `;
      else if (s && !s.accetta[v.merce]) avv = _`<span class="sotto" title="Qui si carica soltanto">⬆</span> `;
      else if (s && !s.fornisce[v.merce]) avv = _`<span class="sotto" title="Qui si scarica soltanto">⬇</span> `;
      // come aspetta in questa fermata: parte subito, aspetta il pieno, o aspetta un certo tempo
      const modo = f.pieno ? 'pieno' : f.attesaMin > 0 ? 'tempo' : '';
      const am = f.attesaMin || 0;
      const trasb = _`<label class="trasbordo" title="Lascia qui tutto il carico: lo porterà avanti un mezzo di un altro tipo (dal treno alla nave e viceversa). Questo mezzo è pagato per il suo pezzo di viaggio."><input type="checkbox" data-az="trasbordoFermata" data-k="${k}" ${f.trasbordo ? 'checked' : ''}> ⇄ trasbordo</label>`;
      const campo = (u, val, max) => `<input type="number" class="durata" data-az="durata" data-k="${k}" data-u="${u}" min="0" max="${max}" value="${val}">`;
      h += _`<li class="${k === v.idx ? 'attuale' : ''}">${avv}<span class="link" data-az="apriStazione" data-id="${f.s}">${s ? esc(s.nome) : '?'}</span>
        <button class="mini" data-az="suFermata" data-k="${k}" title="Sposta su">▲</button><button class="mini" data-az="togliFermata" data-k="${k}" title="Togli">✕</button>
        <div class="attesaFermata"><select data-az="modoAttesa" data-k="${k}" title="Quanto aspetta in questa stazione prima di ripartire">
          <option value="" ${modo === '' ? 'selected' : ''}>parte appena carico</option>
          <option value="pieno" ${modo === 'pieno' ? 'selected' : ''}>attende il pieno</option>
          <option value="tempo" ${modo === 'tempo' ? 'selected' : ''}>attende fino a…</option></select>
        ${modo === 'tempo' ? _`<span class="durate" title="Riparte allo scadere del tempo, o prima se è pieno">${campo('g', Math.floor(am / 1440), 120)} g ${campo('h', Math.floor((am % 1440) / 60), 23)} h ${campo('m', am % 60, 59)} min</span>` : ''}${trasb}</div></li>`;
    });
    h += '</ol>';
    if (v.fermate.length) h += _('<div class="nota">⬆ qui si carica soltanto · ⬇ qui si scarica soltanto · ⇄ qui passa a un mezzo di un altro tipo · ⚠ qui questa merce non si carica né si scarica</div>');
    if (v.fermate.length < 2 && !ui.percorso) h += _('<div class="nota">Servono almeno due fermate: premi «Aggiungi fermate» e clicca sulle stazioni.</div>');
    h += _`<div class="pulsanti">
      <button class="${ui.percorso ? 'attivo' : 'primario'}" data-az="fermate">${ui.percorso ? _('✔ Fine fermate') : _('➕ Aggiungi fermate')}</button>
      <button class="${ui.segui ? 'attivo' : ''}" data-az="segui">🎥 Segui</button>
      <button data-az="fermaVeicolo">${v.fermoManuale ? _('▶ Riparti') : _('⏸ Resta in stazione')}</button>
      ${v.tipo !== 'aereo' && (v.stato === 'viaggio' || v.stato === 'bloccato') ? _`<button class="${v.stallo ? 'attivo' : ''}" data-az="tornaIndietro" title="Torna alla fermata precedente (per sbloccare due treni che si bloccano a vicenda)">↩ Torna indietro</button>` : ''}
      <button data-az="vendi">💰 Vendi (${G.lire(G.valoreVeicolo(v))})</button>
      ${v.tipo === 'treno' ? _`<button data-az="vendiLoco" title="I vagoni restano nel deposito, per altri treni">🚂 Vendi solo la locomotiva (${G.lire(G.valoreLocomotiva(v))})</button>` : ''}</div>`;
    return h;
  }

  function htmlCasella(s0, i) {
    const m = s0.mondo, x = i % m.W, y = (i / m.W) | 0, t = G.NOMI_TERRENO[m.tipo[i]];
    let h = _`<h3>📍 Casella ${x}, ${y}</h3><p><b>Terreno:</b> ${G.tr(t)}${m.bosco[i] ? _(', bosco') : ''} · quota ${G.numero(G.metriTerreno(m)[i])} m</p>`;
    if (m.tipo[i] !== G.T.ACQUA) {
      const km = G.kmCasella(s0), bosco = m.bosco[i] ? C.costoBosco * km : 0, costo = r => C.reti[r].costo * C.moltTerreno[t] * km + bosco;
      h += _`<p><b>Costo per casella</b> (${G.numero(km)} km${C.moltTerreno[t] > 1 ? _`, terreno ×${C.moltTerreno[t]}` : ''}${bosco ? _(', bosco da tagliare') : ''}): ferrovia ${G.lire(costo('binario'))}, strada ${G.lire(costo('strada'))}</p>`;
      if (m.tipo[i] === G.T.FIUME) h += _('<div class="nota">Sul fiume serve un ponte: costa di più.</div>');
      h += _('<div class="nota">Tutti i costi nell\'aiuto (H), scheda «Costi».</div>');
    }
    const c = G.cittaVicina(s0, x, y);
    if (c) h += _`<p><b>Città più vicina:</b> <span class="link" data-az="apriCitta" data-id="${c.id}">${esc(c.nome)}</span></p>`;
    // la rete nella casella, con l'opera (galleria o viadotto) e la quota a cui passa
    const opera = (rete, op) => {
      const q = G.quotaRete(s0, i, rete), d = Math.round(q - G.metriTerreno(m)[i]);
      if (op === G.OPERA.GALLERIA) return _` in galleria, a ${G.numero(q)} m (${G.numero(-d)} m sotto il terreno)`;
      if (op === G.OPERA.VIADOTTO) return _` su un viadotto, a ${G.numero(q)} m (${G.numero(d)} m sopra il terreno)`;
      return Math.abs(d) >= 3 ? _` in ${d < 0 ? _('trincea') : _('rilevato')} di ${G.numero(Math.abs(d))} m` : '';
    };
    if (m.mBin[i]) h += _`<p>🛤️ Binario${opera('binario', m.operaBin[i])}</p>`;
    if (m.mStr[i]) h += `<p>${m.tipoStr[i] === 2 ? _('🚧 Autostrada') : m.strCitta[i] ? _('🛣️ Strada comunale') : _('🛣️ Strada')}${m.strCitta[i] ? '' : opera('strada', m.operaStr[i])}</p>`;
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
  let pannelloVisto = '';
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
    h = '<button class="chiudi" data-az="chiudiPannello" title="Chiudi (Esc)">✕</button>' + h;
    if (h !== pannelloVisto) { const sc = el.scrollTop; el.innerHTML = h; G.treni.dipingiMiniature(el); el.scrollTop = sc; pannelloVisto = h; }
    el.classList.remove('nascosto');
  }

  // ---------------------------------------------------------------- finestre
  // rifai: funzione che ridisegna la finestra con i numeri del momento (aggiornamento in diretta), o niente
  let corpoVisto = '', inDiretta = false;
  function apriFinestra(titolo, corpo, larga, rifai) {
    $('#finestra .testa span').textContent = titolo;
    const el = $('#finestra .corpo');
    if (!inDiretta || ui.finestra !== titolo || corpo !== corpoVisto) { const sc = el.scrollTop; el.innerHTML = corpo; G.treni.dipingiMiniature(el); if (inDiretta) el.scrollTop = sc; }
    corpoVisto = corpo;
    $('#finestra .riquadro').classList.toggle('larga', !!larga);
    $('#finestra').classList.remove('nascosto');
    ui.finestra = titolo;
    ui.rifaiFinestra = rifai || null;
  }
  function chiudiFinestra() {
    if (!st()) return; // senza partita la finestra di avvio resta
    $('#finestra').classList.add('nascosto');
    ui.finestra = null; ui.rifaiFinestra = null;
  }

  // ---------------------------------------------------------------- aggiornamento in diretta
  // ogni secondo si rifanno la finestra aperta (se lo prevede: gestione, mezzi) e il pannello a destra, così i
  // guadagni dei treni salgono sotto gli occhi. Si salta se il gioco è fermo, se si sta scrivendo in un campo,
  // se il tasto del mouse è giù (il clic andrebbe perso) o se il mouse è su un grafico (sparirebbe il suggerimento);
  // la pagina cambia solo se il testo è diverso. ui.tempoDiretta = durata dell'ultimo aggiornamento (ms).
  ui.tempoDiretta = 0;
  let premuto = false;
  document.addEventListener('pointerdown', () => { premuto = true; }, true);
  document.addEventListener('pointerup', () => { premuto = false; }, true);
  setInterval(() => {
    if (!st() || !C.velocita[ui.velocita] || premuto) return;
    const att = document.activeElement, scrive = att && /^(INPUT|SELECT|TEXTAREA)$/.test(att.tagName);
    const t0 = performance.now();
    if (ui.finestra && ui.rifaiFinestra && !(scrive && $('#finestra').contains(att)) && !$('#finestra').classList.contains('nascosto') && !document.querySelector('#finestra svg:hover')) { inDiretta = true; try { ui.rifaiFinestra(); } finally { inDiretta = false; } }
    if (ui.pannello && !(scrive && $('#pannello').contains(att))) disegnaPannello();
    ui.tempoDiretta = performance.now() - t0;
  }, 1000);

  function finestraAcquisto(sid) {
    const s0 = st(), s = s0.stazioni[sid];
    const tipo = { stazione: 'treno', deposito: 'strada', aeroporto: 'aereo', porto: 'nave' }[s.tipo];
    const mod = G.modelliDisponibili(s0, tipo);
    if (!mod.length) { G.avviso(_('Nessun mezzo disponibile in questo anno'), true); return; }
    let h = _`<p>Il mezzo parte da <b>${esc(s.nome)}</b>. Dopo l'acquisto aggiungi le altre fermate cliccando sulle stazioni.</p>`;
    h += _`<label>Modello<select id="acqModello" data-cambia="acquisto">${mod.map(k => `<option value="${k.id}">${esc(k.nome)} — ${k.kmh} km/h — ${G.lire(k.costo)}</option>`).join('')}</select></label>`;
    h += _('<label>Merce<select id="acqMerce" data-cambia="acquisto"></select></label>');
    if (tipo === 'treno') h += _('<label>Vagoni: <b id="acqNumVag">3</b><input type="range" id="acqVagoni" min="1" max="4" value="3" data-cambia="acquisto"></label>');
    h += _`<div id="acqRiepilogo" class="riepilogo"></div><div class="pulsanti"><button class="primario" data-az="confermaAcquisto" data-id="${sid}">🛒 Compra</button><button data-az="chiudiFinestra">Annulla</button></div>`;
    apriFinestra(_('Acquista un mezzo'), h);
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
    const usati = mod.tipo === 'treno' ? Math.min(vag, G.vagoniInDeposito(st(), merce)) : 0, prezzo = G.prezzoVeicolo(mod, vag) - usati * C.vagone.costo;
    $('#acqRiepilogo').innerHTML = _`Capacità: <b>${G.numero(cap)} ${C.merci[merce].unita}</b> · Prezzo: <b class="${prezzo > st().soldi ? 'rosso' : ''}">${G.lire(prezzo)}</b> · Costo annuo: ${G.lire(mod.esercizio + vag * C.vagone.esercizio)}` +
      (usati ? _`<br>${usati} ${usati === 1 ? _('vagone arriva') : _('vagoni arrivano')} dal deposito, gratis` : '');
    if (mod.tipo === 'treno') {
      $('#acqRiepilogo').insertAdjacentHTML('afterbegin', `<div class="composizione">${G.treni.htmlMiniatura(mod.id, merce, vag, Math.min(110, Math.floor(440 / ((1 + vag) * 0.44 + 0.12))))}</div>`);
      G.treni.dipingiMiniature($('#acqRiepilogo'));
    }
  }

  // il deposito dei vagoni tolti ai treni: si rimontano gratis su altri treni della stessa famiglia, o si vendono
  function htmlDeposito(s0) {
    const dep = s0.depositoVagoni || {}, fam = Object.keys(G.FAMIGLIE_VAGONI).filter(k => dep[k] > 0);
    if (!fam.length) return _('<h4>🏚️ Deposito dei vagoni</h4><p class="sotto">Vuoto. Ci finiscono i vagoni che togli a un treno (pulsante − nel suo pannello) e quelli che tieni vendendo solo la locomotiva.</p>');
    let h = _('<h4>🏚️ Deposito dei vagoni</h4><div class="deposito">');
    for (const k of fam) {
      const [nome, merce] = G.FAMIGLIE_VAGONI[k];
      h += `<div class="voceDeposito">${G.treni.htmlMiniatura('', merce, Math.min(dep[k], 4), 56, G.anno(s0))}<span><b>${dep[k]}</b> × ${nome}</span>` +
        `<button class="mini" data-az="vendiVagone" data-fam="${k}">${_`💰 Vendine uno (${G.lire(G.valoreVagoneUsato())})`}</button></div>`;
    }
    return h + _('</div><div class="nota">I vagoni del deposito si rimontano gratis: con il pulsante + nel pannello di un treno che porta la stessa merce, oppure comprando un treno nuovo.</div>');
  }

  function finestraVeicoli() {
    const s0 = st();
    let h = '';
    if (!s0.veicoli.length) h = _('<p>Non hai ancora mezzi. Costruisci due stazioni collegate, poi clicca su una stazione e premi «Compra».</p>') + htmlDeposito(s0);
    else {
      const a = s0.conti.anno;
      h = htmlDeposito(s0) + _`<table class="elenco"><tr><th>Mezzo</th><th>Merce</th><th>Stato</th><th class="num">Ricavi ${a}</th><th class="num">Costi ${a}</th><th class="num">Profitto ${a}</th><th class="num">Profitto anno scorso</th><th class="num">Età</th></tr>`;
      for (const v of [...s0.veicoli].sort((a, b) => b.profittoAnno - a.profittoAnno)) {
        h += `<tr class="link" data-az="apriVeicolo" data-id="${v.id}"><td>${esc(v.nome)}<div class="sotto">${esc(G.modello(v.modello).nome)}</div>${v.tipo === 'treno' ? G.treni.htmlMiniatura(v.modello, v.merce, v.vagoni, Math.min(64, Math.floor(300 / ((1 + v.vagoni) * 0.44 + 0.12)))) : ''}</td>
          <td>${pallino(v.merce)}${nomeMerce(v.merce)}</td><td>${esc(G.statoVeicolo(s0, v))}</td>
          <td class="num verde">${G.lire(v.ricaviAnno)}</td><td class="num">${G.lire(-v.costiAnno)}</td>
          <td class="num ${v.profittoAnno < 0 ? 'rosso' : 'verde'}"><b>${G.lire(v.profittoAnno)}</b></td>
          <td class="num ${v.profittoScorso < 0 ? 'rosso' : 'verde'}">${G.lire(v.profittoScorso)}</td><td class="num">${v.eta}</td></tr>`;
      }
      h += _('</table><div class="nota">Profitto = ricavi (le consegne) − costi (l\'esercizio del mezzo). Il prezzo d\'acquisto è un investimento e non entra nel profitto.</div>');
    }
    apriFinestra(_`Mezzi (${s0.veicoli.length})`, h, true, finestraVeicoli);
  }

  // Colonne delle tabelle del mondo: ogni colonna si ordina con un clic sull'intestazione (un altro clic inverte).
  // v = valore per ordinare (numero o testo); num = colonna numerica (all'inizio dal più grande)
  const prodIndustria = ind => { const def = C.industrie[ind.tipo]; return def.produce ? ind.produzione : def.uscita ? ind.prodScorso : -1; };
  const attesaTot = s => Object.values(s.attesa).reduce((a, q) => a + (q >= 1 ? q : 0), 0);
  const mezziStazione = s => st().veicoli.filter(v => v.fermate.some(f => f.s === s.id)).length;
  const COLONNE_MONDO = {
    citta: [
      { k: 'nome', t: _('Città'), v: c => c.nome }, { k: 'pop', t: _('Abitanti'), v: c => c.pop, num: true },
      { k: 'crescita', t: _('Crescita'), v: c => c.crescita, num: true }, { k: 'servite', t: _('Stazioni servite'), v: c => c.nServite, num: true }],
    industrie: [
      { k: 'nome', t: _('Industria'), v: k => k.nome }, { k: 'tipo', t: _('Tipo'), v: k => C.industrie[k.tipo].nome },
      { k: 'prod', t: _('Produzione / mese'), v: prodIndustria, num: true }, { k: 'perc', t: _('Trasportato'), v: k => k.perc, num: true },
      { k: 'riserva', t: _('Riserva'), v: k => (C.industrie[k.tipo].riserva ? k.riserva / k.riservaIniziale : -1), num: true }],
    stazioni: [
      { k: 'nome', t: _('Stazione'), v: s => s.nome }, { k: 'tipo', t: _('Tipo'), v: s => G.nomeTipoStazione(s) },
      { k: 'pop', t: _('Abitanti nel bacino'), v: s => s.popBacino || 0, num: true }, { k: 'mezzi', t: _('Mezzi'), v: mezziStazione, num: true },
      { k: 'attesa', t: _('In attesa'), v: attesaTot, num: true }]
  };
  ui.ordineMondo = { citta: { k: 'pop', dir: -1 }, industrie: { k: 'tipo', dir: 1 }, stazioni: { k: 'nome', dir: 1 } };
  function ordinaMondo(scheda, el) {
    const o = ui.ordineMondo[scheda], cols = COLONNE_MONDO[scheda], col = cols.find(c => c.k === o.k) || cols[0], nome = cols[0].v;
    return el.map(x => [x, col.v(x)]).sort((a, b) => {
      const d = typeof a[1] === 'string' ? a[1].localeCompare(b[1], 'it') : a[1] - b[1];
      return d * o.dir || nome(a[0]).localeCompare(nome(b[0]), 'it');
    }).map(x => x[0]);
  }
  function intestazioneMondo(scheda) {
    const o = ui.ordineMondo[scheda];
    return '<tr>' + COLONNE_MONDO[scheda].map(c => `<th class="ordina${c.num ? ' num' : ''}${c.k === o.k ? ' attiva' : ''}" data-az="ordinaMondo" data-s="${scheda}" data-k="${c.k}" title="Ordina per ${c.t.toLowerCase()}">` +
      `${c.t}<span class="freccia">${c.k === o.k ? (o.dir > 0 ? '▲' : '▼') : '↕'}</span></th>`).join('') + '</tr>';
  }

  function finestraMondo(scheda) {
    const s0 = st();
    scheda = scheda || ui.schedaMondo || 'citta';
    ui.schedaMondo = scheda;
    let h = `<div class="schede">${['citta', 'industrie', 'stazioni'].map(k => `<button class="${k === scheda ? 'attivo' : ''}" data-az="schedaMondo" data-s="${k}">${{ citta: _('🏙️ Città'), industrie: _('🏭 Industrie'), stazioni: _('🚉 Stazioni') }[k]}</button>`).join('')}</div>`;
    if (scheda === 'citta') {
      if (s0.citta.length > 200) h += '<input id="cercaCitta" class="cerca" placeholder="🔍 Cerca una città per nome…" autocomplete="off">';
      h += `<table class="elenco"><thead>${intestazioneMondo('citta')}</thead><tbody id="elencoCitta">${righeCitta('')}</tbody>`;
    } else if (scheda === 'industrie') {
      h += '<table class="elenco">' + intestazioneMondo('industrie');
      for (const ind of ordinaMondo('industrie', s0.industrie.filter(k => !k.chiusa))) {
        const def = C.industrie[ind.tipo];
        const prod = def.produce ? `${G.numero(ind.produzione)} ${C.merci[def.produce].unita}` : def.uscita ? `${G.numero(ind.prodScorso)} ${C.merci[def.uscita].unita}` : '—';
        h += `<tr class="link" data-az="apriIndustria" data-id="${ind.id}" data-vai="1"><td>${def.icona} ${esc(ind.nome)}</td><td class="sotto">${def.nome}</td><td class="num">${prod}</td><td class="num">${Math.round(ind.perc * 100)}%</td><td>${def.riserva ? barra(ind.riserva / ind.riservaIniziale, '#c9a227') : ''}</td></tr>`;
      }
    } else {
      h += '<table class="elenco">' + intestazioneMondo('stazioni');
      for (const s of ordinaMondo('stazioni', s0.stazioni.filter(Boolean))) {
        const att = Object.keys(s.attesa).filter(k => s.attesa[k] >= 1).map(k => `${pallino(k)}${G.numero(s.attesa[k])}`).join(' ') || '—';
        h += `<tr class="link" data-az="apriStazione" data-id="${s.id}" data-vai="1"><td>${esc(s.nome)}</td><td>${G.nomeTipoStazione(s)}</td><td class="num">${G.numero(s.popBacino || 0)}</td><td class="num">${mezziStazione(s)}</td><td>${att}</td></tr>`;
      }
      if (!s0.stazioni.some(Boolean)) h += _('<tr><td colspan="5" class="sotto">Nessuna stazione.</td></tr>');
    }
    h += '</table>';
    apriFinestra(_('Il mondo'), h, true);
  }

  // righe della tabella delle città: sulle mappe reali sono migliaia, quindi solo le prime 200 nell'ordine scelto
  // più quelle servite, oppure quelle che contengono il testo cercato
  function righeCitta(cerca) {
    const s0 = st(), t = cerca.trim().toLowerCase();
    let el = ordinaMondo('citta', s0.citta);
    if (t) el = el.filter(c => c.nome.toLowerCase().includes(t)).slice(0, 200);
    else if (el.length > 200) el = el.filter((c, k) => k < 200 || c.nServite > 0);
    let h = '';
    for (const c of el) {
      h += `<tr class="link" data-az="apriCitta" data-id="${c.id}" data-vai="1"><td>${esc(c.nome)}<div class="sotto">${G.classeCitta(c.pop)}</div></td><td class="num">${G.numero(c.pop)}</td><td class="num">${c.crescita >= 0 ? '+' : ''}${c.crescita}</td><td class="num">${c.nServite}</td></tr>`;
    }
    const altre = s0.citta.length - el.length;
    if (altre > 0 && !t) h += _`<tr><td colspan="4" class="sotto">… e altre ${G.numero(altre)} città e paesi: cercali per nome.</td></tr>`;
    if (!el.length) h += _('<tr><td colspan="4" class="sotto">Nessuna città con questo nome.</td></tr>');
    return h;
  }

  // il quadro di gestione sta in gestione.js e la banca in banca.js: usano questa per aprire la finestra
  ui.apriFinestra = (titolo, corpo, larga, rifai) => apriFinestra(titolo, corpo, larga, rifai);

  // l'aiuto a schede: come si gioca, quanto costa costruire, come leggere i conti, comandi
  const SCHEDE_AIUTO = { gioco: _('🚂 Come si gioca'), costi: _('🏗️ Costi'), soldi: _('💰 Soldi e profitti'), comandi: _('⌨️ Comandi') };
  function finestraAiuto(scheda) {
    scheda = SCHEDE_AIUTO[scheda] ? scheda : 'gioco';
    const testa = `<div class="schede">${Object.keys(SCHEDE_AIUTO).map(k => `<button class="${k === scheda ? 'attivo' : ''}" data-az="schedaAiuto" data-s="${k}">${SCHEDE_AIUTO[k]}</button>`).join('')}</div>`;
    const corpo = { gioco: aiutoGioco, costi: aiutoCosti, soldi: aiutoSoldi, comandi: aiutoComandi }[scheda]();
    apriFinestra(_('Come si gioca'), testa + corpo, true);
  }

  function aiutoCosti() {
    const s0 = st(), km = s0 ? G.kmCasella(s0) : 1;
    const terreni = Object.keys(C.moltTerreno).filter(t => isFinite(C.moltTerreno[t]));
    const reti = Object.keys(C.reti);
    let h = _`<p>Le reti si pagano <b>casella per casella</b>: costo della rete × moltiplicatore del terreno${km !== 1 ? _` × <b>${G.numero(km)} km</b>
      (in questa partita una casella è lunga ${G.numero(km)} km)` : ''}. Se nella casella c'è un bosco si aggiunge il taglio.
      Mentre trascini vedi il tracciato e il prezzo prima di costruire: è il percorso <b>più economico</b>, non il più corto, quindi gira
      attorno alle montagne e passa i fiumi dove conviene.</p>`;
    h += _`<table class="elenco"><tr><th>Terreno</th><th class="num">×</th>${reti.map(r => `<th class="num">${C.reti[r].nome}</th>`).join('')}</tr>`;
    for (const t of terreni) h += `<tr><td>${G.tr(t)[0].toUpperCase() + G.tr(t).slice(1)}${t === 'fiume' ? _(' (ponte)') : ''}</td><td class="num">×${C.moltTerreno[t]}</td>${reti.map(r => `<td class="num">${G.lire(C.reti[r].costo * C.moltTerreno[t] * km)}</td>`).join('')}</tr>`;
    h += _`<tr><td>Bosco (in più)</td><td></td><td class="num" colspan="${reti.length}">${G.lire(C.costoBosco * km)} a casella</td></tr>`;
    h += _('<tr><td>Mare e laghi</td><td></td><td colspan="9" class="sotto">non si costruisce</td></tr></table>');
    h += _`<ul><li>Dove la rete c'è già non si paga: si può partire da un binario esistente. Le <b>strade comunali</b> delle città sono gratis.</li>
      <li>L'<b>autostrada</b> costruita sopra una strada costa il 40% in meno.</li>
      <li>Case e industrie non si attraversano: prima vanno demolite (una casa costa ${G.lire(C.costoCasa)} per piano).</li>
      <li>Demolire un pezzo di rete o una stazione costa ${G.lire(C.costoDemolizione)}.</li>
      <li>Una casella in diagonale costa come una diritta.</li></ul>`;
    const O = C.opere;
    h += _`<h4>Pendenze, gallerie e viadotti</h4>
      <p>Ogni casella ha una quota in metri (la vedi passandoci sopra). Una linea non può salire o scendere più di
      <b>${O.pendenzaMax.binario}‰</b> per la ferrovia (${O.pendenzaMax.binario} m ogni km), <b>${O.pendenzaMax.strada}‰</b> per la strada e
      <b>${O.pendenzaMax.autostrada}‰</b> per l'autostrada. Il gioco disegna da solo il profilo della linea: sopra le valli fa i viadotti.
      Dove servirebbe una galleria la <b>ferrovia</b> e l'<b>autostrada non si costruiscono</b>: la galleria la scavi tu con 🚇 Galleria
      (menu della ferrovia, tasto B, o dell'autostrada, tasto U), dritta, che sale o scende al massimo con la stessa pendenza della rete. Le strade normali invece fanno ancora le gallerie da sole.</p>
      <table class="elenco"><tr><td>🚇 <b>Galleria</b></td><td>la linea passa più di ${O.sogliaMetri} m sotto il terreno</td><td class="num">×${O.galleria} il costo al km della rete</td></tr>
      <tr><td>🌉 <b>Viadotto</b></td><td>la linea passa più di ${O.sogliaMetri} m sopra il terreno</td><td class="num">×${O.viadotto} il costo al km, +100% ogni 100 m d'altezza</td></tr>
      <tr><td>⛏️ Trincea o rilevato</td><td>scarti più piccoli</td><td class="num">${G.lire(O.scavoAlMetro * km)} per metro a casella</td></tr></table>
      <p>Mentre trascini vedi quante gallerie e viadotti servono e la pendenza più forte. La ricerca del tracciato ne tiene conto:
      spesso conviene girare attorno a un monte invece di forarlo. In galleria e sul viadotto il bosco non si taglia.</p>
      <p><b>I treni rallentano in salita</b>: un treno a vapore pieno al ${O.pendenzaMax.binario}‰ va a circa metà velocità, le
      locomotive elettriche e diesel reggono il doppio della pendenza e un treno corto sale meglio di uno lungo. In discesa si frena
      un poco. Il pannello del treno mostra se sta salendo e di quanto rallenta.</p>`;
    h += _('<h4>Manutenzione (ogni anno, pagata un dodicesimo al mese)</h4><table class="elenco">');
    for (const r of reti) h += _`<tr><td>${C.reti[r].nome}</td><td class="num">${G.lire(C.reti[r].manutenzione)} al km</td></tr>`;
    h += _('</table><p class="sotto">La manutenzione delle reti non dipende dal terreno: un km in montagna costa come uno in pianura.</p>');
    h += _('<h4>Stazioni</h4><table class="elenco"><tr><th>Tipo</th><th class="num">Costo</th><th class="num">Manutenzione all\'anno</th><th class="num">Bacino</th></tr>');
    for (const k in C.taglieStazione) { const d = C.taglieStazione[k]; h += `<tr><td>🚉 ${d.nome}${d.anno ? _` (dal ${d.anno})` : ''}</td><td class="num">${G.lire(d.costo)}</td><td class="num">${G.lire(d.manutenzione)}</td><td class="num">${d.raggio} caselle</td></tr>`; }
    for (const k of ['deposito', 'aeroporto', 'porto']) { const d = C.stazioni[k]; h += `<tr><td>${d.icona} ${d.nome}${d.anno ? _` (dal ${d.anno})` : ''}</td><td class="num">${G.lire(d.costo)}</td><td class="num">${G.lire(d.manutenzione)}</td><td class="num">${d.raggio} caselle</td></tr>`; }
    h += '</table>';
    h += _`<h4>Mezzi</h4><p>Ogni modello ha un prezzo e un <b>costo annuo di esercizio</b>; ogni vagone costa ${G.lire(C.vagone.costo)} più
      ${G.lire(C.vagone.esercizio)} l'anno. L'esercizio cresce del 4% per ogni anno di età, e i mezzi fuori produzione si guastano più spesso.</p>`;
    return h;
  }

  function aiutoSoldi() {
    return _`${G.SPIEGAZIONE_CONTI || ''}
      <h4>🟢 Ricavi</h4>
      <p>Si incassa a ogni consegna: <b>unità × prezzo della merce × distanza</b> in linea d'aria fra la stazione di partenza e quella
      d'arrivo. Se il viaggio dura più di quanto la merce sopporta il prezzo cala: i passeggeri e la posta vogliono mezzi veloci,
      carbone e ferro possono aspettare. Si paga solo dove la merce è accettata.</p>
      <h4>🔴 Costi</h4>
      <p>Sono le spese che si pagano <b>sempre</b>, anche con i mezzi fermi: l'<b>esercizio</b> dei mezzi, la <b>manutenzione</b> di
      binari, strade e stazioni e gli <b>interessi</b> dei prestiti. Si pagano un dodicesimo al mese.</p>
      <h4>🏦 La banca (tasto K)</h4>
      <p>Puoi chiedere un prestito fino al tuo <b>fido</b> (il valore dell'azienda, almeno ${G.lire(C.banca.fidoMin)}) e restituirlo quando vuoi.
      Il <b>tasso di riferimento</b> cambia ogni mese: segue a grandi linee la storia dei tassi italiani (bassi nell'Ottocento, altissimi
      intorno al 1980, quasi zero intorno al 2015) con un po' di caso e qualche scossa. Al riferimento si aggiunge lo <b>spread</b>, il tuo
      rischio: sale se hai tanto debito rispetto a quello che possiedi, se la cassa è in rosso o se sei in perdita (rating da AAA a D).
      Il prestito <b>variabile</b> segue il tasso mese per mese; il <b>fisso</b> costa un po' di più ma resta uguale per sempre
      (restituirlo prima costa una penale dell'${Math.round(C.banca.penaleFisso * 100)}%). Strategia: fisso quando i tassi stanno per salire, variabile quando scendono.
      Il prestito non è un ricavo: porta soldi in cassa ma anche debito, quindi non cambia il valore dell'azienda.</p>
      <h4>📈 Profitto</h4>
      <p><b>Profitto = ricavi − costi.</b> Dice se la compagnia guadagna: è il numero in alto a sinistra («Profitto» dell'anno).
      Se è negativo stai perdendo soldi ogni mese.</p>
      <h4>🟣 Investimenti</h4>
      <p>Costruire reti e stazioni e comprare mezzi sono <b>investimenti</b>: si pagano una volta e non sono costi, perché quello che
      hai costruito resta e fa crescere il <b>valore dell'azienda</b>. Per questo non abbassano il profitto, ma fanno scendere la cassa.
      La vendita di un mezzo è un investimento al contrario.</p>
      <h4>💰 Cassa e valore</h4>
      <p>La <b>cassa</b> cresce del profitto e cala degli investimenti. Il <b>valore dell'azienda</b> = cassa + valore dei mezzi + metà del
      costo della rete − debito. Il primo anno, con tante costruzioni, la cassa scende anche se il profitto è buono: è normale.</p>
      <h4>🚂 I conti di ogni mezzo</h4>
      <p>Per ogni mezzo vedi <b>ricavi</b> (le sue consegne), <b>costi</b> (il suo esercizio) e <b>profitto</b>. Il prezzo d'acquisto non
      entra nel profitto: nel pannello del mezzo c'è «Prezzo già ripagato», cioè quanto del prezzo è tornato indietro col profitto.
      La manutenzione della rete e gli interessi sono di tutta la compagnia, quindi la somma dei profitti dei mezzi è più alta del profitto
      della compagnia. Il quadro di gestione (tasto E) mostra tutto mese per mese.</p>`;
  }

  function aiutoComandi() {
    return _`<table class="elenco"><tr><td>Sposta la mappa</td><td>trascina col tasto destro (o sinistro con 🔍), frecce</td></tr>
      <tr><td>Zoom</td><td>rotellina, tasti + e −</td></tr>
      <tr><td>Vista 3D</td><td>D passa dalla vista dall'alto (2D) a quella in 3D assonometrica e ritorno · O gira la vista 3D di 90° (Maiusc+O al contrario)</td></tr>
      <tr><td>Strumenti</td><td>I info · B ferrovia (normale o galleria) · R strada · U autostrada (normale o galleria) · T stazione (apre le dimensioni) · F autostazione · A aeroporto · P porto · X demolisci</td></tr>
      <tr><td>Finestre</td><td>V mezzi · M mondo · E gestione (conti e grafici) · K banca · H aiuto · G griglia · L livelli della mappa (cosa mostrare) · C vie dei paesi</td></tr>
      <tr><td>Tempo</td><td>spazio pausa · 1 normale (1 secondo = 5 minuti) · 2 veloce (1 ora al secondo) · 3 velocissimo (1 giorno al secondo) · 4 turbo (1 settimana al secondo)</td></tr>
      <tr><td>Annulla / chiudi</td><td>Esc</td></tr></table>
      <p class="sotto">Le partite si salvano dal pulsante 💾 Partita: nel browser oppure su file.</p>`;
  }

  function aiutoGioco() {
    return _`
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
      <p>Con tre o più fermate scegli cosa fa il mezzo dopo l'ultima: <b>🔁 giro</b> (torna dritto alla prima: Milano → Vercelli →
      Torino → Milano, passando da Vercelli senza fermarsi) oppure <b>↔ andata e ritorno</b> (Milano → Vercelli → Torino → Vercelli →
      Milano). Sulla mappa il percorso del mezzo selezionato segue i binari; il tratto pieno è il viaggio in corso.</p>
      <h4>⛰️ Montagne: gallerie e viadotti</h4>
      <p>Il pulsante della ferrovia (tasto B) apre un menu con tre voci; quello dell'autostrada (tasto U) uguale, con il limite del ${C.opere.pendenzaMax.autostrada}‰:</p>
      <ul><li><b>🛤️ Ferrovia normale</b>: segue il terreno e non sale né scende più del ${C.opere.pendenzaMax.binario}‰
      (${C.opere.pendenzaMax.binario} m ogni km). Sopra le valli fa da sola i <b>viadotti</b> 🌉 e, per scavalcare un dosso o salire
      a una città in alto, <b>si sopraeleva già prima</b> su rilevati e viadotti, a rampa (più è alto il viadotto, più costa). Se nemmeno così ce la fa
      <b>non si costruisce</b>: il monte da forare diventa rosso. Scava lì una galleria (anche più di una, se serve) oppure gira attorno.</li>
      <li><b>🚇 Galleria</b>: la scavi tu. Trascina dall'<b>imbocco</b> fino all'<b>uscita</b> dall'altra parte del monte: la galleria è
      <b>dritta</b> e va dalla quota dell'imbocco a quella dell'uscita: può <b>salire o scendere</b> al massimo del ${C.opere.pendenzaMax.binario}‰
      (l'autostrada del ${C.opere.pendenzaMax.autostrada}‰), come la linea all'aperto. Sopra deve esserci almeno ${C.opere.sogliaMetri} m di monte (vicino agli imbocchi
      basta stare sotto il terreno). Se la linea dritta ripassa sopra una valle, lì esce all'aperto da sola (trincea, rilevato o viadotto) e la galleria si divide in più gallerie. Costa
      ${C.opere.galleria} volte il binario. Poi collega i due imbocchi alle linee con la ferrovia normale.</li>
        <li><b>📐 Progettazione</b>: per studiare una linea difficile senza spendere. Clicca i punti uno dopo l'altro: ogni tratto si calcola come costruendolo (normale o in galleria), sulla mappa vedi gallerie e viadotti e nel riquadro il <b>profilo altimetrico</b>, la pendenza, il costo e i tratti impossibili. Quando il progetto va bene, «Costruisci tutto» (Invio); Backspace toglie l'ultimo punto, Esc annulla.</li></ul>
      <ul>
      <li>In <b>salita</b> i treni rallentano (il vapore molto più delle elettriche), quindi una galleria in piano può far guadagnare tempo.</li>
      <li>Clicca con 🔍 su una casella della linea per sapere se è in galleria o su un viadotto e a che quota passa.</li></ul>
      <h4>Cosa vedi sulla mappa</h4>
      <table class="elenco legendaMappa">
      <tr><td><svg viewBox="0 0 60 16"><rect width="60" height="16" rx="2" fill="#7f9a5c"/><line x1="2" y1="8" x2="58" y2="8" stroke="#6b5136" stroke-width="7" stroke-dasharray="1.5 2.2"/><line x1="2" y1="8" x2="58" y2="8" stroke="#c9ccd0" stroke-width="3.6"/><line x1="2" y1="8" x2="58" y2="8" stroke="#6e5841" stroke-width="1.8"/></svg></td><td>Ferrovia all'aperto: rotaie e traversine</td></tr>
      <tr><td><svg viewBox="0 0 60 16"><rect width="60" height="16" rx="2" fill="#7f9a5c"/><line x1="14" y1="8" x2="46" y2="8" stroke="rgba(45,32,22,0.6)" stroke-width="2.5" stroke-dasharray="4 3"/><circle cx="8" cy="8" r="6" fill="#7a7266"/><circle cx="8" cy="8" r="4" fill="#16120e"/><circle cx="52" cy="8" r="6" fill="#7a7266"/><circle cx="52" cy="8" r="4" fill="#16120e"/></svg></td><td>🚇 Galleria: tratteggio sotto il terreno, con un imbocco di pietra a ogni estremità (il bosco sopra resta)</td></tr>
      <tr><td><svg viewBox="0 0 60 16"><rect width="60" height="16" rx="2" fill="#7f9a5c"/><line x1="2" y1="8" x2="58" y2="8" stroke="#463e35" stroke-width="13"/><line x1="2" y1="8" x2="58" y2="8" stroke="#b9ab94" stroke-width="10"/><line x1="2" y1="8" x2="58" y2="8" stroke="#c9ccd0" stroke-width="3.6"/><line x1="2" y1="8" x2="58" y2="8" stroke="#6e5841" stroke-width="1.8"/></svg></td><td>🌉 Viadotto: impalcato di pietra chiara con i parapetti scuri e i piloni</td></tr>
      <tr><td><svg viewBox="0 0 60 16"><rect width="60" height="16" rx="2" fill="#7f9a5c"/><rect x="16" y="1" width="28" height="14" fill="#7d6b55"/><line x1="2" y1="8" x2="58" y2="8" stroke="#c9ccd0" stroke-width="3.6"/><line x1="2" y1="8" x2="58" y2="8" stroke="#6e5841" stroke-width="1.8"/></svg></td><td>Ponte su un fiume: riquadro marrone sotto la linea</td></tr>
      <tr><td><svg viewBox="0 0 60 16"><rect width="60" height="16" rx="2" fill="#7f9a5c"/><line x1="2" y1="8" x2="58" y2="8" stroke="rgba(255,235,59,0.85)" stroke-width="2" stroke-dasharray="5 4"/></svg></td><td>Percorso del mezzo selezionato (tratteggio giallo lungo binari, strade o mare)</td></tr>
      </table>
      <h4>⚓ Porti e navi</h4>
      <p>Il <b>porto</b> (tasto P) va su una casella di terra che tocca il mare o un lago. Le navi non hanno bisogno di reti:
      navigano sull'acqua e girano da sole attorno a coste e isole, quindi due porti bastano per una linea. I <b>traghetti</b>
      portano passeggeri e posta, le <b>navi da carico</b> tutte le altre merci. Sono lente ma molto capienti, e si pagano come
      gli altri mezzi: in base alla distanza in linea d'aria fra i due porti. Due porti su acque diverse (un lago e il mare) non si collegano.</p>
      <p><b>Treni e navi insieme</b>: se un binario passa sopra il porto, anche i treni ci si fermano. La merce che il treno porta al porto e che lì non serve resta in porto e la carica la nave (e al contrario, dalla nave al treno): per esempio il carbone va in treno dalla miniera al porto e poi in nave fino all'acciaieria. Ogni mezzo è pagato per il suo pezzo di viaggio. Con la casella <b>⇄ trasbordo</b> di una fermata il mezzo lascia lì tutto il carico anche quando la merce sarebbe accettata (per esempio i passeggeri che proseguono in traghetto). Il porto si può costruire anche sulle vie del paese, sulla costa.</p>
      <h4>Le catene delle merci</h4>
      <p>⛏️ Carbone + ⛰️ Ferro → 🏭 Acciaieria → Acciaio · Acciaio + 🌲 Legname → 🏗️ Fabbrica → Merci → città<br>
      🌾 Grano → 🍝 Pastificio → Cibo → città · 🛢️ Petrolio → ⚗️ Raffineria → Carburante → città · ⚡ La centrale compra il carbone.</p>
      <p>Miniere e pozzi hanno una <b>riserva</b>: prima o poi si esauriscono e ne vengono scoperti di nuovi.
      Le <b>città crescono</b> se le servi bene; le case nuove nascono lungo le strade e attorno alle stazioni.</p>
      <p class="sotto">Quanto costa costruire: scheda «Costi». Ricavi, costi e profitto: scheda «Soldi e profitti».</p>`;
  }

  // versione e build (da js/versione.js, generato da "npm run versione")
  G.testoVersione = function (lungo) {
    const V = window.VERSIONE;
    if (!V) return _('versione di sviluppo');
    const base = _`v${V.versione} · build ${V.build} (${V.commit}${V.modifiche ? _(', con modifiche') : ''})`;
    return lungo ? `${base} · ${V.data}` : base;
  };

  // impostazioni: per ora la lingua (italiano o inglese), con la bandiera
  function finestraImpostazioni() {
    let h = _('<h4>Lingua</h4><div class="lingue">');
    for (const k in G.LINGUE) {
      const l = G.LINGUE[k];
      h += `<button data-az="lingua" data-l="${k}" class="lingua${G.lingua === k ? ' attivo' : ''}">${l.bandiera}<span>${l.nome}</span></button>`;
    }
    h += _('</div><p class="sotto">Cambiando lingua la pagina si ricarica e la partita in corso riprende da dove era.</p>');
    apriFinestra(_('⚙️ Impostazioni'), h);
  }

  function finestraInfo() {
    apriFinestra(_('Informazioni'), _`
      <div class="info-testa"><span class="info-logo">🚂</span><div><div class="info-titolo">Rotaie &amp; Rotte</div>
      <div class="sotto">Gioco di strategia dei trasporti nel browser</div></div></div>
      <table class="elenco">
        <tr><td>Autore</td><td><b>Massimiliano Petra</b></td></tr>
        <tr><td>Versione</td><td><b>${window.VERSIONE ? window.VERSIONE.versione : _('sviluppo')}</b></td></tr>
        <tr><td>Build</td><td>${window.VERSIONE ? `${window.VERSIONE.build} · commit ${window.VERSIONE.commit}${window.VERSIONE.modifiche ? _(' (con modifiche)') : ''} · ${window.VERSIONE.data}` : '—'}</td></tr>
        <tr><td>Licenza</td><td>GPL-3.0 o successiva: software libero</td></tr>
        <tr><td>Codice</td><td><a href="https://github.com/massimilianopetra/rotteerotaie" target="_blank" rel="noopener">github.com/massimilianopetra/rotteerotaie</a></td></tr>
        <tr><td>Sito</td><td><a href="https://massimilianopetra.github.io/rotteerotaie/" target="_blank" rel="noopener">massimilianopetra.github.io/rotteerotaie</a></td></tr>
      </table>
      <p>Costruisci ferrovie, strade, autostrade e aeroporti, compra i mezzi e porta passeggeri e merci fra città
      inventate o vere (Italia ed Europa) che crescono grazie a te, dall'Ottocento ai giorni nostri.</p>` +
      (st() ? '' : _('<div class="pulsanti"><button data-az="menuIniziale">← Torna al menu</button></div>')));
  }

  // elenco delle partite salvate nel browser, con i pulsanti per aprirle o eliminarle
  function elencoPartite() {
    const el = G.elencoSalvataggi ? G.elencoSalvataggi() : [];
    if (!el.length) return _('<div class="nota">Nessuna partita salvata nel browser.</div>');
    const quando = t => new Date(t).toLocaleString(G.locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    return _`<table class="elenco partite"><tr><th>Compagnia</th><th>Data nel gioco</th><th>Salvata il</th><th></th></tr>` +
      el.map(v => _`<tr${st() && st().posto === v.id ? _(' class="attuale" title="La partita in corso"') : ''}>
        <td><b>${esc(v.nome)}</b>${v.mappa ? `<div class="sotto">${esc(v.mappa)}</div>` : ''}</td>
        <td>${esc(v.data || '—')}${v.soldi !== undefined ? `<div class="sotto">${G.lire(v.soldi)}</div>` : ''}</td>
        <td class="sotto">${quando(v.quando)}</td>
        <td class="azioni"><button data-az="carica" data-id="${v.id}">📂 Apri</button>
        <button data-az="eliminaPartita" data-id="${v.id}" title="Elimina questa partita salvata">🗑</button></td></tr>`).join('') +
      '</table>';
  }

  function finestraMenu(avvio) {
    const seme = Math.floor(Math.random() * 1e6);
    let h = avvio ? _('<p class="intro">Costruisci un impero dei trasporti: ferrovie, strade, autostrade e aeroporti fra città inventate, oppure sulla mappa vera dell\'Italia o dell\'Europa.</p>') : '';
    const mappe = (C.mappeReali || []).map(k => _`<option value="${k.id}">${k.nome} (mappa reale)</option>`).join('');
    h += _`<label>Nome della compagnia<input id="npNome" value="Ferrovie Riunite" maxlength="40"></label>
      <label>Mondo<select id="npMappa" data-az="sceltaMappa"><option value="">Inventato (dal seme)</option>${mappe}</select></label>
      <div class="nota" id="npDescr"></div>
      <div class="riga"><label>Anno di inizio<select id="npAnno"><option>1850</option><option>1880</option><option>1920</option><option>1950</option><option>1980</option></select></label>
      <label>Mappa<select id="npDim"><option value="128x96">piccola</option><option value="192x144" selected>media</option><option value="256x192">grande</option></select></label></div>
      <div class="riga"><label>Città<select id="npCitta"><option>8</option><option selected>14</option><option>20</option><option>28</option></select></label>
      <label>Seme del mondo<input id="npSeme" type="number" value="${seme}"></label></div>
      <div class="pulsanti"><button class="primario" data-az="iniziaPartita">🚂 Nuova partita</button>
      ${!avvio ? _('<button data-az="chiudiFinestra">Annulla</button>') : ''}</div>
      <div class="nota">Con lo stesso seme si ottiene lo stesso mondo.</div>
      <h3>Partite salvate</h3>
      ${elencoPartite()}
      <div class="pulsanti">
      ${!avvio ? _`<button class="primario" data-az="salva">💾 Salva</button><button data-az="salvaNuova" title="Tiene anche il salvataggio di prima">💾 Salva come nuova</button>
        <button data-az="salvaFile">⬇ Salva su file</button>` : ''}
      <button data-az="apriFile">📁 Apri da file…</button></div>
      <div class="nota">Le partite si salvano nella memoria del browser (anche da sole ogni 1° gennaio), non in una cartella:
      per averne una copia o portarla su un altro computer usa «Salva su file» (finisce nei Download) e poi «Apri da file».</div>
      <div class="versione">Rotaie &amp; Rotte ${G.testoVersione()} · di Massimiliano Petra · <span class="link" data-az="finestra" data-f="info">ℹ️ Informazioni</span></div>`;
    apriFinestra(avvio ? _('Rotaie & Rotte') : _('Partita'), h);
  }
  ui.finestraMenu = finestraMenu;

  // ---------------------------------------------------------------- azioni dei pulsanti
  const AZIONI = {
    strumento: d => {
      if (d.id !== 'stazione' && !MENU_GALLERIA[d.id]) { scegliStrumento(d.id); return; }
      // i pulsanti della stazione e della ferrovia aprono (o chiudono) il loro menu
      const aperto = menuStazioniAperto() && ui.strumento === d.id;
      scegliStrumento(d.id);
      if (aperto) chiudiMenuStazioni(); else if (d.id === 'stazione') apriMenuStazioni(); else apriMenuBinario(d.id);
    },
    modoBinario: d => {
      ui.modoRete[d.r] = d.m;
      aggiornaPulsanteBinario();
      chiudiMenuStazioni();
      scegliStrumento(d.r);
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
    finestra: d => ({ veicoli: finestraVeicoli, mondo: finestraMondo, finanze: () => G.apriGestione(), banca: () => G.apriBanca(), aiuto: () => finestraAiuto(d.s), info: finestraInfo, impostazioni: finestraImpostazioni, menu: () => finestraMenu(false) })[d.f](),
    lingua: d => { if (d.l !== G.lingua) G.cambiaLingua(d.l); },
    schedaMondo: d => finestraMondo(d.s),
    ordinaMondo: d => {
      const o = ui.ordineMondo[d.s], col = COLONNE_MONDO[d.s].find(c => c.k === d.k);
      if (o.k === d.k) o.dir = -o.dir; else { o.k = d.k; o.dir = col.num ? -1 : 1; } // numeri dal più grande, nomi dalla A
      const cerca = $('#cercaCitta') ? $('#cercaCitta').value : '', sc = $('#finestra .corpo').scrollTop;
      finestraMondo(d.s);
      if (cerca) { $('#cercaCitta').value = cerca; $('#elencoCitta').innerHTML = righeCitta(cerca); }
      $('#finestra .corpo').scrollTop = sc;
    },
    schedaAiuto: d => finestraAiuto(d.s),
    schedaGestione: d => G.apriGestione(d.s),
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
      G.avviso(_`${v.nome} acquistato! Ora clicca sulle stazioni del percorso.`);
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
    trasbordoFermata: (d, el) => {
      const v = veicoloSel(); if (!v || !v.fermate[+d.k]) return;
      if (el.checked) v.fermate[+d.k].trasbordo = true; else delete v.fermate[+d.k].trasbordo;
      disegnaPannello();
    },
    modoPercorso: (d, el) => {
      const v = veicoloSel(); if (!v) return;
      G.impostaAndataRitorno(st(), v, el.value === 'ar');
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
      G.avviso(e || _`${v.nome} torna indietro`, !!e);
      disegnaPannello();
    },
    suFermata: d => { const v = veicoloSel(), k = +d.k; if (v && k > 0) { const t = v.fermate[k]; v.fermate[k] = v.fermate[k - 1]; v.fermate[k - 1] = t; disegnaPannello(); } },
    togliFermata: d => { const v = veicoloSel(); if (v) { G.togliFermata(st(), v, +d.k); disegnaPannello(); } },
    segui: () => { ui.segui = !ui.segui; disegnaPannello(); },
    fermaVeicolo: () => { const v = veicoloSel(); if (v) { v.fermoManuale = !v.fermoManuale; disegnaPannello(); } },
    progettoProssimo: d => G.progetto.prossimo(st(), d.t),
    progettoTipo: d => G.progetto.cambiaTipo(st(), +d.k),
    progettoTogli: () => G.progetto.togliUltimo(st()),
    progettoAnnulla: () => G.progetto.annulla(),
    progettoRiduci: () => G.progetto.riduci(st()),
    progettoCostruisci: () => { const e = G.progetto.costruisci(st()); if (e) G.avviso(e, true); },
    vagoni: d => { const e = G.chiediVagoni(st(), veicoloSel(), +d.d); if (e) G.avviso(e, true); disegnaPannello(); },
    vendiVagone: d => { const e = G.vendiVagoneDeposito(st(), d.fam); G.avviso(e || _('Vagone venduto'), !!e); finestraVeicoli(); },
    vendiLoco: () => {
      const v = veicoloSel(); if (!v) return;
      if (!confirm(_`Vendere la locomotiva di ${v.nome} per ${G.lire(G.valoreLocomotiva(v))}? I ${v.vagoni} vagoni vanno nel deposito.`)) return;
      G.vendiVeicolo(st(), v, true); chiudiPannello(); G.avviso(_('Locomotiva venduta: i vagoni sono nel deposito'));
    },
    vendi: () => {
      const v = veicoloSel(); if (!v) return;
      if (!confirm(_`Vendere ${v.nome} per ${G.lire(G.valoreVeicolo(v))}?`)) return;
      G.vendiVeicolo(st(), v); chiudiPannello(); G.avviso(_('Mezzo venduto'));
    },
    demolisciStazione: d => {
      const s = st().stazioni[+d.id]; if (!s) return;
      if (!confirm(_`Demolire ${s.nome}? I mezzi perderanno questa fermata.`)) return;
      const e = G.demolisciStazione(st(), +d.id);
      if (e) G.avviso(e, true); else chiudiPannello();
    },
    // la banca sta in banca.js
    chiediPrestito: d => G.azioniBanca.chiediPrestito(d),
    restituisci: d => G.azioniBanca.restituisci(d),
    salva: () => { const e = G.salvaPartita(st()); G.avviso(e || _('Partita salvata'), !!e); if (!e) finestraMenu(false); },
    salvaNuova: () => { const e = G.salvaPartita(st(), true); G.avviso(e || _('Salvata come nuova partita'), !!e); if (!e) finestraMenu(false); },
    salvaFile: () => { const e = G.salvaSuFile(st()); G.avviso(e || _('File della partita creato: lo trovi nei Download'), !!e); },
    eliminaPartita: d => {
      const v = G.elencoSalvataggi().find(x => x.id === d.id); if (!v) return;
      if (!confirm(_`Eliminare la partita salvata «${v.nome}» (${v.data || ''})?`)) return;
      G.eliminaSalvataggio(d.id);
      finestraMenu(!st());
    },
    // un attimo di respiro perché l'avviso si veda: le mappe reali richiedono qualche secondo
    carica: d => {
      G.avviso(_('Caricamento della partita…'));
      setTimeout(() => G.caricaPartita(d.id, partitaCaricata), 30);
    },
    apriFile: () => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.rotaie,.txt';
      inp.onchange = () => {
        if (!inp.files.length) return;
        G.avviso(_('Caricamento della partita…'));
        setTimeout(() => G.caricaDaFile(inp.files[0], partitaCaricata), 30);
      };
      inp.click();
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
      const opz = { nome: $('#npNome').value.trim() || _('Ferrovie Riunite'), anno: +$('#npAnno').value, W, H, numCitta: +$('#npCitta').value, seme, mappa };
      if (mappa) { G.avviso(_('Preparo la mappa: qualche secondo…')); el.disabled = true; }
      setTimeout(() => G.nuovaPartita(opz, e => {
        el.disabled = false;
        if (e) { G.avviso(e, true); return; }
        $('#finestra').classList.add('nascosto'); ui.finestra = null;
        if (mappa) G.avviso(_('Buon viaggio!'));
      }), 30);
    },
    menuIniziale: () => finestraMenu(true),
    chiudiNotizia: (d, el) => { el.closest('.notizia').remove(); aggiornaChiudiTutte(); },
    chiudiTutte: () => { $('#notizie').innerHTML = ''; },
    griglia: () => impostaLivello('griglia', !ui.livelli.griglia),
    menuMappa: () => { if (menuMappaAperto()) chiudiMenuMappa(); else apriMenuMappa(); },
    livello: (d, el) => impostaLivello(d.k, el.checked),
    vista: d => {
      const v = VISTE.find(x => x.id === d.v);
      for (const l of LIVELLI) if (l.k !== 'griglia') ui.livelli[l.k] = !!v.l[l.k];
      salvaLivelli();
    },
    // vista 2D dall'alto o 3D assonometrica (tasto D); in 3D si gira di 90° (tasto O, Maiusc+O al contrario)
    vista3d: d => {
      const si = G.vista3d(d && d.si !== undefined ? d.si === '1' : undefined);
      G.avviso(si ? _('🧊 Vista 3D: O per girarla, D per tornare alla vista dall’alto') : _('🗺️ Vista dall’alto (2D)'));
      aggiornaPulsanteVista();
    },
    rilievo: d => {
      G.impostaRilievo(+d.n);
      if (!G.disegno.iso) G.vista3d(true);
      aggiornaPulsanteVista();
    },
    ruota: d => {
      if (!G.disegno.iso) G.vista3d(true);
      G.ruotaVista(+d.dir || 1);
      G.avviso(_('🧭 Vista girata: guardi verso ') + [_('nord-ovest'), _('sud-ovest'), _('sud-est'), _('nord-est')][G.disegno.rot]);
      aggiornaPulsanteVista();
    }
  };
  function aggiornaPulsanteVista() {
    const b = $('#pulsante3d');
    if (b) b.classList.toggle('attivo', !!G.disegno.iso);
    if (menuMappaAperto()) disegnaMenuMappa();
  }
  function partitaCaricata(e) {
    if (e) { G.avviso(e, true); return; }
    $('#finestra').classList.add('nascosto'); ui.finestra = null; G.avviso(_('Partita caricata'));
  }
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
    const galleria = inGalleria(rete);
    const tr = galleria ? G.cercaGalleria(s0, ui.trascina.da, c.i, rete) : G.cercaTracciato(s0, ui.trascina.da, c.i, rete);
    if (tr && tr.impossibile) {
      // la linea si vede in rosso con le caselle che non vanno; al rilascio non si costruisce
      ui.anteprima = { caselle: tr.caselle, ok: false, blocchi: tr.blocchi, motivo: tr.impossibile };
      suggerisci(`<span class="rosso">${galleria ? _('🚇 Galleria impossibile') : _('Impossibile passare di qui')}</span><br>${esc(tr.impossibile)}`, e);
      return;
    }
    if (galleria) {
      const ok = tr.costo <= s0.soldi, km = G.kmCasella(s0), Hm = G.metriTerreno(s0.mondo);
      const p = tr.profilo, sopra = Math.max(...tr.caselle.slice(1, -1).map((i, k) => Hm[i] - p.quote[k + 1]));
      const pend = Math.round(p.pendenza), quote = pend ? _`da ${G.numero(Math.round(tr.quota))} m a ${G.numero(Math.round(p.quotaUscita))} m · pendenza ${pend}‰ <span class="sotto">(limite ${C.opere.pendenzaMax[rete]}‰)</span>` : _`in piano a ${G.numero(Math.round(tr.quota))} m`;
      ui.anteprima = { caselle: tr.caselle, costo: tr.costo, ok, tr };
      const sotto = p.opere.filter(o => o === G.OPERA.GALLERIA).length, aperte = tr.caselle.length - 2 - sotto;
      suggerisci(_`🚇 Galleria: <b class="${ok ? '' : 'rosso'}">${G.lire(tr.costo)}</b> · ${sotto} caselle sottoterra` +
        `${km === 1 ? '' : ` (${G.numero(Math.round(sotto * km))} km)`}` + (aperte > 0 ? _` · ${aperte} all'aperto (trincea, rilevato o viadotto)` : '') +
        _`<br>${quote} · fino a ${G.numero(Math.round(sopra))} m di monte sopra`, e);
      return;
    }
    if (!tr) {
      // niente linea dritta (coprirebbe l'ostacolo): si segnano in rosso le caselle che bloccano e si dice perché
      const mt = G.motivoTracciato(s0, ui.trascina.da, c.i, rete);
      ui.anteprima = { caselle: null, ok: false, blocchi: mt.blocchi, motivo: mt.testo };
      suggerisci(_`<span class="rosso">Impossibile passare di qui</span><br>${esc(mt.testo)}`, e);
      return;
    }
    const ok = tr.costo <= s0.soldi;
    ui.anteprima = { caselle: tr.caselle, costo: tr.costo, ok, tr };
    const km = G.kmCasella(s0), lun = km === 1 ? '' : ` (${G.numero(Math.round((tr.caselle.length - 1) * km))} km)`;
    // le opere e la pendenza più forte del tracciato
    const p = tr.profilo, opere = [];
    if (p) {
      const kmTesto = x => (km === 1 ? '' : ` (${G.numero(x)} km)`);
      if (p.gallerie) opere.push(`🚇 ${p.gallerie} ${p.gallerie === 1 ? _('galleria') : _('gallerie')}${kmTesto(p.kmGallerie)}`);
      if (p.viadotti) opere.push(`🌉 ${p.viadotti} ${p.viadotti === 1 ? _('viadotto') : _('viadotti')}${kmTesto(p.kmViadotti)}`);
      const max = C.opere.pendenzaMax[rete], pend = Math.round(p.pendenza);
      opere.push(_`pendenza massima <b class="${pend > max ? 'rosso' : ''}">${pend}‰</b> <span class="sotto">(limite ${max}‰)</span>`);
    }
    suggerisci(_`${C.reti[rete].nome}: <b class="${ok ? '' : 'rosso'}">${G.lire(tr.costo)}</b> · ${tr.caselle.length} caselle${lun}` +
      (opere.length ? '<br>' + opere.join(' · ') : ''), e);
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
    h += _`<br>Accetta: ${elencoMerci(b.accetta)}<br>Fornisce: ${elencoMerci(b.fornisce)}`;
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
        G.avviso(e || _`Fermata aggiunta: ${s0.stazioni[m.rif[c.i]].nome}`, !!e);
        disegnaPannello();
      } else G.avviso(_('Clicca su una stazione per aggiungerla al percorso (Esc per finire)'), true);
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
      if (!confirm(_`Demolire ${s.nome}?`)) { ui.trascina = null; return; }
    }
    const e = G.demolisci(s0, c.i);
    if (e && e !== _('Niente da demolire')) G.avviso(e, true);
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
        if (G.anno(s0) < C.reti[ui.strumento].anno) { G.avviso(_`${C.reti[ui.strumento].nome}: disponibile dal ${C.reti[ui.strumento].anno}`, true); return; }
        if (inProgetto(ui.strumento)) { G.progetto.clic(s0, c.i, ui.strumento); suggerisci('', e); return; }
        ui.trascina = { da: c.i };
        aggiornaAnteprima(c, e);
      } else if (STAZIONI.includes(ui.strumento)) {
        const p = anteprimaStazione(c, e);
        chiudiMenuStazioni();
        const r = G.costruisciStazione(s0, ui.strumento, p.x, p.y, ui.strumento === 'stazione' ? ui.tagliaStazione : undefined);
        if (typeof r === 'string') G.avviso(r, true);
        else { G.avviso(_`Costruita: ${r.nome}`); ui.apriPannello('stazione', r.id); }
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
        if (ui.pan.mosso) { const d = G.deltaMondo(dx, dy); D.cam.x = ui.pan.cx - d.x; D.cam.y = ui.pan.cy - d.y; ui.segui = false; limitaCamera(); }
        return;
      }
      if (ui.trascina && ui.trascina.demolisci) { demolisciQui(c); return; }
      if (ui.trascina) {
        if (c.i !== ui.trascina.ultima) { ui.trascina.ultima = c.i; aggiornaAnteprima(c, e); }
        else suggerisci($('#suggerimento').innerHTML, e);
        return;
      }
      if (STAZIONI.includes(ui.strumento)) anteprimaStazione(c, e);
      else if (inProgetto(ui.strumento)) {
        G.progetto.muovi(st(), c.i);
        const n = G.progetto.attivo() && G.progetto.rete() === ui.strumento ? G.progetto.dati().punti.length : 0;
        suggerisci(c.i >= 0 ? (n ? _`📐 Clic: punto ${n + 1} del progetto` : _('📐 Clic: primo punto del progetto')) : '', e);
      } else if (inGalleria(ui.strumento) && c.i >= 0) {
        const r0 = ui.strumento, m0 = st().mondo, mc = G.motivoCasella(st(), c.i, r0);
        const q = (r0 === 'binario' ? m0.mBin : m0.mStr)[c.i] ? G.quotaRete(st(), c.i, r0) : G.metriTerreno(m0)[c.i];
        suggerisci(_`🚇 Galleria · imbocco a ${G.numero(Math.round(q))} m${mc ? `: <span class="rosso">${esc(mc)}</span>` : ''}<br><span class="sotto">Tieni premuto e trascina fino all'uscita, dall'altra parte del monte</span>`, e);
      } else if (RETI.includes(ui.strumento) && c.i >= 0) {
        const t = G.NOMI_TERRENO[st().mondo.tipo[c.i]], mc = G.motivoCasella(st(), c.i, ui.strumento);
        const costo = G.costoCasella(st(), c.i, ui.strumento);
        suggerisci(_`${C.reti[ui.strumento].nome} · ${G.tr(t)}, ${G.numero(G.metriTerreno(st().mondo)[c.i])} m: ${mc ? `<span class="rosso">${esc(mc)}</span>` : costo === 0 ? _('già costruita, gratis') : G.lire(costo) + _(' a casella')}<br><span class="sotto">Tieni premuto e trascina</span>`, e);
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
        if (e2) G.avviso(e2, true); else G.avviso(_`Costruito: ${G.lire(ui.anteprima.tr.costo)}`);
      } else if (ui.trascina && ui.anteprima && ui.anteprima.motivo) G.avviso(ui.anteprima.motivo, true);
      ui.trascina = null; ui.anteprima = null;
      suggerisci('', e);
    });
    cv.addEventListener('pointerleave', () => { ui.cursore = -1; G.progetto.esci(st()); if (!ui.trascina) { ui.bacino = null; $('#suggerimento').style.display = 'none'; } });
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
        else if (menuMappaAperto()) chiudiMenuMappa();
        else if (ui.trascina) { ui.trascina = null; ui.anteprima = null; }
        else if (ui.finestra) chiudiFinestra();
        else if (ui.percorso) { ui.percorso = false; disegnaPannello(); }
        else if (G.progetto.attivo()) G.progetto.annulla();
        else if (ui.strumento !== 'info') scegliStrumento('info');
        else chiudiPannello();
        return;
      }
      if (ui.finestra) return;
      if (G.progetto.attivo() && (k === 'Backspace' || k === 'Delete')) { G.progetto.togliUltimo(st()); e.preventDefault(); return; }
      if (G.progetto.attivo() && k === 'Enter') { const r = G.progetto.costruisci(st()); if (r) G.avviso(r, true); e.preventDefault(); return; }
      if (k === ' ') { impostaVelocita(ui.velocita ? 0 : ui.ultimaVel); e.preventDefault(); return; }
      if (k === '1' || k === '2' || k === '3' || k === '4') { impostaVelocita(+k); return; }
      if (k === '+') { zoom(1.25); return; }
      if (k === '-') { zoom(0.8); return; }
      const t = STRUMENTI.find(s => s.tasto.toLowerCase() === k.toLowerCase());
      if (t) { AZIONI.strumento({ id: t.id }); return; }
      const f = { v: 'veicoli', m: 'mondo', e: 'finanze', k: 'banca', h: 'aiuto' }[k.toLowerCase()];
      if (f) { AZIONI.finestra({ f }); return; }
      if (k.toLowerCase() === 'g') impostaLivello('griglia', !ui.livelli.griglia);
      if (k.toLowerCase() === 'c') impostaLivello('vie', !ui.livelli.vie);
      if (k.toLowerCase() === 'l') AZIONI.menuMappa();
      if (k.toLowerCase() === 'd') AZIONI.vista3d();
      if (k.toLowerCase() === 'o') AZIONI.ruota({ dir: e.shiftKey ? -1 : 1 });
    });
    window.addEventListener('keyup', e => ui.tasti.delete(e.key));
    window.addEventListener('blur', () => ui.tasti.clear());
  }

  // ---------------------------------------------------------------- avvio
  // ---------------------------------------------------------------- livelli della mappa
  // Cosa si disegna: ogni livello si accende e si spegne dal menu «🗺️ Mappa» (tasto L) e ci sono viste già pronte.
  // Sulle mappe reali case e vie dei paesi rendono la mappa fittissima: spegnerle fa risaltare la rete.
  // La scelta si ricorda nel browser.
  const LIVELLI = [
    { k: 'case', icona: '🏠', nome: _('Case') },
    { k: 'vie', icona: '🏘️', nome: _('Vie dei paesi'), tasto: 'C' },
    { k: 'strade', icona: '🛣️', nome: _('Strade e autostrade') },
    { k: 'ferrovie', icona: '🛤️', nome: _('Ferrovie') },
    { k: 'stazioni', icona: '🚉', nome: _('Stazioni e aeroporti') },
    { k: 'industrie', icona: '🏭', nome: _('Industrie') },
    { k: 'mezzi', icona: '🚂', nome: _('Treni, autobus, camion e aerei') },
    { k: 'nomi', icona: '🔤', nome: _('Nomi delle città') },
    { k: 'griglia', icona: '#️⃣', nome: _('Griglia delle caselle'), tasto: 'G', si: true },
    { k: 'attenua', icona: '🌫️', nome: _('Terreno attenuato (la rete risalta)'), si: true }
  ];
  const TUTTO = { case: true, vie: true, strade: true, ferrovie: true, stazioni: true, industrie: true, mezzi: true, nomi: true, griglia: false, attenua: false };
  const VISTE = [
    { id: 'tutto', nome: _('Tutto'), icona: '🌍', l: TUTTO },
    { id: 'ferrovia', nome: _('Solo ferrovia'), icona: '🛤️', l: { ferrovie: true, stazioni: true, mezzi: true, nomi: true, attenua: true } },
    { id: 'reti', nome: _('Reti e stazioni'), icona: '🚉', l: { strade: true, ferrovie: true, stazioni: true, mezzi: true, nomi: true } },
    { id: 'merci', nome: _('Industrie e merci'), icona: '🏭', l: { strade: true, ferrovie: true, stazioni: true, industrie: true, mezzi: true, nomi: true, attenua: true } }
  ];
  const CHIAVE_LIVELLI = 'rotaie-e-rotte-livelli';
  ui.livelli = Object.assign({}, TUTTO);

  // la vista pronta che corrisponde ai livelli accesi (la griglia non conta), null se è una scelta personale
  function vistaAttuale() {
    const v = VISTE.find(v => LIVELLI.every(l => l.k === 'griglia' || !!v.l[l.k] === !!ui.livelli[l.k]));
    return v ? v.id : null;
  }
  function salvaLivelli() {
    try { localStorage.setItem(CHIAVE_LIVELLI, JSON.stringify(ui.livelli)); } catch (e) { /* vale solo per ora */ }
    G.disegno.abitatoSporco = true; // l'immagine dell'abitato si rifà con o senza case e vie
    const b = $('#pulsanteMappa');
    if (b) b.classList.toggle('filtro', vistaAttuale() !== 'tutto'); // si vede che qualcosa è nascosto
    if (menuMappaAperto()) disegnaMenuMappa();
  }
  function impostaLivello(k, acceso) {
    ui.livelli[k] = acceso;
    salvaLivelli();
    const l = LIVELLI.find(x => x.k === k);
    if (!menuMappaAperto()) G.avviso(l.icona + ' ' + l.nome + ': ' + (l.si ? (acceso ? _('sì') : _('no')) : (acceso ? _('visibili') : _('nascoste'))));
  }
  const menuMappaAperto = () => !$('#menuMappa').classList.contains('nascosto');
  function disegnaMenuMappa() {
    const att = vistaAttuale();
    const iso = G.disegno.iso;
    let h = _('<div class="titolo">Vista</div><div class="viste">') +
      _`<button data-az="vista3d" data-si="0" class="${iso ? '' : 'attivo'}"><span class="ic">🗺️</span>Dall'alto (2D)</button>` +
      _`<button data-az="vista3d" data-si="1" class="${iso ? 'attivo' : ''}"><span class="ic">🧊</span>3D assonometrica</button>` +
      _('<button data-az="ruota" data-dir="-1" title="Gira a sinistra (Maiusc+O)"><span class="ic">⟲</span>Gira</button>') +
      _('<button data-az="ruota" data-dir="1" title="Gira a destra (O)"><span class="ic">⟳</span>Gira</button></div>') +
      _('<div class="titolo">Montagne nella vista 3D</div><div class="viste">') +
      G.RILIEVI.map((r, n) => `<button data-az="rilievo" data-n="${n}" class="${G.disegno.rilievo === n ? 'attivo' : ''}"><span class="ic">⛰️</span>${r.nome}</button>`).join('') + '</div>';
    h += _('<div class="titolo">Viste pronte</div><div class="viste">');
    for (const v of VISTE) h += `<button data-az="vista" data-v="${v.id}" class="${att === v.id ? 'attivo' : ''}"><span class="ic">${v.icona}</span>${v.nome}</button>`;
    h += _('</div><div class="titolo">Cosa mostrare</div>');
    for (const l of LIVELLI) {
      h += `<label class="livello"><input type="checkbox" data-az="livello" data-k="${l.k}" ${ui.livelli[l.k] ? 'checked' : ''}>` +
        `<span class="ic">${l.icona}</span><span class="nome">${l.nome}</span>${l.tasto ? '<kbd>' + l.tasto + '</kbd>' : ''}</label>`;
    }
    h += _('<div class="nota">Con un attrezzo in mano si vede sempre quello che serve (i binari con la ferrovia, le strade con la strada…). Il tasto <kbd>L</kbd> apre e chiude questo menu, <kbd>D</kbd> passa dalla vista dall’alto a quella 3D, <kbd>O</kbd> la gira.</div>');
    $('#menuMappa').innerHTML = h;
  }
  function apriMenuMappa() {
    if (menuStazioniAperto()) chiudiMenuStazioni();
    disegnaMenuMappa();
    const m = $('#menuMappa'), r = $('#pulsanteMappa').getBoundingClientRect();
    m.classList.remove('nascosto');
    m.style.top = (r.bottom + 6) + 'px';
    m.style.left = Math.max(8, Math.min(window.innerWidth - m.offsetWidth - 8, r.left + r.width / 2 - m.offsetWidth / 2)) + 'px';
  }
  const chiudiMenuMappa = () => $('#menuMappa').classList.add('nascosto');
  // livelli accesi, più quelli che servono all'attrezzo in mano o al mezzo selezionato
  ui.livelliVisibili = function () {
    const L = ui.livelli, t = ui.strumento;
    return Object.assign({}, L, {
      strade: L.strade || t === 'strada' || t === 'autostrada' || t === 'deposito',
      ferrovie: L.ferrovie || t === 'binario' || t === 'stazione',
      stazioni: L.stazioni || t === 'stazione' || t === 'deposito' || t === 'aeroporto' || t === 'porto' || ui.percorso,
      mezzi: L.mezzi || !!ui.selVeicolo
    });
  };

  ui.prepara = function () {
    G.traduciPagina(document.body); // la parte fissa della pagina (index.html) nella lingua scelta
    try {
      const salvati = JSON.parse(localStorage.getItem(CHIAVE_LIVELLI) || 'null');
      if (salvati) for (const l of LIVELLI) if (typeof salvati[l.k] === 'boolean') ui.livelli[l.k] = salvati[l.k];
    } catch (e) { /* si parte con tutto visibile */ }
    salvaLivelli();
    $('#attrezzi').innerHTML = STRUMENTI.map(s => `<button data-az="strumento" data-id="${s.id}" title="${s.nome} (${s.tasto})">${s.icona}</button>`).join('');
    aggiornaPulsanteStazione();
    aggiornaPulsanteBinario();
    // il menu delle dimensioni si chiude cliccando altrove
    // (un clic sulla mappa col menu aperto lo chiude soltanto, senza costruire)
    document.addEventListener('pointerdown', e => {
      if (menuMappaAperto() && !e.target.closest('#menuMappa, #pulsanteMappa')) chiudiMenuMappa();
      if (!menuStazioniAperto() || e.target.closest('#menuStazioni, #attrezzi button[data-id="stazione"], #attrezzi button[data-id="binario"], #attrezzi button[data-id="autostrada"]')) return;
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
    console.info(_('Rotaie & Rotte ') + G.testoVersione(true) + _(' — di Massimiliano Petra'));
    scegliStrumento('info');
    impostaVelocita(1);
    aggiornaPulsanteVista();
    // aggiornamenti periodici di barra e pannello
    setInterval(() => {
      const s0 = st(); if (!s0) return;
      $('#azienda').textContent = s0.opz.nome;
      const soldi = $('#soldi');
      soldi.textContent = G.lire(s0.soldi); soldi.classList.toggle('rosso', s0.soldi < 0);
      $('#prestito').textContent = s0.prestito ? _`debito ${G.lire(s0.prestito)} · interessi ${G.lire(G.interessiMese(s0))}/mese` : '';
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
