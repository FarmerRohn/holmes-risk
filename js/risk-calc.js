// ==================== HOLMES RISK — RISK CALCULATIONS ====================
// Pure calculation module — reads from STATE, no DOM manipulation, no API calls.

// ---- Helper: get latest futures price for a commodity ----

function getLatestFuturesPrice(commodity, marketPrices) {
  if (!marketPrices || !marketPrices.length) return null;
  for (var i = 0; i < marketPrices.length; i++) {
    if (marketPrices[i].commodity === commodity) {
      return marketPrices[i].lastPrice != null ? parseFloat(marketPrices[i].lastPrice) : null;
    }
  }
  return null;
}

// ---- Effective price for a single contract ----

function calcEffectivePrice(contract, latestFuturesQuote) {
  if (!contract || !contract.contractType) return null;

  switch (contract.contractType) {
    case 'Cash':
      return contract.cashPrice != null ? parseFloat(contract.cashPrice) : null;

    case 'HTA':
      if (contract.futuresPrice != null) {
        var fp = parseFloat(contract.futuresPrice);
        if (contract.basisLevel != null) {
          return fp + parseFloat(contract.basisLevel);
        }
        return fp;
      }
      return null;

    case 'Basis':
      if (latestFuturesQuote != null && contract.basisLevel != null) {
        return parseFloat(latestFuturesQuote) + parseFloat(contract.basisLevel);
      }
      return null;

    case 'Min Price':
      // effectivePrice = max(strike, latestFutures) + basis - premium
      if (contract.strikePrice != null && latestFuturesQuote != null) {
        var strike = parseFloat(contract.strikePrice);
        var futures = parseFloat(latestFuturesQuote);
        var basis = contract.basisLevel != null ? parseFloat(contract.basisLevel) : 0;
        var premium = contract.premium != null ? parseFloat(contract.premium) : 0;
        return Math.max(strike, futures) + basis - premium;
      }
      return null;

    case 'Accumulator':
      // effectivePrice = strike (floor price) + basis
      if (contract.strikePrice != null) {
        var floor = parseFloat(contract.strikePrice);
        var accBasis = contract.basisLevel != null ? parseFloat(contract.basisLevel) : 0;
        return floor + accBasis;
      }
      return null;

    case 'DP':
      return null;

    case 'Bushels Only':
      return null;

    default:
      return null;
  }
}

// ---- Net delta in bushel equivalents from open positions ----

function calcNetDelta(positions) {
  if (!positions || !positions.length) return 0;

  var total = 0;
  for (var i = 0; i < positions.length; i++) {
    var p = positions[i];
    // Skip closed and expired positions
    if (p.status === 'Closed' || p.status === 'Expired') continue;
    var delta = p.delta != null ? parseFloat(p.delta) : 0;
    var numContracts = p.contracts != null ? parseFloat(p.contracts) : 0;
    var bpc = p.bushelsPerContract != null ? parseFloat(p.bushelsPerContract) : 5000;
    total += delta * numContracts * bpc;
  }
  return total;
}

// ---- P&L calculation ----

function calcPL(contracts, positions, settings, marketPrices) {
  var realized = 0;
  var unrealized = 0;

  contracts = contracts || [];
  positions = positions || [];
  settings = settings || {};
  marketPrices = marketPrices || [];

  // --- Realized P&L from delivered contracts ---
  for (var i = 0; i < contracts.length; i++) {
    var c = contracts[i];
    if (c.status !== 'Delivered') continue;

    var commodity = c.commodity || '';
    var costBasis = _getCostBasis(commodity, settings);
    var latestQuote = getLatestFuturesPrice(commodity, marketPrices);
    var ep = calcEffectivePrice(c, latestQuote);
    if (ep === null) continue;

    var bu = c.bushels != null ? parseFloat(c.bushels) : 0;
    realized += (ep - costBasis) * bu;
  }

  // --- Realized P&L from closed positions ---
  for (var j = 0; j < positions.length; j++) {
    var pos = positions[j];
    if (pos.status !== 'Closed' || pos.closedPrice == null) continue;

    var closedPrice = parseFloat(pos.closedPrice);
    var entryPrice = pos.entryPrice != null ? parseFloat(pos.entryPrice) : 0;
    var numContracts = pos.contracts != null ? parseFloat(pos.contracts) : 0;
    var bpc = pos.bushelsPerContract != null ? parseFloat(pos.bushelsPerContract) : 5000;
    var sideSign = pos.positionSide === 'Short' ? -1 : 1;
    realized += (closedPrice - entryPrice) * numContracts * bpc * sideSign;
  }

  // --- Unrealized P&L from open contracts ---
  for (var k = 0; k < contracts.length; k++) {
    var oc = contracts[k];
    if (oc.status !== 'Open') continue;

    var ocCommodity = oc.commodity || '';
    var ocCostBasis = _getCostBasis(ocCommodity, settings);
    var ocLatestQuote = getLatestFuturesPrice(ocCommodity, marketPrices);
    var ocEp = calcEffectivePrice(oc, ocLatestQuote);
    if (ocEp === null) continue;

    var ocBu = oc.bushels != null ? parseFloat(oc.bushels) : 0;
    unrealized += (ocEp - ocCostBasis) * ocBu;
  }

  // --- Unrealized P&L from open positions ---
  for (var m = 0; m < positions.length; m++) {
    var op = positions[m];
    if (op.status === 'Closed' || op.status === 'Expired') continue;
    if (op.currentPrice == null || op.entryPrice == null) continue;

    var opCurrent = parseFloat(op.currentPrice);
    var opEntry = parseFloat(op.entryPrice);
    var opContracts = op.contracts != null ? parseFloat(op.contracts) : 0;
    var opBpc = op.bushelsPerContract != null ? parseFloat(op.bushelsPerContract) : 5000;
    var opSideSign = op.positionSide === 'Short' ? -1 : 1;
    unrealized += (opCurrent - opEntry) * opContracts * opBpc * opSideSign;
  }

  return { realized: realized, unrealized: unrealized, total: realized + unrealized };
}

// ---- Exposure calculation ----

function calcExposure(contracts, positions, settings, cropYear) {
  contracts = contracts || [];
  positions = positions || [];
  settings = settings || {};
  cropYear = cropYear || STATE.activeCropYear || SEASON.current;

  // Collect unique commodities from contracts
  var commodityMap = {};
  for (var i = 0; i < contracts.length; i++) {
    var commodity = contracts[i].commodity;
    if (commodity && !commodityMap[commodity]) {
      commodityMap[commodity] = true;
    }
  }
  // Also include commodities that have grossBushels settings
  for (var key in settings) {
    if (settings.hasOwnProperty(key)) {
      var gbMatch = key.match(/^grossBushels:([^:]+):/);
      if (gbMatch && !commodityMap[gbMatch[1]]) {
        commodityMap[gbMatch[1]] = true;
      }
    }
  }

  var byCommodity = {};
  var totals = {
    pricedOpen: 0, basisOpen: 0, soldDelivered: 0,
    unpriced: 0, optionsDeltaBu: 0, committed: 0,
    hedgePct: 0, grossBushels: 0
  };

  var commodities = Object.keys(commodityMap);
  for (var ci = 0; ci < commodities.length; ci++) {
    var comm = commodities[ci];
    var result = _calcCommodityExposure(comm, contracts, positions, settings, cropYear);
    byCommodity[comm] = result;

    totals.pricedOpen += result.pricedOpen;
    totals.basisOpen += result.basisOpen;
    totals.soldDelivered += result.soldDelivered;
    totals.unpriced += result.unpriced;
    totals.optionsDeltaBu += result.optionsDeltaBu;
    totals.committed += result.committed;
    totals.grossBushels += result.grossBushels;
  }

  // Recalculate total hedge percentage from aggregated totals
  totals.hedgePct = totals.grossBushels > 0
    ? (totals.committed + totals.optionsDeltaBu) / totals.grossBushels * 100
    : 0;

  return { byCommodity: byCommodity, totals: totals };
}

// ---- Internal: exposure for a single commodity ----

function _calcCommodityExposure(commodity, contracts, positions, settings, cropYear) {
  var pricedOpen = 0;
  var basisOpen = 0;
  var soldDelivered = 0;
  var unpriced = 0;

  // Filter contracts by commodity
  for (var i = 0; i < contracts.length; i++) {
    var c = contracts[i];
    if (c.commodity !== commodity) continue;

    var bu = c.bushels != null ? parseFloat(c.bushels) : 0;

    if (c.status === 'Delivered') {
      soldDelivered += bu;
    } else if (c.status === 'Open') {
      if (c.contractType === 'Cash' || c.contractType === 'HTA' || c.contractType === 'Min Price' || c.contractType === 'Accumulator') {
        pricedOpen += bu;
      } else if (c.contractType === 'Basis') {
        basisOpen += bu;
      } else if (c.contractType === 'DP' || c.contractType === 'Bushels Only') {
        unpriced += bu;
      }
    }
  }

  // Filter positions by commodity for delta calc
  var commPositions = [];
  for (var j = 0; j < positions.length; j++) {
    if (positions[j].commodity === commodity) {
      commPositions.push(positions[j]);
    }
  }
  var optionsDeltaBu = calcNetDelta(commPositions);

  var grossBushels = _getGrossBushels(commodity, cropYear, settings);
  var committed = pricedOpen + basisOpen + soldDelivered;
  var hedgePct = grossBushels > 0
    ? (committed + optionsDeltaBu) / grossBushels * 100
    : 0;

  return {
    pricedOpen: pricedOpen,
    basisOpen: basisOpen,
    soldDelivered: soldDelivered,
    unpriced: unpriced,
    optionsDeltaBu: optionsDeltaBu,
    committed: committed,
    hedgePct: hedgePct,
    grossBushels: grossBushels
  };
}

// ---- Internal helpers ----

function _getCostBasis(commodity, settings) {
  var key = 'costBasis:' + commodity;
  var val = settings[key];
  if (val == null) return 0;
  var n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function _getGrossBushels(commodity, cropYear, settings) {
  var key = 'grossBushels:' + commodity + ':' + cropYear;
  var val = settings[key];
  if (val == null) return 0;
  var n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}
