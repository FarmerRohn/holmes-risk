// ==================== HOLMES RISK — GOOGLE AUTH + REST SESSION ====================
// Google One Tap for identity -> POST /api/auth/login -> session cookie.

function initGoogleAuth() {
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
    setTimeout(initGoogleAuth, 500);
    return;
  }
  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: handleAuthResponse,
    auto_select: true
  });
}

function signInWithGoogle() {
  if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
    showToast('Google auth not loaded yet', 'error');
    return;
  }
  google.accounts.id.prompt(function(notification) {
    if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      var btnContainer = document.getElementById('googleSignInBtn');
      if (!btnContainer) {
        btnContainer = document.createElement('div');
        btnContainer.id = 'googleSignInBtn';
        var loginCard = document.querySelector('.login-card');
        if (loginCard) loginCard.appendChild(btnContainer);
      }
      google.accounts.id.renderButton(btnContainer, {
        theme: 'outline', size: 'large', text: 'signin_with', width: 280
      });
    }
  });
}

async function handleAuthResponse(response) {
  if (!response.credential) {
    showToast('Sign-in failed: no credential received', 'error');
    return;
  }

  try {
    var result = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: response.credential })
    });

    if (!result.ok) {
      var err = null; try { err = await result.json(); } catch(e) {}
      throw new Error((err && err.error) || 'Login failed: ' + result.status);
    }

    var user = await result.json();
    STATE.userEmail = user.email;
    STATE.user = { email: user.email, name: user.operatorName || '', picture: '' };
    STATE.role = user.role || 'employee';
    STATE.isManager = STATE.role === 'manager' || STATE.role === 'admin' || STATE.role === 'owner';

    // Check encryption status before loading data
    await _authCheckEncryption();
  } catch (e) {
    showToast('Sign-in failed: ' + e.message, 'error');
  }
}

async function tryRestoreSession() {
  try {
    var res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) {
      renderSignIn();
      return false;
    }

    var user = await res.json();
    if (!user.email) {
      renderSignIn();
      return false;
    }

    STATE.userEmail = user.email;
    STATE.user = { email: user.email, name: user.operatorName || '', picture: '' };
    STATE.role = user.role || 'employee';
    STATE.isManager = STATE.role === 'manager' || STATE.role === 'admin' || STATE.role === 'owner';

    // Check encryption status before loading data
    await _authCheckEncryption();
    return true;
  } catch (e) {
    renderSignIn();
    return false;
  }
}

function signOut() {
  fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(function() {});
  STATE.userEmail = null;
  STATE.user = null;
  STATE.role = null;
  STATE.isManager = false;
  STATE._dataLoaded = false;
  renderSignIn();
}

function renderSignIn() {
  var el = document.getElementById('app');
  if (!el) return;
  hideLoading();
  el.innerHTML =
    '<div class="login-screen">' +
      '<div class="login-card">' +
        '<h1 class="login-title">Holmes Farms</h1>' +
        '<div class="login-subtitle">Grain Marketing</div>' +
        '<div id="authStatus" class="auth-status pending">' +
          '<span>&#9679;</span> Sign in with Google to continue' +
        '</div>' +
        '<button class="google-btn" onclick="signInWithGoogle()" id="googleSignInBtn">' +
          'Sign in with Google' +
        '</button>' +
        '<div style="margin-top:24px;font-size:10px;color:var(--text3);text-align:center">&copy; 2025&ndash;2026 Adam Rohn</div>' +
      '</div>' +
    '</div>';
  initGoogleAuth();
}

// ---- Encryption gate ----

async function _authCheckEncryption() {
  try {
    var status = await checkEncryptionStatus();
    if (!status.hasEncryption) {
      // New user — show setup wizard
      initLockScreen();
      showLockPanel('setup');
    } else {
      // Existing user — fetch params and show PIN screen
      await fetchEncryptionParams();
      initLockScreen();
      showLockPanel('pin');
    }
    // Make the lock overlay visible (it starts display:none)
    var overlay = document.getElementById('lockOverlay');
    if (overlay) overlay.style.display = '';
  } catch (e) {
    // If encryption check fails (e.g. table doesn't exist yet), proceed without encryption
    connectAndLoad();
  }
}
