# Trading UI – React + Vite + Tailwind + shadcn

Static, responsive replica of the provided screenshots using atomic design.

## Quickstart
```bash
pnpm i # or npm i / yarn
# Install shadcn/ui (if not already)
npx shadcn@latest init
# Add the used components:
npx shadcn@latest add button badge card command dialog dropdown-menu input label popover scroll-area separator tabs toggle tooltip
pnpm dev # or npm run dev / yarn dev
```

Open http://localhost:5173

## Structure
- `src/components/atoms` – small primitives (Panel, IconButton, StatPill, TimeframeButton)
- `src/components/molecules` – composed controls (SearchBox, WatchItem, TimeframeMenu)
- `src/components/organisms` – domain blocks (Watchlist, IndicatorPicker, ChartHeader, ChartPlaceholder)
- `src/app/templates` – page layout composition (TradingLayout)
- `src/app/pages` – route/page (TradingPage)
- `src/components/ui` – **shadcn/ui** components live here after you run `shadcn add ...`

## Notes
- Chart area is a placeholder – embed TV/Lightweight charts.
- All data is static placeholders.
- Responsive: sidebar collapses under 1024px; action rows scroll-x on small screens.
