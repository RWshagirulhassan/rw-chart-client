import type { BusinessDay, Time } from "lightweight-charts";
import type {
  CircleDrawing,
  Drawing,
  LineDrawing,
  MarkerDrawing,
  Point,
  RectDrawing,
  TextDrawing,
} from "./types";
import {
  toChartTimeFromEpochMsInExchangeTz,
  toChartTimeFromIsoInExchangeTz,
} from "../timezone/exchangeTime";

type IndexedCandleTime = {
  time: Time;
  sortKey: number;
  dayKey: number;
};

type DayBounds = {
  first: Time;
  last: Time;
};

export type CandleTimeIndex = {
  timeframe: string;
  higherTimeframe: boolean;
  ordered: IndexedCandleTime[];
  orderedDays: IndexedCandleTime[];
  bySortKey: Map<number, Time>;
  dayBoundsByKey: Map<number, DayBounds>;
};

type AnchorBoundary = "start" | "end";

function isBusinessDayLike(value: unknown): value is BusinessDay {
  return (
    value != null &&
    typeof value === "object" &&
    typeof (value as { year?: unknown }).year === "number" &&
    typeof (value as { month?: unknown }).month === "number" &&
    typeof (value as { day?: unknown }).day === "number"
  );
}

function isHigherTimeframe(timeframe: string): boolean {
  return /^\d+[DWM]$/i.test(timeframe.trim());
}

function dayKeyFromBusinessDay(value: BusinessDay): number {
  return value.year * 10000 + value.month * 100 + value.day;
}

function dayKeyFromChartTimestamp(timestamp: number): number {
  const date = new Date(timestamp * 1000);
  return (
    date.getUTCFullYear() * 10000 +
    (date.getUTCMonth() + 1) * 100 +
    date.getUTCDate()
  );
}

function dayKeyFromDateString(value: string): number | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  return year * 10000 + month * 100 + day;
}

function dayKeyFromTime(time: Time): number {
  if (typeof time === "number") {
    return dayKeyFromChartTimestamp(time);
  }
  if (isBusinessDayLike(time)) {
    return dayKeyFromBusinessDay(time);
  }
  const parsed = dayKeyFromDateString(String(time));
  return parsed ?? 0;
}

export function timeSortKey(time: Time): number {
  if (typeof time === "number") {
    return time;
  }
  if (isBusinessDayLike(time)) {
    return Math.floor(Date.UTC(time.year, time.month - 1, time.day) / 1000);
  }
  return 0;
}

function lowerBound<T>(
  items: T[],
  target: number,
  getKey: (item: T) => number,
): number {
  let low = 0;
  let high = items.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (getKey(items[mid]) < target) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function findNextOrPreviousBySortKey(
  ordered: IndexedCandleTime[],
  sortKey: number,
): Time | null {
  if (ordered.length === 0) {
    return null;
  }
  const nextIndex = lowerBound(ordered, sortKey, (item) => item.sortKey);
  if (nextIndex < ordered.length) {
    return ordered[nextIndex].time;
  }
  return ordered[ordered.length - 1].time;
}

function findNextOrPreviousByDayKey(
  orderedDays: IndexedCandleTime[],
  dayKey: number,
): Time | null {
  if (orderedDays.length === 0) {
    return null;
  }
  const nextIndex = lowerBound(orderedDays, dayKey, (item) => item.dayKey);
  if (nextIndex < orderedDays.length) {
    return orderedDays[nextIndex].time;
  }
  return orderedDays[orderedDays.length - 1].time;
}

function resolveDateBasedTime(
  dayKey: number,
  index: CandleTimeIndex,
  boundary: AnchorBoundary,
): Time | null {
  const dayBounds = index.dayBoundsByKey.get(dayKey);
  if (dayBounds) {
    return boundary === "end" ? dayBounds.last : dayBounds.first;
  }
  if (index.ordered.length === 0 || index.orderedDays.length === 0) {
    return null;
  }
  const firstLoadedDayKey = index.orderedDays[0].dayKey;
  if (dayKey < firstLoadedDayKey) {
    return index.ordered[0].time;
  }
  const lastLoadedDayKey = index.orderedDays[index.orderedDays.length - 1].dayKey;
  if (dayKey > lastLoadedDayKey) {
    return index.ordered[index.ordered.length - 1].time;
  }
  return findNextOrPreviousByDayKey(index.orderedDays, dayKey);
}

function resolveMomentBasedTime(
  sortKey: number,
  dayKey: number,
  index: CandleTimeIndex,
): Time | null {
  if (index.higherTimeframe) {
    return resolveDateBasedTime(dayKey, index, "start");
  }
  return (
    index.bySortKey.get(sortKey) ??
    findNextOrPreviousBySortKey(index.ordered, sortKey)
  );
}

function resolveNumericTime(
  value: number,
  index: CandleTimeIndex,
  boundary: AnchorBoundary,
): Time | null {
  const normalized = value > 1e12 ? Math.floor(value / 1000) : Math.floor(value);
  const exactNative = index.bySortKey.get(normalized);
  if (exactNative) {
    return exactNative;
  }

  const epochMs = value > 1e12 ? value : value * 1000;
  const chartTime = toChartTimeFromEpochMsInExchangeTz(
    epochMs,
    index.timeframe,
    "IST",
  );
  if (typeof chartTime === "number") {
    return resolveMomentBasedTime(
      chartTime,
      dayKeyFromChartTimestamp(chartTime),
      index,
    );
  }
  if (isBusinessDayLike(chartTime)) {
    return resolveDateBasedTime(
      dayKeyFromBusinessDay(chartTime),
      index,
      boundary,
    );
  }
  return null;
}

function resolveStringTime(
  value: string,
  index: CandleTimeIndex,
  boundary: AnchorBoundary,
): Time | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dateOnlyKey = dayKeyFromDateString(trimmed);
  if (dateOnlyKey != null) {
    return resolveDateBasedTime(dateOnlyKey, index, boundary);
  }

  if (!trimmed.includes("T") && !trimmed.includes(":")) {
    return null;
  }

  const chartTime = toChartTimeFromIsoInExchangeTz(
    trimmed,
    index.timeframe,
    "IST",
  );
  if (typeof chartTime === "number") {
    return resolveMomentBasedTime(
      chartTime,
      dayKeyFromChartTimestamp(chartTime),
      index,
    );
  }
  if (isBusinessDayLike(chartTime)) {
    return resolveDateBasedTime(
      dayKeyFromBusinessDay(chartTime),
      index,
      boundary,
    );
  }
  return null;
}

function resolveTimeAnchor(
  rawTime: unknown,
  index: CandleTimeIndex,
  boundary: AnchorBoundary,
): Time | null {
  if (index.ordered.length === 0) {
    return null;
  }
  if (typeof rawTime === "number") {
    return resolveNumericTime(rawTime, index, boundary);
  }
  if (typeof rawTime === "string") {
    return resolveStringTime(rawTime, index, boundary);
  }
  if (isBusinessDayLike(rawTime)) {
    return resolveDateBasedTime(
      dayKeyFromBusinessDay(rawTime),
      index,
      boundary,
    );
  }
  return null;
}

function isSameNativeTime(rawTime: unknown, resolvedTime: Time): boolean {
  if (typeof rawTime === "number" && typeof resolvedTime === "number") {
    return Math.floor(rawTime) === resolvedTime;
  }
  if (isBusinessDayLike(rawTime) && isBusinessDayLike(resolvedTime)) {
    return dayKeyFromBusinessDay(rawTime) === dayKeyFromBusinessDay(resolvedTime);
  }
  return false;
}

function resolvePointTime(
  point: Point,
  index: CandleTimeIndex,
  boundary: AnchorBoundary,
): Point {
  const resolvedTime = resolveTimeAnchor(point.time as unknown, index, boundary);
  if (!resolvedTime || isSameNativeTime(point.time as unknown, resolvedTime)) {
    return point;
  }
  return {
    ...point,
    time: resolvedTime,
  };
}

function resolveLineDrawing(drawing: LineDrawing, index: CandleTimeIndex): LineDrawing {
  const p1 = resolvePointTime(drawing.p1, index, "start");
  const p2 = resolvePointTime(drawing.p2, index, "end");
  if (p1 === drawing.p1 && p2 === drawing.p2) {
    return drawing;
  }
  return {
    ...drawing,
    p1,
    p2,
  };
}

function resolveRectDrawing(drawing: RectDrawing, index: CandleTimeIndex): RectDrawing {
  const p1 = resolvePointTime(drawing.p1, index, "start");
  const p2 = resolvePointTime(drawing.p2, index, "end");
  if (p1 === drawing.p1 && p2 === drawing.p2) {
    return drawing;
  }
  return {
    ...drawing,
    p1,
    p2,
  };
}

function resolveCircleDrawing(
  drawing: CircleDrawing,
  index: CandleTimeIndex,
): CircleDrawing {
  const center = resolvePointTime(drawing.center, index, "start");
  const edge = resolvePointTime(drawing.edge, index, "end");
  if (center === drawing.center && edge === drawing.edge) {
    return drawing;
  }
  return {
    ...drawing,
    center,
    edge,
  };
}

function resolveTextDrawing(drawing: TextDrawing, index: CandleTimeIndex): TextDrawing {
  const p = resolvePointTime(drawing.p, index, "start");
  if (p === drawing.p) {
    return drawing;
  }
  return {
    ...drawing,
    p,
  };
}

function resolveMarkerDrawing(
  drawing: MarkerDrawing,
  index: CandleTimeIndex,
): MarkerDrawing {
  if (!drawing.point) {
    return drawing;
  }
  const point = resolvePointTime(drawing.point, index, "start");
  if (point === drawing.point) {
    return drawing;
  }
  return {
    ...drawing,
    point,
  };
}

export function buildCandleTimeIndex(
  candles: Array<{ time: Time }>,
  timeframe: string,
): CandleTimeIndex {
  const ordered = candles
    .map(({ time }) => ({
      time,
      sortKey: timeSortKey(time),
      dayKey: dayKeyFromTime(time),
    }))
    .sort((a, b) => a.sortKey - b.sortKey);

  const bySortKey = new Map<number, Time>();
  const dayBoundsByKey = new Map<number, DayBounds>();
  const orderedDays: IndexedCandleTime[] = [];

  for (const candle of ordered) {
    bySortKey.set(candle.sortKey, candle.time);
    const dayBounds = dayBoundsByKey.get(candle.dayKey);
    if (!dayBounds) {
      dayBoundsByKey.set(candle.dayKey, {
        first: candle.time,
        last: candle.time,
      });
      orderedDays.push(candle);
      continue;
    }
    dayBounds.last = candle.time;
  }

  return {
    timeframe,
    higherTimeframe: isHigherTimeframe(timeframe),
    ordered,
    orderedDays,
    bySortKey,
    dayBoundsByKey,
  };
}

export function resolveDrawingTimeAnchors<T extends Drawing>(
  drawing: T,
  index: CandleTimeIndex,
): T {
  switch (drawing.kind) {
    case "line":
      return resolveLineDrawing(drawing, index) as T;
    case "rect":
      return resolveRectDrawing(drawing, index) as T;
    case "circle":
      return resolveCircleDrawing(drawing, index) as T;
    case "text":
      return resolveTextDrawing(drawing, index) as T;
    case "marker":
      return resolveMarkerDrawing(drawing, index) as T;
    default:
      return drawing;
  }
}
