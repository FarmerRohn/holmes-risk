// ==================== HOLMES RISK — GRAIN PAGE ====================

// Module-level filter state
var _grainFilters = {
  commodity: 'All',
  type: 'All',
  status: 'All',
  grouping: 'None'
};

// Track which contract rows are expanded
var _grainExpandedRows = {};

// ---- Main page renderer ----

function renderGrainPage() {
  var cropYear = STATE.activeCropYear || STATE.settings.activeCropYear || SEASON.current;
  var contracts = _grainFilterContracts(STATE.contracts || [], cropYear);

  return '<div class="page-content">' +
    _grainRenderToolbar(cropYear) +
    _grainRenderContractList(contracts) +
  '</div>';
}

// ---- Toolbar ----

function _grainRenderToolbar(cropYear) {
  var years = ['2024', '2025', '2026', '2027'];
  var yearOpts = '';
  for (var i = 0; i < years.length; i++) {
    var sel = years[i] === cropYear ? ' selected' : '';
    yearOpts += '<option value="' + years[i] + '"' + sel + '>' + years[i] + '</option>';
  }

  // Commodity filter
  var commOpts = '<option value="All">All Commodities</option>';
  for (var ci = 0; ci < DEFAULT_COMMODITIES.length; ci++) {
    var cSel = _grainFilters.commodity === DEFAULT_COMMODITIES[ci] ? ' selected' : '';
    commOpts += '<option value="' + escapeAttr(DEFAULT_COMMODITIES[ci]) + '"' + cSel + '>' + esc(DEFAULT_COMMODITIES[ci]) + '</option>';
  }

  // Type filter
  var typeOpts = '<option value="All">All Types</option>';
  for (var ti = 0; ti < CONTRACT_TYPES.length; ti++) {
    var tSel = _grainFilters.type === CONTRACT_TYPES[ti] ? ' selected' : '';
    typeOpts += '<option value="' + escapeAttr(CONTRACT_TYPES[ti]) + '"' + tSel + '>' + esc(CONTRACT_TYPES[ti]) + '</option>';
  }

  // Status filter
  var statOpts = '<option value="All">All Statuses</option>';
  for (var si = 0; si < CONTRACT_STATUS.length; si++) {
    var sSel = _grainFilters.status === CONTRACT_STATUS[si] ? ' selected' : '';
    statOpts += '<option value="' + escapeAttr(CONTRACT_STATUS[si]) + '"' + sSel + '>' + esc(CONTRACT_STATUS[si]) + '</option>';
  }

  // Grouping dropdown
  var groupings = ['None', 'Commodity', 'Type', 'Elevator', 'Strategy'];
  var groupOpts = '';
  for (var gi = 0; gi < groupings.length; gi++) {
    var gSel = _grainFilters.grouping === groupings[gi] ? ' selected' : '';
    groupOpts += '<option value="' + groupings[gi] + '"' + gSel + '>' + groupings[gi] + '</option>';
  }

  return '<div class="grain-toolbar">' +
    '<div class="grain-toolbar-filters">' +
      '<select class="form-select grain-filter-select" onchange="grainApplyFilter(\'cropYear\', this.value)">' + yearOpts + '</select>' +
      '<select class="form-select grain-filter-select" onchange="grainApplyFilter(\'commodity\', this.value)">' + commOpts + '</select>' +
      '<select class="form-select grain-filter-select" onchange="grainApplyFilter(\'type\', this.value)">' + typeOpts + '</select>' +
      '<select class="form-select grain-filter-select" onchange="grainApplyFilter(\'status\', this.value)">' + statOpts + '</select>' +
      '<select class="form-select grain-filter-select" onchange="grainApplyFilter(\'grouping\', this.value)">' + groupOpts + '</select>' +
    '</div>' +
    '<button class="btn btn-primary btn-sm" onclick="grainOpenContractModal()">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
      ' Add Contract' +
    '</button>' +
  '</div>';
}

// ---- Filter logic ----

function grainApplyFilter(key, value) {
  if (key === 'cropYear') {
    STATE.activeCropYear = value;
    // Also persist to settings
    upsertRiskSettingDB('activeCropYear', value)
      .then(function() { STATE.settings.activeCropYear = value; })
      .catch(function() {});
  } else {
    _grainFilters[key] = value;
  }
  renderApp();
}

function _grainFilterContracts(contracts, cropYear) {
  var filtered = [];
  for (var i = 0; i < contracts.length; i++) {
    var c = contracts[i];
    // Filter by crop year
    if (c.cropYear && String(c.cropYear) !== String(cropYear)) continue;
    // Filter by commodity
    if (_grainFilters.commodity !== 'All' && c.commodity !== _grainFilters.commodity) continue;
    // Filter by type
    if (_grainFilters.type !== 'All' && c.contractType !== _grainFilters.type) continue;
    // Filter by status
    if (_grainFilters.status !== 'All' && c.status !== _grainFilters.status) continue;
    filtered.push(c);
  }
  return filtered;
}

// ---- Contract list (table or grouped) ----

function _grainRenderContractList(contracts) {
  if (contracts.length === 0) {
    return '<div class="page-placeholder" style="padding: 48px 24px;">' +
      '<p>No contracts match the current filters</p>' +
    '</div>';
  }

  if (_grainFilters.grouping === 'None') {
    return _grainRenderTable(contracts);
  }

  // Grouped view
  var groups = _grainGroupContracts(contracts, _grainFilters.grouping);
  var keys = Object.keys(groups);
  var html = '';
  for (var i = 0; i < keys.length; i++) {
    var groupName = keys[i];
    var groupContracts = groups[groupName];
    var totalBu = 0;
    for (var j = 0; j < groupContracts.length; j++) {
      totalBu += groupContracts[j].bushels ? parseFloat(groupContracts[j].bushels) : 0;
    }
    html += '<div class="grain-group">' +
      '<div class="grain-group-header">' +
        '<span class="grain-group-name">' + esc(groupName || 'Unspecified') + '</span>' +
        '<span class="grain-group-summary">' + groupContracts.length + ' contract' + (groupContracts.length !== 1 ? 's' : '') +
          ' &middot; ' + _grainFmtBushels(totalBu) + ' bu</span>' +
      '</div>' +
      _grainRenderTable(groupContracts) +
    '</div>';
  }
  return html;
}

function _grainGroupContracts(contracts, groupBy) {
  var groups = {};
  for (var i = 0; i < contracts.length; i++) {
    var c = contracts[i];
    var key;
    switch (groupBy) {
      case 'Commodity': key = c.commodity || ''; break;
      case 'Type': key = c.contractType || ''; break;
      case 'Elevator': key = c.buyerName || ''; break;
      case 'Strategy': key = c.strategy || ''; break;
      default: key = '';
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }
  return groups;
}

// ---- Contract table ----

function _grainRenderTable(contracts) {
  var html = '<div class="table-wrap"><table>' +
    '<thead><tr>' +
      '<th>Commodity</th>' +
      '<th>Type</th>' +
      '<th style="text-align:right">Bushels</th>' +
      '<th style="text-align:right">Price</th>' +
      '<th style="text-align:right">Basis</th>' +
      '<th>Futures Mo</th>' +
      '<th>Buyer</th>' +
      '<th>Status</th>' +
      '<th>Actions</th>' +
    '</tr></thead>' +
    '<tbody>';

  for (var i = 0; i < contracts.length; i++) {
    var c = contracts[i];
    var id = c.id;
    var color = COMMODITY_COLORS[c.commodity] || 'var(--text)';
    var latestQuote = getLatestFuturesPrice(c.commodity, STATE.marketPrices);
    var effPrice = calcEffectivePrice(c, latestQuote);
    var statusClass = _grainStatusClass(c.status);
    var isExpanded = _grainExpandedRows[id];

    html += '<tr class="grain-row" onclick="grainToggleRow(\'' + escapeAttr(id) + '\')" style="cursor:pointer">' +
      '<td>' +
        '<span class="grain-commodity-dot" style="background:' + color + '"></span> ' +
        esc(c.commodity) +
      '</td>' +
      '<td>' + esc(c.contractType) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtBushels(c.bushels) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(effPrice) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(c.basisLevel) + '</td>' +
      '<td>' + esc(c.futuresMonth || '') + '</td>' +
      '<td>' + esc(c.buyerName || '') + '</td>' +
      '<td><span class="grain-status ' + statusClass + '">' + esc(c.status) + '</span></td>' +
      '<td class="grain-actions" onclick="event.stopPropagation()">' +
        '<button class="btn btn-secondary btn-sm" onclick="grainOpenContractModal(\'' + escapeAttr(id) + '\')">Edit</button> ' +
        '<button class="btn btn-danger btn-sm" onclick="grainDeleteContract(\'' + escapeAttr(id) + '\')">Delete</button>' +
      '</td>' +
    '</tr>';

    // Expanded detail row
    if (isExpanded) {
      html += '<tr class="grain-detail-row"><td colspan="9">' +
        _grainRenderDetailPanel(c) +
      '</td></tr>';
    }
  }

  html += '</tbody></table></div>';
  return html;
}

function _grainRenderDetailPanel(c) {
  var parts = [];
  if (c.contractNumber) parts.push('<strong>Contract #:</strong> ' + esc(c.contractNumber));
  if (c.strategy) parts.push('<strong>Strategy:</strong> ' + esc(c.strategy));
  if (c.company) parts.push('<strong>Company:</strong> ' + esc(c.company));
  if (c.account) parts.push('<strong>Account:</strong> ' + esc(c.account));
  if (c.deliveryDate) parts.push('<strong>Delivery:</strong> ' + esc(c.deliveryDate) + (c.deliveryDateEnd ? ' to ' + esc(c.deliveryDateEnd) : ''));
  if (c.cashPrice != null) parts.push('<strong>Cash Price:</strong> ' + _grainFmtPrice(c.cashPrice));
  if (c.futuresPrice != null) parts.push('<strong>Futures Price:</strong> ' + _grainFmtPrice(c.futuresPrice));
  if (c.bushelsDelivered != null && parseFloat(c.bushelsDelivered) > 0) parts.push('<strong>Delivered:</strong> ' + _grainFmtBushels(c.bushelsDelivered) + ' bu');
  if (c.strikePrice != null) parts.push('<strong>Strike:</strong> ' + _grainFmtPrice(c.strikePrice));
  if (c.premium != null) parts.push('<strong>Premium:</strong> ' + _grainFmtPrice(c.premium));
  if (c.rollCount != null && parseInt(c.rollCount) > 0) parts.push('<strong>Roll Count:</strong> ' + esc(c.rollCount));
  if (c.notes) parts.push('<strong>Notes:</strong> ' + esc(c.notes));

  if (parts.length === 0) {
    return '<div class="grain-detail-inner"><span style="color:var(--text3)">No additional details</span></div>';
  }

  return '<div class="grain-detail-inner">' + parts.join('<span class="grain-detail-sep">&middot;</span>') + '</div>';
}

function _grainStatusClass(status) {
  switch (status) {
    case 'Open': return 'grain-status-open';
    case 'Delivered': return 'grain-status-delivered';
    case 'Cancelled': return 'grain-status-cancelled';
    case 'Split': return 'grain-status-split';
    default: return '';
  }
}

// ---- Row expand/collapse ----

function grainToggleRow(id) {
  if (_grainExpandedRows[id]) {
    delete _grainExpandedRows[id];
  } else {
    _grainExpandedRows[id] = true;
  }
  renderApp();
}

// ---- Contract Modal ----

function grainOpenContractModal(id) {
  var contract = null;
  var isEdit = false;

  if (id) {
    for (var i = 0; i < STATE.contracts.length; i++) {
      if (STATE.contracts[i].id === id) {
        contract = STATE.contracts[i];
        break;
      }
    }
    if (!contract) { showToast('Contract not found', 'error'); return; }
    isEdit = true;
  }

  var title = isEdit ? 'Edit Contract' : 'Add Contract';
  var c = contract || {};

  // Commodity options
  var commOpts = '';
  for (var ci = 0; ci < DEFAULT_COMMODITIES.length; ci++) {
    var cSel = c.commodity === DEFAULT_COMMODITIES[ci] ? ' selected' : '';
    commOpts += '<option value="' + escapeAttr(DEFAULT_COMMODITIES[ci]) + '"' + cSel + '>' + esc(DEFAULT_COMMODITIES[ci]) + '</option>';
  }

  // Contract type options
  var typeOpts = '';
  for (var ti = 0; ti < CONTRACT_TYPES.length; ti++) {
    var tSel = c.contractType === CONTRACT_TYPES[ti] ? ' selected' : '';
    typeOpts += '<option value="' + escapeAttr(CONTRACT_TYPES[ti]) + '"' + tSel + '>' + esc(CONTRACT_TYPES[ti]) + '</option>';
  }

  // Crop year options
  var yearOpts = '';
  var years = ['2024', '2025', '2026', '2027'];
  var defaultYear = c.cropYear ? String(c.cropYear) : (STATE.activeCropYear || SEASON.current);
  for (var yi = 0; yi < years.length; yi++) {
    var ySel = years[yi] === defaultYear ? ' selected' : '';
    yearOpts += '<option value="' + years[yi] + '"' + ySel + '>' + years[yi] + '</option>';
  }

  // Status options
  var statOpts = '';
  var defaultStatus = c.status || 'Open';
  for (var si = 0; si < CONTRACT_STATUS.length; si++) {
    var sSel = CONTRACT_STATUS[si] === defaultStatus ? ' selected' : '';
    statOpts += '<option value="' + escapeAttr(CONTRACT_STATUS[si]) + '"' + sSel + '>' + esc(CONTRACT_STATUS[si]) + '</option>';
  }

  // Futures month options
  var fmOpts = _grainBuildFuturesMonthOptions(c.futuresMonth || '');

  // Elevators datalist
  var elevatorOptions = _grainBuildElevatorDatalist();

  // Strategies datalist — built from existing contracts
  var strategyOptions = _grainBuildUniqueDatalist(STATE.contracts, 'strategy');
  var companyOptions = _grainBuildUniqueDatalist(STATE.contracts, 'company');
  var accountOptions = _grainBuildUniqueDatalist(STATE.contracts, 'account');

  // Determine initial visibility based on contract type
  var cType = c.contractType || 'HTA';
  var showCash = cType === 'Cash';
  var showFutures = cType === 'HTA';
  var showBasis = cType === 'HTA' || cType === 'Basis';
  var showFutMo = cType === 'HTA' || cType === 'Basis';

  var html = '<h2 class="modal-title">' + esc(title) + '</h2>' +
    '<form id="grainContractForm" onsubmit="grainSaveContract(event, ' + (id ? '\'' + escapeAttr(id) + '\'' : 'null') + ')">' +
      '<div class="grain-modal-grid">' +
        // Row 1: Commodity + Type
        '<div class="form-group">' +
          '<label class="form-label">Commodity</label>' +
          '<select class="form-select" id="gcCommodity">' + commOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Contract Type</label>' +
          '<select class="form-select" id="gcContractType" onchange="grainOnTypeChange(this.value)">' + typeOpts + '</select>' +
        '</div>' +

        // Row 2: Crop Year + Bushels
        '<div class="form-group">' +
          '<label class="form-label">Crop Year</label>' +
          '<select class="form-select" id="gcCropYear">' + yearOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Bushels</label>' +
          '<input type="number" class="form-input" id="gcBushels" min="0" step="1" value="' + escapeAttr(c.bushels != null ? String(c.bushels) : '') + '" required>' +
        '</div>' +

        // Row 3: Cash Price (conditional)
        '<div class="form-group grain-field-cash" id="gcCashPriceGroup" style="' + (showCash ? '' : 'display:none') + '">' +
          '<label class="form-label">Cash Price</label>' +
          '<input type="number" class="form-input" id="gcCashPrice" step="0.0001" value="' + escapeAttr(c.cashPrice != null ? String(c.cashPrice) : '') + '">' +
        '</div>' +

        // Futures Price (conditional)
        '<div class="form-group grain-field-futures" id="gcFuturesPriceGroup" style="' + (showFutures ? '' : 'display:none') + '">' +
          '<label class="form-label">Futures Price</label>' +
          '<input type="number" class="form-input" id="gcFuturesPrice" step="0.0001" value="' + escapeAttr(c.futuresPrice != null ? String(c.futuresPrice) : '') + '">' +
        '</div>' +

        // Basis Level (conditional)
        '<div class="form-group grain-field-basis" id="gcBasisLevelGroup" style="' + (showBasis ? '' : 'display:none') + '">' +
          '<label class="form-label">Basis Level</label>' +
          '<input type="number" class="form-input" id="gcBasisLevel" step="0.0001" value="' + escapeAttr(c.basisLevel != null ? String(c.basisLevel) : '') + '">' +
        '</div>' +

        // Futures Month (conditional)
        '<div class="form-group grain-field-futmo" id="gcFuturesMonthGroup" style="' + (showFutMo ? '' : 'display:none') + '">' +
          '<label class="form-label">Futures Month</label>' +
          '<select class="form-select" id="gcFuturesMonth">' + fmOpts + '</select>' +
        '</div>' +

        // Delivery dates
        '<div class="form-group">' +
          '<label class="form-label">Delivery Start</label>' +
          '<input type="date" class="form-input" id="gcDeliveryDate" value="' + escapeAttr(c.deliveryDate || '') + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Delivery End</label>' +
          '<input type="date" class="form-input" id="gcDeliveryDateEnd" value="' + escapeAttr(c.deliveryDateEnd || '') + '">' +
        '</div>' +

        // Buyer + Contract #
        '<div class="form-group">' +
          '<label class="form-label">Buyer / Elevator</label>' +
          '<input type="text" class="form-input" id="gcBuyerName" list="gcElevatorList" value="' + escapeAttr(c.buyerName || '') + '">' +
          '<datalist id="gcElevatorList">' + elevatorOptions + '</datalist>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Contract #</label>' +
          '<input type="text" class="form-input" id="gcContractNumber" value="' + escapeAttr(c.contractNumber || '') + '">' +
        '</div>' +

        // Strategy + Company
        '<div class="form-group">' +
          '<label class="form-label">Strategy</label>' +
          '<input type="text" class="form-input" id="gcStrategy" list="gcStrategyList" value="' + escapeAttr(c.strategy || '') + '">' +
          '<datalist id="gcStrategyList">' + strategyOptions + '</datalist>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Company</label>' +
          '<input type="text" class="form-input" id="gcCompany" list="gcCompanyList" value="' + escapeAttr(c.company || '') + '">' +
          '<datalist id="gcCompanyList">' + companyOptions + '</datalist>' +
        '</div>' +

        // Account + Status
        '<div class="form-group">' +
          '<label class="form-label">Account</label>' +
          '<input type="text" class="form-input" id="gcAccount" list="gcAccountList" value="' + escapeAttr(c.account || '') + '">' +
          '<datalist id="gcAccountList">' + accountOptions + '</datalist>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Status</label>' +
          '<select class="form-select" id="gcStatus">' + statOpts + '</select>' +
        '</div>' +
      '</div>' +

      // Notes (full width)
      '<div class="form-group">' +
        '<label class="form-label">Notes</label>' +
        '<textarea class="form-input" id="gcNotes" rows="3">' + esc(c.notes || '') + '</textarea>' +
      '</div>' +

      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Save Changes' : 'Create Contract') + '</button>' +
      '</div>' +
    '</form>';

  showModal(html);
}

// ---- Type change handler (toggle field visibility) ----

function grainOnTypeChange(type) {
  var cashGroup = document.getElementById('gcCashPriceGroup');
  var futuresGroup = document.getElementById('gcFuturesPriceGroup');
  var basisGroup = document.getElementById('gcBasisLevelGroup');
  var futMoGroup = document.getElementById('gcFuturesMonthGroup');

  if (!cashGroup || !futuresGroup || !basisGroup || !futMoGroup) return;

  // Reset all to hidden
  cashGroup.style.display = 'none';
  futuresGroup.style.display = 'none';
  basisGroup.style.display = 'none';
  futMoGroup.style.display = 'none';

  switch (type) {
    case 'Cash':
      cashGroup.style.display = '';
      break;
    case 'HTA':
      futuresGroup.style.display = '';
      basisGroup.style.display = '';
      futMoGroup.style.display = '';
      break;
    case 'Basis':
      basisGroup.style.display = '';
      futMoGroup.style.display = '';
      break;
    // DP and Bushels Only: all price fields hidden
  }
}

// ---- Save handler ----

function grainSaveContract(e, id) {
  e.preventDefault();

  var data = {
    commodity: document.getElementById('gcCommodity').value,
    cropYear: document.getElementById('gcCropYear').value,
    contractType: document.getElementById('gcContractType').value,
    status: document.getElementById('gcStatus').value,
    bushels: _grainParseNum(document.getElementById('gcBushels').value),
    cashPrice: _grainParseNum(document.getElementById('gcCashPrice').value),
    futuresPrice: _grainParseNum(document.getElementById('gcFuturesPrice').value),
    basisLevel: _grainParseNum(document.getElementById('gcBasisLevel').value),
    futuresMonth: document.getElementById('gcFuturesMonth').value || null,
    deliveryDate: document.getElementById('gcDeliveryDate').value || null,
    deliveryDateEnd: document.getElementById('gcDeliveryDateEnd').value || null,
    buyerName: document.getElementById('gcBuyerName').value.trim() || null,
    contractNumber: document.getElementById('gcContractNumber').value.trim() || null,
    strategy: document.getElementById('gcStrategy').value.trim() || null,
    company: document.getElementById('gcCompany').value.trim() || null,
    account: document.getElementById('gcAccount').value.trim() || null,
    notes: document.getElementById('gcNotes').value.trim() || null
  };

  if (!data.bushels || data.bushels <= 0) {
    showToast('Bushels is required', 'error');
    return;
  }

  if (id) {
    // Edit
    updateRiskContractDB(id, data)
      .then(function(updated) {
        for (var i = 0; i < STATE.contracts.length; i++) {
          if (STATE.contracts[i].id === id) {
            STATE.contracts[i] = updated;
            break;
          }
        }
        closeModal();
        renderApp();
        showToast('Contract updated', 'success');
      })
      .catch(function(err) {
        showToast('Failed to update: ' + err.message, 'error');
      });
  } else {
    // Create
    createRiskContractDB(data)
      .then(function(created) {
        STATE.contracts.push(created);
        closeModal();
        renderApp();
        showToast('Contract created', 'success');
      })
      .catch(function(err) {
        showToast('Failed to create: ' + err.message, 'error');
      });
  }
}

// ---- Delete handler ----

function grainDeleteContract(id) {
  if (!confirm('Delete this contract? This cannot be undone.')) return;

  deleteRiskContractDB(id)
    .then(function() {
      STATE.contracts = STATE.contracts.filter(function(c) { return c.id !== id; });
      delete _grainExpandedRows[id];
      renderApp();
      showToast('Contract deleted', 'success');
    })
    .catch(function(err) {
      showToast('Failed to delete: ' + err.message, 'error');
    });
}

// ---- Helper functions ----

function _grainFmtBushels(n) {
  if (n == null) return '\u2014';
  var num = parseFloat(n);
  if (isNaN(num)) return '\u2014';
  return num.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function _grainFmtPrice(n) {
  if (n == null) return '\u2014';
  var num = parseFloat(n);
  if (isNaN(num)) return '\u2014';
  return num.toFixed(4);
}

function _grainParseNum(val) {
  if (val === '' || val == null) return null;
  var n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function _grainGetElevators() {
  var raw = STATE.settings.elevators || '[]';
  try {
    var arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function _grainBuildElevatorDatalist() {
  var elevators = _grainGetElevators();
  var html = '';
  for (var i = 0; i < elevators.length; i++) {
    html += '<option value="' + escapeAttr(elevators[i]) + '">';
  }
  return html;
}

function _grainBuildFuturesMonthOptions(selected) {
  // Build CBOT month options: letter + year for relevant years
  var relevantMonths = {
    Corn: ['H', 'K', 'N', 'U', 'Z'],
    Soybeans: ['F', 'H', 'K', 'N', 'Q', 'X'],
    Wheat: ['H', 'K', 'N', 'U', 'Z']
  };
  // Use all months since we don't know commodity at this point
  var months = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'];
  var yearSuffixes = ['25', '26', '27', '28'];
  var html = '<option value="">--</option>';

  for (var yi = 0; yi < yearSuffixes.length; yi++) {
    for (var mi = 0; mi < months.length; mi++) {
      var code = months[mi] + yearSuffixes[yi];
      var label = MONTH_NAMES[months[mi]] + ' 20' + yearSuffixes[yi];
      var sel = code === selected ? ' selected' : '';
      html += '<option value="' + escapeAttr(code) + '"' + sel + '>' + esc(code) + ' (' + esc(label) + ')</option>';
    }
  }
  return html;
}

function _grainBuildUniqueDatalist(contracts, field) {
  var seen = {};
  var html = '';
  for (var i = 0; i < contracts.length; i++) {
    var val = contracts[i][field];
    if (val && !seen[val]) {
      seen[val] = true;
      html += '<option value="' + escapeAttr(val) + '">';
    }
  }
  return html;
}
