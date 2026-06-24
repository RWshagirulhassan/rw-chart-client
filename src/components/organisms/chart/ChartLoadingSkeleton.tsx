"use client";

import * as React from "react";

type SkeletonCandle = {
  x: number;
  wickTop: number;
  wickBottom: number;
  bodyTop: number;
  bodyBottom: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const SAMPLE_SERIES = [
  { open: 86.3, high: 87, low: 86.05, close: 86.37 },
  { open: 86.5, high: 87.15, low: 85.6, close: 86.93 },
  { open: 86.93, high: 87.09, low: 86.06, close: 86.61 },
  { open: 86.48, high: 87.28, low: 86.2, close: 86.46 },
  { open: 86.6, high: 86.75, low: 84.99, close: 85.44 },
  { open: 85.5, high: 88.12, low: 85.21, close: 86.67 },
  { open: 86.67, high: 87.71, low: 86.3, close: 86.94 },
  { open: 86.25, high: 87.79, low: 85.2, close: 86.45 },
  { open: 87, high: 87.68, low: 85.1, close: 85.36 },
  { open: 85.5, high: 87.81, low: 85.05, close: 87.04 },
  { open: 85.71, high: 86.8, low: 84.61, close: 84.79 },
  { open: 85.04, high: 85.42, low: 84.49, close: 84.63 },
  { open: 85, high: 87.09, low: 84.78, close: 86.95 },
  { open: 84.99, high: 85.7, low: 84.57, close: 85.33 },
  { open: 84.05, high: 84.55, low: 81.72, close: 82.85 },
  { open: 82.5, high: 82.72, low: 80.25, close: 81.48 },
  { open: 80.9, high: 82.72, low: 80.68, close: 82.31 },
  { open: 81.51, high: 81.6, low: 80, close: 80.3 },
  { open: 80.54, high: 81.5, low: 80.41, close: 81.25 },
  { open: 80.53, high: 80.68, low: 79.64, close: 80.05 },
  { open: 80, high: 80.12, low: 78.65, close: 78.82 },
  { open: 78.82, high: 78.89, low: 75.93, close: 76.96 },
  { open: 77.23, high: 77.97, low: 76.61, close: 77.43 },
  { open: 76.95, high: 77.01, low: 76.36, close: 76.74 },
  { open: 76.31, high: 77.59, low: 76.02, close: 77.3 },
  { open: 76.82, high: 77.2, low: 76.64, close: 77.07 },
  { open: 76.2, high: 76.63, low: 75.05, close: 76.47 },
  { open: 75, high: 76.75, low: 74.75, close: 76.61 },
  { open: 77.42, high: 79.17, low: 77.28, close: 78.36 },
  { open: 78.48, high: 79.9, low: 78.32, close: 79.22 },
  { open: 79.56, high: 83.93, low: 79.5, close: 83.62 },
  { open: 83.8, high: 84.23, low: 81.72, close: 82.17 },
  { open: 82.38, high: 82.99, low: 80.26, close: 82.8 },
  { open: 77, high: 77.67, low: 75.94, close: 76.12 },
  { open: 75.43, high: 76.17, low: 74.36, close: 75.14 },
  { open: 79.2, high: 80.2, low: 78.37, close: 79.18 },
  { open: 77.4, high: 80.37, low: 76.2, close: 80 },
  { open: 80.29, high: 80.29, low: 78.04, close: 78.9 },
  { open: 75.69, high: 76.3, low: 74.75, close: 75.67 },
  { open: 72.35, high: 74.5, low: 72.35, close: 74.15 },
  { open: 75.9, high: 77.1, low: 75.67, close: 76.89 },
  { open: 76.8, high: 77.17, low: 74.7, close: 75.28 },
  { open: 75.25, high: 76.33, low: 74.22, close: 76.16 },
  { open: 78, high: 78.54, low: 76.63, close: 77.11 },
  { open: 81.1, high: 82.22, low: 79.92, close: 81.38 },
  { open: 83.1, high: 84.57, low: 82.3, close: 82.63 },
  { open: 81.48, high: 82.28, low: 79.98, close: 80.66 },
  { open: 83.21, high: 85.6, low: 83.15, close: 85.38 },
  { open: 83.99, high: 84.08, low: 81.26, close: 81.58 },
  { open: 78.78, high: 79.03, low: 76.6, close: 76.79 },
  { open: 77.9, high: 79.5, low: 77.62, close: 79.06 },
  { open: 79.75, high: 80.49, low: 78.75, close: 79 },
  { open: 78.51, high: 81, low: 78.44, close: 80.68 },
  { open: 74.73, high: 75, low: 71.82, close: 72.29 },
  { open: 72.72, high: 72.8, low: 71.62, close: 72.13 },
  { open: 74.5, high: 75.74, low: 73.91, close: 74.69 },
  { open: 75.84, high: 79.48, low: 75.65, close: 78.22 },
  { open: 77.52, high: 80.49, low: 77.52, close: 79.31 },
] as const;

function buildSkeletonCandles(): SkeletonCandle[] {
  const series = SAMPLE_SERIES;
  const allValues = series.flatMap((candle) => [
    candle.open,
    candle.high,
    candle.low,
    candle.close,
  ]);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = Math.max(1, max - min);

  return series.map((candle, index) => {
    const normalize = (value: number) =>
      clamp(16 + ((max - value) / range) * 56, 12, 88);

    return {
      x: ((index + 0.5) / series.length) * 100,
      wickTop: normalize(candle.high),
      wickBottom: normalize(candle.low),
      bodyTop: normalize(Math.max(candle.open, candle.close)),
      bodyBottom: normalize(Math.min(candle.open, candle.close)),
    };
  });
}

const SKELETON_CANDLES = buildSkeletonCandles();

export const ChartLoadingSkeleton: React.FC<{
  message?: string;
}> = ({ message = "Loading chart..." }) => {
  return (
    <div className="absolute inset-0 z-10 pointer-events-none bg-background/10">
      <div className="absolute inset-0">
        {[14, 28, 42, 56, 70, 84].map((top) => (
          <div
            key={`h-${top}`}
            className="absolute left-0 right-0 border-t border-border/40"
            style={{ top: `${top}%` }}
          />
        ))}
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((left) => (
          <div
            key={`v-${left}`}
            className="absolute bottom-0 top-0 border-l border-border/25"
            style={{ left: `${left}%` }}
          />
        ))}

        <div className="absolute inset-0 overflow-hidden">
          {SKELETON_CANDLES.map((candle, index) => {
            const bodyHeight = Math.max(0.9, candle.bodyBottom - candle.bodyTop);

            return (
              <div
                key={index}
                className="absolute animate-pulse"
                style={{
                  left: `${candle.x}%`,
                  top: `${candle.wickTop}%`,
                  height: `${candle.wickBottom - candle.wickTop}%`,
                  width: "14px",
                  transform: "translateX(-50%)",
                  animationDelay: `${(index % 10) * 70}ms`,
                  animationDuration: "1.6s",
                  opacity: 0.95,
                }}
              >
                <div
                  className="absolute left-1/2 top-0 w-px -translate-x-1/2 bg-foreground/24"
                  style={{ height: "100%" }}
                />
                <div
                  className="absolute left-1/2 -translate-x-1/2 rounded-[1px] border border-foreground/18 bg-foreground/10"
                  style={{
                    top: `${((candle.bodyTop - candle.wickTop) / (candle.wickBottom - candle.wickTop)) * 100}%`,
                    height: `${(bodyHeight / (candle.wickBottom - candle.wickTop)) * 100}%`,
                    width: "8px",
                    minHeight: "7px",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="absolute left-4 top-4 space-y-2">
          <div className="h-3 w-28 animate-pulse rounded-sm bg-foreground/12" />
          <div className="h-2.5 w-40 animate-pulse rounded-sm bg-foreground/8" />
        </div>

        <div className="absolute bottom-4 left-4">
          <div className="inline-flex items-center gap-2 border border-border/70 bg-background/94 px-3 py-2 shadow-sm">
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-foreground/50" />
            <div className="text-xs text-muted-foreground">{message}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
