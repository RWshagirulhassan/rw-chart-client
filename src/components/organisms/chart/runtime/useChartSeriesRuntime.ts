"use client";

import * as React from "react";
import { buildSeriesKey } from "@/app/chart/intervalKindMap";
import { resolveScriptPrimitiveDrawing } from "@/components/organisms/chart/drawing/backendProtocol";
import { scriptScope, useChartActions } from "@/components/organisms/chart/context/chartStore";
import type { ChartCandle } from "@/components/organisms/chart/model/chartTypes";
import { toChartTimeFromIsoInExchangeTz } from "@/components/organisms/chart/timezone/exchangeTime";
import {
  buildAttachParamsFromCatalog,
  type ScriptCatalogDetailsItem,
  type ScriptDrawingClearDeltaPayload,
  type ScriptDrawingRemoveDeltaPayload,
  type ScriptDrawingUpsertDeltaPayload,
  type ScriptDeltaWsEvent,
  type ScriptInstanceView,
  type ScriptPrimitiveDrawingPayload,
  type ScriptSnapshotAckResponse,
  type ScriptSnapshotReadyWsEvent,
  type UiAttachScriptResponse,
  type UiReplaceScriptResponse,
} from "@/components/organisms/trading/scriptAttachUtils";
import { backendFetch } from "@/lib/runtimeConfig";
import {
  defaultEngineSessionTransport,
  type EngineSessionTransport,
} from "./engineSessionTransport";
import type {
  BootstrapEventPayload,
  BufferedCandleEvent,
  CandleAppendedPayload,
  PendingDrawingUpsert,
  PendingPlotEvent,
  ScriptAlertEventPayload,
  ScriptAlertPayload,
  ScriptBridgeActions,
  ScriptPlotEventPayload,
  SeriesSnapshotResponse,
  SnapshotBar,
  UseChartSeriesRuntimeArgs,
  WsEnvelope,
} from "./runtimeTypes";

export type UseChartSeriesRuntimeOptions = UseChartSeriesRuntimeArgs & {
  transport?: EngineSessionTransport;
};

function parseNumber(input: string): number {
  const value = Number(input);
  return Number.isFinite(value) ? value : 0;
}

function toChartCandle(
  bar: SnapshotBar,
  timeframe: string,
): ChartCandle | null {
  if (!bar?.beginTime) {
    return null;
  }
  const chartTime = toChartTimeFromIsoInExchangeTz(
    bar.beginTime,
    timeframe,
    "IST",
  );
  if (chartTime == null) {
    return null;
  }
  return {
    time: chartTime,
    open: parseNumber(bar.open),
    high: parseNumber(bar.high),
    low: parseNumber(bar.low),
    close: parseNumber(bar.close),
    volume: parseNumber(bar.volume),
  };
}

function resolveBarIndex(bar: SnapshotBar): number | null {
  if (typeof bar.barIndex === "number" && Number.isFinite(bar.barIndex)) {
    return bar.barIndex;
  }
  const epochMs = Date.parse(bar.beginTime ?? "");
  if (!Number.isFinite(epochMs)) {
    return null;
  }
  return Math.floor(epochMs / 1000);
}

function isHigherTimeframe(timeframe: string): boolean {
  return /^\d+[DWM]$/i.test(timeframe.trim());
}

function keyFromChartCandleTime(time: ChartCandle["time"]): number | null {
  if (typeof time === "number" && Number.isFinite(time)) {
    return Math.floor(time);
  }
  if (
    time &&
    typeof time === "object" &&
    typeof (time as any).year === "number" &&
    typeof (time as any).month === "number" &&
    typeof (time as any).day === "number"
  ) {
    const year = (time as any).year as number;
    const month = (time as any).month as number;
    const day = (time as any).day as number;
    return year * 10000 + month * 100 + day;
  }
  return null;
}

function normalizeConditionLabel(condition: string | undefined): string {
  switch ((condition ?? "").trim().toLowerCase()) {
    case "crossing_up":
      return "crossed up";
    case "crossing_down":
      return "crossed down";
    default:
      return "crossed";
  }
}

function formatAlertMessage(payload: ScriptAlertPayload, timeframe: string): string {
  const condition = normalizeConditionLabel(payload.condition);
  const target = Number(payload.targetClosePrice);
  const close = Number(payload.closePrice);
  if (Number.isFinite(target) && Number.isFinite(close)) {
    return `Close Alert Triggered: CLOSE ${condition} ${target.toFixed(
      2,
    )} (current ${close.toFixed(2)}) on ${timeframe}`;
  }
  if (typeof payload.text === "string" && payload.text.trim() !== "") {
    return payload.text;
  }
  return "Close Alert Triggered";
}

const NOOP_SCRIPT_ACTIONS: ScriptBridgeActions = {
  attachScriptFromCatalog: () => {},
  detachScriptInstance: () => {},
  replaceScriptInstance: async () => {},
};

export function useChartSeriesRuntime(args: UseChartSeriesRuntimeOptions) {
  const {
    seriesKey: seriesKeyArg,
    instrumentToken,
    timeframe,
    scriptsEnabled,
    onStatus,
    onWsState,
    onHeartbeat,
    onTick,
    onLiveCandle,
    onScriptAlert,
    onScriptActionsReady,
    onScriptInstancesChange,
    onScriptActionError,
    transport = defaultEngineSessionTransport,
  } = args;

  const {
    setCandles,
    clearCandles,
    addPlotSeries,
    setPlotPoint,
    setPlotPoints,
    removePlotSeries,
    upsertScopeDrawing,
    removeScopeDrawing,
    clearScopeDrawings,
  } = useChartActions();

  const onStatusRef = React.useRef(onStatus ?? (() => {}));
  const onWsStateRef = React.useRef(onWsState ?? (() => {}));
  const onHeartbeatRef = React.useRef(onHeartbeat ?? (() => {}));
  const onTickRef = React.useRef(onTick ?? (() => {}));
  const onLiveCandleRef = React.useRef(onLiveCandle ?? (() => {}));
  const onScriptAlertRef = React.useRef(onScriptAlert ?? (() => {}));
  const onScriptActionsReadyRef = React.useRef(
    onScriptActionsReady ?? (() => {}),
  );
  const onScriptInstancesChangeRef = React.useRef(
    onScriptInstancesChange ?? (() => {}),
  );
  const onScriptActionErrorRef = React.useRef(onScriptActionError ?? (() => {}));
  const setCandlesRef = React.useRef(setCandles);
  const clearCandlesRef = React.useRef(clearCandles);
  const addPlotSeriesRef = React.useRef(addPlotSeries);
  const setPlotPointRef = React.useRef(setPlotPoint);
  const setPlotPointsRef = React.useRef(setPlotPoints);
  const removePlotSeriesRef = React.useRef(removePlotSeries);
  const upsertScopeDrawingRef = React.useRef(upsertScopeDrawing);
  const removeScopeDrawingRef = React.useRef(removeScopeDrawing);
  const clearScopeDrawingsRef = React.useRef(clearScopeDrawings);

  React.useEffect(() => {
    onStatusRef.current = onStatus ?? (() => {});
  }, [onStatus]);
  React.useEffect(() => {
    onWsStateRef.current = onWsState ?? (() => {});
  }, [onWsState]);
  React.useEffect(() => {
    onHeartbeatRef.current = onHeartbeat ?? (() => {});
  }, [onHeartbeat]);
  React.useEffect(() => {
    onTickRef.current = onTick ?? (() => {});
  }, [onTick]);
  React.useEffect(() => {
    onLiveCandleRef.current = onLiveCandle ?? (() => {});
  }, [onLiveCandle]);
  React.useEffect(() => {
    onScriptAlertRef.current = onScriptAlert ?? (() => {});
  }, [onScriptAlert]);
  React.useEffect(() => {
    onScriptActionsReadyRef.current = onScriptActionsReady ?? (() => {});
  }, [onScriptActionsReady]);
  React.useEffect(() => {
    onScriptInstancesChangeRef.current = onScriptInstancesChange ?? (() => {});
  }, [onScriptInstancesChange]);
  React.useEffect(() => {
    onScriptActionErrorRef.current = onScriptActionError ?? (() => {});
  }, [onScriptActionError]);
  React.useEffect(() => {
    setCandlesRef.current = setCandles;
  }, [setCandles]);
  React.useEffect(() => {
    clearCandlesRef.current = clearCandles;
  }, [clearCandles]);
  React.useEffect(() => {
    addPlotSeriesRef.current = addPlotSeries;
  }, [addPlotSeries]);
  React.useEffect(() => {
    setPlotPointRef.current = setPlotPoint;
  }, [setPlotPoint]);
  React.useEffect(() => {
    setPlotPointsRef.current = setPlotPoints;
  }, [setPlotPoints]);
  React.useEffect(() => {
    removePlotSeriesRef.current = removePlotSeries;
  }, [removePlotSeries]);
  React.useEffect(() => {
    upsertScopeDrawingRef.current = upsertScopeDrawing;
  }, [upsertScopeDrawing]);
  React.useEffect(() => {
    removeScopeDrawingRef.current = removeScopeDrawing;
  }, [removeScopeDrawing]);
  React.useEffect(() => {
    clearScopeDrawingsRef.current = clearScopeDrawings;
  }, [clearScopeDrawings]);

  React.useEffect(() => {
    let active = true;
    let wsConnection: { close: () => void } | null = null;
    let fallbackPollTimer: number | null = null;
    let createdSessionId: string | null = null;
    let sessionDestroyed = false;
    let snapshotRequested = false;
    let snapshotLoaded = false;
    let snapshotCursor = -1;
    let terminalStatus: "COMPLETED" | "DEGRADED" | null = null;
    let wsConnected = false;
    let lastWsMessageAt = 0;
    let heartbeatTimer: number | null = null;
    let statusValue = "IDLE";

    const buffered: BufferedCandleEvent[] = [];
    const byIndex = new Map<number, ChartCandle>();
    const candleTimeByBarIndex = new Map<number, ChartCandle["time"]>();
    const scriptsByInstanceId = new Map<string, ScriptInstanceView>();
    const managedPlotSeriesIdsByInstanceId = new Map<string, Set<string>>();
    const managedDrawingIdsByInstanceId = new Map<string, Set<string>>();
    const pendingPlotEventsByBarIndex = new Map<number, PendingPlotEvent[]>();
    const pendingDrawingUpsertsById = new Map<string, PendingDrawingUpsert>();
    const seenScriptDeltaSeq = new Set<number>();
    const snapshotHandshakeInFlight = new Set<string>();
    const pendingSnapshotReadyByInstanceId = new Map<
      string,
      ScriptSnapshotReadyWsEvent
    >();

    const seriesKey =
      seriesKeyArg ??
      (instrumentToken ? buildSeriesKey(instrumentToken, timeframe) : null);
    onScriptActionsReadyRef.current(NOOP_SCRIPT_ACTIONS);
    onScriptInstancesChangeRef.current([]);
    onScriptActionErrorRef.current(null);

    if (!seriesKey) {
      onStatusRef.current(`ERROR: unsupported timeframe ${timeframe}`);
      return () => {};
    }

    const setStatus = (next: string) => {
      statusValue = next;
      onStatusRef.current(next);
    };

    const scriptTrace = (event: string, payload?: Record<string, unknown>) => {
      console.debug("[script-attach-debug]", {
        event,
        sessionId: createdSessionId,
        seriesKey,
        status: statusValue,
        wsConnected,
        snapshotLoaded,
        ...(payload ?? {}),
      });
    };

    const emitScriptInstances = () => {
      const next = Array.from(scriptsByInstanceId.values()).sort((a, b) => {
        const left = a.attachAcceptedAtEpochMs ?? 0;
        const right = b.attachAcceptedAtEpochMs ?? 0;
        if (left !== right) {
          return right - left;
        }
        return a.scriptInstanceId.localeCompare(b.scriptInstanceId);
      });
      onScriptInstancesChangeRef.current(next);
    };

    const setScriptActionError = (message: string | null) => {
      onScriptActionErrorRef.current(message);
    };

    const upsertScriptInstance = (item: ScriptInstanceView) => {
      scriptsByInstanceId.set(item.scriptInstanceId, item);
      emitScriptInstances();
    };

    const patchScriptInstance = (
      scriptInstanceId: string,
      patch: Partial<ScriptInstanceView>,
    ) => {
      const current = scriptsByInstanceId.get(scriptInstanceId);
      if (!current) {
        return;
      }
      scriptsByInstanceId.set(scriptInstanceId, { ...current, ...patch });
      emitScriptInstances();
    };

    const removeScriptInstance = (scriptInstanceId: string) => {
      if (!scriptsByInstanceId.delete(scriptInstanceId)) {
        return;
      }
      pendingSnapshotReadyByInstanceId.delete(scriptInstanceId);
      snapshotHandshakeInFlight.delete(scriptInstanceId);
      removeManagedPlotSeriesForScript(scriptInstanceId);
      removeManagedDrawingsForScript(scriptInstanceId);
      emitScriptInstances();
    };

    const removeManagedPlotSeriesForScript = (scriptInstanceId: string) => {
      const seriesIds = managedPlotSeriesIdsByInstanceId.get(scriptInstanceId);
      if (!seriesIds) {
        return;
      }
      for (const seriesId of seriesIds) {
        removePlotSeriesRef.current(seriesId);
      }
      managedPlotSeriesIdsByInstanceId.delete(scriptInstanceId);
    };

    const removeAllManagedPlotSeries = () => {
      for (const seriesIds of managedPlotSeriesIdsByInstanceId.values()) {
        for (const seriesId of seriesIds) {
          removePlotSeriesRef.current(seriesId);
        }
      }
      managedPlotSeriesIdsByInstanceId.clear();
    };

    const trackManagedPlotSeries = (
      scriptInstanceId: string,
      seriesId: string,
    ) => {
      const seriesIds =
        managedPlotSeriesIdsByInstanceId.get(scriptInstanceId) ??
        new Set<string>();
      seriesIds.add(seriesId);
      managedPlotSeriesIdsByInstanceId.set(scriptInstanceId, seriesIds);
    };

    const scriptDrawingScope = (scriptInstanceId: string) =>
      scriptScope(scriptInstanceId);

    const removeManagedDrawingsForScript = (scriptInstanceId: string) => {
      const drawingIds = managedDrawingIdsByInstanceId.get(scriptInstanceId);
      if (drawingIds) {
        for (const drawingId of drawingIds) {
          removeScopeDrawingRef.current(scriptDrawingScope(scriptInstanceId), drawingId);
          pendingDrawingUpsertsById.delete(drawingId);
        }
      }
      clearScopeDrawingsRef.current(scriptDrawingScope(scriptInstanceId));
      managedDrawingIdsByInstanceId.delete(scriptInstanceId);
    };

    const removeAllManagedDrawings = () => {
      for (const [scriptInstanceId, drawingIds] of managedDrawingIdsByInstanceId.entries()) {
        for (const drawingId of drawingIds) {
          removeScopeDrawingRef.current(
            scriptDrawingScope(scriptInstanceId),
            drawingId,
          );
          pendingDrawingUpsertsById.delete(drawingId);
        }
        clearScopeDrawingsRef.current(scriptDrawingScope(scriptInstanceId));
      }
      managedDrawingIdsByInstanceId.clear();
      pendingDrawingUpsertsById.clear();
    };

    const trackManagedDrawing = (
      scriptInstanceId: string,
      drawingGlobalId: string,
    ) => {
      const drawingIds =
        managedDrawingIdsByInstanceId.get(scriptInstanceId) ?? new Set<string>();
      drawingIds.add(drawingGlobalId);
      managedDrawingIdsByInstanceId.set(scriptInstanceId, drawingIds);
    };

    const untrackManagedDrawing = (
      scriptInstanceId: string,
      drawingGlobalId: string,
    ) => {
      const drawingIds = managedDrawingIdsByInstanceId.get(scriptInstanceId);
      if (!drawingIds) {
        return;
      }
      drawingIds.delete(drawingGlobalId);
      if (drawingIds.size === 0) {
        managedDrawingIdsByInstanceId.delete(scriptInstanceId);
      }
    };

    const queuePendingPlotEvent = (event: PendingPlotEvent) => {
      const current = pendingPlotEventsByBarIndex.get(event.barIndex) ?? [];
      current.push(event);
      pendingPlotEventsByBarIndex.set(event.barIndex, current);
    };

    const flushPendingPlotEventsForBarIndex = (barIndex: number) => {
      const pending = pendingPlotEventsByBarIndex.get(barIndex);
      if (!pending || pending.length === 0) {
        return;
      }
      const time = candleTimeByBarIndex.get(barIndex);
      if (time == null) {
        return;
      }
      for (const event of pending) {
        const seriesId = `${event.scriptInstanceId}::${event.plotId}`;
        addPlotSeriesRef.current(seriesId);
        trackManagedPlotSeries(event.scriptInstanceId, seriesId);
        setPlotPointRef.current(seriesId, {
          time,
          value: event.value,
        });
      }
      pendingPlotEventsByBarIndex.delete(barIndex);
    };

    const flushPendingPlotEvents = () => {
      const indexes = Array.from(pendingPlotEventsByBarIndex.keys());
      for (const index of indexes) {
        flushPendingPlotEventsForBarIndex(index);
      }
    };

    const applyDrawingUpsert = (
      scriptInstanceId: string,
      drawingId: string,
      payload: ScriptPrimitiveDrawingPayload,
    ) => {
      const result = resolveScriptPrimitiveDrawing({
        scriptInstanceId,
        drawingId,
        payload,
        resolveTimeForIndex: (index) =>
          candleTimeByBarIndex.get(Math.trunc(index)) ?? null,
      });
      const globalDrawingId = `${scriptInstanceId}::${drawingId}`;
      trackManagedDrawing(scriptInstanceId, globalDrawingId);

      if (result.status === "resolved") {
        pendingDrawingUpsertsById.delete(globalDrawingId);
        upsertScopeDrawingRef.current(scriptDrawingScope(scriptInstanceId), result.drawing);
        return;
      }
      if (result.status === "pending") {
        pendingDrawingUpsertsById.set(globalDrawingId, {
          scriptInstanceId,
          drawingId,
          payload,
        });
        return;
      }
      scriptTrace("drawing_delta_invalid", {
        scriptInstanceId,
        drawingId,
        reason: result.reason,
      });
      pendingDrawingUpsertsById.delete(globalDrawingId);
    };

    const flushPendingDrawingUpserts = () => {
      if (pendingDrawingUpsertsById.size === 0) {
        return;
      }
      for (const [globalId, pending] of pendingDrawingUpsertsById.entries()) {
        const result = resolveScriptPrimitiveDrawing({
          scriptInstanceId: pending.scriptInstanceId,
          drawingId: pending.drawingId,
          payload: pending.payload,
          resolveTimeForIndex: (index) =>
            candleTimeByBarIndex.get(Math.trunc(index)) ?? null,
        });

        if (result.status === "resolved") {
          pendingDrawingUpsertsById.delete(globalId);
          upsertScopeDrawingRef.current(
            scriptDrawingScope(pending.scriptInstanceId),
            result.drawing,
          );
          continue;
        }
        if (result.status === "invalid") {
          scriptTrace("pending_drawing_invalid", {
            scriptInstanceId: pending.scriptInstanceId,
            drawingId: pending.drawingId,
            reason: result.reason,
          });
          pendingDrawingUpsertsById.delete(globalId);
          removeScopeDrawingRef.current(
            scriptDrawingScope(pending.scriptInstanceId),
            globalId,
          );
          untrackManagedDrawing(pending.scriptInstanceId, globalId);
        }
      }
    };

    const isAttachReady = () => {
      return (
        active &&
        Boolean(createdSessionId) &&
        snapshotLoaded &&
        wsConnected &&
        statusValue === "LIVE"
      );
    };

    const parseFiniteNumber = (value: unknown): number | null => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    clearCandlesRef.current();
    onLiveCandleRef.current(null);
    setStatus("IDLE");
    onWsStateRef.current("CONNECTING");
    onHeartbeatRef.current("WAITING");

    const emitCandles = () => {
      const sortedEntries = Array.from(byIndex.entries()).sort(
        (a, b) => a[0] - b[0],
      );
      const sorted = sortedEntries.map(([, candle]) => candle);
      setCandlesRef.current(sorted);
      const latest =
        sortedEntries.length > 0
          ? sortedEntries[sortedEntries.length - 1][1]
          : null;
      onLiveCandleRef.current(latest);
    };

    const destroySessionById = (sessionId: string, keepalive: boolean) => {
      if (!sessionId) {
        return;
      }
      scriptTrace("session_destroy_request", {
        targetSessionId: sessionId,
        keepalive,
      });
      transport
        .destroySession(sessionId, keepalive)
        .then(() => {
          scriptTrace("session_destroy_response", {
            targetSessionId: sessionId,
            status: "ok",
            ok: true,
          });
        })
        .catch((error) => {
          scriptTrace("session_destroy_failed", {
            targetSessionId: sessionId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
    };

    const destroyCreatedSession = (keepalive: boolean) => {
      if (!createdSessionId || sessionDestroyed) {
        return;
      }
      sessionDestroyed = true;
      destroySessionById(createdSessionId, keepalive);
    };

    const handlePageHide = () => {
      destroyCreatedSession(true);
    };

    const applyCandle = (bar: SnapshotBar) => {
      const candle = toChartCandle(bar, timeframe);
      if (!candle) {
        return;
      }
      const higherTf = isHigherTimeframe(timeframe);
      const key = higherTf
        ? keyFromChartCandleTime(candle.time)
        : resolveBarIndex(bar);
      if (key == null) {
        return;
      }
      const existing = byIndex.get(key);
      const shouldMergeHigherTfUpdate =
        higherTf &&
        (bar.mutation === "REPLACE" ||
          bar.mutation === "APPEND" ||
          bar.mutation === "SNAPSHOT") &&
        existing != null;

      if (shouldMergeHigherTfUpdate) {
        byIndex.set(key, {
          ...candle,
          open: existing.open,
          high: Math.max(existing.high, candle.high),
          low: Math.min(existing.low, candle.low),
          close: candle.close,
        });
      } else {
        byIndex.set(key, candle);
      }

      const barIndex = resolveBarIndex(bar);
      if (barIndex != null) {
        candleTimeByBarIndex.set(barIndex, candle.time);
        flushPendingPlotEventsForBarIndex(barIndex);
        flushPendingDrawingUpserts();
      }

      emitCandles();
    };

    const pruneByBeginIndex = (beginIndex?: number) => {
      if (isHigherTimeframe(timeframe)) {
        return;
      }
      if (typeof beginIndex !== "number" || !Number.isFinite(beginIndex)) {
        return;
      }
      for (const key of byIndex.keys()) {
        if (key < beginIndex) {
          byIndex.delete(key);
        }
      }
      for (const key of candleTimeByBarIndex.keys()) {
        if (key < beginIndex) {
          candleTimeByBarIndex.delete(key);
        }
      }
      for (const key of pendingPlotEventsByBarIndex.keys()) {
        if (key < beginIndex) {
          pendingPlotEventsByBarIndex.delete(key);
        }
      }
    };

    const setLocalAttachFailure = (
      script: ScriptCatalogDetailsItem,
      message: string,
    ) => {
      const validation = buildAttachParamsFromCatalog(script);
      const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      upsertScriptInstance({
        scriptInstanceId: localId,
        scriptId: script.scriptId,
        scriptName: script.name,
        kind: script.kind,
        executionMode: "ON_TICK",
        lifecycle: "FAILED",
        error: message,
        bootstrapJobId: null,
        attachAcceptedAtEpochMs: Date.now(),
        seriesKey,
        params: validation.params,
        paramsMeta: script.params ?? [],
      });
      setScriptActionError(message);
    };

    const applyPlotSnapshotForScript = async (
      sessionId: string,
      scriptInstanceId: string,
    ) => {
      scriptTrace("plot_snapshot_fetch_start", { scriptInstanceId, sessionId });
      const path = `/engine/ui-sessions/${encodeURIComponent(sessionId)}/series/${encodeURIComponent(
        seriesKey,
      )}/scripts/${encodeURIComponent(scriptInstanceId)}/registries/plot/snapshot`;
      const res = await backendFetch(path);
      if (!res.ok) {
        scriptTrace("plot_snapshot_fetch_error", {
          scriptInstanceId,
          sessionId,
          statusCode: res.status,
        });
        throw new Error(`plot snapshot failed (${res.status})`);
      }
      const snapshot = (await res.json()) as Record<
        string,
        Array<Record<string, unknown>>
      >;
      removeManagedPlotSeriesForScript(scriptInstanceId);
      scriptTrace("plot_snapshot_fetch_success", {
        scriptInstanceId,
        sessionId,
        plotCount: Object.keys(snapshot ?? {}).length,
      });

      for (const [plotId, points] of Object.entries(snapshot ?? {})) {
        const seriesId = `${scriptInstanceId}::${plotId}`;
        addPlotSeriesRef.current(seriesId);
        trackManagedPlotSeries(scriptInstanceId, seriesId);
        const resolvedPoints: Array<{
          time: ChartCandle["time"];
          value: number;
        }> = [];
        for (const point of points ?? []) {
          const barIndex = parseFiniteNumber(point?.index);
          const value = parseFiniteNumber(point?.value ?? point?.close);
          if (barIndex == null || value == null) {
            continue;
          }
          const mappedTime = candleTimeByBarIndex.get(Math.trunc(barIndex));
          if (mappedTime == null) {
            queuePendingPlotEvent({
              scriptInstanceId,
              plotId,
              barIndex: Math.trunc(barIndex),
              value,
            });
            continue;
          }
          resolvedPoints.push({
            time: mappedTime,
            value,
          });
        }
        setPlotPointsRef.current(seriesId, resolvedPoints);
      }
      flushPendingPlotEvents();
    };

    const applyDrawingSnapshotForScript = async (
      sessionId: string,
      scriptInstanceId: string,
    ) => {
      scriptTrace("drawing_snapshot_fetch_start", {
        scriptInstanceId,
        sessionId,
      });
      const path = `/engine/ui-sessions/${encodeURIComponent(sessionId)}/series/${encodeURIComponent(
        seriesKey,
      )}/scripts/${encodeURIComponent(scriptInstanceId)}/registries/drawing/snapshot`;
      const res = await backendFetch(path);
      if (!res.ok) {
        scriptTrace("drawing_snapshot_fetch_error", {
          scriptInstanceId,
          sessionId,
          statusCode: res.status,
        });
        throw new Error(`drawing snapshot failed (${res.status})`);
      }
      const snapshot = (await res.json()) as Record<string, unknown>;
      removeManagedDrawingsForScript(scriptInstanceId);
      scriptTrace("drawing_snapshot_fetch_success", {
        scriptInstanceId,
        sessionId,
        drawingCount: Object.keys(snapshot ?? {}).length,
      });

      for (const [drawingId, payload] of Object.entries(snapshot ?? {})) {
        applyDrawingUpsert(
          scriptInstanceId,
          drawingId,
          payload as ScriptPrimitiveDrawingPayload,
        );
      }
      flushPendingDrawingUpserts();
    };

    const ackScriptSnapshot = async (
      sessionId: string,
      scriptInstanceId: string,
      snapshotCursorSeq: number,
    ) => {
      scriptTrace("snapshot_ack_request_start", {
        scriptInstanceId,
        sessionId,
        snapshotCursorSeq,
      });
      const path = `/engine/ui-sessions/${encodeURIComponent(sessionId)}/series/${encodeURIComponent(
        seriesKey,
      )}/scripts/${encodeURIComponent(scriptInstanceId)}/snapshot-ack`;
      const res = await backendFetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotCursorSeq }),
      });
      if (!res.ok) {
        scriptTrace("snapshot_ack_request_error", {
          scriptInstanceId,
          sessionId,
          snapshotCursorSeq,
          statusCode: res.status,
        });
        throw new Error(`snapshot ack failed (${res.status})`);
      }
      const ack = (await res.json()) as ScriptSnapshotAckResponse;
      scriptTrace("snapshot_ack_request_success", {
        scriptInstanceId,
        sessionId,
        snapshotCursorSeq,
        activated: ack.activated,
        replayedEvents: ack.replayedEvents,
        fromSeq: ack.fromSeq,
        toSeq: ack.toSeq,
      });
      return ack;
    };

    const handleScriptSnapshotReady = async (
      evt: ScriptSnapshotReadyWsEvent,
    ) => {
      scriptTrace("snapshot_ready_received", {
        scriptInstanceId: evt.scriptInstanceId,
        evtSessionId: evt.sessionId,
        evtSeriesKey: evt.seriesKey,
        snapshotCursorSeq: evt.snapshotCursorSeq,
        bootstrapJobId: evt.bootstrapJobId,
        readyStatus: evt.status,
        readyError: evt.error ?? null,
      });
      if (!active || !createdSessionId) {
        scriptTrace("snapshot_ready_ignored", {
          scriptInstanceId: evt.scriptInstanceId,
          reason: "bridge_inactive_or_session_missing",
          active,
          createdSessionId,
        });
        return;
      }
      if (
        evt.sessionId !== createdSessionId ||
        evt.seriesKey !== seriesKey ||
        !evt.scriptInstanceId
      ) {
        scriptTrace("snapshot_ready_ignored", {
          scriptInstanceId: evt.scriptInstanceId,
          reason: "session_or_series_mismatch_or_missing_instance_id",
          evtSessionId: evt.sessionId,
          expectedSessionId: createdSessionId,
          evtSeriesKey: evt.seriesKey,
          expectedSeriesKey: seriesKey,
        });
        return;
      }
      const current = scriptsByInstanceId.get(evt.scriptInstanceId);
      if (!current) {
        pendingSnapshotReadyByInstanceId.set(evt.scriptInstanceId, evt);
        scriptTrace("snapshot_ready_buffered", {
          scriptInstanceId: evt.scriptInstanceId,
          reason: "instance_not_found_yet",
          bootstrapJobId: evt.bootstrapJobId,
        });
        return;
      }
      if (snapshotHandshakeInFlight.has(evt.scriptInstanceId)) {
        scriptTrace("snapshot_ready_ignored", {
          scriptInstanceId: evt.scriptInstanceId,
          reason: "handshake_already_in_flight",
        });
        return;
      }
      snapshotHandshakeInFlight.add(evt.scriptInstanceId);
      pendingSnapshotReadyByInstanceId.delete(evt.scriptInstanceId);

      if (evt.status === "FAILED") {
        scriptTrace("snapshot_ready_failed", {
          scriptInstanceId: evt.scriptInstanceId,
          error: evt.error ?? "script_bootstrap_failed",
        });
        patchScriptInstance(evt.scriptInstanceId, {
          lifecycle: "FAILED",
          error: evt.error ?? "script_bootstrap_failed",
        });
        setScriptActionError(
          `Script bootstrap failed for ${current.scriptName}.`,
        );
        snapshotHandshakeInFlight.delete(evt.scriptInstanceId);
        return;
      }

      patchScriptInstance(evt.scriptInstanceId, {
        lifecycle: "SNAPSHOT_READY",
        error: null,
      });
      scriptTrace("lifecycle_transition", {
        scriptInstanceId: evt.scriptInstanceId,
        fromLifecycle: current.lifecycle,
        toLifecycle: "SNAPSHOT_READY",
      });

      try {
        await applyPlotSnapshotForScript(
          createdSessionId,
          evt.scriptInstanceId,
        );
        await applyDrawingSnapshotForScript(
          createdSessionId,
          evt.scriptInstanceId,
        );
        patchScriptInstance(evt.scriptInstanceId, { lifecycle: "ACKING" });
        scriptTrace("lifecycle_transition", {
          scriptInstanceId: evt.scriptInstanceId,
          toLifecycle: "ACKING",
        });
        const ack = await ackScriptSnapshot(
          createdSessionId,
          evt.scriptInstanceId,
          evt.snapshotCursorSeq,
        );
        if (!ack.activated) {
          scriptTrace("snapshot_ack_not_activated", {
            scriptInstanceId: evt.scriptInstanceId,
            snapshotCursorSeq: evt.snapshotCursorSeq,
          });
          patchScriptInstance(evt.scriptInstanceId, {
            lifecycle: "FAILED",
            error: "snapshot_ack_not_activated",
          });
          setScriptActionError(
            `Snapshot ack did not activate ${current.scriptName}.`,
          );
          return;
        }
        patchScriptInstance(evt.scriptInstanceId, {
          lifecycle: "ACTIVE",
          error: null,
        });
        scriptTrace("lifecycle_transition", {
          scriptInstanceId: evt.scriptInstanceId,
          toLifecycle: "ACTIVE",
        });
      } catch (error: any) {
        scriptTrace("snapshot_handshake_failed", {
          scriptInstanceId: evt.scriptInstanceId,
          error: error?.message ?? "script_snapshot_flow_failed",
        });
        patchScriptInstance(evt.scriptInstanceId, {
          lifecycle: "FAILED",
          error: error?.message ?? "script_snapshot_flow_failed",
        });
        setScriptActionError(error?.message ?? "Script snapshot flow failed.");
      } finally {
        snapshotHandshakeInFlight.delete(evt.scriptInstanceId);
      }
    };

    const markHandshakeScriptsFailed = (reason: string) => {
      let changed = false;
      for (const [scriptInstanceId, item] of scriptsByInstanceId.entries()) {
        if (
          item.lifecycle === "ATTACHING" ||
          item.lifecycle === "LOADING" ||
          item.lifecycle === "SNAPSHOT_READY" ||
          item.lifecycle === "ACKING"
        ) {
          scriptsByInstanceId.set(scriptInstanceId, {
            ...item,
            lifecycle: "FAILED",
            error: reason,
          });
          scriptTrace("lifecycle_transition", {
            scriptInstanceId,
            fromLifecycle: item.lifecycle,
            toLifecycle: "FAILED",
            reason,
          });
          changed = true;
        }
      }
      if (changed) {
        scriptTrace("mark_handshake_scripts_failed", { reason });
        emitScriptInstances();
      }
    };

    const handlePlotDelta = (delta: ScriptDeltaWsEvent) => {
      if (!scriptsEnabled) {
        return;
      }
      if (
        delta.registryType !== "plot" ||
        delta.eventType !== "PLOT_POINT_ADD" ||
        !delta.scriptInstanceId
      ) {
        return;
      }
      if (!scriptsByInstanceId.has(delta.scriptInstanceId)) {
        return;
      }
      const payload = (delta.payload ?? {}) as ScriptPlotEventPayload;
      const plotId = typeof payload.plotId === "string" ? payload.plotId : null;
      const point = payload.payload;
      if (!plotId || !point) {
        return;
      }
      const barIndex = parseFiniteNumber(point.index);
      const value = parseFiniteNumber(point.value ?? point.close);
      if (barIndex == null || value == null) {
        return;
      }
      const normalizedBarIndex = Math.trunc(barIndex);
      const mappedTime = candleTimeByBarIndex.get(normalizedBarIndex);
      if (mappedTime == null) {
        queuePendingPlotEvent({
          scriptInstanceId: delta.scriptInstanceId,
          plotId,
          barIndex: normalizedBarIndex,
          value,
        });
        return;
      }
      const seriesId = `${delta.scriptInstanceId}::${plotId}`;
      addPlotSeriesRef.current(seriesId);
      trackManagedPlotSeries(delta.scriptInstanceId, seriesId);
      setPlotPointRef.current(seriesId, {
        time: mappedTime,
        value,
      });
    };

    const handleDrawingDelta = (delta: ScriptDeltaWsEvent) => {
      if (!scriptsEnabled) {
        return;
      }
      if (delta.registryType !== "drawing") {
        return;
      }
      const payloadRecord =
        delta.payload && typeof delta.payload === "object"
          ? (delta.payload as Record<string, unknown>)
          : null;
      const resolvedScriptInstanceId =
        (typeof payloadRecord?.scriptInstanceId === "string"
          ? payloadRecord.scriptInstanceId
          : null) ?? delta.scriptInstanceId;

      if (
        !resolvedScriptInstanceId ||
        !scriptsByInstanceId.has(resolvedScriptInstanceId)
      ) {
        return;
      }

      if (delta.eventType === "DRAWING_UPSERT") {
        const payload = (delta.payload ?? {}) as ScriptDrawingUpsertDeltaPayload;
        const drawingId =
          typeof payload.drawingId === "string" ? payload.drawingId : null;
        if (!drawingId || !payload.payload) {
          return;
        }
        applyDrawingUpsert(
          resolvedScriptInstanceId,
          drawingId,
          payload.payload,
        );
        return;
      }

      if (delta.eventType === "DRAWING_REMOVE") {
        const payload = (delta.payload ?? {}) as ScriptDrawingRemoveDeltaPayload;
        const drawingId =
          typeof payload.drawingId === "string" ? payload.drawingId : null;
        if (!drawingId) {
          return;
        }
        const globalDrawingId = `${resolvedScriptInstanceId}::${drawingId}`;
        pendingDrawingUpsertsById.delete(globalDrawingId);
        removeScopeDrawingRef.current(
          scriptScope(resolvedScriptInstanceId),
          globalDrawingId,
        );
        untrackManagedDrawing(resolvedScriptInstanceId, globalDrawingId);
        return;
      }

      if (delta.eventType === "DRAWING_CLEAR") {
        const payload = (delta.payload ?? {}) as ScriptDrawingClearDeltaPayload;
        const scriptInstanceId =
          typeof payload.scriptInstanceId === "string"
            ? payload.scriptInstanceId
            : resolvedScriptInstanceId;
        if (!scriptInstanceId) {
          return;
        }
        removeManagedDrawingsForScript(scriptInstanceId);
      }
    };

    const handleAlertDelta = (delta: ScriptDeltaWsEvent) => {
      if (!scriptsEnabled) {
        return;
      }
      if (delta.registryType !== "alert" || delta.eventType !== "ALERT_ADD") {
        return;
      }
      const eventPayload =
        delta.payload && typeof delta.payload === "object"
          ? (delta.payload as ScriptAlertEventPayload)
          : null;
      const payload =
        eventPayload?.payload && typeof eventPayload.payload === "object"
          ? eventPayload.payload
          : null;
      if (!payload) {
        return;
      }
      const message = formatAlertMessage(payload, timeframe);
      onScriptAlertRef.current(message);
    };

    const attachScriptFromCatalog = (script: ScriptCatalogDetailsItem) => {
      void (async () => {
        setScriptActionError(null);
        scriptTrace("attach_click", {
          scriptId: script.scriptId,
          scriptName: script.name,
          kind: script.kind,
        });
        if (!isAttachReady()) {
          scriptTrace("attach_blocked", {
            scriptId: script.scriptId,
            reason: "attach_not_ready",
          });
          setScriptActionError(
            "Script attach is available only when chart is LIVE and WS is OPEN.",
          );
          return;
        }
        const validation = buildAttachParamsFromCatalog(script);
        if (validation.error) {
          scriptTrace("attach_blocked", {
            scriptId: script.scriptId,
            reason: "param_validation_failed",
            error: validation.error,
          });
          setLocalAttachFailure(script, validation.error);
          return;
        }

        const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        upsertScriptInstance({
          scriptInstanceId: tempId,
          scriptId: script.scriptId,
          scriptName: script.name,
          kind: script.kind,
          executionMode: "ON_TICK",
          lifecycle: "ATTACHING",
          error: null,
          bootstrapJobId: null,
          attachAcceptedAtEpochMs: Date.now(),
          seriesKey,
          params: validation.params,
          paramsMeta: script.params ?? [],
        });
        scriptTrace("lifecycle_transition", {
          scriptId: script.scriptId,
          scriptName: script.name,
          scriptInstanceId: tempId,
          toLifecycle: "ATTACHING",
          temp: true,
        });

        try {
          const path = `/engine/ui-sessions/${encodeURIComponent(createdSessionId as string)}/series/${encodeURIComponent(
            seriesKey,
          )}/scripts/attach`;
          scriptTrace("attach_request_start", {
            scriptId: script.scriptId,
            tempScriptInstanceId: tempId,
            executionMode: "ON_TICK",
            paramKeys: Object.keys(validation.params ?? {}),
          });
          const res = await backendFetch(path, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scriptId: script.scriptId,
              params: validation.params,
              executionMode: "ON_TICK",
            }),
          });
          if (!res.ok) {
            scriptTrace("attach_request_error", {
              scriptId: script.scriptId,
              tempScriptInstanceId: tempId,
              statusCode: res.status,
            });
            throw new Error(`attach failed (${res.status})`);
          }
          const attached = (await res.json()) as UiAttachScriptResponse;
          scriptTrace("attach_request_success", {
            scriptId: script.scriptId,
            tempScriptInstanceId: tempId,
            scriptInstanceId: attached.scriptInstanceId,
            bootstrapJobId: attached.bootstrapJobId,
            lifecycleState: attached.lifecycleState,
            attachAcceptedAtEpochMs: attached.attachAcceptedAtEpochMs,
          });
          removeScriptInstance(tempId);
          upsertScriptInstance({
            scriptInstanceId: attached.scriptInstanceId,
            scriptId: attached.scriptId,
            scriptName: script.name,
            kind: attached.kind,
            executionMode: attached.executionMode,
            lifecycle: "LOADING",
            error: null,
            bootstrapJobId: attached.bootstrapJobId,
            attachAcceptedAtEpochMs: attached.attachAcceptedAtEpochMs,
            seriesKey: attached.seriesKey,
            params: validation.params,
            paramsMeta: script.params ?? [],
          });
          scriptTrace("lifecycle_transition", {
            scriptInstanceId: attached.scriptInstanceId,
            toLifecycle: "LOADING",
            bootstrapJobId: attached.bootstrapJobId,
          });
          const pendingReady = pendingSnapshotReadyByInstanceId.get(
            attached.scriptInstanceId,
          );
          if (pendingReady) {
            pendingSnapshotReadyByInstanceId.delete(attached.scriptInstanceId);
            scriptTrace("snapshot_ready_replay_buffered", {
              scriptInstanceId: attached.scriptInstanceId,
              bootstrapJobId: pendingReady.bootstrapJobId,
            });
            void handleScriptSnapshotReady(pendingReady);
          }
        } catch (error: any) {
          scriptTrace("attach_request_failed", {
            scriptId: script.scriptId,
            tempScriptInstanceId: tempId,
            error: error?.message ?? "script_attach_failed",
          });
          patchScriptInstance(tempId, {
            lifecycle: "FAILED",
            error: error?.message ?? "script_attach_failed",
          });
          setScriptActionError(error?.message ?? "Script attach failed.");
        }
      })();
    };

    const detachScriptInstance = (scriptInstanceId: string) => {
      void (async () => {
        setScriptActionError(null);
        const current = scriptsByInstanceId.get(scriptInstanceId);
        if (!current) {
          scriptTrace("detach_ignored", {
            scriptInstanceId,
            reason: "instance_not_found",
          });
          return;
        }
        if (scriptInstanceId.startsWith("local-")) {
          scriptTrace("detach_local_instance_removed", {
            scriptInstanceId,
            lifecycle: current.lifecycle,
          });
          removeScriptInstance(scriptInstanceId);
          return;
        }
        if (!createdSessionId) {
          scriptTrace("detach_blocked", {
            scriptInstanceId,
            reason: "session_missing",
          });
          setScriptActionError("No active session for script detach.");
          return;
        }

        const previousLifecycle = current.lifecycle;
        patchScriptInstance(scriptInstanceId, {
          lifecycle: "DETACHING",
          error: null,
        });
        scriptTrace("lifecycle_transition", {
          scriptInstanceId,
          fromLifecycle: previousLifecycle,
          toLifecycle: "DETACHING",
        });
        try {
          const path = `/engine/ui-sessions/${encodeURIComponent(createdSessionId)}/series/${encodeURIComponent(
            seriesKey,
          )}/scripts/${encodeURIComponent(scriptInstanceId)}/detach`;
          scriptTrace("detach_request_start", { scriptInstanceId });
          const res = await backendFetch(path, { method: "POST" });
          if (!res.ok) {
            scriptTrace("detach_request_error", {
              scriptInstanceId,
              statusCode: res.status,
            });
            throw new Error(`detach failed (${res.status})`);
          }
          scriptTrace("detach_request_success", { scriptInstanceId });
          removeManagedPlotSeriesForScript(scriptInstanceId);
          removeScriptInstance(scriptInstanceId);
        } catch (error: any) {
          scriptTrace("detach_request_failed", {
            scriptInstanceId,
            restoreLifecycle: previousLifecycle,
            error: error?.message ?? "script_detach_failed",
          });
          patchScriptInstance(scriptInstanceId, {
            lifecycle: previousLifecycle,
            error: error?.message ?? "script_detach_failed",
          });
          setScriptActionError(error?.message ?? "Script detach failed.");
        }
      })();
    };

    const replaceScriptInstance = async (
      scriptInstanceId: string,
      params: Record<string, unknown>,
    ) => {
      setScriptActionError(null);
      const current = scriptsByInstanceId.get(scriptInstanceId);
      if (!current) {
        scriptTrace("replace_ignored", {
          scriptInstanceId,
          reason: "instance_not_found",
        });
        return;
      }
      if (!createdSessionId) {
        scriptTrace("replace_blocked", {
          scriptInstanceId,
          reason: "session_missing",
        });
        throw new Error("No active session for script replace.");
      }
      if (scriptInstanceId.startsWith("local-")) {
        scriptTrace("replace_blocked", {
          scriptInstanceId,
          reason: "local_script_not_replaceable",
        });
        throw new Error("Local placeholder scripts cannot be updated.");
      }

      const previousLifecycle = current.lifecycle;
      patchScriptInstance(scriptInstanceId, {
        lifecycle: "DETACHING",
        error: null,
      });
      scriptTrace("lifecycle_transition", {
        scriptInstanceId,
        fromLifecycle: previousLifecycle,
        toLifecycle: "DETACHING",
        reason: "replace_request",
      });

      try {
        const path = `/engine/ui-sessions/${encodeURIComponent(createdSessionId)}/series/${encodeURIComponent(
          seriesKey,
        )}/scripts/${encodeURIComponent(scriptInstanceId)}/replace`;
        scriptTrace("replace_request_start", {
          scriptInstanceId,
          executionMode: current.executionMode,
          paramKeys: Object.keys(params ?? {}),
        });
        const res = await backendFetch(path, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            params,
            executionMode: current.executionMode,
          }),
        });
        if (!res.ok) {
          scriptTrace("replace_request_error", {
            scriptInstanceId,
            statusCode: res.status,
          });
          throw new Error(`replace failed (${res.status})`);
        }
        const replaced = (await res.json()) as UiReplaceScriptResponse;
        scriptTrace("replace_request_success", {
          replacedScriptInstanceId: replaced.replacedScriptInstanceId,
          scriptInstanceId: replaced.scriptInstanceId,
          bootstrapJobId: replaced.bootstrapJobId,
          attachAcceptedAtEpochMs: replaced.attachAcceptedAtEpochMs,
        });
        removeManagedPlotSeriesForScript(scriptInstanceId);
        removeScriptInstance(scriptInstanceId);
        upsertScriptInstance({
          scriptInstanceId: replaced.scriptInstanceId,
          scriptId: replaced.scriptId,
          scriptName: current.scriptName,
          kind: replaced.kind,
          executionMode: replaced.executionMode,
          lifecycle: "LOADING",
          error: null,
          bootstrapJobId: replaced.bootstrapJobId,
          attachAcceptedAtEpochMs: replaced.attachAcceptedAtEpochMs,
          seriesKey: replaced.seriesKey,
          params: { ...params },
          paramsMeta: current.paramsMeta,
        });
        scriptTrace("lifecycle_transition", {
          scriptInstanceId: replaced.scriptInstanceId,
          toLifecycle: "LOADING",
          bootstrapJobId: replaced.bootstrapJobId,
          reason: "replace_accepted",
        });
        const pendingReady = pendingSnapshotReadyByInstanceId.get(
          replaced.scriptInstanceId,
        );
        if (pendingReady) {
          pendingSnapshotReadyByInstanceId.delete(replaced.scriptInstanceId);
          scriptTrace("snapshot_ready_replay_buffered", {
            scriptInstanceId: replaced.scriptInstanceId,
            bootstrapJobId: pendingReady.bootstrapJobId,
          });
          void handleScriptSnapshotReady(pendingReady);
        }
      } catch (error: any) {
        scriptTrace("replace_request_failed", {
          scriptInstanceId,
          restoreLifecycle: previousLifecycle,
          error: error?.message ?? "script_replace_failed",
        });
        patchScriptInstance(scriptInstanceId, {
          lifecycle: previousLifecycle,
          error: error?.message ?? "script_replace_failed",
        });
        setScriptActionError(error?.message ?? "Script replace failed.");
        throw error;
      }
    };

    if (scriptsEnabled) {
      onScriptActionsReadyRef.current({
        attachScriptFromCatalog,
        detachScriptInstance,
        replaceScriptInstance,
      });
    } else {
      onScriptActionsReadyRef.current(NOOP_SCRIPT_ACTIONS);
    }

    const loadSnapshot = async () => {
      if (!active || !createdSessionId || snapshotRequested) {
        return;
      }
      snapshotRequested = true;
      setStatus("SNAPSHOT_LOADING");
      try {
        const snapshot = (await transport.fetchSnapshot(
          createdSessionId,
          seriesKey,
        )) as SeriesSnapshotResponse;
        if (!active) {
          return;
        }
        snapshotCursor =
          snapshot.snapshotCursor ?? snapshot.lastSeq ?? snapshotCursor;

        byIndex.clear();
        candleTimeByBarIndex.clear();
        for (const bar of snapshot.bars ?? []) {
          applyCandle(bar);
        }

        const replay = [...buffered].sort((a, b) => {
          if (a.seq !== b.seq) return a.seq - b.seq;
          return a.ts - b.ts;
        });
        for (const event of replay) {
          if (event.seq > snapshotCursor) {
            applyCandle(event.bar);
            pruneByBeginIndex(event.meta?.beginIndex);
            snapshotCursor = Math.max(snapshotCursor, event.seq);
          }
        }
        buffered.length = 0;
        snapshotLoaded = true;
        flushPendingPlotEvents();
        flushPendingDrawingUpserts();
        emitCandles();
        setStatus(terminalStatus === "DEGRADED" ? "DEGRADED" : "LIVE");
      } catch (error: any) {
        if (!active) {
          return;
        }
        setStatus(`ERROR: ${error?.message || "snapshot failed"}`);
      }
    };

    const startFallbackPolling = () => {
      if (!transport.listSessions) {
        return;
      }
      if (fallbackPollTimer != null) {
        window.clearInterval(fallbackPollTimer);
      }
      fallbackPollTimer = window.setInterval(async () => {
        if (!active || snapshotRequested || !createdSessionId) {
          return;
        }
        try {
          const list = await transport.listSessions?.();
          if (!list) return;
          const current = list.find(
            (item) => item.sessionId === createdSessionId,
          );
          if (!current?.bootstrapStatus) return;
          if (current.bootstrapStatus === "COMPLETED") {
            terminalStatus = "COMPLETED";
            void loadSnapshot();
          } else if (current.bootstrapStatus === "DEGRADED") {
            terminalStatus = "DEGRADED";
            void loadSnapshot();
          }
        } catch {
          // keep polling as a fallback path
        }
      }, 2000);
    };

    const startHeartbeat = () => {
      if (heartbeatTimer != null) {
        window.clearInterval(heartbeatTimer);
      }
      heartbeatTimer = window.setInterval(() => {
        if (!wsConnected) {
          onHeartbeatRef.current("DISCONNECTED");
          return;
        }
        const ageMs = Date.now() - lastWsMessageAt;
        const ageSec = Math.max(0, Math.floor(ageMs / 1000));
        if (ageMs <= 5000) {
          onHeartbeatRef.current(`HEALTHY (${ageSec}s)`);
        } else {
          onHeartbeatRef.current(`STALE (${ageSec}s)`);
        }
      }, 1000);
    };

    const bootstrap = async () => {
      try {
        setStatus("CONNECTING");
        scriptTrace("session_create_request", {
          destroyOnClose: true,
          maxBarCount: 5000,
        });
        const created = await transport.createSession(seriesKey);
        scriptTrace("session_create_response", {
          targetSessionId: created.sessionId,
        });
        if (!active) {
          scriptTrace("session_create_orphan_cleanup", {
            targetSessionId: created.sessionId,
          });
          destroySessionById(created.sessionId, true);
          return;
        }
        createdSessionId = created.sessionId;
        setStatus("WS_CONNECTED");
        startFallbackPolling();
        window.addEventListener("pagehide", handlePageHide);
        window.addEventListener("beforeunload", handlePageHide);

        wsConnection = transport.connectTicksWs(createdSessionId, {
          onOpen: () => {
            if (active) {
              wsConnected = true;
              lastWsMessageAt = Date.now();
              onWsStateRef.current("OPEN");
              onHeartbeatRef.current("HEALTHY (0s)");
              setStatus("WS_CONNECTED");
            }
          },
          onError: () => {
            if (active) {
              onWsStateRef.current("ERROR");
            }
          },
          onClose: () => {
            wsConnected = false;
            scriptTrace("ws_closed", {
              reason: "ws_disconnected_during_handshake",
            });
            markHandshakeScriptsFailed("ws_disconnected_during_handshake");
            if (active) {
              onWsStateRef.current("CLOSED");
              onHeartbeatRef.current("DISCONNECTED");
            }
          },
          onMessage: (msg: WsEnvelope) => {
            if (!active) {
              return;
            }
            lastWsMessageAt = Date.now();

            if (
              msg.type === "bootstrap_started" ||
              msg.type === "bootstrap_completed" ||
              msg.type === "bootstrap_degraded" ||
              msg.type === "snapshot_ready"
            ) {
              const data = (msg.data ?? {}) as BootstrapEventPayload;
              if (
                data.sessionId !== createdSessionId ||
                data.seriesKey !== seriesKey
              ) {
                return;
              }
              if (msg.type === "bootstrap_started") {
                setStatus("BOOTSTRAPPING");
                return;
              }
              if (msg.type === "bootstrap_completed") {
                terminalStatus = "COMPLETED";
                return;
              }
              if (msg.type === "bootstrap_degraded") {
                terminalStatus = "DEGRADED";
                return;
              }
              if (msg.type === "snapshot_ready") {
                if (data.status === "DEGRADED") {
                  terminalStatus = "DEGRADED";
                } else if (data.status === "COMPLETED") {
                  terminalStatus = "COMPLETED";
                }
                void loadSnapshot();
                return;
              }
            }

            if (scriptsEnabled && msg.type === "script_snapshot_ready") {
              const data = (msg.data ?? {}) as ScriptSnapshotReadyWsEvent;
              void handleScriptSnapshotReady(data);
              return;
            }

            if (scriptsEnabled && msg.type === "script_registry_delta") {
              const data = (msg.data ?? {}) as ScriptDeltaWsEvent;
              if (
                data.sessionId !== createdSessionId ||
                data.seriesKey !== seriesKey
              ) {
                return;
              }
              if (typeof data.seq === "number" && Number.isFinite(data.seq)) {
                if (seenScriptDeltaSeq.has(data.seq)) {
                  return;
                }
                seenScriptDeltaSeq.add(data.seq);
                if (seenScriptDeltaSeq.size > 5000) {
                  let removed = 0;
                  for (const seq of seenScriptDeltaSeq) {
                    seenScriptDeltaSeq.delete(seq);
                    removed += 1;
                    if (removed >= 1000) {
                      break;
                    }
                  }
                }
              }
              if (data.registryType === "plot") {
                handlePlotDelta(data);
                return;
              }
              if (data.registryType === "drawing") {
                handleDrawingDelta(data);
                return;
              }
              if (data.registryType === "alert") {
                handleAlertDelta(data);
                return;
              }
              return;
            }

            if (
              msg.type === "candle_appended" ||
              msg.type === "candle_live_upsert"
            ) {
              const data = (msg.data ?? {}) as CandleAppendedPayload;
              if (
                data.sessionId !== createdSessionId ||
                data.seriesKey !== seriesKey ||
                !data.bar
              ) {
                return;
              }
              const candleType =
                msg.type === "candle_live_upsert"
                  ? "candle_live_upsert"
                  : "candle_appended";
              const seq = typeof data.seq === "number" ? data.seq : -1;
              const entry: BufferedCandleEvent = {
                seq,
                ts: typeof msg.ts === "number" ? msg.ts : Date.now(),
                bar: data.bar,
                meta: data.meta,
              };
              if (!snapshotLoaded) {
                buffered.push(entry);
                return;
              }
              if (entry.seq > snapshotCursor) {
                applyCandle(entry.bar);
                pruneByBeginIndex(entry.meta?.beginIndex);
                snapshotCursor = Math.max(snapshotCursor, entry.seq);
                if (candleType === "candle_live_upsert") {
                  const price = parseNumber(entry.bar.close);
                  const tsMs = Date.parse(
                    entry.bar.endTime ?? entry.bar.beginTime ?? "",
                  );
                  const at = Number.isFinite(tsMs)
                    ? new Date(tsMs).toLocaleTimeString()
                    : new Date().toLocaleTimeString();
                  if (Number.isFinite(price)) {
                    onTickRef.current(price.toString(), at);
                  }
                }
              }
              return;
            }
          },
        });
        startHeartbeat();
      } catch (error: any) {
        if (!active) {
          return;
        }
        onWsStateRef.current("ERROR");
        setStatus(`ERROR: ${error?.message || "session bootstrap failed"}`);
      }
    };

    void bootstrap();

    return () => {
      scriptTrace("panel_cleanup_begin", {
        createdSessionId,
        sessionDestroyed,
      });
      active = false;
      if (fallbackPollTimer != null) {
        window.clearInterval(fallbackPollTimer);
      }
      if (heartbeatTimer != null) {
        window.clearInterval(heartbeatTimer);
      }
      if (wsConnection) {
        try {
          wsConnection.close();
        } catch {
          // no-op
        }
      }
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handlePageHide);
      removeAllManagedPlotSeries();
      removeAllManagedDrawings();
      scriptsByInstanceId.clear();
      pendingSnapshotReadyByInstanceId.clear();
      emitScriptInstances();
      setScriptActionError(null);
      onScriptActionsReadyRef.current(NOOP_SCRIPT_ACTIONS);
      destroyCreatedSession(false);
    };
  }, [
    seriesKeyArg,
    instrumentToken,
    scriptsEnabled,
    transport,
    timeframe,
    addPlotSeries,
    clearCandles,
    onHeartbeat,
    onLiveCandle,
    onScriptActionError,
    onScriptActionsReady,
    onScriptInstancesChange,
    onStatus,
    onTick,
    onWsState,
    removePlotSeries,
    setCandles,
    setPlotPoint,
    setPlotPoints,
  ]);
}
