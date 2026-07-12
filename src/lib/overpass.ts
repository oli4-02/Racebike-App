import type { Knooppunt, LatLon, POI, POICategory } from "./types";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://lz4.overpass-api.de/api/interpreter",
];

// Overpass's usage policy requires a descriptive User-Agent; requests
// without one (or with a generic runtime default like Node's "node") are
// routinely rejected by its abuse-prevention layer, typically with 406 or
// 429. An explicit Accept header avoids the same layer content-negotiating
// its way to a response format it thinks we can't handle.
const OVERPASS_HEADERS = {
  "Content-Type": "application/x-www-form-urlencoded",
  Accept: "application/json",
  "User-Agent":
    "racebike-app/0.1 (personal cycling route planner; https://github.com/oli4-02/Racebike-App)",
};

type OverpassElement = {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

async function runOverpassQuery(query: string): Promise<OverpassResponse> {
  const attempts: string[] = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: OVERPASS_HEADERS,
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        const bodySnippet = (await res.text().catch(() => "")).slice(0, 300);
        attempts.push(
          `${endpoint} -> HTTP ${res.status} ${res.statusText}${
            bodySnippet ? `: ${bodySnippet}` : ""
          }`
        );
        continue;
      }
      return await res.json();
    } catch (err) {
      attempts.push(
        `${endpoint} -> ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  throw new Error(
    `Overpass-Anfrage an allen Servern fehlgeschlagen:\n${attempts.join("\n")}`
  );
}

/** Fetches Dutch cycle node-network points (rcn_ref) within radiusM of center. */
export async function fetchKnooppunten(
  center: LatLon,
  radiusM: number
): Promise<Knooppunt[]> {
  const query = `[out:json][timeout:25];
node["rcn_ref"](around:${radiusM},${center.lat},${center.lon});
out body;`;

  const data = await runOverpassQuery(query);
  const elements = data.elements ?? [];
  return elements
    .filter((el) => el.type === "node" && el.tags?.rcn_ref)
    .map((el) => ({
      id: el.id,
      ref: String(el.tags!.rcn_ref),
      lat: el.lat,
      lon: el.lon,
    }));
}

const POI_FILTERS: Record<POICategory, string[]> = {
  fuel: ['node["amenity"="fuel"]'],
  supermarket: ['node["shop"="supermarket"]'],
  ice_cream: ['node["amenity"="ice_cream"]', 'node["shop"="ice_cream"]'],
  cafe: ['node["amenity"="cafe"]'],
};

/** Fetches POIs within corridorM of the given route polyline (decimated for query size). */
export async function fetchPOIsNearRoute(
  route: LatLon[],
  categories: POICategory[],
  corridorM = 400,
  maxPoints = 120
): Promise<POI[]> {
  if (route.length === 0) return [];

  const step = Math.max(1, Math.ceil(route.length / maxPoints));
  const sampled = route.filter((_, i) => i % step === 0);
  const aroundArg = sampled.map((p) => `${p.lat},${p.lon}`).join(",");

  const filters = categories.flatMap((cat) => POI_FILTERS[cat]);
  const clauses = filters
    .map((f) => `  ${f}(around:${corridorM},${aroundArg});`)
    .join("\n");

  const query = `[out:json][timeout:25];
(
${clauses}
);
out body;`;

  const data = await runOverpassQuery(query);
  const elements = data.elements ?? [];

  return elements
    .filter((el) => el.type === "node")
    .map((el): POI => ({
      id: el.id,
      category: categorize(el.tags ?? {}),
      name: el.tags?.name ?? categoryLabel(categorize(el.tags ?? {})),
      lat: el.lat,
      lon: el.lon,
    }));
}

function categorize(tags: Record<string, string>): POICategory {
  if (tags.amenity === "fuel") return "fuel";
  if (tags.shop === "supermarket") return "supermarket";
  if (tags.amenity === "ice_cream" || tags.shop === "ice_cream")
    return "ice_cream";
  return "cafe";
}

function categoryLabel(cat: POICategory): string {
  switch (cat) {
    case "fuel":
      return "Tankstelle";
    case "supermarket":
      return "Supermarkt";
    case "ice_cream":
      return "Eisdiele";
    case "cafe":
      return "Café";
  }
}
