"use client";

/**
 * Mark — isometric cube viewed from the corner. Top face filled, side faces
 * outlined at reduced opacity to create depth. Geometric, distinctive at
 * every size, ties visually to "structure / context / dimension." Uses
 * currentColor so it inherits the accent. The `dense` variant collapses
 * to just the top-face rhombus so it stays legible at favicon size.
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
      {dense ? (
        <path d="M 16 4 L 28 11 L 16 18 L 4 11 Z" fill="currentColor" />
      ) : (
        <>
          {/* Top face: filled */}
          <path d="M 16 3 L 28 10 L 16 17 L 4 10 Z" fill="currentColor" />
          {/* Right face: outlined */}
          <path
            d="M 28 10 L 28 22 L 16 29 L 16 17 Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
            opacity="0.55"
          />
          {/* Left face: outlined */}
          <path
            d="M 4 10 L 4 22 L 16 29 L 16 17 Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
            opacity="0.55"
          />
        </>
      )}
    </svg>
  );
}
