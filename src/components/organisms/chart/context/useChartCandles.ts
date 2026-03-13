import { useChartRuntimeActions, useChartRuntimeState } from "./useChartRuntime";

export function useChartCandles() {
  const { candles } = useChartRuntimeState();
  const { addCandle, setCandles, clearCandles } = useChartRuntimeActions();

  return {
    candles,
    addCandle,
    setCandles,
    clearCandles,
  };
}
