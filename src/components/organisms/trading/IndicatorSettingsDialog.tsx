import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  applyDefaultsToParams,
  normalizeScriptParamsFromDraft,
  type ScriptCatalogParam,
} from "@/components/organisms/trading/scriptAttachUtils";

export const IndicatorSettingsDialog: React.FC<{
  open: boolean;
  scriptName: string;
  paramsMeta: ScriptCatalogParam[];
  initialParams: Record<string, unknown>;
  onSubmit: (params: Record<string, unknown>) => Promise<void>;
  onOpenChange: (open: boolean) => void;
}> = ({ open, scriptName, paramsMeta, initialParams, onSubmit, onOpenChange }) => {
  const [draftParams, setDraftParams] = React.useState<Record<string, unknown>>({});
  const [dialogError, setDialogError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    setDraftParams({ ...initialParams });
    setDialogError(null);
    setSubmitting(false);
  }, [open, initialParams]);

  const handleDefaults = React.useCallback(() => {
    setDraftParams((current) => applyDefaultsToParams(current, paramsMeta));
    setDialogError(null);
  }, [paramsMeta]);

  const handleSubmit = React.useCallback(async () => {
    const normalized = normalizeScriptParamsFromDraft(paramsMeta, draftParams);
    if (normalized.error) {
      setDialogError(normalized.error);
      return;
    }
    setSubmitting(true);
    setDialogError(null);
    try {
      await onSubmit(normalized.params);
      onOpenChange(false);
    } catch (error: any) {
      setDialogError(error?.message ?? "Failed to update script settings.");
    } finally {
      setSubmitting(false);
    }
  }, [draftParams, onOpenChange, onSubmit, paramsMeta]);

  const renderField = React.useCallback((meta: ScriptCatalogParam) => {
    const rawValue = draftParams[meta.name];
    const normalizedType = (meta.type ?? "").trim().toLowerCase();
    const valueAsString = rawValue == null ? "" : String(rawValue);
    const options = Array.isArray(meta.options)
      ? meta.options.filter((item) => typeof item === "string" && item.trim() !== "")
      : [];

    if (options.length > 0) {
      return (
        <select
          value={valueAsString}
          onChange={(event) => {
            setDraftParams((current) => ({
              ...current,
              [meta.name]: event.target.value,
            }));
            setDialogError(null);
          }}
          className="h-8 rounded-md border border-input bg-transparent px-3 text-[14px]"
        >
          {!meta.required ? <option value="">Select</option> : null}
          {options.map((option) => (
            <option key={option} value={option}>
              {option.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      );
    }

    if (normalizedType === "boolean") {
      const booleanValue =
        rawValue === true ? "true" : rawValue === false ? "false" : valueAsString.toLowerCase();
      return (
        <select
          value={booleanValue}
          onChange={(event) => {
            setDraftParams((current) => ({
              ...current,
              [meta.name]: event.target.value,
            }));
            setDialogError(null);
          }}
          className="h-8 rounded-md border border-input bg-transparent px-3 text-[14px]"
        >
          <option value="">Select</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    }

    const numberType = normalizedType === "integer" || normalizedType === "number";
    return (
      <Input
        value={valueAsString}
        type={numberType ? "number" : "text"}
        step={normalizedType === "integer" ? "1" : "any"}
        onChange={(event) => {
          setDraftParams((current) => ({
            ...current,
            [meta.name]: event.target.value,
          }));
          setDialogError(null);
        }}
        className="h-8 rounded-md text-[14px]"
      />
    );
  }, [draftParams]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] max-w-[540px] gap-0 overflow-hidden rounded-xl border border-border bg-background p-0 shadow-lg">
        <div className="border-b border-border bg-background px-5 py-4">
          <DialogTitle className="text-[28px] font-semibold leading-none">
            {scriptName || "BB"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure script parameters and apply updates.
          </DialogDescription>
        </div>

        <div className="max-h-[56vh] overflow-auto bg-background px-5 py-5">
          {paramsMeta.length === 0 ? (
            <div className="text-sm text-muted-foreground">No configurable parameters.</div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-[120px,1fr] items-center gap-x-5 gap-y-3.5">
                {paramsMeta.map((meta) => (
                  <React.Fragment key={meta.name}>
                    <label className="text-[14px]">
                      {meta.name}
                      {meta.required ? " *" : ""}
                    </label>
                    <div className="space-y-1">
                      {renderField(meta)}
                      {meta.description ? (
                        <div className="text-[11px] text-muted-foreground">{meta.description}</div>
                      ) : null}
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
          {dialogError ? (
            <div className="mt-3 rounded border border-destructive/30 bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
              {dialogError}
            </div>
          ) : null}
        </div>

        <div className="flex  w-full items-center justify-between border-t border-border bg-background px-5 py-3">
          <button
            type="button"
            disabled={submitting}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-[15px] text-foreground/85"
            onClick={handleDefaults}
          >
            <span>Defaults</span>
          </button>

          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-md px-4 text-[15px] font-normal"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>

            <Button
              type="button"
              className="h-9 rounded-md px-4 text-[15px] font-normal"
              disabled={submitting}
              onClick={() => {
                void handleSubmit();
              }}
            >
              {submitting ? "Saving..." : "Ok"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
