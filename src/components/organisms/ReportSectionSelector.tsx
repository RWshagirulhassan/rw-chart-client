// src/components/organisms/ReportSectionSelector.tsx
import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type ReportSection =
  | "overview"
  | "performance"
  | "trades"
  | "risk"
  | "list";

export const DEFAULT_REPORT_SECTION_OPTIONS: {
  value: ReportSection;
  label: string;
  disabled?: boolean;
}[] = [
  { value: "overview", label: "Overview" },
  { value: "performance", label: "Performance" },
  { value: "trades", label: "Trades analysis" },
  { value: "risk", label: "Risk/performance ratios" },
  { value: "list", label: "List of trades" },
];

type Props = {
  value: ReportSection;
  onChange: (v: ReportSection) => void;
  /** Override labels or hide items if needed */
  options?: typeof DEFAULT_REPORT_SECTION_OPTIONS;
  /** "sm" for tighter height; default "md" */
  size?: "sm" | "md";
  /** Keep horizontal scroll on narrow screens (default true) */
  scrollable?: boolean;
  className?: string;
};

/**
 * Chip-style section selector used by the Strategy Tester views.
 * Responsive: scrolls horizontally on small screens; wraps when there's room.
 */
export const ReportSectionSelector: React.FC<Props> = ({
  value,
  onChange,
  options = DEFAULT_REPORT_SECTION_OPTIONS,
  size = "md",
  scrollable = true,
  className,
}) => {
  const baseH = size === "sm" ? "h-8" : "h-9";
  const basePx = size === "sm" ? "px-3" : "px-4";
  const gap = size === "sm" ? "gap-1.5" : "gap-2";

  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as ReportSection)}
      className={cn("w-full", className)}
    >
      <div className={cn("relative", scrollable && "overflow-x-auto")}>
        <TabsList
          className={cn("flex bg-transparent p-0 min-w-max flex-wrap", gap)}
        >
          {options.map((o) => (
            <TabsTrigger
              key={o.value}
              value={o.value}
              disabled={!!o.disabled}
              className={cn(
                "rounded-full border text-sm whitespace-nowrap",
                baseH,
                basePx,
                // active/inactive pill styles
                "data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:border-transparent",
                "data-[state=inactive]:bg-transparent"
              )}
            >
              {o.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
    </Tabs>
  );
};
