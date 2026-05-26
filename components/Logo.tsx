"use client";

import { Mark } from "./Mark";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cfg = {
    sm: { mark: 16, text: "text-[13px]" },
    md: { mark: 18, text: "text-[14.5px]" },
    lg: { mark: 28, text: "text-2xl" },
  }[size];
  return (
    <div className="inline-flex items-center gap-2 select-none">
      <Mark size={cfg.mark} className="text-accent" />
      <span className={`font-sans font-medium tracking-tight ${cfg.text} text-ink leading-none whitespace-nowrap`}>
        Orthogonal Chat
      </span>
    </div>
  );
}
