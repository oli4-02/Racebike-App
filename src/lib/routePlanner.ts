import { bearing, distance, angleDiff } from "./geo";
import {
  fetchAreaFeatures,
  fetchAttractionPoints,
  fetchKnooppunten,
  type AreaFeatures,
} from "./overpass";
import { routeChain, type OsrmLeg } from "./osrm";
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
  features: AreaFeatures,
  attractionPoints: LatLon[]
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
    const attractionCount = attractionPoints.filter(
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

/**
 * Picks knooppunten spread around the start point at roughly the radius a
 * loop of the target distance implies, one per bearing sector (weighted by
 * priorities), then sorts them by bearing so the resulting sequence traces a
 * simple (non-crossing) loop. This approximates the real knooppunten-network
 * topology without needing to reconstruct its full routed-way graph from
 * Overpass relations.
 */
function selectRoundTripNodes(
  start: LatLon,
  pool: Knooppunt[],
  targetDistanceM: number,
  priorities: Priorities,
  featureScores: Map<number, NodeFeatureScores>
): Knooppunt[] {
  const detourFactor = 1.3; // roads wind more than straight lines
  const idealRadius = targetDistanceM / (2 * Math.PI * detourFactor);
  const scored = scoreNodes(start, pool);

  // Higher shortestTime priority means fewer, more direct hops.
  const sectorCount = clampNum(
    Math.round((targetDistanceM / 8000) * (1 - 0.25 * priorities.shortestTime)),
    5,
    10
  );
  const sectorWidth = 360 / sectorCount;
  const buckets: ScoredNode[][] = Array.from({ length: sectorCount }, () => []);
  scored.forEach((n) => {
    const idx = Math.floor(n.bearingFromStart / sectorWidth) % sectorCount;
    buckets[idx].push(n);
  });

  const chosen = buckets
    .filter((b) => b.length > 0)
    .map((bucket) => {
      bucket.sort(
        (a, b) =>
          scoreCandidate(b, idealRadius, priorities, featureScores) -
          scoreCandidate(a, idealRadius, priorities, featureScores)
      );
      return bucket[0];
    });

  chosen.sort((a, b) => a.bearingFromStart - b.bearingFromStart);
  return chosen;
}

const ONE_WAY_CONE_HALF_WIDTH = 55;

/**
 * Builds a chain of knooppunten from start towards a fixed destination
 * (Modus A: typed address, or Modus B: a picked suggestion). The detour
 * factor -- how much longer than the straight line the ride is allowed to
 * be -- is itself controlled by the shortestTime priority.
 */
function selectOneWayNodes(
  start: LatLon,
  destination: LatLon,
  pool: Knooppunt[],
  priorities: Priorities,
  featureScores: Map<number, NodeFeatureScores>
): { nodes: Knooppunt[]; targetDistanceM: number } {
  const totalBearing = bearing(start, destination);
  const straightDistanceM = distance(start, destination);
  const detourFactor = 1.15 + 0.3 * (1 - priorities.shortestTime);
  const targetDistanceM = straightDistanceM * detourFactor;

  const scored = scoreNodes(start, pool);
  const inCone = scored.filter(
    (n) =>
      Math.abs(angleDiff(totalBearing, n.bearingFromStart)) <=
        ONE_WAY_CONE_HALF_WIDTH && n.distFromStart < straightDistanceM * 1.25
  );

  const stepCount = clampNum(
    Math.round((targetDistanceM / 8000) * (1 - 0.25 * priorities.shortestTime)),
    2,
    9
  );
  const chosen: ScoredNode[] = [];
  for (let i = 1; i <= stepCount; i++) {
    const stepTarget = (targetDistanceM * i) / (stepCount + 1);
    const remaining = inCone.filter((n) => !chosen.includes(n));
    if (remaining.length === 0) break;
    remaining.sort(
      (a, b) =>
        scoreCandidate(b, stepTarget, priorities, featureScores) -
        scoreCandidate(a, stepTarget, priorities, featureScores)
    );
    chosen.push(remaining[0]);
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

async function reroute(sequence: LatLon[]) {
  const osrmLegs = await routeChain(sequence);
  const totalDistanceM = osrmLegs.reduce((s, l) => s + l.distanceM, 0);
  const totalDurationS = osrmLegs.reduce((s, l) => s + l.durationS, 0);
  return { osrmLegs, totalDistanceM, totalDurationS };
}

const TOLERANCE = 0.2; // accept +/-20% of target distance
const MAX_REFINE_ITERATIONS = 3;

export async function planRoute(req: PlanRequest): Promise<PlannedRoute> {
  const priorities: Priorities = { ...DEFAULT_PRIORITIES, ...req.priorities };

  if (req.mode === "oneway" && !req.destination) {
    throw new Error("Für eine One-Way-Tour wird ein Ziel benötigt.");
  }

  const approxTargetM =
    req.mode === "roundtrip"
      ? req.distanceKm * 1000
      : distance(req.start, req.destination!);

  const searchRadius =
    req.mode === "roundtrip"
      ? clampNum(approxTargetM * 0.45, 3000, 30000)
      : clampNum(approxTargetM * 0.9, 3000, 60000);

  const [pool, areaFeatures, attractionPoints] = await Promise.all([
    fetchKnooppunten(req.start, searchRadius),
    fetchAreaFeatures(req.start, searchRadius),
    fetchAttractionPoints(req.start, searchRadius),
  ]);

  if (pool.length < 3) {
    throw new Error(
      "Zu wenige Knotenpunkte des Radnetzwerks in der Nähe gefunden. Bitte einen anderen Startpunkt oder eine größere Distanz wählen."
    );
  }

  const featureScores = computeFeatureScores(pool, areaFeatures, attractionPoints);

  let nodes: Knooppunt[];
  let targetDistanceM: number;

  if (req.mode === "roundtrip") {
    targetDistanceM = req.distanceKm * 1000;
    nodes = selectRoundTripNodes(req.start, pool, targetDistanceM, priorities, featureScores);
    if (nodes.length < 2) {
      throw new Error(
        "Es konnte keine sinnvolle Route aus den gefundenen Knotenpunkten gebaut werden."
      );
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

  const buildSequence = (ns: Knooppunt[]): LatLon[] =>
    req.mode === "roundtrip"
      ? [req.start, ...ns, req.start]
      : [req.start, ...ns, req.destination!];

  let sequence = buildSequence(nodes);
  let { osrmLegs, totalDistanceM, totalDurationS } = await reroute(sequence);

  const minNodes = req.mode === "roundtrip" ? 2 : 0;
  const refineIdealDistance =
    req.mode === "roundtrip"
      ? targetDistanceM / (2 * Math.PI * 1.3)
      : targetDistanceM / (nodes.length + 2);
  const refineBoundsFilter =
    req.mode === "oneway"
      ? (n: ScoredNode) =>
          Math.abs(
            angleDiff(bearing(req.start, req.destination!), n.bearingFromStart)
          ) <= ONE_WAY_CONE_HALF_WIDTH
      : undefined;

  for (let iter = 0; iter < MAX_REFINE_ITERATIONS; iter++) {
    const ratio = totalDistanceM / targetDistanceM;
    if (ratio >= 1 - TOLERANCE && ratio <= 1 + TOLERANCE) break;

    if (ratio > 1 + TOLERANCE && nodes.length > minNodes) {
      // Too long: drop the node whose surrounding legs add the most distance.
      const dropIndex = indexOfLargestDetour(osrmLegs);
      nodes = nodes.filter((_, i) => i !== dropIndex);
    } else if (ratio < 1 - TOLERANCE) {
      // Too short: add the best-scoring unused candidate that extends the route.
      const extra = pickExtraNode(
        req.start,
        pool,
        nodes,
        refineIdealDistance,
        priorities,
        featureScores,
        refineBoundsFilter
      );
      if (!extra) break;
      nodes = [...nodes, extra];
    } else {
      break;
    }

    sequence = buildSequence(nodes);
    ({ osrmLegs, totalDistanceM, totalDurationS } = await reroute(sequence));
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
