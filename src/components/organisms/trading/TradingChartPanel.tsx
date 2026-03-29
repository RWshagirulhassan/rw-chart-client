"use client";

import * as React from "react";
import { Panel } from "@/components/atoms/Panel";
import { ChartHeader } from "@/components/organisms/ChartHeader";
import { AppliedScriptsOverlay } from "@/components/organisms/trading/AppliedScriptsOverlay";
import { TradeTicketOverlay } from "@/components/organisms/trading/TradeTicketOverlay";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChartProvider,
  MANUAL_SCOPE,
  useChartActions,
  useChartState,
} from "@/components/organisms/chart/context/chartStore";
import {
  TradingChart,
  type ChartPointerPoint,
} from "@/components/organisms/chart/TradingChart";
import type {
  ChartCandle,
  Drawing,
} from "@/components/organisms/chart/model/chartTypes";
import type { ChartRouteInstrument } from "@/app/chart/chartDomainTypes";
import {
  makeCircle,
  makeLine,
  makeRect,
  makeText,
  pt,
} from "@/components/organisms/chart/drawing/factories";
import {
  ManualDrawingToolkit,
  type SelectableManualTool,
} from "@/components/organisms/chart/ManualDrawingToolkit";
import {
  type ScriptCatalogDetailsItem,
  type ScriptInstanceView,
} from "@/components/organisms/trading/scriptAttachUtils";
import { useChartSeriesRuntime } from "@/components/organisms/chart/runtime/useChartSeriesRuntime";
import type { ScriptBridgeActions } from "@/components/organisms/chart/runtime/runtimeTypes";

type TradingChartPanelProps = {
  instrument: ChartRouteInstrument;
  panelClassName?: string;
  cardClassName?: string;
  cardContentClassName?: string;
  chartWrapperClassName?: string;
  onAlertTriggered?: (message: string) => void;
};

const NOOP_SCRIPT_ACTIONS: ScriptBridgeActions = {
  attachScriptFromCatalog: () => {},
  detachScriptInstance: () => {},
  replaceScriptInstance: async () => {},
};

const ChartSessionBridge: React.FC<{
  instrumentToken: string;
  timeframe: string;
  onStatus: (status: string) => void;
  onWsState: (state: string) => void;
  onHeartbeat: (state: string) => void;
  onTick: (price: string, at: string) => void;
  onLiveCandle: (candle: ChartCandle | null) => void;
  onScriptAlert: (message: string) => void;
  onScriptActionsReady: (actions: ScriptBridgeActions) => void;
  onScriptInstancesChange: (items: ScriptInstanceView[]) => void;
  onScriptActionError: (error: string | null) => void;
}> = ({
  instrumentToken,
  timeframe,
  onStatus,
  onWsState,
  onHeartbeat,
  onTick,
  onLiveCandle,
  onScriptAlert,
  onScriptActionsReady,
  onScriptInstancesChange,
  onScriptActionError,
}) => {
  useChartSeriesRuntime({
    instrumentToken,
    timeframe,
    scriptsEnabled: true,
    onStatus,
    onWsState,
    onHeartbeat,
    onTick,
    onLiveCandle,
    onScriptAlert,
    onScriptActionsReady,
    onScriptInstancesChange,
    onScriptActionError,
  });

  return null;
};

type ManualDraftState =
  | {
      tool: "line" | "rect" | "circle";
      first: ChartPointerPoint;
    }
  | null;

const ChartCanvasContent: React.FC<{
  instrument: ChartRouteInstrument;
  timeframe: string;
  currentTradePrice: number | null;
  chartWrapperClassName?: string;
  scriptInstances: ScriptInstanceView[];
  scriptActionError: string | null;
  onDetachScript: (scriptInstanceId: string) => void;
  onReplaceScript: (
    scriptInstanceId: string,
    params: Record<string, unknown>,
  ) => Promise<void>;
  sessionStatus: string;
  wsState: string;
  heartbeat: string;
  lastTickPrice: string;
  lastTickAt: string;
}> = ({
  instrument,
  timeframe,
  currentTradePrice,
  chartWrapperClassName,
  scriptInstances,
  scriptActionError,
  onDetachScript,
  onReplaceScript,
  sessionStatus,
  wsState,
  heartbeat,
  lastTickPrice,
  lastTickAt,
}) => {
  const { upsertScopeDrawing, removeScopeDrawing } = useChartActions();
  const { drawingsByScope } = useChartState();
  const manualDrawingsById = drawingsByScope[MANUAL_SCOPE] ?? {};
  const [activeTool, setActiveTool] = React.useState<SelectableManualTool>("line");
  const [draft, setDraft] = React.useState<ManualDraftState>(null);
  const manualDrawingOrderRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    const existingIds = new Set(Object.keys(manualDrawingsById));
    manualDrawingOrderRef.current = manualDrawingOrderRef.current.filter((id) =>
      existingIds.has(id),
    );
  }, [manualDrawingsById]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDraft(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const rememberManualDrawing = React.useCallback((drawing: Drawing) => {
    manualDrawingOrderRef.current = [
      ...manualDrawingOrderRef.current.filter((id) => id !== drawing.id),
      drawing.id,
    ];
  }, []);

  const addManualDrawing = React.useCallback(
    (drawing: Drawing) => {
      upsertScopeDrawing(MANUAL_SCOPE, drawing);
      rememberManualDrawing(drawing);
    },
    [rememberManualDrawing, upsertScopeDrawing],
  );

  const deleteLatestManualDrawing = React.useCallback(() => {
    const nextOrder = [...manualDrawingOrderRef.current];
    const latest = nextOrder.pop();
    if (!latest) {
      return;
    }
    manualDrawingOrderRef.current = nextOrder;
    removeScopeDrawing(MANUAL_SCOPE, latest);
    setDraft(null);
  }, [removeScopeDrawing]);

  const handleToolSelect = React.useCallback((tool: SelectableManualTool) => {
    setActiveTool(tool);
    setDraft(null);
  }, []);

  const handleChartClick = React.useCallback(
    (point: ChartPointerPoint) => {
      if (activeTool === "text") {
        addManualDrawing(
          makeText({
            p: pt(point.time, point.price),
            text: "Note",
          }),
        );
        return;
      }

      if (!draft || draft.tool !== activeTool) {
        setDraft({
          tool: activeTool,
          first: point,
        });
        return;
      }

      const first = pt(draft.first.time, draft.first.price);
      const second = pt(point.time, point.price);

      if (activeTool === "line") {
        addManualDrawing(
          makeLine({
            p1: first,
            p2: second,
          }),
        );
      } else if (activeTool === "rect") {
        addManualDrawing(
          makeRect({
            p1: first,
            p2: second,
          }),
        );
      } else if (activeTool === "circle") {
        addManualDrawing(
          makeCircle({
            center: first,
            edge: second,
          }),
        );
      }

      setDraft(null);
    },
    [activeTool, addManualDrawing, draft],
  );

  const canDeleteManualDrawing = Object.keys(manualDrawingsById).length > 0;

  return (
    <div
      className={`relative flex-1 min-h-0 h-full w-full ${
        chartWrapperClassName ?? ""
      }`.trim()}
    >
      <TradingChart timeframe={timeframe} onChartClick={handleChartClick} />
      <ManualDrawingToolkit
        activeTool={activeTool}
        hasDraft={draft != null}
        canDelete={canDeleteManualDrawing}
        onSelectTool={handleToolSelect}
        onDeleteLatest={deleteLatestManualDrawing}
        onCancelDraft={() => setDraft(null)}
      />
      <TradeTicketOverlay instrument={instrument} currentPrice={currentTradePrice} />
      <AppliedScriptsOverlay
        scriptInstances={scriptInstances}
        scriptActionError={scriptActionError}
        onDetachScript={onDetachScript}
        onReplaceScript={onReplaceScript}
      />
      <div className="absolute right-2 top-2 text-[10px] text-muted-foreground bg-background/80 px-2 py-1 border space-y-1 min-w-[160px]">
        <div>SESSION: {sessionStatus}</div>
        <div>WS: {wsState}</div>
        <div>HEARTBEAT: {heartbeat}</div>
        <div>TICK: {lastTickPrice}</div>
        <div>AT: {lastTickAt}</div>
      </div>
    </div>
  );
};

export const TradingChartPanel: React.FC<TradingChartPanelProps> = ({
  instrument,
  panelClassName,
  cardClassName,
  cardContentClassName,
  chartWrapperClassName,
  onAlertTriggered,
}) => {
  const [timeframe, setTimeframe] = React.useState("1D");
  const [sessionStatus, setSessionStatus] = React.useState("IDLE");
  const [wsState, setWsState] = React.useState("CONNECTING");
  const [heartbeat, setHeartbeat] = React.useState("WAITING");
  const [lastTickPrice, setLastTickPrice] = React.useState("-");
  const [lastTickAt, setLastTickAt] = React.useState("-");
  const [liveCandle, setLiveCandle] = React.useState<ChartCandle | null>(null);
  const [scriptInstances, setScriptInstances] = React.useState<
    ScriptInstanceView[]
  >([]);
  const [scriptActionError, setScriptActionError] = React.useState<
    string | null
  >(null);
  const bridgeActionsRef =
    React.useRef<ScriptBridgeActions>(NOOP_SCRIPT_ACTIONS);

  const handleStatus = React.useCallback((status: string) => {
    setSessionStatus(status);
  }, []);
  const handleWsState = React.useCallback((state: string) => {
    setWsState(state);
  }, []);
  const handleHeartbeat = React.useCallback((state: string) => {
    setHeartbeat(state);
  }, []);
  const handleTick = React.useCallback((price: string, at: string) => {
    setLastTickPrice(price);
    setLastTickAt(at);
  }, []);
  const handleScriptActionsReady = React.useCallback(
    (actions: ScriptBridgeActions) => {
      bridgeActionsRef.current = actions;
    },
    [],
  );
  const handleScriptInstancesChange = React.useCallback(
    (items: ScriptInstanceView[]) => {
      setScriptInstances(items);
    },
    [],
  );
  const handleScriptActionError = React.useCallback((error: string | null) => {
    setScriptActionError(error);
  }, []);
  const handleScriptAlert = React.useCallback((message: string) => {
    onAlertTriggered?.(message);
  }, [onAlertTriggered]);
  const handleApplyScript = React.useCallback(
    (script: ScriptCatalogDetailsItem) => {
      bridgeActionsRef.current.attachScriptFromCatalog(script);
    },
    [],
  );
  const handleDetachScript = React.useCallback((scriptInstanceId: string) => {
    bridgeActionsRef.current.detachScriptInstance(scriptInstanceId);
  }, []);
  const handleReplaceScript = React.useCallback(
    async (scriptInstanceId: string, params: Record<string, unknown>) => {
      await bridgeActionsRef.current.replaceScriptInstance(
        scriptInstanceId,
        params,
      );
    },
    [],
  );
  const scriptAttachEnabled = sessionStatus === "LIVE" && wsState === "OPEN";
  const currentTradePrice = React.useMemo(() => {
    if (liveCandle && Number.isFinite(liveCandle.close)) {
      return liveCandle.close;
    }
    const parsed = Number(lastTickPrice);
    return Number.isFinite(parsed) ? parsed : null;
  }, [lastTickPrice, liveCandle]);

  return (
    <Panel
      className={`min-h-0 flex border-1 border-black flex-col ${
        panelClassName ?? ""
      }`.trim()}
    >
      <ChartHeader
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        instrument={instrument}
        liveCandle={liveCandle}
        onApplyScript={handleApplyScript}
        scriptAttachEnabled={scriptAttachEnabled}
        scriptInstances={scriptInstances}
      />

      <Card
        className={`m-3 flex-1 min-h-0 overflow-hidden ${
          cardClassName ?? ""
        }`.trim()}
      >
        <CardContent
          className={`h-full min-h-0 p-0 flex ${
            cardContentClassName ?? ""
          }`.trim()}
        >
          <ChartProvider initialCandles={[]}>
            <ChartSessionBridge
              instrumentToken={instrument.instrumentToken}
              timeframe={timeframe}
              onStatus={handleStatus}
              onWsState={handleWsState}
              onHeartbeat={handleHeartbeat}
              onTick={handleTick}
              onLiveCandle={setLiveCandle}
              onScriptAlert={handleScriptAlert}
              onScriptActionsReady={handleScriptActionsReady}
              onScriptInstancesChange={handleScriptInstancesChange}
              onScriptActionError={handleScriptActionError}
            />
            <ChartCanvasContent
              instrument={instrument}
              timeframe={timeframe}
              currentTradePrice={currentTradePrice}
              chartWrapperClassName={chartWrapperClassName}
              scriptInstances={scriptInstances}
              scriptActionError={scriptActionError}
              onDetachScript={handleDetachScript}
              onReplaceScript={handleReplaceScript}
              sessionStatus={sessionStatus}
              wsState={wsState}
              heartbeat={heartbeat}
              lastTickPrice={lastTickPrice}
              lastTickAt={lastTickAt}
            />
          </ChartProvider>
        </CardContent>
      </Card>
    </Panel>
  );
};

export type { TradingChartPanelProps };
