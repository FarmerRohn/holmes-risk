// ==================== HOLMES RISK — PAGE ROUTER ====================

function showPage(tab) {
  STATE.activeTab = tab;
  renderApp();
}

function renderPage() {
  switch (STATE.activeTab) {
    case 'dashboard':  return renderDashboardPage();
    case 'grain':      return renderGrainPage();
    case 'positions':  return renderPositionsPage();
    case 'deliveries': return renderDeliveriesPage();
    case 'basis':      return renderBasisPage();
    case 'inputs':     return renderInputsPage();
    case 'inventory':  return renderInventoryPage();
    case 'market':     return renderMarketPage();
    case 'documents':  return renderDocumentsPage();
    case 'pnl':        return renderPnlPage();
    case 'settings':   return renderSettingsPage();
    default:           return renderDashboardPage();
  }
}
