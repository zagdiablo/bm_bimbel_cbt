/** Exam attempts: start/resume, autosave + heartbeat, anti-cheat events, submit. */

var GRACE_MS = 10000;

function publicSubmissionRow_(row, users, exams) {
  const user = users ? users[row.studentId] : findById_('Users', row.studentId);
  const exam = exams ? exams[row.examId] : findById_('Exams', row.examId);
  return {
    id: row.id,
    examId: row.examId,
    examName: exam ? exam.nama : 'Ujian',
    studentId: row.studentId,
    studentName: user ? user.name : 'Siswa',
    studentNis: user ? user.nis || '' : '',
    kelas: user ? user.kelas || '' : '',
    mulaiAt: toIso_(row.mulaiAt),
    expiresAt: toIso_(row.expiresAt),
    submitAt: row.submitAt ? toIso_(row.submitAt) : undefined,
    status: row.status,
    skor: toNumber_(row.skor, 0),
    skorMaks: toNumber_(row.skorMaks, 100),
    benar: toNumber_(row.benar, 0),
    salah: toNumber_(row.salah, 0),
    kosong: toNumber_(row.kosong, 0),
    perluManual: toNumber_(row.perluManual, 0),
    tabSwitchCount: toNumber_(row.tabSwitchCount, 0),
    autoSubmitted: toBool_(row.autoSubmitted),
    lastSeenAt: toIso_(row.lastSeenAt),
    durationSec: row.durationSec === '' ? undefined : toNumber_(row.durationSec, 0),
  };
}

function answerFromRow_(row) {
  return {
    id: row.id,
    submissionId: row.submissionId,
    examId: row.examId,
    userId: row.userId,
    questionId: row.questionId,
    value: parseJson_(row.jawabanJson, null),
    ragu: toBool_(row.ragu),
    benar: row.benar === '' || row.benar === null || row.benar === undefined ? null : toBool_(row.benar),
    skor: row.skor === '' || row.skor === null || row.skor === undefined ? null : toNumber_(row.skor, 0),
    dinilaiOleh: row.dinilaiOleh || undefined,
    dinilaiAt: row.dinilaiAt ? toIso_(row.dinilaiAt) : undefined,
    updatedAt: toIso_(row.updatedAt),
  };
}

function loadSubmission_(id) {
  const row = findById_('Submissions', id);
  if (!row) fail_('NOT_FOUND', 'Sesi ujian tidak ditemukan.');
  return row;
}

function loadStudentSubmission_(payload) {
  const user = requireUser_(payload, ['siswa']);
  const row = loadSubmission_(trim_(payload.submissionId));
  if (row.studentId !== user.id) fail_('FORBIDDEN', 'Ini bukan sesi ujian Anda.');
  return { user: user, row: row };
}

function hasAnswerValue_(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value.selected)) return value.selected.length > 0;
  if (typeof value.value === 'boolean') return true;
  if (typeof value.text === 'string') return value.text.trim().length > 0;
  return false;
}

function sanitizeAnswerForQuestion_(questionRow, value) {
  if (!value || typeof value !== 'object') return null;
  const tipe = questionRow.tipe;
  if (tipe === 'pg' || tipe === 'pg_kompleks') {
    const options = parseJson_(questionRow.opsiJson, []);
    const allowed = {};
    options.forEach(function (option) {
      allowed[String(option.id)] = true;
    });
    const selected = (Array.isArray(value.selected) ? value.selected : [])
      .map(function (id) {
        return String(id);
      })
      .filter(function (id) {
        return allowed[id];
      });
    if (selected.length === 0) return null;
    if (tipe === 'pg') return { selected: [selected[0]] };
    return { selected: selected };
  }
  if (tipe === 'benar_salah') {
    return typeof value.value === 'boolean' ? { value: value.value } : null;
  }
  if (tipe === 'isian') {
    const text = trim_(value.text).slice(0, 500);
    return text ? { text: text } : null;
  }
  const essay = String(value.text === undefined || value.text === null ? '' : value.text).slice(0, 10000);
  return essay.trim() ? { text: essay } : null;
}

function buildAttemptPayload_(submissionRow) {
  const examRow = findById_('Exams', submissionRow.examId);
  if (!examRow) fail_('NOT_FOUND', 'Ujian tidak ditemukan.');
  const order = parseJson_(submissionRow.questionOrderJson, []);
  const questions = readRows_('Questions');
  const byId = {};
  questions.forEach(function (row) {
    byId[row.id] = row;
  });
  const bobotMap = {};
  readRows_('ExamQuestions')
    .filter(function (row) {
      return row.examId === examRow.id;
    })
    .forEach(function (row) {
      bobotMap[row.questionId] = toNumber_(row.bobot, 1);
    });

  const attemptQuestions = [];
  order.forEach(function (questionId, index) {
    const row = byId[questionId];
    if (!row) return;
    attemptQuestions.push({
      id: row.id,
      tipe: row.tipe,
      pertanyaan: row.pertanyaan,
      gambarUrl: row.gambarUrl || undefined,
      options: parseJson_(row.opsiJson, []),
      bobot: bobotMap[row.id] || toNumber_(row.bobot, 1),
      urutan: index + 1,
    });
  });

  const answers = readRows_('Answers')
    .filter(function (row) {
      return row.submissionId === submissionRow.id;
    })
    .map(answerFromRow_);

  return {
    submission: publicSubmissionRow_(submissionRow),
    exam: {
      id: examRow.id,
      nama: examRow.nama,
      mapel: examRow.mapel,
      durasiMenit: toNumber_(examRow.durasiMenit, 30),
      acakOpsi: toBool_(examRow.acakOpsi),
      tampilkanPembahasan: toBool_(examRow.tampilkanPembahasan),
      tampilkanNilai: toBool_(examRow.tampilkanNilai),
    },
    questions: attemptQuestions,
    answers: answers,
    remainingSec: Math.max(
      0,
      Math.floor((new Date(toIso_(submissionRow.expiresAt)).getTime() - Date.now()) / 1000),
    ),
    serverTime: nowIso_(),
  };
}

function shuffle_(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

function attemptsStart_(payload, requestMeta) {
  const user = requireUser_(payload, ['siswa']);
  const examId = trim_(payload.examId);
  rateLimit_('start:' + user.id, 10, 60);

  return withLock_(function () {
    const exam = findById_('Exams', examId);
    if (!exam) fail_('NOT_FOUND', 'Ujian tidak ditemukan.');
    const now = Date.now();
    if (exam.status !== 'published') fail_('FORBIDDEN', 'Ujian belum dibuka atau sudah ditutup.');
    if (new Date(toIso_(exam.mulaiAt)).getTime() > now) fail_('EXAM_NOT_STARTED', 'Ujian belum dimulai.');
    if (new Date(toIso_(exam.selesaiAt)).getTime() < now) fail_('EXAM_ENDED', 'Waktu ujian sudah berakhir.');

    const target = parseJson_(exam.kelasTargetJson, []);
    if (target.length > 0 && (!user.kelas || target.indexOf(user.kelas) < 0)) {
      fail_('FORBIDDEN', 'Ujian ini tidak ditujukan untuk kelas Anda.');
    }
    if (exam.token && String(exam.token).toLowerCase() !== trim_(payload.examToken).toLowerCase()) {
      fail_('INVALID_TOKEN', 'Token ujian salah.');
    }

    const existing = readRows_('Submissions').filter(function (row) {
      return row.examId === examId && row.studentId === user.id;
    })[0];

    if (existing) {
      if (existing.status === 'in_progress') {
        if (new Date(toIso_(existing.expiresAt)).getTime() > now) {
          return buildAttemptPayload_(existing);
        }
        finalizeSubmission_(existing, true);
        fail_('ALREADY_SUBMITTED', 'Waktu ujian Anda sudah habis.', { submissionId: existing.id });
      }
      fail_('ALREADY_SUBMITTED', 'Anda sudah menyelesaikan ujian ini.', {
        submissionId: existing.id,
      });
    }

    const pool = examQuestionsFor_(examId);
    if (pool.length === 0) fail_('NO_QUESTIONS', 'Ujian belum memiliki soal.');

    let order = pool.map(function (entry) {
      return entry.row.id;
    });
    if (toBool_(exam.acakSoal)) order = shuffle_(order);
    const limit = Math.max(1, Math.min(toNumber_(exam.jumlahSoal, order.length), order.length));
    order = order.slice(0, limit);

    const expiresAt = new Date(
      Math.min(now + toNumber_(exam.durasiMenit, 30) * 60000, new Date(toIso_(exam.selesaiAt)).getTime()),
    ).toISOString();

    const submission = {
      id: newId_('SUB'),
      examId: examId,
      studentId: user.id,
      mulaiAt: new Date(now).toISOString(),
      expiresAt: expiresAt,
      submitAt: '',
      status: 'in_progress',
      skor: 0,
      skorMaks: 100,
      benar: 0,
      salah: 0,
      kosong: 0,
      perluManual: 0,
      tabSwitchCount: 0,
      autoSubmitted: false,
      lastSeenAt: new Date(now).toISOString(),
      questionOrderJson: toJson_(order),
      durationSec: '',
      userAgent: requestMeta && requestMeta.userAgent ? String(requestMeta.userAgent).slice(0, 300) : '',
    };
    insertRow_('Submissions', submission);
    logAction_(user, 'exam.start', 'submission', submission.id, { examId: examId });
    return buildAttemptPayload_(submission);
  });
}

function attemptsGet_(payload) {
  const loaded = loadStudentSubmission_(payload);
  return withLock_(function () {
    let row = loadSubmission_(loaded.row.id);
    if (
      row.status === 'in_progress' &&
      Date.now() > new Date(toIso_(row.expiresAt)).getTime() + GRACE_MS
    ) {
      finalizeSubmission_(row, true);
      row = loadSubmission_(row.id);
    }
    return buildAttemptPayload_(row);
  });
}

function attemptsSave_(payload) {
  const loaded = loadStudentSubmission_(payload);
  const submissionId = loaded.row.id;
  rateLimit_('save:' + submissionId, 120, 60);

  return withLock_(function () {
    let submission = loadSubmission_(submissionId);
    if (submission.status !== 'in_progress') {
      return {
        saved: [],
        remainingSec: 0,
        serverTime: nowIso_(),
        status: submission.status,
        tabSwitchCount: toNumber_(submission.tabSwitchCount, 0),
      };
    }

    const remaining = Math.max(
      0,
      Math.floor((new Date(toIso_(submission.expiresAt)).getTime() - Date.now()) / 1000),
    );
    if (remaining === 0 && Date.now() > new Date(toIso_(submission.expiresAt)).getTime() + GRACE_MS) {
      finalizeSubmission_(submission, true);
      submission = loadSubmission_(submissionId);
      return {
        saved: [],
        remainingSec: 0,
        serverTime: nowIso_(),
        status: submission.status,
        tabSwitchCount: toNumber_(submission.tabSwitchCount, 0),
      };
    }

    const incoming = Array.isArray(payload.answers) ? payload.answers : [];
    if (incoming.length > 100) fail_('VALIDATION', 'Terlalu banyak jawaban dalam satu permintaan.');

    const order = parseJson_(submission.questionOrderJson, []);
    const questions = readRows_('Questions');
    const byId = {};
    questions.forEach(function (row) {
      byId[row.id] = row;
    });
    const existingAnswers = readRows_('Answers');
    const saved = [];

    incoming.forEach(function (item) {
      const questionId = trim_(item.questionId);
      if (order.indexOf(questionId) < 0) return;
      const question = byId[questionId];
      if (!question) return;
      const value = sanitizeAnswerForQuestion_(question, item.value);
      const answer = existingAnswers.filter(function (row) {
        return row.submissionId === submissionId && row.questionId === questionId;
      })[0];

      if (!answer) {
        insertRow_('Answers', {
          id: newId_('ANS'),
          examId: submission.examId,
          userId: loaded.user.id,
          submissionId: submissionId,
          questionId: questionId,
          jawabanJson: toJson_(value),
          ragu: item.ragu === true,
          benar: '',
          skor: '',
          dinilaiOleh: '',
          dinilaiAt: '',
          updatedAt: nowIso_(),
        });
      } else {
        updateRow_('Answers', answer.id, {
          jawabanJson: toJson_(value),
          ragu: item.ragu === true,
          updatedAt: nowIso_(),
        });
        answer.jawabanJson = toJson_(value);
      }
      saved.push(questionId);
    });

    updateRow_('Submissions', submissionId, { lastSeenAt: nowIso_() });

    const remainingAfter = Math.max(
      0,
      Math.floor((new Date(toIso_(submission.expiresAt)).getTime() - Date.now()) / 1000),
    );
    let status = submission.status;
    if (remainingAfter === 0 && Date.now() > new Date(toIso_(submission.expiresAt)).getTime() + GRACE_MS) {
      finalizeSubmission_(submission, true);
      status = loadSubmission_(submissionId).status;
    }

    return {
      saved: saved,
      remainingSec: remainingAfter,
      serverTime: nowIso_(),
      status: status,
      tabSwitchCount: toNumber_(submission.tabSwitchCount, 0),
    };
  });
}

function attemptsLogEvent_(payload) {
  const loaded = loadStudentSubmission_(payload);
  const event = trim_(payload.event);
  rateLimit_('event:' + loaded.row.id, 60, 60);

  const allowed = ['tab_switch', 'blur', 'copy', 'paste', 'contextmenu', 'fullscreen_exit'];
  if (allowed.indexOf(event) < 0) fail_('VALIDATION', 'Jenis event tidak dikenal.');

  return withLock_(function () {
    const row = loadSubmission_(loaded.row.id);
    let count = toNumber_(row.tabSwitchCount, 0);
    if (event === 'tab_switch') {
      count += 1;
      updateRow_('Submissions', row.id, {
        tabSwitchCount: count,
        lastSeenAt: nowIso_(),
      });
    }
    logAction_(loaded.user, 'exam.event', 'submission', row.id, { event: event, total: count });
    return { tabSwitchCount: count };
  });
}

function attemptsSubmit_(payload) {
  const loaded = loadStudentSubmission_(payload);
  rateLimit_('submit:' + loaded.row.id, 3, 60);

  return withLock_(function () {
    let submission = loadSubmission_(loaded.row.id);
    if (submission.status === 'in_progress') {
      const expired = Date.now() > new Date(toIso_(submission.expiresAt)).getTime();
      finalizeSubmission_(submission, expired);
      submission = loadSubmission_(submission.id);
    }
    return { submission: publicSubmissionRow_(submission) };
  });
}
