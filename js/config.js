// ==================== HOLMES RISK — CONFIG ====================

var CONFIG = {
  GOOGLE_CLIENT_ID: '858171614448-cft82bknt4s11ur0t8p40tl5pp8vmjt0.apps.googleusercontent.com',
  ADMIN_EMAIL: 'adamrohn@holmesfarmsgp.com',
  OWNER_EMAIL: 'corey@holmesfarmsgp.com',
  AUTO_ADD_DOMAIN: 'holmesfarmsgp.com',
  API_BASE: '/api'
};

var CONTRACT_TYPES = ['HTA', 'Cash', 'Basis', 'Bushels Only', 'DP', 'Min Price', 'Accumulator'];
var CONTRACT_STATUS = ['Open', 'Delivered', 'Cancelled', 'Split'];
var POSITION_SIDES = ['Long', 'Short'];
var OPTION_TYPES = ['Call', 'Put'];
var COMMODITY_COLORS = { Corn: '#e9b949', Soybeans: '#2d6a4f', Wheat: '#c2956c', 'Heating Oil': '#2b6cb0' };
var FUTURES_MONTHS = ['F','G','H','J','K','M','N','Q','U','V','X','Z'];
var MONTH_NAMES = { F:'Jan',G:'Feb',H:'Mar',J:'Apr',K:'May',M:'Jun',N:'Jul',Q:'Aug',U:'Sep',V:'Oct',X:'Nov',Z:'Dec' };
var DEFAULT_COMMODITIES = ['Corn', 'Soybeans', 'Wheat', 'Heating Oil'];
var DEFAULT_BUSHELS_PER_CONTRACT = { Corn: 5000, Soybeans: 5000, Wheat: 5000, 'Heating Oil': 42000 };
var DEFAULT_UNIT_LABELS = { Corn: 'bu', Soybeans: 'bu', Wheat: 'bu', 'Heating Oil': 'gal' };
var APP_VERSION = '2.0.0';
