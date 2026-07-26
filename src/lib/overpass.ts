import { routing, type AppLocale } from "@/i18n/routing";
import { distance } from "./geo";
import { OVERPASS_STRINGS, POI_CATEGORY_LABELS } from "./i18nStrings";
import type { Knooppunt, LatLon, POI, POICategory, RoadTypeBreakdown, RoadTypeResult, RoadTypeSegment } from "./types";

// Two genuinely independent public mirrors -- overpass-api.de's own lz4
// load-balanced frontend was deliberately left out (same operator's
// infrastructure, so it can be overloaded at the exact same moment as the
// main one); Kumi Systems is a separately operated instance. Since
// runOverpassQuery below races every endpoint concurrently instead of
// trying them one after another, adding a mirror here no longer costs an
// extra sequential timeout slice in the worst case -- worst case stays
// bounded by a single timeoutMs regardless of list length, so this list
// could grow if another genuinely independent public instance turns out to
// be worth adding.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
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
  /** Present on ways queried with `out geom;` -- the full node-by-node line, used to measure length. */
  geometry?: { lat: number; lon: number }[];
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

// A previous version retried 429s on the same endpoint (with a sleep) and,
// if every mirror still failed, waited and retried the whole list again --
// meant to ride out brief load spikes, but a report of route planning
// taking 3+ minutes traced straight back to this: with a 30s per-request
// timeout, 3 endpoints tried *sequentially*, up to 2 attempts each, and a
// second full round, a genuinely slow moment could add up to several
// minutes. That budget was set back when every API route had to fit inside
// Vercel's default 60s ceiling; now that Fluid Compute is confirmed enabled
// (see /api/plan/route.ts) and those routes run with 120-150s of budget,
// there's room to be considerably more patient again -- this timeout was
// raised from an earlier, tighter 18s now that a single retry (below) can
// afford to wait this long twice.
const REQUEST_TIMEOUT_MS = 25000;
// [timeout:…] inside each query template below matches this, a few seconds
// under the client abort so Overpass itself gives up and returns a clean
// error before our own connection gives up on it.
const DEFAULT_QUERY_TIMEOUT_S = 22;

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

async function attemptOverpassEndpoint(
  endpoint: string,
  query: string,
  timeoutMs: number,
  locale: AppLocale
): Promise<OverpassResponse> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: OVERPASS_HEADERS,
      body: "data=" + encodeURIComponent(query),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new Error(summarizeErrorBody(res.status, res.statusText, bodyText, locale));
    }
    return await res.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${endpoint} -> ${message}`);
  }
}

// Trying mirrors one after another means a currently-slow mirror burns its
// whole timeout slot before the next one even starts -- three consecutive
// real-world reports of "both mirrors timed out" with substantially
// different query costs/radii each time (a fix meant to help never changed
// the outcome) pointed at this sequential design itself as the problem, not
// query cost: whichever mirror happened to be struggling at that moment
// blocked the other, healthier one from ever getting a chance in time.
// Racing every mirror at once instead means only the *slowest* attempt sets
// the worst case (bounded by timeoutMs regardless of how many mirrors are
// tried), while a single healthy mirror answering quickly still wins
// immediately -- strictly more resilient for the same worst-case latency
// budget, not a trade-off between them.
async function raceOverpassMirrors(
  query: string,
  timeoutMs: number,
  locale: AppLocale
): Promise<OverpassResponse> {
  return Promise.any(OVERPASS_ENDPOINTS.map((endpoint) => attemptOverpassEndpoint(endpoint, query, timeoutMs, locale)));
}

function aggregateErrorMessages(err: unknown): string[] {
  if (err instanceof AggregateError) return err.errors.map((e) => (e instanceof Error ? e.message : String(e)));
  return [err instanceof Error ? err.message : String(err)];
}

// A single retry, not the old multi-round/multi-attempt-per-mirror design
// that caused the 3+ minute report -- both mirrors failing at once could
// mean genuinely overloaded public infrastructure at that exact moment
// (seen in production even after switching to racing above), and a short
// pause before trying both again once more gives that a real chance to
// clear, rather than a permanent failure on a transient blip. This is
// affordable now that the heavy routes run with 120-150s of maxDuration
// budget (Fluid Compute is enabled, see /api/plan/route.ts) instead of the
// 60s it used to be squeezed into.
const RETRY_DELAY_MS = 4000;

async function runOverpassQuery(
  query: string,
  locale: AppLocale = routing.defaultLocale,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<OverpassResponse> {
  try {
    return await raceOverpassMirrors(query, timeoutMs, locale);
  } catch (firstErr) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    try {
      return await raceOverpassMirrors(query, timeoutMs, locale);
    } catch (secondErr) {
      const messages = [...aggregateErrorMessages(firstErr), ...aggregateErrorMessages(secondErr)];
      const sawOverloadSignal = messages.some((m) => /HTTP (429|502|503|504)/.test(m));
      const strings = OVERPASS_STRINGS[locale];
      const hint = sawOverloadSignal ? strings.overloadHint : "";
      throw new Error(`${strings.allServersFailed}\n${messages.join("\n")}${hint}`);
    }
  }
}

/** Fetches Dutch cycle node-network points (rcn_ref) within radiusM of center. */
export async function fetchKnooppunten(
  center: LatLon,
  radiusM: number,
  locale: AppLocale = routing.defaultLocale
): Promise<Knooppunt[]> {
  const query = `[out:json][timeout:${DEFAULT_QUERY_TIMEOUT_S}];
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
  locale: AppLocale = routing.defaultLocale
): Promise<POI[]> {
  if (route.length === 0) return [];

  const step = Math.max(1, Math.ceil(route.length / maxPoints));
  const sampled = route.filter((_, i) => i % step === 0);
  const aroundArg = sampled.map((p) => `${p.lat},${p.lon}`).join(",");

  const filters = categories.flatMap((cat) => POI_FILTERS[cat]);
  const clauses = filters
    .map((f) => `  ${f}(around:${corridorM},${aroundArg});`)
    .join("\n");

  const query = `[out:json][timeout:${DEFAULT_QUERY_TIMEOUT_S}];
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
  /** Centroids of built-up landuse polygons (residential/commercial/industrial/retail), used as an anti-city signal. */
  urbanPoints: LatLon[];
};

const DEFAULT_AREA_POI_CATEGORIES: POICategory[] = ["cafe", "ice_cream", "fuel", "supermarket"];

// routePlanner's computeFeatureScores only ever checks a node's urbanScore
// within URBAN_RADIUS_M (600m) of that specific node -- so fetching
// residential/commercial/industrial/retail landuse polygons across the
// *entire* search radius (up to 70km for roundtrip planning) buys no extra
// scoring accuracy proportional to its cost. Landuse polygons are also, by a
// wide margin, the most expensive clause here: they cover a large fraction
// of any populated area's surface, so Overpass has to evaluate vastly more
// geometry for them than for the sparser point-like traffic/water/POI tags.
// Capping just this clause keeps the one clause whose cost scales worst with
// radius bounded, while every other clause still covers the full radius.
// Cut from an earlier 20km alongside routePlanner.ts's overall
// AREA_FEATURES_RADIUS_CAP_M (see there for why: identical, deterministic
// 504/timeout failures across both a request and its retry pointed at
// "this query is too expensive here", not transient overload).
const AREA_FEATURES_URBAN_RADIUS_CAP_M = 10000;
// The combined query below is the single heaviest Overpass request in the
// app (several way/polygon filters over a radius that can reach 35km after
// the cap above); a user report of reliable 504s here traced back to the
// 15s budget the latency fixes elsewhere cut every query down to, which
// wasn't enough for this one specifically. Timeout tuning alone can't fix a
// query that's genuinely too complex, which is why the urban-radius cap
// above comes first -- this just needs to cover what's left after that.
// Raised again (was 20s/23s) now that this query's callers (/api/plan,
// /api/plan-alternatives) run with 120-150s of maxDuration instead of 60s
// (Fluid Compute is enabled, see /api/plan/route.ts), leaving real room to
// let a genuinely slow-but-not-dead response actually finish, plus this
// same query now gets one retry (see runOverpassQuery's RETRY_DELAY_MS).
const AREA_FEATURES_TIMEOUT_S = 35;
const AREA_FEATURES_REQUEST_TIMEOUT_MS = 38000;

/**
 * Single combined query for the criteria that bias knooppunt selection:
 * traffic signals/crossings (fewer nearby = better), water and green space
 * (more nearby = better), built-up/residential land (fewer nearby = better,
 * see routePlanner's urbanScore), and the rider's selected POI categories
 * (more nearby = better). One Overpass round-trip instead of several, using
 * `out center` so way/relation results (water bodies, forests, landuse
 * polygons) also come back as a single point.
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
  poiCategories: POICategory[] = DEFAULT_AREA_POI_CATEGORIES,
  locale: AppLocale = routing.defaultLocale
): Promise<AreaFeatures> {
  const around = `around:${radiusM},${center.lat},${center.lon}`;
  const urbanAround = `around:${Math.min(radiusM, AREA_FEATURES_URBAN_RADIUS_CAP_M)},${center.lat},${center.lon}`;
  const attractionClauses = includeAttractions
    ? `
  node["tourism"](${around});
  way["tourism"](${around});
  node["historic"](${around});
  way["historic"](${around});`
    : "";
  const effectivePoiCategories = poiCategories.length > 0 ? poiCategories : DEFAULT_AREA_POI_CATEGORIES;
  const poiClauses = effectivePoiCategories
    .flatMap((cat) => POI_FILTERS[cat])
    .map((f) => `  ${f}(${around});`)
    .join("\n");
  const query = `[out:json][timeout:${AREA_FEATURES_TIMEOUT_S}];
(
  node["highway"~"^(traffic_signals|crossing)$"](${around});
  node["natural"="water"](${around});
  way["natural"="water"](${around});
  way["waterway"](${around});
  way["natural"="wood"](${around});
  way["landuse"~"^(forest|wood)$"](${around});
  way["landuse"~"^(residential|commercial|industrial|retail)$"](${urbanAround});
${poiClauses}${attractionClauses}
);
out center;`;

  const data = await runOverpassQuery(query, locale, AREA_FEATURES_REQUEST_TIMEOUT_MS);
  const elements = data.elements ?? [];

  const features: AreaFeatures = {
    trafficPoints: [],
    waterPoints: [],
    greenPoints: [],
    poiPoints: [],
    attractionPoints: [],
    urbanPoints: [],
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
    else if (bucket === "urban") features.urbanPoints.push(point);
  }
  return features;
}

const AREA_POI_AMENITIES = new Set(["cafe", "ice_cream", "fuel"]);
const AREA_POI_SHOPS = new Set(["ice_cream", "supermarket"]);

function bucketAreaFeature(
  tags: Record<string, string>
): "traffic" | "water" | "green" | "poi" | "attraction" | "urban" | null {
  if (tags.highway === "traffic_signals" || tags.highway === "crossing")
    return "traffic";
  if (tags.natural === "water" || tags.waterway) return "water";
  if (
    tags.natural === "wood" ||
    tags.landuse === "forest" ||
    tags.landuse === "wood"
  )
    return "green";
  if (tags.landuse && ["residential", "commercial", "industrial", "retail"].includes(tags.landuse))
    return "urban";
  if (
    (tags.amenity && AREA_POI_AMENITIES.has(tags.amenity)) ||
    (tags.shop && AREA_POI_SHOPS.has(tags.shop))
  )
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
  locale: AppLocale = routing.defaultLocale
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

  const query = `[out:json][timeout:${DEFAULT_QUERY_TIMEOUT_S}];
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
  locale: AppLocale = routing.defaultLocale
): Promise<TownCandidate[]> {
  const query = `[out:json][timeout:${DEFAULT_QUERY_TIMEOUT_S}];
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

const ROAD_TYPE_CORRIDOR_M = 20;
const ROAD_TYPE_MAX_SAMPLE_POINTS = 150;

function classifyHighway(highway: string | undefined): keyof RoadTypeBreakdown {
  switch (highway) {
    case "cycleway":
      return "cyclewayPct";
    case "residential":
    case "living_street":
    case "service":
    case "pedestrian":
      return "residentialPct";
    case "primary":
    case "secondary":
    case "tertiary":
    case "trunk":
    case "unclassified":
      return "mainRoadPct";
    default:
      return "otherPct";
  }
}

// A sample point further than this from every candidate way's nearest vertex
// is treated as unmatched (carries the previous segment's type forward)
// rather than trusting a distant, probably-unrelated way.
const ROAD_TYPE_MATCH_MAX_M = 30;
// Cheap lat/lon bounding check before the more expensive haversine distance()
// call -- rules out most vertices at a glance so classifying ~150 sample
// points against every returned way's geometry stays fast.
const ROAD_TYPE_MATCH_MAX_DEG = 0.0005;

/**
 * Best-effort classification of the road surface a route actually follows
 * (dedicated cycleway vs. residential/traffic-calmed street vs. a normal
 * road shared with car traffic). Matches `highway=*` ways within a tight
 * corridor of the route geometry, then map-matches each sampled route point
 * to its nearest way vertex to classify that specific stretch -- this both
 * feeds the aggregate percentage breakdown (weighted by the route's own
 * classified distance, not just the matched ways' total length) and produces
 * contiguous colored segments so the map can show *where* the cycleway ends
 * and the residential street begins, not just an overall ratio.
 * Returns null (rather than throwing) on any Overpass failure, since this is
 * a nice-to-have transparency feature, not something that should block the
 * route itself from displaying.
 */
export async function fetchRoadTypeBreakdown(
  route: LatLon[],
  locale: AppLocale = routing.defaultLocale
): Promise<RoadTypeResult | null> {
  if (route.length < 2) return null;

  const step = Math.max(1, Math.ceil(route.length / ROAD_TYPE_MAX_SAMPLE_POINTS));
  const sampleIndices: number[] = [];
  for (let i = 0; i < route.length; i += step) sampleIndices.push(i);
  if (sampleIndices[sampleIndices.length - 1] !== route.length - 1) {
    sampleIndices.push(route.length - 1);
  }
  const sampled = sampleIndices.map((i) => route[i]);
  const aroundArg = sampled.map((p) => `${p.lat},${p.lon}`).join(",");

  const query = `[out:json][timeout:${DEFAULT_QUERY_TIMEOUT_S}];
way["highway"](around:${ROAD_TYPE_CORRIDOR_M},${aroundArg});
out geom;`;

  let data: OverpassResponse;
  try {
    data = await runOverpassQuery(query, locale);
  } catch {
    return null;
  }

  const seenWayIds = new Set<number>();
  const ways: { type: keyof RoadTypeBreakdown; geometry: LatLon[] }[] = [];
  for (const el of data.elements ?? []) {
    if (el.type !== "way" || seenWayIds.has(el.id) || !el.geometry || el.geometry.length < 2) continue;
    seenWayIds.add(el.id);
    ways.push({ type: classifyHighway(el.tags?.highway), geometry: el.geometry });
  }
  if (ways.length === 0) return null;

  function nearestType(point: LatLon): keyof RoadTypeBreakdown | null {
    let best: keyof RoadTypeBreakdown | null = null;
    let bestDist = ROAD_TYPE_MATCH_MAX_M;
    for (const way of ways) {
      for (const v of way.geometry) {
        if (
          Math.abs(v.lat - point.lat) > ROAD_TYPE_MATCH_MAX_DEG ||
          Math.abs(v.lon - point.lon) > ROAD_TYPE_MATCH_MAX_DEG
        ) {
          continue;
        }
        const d = distance(point, v);
        if (d < bestDist) {
          bestDist = d;
          best = way.type;
        }
      }
    }
    return best;
  }

  // Carry the previous match forward across unmatched samples so a brief gap
  // in the query results doesn't fragment one continuous stretch into noise.
  let lastKnown: keyof RoadTypeBreakdown = "otherPct";
  const sampleTypes = sampled.map((p) => {
    const matched = nearestType(p);
    if (matched) lastKnown = matched;
    return lastKnown;
  });

  const segments: RoadTypeSegment[] = [];
  for (let i = 0; i < sampleIndices.length; i++) {
    const startIdx = sampleIndices[i];
    const endIdx = i + 1 < sampleIndices.length ? sampleIndices[i + 1] : route.length - 1;
    const points = route.slice(startIdx, endIdx + 1);
    const type = sampleTypes[i];
    const prev = segments[segments.length - 1];
    if (prev && prev.type === type) {
      prev.points.push(...points.slice(1));
    } else if (points.length > 0) {
      segments.push({ points, type });
    }
  }

  const bucketM: RoadTypeBreakdown = { cyclewayPct: 0, residentialPct: 0, mainRoadPct: 0, otherPct: 0 };
  let totalM = 0;
  for (const seg of segments) {
    let lengthM = 0;
    for (let i = 1; i < seg.points.length; i++) lengthM += distance(seg.points[i - 1], seg.points[i]);
    bucketM[seg.type] += lengthM;
    totalM += lengthM;
  }
  if (totalM === 0) return null;

  return {
    breakdown: {
      cyclewayPct: Math.round((bucketM.cyclewayPct / totalM) * 100),
      residentialPct: Math.round((bucketM.residentialPct / totalM) * 100),
      mainRoadPct: Math.round((bucketM.mainRoadPct / totalM) * 100),
      otherPct: Math.round((bucketM.otherPct / totalM) * 100),
    },
    segments,
  };
}

const EXCLUDED_HIGHWAY_CLASSES = [
  "primary",
  "primary_link",
  "trunk",
  "trunk_link",
  "secondary",
  "secondary_link",
];
const EXCLUDED_ROAD_CORRIDOR_M = 15;
const EXCLUDED_ROAD_MAX_SAMPLE_POINTS = 20;

/**
 * Whether a single OSRM leg's geometry runs anywhere near a primary/trunk/
 * secondary road (or a _link variant) -- used by "avoid main roads" (see
 * routePlanner.ts's avoidExcludedRoads()) to decide whether a leg needs
 * rerouting. A narrow, per-leg query (legs are short) rather than checking
 * the whole route's search area at once, which would be far too large an
 * Overpass request for anything but a short ride.
 */
export async function legCrossesExcludedRoad(
  geometry: LatLon[],
  locale: AppLocale = routing.defaultLocale
): Promise<boolean> {
  if (geometry.length < 2) return false;

  const step = Math.max(1, Math.ceil(geometry.length / EXCLUDED_ROAD_MAX_SAMPLE_POINTS));
  const sampled = geometry.filter((_, i) => i % step === 0);
  const aroundArg = sampled.map((p) => `${p.lat},${p.lon}`).join(",");

  const highwayPattern = `^(${EXCLUDED_HIGHWAY_CLASSES.join("|")})$`;
  const query = `[out:json][timeout:${DEFAULT_QUERY_TIMEOUT_S}];
way["highway"~"${highwayPattern}"](around:${EXCLUDED_ROAD_CORRIDOR_M},${aroundArg});
out ids 1;`;

  try {
    const data = await runOverpassQuery(query, locale);
    return (data.elements ?? []).length > 0;
  } catch {
    // Best-effort: if the check itself fails, don't block the route on it --
    // the rider still gets a route, just without the guaranteed exclusion
    // for this leg.
    return false;
  }
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
