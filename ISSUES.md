# Holmes-Risk Issues

Audit performed 2026-04-10.

---

## Critical — Security & Data Integrity

### HR-1: Encryption key sent to the server in plain text
The app's "client-side encryption" (PIN lock) sends the actual encryption key to the server when you unlock. This defeats the entire purpose of client-side encryption — if the server has the key, anyone with server access can decrypt all data. The key should never leave the browser.

### HR-2: Lock screen doesn't actually clear sensitive data
When you lock the app, it tries to clear financial data from memory — but the list of things to clear is wrong. It clears fields that don't exist and misses the ones that do (elevator hedges, crop inventory, bin inventory, fertilizer positions, price log, documents, market prices). Your data stays in browser memory even when "locked."

### HR-3: Splitting a contract can leave orphaned records
When you split a contract into pieces, the app creates the children first, then updates the parent. If the parent update fails (network glitch, server error), the children exist in the database pointing to a parent that still shows "Open." No rollback, no cleanup. Same issue with splitting positions. In a financial app, this is a data integrity risk.

---

## High — Broken Features

### HR-4: Basis and Min Price contracts show "—" on the dashboard
The Recent Contracts list on the dashboard calls the price calculator without passing the current market price. Basis and Min Price contracts need the current futures price to calculate their effective price, so they just show a dash instead of a dollar amount.

### HR-5: Greeks calculator uses the wrong price
The Black-76 options pricing engine feeds in the option's premium (what you paid) as if it were the underlying futures price. If you bought a corn put for $0.35, it uses $0.35 as the corn futures price instead of ~$4.50. All Greeks (delta, gamma, theta, vega) come back completely wrong. This is the biggest "better than Corey imagines" opportunity — fix this one bug and connect it to market data, and he gets auto-calculated Greeks without typing a single number.

### HR-6: Market and Basis pages spam the server on every click
The Market and Basis sub-tabs fetch fresh data from the API every time the page renders — including after closing a modal, changing a filter, or any action that triggers a redraw. This can fire dozens of API requests per session for no reason.

### HR-7: Splitting a position erases its P&L history
When a position is split, the parent gets set to "Closed" but without a closing price. The P&L page skips closed positions without a closing price, so the parent's entire P&L history disappears from reports.

### HR-8: Lock screen can be injected twice
If the authentication flow runs twice (which can happen on soft re-auth), a second lock screen overlay gets added on top of the first. Event listeners double up.

### HR-9: Document upload notes are silently thrown away
When uploading a document, you can type notes — but they're never included in what gets sent to the server. Your notes just disappear.

### HR-10: P&L position type column is always blank
The P&L page tries to show a "Type" column for positions but reads the wrong field name. Every row shows blank where it should say "Call," "Put," "Futures," etc.

### HR-11: Switching crop year on the Inventory page doesn't save
Every other page saves your crop year selection so it persists when you come back. The Inventory page doesn't — it resets to the default every time you reload.

---

## Medium — Should Fix

### HR-12: Crop year dropdowns hardcoded to 2024-2027
Every page has `['2024', '2025', '2026', '2027']` typed out manually. In 2028, the current year won't appear in any dropdown. Should be generated dynamically.

### HR-13: Price log API URLs can be malformed
The price log data fetch builds URLs with trailing `?` or `&` characters. Works in practice (Express ignores them) but is sloppy and could break with a stricter server.

### HR-14: Rolling a contract is not atomic
Rolling creates a roll history record, then separately updates the contract. If the contract update fails, you have a phantom roll record with no matching contract change. Should be a single server-side operation.

### HR-15: Default season hardcoded to 2026
New users always start on crop year 2026 regardless of what year it actually is. Should use the current year.

### HR-16: `SEASON._available` is dead code
A list of available seasons is defined but never used anywhere. Meanwhile every page builds its own hardcoded year list independently.

### HR-17: Charts page is an empty stub
`charts.js` is 21 lines — just a comment saying "implemented in Phase 3." No charting functionality exists. This becomes the major feature in the redesign.

### HR-18: Dashboard auto-refresh timer restarts on every screen update
The 5-minute market data refresh timer is torn down and recreated every time the dashboard renders (modal close, filter change, data save). Should start once when entering the dashboard tab and stop when leaving.

---

## Potential Changes (Not Bugs — Design Improvements)

These are improvements identified during the audit that would be addressed by the planned redesign:

### Production Data Integration
- Pull gross bushels from `field_season` (acres × projected yield) instead of manual settings entry
- Pull actual harvest data from `field_harvest_summary` for forecast-vs-actual
- Pull crop insurance from existing `crop_insurance` table
- Pull elevator list from `grain_buyer` table
- Pull seed/fert/chemical costs from `seed_inventory`, `fert_contracts`, `purchase_order`

### New Features from Grain-Tracker
- **Farm P&L with multiple views** — Summary, Breakeven, Expenses, Cash Flow, Scorecard, Banker Report
- **Budget management** — Per-commodity per-year targets, with auto-populated costs where possible
- **Breakeven calculator** — Cash vs Tax breakeven, using real per-crop costs (not Corey's flawed acreage-proportional allocation)
- **Sell-the-Curve panel** — All crop years side-by-side, net-to-farm freight comparison, one-click contract entry
- **Price target alerts** — Set sell targets by commodity, get notified when market hits them
- **Cash flow projection** — Monthly forecast from contract delivery dates
- **Marketing scorecard** — Average price sold vs annual average vs budget target
- **Banker report** — Print-to-PDF for lender presentations, pulling real data
- **Freight rates** — Per-elevator per-commodity, used in net-to-farm calculations
- **Other income tracking** — Custom hire, rent, etc.

### Charting (Currently Stub)
- Candlestick charts from `market_ohlcv` data (Corey's strength — this is what wins him over)
- Basis trend visualization
- Forward curve analysis
- Position overlays on price charts
- P&L charts

### Architecture Improvements
- Fix Greeks engine to use underlying futures price from market data (not option premium)
- Unified `productionBase()` function — one source of truth for total bushels per commodity
- Server-side atomic operations for split/roll (prevent orphaned records)
- Proper lock screen state clearing
- Dynamic year generation from `SEASON.current`
- Smart data caching on Market/Basis pages (fetch once, not on every render)
