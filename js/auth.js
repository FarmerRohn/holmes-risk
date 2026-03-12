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
        var signinCard = document.querySelector('.signin-card');
        if (signinCard) signinCard.appendChild(btnContainer);
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

    connectAndLoad();
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

    connectAndLoad();
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
    '<div class="signin-screen">' +
      '<div class="signin-card">' +
        '<h1>Holmes Farms</h1>' +
        '<p class="signin-subtitle">Risk Management</p>' +
        '<button class="btn btn-primary btn-lg btn-submit" onclick="signInWithGoogle()">Sign in with Google</button>' +
        '<p class="signin-hint">Use your @holmesfarmsgp.com account</p>' +
      '</div>' +
    '</div>';
  initGoogleAuth();
}
