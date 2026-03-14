import { backendFetch, wsUrl } from "@/lib/runtimeConfig";
import type {
  SeriesSnapshotResponse,
  SessionCreateResponse,
  WsEnvelope,
  WsHandlers,
} from "./runtimeTypes";

export interface EngineSessionTransport {
  createSession(seriesKey: string): Promise<{ sessionId: string }>;
  destroySession(sessionId: string, keepalive: boolean): Promise<void>;
  fetchSnapshot(
    sessionId: string,
    seriesKey: string,
  ): Promise<SeriesSnapshotResponse>;
  listSessions?(): Promise<Array<{ sessionId: string; bootstrapStatus?: string }>>;
  connectTicksWs(
    sessionId: string,
    handlers: WsHandlers,
  ): { close: () => void };
}

function parseEnvelope(raw: string): WsEnvelope | null {
  try {
    return JSON.parse(raw) as WsEnvelope;
  } catch {
    return null;
  }
}

export const defaultEngineSessionTransport: EngineSessionTransport = {
  async createSession(seriesKey: string): Promise<SessionCreateResponse> {
    const response = await backendFetch("/engine/ui-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seriesKeys: [seriesKey],
        maxBarCount: 5000,
        destroyOnClose: true,
      }),
    });
    if (!response.ok) {
      throw new Error(`create session failed (${response.status})`);
    }
    return (await response.json()) as SessionCreateResponse;
  },

  async destroySession(sessionId: string, keepalive: boolean): Promise<void> {
    try {
      await backendFetch(`/engine/ui-sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        keepalive,
      });
    } catch {
      // no-op
    }
  },

  async fetchSnapshot(
    sessionId: string,
    seriesKey: string,
  ): Promise<SeriesSnapshotResponse> {
    const response = await backendFetch(
      `/engine/ui-sessions/${encodeURIComponent(sessionId)}/series/${encodeURIComponent(
        seriesKey,
      )}/snapshot`,
    );
    if (!response.ok) {
      throw new Error(`snapshot failed (${response.status})`);
    }
    return (await response.json()) as SeriesSnapshotResponse;
  },

  async listSessions() {
    const response = await backendFetch("/engine/ui-sessions");
    if (!response.ok) {
      throw new Error(`list sessions failed (${response.status})`);
    }
    return (await response.json()) as Array<{
      sessionId: string;
      bootstrapStatus?: string;
    }>;
  },

  connectTicksWs(sessionId: string, handlers: WsHandlers): { close: () => void } {
    const url = new URL(wsUrl("/ticks/ws"));
    url.searchParams.set("sessionId", sessionId);
    const ws = new WebSocket(url.toString());

    ws.onopen = () => {
      handlers.onOpen();
    };

    ws.onerror = () => {
      handlers.onError();
    };

    ws.onclose = () => {
      handlers.onClose();
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      const envelope = parseEnvelope(event.data);
      if (!envelope) {
        return;
      }
      handlers.onMessage(envelope);
    };

    return {
      close: () => {
        try {
          ws.close();
        } catch {
          // no-op
        }
      },
    };
  },
};
