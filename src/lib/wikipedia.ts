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
