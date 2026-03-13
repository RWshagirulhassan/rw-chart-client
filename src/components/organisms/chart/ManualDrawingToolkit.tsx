import * as React from "react";
import { Button } from "@/components/ui/button";
import { Circle, Minus, Square, Trash2, Type, X } from "lucide-react";

export type ManualTool = "line" | "rect" | "circle" | "text" | "delete";
export type SelectableManualTool = Exclude<ManualTool, "delete">;

type ToolItem = {
  id: SelectableManualTool;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TOOLS: ToolItem[] = [
  { id: "line", label: "Line", icon: Minus },
  { id: "rect", label: "Rectangle", icon: Square },
  { id: "circle", label: "Circle", icon: Circle },
  { id: "text", label: "Text", icon: Type },
];

export const ManualDrawingToolkit: React.FC<{
  activeTool: SelectableManualTool;
  hasDraft: boolean;
  canDelete: boolean;
  onSelectTool: (tool: SelectableManualTool) => void;
  onDeleteLatest: () => void;
  onCancelDraft: () => void;
}> = ({
  activeTool,
  hasDraft,
  canDelete,
  onSelectTool,
  onDeleteLatest,
  onCancelDraft,
}) => {
  return (
    <div className="pointer-events-auto absolute left-2 top-16 z-30 flex flex-col gap-2 rounded-md border bg-background/95 p-2 shadow-md">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const active = activeTool === tool.id;
        return (
          <Button
            key={tool.id}
            type="button"
            size="icon"
            variant={active ? "secondary" : "ghost"}
            className="h-8 w-8 rounded-sm"
            onClick={() => onSelectTool(tool.id)}
            title={tool.label}
            aria-label={tool.label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}

      <div className="h-px bg-border" />

      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-8 w-8 rounded-sm"
        onClick={onDeleteLatest}
        title="Delete latest manual drawing"
        aria-label="Delete latest manual drawing"
        disabled={!canDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {hasDraft ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-sm"
          onClick={onCancelDraft}
          title="Cancel current draft"
          aria-label="Cancel current draft"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
};
