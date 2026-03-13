export type ExchangeTimeZone = "IST";

const IST_OFFSET_SECONDS = 330 * 60;

function offsetSecondsFor(exchangeTz: ExchangeTimeZone): number {
  switch (exchangeTz) {
    case "IST":
      return IST_OFFSET_SECONDS;
    default:
      return IST_OFFSET_SECONDS;
  }
}

/**
 * lightweight-charts renders intraday labels in UTC wall-clock.
 * We shift timestamps by exchange offset so the axis shows exchange local time.
 *
 * TODO: extend to per-exchange timezone mapping when non-IST exchanges are added.
 */
export function toChartTimestampFromEpochMsInExchangeTz(
  epochMs: number,
  exchangeTz: ExchangeTimeZone
): number {
  const epochSeconds = Math.floor(epochMs / 1000);
  return epochSeconds + offsetSecondsFor(exchangeTz);
}

/**
 * Parse ISO and convert to chart timestamp (seconds) in chosen exchange timezone.
 */
export function toChartTimestampFromIsoInExchangeTz(
  iso: string,
  exchangeTz: ExchangeTimeZone
): number | null {
  const epochMs = Date.parse(iso);
  if (!Number.isFinite(epochMs)) {
    return null;
  }
  return toChartTimestampFromEpochMsInExchangeTz(epochMs, exchangeTz);
}

type ExchangeBusinessDay = {
  year: number;
  month: number;
  day: number;
};

function toBusinessDayFromEpochMsInExchangeTz(
  epochMs: number,
  exchangeTz: ExchangeTimeZone
): ExchangeBusinessDay {
  const shiftedMs = epochMs + offsetSecondsFor(exchangeTz) * 1000;
  const d = new Date(shiftedMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function isHigherTimeframe(timeframe: string): boolean {
  const tf = timeframe.trim();
  if (!tf) return false;
  if (/^\d+[DWM]$/.test(tf)) return true; // e.g. 1D, 1W, 1M
  const upper = tf.toUpperCase();
  return (
    upper.endsWith("D") ||
    upper.endsWith("W") ||
    upper.endsWith("MO") ||
    upper.endsWith("MON") ||
    upper.endsWith("MONTH")
  );
}

/**
 * Timeframe-aware conversion for chart ingress:
 * - intraday: shifted epoch seconds for exchange wall-clock
 * - daily/weekly/monthly: BusinessDay in exchange date
 */
export function toChartTimeFromIsoInExchangeTz(
  iso: string,
  timeframe: string,
  exchangeTz: ExchangeTimeZone
): number | ExchangeBusinessDay | null {
  const epochMs = Date.parse(iso);
  if (!Number.isFinite(epochMs)) {
    return null;
  }
  if (isHigherTimeframe(timeframe)) {
    return toBusinessDayFromEpochMsInExchangeTz(epochMs, exchangeTz);
  }
  return toChartTimestampFromEpochMsInExchangeTz(epochMs, exchangeTz);
}
