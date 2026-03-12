// ==================== HOLMES RISK — GLOBAL STATE ====================

var STATE = {
  user: null,
  userEmail: null,
  role: null,
  isManager: false,
  // Risk-specific state
  contracts: [],
  positions: [],
  elevatorHedges: [],
  deliveries: [],
  documents: [],
  cropInventory: [],
  binInventory: [],
  fertPositions: [],
  priceLog: [],
  settings: {},       // risk_settings key-value pairs
  marketPrices: [],
  // UI state
  activeTab: 'dashboard',
  activeCropYear: null, // from settings
  // Data loaded flags
  _dataLoaded: false
};
