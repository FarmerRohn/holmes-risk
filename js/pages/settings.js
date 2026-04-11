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

