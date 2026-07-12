const WIKIPEDIA_HEADERS = {
  "User-Agent":
    "racebike-app/0.1 (personal cycling route planner; https://github.com/oli4-02/Racebike-App)",
};

export type WikipediaSummary = {
  extract: string;
  imageUrl: string | null;
};

/** Fetches a short German Wikipedia summary for a place name; null if there's no clean match. */
export async function fetchWikipediaSummary(
  title: string
): Promise<WikipediaSummary | null> {
  const url = `https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;

  try {
    const res = await fetch(url, {
      headers: WIKIPEDIA_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.type === "disambiguation" || !data.extract) return null;

    return {
      extract: data.extract as string,
      imageUrl: data.thumbnail?.source ?? null,
    };
  } catch {
    return null;
  }
}
