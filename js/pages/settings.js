// ==================== HOLMES RISK — SETTINGS PAGE ====================

var _priceLogFilter = 'All';

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
      _renderPriceLogSection() +
    '</div>' +
  '</div>';
}

// ---- Crop Year ----

function _renderCropYearSection(active) {
  var years = ['2024', '2025', '2026', '2027'];
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

// ---- Price Log Section ----

function _renderPriceLogSection() {
  var entries = STATE.priceLog || [];

  // Filter by commodity
  if (_priceLogFilter && _priceLogFilter !== 'All') {
    var filtered = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].commodity === _priceLogFilter) filtered.push(entries[i]);
    }
    entries = filtered;
  }

  // Sort most recent first
  entries = entries.slice().sort(function(a, b) {
    return (b.date || '').localeCompare(a.date || '');
  });

  // Limit to 50
  if (entries.length > 50) entries = entries.slice(0, 50);

  // Build commodity filter options
  var filterOpts = '<option value="All"' + (_priceLogFilter === 'All' ? ' selected' : '') + '>All</option>';
  for (var ci = 0; ci < DEFAULT_COMMODITIES.length; ci++) {
    var comm = DEFAULT_COMMODITIES[ci];
    var sel = _priceLogFilter === comm ? ' selected' : '';
    filterOpts += '<option value="' + escapeAttr(comm) + '"' + sel + '>' + esc(comm) + '</option>';
  }

  var html = '<div class="settings-section">' +
    '<div class="settings-section-header">' +
      '<h3 class="settings-section-title">Price Log</h3>' +
      '<button class="btn btn-primary btn-sm" onclick="priceLogOpenModal()">Add Entry</button>' +
    '</div>' +
    '<div class="settings-section-body">' +
      '<div class="form-group" style="margin-bottom: 12px; max-width: 200px;">' +
        '<label class="form-label">Commodity</label>' +
        '<select class="form-select" onchange="priceLogFilterChange(this.value)">' +
          filterOpts +
        '</select>' +
      '</div>';

  if (entries.length === 0) {
    html += '<p class="settings-hint">No price log entries yet.</p>';
  } else {
    html += '<div class="table-scroll"><table class="data-table">' +
      '<thead><tr>' +
        '<th>Date</th>' +
        '<th>Commodity</th>' +
        '<th style="text-align:right">Cash Price</th>' +
        '<th style="text-align:right">Basis</th>' +
        '<th style="text-align:right">Futures Price</th>' +
        '<th>Futures Mo</th>' +
        '<th>Source</th>' +
        '<th>Notes</th>' +
      '</tr></thead><tbody>';

    for (var ei = 0; ei < entries.length; ei++) {
      var e = entries[ei];
      var color = COMMODITY_COLORS[e.commodity] || 'var(--text)';
      html += '<tr>' +
        '<td>' + esc(e.date || '') + '</td>' +
        '<td>' +
          '<span class="grain-commodity-dot" style="background:' + color + '"></span> ' +
          esc(e.commodity) +
        '</td>' +
        '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(e.cashPrice) + '</td>' +
        '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(e.basis) + '</td>' +
        '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(e.futuresPrice) + '</td>' +
        '<td>' + esc(e.futuresMonth || '') + '</td>' +
        '<td>' + esc(e.source || '') + '</td>' +
        '<td>' + esc(e.notes || '') + '</td>' +
      '</tr>';
    }

    html += '</tbody></table></div>';
  }

  html += '</div></div>';
  return html;
}

function priceLogFilterChange(value) {
  _priceLogFilter = value;
  renderApp();
}

function priceLogOpenModal() {
  // Today in YYYY-MM-DD
  var now = new Date();
  var todayStr = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  // Commodity options
  var commOpts = '';
  for (var i = 0; i < DEFAULT_COMMODITIES.length; i++) {
    commOpts += '<option value="' + escapeAttr(DEFAULT_COMMODITIES[i]) + '">' + esc(DEFAULT_COMMODITIES[i]) + '</option>';
  }

  // Futures month options
  var fmOpts = _grainBuildFuturesMonthOptions('');

  // Source options
  var sourceOpts = '<option value="manual" selected>manual</option>' +
    '<option value="databento">databento</option>' +
    '<option value="yahoo">yahoo</option>';

  var html = '<h2 class="modal-title">Add Price Log Entry</h2>' +
    '<form id="priceLogForm" onsubmit="priceLogSave(event)">' +
      '<div class="form-grid form-grid-2">' +
        '<div class="form-group">' +
          '<label class="form-label">Date</label>' +
          '<input type="date" class="form-input" name="date" value="' + escapeAttr(todayStr) + '" required>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Commodity</label>' +
          '<select class="form-select" name="commodity" required>' + commOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Cash Price</label>' +
          '<input type="number" step="0.0001" class="form-input" name="cashPrice" placeholder="0.0000">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Basis</label>' +
          '<input type="number" step="0.0001" class="form-input" name="basis" placeholder="0.0000">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Futures Price</label>' +
          '<input type="number" step="0.0001" class="form-input" name="futuresPrice" placeholder="0.0000">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Futures Month</label>' +
          '<select class="form-select" name="futuresMonth">' + fmOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Source</label>' +
          '<select class="form-select" name="source">' + sourceOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Notes</label>' +
          '<input type="text" class="form-input" name="notes" placeholder="Optional notes">' +
        '</div>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">Save Entry</button>' +
      '</div>' +
    '</form>';

  showModal(html);
}

function priceLogSave(e) {
  e.preventDefault();
  var form = document.getElementById('priceLogForm');
  if (!form) return;

  var data = {
    date: form.date.value,
    commodity: form.commodity.value,
    cashPrice: form.cashPrice.value ? parseFloat(form.cashPrice.value) : null,
    basis: form.basis.value ? parseFloat(form.basis.value) : null,
    futuresPrice: form.futuresPrice.value ? parseFloat(form.futuresPrice.value) : null,
    futuresMonth: form.futuresMonth.value || null,
    source: form.source.value || 'manual',
    notes: form.notes.value || null
  };

  if (!data.date || !data.commodity) {
    showToast('Date and commodity are required', 'error');
    return;
  }

  createPriceLogEntryDB(data)
    .then(function(result) {
      if (result) {
        STATE.priceLog.push(result);
      }
      closeModal();
      showToast('Price log entry saved', 'success');
      renderApp();
    })
    .catch(function(err) {
      showToast('Failed to save: ' + err.message, 'error');
    });
}
