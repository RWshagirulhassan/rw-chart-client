import { useChartRuntimeActions, useChartRuntimeState } from "./useChartRuntime";
import type { Drawing } from "../model/chartTypes";
import { MANUAL_SCOPE } from "./chartStore";

export function useChartDrawings() {
  const { drawingsByScope } = useChartRuntimeState();
  const {
    addDrawing,
    updateDrawing,
    removeDrawing,
    clearDrawings,
    setScopeDrawings,
    upsertScopeDrawing,
    updateScopeDrawing,
    removeScopeDrawing,
    clearScopeDrawings,
  } = useChartRuntimeActions();

  return {
    drawingsByScope,
    manualDrawingsById: drawingsByScope[MANUAL_SCOPE] ?? {},
    setScopeDrawings,
    upsertScopeDrawing,
    updateScopeDrawing,
    removeScopeDrawing,
    clearScopeDrawings,
    addDrawing: (drawing: Drawing) => addDrawing(drawing),
    updateDrawing,
    removeDrawing,
    clearDrawings,
  };
}
