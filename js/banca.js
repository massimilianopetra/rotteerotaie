// Banca: prestiti a tasso variabile o fisso, tasso di riferimento che cambia ogni mese, spread secondo il rischio
// della compagnia, fido; finestra «🏦 Banca» (tasto K). I numeri stanno in CATALOGO.banca.
// Stato in st.banca = { tasso, storia: [{ a, m, r, v }], prestiti: [{ id, tipo, importo, tasso, dal }], prossimoId, avvisato }.
// st.prestito resta il debito totale (lo usano valore dell'azienda, quadro di gestione e barra in alto).
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO, B = C.banca;
  const TITOLO = 'Banca';
  const tondo = x => Math.round(x * 20) / 20; // i tassi vanno a passi di 0,05 punti

  G.percento = x => x.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';

  // tasso "storico" di un anno (con i decimali per i mesi), interpolato fra i punti della curva
  G.tassoStorico = function (anno) {
    const cu = B.curva;
    if (anno <= cu[0][0]) return cu[0][1];
    for (let k = 1; k < cu.length; k++) {
      if (anno <= cu[k][0]) {
        const [a0, t0] = cu[k - 1], [a1, t1] = cu[k];
        return t0 + (t1 - t0) * (anno - a0) / (a1 - a0);
      }
    }
    return cu[cu.length - 1][1];
  };
  const annoDecimale = st => { const d = G.data(st); return d.anno + d.mese / 12; };

  // lo stato della banca, creato alla prima occasione; le partite di prima avevano un prestito unico al 5% fisso
  G.statoBanca = function (st) {
    if (st.banca) return st.banca;
    const d = G.data(st), r = tondo(G.tassoStorico(annoDecimale(st)));
    const b = st.banca = { tasso: r, storia: [], prestiti: [], prossimoId: 1, avvisato: r };
    if (st.prestito > 0) b.prestiti.push({ id: b.prossimoId++, tipo: 'fisso', importo: st.prestito, tasso: C.inizio.interesse * 100, dal: st.giornoInt });
    b.storia.push({ a: d.anno, m: d.mese, r, v: r + G.rischio(st).spread });
    return b;
  };
  G.tassoRiferimento = st => G.statoBanca(st).tasso;

  // profitto degli ultimi 12 mesi chiusi (per il rischio)
  function profitto12(st) {
    const el = (st.conti.mesi || []).slice(-12);
    if (!el.length) return 0;
    let p = 0;
    for (const m of el) p += G.bilancio(m).profitto;
    return p;
  }

  // Quanto rischia la banca a prestarti soldi: spread in punti e rating, con i motivi
  G.rischio = function (st, debitoInPiu) {
    const debito = st.prestito + (debitoInPiu || 0), valore = G.valoreAzienda(st);
    const leva = debito <= 0 ? 0 : valore <= 0 ? 1 : debito / (debito + valore);
    let spread = B.spreadBase + B.spreadDebito * leva;
    const motivi = [`base ${G.percento(B.spreadBase)}`];
    if (leva > 0) motivi.push(`debito ${Math.round(leva * 100)}% di quanto possiedi: +${G.percento(B.spreadDebito * leva)}`);
    if (st.mesiInRosso > 0) { spread += B.spreadRosso; motivi.push(`cassa in rosso: +${G.percento(B.spreadRosso)}`); }
    if ((st.conti.mesi || []).length >= 3 && profitto12(st) < 0) { spread += B.spreadPerdita; motivi.push(`in perdita nell'ultimo anno: +${G.percento(B.spreadPerdita)}`); }
    spread = tondo(spread);
    const rating = spread <= 1.75 ? 'AAA' : spread <= 2.5 ? 'A' : spread <= 3.5 ? 'B' : spread <= 5 ? 'C' : 'D';
    return { spread, rating, leva, motivi };
  };
  const GIUDIZI = { AAA: 'ottimo', A: 'buono', B: 'discreto', C: 'rischioso', D: 'molto rischioso' };

  G.tassoVariabile = (st, debitoInPiu) => tondo(G.tassoRiferimento(st) + G.rischio(st, debitoInPiu).spread);
  // il fisso guarda avanti: metà il tasso di oggi, metà la media dei prossimi anni della curva, più un premio
  G.tassoFisso = function (st, debitoInPiu) {
    const a = annoDecimale(st);
    let somma = 0;
    for (let k = 1; k <= B.anniFisso; k++) somma += G.tassoStorico(a + k);
    const atteso = 0.5 * G.tassoRiferimento(st) + 0.5 * somma / B.anniFisso;
    return tondo(Math.max(B.minimo, atteso) + B.premioFisso + G.rischio(st, debitoInPiu).spread);
  };
  const tassoDi = (st, p) => (p.tipo === 'fisso' ? p.tasso : G.tassoVariabile(st));

  G.fido = st => Math.max(B.fidoMin, Math.round(G.valoreAzienda(st) / B.passo) * B.passo);
  G.fidoDisponibile = st => Math.max(0, G.fido(st) - st.prestito);
  G.interessiMese = function (st) {
    let t = 0;
    for (const p of G.statoBanca(st).prestiti) t += p.importo * tassoDi(st, p) / 100 / 12;
    return t;
  };
  const ricalcolaDebito = st => { st.prestito = st.banca.prestiti.reduce((a, p) => a + p.importo, 0); };

  G.chiediPrestito = function (st, importo, tipo) {
    const b = G.statoBanca(st);
    importo = Math.round(importo / B.passo) * B.passo;
    if (importo <= 0) return 'Scegli quanto chiedere';
    if (importo > G.fidoDisponibile(st)) return `La banca ti presta al massimo ${G.lire(G.fidoDisponibile(st))}`;
    // il tasso tiene conto anche del debito nuovo
    if (tipo === 'fisso') b.prestiti.push({ id: b.prossimoId++, tipo, importo, tasso: G.tassoFisso(st, importo), dal: st.giornoInt });
    else {
      const v = b.prestiti.find(p => p.tipo === 'variabile');
      if (v) v.importo += importo; else b.prestiti.push({ id: b.prossimoId++, tipo: 'variabile', importo, dal: st.giornoInt });
    }
    st.soldi += importo;
    ricalcolaDebito(st);
    return null;
  };

  // restituisce una parte (o tutto) di un prestito; il fisso restituito prima paga una penale
  G.penale = (p, importo) => (p.tipo === 'fisso' ? Math.round(importo * B.penaleFisso) : 0);
  G.restituisciPrestito = function (st, id, importo) {
    const b = G.statoBanca(st), p = b.prestiti.find(x => x.id === id);
    if (!p) return 'Prestito non trovato';
    importo = Math.min(p.importo, importo || p.importo);
    const penale = G.penale(p, importo);
    if (st.soldi < importo + penale) return 'Fondi insufficienti';
    st.soldi -= importo;
    if (penale) G.spendi(st, penale, 'penali');
    p.importo -= importo;
    if (p.importo <= 0.5) b.prestiti.splice(b.prestiti.indexOf(p), 1);
    ricalcolaDebito(st);
    return null;
  };

  // ogni mese (da G.mensile): si pagano gli interessi, poi il mercato muove il tasso di riferimento
  G.bancaMensile = function (st) {
    const b = G.statoBanca(st), rnd = G.casualeLibero;
    const int = G.interessiMese(st);
    if (int > 0) G.spendi(st, int, 'interessi');
    const base = G.tassoStorico(annoDecimale(st));
    const caso = (rnd() + rnd() + rnd() - 1.5) * 2; // circa una normale fra −3 e 3
    let r = b.tasso + B.ritorno * (base - b.tasso) + caso * B.oscillazione * (1 + base / 8);
    if (rnd() < B.scossa) r += (rnd() < 0.5 ? -1 : 1) * (0.4 + rnd() * 0.6) * (1 + base / 10); // crisi o manovra improvvisa
    b.tasso = tondo(Math.max(0, r));
    const d = G.data(st);
    b.storia.push({ a: d.anno, m: d.mese, r: b.tasso, v: G.tassoVariabile(st) });
    if (b.storia.length > 600) b.storia.shift();
    // notizia quando il tasso si è mosso di almeno un punto dall'ultima volta
    if (Math.abs(b.tasso - b.avvisato) >= 1) {
      const su = b.tasso > b.avvisato;
      G.notizia(st, `🏦 La banca ${su ? 'alza' : 'abbassa'} il tasso di riferimento al ${G.percento(b.tasso)}` +
        (b.prestiti.some(p => p.tipo === 'variabile') ? `: i tuoi prestiti a tasso variabile ${su ? 'costano di più' : 'costano meno'}.` : '.'));
      b.avvisato = b.tasso;
    }
  };

  // ---------------------------------------------------------------- finestra
  function consiglio(st) {
    const b = st.banca, s = b.storia, prima = s.length > 12 ? s[s.length - 13].r : s[0].r, ora = b.tasso;
    const fisso = G.tassoFisso(st), varia = G.tassoVariabile(st);
    if (ora - prima >= 0.75) return `I tassi stanno <b>salendo</b> (${G.percento(prima)} un anno fa): un prestito a tasso fisso ti protegge dagli aumenti.`;
    if (prima - ora >= 0.75) return `I tassi stanno <b>scendendo</b> (${G.percento(prima)} un anno fa): il variabile segue il calo; se hai un fisso caro, valuta di estinguerlo.`;
    if (fisso - varia <= 0.6) return 'Oggi il fisso costa poco più del variabile: bloccare il tasso è un buon affare.';
    return `Tassi stabili: il variabile costa meno (${G.percento(varia)} contro ${G.percento(fisso)}), ma può cambiare ogni mese.`;
  }

  let ultimoImporto = B.passo * 2, ultimoTipo = 'variabile', meseVisto = -1;
  G.apriBanca = function () {
    const st = G.st;
    if (!st) return;
    const b = G.statoBanca(st), ris = G.rischio(st), varia = G.tassoVariabile(st), fisso = G.tassoFisso(st);
    const disp = G.fidoDisponibile(st), kpi = G.kpiG, s = b.storia, anno = s.length > 12 ? s[s.length - 13] : null;
    const corpo = document.querySelector('#finestra .corpo'), giaAperta = G.ui.finestra === TITOLO, sc = corpo.scrollTop;
    let h = `<p class="sotto">La banca ti presta soldi subito; tu paghi ogni mese gli <b>interessi</b> (sono un costo e abbassano il profitto)
      e restituisci il prestito quando vuoi. Il tasso cambia ogni mese con il mercato e con il tuo rischio.</p><div class="kpis">`;
    h += kpi('📉 Tasso di riferimento', G.percento(b.tasso), anno ? `un anno fa ${G.percento(anno.r)}` : 'cambia ogni mese');
    h += kpi('🔄 Variabile per te', G.percento(varia), `riferimento + spread ${G.percento(ris.spread)}`);
    h += kpi('🔒 Fisso per te', G.percento(fisso), `bloccato per sempre · penale ${Math.round(B.penaleFisso * 100)}% se restituisci`);
    h += kpi('⭐ Rating', ris.rating, `${GIUDIZI[ris.rating]} · ${ris.motivi.slice(1).join(' · ') || 'nessun debito, conti in ordine'}`, ['AAA', 'A', 'B'].includes(ris.rating) ? 'verde' : 'rosso');
    h += kpi('🏦 Debito', G.lire(st.prestito), b.prestiti.length ? `${b.prestiti.length} ${b.prestiti.length === 1 ? 'prestito' : 'prestiti'}` : 'nessun prestito');
    h += kpi('💸 Interessi al mese', G.lire(G.interessiMese(st)), st.prestito ? `${G.lire(G.interessiMese(st) * 12)} l'anno` : '—');
    h += kpi('💳 Fido disponibile', G.lire(disp), `su ${G.lireBreve(G.fido(st))}: cresce con il valore dell'azienda`);
    h += '</div>';
    h += `<div class="consiglioBanca">💡 ${consiglio(st)}</div>`;

    // nuovo prestito
    h += '<h4>Chiedi un prestito</h4>';
    if (disp < B.passo) h += '<p class="rosso">Hai usato tutto il fido: restituisci qualcosa o fai crescere il valore dell\'azienda.</p>';
    else {
      const scelte = [];
      for (const x of [50000, 100000, 200000, 300000, 500000, 1e6, 2e6, 5e6, 1e7]) if (x <= disp) scelte.push(x);
      if (!scelte.includes(Math.floor(disp / B.passo) * B.passo)) scelte.push(Math.floor(disp / B.passo) * B.passo);
      if (!scelte.includes(ultimoImporto)) ultimoImporto = scelte[Math.min(1, scelte.length - 1)];
      h += `<div class="riga"><label>Quanto<select id="bancaImporto">${scelte.map(x => `<option value="${x}" ${x === ultimoImporto ? 'selected' : ''}>${G.lire(x)}${x === scelte[scelte.length - 1] && x > 1e5 ? ' (tutto il fido)' : ''}</option>`).join('')}</select></label>
        <label>Tasso<select id="bancaTipo">
          <option value="variabile" ${ultimoTipo === 'variabile' ? 'selected' : ''}>🔄 Variabile: ${G.percento(varia)} oggi, cambia ogni mese</option>
          <option value="fisso" ${ultimoTipo === 'fisso' ? 'selected' : ''}>🔒 Fisso: ${G.percento(fisso)} per sempre</option></select></label></div>
        <div class="pulsanti"><button class="primario" data-az="chiediPrestito">🏦 Chiedi il prestito</button></div>
        <p class="sotto">Il tasso definitivo tiene conto anche del debito nuovo: più chiedi, più sale lo spread.</p>`;
    }

    // prestiti in corso
    if (b.prestiti.length) {
      h += '<h4>I tuoi prestiti</h4><table class="elenco"><tr><th>Tipo</th><th class="num">Debito</th><th class="num">Tasso</th><th class="num">Interessi al mese</th><th>Dal</th><th></th></tr>';
      for (const p of b.prestiti) {
        const t = tassoDi(st, p), parte = Math.min(p.importo, B.passo);
        h += `<tr><td>${p.tipo === 'fisso' ? '🔒 Fisso' : '🔄 Variabile'}</td><td class="num">${G.lire(p.importo)}</td><td class="num">${G.percento(t)}</td>
          <td class="num">${G.lire(p.importo * t / 100 / 12)}</td><td>${G.testoData(st, p.dal)}</td>
          <td class="azioniBanca"><button data-az="restituisci" data-id="${p.id}" data-q="${parte}" title="${G.penale(p, parte) ? `penale ${G.lire(G.penale(p, parte))}` : 'senza penale'}">↩ ${G.lireBreve(parte)}</button>
          ${p.importo > parte ? `<button data-az="restituisci" data-id="${p.id}" data-q="${p.importo}" title="${G.penale(p, p.importo) ? `penale ${G.lire(G.penale(p, p.importo))}` : 'senza penale'}">Estingui tutto</button>` : ''}</td></tr>`;
      }
      h += '</table>';
    }

    // andamento dei tassi
    const el = s.slice(-120);
    if (el.length > 1) {
      h += '<h4>Tassi mese per mese</h4>' + G.graficoLinee([
        { nome: 'Il tuo variabile', colore: '#f2b134', valori: el.map(x => x.v) },
        { nome: 'Riferimento', colore: '#5b8def', valori: el.map(x => x.r), area: true }
      ], el.map(x => G.etichettaMese({ anno: x.a, mese: x.m })), 180,
      { asse: v => v.toLocaleString('it-IT', { maximumFractionDigits: 1 }) + '%', valore: G.percento, minimo: 2 }) +
        G.legendaG([['Riferimento', '#5b8def'], ['Il tuo variabile (riferimento + spread)', '#f2b134']]);
    }
    h += `<p class="sotto"><b>Come si decidono i tassi.</b> Il riferimento segue a grandi linee la storia dei tassi italiani (circa 4–5%
      nell'Ottocento, oltre il 15% intorno al 1980, quasi zero intorno al 2015) e ogni mese si muove un po' a caso, a volte con una
      scossa improvvisa. Lo <b>spread</b> è il tuo rischio: parte da ${G.percento(B.spreadBase)} e sale con il debito rispetto a quanto
      possiedi, con la cassa in rosso e con le perdite. Il <b>fisso</b> costa un po' di più ma non cambia mai: conviene quando i tassi
      stanno per salire. Il <b>fido</b> è il massimo che puoi avere in prestito: il valore dell'azienda, almeno ${G.lire(B.fidoMin)}.</p>`;
    G.ui.apriFinestra(TITOLO, h, true);
    if (giaAperta) corpo.scrollTop = sc;
    meseVisto = s.length;
  };

  // finestra aperta: si aggiorna da sola a ogni mese
  setInterval(() => {
    const st = G.st;
    if (st && st.banca && G.ui.finestra === TITOLO && st.banca.storia.length !== meseVisto) {
      const sel = document.getElementById('bancaImporto'), tipo = document.getElementById('bancaTipo');
      if (sel) ultimoImporto = +sel.value;
      if (tipo) ultimoTipo = tipo.value;
      G.apriBanca();
    }
  }, 500);

  G.azioniBanca = {
    chiediPrestito: () => {
      const st = G.st, imp = +document.getElementById('bancaImporto').value, tipo = document.getElementById('bancaTipo').value;
      ultimoImporto = imp; ultimoTipo = tipo;
      const e = G.chiediPrestito(st, imp, tipo);
      G.avviso(e || `Prestito di ${G.lire(imp)} ottenuto`, !!e);
      G.apriBanca();
    },
    restituisci: d => {
      const st = G.st, e = G.restituisciPrestito(st, +d.id, +d.q);
      G.avviso(e || 'Prestito restituito', !!e);
      G.apriBanca();
    }
  };
})();
