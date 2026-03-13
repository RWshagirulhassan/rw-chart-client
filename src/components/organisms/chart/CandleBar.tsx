export type CandleBar = {
  timestamp: string; // ISO-8601 with +05:30 offset (for candles API it already arrives like this)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
