// ==================== HOLMES RISK — INVENTORY PAGE ====================

// Module-level state for sub-tab
var _inventoryTab = 'crop'; // 'crop' or 'storage'

// ---- Main page renderer ----

function renderInventoryPage() {
  var cropYear = STATE.activeCropYear || STATE.settings.activeCropYear || SEASON.current;

  return '<div class="page-content">' +
    _invRenderSubTabs() +
    (_inventoryTab === 'crop'
      ? _invRenderCropTab(cropYear)
      : _invRenderStorageTab(cropYear)) +
  '</div>';
}

// ---- Sub-tab bar ----

function _invRenderSubTabs() {
  var cropActive = _inventoryTab === 'crop' ? ' inv-subtab-active' : '';
  var storageActive = _inventoryTab === 'storage' ? ' inv-subtab-active' : '';

  return '<div class="inv-subtab-bar">' +
    '<button class="inv-subtab' + cropActive + '" onclick="inventorySwitchTab(\'crop\')">Crop Fields</button>' +
    '<button class="inv-subtab' + storageActive + '" onclick="inventorySwitchTab(\'storage\')">Storage</button>' +
  '</div>';
}

function inventorySwitchTab(tab) {
  _inventoryTab = tab;
  renderApp();
}

// ==============================================================
// CROP FIELDS TAB
// ==============================================================

function _invRenderCropTab(cropYear) {
  var items = _invFilterCrop(STATE.cropInventory || [], cropYear);

  return _invRenderCropToolbar(cropYear) +
    _invRenderCropSummary(items) +
    _invRenderCropTable(items);
}

function _invFilterCrop(items, cropYear) {
  var filtered = [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].cropYear && String(items[i].cropYear) !== String(cropYear)) continue;
    filtered.push(items[i]);
  }
  filtered.sort(function(a, b) {
    return (a.fieldName || '').localeCompare(b.fieldName || '');
  });
  return filtered;
}

function _invRenderCropToolbar(cropYear) {
  var years = ['2024', '2025', '2026', '2027'];
  var yearOpts = '';
  for (var i = 0; i < years.length; i++) {
    var sel = years[i] === cropYear ? ' selected' : '';
    yearOpts += '<option value="' + years[i] + '"' + sel + '>' + years[i] + '</option>';
  }

  return '<div class="grain-toolbar">' +
    '<div class="grain-toolbar-filters">' +
      '<select class="form-select grain-filter-select" onchange="STATE.activeCropYear=this.value;renderApp()">' + yearOpts + '</select>' +
    '</div>' +
    '<button class="btn btn-primary btn-sm" onclick="inventoryOpenCropModal()">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
      ' Add Field' +
    '</button>' +
  '</div>';
}

// ---- Crop Summary ----

function _invRenderCropSummary(items) {
  var totalAcres = 0;
  var totalExpected = 0;
  var totalActual = 0;

  for (var i = 0; i < items.length; i++) {
    totalAcres += parseFloat(items[i].acres) || 0;
    totalExpected += parseFloat(items[i].totalExpectedBu) || 0;
    totalActual += parseFloat(items[i].actualHarvestedBu) || 0;
  }

  return '<div class="stats-grid inv-summary-grid">' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + _grainFmtBushels(totalAcres) + '</div>' +
      '<div class="stat-label">Total Acres</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + _grainFmtBushels(totalExpected) + '</div>' +
      '<div class="stat-label">Expected Bu</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + _grainFmtBushels(totalActual) + '</div>' +
      '<div class="stat-label">Actual Bu</div>' +
    '</div>' +
  '</div>';
}

// ---- Crop Table ----

function _invRenderCropTable(items) {
  if (items.length === 0) {
    return '<div class="page-placeholder"><p>No crop field records yet. Add one to get started.</p></div>';
  }

  var html = '<div class="table-wrap"><table>' +
    '<thead><tr>' +
      '<th scope="col">Field</th>' +
      '<th scope="col">Commodity</th>' +
      '<th scope="col" style="text-align:right">Acres</th>' +
      '<th scope="col" style="text-align:right">Yield Est</th>' +
      '<th scope="col" style="text-align:right">Expected Bu</th>' +
      '<th scope="col" style="text-align:right">Actual Bu</th>' +
      '<th scope="col">Notes</th>' +
      '<th scope="col">Actions</th>' +
    '</tr></thead><tbody>';

  var totalAcres = 0;
  var totalExpected = 0;
  var totalActual = 0;

  for (var i = 0; i < items.length; i++) {
    var c = items[i];
    var color = COMMODITY_COLORS[c.commodity] || '#888';
    var acres = parseFloat(c.acres) || 0;
    var expected = parseFloat(c.totalExpectedBu) || 0;
    var actual = parseFloat(c.actualHarvestedBu) || 0;

    totalAcres += acres;
    totalExpected += expected;
    totalActual += actual;

    html += '<tr class="inv-row">' +
      '<td>' + esc(c.fieldName) + '</td>' +
      '<td><span class="grain-commodity-dot" style="background:' + escapeAttr(color) + '"></span>' + esc(c.commodity) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtBushels(acres) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + (c.yieldEstimate != null ? _grainFmtBushels(c.yieldEstimate) : '\u2014') + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtBushels(expected) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + (actual > 0 ? _grainFmtBushels(actual) : '\u2014') + '</td>' +
      '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(c.notes || '') + '</td>' +
      '<td class="grain-actions">' +
        '<button class="btn btn-secondary btn-sm" onclick="inventoryOpenCropModal(\'' + escapeAttr(c.id) + '\')">Edit</button> ' +
        '<button class="btn btn-danger btn-sm" onclick="inventoryDeleteCrop(\'' + escapeAttr(c.id) + '\')">Del</button>' +
      '</td>' +
    '</tr>';
  }

  // Summary row
  html += '<tr style="font-weight:700;border-top:2px solid var(--border)">' +
    '<td colspan="2">Total</td>' +
    '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtBushels(totalAcres) + '</td>' +
    '<td></td>' +
    '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtBushels(totalExpected) + '</td>' +
    '<td style="text-align:right;font-family:var(--mono)">' + (totalActual > 0 ? _grainFmtBushels(totalActual) : '\u2014') + '</td>' +
    '<td colspan="2"></td>' +
  '</tr>';

  html += '</tbody></table></div>';
  return html;
}

// ---- Crop Modal ----

function inventoryOpenCropModal(id) {
  var item = null;
  if (id) {
    var list = STATE.cropInventory || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { item = list[i]; break; }
    }
  }

  var isEdit = !!item;
  var title = isEdit ? 'Edit Crop Field' : 'Add Crop Field';
  var cropYear = STATE.activeCropYear || STATE.settings.activeCropYear || SEASON.current;

  // Commodity options
  var commOpts = '<option value="">Select commodity</option>';
  for (var ci = 0; ci < DEFAULT_COMMODITIES.length; ci++) {
    var cSel = (item && item.commodity === DEFAULT_COMMODITIES[ci]) ? ' selected' : '';
    commOpts += '<option value="' + escapeAttr(DEFAULT_COMMODITIES[ci]) + '"' + cSel + '>' + esc(DEFAULT_COMMODITIES[ci]) + '</option>';
  }

  // Year options
  var years = ['2024', '2025', '2026', '2027'];
  var yearOpts = '';
  for (var yi = 0; yi < years.length; yi++) {
    var ySel = (item ? String(item.cropYear) === years[yi] : years[yi] === cropYear) ? ' selected' : '';
    yearOpts += '<option value="' + years[yi] + '"' + ySel + '>' + years[yi] + '</option>';
  }

  var saveId = isEdit ? "'" + escapeAttr(id) + "'" : '';

  var html = '<div class="modal-title">' + esc(title) + '</div>' +
    '<form onsubmit="inventorySaveCrop(event, ' + saveId + '); return false;">' +
      '<div class="grain-modal-grid">' +
        '<div class="form-group">' +
          '<label class="form-label">Field Name *</label>' +
          '<input class="form-input" id="invCropField" required value="' + escapeAttr(item ? item.fieldName : '') + '" placeholder="e.g. North 80">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Commodity</label>' +
          '<select class="form-select" id="invCropCommodity">' + commOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Crop Year</label>' +
          '<select class="form-select" id="invCropYear">' + yearOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Acres</label>' +
          '<input class="form-input" id="invCropAcres" type="number" step="0.01" min="0" value="' + escapeAttr(item ? item.acres || '' : '') + '" oninput="inventoryCalcExpected()">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Yield Estimate (bu/ac)</label>' +
          '<input class="form-input" id="invCropYield" type="number" step="0.1" min="0" value="' + escapeAttr(item ? item.yieldEstimate || '' : '') + '" oninput="inventoryCalcExpected()">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Total Expected Bu</label>' +
          '<input class="form-input" id="invCropExpected" type="number" step="1" min="0" value="' + escapeAttr(item ? item.totalExpectedBu || '' : '') + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Actual Harvested Bu</label>' +
          '<input class="form-input" id="invCropActual" type="number" step="1" min="0" value="' + escapeAttr(item ? item.actualHarvestedBu || '' : '') + '">' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Notes</label>' +
        '<textarea class="form-input" id="invCropNotes" rows="2">' + esc(item ? item.notes || '' : '') + '</textarea>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Save Changes' : 'Add Field') + '</button>' +
      '</div>' +
    '</form>';

  showModal(html);
}

// Auto-calc expected = acres * yield (editable override)
function inventoryCalcExpected() {
  var acresEl = document.getElementById('invCropAcres');
  var yieldEl = document.getElementById('invCropYield');
  var expectedEl = document.getElementById('invCropExpected');
  if (!acresEl || !yieldEl || !expectedEl) return;

  var acres = parseFloat(acresEl.value) || 0;
  var yld = parseFloat(yieldEl.value) || 0;
  if (acres > 0 && yld > 0) {
    expectedEl.value = Math.round(acres * yld);
  }
}

// ---- Save Crop ----

function inventorySaveCrop(e, id) {
  if (e) e.preventDefault();

  var data = {
    fieldName: (document.getElementById('invCropField').value || '').trim(),
    commodity: document.getElementById('invCropCommodity').value,
    cropYear: document.getElementById('invCropYear').value,
    acres: parseFloat(document.getElementById('invCropAcres').value) || null,
    yieldEstimate: parseFloat(document.getElementById('invCropYield').value) || null,
    totalExpectedBu: parseFloat(document.getElementById('invCropExpected').value) || null,
    actualHarvestedBu: parseFloat(document.getElementById('invCropActual').value) || null,
    notes: (document.getElementById('invCropNotes').value || '').trim() || null
  };

  if (!data.fieldName) {
    showToast('Field name is required', 'error');
    return;
  }

  var promise = id
    ? updateCropInventoryDB(id, data)
    : createCropInventoryDB(data);

  promise.then(function(saved) {
    closeModal();
    if (id) {
      // Update in state
      for (var i = 0; i < STATE.cropInventory.length; i++) {
        if (STATE.cropInventory[i].id === id) {
          STATE.cropInventory[i] = saved;
          break;
        }
      }
      showToast('Field updated', 'success');
    } else {
      STATE.cropInventory.push(saved);
      showToast('Field added', 'success');
    }
    renderApp();
  }).catch(function(err) {
    showToast('Error: ' + err.message, 'error');
  });
}

// ---- Delete Crop ----

function inventoryDeleteCrop(id) {
  if (!confirm('Delete this crop field record?')) return;

  deleteCropInventoryDB(id).then(function() {
    STATE.cropInventory = STATE.cropInventory.filter(function(c) { return c.id !== id; });
    showToast('Field deleted', 'success');
    renderApp();
  }).catch(function(err) {
    showToast('Error: ' + err.message, 'error');
  });
}

// ==============================================================
// STORAGE / BINS TAB
// ==============================================================

function _invRenderStorageTab(cropYear) {
  var items = _invFilterBin(STATE.binInventory || [], cropYear);

  return _invRenderStorageToolbar(cropYear) +
    _invRenderStorageSummary(items) +
    _invRenderStorageTable(items);
}

function _invFilterBin(items, cropYear) {
  var filtered = [];
  for (var i = 0; i < items.length; i++) {
    if (items[i].cropYear && String(items[i].cropYear) !== String(cropYear)) continue;
    filtered.push(items[i]);
  }
  filtered.sort(function(a, b) {
    return (a.location || '').localeCompare(b.location || '');
  });
  return filtered;
}

function _invRenderStorageToolbar(cropYear) {
  var years = ['2024', '2025', '2026', '2027'];
  var yearOpts = '';
  for (var i = 0; i < years.length; i++) {
    var sel = years[i] === cropYear ? ' selected' : '';
    yearOpts += '<option value="' + years[i] + '"' + sel + '>' + years[i] + '</option>';
  }

  return '<div class="grain-toolbar">' +
    '<div class="grain-toolbar-filters">' +
      '<select class="form-select grain-filter-select" onchange="STATE.activeCropYear=this.value;renderApp()">' + yearOpts + '</select>' +
    '</div>' +
    '<button class="btn btn-primary btn-sm" onclick="inventoryOpenBinModal()">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
      ' Add Bin' +
    '</button>' +
  '</div>';
}

// ---- Storage Summary ----

function _invRenderStorageSummary(items) {
  var totalBu = 0;
  var binsWithGrain = 0;

  for (var i = 0; i < items.length; i++) {
    var bu = parseFloat(items[i].totalBushels) || 0;
    totalBu += bu;
    if (bu > 0) binsWithGrain++;
  }

  return '<div class="stats-grid inv-summary-grid">' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + _grainFmtBushels(totalBu) + '</div>' +
      '<div class="stat-label">Total Bu in Storage</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + binsWithGrain + '</div>' +
      '<div class="stat-label">Bins with Grain</div>' +
    '</div>' +
  '</div>';
}

// ---- Storage Table ----

function _invRenderStorageTable(items) {
  if (items.length === 0) {
    return '<div class="page-placeholder"><p>No bin inventory records yet. Add one to get started.</p></div>';
  }

  var html = '<div class="table-wrap"><table>' +
    '<thead><tr>' +
      '<th scope="col">Location</th>' +
      '<th scope="col">Commodity</th>' +
      '<th scope="col" style="text-align:right">Bushels</th>' +
      '<th scope="col">Date Filled</th>' +
      '<th scope="col">Notes</th>' +
      '<th scope="col">Actions</th>' +
    '</tr></thead><tbody>';

  for (var i = 0; i < items.length; i++) {
    var b = items[i];
    var color = COMMODITY_COLORS[b.commodity] || '#888';
    var dateFilled = b.dateFilled ? b.dateFilled.slice(0, 10) : '\u2014';

    html += '<tr class="inv-row">' +
      '<td>' + esc(b.location) + '</td>' +
      '<td><span class="grain-commodity-dot" style="background:' + escapeAttr(color) + '"></span>' + esc(b.commodity) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtBushels(b.totalBushels) + '</td>' +
      '<td>' + esc(dateFilled) + '</td>' +
      '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(b.notes || '') + '</td>' +
      '<td class="grain-actions">' +
        '<button class="btn btn-secondary btn-sm" onclick="inventoryOpenBinModal(\'' + escapeAttr(b.id) + '\')">Edit</button> ' +
        '<button class="btn btn-danger btn-sm" onclick="inventoryDeleteBin(\'' + escapeAttr(b.id) + '\')">Del</button>' +
      '</td>' +
    '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

// ---- Bin Modal ----

function inventoryOpenBinModal(id) {
  var item = null;
  if (id) {
    var list = STATE.binInventory || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { item = list[i]; break; }
    }
  }

  var isEdit = !!item;
  var title = isEdit ? 'Edit Bin' : 'Add Bin';
  var cropYear = STATE.activeCropYear || STATE.settings.activeCropYear || SEASON.current;

  // Commodity options
  var commOpts = '<option value="">Select commodity</option>';
  for (var ci = 0; ci < DEFAULT_COMMODITIES.length; ci++) {
    var cSel = (item && item.commodity === DEFAULT_COMMODITIES[ci]) ? ' selected' : '';
    commOpts += '<option value="' + escapeAttr(DEFAULT_COMMODITIES[ci]) + '"' + cSel + '>' + esc(DEFAULT_COMMODITIES[ci]) + '</option>';
  }

  // Year options
  var years = ['2024', '2025', '2026', '2027'];
  var yearOpts = '';
  for (var yi = 0; yi < years.length; yi++) {
    var ySel = (item ? String(item.cropYear) === years[yi] : years[yi] === cropYear) ? ' selected' : '';
    yearOpts += '<option value="' + years[yi] + '"' + ySel + '>' + years[yi] + '</option>';
  }

  var saveId = isEdit ? "'" + escapeAttr(id) + "'" : '';
  var dateVal = (item && item.dateFilled) ? item.dateFilled.slice(0, 10) : '';

  var html = '<div class="modal-title">' + esc(title) + '</div>' +
    '<form onsubmit="inventorySaveBin(event, ' + saveId + '); return false;">' +
      '<div class="grain-modal-grid">' +
        '<div class="form-group">' +
          '<label class="form-label">Location *</label>' +
          '<input class="form-input" id="invBinLocation" required value="' + escapeAttr(item ? item.location : '') + '" placeholder="e.g. Bin 3, Flat Storage North">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Commodity</label>' +
          '<select class="form-select" id="invBinCommodity">' + commOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Crop Year</label>' +
          '<select class="form-select" id="invBinCropYear">' + yearOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Total Bushels</label>' +
          '<input class="form-input" id="invBinBushels" type="number" step="1" min="0" value="' + escapeAttr(item ? item.totalBushels || '' : '') + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Date Filled</label>' +
          '<input class="form-input" id="invBinDate" type="date" value="' + escapeAttr(dateVal) + '">' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Notes</label>' +
        '<textarea class="form-input" id="invBinNotes" rows="2">' + esc(item ? item.notes || '' : '') + '</textarea>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Save Changes' : 'Add Bin') + '</button>' +
      '</div>' +
    '</form>';

  showModal(html);
}

// ---- Save Bin ----

function inventorySaveBin(e, id) {
  if (e) e.preventDefault();

  var data = {
    location: (document.getElementById('invBinLocation').value || '').trim(),
    commodity: document.getElementById('invBinCommodity').value,
    cropYear: document.getElementById('invBinCropYear').value,
    totalBushels: parseFloat(document.getElementById('invBinBushels').value) || null,
    dateFilled: document.getElementById('invBinDate').value || null,
    notes: (document.getElementById('invBinNotes').value || '').trim() || null
  };

  if (!data.location) {
    showToast('Location is required', 'error');
    return;
  }

  var promise = id
    ? updateBinInventoryDB(id, data)
    : createBinInventoryDB(data);

  promise.then(function(saved) {
    closeModal();
    if (id) {
      for (var i = 0; i < STATE.binInventory.length; i++) {
        if (STATE.binInventory[i].id === id) {
          STATE.binInventory[i] = saved;
          break;
        }
      }
      showToast('Bin updated', 'success');
    } else {
      STATE.binInventory.push(saved);
      showToast('Bin added', 'success');
    }
    renderApp();
  }).catch(function(err) {
    showToast('Error: ' + err.message, 'error');
  });
}

// ---- Delete Bin ----

function inventoryDeleteBin(id) {
  if (!confirm('Delete this bin record?')) return;

  deleteBinInventoryDB(id).then(function() {
    STATE.binInventory = STATE.binInventory.filter(function(b) { return b.id !== id; });
    showToast('Bin deleted', 'success');
    renderApp();
  }).catch(function(err) {
    showToast('Error: ' + err.message, 'error');
  });
}
