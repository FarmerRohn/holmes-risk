// ==================== HOLMES RISK — LOCK SCREEN MODULE ====================
// PIN numpad, setup wizard, and password fallback for client-side encryption

var _lockPinBuffer = '';
var _lockPinLength = 4;
var _lockFailedAttempts = 0;
var _lockLockedUntil = 0;
var _lockAutoTimer = null;
var _lockEncryptionParams = null; // { salt, pinHash, pwHash, pinWrappedIv, pinWrappedCt, pinLength }
var LOCK_AUTO_MS = 30 * 60 * 1000;
var LOCK_MAX_ATTEMPTS = 5;
var LOCK_COOLDOWN_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

function renderLockScreen() {
  return '<div id="lockOverlay" class="lock-overlay" style="display:none;">' +
    '<div class="lock-card">' +

      // ---- Setup panel ----
      '<div id="lockSetupPanel" class="lock-panel" style="display:none;">' +
        '<div class="lock-icon">&#127806;</div>' +
        '<h2>Set Up Encryption</h2>' +
        '<p class="lock-subtitle">Create a PIN and password to protect grain data.</p>' +
        '<div class="lock-form">' +
          '<label for="setupPin">PIN (4-8 digits)</label>' +
          '<input id="setupPin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" placeholder="Enter PIN">' +
          '<label for="setupPinConfirm">Confirm PIN</label>' +
          '<input id="setupPinConfirm" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="8" autocomplete="off" placeholder="Confirm PIN">' +
          '<label for="setupPassword">Password (6+ characters)</label>' +
          '<input id="setupPassword" type="password" autocomplete="off" placeholder="Enter password">' +
          '<label for="setupPasswordConfirm">Confirm Password</label>' +
          '<input id="setupPasswordConfirm" type="password" autocomplete="off" placeholder="Confirm password">' +
          '<button class="lock-btn lock-btn-primary" onclick="lockSubmitSetup()">Enable Encryption</button>' +
        '</div>' +
      '</div>' +

      // ---- PIN panel ----
      '<div id="lockPinPanel" class="lock-panel" style="display:none;">' +
        '<div class="lock-icon">&#127806;</div>' +
        '<h2>Enter PIN</h2>' +
        '<div id="lockDots" class="lock-dots"></div>' +
        '<div id="lockPinError" class="lock-error"></div>' +
        '<div class="lock-numpad">' +
          '<button class="lock-num" onclick="lockPinPress(\'1\')">1</button>' +
          '<button class="lock-num" onclick="lockPinPress(\'2\')">2</button>' +
          '<button class="lock-num" onclick="lockPinPress(\'3\')">3</button>' +
          '<button class="lock-num" onclick="lockPinPress(\'4\')">4</button>' +
          '<button class="lock-num" onclick="lockPinPress(\'5\')">5</button>' +
          '<button class="lock-num" onclick="lockPinPress(\'6\')">6</button>' +
          '<button class="lock-num" onclick="lockPinPress(\'7\')">7</button>' +
          '<button class="lock-num" onclick="lockPinPress(\'8\')">8</button>' +
          '<button class="lock-num" onclick="lockPinPress(\'9\')">9</button>' +
          '<button class="lock-num lock-num-fn" onclick="lockPinClear()">Clear</button>' +
          '<button class="lock-num" onclick="lockPinPress(\'0\')">0</button>' +
          '<button class="lock-num lock-num-fn" onclick="lockPinDel()">&#9003;</button>' +
        '</div>' +
        '<a href="#" class="lock-link" onclick="showLockPanel(\'password\'); return false;">Forgot PIN?</a>' +
      '</div>' +

      // ---- Password panel ----
      '<div id="lockPasswordPanel" class="lock-panel" style="display:none;">' +
        '<div class="lock-icon">&#127806;</div>' +
        '<h2>Enter Password</h2>' +
        '<div class="lock-form">' +
          '<input id="lockPasswordInput" type="password" autocomplete="off" placeholder="Password">' +
          '<div id="lockPasswordError" class="lock-error"></div>' +
          '<button class="lock-btn lock-btn-primary" onclick="lockSubmitPassword()">Unlock</button>' +
          '<a href="#" class="lock-link" onclick="showLockPanel(\'pin\'); return false;">Back to PIN</a>' +
        '</div>' +
      '</div>' +

    '</div>' +
  '</div>';
}

// ---------------------------------------------------------------------------
// Panel switching
// ---------------------------------------------------------------------------

function showLockPanel(panel) {
  var setup = document.getElementById('lockSetupPanel');
  var pin = document.getElementById('lockPinPanel');
  var pw = document.getElementById('lockPasswordPanel');
  if (!setup || !pin || !pw) return;

  setup.style.display = 'none';
  pin.style.display = 'none';
  pw.style.display = 'none';

  if (panel === 'setup') {
    setup.style.display = '';
  } else if (panel === 'pin') {
    _lockPinBuffer = '';
    _lockUpdateDots();
    document.getElementById('lockPinError').textContent = '';
    pin.style.display = '';
  } else if (panel === 'password') {
    var input = document.getElementById('lockPasswordInput');
    if (input) input.value = '';
    document.getElementById('lockPasswordError').textContent = '';
    pw.style.display = '';
    if (input) input.focus();
  }
}

// ---------------------------------------------------------------------------
// PIN numpad
// ---------------------------------------------------------------------------

function lockPinPress(digit) {
  if (_lockPinBuffer.length >= _lockPinLength) return;

  // Check lockout
  if (_lockLockedUntil > Date.now()) {
    var secs = Math.ceil((_lockLockedUntil - Date.now()) / 1000);
    document.getElementById('lockPinError').textContent = 'Locked. Try again in ' + secs + 's';
    return;
  }

  _lockPinBuffer += digit;
  _lockUpdateDots();

  if (_lockPinBuffer.length === _lockPinLength) {
    lockSubmitPin();
  }
}

function lockPinDel() {
  if (_lockPinBuffer.length === 0) return;
  _lockPinBuffer = _lockPinBuffer.slice(0, -1);
  _lockUpdateDots();
}

function lockPinClear() {
  _lockPinBuffer = '';
  _lockUpdateDots();
}

function _lockUpdateDots() {
  var container = document.getElementById('lockDots');
  if (!container) return;
  var html = '';
  for (var i = 0; i < _lockPinLength; i++) {
    if (i < _lockPinBuffer.length) {
      html += '<span class="lock-dot lock-dot-filled"></span>';
    } else {
      html += '<span class="lock-dot"></span>';
    }
  }
  container.innerHTML = html;
}

// ---------------------------------------------------------------------------
// PIN submit
// ---------------------------------------------------------------------------

async function lockSubmitPin() {
  if (!_lockEncryptionParams) {
    document.getElementById('lockPinError').textContent = 'Encryption not configured.';
    _lockPinBuffer = '';
    _lockUpdateDots();
    return;
  }

  try {
    var salt = unb64(_lockEncryptionParams.salt);
    var enteredHash = await cryptoHashPin(_lockPinBuffer, salt);

    if (enteredHash !== _lockEncryptionParams.pinHash) {
      _lockFailedAttempts++;
      _lockPinBuffer = '';
      _lockUpdateDots();

      if (_lockFailedAttempts >= LOCK_MAX_ATTEMPTS) {
        _lockLockedUntil = Date.now() + LOCK_COOLDOWN_MS;
        _lockFailedAttempts = 0;
        document.getElementById('lockPinError').textContent =
          'Too many attempts. Locked for 5 minutes.';
      } else {
        document.getElementById('lockPinError').textContent =
          'Wrong PIN. ' + (LOCK_MAX_ATTEMPTS - _lockFailedAttempts) + ' attempts left.';
        _lockShake();
      }
      return;
    }

    // PIN correct — derive PIN key, unwrap password, derive master key
    var pinKey = await cryptoDeriveKey(_lockPinBuffer, salt);
    var password = await cryptoDecrypt(
      pinKey,
      _lockEncryptionParams.pinWrappedIv,
      _lockEncryptionParams.pinWrappedCt
    );
    var masterKey = await cryptoDeriveKey(password, salt);
    var cryptoKeyB64 = await cryptoExportKey(masterKey);

    var res = await fetch(CONFIG.API_BASE + '/auth/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cryptoKeyB64: cryptoKeyB64 })
    });

    if (!res.ok) throw new Error('Unlock failed: ' + res.status);

    _lockFailedAttempts = 0;
    _lockPinBuffer = '';
    unlockApp();
  } catch (err) {
    console.error('lockSubmitPin error:', err);
    document.getElementById('lockPinError').textContent = 'Unlock failed. Try again.';
    _lockPinBuffer = '';
    _lockUpdateDots();
  }
}

// ---------------------------------------------------------------------------
// Password submit
// ---------------------------------------------------------------------------

async function lockSubmitPassword() {
  if (!_lockEncryptionParams) {
    document.getElementById('lockPasswordError').textContent = 'Encryption not configured.';
    return;
  }

  var input = document.getElementById('lockPasswordInput');
  var password = input ? input.value : '';
  if (!password) {
    document.getElementById('lockPasswordError').textContent = 'Enter your password.';
    return;
  }

  try {
    var salt = unb64(_lockEncryptionParams.salt);
    var enteredHash = await cryptoHashPin(password, salt);

    if (enteredHash !== _lockEncryptionParams.pwHash) {
      document.getElementById('lockPasswordError').textContent = 'Wrong password.';
      if (input) input.value = '';
      return;
    }

    // Password correct — derive master key, export, unlock
    var masterKey = await cryptoDeriveKey(password, salt);
    var cryptoKeyB64 = await cryptoExportKey(masterKey);

    var res = await fetch(CONFIG.API_BASE + '/auth/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cryptoKeyB64: cryptoKeyB64 })
    });

    if (!res.ok) throw new Error('Unlock failed: ' + res.status);

    _lockFailedAttempts = 0;
    unlockApp();
  } catch (err) {
    console.error('lockSubmitPassword error:', err);
    document.getElementById('lockPasswordError').textContent = 'Unlock failed. Try again.';
  }
}

// ---------------------------------------------------------------------------
// Setup submit
// ---------------------------------------------------------------------------

async function lockSubmitSetup() {
  var pin = document.getElementById('setupPin').value;
  var pinConfirm = document.getElementById('setupPinConfirm').value;
  var password = document.getElementById('setupPassword').value;
  var passwordConfirm = document.getElementById('setupPasswordConfirm').value;

  // Validate PIN: 4-8 digits
  if (!/^\d{4,8}$/.test(pin)) {
    if (typeof showToast === 'function') showToast('PIN must be 4-8 digits.', 'error');
    return;
  }
  if (pin !== pinConfirm) {
    if (typeof showToast === 'function') showToast('PINs do not match.', 'error');
    return;
  }

  // Validate password: 6+ chars
  if (password.length < 6) {
    if (typeof showToast === 'function') showToast('Password must be at least 6 characters.', 'error');
    return;
  }
  if (password !== passwordConfirm) {
    if (typeof showToast === 'function') showToast('Passwords do not match.', 'error');
    return;
  }

  try {
    // Generate 32-byte salt
    var salt = crypto.getRandomValues(new Uint8Array(32));
    var saltB64 = b64(salt);

    // Hash PIN and password
    var pinHash = await cryptoHashPin(pin, salt);
    var pwHash = await cryptoHashPin(password, salt);

    // Derive PIN key and wrap password with it
    var pinKey = await cryptoDeriveKey(pin, salt);
    var wrapped = await cryptoEncrypt(pinKey, password);

    // Derive master key and export
    var masterKey = await cryptoDeriveKey(password, salt);
    var cryptoKeyB64 = await cryptoExportKey(masterKey);

    // POST setup to server
    var res = await fetch(CONFIG.API_BASE + '/auth/setup-encryption', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        salt: saltB64,
        pinHash: pinHash,
        pwHash: pwHash,
        pinWrappedIv: wrapped.iv,
        pinWrappedCt: wrapped.ct,
        pinLength: pin.length,
        cryptoKeyB64: cryptoKeyB64
      })
    });

    if (!res.ok) throw new Error('Setup failed: ' + res.status);

    _lockPinLength = pin.length;
    _lockEncryptionParams = {
      salt: saltB64,
      pinHash: pinHash,
      pwHash: pwHash,
      pinWrappedIv: wrapped.iv,
      pinWrappedCt: wrapped.ct,
      pinLength: pin.length
    };

    if (typeof showToast === 'function') showToast('Encryption enabled!', 'success');
    unlockApp();
  } catch (err) {
    console.error('lockSubmitSetup error:', err);
    if (typeof showToast === 'function') showToast('Setup failed. Please try again.', 'error');
  }
}

// ---------------------------------------------------------------------------
// Lock / Unlock
// ---------------------------------------------------------------------------

async function lockApp() {
  try {
    await fetch(CONFIG.API_BASE + '/auth/lock', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (err) {
    console.error('lockApp POST error:', err);
  }

  // Clear sensitive STATE arrays
  if (typeof STATE !== 'undefined') {
    var keys = ['contracts', 'positions', 'deliveries', 'hedges', 'basisContracts',
                'futures', 'inventory', 'buyers', 'settlements'];
    keys.forEach(function(k) {
      if (Array.isArray(STATE[k])) STATE[k] = [];
    });
  }

  // Clear auto-lock timer
  if (_lockAutoTimer) {
    clearTimeout(_lockAutoTimer);
    _lockAutoTimer = null;
  }

  var overlay = document.getElementById('lockOverlay');
  if (overlay) {
    overlay.style.display = '';
    showLockPanel('pin');
  }
}

function unlockApp() {
  var overlay = document.getElementById('lockOverlay');
  if (overlay) overlay.style.display = 'none';

  // Reload data
  if (typeof connectAndLoad === 'function') connectAndLoad();

  // Start auto-lock timer
  lockResetAutoTimer();
}

// ---------------------------------------------------------------------------
// Auto-lock timer
// ---------------------------------------------------------------------------

function lockResetAutoTimer() {
  if (_lockAutoTimer) clearTimeout(_lockAutoTimer);
  _lockAutoTimer = setTimeout(function() {
    lockApp();
  }, LOCK_AUTO_MS);
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

function initLockScreen() {
  // Inject lock screen HTML
  var container = document.createElement('div');
  container.innerHTML = renderLockScreen();
  document.body.appendChild(container.firstChild);

  // Wire idle detection
  var events = ['click', 'keydown', 'touchstart'];
  events.forEach(function(evt) {
    document.addEventListener(evt, lockResetAutoTimer, { passive: true });
  });
}

// ---------------------------------------------------------------------------
// Encryption status API
// ---------------------------------------------------------------------------

async function checkEncryptionStatus() {
  try {
    var res = await fetch(CONFIG.API_BASE + '/auth/encryption-status', {
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Status check failed: ' + res.status);
    return await res.json();
  } catch (err) {
    console.error('checkEncryptionStatus error:', err);
    return { hasEncryption: false, pinLength: 4 };
  }
}

async function fetchEncryptionParams() {
  try {
    var res = await fetch(CONFIG.API_BASE + '/auth/encryption-params', {
      credentials: 'include'
    });
    if (!res.ok) throw new Error('Params fetch failed: ' + res.status);
    var data = await res.json();
    _lockEncryptionParams = data;
    if (data.pinLength) _lockPinLength = data.pinLength;
    return data;
  } catch (err) {
    console.error('fetchEncryptionParams error:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shake animation
// ---------------------------------------------------------------------------

function _lockShake() {
  var card = document.querySelector('.lock-card');
  if (!card) return;
  card.classList.add('lock-shake');
  setTimeout(function() {
    card.classList.remove('lock-shake');
  }, 500);
}
