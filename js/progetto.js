// Progettazione di ferrovie e autostrade senza costruire: si cliccano dei punti sulla mappa, fra un punto e il
// successivo il gioco calcola il tratto come farebbe costruendolo (tracciato normale oppure galleria dritta) e
// mostra sulla mappa le opere (superficie, galleria, viadotto, caselle impossibili) e in un riquadro il profilo
// altimetrico: terreno e quota della linea, pendenza, costo. «Costruisci» fa tutti i tratti in una volta.
// Il progetto non si salva con la partita; i tratti si ricalcolano se nel frattempo la rete cambia.
(function () {
  'use strict';
  const G = window.GIOCO, C = window.CATALOGO;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const P = G.progetto = {};
  // pr = { rete, punti: [caselle], tipi: ['normale'|'galleria' per tratto], tratti: [tracciati], prossimo, prova, provaA, provaTipo, versione }
  let pr = null;
  P.attivo = () => !!pr;
  P.dati = () => pr;
  P.rete = () => pr && pr.rete;

  // un tratto: tracciato normale (come trascinando) o galleria dritta; se non si passa, il motivo e le caselle
  function calcola(st, a, b, tipo, rete) {
    if (tipo === 'galleria') return G.cercaGalleria(st, a, b, rete);
    const tr = G.cercaTracciato(st, a, b, rete);
    if (tr) return tr;
    const mt = G.motivoTracciato(st, a, b, rete);
    return { caselle: null, costo: 0, impossibile: mt.testo, blocchi: mt.blocchi };
  }
  // se la rete è cambiata (si è costruito o demolito) i tratti si rifanno
  function aggiornaSeServe(st) {
    if (!pr || pr.versione === st.versioneRete) return;
    pr.versione = st.versioneRete;
    pr.tratti = pr.tipi.map((t, k) => calcola(st, pr.punti[k], pr.punti[k + 1], t, pr.rete));
    pr.provaA = -1; pr.prova = null;
  }

  P.clic = function (st, i, rete) {
    if (i < 0) return;
    if (pr && pr.rete !== rete) { pr = null; G.avviso(_('Nuovo progetto: quello di prima è stato tolto'), true); }
    if (!pr) pr = { rete, punti: [], tipi: [], tratti: [], prossimo: 'normale', prova: null, provaA: -1, provaTipo: '', versione: st.versioneRete };
    aggiornaSeServe(st);
    const ult = pr.punti[pr.punti.length - 1];
    if (ult === i) return;
    if (pr.punti.length) {
      pr.tipi.push(pr.prossimo);
      pr.tratti.push(pr.provaA === i && pr.provaTipo === pr.prossimo && pr.prova ? pr.prova : calcola(st, ult, i, pr.prossimo, rete));
    }
    pr.punti.push(i);
    pr.prova = null; pr.provaA = -1;
    disegnaRiquadro(st);
  };
  // il tratto di prova dall'ultimo punto al mouse
  P.muovi = function (st, i) {
    if (!pr || !pr.punti.length || i < 0) return;
    aggiornaSeServe(st);
    if (i === pr.provaA && pr.provaTipo === pr.prossimo) return;
    pr.provaA = i; pr.provaTipo = pr.prossimo;
    const ult = pr.punti[pr.punti.length - 1];
    pr.prova = i === ult ? null : calcola(st, ult, i, pr.prossimo, pr.rete);
    disegnaRiquadro(st);
  };
  P.esci = function (st) { if (pr && pr.prova) { pr.prova = null; pr.provaA = -1; disegnaRiquadro(st); } };
  P.togliUltimo = function (st) {
    if (!pr) return;
    pr.punti.pop(); pr.tipi.pop(); pr.tratti.pop();
    pr.prova = null; pr.provaA = -1;
    if (!pr.punti.length) pr = null;
    disegnaRiquadro(st);
  };
  P.annulla = function () { pr = null; disegnaRiquadro(); };
  // il riquadro si riduce a una riga, per vedere la mappa sotto
  let ridotto = false;
  P.riduci = function (st) { ridotto = !ridotto; disegnaRiquadro(st); };
  P.prossimo = function (st, tipo) { if (!pr) return; pr.prossimo = tipo; pr.provaA = -1; pr.prova = null; disegnaRiquadro(st); };
  P.cambiaTipo = function (st, k) {
    if (!pr || !pr.tipi[k]) return;
    pr.tipi[k] = pr.tipi[k] === 'galleria' ? 'normale' : 'galleria';
    pr.tratti[k] = calcola(st, pr.punti[k], pr.punti[k + 1], pr.tipi[k], pr.rete);
    disegnaRiquadro(st);
  };

  // si costruisce un tratto alla volta (ricalcolato: i tratti già fatti fissano le quote dei punti in comune)
  P.costruisci = function (st) {
    if (!pr || !pr.tratti.length) return _('Aggiungi almeno due punti al progetto');
    aggiornaSeServe(st);
    if (pr.tratti.some(t => t.impossibile)) return _('Ci sono tratti impossibili (in rosso): cambiali prima di costruire');
    const tot = pr.tratti.reduce((s, t) => s + t.costo, 0);
    if (tot > st.soldi) return _`Fondi insufficienti: il progetto costa ${G.lire(tot)}`;
    let fatti = 0, speso = 0, errore = null;
    for (let k = 0; k < pr.tipi.length; k++) {
      const tr = calcola(st, pr.punti[k], pr.punti[k + 1], pr.tipi[k], pr.rete);
      errore = tr.impossibile || G.costruisciTracciato(st, tr, pr.rete);
      if (errore) break;
      fatti++; speso += tr.costo;
    }
    if (!errore) { pr = null; disegnaRiquadro(); G.avviso(_`Progetto costruito: ${G.lire(speso)}`); return null; }
    // si è fermato a metà: i tratti fatti escono dal progetto, il resto resta da sistemare
    pr.punti.splice(0, fatti); pr.tipi.splice(0, fatti);
    pr.versione = -1; aggiornaSeServe(st); disegnaRiquadro(st);
    return _`Costruiti ${fatti} tratti, poi: ${errore}`;
  };

  // ---------------------------------------------------------------- riepilogo
  function lunghezzaKm(st, caselle) {
    if (!caselle) return 0;
    const m = st.mondo, km = G.kmCasella(st);
    let s = 0;
    for (let k = 1; k < caselle.length; k++) s += G.LUN[G.direzione(m, caselle[k - 1], caselle[k])] * km;
    return s;
  }
  function riepilogo(st) {
    const r = { km: 0, costo: 0, pendenza: 0, gallerie: 0, kmGallerie: 0, viadotti: 0, kmViadotti: 0, impossibili: 0 };
    for (const t of pr.tratti) {
      r.km += lunghezzaKm(st, t.caselle); r.costo += t.costo;
      if (t.impossibile) r.impossibili++;
      const p = t.profilo;
      if (p) { r.pendenza = Math.max(r.pendenza, p.pendenza || 0); r.gallerie += p.gallerie || 0; r.kmGallerie += p.kmGallerie || 0; r.viadotti += p.viadotti || 0; r.kmViadotti += p.kmViadotti || 0; }
    }
    return r;
  }

  // ---------------------------------------------------------------- profilo altimetrico (SVG)
  const COL = { terreno: '#7a6448', bordo: '#a88d66', superficie: '#f1ede2', galleria: '#b48cff', viadotto: '#5fb6ff', no: '#ff5a46', punto: '#ffd54f' };
  function profilo(st) {
    const m = st.mondo, Hm = G.metriTerreno(m), km = G.kmCasella(st);
    const lista = pr.tratti.map((t, k) => ({ t, k, prova: false }));
    if (pr.prova) lista.push({ t: pr.prova, k: pr.tratti.length, prova: true });
    // i campioni: distanza, terreno, linea, opera, tratto
    const c = [], inizi = [0];
    let x = 0;
    for (const { t, k, prova } of lista) {
      if (!t.caselle) { inizi.push(x); continue; }
      const q = t.profilo && t.profilo.quote && t.profilo.quote.length === t.caselle.length ? t.profilo.quote : null;
      const blocchi = new Set(t.blocchi || []);
      t.caselle.forEach((i, j) => {
        if (j) x += G.LUN[G.direzione(m, t.caselle[j - 1], i)] * km;
        c.push({ x, terra: Hm[i], linea: q ? q[j] : null, opera: t.profilo && t.profilo.opere ? t.profilo.opere[j] : 0, k, prova, no: !!t.impossibile, rosso: blocchi.has(i) });
      });
      inizi.push(x);
    }
    if (c.length < 2) return '<div class="sotto">' + _('Il profilo compare dal secondo punto.') + '</div>';
    const W = 720, H = 170, sx = 46, dx = 10, sy = 10, gy = 20, totKm = Math.max(x, 0.001);
    let lo = Infinity, hi = -Infinity;
    for (const p of c) { lo = Math.min(lo, p.terra, p.linea === null ? Infinity : p.linea); hi = Math.max(hi, p.terra, p.linea === null ? -Infinity : p.linea); }
    const marg = Math.max(20, (hi - lo) * 0.08); lo = Math.max(0, lo - marg); hi += marg;
    const X = v => sx + v / totKm * (W - sx - dx), Y = v => sy + (hi - v) / (hi - lo) * (H - sy - gy);
    let s = `<svg class="profiloAlt" viewBox="0 0 ${W} ${H}">`;
    // griglia e quote
    for (let n = 0; n <= 3; n++) {
      const v = lo + (hi - lo) * n / 3, y = Y(v).toFixed(1);
      s += `<line x1="${sx}" y1="${y}" x2="${W - dx}" y2="${y}" stroke="rgba(255,255,255,0.08)"/><text x="${sx - 5}" y="${+y + 4}" text-anchor="end">${G.numero(v)} m</text>`;
    }
    // terreno
    const pts = c.map(p => `${X(p.x).toFixed(1)},${Y(p.terra).toFixed(1)}`).join(' ');
    s += `<polygon points="${X(c[0].x).toFixed(1)},${H - gy} ${pts} ${X(c[c.length - 1].x).toFixed(1)},${H - gy}" fill="${COL.terreno}" opacity="0.85"/>`;
    s += `<polyline points="${pts}" fill="none" stroke="${COL.bordo}" stroke-width="1.2"/>`;
    // la linea, a pezzi dello stesso tipo
    for (let j = 1; j < c.length; j++) {
      const a = c[j - 1], b = c[j];
      if (a.k !== b.k || a.linea === null || b.linea === null) continue;
      const op = b.opera, col = a.no ? COL.no : op === G.OPERA.GALLERIA ? COL.galleria : op === G.OPERA.VIADOTTO ? COL.viadotto : COL.superficie;
      s += `<line x1="${X(a.x).toFixed(1)}" y1="${Y(a.linea).toFixed(1)}" x2="${X(b.x).toFixed(1)}" y2="${Y(b.linea).toFixed(1)}" stroke="${col}" stroke-width="${op === G.OPERA.VIADOTTO ? 3.2 : 2.2}"` +
        `${op === G.OPERA.GALLERIA ? ' stroke-dasharray="5 3"' : ''}${b.prova ? ' opacity="0.5"' : ''} stroke-linecap="round"/>`;
      // i piloni del viadotto
      if (op === G.OPERA.VIADOTTO && j % 2 === 0) s += `<line x1="${X(b.x).toFixed(1)}" y1="${Y(b.linea).toFixed(1)}" x2="${X(b.x).toFixed(1)}" y2="${Y(b.terra).toFixed(1)}" stroke="${COL.viadotto}" stroke-width="1" opacity="0.6"/>`;
    }
    // le caselle dove non si passa
    for (const p of c) if (p.rosso) s += `<path d="M${X(p.x).toFixed(1)},${(Y(p.terra) - 9).toFixed(1)} l-4,-7 h8 z" fill="${COL.no}"/>`;
    // i punti del progetto
    inizi.forEach((v, n) => {
      if (n > pr.punti.length - 1 && !(pr.prova && n === pr.punti.length)) return;
      s += `<line x1="${X(v).toFixed(1)}" y1="${sy}" x2="${X(v).toFixed(1)}" y2="${H - gy}" stroke="${COL.punto}" stroke-dasharray="3 3" opacity="${n >= pr.punti.length ? 0.4 : 0.8}"/>` +
        `<text x="${X(v).toFixed(1)}" y="${H - 6}" text-anchor="middle" fill="${COL.punto}">${n < pr.punti.length ? n + 1 : '⌖'}</text>`;
    });
    s += `<text x="${W - dx}" y="${sy + 10}" text-anchor="end">${G.fmt(totKm, { maximumFractionDigits: 1 })} km</text>`;
    // fasce invisibili: passando col mouse si leggono km, terreno e linea
    const passo = Math.max(1, Math.ceil(c.length / 240));
    for (let j = 0; j < c.length; j += passo) {
      const p = c[j], w = Math.max(2, (X(c[Math.min(c.length - 1, j + passo)].x) - X(p.x)));
      const op = p.opera === G.OPERA.GALLERIA ? _(' · 🚇 galleria') : p.opera === G.OPERA.VIADOTTO ? _(' · 🌉 viadotto') : '';
      const t = _`km ${G.fmt(p.x, { maximumFractionDigits: 1 })} · terreno ${G.numero(p.terra)} m` + (p.linea === null ? '' : _` · linea ${G.numero(p.linea)} m`) + op;
      s += `<rect x="${X(p.x).toFixed(1)}" y="${sy}" width="${w.toFixed(1)}" height="${H - sy - gy}" fill="transparent"><title>${esc(t)}</title></rect>`;
    }
    return s + '</svg>';
  }

  // ---------------------------------------------------------------- riquadro
  function disegnaRiquadro(st) {
    const el = $('#progetto');
    if (!el) return;
    if (!pr) { el.classList.add('nascosto'); el.innerHTML = ''; return; }
    st = st || G.st;
    const r = riepilogo(st), max = C.opere.pendenzaMax[pr.rete], km = x => G.fmt(x, { maximumFractionDigits: 1 });
    const tipoBtn = (t, ic, nome) => `<button class="${pr.prossimo === t ? 'attivo' : ''}" data-az="progettoProssimo" data-t="${t}">${ic} ${nome}</button>`;
    const r0 = `<button class="mini riduci" data-az="progettoRiduci" title="${ridotto ? _('Mostra il profilo') : _('Riduci il riquadro a una riga')}">${ridotto ? '▾' : '▴'}</button>`;
    let h = _`<div class="testa"><b>📐 Progetto: ${C.reti[pr.rete].nome}</b><span class="sotto">clic sulla mappa per aggiungere un punto · Backspace toglie l'ultimo · Invio costruisce · Esc annulla</span></div>`.replace('</div>', r0 + '</div>');
    if (ridotto) {
      h += _`<div class="riga numeri"><span>${pr.punti.length} punti</span><span>${km(r.km)} km</span><span class="${r.costo > st.soldi ? 'rosso' : ''}">${G.lire(r.costo)}</span>` + (r.impossibili ? `<span class="rosso">${_('tratti impossibili')}: ${r.impossibili}</span>` : '') + '</div>';
      el.innerHTML = h; el.classList.remove('nascosto'); return;
    }
    h += `<div class="riga">${_('Prossimo tratto:')} ${tipoBtn('normale', '🛤️', _('normale'))}${tipoBtn('galleria', '🚇', _('galleria dritta'))}</div>`;
    if (pr.tratti.length || pr.prova) {
      h += _`<div class="riga numeri"><span>${pr.punti.length} punti</span><span>${km(r.km)} km</span><span class="${r.costo > st.soldi ? 'rosso' : ''}">${G.lire(r.costo)}</span>` +
        _`<span class="${r.pendenza > max + 0.5 ? 'rosso' : ''}">pendenza massima ${Math.round(r.pendenza)}‰ (limite ${max}‰)</span>` +
        `<span>🚇 ${r.gallerie} (${km(r.kmGallerie)} km)</span><span>🌉 ${r.viadotti} (${km(r.kmViadotti)} km)</span></div>`;
      h += profilo(st);
      h += `<div class="legendaProfilo"><span><i style="background:${COL.superficie}"></i>${_('in superficie')}</span><span><i style="background:${COL.galleria}"></i>${_('galleria')}</span>` +
        `<span><i style="background:${COL.viadotto}"></i>${_('viadotto')}</span><span><i style="background:${COL.terreno}"></i>${_('terreno')}</span><span><i style="background:${COL.no}"></i>${_('non si passa')}</span></div>`;
      h += '<ol class="trattiProgetto">';
      pr.tratti.forEach((t, k) => {
        const p = t.profilo, info = t.impossibile ? `<span class="rosso">${esc(t.impossibile)}</span>`
          : `${km(lunghezzaKm(st, t.caselle))} km · ${G.lire(t.costo)} · ${Math.round(p ? p.pendenza : 0)}‰` + (p && p.gallerie ? ` · 🚇 ${p.gallerie}` : '') + (p && p.viadotti ? ` · 🌉 ${p.viadotti}` : '');
        h += `<li><b>${k + 1} → ${k + 2}</b> ${pr.tipi[k] === 'galleria' ? '🚇' : '🛤️'} ${info} <button class="mini" data-az="progettoTipo" data-k="${k}">${pr.tipi[k] === 'galleria' ? _('🛤️ fallo normale') : _('🚇 fallo in galleria')}</button></li>`;
      });
      h += '</ol>';
    } else h += '<div class="sotto">' + _('Clicca il secondo punto: il tratto si calcola come costruendolo, ma non si costruisce niente.') + '</div>';
    const ok = pr.tratti.length && !r.impossibili && r.costo <= st.soldi;
    h += `<div class="pulsanti"><button class="primario" data-az="progettoCostruisci" ${ok ? '' : 'disabled'}>${_`✔ Costruisci tutto (${G.lire(r.costo)})`}</button>` +
      `<button data-az="progettoTogli">${_('↩ Togli l\'ultimo punto')}</button><button data-az="progettoAnnulla">${_('✕ Annulla il progetto')}</button></div>`;
    el.innerHTML = h;
    el.classList.remove('nascosto');
  }
  P.disegnaRiquadro = disegnaRiquadro;

  // ---------------------------------------------------------------- sulla mappa (vista 2D)
  // ogni tratto con il colore della sua opera; il tratto di prova più chiaro; i punti numerati
  P.disegna2d = function (V) {
    if (!pr) return;
    const { m, ts, ox, oy, ctx } = V;
    const cx = i => ox + (i % m.W + 0.5) * ts, cy = i => oy + (((i / m.W) | 0) + 0.5) * ts;
    const lista = pr.tratti.slice();
    if (pr.prova) lista.push(Object.assign({ prova: true }, pr.prova));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const t of lista) {
      ctx.globalAlpha = t.prova ? 0.55 : 1;
      if (t.caselle) {
        const op = t.profilo && t.profilo.opere;
        for (let k = 1; k < t.caselle.length; k++) {
          const o = op ? op[k] : 0, a = t.caselle[k - 1], b = t.caselle[k];
          ctx.strokeStyle = t.impossibile ? 'rgba(255,90,70,0.9)' : o === G.OPERA.GALLERIA ? 'rgba(180,140,255,0.95)' : o === G.OPERA.VIADOTTO ? 'rgba(95,182,255,0.95)' : 'rgba(90,255,140,0.9)';
          ctx.lineWidth = Math.max(3, ts * (o === G.OPERA.VIADOTTO ? 0.42 : 0.3));
          ctx.setLineDash(o === G.OPERA.GALLERIA ? [Math.max(4, ts * 0.3), Math.max(3, ts * 0.2)] : []);
          ctx.beginPath(); ctx.moveTo(cx(a), cy(a)); ctx.lineTo(cx(b), cy(b)); ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      if (t.blocchi) {
        ctx.fillStyle = 'rgba(240,70,60,0.35)'; ctx.strokeStyle = 'rgba(255,90,70,0.95)'; ctx.lineWidth = 1.5;
        for (const i of t.blocchi) { const x = ox + (i % m.W) * ts, y = oy + ((i / m.W) | 0) * ts; ctx.fillRect(x, y, ts, ts); ctx.strokeRect(x + 0.5, y + 0.5, ts - 1, ts - 1); }
      }
    }
    ctx.globalAlpha = 1;
    const r = Math.max(7, Math.min(12, ts * 0.45));
    ctx.font = `bold ${Math.round(r * 1.2)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    pr.punti.forEach((i, n) => {
      ctx.fillStyle = '#ffd54f'; ctx.strokeStyle = '#3a2f10'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx(i), cy(i), r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a2208'; ctx.fillText(String(n + 1), cx(i), cy(i) + 0.5);
    });
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  };
  // per la vista 3D: i tratti da disegnare con le quote del profilo
  P.trattiDaDisegnare = function () {
    if (!pr) return [];
    const l = pr.tratti.map(t => ({ t, prova: false }));
    if (pr.prova) l.push({ t: pr.prova, prova: true });
    return l;
  };
})();
