"use client";

import { useEffect, useRef, useState } from "react";
import { geocode, type GeocodeResult } from "@/lib/apiClient";
import type { LatLon } from "@/lib/types";

export default function AddressSearch({
  onSelect,
}: {
  onSelect: (p: LatLon, label: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const q = query.trim();
      if (q.length < 3) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const r = await geocode(q);
        setResults(r);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="relative">
      <label className="block text-sm font-medium mb-1">
        Startadresse
      </label>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="z.B. Utrecht, Domplein"
        className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
      />
      {loading && (
        <div className="absolute right-2 top-9 text-xs text-zinc-500">…</div>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-[1000] mt-1 w-full max-h-60 overflow-auto rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg text-sm">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                onClick={() => {
                  onSelect({ lat: r.lat, lon: r.lon }, r.displayName);
                  setQuery(r.displayName);
                  setOpen(false);
                }}
              >
                {r.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
