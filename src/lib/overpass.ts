import type { AppLocale } from "@/i18n/routing";
import { OVERPASS_STRINGS, POI_CATEGORY_LABELS } from "./i18nStrings";
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

// 429 means the free instance is throttling us and is worth one short-delay
// retry (its rate limits typically refill within a couple seconds). 502/503/504
// mean the query itself is slow or the server is overloaded — retrying the
// same endpoint right away rarely helps and just adds latency, so those fall
// straight through to the next mirror instead.
const RETRY_STATUS = 429;
const MAX_ATTEMPTS_PER_ENDPOINT = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(res: Response): number {
  const retryAfter = Number(res.headers.get("Retry-After"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 5000);
  }
  return 2000;
}

/** Overpass error pages are full HTML documents; showing that raw is just noise for users. */
function summarizeErrorBody(status: number, statusText: string, body: string, locale: AppLocale): string {
  const looksLikeHtml = body.trimStart().startsWith("<");
  if (!looksLikeHtml) {
    const snippet = body.trim().slice(0, 300);
    return snippet ? `HTTP ${status} ${statusText}: ${snippet}` : `HTTP ${status} ${statusText}`;
  }

  const reasons = OVERPASS_STRINGS[locale].reasons;
  return `HTTP ${status} ${statusText}${reasons[status] ? ` (${reasons[status]})` : ""}`;
}

async function runOverpassQuery(query: string, locale: AppLocale = "de"): Promise<OverpassResponse> {
  const attempts: string[] = [];
  let sawOverloadSignal = false;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_ENDPOINT; attempt++) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: OVERPASS_HEADERS,
          body: "data=" + encodeURIComponent(query),
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
          sawOverloadSignal = true;
          const bodyText = await res.text().catch(() => "");
          attempts.push(`${endpoint} -> ${summarizeErrorBody(res.status, res.statusText, bodyText, locale)}`);

          if (res.status === RETRY_STATUS && attempt < MAX_ATTEMPTS_PER_ENDPOINT) {
            await sleep(retryDelayMs(res));
            continue;
          }
          break;
        }
        return await res.json();
      } catch (err) {
        attempts.push(
          `${endpoint} -> ${err instanceof Error ? err.message : String(err)}`
        );
        break;
      }
    }
  }

  const strings = OVERPASS_STRINGS[locale];
  const hint = sawOverloadSignal ? strings.overloadHint : "";
  throw new Error(`${strings.allServersFailed}\n${attempts.join("\n")}${hint}`);
}

/** Fetches Dutch cycle node-network points (rcn_ref) within radiusM of center. */
export async function fetchKnooppunten(
  center: LatLon,
  radiusM: number,
  locale: AppLocale = "de"
): Promise<Knooppunt[]> {
  const query = `[out:json][timeout:25];
node["rcn_ref"](around:${radiusM},${center.lat},${center.lon});
out body;`;

  const data = await runOverpassQuery(query, locale);
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
  maxPoints = 120,
  locale: AppLocale = "de"
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

  const data = await runOverpassQuery(query, locale);
  const elements = data.elements ?? [];

  return elements
    .filter((el) => el.type === "node")
    .map((el): POI => ({
      id: el.id,
      category: categorize(el.tags ?? {}),
      name: el.tags?.name ?? categoryLabel(categorize(el.tags ?? {}), locale),
      lat: el.lat!,
      lon: el.lon!,
    }));
}

export type AreaFeatures = {
  trafficPoints: LatLon[];
  waterPoints: LatLon[];
  greenPoints: LatLon[];
  poiPoints: LatLon[];
  attractionPoints: LatLon[];
};

/**
 * Single combined query for the criteria that bias knooppunt selection:
 * traffic signals/crossings (fewer nearby = better), water and green space
 * (more nearby = better), and cafes/ice cream (more nearby = better). One
 * Overpass round-trip instead of four, using `out center` so way/relation
 * results (water bodies, forests) also come back as a single point.
 *
 * `includeAttractions` folds the tourism/historic tag query in too (used by
 * routePlanner, whose search radius is small enough that this stays cheap)
 * instead of a separate request — callers that don't need it (destinations,
 * scenic-route, which search much larger areas) leave it off so their query
 * doesn't grow for data they'd throw away anyway.
 */
export async function fetchAreaFeatures(
  center: LatLon,
  radiusM: number,
  includeAttractions = false,
  locale: AppLocale = "de"
): Promise<AreaFeatures> {
  const around = `around:${radiusM},${center.lat},${center.lon}`;
  const attractionClauses = includeAttractions
    ? `
  node["tourism"](${around});
  way["tourism"](${around});
  node["historic"](${around});
  way["historic"](${around});`
    : "";
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
  node["shop"="ice_cream"](${around});${attractionClauses}
);
out center;`;

  const data = await runOverpassQuery(query, locale);
  const elements = data.elements ?? [];

  const features: AreaFeatures = {
    trafficPoints: [],
    waterPoints: [],
    greenPoints: [],
    poiPoints: [],
    attractionPoints: [],
  };
  for (const el of elements) {
    const point = elementPoint(el);
    if (!point) continue;
    const bucket = bucketAreaFeature(el.tags ?? {});
    if (bucket === "traffic") features.trafficPoints.push(point);
    else if (bucket === "water") features.waterPoints.push(point);
    else if (bucket === "green") features.greenPoints.push(point);
    else if (bucket === "poi") features.poiPoints.push(point);
    else if (bucket === "attraction") features.attractionPoints.push(point);
  }
  return features;
}

function bucketAreaFeature(
  tags: Record<string, string>
): "traffic" | "water" | "green" | "poi" | "attraction" | null {
  if (tags.highway === "traffic_signals" || tags.highway === "crossing")
    return "traffic";
  if (tags.natural === "water" || tags.waterway) return "water";
  if (
    tags.natural === "wood" ||
    tags.landuse === "forest" ||
    tags.landuse === "wood"
  )
    return "green";
  if (tags.amenity === "cafe" || tags.amenity === "ice_cream" || tags.shop === "ice_cream")
    return "poi";
  if (tags.tourism || tags.historic) return "attraction";
  return null;
}

/**
 * Density of tourism and historic features (OSM tourism=* / historic=* tags)
 * around each of the given town centers ("Ortskern"), used as an
 * attractiveness signal for destination suggestions. One Overpass query
 * with a separate around-circle per center (not a polyline-around across
 * all centers, which would also pick up everything along the straight line
 * connecting distant towns).
 */
export async function fetchTourismHistoricPoints(
  centers: LatLon[],
  radiusM: number,
  locale: AppLocale = "de"
): Promise<LatLon[]> {
  if (centers.length === 0) return [];

  const clauses = centers.flatMap((c) => {
    const around = `around:${radiusM},${c.lat},${c.lon}`;
    return [
      `node["tourism"](${around});`,
      `way["tourism"](${around});`,
      `node["historic"](${around});`,
      `way["historic"](${around});`,
    ];
  });

  const query = `[out:json][timeout:30];
(
${clauses.map((c) => "  " + c).join("\n")}
);
out center;`;

  const data = await runOverpassQuery(query, locale);
  const elements = data.elements ?? [];
  return elements
    .map((el) => elementPoint(el))
    .filter((p): p is LatLon => p !== null);
}

export type TownCandidate = {
  name: string;
  lat: number;
  lon: number;
};

/** Fetches place=city/town/village points within radiusM of center, for one-way destination suggestions. */
export async function fetchTowns(
  center: LatLon,
  radiusM: number,
  locale: AppLocale = "de"
): Promise<TownCandidate[]> {
  const query = `[out:json][timeout:25];
node["place"~"^(city|town|village)$"](around:${radiusM},${center.lat},${center.lon});
out center;`;

  const data = await runOverpassQuery(query, locale);
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

function categoryLabel(cat: POICategory, locale: AppLocale): string {
  return POI_CATEGORY_LABELS[locale][cat];
}
