/**
 * Holmes Farms Risk App — Build Script
 * Concatenates JS files in dependency order, minifies with terser,
 * outputs production build to build/.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { minify } = require('terser');

const ROOT = __dirname;
const BUILD_DIR = path.join(ROOT, 'build');

// JS files in dependency order
const JS_FILES = [
  'js/config.js',
  'js/state.js',
  'js/season.js',
  'js/db.js',
  'js/auth.js',
  'js/ui.js',
  'js/greeks.js',
  'js/risk-calc.js',
  'js/charts.js',
  'js/pages/dashboard.js',
  'js/pages/grain.js',
  'js/pages/positions.js',
  'js/pages/deliveries.js',
  'js/pages/basis.js',
  'js/pages/inputs.js',
  'js/pages/inventory.js',
  'js/pages/market.js',
  'js/pages/documents.js',
  'js/pages/pnl.js',
  'js/pages/settings.js',
  'js/pages.js',
  'js/init.js'
];

// CSS files
const CSS_FILES = [
  'css/styles.css'
];

// Generate short content hash for cache-busting filenames
function contentHash(content) {
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,>~+])\s*/g, '$1')
    .replace(/;\}/g, '}')
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/ ?([@{};,]) ?/g, '$1');
}

function cleanBuildDir() {
  if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true, force: true });
    console.log('  Cleaned build/\n');
  }
}

async function build() {
  console.log('Building Holmes Farms Risk App...\n');

  cleanBuildDir();

  // 1. Concatenate all JS files
  let combined = '';
  let totalOrigSize = 0;

  for (const file of JS_FILES) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) {
      console.error('  MISSING: ' + file);
      process.exit(1);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    totalOrigSize += content.length;
    combined += '\n// === ' + file + ' ===\n' + content;
    console.log('  + ' + file + ' (' + (content.length / 1024).toFixed(1) + ' KB)');
  }

  console.log('\n  Combined: ' + (totalOrigSize / 1024).toFixed(1) + ' KB');

  // 2. Minify with terser
  console.log('  Minifying...');
  const result = await minify(combined, {
    compress: {
      dead_code: true,
      drop_console: false,
      passes: 2
    },
    mangle: {
      reserved: [
        // Global state/config
        'STATE', 'CONFIG', 'SEASON',
        'CONTRACT_TYPES', 'CONTRACT_STATUS', 'POSITION_SIDES', 'OPTION_TYPES',
        'COMMODITY_COLORS', 'FUTURES_MONTHS', 'MONTH_NAMES',
        'DEFAULT_COMMODITIES', 'DEFAULT_BUSHELS_PER_CONTRACT', 'DEFAULT_UNIT_LABELS',
        'TAB_CONFIG',
        // Greeks engine
        'normCDF', 'normPDF', 'black76Greeks', 'impliedVol', 'symbolToExpiry',
        'MONTH_CODES',
        // Risk calculations
        'calcEffectivePrice', 'calcPL', 'calcExposure', 'calcNetDelta',
        'getLatestFuturesPrice',
        // UI utilities
        'esc', 'escapeAttr', 'showToast', 'showLoading', 'hideLoading',
        'showModal', 'closeModal', 'toggleTheme',
        // Auth functions
        'initGoogleAuth', 'signInWithGoogle',
        'handleAuthResponse', 'tryRestoreSession', 'signOut',
        'renderSignIn',
        // App functions
        'renderApp', 'navigate', 'connectAndLoad',
        'showPage', 'renderPage',
        // UI rendering
        'renderHeader', 'renderTabNav',
        // DB functions — contracts
        'fetchRiskContractsDB', 'createRiskContractDB', 'updateRiskContractDB', 'deleteRiskContractDB',
        // DB functions — positions
        'fetchRiskPositionsDB', 'createRiskPositionDB', 'updateRiskPositionDB', 'deleteRiskPositionDB',
        // DB functions — elevator hedges (nested under contracts)
        'fetchElevatorHedgesDB', 'createElevatorHedgeDB', 'updateElevatorHedgeDB', 'deleteElevatorHedgeDB',
        // DB functions — contract rolls
        'fetchContractRollsDB', 'createContractRollDB',
        // DB functions — deliveries
        'fetchRiskDeliveriesDB', 'createRiskDeliveryDB', 'updateRiskDeliveryDB', 'deleteRiskDeliveryDB',
        // DB functions — documents
        'fetchRiskDocumentsDB', 'uploadRiskDocumentDB', 'deleteRiskDocumentDB',
        // DB functions — crop inventory
        'fetchCropInventoryDB', 'createCropInventoryDB', 'updateCropInventoryDB', 'deleteCropInventoryDB',
        // DB functions — bin inventory
        'fetchBinInventoryDB', 'createBinInventoryDB', 'updateBinInventoryDB', 'deleteBinInventoryDB',
        // DB functions — fert positions
        'fetchFertPositionsDB', 'createFertPositionDB', 'updateFertPositionDB', 'deleteFertPositionDB',
        // DB functions — settings
        'fetchRiskSettingsDB', 'upsertRiskSettingDB',
        // DB functions — price log
        'fetchPriceLogDB', 'createPriceLogEntryDB',
        // DB functions — market
        'fetchMarketQuotesDB',
        // Page renderers
        'renderDashboardPage', 'renderGrainPage', 'renderPositionsPage',
        'renderDeliveriesPage', 'renderBasisPage', 'renderInputsPage',
        'renderInventoryPage', 'renderMarketPage', 'renderDocumentsPage',
        'renderPnlPage', 'renderSettingsPage',
        // Dashboard page functions
        'dashboardRefreshPrices',
        // Grain page functions
        'grainOpenContractModal', 'grainDeleteContract', 'grainApplyFilter',
        'grainSaveContract', 'grainOnTypeChange', 'grainToggleRow',
        // Grain page — elevator hedge functions
        'grainOpenHedgeModal', 'grainSaveHedge', 'grainDeleteHedge',
        // Grain page — contract roll functions
        'grainOpenRollModal', 'grainSaveRoll', '_grainUpdateRollPreview',
        // Grain page — contract split functions
        'grainOpenSplitModal', '_grainSplitRenderPieces', '_grainSplitUpdateTotal', '_grainSplitSave',
        // Positions page functions
        'posOpenPositionModal', 'posDeletePosition', 'posApplyFilter',
        'posSavePosition', 'posOnTypeChange', 'posOnStatusChange',
        'posOnCommodityChange', 'posToggleRow', 'posUpdatePnlPreview',
        'posCalcGreeks', 'posOpenExerciseModal', 'posConfirmExercise',
        // Positions page — roll functions
        'posOpenRollModal', 'posConfirmRoll', '_posRollUpdatePreview',
        // Positions page — split functions
        'posOpenSplitModal', 'posConfirmSplit', '_posSplitRenderPieces', '_posSplitUpdateTotal',
        // Settings page functions
        'settingsSaveCropYear', 'settingsSaveInput', 'settingsSaveElevators',
        // Price log functions
        'priceLogOpenModal', 'priceLogSave', 'priceLogFilterChange'
      ]
    },
    output: {
      comments: false
    }
  });

  if (result.error) {
    console.error('Minification failed:', result.error);
    process.exit(1);
  }

  const minified = '/*! Holmes Farms Platform — Copyright (c) 2025-2026 Adam Rohn & Corey Holmes. All rights reserved. Proprietary and confidential. */\n' + result.code;
  console.log('  Minified: ' + (minified.length / 1024).toFixed(1) + ' KB');
  console.log('  Reduction: ' + ((1 - minified.length / totalOrigSize) * 100).toFixed(0) + '%\n');

  // 3. Create build directory structure
  fs.mkdirSync(path.join(BUILD_DIR, 'js'), { recursive: true });
  fs.mkdirSync(path.join(BUILD_DIR, 'css'), { recursive: true });

  // 4. Write content-hashed JS
  const jsHash = contentHash(minified);
  const jsFilename = 'app.min.' + jsHash + '.js';
  fs.writeFileSync(path.join(BUILD_DIR, 'js', jsFilename), minified);
  console.log('  Wrote build/js/' + jsFilename);

  // 5. Combine and minify CSS
  console.log('\n  Minifying CSS...');
  let combinedCSS = '';
  let totalCSSOrigSize = 0;

  for (const cssFile of CSS_FILES) {
    const cssPath = path.join(ROOT, cssFile);
    if (fs.existsSync(cssPath)) {
      const content = fs.readFileSync(cssPath, 'utf8');
      totalCSSOrigSize += content.length;
      combinedCSS += '\n/* === ' + cssFile + ' === */\n' + content;
      console.log('  + ' + cssFile + ' (' + (content.length / 1024).toFixed(1) + ' KB)');
    }
  }

  const minifiedCSS = minifyCSS(combinedCSS);
  const cssHash = contentHash(minifiedCSS);
  const cssFilename = 'styles.' + cssHash + '.css';
  fs.writeFileSync(path.join(BUILD_DIR, 'css', cssFilename), minifiedCSS);
  console.log('  Minified CSS: ' + (minifiedCSS.length / 1024).toFixed(1) + ' KB');
  console.log('  CSS reduction: ' + ((1 - minifiedCSS.length / totalCSSOrigSize) * 100).toFixed(0) + '%');
  console.log('  Wrote build/css/' + cssFilename);

  // 6. Copy favicon if present
  const faviconPath = path.join(ROOT, 'favicon.ico');
  if (fs.existsSync(faviconPath)) {
    fs.copyFileSync(faviconPath, path.join(BUILD_DIR, 'favicon.ico'));
    console.log('  Copied build/favicon.ico');
  }

  // 7. Generate build/index.html with hashed filenames
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  let buildHtml = indexHtml
    .replace(
      /<!-- Application Scripts[\s\S]*?<script src="js\/init\.js"><\/script>/,
      '<!-- Application (minified) -->\n<script src="js/' + jsFilename + '"></script>'
    )
    .replace(
      /<link rel="stylesheet" href="css\/styles\.css">/,
      '<link rel="stylesheet" href="css/' + cssFilename + '">'
    );

  fs.writeFileSync(path.join(BUILD_DIR, 'index.html'), buildHtml);
  console.log('  Wrote build/index.html');

  // 8. Copy manifest.json if present
  const manifestPath = path.join(ROOT, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    fs.copyFileSync(manifestPath, path.join(BUILD_DIR, 'manifest.json'));
    console.log('  Copied build/manifest.json');
  }

  // 9. Copy static assets if present
  const assetsDir = path.join(ROOT, 'assets');
  if (fs.existsSync(assetsDir)) {
    copyDirSync(assetsDir, path.join(BUILD_DIR, 'assets'));
    console.log('  Copied build/assets/');
  }

  // 10. Build summary
  const totalDeployed = getDirSize(BUILD_DIR);
  console.log('\n=== Build complete ===');
  console.log('  JS:    js/' + jsFilename + ' (' + (minified.length / 1024).toFixed(0) + ' KB)');
  console.log('  CSS:   css/' + cssFilename + ' (' + (minifiedCSS.length / 1024).toFixed(0) + ' KB)');
  console.log('  Total: ' + (totalDeployed / 1024).toFixed(0) + ' KB deployed');
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function getDirSize(dir) {
  let total = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += getDirSize(p);
    } else {
      total += fs.statSync(p).size;
    }
  }
  return total;
}

build().catch(function(err) {
  console.error('Build failed:', err);
  process.exit(1);
});
