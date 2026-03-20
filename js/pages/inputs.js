// ==================== HOLMES RISK — INPUTS PAGE ====================
// Fertilizer purchasing positions tracker

// Module-level filter state
var _fertFilters = { product: 'All', status: 'All' };

// Common fertilizer products
var FERT_PRODUCTS = ['NH3', 'DAP', 'MAP', 'Potash', 'UAN-28', 'UAN-32', 'Urea', 'AMS', 'Sulfur', 'Zinc', 'Boron', 'Lime'];

// Position types and statuses
var FERT_POSITION_TYPES = ['prepay', 'forward', 'futures', 'options'];
var FERT_STATUSES = ['open', 'delivered', 'closed'];

// ---- Main page renderer ----

function renderInputsPage() {
  return '<div class="page-content">' + _fertRenderContentForSubTab() + '</div>';
}

// Content renderer for Marketing sub-tab (no page-content wrapper)
function _fertRenderContentForSubTab() {
  var cropYear = STATE.activeCropYear || STATE.settings.activeCropYear || SEASON.current;
  var items = _fertFilterPositions(STATE.fertPositions || [], cropYear);

  return _fertRenderToolbar(cropYear) +
    _fertRenderSummary(items) +
    _fertRenderTable(items);
}

// ---- Toolbar ----

function _fertRenderToolbar(cropYear) {
  var years = ['2024', '2025', '2026', '2027'];
  var yearOpts = '';
  for (var i = 0; i < years.length; i++) {
    var sel = years[i] === cropYear ? ' selected' : '';
    yearOpts += '<option value="' + years[i] + '"' + sel + '>' + years[i] + '</option>';
  }

  // Product filter
  var prodOpts = '<option value="All">All Products</option>';
  for (var pi = 0; pi < FERT_PRODUCTS.length; pi++) {
    var pSel = _fertFilters.product === FERT_PRODUCTS[pi] ? ' selected' : '';
    prodOpts += '<option value="' + escapeAttr(FERT_PRODUCTS[pi]) + '"' + pSel + '>' + esc(FERT_PRODUCTS[pi]) + '</option>';
  }

  // Status filter
  var statOpts = '<option value="All">All Statuses</option>';
  for (var si = 0; si < FERT_STATUSES.length; si++) {
    var sSel = _fertFilters.status === FERT_STATUSES[si] ? ' selected' : '';
    statOpts += '<option value="' + escapeAttr(FERT_STATUSES[si]) + '"' + sSel + '>' + esc(FERT_STATUSES[si]) + '</option>';
  }

  return '<div class="grain-toolbar">' +
    '<div class="grain-toolbar-filters">' +
      '<select class="form-select grain-filter-select" onchange="fertApplyFilter(\'cropYear\', this.value)">' + yearOpts + '</select>' +
      '<select class="form-select grain-filter-select" onchange="fertApplyFilter(\'product\', this.value)">' + prodOpts + '</select>' +
      '<select class="form-select grain-filter-select" onchange="fertApplyFilter(\'status\', this.value)">' + statOpts + '</select>' +
    '</div>' +
    '<button class="btn btn-primary btn-sm" onclick="fertOpenModal()">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
      ' Add Position' +
    '</button>' +
  '</div>';
}

// ---- Filter logic ----

function fertApplyFilter(key, value) {
  if (key === 'cropYear') {
    STATE.activeCropYear = value;
    upsertRiskSettingDB('activeCropYear', value)
      .then(function() { STATE.settings.activeCropYear = value; })
      .catch(function() {});
  } else {
    _fertFilters[key] = value;
  }
  renderApp();
}

function _fertFilterPositions(items, cropYear) {
  var filtered = [];
  for (var i = 0; i < items.length; i++) {
    var p = items[i];
    // Crop year filter
    if (p.cropYear && String(p.cropYear) !== String(cropYear)) continue;
    // Product filter
    if (_fertFilters.product !== 'All' && p.product !== _fertFilters.product) continue;
    // Status filter
    if (_fertFilters.status !== 'All' && p.status !== _fertFilters.status) continue;
    filtered.push(p);
  }
  // Sort by product then by createdAt descending
  filtered.sort(function(a, b) {
    var cmp = (a.product || '').localeCompare(b.product || '');
    if (cmp !== 0) return cmp;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  return filtered;
}

// ---- Summary cards ----

function _fertRenderSummary(items) {
  var totalTons = 0;
  var totalCost = 0;
  var openCount = 0;

  for (var i = 0; i < items.length; i++) {
    var p = items[i];
    if (p.status === 'open') {
      var tons = parseFloat(p.tons) || 0;
      var price = parseFloat(p.pricePerTon) || 0;
      totalTons += tons;
      totalCost += tons * price;
      openCount++;
    }
  }

  return '<div class="stats-grid fert-summary-grid">' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + _grainFmtBushels(totalTons) + '</div>' +
      '<div class="stat-label">Open Tons</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">$' + _fertFmtDollars(totalCost) + '</div>' +
      '<div class="stat-label">Open Cost</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + openCount + '</div>' +
      '<div class="stat-label">Open Positions</div>' +
    '</div>' +
  '</div>';
}

// ---- Positions table ----

function _fertRenderTable(items) {
  if (items.length === 0) {
    return '<div class="page-placeholder"><p>No fertilizer positions yet. Add one to get started.</p></div>';
  }

  var html = '<div class="table-wrap"><table>' +
    '<thead><tr>' +
      '<th>Product</th>' +
      '<th>Type</th>' +
      '<th style="text-align:right">Tons</th>' +
      '<th style="text-align:right">Price/Ton</th>' +
      '<th style="text-align:right">Total Cost</th>' +
      '<th>Supplier</th>' +
      '<th>Status</th>' +
      '<th>Year</th>' +
      '<th>Notes</th>' +
      '<th>Actions</th>' +
    '</tr></thead><tbody>';

  var grandTons = 0;
  var grandCost = 0;

  for (var i = 0; i < items.length; i++) {
    var p = items[i];
    var tons = parseFloat(p.tons) || 0;
    var price = parseFloat(p.pricePerTon) || 0;
    var totalCost = tons * price;

    grandTons += tons;
    grandCost += totalCost;

    html += '<tr class="fert-row">' +
      '<td><strong>' + esc(p.product) + '</strong></td>' +
      '<td>' + _fertTypeBadge(p.positionType) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtBushels(tons) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">$' + _fertFmtPrice(price) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">$' + _fertFmtDollars(totalCost) + '</td>' +
      '<td>' + esc(p.supplier || '') + '</td>' +
      '<td>' + _fertStatusBadge(p.status) + '</td>' +
      '<td>' + esc(p.cropYear || '') + '</td>' +
      '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(p.notes || '') + '</td>' +
      '<td class="grain-actions">' +
        '<button class="btn btn-secondary btn-sm" onclick="fertOpenModal(\'' + escapeAttr(p.id) + '\')">Edit</button> ' +
        '<button class="btn btn-danger btn-sm" onclick="fertDelete(\'' + escapeAttr(p.id) + '\')">Del</button>' +
      '</td>' +
    '</tr>';
  }

  // Summary row
  html += '<tr style="font-weight:700;border-top:2px solid var(--border)">' +
    '<td colspan="2">Total</td>' +
    '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtBushels(grandTons) + '</td>' +
    '<td></td>' +
    '<td style="text-align:right;font-family:var(--mono)">$' + _fertFmtDollars(grandCost) + '</td>' +
    '<td colspan="5"></td>' +
  '</tr>';

  html += '</tbody></table></div>';
  return html;
}

// ---- Badge helpers ----

function _fertTypeBadge(type) {
  if (!type) return '\u2014';
  var cls = 'fert-type fert-type-' + type;
  return '<span class="' + cls + '">' + esc(type) + '</span>';
}

function _fertStatusBadge(status) {
  if (!status) return '\u2014';
  var cls = 'fert-status fert-status-' + status;
  return '<span class="' + cls + '">' + esc(status) + '</span>';
}

// ---- Format helpers ----

function _fertFmtDollars(n) {
  if (n == null) return '\u2014';
  var num = parseFloat(n);
  if (isNaN(num)) return '\u2014';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _fertFmtPrice(n) {
  if (n == null) return '\u2014';
  var num = parseFloat(n);
  if (isNaN(num)) return '\u2014';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---- Add/Edit Modal ----

function fertOpenModal(id) {
  var item = null;
  if (id) {
    var list = STATE.fertPositions || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { item = list[i]; break; }
    }
  }

  var isEdit = !!item;
  var title = isEdit ? 'Edit Fert Position' : 'Add Fert Position';
  var cropYear = STATE.activeCropYear || STATE.settings.activeCropYear || SEASON.current;

  // Product options
  var prodOpts = '<option value="">Select product</option>';
  for (var pi = 0; pi < FERT_PRODUCTS.length; pi++) {
    var pSel = (item && item.product === FERT_PRODUCTS[pi]) ? ' selected' : '';
    prodOpts += '<option value="' + escapeAttr(FERT_PRODUCTS[pi]) + '"' + pSel + '>' + esc(FERT_PRODUCTS[pi]) + '</option>';
  }

  // Year options
  var years = ['2024', '2025', '2026', '2027'];
  var yearOpts = '';
  for (var yi = 0; yi < years.length; yi++) {
    var ySel = (item ? String(item.cropYear) === years[yi] : years[yi] === cropYear) ? ' selected' : '';
    yearOpts += '<option value="' + years[yi] + '"' + ySel + '>' + years[yi] + '</option>';
  }

  // Position type options
  var typeOpts = '<option value="">Select type</option>';
  for (var ti = 0; ti < FERT_POSITION_TYPES.length; ti++) {
    var tSel = (item && item.positionType === FERT_POSITION_TYPES[ti]) ? ' selected' : '';
    typeOpts += '<option value="' + escapeAttr(FERT_POSITION_TYPES[ti]) + '"' + tSel + '>' + esc(FERT_POSITION_TYPES[ti]) + '</option>';
  }

  // Status options
  var statusOpts = '';
  for (var si = 0; si < FERT_STATUSES.length; si++) {
    var sSel = (item ? item.status === FERT_STATUSES[si] : FERT_STATUSES[si] === 'open') ? ' selected' : '';
    statusOpts += '<option value="' + escapeAttr(FERT_STATUSES[si]) + '"' + sSel + '>' + esc(FERT_STATUSES[si]) + '</option>';
  }

  var saveId = isEdit ? "'" + escapeAttr(id) + "'" : '';

  var html = '<div class="modal-title">' + esc(title) + '</div>' +
    '<form onsubmit="fertSave(event, ' + saveId + '); return false;">' +
      '<div class="grain-modal-grid">' +
        '<div class="form-group">' +
          '<label class="form-label">Product *</label>' +
          '<select class="form-select" id="fertProduct" required>' + prodOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Crop Year</label>' +
          '<select class="form-select" id="fertCropYear">' + yearOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Position Type</label>' +
          '<select class="form-select" id="fertType">' + typeOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Tons *</label>' +
          '<input class="form-input" id="fertTons" type="number" step="0.01" min="0" required value="' + escapeAttr(item ? item.tons || '' : '') + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Price Per Ton ($)</label>' +
          '<input class="form-input" id="fertPrice" type="number" step="0.01" min="0" value="' + escapeAttr(item ? item.pricePerTon || '' : '') + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Supplier</label>' +
          '<input class="form-input" id="fertSupplier" type="text" value="' + escapeAttr(item ? item.supplier || '' : '') + '" placeholder="e.g. CHS, Nutrien">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Status</label>' +
          '<select class="form-select" id="fertStatus">' + statusOpts + '</select>' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Notes</label>' +
        '<textarea class="form-input" id="fertNotes" rows="2">' + esc(item ? item.notes || '' : '') + '</textarea>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Save Changes' : 'Add Position') + '</button>' +
      '</div>' +
    '</form>';

  showModal(html);
}

// ---- Save handler ----

function fertSave(e, id) {
  if (e) e.preventDefault();

  var data = {
    product: document.getElementById('fertProduct').value,
    cropYear: document.getElementById('fertCropYear').value,
    positionType: document.getElementById('fertType').value || null,
    tons: parseFloat(document.getElementById('fertTons').value) || null,
    pricePerTon: parseFloat(document.getElementById('fertPrice').value) || null,
    supplier: (document.getElementById('fertSupplier').value || '').trim() || null,
    status: document.getElementById('fertStatus').value || 'open',
    notes: (document.getElementById('fertNotes').value || '').trim() || null
  };

  if (!data.product) {
    showToast('Product is required', 'error');
    return;
  }
  if (!data.tons || data.tons <= 0) {
    showToast('Tons must be greater than zero', 'error');
    return;
  }

  var promise = id
    ? updateFertPositionDB(id, data)
    : createFertPositionDB(data);

  promise.then(function(saved) {
    closeModal();
    if (id) {
      for (var i = 0; i < STATE.fertPositions.length; i++) {
        if (STATE.fertPositions[i].id === id) {
          STATE.fertPositions[i] = saved;
          break;
        }
      }
      showToast('Position updated', 'success');
    } else {
      STATE.fertPositions.push(saved);
      showToast('Position added', 'success');
    }
    renderApp();
  }).catch(function(err) {
    showToast('Error: ' + err.message, 'error');
  });
}

// ---- Delete handler ----

function fertDelete(id) {
  if (!confirm('Delete this fertilizer position?')) return;

  deleteFertPositionDB(id).then(function() {
    STATE.fertPositions = STATE.fertPositions.filter(function(p) { return p.id !== id; });
    showToast('Position deleted', 'success');
    renderApp();
  }).catch(function(err) {
    showToast('Error: ' + err.message, 'error');
  });
}
