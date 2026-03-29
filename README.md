# RW Charting Client

React + Vite frontend for the trading UI and embeddable chart surface.

The app now supports an iframe-based chart integration for external host pages. The host page controls drawings through `window.postMessage()`, while the chart runs inside `/embed/chart`.

## Quickstart

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Runtime backend config

The frontend loads [`public/runtime-config.json`](/Users/shagirulhassan/Desktop/algotrading/rw-charting/client/public/runtime-config.json) before rendering.

Example local config:

```json
{
  "apiBaseUrl": "http://localhost:8086",
  "wsBaseUrl": "ws://localhost:8086"
}
```

Notes:

- `apiBaseUrl` is required.
- `wsBaseUrl` is optional. If omitted, it is derived from `apiBaseUrl`.
- The embedded chart uses this backend config when it resolves symbols and loads chart data.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## Embedded chart

### Route

Use the embeddable chart at:

```text
http://localhost:5173/embed/chart
```

### Supported URL modes

Provide exactly one of `symbolId`, `instrumentToken`, or `seriesKey`.

#### 1. Recommended: `symbolId`

Let the iframe resolve the instrument token through the backend:

```text
http://localhost:5173/embed/chart?symbolId=INFY&timeframe=1D
```

Details:

- The iframe calls `/api/instruments/by-symbol?symbol=<symbolId>&exchange=NSE`.
- `symbolId` mode currently supports `NSE` instruments only.
- This is the simplest option when your host app knows the symbol but not the token.

#### 2. Direct token: `instrumentToken`

If your host already knows the token:

```text
http://localhost:5173/embed/chart?instrumentToken=408065&timeframe=5m&exchange=NSE&displaySymbol=INFY
```

#### 3. Direct series: `seriesKey`

If your host already builds the final chart key:

```text
http://localhost:5173/embed/chart?seriesKey=408065@TIME_5M&displaySymbol=INFY&exchange=NSE
```

### Timeframe and interval support

The embed page accepts either:

- `timeframe`, such as `1m`, `2m`, `3m`, `5m`, `10m`, `15m`, `30m`, `45m`, `1h`, `1D`, `10t`, `100t`, `1000t`
- `intervalKind`, such as `TIME_1M`, `TIME_2M`, `TIME_3M`, `TIME_5M`, `TIME_10M`, `TIME_15M`, `TIME_30M`, `TIME_45M`, `TIME_1H`, `TIME_1D`, `TICK_10T`, `TICK_100T`, `TICK_1000T`

If both are absent, the embed defaults to `1D`.

### How the iframe integration works

1. The host page creates the iframe URL.
2. The iframe loads `/embed/chart` and resolves the instrument if needed.
3. The iframe starts the chart runtime and posts a `READY` event.
4. After `READY`, the host sends drawing commands with `postMessage`.
5. The iframe responds with `APPLIED` or `ERROR`.

The iframe is the chart renderer. The host page is the controller.

## Embed protocol

### Channel

```text
RW_CHART_EMBED_V1
```

### Outbound iframe events

- `READY`
- `APPLIED`
- `ERROR`

### Inbound host commands

- `DRAWINGS_SET`
- `DRAWING_UPSERT`
- `DRAWING_REMOVE`
- `DRAWINGS_CLEAR`

### Envelope

```json
{
  "channel": "RW_CHART_EMBED_V1",
  "type": "DRAWINGS_SET",
  "requestId": "optional-request-id",
  "payload": {}
}
```

Notes:

- `requestId` is optional, but recommended.
- `APPLIED` and `ERROR` echo the same `requestId`.
- Embed drawing mutations are isolated to scope `manual:embed`.

### `READY` payload

The iframe sends a payload like:

```json
{
  "seriesKey": "408065@TIME_5M",
  "capabilities": [
    "DRAWINGS_SET",
    "DRAWING_UPSERT",
    "DRAWING_REMOVE",
    "DRAWINGS_CLEAR"
  ]
}
```

## Drawing commands

### `DRAWINGS_SET`

Replace all embed-managed drawings:

```json
{
  "drawings": []
}
```

### `DRAWING_UPSERT`

Insert or update a single drawing by `id`:

```json
{
  "drawing": {}
}
```

### `DRAWING_REMOVE`

Remove one drawing by `drawingId`:

```json
{
  "drawingId": "line-1"
}
```

### `DRAWINGS_CLEAR`

Remove every embed-managed drawing:

```json
{}
```

## Line drawing format

For line plotting, send a drawing object like:

```json
{
  "id": "line-1",
  "kind": "line",
  "p1": { "time": "2026-03-10", "price": 1500 },
  "p2": { "time": "2026-03-12", "price": 1500 },
  "stroke": {
    "color": "rgba(255,206,86,1)",
    "width": 2,
    "dash": [6, 4]
  },
  "label": {
    "text": "Resistance",
    "linePos": "end",
    "bg": "rgba(255,255,255,0)",
    "fg": "rgba(255,206,86,1)",
    "radius": 4,
    "size": "xs",
    "offsetPx": 56
  }
}
```

Required fields:

- `id`
- `kind: "line"`
- `p1.time`
- `p1.price`
- `p2.time`
- `p2.price`
- `stroke.color`
- `stroke.width`

Useful optional fields:

- `stroke.dash`
- `label.text`
- `label.linePos`
- `label.bg`
- `label.fg`
- `label.radius`
- `label.size`
- `label.offsetPx`

## Time values for drawings

Drawing times are normalized by the chart client, so the host can send:

- `YYYY-MM-DD` strings for day-based drawings
- ISO datetime strings such as `2026-03-10T09:15:00+05:30`
- epoch seconds
- epoch milliseconds
- lightweight-charts `BusinessDay` objects

Recommended usage:

- For daily charts, use `YYYY-MM-DD`.
- For intraday or tick charts, use ISO datetime strings with timezone, or epoch seconds.

## Minimal host example

This example uses the new `symbolId` flow and only plots lines.

```tsx
import React, { useEffect, useRef, useState } from "react";

const CHART_ORIGIN = "http://localhost:5173";
const CHANNEL = "RW_CHART_EMBED_V1";

export default function App() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const iframeSrc =
    `${CHART_ORIGIN}/embed/chart?symbolId=INFY&timeframe=1D`;

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== CHART_ORIGIN) return;

      const msg = event.data;
      if (!msg || msg.channel !== CHANNEL) return;

      if (msg.type === "READY") {
        setIsReady(true);
      } else if (msg.type === "APPLIED") {
        console.log("APPLIED", msg.requestId, msg.payload);
      } else if (msg.type === "ERROR") {
        console.error("ERROR", msg.requestId, msg.payload);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function send(type: string, payload: unknown) {
    if (!iframeRef.current?.contentWindow || !isReady) return;

    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    iframeRef.current.contentWindow.postMessage(
      {
        channel: CHANNEL,
        type,
        requestId,
        payload,
      },
      CHART_ORIGIN,
    );
  }

  function drawLine() {
    send("DRAWINGS_SET", {
      drawings: [
        {
          id: "line-1",
          kind: "line",
          p1: { time: "2026-03-10", price: 1500 },
          p2: { time: "2026-03-12", price: 1500 },
          stroke: {
            color: "rgba(255,206,86,1)",
            width: 2,
            dash: [6, 4],
          },
          label: {
            text: "Resistance",
            linePos: "end",
            fg: "rgba(255,206,86,1)",
            bg: "rgba(255,255,255,0)",
            size: "xs",
            radius: 4,
            offsetPx: 56,
          },
        },
      ],
    });
  }

  function updateLine() {
    send("DRAWING_UPSERT", {
      drawing: {
        id: "line-1",
        kind: "line",
        p1: { time: "2026-03-10", price: 1525 },
        p2: { time: "2026-03-12", price: 1525 },
        stroke: {
          color: "rgba(82,196,26,1)",
          width: 3,
          dash: [8, 4],
        },
        label: {
          text: "Updated Line",
          linePos: "end",
          fg: "rgba(82,196,26,1)",
          bg: "rgba(255,255,255,0)",
          size: "xs",
          radius: 4,
          offsetPx: 56,
        },
      },
    });
  }

  function removeLine() {
    send("DRAWING_REMOVE", {
      drawingId: "line-1",
    });
  }

  function clearLines() {
    send("DRAWINGS_CLEAR", {});
  }

  return (
    <div>
      <button onClick={drawLine} disabled={!isReady}>Draw</button>
      <button onClick={updateLine} disabled={!isReady}>Update</button>
      <button onClick={removeLine} disabled={!isReady}>Remove</button>
      <button onClick={clearLines} disabled={!isReady}>Clear</button>

      <iframe
        ref={iframeRef}
        title="RW Embedded Chart"
        src={iframeSrc}
        style={{ width: "100%", height: 700, border: 0 }}
      />
    </div>
  );
}
```

## If you still want to resolve the token in the host

If your host prefers resolving the instrument token first, call:

```text
GET /api/instruments/by-symbol?symbol=INFY&exchange=NSE
```

Expected response shape:

```json
{
  "instrument_token": "408065",
  "tradingsymbol": "INFY",
  "exchange": "NSE"
}
```

Then build either:

```text
seriesKey = 408065@TIME_5M
```

or:

```text
/embed/chart?instrumentToken=408065&timeframe=5m&exchange=NSE&displaySymbol=INFY
```

## Structure

- `src/app/pages/EmbedChartPage.tsx` handles embed URL parsing and symbol resolution.
- `src/components/organisms/chart/embed/EmbedDrawingBridge.tsx` applies drawing commands from the host.
- `src/components/organisms/chart/embed/embedProtocol.ts` defines the embed protocol.
- `src/app/chart/intervalKindMap.ts` maps `timeframe` and `intervalKind`.
