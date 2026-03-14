import type { ChartCandle } from "@/components/organisms/chart/model/chartTypes";
import type {
  ScriptCatalogDetailsItem,
  ScriptInstanceView,
  ScriptPrimitiveDrawingPayload,
} from "@/components/organisms/trading/scriptAttachUtils";

export type SessionCreateResponse = {
  sessionId: string;
};

export type SnapshotBar = {
  beginTime: string;
  endTime?: string;
  barIndex?: number;
  mutation?: "APPEND" | "REPLACE" | "SNAPSHOT";
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
};

export type SeriesSnapshotResponse = {
  seriesKey: string;
  lastSeq: number;
  snapshotCursor?: number;
  bars: SnapshotBar[];
};

export type CandleAppendedPayload = {
  sessionId?: string;
  seriesKey?: string;
  seq?: number;
  bar?: SnapshotBar;
  meta?: {
    beginIndex?: number;
    endIndex?: number;
    maxBarCount?: number;
  };
};

export type BootstrapEventPayload = {
  sessionId?: string;
  seriesKey?: string;
  status?: string;
};

export type WsEnvelope = {
  type: string;
  ts?: number;
  data?: unknown;
};

export type ScriptPlotPointPayload = {
  index?: number;
  value?: number;
  close?: number;
};

export type ScriptPlotEventPayload = {
  scriptInstanceId?: string;
  plotId?: string;
  payload?: ScriptPlotPointPayload;
};

export type PendingPlotEvent = {
  scriptInstanceId: string;
  plotId: string;
  barIndex: number;
  value: number;
};

export type PendingDrawingUpsert = {
  scriptInstanceId: string;
  drawingId: string;
  payload: ScriptPrimitiveDrawingPayload;
};

export type ScriptAlertPayload = {
  messageType?: string;
  scriptId?: string;
  scriptInstanceId?: string;
  instrumentToken?: number | string;
  condition?: string;
  triggerMode?: string;
  targetClosePrice?: number;
  closePrice?: number;
  barIndex?: number;
  barTime?: string;
  expired?: boolean;
  text?: string;
};

export type ScriptAlertEventPayload = {
  scriptInstanceId?: string;
  payload?: ScriptAlertPayload;
};

export type ScriptBridgeActions = {
  attachScriptFromCatalog: (script: ScriptCatalogDetailsItem) => void;
  detachScriptInstance: (scriptInstanceId: string) => void;
  replaceScriptInstance: (
    scriptInstanceId: string,
    params: Record<string, unknown>,
  ) => Promise<void>;
};

export type BufferedCandleEvent = {
  seq: number;
  ts: number;
  bar: SnapshotBar;
  meta?: {
    beginIndex?: number;
    endIndex?: number;
    maxBarCount?: number;
  };
};

export type UseChartSeriesRuntimeArgs = {
  seriesKey?: string | null;
  instrumentToken?: string;
  timeframe: string;
  scriptsEnabled: boolean;
  onStatus?: (status: string) => void;
  onWsState?: (state: string) => void;
  onHeartbeat?: (state: string) => void;
  onTick?: (price: string, at: string) => void;
  onLiveCandle?: (candle: ChartCandle | null) => void;
  onScriptAlert?: (message: string) => void;
  onScriptActionsReady?: (actions: ScriptBridgeActions) => void;
  onScriptInstancesChange?: (items: ScriptInstanceView[]) => void;
  onScriptActionError?: (error: string | null) => void;
};

export type WsHandlers = {
  onOpen: () => void;
  onClose: () => void;
  onError: () => void;
  onMessage: (message: WsEnvelope) => void;
};
