import * as React from "react";
import {
  buildSeriesKeyFromIntervalKind,
  mapIntervalKindToUiTimeframe,
  parseSeriesKey,
} from "@/app/chart/intervalKindMap";
import { TradingChart } from "@/components/organisms/chart/TradingChart";
import { ChartProvider } from "@/components/organisms/chart/context/chartStore";
import { EmbedDrawingBridge } from "@/components/organisms/chart/embed/EmbedDrawingBridge";
import { makeErrorEnvelope } from "@/components/organisms/chart/embed/embedProtocol";
import { useChartSeriesRuntime } from "@/components/organisms/chart/runtime/useChartSeriesRuntime";

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

type ResolvedEmbedConfig =
  | {
      ok: true;
      seriesKey: string;
      timeframe: string;
    }
  | {
      ok: false;
      error: string;
    };

function resolveEmbedConfig(search: string): ResolvedEmbedConfig {
  const params = new URLSearchParams(search);
  const seriesKeyParam = params.get("seriesKey");
  const instrumentToken = params.get("instrumentToken");
  const intervalKind = params.get("intervalKind");

  const hasSeriesKey = Boolean(seriesKeyParam?.trim());
  const hasFallback = Boolean(instrumentToken?.trim() || intervalKind?.trim());

  if (hasSeriesKey && hasFallback) {
    return {
      ok: false,
      error:
        "Provide either seriesKey or instrumentToken+intervalKind, not both.",
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
      seriesKey: `${parsed.instrumentToken}@${parsed.intervalKind}`,
      timeframe,
    };
  }

  if (!instrumentToken || !intervalKind) {
    return {
      ok: false,
      error:
        "Missing params. Use seriesKey or instrumentToken+intervalKind query params.",
    };
  }

  const nextSeriesKey = buildSeriesKeyFromIntervalKind(instrumentToken, intervalKind);
  if (!nextSeriesKey) {
    return {
      ok: false,
      error: `Unsupported intervalKind ${intervalKind}.`,
    };
  }
  const timeframe = mapIntervalKindToUiTimeframe(intervalKind);
  if (!timeframe) {
    return {
      ok: false,
      error: `Unsupported intervalKind ${intervalKind}.`,
    };
  }
  return {
    ok: true,
    seriesKey: nextSeriesKey,
    timeframe,
  };
}

const EmbedRuntimeSurface: React.FC<{ seriesKey: string; timeframe: string }> = ({
  seriesKey,
  timeframe,
}) => {
  const [status, setStatus] = React.useState("IDLE");
  const [wsState, setWsState] = React.useState("CONNECTING");

  useChartSeriesRuntime({
    seriesKey,
    timeframe,
    scriptsEnabled: false,
    onStatus: setStatus,
    onWsState: setWsState,
  });

  return (
    <div className="relative h-full w-full bg-background">
      <TradingChart />
      <EmbedDrawingBridge seriesKey={seriesKey} />
      <div className="absolute right-2 top-2 text-[10px] text-muted-foreground bg-background/80 px-2 py-1 border space-y-1 min-w-[140px]">
        <div>SESSION: {status}</div>
        <div>WS: {wsState}</div>
      </div>
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

  const config = React.useMemo(() => resolveEmbedConfig(search), [search]);

  React.useEffect(() => {
    if ("error" in config) {
      postEmbedError(config.error);
    }
  }, [config]);

  if ("error" in config) {
    return (
      <div className="h-screen w-full bg-background text-foreground flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-lg font-semibold">Invalid embed configuration</div>
          <div className="text-sm text-muted-foreground mt-2">{config.error}</div>
        </div>
      </div>
    );
  }

  const { seriesKey, timeframe } = config;

  return (
    <div className="h-screen w-full overflow-hidden bg-background">
      <ChartProvider initialCandles={[]}>
        <EmbedRuntimeSurface seriesKey={seriesKey} timeframe={timeframe} />
      </ChartProvider>
    </div>
  );
}
