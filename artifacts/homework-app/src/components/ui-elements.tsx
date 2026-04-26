import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "bg-card text-card-foreground rounded-2xl shadow-lg shadow-black/5 border border-border/50",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex w-full px-4 py-3 rounded-xl bg-background border-2 border-border text-foreground placeholder:text-muted-foreground",
        "focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Button = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'destructive' }>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30",
      outline: "border-2 border-border bg-transparent text-foreground hover:bg-accent hover:border-accent hover:text-accent-foreground",
      ghost: "bg-transparent text-foreground hover:bg-muted",
      destructive: "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20 hover:bg-destructive/90"
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center px-6 py-3 rounded-xl font-bold transition-all duration-200 ease-out",
          "hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none",
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export const Label = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "text-sm font-semibold text-foreground mb-2 block",
        className
      )}
      {...props}
    />
  )
);
Label.displayName = "Label";
