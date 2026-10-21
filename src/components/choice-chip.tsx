"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Choice chip (design system: pill, 44px minimum). `single` chips behave as radios inside a
 * `role="radiogroup"`; otherwise they toggle (aria-pressed).
 */
export function ChoiceChip({
  on,
  onClick,
  single = false,
  size = "md",
  children,
}: {
  on: boolean;
  onClick: () => void;
  single?: boolean;
  size?: "md" | "sm";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role={single ? "radio" : undefined}
      aria-checked={single ? on : undefined}
      aria-pressed={single ? undefined : on}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border-[1.5px] font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring",
        size === "md" ? "min-h-11 px-4 text-small" : "min-h-9 px-3 text-caption",
        on ? "border-primary bg-secondary text-primary" : "border-input bg-card text-foreground hover:bg-muted",
      )}
    >
      {on && <Check className={size === "md" ? "size-4" : "size-3.5"} aria-hidden />}
      {children}
    </button>
  );
}
