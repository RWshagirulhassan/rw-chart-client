export type ScriptType = "INDICATOR" | "STRATEGY";

export type ScriptCatalogParam = {
  name: string;
  type: string;
  required: boolean;
  defaultValue: unknown;
  description: string;
  options?: string[];
};

export type ScriptCatalogDetailsItem = {
  scriptId: string;
  name: string;
  kind: ScriptType;
  description: string;
  params: ScriptCatalogParam[];
};

export type ClientScriptLifecycle =
  | "ATTACHING"
  | "LOADING"
  | "SNAPSHOT_READY"
  | "ACKING"
  | "ACTIVE"
  | "DETACHING"
  | "DETACHED"
  | "FAILED";

export type ScriptInstanceView = {
  scriptInstanceId: string;
  scriptId: string;
  scriptName: string;
  kind: ScriptType;
  executionMode: string;
  lifecycle: ClientScriptLifecycle;
  error?: string | null;
  bootstrapJobId?: string | null;
  attachAcceptedAtEpochMs?: number;
  seriesKey: string;
  params: Record<string, unknown>;
  paramsMeta: ScriptCatalogParam[];
};

export type UiAttachScriptResponse = {
  scriptInstanceId: string;
  scriptId: string;
  kind: ScriptType;
  executionMode: string;
  sessionId: string;
  seriesKey: string;
  lifecycleState: string;
  snapshotRequired: boolean;
  attachAcceptedAtEpochMs: number;
  bootstrapJobId: string;
};

export type ScriptSnapshotReadyWsEvent = {
  sessionId: string;
  seriesKey: string;
  scriptInstanceId: string;
  bootstrapJobId: string;
  snapshotCursorSeq: number;
  startedAtEpochMs: number;
  completedAtEpochMs: number;
  status: "READY" | "DEGRADED" | "FAILED";
  error?: string | null;
};

export type UiReplaceScriptResponse = {
  replacedScriptInstanceId: string;
  scriptInstanceId: string;
  scriptId: string;
  kind: ScriptType;
  executionMode: string;
  sessionId: string;
  seriesKey: string;
  lifecycleState: string;
  snapshotRequired: boolean;
  attachAcceptedAtEpochMs: number;
  bootstrapJobId: string;
};

export type UiReplaceScriptRequest = {
  params: Record<string, unknown>;
  executionMode?: string;
};

export type ScriptSnapshotAckResponse = {
  activated: boolean;
  replayedEvents: number;
  fromSeq: number | null;
  toSeq: number | null;
};

export type ScriptDeltaWsEvent = {
  sessionId: string;
  seriesKey: string;
  seq: number;
  eventType: string;
  scriptInstanceId?: string;
  payload?: unknown;
  registryType?: string;
};

export type ScriptPrimitivePointPayload = {
  index?: number;
  price?: number;
};

export type ScriptPrimitiveCoordsPayload = {
  x?: number;
  y?: number;
};

export type ScriptPrimitiveStrokePayload = {
  color?: string;
  width?: number;
  dash?: number[];
};

export type ScriptPrimitiveFillPayload = {
  color?: string;
};

export type ScriptPrimitiveLabelPayload = {
  text?: string;
  visible?: boolean;
  linePos?: "start" | "center" | "end";
  orientation?: "normal" | "along";
  rectPos?:
    | "topLeft"
    | "topCenter"
    | "topRight"
    | "center"
    | "bottomLeft"
    | "bottomCenter"
    | "bottomRight";
  size?: "xs" | "sm" | "base" | "md" | "lg" | "xl" | "auto";
  bg?: string;
  fg?: string;
  paddingX?: number;
  paddingY?: number;
  radius?: number;
  offsetPx?: number;
  offsetPy?: number;
};

export type ScriptPrimitiveDrawingPayload = {
  kind?: "line" | "rect" | "text" | "circle" | "marker";
  visible?: boolean;
  locked?: boolean;
  z?: "top" | "normal" | "bottom";

  p1?: ScriptPrimitivePointPayload;
  p2?: ScriptPrimitivePointPayload;
  p?: ScriptPrimitivePointPayload;
  center?: ScriptPrimitivePointPayload;
  edge?: ScriptPrimitivePointPayload;
  point?: ScriptPrimitivePointPayload;
  coords?: ScriptPrimitiveCoordsPayload;

  fill?: ScriptPrimitiveFillPayload;
  stroke?: ScriptPrimitiveStrokePayload;
  label?: ScriptPrimitiveLabelPayload;

  shape?: "diamond" | "triangle" | "circle" | "cross";
  size?: number;
  opacity?: number;
  text?: string;
  textSize?: number;
  layout?: "row" | "col";
  alignment?: "start" | "center" | "end";
  offsetPx?: { x?: number | null; y?: number | null } | null;
};

export type ScriptDrawingUpsertDeltaPayload = {
  scriptInstanceId?: string;
  drawingId?: string;
  payload?: ScriptPrimitiveDrawingPayload;
};

export type ScriptDrawingRemoveDeltaPayload = {
  scriptInstanceId?: string;
  drawingId?: string;
};

export type ScriptDrawingClearDeltaPayload = {
  scriptInstanceId?: string;
};

export function buildAttachParamsFromCatalog(
  script: ScriptCatalogDetailsItem
): { params: Record<string, unknown>; error: string | null } {
  const params = applyDefaultsToParams({}, script.params ?? []);
  for (const meta of script.params ?? []) {
    const value = params[meta.name];
    if ((value === undefined || value === null) && meta.required) {
      return {
        params: {},
        error: `Cannot attach ${script.name}: required param "${meta.name}" has no default value.`,
      };
    }
  }
  return { params, error: null };
}

export function applyDefaultsToParams(
  current: Record<string, unknown>,
  paramsMeta: ScriptCatalogParam[]
): Record<string, unknown> {
  const next = { ...current };
  for (const meta of paramsMeta ?? []) {
    if (meta.defaultValue !== undefined && meta.defaultValue !== null) {
      next[meta.name] = meta.defaultValue;
    }
  }
  return next;
}

export function normalizeScriptParamsFromDraft(
  paramsMeta: ScriptCatalogParam[],
  draft: Record<string, unknown>
): { params: Record<string, unknown>; error: string | null } {
  const params: Record<string, unknown> = {};

  for (const meta of paramsMeta ?? []) {
    const raw = draft[meta.name];
    if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
      if (meta.required) {
        return {
          params: {},
          error: `Required param "${meta.name}" is missing.`,
        };
      }
      continue;
    }

    const coerced = coerceParamValue(raw, meta.type);
    if (coerced.error) {
      return {
        params: {},
        error: `Invalid value for "${meta.name}": ${coerced.error}`,
      };
    }
    if (meta.options?.length) {
      const textValue = String(coerced.value ?? "");
      if (!meta.options.includes(textValue)) {
        return {
          params: {},
          error: `Invalid value for "${meta.name}": choose one of ${meta.options.join(", ")}`,
        };
      }
    }
    params[meta.name] = coerced.value;
  }

  return { params, error: null };
}

function coerceParamValue(
  raw: unknown,
  type: string
): { value: unknown; error: string | null } {
  const normalizedType = (type ?? "").trim().toLowerCase();
  if (normalizedType === "integer") {
    const num = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(num) || !Number.isInteger(num)) {
      return { value: null, error: "must be an integer" };
    }
    return { value: num, error: null };
  }
  if (normalizedType === "number") {
    const num = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(num)) {
      return { value: null, error: "must be a number" };
    }
    return { value: num, error: null };
  }
  if (normalizedType === "boolean") {
    if (typeof raw === "boolean") {
      return { value: raw, error: null };
    }
    const value = String(raw).trim().toLowerCase();
    if (value === "true") {
      return { value: true, error: null };
    }
    if (value === "false") {
      return { value: false, error: null };
    }
    return { value: null, error: "must be true or false" };
  }
  return { value: String(raw), error: null };
}
