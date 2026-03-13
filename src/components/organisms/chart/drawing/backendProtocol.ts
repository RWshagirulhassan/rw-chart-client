import type { Point, Drawing, MarkerAlignment, MarkerLayout, MarkerShape } from "./types";
import type { FillStyle, LabelSpec, StrokeStyle, TextSize } from "./style";
import { toTime } from "./toTime";

export type ResolveTimeForIndex = (index: number) => unknown | null | undefined;

export type ResolveScriptDrawingResult =
  | { status: "resolved"; drawing: Drawing }
  | { status: "pending"; missingIndexes: number[] }
  | { status: "invalid"; reason: string };

type ParsedPoint = {
  index: number;
  price: number;
};

type ResolvedPoint =
  | { status: "resolved"; point: Point }
  | { status: "pending"; index: number }
  | { status: "invalid"; reason: string };

const LINE_DEFAULT_STROKE: StrokeStyle = {
  color: "rgba(255,255,255,0.9)",
  width: 2,
};

const RECT_DEFAULT_FILL: FillStyle = {
  color: "rgba(0, 122, 255, 0.18)",
};

const RECT_DEFAULT_STROKE: StrokeStyle = {
  color: "rgba(0, 122, 255, 0.85)",
  width: 2,
};

const CIRCLE_DEFAULT_FILL: FillStyle = {
  color: "rgba(0, 122, 255, 0.12)",
};

const CIRCLE_DEFAULT_STROKE: StrokeStyle = {
  color: "rgba(0, 122, 255, 0.85)",
  width: 2,
};

const LABEL_LINE_POS = new Set(["start", "center", "end"]);
const LABEL_ORIENTATION = new Set(["normal", "along"]);
const LABEL_RECT_POS = new Set([
  "topLeft",
  "topCenter",
  "topRight",
  "center",
  "bottomLeft",
  "bottomCenter",
  "bottomRight",
]);
const LABEL_TEXT_SIZE = new Set(["xs", "sm", "base", "md", "lg", "xl", "auto"]);
const MARKER_SHAPES = new Set(["diamond", "triangle", "circle", "cross"]);
const MARKER_LAYOUTS = new Set(["row", "col"]);
const MARKER_ALIGNMENTS = new Set(["start", "center", "end"]);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function asOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value !== "boolean") {
    return undefined;
  }
  return value;
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }
  return value;
}

function parsePoint(source: unknown): ParsedPoint | null {
  const record = asRecord(source);
  if (!record) {
    return null;
  }
  const index = asFiniteNumber(record.index);
  const price = asFiniteNumber(record.price);
  if (index == null || price == null) {
    return null;
  }
  return {
    index: Math.trunc(index),
    price,
  };
}

function resolvePoint(
  point: ParsedPoint,
  resolveTimeForIndex: ResolveTimeForIndex
): ResolvedPoint {
  const resolved = resolveTimeForIndex(point.index);
  if (resolved == null) {
    return { status: "pending", index: point.index };
  }
  return {
    status: "resolved",
    point: {
      time: toTime(resolved),
      price: point.price,
    },
  };
}

function parseStroke(
  value: unknown,
  defaults: StrokeStyle
): StrokeStyle {
  const record = asRecord(value);
  if (!record) {
    return { ...defaults };
  }
  const color = asOptionalString(record.color) ?? defaults.color;
  const width = asFiniteNumber(record.width) ?? defaults.width;
  const dashRaw = Array.isArray(record.dash) ? record.dash : undefined;
  const dash = dashRaw
    ?.map((item) => asFiniteNumber(item))
    .filter((item): item is number => item != null);
  return {
    color,
    width,
    dash: dash && dash.length > 0 ? dash : undefined,
  };
}

function parseFill(value: unknown, defaults: FillStyle): FillStyle {
  const record = asRecord(value);
  if (!record) {
    return { ...defaults };
  }
  const color = asOptionalString(record.color) ?? defaults.color;
  return { color };
}

function parseLabel(value: unknown): LabelSpec | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }
  const text = asOptionalString(record.text);
  if (!text) {
    return undefined;
  }
  const label: LabelSpec = {
    text,
  };

  const visible = asOptionalBoolean(record.visible);
  if (visible !== undefined) {
    label.visible = visible;
  }
  if (LABEL_LINE_POS.has(String(record.linePos))) {
    label.linePos = record.linePos as LabelSpec["linePos"];
  }
  if (LABEL_ORIENTATION.has(String(record.orientation))) {
    label.orientation = record.orientation as LabelSpec["orientation"];
  }
  if (LABEL_RECT_POS.has(String(record.rectPos))) {
    label.rectPos = record.rectPos as LabelSpec["rectPos"];
  }
  if (LABEL_TEXT_SIZE.has(String(record.size))) {
    label.size = record.size as TextSize;
  }
  const bg = asOptionalString(record.bg);
  if (bg) {
    label.bg = bg;
  }
  const fg = asOptionalString(record.fg);
  if (fg) {
    label.fg = fg;
  }
  const paddingX = asFiniteNumber(record.paddingX);
  if (paddingX != null) {
    label.paddingX = paddingX;
  }
  const paddingY = asFiniteNumber(record.paddingY);
  if (paddingY != null) {
    label.paddingY = paddingY;
  }
  const radius = asFiniteNumber(record.radius);
  if (radius != null) {
    label.radius = radius;
  }
  const offsetPx = asFiniteNumber(record.offsetPx);
  if (offsetPx != null) {
    label.offsetPx = offsetPx;
  }
  const offsetPy = asFiniteNumber(record.offsetPy);
  if (offsetPy != null) {
    label.offsetPy = offsetPy;
  }
  return label;
}

function parseCommon(
  source: Record<string, unknown>
): Pick<Drawing, "visible" | "locked" | "z"> {
  const visible = asOptionalBoolean(source.visible);
  const locked = asOptionalBoolean(source.locked);
  const z = source.z === "top" || source.z === "normal" || source.z === "bottom"
    ? source.z
    : undefined;
  return { visible, locked, z };
}

function asCoords(
  value: unknown
): { x: number; y: number } | undefined {
  const record = asRecord(value);
  if (!record) {
    return undefined;
  }
  const x = asFiniteNumber(record.x);
  const y = asFiniteNumber(record.y);
  if (x == null || y == null) {
    return undefined;
  }
  return { x, y };
}

function resolveTwoPoints(
  first: ParsedPoint,
  second: ParsedPoint,
  resolveTimeForIndex: ResolveTimeForIndex
): { p1?: Point; p2?: Point; missingIndexes?: number[]; error?: string } {
  const left = resolvePoint(first, resolveTimeForIndex);
  if (left.status === "invalid") {
    return { error: left.reason };
  }
  const right = resolvePoint(second, resolveTimeForIndex);
  if (right.status === "invalid") {
    return { error: right.reason };
  }
  if (left.status === "pending" || right.status === "pending") {
    const pending = new Set<number>();
    if (left.status === "pending") {
      pending.add(left.index);
    }
    if (right.status === "pending") {
      pending.add(right.index);
    }
    return { missingIndexes: Array.from(pending) };
  }
  return { p1: left.point, p2: right.point };
}

export function resolveScriptPrimitiveDrawing(args: {
  scriptInstanceId: string;
  drawingId: string;
  payload: unknown;
  resolveTimeForIndex: ResolveTimeForIndex;
}): ResolveScriptDrawingResult {
  const payload = asRecord(args.payload);
  if (!payload) {
    return { status: "invalid", reason: "payload must be an object" };
  }
  const kind = asOptionalString(payload.kind);
  if (
    kind !== "line" &&
    kind !== "rect" &&
    kind !== "text" &&
    kind !== "circle" &&
    kind !== "marker"
  ) {
    return { status: "invalid", reason: "unsupported drawing kind" };
  }

  const id = `${args.scriptInstanceId}::${args.drawingId}`;
  const common = parseCommon(payload);

  if (kind === "line") {
    const p1 = parsePoint(payload.p1);
    const p2 = parsePoint(payload.p2);
    if (!p1 || !p2) {
      return { status: "invalid", reason: "line requires p1 and p2" };
    }
    const resolved = resolveTwoPoints(p1, p2, args.resolveTimeForIndex);
    if (resolved.error) {
      return { status: "invalid", reason: resolved.error };
    }
    if (resolved.missingIndexes) {
      return { status: "pending", missingIndexes: resolved.missingIndexes };
    }
    return {
      status: "resolved",
      drawing: {
        id,
        kind: "line",
        p1: resolved.p1!,
        p2: resolved.p2!,
        stroke: parseStroke(payload.stroke, LINE_DEFAULT_STROKE),
        label: parseLabel(payload.label),
        ...common,
      },
    };
  }

  if (kind === "rect") {
    const p1 = parsePoint(payload.p1);
    const p2 = parsePoint(payload.p2);
    if (!p1 || !p2) {
      return { status: "invalid", reason: "rect requires p1 and p2" };
    }
    const resolved = resolveTwoPoints(p1, p2, args.resolveTimeForIndex);
    if (resolved.error) {
      return { status: "invalid", reason: resolved.error };
    }
    if (resolved.missingIndexes) {
      return { status: "pending", missingIndexes: resolved.missingIndexes };
    }
    return {
      status: "resolved",
      drawing: {
        id,
        kind: "rect",
        p1: resolved.p1!,
        p2: resolved.p2!,
        fill: parseFill(payload.fill, RECT_DEFAULT_FILL),
        stroke: parseStroke(payload.stroke, RECT_DEFAULT_STROKE),
        label: parseLabel(payload.label),
        ...common,
      },
    };
  }

  if (kind === "text") {
    const p = parsePoint(payload.p);
    if (!p) {
      return { status: "invalid", reason: "text requires p" };
    }
    const resolved = resolvePoint(p, args.resolveTimeForIndex);
    if (resolved.status === "pending") {
      return { status: "pending", missingIndexes: [resolved.index] };
    }
    if (resolved.status === "invalid") {
      return { status: "invalid", reason: resolved.reason };
    }
    const label = parseLabel(payload.label);
    if (!label) {
      return { status: "invalid", reason: "text requires label.text" };
    }
    return {
      status: "resolved",
      drawing: {
        id,
        kind: "text",
        p: resolved.point,
        label,
        ...common,
      },
    };
  }

  if (kind === "circle") {
    const center = parsePoint(payload.center);
    const edge = parsePoint(payload.edge);
    if (!center || !edge) {
      return { status: "invalid", reason: "circle requires center and edge" };
    }
    const resolved = resolveTwoPoints(center, edge, args.resolveTimeForIndex);
    if (resolved.error) {
      return { status: "invalid", reason: resolved.error };
    }
    if (resolved.missingIndexes) {
      return { status: "pending", missingIndexes: resolved.missingIndexes };
    }
    return {
      status: "resolved",
      drawing: {
        id,
        kind: "circle",
        center: resolved.p1!,
        edge: resolved.p2!,
        fill: parseFill(payload.fill, CIRCLE_DEFAULT_FILL),
        stroke: parseStroke(payload.stroke, CIRCLE_DEFAULT_STROKE),
        label: parseLabel(payload.label),
        ...common,
      },
    };
  }

  const coords = asCoords(payload.coords);
  let point: Point | undefined;
  const pointSource = parsePoint(payload.point);
  if (!coords) {
    if (!pointSource) {
      return {
        status: "invalid",
        reason: "marker requires point (index, price) or coords (x, y)",
      };
    }
    const resolved = resolvePoint(pointSource, args.resolveTimeForIndex);
    if (resolved.status === "pending") {
      return { status: "pending", missingIndexes: [resolved.index] };
    }
    if (resolved.status === "invalid") {
      return { status: "invalid", reason: resolved.reason };
    }
    point = resolved.point;
  }

  const shape = MARKER_SHAPES.has(String(payload.shape))
    ? (payload.shape as MarkerShape)
    : "circle";
  const size = asFiniteNumber(payload.size) ?? 6;
  const opacity = asFiniteNumber(payload.opacity);
  const text = asOptionalString(payload.text);
  const textSize = asFiniteNumber(payload.textSize);
  const layout = MARKER_LAYOUTS.has(String(payload.layout))
    ? (payload.layout as MarkerLayout)
    : "row";
  const alignment = MARKER_ALIGNMENTS.has(String(payload.alignment))
    ? (payload.alignment as MarkerAlignment)
    : "center";
  const offsetRecord = asRecord(payload.offsetPx);
  const offsetPx =
    offsetRecord == null
      ? undefined
      : {
          x: asFiniteNumber(offsetRecord.x ?? undefined) ?? undefined,
          y: asFiniteNumber(offsetRecord.y ?? undefined) ?? undefined,
        };

  return {
    status: "resolved",
    drawing: {
      id,
      kind: "marker",
      point,
      coords,
      offsetPx,
      shape,
      size,
      opacity: opacity ?? 1,
      text,
      textSize: textSize ?? undefined,
      layout,
      alignment,
      ...common,
    },
  };
}
