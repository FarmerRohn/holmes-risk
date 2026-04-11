// ==================== HOLMES RISK — P&L PAGE ====================

var _pnlSubTab = 'summary';

function _pnlRenderSubTabBar() {
  var tabs = [
    { id: 'summary',    label: 'Summary' },
    { id: 'breakeven',  label: 'Breakeven' },
    { id: 'expenses',   label: 'Expenses' },
    { id: 'cashflow',   label: 'Cash Flow' },
    { id: 'scorecard',  label: 'Scorecard' },
    { id: 'banker',     label: 'Banker Report' }
  ];
  var html = '<div class="grain-subtab-bar">';
  for (var i = 0; i < tabs.length; i++) {
    var active = _pnlSubTab === tabs[i].id ? ' grain-subtab-active' : '';
    html += '<button class="grain-subtab' + active + '" onclick="pnlSwitchSubTab(\'' + tabs[i].id + '\')">' + esc(tabs[i].label) + '</button>';
  }
  html += '</div>';
  return html;
}

function pnlSwitchSubTab(tab) {
  _pnlSubTab = tab;
  renderApp();
}

function renderPnlPage() {
  var cropYear = STATE.activeCropYear || STATE.settings.activeCropYear || SEASON.current;
  var contracts = _pnlFilterByCropYear(STATE.contracts || [], cropYear);
  var allPositions = _pnlFilterPositionsByCropYear(STATE.positions || [], cropYear);
  // Exclude Split-status positions — their value lives in the child positions
  var positions = [];
  for (var si = 0; si < allPositions.length; si++) {
    if (allPositions[si].status !== 'Split') positions.push(allPositions[si]);
  }
  var settings = STATE.settings || {};
  var marketPrices = STATE.marketPrices || [];

  var content = '';
  switch (_pnlSubTab) {
    case 'breakeven':  content = _pnlRenderBreakeven(cropYear); break;
    case 'expenses':   content = _pnlRenderExpenses(cropYear); break;
    case 'cashflow':   content = _pnlRenderCashFlow(contracts, cropYear); break;
    case 'scorecard':  content = _pnlRenderScorecard(contracts, cropYear, marketPrices); break;
    case 'banker':     content = _pnlRenderBankerReport(contracts, positions, cropYear, settings, marketPrices); break;
    default:           content = _pnlRenderSummary(contracts, positions, settings, marketPrices); break;
  }

  return '<div class="page-content">' +
    _pnlRenderCropYearFilter(cropYear) +
    _pnlRenderSubTabBar() +
    content +
  '</div>';
}

function _pnlRenderSummary(contracts, positions, settings, marketPrices) {
  var pl = calcPL(contracts, positions, settings, marketPrices);

  return _pnlRenderSummaryCards(pl) +
    '<div class="pnl-section-label">Per-Commodity Breakdown</div>' +
    _pnlRenderCommodityTable(contracts, positions, settings, marketPrices) +
    '<div class="pnl-section-label">Contract P&amp;L Detail</div>' +
    _pnlRenderContractDetail(contracts, settings, marketPrices) +
    '<div class="pnl-section-label">Position P&amp;L Detail</div>' +
    _pnlRenderPositionDetail(positions);
}

// ---- Breakeven Sub-Tab ----

function _pnlRenderBreakeven(cy) {
  var commodities = DEFAULT_COMMODITIES.filter(function(c) { return c !== 'Heating Oil'; });
  var costSummary = STATE.costSummary || { seed: { total: 0 }, fert: { total: 0 }, chemical: { total: 0 } };
  var expenses = STATE.expenses || [];
  var seasonExpenses = expenses.filter(function(e) { return String(e.season) === String(cy); });

  // Total farm acres and per-commodity acres
  var totalAcres = 0;
  var commData = {};
  for (var i = 0; i < commodities.length; i++) {
    var c = commodities[i];
    var acres = productionAcres(c, cy);
    var bu = productionBase(c, cy);
    var yld = productionYield(c, cy);
    totalAcres += acres;
    commData[c] = { acres: acres, bushels: bu, yield: yld };
  }

  // Direct crop costs from cost summary (per-commodity where available)
  var seedByCrop = {};
  if (costSummary.seed && costSummary.seed.byCommodity) {
    for (var s = 0; s < costSummary.seed.byCommodity.length; s++) {
      var row = costSummary.seed.byCommodity[s];
      seedByCrop[row.commodity] = parseFloat(row.total_cost) || 0;
    }
  }

  // Shared overhead from farm_expense (allocated by acreage)
  var sharedOverhead = 0;
  var depreciation = 0;
  for (var e = 0; e < seasonExpenses.length; e++) {
    var exp = seasonExpenses[e];
    var amt = parseFloat(exp.actual) || parseFloat(exp.budgeted) || 0;
    var cat = (exp.category || '').toLowerCase();
    if (cat.indexOf('depreciation') >= 0) {
      depreciation += amt;
    }
    sharedOverhead += amt;
  }

  // Build table
  var html = '<div class="pnl-section-label">Breakeven Analysis — ' + esc(cy) + '</div>';
  html += '<table class="grain-table"><thead><tr>';
  html += '<th>Commodity</th><th>Acres</th><th>Yield</th><th>Bushels</th>';
  html += '<th>Seed $/ac</th><th>Fert $/ac</th><th>Chem $/ac</th><th>Overhead $/ac</th>';
  html += '<th>Cash BE</th><th>Tax BE</th>';
  html += '</tr></thead><tbody>';

  for (var j = 0; j < commodities.length; j++) {
    var comm = commodities[j];
    var d = commData[comm];
    if (!d.acres || d.acres <= 0) continue;

    var acreShare = totalAcres > 0 ? d.acres / totalAcres : 0;
    var seedCost = seedByCrop[comm] || (costSummary.seed.total * acreShare);
    var fertCost = costSummary.fert.total * acreShare;
    var chemCost = costSummary.chemical.total * acreShare;
    var overheadAlloc = sharedOverhead * acreShare;
    var deprecAlloc = depreciation * acreShare;

    var seedPerAcre = d.acres > 0 ? seedCost / d.acres : 0;
    var fertPerAcre = d.acres > 0 ? fertCost / d.acres : 0;
    var chemPerAcre = d.acres > 0 ? chemCost / d.acres : 0;
    var overheadPerAcre = d.acres > 0 ? overheadAlloc / d.acres : 0;

    var totalCostPerAcre = seedPerAcre + fertPerAcre + chemPerAcre + overheadPerAcre;
    var taxBE = d.yield > 0 ? totalCostPerAcre / d.yield : 0;
    var cashBE = d.yield > 0 ? (totalCostPerAcre - (deprecAlloc / d.acres)) / d.yield : 0;

    html += '<tr>';
    html += '<td><span class="grain-commodity-dot" style="background:' + (COMMODITY_COLORS[comm] || '#888') + '"></span>' + esc(comm) + '</td>';
    html += '<td>' + d.acres.toLocaleString(undefined, {maximumFractionDigits: 0}) + '</td>';
    html += '<td>' + d.yield.toFixed(1) + '</td>';
    html += '<td>' + d.bushels.toLocaleString(undefined, {maximumFractionDigits: 0}) + '</td>';
    html += '<td>$' + seedPerAcre.toFixed(2) + '</td>';
    html += '<td>$' + fertPerAcre.toFixed(2) + '</td>';
    html += '<td>$' + chemPerAcre.toFixed(2) + '</td>';
    html += '<td>$' + overheadPerAcre.toFixed(2) + '</td>';
    html += '<td class="pnl-positive"><strong>$' + cashBE.toFixed(2) + '</strong></td>';
    html += '<td><strong>$' + taxBE.toFixed(2) + '</strong></td>';
    html += '</tr>';
  }

  html += '</tbody></table>';
  html += '<div style="margin-top:12px;font-size:12px;color:var(--text3);">';
  html += 'Cash BE excludes depreciation. Tax BE includes all expenses. ';
  html += 'Direct costs (seed) are per-commodity where available; shared costs allocated by acreage.';
  html += '</div>';
  return html;
}

// ---- Expenses Sub-Tab ----

function _pnlRenderExpenses(cy) {
  var costSummary = STATE.costSummary || { seed: { total: 0 }, fert: { total: 0 }, chemical: { total: 0 } };
  var expenses = STATE.expenses || [];
  var seasonExpenses = expenses.filter(function(e) { return String(e.season) === String(cy); });

  // Build category map: merge auto-filled + manual
  var categories = [
    { name: 'Seed', auto: costSummary.seed.total, key: 'seed' },
    { name: 'Fertilizer', auto: costSummary.fert.total, key: 'fert' },
    { name: 'Chemical', auto: costSummary.chemical.total, key: 'chemical' },
    { name: 'Land Rent', auto: 0, key: 'land_rent' },
    { name: 'Labor', auto: 0, key: 'labor' },
    { name: 'Insurance', auto: 0, key: 'insurance' },
    { name: 'Repairs', auto: 0, key: 'repairs' },
    { name: 'Fuel', auto: 0, key: 'fuel' },
    { name: 'Drying', auto: 0, key: 'drying' },
    { name: 'Depreciation', auto: 0, key: 'depreciation' },
    { name: 'Interest', auto: 0, key: 'interest' },
    { name: 'Other', auto: 0, key: 'other' }
  ];

  // Merge in saved expense data
  for (var i = 0; i < categories.length; i++) {
    var cat = categories[i];
    var saved = seasonExpenses.find(function(e) { return e.category === cat.key; });
    cat.budgeted = saved ? (parseFloat(saved.budgeted) || 0) : cat.auto;
    cat.actual = saved ? (parseFloat(saved.actual) || 0) : cat.auto;
    cat.id = saved ? saved.id : null;
    cat.autoFilled = cat.auto > 0;
  }

  var html = '<div class="pnl-section-label">Expenses — ' + esc(cy) + '</div>';
  html += '<table class="grain-table"><thead><tr>';
  html += '<th>Category</th><th>Budgeted</th><th>Actual</th><th>Variance</th>';
  html += '</tr></thead><tbody>';

  var totalBudgeted = 0, totalActual = 0;
  for (var j = 0; j < categories.length; j++) {
    var c = categories[j];
    var variance = c.actual - c.budgeted;
    var varClass = variance > 0 ? 'pnl-negative' : (variance < 0 ? 'pnl-positive' : '');
    totalBudgeted += c.budgeted;
    totalActual += c.actual;

    html += '<tr>';
    html += '<td>' + esc(c.name);
    if (c.autoFilled) html += ' <span style="font-size:10px;color:var(--text3);" title="Auto-filled from PO/contract data">&#9679;</span>';
    html += '</td>';
    html += '<td>$' + c.budgeted.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '</td>';
    html += '<td>$' + c.actual.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '</td>';
    html += '<td class="' + varClass + '">$' + Math.abs(variance).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    if (variance !== 0) html += variance > 0 ? ' over' : ' under';
    html += '</td>';
    html += '</tr>';
  }

  var totalVar = totalActual - totalBudgeted;
  var totalVarClass = totalVar > 0 ? 'pnl-negative' : (totalVar < 0 ? 'pnl-positive' : '');
  html += '<tr style="font-weight:700;border-top:2px solid var(--border);">';
  html += '<td>Total</td>';
  html += '<td>$' + totalBudgeted.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '</td>';
  html += '<td>$' + totalActual.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) + '</td>';
  html += '<td class="' + totalVarClass + '">$' + Math.abs(totalVar).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
  if (totalVar !== 0) html += totalVar > 0 ? ' over' : ' under';
  html += '</td>';
  html += '</tr></tbody></table>';

  html += '<div style="margin-top:12px;font-size:12px;color:var(--text3);">';
  html += '&#9679; = Auto-filled from purchase orders, fertilizer contracts, and seed inventory. Edit in Settings &rarr; Expenses.';
  html += '</div>';
  return html;
}

// ---- Cash Flow Sub-Tab ----

function _pnlRenderCashFlow(contracts, cy) {
  // Group revenue by delivery month
  var months = {};
  for (var i = 0; i < contracts.length; i++) {
    var c = contracts[i];
    if (c.status === 'Cancelled' || c.status === 'Split') continue;
    var date = c.deliveryDate || c.deliveryDateEnd;
    if (!date) continue;

    var m = date.substring(0, 7); // YYYY-MM
    var ep = calcEffectivePrice(c, getLatestFuturesPrice(c.commodity, STATE.marketPrices));
    var revenue = (ep || 0) * (parseFloat(c.bushels) || 0);
    if (!months[m]) months[m] = { revenue: 0, bushels: 0, contracts: 0 };
    months[m].revenue += revenue;
    months[m].bushels += parseFloat(c.bushels) || 0;
    months[m].contracts++;
  }

  var sortedMonths = Object.keys(months).sort();
  if (sortedMonths.length === 0) {
    return '<div class="pnl-section-label">Cash Flow — ' + esc(cy) + '</div>' +
      '<div class="pnl-empty">No contracts with delivery dates found.</div>';
  }

  var maxRevenue = 0;
  for (var k = 0; k < sortedMonths.length; k++) {
    if (months[sortedMonths[k]].revenue > maxRevenue) maxRevenue = months[sortedMonths[k]].revenue;
  }

  var html = '<div class="pnl-section-label">Cash Flow Projection — ' + esc(cy) + '</div>';
  html += '<div class="pnl-cashflow-chart">';

  for (var j = 0; j < sortedMonths.length; j++) {
    var mo = sortedMonths[j];
    var d = months[mo];
    var pct = maxRevenue > 0 ? (d.revenue / maxRevenue * 100) : 0;
    var label = new Date(mo + '-15').toLocaleDateString(undefined, { month: 'short', year: '2-digit' });

    html += '<div class="pnl-cashflow-bar-row">';
    html += '<div class="pnl-cashflow-label">' + label + '</div>';
    html += '<div class="pnl-cashflow-bar-track">';
    html += '<div class="pnl-cashflow-bar-fill" style="width:' + pct + '%;"></div>';
    html += '</div>';
    html += '<div class="pnl-cashflow-value">$' + (d.revenue / 1000).toFixed(0) + 'K</div>';
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// ---- Scorecard Sub-Tab ----

function _pnlRenderScorecard(contracts, cy, marketPrices) {
  var commodities = DEFAULT_COMMODITIES.filter(function(c) { return c !== 'Heating Oil'; });
  var budget = STATE.budget || [];

  var html = '<div class="pnl-section-label">Marketing Scorecard — ' + esc(cy) + '</div>';
  html += '<table class="grain-table"><thead><tr>';
  html += '<th>Commodity</th><th>Avg Sold</th><th>Budget Target</th><th>vs Target</th><th>Bushels Sold</th>';
  html += '</tr></thead><tbody>';

  for (var i = 0; i < commodities.length; i++) {
    var comm = commodities[i];
    var delivered = contracts.filter(function(c) {
      return c.commodity === comm && c.status === 'Delivered';
    });

    // Weighted average price sold
    var totalRevenue = 0, totalBu = 0;
    for (var j = 0; j < delivered.length; j++) {
      var ep = calcEffectivePrice(delivered[j], getLatestFuturesPrice(comm, marketPrices));
      var bu = parseFloat(delivered[j].bushels) || 0;
      if (ep) { totalRevenue += ep * bu; totalBu += bu; }
    }
    var avgSold = totalBu > 0 ? totalRevenue / totalBu : 0;

    // Budget target
    var budgetRow = budget.find(function(b) { return b.commodity === comm && String(b.season) === String(cy); });
    var target = budgetRow ? parseFloat(budgetRow.targetPrice) || 0 : 0;

    var delta = avgSold - target;
    var deltaClass = delta >= 0 ? 'pnl-positive' : 'pnl-negative';

    html += '<tr>';
    html += '<td><span class="grain-commodity-dot" style="background:' + (COMMODITY_COLORS[comm] || '#888') + '"></span>' + esc(comm) + '</td>';
    html += '<td>' + (avgSold > 0 ? '$' + avgSold.toFixed(2) : '\u2014') + '</td>';
    html += '<td>' + (target > 0 ? '$' + target.toFixed(2) : '\u2014') + '</td>';
    html += '<td class="' + (avgSold > 0 && target > 0 ? deltaClass : '') + '">';
    if (avgSold > 0 && target > 0) {
      html += (delta >= 0 ? '+' : '') + '$' + delta.toFixed(2);
    } else {
      html += '\u2014';
    }
    html += '</td>';
    html += '<td>' + totalBu.toLocaleString() + '</td>';
    html += '</tr>';
  }

  html += '</tbody></table>';
  return html;
}

// ---- Banker Report Sub-Tab ----

function _pnlRenderBankerReport(contracts, positions, cy, settings, marketPrices) {
  var commodities = DEFAULT_COMMODITIES.filter(function(c) { return c !== 'Heating Oil'; });
  var budget = STATE.budget || [];
  var expenses = STATE.expenses || [];
  var seasonExpenses = expenses.filter(function(e) { return String(e.season) === String(cy); });

  // Total expenses
  var totalExpenses = 0;
  for (var e = 0; e < seasonExpenses.length; e++) {
    totalExpenses += parseFloat(seasonExpenses[e].actual) || parseFloat(seasonExpenses[e].budgeted) || 0;
  }

  var html = '<div class="banker-report">';
  html += '<div class="banker-header">';
  html += '<h2>Holmes Farms GP — Grain Marketing Report</h2>';
  html += '<p>Crop Year: ' + esc(cy) + ' &middot; Generated: ' + new Date().toLocaleDateString() + '</p>';
  html += '</div>';

  // Operation Overview
  html += '<div class="banker-section">';
  html += '<h3>Operation Overview</h3>';
  html += '<table class="grain-table"><thead><tr>';
  html += '<th>Commodity</th><th>Acres</th><th>Yield (bu/ac)</th><th>Projected Bushels</th>';
  html += '</tr></thead><tbody>';

  var totalAcres = 0, totalBu = 0;
  for (var i = 0; i < commodities.length; i++) {
    var c = commodities[i];
    var acres = productionAcres(c, cy);
    var yld = productionYield(c, cy);
    var bu = productionBase(c, cy);
    totalAcres += acres;
    totalBu += bu;

    html += '<tr>';
    html += '<td>' + esc(c) + '</td>';
    html += '<td>' + acres.toLocaleString(undefined, {maximumFractionDigits: 0}) + '</td>';
    html += '<td>' + yld.toFixed(1) + '</td>';
    html += '<td>' + bu.toLocaleString(undefined, {maximumFractionDigits: 0}) + '</td>';
    html += '</tr>';
  }
  html += '<tr style="font-weight:700;"><td>Total</td><td>' + totalAcres.toLocaleString(undefined, {maximumFractionDigits: 0}) + '</td><td></td><td>' + totalBu.toLocaleString(undefined, {maximumFractionDigits: 0}) + '</td></tr>';
  html += '</tbody></table></div>';

  // Marketing Summary
  html += '<div class="banker-section">';
  html += '<h3>Marketing Summary</h3>';
  html += '<table class="grain-table"><thead><tr>';
  html += '<th>Commodity</th><th>Bushels</th><th>% Priced</th><th>Avg Price</th><th>Target</th><th>Cash BE</th>';
  html += '</tr></thead><tbody>';

  var exposure = calcExposure(contracts, positions, settings, cy);

  for (var j = 0; j < commodities.length; j++) {
    var comm = commodities[j];
    var commExp = exposure.byCommodity[comm];
    if (!commExp) continue;

    var hedgePct = commExp.hedgePct || 0;
    var budgetRow = budget.find(function(b) { return b.commodity === comm && String(b.season) === String(cy); });
    var target = budgetRow ? parseFloat(budgetRow.targetPrice) || 0 : 0;

    // Simple avg price from delivered
    var delivered = contracts.filter(function(ct) { return ct.commodity === comm && ct.status === 'Delivered'; });
    var totRev = 0, totBuDel = 0;
    for (var k = 0; k < delivered.length; k++) {
      var ep = calcEffectivePrice(delivered[k], getLatestFuturesPrice(comm, marketPrices));
      var dbu = parseFloat(delivered[k].bushels) || 0;
      if (ep) { totRev += ep * dbu; totBuDel += dbu; }
    }
    var avgPrice = totBuDel > 0 ? totRev / totBuDel : 0;

    html += '<tr>';
    html += '<td>' + esc(comm) + '</td>';
    html += '<td>' + commExp.grossBushels.toLocaleString(undefined, {maximumFractionDigits: 0}) + '</td>';
    html += '<td>' + hedgePct.toFixed(0) + '%</td>';
    html += '<td>' + (avgPrice > 0 ? '$' + avgPrice.toFixed(2) : '\u2014') + '</td>';
    html += '<td>' + (target > 0 ? '$' + target.toFixed(2) : '\u2014') + '</td>';
    html += '<td>\u2014</td>'; // Cash BE calculated in breakeven tab
    html += '</tr>';
  }
  html += '</tbody></table></div>';

  // Print button
  html += '<div style="margin-top:20px;text-align:center;">';
  html += '<button class="btn btn-primary" onclick="window.print()">Print Report</button>';
  html += '</div>';
  html += '</div>';
  return html;
}

// ---- Crop year filter ----

function _pnlRenderCropYearFilter(cropYear) {
  var years = SEASON.available;
  var yearOpts = '';
  for (var i = 0; i < years.length; i++) {
    var sel = years[i] === cropYear ? ' selected' : '';
    yearOpts += '<option value="' + years[i] + '"' + sel + '>' + years[i] + '</option>';
  }

  return '<div class="grain-toolbar">' +
    '<div class="grain-toolbar-filters">' +
      '<select class="form-select grain-filter-select" onchange="pnlApplyCropYear(this.value)">' + yearOpts + '</select>' +
    '</div>' +
  '</div>';
}

function pnlApplyCropYear(value) {
  STATE.activeCropYear = value;
  upsertRiskSettingDB('activeCropYear', value)
    .then(function() { STATE.settings.activeCropYear = value; })
    .catch(function() {});
  renderApp();
}

// ---- Filter helpers ----

function _pnlFilterByCropYear(contracts, cropYear) {
  var filtered = [];
  for (var i = 0; i < contracts.length; i++) {
    var c = contracts[i];
    if (c.cropYear && String(c.cropYear) !== String(cropYear)) continue;
    if (c.status === 'Cancelled' || c.status === 'Split') continue;
    filtered.push(c);
  }
  return filtered;
}

function _pnlFilterPositionsByCropYear(positions, cropYear) {
  var filtered = [];
  for (var i = 0; i < positions.length; i++) {
    var p = positions[i];
    if (p.cropYear && String(p.cropYear) !== String(cropYear)) continue;
    filtered.push(p);
  }
  return filtered;
}

// ---- Summary Cards ----

function _pnlRenderSummaryCards(pl) {
  return '<div class="pnl-summary-cards">' +
    _pnlCard('Realized P&L', pl.realized) +
    _pnlCard('Unrealized P&L', pl.unrealized) +
    '<div class="pnl-card pnl-card-total">' +
      '<div class="pnl-card-label">Total P&L</div>' +
      '<div class="pnl-card-value pnl-card-value-total ' + _pnlColorClass(pl.total) + '">' + _pnlFmtDollars(pl.total) + '</div>' +
    '</div>' +
  '</div>';
}

function _pnlCard(label, value) {
  return '<div class="pnl-card">' +
    '<div class="pnl-card-label">' + esc(label) + '</div>' +
    '<div class="pnl-card-value ' + _pnlColorClass(value) + '">' + _pnlFmtDollars(value) + '</div>' +
  '</div>';
}

// ---- Per-Commodity Breakdown Table ----

function _pnlRenderCommodityTable(contracts, positions, settings, marketPrices) {
  // Collect unique commodities
  var commodityMap = {};
  var i;
  for (i = 0; i < contracts.length; i++) {
    if (contracts[i].commodity) commodityMap[contracts[i].commodity] = true;
  }
  for (i = 0; i < positions.length; i++) {
    if (positions[i].commodity) commodityMap[positions[i].commodity] = true;
  }

  var commodities = Object.keys(commodityMap).sort();
  if (commodities.length === 0) {
    return '<div class="pnl-empty">No contracts or positions for this crop year</div>';
  }

  var html = '<div class="card"><div class="table-wrap"><table>' +
    '<thead><tr>' +
      '<th>Commodity</th>' +
      '<th style="text-align:right">Contract Realized</th>' +
      '<th style="text-align:right">Contract Unrealized</th>' +
      '<th style="text-align:right">Position Realized</th>' +
      '<th style="text-align:right">Position Unrealized</th>' +
      '<th style="text-align:right">Net P&L</th>' +
    '</tr></thead>' +
    '<tbody>';

  var grandContractRealized = 0, grandContractUnrealized = 0;
  var grandPositionRealized = 0, grandPositionUnrealized = 0;

  for (i = 0; i < commodities.length; i++) {
    var comm = commodities[i];
    var color = COMMODITY_COLORS[comm] || 'var(--text)';

    // Filter contracts for this commodity
    var commContracts = [];
    for (var ci = 0; ci < contracts.length; ci++) {
      if (contracts[ci].commodity === comm) commContracts.push(contracts[ci]);
    }

    // Filter positions for this commodity
    var commPositions = [];
    for (var pi = 0; pi < positions.length; pi++) {
      if (positions[pi].commodity === comm) commPositions.push(positions[pi]);
    }

    // Calculate per-category P&L
    var contractRealized = _pnlCalcContractRealized(commContracts, settings, marketPrices);
    var contractUnrealized = _pnlCalcContractUnrealized(commContracts, settings, marketPrices);
    var positionRealized = _pnlCalcPositionRealized(commPositions);
    var positionUnrealized = _pnlCalcPositionUnrealized(commPositions);
    var netPl = contractRealized + contractUnrealized + positionRealized + positionUnrealized;

    grandContractRealized += contractRealized;
    grandContractUnrealized += contractUnrealized;
    grandPositionRealized += positionRealized;
    grandPositionUnrealized += positionUnrealized;

    html += '<tr>' +
      '<td><span class="grain-commodity-dot" style="background:' + color + '"></span>' + esc(comm) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)" class="' + _pnlColorClass(contractRealized) + '">' + _pnlFmtDollars(contractRealized) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)" class="' + _pnlColorClass(contractUnrealized) + '">' + _pnlFmtDollars(contractUnrealized) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)" class="' + _pnlColorClass(positionRealized) + '">' + _pnlFmtDollars(positionRealized) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)" class="' + _pnlColorClass(positionUnrealized) + '">' + _pnlFmtDollars(positionUnrealized) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono);font-weight:700" class="' + _pnlColorClass(netPl) + '">' + _pnlFmtDollars(netPl) + '</td>' +
    '</tr>';
  }

  // Totals row
  var grandNet = grandContractRealized + grandContractUnrealized + grandPositionRealized + grandPositionUnrealized;
  html += '<tr style="border-top:2px solid var(--border);font-weight:700">' +
    '<td>Total</td>' +
    '<td style="text-align:right;font-family:var(--mono)" class="' + _pnlColorClass(grandContractRealized) + '">' + _pnlFmtDollars(grandContractRealized) + '</td>' +
    '<td style="text-align:right;font-family:var(--mono)" class="' + _pnlColorClass(grandContractUnrealized) + '">' + _pnlFmtDollars(grandContractUnrealized) + '</td>' +
    '<td style="text-align:right;font-family:var(--mono)" class="' + _pnlColorClass(grandPositionRealized) + '">' + _pnlFmtDollars(grandPositionRealized) + '</td>' +
    '<td style="text-align:right;font-family:var(--mono)" class="' + _pnlColorClass(grandPositionUnrealized) + '">' + _pnlFmtDollars(grandPositionUnrealized) + '</td>' +
    '<td style="text-align:right;font-family:var(--mono)" class="' + _pnlColorClass(grandNet) + '">' + _pnlFmtDollars(grandNet) + '</td>' +
  '</tr>';

  html += '</tbody></table></div></div>';
  return html;
}

// ---- Contract P&L Detail ----

function _pnlRenderContractDetail(contracts, settings, marketPrices) {
  // Only show contracts with a calculable effective price
  var rows = [];
  for (var i = 0; i < contracts.length; i++) {
    var c = contracts[i];
    var latestQuote = getLatestFuturesPrice(c.commodity || '', marketPrices);
    var ep = calcEffectivePrice(c, latestQuote);
    if (ep === null) continue;

    var commodity = c.commodity || '';
    var costBasis = _pnlGetCostBasis(commodity, settings);
    var bu = c.bushels != null ? parseFloat(c.bushels) : 0;
    var plPerBu = ep - costBasis;
    var totalPl = plPerBu * bu;

    rows.push({
      commodity: commodity,
      contractType: c.contractType || '',
      bushels: bu,
      effectivePrice: ep,
      costBasis: costBasis,
      plPerBu: plPerBu,
      totalPl: totalPl,
      status: c.status || '',
      buyerName: c.buyerName || ''
    });
  }

  if (rows.length === 0) {
    return '<div class="pnl-empty">No contracts with calculable P&amp;L</div>';
  }

  var html = '<div class="card"><div class="table-wrap"><table>' +
    '<thead><tr>' +
      '<th>Commodity</th>' +
      '<th>Type</th>' +
      '<th>Buyer</th>' +
      '<th style="text-align:right">Bushels</th>' +
      '<th style="text-align:right">Eff. Price</th>' +
      '<th style="text-align:right">Cost Basis</th>' +
      '<th style="text-align:right">P&L/bu</th>' +
      '<th style="text-align:right">Total P&L</th>' +
      '<th>Status</th>' +
    '</tr></thead>' +
    '<tbody>';

  for (var j = 0; j < rows.length; j++) {
    var r = rows[j];
    var color = COMMODITY_COLORS[r.commodity] || 'var(--text)';
    var statusCls = _pnlContractStatusClass(r.status);

    html += '<tr>' +
      '<td><span class="grain-commodity-dot" style="background:' + color + '"></span>' + esc(r.commodity) + '</td>' +
      '<td>' + esc(r.contractType) + '</td>' +
      '<td>' + esc(r.buyerName) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtBushels(r.bushels) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(r.effectivePrice) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(r.costBasis) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)" class="' + _pnlColorClass(r.plPerBu) + '">' + _pnlFmtDollarsDecimal(r.plPerBu) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono);font-weight:600" class="' + _pnlColorClass(r.totalPl) + '">' + _pnlFmtDollars(r.totalPl) + '</td>' +
      '<td><span class="grain-status ' + statusCls + '">' + esc(r.status) + '</span></td>' +
    '</tr>';
  }

  html += '</tbody></table></div></div>';
  return html;
}

// ---- Position P&L Detail ----

function _pnlRenderPositionDetail(positions) {
  // Show positions that have P&L data
  var rows = [];
  for (var i = 0; i < positions.length; i++) {
    var p = positions[i];
    var entryPrice = p.entryPrice != null ? parseFloat(p.entryPrice) : null;
    if (entryPrice === null) continue;

    var numContracts = p.contracts != null ? parseFloat(p.contracts) : 0;
    var bpc = p.bushelsPerContract != null ? parseFloat(p.bushelsPerContract) : 5000;
    var sideSign = p.positionSide === 'Short' ? -1 : 1;
    var pl = 0;
    var priceDisplay = null;

    if (p.status === 'Closed' && p.closedPrice != null) {
      var closedPrice = parseFloat(p.closedPrice);
      pl = (closedPrice - entryPrice) * numContracts * bpc * sideSign;
      priceDisplay = closedPrice;
    } else if (p.status !== 'Closed' && p.status !== 'Expired' && p.currentPrice != null) {
      var currentPrice = parseFloat(p.currentPrice);
      pl = (currentPrice - entryPrice) * numContracts * bpc * sideSign;
      priceDisplay = currentPrice;
    } else {
      continue;
    }

    rows.push({
      commodity: p.commodity || '',
      contractType: p.contractType || '',
      positionSide: p.positionSide || '',
      contracts: numContracts,
      entryPrice: entryPrice,
      priceDisplay: priceDisplay,
      pl: pl,
      status: p.status || ''
    });
  }

  if (rows.length === 0) {
    return '<div class="pnl-empty">No positions with calculable P&amp;L</div>';
  }

  var html = '<div class="card"><div class="table-wrap"><table>' +
    '<thead><tr>' +
      '<th>Commodity</th>' +
      '<th>Type</th>' +
      '<th>Side</th>' +
      '<th style="text-align:right">Contracts</th>' +
      '<th style="text-align:right">Entry</th>' +
      '<th style="text-align:right">Current/Closed</th>' +
      '<th style="text-align:right">P&L</th>' +
      '<th>Status</th>' +
    '</tr></thead>' +
    '<tbody>';

  for (var j = 0; j < rows.length; j++) {
    var r = rows[j];
    var color = COMMODITY_COLORS[r.commodity] || 'var(--text)';
    var sideCls = r.positionSide === 'Long' ? 'pos-side-long' : 'pos-side-short';
    var statusCls = _pnlPositionStatusClass(r.status);

    html += '<tr>' +
      '<td><span class="grain-commodity-dot" style="background:' + color + '"></span>' + esc(r.commodity) + '</td>' +
      '<td>' + esc(r.contractType) + '</td>' +
      '<td><span class="pos-side ' + sideCls + '">' + esc(r.positionSide) + '</span></td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + r.contracts + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(r.entryPrice) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(r.priceDisplay) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono);font-weight:600" class="' + _pnlColorClass(r.pl) + '">' + _pnlFmtDollars(r.pl) + '</td>' +
      '<td><span class="grain-status ' + statusCls + '">' + esc(r.status) + '</span></td>' +
    '</tr>';
  }

  html += '</tbody></table></div></div>';
  return html;
}

// ---- P&L calculation helpers (per-category) ----

function _pnlCalcContractRealized(contracts, settings, marketPrices) {
  var total = 0;
  for (var i = 0; i < contracts.length; i++) {
    var c = contracts[i];
    if (c.status !== 'Delivered') continue;
    var commodity = c.commodity || '';
    var costBasis = _pnlGetCostBasis(commodity, settings);
    var latestQuote = getLatestFuturesPrice(commodity, marketPrices);
    var ep = calcEffectivePrice(c, latestQuote);
    if (ep === null) continue;
    var bu = c.bushels != null ? parseFloat(c.bushels) : 0;
    total += (ep - costBasis) * bu;
  }
  return total;
}

function _pnlCalcContractUnrealized(contracts, settings, marketPrices) {
  var total = 0;
  for (var i = 0; i < contracts.length; i++) {
    var c = contracts[i];
    if (c.status !== 'Open') continue;
    var commodity = c.commodity || '';
    var costBasis = _pnlGetCostBasis(commodity, settings);
    var latestQuote = getLatestFuturesPrice(commodity, marketPrices);
    var ep = calcEffectivePrice(c, latestQuote);
    if (ep === null) continue;
    var bu = c.bushels != null ? parseFloat(c.bushels) : 0;
    total += (ep - costBasis) * bu;
  }
  return total;
}

function _pnlCalcPositionRealized(positions) {
  var total = 0;
  for (var i = 0; i < positions.length; i++) {
    var p = positions[i];
    if (p.status !== 'Closed' || p.closedPrice == null) continue;
    var closedPrice = parseFloat(p.closedPrice);
    var entryPrice = p.entryPrice != null ? parseFloat(p.entryPrice) : 0;
    var numContracts = p.contracts != null ? parseFloat(p.contracts) : 0;
    var bpc = p.bushelsPerContract != null ? parseFloat(p.bushelsPerContract) : 5000;
    var sideSign = p.positionSide === 'Short' ? -1 : 1;
    total += (closedPrice - entryPrice) * numContracts * bpc * sideSign;
  }
  return total;
}

function _pnlCalcPositionUnrealized(positions) {
  var total = 0;
  for (var i = 0; i < positions.length; i++) {
    var p = positions[i];
    if (p.status === 'Closed' || p.status === 'Expired') continue;
    if (p.currentPrice == null || p.entryPrice == null) continue;
    var currentPrice = parseFloat(p.currentPrice);
    var entryPrice = parseFloat(p.entryPrice);
    var numContracts = p.contracts != null ? parseFloat(p.contracts) : 0;
    var bpc = p.bushelsPerContract != null ? parseFloat(p.bushelsPerContract) : 5000;
    var sideSign = p.positionSide === 'Short' ? -1 : 1;
    total += (currentPrice - entryPrice) * numContracts * bpc * sideSign;
  }
  return total;
}

function _pnlGetCostBasis(commodity, settings) {
  var key = 'costBasis:' + commodity;
  var val = settings[key];
  if (val == null) return 0;
  var n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

// ---- Status class helpers ----

function _pnlContractStatusClass(status) {
  switch (status) {
    case 'Open': return 'grain-status-open';
    case 'Delivered': return 'grain-status-delivered';
    case 'Cancelled': return 'grain-status-cancelled';
    default: return '';
  }
}

function _pnlPositionStatusClass(status) {
  switch (status) {
    case 'Open': return 'grain-status-open';
    case 'Closed': return 'pos-status-closed';
    case 'Expired': return 'pos-status-expired';
    case 'Exercised': return 'pos-status-exercised';
    default: return '';
  }
}

// ---- Formatting helpers ----

function _pnlFmtDollars(n) {
  if (n == null || isNaN(n)) return '\u2014';
  n = Math.round(n);
  var abs = Math.abs(n);
  var str = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (n < 0) return '($' + str + ')';
  return '$' + str;
}

function _pnlFmtDollarsDecimal(n) {
  if (n == null || isNaN(n)) return '\u2014';
  var abs = Math.abs(n);
  var str = abs.toFixed(4);
  if (n < 0) return '($' + str + ')';
  return '$' + str;
}

function _pnlColorClass(n) {
  if (n > 0) return 'pnl-positive';
  if (n < 0) return 'pnl-negative';
  return '';
}
