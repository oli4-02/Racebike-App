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
- Wind-Optimierung: vergleicht beide Fahrtrichtungen einer Rundtour und wählt
  die, bei der der zweite (anstrengendere) Streckenteil mehr Rückenwind hat
  (Wind-Daten von [Open-Meteo](https://open-meteo.com), kein API-Key nötig)
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

Kernlogik in `src/lib/`:
- `routePlanner.ts` – wählt Knotenpunkte rund um den Start (Rundtour) bzw.
  entlang einer Richtung (One-Way) und lässt sie über OSRM verbinden;
  passt die Auswahl iterativ an, bis die Zieldistanz (±20%) erreicht ist
- `wind.ts` – Rückenwind-Bewertung beider Fahrtrichtungen
- `overpass.ts` / `osrm.ts` / `nominatim.ts` / `ns.ts` – Clients für die
  externen APIs
- `gpx.ts` – GPX-Generierung

### Bekannte Vereinfachung

Die Routenauswahl nutzt die Positionen der Knotenpunkte (`rcn_ref`-Nodes),
nicht das vollständige topologische Knooppunten-Netz (die tatsächlichen
Radweg-Kanten zwischen den Knotenpunkten, wie sie z. B. auf Beschilderung und
Fietsknoop-Apps zu sehen sind). OSRM übernimmt das eigentliche Straßenrouting
zwischen den gewählten Knotenpunkten, daher ist die Strecke immer befahrbar
und asphaltiert-tauglich, folgt aber nicht zwingend exakt der offiziellen
Knooppunkten-Route. Eine spätere Ausbaustufe könnte die `route=bicycle`-
Relationen (`network=rcn`) auswerten, um dem echten Netz zu folgen.

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
