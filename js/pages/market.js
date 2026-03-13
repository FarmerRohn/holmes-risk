// ==================== HOLMES RISK — MARKET PAGE ====================

// Module-level state
var _marketSelectedCommodity = 'Corn';
var _marketForwardCurve = null;
var _marketLoading = false;

// ---- Main page renderer ----

function renderMarketPage() {
  // Kick off data fetch (will update table via DOM when done)
  _marketFetchCurve(_marketSelectedCommodity);

  return '<div class="page-content">' +
    '<div class="section-header">' +
      '<h2 class="section-title">Forward Curves</h2>' +
      '<button class="btn btn-secondary btn-sm" onclick="marketRefresh()">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>' +
        ' Refresh' +
      '</button>' +
    '</div>' +
    _marketRenderCommoditySelector() +
    '<div id="marketCurveContainer">' +
      _marketRenderTable() +
    '</div>' +
  '</div>';
}

// ---- Commodity Selector ----

function _marketRenderCommoditySelector() {
  var html = '<div class="market-commodity-bar">';
  for (var i = 0; i < DEFAULT_COMMODITIES.length; i++) {
    var comm = DEFAULT_COMMODITIES[i];
    var color = COMMODITY_COLORS[comm] || 'var(--text)';
    var active = comm === _marketSelectedCommodity ? ' market-comm-active' : '';
    html += '<button class="market-comm-btn' + active + '" onclick="marketSelectCommodity(\'' + escapeAttr(comm) + '\')">' +
      '<span class="market-comm-dot" style="background:' + color + '"></span>' +
      esc(comm) +
    '</button>';
  }
  html += '</div>';
  return html;
}

// ---- Forward Curve Table ----

function _marketRenderTable() {
  if (_marketLoading) {
    return '<div class="market-loading">' +
      '<div class="loading-spinner"></div>' +
      '<p>Loading forward curve\u2026</p>' +
    '</div>';
  }

  if (!_marketForwardCurve || _marketForwardCurve.length === 0) {
    return '<div class="market-empty">' +
      '<p>No forward curve data available for ' + esc(_marketSelectedCommodity) + '</p>' +
    '</div>';
  }

  var data = _marketForwardCurve;

  var html = '<div class="table-wrap">' +
    '<table class="market-table">' +
    '<thead><tr>' +
      '<th>Month</th>' +
      '<th>Symbol</th>' +
      '<th>Last</th>' +
      '<th>Change</th>' +
      '<th>Settle</th>' +
      '<th>Volume</th>' +
      '<th>Open Int</th>' +
    '</tr></thead>' +
    '<tbody>';

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var isFront = (i === 0);
    var rowCls = isFront ? ' class="market-front-month"' : '';

    // Compute change: close - settlement (if both exist)
    var chg = (row.close != null && row.settlement != null) ? row.close - row.settlement : null;
    var changeHtml = _marketFmtChange(chg);

    html += '<tr' + rowCls + '>' +
      '<td>' + esc(row.monthName || '\u2014') + '</td>' +
      '<td class="market-mono">' + esc(row.symbol || '\u2014') + '</td>' +
      '<td class="market-mono">' + _marketFmtPrice(row.close) + '</td>' +
      '<td class="market-mono">' + changeHtml + '</td>' +
      '<td class="market-mono">' + _marketFmtPrice(row.settlement) + '</td>' +
      '<td class="market-mono">' + _marketFmtInt(row.volume) + '</td>' +
      '<td class="market-mono">' + _marketFmtInt(row.oi) + '</td>' +
    '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

// ---- Data Fetching ----

function _marketFetchCurve(commodity) {
  _marketLoading = true;
  _marketUpdateContainer();

  fetchForwardCurveDB(commodity)
    .then(function(data) {
      _marketForwardCurve = (data && data.curves) || [];
      _marketLoading = false;
      _marketUpdateContainer();
    })
    .catch(function(err) {
      _marketForwardCurve = null;
      _marketLoading = false;
      _marketUpdateContainer();
      showToast('Failed to load forward curve: ' + err.message, 'error');
    });
}

function _marketUpdateContainer() {
  var container = document.getElementById('marketCurveContainer');
  if (container) {
    container.innerHTML = _marketRenderTable();
  }
}

// ---- Public Actions ----

function marketSelectCommodity(commodity) {
  _marketSelectedCommodity = commodity;
  _marketForwardCurve = null;

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

  _marketFetchCurve(commodity);
}

function marketRefresh() {
  _marketForwardCurve = null;
  _marketFetchCurve(_marketSelectedCommodity);
}

// ---- Formatters ----

function _marketFmtPrice(val) {
  if (val == null) return '\u2014';
  var n = parseFloat(val);
  if (isNaN(n)) return '\u2014';
  return n.toFixed(4);
}

function _marketFmtChange(val) {
  if (val == null) return '<span>\u2014</span>';
  var n = parseFloat(val);
  if (isNaN(n)) return '<span>\u2014</span>';

  var cls = '';
  var sign = '';
  if (n > 0) { cls = 'market-change-pos'; sign = '+'; }
  else if (n < 0) { cls = 'market-change-neg'; }

  return '<span class="' + cls + '">' + sign + n.toFixed(4) + '</span>';
}

function _marketFmtInt(val) {
  if (val == null) return '\u2014';
  var n = parseInt(val, 10);
  if (isNaN(n)) return '\u2014';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
