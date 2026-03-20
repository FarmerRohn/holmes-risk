// ==================== HOLMES RISK — PRICE LOG PAGE ====================

var _priceLogFilter = 'All';

function renderPriceLogPage() {
  var entries = STATE.priceLog || [];

  // Filter by commodity
  if (_priceLogFilter && _priceLogFilter !== 'All') {
    var filtered = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].commodity === _priceLogFilter) filtered.push(entries[i]);
    }
    entries = filtered;
  }

  // Sort most recent first
  entries = entries.slice().sort(function(a, b) {
    return (b.date || '').localeCompare(a.date || '');
  });

  // Limit to 50
  if (entries.length > 50) entries = entries.slice(0, 50);

  // Build commodity filter options
  var filterOpts = '<option value="All"' + (_priceLogFilter === 'All' ? ' selected' : '') + '>All</option>';
  for (var ci = 0; ci < DEFAULT_COMMODITIES.length; ci++) {
    var comm = DEFAULT_COMMODITIES[ci];
    var sel = _priceLogFilter === comm ? ' selected' : '';
    filterOpts += '<option value="' + escapeAttr(comm) + '"' + sel + '>' + esc(comm) + '</option>';
  }

  var html = '<div class="page-content">' +
    '<div class="section-header">' +
      '<h2 class="section-title">Price Log</h2>' +
      '<button class="btn btn-primary btn-sm" onclick="priceLogOpenModal()">Add Entry</button>' +
    '</div>' +
    '<div style="margin-bottom: 12px; max-width: 200px;">' +
      '<select class="form-select grain-filter-select" onchange="priceLogFilterChange(this.value)">' +
        filterOpts +
      '</select>' +
    '</div>';

  if (entries.length === 0) {
    html += '<p style="color: var(--text3); padding: 40px 0; text-align: center;">No price log entries yet.</p>';
  } else {
    html += '<div class="table-wrap"><table>' +
      '<thead><tr>' +
        '<th>Date</th>' +
        '<th>Commodity</th>' +
        '<th style="text-align:right">Cash Price</th>' +
        '<th style="text-align:right">Basis</th>' +
        '<th style="text-align:right">Futures Price</th>' +
        '<th>Futures Mo</th>' +
        '<th>Source</th>' +
        '<th>Notes</th>' +
      '</tr></thead><tbody>';

    for (var ei = 0; ei < entries.length; ei++) {
      var e = entries[ei];
      var color = COMMODITY_COLORS[e.commodity] || 'var(--text)';
      html += '<tr>' +
        '<td>' + esc(e.date || '') + '</td>' +
        '<td>' +
          '<span class="grain-commodity-dot" style="background:' + color + '"></span> ' +
          esc(e.commodity) +
        '</td>' +
        '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(e.cashPrice) + '</td>' +
        '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(e.basis) + '</td>' +
        '<td style="text-align:right;font-family:var(--mono)">' + _grainFmtPrice(e.futuresPrice) + '</td>' +
        '<td>' + esc(e.futuresMonth || '') + '</td>' +
        '<td>' + esc(e.source || '') + '</td>' +
        '<td>' + esc(e.notes || '') + '</td>' +
      '</tr>';
    }

    html += '</tbody></table></div>';
  }

  html += '</div>';
  return html;
}

function priceLogFilterChange(value) {
  _priceLogFilter = value;
  renderApp();
}

function priceLogOpenModal() {
  var now = new Date();
  var todayStr = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0');

  var commOpts = '';
  for (var i = 0; i < DEFAULT_COMMODITIES.length; i++) {
    commOpts += '<option value="' + escapeAttr(DEFAULT_COMMODITIES[i]) + '">' + esc(DEFAULT_COMMODITIES[i]) + '</option>';
  }

  var fmOpts = _grainBuildFuturesMonthOptions('');

  var sourceOpts = '<option value="manual" selected>manual</option>' +
    '<option value="databento">databento</option>' +
    '<option value="yahoo">yahoo</option>';

  var html = '<h2 class="modal-title">Add Price Log Entry</h2>' +
    '<form id="priceLogForm" onsubmit="priceLogSave(event)">' +
      '<div class="grain-modal-grid">' +
        '<div class="form-group">' +
          '<label class="form-label">Date</label>' +
          '<input type="date" class="form-input" name="date" value="' + escapeAttr(todayStr) + '" required>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Commodity</label>' +
          '<select class="form-select" name="commodity" required>' + commOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Cash Price</label>' +
          '<input type="number" step="0.0001" class="form-input" name="cashPrice" placeholder="0.0000">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Basis</label>' +
          '<input type="number" step="0.0001" class="form-input" name="basis" placeholder="0.0000">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Futures Price</label>' +
          '<input type="number" step="0.0001" class="form-input" name="futuresPrice" placeholder="0.0000">' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Futures Month</label>' +
          '<select class="form-select" name="futuresMonth">' + fmOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Source</label>' +
          '<select class="form-select" name="source">' + sourceOpts + '</select>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label">Notes</label>' +
          '<input type="text" class="form-input" name="notes" placeholder="Optional notes">' +
        '</div>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">Save Entry</button>' +
      '</div>' +
    '</form>';

  showModal(html);
}

function priceLogSave(e) {
  e.preventDefault();
  var form = document.getElementById('priceLogForm');
  if (!form) return;

  var data = {
    date: form.date.value,
    commodity: form.commodity.value,
    cashPrice: form.cashPrice.value ? parseFloat(form.cashPrice.value) : null,
    basis: form.basis.value ? parseFloat(form.basis.value) : null,
    futuresPrice: form.futuresPrice.value ? parseFloat(form.futuresPrice.value) : null,
    futuresMonth: form.futuresMonth.value || null,
    source: form.source.value || 'manual',
    notes: form.notes.value || null
  };

  if (!data.date || !data.commodity) {
    showToast('Date and commodity are required', 'error');
    return;
  }

  createPriceLogEntryDB(data)
    .then(function(result) {
      if (result) {
        STATE.priceLog.push(result);
      }
      closeModal();
      showToast('Price log entry saved', 'success');
      renderApp();
    })
    .catch(function(err) {
      showToast('Failed to save: ' + err.message, 'error');
    });
}
