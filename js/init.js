// ==================== HOLMES RISK — APP INITIALIZATION ====================

async function connectAndLoad() {
  showLoading();

  try {
    var results = await Promise.all([
      fetchRiskSettingsDB().catch(function(e) { console.warn('Settings load failed:', e); return []; }),
      fetchRiskContractsDB().catch(function(e) { console.warn('Contracts load failed:', e); return []; }),
      fetchRiskPositionsDB().catch(function(e) { console.warn('Positions load failed:', e); return []; }),
      fetchRiskDeliveriesDB().catch(function(e) { console.warn('Deliveries load failed:', e); return []; }),
      fetchRiskDocumentsDB().catch(function(e) { console.warn('Documents load failed:', e); return []; }),
      fetchCropInventoryDB().catch(function(e) { console.warn('Crop inventory load failed:', e); return []; }),
      fetchBinInventoryDB().catch(function(e) { console.warn('Bin inventory load failed:', e); return []; }),
      fetchFertPositionsDB().catch(function(e) { console.warn('Fert positions load failed:', e); return []; }),
      fetchMarketQuotesDB().catch(function(e) { console.warn('Market quotes load failed:', e); return []; })
    ]);

    // Unpack settings into key-value map
    if (Array.isArray(results[0])) {
      STATE.settings = {};
      results[0].forEach(function(row) { STATE.settings[row.key] = row.value; });
    }
    STATE.contracts = results[1] || [];
    STATE.positions = results[2] || [];
    STATE.deliveries = results[3] || [];
    STATE.documents = results[4] || [];
    STATE.cropInventory = results[5] || [];
    STATE.binInventory = results[6] || [];
    STATE.fertPositions = results[7] || [];
    STATE.marketPrices = results[8] || [];
    // Elevator hedges loaded per-contract on demand (nested API route)

    STATE._dataLoaded = true;
    hideLoading();
    renderApp();
  } catch (err) {
    hideLoading();
    showToast('Failed to load data: ' + err.message, 'error');
    renderApp();
  }
}

function renderApp() {
  var el = document.getElementById('app');
  if (!el) return;

  if (!STATE.user) {
    renderSignIn();
    return;
  }

  el.innerHTML = renderHeader() + renderTabNav() + renderPage();
}

function navigate(tab) {
  showPage(tab);
}

// Boot
document.addEventListener('DOMContentLoaded', function() {
  tryRestoreSession();
});
