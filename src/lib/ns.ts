import type { LatLon } from "./types";

// NS (Nederlandse Spoorwegen) Reisinformatie API — https://apiportal.ns.nl
// Requires a free subscription key registered by the app owner via
// NS_API_KEY. Endpoint shapes below follow the public API docs but have
// not been exercised against a live key yet (see README for setup); treat
// this module as a best-effort client to verify once a key is available.
const NS_BASE = "https://gateway.apiportal.ns.nl";

export type NsStation = {
  code: string;
  name: string;
  lat: number;
  lon: number;
};

export type OvFietsAvailability = {
  stationCode: string;
  rentalBikesAvailable: number | null;
};

function assertApiKey(): string {
  const key = process.env.NS_API_KEY;
  if (!key) {
    throw new Error("NS_API_KEY ist nicht gesetzt.");
  }
  return key;
}

function headers(): HeadersInit {
  return { "Ocp-Apim-Subscription-Key": assertApiKey() };
}

export function isNsConfigured(): boolean {
  return Boolean(process.env.NS_API_KEY);
}

export async function findNearestStation(point: LatLon): Promise<NsStation | null> {
  const url = `${NS_BASE}/reisinformatie-api/api/v2/stations/nearest?lat=${point.lat}&lng=${point.lon}`;
  const res = await fetch(url, {
    headers: headers(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`NS Stations-API antwortete ${res.status}`);
  const data = await res.json();
  const first = data?.payload?.[0];
  if (!first) return null;
  return {
    code: first.id?.code,
    name: first.names?.long ?? first.names?.medium ?? first.id?.code,
    lat: first.lat,
    lon: first.lng,
  };
}

export async function ovFietsAvailability(
  stationCode: string
): Promise<OvFietsAvailability> {
  const url = `${NS_BASE}/reisinformatie-api/api/v3/ovfiets/${stationCode}`;
  const res = await fetch(url, {
    headers: headers(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return { stationCode, rentalBikesAvailable: null };
  const data = await res.json();
  const bikes = data?.[0]?.extra?.rentalBikes ?? null;
  return { stationCode, rentalBikesAvailable: bikes };
}

export type TripSummary = {
  departureTime: string;
  arrivalTime: string;
  transfers: number;
};

export async function planTrip(
  fromStationCode: string,
  toStationCode: string,
  dateTime: string
): Promise<TripSummary[]> {
  const url =
    `${NS_BASE}/reisinformatie-api/api/v3/trips?fromStation=${fromStationCode}` +
    `&toStation=${toStationCode}&dateTime=${encodeURIComponent(dateTime)}`;
  const res = await fetch(url, {
    headers: headers(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`NS Trips-API antwortete ${res.status}`);
  const data: { trips?: NsTrip[] } = await res.json();
  const trips = data?.trips ?? [];
  return trips.slice(0, 5).map((t) => ({
    departureTime: t.legs?.[0]?.origin?.plannedDateTime ?? "",
    arrivalTime:
      t.legs?.[t.legs.length - 1]?.destination?.plannedDateTime ?? "",
    transfers: Math.max(0, (t.legs?.length ?? 1) - 1),
  }));
}

type NsTrip = {
  legs?: { origin?: { plannedDateTime?: string }; destination?: { plannedDateTime?: string } }[];
};
