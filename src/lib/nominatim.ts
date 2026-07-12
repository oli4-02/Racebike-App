import type { LatLon } from "./types";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

// Netherlands bounding box, used only to bias (not restrict) search ranking.
const NL_VIEWBOX = "3.2,53.6,7.3,50.7";

// Nominatim's usage policy requires a descriptive User-Agent identifying the
// application; requests without one are routinely rate-limited or blocked.
const HEADERS = {
  "User-Agent": "racebike-app/0.1 (personal cycling route planner)",
};

export type GeocodeResult = {
  displayName: string;
  lat: number;
  lon: number;
};

export async function geocodeAddress(
  query: string
): Promise<GeocodeResult[]> {
  const url =
    `${NOMINATIM_BASE}/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}` +
    `&viewbox=${NL_VIEWBOX}&bounded=0`;

  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
  const data: NominatimSearchResult[] = await res.json();

  return data.map((d) => ({
    displayName: d.display_name,
    lat: parseFloat(d.lat),
    lon: parseFloat(d.lon),
  }));
}

type NominatimSearchResult = {
  display_name: string;
  lat: string;
  lon: string;
};

export async function reverseGeocode(point: LatLon): Promise<string | null> {
  const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${point.lat}&lon=${point.lon}`;
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.display_name ?? null;
}
