// ==================== HOLMES RISK — SEASON ====================

var SEASON = {
  _current: '2026',
  _available: ['2025', '2026'],
  get current() { return this._current; },
  get previous() { return String(parseInt(this._current) - 1); },
  get next() { return String(parseInt(this._current) + 1); },
  get year() { return parseInt(this._current); },
  get label() { return this._current + ' Season'; }
};

(function() {
  var saved = localStorage.getItem('hf_risk_season');
  if (saved && /^\d{4}$/.test(saved)) SEASON._current = saved;
})();
