import { useChartActions, useChartState } from "./chartStore";

export function useChartRuntimeState() {
  return useChartState();
}

export function useChartRuntimeActions() {
  return useChartActions();
}
