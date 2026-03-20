// ==================== HOLMES RISK — DASHBOARD PAGE ====================

var _dashboardRefreshTimer = null;

function renderDashboardPage() {
  _dashboardStartAutoRefresh();

  var cropYear = STATE.activeCropYear || (STATE.settings && STATE.settings.activeCropYear) || SEASON.current;
  var exposure = calcExposure(STATE.contracts, STATE.positions, STATE.settings, cropYear);
  var pl = calcPL(STATE.contracts, STATE.positions, STATE.settings, STATE.marketPrices);
  var netDelta = calcNetDelta(STATE.positions);

  return '<div class="page-content">' +
    _renderFuturesStrip() +
    _renderHedgeSummaryTable(exposure, pl, netDelta) +
    _renderCommodityRows(exposure) +
    _renderRecentContracts() +
  '</div>';
}

// ---- Futures Price Strip ----

function _renderFuturesStrip() {
  var prices = STATE.marketPrices || [];
  var html = '<div class="futures-strip">';

  if (prices.length === 0) {
    html += '<div class="futures-strip-empty">No market data available</div>';
  } else {
    for (var i = 0; i < prices.length; i++) {
      var q = prices[i];
      var commodity = q.commodity || q.symbol || '';
      var color = COMMODITY_COLORS[commodity] || 'var(--text)';
      var price = q.lastPrice != null ? _dashFmtPrice(q.lastPrice) : '\u2014';
      html += '<div class="futures-chip" style="border-color: ' + color + '">' +
        '<span class="futures-chip-name" style="color: ' + color + '">' + esc(commodity) + '</span>' +
        '<span class="futures-chip-price">' + esc(price) + '</span>' +
      '</div>';
    }
  }

  html += '</div>';
  return html;
}

// ---- Hedge Position Summary Table ----

function _renderHedgeSummaryTable(exposure, pl, netDelta) {
  var t = exposure.totals;

  // Color helpers
  var hedgeColor = t.hedgePct > 80 ? 'var(--green)' : (t.hedgePct >= 50 ? 'var(--amber)' : 'var(--red)');
  var plColor = pl.unrealized > 0 ? 'var(--green)' : (pl.unrealized < 0 ? 'var(--red)' : 'var(--text)');

  return '<div class="section-header" style="margin-top:8px">' +
      '<span class="section-title">Position Summary</span>' +
      '<button class="btn btn-secondary btn-sm" onclick="dashboardRefreshPrices()">Refresh</button>' +
    '</div>' +
    '<div class="table-wrap" style="margin-bottom:20px">' +
      '<table>' +
        '<thead><tr>' +
          '<th>Metric</th>' +
          '<th style="text-align:right">Value</th>' +
        '</tr></thead>' +
        '<tbody>' +
          '<tr><td>Hedge %</td><td style="text-align:right;font-family:var(--mono);font-weight:700;color:' + hedgeColor + '">' + _dashFmtPct(t.hedgePct) + '</td></tr>' +
          '<tr><td>Total Committed</td><td style="text-align:right;font-family:var(--mono)">' + _dashFmtNum(t.committed) + ' bu</td></tr>' +
          '<tr><td>Priced Open</td><td style="text-align:right;font-family:var(--mono)">' + _dashFmtNum(t.pricedOpen) + ' bu</td></tr>' +
          '<tr><td>Basis Open</td><td style="text-align:right;font-family:var(--mono)">' + _dashFmtNum(t.basisOpen) + ' bu</td></tr>' +
          '<tr><td>Unpriced</td><td style="text-align:right;font-family:var(--mono)">' + _dashFmtNum(t.unpriced) + ' bu</td></tr>' +
          '<tr><td>Net Delta</td><td style="text-align:right;font-family:var(--mono);color:var(--blue)">' + _dashFmtDelta(netDelta) + ' bu</td></tr>' +
          '<tr><td>Unrealized P&L</td><td style="text-align:right;font-family:var(--mono);font-weight:700;color:' + plColor + '">' + _dashFmtDollars(pl.unrealized) + '</td></tr>' +
        '</tbody>' +
      '</table>' +
    '</div>';
}

// ---- Per-Commodity Rows ----

function _renderCommodityRows(exposure) {
  var commodities = Object.keys(exposure.byCommodity);
  if (commodities.length === 0) return '';

  commodities.sort();

  var html = '<div class="section-header"><span class="section-title">By Commodity</span></div>' +
    '<div class="table-wrap" style="margin-bottom:20px">' +
      '<table>' +
        '<thead><tr>' +
          '<th>Commodity</th>' +
          '<th style="text-align:right">Gross Bu</th>' +
          '<th style="text-align:right">Committed</th>' +
          '<th style="text-align:right">Unpriced</th>' +
          '<th style="text-align:right">Hedge %</th>' +
        '</tr></thead>' +
        '<tbody>';

  for (var i = 0; i < commodities.length; i++) {
    var comm = commodities[i];
    var data = exposure.byCommodity[comm];
    var color = COMMODITY_COLORS[comm] || 'var(--text)';
    var hedgePct = data.hedgePct;
    var hedgeColor = hedgePct > 80 ? 'var(--green)' : (hedgePct >= 50 ? 'var(--amber)' : 'var(--red)');

    html += '<tr>' +
      '<td><span class="grain-commodity-dot" style="background:' + color + '"></span> ' + esc(comm) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _dashFmtNum(data.grossBushels) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _dashFmtNum(data.committed) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _dashFmtNum(data.unpriced) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono);font-weight:700;color:' + hedgeColor + '">' + _dashFmtPct(hedgePct) + '</td>' +
    '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

// ---- Recent Contracts ----

function _renderRecentContracts() {
  var contracts = STATE.contracts || [];
  if (contracts.length === 0) return '';

  // Sort by createdAt desc, take 5
  var sorted = contracts.slice().sort(function(a, b) {
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
  if (sorted.length > 5) sorted = sorted.slice(0, 5);

  var html = '<div class="section-header"><span class="section-title">Recent Contracts</span></div>' +
    '<div class="table-wrap">' +
      '<table>' +
        '<thead><tr>' +
          '<th>Commodity</th>' +
          '<th>Type</th>' +
          '<th style="text-align:right">Bushels</th>' +
          '<th style="text-align:right">Price</th>' +
          '<th>Status</th>' +
        '</tr></thead>' +
        '<tbody>';

  for (var i = 0; i < sorted.length; i++) {
    var c = sorted[i];
    var color = COMMODITY_COLORS[c.commodity] || 'var(--text)';
    var effPrice = calcEffectivePrice(c);
    var priceStr = effPrice != null ? _dashFmtPrice(effPrice) : '\u2014';

    // Status badge
    var statusCls = 'grain-status grain-status-' + (c.status || 'open').toLowerCase();

    html += '<tr>' +
      '<td><span class="grain-commodity-dot" style="background:' + color + '"></span> ' + esc(c.commodity || '') + '</td>' +
      '<td>' + esc(c.contractType || '') + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + _dashFmtNum(c.bushels) + '</td>' +
      '<td style="text-align:right;font-family:var(--mono)">' + priceStr + '</td>' +
      '<td><span class="' + statusCls + '">' + esc(c.status || '') + '</span></td>' +
    '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

// ---- Auto-refresh ----

function _dashboardStartAutoRefresh() {
  if (_dashboardRefreshTimer) clearInterval(_dashboardRefreshTimer);
  _dashboardRefreshTimer = setInterval(function() {
    if (STATE.activeTab !== 'dashboard') {
      clearInterval(_dashboardRefreshTimer);
      _dashboardRefreshTimer = null;
      return;
    }
    fetchMarketQuotesDB()
      .then(function(data) {
        STATE.marketPrices = data || [];
        var strip = document.querySelector('.futures-strip');
        if (strip) {
          var temp = document.createElement('div');
          temp.innerHTML = _renderFuturesStrip();
          strip.parentNode.replaceChild(temp.firstChild, strip);
        }
      })
      .catch(function(err) {
        console.warn('Market refresh failed:', err);
      });
  }, 5 * 60 * 1000);
}

function dashboardRefreshPrices() {
  fetchMarketQuotesDB()
    .then(function(data) {
      STATE.marketPrices = data || [];
      renderApp();
      showToast('Prices refreshed', 'success');
    })
    .catch(function(err) {
      showToast('Failed to refresh prices: ' + err.message, 'error');
    });
}

// ---- Helpers ----

function _dashFmtPrice(val) {
  if (val == null) return '\u2014';
  var n = parseFloat(val);
  if (isNaN(n)) return '\u2014';
  return n.toFixed(4);
}

function _dashFmtNum(n) {
  if (n == null || isNaN(n)) return '\u2014';
  n = Math.round(n);
  var abs = Math.abs(n);
  var str = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return n < 0 ? '-' + str : str;
}

function _dashFmtDollars(n) {
  if (n == null || isNaN(n)) return '\u2014';
  n = Math.round(n);
  var abs = Math.abs(n);
  var str = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (n < 0) return '($' + str + ')';
  return '$' + str;
}

function _dashFmtPct(n) {
  if (n == null || isNaN(n)) return '\u2014';
  return n.toFixed(1) + '%';
}

function _dashFmtDelta(n) {
  if (n == null || isNaN(n)) return '\u2014';
  n = Math.round(n);
  var abs = Math.abs(n);
  var str = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (n > 0) return '+' + str;
  if (n < 0) return '-' + str;
  return '0';
}
