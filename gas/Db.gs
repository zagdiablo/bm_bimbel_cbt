/**
 * Spreadsheet access layer.
 *
 * Every mutating action wraps its work in withLock_ to avoid two students
 * writing to the same row concurrently. Reads are lock-free because Sheets
 * serves them consistently enough for a school-scale workload.
 */

function getSpreadsheet_() {
  const id = getProp_('SPREADSHEET_ID', '');
  if (id) return SpreadsheetApp.openById(id);

  let active = null;
  try {
    active = SpreadsheetApp.getActiveSpreadsheet();
  } catch (error) {
    active = null;
  }
  if (active) {
    setProp_('SPREADSHEET_ID', active.getId());
    return active;
  }

  const created = SpreadsheetApp.create('CBT Database');
  setProp_('SPREADSHEET_ID', created.getId());
  return created;
}

function getSheet_(name) {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
    sheet.getRange(1, 1, 1, CONFIG.SHEETS[name].length).setValues([CONFIG.SHEETS[name]]);
  }
  return sheet;
}

function ensureSheets_() {
  const spreadsheet = getSpreadsheet_();
  SHEET_NAMES.forEach(function (name) {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);
    const headers = CONFIG.SHEETS[name];
    const existing = sheet.getLastColumn() > 0
      ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
      : [];
    if (existing.length === 0 || existing[0] !== headers[0]) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0f766e').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    if (sheet.getMaxColumns() < headers.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
    }
  });
  // Remove the default empty "Sheet1" created with a brand new spreadsheet.
  const sheet1 = spreadsheet.getSheetByName('Sheet1');
  if (sheet1 && spreadsheet.getSheets().length > 1) spreadsheet.deleteSheet(sheet1);
  return spreadsheet;
}

function readRows_(name) {
  const sheet = getSheet_(name);
  const headers = CONFIG.SHEETS[name];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(1, 1, lastRow, headers.length).getValues();
  const rows = [];
  for (let r = 1; r < values.length; r += 1) {
    const row = values[r];
    if (!row[0]) continue;
    const object = {};
    for (let c = 0; c < headers.length; c += 1) object[headers[c]] = row[c];
    rows.push(object);
  }
  return rows;
}

function findRowIndexById_(name, id) {
  const sheet = getSheet_(name);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i += 1) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function findById_(name, id) {
  const rowIndex = findRowIndexById_(name, id);
  if (rowIndex < 0) return null;
  const sheet = getSheet_(name);
  const headers = CONFIG.SHEETS[name];
  const values = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  const object = {};
  headers.forEach(function (header, index) {
    object[header] = values[index];
  });
  return object;
}

function insertRow_(name, object) {
  const sheet = getSheet_(name);
  const headers = CONFIG.SHEETS[name];
  const row = headers.map(function (header) {
    const value = object[header];
    return value === undefined || value === null ? '' : value;
  });
  sheet.appendRow(row);
  return object;
}

function updateRow_(name, id, patch) {
  const sheet = getSheet_(name);
  const headers = CONFIG.SHEETS[name];
  const rowIndex = findRowIndexById_(name, id);
  if (rowIndex < 0) fail_('NOT_FOUND', 'Data tidak ditemukan.');
  const range = sheet.getRange(rowIndex, 1, 1, headers.length);
  const current = range.getValues()[0];
  headers.forEach(function (header, index) {
    if (Object.prototype.hasOwnProperty.call(patch, header)) {
      current[index] = patch[header] === null || patch[header] === undefined ? '' : patch[header];
    }
  });
  range.setValues([current]);
  return current;
}

function deleteRowById_(name, id) {
  const sheet = getSheet_(name);
  const rowIndex = findRowIndexById_(name, id);
  if (rowIndex < 0) return false;
  sheet.deleteRow(rowIndex);
  return true;
}

function clearSheet_(name) {
  const sheet = getSheet_(name);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getMaxColumns()).clearContent();
  }
}

function withLock_(callback) {
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(CONFIG.LOCK_TIMEOUT_MS);
  if (!acquired) {
    fail_(
      'LOCK_TIMEOUT',
      'Server sedang sibuk memproses data lain. Jawaban Anda aman; coba lagi beberapa detik lagi.',
    );
  }
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function usersById_() {
  const map = {};
  readRows_('Users').forEach(function (user) {
    map[user.id] = user;
  });
  return map;
}

function examsById_() {
  const map = {};
  readRows_('Exams').forEach(function (exam) {
    map[exam.id] = exam;
  });
  return map;
}
