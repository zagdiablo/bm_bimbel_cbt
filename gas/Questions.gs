/** Question bank CRUD + bulk import. */

function normalizeTags_(value) {
  if (Array.isArray(value)) {
    return value
      .map(function (tag) {
        return trim_(tag);
      })
      .filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map(function (tag) {
      return tag.trim();
    })
    .filter(Boolean);
}

function questionFromRow_(row, ownerName) {
  return {
    id: row.id,
    ownerId: row.ownerId,
    ownerName: ownerName || undefined,
    tipe: row.tipe,
    pertanyaan: row.pertanyaan,
    gambarUrl: row.gambarUrl || undefined,
    options: parseJson_(row.opsiJson, []),
    kunci: parseJson_(row.kunciJson, {}),
    pembahasan: row.pembahasan || undefined,
    bobot: toNumber_(row.bobot, 1),
    tingkat: row.tingkat,
    kategori: row.kategori,
    tags: String(row.tags || '')
      .split(',')
      .map(function (tag) {
        return tag.trim();
      })
      .filter(Boolean),
    aktif: toBool_(row.aktif),
    createdAt: toIso_(row.createdAt),
    updatedAt: toIso_(row.updatedAt),
  };
}

function validateQuestionInput_(input) {
  if (!input || typeof input !== 'object') fail_('VALIDATION', 'Data soal tidak ditemukan.');
  const tipe = trim_(input.tipe);
  const pertanyaan = trim_(input.pertanyaan);
  const kategori = trim_(input.kategori);
  const bobot = toNumber_(input.bobot, 0);
  const tingkat = trim_(input.tingkat);
  const options = Array.isArray(input.options) ? input.options : [];
  const kunci = input.kunci || {};

  if (!pertanyaan) fail_('VALIDATION', 'Pertanyaan wajib diisi.');
  if (QUESTION_TYPES.indexOf(tipe) < 0) fail_('VALIDATION', 'Tipe soal tidak dikenal.');
  if (DIFFICULTIES.indexOf(tingkat) < 0) fail_('VALIDATION', 'Tingkat kesulitan tidak valid.');
  if (!kategori) fail_('VALIDATION', 'Kategori wajib diisi.');
  if (!isFinite(bobot) || bobot <= 0 || bobot > 100) fail_('VALIDATION', 'Bobot harus 1–100.');

  const labels = {};
  options.forEach(function (option) {
    const id = trim_(option && option.id).toUpperCase();
    const teks = trim_(option && option.teks);
    if (!id || !teks) fail_('VALIDATION', 'Setiap opsi harus memiliki kode dan teks.');
    if (labels[id]) fail_('VALIDATION', 'Kode opsi tidak boleh duplikat.');
    labels[id] = true;
  });

  if (tipe === 'pg' || tipe === 'pg_kompleks') {
    if (options.length < 2) fail_('VALIDATION', 'Minimal 2 opsi jawaban.');
    const selected = Array.isArray(kunci.selected) ? kunci.selected : [];
    if (selected.length === 0) fail_('VALIDATION', 'Kunci jawaban wajib dipilih.');
    if (tipe === 'pg' && selected.length !== 1) fail_('VALIDATION', 'PG hanya boleh punya satu kunci.');
    selected.forEach(function (id) {
      if (!labels[String(id).toUpperCase()]) fail_('VALIDATION', 'Kunci ' + id + ' tidak ada pada opsi.');
    });
  }
  if (tipe === 'benar_salah' && typeof kunci.value !== 'boolean') {
    fail_('VALIDATION', 'Kunci benar/salah wajib dipilih.');
  }
  if (tipe === 'isian') {
    const accepted = Array.isArray(kunci.accepted) ? kunci.accepted : [];
    if (accepted.filter(function (item) { return trim_(item); }).length === 0) {
      fail_('VALIDATION', 'Isian singkat butuh minimal satu jawaban diterima.');
    }
  }
}

function sanitizeQuestionInput_(input) {
  const tipe = trim_(input.tipe);
  const options =
    tipe === 'pg' || tipe === 'pg_kompleks'
      ? (Array.isArray(input.options) ? input.options : [])
          .map(function (option) {
            return { id: trim_(option.id).toUpperCase(), teks: trim_(option.teks) };
          })
          .filter(function (option) {
            return option.id && option.teks;
          })
      : [];

  let kunci = input.kunci || {};
  if (tipe === 'pg' || tipe === 'pg_kompleks') {
    kunci = { selected: (kunci.selected || []).map(function (id) { return String(id).toUpperCase(); }) };
  } else if (tipe === 'benar_salah') {
    kunci = { value: kunci.value === true };
  } else if (tipe === 'isian') {
    kunci = {
      accepted: (kunci.accepted || [])
        .map(function (item) { return trim_(item); })
        .filter(Boolean),
    };
  } else {
    kunci = { rubrik: trim_(kunci.rubrik) || undefined };
  }

  return {
    tipe: tipe,
    pertanyaan: trim_(input.pertanyaan),
    gambarUrl: trim_(input.gambarUrl),
    options: options,
    kunci: kunci,
    pembahasan: trim_(input.pembahasan),
    bobot: toNumber_(input.bobot, 1),
    tingkat: trim_(input.tingkat),
    kategori: trim_(input.kategori),
    tags: normalizeTags_(input.tags),
    aktif: input.aktif !== false,
  };
}

function questionsList_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const filters = payload.filters || {};
  const query = trim_(filters.q).toLowerCase();
  const users = usersById_();

  const items = readRows_('Questions')
    .filter(function (row) {
      return toBool_(row.aktif) && (user.role === 'admin' || row.ownerId === user.id);
    })
    .filter(function (row) {
      return filters.kategori ? row.kategori === filters.kategori : true;
    })
    .filter(function (row) {
      return filters.tipe ? row.tipe === filters.tipe : true;
    })
    .filter(function (row) {
      return filters.tingkat ? row.tingkat === filters.tingkat : true;
    })
    .filter(function (row) {
      if (!query) return true;
      return (row.pertanyaan + ' ' + row.kategori + ' ' + (row.tags || '')).toLowerCase().indexOf(query) >= 0;
    })
    .sort(function (a, b) {
      return new Date(toIso_(b.updatedAt)).getTime() - new Date(toIso_(a.updatedAt)).getTime();
    })
    .map(function (row) {
      const owner = users[row.ownerId];
      return questionFromRow_(row, owner ? owner.name : '');
    });

  return paginate_(items, filters.page, filters.pageSize);
}

function ensureOwner_(ownerId, user) {
  if (user.role !== 'admin' && ownerId !== user.id) {
    fail_('FORBIDDEN', 'Anda hanya dapat mengelola data milik sendiri.');
  }
}

function questionsGet_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const row = findById_('Questions', trim_(payload.id));
  if (!row) fail_('NOT_FOUND', 'Soal tidak ditemukan.');
  ensureOwner_(row.ownerId, user);
  return { question: questionFromRow_(row) };
}

function questionsCreate_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const input = payload.input || {};
  validateQuestionInput_(input);
  const clean = sanitizeQuestionInput_(input);

  return withLock_(function () {
    const now = nowIso_();
    const row = {
      id: newId_('QST'),
      ownerId: user.id,
      tipe: clean.tipe,
      pertanyaan: clean.pertanyaan,
      gambarUrl: clean.gambarUrl,
      opsiJson: toJson_(clean.options),
      kunciJson: toJson_(clean.kunci),
      pembahasan: clean.pembahasan,
      bobot: clean.bobot,
      tingkat: clean.tingkat,
      kategori: clean.kategori,
      tags: clean.tags.join(','),
      aktif: clean.aktif,
      createdAt: now,
      updatedAt: now,
    };
    insertRow_('Questions', row);
    logAction_(user, 'question.create', 'question', row.id, { tipe: row.tipe });
    return { question: questionFromRow_(row, user.name) };
  });
}

function questionsUpdate_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const id = trim_(payload.id);
  const input = payload.input || {};
  validateQuestionInput_(input);
  const clean = sanitizeQuestionInput_(input);

  return withLock_(function () {
    const row = findById_('Questions', id);
    if (!row) fail_('NOT_FOUND', 'Soal tidak ditemukan.');
    ensureOwner_(row.ownerId, user);
    updateRow_('Questions', id, {
      tipe: clean.tipe,
      pertanyaan: clean.pertanyaan,
      gambarUrl: clean.gambarUrl,
      opsiJson: toJson_(clean.options),
      kunciJson: toJson_(clean.kunci),
      pembahasan: clean.pembahasan,
      bobot: clean.bobot,
      tingkat: clean.tingkat,
      kategori: clean.kategori,
      tags: clean.tags.join(','),
      aktif: clean.aktif,
      updatedAt: nowIso_(),
    });
    logAction_(user, 'question.update', 'question', id);
    return { question: questionFromRow_(findById_('Questions', id)) };
  });
}

function questionsDelete_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const id = trim_(payload.id);
  return withLock_(function () {
    const row = findById_('Questions', id);
    if (!row) fail_('NOT_FOUND', 'Soal tidak ditemukan.');
    ensureOwner_(row.ownerId, user);
    updateRow_('Questions', id, { aktif: false, updatedAt: nowIso_() });
    logAction_(user, 'question.delete', 'question', id);
    return { ok: true };
  });
}

function questionsBulkCreate_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) fail_('VALIDATION', 'Tidak ada soal untuk diimpor.');
  if (items.length > 50) fail_('VALIDATION', 'Maksimal 50 soal per permintaan.');

  return withLock_(function () {
    const errors = [];
    let created = 0;
    items.forEach(function (input, index) {
      try {
        validateQuestionInput_(input);
        const clean = sanitizeQuestionInput_(input);
        const now = nowIso_();
        insertRow_('Questions', {
          id: newId_('QST'),
          ownerId: user.id,
          tipe: clean.tipe,
          pertanyaan: clean.pertanyaan,
          gambarUrl: clean.gambarUrl,
          opsiJson: toJson_(clean.options),
          kunciJson: toJson_(clean.kunci),
          pembahasan: clean.pembahasan,
          bobot: clean.bobot,
          tingkat: clean.tingkat,
          kategori: clean.kategori,
          tags: clean.tags.join(','),
          aktif: clean.aktif,
          createdAt: now,
          updatedAt: now,
        });
        created += 1;
      } catch (error) {
        errors.push({ index: index, message: error.message || 'Baris tidak valid.' });
      }
    });
    logAction_(user, 'question.import', 'question', '', { created: created, failed: errors.length });
    return { created: created, errors: errors };
  });
}

function questionsMeta_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const rows = readRows_('Questions').filter(function (row) {
    return toBool_(row.aktif) && (user.role === 'admin' || row.ownerId === user.id);
  });
  const kategori = {};
  const tags = {};
  rows.forEach(function (row) {
    if (row.kategori) kategori[row.kategori] = true;
    String(row.tags || '')
      .split(',')
      .forEach(function (tag) {
        if (tag.trim()) tags[tag.trim()] = true;
      });
  });
  return { kategori: Object.keys(kategori).sort(), tags: Object.keys(tags).sort() };
}
