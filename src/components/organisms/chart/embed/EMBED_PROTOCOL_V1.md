# RW Chart Embed Protocol v1

## Channel
`RW_CHART_EMBED_V1`

## Inbound Commands
1. `DRAWINGS_SET`
2. `DRAWING_UPSERT`
3. `DRAWING_REMOVE`
4. `DRAWINGS_CLEAR`

## Inbound Envelope
```json
{
  "channel": "RW_CHART_EMBED_V1",
  "type": "DRAWINGS_SET | DRAWING_UPSERT | DRAWING_REMOVE | DRAWINGS_CLEAR",
  "requestId": "optional",
  "payload": {}
}
```

## Outbound Events
1. `READY`
2. `APPLIED`
3. `ERROR`

## Outbound Envelope
```json
{
  "channel": "RW_CHART_EMBED_V1",
  "type": "READY | APPLIED | ERROR",
  "requestId": "echo if provided",
  "payload": {}
}
```

## Scope Ownership
All embed drawing commands mutate only drawing scope `manual:embed`.

Drawing anchors are resolved leniently at render time. If the host sends a date
or timestamp that does not land on an exact candle, the chart snaps it to the
next available candle, or the previous one when there is no later candle.
On intraday and tick charts, date-only start anchors map to the first candle of
the resolved trading day and date-only end anchors map to that day's last
candle. Dates outside the loaded range clamp to the first or last loaded candle.

## Sequence Example
1. Parent waits for `READY`.
2. Parent sends `DRAWINGS_SET`.
3. Iframe responds `APPLIED` or `ERROR`.
