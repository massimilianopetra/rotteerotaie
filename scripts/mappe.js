// Costruisce le mappe con scenari reali (dati/mappe/*.js) da OpenStreetMap e dai rilievi aperti.
//   node scripts/mappe.js italia        (oppure: europa, tutte)
//   node scripts/mappe.js italia --anteprima   scrive anche un'immagine PNG della mappa
// Fonti:
//  - località (nome, posizione, abitanti) e laghi: OpenStreetMap tramite Overpass (© OpenStreetMap contributors, ODbL);
//  - quote e linea di costa: mattonelle "Terrarium" di Mapzen/Tilezen su AWS (SRTM, ETOPO1 e altri dati aperti);
//  - i fiumi si ricavano dal rilievo: l'acqua scende da casella a casella e dove si raccoglie da un bacino
//    abbastanza grande nasce un fiume (così scorre sempre in discesa e torna con il terreno del gioco).
// Tutto ciò che si scarica resta in scripts/cache-mappe/ (esclusa da git): rilanciando non si riscarica nulla.
// I server Overpass sono spesso carichi: le richieste sono piccole, si riprova e si cambia server.
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const https = require('https');

const RADICE = path.join(__dirname, '..');
const CACHE = path.join(__dirname, 'cache-mappe');
const USCITA = path.join(RADICE, 'dati', 'mappe');
const SERVER = [
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];
const AGENTE = 'RotaieERotte/1.1 (gioco scolastico; https://github.com/massimilianopetra/rotteerotaie)';

// ---------------------------------------------------------------- le mappe
// centro: centro della proiezione equivalente di Lambert (le aree restano giuste); riquadro in gradi;
// km: lato di una casella; zoom: livello delle mattonelle di quota; fiumeKm2: bacino minimo di un fiume;
// abitanti: come si ricava la popolazione del gioco da quella vera (radice quadrata: le metropoli non schiacciano tutto)
const MAPPE = {
  italia: {
    nome: 'Italia',
    descrizione: 'L\'Italia vera, dalle Alpi a Lampedusa: tutte le città e i paesi con più di 500 abitanti.',
    centro: [42, 12.5], riquadro: { sud: 35.4, nord: 47.15, ovest: 6.5, est: 18.65 }, km: 2, zoom: 7,
    // regioni (codici ISO 3166-2) più San Marino e Vaticano: una richiesta piccola per ciascuna
    aree: ['IT-21', 'IT-23', 'IT-25', 'IT-32', 'IT-34', 'IT-36', 'IT-42', 'IT-45', 'IT-52', 'IT-55', 'IT-57',
      'IT-62', 'IT-65', 'IT-67', 'IT-72', 'IT-75', 'IT-77', 'IT-78', 'IT-82', 'IT-88', 'SM', 'VA'],
    luoghi: 'city|town|village', minAbitanti: 500, distanzaMin: 2,
    laghi: ['Lago di Garda', 'Lago Maggiore', 'Lago di Como', "Lago d'Iseo", 'Lago di Lugano', "Lago d'Orta", 'Lago di Varese',
      'Lago Trasimeno', 'Lago di Bolsena', 'Lago di Bracciano', 'Lago di Vico', 'Lago di Lesina', 'Lago di Varano',
      'Lago Omodeo', 'Lago di Caldonazzo', 'Lago di Santa Croce', 'Lago del Salto', 'Lago di Campotosto', 'Lago di Bilancino',
      'Lago di Mezzola', 'Lago di Viverone', 'Lago di Pusiano', "Lago d'Idro", 'Lago di Ledro', 'Lago di Molveno',
      'Lago del Turano', 'Lago di Fiastra', 'Lago di Scanno', 'Lago di Garlate', 'Lago di Montepulciano', 'Lago di Chiusi'],
    fiumeKm2: 2400, abitanti: 3.2
  },
  europa: {
    nome: 'Europa',
    descrizione: 'L\'Europa dall\'Atlantico agli Urali occidentali e dalla Scandinavia al Mediterraneo: tutte le città.',
    centro: [53, 13], riquadro: { sud: 34.6, nord: 71.2, ovest: -11, est: 41 }, km: 6, zoom: 6,
    passoRiquadri: [52, 36.6], // le città (poche migliaia) si chiedono tutte insieme
    luoghi: 'city', minAbitanti: 0, distanzaMin: 2,
    laghi: ['Ладожское озеро', 'Онежское озеро', 'Vänern', 'Vättern', 'Mälaren', 'Hjälmaren', 'Saimaa', 'Päijänne',
      'Inarijärvi', 'Oulujärvi', 'Pielinen', 'Peipsi järv', 'Чудское озеро', 'Псковское озеро', 'Ильмень', 'Белое озеро',
      'Рыбинское водохранилище', 'Выгозеро', 'Топозеро', 'Имандра', 'Сегозеро', 'Lac Léman', 'Bodensee', 'Balaton',
      'Lago di Garda', 'Lago Maggiore', 'Lago di Como', 'Neusiedler See', 'Lough Neagh', 'Mjøsa', 'Siljan',
      'Storsjön', 'Torneträsk', 'Lago Trasimeno', 'Lac de Neuchâtel', 'Skadarsko jezero', 'Охридско Езеро',
      'Lough Corrib', 'Femund', 'Lago di Bolsena', 'Vierwaldstättersee', 'Zürichsee', 'Müritz', 'Jezioro Śniardwy'],
    fiumeKm2: 26000, abitanti: 2.6
  }
};

// ---------------------------------------------------------------- utilità
const dorme = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(CACHE, { recursive: true });

function scarica(url, corpo) {
  return new Promise((ok, ko) => {
    const u = new URL(url);
    const opz = { method: corpo ? 'POST' : 'GET', headers: { 'User-Agent': AGENTE }, timeout: 300000 };
    if (corpo) opz.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const req = https.request(u, opz, res => {
      const pezzi = [];
      res.on('data', p => pezzi.push(p));
      res.on('end', () => ok({ stato: res.statusCode, dati: Buffer.concat(pezzi) }));
    });
    req.on('timeout', () => req.destroy(new Error('tempo scaduto')));
    req.on('error', ko);
    if (corpo) req.write(corpo);
    req.end();
  });
}

// una richiesta Overpass con cache su file; valida = funzione che controlla la risposta
async function overpass(nomeCache, query, valida) {
  const file = path.join(CACHE, 'osm', nomeCache);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let tentativo = 0; tentativo < 200; tentativo++) {
    const url = SERVER[tentativo % SERVER.length];
    try {
      const r = await scarica(url, 'data=' + encodeURIComponent(query));
      const testo = r.dati.toString('utf8');
      if (r.stato === 200 && valida(testo)) {
        fs.writeFileSync(file, testo);
        await dorme(1500);
        return testo;
      }
      console.log(`   ${nomeCache}: risposta non valida da ${new URL(url).host} (${r.stato}), riprovo`);
    } catch (e) {
      console.log(`   ${nomeCache}: ${e.message} da ${new URL(url).host}, riprovo`);
    }
    await dorme(3000 + Math.min(tentativo, 10) * 3000);
  }
  throw new Error('Overpass non risponde per ' + nomeCache);
}
const csvValido = t => t.startsWith('@lat');
const jsonValido = t => t.trimStart().startsWith('{') && !/"remark"\s*:\s*"runtime error/.test(t);

// ---------------------------------------------------------------- proiezione (Lambert azimutale equivalente, sfera)
const R = 6371.0088, RAD = Math.PI / 180;
function proiezione(lat0, lon0) {
  const f0 = lat0 * RAD, l0 = lon0 * RAD, sf0 = Math.sin(f0), cf0 = Math.cos(f0);
  return {
    avanti(lat, lon) { // gradi -> km
      const f = lat * RAD, dl = lon * RAD - l0, sf = Math.sin(f), cf = Math.cos(f), cdl = Math.cos(dl);
      const k = Math.sqrt(2 / (1 + sf0 * sf + cf0 * cf * cdl));
      return [R * k * cf * Math.sin(dl), R * k * (cf0 * sf - sf0 * cf * cdl)];
    },
    indietro(x, y) { // km -> gradi
      const ro = Math.hypot(x, y);
      if (ro < 1e-9) return [lat0, lon0];
      const c = 2 * Math.asin(Math.min(1, ro / (2 * R))), sc = Math.sin(c), cc = Math.cos(c);
      const f = Math.asin(cc * sf0 + y * sc * cf0 / ro);
      const l = l0 + Math.atan2(x * sc, ro * cf0 * cc - y * sf0 * sc);
      return [f / RAD, l / RAD];
    }
  };
}

// la griglia del gioco: casella (gx, gy) con gy verso sud
function preparaGriglia(def) {
  const P = proiezione(def.centro[0], def.centro[1]), q = def.riquadro;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let k = 0; k <= 100; k++) {
    const lat = q.sud + (q.nord - q.sud) * k / 100, lon = q.ovest + (q.est - q.ovest) * k / 100;
    for (const [a, b] of [[lat, q.ovest], [lat, q.est], [q.sud, lon], [q.nord, lon]]) {
      const [x, y] = P.avanti(a, b);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  const W = Math.ceil((x1 - x0) / def.km), H = Math.ceil((y1 - y0) / def.km);
  return {
    W, H, km: def.km, P,
    // gradi -> coordinate di casella (continue)
    casella(lat, lon) { const [x, y] = P.avanti(lat, lon); return [(x - x0) / def.km, (y1 - y) / def.km]; },
    // coordinate di casella -> gradi
    gradi(gx, gy) { return P.indietro(x0 + gx * def.km, y1 - gy * def.km); }
  };
}

// ---------------------------------------------------------------- PNG (lettura delle mattonelle e anteprima)
function leggiPNG(buf) {
  let p = 8, larg = 0, alt = 0, tipoColore = 0, prof = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), tipo = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (tipo === 'IHDR') { larg = d.readUInt32BE(0); alt = d.readUInt32BE(4); prof = d[8]; tipoColore = d[9]; }
    else if (tipo === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  if (prof !== 8 || (tipoColore !== 2 && tipoColore !== 6)) throw new Error('PNG non gestito');
  const bpp = tipoColore === 6 ? 4 : 3, riga = larg * bpp, raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(alt * riga);
  for (let y = 0; y < alt; y++) {
    const f = raw[y * (riga + 1)], s = y * (riga + 1) + 1, o = y * riga;
    for (let i = 0; i < riga; i++) {
      const x = raw[s + i], a = i >= bpp ? out[o + i - bpp] : 0, b = y ? out[o - riga + i] : 0, c = i >= bpp && y ? out[o - riga + i - bpp] : 0;
      let v;
      if (f === 0) v = x;
      else if (f === 1) v = x + a;
      else if (f === 2) v = x + b;
      else if (f === 3) v = x + ((a + b) >> 1);
      else { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      out[o + i] = v & 255;
    }
  }
  return { larg, alt, bpp, px: out };
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(b) { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function scriviPNG(file, larg, alt, rgb) {
  const righe = Buffer.alloc(alt * (larg * 3 + 1));
  for (let y = 0; y < alt; y++) rgb.copy(righe, y * (larg * 3 + 1) + 1, y * larg * 3, (y + 1) * larg * 3);
  const pezzo = (tipo, d) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(tipo, 'ascii'), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
    return Buffer.concat([l, td, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(larg, 0); ihdr.writeUInt32BE(alt, 4); ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pezzo('IHDR', ihdr),
    pezzo('IDAT', zlib.deflateSync(righe)), pezzo('IEND', Buffer.alloc(0))]));
}

// ---------------------------------------------------------------- quote (mattonelle Terrarium, Web Mercator)
async function quote(def, gr) {
  const z = def.zoom, n = 2 ** z, mattonelle = new Map();
  const tx = lon => (lon + 180) / 360 * n;
  const ty = lat => { const f = lat * RAD; return (1 - Math.log(Math.tan(f) + 1 / Math.cos(f)) / Math.PI) / 2 * n; };
  // tutte le mattonelle che servono (dai punti campione)
  const S = 3, campioni = [];
  for (let gy = 0; gy < gr.H; gy++) for (let gx = 0; gx < gr.W; gx++) {
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const [lat, lon] = gr.gradi(gx + (sx + 0.5) / S, gy + (sy + 0.5) / S);
      campioni.push(tx(lon), ty(Math.max(-85, Math.min(85, lat))));
    }
  }
  const servono = new Set();
  for (let k = 0; k < campioni.length; k += 2) servono.add(Math.floor(campioni[k]) + ',' + Math.floor(campioni[k + 1]));
  console.log(`   ${servono.size} mattonelle di quota (zoom ${z})`);
  let fatte = 0;
  for (const chiave of servono) {
    const [x, y] = chiave.split(',').map(Number);
    const file = path.join(CACHE, 'terrarium', String(z), `${x}_${y}.png`);
    if (!fs.existsSync(file)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      for (let t = 0; ; t++) {
        try {
          const r = await scarica(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`);
          if (r.stato !== 200) throw new Error('stato ' + r.stato);
          fs.writeFileSync(file, r.dati); break;
        } catch (e) { if (t > 4) throw e; await dorme(2000); }
      }
    }
    const png = leggiPNG(fs.readFileSync(file)), q = new Float32Array(png.larg * png.alt);
    for (let i = 0; i < q.length; i++) {
      const o = i * png.bpp;
      q[i] = png.px[o] * 256 + png.px[o + 1] + png.px[o + 2] / 256 - 32768;
    }
    mattonelle.set(chiave, q);
    if (++fatte % 25 === 0) process.stdout.write(`   ${fatte}/${servono.size}\r`);
  }
  // per ogni casella: quota media e quanta parte è mare
  const N = gr.W * gr.H, media = new Float32Array(N), mare = new Float32Array(N), SS = S * S;
  for (let i = 0; i < N; i++) {
    let somma = 0, nMare = 0;
    for (let k = 0; k < SS; k++) {
      const fx = campioni[(i * SS + k) * 2], fy = campioni[(i * SS + k) * 2 + 1];
      const q = mattonelle.get(Math.floor(fx) + ',' + Math.floor(fy));
      const px = Math.min(255, Math.floor((fx % 1) * 256)), py = Math.min(255, Math.floor((fy % 1) * 256));
      const v = q[py * 256 + px];
      somma += v;
      if (v < def.sogliaMare) nMare++;
    }
    media[i] = somma / SS; mare[i] = nMare / SS;
  }
  return { media, mare };
}

// ---------------------------------------------------------------- località
function numero(s) {
  if (!s) return 0;
  const t = String(s).replace(/[.,\s']/g, '').match(/^\d+/);
  const n = t ? parseInt(t[0], 10) : 0;
  return n > 0 && n < 4e7 ? n : 0;
}

async function localita(def) {
  const campi = '[out:csv(::lat,::lon,name,"name:it","name:en",place,population;true;"\\t")][timeout:180];';
  const filtro = `node["place"~"^(${def.luoghi})$"]`;
  const testi = [];
  if (def.aree) {
    for (const a of def.aree) {
      const chiave = a.length === 2 ? 'ISO3166-1' : 'ISO3166-2';
      testi.push(await overpass(`localita-${a}.csv`, `${campi}area["${chiave}"="${a}"]->.a;${filtro}(area.a);out;`, csvValido));
      console.log(`   località ${a} ✓`);
    }
  } else {
    const q = def.riquadro, [ps, pn] = def.passoRiquadri;
    for (let lon = q.ovest; lon < q.est; lon += ps) for (let lat = q.sud; lat < q.nord; lat += pn) {
      const b = [lat, lon, Math.min(q.nord, lat + pn), Math.min(q.est, lon + ps)].map(v => +v.toFixed(3));
      testi.push(await overpass(`localita-${def.id}-${b.join('_')}.csv`, `${campi}${filtro}(${b.join(',')});out;`, csvValido));
      console.log(`   località ${b.join(',')} ✓`);
    }
  }
  const visti = new Set(), elenco = [];
  for (const t of testi) {
    for (const riga of t.split('\n').slice(1)) {
      const [lat, lon, nome, nomeIt, nomeEn, place, pop] = riga.split('\t');
      if (!nome || !lat) continue;
      const chiave = lat + ',' + lon;
      if (visti.has(chiave)) continue;
      visti.add(chiave);
      const n = (nomeIt || (/^[\p{Script=Latin}\d\s'’.,()-]+$/u.test(nome) ? nome : nomeEn) || nome).trim();
      elenco.push({ nome: n, lat: +lat, lon: +lon, place, pop: numero(pop) });
    }
  }
  return elenco;
}

// ---------------------------------------------------------------- laghi (poligoni OSM riempiti sulla griglia)
async function laghi(def, gr) {
  // solo i laghi grandi, per nome: si cercano per nome (veloce) e quelli omonimi fuori dal riquadro si scartano.
  // Chiedere tutti i laghi di una zona sarebbe pesantissimo (la Finlandia ne ha decine di migliaia).
  const nomi = def.laghi.map(n => `relation["name"="${n}"]["natural"="water"];way["name"="${n}"]["natural"="water"];`).join('');
  const t = await overpass(`laghi-${def.id}.json`, `[out:json][timeout:240];(${nomi});out geom qt;`, jsonValido);
  const q = def.riquadro;
  const elementi = JSON.parse(t).elements.filter(e => {
    const b = e.bounds || {};
    return b.minlat >= q.sud && b.maxlat <= q.nord && b.minlon >= q.ovest && b.maxlon <= q.est;
  });
  const trovati = new Set(elementi.map(e => e.tags && e.tags.name));
  const mancano = def.laghi.filter(n => !trovati.has(n));
  if (mancano.length) console.log('   laghi non trovati: ' + mancano.join(', '));
  const N = gr.W * gr.H, lago = new Uint8Array(N), visti = new Set();
  for (const e of elementi) {
    if (visti.has(e.type + e.id)) continue;
    visti.add(e.type + e.id);
    const linee = e.type === 'way' ? [e.geometry] : (e.members || []).filter(m => m.type === 'way' && m.geometry).map(m => m.geometry);
    const lati = [];
    for (const l of linee) {
      const pt = l.filter(Boolean).map(p => gr.casella(p.lat, p.lon));
      for (let k = 0; k + 1 < pt.length; k++) lati.push(pt[k], pt[k + 1]);
    }
    riempi(gr, lati, lago);
  }
  return lago;
}

// riempimento pari-dispari a righe: le isole (anelli interni) restano fuori
function riempi(gr, lati, dest) {
  if (!lati.length) return;
  let ymin = Infinity, ymax = -Infinity;
  for (const p of lati) { ymin = Math.min(ymin, p[1]); ymax = Math.max(ymax, p[1]); }
  for (let gy = Math.max(0, Math.floor(ymin)); gy <= Math.min(gr.H - 1, Math.ceil(ymax)); gy++) {
    const yc = gy + 0.5, xs = [];
    for (let k = 0; k < lati.length; k += 2) {
      const [ax, ay] = lati[k], [bx, by] = lati[k + 1];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let gx = Math.max(0, Math.ceil(xs[k] - 0.5)); gx <= Math.min(gr.W - 1, Math.floor(xs[k + 1] - 0.5)); gx++) dest[gy * gr.W + gx] = 1;
    }
  }
}

// ---------------------------------------------------------------- fiumi dal rilievo
// "priority flood": l'acqua parte dal mare (e dai bordi) e risale; ogni casella scola in quella da cui è stata raggiunta.
// Poi si sommano i bacini da monte a valle: dove il bacino supera fiumeKm2 c'è un fiume.
function fiumi(def, gr, quota, acqua) {
  const W = gr.W, H = gr.H, N = W * H, giu = new Int32Array(N).fill(-1), visto = new Uint8Array(N), ordine = [];
  const coda = new Coda();
  for (let i = 0; i < N; i++) {
    const x = i % W, y = (i / W) | 0;
    if (acqua[i]) { visto[i] = 1; continue; }
    const bordo = x === 0 || y === 0 || x === W - 1 || y === H - 1;
    const vicinoAcqua = (x > 0 && acqua[i - 1]) || (x < W - 1 && acqua[i + 1]) || (y > 0 && acqua[i - W]) || (y < H - 1 && acqua[i + W]);
    if (bordo || vicinoAcqua) { visto[i] = 1; coda.metti(i, quota[i]); }
  }
  while (coda.n) {
    const [i, q] = coda.togli();
    ordine.push(i);
    const x = i % W, y = (i / W) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
      if (j < 0 || visto[j]) continue;
      visto[j] = 1; giu[j] = i;
      coda.metti(j, Math.max(quota[j], q + 0.01)); // nelle conche l'acqua sale fino a traboccare
    }
  }
  const bacino = new Float32Array(N), area = gr.km * gr.km;
  for (let k = ordine.length - 1; k >= 0; k--) {
    const i = ordine[k];
    bacino[i] += area;
    if (giu[i] >= 0) bacino[giu[i]] += bacino[i];
  }
  const fiume = new Uint8Array(N);
  let n = 0;
  for (let i = 0; i < N; i++) if (!acqua[i] && bacino[i] >= def.fiumeKm2) { fiume[i] = 1; n++; }
  return { fiume, n };
}

// coda con priorità (mucchio binario) di coppie [casella, valore]
class Coda {
  constructor() { this.i = []; this.v = []; this.n = 0; }
  metti(i, v) {
    let k = this.n++;
    this.i[k] = i; this.v[k] = v;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (this.v[p] <= v) break;
      this.i[k] = this.i[p]; this.v[k] = this.v[p]; this.i[p] = i; this.v[p] = v; k = p;
    }
  }
  togli() {
    const ri = this.i[0], rv = this.v[0], n = --this.n;
    if (n > 0) {
      const i = this.i[n], v = this.v[n];
      let k = 0;
      for (;;) {
        let c = 2 * k + 1;
        if (c >= n) break;
        if (c + 1 < n && this.v[c + 1] < this.v[c]) c++;
        if (this.v[c] >= v) break;
        this.i[k] = this.i[c]; this.v[k] = this.v[c]; k = c;
      }
      this.i[k] = i; this.v[k] = v;
    }
    return [ri, rv];
  }
}

// ---------------------------------------------------------------- costruzione di una mappa
// tipi di terreno come nel gioco: 0 acqua, 1 pianura, 2 collina, 3 montagna, 4 fiume
const SOGLIE = { pianura: 250, collina: 700, neve: 2300 }; // metri
// quota del gioco (0..1): 0,2 il mare, 0,45 fine pianura, 0,65 fine collina, 0,95 neve
function quotaGioco(m) {
  if (m <= 0) return Math.max(0, 0.2 + m / 1000);
  const t = [[0, 0.2], [SOGLIE.pianura, 0.45], [SOGLIE.collina, 0.65], [SOGLIE.neve, 0.95], [4500, 1]];
  for (let k = 1; k < t.length; k++) if (m <= t[k][0]) return t[k - 1][1] + (t[k][1] - t[k - 1][1]) * (m - t[k - 1][0]) / (t[k][0] - t[k - 1][0]);
  return 1;
}

async function costruisci(id, anteprima) {
  const def = Object.assign({ id, sogliaMare: 0 }, MAPPE[id]);
  if (!MAPPE[id]) throw new Error('Mappa sconosciuta: ' + id + ' (ci sono: ' + Object.keys(MAPPE).join(', ') + ')');
  console.log(`\n== ${def.nome}`);
  const gr = preparaGriglia(def), W = gr.W, H = gr.H, N = W * H;
  console.log(`   griglia ${W} × ${H} caselle da ${def.km} km`);
  const { media, mare } = await quote(def, gr);
  const lago = await laghi(def, gr);
  const acqua = new Uint8Array(N);
  for (let i = 0; i < N; i++) acqua[i] = mare[i] > 0.5 || lago[i] ? 1 : 0;
  // le "pozzanghere" di mare di una o due caselle diventano terra (lagune, errori del rilievo)
  togliIsolotti(gr, acqua, 3);
  const fi = fiumi(def, gr, media, acqua);
  const tipo = new Uint8Array(N), alt = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const q = media[i];
    if (acqua[i]) tipo[i] = 0;
    else if (fi.fiume[i]) tipo[i] = 4;
    else tipo[i] = q < SOGLIE.pianura ? 1 : q < SOGLIE.collina ? 2 : 3;
    // il lago si disegna come mare poco profondo; la terra non scende sotto il livello del mare
    const qq = acqua[i] ? (lago[i] && !(mare[i] > 0.5) ? -30 : Math.min(q, -1)) : Math.max(1, q);
    alt[i] = Math.round(quotaGioco(qq) * 255);
  }
  // località
  const loc = await localita(def);
  const citta = [];
  for (const l of loc) {
    const pop = l.pop || { city: 60000, town: 6000, village: 0 }[l.place] || 0;
    if (pop < def.minAbitanti) continue;
    const [fx, fy] = gr.casella(l.lat, l.lon);
    let x = Math.floor(fx), y = Math.floor(fy);
    if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) continue;
    // in acqua (porto, isoletta): si sposta sulla terra più vicina
    if (acqua[y * W + x]) {
      let best = null;
      for (let r = 1; r <= 2 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const j = (y + dy) * W + x + dx;
        if (!acqua[j] && (!best || Math.hypot(dx, dy) < best[2])) best = [x + dx, y + dy, Math.hypot(dx, dy)];
      }
      if (!best) continue;
      [x, y] = best;
    }
    citta.push({ nome: l.nome, x, y, pop });
  }
  // le più grandi per prime; quelle troppo vicine a una più grande si uniscono a lei
  citta.sort((a, b) => b.pop - a.pop);
  const tenute = [], griglia = new Map(), D = def.distanzaMin;
  for (const c of citta) {
    let vicina = null;
    for (let dy = -D; dy <= D && !vicina; dy++) for (let dx = -D; dx <= D; dx++) {
      const v = griglia.get((c.y + dy) * W + c.x + dx);
      if (v) { vicina = v; break; }
    }
    if (vicina) { vicina.pop += c.pop; continue; }
    tenute.push(c); griglia.set(c.y * W + c.x, c);
  }
  // fiume sotto il centro di una città: il centro è terraferma (il fiume passa accanto)
  for (const c of tenute) if (tipo[c.y * W + c.x] === 4) tipo[c.y * W + c.x] = 1;
  const terra = tipo.reduce((s, t) => s + (t ? 1 : 0), 0);
  console.log(`   ${loc.length} località scaricate, ${tenute.length} nel gioco; ${fi.n} caselle di fiume; terra ${(100 * terra / N).toFixed(0)}%`);
  const fasce = [0, 1000, 5000, 20000, 100000, 1e9];
  for (let k = 0; k + 1 < fasce.length; k++) {
    const n = tenute.filter(c => c.pop >= fasce[k] && c.pop < fasce[k + 1]).length;
    console.log(`     ${fasce[k]}–${fasce[k + 1] === 1e9 ? '…' : fasce[k + 1]} abitanti: ${n}`);
  }

  // file per il gioco: un normale script che si aggiunge a window.MAPPE_REALI
  const dati = {
    id, nome: def.nome, descrizione: def.descrizione, W, H, km: def.km, abitanti: def.abitanti,
    fonte: '© OpenStreetMap contributors (ODbL); rilievo: Mapzen Terrarium (SRTM, ETOPO1)',
    creata: new Date().toISOString().slice(0, 10),
    tipo: Buffer.from(tipo).toString('base64'),
    alt: Buffer.from(alt).toString('base64'),
    // nome|x|y|abitanti veri, una città per riga
    citta: tenute.map(c => `${c.nome.replace(/[|\n]/g, ' ')}|${c.x}|${c.y}|${c.pop}`).join('\n')
  };
  fs.mkdirSync(USCITA, { recursive: true });
  const testo = `// Mappa "${def.nome}" generata da scripts/mappe.js: non modificarla a mano.\n` +
    `// Dati ${dati.fonte}.\n` +
    `(window.MAPPE_REALI = window.MAPPE_REALI || {})[${JSON.stringify(id)}] = ${JSON.stringify(dati)};\n`;
  const file = path.join(USCITA, id + '.js');
  fs.writeFileSync(file, testo);
  console.log(`   scritto ${path.relative(RADICE, file)} (${(testo.length / 1024).toFixed(0)} kB)`);

  if (anteprima) {
    const rgb = Buffer.alloc(N * 3), col = [[52, 110, 170], [146, 166, 90], [150, 134, 100], [126, 116, 108], [80, 150, 215]];
    for (let i = 0; i < N; i++) {
      let c = col[tipo[i]];
      if (tipo[i] === 0 && lago[i]) c = [90, 160, 210];
      rgb[i * 3] = c[0]; rgb[i * 3 + 1] = c[1]; rgb[i * 3 + 2] = c[2];
    }
    for (const c of tenute) {
      const i = c.y * W + c.x, r = c.pop > 100000 ? 1 : 0;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const j = i + dy * W + dx;
        rgb[j * 3] = 220; rgb[j * 3 + 1] = 40; rgb[j * 3 + 2] = 30;
      }
    }
    const fp = path.join(CACHE, id + '-anteprima.png');
    scriviPNG(fp, W, H, rgb);
    console.log(`   anteprima: ${fp}`);
  }
}

// zone d'acqua (valore 1) più piccole di "min" caselle diventano terra
function togliIsolotti(gr, acqua, min) {
  const W = gr.W, N = W * gr.H, visto = new Uint8Array(N);
  for (let s = 0; s < N; s++) {
    if (visto[s] || !acqua[s]) continue;
    const pila = [s], zona = [];
    visto[s] = 1;
    while (pila.length) {
      const i = pila.pop(); zona.push(i);
      const x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < gr.H - 1 ? i + W : -1]) {
        if (j >= 0 && !visto[j] && acqua[j]) { visto[j] = 1; pila.push(j); }
      }
    }
    if (zona.length < min) for (const i of zona) acqua[i] = 0;
  }
}

(async () => {
  const arg = process.argv.slice(2), anteprima = arg.includes('--anteprima');
  const quali = arg.filter(a => !a.startsWith('--'));
  const ids = !quali.length || quali.includes('tutte') ? Object.keys(MAPPE) : quali;
  for (const id of ids) await costruisci(id, anteprima);
})().catch(e => { console.error('Errore: ' + e.message); process.exit(1); });
