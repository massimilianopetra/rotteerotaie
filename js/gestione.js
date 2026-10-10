// Quadro di gestione: indicatori, grafici e conti della compagnia (finestra «📊 Gestione», tasto E)
// e il riassunto sempre visibile nella barra in alto (utile dell'anno e andamento della cassa).
// I grafici sono SVG fatti a mano: nessuna libreria. I dati mese per mese stanno in st.conti.mesi (vedi G.mensile).
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO;
  const TITOLO = _('Quadro di gestione');
  const NOMI_MESI = [_('gennaio'), _('febbraio'), _('marzo'), _('aprile'), _('maggio'), _('giugno'), _('luglio'), _('agosto'), _('settembre'), _('ottobre'), _('novembre'), _('dicembre')];
  const COL = { entrate: '#5ccf7a', uscite: '#ff6b5b', invest: '#8e7cc3', utile: '#f2b134', cassa: '#f2b134', valore: '#5b8def', griglia: 'rgba(255,255,255,0.07)', zero: 'rgba(255,255,255,0.28)' };
  // voci di spesa: icona, nome, colore (prima i costi di gestione, poi gli investimenti)
  const USCITE = {
    esercizio: ['⛽', _('Esercizio mezzi'), '#e07b5f'], manBinari: ['🛤️', _('Manutenzione binari'), '#d4a24c'],
    manStrade: ['🛣️', _('Manutenzione strade'), '#b8a05a'], manStazioni: ['🚉', _('Manutenzione stazioni'), '#5fa8a0'],
    manutenzione: ['🔧', _('Manutenzione (prima della divisione)'), '#c9b27a'], interessi: ['🏦', _('Interessi'), '#b0606a'],
    penali: ['⚖️', _('Penali della banca'), '#8a4a6a'],
    costruzione: ['🏗️', _('Costruzioni e demolizioni'), '#c98b4a'], veicoli: ['🚂', _('Acquisto mezzi'), '#8e7cc3']
  };
  const nomeUscita = k => (USCITE[k] ? USCITE[k][0] + ' ' + USCITE[k][1] : esc(k));
  const coloreUscita = k => (USCITE[k] ? USCITE[k][2] : '#9fb2c4');
  const TIPI = { treno: _('🚂 Treni'), strada: _('🚌 Mezzi su strada'), aereo: _('✈️ Aerei'), nave: _('🚢 Navi') };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tot = o => G.somma(o || {});
  const segno = n => (n > 0 ? '+' : '');
  const classe = n => (n < 0 ? 'rosso' : 'verde');

  // lire in breve per assi ed etichette: L. 1,2 mln · L. 350 mila · L. 900
  G.lireBreve = function (n) {
    const a = Math.abs(n), s = n < 0 ? '−' : '';
    if (a >= 1e6) return s + 'L. ' + (a / 1e6).toLocaleString(G.locale, { maximumFractionDigits: a >= 1e7 ? 0 : 1 }) + _(' mln');
    if (a >= 1e4) return s + 'L. ' + Math.round(a / 1e3).toLocaleString(G.locale) + _(' mila');
    return s + 'L. ' + Math.round(a).toLocaleString(G.locale);
  };
  const breveAsse = n => G.lireBreve(n).replace('L. ', '');

  // mesi chiusi più quello in corso (segnato), gli ultimi n
  function mesi(st, n) {
    const cm = G.contoMese(st), d = G.data(st);
    const el = st.conti.mesi.concat([{ anno: d.anno, mese: d.mese, entrate: cm.entrate, uscite: cm.uscite, unita: cm.unita,
      soldi: st.soldi, valore: G.valoreAzienda(st), prestito: st.prestito, inCorso: true }]);
    return n ? el.slice(-n) : el;
  }
  function somme(lista, campo) {
    const r = {};
    for (const m of lista) for (const k in m[campo]) r[k] = (r[k] || 0) + m[campo][k];
    return r;
  }
  // etichetta di un mese: breve per l'asse (a gennaio anche l'anno), lunga per i suggerimenti
  const etichetta = m => ({ breve: G.MESI[m.mese] + (m.mese === 0 ? ' ' + m.anno : ''), lungo: NOMI_MESI[m.mese] + ' ' + m.anno + (m.inCorso ? _(' (in corso)') : '') });

  // passo "tondo" per le righe dell'asse: 1, 2 o 5 per una potenza di 10
  function passoAsse(r) {
    if (!(r > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(r))), x = r / p;
    return (x <= 1 ? 1 : x <= 2 ? 2 : x <= 5 ? 5 : 10) * p;
  }
  function scala(valori, H, sy, gy, minimo) {
    let min = Math.min(0, ...valori), max = Math.max(0, ...valori);
    minimo = minimo || 1000;
    if (max - min < minimo) max = min + minimo; // grafico ancora vuoto: un asse sensato
    const passo = passoAsse((max - min) / 4);
    min = Math.floor(min / passo) * passo; max = Math.ceil(max / passo) * passo;
    return { min, max, passo, Y: v => sy + (max - v) / (max - min) * (H - sy - gy) };
  }
  function assi(sc, W, sx, dx, fmtAsse) {
    let s = '';
    for (let v = sc.min; v <= sc.max + sc.passo * 1e-6; v += sc.passo) {
      const y = sc.Y(v).toFixed(1);
      s += `<line x1="${sx}" x2="${W - dx}" y1="${y}" y2="${y}" stroke="${Math.abs(v) < sc.passo * 1e-6 ? COL.zero : COL.griglia}"/>`;
      s += `<text x="${sx - 6}" y="${(+y + 4).toFixed(1)}" text-anchor="end">${(fmtAsse || breveAsse)(v)}</text>`;
    }
    return s;
  }
  function etichetteX(etich, X, H) {
    const n = etich.length, ogni = Math.ceil(n / 9);
    let s = '';
    etich.forEach((e, k) => { if ((n - 1 - k) % ogni === 0) s += `<text x="${X(k).toFixed(1)}" y="${H - 7}" text-anchor="middle">${esc(e.breve)}</text>`; });
    return s;
  }

  // grafico a linee: serie = [{ nome, colore, valori, area }]; si passa sopra col mouse per leggere i valori.
  // fmt (facoltativo) per valori che non sono lire: { asse: v => testo, valore: v => testo, minimo: ampiezza minima dell'asse }
  function graficoLinee(serie, etich, H, fmt) {
    H = H || 190; fmt = fmt || {};
    const W = 640, sx = 62, dx = 12, sy = 12, gy = 24, n = etich.length;
    const sc = scala(serie.flatMap(s => s.valori), H, sy, gy, fmt.minimo);
    const X = k => sx + (n === 1 ? (W - sx - dx) / 2 : k * (W - sx - dx) / (n - 1));
    let s = `<svg class="graficoG" viewBox="0 0 ${W} ${H}">` + assi(sc, W, sx, dx, fmt.asse) + etichetteX(etich, X, H);
    const base = sc.Y(Math.max(sc.min, 0)).toFixed(1);
    for (const se of serie) {
      const pts = se.valori.map((v, k) => `${X(k).toFixed(1)},${sc.Y(v).toFixed(1)}`).join(' ');
      if (se.area && n > 1) s += `<polygon points="${X(0).toFixed(1)},${base} ${pts} ${X(n - 1).toFixed(1)},${base}" fill="${se.colore}" opacity="0.13"/>`;
      s += `<polyline points="${pts}" fill="none" stroke="${se.colore}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
      if (n <= 36) se.valori.forEach((v, k) => { s += `<circle cx="${X(k).toFixed(1)}" cy="${sc.Y(v).toFixed(1)}" r="2.6" fill="${se.colore}"/>`; });
    }
    // fasce invisibili: il suggerimento mostra tutte le serie di quel mese
    const l = n === 1 ? W - sx - dx : (W - sx - dx) / (n - 1);
    etich.forEach((e, k) => {
      const t = e.lungo + serie.map(se => '\n' + se.nome + ': ' + (fmt.valore || G.lire)(se.valori[k])).join('');
      s += `<rect x="${(X(k) - l / 2).toFixed(1)}" y="${sy}" width="${l.toFixed(1)}" height="${H - sy - gy}" fill="transparent"><title>${esc(t)}</title></rect>`;
    });
    return s + '</svg>';
  }

  // ricavi (verdi), costi di gestione (rossi) e investimenti (viola) mese per mese, con la linea del profitto
  // (ricavi − costi: gli investimenti non lo toccano); il mese in corso è più chiaro
  function graficoBarre(lista) {
    const W = 640, H = 210, sx = 62, dx = 12, sy = 12, gy = 24, n = lista.length;
    const bl = lista.map(m => G.bilancio(m));
    const e = bl.map(b => b.ricavi), u = bl.map(b => b.costi), inv = bl.map(b => Math.max(0, b.investimenti)), ut = bl.map(b => b.profitto);
    const sc = scala(e.concat(u, inv, ut), H, sy, gy), l = (W - sx - dx) / n, b = Math.min(14, l * 0.27);
    const X = k => sx + l * (k + 0.5), etich = lista.map(etichetta);
    let s = `<svg class="graficoG" viewBox="0 0 ${W} ${H}">` + assi(sc, W, sx, dx) + etichetteX(etich, X, H);
    const zero = sc.Y(0);
    const barra = (x, v, col, op) => `<rect x="${x.toFixed(1)}" y="${sc.Y(v).toFixed(1)}" width="${b.toFixed(1)}" height="${Math.max(0, zero - sc.Y(v)).toFixed(1)}" rx="2" fill="${col}" opacity="${op}"/>`;
    lista.forEach((m, k) => {
      const op = m.inCorso ? 0.5 : 0.9;
      s += barra(X(k) - 1.5 * b - 1, e[k], COL.entrate, op) + barra(X(k) - b / 2, u[k], COL.uscite, op) + barra(X(k) + b / 2 + 1, inv[k], COL.invest, op * 0.8);
    });
    // la linea del profitto unisce solo i mesi chiusi: il mese in corso, a metà, sembrerebbe un crollo
    const chiusi = ut.map((v, k) => [k, v]).filter(([k]) => !lista[k].inCorso);
    if (chiusi.length > 1) s += `<polyline points="${chiusi.map(([k, v]) => `${X(k).toFixed(1)},${sc.Y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${COL.utile}" stroke-width="2" stroke-dasharray="4 3"/>`;
    ut.forEach((v, k) => { s += `<circle cx="${X(k).toFixed(1)}" cy="${sc.Y(v).toFixed(1)}" r="2.8" fill="${COL.utile}" opacity="${lista[k].inCorso ? 0.45 : 1}"/>`; });
    lista.forEach((m, k) => {
      const t = _`${etich[k].lungo}\nRicavi: ${G.lire(e[k])}\nCosti: ${G.lire(u[k])}\nProfitto: ${G.lire(ut[k])}\nInvestimenti: ${G.lire(bl[k].investimenti)}`;
      s += `<rect x="${(X(k) - l / 2).toFixed(1)}" y="${sy}" width="${l.toFixed(1)}" height="${H - sy - gy}" fill="transparent"><title>${esc(t)}</title></rect>`;
    });
    return s + '</svg>';
  }

  const legenda = voci => '<div class="legendaG">' + voci.map(([nome, colore, tratteggio]) =>
    `<span><i style="background:${colore}${tratteggio ? ';height:2px;border-radius:0' : ''}"></i>${nome}</span>`).join('') + '</div>';

  // barre orizzontali: righe = [{ nome, valore, colore, testo }]
  function barre(righe) {
    if (!righe.length) return _('<p class="sotto">Ancora niente.</p>');
    const max = Math.max(1, ...righe.map(r => Math.abs(r.valore))), somma = righe.reduce((a, r) => a + Math.abs(r.valore), 0) || 1;
    return '<div class="barreG">' + righe.map(r => `<div class="rigaB"><span class="nomeB">${r.nome}</span>` +
      `<span class="pistaB"><i style="width:${(Math.abs(r.valore) / max * 100).toFixed(1)}%;background:${r.colore}"></i></span>` +
      `<span class="valB">${r.testo || G.lireBreve(r.valore)}<small>${Math.round(Math.abs(r.valore) / somma * 100)}%</small></span></div>`).join('') + '</div>';
  }

  // profitto dei mezzi: barre verso destra (guadagno) o verso sinistra (perdita)
  function barreProfitto(veicoli, campo) {
    const max = Math.max(1, ...veicoli.map(v => Math.abs(v[campo])));
    return '<div class="barreG">' + veicoli.map(v => {
      const p = v[campo], w = (Math.abs(p) / max * 50).toFixed(1);
      return `<div class="rigaB link" data-az="apriVeicolo" data-id="${v.id}" title="Apri ${esc(v.nome)}"><span class="nomeB">${esc(v.nome)}<small>${esc(G.modello(v.modello).nome)}</small></span>` +
        `<span class="pistaB doppia"><i style="${p >= 0 ? 'left:50%' : 'right:50%'};width:${w}%;background:${p >= 0 ? COL.entrate : COL.uscite}"></i></span>` +
        `<span class="valB ${classe(p)}">${segno(p)}${G.lireBreve(p)}</span></div>`;
    }).join('') + '</div>';
  }

  const kpi = (titolo, valore, nota, cl) => `<div class="kpi"><div class="t">${titolo}</div><div class="v ${cl || ''}">${valore}</div><div class="n">${nota || ''}</div></div>`;
  const nomeMerce = k => C.merci[k] ? C.merci[k].icona + ' ' + C.merci[k].nome : k === 'vendite' ? _('💰 Vendita mezzi') : esc(k);

  // le parole dei conti, uguali dappertutto (anche nell'aiuto, scheda «Soldi»)
  const SPIEGAZIONE = _`<div class="spiegaConti">
    <span><b class="verde">Ricavi</b> = quanto incassi dalle consegne</span>
    <span><b class="rosso">Costi</b> = esercizio dei mezzi + manutenzione + interessi</span>
    <span><b class="giallo">Profitto</b> = ricavi − costi</span>
    <span><b class="viola">Investimenti</b> = costruzioni e acquisto di mezzi: non sono costi, diventano valore dell'azienda</span>
    <span><b>Cassa</b>: cambia di profitto − investimenti</span></div>`;
  G.SPIEGAZIONE_CONTI = SPIEGAZIONE;

  // ---------------------------------------------------------------- schede
  function riepilogo(st) {
    const co = st.conti, ultimi = mesi(st, 12), tutti = mesi(st);
    const b12 = G.bilancio({ entrate: somme(ultimi, 'entrate'), uscite: somme(ultimi, 'uscite') });
    const ric = b12.ricavi, cos = b12.costi, utile12 = b12.profitto;
    const utileAnno = G.bilancio(co.corrente).profitto;
    const scorso = co.storico.length ? co.storico[co.storico.length - 1] : null;
    const utileScorso = scorso ? G.bilancio(scorso).profitto : null;
    const unAnnoFa = tutti.length > 12 ? tutti[tutti.length - 13] : null;
    const valore = G.valoreAzienda(st), m = st.mondo, km = G.kmCasella(st);
    let bin = 0, str = 0;
    for (let i = 0; i < m.N; i++) { if (m.mBin[i]) bin++; if (m.mStr[i] && !m.strCitta[i]) str++; }
    const inPerdita = st.veicoli.filter(v => v.profittoAnno < 0).length;
    const unita = somme(ultimi, 'unita'), pass = unita.passeggeri || 0;
    const altre = Object.keys(unita).filter(k => k !== 'passeggeri' && unita[k] >= 1);
    let h = '<div class="kpis">';
    h += kpi(_('💰 Cassa'), G.lire(st.soldi), st.prestito ? _`debito ${G.lireBreve(st.prestito)}` : unAnnoFa ? _`un anno fa ${G.lireBreve(unAnnoFa.soldi)}` : _('nessun debito'), st.soldi < 0 ? 'rosso' : '');
    h += kpi(_`📈 Profitto ${co.anno}`, segno(utileAnno) + G.lire(utileAnno), utileScorso === null ? _('ricavi − costi, anno in corso') : _`nel ${scorso.anno}: ${segno(utileScorso)}${G.lireBreve(utileScorso)}`, classe(utileAnno));
    h += kpi(_('🟢 Ricavi (12 mesi)'), G.lire(ric), _`le consegne · in media ${G.lireBreve(ric / ultimi.length)} al mese`);
    h += kpi(_('🔴 Costi (12 mesi)'), G.lire(cos), _('esercizio mezzi, manutenzione, interessi'));
    h += kpi(_('📈 Profitto (12 mesi)'), segno(utile12) + G.lire(utile12), ric > 0 ? _`margine ${Math.round(utile12 / ric * 100)}% dei ricavi` : _('nessun ricavo ancora'), classe(utile12));
    h += kpi(_('🟣 Investimenti (12 mesi)'), G.lire(b12.investimenti), _('costruzioni e mezzi: restano nel valore dell\'azienda'));
    h += kpi(_('🏢 Valore dell\'azienda'), G.lire(valore), unAnnoFa && unAnnoFa.valore > 0 ? _`${segno(valore - unAnnoFa.valore)}${Math.round((valore / unAnnoFa.valore - 1) * 100)}% in un anno` : _('cassa + mezzi + rete − debito'));
    h += kpi(_('🚂 Mezzi'), G.numero(st.veicoli.length), st.veicoli.length ? (inPerdita ? _`<span class="rosso">${inPerdita} in perdita quest'anno</span>` : _('tutti in guadagno quest\'anno')) : _('compra il primo dalla stazione'), '');
    h += kpi(_('🛤️ Rete'), G.numero(bin * km) + ' km', _`di binari · ${G.numero(str * km)} km di strade · ${st.stazioni.filter(Boolean).length} stazioni`);
    h += kpi(_('👥 Passeggeri (12 mesi)'), G.numero(pass), altre.length ? altre.map(k => `${C.merci[k].icona} ${G.lireBreve(unita[k]).replace('L. ', '')}`).join(' · ') : _('nessuna merce ancora'));
    h += '</div>';

    const ultimi24 = mesi(st, 24);
    h += SPIEGAZIONE;
    h += _`<h4>Ricavi, costi e investimenti, mese per mese</h4>${graficoBarre(ultimi24)}` +
      legenda([[_('Ricavi'), COL.entrate], [_('Costi'), COL.uscite], [_('Investimenti'), COL.invest], [_('Profitto'), COL.utile, true]]);
    if (tutti.length > 1) {
      h += _`<h4>Cassa e valore dell'azienda</h4>` + graficoLinee([
        { nome: _('Valore dell\'azienda'), colore: COL.valore, valori: tutti.map(x => x.valore) },
        { nome: _('Cassa'), colore: COL.cassa, valori: tutti.map(x => x.soldi), area: true }
      ], tutti.map(etichetta)) + legenda([[_('Cassa'), COL.cassa], [_('Valore dell\'azienda'), COL.valore]]);
    }
    const ent = somme(ultimi, 'entrate'), usc = somme(ultimi, 'uscite');
    h += _('<div class="dueG"><div><h4>Da dove arrivano i soldi <small>(12 mesi)</small></h4>') + barre(Object.keys(ent).filter(k => ent[k] > 0).sort((a, b) => ent[b] - ent[a])
      .map(k => ({ nome: nomeMerce(k), valore: ent[k], colore: C.merci[k] ? C.merci[k].colore : '#9fb2c4' }))) + '</div>';
    h += _('<div><h4>Dove vanno i soldi <small>(12 mesi)</small></h4>') + barre(Object.keys(usc).filter(k => usc[k] > 0).sort((a, b) => usc[b] - usc[a])
      .map(k => ({ nome: (USCITE[k] || ['', k])[0] + ' ' + (USCITE[k] || ['', k])[1], valore: usc[k], colore: (USCITE[k] || [0, 0, '#9fb2c4'])[2] }))) + '</div></div>';
    if (st.conti.mesi.length < 2) h += _('<p class="sotto">I grafici si arricchiscono mese dopo mese: la storia parte da quando hai iniziato a usare questa versione del gioco.</p>');
    return h;
  }

  function conti(st) {
    const co = st.conti;
    const anni = [...co.storico.slice(-4), { anno: co.anno, entrate: co.corrente.entrate, uscite: co.corrente.uscite, corrente: true }];
    const voceE = new Set(), voceU = new Set();
    for (const a of anni) { Object.keys(a.entrate).forEach(k => voceE.add(k)); Object.keys(a.uscite).forEach(k => voceU.add(k)); }
    const bil = anni.map(a => G.bilancio(a)), inv = k => G.VOCI_INVESTIMENTO.includes(k);
    const riga = (nome, val, cl) => `<tr${cl ? ` class="${cl}"` : ''}><td>${nome}</td>${anni.map((a, j) => { const v = val(a, j); return `<td class="num">${v ? G.lire(v) : ''}</td>`; }).join('')}</tr>`;
    const totale = (nome, campo, nota) => `<tr class="totale"><td>${nome}${nota ? `<div class="sotto">${nota}</div>` : ''}</td>${bil.map(b => `<td class="num ${campo === 'ricavi' ? 'verde' : campo === 'costi' || campo === 'investimenti' ? '' : classe(b[campo])}">${G.lire(campo === 'costi' || campo === 'investimenti' ? -b[campo] : b[campo])}</td>`).join('')}</tr>`;
    let h = SPIEGAZIONE + '<table class="elenco conti"><tr><th></th>' + anni.map(a => `<th class="num">${a.anno}${a.corrente ? _('<div class="sotto">in corso</div>') : ''}</th>`).join('') + '</tr>';
    h += _('<tr class="titoletto"><td colspan="9">🟢 Ricavi (le consegne)</td></tr>');
    for (const k of voceE) if (k !== 'vendite') h += riga(nomeMerce(k), a => a.entrate[k]);
    h += totale(_('Totale ricavi'), 'ricavi');
    h += _('<tr class="titoletto"><td colspan="9">🔴 Costi di gestione (si pagano ogni mese)</td></tr>');
    for (const k of voceU) if (!inv(k)) h += riga(USCITE[k] ? USCITE[k][0] + ' ' + USCITE[k][1] : esc(k), a => -a.uscite[k]);
    h += totale(_('Totale costi'), 'costi');
    h += totale(_('📈 Profitto'), 'profitto', _('ricavi − costi'));
    h += _('<tr class="titoletto"><td colspan="9">🟣 Investimenti (una volta sola, restano nel valore dell\'azienda)</td></tr>');
    for (const k of voceU) if (inv(k)) h += riga(USCITE[k] ? USCITE[k][0] + ' ' + USCITE[k][1] : esc(k), a => -a.uscite[k]);
    if (voceE.has('vendite')) h += riga(_('💰 Vendita mezzi'), a => a.entrate.vendite);
    h += totale(_('Totale investimenti'), 'investimenti');
    h += totale(_('💰 Saldo di cassa'), 'cassa', _('profitto − investimenti')) + '</table>';
    const inf = G.costiInfrastruttura(st);
    h += '<div class="kpis tre">';
    h += kpi(_('🔧 Manutenzione annua'), G.lire(G.somma(inf)), _`binari ${G.lireBreve(inf.binari)} · strade ${G.lireBreve(inf.strade)} · stazioni ${G.lireBreve(inf.stazioni)}`);
    h += kpi(_('⛽ Esercizio annuo dei mezzi'), G.lire(st.veicoli.reduce((a, v) => a + G.esercizioVeicolo(v), 0)), _('si paga un dodicesimo al mese'));
    h += kpi(_('🏦 Debito con la banca'), G.lire(st.prestito), st.prestito ? _`interessi ≈ ${G.lire(G.interessiMese(st))} al mese` : _`tasso di riferimento ${G.percento(G.tassoRiferimento(st))}`);
    h += '</div>';
    h += _('<div class="pulsanti"><button data-az="finestra" data-f="banca">🏦 Vai in banca: prestiti e tassi</button></div>');
    if (co.storico.length > 1) {
      h += _('<h4>Gli anni passati</h4>') + graficoLinee([
        { nome: _('Profitto'), colore: COL.utile, valori: co.storico.map(a => G.bilancio(a).profitto), area: true },
        { nome: _('Valore dell\'azienda'), colore: COL.valore, valori: co.storico.map(a => a.valore) }
      ], co.storico.map(a => ({ breve: String(a.anno), lungo: String(a.anno) })), 170) + legenda([[_('Profitto dell\'anno'), COL.utile], [_('Valore dell\'azienda a fine anno'), COL.valore]]);
    }
    return h;
  }

  function mezzi(st) {
    if (!st.veicoli.length) return _('<p>Non hai ancora mezzi. Costruisci due stazioni collegate, poi clicca su una stazione e premi «Compra».</p>');
    const somma = (el, f) => el.reduce((a, v) => a + f(v), 0);
    let h = _`<table class="elenco"><tr><th>Tipo</th><th class="num">Quanti</th><th class="num">Ricavi ${st.conti.anno}</th><th class="num">Costi ${st.conti.anno}</th>` +
      _`<th class="num">Profitto ${st.conti.anno}</th><th class="num">Profitto anno scorso</th><th class="num">Valore</th></tr>`;
    for (const t of Object.keys(TIPI)) {
      const el = st.veicoli.filter(v => v.tipo === t);
      if (!el.length) continue;
      const pa = somma(el, v => v.profittoAnno), ps = somma(el, v => v.profittoScorso);
      h += `<tr><td>${TIPI[t]}</td><td class="num">${el.length}</td><td class="num verde">${G.lire(somma(el, v => v.ricaviAnno))}</td>` +
        `<td class="num">${G.lire(-somma(el, v => v.costiAnno))}</td><td class="num ${classe(pa)}"><b>${G.lire(pa)}</b></td><td class="num ${classe(ps)}">${G.lire(ps)}</td>` +
        `<td class="num">${G.lire(somma(el, G.valoreVeicolo))}</td></tr>`;
    }
    h += '</table>';
    const ord = [...st.veicoli].sort((a, b) => b.profittoAnno - a.profittoAnno);
    const scelti = ord.length > 14 ? ord.slice(0, 7).concat(ord.slice(-7)) : ord;
    h += _`<h4>${ord.length > 14 ? _('I migliori e i peggiori') : _('Profitto di ogni mezzo')} <small>(quest'anno, clic per aprirlo)</small></h4>` + barreProfitto(scelti, 'profittoAnno');
    const vecchi = st.veicoli.filter(v => G.modello(v.modello).fine && G.anno(st) > G.modello(v.modello).fine).length;
    const eta = st.veicoli.reduce((a, v) => a + v.eta, 0) / st.veicoli.length;
    h += _`<p class="sotto">Età media dei mezzi: ${eta.toLocaleString(G.locale, { maximumFractionDigits: 1 })} anni${vecchi ? _` · ${vecchi} fuori produzione (si guastano di più)` : ''}.</p>` +
      _('<p class="sotto">Per ogni mezzo: <b class="verde">ricavi</b> = quanto incassa con le consegne; <b class="rosso">costi</b> = il suo esercizio ') +
      _('(cresce del 4% per ogni anno di età); <b class="giallo">profitto</b> = ricavi − costi. Il prezzo d\'acquisto è un investimento e non entra ') +
      _('nel profitto: nel pannello del mezzo vedi quanta parte ne ha già ripagato. Manutenzione di binari, strade e stazioni e interessi ') +
      _('si pagano per tutta la compagnia, quindi la somma dei profitti dei mezzi è più alta del profitto della compagnia.</p>');
    return h;
  }

  // colonne impilate: per ogni mese una pila con una fetta per voce di costo
  function graficoPile(lista, voci) {
    const W = 640, H = 220, sx = 62, dx = 12, sy = 12, gy = 24, n = lista.length;
    const tot = lista.map(m => voci.reduce((a, k) => a + (m.uscite[k] || 0), 0));
    const sc = scala(tot, H, sy, gy), l = (W - sx - dx) / n, b = Math.min(22, l * 0.7);
    const X = k => sx + l * (k + 0.5), etich = lista.map(etichetta);
    let s = `<svg class="graficoG" viewBox="0 0 ${W} ${H}">` + assi(sc, W, sx, dx) + etichetteX(etich, X, H);
    lista.forEach((m, k) => {
      let base = 0;
      for (const v of voci) {
        const q = m.uscite[v] || 0;
        if (q <= 0) continue;
        const y0 = sc.Y(base), y1 = sc.Y(base + q);
        s += `<rect x="${(X(k) - b / 2).toFixed(1)}" y="${y1.toFixed(1)}" width="${b.toFixed(1)}" height="${Math.max(0.5, y0 - y1).toFixed(1)}" fill="${coloreUscita(v)}" opacity="${m.inCorso ? 0.5 : 0.9}"/>`;
        base += q;
      }
      const t = _`${etich[k].lungo}\nTotale costi: ${G.lire(tot[k])}` + voci.filter(v => m.uscite[v] > 0).map(v => `\n${USCITE[v] ? USCITE[v][1] : v}: ${G.lire(m.uscite[v])}`).join('');
      s += `<rect x="${(X(k) - l / 2).toFixed(1)}" y="${sy}" width="${l.toFixed(1)}" height="${H - sy - gy}" fill="transparent"><title>${esc(t)}</title></rect>`;
    });
    return s + '</svg>';
  }

  // il quadro dei costi: quanto si spende, per cosa, e quanto si spenderà ogni mese
  function costi(st) {
    const inv = k => G.VOCI_INVESTIMENTO.includes(k);
    const tutti = mesi(st), ultimi = tutti.slice(-12), chiusi = st.conti.mesi.slice(-12);
    const scorso = st.conti.mesi.length ? st.conti.mesi[st.conti.mesi.length - 1] : null;
    const u12 = somme(ultimi, 'uscite');
    // costi che si pagheranno ogni mese con la compagnia com'è adesso
    const inf = G.costiInfrastruttura(st), eserAnno = st.veicoli.reduce((a, v) => a + G.esercizioVeicolo(v), 0);
    const prev = { esercizio: eserAnno / 12, manBinari: inf.binari / 12, manStrade: inf.strade / 12, manStazioni: inf.stazioni / 12, interessi: G.interessiMese ? G.interessiMese(st) : 0 };
    const totPrev = G.somma(prev);
    const ricMese = chiusi.length ? chiusi.reduce((a, m) => a + G.bilancio(m).ricavi, 0) / chiusi.length : 0;
    const costi12 = Object.keys(u12).filter(k => !inv(k)).reduce((a, k) => a + u12[k], 0);
    const inv12 = Object.keys(u12).filter(inv).reduce((a, k) => a + u12[k], 0);
    const copre = totPrev > 0 ? ricMese / totPrev : 0;

    let h = '<div class="kpis">';
    h += kpi(_('📅 Costi fissi al mese'), G.lire(totPrev), _('con mezzi, rete e prestiti di adesso'));
    h += kpi(_('🟢 Ricavi medi al mese'), G.lire(ricMese), chiusi.length ? _`ultimi ${chiusi.length} mesi chiusi` : _('nessun mese chiuso'));
    h += kpi(_('⚖️ Copertura'), totPrev > 0 ? Math.round(copre * 100) + '%' : '—', totPrev <= 0 ? _('nessun costo fisso') : copre >= 1 ? _('i ricavi pagano i costi fissi') : _('<span class="rosso">i ricavi non bastano</span>'), copre >= 1 ? 'verde' : totPrev > 0 ? 'rosso' : '');
    h += kpi(_('🔴 Costi (12 mesi)'), G.lire(costi12), _('esercizio, manutenzione, interessi'));
    h += kpi(_('🟣 Investimenti (12 mesi)'), G.lire(inv12), _('costruzioni e acquisto di mezzi'));
    h += '</div>';

    // tabella delle voci
    // colonne: mese scorso, quest'anno (dal 1° gennaio), ultimi 12 mesi, quota sui costi, previsto al mese
    const anno = st.conti.corrente.uscite;
    const voci = Object.keys(USCITE).filter(k => prev[k] > 0 || u12[k] > 0 || anno[k] > 0 || (scorso && scorso.uscite[k] > 0));
    const vc = voci.filter(k => !inv(k)), vi = voci.filter(inv);
    const cella = v => `<td class="num">${v ? G.lire(v) : ''}</td>`;
    const riga = k => `<tr><td><i class="pallinoG" style="background:${coloreUscita(k)}"></i>${nomeUscita(k)}</td>${cella(scorso && scorso.uscite[k])}${cella(anno[k])}${cella(u12[k])}` +
      `<td class="num sotto">${!inv(k) && costi12 > 0 && u12[k] ? Math.round(u12[k] / costi12 * 100) + '%' : ''}</td>${inv(k) ? '<td></td>' : cella(prev[k])}</tr>`;
    const somma = (el, f) => el.reduce((a, k) => a + (f(k) || 0), 0);
    const totale = (nome, el) => `<tr class="totale"><td>${nome}</td>${cella(somma(el, k => scorso && scorso.uscite[k]))}${cella(somma(el, k => anno[k]))}${cella(somma(el, k => u12[k]))}<td></td>${el === vi ? '<td></td>' : cella(totPrev)}</tr>`;
    h += _`<h4>Per voce</h4><table class="elenco conti"><tr><th></th><th class="num">Mese scorso</th><th class="num">${st.conti.anno}<div class="sotto">dal 1° gennaio</div></th><th class="num">Ultimi 12 mesi</th><th class="num">Quota</th><th class="num">Previsto al mese</th></tr>`;
    if (!vc.length) h += _('<tr><td colspan="6" class="sotto">Ancora nessun costo.</td></tr>');
    if (vc.length) h += _('<tr class="titoletto"><td colspan="6">🔴 Costi di gestione</td></tr>') + vc.map(riga).join('') + totale(_('Totale costi'), vc);
    if (vi.length) h += _('<tr class="titoletto"><td colspan="6">🟣 Investimenti</td></tr>') + vi.map(riga).join('') + totale(_('Totale investimenti'), vi);
    h += _('</table><p class="sotto">Esercizio, manutenzione e interessi si pagano alla fine di ogni mese; «previsto al mese» è quanto pagherai ') +
      _('con la compagnia così com\'è adesso. Passa col mouse sul grafico qui sotto per leggere ogni mese.</p>');

    const ult24 = tutti.slice(-24), vg = Object.keys(USCITE).filter(k => !inv(k) && ult24.some(m => m.uscite[k] > 0));
    if (vg.length) h += _('<h4>Costi di gestione, mese per mese</h4>') + graficoPile(ult24, vg) + legenda(vg.map(k => [USCITE[k][1], USCITE[k][2]]));

    // dettaglio: mezzi, rete, banca
    h += _('<div class="dueG"><div><h4>⛽ Esercizio dei mezzi</h4>');
    if (!st.veicoli.length) h += _('<p class="sotto">Nessun mezzo.</p>');
    else {
      h += _('<table class="elenco"><tr><th>Tipo</th><th class="num">Quanti</th><th class="num">All\'anno</th><th class="num">A testa</th></tr>');
      for (const t of Object.keys(TIPI)) {
        const el = st.veicoli.filter(v => v.tipo === t); if (!el.length) continue;
        const a = el.reduce((x, v) => x + G.esercizioVeicolo(v), 0);
        h += `<tr><td>${TIPI[t]}</td><td class="num">${el.length}</td><td class="num">${G.lire(a)}</td><td class="num">${G.lire(a / el.length)}</td></tr>`;
      }
      h += _('</table><div class="sotto">I più cari (cresce del 4% per anno di età):</div><table class="elenco">');
      for (const v of [...st.veicoli].sort((a, b) => G.esercizioVeicolo(b) - G.esercizioVeicolo(a)).slice(0, 5)) {
        h += _`<tr class="link" data-az="apriVeicolo" data-id="${v.id}"><td>${esc(v.nome)} <span class="sotto">${v.eta} anni${v.vagoni ? _` · ${v.vagoni} vagoni` : ''}</span></td><td class="num">${G.lire(G.esercizioVeicolo(v))}/anno</td>` +
          `<td class="num ${classe(v.profittoAnno)}" title="Profitto quest'anno">${segno(v.profittoAnno)}${G.lireBreve(v.profittoAnno)}</td></tr>`;
      }
      h += '</table>';
    }
    const m = st.mondo, km = G.kmCasella(st);
    let bin = 0, str = 0, aut = 0;
    for (let i = 0; i < m.N; i++) { if (m.mBin[i]) bin++; if (m.mStr[i] && !m.strCitta[i]) { if (m.tipoStr[i] === 2) aut++; else str++; } }
    const staz = {};
    for (const s of st.stazioni) if (s) { const d = G.defStazione(s), k = s.tipo === 'stazione' ? d.nome : C.stazioni[s.tipo].nome; staz[k] = staz[k] || { n: 0, c: 0 }; staz[k].n++; staz[k].c += d.manutenzione; }
    h += _('</div><div><h4>🔧 Manutenzione della rete (all\'anno)</h4><table class="elenco">');
    if (bin) h += _`<tr><td>🛤️ Binari: ${G.numero(bin * km)} km × ${G.lire(C.reti.binario.manutenzione)}</td><td class="num">${G.lire(inf.binari)}</td></tr>`;
    if (str) h += _`<tr><td>🛣️ Strade: ${G.numero(str * km)} km × ${G.lire(C.reti.strada.manutenzione)}</td><td class="num">${G.lire(str * km * C.reti.strada.manutenzione)}</td></tr>`;
    if (aut) h += _`<tr><td>🚧 Autostrade: ${G.numero(aut * km)} km × ${G.lire(C.reti.autostrada.manutenzione)}</td><td class="num">${G.lire(aut * km * C.reti.autostrada.manutenzione)}</td></tr>`;
    for (const k in staz) h += `<tr><td>🚉 ${staz[k].n} × ${esc(k)}</td><td class="num">${G.lire(staz[k].c)}</td></tr>`;
    if (!bin && !str && !aut && !Object.keys(staz).length) h += _('<tr><td class="sotto">Ancora niente da mantenere.</td></tr>');
    h += _('</table><p class="sotto">Le strade comunali delle città sono gratis. Una stazione inutile costa ogni anno: demoliscila.</p>');
    h += _('<h4>🏦 Interessi</h4>');
    if (st.prestito > 0 && st.banca) {
      h += '<table class="elenco">' + st.banca.prestiti.map(p => { const t = p.tipo === 'fisso' ? p.tasso : G.tassoVariabile(st); return _`<tr><td>${p.tipo === 'fisso' ? _('🔒 Fisso') : _('🔄 Variabile')} ${G.lire(p.importo)} al ${G.percento(t)}</td><td class="num">${G.lire(p.importo * t / 100 / 12)}/mese</td></tr>`; }).join('') + '</table>';
    } else h += _('<p class="sotto">Nessun prestito: nessun interesse.</p>');
    h += _('<div class="pulsanti"><button data-az="finestra" data-f="banca">🏦 Vai in banca</button></div></div></div>');
    return h;
  }

  function merci(st) {
    const ultimi = mesi(st, 12), ent = somme(ultimi, 'entrate'), un = somme(ultimi, 'unita');
    const chiavi = Object.keys(C.merci).filter(k => ent[k] > 0 || un[k] >= 1).sort((a, b) => (ent[b] || 0) - (ent[a] || 0));
    if (!chiavi.length) return _('<p>Nessuna consegna negli ultimi 12 mesi.</p>');
    const max = Math.max(1, ...chiavi.map(k => ent[k] || 0));
    let h = _('<table class="elenco"><tr><th>Merce <small>(ultimi 12 mesi)</small></th><th class="num">Consegnati</th><th class="num">Incasso</th><th class="num">Per unità</th><th></th></tr>');
    for (const k of chiavi) {
      const d = C.merci[k], q = un[k] || 0, e = ent[k] || 0;
      h += `<tr><td>${d.icona} ${d.nome}</td><td class="num">${G.numero(q)} ${d.unita}</td><td class="num">${G.lire(e)}</td>` +
        `<td class="num">${q >= 1 ? G.lire(e / q) : '—'}</td><td style="width:28%"><span class="pistaB"><i style="width:${(e / max * 100).toFixed(1)}%;background:${d.colore}"></i></span></td></tr>`;
    }
    h += '</table>';
    const lista = st.conti.mesi.slice(-24); // solo i mesi chiusi
    if (lista.length > 1) {
      const serie = chiavi.slice(0, 5).map(k => ({ nome: C.merci[k].nome, colore: C.merci[k].colore === '#2b2b2b' ? '#8a8a8a' : C.merci[k].colore, valori: lista.map(m => m.entrate[k] || 0) }));
      h += _('<h4>Incassi per merce, mese per mese</h4>') + graficoLinee(serie, lista.map(etichetta), 180) + legenda(serie.map(s => [s.nome, s.colore]));
    }
    h += _('<p class="sotto">Ogni consegna si paga per unità × prezzo × distanza in linea d\'aria; se il viaggio dura troppo il prezzo cala.</p>');
    return h;
  }

  // per altre finestre (la banca) che usano gli stessi grafici e riquadri
  Object.assign(G, { graficoLinee, legendaG: legenda, kpiG: kpi, etichettaMese: etichetta, mesiConti: mesi });

  // ---------------------------------------------------------------- finestra
  const SCHEDE = { riepilogo: [_('📊 Riepilogo'), riepilogo], conti: [_('📒 Conto economico'), conti], costi: [_('💸 Costi'), costi], mezzi: [_('🚂 Mezzi'), mezzi], merci: [_('📦 Merci'), merci] };
  let scheda = 'riepilogo', mesiVisti = -1;
  G.apriGestione = function (s) {
    const st = G.st;
    if (!st) return;
    if (s) scheda = s;
    G.contoMese(st);
    const corpo = document.querySelector('#finestra .corpo'), giaAperta = G.ui.finestra === TITOLO, sc = corpo.scrollTop;
    let h = '<div class="schede">' + Object.keys(SCHEDE).map(k => `<button class="${k === scheda ? 'attivo' : ''}" data-az="schedaGestione" data-s="${k}">${SCHEDE[k][0]}</button>`).join('') + '</div>';
    h += '<div class="gestione">' + SCHEDE[scheda][1](st) + '</div>';
    G.ui.apriFinestra(TITOLO, h, true, () => G.apriGestione());
    if (giaAperta) corpo.scrollTop = sc; // aggiornata da sola: si resta dove si stava leggendo
    mesiVisti = st.conti.mesi.length;
  };

  // ---------------------------------------------------------------- barra in alto
  // utile dell'anno e mini grafico della cassa negli ultimi 12 mesi; un clic apre il quadro
  let ultimoTesto = '';
  function aggiornaBarra() {
    const st = G.st, el = document.getElementById('quadroBarra');
    if (!st || !el) return;
    G.contoMese(st);
    const co = st.conti, u = G.bilancio(co.corrente).profitto;
    const v = st.conti.mesi.slice(-12).map(m => m.soldi).concat([st.soldi]);
    let svg = '';
    if (v.length > 1) {
      const W = 64, H = 20, min = Math.min(...v), max = Math.max(...v), d = max - min || 1;
      const pts = v.map((x, k) => `${(k / (v.length - 1) * (W - 2) + 1).toFixed(1)},${(H - 2 - (x - min) / d * (H - 4)).toFixed(1)}`).join(' ');
      svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polyline points="${pts}" fill="none" stroke="${v[v.length - 1] >= v[0] ? COL.entrate : COL.uscite}" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
    }
    const testo = _`<span class="eti" title="Profitto dell'anno: ricavi − costi (costruzioni e acquisti di mezzi non contano)">Profitto ${co.anno}</span> <b class="${classe(u)}">${segno(u)}${G.lireBreve(u)}</b>${svg}`;
    if (testo !== ultimoTesto) { el.innerHTML = testo; ultimoTesto = testo; }
    // quadro aperto: si aggiorna da solo a ogni mese che si chiude
    if (G.ui.finestra === TITOLO && st.conti.mesi.length !== mesiVisti) G.apriGestione();
  }
  setInterval(aggiornaBarra, 500);
})();
