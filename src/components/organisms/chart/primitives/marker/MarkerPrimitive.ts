import type {
  AutoscaleInfo,
  PrimitivePaneViewZOrder,
} from "lightweight-charts";
import type { AttachedCtx } from "../base/primitiveTypes";
import type { MarkerDrawing } from "../../drawing/types";
import { clamp } from "../../utils";

const DEFAULT_MARKER_COLOR = "rgba(15,23,42,0.9)";

const resolveMarkerColor = (): string => {
  if (typeof window === "undefined") return DEFAULT_MARKER_COLOR;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--foreground")
    .trim();
  if (!raw) return DEFAULT_MARKER_COLOR;
  return `hsl(${raw})`;
};

type MarkerViewState = {
  x: number | null;
  y: number | null;
  shape: MarkerDrawing["shape"];
  size: number;
  opacity: number;
  text?: string;
  textSize?: number;
  layout?: MarkerDrawing["layout"];
  alignment?: MarkerDrawing["alignment"];
  z: PrimitivePaneViewZOrder;
  visible: boolean;
  offsetPx?: { x?: number | null; y?: number | null } | null;
};

class MarkerPaneRenderer {
  constructor(private readonly s: MarkerViewState) {}

  draw(target: any) {
    if (!this.s.visible) return;
    if (this.s.x == null || this.s.y == null) return;

    target.useMediaCoordinateSpace((scope: any) => {
      const ctx: CanvasRenderingContext2D = scope.context;
      const size = clamp(Math.round(this.s.size), 2, 48);
      const opacity = clamp(this.s.opacity, 0, 1);
      const offsetX = this.s.offsetPx?.x ?? 0;
      const offsetY = this.s.offsetPx?.y ?? 0;
      const x = this.s.x! + offsetX;
      const y = this.s.y! + offsetY;

      ctx.save();
      ctx.globalAlpha = opacity;
      const color = resolveMarkerColor();
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;

      switch (this.s.shape) {
        case "diamond": {
          ctx.beginPath();
          ctx.moveTo(x, y - size);
          ctx.lineTo(x + size, y);
          ctx.lineTo(x, y + size);
          ctx.lineTo(x - size, y);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case "triangle": {
          ctx.beginPath();
          ctx.moveTo(x, y - size);
          ctx.lineTo(x + size, y + size);
          ctx.lineTo(x - size, y + size);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case "cross": {
          ctx.beginPath();
          ctx.moveTo(x - size, y - size);
          ctx.lineTo(x + size, y + size);
          ctx.moveTo(x + size, y - size);
          ctx.lineTo(x - size, y + size);
          ctx.stroke();
          break;
        }
        case "circle":
        default: {
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }

      if (this.s.text) {
        const fontSize = clamp(this.s.textSize ?? 12, 10, 24);
        ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui`;
        ctx.fillStyle = color;
        ctx.textBaseline = this.s.layout === "col" ? "top" : "middle";

        const gap = size + 6;
        let textX = x + gap;
        let textY = y;

        if (this.s.layout === "col") {
          textX = x;
          textY = y + gap;
        }

        switch (this.s.alignment) {
          case "start":
            ctx.textAlign = "left";
            break;
          case "end":
            ctx.textAlign = "right";
            break;
          case "center":
          default:
            ctx.textAlign = "center";
            break;
        }

        ctx.fillText(this.s.text, textX, textY);
      }

      ctx.restore();
    });
  }
}

class MarkerPaneView {
  private s: MarkerViewState = {
    x: null,
    y: null,
    shape: "circle",
    size: 6,
    opacity: 1,
    z: "top",
    visible: true,
  };

  update(partial: Partial<MarkerViewState>) {
    Object.assign(this.s, partial);
  }

  renderer() {
    return new MarkerPaneRenderer(this.s);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return this.s.z ?? "top";
  }
}

export class MarkerPrimitive {
  private ctx?: AttachedCtx;
  private view = new MarkerPaneView();

  constructor(private d: MarkerDrawing) {}

  setDrawing(next: MarkerDrawing) {
    this.d = next;
    this.ctx?.requestUpdate();
  }

  attached(param: any) {
    this.ctx = {
      chart: param.chart,
      series: param.series,
      requestUpdate: param.requestUpdate,
    };
  }

  detached() {
    this.ctx = undefined;
  }

  updateAllViews() {
    if (!this.ctx) return;
    const { chart, series } = this.ctx;

    let x: number | null = null;
    let y: number | null = null;

    if (this.d.coords) {
      x = this.d.coords.x;
      y = this.d.coords.y;
    } else if (this.d.point) {
      x = chart.timeScale().timeToCoordinate(this.d.point.time as any) ?? null;
      y = series.priceToCoordinate(this.d.point.price as any) ?? null;
    }

    this.view.update({
      x,
      y,
      shape: this.d.shape,
      size: this.d.size,
      opacity: this.d.opacity ?? 1,
      text: this.d.text,
      textSize: this.d.textSize,
      layout: this.d.layout ?? "row",
      alignment: this.d.alignment ?? "center",
      z: (this.d.z ?? "top") as any,
      visible: this.d.visible !== false,
      offsetPx: this.d.offsetPx ?? null,
    });
  }

  paneViews() {
    return [this.view];
  }

  autoscaleInfo(): AutoscaleInfo | null {
    if (!this.d.point) return null;
    return {
      priceRange: {
        minValue: this.d.point.price,
        maxValue: this.d.point.price,
      },
    } as any;
  }
}
