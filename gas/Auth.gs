/**
 * Authentication & authorization.
 *
 * Password protocol:
 *   1. Browser derives a 100k-iteration PBKDF2 verifier (never sends the password).
 *   2. Server stores HMAC-SHA256(verifier, TOKEN_SECRET) — a server-side pepper.
 *   3. Login recomputes the HMAC and compares in constant time.
 *
 * Apps Script cannot run bcrypt, and 100k HMAC calls would exceed its execution
 * budget, hence the client-side KDF + server pepper design (documented in
 * docs/ARCHITECTURE.md).
 */

function bytesToHex_(bytes) {
  let hex = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const value = (bytes[i] + 256) % 256;
    hex += (value < 16 ? '0' : '') + value.toString(16);
  }
  return hex;
}

function timingSafeEqual_(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function hashCredential_(credential) {
  return bytesToHex_(
    Utilities.computeHmacSha256Signature(String(credential), passwordPepper_()),
  );
}

function hmacBase64_(value) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(value, tokenSecret_()),
  );
}

function encodeBase64Url_(value) {
  return Utilities.base64EncodeWebSafe(value, Utilities.Charset.UTF_8);
}

function decodeBase64Url_(value) {
  return Utilities.newBlob(Utilities.base64DecodeWebSafe(value)).getDataAsString('UTF-8');
}

function makeToken_(user, type, ttlSeconds) {
  const payload = {
    sub: user.id,
    typ: type,
    exp: Date.now() + ttlSeconds * 1000,
    tv: toNumber_(user.tokenVersion, 0),
  };
  const encoded = encodeBase64Url_(JSON.stringify(payload));
  return encoded + '.' + hmacBase64_(encoded);
}

function decodeToken_(token, expectedType) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) fail_('UNAUTHORIZED', 'Token tidak valid.');
  const encoded = parts[0];
  const signature = parts[1];
  if (!timingSafeEqual_(signature, hmacBase64_(encoded))) {
    fail_('UNAUTHORIZED', 'Tanda tangan token tidak valid.');
  }
  let payload;
  try {
    payload = JSON.parse(decodeBase64Url_(encoded));
  } catch (error) {
    fail_('UNAUTHORIZED', 'Token tidak dapat dibaca.');
  }
  if (!payload || !payload.sub || !payload.typ) fail_('UNAUTHORIZED', 'Token tidak valid.');
  if (expectedType && payload.typ !== expectedType) fail_('UNAUTHORIZED', 'Jenis token tidak sesuai.');
  if (toNumber_(payload.exp, 0) < Date.now()) {
    if (payload.typ === 'access') fail_('TOKEN_EXPIRED', 'Sesi berakhir, menyegarkan token...');
    fail_('SESSION_EXPIRED', 'Sesi berakhir. Silakan masuk kembali.');
  }
  return payload;
}

function publicUser_(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    nis: row.nis || undefined,
    kelas: row.kelas || undefined,
    avatarUrl: row.avatarUrl || undefined,
    active: toBool_(row.active),
    createdAt: toIso_(row.createdAt),
    updatedAt: toIso_(row.updatedAt),
  };
}

function sessionFor_(userRow) {
  return {
    accessToken: makeToken_(userRow, 'access', CONFIG.ACCESS_TOKEN_TTL_SECONDS),
    refreshToken: makeToken_(userRow, 'refresh', CONFIG.REFRESH_TOKEN_TTL_SECONDS),
    user: publicUser_(userRow),
  };
}

function requireUser_(payload, roles) {
  const token = payload && payload.token ? String(payload.token) : '';
  if (!token) fail_('UNAUTHORIZED', 'Anda harus masuk terlebih dahulu.');
  const decoded = decodeToken_(token, 'access');
  const user = findById_('Users', decoded.sub);
  if (!user) fail_('UNAUTHORIZED', 'Akun tidak ditemukan.');
  if (!toBool_(user.active)) fail_('FORBIDDEN', 'Akun dinonaktifkan. Hubungi admin.');
  if (toNumber_(user.tokenVersion, 0) !== toNumber_(decoded.tv, 0)) {
    fail_('UNAUTHORIZED', 'Sesi sudah dicabut. Silakan masuk kembali.');
  }
  if (roles && roles.length > 0 && roles.indexOf(user.role) < 0) {
    fail_('FORBIDDEN', 'Anda tidak memiliki akses untuk tindakan ini.');
  }
  return user;
}

function rateLimit_(key, limit, windowSeconds) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'rl:' + key;
  const current = toNumber_(cache.get(cacheKey), 0);
  if (current >= limit) {
    fail_('RATE_LIMITED', 'Terlalu banyak permintaan. Tunggu beberapa saat lalu coba lagi.');
  }
  cache.put(cacheKey, String(current + 1), windowSeconds);
}

function logAction_(actor, action, entity, entityId, meta) {
  try {
    insertRow_('Logs', {
      id: newId_('LOG'),
      ts: nowIso_(),
      actorId: actor ? actor.id : '',
      actorName: actor ? actor.name : 'Sistem',
      action: action,
      entity: entity || '',
      entityId: entityId || '',
      metaJson: meta ? toJson_(meta) : '',
    });
  } catch (error) {
    console.error('logAction failed', error);
  }
}

/* -------------------------------------------------------------------------- */
/* Auth handlers                                                              */
/* -------------------------------------------------------------------------- */

function authLogin_(payload) {
  const email = trim_(payload.email).toLowerCase();
  const credential = trim_(payload.credential);
  if (!email || !credential) fail_('VALIDATION', 'Email dan kata sandi wajib diisi.');
  rateLimit_('login:' + email, 10, 60);

  const users = readRows_('Users');
  const user = users.filter(function (item) {
    return String(item.email).toLowerCase() === email;
  })[0];

  if (!user || !user.passwordHash) fail_('UNAUTHORIZED', 'Email atau kata sandi salah.');
  if (!timingSafeEqual_(hashCredential_(credential), String(user.passwordHash))) {
    fail_('UNAUTHORIZED', 'Email atau kata sandi salah.');
  }
  if (!toBool_(user.active)) fail_('FORBIDDEN', 'Akun dinonaktifkan. Hubungi admin.');

  logAction_(user, 'auth.login', 'user', user.id);
  return sessionFor_(user);
}

function authRefresh_(payload) {
  const token = trim_(payload.refreshToken);
  if (!token) fail_('UNAUTHORIZED', 'Refresh token tidak ditemukan.');
  const decoded = decodeToken_(token, 'refresh');
  const user = findById_('Users', decoded.sub);
  if (!user) fail_('SESSION_EXPIRED', 'Akun tidak ditemukan.');
  if (!toBool_(user.active)) fail_('FORBIDDEN', 'Akun dinonaktifkan.');
  if (toNumber_(user.tokenVersion, 0) !== toNumber_(decoded.tv, 0)) {
    fail_('SESSION_EXPIRED', 'Sesi sudah dicabut. Silakan masuk kembali.');
  }
  return sessionFor_(user);
}

function authMe_(payload) {
  const user = requireUser_(payload);
  return { user: publicUser_(user) };
}

function authLogout_(payload) {
  const user = requireUser_(payload);
  updateRow_('Users', user.id, {
    tokenVersion: toNumber_(user.tokenVersion, 0) + 1,
    updatedAt: nowIso_(),
  });
  logAction_(user, 'auth.logout', 'user', user.id);
  return { ok: true };
}

function authChangePassword_(payload) {
  const user = requireUser_(payload);
  const current = trim_(payload.currentCredential);
  const next = trim_(payload.newCredential);
  if (!current || !next) fail_('VALIDATION', 'Kata sandi lama dan baru wajib diisi.');
  if (!timingSafeEqual_(hashCredential_(current), String(user.passwordHash))) {
    fail_('VALIDATION', 'Kata sandi lama tidak cocok.');
  }
  if (next.length < 20) fail_('VALIDATION', 'Kredensial baru tidak valid.');
  updateRow_('Users', user.id, {
    passwordHash: hashCredential_(next),
    tokenVersion: toNumber_(user.tokenVersion, 0) + 1,
    updatedAt: nowIso_(),
  });
  logAction_(user, 'auth.change_password', 'user', user.id);
  return { ok: true };
}

function authUpdateProfile_(payload) {
  const user = requireUser_(payload);
  const name = trim_(payload.name);
  if (!name) fail_('VALIDATION', 'Nama wajib diisi.');
  updateRow_('Users', user.id, {
    name: name,
    avatarUrl: trim_(payload.avatarUrl),
    updatedAt: nowIso_(),
  });
  return { user: publicUser_(findById_('Users', user.id)) };
}

/**
 * Google OAuth: the frontend sends a Google ID token obtained from GIS.
 * We verify it with Google's tokeninfo endpoint and match the email to an
 * existing account (no auto-provisioning, to keep the roster controlled).
 */
function authGoogle_(payload) {
  const idToken = trim_(payload.idToken);
  if (!idToken) fail_('VALIDATION', 'ID token Google tidak ditemukan.');
  const clientId = getProp_('GOOGLE_CLIENT_ID', '');
  if (!clientId) fail_('FORBIDDEN', 'Login Google belum dikonfigurasi pada server.');

  const response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true },
  );
  if (response.getResponseCode() !== 200) {
    fail_('UNAUTHORIZED', 'Token Google tidak valid atau sudah kedaluwarsa.');
  }
  const info = JSON.parse(response.getContentText());
  if (info.aud !== clientId) fail_('UNAUTHORIZED', 'Token Google bukan untuk aplikasi ini.');
  if (String(info.email_verified) !== 'true') fail_('UNAUTHORIZED', 'Email Google belum terverifikasi.');

  const email = String(info.email || '').toLowerCase();
  const users = readRows_('Users');
  const user = users.filter(function (item) {
    return String(item.email).toLowerCase() === email;
  })[0];
  if (!user) fail_('FORBIDDEN', 'Akun Google ini belum terdaftar. Hubungi admin sekolah.');
  if (!toBool_(user.active)) fail_('FORBIDDEN', 'Akun dinonaktifkan. Hubungi admin.');
  if (user.googleSub && String(user.googleSub) !== String(info.sub)) {
    fail_('FORBIDDEN', 'Akun ini sudah terhubung dengan akun Google lain.');
  }
  if (!user.googleSub) {
    updateRow_('Users', user.id, { googleSub: String(info.sub), updatedAt: nowIso_() });
    user.googleSub = String(info.sub);
  }
  logAction_(user, 'auth.google_login', 'user', user.id);
  return sessionFor_(user);
}
