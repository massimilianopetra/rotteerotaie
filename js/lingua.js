// Lingue del gioco. Il gioco è scritto in italiano e il testo italiano fa da chiave delle traduzioni:
// - _`Testo con ${x} valori` cerca «Testo con {0} valori» nel dizionario della lingua scelta e rimette i valori
//   al loro posto (la traduzione può spostarli: «{0} values in the text»). Senza traduzione resta l'italiano.
// - G.tr(testo) traduce un testo già pronto (nomi del catalogo, messaggi salvati), senza valori.
// - I dizionari stanno in dati/lingue/<lingua>.js: window.LINGUE.en = { 'testo italiano': 'English text' }.
// - La pagina fissa (index.html) si traduce da sola con G.traduciPagina: testi e attributi title.
// - `npm run lingue` (scripts/lingue.js) elenca i testi del codice senza traduzione e quelle non più usate.
// - In console: [...GIOCO.mancanti] = i testi cercati durante il gioco senza traduzione.
(function () {
  'use strict';
  const G = window.GIOCO = window.GIOCO || {};
  const CHIAVE = 'rotaie-e-rotte-lingua';
  // bandiera: disegnata in SVG perché Windows non mostra le bandiere emoji
  G.LINGUE = {
    it: { nome: 'Italiano', locale: 'it-IT',
      bandiera: '<svg viewBox="0 0 3 2" class="bandiera"><rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/></svg>' },
    en: { nome: 'English', locale: 'en-GB',
      bandiera: '<svg viewBox="0 0 60 30" class="bandiera"><clipPath id="bUK"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath>' +
        '<path d="M0,0 v30 h60 v-30 z" fill="#012169"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/>' +
        '<path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#bUK)" stroke="#C8102E" stroke-width="4"/>' +
        '<path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#C8102E" stroke-width="6"/></svg>' }
  };
  let scelta = 'it';
  try { const l = localStorage.getItem(CHIAVE); if (G.LINGUE[l]) scelta = l; } catch (e) { /* niente */ }
  G.lingua = scelta;
  G.locale = G.LINGUE[scelta].locale;
  G.mancanti = new Set();

  function cerca(k) {
    if (G.lingua === 'it') return k;
    const d = (window.LINGUE || {})[G.lingua], v = d && d[k];
    if (v === undefined) { G.mancanti.add(k); return k; }
    return v;
  }
  G.tr = k => (k === null || k === undefined || k === '' ? k : cerca(String(k)));

  // la chiave di ogni _`…` si calcola una volta sola: il motore passa sempre lo stesso array di pezzi
  const chiavi = new WeakMap();
  window._ = G.t = function (pezzi, ...valori) {
    if (typeof pezzi === 'string') return cerca(pezzi);
    let k = chiavi.get(pezzi);
    if (k === undefined) {
      k = pezzi[0];
      for (let i = 1; i < pezzi.length; i++) k += '{' + (i - 1) + '}' + pezzi[i];
      chiavi.set(pezzi, k);
    }
    const s = cerca(k);
    return valori.length ? s.replace(/\{(\d+)\}/g, (m, i) => valori[i]) : s;
  };

  // Il catalogo si traduce una volta all'avvio, sul posto: nomi di merci, industrie, mezzi, reti e stazioni.
  // (Cambiare lingua ricarica la pagina, quindi non serve tornare indietro.) Si traducono solo i campi di testo:
  // le chiavi (id, terreno, accetta…) restano in italiano.
  const CAMPI = ['nome', 'breve', 'unita', 'descrizione'];
  function traduciOggetto(o) { for (const c of CAMPI) if (typeof o[c] === 'string') o[c] = G.tr(o[c]); }
  G.traduciCatalogo = function (C) {
    if (!C || G.lingua === 'it') return;
    for (const g of ['merci', 'industrie', 'reti', 'stazioni', 'taglieStazione']) for (const k in C[g] || {}) traduciOggetto(C[g][k]);
    for (const v of C.veicoli || []) traduciOggetto(v);
    for (const v of C.mappeReali || []) traduciOggetto(v);
    if (C.nomiVelocita) C.nomiVelocita = C.nomiVelocita.map(G.tr);
    if (C.case && C.case.nomi) C.case.nomi = C.case.nomi.map(G.tr);
  };
  G.traduciCatalogo(window.CATALOGO);

  // numeri con i separatori della lingua (1.234,5 oppure 1,234.5)
  G.fmt = (n, opz) => n.toLocaleString(G.locale, opz);

  // pagina fissa: si ricordano i testi italiani originali, così si può tornare indietro da un'altra lingua
  const originali = new WeakMap();
  G.traduciPagina = function (radice) {
    const giro = document.createTreeWalker(radice || document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = giro.currentNode; n; n = giro.nextNode()) {
      if (n.nodeType === 3) {
        // gli elementi con un id (#soldi, #data…) li scrive il programma: si traducono già da soli
        if (n.parentElement && n.parentElement.id) continue;
        const s = n.nodeValue, k = s.trim();
        if (!k || !/[a-zà-ù]/i.test(k)) continue;
        if (!originali.has(n)) originali.set(n, k);
        const it = originali.get(n);
        n.nodeValue = s.replace(k, G.tr(it));
      } else if (n.nodeType === 1 && n.hasAttribute('title')) {
        if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') continue;
        if (!originali.has(n)) originali.set(n, n.getAttribute('title'));
        n.setAttribute('title', G.tr(originali.get(n)));
      }
    }
    document.documentElement.lang = G.lingua;
    document.title = G.tr('Rotaie & Rotte — strategia dei trasporti');
  };

  // cambio di lingua: si ricorda la scelta e si avvisa chi deve ridisegnare (interfaccia, finestre, mappa)
  G.cambiaLingua = function (l) {
    if (!G.LINGUE[l]) return;
    G.lingua = l; G.locale = G.LINGUE[l].locale;
    try { localStorage.setItem(CHIAVE, l); } catch (e) { /* niente */ }
    G.traduciPagina(document.querySelector('#barra'));
    if (G.dopoCambioLingua) G.dopoCambioLingua();
  };
})();
