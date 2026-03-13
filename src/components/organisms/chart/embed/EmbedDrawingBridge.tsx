import * as React from "react";
import { useChartActions } from "@/components/organisms/chart/context/chartStore";
import {
  EMBED_CHANNEL,
  EMBED_SCOPE,
  makeAppliedEnvelope,
  makeErrorEnvelope,
  makeReadyEnvelope,
  parseDrawingRemovePayload,
  parseDrawingsSetPayload,
  parseDrawingUpsertPayload,
  parseInboundEnvelope,
  type EmbedOutboundEnvelope,
} from "./embedProtocol";

function postToParent(message: EmbedOutboundEnvelope) {
  try {
    if (window.parent) {
      window.parent.postMessage(message, "*");
    }
  } catch {
    // no-op
  }
}

export const EmbedDrawingBridge: React.FC<{
  seriesKey: string;
}> = ({ seriesKey }) => {
  const {
    setScopeDrawings,
    upsertScopeDrawing,
    removeScopeDrawing,
    clearScopeDrawings,
  } = useChartActions();

  React.useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      const raw = event.data as Record<string, unknown> | null;
      const hasEmbedChannel = Boolean(
        raw && typeof raw === "object" && raw.channel === EMBED_CHANNEL,
      );
      const envelope = parseInboundEnvelope(event.data);
      if (!envelope) {
        if (hasEmbedChannel) {
          const requestId =
            typeof raw?.requestId === "string" ? raw.requestId : undefined;
          const type =
            typeof raw?.type === "string" ? raw.type : undefined;
          postToParent(
            makeErrorEnvelope(
              type ? "INVALID_TYPE" : "INVALID_ENVELOPE",
              type
                ? `Unsupported type ${type}`
                : "Invalid embed message envelope.",
              requestId,
            ),
          );
        }
        return;
      }

      const requestId = envelope.requestId;

      try {
        if (envelope.type === "DRAWINGS_SET") {
          const payload = parseDrawingsSetPayload(envelope.payload);
          if (!payload) {
            postToParent(
              makeErrorEnvelope(
                "INVALID_PAYLOAD",
                "DRAWINGS_SET payload must include drawings[]",
                requestId,
              ),
            );
            return;
          }
          setScopeDrawings(EMBED_SCOPE, payload.drawings);
          postToParent(
            makeAppliedEnvelope(envelope.type, requestId, {
              count: payload.drawings.length,
            }),
          );
          return;
        }

        if (envelope.type === "DRAWING_UPSERT") {
          const payload = parseDrawingUpsertPayload(envelope.payload);
          if (!payload) {
            postToParent(
              makeErrorEnvelope(
                "INVALID_PAYLOAD",
                "DRAWING_UPSERT payload must include drawing",
                requestId,
              ),
            );
            return;
          }
          upsertScopeDrawing(EMBED_SCOPE, payload.drawing);
          postToParent(makeAppliedEnvelope(envelope.type, requestId));
          return;
        }

        if (envelope.type === "DRAWING_REMOVE") {
          const payload = parseDrawingRemovePayload(envelope.payload);
          if (!payload) {
            postToParent(
              makeErrorEnvelope(
                "INVALID_PAYLOAD",
                "DRAWING_REMOVE payload must include drawingId",
                requestId,
              ),
            );
            return;
          }
          removeScopeDrawing(EMBED_SCOPE, payload.drawingId);
          postToParent(makeAppliedEnvelope(envelope.type, requestId));
          return;
        }

        if (envelope.type === "DRAWINGS_CLEAR") {
          clearScopeDrawings(EMBED_SCOPE);
          postToParent(makeAppliedEnvelope(envelope.type, requestId));
          return;
        }

        postToParent(
          makeErrorEnvelope("INVALID_TYPE", `Unsupported type ${envelope.type}`, requestId),
        );
      } catch (error) {
        postToParent(
          makeErrorEnvelope(
            "INTERNAL_ERROR",
            error instanceof Error ? error.message : "Unexpected drawing bridge error",
            requestId,
          ),
        );
      }
    };

    window.addEventListener("message", onMessage);
    postToParent(makeReadyEnvelope(seriesKey));

    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [clearScopeDrawings, removeScopeDrawing, seriesKey, setScopeDrawings, upsertScopeDrawing]);

  return null;
};
