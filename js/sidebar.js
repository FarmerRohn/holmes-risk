/* sidebar.js — persistent position sidebar
 *
 * Shows per-commodity hedge position summary, price strip,
 * and net delta. Renders on Marketing and Charts pages.
 * Collapses to bottom strip on mobile.
 */

function renderSidebar() {
  var cy = STATE.activeCropYear || SEASON.current;
  var commodities = DEFAULT_COMMODITIES;
  var marketPrices = STATE.marketPrices || [];

  var html = '<aside class="risk-sidebar">';
  html += '<div class="sidebar-section">';
  html += '<div class="sidebar-label">Positions</div>';

  for (var i = 0; i < commodities.length; i++) {
    var c = commodities[i];
    var color = COMMODITY_COLORS[c] || '#888';
    var gross = productionBase(c, cy);
    var exposure = _sidebarCalcCommodity(c, cy, gross);
    var hedgePct = gross > 0 ? Math.round(exposure.committed / gross * 100) : 0;
    var hedgeClass = hedgePct >= 70 ? 'hedge-good' : (hedgePct >= 40 ? 'hedge-mid' : 'hedge-low');

    html += '<div class="sidebar-commodity">';
    html += '<div class="sidebar-comm-header">';
    html += '<span class="sidebar-comm-name" style="color:' + color + ';">' + esc(c) + '</span>';
    html += '<span class="sidebar-hedge-pct ' + hedgeClass + '">' + hedgePct + '%</span>';
    html += '</div>';
    html += '<div class="sidebar-progress-track"><div class="sidebar-progress-fill ' + hedgeClass + '" style="width:' + Math.min(hedgePct, 100) + '%;"></div></div>';
    html += '<div class="sidebar-comm-detail">';
    if (gross > 0) {
      html += _sidebarFmtBu(gross) + ' bu &middot; &Delta; ' + _sidebarFmtDelta(exposure.delta);
    } else {
      html += '<span class="sidebar-no-data">No production data</span>';
    }
    html += '</div>';
    html += '</div>';
  }

  html += '</div>'; // end positions section

  // Price strip
  html += '<div class="sidebar-divider"></div>';
  html += '<div class="sidebar-section">';
  html += '<div class="sidebar-label">Prices</div>';

  for (var j = 0; j < commodities.length; j++) {
    var comm = commodities[j];
    var commColor = COMMODITY_COLORS[comm] || '#888';
    var quote = _sidebarGetQuote(comm, marketPrices);

    html += '<div class="sidebar-price-row">';
    html += '<span style="color:' + commColor + ';">' + esc(_sidebarSymbol(comm)) + '</span>';
    if (quote) {
      var chgClass = quote.change >= 0 ? 'price-up' : 'price-down';
      var arrow = quote.change >= 0 ? '&#9650;' : '&#9660;';
      html += '<span>' + _sidebarFmtPrice(comm, quote.price) + ' <span class="' + chgClass + '">' + arrow + '</span></span>';
    } else {
      html += '<span class="sidebar-no-data">&mdash;</span>';
    }
    html += '</div>';
  }

  html += '</div>'; // end prices section
  html += '</aside>';
  return html;
}

/* ── Sidebar helpers ─────────────────────────── */

function _sidebarCalcCommodity(commodity, cropYear, grossBu) {
  var contracts = (STATE.contracts || []).filter(function(c) {
    return c.commodity === commodity && c.cropYear === cropYear && c.status !== 'Cancelled' && c.status !== 'Split';
  });
  var positions = (STATE.positions || []).filter(function(p) {
    return p.commodity === commodity && p.cropYear === cropYear && p.status !== 'Split';
  });

  var committed = 0;
  for (var i = 0; i < contracts.length; i++) {
    var ct = contracts[i].contractType;
    if (ct === 'Cash' || ct === 'HTA' || ct === 'Min Price' || ct === 'Accumulator') {
      committed += parseFloat(contracts[i].bushels) || 0;
    }
  }

  var delta = 0;
  for (var j = 0; j < positions.length; j++) {
    var p = positions[j];
    if (p.status === 'Open') {
      var d = parseFloat(p.delta) || 0;
      var cnt = parseFloat(p.contracts) || 0;
      var bpc = parseFloat(p.bushelsPerContract) || DEFAULT_BUSHELS_PER_CONTRACT[commodity] || 5000;
      delta += d * cnt * bpc;
    }
  }

  return { committed: committed, delta: Math.round(delta) };
}

function _sidebarGetQuote(commodity, marketPrices) {
  if (!marketPrices || !marketPrices.length) return null;
  for (var i = 0; i < marketPrices.length; i++) {
    var mp = marketPrices[i];
    if (mp.commodity === commodity || (mp.symbol && mp.symbol.indexOf(commodity.substring(0, 2).toUpperCase()) === 0)) {
      return { price: parseFloat(mp.lastPrice) || 0, change: parseFloat(mp.netChange) || 0 };
    }
  }
  return null;
}

function _sidebarSymbol(commodity) {
  var m = FUTURES_MONTHS;
  var now = new Date();
  var monthCode = m[now.getMonth()] || 'Z';
  var yr = String(now.getFullYear()).slice(-2);
  var prefix = { Corn: 'ZC', Soybeans: 'ZS', Wheat: 'ZW', 'Heating Oil': 'HO' };
  return (prefix[commodity] || commodity.substring(0, 2).toUpperCase()) + monthCode + yr;
}

function _sidebarFmtBu(val) {
  if (val >= 1000000) return (val / 1000000).toFixed(1) + 'M';
  if (val >= 1000) return Math.round(val / 1000) + 'K';
  return String(Math.round(val));
}

function _sidebarFmtDelta(val) {
  var prefix = val >= 0 ? '+' : '';
  return prefix + _sidebarFmtBu(val);
}

function _sidebarFmtPrice(commodity, price) {
  if (commodity === 'Heating Oil') return price.toFixed(4);
  return price.toFixed(2);
}
