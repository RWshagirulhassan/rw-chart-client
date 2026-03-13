import React, { createContext, useContext, useMemo, useReducer } from "react";
import type {
  ChartCandle,
  ChartState,
  Drawing,
  DrawingScopeKey,
  PlotPoint,
  PlotSeries,
  PlotSeriesStyle,
} from "../model/chartTypes";

export const MANUAL_SCOPE: DrawingScopeKey = "manual:local";

export function scriptScope(scriptInstanceId: string): DrawingScopeKey {
  return `script:${scriptInstanceId}` as DrawingScopeKey;
}

type Action =
  | { type: "candles/set"; candles: ChartCandle[] }
  | { type: "candles/add"; candle: ChartCandle }
  | { type: "candles/clear" }
  | { type: "plot/add"; seriesId: string; style?: PlotSeriesStyle }
  | { type: "plot/remove"; seriesId: string }
  | { type: "plot/setPoint"; seriesId: string; point: PlotPoint }
  | { type: "plot/setPoints"; seriesId: string; points: PlotPoint[] }
  | { type: "plot/clear"; seriesId: string }
  | { type: "drawing/scopeSet"; scopeKey: DrawingScopeKey; drawings: Drawing[] }
  | { type: "drawing/scopeUpsert"; scopeKey: DrawingScopeKey; drawing: Drawing }
  | {
      type: "drawing/scopeUpdate";
      scopeKey: DrawingScopeKey;
      drawingId: string;
      patch: Partial<Drawing>;
    }
  | { type: "drawing/scopeRemove"; scopeKey: DrawingScopeKey; drawingId: string }
  | { type: "drawing/scopeClear"; scopeKey: DrawingScopeKey }
  | { type: "drawing/clearAll" };

const emptyState: ChartState = {
  candles: [],
  plotSeriesById: {},
  drawingsByScope: {},
};

function indexByDrawingId(drawings: Drawing[]): Record<string, Drawing> {
  const next: Record<string, Drawing> = {};
  for (const drawing of drawings) {
    next[drawing.id] = drawing;
  }
  return next;
}

function reducer(state: ChartState, action: Action): ChartState {
  switch (action.type) {
    case "candles/set":
      return { ...state, candles: action.candles };
    case "candles/add":
      return { ...state, candles: [...state.candles, action.candle] };
    case "candles/clear":
      return { ...state, candles: [] };

    case "plot/add": {
      const existing = state.plotSeriesById[action.seriesId];
      if (existing) {
        return {
          ...state,
          plotSeriesById: {
            ...state.plotSeriesById,
            [action.seriesId]: {
              ...existing,
              style: { ...(existing.style ?? {}), ...(action.style ?? {}) },
            },
          },
        };
      }
      return {
        ...state,
        plotSeriesById: {
          ...state.plotSeriesById,
          [action.seriesId]: {
            id: action.seriesId,
            points: [],
            style: action.style,
          },
        },
      };
    }

    case "plot/remove": {
      const { [action.seriesId]: _ignored, ...rest } = state.plotSeriesById;
      return { ...state, plotSeriesById: rest };
    }

    case "plot/setPoint": {
      const existing = state.plotSeriesById[action.seriesId] ?? {
        id: action.seriesId,
        points: [],
      };
      return {
        ...state,
        plotSeriesById: {
          ...state.plotSeriesById,
          [action.seriesId]: {
            ...existing,
            points: [...existing.points, action.point],
          },
        },
      };
    }

    case "plot/setPoints": {
      const existing = state.plotSeriesById[action.seriesId] ?? {
        id: action.seriesId,
        points: [],
      };
      return {
        ...state,
        plotSeriesById: {
          ...state.plotSeriesById,
          [action.seriesId]: {
            ...existing,
            points: action.points,
          },
        },
      };
    }

    case "plot/clear": {
      const existing = state.plotSeriesById[action.seriesId];
      if (!existing) return state;
      return {
        ...state,
        plotSeriesById: {
          ...state.plotSeriesById,
          [action.seriesId]: { ...existing, points: [] },
        },
      };
    }

    case "drawing/scopeSet": {
      return {
        ...state,
        drawingsByScope: {
          ...state.drawingsByScope,
          [action.scopeKey]: indexByDrawingId(action.drawings),
        },
      };
    }

    case "drawing/scopeUpsert": {
      const existingScope = state.drawingsByScope[action.scopeKey] ?? {};
      return {
        ...state,
        drawingsByScope: {
          ...state.drawingsByScope,
          [action.scopeKey]: {
            ...existingScope,
            [action.drawing.id]: action.drawing,
          },
        },
      };
    }

    case "drawing/scopeUpdate": {
      const existingScope = state.drawingsByScope[action.scopeKey] ?? {};
      const existing = existingScope[action.drawingId];
      if (!existing) {
        return state;
      }
      return {
        ...state,
        drawingsByScope: {
          ...state.drawingsByScope,
          [action.scopeKey]: {
            ...existingScope,
            [action.drawingId]: {
              ...existing,
              ...action.patch,
              id: action.drawingId,
            } as Drawing,
          },
        },
      };
    }

    case "drawing/scopeRemove": {
      const existingScope = state.drawingsByScope[action.scopeKey];
      if (!existingScope || !existingScope[action.drawingId]) {
        return state;
      }
      const { [action.drawingId]: _ignored, ...rest } = existingScope;
      return {
        ...state,
        drawingsByScope: {
          ...state.drawingsByScope,
          [action.scopeKey]: rest,
        },
      };
    }

    case "drawing/scopeClear": {
      if (!state.drawingsByScope[action.scopeKey]) {
        return state;
      }
      return {
        ...state,
        drawingsByScope: {
          ...state.drawingsByScope,
          [action.scopeKey]: {},
        },
      };
    }

    case "drawing/clearAll":
      return { ...state, drawingsByScope: {} };

    default:
      return state;
  }
}

type ChartActions = {
  addCandle: (candle: ChartCandle) => void;
  setCandles: (candles: ChartCandle[]) => void;
  clearCandles: () => void;
  addPlotSeries: (seriesId: string, style?: PlotSeriesStyle) => void;
  removePlotSeries: (seriesId: string) => void;
  setPlotPoint: (seriesId: string, point: PlotPoint) => void;
  setPlotPoints: (seriesId: string, points: PlotPoint[]) => void;
  clearPlotSeries: (seriesId: string) => void;

  setScopeDrawings: (scopeKey: DrawingScopeKey, drawings: Drawing[]) => void;
  upsertScopeDrawing: (scopeKey: DrawingScopeKey, drawing: Drawing) => void;
  updateScopeDrawing: (
    scopeKey: DrawingScopeKey,
    drawingId: string,
    patch: Partial<Drawing>
  ) => void;
  removeScopeDrawing: (scopeKey: DrawingScopeKey, drawingId: string) => void;
  clearScopeDrawings: (scopeKey: DrawingScopeKey) => void;

  // Compatibility wrappers for existing call-sites.
  addDrawing: (drawing: Drawing) => void;
  updateDrawing: (drawingId: string, patch: Partial<Drawing>) => void;
  removeDrawing: (drawingId: string) => void;
  clearDrawings: () => void;
};

const StateCtx = createContext<ChartState | null>(null);
const ActionsCtx = createContext<ChartActions | null>(null);

export function ChartProvider(props: {
  initialCandles?: ChartCandle[];
  children: React.ReactNode;
}) {
  const [state, dispatch] = useReducer(reducer, {
    ...emptyState,
    candles: props.initialCandles ?? [],
  });

  const actions = useMemo<ChartActions>(
    () => ({
      addCandle(candle) {
        dispatch({ type: "candles/add", candle });
      },
      setCandles(candles) {
        dispatch({ type: "candles/set", candles });
      },
      clearCandles() {
        dispatch({ type: "candles/clear" });
      },
      addPlotSeries(seriesId, style) {
        dispatch({ type: "plot/add", seriesId, style });
      },
      removePlotSeries(seriesId) {
        dispatch({ type: "plot/remove", seriesId });
      },
      setPlotPoint(seriesId, point) {
        dispatch({ type: "plot/setPoint", seriesId, point });
      },
      setPlotPoints(seriesId, points) {
        dispatch({ type: "plot/setPoints", seriesId, points });
      },
      clearPlotSeries(seriesId) {
        dispatch({ type: "plot/clear", seriesId });
      },

      setScopeDrawings(scopeKey, drawings) {
        dispatch({ type: "drawing/scopeSet", scopeKey, drawings });
      },
      upsertScopeDrawing(scopeKey, drawing) {
        dispatch({ type: "drawing/scopeUpsert", scopeKey, drawing });
      },
      updateScopeDrawing(scopeKey, drawingId, patch) {
        dispatch({
          type: "drawing/scopeUpdate",
          scopeKey,
          drawingId,
          patch,
        });
      },
      removeScopeDrawing(scopeKey, drawingId) {
        dispatch({ type: "drawing/scopeRemove", scopeKey, drawingId });
      },
      clearScopeDrawings(scopeKey) {
        dispatch({ type: "drawing/scopeClear", scopeKey });
      },

      addDrawing(drawing) {
        dispatch({ type: "drawing/scopeUpsert", scopeKey: MANUAL_SCOPE, drawing });
      },
      updateDrawing(drawingId, patch) {
        dispatch({
          type: "drawing/scopeUpdate",
          scopeKey: MANUAL_SCOPE,
          drawingId,
          patch,
        });
      },
      removeDrawing(drawingId) {
        dispatch({
          type: "drawing/scopeRemove",
          scopeKey: MANUAL_SCOPE,
          drawingId,
        });
      },
      clearDrawings() {
        dispatch({ type: "drawing/clearAll" });
      },
    }),
    []
  );

  return (
    <StateCtx.Provider value={state}>
      <ActionsCtx.Provider value={actions}>{props.children}</ActionsCtx.Provider>
    </StateCtx.Provider>
  );
}

export function useChartState() {
  const value = useContext(StateCtx);
  if (!value) throw new Error("useChartState must be used within ChartProvider");
  return value;
}

export function useChartActions() {
  const value = useContext(ActionsCtx);
  if (!value) {
    throw new Error("useChartActions must be used within ChartProvider");
  }
  return value;
}

function scopeRank(scopeKey: string): number {
  if (scopeKey.startsWith("script:")) {
    return 0;
  }
  if (scopeKey.startsWith("manual:")) {
    return 1;
  }
  return 2;
}

export function useDrawingsList() {
  const { drawingsByScope } = useChartState();
  return useMemo(() => {
    const sortedScopes = (Object.keys(drawingsByScope) as DrawingScopeKey[]).sort(
      (left, right) => {
        const rankDiff = scopeRank(left) - scopeRank(right);
        if (rankDiff !== 0) {
          return rankDiff;
        }
        return left.localeCompare(right);
      }
    );

    const merged: Drawing[] = [];
    for (const scopeKey of sortedScopes) {
      const drawings = drawingsByScope[scopeKey] ?? {};
      const sortedDrawingIds = Object.keys(drawings).sort();
      for (const drawingId of sortedDrawingIds) {
        const drawing = drawings[drawingId];
        if (drawing) {
          merged.push(drawing);
        }
      }
    }

    return merged;
  }, [drawingsByScope]);
}

export function usePlotSeriesList(): PlotSeries[] {
  const { plotSeriesById } = useChartState();
  return useMemo(() => Object.values(plotSeriesById), [plotSeriesById]);
}
