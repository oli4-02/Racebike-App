import type {
  DestinationSuggestion,
  PlanRequest,
  PlannedRoute,
  Priorities,
  POI,
  POICategory,
  LatLon,
  ScenicCorridor,
  ScenicRoutePlan,
  SignatureRoute,
  SignatureRoutePlan,
  TrainInfo,
} from "./types";

async function parseOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Fallback only fires when the server response has no `error` field at
    // all (e.g. a network proxy error page); server error messages are
    // already localized via the "locale" sent with each request.
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }
  return data;
}

export type GeocodeResult = { displayName: string; lat: number; lon: number };

export async function geocode(query: string, locale: string): Promise<GeocodeResult[]> {
  const res = await fetch(
    `/api/geocode?q=${encodeURIComponent(query)}&locale=${encodeURIComponent(locale)}`
  );
  const data = await parseOrThrow(res);
  return data.results;
}

export async function planRoute(req: PlanRequest, locale: string): Promise<PlannedRoute> {
  const res = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...req, locale }),
  });
  return parseOrThrow(res);
}

export async function fetchPois(
  geometry: LatLon[],
  categories: POICategory[],
  locale: string
): Promise<POI[]> {
  const res = await fetch("/api/pois", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geometry, categories, locale }),
  });
  const data = await parseOrThrow(res);
  return data.pois;
}

export type WeatherPreview =
  | { available: true; speedKmh: number; directionDeg: number }
  | { available: false; message: string };

export async function fetchWeatherPreview(
  point: LatLon,
  date: string,
  locale: string
): Promise<WeatherPreview> {
  const res = await fetch(
    `/api/weather?lat=${point.lat}&lon=${point.lon}&date=${date}&locale=${encodeURIComponent(locale)}`
  );
  return parseOrThrow(res);
}

export async function fetchTrainReturn(params: {
  dest: LatLon;
  home: LatLon;
  dateTime: string;
  locale: string;
}): Promise<TrainInfo> {
  const res = await fetch(
    `/api/train?destLat=${params.dest.lat}&destLon=${params.dest.lon}` +
      `&homeLat=${params.home.lat}&homeLon=${params.home.lon}` +
      `&dateTime=${encodeURIComponent(params.dateTime)}` +
      `&locale=${encodeURIComponent(params.locale)}`
  );
  return parseOrThrow(res);
}

export async function fetchDestinationSuggestions(params: {
  start: LatLon;
  distanceKm: number;
  date: string;
  priorities?: Priorities;
  locale: string;
}): Promise<DestinationSuggestion[]> {
  const res = await fetch("/api/destinations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await parseOrThrow(res);
  return data.suggestions;
}

export async function fetchScenicCorridors(locale: string): Promise<ScenicCorridor[]> {
  const res = await fetch(`/api/scenic-corridors?locale=${encodeURIComponent(locale)}`);
  const data = await parseOrThrow(res);
  return data.corridors;
}

export async function planScenicRoute(params: {
  corridorId: string;
  start: LatLon;
  distanceKm: number;
  date: string;
  priorities?: Priorities;
  locale: string;
}): Promise<ScenicRoutePlan> {
  const res = await fetch("/api/scenic-route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseOrThrow(res);
}

export async function fetchSignatureRoutes(locale: string): Promise<SignatureRoute[]> {
  const res = await fetch(`/api/signature-routes?locale=${encodeURIComponent(locale)}`);
  const data = await parseOrThrow(res);
  return data.routes;
}

export async function planSignatureRoute(params: {
  routeId: string;
  start: LatLon;
  distanceKm: number;
  date: string;
  priorities?: Priorities;
  locale: string;
}): Promise<SignatureRoutePlan> {
  const res = await fetch("/api/signature-route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseOrThrow(res);
}
