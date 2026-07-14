"use client";

import { useLocale } from "next-intl";
import { useEffect, useState } from "react";
import { fetchRegionImage } from "@/lib/apiClient";
import type { LatLon } from "@/lib/types";

/**
 * Representative photo for the area a route passes through. Unlike the
 * curated landing-page photos, this can't be hand-picked ahead of time --
 * the route could be anywhere -- so it looks up a nearby geo-tagged
 * Wikipedia article via `fetchNearbyRegionImage` at request time. Best
 * effort: silently renders nothing while there's no image yet (loading, no
 * nearby article with a thumbnail, or the image itself fails to load).
 */
export default function RegionPhoto({ point }: { point: LatLon }) {
  const locale = useLocale();
  const [image, setImage] = useState<{ imageUrl: string; title: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRegionImage(point, locale)
      .then((img) => {
        if (cancelled) return;
        setImage(img);
        setFailed(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setImage(null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depend on the coordinate values, not the LatLon object identity
  }, [point.lat, point.lon, locale]);

  if (loading) return <div className="h-36 w-full animate-pulse rounded-lg bg-meewind-bg-raised" />;
  if (!image || failed) return null;

  return (
    <div className="relative h-36 w-full overflow-hidden rounded-lg bg-meewind-bg-raised">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.imageUrl}
        alt={image.title}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
      <span className="absolute bottom-1 right-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
        {image.title} · Wikipedia
      </span>
    </div>
  );
}
