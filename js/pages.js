// ==================== HOLMES RISK — PAGE ROUTER ====================

function showPage(tab) {
  STATE.activeTab = tab;
  renderApp();
}

function renderPage() {
  switch (STATE.activeTab) {
    case 'marketing':  return renderMarketingPage();
    case 'charts':     return renderChartsPage();
    case 'pnl':        return renderPnlPage();
    case 'settings':   return renderSettingsPage();
    default:           return renderMarketingPage();
  }
}
