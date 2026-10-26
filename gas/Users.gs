/** User management (admin only). */

function usersList_(payload) {
  requireUser_(payload, ['admin']);
  const filters = payload.filters || {};
  const query = trim_(filters.q).toLowerCase();
  const role = trim_(filters.role);

  const items = readRows_('Users')
    .filter(function (user) {
      return role ? user.role === role : true;
    })
    .filter(function (user) {
      if (!query) return true;
      return (
        (user.name + ' ' + user.email + ' ' + (user.nis || '') + ' ' + (user.kelas || ''))
          .toLowerCase()
          .indexOf(query) >= 0
      );
    })
    .sort(function (a, b) {
      return String(a.name).localeCompare(String(b.name));
    })
    .map(publicUser_);

  return paginate_(items, filters.page, filters.pageSize);
}

function validateEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function usersCreate_(payload) {
  const admin = requireUser_(payload, ['admin']);
  const input = payload.input || {};
  const name = trim_(input.name);
  const email = trim_(input.email).toLowerCase();
  const role = trim_(input.role);

  if (!name) fail_('VALIDATION', 'Nama wajib diisi.');
  if (!validateEmail_(email)) fail_('VALIDATION', 'Email tidak valid.');
  if (ROLES.indexOf(role) < 0) fail_('VALIDATION', 'Role tidak valid.');
  if (!input.credential || String(input.credential).length < 20) {
    fail_('VALIDATION', 'Kata sandi wajib diisi.');
  }

  return withLock_(function () {
    const users = readRows_('Users');
    const duplicate = users.filter(function (user) {
      return String(user.email).toLowerCase() === email;
    })[0];
    if (duplicate) fail_('CONFLICT', 'Email sudah terdaftar.');

    const now = nowIso_();
    const row = {
      id: newId_('USR'),
      email: email,
      name: name,
      role: role,
      nis: trim_(input.nis),
      kelas: trim_(input.kelas),
      passwordHash: hashCredential_(String(input.credential)),
      googleSub: '',
      avatarUrl: trim_(input.avatarUrl),
      active: input.active === false ? false : true,
      tokenVersion: 0,
      createdAt: now,
      updatedAt: now,
    };
    insertRow_('Users', row);
    logAction_(admin, 'user.create', 'user', row.id, { role: role });
    return { user: publicUser_(row) };
  });
}

function usersUpdate_(payload) {
  const admin = requireUser_(payload, ['admin']);
  const id = trim_(payload.id);
  const input = payload.input || {};

  return withLock_(function () {
    const user = findById_('Users', id);
    if (!user) fail_('NOT_FOUND', 'Pengguna tidak ditemukan.');

    const patch = { updatedAt: nowIso_() };
    if (input.name !== undefined) {
      if (!trim_(input.name)) fail_('VALIDATION', 'Nama tidak boleh kosong.');
      patch.name = trim_(input.name);
    }
    if (input.email !== undefined) {
      const email = trim_(input.email).toLowerCase();
      if (!validateEmail_(email)) fail_('VALIDATION', 'Email tidak valid.');
      const duplicate = readRows_('Users').filter(function (item) {
        return item.id !== id && String(item.email).toLowerCase() === email;
      })[0];
      if (duplicate) fail_('CONFLICT', 'Email sudah dipakai pengguna lain.');
      patch.email = email;
    }
    if (input.role !== undefined) {
      if (ROLES.indexOf(input.role) < 0) fail_('VALIDATION', 'Role tidak valid.');
      patch.role = input.role;
    }
    if (input.nis !== undefined) patch.nis = trim_(input.nis);
    if (input.kelas !== undefined) patch.kelas = trim_(input.kelas);
    if (input.avatarUrl !== undefined) patch.avatarUrl = trim_(input.avatarUrl);
    if (input.active !== undefined) {
      patch.active = input.active !== false;
      if (id === admin.id && patch.active === false) {
        fail_('VALIDATION', 'Tidak bisa menonaktifkan akun sendiri.');
      }
    }

    updateRow_('Users', id, patch);
    logAction_(admin, 'user.update', 'user', id);
    return { user: publicUser_(findById_('Users', id)) };
  });
}

function usersDelete_(payload) {
  const admin = requireUser_(payload, ['admin']);
  const id = trim_(payload.id);
  if (id === admin.id) fail_('VALIDATION', 'Tidak bisa menghapus akun sendiri.');

  return withLock_(function () {
    const user = findById_('Users', id);
    if (!user) fail_('NOT_FOUND', 'Pengguna tidak ditemukan.');
    if (user.role === 'admin') {
      const admins = readRows_('Users').filter(function (item) {
        return item.role === 'admin';
      });
      if (admins.length <= 1) fail_('VALIDATION', 'Minimal harus ada satu admin.');
    }
    deleteRowById_('Users', id);
    logAction_(admin, 'user.delete', 'user', id, { email: user.email });
    return { ok: true };
  });
}

function usersResetPassword_(payload) {
  const admin = requireUser_(payload, ['admin']);
  const id = trim_(payload.id);
  const credential = trim_(payload.credential);
  if (credential.length < 20) fail_('VALIDATION', 'Kredensial tidak valid.');

  return withLock_(function () {
    const user = findById_('Users', id);
    if (!user) fail_('NOT_FOUND', 'Pengguna tidak ditemukan.');
    updateRow_('Users', id, {
      passwordHash: hashCredential_(credential),
      tokenVersion: toNumber_(user.tokenVersion, 0) + 1,
      updatedAt: nowIso_(),
    });
    logAction_(admin, 'user.reset_password', 'user', id);
    return { ok: true };
  });
}
