export type LatLon = { lat: number; lon: number };

export type Knooppunt = {
  id: number;
  ref: string;
  lat: number;
  lon: number;
};

export type POICategory = "fuel" | "supermarket" | "ice_cream" | "cafe";

export type POI = {
  id: number;
  category: POICategory;
  name: string;
  lat: number;
  lon: number;
};

export type RouteMode = "roundtrip" | "oneway";

/**
 * User-weighted criteria (0..1 each, independent — not required to sum to 1)
 * that bias knooppunt selection away from the pure distance-matching
 * heuristic. See routePlanner.ts for how each is applied.
 */
export type Priorities = {
  fewTrafficLights: number;
  nature: number;
  poiDensity: number;
  shortestTime: number;
  tailwind: number;
};

export const DEFAULT_PRIORITIES: Priorities = {
  fewTrafficLights: 0.5,
  nature: 0.5,
  poiDensity: 0.5,
  shortestTime: 0.5,
  tailwind: 0.5,
};

export type PlanRequest = {
  start: LatLon;
  mode: RouteMode;
  distanceKm: number;
  date: string; // YYYY-MM-DD
  priorities?: Priorities;
  /** One-way trips always resolve to a concrete destination (typed address in Modus A, or a picked suggestion in Modus B). */
  destination?: LatLon;
};

export type RouteLeg = {
  from: LatLon;
  to: LatLon;
  distanceM: number;
  durationS: number;
  geometry: LatLon[]; // road-following geometry from OSRM
};

export type PlannedRoute = {
  mode: RouteMode;
  knooppunten: Knooppunt[];
  legs: RouteLeg[];
  geometry: LatLon[];
  totalDistanceM: number;
  totalDurationS: number;
  /** Present whenever wind data was available, for the compass overlay and route coloring (both modes). */
  windInfo?: { directionDeg: number; speedKmh: number };
  /** Present only for round trips: which loop direction was chosen and why. */
  wind?: WindEvaluation;
};

export type WindForecast = {
  time: string; // ISO hour
  windSpeedKmh: number;
  windDirectionDeg: number; // meteorological "from" direction
};

export type WindEvaluation = {
  chosenDirection: "forward" | "reverse";
  tailwindScoreForward: number;
  tailwindScoreReverse: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  explanation: string;
};

export type DestinationSuggestion = {
  name: string;
  lat: number;
  lon: number;
  distanceKm: number;
  description: string | null;
  imageUrl: string | null;
  hasNearbyStation: boolean;
  reason: string;
};
