// ==================== HOLMES RISK — P&L PAGE ====================

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

  var pl = calcPL(contracts, positions, settings, marketPrices);

  return '<div class="page-content">' +
    _pnlRenderCropYearFilter(cropYear) +
    _pnlRenderSummaryCards(pl) +
    '<div class="pnl-section-label">Per-Commodity Breakdown</div>' +
    _pnlRenderCommodityTable(contracts, positions, settings, marketPrices) +
    '<div class="pnl-section-label">Contract P&amp;L Detail</div>' +
    _pnlRenderContractDetail(contracts, settings, marketPrices) +
    '<div class="pnl-section-label">Position P&amp;L Detail</div>' +
    _pnlRenderPositionDetail(positions) +
  '</div>';
}

// ---- Crop year filter ----

function _pnlRenderCropYearFilter(cropYear) {
  var years = ['2024', '2025', '2026', '2027'];
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
