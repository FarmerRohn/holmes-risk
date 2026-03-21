// ==================== HOLMES RISK — DOCUMENTS PAGE ====================

// ---- Main page renderer ----

function renderDocumentsPage() {
  var docs = STATE.documents || [];

  // Sort by createdAt descending (newest first)
  docs = docs.slice().sort(function(a, b) {
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });

  return '<div class="page-content">' +
    _docRenderToolbar() +
    _docRenderSummary(docs) +
    _docRenderTable(docs) +
  '</div>';
}

// ---- Toolbar ----

function _docRenderToolbar() {
  return '<div class="grain-toolbar">' +
    '<div class="grain-toolbar-filters">' +
      '<span class="section-title">Documents</span>' +
    '</div>' +
    '<button class="btn btn-primary btn-sm" onclick="docOpenUploadModal()">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
      ' Upload Document' +
    '</button>' +
  '</div>';
}

// ---- Summary Stats ----

function _docRenderSummary(docs) {
  var totalDocs = docs.length;
  var contracts = 0;
  var settlements = 0;
  var linked = 0;

  for (var i = 0; i < docs.length; i++) {
    var d = docs[i];
    if (d.docType === 'contract') contracts++;
    else if (d.docType === 'settlement') settlements++;
    if (d.linkedContractId) linked++;
  }

  return '<div class="stats-grid">' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + totalDocs + '</div>' +
      '<div class="stat-label">Total Documents</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + contracts + '</div>' +
      '<div class="stat-label">Contracts</div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-value">' + settlements + '</div>' +
      '<div class="stat-label">Settlements</div>' +
    '</div>' +
    '<div class="stat-card stat-green">' +
      '<div class="stat-value">' + linked + '</div>' +
      '<div class="stat-label">Linked</div>' +
    '</div>' +
  '</div>';
}

// ---- Documents Table ----

function _docRenderTable(docs) {
  if (docs.length === 0) {
    return '<div class="page-placeholder" style="padding: 48px 24px;">' +
      '<p>No documents uploaded yet</p>' +
      '<p style="margin-top:8px;font-size:13px">Upload contract confirmations and settlement PDFs to keep records organized.</p>' +
    '</div>';
  }

  var html = '<div class="table-wrap"><table>' +
    '<thead><tr>' +
      '<th>Type</th>' +
      '<th>Filename</th>' +
      '<th>Source</th>' +
      '<th>Linked Contract</th>' +
      '<th>Parsed Data</th>' +
      '<th>Date</th>' +
      '<th>Actions</th>' +
    '</tr></thead>' +
    '<tbody>';

  for (var i = 0; i < docs.length; i++) {
    var d = docs[i];
    var typeBadge = _docRenderTypeBadge(d.docType);
    var linkedInfo = _docGetLinkedContractInfo(d.linkedContractId);
    var parsedPreview = _docRenderParsedData(d.parsedData, d.id);
    var dateStr = _docFormatDate(d.createdAt);

    var sourceCell = d.source === 'email'
      ? '<td><span class="badge badge-info">Email</span><br><small>' + esc(d.emailFrom || '') + '</small></td>'
      : '<td><span class="badge">Upload</span></td>';

    html += '<tr class="doc-row">' +
      '<td>' + typeBadge + '</td>' +
      '<td class="doc-filename">' + esc(d.fileName || 'Unknown') + '</td>' +
      sourceCell +
      '<td>' + linkedInfo + '</td>' +
      '<td>' + parsedPreview + '</td>' +
      '<td style="white-space:nowrap">' + esc(dateStr) + '</td>' +
      '<td class="grain-actions">' +
        '<button class="btn btn-danger btn-sm" onclick="docDelete(\'' + escapeAttr(d.id) + '\')">Delete</button>' +
      '</td>' +
    '</tr>';
  }

  html += '</tbody></table></div>';
  return html;
}

// ---- Type Badge ----

function _docRenderTypeBadge(docType) {
  if (docType === 'contract') {
    return '<span class="doc-badge doc-badge-contract">Contract</span>';
  } else if (docType === 'settlement') {
    return '<span class="doc-badge doc-badge-settlement">Settlement</span>';
  }
  return '<span class="doc-badge doc-badge-other">' + esc(docType || 'Other') + '</span>';
}

// ---- Linked Contract Info ----

function _docGetLinkedContractInfo(contractId) {
  if (!contractId) {
    return '<span style="color:var(--text3)">Unlinked</span>';
  }
  var contracts = STATE.contracts || [];
  for (var i = 0; i < contracts.length; i++) {
    var c = contracts[i];
    if (c.id === contractId) {
      var color = COMMODITY_COLORS[c.commodity] || 'var(--text)';
      return '<span class="grain-commodity-dot" style="background:' + color + '"></span> ' +
        esc(c.contractType || '?') + ' \u2014 ' +
        esc(c.buyerName || '?') + ' \u2014 ' +
        _grainFmtBushels(c.bushels) + ' bu';
    }
  }
  return '<span style="color:var(--text3)">Linked (contract not found)</span>';
}

// ---- Parsed Data Preview ----

function _docRenderParsedData(parsedData, docId) {
  if (!parsedData || typeof parsedData !== 'object') {
    return '<span style="color:var(--text3)">\u2014</span>';
  }

  var keys = Object.keys(parsedData);
  if (keys.length === 0) {
    return '<span style="color:var(--text3)">\u2014</span>';
  }

  var maxShow = 3;
  var html = '<div class="doc-parsed">';

  for (var i = 0; i < Math.min(keys.length, maxShow); i++) {
    var key = keys[i];
    var val = parsedData[key];
    if (val == null) continue;
    // Truncate long values
    var valStr = String(val);
    if (valStr.length > 40) valStr = valStr.substring(0, 37) + '...';
    html += '<div class="doc-parsed-item"><span class="doc-parsed-key">' + esc(key) + ':</span> ' +
      '<span class="doc-parsed-val">' + esc(valStr) + '</span></div>';
  }

  if (keys.length > maxShow) {
    var remaining = keys.length - maxShow;
    html += '<button class="doc-parsed-more" onclick="_docToggleParsed(\'' + escapeAttr(docId) + '\')" ' +
      'id="docParsedToggle_' + escapeAttr(docId) + '">+' + remaining + ' more</button>';
    html += '<div class="doc-parsed-expanded" id="docParsedExpanded_' + escapeAttr(docId) + '" style="display:none">';
    for (var j = maxShow; j < keys.length; j++) {
      var eKey = keys[j];
      var eVal = parsedData[eKey];
      if (eVal == null) continue;
      var eValStr = String(eVal);
      if (eValStr.length > 40) eValStr = eValStr.substring(0, 37) + '...';
      html += '<div class="doc-parsed-item"><span class="doc-parsed-key">' + esc(eKey) + ':</span> ' +
        '<span class="doc-parsed-val">' + esc(eValStr) + '</span></div>';
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function _docToggleParsed(docId) {
  var expanded = document.getElementById('docParsedExpanded_' + docId);
  var toggleBtn = document.getElementById('docParsedToggle_' + docId);
  if (!expanded || !toggleBtn) return;

  if (expanded.style.display === 'none') {
    expanded.style.display = 'block';
    toggleBtn.textContent = 'Show less';
  } else {
    expanded.style.display = 'none';
    // Restore original text
    var itemCount = expanded.querySelectorAll('.doc-parsed-item').length;
    toggleBtn.textContent = '+' + itemCount + ' more';
  }
}

// ---- Upload Modal ----

function docOpenUploadModal() {
  var docTypes = ['contract', 'settlement'];
  var typeOpts = '';
  for (var i = 0; i < docTypes.length; i++) {
    var label = docTypes[i].charAt(0).toUpperCase() + docTypes[i].slice(1);
    typeOpts += '<option value="' + escapeAttr(docTypes[i]) + '">' + esc(label) + '</option>';
  }

  var html = '<h2 class="modal-title">Upload Document</h2>' +
    '<form id="docUploadForm" onsubmit="docUpload(event)">' +
      '<div class="form-group">' +
        '<label class="form-label">File (PDF only)</label>' +
        '<input type="file" class="form-input doc-file-input" id="docFile" accept=".pdf,.PDF" required>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Document Type</label>' +
        '<select class="form-select" id="docType">' + typeOpts + '</select>' +
      '</div>' +
      '<div class="form-group">' +
        '<label class="form-label">Notes (optional)</label>' +
        '<textarea class="form-input" id="docNotes" rows="3" placeholder="Optional notes about this document"></textarea>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary" id="docUploadBtn">Upload &amp; Parse</button>' +
      '</div>' +
    '</form>';

  showModal(html);
}

// ---- Upload Handler ----

function docUpload(e) {
  e.preventDefault();
  var file = document.getElementById('docFile').files[0];
  var docType = document.getElementById('docType').value;
  var notes = document.getElementById('docNotes').value.trim();
  if (!file) return showToast('Select a file', 'error');

  var btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Parsing...';

  var reader = new FileReader();
  reader.onload = function () {
    var base64 = reader.result; // data:...;base64,...
    var mediaType = file.type || 'application/pdf';

    parseRiskDocumentDB(base64, mediaType, file.name)
      .then(function (result) {
        // Save document with parsed data
        // JSONB gotcha: must JSON.stringify objects before passing to knex via CRUD
        var payload = {
          docType: result.parsed && result.parsed.docType ? result.parsed.docType : docType,
          fileName: file.name,
          parsedData: result.parsed ? JSON.stringify(result.parsed) : null,
          rawText: null,  // raw text populated server-side for email-sourced docs only
        };
        return _riskFetch('/risk/documents', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      })
      .then(function (doc) {
        STATE.documents.push(doc);
        closeModal();
        renderApp();
        showToast('Document parsed and saved', 'success');
      })
      .catch(function (err) {
        showToast('Parse failed: ' + err.message, 'error');
      })
      .finally(function () {
        btn.disabled = false;
        btn.textContent = 'Upload & Parse';
      });
  };
  reader.readAsDataURL(file);
}

// ---- Delete Handler ----

function docDelete(id) {
  if (!confirm('Delete this document? This cannot be undone.')) return;

  deleteRiskDocumentDB(id)
    .then(function() {
      STATE.documents = STATE.documents.filter(function(d) { return d.id !== id; });
      renderApp();
      showToast('Document deleted', 'success');
    })
    .catch(function(err) {
      showToast('Failed to delete: ' + err.message, 'error');
    });
}

// ---- Date Formatting ----

function _docFormatDate(dateStr) {
  if (!dateStr) return '\u2014';
  try {
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return esc(dateStr);
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + d.getFullYear();
  } catch (e) {
    return esc(dateStr);
  }
}
