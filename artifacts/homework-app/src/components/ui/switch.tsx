import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Size: clearly tappable on mobile
      "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
      // Transitions
      "shadow-sm transition-all duration-200 ease-in-out",
      // Focus ring
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      // Disabled
      "disabled:cursor-not-allowed disabled:opacity-40",
      // ON = green, OFF = red
      "data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-rose-400",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md ring-0",
        "transition-transform duration-200 ease-in-out",
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5",
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
