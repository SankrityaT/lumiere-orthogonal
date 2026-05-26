"use client";

/**
 * Mark — two perpendicular bars meeting at center inside a soft ring.
 * Reads as a literal "orthogonal" glyph. Uses currentColor so it inherits
 * the accent. The `dense` variant drops the ring for tiny sizes.
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
      {!dense && (
        <circle
          cx="16"
          cy="16"
          r="13.5"
          stroke="currentColor"
          strokeWidth="1.1"
          opacity="0.4"
        />
      )}
      <rect
        x={dense ? 4 : 7}
        y="15"
        width={dense ? 24 : 18}
        height="2"
        rx="1"
        fill="currentColor"
      />
      <rect
        x="15"
        y={dense ? 4 : 7}
        width="2"
        height={dense ? 24 : 18}
        rx="1"
        fill="currentColor"
      />
    </svg>
  );
}
