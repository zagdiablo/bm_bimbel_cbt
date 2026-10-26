/**
 * One-time bootstrap from the Apps Script editor.
 *
 * 1. Create/open a Google Spreadsheet.
 * 2. Extensions > Apps Script.
 * 3. Paste all .gs files (or use clasp).
 * 4. Run `setupSpreadsheet`.
 * 5. Run `seedDemoData` (optional demo data).
 * 6. Deploy > New deployment > Web app > Execute as: Me > Who has access: Anyone.
 */

function setupSpreadsheet() {
  const spreadsheet = ensureSheets_();
  spreadsheet.setSpreadsheetTimeZone(CONFIG.TIMEZONE);

  tokenSecret_();
  passwordPepper_();
  if (!getProp_('SPREADSHEET_ID', '')) setProp_('SPREADSHEET_ID', spreadsheet.getId());
  if (!getProp_('APP_NAME', '')) setProp_('APP_NAME', 'CBT Sekolah');
  if (!getProp_('SCHOOL_NAME', '')) setProp_('SCHOOL_NAME', 'SMA Negeri 1 Contoh');
  if (!getProp_('SCHOOL_ADDRESS', '')) setProp_('SCHOOL_ADDRESS', 'Jl. Pendidikan No. 1, Jakarta');
  if (!getProp_('SCHOOL_LOGO_URL', '')) setProp_('SCHOOL_LOGO_URL', '');
  if (!getProp_('SCHOOL_HEADMASTER', '')) setProp_('SCHOOL_HEADMASTER', '');
  if (!getProp_('GOOGLE_CLIENT_ID', '')) setProp_('GOOGLE_CLIENT_ID', '');

  SpreadsheetApp.flush();

  const result = {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl(),
    timezone: spreadsheet.getSpreadsheetTimeZone(),
    sheets: SHEET_NAMES,
    accessTokenTtlSeconds: CONFIG.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: CONFIG.REFRESH_TOKEN_TTL_SECONDS,
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function setupProperties() {
  return setupSpreadsheet();
}

function resetAllSheets_() {
  SHEET_NAMES.forEach(function (name) {
    clearSheet_(name);
  });
}

/**
 * DESTRUCTIVE: clears every sheet and recreates the demo dataset.
 * Use only on a demo spreadsheet.
 */
function resetDemoData() {
  resetAllSheets_();
  seedDemoData(true);
  return { ok: true, message: 'Data demo berhasil direset.' };
}
