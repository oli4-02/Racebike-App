# Rennrad-Routenplaner NL

Persönlicher Rennrad-Routenplaner für Touren in den Niederlanden. Modul 1
des größeren Projekts "Sport-App" (Routenplanung → später Garmin/Strava-Export
und Trainingsdaten-Auswertung).

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
- POIs entlang der Route: Tankstelle, Supermarkt, Eisdiele, Café
- GPX-Export (Track + POI-Waypoints) für Garmin Connect / Strava
- Mobile-first responsives Layout

## Architektur

Next.js (App Router) mit serverseitigen API-Routes unter `src/app/api/*`, die
als Proxy zu den externen Diensten dienen (nötig um Nominatim/NS-Header bzw.
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
- `gpx.ts` – GPX-Generierung

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

## Setup

```bash
npm install
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000).

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
