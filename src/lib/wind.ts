import type { AppLocale } from "@/i18n/routing";
import { angleDiff, bearing, toRad } from "./geo";
import { COMPASS_LABELS, WIND_EXPLANATION } from "./i18nStrings";
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

/** Tailwind component (-1 full headwind..1 full tailwind) for travelling on travelBearing in the given wind. */
export function tailwindComponent(
  travelBearingDeg: number,
  windFromDeg: number
): number {
  const windBlowingTowards = (windFromDeg + 180) % 360;
  return Math.cos(toRad(angleDiff(travelBearingDeg, windBlowingTowards)));
}

/** Maps a tailwind component (-1..1) to a red(headwind)-yellow(cross)-green(tailwind) CSS color. */
export function tailwindColor(component: number): string {
  const clamped = Math.max(-1, Math.min(1, component));
  const hue = 60 + 60 * clamped; // -1 -> 0 (red), 0 -> 60 (yellow), 1 -> 120 (green)
  return `hsl(${hue.toFixed(0)}, 75%, 45%)`;
}

/**
 * Compares riding a leg sequence forward vs. reversed and picks whichever
 * direction gives more tailwind on the second half of the ride (the part
 * where fatigue makes headwind hurt most). `tailwindPriority` (0..1, from
 * the user's priority slider) controls how strongly the later section is
 * weighted: 0 evaluates the whole loop roughly evenly, 1 aggressively
 * favours a tailwind finish.
 */
export function evaluateWindDirection(
  legs: WindLeg[],
  windDirectionDeg: number,
  windSpeedKmh: number,
  tailwindPriority = 1,
  locale: AppLocale = "de"
): WindEvaluation {
  const forwardScore = weightedTailwindScore(legs, windDirectionDeg, tailwindPriority);
  const reversed = [...legs].reverse().map((leg) => ({
    from: leg.to,
    to: leg.from,
    distanceM: leg.distanceM,
  }));
  const reverseScore = weightedTailwindScore(reversed, windDirectionDeg, tailwindPriority);

  const chosenDirection: "forward" | "reverse" =
    forwardScore >= reverseScore ? "forward" : "reverse";

  const compass = compassLabel(windDirectionDeg, locale);
  const speedLabel = windSpeedKmh.toFixed(0);
  const explanation =
    chosenDirection === "forward"
      ? WIND_EXPLANATION[locale].forward(compass, speedLabel)
      : WIND_EXPLANATION[locale].reverse(compass, speedLabel);

  return {
    chosenDirection,
    tailwindScoreForward: forwardScore,
    tailwindScoreReverse: reverseScore,
    windSpeedKmh,
    windDirectionDeg,
    explanation,
  };
}

/** Weighted average tailwind component (-1..1); intensity controls how much more later legs count. */
function weightedTailwindScore(
  legs: WindLeg[],
  windFromDeg: number,
  intensity: number
): number {
  if (legs.length === 0) return 0;

  let weightedSum = 0;
  let weightTotal = 0;
  legs.forEach((leg, i) => {
    const travelBearing = bearing(leg.from, leg.to);
    const component = tailwindComponent(travelBearing, windFromDeg);
    const positionFactor =
      1 + (legs.length > 1 ? (i / (legs.length - 1)) * intensity : 0);
    const weight = leg.distanceM * positionFactor;
    weightedSum += component * weight;
    weightTotal += weight;
  });

  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

function compassLabel(deg: number, locale: AppLocale): string {
  const labels = COMPASS_LABELS[locale];
  const index = Math.round(((deg % 360) / 45)) % 8;
  return labels[index];
}
