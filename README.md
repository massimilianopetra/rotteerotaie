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
  dalla diligenza a cavalli al pullman Gran Turismo, dal Caproni Ca.97 all'Airbus A320.
  Le autostrade arrivano nel 1955, gli aeroporti nel 1925.
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
- **Economia**: ogni consegna è pagata in base alla distanza e alla rapidità; ci sono costi di esercizio,
  manutenzione delle linee, guasti dei mezzi vecchi, prestiti con interesse e il bilancio di fine anno.
- **Livelli della mappa** (🗺️ Mappa, tasto `L`): si sceglie cosa vedere (case, vie dei paesi, strade, ferrovie, stazioni,
  industrie, mezzi, nomi, griglia, terreno attenuato) oppure una vista pronta: Tutto, Solo ferrovia, Reti e stazioni,
  Industrie e merci. Con un attrezzo in mano si vede sempre ciò che serve. La scelta si ricorda nel browser.
- **Quadro di gestione** (📊 Gestione, tasto `E`, oppure clic sull'utile in alto): indicatori (cassa, utile, ricavi e costi
  degli ultimi 12 mesi, margine, valore dell'azienda, rete, passeggeri), grafici mese per mese di entrate e uscite, cassa e
  valore, da dove arrivano e dove vanno i soldi; schede con il conto economico e i prestiti, i mezzi migliori e peggiori,
  le merci. In alto è sempre visibile l'utile dell'anno con l'andamento della cassa negli ultimi 12 mesi.
- **Salvataggio** di più partite nel browser (anche automatico ogni 1° gennaio) e su file `.rotaie`
  («Salva su file» lo scarica nei Download, «Apri da file» lo riapre: per fare copie o cambiare computer).

## Comandi

| Azione | Comando |
|---|---|
| Spostare la mappa | trascinare col tasto destro (o sinistro con 🔍), frecce |
| Zoom | rotellina, tasti `+` e `−` |
| Strumenti | `I` info · `B` ferrovia · `R` strada · `U` autostrada · `T` stazione (apre il menu delle dimensioni) · `F` autostazione · `A` aeroporto · `X` demolisci |
| Finestre | `V` mezzi · `M` mondo · `E` quadro di gestione · `H` aiuto |
| Mappa | `L` livelli della mappa (pulsante 🗺️ Mappa) · `C` vie dei paesi · `G` griglia |
| Tempo | `spazio` pausa · `1` normale (1 s = 5 minuti) · `2` veloce (1 ora al secondo) · `3` velocissimo (1 giorno) · `4` turbo (1 settimana) |
| Annulla / chiudi | `Esc` |

Per costruire una linea: tieni premuto il tasto sinistro e trascina; prima di lasciare vedi il tracciato e il costo.

## Primi passi

1. Clicca sul pulsante della stazione, scegli le dimensioni e mettila in una città (il riquadro azzurro è il bacino
   da cui arrivano passeggeri e merci).
2. Mettine un'altra in una seconda città e collegale con 🛤️. Il binario deve passare **sopra** una casella della
   stazione (o finirci): passarle accanto non basta.
3. Clicca su una stazione → «Compra un treno» → «Aggiungi fermate» → clicca sull'altra stazione.

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
