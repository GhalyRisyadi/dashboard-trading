# Crypto Trading Dashboard: frontend (`dassboard-trading`)

This file tells AI assistants and new contributors what this project is, what it is built with, where things belong, and what is done or planned. If this file and the code disagree, the code and the package manifest win; fix this file.

The sections 1 (Project purpose), 2.2 (System design), and 4 (Features) are intentionally the same in both repositories' `CLAUDE.md`. When one changes, change both.

Last verified: 2026-10-25 against backend commit `b93d661` and frontend commit `07d6832`.

## 1. Project purpose

The goal of this project is to develop a cryptocurrency market dashboard with an AI model deployed as part of the application. The model is expected to analyze Binance market data and forecast coin prices and their movement direction one to three days ahead. Potential inputs include price and volume, transaction counts, large-trade and order-flow indicators that may act as proxies for whale activity, and other features demonstrated through validation to be predictive. A forecast horizon describes the model's intended capability, not a guarantee of accuracy. Large-trade indicators do not by themselves identify whale holders or their off-exchange movements.

The AI forecasting model is a project goal and is not implemented yet. The current backend provides rule-based EMA (Exponential Moving Average) crossover signals and a historical backtest; the dashboard displays Binance market data and candlestick charts. The application is for market monitoring and strategy evaluation: it does not connect to exchange accounts, place trades, or provide financial advice.

### Binance data sources and planned model input

The planned AI data pipeline uses two Binance market-data sources:

1. **Historical klines (OHLCV):** Open, High, Low, Close, and Volume candles provide historical price and volume context for model training and analysis. The current backend and backtest retrieve candle data from Binance's klines REST endpoint.
2. **Real-time trades:** Individual executed trades provide a live view of market activity. The planned pipeline will transform the trade stream into time-windowed model features such as transaction counts, traded volume, buy/sell flow where available, and unusually large trades as a proxy for possible whale activity.

The model is intended to use historical OHLCV together with features derived from real-time trades. Candidate features should be tested and retained only when historical and out-of-sample validation shows that they add predictive value. The live trade-stream ingestion and AI feature pipeline are planned capabilities; the current application does not yet feed real-time trades into a forecasting model.

### Repositories

The product is split across two repositories:

- **Backend**: GitHub `GhalyRisyadi/dassboard-trading-api`, usually cloned as `dashboard-trading-api`. Backend API, signal logic, and the historical backtest tool.
- **Frontend**: GitHub `GhalyRisyadi/dassboard-trading`, usually cloned as `crypto-dashboard`. Browser dashboard and its visual design.

Each repository has its own `CLAUDE.md`.

## 2. Technology

### 2.1 Stack

- TypeScript and Vue 3 using the Composition API and `<script setup>`. TypeScript runs with `noUncheckedIndexedAccess`; the `@` alias points to `src/`.
- Vite for the development server and production build.
- Vue Router for navigation (pages are lazy-loaded) and Pinia for shared state (setup-style stores).
- Tailwind CSS 4 with `@tailwindcss/vite`. There is no `tailwind.config.js`; Tailwind is imported in `src/assets/main.css`.
- `lightweight-charts` v5 for candlestick charts. Series are created with `chart.addSeries(CandlestickSeries, ...)`, not the older `addCandlestickSeries`.
- ESLint, oxlint, and Prettier (no semicolons, single quotes, 100 columns) for code quality; `vue-tsc` for type checking.
- Node `^22.18.0 || >=24.12.0`.
- There are no automated frontend tests yet (no test runner is installed). Verification is type check, lint, build, and running the app.

### 2.2 System design

```text
Browser (Vue dashboard)
  |-- REST + WebSocket, direct ------------------> Binance public market data
  |     (ticker table, candlestick chart)
  |
  '-- GET /signals --> Backend (FastAPI) --> GET /api/v3/klines --> Binance
                         '-- EMA 12/26 signal logic (completed 1h candles)

Backtest CLI (python -m app.backtest) --> klines history --> Binance
  '-- reuses the same signal logic as /signals
```

Design decisions that code changes must respect:

1. **One source of truth for signal logic.** `app/services/ema_cross.py` is used by both `/signals` and the backtest. `ema_cross_sides` (every candle at once, for the backtest) must equal `evaluate_ema_cross` (latest candle, for the API) at every point; a test enforces this.
2. **Only completed candles.** Binance's last candle is still in progress and its price keeps changing, so it is dropped. Using it would let a signal appear and vanish before the candle closes.
3. **No look-ahead in the backtest.** A signal computed from candle `i`'s close is executed at candle `i + 1`'s open.
4. **Signal contract.** `Signal` in `app/schemas.py` is mirrored by `src/types/signals.ts` in the frontend: camelCase JSON, `createdAt` in epoch milliseconds, `confidence` is `null` when the source gives no probability (rule-based signals). Changing it means changing both repositories together.
5. **Who talks to Binance.** The browser reads market data for display directly from Binance. The backend computes signals. Anything sensitive, such as exchange API keys or anything able to place trades, belongs only in the backend and does not exist today.
6. **Failure behavior.** A pair that fails is skipped and logged; if every pair fails, `/signals` returns HTTP 502 with a generic message. The full error text goes only to the server log, never to the client.
7. **Binance base URL.** `BINANCE_URL` defaults to `https://data-api.binance.vision` (Binance's market-data-only host) because from the developer's terminal `api.binance.com` did not reach Binance (TLS certificate mismatch, DNS answering `::1`). The frontend still calls `api.binance.com` and `stream.binance.com` from the browser, which works there but could break on a network that intercepts those names.

### 2.3 Current design system

There is no separate design-token file or formal component-library package. The visual system is implemented with Tailwind utility classes and shared components under `src/components/ui/`:

- Dark dashboard canvas (`gray-950`), cards (`gray-900`), borders and interactive surfaces (`gray-800`), primary text (`gray-100`), and secondary text (`gray-400`).
- Green communicates positive movement and `BUY`; red communicates negative movement and `SELL`; gray communicates neutral values and `HOLD`. Yellow is used for the warning banner.
- Cards, tables, price badges, and signal badges use compact spacing, subtle borders, and rounded corners through Tailwind utilities.

When extending the frontend, follow these existing component and color conventions. Do not describe these utility classes as a formal token system unless one is added.

## 3. Folder structure and rules

```text
crypto-dashboard/
|-- src/
|   |-- main.ts
|   |-- App.vue
|   |-- assets/main.css
|   |-- router/index.ts
|   |-- layouts/DashboardLayout.vue
|   |-- views/            MarketView.vue, SignalsView.vue, PortfolioView.vue
|   |-- features/
|   |   |-- market/       ChartPanel.vue, TickerTable.vue
|   |   '-- signals/      SignalList.vue, SideBadge.vue
|   |-- components/ui/    BaseCard.vue, BaseTable.vue, PriceBadge.vue
|   |-- stores/           market.ts, signals.ts
|   |-- services/         market.ts, marketStream.ts, signals.ts
|   '-- types/            market.ts, signals.ts, table.ts
|-- package.json, vite.config.ts, tsconfig*.json
|-- eslint.config.ts, .oxlintrc.json, .prettierrc.json, .editorconfig
'-- index.html, env.d.ts, README.md, CLAUDE.md
```

Data flows one way: `services/` fetch, `stores/` hold, `features/` and `views/` display.

| Path                   | Purpose                                               | May contain                                        | Must not contain                                              |
| ---------------------- | ----------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| `src/main.ts`          | App bootstrap (Vue, Pinia, router, `main.css`)        | Plugin registration                                | Components, logic                                             |
| `src/App.vue`          | Root component                                        | Only `<RouterView />`                              | Page content                                                  |
| `src/assets/main.css`  | Global CSS                                            | The Tailwind import, rare global styles            | Component styles                                              |
| `src/router/index.ts`  | Route table                                           | Routes under `DashboardLayout`, lazy-loaded views  | Logic                                                         |
| `src/layouts/`         | Page shells (sidebar, header, content area)           | Layout components                                  | Data fetching, domain logic                                   |
| `src/views/`           | One component per route                               | Composition of features, minimal glue              | `fetch`, WebSocket, business logic                            |
| `src/features/<area>/` | Components that know about crypto or trading concepts | Domain components that read stores                 | Generic widgets (those go in `components/ui/`)                |
| `src/components/ui/`   | Generic, domain-agnostic building blocks              | Presentational components with props, slots, emits | Imports from `stores/`, `services/`, `features/`, or `views/` |
| `src/stores/`          | Shared state with `loading` and `error`               | Pinia stores that call `services/`                 | Components, DOM access, direct `fetch`                        |
| `src/services/`        | All network access (REST, WebSocket)                  | Functions returning typed data, reconnect logic    | Imports of `vue`, `pinia`, or `.vue` files                    |
| `src/types/`           | TypeScript types shared across layers                 | Interfaces and type aliases                        | Runtime code, imports from other layers                       |

Known exception: `features/market/ChartPanel.vue` calls `services/` directly instead of going through a store, because its candle data is local to the chart and is applied imperatively to the chart library.

Where to add things:

- New page: a component in `src/views/`, a lazy-loaded route in `src/router/index.ts`, and a menu entry in `DashboardLayout.vue`.
- New domain component: `src/features/<area>/`.
- New reusable widget with no domain knowledge: `src/components/ui/`.
- New external data: a function in `src/services/`, state in a store in `src/stores/`, and its types in `src/types/`.
- Changing what the backend sends: update `src/types/signals.ts` together with `app/schemas.py` in the backend repository.

Conventions: identifiers are in English; user-facing text and code comments are in Indonesian. Environment overrides go in `.env.local`, which Git ignores.

## 4. Features and status

### Implemented: backend repository

- `GET /health` and `GET /signals` (EMA 12/26 crossover on completed 1-hour candles for BTCUSDT, ETHUSDT, BNBUSDT, SOLUSDT, SUIUSDT, HYPEUSDT).
- Concurrent Binance requests, per-pair failure tolerance, HTTP 502 when all pairs fail, structured warning logs with the error text.
- Configuration through `CORS_ORIGINS` and `BINANCE_URL`.
- Backtest CLI: per-side commission and slippage, next-candle-open execution, buy-and-hold comparison, maximum drawdown, exposure, trade statistics, warnings for few trades or short history, and `--until-days-ago` to test non-overlapping periods.
- Automated tests for the API, indicators, strategy, market data, and backtest.

### Implemented: frontend repository

- Dashboard shell with sidebar navigation and three routes.
- Market page: live ticker table, selectable pair, and live candlestick chart with six intervals.
- Signals page: table of backend signals with BUY/SELL/HOLD badges and error states.
- Shared UI components (card, table, price badge).

### In progress

- Strategy research on the EMA baseline (section 9).

### Planned, not started

- AI forecasting model for one to three days ahead, with walk-forward / out-of-sample validation. It must beat buy-and-hold and the EMA baseline after costs.
- Real-time trade ingestion and time-windowed features (transaction counts, volume, buy/sell flow, large trades).
- Portfolio page (currently a placeholder). The design is undecided; if it ever needs exchange access, keys live only in the backend and the "no exchange accounts" statement in section 1 must be updated first.
- Frontend option to use Binance's market-data-only hosts (`data-api.binance.vision`, `data-stream.binance.vision`). The combined-stream path used by the frontend has not been tested on the WebSocket host.

### Out of scope

Placing trades, connecting to exchange accounts, and financial advice.

## 5. Pages and behavior

- Routes: `/` redirects to `/market`; `/market`, `/signals`, and `/portfolio` render inside `DashboardLayout`.
- **Market:** the ticker table loads a REST snapshot, then receives live updates over the Binance `@ticker` WebSocket stream. Clicking a row selects the pair shown in the chart. The chart loads 500 candles through REST, then follows the `@kline_<interval>` stream, with intervals `1m`, `5m`, `15m`, `1h`, `4h`, and `1d`. Both WebSocket connections reconnect after 3 seconds and show a live-status indicator. `ChartPanel` ignores responses from outdated requests, and `TickerTable` does not start a stream after it has been unmounted.
- **Signals:** fetches `GET /signals` from the backend (`VITE_API_URL`, default `http://localhost:8000`) on mount. A `null` `confidence` is shown as `-`. Error messages include the backend's `detail` text. A banner states that the signals come from an EMA crossover, not from an AI model, and are not trading advice. Times use the `id-ID` locale.
- **Portfolio:** placeholder page.
- The pairs are listed in `WATCHLIST` in `src/services/market.ts`; keep it in sync with `WATCHLIST` in the backend's `app/services/signals.py`.

## 6. Commands

From the repository root:

```sh
npm install
npm run dev
npm run type-check
npm run build
npm run lint
npm run format
```

`npm run build` runs the type check and then the Vite build. `vite build` alone skips type checking, and `npm run dev` does not report type errors, so use `npm run build` or `npm run type-check` to catch them. The lint scripts include `--fix` and may modify files; inspect the diff afterwards. `npm run format` rewrites files under `src/` with Prettier.

## 7. Working agreements

- Run `npm run format && npm run lint && npm run build` before committing.
- All network access goes through `src/services/`. Components and views never call `fetch` or open WebSockets themselves (the one exception is listed in section 3's note).
- Changing the `Signal` contract means changing both repositories together (`src/types/signals.ts` and `app/schemas.py`) and checking the JSON against the TypeScript type.
- Exchange API keys and anything able to place trades never belong in frontend code.
- Signals shown in the UI must never be presented as actionable advice. Keep the banner in `SignalList.vue` consistent with the latest backtest result described in the backend repository's `CLAUDE.md`.
- Do not commit `package-lock.json` changes you did not intend.

## 8. Known issues

- The market services call `api.binance.com` and `stream.binance.com` from the browser. On the developer's network these names did not reach Binance from the terminal (TLS certificate mismatch, DNS answering `::1`) but work in the browser; they could break on a network that intercepts them.
- `README.md` may lag behind the code. Trust the source.
- Strategy research status lives in the backend repository's `CLAUDE.md`, section 9.
