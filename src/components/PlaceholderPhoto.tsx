"use client";

/**
 * Photo slot for the landing page (currently the user's own photos under
 * public/images/). Falls back to a plain Deichgrün-accent panel if the
 * image fails to load, so swapping in a different photo later is just a
 * one-line `src` change.
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
