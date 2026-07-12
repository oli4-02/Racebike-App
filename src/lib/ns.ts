import type { AppLocale } from "@/i18n/routing";
import { NS_STRINGS } from "./i18nStrings";
import type { LatLon, StationInfo, TrainInfo } from "./types";

// NS (Nederlandse Spoorwegen) Reisinformatie API — https://apiportal.ns.nl
// Requires a free subscription key registered by the app owner via
// NS_API_KEY. Endpoint shapes below follow the public API docs but have
// not been exercised against a live key yet (see README for setup); treat
// this module as a best-effort client to verify once a key is available.
const NS_BASE = "https://gateway.apiportal.ns.nl";

export const NS_NOT_CONFIGURED_MESSAGE = NS_STRINGS.de.notConfigured;

export function nsNotConfiguredMessage(locale: AppLocale = "de"): string {
  return NS_STRINGS[locale].notConfigured;
}

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

function assertApiKey(locale: AppLocale): string {
  const key = process.env.NS_API_KEY;
  if (!key) {
    throw new Error(NS_STRINGS[locale].apiKeyMissing);
  }
  return key;
}

function headers(locale: AppLocale): HeadersInit {
  return { "Ocp-Apim-Subscription-Key": assertApiKey(locale) };
}

export function isNsConfigured(): boolean {
  return Boolean(process.env.NS_API_KEY);
}

export async function findNearestStation(
  point: LatLon,
  locale: AppLocale = "de"
): Promise<NsStation | null> {
  const url = `${NS_BASE}/reisinformatie-api/api/v2/stations/nearest?lat=${point.lat}&lng=${point.lon}`;
  const res = await fetch(url, {
    headers: headers(locale),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(NS_STRINGS[locale].stationsApiError(res.status));
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
  stationCode: string,
  locale: AppLocale = "de"
): Promise<OvFietsAvailability> {
  const url = `${NS_BASE}/reisinformatie-api/api/v3/ovfiets/${stationCode}`;
  const res = await fetch(url, {
    headers: headers(locale),
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
  dateTime: string,
  locale: AppLocale = "de"
): Promise<TripSummary[]> {
  const url =
    `${NS_BASE}/reisinformatie-api/api/v3/trips?fromStation=${fromStationCode}` +
    `&toStation=${toStationCode}&dateTime=${encodeURIComponent(dateTime)}`;
  const res = await fetch(url, {
    headers: headers(locale),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(NS_STRINGS[locale].tripsApiError(res.status));
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

/**
 * Builds a TrainInfo result for one already-resolved leg (from -> to).
 * Shared by every feature that needs an NS trip lookup (train-return panel,
 * scenic-route, signature-route) so the not-configured/error shapes stay
 * consistent everywhere.
 */
export async function buildTrainInfo(
  from: StationInfo,
  to: StationInfo,
  dateTime: string,
  nsConfigured: boolean,
  locale: AppLocale = "de"
): Promise<TrainInfo> {
  if (!nsConfigured) {
    return { configured: false, message: NS_STRINGS[locale].notConfigured };
  }
  if (!from.code || !to.code) {
    return { configured: true, error: NS_STRINGS[locale].noStationNearby };
  }

  try {
    const [trips, ovFiets] = await Promise.all([
      planTrip(from.code, to.code, dateTime, locale),
      ovFietsAvailability(from.code, locale),
    ]);
    return { configured: true, fromStation: from, toStation: to, trips, ovFiets };
  } catch (err) {
    return {
      configured: true,
      error: err instanceof Error ? err.message : NS_STRINGS[locale].queryFailed,
    };
  }
}
