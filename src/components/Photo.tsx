"use client";
import { useState } from "react";

/** Image with a green placeholder when no URL is set or the image fails to load. */
export default function Photo({ src, alt, className = "", position = "center" }: {
  src: string; alt: string; className?: string; position?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-leaf/40 via-mint to-ball/40 ${className}`}>
      {src && !failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: position }} />
      )}
    </div>
  );
}
