import { useChartRuntimeActions, useChartRuntimeState } from "./useChartRuntime";
import type { PlotPoint, PlotSeriesStyle } from "../model/chartTypes";

export function useChartPlots() {
  const { plotSeriesById } = useChartRuntimeState();
  const {
    addPlotSeries,
    removePlotSeries,
    setPlotPoint,
    setPlotPoints,
    clearPlotSeries,
  } = useChartRuntimeActions();

  return {
    plotSeriesById,
    addPlotSeries: (seriesId: string, style?: PlotSeriesStyle) =>
      addPlotSeries(seriesId, style),
    removePlotSeries,
    setPlotPoint: (seriesId: string, point: PlotPoint) =>
      setPlotPoint(seriesId, point),
    setPlotPoints: (seriesId: string, points: PlotPoint[]) =>
      setPlotPoints(seriesId, points),
    clearPlotSeries,
  };
}
