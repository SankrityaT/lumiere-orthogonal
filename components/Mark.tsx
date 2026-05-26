"use client";

import { useId } from "react";

/**
 * Lumière mark — a bright disc with two thin orbital ellipses crossing it.
 * Reads as a celestial/lens motif. Uses currentColor so it inherits the
 * accent. The `dense` variant drops the orbits for tiny sizes (avatar, favicon).
 */
export function Mark({
  size = 18,
  className,
  dense = false,
}: {
  size?: number;
  className?: string;
  dense?: boolean;
}) {
  const id = useId();
  const orbitId = `m-${id}`;

  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {!dense && (
        <>
          {/* Orbital ellipses, masked so they appear behind the disc cleanly */}
          <defs>
            <mask id={orbitId}>
              <rect width="32" height="32" fill="white" />
              <circle cx="16" cy="16" r="4.4" fill="black" />
            </mask>
          </defs>
          <g mask={`url(#${orbitId})`} stroke="currentColor" strokeWidth="1.1" fill="none" opacity="0.85">
            <ellipse cx="16" cy="16" rx="14" ry="4.6" transform="rotate(-28 16 16)" />
            <ellipse cx="16" cy="16" rx="14" ry="4.6" transform="rotate(28 16 16)" />
          </g>
        </>
      )}
      {/* Central disc */}
      <circle cx="16" cy="16" r={dense ? 5.5 : 3.6} fill="currentColor" />
      {/* Tiny highlight inside disc for a hint of dimension */}
      <circle cx={dense ? 14 : 14.8} cy={dense ? 14 : 14.8} r={dense ? 1.4 : 1} fill="currentColor" opacity="0.45" style={{ mixBlendMode: "screen" }} />
    </svg>
  );
}
