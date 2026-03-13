"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Check, ChevronDown, Info, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type SignalTimeframe = "H" | "D" | "W" | "M";
type SignalBias = "bullish" | "bearish" | "neutral";
type SignalKind = "candle" | "indicator" | "script";

type Signal = {
  id: string;
  ts: string;
  timeframe: SignalTimeframe;
  bias: SignalBias;
  kind: SignalKind;
  signalKey: string;
  signalName: string;
  instrumentKey: string;
  instrumentName: string;
  sourceKey?: string;
  description?: string;
  meta?: Record<string, unknown>;
};

type SignalFilters = {
  q: string;
  kinds: Set<SignalKind>;
  biases: Set<Extract<SignalBias, "bullish" | "bearish">>;
  timeframes: Set<SignalTimeframe>;
};

const createDefaultFilters = (): SignalFilters => ({
  q: "",
  kinds: new Set(),
  biases: new Set(),
  timeframes: new Set(),
});

const cloneFilters = (filters: SignalFilters): SignalFilters => ({
  q: filters.q,
  kinds: new Set(filters.kinds),
  biases: new Set(filters.biases),
  timeframes: new Set(filters.timeframes),
});

const signalsData: Signal[] = [
  {
    id: "sig-001",
    ts: "2026-02-03T09:15:04.000Z",
    timeframe: "H",
    bias: "bullish",
    kind: "candle",
    signalKey: "bullish_engulfing",
    signalName: "Bullish Engulfing",
    instrumentKey: "NSE:DMART",
    instrumentName: "DMART",
    description: "A bullish engulfing candle pattern after a pullback.",
  },
  {
    id: "sig-002",
    ts: "2026-02-03T09:10:22.000Z",
    timeframe: "D",
    bias: "bearish",
    kind: "indicator",
    signalKey: "rsi_bear_div",
    signalName: "RSI Bearish Divergence",
    instrumentKey: "NSE:RELIANCE",
    instrumentName: "RELIANCE",
    description: "RSI divergence suggests momentum weakness on daily chart.",
  },
  {
    id: "sig-003",
    ts: "2026-02-02T18:42:15.000Z",
    timeframe: "W",
    bias: "bullish",
    kind: "script",
    signalKey: "breakout_sweep",
    signalName: "Breakout Sweep",
    instrumentKey: "CRYPTO:BTCUSDT",
    instrumentName: "BTCUSDT",
    sourceKey: "custom_breakout_v2",
    description: "Custom script detected breakout + liquidity sweep.",
  },
  {
    id: "sig-004",
    ts: "2026-02-01T10:24:00.000Z",
    timeframe: "H",
    bias: "bearish",
    kind: "candle",
    signalKey: "bearish_marubozu",
    signalName: "Bearish Marubozu",
    instrumentKey: "CRYPTO:DOGEUSDT",
    instrumentName: "DOGEUSDT",
    description: "Strong bearish candle with no upper shadow.",
  },
  {
    id: "sig-005",
    ts: "2026-01-31T16:02:44.000Z",
    timeframe: "M",
    bias: "bullish",
    kind: "indicator",
    signalKey: "macd_cross",
    signalName: "MACD Bullish Cross",
    instrumentKey: "NSE:TCS",
    instrumentName: "TCS",
    description: "MACD line crossed above signal line on monthly chart.",
  },
];

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const isDefaultFilters = (filters: SignalFilters) =>
  filters.q.trim().length === 0 &&
  filters.kinds.size === 0 &&
  filters.biases.size === 0 &&
  filters.timeframes.size === 0;

const filterSignals = (signals: Signal[], filters: SignalFilters) => {
  const query = filters.q.trim().toLowerCase();
  return signals
    .filter((signal) =>
      filters.kinds.size === 0 ? true : filters.kinds.has(signal.kind)
    )
    .filter((signal) =>
      filters.biases.size === 0 ? true : filters.biases.has(signal.bias as "bullish" | "bearish")
    )
    .filter((signal) =>
      filters.timeframes.size === 0 ? true : filters.timeframes.has(signal.timeframe)
    )
    .filter((signal) => {
      if (!query) return true;
      const haystack = `${signal.signalName} ${signal.instrumentName} ${signal.kind}`.toLowerCase();
      return haystack.includes(query);
    })
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
};

export const SignalsPanel: React.FC = () => {
  const [filters, setFilters] = React.useState<SignalFilters>(
    createDefaultFilters()
  );
  const [detailsSignal, setDetailsSignal] = React.useState<Signal | null>(null);

  const filteredSignals = React.useMemo(
    () => filterSignals(signalsData, filters),
    [filters]
  );

  const updateFilterSet = <T,>(
    key: keyof SignalFilters,
    value: T,
    shouldInclude: boolean
  ) => {
    setFilters((prev) => {
      const next = cloneFilters(prev);
      const set = next[key] as Set<T>;
      if (shouldInclude) {
        set.add(value);
      } else {
        set.delete(value);
      }
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="sticky top-0 z-10 border-b bg-background px-2 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-[220px]">
            <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...cloneFilters(prev),
                  q: event.target.value,
                }))
              }
              placeholder="Search signals / instruments..."
              className="h-9 pl-8"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                Type
                <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="end">
              <Command>
                <CommandInput placeholder="Filter types" />
                <CommandList>
                  <CommandGroup heading="Signal type">
                    {(["candle", "indicator"] as SignalKind[]).map((kind) => (
                      <CommandItem
                        key={kind}
                        onSelect={() => updateFilterSet("kinds", kind, !filters.kinds.has(kind))}
                        className="flex items-center justify-between"
                      >
                        <span className="text-xs font-medium">
                          {kind === "indicator" ? "Indicator" : "Candle"}
                        </span>
                        <span
                          className={cn(
                            "flex h-4 w-4 items-center justify-center rounded-sm border",
                            filters.kinds.has(kind) && "bg-primary text-primary-foreground"
                          )}
                        >
                          {filters.kinds.has(kind) && <Check className="h-3 w-3" />}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Bias</span>
            <ToggleGroup
              type="multiple"
              value={Array.from(filters.biases)}
              variant="outline"
              size="sm"
              onValueChange={(values) =>
                setFilters((prev) => ({
                  ...cloneFilters(prev),
                  biases: new Set(values as Array<"bullish" | "bearish">),
                }))
              }
            >
              {(["bullish", "bearish"] as const).map((value) => (
                <ToggleGroupItem key={value} value={value} aria-label={value}>
                  {value}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">TF</span>
            <ToggleGroup
              type="multiple"
              variant="outline"
              size="sm"
              value={Array.from(filters.timeframes)}
              onValueChange={(values) =>
                setFilters((prev) => ({
                  ...cloneFilters(prev),
                  timeframes: new Set(values as SignalTimeframe[]),
                }))
              }
            >
              {(["H", "D", "W", "M"] as SignalTimeframe[]).map((value) => (
                <ToggleGroupItem key={value} value={value} aria-label={value}>
                  {value}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="h-full overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead>Date/Time</TableHead>
                <TableHead>Signal</TableHead>
                <TableHead>Instrument</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSignals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                      No signals match these filters.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSignals.map((signal) => (
                  <TableRow key={signal.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {formatDateTime(signal.ts)}
                    </TableCell>
                    <TableCell>
                      <HoverCard openDelay={300} closeDelay={120}>
                        <HoverCardTrigger>
                          <button className="text-left text-sm font-medium hover:underline">
                            {signal.signalName}
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              — {signal.timeframe}
                            </span>
                          </button>
                        </HoverCardTrigger>
                        <HoverCardContent className="space-y-1 text-xs">
                          <div className="font-semibold">
                            {signal.bias} · {signal.kind} · {signal.timeframe}
                          </div>
                          <div className="text-muted-foreground line-clamp-2">
                            {signal.description ?? "No description available."}
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    </TableCell>
                    <TableCell className="text-xs">{signal.instrumentName}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`View details for ${signal.signalName}`}
                        onClick={() => setDetailsSignal(signal)}
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="sticky bottom-0 border-t bg-background px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>{filteredSignals.length} signals</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              Prev
            </Button>
            <Button variant="ghost" size="sm">
              Next
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={!!detailsSignal} onOpenChange={(open) => !open && setDetailsSignal(null)}>
        <DialogContent>
          {detailsSignal && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detailsSignal.signalName}
                  <Badge variant="secondary">{detailsSignal.timeframe}</Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="text-sm text-muted-foreground">
                {detailsSignal.instrumentName} · {formatDateTime(detailsSignal.ts)}
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium">What it is</div>
                  <div className="text-muted-foreground">
                    {detailsSignal.description ?? "No summary available."}
                  </div>
                </div>
                <div>
                  <div className="font-medium">Why it matters</div>
                  <div className="text-muted-foreground">
                    Momentum and trend alignment detected for this setup.
                  </div>
                </div>
                <div>
                  <div className="font-medium">Conditions used</div>
                  <ul className="list-disc pl-4 text-muted-foreground">
                    <li>Bias: {detailsSignal.bias}</li>
                    <li>Kind: {detailsSignal.kind}</li>
                    <li>Timeframe: {detailsSignal.timeframe}</li>
                  </ul>
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button className="flex-1">View on chart</Button>
                <Button variant="outline" className="flex-1">
                  Create alert
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
