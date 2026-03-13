import * as React from "react";
import type { ClientScriptLifecycle, ScriptInstanceView } from "@/components/organisms/trading/scriptAttachUtils";
import { Eye, Loader2, MoreHorizontal, Settings2, Trash2 } from "lucide-react";
import { IndicatorSettingsDialog } from "@/components/organisms/trading/IndicatorSettingsDialog";

const isLoadingLifecycle = (value: ClientScriptLifecycle) =>
  value === "ATTACHING" ||
  value === "LOADING" ||
  value === "SNAPSHOT_READY" ||
  value === "ACKING";

export const AppliedScriptsOverlay: React.FC<{
  scriptInstances: ScriptInstanceView[];
  scriptActionError?: string | null;
  onDetachScript: (scriptInstanceId: string) => void;
  onReplaceScript: (scriptInstanceId: string, params: Record<string, unknown>) => Promise<void>;
}> = ({ scriptInstances, scriptActionError, onDetachScript, onReplaceScript }) => {
  const [settingsScript, setSettingsScript] = React.useState<ScriptInstanceView | null>(null);

  const sortedScriptInstances = React.useMemo(() => {
    return [...scriptInstances].sort((a, b) => {
      const left = a.attachAcceptedAtEpochMs ?? 0;
      const right = b.attachAcceptedAtEpochMs ?? 0;
      if (left !== right) {
        return right - left;
      }
      return a.scriptInstanceId.localeCompare(b.scriptInstanceId);
    });
  }, [scriptInstances]);

  if (sortedScriptInstances.length === 0 && !scriptActionError) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute left-3 top-16 z-20 flex max-w-[420px] flex-col gap-1">
      {sortedScriptInstances.map((instance) => {
        const loading = isLoadingLifecycle(instance.lifecycle);
        return (
          <div key={instance.scriptInstanceId} className="space-y-1">
            <div
              className="group pointer-events-auto flex items-center gap-2 rounded-md border border-transparent bg-background/95 px-2 py-1 shadow-sm transition-colors hover:border-border focus-within:border-border"
              title={instance.scriptInstanceId}
            >
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="truncate text-xs font-medium">{instance.scriptName}</span>
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                ) : null}
              </div>

              <div className="ml-auto flex items-center gap-0.5 opacity-100 transition-opacity pointer-events-auto md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-focus-within:opacity-100 md:group-focus-within:pointer-events-auto">
                <button
                  type="button"
                  aria-label="Hide or unhide indicator"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-sm border text-muted-foreground disabled:opacity-60"
                  disabled
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Indicator settings"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-sm border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setSettingsScript(instance)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Detach ${instance.scriptName}`}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-sm border text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                  onClick={() => onDetachScript(instance.scriptInstanceId)}
                  disabled={instance.lifecycle === "DETACHING"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="More indicator actions"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-sm border text-muted-foreground disabled:opacity-60"
                  disabled
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {instance.error ? (
              <div className="pointer-events-auto rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
                {instance.error}
              </div>
            ) : null}
          </div>
        );
      })}

      {scriptActionError ? (
        <div className="pointer-events-auto rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
          {scriptActionError}
        </div>
      ) : null}

      <IndicatorSettingsDialog
        open={settingsScript != null}
        scriptName={settingsScript?.scriptName ?? ""}
        paramsMeta={settingsScript?.paramsMeta ?? []}
        initialParams={settingsScript?.params ?? {}}
        onSubmit={async (params) => {
          if (!settingsScript) {
            return;
          }
          await onReplaceScript(settingsScript.scriptInstanceId, params);
          setSettingsScript(null);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setSettingsScript(null);
          }
        }}
      />
    </div>
  );
};
