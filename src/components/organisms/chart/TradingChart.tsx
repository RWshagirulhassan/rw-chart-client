"use client";

import React, { useEffect, useMemo, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  type MouseEventParams,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";
import { drawingRegistry } from "./drawing/drawingRegistry";
import {
  buildCandleTimeIndex,
  resolveDrawingTimeAnchors,
  timeSortKey,
} from "./drawing/timeAnchorResolver";
import { toTime } from "./drawing/toTime";
import {
  useDrawingsList,
  usePlotSeriesList,
  useChartState,
} from "./context/chartStore";
import type { Time } from "lightweight-charts";
import type { ChartTime } from "./model/chartTypes";

export type ChartPointerPoint = {
  time: ChartTime;
  price: number;
  x: number;
  y: number;
};

function cssVar(name: string) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function hslVar(name: string, fallback: string) {
  const v = cssVar(name);
  return v ? `hsl(${v})` : fallback;
}

function hslVarAlpha(name: string, alpha: number, fallback: string) {
  const v = cssVar(name);
  return v ? `hsl(${v} / ${alpha})` : fallback;
}

function pickSeriesColor(seriesId: string) {
  if (seriesId === "close") {
    return hslVar("--chart-1", "#3b82f6");
  }
  return hslVar("--chart-3", "#22c55e");
}

function toLineWidth(value: number | undefined): 1 | 2 | 3 | 4 {
  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }
  return 2;
}

function normalizeLinePoints(points: Array<{ time: Time; value: number }>) {
  const byTime = new Map<number, { time: Time; value: number }>();
  for (const point of points) {
    if (!Number.isFinite(point.value)) {
      continue;
    }
    const key = timeSortKey(point.time);
    byTime.set(key, point);
  }
  return Array.from(byTime.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, point]) => point);
}

export function TradingChart(props: {
  timeframe: string;
  onChartClick?: (point: ChartPointerPoint) => void;
}) {
  const { candles } = useChartState();
  const plotSeries = usePlotSeriesList();
  const drawings = useDrawingsList();
  const { timeframe } = props;
  const onChartClickRef = useRef(props.onChartClick);

  const elRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lineSeriesByIdRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const primitiveByIdRef = useRef<Map<string, any>>(new Map());
  const didApplyInitialViewportRef = useRef(false);
  const userAdjustedViewportRef = useRef(false);
  const suppressVisibleRangeEventRef = useRef(false);

  const normalizedCandles = useMemo(
    () => {
      const byTime = new Map<number, { time: Time; open: number; high: number; low: number; close: number }>();
      for (const c of candles) {
        const time = toTime(c.time);
        const key = timeSortKey(time);
        if (!Number.isFinite(c.open) || !Number.isFinite(c.close)) {
          continue;
        }
        // Keep latest candle for duplicate time slots (e.g. daily live upsert + snapshot overlap).
        byTime.set(key, {
          time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        });
      }
      return Array.from(byTime.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, candle]) => candle);
    },
    [candles],
  );

  const candleTimeIndex = useMemo(
    () => buildCandleTimeIndex(normalizedCandles, timeframe),
    [normalizedCandles, timeframe],
  );

  const resolvedDrawings = useMemo(
    () =>
      drawings.map((drawing) =>
        resolveDrawingTimeAnchors(drawing, candleTimeIndex),
      ),
    [candleTimeIndex, drawings],
  );

  useEffect(() => {
    onChartClickRef.current = props.onChartClick;
  }, [props.onChartClick]);

  useEffect(() => {
    if (!elRef.current) return;

    const chart = createChart(elRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#0a0a0a",
      },
      grid: {
        vertLines: { color: "rgba(0,0,0,0.08)" },
        horzLines: { color: "rgba(0,0,0,0.08)" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 10,
        barSpacing: 8,
      },
      crosshair: {
        vertLine: { color: "rgba(0,0,0,0.18)" },
        horzLine: { color: "rgba(0,0,0,0.18)" },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22ab94",
      downColor: "#f7525f",
      borderVisible: false,
      wickUpColor: "#22ab94",
      wickDownColor: "#f7525f",
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    const handleChartClick = (params: MouseEventParams<Time>) => {
      const listener = onChartClickRef.current;
      if (!listener) {
        return;
      }
      if (!params.point || params.time == null) {
        return;
      }
      const price = candleSeries.coordinateToPrice(params.point.y);
      if (!Number.isFinite(price)) {
        return;
      }
      listener({
        time: params.time as ChartTime,
        price: Number(price),
        x: params.point.x,
        y: params.point.y,
      });
    };

    chart.subscribeClick(handleChartClick);
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      if (suppressVisibleRangeEventRef.current) {
        return;
      }
      if (didApplyInitialViewportRef.current) {
        userAdjustedViewportRef.current = true;
      }
    });

    const applyTheme = () => {
      const bg = hslVar("--background", "#ffffff");
      const fg = hslVar("--foreground", "#0a0a0a");
      const grid = hslVarAlpha("--border", 0.25, "rgba(0,0,0,0.1)");
      const cross = hslVarAlpha("--foreground", 0.18, "rgba(0,0,0,0.18)");
      const up = hslVar("--chart-2", "#22ab94");
      const down = hslVar("--destructive", "#f7525f");

      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: bg },
          textColor: fg,
        },
        grid: {
          vertLines: { color: grid },
          horzLines: { color: grid },
        },
        crosshair: {
          vertLine: { color: cross },
          horzLine: { color: cross },
        },
      });

      candleSeries.applyOptions({
        upColor: up,
        downColor: down,
        borderVisible: false,
        wickUpColor: up,
        wickDownColor: down,
      });
    };

    applyTheme();

    const ro = new ResizeObserver(() => {
      if (!elRef.current) return;
      const r = elRef.current.getBoundingClientRect();
      chart.resize(Math.max(10, Math.floor(r.width)), Math.max(10, Math.floor(r.height)));
    });
    ro.observe(elRef.current);

    const mo = new MutationObserver(() => applyTheme());
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      mo.disconnect();
      ro.disconnect();
      chart.unsubscribeClick(handleChartClick);
      lineSeriesByIdRef.current.clear();
      primitiveByIdRef.current.clear();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !candleSeries) return;
    if (!normalizedCandles.length) {
      didApplyInitialViewportRef.current = false;
      userAdjustedViewportRef.current = false;
      return;
    }

    const previousRange = chart.timeScale().getVisibleLogicalRange();
    candleSeries.setData(normalizedCandles as any);

    if (!didApplyInitialViewportRef.current) {
      const total = normalizedCandles.length;
      const visibleBars = Math.min(120, total);
      const to = total - 1 + 10;
      const from = Math.max(0, total - visibleBars);
      suppressVisibleRangeEventRef.current = true;
      chart.timeScale().setVisibleLogicalRange({ from, to });
      suppressVisibleRangeEventRef.current = false;
      didApplyInitialViewportRef.current = true;
      userAdjustedViewportRef.current = false;
      return;
    }

    if (userAdjustedViewportRef.current && previousRange) {
      suppressVisibleRangeEventRef.current = true;
      chart.timeScale().setVisibleLogicalRange(previousRange);
      suppressVisibleRangeEventRef.current = false;
    }
  }, [normalizedCandles]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const activeIds = new Set(plotSeries.map((series) => series.id));

    for (const [id, lineSeries] of lineSeriesByIdRef.current.entries()) {
      if (!activeIds.has(id)) {
        chart.removeSeries(lineSeries);
        lineSeriesByIdRef.current.delete(id);
      }
    }

    for (const series of plotSeries) {
      if (!lineSeriesByIdRef.current.has(series.id)) {
        const line = chart.addSeries(LineSeries, {
          color: series.style?.color ?? pickSeriesColor(series.id),
          lineWidth: toLineWidth(series.style?.lineWidth),
          lastValueVisible: true,
        });
        lineSeriesByIdRef.current.set(series.id, line);
      }
      const line = lineSeriesByIdRef.current.get(series.id);
      const points = normalizeLinePoints(
        series.points
        .map((point) => ({ time: toTime(point.time), value: point.value }))
      );
      if (line) {
        line.setData(points as any);
      }
    }
  }, [plotSeries]);

  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    const nextIds = new Set(resolvedDrawings.map((d) => d.id));

    for (const [id, primitive] of primitiveByIdRef.current.entries()) {
      if (!nextIds.has(id)) {
        try {
          series.detachPrimitive(primitive);
        } catch {
          // no-op
        }
        primitiveByIdRef.current.delete(id);
      }
    }

    for (const drawing of resolvedDrawings) {
      const existing = primitiveByIdRef.current.get(drawing.id);
      if (!existing) {
        const factory = drawingRegistry[drawing.kind];
        const primitive = factory(drawing as any) as any;
        series.attachPrimitive(primitive);
        // Ensure first paint happens immediately even when chart is otherwise idle.
        primitive.setDrawing?.(drawing);
        primitiveByIdRef.current.set(drawing.id, primitive);
      } else {
        existing.setDrawing?.(drawing);
      }
    }
  }, [resolvedDrawings]);

  return (
    <div
      ref={elRef}
      className="chart h-full w-full min-h-0"
      style={{ height: "100%", width: "100%", minHeight: 0 }}
    />
  );
}
