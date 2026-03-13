import * as React from "react";
import { ChartNoAxesCombined, Trash } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";

export const WatchItem: React.FC<{
  _;
  symbol: string;
  change?: number;
  price?: number;
  onOpenChart?: () => void;
  onRemove?: () => void;
}> = ({ symbol, change, price, onOpenChart, onRemove }) => (
  <div className="group relative flex min-h-10 items-center justify-between px-3 py-2 hover:bg-muted/60 rounded-none text-gray-600">
    <div className="flex items-center gap-2">
      <div className="font-medium text-xs">{symbol}</div>
    </div>

    {/* Default: show price + change. On hover: hide */}
    <div className="flex items-end gap-6 group-hover:hidden">
      {typeof change === "number" ? (
        <span
          className={cn(
            "text-xs",
            change >= 0 ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">--</span>
      )}
      {typeof price === "number" ? (
        <span className="text-xs font-medium tabular-nums">
          {price.toFixed(2)}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">--</span>
      )}
    </div>

    {/* Hidden by default. On hover (sm+): show buttons */}
    <div className="hidden items-center gap-2 group-hover:flex">
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 rounded-none p-0"
        aria-label="Open Chart"
        onClick={onOpenChart}
      >
        <ChartNoAxesCombined className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-7 w-7 rounded-none p-0"
        aria-label="Remove"
        onClick={onRemove}
      >
        <Trash className="h-3.5 w-3.5" />
      </Button>
    </div>
  </div>
);
