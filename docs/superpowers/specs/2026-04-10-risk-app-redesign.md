# Holmes-Risk Redesign: Smart Familiar + Charts Earned

**Date:** 2026-04-10
**Status:** Approved (design sections validated incrementally)

## Vision

Bridge the farm management lifecycle — turning dirt → analyzing dirt → protecting dirt → profiting from dirt. The portal handles production (turning/analyzing), the risk app handles financial (protecting/profiting). They share the same PostgreSQL data foundation.

The risk app takes Corey's Grain-Tracker feature ideas (built with Claude in the browser on Firebase) and rebuilds them properly on the Holmes Farms stack — auto-populated from existing data, fixing calculation bugs, and adding powerful charting that Corey can't get from a single-file Firebase app.

**Target user:** Corey — resists change, hates over-complication, but reads candlestick charts and commodity curves like a pro. The app must feel familiar enough that he switches from Grain-Tracker, then the charts lock him in.

## Approach: Smart Familiar + Charts Earned

1. Familiar layout with auto-populated data (low switching friction)
2. Fix the 18 existing bugs in holmes-risk
3. Port Corey's best features (P&L, breakeven, sell-the-curve, budget)
4. Build the Charts page — candlesticks, forward curves, position overlays (the reward for switching)

## Navigation: 4 Tabs, Marketing is Home

No dashboard — Corey doesn't like passive summary pages. KPIs live on the pages where they drive decisions.

| Tab | Purpose | Sub-tabs |
|---|---|---|
| **Marketing** (home) | Contracts, positions, hedging decisions | Contracts, Positions, Deliveries, Basis, Sell-the-Curve |
| **Charts** | Candlestick charts, forward curves, basis trends | — (toolbar switches chart type) |
| **P&L** | Financial analysis and reporting | Breakeven, Expenses, Summary, Cash Flow, Scorecard, Banker Report |
| **Settings** | Budget, freight, price targets, config | — |

## Marketing Page (Home)

**Layout: Sidebar + Workspace**

Left sidebar (persistent, ~200px):
- **Position summary** per commodity: hedge %, progress bar, total bushels, net delta
- **Price strip**: Current futures price + change for each commodity
- Color-coded: green >70% hedged, amber 40-70%, red <40%
- Sidebar collapses to bottom strip on mobile

Right workspace (remaining width):
- Sub-tab bar: Contracts | Positions | Deliveries | Basis | Sell-the-Curve
- Full-width tables and forms in the active sub-tab
- Production data (gross bushels) auto-populated from `field_season` — not manually entered

**Sidebar data sources:**
- Hedge % = priced bushels / `productionBase(commodity, season)` — one unified function, no more GT-14 inconsistency
- Bushels from `field_season`: `SUM(acres * proj_yield) WHERE commodity = X AND season = Y`
- Prices from `market_price` table (Databento via server proxy)
- Delta from positions with auto-calculated Greeks (HR-5 fix: use underlying futures price, not option premium)

## Charts Page

**Layout: Chart (70%) + Info Panel (30%)**

Toolbar:
- Commodity selector (Corn, Beans, Wheat, HO)
- Chart type (Candlestick, Forward Curve, Basis)
- Timeframe (1W, 1M, 3M, 6M, 1Y)
- Overlay toggles: Positions, Price Targets, Breakeven

Chart area:
- Candlestick chart from `market_ohlcv` data
- Horizontal dashed lines overlaid for: contract prices (blue), price targets (green), breakeven (red)
- Current price label on right edge

Info panel (right side):
- OHLCV data for selected commodity/date
- Position summary: hedge %, avg price, breakeven, open bushels
- Active price targets for this commodity
- Panel collapses below chart on mobile

**Charting library:** Lightweight-charts (TradingView open source) or Chart.js with financial plugin. Must support candlestick rendering, horizontal line annotations, and responsive resize.

## P&L Page (6 Sub-Views)

### Breakeven
- Cash breakeven (excludes depreciation) and Tax breakeven (includes depreciation) per commodity
- **Per-crop costs** from real data:
  - Seed → `seed_inventory` + `seed_products` costs for the season
  - Fertilizer → `fert_contracts` + `fert_purchases` for the season
  - Chemical → `purchase_order` where category = chemical
  - Shared overhead (land rent, labor, insurance, etc.) → `farm_expense` table, allocated by acreage
- Fixes GT-15: per-crop COGS are real, only shared costs allocated proportionally
- Formula: `Cash BE = (Direct Crop COGS + Allocated Overhead - Depreciation) / Production Base`
- Formula: `Tax BE = (Direct Crop COGS + Allocated Overhead) / Production Base`

### Expenses
- Budgeted vs Actual with variance, per category
- Auto-filled categories: seed, fertilizer, chemical (from PO/fert/seed tables)
- Manual categories: land rent, management, labor, insurance, interest, repairs, utilities, other (~8)
- Stored in `farm_expense` table (season, category, budgeted, actual)

### Summary
- Budgeted vs projected grain revenue by commodity
- Total expenses (from Expenses sub-tab)
- Net income (revenue - expenses)
- Cash income (net income + depreciation)
- Revenue calculated from: `SUM(contract bushels * effective price)` for priced + `SUM(unpriced bushels * current market)` for open
- Fixes GT-19: uses real market prices for mark-to-market

### Cash Flow
- Monthly projection based on contract delivery dates
- Pulls from `grain_contract.delivery_start` / `delivery_end`
- Excludes cancelled AND split contracts (fixes GT-25)
- Bar chart: expected revenue by month

### Scorecard
- Per commodity: average price sold vs annual average market price vs budget target
- Average price sold = weighted average of delivered contract effective prices
- Annual average = mean of daily settle prices from `market_ohlcv`
- Budget target = from `farm_budget.target_price`

### Banker Report
- Print-to-PDF format for lender presentations
- Pulls all data from the other P&L sub-views — not manually entered
- Operation overview: total acres by commodity (from `field_season`)
- Financial summary: budgeted revenue, expenses, net income
- Marketing summary: acres, yield, budgeted bushels, target price, breakeven, % priced

## Sell-the-Curve (Marketing Sub-Tab)

Three-step flow in one view:

**Panel 1 — Opportunity:** All crop years side-by-side showing available (unpriced) bushels, cash breakeven, tax breakeven, current market price. Green if above breakeven, red if below.

**Panel 2 — Elevator Comparison:** Net-to-farm price grid. Each elevator's posted bid minus freight rate (from `grain_buyer_freight`). Best elevator highlighted. Basis level per elevator if available.

**Panel 3 — Execute:** Pre-filled contract form. Commodity, bushels, price, elevator, delivery period, crop year all pre-populated. Corey confirms or adjusts, hits save. Contract created directly in `grain_contract`. Sidebar updates immediately.

## Settings Page

| Setting | Source | Entry Type |
|---|---|---|
| Crop year | Dynamic from current year | Toggle |
| Commodities | `grain_marketing_config` | Admin edit |
| Elevators | `grain_buyer` table | Synced from portal |
| Freight rates | `grain_buyer_freight` (new) | Manual per elevator per commodity |
| Budget | `farm_budget` (new), pre-filled from `field_season` | Confirm/adjust |
| Expenses | `farm_expense` (new), auto-filled where possible | Manual for ~8 categories |
| Price targets | `price_target` (new) | Manual |
| Other income | `other_income` (new) | Manual |

## Data Architecture

### Existing Tables (read/query — no schema changes needed)

| Data | Table | Query |
|---|---|---|
| Production base | `field_season` + `field` | `SUM(acres * proj_yield) GROUP BY commodity, season` |
| Actual harvest | `field_harvest_summary` | Per field per season |
| Elevators | `grain_buyer` | Direct read |
| Contracts | `grain_contract` | Full CRUD via risk API |
| Deliveries | `grain_delivery` | Full CRUD via risk API |
| Pending tickets | `grain_pending_ticket` | Read |
| Market prices | `market_price` + `market_ohlcv` | Read (populated by Databento proxy) |
| Crop insurance | `crop_insurance` | Per field per season |
| Fert costs | `fert_contracts` + `fert_purchases` | Aggregate for breakeven |
| Seed costs | `seed_inventory` + `seed_products` | Aggregate for breakeven |
| Purchase orders | `purchase_order` | Aggregate for breakeven |
| Marketing config | `grain_marketing_config` | Settings |

### New Tables

```sql
-- Per-commodity per-season budget targets
CREATE TABLE farm_budget (
    id SERIAL PRIMARY KEY,
    season SMALLINT NOT NULL,
    commodity TEXT NOT NULL,
    target_price NUMERIC(10,4),
    target_yield NUMERIC(10,2),
    budgeted_acres NUMERIC(10,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(season, commodity)
);

-- Budgeted vs actual expense line items
CREATE TABLE farm_expense (
    id SERIAL PRIMARY KEY,
    season SMALLINT NOT NULL,
    category TEXT NOT NULL,
    budgeted NUMERIC(12,2),
    actual NUMERIC(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(season, category)
);

-- Price alert thresholds
CREATE TABLE price_target (
    id SERIAL PRIMARY KEY,
    commodity TEXT NOT NULL,
    crop_year TEXT NOT NULL,
    target_price NUMERIC(10,4) NOT NULL,
    futures_month TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT TRUE,
    triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Non-grain income
CREATE TABLE other_income (
    id SERIAL PRIMARY KEY,
    season SMALLINT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(season, category)
);

-- Freight cost per elevator per commodity
CREATE TABLE grain_buyer_freight (
    id SERIAL PRIMARY KEY,
    buyer_id INTEGER REFERENCES grain_buyer(id) ON DELETE CASCADE,
    commodity TEXT NOT NULL,
    rate_per_bu NUMERIC(8,4) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(buyer_id, commodity)
);
```

### Existing Table Extensions

```sql
-- Add strategy column to grain_contract
ALTER TABLE grain_contract ADD COLUMN strategy TEXT;

-- Add settlement tracking to grain_delivery (or new table)
ALTER TABLE grain_delivery ADD COLUMN settlement_amount NUMERIC(12,2);
ALTER TABLE grain_delivery ADD COLUMN settlement_date DATE;
ALTER TABLE grain_delivery ADD COLUMN shrink_bu NUMERIC(10,2);
ALTER TABLE grain_delivery ADD COLUMN moisture_discount NUMERIC(10,4);
ALTER TABLE grain_delivery ADD COLUMN drying_charge NUMERIC(10,4);
```

## Bug Fixes (from ISSUES.md)

All 18 existing holmes-risk bugs will be fixed as part of this work. Critical and high issues are addressed in the tasks where they're relevant:

- **HR-1, HR-2, HR-8**: Lock screen / encryption fixes (standalone task)
- **HR-3, HR-14**: Atomic split/roll operations (server-side endpoints)
- **HR-4**: Dashboard effective price missing arg (removed — no dashboard)
- **HR-5**: Greeks using wrong price (fixed when building Charts page)
- **HR-6**: Market/Basis fetch spam (fixed when rebuilding Marketing sub-tabs)
- **HR-7**: Split position P&L loss (fixed when rebuilding Positions sub-tab)
- **HR-9**: Document notes discarded (fixed when rebuilding Documents)
- **HR-10**: P&L positionType field (fixed when building P&L page)
- **HR-11**: Inventory crop year persistence (fixed in Settings)
- **HR-12, HR-15, HR-16**: Hardcoded years and season (fixed globally — dynamic generation)
- **HR-13**: Malformed query strings (fixed in db.js)
- **HR-17**: Charts stub (replaced by full Charts page)
- **HR-18**: Dashboard auto-refresh (replaced — no dashboard, prices in sidebar)

## Out of Scope

- Grain-Tracker bug fixes (documented in GT ISSUES.md, separate effort)
- Data migration from Grain-Tracker Firebase to PostgreSQL (future — import script exists)
- Real-time price streaming (settle prices on 5-min refresh is sufficient)
- Broker API integration (Greeks auto-calculated, but positions still manually entered)
- Mobile-native app (PWA with responsive design is sufficient)
