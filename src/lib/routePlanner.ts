import type { AppLocale } from "@/i18n/routing";
import { bearing, distance, angleDiff } from "./geo";
import { ROUTE_PLANNER_STRINGS } from "./i18nStrings";
import { fetchAreaFeatures, fetchKnooppunten, legCrossesExcludedRoad, type AreaFeatures } from "./overpass";
import { routeChain, type OsrmLeg } from "./osrm";
import { resolveLocale } from "./resolveLocale";
import { evaluateWindDirection } from "./wind";
import type {
  Knooppunt,
  LatLon,
  PlanRequest,
  PlannedRoute,
  POICategory,
  Priorities,
  RouteLeg,
  TailwindTiming,
} from "./types";
import { DEFAULT_PRIORITIES } from "./types";

type ScoredNode = Knooppunt & { distFromStart: number; bearingFromStart: number };

type NodeFeatureScores = {
  trafficScore: number; // 0..1, higher = fewer nearby traffic signals/crossings
  natureScore: number; // 0..1, higher = more nearby water/forest
  poiScore: number; // 0..1, higher = more nearby of the rider's selected stop categories
  urbanScore: number; // 0..1, higher = more nearby built-up/residential land (bad -- see scoreCandidate)
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
const URBAN_RADIUS_M = 600;

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

    const urbanCount = features.urbanPoints.filter(
      (p) => distance(node, p) <= URBAN_RADIUS_M
    ).length;
    const urbanScore = Math.min(1, urbanCount / 3);

    map.set(node.id, { trafficScore, natureScore, poiScore, urbanScore });
  }
  return map;
}

// Anti-city bias applied regardless of the nature slider's position -- "avoid
// built-up/residential areas" is treated as a default expectation, not an
// opt-in extreme, since a candidate surrounded by residential streets is
// rarely what a rider wants even at a neutral (0.5) nature setting. The
// nature slider still scales *additional* avoidance on top of this baseline.
const URBAN_AVOID_BASE_WEIGHT = 0.6;

/**
 * Combines distance-to-target fit with the user's weighted priorities into a
 * single score used to pick the best candidate at each step/sector. Distance
 * fit always has a baseline weight of 1 (routes still need to hit the
 * requested length); `shortestTime` additionally boosts that weight so a
 * direct, non-meandering path wins over scenic detours.
 *
 * Deliberately does *not* weigh `f.poiScore` here (unlike destinations/
 * scenic-route's own scoring, which still uses `priorities.poiDensity`) --
 * a generic "pass more cafes" density nudge was replaced by explicit stop
 * planning (rider picks a category + a stretch of the route, see
 * StopsPlanner), which is a much more direct way to get a café on the route
 * than biasing every candidate node. `poiScore` itself is still computed and
 * used by `pickHighlight` below to describe a variant ("most stops along
 * the way"), just no longer as a knooppunt-selection input.
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
    urbanScore: 0,
  };

  return (
    radiusFit * radiusWeight +
    priorities.fewTrafficLights * f.trafficScore +
    priorities.nature * f.natureScore -
    (URBAN_AVOID_BASE_WEIGHT + priorities.nature) * f.urbanScore
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

/**
 * OSRM's routed-bike duration assumes a generic city-bike speed, which reads
 * as wildly optimistic or pessimistic for an actual road-bike rider. When the
 * rider gives their own average speed, that's what should drive the time
 * estimate instead.
 */
export function durationFromSpeed(
  totalDistanceM: number,
  avgSpeedKmh: number | null | undefined,
  fallbackDurationS: number
): number {
  if (!avgSpeedKmh || avgSpeedKmh <= 0) return fallbackDurationS;
  return ((totalDistanceM / 1000) / avgSpeedKmh) * 3600;
}

const TOLERANCE = 0.08; // accept +/-8% of target distance -- tightened from +/-20% after a report of routes landing 50-90% over the requested distance
// A route that still can't hit +/-8% after every refine iteration (a sparse
// knooppunt pool for a particular direction/distance, most often) used to
// just get thrown away entirely -- correct, but a rider would rather get a
// still-reasonable route than an error or a missing variant. This is a
// last-resort acceptance band, not the target: the loop above always aims
// for TOLERANCE first, this only decides what's still acceptable to return
// once iterations run out.
const FALLBACK_TOLERANCE = 0.2;
// Each iteration here costs one more throttled OSRM request (see osrm.ts's
// 1.1s pacing gate, added after concurrent roundtrip variants were found to
// violate OSRM's public 1req/s fair-use limit) -- across up to 5 concurrent
// alternatives, that's 5x per iteration. Kept at 3 rather than higher so
// this loop's worst case still leaves headroom for the Overpass area-feature
// fetch that already runs before it, within the shared 60s Vercel
// maxDuration budget; the damped proportional correction (below) converges
// fast enough in practice that this rarely costs real accuracy.
const MAX_REFINE_ITERATIONS = 3;
// Correcting the full measured overshoot/undershoot in one shot tends to
// overcorrect (drop too many nodes, then need to add most of them back next
// iteration) -- damping each pass to 70% of the measured gap still lands far
// more nodes per reroute than the old one-node-per-iteration approach (which
// is how a route 88% over target could still exhaust all 3 iterations
// without ever getting close), while converging smoothly instead of
// oscillating around the target.
const REFINE_DAMPING = 0.7;

function indicesOfLargestDetours(legs: OsrmLeg[], count: number): number[] {
  // The node between legs[i] and legs[i+1] is "responsible" for that pair's
  // combined length; the `count` interior nodes with the largest pairs are
  // the best candidates to drop in one batch.
  const pairs: { index: number; length: number }[] = [];
  for (let i = 0; i < legs.length - 1; i++) {
    pairs.push({ index: i, length: legs[i].distanceM + legs[i + 1].distanceM });
  }
  pairs.sort((a, b) => b.length - a.length);
  return pairs.slice(0, count).map((p) => p.index);
}

/**
 * Turns a chosen node sequence into an actual routed PlannedRoute: routes it
 * via OSRM, then iteratively drops/adds nodes to close in on the target
 * distance. Shared by planRoute (single route) and planRoundTripAlternatives
 * (several directional variants off the same node pool), so both stay in
 * sync with the same refine-loop behavior. Throws if the tolerance still
 * isn't met once iterations run out, rather than silently returning a route
 * that quietly breaks the distance promise -- callers that offer several
 * candidates (planRoundTripAlternatives) should treat that as "this
 * particular variant didn't work out", not surface it to the rider.
 */
async function finalizeRoute(
  req: Pick<
    PlanRequest,
    "mode" | "start" | "destination" | "direction" | "avgSpeedKmh" | "avoidMainRoads"
  >,
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
  const hasDirection = req.mode === "roundtrip" && req.direction !== null && req.direction !== undefined;

  // Recomputed fresh for each node added within a batch (not just once per
  // iteration) so a multi-node "too short" correction still hops from
  // wherever the previous pick in the same batch landed -- for one-way,
  // that's the whole point of building the chain hop by hop instead of
  // always measuring from the fixed start.
  function pickNextExtraNode(currentNodes: Knooppunt[]): Knooppunt | null {
    const refineIdealDistance =
      req.mode === "roundtrip"
        ? roundTripIdealRadius(targetDistanceM, hasDirection)
        : targetDistanceM / (currentNodes.length + 2);
    const referencePoint =
      req.mode === "oneway" && currentNodes.length > 0 ? currentNodes[currentNodes.length - 1] : req.start;
    const boundsFilter =
      req.mode === "oneway"
        ? (n: ScoredNode) =>
            isForwardProgress(
              n,
              referencePoint,
              req.destination!,
              refineIdealDistance * ONE_WAY_BACKWARD_TOLERANCE_FRACTION
            ) &&
            Math.abs(angleDiff(bearing(referencePoint, req.destination!), n.bearingFromStart)) <=
              ONE_WAY_CONE_HALF_WIDTH
        : hasDirection
          ? (n: ScoredNode) =>
              Math.abs(angleDiff(req.direction!, n.bearingFromStart)) <= DIRECTIONAL_CONE_HALF_WIDTH
          : undefined;

    return pickExtraNode(
      referencePoint,
      pool,
      currentNodes,
      refineIdealDistance,
      priorities,
      featureScores,
      boundsFilter
    );
  }

  for (let iter = 0; iter < MAX_REFINE_ITERATIONS; iter++) {
    const ratio = totalDistanceM / targetDistanceM;
    if (ratio >= 1 - TOLERANCE && ratio <= 1 + TOLERANCE) break;

    if (ratio > 1 + TOLERANCE && nodes.length > minNodes) {
      // Too long: drop however many of the worst-detour nodes the measured
      // overshoot suggests (damped), all in one batch instead of one
      // node/reroute at a time.
      const maxDroppable = nodes.length - minNodes;
      const dropCount = clampNum(Math.round((ratio - 1) * REFINE_DAMPING * nodes.length), 1, maxDroppable);
      const dropIndices = new Set(indicesOfLargestDetours(osrmLegs, dropCount));
      nodes = nodes.filter((_, i) => !dropIndices.has(i));
    } else if (ratio < 1 - TOLERANCE) {
      // Too short: add however many best-scoring unused candidates the
      // measured undershoot suggests (damped), one pick at a time so each
      // subsequent pick still respects the growing node list, but without a
      // reroute in between.
      const addCount = clampNum(Math.round((1 - ratio) * REFINE_DAMPING * Math.max(nodes.length, 1)), 1, 4);
      let addedAny = false;
      for (let i = 0; i < addCount; i++) {
        const extra = pickNextExtraNode(nodes);
        if (!extra) break;
        nodes = [...nodes, extra];
        addedAny = true;
      }
      if (!addedAny) break;
    } else {
      break;
    }

    sequence = buildSequence(nodes);
    ({ osrmLegs, totalDistanceM, totalDurationS } = await reroute(sequence, locale));
  }

  const finalRatio = totalDistanceM / targetDistanceM;
  if (finalRatio < 1 - FALLBACK_TOLERANCE || finalRatio > 1 + FALLBACK_TOLERANCE) {
    throw new Error(ROUTE_PLANNER_STRINGS[locale].distanceToleranceFailed);
  }

  if (req.avoidMainRoads) {
    const usedIds = new Set(nodes.map((n) => n.id));
    const avoided = await avoidExcludedRoads(sequence, nodes, osrmLegs, pool, usedIds, locale);
    sequence = avoided.sequence;
    nodes = avoided.nodes;
    osrmLegs = avoided.osrmLegs;
    totalDistanceM = avoided.totalDistanceM;
    totalDurationS = avoided.totalDurationS;
  }

  return {
    mode: req.mode,
    knooppunten: nodes,
    legs: toRouteLegs(sequence, osrmLegs),
    geometry: combineGeometry(osrmLegs),
    totalDistanceM,
    totalDurationS: durationFromSpeed(totalDistanceM, req.avgSpeedKmh, totalDurationS),
  };
}

/**
 * Runs the automatic tailwind-timing wind evaluation (see wind.ts) against
 * an already-planned roundtrip route and, if riding the reversed knooppunt
 * sequence is meaningfully better, re-routes it via OSRM and returns the
 * updated route with `wind`/`windInfo` set. Shared by /api/plan (single
 * route) and /api/plan-alternatives (all 5 variants) so both get the same
 * "ride whichever direction gives more tailwind on the favored half"
 * behavior instead of only the single-route flow having it.
 */
export async function applyWindEvaluation(
  route: PlannedRoute,
  start: LatLon,
  windInfo: { directionDeg: number; speedKmh: number },
  tailwindPriority: number,
  tailwindTiming: TailwindTiming | undefined,
  avgSpeedKmh: number | undefined,
  locale: AppLocale
): Promise<PlannedRoute> {
  const windLegs = route.legs.map((l) => ({ from: l.from, to: l.to, distanceM: l.distanceM }));
  const evaluation = evaluateWindDirection(
    windLegs,
    windInfo.directionDeg,
    windInfo.speedKmh,
    tailwindPriority,
    locale,
    tailwindTiming
  );

  if (evaluation.chosenDirection !== "reverse") {
    return { ...route, windInfo, wind: evaluation };
  }

  const reversedNodes = [...route.knooppunten].reverse();
  const sequence = [start, ...reversedNodes, start];
  const osrmLegs = await routeChain(sequence, locale);
  const reversedDistanceM = osrmLegs.reduce((s, l) => s + l.distanceM, 0);
  const reversedDurationS = osrmLegs.reduce((s, l) => s + l.durationS, 0);

  return {
    ...route,
    windInfo,
    knooppunten: reversedNodes,
    legs: toRouteLegs(sequence, osrmLegs),
    geometry: combineGeometry(osrmLegs),
    totalDistanceM: reversedDistanceM,
    totalDurationS: durationFromSpeed(reversedDistanceM, avgSpeedKmh, reversedDurationS),
    wind: evaluation,
  };
}

const MAX_AVOID_MAIN_ROAD_PASSES = 4;

/**
 * Best-effort hard exclusion of primary/trunk/secondary roads (+ _link
 * variants): the public OSRM bike server has no request parameter to
 * exclude specific road classes (that's a car-profile concept -- the stock
 * bike profile doesn't define excludable classes the way the car profile
 * does), so this can't just add an `exclude=` flag to the routing request.
 * Instead, each already-routed leg is checked against Overpass; the first
 * one found crossing an excluded road gets an extra waypoint inserted near
 * its midpoint (nearest unused candidate from the same knooppunt pool) and
 * the whole sequence is rerouted, repeating until clear or the pass budget
 * runs out. This reliably clears the common case (one busy road standing
 * between two otherwise-quiet knooppunten) but isn't a hard guarantee -- an
 * area with no quiet alternative at all within the pool could still leave a
 * short excluded stretch after the budget is spent.
 */
async function avoidExcludedRoads(
  sequence: LatLon[],
  nodes: Knooppunt[],
  osrmLegs: OsrmLeg[],
  pool: Knooppunt[],
  usedIds: Set<number>,
  locale: AppLocale
): Promise<{
  sequence: LatLon[];
  nodes: Knooppunt[];
  osrmLegs: OsrmLeg[];
  totalDistanceM: number;
  totalDurationS: number;
}> {
  let totalDistanceM = osrmLegs.reduce((s, l) => s + l.distanceM, 0);
  let totalDurationS = osrmLegs.reduce((s, l) => s + l.durationS, 0);

  for (let pass = 0; pass < MAX_AVOID_MAIN_ROAD_PASSES; pass++) {
    let violatingLegIndex = -1;
    for (let i = 0; i < osrmLegs.length; i++) {
      if (await legCrossesExcludedRoad(osrmLegs[i].geometry, locale)) {
        violatingLegIndex = i;
        break;
      }
    }
    if (violatingLegIndex === -1) break;

    const legStart = sequence[violatingLegIndex];
    const legEnd = sequence[violatingLegIndex + 1];
    const midpoint = { lat: (legStart.lat + legEnd.lat) / 2, lon: (legStart.lon + legEnd.lon) / 2 };

    const candidate = scoreNodes(midpoint, pool)
      .filter((n) => !usedIds.has(n.id))
      .sort((a, b) => a.distFromStart - b.distFromStart)[0];
    if (!candidate) break; // no unused candidate left near this leg -- best effort, stop here

    usedIds.add(candidate.id);
    sequence = [
      ...sequence.slice(0, violatingLegIndex + 1),
      candidate,
      ...sequence.slice(violatingLegIndex + 1),
    ];
    nodes = [...nodes.slice(0, violatingLegIndex), candidate, ...nodes.slice(violatingLegIndex)];
    ({ osrmLegs, totalDistanceM, totalDurationS } = await reroute(sequence, locale));
  }

  return { sequence, nodes, osrmLegs, totalDistanceM, totalDurationS };
}

// fetchAreaFeatures pulls several way/polygon clauses (water, wood, tourism,
// historic, POIs) in one request -- their combined cost grows with the
// *area* of the search circle, i.e. quadratically with radius, and users
// kept seeing it time out (even after capping just its costliest clause,
// landuse) at the larger radii long-distance roundtrips need for the
// knooppunt pool (up to 70km). But computeFeatureScores only ever checks
// each node's *own* small local radius (300-600m, see TRAFFIC_RADIUS_M etc.
// above) against these features -- it never needs coverage all the way out
// to 70km, so capping this fetch's radius well below the pool's doesn't
// break scoring, it just means nodes past the cap get neutral/default
// scores instead of nature/POI-biased ones. The knooppunt pool itself (a
// single lightweight tag filter, not a multi-clause polygon query) keeps
// using the full, uncapped searchRadius.
// Cut from an earlier 35km after a production report showed the *exact
// same* Overpass 504/timeout failure twice in a row, 4s apart (i.e. across
// both the initial attempt and its retry, see overpass.ts's
// runOverpassQuery) -- identical failures back-to-back point at a
// deterministic "this query is too expensive for this specific area", not
// a transient load spike a retry or a longer timeout could ride out. The
// test location (Amsterdam/Schiphol metro) is plausibly one of the
// densest-tagged regions in the Netherlands, so a radius that's fine
// elsewhere can still be too much there.
const AREA_FEATURES_RADIUS_CAP_M = 20000;

const EMPTY_AREA_FEATURES: AreaFeatures = {
  trafficPoints: [],
  waterPoints: [],
  greenPoints: [],
  poiPoints: [],
  attractionPoints: [],
  urbanPoints: [],
};

/** Fetches the shared knooppunt pool + area features once for a start point/search radius, reused by both planRoute and planRoundTripAlternatives. */
async function fetchPoolAndFeatures(
  start: LatLon,
  searchRadius: number,
  poiCategories: POICategory[] | undefined,
  locale: AppLocale,
  strings: (typeof ROUTE_PLANNER_STRINGS)[AppLocale]
): Promise<{ pool: Knooppunt[]; featureScores: Map<number, NodeFeatureScores> }> {
  // fetchKnooppunten is load-bearing -- with no candidate nodes there's no
  // route to build, so a failure there still has to fail the whole plan.
  // fetchAreaFeatures only *biases* which nodes get picked (nature/POI/
  // urban scoring); a repeated, deterministic Overpass failure on this one
  // query (seen in production even after radius caps, longer timeouts, and
  // a retry -- see AREA_FEATURES_RADIUS_CAP_M above) shouldn't take down a
  // route that could otherwise plan fine with neutral scoring instead.
  // Matches the user's explicit priority: succeeding without this bias beats
  // not succeeding at all.
  const [pool, areaFeatures] = await Promise.all([
    fetchKnooppunten(start, searchRadius, locale),
    fetchAreaFeatures(start, Math.min(searchRadius, AREA_FEATURES_RADIUS_CAP_M), true, poiCategories, locale).catch(
      () => EMPTY_AREA_FEATURES
    ),
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

  const { pool, featureScores } = await fetchPoolAndFeatures(
    req.start,
    searchRadius,
    req.poiCategories,
    locale,
    strings
  );

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

// Matches the default alternative count (5): the shared pool/feature fetch
// is already a single Overpass round trip, so there's no reason to batch the
// remaining per-variant OSRM work into two waves when all 5 can run at once.
const ALTERNATIVE_CONCURRENCY = 5;

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

/** Language-agnostic "why this one" tag for a roundtrip alternative; translated to display text by the API route. */
export type AlternativeHighlight = "nature" | "quiet" | "poiRich" | "direct";

// Below this, none of a route's averaged feature scores stand out enough to
// claim a specific highlight -- it's presented as the plain, direct option
// instead of forcing a reason onto an otherwise unremarkable loop.
const HIGHLIGHT_THRESHOLD = 0.15;

/** Averages each node's precomputed feature scores over a route's chosen knooppunten, then picks its single most distinctive trait. */
function pickHighlight(
  nodes: Knooppunt[],
  featureScores: Map<number, NodeFeatureScores>
): AlternativeHighlight {
  if (nodes.length === 0) return "direct";
  const scores = nodes.map(
    (n) => featureScores.get(n.id) ?? { trafficScore: 0.5, natureScore: 0, poiScore: 0, urbanScore: 0 }
  );
  const avg = (pick: (s: NodeFeatureScores) => number) =>
    scores.reduce((sum, s) => sum + pick(s), 0) / scores.length;

  const metrics: { key: AlternativeHighlight; value: number }[] = [
    { key: "nature", value: avg((s) => s.natureScore) },
    { key: "quiet", value: avg((s) => (s.trafficScore + (1 - s.urbanScore)) / 2) },
    { key: "poiRich", value: avg((s) => s.poiScore) },
  ];
  metrics.sort((a, b) => b.value - a.value);
  return metrics[0].value >= HIGHLIGHT_THRESHOLD ? metrics[0].key : "direct";
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
): Promise<{ direction: number | null; route: PlannedRoute; highlight: AlternativeHighlight }[]> {
  const priorities: Priorities = { ...DEFAULT_PRIORITIES, ...req.priorities };
  const locale = resolveLocale(req.locale);
  const strings = ROUTE_PLANNER_STRINGS[locale];

  const targetDistanceM = req.distanceKm * 1000;
  // Every variant here gets a concrete direction (evenly spread, or jittered
  // around req.direction), so the search radius always needs the larger
  // out-and-back reach, never the smaller full-loop one.
  const searchRadius = clampNum(roundTripIdealRadius(targetDistanceM, true) * 1.2, 3000, 70000);
  const { pool, featureScores } = await fetchPoolAndFeatures(
    req.start,
    searchRadius,
    req.poiCategories,
    locale,
    strings
  );

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
    try {
      const route = await finalizeRoute(
        {
          mode: "roundtrip",
          start: req.start,
          direction,
          avgSpeedKmh: req.avgSpeedKmh,
          avoidMainRoads: req.avoidMainRoads,
        },
        nodes,
        targetDistanceM,
        pool,
        priorities,
        featureScores,
        locale
      );
      return { direction, route, highlight: pickHighlight(nodes, featureScores) };
    } catch {
      // finalizeRoute couldn't land this direction within the distance
      // tolerance -- skip it rather than surface a route that quietly
      // breaks the distance promise; the other directions/candidates are
      // still tried independently.
      return null;
    }
  });

  return results.filter(
    (r): r is { direction: number | null; route: PlannedRoute; highlight: AlternativeHighlight } => r !== null
  );
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
