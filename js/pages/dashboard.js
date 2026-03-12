// ==================== HOLMES RISK — DASHBOARD PAGE ====================

var _dashboardRefreshTimer = null;

function renderDashboardPage() {
  // Start auto-refresh for market prices (every 5 minutes)
  _dashboardStartAutoRefresh();

  var cropYear = STATE.activeCropYear || STATE.settings.activeCropYear || SEASON.current;

  return '<div class="page-content">' +
    _renderFuturesStrip() +
    '<div class="dash-section-label">Key Performance Indicators</div>' +
    _renderKpiCards() +
    '<div class="dash-section-label">Exposure Buckets</div>' +
    _renderExposureBuckets() +
    '<div class="dash-section-label">Quick Stats</div>' +
    _renderQuickStats(cropYear) +
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
      var price = q.lastPrice != null ? _dashFmtPrice(q.lastPrice) : '—';
      html += '<div class="futures-chip" style="border-color: ' + color + '">' +
        '<span class="futures-chip-name" style="color: ' + color + '">' + esc(commodity) + '</span>' +
        '<span class="futures-chip-price">' + esc(price) + '</span>' +
      '</div>';
    }
  }

  html += '</div>';
  return html;
}

// ---- KPI Cards ----

function _renderKpiCards() {
  var kpis = [
    { label: 'Hedge %',          value: '\u2014%',   icon: _dashIconShield(), cls: 'kpi-hedge' },
    { label: 'Net Delta',        value: '\u2014 bu',  icon: _dashIconDelta(),  cls: 'kpi-delta' },
    { label: 'Unrealized P&L',   value: '$\u2014',    icon: _dashIconDollar(), cls: 'kpi-pnl' },
    { label: 'Total Committed',  value: '\u2014 bu',  icon: _dashIconTruck(),  cls: 'kpi-committed' }
  ];

  var html = '<div class="kpi-grid">';
  for (var i = 0; i < kpis.length; i++) {
    var k = kpis[i];
    html += '<div class="kpi-card ' + k.cls + '">' +
      '<div class="kpi-icon">' + k.icon + '</div>' +
      '<div class="kpi-value">' + k.value + '</div>' +
      '<div class="kpi-label">' + esc(k.label) + '</div>' +
    '</div>';
  }
  html += '</div>';
  return html;
}

// ---- Exposure Buckets ----

function _renderExposureBuckets() {
  var buckets = [
    { label: 'Priced Open',    value: '\u2014 bu' },
    { label: 'Basis Open',     value: '\u2014 bu' },
    { label: 'Sold/Delivered', value: '\u2014 bu' },
    { label: 'Unpriced',       value: '\u2014 bu' },
    { label: 'Options \u0394 Bu', value: '\u2014 bu' }
  ];

  var html = '<div class="exposure-grid">';
  for (var i = 0; i < buckets.length; i++) {
    var b = buckets[i];
    html += '<div class="exposure-card">' +
      '<div class="exposure-value">' + b.value + '</div>' +
      '<div class="exposure-label">' + esc(b.label) + '</div>' +
    '</div>';
  }
  html += '</div>';
  return html;
}

// ---- Quick Stats ----

function _renderQuickStats(cropYear) {
  var openContracts = 0;
  var openPositions = 0;

  // Count open contracts for the active crop year
  if (STATE.contracts && STATE.contracts.length) {
    for (var i = 0; i < STATE.contracts.length; i++) {
      if (STATE.contracts[i].status === 'Open') openContracts++;
    }
  }
  if (STATE.positions && STATE.positions.length) {
    for (var j = 0; j < STATE.positions.length; j++) {
      if (STATE.positions[j].status !== 'Closed') openPositions++;
    }
  }

  return '<div class="quick-stats-row">' +
    '<div class="quick-stat-card">' +
      '<div class="quick-stat-icon">' + _dashIconCalendar() + '</div>' +
      '<div class="quick-stat-content">' +
        '<div class="quick-stat-value">' + esc(cropYear) + '</div>' +
        '<div class="quick-stat-label">Active Crop Year</div>' +
      '</div>' +
    '</div>' +
    '<div class="quick-stat-card">' +
      '<div class="quick-stat-icon">' + _dashIconFile() + '</div>' +
      '<div class="quick-stat-content">' +
        '<div class="quick-stat-value">' + openContracts + '</div>' +
        '<div class="quick-stat-label">Open Contracts</div>' +
      '</div>' +
    '</div>' +
    '<div class="quick-stat-card">' +
      '<div class="quick-stat-icon">' + _dashIconChart() + '</div>' +
      '<div class="quick-stat-content">' +
        '<div class="quick-stat-value">' + openPositions + '</div>' +
        '<div class="quick-stat-label">Open Positions</div>' +
      '</div>' +
    '</div>' +
  '</div>';
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

// ---- SVG Icons ----

function _dashIconShield() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
}

function _dashIconDelta() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 22h20L12 2z"/></svg>';
}

function _dashIconDollar() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>';
}

function _dashIconTruck() {
  return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
}

function _dashIconCalendar() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
}

function _dashIconFile() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
}

function _dashIconChart() {
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
}
