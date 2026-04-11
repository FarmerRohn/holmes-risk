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
  // New — redesign state
  budget: [],
  expenses: [],
  priceTargets: [],
  otherIncome: [],
  freightRates: [],
  productionData: [],
  costSummary: null,
  harvestSummary: [],
  buyers: [],
  // UI state
  activeTab: 'marketing',
  activeCropYear: null, // from settings
  // Data loaded flags
  _dataLoaded: false
};
