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
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

/** Node coordinates are on lat/lon directly; ways/relations need `out center` and use el.center. */
function elementPoint(el: OverpassElement): LatLon | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") {
    return { lat: el.lat, lon: el.lon };
  }
  if (el.center) return { lat: el.center.lat, lon: el.center.lon };
  return null;
}

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
      lat: el.lat!,
      lon: el.lon!,
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
      lat: el.lat!,
      lon: el.lon!,
    }));
}

export type AreaFeatures = {
  trafficPoints: LatLon[];
  naturePoints: LatLon[];
  poiPoints: LatLon[];
};

/**
 * Single combined query for the criteria that bias knooppunt selection:
 * traffic signals/crossings (fewer nearby = better), nature/water (more
 * nearby = better), and cafes/ice cream (more nearby = better). One
 * Overpass round-trip instead of three, using `out center` so way/relation
 * results (water bodies, forests) also come back as a single point.
 */
export async function fetchAreaFeatures(
  center: LatLon,
  radiusM: number
): Promise<AreaFeatures> {
  const around = `around:${radiusM},${center.lat},${center.lon}`;
  const query = `[out:json][timeout:25];
(
  node["highway"~"^(traffic_signals|crossing)$"](${around});
  node["natural"="water"](${around});
  way["natural"="water"](${around});
  way["waterway"](${around});
  way["natural"="wood"](${around});
  way["landuse"~"^(forest|wood)$"](${around});
  node["amenity"="cafe"](${around});
  node["amenity"="ice_cream"](${around});
  node["shop"="ice_cream"](${around});
);
out center;`;

  const data = await runOverpassQuery(query);
  const elements = data.elements ?? [];

  const features: AreaFeatures = { trafficPoints: [], naturePoints: [], poiPoints: [] };
  for (const el of elements) {
    const point = elementPoint(el);
    if (!point) continue;
    const bucket = bucketAreaFeature(el.tags ?? {});
    if (bucket === "traffic") features.trafficPoints.push(point);
    else if (bucket === "nature") features.naturePoints.push(point);
    else if (bucket === "poi") features.poiPoints.push(point);
  }
  return features;
}

function bucketAreaFeature(
  tags: Record<string, string>
): "traffic" | "nature" | "poi" | null {
  if (tags.highway === "traffic_signals" || tags.highway === "crossing")
    return "traffic";
  if (
    tags.natural === "water" ||
    tags.waterway ||
    tags.natural === "wood" ||
    tags.landuse === "forest" ||
    tags.landuse === "wood"
  )
    return "nature";
  if (tags.amenity === "cafe" || tags.amenity === "ice_cream" || tags.shop === "ice_cream")
    return "poi";
  return null;
}

export type TownCandidate = {
  name: string;
  lat: number;
  lon: number;
};

/** Fetches place=city/town points within radiusM of center, for one-way destination suggestions. */
export async function fetchTowns(
  center: LatLon,
  radiusM: number
): Promise<TownCandidate[]> {
  const query = `[out:json][timeout:25];
node["place"~"^(city|town)$"](around:${radiusM},${center.lat},${center.lon});
out center;`;

  const data = await runOverpassQuery(query);
  const elements = data.elements ?? [];

  return elements
    .filter((el) => el.tags?.name)
    .map((el) => {
      const point = elementPoint(el)!;
      return { name: el.tags!.name, lat: point.lat, lon: point.lon };
    })
    .filter((_, i, arr) => arr.findIndex((c) => c.name === arr[i].name) === i);
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
