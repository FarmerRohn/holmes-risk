// ==================== HOLMES RISK — SETTINGS PAGE ====================

function renderSettingsPage() {
  var settings = STATE.settings || {};
  var cropYear = settings.activeCropYear || SEASON.current;

  // Ensure STATE tracks active crop year
  STATE.activeCropYear = cropYear;

  return '<div class="page-content">' +
    '<div class="settings-page">' +
      _renderCropYearSection(cropYear) +
      _renderCommoditiesSection() +
      _renderCostBasisSection(settings) +
      _renderBushelsPerContractSection(settings) +
      _renderGrossBushelsSection(settings, cropYear) +
      _renderElevatorsSection(settings) +
      _renderBudgetSection(settings, cropYear) +
      _renderExpenseCategoriesSection(cropYear) +
      _renderFreightSection() +
      _renderPriceTargetsSection(cropYear) +
      '<div class="settings-section">' +
        '<div class="settings-section-header">' +
          '<h3 class="settings-section-title">Help</h3>' +
        '</div>' +
        '<div class="settings-section-body">' +
          '<a href="/guide.html" target="_blank" class="btn btn-secondary">Open User Guide</a>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

// ---- Crop Year ----

function _renderCropYearSection(active) {
  var years = SEASON.available;
  var opts = '';
  for (var i = 0; i < years.length; i++) {
    var sel = years[i] === active ? ' selected' : '';
    opts += '<option value="' + years[i] + '"' + sel + '>' + years[i] + '</option>';
  }

  return '<div class="settings-section">' +
    '<div class="settings-section-header">' +
      '<h3 class="settings-section-title">Active Crop Year</h3>' +
    '</div>' +
    '<div class="settings-section-body">' +
      '<div class="form-group">' +
        '<label class="form-label">Crop Year</label>' +
        '<select class="form-select" onchange="settingsSaveCropYear(this.value)">' +
          opts +
        '</select>' +
      '</div>' +
      '<p class="settings-hint">All pages will filter data to this crop year.</p>' +
    '</div>' +
  '</div>';
}

// ---- Commodities Display ----

function _renderCommoditiesSection() {
  var html = '<div class="settings-section">' +
    '<div class="settings-section-header">' +
      '<h3 class="settings-section-title">Commodities</h3>' +
    '</div>' +
    '<div class="settings-section-body">' +
      '<div class="commodity-chips">';

  for (var i = 0; i < DEFAULT_COMMODITIES.length; i++) {
    var c = DEFAULT_COMMODITIES[i];
    var color = COMMODITY_COLORS[c] || 'var(--text)';
    html += '<span class="commodity-chip" style="border-color: ' + color + '; color: ' + color + '">' +
      esc(c) +
    '</span>';
  }

  html += '</div>' +
      '<p class="settings-hint">Active commodities for tracking. Configuration coming in a future update.</p>' +
    '</div>' +
  '</div>';
  return html;
}

// ---- Cost Basis ----

function _renderCostBasisSection(settings) {
  var html = '<div class="settings-section">' +
    '<div class="settings-section-header">' +
      '<h3 class="settings-section-title">Cost Basis</h3>' +
    '</div>' +
    '<div class="settings-section-body">' +
      '<div class="settings-input-grid">';

  for (var i = 0; i < DEFAULT_COMMODITIES.length; i++) {
    var c = DEFAULT_COMMODITIES[i];
    var key = 'costBasis:' + c;
    var val = settings[key] || '';
    var unit = DEFAULT_UNIT_LABELS[c] || 'bu';

    html += '<div class="settings-input-row">' +
      '<label class="form-label">' + esc(c) + ' ($/' + esc(unit) + ')</label>' +
      '<input type="number" step="0.01" class="form-input" ' +
        'value="' + escapeAttr(val) + '" ' +
        'placeholder="0.00" ' +
        'data-setting-key="' + escapeAttr(key) + '" ' +
        'onchange="settingsSaveInput(this)">' +
    '</div>';
  }

  html += '</div>' +
    '</div>' +
  '</div>';
  return html;
}

// ---- Bushels Per Contract ----

function _renderBushelsPerContractSection(settings) {
  var html = '<div class="settings-section">' +
    '<div class="settings-section-header">' +
      '<h3 class="settings-section-title">Bushels Per Contract</h3>' +
    '</div>' +
    '<div class="settings-section-body">' +
      '<div class="settings-input-grid">';

  for (var i = 0; i < DEFAULT_COMMODITIES.length; i++) {
    var c = DEFAULT_COMMODITIES[i];
    var key = 'bushelsPerContract:' + c;
    var defaultVal = DEFAULT_BUSHELS_PER_CONTRACT[c] || '';
    var val = settings[key] || defaultVal;
    var unit = DEFAULT_UNIT_LABELS[c] || 'bu';

    html += '<div class="settings-input-row">' +
      '<label class="form-label">' + esc(c) + ' (' + esc(unit) + '/contract)</label>' +
      '<input type="number" step="1" class="form-input" ' +
        'value="' + escapeAttr(String(val)) + '" ' +
        'placeholder="' + escapeAttr(String(defaultVal)) + '" ' +
        'data-setting-key="' + escapeAttr(key) + '" ' +
        'onchange="settingsSaveInput(this)">' +
    '</div>';
  }

  html += '</div>' +
    '</div>' +
  '</div>';
  return html;
}

// ---- Gross Bushels ----

function _renderGrossBushelsSection(settings, cropYear) {
  var html = '<div class="settings-section">' +
    '<div class="settings-section-header">' +
      '<h3 class="settings-section-title">Gross Bushels (' + esc(cropYear) + ')</h3>' +
    '</div>' +
    '<div class="settings-section-body">' +
      '<p class="settings-hint" style="margin-bottom: 12px;">Total expected production per commodity for the active crop year.</p>' +
      '<div class="settings-input-grid">';

  for (var i = 0; i < DEFAULT_COMMODITIES.length; i++) {
    var c = DEFAULT_COMMODITIES[i];
    var key = 'grossBushels:' + c + ':' + cropYear;
    var val = settings[key] || '';
    var unit = DEFAULT_UNIT_LABELS[c] || 'bu';

    html += '<div class="settings-input-row">' +
      '<label class="form-label">' + esc(c) + ' (' + esc(unit) + ')</label>' +
      '<input type="number" step="1" class="form-input" ' +
        'value="' + escapeAttr(val) + '" ' +
        'placeholder="0" ' +
        'data-setting-key="' + escapeAttr(key) + '" ' +
        'onchange="settingsSaveInput(this)">' +
    '</div>';
  }

  html += '</div>' +
    '</div>' +
  '</div>';
  return html;
}

// ---- Elevators / Buyers ----

function _renderElevatorsSection(settings) {
  var elevatorsRaw = settings.elevators || '[]';
  var elevators = [];
  try { elevators = JSON.parse(elevatorsRaw); } catch (e) { elevators = []; }
  if (!Array.isArray(elevators)) elevators = [];
  var text = elevators.join('\n');

  return '<div class="settings-section">' +
    '<div class="settings-section-header">' +
      '<h3 class="settings-section-title">Elevators / Buyers</h3>' +
    '</div>' +
    '<div class="settings-section-body">' +
      '<p class="settings-hint" style="margin-bottom: 12px;">One elevator or buyer name per line. Used for contract dropdowns.</p>' +
      '<div class="form-group">' +
        '<textarea class="form-input" id="settingsElevators" rows="6" ' +
          'placeholder="Elevator 1&#10;Elevator 2&#10;Elevator 3"' +
          '>' + esc(text) + '</textarea>' +
      '</div>' +
      '<button class="btn btn-primary btn-sm" onclick="settingsSaveElevators()">Save Elevators</button>' +
    '</div>' +
  '</div>';
}

// ---- Save Handlers (global scope for onclick) ----

function settingsSaveCropYear(value) {
  STATE.activeCropYear = value;
  upsertRiskSettingDB('activeCropYear', value)
    .then(function() {
      STATE.settings.activeCropYear = value;
      showToast('Crop year set to ' + value, 'success');
      renderApp();
    })
    .catch(function(err) {
      showToast('Failed to save: ' + err.message, 'error');
    });
}

function settingsSaveInput(el) {
  var key = el.getAttribute('data-setting-key');
  var value = el.value;
  if (!key) return;

  upsertRiskSettingDB(key, value)
    .then(function() {
      STATE.settings[key] = value;
      showToast('Saved ' + key.split(':')[0], 'success');
    })
    .catch(function(err) {
      showToast('Failed to save: ' + err.message, 'error');
    });
}

function settingsSaveElevators() {
  var textarea = document.getElementById('settingsElevators');
  if (!textarea) return;

  var lines = textarea.value.split('\n');
  var elevators = [];
  for (var i = 0; i < lines.length; i++) {
    var trimmed = lines[i].trim();
    if (trimmed) elevators.push(trimmed);
  }

  var json = JSON.stringify(elevators);
  upsertRiskSettingDB('elevators', json)
    .then(function() {
      STATE.settings.elevators = json;
      showToast('Elevators saved (' + elevators.length + ')', 'success');
    })
    .catch(function(err) {
      showToast('Failed to save elevators: ' + err.message, 'error');
    });
}

// ---- Budget Section ----

function _renderBudgetSection(settings, cropYear) {
  var commodities = DEFAULT_COMMODITIES.filter(function(c) { return c !== 'Heating Oil'; });
  var budget = STATE.budget || [];

  var html = '<div class="settings-section">';
  html += '<div class="settings-section-header"><h3 class="settings-section-title">Farm Budget — ' + esc(cropYear) + '</h3></div>';
  html += '<div class="settings-section-body">';
  html += '<p class="settings-hint" style="margin-bottom:12px">Target price, yield, and acres per commodity. Pre-filled from field data where available.</p>';
  html += '<div class="settings-grid">';

  for (var i = 0; i < commodities.length; i++) {
    var c = commodities[i];
    var row = budget.find(function(b) { return b.commodity === c && String(b.season) === String(cropYear); });
    var targetPrice = row ? row.targetPrice : '';
    var targetYield = row ? row.targetYield : (productionYield(c, cropYear) || '');
    var acres = row ? row.budgetedAcres : (productionAcres(c, cropYear) || '');
    var rowId = row ? row.id : '';

    html += '<div class="settings-card">';
    html += '<div class="settings-card-header" style="color:' + (COMMODITY_COLORS[c] || '#888') + '">' + esc(c) + '</div>';
    html += '<div class="form-group"><label class="form-label">Target Price ($/bu)</label>';
    html += '<input type="number" class="form-input" step="0.01" value="' + escapeAttr(String(targetPrice)) + '" data-budget-commodity="' + escapeAttr(c) + '" data-budget-field="targetPrice" data-budget-id="' + escapeAttr(String(rowId)) + '" onchange="settingsSaveBudget(this)"></div>';
    html += '<div class="form-group"><label class="form-label">Target Yield (bu/ac)</label>';
    html += '<input type="number" class="form-input" step="0.1" value="' + escapeAttr(String(targetYield)) + '" data-budget-commodity="' + escapeAttr(c) + '" data-budget-field="targetYield" data-budget-id="' + escapeAttr(String(rowId)) + '" onchange="settingsSaveBudget(this)"></div>';
    html += '<div class="form-group"><label class="form-label">Budgeted Acres</label>';
    html += '<input type="number" class="form-input" step="1" value="' + escapeAttr(String(acres)) + '" data-budget-commodity="' + escapeAttr(c) + '" data-budget-field="budgetedAcres" data-budget-id="' + escapeAttr(String(rowId)) + '" onchange="settingsSaveBudget(this)"></div>';
    html += '</div>';
  }

  html += '</div></div></div>';
  return html;
}

function settingsSaveBudget(el) {
  var commodity = el.dataset.budgetCommodity;
  var field = el.dataset.budgetField;
  var id = el.dataset.budgetId;
  var value = el.value;
  var cy = STATE.activeCropYear || SEASON.current;

  if (id) {
    var data = {};
    data[field] = value || null;
    updateBudgetDB(id, data).then(function() {
      showToast(commodity + ' budget updated', 'success');
    }).catch(function() { showToast('Failed to save', 'error'); });
  } else {
    var newRow = { season: parseInt(cy), commodity: commodity };
    newRow[field] = value || null;
    createBudgetDB(newRow).then(function(result) {
      if (result && result.id) el.dataset.budgetId = result.id;
      showToast(commodity + ' budget saved', 'success');
      return fetchBudgetDB(cy);
    }).then(function(data) {
      STATE.budget = data || [];
    }).catch(function() { showToast('Failed to save', 'error'); });
  }
}

// ---- Expense Categories Section ----

function _renderExpenseCategoriesSection(cropYear) {
  var expenses = STATE.expenses || [];
  var seasonExpenses = expenses.filter(function(e) { return String(e.season) === String(cropYear); });
  var categories = ['seed', 'fert', 'chemical', 'land_rent', 'labor', 'insurance', 'repairs', 'fuel', 'drying', 'depreciation', 'interest', 'other'];
  var labels = { seed: 'Seed', fert: 'Fertilizer', chemical: 'Chemical', land_rent: 'Land Rent', labor: 'Labor', insurance: 'Insurance', repairs: 'Repairs', fuel: 'Fuel', drying: 'Drying', depreciation: 'Depreciation', interest: 'Interest', other: 'Other' };

  var html = '<div class="settings-section">';
  html += '<div class="settings-section-header"><h3 class="settings-section-title">Expense Budget — ' + esc(cropYear) + '</h3></div>';
  html += '<div class="settings-section-body">';
  html += '<p class="settings-hint" style="margin-bottom:12px">Budgeted and actual expenses per category. Auto-filled categories pull from purchase orders and contracts.</p>';
  html += '<table class="grain-table"><thead><tr><th>Category</th><th>Budgeted ($)</th><th>Actual ($)</th></tr></thead><tbody>';

  for (var i = 0; i < categories.length; i++) {
    var key = categories[i];
    var saved = seasonExpenses.find(function(e) { return e.category === key; });
    var budgeted = saved ? saved.budgeted || '' : '';
    var actual = saved ? saved.actual || '' : '';
    var expId = saved ? saved.id : '';

    html += '<tr><td>' + esc(labels[key]) + '</td>';
    html += '<td><input type="number" class="form-input" step="0.01" style="width:120px" value="' + escapeAttr(String(budgeted)) + '" data-expense-category="' + key + '" data-expense-field="budgeted" data-expense-id="' + escapeAttr(String(expId)) + '" onchange="settingsSaveExpense(this)"></td>';
    html += '<td><input type="number" class="form-input" step="0.01" style="width:120px" value="' + escapeAttr(String(actual)) + '" data-expense-category="' + key + '" data-expense-field="actual" data-expense-id="' + escapeAttr(String(expId)) + '" onchange="settingsSaveExpense(this)"></td>';
    html += '</tr>';
  }

  html += '</tbody></table></div></div>';
  return html;
}

function settingsSaveExpense(el) {
  var category = el.dataset.expenseCategory;
  var field = el.dataset.expenseField;
  var id = el.dataset.expenseId;
  var value = el.value;
  var cy = STATE.activeCropYear || SEASON.current;

  if (id) {
    var data = {};
    data[field] = value || null;
    updateExpenseDB(id, data).then(function() {
      showToast('Expense updated', 'success');
    }).catch(function() { showToast('Failed to save', 'error'); });
  } else {
    var newRow = { season: parseInt(cy), category: category };
    newRow[field] = value || null;
    createExpenseDB(newRow).then(function(result) {
      if (result && result.id) el.dataset.expenseId = result.id;
      showToast('Expense saved', 'success');
      return fetchExpensesDB(cy);
    }).then(function(data) {
      STATE.expenses = data || [];
    }).catch(function() { showToast('Failed to save', 'error'); });
  }
}

// ---- Freight Rates Section ----

function _renderFreightSection() {
  var rates = STATE.freightRates || [];
  var buyers = STATE.buyers || [];
  var commodities = DEFAULT_COMMODITIES.filter(function(c) { return c !== 'Heating Oil'; });

  var html = '<div class="settings-section">';
  html += '<div class="settings-section-header"><h3 class="settings-section-title">Freight Rates</h3></div>';
  html += '<div class="settings-section-body">';
  html += '<p class="settings-hint" style="margin-bottom:12px">Cost per bushel to deliver to each elevator. Used in Sell the Curve net-to-farm calculations.</p>';

  if (buyers.length === 0) {
    html += '<p style="color:var(--text3)">No buyers found. Buyers are synced from the portal.</p>';
    html += '</div></div>';
    return html;
  }

  html += '<div style="overflow-x:auto">';
  html += '<table class="grain-table"><thead><tr><th>Elevator</th>';
  for (var i = 0; i < commodities.length; i++) {
    html += '<th>' + esc(commodities[i]) + '</th>';
  }
  html += '</tr></thead><tbody>';

  for (var b = 0; b < buyers.length; b++) {
    var buyer = buyers[b];
    html += '<tr><td>' + esc(buyer.name) + '</td>';
    for (var j = 0; j < commodities.length; j++) {
      var comm = commodities[j];
      var rate = rates.find(function(r) { return r.buyerName === buyer.name && r.commodity === comm; });
      var val = rate ? rate.ratePerBu || '' : '';
      var rateId = rate ? rate.id : '';
      html += '<td><input type="number" class="form-input" step="0.01" style="width:80px" value="' + escapeAttr(String(val)) + '" data-freight-buyer="' + escapeAttr(buyer.name) + '" data-freight-commodity="' + escapeAttr(comm) + '" data-freight-id="' + escapeAttr(String(rateId)) + '" onchange="settingsSaveFreight(this)"></td>';
    }
    html += '</tr>';
  }

  html += '</tbody></table></div></div></div>';
  return html;
}

function settingsSaveFreight(el) {
  var buyerName = el.dataset.freightBuyer;
  var commodity = el.dataset.freightCommodity;
  var id = el.dataset.freightId;
  var value = parseFloat(el.value);

  if (id) {
    updateFreightRateDB(id, { ratePerBu: value || 0 }).then(function() {
      showToast('Freight rate updated', 'success');
    }).catch(function() { showToast('Failed to save', 'error'); });
  } else {
    createFreightRateDB({ buyerName: buyerName, commodity: commodity, ratePerBu: value || 0 }).then(function(result) {
      if (result && result.id) el.dataset.freightId = result.id;
      showToast('Freight rate saved', 'success');
      return fetchFreightRatesDB();
    }).then(function(data) {
      STATE.freightRates = data || [];
    }).catch(function() { showToast('Failed to save', 'error'); });
  }
}

// ---- Price Targets Section ----

function _renderPriceTargetsSection(cropYear) {
  var targets = (STATE.priceTargets || []).filter(function(t) { return t.cropYear === cropYear; });

  var html = '<div class="settings-section">';
  html += '<div class="settings-section-header"><h3 class="settings-section-title">Price Targets — ' + esc(cropYear) + '</h3></div>';
  html += '<div class="settings-section-body">';
  html += '<p class="settings-hint" style="margin-bottom:12px">Set sell targets. These appear on the Charts page as horizontal lines.</p>';

  if (targets.length) {
    html += '<table class="grain-table"><thead><tr><th>Commodity</th><th>Target</th><th>Month</th><th>Notes</th><th></th></tr></thead><tbody>';
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      html += '<tr>';
      html += '<td>' + esc(t.commodity) + '</td>';
      html += '<td>$' + (parseFloat(t.targetPrice) || 0).toFixed(2) + '</td>';
      html += '<td>' + esc(t.futuresMonth || '') + '</td>';
      html += '<td>' + esc(t.notes || '') + '</td>';
      html += '<td><button class="btn btn-sm" onclick="settingsDeleteTarget(\'' + t.id + '\')" title="Delete">&times;</button></td>';
      html += '</tr>';
    }
    html += '</tbody></table>';
  }

  // Add form
  html += '<div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:end;">';
  html += '<div class="form-group"><label class="form-label">Commodity</label><select class="form-input" id="targetCommodity">';
  for (var j = 0; j < DEFAULT_COMMODITIES.length; j++) {
    html += '<option>' + esc(DEFAULT_COMMODITIES[j]) + '</option>';
  }
  html += '</select></div>';
  html += '<div class="form-group"><label class="form-label">Target Price</label><input type="number" class="form-input" id="targetPrice" step="0.01" style="width:100px"></div>';
  html += '<div class="form-group"><label class="form-label">Futures Month</label><input type="text" class="form-input" id="targetMonth" placeholder="e.g. Z26" style="width:80px"></div>';
  html += '<div class="form-group"><label class="form-label">Notes</label><input type="text" class="form-input" id="targetNotes" placeholder="Optional" style="width:140px"></div>';
  html += '<button class="btn btn-primary" onclick="settingsAddTarget()">Add Target</button>';
  html += '</div></div></div>';
  return html;
}

function settingsAddTarget() {
  var commodity = document.getElementById('targetCommodity').value;
  var price = document.getElementById('targetPrice').value;
  var month = document.getElementById('targetMonth').value.trim();
  var notes = document.getElementById('targetNotes').value.trim();
  var cy = STATE.activeCropYear || SEASON.current;

  if (!price) { showToast('Enter a target price', 'error'); return; }

  createPriceTargetDB({
    commodity: commodity, cropYear: cy, targetPrice: parseFloat(price),
    futuresMonth: month || null, notes: notes || null
  }).then(function() {
    showToast('Price target added', 'success');
    return fetchPriceTargetsDB(cy);
  }).then(function(data) {
    STATE.priceTargets = data || [];
    renderApp();
  }).catch(function() { showToast('Failed to save', 'error'); });
}

function settingsDeleteTarget(id) {
  deletePriceTargetDB(id).then(function() {
    showToast('Target deleted', 'success');
    var cy = STATE.activeCropYear || SEASON.current;
    return fetchPriceTargetsDB(cy);
  }).then(function(data) {
    STATE.priceTargets = data || [];
    renderApp();
  }).catch(function() { showToast('Failed to delete', 'error'); });
}

