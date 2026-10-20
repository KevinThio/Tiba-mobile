"use client"

import { Switch as SwitchPrimitive } from "@base-ui/react/switch"
import { cn } from "@/lib/utils"

/**
 * Design-system toggle: 48 × 28px pill track (ink-300 off, fern on) with a 22px white thumb.
 * Pair it with a <label> (or aria-label) that says what it turns on.
 */
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-border-strong transition-colors duration-200 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring data-checked:bg-primary data-disabled:cursor-not-allowed data-disabled:bg-disabled",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-[22px] translate-x-[3px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out data-checked:translate-x-[23px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
