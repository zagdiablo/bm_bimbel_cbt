/** Dashboard aggregates, school settings, and audit log. */

function last7DayKeys_() {
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date(Date.now() - i * 86400000);
    days.push({
      key: dayKey_(date),
      label: Utilities.formatDate(date, CONFIG.TIMEZONE, 'EEE'),
    });
  }
  return days;
}

function submissionsPerDay_(submissions) {
  return last7DayKeys_().map(function (day) {
    return {
      label: day.label,
      value: submissions.filter(function (submission) {
        return submission.submitAt && dayKey_(new Date(toIso_(submission.submitAt))) === day.key;
      }).length,
    };
  });
}

function dashboardStats_(payload) {
  const user = requireUser_(payload);
  const now = Date.now();
  const users = usersById_();
  const exams = examsById_();
  const counts = questionCountMap_();
  const allSubmissions = readRows_('Submissions');
  const allExams = Object.keys(exams).map(function (id) {
    return exams[id];
  });

  let visibleExams = allExams;
  if (user.role === 'guru') {
    visibleExams = allExams.filter(function (exam) {
      return exam.ownerId === user.id;
    });
  } else if (user.role === 'siswa') {
    visibleExams = allExams.filter(function (exam) {
      return exam.status === 'published' && new Date(toIso_(exam.selesaiAt)).getTime() >= now;
    });
  }

  const visibleIds = {};
  visibleExams.forEach(function (exam) {
    visibleIds[exam.id] = true;
  });

  let submissions = allSubmissions.filter(function (submission) {
    return visibleIds[submission.examId];
  });
  if (user.role === 'siswa') {
    submissions = submissions.filter(function (submission) {
      return submission.studentId === user.id;
    });
  }
  const completed = submissions.filter(function (submission) {
    return submission.status !== 'in_progress';
  });

  const upcomingExams = visibleExams
    .filter(function (exam) {
      if (exam.status !== 'published') return false;
      if (new Date(toIso_(exam.selesaiAt)).getTime() < now) return false;
      if (user.role === 'siswa') {
        const target = parseJson_(exam.kelasTargetJson, []);
        return target.length === 0 || (user.kelas && target.indexOf(user.kelas) >= 0);
      }
      return true;
    })
    .sort(function (a, b) {
      return new Date(toIso_(a.mulaiAt)).getTime() - new Date(toIso_(b.mulaiAt)).getTime();
    })
    .slice(0, 5)
    .map(function (exam) {
      const owner = users[exam.ownerId];
      const item = examFromRow_(exam, user.role !== 'siswa');
      item.ownerName = owner ? owner.name : undefined;
      item.questionCount = counts[exam.id] || 0;
      if (user.role === 'siswa') {
        const mine = submissions
          .filter(function (submission) {
            return submission.examId === exam.id;
          })
          .sort(function (a, b) {
            return new Date(toIso_(b.mulaiAt)).getTime() - new Date(toIso_(a.mulaiAt)).getTime();
          })[0];
        item.attemptStatus = mine ? mine.status : null;
        item.submissionId = mine ? mine.id : null;
        item.requiresToken = Boolean(exam.token);
        delete item.token;
      }
      return item;
    });

  const recentSubmissions = completed
    .slice()
    .sort(function (a, b) {
      return new Date(toIso_(b.submitAt || b.mulaiAt)).getTime() - new Date(toIso_(a.submitAt || a.mulaiAt)).getTime();
    })
    .slice(0, 5)
    .map(function (row) {
      return publicSubmissionRow_(row, users, exams);
    });

  const pendingGrading = completed
    .filter(function (submission) {
      return submission.status === 'needs_grading';
    })
    .slice(0, 5)
    .map(function (row) {
      return publicSubmissionRow_(row, users, exams);
    });

  if (user.role === 'admin') {
    const activeExams = allExams.filter(function (exam) {
      return exam.status === 'published' && new Date(toIso_(exam.selesaiAt)).getTime() >= now;
    }).length;
    return {
      cards: [
        {
          label: 'Total Pengguna',
          value: String(Object.keys(users).length),
          icon: 'users',
          hint:
            Object.keys(users).filter(function (id) { return users[id].role === 'guru'; }).length +
            ' guru, ' +
            Object.keys(users).filter(function (id) { return users[id].role === 'siswa'; }).length +
            ' siswa',
        },
        {
          label: 'Ujian Aktif',
          value: String(activeExams),
          icon: 'exams',
          hint: allExams.length + ' total ujian',
        },
        {
          label: 'Bank Soal',
          value: String(
            readRows_('Questions').filter(function (row) {
              return toBool_(row.aktif);
            }).length,
          ),
          icon: 'questions',
        },
        {
          label: 'Pengerjaan',
          value: String(completed.length),
          icon: 'submissions',
          hint:
            completed.filter(function (submission) {
              return submission.status === 'needs_grading';
            }).length + ' perlu dinilai',
        },
      ],
      chart: submissionsPerDay_(completed),
      upcomingExams: upcomingExams,
      recentSubmissions: recentSubmissions,
      pendingGrading: pendingGrading,
    };
  }

  if (user.role === 'guru') {
    const avg = completed.length
      ? Math.round(
          (completed.reduce(function (sum, row) { return sum + toNumber_(row.skor, 0); }, 0) /
            completed.length) *
            100,
        ) / 100
      : 0;
    return {
      cards: [
        {
          label: 'Ujian Saya',
          value: String(visibleExams.length),
          icon: 'exams',
          hint:
            visibleExams.filter(function (exam) { return exam.status === 'published'; }).length +
            ' terbit',
        },
        {
          label: 'Soal Saya',
          value: String(
            readRows_('Questions').filter(function (row) {
              return toBool_(row.aktif) && row.ownerId === user.id;
            }).length,
          ),
          icon: 'questions',
        },
        {
          label: 'Perlu Dinilai',
          value: String(
            completed.filter(function (submission) {
              return submission.status === 'needs_grading';
            }).length,
          ),
          icon: 'submissions',
        },
        { label: 'Rata-rata Nilai', value: String(avg), icon: 'score', hint: completed.length + ' pengerjaan' },
      ],
      chart: submissionsPerDay_(completed),
      upcomingExams: upcomingExams,
      recentSubmissions: recentSubmissions,
      pendingGrading: pendingGrading,
    };
  }

  const scores = completed.map(function (row) {
    return toNumber_(row.skor, 0);
  });
  const avg = scores.length
    ? Math.round((scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) * 100) / 100
    : 0;
  const best = scores.length ? Math.max.apply(null, scores) : 0;
  return {
    cards: [
      { label: 'Ujian Tersedia', value: String(upcomingExams.length), icon: 'exams' },
      { label: 'Ujian Selesai', value: String(completed.length), icon: 'submissions' },
      { label: 'Rata-rata Nilai', value: String(avg), icon: 'score' },
      { label: 'Nilai Terbaik', value: String(best), icon: 'score' },
    ],
    chart: submissionsPerDay_(completed),
    upcomingExams: upcomingExams,
    recentSubmissions: recentSubmissions,
    pendingGrading: [],
  };
}

/* --------------------------------------------------------------- settings */

function settingsGet_() {
  return { settings: schoolSettings_(), appName: getProp_('APP_NAME', 'CBT Sekolah') };
}

function settingsUpdate_(payload) {
  const user = requireUser_(payload, ['admin']);
  const settings = payload.settings || {};
  const name = trim_(settings.schoolName);
  if (!name) fail_('VALIDATION', 'Nama sekolah wajib diisi.');
  setProp_('SCHOOL_NAME', name);
  setProp_('SCHOOL_ADDRESS', trim_(settings.schoolAddress));
  setProp_('SCHOOL_LOGO_URL', trim_(settings.schoolLogoUrl));
  setProp_('SCHOOL_HEADMASTER', trim_(settings.schoolHeadmaster));
  logAction_(user, 'settings.update', 'settings', '');
  return { settings: schoolSettings_() };
}

/* ------------------------------------------------------------------- logs */

function logsList_(payload) {
  requireUser_(payload, ['admin']);
  const items = readRows_('Logs')
    .sort(function (a, b) {
      return new Date(toIso_(b.ts)).getTime() - new Date(toIso_(a.ts)).getTime();
    })
    .map(function (row) {
      return {
        id: row.id,
        ts: toIso_(row.ts),
        actorId: row.actorId || undefined,
        actorName: row.actorName || undefined,
        action: row.action,
        entity: row.entity || undefined,
        entityId: row.entityId || undefined,
        meta: parseJson_(row.metaJson, null) || undefined,
      };
    });
  return paginate_(items, payload.page, payload.pageSize);
}
