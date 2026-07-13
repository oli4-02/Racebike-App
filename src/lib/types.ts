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
  /**
   * Roundtrip-only: a compass bearing (0-359, 0 = north) to head out towards
   * instead of looping all the way around the start. When set, the loop is
   * biased into a cone around this bearing (an elongated "out and back"
   * shape) rather than surrounding the start on all sides. `null`/omitted
   * keeps the default all-around loop.
   */
  direction?: number | null;
  /**
   * The rider's selected stop categories (fuel/supermarket/ice_cream/cafe).
   * Biases node candidate selection towards passing near them, not just
   * which markers get overlaid on the map afterwards. Defaults to all four
   * when omitted.
   */
  poiCategories?: POICategory[];
  /**
   * Rider's average speed in km/h, used to compute totalDurationS as
   * distance/speed instead of trusting OSRM's bike-profile assumed speed
   * (tuned for a generic city bike, not a road bike). Omit/0 keeps the OSRM
   * estimate.
   */
  avgSpeedKmh?: number;
  /** UI language, used to localize wind explanations, POI labels, and error messages generated server-side. Defaults to "de". */
  locale?: string;
};

export type RouteLeg = {
  from: LatLon;
  to: LatLon;
  distanceM: number;
  durationS: number;
  geometry: LatLon[]; // road-following geometry from OSRM
};

/**
 * Length-weighted share (0-100, roughly summing to 100) of the route's
 * surface by road type, so a rider can tell whether a route mostly follows
 * dedicated cycleways, quiet/traffic-calmed streets, or roads shared with
 * car traffic. Best-effort classification from OSM `highway=*` tags along
 * the route corridor (see fetchRoadTypeBreakdown) -- not an exact
 * distance-by-surface measurement.
 */
export type RoadTypeBreakdown = {
  cyclewayPct: number;
  residentialPct: number;
  mainRoadPct: number;
  otherPct: number;
};

/** A contiguous stretch of route geometry classified as a single road type, for map coloring. */
export type RoadTypeSegment = { points: LatLon[]; type: keyof RoadTypeBreakdown };

export type RoadTypeResult = { breakdown: RoadTypeBreakdown; segments: RoadTypeSegment[] };

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

/** One of several roundtrip route options offered side by side (see /api/plan-alternatives). */
export type RoundTripAlternative = {
  /** Human-readable compass label ("Nordost", "Egal", ...) for display. */
  directionLabel: string;
  direction: number | null;
  route: PlannedRoute;
  /** Human-readable "why pick this one" (most nature, quietest, most stops, or a plain direct loop). */
  reason: string;
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
  /** Decimated direct-OSRM preview route (start -> candidate), for the mini map on the suggestion card. Not the final knooppunt-based route. */
  previewGeometry: LatLon[];
};

export type StationInfo = {
  code?: string;
  name: string;
  lat: number;
  lon: number;
};

export type TrainTrip = {
  departureTime: string;
  arrivalTime: string;
  transfers: number;
};

/** Result of an NS train lookup for one leg (fromStation -> toStation). */
export type TrainInfo =
  | { configured: false; message: string }
  | { configured: true; error: string }
  | {
      configured: true;
      fromStation: StationInfo;
      toStation: StationInfo;
      trips: TrainTrip[];
      ovFiets: { rentalBikesAvailable: number | null };
    };

export type LandscapeType =
  | "duenen_kueste"
  | "wald"
  | "polder"
  | "heide_moor"
  | "heuvelland"
  | "fluss_meer";

/** A curated, hand-picked scenic cycling area for the "Landschafts-Route" one-way mode. */
export type ScenicCorridor = {
  id: string;
  name: string;
  landscapeType: LandscapeType;
  description: string;
  /** Approximate center of the corridor area (not a precise polygon). */
  center: LatLon;
  /** Approximate radius of the corridor area in km. */
  radiusKm: number;
  /** Human-readable nearest station, for display before the real station is resolved via NS. */
  entryStationName: string;
};

export type ScenicRoutePlan = {
  corridor: ScenicCorridor;
  route: PlannedRoute;
  entryStation: StationInfo;
  exitStation: StationInfo;
  outboundTrain: TrainInfo;
  returnTrain: TrainInfo;
};

/**
 * A well-known, real-world NL round-trip cycling route ("Signature-Route"),
 * curated from community sources (Komoot, Outdooractive, AllTrails,
 * Zeeland.com). Distances are the original tour's rough length, not a
 * surveyed target — the app adapts its own loop towards this via the
 * distance slider rather than replaying the exact original waypoints.
 */
export type SignatureRoute = {
  id: string;
  name: string;
  province: string;
  landscapeType: LandscapeType;
  description: string;
  /** Approximate length of the original tour in km; null when sources only said "variabel". */
  approxDistanceKm: number | null;
  /** Human-readable start region/town, for display. */
  startRegionName: string;
  /** Approximate center of the route's start region (not a precise start point). */
  center: LatLon;
};

export type SignatureRoutePlan = {
  signatureRoute: SignatureRoute;
  route: PlannedRoute;
  /** Whether the loop was anchored at a resolved station (user was far from the route) rather than the user's own start. */
  usedStation: boolean;
  station: StationInfo | null;
  outboundTrain: TrainInfo | null;
  returnTrain: TrainInfo | null;
};
