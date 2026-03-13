export type TradingWsEnvelope<T = unknown> = {
  type: string;
  ts?: number;
  data?: T;
};

export type TradingWsHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (message: string) => void;
  onMeta?: (data: unknown) => void;
  onEnvelope?: (envelope: TradingWsEnvelope) => void;
};

export type TradingWsConnection = {
  socket: WebSocket;
  close: () => void;
};

export function connectTradingWs(
  accountId: string,
  handlers: TradingWsHandlers,
): TradingWsConnection {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(
    `${proto}://${window.location.host}/trading/ws?accountId=${encodeURIComponent(accountId)}`,
  );

  ws.onopen = () => {
    handlers.onOpen?.();
  };

  ws.onerror = () => {
    handlers.onError?.("Trading websocket error");
  };

  ws.onclose = () => {
    handlers.onClose?.();
  };

  ws.onmessage = (event: MessageEvent<string>) => {
    let envelope: TradingWsEnvelope | null = null;
    try {
      envelope = JSON.parse(event.data) as TradingWsEnvelope;
    } catch {
      return;
    }

    if (!envelope) {
      return;
    }

    handlers.onEnvelope?.(envelope);

    if (envelope.type === "meta") {
      handlers.onMeta?.(envelope.data);
      return;
    }

    if (envelope.type === "error") {
      const maybeMessage = (envelope.data as { message?: unknown } | undefined)?.message;
      handlers.onError?.(
        typeof maybeMessage === "string" && maybeMessage.trim()
          ? maybeMessage
          : "Trading websocket error",
      );
    }
  };

  return {
    socket: ws,
    close: () => {
      try {
        ws.close();
      } catch {
        // no-op
      }
    },
  };
}
