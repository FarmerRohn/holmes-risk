// ==================== HOLMES RISK — REST API LAYER ====================

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
  var qs = cropYear ? '?cropYear=' + encodeURIComponent(cropYear) : '';
  return _riskFetch('/risk/contracts' + qs);
}

function createRiskContractDB(data) {
  return _riskFetch('/risk/contracts', { method: 'POST', body: JSON.stringify(data) });
}

function updateRiskContractDB(id, data) {
  return _riskFetch('/risk/contracts/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}

function deleteRiskContractDB(id) {
  return _riskFetch('/risk/contracts/' + id, { method: 'DELETE' });
}

// ---- Contract Rolls (nested under /contracts/:id/rolls) ----

function fetchContractRollsDB(contractId) {
  return _riskFetch('/risk/contracts/' + contractId + '/rolls');
}

function createContractRollDB(contractId, data) {
  return _riskFetch('/risk/contracts/' + contractId + '/rolls', { method: 'POST', body: JSON.stringify(data) });
}

// ---- Risk Positions ----

function fetchRiskPositionsDB(cropYear) {
  var qs = cropYear ? '?cropYear=' + encodeURIComponent(cropYear) : '';
  return _riskFetch('/risk/positions' + qs);
}

function createRiskPositionDB(data) {
  return _riskFetch('/risk/positions', { method: 'POST', body: JSON.stringify(data) });
}

function updateRiskPositionDB(id, data) {
  return _riskFetch('/risk/positions/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}

function deleteRiskPositionDB(id) {
  return _riskFetch('/risk/positions/' + id, { method: 'DELETE' });
}

// ---- Elevator Hedges (nested under /contracts/:id/hedges) ----

function fetchElevatorHedgesDB(contractId) {
  return _riskFetch('/risk/contracts/' + contractId + '/hedges');
}

function createElevatorHedgeDB(contractId, data) {
  return _riskFetch('/risk/contracts/' + contractId + '/hedges', { method: 'POST', body: JSON.stringify(data) });
}

function updateElevatorHedgeDB(contractId, hedgeId, data) {
  return _riskFetch('/risk/contracts/' + contractId + '/hedges/' + hedgeId, { method: 'PATCH', body: JSON.stringify(data) });
}

function deleteElevatorHedgeDB(contractId, hedgeId) {
  return _riskFetch('/risk/contracts/' + contractId + '/hedges/' + hedgeId, { method: 'DELETE' });
}

// ---- Deliveries ----

function fetchRiskDeliveriesDB(cropYear) {
  var qs = cropYear ? '?cropYear=' + encodeURIComponent(cropYear) : '';
  return _riskFetch('/risk/deliveries' + qs);
}

function createRiskDeliveryDB(data) {
  return _riskFetch('/risk/deliveries', { method: 'POST', body: JSON.stringify(data) });
}

function updateRiskDeliveryDB(id, data) {
  return _riskFetch('/risk/deliveries/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}

function deleteRiskDeliveryDB(id) {
  return _riskFetch('/risk/deliveries/' + id, { method: 'DELETE' });
}

// ---- Documents ----

function fetchRiskDocumentsDB() {
  return _riskFetch('/risk/documents');
}

function parseRiskDocumentDB(data, mediaType, fileName) {
  return _riskFetch('/risk/documents/parse', {
    method: 'POST',
    body: JSON.stringify({ data: data, mediaType: mediaType, fileName: fileName }),
  });
}

function deleteRiskDocumentDB(id) {
  return _riskFetch('/risk/documents/' + id, { method: 'DELETE' });
}

// ---- Crop Inventory ----

function fetchCropInventoryDB(cropYear) {
  var qs = cropYear ? '?cropYear=' + encodeURIComponent(cropYear) : '';
  return _riskFetch('/risk/crop-inventory' + qs);
}

function createCropInventoryDB(data) {
  return _riskFetch('/risk/crop-inventory', { method: 'POST', body: JSON.stringify(data) });
}

function updateCropInventoryDB(id, data) {
  return _riskFetch('/risk/crop-inventory/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}

function deleteCropInventoryDB(id) {
  return _riskFetch('/risk/crop-inventory/' + id, { method: 'DELETE' });
}

// ---- Bin Inventory ----

function fetchBinInventoryDB(cropYear) {
  var qs = cropYear ? '?cropYear=' + encodeURIComponent(cropYear) : '';
  return _riskFetch('/risk/bin-inventory' + qs);
}

function createBinInventoryDB(data) {
  return _riskFetch('/risk/bin-inventory', { method: 'POST', body: JSON.stringify(data) });
}

function updateBinInventoryDB(id, data) {
  return _riskFetch('/risk/bin-inventory/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}

function deleteBinInventoryDB(id) {
  return _riskFetch('/risk/bin-inventory/' + id, { method: 'DELETE' });
}

// ---- Fert Positions ----

function fetchFertPositionsDB(cropYear) {
  var qs = cropYear ? '?cropYear=' + encodeURIComponent(cropYear) : '';
  return _riskFetch('/risk/fert-positions' + qs);
}

function createFertPositionDB(data) {
  return _riskFetch('/risk/fert-positions', { method: 'POST', body: JSON.stringify(data) });
}

function updateFertPositionDB(id, data) {
  return _riskFetch('/risk/fert-positions/' + id, { method: 'PATCH', body: JSON.stringify(data) });
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
  var params = [];
  if (commodity) params.push('commodity=' + encodeURIComponent(commodity));
  if (limit) params.push('limit=' + limit);
  var qs = params.length ? '?' + params.join('&') : '';
  return _riskFetch('/risk/price-log' + qs);
}

function createPriceLogEntryDB(data) {
  return _riskFetch('/risk/price-log', { method: 'POST', body: JSON.stringify(data) });
}

// ---- Market ----

function fetchMarketQuotesDB() {
  return _riskFetch('/market/quotes');
}

function fetchForwardCurveDB(commodity) {
  return _riskFetch('/market/forward-curve/' + encodeURIComponent(commodity));
}

function fetchBasisDB() {
  return _riskFetch('/market/basis');
}

function fetchBasisHistoryDB() {
  return _riskFetch('/market/basis-history');
}

function fetchIvAnalyticsDB(commodity) {
  return _riskFetch('/market/iv-analytics/' + encodeURIComponent(commodity));
}

function fetchSpreadsDB(commodity) {
  return _riskFetch('/market/spreads/' + encodeURIComponent(commodity));
}

function fetchOptionsChainDB(commodity) {
  return _riskFetch('/market/options-chain/' + encodeURIComponent(commodity));
}

function fetchSignalsDB(commodity) {
  return _riskFetch('/market/signals/' + encodeURIComponent(commodity));
}

/* ── Budget ─────────────────────────────────── */
function fetchBudgetDB(season) {
  var qs = season ? '?season=' + season : '';
  return _riskFetch('/risk/budget' + qs);
}
function createBudgetDB(data) {
  return _riskFetch('/risk/budget', { method: 'POST', body: JSON.stringify(data) });
}
function updateBudgetDB(id, data) {
  return _riskFetch('/risk/budget/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}
function deleteBudgetDB(id) {
  return _riskFetch('/risk/budget/' + id, { method: 'DELETE' });
}

/* ── Expenses ───────────────────────────────── */
function fetchExpensesDB(season) {
  var qs = season ? '?season=' + season : '';
  return _riskFetch('/risk/expenses' + qs);
}
function createExpenseDB(data) {
  return _riskFetch('/risk/expenses', { method: 'POST', body: JSON.stringify(data) });
}
function updateExpenseDB(id, data) {
  return _riskFetch('/risk/expenses/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}

/* ── Price Targets ──────────────────────────── */
function fetchPriceTargetsDB(cropYear) {
  var qs = cropYear ? '?cropYear=' + cropYear : '';
  return _riskFetch('/risk/price-targets' + qs);
}
function createPriceTargetDB(data) {
  return _riskFetch('/risk/price-targets', { method: 'POST', body: JSON.stringify(data) });
}
function updatePriceTargetDB(id, data) {
  return _riskFetch('/risk/price-targets/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}
function deletePriceTargetDB(id) {
  return _riskFetch('/risk/price-targets/' + id, { method: 'DELETE' });
}

/* ── Other Income ───────────────────────────── */
function fetchOtherIncomeDB(season) {
  var qs = season ? '?season=' + season : '';
  return _riskFetch('/risk/other-income' + qs);
}
function createOtherIncomeDB(data) {
  return _riskFetch('/risk/other-income', { method: 'POST', body: JSON.stringify(data) });
}
function updateOtherIncomeDB(id, data) {
  return _riskFetch('/risk/other-income/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}

/* ── Freight Rates ──────────────────────────── */
function fetchFreightRatesDB() {
  return _riskFetch('/risk/freight-rates');
}
function createFreightRateDB(data) {
  return _riskFetch('/risk/freight-rates', { method: 'POST', body: JSON.stringify(data) });
}
function updateFreightRateDB(id, data) {
  return _riskFetch('/risk/freight-rates/' + id, { method: 'PATCH', body: JSON.stringify(data) });
}
function deleteFreightRateDB(id) {
  return _riskFetch('/risk/freight-rates/' + id, { method: 'DELETE' });
}

/* ── Aggregation (read-only from portal tables) */
function fetchProductionBaseDB(season) {
  return _riskFetch('/risk-aggregate/production-base?season=' + (season || SEASON.current));
}
function fetchCostSummaryDB(season) {
  return _riskFetch('/risk-aggregate/cost-summary?season=' + (season || SEASON.current));
}
function fetchHarvestSummaryDB(season) {
  return _riskFetch('/risk-aggregate/harvest-summary?season=' + (season || SEASON.current));
}
function fetchBuyersDB() {
  return _riskFetch('/risk-aggregate/buyers');
}
