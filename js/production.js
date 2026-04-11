/* production.js — unified production base calculation
 *
 * Single source of truth for "how many bushels do we expect?"
 * Pulls from field_season data (via risk-aggregate API), eliminates
 * the manual gross bushel entry in settings.
 *
 * Falls back to manually-entered grossBushels in settings if
 * field_season data is not available for a commodity.
 */

function productionBase(commodity, season) {
  season = season || STATE.activeCropYear || SEASON.current;

  // Primary: field_season aggregation
  if (STATE.productionData && STATE.productionData.length) {
    var match = STATE.productionData.find(function(r) {
      return r.commodity === commodity;
    });
    if (match && parseFloat(match.total_bushels) > 0) {
      return parseFloat(match.total_bushels);
    }
  }

  // Fallback: manual settings entry (for commodities not in field_season, like Heating Oil)
  var key = 'grossBushels:' + commodity + ':' + season;
  var manual = STATE.settings[key];
  if (manual) return parseFloat(manual) || 0;

  return 0;
}

function productionAcres(commodity, season) {
  if (STATE.productionData && STATE.productionData.length) {
    var match = STATE.productionData.find(function(r) {
      return r.commodity === commodity;
    });
    if (match) return parseFloat(match.total_acres) || 0;
  }
  return 0;
}

function productionYield(commodity, season) {
  if (STATE.productionData && STATE.productionData.length) {
    var match = STATE.productionData.find(function(r) {
      return r.commodity === commodity;
    });
    if (match) return parseFloat(match.avg_yield) || 0;
  }
  return 0;
}
