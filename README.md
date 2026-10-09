# Rotaie & Rotte

Un gioco di **strategia dei trasporti** nel browser, ispirato ai classici come *Railroad Tycoon*:
si guida una compagnia che costruisce **ferrovie**, **strade**, **autostrade** e **aeroporti**,
compra treni, autobus, camion e aerei e trasporta passeggeri e merci fra città inventate
(oppure sulla mappa vera dell'**Italia** o dell'**Europa**) che **crescono** grazie ai collegamenti.

**Gioca online: https://massimilianopetra.github.io/rotteerotaie/**

Codice: https://github.com/massimilianopetra/rotteerotaie

## Come si avvia

Apri `index.html` con un doppio clic (Chrome, Edge o Firefox). Non serve Internet e non serve installare nulla.

All'avvio si sceglie il nome della compagnia, l'anno di inizio (dal 1850 al 1980), la grandezza della mappa,
il numero di città e il **seme** del mondo (stesso seme = stesso mondo).

## Mappe reali: Italia ed Europa

Nel menu «Mondo» si può scegliere, invece di un mondo inventato, una mappa vera costruita da
**OpenStreetMap** (città, paesi, abitanti, laghi) e dai rilievi aperti *Terrarium* (quote e linea di costa):

| Mappa | Caselle | Una casella | Località |
|---|---|---|---|
| Italia | 551 × 662 | 2 km | città e paesi con più di 5.000 abitanti (1.077) |
| Europa | 787 × 710 | 6 km | tutte le città (1.220, con Anatolia e Nordafrica) |

Ogni mappa è un file a sé (`dati/mappe/italia.js` e `dati/mappe/europa.js`, 1–1,5 MB) che il gioco carica **solo quando la
si sceglie**, così in memoria c'è soltanto la mappa in uso. Funziona anche aprendo `index.html` con un doppio clic.
Gli abitanti del gioco crescono con la radice quadrata di quelli veri (un paese ha poche case, Roma qualche migliaio
di abitanti del gioco); costi delle linee, manutenzione, velocità e pagamenti tengono conto dei chilometri per casella.
I fiumi sono ricavati dal rilievo: l'acqua scende di casella in casella e dove raccoglie un bacino grande nasce un fiume.

Per rifare le mappe (servono Node e Internet; quello che si scarica resta in `scripts/cache-mappe/`):

```
node scripts/mappe.js italia      # oppure: europa, tutte
node scripts/mappe.js italia --anteprima   # scrive anche un'immagine PNG nella cartella della cache
```

Per aggiungere un'altra mappa basta una voce in `MAPPE` dentro `scripts/mappe.js` e una in `mappeReali` in
`dati/catalogo.js`. Dati © OpenStreetMap contributors, licenza ODbL.

## Il gioco

- **Mappa vista dall'alto** generata a caso (o vera: Italia ed Europa): mare, laghi, fiumi, pianure, colline, montagne e boschi.
  Costruire in collina, in montagna o sopra un fiume (ponte) costa di più.
- **Vista 3D assonometrica** (pulsante 🧊 3D, tasto `D`): il mondo visto di sbieco, con il terreno in rilievo, le montagne innevate,
  i viadotti sui piloni, le gallerie, case e palazzi, alberi, stazioni, industrie e mezzi come solidi. Si gira di 90° con `O`
  (`Maiusc+O` al contrario) per guardare dietro ai monti e ai palazzi. Nel menu 🗺️ Mappa si sceglie quanto alte disegnare le
  montagne (basse, alte, altissime). Si gioca come nella vista dall'alto: si costruisce, si
  clicca e si trascina allo stesso modo. La scelta si ricorda nel browser.
- **Città inventate** (Castelvento, Roccalupo, Sant'Ilario, Porto Ceruleo…) che crescono se sono ben servite:
  le case nuove nascono lungo le vie e attorno alle stazioni, e diventano palazzine e palazzi.
- **Industrie e catene di produzione**:
  - Carbone + Ferro → Acciaieria → Acciaio
  - Acciaio + Legname → Fabbrica → Merci → città
  - Grano → Pastificio → Cibo → città
  - Petrolio → Raffineria → Carburante → città
  - La centrale elettrica compra il carbone
- **Miniere e pozzi hanno una riserva** che si esaurisce: le industrie chiudono e nel tempo
  vengono scoperti nuovi giacimenti. Le industrie ben servite aumentano la produzione.
- **Mezzi storici** che compaiono anno per anno: dalla locomotiva a vapore "Leopolda" all'ETR 500,
  dalla diligenza a cavalli al pullman Gran Turismo, dal Caproni Ca.97 all'Airbus A320, dal piroscafo a ruote
  alla nave portacontainer. Le autostrade arrivano nel 1955, gli aeroporti nel 1925.
- **Porti e navi** (⚓, tasto `P`): il porto va su una casella di terra che tocca il mare o un lago. Le navi non
  hanno bisogno di reti: navigano sull'acqua girando attorno a coste e isole (rotta calcolata casella per casella).
  Traghetti per passeggeri e posta (piroscafo a ruote, piroscafo postale, traghetto, aliscafo), navi da carico per
  le merci (brigantino, piroscafo a elica, motonave, portacontainer): lente ma capienti. Porti su acque diverse non
  si collegano.
- **Tempo realistico**: a velocità normale un secondo vero è 5 minuti di gioco e i mezzi viaggiano alla
  loro velocità vera (una casella è un chilometro): un treno a vapore fa 40 km in poco più di un'ora.
  Per far passare in fretta mesi e anni c'è l'avanti veloce: 1 ora, 1 giorno o 1 settimana al secondo.
- **Stazioni ferroviarie di quattro dimensioni**: fermata, stazione, stazione grande (2×2) e stazione centrale
  (3×3, dal 1860). Le più grandi hanno un bacino più ampio e caricano e scaricano più in fretta.
- **Binari occupati e segnali automatici**: su un tratto di binario passa un treno alla volta. I treni aspettano
  in stazione o prima di uno scambio, scelgono da soli un binario parallelo libero e si incrociano nei binari
  d'incrocio (raddoppi), sulle linee doppie e nelle stazioni grandi. Se due treni si bloccano a vicenda una notizia
  avvisa il giocatore, che può rimandarne uno indietro con «↩ Torna indietro».
- **Attesa nelle fermate**: un mezzo può partire appena carico, attendere il pieno oppure attendere fino a un certo
  tempo (giorni, ore, minuti) per riempirsi di più.
- **Giro o andata e ritorno**: con tre o più fermate il mezzo, dopo l'ultima, torna dritto alla prima (giro) oppure rifà
  le fermate al contrario (andata e ritorno: Milano → Vercelli → Torino → Vercelli → Milano). Il percorso del mezzo
  selezionato si vede sulla mappa lungo i binari o le strade, con il viaggio in corso evidenziato.
- **Economia**: ogni consegna è pagata in base alla distanza e alla rapidità; ci sono costi di esercizio,
  manutenzione delle linee, guasti dei mezzi vecchi, prestiti con interesse e il bilancio di fine anno.
- **Banca** (🏦 Banca, tasto `K`): prestiti a tasso variabile o fisso con un tasso che cambia ogni mese, spread secondo il
  rischio della compagnia (rating da AAA a D) e fido che cresce con il valore dell'azienda.
- **Livelli della mappa** (🗺️ Mappa, tasto `L`): si sceglie cosa vedere (case, vie dei paesi, strade, ferrovie, stazioni,
  industrie, mezzi, nomi, griglia, terreno attenuato) oppure una vista pronta: Tutto, Solo ferrovia, Reti e stazioni,
  Industrie e merci. Con un attrezzo in mano si vede sempre ciò che serve. La scelta si ricorda nel browser.
- **Quadro di gestione** (📊 Gestione, tasto `E`, oppure clic sul profitto in alto): indicatori (cassa, profitto, ricavi, costi
  e investimenti degli ultimi 12 mesi, margine, valore dell'azienda, rete, passeggeri), grafici mese per mese di ricavi, costi
  e investimenti, cassa e valore, da dove arrivano e dove vanno i soldi; schede con il conto economico (ricavi − costi = profitto,
  poi gli investimenti e il saldo di cassa), il **quadro dei costi** (ogni voce: esercizio dei mezzi, manutenzione di binari,
  strade e stazioni, interessi, penali, con mese scorso, anno, 12 mesi, quota e costo previsto al mese, copertura dei costi
  fissi coi ricavi, grafico a colonne impilate e dettaglio per mezzo, rete e prestito), ricavi/costi/profitto dei mezzi, le merci. In alto è sempre visibile
  il profitto dell'anno con l'andamento della cassa negli ultimi 12 mesi.
- **Aiuto a schede** (tasto `H`): come si gioca, costi di costruzione e manutenzione, soldi e profitti, comandi.
- **Salvataggio** di più partite nel browser (anche automatico ogni 1° gennaio) e su file `.rotaie`
  («Salva su file» lo scarica nei Download, «Apri da file» lo riapre: per fare copie o cambiare computer).

## Comandi

| Azione | Comando |
|---|---|
| Spostare la mappa | trascinare col tasto destro (o sinistro con 🔍), frecce |
| Zoom | rotellina, tasti `+` e `−` |
| Strumenti | `I` info · `B` ferrovia (menu: normale o galleria) · `R` strada · `U` autostrada (menu: normale o galleria) · `T` stazione (apre il menu delle dimensioni) · `F` autostazione · `A` aeroporto · `P` porto · `X` demolisci |
| Finestre | `V` mezzi · `M` mondo · `E` quadro di gestione · `K` banca · `H` aiuto |
| Mappa | `L` livelli della mappa (pulsante 🗺️ Mappa) · `C` vie dei paesi · `G` griglia |
| Vista 3D | `D` vista 3D assonometrica / vista dall'alto · `O` gira la vista 3D di 90° (`Maiusc+O` al contrario) |
| Tempo | `spazio` pausa · `1` normale (1 s = 5 minuti) · `2` veloce (1 ora al secondo) · `3` velocissimo (1 giorno) · `4` turbo (1 settimana) |
| Annulla / chiudi | `Esc` |

Per costruire una linea: tieni premuto il tasto sinistro e trascina; prima di lasciare vedi il tracciato e il costo.

## Primi passi

1. Clicca sul pulsante della stazione, scegli le dimensioni e mettila in una città (il riquadro azzurro è il bacino
   da cui arrivano passeggeri e merci).
2. Mettine un'altra in una seconda città e collegale con 🛤️. Il binario deve passare **sopra** una casella della
   stazione (o finirci): passarle accanto non basta.
3. Clicca su una stazione → «Compra un treno» → «Aggiungi fermate» → clicca sull'altra stazione.

## Quanto costa costruire

Le reti si pagano casella per casella: **costo della rete × moltiplicatore del terreno × km della casella**
(1 km sulle mappe inventate, 2 sull'Italia, 6 sull'Europa), più il taglio del bosco se c'è.
Il tracciato proposto è il **più economico**, non il più corto: gira attorno alle montagne e passa i fiumi dove conviene.

| Terreno | × | Ferrovia | Strada | Autostrada |
|---|---|---|---|---|
| Pianura | ×1 | L. 1.500 | L. 400 | L. 3.000 |
| Collina | ×2 | L. 3.000 | L. 800 | L. 6.000 |
| Montagna | ×4 | L. 6.000 | L. 1.600 | L. 12.000 |
| Fiume (ponte) | ×5 | L. 7.500 | L. 2.000 | L. 15.000 |
| Bosco | in più | L. 300 | L. 300 | L. 300 |
| Mare e laghi | — | non si costruisce | | |

(prezzi per casella sulle mappe inventate)

- Dove la rete c'è già non si paga; le strade comunali delle città sono gratis; l'autostrada sopra una strada costa il 40% in meno.
- Case e industrie non si attraversano. Demolire un pezzo di rete o una stazione costa L. 300, una casa L. 1.500 per piano.
- Una casella in diagonale costa come una diritta.

### Pendenze, gallerie e viadotti

Ogni casella ha una quota in metri (sulle mappe reali è quella vera). Una linea non sale né scende più di **35‰** la
ferrovia, **70‰** la strada e **45‰** l'autostrada: il gioco calcola da solo il profilo della linea, che segue il terreno
finché può. Dove passa più di 25 m **sopra** il terreno costruisce un **viadotto** (×6 il costo al km della rete); gli
scarti minori sono trincee e rilevati pagati a metro. Dove dovrebbe passare più di 25 m **sotto** il terreno la **ferrovia
(e l'autostrada) non si costruisce** (le caselle troppo ripide diventano rosse): la galleria la scava il giocatore con **🚇 Galleria**, la
seconda voce del menu della ferrovia (tasto `B`) o dell'autostrada (tasto `U`). La galleria è **dritta e in piano** alla quota dell'imbocco: si trascina
dall'imbocco all'uscita dall'altra parte del monte, sopra deve esserci sempre almeno 25 m di monte e l'uscita deve stare
alla stessa quota (±25 m); costa ×10. Le strade normali invece fanno ancora le gallerie da sole. L'anteprima mostra viadotti e
pendenza massima, e la ricerca del tracciato gira attorno ai monti quando può. I treni **rallentano in salita**: il vapore pieno al 35‰ va a circa metà velocità, elettriche
e diesel reggono il doppio, i treni corti salgono meglio. Sulla mappa le gallerie sono tratteggiate con gli imbocchi,
i viadotti hanno impalcato e piloni. Esempi sull'Italia: Milano–Torino tutta in pianura; Genova–Alessandria con una
galleria di 10 km sotto l'Appennino.
- **Manutenzione** all'anno, uguale su ogni terreno: ferrovia L. 50 al km, strada L. 10, autostrada L. 100; poi quella delle stazioni
  (da L. 500 per una fermata a L. 10.000 per un aeroporto).
- Tutti i numeri stanno in `dati/catalogo.js` (`reti`, `moltTerreno`, `costoBosco`). Nel gioco: aiuto (`H`), scheda «Costi».

## Soldi: ricavi, costi, profitto

| Parola | Che cos'è |
|---|---|
| **Ricavi** | quanto si incassa dalle consegne: unità × prezzo della merce × distanza in linea d'aria, meno se il viaggio è troppo lento |
| **Costi** | le spese di ogni mese: esercizio dei mezzi, manutenzione di reti e stazioni, interessi del prestito |
| **Profitto** | ricavi − costi: dice se la compagnia guadagna (è il numero in alto) |
| **Investimenti** | costruzioni e acquisto di mezzi (meno le vendite): si pagano una volta e restano nel valore dell'azienda, quindi non abbassano il profitto |
| **Cassa** | cresce del profitto e cala degli investimenti |
| **Valore dell'azienda** | cassa + valore dei mezzi + metà del costo della rete − debito |

Per ogni mezzo il gioco mostra ricavi, costi (il suo esercizio, +4% per anno di età) e profitto, quest'anno e l'anno scorso,
più «Prezzo già ripagato» (il profitto da quando è stato comprato rispetto al prezzo). Manutenzione e interessi sono di tutta la
compagnia, quindi la somma dei profitti dei mezzi è più alta del profitto della compagnia. Nel gioco: aiuto (`H`), scheda
«Soldi e profitti», e il quadro di gestione (`E`).

## La banca

Dalla finestra 🏦 Banca (tasto `K`) si chiede un prestito e lo si restituisce quando si vuole; ogni mese si pagano gli interessi.

- **Tasso di riferimento**: segue a grandi linee la storia dei tassi italiani (circa 4–5% nell'Ottocento, 7% negli anni Venti,
  oltre il 15% intorno al 1980, quasi zero intorno al 2015) e ogni mese si muove un po' a caso attorno a quel valore,
  con qualche scossa improvvisa. Quando cambia di un punto arriva una notizia.
- **Spread**: si aggiunge al riferimento ed è il rischio della compagnia: 1,5 punti di base, fino a 6 in più con tanto debito rispetto
  a quanto si possiede, +1,5 con la cassa in rosso, +1 se si è in perdita. Il rating va da AAA (ottimo) a D (molto rischioso).
- **Variabile o fisso**: il variabile cambia ogni mese con riferimento e spread; il fisso si blocca alla firma e costa un po' di più
  (guarda dove andranno i tassi nei prossimi 10 anni, più un premio). Restituire un fisso in anticipo costa l'1% di penale.
  Strategia: fisso prima che i tassi salgano, variabile quando scendono.
- **Fido**: si può avere in prestito fino al valore dell'azienda (almeno L. 600.000).
- Tutti i numeri sono in `dati/catalogo.js` (`banca`), compresa la curva storica dei tassi.

## Versione e build

La finestra **ℹ️ Informazioni** (e il menu iniziale) mostrano autore, versione e build, per esempio
«v1.1.0 · build 7 (a1b2c3d)». I dati stanno in `js/versione.js`, che non è in git: lo genera
`npm run versione` (versione da `package.json`, numero di commit, commit e data) e parte da solo prima di
`npm run deploy`. Senza quel file il gioco funziona lo stesso e dice «versione di sviluppo».

## Modificare il gioco

Tutti i numeri del gioco (prezzi delle merci, costi, velocità e anni dei mezzi, industrie, pezzi dei nomi
delle città) sono in `dati/catalogo.js`, un file pensato per essere modificato a mano.

## Pubblicare su GitHub Pages

Il sito è servito dal ramo `gh-pages`: dopo `npm install` basta `npm run deploy`
(GitHub Pages impiega circa un minuto; nel browser ricaricare con Ctrl+F5).

## Licenza

GNU GPL v3 o successiva (vedi `LICENSE`).
