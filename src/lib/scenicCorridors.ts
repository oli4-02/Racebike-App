import { useLocale } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { SCENIC_CORRIDOR_DESCRIPTIONS } from "./curatedTranslations";
import { resolveLocale } from "./resolveLocale";
import type { LandscapeType, ScenicCorridor } from "./types";

const LANDSCAPE_LABELS_BY_LOCALE: Record<AppLocale, Record<LandscapeType, string>> = {
  de: {
    duenen_kueste: "Dünen/Küste",
    wald: "Wald",
    polder: "Polder",
    heide_moor: "Heide/Moor",
    heuvelland: "Heuvelland",
    fluss_meer: "Fluss/Meer",
  },
  en: {
    duenen_kueste: "Dunes/Coast",
    wald: "Forest",
    polder: "Polder",
    heide_moor: "Heath/Bog",
    heuvelland: "Rolling hills",
    fluss_meer: "River/Lake",
  },
  nl: {
    duenen_kueste: "Duinen/Kust",
    wald: "Bos",
    polder: "Polder",
    heide_moor: "Heide/Moeras",
    heuvelland: "Heuvelland",
    fluss_meer: "Rivier/Meer",
  },
};

/** German landscape-type labels, kept as the default export for any non-locale-aware call site. */
export const LANDSCAPE_LABELS = LANDSCAPE_LABELS_BY_LOCALE.de;

/** Client-component hook returning landscape-type labels in the active locale. */
export function useLandscapeLabels(): Record<LandscapeType, string> {
  const locale = resolveLocale(useLocale());
  return LANDSCAPE_LABELS_BY_LOCALE[locale];
}

export const LANDSCAPE_EMOJI: Record<LandscapeType, string> = {
  duenen_kueste: "🏖️",
  wald: "🌲",
  polder: "🌾",
  heide_moor: "🟤",
  heuvelland: "⛰️",
  fluss_meer: "🌊",
};

/**
 * Hand-picked scenic cycling areas across the Netherlands. Centers/radii are
 * approximate (not surveyed polygons) and entry station names are a
 * best-effort nearest-station guess for display purposes — the actual
 * station used for routing is resolved live via the NS API against the
 * corridor center (see /api/scenic-route), so a slightly-off name here
 * doesn't break anything, but worth spot-checking before relying on it.
 */
export const SCENIC_CORRIDORS: ScenicCorridor[] = [
  {
    id: "kennemerduinen",
    name: "Kennemerduinen",
    landscapeType: "duenen_kueste",
    description:
      "Wanderdünen, Strand und Pinienwälder zwischen Zandvoort und Bloemendaal aan Zee.",
    center: { lat: 52.372, lon: 4.533 },
    radiusKm: 8,
    entryStationName: "Zandvoort aan Zee",
  },
  {
    id: "zuid-kennemerland",
    name: "Nationaal Park Zuid-Kennemerland",
    landscapeType: "duenen_kueste",
    description:
      "Küstenduinen mit Schottischen Hochlandrindern und weiten Ausblicken auf die Nordsee, direkt bei Haarlem.",
    center: { lat: 52.402, lon: 4.573 },
    radiusKm: 7,
    entryStationName: "Overveen",
  },
  {
    id: "schoorlse-duinen",
    name: "Schoorlse Duinen",
    landscapeType: "duenen_kueste",
    description:
      "Eines der größten zusammenhängenden Dünengebiete Europas, hügelig und bewaldet, nahe Bergen aan Zee.",
    center: { lat: 52.696, lon: 4.689 },
    radiusKm: 8,
    entryStationName: "Alkmaar",
  },
  {
    id: "duinen-van-voorne",
    name: "Duinen van Voorne",
    landscapeType: "duenen_kueste",
    description:
      "Ruhiges Dünen- und Strandgebiet auf Voorne-Putten, südlich der Nieuwe Waterweg.",
    center: { lat: 51.872, lon: 4.008 },
    radiusKm: 7,
    entryStationName: "Spijkenisse Centrum",
  },
  {
    id: "walcheren-domburg",
    name: "Walcheren-Küste bei Domburg",
    landscapeType: "duenen_kueste",
    description:
      "Zeeländische Dünenlandschaft und Badeorte an der Nordseeküste von Walcheren.",
    center: { lat: 51.561, lon: 3.497 },
    radiusKm: 10,
    entryStationName: "Middelburg",
  },
  {
    id: "hoge-veluwe",
    name: "Nationaal Park De Hoge Veluwe",
    landscapeType: "wald",
    description:
      "Ausgedehnte Wälder, Heide und Sandverwehungen mit dem Kröller-Müller-Museum mittendrin.",
    center: { lat: 52.093, lon: 5.825 },
    radiusKm: 12,
    entryStationName: "Apeldoorn",
  },
  {
    id: "speulderbos",
    name: "Speulder- en Sprielderbos",
    landscapeType: "wald",
    description:
      "Alter Waldbestand auf der Veluwe rund um Garderen, ruhige, schattige Wege.",
    center: { lat: 52.247, lon: 5.628 },
    radiusKm: 10,
    entryStationName: "Amersfoort",
  },
  {
    id: "utrechtse-heuvelrug",
    name: "Utrechtse Heuvelrug",
    landscapeType: "wald",
    description:
      "Bewaldeter Endmoränenrücken mit sanften Steigungen zwischen Zeist und Rhenen.",
    center: { lat: 52.053, lon: 5.338 },
    radiusKm: 10,
    entryStationName: "Driebergen-Zeist",
  },
  {
    id: "loonse-en-drunense-duinen",
    name: "Loonse en Drunense Duinen",
    landscapeType: "wald",
    description:
      "Binnenlanddünen und Kiefernwald in Brabant, bekannt als \"Sahara des Nordens\".",
    center: { lat: 51.636, lon: 5.098 },
    radiusKm: 8,
    entryStationName: "Tilburg",
  },
  {
    id: "beemster-polder",
    name: "Beemster Polder",
    landscapeType: "polder",
    description:
      "UNESCO-Weltkulturerbe: schnurgerade Polderwege, Grachten und historische Bauernhöfe.",
    center: { lat: 52.547, lon: 4.944 },
    radiusKm: 8,
    entryStationName: "Purmerend",
  },
  {
    id: "alblasserwaard-kinderdijk",
    name: "Alblasserwaard / Kinderdijk",
    landscapeType: "polder",
    description:
      "Flache Polderlandschaft mit den berühmten Windmühlen von Kinderdijk.",
    center: { lat: 51.883, lon: 4.632 },
    radiusKm: 10,
    entryStationName: "Rotterdam Centraal",
  },
  {
    id: "groene-hart-reeuwijk",
    name: "Groene Hart / Reeuwijkse Plassen",
    landscapeType: "polder",
    description:
      "Torfseen, Weidelandschaft und Kanäle im grünen Herzen der Randstad.",
    center: { lat: 52.053, lon: 4.746 },
    radiusKm: 8,
    entryStationName: "Gouda",
  },
  {
    id: "dwingelderveld",
    name: "Nationaal Park Dwingelderveld",
    landscapeType: "heide_moor",
    description:
      "Größte zusammenhängende Heidefläche Westeuropas mit Wacholderbüschen und Schafherden.",
    center: { lat: 52.808, lon: 6.39 },
    radiusKm: 8,
    entryStationName: "Beilen",
  },
  {
    id: "drents-friese-wold",
    name: "Nationaal Park Drents-Friese Wold",
    landscapeType: "heide_moor",
    description:
      "Abwechslungsreiches Mosaik aus Wald, Heide, Sandverwehungen und dem Fochteloërveen.",
    center: { lat: 52.859, lon: 6.149 },
    radiusKm: 10,
    entryStationName: "Steenwijk",
  },
  {
    id: "bargerveen",
    name: "Bargerveen",
    landscapeType: "heide_moor",
    description:
      "Eines der letzten Hochmoorreste der Niederlande, weit und still an der deutschen Grenze.",
    center: { lat: 52.683, lon: 7.04 },
    radiusKm: 8,
    entryStationName: "Emmen",
  },
  {
    id: "zuid-limburg-heuvelland",
    name: "Zuid-Limburg Heuvelland",
    landscapeType: "heuvelland",
    description:
      "Das einzig wirklich hügelige Rennradrevier der Niederlande, Hohlwege und Fachwerkdörfer.",
    center: { lat: 50.836, lon: 5.833 },
    radiusKm: 12,
    entryStationName: "Maastricht",
  },
  {
    id: "vaalserberg",
    name: "Vaalserberg / Drielandenpunt",
    landscapeType: "heuvelland",
    description:
      "Höchste Erhebung der Niederlande, direkt am Dreiländereck mit Belgien und Deutschland.",
    center: { lat: 50.754, lon: 6.02 },
    radiusKm: 8,
    entryStationName: "Maastricht",
  },
  {
    id: "biesbosch",
    name: "Nationaal Park De Biesbosch",
    landscapeType: "fluss_meer",
    description:
      "Eines der letzten Süßwasser-Gezeitengebiete Europas, mit Prielen, Röhricht und kleinen Fähren.",
    center: { lat: 51.758, lon: 4.79 },
    radiusKm: 10,
    entryStationName: "Dordrecht",
  },
  {
    id: "waterland",
    name: "Waterland / IJsselmeerküste",
    landscapeType: "fluss_meer",
    description:
      "Historische Fischerdörfer wie Marken und Volendam entlang des IJsselmeers, direkt bei Amsterdam.",
    center: { lat: 52.465, lon: 5.05 },
    radiusKm: 10,
    entryStationName: "Amsterdam Centraal",
  },
  {
    id: "loosdrechtse-plassen",
    name: "Loosdrechtse Plassen",
    landscapeType: "fluss_meer",
    description:
      "Ausgedehntes Seengebiet mit Segelbooten, Schilfinseln und Sommerhäusern.",
    center: { lat: 52.193, lon: 5.068 },
    radiusKm: 7,
    entryStationName: "Hilversum",
  },
];

/** Returns SCENIC_CORRIDORS with `description` swapped to the requested locale (falls back to the German source text if a translation is missing). */
export function scenicCorridorsForLocale(locale: AppLocale): ScenicCorridor[] {
  return SCENIC_CORRIDORS.map((c) => ({
    ...c,
    description: SCENIC_CORRIDOR_DESCRIPTIONS[c.id]?.[locale] ?? c.description,
  }));
}
