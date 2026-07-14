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
- POIs entlang der Route: Tankstelle, Supermarkt, Eisdiele, Café — die
  ausgewählten Kategorien beeinflussen jetzt auch die Knotenpunkt-Auswahl
  selbst (Rundtour/One-Way), nicht nur welche Marker angezeigt werden (siehe
  "POI-Kategorien beeinflussen die Routenwahl" unten)
- **Ø-Geschwindigkeit**: eigener Regler statt OSRM-Rad-Profil-Schätzung für
  die Fahrzeit-Anzeige, gilt für alle Tourtypen (siehe "Fahrzeit nach
  Ø-Geschwindigkeit" unten)
- **Straßentyp auf der Karte**: Umschalter zwischen Wind-Einfärbung und
  Straßentyp-Einfärbung (Radweg/Wohnstraße/Hauptstraße/Sonstige) direkt auf
  der Route, nicht nur als Aggregat-Balken (siehe "Straßentyp-Transparenz"
  unten)
- Anti-Stadt-Bias: Knotenpunkt-Auswahl meidet jetzt standardmäßig
  Wohn-/Gewerbe-/Industriegebiete, nicht nur bei hochgedrehtem
  Natur-Regler (siehe "Anti-Stadt-Bias" unten)
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

### Planer-UI: Karte als Hauptbühne, gestuftes Panel statt langer Formular-Liste

Die Planer-Seite (`src/app/[locale]/planner/page.tsx`) war ursprünglich eine
feste linke Sidebar (alle Formularfelder + Ergebnis untereinander) neben
einer 50/50-Karte. Das ist durch ein Google-Maps/Komoot-artiges Layout
ersetzt: die Karte (`RouteMap`) füllt den kompletten Viewport
(`absolute inset-0`), darüber schwebt ein kompaktes, einklappbares Panel
(`PlannerPanel.tsx`) — auf schmalen Viewports als Bottom-Sheet (`fixed
inset-x-0 bottom-0`, ~82vh hoch), auf breiteren als Karte oben links
(`md:top-4 md:left-4 md:w-[380px]`). Einklappen schrumpft in beiden Fällen
nur auf die Header-Zeile (nie die Breite), sodass dieselbe Klassenlogik für
beide Breakpoints reicht.

Der Panel-Inhalt war ursprünglich in drei Tabs gegliedert ("Wo & wie weit" /
"Deine Vorlieben" / "Ergebnis"); das ist inzwischen durch einen einzigen
Fluss ohne Tabs ersetzt (siehe "Zwei Eingaben statt Formular" unten) — die
Tabs zwangen dazu, erst durch mehrere Schritte zu klicken, bevor überhaupt
eine Route entstand. `PlannerPanel.tsx` selbst ist reine Hülle
(Header/Collapse/Footer-Slot, scrollbarer Inhaltsbereich) ohne eigenes
Domänenwissen; `page.tsx` setzt darüber `WhereStep` (Pflichtfelder),
`Collapsible` (Anpassen) und `ResultStep` in dieser Reihenfolge zusammen.

`PlannerForm.tsx` und `PrioritySliders.tsx` sind komplett entfernt — ihr
Inhalt lebt jetzt in `WhereStep.tsx`/`CustomizeSection.tsx`, `AppMode` ist
nach `lib/types.ts` gewandert (dort ohnehin schon `RouteMode` definiert).

**Wichtige Falle beim Bauen des Panels**: die Kopfzeile war zunächst selbst
ein `<button>` (klickbar zum Ein-/Ausklappen), das einen `Link` (Zurück zur
Startseite) und `LocaleSwitcher` (eigene `<button>`s) enthielt — ein
`<button>` darf aber keine anderen interaktiven Elemente enthalten
(HTML-Spezifikation); Browser räumen das ungültige Markup beim Parsen
still um, wodurch das clientseitig gerenderte DOM nicht mehr zum
serverseitigen passte (React-Hydration-Fehler #418) und das Panel nach dem
ersten Klick sichtbar kaputtging. Behoben, indem die Kopfzeile ein normales
`<div onClick=…>` ist und der Ein-/Ausklapp-Button ein eigenständiges,
nicht verschachteltes `<button>` daneben.

#### Eigene UI-Komponenten statt native Browser-Defaults

- `src/components/ui/Slider.tsx` — Verlaufs-gefüllte Spur (CSS-Custom-Property
  `--slider-pct`, damit der Fortschritt ohne JS-Zugriff auf Pseudo-Elemente
  gesetzt werden kann) und großer, farbiger Griff, browserübergreifend via
  `::-webkit-slider-*`- und `::-moz-range-*`-Pseudo-Elementen gestylt
- `src/components/ui/Select.tsx` — `<select>` bleibt nativ (Tastatur-/
  Screenreader-/Mobile-Verhalten eines selbstgebauten Listbox-Widgets ist ein
  echtes Accessibility- und iOS-Safari-Minenfeld), nur Chrome/Pfeil-Icon und
  Rahmen sind eigenständig gestaltet (`appearance-none` + eigenes SVG-Chevron)
- `src/components/ui/DateField.tsx` — nativer Date-Input bleibt aus demselben
  Grund erhalten, aber mit eigenem Icon/Rahmen/Fokus-Ring; Klick irgendwo im
  Feld öffnet den nativen Picker über `showPicker()` (mit Feature-Detection,
  da nicht in jedem Browser verfügbar)

#### Prioritäten-Presets statt Radar-Diagramm

Das ursprüngliche Radar-Diagramm (`PriorityRadar.tsx`, mittlerweile entfernt)
war zwar auf einen Blick lesbar, aber für die meisten Nutzer zu abstrakt —
man musste erst verstehen, was ein verzerrtes Fünfeck bedeutet, bevor man es
sinnvoll anpassen konnte. `PreferencesStep.tsx` zeigt stattdessen vier große,
klar beschriftete Preset-Kacheln ("Ruhig & Natur", "Schnell & direkt",
"Café-Tour", "Maximaler Rückenwind"), jede mit sinnvoll vorbelegten
Prioritäts-Werten für die vier Regler-Dimensionen (Ampeln/Kreuzungen, Natur,
kürzeste Zeit, Rückenwind) — ein Klick genügt. Darunter liegt ein
eingeklappter "Feinjustieren"-Bereich mit den vier Einzel-Reglern für alle,
die manuell justieren wollen. Presets und Regler teilen sich denselben
`priorities`-State (keine gespiegelte Kopie): eine Kachel schreibt direkt in
die Regler-Werte, und `isActivePreset()` vergleicht bei jedem Render, ob die
aktuellen Regler-Werte exakt einem der vier Presets entsprechen — trifft das
zu, wird die passende Kachel hervorgehoben, sonst keine (manuell abweichende
Werte gelten als "eigene Einstellung", ohne aktive Kachel). Dadurch bleiben
Kacheln und Feinjustierung immer konsistent, unabhängig davon, in welcher
Reihenfolge der Nutzer sie bedient.

### Ergebnis-Hero: Region-Foto, große Windgrafik, zwei große Kennzahlen

Das Ergebnis zeigte bisher nur Zahlen (Distanz, Zeit, Knotenpunkte,
Windtext) direkt untereinander. `ResultHero.tsx` (gerendert von
`ResultStep.tsx` direkt über der weiterhin bestehenden `RouteSummary`) macht
daraus eine visuell stärkere erste Ansicht:

- **Region-Foto** (`RegionPhoto.tsx`): anders als die kuratierten
  Landingpage-Fotos kann dieses Bild nicht vorher von Hand ausgesucht
  werden — die Route kann überall in NL/BE liegen. `fetchNearbyRegionImage()`
  (in `lib/wikipedia.ts`) nutzt Wikipedias `geosearch` als Generator
  (`generator=geosearch&ggscoord=…`) um den geografischen Mittelpunkt der
  Routen-Geometrie herum, kombiniert mit `prop=pageimages`, und nimmt den
  ersten Treffer, der tatsächlich ein Thumbnail hat (nicht jeder nahegelegene
  Artikel hat eins). Best-effort über `/api/region-image`: kein Treffer oder
  ein fehlgeschlagener Bild-Load blendet die Komponente einfach aus, statt
  einen Fehlerzustand zu zeigen.
- **Große Windgrafik**: derselbe Pfeil-Kompass-Gedanke wie der kleine
  `WindCompassOverlay` auf der Karte, aber deutlich größer und direkt im
  Ergebnis-Panel neben den Kennzahlen platziert (`route.windInfo`, für beide
  Modi verfügbar) statt nur als kleines Karten-Overlay in der Ecke; bei
  Rundtouren ergänzt um den vorhandenen Begründungstext
  (`route.wind?.explanation`).
- **Zwei große Kennzahlen**: Distanz und Fahrzeit werden jetzt groß
  (`text-2xl font-bold`) direkt nebeneinander dargestellt, statt als eine
  von mehreren gleich großen Zeilen. `RouteSummary` selbst zeigt nur noch
  Knotenpunkte, Straßentyp-Aufteilung und GPX-Export — die Distanz-/
  Zeit-/Windzeilen wurden dort entfernt, um Dopplung zu vermeiden.

### "Stopps planen": gezielte POI-Suche pro Streckenabschnitt

Die bisherige generische "Viele Cafés/POIs"-Priorität (`poiDensity`) wurde
aus der UI entfernt und beeinflusst die Routenwahl (`scoreCandidate()` in
`routePlanner.ts`) nicht mehr — sie war zu unspezifisch ("irgendwo mehr
POIs am Wegesrand" statt "ich will an einem bestimmten Punkt der Tour
einen Kaffee trinken"). Stattdessen kann der Nutzer im "Vorlieben"-Tab
1–3 konkrete Stopps definieren (`StopRequest` in `types.ts`): pro Stopp ein
Kategorie-Dropdown (Café/Eisdiele/Supermarkt/Tankstelle) und ein
Doppelgriff-Streckenanteil-Slider (`RangeSlider.tsx`, z. B. 40–60 %) —
bewusst als Prozent-Spanne der Gesamtstrecke, nicht als fixe km-Angabe, da
sich die tatsächliche Distanz durch Knotenpunkt-Rundung noch leicht
verschieben kann.

Sobald eine Route berechnet ist, filtert `StopCandidates.tsx` die bereits
für die Route geladenen POIs (kein zusätzlicher Overpass-Request) auf
genau das Streckenanteil-Fenster jedes Stopps: `routeFraction()` (in
`geo.ts`) ermittelt dafür den nächstgelegenen Routen-Vertex zu einem POI
und teilt dessen kumulierte Distanz entlang der Route durch die
Gesamtlänge (0–1) — eine Näherung über den nächsten Vertex, keine exakte
Projektion auf das Liniensegment. Die bis zu 4 Kandidaten je Stopp, die dem
Fenster-Mittelpunkt am nächsten liegen, werden zur Auswahl angezeigt; die
Wahl des Nutzers erscheint auf der Karte mit einem eigenen Stern-Marker
und wird beim GPX-Export mit "⭐ " im Namen hervorgehoben. Die einfachen
POI-Kategorie-Toggle (Kartenmarker-Anzeige) bleiben unverändert bestehen,
sind aber bewusst unabhängig von der Stopp-Planung — ein Toggle steuert nur
die Sichtbarkeit auf der Karte, ein Stopp steuert die gezielte Suche.

### "Große Straßen vermeiden": Best-Effort-Ausschluss statt Gewichtung

Ein Schalter im "Vorlieben"-Tab schließt beim Aktivieren die OSM-Straßen-
klassen `primary`, `trunk`, `secondary` (und ihre `_link`-Varianten) aus der
Route aus — hart, nicht nur schwächer gewichtet. Das öffentliche
`routed-bike`-OSRM-Profil auf `routing.openstreetmap.de` kennt aber, anders
als ein Auto-Profil (z. B. Maut/Autobahn/Fähre bei `car.lua`), kein
Konzept "ausschließbarer Straßenklassen" für Räder — ein einfacher
`exclude=`-Parameter in der Anfrage funktioniert dafür also nicht, das
Profil passt nur Geschwindigkeit/Priorität pro `highway`-Tag an, ohne harte
Sperrmöglichkeit. Meewind löst das stattdessen mit **Erkennen-und-Umfahren**
(`avoidExcludedRoads()` in `routePlanner.ts`): nach dem Routing jedes
Teilstücks prüft `legCrossesExcludedRoad()` (in `overpass.ts`) per
schmaler Overpass-Abfrage (20m-Korridor entlang bis zu 20 Sample-Punkten
der Teilstück-Geometrie), ob eine der drei Klassen dort verläuft. Falls ja,
wird aus dem noch unbenutzten Knotenpunkt-Pool der nächstgelegene Kandidat
zum Mittelpunkt des betroffenen Teilstücks als zusätzlicher Wegpunkt
eingefügt und die komplette Sequenz neu geroutet — bis zu 4 Durchläufe
(`MAX_AVOID_MAIN_ROAD_PASSES`), danach wird die zuletzt erreichte Route
übernommen, auch wenn sie noch eine Hauptstraßen-Querung enthält. Das ist
bewusst gegenüber der Kandidaten-Auswahl im großen Suchradius abgegrenzt:
ein einzelner Overpass-Vorab-Check über die gesamte Suchfläche (bis zu 70km
bei richtungsgebundenen Rundtouren) wäre wegen der Geometrie-Größe aller
Haupt-/Landstraßen im Gebiet unpraktikabel teuer; stattdessen greift der
Mechanismus günstig und gezielt nur auf die tatsächlich gewählten
Teilstücke zu, verändert aber dadurch effektiv auch, welche Knotenpunkte am
Ende in der Route landen.

**Bekannte Einschränkung**: Dieser Mechanismus ist Best-Effort, keine
mathematische Garantie — analog zum bestehenden Anti-Stadt-Bias (siehe
unten) gibt es keine harte Routing-Sperre auf OSRM-Ebene, sondern eine
begrenzte Zahl an Nachbesserungs-Durchläufen basierend auf Overpass-Daten.
In sehr dicht mit Hauptstraßen durchzogenen Gebieten oder wenn der
Knotenpunkt-Pool keinen geeigneten Ausweich-Kandidaten mehr bietet, kann
eine kurze Hauptstraßen-Querung bestehen bleiben.

### GPX-Export: Navigations-Hinweis statt Google-Maps-Export

Ein Google-Maps-Export für GPX-Tracks wurde bewusst nicht umgesetzt: Google
Maps stellt importierte GPX-Tracks nur als Linie ohne Turn-by-Turn-Navigation
dar, wäre für den eigentlichen Zweck (Navigation während der Fahrt) also
irreführend gewesen. Stattdessen zeigt `RouteSummary.tsx` direkt neben dem
GPX-Export-Button einen kurzen Hinweistext, der stattdessen kostenlose Apps
mit echtem GPX-Turn-by-Turn (OsmAnd, Organic Maps) empfiehlt.

#### Live-Kartenvorschau statt Blackbox bis zum Klick auf "Route planen"

Sobald ein Startpunkt gesetzt ist, zeigt die Karte sofort einen groben,
rein clientseitig berechneten Suchbereich (`LivePreviewOverlay` in
`RouteMap.tsx`): bei Rundtour ohne Richtung ein Kreis (Radius nach derselben
Vollkreis-Formel wie serverseitig, siehe `roundTripPreviewRadiusM`), mit
Richtung ein ±75°-Sektor (Fächer) in die gewählte Richtung, bei One-Way ein
Kreis mit dem eingestellten Such-Radius. Änderungen an Distanz/Richtung
werden 250ms debounced, damit ein Slider-Drag die Karte nicht bei jedem
Tick neu zeichnet. Bewusste Vereinfachung: Prioritäten-Änderungen lösen
keine sichtbare Formänderung aus (sie verändern die Suchgeometrie nicht,
nur die Kandidaten-Bewertung) — es gibt also keinen ehrlichen visuellen
Effekt dafür, und einen künstlichen vorzutäuschen wäre irreführender als
ihn wegzulassen. Die Vorschau blendet sich aus, sobald eine echte Route
berechnet wurde (die farbige Routenlinie ist dann aussagekräftiger) oder im
Signature-Modus (dort kommt die Distanz aus der gewählten Tour, nicht aus
dem Slider).

Die Kartensteuerelemente mussten dafür neu angeordnet werden, damit nichts
hinter dem jetzt schwebenden Panel verschwindet: Leaflets Zoom-Control liegt
jetzt unten rechts (`zoomControl={false}` + eigene `<ZoomControl
position="bottomright">`) statt oben links, und der Straßentyp-Umschalter
sitzt oben rechts unterhalb des Wind-Kompass-Overlays statt oben links.

**Bug gefunden und behoben**: Leaflets SVG-Renderer merkt sich einen
gepolsterten Render-Bereich vom letzten größenrelevanten Ereignis; wechselte
man Tabs im Panel hin und her, blieb dieser Bereich stehen, obwohl sich die
Kartengröße selbst nie geändert hatte (die Karte ist `absolute inset-0`,
komplett unabhängig vom schwebenden Panel) — der Vorschau-Kreis wurde dann
zur Hälfte abgeschnitten dargestellt. `AutoInvalidateSize` (in
`RouteMap.tsx`) hängt einen `ResizeObserver` an den Karten-Container und ruft
bei jeder Größenänderung `map.invalidateSize()` — allgemeiner und robuster
als jeden einzelnen Layout-Auslöser einzeln zu jagen.

### Zwei Eingaben statt Formular: Start + Distanz, Rest mit Default

Die alte Tab-Struktur ("Wo & wie weit" / "Deine Vorlieben" / "Ergebnis")
zwang dazu, mehrere Schritte durchzuklicken, bevor überhaupt eine Route
entstand — obwohl Richtung, Prioritäten, Stopps, POI-Filter und
"Große Straßen vermeiden" längst sinnvolle Defaults hatten
(`DEFAULT_PRIORITIES` ist z. B. für alle vier Dimensionen ausgeglichen bei
0,5). Der Panel-Inhalt ist jetzt ein einziger, tabloser Fluss:

- **Pflichtfelder direkt sichtbar** (`WhereStep.tsx`): Startadresse,
  Tourtyp-Umschalter (Standard: Rundtour) und Distanz-Slider — für die
  Rundtour reicht das für einen ersten "Route planen"-Klick. One-Way und
  Signature-Route brauchen zwangsläufig etwas mehr (eine Zieladresse bzw.
  eine ausgewählte Tour), da das der Sinn dieser Modi selbst ist, kein
  optionales Detail.
- **"Anpassen"** (`Collapsible.tsx` um `CustomizeSection.tsx`, umbenannt aus
  `PreferencesStep.tsx`): standardmäßig eingeklappt, enthält Richtung, Datum,
  Prioritäten-Presets/Feinjustierung, Ø-Geschwindigkeit,
  "Große Straßen vermeiden", Stopp-Planung und POI-Kategorie-Toggle — alles
  aus einem gemeinsamen State, keine gespiegelte Kopie.
- **Ergebnis** (`ResultStep.tsx`): rendert `null`, solange weder eine Route
  noch ein Fehler vorliegt (keine dauerhafte "noch keine Route"-Platzhalter-
  Fläche mehr), erscheint sonst am Ende desselben Panels. `page.tsx` scrollt
  per `ref` + `scrollIntoView` automatisch dorthin, sobald `route` oder
  `error` gesetzt wird, damit das Ergebnis auch dann sichtbar wird, wenn der
  Nutzer im eingeklappten "Anpassen"-Bereich nach unten gescrollt war.

Damit einher geht die Entfernung des früheren `hasVisitedPreferences`-Gates
(`PreferencesGateHint.tsx`, gelöscht): Die 5 Rundtour-Varianten und die
One-Way-Zielvorschläge waren zuvor hinter "erst den Vorlieben-Tab besucht
haben" versteckt, weil sie `priorities` zum Ranking nutzen. Das ergab nur
Sinn, solange man erst durch ein Formular musste, um überhaupt bei den
Prioritäten anzukommen — jetzt, wo die Defaults selbst schon der Sinn der
Übung sind, würde ein Gate dem eigentlichen Ziel (Ergebnis in Sekunden)
direkt widersprechen. Beide Funktionen rendern jetzt unconditional, sobald
ein Startpunkt gesetzt ist.

`PlannerPanel.tsx` selbst hat keine Tabs mehr, nur noch Header (mit
Zurück-Link, Sprachumschalter, Ein-/Ausklapp-Button), einen scrollbaren
Inhaltsbereich (`children`) und einen optionalen Footer-Slot für den
"Route planen"-Button.

### Mehrsprachigkeit (DE/EN/NL)

[next-intl](https://next-intl.dev) mit Locale-Routing (`nl` als Default ohne
Präfix, `/en`, `/de`); Konfiguration in `src/i18n/routing.ts` /
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

### Favicon

Ersetzt das Next.js-Standard-Favicon (der schwarze Dreieck-Platzhalter aus
dem Projekt-Scaffold). `src/app/icon.svg` ist ein selbst gezeichnetes,
minimalistisches Fahrrad-Liniensymbol (lindgrün auf dunkelgrünem
abgerundetem Quadrat, exakt die Design-Token-Farben `--meewind-accent` /
`--meewind-bg` — da SVG kein `oklch()` in jedem Kontext zuverlässig
rendert, als konkrete Hex-Werte `#9ed24d` / `#041e0f` eingesetzt, per
Canvas-`fillStyle`-Rendering aus den Original-`oklch()`-Werten bestimmt,
damit sie exakt passen). Next.js bindet
`app/icon.svg` automatisch als `<link rel="icon" type="image/svg+xml">` ein
— File-Convention, kein Code nötig. Für Browser/Kontexte ohne SVG-Favicon-
Unterstützung liegen zusätzlich `icon.png` (32×32) und `apple-icon.png`
(180×180, für iOS-Homescreen) daneben, ebenfalls automatisch eingebunden.
`favicon.ico` (Fallback für Anfragen an `/favicon.ico`, die manche Browser/
Crawler unabhängig von den `<link rel="icon">`-Tags stellen) wurde durch ein
selbst zusammengesetztes Multi-Size-ICO (16/32/48px, jeweils PNG-komprimiert
eingebettet — das moderne ICO-Format, keine rohen BMP-Daten) aus demselben
Symbol ersetzt; alle vier Dateien sind mit `sharp` (bereits als
Next.js-Abhängigkeit vorhanden) aus dem SVG gerendert, keine neue
Abhängigkeit nötig.

### Fotos auf der Landingpage

Die "FOTO —"-Platzhalter der Design-Vorlage sind durch eigene Fotos ersetzt,
in `public/images/` (mit `sharp` auf max. 1800px Breite/JPEG q78
komprimiert, damit das Repo nicht mit unkomprimierten Multi-MB-Originalen
aufgebläht wird) und per `<PlaceholderPhoto>`
(`src/components/PlaceholderPhoto.tsx`) in `src/app/[locale]/page.tsx`
eingebunden. Lädt ein Bild nicht, blendet ein `onError`-Handler es
geräuschlos aus und der Deichgrün-Akzent-Hintergrund bleibt sichtbar.
Andere Fotos lassen sich 1:1 einsetzen, indem einfach die `src`-Prop pro
`<PlaceholderPhoto>`-Aufruf ersetzt wird.

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
| `POST /api/road-types` | Straßentyp-Breakdown einer Routen-Geometrie | Overpass |

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
  Clients für die externen APIs. `overpass.ts` enthält außerdem
  `fetchRoadTypeBreakdown()` für die Straßentyp-Analyse (siehe unten)
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

Diese Richtungs-Logik galt anfangs nur für die initiale Knotenpunkt-Auswahl:
die "Refine"-Schleife in `finalizeRoute()`, die eine zu kurz/lang geratene
Route nachträglich durch Hinzufügen/Entfernen einzelner Knotenpunkte auf die
Zieldistanz bringt (±20% Toleranz, bis zu 3 Iterationen), hat die Richtung
zunächst ignoriert und beim Verlängern immer den Vollkreis-Radius ohne
Kegel-Filter benutzt — genau der häufige Fall, in dem eine gerichtete Route
nach dem ersten OSRM-Routing noch zu kurz war, wurde also wieder Richtung
Start "aufgefüllt" und driftete zurück zum Kreisen um Amsterdam. `finalizeRoute`
bekommt die Richtung jetzt als Parameter und wendet in der Refine-Schleife
denselben ±75°-Kegel und dieselbe Hin-und-zurück-Radiusformel an wie die
initiale Auswahl. Der Overpass-Suchradius war außerdem für Rundtouren fix auf
30 km gedeckelt, unabhängig von Richtung — die Hin-und-zurück-Radiusformel
liegt aber für dieselbe Zieldistanz gut 3× über der Vollkreis-Formel, sodass
lange gerichtete Rundtouren (>~65 km) nie genug Knotenpunkte weit genug
draußen laden konnten. Der Cap ist jetzt bei gewählter Richtung 70 km statt
30 km, und `planRoundTripAlternatives()` übergibt pro Variante deren eigene
Richtung an `finalizeRoute` statt der ursprünglichen Anfrage-Richtung.

Auch nach diesem Fix blieb ein zweiter Effekt bestehen: die Routen fuhren
zwar in die gewählte Richtung, aber der Weg dorthin (v. a. nah am Start) lag
oft stark in Wohngebieten, weil die Knotenpunkt-Bewertung keinerlei
Anti-Stadt-Signal kannte — siehe "Anti-Stadt-Bias" unten.

### Anti-Stadt-Bias: Wohngebiete standardmäßig meiden

`fetchAreaFeatures()` (in `overpass.ts`) fragt jetzt zusätzlich
`landuse=residential/commercial/industrial/retail`-Flächen ab (in derselben
kombinierten Overpass-Anfrage, kein zusätzlicher Roundtrip) und liefert deren
Zentroide als `urbanPoints`. `computeFeatureScores()` (in `routePlanner.ts`)
verdichtet das analog zu `natureScore` zu einem `urbanScore` pro
Knotenpunkt-Kandidat. In `scoreCandidate()` fließt das mit einem
**Grundgewicht von 0.6 unabhängig vom Natur-Regler** negativ ein — "Stadt
meiden" ist also ein Standardverhalten, keine Regler-Extremstellung, die man
erst hochdrehen muss; der Natur-Regler skaliert zusätzlich obendrauf
(`URBAN_AVOID_BASE_WEIGHT + priorities.nature`). Das gilt für Rundtour- und
One-Way-Knotenpunkt-Auswahl gleichermaßen (`scoreCandidate` ist geteilter
Code), nicht aber für die Zielort-Bewertung in `/api/scenic-route` (dort ist
ein gewisses Maß an Wohnbebauung am Etappenziel selbst normal und kein
Vermeidungsgrund).

### Fahrzeit nach Ø-Geschwindigkeit statt OSRM-Rad-Profil-Schätzung

OSRMs `routed-bike`-Profil nimmt eine generische Stadtrad-Geschwindigkeit an,
die für ein Rennrad unrealistisch wirkt (zu langsam oder zu schnell, je nach
Fahrer). Ein neuer Regler ("Ø-Geschwindigkeit", 15–40 km/h, Default 27) lässt
die Fahrzeit stattdessen direkt aus `Distanz / Geschwindigkeit` berechnen
(`durationFromSpeed()` in `routePlanner.ts`), angewendet am Ende von
`finalizeRoute()` und — für den Sonderfall der Rückenwind-Umkehr-Nachroutung
in `/api/plan` — dort ebenfalls explizit. Gilt für alle Tourtypen (Rundtour,
One-Way, 5 Varianten, Landschafts-Route, Signature-Route), da alle über
`planRoute()`/`finalizeRoute()` laufen bzw. den Parameter durchreichen.

### POI-Kategorien beeinflussen die Routenwahl, nicht nur die Marker

Die POI-Checkboxen (Tankstelle/Supermarkt/Eisdiele/Café) haben bisher nur
gesteuert, welche Marker nach der Routenberechnung zusätzlich angezeigt
werden — die Routenwahl selbst hat immer nur eine feste Café+Eisdiele-Dichte
berücksichtigt (Tankstelle/Supermarkt flossen serverseitig gar nicht in die
Bewertung ein). `fetchAreaFeatures()` nimmt jetzt die tatsächlich vom Nutzer
gewählten Kategorien entgegen und baut die Overpass-POI-Abfrage dynamisch
daraus auf (`POI_FILTERS`, wiederverwendet aus der bestehenden
Marker-Abfrage); `PlanRequest.poiCategories` reicht die Auswahl vom Frontend
bis in die Knotenpunkt-Bewertung durch. Betrifft Rundtour, One-Way und die
5 Routen-Varianten; Landschafts-/Signature-Route nutzen weiterhin die
Standardkategorien (cafe + ice_cream + fuel + supermarket), da ihr Ablauf
keine POI-Auswahl im Formular anzeigt.

### Performance: weniger Netzwerk-Roundtrips pro `/api/plan`-Aufruf

- Die Windvorhersage (Open-Meteo) wird jetzt parallel zu `planRoute()`
  geladen statt danach sequenziell.
- `evaluateWindDirection()` (in `wind.ts`) verlangt für einen Wechsel auf die
  umgekehrte Fahrtrichtung jetzt einen spürbaren Vorsprung (>0,05) statt eines
  reinen "wer ist knapp besser"-Vergleichs — bei einem Beinahe-Gleichstand
  spart sich `/api/plan` damit den zusätzlichen OSRM-Request für die
  umgekehrte Routenfolge, ohne dass Anzeige (`chosenDirection`) und
  Begründungstext (`explanation`) auseinanderlaufen können, da beide aus
  derselben Entscheidung in `evaluateWindDirection()` stammen.
- `routeChain()` (in `osrm.ts`) sendet alle Wegpunkte einer Route in einem
  einzigen OSRM-Multi-Waypoint-Request (`steps=true`) statt einem sequenziellen
  Request pro Teilstück.
- Die POI-Suche entlang der fertigen Route (`fetchPois`) blockiert nicht mehr
  die Lade-Anzeige: `page.tsx` zeigt die Route sofort an und lädt die
  POI-Marker nebenbei nach (`void loadPois(...)` statt `await`), für alle
  Tourtypen (Rundtour, One-Way, Varianten, Landschafts-/Signature-Route).
- `planRoundTripAlternatives()` berechnet die 5 Varianten jetzt mit
  Nebenläufigkeit 3 statt 2 (`ALTERNATIVE_CONCURRENCY`).
- Adresssuche (`AddressSearch.tsx`): das Auswählen eines Suchergebnisses hat
  bisher `setQuery(displayName)` ausgelöst, was denselben Debounce-Suche-Effekt
  erneut angestoßen und das Dropdown Sekundenbruchteile später mit denselben
  Treffern wieder geöffnet hat — für den Nutzer sah das aus, als hätte der
  erste Klick nichts bewirkt und man müsse ein zweites Mal klicken (der erste
  Klick hatte den Startpunkt aber schon korrekt gesetzt). Ein Ref-Flag
  überspringt die Suche für genau den einen durch die Auswahl selbst
  ausgelösten Effekt-Durchlauf.

### Straßentyp-Transparenz (Radweg / Wohnstraße / Hauptstraße)

Da OSRM-Routing über den öffentlichen Demo-Server nicht steuert, wie stark
Wohnstraßen vermieden werden (dafür bräuchte es ein eigenes OSRM-Profil oder
eine aufwändige Overpass-Polygon-Vermeidung — beides über den aktuellen Scope
hinaus, siehe "Anti-Stadt-Bias" oben für den Teil, der stattdessen umgesetzt
wurde), zeigt Meewind zusätzlich transparent an, welche Art Straße/Weg eine
geplante Route tatsächlich nutzt — und zwar nicht nur als Gesamt-Prozentsatz,
sondern auch direkt auf der Karte, abschnittsweise: `fetchRoadTypeBreakdown()`
(in `overpass.ts`) fragt für bis zu 150 gleichmäßig über die Routen-Geometrie
verteilte Punkte alle `highway=*`-Ways im 20m-Korridor ab (`out geom;`),
matcht dann jeden dieser Sample-Punkte auf den nächstgelegenen Way-Vertex
(Cache-freundliche Grobfilterung per Lat/Lon-Differenz vor dem eigentlichen
Distanz-Check) und baut daraus zusammenhängende, gleich klassifizierte
Segmente (`RoadTypeSegment[]`) — nicht klassifizierbare Lücken übernehmen die
letzte bekannte Klassifikation, damit kurze Aussetzer in den Overpass-Daten
keine Segmente unnötig zerstückeln. Die Gesamt-Prozentsatz-Aufteilung wird
aus der tatsächlich klassifizierten Strecke berechnet (nicht mehr aus der
Gesamtlänge der gefundenen Ways), was sie konsistent mit der Kartenanzeige
macht. `/api/road-types` liefert beides (`breakdown` + `segments`);
`RouteSummary` holt es client-seitig für die gerade angezeigte Route (nicht
für die 5 Routen-Varianten, um deren Vorschau nicht zu verlangsamen) und
reicht die Segmente per Callback an `page.tsx` weiter, das sie der `RouteMap`
gibt. Ein Umschalter oben links auf der Karte wechselt zwischen
Wind-Einfärbung (Standard) und Straßentyp-Einfärbung der Route.

### Wie die Prioritäten-Regler wirken

Es gibt keinen vollständigen gewichteten Shortest-Path über das komplette
Knooppunten-Netz (das wäre ein deutlich größeres Projekt) — stattdessen
fließen die Regler in die bestehende Sektor-/Schritt-Heuristik ein:

- **Wenig Ampeln**, **viel Natur/Wasser**: Für jeden Kandidaten-Knotenpunkt
  werden einmalig Overpass-Querys über Ampeln/Kreuzungen sowie Wasser/Wald im
  Suchradius geladen. "Natur/Wasser" kombiniert dabei eine Dichte-Zählung
  (Wasser+Wald im Umkreis) mit einer Distanz-Zerfallsfunktion zum nächsten
  Wasser-Feature — dieselbe Formel wie beim Attraktivitäts-Score der
  Zielvorschläge (siehe unten). So bevorzugt die Route Wasser in der Nähe,
  ohne dass die Distanz-Passung (die immer mit Basisgewicht 1 einfließt)
  dafür einen großen Umweg zulässt — die Werte fließen direkt in die
  Kandidaten-Bewertung pro Sektor/Schritt ein. Café-/Eisdielen-/Sehenswürdig-
  keiten-Dichte (`poiScore`) wird weiterhin geladen und beeinflusst intern
  noch `pickHighlight()`s Klassifikation "poiRich" bei den 5 Routen-Varianten,
  fließt aber seit der Einführung der gezielten "Stopps planen"-Funktion
  (siehe oben) nicht mehr in `scoreCandidate()` und damit nicht mehr in die
  eigentliche Knotenpunkt-Auswahl ein.
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
- Der Anti-Stadt-Bias (`urbanScore`) ist eine *Bewertungs*-Gewichtung bei der
  Knotenpunkt-Auswahl, keine harte Routing-Vermeidung — OSRM selbst bekommt
  keine Anweisung, Wohnstraßen zu meiden, es werden nur Knotenpunkte mit
  weniger Wohn-/Gewerbebebauung in der Nähe bevorzugt ausgewählt. Auf der
  "letzten Meile" nah am Startpunkt in einer Großstadt sind Wohnstraßen daher
  weiterhin teils unvermeidbar. Eine echte Vermeidung bräuchte ein eigenes
  OSRM-Profil oder eine Overpass-Polygon-basierte Routenbewertung.
- Die Straßentyp-Klassifizierung pro Kartenabschnitt matcht Sample-Punkte auf
  den nächstgelegenen Way-Vertex (nicht auf die exakte Projektion auf die
  Wegkante) und deckt nur `highway=*`-Tags ab, die innerhalb von 30m eines
  Sample-Punkts liegen — bei sehr grob digitalisierten Wegen oder Lücken in
  den OSM-Daten kann ein Abschnitt daher als "Sonstige" statt korrekt
  klassifiziert erscheinen.
- "Große Straßen vermeiden" ist Erkennen-und-Umfahren nach dem Routing, keine
  harte OSRM-Sperre (siehe oben) — bei sehr dichtem Hauptstraßennetz oder
  einem knappen Knotenpunkt-Pool kann nach den maximal 4 Nachbesserungs-
  Durchläufen noch eine kurze Querung übrig bleiben.
- `routeFraction()` für die "Stopps planen"-Fensterfilterung ordnet einen POI
  dem nächstgelegenen Routen-Vertex zu, nicht der exakten Projektion auf das
  Liniensegment — bei sehr groben Routen-Geometrien (wenige Vertices auf
  einem langen, geraden Teilstück) kann der berechnete Streckenanteil daher
  leicht von der tatsächlichen Position abweichen.
- Das Region-Foto im Ergebnis (`RegionPhoto.tsx`) findet nur dann ein Bild,
  wenn ein geo-getaggter Wikipedia-Artikel mit Thumbnail im 12km-Radius um
  den Routen-Mittelpunkt existiert — in sehr ländlichen oder dünn auf
  Wikipedia dokumentierten Gegenden bleibt die Fläche dann leer, statt ein
  falsches oder generisches Bild zu erzwingen.

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
