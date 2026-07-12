import type {
  DestinationSuggestion,
  PlanRequest,
  PlannedRoute,
  Priorities,
  POI,
  POICategory,
  LatLon,
} from "./types";

async function parseOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? `Anfrage fehlgeschlagen (${res.status})`);
  }
  return data;
}

export type GeocodeResult = { displayName: string; lat: number; lon: number };

export async function geocode(query: string): Promise<GeocodeResult[]> {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
  const data = await parseOrThrow(res);
  return data.results;
}

export async function planRoute(req: PlanRequest): Promise<PlannedRoute> {
  const res = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  return parseOrThrow(res);
}

export async function fetchPois(
  geometry: LatLon[],
  categories: POICategory[]
): Promise<POI[]> {
  const res = await fetch("/api/pois", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ geometry, categories }),
  });
  const data = await parseOrThrow(res);
  return data.pois;
}

export type WeatherPreview =
  | { available: true; speedKmh: number; directionDeg: number }
  | { available: false; message: string };

export async function fetchWeatherPreview(
  point: LatLon,
  date: string
): Promise<WeatherPreview> {
  const res = await fetch(
    `/api/weather?lat=${point.lat}&lon=${point.lon}&date=${date}`
  );
  return parseOrThrow(res);
}

export type TrainInfo =
  | { configured: false; message: string }
  | {
      configured: true;
      destStation: { code: string; name: string };
      homeStation: { code: string; name: string };
      trips: { departureTime: string; arrivalTime: string; transfers: number }[];
      ovFiets: { rentalBikesAvailable: number | null };
    }
  | { configured: true; error: string };

export async function fetchTrainReturn(params: {
  dest: LatLon;
  home: LatLon;
  dateTime: string;
}): Promise<TrainInfo> {
  const res = await fetch(
    `/api/train?destLat=${params.dest.lat}&destLon=${params.dest.lon}` +
      `&homeLat=${params.home.lat}&homeLon=${params.home.lon}` +
      `&dateTime=${encodeURIComponent(params.dateTime)}`
  );
  return parseOrThrow(res);
}

export async function fetchDestinationSuggestions(params: {
  start: LatLon;
  distanceKm: number;
  date: string;
  priorities?: Priorities;
}): Promise<DestinationSuggestion[]> {
  const res = await fetch("/api/destinations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await parseOrThrow(res);
  return data.suggestions;
}
