import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const TimeframeMenu: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => {
  const items = [
    { label: "Minutes", values: ["1m", "3m", "5m", "10m", "15m", "30m"] },
    { label: "Hours", values: ["1h"] },
    { label: "Days", values: ["1D"] },
    // { label: "Ticks", values: ["10t", "100t", "1000t"] },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 h-8 text-muted-foreground"
        >
          <span className="font-medium w-6 text-left text-sm">{value}</span>
          {/* <ChevronDown className="h-4 w-4" /> */}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {items.map((group) => (
          <div key={group.label.toUpperCase()}>
            <DropdownMenuLabel className="text-xs text-muted-foreground capitalize">
              {group.label.toUpperCase()}
            </DropdownMenuLabel>
            {group.values.map((v) => (
              <DropdownMenuCheckboxItem
                key={v}
                checked={value === v}
                onCheckedChange={() => onChange(v)}
              >
                {v.toUpperCase()}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
