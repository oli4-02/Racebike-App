"use client";

import type { DestinationSuggestion } from "@/lib/types";

export default function DestinationSuggestions({
  suggestions,
  loading,
  onSelect,
}: {
  suggestions: DestinationSuggestion[];
  loading: boolean;
  onSelect: (s: DestinationSuggestion) => void;
}) {
  if (loading) {
    return <p className="text-xs text-zinc-500">Suche Zielvorschläge…</p>;
  }
  if (suggestions.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        Keine Zielvorschläge in dieser Distanz gefunden. Distanz anpassen oder
        Ziel manuell eingeben.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {suggestions.map((s) => (
        <div
          key={s.name}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden"
        >
          {s.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={s.imageUrl}
              alt={s.name}
              className="w-full h-28 object-cover"
            />
          )}
          <div className="p-2 flex flex-col gap-1">
            <span className="text-sm font-medium">{s.name}</span>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">{s.reason}</p>
            <button
              type="button"
              onClick={() => onSelect(s)}
              className="mt-1 rounded-md bg-blue-600 text-white text-xs font-medium py-1.5"
            >
              Diese Route planen
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
