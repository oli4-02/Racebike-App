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

export type PlanRequest = {
  start: LatLon;
  mode: RouteMode;
  distanceKm: number;
  date: string; // YYYY-MM-DD
  /** Preferred initial bearing in degrees for one-way trips, or general loop bias for round trips. */
  bearingDeg?: number;
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
