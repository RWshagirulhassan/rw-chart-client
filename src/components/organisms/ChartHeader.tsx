import * as React from "react";
import { Separator } from "@/components/ui/separator";
import { IconButton } from "@/components/atoms/IconButton";
import { StatPill } from "@/components/atoms/StatPill";
import { TimeframeMenu } from "@/components/molecules/TimeframeMenu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChartSpline, MoreHorizontal, Search } from "lucide-react";
import type { SearchResult } from "@/components/molecules/SearchBox";
import type { ChartRouteInstrument } from "@/app/chart/chartDomainTypes";
import type { ChartCandle } from "@/components/organisms/chart/model/chartTypes";
import { backendFetch } from "@/lib/runtimeConfig";
import type {
  ClientScriptLifecycle,
  ScriptCatalogDetailsItem,
  ScriptInstanceView,
} from "@/components/organisms/trading/scriptAttachUtils";

type ScriptFilter = "ALL" | "INDICATOR" | "STRATEGY";

export const ChartHeader: React.FC<{
  timeframe: string;
  setTimeframe: (v: string) => void;
  instrument: ChartRouteInstrument;
  liveCandle?: ChartCandle | null;
  onApplyScript: (script: ScriptCatalogDetailsItem) => void;
  scriptAttachEnabled: boolean;
  scriptInstances: ScriptInstanceView[];
}> = ({
  timeframe,
  setTimeframe,
  instrument,
  liveCandle,
  onApplyScript,
  scriptAttachEnabled,
  scriptInstances,
}) => {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [scriptsOpen, setScriptsOpen] = React.useState(false);
  const [scriptsQuery, setScriptsQuery] = React.useState("");
  const [scriptsFilter, setScriptsFilter] = React.useState<ScriptFilter>("ALL");
  const [scriptsOptions, setScriptsOptions] = React.useState<ScriptCatalogDetailsItem[]>([]);
  const [scriptsLoading, setScriptsLoading] = React.useState(false);
  const [scriptsError, setScriptsError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<SearchResult>({
    instrument_token: instrument.instrumentToken,
    name: instrument.tradingsymbol,
    tradingsymbol: instrument.tradingsymbol,
    exchange: instrument.exchange,
  });
  const cacheRef = React.useRef(new Map<string, SearchResult[]>());

  React.useEffect(() => {
    setSelected({
      instrument_token: instrument.instrumentToken,
      name: instrument.tradingsymbol,
      tradingsymbol: instrument.tradingsymbol,
      exchange: instrument.exchange,
    });
  }, [instrument.exchange, instrument.instrumentToken, instrument.tradingsymbol]);

  React.useEffect(() => {
    const q = query.trim();
    if (!searchOpen) {
      return;
    }
    if (!q) {
      setLoading(false);
      setOptions([]);
      return;
    }
    if (q.length < 2) {
      setLoading(false);
      setOptions([]);
      return;
    }

    const cacheKey = q.toLowerCase();
    const cached = cacheRef.current.get(cacheKey);
    if (cached) {
      setLoading(false);
      setOptions(cached);
      return;
    }

    const controller = new AbortController();
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const path = `/api/instruments/suggest?q=${encodeURIComponent(q)}&limit=20`;
        const res = await backendFetch(path, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as SearchResult[];
        cacheRef.current.set(cacheKey, data);
        setOptions(data);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          setOptions([]);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, searchOpen]);

  React.useEffect(() => {
    if (!scriptsOpen) {
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        setScriptsLoading(true);
        setScriptsError(null);
        const params = new URLSearchParams();
        if (scriptsFilter !== "ALL") {
          params.set("kind", scriptsFilter);
        }
        const trimmedQuery = scriptsQuery.trim();
        if (trimmedQuery.length > 0) {
          params.set("q", trimmedQuery);
        }
        params.set("limit", "100");
        params.set("offset", "0");
        const path = `/engine/scripts/catalog/details?${params.toString()}`;
        const res = await backendFetch(path, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as ScriptCatalogDetailsItem[];
        setScriptsOptions(Array.isArray(data) ? data : []);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          setScriptsOptions([]);
          setScriptsError("Failed to load scripts.");
        }
      } finally {
        setScriptsLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [scriptsFilter, scriptsOpen, scriptsQuery]);

  const selectedLabel = selected.tradingsymbol || selected.name || "Instrument";
  const selectedExchange = selected.exchange || "NSE";
  const fmt = (value?: number) =>
    Number.isFinite(value) ? Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "-";
  const closeAccent = liveCandle
    ? liveCandle.close >= liveCandle.open
      ? "up"
      : "down"
    : undefined;

  const lifecycleCountsByScriptId = React.useMemo(() => {
    const counts = new Map<string, Map<ClientScriptLifecycle, number>>();
    for (const instance of scriptInstances) {
      const perScript = counts.get(instance.scriptId) ?? new Map<ClientScriptLifecycle, number>();
      perScript.set(instance.lifecycle, (perScript.get(instance.lifecycle) ?? 0) + 1);
      counts.set(instance.scriptId, perScript);
    }
    return counts;
  }, [scriptInstances]);

  const lifecycleVariant = (value: ClientScriptLifecycle) => {
    if (value === "FAILED") {
      return "destructive" as const;
    }
    if (value === "ACTIVE") {
      return "default" as const;
    }
    return "outline" as const;
  };

  return (
    <div className="px-3 py-2 border space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-0 flex-wrap">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="text-sm font-medium flex gap-2 items-center px-2 h-8 rounded-md hover:bg-accent hover:text-accent-foreground"
          >
            <Search size={16} className="text-muted-foreground" />
            {selectedLabel} · {selectedExchange}
          </button>
          <Separator orientation="vertical" className="h-6" />
          <TimeframeMenu value={timeframe} onChange={setTimeframe} />
          <Separator orientation="vertical" className="h-6" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 h-8 text-muted-foreground"
            onClick={() => setScriptsOpen(true)}
          >
            <ChartSpline className="h-4 w-4" />
            Scripts
          </Button>
          <div className="hidden sm:flex items-center gap-3">
            <StatPill label="O" value={fmt(liveCandle?.open)} />
            <StatPill label="H" value={fmt(liveCandle?.high)} />
            <StatPill label="L" value={fmt(liveCandle?.low)} />
            <StatPill label="C" value={fmt(liveCandle?.close)} accent={closeAccent as "up" | "down" | undefined} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <IconButton aria-label="More">
            <MoreHorizontal className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      <Dialog
        open={scriptsOpen}
        onOpenChange={(next) => {
          setScriptsOpen(next);
          if (!next) {
            setScriptsQuery("");
            setScriptsFilter("ALL");
            setScriptsOptions([]);
            setScriptsError(null);
            setScriptsLoading(false);
          }
        }}
      >
        <DialogContent className="max-w-5xl p-0 gap-0 min-h-[60vh] h-[70vh] max-h-[80vh] flex flex-col rounded-none overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle>Scripts</DialogTitle>
          </DialogHeader>

          <div className="px-6 py-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={scriptsQuery}
                onChange={(event) => setScriptsQuery(event.target.value)}
                placeholder="Search scripts"
                className="pl-10 rounded-none"
              />
            </div>
            {!scriptAttachEnabled ? (
              <div className="text-xs text-muted-foreground mt-2">
                Script apply is enabled only after chart session is LIVE and WebSocket is OPEN.
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 grid grid-cols-1 md:grid-cols-[220px,1fr]">
            <aside className="border-r p-3">
              <div className="space-y-1">
                {[
                  { id: "ALL", label: "All scripts" },
                  { id: "INDICATOR", label: "Indicators only" },
                  { id: "STRATEGY", label: "Strategies only" },
                ].map((item) => {
                  const active = scriptsFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setScriptsFilter(item.id as ScriptFilter)}
                      className={[
                        "w-full text-left px-3 py-2 text-sm rounded-none border",
                        active
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-background hover:bg-accent/40 border-border",
                      ].join(" ")}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </aside>

            <ScrollArea className="min-h-0">
              <div className="divide-y">
                {scriptsLoading ? (
                  <div className="px-6 py-5 text-sm text-muted-foreground">
                    Loading scripts...
                  </div>
                ) : null}
                {!scriptsLoading && scriptsError ? (
                  <div className="px-6 py-5 text-sm text-destructive">
                    {scriptsError}
                  </div>
                ) : null}
                {!scriptsLoading && !scriptsError && scriptsOptions.length === 0 ? (
                  <div className="px-6 py-5 text-sm text-muted-foreground">
                    No scripts found.
                  </div>
                ) : null}
                {!scriptsLoading && !scriptsError && scriptsOptions.map((item) => (
                  <div
                    key={item.scriptId}
                    className="px-6 py-4 flex items-center justify-between hover:bg-accent/40"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{item.name}</div>
                      {item.description ? (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {item.description}
                        </div>
                      ) : null}
                      {(() => {
                        const counts = lifecycleCountsByScriptId.get(item.scriptId);
                        if (!counts || counts.size === 0) {
                          return null;
                        }
                        return (
                          <div className="mt-2 flex items-center gap-1 flex-wrap">
                            {Array.from(counts.entries()).map(([lifecycle, count]) => (
                              <Badge
                                key={`${item.scriptId}-${lifecycle}`}
                                variant={lifecycleVariant(lifecycle)}
                                className="text-[10px]"
                              >
                                {lifecycle}:{count}
                              </Badge>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Badge variant="secondary">{item.kind}</Badge>
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-none"
                        disabled={!scriptAttachEnabled}
                        onClick={() => onApplyScript(item)}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={searchOpen}
        onOpenChange={(next) => {
          setSearchOpen(next);
          if (!next) {
            setQuery("");
          }
        }}
      >
        <DialogContent className="max-w-4xl p-0 gap-0 min-h-[60vh] h-[70vh] max-h-[80vh] flex flex-col rounded-none overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b">
            <DialogTitle>Symbol Search</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Type symbol or company name"
                className="pl-10 rounded-none"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 min-h-0">
            <div className="divide-y">
              {loading ? (
                <div className="px-6 py-5 text-sm text-muted-foreground">
                  Searching...
                </div>
              ) : null}
              {!loading && query.trim().length === 0 ? (
                <div className="px-6 py-16 flex flex-col items-center justify-center text-center text-muted-foreground">
                  <div className="h-12 w-12 border border-border flex items-center justify-center mb-4">
                    <Search className="h-5 w-5" />
                  </div>
                  <div className="text-sm font-medium text-foreground">
                    Search for a symbol
                  </div>
                  <div className="text-xs mt-1">
                    Type company name or trading symbol to see matches.
                  </div>
                </div>
              ) : null}
              {!loading && query.trim().length >= 2 && options.length === 0 ? (
                <div className="px-6 py-5 text-sm text-muted-foreground">
                  No matching instruments.
                </div>
              ) : null}
              {!loading &&
              query.trim().length > 0 &&
              query.trim().length < 2 ? (
                <div className="px-6 py-5 text-sm text-muted-foreground">
                  Type at least 2 characters to search.
                </div>
              ) : null}
              {options.map((opt) => {
                const symbol = opt.tradingsymbol || opt.name;
                return (
                  <button
                    key={`${opt.exchange ?? "NA"}:${opt.instrument_token}`}
                    type="button"
                    onClick={() => {
                      setSelected(opt);
                      const ex = encodeURIComponent(opt.exchange ?? "NSE");
                      const sym = encodeURIComponent(
                        opt.tradingsymbol || opt.name || "UNKNOWN"
                      );
                      const token = encodeURIComponent(
                        opt.instrument_token || "0"
                      );
                      const nextPath = `/chart/${ex}/${sym}/${token}`;
                      if (window.location.pathname !== nextPath) {
                        window.history.pushState({}, "", nextPath);
                        window.dispatchEvent(new PopStateEvent("popstate"));
                      }
                      setSearchOpen(false);
                      setQuery("");
                    }}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-accent/50"
                  >
                    <div className="min-w-0">
                      <div className="text-base font-medium truncate">
                        {symbol}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {opt.name}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {opt.exchange ? (
                        <Badge variant="secondary">{opt.exchange}</Badge>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};
