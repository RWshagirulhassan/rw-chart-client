import { backendFetch } from "@/lib/runtimeConfig";

export type TradingAccountResponse = {
  accountId: string;
  userId: string;
  mode: string;
  brokerType: string;
  baseCurrency: string;
  autoTradeEnabled: boolean;
  openingBalance: number;
  createdAtEpochMs: number;
  updatedAtEpochMs: number;
};

export type FundsResponse = {
  availableCash: number;
  utilisedMargin: number;
  availableMargin: number;
  openingBalance: number;
  collateral: number | null;
  updatedAtEpochMs: number;
};

export type OrderResponse = {
  orderId: string;
  brokerOrderId: string | null;
  accountId: string;
  instrumentToken: number;
  tradingsymbol: string;
  exchange: string;
  product: string;
  orderType: string;
  side: string;
  qty: number;
  price: number | null;
  triggerPrice: number | null;
  status: string;
  filledQty: number;
  avgFillPrice: number;
  createdAtEpochMs: number;
  updatedAtEpochMs: number;
  rejectionReason: string | null;
  source: string;
  scriptId: string | null;
  reason: string | null;
  parentOrderId: string | null;
  exitPlanId: string | null;
  triggerId: string | null;
  ocoGroupId: string | null;
  role: string | null;
  reduceOnly: boolean;
};

export type PositionResponse = {
  accountId: string;
  instrumentToken: number;
  tradingsymbol: string;
  product: string;
  netQty: number;
  avgPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
  lastPrice: number;
  updatedAtEpochMs: number;
};

export type PlaceOrderRequest = {
  instrumentToken: number;
  tradingsymbol: string;
  exchange: string;
  product: string;
  orderType: string;
  side: string;
  qty: number;
  price?: number | null;
  triggerPrice?: number | null;
  reason?: string | null;
  attachments?: OrderAttachmentsRequest | null;
};

export type ExitLegRequest = {
  enabled: boolean;
  triggerPrice?: number | null;
  limitOffset?: number | null;
};

export type OrderAttachmentsRequest = {
  armPolicy?: "AFTER_ENTRY_FILLED" | null;
  takeProfit?: ExitLegRequest | null;
  stopLoss?: ExitLegRequest | null;
};

export type LinkedExitSummaryResponse = {
  exitPlanId: string;
  status: string;
  mode: string | null;
  armPolicy: string | null;
};

export type PlaceOrderResponse = {
  order: OrderResponse;
  linkedExit: LinkedExitSummaryResponse | null;
};

export type ExitPlanResponse = {
  exitPlanId: string;
  accountId: string;
  entryOrderId: string | null;
  instrumentToken: number;
  tradingsymbol: string;
  exchange: string;
  product: string;
  entrySide: string;
  plannedQty: number;
  status: string;
  armPolicy: string;
  mode: string | null;
  ocoGroupId: string | null;
  takeProfit: {
    legType: string;
    triggerPrice: number;
    limitOffset: number;
    orderSide: string;
    qty: number;
  } | null;
  stopLoss: {
    legType: string;
    triggerPrice: number;
    limitOffset: number;
    orderSide: string;
    qty: number;
  } | null;
  rearmRequiredQty: number | null;
  rearmReason: string | null;
  createdAtEpochMs: number;
  updatedAtEpochMs: number;
};

export type TriggerResponse = {
  triggerId: string;
  accountId: string;
  exitPlanId: string;
  instrumentToken: number;
  tradingsymbol: string;
  exchange: string;
  product: string;
  legType: string;
  conditionOp: string;
  triggerValue: number;
  limitOffset: number;
  orderSide: string;
  plannedQty: number;
  status: string;
  lastObservedLtp: number | null;
  firedAtEpochMs: number | null;
  brokerTriggerId: string | null;
  ocoGroupId: string | null;
  linkedOrderId: string | null;
  rejectionReason: string | null;
  createdAtEpochMs: number;
  updatedAtEpochMs: number;
};

export type OrderTimelineRowResponse = {
  rowId: string;
  rowType: "ENTRY_ORDER" | "LINKED_EXIT";
  parentOrderId: string | null;
  entryOrderId: string | null;
  exitPlanId: string | null;
  triggerId: string | null;
  linkedOrderId: string | null;
  legType: "TP" | "SL" | null;
  instrumentToken: number;
  tradingsymbol: string;
  exchange: string;
  side: string | null;
  qty: number;
  orderType: string | null;
  price: number | null;
  triggerPrice: number | null;
  limitOffset: number | null;
  status: string;
  statusReason: string | null;
  createdAtEpochMs: number;
  updatedAtEpochMs: number;
  sortTsEpochMs: number;
};

export type ModifyOrderRequest = {
  qty?: number | null;
  price?: number | null;
  triggerPrice?: number | null;
};

export type CreateExitPlanRequest = {
  product?: string | null;
  armPolicy?: "AFTER_ENTRY_FILLED" | null;
  takeProfit?: ExitLegRequest | null;
  stopLoss?: ExitLegRequest | null;
};

export type UpdateExitPlanRequest = {
  takeProfit?: ExitLegRequest | null;
  stopLoss?: ExitLegRequest | null;
};

export type MarginCheckResponse = {
  allowed: boolean;
  requiredMargin: number;
  finalMargin: number;
  breakdown: Record<string, number>;
  message: string;
  source: string;
  degraded: boolean;
};

export class TradingApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "TradingApiError";
    this.status = status;
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  if (!text.trim()) {
    return `Request failed (${res.status})`;
  }

  try {
    const body = JSON.parse(text) as { error?: unknown; message?: unknown };
    if (typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
  } catch {
    // ignore parse failure
  }

  return text;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await backendFetch(path, init);
  if (!res.ok) {
    const message = await parseErrorMessage(res);
    throw new TradingApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export function getCurrentTradingAccount() {
  return requestJson<TradingAccountResponse>("/v1/trading/accounts/current");
}

export function createPaperTradingAccount(openingBalance: number) {
  return requestJson<TradingAccountResponse>("/v1/trading/accounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "PAPER",
      brokerType: "PAPER",
      autoTradeEnabled: true,
      openingBalance,
    }),
  });
}

export function getFunds(accountId: string) {
  return requestJson<FundsResponse>(`/v1/trading/${encodeURIComponent(accountId)}/funds`);
}

export function getOrders(accountId: string) {
  return requestJson<OrderResponse[]>(`/v1/trading/${encodeURIComponent(accountId)}/orders`);
}

export function getOrderTimeline(
  accountId: string,
  params?: { includeTerminal?: boolean; limit?: number },
) {
  const query = new URLSearchParams();
  if (params?.includeTerminal != null) {
    query.set("includeTerminal", String(params.includeTerminal));
  }
  if (params?.limit != null) {
    query.set("limit", String(params.limit));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return requestJson<OrderTimelineRowResponse[]>(
    `/v1/trading/${encodeURIComponent(accountId)}/orders/timeline${suffix}`,
  );
}

export function getPositions(accountId: string) {
  return requestJson<PositionResponse[]>(`/v1/trading/${encodeURIComponent(accountId)}/positions`);
}

export function placeOrder(accountId: string, request: PlaceOrderRequest) {
  return requestJson<PlaceOrderResponse>(`/v1/trading/${encodeURIComponent(accountId)}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}

export function cancelOrder(accountId: string, orderId: string, reason?: string | null) {
  const query = reason && reason.trim() ? `?reason=${encodeURIComponent(reason.trim())}` : "";
  return requestJson<OrderResponse>(
    `/v1/trading/${encodeURIComponent(accountId)}/orders/${encodeURIComponent(orderId)}/cancel${query}`,
    { method: "POST" },
  );
}

export function modifyOrder(accountId: string, orderId: string, request: ModifyOrderRequest) {
  return requestJson<OrderResponse>(
    `/v1/trading/${encodeURIComponent(accountId)}/orders/${encodeURIComponent(orderId)}/modify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
}

export function getExitPlans(accountId: string) {
  return requestJson<ExitPlanResponse[]>(`/v1/trading/${encodeURIComponent(accountId)}/exit-plans`);
}

export function getTriggers(accountId: string) {
  return requestJson<TriggerResponse[]>(`/v1/trading/${encodeURIComponent(accountId)}/triggers`);
}

export function createPositionExitPlan(
  accountId: string,
  instrumentToken: number,
  request: CreateExitPlanRequest,
) {
  return requestJson<ExitPlanResponse>(
    `/v1/trading/${encodeURIComponent(accountId)}/positions/${encodeURIComponent(String(instrumentToken))}/exit-plan`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
}

export function updateExitPlan(accountId: string, exitPlanId: string, request: UpdateExitPlanRequest) {
  return requestJson<ExitPlanResponse>(
    `/v1/trading/${encodeURIComponent(accountId)}/exit-plans/${encodeURIComponent(exitPlanId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    },
  );
}

export function cancelExitPlan(accountId: string, exitPlanId: string, reason?: string | null) {
  const query = reason && reason.trim() ? `?reason=${encodeURIComponent(reason.trim())}` : "";
  return requestJson<ExitPlanResponse>(
    `/v1/trading/${encodeURIComponent(accountId)}/exit-plans/${encodeURIComponent(exitPlanId)}${query}`,
    { method: "DELETE" },
  );
}

export function checkMargins(accountId: string, orders: PlaceOrderRequest[]) {
  return requestJson<MarginCheckResponse>(`/v1/trading/${encodeURIComponent(accountId)}/margins/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orders }),
  });
}
