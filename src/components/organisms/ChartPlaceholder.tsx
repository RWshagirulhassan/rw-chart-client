import * as React from "react";
import { BarChart3 } from "lucide-react";

export const ChartPlaceholder: React.FC = () => (
  // ✅ CHANGED: removed fixed min-heights, let parent control size
  // ✅ CHANGED: flex-1 + min-h-0 so it can expand/shrink properly
  <div className="relative w-full h-full flex-1 min-h-0 ">
    <div className="absolute inset-0 rounded-lg border bg-gradient-to-b from-muted/40 to-transparent" />
    <div className="absolute inset-0 flex items-center justify-center ">
      <div className="text-center">
        <BarChart3 className="mx-auto mb-2 h-7 w-7 text-muted-foreground " />
        <div className="text-sm text-muted-foreground">
          Chart placeholder (plug your TV/Lightweight chart here)
        </div>
      </div>
    </div>
  </div>
);
