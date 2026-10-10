// Controllo delle traduzioni: raccoglie tutti i testi da tradurre e li confronta con i dizionari in dati/lingue/.
//   node scripts/lingue.js            → riepilogo: testi mancanti e traduzioni non più usate, per ogni lingua
//   node scripts/lingue.js --mancanti → in più stampa i testi mancanti già pronti da incollare nel dizionario
// Testi da tradurre:
//   - nel codice (js/*.js): _`… ${x} …` (chiave «… {0} …») e _('…');
//   - nella pagina fissa (index.html): i testi fra i tag e gli attributi title;
//   - nel catalogo (dati/catalogo.js): nome, breve, unita, descrizione, nomiVelocita, case.nomi;
//   - i nomi dei terreni (G.NOMI_TERRENO in js/mappa.js), mostrati con G.tr.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const radice = path.join(__dirname, '..');
const leggi = f => fs.readFileSync(path.join(radice, f), 'utf8');

// ---------------------------------------------------------------- testi del codice
// un lettore di JavaScript ridotto: commenti, stringhe, regex e template (anche annidati)
function testiDelCodice(s) {
  const out = [];
  let i = 0;
  const regexPossibile = k => {
    let j = k - 1; while (j >= 0 && /\s/.test(s[j])) j--;
    if (j < 0 || '(,=:[!&|?{};+-*%<>~^'.includes(s[j])) return true;
    return /\b(return|typeof|case|in|of|else|void)$/.test(s.slice(Math.max(0, j - 10), j + 1));
  };
  function stringa(q) { const a = i; i++; while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++; } i++; return s.slice(a, i); }
  function regex() { i++; let cls = false; while (i < s.length) { const c = s[i]; if (c === '\\') { i += 2; continue; } if (c === '[') cls = true; else if (c === ']') cls = false; else if (c === '/' && !cls) break; else if (c === '\n') break; i++; } i++; while (/[a-z]/.test(s[i])) i++; }
  function template() {
    const pezzi = [], tag = s[i - 1] === '_' && !/[\w$]/.test(s[i - 2] || '');
    let k = ++i;
    while (i < s.length && s[i] !== '`') {
      if (s[i] === '\\') { i += 2; continue; }
      if (s[i] === '$' && s[i + 1] === '{') { pezzi.push(s.slice(k, i)); i += 2; codice(1); k = i; continue; }
      i++;
    }
    pezzi.push(s.slice(k, i)); i++;
    if (tag) out.push(pezzi.map(p => vm.runInNewContext('`' + p + '`')).join('\u0000').split('\u0000').map((p, n) => (n ? '{' + (n - 1) + '}' : '') + p).join(''));
  }
  function codice(prof) {
    let g = prof;
    while (i < s.length) {
      const c = s[i];
      if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
      if (c === '/' && s[i + 1] === '*') { i = s.indexOf('*/', i + 2) + 2; continue; }
      if (c === '"' || c === "'") {
        const chiamata = /(^|[^\w$.])_\(\s*$/.test(s.slice(Math.max(0, i - 4), i));
        const lett = stringa(c);
        if (chiamata) out.push(vm.runInNewContext(lett));
        continue;
      }
      if (c === '`') { template(); continue; }
      if (c === '/' && regexPossibile(i)) { regex(); continue; }
      if (c === '{') g++;
      if (c === '}') { g--; if (prof > 0 && g === 0) { i++; return; } }
      i++;
    }
  }
  codice(0);
  return out;
}

// ---------------------------------------------------------------- raccolta
const testi = new Map(); // testo → dove si trova
const metti = (t, dove) => { if (t && /[a-zà-ù]/i.test(t) && !testi.has(t)) testi.set(t, dove); };
const fileJs = fs.readdirSync(path.join(radice, 'js')).filter(f => f.endsWith('.js') && f !== 'versione.js');
for (const f of fileJs) for (const t of testiDelCodice(leggi('js/' + f))) metti(t, 'js/' + f);

const html = leggi('index.html').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '');
const decodifica = t => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
for (const m of html.split('<body>')[1].matchAll(/>([^<]+)</g)) metti(decodifica(m[1].trim()), 'index.html');
for (const m of html.matchAll(/title="([^"]*)"/g)) metti(decodifica(m[1]), 'index.html');
metti('Rotaie & Rotte — strategia dei trasporti', 'index.html');

const ctx = { window: {} };
vm.runInNewContext(leggi('dati/catalogo.js'), ctx);
const C = ctx.window.CATALOGO;
const campi = o => { for (const c of ['nome', 'breve', 'unita', 'descrizione']) if (typeof o[c] === 'string') metti(o[c], 'dati/catalogo.js'); };
for (const g of ['merci', 'industrie', 'reti', 'stazioni', 'taglieStazione']) for (const k in C[g] || {}) campi(C[g][k]);
for (const v of C.veicoli || []) campi(v);
for (const v of C.mappeReali || []) campi(v);
(C.nomiVelocita || []).forEach(t => metti(t, 'dati/catalogo.js'));
((C.case || {}).nomi || []).forEach(t => metti(t, 'dati/catalogo.js'));
const terreni = /G\.NOMI_TERRENO\s*=\s*\[([^\]]*)\]/.exec(leggi('js/mappa.js'));
if (terreni) for (const t of terreni[1].match(/'[^']*'/g)) metti(t.slice(1, -1), 'js/mappa.js');

// ---------------------------------------------------------------- confronto con i dizionari
const lingue = fs.readdirSync(path.join(radice, 'dati/lingue')).filter(f => f.endsWith('.js'));
const stampa = process.argv.includes('--mancanti');
console.log(`Testi da tradurre: ${testi.size}`);
let errori = 0;
for (const f of lingue) {
  const c2 = { window: {} };
  vm.runInNewContext(leggi('dati/lingue/' + f), c2);
  const l = path.basename(f, '.js'), diz = (c2.window.LINGUE || {})[l] || {};
  const mancanti = [...testi.keys()].filter(t => !(t in diz));
  const inutili = Object.keys(diz).filter(k => !testi.has(k));
  // ogni {n} della traduzione deve esistere nel testo italiano
  const segnaposti = Object.keys(diz).filter(k => (diz[k].match(/\{\d+\}/g) || []).some(p => !k.includes(p)));
  console.log(`\n[${l}] tradotti ${testi.size - mancanti.length} su ${testi.size} · mancanti ${mancanti.length} · non più usati ${inutili.length}` + (segnaposti.length ? ` · segnaposti sbagliati ${segnaposti.length}` : ''));
  for (const k of segnaposti) console.log('  segnaposto sbagliato: ' + JSON.stringify(k));
  for (const k of inutili) console.log('  non più usato: ' + JSON.stringify(k));
  if (stampa) for (const k of mancanti) console.log(`  ${JSON.stringify(k)}: '', // ${testi.get(k)}`);
  else if (mancanti.length) console.log('  (node scripts/lingue.js --mancanti per vederli)');
  errori += mancanti.length + segnaposti.length;
}
process.exitCode = errori ? 1 : 0;
