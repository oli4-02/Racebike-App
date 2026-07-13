import type { AppLocale } from "@/i18n/routing";
import { bearing, distance, angleDiff } from "./geo";
import { ROUTE_PLANNER_STRINGS } from "./i18nStrings";
import { fetchAreaFeatures, fetchKnooppunten, type AreaFeatures } from "./overpass";
import { routeChain, type OsrmLeg } from "./osrm";
import { resolveLocale } from "./resolveLocale";
import type {
  Knooppunt,
  LatLon,
  PlanRequest,
  PlannedRoute,
  Priorities,
  RouteLeg,
} from "./types";
import { DEFAULT_PRIORITIES } from "./types";

type ScoredNode = Knooppunt & { distFromStart: number; bearingFromStart: number };

type NodeFeatureScores = {
  trafficScore: number; // 0..1, higher = fewer nearby traffic signals/crossings
  natureScore: number; // 0..1, higher = more nearby water/forest
  poiScore: number; // 0..1, higher = more nearby cafes/ice cream
};

function clampNum(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function scoreNodes(start: LatLon, pool: Knooppunt[]): ScoredNode[] {
  return pool.map((n) => ({
    ...n,
    distFromStart: distance(start, n),
    bearingFromStart: bearing(start, n),
  }));
}

const TRAFFIC_RADIUS_M = 300;
const NATURE_RADIUS_M = 600;
const POI_RADIUS_M = 500;
const ATTRACTION_RADIUS_M = 500;

/**
 * Pre-computes per-node feature scores once so candidate scoring during
 * selection is just a map lookup. Reuses the same attractiveness signals as
 * the destination-suggestion scoring (/api/destinations): water proximity
 * (distance decay, not just a density count) and tourism/historic tag
 * density fold into natureScore/poiScore respectively, so a candidate that
 * happens to pass right by water or a sight scores higher without changing
 * which slider controls it.
 */
function computeFeatureScores(
  pool: Knooppunt[],
  features: AreaFeatures
): Map<number, NodeFeatureScores> {
  const map = new Map<number, NodeFeatureScores>();
  for (const node of pool) {
    const trafficCount = features.trafficPoints.filter(
      (p) => distance(node, p) <= TRAFFIC_RADIUS_M
    ).length;
    const trafficScore = 1 / (1 + trafficCount);

    const natureCount = [...features.waterPoints, ...features.greenPoints].filter(
      (p) => distance(node, p) <= NATURE_RADIUS_M
    ).length;
    const natureDensityScore = Math.min(1, natureCount / 3);
    const nearestWaterM =
      features.waterPoints.length > 0
        ? Math.min(...features.waterPoints.map((p) => distance(node, p)))
        : null;
    const waterProximityScore = nearestWaterM !== null ? 1 / (1 + nearestWaterM / 1000) : 0;
    const natureScore = (natureDensityScore + waterProximityScore) / 2;

    const poiCount = features.poiPoints.filter(
      (p) => distance(node, p) <= POI_RADIUS_M
    ).length;
    const poiDensityScore = Math.min(1, poiCount / 3);
    const attractionCount = features.attractionPoints.filter(
      (p) => distance(node, p) <= ATTRACTION_RADIUS_M
    ).length;
    const attractionScore = Math.min(1, attractionCount / 3);
    const poiScore = (poiDensityScore + attractionScore) / 2;

    map.set(node.id, { trafficScore, natureScore, poiScore });
  }
  return map;
}

/**
 * Combines distance-to-target fit with the user's weighted priorities into a
 * single score used to pick the best candidate at each step/sector. Distance
 * fit always has a baseline weight of 1 (routes still need to hit the
 * requested length); `shortestTime` additionally boosts that weight so a
 * direct, non-meandering path wins over scenic/POI detours.
 */
function scoreCandidate(
  node: ScoredNode,
  idealDistanceM: number,
  priorities: Priorities,
  featureScores: Map<number, NodeFeatureScores>
): number {
  const radiusFit =
    1 - Math.min(1, Math.abs(node.distFromStart - idealDistanceM) / idealDistanceM);
  const radiusWeight = 1 + priorities.shortestTime;
  const f = featureScores.get(node.id) ?? {
    trafficScore: 0.5,
    natureScore: 0,
    poiScore: 0,
  };

  return (
    radiusFit * radiusWeight +
    priorities.fewTrafficLights * f.trafficScore +
    priorities.nature * f.natureScore +
    priorities.poiDensity * f.poiScore
  );
}

// Half-width of the bearing cone used for a direction-biased ("tube-shaped")
// roundtrip -- wide enough that the loop still has two distinct sides to go
// out on and come back on, narrow enough that it reads as "heading that way"
// rather than "roughly everywhere".
const DIRECTIONAL_CONE_HALF_WIDTH = 75;
const ROUNDTRIP_DETOUR_FACTOR = 1.3; // roads wind more than straight lines

/**
 * How far out a roundtrip should reach for a given target distance: a full
 * loop reaches only `target / (2*pi*detour)` from the start, while an
 * out-and-back shape (direction set) covers the same distance going roughly
 * `target / (2*detour)` out and the same back. Shared by node selection, the
 * refine loop, and the Overpass search radius so all three agree on how far
 * out "direction-biased" actually means -- if the search radius doesn't
 * reach as far as the ideal radius, there are no candidate knooppunten out
 * there to pick regardless of what the selection logic wants.
 */
function roundTripIdealRadius(targetDistanceM: number, hasDirection: boolean): number {
  return hasDirection
    ? targetDistanceM / (2 * ROUNDTRIP_DETOUR_FACTOR)
    : targetDistanceM / (2 * Math.PI * ROUNDTRIP_DETOUR_FACTOR);
}

/**
 * Picks knooppunten for a roundtrip loop, one per bearing sector (weighted by
 * priorities), then sorts them by bearing so the resulting sequence traces a
 * simple (non-crossing) loop. This approximates the real knooppunten-network
 * topology without needing to reconstruct its full routed-way graph from
 * Overpass relations.
 *
 * Without a `direction`, sectors are spread across the full 360° around the
 * start, which is the right shape for "explore what's nearby" but always
 * reads as circling the start town rather than actually going anywhere --
 * for Amsterdam specifically, this is what makes the loop hug the city
 * instead of heading out into the countryside. With a `direction`, sectors
 * are instead spread across a narrower cone facing that bearing and the
 * radius is computed for an out-and-back shape (reaching much further out
 * per km than a full loop does), producing the "go this way for a while,
 * then loop back" shape that was being asked for.
 */
function selectRoundTripNodes(
  start: LatLon,
  pool: Knooppunt[],
  targetDistanceM: number,
  priorities: Priorities,
  featureScores: Map<number, NodeFeatureScores>,
  direction?: number | null
): Knooppunt[] {
  const hasDirection = direction !== null && direction !== undefined;
  const idealRadius = roundTripIdealRadius(targetDistanceM, hasDirection);
  const scored = scoreNodes(start, pool);
  const inCone = hasDirection
    ? scored.filter((n) => Math.abs(angleDiff(direction!, n.bearingFromStart)) <= DIRECTIONAL_CONE_HALF_WIDTH)
    : scored;

  // Higher shortestTime priority means fewer, more direct hops.
  const sectorCount = clampNum(
    Math.round((targetDistanceM / 8000) * (1 - 0.25 * priorities.shortestTime)),
    5,
    10
  );
  const angleSpan = hasDirection ? DIRECTIONAL_CONE_HALF_WIDTH * 2 : 360;
  const sectorWidth = angleSpan / sectorCount;
  const coneStart = hasDirection ? direction! - DIRECTIONAL_CONE_HALF_WIDTH : 0;
  const buckets: ScoredNode[][] = Array.from({ length: sectorCount }, () => []);
  inCone.forEach((n) => {
    const relativeBearing = (((n.bearingFromStart - coneStart) % 360) + 360) % 360;
    const idx = clampNum(Math.floor(relativeBearing / sectorWidth), 0, sectorCount - 1);
    buckets[idx].push(n);
  });

  // Buckets are already in angular order by construction (index 0 is the
  // sector nearest coneStart, increasing from there), so the chosen nodes
  // trace a simple loop without needing an extra sort -- which would in
  // fact misorder a direction cone that straddles the 0/360 wrap.
  return buckets
    .filter((b) => b.length > 0)
    .map((bucket) => {
      bucket.sort(
        (a, b) =>
          scoreCandidate(b, idealRadius, priorities, featureScores) -
          scoreCandidate(a, idealRadius, priorities, featureScores)
      );
      return bucket[0];
    });
}

const ONE_WAY_CONE_HALF_WIDTH = 55;
// How far a hop is allowed to end up farther from the destination than the
// point it started from, as a fraction of the average hop length -- enough
// slack for an attractive short detour, not enough to let the route
// backtrack towards where it came from.
const ONE_WAY_BACKWARD_TOLERANCE_FRACTION = 0.35;

/** Whether moving from fromPoint to candidate gets meaningfully closer to the destination (within a small tolerance). */
function isForwardProgress(
  candidate: LatLon,
  fromPoint: LatLon,
  destination: LatLon,
  toleranceM: number
): boolean {
  return distance(candidate, destination) <= distance(fromPoint, destination) + toleranceM;
}

/**
 * Builds a chain of knooppunten from start towards a fixed destination
 * (Modus A: typed address, or Modus B: a picked suggestion), one hop at a
 * time. Each hop is chosen -- and each candidate filtered -- relative to
 * wherever the *previous* hop landed, not the original start, and must make
 * real progress towards the destination (within a small tolerance for a
 * worthwhile detour). Scoring candidates only by their distance from the
 * fixed start (as this used to do) let a later hop end up geographically
 * behind an earlier one, which OSRM then "fixed" by looping back -- the
 * zigzags reported for Amsterdam→Groningen. The detour factor -- how much
 * longer than the straight line the ride is allowed to be -- is itself
 * controlled by the shortestTime priority.
 */
function selectOneWayNodes(
  start: LatLon,
  destination: LatLon,
  pool: Knooppunt[],
  priorities: Priorities,
  featureScores: Map<number, NodeFeatureScores>
): { nodes: Knooppunt[]; targetDistanceM: number } {
  const straightDistanceM = distance(start, destination);
  const detourFactor = 1.15 + 0.3 * (1 - priorities.shortestTime);
  const targetDistanceM = straightDistanceM * detourFactor;

  const stepCount = clampNum(
    Math.round((targetDistanceM / 8000) * (1 - 0.25 * priorities.shortestTime)),
    2,
    9
  );
  const stepLengthM = targetDistanceM / (stepCount + 1);
  const toleranceM = stepLengthM * ONE_WAY_BACKWARD_TOLERANCE_FRACTION;

  const chosen: Knooppunt[] = [];
  const usedIds = new Set<number>();
  let current: LatLon = start;

  for (let i = 0; i < stepCount; i++) {
    const candidates = pool
      .filter((n) => !usedIds.has(n.id))
      .map((n) => ({
        node: n,
        distFromCurrent: distance(current, n),
        bearingFromCurrent: bearing(current, n),
      }))
      .filter(
        (c) =>
          isForwardProgress(c.node, current, destination, toleranceM) &&
          Math.abs(angleDiff(bearing(current, destination), c.bearingFromCurrent)) <=
            ONE_WAY_CONE_HALF_WIDTH
      );
    if (candidates.length === 0) break;

    candidates.sort(
      (a, b) =>
        scoreCandidate(
          { ...b.node, distFromStart: b.distFromCurrent, bearingFromStart: b.bearingFromCurrent },
          stepLengthM,
          priorities,
          featureScores
        ) -
        scoreCandidate(
          { ...a.node, distFromStart: a.distFromCurrent, bearingFromStart: a.bearingFromCurrent },
          stepLengthM,
          priorities,
          featureScores
        )
    );

    const best = candidates[0].node;
    chosen.push(best);
    usedIds.add(best.id);
    current = best;
  }

  return { nodes: chosen, targetDistanceM };
}

export function combineGeometry(legs: OsrmLeg[]): LatLon[] {
  const points: LatLon[] = [];
  legs.forEach((leg, i) => {
    const geom = i === 0 ? leg.geometry : leg.geometry.slice(1);
    points.push(...geom);
  });
  return points;
}

export function toRouteLegs(sequence: LatLon[], osrmLegs: OsrmLeg[]): RouteLeg[] {
  return osrmLegs.map((leg, i) => ({
    from: sequence[i],
    to: sequence[i + 1],
    distanceM: leg.distanceM,
    durationS: leg.durationS,
    geometry: leg.geometry,
  }));
}

async function reroute(sequence: LatLon[], locale: AppLocale) {
  const osrmLegs = await routeChain(sequence, locale);
  const totalDistanceM = osrmLegs.reduce((s, l) => s + l.distanceM, 0);
  const totalDurationS = osrmLegs.reduce((s, l) => s + l.durationS, 0);
  return { osrmLegs, totalDistanceM, totalDurationS };
}

const TOLERANCE = 0.2; // accept +/-20% of target distance
const MAX_REFINE_ITERATIONS = 3;

/**
 * Turns a chosen node sequence into an actual routed PlannedRoute: routes it
 * via OSRM, then iteratively drops/adds nodes to close in on the target
 * distance. Shared by planRoute (single route) and planRoundTripAlternatives
 * (several directional variants off the same node pool), so both stay in
 * sync with the same refine-loop behavior.
 */
async function finalizeRoute(
  req: Pick<PlanRequest, "mode" | "start" | "destination" | "direction">,
  nodes: Knooppunt[],
  targetDistanceM: number,
  pool: Knooppunt[],
  priorities: Priorities,
  featureScores: Map<number, NodeFeatureScores>,
  locale: AppLocale
): Promise<PlannedRoute> {
  const buildSequence = (ns: Knooppunt[]): LatLon[] =>
    req.mode === "roundtrip"
      ? [req.start, ...ns, req.start]
      : [req.start, ...ns, req.destination!];

  let sequence = buildSequence(nodes);
  let { osrmLegs, totalDistanceM, totalDurationS } = await reroute(sequence, locale);

  const minNodes = req.mode === "roundtrip" ? 2 : 0;

  for (let iter = 0; iter < MAX_REFINE_ITERATIONS; iter++) {
    const ratio = totalDistanceM / targetDistanceM;
    if (ratio >= 1 - TOLERANCE && ratio <= 1 + TOLERANCE) break;

    if (ratio > 1 + TOLERANCE && nodes.length > minNodes) {
      // Too long: drop the node whose surrounding legs add the most distance.
      const dropIndex = indexOfLargestDetour(osrmLegs);
      nodes = nodes.filter((_, i) => i !== dropIndex);
    } else if (ratio < 1 - TOLERANCE) {
      // Too short: add the best-scoring unused candidate that extends the
      // route. For one-way, the reference point is the last node reached so
      // far (not the fixed start) and the candidate must still make forward
      // progress towards the destination -- same reasoning as
      // selectOneWayNodes, otherwise this refinement step could reintroduce
      // the exact backtracking it's meant to fix. For a direction-biased
      // roundtrip, the same cone/out-and-back radius used by the initial
      // selection applies here too -- otherwise a route that came up short
      // gets "topped up" with a node picked with no direction preference at
      // all, quietly pulling a direction-biased route back into hugging the
      // start (the bug behind roundtrips still circling the start town even
      // with a direction chosen).
      const hasDirection = req.mode === "roundtrip" && req.direction !== null && req.direction !== undefined;
      const refineIdealDistance =
        req.mode === "roundtrip"
          ? roundTripIdealRadius(targetDistanceM, hasDirection)
          : targetDistanceM / (nodes.length + 2);
      const referencePoint =
        req.mode === "oneway" && nodes.length > 0 ? nodes[nodes.length - 1] : req.start;
      const boundsFilter =
        req.mode === "oneway"
          ? (n: ScoredNode) =>
              isForwardProgress(
                n,
                referencePoint,
                req.destination!,
                refineIdealDistance * ONE_WAY_BACKWARD_TOLERANCE_FRACTION
              ) &&
              Math.abs(
                angleDiff(bearing(referencePoint, req.destination!), n.bearingFromStart)
              ) <= ONE_WAY_CONE_HALF_WIDTH
          : hasDirection
            ? (n: ScoredNode) =>
                Math.abs(angleDiff(req.direction!, n.bearingFromStart)) <= DIRECTIONAL_CONE_HALF_WIDTH
            : undefined;

      const extra = pickExtraNode(
        referencePoint,
        pool,
        nodes,
        refineIdealDistance,
        priorities,
        featureScores,
        boundsFilter
      );
      if (!extra) break;
      nodes = [...nodes, extra];
    } else {
      break;
    }

    sequence = buildSequence(nodes);
    ({ osrmLegs, totalDistanceM, totalDurationS } = await reroute(sequence, locale));
  }

  return {
    mode: req.mode,
    knooppunten: nodes,
    legs: toRouteLegs(sequence, osrmLegs),
    geometry: combineGeometry(osrmLegs),
    totalDistanceM,
    totalDurationS,
  };
}

/** Fetches the shared knooppunt pool + area features once for a start point/search radius, reused by both planRoute and planRoundTripAlternatives. */
async function fetchPoolAndFeatures(
  start: LatLon,
  searchRadius: number,
  locale: AppLocale,
  strings: (typeof ROUTE_PLANNER_STRINGS)[AppLocale]
): Promise<{ pool: Knooppunt[]; featureScores: Map<number, NodeFeatureScores> }> {
  const [pool, areaFeatures] = await Promise.all([
    fetchKnooppunten(start, searchRadius, locale),
    fetchAreaFeatures(start, searchRadius, true, locale),
  ]);
  if (pool.length < 3) {
    throw new Error(strings.tooFewNodes);
  }
  return { pool, featureScores: computeFeatureScores(pool, areaFeatures) };
}

export async function planRoute(req: PlanRequest): Promise<PlannedRoute> {
  const priorities: Priorities = { ...DEFAULT_PRIORITIES, ...req.priorities };
  const locale = resolveLocale(req.locale);
  const strings = ROUTE_PLANNER_STRINGS[locale];

  if (req.mode === "oneway" && !req.destination) {
    throw new Error(strings.onewayDestinationRequired);
  }

  const approxTargetM =
    req.mode === "roundtrip"
      ? req.distanceKm * 1000
      : distance(req.start, req.destination!);
  const hasDirection = req.mode === "roundtrip" && req.direction !== null && req.direction !== undefined;

  const searchRadius =
    req.mode === "roundtrip"
      ? clampNum(roundTripIdealRadius(approxTargetM, hasDirection) * 1.2, 3000, hasDirection ? 70000 : 30000)
      : clampNum(approxTargetM * 0.9, 3000, 60000);

  const { pool, featureScores } = await fetchPoolAndFeatures(req.start, searchRadius, locale, strings);

  let nodes: Knooppunt[];
  let targetDistanceM: number;

  if (req.mode === "roundtrip") {
    targetDistanceM = req.distanceKm * 1000;
    nodes = selectRoundTripNodes(
      req.start,
      pool,
      targetDistanceM,
      priorities,
      featureScores,
      req.direction
    );
    if (nodes.length < 2) {
      throw new Error(strings.noSensibleRoute);
    }
  } else {
    const result = selectOneWayNodes(
      req.start,
      req.destination!,
      pool,
      priorities,
      featureScores
    );
    nodes = result.nodes;
    targetDistanceM = result.targetDistanceM;
  }

  return finalizeRoute(req, nodes, targetDistanceM, pool, priorities, featureScores, locale);
}

const ALTERNATIVE_CONCURRENCY = 2;

/** Runs async tasks with at most `limit` in flight at once, preserving result order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Generates several roundtrip route options off a single shared knooppunt
 * pool/feature fetch (one Overpass round-trip instead of `count`), each
 * biased towards a different compass direction so they read as genuinely
 * different rides rather than minor variations of the same loop. Without an
 * explicit `req.direction`, the directions are spread evenly around the
 * compass; with one, they're jittered around it so the user still gets a
 * choice while staying roughly in the direction they asked for.
 */
export async function planRoundTripAlternatives(
  req: PlanRequest,
  count = 5
): Promise<{ direction: number | null; route: PlannedRoute }[]> {
  const priorities: Priorities = { ...DEFAULT_PRIORITIES, ...req.priorities };
  const locale = resolveLocale(req.locale);
  const strings = ROUTE_PLANNER_STRINGS[locale];

  const targetDistanceM = req.distanceKm * 1000;
  // Every variant here gets a concrete direction (evenly spread, or jittered
  // around req.direction), so the search radius always needs the larger
  // out-and-back reach, never the smaller full-loop one.
  const searchRadius = clampNum(roundTripIdealRadius(targetDistanceM, true) * 1.2, 3000, 70000);
  const { pool, featureScores } = await fetchPoolAndFeatures(req.start, searchRadius, locale, strings);

  const directions: (number | null)[] =
    req.direction === null || req.direction === undefined
      ? Array.from({ length: count }, (_, i) => (360 / count) * i)
      : Array.from({ length: count }, (_, i) => {
          const spread = 60; // total jitter width around the chosen direction
          const offset = count > 1 ? -spread / 2 + (spread / (count - 1)) * i : 0;
          return (((req.direction! + offset) % 360) + 360) % 360;
        });

  const results = await mapWithConcurrency(directions, ALTERNATIVE_CONCURRENCY, async (direction) => {
    const nodes = selectRoundTripNodes(req.start, pool, targetDistanceM, priorities, featureScores, direction);
    if (nodes.length < 2) return null;
    const route = await finalizeRoute(
      { mode: "roundtrip", start: req.start, direction },
      nodes,
      targetDistanceM,
      pool,
      priorities,
      featureScores,
      locale
    );
    return { direction, route };
  });

  return results.filter((r): r is { direction: number | null; route: PlannedRoute } => r !== null);
}

function indexOfLargestDetour(legs: OsrmLeg[]): number {
  // The node between legs[i] and legs[i+1] is "responsible" for that pair's
  // combined length; pick the interior node whose pair is largest.
  let worstIndex = 0;
  let worstLength = -Infinity;
  for (let i = 0; i < legs.length - 1; i++) {
    const pairLength = legs[i].distanceM + legs[i + 1].distanceM;
    if (pairLength > worstLength) {
      worstLength = pairLength;
      worstIndex = i;
    }
  }
  return worstIndex;
}

function pickExtraNode(
  start: LatLon,
  pool: Knooppunt[],
  used: Knooppunt[],
  idealDistanceM: number,
  priorities: Priorities,
  featureScores: Map<number, NodeFeatureScores>,
  boundsFilter?: (n: ScoredNode) => boolean
): Knooppunt | null {
  const usedIds = new Set(used.map((n) => n.id));
  let candidates = scoreNodes(start, pool).filter((n) => !usedIds.has(n.id));
  if (boundsFilter) candidates = candidates.filter(boundsFilter);
  candidates.sort(
    (a, b) =>
      scoreCandidate(b, idealDistanceM, priorities, featureScores) -
      scoreCandidate(a, idealDistanceM, priorities, featureScores)
  );
  return candidates[0] ?? null;
}
