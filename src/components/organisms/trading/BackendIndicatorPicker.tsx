import * as React from "react";
import { ChartSpline, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type {
  ClientScriptLifecycle,
  ScriptCatalogDetailsItem,
  ScriptInstanceView,
} from "@/components/organisms/trading/scriptAttachUtils";
import { backendFetch } from "@/lib/runtimeConfig";

const lifecycleVariant = (value: ClientScriptLifecycle) => {
  if (value === "FAILED") {
    return "destructive" as const;
  }
  if (value === "ACTIVE") {
    return "default" as const;
  }
  return "outline" as const;
};

export const BackendIndicatorPicker: React.FC<{
  attachEnabled: boolean;
  scriptInstances: ScriptInstanceView[];
  onApply: (indicator: ScriptCatalogDetailsItem) => void;
}> = ({ attachEnabled, scriptInstances, onApply }) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [options, setOptions] = React.useState<ScriptCatalogDetailsItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams({
          kind: "INDICATOR",
          limit: "100",
          offset: "0",
        });
        const trimmedQuery = query.trim();
        if (trimmedQuery) {
          params.set("q", trimmedQuery);
        }

        const response = await backendFetch(
          `/engine/scripts/catalog/details?${params.toString()}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as ScriptCatalogDetailsItem[];
        setOptions(
          Array.isArray(data)
            ? data.filter((item) => item.kind === "INDICATOR")
            : [],
        );
      } catch (fetchError: unknown) {
        if (
          (fetchError as { name?: string } | null)?.name !== "AbortError"
        ) {
          setOptions([]);
          setError("Failed to load backend-enabled indicators.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query]);

  const lifecycleCountsByScriptId = React.useMemo(() => {
    const counts = new Map<string, Map<ClientScriptLifecycle, number>>();
    for (const instance of scriptInstances) {
      const perScript =
        counts.get(instance.scriptId) ??
        new Map<ClientScriptLifecycle, number>();
      perScript.set(
        instance.lifecycle,
        (perScript.get(instance.lifecycle) ?? 0) + 1,
      );
      counts.set(instance.scriptId, perScript);
    }
    return counts;
  }, [scriptInstances]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <ChartSpline className="h-4 w-4" />
        Indicators
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQuery("");
            setOptions([]);
            setError(null);
            setLoading(false);
          }
        }}
      >
        <DialogContent className="flex h-[70vh] min-h-[360px] w-[calc(100vw-1rem)] max-w-3xl max-h-[80vh] flex-col gap-0 overflow-hidden rounded-none p-0">
          <DialogHeader className="border-b px-6 pb-3 pt-6">
            <DialogTitle>Backend indicators</DialogTitle>
            <DialogDescription className="sr-only">
              Search and apply indicators enabled by the backend.
            </DialogDescription>
          </DialogHeader>

          <div className="border-b px-6 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search indicators"
                className="rounded-none pl-10"
              />
            </div>
            {!attachEnabled ? (
              <div className="mt-2 text-xs text-muted-foreground">
                Indicators can be applied after the chart session is live.
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="divide-y">
              {loading ? (
                <div className="px-6 py-5 text-sm text-muted-foreground">
                  Loading indicators...
                </div>
              ) : null}
              {!loading && error ? (
                <div className="px-6 py-5 text-sm text-destructive">
                  {error}
                </div>
              ) : null}
              {!loading && !error && options.length === 0 ? (
                <div className="px-6 py-5 text-sm text-muted-foreground">
                  No backend-enabled indicators found.
                </div>
              ) : null}
              {!loading &&
                !error &&
                options.map((item) => {
                  const counts = lifecycleCountsByScriptId.get(item.scriptId);
                  return (
                    <button
                      key={item.scriptId}
                      type="button"
                      disabled={!attachEnabled}
                      onClick={() => onApply(item)}
                      className="block w-full overflow-hidden px-6 py-4 text-left hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label={`Apply ${item.name}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium" title={item.name}>
                          {item.name}
                        </div>
                        {item.description ? (
                          <div
                            className="mt-0.5 truncate text-xs text-muted-foreground"
                            title={item.description}
                          >
                            {item.description}
                          </div>
                        ) : null}
                        {counts && counts.size > 0 ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            {Array.from(counts.entries()).map(
                              ([lifecycle, count]) => (
                                <Badge
                                  key={`${item.scriptId}-${lifecycle}`}
                                  variant={lifecycleVariant(lifecycle)}
                                  className="text-[10px]"
                                >
                                  {lifecycle}:{count}
                                </Badge>
                              ),
                            )}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
