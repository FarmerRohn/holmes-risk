// ==================== HOLMES RISK — CRYPTO MODULE ====================
// Web Crypto API wrapper for client-side key derivation and encryption

/**
 * Convert Uint8Array to base64 string
 */
function b64(uint8Array) {
  var binary = '';
  for (var i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary);
}

/**
 * Convert base64 string back to Uint8Array
 */
function unb64(base64String) {
  var binary = atob(base64String);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive AES-256-GCM CryptoKey from password string + salt (Uint8Array).
 * Uses PBKDF2 with 310,000 iterations, SHA-256.
 * Key is extractable so we can export it for server-side use.
 */
async function cryptoDeriveKey(password, salt) {
  var enc = new TextEncoder();
  var keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 310000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Hash a PIN string with PBKDF2 (100,000 iterations, SHA-256, 256-bit output).
 * Returns base64 string.
 */
async function cryptoHashPin(pin, salt) {
  var enc = new TextEncoder();
  var keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  var bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return b64(new Uint8Array(bits));
}

/**
 * Export CryptoKey raw bytes as base64 string
 */
async function cryptoExportKey(cryptoKey) {
  var raw = await crypto.subtle.exportKey('raw', cryptoKey);
  return b64(new Uint8Array(raw));
}

/**
 * Encrypt string with AES-256-GCM.
 * Generates 12-byte random IV.
 * Returns { iv: base64, ct: base64 }.
 */
async function cryptoEncrypt(cryptoKey, plaintext) {
  var enc = new TextEncoder();
  var iv = crypto.getRandomValues(new Uint8Array(12));
  var ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    cryptoKey,
    enc.encode(plaintext)
  );
  return {
    iv: b64(iv),
    ct: b64(new Uint8Array(ciphertext))
  };
}

/**
 * Decrypt AES-256-GCM ciphertext. Returns plaintext string.
 */
async function cryptoDecrypt(cryptoKey, ivB64, ctB64) {
  var iv = unb64(ivB64);
  var ct = unb64(ctB64);
  var plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    cryptoKey,
    ct
  );
  return new TextDecoder().decode(plaintext);
}
