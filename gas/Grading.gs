/** Auto-grading, essay grading, results, statistics, exports. */

function bobotMapFor_(examId) {
  const map = {};
  readRows_('ExamQuestions')
    .filter(function (row) {
      return row.examId === examId;
    })
    .forEach(function (row) {
      map[row.questionId] = toNumber_(row.bobot, 1);
    });
  return map;
}

function normalizeAnswerText_(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'"()[\]{}]/g, '')
    .trim();
}

function isAnswerCorrect_(questionRow, value) {
  const key = parseJson_(questionRow.kunciJson, {});
  if (!value) return false;
  if (questionRow.tipe === 'pg' || questionRow.tipe === 'pg_kompleks') {
    const answer = (value.selected || []).slice().sort().join('|');
    const expected = (key.selected || []).slice().sort().join('|');
    return answer.length > 0 && answer === expected;
  }
  if (questionRow.tipe === 'benar_salah') {
    return typeof value.value === 'boolean' && value.value === key.value;
  }
  if (questionRow.tipe === 'isian') {
    const answer = normalizeAnswerText_(value.text);
    if (!answer) return false;
    return (key.accepted || []).some(function (item) {
      return normalizeAnswerText_(item) === answer;
    });
  }
  return false;
}

/** Recompute totals from the Answers sheet (used after essay grading). */
function recomputeSubmission_(submission) {
  const order = parseJson_(submission.questionOrderJson, []);
  const bobotMap = bobotMapFor_(submission.examId);
  const questions = readRows_('Questions');
  const byId = {};
  questions.forEach(function (row) {
    byId[row.id] = row;
  });
  const answers = readRows_('Answers').filter(function (row) {
    return row.submissionId === submission.id;
  });

  let total = 0;
  let earned = 0;
  let benar = 0;
  let salah = 0;
  let kosong = 0;
  let manual = 0;

  order.forEach(function (questionId) {
    const question = byId[questionId];
    if (!question) return;
    total += bobotMap[questionId] || toNumber_(question.bobot, 1);
    const answer = answers.filter(function (row) {
      return row.questionId === questionId;
    })[0];
    const value = answer ? parseJson_(answer.jawabanJson, null) : null;
    if (!answer || !hasAnswerValue_(value)) {
      kosong += 1;
      return;
    }
    if (question.tipe === 'essay') {
      if (answer.skor === '' || answer.skor === null || answer.skor === undefined) {
        manual += 1;
      } else {
        earned += toNumber_(answer.skor, 0);
      }
      return;
    }
    if (toBool_(answer.benar)) benar += 1;
    else salah += 1;
    earned += toNumber_(answer.skor, 0);
  });

  const skor = total > 0 ? Math.round((earned / total) * 10000) / 100 : 0;
  const status = manual > 0 ? 'needs_grading' : 'graded';
  updateRow_('Submissions', submission.id, {
    skor: skor,
    skorMaks: 100,
    benar: benar,
    salah: salah,
    kosong: kosong,
    perluManual: manual,
    status: status,
  });
  return { skor: skor, benar: benar, salah: salah, kosong: kosong, manual: manual, status: status };
}

/** Grade every answer and finalize the attempt. */
function finalizeSubmission_(submission, timeout) {
  if (submission.status !== 'in_progress') return;
  const order = parseJson_(submission.questionOrderJson, []);
  const bobotMap = bobotMapFor_(submission.examId);
  const questions = readRows_('Questions');
  const byId = {};
  questions.forEach(function (row) {
    byId[row.id] = row;
  });
  const answers = readRows_('Answers').filter(function (row) {
    return row.submissionId === submission.id;
  });

  order.forEach(function (questionId) {
    const question = byId[questionId];
    if (!question) return;
    const answer = answers.filter(function (row) {
      return row.questionId === questionId;
    })[0];
    if (!answer) return;
    const value = parseJson_(answer.jawabanJson, null);
    if (!hasAnswerValue_(value)) return;
    const bobot = bobotMap[questionId] || toNumber_(question.bobot, 1);
    if (question.tipe === 'essay') {
      updateRow_('Answers', answer.id, { benar: '', skor: '', updatedAt: nowIso_() });
      return;
    }
    const correct = isAnswerCorrect_(question, value);
    updateRow_('Answers', answer.id, {
      benar: correct,
      skor: correct ? bobot : 0,
      updatedAt: nowIso_(),
    });
  });

  const submitAt = nowIso_();
  const durationSec = Math.max(
    0,
    Math.round((new Date(submitAt).getTime() - new Date(toIso_(submission.mulaiAt)).getTime()) / 1000),
  );
  updateRow_('Submissions', submission.id, {
    submitAt: submitAt,
    autoSubmitted: timeout === true,
    lastSeenAt: submitAt,
    durationSec: durationSec,
  });
  const refreshed = findById_('Submissions', submission.id);
  const result = recomputeSubmission_(refreshed);
  logAction_(null, timeout ? 'exam.auto_submit' : 'exam.submit', 'submission', submission.id, {
    skor: result.skor,
  });
}

function buildResult_(submission, withKey) {
  const exam = findById_('Exams', submission.examId);
  if (!exam) fail_('NOT_FOUND', 'Ujian tidak ditemukan.');
  const users = usersById_();
  const bobotMap = bobotMapFor_(exam.id);
  const questions = readRows_('Questions');
  const byId = {};
  questions.forEach(function (row) {
    byId[row.id] = row;
  });
  const answers = readRows_('Answers').filter(function (row) {
    return row.submissionId === submission.id;
  });
  const order = parseJson_(submission.questionOrderJson, []);

  const rows = [];
  order.forEach(function (questionId, index) {
    const row = byId[questionId];
    if (!row) return;
    const answer = answers.filter(function (item) {
      return item.questionId === questionId;
    })[0];
    const question = questionFromRow_(row);
    if (!withKey) {
      delete question.kunci;
      delete question.pembahasan;
    }
    const bobot = bobotMap[questionId] || toNumber_(row.bobot, 1);
    rows.push({
      nomor: index + 1,
      question: question,
      answer: answer ? answerFromRow_(answer) : null,
      bobot: bobot,
      skorMaks: bobot,
    });
  });

  const examObject = examFromRow_(exam, true);
  examObject.questionCount = order.length;
  return {
    submission: publicSubmissionRow_(submission, users, null),
    exam: examObject,
    rows: rows,
    canSeeKey: withKey,
    school: schoolSettings_(),
  };
}

/* ------------------------------------------------------------ submissions */

function submissionsList_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const filters = payload.filters || {};
  const users = usersById_();
  const exams = examsById_();
  const myExamIds = {};
  Object.keys(exams).forEach(function (id) {
    if (user.role === 'admin' || exams[id].ownerId === user.id) myExamIds[id] = true;
  });

  const items = readRows_('Submissions')
    .filter(function (row) {
      return myExamIds[row.examId];
    })
    .filter(function (row) {
      return filters.examId ? row.examId === filters.examId : true;
    })
    .filter(function (row) {
      if (filters.status) return row.status === filters.status;
      return row.status !== 'in_progress';
    })
    .sort(function (a, b) {
      const left = new Date(toIso_(a.submitAt || a.mulaiAt)).getTime();
      const right = new Date(toIso_(b.submitAt || b.mulaiAt)).getTime();
      return right - left;
    })
    .map(function (row) {
      return publicSubmissionRow_(row, users, exams);
    });

  return paginate_(items, filters.page, filters.pageSize);
}

function loadSubmissionForStaff_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const submission = findById_('Submissions', trim_(payload.submissionId));
  if (!submission) fail_('NOT_FOUND', 'Data pengerjaan tidak ditemukan.');
  const exam = findById_('Exams', submission.examId);
  if (!exam) fail_('NOT_FOUND', 'Ujian tidak ditemukan.');
  ensureOwner_(exam.ownerId, user);
  return { user: user, submission: submission, exam: exam };
}

function submissionsGet_(payload) {
  const loaded = loadSubmissionForStaff_(payload);
  return buildResult_(loaded.submission, true);
}

function submissionsGradeEssay_(payload) {
  const loaded = loadSubmissionForStaff_(payload);
  if (loaded.submission.status === 'in_progress') {
    fail_('VALIDATION', 'Pengerjaan ini belum dikumpulkan.');
  }

  return withLock_(function () {
    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length === 0) fail_('VALIDATION', 'Tidak ada nilai yang dikirim.');

    const bobotMap = bobotMapFor_(loaded.exam.id);
    items.forEach(function (item) {
      const answer = findById_('Answers', trim_(item.answerId));
      if (!answer || answer.submissionId !== loaded.submission.id) {
        fail_('NOT_FOUND', 'Jawaban tidak ditemukan.');
      }
      const question = findById_('Questions', answer.questionId);
      if (!question || question.tipe !== 'essay') {
        fail_('VALIDATION', 'Hanya jawaban essay yang dapat dinilai manual.');
      }
      const bobot = bobotMap[question.id] || toNumber_(question.bobot, 1);
      const skor = Math.max(0, Math.min(bobot, Math.round(toNumber_(item.skor, 0) * 100) / 100));
      updateRow_('Answers', answer.id, {
        skor: skor,
        benar: skor >= bobot,
        dinilaiOleh: loaded.user.id,
        dinilaiAt: nowIso_(),
        updatedAt: nowIso_(),
      });
    });

    const refreshed = findById_('Submissions', loaded.submission.id);
    const result = recomputeSubmission_(refreshed);
    const updated = findById_('Submissions', loaded.submission.id);
    logAction_(loaded.user, 'submission.grade_essay', 'submission', loaded.submission.id, {
      skor: result.skor,
    });
    return { submission: publicSubmissionRow_(updated) };
  });
}

function submissionsForceSubmit_(payload) {
  const loaded = loadSubmissionForStaff_(payload);
  return withLock_(function () {
    let submission = findById_('Submissions', loaded.submission.id);
    if (submission.status === 'in_progress') {
      finalizeSubmission_(submission, false);
      submission = findById_('Submissions', submission.id);
      logAction_(loaded.user, 'submission.force_submit', 'submission', submission.id);
    }
    return { submission: publicSubmissionRow_(submission) };
  });
}

/* ---------------------------------------------------------------- results */

function resultsMine_(payload) {
  const user = requireUser_(payload, ['siswa']);
  const exams = examsById_();
  const items = readRows_('Submissions')
    .filter(function (row) {
      return row.studentId === user.id && row.status !== 'in_progress';
    })
    .sort(function (a, b) {
      return new Date(toIso_(b.submitAt || b.mulaiAt)).getTime() - new Date(toIso_(a.submitAt || a.mulaiAt)).getTime();
    })
    .map(function (row) {
      return publicSubmissionRow_(row, null, exams);
    });
  return { items: items };
}

function resultsDetail_(payload) {
  const user = requireUser_(payload);
  const submission = findById_('Submissions', trim_(payload.submissionId));
  if (!submission) fail_('NOT_FOUND', 'Data pengerjaan tidak ditemukan.');
  if (user.role === 'siswa' && submission.studentId !== user.id) {
    fail_('FORBIDDEN', 'Ini bukan hasil ujian Anda.');
  }
  const exam = findById_('Exams', submission.examId);
  if (!exam) fail_('NOT_FOUND', 'Ujian tidak ditemukan.');
  if (user.role !== 'siswa') ensureOwner_(exam.ownerId, user);
  if (user.role === 'siswa' && !toBool_(exam.tampilkanNilai) && exam.status !== 'closed') {
    fail_('RESULT_HIDDEN', 'Nilai belum dibuka oleh guru.');
  }
  const withKey = user.role !== 'siswa' || toBool_(exam.tampilkanPembahasan);
  const detail = buildResult_(submission, withKey);
  // Students should never receive the exam token, even in result payloads.
  if (user.role === 'siswa') delete detail.exam.token;
  return detail;
}

function resultsList_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const examId = trim_(payload.examId);
  const exam = findById_('Exams', examId);
  if (!exam) fail_('NOT_FOUND', 'Ujian tidak ditemukan.');
  ensureOwner_(exam.ownerId, user);
  const users = usersById_();
  const items = readRows_('Submissions')
    .filter(function (row) {
      return row.examId === examId && row.status !== 'in_progress';
    })
    .sort(function (a, b) {
      return toNumber_(b.skor, 0) - toNumber_(a.skor, 0);
    })
    .map(function (row) {
      return publicSubmissionRow_(row, users, null);
    });
  return { items: items };
}

function formatDuration_(seconds) {
  if (seconds === null || seconds === undefined || seconds === '') return '-';
  const value = toNumber_(seconds, 0);
  if (value < 60) return Math.round(value) + ' dtk';
  const minutes = Math.round(value / 60);
  if (minutes < 60) return minutes + ' mnt';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? hours + ' jam' : hours + ' jam ' + rest + ' mnt';
}

function computeStats_(examId) {
  const exam = findById_('Exams', examId);
  if (!exam) fail_('NOT_FOUND', 'Ujian tidak ditemukan.');
  const submissions = readRows_('Submissions').filter(function (row) {
    return row.examId === examId && row.status !== 'in_progress';
  });
  const scores = submissions.map(function (row) {
    return toNumber_(row.skor, 0);
  });
  const count = scores.length;
  const avg = count > 0 ? Math.round((scores.reduce(function (a, b) { return a + b; }, 0) / count) * 100) / 100 : 0;
  const min = count > 0 ? Math.min.apply(null, scores) : 0;
  const max = count > 0 ? Math.max.apply(null, scores) : 0;
  const passed = scores.filter(function (score) {
    return score >= CONFIG.KKM;
  }).length;

  const buckets = [
    { label: '<60', min: 0, max: 59.999 },
    { label: '60-69', min: 60, max: 69.999 },
    { label: '70-79', min: 70, max: 79.999 },
    { label: '80-89', min: 80, max: 89.999 },
    { label: '90-100', min: 90, max: 100 },
  ];
  const distribution = buckets.map(function (bucket) {
    return {
      label: bucket.label,
      value: scores.filter(function (score) {
        return score >= bucket.min && score <= bucket.max;
      }).length,
    };
  });

  const submissionIds = {};
  submissions.forEach(function (row) {
    submissionIds[row.id] = true;
  });
  const answers = readRows_('Answers').filter(function (row) {
    return submissionIds[row.submissionId] === true;
  });

  const perQuestion = examQuestionsFor_(examId).map(function (entry, index) {
    const related = answers.filter(function (answer) {
      return answer.questionId === entry.row.id;
    });
    const answered = related.filter(function (answer) {
      return hasAnswerValue_(parseJson_(answer.jawabanJson, null));
    });
    const benar = answered.filter(function (answer) {
      return toBool_(answer.benar);
    }).length;
    const salah = answered.filter(function (answer) {
      return answer.benar !== '' && answer.benar !== null && answer.benar !== undefined && !toBool_(answer.benar);
    }).length;
    return {
      questionId: entry.row.id,
      nomor: index + 1,
      pertanyaan: entry.row.pertanyaan,
      benar: benar,
      salah: salah,
      kosong: Math.max(0, count - answered.length),
    };
  });

  return {
    count: count,
    avg: avg,
    min: min,
    max: max,
    passed: passed,
    distribution: distribution,
    perQuestion: perQuestion,
  };
}

function resultsStats_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const exam = findById_('Exams', trim_(payload.examId));
  if (!exam) fail_('NOT_FOUND', 'Ujian tidak ditemukan.');
  ensureOwner_(exam.ownerId, user);
  return computeStats_(exam.id);
}

function resultsExportData_(payload) {
  const user = requireUser_(payload, ['admin', 'guru']);
  const examId = trim_(payload.examId);
  const exam = findById_('Exams', examId);
  if (!exam) fail_('NOT_FOUND', 'Ujian tidak ditemukan.');
  ensureOwner_(exam.ownerId, user);

  const users = usersById_();
  const submissions = readRows_('Submissions')
    .filter(function (row) {
      return row.examId === examId && row.status !== 'in_progress';
    })
    .sort(function (a, b) {
      const left = users[a.studentId];
      const right = users[b.studentId];
      return String(left ? left.nis : '').localeCompare(String(right ? right.nis : ''));
    });

  const rows = submissions.map(function (submission, index) {
    const student = users[submission.studentId];
    return {
      no: index + 1,
      nis: student ? student.nis || '' : '',
      nama: student ? student.name : '',
      kelas: student ? student.kelas || '' : '',
      skor: toNumber_(submission.skor, 0),
      status: submission.status,
      benar: toNumber_(submission.benar, 0),
      salah: toNumber_(submission.salah, 0),
      kosong: toNumber_(submission.kosong, 0),
      submitAt: toIso_(submission.submitAt),
      durasi: formatDuration_(submission.durationSec),
    };
  });

  const examObject = examFromRow_(exam, true);
  examObject.questionCount = examQuestionRows_(examId).length;
  return {
    exam: examObject,
    school: schoolSettings_(),
    rows: rows,
    stats: computeStats_(examId),
    generatedAt: nowIso_(),
  };
}
