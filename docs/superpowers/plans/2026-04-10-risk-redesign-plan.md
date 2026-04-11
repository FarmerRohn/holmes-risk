# Holmes-Risk Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign holmes-risk to incorporate Corey's Grain-Tracker feature ideas (P&L, breakeven, sell-the-curve, budget) with auto-populated data from the portal's PostgreSQL tables, fix 18 existing bugs, and add candlestick charting.

**Architecture:** 4-tab layout (Marketing home, Charts, P&L, Settings) with persistent sidebar showing per-commodity hedge position. Data flows from portal tables (field_season, fert_contracts, seed_inventory) into risk calculations. New tables for budget, expenses, price targets, freight rates. Charting via lightweight-charts library.

**Tech Stack:** Vanilla JS (global scope, no import/export), Express REST API, PostgreSQL + Knex migrations, lightweight-charts (TradingView OSS) for candlesticks.

**Spec:** `docs/superpowers/specs/2026-04-10-risk-app-redesign.md`
**Issues:** `ISSUES.md` (18 bugs documented)

---

## Phase Overview

| Phase | What | Depends On | Plan Detail |
|---|---|---|---|
| **1: Foundation** | Bug fixes, new DB tables, API routes, dynamic years, productionBase() | Nothing | Full detail below |
| **2: Marketing Redesign** | Sidebar layout, 4-tab nav, rebuild sub-tabs | Phase 1 | Task-level below, detailed plan written before execution |
| **3: P&L + Budget** | 6 sub-views, breakeven calcs, expense tracking, banker report | Phase 1 | Task-level below, detailed plan written before execution |
| **4: Sell-the-Curve** | Elevator comparison, freight rates, one-click contract creation | Phases 1 + 2 | Task-level below, detailed plan written before execution |
| **5: Charts** | Candlestick charts, forward curves, position overlays, info panel | Phases 1 + 2 | Task-level below, detailed plan written before execution |

---

## File Map

### New Files (Frontend — holmes-risk)

| File | Responsibility |
|---|---|
| `js/production.js` | `productionBase()` — unified bushel calculation from field_season data |
| `js/pages/sell-the-curve.js` | Sell-the-Curve sub-tab (elevator comparison, one-click contract) |
| `js/pages/charts.js` | Full charts page (replaces 21-line stub) |
| `js/sidebar.js` | Persistent position sidebar component |

### Modified Files (Frontend — holmes-risk)

| File | Changes |
|---|---|
| `js/config.js` | Remove hardcoded year lists, add chart config |
| `js/state.js` | Add new state keys (budget, expenses, priceTargets, otherIncome, freightRates, productionData) |
| `js/season.js` | Dynamic year generation from `new Date().getFullYear()` |
| `js/db.js` | Add API functions for new endpoints (budget, expenses, targets, freight, production-base, cost-summary) |
| `js/ui.js` | Update TAB_CONFIG (4 tabs), renderHeader (remove crop year badge duplication), renderTabNav |
| `js/pages.js` | Update router for 4-tab layout, add sidebar rendering |
| `js/risk-calc.js` | Fix calcPL to use market prices (HR-10 positionType), add breakeven functions |
| `js/greeks.js` | No changes needed (engine is correct, bug is in positions.js calling it wrong) |
| `js/pages/grain.js` | Fix split atomicity (HR-3), integrate sidebar, fix fetch spam |
| `js/pages/positions.js` | Fix Greeks price bug (HR-5), fix split P&L loss (HR-7), fix positionType |
| `js/pages/deliveries.js` | Add settlement fields |
| `js/pages/pnl.js` | Complete rewrite — 6 sub-views |
| `js/pages/settings.js` | Add budget, freight rates, price targets, expenses sections |
| `js/pages/inventory.js` | Fix crop year persistence (HR-11), integrate production data |
| `js/pages/market.js` | Fix fetch spam (HR-6), integrate with Charts page |
| `js/pages/basis.js` | Fix fetch spam (HR-6) |
| `js/pages/dashboard.js` | Remove (replaced by Marketing home) |
| `js/pages/documents.js` | Fix notes field (HR-9) |
| `js/pages/price-log.js` | Fix query string (HR-13) |
| `js/lock-screen.js` | Fix STATE clearing (HR-2), fix double inject (HR-8) |
| `js/init.js` | Update init sequence for new data loading |
| `build.js` | Add new files to JS_FILES, remove dashboard.js |

### New Files (Backend — holmes-farms-server)

| File | Responsibility |
|---|---|
| `docker/api/migrations/YYYYMMDD_risk_redesign.js` | New tables + ALTER statements |
| `docker/api/src/routes/risk-aggregate.js` | Read-only aggregation routes (production-base, cost-summary) |

### Modified Files (Backend — holmes-farms-server)

| File | Changes |
|---|---|
| `docker/api/src/routes/risk.js` | Add CRUD routes for budget, expenses, price-targets, other-income, freight-rates. Add atomic split/roll endpoints. |
| `docker/api/src/index.js` | Mount risk-aggregate routes |

---

## Phase 1: Foundation

### Task 1: Database Migration — New Tables

**Files:**
- Create: `holmes-farms-server/docker/api/migrations/20260410_risk_redesign.js`

- [ ] **Step 1: Create migration file**

```javascript
// holmes-farms-server/docker/api/migrations/20260410_risk_redesign.js

exports.up = async function(knex) {
  // Farm budget — per-commodity per-season targets
  await knex.schema.createTable('risk_farm_budget', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.text('user_email').notNullable().references('email').inTable('user_role');
    t.smallint('season').notNullable();
    t.text('commodity').notNullable();
    t.decimal('target_price', 10, 4);
    t.decimal('target_yield', 10, 2);
    t.decimal('budgeted_acres', 10, 2);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['user_email', 'season', 'commodity']);
  });

  // Farm expense — budgeted vs actual per category per season
  await knex.schema.createTable('risk_farm_expense', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.text('user_email').notNullable().references('email').inTable('user_role');
    t.smallint('season').notNullable();
    t.text('category').notNullable();
    t.decimal('budgeted', 12, 2);
    t.decimal('actual', 12, 2);
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['user_email', 'season', 'category']);
  });

  // Price targets — sell alerts
  await knex.schema.createTable('risk_price_target', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.text('user_email').notNullable().references('email').inTable('user_role');
    t.text('commodity').notNullable();
    t.text('crop_year').notNullable();
    t.decimal('target_price', 10, 4).notNullable();
    t.text('futures_month');
    t.text('notes');
    t.boolean('active').defaultTo(true);
    t.timestamp('triggered_at', { useTz: true });
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
  });

  // Other income — non-grain income
  await knex.schema.createTable('risk_other_income', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.text('user_email').notNullable().references('email').inTable('user_role');
    t.smallint('season').notNullable();
    t.text('category').notNullable();
    t.decimal('amount', 12, 2);
    t.text('notes');
    t.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['user_email', 'season', 'category']);
  });

  // Freight rates — per elevator per commodity
  await knex.schema.createTable('risk_freight_rate', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('uuid_generate_v4()'));
    t.text('user_email').notNullable().references('email').inTable('user_role');
    t.text('buyer_name').notNullable();
    t.text('commodity').notNullable();
    t.decimal('rate_per_bu', 8, 4).notNullable();
    t.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    t.unique(['user_email', 'buyer_name', 'commodity']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('risk_freight_rate');
  await knex.schema.dropTableIfExists('risk_other_income');
  await knex.schema.dropTableIfExists('risk_price_target');
  await knex.schema.dropTableIfExists('risk_farm_expense');
  await knex.schema.dropTableIfExists('risk_farm_budget');
};
```

- [ ] **Step 2: Run migration on server**

```bash
ssh rohn@192.168.69.8 "cd /home/rohn/holmes-farms-server && docker compose exec -T api npx knex migrate:latest" 2>/dev/null
```

Expected: Migration runs, 5 tables created.

- [ ] **Step 3: Verify tables exist**

```bash
ssh rohn@192.168.69.8 "cd /home/rohn/holmes-farms-server && docker compose exec -T postgres psql -U holmes -d holmes -c \"SELECT tablename FROM pg_tables WHERE tablename LIKE 'risk_farm%' OR tablename LIKE 'risk_price_target' OR tablename LIKE 'risk_other_income' OR tablename LIKE 'risk_freight_rate' ORDER BY tablename\"" 2>/dev/null
```

Expected: 5 rows returned.

- [ ] **Step 4: Commit**

```bash
cd /home/adam/projects/holmes-farms-server
git add docker/api/migrations/20260410_risk_redesign.js
git commit -m "Add risk redesign migration: budget, expense, price target, other income, freight rate tables"
```

---

### Task 2: API Routes — New CRUD Endpoints

**Files:**
- Modify: `holmes-farms-server/docker/api/src/routes/risk.js`

- [ ] **Step 1: Add farm budget CRUD**

Add after the existing fert-positions route block in `risk.js`:

```javascript
// Farm Budget
router.use('/budget', createRiskCrudRouter({
  table: 'risk_farm_budget',
  columns: ['season', 'commodity', 'target_price', 'target_yield', 'budgeted_acres'],
  orderBy: 'season DESC, commodity',
  filters: { season: 'season', commodity: 'commodity' },
  hasSoftDelete: false,
  hasUserScope: true,
}));
```

- [ ] **Step 2: Add farm expense CRUD**

```javascript
// Farm Expenses
router.use('/expenses', createRiskCrudRouter({
  table: 'risk_farm_expense',
  columns: ['season', 'category', 'budgeted', 'actual'],
  orderBy: 'season DESC, category',
  filters: { season: 'season', category: 'category' },
  hasSoftDelete: false,
  hasUserScope: true,
}));
```

- [ ] **Step 3: Add price targets CRUD**

```javascript
// Price Targets
router.use('/price-targets', createRiskCrudRouter({
  table: 'risk_price_target',
  columns: ['commodity', 'crop_year', 'target_price', 'futures_month', 'notes', 'active', 'triggered_at'],
  orderBy: 'active DESC, commodity, target_price',
  filters: { commodity: 'commodity', cropYear: 'crop_year', active: 'active' },
  hasSoftDelete: false,
  hasUserScope: true,
}));
```

- [ ] **Step 4: Add other income CRUD**

```javascript
// Other Income
router.use('/other-income', createRiskCrudRouter({
  table: 'risk_other_income',
  columns: ['season', 'category', 'amount', 'notes'],
  orderBy: 'season DESC, category',
  filters: { season: 'season' },
  hasSoftDelete: false,
  hasUserScope: true,
}));
```

- [ ] **Step 5: Add freight rates CRUD**

```javascript
// Freight Rates
router.use('/freight-rates', createRiskCrudRouter({
  table: 'risk_freight_rate',
  columns: ['buyer_name', 'commodity', 'rate_per_bu'],
  orderBy: 'buyer_name, commodity',
  filters: { buyerName: 'buyer_name', commodity: 'commodity' },
  hasSoftDelete: false,
  hasUserScope: true,
}));
```

- [ ] **Step 6: Commit**

```bash
cd /home/adam/projects/holmes-farms-server
git add docker/api/src/routes/risk.js
git commit -m "Add risk CRUD routes: budget, expenses, price-targets, other-income, freight-rates"
```

---

### Task 3: API Routes — Production Base Aggregation

**Files:**
- Create: `holmes-farms-server/docker/api/src/routes/risk-aggregate.js`
- Modify: `holmes-farms-server/docker/api/src/index.js`

- [ ] **Step 1: Create aggregation route file**

```javascript
// holmes-farms-server/docker/api/src/routes/risk-aggregate.js
var express = require('express');
var router = express.Router();
var db = require('../db');

// GET /api/risk-aggregate/production-base?season=2026
// Returns: [{ commodity, total_acres, avg_yield, total_bushels }]
// Source: field_season + field tables (portal data)
router.get('/production-base', async function(req, res) {
  try {
    var season = parseInt(req.query.season) || new Date().getFullYear();
    if (isNaN(season) || season < 2020 || season > 2050) {
      return res.status(400).json({ error: 'Invalid season' });
    }

    var rows = await db('field_season')
      .join('field', 'field.id', 'field_season.field_id')
      .select(
        'field_season.crop as commodity',
        db.raw('SUM(field.acres) as total_acres'),
        db.raw('AVG(field_season.yield_goal) as avg_yield'),
        db.raw('SUM(field.acres * COALESCE(field_season.yield_goal, 0)) as total_bushels')
      )
      .where('field_season.season', season)
      .whereNotNull('field_season.crop')
      .groupBy('field_season.crop');

    res.json(rows);
  } catch (err) {
    console.error('production-base error:', err.message);
    res.status(500).json({ error: 'Failed to fetch production base' });
  }
});

// GET /api/risk-aggregate/cost-summary?season=2026
// Returns: { seed: { total, byCommodity }, fert: { total, byCommodity }, chemical: { total } }
// Source: seed_inventory, fert_contracts, fert_purchases, purchase_order
router.get('/cost-summary', async function(req, res) {
  try {
    var season = parseInt(req.query.season) || new Date().getFullYear();

    // Seed costs from seed_inventory
    var seedRows = await db('seed_inventory')
      .join('seed_products', 'seed_products.id', 'seed_inventory.product_id')
      .select(
        'seed_products.crop as commodity',
        db.raw('SUM(seed_inventory.units * COALESCE(seed_inventory.price_per_unit, 0)) as total_cost')
      )
      .where('seed_inventory.season', season)
      .groupBy('seed_products.crop');

    // Fert costs from fert_purchases
    var fertRows = await db('fert_purchase')
      .select(db.raw('SUM(total_cost) as total_cost'))
      .where('season', season);

    // Chemical costs from purchase_order where category is chemical
    var chemRows = await db('purchase_order')
      .select(db.raw('SUM(total) as total_cost'))
      .where('category', 'chemical')
      .where('season', season);

    res.json({
      seed: { byCommodity: seedRows, total: seedRows.reduce(function(s, r) { return s + (parseFloat(r.total_cost) || 0); }, 0) },
      fert: { total: fertRows[0] ? parseFloat(fertRows[0].total_cost) || 0 : 0 },
      chemical: { total: chemRows[0] ? parseFloat(chemRows[0].total_cost) || 0 : 0 }
    });
  } catch (err) {
    console.error('cost-summary error:', err.message);
    res.status(500).json({ error: 'Failed to fetch cost summary' });
  }
});

// GET /api/risk-aggregate/harvest-summary?season=2026
// Returns: [{ commodity, total_acres_harvested, total_bushels_harvested, avg_yield }]
// Source: field_harvest_summary + field tables
router.get('/harvest-summary', async function(req, res) {
  try {
    var season = parseInt(req.query.season) || new Date().getFullYear();

    var rows = await db('field_harvest_summary')
      .join('field', 'field.id', 'field_harvest_summary.field_id')
      .join('field_season', function() {
        this.on('field_season.field_id', 'field_harvest_summary.field_id')
            .andOn('field_season.season', db.raw('?', [season]));
      })
      .select(
        'field_season.crop as commodity',
        db.raw('SUM(field_harvest_summary.harvested_acres) as total_acres_harvested'),
        db.raw('SUM(field_harvest_summary.total_bushels) as total_bushels_harvested'),
        db.raw('CASE WHEN SUM(field_harvest_summary.harvested_acres) > 0 THEN SUM(field_harvest_summary.total_bushels) / SUM(field_harvest_summary.harvested_acres) ELSE 0 END as avg_yield')
      )
      .where('field_harvest_summary.season', season)
      .groupBy('field_season.crop');

    res.json(rows);
  } catch (err) {
    console.error('harvest-summary error:', err.message);
    res.status(500).json({ error: 'Failed to fetch harvest summary' });
  }
});

// GET /api/risk-aggregate/buyers
// Returns: [{ id, name }] — grain buyers for dropdowns
router.get('/buyers', async function(req, res) {
  try {
    var rows = await db('grain_buyer')
      .select('id', 'name')
      .orderBy('name');
    res.json(rows);
  } catch (err) {
    console.error('buyers error:', err.message);
    res.status(500).json({ error: 'Failed to fetch buyers' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Mount in index.js**

In `holmes-farms-server/docker/api/src/index.js`, add after the existing risk mount (line ~142):

```javascript
app.use('/api/risk-aggregate', requireAuth, require('./routes/risk-aggregate'));
```

- [ ] **Step 3: Commit**

```bash
cd /home/adam/projects/holmes-farms-server
git add docker/api/src/routes/risk-aggregate.js docker/api/src/index.js
git commit -m "Add risk aggregation routes: production-base, cost-summary, harvest-summary, buyers"
```

---

### Task 4: Frontend API Functions — New Endpoints

**Files:**
- Modify: `holmes-risk/js/db.js`

- [ ] **Step 1: Add new API functions to db.js**

Add after the existing market functions (after line ~235):

```javascript
/* ── Budget ─────────────────────────────────── */
function fetchBudgetDB(season) {
  var qs = season ? '?season=' + season : '';
  return _riskFetch('/risk/budget' + qs);
}
function createBudgetDB(data) {
  return _riskFetch('/risk/budget', { method: 'POST', body: JSON.stringify(data) });
}
function updateBudgetDB(id, data) {
  return _riskFetch('/risk/budget/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}
function deleteBudgetDB(id) {
  return _riskFetch('/risk/budget/' + id, { method: 'DELETE' });
}

/* ── Expenses ───────────────────────────────── */
function fetchExpensesDB(season) {
  var qs = season ? '?season=' + season : '';
  return _riskFetch('/risk/expenses' + qs);
}
function createExpenseDB(data) {
  return _riskFetch('/risk/expenses', { method: 'POST', body: JSON.stringify(data) });
}
function updateExpenseDB(id, data) {
  return _riskFetch('/risk/expenses/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}

/* ── Price Targets ──────────────────────────── */
function fetchPriceTargetsDB(cropYear) {
  var qs = cropYear ? '?cropYear=' + cropYear : '';
  return _riskFetch('/risk/price-targets' + qs);
}
function createPriceTargetDB(data) {
  return _riskFetch('/risk/price-targets', { method: 'POST', body: JSON.stringify(data) });
}
function updatePriceTargetDB(id, data) {
  return _riskFetch('/risk/price-targets/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}
function deletePriceTargetDB(id) {
  return _riskFetch('/risk/price-targets/' + id, { method: 'DELETE' });
}

/* ── Other Income ───────────────────────────── */
function fetchOtherIncomeDB(season) {
  var qs = season ? '?season=' + season : '';
  return _riskFetch('/risk/other-income' + qs);
}
function createOtherIncomeDB(data) {
  return _riskFetch('/risk/other-income', { method: 'POST', body: JSON.stringify(data) });
}
function updateOtherIncomeDB(id, data) {
  return _riskFetch('/risk/other-income/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}

/* ── Freight Rates ──────────────────────────── */
function fetchFreightRatesDB() {
  return _riskFetch('/risk/freight-rates');
}
function createFreightRateDB(data) {
  return _riskFetch('/risk/freight-rates', { method: 'POST', body: JSON.stringify(data) });
}
function updateFreightRateDB(id, data) {
  return _riskFetch('/risk/freight-rates/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}
function deleteFreightRateDB(id) {
  return _riskFetch('/risk/freight-rates/' + id, { method: 'DELETE' });
}

/* ── Aggregation (read-only from portal tables) */
function fetchProductionBaseDB(season) {
  return _riskFetch('/risk-aggregate/production-base?season=' + (season || SEASON.current));
}
function fetchCostSummaryDB(season) {
  return _riskFetch('/risk-aggregate/cost-summary?season=' + (season || SEASON.current));
}
function fetchHarvestSummaryDB(season) {
  return _riskFetch('/risk-aggregate/harvest-summary?season=' + (season || SEASON.current));
}
function fetchBuyersDB() {
  return _riskFetch('/risk-aggregate/buyers');
}
```

- [ ] **Step 2: Fix existing fetchPriceLogDB query string (HR-13)**

Replace the existing `fetchPriceLogDB` function:

```javascript
function fetchPriceLogDB(commodity, limit) {
  var params = [];
  if (commodity) params.push('commodity=' + encodeURIComponent(commodity));
  if (limit) params.push('limit=' + limit);
  var qs = params.length ? '?' + params.join('&') : '';
  return _riskFetch('/risk/price-log' + qs);
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/adam/projects/holmes-risk
git add js/db.js
git commit -m "Add API functions for budget, expenses, targets, freight, production-base, cost-summary; fix HR-13 query string"
```

---

### Task 5: Fix Season + Dynamic Years

**Files:**
- Modify: `holmes-risk/js/season.js`
- Modify: `holmes-risk/js/state.js`

- [ ] **Step 1: Make SEASON dynamic (HR-15, HR-16)**

Replace entire `season.js`:

```javascript
/* season.js — dynamic crop year management */
var SEASON = {
  get current() {
    return String(new Date().getFullYear());
  },
  get previous() {
    return String(new Date().getFullYear() - 1);
  },
  get next() {
    return String(new Date().getFullYear() + 1);
  },
  get year() {
    return new Date().getFullYear();
  },
  get label() {
    return this.current + ' Season';
  },
  get available() {
    var y = new Date().getFullYear();
    return [String(y - 1), String(y), String(y + 1), String(y + 2)];
  }
};
```

- [ ] **Step 2: Add new state keys**

In `state.js`, add after `marketPrices: []`:

```javascript
  // New — redesign state
  budget: [],
  expenses: [],
  priceTargets: [],
  otherIncome: [],
  freightRates: [],
  productionData: [],    // from field_season aggregation
  costSummary: null,     // from fert/seed/PO aggregation
  harvestSummary: [],    // from field_harvest_summary aggregation
  buyers: [],            // from grain_buyer
```

- [ ] **Step 3: Commit**

```bash
cd /home/adam/projects/holmes-risk
git add js/season.js js/state.js
git commit -m "Make SEASON dynamic, add new state keys for budget/expenses/production; fix HR-15 HR-16"
```

---

### Task 6: Fix Critical Bugs — Lock Screen (HR-2, HR-8)

**Files:**
- Modify: `holmes-risk/js/lock-screen.js`

- [ ] **Step 1: Fix STATE key clearing (HR-2)**

Find `lockApp()` function and replace the STATE clearing block with:

```javascript
  // Clear all sensitive data from STATE
  var sensitiveKeys = [
    'contracts', 'positions', 'elevatorHedges', 'deliveries',
    'documents', 'cropInventory', 'binInventory', 'fertPositions',
    'priceLog', 'marketPrices', 'budget', 'expenses',
    'priceTargets', 'otherIncome', 'freightRates',
    'productionData', 'costSummary', 'harvestSummary', 'buyers'
  ];
  sensitiveKeys.forEach(function(key) {
    if (Array.isArray(STATE[key])) STATE[key] = [];
    else STATE[key] = null;
  });
```

- [ ] **Step 2: Guard against double lock screen injection (HR-8)**

At the top of `initLockScreen()`, add:

```javascript
  if (document.getElementById('lockOverlay')) return;
```

- [ ] **Step 3: Commit**

```bash
cd /home/adam/projects/holmes-risk
git add js/lock-screen.js
git commit -m "Fix lock screen: clear correct STATE keys (HR-2), prevent double injection (HR-8)"
```

---

### Task 7: Fix High Bugs — Positions + P&L (HR-5, HR-7, HR-10)

**Files:**
- Modify: `holmes-risk/js/pages/positions.js`
- Modify: `holmes-risk/js/pages/pnl.js`

- [ ] **Step 1: Fix Greeks price input (HR-5)**

In `positions.js`, find `posCalcGreeks()`. The line that sets `F` should use the underlying futures price from market data, not the option's entry/current price:

```javascript
  // Get underlying futures price from market data, NOT the option premium
  var F = getLatestFuturesPrice(p.commodity, STATE.marketPrices);
  if (!F) {
    showToast('No market price available for ' + esc(p.commodity) + ' — cannot calculate Greeks', 'error');
    return;
  }
```

- [ ] **Step 2: Fix split position closing (HR-7)**

In `positions.js`, find `posConfirmSplit()`. When updating the parent position status, use `'Split'` instead of `'Closed'`:

```javascript
  // Update parent to Split status (not Closed — preserves P&L history)
  updateRiskPositionDB(parentId, { status: 'Split', closeReason: 'Split into ' + pieces.length + ' positions' })
```

- [ ] **Step 3: Fix P&L positionType field (HR-10)**

In `pnl.js`, find `_pnlRenderPositionDetail()`. Change `positionType` to `contractType`:

```javascript
  // was: positionType: p.positionType || ''
  positionType: p.contractType || ''
```

Also update the P&L calculation to handle `'Split'` status — skip split parents (their bushels are in the children):

```javascript
  // Filter out Split-status positions (their value is in children)
  var activePositions = STATE.positions.filter(function(p) {
    return p.status !== 'Split';
  });
```

- [ ] **Step 4: Commit**

```bash
cd /home/adam/projects/holmes-risk
git add js/pages/positions.js js/pages/pnl.js
git commit -m "Fix Greeks price input (HR-5), split status (HR-7), P&L positionType field (HR-10)"
```

---

### Task 8: Fix High Bugs — Fetch Spam + Documents + Inventory (HR-6, HR-9, HR-11)

**Files:**
- Modify: `holmes-risk/js/pages/market.js`
- Modify: `holmes-risk/js/pages/basis.js`
- Modify: `holmes-risk/js/pages/documents.js`
- Modify: `holmes-risk/js/pages/inventory.js`

- [ ] **Step 1: Fix market.js fetch spam (HR-6)**

Add a cache guard at the top of `_marketFetchCurve`:

```javascript
var _marketCache = {};
var _marketCacheTime = 0;
var MARKET_CACHE_TTL = 60000; // 1 minute

function _marketFetchCurve(commodity) {
  var now = Date.now();
  if (_marketCache[commodity] && (now - _marketCacheTime) < MARKET_CACHE_TTL) {
    _marketRenderCurveData(_marketCache[commodity]);
    return;
  }
  // ... existing fetch logic, but store result:
  // _marketCache[commodity] = data; _marketCacheTime = now;
```

- [ ] **Step 2: Fix basis.js fetch spam (HR-6)**

Same pattern — add cache guard to `_basisFetchAll`:

```javascript
var _basisCache = null;
var _basisCacheTime = 0;

function _basisFetchAll() {
  var now = Date.now();
  if (_basisCache && (now - _basisCacheTime) < MARKET_CACHE_TTL) {
    _basisRenderData(_basisCache);
    return;
  }
  // ... existing fetch, store result
```

- [ ] **Step 3: Fix document notes field (HR-9)**

In `documents.js`, find the document upload POST payload. Add `notes` to the body:

```javascript
  var payload = {
    docType: docType,
    fileName: file.name,
    notes: notes,          // was missing — HR-9
    parsedData: parsed ? JSON.stringify(parsed) : null
  };
```

- [ ] **Step 4: Fix inventory crop year persistence (HR-11)**

In `inventory.js`, replace the inline `onchange` with a function call that persists:

```javascript
function _invChangeCropYear(val) {
  STATE.activeCropYear = val;
  upsertRiskSettingDB('activeCropYear', val);
  renderApp();
}
```

Update both toolbar selects to use `onchange="_invChangeCropYear(this.value)"`.

- [ ] **Step 5: Commit**

```bash
cd /home/adam/projects/holmes-risk
git add js/pages/market.js js/pages/basis.js js/pages/documents.js js/pages/inventory.js
git commit -m "Fix fetch spam (HR-6), document notes (HR-9), inventory crop year persistence (HR-11)"
```

---

### Task 9: Fix Medium Bugs — Hardcoded Years + Query Strings (HR-12, HR-18)

**Files:**
- Modify: `holmes-risk/js/pages/grain.js`
- Modify: `holmes-risk/js/pages/positions.js`
- Modify: `holmes-risk/js/pages/deliveries.js`
- Modify: `holmes-risk/js/pages/inventory.js`
- Modify: `holmes-risk/js/pages/pnl.js`
- Modify: `holmes-risk/js/pages/settings.js`
- Modify: `holmes-risk/js/pages/inputs.js`
- Modify: `holmes-risk/js/pages/price-log.js`

- [ ] **Step 1: Replace all hardcoded year arrays with SEASON.available**

In every page file, find `var years = ['2024', '2025', '2026', '2027']` and replace with:

```javascript
var years = SEASON.available;
```

Files to update: `grain.js`, `positions.js`, `deliveries.js`, `inventory.js`, `pnl.js`, `settings.js`, `inputs.js`, `price-log.js`.

- [ ] **Step 2: Fix dashboard auto-refresh (HR-18)**

In `dashboard.js`, extract the auto-refresh setup from `renderDashboardPage()` into a standalone start/stop pair. This file will be removed in Phase 2, but fix it now so it works until then:

```javascript
var _dashboardRefreshActive = false;

function _dashboardStartAutoRefresh() {
  if (_dashboardRefreshActive) return; // already running
  _dashboardRefreshActive = true;
  _dashboardRefreshTimer = setInterval(function() { /* ... */ }, 300000);
}

function _dashboardStopAutoRefresh() {
  _dashboardRefreshActive = false;
  clearInterval(_dashboardRefreshTimer);
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/adam/projects/holmes-risk
git add js/pages/grain.js js/pages/positions.js js/pages/deliveries.js js/pages/inventory.js js/pages/pnl.js js/pages/settings.js js/pages/inputs.js js/pages/price-log.js js/pages/dashboard.js
git commit -m "Replace hardcoded year arrays with SEASON.available (HR-12), fix dashboard refresh (HR-18)"
```

---

### Task 10: Production Base Utility

**Files:**
- Create: `holmes-risk/js/production.js`
- Modify: `holmes-risk/build.js`

- [ ] **Step 1: Create unified production base module**

```javascript
/* production.js — unified production base calculation
 *
 * Single source of truth for "how many bushels do we expect?"
 * Pulls from field_season data (via risk-aggregate API), eliminates
 * the manual gross bushel entry in settings.
 *
 * Falls back to manually-entered grossBushels in settings if
 * field_season data is not available for a commodity.
 */

function productionBase(commodity, season) {
  season = season || STATE.activeCropYear || SEASON.current;

  // Primary: field_season aggregation
  if (STATE.productionData && STATE.productionData.length) {
    var match = STATE.productionData.find(function(r) {
      return r.commodity === commodity;
    });
    if (match && parseFloat(match.total_bushels) > 0) {
      return parseFloat(match.total_bushels);
    }
  }

  // Fallback: manual settings entry (for commodities not in field_season, like Heating Oil)
  var key = 'grossBushels:' + commodity + ':' + season;
  var manual = STATE.settings[key];
  if (manual) return parseFloat(manual) || 0;

  return 0;
}

function productionAcres(commodity, season) {
  if (STATE.productionData && STATE.productionData.length) {
    var match = STATE.productionData.find(function(r) {
      return r.commodity === commodity;
    });
    if (match) return parseFloat(match.total_acres) || 0;
  }
  return 0;
}

function productionYield(commodity, season) {
  if (STATE.productionData && STATE.productionData.length) {
    var match = STATE.productionData.find(function(r) {
      return r.commodity === commodity;
    });
    if (match) return parseFloat(match.avg_yield) || 0;
  }
  return 0;
}
```

- [ ] **Step 2: Add to build.js JS_FILES**

Insert `'js/production.js'` after `'js/risk-calc.js'` in the JS_FILES array (position 11, before charts.js):

```javascript
  'js/risk-calc.js',
  'js/production.js',    // NEW
  'js/charts.js',
```

- [ ] **Step 3: Commit**

```bash
cd /home/adam/projects/holmes-risk
git add js/production.js build.js
git commit -m "Add unified productionBase() utility — single source of truth for expected bushels"
```

---

### Task 11: Update Data Loading in init.js

**Files:**
- Modify: `holmes-risk/js/init.js`

- [ ] **Step 1: Add new data fetches to init sequence**

In the `initApp()` function, add the new data fetches to the parallel load. Find the existing `Promise.all` (or equivalent parallel fetch block) and add:

```javascript
  // Load all data in parallel
  var results = await Promise.all([
    fetchRiskContractsDB(cy),
    fetchRiskPositionsDB(cy),
    fetchRiskDeliveriesDB(cy),
    fetchRiskDocumentsDB(),
    fetchCropInventoryDB(cy),
    fetchBinInventoryDB(cy),
    fetchFertPositionsDB(cy),
    fetchRiskSettingsDB(),
    fetchPriceLogDB(),
    fetchMarketQuotesDB(),
    // New — redesign data
    fetchBudgetDB(cy),
    fetchExpensesDB(cy),
    fetchPriceTargetsDB(cy),
    fetchOtherIncomeDB(cy),
    fetchFreightRatesDB(),
    fetchProductionBaseDB(cy),
    fetchCostSummaryDB(cy),
    fetchHarvestSummaryDB(cy),
    fetchBuyersDB()
  ]);

  // Assign to STATE (add new assignments after existing ones)
  STATE.budget = results[10] || [];
  STATE.expenses = results[11] || [];
  STATE.priceTargets = results[12] || [];
  STATE.otherIncome = results[13] || [];
  STATE.freightRates = results[14] || [];
  STATE.productionData = results[15] || [];
  STATE.costSummary = results[16] || null;
  STATE.harvestSummary = results[17] || [];
  STATE.buyers = results[18] || [];
```

- [ ] **Step 2: Commit**

```bash
cd /home/adam/projects/holmes-risk
git add js/init.js
git commit -m "Load budget, expenses, targets, freight, production data on app init"
```

---

## Phase 1 Complete Checkpoint

At this point:
- 5 new database tables exist and are migrated
- 5 new CRUD API routes + 4 aggregation routes are live
- Frontend has API functions for all new endpoints
- STATE loads all new data on init
- `productionBase()` provides a single source of truth for expected bushels
- Dynamic year generation via `SEASON.available`
- 13 of 18 bugs fixed (HR-2, HR-5, HR-6, HR-7, HR-8, HR-9, HR-10, HR-11, HR-12, HR-13, HR-15, HR-16, HR-18)
- Remaining bugs (HR-1 encryption, HR-3 atomic split, HR-4 dashboard, HR-14 roll, HR-17 charts stub) are addressed in later phases

**Commit and push.** Verify on server that migration ran and API routes respond.

---

## Phase 2: Marketing Redesign (Task-Level)

> Detailed plan to be written before execution.

### Task 12: Create sidebar component (`js/sidebar.js`)
- Render persistent left sidebar with per-commodity position summary
- Hedge % progress bars, bushel counts, net delta
- Price strip with current futures + change
- Color coding by hedge level
- Responsive: collapses to bottom strip on mobile

### Task 13: Restructure navigation to 4 tabs
- Update `ui.js` TAB_CONFIG: marketing, charts, pnl, settings
- Update `pages.js` router — marketing is default
- Remove dashboard.js from build.js JS_FILES
- Update `renderApp()` to include sidebar on marketing + charts pages

### Task 14: Rebuild Marketing page with sidebar integration
- Marketing page renders sidebar + workspace
- Sub-tab bar: Contracts, Positions, Deliveries, Basis, Sell-the-Curve
- Integrate `productionBase()` for all bushel calculations
- Replace `_getGrossBushels()` calls in `risk-calc.js` with `productionBase()`

### Task 15: Update exposure calculation to use productionBase()
- Modify `calcExposure()` in `risk-calc.js` to call `productionBase()` instead of reading settings
- Single consistent hedge % everywhere (fixes equivalent of GT-14)

---

## Phase 3: P&L + Budget (Task-Level)

> Detailed plan to be written before execution.

### Task 16: Rewrite pnl.js — sub-tab structure
- 6 sub-tabs: Breakeven, Expenses, Summary, Cash Flow, Scorecard, Banker Report
- Sub-tab routing within the P&L page

### Task 17: Breakeven sub-tab
- Per-commodity breakeven calculation
- Direct crop COGS from `costSummary` (seed, fert, chemical)
- Shared overhead from `farm_expense` allocated by acreage
- Cash BE (minus depreciation) vs Tax BE
- Display: table with commodity, acres, yield, COGS/ac, overhead/ac, total/bu, breakeven

### Task 18: Expenses sub-tab
- Budgeted vs actual table per category
- Auto-filled rows from cost summary (seed, fert, chemical)
- Manual rows for remaining categories
- CRUD against `risk_farm_expense` table
- Variance column (actual - budgeted) with color coding

### Task 19: Summary sub-tab
- Revenue by commodity: priced bushels × effective price + unpriced × market
- Total expenses from expenses sub-tab
- Net income = revenue - expenses
- Cash income = net income + depreciation

### Task 20: Cash Flow sub-tab
- Monthly bar chart from contract delivery dates
- Filter out Cancelled and Split status contracts
- Chart.js horizontal bar chart (no new library needed — Chart.js already in scope for Phase 5)

### Task 21: Scorecard sub-tab
- Per commodity: avg price sold, annual avg market, budget target
- Performance delta and color coding
- Data from delivered contracts + market_ohlcv + farm_budget

### Task 22: Banker Report sub-tab
- Print-optimized layout (CSS @media print)
- Operation overview, financial summary, marketing summary
- "Print Report" button → window.print()

### Task 23: Settings page — budget + expense entry
- Budget section: per commodity per season form (pre-filled from field_season)
- Freight rates section: per elevator per commodity grid
- Price targets section: CRUD list
- Other income section: per category per season

---

## Phase 4: Sell-the-Curve (Task-Level)

> Detailed plan to be written before execution.

### Task 24: Create sell-the-curve.js
- New sub-tab on Marketing page
- Panel 1: Crop year × commodity matrix showing available bushels, breakeven, current market
- Panel 2: Elevator net-to-farm comparison grid (posted price - freight)
- Panel 3: Pre-filled contract form with one-click save to risk_contract

### Task 25: Add to build.js and marketing sub-tab router

---

## Phase 5: Charts (Task-Level)

> Detailed plan to be written before execution.

### Task 26: Choose and integrate charting library
- Evaluate lightweight-charts (TradingView OSS) vs Chart.js financial plugin
- Add to index.html as CDN script tag (no npm deps — matches project pattern)
- Verify candlestick rendering with sample data

### Task 27: Rewrite charts.js — main chart view
- Commodity selector toolbar
- Chart type toggle (Candlestick, Forward Curve, Basis)
- Timeframe selector (1W, 1M, 3M, 6M, 1Y)
- Fetch OHLCV data from market_ohlcv and render candlesticks

### Task 28: Add position overlays to charts
- Horizontal lines for contract prices (from risk_contract)
- Horizontal lines for price targets (from risk_price_target)
- Horizontal line for breakeven (from P&L calculation)
- Toggle controls for each overlay type

### Task 29: Build info panel (right side)
- OHLCV data display for selected candle/date
- Position summary for selected commodity (hedge %, avg price, breakeven, open bushels)
- Active price targets list
- Responsive: collapses below chart on mobile

### Task 30: Forward curve + basis chart types
- Forward curve: term structure from market forward curve data
- Basis chart: historical basis trend from price log / basis data

---

## Execution Order

```
Phase 1 (Foundation) → commit + push + verify
  ├── Phase 2 (Marketing Redesign) → commit + push
  │     ├── Phase 4 (Sell-the-Curve) → commit + push
  │     └── Phase 5 (Charts) → commit + push
  └── Phase 3 (P&L + Budget) → commit + push
```

Phases 2 and 3 can run in parallel after Phase 1. Phase 4 needs Phase 2. Phase 5 needs Phase 2.
