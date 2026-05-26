"use client";

import { Mark } from "./Mark";

export function Logo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const cfg = {
    sm: { mark: 18, text: "text-[18px]" },
    md: { mark: 20, text: "text-[22px]" },
    lg: { mark: 32, text: "text-4xl" },
  }[size];
  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <Mark size={cfg.mark} className="text-accent" />
      <span className={`serif-italic ${cfg.text} text-ink leading-none`}>Lumière</span>
    </div>
  );
}
