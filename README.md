# Meewind

Windoptimierter Rennrad-Routenplaner für Touren in den Niederlanden
(Domain: meewind.cc). Modul 1 des größeren Projekts "Sport-App"
(Routenplanung → später Garmin/Strava-Export und Trainingsdaten-Auswertung).

Kernversprechen: mit dem Wind fahren, nicht dagegen. Windoptimierung ist das
Herzstück (siehe Landingpage-Sektion "wind"), Knotenpunkt-Routen,
Zielvorschläge, Signature-Routen und GPX-Export sind die vier Werkzeuge
darum herum.

## Features

- Startpunkt per Adresssuche (Nominatim) oder Klick auf die Karte
- Rundtour oder One-Way mit Zugrückfahrt-Info
- Distanz-Ziel per Slider, Routing entlang des niederländischen
  Fietsknooppuntennetzes (`rcn_ref`-Knoten aus OpenStreetMap via Overpass API)
- Straßen-/Wegführung über OSRM (Rad-Profil), asphaltiert statt Schotter
- Wind-Visualisierung: Kompass-Overlay auf der Karte (Richtung + Stärke) und
  die Route selbst ist segmentweise nach Rückenwind (grün) / Gegenwind (rot)
  eingefärbt
- Wind-Optimierung: vergleicht beide Fahrtrichtungen einer Rundtour und wählt
  die, bei der der zweite (anstrengendere) Streckenteil mehr Rückenwind hat
  (Wind-Daten von [Open-Meteo](https://open-meteo.com), kein API-Key nötig)
- Prioritäten-Regler (wenig Ampeln, viel Natur/Wasser, viele Cafés/POIs,
  kürzeste Zeit, maximaler Rückenwind), die in die Knotenpunkt-Auswahl
  einfließen statt einer reinen Distanz-Heuristik
- **Richtung** (Rundtour): optionale Kompass-Richtung (N/NO/O/SO/S/SW/W/NW),
  um gezielt aufs Land hinauszufahren statt immer rund um den Startpunkt zu
  kreisen (siehe "Direction-biased Rundtouren" unten)
- **5 Routen-Varianten** (Rundtour): auf Wunsch werden statt einer einzelnen
  Route gleich 5 unterschiedliche Vorschläge berechnet (verschiedene
  Richtungen bzw. Streuung um die gewählte Richtung) und als Kartenvorschau
  + Distanz/Zeit zur Auswahl angezeigt
- One-Way + Zug in zwei Modi:
  - **Ziel eingeben**: Adresssuche fürs Ziel, danach normale Routenberechnung
  - **Ziel offen / Vorschläge**: sucht Orte (`place=city/town/village`) im
    gewünschten Distanz-Radius und rankt sie per Attraktivitäts-Score (siehe
    unten) statt nach reiner Ortsgröße — auch kleine Dörfer können also
    vorne landen, wenn sie gut abschneiden. Für die besten 3–4 Kandidaten
    gibt es eine Kurzbeschreibung + Bild von Wikipedia, eine kleine
    eingebettete Kartenvorschau mit der Route dorthin, und eine Begründung
    (Distanz, Rückenwind-Ausrichtung, Bahnhof vor Ort)
  - **Landschafts-Route**: kuratierte Liste von ~20 landschaftlich reizvollen
    NL-Korridoren (Dünen/Küste, Wald, Polder, Heide/Moor, Heuvelland,
    Fluss/Meer), filterbar nach Landschaftstyp. Bei Auswahl wird die Route
    komplett umgedreht geplant: Zug von Zuhause zum Korridor-Einstiegsbahnhof,
    dann eine Rad-Route innerhalb des Korridors zu einem passenden Ausstiegsort
    (unter Berücksichtigung der Prioritäten-Regler), dann Zug zurück
  - Alle drei Modi nutzen die NS-API für die Zugverbindungs-Prüfung
- **Signature-Route** (dritter Tourtyp, neben Rundtour und One-Way + Zug):
  kuratierte Liste von 19 real existierenden, bekannten NL-Rundtouren
  (Amstelroute, Amstel Gold Race Loop, Zeeländische-Wind-Route, ...) über
  5 Provinzen, filterbar nach Landschaftstyp (dieselben Kategorien wie bei
  "Landschafts-Route"). Liegt der eigene Standort weit von der gewählten
  Tour entfernt, wird eine Zuganreise zum nächsten Bahnhof der Tourregion
  vorgeschlagen; liegt er in der Nähe, geht's direkt von dort los. Die
  Distanz der Originaltour wird beim Auswählen als Ziel-Distanz übernommen,
  die Feinroute aber dynamisch über Knotenpunkte/OSRM berechnet — kein
  stures Nachfahren der Original-Wegpunkte
- POIs entlang der Route: Tankstelle, Supermarkt, Eisdiele, Café
- GPX-Export (Track + POI-Waypoints) für Garmin Connect / Strava
- Mobile-first responsives Layout

## Architektur

Routing: `src/app/[locale]/` trägt alle Seiten (next-intl-Locale-Präfix),
`src/app/api/*` bleibt außerhalb von `[locale]` (Route Handlers, kein
Locale-Präfix in der URL — die aufrufende Seite schickt `locale` explizit als
Body-Feld/Query-Param mit, siehe "Mehrsprachigkeit" unten).

- `src/app/[locale]/page.tsx` – Meewind-Landingpage (Design "Deichgrün":
  dunkelgrüner Hintergrund, Archivo/IBM Plex Sans, Limonengrün-Akzent,
  schräge Clip-Path-Elemente), mit Hero, eigenständiger Wind-Sektion, 01–04
  Feature-Grid (Knotenpunkt-Routen / Zielvorschläge / Signature-Routen /
  GPX-Export) und Signup-CTA zum Planer
- `src/app/[locale]/planner/page.tsx` – der eigentliche Routenplaner (vormals
  `src/app/page.tsx`)
- `src/proxy.ts` – next-intl-Locale-Routing. Next.js 16 hat die
  `middleware.ts`-Datei-Konvention in `proxy.ts` umbenannt (`middleware` /
  `proxy`-Funktion); next-intls `createMiddleware()`-Factory funktioniert
  unter dem neuen Namen unverändert weiter.

### Design-Tokens ("Deichgrün")

Farben/Typografie liegen als CSS-Variablen in `src/app/globals.css`
(Tailwind-v4-`@theme`-Block: `--color-meewind-bg`, `--color-meewind-accent`,
etc., als `oklch()`-Werte direkt aus der Design-Vorlage übernommen, nicht
nach Hex konvertiert) statt als Inline-Styles — sowohl Landingpage als auch
Planer nutzen dieselben Klassen (`bg-meewind-bg`, `text-meewind-accent`,
`.meewind-display`, `.meewind-clip`, …) für einen einheitlichen Look.
Schriften (Archivo, IBM Plex Sans) werden über `next/font/google` in
`src/app/[locale]/layout.tsx` geladen.

### Mehrsprachigkeit (DE/EN/NL)

[next-intl](https://next-intl.dev) mit Locale-Routing (`de` als Default ohne
Präfix, `/en`, `/nl`); Konfiguration in `src/i18n/routing.ts` /
`src/i18n/request.ts`, Übersetzungen in `messages/{de,en,nl}.json`
(Namespaces: `meta`, `nav`, `landing`, `planner`, `api`).

Dynamisch generierte Inhalte laufen außerhalb der React-Baumstruktur (API
Route Handlers, `src/lib/*.ts`) und können next-intls React-Hooks daher nicht
direkt nutzen:

- **API-Fehlermeldungen** (Validierung/Catch-all in `src/app/api/*/route.ts`):
  `getTranslations({ locale, namespace: "api" })` aus `next-intl/server`,
  Locale kommt explizit aus `body.locale` (POST) bzw. `?locale=` (GET) —
  aufgelöst über `src/lib/resolveLocale.ts`.
- **Windbegründung, POI-Kategorien, Routenplaner-/OSRM-/NS-Fehlertexte**:
  `src/lib/i18nStrings.ts` bündelt Locale-Dictionaries für alles, was tief in
  `wind.ts`/`overpass.ts`/`osrm.ts`/`ns.ts`/`routePlanner.ts` erzeugt wird;
  jede betroffene Funktion nimmt zusätzlich einen `locale`-Parameter
  (Default `"de"`) entgegen, der von der aufrufenden API-Route durchgereicht
  wird.
- **Kuratierte Beschreibungen** (Signature-Routen, Landschafts-Korridore):
  `src/lib/curatedTranslations.ts` hält EN/NL-Übersetzungen der
  Originalbeschreibungen aus `signatureRoutes.ts`/`scenicCorridors.ts`
  (Deutsch bleibt Quellsprache); `signatureRoutesForLocale()` /
  `scenicCorridorsForLocale()` liefern die Liste mit lokalisiertem
  `description`-Feld an die jeweilige API-Route.

Der Client schickt seine aktuelle Locale (`useLocale()` aus `next-intl`) bei
jedem `apiClient.ts`-Aufruf mit, damit Server-Antworten (Fehlermeldungen,
Windbegründung, kuratierte Listen) zur UI-Sprache passen.

### Fotos auf der Landingpage

Die "FOTO —"-Platzhalter der Design-Vorlage sind durch royalty-free
Unsplash-Bilder ersetzt (`src/components/PlaceholderPhoto.tsx`), passend zu
NL-Rennrad-/Deich-/Küsten-Motiven über Unsplashs Keyword-Redirect-Endpunkt
(keine feste Foto-ID hinterlegt). Lädt ein Bild nicht, blendet ein
`onError`-Handler es geräuschlos aus und der Deichgrün-Akzent-Hintergrund
bleibt sichtbar. Eigene Fotos lassen sich 1:1 einsetzen, indem einfach der
`src`-Prop pro `<PlaceholderPhoto>`-Aufruf in `src/app/[locale]/page.tsx`
ersetzt wird.

Server-Routen unter `src/app/api/*` (Route Handlers, kein `[locale]`-Präfix)
dienen als Proxy zu den externen Diensten (nötig um Nominatim/NS-Header bzw.
API-Keys nicht im Browser offenzulegen):

| Route | Zweck | Externer Dienst |
|---|---|---|
| `POST /api/plan` | Route generieren (Knotenpunkte + OSRM + Wind) | Overpass, OSRM, Open-Meteo |
| `GET /api/geocode` | Adresssuche | Nominatim |
| `POST /api/pois` | POIs entlang der Route | Overpass |
| `GET /api/weather` | Wind-Vorschau für Datum/Ort | Open-Meteo |
| `GET /api/train` | Zugrückfahrt für One-Way-Touren | NS Reisinformatie API |
| `POST /api/destinations` | Zielvorschläge (Modus B) | Overpass, Wikipedia, NS, Open-Meteo |
| `GET /api/scenic-corridors` | Statische Korridor-Liste (Landschafts-Route) | – (keine externen Calls) |
| `POST /api/scenic-route` | Landschafts-Route komplett planen | Overpass, OSRM, NS, Open-Meteo |
| `GET /api/signature-routes` | Statische Signature-Routen-Liste | – (keine externen Calls) |
| `POST /api/signature-route` | Signature-Route komplett planen | Overpass, OSRM, NS |

Kernlogik in `src/lib/`:
- `routePlanner.ts` – wählt Knotenpunkte rund um den Start (Rundtour) bzw.
  entlang einer festen Ziel-Richtung (One-Way) und lässt sie über OSRM
  verbinden; passt die Auswahl iterativ an, bis die Zieldistanz (±20%)
  erreicht ist. Die Kandidatenwahl je Sektor/Schritt ist ein gewichteter Score
  aus Distanz-Passung und den Prioritäten-Reglern (siehe unten)
- `wind.ts` – Rückenwind-Bewertung beider Fahrtrichtungen, plus
  `tailwindComponent`/`tailwindColor` fürs Kompass-Overlay und die
  Streckeneinfärbung im Frontend
- `overpass.ts` / `osrm.ts` / `nominatim.ts` / `ns.ts` / `wikipedia.ts` –
  Clients für die externen APIs
- `scenicCorridors.ts` – die kuratierte Korridor-Liste (Modus "Landschafts-Route")
- `signatureRoutes.ts` – die kuratierte Liste bekannter NL-Rundtouren (Modus "Signature-Route")
- `gpx.ts` – GPX-Generierung

### One-Way-Routing: Fortschritt statt reiner Distanz-Heuristik

Für Touren mit festem Ziel (Modus "Ziel eingeben"/"Ziel offen" sowie intern
bei Landschafts-/Signature-Routen) wird jeder Knotenpunkt-Hop relativ zum
*zuletzt gewählten* Punkt bestimmt, nicht relativ zum ursprünglichen Start.
Ein Kandidat wird nur akzeptiert, wenn er (mit kleiner Toleranz für einen
attraktiven Abstecher) näher am Ziel liegt als der vorherige Hop, zusätzlich
zu einer Richtungs-Prüfung relativ zum aktuellen Punkt. Ohne diese
Fortschritts-Prüfung konnte ein späterer Hop geografisch hinter einem
früheren landen (er passte nur zufällig zur "richtigen Distanz vom
ursprünglichen Start"), was OSRM beim Verbinden der Punkte in Auswahl-
Reihenfolge als Schleife/Zickzack auflöste — sichtbar z. B. bei
Amsterdam→Groningen als Bogen zurück Richtung Almere. Mit synthetischen
Testdaten verifiziert: eine absichtlich "hinter" platzierte Testroute wird
auch bei künstlich maximiertem Attraktivitäts-Score nicht mehr gewählt.

### Direction-biased Rundtouren & 5 Routen-Varianten

Ohne gewählte Richtung verteilt `selectRoundTripNodes` (in `routePlanner.ts`)
einen Knotenpunkt pro Bearing-Sektor über den vollen 360°-Kreis um den Start
— das liefert zuverlässig eine geschlossene Schleife, liest sich bei
Startpunkten in/nahe einer Großstadt (z. B. Amsterdam) aber wie "im Kreis um
die Stadt fahren" statt "irgendwohin fahren". Mit gewählter Richtung wird
stattdessen nur ein ±75°-Kegel um die gewählte Kompass-Richtung betrachtet
und der Ziel-Radius für eine Hin-und-zurück-Form berechnet (deutlich weiter
draußen als beim Vollkreis-Radius derselben Distanz) — die Route fährt
spürbar in eine Richtung hinaus und schleift sich am Ende wieder zurück,
statt eng um den Start zu kreisen.

`planRoundTripAlternatives()` nutzt denselben Knotenpunkt-Pool/Feature-Fetch
(ein Overpass-Roundtrip statt fünf) und berechnet parallel (mit begrenzter
Nebenläufigkeit, um den öffentlichen OSRM-Dienst nicht zu überlasten) fünf
Varianten: ohne gewählte Richtung fünf gleichmäßig über den Kompass verteilte
Richtungen, mit gewählter Richtung fünf leicht gestreute Varianten um sie
herum (±30°). `/api/plan-alternatives` liefert sie mit Distanz/Zeit und
Kartenvorschau an `RouteAlternativesPicker` im Frontend, wo eine davon direkt
übernommen werden kann.

### Wie die Prioritäten-Regler wirken

Es gibt keinen vollständigen gewichteten Shortest-Path über das komplette
Knooppunten-Netz (das wäre ein deutlich größeres Projekt) — stattdessen
fließen die Regler in die bestehende Sektor-/Schritt-Heuristik ein:

- **Wenig Ampeln**, **viel Natur/Wasser**, **viele Cafés/POIs**: Für jeden
  Kandidaten-Knotenpunkt werden einmalig Overpass-Querys über Ampeln/
  Kreuzungen, Wasser/Wald, Cafés/Eisdielen sowie `tourism=*`/`historic=*`-Tags
  im Suchradius geladen. "Natur/Wasser" kombiniert dabei eine Dichte-Zählung
  (Wasser+Wald im Umkreis) mit einer Distanz-Zerfallsfunktion zum nächsten
  Wasser-Feature — dieselbe Formel wie beim Attraktivitäts-Score der
  Zielvorschläge (siehe unten). "Cafés/POIs" kombiniert analog Café/
  Eisdielen-Dichte mit Sehenswürdigkeiten-Dichte. So bevorzugt die Route
  Wasser/Sehenswürdigkeiten in der Nähe, ohne dass die Distanz-Passung (die
  immer mit Basisgewicht 1 einfließt) dafür einen großen Umweg zulässt — die
  Werte fließen direkt in die Kandidaten-Bewertung pro Sektor/Schritt ein.
- **Kürzeste Zeit**: erhöht das Gewicht der Distanz-Passung gegenüber den
  anderen Kriterien und reduziert die Anzahl der Zwischenstopps (weniger
  Umwege) sowie – bei One-Way – den erlaubten Umweg-Faktor zum Ziel.
- **Maximaler Rückenwind**: bei Rundtouren wird damit gesteuert, wie stark
  die Wahl der Fahrtrichtung den zweiten (anstrengenderen) Streckenteil
  gewichtet; bei "Ziel offen"-Vorschlägen fließt die Windausrichtung
  zusätzlich in die Bewertung der Zielorte ein.

### Attraktivitäts-Score für Zielvorschläge (Modus B)

Statt eines reinen `place=city/town`-Größenfilters fließen in den Score pro
Kandidat ein:

- **Distanz-Passung** zur Zieldistanz (wie zuvor)
- **Rückenwind-Ausrichtung** vom Start zum Ort, gewichtet mit dem
  "Maximaler Rückenwind"-Regler (wie zuvor)
- **Tourismus/Historie-Dichte**: Anzahl `tourism=*`- und `historic=*`-Tags
  im Ortskern (900 m Radius), eine Overpass-Abfrage über alle Kandidaten
  gleichzeitig (je ein eigener Umkreis pro Ort, keine Linien-Suche zwischen
  ihnen)
- **Wassernähe**: Abstand zum nächsten Wasser-Feature (gleiche
  Wasser-Layer-Definition wie bei den Prioritäten-Reglern: `natural=water`
  und `waterway=*`), als Distanz-Zerfallsfunktion statt fixem Radius
- **Wikipedia-Bekanntheits-Proxy**: Länge des Artikel-Extracts +
  Anzahl Sprachversionen (`langlinks`)

Da NL sehr dorfdicht ist, werden vor dieser (teureren) Bewertung zunächst nur
die 20 distanz-nächsten Kandidaten betrachtet (`PRESCORE_CANDIDATE_CAP` in
`src/app/api/destinations/route.ts`) — das begrenzt die Overpass-/
Wikipedia-Anfragen, ohne dass kleine, aber attraktive Orte grundsätzlich
ausgeschlossen werden.

Das Akzeptanzfenster um die Zieldistanz ist ein absoluter Toleranzwert
(±15 km), kein Prozentsatz der Zieldistanz — ein Prozentsatz wird bei langen
Touren unnötig breit und bei kurzen unnötig eng, und in Gegenden mit dünner
`place=town/village`-Taggierung kann er komplett leer bleiben, obwohl
brauchbare Orte nur knapp außerhalb liegen. Findet sich bei ±15 km nichts,
weitet `DISTANCE_TOLERANCE_STEPS_M` das Fenster schrittweise auf ±25 km,
dann ±40 km, statt einfach eine leere Liste zurückzugeben.

### Landschafts-Route: Ablauf

Dieser Modus dreht den üblichen Ablauf um — die Radstrecke startet nicht am
eigenen Zuhause, sondern am Korridor selbst:

1. Einstiegsbahnhof wird per NS-API zum Korridor-Zentrum aufgelöst
   (`findNearestStation`); ohne NS-Key wird ersatzweise das Korridor-Zentrum
   direkt verwendet.
2. Ausstiegsort wird gesucht: Overpass liefert Orte (`place=city/town/village`)
   im Korridor-Umkreis, die mindestens die halbe Korridor-Ausdehnung vom
   Einstieg entfernt liegen (damit die Fahrt den Korridor tatsächlich
   durchquert); bewertet werden sie mit denselben Prioritäten-Reglern
   (Ampeln/Natur/POIs) plus Distanz-Passung zur gewünschten Fahrlänge und
   Rückenwind-Ausrichtung.
3. Die eigentliche Radroute (Einstieg → Ausstieg) läuft über exakt dieselbe
   `planRoute()`-Funktion wie Modus A/B (One-Way mit festem Ziel) — keine
   separate Routing-Logik nötig.
4. Zugverbindungen Hin- (Zuhause → Einstieg) und Rückfahrt (Ausstieg →
   Zuhause) werden über die NS-API abgefragt.

### Signature-Route: Ablauf

- Die Liste im Frontend wird nach Entfernung des eigenen Startpunkts zum
  Tour-Zentrum sortiert (nächste zuerst) und zeigt pro Karte die Distanz
  sowie einen Hinweis, ob direkt losgefahren wird oder eine Zug-Anreise
  vorgeschlagen wird — alle 19 Touren bleiben wählbar, aber es ist auf den
  ersten Blick klar, welche in der Nähe liegen.
- Liegt der eigene Startpunkt mehr als 25 km (`FAR_THRESHOLD_M` in
  `src/app/api/signature-route/route.ts`) vom Zentrum der gewählten Tour
  entfernt, wird deren nächstgelegener Bahnhof per NS-API aufgelöst und
  als Anker für die Rundtour verwendet, inkl. Hin- und Rückfahrt-Info
  (Zuhause ↔ Bahnhof). Andernfalls wird direkt am eigenen Standort
  angesetzt, ganz ohne Zug.
- In beiden Fällen läuft die eigentliche Rundtour über dieselbe
  `planRoute()`-Funktion (Modus Rundtour) wie beim normalen "Rundtour"-Tourtyp
  — auch hier fließen die Prioritäts-Regler normal ein.
- Beim Auswählen einer Tour mit bekannter Original-Distanz wird der
  Distanz-Slider automatisch darauf gesetzt (nicht die exakten
  Original-Wegpunkte werden nachgefahren, nur die Ziel-Kilometerzahl).
  Touren ohne dokumentierte Distanz ("variabel" in der Quellliste) behalten
  den zuletzt eingestellten Slider-Wert.

### Bekannte Vereinfachungen

- Die Routenauswahl nutzt die Positionen der Knotenpunkte (`rcn_ref`-Nodes),
  nicht das vollständige topologische Knooppunten-Netz (die tatsächlichen
  Radweg-Kanten zwischen den Knotenpunkten, wie sie z. B. auf Beschilderung
  und Fietsknoop-Apps zu sehen sind). OSRM übernimmt das eigentliche
  Straßenrouting zwischen den gewählten Knotenpunkten, daher ist die Strecke
  immer befahrbar und asphaltiert-tauglich, folgt aber nicht zwingend exakt
  der offiziellen Knooppunkten-Route. Eine spätere Ausbaustufe könnte die
  `route=bicycle`-Relationen (`network=rcn`) auswerten, um dem echten Netz
  zu folgen.
- Wind wird als ein repräsentativer Tageswert (Ø 09–16 Uhr) behandelt, nicht
  segmentweise zu unterschiedlichen Uhrzeiten entlang der Fahrt.
- Zielvorschläge (Modus B) matchen Ortsnamen 1:1 gegen Wikipedia-Titel;
  manche Orte liefern daher keine Beschreibung/Bild (wird als `null`
  behandelt, kein harter Fehler).
- Die Kartenvorschau auf jeder Vorschlagskarte zeigt eine direkte
  OSRM-Verbindung Start→Ziel (schnell zu berechnen für 4 Kandidaten
  parallel), nicht die finale Knotenpunkt-basierte Route — die kann nach
  Auswahl und tatsächlicher Planung etwas anders verlaufen.
- Die Korridor-Daten (Zentrum, Radius, Einstiegsbahnhof-Name) in
  `scenicCorridors.ts` sind von Hand kuratiert und geografisch als
  "ungefähr" gedacht, keine vermessenen Polygone. Der tatsächlich für die
  Routenplanung verwendete Bahnhof wird zur Laufzeit live per NS-API zum
  Korridor-Zentrum aufgelöst, ist also von der Genauigkeit des Zentrums,
  nicht des Namensfelds, abhängig — vor Verlass auf einen bestimmten Ort
  gegenprüfen.
- Die Landschafts-Route erfordert keinen Wikipedia-Abgleich (wie gewünscht),
  daher gibt es dort keine Bild-/Text-Vorschau wie bei Modus B, nur Name,
  Landschaftstyp und die kuratierte Kurzbeschreibung.
- Die Signature-Routen-Liste (`signatureRoutes.ts`) wurde aus einer
  recherchierten Community-Quellliste (Komoot, Outdooractive, AllTrails,
  Zeeland.com) transkribiert; Distanzen sind Richtwerte der Originaltouren
  (Bereichsangaben wurden auf einen Mittelwert reduziert), Start-Koordinaten
  sind aus den genannten Regionen/Orten grob geschätzt, keine vermessenen
  Polygone oder exakten Startpunkte.
- Die Kartenvorschau auf den Signature-Routen-Karten zeigt einen
  synthetischen Kreis um das Tour-Zentrum (Umfang = Original-Distanz bzw.
  50 km bei "variabel"), keine echte Route — das würde für 19 Einträge in
  einer passiv durchsuchbaren Liste 19 zusätzliche Overpass-/OSRM-Aufrufe
  bedeuten, nur um eine Vorschau zu zeigen.

## Setup

```bash
npm install
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000) für die Landingpage,
[http://localhost:3000/planner](http://localhost:3000/planner) für den
Planer direkt. Sprache wechseln über `/de`/`/en`-Präfix (z. B.
`/de/planner`) — Niederländisch (`nl`) ist Standard ohne Präfix
(`defaultLocale` in `src/i18n/routing.ts`).

### Umgebungsvariablen

Kopiere `.env.example` zu `.env.local` und ergänze bei Bedarf:

```
NS_API_KEY=
```

- **Ohne `NS_API_KEY`**: Die App läuft normal, die Zugrückfahrt-Funktion
  zeigt einen Hinweis, dass der Key fehlt.
- **Mit `NS_API_KEY`**: Kostenlos registrieren auf
  [apiportal.ns.nl](https://apiportal.ns.nl), Abo für die
  "Reisinformatie API" aktivieren, Subscription-Key hier eintragen.
  Die NS-Anbindung (`src/lib/ns.ts`) wurde nach der öffentlichen API-Doku
  gebaut, aber noch nicht gegen einen echten Key getestet — bei Bedarf
  Endpunkte/Feldnamen dort verifizieren.

Overpass, OSRM und Open-Meteo benötigen keine Keys.

### Umgang mit Overpass-Überlastung (429/502/503/504)

Der öffentliche Overpass-Dienst (overpass-api.de, lz4.overpass-api.de) ist
ein geteilter Community-Server ohne SLA und reagiert bei hoher Last mit
429 (Rate-Limit) oder 502/503/504 (überlastet/Gateway-Timeout). `runOverpassQuery`
in `src/lib/overpass.ts` geht damit so um:

- Bei 429 wird einmal mit kurzer Wartezeit (Retry-After-Header oder 2s
  Standard) auf demselben Server erneut versucht, bevor zum zweiten Mirror
  gewechselt wird — Rate-Limits erholen sich meist innerhalb weniger Sekunden.
- Bei 502/503/504 wird sofort zum nächsten Mirror gewechselt statt erneut zu
  versuchen, da eine überlastete/zu komplexe Anfrage durch sofortiges
  Wiederholen selten schneller wird.
- Fehlermeldungen zeigen nicht mehr die rohe HTML-Fehlerseite an (nur
  störender Markup-Müll), sondern eine kurze Status-Erklärung, plus einen
  Hinweis "Bitte in ein paar Sekunden erneut versuchen", wenn alle Fehler auf
  Überlastung hindeuten.
- `routePlanner.ts` fasst die Overpass-Abfragen für Knotenpunkte-Auswahl
  (Ampeln/Wasser/Wald/Cafés + Sehenswürdigkeiten) in zwei statt drei
  Anfragen zusammen (`fetchAreaFeatures(..., includeAttractions=true)`), um
  die Serverlast pro Routenplanung zu reduzieren.

Das sind Abmilderungen, keine Garantie — bei anhaltender Überlastung des
öffentlichen Dienstes hilft nur Warten oder ein eigener (selbst gehosteter
oder kommerzieller) Overpass-Endpunkt.

### Performance: ein OSRM-Request statt vieler pro Route

`routeChain()` in `src/lib/osrm.ts` schickte früher pro Etappe eine eigene,
sequenzielle OSRM-Anfrage (`for`-Schleife mit `await` pro Hop) — bei 6–10
Knotenpunkten plus bis zu drei weiteren vollständigen Neu-Routings im
Distanz-Verfeinerungs-Loop in `planRoute()` (`finalizeRoute()`) lief das auf
20–40+ sequenzielle HTTP-Requests pro Routenplanung hinaus und war der
Hauptgrund für lange Wartezeiten. OSRMs Route-Service akzeptiert beliebig
viele Wegpunkte in einem einzigen Request (`steps=true` liefert dabei pro
Etappe Distanz/Zeit sowie die Turn-by-turn-Geometrie, aus der die
Etappen-Geometrie fürs Rückenwind-Einfärben der Karte zusammengesetzt wird)
— jetzt reicht ein Request pro Verfeinerungs-Durchlauf.

### Hinweis zur Entwicklungsumgebung

In manchen Sandbox-/CI-Umgebungen ist ausgehender Netzwerkzugriff auf
Drittanbieter-APIs (Overpass, OSRM, Nominatim, Open-Meteo) aus
Sicherheitsgründen blockiert. Die App selbst ist davon nicht betroffen —
nach dem Deployment (z. B. Vercel) mit normalem Internetzugriff funktionieren
alle Live-Aufrufe.

## Deployment

Empfohlen: [Vercel](https://vercel.com/new). `NS_API_KEY` als Environment
Variable im Vercel-Projekt hinterlegen, falls vorhanden.

## Nächste Schritte

- Vollständiges Knooppunten-Netz (Relationen statt nur Knoten) für exaktere
  Streckenführung
- KNMI Open Data API als Alternative/Ergänzung zu Open-Meteo
- Modul 2: Trainingsdaten-Auswertung via `python-garminconnect`
  (separates Backend/Cronjob, da inoffizielle Bibliothek mit eigenem
  Garmin-Login arbeitet)
