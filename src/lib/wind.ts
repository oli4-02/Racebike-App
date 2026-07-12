import { angleDiff, bearing, toRad } from "./geo";
import type { LatLon, WindEvaluation, WindForecast } from "./types";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

/** Open-Meteo only forecasts ~16 days ahead; outside that we can't get wind data. */
export function isWithinForecastRange(dateStr: string): boolean {
  const date = new Date(dateStr + "T00:00:00Z");
  const now = new Date();
  const diffDays = (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= -1 && diffDays <= 15;
}

export async function fetchWindForecast(
  center: LatLon,
  dateStr: string
): Promise<WindForecast[]> {
  const url =
    `${OPEN_METEO_BASE}?latitude=${center.lat}&longitude=${center.lon}` +
    `&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh` +
    `&start_date=${dateStr}&end_date=${dateStr}&timezone=auto`;

  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  const data = await res.json();

  const times: string[] = data.hourly?.time ?? [];
  const speeds: number[] = data.hourly?.wind_speed_10m ?? [];
  const dirs: number[] = data.hourly?.wind_direction_10m ?? [];

  return times.map((time, i) => ({
    time,
    windSpeedKmh: speeds[i],
    windDirectionDeg: dirs[i],
  }));
}

/** Average wind over a typical daytime riding window (09:00-16:00). */
export function representativeDaytimeWind(forecast: WindForecast[]): {
  speedKmh: number;
  directionDeg: number;
} {
  const daytime = forecast.filter((f) => {
    const hour = Number(f.time.slice(11, 13));
    return hour >= 9 && hour <= 16;
  });
  const sample = daytime.length > 0 ? daytime : forecast;

  // Average speed directly; average direction via unit-vector sum since
  // degrees don't average linearly across the 0/360 wrap.
  const speedKmh =
    sample.reduce((s, f) => s + f.windSpeedKmh, 0) / sample.length;
  const vx = sample.reduce((s, f) => s + Math.cos(toRad(f.windDirectionDeg)), 0);
  const vy = sample.reduce((s, f) => s + Math.sin(toRad(f.windDirectionDeg)), 0);
  const directionDeg = (toDegPositive(Math.atan2(vy, vx)) + 360) % 360;

  return { speedKmh, directionDeg };
}

function toDegPositive(rad: number): number {
  return (rad * 180) / Math.PI;
}

export type WindLeg = { from: LatLon; to: LatLon; distanceM: number };

/**
 * Compares riding a leg sequence forward vs. reversed and picks whichever
 * direction gives more tailwind on the second half of the ride (the part
 * where fatigue makes headwind hurt most).
 */
export function evaluateWindDirection(
  legs: WindLeg[],
  windDirectionDeg: number,
  windSpeedKmh: number
): WindEvaluation {
  const forwardScore = weightedTailwindScore(legs, windDirectionDeg);
  const reversed = [...legs].reverse().map((leg) => ({
    from: leg.to,
    to: leg.from,
    distanceM: leg.distanceM,
  }));
  const reverseScore = weightedTailwindScore(reversed, windDirectionDeg);

  const chosenDirection: "forward" | "reverse" =
    forwardScore >= reverseScore ? "forward" : "reverse";

  const compass = compassLabel(windDirectionDeg);
  const explanation =
    `Wind aus ${compass} mit ${windSpeedKmh.toFixed(0)} km/h: ` +
    (chosenDirection === "forward"
      ? "Fahrtrichtung wie geplant gibt mehr Rückenwind im zweiten (anstrengenderen) Streckenteil."
      : "Route wird umgekehrt gefahren, damit der zweite (anstrengendere) Streckenteil mehr Rückenwind bekommt.");

  return {
    chosenDirection,
    tailwindScoreForward: forwardScore,
    tailwindScoreReverse: reverseScore,
    windSpeedKmh,
    windDirectionDeg,
    explanation,
  };
}

/** Weighted average tailwind component (-1..1), weighting later legs more heavily. */
function weightedTailwindScore(
  legs: WindLeg[],
  windFromDeg: number
): number {
  if (legs.length === 0) return 0;
  const windBlowingTowards = (windFromDeg + 180) % 360;

  let weightedSum = 0;
  let weightTotal = 0;
  legs.forEach((leg, i) => {
    const travelBearing = bearing(leg.from, leg.to);
    const component = Math.cos(
      toRad(angleDiff(travelBearing, windBlowingTowards))
    );
    const positionFactor = 1 + (legs.length > 1 ? i / (legs.length - 1) : 0);
    const weight = leg.distanceM * positionFactor;
    weightedSum += component * weight;
    weightTotal += weight;
  });

  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

function compassLabel(deg: number): string {
  const labels = ["N", "NO", "O", "SO", "S", "SW", "W", "NW"];
  const index = Math.round(((deg % 360) / 45)) % 8;
  return labels[index];
}
