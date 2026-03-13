"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ToggleGroupContextValue = {
  value: string[];
  onValueChange?: (value: string[]) => void;
  variant?: "default" | "outline";
  size?: "sm" | "md";
};

const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(
  null
);

type ToggleGroupProps = React.HTMLAttributes<HTMLDivElement> & {
  type?: "single" | "multiple";
  value?: string[];
  onValueChange?: (value: string[]) => void;
  variant?: "default" | "outline";
  size?: "sm" | "md";
};

const ToggleGroup = React.forwardRef<HTMLDivElement, ToggleGroupProps>(
  (
    {
      className,
      value = [],
      onValueChange,
      variant = "default",
      size = "md",
      children,
      ...props
    },
    ref
  ) => (
    <ToggleGroupContext.Provider value={{ value, onValueChange, variant, size }}>
      <div
        ref={ref}
        className={cn("flex flex-wrap gap-2", className)}
        {...props}
      >
        {children}
      </div>
    </ToggleGroupContext.Provider>
  )
);
ToggleGroup.displayName = "ToggleGroup";

type ToggleGroupItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  value: string;
};

const ToggleGroupItem = React.forwardRef<HTMLButtonElement, ToggleGroupItemProps>(
  ({ className, value, children, ...props }, ref) => {
    const context = React.useContext(ToggleGroupContext);
    const isActive = context?.value.includes(value) ?? false;
    const variant = context?.variant ?? "default";
    const size = context?.size ?? "md";

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={isActive}
        data-state={isActive ? "on" : "off"}
        onClick={() => {
          if (!context?.onValueChange) return;
          const next = isActive
            ? context.value.filter((item) => item !== value)
            : [...context.value, value];
          context.onValueChange(next);
        }}
        className={cn(
          "inline-flex items-center justify-center rounded-md border border-input text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          size === "sm" ? "h-7 px-2" : "h-8 px-2.5",
          variant === "outline"
            ? "bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            : "bg-muted text-foreground hover:bg-accent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
ToggleGroupItem.displayName = "ToggleGroupItem";

export { ToggleGroup, ToggleGroupItem };
