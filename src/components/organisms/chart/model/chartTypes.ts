import type { BusinessDay } from "lightweight-charts";
import type { Drawing as PrimitiveDrawing } from "../drawing/types";

export type ChartTime = string | number | BusinessDay;

export type ChartCandle = {
  time: ChartTime;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type PlotPoint = {
  time: ChartTime;
  value: number;
};

export type PlotSeriesStyle = {
  color?: string;
  lineWidth?: number;
};

export type PlotSeries = {
  id: string;
  points: PlotPoint[];
  style?: PlotSeriesStyle;
};

export type Drawing = PrimitiveDrawing;
export type DrawingScopeKey = `script:${string}` | `manual:${string}`;
export type ScopedDrawingState = Record<DrawingScopeKey, Record<string, Drawing>>;

export type ChartState = {
  candles: ChartCandle[];
  plotSeriesById: Record<string, PlotSeries>;
  drawingsByScope: ScopedDrawingState;
};
