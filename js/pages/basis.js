// ==================== HOLMES RISK — BASIS PAGE ====================

// Module-level state
var _basisSelectedCommodity = 'Corn';
var _basisData = null;        // cached /market/basis response
var _basisHistoryData = null; // cached /market/basis-history response
var _basisLoading = false;

// ---- Main page renderer ----

function _basisRenderContent() {
  // Kick off data fetch (will update DOM when done)
  _basisFetchAll(_basisSelectedCommodity);

  return '<div class="section-header">' +
      '<h2 class="section-title">Basis Analysis</h2>' +
      '<button class="btn btn-secondary btn-sm" onclick="basisRefresh()">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>' +
        ' Refresh' +
      '</button>' +
    '</div>' +
    _basisRenderCommoditySelector() +
    '<div id="basisCurrentContainer">' +
      _basisRenderCurrentSection() +
    '</div>' +
    '<div id="basisElevatorContainer">' +
      _basisRenderElevatorSection() +
    '</div>' +
    '<div id="basisHistoryContainer">' +
      _basisRenderHistorySection() +
    '</div>';
}

function renderBasisPage() {
  return '<div class="page-content">' + _basisRenderContent() + '</div>';
}

// ---- Commodity Selector ----

function _basisRenderCommoditySelector() {
  var html = '<div class="market-commodity-bar">';
  for (var i = 0; i < DEFAULT_COMMODITIES.length; i++) {
    var comm = DEFAULT_COMMODITIES[i];
    var color = COMMODITY_COLORS[comm] || 'var(--text)';
    var active = comm === _basisSelectedCommodity ? ' market-comm-active' : '';
    html += '<button class="market-comm-btn' + active + '" onclick="basisSelectCommodity(\'' + escapeAttr(comm) + '\')">' +
      '<span class="market-comm-dot" style="background:' + color + '"></span>' +
      esc(comm) +
    '</button>';
  }
  html += '</div>';
  return html;
}

// ---- Current Basis Section ----

function _basisRenderCurrentSection() {
  var html = '<div class="basis-section">' +
    '<h3 class="basis-section-title">Current Regional Basis</h3>';

  if (_basisLoading) {
    html += '<div class="market-loading">' +
      '<div class="loading-spinner"></div>' +
      '<p>Loading basis data\u2026</p>' +
    '</div>';
    html += '</div>';
    return html;
  }

  if (!_basisData || !_basisFilterByCommodity(_basisData).length) {
    html += '<div class="market-empty">' +
      '<p>No basis data available for ' + esc(_basisSelectedCommodity) + '</p>' +
    '</div>';
    html += '</div>';
    return html;
  }

  var filtered = _basisFilterByCommodity(_basisData);

  html += '<div class="table-wrap">' +
    '<table class="basis-table">' +
    '<thead><tr>' +
      '<th>Location</th>' +
      '<th>Cash Price</th>' +
      '<th>Basis</th>' +
      '<th>Delivery Month</th>' +
      '<th>Updated</th>' +
    '</tr></thead>' +
    '<tbody>';

  for (var i = 0; i < filtered.length; i++) {
    var row = filtered[i];
    var basisVal = _basisParseBasis(row);
    var basisHtml = _basisFmtBasis(basisVal);

    html += '<tr>' +
      '<td>' + esc(row.location || row.region || row.elevator || '\u2014') + '</td>' +
      '<td class="basis-mono">' + _basisFmtPrice(row.cashPrice || row.cash_price || row.cash) + '</td>' +
      '<td class="basis-mono">' + basisHtml + '</td>' +
      '<td>' + esc(row.deliveryMonth || row.delivery_month || row.month || '\u2014') + '</td>' +
      '<td class="basis-meta">' + _basisFmtDate(row.updatedAt || row.updated_at || row.date) + '</td>' +
    '</tr>';
  }

  html += '</tbody></table></div>';
  html += '</div>';
  return html;
}

// ---- Buyer / Elevator Basis Section ----

function _basisRenderElevatorSection() {
  var elevators = [];
  try { elevators = JSON.parse(STATE.settings.elevators || '[]'); } catch(e) {}

  var html = '<div class="basis-section">' +
    '<h3 class="basis-section-title">Elevator Basis</h3>';

  if (!elevators.length) {
    html += '<div class="market-empty">' +
      '<p>No elevators configured. Add elevators in Settings.</p>' +
    '</div>';
    html += '</div>';
    return html;
  }

  html += '<div class="basis-elevator-grid">';
  for (var i = 0; i < elevators.length; i++) {
    var elev = elevators[i];
    var name = typeof elev === 'string' ? elev : (elev.name || elev.label || 'Elevator');

    // Try to match elevator data from API response
    var elevBasis = _basisFindElevatorData(name);

    html += '<div class="basis-elevator-card">' +
      '<div class="basis-elevator-name">' + esc(name) + '</div>';

    if (elevBasis) {
      html += '<div class="basis-elevator-data">' +
        '<div class="basis-elevator-row">' +
          '<span class="basis-elevator-label">Cash</span>' +
          '<span class="basis-elevator-value basis-mono">' + _basisFmtPrice(elevBasis.cashPrice || elevBasis.cash_price || elevBasis.cash) + '</span>' +
        '</div>' +
        '<div class="basis-elevator-row">' +
          '<span class="basis-elevator-label">Basis</span>' +
          '<span class="basis-elevator-value basis-mono">' + _basisFmtBasis(_basisParseBasis(elevBasis)) + '</span>' +
        '</div>' +
      '</div>';
    } else {
      html += '<div class="basis-elevator-placeholder">No posted basis</div>';
    }

    html += '</div>';
  }
  html += '</div>';

  html += '</div>';
  return html;
}

// ---- Seasonal Basis History Section ----

function _basisRenderHistorySection() {
  var html = '<div class="basis-section">' +
    '<h3 class="basis-section-title">Seasonal Basis History</h3>';

  if (_basisLoading) {
    html += '<div class="market-loading">' +
      '<div class="loading-spinner"></div>' +
      '<p>Loading history\u2026</p>' +
    '</div>';
    html += '</div>';
    return html;
  }

  if (!_basisHistoryData || !_basisFilterHistoryByCommodity(_basisHistoryData).length) {
    html += '<div class="market-empty">' +
      '<p>No basis history available for ' + esc(_basisSelectedCommodity) + '</p>' +
    '</div>';
    html += '</div>';
    return html;
  }

  var filtered = _basisFilterHistoryByCommodity(_basisHistoryData);

  html += '<div class="table-wrap">' +
    '<table class="basis-table">' +
    '<thead><tr>' +
      '<th>Month</th>' +
      '<th>Current</th>' +
      '<th>1-Yr Ago</th>' +
      '<th>2-Yr Ago</th>' +
      '<th>3-Yr Avg</th>' +
      '<th>Percentile</th>' +
    '</tr></thead>' +
    '<tbody>';

  for (var i = 0; i < filtered.length; i++) {
    var row = filtered[i];
    var current = _basisParseNum(row.current || row.currentBasis || row.current_basis);
    var yr1 = _basisParseNum(row.year1 || row.oneYearAgo || row.one_year_ago || row.yr1);
    var yr2 = _basisParseNum(row.year2 || row.twoYearAgo || row.two_year_ago || row.yr2);
    var avg3 = _basisParseNum(row.avg3 || row.threeYearAvg || row.three_year_avg || row.average);
    var pct = _basisParseNum(row.percentile || row.pct);

    // Color-code current vs average
    var currentCls = '';
    if (current != null && avg3 != null) {
      currentCls = current > avg3 ? ' basis-stronger' : (current < avg3 ? ' basis-weaker' : '');
    }

    html += '<tr>' +
      '<td>' + esc(row.month || row.label || '\u2014') + '</td>' +
      '<td class="basis-mono' + currentCls + '">' + _basisFmtCents(current) + '</td>' +
      '<td class="basis-mono">' + _basisFmtCents(yr1) + '</td>' +
      '<td class="basis-mono">' + _basisFmtCents(yr2) + '</td>' +
      '<td class="basis-mono">' + _basisFmtCents(avg3) + '</td>' +
      '<td class="basis-mono">' + _basisFmtPercentile(pct) + '</td>' +
    '</tr>';
  }

  html += '</tbody></table></div>';
  html += '</div>';
  return html;
}

// ---- Data Fetching ----

function _basisFetchAll(commodity) {
  _basisLoading = true;
  _basisUpdateAll();

  var basisDone = false;
  var historyDone = false;

  function checkDone() {
    if (basisDone && historyDone) {
      _basisLoading = false;
      _basisUpdateAll();
    }
  }

  fetchBasisDB()
    .then(function(data) {
      _basisData = Array.isArray(data) ? data : (data && data.data ? data.data : []);
      basisDone = true;
      checkDone();
    })
    .catch(function(err) {
      _basisData = [];
      basisDone = true;
      checkDone();
      showToast('Failed to load basis data: ' + err.message, 'error');
    });

  fetchBasisHistoryDB()
    .then(function(data) {
      _basisHistoryData = Array.isArray(data) ? data : (data && data.data ? data.data : []);
      historyDone = true;
      checkDone();
    })
    .catch(function(err) {
      _basisHistoryData = [];
      historyDone = true;
      checkDone();
      showToast('Failed to load basis history: ' + err.message, 'error');
    });
}

function _basisUpdateAll() {
  var currentEl = document.getElementById('basisCurrentContainer');
  if (currentEl) currentEl.innerHTML = _basisRenderCurrentSection();

  var elevEl = document.getElementById('basisElevatorContainer');
  if (elevEl) elevEl.innerHTML = _basisRenderElevatorSection();

  var histEl = document.getElementById('basisHistoryContainer');
  if (histEl) histEl.innerHTML = _basisRenderHistorySection();
}

// ---- Public Actions ----

function basisSelectCommodity(commodity) {
  _basisSelectedCommodity = commodity;

  // Update active state on commodity buttons without full re-render
  var btns = document.querySelectorAll('.market-comm-btn');
  for (var i = 0; i < btns.length; i++) {
    var btn = btns[i];
    if (btn.textContent.trim() === commodity) {
      btn.classList.add('market-comm-active');
    } else {
      btn.classList.remove('market-comm-active');
    }
  }

  // Re-render data sections with commodity filter (no refetch needed, just re-filter cached data)
  if (_basisData || _basisHistoryData) {
    _basisUpdateAll();
  } else {
    _basisFetchAll(commodity);
  }
}

function basisRefresh() {
  _basisData = null;
  _basisHistoryData = null;
  _basisFetchAll(_basisSelectedCommodity);
}

// ---- Filtering Helpers ----

function _basisFilterByCommodity(data) {
  if (!data || !data.length) return [];
  var comm = _basisSelectedCommodity.toLowerCase();
  var filtered = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rowComm = (row.commodity || row.Commodity || '').toLowerCase();
    if (!rowComm || rowComm === comm) {
      filtered.push(row);
    }
  }
  // If no commodity field, return all data (API may not filter by commodity)
  return filtered.length ? filtered : data;
}

function _basisFilterHistoryByCommodity(data) {
  if (!data || !data.length) return [];
  var comm = _basisSelectedCommodity.toLowerCase();
  var filtered = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var rowComm = (row.commodity || row.Commodity || '').toLowerCase();
    if (!rowComm || rowComm === comm) {
      filtered.push(row);
    }
  }
  return filtered.length ? filtered : data;
}

function _basisFindElevatorData(elevatorName) {
  if (!_basisData || !_basisData.length) return null;
  var name = elevatorName.toLowerCase();
  for (var i = 0; i < _basisData.length; i++) {
    var row = _basisData[i];
    var loc = (row.location || row.elevator || row.region || '').toLowerCase();
    if (loc === name || loc.indexOf(name) !== -1 || name.indexOf(loc) !== -1) {
      var comm = (row.commodity || row.Commodity || '').toLowerCase();
      if (!comm || comm === _basisSelectedCommodity.toLowerCase()) {
        return row;
      }
    }
  }
  return null;
}

// ---- Formatters ----

function _basisFmtPrice(val) {
  if (val == null) return '\u2014';
  var n = parseFloat(val);
  if (isNaN(n)) return '\u2014';
  return n.toFixed(4);
}

function _basisParseBasis(row) {
  // Try various field names for basis value
  var val = row.basis != null ? row.basis :
            row.basisLevel != null ? row.basisLevel :
            row.basis_level != null ? row.basis_level : null;
  if (val == null) return null;
  var n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function _basisFmtBasis(val) {
  if (val == null) return '<span>\u2014</span>';
  var sign = val > 0 ? '+' : '';
  var cls = val > 0 ? 'basis-positive' : (val < 0 ? 'basis-negative' : '');
  return '<span class="' + cls + '">' + sign + val.toFixed(0) + '</span>';
}

function _basisFmtCents(val) {
  if (val == null) return '\u2014';
  var sign = val > 0 ? '+' : '';
  return sign + val.toFixed(0);
}

function _basisFmtPercentile(val) {
  if (val == null) return '\u2014';
  return val.toFixed(0) + '%';
}

function _basisFmtDate(val) {
  if (!val) return '\u2014';
  try {
    var d = new Date(val);
    if (isNaN(d.getTime())) return esc(String(val));
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
  } catch(e) {
    return esc(String(val));
  }
}

function _basisParseNum(val) {
  if (val == null) return null;
  var n = parseFloat(val);
  return isNaN(n) ? null : n;
}
