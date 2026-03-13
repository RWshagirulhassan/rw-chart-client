import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

type Props = { className?: string };

export const EquityCurveMock: React.FC<Props> = ({ className }) => {
  return (
    <Card
      className={cn("relative  h-[420px] w-full overflow-hidden", className)}
    >
      <svg viewBox="0 0 1200 420" className="absolute inset-0 h-full w-full">
        {/* baseline grid */}
        <g opacity="0.12">
          {Array.from({ length: 8 }).map((_, i) => (
            <line
              key={i}
              x1="0"
              x2="1200"
              y1={50 * (i + 1)}
              y2={50 * (i + 1)}
              stroke="currentColor"
            />
          ))}
        </g>

        {/* equity line (cyan) */}
        <polyline
          fill="none"
          stroke="rgb(45,212,191)"
          strokeWidth="3"
          points="10,300 90,290 170,270 250,265 330,260 410,255 490,260 570,275 650,280 730,260 810,200 890,210 970,190 1050,210 1130,195"
        />
        {/* drawdown line (blue) */}
        <polyline
          fill="none"
          stroke="rgb(59,130,246)"
          strokeWidth="2"
          points="10,320 90,330 170,340 250,355 330,350 410,345 490,350 570,360 650,340 730,300 810,310 890,285 970,320 1050,310 1130,330"
        />
        {/* bars (gains/losses) */}
        {Array.from({ length: 14 }).map((_, i) => {
          const x = 80 + i * 70;
          const up = i % 4 !== 2;
          const h = up ? 60 + (i % 3) * 20 : 40 + (i % 3) * 20;
          return (
            <rect
              key={i}
              x={x}
              y={up ? 300 - h : 300}
              width="30"
              height={h}
              fill={up ? "rgb(16,185,129)" : "rgb(244,63,94)"}
              opacity={0.7}
            />
          );
        })}
      </svg>
      {/* bottom toggles placeholder */}
      <div className="absolute bottom-2 left-2 flex items-center gap-6 text-xs">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" defaultChecked className="accent-foreground" />{" "}
          Buy &amp; hold
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" defaultChecked className="accent-foreground" />{" "}
          Trades run-up &amp; drawdown
        </label>
      </div>
      <div className="absolute bottom-2 right-2 text-xs text-muted-foreground flex items-center gap-3">
        <span>Absolute</span>
        <span className="rounded-md border px-2 py-1 bg-muted">Percentage</span>
      </div>
    </Card>
  );
};
