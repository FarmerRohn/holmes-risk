// ==================== HOLMES RISK — DELIVERIES PAGE ====================

// Module-level filter state
var _deliveryFilters = { commodity: 'All', status: 'All' };

// Moisture targets by commodity (standard industry targets)
var MOISTURE_TARGETS = { Corn: 15.0, Soybeans: 13.0, Wheat: 13.5, 'Heating Oil': 0 };

// ---- Main page renderer ----

function renderDeliveriesPage() {
  var cropYear = STATE.activeCropYear || STATE.settings.activeCropYear || SEASON.current;
  var deliveries = _deliveryFilterList(STATE.deliveries || [], cropYear);

  return '<div class="page-content">' +
    _deliveryRenderToolbar(cropYear) +
    _deliveryRenderSummary(deliveries) +
    _deliveryRenderTable(deliveries) +
  '</div>';
}

// ---- Toolbar ----

function _deliveryRenderToolbar(cropYear) {
  var years = ['2024', '2025', '2026', '2027'];
  var yearOpts = '';
  for (var i = 0; i < years.length; i++) {
    var sel = years[i] === cropYear ? ' selected' : '';
    yearOpts += '<option value="' + years[i] + '"' + sel + '>' + years[i] + '</option>';
  }

  // Commodity filter
  var commOpts = '<option value="All">All Commodities</option>';
  for (var ci = 0; ci < DEFAULT_COMMODITIES.length; ci++) {
    var cSel = _deliveryFilters.commodity === DEFAULT_COMMODITIES[ci] ? ' selected' : '';
    commOpts += '<option value="' + escapeAttr(DEFAULT_COMMODITIES[ci]) + '"' + cSel + '>' + esc(DEFAULT_COMMODITIES[ci]) + '</option>';
  }

  // Status filter
  var statuses = ['All', 'pending', 'settled'];
  var statusOpts = '';
  for (var si = 0; si < statuses.length; si++) {
    var sSel = _deliveryFilters.status === statuses[si] ? ' selected' : '';
    var label = statuses[si] === 'All' ? 'All Status' : statuses[si].charAt(0).toUpperCase() + statuses[si].slice(1);
    statusOpts += '<option value="' + escapeAttr(statuses[si]) + '"' + sSel + '>' + esc(label) + '</option>';
  }

  return '<div class="grain-toolbar">' +
    '<div class="grain-toolbar-filters">' +
      '<select class="form-select grain-filter-select" onchange="deliveryApplyFilter(\'cropYear\', this.value)">' + yearOpts + '</select>' +
      '<select class="form-select grain-filter-select" onchange="deliveryApplyFilter(\'commodity\', this.value)">' + commOpts + '</select>' +
      '<select class="form-select grain-filter-select" onchange="deliveryApplyFilter(\'status\', this.value)">' + statusOpts + '</select>' +
    '</div>' +
    '<button class="btn btn-primary btn-sm" onclick="deliveryOpenModal()">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
      ' Add Delivery' +
    '</button>' +
  '</div>';
}

// ---- Filter ----

function deliveryApplyFilter(key, value) {
  if (key === 'cropYear') {
    STATE.activeCropYear = value;
  } else {
    _deliveryFilters[key] = value;
  }
  renderApp();
}

function _deliveryFilterList(deliveries, cropYear) {
  var filtered = [];
  for (var i = 0; i < deliveries.length; i++) {
    var d = deliveries[i];
    // Filter by crop year
    if (d.cropYear && String(d.cropYear) !== String(cropYear)) continue;
    // Filter by commodity
    if (_deliveryFilters.commodity !== 'All' && d.commodity !== _deliveryFilters.commodity) continue;
    // Filter by status
    if (_deliveryFilters.status !== 'All' && d.settlementStatus !== _deliveryFilters.status) continue;
    filtered.push(d);
  }
  // Sort by delivery date, most recent first
  filtered.sort(function(a, b) {
    return (b.deliveryDate || '').localeCompare(a.deliveryDate || '');
  });
  return filtered;
}

// ---- Summary Stats ----

function _deliveryRenderSummary(deliveries) {
  var totalGross = 0;
  var totalNet = 0;
  var totalSettlement = 0;

  for (var i = 0; i < deliveries.length; i++) {
    var d = deliveries[i];
    var gross = parseFloat(d.grossBushels) || 0;
    var net = parseFloat(d.netBushels) || 0;
    var settlement = parseFloat(d.settlementAmount) || 0;
    totalGross += gross;
    totalNet += net;
    totalSettlement += settlement;
  }

  var totalShrink = totalGross - totalNet;

  return '<div class="stats-grid">' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + _grainFmtBushels(totalGross) + '</div>' +
      '<div class="stat-label">Gross Bushels</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + _grainFmtBushels(totalNet) + '</div>' +
      '<div class="stat-label">Net Bushels</div>' +
    '</div>' +
    '<div class="stat-card stat-red">' +
      '<div class="stat-value">' + _grainFmtBushels(totalShrink > 0 ? totalShrink : 0) + '</div>' +
      '<div class="stat-label">Total Shrink</div>' +
    '</div>' +
    '<div class="stat-card stat-green">' +
      '<div class="stat-value">' + _deliveryFmtDollars(totalSettlement) + '</div>' +
      '<div class="stat-label">Settlement</div>' +
    '</div>' +
  '</div>';
}

// ---- Deliveries Table ----

function _deliveryRenderTable(deliveries) {
  if (deliveries.length === 0) {
    return '<div class="page-placeholder" style="padding: 48px 24px;">' +
      '<p>No deliveries match the current filters</p>' +
    '</div>';
  }

  var html = '<div class="table-wrap"><table>' +
    '<thead><tr>' +
      '<th>Date</th>' +
      '<th>Commodity</th>' +
      '<th>Buyer</th>' +
      '<th>Ticket #</th>' +
      '<th style="text-align:right">Gross Bu</th>' +
      '<th style="text-align:right">Moisture %</th>' +
      '<th style="text-align:right">Net Bu</th>' +
      '<th style="text-align:right">Shrink</th>' +
      '<th>Contract</th>' +
      '<th style="text-align:right">Settlement</th>' +
      '<th>Status</th>' +
      '<th>Actions</th>' +
    '</tr></thead>' +
    '<tbody>';

  for (var i = 0; i < deliveries.length; i++) {
    var d = deliveries[i];
    var color = COMMODITY_COLORS[d.commodity] || 'var(--text)';
    var gross = parseFloat(d.grossBushels) || 0;
    var net = parseFloat(d.netBushels) || 0;
    var shrink = gross - net;
    var contractInfo = _deliveryGetContractInfo(d.contractId);
    var statusClass = d.settlementStatus === 'settled' ? 'delivery-status-settled' : 'delivery-status-pending';

    html += '<tr class="delivery-row">' +
      '<td>' + esc(d.deliveryDate || '') + '</td>' +
      '<td>' +
        '<span class="grain-commodity-dot" style="background:' + color + '"></span> ' +
        esc(d.commodity) +
      '</td>' +
      '<td>' + esc(d.buyerName || '') + '</td>' +
      '<td>' + esc(d.ticketNumber || '') + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtBushels(d.grossBushels) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + (d.moisture != null ? esc(parseFloat(d.moisture).toFixed(1)) : '\u2014') + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtBushels(d.netBushels) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono);color:var(--red)">' + (shrink > 0 ? _grainFmtBushels(shrink) : '\u2014') + '</td>' +
      '<td>' + (contractInfo ? esc(contractInfo) : '<span style="color:var(--text3)">\u2014</span>') + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _deliveryFmtDollars(d.settlementAmount) + '</td>' +
      '<td><span class="delivery-status ' + statusClass + '">' + esc(d.settlementStatus || 'pending') + '</span></td>' +
      '<td class="grain-actions">' +
        '<button class="btn btn-secondary btn-sm" onclick="deliveryOpenModal(\'' + escapeAttr(d.id) + '\')">Edit</button> ' +
        '<button class="btn btn-danger btn-sm" onclick="deliveryDelete(\'' + escapeAttr(d.id) + '\')">Delete</button>' +
      '</td>' +
    '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

// ---- Contract info helper ----

function _deliveryGetContractInfo(contractId) {
  if (!contractId) return null;
  var contracts = STATE.contracts || [];
  for (var i = 0; i < contracts.length; i++) {
    var c = contracts[i];
    if (c.id === contractId) {
      return c.contractType + ' \u2014 ' + (c.buyerName || '?') + ' \u2014 ' + _grainFmtBushels(c.bushels) + ' bu';
    }
  }
  return 'Linked';
}

// ---- Delivery Modal ----

function deliveryOpenModal(id) {
  var delivery = null;
  var isEdit = false;

  if (id) {
    var deliveries = STATE.deliveries || [];
    for (var i = 0; i < deliveries.length; i++) {
      if (deliveries[i].id === id) {
        delivery = deliveries[i];
        break;
      }
    }
    if (!delivery) { showToast('Delivery not found', 'error'); return; }
    isEdit = true;
  }

  var title = isEdit ? 'Edit Delivery' : 'Add Delivery';
  var d = delivery || {};

  // Today's date default
  var now = new Date();
  var todayStr = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  // Commodity options
  var commOpts = '';
  for (var ci = 0; ci < DEFAULT_COMMODITIES.length; ci++) {
    var cSel = d.commodity === DEFAULT_COMMODITIES[ci] ? ' selected' : '';
    commOpts += '<option value="' + escapeAttr(DEFAULT_COMMODITIES[ci]) + '"' + cSel + '>' + esc(DEFAULT_COMMODITIES[ci]) + '</option>';
  }

  // Crop year options
  var cropYear = d.cropYear || STATE.activeCropYear || STATE.settings.activeCropYear || SEASON.current;
  var years = ['2024', '2025', '2026', '2027'];
  var yearOpts = '';
  for (var yi = 0; yi < years.length; yi++) {
    var ySel = String(cropYear) === years[yi] ? ' selected' : '';
    yearOpts += '<option value="' + years[yi] + '"' + ySel + '>' + years[yi] + '</option>';
  }

  // Settlement status options
  var settlementStatuses = ['pending', 'settled'];
  var ssOpts = '';
  var defaultSS = d.settlementStatus || 'pending';
  for (var ssi = 0; ssi < settlementStatuses.length; ssi++) {
    var ssSel = defaultSS === settlementStatuses[ssi] ? ' selected' : '';
    var ssLabel = settlementStatuses[ssi].charAt(0).toUpperCase() + settlementStatuses[ssi].slice(1);
    ssOpts += '<option value="' + escapeAttr(settlementStatuses[ssi]) + '"' + ssSel + '>' + esc(ssLabel) + '</option>';
  }

  // Source options
  var sources = ['manual', 'toro'];
  var srcOpts = '';
  var defaultSrc = d.source || 'manual';
  for (var sri = 0; sri < sources.length; sri++) {
    var srSel = defaultSrc === sources[sri] ? ' selected' : '';
    srcOpts += '<option value="' + escapeAttr(sources[sri]) + '"' + srSel + '>' + esc(sources[sri]) + '</option>';
  }

  // Build contract dropdown for current commodity
  var selectedCommodity = d.commodity || DEFAULT_COMMODITIES[0];
  var contractOpts = _deliveryBuildContractOptions(selectedCommodity, d.contractId);

  // Elevator datalist
  var elevatorDatalist = _grainBuildElevatorDatalist();

  var formAction = 'deliverySave(event, ' + (id ? '\'' + escapeAttr(id) + '\'' : 'null') + ')';

  var html = '<h2 class="modal-title">' + esc(title) + '</h2>' +
    '<form id="deliveryForm" onsubmit="' + escapeAttr(formAction) + '">' +
      '<div class="grain-modal-grid">' +
        '<div class="form-group">' +
          '<label class="form-label">Commodity</label>' +
          '<select class="form-select" id="ddCommodity" onchange="deliveryOnCommodityChange()">' + commOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Crop Year</label>' +
          '<select class="form-select" id="ddCropYear">' + yearOpts + '</select>' +
        '</div>' +

        '<div class="form-group">' +
          '<label class="form-label">Buyer / Elevator</label>' +
          '<input type="text" class="form-input" id="ddBuyerName" list="ddElevatorList" ' +
            'value="' + escapeAttr(d.buyerName || '') + '" placeholder="Select or type elevator">' +
          '<datalist id="ddElevatorList">' + elevatorDatalist + '</datalist>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Ticket Number</label>' +
          '<input type="text" class="form-input" id="ddTicketNumber" ' +
            'value="' + escapeAttr(d.ticketNumber || '') + '" placeholder="Scale ticket #">' +
        '</div>' +

        '<div class="form-group">' +
          '<label class="form-label">Delivery Date</label>' +
          '<input type="date" class="form-input" id="ddDeliveryDate" ' +
            'value="' + escapeAttr(d.deliveryDate || todayStr) + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Gross Bushels</label>' +
          '<input type="number" class="form-input" id="ddGrossBushels" step="1" min="0" required ' +
            'value="' + escapeAttr(d.grossBushels != null ? String(d.grossBushels) : '') + '" ' +
            'placeholder="0" oninput="deliveryCalcShrink()">' +
        '</div>' +

        '<div class="form-group">' +
          '<label class="form-label">Moisture %</label>' +
          '<input type="number" class="form-input" id="ddMoisture" step="0.1" min="0" ' +
            'value="' + escapeAttr(d.moisture != null ? String(d.moisture) : '') + '" ' +
            'placeholder="0.0" oninput="deliveryCalcShrink()">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Test Weight</label>' +
          '<input type="number" class="form-input" id="ddTestWeight" step="0.1" min="0" ' +
            'value="' + escapeAttr(d.testWeight != null ? String(d.testWeight) : '') + '" ' +
            'placeholder="0.0">' +
        '</div>' +

        '<div class="form-group" style="grid-column: 1 / -1">' +
          '<label class="form-label">Net Bushels</label>' +
          '<input type="number" class="form-input" id="ddNetBushels" step="1" min="0" ' +
            'value="' + escapeAttr(d.netBushels != null ? String(d.netBushels) : '') + '" ' +
            'placeholder="Auto-calculated from moisture">' +
          '<div id="ddShrinkPreview" class="delivery-shrink-preview"></div>' +
        '</div>' +

        '<div class="form-group">' +
          '<label class="form-label">Contract</label>' +
          '<select class="form-select" id="ddContractId" onchange="deliveryOnContractChange()">' + contractOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Settlement Amount ($)</label>' +
          '<input type="number" class="form-input" id="ddSettlementAmount" step="0.01" min="0" ' +
            'value="' + escapeAttr(d.settlementAmount != null ? String(d.settlementAmount) : '') + '" ' +
            'placeholder="0.00">' +
        '</div>' +

        '<div class="form-group">' +
          '<label class="form-label">Settlement Status</label>' +
          '<select class="form-select" id="ddSettlementStatus">' + ssOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Source</label>' +
          '<select class="form-select" id="ddSource">' + srcOpts + '</select>' +
        '</div>' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label">Notes</label>' +
        '<textarea class="form-input" id="ddNotes" rows="3">' + esc(d.notes || '') + '</textarea>' +
      '</div>' +

      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Save Changes' : 'Add Delivery') + '</button>' +
      '</div>' +
    '</form>';

  showModal(html);

  // Run initial shrink calculation if editing
  if (isEdit) {
    deliveryCalcShrink();
  }
}

// ---- Moisture Shrink Calculator ----

function deliveryCalcShrink() {
  var grossEl = document.getElementById('ddGrossBushels');
  var moistureEl = document.getElementById('ddMoisture');
  var netEl = document.getElementById('ddNetBushels');
  var previewEl = document.getElementById('ddShrinkPreview');
  if (!grossEl || !moistureEl || !netEl || !previewEl) return;

  var gross = parseFloat(grossEl.value);
  var moisture = parseFloat(moistureEl.value);

  if (isNaN(gross) || gross <= 0) {
    previewEl.innerHTML = '';
    return;
  }

  var commodity = document.getElementById('ddCommodity').value;
  var target = MOISTURE_TARGETS[commodity];

  if (target == null || target === 0 || isNaN(moisture)) {
    previewEl.innerHTML = '';
    // If no moisture entered, net = gross
    if (isNaN(moisture) && netEl.value === '') {
      netEl.value = Math.round(gross);
    }
    return;
  }

  if (moisture > target) {
    var pointsOver = moisture - target;
    var shrinkBu = pointsOver * 0.01183 * 1.12 * gross;
    var netBushels = gross - shrinkBu;
    var shrinkPct = (shrinkBu / gross * 100).toFixed(2);

    netEl.value = Math.round(netBushels);
    previewEl.innerHTML = '<span style="color:var(--red)">Shrink: ' +
      _grainFmtBushels(Math.round(shrinkBu)) + ' bu (' +
      esc(pointsOver.toFixed(1)) + '% over ' + esc(target.toFixed(1)) + '% target, ' +
      esc(shrinkPct) + '% shrink)</span>';
  } else {
    netEl.value = Math.round(gross);
    previewEl.innerHTML = '<span style="color:var(--green)">No shrink (moisture at or below ' + esc(target.toFixed(1)) + '% target)</span>';
  }
}

// ---- Contract dropdown helpers ----

function _deliveryBuildContractOptions(commodity, selectedContractId) {
  var html = '<option value="">-- No contract --</option>';
  var contracts = STATE.contracts || [];
  for (var i = 0; i < contracts.length; i++) {
    var c = contracts[i];
    if (c.status !== 'Open' || c.commodity !== commodity) continue;
    var sel = (selectedContractId && c.id === selectedContractId) ? ' selected' : '';
    var label = (c.contractType || '?') + ' \u2014 ' + (c.buyerName || '?') + ' \u2014 ' + _grainFmtBushels(c.bushels) + ' bu';
    html += '<option value="' + escapeAttr(c.id) + '"' + sel + '>' + esc(label) + '</option>';
  }
  return html;
}

function deliveryOnCommodityChange() {
  var commodity = document.getElementById('ddCommodity').value;
  var contractSelect = document.getElementById('ddContractId');
  if (contractSelect) {
    contractSelect.innerHTML = _deliveryBuildContractOptions(commodity, null);
  }
  // Recalculate shrink since target moisture may differ
  deliveryCalcShrink();
}

function deliveryOnContractChange() {
  var contractId = document.getElementById('ddContractId').value;
  var buyerEl = document.getElementById('ddBuyerName');
  if (!contractId || !buyerEl) return;

  // Auto-fill buyer from contract if buyer field is empty
  if (buyerEl.value.trim() === '') {
    var contracts = STATE.contracts || [];
    for (var i = 0; i < contracts.length; i++) {
      if (contracts[i].id === contractId && contracts[i].buyerName) {
        buyerEl.value = contracts[i].buyerName;
        break;
      }
    }
  }
}

// ---- Save handler ----

function deliverySave(e, id) {
  e.preventDefault();

  var data = {
    commodity: document.getElementById('ddCommodity').value,
    cropYear: document.getElementById('ddCropYear').value,
    contractId: document.getElementById('ddContractId').value || null,
    buyerName: document.getElementById('ddBuyerName').value.trim() || null,
    ticketNumber: document.getElementById('ddTicketNumber').value.trim() || null,
    grossBushels: _grainParseNum(document.getElementById('ddGrossBushels').value),
    netBushels: _grainParseNum(document.getElementById('ddNetBushels').value),
    moisture: _grainParseNum(document.getElementById('ddMoisture').value),
    testWeight: _grainParseNum(document.getElementById('ddTestWeight').value),
    deliveryDate: document.getElementById('ddDeliveryDate').value || null,
    settlementAmount: _grainParseNum(document.getElementById('ddSettlementAmount').value),
    settlementStatus: document.getElementById('ddSettlementStatus').value,
    source: document.getElementById('ddSource').value || 'manual',
    notes: document.getElementById('ddNotes').value.trim() || null
  };

  if (!data.grossBushels || data.grossBushels <= 0) {
    showToast('Gross bushels is required', 'error');
    return;
  }

  if (id) {
    // Edit
    updateRiskDeliveryDB(id, data)
      .then(function(updated) {
        for (var i = 0; i < STATE.deliveries.length; i++) {
          if (STATE.deliveries[i].id === id) {
            STATE.deliveries[i] = updated;
            break;
          }
        }
        closeModal();
        renderApp();
        showToast('Delivery updated', 'success');
      })
      .catch(function(err) {
        showToast('Failed to update: ' + err.message, 'error');
      });
  } else {
    // Create
    createRiskDeliveryDB(data)
      .then(function(created) {
        STATE.deliveries.push(created);
        closeModal();
        renderApp();
        showToast('Delivery created', 'success');
      })
      .catch(function(err) {
        showToast('Failed to create: ' + err.message, 'error');
      });
  }
}

// ---- Delete handler ----

function deliveryDelete(id) {
  if (!confirm('Delete this delivery? This cannot be undone.')) return;

  deleteRiskDeliveryDB(id)
    .then(function() {
      STATE.deliveries = STATE.deliveries.filter(function(d) { return d.id !== id; });
      renderApp();
      showToast('Delivery deleted', 'success');
    })
    .catch(function(err) {
      showToast('Failed to delete: ' + err.message, 'error');
    });
}

// ---- Formatting helpers ----

function _deliveryFmtDollars(n) {
  if (n == null) return '\u2014';
  var num = parseFloat(n);
  if (isNaN(num)) return '\u2014';
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
