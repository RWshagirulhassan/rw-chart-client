import * as React from "react";
import { cn } from "@/lib/utils";

export const StatPill: React.FC<{ label: string; value: string | number; accent?: "up" | "down" | "flat"; }>
= ({ label, value, accent = "flat" }) => {
  const color =
    accent === "up" ? "text-emerald-600" : accent === "down" ? "text-rose-600" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", color)}>{value}</span>
    </div>
  );
};
