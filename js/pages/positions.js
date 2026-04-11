// ==================== HOLMES RISK — POSITIONS PAGE ====================

// Module-level filter state
var _posFilters = {
  commodity: 'All',
  status: 'All'
};

// Track which position rows are expanded
var _posExpandedRows = {};

// ---- Main page renderer ----

function _posRenderContent() {
  var cropYear = STATE.activeCropYear || STATE.settings.activeCropYear || SEASON.current;
  var positions = _posFilterPositions(STATE.positions || [], cropYear);

  return _posRenderToolbar(cropYear) +
    _posRenderPositionList(positions);
}

function renderPositionsPage() {
  return '<div class="page-content">' + _posRenderContent() + '</div>';
}

// ---- Toolbar ----

function _posRenderToolbar(cropYear) {
  var years = SEASON.available;
  var yearOpts = '';
  for (var i = 0; i < years.length; i++) {
    var sel = years[i] === cropYear ? ' selected' : '';
    yearOpts += '<option value="' + years[i] + '"' + sel + '>' + years[i] + '</option>';
  }

  // Commodity filter
  var commOpts = '<option value="All">All Commodities</option>';
  for (var ci = 0; ci < DEFAULT_COMMODITIES.length; ci++) {
    var cSel = _posFilters.commodity === DEFAULT_COMMODITIES[ci] ? ' selected' : '';
    commOpts += '<option value="' + escapeAttr(DEFAULT_COMMODITIES[ci]) + '"' + cSel + '>' + esc(DEFAULT_COMMODITIES[ci]) + '</option>';
  }

  // Status filter
  var statuses = ['Open', 'Closed', 'Expired', 'Exercised'];
  var statOpts = '<option value="All">All Statuses</option>';
  for (var si = 0; si < statuses.length; si++) {
    var sSel = _posFilters.status === statuses[si] ? ' selected' : '';
    statOpts += '<option value="' + escapeAttr(statuses[si]) + '"' + sSel + '>' + esc(statuses[si]) + '</option>';
  }

  return '<div class="grain-toolbar">' +
    '<div class="grain-toolbar-filters">' +
      '<select class="form-select grain-filter-select" onchange="posApplyFilter(\'cropYear\', this.value)">' + yearOpts + '</select>' +
      '<select class="form-select grain-filter-select" onchange="posApplyFilter(\'commodity\', this.value)">' + commOpts + '</select>' +
      '<select class="form-select grain-filter-select" onchange="posApplyFilter(\'status\', this.value)">' + statOpts + '</select>' +
    '</div>' +
    '<button class="btn btn-primary btn-sm" onclick="posOpenPositionModal()">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
      ' Add Position' +
    '</button>' +
  '</div>';
}

// ---- Filter logic ----

function posApplyFilter(key, value) {
  if (key === 'cropYear') {
    STATE.activeCropYear = value;
    upsertRiskSettingDB('activeCropYear', value)
      .then(function() { STATE.settings.activeCropYear = value; })
      .catch(function() {});
  } else {
    _posFilters[key] = value;
  }
  renderApp();
}

function _posFilterPositions(positions, cropYear) {
  var filtered = [];
  for (var i = 0; i < positions.length; i++) {
    var p = positions[i];
    // Filter by crop year
    if (p.cropYear && String(p.cropYear) !== String(cropYear)) continue;
    // Filter by commodity
    if (_posFilters.commodity !== 'All' && p.commodity !== _posFilters.commodity) continue;
    // Filter by status
    if (_posFilters.status !== 'All' && p.status !== _posFilters.status) continue;
    filtered.push(p);
  }
  return filtered;
}

// ---- Position list ----

function _posRenderPositionList(positions) {
  if (positions.length === 0) {
    return '<div class="page-placeholder" style="padding: 48px 24px;">' +
      '<p>No positions match the current filters</p>' +
    '</div>';
  }
  return _posRenderTable(positions);
}

// ---- Position table ----

function _posRenderTable(positions) {
  var html = '<div class="table-wrap"><table>' +
    '<thead><tr>' +
      '<th scope="col">Commodity</th>' +
      '<th scope="col">Type</th>' +
      '<th scope="col">Side</th>' +
      '<th scope="col" style="text-align:right">Contracts</th>' +
      '<th scope="col">Underlying</th>' +
      '<th scope="col" style="text-align:right">Entry</th>' +
      '<th scope="col" style="text-align:right">Current</th>' +
      '<th scope="col" style="text-align:right">P&amp;L</th>' +
      '<th scope="col" style="text-align:right">Delta</th>' +
      '<th scope="col">Status</th>' +
      '<th scope="col">Actions</th>' +
    '</tr></thead>' +
    '<tbody>';

  for (var i = 0; i < positions.length; i++) {
    var p = positions[i];
    var id = p.id;
    var color = COMMODITY_COLORS[p.commodity] || 'var(--text)';
    var sideSign = p.positionSide === 'Short' ? -1 : 1;
    var contracts = p.contracts != null ? parseFloat(p.contracts) : 0;
    var bpc = p.bushelsPerContract != null ? parseFloat(p.bushelsPerContract) : (DEFAULT_BUSHELS_PER_CONTRACT[p.commodity] || 5000);
    var entry = p.entryPrice != null ? parseFloat(p.entryPrice) : null;
    var current = p.currentPrice != null ? parseFloat(p.currentPrice) : null;
    var pnl = null;
    if (entry != null && current != null) {
      pnl = (current - entry) * contracts * bpc * sideSign;
    }
    var pnlClass = pnl != null ? (pnl >= 0 ? 'pos-pnl-positive' : 'pos-pnl-negative') : '';
    var statusClass = _posStatusClass(p.status);
    var delta = p.delta != null ? parseFloat(p.delta) : null;
    var isExpanded = _posExpandedRows[id];

    html += '<tr class="grain-row" onclick="posToggleRow(\'' + escapeAttr(id) + '\')" style="cursor:pointer">' +
      '<td>' +
        '<span class="grain-commodity-dot" style="background:' + color + '"></span> ' +
        esc(p.commodity) +
      '</td>' +
      '<td>' + esc(p.contractType || '') + '</td>' +
      '<td><span class="pos-side pos-side-' + (p.positionSide === 'Short' ? 'short' : 'long') + '">' + esc(p.positionSide || '') + '</span></td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + (contracts || '\u2014') + '</td>' +
      '<td>' + esc(p.underlying || '') + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _posFmtPrice(entry) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _posFmtPrice(current) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)" class="' + pnlClass + '">' + _posFmtPnl(pnl) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + (delta != null ? delta.toFixed(4) : '\u2014') + '</td>' +
      '<td><span class="grain-status ' + statusClass + '">' + esc(p.status || '') + '</span></td>' +
      '<td class="grain-actions" onclick="event.stopPropagation()">' +
        ((p.status === 'Open' && (p.contractType === 'Call' || p.contractType === 'Put'))
          ? '<button class="btn btn-sm pos-btn-exercise" onclick="posOpenExerciseModal(\'' + escapeAttr(id) + '\')">Exercise</button> '
          : '') +
        ((p.status === 'Open' && p.contractType === 'Futures')
          ? '<button class="btn btn-secondary btn-sm" onclick="posOpenRollModal(\'' + escapeAttr(id) + '\')">Roll</button> '
          : '') +
        (p.status === 'Open'
          ? '<button class="btn btn-secondary btn-sm" onclick="posOpenSplitModal(\'' + escapeAttr(id) + '\')">Split</button> '
          : '') +
        '<button class="btn btn-secondary btn-sm" onclick="posOpenPositionModal(\'' + escapeAttr(id) + '\')">Edit</button> ' +
        '<button class="btn btn-danger btn-sm" onclick="posDeletePosition(\'' + escapeAttr(id) + '\')">Delete</button>' +
      '</td>' +
    '</tr>';

    // Expanded detail row
    if (isExpanded) {
      html += '<tr class="grain-detail-row"><td colspan="11">' +
        _posRenderDetailPanel(p) +
      '</td></tr>';
    }
  }

  html += '</tbody></table></div>';
  return html;
}

function _posRenderDetailPanel(p) {
  var parts = [];
  if (p.underlying) parts.push('<strong>Underlying:</strong> ' + esc(p.underlying));
  if (p.strike != null) parts.push('<strong>Strike:</strong> ' + _posFmtPrice(p.strike));
  if (p.expiryDate) parts.push('<strong>Expiry:</strong> ' + esc(p.expiryDate));
  if (p.iv != null) parts.push('<strong>IV:</strong> ' + parseFloat(p.iv).toFixed(2) + '%');
  if (p.gamma != null) parts.push('<strong>Gamma:</strong> ' + parseFloat(p.gamma).toFixed(6));
  if (p.theta != null) parts.push('<strong>Theta:</strong> ' + parseFloat(p.theta).toFixed(4));
  if (p.vega != null) parts.push('<strong>Vega:</strong> ' + parseFloat(p.vega).toFixed(4));
  if (p.closedPrice != null) parts.push('<strong>Closed Price:</strong> ' + _posFmtPrice(p.closedPrice));
  if (p.closeReason) parts.push('<strong>Close Reason:</strong> ' + esc(p.closeReason));
  if (p.company) parts.push('<strong>Company:</strong> ' + esc(p.company));
  if (p.account) parts.push('<strong>Account:</strong> ' + esc(p.account));
  if (p.notes) parts.push('<strong>Notes:</strong> ' + esc(p.notes));

  // Exercise relationship indicators
  if (p.sourceType === 'exercise' && p.sourceOptionId) {
    parts.push('<span class="pos-badge-exercise">from exercise</span>');
  }
  if (p.resultingPositionId) {
    parts.push('<span class="pos-badge-exercised">Exercised \u2192 resulting position</span>');
  }

  // Roll relationship indicators
  if (p.rolledFromId) {
    var rolledFromPos = _posFindById(p.rolledFromId);
    if (rolledFromPos) {
      parts.push('<span class="pos-badge-rolled">Rolled from ' + esc(rolledFromPos.underlying || rolledFromPos.commodity) + '</span>');
    } else {
      parts.push('<span class="pos-badge-rolled">Rolled from previous position</span>');
    }
  }
  if (p.rolledToId) {
    var rolledToPos = _posFindById(p.rolledToId);
    if (rolledToPos) {
      parts.push('<span class="pos-badge-rolled">Rolled to ' + esc(rolledToPos.underlying || rolledToPos.commodity) + '</span>');
    } else {
      parts.push('<span class="pos-badge-rolled">Rolled to new position</span>');
    }
  }

  // Split relationship indicator
  if (p.splitFromId) {
    var splitParent = _posFindById(p.splitFromId);
    if (splitParent) {
      parts.push('<span class="pos-badge-split">Split from ' + esc(splitParent.underlying || splitParent.commodity) + ' (' + splitParent.contracts + ' contracts)</span>');
    } else {
      parts.push('<span class="pos-badge-split">Split from parent position</span>');
    }
  }

  if (parts.length === 0) {
    return '<div class="grain-detail-inner"><span style="color:var(--text3)">No additional details</span></div>';
  }

  return '<div class="grain-detail-inner">' + parts.join('<span class="grain-detail-sep">&middot;</span>') + '</div>';
}

function _posStatusClass(status) {
  switch (status) {
    case 'Open': return 'grain-status-open';
    case 'Closed': return 'pos-status-closed';
    case 'Expired': return 'pos-status-expired';
    case 'Exercised': return 'pos-status-exercised';
    default: return '';
  }
}

// ---- Row expand/collapse ----

function posToggleRow(id) {
  if (_posExpandedRows[id]) {
    delete _posExpandedRows[id];
  } else {
    _posExpandedRows[id] = true;
  }
  renderApp();
}

// ---- Position Modal ----

function posOpenPositionModal(id) {
  var position = null;
  var isEdit = false;

  if (id) {
    for (var i = 0; i < STATE.positions.length; i++) {
      if (STATE.positions[i].id === id) {
        position = STATE.positions[i];
        break;
      }
    }
    if (!position) { showToast('Position not found', 'error'); return; }
    isEdit = true;
  }

  var title = isEdit ? 'Edit Position' : 'Add Position';
  var p = position || {};

  // Commodity options
  var commOpts = '';
  for (var ci = 0; ci < DEFAULT_COMMODITIES.length; ci++) {
    var cSel = p.commodity === DEFAULT_COMMODITIES[ci] ? ' selected' : '';
    commOpts += '<option value="' + escapeAttr(DEFAULT_COMMODITIES[ci]) + '"' + cSel + '>' + esc(DEFAULT_COMMODITIES[ci]) + '</option>';
  }

  // Contract type options (Futures, Call, Put)
  var posTypes = ['Futures', 'Call', 'Put'];
  var typeOpts = '';
  var currentType = p.contractType || 'Futures';
  for (var ti = 0; ti < posTypes.length; ti++) {
    var tSel = currentType === posTypes[ti] ? ' selected' : '';
    typeOpts += '<option value="' + escapeAttr(posTypes[ti]) + '"' + tSel + '>' + esc(posTypes[ti]) + '</option>';
  }

  // Position side options
  var sideOpts = '';
  var sides = ['Long', 'Short'];
  var currentSide = p.positionSide || 'Long';
  for (var si = 0; si < sides.length; si++) {
    var sSel = currentSide === sides[si] ? ' selected' : '';
    sideOpts += '<option value="' + escapeAttr(sides[si]) + '"' + sSel + '>' + esc(sides[si]) + '</option>';
  }

  // Crop year options
  var yearOpts = '';
  var years = SEASON.available;
  var defaultYear = p.cropYear ? String(p.cropYear) : (STATE.activeCropYear || SEASON.current);
  for (var yi = 0; yi < years.length; yi++) {
    var ySel = years[yi] === defaultYear ? ' selected' : '';
    yearOpts += '<option value="' + years[yi] + '"' + ySel + '>' + years[yi] + '</option>';
  }

  // Status options
  var statusList = ['Open', 'Closed', 'Expired', 'Exercised'];
  var statOpts = '';
  var currentStatus = p.status || 'Open';
  for (var sti = 0; sti < statusList.length; sti++) {
    var stSel = statusList[sti] === currentStatus ? ' selected' : '';
    statOpts += '<option value="' + escapeAttr(statusList[sti]) + '"' + stSel + '>' + esc(statusList[sti]) + '</option>';
  }

  // Futures month options (reuse grain helper)
  var fmOpts = _grainBuildFuturesMonthOptions(p.underlying || '');

  // Default BPC based on commodity
  var defaultBpc = p.bushelsPerContract != null ? String(p.bushelsPerContract) : String(DEFAULT_BUSHELS_PER_CONTRACT[p.commodity || 'Corn'] || 5000);

  // Determine initial visibility
  var isOption = currentType === 'Call' || currentType === 'Put';
  var isClosed = currentStatus === 'Closed';

  // Datalists for company/account
  var companyOptions = _posBuildUniqueDatalist(STATE.positions, 'company');
  var accountOptions = _posBuildUniqueDatalist(STATE.positions, 'account');

  var html = '<h2 class="modal-title">' + esc(title) + '</h2>' +
    '<form id="posPositionForm" onsubmit="posSavePosition(event, ' + (id ? '\'' + escapeAttr(id) + '\'' : 'null') + ')">' +
      '<div class="grain-modal-grid">' +

        // Row 1: Commodity + Contract Type
        '<div class="form-group">' +
          '<label class="form-label">Commodity</label>' +
          '<select class="form-select" id="posCommodity" onchange="posOnCommodityChange(this.value)">' + commOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Type</label>' +
          '<select class="form-select" id="posContractType" onchange="posOnTypeChange(this.value)">' + typeOpts + '</select>' +
        '</div>' +

        // Row 2: Side + Crop Year
        '<div class="form-group">' +
          '<label class="form-label">Side</label>' +
          '<select class="form-select" id="posPositionSide">' + sideOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Crop Year</label>' +
          '<select class="form-select" id="posCropYear">' + yearOpts + '</select>' +
        '</div>' +

        // Row 3: Contracts + BPC
        '<div class="form-group">' +
          '<label class="form-label">Contracts</label>' +
          '<input type="number" class="form-input" id="posContracts" min="0" step="1" value="' + escapeAttr(p.contracts != null ? String(p.contracts) : '') + '" required oninput="posUpdatePnlPreview()">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Bushels/Contract</label>' +
          '<input type="number" class="form-input" id="posBushelsPerContract" min="0" step="1" value="' + escapeAttr(defaultBpc) + '" oninput="posUpdatePnlPreview()">' +
        '</div>' +

        // Row 4: Underlying + Entry Price
        '<div class="form-group">' +
          '<label class="form-label">Underlying / Futures Month</label>' +
          '<select class="form-select" id="posUnderlying">' + fmOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Entry Price</label>' +
          '<input type="number" class="form-input" id="posEntryPrice" step="0.0001" value="' + escapeAttr(p.entryPrice != null ? String(p.entryPrice) : '') + '" required oninput="posUpdatePnlPreview()">' +
        '</div>' +

        // Row 5: Current Price
        '<div class="form-group">' +
          '<label class="form-label">Current Price</label>' +
          '<input type="number" class="form-input" id="posCurrentPrice" step="0.0001" value="' + escapeAttr(p.currentPrice != null ? String(p.currentPrice) : '') + '" oninput="posUpdatePnlPreview()">' +
        '</div>' +

        // Effective Entry Price
        '<div class="form-group">' +
          '<label class="form-label">Effective Entry Price</label>' +
          '<input type="number" class="form-input" id="posEffectiveEntryPrice" step="0.0001" value="' + escapeAttr(p.effectiveEntryPrice != null ? String(p.effectiveEntryPrice) : '') + '">' +
        '</div>' +

        // Options-only fields (Strike + Expiry)
        '<div class="form-group pos-option-field" id="posStrikeGroup" style="' + (isOption ? '' : 'display:none') + '">' +
          '<label class="form-label">Strike Price</label>' +
          '<input type="number" class="form-input" id="posStrike" step="0.0001" value="' + escapeAttr(p.strike != null ? String(p.strike) : '') + '">' +
        '</div>' +
        '<div class="form-group pos-option-field" id="posExpiryGroup" style="' + (isOption ? '' : 'display:none') + '">' +
          '<label class="form-label">Expiry Date</label>' +
          '<input type="date" class="form-input" id="posExpiryDate" value="' + escapeAttr(p.expiryDate || '') + '">' +
        '</div>' +

      '</div>' +

      // P&L Preview
      '<div class="pos-pnl-preview" id="posPnlPreview"></div>' +

      // Greeks Section
      '<div class="pos-greeks-section">' +
        '<div class="pos-greeks-header">' +
          '<span class="pos-greeks-title">Greeks</span>' +
          '<button type="button" class="btn btn-secondary btn-sm" onclick="posCalcGreeks()">Calc Greeks</button>' +
        '</div>' +
        '<div class="grain-modal-grid">' +
          '<div class="form-group">' +
            '<label class="form-label">Delta</label>' +
            '<input type="number" class="form-input" id="posDelta" step="0.0001" value="' + escapeAttr(p.delta != null ? String(p.delta) : '') + '">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">Gamma</label>' +
            '<input type="number" class="form-input" id="posGamma" step="0.000001" value="' + escapeAttr(p.gamma != null ? String(p.gamma) : '') + '">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">Theta</label>' +
            '<input type="number" class="form-input" id="posTheta" step="0.0001" value="' + escapeAttr(p.theta != null ? String(p.theta) : '') + '">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label">Vega</label>' +
            '<input type="number" class="form-input" id="posVega" step="0.0001" value="' + escapeAttr(p.vega != null ? String(p.vega) : '') + '">' +
          '</div>' +
          '<div class="form-group pos-option-field" id="posIvGroup" style="' + (isOption ? '' : 'display:none') + '">' +
            '<label class="form-label">IV (%)</label>' +
            '<input type="number" class="form-input" id="posIv" step="0.01" value="' + escapeAttr(p.iv != null ? String(p.iv) : '') + '">' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Status section
      '<div class="grain-modal-grid">' +
        '<div class="form-group">' +
          '<label class="form-label">Status</label>' +
          '<select class="form-select" id="posStatus" onchange="posOnStatusChange(this.value)">' + statOpts + '</select>' +
        '</div>' +

        // Closed-only fields
        '<div class="form-group pos-closed-field" id="posClosedPriceGroup" style="' + (isClosed ? '' : 'display:none') + '">' +
          '<label class="form-label">Closed Price</label>' +
          '<input type="number" class="form-input" id="posClosedPrice" step="0.0001" value="' + escapeAttr(p.closedPrice != null ? String(p.closedPrice) : '') + '">' +
        '</div>' +
      '</div>' +

      '<div class="grain-modal-grid pos-closed-field" id="posCloseReasonGroup" style="' + (isClosed ? '' : 'display:none') + '">' +
        '<div class="form-group" style="grid-column: 1 / -1">' +
          '<label class="form-label">Close Reason</label>' +
          '<input type="text" class="form-input" id="posCloseReason" value="' + escapeAttr(p.closeReason || '') + '">' +
        '</div>' +
      '</div>' +

      // Company + Account
      '<div class="grain-modal-grid">' +
        '<div class="form-group">' +
          '<label class="form-label">Company</label>' +
          '<input type="text" class="form-input" id="posCompany" list="posCompanyList" value="' + escapeAttr(p.company || '') + '">' +
          '<datalist id="posCompanyList">' + companyOptions + '</datalist>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Account</label>' +
          '<input type="text" class="form-input" id="posAccount" list="posAccountList" value="' + escapeAttr(p.account || '') + '">' +
          '<datalist id="posAccountList">' + accountOptions + '</datalist>' +
        '</div>' +
      '</div>' +

      // Notes (full width)
      '<div class="form-group">' +
        '<label class="form-label">Notes</label>' +
        '<textarea class="form-input" id="posNotes" rows="3">' + esc(p.notes || '') + '</textarea>' +
      '</div>' +

      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Save Changes' : 'Create Position') + '</button>' +
      '</div>' +
    '</form>';

  showModal(html);

  // Trigger initial P&L preview
  posUpdatePnlPreview();
}

// ---- Type change handler (toggle option-specific fields) ----

function posOnTypeChange(type) {
  var isOption = type === 'Call' || type === 'Put';
  var optionFields = document.querySelectorAll('.pos-option-field');
  for (var i = 0; i < optionFields.length; i++) {
    optionFields[i].style.display = isOption ? '' : 'none';
  }
}

// ---- Status change handler (toggle closed fields) ----

function posOnStatusChange(status) {
  var isClosed = status === 'Closed';
  var closedFields = document.querySelectorAll('.pos-closed-field');
  for (var i = 0; i < closedFields.length; i++) {
    closedFields[i].style.display = isClosed ? '' : 'none';
  }
}

// ---- Commodity change handler (update default BPC) ----

function posOnCommodityChange(commodity) {
  var bpcInput = document.getElementById('posBushelsPerContract');
  if (bpcInput) {
    var defaultBpc = DEFAULT_BUSHELS_PER_CONTRACT[commodity] || 5000;
    bpcInput.value = defaultBpc;
  }
  posUpdatePnlPreview();
}

// ---- Live P&L preview ----

function posUpdatePnlPreview() {
  var el = document.getElementById('posPnlPreview');
  if (!el) return;

  var entry = _posParseNum(document.getElementById('posEntryPrice') ? document.getElementById('posEntryPrice').value : null);
  var current = _posParseNum(document.getElementById('posCurrentPrice') ? document.getElementById('posCurrentPrice').value : null);
  var contracts = _posParseNum(document.getElementById('posContracts') ? document.getElementById('posContracts').value : null);
  var bpc = _posParseNum(document.getElementById('posBushelsPerContract') ? document.getElementById('posBushelsPerContract').value : null);
  var sideEl = document.getElementById('posPositionSide');
  var side = sideEl ? sideEl.value : 'Long';
  var sideSign = side === 'Short' ? -1 : 1;

  if (entry == null || current == null || contracts == null || contracts <= 0) {
    el.innerHTML = '';
    return;
  }

  if (bpc == null || bpc <= 0) bpc = 5000;

  var pnl = (current - entry) * contracts * bpc * sideSign;
  var pnlClass = pnl >= 0 ? 'pos-pnl-positive' : 'pos-pnl-negative';
  var sign = pnl >= 0 ? '+' : '';

  el.innerHTML = '<div class="pos-pnl-preview-inner ' + pnlClass + '">' +
    '<span class="pos-pnl-preview-label">Estimated P&amp;L:</span> ' +
    '<span class="pos-pnl-preview-value">' + sign + '$' + _posFmtNumber(Math.abs(pnl)) + '</span>' +
  '</div>';
}

// ---- Greeks auto-calculation ----

function posCalcGreeks() {
  var typeEl = document.getElementById('posContractType');
  var type = typeEl ? typeEl.value : 'Futures';

  var underlyingEl = document.getElementById('posUnderlying');
  var underlying = underlyingEl ? underlyingEl.value : '';

  var strikeEl = document.getElementById('posStrike');
  var strike = _posParseNum(strikeEl ? strikeEl.value : null);

  var expiryEl = document.getElementById('posExpiryDate');
  var expiryStr = expiryEl ? expiryEl.value : '';

  var entryEl = document.getElementById('posEntryPrice');
  var entryPrice = _posParseNum(entryEl ? entryEl.value : null);

  var currentEl = document.getElementById('posCurrentPrice');
  var currentPrice = _posParseNum(currentEl ? currentEl.value : null);

  // For futures, delta is always +1 (long) or -1 (short), greeks are simpler
  if (type === 'Futures') {
    var sideEl = document.getElementById('posPositionSide');
    var side = sideEl ? sideEl.value : 'Long';
    var futureDelta = side === 'Short' ? -1 : 1;
    document.getElementById('posDelta').value = futureDelta.toFixed(4);
    document.getElementById('posGamma').value = '0';
    document.getElementById('posTheta').value = '0';
    document.getElementById('posVega').value = '0';
    showToast('Futures delta set to ' + futureDelta, 'info');
    return;
  }

  // For options, need: futures price (F), strike (K), expiry → T, sigma
  if (!strike) {
    showToast('Strike price required to calculate Greeks', 'error');
    return;
  }
  if (!expiryStr) {
    showToast('Expiry date required to calculate Greeks', 'error');
    return;
  }

  // Calculate T (years to expiry)
  var expiryDate = new Date(expiryStr + 'T00:00:00');
  var now = new Date();
  var msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  var T = (expiryDate.getTime() - now.getTime()) / msPerYear;

  if (T <= 0) {
    showToast('Expiry date is in the past', 'error');
    return;
  }

  // Need the underlying futures price for Black-76 — NOT the option premium
  var commodityEl = document.getElementById('posCommodity');
  var commodity = commodityEl ? commodityEl.value : '';
  var F = getLatestFuturesPrice(commodity, STATE.marketPrices);
  if (!F) {
    showToast('No market price available for ' + esc(commodity) + ' — cannot calculate Greeks', 'error');
    return;
  }

  // Try to solve IV from market price (entry price of the option)
  var r = 0.05; // risk-free rate assumption
  var sigma = null;

  // If we have an entry price for the option, try to back-solve IV
  if (entryPrice && entryPrice > 0) {
    sigma = impliedVol(entryPrice, F, strike, T, r, type);
  }

  // Fallback: use a default vol if IV solver fails
  if (!sigma || sigma <= 0) {
    sigma = 0.25; // 25% default
    showToast('Using default 25% vol (IV solve failed)', 'warning');
  }

  var greeks = black76Greeks(F, strike, T, r, sigma, type);
  if (!greeks) {
    showToast('Greeks calculation failed — check inputs', 'error');
    return;
  }

  // Fill in the form
  document.getElementById('posDelta').value = greeks.delta.toFixed(4);
  document.getElementById('posGamma').value = greeks.gamma.toFixed(6);
  document.getElementById('posTheta').value = greeks.theta.toFixed(4);
  document.getElementById('posVega').value = greeks.vega.toFixed(4);

  var ivEl = document.getElementById('posIv');
  if (ivEl) {
    ivEl.value = (sigma * 100).toFixed(2);
  }

  showToast('Greeks calculated (IV: ' + (sigma * 100).toFixed(1) + '%)', 'success');
}

// ---- Save handler ----

function posSavePosition(e, id) {
  e.preventDefault();

  var data = {
    commodity: document.getElementById('posCommodity').value,
    cropYear: document.getElementById('posCropYear').value,
    underlying: document.getElementById('posUnderlying').value || null,
    contractType: document.getElementById('posContractType').value,
    positionSide: document.getElementById('posPositionSide').value,
    contracts: _posParseNum(document.getElementById('posContracts').value),
    bushelsPerContract: _posParseNum(document.getElementById('posBushelsPerContract').value),
    strike: _posParseNum(document.getElementById('posStrike').value),
    entryPrice: _posParseNum(document.getElementById('posEntryPrice').value),
    currentPrice: _posParseNum(document.getElementById('posCurrentPrice').value),
    effectiveEntryPrice: _posParseNum(document.getElementById('posEffectiveEntryPrice').value),
    closedPrice: _posParseNum(document.getElementById('posClosedPrice').value),
    delta: _posParseNum(document.getElementById('posDelta').value),
    gamma: _posParseNum(document.getElementById('posGamma').value),
    theta: _posParseNum(document.getElementById('posTheta').value),
    vega: _posParseNum(document.getElementById('posVega').value),
    iv: _posParseNum(document.getElementById('posIv').value),
    expiryDate: document.getElementById('posExpiryDate').value || null,
    status: document.getElementById('posStatus').value,
    closeReason: document.getElementById('posCloseReason').value.trim() || null,
    company: document.getElementById('posCompany').value.trim() || null,
    account: document.getElementById('posAccount').value.trim() || null,
    notes: document.getElementById('posNotes').value.trim() || null
  };

  if (!data.contracts || data.contracts <= 0) {
    showToast('Number of contracts is required', 'error');
    return;
  }

  if (data.entryPrice == null) {
    showToast('Entry price is required', 'error');
    return;
  }

  if (id) {
    // Edit
    updateRiskPositionDB(id, data)
      .then(function(updated) {
        for (var i = 0; i < STATE.positions.length; i++) {
          if (STATE.positions[i].id === id) {
            STATE.positions[i] = updated;
            break;
          }
        }
        closeModal();
        renderApp();
        showToast('Position updated', 'success');
      })
      .catch(function(err) {
        showToast('Failed to update: ' + err.message, 'error');
      });
  } else {
    // Create
    createRiskPositionDB(data)
      .then(function(created) {
        STATE.positions.push(created);
        closeModal();
        renderApp();
        showToast('Position created', 'success');
      })
      .catch(function(err) {
        showToast('Failed to create: ' + err.message, 'error');
      });
  }
}

// ---- Delete handler ----

function posDeletePosition(id) {
  if (!confirm('Delete this position? This cannot be undone.')) return;

  deleteRiskPositionDB(id)
    .then(function() {
      STATE.positions = STATE.positions.filter(function(p) { return p.id !== id; });
      delete _posExpandedRows[id];
      renderApp();
      showToast('Position deleted', 'success');
    })
    .catch(function(err) {
      showToast('Failed to delete: ' + err.message, 'error');
    });
}

// ---- Exercise Modal ----

function posOpenExerciseModal(positionId) {
  var position = null;
  for (var i = 0; i < STATE.positions.length; i++) {
    if (STATE.positions[i].id === positionId) {
      position = STATE.positions[i];
      break;
    }
  }
  if (!position) { showToast('Position not found', 'error'); return; }

  var isCall = position.contractType === 'Call';
  var resultSide = isCall ? 'Long' : 'Short';
  var strike = position.strike != null ? parseFloat(position.strike) : null;
  var premium = position.entryPrice != null ? parseFloat(position.entryPrice) : 0;
  var underlying = position.underlying || '';
  var bpc = position.bushelsPerContract != null ? parseFloat(position.bushelsPerContract) : (DEFAULT_BUSHELS_PER_CONTRACT[position.commodity] || 5000);
  var contracts = position.contracts != null ? parseFloat(position.contracts) : 0;
  var totalBu = contracts * bpc;
  var effEntry = strike != null ? parseFloat((isCall ? strike + premium : strike - premium).toFixed(6)) : null;

  var today = new Date();
  var todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');

  var sideColor = resultSide === 'Long' ? 'var(--green)' : 'var(--red)';
  var effLabel = isCall ? 'Strike + Premium paid' : 'Strike \u2212 Premium paid';

  var html = '<h2 class="modal-title">Exercise Option \u2014 ' + esc(position.contractType) + ' ' + esc(position.underlying || position.commodity) + '</h2>' +

    // Info banner
    '<div class="pos-exercise-info">' +
      'Exercising: <strong>' + esc(position.contractType) + ' ' + esc(position.underlying || position.commodity) + '</strong>' +
      ' &nbsp;|&nbsp; Strike: <strong>' + (strike != null ? _posFmtPrice(strike) : '\u2014') + '</strong>' +
      ' &nbsp;|&nbsp; ' + contracts + ' contract' + (contracts !== 1 ? 's' : '') + ' (' + totalBu.toLocaleString() + ' bu)' +
      ' &nbsp;|&nbsp; Premium paid: <strong>' + _posFmtPrice(premium) + '/bu</strong>' +
    '</div>' +

    // Exercise date
    '<div class="grain-modal-grid">' +
      '<div class="form-group">' +
        '<label class="form-label">Exercise Date</label>' +
        '<input type="date" class="form-input" id="posExerciseDate" value="' + escapeAttr(todayStr) + '" required>' +
      '</div>' +
      '<div class="form-group"></div>' +
    '</div>' +

    // Resulting futures preview
    '<div class="pos-exercise-preview-header">Resulting Futures Position</div>' +
    '<div class="grain-modal-grid">' +
      '<div class="pos-exercise-preview-field">' +
        '<label class="form-label" style="color:var(--text3)">Side</label>' +
        '<strong style="font-size:1rem;color:' + sideColor + '">' + esc(resultSide) + '</strong>' +
      '</div>' +
      '<div class="pos-exercise-preview-field">' +
        '<label class="form-label" style="color:var(--text3)">Entry Price = Strike</label>' +
        '<strong style="font-size:1rem">' + (strike != null ? _posFmtPrice(strike) : '\u2014 (set strike on option first)') + '</strong>' +
      '</div>' +
    '</div>' +
    '<div class="grain-modal-grid">' +
      '<div class="pos-exercise-preview-field">' +
        '<label class="form-label" style="color:var(--text3)">Futures Symbol</label>' +
        '<strong>' + esc(underlying || '(derived from option)') + '</strong>' +
      '</div>' +
      '<div class="pos-exercise-preview-field pos-exercise-eff">' +
        '<label class="form-label" style="color:var(--text3)">Effective Entry (after premium)</label>' +
        '<strong style="font-size:1rem">' + (effEntry != null ? _posFmtPrice(effEntry) : '\u2014') + '</strong>' +
        '<div style="font-size:11px;color:var(--text3);margin-top:2px">' + esc(effLabel) + '</div>' +
      '</div>' +
    '</div>' +

    // Notes
    '<div class="form-group" style="margin-top:12px">' +
      '<label class="form-label">Notes</label>' +
      '<input type="text" class="form-input" id="posExerciseNotes" placeholder="e.g. exercised Dec corn put into short futures">' +
    '</div>' +

    // Actions
    '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="button" class="btn btn-primary" onclick="posConfirmExercise(\'' + escapeAttr(positionId) + '\')">Confirm Exercise</button>' +
    '</div>';

  showModal(html);
}

// ---- Exercise save handler ----

function posConfirmExercise(positionId) {
  var option = null;
  var optionIndex = -1;
  for (var i = 0; i < STATE.positions.length; i++) {
    if (STATE.positions[i].id === positionId) {
      option = STATE.positions[i];
      optionIndex = i;
      break;
    }
  }
  if (!option) { showToast('Position not found', 'error'); return; }

  var isCall = option.contractType === 'Call';
  var strike = option.strike != null ? parseFloat(option.strike) : null;
  var premium = option.entryPrice != null ? parseFloat(option.entryPrice) : 0;
  var underlying = option.underlying || '';

  // Validate strike
  if (strike == null) {
    showToast('Set a strike price on this option before exercising', 'error');
    return;
  }

  var exerciseDateEl = document.getElementById('posExerciseDate');
  var exerciseDate = exerciseDateEl ? exerciseDateEl.value : '';
  if (!exerciseDate) {
    showToast('Exercise date is required', 'error');
    return;
  }

  var notesEl = document.getElementById('posExerciseNotes');
  var notes = notesEl ? notesEl.value.trim() : '';

  var resultSide = isCall ? 'Long' : 'Short';
  var effectiveEntry = parseFloat((isCall ? strike + premium : strike - premium).toFixed(6));
  var bpc = option.bushelsPerContract != null ? parseFloat(option.bushelsPerContract) : (DEFAULT_BUSHELS_PER_CONTRACT[option.commodity] || 5000);
  var contracts = option.contracts != null ? parseFloat(option.contracts) : 0;

  // Build new futures position data
  var newPositionData = {
    commodity: option.commodity,
    cropYear: option.cropYear,
    underlying: underlying,
    contractType: 'Futures',
    positionSide: resultSide,
    contracts: contracts,
    bushelsPerContract: bpc,
    strike: null,
    entryPrice: strike,
    currentPrice: null,
    effectiveEntryPrice: effectiveEntry,
    delta: resultSide === 'Long' ? 1 : -1,
    gamma: 0,
    theta: 0,
    vega: null,
    iv: null,
    expiryDate: null,
    status: 'Open',
    company: option.company || null,
    account: option.account || null,
    notes: notes || null,
    linkedContractId: option.linkedContractId || null,
    sourceType: 'exercise',
    sourceOptionId: positionId
  };

  // 1. Create the new futures position first
  createRiskPositionDB(newPositionData)
    .then(function(created) {
      var newId = created.id;

      // 2. Update the option position
      var optionUpdate = {
        status: 'Exercised',
        exerciseDate: exerciseDate,
        closeReason: 'Exercised \u2192 ' + resultSide + ' ' + underlying,
        resultingPositionId: newId
      };

      return updateRiskPositionDB(positionId, optionUpdate)
        .then(function(updatedOption) {
          // Update STATE: replace the option
          for (var i = 0; i < STATE.positions.length; i++) {
            if (STATE.positions[i].id === positionId) {
              STATE.positions[i] = updatedOption;
              break;
            }
          }
          // Push new futures position
          STATE.positions.push(created);

          closeModal();
          renderApp();
          showToast('Option exercised \u2192 ' + resultSide + ' ' + underlying + ' @ ' + _posFmtPrice(strike) + ' (eff ' + _posFmtPrice(effectiveEntry) + ')', 'success');
        });
    })
    .catch(function(err) {
      showToast('Exercise failed: ' + err.message, 'error');
    });
}

// ---- Helper functions ----

function _posFmtPrice(n) {
  if (n == null) return '\u2014';
  var num = parseFloat(n);
  if (isNaN(num)) return '\u2014';
  return num.toFixed(4);
}

function _posFmtPnl(n) {
  if (n == null) return '\u2014';
  var num = parseFloat(n);
  if (isNaN(num)) return '\u2014';
  var sign = num >= 0 ? '+' : '';
  return sign + '$' + _posFmtNumber(Math.abs(num));
}

function _posFmtNumber(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _posParseNum(val) {
  if (val === '' || val == null) return null;
  var n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function _posBuildUniqueDatalist(items, field) {
  var seen = {};
  var html = '';
  for (var i = 0; i < items.length; i++) {
    var val = items[i][field];
    if (val && !seen[val]) {
      seen[val] = true;
      html += '<option value="' + escapeAttr(val) + '">';
    }
  }
  return html;
}

function _posFindById(id) {
  if (!id || !STATE.positions) return null;
  for (var i = 0; i < STATE.positions.length; i++) {
    if (STATE.positions[i].id === id) return STATE.positions[i];
  }
  return null;
}

// ==================== POSITION ROLLING ====================

function posOpenRollModal(positionId) {
  var position = _posFindById(positionId);
  if (!position) { showToast('Position not found', 'error'); return; }

  var side = position.positionSide || 'Long';
  var sideSign = side === 'Short' ? -1 : 1;
  var contracts = position.contracts != null ? parseFloat(position.contracts) : 0;
  var entry = position.entryPrice != null ? parseFloat(position.entryPrice) : null;
  var current = position.currentPrice != null ? parseFloat(position.currentPrice) : null;
  var underlying = position.underlying || '';
  var bpc = position.bushelsPerContract != null ? parseFloat(position.bushelsPerContract) : (DEFAULT_BUSHELS_PER_CONTRACT[position.commodity] || 5000);

  var fmOpts = _grainBuildFuturesMonthOptions('');

  var html = '<h2 class="modal-title">Roll Futures Position</h2>' +

    // Info banner
    '<div class="pos-roll-info">' +
      '<strong>' + esc(side) + ' ' + contracts + ' ' + esc(underlying || position.commodity) + '</strong>' +
      ' &nbsp;|&nbsp; Entry: <strong>' + _posFmtPrice(entry) + '</strong>' +
      (current != null ? ' &nbsp;|&nbsp; Current: <strong>' + _posFmtPrice(current) + '</strong>' : '') +
      ' &nbsp;|&nbsp; ' + (contracts * bpc).toLocaleString() + ' bu' +
    '</div>' +

    '<form id="posRollForm" onsubmit="event.preventDefault()">' +

      // Near Month — Close section
      '<div class="pos-roll-section-header">Near Month \u2014 Close</div>' +
      '<div class="grain-modal-grid">' +
        '<div class="form-group">' +
          '<label class="form-label">Close Price ($/bu) *</label>' +
          '<input type="number" class="form-input" id="posRollClosePrice" step="0.0001" value="' + escapeAttr(current != null ? String(current) : '') + '" required oninput="_posRollUpdatePreview()">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Commission ($/bu total)</label>' +
          '<input type="number" class="form-input" id="posRollCommission" step="0.0001" value="0.0004" oninput="_posRollUpdatePreview()">' +
        '</div>' +
      '</div>' +

      // Deferred Month — New Position section
      '<div class="pos-roll-section-header">Deferred Month \u2014 New Position</div>' +
      '<div class="grain-modal-grid">' +
        '<div class="form-group">' +
          '<label class="form-label">New Futures Month *</label>' +
          '<select class="form-select" id="posRollNewMonth" required onchange="_posRollUpdatePreview()">' + fmOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">New Entry Price ($/bu) *</label>' +
          '<input type="number" class="form-input" id="posRollNewEntry" step="0.0001" required oninput="_posRollUpdatePreview()">' +
        '</div>' +
      '</div>' +

      // Effective Entry Preview
      '<div class="pos-roll-preview" id="posRollPreview"></div>' +

      // Notes
      '<div class="form-group">' +
        '<label class="form-label">Notes</label>' +
        '<input type="text" class="form-input" id="posRollNotes" placeholder="e.g. rolled Dec to Mar, captured carry">' +
      '</div>' +

      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button type="button" class="btn btn-primary" onclick="posConfirmRoll(\'' + escapeAttr(positionId) + '\')">Confirm Roll</button>' +
      '</div>' +
    '</form>';

  showModal(html);

  // Store data attributes for preview calculation
  setTimeout(function() {
    var previewEl = document.getElementById('posRollPreview');
    if (previewEl) {
      previewEl.setAttribute('data-entry', entry != null ? String(entry) : '');
      previewEl.setAttribute('data-side-sign', String(sideSign));
    }
    _posRollUpdatePreview();
  }, 50);
}

function _posRollUpdatePreview() {
  var previewEl = document.getElementById('posRollPreview');
  if (!previewEl) return;

  var entryPrice = parseFloat(previewEl.getAttribute('data-entry'));
  var sideSign = parseInt(previewEl.getAttribute('data-side-sign')) || 1;

  var closePrice = _posParseNum(document.getElementById('posRollClosePrice') ? document.getElementById('posRollClosePrice').value : null);
  var commission = _posParseNum(document.getElementById('posRollCommission') ? document.getElementById('posRollCommission').value : null) || 0;
  var newEntry = _posParseNum(document.getElementById('posRollNewEntry') ? document.getElementById('posRollNewEntry').value : null);

  if (isNaN(entryPrice) || closePrice == null || newEntry == null) {
    previewEl.innerHTML = '<div class="pos-roll-preview-inner" style="color:var(--text3)">Fill in close price and new entry to see effective entry preview</div>';
    return;
  }

  var realizedPnl = (closePrice - entryPrice) * sideSign - commission;
  var effectiveEntry = newEntry - realizedPnl * sideSign;

  var pnlClass = realizedPnl >= 0 ? 'pos-pnl-positive' : 'pos-pnl-negative';
  var pnlSign = realizedPnl >= 0 ? '+' : '';

  previewEl.innerHTML =
    '<div class="pos-roll-preview-inner">' +
      '<div style="display:flex;gap:24px;flex-wrap:wrap">' +
        '<div>' +
          '<div class="pos-roll-preview-label">Realized P&amp;L (near leg)</div>' +
          '<div class="' + pnlClass + '" style="font-weight:700;font-family:var(--mono)">' + pnlSign + realizedPnl.toFixed(4) + ' $/bu</div>' +
        '</div>' +
        '<div>' +
          '<div class="pos-roll-preview-label">Effective Entry (deferred)</div>' +
          '<div style="font-weight:700;font-family:var(--mono);color:var(--text)">' + effectiveEntry.toFixed(4) + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-top:6px">' +
        'Realized = (close \u2212 entry) \u00D7 side \u2212 commission &nbsp;|&nbsp; ' +
        'Effective = newEntry \u2212 realized \u00D7 side' +
      '</div>' +
    '</div>';
}

function posConfirmRoll(positionId) {
  var position = _posFindById(positionId);
  if (!position) { showToast('Position not found', 'error'); return; }

  var side = position.positionSide || 'Long';
  var sideSign = side === 'Short' ? -1 : 1;
  var entry = position.entryPrice != null ? parseFloat(position.entryPrice) : 0;
  var contracts = position.contracts != null ? parseFloat(position.contracts) : 0;
  var bpc = position.bushelsPerContract != null ? parseFloat(position.bushelsPerContract) : (DEFAULT_BUSHELS_PER_CONTRACT[position.commodity] || 5000);

  var closePrice = _posParseNum(document.getElementById('posRollClosePrice') ? document.getElementById('posRollClosePrice').value : null);
  var commission = _posParseNum(document.getElementById('posRollCommission') ? document.getElementById('posRollCommission').value : null) || 0;
  var newMonth = document.getElementById('posRollNewMonth') ? document.getElementById('posRollNewMonth').value : '';
  var newEntry = _posParseNum(document.getElementById('posRollNewEntry') ? document.getElementById('posRollNewEntry').value : null);
  var notes = document.getElementById('posRollNotes') ? document.getElementById('posRollNotes').value.trim() : '';

  // Validate
  if (closePrice == null) { showToast('Close price is required', 'error'); return; }
  if (!newMonth) { showToast('Select a new futures month', 'error'); return; }
  if (newEntry == null) { showToast('New entry price is required', 'error'); return; }

  // Calculate
  var realizedPnl = (closePrice - entry) * sideSign - commission;
  var effectiveEntry = newEntry - realizedPnl * sideSign;

  // Build new position data
  var newPositionData = {
    commodity: position.commodity,
    cropYear: position.cropYear,
    underlying: newMonth,
    contractType: 'Futures',
    positionSide: side,
    contracts: contracts,
    bushelsPerContract: bpc,
    entryPrice: newEntry,
    effectiveEntryPrice: parseFloat(effectiveEntry.toFixed(6)),
    currentPrice: null,
    delta: side === 'Long' ? 1 : -1,
    gamma: 0,
    theta: 0,
    status: 'Open',
    company: position.company || null,
    account: position.account || null,
    notes: notes || null,
    linkedContractId: position.linkedContractId || null,
    rolledFromId: positionId,
    sourceType: 'roll'
  };

  showLoading();

  // 1. Create the new deferred position
  createRiskPositionDB(newPositionData)
    .then(function(created) {
      var newId = created.id;

      // 2. Update original position — close it
      var originalUpdate = {
        status: 'Closed',
        closedPrice: closePrice,
        closeReason: 'Rolled \u2192 ' + newMonth,
        rolledToId: newId
      };

      return updateRiskPositionDB(positionId, originalUpdate)
        .then(function(updatedOriginal) {
          // Update STATE: replace the original
          for (var i = 0; i < STATE.positions.length; i++) {
            if (STATE.positions[i].id === positionId) {
              STATE.positions[i] = updatedOriginal;
              break;
            }
          }
          // Push new position
          STATE.positions.push(created);

          hideLoading();
          closeModal();
          renderApp();
          showToast('Position rolled \u2192 ' + newMonth + ' @ ' + _posFmtPrice(newEntry) + ' (eff ' + _posFmtPrice(effectiveEntry) + ')', 'success');
        });
    })
    .catch(function(err) {
      hideLoading();
      showToast('Roll failed: ' + err.message, 'error');
    });
}

// ==================== POSITION SPLITTING ====================

function posOpenSplitModal(positionId) {
  var position = _posFindById(positionId);
  if (!position) { showToast('Position not found', 'error'); return; }

  var totalContracts = position.contracts != null ? parseFloat(position.contracts) : 0;
  var side = position.positionSide || 'Long';
  var underlying = position.underlying || '';

  var html = '<h2 class="modal-title">Split Position</h2>' +

    // Info banner
    '<div class="pos-roll-info">' +
      '<strong>' + esc(side) + ' ' + totalContracts + ' ' + esc(position.contractType || 'Futures') + '</strong>' +
      ' &nbsp;|&nbsp; ' + esc(underlying || position.commodity) +
      ' &nbsp;|&nbsp; Entry: <strong>' + _posFmtPrice(position.entryPrice) + '</strong>' +
    '</div>' +

    // Piece count selector
    '<div style="display:flex;align-items:center;gap:10px;margin:8px 0">' +
      '<label style="font-size:0.85rem;font-weight:600;color:var(--text2);white-space:nowrap">Split into</label>' +
      '<select class="form-select" id="posSplitCount" style="width:auto" onchange="_posSplitRenderPieces(\'' + escapeAttr(positionId) + '\',' + totalContracts + ')">' +
        '<option value="2" selected>2 pieces</option>' +
        '<option value="3">3 pieces</option>' +
        '<option value="4">4 pieces</option>' +
      '</select>' +
    '</div>' +

    // Pieces container
    '<div id="posSplitPiecesWrap"></div>' +

    // Running total
    '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg2);border-radius:6px;font-size:0.85rem;margin:8px 0">' +
      '<span style="color:var(--text3)">Total:</span>' +
      '<span id="posSplitTotalDisplay" style="font-weight:700;color:var(--text)">0</span>' +
      '<span style="color:var(--text3)">/ ' + totalContracts + ' contracts</span>' +
      '<span id="posSplitTotalStatus" style="margin-left:4px"></span>' +
    '</div>' +

    '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="button" class="btn btn-primary" onclick="posConfirmSplit(\'' + escapeAttr(positionId) + '\',' + totalContracts + ')">Confirm Split</button>' +
    '</div>';

  showModal(html);

  // Render pieces after modal is in the DOM
  setTimeout(function() { _posSplitRenderPieces(positionId, totalContracts); }, 50);
}

function _posSplitRenderPieces(positionId, totalContracts) {
  var countEl = document.getElementById('posSplitCount');
  var n = countEl ? parseInt(countEl.value) : 2;
  var even = Math.floor(totalContracts / n);
  var html = '';

  for (var i = 0; i < n; i++) {
    var suggested = (i === n - 1) ? totalContracts - even * (n - 1) : even;
    html += '<div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;background:var(--bg1)">' +
      '<div style="font-size:0.82rem;font-weight:700;color:var(--primary);margin-bottom:8px">Piece ' + (i + 1) + '</div>' +
      '<div class="grain-modal-grid">' +
        '<div class="form-group">' +
          '<label class="form-label">Contracts *</label>' +
          '<input type="number" class="form-input" id="posSplitContracts' + i + '" min="1" step="1" value="' + suggested + '" oninput="_posSplitUpdateTotal(' + totalContracts + ')">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Notes</label>' +
          '<input type="text" class="form-input" id="posSplitNotes' + i + '" placeholder="">' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  var wrap = document.getElementById('posSplitPiecesWrap');
  if (wrap) wrap.innerHTML = html;

  _posSplitUpdateTotal(totalContracts);
}

function _posSplitUpdateTotal(totalContracts) {
  var countEl = document.getElementById('posSplitCount');
  var n = countEl ? parseInt(countEl.value) : 2;
  var sum = 0;
  for (var i = 0; i < n; i++) {
    var el = document.getElementById('posSplitContracts' + i);
    sum += el ? (parseFloat(el.value) || 0) : 0;
  }
  var disp = document.getElementById('posSplitTotalDisplay');
  var stat = document.getElementById('posSplitTotalStatus');

  if (disp) disp.textContent = sum + ' contracts';

  if (stat) {
    var diff = Math.round(sum) - Math.round(totalContracts);
    if (diff === 0) {
      stat.textContent = '\u2713 Balanced';
      stat.style.color = 'var(--green, #166534)';
    } else if (diff < 0) {
      stat.textContent = Math.abs(diff) + ' remaining';
      stat.style.color = 'var(--yellow, #d97706)';
    } else {
      stat.textContent = diff + ' over';
      stat.style.color = 'var(--red, #c53030)';
    }
  }
}

function posConfirmSplit(positionId, totalContracts) {
  var position = _posFindById(positionId);
  if (!position) { showToast('Position not found', 'error'); return; }

  var countEl = document.getElementById('posSplitCount');
  var n = countEl ? parseInt(countEl.value) : 2;

  // Validate sum
  var sum = 0;
  for (var i = 0; i < n; i++) {
    var el = document.getElementById('posSplitContracts' + i);
    sum += el ? (parseFloat(el.value) || 0) : 0;
  }
  if (Math.round(sum) !== Math.round(totalContracts)) {
    showToast('Pieces must sum to ' + totalContracts + ' contracts \u2014 currently ' + sum, 'error');
    return;
  }

  // Validate each piece > 0
  for (var i = 0; i < n; i++) {
    var cEl = document.getElementById('posSplitContracts' + i);
    if (!cEl || (parseFloat(cEl.value) || 0) <= 0) {
      showToast('Piece ' + (i + 1) + ' must have contracts > 0', 'error');
      return;
    }
  }

  // Collect piece data
  var pieces = [];
  for (var i = 0; i < n; i++) {
    var pieceContracts = parseFloat(document.getElementById('posSplitContracts' + i).value);
    var notesEl = document.getElementById('posSplitNotes' + i);
    var pieceNotes = notesEl ? (notesEl.value || '').trim() : '';

    pieces.push({
      commodity: position.commodity,
      cropYear: position.cropYear,
      underlying: position.underlying,
      contractType: position.contractType,
      positionSide: position.positionSide,
      contracts: pieceContracts,
      bushelsPerContract: position.bushelsPerContract,
      strike: position.strike,
      entryPrice: position.entryPrice,
      currentPrice: position.currentPrice,
      effectiveEntryPrice: position.effectiveEntryPrice,
      delta: position.delta,
      gamma: position.gamma,
      theta: position.theta,
      vega: position.vega,
      iv: position.iv,
      expiryDate: position.expiryDate,
      status: 'Open',
      company: position.company,
      account: position.account,
      notes: pieceNotes || position.notes || null,
      linkedContractId: position.linkedContractId,
      splitFromId: positionId
    });
  }

  // Save all children, then update parent
  showLoading();
  var childPromises = [];
  for (var i = 0; i < pieces.length; i++) {
    childPromises.push(createRiskPositionDB(pieces[i]));
  }

  Promise.all(childPromises)
    .then(function(children) {
      // Add children to STATE
      for (var j = 0; j < children.length; j++) {
        STATE.positions.push(children[j]);
      }

      // Update parent status to Closed
      return updateRiskPositionDB(positionId, {
        status: 'Split',
        closeReason: 'Split into ' + n + ' positions'
      });
    })
    .then(function(updatedParent) {
      // Update parent in STATE
      for (var k = 0; k < STATE.positions.length; k++) {
        if (STATE.positions[k].id === positionId) {
          STATE.positions[k] = updatedParent;
          break;
        }
      }

      hideLoading();
      closeModal();
      renderApp();
      showToast('Position split into ' + n + ' pieces', 'success');
    })
    .catch(function(err) {
      hideLoading();
      showToast('Failed to split position: ' + err.message, 'error');
    });
}
