const WIKIPEDIA_HEADERS = {
  "User-Agent":
    "racebike-app/0.1 (personal cycling route planner; https://github.com/oli4-02/Racebike-App)",
};

export type WikipediaInfo = {
  extract: string;
  imageUrl: string | null;
  /** Number of other-language editions of the article; used as a fame/popularity proxy. */
  languageCount: number;
};

/**
 * Fetches a short German Wikipedia summary plus thumbnail and language-link
 * count for a place name in a single action-API call; null if there's no
 * clean (non-redirect-ambiguous, non-missing) match.
 */
export async function fetchWikipediaInfo(
  title: string
): Promise<WikipediaInfo | null> {
  const url =
    `https://de.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}` +
    `&prop=extracts|pageimages|langlinks&exintro=1&explaintext=1` +
    `&piprop=thumbnail&pithumbsize=400&lllimit=500&redirects=1` +
    `&format=json&formatversion=2`;

  try {
    const res = await fetch(url, {
      headers: WIKIPEDIA_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const page = data?.query?.pages?.[0];
    if (!page || page.missing || !page.extract) return null;

    return {
      extract: page.extract as string,
      imageUrl: page.thumbnail?.source ?? null,
      languageCount: Array.isArray(page.langlinks) ? page.langlinks.length : 0,
    };
  } catch {
    return null;
  }
}

const WIKIPEDIA_LOCALE_HOST: Record<string, string> = { de: "de", en: "en", nl: "nl" };
const REGION_IMAGE_RADIUS_M = 12000;

export type RegionImage = { imageUrl: string; title: string };

/**
 * Finds a representative photo for the area around a point (e.g. a rider's
 * start location) without needing a curated place name first -- unlike
 * `fetchWikipediaInfo`, which requires already knowing a title, this uses
 * Wikipedia's `geosearch` as a generator to find nearby geo-tagged articles
 * and picks the first one that actually has a thumbnail (not every nearby
 * article does). Best-effort: returns null on any failure or if nothing
 * within range has an image, and the caller should treat that as "no photo
 * for this result" rather than an error.
 */
export async function fetchNearbyRegionImage(
  lat: number,
  lon: number,
  locale: string
): Promise<RegionImage | null> {
  const host = WIKIPEDIA_LOCALE_HOST[locale] ?? "en";
  const url =
    `https://${host}.wikipedia.org/w/api.php?action=query&generator=geosearch` +
    `&ggscoord=${lat}|${lon}&ggsradius=${REGION_IMAGE_RADIUS_M}&ggslimit=10` +
    `&prop=pageimages&piprop=thumbnail&pithumbsize=800` +
    `&format=json&formatversion=2`;

  try {
    const res = await fetch(url, {
      headers: WIKIPEDIA_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages: { title?: string; thumbnail?: { source?: string } }[] = data?.query?.pages ?? [];
    const withImage = pages.find((p) => p.thumbnail?.source);
    if (!withImage?.thumbnail?.source || !withImage.title) return null;

    return { imageUrl: withImage.thumbnail.source, title: withImage.title };
  } catch {
    return null;
  }
}
