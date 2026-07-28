import * as React from "react";
import {
  buildSeriesKey,
  mapIntervalKindToUiTimeframe,
  mapUiTimeframeToIntervalKind,
  normalizeUiTimeframe,
  parseSeriesKey,
} from "@/app/chart/intervalKindMap";
import type { ChartRouteInstrument } from "@/app/chart/chartDomainTypes";
import { StatPill } from "@/components/atoms/StatPill";
// import { TimeframeMenu } from "@/components/molecules/TimeframeMenu";
import { ChartLoadingSkeleton } from "@/components/organisms/chart/ChartLoadingSkeleton";
import { TradingChart } from "@/components/organisms/chart/TradingChart";
import {
  ChartProvider,
  useChartState,
} from "@/components/organisms/chart/context/chartStore";
import { EmbedDrawingBridge } from "@/components/organisms/chart/embed/EmbedDrawingBridge";
import { makeErrorEnvelope } from "@/components/organisms/chart/embed/embedProtocol";
import type { ChartCandle } from "@/components/organisms/chart/model/chartTypes";
import { useChartSeriesRuntime } from "@/components/organisms/chart/runtime/useChartSeriesRuntime";
import type { ScriptBridgeActions } from "@/components/organisms/chart/runtime/runtimeTypes";
import { AppliedScriptsOverlay } from "@/components/organisms/trading/AppliedScriptsOverlay";
import { BackendIndicatorPicker } from "@/components/organisms/trading/BackendIndicatorPicker";
import type {
  ScriptCatalogDetailsItem,
  ScriptInstanceView,
} from "@/components/organisms/trading/scriptAttachUtils";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { backendFetch } from "@/lib/runtimeConfig";

const NOOP_SCRIPT_ACTIONS: ScriptBridgeActions = {
  attachScriptFromCatalog: () => {},
  detachScriptInstance: () => {},
  replaceScriptInstance: async () => {},
};

function postEmbedError(message: string) {
  try {
    if (window.parent) {
      window.parent.postMessage(
        makeErrorEnvelope("INVALID_PAYLOAD", message),
        "*",
      );
    }
  } catch {
    // no-op
  }
}

type ParsedEmbedRequest =
  | {
      ok: true;
      mode: "direct";
      instrument: ChartRouteInstrument;
      timeframe: string;
    }
  | {
      ok: true;
      mode: "symbolId";
      symbolId: string;
      timeframe: string;
    }
  | {
      ok: false;
      error: string;
    };

type ResolvedEmbedConfig =
  | {
      status: "loading";
    }
  | {
      status: "ready";
      instrument: ChartRouteInstrument;
      timeframe: string;
      source: "direct" | "symbolId";
      symbolId?: string;
    }
  | {
      status: "error";
      error: string;
    };

type InstrumentLookupResponse = {
  instrument_token: string;
  name: string;
  tradingsymbol?: string;
  exchange?: string;
};

function normalizeTimeframe(value: string | null): string | null {
  return normalizeUiTimeframe(value);
}

function resolveRequestedTimeframe(
  params: URLSearchParams,
  fallback = "1D",
): { ok: true; timeframe: string } | { ok: false; error: string } {
  const timeframeParam = normalizeTimeframe(params.get("timeframe"));
  if (timeframeParam) {
    if (!mapUiTimeframeToIntervalKind(timeframeParam)) {
      return {
        ok: false,
        error: `Unsupported timeframe ${timeframeParam}.`,
      };
    }
    return {
      ok: true,
      timeframe: timeframeParam,
    };
  }

  const intervalKind = params.get("intervalKind")?.trim();
  if (intervalKind) {
    const timeframe = mapIntervalKindToUiTimeframe(intervalKind);
    if (!timeframe) {
      return {
        ok: false,
        error: `Unsupported intervalKind ${intervalKind}.`,
      };
    }
    return {
      ok: true,
      timeframe,
    };
  }

  return {
    ok: true,
    timeframe: fallback,
  };
}

function resolveEmbedRequest(search: string): ParsedEmbedRequest {
  const params = new URLSearchParams(search);
  const seriesKeyParam = params.get("seriesKey");
  const instrumentToken = params.get("instrumentToken")?.trim();
  const symbolId = params.get("symbolId")?.trim() || null;
  const exchangeParam = params.get("exchange")?.trim().toUpperCase();

  const hasSeriesKey = Boolean(seriesKeyParam?.trim());
  const hasInstrumentToken = Boolean(instrumentToken);
  const hasSymbolId = Boolean(symbolId);

  if (
    [hasSeriesKey, hasInstrumentToken, hasSymbolId].filter(Boolean).length > 1
  ) {
    return {
      ok: false,
      error: "Provide exactly one of seriesKey, instrumentToken, or symbolId.",
    };
  }

  if (!hasSeriesKey && !hasInstrumentToken && !hasSymbolId) {
    return {
      ok: false,
      error:
        "Missing params. Use symbolId, seriesKey, or instrumentToken with timeframe/intervalKind.",
    };
  }

  if (hasSeriesKey) {
    const parsed = parseSeriesKey(seriesKeyParam);
    if (!parsed) {
      return {
        ok: false,
        error:
          "Invalid seriesKey. Expected <instrumentToken@INTERVAL_KIND> with supported interval kind.",
      };
    }
    const timeframe = mapIntervalKindToUiTimeframe(parsed.intervalKind);
    if (!timeframe) {
      return {
        ok: false,
        error: `Unsupported interval kind ${parsed.intervalKind}.`,
      };
    }
    return {
      ok: true,
      mode: "direct",
      instrument: {
        exchange: exchangeParam || "NSE",
        tradingsymbol:
          params.get("displaySymbol")?.trim() ||
          params.get("symbol")?.trim() ||
          parsed.instrumentToken,
        instrumentToken: `${parsed.instrumentToken}`,
      },
      timeframe,
    };
  }

  const timeframeResult = resolveRequestedTimeframe(params, "1D");
  if ("error" in timeframeResult) {
    return {
      ok: false,
      error: timeframeResult.error,
    };
  }

  if (hasSymbolId) {
    if (exchangeParam && exchangeParam !== "NSE") {
      return {
        ok: false,
        error: "symbolId embed currently supports NSE instruments only.",
      };
    }
    return {
      ok: true,
      mode: "symbolId",
      symbolId: symbolId,
      timeframe: timeframeResult.timeframe,
    };
  }

  return {
    ok: true,
    mode: "direct",
    instrument: {
      exchange: exchangeParam || "NSE",
      tradingsymbol:
        params.get("displaySymbol")?.trim() ||
        params.get("symbol")?.trim() ||
        instrumentToken!,
      instrumentToken: instrumentToken!,
    },
    timeframe: timeframeResult.timeframe,
  };
}

const EmbedChartHeader: React.FC<{
  instrument: ChartRouteInstrument;
  liveCandle: ChartCandle | null;
  volumeHistogramEnabled: boolean;
  setVolumeHistogramEnabled: (value: boolean) => void;
  indicatorAttachEnabled: boolean;
  scriptInstances: ScriptInstanceView[];
  onApplyIndicator: (indicator: ScriptCatalogDetailsItem) => void;
  // Re-enable with the commented TimeframeMenu below.
  // timeframe: string;
  // onTimeframeChange: (value: string) => void;
}> = ({
  instrument,
  liveCandle,
  volumeHistogramEnabled,
  setVolumeHistogramEnabled,
  indicatorAttachEnabled,
  scriptInstances,
  onApplyIndicator,
}) => {
  const fmtPrice = (value?: number) =>
    Number.isFinite(value)
      ? Number(value).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "-";
  const fmtVolume = (value?: number) =>
    Number.isFinite(value)
      ? Number(value).toLocaleString(undefined, {
          maximumFractionDigits: 0,
        })
      : "-";
  const closeAccent = liveCandle
    ? liveCandle.close >= liveCandle.open
      ? "up"
      : "down"
    : undefined;

  return (
    <div className="border-b bg-background px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-sm font-semibold text-foreground">
            {instrument.tradingsymbol}
          </div>
          <Badge variant="secondary">{instrument.exchange}</Badge>
        </div>
        {/* <TimeframeMenu value={timeframe} onChange={onTimeframeChange} /> */}
        <div className="flex flex-wrap items-center gap-3 sm:ml-auto">
          <Select
            value={volumeHistogramEnabled ? "on" : "off"}
            onValueChange={(value) => setVolumeHistogramEnabled(value === "on")}
          >
            <SelectTrigger className="h-8 rounded-none px-2 text-xs shadow-none">
              Volume: {volumeHistogramEnabled ? "On" : "Off"}
            </SelectTrigger>
            <SelectContent align="end" className="rounded-none">
              <SelectItem value="off">Volume Off</SelectItem>
              <SelectItem value="on">Volume On</SelectItem>
            </SelectContent>
          </Select>
          <BackendIndicatorPicker
            attachEnabled={indicatorAttachEnabled}
            scriptInstances={scriptInstances}
            onApply={onApplyIndicator}
          />
          <StatPill label="O" value={fmtPrice(liveCandle?.open)} />
          <StatPill label="H" value={fmtPrice(liveCandle?.high)} />
          <StatPill label="L" value={fmtPrice(liveCandle?.low)} />
          <StatPill
            label="C"
            value={fmtPrice(liveCandle?.close)}
            accent={closeAccent as "up" | "down" | undefined}
          />
          <StatPill label="V" value={fmtVolume(liveCandle?.volume)} />
        </div>
      </div>
    </div>
  );
};

const EmbedRuntimeSurface: React.FC<{
  instrument: ChartRouteInstrument;
  timeframe: string;
  // onTimeframeChange: (value: string) => void;
}> = ({ instrument, timeframe }) => {
  const [liveCandle, setLiveCandle] = React.useState<ChartCandle | null>(null);
  const [sessionStatus, setSessionStatus] = React.useState("IDLE");
  const [wsState, setWsState] = React.useState("CONNECTING");
  const [volumeHistogramEnabled, setVolumeHistogramEnabled] = React.useState(false);
  const [scriptInstances, setScriptInstances] = React.useState<
    ScriptInstanceView[]
  >([]);
  const [scriptActionError, setScriptActionError] = React.useState<
    string | null
  >(null);
  const scriptActionsRef =
    React.useRef<ScriptBridgeActions>(NOOP_SCRIPT_ACTIONS);
  const handleScriptActionsReady = React.useCallback(
    (actions: ScriptBridgeActions) => {
      scriptActionsRef.current = actions;
    },
    [],
  );
  const seriesKey = React.useMemo(
    () => buildSeriesKey(instrument.instrumentToken, timeframe),
    [instrument.instrumentToken, timeframe],
  );

  useChartSeriesRuntime({
    instrumentToken: instrument.instrumentToken,
    timeframe,
    scriptsEnabled: true,
    onStatus: setSessionStatus,
    onWsState: setWsState,
    onLiveCandle: setLiveCandle,
    onScriptActionsReady: handleScriptActionsReady,
    onScriptInstancesChange: setScriptInstances,
    onScriptActionError: setScriptActionError,
  });

  const handleApplyIndicator = React.useCallback(
    (indicator: ScriptCatalogDetailsItem) => {
      scriptActionsRef.current.attachScriptFromCatalog(indicator);
    },
    [],
  );
  const handleDetachIndicator = React.useCallback(
    (scriptInstanceId: string) => {
      scriptActionsRef.current.detachScriptInstance(scriptInstanceId);
    },
    [],
  );
  const handleReplaceIndicator = React.useCallback(
    async (scriptInstanceId: string, params: Record<string, unknown>) => {
      await scriptActionsRef.current.replaceScriptInstance(
        scriptInstanceId,
        params,
      );
    },
    [],
  );
  const indicatorAttachEnabled =
    sessionStatus === "LIVE" && wsState === "OPEN";

  if (!seriesKey) {
    return (
      <div className="h-full w-full bg-background text-foreground flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-lg font-semibold">Invalid timeframe</div>
          <div className="text-sm text-muted-foreground mt-2">
            Unsupported timeframe {timeframe}.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col bg-background">
      {/* Re-enable props with the commented lines kept below:
          timeframe={timeframe}
          onTimeframeChange={onTimeframeChange}
      */}
      <EmbedChartHeader
        instrument={instrument}
        liveCandle={liveCandle}
        volumeHistogramEnabled={volumeHistogramEnabled}
        setVolumeHistogramEnabled={setVolumeHistogramEnabled}
        indicatorAttachEnabled={indicatorAttachEnabled}
        scriptInstances={scriptInstances}
        onApplyIndicator={handleApplyIndicator}
      />
      <EmbedChartCanvas
        timeframe={timeframe}
        seriesKey={seriesKey}
        sessionStatus={sessionStatus}
        volumeHistogramEnabled={volumeHistogramEnabled}
        scriptInstances={scriptInstances}
        scriptActionError={scriptActionError}
        onDetachIndicator={handleDetachIndicator}
        onReplaceIndicator={handleReplaceIndicator}
      />
    </div>
  );
};

const EmbedChartCanvas: React.FC<{
  timeframe: string;
  seriesKey: string;
  sessionStatus: string;
  volumeHistogramEnabled: boolean;
  scriptInstances: ScriptInstanceView[];
  scriptActionError: string | null;
  onDetachIndicator: (scriptInstanceId: string) => void;
  onReplaceIndicator: (
    scriptInstanceId: string,
    params: Record<string, unknown>,
  ) => Promise<void>;
}> = ({
  timeframe,
  seriesKey,
  sessionStatus,
  volumeHistogramEnabled,
  scriptInstances,
  scriptActionError,
  onDetachIndicator,
  onReplaceIndicator,
}) => {
  const { candles } = useChartState();
  const isLoading =
    candles.length === 0 &&
    (sessionStatus === "IDLE" ||
      sessionStatus === "CONNECTING" ||
      sessionStatus === "WS_CONNECTED" ||
      sessionStatus === "BOOTSTRAPPING" ||
      sessionStatus === "REBUILDING");

  return (
    <div className="relative min-h-0 flex-1">
      <TradingChart
        timeframe={timeframe}
        showVolumeHistogram={volumeHistogramEnabled}
      />
      {isLoading ? (
        <ChartLoadingSkeleton
          message={
            sessionStatus === "REBUILDING"
              ? "Rebuilding chart history..."
              : "Loading chart candles..."
          }
        />
      ) : null}
      <AppliedScriptsOverlay
        scriptInstances={scriptInstances}
        scriptActionError={scriptActionError}
        onDetachScript={onDetachIndicator}
        onReplaceScript={onReplaceIndicator}
      />
      <EmbedDrawingBridge seriesKey={seriesKey} />
    </div>
  );
};

export default function EmbedChartPage() {
  const [search, setSearch] = React.useState(() =>
    typeof window === "undefined" ? "" : window.location.search,
  );

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const onPopState = () => {
      setSearch(window.location.search);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const request = React.useMemo(() => resolveEmbedRequest(search), [search]);
  const [config, setConfig] = React.useState<ResolvedEmbedConfig>(() => {
    if (request.ok === false) {
      return {
        status: "error",
        error: request.error,
      };
    }
    if (request.mode === "direct") {
      return {
        status: "ready",
        instrument: request.instrument,
        timeframe: request.timeframe,
        source: "direct",
      };
    }
    return { status: "loading" };
  });

  React.useEffect(() => {
    if (request.ok === false) {
      setConfig({
        status: "error",
        error: request.error,
      });
      return;
    }

    if (request.mode === "direct") {
      setConfig({
        status: "ready",
        instrument: request.instrument,
        timeframe: request.timeframe,
        source: "direct",
      });
      return;
    }

    const controller = new AbortController();
    setConfig({ status: "loading" });

    void (async () => {
      try {
        const path = `/api/instruments/by-symbol?symbol=${encodeURIComponent(
          request.symbolId,
        )}&exchange=NSE`;
        const res = await backendFetch(path, { signal: controller.signal });
        if (res.status === 404) {
          throw new Error(
            `No NSE instrument found for symbolId ${request.symbolId}.`,
          );
        }
        if (!res.ok) {
          throw new Error(`Instrument lookup failed (${res.status}).`);
        }
        const data = (await res.json()) as InstrumentLookupResponse;
        const instrumentToken = data.instrument_token?.trim();
        if (!instrumentToken) {
          throw new Error(
            `Missing instrument token for symbolId ${request.symbolId}.`,
          );
        }
        setConfig({
          status: "ready",
          instrument: {
            exchange: data.exchange?.trim() || "NSE",
            tradingsymbol: data.tradingsymbol?.trim() || request.symbolId,
            instrumentToken,
          },
          timeframe: request.timeframe,
          source: "symbolId",
          symbolId: request.symbolId,
        });
      } catch (error: unknown) {
        if ((error as { name?: string } | null)?.name === "AbortError") {
          return;
        }
        setConfig({
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "Failed to resolve embed symbol.",
        });
      }
    })();

    return () => controller.abort();
  }, [request]);

  React.useEffect(() => {
    if (config.status === "error") {
      postEmbedError(config.error);
    }
  }, [config]);

  /*
  const handleTimeframeChange = React.useCallback(
    (nextTimeframe: string) => {
      if (typeof window === "undefined" || config.status !== "ready") {
        return;
      }

      const params = new URLSearchParams(window.location.search);
      params.delete("seriesKey");
      params.delete("intervalKind");
      params.set("timeframe", nextTimeframe);

      if (config.source === "symbolId" && config.symbolId) {
        params.set("symbolId", config.symbolId);
        params.delete("instrumentToken");
        params.delete("exchange");
        params.delete("displaySymbol");
        params.delete("symbol");
      } else {
        params.set("instrumentToken", config.instrument.instrumentToken);
        params.set("exchange", config.instrument.exchange || "NSE");
        params.set("displaySymbol", config.instrument.tradingsymbol);
      }

      const nextSearch = `?${params.toString()}`;
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${nextSearch}`,
      );
      setSearch(nextSearch);
    },
    [config],
  );
  */

  if (config.status === "loading") {
    return (
      <div className="h-screen w-full bg-background text-foreground flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-lg font-semibold">Loading embedded chart</div>
          <div className="text-sm text-muted-foreground mt-2">
            Resolving instrument and starting chart session.
          </div>
        </div>
      </div>
    );
  }

  if (config.status === "error") {
    return (
      <div className="h-screen w-full bg-background text-foreground flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-lg font-semibold">
            Invalid embed configuration
          </div>
          <div className="text-sm text-muted-foreground mt-2">
            {config.error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full overflow-hidden bg-background">
      <ChartProvider initialCandles={[]}>
        {/* Re-enable prop with: onTimeframeChange={handleTimeframeChange} */}
        <EmbedRuntimeSurface
          instrument={config.instrument}
          timeframe={config.timeframe}
        />
      </ChartProvider>
    </div>
  );
}
