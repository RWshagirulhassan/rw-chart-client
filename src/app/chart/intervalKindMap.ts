const UI_TO_INTERVAL_KIND: Record<string, string> = {
  "1m": "TIME_1M",
  "2m": "TIME_2M",
  "3m": "TIME_3M",
  "5m": "TIME_5M",
  "10m": "TIME_10M",
  "15m": "TIME_15M",
  "30m": "TIME_30M",
  "45m": "TIME_45M",
  "1h": "TIME_1H",
  "1D": "TIME_1D",
  "10t": "TICK_10T",
  "100t": "TICK_100T",
  "1000t": "TICK_1000T",
};

const INTERVAL_KIND_TO_UI = Object.entries(UI_TO_INTERVAL_KIND).reduce<
  Record<string, string>
>((acc, [timeframe, intervalKind]) => {
  acc[intervalKind] = timeframe;
  return acc;
}, {});

const SERIES_KEY_REGEX = /^([^@]+)@([A-Z0-9_]+)$/;

export function mapUiTimeframeToIntervalKind(timeframe: string): string | null {
  return UI_TO_INTERVAL_KIND[timeframe] ?? null;
}

export function mapIntervalKindToUiTimeframe(intervalKind: string): string | null {
  return INTERVAL_KIND_TO_UI[intervalKind] ?? null;
}

export function isSupportedIntervalKind(intervalKind: string): boolean {
  return Boolean(INTERVAL_KIND_TO_UI[intervalKind]);
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
