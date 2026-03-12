// Black-76 Greeks engine
// Pure math module — no UI, no API calls, no DOM manipulation.
// Ported from Grain-Tracker's Black-76 implementation.

// ── Cumulative standard normal distribution (Abramowitz & Stegun approximation) ──
function normCDF(x) {
  var a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741,
      a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  var sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  var t = 1 / (1 + p * x);
  var y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

// ── Standard normal probability density function ──
function normPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ── Black-76 model for futures options ──
// F = futures price, K = strike price, T = years to expiry
// r = risk-free rate (decimal), sigma = implied vol (decimal)
// type = 'Call' or 'Put'
// Returns { price, delta, gamma, theta, vega } or null if inputs invalid
function black76Greeks(F, K, T, r, sigma, type) {
  if (T <= 0 || sigma <= 0 || F <= 0 || K <= 0) return null;

  var sqrtT = Math.sqrt(T);
  var d1 = (Math.log(F / K) + 0.5 * sigma * sigma * T) / (sigma * sqrtT);
  var d2 = d1 - sigma * sqrtT;
  var disc = Math.exp(-r * T);
  var nd1 = normPDF(d1);
  var sign = type === 'Call' ? 1 : -1;

  var price = disc * (sign * (F * normCDF(sign * d1) - K * normCDF(sign * d2)));
  var delta = disc * sign * normCDF(sign * d1);
  var gamma = disc * nd1 / (F * sigma * sqrtT);
  var theta = -(F * nd1 * sigma * disc / (2 * sqrtT)) / 365;  // per day
  var vega  = F * nd1 * sqrtT * disc / 100;                    // per 1% vol change

  return { price: price, delta: delta, gamma: gamma, theta: theta, vega: vega };
}

// ── Implied volatility solver via bisection ──
// marketPrice = observed option price (same units as F, K)
// Returns sigma (decimal) or null if unsolvable
function impliedVol(marketPrice, F, K, T, r, type, tol, maxIter) {
  if (tol === undefined) tol = 0.0001;
  if (maxIter === undefined) maxIter = 100;
  if (T <= 0 || marketPrice <= 0) return null;

  var lo = 0.001, hi = 5.0;
  for (var i = 0; i < maxIter; i++) {
    var mid = (lo + hi) / 2;
    var res = black76Greeks(F, K, T, r, mid, type);
    if (!res) return null;
    if (Math.abs(res.price - marketPrice) < tol) return mid;
    if (res.price < marketPrice) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// ── CBOT futures month codes ──
var MONTH_CODES = { F:1, G:2, H:3, J:4, K:5, M:6, N:7, Q:8, U:9, V:10, X:11, Z:12 };

// ── Parse CBOT option symbol to approximate expiry date ──
// Input format: {ROOT(2)}{MONTH(1)}{YEAR(2)}{P|C}{STRIKE}
// e.g. ZCZ26P440 → approx last business day of Nov 2026
// CBOT grain options expire approximately last business day of the month BEFORE the contract month
// Returns Date object or null if parse fails
function symbolToExpiry(appSym) {
  var match = appSym.match(/^[A-Z]{2}([A-Z])(\d{2})[PC]/);
  if (!match) return null;

  var month = MONTH_CODES[match[1]];
  var year = 2000 + parseInt(match[2], 10);
  if (!month || !year) return null;

  // Expiry is approximately last business day of month BEFORE contract month
  var expMonth = month === 1 ? 12 : month - 1;
  var expYear  = month === 1 ? year - 1 : year;

  // Use the 22nd as a reasonable approximation for last week of the prior month
  return new Date(expYear, expMonth - 1, 22);
}
