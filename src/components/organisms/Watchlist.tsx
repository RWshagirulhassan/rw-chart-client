import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "@/components/atoms/Panel";
import { SearchBox, type SearchResult } from "@/components/molecules/SearchBox";
import { WatchItem } from "@/components/molecules/WatchItem";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { backendFetch } from "@/lib/runtimeConfig";
import { Separator } from "@radix-ui/react-separator";

type WatchlistInstrument = {
  instrumentToken: string;
  exchange: string;
  tradingsymbol: string;
  name: string;
  change?: number;
  price?: number;
};

const WATCHLIST_TABS = ["1", "2", "3", "4", "5", "6", "7"] as const;
type WatchlistTabId = (typeof WATCHLIST_TABS)[number];
type WatchlistsByTab = Record<WatchlistTabId, WatchlistInstrument[]>;

const WATCHLIST_STORAGE_KEY = "trading_watchlists_v2";
const LEGACY_WATCHLIST_STORAGE_KEY = "trading_watchlist_v1";
const WATCHLIST_MAX_ITEMS = 250;

function createEmptyWatchlists(): WatchlistsByTab {
  return {
    "1": [],
    "2": [],
    "3": [],
    "4": [],
    "5": [],
    "6": [],
    "7": [],
  };
}

function normalizeStoredInstrument(value: unknown): WatchlistInstrument | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const instrumentToken =
    typeof candidate.instrumentToken === "string"
      ? candidate.instrumentToken.trim()
      : typeof candidate.instrument_token === "string"
        ? candidate.instrument_token.trim()
      : "";
  const exchange =
    typeof candidate.exchange === "string" ? candidate.exchange.trim() : "NSE";
  const tradingsymbol =
    typeof candidate.tradingsymbol === "string"
      ? candidate.tradingsymbol.trim()
      : typeof candidate.symbol === "string"
        ? candidate.symbol.trim()
      : "";
  const name =
    typeof candidate.name === "string" ? candidate.name.trim() : tradingsymbol;

  if (!instrumentToken || !exchange || !tradingsymbol) {
    return null;
  }

  return {
    instrumentToken,
    exchange,
    tradingsymbol,
    name: name || tradingsymbol,
    change: typeof candidate.change === "number" ? candidate.change : undefined,
    price: typeof candidate.price === "number" ? candidate.price : undefined,
  };
}

function loadWatchlistFromStorage(): WatchlistsByTab {
  if (typeof window === "undefined") {
    return createEmptyWatchlists();
  }

  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const watchlists = createEmptyWatchlists();

      if (parsed && typeof parsed === "object") {
        for (const tabId of WATCHLIST_TABS) {
          const maybeItems = (parsed as Record<string, unknown>)[tabId];
          if (!Array.isArray(maybeItems)) {
            continue;
          }
          watchlists[tabId] = maybeItems
            .map(normalizeStoredInstrument)
            .filter((item): item is WatchlistInstrument => item !== null)
            .slice(0, WATCHLIST_MAX_ITEMS);
        }
      }

      return watchlists;
    }
  } catch {
    return createEmptyWatchlists();
  }

  // One-time fallback for previous single-watchlist storage format.
  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_WATCHLIST_STORAGE_KEY);
    if (!legacyRaw) {
      return createEmptyWatchlists();
    }
    const legacyParsed = JSON.parse(legacyRaw);
    if (!Array.isArray(legacyParsed)) {
      return createEmptyWatchlists();
    }
    const migrated = createEmptyWatchlists();
    migrated["1"] = legacyParsed
      .map(normalizeStoredInstrument)
      .filter((item): item is WatchlistInstrument => item !== null)
      .slice(0, WATCHLIST_MAX_ITEMS);
    return migrated;
  } catch {
    return createEmptyWatchlists();
  }
}

function toWatchlistInstrument(option: SearchResult): WatchlistInstrument | null {
  const instrumentToken = option.instrument_token?.trim();
  const exchange = option.exchange?.trim() || "NSE";
  const tradingsymbol = option.tradingsymbol?.trim() || option.name?.trim();
  const name = option.name?.trim() || tradingsymbol;

  if (!instrumentToken || !tradingsymbol) {
    return null;
  }

  return {
    instrumentToken,
    exchange,
    tradingsymbol,
    name: name || tradingsymbol,
  };
}

function toChartRouteInstrument(option: SearchResult): {
  exchange: string;
  tradingsymbol: string;
  instrumentToken: string;
} | null {
  const next = toWatchlistInstrument(option);
  if (!next) {
    return null;
  }
  return {
    exchange: next.exchange,
    tradingsymbol: next.tradingsymbol,
    instrumentToken: next.instrumentToken,
  };
}

function buildChartPath(instrument: {
  exchange: string;
  tradingsymbol: string;
  instrumentToken: string;
}): string {
  const ex = encodeURIComponent(instrument.exchange || "NSE");
  const sym = encodeURIComponent(instrument.tradingsymbol || "UNKNOWN");
  const token = encodeURIComponent(instrument.instrumentToken || "0");
  return `/chart/${ex}/${sym}/${token}`;
}

export const Watchlist: React.FC = () => {
  const [activeTab, setActiveTab] = useState<WatchlistTabId>("1");
  const [watchlists, setWatchlists] = useState<WatchlistsByTab>(() =>
    loadWatchlistFromStorage(),
  );
  const items = watchlists[activeTab];

  const initialOptions: SearchResult[] = useMemo(
    () => [
      {
        instrument_token: "738561",
        name: "RELIANCE",
        tradingsymbol: "RELIANCE",
        exchange: "NSE",
      },
      {
        instrument_token: "341249",
        name: "HDFCBANK",
        tradingsymbol: "HDFCBANK",
        exchange: "NSE",
      },
      {
        instrument_token: "2714625",
        name: "BHARTIARTL",
        tradingsymbol: "BHARTIARTL",
        exchange: "NSE",
      },
      {
        instrument_token: "1270529",
        name: "ICICIBANK",
        tradingsymbol: "ICICIBANK",
        exchange: "NSE",
      },
    ],
    [],
  );

  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SearchResult[]>(initialOptions);
  const [loading, setLoading] = useState(false);

  // Avoid refetching identical queries repeatedly.
  const cacheRef = useRef(new Map<string, SearchResult[]>());

  useEffect(() => {
    const q = query.trim();

    if (!q) {
      setLoading(false);
      setOptions(initialOptions);
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
      } catch (e: any) {
        if (e?.name !== "AbortError") {
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
  }, [initialOptions, query]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlists));
  }, [watchlists]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === WATCHLIST_STORAGE_KEY ||
        event.key === LEGACY_WATCHLIST_STORAGE_KEY
      ) {
        setWatchlists(loadWatchlistFromStorage());
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const openChart = React.useCallback((item: {
    exchange: string;
    tradingsymbol: string;
    instrumentToken: string;
  }) => {
    if (typeof window === "undefined") {
      return;
    }

    const nextPath = buildChartPath(item);
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, "", nextPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, []);

  const addToWatchlist = React.useCallback((option: SearchResult) => {
    const next = toWatchlistInstrument(option);
    if (!next) {
      return;
    }

    setWatchlists((current) => {
      const currentItems = current[activeTab] ?? [];
      const deduped = currentItems.filter(
        (item) =>
          !(
            item.instrumentToken === next.instrumentToken &&
            item.exchange === next.exchange
          ),
      );
      return {
        ...current,
        [activeTab]: [next, ...deduped].slice(0, WATCHLIST_MAX_ITEMS),
      };
    });

    setQuery("");
  }, [activeTab]);

  const openChartFromSearch = React.useCallback((option: SearchResult) => {
    const next = toChartRouteInstrument(option);
    if (!next) {
      return;
    }
    openChart(next);
  }, [openChart]);

  const removeFromWatchlist = React.useCallback(
    (instrumentToken: string, exchange: string) => {
      setWatchlists((current) => {
        const currentItems = current[activeTab] ?? [];
        return {
          ...current,
          [activeTab]: currentItems.filter(
            (item) =>
              !(
                item.instrumentToken === instrumentToken &&
                item.exchange === exchange
              ),
          ),
        };
      });
    },
    [activeTab],
  );

  return (
    <Panel className="h-full flex flex-col">
      <div className="p-2 border-t min-w-[120px]">
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (WATCHLIST_TABS.includes(value as WatchlistTabId)) {
              setActiveTab(value as WatchlistTabId);
            }
          }}
          className="w-full"
        >
          <TabsList className="grid grid-cols-7 w-full bg-background">
            {WATCHLIST_TABS.map((tabId) => (
              <TabsTrigger
                key={tabId}
                value={tabId}
                className="min-h-10 text-xs rounded-none"
              >
                {tabId}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="p-2 border-b">
        <SearchBox
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          options={options}
          loading={loading}
          onOptionSelect={addToWatchlist}
          onOpenChart={openChartFromSearch}
        />

        <div className="mt-2 text-[10px] text-muted-foreground">
          Watchlist: <span className="font-medium">Default {activeTab}</span> (
          {items.length}/{WATCHLIST_MAX_ITEMS})
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {items.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              No instruments in watchlist. Use search to add.
            </div>
          ) : (
            items.map((item, idx) => (
              <React.Fragment
                key={`${item.exchange}:${item.instrumentToken}`}
              >
                <WatchItem
                  symbol={item.tradingsymbol}
                  change={item.change}
                  price={item.price}
                  onOpenChart={() => openChart(item)}
                  onRemove={() =>
                    removeFromWatchlist(item.instrumentToken, item.exchange)
                  }
                />
                {idx !== items.length - 1 ? (
                  <Separator className="my-1" />
                ) : null}
              </React.Fragment>
            ))
          )}
        </div>
      </ScrollArea>
    </Panel>
  );
};
