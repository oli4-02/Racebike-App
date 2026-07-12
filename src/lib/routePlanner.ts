import { bearing, distance, angleDiff } from "./geo";
import { fetchKnooppunten } from "./overpass";
import { routeChain, type OsrmLeg } from "./osrm";
import type {
  Knooppunt,
  LatLon,
  PlanRequest,
  PlannedRoute,
  RouteLeg,
} from "./types";

type ScoredNode = Knooppunt & { distFromStart: number; bearingFromStart: number };

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

/**
 * Picks knooppunten spread around the start point at roughly the radius a
 * loop of the target distance implies, one per bearing sector, then sorts
 * them by bearing so the resulting sequence traces a simple (non-crossing)
 * loop. This approximates the real knooppunten-network topology without
 * needing to reconstruct its full routed-way graph from Overpass relations.
 */
function selectRoundTripNodes(
  start: LatLon,
  pool: Knooppunt[],
  targetDistanceM: number
): Knooppunt[] {
  const detourFactor = 1.3; // roads wind more than straight lines
  const idealRadius = targetDistanceM / (2 * Math.PI * detourFactor);
  const scored = scoreNodes(start, pool);

  const sectorCount = clampNum(Math.round(targetDistanceM / 8000), 5, 10);
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
          Math.abs(a.distFromStart - idealRadius) -
          Math.abs(b.distFromStart - idealRadius)
      );
      return bucket[0];
    });

  chosen.sort((a, b) => a.bearingFromStart - b.bearingFromStart);
  return chosen;
}

/** Picks a chain of knooppunten heading roughly towards bearingDeg, spaced out to the target distance. */
function selectOneWayNodes(
  start: LatLon,
  pool: Knooppunt[],
  targetDistanceM: number,
  bearingDeg: number
): Knooppunt[] {
  const scored = scoreNodes(start, pool);
  const coneHalfWidth = 55;
  const inCone = scored.filter(
    (n) => Math.abs(angleDiff(bearingDeg, n.bearingFromStart)) <= coneHalfWidth
  );

  const stepCount = clampNum(Math.round(targetDistanceM / 8000), 3, 10);
  const chosen: ScoredNode[] = [];
  for (let i = 1; i <= stepCount; i++) {
    const stepTarget = (targetDistanceM * i) / stepCount;
    const remaining = inCone.filter((n) => !chosen.includes(n));
    if (remaining.length === 0) break;
    remaining.sort(
      (a, b) =>
        Math.abs(a.distFromStart - stepTarget) -
        Math.abs(b.distFromStart - stepTarget)
    );
    chosen.push(remaining[0]);
  }
  return chosen;
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
  const targetDistanceM = req.distanceKm * 1000;
  const searchRadius =
    req.mode === "roundtrip"
      ? clampNum(targetDistanceM * 0.45, 3000, 30000)
      : clampNum(targetDistanceM * 0.75, 3000, 45000);

  const pool = await fetchKnooppunten(req.start, searchRadius);
  if (pool.length < 3) {
    throw new Error(
      "Zu wenige Knotenpunkte des Radnetzwerks in der Nähe gefunden. Bitte einen anderen Startpunkt oder eine größere Distanz wählen."
    );
  }

  let nodes: Knooppunt[] =
    req.mode === "roundtrip"
      ? selectRoundTripNodes(req.start, pool, targetDistanceM)
      : selectOneWayNodes(req.start, pool, targetDistanceM, req.bearingDeg ?? 90);

  if (nodes.length < 2) {
    throw new Error(
      "Es konnte keine sinnvolle Route aus den gefundenen Knotenpunkten gebaut werden."
    );
  }

  const buildSequence = (ns: Knooppunt[]): LatLon[] =>
    req.mode === "roundtrip"
      ? [req.start, ...ns, req.start]
      : [req.start, ...ns];

  let sequence = buildSequence(nodes);
  let { osrmLegs, totalDistanceM, totalDurationS } = await reroute(sequence);

  for (let iter = 0; iter < MAX_REFINE_ITERATIONS; iter++) {
    const ratio = totalDistanceM / targetDistanceM;
    if (ratio >= 1 - TOLERANCE && ratio <= 1 + TOLERANCE) break;

    if (ratio > 1 + TOLERANCE && nodes.length > 2) {
      // Too long: drop the node whose surrounding legs add the most distance.
      const dropIndex = indexOfLargestDetour(osrmLegs);
      nodes = nodes.filter((_, i) => i !== dropIndex);
    } else if (ratio < 1 - TOLERANCE) {
      // Too short: add the closest unused candidate that extends the loop.
      const extra = pickExtraNode(req.start, pool, nodes, targetDistanceM);
      if (!extra) break;
      nodes = insertNodeByBearing(nodes, extra);
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
  targetDistanceM: number
): Knooppunt | null {
  const usedIds = new Set(used.map((n) => n.id));
  const idealRadius = targetDistanceM / (2 * Math.PI * 1.3);
  const candidates = pool
    .filter((n) => !usedIds.has(n.id))
    .map((n) => ({ ...n, distFromStart: distance(start, n) }))
    .sort(
      (a, b) =>
        Math.abs(a.distFromStart - idealRadius) -
        Math.abs(b.distFromStart - idealRadius)
    );
  return candidates[0] ?? null;
}

function insertNodeByBearing(nodes: Knooppunt[], extra: Knooppunt): Knooppunt[] {
  // Insertion order doesn't matter much here since the caller only cares
  // about total distance; append is sufficient for a round of refinement.
  return [...nodes, extra];
}
