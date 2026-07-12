"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { fetchTrainReturn } from "@/lib/apiClient";
import type { LatLon, TrainInfo } from "@/lib/types";

export default function TrainReturnPanel({
  home,
  dest,
  date,
  title,
  preloaded,
}: {
  home: LatLon;
  dest: LatLon;
  date: string;
  title?: string;
  /** Skip the internal fetch and render this instead (e.g. already fetched as part of a scenic-route plan). */
  preloaded?: TrainInfo;
}) {
  const t = useTranslations("planner.train");
  const locale = useLocale();
  const [fetchedInfo, setFetchedInfo] = useState<TrainInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const info = preloaded ?? fetchedInfo;

  useEffect(() => {
    if (preloaded) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetchTrainReturn({
          home,
          dest,
          dateTime: `${date}T15:00:00`,
          locale,
        });
        if (!cancelled) setFetchedInfo(r);
      } catch (e) {
        if (!cancelled) {
          setFetchedInfo({
            configured: true,
            error: e instanceof Error ? e.message : "Error",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [home, dest, date, preloaded, locale]);

  return (
    <div className="rounded-md border border-meewind-border p-3 text-sm">
      <h3 className="font-medium mb-2">{title ?? t("defaultTitle")}</h3>
      {loading && <p className="text-meewind-fg-muted text-xs">{t("loading")}</p>}
      {info && !info.configured && (
        <p className="text-xs text-amber-400">{info.message}</p>
      )}
      {info && info.configured && "error" in info && (
        <p className="text-xs text-red-400">{info.error}</p>
      )}
      {info && info.configured && "trips" in info && (
        <div className="flex flex-col gap-2 text-xs">
          <p>
            {info.fromStation.name} → {info.toStation.name}
          </p>
          <p className="text-meewind-fg-muted">
            {t("ovFiets", { count: info.ovFiets.rentalBikesAvailable ?? "?" })}
          </p>
          <ul className="flex flex-col gap-1">
            {info.trips.map((trip, i) => (
              <li key={i}>
                {new Date(trip.departureTime).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                →{" "}
                {new Date(trip.arrivalTime).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                (
                {trip.transfers === 1
                  ? t("transfersOne", { count: trip.transfers })
                  : t("transfersOther", { count: trip.transfers })}
                )
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
