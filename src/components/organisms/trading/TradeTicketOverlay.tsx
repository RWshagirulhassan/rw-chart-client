import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ChartRouteInstrument } from "@/app/chart/chartDomainTypes";
import {
  checkMargins,
  getCurrentTradingAccount,
  getFunds,
  placeOrder,
  TradingApiError,
  type FundsResponse,
  type MarginCheckResponse,
  type PlaceOrderRequest,
  type TradingAccountResponse,
} from "@/lib/api/trading";

type TradeSide = "BUY" | "SELL";
type TicketOrderType = "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT" | "GTT";

type TradeTicketOverlayProps = {
  instrument: ChartRouteInstrument;
  currentPrice: number | null;
};

const BUY_COLOR = "#299d90";
const SELL_COLOR = "#ef4444";

function formatMoney(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toPositiveInteger(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return null;
  }
  const rounded = Math.floor(n);
  if (rounded <= 0) {
    return null;
  }
  return rounded;
}

function toOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toPriceInput(value: number): string {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function mapOrderType(orderType: TicketOrderType): PlaceOrderRequest["orderType"] | null {
  switch (orderType) {
    case "MARKET":
      return "MARKET";
    case "LIMIT":
      return "LIMIT";
    case "STOP":
      return "SLM";
    case "STOP_LIMIT":
      return "SL";
    case "GTT":
      return null;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function linkedExitStatusText(status: string | null | undefined): string | null {
  if (!status) {
    return null;
  }
  switch (status) {
    case "PENDING":
      return "Exit plan pending (waiting for entry fill)";
    case "ACTIVE":
      return "Exit protection active";
    case "REARM_REQUIRED":
      return "Re-arm required: triggered exit order did not fill before session close";
    case "COMPLETED":
      return "Exit plan completed";
    case "CANCELLED":
      return "Exit plan cancelled";
    default:
      return null;
  }
}

export const TradeTicketOverlay: React.FC<TradeTicketOverlayProps> = ({
  instrument,
  currentPrice,
}) => {
  const triggerRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [side, setSide] = React.useState<TradeSide>("BUY");
  const [orderType, setOrderType] = React.useState<TicketOrderType>("MARKET");
  const [qtyInput, setQtyInput] = React.useState("1");
  const [priceInput, setPriceInput] = React.useState("");
  const [triggerPriceInput, setTriggerPriceInput] = React.useState("");
  const [intraday, setIntraday] = React.useState(true);

  const [tpEnabled, setTpEnabled] = React.useState(false);
  const [tpPriceInput, setTpPriceInput] = React.useState("");
  const [tpOffsetInput, setTpOffsetInput] = React.useState("0");
  const [slEnabled, setSlEnabled] = React.useState(false);
  const [slPriceInput, setSlPriceInput] = React.useState("");
  const [slOffsetInput, setSlOffsetInput] = React.useState("0");

  const [position, setPosition] = React.useState({ x: 24, y: 68 });

  const [account, setAccount] = React.useState<TradingAccountResponse | null>(
    null,
  );
  const [funds, setFunds] = React.useState<FundsResponse | null>(null);
  const [margin, setMargin] = React.useState<MarginCheckResponse | null>(null);

  const [loadingAccount, setLoadingAccount] = React.useState(false);
  const [loadingMargin, setLoadingMargin] = React.useState(false);
  const [placingOrder, setPlacingOrder] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(
    null,
  );

  const dragStateRef = React.useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const instrumentToken = React.useMemo(
    () => Number(instrument.instrumentToken),
    [instrument.instrumentToken],
  );

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const themedColor = side === "BUY" ? BUY_COLOR : SELL_COLOR;
  const currentPriceText = formatMoney(currentPrice);

  const refreshAccount = React.useCallback(async () => {
    setLoadingAccount(true);
    try {
      const current = await getCurrentTradingAccount();
      const nextFunds = await getFunds(current.accountId);
      setAccount(current);
      setFunds(nextFunds);
      setErrorMessage(null);
    } catch (error: unknown) {
      if (
        error instanceof TradingApiError &&
        error.status === 400 &&
        error.message.includes("No trading account linked to current user")
      ) {
        setAccount(null);
        setFunds(null);
        setMargin(null);
        setErrorMessage(
          "No trading account found. Connect paper account first from the Trading Account panel.",
        );
      } else {
        setErrorMessage(
          getErrorMessage(error, "Failed to load account for order placement."),
        );
      }
    } finally {
      setLoadingAccount(false);
    }
  }, []);

  const buildDraft = React.useCallback((): {
    draft: PlaceOrderRequest | null;
    reason?: string;
  } => {
    if (!Number.isFinite(instrumentToken) || instrumentToken <= 0) {
      return { draft: null, reason: "Invalid instrument token." };
    }

    const backendOrderType = mapOrderType(orderType);
    if (!backendOrderType) {
      return { draft: null, reason: "Triggered/GTT is coming soon." };
    }

    const qty = toPositiveInteger(qtyInput);
    if (!qty) {
      return {
        draft: null,
        reason: "Quantity must be a positive whole number.",
      };
    }

    const requiresLimitPrice = orderType === "LIMIT" || orderType === "STOP_LIMIT";
    const requiresTriggerPrice = orderType === "STOP" || orderType === "STOP_LIMIT";

    const priceValue = toOptionalNumber(priceInput);
    const triggerValue = toOptionalNumber(triggerPriceInput);

    if (requiresLimitPrice && priceValue == null) {
      return { draft: null, reason: "Limit order requires price." };
    }

    if (requiresTriggerPrice && triggerValue == null) {
      return { draft: null, reason: "Stop order requires trigger price." };
    }

    const entryRefPrice =
      priceValue ??
      (Number.isFinite(currentPrice) ? Number(currentPrice) : null) ??
      triggerValue;

    const tpPrice = tpEnabled ? toOptionalNumber(tpPriceInput) : null;
    const slPrice = slEnabled ? toOptionalNumber(slPriceInput) : null;
    const tpOffset = tpEnabled ? toOptionalNumber(tpOffsetInput) ?? 0 : 0;
    const slOffset = slEnabled ? toOptionalNumber(slOffsetInput) ?? 0 : 0;

    if (tpEnabled) {
      if (tpPrice == null || tpPrice <= 0) {
        return { draft: null, reason: "Take Profit requires a valid trigger price." };
      }
      if (tpOffset < 0) {
        return { draft: null, reason: "Take Profit limit offset must be >= 0." };
      }
      if (entryRefPrice == null) {
        return { draft: null, reason: "Unable to validate TP without entry reference price." };
      }
      if (side === "BUY" && tpPrice <= entryRefPrice) {
        return { draft: null, reason: "For BUY, Take Profit must be above entry reference price." };
      }
      if (side === "SELL" && tpPrice >= entryRefPrice) {
        return { draft: null, reason: "For SELL, Take Profit must be below entry reference price." };
      }
    }

    if (slEnabled) {
      if (slPrice == null || slPrice <= 0) {
        return { draft: null, reason: "Stop Loss requires a valid trigger price." };
      }
      if (slOffset < 0) {
        return { draft: null, reason: "Stop Loss limit offset must be >= 0." };
      }
      if (entryRefPrice == null) {
        return { draft: null, reason: "Unable to validate SL without entry reference price." };
      }
      if (side === "BUY" && slPrice >= entryRefPrice) {
        return { draft: null, reason: "For BUY, Stop Loss must be below entry reference price." };
      }
      if (side === "SELL" && slPrice <= entryRefPrice) {
        return { draft: null, reason: "For SELL, Stop Loss must be above entry reference price." };
      }
    }

    return {
      draft: {
        instrumentToken,
        tradingsymbol: instrument.tradingsymbol,
        exchange: instrument.exchange,
        product: intraday ? "MIS" : "NRML",
        orderType: backendOrderType,
        side,
        qty,
        price: requiresLimitPrice ? priceValue : null,
        triggerPrice: requiresTriggerPrice ? triggerValue : null,
        reason: "manual_ticket",
        attachments:
          tpEnabled || slEnabled
            ? {
                armPolicy: "AFTER_ENTRY_FILLED",
                takeProfit: tpEnabled
                  ? {
                      enabled: true,
                      triggerPrice: tpPrice,
                      limitOffset: tpOffset,
                    }
                  : {
                      enabled: false,
                    },
                stopLoss: slEnabled
                  ? {
                      enabled: true,
                      triggerPrice: slPrice,
                      limitOffset: slOffset,
                    }
                  : {
                      enabled: false,
                    },
              }
            : null,
      },
    };
  }, [
    instrument.exchange,
    instrument.tradingsymbol,
    instrumentToken,
    intraday,
    orderType,
    priceInput,
    qtyInput,
    side,
    slEnabled,
    slOffsetInput,
    slPriceInput,
    tpEnabled,
    tpOffsetInput,
    tpPriceInput,
    triggerPriceInput,
    currentPrice,
  ]);

  const refreshMargin = React.useCallback(async () => {
    if (!open || !account?.accountId) {
      setMargin(null);
      return;
    }

    const { draft } = buildDraft();
    if (!draft) {
      setMargin(null);
      return;
    }

    const { attachments: _attachments, ...marginDraft } = draft;

    setLoadingMargin(true);
    try {
      const nextMargin = await checkMargins(account.accountId, [marginDraft]);
      setMargin(nextMargin);
    } catch (error: unknown) {
      setMargin(null);
      setErrorMessage(getErrorMessage(error, "Failed to check margin."));
    } finally {
      setLoadingMargin(false);
    }
  }, [account?.accountId, buildDraft, open]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    void refreshAccount();
  }, [open, refreshAccount]);

  React.useEffect(() => {
    if (!open || !account?.accountId) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshMargin();
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    account?.accountId,
    buildDraft,
    intraday,
    open,
    orderType,
    priceInput,
    qtyInput,
    refreshMargin,
    side,
    slEnabled,
    slOffsetInput,
    slPriceInput,
    tpEnabled,
    tpOffsetInput,
    tpPriceInput,
    triggerPriceInput,
  ]);

  const openTicket = React.useCallback((nextSide: TradeSide) => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({
        x: Math.max(8, Math.round(rect.left)),
        y: Math.max(8, Math.round(rect.bottom + 8)),
      });
    }
    setSide(nextSide);
    setOpen(true);
    setErrorMessage(null);
    setSuccessMessage(null);
  }, []);

  const onDragStart = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("label")
      ) {
        return;
      }

      event.preventDefault();
      dragStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: position.x,
        originY: position.y,
      };

      const onMouseMove = (moveEvent: MouseEvent) => {
        const state = dragStateRef.current;
        if (!state) {
          return;
        }
        const nextX = Math.max(
          8,
          state.originX + (moveEvent.clientX - state.startX),
        );
        const nextY = Math.max(
          8,
          state.originY + (moveEvent.clientY - state.startY),
        );
        setPosition({ x: nextX, y: nextY });
      };

      const onMouseUp = () => {
        dragStateRef.current = null;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    },
    [position.x, position.y],
  );

  const submitOrder = React.useCallback(async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!account?.accountId) {
      setErrorMessage(
        "Connect paper account first from Trading Account panel.",
      );
      return;
    }

    const { draft, reason } = buildDraft();
    if (!draft) {
      setErrorMessage(reason ?? "Invalid order request.");
      return;
    }

    setPlacingOrder(true);
    try {
      const placed = await placeOrder(account.accountId, draft);
      const linkedSummary = placed.linkedExit
        ? ` | ExitPlan ${placed.linkedExit.exitPlanId} (${placed.linkedExit.status})`
        : "";
      const linkedStatus = linkedExitStatusText(placed.linkedExit?.status);
      const linkedText = linkedStatus ? ` | ${linkedStatus}` : "";
      setSuccessMessage(
        `Order placed: ${placed.order.orderId} (${placed.order.status})${linkedSummary}${linkedText}`,
      );
      const nextFunds = await getFunds(account.accountId);
      setFunds(nextFunds);
      void refreshMargin();
    } catch (error: unknown) {
      setErrorMessage(getErrorMessage(error, "Failed to place order."));
    } finally {
      setPlacingOrder(false);
    }
  }, [account?.accountId, buildDraft, refreshMargin]);

  const applyTpPreset = React.useCallback(
    (percent: number) => {
      const base =
        toOptionalNumber(priceInput) ??
        (Number.isFinite(currentPrice) ? Number(currentPrice) : null) ??
        toOptionalNumber(triggerPriceInput);
      if (!base || !tpEnabled) {
        return;
      }
      const multiplier = side === "BUY" ? 1 + percent / 100 : 1 - percent / 100;
      setTpPriceInput(toPriceInput(base * multiplier));
    },
    [currentPrice, priceInput, side, tpEnabled, triggerPriceInput],
  );

  const applySlPreset = React.useCallback(
    (percent: number) => {
      const base =
        toOptionalNumber(priceInput) ??
        (Number.isFinite(currentPrice) ? Number(currentPrice) : null) ??
        toOptionalNumber(triggerPriceInput);
      if (!base || !slEnabled) {
        return;
      }
      const multiplier = side === "BUY" ? 1 - percent / 100 : 1 + percent / 100;
      setSlPriceInput(toPriceInput(base * multiplier));
    },
    [currentPrice, priceInput, side, slEnabled, triggerPriceInput],
  );

  const marginRequired = margin?.requiredMargin ?? null;
  const availableMargin = funds?.availableMargin ?? null;

  const qty = toPositiveInteger(qtyInput) ?? 0;
  const entryRef =
    toOptionalNumber(priceInput) ??
    (Number.isFinite(currentPrice) ? Number(currentPrice) : null) ??
    toOptionalNumber(triggerPriceInput);
  const tpPreviewPrice = tpEnabled ? toOptionalNumber(tpPriceInput) : null;
  const slPreviewPrice = slEnabled ? toOptionalNumber(slPriceInput) : null;

  const tpPreviewPnl =
    entryRef != null && tpPreviewPrice != null && qty > 0
      ? (side === "BUY" ? tpPreviewPrice - entryRef : entryRef - tpPreviewPrice) * qty
      : null;
  const slPreviewPnl =
    entryRef != null && slPreviewPrice != null && qty > 0
      ? (side === "BUY" ? slPreviewPrice - entryRef : entryRef - slPreviewPrice) * qty
      : null;

  const { reason: draftErrorReason } = buildDraft();
  const submitDisabled =
    placingOrder || loadingAccount || !!draftErrorReason || !account?.accountId;

  const ticketPopup = open ? (
    <div
      className="fixed w-[390px] border bg-background shadow-2xl"
      style={{ left: position.x, top: position.y, zIndex: 2147483000 }}
    >
      <div
        className="cursor-move px-4 py-3 text-white"
        style={{ backgroundColor: themedColor }}
        onMouseDown={onDragStart}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold leading-tight">
              {instrument.tradingsymbol}
            </div>
            <div className="mt-1 text-sm opacity-90">
              {instrument.exchange} Rs{currentPriceText}
            </div>
            <div className="mt-1 text-xs opacity-80">
              {account?.accountId ?? "No account"}
            </div>
          </div>
          <button
            type="button"
            className="rounded bg-white/20 px-2 py-1 text-xs"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>

        <div className="mt-3 flex overflow-hidden rounded border border-white/40 text-sm">
          <button
            type="button"
            className={`flex-1 py-1 font-medium ${side === "BUY" ? "bg-white/25" : "bg-transparent"}`}
            onClick={() => setSide("BUY")}
          >
            BUY
          </button>
          <button
            type="button"
            className={`flex-1 py-1 font-medium ${side === "SELL" ? "bg-white/25" : "bg-transparent"}`}
            onClick={() => setSide("SELL")}
          >
            SELL
          </button>
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-muted-foreground">
            Qty
            <Input
              type="number"
              min="1"
              step="1"
              value={qtyInput}
              onChange={(event) => setQtyInput(event.target.value)}
              className="mt-1"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Order Type
            <select
              value={orderType}
              onChange={(event) =>
                setOrderType(event.target.value as TicketOrderType)
              }
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              <option value="MARKET">Market</option>
              <option value="LIMIT">Limit</option>
              <option value="STOP">Stop</option>
              <option value="STOP_LIMIT">Stop-Limit</option>
              <option value="GTT" disabled>
                Triggered/GTT (Coming soon)
              </option>
            </select>
          </label>
        </div>

        {orderType === "LIMIT" || orderType === "STOP_LIMIT" ? (
          <label className="text-xs text-muted-foreground block">
            Limit Price
            <Input
              type="number"
              min="0"
              step="0.05"
              value={priceInput}
              onChange={(event) => setPriceInput(event.target.value)}
              className="mt-1"
              placeholder={currentPrice == null ? "" : String(currentPrice)}
            />
          </label>
        ) : null}

        {orderType === "STOP" || orderType === "STOP_LIMIT" ? (
          <label className="text-xs text-muted-foreground block">
            Trigger Price
            <Input
              type="number"
              min="0"
              step="0.05"
              value={triggerPriceInput}
              onChange={(event) => setTriggerPriceInput(event.target.value)}
              className="mt-1"
              placeholder={currentPrice == null ? "" : String(currentPrice)}
            />
          </label>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={intraday}
            onChange={(event) => setIntraday(event.target.checked)}
          />
          Intraday (MIS)
        </label>

        <div className="space-y-2 rounded border bg-muted/20 px-3 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Attachments</span>
            <span className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              Arm after fill
            </span>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={tpEnabled}
              onChange={(event) => setTpEnabled(event.target.checked)}
            />
            Take Profit
          </label>
          {tpEnabled ? (
            <div className="grid grid-cols-2 gap-2 pl-5">
              <label className="text-[11px] text-muted-foreground">
                TP Trigger Price
                <Input
                  type="number"
                  min="0"
                  step="0.05"
                  value={tpPriceInput}
                  onChange={(event) => setTpPriceInput(event.target.value)}
                  className="mt-1"
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                Limit Offset
                <Input
                  type="number"
                  min="0"
                  step="0.05"
                  value={tpOffsetInput}
                  onChange={(event) => setTpOffsetInput(event.target.value)}
                  className="mt-1"
                />
              </label>
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={slEnabled}
              onChange={(event) => setSlEnabled(event.target.checked)}
            />
            Stop Loss
          </label>
          {slEnabled ? (
            <div className="grid grid-cols-2 gap-2 pl-5">
              <label className="text-[11px] text-muted-foreground">
                SL Trigger Price
                <Input
                  type="number"
                  min="0"
                  step="0.05"
                  value={slPriceInput}
                  onChange={(event) => setSlPriceInput(event.target.value)}
                  className="mt-1"
                />
              </label>
              <label className="text-[11px] text-muted-foreground">
                Limit Offset
                <Input
                  type="number"
                  min="0"
                  step="0.05"
                  value={slOffsetInput}
                  onChange={(event) => setSlOffsetInput(event.target.value)}
                  className="mt-1"
                />
              </label>
            </div>
          ) : null}

          {tpEnabled && slEnabled ? (
            <div className="rounded border border-muted-foreground/30 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
              <div className="font-medium text-foreground">OCO Exit (TP + SL)</div>
              <div>One cancels the other</div>
            </div>
          ) : null}

          <div className="space-y-1">
            <div className="text-[11px] text-muted-foreground">Quick chips</div>
            <div className="flex flex-wrap items-center gap-1">
              {[1, 2, 3].map((pct) => (
                <button
                  key={`tp-chip-${pct}`}
                  type="button"
                  className="rounded border px-2 py-0.5 text-[11px]"
                  onClick={() => applyTpPreset(pct)}
                  disabled={!tpEnabled}
                >
                  +{pct}%
                </button>
              ))}
              {[1, 2, 3].map((pct) => (
                <button
                  key={`sl-chip-${pct}`}
                  type="button"
                  className="rounded border px-2 py-0.5 text-[11px]"
                  onClick={() => applySlPreset(pct)}
                  disabled={!slEnabled}
                >
                  -{pct}%
                </button>
              ))}
            </div>
          </div>

          {tpEnabled || slEnabled ? (
            <div className="rounded border bg-background px-2 py-1 text-[11px]">
              <div className="font-medium">Estimated P&L Preview</div>
              <div className="mt-1 flex items-center justify-between">
                <span>TP P&L</span>
                <span className="text-emerald-600">
                  {tpPreviewPnl == null ? "-" : `Rs${formatMoney(tpPreviewPnl)}`}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between">
                <span>SL P&L</span>
                <span className="text-rose-600">
                  {slPreviewPnl == null ? "-" : `Rs${formatMoney(slPreviewPnl)}`}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded border bg-muted/30 px-3 py-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Req.</span>
            <span>
              {loadingMargin
                ? "Checking..."
                : `Rs${formatMoney(marginRequired)}`}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Avail.</span>
            <span>Rs{formatMoney(availableMargin)}</span>
          </div>
          {margin?.message ? (
            <div className="mt-2 text-xs text-muted-foreground">
              {margin.message}
            </div>
          ) : null}
          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => {
                void refreshAccount();
                void refreshMargin();
              }}
            >
              Refresh
            </Button>
          </div>
        </div>

        {draftErrorReason ? (
          <div className="text-xs text-destructive">{draftErrorReason}</div>
        ) : null}
        {errorMessage ? (
          <div className="text-xs text-destructive">{errorMessage}</div>
        ) : null}
        {successMessage ? (
          <div className="text-xs text-emerald-600">{successMessage}</div>
        ) : null}

        <div className="space-y-2 pt-1">
          <Button
            type="button"
            className="h-10 w-full rounded-none text-base"
            style={{ backgroundColor: themedColor }}
            disabled={submitDisabled}
            onClick={() => {
              void submitOrder();
            }}
          >
            {placingOrder ? "Placing..." : side}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full rounded-none text-base"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div
        ref={triggerRef}
        className="absolute left-3 top-3 z-30 flex items-center gap-2 "
      >
        <button
          type="button"
          className="min-w-[74px] rounded-none px-2.5 py-1 text-white shadow"
          style={{ backgroundColor: BUY_COLOR }}
          onClick={() => openTicket("BUY")}
        >
          <div className="text-sm font-semibold leading-none">
            {currentPriceText}
          </div>
          <div className="text-xs leading-4 font-light">BUY</div>
        </button>
        <button
          type="button"
          className="min-w-[74px] rounded-none px-2.5 py-1 text-white shadow"
          style={{ backgroundColor: SELL_COLOR }}
          onClick={() => openTicket("SELL")}
        >
          <div className="text-sm font-semibold leading-none">
            {currentPriceText}
          </div>
          <div className="text-xs leading-4 font-light">SELL</div>
        </button>
      </div>
      {mounted && ticketPopup ? createPortal(ticketPopup, document.body) : null}
    </>
  );
};
