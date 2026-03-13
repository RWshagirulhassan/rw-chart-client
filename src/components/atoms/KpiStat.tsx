import * as React from "react";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type KpiStatProps = {
  label: string;
  value: string | number;
  sub?: string; // e.g., “+108.32%”
  tooltip?: string;
  className?: string;
};

export const KpiStat: React.FC<KpiStatProps> = ({
  label,
  value,
  sub,
  tooltip,
  className,
}) => {
  const body = (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <span>{label}</span>
        {tooltip && <Info className="h-3.5 w-3.5" />}
      </div>
      <div className="text-xl font-medium">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );

  if (!tooltip) return body;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
};
