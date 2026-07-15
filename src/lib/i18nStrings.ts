import type { AppLocale } from "@/i18n/routing";
import type { POICategory } from "./types";

/**
 * Per-locale strings for content generated deep inside lib/ functions
 * (wind explanations, POI labels, low-level fetch errors) that aren't part
 * of the React tree and can't use next-intl's useTranslations/getTranslations
 * hooks directly. Kept in one file so translations for a given concept live
 * together instead of scattered across each lib module. API-route-level
 * validation/catch-all messages use the "api" namespace in messages/*.json
 * instead (those run once per request and can afford the async
 * getTranslations call).
 */

export const POI_CATEGORY_LABELS: Record<AppLocale, Record<POICategory, string>> = {
  de: { fuel: "Tankstelle", supermarket: "Supermarkt", ice_cream: "Eisdiele", cafe: "Café" },
  en: { fuel: "Fuel station", supermarket: "Supermarket", ice_cream: "Ice cream", cafe: "Café" },
  nl: { fuel: "Tankstation", supermarket: "Supermarkt", ice_cream: "IJssalon", cafe: "Café" },
};

export const COMPASS_LABELS: Record<AppLocale, string[]> = {
  de: ["N", "NO", "O", "SO", "S", "SW", "W", "NW"],
  en: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
  nl: ["N", "NO", "O", "ZO", "Z", "ZW", "W", "NW"],
};

// Which half of the loop a rider wants tailwind on: the harder, later "return"
// half (default -- fatigue makes headwind hurt more there) or the "outbound"
// half instead. Used both to weight evaluateWindDirection()'s scoring and to
// phrase the explanation text accordingly.
export const WIND_PART_LABEL: Record<AppLocale, { return: string; outbound: string }> = {
  de: { return: "zweiten (anstrengenderen)", outbound: "ersten (Hin-)" },
  en: { return: "second (harder)", outbound: "first (outbound)" },
  nl: { return: "tweede (zwaardere)", outbound: "eerste (heen-)" },
};

export const WIND_EXPLANATION: Record<
  AppLocale,
  {
    forward: (compass: string, speedKmh: string, part: string) => string;
    reverse: (compass: string, speedKmh: string, part: string) => string;
  }
> = {
  de: {
    forward: (compass, speed, part) =>
      `Wind aus ${compass} mit ${speed} km/h: Fahrtrichtung wie geplant gibt mehr Rückenwind im ${part} Streckenteil.`,
    reverse: (compass, speed, part) =>
      `Wind aus ${compass} mit ${speed} km/h: Route wird umgekehrt gefahren, damit der ${part} Streckenteil mehr Rückenwind bekommt.`,
  },
  en: {
    forward: (compass, speed, part) =>
      `Wind from the ${compass} at ${speed} km/h: riding in the planned direction gives more tailwind in the ${part} part of the route.`,
    reverse: (compass, speed, part) =>
      `Wind from the ${compass} at ${speed} km/h: the route is ridden in reverse so the ${part} part gets more tailwind.`,
  },
  nl: {
    forward: (compass, speed, part) =>
      `Wind uit het ${compass} met ${speed} km/u: de geplande rijrichting geeft meer rugwind in het ${part} deel van de route.`,
    reverse: (compass, speed, part) =>
      `Wind uit het ${compass} met ${speed} km/u: de route wordt omgekeerd gereden, zodat het ${part} deel meer rugwind krijgt.`,
  },
};

export const OVERPASS_STRINGS: Record<
  AppLocale,
  { reasons: Record<number, string>; overloadHint: string; allServersFailed: string }
> = {
  de: {
    reasons: {
      429: "Rate-Limit erreicht (zu viele Anfragen)",
      502: "Bad Gateway",
      503: "Dienst überlastet",
      504: "Gateway Timeout — Anfrage war dem Server zu komplex oder er ist überlastet",
    },
    overloadHint:
      "\n\nDer öffentliche Overpass-Dienst ist gerade überlastet oder limitiert Anfragen. Bitte in ein paar Sekunden erneut versuchen.",
    allServersFailed: "Overpass-Anfrage an allen Servern fehlgeschlagen:",
  },
  en: {
    reasons: {
      429: "Rate limit reached (too many requests)",
      502: "Bad Gateway",
      503: "Service overloaded",
      504: "Gateway Timeout — the request was too complex or the server is overloaded",
    },
    overloadHint:
      "\n\nThe public Overpass service is currently overloaded or rate-limiting requests. Please try again in a few seconds.",
    allServersFailed: "Overpass request failed on all servers:",
  },
  nl: {
    reasons: {
      429: "Rate-limit bereikt (te veel aanvragen)",
      502: "Bad Gateway",
      503: "Dienst overbelast",
      504: "Gateway Timeout — de aanvraag was te complex of de server is overbelast",
    },
    overloadHint:
      "\n\nDe publieke Overpass-dienst is momenteel overbelast of beperkt aanvragen. Probeer het over een paar seconden opnieuw.",
    allServersFailed: "Overpass-aanvraag is bij alle servers mislukt:",
  },
};

export const OSRM_STRINGS: Record<AppLocale, { httpError: (status: number, statusText: string) => string; noRoute: (code: string) => string }> = {
  de: {
    httpError: (status, statusText) => `OSRM antwortete HTTP ${status} ${statusText}`,
    noRoute: (code) => `OSRM konnte keine Route finden: ${code}`,
  },
  en: {
    httpError: (status, statusText) => `OSRM responded HTTP ${status} ${statusText}`,
    noRoute: (code) => `OSRM could not find a route: ${code}`,
  },
  nl: {
    httpError: (status, statusText) => `OSRM antwoordde met HTTP ${status} ${statusText}`,
    noRoute: (code) => `OSRM kon geen route vinden: ${code}`,
  },
};

export const NS_STRINGS: Record<
  AppLocale,
  { notConfigured: string; apiKeyMissing: string; stationsApiError: (status: number) => string; tripsApiError: (status: number) => string; noStationNearby: string; queryFailed: string }
> = {
  de: {
    notConfigured:
      "Zugverbindung ist noch nicht aktiv: NS_API_KEY fehlt. Kostenlosen Key auf apiportal.ns.nl registrieren und als Umgebungsvariable NS_API_KEY setzen.",
    apiKeyMissing: "NS_API_KEY ist nicht gesetzt.",
    stationsApiError: (status) => `NS Stations-API antwortete ${status}`,
    tripsApiError: (status) => `NS Trips-API antwortete ${status}`,
    noStationNearby: "Kein Bahnhof in der Nähe gefunden.",
    queryFailed: "NS-Abfrage fehlgeschlagen.",
  },
  en: {
    notConfigured:
      "Train connection isn't active yet: NS_API_KEY is missing. Register a free key at apiportal.ns.nl and set it as the NS_API_KEY environment variable.",
    apiKeyMissing: "NS_API_KEY is not set.",
    stationsApiError: (status) => `NS stations API responded ${status}`,
    tripsApiError: (status) => `NS trips API responded ${status}`,
    noStationNearby: "No nearby station found.",
    queryFailed: "NS query failed.",
  },
  nl: {
    notConfigured:
      "Treinverbinding is nog niet actief: NS_API_KEY ontbreekt. Registreer een gratis key op apiportal.ns.nl en stel deze in als omgevingsvariabele NS_API_KEY.",
    apiKeyMissing: "NS_API_KEY is niet ingesteld.",
    stationsApiError: (status) => `NS-stations-API antwoordde ${status}`,
    tripsApiError: (status) => `NS-reizen-API antwoordde ${status}`,
    noStationNearby: "Geen station in de buurt gevonden.",
    queryFailed: "NS-aanvraag mislukt.",
  },
};

export const ROUTE_PLANNER_STRINGS: Record<
  AppLocale,
  {
    onewayDestinationRequired: string;
    tooFewNodes: string;
    noSensibleRoute: string;
    distanceToleranceFailed: string;
  }
> = {
  de: {
    onewayDestinationRequired: "Für eine One-Way-Tour wird ein Ziel benötigt.",
    tooFewNodes:
      "Zu wenige Knotenpunkte des Radnetzwerks in der Nähe gefunden. Bitte einen anderen Startpunkt oder eine größere Distanz wählen.",
    noSensibleRoute: "Es konnte keine sinnvolle Route aus den gefundenen Knotenpunkten gebaut werden.",
    distanceToleranceFailed:
      "Für diese Distanz/Richtung konnte keine Route innerhalb von ±20% der Zieldistanz gefunden werden. Bitte Distanz oder Richtung anpassen.",
  },
  en: {
    onewayDestinationRequired: "A one-way trip requires a destination.",
    tooFewNodes:
      "Too few cycle-network nodes found nearby. Please pick a different start point or a larger distance.",
    noSensibleRoute: "Could not build a sensible route from the nodes found.",
    distanceToleranceFailed:
      "Could not find a route within ±20% of the target distance for this distance/direction. Please adjust the distance or direction.",
  },
  nl: {
    onewayDestinationRequired: "Voor een enkele reis is een bestemming vereist.",
    tooFewNodes:
      "Te weinig knooppunten van het fietsnetwerk in de buurt gevonden. Kies een ander startpunt of een grotere afstand.",
    noSensibleRoute: "Er kon geen zinvolle route worden opgebouwd uit de gevonden knooppunten.",
    distanceToleranceFailed:
      "Er kon geen route binnen ±20% van de doelafstand worden gevonden voor deze afstand/richting. Pas de afstand of richting aan.",
  },
};

export const DESTINATION_STRINGS: Record<AppLocale, { stationOnSite: string }> = {
  de: { stationOnSite: "Bahnhof vor Ort" },
  en: { stationOnSite: "Station on site" },
  nl: { stationOnSite: "Station ter plaatse" },
};
