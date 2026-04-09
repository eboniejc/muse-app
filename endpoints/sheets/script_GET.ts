import { schema } from "./script_GET.schema";

const GOOGLE_APPS_SCRIPT_CONTENT = `/**
 * MUSE INC - Google Sheets Manager (English + Vietnamese)
 * =========================================================
 * SETUP INSTRUCTIONS:
 *   1. Paste this file into Extensions > Apps Script (replace everything)
 *   2. Save (Ctrl+S)
 *   3. Select "installTrigger" in the function dropdown and click Run
 *      - This installs the edit trigger. No popup will appear - check the
 *        Execution Log at the bottom to confirm "Trigger installed OK"
 *   4. Then select "setupSheets" and click Run
 *      - This rebuilds the Calendar and Audit sheets cleanly
 *   5. Done. Go back to the sheet and use normally.
 *
 * DAILY USE:
 *   - MUSE INC Sync menu > Pull From App  (load latest data)
 *   - MUSE INC Sync menu > Push To App    (save changes)
 *   - Monthly Calendar tab: change B2 (month) or D2 (year) -> auto rebuilds
 *   - Audit tab: change B2 (from date) or D2 (to date) -> auto rebuilds
 */

// ── Constants ─────────────────────────────────────────────────────────────────

var MASTER_SHEET    = 'MasterEnrollments';
var EVENTS_SHEET    = 'Events';
var CAL_SHEET       = 'Monthly Calendar';
var AUDIT_SHEET     = 'Audit';
var MAX_LESSONS     = 33;
var CALENDAR_NAME   = 'MUSE INC Schedule';
var LESSON_DURATION = 1; // hours

// MasterEnrollments column positions (1-indexed)
var COL_INSTRUCTOR_NAME  = 11;
var COL_INSTRUCTOR_EMAIL = 12;
var COL_LESSON1_DATE     = 13; // +3 per lesson
var COL_LESSON1_INSTR    = 14; // +3 per lesson

var C = {
  navy:        '#1a2744',
  navyMid:     '#2c3e6b',
  white:       '#ffffff',
  instrBlue:   '#e8f4fd',
  overrideYel: '#fff3cd',
  assignGreen: '#d4edda',
  altRow:      '#f7f9ff',
  calBlue:     '#ddeeff',
  stepsYel:    '#fffbe6',
  stepsText:   '#5a4000',
  guideBlue:   '#eef3ff',
  guideText:   '#1a2744',
  inputBg:     '#ffffff',
  labelText:   '#333333',
  hintText:    '#888888',
};

// ── STEP 1: Install trigger (run this once from the editor) ───────────────────

function installTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'onEditInstallable') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onEditInstallable').forSpreadsheet(ss).onEdit().create();
  Logger.log('Trigger installed OK. onEditInstallable will now fire for all edits including dropdowns.');
}

// ── STEP 2: Clean and rebuild Calendar + Audit sheets ────────────────────────

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var oldCal = ss.getSheetByName(CAL_SHEET);
  if (oldCal) ss.deleteSheet(oldCal);
  var calSheet = ss.insertSheet(CAL_SHEET);
  _buildCalendarControls(calSheet);
  renderCalendar(calSheet);

  var oldAud = ss.getSheetByName(AUDIT_SHEET);
  if (oldAud) ss.deleteSheet(oldAud);
  var audSheet = ss.insertSheet(AUDIT_SHEET);
  _buildAuditControls(audSheet);
  renderAudit(audSheet);

  _instructMaster(ss);
  _instructEvents(ss);
  cleanEventsSheet(ss);

  Logger.log('Sheets rebuilt OK. Calendar and Audit are clean with control cells in B2 and D2.');
}

// ── Clean Events Sheet ────────────────────────────────────────────────────────

function cleanEventsSheet(ss) {
  var sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) return;

  var HEADERS = ['id','title','caption','flyerUrl','startAt','endAt','isActive'];
  var lastCol = sheet.getLastColumn();

  // Read existing data so we can rewrite cleanly
  var existingData = sheet.getDataRange().getValues();
  var existingHeaders = existingData.length > 0 ? existingData[0].map(String) : [];

  // Remap rows to the correct 7-column order
  var cleanRows = [];
  for (var i = 1; i < existingData.length; i++) {
    var row = existingData[i];
    var hasData = row.some(function(v) { return v !== '' && v !== null && v !== undefined; });
    if (!hasData) continue;
    cleanRows.push(HEADERS.map(function(h) {
      var idx = existingHeaders.indexOf(h);
      return idx >= 0 ? row[idx] : '';
    }));
  }

  // Clear the whole sheet and rewrite with exactly 7 columns
  sheet.clear();
  var numRows = cleanRows.length + 1;
  var values = [HEADERS].concat(cleanRows);
  sheet.getRange(1, 1, numRows, 7).setValues(values);

  // Delete any phantom columns beyond col 7
  var newLastCol = sheet.getLastColumn();
  if (newLastCol > 7) sheet.deleteColumns(8, newLastCol - 7);

  // Header row formatting
  sheet.getRange(1, 1, 1, 7)
    .setFontWeight('bold')
    .setBackground(C.navy)
    .setFontColor(C.white);

  // Header notes
  var notes = [
    'EN: Unique event ID (auto-set by app, do not edit)\\nVI: ID su kien (tu dong, khong chinh sua)',
    'EN: Event title\\nVI: Ten su kien',
    'EN: Short description shown on event card\\nVI: Mo ta ngan hien thi tren the su kien',
    'EN: Full image URL (https://...)\\nVI: Link anh day du (https://...)',
    'EN: Start date/time — format: dd/mm/yy h:mmam/pm e.g. 25/04/26 07:00pm\\nVI: Ngay gio bat dau — dinh dang: dd/mm/yy h:mmam/pm vd: 25/04/26 07:00pm',
    'EN: End date/time — leave blank for 2hr default\\nVI: Ngay gio ket thuc — de trong = mac dinh 2 gio',
    'EN: TRUE = visible on app | FALSE = hidden\\nVI: TRUE = hien thi | FALSE = an di'
  ];
  for (var c = 0; c < 7; c++) {
    sheet.getRange(1, c + 1).setNote(notes[c]);
  }

  // Date format for startAt (col 5) and endAt (col 6)
  if (cleanRows.length > 0) {
    sheet.getRange(2, 5, cleanRows.length, 1).setNumberFormat('dd/mm/yy h:mm am/pm');
    sheet.getRange(2, 6, cleanRows.length, 1).setNumberFormat('dd/mm/yy h:mm am/pm');

    // TRUE/FALSE dropdown for isActive (col 7)
    var isActiveRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['TRUE','FALSE'], true)
      .setHelpText('EN: TRUE = show event | FALSE = hide event\\nVI: TRUE = hien thi | FALSE = an su kien')
      .build();
    sheet.getRange(2, 7, cleanRows.length, 1).setDataValidation(isActiveRule);
  }

  // Column widths
  sheet.setColumnWidth(1, 60);   // id
  sheet.setColumnWidth(2, 200);  // title
  sheet.setColumnWidth(3, 250);  // caption
  sheet.setColumnWidth(4, 300);  // flyerUrl
  sheet.setColumnWidth(5, 160);  // startAt
  sheet.setColumnWidth(6, 160);  // endAt
  sheet.setColumnWidth(7, 80);   // isActive

  sheet.setFrozenRows(1);
  Logger.log('cleanEventsSheet: Events sheet cleaned — ' + cleanRows.length + ' rows, 7 columns.');
}

// ── Menu ──────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MUSE INC Sync')
    .addItem('Pull From App',           'pullFromApp')
    .addItem('Push To App',             'pushToApp')
    .addItem('Sync to Google Calendar', 'syncToCalendar')
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu('Settings')
        .addItem('Setup App Connection',  'setup')
        .addItem('Setup Google Calendar', 'setupCalendar')
    )
    .addToUi();
}

// ── Simple trigger (fallback for direct typing) ───────────────────────────────

function onEdit(e) { _handleEdit(e); }

// ── Installable trigger (handles dropdowns + date pickers) ────────────────────

function onEditInstallable(e) { _handleEdit(e); }

// ── Core edit handler ─────────────────────────────────────────────────────────

function _handleEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var name  = sheet.getName();
  var col   = e.range.getColumn();
  var row   = e.range.getRow();

  if (name === MASTER_SHEET) {
    if (row < 2) return;
    if (col === COL_INSTRUCTOR_EMAIL) {
      _handleInstructorAssignment(sheet, row, e.value);
      return;
    }
    for (var i = 0; i < MAX_LESSONS; i++) {
      if (col === COL_LESSON1_INSTR + (i * 3)) {
        if (e.value) {
          e.range.setBackground(C.overrideYel)
            .setNote('EN: Instructor override for this lesson only.\\nTo revert: clear this cell.\\nVI: Giang vien thay the chi cho buoi hoc nay.\\nDe hoan tac: xoa o nay.');
        } else {
          e.range.setBackground(null).clearNote();
        }
        return;
      }
      if (col === COL_LESSON1_DATE + (i * 3)) {
        e.range.setNumberFormat('dd/mm/yy h:mm am/pm');
        return;
      }
    }
    return;
  }

  if (name === CAL_SHEET && row === 2 && (col === 2 || col === 4)) {
    var cs = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CAL_SHEET);
    if (cs) renderCalendar(cs);
    return;
  }

  if (name === AUDIT_SHEET && row === 2 && (col === 2 || col === 4)) {
    var as = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUDIT_SHEET);
    if (as) renderAudit(as);
    return;
  }
}

// ── Instructor Assignment ─────────────────────────────────────────────────────

function _handleInstructorAssignment(sheet, row, newEmail) {
  if (!newEmail) return;
  var instructorName = sheet.getRange(row, COL_INSTRUCTOR_NAME).getValue();
  var studentName    = sheet.getRange(row, 4).getValue();
  var label          = instructorName || newEmail;

  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    'Apply instructor to all lessons? / Ap dung cho tat ca buoi hoc?',
    'EN: Assign ' + label + ' to all empty lesson slots' + (studentName ? ' for ' + studentName : '') + '?\\n' +
    '  YES = fill all empty lesson instructor cells on this row\\n' +
    '  NO  = only update the default; lesson cells stay unchanged\\n\\n' +
    'VI: Phan cong ' + label + ' cho tat ca o giang vien trong' + (studentName ? ' cua ' + studentName : '') + '?\\n' +
    '  YES = dien vao tat ca o giang vien con trong\\n' +
    '  NO  = chi cap nhat mac dinh; cac o buoi hoc giu nguyen',
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;

  var filled = 0;
  for (var i = 0; i < MAX_LESSONS; i++) {
    var cell = sheet.getRange(row, COL_LESSON1_INSTR + (i * 3));
    if (!cell.getValue()) {
      cell.setValue(instructorName || newEmail)
          .setBackground(C.assignGreen)
          .setNote('EN: Auto-filled ' + new Date().toLocaleDateString() + '\\nVI: Tu dong dien ' + new Date().toLocaleDateString());
      filled++;
    }
  }

  if (filled === 0) {
    ui.alert(
      'No empty slots / Khong co o trong',
      'EN: All lesson instructor cells already have a value. Edit individual cells to override.\\n' +
      'VI: Tat ca o giang vien buoi hoc da co gia tri. Chinh sua tung o de thay doi rieng le.',
      ui.ButtonSet.OK
    );
  }
}

// ── Build Calendar Sheet Layout ───────────────────────────────────────────────

function _buildCalendarControls(sheet) {
  var r1 = sheet.getRange(1, 1, 1, 7);
  r1.merge().setValue('MONTHLY CALENDAR  |  LICH THANG')
    .setBackground(C.navy).setFontColor(C.white)
    .setFontWeight('bold').setFontSize(14)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 44);

  sheet.getRange(2, 1).setValue('Month / Thang:')
    .setFontWeight('bold').setFontColor(C.labelText).setFontSize(11);

  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  var now  = new Date();
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(MONTHS, true)
    .setHelpText('Pick a month / Chon thang').build();
  sheet.getRange('B2')
    .setDataValidation(rule).setValue(MONTHS[now.getMonth()])
    .setBackground(C.inputBg).setFontWeight('bold').setFontSize(12)
    .setBorder(true, true, true, true, false, false, '#cccccc', SpreadsheetApp.BorderStyle.SOLID)
    .setNote('EN: Change this to switch month. Calendar updates automatically.\\nVI: Thay doi de doi thang. Lich tu dong cap nhat.');

  sheet.getRange(2, 3).setValue('Year / Nam:')
    .setFontWeight('bold').setFontColor(C.labelText).setFontSize(11);
  sheet.getRange('D2')
    .setValue(now.getFullYear()).setNumberFormat('0')
    .setBackground(C.inputBg).setFontWeight('bold').setFontSize(12)
    .setBorder(true, true, true, true, false, false, '#cccccc', SpreadsheetApp.BorderStyle.SOLID)
    .setNote('EN: Change this to switch year. Calendar updates automatically.\\nVI: Thay doi de doi nam. Lich tu dong cap nhat.');

  sheet.getRange(2, 5, 1, 3).merge()
    .setValue('EN: Change month or year above - calendar updates automatically\\nVI: Thay doi thang hoac nam - lich tu dong cap nhat')
    .setFontColor(C.hintText).setFontStyle('italic').setFontSize(10).setWrap(true);
  sheet.setRowHeight(2, 40);

  var r3 = sheet.getRange(3, 1, 1, 7);
  r3.merge()
    .setValue(
      'EN: Days highlighted blue have lessons. Each day shows: time, student, course, instructor.\\n' +
      'VI: Ngay duoc to xanh co buoi hoc. Moi ngay hien thi: gio, hoc vien, khoa hoc, giang vien.'
    )
    .setBackground(C.stepsYel).setFontColor(C.stepsText)
    .setFontSize(10).setWrap(true).setVerticalAlignment('middle');
  sheet.setRowHeight(3, 44);

  sheet.setFrozenRows(3);
  for (var c = 1; c <= 7; c++) sheet.setColumnWidth(c, 155);
}

// ── Build Audit Sheet Layout ──────────────────────────────────────────────────

function _buildAuditControls(sheet) {
  var r1 = sheet.getRange(1, 1, 1, 5);
  r1.merge().setValue('INSTRUCTOR AUDIT  |  BAO CAO GIANG VIEN')
    .setBackground(C.navy).setFontColor(C.white)
    .setFontWeight('bold').setFontSize(14)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 44);

  var now          = new Date();
  var firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var lastOfMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  sheet.getRange(2, 1).setValue('From / Tu ngay:')
    .setFontWeight('bold').setFontColor(C.labelText).setFontSize(11);
  sheet.getRange('B2')
    .setValue(firstOfMonth).setNumberFormat('dd/mm/yyyy')
    .setBackground(C.inputBg).setFontWeight('bold').setFontSize(12)
    .setBorder(true, true, true, true, false, false, '#cccccc', SpreadsheetApp.BorderStyle.SOLID)
    .setNote('EN: Set start date for the report. Format: dd/mm/yyyy\\nVI: Nhap ngay bat dau. Dinh dang: dd/mm/yyyy');

  sheet.getRange(2, 3).setValue('To / Den ngay:')
    .setFontWeight('bold').setFontColor(C.labelText).setFontSize(11);
  sheet.getRange('D2')
    .setValue(lastOfMonth).setNumberFormat('dd/mm/yyyy')
    .setBackground(C.inputBg).setFontWeight('bold').setFontSize(12)
    .setBorder(true, true, true, true, false, false, '#cccccc', SpreadsheetApp.BorderStyle.SOLID)
    .setNote('EN: Set end date for the report. Format: dd/mm/yyyy\\nVI: Nhap ngay ket thuc. Dinh dang: dd/mm/yyyy');

  sheet.getRange(2, 5)
    .setValue('Change dates above - report updates automatically / Thay doi ngay - bao cao tu dong cap nhat')
    .setFontColor(C.hintText).setFontStyle('italic').setFontSize(10).setWrap(true);
  sheet.setRowHeight(2, 40);

  var r3 = sheet.getRange(3, 1, 1, 5);
  r3.merge()
    .setValue(
      'EN: Shows lessons per instructor for the date range. Cancelled lessons excluded automatically.\\n' +
      'VI: Hien thi so buoi hoc moi giang vien trong khoang thoi gian. Buoi hoc da huy tu dong bi loai tru.'
    )
    .setBackground(C.stepsYel).setFontColor(C.stepsText)
    .setFontSize(10).setWrap(true).setVerticalAlignment('middle');
  sheet.setRowHeight(3, 44);

  sheet.setFrozenRows(3);
}

// ── Render Calendar Grid ──────────────────────────────────────────────────────

function renderCalendar(sheet) {
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  var DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  var monthVal = sheet.getRange('B2').getValue();
  var yearVal  = sheet.getRange('D2').getValue();
  var month    = MONTHS.indexOf(String(monthVal).trim()) + 1;
  var year     = parseInt(yearVal, 10);

  if (!month || !year || year < 2000 || year > 2100) {
    Logger.log('renderCalendar: invalid month=' + monthVal + ' year=' + yearVal);
    return;
  }

  var lessonsByDay = {};
  try {
    var rows = readSheetRows(MASTER_SHEET);
    rows.forEach(function(row) {
      for (var i = 1; i <= MAX_LESSONS; i++) {
        if ((row['lesson' + i + 'Status'] || '').toLowerCase() === 'cancelled') continue;
        var dtVal = row['lesson' + i + 'DateTime'];
        if (!dtVal) continue;
        var dt = new Date(dtVal);
        if (isNaN(dt.getTime())) continue;
        if (dt.getFullYear() !== year || dt.getMonth() + 1 !== month) continue;
        var key = String(dt.getDate());
        var h = dt.getHours(), m = dt.getMinutes();
        var t = (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h >= 12 ? 'pm' : 'am');
        var instr = row['lesson' + i + 'Instructor'] || row.instructorName || '';
        if (!lessonsByDay[key]) lessonsByDay[key] = [];
        lessonsByDay[key].push({ time: t, student: row.studentName || '?', course: row.courseName || '', instructor: instr });
      }
    });
    Object.keys(lessonsByDay).forEach(function(k) {
      lessonsByDay[k].sort(function(a, b) { return a.time < b.time ? -1 : 1; });
    });
  } catch(err) {
    Logger.log('renderCalendar: error reading lessons - ' + err.message);
  }

  var daysInMonth = new Date(year, month, 0).getDate();
  var startDow    = new Date(year, month - 1, 1).getDay();
  var weeks = [], week = [];
  for (var p = 0; p < startDow; p++) week.push(0);
  for (var d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  while (week.length > 0 && week.length < 7) week.push(0);
  if (week.length) weeks.push(week);

  var lastRow = Math.max(sheet.getLastRow(), 12);
  if (lastRow >= 4) sheet.getRange(4, 1, lastRow - 3, 7).clearContent().clearFormat();

  DAYS.forEach(function(name, col) {
    sheet.getRange(4, col + 1).setValue(name)
      .setBackground(C.navyMid).setFontColor(C.white)
      .setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sheet.setRowHeight(4, 28);

  weeks.forEach(function(wk, wkIdx) {
    var sheetRow   = wkIdx + 5;
    var maxLessons = 0;
    wk.forEach(function(day) {
      if (day && lessonsByDay[String(day)]) maxLessons = Math.max(maxLessons, lessonsByDay[String(day)].length);
    });
    sheet.setRowHeight(sheetRow, Math.max(72, 36 + maxLessons * 22));

    wk.forEach(function(day, colIdx) {
      var cell = sheet.getRange(sheetRow, colIdx + 1);
      if (!day) { cell.setBackground('#f5f5f5'); return; }

      var lessons = lessonsByDay[String(day)] || [];
      var lines   = [String(day)];
      lessons.forEach(function(l) {
        lines.push(l.time + '  ' + l.student);
        if (l.course) lines.push('  ' + l.course + (l.instructor ? ' - ' + l.instructor : ''));
      });

      cell.setValue(lines.join('\\n')).setWrap(true).setVerticalAlignment('top')
          .setBackground(lessons.length ? C.calBlue : C.white)
          .setBorder(true, true, true, true, false, false, '#cccccc', SpreadsheetApp.BorderStyle.SOLID);

      try {
        var rt = SpreadsheetApp.newRichTextValue().setText(lines.join('\\n'))
          .setTextStyle(0, 1, SpreadsheetApp.newTextStyle().setBold(true).setFontSize(11).build())
          .build();
        cell.setRichTextValue(rt);
      } catch(err) {}
    });
  });
}

// ── Render Audit Report ───────────────────────────────────────────────────────

function renderAudit(sheet) {
  var fromVal = sheet.getRange('B2').getValue();
  var toVal   = sheet.getRange('D2').getValue();
  if (!fromVal || !toVal) return;

  var startDate = new Date(fromVal); startDate.setHours(0, 0, 0, 0);
  var endDate   = new Date(toVal);   endDate.setHours(23, 59, 59, 999);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

  var byInstructor = {};
  try {
    var rows = readSheetRows(MASTER_SHEET);
    rows.forEach(function(row) {
      for (var i = 1; i <= MAX_LESSONS; i++) {
        if ((row['lesson' + i + 'Status'] || '').toLowerCase() === 'cancelled') continue;
        var dtVal = row['lesson' + i + 'DateTime'];
        if (!dtVal) continue;
        var dt = new Date(dtVal);
        if (isNaN(dt.getTime()) || dt < startDate || dt > endDate) continue;
        var instr = (row['lesson' + i + 'Instructor'] || row.instructorName || 'Unassigned').trim();
        if (!byInstructor[instr]) byInstructor[instr] = [];
        byInstructor[instr].push({ student: row.studentName || '', course: row.courseName || '', num: i, date: dt });
      }
    });
  } catch(err) {
    Logger.log('renderAudit: error - ' + err.message);
    return;
  }

  var lastRow = Math.max(sheet.getLastRow(), 10);
  if (lastRow >= 4) sheet.getRange(4, 1, lastRow - 3, 5).clearContent().clearFormat();

  var instructors = Object.keys(byInstructor).sort();
  var total = instructors.reduce(function(s, n) { return s + byInstructor[n].length; }, 0);
  var r = 4;

  if (instructors.length === 0) {
    sheet.getRange(r, 1, 1, 5).merge()
      .setValue('EN: No lessons found for this date range.\\nVI: Khong tim thay buoi hoc nao trong khoang thoi gian nay.')
      .setFontStyle('italic').setFontColor(C.hintText).setWrap(true);
    return;
  }

  sheet.getRange(r, 1, 1, 3)
    .setValues([['Instructor / Giang vien', 'Lessons / So buoi', 'Period / Khoang thoi gian']])
    .setBackground(C.navyMid).setFontColor(C.white).setFontWeight('bold');
  sheet.setRowHeight(r, 28); r++;

  var tz = Session.getScriptTimeZone();
  var period = Utilities.formatDate(startDate, tz, 'dd/MM/yyyy') + ' - ' + Utilities.formatDate(endDate, tz, 'dd/MM/yyyy');

  instructors.forEach(function(name) {
    sheet.getRange(r, 1, 1, 3).setValues([[name, byInstructor[name].length, period]])
      .setBackground(r % 2 === 0 ? C.altRow : C.white);
    r++;
  });

  sheet.getRange(r, 1, 1, 2).setValues([['TOTAL / TONG', total]])
    .setFontWeight('bold').setBackground(C.instrBlue);
  r += 2;

  sheet.getRange(r, 1, 1, 5)
    .setValues([['Instructor / Giang vien', 'Student / Hoc vien', 'Course / Khoa hoc', 'Lesson', 'Date & Time / Ngay gio']])
    .setBackground(C.navyMid).setFontColor(C.white).setFontWeight('bold');
  sheet.setRowHeight(r, 28); r++;

  instructors.forEach(function(name) {
    var lessons = byInstructor[name].slice().sort(function(a, b) { return a.date - b.date; });
    lessons.forEach(function(l) {
      sheet.getRange(r, 1, 1, 5).setValues([[name, l.student, l.course, 'Lesson ' + l.num, l.date]])
        .setBackground(r % 2 === 0 ? C.altRow : C.white);
      sheet.getRange(r, 5).setNumberFormat('dd/mm/yy h:mm am/pm');
      r++;
    });
    sheet.getRange(r, 1, 1, 2).setValues([['Subtotal: ' + name, lessons.length]])
      .setFontWeight('bold').setBackground(C.instrBlue);
    r++;
  });

  sheet.autoResizeColumns(1, 5);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

function setup() {
  var ui    = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var urlRes = ui.prompt('Setup (1/2)',
    'EN: Enter your Muse App URL (e.g. https://myapp.example.com)\\nVI: Nhap URL ung dung Muse',
    ui.ButtonSet.OK_CANCEL);
  if (urlRes.getSelectedButton() !== ui.Button.OK) return;
  var keyRes = ui.prompt('Setup (2/2)',
    'EN: Enter your API Key\\nVI: Nhap API Key',
    ui.ButtonSet.OK_CANCEL);
  if (keyRes.getSelectedButton() !== ui.Button.OK) return;
  props.setProperty('APP_URL', urlRes.getResponseText().trim().replace(/\\/$/, ''));
  props.setProperty('API_KEY', keyRes.getResponseText().trim());
  ui.alert('Done / Hoan tat', 'EN: Connection saved.\\nVI: Da luu ket noi.', ui.ButtonSet.OK);
}

function setupCalendar() {
  var ui    = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var cals  = CalendarApp.getCalendarsByName(CALENDAR_NAME);
  var cal   = cals.length ? cals[0] : CalendarApp.createCalendar(CALENDAR_NAME, { color: CalendarApp.Color.TEAL });
  props.setProperty('CALENDAR_ID', cal.getId());
  ui.alert('Done / Hoan tat',
    'EN: Calendar ready: ' + CALENDAR_NAME + '\\nShare it with instructors via Google Calendar settings.\\n\\n' +
    'VI: Lich san sang: ' + CALENDAR_NAME + '\\nChia se voi giang vien qua cai dat Google Calendar.',
    ui.ButtonSet.OK);
}

// ── Pull From App ─────────────────────────────────────────────────────────────

function pullFromApp() {
  var ui     = SpreadsheetApp.getUi();
  var props  = PropertiesService.getScriptProperties();
  var appUrl = props.getProperty('APP_URL');
  var apiKey = props.getProperty('API_KEY');
  if (!appUrl || !apiKey) {
    ui.alert('Not configured', 'EN: Run MUSE INC Sync > Settings > Setup App Connection first.\\nVI: Chay MUSE INC Sync > Settings > Setup App Connection truoc.', ui.ButtonSet.OK);
    return;
  }
  try {
    var existingById = {};
    try { readSheetRows(MASTER_SHEET).forEach(function(r) { if (r.enrollmentId) existingById[String(r.enrollmentId)] = r; }); } catch(e) {}

    var res = UrlFetchApp.fetch(appUrl + '/_api/sheets/export', { method: 'post', headers: { 'x-api-key': apiKey }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('Export failed ' + res.getResponseCode() + ': ' + res.getContentText());

    var parsed        = parseSuperJSON(res.getContentText());
    var enrollments   = (parsed && parsed.data && parsed.data.flattenedEnrollments) || [];
    var events        = (parsed && parsed.data && parsed.data.events)               || [];
    var cancellations = (parsed && parsed.data && parsed.data.lessonCancellations)  || [];

    var merged = enrollments.map(function(row) {
      var ex = existingById[String(row.enrollmentId || '')];
      if (!ex) return row;
      var emailMatch = !ex.email || !row.email || ex.email === row.email;
      var nameMatch  = !ex.studentName || !row.studentName || ex.studentName === row.studentName;
      if (!emailMatch && !nameMatch) return row;
      var out = {}; Object.keys(row).forEach(function(k) { out[k] = row[k]; });
      ['instructorId','instructorName','instructorEmail'].forEach(function(f) { if (!out[f] && ex[f]) out[f] = ex[f]; });
      for (var i = 1; i <= MAX_LESSONS; i++) {
        var dt = 'lesson'+i+'DateTime', ins = 'lesson'+i+'Instructor', st = 'lesson'+i+'Status';
        if (dt in ex) out[dt] = ex[dt];
        if (!out[ins] && ex[ins]) out[ins] = ex[ins];
        if (!out[st]  && ex[st])  out[st]  = ex[st];
      }
      return out;
    });

    writeSheetRows(MASTER_SHEET, buildEnrollmentHeaders(), merged);
    writeSheetRows(EVENTS_SHEET, buildEventHeaders(), events);
    cleanEventsSheet(SpreadsheetApp.getActiveSpreadsheet());
    if (cancellations.length) writeSheetRows('Cancellations', buildCancellationHeaders(), cancellations);

    ui.alert('Pull complete / Hoan tat',
      'EN: ' + merged.length + ' enrollments, ' + events.length + ' events loaded.\\n' +
      'VI: Da tai ' + merged.length + ' dang ky, ' + events.length + ' su kien.',
      ui.ButtonSet.OK);
  } catch(err) { ui.alert('Pull failed', err.message, ui.ButtonSet.OK); }
}

// ── Push To App ───────────────────────────────────────────────────────────────

function pushToApp() {
  var ui     = SpreadsheetApp.getUi();
  var props  = PropertiesService.getScriptProperties();
  var appUrl = props.getProperty('APP_URL');
  var apiKey = props.getProperty('API_KEY');
  if (!appUrl || !apiKey) {
    ui.alert('Not configured', 'EN: Run MUSE INC Sync > Settings > Setup App Connection first.\\nVI: Chay MUSE INC Sync > Settings > Setup App Connection truoc.', ui.ButtonSet.OK);
    return;
  }
  try {
    var enrollments = readSheetRows(MASTER_SHEET);
    var events      = readSheetRows(EVENTS_SHEET, true);
    var r1 = UrlFetchApp.fetch(appUrl + '/_api/sheets/import', { method: 'post', headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }, payload: JSON.stringify({ json: { table: 'flattenedEnrollments', rows: enrollments } }), muteHttpExceptions: true });
    if (r1.getResponseCode() !== 200) throw new Error('Enrollments push failed: ' + r1.getContentText());
    var r2 = UrlFetchApp.fetch(appUrl + '/_api/sheets/import', { method: 'post', headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }, payload: JSON.stringify({ json: { table: 'events', rows: events } }), muteHttpExceptions: true });
    if (r2.getResponseCode() !== 200) throw new Error('Events push failed: ' + r2.getContentText());
    var calId = props.getProperty('CALENDAR_ID');
    if (calId) {
      var choice = ui.alert('Push complete / Hoan tat',
        'EN: ' + enrollments.length + ' enrollments and ' + events.length + ' events sent. Sync to Google Calendar now?\\n' +
        'VI: Da gui ' + enrollments.length + ' dang ky va ' + events.length + ' su kien. Dong bo Google Calendar?',
        ui.ButtonSet.YES_NO);
      if (choice === ui.Button.YES) { syncToCalendar(); syncEventsToCalendar(); }
    } else {
      ui.alert('Push complete / Hoan tat',
        'EN: ' + enrollments.length + ' enrollments and ' + events.length + ' events sent.\\n' +
        'VI: Da gui ' + enrollments.length + ' dang ky va ' + events.length + ' su kien.',
        ui.ButtonSet.OK);
    }
  } catch(err) { ui.alert('Push failed', err.message, ui.ButtonSet.OK); }
}

// ── Google Calendar Sync ──────────────────────────────────────────────────────

function syncToCalendar() {
  var ui    = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var calId = props.getProperty('CALENDAR_ID');
  var appUrl = props.getProperty('APP_URL') || '';
  var apiKey = props.getProperty('API_KEY') || '';
  if (!calId) { ui.alert('No calendar', 'Run MUSE INC Sync > Settings > Setup Google Calendar first.', ui.ButtonSet.OK); return; }
  var calendar = CalendarApp.getCalendarById(calId);
  if (!calendar) { ui.alert('Calendar not found', 'Run Setup Google Calendar again.', ui.ButtonSet.OK); return; }

  var rows = readSheetRows(MASTER_SHEET);
  var created = 0, updated = 0;

  rows.forEach(function(row) {
    var sName = row.studentName || 'Unknown', sEmail = row.email || '';
    var cName = row.courseName  || 'Unknown', iName  = row.instructorName || '', iEmail = row.instructorEmail || '';
    var eId   = row.enrollmentId;
    for (var i = 1; i <= MAX_LESSONS; i++) {
      var dtVal = row['lesson'+i+'DateTime']; if (!dtVal) continue;
      var lessonInstr = row['lesson'+i+'Instructor'] || iName;
      var start = new Date(dtVal); if (isNaN(start.getTime())) continue;
      var end   = new Date(start.getTime() + LESSON_DURATION * 3600000);
      var tag   = '[muse:'+eId+':'+i+']';
      var title = cName + ' - Lesson ' + i + ' | ' + sName;
      var cancelUrl = (appUrl && apiKey) ? makeCancelLink(appUrl, apiKey, eId, i) : '';
      var lines = ['Student: '+sName, 'Course: '+cName, 'Lesson: '+i+' of '+(row.totalLessons||MAX_LESSONS)];
      if (lessonInstr) lines.push('Instructor: '+lessonInstr);
      if (cancelUrl) lines.push('', 'Cancel: '+cancelUrl);
      lines.push('', tag);
      var guests = [iEmail, sEmail, 'museincproperty@gmail.com'].filter(Boolean);
      var ds = new Date(start); ds.setHours(0,0,0,0);
      var de = new Date(start); de.setHours(23,59,59,999);
      var existing = calendar.getEvents(ds, de).filter(function(ev) { return ev.getDescription().indexOf(tag) !== -1; });
      if (existing.length) {
        var ev = existing[0]; ev.setTitle(title); ev.setTime(start, end); ev.setDescription(lines.join('\\n'));
        var ge = ev.getGuestList().map(function(g) { return g.getEmail(); });
        guests.forEach(function(em) { if (ge.indexOf(em) === -1) ev.addGuest(em); });
        updated++;
      } else {
        var opts = { description: lines.join('\\n') }; if (guests.length) opts.guests = guests.join(',');
        calendar.createEvent(title, start, end, opts); created++;
      }
    }
  });

  ui.alert('Calendar sync complete / Hoan tat',
    'EN: Created '+created+' | Updated '+updated+'\\n'+(created+updated > 0 ? 'Instructors invited as guests.\\n' : 'No scheduled lessons found.\\n')+
    'VI: Da tao '+created+' | Da cap nhat '+updated,
    ui.ButtonSet.OK);
}

function syncEventsToCalendar() {
  var props = PropertiesService.getScriptProperties();
  var calId = props.getProperty('CALENDAR_ID'); if (!calId) return;
  var calendar = CalendarApp.getCalendarById(calId); if (!calendar) return;
  readSheetRows(EVENTS_SHEET, true).forEach(function(row) {
    if (!row.title || !row.startAt) return;
    var start = new Date(row.startAt); if (isNaN(start.getTime())) return;
    var end = row.endAt ? new Date(row.endAt) : new Date(start.getTime() + 7200000);
    var tag = '[muse_event:'+row.id+']';
    var desc = (row.caption || '') + '\\n' + tag;
    var ds = new Date(start); ds.setHours(0,0,0,0); var de = new Date(start); de.setHours(23,59,59,999);
    var ex = calendar.getEvents(ds, de).filter(function(ev) { return ev.getDescription().indexOf(tag) !== -1; });
    if (ex.length) { ex[0].setTitle(row.title); ex[0].setTime(start, end); ex[0].setDescription(desc); }
    else calendar.createEvent(row.title, start, end, { description: desc });
  });
}

// ── In-sheet instructions ─────────────────────────────────────────────────────

function _instructMaster(ss) {
  var sheet = ss.getSheetByName(MASTER_SHEET);
  if (!sheet) return;
  if (String(sheet.getRange(1,1).getValue()).indexOf('MASTER ENROLLMENTS') !== -1) return;
  sheet.insertRowsBefore(1, 3);

  sheet.getRange(1,1,1,12).merge()
    .setValue('MASTER ENROLLMENTS  |  QUAN LY DANG KY HOC')
    .setBackground(C.navy).setFontColor(C.white).setFontWeight('bold').setFontSize(13)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 44);

  sheet.getRange(2,1,1,12).merge()
    .setValue(
      'EN: WORKFLOW: 1. Pull From App  2. Type instructor email in blue instructorEmail column (say YES to fill all lessons)  ' +
      '3. To change one lesson only - edit that lesson instructor cell directly (turns yellow)  ' +
      '4. Enter lesson dates in lessonNDateTime columns (format: dd/mm/yy 9:00am)  5. Push To App\\n' +
      'VI: QUY TRINH: 1. Pull From App  2. Nhap email giang vien vao cot instructorEmail mau xanh (nhan YES de dien tat ca)  ' +
      '3. De thay doi mot buoi - chinh sua o giang vien buoi do truc tiep (chuyen vang)  ' +
      '4. Nhap ngay gio vao cot lessonNDateTime (dinh dang: dd/mm/yy 9:00am)  5. Push To App'
    )
    .setBackground(C.stepsYel).setFontColor(C.stepsText).setFontSize(10).setWrap(true).setVerticalAlignment('middle');
  sheet.setRowHeight(2, 70);

  sheet.getRange(3,1,1,12).merge()
    .setValue(
      'EN: Blue columns = instructor fields (edit these)  |  lessonNDateTime = lesson date/time  |  ' +
      'lessonNInstructor = leave blank for default, type to override one lesson (turns yellow)  |  lessonNStatus = do NOT edit (set by app)\\n' +
      'VI: Cot xanh = truong giang vien (chinh sua o day)  |  lessonNDateTime = ngay gio buoi hoc  |  ' +
      'lessonNInstructor = de trong cho mac dinh, nhap ten de thay doi mot buoi (chuyen vang)  |  lessonNStatus = KHONG chinh sua'
    )
    .setBackground(C.guideBlue).setFontColor(C.guideText).setFontSize(10).setWrap(true).setVerticalAlignment('middle');
  sheet.setRowHeight(3, 60);

  sheet.setFrozenRows(4);
}

function _instructEvents(ss) {
  var sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) return;
  if (String(sheet.getRange(1,1).getValue()).indexOf('EVENTS') !== -1) return;
  sheet.insertRowsBefore(1, 2);

  sheet.getRange(1,1,1,7).merge()
    .setValue('EVENTS  |  SU KIEN')
    .setBackground(C.navy).setFontColor(C.white).setFontWeight('bold').setFontSize(13)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 44);

  sheet.getRange(2,1,1,7).merge()
    .setValue(
      'EN: title=event name | caption=short description | flyerUrl=image URL (https://...) | ' +
      'startAt/endAt=date time (dd/mm/yy h:mmam/pm e.g. 25/04/26 07:00pm) leave endAt blank for 2hr default | isActive=TRUE to show, FALSE to hide\\n' +
      'VI: title=ten su kien | caption=mo ta ngan | flyerUrl=link anh (https://...) | ' +
      'startAt/endAt=ngay gio (dd/mm/yy h:mmam/pm vd: 25/04/26 07:00pm) de trong endAt=mac dinh 2 gio | isActive=TRUE hien thi, FALSE an di'
    )
    .setBackground(C.stepsYel).setFontColor(C.stepsText).setFontSize(10).setWrap(true).setVerticalAlignment('middle');
  sheet.setRowHeight(2, 70);
  sheet.setFrozenRows(2);
}

// ── Sheet read/write helpers ──────────────────────────────────────────────────

function buildEnrollmentHeaders() {
  var h = ['enrollmentId','userId','courseId','studentName','phone','email',
           'courseName','totalLessons','enrollmentStatus','instructorId','instructorName','instructorEmail'];
  for (var i = 1; i <= MAX_LESSONS; i++) h.push('lesson'+i+'DateTime','lesson'+i+'Instructor','lesson'+i+'Status');
  return h;
}
function buildEventHeaders() { return ['id','title','caption','flyerUrl','startAt','endAt','isActive']; }
function buildCancellationHeaders() { return ['enrollmentId','lessonNumber','studentName','studentEmail','courseName','scheduledAt','cancelledAt','hoursNotice','isLate']; }
function isDateTimeHeader(h) { return /^lesson\\d+DateTime$/.test(h) || ['startAt','endAt','scheduledAt','cancelledAt'].indexOf(h) !== -1; }

function writeSheetRows(sheetName, headers, rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  var dateIdxs = []; headers.forEach(function(h,i) { if (isDateTimeHeader(h)) dateIdxs.push(i); });
  var values = [headers];
  rows.forEach(function(row) {
    values.push(headers.map(function(h,i) {
      var raw = row[h];
      if (dateIdxs.indexOf(i) !== -1 && raw && typeof raw === 'string') { var d = new Date(raw); if (!isNaN(d.getTime())) return d; }
      return normalizeCell(raw);
    }));
  });
  sheet.clear();
  sheet.getRange(1,1,values.length,headers.length).setValues(values);
  if (values.length > 1) dateIdxs.forEach(function(idx) { sheet.getRange(2,idx+1,values.length-1,1).setNumberFormat('dd/mm/yy h:mm am/pm'); });
  sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground(C.navy).setFontColor(C.white);
  sheet.setFrozenRows(1);
  ['instructorId','instructorName','instructorEmail'].forEach(function(col) {
    var idx = headers.indexOf(col); if (idx >= 0 && values.length > 1) sheet.getRange(2,idx+1,values.length-1,1).setBackground(C.instrBlue);
  });
  for (var r = 2; r < values.length; r++) sheet.getRange(r+1,1,1,headers.length).setBackground(r%2===0 ? C.altRow : C.white);
  sheet.autoResizeColumns(1, headers.length);
}

function readSheetRows(sheetName, allowMissing) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) { if (allowMissing) return []; throw new Error('Sheet not found: ' + sheetName); }
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(String), rows = [];
  for (var i = 1; i < data.length; i++) {
    var obj = {}, hasData = false;
    for (var c = 0; c < headers.length; c++) {
      var key = headers[c]; if (!key) continue;
      var val = data[i][c];
      if (val instanceof Date) val = val.toISOString();
      if (val === '') val = null;
      obj[key] = val;
      if (val !== null && val !== undefined) hasData = true;
    }
    if (hasData) rows.push(obj);
  }
  return rows;
}

function normalizeCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return v.toISOString();
  return v;
}

function parseSuperJSON(text) { var r = JSON.parse(text); return (r && r.json) ? r.json : r; }

function makeCancelLink(appUrl, apiKey, enrollmentId, lessonNumber) {
  var msg  = enrollmentId + ':' + lessonNumber;
  var hmac = Utilities.computeHmacSha256Signature(Utilities.newBlob(msg).getBytes(), Utilities.newBlob(apiKey).getBytes());
  var sig  = hmac.map(function(b) { return ('0'+(b<0?b+256:b).toString(16)).slice(-2); }).join('');
  return appUrl + '/_api/lessons/cancel?e=' + enrollmentId + '&l=' + lessonNumber + '&sig=' + sig;
}
`;

export async function handle(_request: Request) {
  try {
    return new Response(GOOGLE_APPS_SCRIPT_CONTENT, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Error serving script:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
