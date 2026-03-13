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

## Sequence Example
1. Parent waits for `READY`.
2. Parent sends `DRAWINGS_SET`.
3. Iframe responds `APPLIED` or `ERROR`.
