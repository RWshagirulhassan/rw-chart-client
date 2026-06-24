type TimeframeKind = "tick" | "intraday" | "higher";

type TimeframeDescriptor = {
  timeframe: string;
  intervalKind: string;
  kind: TimeframeKind;
};

const TIMEFRAME_DESCRIPTORS = [
  { timeframe: "1m", intervalKind: "TIME_1M", kind: "intraday" },
  { timeframe: "2m", intervalKind: "TIME_2M", kind: "intraday" },
  { timeframe: "3m", intervalKind: "TIME_3M", kind: "intraday" },
  { timeframe: "5m", intervalKind: "TIME_5M", kind: "intraday" },
  { timeframe: "10m", intervalKind: "TIME_10M", kind: "intraday" },
  { timeframe: "15m", intervalKind: "TIME_15M", kind: "intraday" },
  { timeframe: "30m", intervalKind: "TIME_30M", kind: "intraday" },
  { timeframe: "45m", intervalKind: "TIME_45M", kind: "intraday" },
  { timeframe: "1h", intervalKind: "TIME_1H", kind: "intraday" },
  { timeframe: "1D", intervalKind: "TIME_1D", kind: "higher" },
  { timeframe: "1W", intervalKind: "TIME_1W", kind: "higher" },
  { timeframe: "1M", intervalKind: "TIME_1MO", kind: "higher" },
  { timeframe: "10t", intervalKind: "TICK_10T", kind: "tick" },
  { timeframe: "100t", intervalKind: "TICK_100T", kind: "tick" },
  { timeframe: "1000t", intervalKind: "TICK_1000T", kind: "tick" },
] as const satisfies readonly TimeframeDescriptor[];

const UI_TO_INTERVAL_KIND: Record<string, string> = Object.fromEntries(
  TIMEFRAME_DESCRIPTORS.map(({ timeframe, intervalKind }) => [
    timeframe,
    intervalKind,
  ]),
);

const UI_TO_DESCRIPTOR: Record<string, TimeframeDescriptor> = Object.fromEntries(
  TIMEFRAME_DESCRIPTORS.map((descriptor) => [descriptor.timeframe, descriptor]),
);

const INTERVAL_KIND_TO_DESCRIPTOR = TIMEFRAME_DESCRIPTORS.reduce<
  Record<string, TimeframeDescriptor>
>((acc, descriptor) => {
  acc[descriptor.intervalKind] = descriptor;
  return acc;
}, {});

const NORMALIZED_ALIAS_TO_UI_TIMEFRAME: Record<string, string> = {
  "1d": "1D",
  "1w": "1W",
  "1m": "1m",
  "1h": "1h",
  "10t": "10t",
  "100t": "100t",
  "1000t": "1000t",
  "1M": "1M",
  "2m": "2m",
  "3m": "3m",
  "5m": "5m",
  "10m": "10m",
  "15m": "15m",
  "30m": "30m",
  "45m": "45m",
};

const SERIES_KEY_REGEX = /^([^@]+)@([A-Z0-9_]+)$/;

export function mapUiTimeframeToIntervalKind(timeframe: string): string | null {
  return UI_TO_INTERVAL_KIND[timeframe] ?? null;
}

export function mapIntervalKindToUiTimeframe(intervalKind: string): string | null {
  return INTERVAL_KIND_TO_DESCRIPTOR[intervalKind]?.timeframe ?? null;
}

export function isSupportedIntervalKind(intervalKind: string): boolean {
  return Boolean(INTERVAL_KIND_TO_DESCRIPTOR[intervalKind]);
}

export function isHigherTimeframe(timeframe: string): boolean {
  return UI_TO_DESCRIPTOR[timeframe]?.kind === "higher";
}

export function normalizeUiTimeframe(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  if (UI_TO_DESCRIPTOR[trimmed]) {
    return trimmed;
  }
  const compact = trimmed.replace(/\s+/g, "");
  if (UI_TO_DESCRIPTOR[compact]) {
    return compact;
  }
  const match = compact.match(/^(\d+)([a-zA-Z]+)$/);
  if (!match) {
    return null;
  }
  const [, amount, unitRaw] = match;
  const unit = unitRaw.trim();
  if (unit === "M") {
    return UI_TO_DESCRIPTOR[`${amount}M`] ? `${amount}M` : null;
  }
  const lower = `${amount}${unit.toLowerCase()}`;
  return NORMALIZED_ALIAS_TO_UI_TIMEFRAME[lower] ?? null;
}

export function buildSeriesKeyFromIntervalKind(
  instrumentToken: string | number,
  intervalKind: string,
): string | null {
  if (!isSupportedIntervalKind(intervalKind)) {
    return null;
  }
  return `${instrumentToken}@${intervalKind}`;
}

export function buildSeriesKey(instrumentToken: string | number, timeframe: string): string | null {
  const intervalKind = mapUiTimeframeToIntervalKind(timeframe);
  if (!intervalKind) {
    return null;
  }
  return `${instrumentToken}@${intervalKind}`;
}

export function parseSeriesKey(
  value: string | null | undefined,
): { instrumentToken: string; intervalKind: string } | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const match = trimmed.match(SERIES_KEY_REGEX);
  if (!match) {
    return null;
  }
  const instrumentToken = match[1]?.trim();
  const intervalKind = match[2]?.trim();
  if (!instrumentToken || !intervalKind) {
    return null;
  }
  if (!isSupportedIntervalKind(intervalKind)) {
    return null;
  }
  return { instrumentToken, intervalKind };
}
