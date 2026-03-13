import type { Time } from "lightweight-charts";
import type { FillStyle, LabelSpec, StrokeStyle } from "./style";

export type Candle = {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
};

export type Point = {
  time: Time;
  price: number;
};

export type DrawingBase = {
  id: string;
  visible?: boolean;
  locked?: boolean;
  z?: "top" | "normal" | "bottom";
};

export type LineDrawing = DrawingBase & {
  kind: "line";
  p1: Point;
  p2: Point;
  stroke: StrokeStyle;
  label?: LabelSpec;
};

export type RectDrawing = DrawingBase & {
  kind: "rect";
  p1: Point; // corner 1
  p2: Point; // corner 2
  fill: FillStyle;
  stroke: StrokeStyle;
  label?: LabelSpec;
};

export type TextDrawing = DrawingBase & {
  kind: "text";
  p: Point;
  label: LabelSpec; // required
};

export type CircleDrawing = DrawingBase & {
  kind: "circle";
  center: Point;
  edge: Point; // defines radius
  fill: FillStyle;
  stroke: StrokeStyle;
  label?: LabelSpec;
};

export type MarkerShape = "diamond" | "triangle" | "circle" | "cross";
export type MarkerLayout = "row" | "col";
export type MarkerAlignment = "start" | "center" | "end";
export type MarkerCoords = { x: number; y: number };

export type MarkerDrawing = DrawingBase & {
  kind: "marker";
  point?: Point;
  coords?: MarkerCoords;
  offsetPx?: { x?: number | null; y?: number | null } | null;
  shape: MarkerShape;
  size: number;
  opacity?: number;
  text?: string;
  textSize?: number;
  layout?: MarkerLayout;
  alignment?: MarkerAlignment;
};

export type Drawing =
  | LineDrawing
  | RectDrawing
  | TextDrawing
  | CircleDrawing
  | MarkerDrawing;
export type DrawingKind = Drawing["kind"];
