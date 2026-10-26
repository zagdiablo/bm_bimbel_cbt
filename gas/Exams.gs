/** Exam management + the student-safe exam info endpoint. */

function examFromRow_(row, includeToken) {
  return {
    id: row.id,
    ownerId: row.ownerId,
    nama: row.nama,
    mapel: row.mapel,
    deskripsi: row.deskripsi || '',
    durasiMenit: toNumber_(row.durasiMenit, 30),
    mulaiAt: toIso_(row.mulaiAt),
    selesaiAt: toIso_(row.selesaiAt),
    jumlahSoal: toNumber_(row.jumlahSoal, 1),
    acakSoal: toBool_(row.acakSoal),
    acakOpsi: toBool_(row.acakOpsi),
    tampilkanPembahasan: toBool_(row.tampilkanPembahasan),
    tampilkanNilai: toBool_(row.tampilkanNilai),
    token: includeToken ? row.token || undefined : undefined,
    kelasTarget: parseJson_(row.kelasTargetJson, []),
    status: row.status,
    questionCount: 0,
    createdAt: toIso_(row.createdAt),
    updatedAt: toIso_(row.updatedAt),
  };
}

function validateExamInput_(input) {
  if (!input) fail_('VALIDATION', 'Data ujian tidak ditemukan.');
  if (!trim_(input.nama)) fail_('VALIDATION', 'Nama ujian wajib diisi.');
  if (!trim_(input.mapel)) fail_('VALIDATION', 'Mata pelajaran wajib diisi.');
  const durasi = toNumber_(input.durasiMenit, 0);
  if (durasi < 1 || durasi > 480) fail_('VALIDATION', 'Durasi harus 1–480 menit.');
  const jumlah = toNumber_(input.jumlahSoal, 0);
  if (jumlah < 1 || jumlah > 200) fail_('VALIDATION', 'Jumlah soal harus 1–200.');
  const start = new Date(input.mulaiAt).getTime();
  const end = new Date(input.selesaiAt).getTime();
  if (isNaN(start) || isNaN(end)) fail_('VALIDATION', 'Jadwal ujian tidak valid.');
  if (end <= start) fail_('VALIDATION', 'Waktu selesai harus setelah waktu mulai.');
}

function sanitizeExamInput_(input) {
  return {
    nama: trim_(input.nama),
    mapel: trim_(input.mapel),
    deskripsi: trim_(input.deskripsi),
    durasiMenit: Math.round(toNumber_(input.durasiMenit, 30)),
    mulaiAt: new Date(input.mulaiAt).toISOString(),
    selesaiAt: new Date(input.selesaiAt).toISOString(),
    jumlahSoal: Math.round(toNumber_(input.jumlahSoal, 1)),
    acakSoal: input.acakSoal !== false,
    acakOpsi: input.acakOpsi !== false,
    tampilkanPembahasan: input.tampilkanPembahasan === true,
    tampilkanNilai: input.tampilkanNilai !== false,
    token: trim_(input.token),
    kelasTarget: (Array.isArray(input.kelasTarget) ? input.kelasTarget : [])
      .map(function (item) {
        return trim_(item);
      })
      .filter(Boolean),
  };
}

function examQuestionRows_(examId) {
  return readRows_('ExamQuestions').filter(function (row) {
    return row.examId === examId;
  });
}

/** Exam questions joined with the question rows, sorted by urutan. */
function examQuestionsFor_(examId) {
  const questions = readRows_('Questions');
  const byId = {};
  questions.forEach(function (question) {
    byId[question.id] = question;
  });
  return examQuestionRows_(examId)
    .sort(function (a, b) {
      return toNumber_(a.urutan, 0) - toNumber_(b.urutan, 0);
    })
    .map(function (link) {
      return {
        link: link,
        row: byId[link.questionId] || null,
      };
    })
    .filter(function (entry) {
      return entry.row !== null;
    });
}

function questionCountMap_() {
  const map = {};
  readRows_('ExamQuestions').forEach(function (row) {
    map[row.examId] = (map[row.examId] || 0) + 1;
  });
  return map;
}

function loadExamForStaff_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const row = findById_('Exams', trim_(payload.id));
  if (!row) fail_('NOT_FOUND', 'Ujian tidak ditemukan.');
  ensureOwner_(row.ownerId, user);
  return { row: row, user: user };
}

function examsList_(payload) {
  const user = requireUser_(payload);
  const filters = payload.filters || {};
  const query = trim_(filters.q).toLowerCase();
  const now = Date.now();
  const users = usersById_();
  const counts = questionCountMap_();
  const examRows = readRows_('Exams');

  let rows;
  if (user.role === 'siswa') {
    rows = examRows
      .filter(function (row) {
        return row.status === 'published' && new Date(toIso_(row.selesaiAt)).getTime() >= now;
      })
      .filter(function (row) {
        const target = parseJson_(row.kelasTargetJson, []);
        return target.length === 0 || (user.kelas && target.indexOf(user.kelas) >= 0);
      });
  } else {
    rows = examRows.filter(function (row) {
      return user.role === 'admin' || row.ownerId === user.id;
    });
  }

  const submissions = user.role === 'siswa'
    ? readRows_('Submissions').filter(function (sub) {
        return sub.studentId === user.id;
      })
    : [];

  const items = rows
    .filter(function (row) {
      return filters.status ? row.status === filters.status : true;
    })
    .filter(function (row) {
      if (!query) return true;
      return (row.nama + ' ' + row.mapel).toLowerCase().indexOf(query) >= 0;
    })
    .sort(function (a, b) {
      return new Date(toIso_(b.mulaiAt)).getTime() - new Date(toIso_(a.mulaiAt)).getTime();
    })
    .map(function (row) {
      const owned = users[row.ownerId];
      const exam = examFromRow_(row, user.role !== 'siswa');
      exam.ownerName = owned ? owned.name : undefined;
      exam.questionCount = counts[row.id] || 0;
      if (user.role === 'siswa') {
        const mine = submissions
          .filter(function (sub) {
            return sub.examId === row.id;
          })
          .sort(function (a, b) {
            return new Date(toIso_(b.mulaiAt)).getTime() - new Date(toIso_(a.mulaiAt)).getTime();
          })[0];
        exam.attemptStatus = mine ? mine.status : null;
        exam.submissionId = mine ? mine.id : null;
        exam.requiresToken = Boolean(row.token);
        delete exam.token;
      }
      return exam;
    });

  return paginate_(items, filters.page, filters.pageSize);
}

function examsGet_(payload) {
  const loaded = loadExamForStaff_(payload);
  const users = usersById_();
  const exam = examFromRow_(loaded.row, true);
  const owner = users[loaded.row.ownerId];
  exam.ownerName = owner ? owner.name : undefined;
  const links = examQuestionsFor_(loaded.row.id);
  exam.questionCount = links.length;
  const questions = links.map(function (entry) {
    return questionFromRow_(entry.row, owner ? owner.name : '');
  });
  return { exam: exam, questions: questions };
}

function examsCreate_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const input = payload.input || {};
  validateExamInput_(input);
  const clean = sanitizeExamInput_(input);

  return withLock_(function () {
    const now = nowIso_();
    const row = {
      id: newId_('EXM'),
      ownerId: user.id,
      nama: clean.nama,
      mapel: clean.mapel,
      deskripsi: clean.deskripsi,
      durasiMenit: clean.durasiMenit,
      mulaiAt: clean.mulaiAt,
      selesaiAt: clean.selesaiAt,
      jumlahSoal: clean.jumlahSoal,
      acakSoal: clean.acakSoal,
      acakOpsi: clean.acakOpsi,
      tampilkanPembahasan: clean.tampilkanPembahasan,
      tampilkanNilai: clean.tampilkanNilai,
      token: clean.token,
      kelasTargetJson: toJson_(clean.kelasTarget),
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    insertRow_('Exams', row);
    logAction_(user, 'exam.create', 'exam', row.id, { nama: row.nama });
    const exam = examFromRow_(row, true);
    exam.ownerName = user.name;
    return { exam: exam };
  });
}

function examsUpdate_(payload) {
  const loaded = loadExamForStaff_(payload);
  const input = payload.input || {};
  validateExamInput_(input);
  const clean = sanitizeExamInput_(input);

  return withLock_(function () {
    updateRow_('Exams', loaded.row.id, {
      nama: clean.nama,
      mapel: clean.mapel,
      deskripsi: clean.deskripsi,
      durasiMenit: clean.durasiMenit,
      mulaiAt: clean.mulaiAt,
      selesaiAt: clean.selesaiAt,
      jumlahSoal: clean.jumlahSoal,
      acakSoal: clean.acakSoal,
      acakOpsi: clean.acakOpsi,
      tampilkanPembahasan: clean.tampilkanPembahasan,
      tampilkanNilai: clean.tampilkanNilai,
      token: clean.token,
      kelasTargetJson: toJson_(clean.kelasTarget),
      updatedAt: nowIso_(),
    });
    logAction_(loaded.user, 'exam.update', 'exam', loaded.row.id);
    const updated = examFromRow_(findById_('Exams', loaded.row.id), true);
    updated.questionCount = examQuestionRows_(loaded.row.id).length;
    return { exam: updated };
  });
}

function examsDelete_(payload) {
  const loaded = loadExamForStaff_(payload);
  return withLock_(function () {
    const hasSubmissions = readRows_('Submissions').some(function (sub) {
      return sub.examId === loaded.row.id;
    });
    if (hasSubmissions) {
      fail_('CONFLICT', 'Ujian sudah memiliki peserta. Tutup saja alih-alih menghapus.');
    }
    readRows_('ExamQuestions')
      .filter(function (row) {
        return row.examId === loaded.row.id;
      })
      .forEach(function (row) {
        deleteRowById_('ExamQuestions', row.id);
      });
    deleteRowById_('Exams', loaded.row.id);
    logAction_(loaded.user, 'exam.delete', 'exam', loaded.row.id);
    return { ok: true };
  });
}

function examsSetQuestions_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const examId = trim_(payload.examId);
  const ids = (Array.isArray(payload.questionIds) ? payload.questionIds : []).filter(function (id, index, all) {
    return id && all.indexOf(id) === index;
  });
  if (ids.length === 0) fail_('VALIDATION', 'Pilih minimal satu soal.');

  return withLock_(function () {
    const exam = findById_('Exams', examId);
    if (!exam) fail_('NOT_FOUND', 'Ujian tidak ditemukan.');
    ensureOwner_(exam.ownerId, user);
    const questionMap = {};
    readRows_('Questions').forEach(function (row) {
      questionMap[row.id] = row;
    });
    ids.forEach(function (id) {
      const question = questionMap[id];
      if (!question || !toBool_(question.aktif)) fail_('VALIDATION', 'Soal ' + id + ' tidak ditemukan.');
      if (user.role !== 'admin' && question.ownerId !== user.id) {
        fail_('FORBIDDEN', 'Terdapat soal milik guru lain dalam pilihan Anda.');
      }
    });

    readRows_('ExamQuestions')
      .filter(function (row) {
        return row.examId === examId;
      })
      .forEach(function (row) {
        deleteRowById_('ExamQuestions', row.id);
      });

    ids.forEach(function (questionId, index) {
      insertRow_('ExamQuestions', {
        id: newId_('EXQ'),
        examId: examId,
        questionId: questionId,
        urutan: index + 1,
        bobot: toNumber_(questionMap[questionId].bobot, 1),
      });
    });

    updateRow_('Exams', examId, {
      jumlahSoal: Math.min(toNumber_(exam.jumlahSoal, ids.length), ids.length),
      updatedAt: nowIso_(),
    });
    logAction_(user, 'exam.set_questions', 'exam', examId, { count: ids.length });
    return { count: ids.length };
  });
}

function examsPublish_(payload) {
  const loaded = loadExamForStaff_(payload);
  return withLock_(function () {
    const count = examQuestionRows_(loaded.row.id).length;
    if (count === 0) fail_('VALIDATION', 'Tambahkan soal sebelum menerbitkan ujian.');
    updateRow_('Exams', loaded.row.id, { status: 'published', updatedAt: nowIso_() });
    logAction_(loaded.user, 'exam.publish', 'exam', loaded.row.id);
    const exam = examFromRow_(findById_('Exams', loaded.row.id), true);
    exam.questionCount = count;
    return { exam: exam };
  });
}

function examsClose_(payload) {
  const loaded = loadExamForStaff_(payload);
  return withLock_(function () {
    updateRow_('Exams', loaded.row.id, { status: 'closed', updatedAt: nowIso_() });
    logAction_(loaded.user, 'exam.close', 'exam', loaded.row.id);
    const exam = examFromRow_(findById_('Exams', loaded.row.id), true);
    exam.questionCount = examQuestionRows_(loaded.row.id).length;
    return { exam: exam };
  });
}

function examsAssign_(payload) {
  const loaded = loadExamForStaff_(payload);
  const kelas = (Array.isArray(payload.kelas) ? payload.kelas : [])
    .map(function (item) {
      return trim_(item);
    })
    .filter(Boolean);
  return withLock_(function () {
    updateRow_('Exams', loaded.row.id, {
      kelasTargetJson: toJson_(kelas),
      updatedAt: nowIso_(),
    });
    logAction_(loaded.user, 'exam.assign', 'exam', loaded.row.id, { kelas: kelas });
    const exam = examFromRow_(findById_('Exams', loaded.row.id), true);
    exam.questionCount = examQuestionRows_(loaded.row.id).length;
    return { exam: exam };
  });
}

/** Student-safe metadata for the pre-exam instructions screen. */
function examsInfo_(payload) {
  const user = requireUser_(payload, ['siswa']);
  const row = findById_('Exams', trim_(payload.id));
  if (!row) fail_('NOT_FOUND', 'Ujian tidak ditemukan.');
  if (row.status !== 'published') fail_('FORBIDDEN', 'Ujian belum dibuka atau sudah ditutup.');
  const target = parseJson_(row.kelasTargetJson, []);
  if (target.length > 0 && (!user.kelas || target.indexOf(user.kelas) < 0)) {
    fail_('FORBIDDEN', 'Ujian ini tidak ditujukan untuk kelas Anda.');
  }
  const mine = readRows_('Submissions')
    .filter(function (sub) {
      return sub.examId === row.id && sub.studentId === user.id;
    })
    .sort(function (a, b) {
      return new Date(toIso_(b.mulaiAt)).getTime() - new Date(toIso_(a.mulaiAt)).getTime();
    })[0];

  const exam = examFromRow_(row, false);
  exam.questionCount = examQuestionRows_(row.id).length;
  exam.attemptStatus = mine ? mine.status : null;
  exam.submissionId = mine ? mine.id : null;
  exam.requiresToken = Boolean(row.token);
  delete exam.token;
  return { exam: exam };
}
