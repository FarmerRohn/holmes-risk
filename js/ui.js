// ==================== HOLMES RISK — UI UTILITIES ====================

function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---- Toast Notifications ----

function showToast(msg, type) {
  var existing = document.querySelector('.toast');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.className = 'toast toast-' + (type || 'info');
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(function() { toast.classList.add('toast-visible'); });
  setTimeout(function() {
    toast.classList.remove('toast-visible');
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

// ---- Loading Overlay ----

function showLoading() {
  var el = document.getElementById('loadingOverlay');
  if (el) el.style.display = 'flex';
}

function hideLoading() {
  var el = document.getElementById('loadingOverlay');
  if (el) el.style.display = 'none';
}

// ---- Modal Dialog ----

var _modalKeyHandler = null;

function showModal(html) {
  closeModal();
  var backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'modalBackdrop';
  backdrop.onclick = function(e) { if (e.target === backdrop) closeModal(); };

  var modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = html;
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  _modalKeyHandler = function(e) {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Tab') {
      var focusable = modal.querySelectorAll('button,input,select,textarea,a,[tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener('keydown', _modalKeyHandler);
  var firstFocusable = modal.querySelector('button,input,select,textarea');
  if (firstFocusable) setTimeout(function() { firstFocusable.focus(); }, 50);
}

function closeModal() {
  var el = document.getElementById('modalBackdrop');
  if (el) el.remove();
  document.body.style.overflow = '';
  if (_modalKeyHandler) {
    document.removeEventListener('keydown', _modalKeyHandler);
    _modalKeyHandler = null;
  }
}

// ---- Theme Toggle ----

function toggleTheme() {
  var current = document.documentElement.dataset.theme;
  var next = current === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('hf-theme', next);
}

// ---- Header ----

function renderHeader() {
  var name = (STATE.user && STATE.user.name) || STATE.userEmail || '';
  var cropYear = STATE.activeCropYear || (STATE.settings && STATE.settings.activeCropYear) || SEASON.current;
  return '<header class="app-header">' +
    '<div class="header-left">' +
      '<span class="app-icon">\uD83C\uDF3E</span>' +
      '<span class="page-title">Grain Marketing</span>' +
      '<span class="crop-year-badge">' + esc(cropYear) + '</span>' +
    '</div>' +
    '<div class="header-right">' +
      '<span class="header-user">' + esc(name) + '</span>' +
      '<button class="icon-btn" onclick="toggleTheme()" title="Toggle theme" aria-label="Toggle theme">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>' +
      '</button>' +
      '<button class="icon-btn" onclick="signOut()" title="Sign out" aria-label="Sign out">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>' +
      '</button>' +
    '</div>' +
  '</header>';
}

// ---- Tab Navigation ----

var TAB_CONFIG = [
  { id: 'marketing', label: 'Marketing' },
  { id: 'charts', label: 'Charts' },
  { id: 'pnl', label: 'P&L' },
  { id: 'settings', label: 'Settings' }
];

function renderTabNav() {
  var html = '<nav class="tab-nav"><div class="tab-nav-inner">';
  for (var i = 0; i < TAB_CONFIG.length; i++) {
    var tab = TAB_CONFIG[i];
    var active = STATE.activeTab === tab.id ? ' tab-active' : '';
    html += '<button class="tab-btn' + active + '" onclick="showPage(\'' + tab.id + '\')">' + esc(tab.label) + '</button>';
  }
  html += '</div></nav>';
  return html;
}
