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

// Cache for elevator hedges (keyed by contractId)
var _grainContractHedges = {};

// Cache for contract rolls (keyed by contractId)
var _grainContractRolls = {};

// Sub-tab state: 'contracts', 'positions', 'deliveries', 'basis', 'inputs', 'market'
var _grainSubTab = 'contracts';

// ---- Sub-tab bar ----

function _grainRenderSubTabBar() {
  var tabs = [
    { id: 'contracts',  label: 'Contracts' },
    { id: 'positions',  label: 'Positions' },
    { id: 'deliveries', label: 'Deliveries' },
    { id: 'basis',      label: 'Basis' },
    { id: 'inputs',     label: 'Inputs' },
    { id: 'market',     label: 'Market' }
  ];
  var html = '<div class="grain-subtab-bar">';
  for (var i = 0; i < tabs.length; i++) {
    var active = _grainSubTab === tabs[i].id ? ' grain-subtab-active' : '';
    html += '<button class="grain-subtab' + active + '" onclick="grainSwitchSubTab(\'' + tabs[i].id + '\')">' + esc(tabs[i].label) + '</button>';
  }
  html += '</div>';
  return html;
}

function grainSwitchSubTab(tab) {
  _grainSubTab = tab;
  renderApp();
}

// ---- Main page renderer ----

function renderMarketingPage() {
  var subTabBar = _grainRenderSubTabBar();

  switch (_grainSubTab) {
    case 'positions':  return '<div class="page-content">' + subTabBar + _posRenderContent() + '</div>';
    case 'deliveries': return '<div class="page-content">' + subTabBar + _deliveryRenderContent() + '</div>';
    case 'basis':      return '<div class="page-content">' + subTabBar + _basisRenderContent() + '</div>';
    case 'inputs':     return '<div class="page-content">' + subTabBar + _fertRenderContentForSubTab() + '</div>';
    case 'market':     return '<div class="page-content">' + subTabBar + _marketRenderContentForSubTab() + '</div>';
    default:           return _grainRenderContractsView(subTabBar);
  }
}

// Backward compatibility alias
var renderGrainPage = renderMarketingPage;

function _grainRenderContractsView(subTabBar) {
  var cropYear = STATE.activeCropYear || STATE.settings.activeCropYear || SEASON.current;
  var contracts = _grainFilterContracts(STATE.contracts || [], cropYear);

  return '<div class="page-content">' +
    subTabBar +
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
      '<th scope="col">Commodity</th>' +
      '<th scope="col">Type</th>' +
      '<th scope="col" style="text-align:right">Bushels</th>' +
      '<th scope="col" style="text-align:right">Price</th>' +
      '<th scope="col" style="text-align:right">Basis</th>' +
      '<th scope="col">Futures Mo</th>' +
      '<th scope="col">Buyer</th>' +
      '<th scope="col">Status</th>' +
      '<th scope="col">Actions</th>' +
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
        (c.status === 'Open' && (c.contractType === 'HTA' || c.contractType === 'Basis') ?
          '<button class="btn btn-secondary btn-sm" onclick="grainOpenRollModal(\'' + escapeAttr(id) + '\')">Roll</button> ' : '') +
        (c.status === 'Open' ?
          '<button class="btn btn-secondary btn-sm" onclick="grainOpenSplitModal(\'' + escapeAttr(id) + '\')">Split</button> ' : '') +
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

  // Split relationship info
  if (c.splitFromId) {
    var parentContract = null;
    for (var pi = 0; pi < STATE.contracts.length; pi++) {
      if (STATE.contracts[pi].id === c.splitFromId) {
        parentContract = STATE.contracts[pi];
        break;
      }
    }
    if (parentContract) {
      parts.push('<strong>Split from:</strong> ' + esc(parentContract.commodity) + ' ' +
        esc(parentContract.contractType) + ' ' + _grainFmtBushels(parentContract.bushels) + ' bu' +
        (parentContract.contractNumber ? ' (#' + esc(parentContract.contractNumber) + ')' : ''));
    } else {
      parts.push('<strong>Split from:</strong> (parent contract)');
    }
  }
  if (c.status === 'Split') {
    var childCount = 0;
    for (var sci = 0; sci < STATE.contracts.length; sci++) {
      if (STATE.contracts[sci].splitFromId === c.id) {
        childCount++;
      }
    }
    if (childCount > 0) {
      parts.push('<strong>Split into:</strong> ' + childCount + ' contract' + (childCount !== 1 ? 's' : ''));
    }
  }

  var detailHtml;
  if (parts.length === 0) {
    detailHtml = '<div class="grain-detail-inner"><span style="color:var(--text3)">No additional details</span></div>';
  } else {
    detailHtml = '<div class="grain-detail-inner">' + parts.join('<span class="grain-detail-sep">&middot;</span>') + '</div>';
  }

  // Roll history section (show if contract has been rolled)
  if (c.rollCount != null && parseInt(c.rollCount) > 0) {
    detailHtml += _grainRenderRollsSection(c.id);
    // Trigger async load if not yet cached
    if (!_grainContractRolls[c.id]) {
      _grainLoadRolls(c.id);
    }
  }

  // Elevator hedges section
  detailHtml += _grainRenderHedgesSection(c.id);

  // Trigger async load if not yet cached
  if (!_grainContractHedges[c.id]) {
    _grainLoadHedges(c.id);
  }

  return detailHtml;
}

// ---- Elevator Hedges Section ----

function _grainLoadHedges(contractId) {
  fetchElevatorHedgesDB(contractId)
    .then(function(hedges) {
      _grainContractHedges[contractId] = hedges || [];
      // Re-render only the hedges container for this contract
      var container = document.getElementById('hedges-' + contractId);
      if (container) {
        container.innerHTML = _grainRenderHedgesContent(contractId);
      }
    })
    .catch(function(err) {
      _grainContractHedges[contractId] = [];
      var container = document.getElementById('hedges-' + contractId);
      if (container) {
        container.innerHTML = '<span style="color:var(--red);font-size:13px">Failed to load hedges: ' + esc(err.message) + '</span>';
      }
    });
}

function _grainRenderHedgesSection(contractId) {
  return '<div class="hedge-section">' +
    '<div class="hedge-section-header">' +
      '<span class="hedge-section-title">Elevator Hedges</span>' +
      '<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); grainOpenHedgeModal(\'' + escapeAttr(contractId) + '\')">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
        ' Add Hedge' +
      '</button>' +
    '</div>' +
    '<div id="hedges-' + escapeAttr(contractId) + '">' +
      _grainRenderHedgesContent(contractId) +
    '</div>' +
  '</div>';
}

function _grainRenderHedgesContent(contractId) {
  var hedges = _grainContractHedges[contractId];

  // Not yet loaded
  if (!hedges) {
    return '<span style="color:var(--text3);font-size:13px">Loading hedges...</span>';
  }

  if (hedges.length === 0) {
    return '<span style="color:var(--text3);font-size:13px">No elevator hedges</span>';
  }

  var html = '<div class="table-wrap"><table class="hedge-table">' +
    '<thead><tr>' +
      '<th scope="col">Type</th>' +
      '<th scope="col">Symbol</th>' +
      '<th scope="col" style="text-align:right">Strike</th>' +
      '<th scope="col" style="text-align:right">Contracts</th>' +
      '<th scope="col" style="text-align:right">Entry</th>' +
      '<th scope="col" style="text-align:right">Current</th>' +
      '<th scope="col" style="text-align:right">Delta</th>' +
      '<th scope="col" style="text-align:right">Theta</th>' +
      '<th scope="col">Status</th>' +
      '<th scope="col">Actions</th>' +
    '</tr></thead>' +
    '<tbody>';

  for (var i = 0; i < hedges.length; i++) {
    var h = hedges[i];
    var statusClass = h.status === 'Open' ? 'grain-status-open' : 'hedge-status-closed';

    html += '<tr>' +
      '<td><span class="hedge-type hedge-type-' + (h.contractType === 'Call' ? 'call' : 'put') + '">' + esc(h.contractType) + '</span></td>' +
      '<td style="font-family:var(--mono);font-size:12px">' + esc(h.symbol || '') + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(h.strikePrice) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + (h.contracts != null ? esc(String(h.contracts)) : '\u2014') + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(h.entryPrice) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(h.currentPrice) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtGreek(h.delta) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtGreek(h.theta) + '</td>' +
      '<td><span class="grain-status ' + statusClass + '">' + esc(h.status) + '</span></td>' +
      '<td class="grain-actions" onclick="event.stopPropagation()">' +
        '<button class="btn btn-secondary btn-sm" onclick="grainOpenHedgeModal(\'' + escapeAttr(h.contractId) + '\', \'' + escapeAttr(h.id) + '\')">Edit</button> ' +
        '<button class="btn btn-danger btn-sm" onclick="grainDeleteHedge(\'' + escapeAttr(h.contractId) + '\', \'' + escapeAttr(h.id) + '\')">Delete</button>' +
      '</td>' +
    '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

function _grainFmtGreek(n) {
  if (n == null) return '\u2014';
  var num = parseFloat(n);
  if (isNaN(num)) return '\u2014';
  return num.toFixed(4);
}

// ---- Hedge Modal ----

function grainOpenHedgeModal(contractId, hedgeId) {
  var hedge = null;
  var isEdit = false;

  if (hedgeId) {
    var hedges = _grainContractHedges[contractId] || [];
    for (var i = 0; i < hedges.length; i++) {
      if (hedges[i].id === hedgeId) {
        hedge = hedges[i];
        break;
      }
    }
    if (!hedge) { showToast('Hedge not found', 'error'); return; }
    isEdit = true;
  }

  var title = isEdit ? 'Edit Elevator Hedge' : 'Add Elevator Hedge';
  var h = hedge || {};

  // Contract type options (Call/Put)
  var hedgeTypes = ['Call', 'Put'];
  var typeOpts = '';
  for (var ti = 0; ti < hedgeTypes.length; ti++) {
    var tSel = h.contractType === hedgeTypes[ti] ? ' selected' : '';
    typeOpts += '<option value="' + escapeAttr(hedgeTypes[ti]) + '"' + tSel + '>' + esc(hedgeTypes[ti]) + '</option>';
  }

  // Status options
  var hedgeStatuses = ['Open', 'Closed'];
  var statOpts = '';
  var defaultStatus = h.status || 'Open';
  for (var si = 0; si < hedgeStatuses.length; si++) {
    var sSel = hedgeStatuses[si] === defaultStatus ? ' selected' : '';
    statOpts += '<option value="' + escapeAttr(hedgeStatuses[si]) + '"' + sSel + '>' + esc(hedgeStatuses[si]) + '</option>';
  }

  var formAction = 'grainSaveHedge(event, \'' + escapeAttr(contractId) + '\', ' + (hedgeId ? '\'' + escapeAttr(hedgeId) + '\'' : 'null') + ')';

  var html = '<h2 class="modal-title">' + esc(title) + '</h2>' +
    '<form id="grainHedgeForm" onsubmit="' + escapeAttr(formAction) + '">' +
      '<div class="grain-modal-grid">' +
        '<div class="form-group">' +
          '<label class="form-label">Contract Type</label>' +
          '<select class="form-select" id="ghContractType">' + typeOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Symbol</label>' +
          '<input type="text" class="form-input" id="ghSymbol" placeholder="e.g. ZCN26C480" value="' + escapeAttr(h.symbol || '') + '">' +
        '</div>' +

        '<div class="form-group">' +
          '<label class="form-label">Strike Price</label>' +
          '<input type="number" class="form-input" id="ghStrikePrice" step="0.0001" value="' + escapeAttr(h.strikePrice != null ? String(h.strikePrice) : '') + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Contracts</label>' +
          '<input type="number" class="form-input" id="ghContracts" min="0" step="1" value="' + escapeAttr(h.contracts != null ? String(h.contracts) : '') + '">' +
        '</div>' +

        '<div class="form-group">' +
          '<label class="form-label">Entry Price</label>' +
          '<input type="number" class="form-input" id="ghEntryPrice" step="0.0001" value="' + escapeAttr(h.entryPrice != null ? String(h.entryPrice) : '') + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Current Price</label>' +
          '<input type="number" class="form-input" id="ghCurrentPrice" step="0.0001" value="' + escapeAttr(h.currentPrice != null ? String(h.currentPrice) : '') + '">' +
        '</div>' +

        '<div class="form-group">' +
          '<label class="form-label">Delta</label>' +
          '<input type="number" class="form-input" id="ghDelta" step="0.0001" min="-1" max="1" value="' + escapeAttr(h.delta != null ? String(h.delta) : '') + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Theta</label>' +
          '<input type="number" class="form-input" id="ghTheta" step="0.0001" value="' + escapeAttr(h.theta != null ? String(h.theta) : '') + '">' +
        '</div>' +

        '<div class="form-group">' +
          '<label class="form-label">Status</label>' +
          '<select class="form-select" id="ghStatus">' + statOpts + '</select>' +
        '</div>' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label">Notes</label>' +
        '<textarea class="form-input" id="ghNotes" rows="3">' + esc(h.notes || '') + '</textarea>' +
      '</div>' +

      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">' + (isEdit ? 'Save Changes' : 'Add Hedge') + '</button>' +
      '</div>' +
    '</form>';

  showModal(html);
}

// ---- Hedge Save ----

function grainSaveHedge(e, contractId, hedgeId) {
  e.preventDefault();

  var data = {
    contractType: document.getElementById('ghContractType').value,
    symbol: document.getElementById('ghSymbol').value.trim() || null,
    strikePrice: _grainParseNum(document.getElementById('ghStrikePrice').value),
    contracts: _grainParseNum(document.getElementById('ghContracts').value),
    entryPrice: _grainParseNum(document.getElementById('ghEntryPrice').value),
    currentPrice: _grainParseNum(document.getElementById('ghCurrentPrice').value),
    delta: _grainParseNum(document.getElementById('ghDelta').value),
    theta: _grainParseNum(document.getElementById('ghTheta').value),
    status: document.getElementById('ghStatus').value,
    notes: document.getElementById('ghNotes').value.trim() || null
  };

  if (hedgeId) {
    // Edit
    updateElevatorHedgeDB(contractId, hedgeId, data)
      .then(function(updated) {
        var hedges = _grainContractHedges[contractId] || [];
        for (var i = 0; i < hedges.length; i++) {
          if (hedges[i].id === hedgeId) {
            hedges[i] = updated;
            break;
          }
        }
        closeModal();
        renderApp();
        showToast('Hedge updated', 'success');
      })
      .catch(function(err) {
        showToast('Failed to update hedge: ' + err.message, 'error');
      });
  } else {
    // Create
    createElevatorHedgeDB(contractId, data)
      .then(function(created) {
        if (!_grainContractHedges[contractId]) {
          _grainContractHedges[contractId] = [];
        }
        _grainContractHedges[contractId].push(created);
        closeModal();
        renderApp();
        showToast('Hedge added', 'success');
      })
      .catch(function(err) {
        showToast('Failed to add hedge: ' + err.message, 'error');
      });
  }
}

// ---- Hedge Delete ----

function grainDeleteHedge(contractId, hedgeId) {
  if (!confirm('Delete this elevator hedge? This cannot be undone.')) return;

  deleteElevatorHedgeDB(contractId, hedgeId)
    .then(function() {
      var hedges = _grainContractHedges[contractId] || [];
      _grainContractHedges[contractId] = hedges.filter(function(h) { return h.id !== hedgeId; });
      renderApp();
      showToast('Hedge deleted', 'success');
    })
    .catch(function(err) {
      showToast('Failed to delete hedge: ' + err.message, 'error');
    });
}

// ---- Contract Roll Section ----

function _grainLoadRolls(contractId) {
  fetchContractRollsDB(contractId)
    .then(function(rolls) {
      _grainContractRolls[contractId] = rolls || [];
      var container = document.getElementById('rolls-' + contractId);
      if (container) {
        container.innerHTML = _grainRenderRollsContent(contractId);
      }
    })
    .catch(function(err) {
      _grainContractRolls[contractId] = [];
      var container = document.getElementById('rolls-' + contractId);
      if (container) {
        container.innerHTML = '<span style="color:var(--red);font-size:13px">Failed to load rolls: ' + esc(err.message) + '</span>';
      }
    });
}

function _grainRenderRollsSection(contractId) {
  return '<div class="hedge-section">' +
    '<div class="hedge-section-header">' +
      '<span class="hedge-section-title">Roll History</span>' +
    '</div>' +
    '<div id="rolls-' + escapeAttr(contractId) + '">' +
      _grainRenderRollsContent(contractId) +
    '</div>' +
  '</div>';
}

function _grainRenderRollsContent(contractId) {
  var rolls = _grainContractRolls[contractId];

  // Not yet loaded
  if (!rolls) {
    return '<span style="color:var(--text3);font-size:13px">Loading roll history...</span>';
  }

  if (rolls.length === 0) {
    return '<span style="color:var(--text3);font-size:13px">No roll history</span>';
  }

  var html = '<div class="table-wrap"><table class="hedge-table">' +
    '<thead><tr>' +
      '<th>Date</th>' +
      '<th>From</th>' +
      '<th></th>' +
      '<th>To</th>' +
      '<th style="text-align:right">Spread</th>' +
      '<th style="text-align:right">Fee</th>' +
      '<th style="text-align:right">New Price</th>' +
      '<th>Notes</th>' +
    '</tr></thead>' +
    '<tbody>';

  for (var i = 0; i < rolls.length; i++) {
    var r = rolls[i];
    var spreadStr = r.spread != null ? (parseFloat(r.spread) >= 0 ? '+' : '') + parseFloat(r.spread).toFixed(4) : '\u2014';

    html += '<tr>' +
      '<td>' + esc(r.rollDate || '') + '</td>' +
      '<td style="font-family:var(--mono);font-size:12px">' + esc(r.fromMonth || '') + '</td>' +
      '<td style="color:var(--text3)">\u2192</td>' +
      '<td style="font-family:var(--mono);font-size:12px">' + esc(r.toMonth || '') + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + spreadStr + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(r.fee) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(r.newFuturesPrice) + '</td>' +
      '<td>' + esc(r.notes || '') + '</td>' +
    '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

// ---- Roll Modal ----

function grainOpenRollModal(contractId) {
  var contract = null;
  for (var i = 0; i < STATE.contracts.length; i++) {
    if (STATE.contracts[i].id === contractId) {
      contract = STATE.contracts[i];
      break;
    }
  }
  if (!contract) { showToast('Contract not found', 'error'); return; }

  var fromMonth = contract.futuresMonth || '';
  var currentFutPrice = contract.futuresPrice != null ? parseFloat(contract.futuresPrice) : null;
  var priceDisplay = currentFutPrice != null ? _grainFmtPrice(currentFutPrice) : '\u2014';

  // Today's date in YYYY-MM-DD
  var now = new Date();
  var todayStr = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  var fmOpts = _grainBuildFuturesMonthOptions('');

  var html = '<h2 class="modal-title">Roll Contract</h2>' +
    '<div class="grain-roll-info">' +
      '<strong>' + esc(contract.contractType) + '</strong> \u2014 ' +
      esc(contract.commodity) + ' \u2014 ' +
      _grainFmtBushels(contract.bushels) + ' bu' +
      (fromMonth ? ' &nbsp;|&nbsp; Month: <strong>' + esc(fromMonth) + '</strong>' : '') +
      (currentFutPrice != null ? ' &nbsp;|&nbsp; Futures: <strong>' + esc(priceDisplay) + '</strong>' : '') +
    '</div>' +
    '<form id="grainRollForm" onsubmit="grainSaveRoll(event, \'' + escapeAttr(contractId) + '\')">' +
      '<div class="grain-modal-grid">' +
        '<div class="form-group">' +
          '<label class="form-label">Roll Date</label>' +
          '<input type="date" class="form-input" id="grRollDate" value="' + escapeAttr(todayStr) + '" required>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">From Month</label>' +
          '<input type="text" class="form-input" id="grFromMonth" value="' + escapeAttr(fromMonth) + '" readonly style="background:var(--bg2);color:var(--text3)">' +
        '</div>' +

        '<div class="form-group">' +
          '<label class="form-label">To Month (deferred)</label>' +
          '<select class="form-select" id="grToMonth" required>' + fmOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Spread \u2014 deferred minus near ($/bu)</label>' +
          '<input type="number" class="form-input" id="grSpread" step="0.0001" placeholder="e.g. 0.1200" oninput="_grainUpdateRollPreview()" required>' +
        '</div>' +

        '<div class="form-group">' +
          '<label class="form-label">Fee ($/bu)</label>' +
          '<input type="number" class="form-input" id="grFee" step="0.0001" value="0.02" oninput="_grainUpdateRollPreview()">' +
        '</div>' +
        '<div class="form-group grain-roll-preview">' +
          '<label class="form-label">New Futures Price Preview</label>' +
          '<strong id="grPricePreview" style="font-size:1rem">' + esc(priceDisplay) + '</strong>' +
          '<div style="font-size:11px;color:var(--text3);margin-top:2px">= old price + spread \u2212 fee</div>' +
        '</div>' +

        '<div class="form-group">' +
          '<label class="form-label">New Delivery Start</label>' +
          '<input type="date" class="form-input" id="grDeliveryStart" value="' + escapeAttr(contract.deliveryDate || '') + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">New Delivery End</label>' +
          '<input type="date" class="form-input" id="grDeliveryEnd" value="' + escapeAttr(contract.deliveryDateEnd || '') + '">' +
        '</div>' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label">Notes</label>' +
        '<input type="text" class="form-input" id="grNotes" placeholder="e.g. Dec \u2192 Mar, captured 12\u00A2 carry">' +
      '</div>' +

      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">Confirm Roll</button>' +
      '</div>' +
    '</form>';

  // Store current futures price on a data attribute for the preview function
  showModal(html);

  // Store the old price for preview calculation after modal renders
  var previewEl = document.getElementById('grPricePreview');
  if (previewEl) previewEl.setAttribute('data-old-price', currentFutPrice != null ? String(currentFutPrice) : '');
}

function _grainUpdateRollPreview() {
  var previewEl = document.getElementById('grPricePreview');
  if (!previewEl) return;

  var oldPrice = parseFloat(previewEl.getAttribute('data-old-price'));
  var spread = parseFloat(document.getElementById('grSpread').value);
  var fee = parseFloat(document.getElementById('grFee').value) || 0;

  if (!isNaN(oldPrice) && !isNaN(spread)) {
    var newPrice = oldPrice + spread - fee;
    previewEl.textContent = newPrice.toFixed(4);
  } else {
    previewEl.textContent = '\u2014';
  }
}

// ---- Roll Save ----

function grainSaveRoll(e, contractId) {
  e.preventDefault();

  var contract = null;
  for (var i = 0; i < STATE.contracts.length; i++) {
    if (STATE.contracts[i].id === contractId) {
      contract = STATE.contracts[i];
      break;
    }
  }
  if (!contract) { showToast('Contract not found', 'error'); return; }

  var toMonth = document.getElementById('grToMonth').value;
  var spread = _grainParseNum(document.getElementById('grSpread').value);
  var fee = _grainParseNum(document.getElementById('grFee').value) || 0;

  if (!toMonth) { showToast('Select a To Month', 'error'); return; }
  if (spread == null) { showToast('Enter the market spread', 'error'); return; }

  var oldPrice = contract.futuresPrice != null ? parseFloat(contract.futuresPrice) : 0;
  var newFuturesPrice = parseFloat((oldPrice + spread - fee).toFixed(6));

  var rollData = {
    rollDate: document.getElementById('grRollDate').value || null,
    fromMonth: document.getElementById('grFromMonth').value || null,
    toMonth: toMonth,
    spread: spread,
    fee: fee,
    newFuturesPrice: newFuturesPrice,
    notes: document.getElementById('grNotes').value.trim() || null
  };

  var contractUpdate = {
    futuresMonth: toMonth,
    futuresPrice: newFuturesPrice,
    rollCount: (parseInt(contract.rollCount) || 0) + 1
  };

  // Also update delivery dates if changed
  var newDeliveryStart = document.getElementById('grDeliveryStart').value || null;
  var newDeliveryEnd = document.getElementById('grDeliveryEnd').value || null;
  if (newDeliveryStart) contractUpdate.deliveryDate = newDeliveryStart;
  if (newDeliveryEnd) contractUpdate.deliveryDateEnd = newDeliveryEnd;

  // Create roll record, then update contract
  createContractRollDB(contractId, rollData)
    .then(function(createdRoll) {
      // Add to rolls cache
      if (!_grainContractRolls[contractId]) {
        _grainContractRolls[contractId] = [];
      }
      _grainContractRolls[contractId].push(createdRoll);

      // Now update the contract
      return updateRiskContractDB(contractId, contractUpdate);
    })
    .then(function(updatedContract) {
      // Update contract in STATE
      for (var i = 0; i < STATE.contracts.length; i++) {
        if (STATE.contracts[i].id === contractId) {
          STATE.contracts[i] = updatedContract;
          break;
        }
      }

      // Ensure row is expanded to show roll history
      _grainExpandedRows[contractId] = true;

      closeModal();
      renderApp();
      showToast('Contract rolled to ' + toMonth + ' @ ' + newFuturesPrice.toFixed(4), 'success');
    })
    .catch(function(err) {
      showToast('Failed to roll contract: ' + err.message, 'error');
    });
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
  var showBasis = cType === 'HTA' || cType === 'Basis' || cType === 'Min Price' || cType === 'Accumulator';
  var showFutMo = cType === 'HTA' || cType === 'Basis' || cType === 'Min Price' || cType === 'Accumulator';
  var showStrike = cType === 'Min Price' || cType === 'Accumulator';
  var showPremium = cType === 'Min Price';

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

        // Strike Price (conditional — Min Price, Accumulator)
        '<div class="form-group grain-field-strike" id="gcStrikePriceGroup" style="' + (showStrike ? '' : 'display:none') + '">' +
          '<label class="form-label" id="gcStrikePriceLabel">' + (cType === 'Accumulator' ? 'Accumulator Floor' : 'Floor/Strike') + '</label>' +
          '<input type="number" class="form-input" id="gcStrikePrice" step="0.0001" value="' + escapeAttr(c.strikePrice != null ? String(c.strikePrice) : '') + '">' +
        '</div>' +

        // Premium (conditional — Min Price only)
        '<div class="form-group grain-field-premium" id="gcPremiumGroup" style="' + (showPremium ? '' : 'display:none') + '">' +
          '<label class="form-label">Premium</label>' +
          '<input type="number" class="form-input" id="gcPremium" step="0.0001" value="' + escapeAttr(c.premium != null ? String(c.premium) : '') + '">' +
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
  var strikeGroup = document.getElementById('gcStrikePriceGroup');
  var premiumGroup = document.getElementById('gcPremiumGroup');
  var strikeLabel = document.getElementById('gcStrikePriceLabel');

  if (!cashGroup || !futuresGroup || !basisGroup || !futMoGroup) return;

  // Reset all to hidden
  cashGroup.style.display = 'none';
  futuresGroup.style.display = 'none';
  basisGroup.style.display = 'none';
  futMoGroup.style.display = 'none';
  if (strikeGroup) strikeGroup.style.display = 'none';
  if (premiumGroup) premiumGroup.style.display = 'none';

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
    case 'Min Price':
      basisGroup.style.display = '';
      futMoGroup.style.display = '';
      if (strikeGroup) strikeGroup.style.display = '';
      if (premiumGroup) premiumGroup.style.display = '';
      if (strikeLabel) strikeLabel.textContent = 'Floor/Strike';
      break;
    case 'Accumulator':
      basisGroup.style.display = '';
      futMoGroup.style.display = '';
      if (strikeGroup) strikeGroup.style.display = '';
      if (strikeLabel) strikeLabel.textContent = 'Accumulator Floor';
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
    strikePrice: _grainParseNum(document.getElementById('gcStrikePrice').value),
    premium: _grainParseNum(document.getElementById('gcPremium').value),
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

// ==================== CONTRACT SPLITTING ====================

function grainOpenSplitModal(contractId) {
  var c = null;
  for (var i = 0; i < STATE.contracts.length; i++) {
    if (STATE.contracts[i].id === contractId) {
      c = STATE.contracts[i];
      break;
    }
  }
  if (!c) { showToast('Contract not found', 'error'); return; }

  var totalBu = parseFloat(c.bushels) || 0;

  // Build price display
  var priceStr = '\u2014';
  if (c.cashPrice != null) priceStr = _grainFmtPrice(c.cashPrice);
  else if (c.futuresPrice != null) priceStr = _grainFmtPrice(c.futuresPrice) + ' F';
  else if (c.basisLevel != null) priceStr = 'Basis ' + _grainFmtPrice(c.basisLevel);

  // Elevator datalist
  var elevatorDl = '<datalist id="dlSplitElevators">' + _grainBuildElevatorDatalist() + '</datalist>';

  var html = '<h2 class="modal-title">Split Contract</h2>' +
    elevatorDl +
    '<div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px">' +
      '<div style="font-weight:700;color:var(--text)">' +
        esc(c.commodity) + ' \u2014 ' + esc(c.contractType) + ' \u2014 ' +
        _grainFmtBushels(totalBu) + ' bu @ ' + priceStr +
      '</div>' +
      '<div style="font-size:0.82rem;color:var(--text3);margin-top:4px">' +
        (c.buyerName ? esc(c.buyerName) + ' \u00B7 ' : '') +
        (c.deliveryDate || 'No delivery date') +
        (c.account ? ' \u00B7 ' + esc(c.account) : '') +
      '</div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;gap:10px;margin:8px 0">' +
      '<label style="font-size:0.85rem;font-weight:600;color:var(--text2);white-space:nowrap">Split into</label>' +
      '<select class="form-select" id="gsSplitCount" style="width:auto" onchange="_grainSplitRenderPieces(\'' + escapeAttr(contractId) + '\',' + totalBu + ')">' +
        '<option value="2" selected>2 pieces</option>' +
        '<option value="3">3 pieces</option>' +
        '<option value="4">4 pieces</option>' +
        '<option value="5">5 pieces</option>' +
        '<option value="6">6 pieces</option>' +
      '</select>' +
    '</div>' +
    '<div id="gsSplitPiecesWrap"></div>' +
    '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg2);border-radius:6px;font-size:0.85rem;margin:8px 0">' +
      '<span style="color:var(--text3)">Total:</span>' +
      '<span id="gsSplitTotalDisplay" style="font-weight:700;color:var(--text)">0</span>' +
      '<span style="color:var(--text3)">/ ' + _grainFmtBushels(totalBu) + ' bu</span>' +
      '<span id="gsSplitTotalStatus" style="margin-left:4px"></span>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="button" class="btn btn-primary" onclick="_grainSplitSave(\'' + escapeAttr(contractId) + '\',' + totalBu + ')">Confirm Split</button>' +
    '</div>';

  showModal(html);

  // Render pieces after modal is in the DOM
  setTimeout(function() { _grainSplitRenderPieces(contractId, totalBu); }, 50);
}

function _grainSplitRenderPieces(contractId, totalBu) {
  var c = null;
  for (var i = 0; i < STATE.contracts.length; i++) {
    if (STATE.contracts[i].id === contractId) {
      c = STATE.contracts[i];
      break;
    }
  }
  if (!c) return;

  var countEl = document.getElementById('gsSplitCount');
  var n = countEl ? parseInt(countEl.value) : 2;
  var even = Math.floor(totalBu / n);
  var html = '';

  for (var i = 0; i < n; i++) {
    var suggested = (i === n - 1) ? totalBu - even * (n - 1) : even;
    html += '<div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;background:var(--bg1)">' +
      '<div style="font-size:0.82rem;font-weight:700;color:var(--primary);margin-bottom:8px">Piece ' + (i + 1) + '</div>' +
      '<div class="grain-modal-grid">' +
        '<div class="form-group">' +
          '<label class="form-label">Bushels *</label>' +
          '<input type="number" class="form-input" id="gsSplitBu' + i + '" min="0.01" step="1" value="' + suggested + '" oninput="_grainSplitUpdateTotal(' + totalBu + ')">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Buyer / Elevator</label>' +
          '<input type="text" class="form-input" id="gsSplitElev' + i + '" value="' + escapeAttr(c.buyerName || '') + '" list="dlSplitElevators">' +
        '</div>' +
      '</div>' +
      '<div class="grain-modal-grid">' +
        '<div class="form-group">' +
          '<label class="form-label">Delivery Date</label>' +
          '<input type="date" class="form-input" id="gsSplitDate' + i + '" value="' + escapeAttr(c.deliveryDate || '') + '">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Contract # Suffix</label>' +
          '<input type="text" class="form-input" id="gsSplitCnum' + i + '" placeholder="e.g. -A" style="max-width:120px">' +
        '</div>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Notes</label>' +
        '<input type="text" class="form-input" id="gsSplitNotes' + i + '" placeholder="">' +
      '</div>' +
    '</div>';
  }

  var wrap = document.getElementById('gsSplitPiecesWrap');
  if (wrap) wrap.innerHTML = html;

  _grainSplitUpdateTotal(totalBu);
}

function _grainSplitUpdateTotal(totalBu) {
  var countEl = document.getElementById('gsSplitCount');
  var n = countEl ? parseInt(countEl.value) : 2;
  var sum = 0;
  for (var i = 0; i < n; i++) {
    var el = document.getElementById('gsSplitBu' + i);
    sum += el ? (parseFloat(el.value) || 0) : 0;
  }
  var disp = document.getElementById('gsSplitTotalDisplay');
  var stat = document.getElementById('gsSplitTotalStatus');

  if (disp) disp.textContent = _grainFmtBushels(sum) + ' bu';

  if (stat) {
    var diff = Math.round(sum) - Math.round(totalBu);
    if (diff === 0) {
      stat.textContent = '\u2713 Balanced';
      stat.style.color = 'var(--green, #166534)';
    } else if (diff < 0) {
      stat.textContent = _grainFmtBushels(Math.abs(diff)) + ' bu remaining';
      stat.style.color = 'var(--yellow, #d97706)';
    } else {
      stat.textContent = _grainFmtBushels(diff) + ' bu over';
      stat.style.color = 'var(--red, #c53030)';
    }
  }
}

function _grainSplitSave(contractId, totalBu) {
  var c = null;
  for (var i = 0; i < STATE.contracts.length; i++) {
    if (STATE.contracts[i].id === contractId) {
      c = STATE.contracts[i];
      break;
    }
  }
  if (!c) { showToast('Contract not found', 'error'); return; }

  var countEl = document.getElementById('gsSplitCount');
  var n = countEl ? parseInt(countEl.value) : 2;

  // Validate sum
  var sum = 0;
  for (var i = 0; i < n; i++) {
    var el = document.getElementById('gsSplitBu' + i);
    sum += el ? (parseFloat(el.value) || 0) : 0;
  }
  if (Math.round(sum) !== Math.round(totalBu)) {
    showToast('Pieces must sum to ' + _grainFmtBushels(totalBu) + ' bu \u2014 currently ' + _grainFmtBushels(sum) + ' bu', 'error');
    return;
  }

  // Validate each piece > 0
  for (var i = 0; i < n; i++) {
    var buEl = document.getElementById('gsSplitBu' + i);
    if (!buEl || (parseFloat(buEl.value) || 0) <= 0) {
      showToast('Piece ' + (i + 1) + ' must have bushels > 0', 'error');
      return;
    }
  }

  // Collect piece data
  var pieces = [];
  for (var i = 0; i < n; i++) {
    var bu = parseFloat(document.getElementById('gsSplitBu' + i).value);
    var elevEl = document.getElementById('gsSplitElev' + i);
    var elev = elevEl ? (elevEl.value || '').trim() : '';
    var dateEl = document.getElementById('gsSplitDate' + i);
    var delivDate = dateEl ? (dateEl.value || '') : '';
    var cnumEl = document.getElementById('gsSplitCnum' + i);
    var cnumSuffix = cnumEl ? (cnumEl.value || '').trim() : '';
    var notesEl = document.getElementById('gsSplitNotes' + i);
    var notes = notesEl ? (notesEl.value || '').trim() : '';

    pieces.push({
      bushels: bu,
      buyerName: elev || c.buyerName || null,
      deliveryDate: delivDate || c.deliveryDate || null,
      deliveryDateEnd: c.deliveryDateEnd || null,
      contractNumber: c.contractNumber ? c.contractNumber + cnumSuffix : (cnumSuffix || null),
      notes: notes || null,
      // Inherited from parent
      commodity: c.commodity,
      cropYear: c.cropYear,
      contractType: c.contractType,
      cashPrice: c.cashPrice,
      futuresPrice: c.futuresPrice,
      basisLevel: c.basisLevel,
      futuresMonth: c.futuresMonth,
      strikePrice: c.strikePrice,
      premium: c.premium,
      strategy: c.strategy,
      company: c.company,
      account: c.account,
      splitFromId: contractId,
      status: 'Open'
    });
  }

  // Save all children, then update parent
  showLoading();
  var childPromises = [];
  for (var i = 0; i < pieces.length; i++) {
    childPromises.push(createRiskContractDB(pieces[i]));
  }

  Promise.all(childPromises)
    .then(function(children) {
      // Add children to STATE
      for (var j = 0; j < children.length; j++) {
        STATE.contracts.push(children[j]);
      }

      // Update parent status to 'Split'
      return updateRiskContractDB(contractId, { status: 'Split' });
    })
    .then(function(updatedParent) {
      // Update parent in STATE
      for (var k = 0; k < STATE.contracts.length; k++) {
        if (STATE.contracts[k].id === contractId) {
          STATE.contracts[k] = updatedParent;
          break;
        }
      }

      hideLoading();
      closeModal();
      renderApp();
      showToast('Contract split into ' + n + ' pieces', 'success');
    })
    .catch(function(err) {
      hideLoading();
      showToast('Failed to split contract: ' + err.message, 'error');
    });
}
