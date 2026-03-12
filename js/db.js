// ==================== HOLMES RISK — REST API LAYER ====================
// Stub functions for each resource. Will be wired to real endpoints in Phase 1.3.

// ---- Helpers ----

function _riskFetch(path, opts) {
  var url = CONFIG.API_BASE + path;
  var defaults = { credentials: 'include', headers: { 'Content-Type': 'application/json' } };
  var merged = Object.assign({}, defaults, opts || {});
  if (opts && opts.headers) merged.headers = Object.assign({}, defaults.headers, opts.headers);
  return fetch(url, merged).then(function(res) {
    if (!res.ok) {
      return res.json().catch(function() { return {}; }).then(function(body) {
        throw new Error((body && body.error) || 'API error ' + res.status);
      });
    }
    if (res.status === 204) return null;
    return res.json();
  });
}

// ---- Risk Contracts ----

function fetchRiskContractsDB(cropYear) {
  var qs = cropYear ? '?crop_year=' + encodeURIComponent(cropYear) : '';
  return _riskFetch('/risk/contracts' + qs);
}

function createRiskContractDB(data) {
  return _riskFetch('/risk/contracts', { method: 'POST', body: JSON.stringify(data) });
}

function updateRiskContractDB(id, data) {
  return _riskFetch('/risk/contracts/' + id, { method: 'PUT', body: JSON.stringify(data) });
}

function deleteRiskContractDB(id) {
  return _riskFetch('/risk/contracts/' + id, { method: 'DELETE' });
}

// ---- Risk Positions ----

function fetchRiskPositionsDB(cropYear) {
  var qs = cropYear ? '?crop_year=' + encodeURIComponent(cropYear) : '';
  return _riskFetch('/risk/positions' + qs);
}

function createRiskPositionDB(data) {
  return _riskFetch('/risk/positions', { method: 'POST', body: JSON.stringify(data) });
}

function updateRiskPositionDB(id, data) {
  return _riskFetch('/risk/positions/' + id, { method: 'PUT', body: JSON.stringify(data) });
}

function deleteRiskPositionDB(id) {
  return _riskFetch('/risk/positions/' + id, { method: 'DELETE' });
}

// ---- Elevator Hedges ----

function fetchElevatorHedgesDB(cropYear) {
  var qs = cropYear ? '?crop_year=' + encodeURIComponent(cropYear) : '';
  return _riskFetch('/risk/elevator-hedges' + qs);
}

function createElevatorHedgeDB(data) {
  return _riskFetch('/risk/elevator-hedges', { method: 'POST', body: JSON.stringify(data) });
}

function updateElevatorHedgeDB(id, data) {
  return _riskFetch('/risk/elevator-hedges/' + id, { method: 'PUT', body: JSON.stringify(data) });
}

function deleteElevatorHedgeDB(id) {
  return _riskFetch('/risk/elevator-hedges/' + id, { method: 'DELETE' });
}

// ---- Deliveries ----

function fetchRiskDeliveriesDB(cropYear) {
  var qs = cropYear ? '?crop_year=' + encodeURIComponent(cropYear) : '';
  return _riskFetch('/risk/deliveries' + qs);
}

function createRiskDeliveryDB(data) {
  return _riskFetch('/risk/deliveries', { method: 'POST', body: JSON.stringify(data) });
}

function updateRiskDeliveryDB(id, data) {
  return _riskFetch('/risk/deliveries/' + id, { method: 'PUT', body: JSON.stringify(data) });
}

function deleteRiskDeliveryDB(id) {
  return _riskFetch('/risk/deliveries/' + id, { method: 'DELETE' });
}

// ---- Documents ----

function fetchRiskDocumentsDB(cropYear) {
  var qs = cropYear ? '?crop_year=' + encodeURIComponent(cropYear) : '';
  return _riskFetch('/risk/documents' + qs);
}

function uploadRiskDocumentDB(formData) {
  return fetch(CONFIG.API_BASE + '/risk/documents', {
    method: 'POST',
    credentials: 'include',
    body: formData  // FormData, no JSON content-type
  }).then(function(res) {
    if (!res.ok) throw new Error('Upload failed: ' + res.status);
    return res.json();
  });
}

function deleteRiskDocumentDB(id) {
  return _riskFetch('/risk/documents/' + id, { method: 'DELETE' });
}

// ---- Crop Inventory ----

function fetchCropInventoryDB(cropYear) {
  var qs = cropYear ? '?crop_year=' + encodeURIComponent(cropYear) : '';
  return _riskFetch('/risk/crop-inventory' + qs);
}

function createCropInventoryDB(data) {
  return _riskFetch('/risk/crop-inventory', { method: 'POST', body: JSON.stringify(data) });
}

function updateCropInventoryDB(id, data) {
  return _riskFetch('/risk/crop-inventory/' + id, { method: 'PUT', body: JSON.stringify(data) });
}

function deleteCropInventoryDB(id) {
  return _riskFetch('/risk/crop-inventory/' + id, { method: 'DELETE' });
}

// ---- Bin Inventory ----

function fetchBinInventoryDB(cropYear) {
  var qs = cropYear ? '?crop_year=' + encodeURIComponent(cropYear) : '';
  return _riskFetch('/risk/bin-inventory' + qs);
}

function createBinInventoryDB(data) {
  return _riskFetch('/risk/bin-inventory', { method: 'POST', body: JSON.stringify(data) });
}

function updateBinInventoryDB(id, data) {
  return _riskFetch('/risk/bin-inventory/' + id, { method: 'PUT', body: JSON.stringify(data) });
}

function deleteBinInventoryDB(id) {
  return _riskFetch('/risk/bin-inventory/' + id, { method: 'DELETE' });
}

// ---- Fert Positions ----

function fetchFertPositionsDB(cropYear) {
  var qs = cropYear ? '?crop_year=' + encodeURIComponent(cropYear) : '';
  return _riskFetch('/risk/fert-positions' + qs);
}

function createFertPositionDB(data) {
  return _riskFetch('/risk/fert-positions', { method: 'POST', body: JSON.stringify(data) });
}

function updateFertPositionDB(id, data) {
  return _riskFetch('/risk/fert-positions/' + id, { method: 'PUT', body: JSON.stringify(data) });
}

function deleteFertPositionDB(id) {
  return _riskFetch('/risk/fert-positions/' + id, { method: 'DELETE' });
}

// ---- Settings ----

function fetchRiskSettingsDB() {
  return _riskFetch('/risk/settings');
}

function upsertRiskSettingDB(key, value) {
  return _riskFetch('/risk/settings', { method: 'PUT', body: JSON.stringify({ key: key, value: value }) });
}

// ---- Price Log ----

function fetchPriceLogDB(commodity, limit) {
  var qs = '?';
  if (commodity) qs += 'commodity=' + encodeURIComponent(commodity) + '&';
  if (limit) qs += 'limit=' + limit;
  return _riskFetch('/risk/price-log' + qs);
}

function createPriceLogEntryDB(data) {
  return _riskFetch('/risk/price-log', { method: 'POST', body: JSON.stringify(data) });
}

// ---- Market ----

function fetchMarketQuotesDB() {
  return _riskFetch('/market/quotes');
}
