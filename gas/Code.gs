/**
 * Web App entry point + action router.
 *
 * Requests are POSTs with `?action=...` and a text/plain JSON body:
 *   fetch(`${WEB_APP_URL}?action=auth.login`, {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'text/plain;charset=utf-8' },
 *     body: JSON.stringify({ email, credential })
 *   })
 *
 * text/plain avoids a CORS preflight, which Apps Script cannot answer.
 * The web app always responds with HTTP 200; business errors live in the
 * `{ ok: false, error }` envelope.
 */

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action || 'health' : 'health';
  if (action !== 'health') {
    return jsonOutput_({
      ok: false,
      error: { code: 'BAD_REQUEST', message: 'Gunakan POST untuk action ini.' },
      serverTime: nowIso_(),
    });
  }
  return handleAction_(action, {}, { userAgent: '' });
}

function doPost(e) {
  const action = e && e.parameter ? e.parameter.action || 'health' : 'health';
  let payload = {};
  if (e && e.postData && e.postData.contents) {
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (error) {
      return jsonOutput_({
        ok: false,
        error: { code: 'BAD_REQUEST', message: 'Body JSON tidak valid.' },
        serverTime: nowIso_(),
      });
    }
  }
  const headers = (e && e.headers) || {};
  return handleAction_(action, payload, {
    userAgent: headers['User-Agent'] || headers['user-agent'] || '',
  });
}

function jsonOutput_(object) {
  return ContentService.createTextOutput(JSON.stringify(object)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function handleAction_(action, payload, requestMeta) {
  try {
    const data = dispatch_(action, payload, requestMeta);
    return jsonOutput_({
      ok: true,
      data: data === undefined ? {} : data,
      serverTime: nowIso_(),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return jsonOutput_({
        ok: false,
        error: { code: error.code, message: error.message, details: error.details },
        serverTime: nowIso_(),
      });
    }
    console.error(action + ' failed: ' + (error && error.stack ? error.stack : error));
    return jsonOutput_({
      ok: false,
      error: { code: 'INTERNAL', message: 'Terjadi kesalahan pada server. Coba lagi.' },
      serverTime: nowIso_(),
    });
  }
}

function dispatch_(action, payload, requestMeta) {
  switch (action) {
    case 'health':
      return health_();

    /* auth */
    case 'auth.login':
      return authLogin_(payload);
    case 'auth.google':
      return authGoogle_(payload);
    case 'auth.refresh':
      return authRefresh_(payload);
    case 'auth.me':
      return authMe_(payload);
    case 'auth.logout':
      return authLogout_(payload);
    case 'auth.changePassword':
      return authChangePassword_(payload);
    case 'auth.updateProfile':
      return authUpdateProfile_(payload);

    /* users */
    case 'users.list':
      return usersList_(payload);
    case 'users.create':
      return usersCreate_(payload);
    case 'users.update':
      return usersUpdate_(payload);
    case 'users.delete':
      return usersDelete_(payload);
    case 'users.resetPassword':
      return usersResetPassword_(payload);

    /* questions */
    case 'questions.list':
      return questionsList_(payload);
    case 'questions.get':
      return questionsGet_(payload);
    case 'questions.create':
      return questionsCreate_(payload);
    case 'questions.update':
      return questionsUpdate_(payload);
    case 'questions.delete':
      return questionsDelete_(payload);
    case 'questions.bulkCreate':
      return questionsBulkCreate_(payload);
    case 'questions.meta':
      return questionsMeta_(payload);

    /* exams */
    case 'exams.list':
      return examsList_(payload);
    case 'exams.get':
      return examsGet_(payload);
    case 'exams.create':
      return examsCreate_(payload);
    case 'exams.update':
      return examsUpdate_(payload);
    case 'exams.delete':
      return examsDelete_(payload);
    case 'exams.setQuestions':
      return examsSetQuestions_(payload);
    case 'exams.preview':
      return examsGet_(payload);
    case 'exams.publish':
      return examsPublish_(payload);
    case 'exams.close':
      return examsClose_(payload);
    case 'exams.assign':
      return examsAssign_(payload);
    case 'exams.info':
      return examsInfo_(payload);

    /* attempts */
    case 'attempts.start':
      return attemptsStart_(payload, requestMeta);
    case 'attempts.get':
      return attemptsGet_(payload);
    case 'attempts.save':
      return attemptsSave_(payload);
    case 'attempts.logEvent':
      return attemptsLogEvent_(payload);
    case 'attempts.submit':
      return attemptsSubmit_(payload);

    /* submissions */
    case 'submissions.list':
      return submissionsList_(payload);
    case 'submissions.get':
      return submissionsGet_(payload);
    case 'submissions.gradeEssay':
      return submissionsGradeEssay_(payload);
    case 'submissions.forceSubmit':
      return submissionsForceSubmit_(payload);

    /* results */
    case 'results.mine':
      return resultsMine_(payload);
    case 'results.detail':
      return resultsDetail_(payload);
    case 'results.list':
      return resultsList_(payload);
    case 'results.exportData':
      return resultsExportData_(payload);
    case 'results.stats':
      return resultsStats_(payload);

    /* dashboard + settings + logs */
    case 'dashboard.stats':
      return dashboardStats_(payload);
    case 'settings.get':
      return settingsGet_();
    case 'settings.update':
      return settingsUpdate_(payload);
    case 'logs.list':
      return logsList_(payload);

    default:
      fail_('BAD_ACTION', 'Action "' + action + '" tidak dikenal.');
  }
}

function health_() {
  const spreadsheet = getSpreadsheet_();
  const present = {};
  SHEET_NAMES.forEach(function (name) {
    present[name] = Boolean(spreadsheet.getSheetByName(name));
  });
  return {
    version: CONFIG.VERSION,
    mode: 'gas',
    timezone: CONFIG.TIMEZONE,
    spreadsheetId: spreadsheet.getId(),
    sheets: present,
    serverTime: nowIso_(),
  };
}
