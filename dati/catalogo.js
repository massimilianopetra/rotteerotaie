// Catalogo di Rotaie & Rotte: merci, industrie, veicoli, costi e pezzi per inventare i nomi delle città.
// È un normale file di dati: si può modificare a mano per bilanciare il gioco
// (prezzi, velocità, anni di comparsa dei mezzi, quantità di industrie...).
window.CATALOGO = {
  inizio: { soldi: 400000, prestitoMax: 600000, passoPrestito: 50000, interesse: 0.05 },

  // Banca: tassi in percento all'anno. Il tasso di riferimento segue "curva" (anno, tasso: più o meno lo sconto in Italia,
  // fra un punto e l'altro si interpola) e ogni mese si muove a caso attorno a quel valore (ritorno: quanto si riavvicina
  // in un mese; oscillazione: ampiezza della mossa casuale; scossa: probabilità al mese di un salto improvviso).
  // Il tasso della compagnia = riferimento + spread (rischio: debito rispetto al valore, mesi in rosso, perdite).
  // Il fisso si blocca alla firma: guarda anche dove andranno i tassi nei prossimi anni, più un premio.
  banca: {
    curva: [[1820, 4.5], [1850, 4.5], [1866, 6], [1873, 5], [1893, 5.5], [1900, 4.5], [1913, 5], [1915, 6], [1919, 5.5],
      [1925, 7], [1929, 7], [1932, 5], [1936, 4.5], [1944, 4], [1947, 5.5], [1950, 4], [1958, 3.5], [1969, 4], [1973, 6.5],
      [1974, 9], [1976, 15], [1980, 16.5], [1982, 18], [1985, 15], [1987, 12], [1990, 12.5], [1992, 13], [1993, 10], [1995, 9],
      [1997, 6], [1999, 3], [2001, 4], [2003, 2], [2006, 3.5], [2008, 4.25], [2009, 1], [2012, 0.75], [2015, 0.05], [2020, 0],
      [2022, 2.5], [2023, 4.5], [2024, 4], [2026, 2.5], [2100, 3]],
    ritorno: 0.12, oscillazione: 0.1, scossa: 0.02,
    spreadBase: 1.5, spreadDebito: 6, spreadRosso: 1.5, spreadPerdita: 1,
    premioFisso: 0.75, anniFisso: 10, penaleFisso: 0.01,
    fidoMin: 600000, passo: 50000, minimo: 0.5
  },

  // minuti di gioco che passano in un secondo vero, per ogni velocità (0 = pausa).
  // Normale: 1 secondo = 5 minuti; poi avanti veloce: 1 ora, 1 giorno, 1 settimana al secondo.
  velocita: [0, 5, 60, 1440, 10080],
  nomiVelocita: ['Pausa', 'Normale: 1 s = 5 minuti', 'Veloce: 1 s = 1 ora', 'Velocissimo: 1 s = 1 giorno', 'Turbo: 1 s = 1 settimana'],
  // lato di una casella in km: i mezzi viaggiano alla loro velocità vera (un treno a 60 km/h fa 60 caselle in un'ora)
  kmPerCasella: 1,
  // mappe con scenari reali: ogni file si carica solo quando si sceglie la mappa (lo crea scripts/mappe.js).
  // Lì una casella misura "km" chilometri: costi delle reti, manutenzione, velocità e pagamenti ne tengono conto.
  mappeReali: [
    { id: 'italia', nome: 'Italia', file: 'dati/mappe/italia.js', km: 2,
      descrizione: 'L\'Italia vera da OpenStreetMap: le città e i paesi con più di 5.000 abitanti, rilievi, fiumi e laghi. Una casella = 2 km.' },
    { id: 'europa', nome: 'Europa', file: 'dati/mappe/europa.js', km: 6,
      descrizione: 'L\'Europa vera da OpenStreetMap, dall\'Atlantico a Mosca e dalla Scandinavia al Mediterraneo (con Anatolia e Nordafrica): tutte le città. Una casella = 6 km.' }
  ],
  // gli aerei possono essere rallentati (1 = velocità vera)
  fattoreAerei: 1,
  tempi: {
    passoMinuti: 10,                              // passo della simulazione dei mezzi
    sostaMinuti: { treno: 10, strada: 3, aereo: 30 }, // sosta minima in stazione
    caricoOra: { treno: 240, strada: 60, aereo: 120 }, // unità caricate o scaricate in un'ora
    guastoOre: [2, 6],                            // durata di una riparazione
    riprovaOre: 1                                 // un mezzo bloccato riprova a cercare la strada
  },

  // prezzo: lire per unità per casella di distanza; giorni: viaggio oltre il quale il prezzo cala; icona: per il pannello delle stazioni
  merci: {
    passeggeri: { icona: '👥', nome: 'Passeggeri', unita: 'pass.', colore: '#f2c94c', prezzo: 0.25, giorni: 20 },
    posta:      { icona: '✉️', nome: 'Posta',      unita: 'sacchi', colore: '#f4f4f4', prezzo: 0.5, giorni: 14 },
    carbone:    { icona: '🪨', nome: 'Carbone',    unita: 't', colore: '#2b2b2b', prezzo: 2,   giorni: 60 },
    ferro:      { icona: '🔩', nome: 'Ferro',      unita: 't', colore: '#b5603a', prezzo: 2.2, giorni: 60 },
    legname:    { icona: '🪵', nome: 'Legname',    unita: 't', colore: '#8a5a2b', prezzo: 2,   giorni: 50 },
    grano:      { icona: '🌾', nome: 'Grano',      unita: 't', colore: '#e6c35c', prezzo: 2.4, giorni: 30 },
    petrolio:   { icona: '🛢️', nome: 'Petrolio',   unita: 'kl', colore: '#4b3a5a', prezzo: 2.4, giorni: 50 },
    acciaio:    { icona: '⚙️', nome: 'Acciaio',    unita: 't', colore: '#8fa3b8', prezzo: 3.5, giorni: 40 },
    cibo:       { icona: '🍞', nome: 'Cibo',       unita: 't', colore: '#7fbf5a', prezzo: 4,   giorni: 25 },
    carburante: { icona: '⛽', nome: 'Carburante', unita: 'kl', colore: '#d9534f', prezzo: 3.5, giorni: 30 },
    merci:      { icona: '📦', nome: 'Merci',      unita: 'casse', colore: '#5b8def', prezzo: 4.2, giorni: 35 }
  },

  // case: abitanti per livello (1 casetta, 2 casa, 3 palazzina, 4 palazzo)
  case: { pop: [0, 10, 30, 80, 200], nomi: ['', 'casetta', 'casa', 'palazzina', 'palazzo'] },
  // passeggeri e posta prodotti al giorno per abitante coperto da una stazione
  produzioneCitta: { passeggeri: 0.04, posta: 0.008 },
  // abitanti minimi nel bacino di una stazione perché accetti la merce
  accettazione: { passeggeri: 40, posta: 60, cibo: 80, merci: 150, carburante: 250 },

  // industrie. densita = quante ogni 10.000 caselle.
  // primarie: "produce" (unità al mese, tra base[0] e base[1]); con "riserva" si esauriscono.
  // secondarie: "accetta" delle merci e ne ricavano "uscita" con la "resa" indicata.
  industrie: {
    carbone:    { nome: 'Miniera di carbone', breve: 'Miniera', colore: '#3b3b3b', icona: '⛏️', produce: 'carbone', base: [45, 85], riserva: [7000, 20000], terreno: ['collina', 'montagna'], densita: 3.2 },
    ferro:      { nome: 'Miniera di ferro', breve: 'Ferriera', colore: '#8c4a2f', icona: '⛰️', produce: 'ferro', base: [40, 75], riserva: [6000, 18000], terreno: ['collina', 'montagna'], densita: 2.6 },
    petrolio:   { nome: 'Pozzo di petrolio', breve: 'Pozzi', colore: '#4b3a5a', icona: '🛢️', produce: 'petrolio', base: [40, 80], riserva: [8000, 22000], terreno: ['pianura'], densita: 1.4, dalAnno: 1880 },
    foresta:    { nome: 'Bosco da taglio', breve: 'Bosco', colore: '#2f5d34', icona: '🌲', produce: 'legname', base: [35, 70], bosco: true, densita: 2.6 },
    fattoria:   { nome: 'Fattoria', breve: 'Fattoria', colore: '#b8963c', icona: '🌾', produce: 'grano', base: [40, 80], terreno: ['pianura'], densita: 3.6 },
    acciaieria: { nome: 'Acciaieria', breve: 'Acciaieria', colore: '#5d6d7e', icona: '🏭', accetta: ['carbone', 'ferro'], uscita: 'acciaio', resa: 0.5, vicinoCitta: true, densita: 1.4 },
    centrale:   { nome: 'Centrale elettrica', breve: 'Centrale', colore: '#7a6a3a', icona: '⚡', accetta: ['carbone'], vicinoCitta: true, densita: 1.4 },
    fabbrica:   { nome: 'Fabbrica', breve: 'Fabbrica', colore: '#3f5f8f', icona: '🏗️', accetta: ['acciaio', 'legname'], uscita: 'merci', resa: 0.6, vicinoCitta: true, densita: 1.6 },
    pastificio: { nome: 'Pastificio', breve: 'Pastificio', colore: '#a7883b', icona: '🍝', accetta: ['grano'], uscita: 'cibo', resa: 0.8, vicinoCitta: true, densita: 1.4 },
    raffineria: { nome: 'Raffineria', breve: 'Raffineria', colore: '#6a3f6f', icona: '⚗️', accetta: ['petrolio'], uscita: 'carburante', resa: 0.8, vicinoCitta: true, densita: 1.0 }
  },

  // costo per casella in pianura; il terreno moltiplica il costo (fiume = ponte)
  reti: {
    binario:    { nome: 'Ferrovia',   costo: 1500, manutenzione: 50,  anno: 0 },
    strada:     { nome: 'Strada',     costo: 400,  manutenzione: 10,  anno: 0 },
    autostrada: { nome: 'Autostrada', costo: 3000, manutenzione: 100, anno: 1955 }
  },
  moltTerreno: { pianura: 1, collina: 2, montagna: 4, fiume: 5, acqua: Infinity },
  costoBosco: 300,
  costoDemolizione: 300,
  costoCasa: 1500, // per livello, per abbattere una casa

  stazioni: {
    stazione:  { nome: 'Stazione ferroviaria', costo: 20000,  manutenzione: 1200,  raggio: 3, lato: 1, icona: '🚉', anno: 0 },
    deposito:  { nome: 'Autostazione',         costo: 4000,   manutenzione: 300,   raggio: 2, lato: 1, icona: '🚏', anno: 0 },
    aeroporto: { nome: 'Aeroporto',            costo: 100000, manutenzione: 10000, raggio: 4, lato: 2, icona: '✈️', anno: 1925 }
  },
  // dimensioni delle stazioni ferroviarie: sostituiscono i valori della "stazione" qui sopra.
  // lato = caselle per lato (i binari possono attraversarle tutte), carico = rapidità di carico e scarico
  taglieStazione: {
    fermata:  { nome: 'Fermata',              breve: 'Piccola', costo: 8000,  manutenzione: 500,  raggio: 2, lato: 1, carico: 0.5, anno: 0 },
    media:    { nome: 'Stazione',             breve: 'Media',   costo: 20000, manutenzione: 1200, raggio: 3, lato: 1, carico: 1,   anno: 0 },
    grande:   { nome: 'Stazione grande',      breve: 'Grande',  costo: 45000, manutenzione: 2600, raggio: 4, lato: 2, carico: 1.6, anno: 0 },
    centrale: { nome: 'Stazione centrale',    breve: 'Centrale', costo: 90000, manutenzione: 5000, raggio: 5, lato: 3, carico: 2.5, anno: 1860 }
  },

  // vagone ferroviario: capacità per merce
  vagone: {
    costo: 3000, esercizio: 300,
    capacita: { passeggeri: 40, posta: 30, carbone: 30, ferro: 30, legname: 25, grano: 30, petrolio: 25, acciaio: 25, cibo: 20, carburante: 25, merci: 20 }
  },

  // velocità in km/h, costo d'acquisto, esercizio = costo annuo.
  // treni: "vagoni" = vagoni massimi. Strada/aereo: "capacita" (per i camion in tonnellate).
  veicoli: [
    { id: 'leopolda', nome: 'Vapore 2-2-2 "Leopolda"', tipo: 'treno', anno: 1830, fine: 1895, kmh: 45, vagoni: 4, costo: 40000, esercizio: 5000, colore: '#2b2b2b' },
    { id: 'gr552', nome: 'Vapore Gr. 552', tipo: 'treno', anno: 1872, fine: 1925, kmh: 65, vagoni: 5, costo: 55000, esercizio: 6000, colore: '#24402f' },
    { id: 'gr640', nome: 'Vapore Gr. 640', tipo: 'treno', anno: 1907, fine: 1960, kmh: 85, vagoni: 6, costo: 75000, esercizio: 7000, colore: '#1d1d1d' },
    { id: 'gr685', nome: 'Vapore Gr. 685', tipo: 'treno', anno: 1915, fine: 1965, kmh: 100, vagoni: 7, costo: 90000, esercizio: 8000, colore: '#3a1f1f' },
    { id: 'e626', nome: 'Elettrica E.626', tipo: 'treno', anno: 1930, fine: 1990, kmh: 95, vagoni: 9, costo: 120000, esercizio: 7000, colore: '#6b3a2a' },
    { id: 'd341', nome: 'Diesel D.341', tipo: 'treno', anno: 1956, fine: 2000, kmh: 120, vagoni: 9, costo: 150000, esercizio: 9000, colore: '#8c6a2a' },
    { id: 'e444', nome: 'Elettrica E.444 "Tartaruga"', tipo: 'treno', anno: 1968, kmh: 180, vagoni: 10, costo: 220000, esercizio: 10000, colore: '#2f4f7f' },
    { id: 'e402', nome: 'Elettrica E.402', tipo: 'treno', anno: 1990, kmh: 220, vagoni: 12, costo: 320000, esercizio: 12000, colore: '#b03030' },
    { id: 'etr500', nome: 'Alta velocità ETR 500', tipo: 'treno', anno: 1996, kmh: 300, vagoni: 12, costo: 450000, esercizio: 16000, colore: '#c0c0c0' },

    { id: 'diligenza', nome: 'Diligenza a cavalli', tipo: 'strada', classe: 'bus', anno: 1820, fine: 1925, kmh: 18, capacita: 10, costo: 3000, esercizio: 600, colore: '#7a4a2a' },
    { id: 'carro', nome: 'Carro a cavalli', tipo: 'strada', classe: 'camion', anno: 1820, fine: 1925, kmh: 15, capacita: 6, costo: 2500, esercizio: 500, colore: '#8a6a3a' },
    { id: 'fiat18bl', nome: 'Autocarro Fiat 18 BL', tipo: 'strada', classe: 'camion', anno: 1914, fine: 1955, kmh: 35, capacita: 12, costo: 9000, esercizio: 1500, colore: '#5a6a3a' },
    { id: 'bus621', nome: 'Autobus Fiat 621', tipo: 'strada', classe: 'bus', anno: 1930, fine: 1965, kmh: 55, capacita: 28, costo: 14000, esercizio: 2000, colore: '#2f6db5' },
    { id: 'leoncino', nome: 'Camion OM Leoncino', tipo: 'strada', classe: 'camion', anno: 1950, fine: 1985, kmh: 75, capacita: 18, costo: 18000, esercizio: 2200, colore: '#c0392b' },
    { id: 'bus306', nome: 'Autobus Fiat 306', tipo: 'strada', classe: 'bus', anno: 1958, fine: 1995, kmh: 85, capacita: 45, costo: 26000, esercizio: 2800, colore: '#3a8fd9' },
    { id: 'bilico', nome: 'Autoarticolato', tipo: 'strada', classe: 'camion', anno: 1970, kmh: 95, capacita: 30, costo: 35000, esercizio: 3500, colore: '#e67e22' },
    { id: 'granturismo', nome: 'Pullman Gran Turismo', tipo: 'strada', classe: 'bus', anno: 1985, kmh: 110, capacita: 55, costo: 45000, esercizio: 4000, colore: '#16a085' },

    { id: 'ca97', nome: 'Caproni Ca.97', tipo: 'aereo', anno: 1925, fine: 1945, kmh: 160, capacita: 8, costo: 50000, esercizio: 8000, colore: '#9b7a4a' },
    { id: 'sm73', nome: 'Savoia-Marchetti S.73', tipo: 'aereo', anno: 1935, fine: 1955, kmh: 270, capacita: 18, costo: 90000, esercizio: 12000, colore: '#a0a0a0' },
    { id: 'dc3', nome: 'Douglas DC-3', tipo: 'aereo', anno: 1940, fine: 1975, kmh: 290, capacita: 28, costo: 130000, esercizio: 15000, colore: '#c8c8c8' },
    { id: 'viscount', nome: 'Vickers Viscount', tipo: 'aereo', anno: 1955, fine: 1990, kmh: 500, capacita: 60, costo: 300000, esercizio: 30000, colore: '#e0e0e0' },
    { id: 'caravelle', nome: 'Sud Aviation Caravelle', tipo: 'aereo', anno: 1960, fine: 1995, kmh: 750, capacita: 80, costo: 450000, esercizio: 40000, colore: '#f0f0f0' },
    { id: 'dc9', nome: 'McDonnell Douglas DC-9', tipo: 'aereo', anno: 1967, fine: 2010, kmh: 800, capacita: 110, costo: 600000, esercizio: 50000, colore: '#f4f4f4' },
    { id: 'a320', nome: 'Airbus A320', tipo: 'aereo', anno: 1988, kmh: 830, capacita: 160, costo: 900000, esercizio: 65000, colore: '#ffffff' }
  ],

  // pezzi per inventare i nomi delle città
  nomi: {
    prefissi: ['Borgo', 'Castel', 'Villa', 'Torre', 'Pieve', 'Ponte', 'Casale', 'Poggio', 'Campo', 'Fonte'],
    prefissiMonte: ['Monte', 'Rocca', 'Colle', 'Serra', 'Pietra'],
    radici: ['vento', 'alba', 'fiore', 'rosso', 'nero', 'bianco', 'grillo', 'lupo', 'falco', 'sole', 'luna', 'quercia',
      'gelso', 'mirto', 'nebbia', 'sasso', 'ferro', 'salice', 'corvo', 'olmo', 'tasso', 'ginestra', 'cardo', 'pino', 'airone', 'orso'],
    santi: ['Gualtiero', 'Ermete', 'Bonifacio', 'Ilario', 'Teodoro', 'Anselmo', 'Cipriano', 'Eusebio', 'Ludovico',
      'Fermo', 'Prospero', 'Aniceto', 'Gaudenzio', 'Bartolo', 'Remigio', 'Oreste'],
    sante: ['Brigida', 'Ottilia', 'Rosalba', 'Giacinta', 'Ermelinda', 'Clotilde', 'Gaudenzia', 'Iolanda', 'Albina'],
    tronchi: ['Fior', 'Ventur', 'Grill', 'Lup', 'Falc', 'Sass', 'Corv', 'Olm', 'Gelson', 'Mirt', 'Querc', 'Cald',
      'Brum', 'Ross', 'Marmor', 'Ferr', 'Tasson', 'Ginestr', 'Card', 'Pescar', 'Mulin', 'Cerv', 'Nocet', 'Vign'],
    suffissi: ['ano', 'ello', 'ate', 'ola', 'ino', 'esco', 'engo', 'asco', 'ara', 'ona', 'eto', 'iglia'],
    marini: ['Ceruleo', 'Azzurro', 'Salino', 'Gabbiano', 'Corallo', 'Delfino', 'Scoglio', 'Ancora'],
    aggiunte: [' Superiore', ' Inferiore', ' Vecchia', ' Nuova', ' al Piano'],
    aggiunteMare: [' Marittima', ' a Mare', ' Lido'],
    aggiunteMonte: [' Alpina', ' in Valle', ' Alta']
  }
};
