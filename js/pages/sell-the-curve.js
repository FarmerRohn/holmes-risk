/* sell-the-curve.js — elevator comparison + one-click contract creation */

var _stcSelectedCommodity = null;

// ---- Main renderer ----

function renderSellTheCurve() {
  var cy = STATE.activeCropYear || SEASON.current;
  var commodities = DEFAULT_COMMODITIES.filter(function(c) { return c !== 'Heating Oil'; });
  var settings = STATE.settings || {};
  var marketPrices = STATE.marketPrices || [];
  var contracts = STATE.contracts || [];
  var positions = STATE.positions || [];
  var exposure = calcExposure(contracts, positions, settings, cy);

  // Auto-select first commodity with unpriced bushels
  if (!_stcSelectedCommodity) {
    for (var i = 0; i < commodities.length; i++) {
      var exp = exposure.byCommodity[commodities[i]];
      if (exp && exp.grossBushels > exp.committed) {
        _stcSelectedCommodity = commodities[i];
        break;
      }
    }
    if (!_stcSelectedCommodity) _stcSelectedCommodity = commodities[0];
  }

  var html = '<div class="stc-panels">';
  html += _stcRenderOpportunityPanel(commodities, exposure, cy, marketPrices);
  html += _stcRenderElevatorPanel(_stcSelectedCommodity, marketPrices);
  html += _stcRenderContractForm(_stcSelectedCommodity, exposure, cy, marketPrices);
  html += '</div>';
  return html;
}

function stcSelectCommodity(commodity) {
  _stcSelectedCommodity = commodity;
  renderApp();
}

// ---- Panel 1: Opportunity Matrix ----

function _stcRenderOpportunityPanel(commodities, exposure, cy, marketPrices) {
  var html = '<div class="stc-panel">';
  html += '<div class="stc-panel-title">Opportunity Matrix</div>';

  // Calculate breakeven per commodity (simplified from P&L breakeven)
  var costSummary = STATE.costSummary || { seed: { total: 0 }, fert: { total: 0 }, chemical: { total: 0 } };
  var expenses = STATE.expenses || [];
  var seasonExpenses = expenses.filter(function(e) { return String(e.season) === String(cy); });

  var totalAcres = 0;
  for (var a = 0; a < commodities.length; a++) {
    totalAcres += productionAcres(commodities[a], cy);
  }

  var seedByCrop = {};
  if (costSummary.seed && costSummary.seed.byCommodity) {
    for (var s = 0; s < costSummary.seed.byCommodity.length; s++) {
      var row = costSummary.seed.byCommodity[s];
      seedByCrop[row.commodity] = parseFloat(row.total_cost) || 0;
    }
  }

  var sharedOverhead = 0;
  var depreciation = 0;
  for (var e = 0; e < seasonExpenses.length; e++) {
    var exp = seasonExpenses[e];
    var amt = parseFloat(exp.actual) || parseFloat(exp.budgeted) || 0;
    var cat = (exp.category || '').toLowerCase();
    if (cat.indexOf('depreciation') >= 0) depreciation += amt;
    sharedOverhead += amt;
  }

  for (var i = 0; i < commodities.length; i++) {
    var comm = commodities[i];
    var expData = exposure.byCommodity[comm] || {};
    var grossBu = expData.grossBushels || 0;
    var committed = expData.committed || 0;
    var available = grossBu - committed;
    if (available < 0) available = 0;

    var mktPrice = getLatestFuturesPrice(comm, marketPrices);

    // Cash breakeven
    var acres = productionAcres(comm, cy);
    var yld = productionYield(comm, cy);
    var acreShare = totalAcres > 0 ? acres / totalAcres : 0;
    var seedCost = seedByCrop[comm] || (costSummary.seed.total * acreShare);
    var fertCost = costSummary.fert.total * acreShare;
    var chemCost = costSummary.chemical.total * acreShare;
    var overheadAlloc = sharedOverhead * acreShare;
    var deprecAlloc = depreciation * acreShare;

    var seedPerAcre = acres > 0 ? seedCost / acres : 0;
    var fertPerAcre = acres > 0 ? fertCost / acres : 0;
    var chemPerAcre = acres > 0 ? chemCost / acres : 0;
    var overheadPerAcre = acres > 0 ? overheadAlloc / acres : 0;
    var deprecPerAcre = acres > 0 ? deprecAlloc / acres : 0;

    var totalCostPerAcre = seedPerAcre + fertPerAcre + chemPerAcre + overheadPerAcre;
    var cashBE = yld > 0 ? (totalCostPerAcre - deprecPerAcre) / yld : 0;

    var isAbove = mktPrice != null && cashBE > 0 && mktPrice > cashBE;
    var isBelow = mktPrice != null && cashBE > 0 && mktPrice <= cashBE;
    var priceClass = isAbove ? ' stc-above-be' : (isBelow ? ' stc-below-be' : '');

    var selected = comm === _stcSelectedCommodity ? ' stc-selected' : '';
    var color = COMMODITY_COLORS[comm] || '#888';

    html += '<div class="stc-commodity-row' + selected + '" onclick="stcSelectCommodity(\'' + escapeAttr(comm) + '\')">';
    html += '<div style="display:flex;align-items:center;gap:8px">';
    html += '<span class="grain-commodity-dot" style="background:' + color + '"></span>';
    html += '<div>';
    html += '<div style="font-weight:600">' + esc(comm) + '</div>';
    html += '<div style="font-size:12px;color:var(--text3)">' + _stcFmtBu(available) + ' bu available</div>';
    html += '</div></div>';
    html += '<div style="text-align:right">';
    if (mktPrice != null) {
      html += '<div class="' + priceClass.trim() + '" style="font-family:var(--mono);font-weight:600">$' + mktPrice.toFixed(4) + '</div>';
    } else {
      html += '<div style="font-family:var(--mono);color:var(--text3)">\u2014</div>';
    }
    if (cashBE > 0) {
      html += '<div style="font-size:12px;color:var(--text3)">BE $' + cashBE.toFixed(2) + '</div>';
    }
    html += '</div></div>';
  }

  html += '</div>';
  return html;
}

// ---- Panel 2: Elevator Comparison ----

function _stcRenderElevatorPanel(commodity, marketPrices) {
  var buyers = STATE.buyers || [];
  var rates = STATE.freightRates || [];
  var mktPrice = getLatestFuturesPrice(commodity, marketPrices);

  var html = '<div class="stc-panel">';
  html += '<div class="stc-panel-title">Elevator Net-to-Farm \u2014 ' + esc(commodity) + '</div>';

  if (buyers.length === 0) {
    html += '<p style="color:var(--text3);font-size:13px">No buyers configured. Add buyers in Settings.</p>';
    html += '</div>';
    return html;
  }

  if (mktPrice == null) {
    html += '<p style="color:var(--text3);font-size:13px">No market price available for ' + esc(commodity) + '.</p>';
    html += '</div>';
    return html;
  }

  // Build elevator rows with net-to-farm
  var rows = [];
  for (var i = 0; i < buyers.length; i++) {
    var buyer = buyers[i];
    var rate = rates.find(function(r) { return r.buyerName === buyer.name && r.commodity === commodity; });
    var freight = rate ? (parseFloat(rate.ratePerBu) || 0) : 0;
    var ntf = mktPrice - freight;
    rows.push({ name: buyer.name, freight: freight, ntf: ntf });
  }

  // Sort by ntf descending (best first)
  rows.sort(function(a, b) { return b.ntf - a.ntf; });
  var bestNtf = rows.length > 0 ? rows[0].ntf : 0;

  html += '<table class="grain-table" style="font-size:13px">';
  html += '<thead><tr><th>Elevator</th><th style="text-align:right">Freight</th><th style="text-align:right">Net-to-Farm</th></tr></thead>';
  html += '<tbody>';

  for (var j = 0; j < rows.length; j++) {
    var r = rows[j];
    var isBest = r.ntf === bestNtf ? ' stc-best-row' : '';
    html += '<tr class="' + isBest.trim() + '">';
    html += '<td>' + esc(r.name);
    if (r.ntf === bestNtf) html += ' <span style="font-size:11px;color:var(--green);font-weight:600">BEST</span>';
    html += '</td>';
    html += '<td style="text-align:right;font-family:var(--mono)">$' + r.freight.toFixed(2) + '</td>';
    html += '<td style="text-align:right;font-family:var(--mono);font-weight:600">$' + r.ntf.toFixed(4) + '</td>';
    html += '</tr>';
  }

  html += '</tbody></table>';
  html += '<div style="font-size:12px;color:var(--text3);margin-top:8px">Market: $' + mktPrice.toFixed(4) + '</div>';
  html += '</div>';
  return html;
}

// ---- Panel 3: Quick Contract Form ----

function _stcRenderContractForm(commodity, exposure, cy, marketPrices) {
  var expData = exposure.byCommodity[commodity] || {};
  var grossBu = expData.grossBushels || 0;
  var committed = expData.committed || 0;
  var available = grossBu - committed;
  if (available < 0) available = 0;

  var mktPrice = getLatestFuturesPrice(commodity, marketPrices);
  var priceVal = mktPrice != null ? mktPrice.toFixed(4) : '';

  // Determine best elevator
  var buyers = STATE.buyers || [];
  var rates = STATE.freightRates || [];
  var bestBuyer = '';
  var bestNtf = -Infinity;
  if (mktPrice != null) {
    for (var i = 0; i < buyers.length; i++) {
      var rate = rates.find(function(r) { return r.buyerName === buyers[i].name && r.commodity === commodity; });
      var freight = rate ? (parseFloat(rate.ratePerBu) || 0) : 0;
      var ntf = mktPrice - freight;
      if (ntf > bestNtf) {
        bestNtf = ntf;
        bestBuyer = buyers[i].name;
      }
    }
  }

  // Also include elevators from settings (legacy)
  var elevators = _stcGetAllElevators(buyers);

  var html = '<div class="stc-panel stc-form-panel">';
  html += '<div class="stc-panel-title">Quick Contract \u2014 ' + esc(commodity) + '</div>';

  html += '<div class="stc-form-grid">';

  // Bushels
  html += '<div class="form-group">';
  html += '<label class="form-label">Bushels</label>';
  html += '<input type="number" id="stcBushels" class="form-input" value="' + Math.round(available) + '" step="1">';
  html += '</div>';

  // Contract type
  html += '<div class="form-group">';
  html += '<label class="form-label">Type</label>';
  html += '<select id="stcType" class="form-select">';
  var types = ['Cash', 'HTA', 'Basis'];
  for (var t = 0; t < types.length; t++) {
    html += '<option value="' + escapeAttr(types[t]) + '">' + esc(types[t]) + '</option>';
  }
  html += '</select></div>';

  // Price
  html += '<div class="form-group">';
  html += '<label class="form-label">Price</label>';
  html += '<input type="number" id="stcPrice" class="form-input" step="0.0001" value="' + escapeAttr(priceVal) + '">';
  html += '</div>';

  // Elevator
  html += '<div class="form-group">';
  html += '<label class="form-label">Elevator</label>';
  html += '<input type="text" id="stcBuyer" class="form-input" list="stcBuyerList" value="' + escapeAttr(bestBuyer) + '">';
  html += '<datalist id="stcBuyerList">';
  for (var b = 0; b < elevators.length; b++) {
    html += '<option value="' + escapeAttr(elevators[b]) + '">';
  }
  html += '</datalist></div>';

  // Delivery period
  html += '<div class="form-group">';
  html += '<label class="form-label">Delivery</label>';
  html += '<select id="stcDelivery" class="form-select">';
  var periods = ['', 'Harvest', 'Oct-Nov', 'Dec-Jan', 'Feb-Mar', 'Apr-May', 'Jun-Jul'];
  for (var p = 0; p < periods.length; p++) {
    var label = periods[p] || 'Select...';
    html += '<option value="' + escapeAttr(periods[p]) + '">' + esc(label) + '</option>';
  }
  html += '</select></div>';

  // Notes
  html += '<div class="form-group" style="grid-column:1/-1">';
  html += '<label class="form-label">Notes</label>';
  html += '<input type="text" id="stcNotes" class="form-input" placeholder="Optional">';
  html += '</div>';

  html += '</div>'; // end stc-form-grid

  html += '<div style="margin-top:12px;display:flex;align-items:center;gap:12px">';
  html += '<button class="btn btn-primary" onclick="stcCreateContract()">Create Contract</button>';
  html += '<span style="font-size:12px;color:var(--text3)">Crop year: ' + esc(cy) + '</span>';
  html += '</div>';

  html += '</div>';
  return html;
}

// ---- Submit handler ----

function stcCreateContract() {
  var commodity = _stcSelectedCommodity;
  var cy = STATE.activeCropYear || SEASON.current;
  var bushelsEl = document.getElementById('stcBushels');
  var typeEl = document.getElementById('stcType');
  var priceEl = document.getElementById('stcPrice');
  var buyerEl = document.getElementById('stcBuyer');
  var deliveryEl = document.getElementById('stcDelivery');
  var notesEl = document.getElementById('stcNotes');

  var bushels = bushelsEl ? bushelsEl.value : '';
  var contractType = typeEl ? typeEl.value : 'Cash';
  var price = priceEl ? priceEl.value : '';
  var buyer = buyerEl ? buyerEl.value.trim() : '';
  var delivery = deliveryEl ? deliveryEl.value : '';
  var notes = notesEl ? notesEl.value.trim() : '';

  if (!bushels || !price) {
    showToast('Bushels and price are required', 'error');
    return;
  }

  var data = {
    commodity: commodity,
    cropYear: cy,
    contractType: contractType,
    status: 'Open',
    bushels: parseFloat(bushels),
    cashPrice: contractType === 'Cash' ? parseFloat(price) : null,
    futuresPrice: contractType !== 'Cash' ? parseFloat(price) : null,
    buyerName: buyer || null,
    deliveryDate: delivery || null,
    notes: notes || null
  };

  createRiskContractDB(data).then(function() {
    showToast('Contract created', 'success');
    return fetchRiskContractsDB(cy);
  }).then(function(contracts) {
    STATE.contracts = contracts || [];
    renderApp();
  }).catch(function(err) {
    showToast('Failed to create contract: ' + err.message, 'error');
  });
}

// ---- Helpers ----

function _stcFmtBu(n) {
  if (n == null) return '\u2014';
  return Math.round(n).toLocaleString('en-US');
}

function _stcGetAllElevators(buyers) {
  // Merge portal buyers + settings-based elevators
  var names = [];
  var seen = {};
  if (buyers && buyers.length) {
    for (var i = 0; i < buyers.length; i++) {
      if (buyers[i].name && !seen[buyers[i].name]) {
        names.push(buyers[i].name);
        seen[buyers[i].name] = true;
      }
    }
  }
  // Also pull from settings elevators (legacy)
  var raw = STATE.settings.elevators || '[]';
  try {
    var arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      for (var j = 0; j < arr.length; j++) {
        if (arr[j] && !seen[arr[j]]) {
          names.push(arr[j]);
          seen[arr[j]] = true;
        }
      }
    }
  } catch (e) { /* ignore */ }
  return names;
}
