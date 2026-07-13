"use client";

import { useTranslations } from "next-intl";
import RouteSummary from "@/components/RouteSummary";
import TrainReturnPanel from "@/components/TrainReturnPanel";
import StopCandidates from "@/components/planner/StopCandidates";
import { LANDSCAPE_EMOJI, useLandscapeLabels } from "@/lib/scenicCorridors";
import type {
  LatLon,
  PlannedRoute,
  POI,
  RoadTypeResult,
  RouteMode,
  ScenicRoutePlan,
  SignatureRoutePlan,
  StopRequest,
} from "@/lib/types";

export default function ResultStep({
  route,
  pois,
  selectedStopPois,
  error,
  mode,
  start,
  date,
  destination,
  scenicPlan,
  signaturePlan,
  onRoadTypeSegments,
  stopRequests,
  selectedStopPoiIds,
  onSelectStopPoi,
}: {
  route: PlannedRoute | null;
  pois: POI[];
  selectedStopPois: POI[];
  error: string | null;
  mode: RouteMode;
  start: LatLon | null;
  date: string;
  destination: LatLon | null;
  scenicPlan: ScenicRoutePlan | null;
  signaturePlan: SignatureRoutePlan | null;
  onRoadTypeSegments: (segments: RoadTypeResult["segments"]) => void;
  stopRequests: StopRequest[];
  selectedStopPoiIds: Record<string, number>;
  onSelectStopPoi: (stopId: string, poiId: number) => void;
}) {
  const t = useTranslations("planner");
  const landscapeLabels = useLandscapeLabels();

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md bg-red-950/40 p-2 text-xs text-red-300 whitespace-pre-wrap break-words">
          {error}
        </div>
      )}

      {scenicPlan && (
        <div className="rounded-md border border-meewind-border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{scenicPlan.corridor.name}</span>
            <span className="text-xs text-meewind-fg-muted">
              {LANDSCAPE_EMOJI[scenicPlan.corridor.landscapeType]}{" "}
              {landscapeLabels[scenicPlan.corridor.landscapeType]}
            </span>
          </div>
          <p className="mt-1 text-xs text-meewind-fg-muted">{scenicPlan.corridor.description}</p>
        </div>
      )}

      {signaturePlan && (
        <div className="rounded-md border border-meewind-border p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{signaturePlan.signatureRoute.name}</span>
            <span className="text-xs text-meewind-fg-muted">
              {LANDSCAPE_EMOJI[signaturePlan.signatureRoute.landscapeType]}{" "}
              {landscapeLabels[signaturePlan.signatureRoute.landscapeType]}
            </span>
          </div>
          <p className="mt-1 text-xs text-meewind-fg-muted">
            {signaturePlan.signatureRoute.description}
          </p>
          <p className="mt-1 text-xs text-meewind-fg-muted">
            {signaturePlan.usedStation
              ? t("home.signatureStationHint", { station: signaturePlan.station?.name ?? "" })
              : t("home.signatureDirectHint")}
          </p>
        </div>
      )}

      {route ? (
        <RouteSummary
          route={route}
          pois={pois}
          extraWaypoints={selectedStopPois}
          onRoadTypeSegments={onRoadTypeSegments}
        />
      ) : (
        !error && <p className="text-xs text-meewind-fg-muted">{t("result.empty")}</p>
      )}

      {route && (
        <StopCandidates
          route={route}
          pois={pois}
          stopRequests={stopRequests}
          selectedStopPoiIds={selectedStopPoiIds}
          onSelectStopPoi={onSelectStopPoi}
        />
      )}

      {scenicPlan && (
        <>
          <TrainReturnPanel
            home={start ?? scenicPlan.entryStation}
            dest={scenicPlan.entryStation}
            date={date}
            title={t("home.scenicOutboundTitle")}
            preloaded={scenicPlan.outboundTrain}
          />
          <TrainReturnPanel
            home={start ?? scenicPlan.entryStation}
            dest={scenicPlan.exitStation}
            date={date}
            title={t("home.scenicReturnTitle")}
            preloaded={scenicPlan.returnTrain}
          />
        </>
      )}

      {signaturePlan?.usedStation && signaturePlan.station && signaturePlan.outboundTrain && (
        <>
          <TrainReturnPanel
            home={start ?? signaturePlan.station}
            dest={signaturePlan.station}
            date={date}
            title={t("home.signatureOutboundTitle")}
            preloaded={signaturePlan.outboundTrain}
          />
          <TrainReturnPanel
            home={start ?? signaturePlan.station}
            dest={signaturePlan.station}
            date={date}
            title={t("home.signatureReturnTitle")}
            preloaded={signaturePlan.returnTrain ?? undefined}
          />
        </>
      )}

      {!scenicPlan && route && mode === "oneway" && start && destination && (
        <TrainReturnPanel home={start} dest={destination} date={date} />
      )}
    </div>
  );
}
