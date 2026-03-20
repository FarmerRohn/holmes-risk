// ==================== HOLMES RISK — PAGE ROUTER ====================

function showPage(tab) {
  STATE.activeTab = tab;
  renderApp();
}

function renderPage() {
  switch (STATE.activeTab) {
    case 'dashboard':  return renderDashboardPage();
    case 'inventory':  return renderInventoryPage();
    case 'marketing':  return renderMarketingPage();
    case 'pricelog':   return renderPriceLogPage();
    case 'pnl':        return renderPnlPage();
    case 'documents':  return renderDocumentsPage();
    case 'settings':   return renderSettingsPage();
    default:           return renderDashboardPage();
  }
}
