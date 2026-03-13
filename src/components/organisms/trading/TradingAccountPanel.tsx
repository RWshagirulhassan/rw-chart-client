import * as React from "react";
import { Panel } from "@/components/atoms/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createPaperTradingAccount,
  getCurrentTradingAccount,
  getFunds,
  getOrders,
  getOrderTimeline,
  getPositions,
  type FundsResponse,
  type OrderTimelineRowResponse,
  type OrderResponse,
  type PositionResponse,
  TradingApiError,
  type TradingAccountResponse,
} from "@/lib/api/trading";
import { connectTradingWs, type TradingWsConnection } from "@/lib/ws/tradingWs";
import { cn } from "@/lib/utils";

type ConnectorType = "paper" | "kite";

type AccountTab = {
  id: "positions" | "orders" | "order-history" | "balance-history" | "trading-journal";
  label: string;
  columns: Array<{ key: string; label: string; className?: string }>;
  rows: Array<Record<string, React.ReactNode>>;
  emptyMessage?: string;
  tableClassName?: string;
};

const DEFAULT_OPENING_BALANCE = "10000";

const ORDER_COLUMNS: Array<{ key: string; label: string; className?: string }> = [
  { key: "orderId", label: "Order ID" },
  { key: "symbol", label: "Symbol" },
  { key: "side", label: "Side" },
  { key: "type", label: "Type" },
  { key: "qty", label: "Qty", className: "text-right" },
  { key: "price", label: "Price", className: "text-right" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Created At" },
];

const POSITION_COLUMNS: Array<{ key: string; label: string; className?: string }> = [
  { key: "symbol", label: "Symbol" },
  { key: "side", label: "Side" },
  { key: "qty", label: "Qty", className: "text-right" },
  { key: "avgFillPrice", label: "Avg Fill Price", className: "text-right" },
  { key: "takeProfit", label: "Take Profit", className: "text-right" },
  { key: "stopLoss", label: "Stop Loss", className: "text-right" },
  { key: "lastPrice", label: "Last Price", className: "text-right" },
  { key: "unrealizedPnl", label: "Unrealized P&L", className: "text-right" },
  { key: "unrealizedPnlPercent", label: "Unrealized P&L %", className: "text-right" },
  { key: "tradeValue", label: "Trade Value", className: "text-right" },
  { key: "marketValue", label: "Market Value", className: "text-right" },
];

const HISTORY_COLUMNS: Array<{ key: string; label: string; className?: string }> = [
  { key: "orderId", label: "Order ID" },
  { key: "symbol", label: "Symbol" },
  { key: "side", label: "Side" },
  { key: "type", label: "Type" },
  { key: "qty", label: "Qty", className: "text-right" },
  { key: "avgFillPrice", label: "Avg Fill Price", className: "text-right" },
  { key: "status", label: "Status" },
  { key: "updatedAt", label: "Updated At" },
];

const BALANCE_HISTORY_COLUMNS: Array<{ key: string; label: string; className?: string }> = [
  { key: "date", label: "Date" },
  { key: "openingBalance", label: "openingBalance", className: "text-right" },
  { key: "availableCash", label: "availableCash", className: "text-right" },
  { key: "utilisedMargin", label: "utilisedMargin", className: "text-right" },
  { key: "availableMargin", label: "availableMargin", className: "text-right" },
];

const JOURNAL_COLUMNS: Array<{ key: string; label: string; className?: string }> = [
  { key: "date", label: "Date" },
  { key: "instrument", label: "Instrument" },
  { key: "setup", label: "Setup" },
  { key: "note", label: "Note" },
  { key: "result", label: "Result", className: "text-right" },
];

const AccountTabTable: React.FC<{ tab: AccountTab }> = ({ tab }) => (
  <ScrollArea className="h-full">
    <div className="h-full min-h-0">
      <Table className={cn("text-xs", tab.tableClassName)}>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow className="hover:bg-transparent">
            {tab.columns.map((column) => (
              <TableHead
                key={`${tab.id}-${column.key}`}
                className={cn("h-9 px-3 text-[11px]", column.className)}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {tab.rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={tab.columns.length}
                className="h-44 px-3 text-center text-sm text-muted-foreground"
              >
                {tab.emptyMessage ?? "No records available yet."}
              </TableCell>
            </TableRow>
          ) : (
            tab.rows.map((row, rowIndex) => (
              <TableRow key={`${tab.id}-row-${rowIndex}`}>
                {tab.columns.map((column) => (
                  <TableCell
                    key={`${tab.id}-${rowIndex}-${column.key}`}
                    className={cn("px-3 py-2 text-xs", column.className)}
                  >
                    {row[column.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  </ScrollArea>
);

function formatAmount(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value: number | null | undefined): string {
  if (!Number.isFinite(value)) {
    return "-";
  }
  return new Date(Number(value)).toLocaleString();
}

function parseOpeningBalance(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 10000;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function statusLabel(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) {
    return "-";
  }
  return raw
    .trim()
    .toLowerCase()
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function statusBadgeVariant(status: string): "secondary" | "destructive" | "outline" {
  if (status === "REJECTED" || status === "REARM_REQUIRED") {
    return "destructive";
  }
  if (status === "FILLED" || status === "OPEN" || status === "PARTIALLY_FILLED" || status === "ARMED") {
    return "secondary";
  }
  return "outline";
}

export const TradingAccountPanel: React.FC = () => {
  const wsRef = React.useRef<TradingWsConnection | null>(null);
  const wsSessionRef = React.useRef(0);
  const refreshTimerRef = React.useRef<number | null>(null);
  const timelineRefreshTimerRef = React.useRef<number | null>(null);
  const fundsRefreshTimerRef = React.useRef<number | null>(null);
  const positionsRefreshTimerRef = React.useRef<number | null>(null);
  const ordersRefreshTimerRef = React.useRef<number | null>(null);
  const activeAccountIdRef = React.useRef<string | null>(null);

  const [connector, setConnector] = React.useState<ConnectorType>("paper");
  const [isConnected, setIsConnected] = React.useState(false);
  const [connectPending, setConnectPending] = React.useState(false);
  const [previewLoading, setPreviewLoading] = React.useState(true);

  const [openingBalanceInput, setOpeningBalanceInput] = React.useState(DEFAULT_OPENING_BALANCE);
  const [existingAccountPreview, setExistingAccountPreview] =
    React.useState<TradingAccountResponse | null>(null);
  const [activeAccount, setActiveAccount] = React.useState<TradingAccountResponse | null>(null);

  const [funds, setFunds] = React.useState<FundsResponse | null>(null);
  const [orders, setOrders] = React.useState<OrderResponse[]>([]);
  const [orderTimeline, setOrderTimeline] = React.useState<OrderTimelineRowResponse[]>([]);
  const [positions, setPositions] = React.useState<PositionResponse[]>([]);

  const [panelError, setPanelError] = React.useState<string | null>(null);
  const [wsState, setWsState] = React.useState<"DISCONNECTED" | "CONNECTING" | "OPEN" | "CLOSED" | "ERROR">(
    "DISCONNECTED",
  );

  React.useEffect(() => {
    activeAccountIdRef.current = activeAccount?.accountId ?? null;
  }, [activeAccount]);

  const buildFallbackTimeline = React.useCallback(
    (rawOrders: OrderResponse[]): OrderTimelineRowResponse[] =>
      rawOrders
        .filter((order) => !order.role || order.role === "ENTRY")
        .map((order) => ({
          rowId: `order:${order.orderId}`,
          rowType: "ENTRY_ORDER" as const,
          parentOrderId: null,
          entryOrderId: order.orderId,
          exitPlanId: order.exitPlanId,
          triggerId: order.triggerId,
          linkedOrderId: null,
          legType: null,
          instrumentToken: order.instrumentToken,
          tradingsymbol: order.tradingsymbol,
          exchange: order.exchange,
          side: order.side,
          qty: order.qty,
          orderType: order.orderType,
          price: order.price,
          triggerPrice: order.triggerPrice,
          limitOffset: null,
          status: order.status === "PARTIAL" ? "PARTIALLY_FILLED" : order.status,
          statusReason: order.rejectionReason,
          createdAtEpochMs: order.createdAtEpochMs,
          updatedAtEpochMs: order.updatedAtEpochMs,
          sortTsEpochMs: order.createdAtEpochMs,
        }))
        .sort((left, right) => right.sortTsEpochMs - left.sortTsEpochMs),
    [],
  );

  const loadFundsOnly = React.useCallback(async (accountId: string) => {
    const nextFunds = await getFunds(accountId);
    setFunds(nextFunds);
  }, []);

  const loadPositionsOnly = React.useCallback(async (accountId: string) => {
    const nextPositions = await getPositions(accountId);
    setPositions(Array.isArray(nextPositions) ? nextPositions : []);
  }, []);

  const loadOrdersOnly = React.useCallback(async (accountId: string) => {
    const nextOrders = await getOrders(accountId);
    const normalizedOrders = Array.isArray(nextOrders) ? nextOrders : [];
    setOrders(normalizedOrders);
    setOrderTimeline((prev) => {
      if (prev.some((row) => row.rowType === "LINKED_EXIT")) {
        return prev;
      }
      return buildFallbackTimeline(normalizedOrders);
    });
  }, [buildFallbackTimeline]);

  const loadTimelineOnly = React.useCallback(async (accountId: string) => {
    try {
      const nextTimeline = await getOrderTimeline(accountId, { includeTerminal: true, limit: 500 });
      setOrderTimeline(Array.isArray(nextTimeline) ? nextTimeline : []);
    } catch {
      // fall back to raw orders projection when timeline endpoint is unavailable
      setOrderTimeline((prev) => {
        if (prev.length > 0) {
          return prev;
        }
        return buildFallbackTimeline(orders);
      });
    }
  }, [buildFallbackTimeline, orders]);

  const loadAccountData = React.useCallback(async (accountId: string) => {
    const [nextFunds, nextOrders, nextPositions, nextTimeline] = await Promise.all([
      getFunds(accountId),
      getOrders(accountId),
      getPositions(accountId),
      getOrderTimeline(accountId, { includeTerminal: true, limit: 500 }).catch(() => null),
    ]);
    const normalizedOrders = Array.isArray(nextOrders) ? nextOrders : [];
    setFunds(nextFunds);
    setOrders(normalizedOrders);
    setPositions(Array.isArray(nextPositions) ? nextPositions : []);
    if (Array.isArray(nextTimeline)) {
      setOrderTimeline(nextTimeline);
    } else {
      setOrderTimeline(buildFallbackTimeline(normalizedOrders));
    }
  }, [buildFallbackTimeline]);

  const closeTradingWs = React.useCallback(() => {
    wsSessionRef.current += 1;

    if (refreshTimerRef.current != null) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (timelineRefreshTimerRef.current != null) {
      window.clearTimeout(timelineRefreshTimerRef.current);
      timelineRefreshTimerRef.current = null;
    }
    if (fundsRefreshTimerRef.current != null) {
      window.clearTimeout(fundsRefreshTimerRef.current);
      fundsRefreshTimerRef.current = null;
    }
    if (positionsRefreshTimerRef.current != null) {
      window.clearTimeout(positionsRefreshTimerRef.current);
      positionsRefreshTimerRef.current = null;
    }
    if (ordersRefreshTimerRef.current != null) {
      window.clearTimeout(ordersRefreshTimerRef.current);
      ordersRefreshTimerRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setWsState("DISCONNECTED");
  }, []);

  const scheduleRefresh = React.useCallback(() => {
    if (refreshTimerRef.current != null) {
      return;
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      const accountId = activeAccountIdRef.current;
      if (!accountId) {
        return;
      }
      void loadAccountData(accountId).catch((error: any) => {
        setPanelError(error?.message ?? "Failed to refresh account data.");
      });
    }, 300);
  }, [loadAccountData]);

  const scheduleTimelineRefresh = React.useCallback(() => {
    if (timelineRefreshTimerRef.current != null) {
      return;
    }
    timelineRefreshTimerRef.current = window.setTimeout(() => {
      timelineRefreshTimerRef.current = null;
      const accountId = activeAccountIdRef.current;
      if (!accountId) {
        return;
      }
      void loadTimelineOnly(accountId).catch((error: any) => {
        setPanelError(error?.message ?? "Failed to refresh order timeline.");
      });
    }, 220);
  }, [loadTimelineOnly]);

  const scheduleFundsRefresh = React.useCallback(() => {
    if (fundsRefreshTimerRef.current != null) {
      return;
    }
    fundsRefreshTimerRef.current = window.setTimeout(() => {
      fundsRefreshTimerRef.current = null;
      const accountId = activeAccountIdRef.current;
      if (!accountId) {
        return;
      }
      void loadFundsOnly(accountId).catch((error: any) => {
        setPanelError(error?.message ?? "Failed to refresh funds.");
      });
    }, 220);
  }, [loadFundsOnly]);

  const schedulePositionsRefresh = React.useCallback(() => {
    if (positionsRefreshTimerRef.current != null) {
      return;
    }
    positionsRefreshTimerRef.current = window.setTimeout(() => {
      positionsRefreshTimerRef.current = null;
      const accountId = activeAccountIdRef.current;
      if (!accountId) {
        return;
      }
      void loadPositionsOnly(accountId).catch((error: any) => {
        setPanelError(error?.message ?? "Failed to refresh positions.");
      });
    }, 220);
  }, [loadPositionsOnly]);

  const scheduleOrdersRefresh = React.useCallback(() => {
    if (ordersRefreshTimerRef.current != null) {
      return;
    }
    ordersRefreshTimerRef.current = window.setTimeout(() => {
      ordersRefreshTimerRef.current = null;
      const accountId = activeAccountIdRef.current;
      if (!accountId) {
        return;
      }
      void loadOrdersOnly(accountId).catch((error: any) => {
        setPanelError(error?.message ?? "Failed to refresh orders.");
      });
    }, 220);
  }, [loadOrdersOnly]);

  const openTradingWs = React.useCallback(
    (accountId: string) => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      const wsSession = wsSessionRef.current + 1;
      wsSessionRef.current = wsSession;

      setWsState("CONNECTING");
      wsRef.current = connectTradingWs(accountId, {
        onOpen: () => {
          if (wsSessionRef.current !== wsSession) {
            return;
          }
          setWsState("OPEN");
        },
        onClose: () => {
          if (wsSessionRef.current !== wsSession) {
            return;
          }
          setWsState((prev) => (prev === "ERROR" ? "ERROR" : "CLOSED"));
        },
        onError: (message) => {
          if (wsSessionRef.current !== wsSession) {
            return;
          }
          setPanelError(message);
          setWsState("ERROR");
        },
        onEnvelope: (envelope) => {
          if (wsSessionRef.current !== wsSession) {
            return;
          }
          if (envelope.type === "meta") {
            setWsState("OPEN");
            return;
          }

          if (envelope.type === "error") {
            const maybeMessage = (envelope.data as { message?: unknown } | undefined)?.message;
            setPanelError(
              typeof maybeMessage === "string" && maybeMessage.trim()
                ? maybeMessage
                : "Trading websocket error",
            );
            setWsState("ERROR");
            return;
          }

          if (envelope.type === "trading_event") {
            const maybeEvent = envelope.data as { type?: unknown } | undefined;
            const eventType =
              typeof maybeEvent?.type === "string" ? maybeEvent.type : null;
            if (!eventType) {
              scheduleRefresh();
              return;
            }

            if (eventType === "ORDER_TIMELINE_UPDATED") {
              scheduleTimelineRefresh();
              return;
            }

            if (eventType === "FUNDS_UPDATED") {
              scheduleFundsRefresh();
              return;
            }

            if (eventType === "POSITION_UPDATED") {
              schedulePositionsRefresh();
              return;
            }

            if (eventType === "ORDER_ACCEPTED" || eventType === "ORDER_UPDATED" || eventType === "ORDER_REJECTED") {
              scheduleOrdersRefresh();
              scheduleTimelineRefresh();
              return;
            }

            if (
              eventType === "EXIT_PLAN_CREATED" ||
              eventType === "EXIT_PLAN_ARMED" ||
              eventType === "TRIGGER_UPDATED" ||
              eventType === "TRIGGER_TRIGGERED" ||
              eventType === "OCO_LEG_CANCELLED" ||
              eventType === "EXIT_PLAN_COMPLETED" ||
              eventType === "EXIT_PLAN_REARM_REQUIRED"
            ) {
              scheduleTimelineRefresh();
              return;
            }

            if (eventType === "FILL_ADDED") {
              scheduleOrdersRefresh();
              schedulePositionsRefresh();
              scheduleFundsRefresh();
              scheduleTimelineRefresh();
              return;
            }

            scheduleRefresh();
          }
        },
      });
    },
    [
      scheduleFundsRefresh,
      scheduleOrdersRefresh,
      schedulePositionsRefresh,
      scheduleRefresh,
      scheduleTimelineRefresh,
    ],
  );

  React.useEffect(() => {
    let mounted = true;

    const bootstrapPreview = async () => {
      setPreviewLoading(true);
      setPanelError(null);
      try {
        const current = await getCurrentTradingAccount();
        if (!mounted) {
          return;
        }
        setExistingAccountPreview(current);
      } catch (error: any) {
        if (!mounted) {
          return;
        }
        if (
          error instanceof TradingApiError &&
          error.status === 400 &&
          typeof error.message === "string" &&
          error.message.includes("No trading account linked to current user")
        ) {
          setExistingAccountPreview(null);
        } else {
          setPanelError(error?.message ?? "Failed to load current trading account.");
        }
      } finally {
        if (mounted) {
          setPreviewLoading(false);
        }
      }
    };

    void bootstrapPreview();

    return () => {
      mounted = false;
      closeTradingWs();
    };
  }, [closeTradingWs]);

  const handleConnect = React.useCallback(async () => {
    if (connector !== "paper") {
      return;
    }

    setConnectPending(true);
    setPanelError(null);

    try {
      let account = existingAccountPreview;
      if (!account) {
        const openingBalance = parseOpeningBalance(openingBalanceInput);
        if (openingBalance == null) {
          throw new Error("Opening balance must be a non-negative number.");
        }
        account = await createPaperTradingAccount(openingBalance);
        setExistingAccountPreview(account);
      }

      setActiveAccount(account);
      setIsConnected(true);

      await loadAccountData(account.accountId);
      openTradingWs(account.accountId);
    } catch (error: any) {
      setPanelError(error?.message ?? "Failed to connect paper account.");
      setActiveAccount(null);
      setIsConnected(false);
      closeTradingWs();
    } finally {
      setConnectPending(false);
    }
  }, [
    closeTradingWs,
    connector,
    existingAccountPreview,
    loadAccountData,
    openTradingWs,
    openingBalanceInput,
  ]);

  const handleDisconnect = React.useCallback(() => {
    closeTradingWs();
    setIsConnected(false);
    setActiveAccount(null);
    setFunds(null);
    setOrders([]);
    setOrderTimeline([]);
    setPositions([]);
    setPanelError(null);
  }, [closeTradingWs]);

  const accountTabs = React.useMemo<AccountTab[]>(() => {
    const positionRows = positions.map((position) => {
      const qty = Math.abs(position.netQty);
      const tradeValue = qty * position.avgPrice;
      const marketValue = qty * position.lastPrice;
      const unrealizedPct = qty > 0 && position.avgPrice > 0
        ? (position.unrealizedPnl / tradeValue) * 100
        : null;

      return {
        symbol: position.tradingsymbol || String(position.instrumentToken),
        side: position.netQty > 0 ? "BUY" : position.netQty < 0 ? "SELL" : "-",
        qty: String(qty),
        avgFillPrice: formatAmount(position.avgPrice),
        takeProfit: "-",
        stopLoss: "-",
        lastPrice: formatAmount(position.lastPrice),
        unrealizedPnl: formatAmount(position.unrealizedPnl),
        unrealizedPnlPercent: unrealizedPct == null ? "-" : `${formatAmount(unrealizedPct)}%`,
        tradeValue: formatAmount(tradeValue),
        marketValue: formatAmount(marketValue),
      };
    });

    const orderRows = orderTimeline.map((row) => {
      const isChild = row.rowType === "LINKED_EXIT";
      const legLabel = row.legType ? ` ${row.legType}` : "";
      const kind = row.rowType === "ENTRY_ORDER" ? "Entry" : `Exit${legLabel}`;
      const symbolText = row.tradingsymbol || String(row.instrumentToken);
      const sideText = row.side ?? "-";
      const qtyText = Number.isFinite(row.qty) ? String(row.qty) : "-";
      const priceText = formatAmount(row.price);
      const statusNode = (
        <div className="flex items-center gap-2">
          <Badge variant={statusBadgeVariant(row.status)} className="rounded-none text-[10px]">
            {statusLabel(row.status)}
          </Badge>
          {row.statusReason ? (
            <span className="max-w-[210px] truncate text-[10px] text-muted-foreground" title={row.statusReason}>
              {row.statusReason}
            </span>
          ) : null}
        </div>
      );

      return {
        orderId: isChild ? (
          <span className="text-muted-foreground">-&gt; {row.rowId}</span>
        ) : (
          row.entryOrderId ?? row.rowId
        ),
        symbol: isChild ? (
          <span className="pl-4 text-muted-foreground">{symbolText}</span>
        ) : (
          symbolText
        ),
        side: isChild ? (
          <span className="pl-4">{sideText}</span>
        ) : (
          sideText
        ),
        type: `${kind}${row.orderType ? ` ${row.orderType}` : ""}`,
        qty: qtyText,
        price: priceText,
        status: statusNode,
        createdAt: formatDateTime(row.createdAtEpochMs),
      };
    });

    const orderHistoryRows = orders
      .slice()
      .sort((left, right) => right.updatedAtEpochMs - left.updatedAtEpochMs)
      .map((order) => ({
        orderId: order.orderId,
        symbol: order.tradingsymbol || String(order.instrumentToken),
        side: order.side,
        type: order.orderType,
        qty: String(order.qty),
        avgFillPrice: formatAmount(order.avgFillPrice),
        status: statusLabel(order.status),
        updatedAt: formatDateTime(order.updatedAtEpochMs),
      }));

    return [
      {
        id: "positions",
        label: "Positions",
        tableClassName: "min-w-[1200px]",
        columns: POSITION_COLUMNS,
        rows: positionRows,
        emptyMessage: "There are no open positions in your trading account yet.",
      },
      {
        id: "orders",
        label: "Orders",
        tableClassName: "min-w-[960px]",
        columns: ORDER_COLUMNS,
        rows: orderRows,
        emptyMessage: "No timeline rows yet.",
      },
      {
        id: "order-history",
        label: "Order History",
        tableClassName: "min-w-[980px]",
        columns: HISTORY_COLUMNS,
        rows: orderHistoryRows,
        emptyMessage: "No order history yet.",
      },
      {
        id: "balance-history",
        label: "Balance History",
        tableClassName: "min-w-[900px]",
        columns: BALANCE_HISTORY_COLUMNS,
        rows: [],
        emptyMessage: "Balance history is not available from backend in this phase.",
      },
      {
        id: "trading-journal",
        label: "Trading Journal",
        tableClassName: "min-w-[920px]",
        columns: JOURNAL_COLUMNS,
        rows: [],
        emptyMessage: "Trading journal is not available from backend in this phase.",
      },
    ];
  }, [orderTimeline, orders, positions]);

  const summary = [
    { label: "availableCash", value: formatAmount(funds?.availableCash) },
    { label: "utilisedMargin", value: formatAmount(funds?.utilisedMargin) },
    { label: "availableMargin", value: formatAmount(funds?.availableMargin) },
    {
      label: "openingBalance",
      value: formatAmount(funds?.openingBalance ?? activeAccount?.openingBalance ?? null),
    },
  ];

  const connectDisabled = connector !== "paper" || previewLoading || connectPending;

  const wsBadgeVariant =
    wsState === "OPEN"
      ? "secondary"
      : wsState === "ERROR"
        ? "destructive"
        : "outline";

  return (
    <Panel className="h-full min-h-0 flex flex-col rounded-none border">
      {!isConnected ? (
        <>
          <div className="border-b px-3 py-2">
            <p className="text-sm font-medium">Trading Account</p>
            <p className="text-xs text-muted-foreground">
              Connect a broker to view funds, positions, orders, and journal.
            </p>
          </div>
          <div className="flex flex-1 items-center justify-center p-4">
            <div className="w-full max-w-xl space-y-3 border bg-background/40 p-4">
              <p className="text-sm font-medium">Connect account</p>
              {previewLoading ? (
                <p className="text-xs text-muted-foreground">Checking existing account...</p>
              ) : null}

              {existingAccountPreview ? (
                <div className="border px-2 py-2 text-xs">
                  Existing paper account: <span className="font-semibold">{existingAccountPreview.accountId}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground" htmlFor="opening-balance-input">
                    Opening balance
                  </label>
                  <Input
                    id="opening-balance-input"
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-9 rounded-none"
                    value={openingBalanceInput}
                    onChange={(event) => setOpeningBalanceInput(event.target.value)}
                    placeholder="10000"
                  />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={connector}
                  onValueChange={(value) => setConnector(value as ConnectorType)}
                >
                  <SelectTrigger className="h-9 w-44 justify-between rounded-none">
                    <span>{connector}</span>
                    <span className="text-xs text-muted-foreground">v</span>
                  </SelectTrigger>
                  <SelectContent align="start" className="rounded-none">
                    <SelectItem value="paper" className="rounded-none">
                      paper
                    </SelectItem>
                    <SelectItem value="kite" disabled className="rounded-none">
                      kite (disabled)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="h-9 rounded-none px-4"
                  disabled={connectDisabled}
                  onClick={() => {
                    void handleConnect();
                  }}
                >
                  {connectPending ? "Connecting..." : "Connect"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Kite connector is intentionally disabled for now.
              </p>
              {panelError ? <p className="text-xs text-destructive">{panelError}</p> : null}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="border-b px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Paper Trading
                </p>
                <p className="text-sm font-semibold">{activeAccount?.accountId ?? "-"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="rounded-none">
                  Connected
                </Badge>
                <Badge variant={wsBadgeVariant} className="rounded-none">
                  WS {wsState}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-none"
                  onClick={handleDisconnect}
                >
                  Disconnect
                </Button>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
              {summary.map((item) => (
                <div key={item.label} className="border px-2 py-2">
                  <p className="text-[11px] text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
            {panelError ? <p className="mt-2 text-xs text-destructive">{panelError}</p> : null}
          </div>

          <Tabs defaultValue="positions" className="flex flex-1 min-h-0 flex-col">
            <TabsList className="h-auto w-full justify-start gap-1 rounded-none border-b bg-background px-2 py-0">
              {accountTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="rounded-none px-2 py-2 text-xs data-[state=active]:border-b-red-500"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex-1 min-h-0">
              {accountTabs.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="mt-0 h-full min-h-0">
                  <AccountTabTable tab={tab} />
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </>
      )}
    </Panel>
  );
};
