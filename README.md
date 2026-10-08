# Rotaie & Rotte

Un gioco di **strategia dei trasporti** nel browser, ispirato ai classici come *Railroad Tycoon*:
si guida una compagnia che costruisce **ferrovie**, **strade**, **autostrade** e **aeroporti**,
compra treni, autobus, camion e aerei e trasporta passeggeri e merci fra città inventate
che **crescono** grazie ai collegamenti.

**Gioca online: https://massimilianopetra.github.io/rotteerotaie/**

Codice: https://github.com/massimilianopetra/rotteerotaie

## Come si avvia

Apri `index.html` con un doppio clic (Chrome, Edge o Firefox). Non serve Internet e non serve installare nulla.

All'avvio si sceglie il nome della compagnia, l'anno di inizio (dal 1850 al 1980), la grandezza della mappa,
il numero di città e il **seme** del mondo (stesso seme = stesso mondo).

## Il gioco

- **Mappa vista dall'alto** generata a caso: mare, laghi, fiumi, pianure, colline, montagne e boschi.
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
- **Economia**: ogni consegna è pagata in base alla distanza e alla rapidità; ci sono costi di esercizio,
  manutenzione delle linee, guasti dei mezzi vecchi, prestiti con interesse e il bilancio di fine anno.
- **Salvataggio** nel browser (anche automatico ogni 1° gennaio).

## Comandi

| Azione | Comando |
|---|---|
| Spostare la mappa | trascinare col tasto destro (o sinistro con 🔍), frecce |
| Zoom | rotellina, tasti `+` e `−` |
| Strumenti | `I` info · `B` ferrovia · `R` strada · `U` autostrada · `T` stazione (apre il menu delle dimensioni) · `F` autostazione · `A` aeroporto · `X` demolisci |
| Finestre | `V` mezzi · `M` mondo · `E` finanze · `H` aiuto · `G` griglia |
| Tempo | `spazio` pausa · `1` normale (1 s = 5 minuti) · `2` veloce (1 ora al secondo) · `3` velocissimo (1 giorno) · `4` turbo (1 settimana) |
| Annulla / chiudi | `Esc` |

Per costruire una linea: tieni premuto il tasto sinistro e trascina; prima di lasciare vedi il tracciato e il costo.

## Primi passi

1. Clicca sul pulsante della stazione, scegli le dimensioni e mettila in una città (il riquadro azzurro è il bacino
   da cui arrivano passeggeri e merci).
2. Mettine un'altra in una seconda città e collegale con 🛤️. Il binario deve passare **sopra** una casella della
   stazione (o finirci): passarle accanto non basta.
3. Clicca su una stazione → «Compra un treno» → «Aggiungi fermate» → clicca sull'altra stazione.

## Modificare il gioco

Tutti i numeri del gioco (prezzi delle merci, costi, velocità e anni dei mezzi, industrie, pezzi dei nomi
delle città) sono in `dati/catalogo.js`, un file pensato per essere modificato a mano.

## Pubblicare su GitHub Pages

Il sito è servito dal ramo `gh-pages`: dopo `npm install` basta `npm run deploy`
(GitHub Pages impiega circa un minuto; nel browser ricaricare con Ctrl+F5).

## Licenza

GNU GPL v3 o successiva (vedi `LICENSE`).
