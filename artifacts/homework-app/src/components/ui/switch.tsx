import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  /**
   * "default"    → مفعّل / معطّل  (الافتراضي)
   * "visibility" → ظاهر   / مخفي
   * "none"       → بدون نص (للاستخدام داخل label لديها نصها الخاص)
   */
  labelVariant?: "default" | "visibility" | "none"
}

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, labelVariant = "default", checked, ...props }, ref) => {
  const isOn = Boolean(checked)

  const label =
    labelVariant === "none"
      ? null
      : labelVariant === "visibility"
        ? (isOn ? "ظاهر" : "مخفي")
        : (isOn ? "مفعّل" : "معطّل")

  return (
    <span className="inline-flex items-center gap-1.5">
      {label !== null && (
        <span
          className={cn(
            "text-xs font-semibold select-none transition-colors",
            isOn ? "text-emerald-600" : "text-muted-foreground/70",
          )}
        >
          {label}
        </span>
      )}

      <SwitchPrimitives.Root
        checked={checked}
        className={cn(
          "peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent",
          "shadow-sm transition-all duration-200 ease-in-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-40",
          // ON = green, OFF = quiet grey
          "data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-muted-foreground/30",
          className,
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
    </span>
  )
})
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
