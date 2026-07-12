"use client";

/**
 * Unsplash placeholder (royalty-free) via Unsplash's keyword-redirect
 * endpoint, so no specific photo ID is hardcoded. Falls back to a plain
 * Deichgrün-accent panel if the image fails to load, so swapping in the
 * user's own photography later is a one-line `src` change.
 */
export default function PlaceholderPhoto({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden bg-meewind-accent/20 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}
