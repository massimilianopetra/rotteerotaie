// Quadro di gestione: indicatori, grafici e conti della compagnia (finestra «📊 Gestione», tasto E)
// e il riassunto sempre visibile nella barra in alto (utile dell'anno e andamento della cassa).
// I grafici sono SVG fatti a mano: nessuna libreria. I dati mese per mese stanno in st.conti.mesi (vedi G.mensile).
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO;
  const TITOLO = 'Quadro di gestione';
  const NOMI_MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  const COL = { entrate: '#5ccf7a', uscite: '#ff6b5b', utile: '#f2b134', cassa: '#f2b134', valore: '#5b8def', griglia: 'rgba(255,255,255,0.07)', zero: 'rgba(255,255,255,0.28)' };
  const USCITE = {
    costruzione: ['🏗️', 'Costruzioni', '#c98b4a'], veicoli: ['🚂', 'Acquisto mezzi', '#8e7cc3'], esercizio: ['⛽', 'Esercizio mezzi', '#e07b5f'],
    manutenzione: ['🔧', 'Manutenzione', '#d4a24c'], interessi: ['🏦', 'Interessi', '#b0606a']
  };
  const TIPI = { treno: '🚂 Treni', strada: '🚌 Mezzi su strada', aereo: '✈️ Aerei' };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tot = o => G.somma(o || {});
  const segno = n => (n > 0 ? '+' : '');
  const classe = n => (n < 0 ? 'rosso' : 'verde');

  // lire in breve per assi ed etichette: L. 1,2 mln · L. 350 mila · L. 900
  G.lireBreve = function (n) {
    const a = Math.abs(n), s = n < 0 ? '−' : '';
    if (a >= 1e6) return s + 'L. ' + (a / 1e6).toLocaleString('it-IT', { maximumFractionDigits: a >= 1e7 ? 0 : 1 }) + ' mln';
    if (a >= 1e4) return s + 'L. ' + Math.round(a / 1e3).toLocaleString('it-IT') + ' mila';
    return s + 'L. ' + Math.round(a).toLocaleString('it-IT');
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
  const etichetta = m => ({ breve: G.MESI[m.mese] + (m.mese === 0 ? ' ' + m.anno : ''), lungo: NOMI_MESI[m.mese] + ' ' + m.anno + (m.inCorso ? ' (in corso)' : '') });

  // passo "tondo" per le righe dell'asse: 1, 2 o 5 per una potenza di 10
  function passoAsse(r) {
    if (!(r > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(r))), x = r / p;
    return (x <= 1 ? 1 : x <= 2 ? 2 : x <= 5 ? 5 : 10) * p;
  }
  function scala(valori, H, sy, gy) {
    let min = Math.min(0, ...valori), max = Math.max(0, ...valori);
    if (max - min < 1000) max = min + 1000; // grafico ancora vuoto: un asse sensato
    const passo = passoAsse((max - min) / 4);
    min = Math.floor(min / passo) * passo; max = Math.ceil(max / passo) * passo;
    return { min, max, passo, Y: v => sy + (max - v) / (max - min) * (H - sy - gy) };
  }
  function assi(sc, W, sx, dx) {
    let s = '';
    for (let v = sc.min; v <= sc.max + sc.passo * 1e-6; v += sc.passo) {
      const y = sc.Y(v).toFixed(1);
      s += `<line x1="${sx}" x2="${W - dx}" y1="${y}" y2="${y}" stroke="${Math.abs(v) < sc.passo * 1e-6 ? COL.zero : COL.griglia}"/>`;
      s += `<text x="${sx - 6}" y="${(+y + 4).toFixed(1)}" text-anchor="end">${breveAsse(v)}</text>`;
    }
    return s;
  }
  function etichetteX(etich, X, H) {
    const n = etich.length, ogni = Math.ceil(n / 9);
    let s = '';
    etich.forEach((e, k) => { if ((n - 1 - k) % ogni === 0) s += `<text x="${X(k).toFixed(1)}" y="${H - 7}" text-anchor="middle">${esc(e.breve)}</text>`; });
    return s;
  }

  // grafico a linee: serie = [{ nome, colore, valori, area }]; si passa sopra col mouse per leggere i valori
  function graficoLinee(serie, etich, H) {
    H = H || 190;
    const W = 640, sx = 62, dx = 12, sy = 12, gy = 24, n = etich.length;
    const sc = scala(serie.flatMap(s => s.valori), H, sy, gy);
    const X = k => sx + (n === 1 ? (W - sx - dx) / 2 : k * (W - sx - dx) / (n - 1));
    let s = `<svg class="graficoG" viewBox="0 0 ${W} ${H}">` + assi(sc, W, sx, dx) + etichetteX(etich, X, H);
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
      const t = e.lungo + serie.map(se => '\n' + se.nome + ': ' + G.lire(se.valori[k])).join('');
      s += `<rect x="${(X(k) - l / 2).toFixed(1)}" y="${sy}" width="${l.toFixed(1)}" height="${H - sy - gy}" fill="transparent"><title>${esc(t)}</title></rect>`;
    });
    return s + '</svg>';
  }

  // entrate (verdi) e uscite (rosse) mese per mese, con la linea dell'utile; il mese in corso è più chiaro
  function graficoBarre(lista) {
    const W = 640, H = 210, sx = 62, dx = 12, sy = 12, gy = 24, n = lista.length;
    const e = lista.map(m => tot(m.entrate)), u = lista.map(m => tot(m.uscite)), ut = e.map((v, k) => v - u[k]);
    const sc = scala(e.concat(u, ut), H, sy, gy), l = (W - sx - dx) / n, b = Math.min(18, l * 0.36);
    const X = k => sx + l * (k + 0.5), etich = lista.map(etichetta);
    let s = `<svg class="graficoG" viewBox="0 0 ${W} ${H}">` + assi(sc, W, sx, dx) + etichetteX(etich, X, H);
    const zero = sc.Y(0);
    lista.forEach((m, k) => {
      const op = m.inCorso ? 0.5 : 0.9;
      s += `<rect x="${(X(k) - b - 1).toFixed(1)}" y="${sc.Y(e[k]).toFixed(1)}" width="${b.toFixed(1)}" height="${Math.max(0, zero - sc.Y(e[k])).toFixed(1)}" rx="2" fill="${COL.entrate}" opacity="${op}"/>`;
      s += `<rect x="${(X(k) + 1).toFixed(1)}" y="${sc.Y(u[k]).toFixed(1)}" width="${b.toFixed(1)}" height="${Math.max(0, zero - sc.Y(u[k])).toFixed(1)}" rx="2" fill="${COL.uscite}" opacity="${op}"/>`;
    });
    // la linea dell'utile unisce solo i mesi chiusi: il mese in corso, a metà, sembrerebbe un crollo
    const chiusi = ut.map((v, k) => [k, v]).filter(([k]) => !lista[k].inCorso);
    if (chiusi.length > 1) s += `<polyline points="${chiusi.map(([k, v]) => `${X(k).toFixed(1)},${sc.Y(v).toFixed(1)}`).join(' ')}" fill="none" stroke="${COL.utile}" stroke-width="2" stroke-dasharray="4 3"/>`;
    ut.forEach((v, k) => { s += `<circle cx="${X(k).toFixed(1)}" cy="${sc.Y(v).toFixed(1)}" r="2.8" fill="${COL.utile}" opacity="${lista[k].inCorso ? 0.45 : 1}"/>`; });
    lista.forEach((m, k) => {
      const t = `${etich[k].lungo}\nEntrate: ${G.lire(e[k])}\nUscite: ${G.lire(u[k])}\nUtile: ${G.lire(ut[k])}`;
      s += `<rect x="${(X(k) - l / 2).toFixed(1)}" y="${sy}" width="${l.toFixed(1)}" height="${H - sy - gy}" fill="transparent"><title>${esc(t)}</title></rect>`;
    });
    return s + '</svg>';
  }

  const legenda = voci => '<div class="legendaG">' + voci.map(([nome, colore, tratteggio]) =>
    `<span><i style="background:${colore}${tratteggio ? ';height:2px;border-radius:0' : ''}"></i>${nome}</span>`).join('') + '</div>';

  // barre orizzontali: righe = [{ nome, valore, colore, testo }]
  function barre(righe) {
    if (!righe.length) return '<p class="sotto">Ancora niente.</p>';
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
  const nomeMerce = k => C.merci[k] ? C.merci[k].icona + ' ' + C.merci[k].nome : k === 'vendite' ? '💰 Vendita mezzi' : esc(k);

  // ---------------------------------------------------------------- schede
  function riepilogo(st) {
    const co = st.conti, ultimi = mesi(st, 12), tutti = mesi(st);
    const ric = tot(somme(ultimi, 'entrate')), cos = tot(somme(ultimi, 'uscite')), utile12 = ric - cos;
    const utileAnno = tot(co.corrente.entrate) - tot(co.corrente.uscite);
    const scorso = co.storico.length ? co.storico[co.storico.length - 1] : null;
    const utileScorso = scorso ? tot(scorso.entrate) - tot(scorso.uscite) : null;
    const unAnnoFa = tutti.length > 12 ? tutti[tutti.length - 13] : null;
    const valore = G.valoreAzienda(st), m = st.mondo, km = G.kmCasella(st);
    let bin = 0, str = 0;
    for (let i = 0; i < m.N; i++) { if (m.mBin[i]) bin++; if (m.mStr[i] && !m.strCitta[i]) str++; }
    const inPerdita = st.veicoli.filter(v => v.profittoAnno < 0).length;
    const unita = somme(ultimi, 'unita'), pass = unita.passeggeri || 0;
    const altre = Object.keys(unita).filter(k => k !== 'passeggeri' && unita[k] >= 1);
    let h = '<div class="kpis">';
    h += kpi('💰 Cassa', G.lire(st.soldi), st.prestito ? `debito ${G.lireBreve(st.prestito)}` : unAnnoFa ? `un anno fa ${G.lireBreve(unAnnoFa.soldi)}` : 'nessun debito', st.soldi < 0 ? 'rosso' : '');
    h += kpi(`📈 Utile ${co.anno}`, segno(utileAnno) + G.lire(utileAnno), utileScorso === null ? 'anno in corso' : `nel ${scorso.anno}: ${segno(utileScorso)}${G.lireBreve(utileScorso)}`, classe(utileAnno));
    h += kpi('🟢 Ricavi (12 mesi)', G.lire(ric), `in media ${G.lireBreve(ric / ultimi.length)} al mese`);
    h += kpi('🔴 Costi (12 mesi)', G.lire(cos), ric > 0 ? `margine ${Math.round(utile12 / ric * 100)}%` : 'nessun ricavo ancora');
    h += kpi('🏢 Valore dell\'azienda', G.lire(valore), unAnnoFa && unAnnoFa.valore > 0 ? `${segno(valore - unAnnoFa.valore)}${Math.round((valore / unAnnoFa.valore - 1) * 100)}% in un anno` : 'cassa + mezzi + rete − debito');
    h += kpi('🚂 Mezzi', G.numero(st.veicoli.length), st.veicoli.length ? (inPerdita ? `<span class="rosso">${inPerdita} in perdita quest'anno</span>` : 'tutti in guadagno quest\'anno') : 'compra il primo dalla stazione', '');
    h += kpi('🛤️ Rete', G.numero(bin * km) + ' km', `di binari · ${G.numero(str * km)} km di strade · ${st.stazioni.filter(Boolean).length} stazioni`);
    h += kpi('👥 Passeggeri (12 mesi)', G.numero(pass), altre.length ? altre.map(k => `${C.merci[k].icona} ${G.lireBreve(unita[k]).replace('L. ', '')}`).join(' · ') : 'nessuna merce ancora');
    h += '</div>';

    const ultimi24 = mesi(st, 24);
    h += `<h4>Entrate e uscite, mese per mese</h4>${graficoBarre(ultimi24)}` +
      legenda([['Entrate', COL.entrate], ['Uscite', COL.uscite], ['Utile', COL.utile, true]]);
    if (tutti.length > 1) {
      h += `<h4>Cassa e valore dell'azienda</h4>` + graficoLinee([
        { nome: 'Valore dell\'azienda', colore: COL.valore, valori: tutti.map(x => x.valore) },
        { nome: 'Cassa', colore: COL.cassa, valori: tutti.map(x => x.soldi), area: true }
      ], tutti.map(etichetta)) + legenda([['Cassa', COL.cassa], ['Valore dell\'azienda', COL.valore]]);
    }
    const ent = somme(ultimi, 'entrate'), usc = somme(ultimi, 'uscite');
    h += '<div class="dueG"><div><h4>Da dove arrivano i soldi <small>(12 mesi)</small></h4>' + barre(Object.keys(ent).filter(k => ent[k] > 0).sort((a, b) => ent[b] - ent[a])
      .map(k => ({ nome: nomeMerce(k), valore: ent[k], colore: C.merci[k] ? C.merci[k].colore : '#9fb2c4' }))) + '</div>';
    h += '<div><h4>Dove vanno i soldi <small>(12 mesi)</small></h4>' + barre(Object.keys(usc).filter(k => usc[k] > 0).sort((a, b) => usc[b] - usc[a])
      .map(k => ({ nome: (USCITE[k] || ['', k])[0] + ' ' + (USCITE[k] || ['', k])[1], valore: usc[k], colore: (USCITE[k] || [0, 0, '#9fb2c4'])[2] }))) + '</div></div>';
    if (st.conti.mesi.length < 2) h += '<p class="sotto">I grafici si arricchiscono mese dopo mese: la storia parte da quando hai iniziato a usare questa versione del gioco.</p>';
    return h;
  }

  function conti(st) {
    const co = st.conti;
    const anni = [...co.storico.slice(-4), { anno: co.anno, entrate: co.corrente.entrate, uscite: co.corrente.uscite, corrente: true }];
    const voceE = new Set(), voceU = new Set();
    for (const a of anni) { Object.keys(a.entrate).forEach(k => voceE.add(k)); Object.keys(a.uscite).forEach(k => voceU.add(k)); }
    let h = '<table class="elenco conti"><tr><th></th>' + anni.map(a => `<th class="num">${a.anno}${a.corrente ? '<div class="sotto">in corso</div>' : ''}</th>`).join('') + '</tr>';
    h += '<tr class="titoletto"><td colspan="9">Entrate</td></tr>';
    for (const k of voceE) h += `<tr><td>${nomeMerce(k)}</td>${anni.map(a => `<td class="num">${a.entrate[k] ? G.lire(a.entrate[k]) : ''}</td>`).join('')}</tr>`;
    h += '<tr class="titoletto"><td colspan="9">Uscite</td></tr>';
    for (const k of voceU) h += `<tr><td>${USCITE[k] ? USCITE[k][0] + ' ' + USCITE[k][1] : esc(k)}</td>${anni.map(a => `<td class="num">${a.uscite[k] ? G.lire(-a.uscite[k]) : ''}</td>`).join('')}</tr>`;
    h += `<tr class="totale"><td>Utile</td>${anni.map(a => { const u = tot(a.entrate) - tot(a.uscite); return `<td class="num ${classe(u)}">${G.lire(u)}</td>`; }).join('')}</tr></table>`;
    const inf = G.costiInfrastruttura(st);
    h += '<div class="kpis tre">';
    h += kpi('🔧 Manutenzione annua', G.lire(G.somma(inf)), `binari ${G.lireBreve(inf.binari)} · strade ${G.lireBreve(inf.strade)} · stazioni ${G.lireBreve(inf.stazioni)}`);
    h += kpi('⛽ Esercizio annuo dei mezzi', G.lire(st.veicoli.reduce((a, v) => a + G.esercizioVeicolo(v), 0)), 'si paga un dodicesimo al mese');
    h += kpi('🏦 Prestito', G.lire(st.prestito), `su ${G.lireBreve(C.inizio.prestitoMax)} · interesse ${Math.round(C.inizio.interesse * 100)}% l'anno`);
    h += '</div>';
    h += `<div class="pulsanti"><button data-az="prestito" data-d="1">🏦 Prendi ${G.lire(C.inizio.passoPrestito)}</button><button data-az="prestito" data-d="-1">↩ Restituisci ${G.lire(C.inizio.passoPrestito)}</button></div>`;
    if (co.storico.length > 1) {
      h += '<h4>Gli anni passati</h4>' + graficoLinee([
        { nome: 'Utile', colore: COL.utile, valori: co.storico.map(a => tot(a.entrate) - tot(a.uscite)), area: true },
        { nome: 'Valore dell\'azienda', colore: COL.valore, valori: co.storico.map(a => a.valore) }
      ], co.storico.map(a => ({ breve: String(a.anno), lungo: String(a.anno) })), 170) + legenda([['Utile dell\'anno', COL.utile], ['Valore dell\'azienda a fine anno', COL.valore]]);
    }
    return h;
  }

  function mezzi(st) {
    if (!st.veicoli.length) return '<p>Non hai ancora mezzi. Costruisci due stazioni collegate, poi clicca su una stazione e premi «Compra».</p>';
    let h = '<table class="elenco"><tr><th>Tipo</th><th class="num">Quanti</th><th class="num">Profitto quest\'anno</th><th class="num">Anno scorso</th><th class="num">Valore</th></tr>';
    for (const t of Object.keys(TIPI)) {
      const el = st.veicoli.filter(v => v.tipo === t);
      if (!el.length) continue;
      const pa = el.reduce((a, v) => a + v.profittoAnno, 0), ps = el.reduce((a, v) => a + v.profittoScorso, 0);
      h += `<tr><td>${TIPI[t]}</td><td class="num">${el.length}</td><td class="num ${classe(pa)}">${G.lire(pa)}</td><td class="num ${classe(ps)}">${G.lire(ps)}</td>` +
        `<td class="num">${G.lire(el.reduce((a, v) => a + G.valoreVeicolo(v), 0))}</td></tr>`;
    }
    h += '</table>';
    const ord = [...st.veicoli].sort((a, b) => b.profittoAnno - a.profittoAnno);
    const scelti = ord.length > 14 ? ord.slice(0, 7).concat(ord.slice(-7)) : ord;
    h += `<h4>${ord.length > 14 ? 'I migliori e i peggiori' : 'Profitto di ogni mezzo'} <small>(quest'anno, clic per aprirlo)</small></h4>` + barreProfitto(scelti, 'profittoAnno');
    const vecchi = st.veicoli.filter(v => G.modello(v.modello).fine && G.anno(st) > G.modello(v.modello).fine).length;
    const eta = st.veicoli.reduce((a, v) => a + v.eta, 0) / st.veicoli.length;
    h += `<p class="sotto">Età media dei mezzi: ${eta.toLocaleString('it-IT', { maximumFractionDigits: 1 })} anni${vecchi ? ` · ${vecchi} fuori produzione (si guastano di più)` : ''}. ` +
      'Il profitto di un mezzo è quanto incassa meno il suo esercizio; il prezzo d\'acquisto non conta.</p>';
    return h;
  }

  function merci(st) {
    const ultimi = mesi(st, 12), ent = somme(ultimi, 'entrate'), un = somme(ultimi, 'unita');
    const chiavi = Object.keys(C.merci).filter(k => ent[k] > 0 || un[k] >= 1).sort((a, b) => (ent[b] || 0) - (ent[a] || 0));
    if (!chiavi.length) return '<p>Nessuna consegna negli ultimi 12 mesi.</p>';
    const max = Math.max(1, ...chiavi.map(k => ent[k] || 0));
    let h = '<table class="elenco"><tr><th>Merce <small>(ultimi 12 mesi)</small></th><th class="num">Consegnati</th><th class="num">Incasso</th><th class="num">Per unità</th><th></th></tr>';
    for (const k of chiavi) {
      const d = C.merci[k], q = un[k] || 0, e = ent[k] || 0;
      h += `<tr><td>${d.icona} ${d.nome}</td><td class="num">${G.numero(q)} ${d.unita}</td><td class="num">${G.lire(e)}</td>` +
        `<td class="num">${q >= 1 ? G.lire(e / q) : '—'}</td><td style="width:28%"><span class="pistaB"><i style="width:${(e / max * 100).toFixed(1)}%;background:${d.colore}"></i></span></td></tr>`;
    }
    h += '</table>';
    const lista = st.conti.mesi.slice(-24); // solo i mesi chiusi
    if (lista.length > 1) {
      const serie = chiavi.slice(0, 5).map(k => ({ nome: C.merci[k].nome, colore: C.merci[k].colore === '#2b2b2b' ? '#8a8a8a' : C.merci[k].colore, valori: lista.map(m => m.entrate[k] || 0) }));
      h += '<h4>Incassi per merce, mese per mese</h4>' + graficoLinee(serie, lista.map(etichetta), 180) + legenda(serie.map(s => [s.nome, s.colore]));
    }
    h += '<p class="sotto">Ogni consegna si paga per unità × prezzo × distanza in linea d\'aria; se il viaggio dura troppo il prezzo cala.</p>';
    return h;
  }

  // ---------------------------------------------------------------- finestra
  const SCHEDE = { riepilogo: ['📊 Riepilogo', riepilogo], conti: ['📒 Conto economico', conti], mezzi: ['🚂 Mezzi', mezzi], merci: ['📦 Merci', merci] };
  let scheda = 'riepilogo', mesiVisti = -1;
  G.apriGestione = function (s) {
    const st = G.st;
    if (!st) return;
    if (s) scheda = s;
    G.contoMese(st);
    const corpo = document.querySelector('#finestra .corpo'), giaAperta = G.ui.finestra === TITOLO, sc = corpo.scrollTop;
    let h = '<div class="schede">' + Object.keys(SCHEDE).map(k => `<button class="${k === scheda ? 'attivo' : ''}" data-az="schedaGestione" data-s="${k}">${SCHEDE[k][0]}</button>`).join('') + '</div>';
    h += '<div class="gestione">' + SCHEDE[scheda][1](st) + '</div>';
    G.ui.apriFinestra(TITOLO, h, true);
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
    const co = st.conti, u = tot(co.corrente.entrate) - tot(co.corrente.uscite);
    const v = st.conti.mesi.slice(-12).map(m => m.soldi).concat([st.soldi]);
    let svg = '';
    if (v.length > 1) {
      const W = 64, H = 20, min = Math.min(...v), max = Math.max(...v), d = max - min || 1;
      const pts = v.map((x, k) => `${(k / (v.length - 1) * (W - 2) + 1).toFixed(1)},${(H - 2 - (x - min) / d * (H - 4)).toFixed(1)}`).join(' ');
      svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><polyline points="${pts}" fill="none" stroke="${v[v.length - 1] >= v[0] ? COL.entrate : COL.uscite}" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
    }
    const testo = `<span class="eti">Utile ${co.anno}</span> <b class="${classe(u)}">${segno(u)}${G.lireBreve(u)}</b>${svg}`;
    if (testo !== ultimoTesto) { el.innerHTML = testo; ultimoTesto = testo; }
    // quadro aperto: si aggiorna da solo a ogni mese che si chiude
    if (G.ui.finestra === TITOLO && st.conti.mesi.length !== mesiVisti) G.apriGestione();
  }
  setInterval(aggiornaBarra, 500);
})();
