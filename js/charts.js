// ==================== HOLMES RISK — CHARTS PAGE ====================
// Candlestick charts, forward curves, basis trends, and position overlays
// Uses TradingView lightweight-charts (global: LightweightCharts)

var _chartSelectedCommodity = 'Corn';
var _chartType = 'candlestick'; // 'candlestick', 'curve', 'basis'
var _chartTimeframe = '3M';
var _chartInstance = null;
var _chartSeries = null;
var _chartResizeObserver = null;

// ---- Main render ----

function renderChartsPage() {
  var cy = STATE.activeCropYear || SEASON.current;
  var comm = _chartSelectedCommodity;
  var marketPrices = STATE.marketPrices || [];
  var quote = null;
  for (var i = 0; i < marketPrices.length; i++) {
    if (marketPrices[i].commodity === comm) { quote = marketPrices[i]; break; }
  }

  var html = '<div class="page-content">';

  // Toolbar
  html += '<div class="chart-toolbar">';

  // Commodity buttons
  html += '<div class="chart-btn-group">';
  var comms = DEFAULT_COMMODITIES;
  for (var c = 0; c < comms.length; c++) {
    var active = comms[c] === comm ? ' chart-btn-active' : '';
    var color = COMMODITY_COLORS[comms[c]] || '#888';
    html += '<button class="chart-btn' + active + '" style="' + (active ? 'background:' + color + ';color:#fff;' : '') + '" onclick="chartSelectCommodity(\'' + escapeAttr(comms[c]) + '\')">' + esc(comms[c]) + '</button>';
  }
  html += '</div>';

  // Chart type buttons
  html += '<div class="chart-btn-group">';
  var types = [{id:'candlestick',label:'Candlestick'},{id:'curve',label:'Forward Curve'},{id:'basis',label:'Basis'}];
  for (var t = 0; t < types.length; t++) {
    var tActive = types[t].id === _chartType ? ' chart-btn-active' : '';
    html += '<button class="chart-btn' + tActive + '" onclick="chartSelectType(\'' + types[t].id + '\')">' + types[t].label + '</button>';
  }
  html += '</div>';

  // Timeframe buttons (only for candlestick)
  if (_chartType === 'candlestick') {
    html += '<div class="chart-btn-group">';
    var tfs = ['1W','1M','3M','6M','1Y'];
    for (var f = 0; f < tfs.length; f++) {
      var fActive = tfs[f] === _chartTimeframe ? ' chart-btn-active' : '';
      html += '<button class="chart-btn chart-btn-sm' + fActive + '" onclick="chartSelectTimeframe(\'' + tfs[f] + '\')">' + tfs[f] + '</button>';
    }
    html += '</div>';
  }

  html += '</div>'; // end toolbar

  // Chart + Info panel layout
  html += '<div class="chart-layout">';

  // Chart container
  html += '<div class="chart-container" id="chartContainer"></div>';

  // Info panel
  html += '<div class="chart-info-panel">';
  html += _chartRenderInfoPanel(comm, cy, quote);
  html += '</div>';

  html += '</div>'; // end chart-layout
  html += '</div>'; // end page-content

  // Defer chart initialization until after innerHTML is set
  setTimeout(function() { _chartInit(); }, 0);

  return html;
}

// ---- Chart initialization ----

function _chartInit() {
  var container = document.getElementById('chartContainer');
  if (!container) return;

  // Clean up existing chart and observer
  if (_chartResizeObserver) {
    _chartResizeObserver.disconnect();
    _chartResizeObserver = null;
  }
  if (_chartInstance) {
    _chartInstance.remove();
    _chartInstance = null;
    _chartSeries = null;
  }

  // Guard: library not loaded
  if (typeof LightweightCharts === 'undefined') {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text3)">Chart library loading...</div>';
    return;
  }

  var isDark = document.documentElement.dataset.theme === 'dark';
  var textColor = isDark ? '#6b7280' : '#718096';

  _chartInstance = LightweightCharts.createChart(container, {
    width: container.clientWidth,
    height: 450,
    layout: {
      background: { type: 'solid', color: 'transparent' },
      textColor: textColor
    },
    grid: {
      vertLines: { color: 'rgba(128,128,128,0.1)' },
      horzLines: { color: 'rgba(128,128,128,0.1)' }
    },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    timeScale: { borderColor: 'rgba(128,128,128,0.2)', timeVisible: false },
    rightPriceScale: { borderColor: 'rgba(128,128,128,0.2)' }
  });

  // Handle container resize
  _chartResizeObserver = new ResizeObserver(function() {
    if (_chartInstance && container.clientWidth > 0) {
      _chartInstance.applyOptions({ width: container.clientWidth });
    }
  });
  _chartResizeObserver.observe(container);

  // Load data based on chart type
  if (_chartType === 'candlestick') {
    _chartLoadCandlestick();
  } else if (_chartType === 'curve') {
    _chartLoadForwardCurve();
  } else if (_chartType === 'basis') {
    _chartLoadBasis();
  }
}

// ---- Candlestick data ----

function _chartLoadCandlestick() {
  if (!_chartInstance) return;

  _chartSeries = _chartInstance.addCandlestickSeries({
    upColor: '#22c55e',
    downColor: '#ef4444',
    borderUpColor: '#22c55e',
    borderDownColor: '#ef4444',
    wickUpColor: '#22c55e',
    wickDownColor: '#ef4444'
  });

  var commodity = _chartSelectedCommodity;
  fetchForwardCurveDB(commodity).then(function(data) {
    if (!data || !data.length) {
      _chartShowEmpty('No OHLCV data available for ' + commodity);
      return;
    }

    // Transform to lightweight-charts format
    var chartData = [];
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      if (d.date && d.open != null) {
        chartData.push({
          time: d.date,
          open: parseFloat(d.open),
          high: parseFloat(d.high),
          low: parseFloat(d.low),
          close: parseFloat(d.close)
        });
      }
    }

    // Sort by date ascending
    chartData.sort(function(a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; });

    // Apply timeframe filter
    if (chartData.length > 0) {
      var cutoff = _chartGetCutoffDate(_chartTimeframe);
      chartData = chartData.filter(function(d) { return d.time >= cutoff; });
    }

    if (chartData.length > 0) {
      _chartSeries.setData(chartData);
      _chartInstance.timeScale().fitContent();
    } else {
      _chartShowEmpty('No data in selected timeframe');
    }

    // Add position overlay lines
    _chartAddOverlays();
  }).catch(function(err) {
    console.warn('Chart data load failed:', err);
    _chartShowEmpty('Failed to load chart data');
  });
}

// ---- Forward curve (line chart by contract month) ----

function _chartLoadForwardCurve() {
  if (!_chartInstance) return;

  _chartSeries = _chartInstance.addLineSeries({
    color: COMMODITY_COLORS[_chartSelectedCommodity] || '#3b82f6',
    lineWidth: 2
  });

  fetchForwardCurveDB(_chartSelectedCommodity).then(function(data) {
    if (!data || !data.length) {
      _chartShowEmpty('No forward curve data available');
      return;
    }

    var curveData = [];
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      if (d.contractMonth && d.settle != null) {
        curveData.push({ time: d.contractMonth, value: parseFloat(d.settle) });
      } else if (d.date && d.close != null) {
        curveData.push({ time: d.date, value: parseFloat(d.close) });
      }
    }
    curveData.sort(function(a, b) { return a.time < b.time ? -1 : 1; });

    if (curveData.length) {
      _chartSeries.setData(curveData);
      _chartInstance.timeScale().fitContent();
    } else {
      _chartShowEmpty('No forward curve data available');
    }
  }).catch(function(err) {
    console.warn('Forward curve load failed:', err);
    _chartShowEmpty('Failed to load forward curve');
  });
}

// ---- Basis chart (line chart) ----

function _chartLoadBasis() {
  if (!_chartInstance) return;

  _chartSeries = _chartInstance.addLineSeries({
    color: '#f97316',
    lineWidth: 2
  });

  fetchBasisDB().then(function(data) {
    if (!data || !data.length) {
      _chartShowEmpty('No basis data available');
      return;
    }

    var comm = _chartSelectedCommodity;
    var basisData = [];
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      if (d.commodity === comm && d.date && d.basis != null) {
        basisData.push({ time: d.date, value: parseFloat(d.basis) });
      }
    }
    basisData.sort(function(a, b) { return a.time < b.time ? -1 : 1; });

    if (basisData.length) {
      _chartSeries.setData(basisData);
      _chartInstance.timeScale().fitContent();
    } else {
      _chartShowEmpty('No basis data for ' + comm);
    }
  }).catch(function(err) {
    console.warn('Basis data load failed:', err);
    _chartShowEmpty('Failed to load basis data');
  });
}

// ---- Overlay lines (price targets, contract prices) ----

function _chartAddOverlays() {
  if (!_chartInstance || !_chartSeries) return;
  var comm = _chartSelectedCommodity;
  var cy = STATE.activeCropYear || SEASON.current;

  // Price targets
  var targets = (STATE.priceTargets || []).filter(function(t) {
    return t.commodity === comm && t.active;
  });
  for (var i = 0; i < targets.length; i++) {
    var price = parseFloat(targets[i].targetPrice);
    if (price > 0) {
      _chartSeries.createPriceLine({
        price: price,
        color: '#22c55e',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Target'
      });
    }
  }

  // Contract prices (up to 5 most recent open contracts)
  var contracts = (STATE.contracts || []).filter(function(c) {
    return c.commodity === comm && c.cropYear === cy && c.status === 'Open';
  });
  for (var j = 0; j < Math.min(contracts.length, 5); j++) {
    var ep = calcEffectivePrice(contracts[j], getLatestFuturesPrice(comm, STATE.marketPrices));
    if (ep) {
      _chartSeries.createPriceLine({
        price: ep,
        color: '#3b82f6',
        lineWidth: 1,
        lineStyle: LightweightCharts.LineStyle.Dashed,
        axisLabelVisible: true,
        title: contracts[j].contractType || ''
      });
    }
  }
}

// ---- Info panel ----

function _chartRenderInfoPanel(commodity, cy, quote) {
  var color = COMMODITY_COLORS[commodity] || '#888';

  var html = '<div class="chart-info-header" style="color:' + color + '">' + esc(commodity) + '</div>';

  // Current price
  if (quote) {
    var lastPrice = parseFloat(quote.lastPrice) || 0;
    var change = parseFloat(quote.netChange) || 0;
    var chgClass = change >= 0 ? 'price-up' : 'price-down';
    html += '<div class="chart-info-price">' + lastPrice.toFixed(2);
    html += ' <span class="' + chgClass + '">' + (change >= 0 ? '+' : '') + change.toFixed(2) + '</span></div>';
  } else {
    html += '<div class="chart-info-price" style="color:var(--text3)">--</div>';
  }

  // Position summary
  var gross = productionBase(commodity, cy);
  if (gross > 0) {
    var exposure = calcExposure(STATE.contracts || [], STATE.positions || [], STATE.settings || {}, cy);
    var commExp = exposure.byCommodity[commodity];

    html += '<div class="chart-info-divider"></div>';
    html += '<div class="chart-info-label">Your Position</div>';
    if (commExp) {
      var hedgeClass = commExp.hedgePct >= 70 ? 'hedge-good' : commExp.hedgePct >= 40 ? 'hedge-mid' : 'hedge-low';
      html += '<div class="chart-info-row"><span>Hedged</span><span class="' + hedgeClass + '">' + commExp.hedgePct.toFixed(0) + '%</span></div>';
      html += '<div class="chart-info-row"><span>Committed</span><span>' + commExp.committed.toLocaleString() + ' bu</span></div>';
      html += '<div class="chart-info-row"><span>Open</span><span>' + (commExp.grossBushels - commExp.committed).toLocaleString() + ' bu</span></div>';
      html += '<div class="chart-info-row"><span>Net &#916;</span><span>' + commExp.optionsDeltaBu.toLocaleString() + ' bu</span></div>';
    } else {
      html += '<div class="chart-info-row" style="color:var(--text3)">No position data</div>';
    }
  }

  // Price targets
  var targets = (STATE.priceTargets || []).filter(function(t) { return t.commodity === commodity && t.active; });
  if (targets.length) {
    html += '<div class="chart-info-divider"></div>';
    html += '<div class="chart-info-label">Price Targets</div>';
    for (var i = 0; i < targets.length; i++) {
      html += '<div class="chart-info-row"><span style="color:var(--green)">&#9678;</span><span>$' + (parseFloat(targets[i].targetPrice) || 0).toFixed(2) + '</span></div>';
    }
  }

  // Chart type hint
  html += '<div class="chart-info-divider"></div>';
  html += '<div class="chart-info-label">Chart Type</div>';
  var typeLabels = { candlestick: 'Candlestick', curve: 'Forward Curve', basis: 'Basis' };
  html += '<div class="chart-info-row"><span>' + (typeLabels[_chartType] || _chartType) + '</span></div>';
  if (_chartType === 'candlestick') {
    html += '<div class="chart-info-row"><span>Timeframe</span><span>' + esc(_chartTimeframe) + '</span></div>';
  }

  return html;
}

// ---- Empty state message ----

function _chartShowEmpty(msg) {
  var container = document.getElementById('chartContainer');
  if (!container) return;
  var overlay = document.createElement('div');
  overlay.className = 'chart-empty-msg';
  overlay.textContent = msg || 'No data available';
  container.appendChild(overlay);
}

// ---- Navigation handlers ----

function chartSelectCommodity(commodity) {
  _chartSelectedCommodity = commodity;
  renderApp();
}

function chartSelectType(type) {
  _chartType = type;
  renderApp();
}

function chartSelectTimeframe(tf) {
  _chartTimeframe = tf;
  renderApp();
}

function _chartGetCutoffDate(tf) {
  var now = new Date();
  var d = new Date();
  switch (tf) {
    case '1W': d.setDate(now.getDate() - 7); break;
    case '1M': d.setMonth(now.getMonth() - 1); break;
    case '3M': d.setMonth(now.getMonth() - 3); break;
    case '6M': d.setMonth(now.getMonth() - 6); break;
    case '1Y': d.setFullYear(now.getFullYear() - 1); break;
    default: d.setMonth(now.getMonth() - 3);
  }
  return d.toISOString().split('T')[0];
}
