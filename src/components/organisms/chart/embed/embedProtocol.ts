import type { Drawing } from "@/components/organisms/chart/model/chartTypes";

export const EMBED_CHANNEL = "RW_CHART_EMBED_V1" as const;
export const EMBED_SCOPE = "manual:embed" as const;

export type EmbedInboundType =
  | "DRAWINGS_SET"
  | "DRAWING_UPSERT"
  | "DRAWING_REMOVE"
  | "DRAWINGS_CLEAR";

export type EmbedOutboundType = "READY" | "APPLIED" | "ERROR";

export type EmbedInboundEnvelope = {
  channel: typeof EMBED_CHANNEL;
  type: EmbedInboundType;
  requestId?: string;
  payload: unknown;
};

export type EmbedOutboundEnvelope = {
  channel: typeof EMBED_CHANNEL;
  type: EmbedOutboundType;
  requestId?: string;
  payload: unknown;
};

export type DrawingsSetPayload = {
  drawings: Drawing[];
};

export type DrawingUpsertPayload = {
  drawing: Drawing;
};

export type DrawingRemovePayload = {
  drawingId: string;
};

export type EmbedErrorCode =
  | "INVALID_ENVELOPE"
  | "INVALID_TYPE"
  | "INVALID_PAYLOAD"
  | "INTERNAL_ERROR";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "string" && String(value[key]).trim() !== "";
}

export function parseInboundEnvelope(raw: unknown): EmbedInboundEnvelope | null {
  if (!isObject(raw)) {
    return null;
  }
  if (raw.channel !== EMBED_CHANNEL) {
    return null;
  }
  if (typeof raw.type !== "string") {
    return null;
  }
  if (!("payload" in raw)) {
    return null;
  }
  const type = raw.type as EmbedInboundType;
  if (
    type !== "DRAWINGS_SET" &&
    type !== "DRAWING_UPSERT" &&
    type !== "DRAWING_REMOVE" &&
    type !== "DRAWINGS_CLEAR"
  ) {
    return null;
  }
  return {
    channel: EMBED_CHANNEL,
    type,
    requestId: typeof raw.requestId === "string" ? raw.requestId : undefined,
    payload: raw.payload,
  };
}

export function parseDrawingsSetPayload(raw: unknown): DrawingsSetPayload | null {
  if (!isObject(raw) || !Array.isArray(raw.drawings)) {
    return null;
  }
  return { drawings: raw.drawings as Drawing[] };
}

export function parseDrawingUpsertPayload(raw: unknown): DrawingUpsertPayload | null {
  if (!isObject(raw) || !isObject(raw.drawing)) {
    return null;
  }
  const drawing = raw.drawing as Drawing;
  if (!hasString(drawing as unknown as Record<string, unknown>, "id")) {
    return null;
  }
  if (!hasString(drawing as unknown as Record<string, unknown>, "kind")) {
    return null;
  }
  return { drawing };
}

export function parseDrawingRemovePayload(raw: unknown): DrawingRemovePayload | null {
  if (!isObject(raw) || !hasString(raw, "drawingId")) {
    return null;
  }
  return { drawingId: String(raw.drawingId) };
}

export function makeReadyEnvelope(seriesKey: string): EmbedOutboundEnvelope {
  return {
    channel: EMBED_CHANNEL,
    type: "READY",
    payload: {
      seriesKey,
      capabilities: [
        "DRAWINGS_SET",
        "DRAWING_UPSERT",
        "DRAWING_REMOVE",
        "DRAWINGS_CLEAR",
      ],
    },
  };
}

export function makeAppliedEnvelope(
  op: EmbedInboundType,
  requestId?: string,
  extra?: Record<string, unknown>,
): EmbedOutboundEnvelope {
  return {
    channel: EMBED_CHANNEL,
    type: "APPLIED",
    requestId,
    payload: {
      op,
      ...(extra ?? {}),
    },
  };
}

export function makeErrorEnvelope(
  code: EmbedErrorCode,
  message: string,
  requestId?: string,
): EmbedOutboundEnvelope {
  return {
    channel: EMBED_CHANNEL,
    type: "ERROR",
    requestId,
    payload: {
      code,
      message,
    },
  };
}
