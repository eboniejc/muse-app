import { schema } from "./script_GET.schema";

const GOOGLE_APPS_SCRIPT_CONTENT = `/**
 * MUSE INC - Google Sheets Manager (English + Vietnamese)
 * ==========================================================
 * FIRST TIME SETUP:
 *   1. Paste this entire file into Extensions > Apps Script (replace everything)
 *   2. Save (Ctrl+S)
 *   3. Select "addSheetInstructions" in the function dropdown, click Run
 *   4. Accept permissions when prompted
 *   5. Go back to the sheet, use MUSE INC Sync > Settings > Setup App Connection
 *   6. Use Pull From App to load your data
 */

// ── Constants ─────────────────────────────────────────────────────────────────

var MASTER_SHEET    = 'MasterEnrollments';
var EVENTS_SHEET    = 'Events';
var CAL_SHEET       = 'Monthly Calendar';
var AUDIT_SHEET     = 'Audit';
var MAX_LESSONS     = 16;
var CALENDAR_NAME   = 'MUSE INC Schedule';
var LESSON_DURATION = 1; // hours — change to 1.5 or 2 if needed

// Column positions in MasterEnrollments (1-indexed)
var COL_INSTRUCTOR_NAME  = 11;
var COL_INSTRUCTOR_EMAIL = 12;
var COL_LESSON1_DATE     = 13; // +3 per lesson
var COL_LESSON1_INSTR    = 14; // +3 per lesson
var COL_LESSON1_STATUS   = 15; // +3 per lesson

var COLOUR = {
  headerBg:     '#1a2744',
  headerText:   '#ffffff',
  subHeaderBg:  '#2c3e6b',
  instructorBg: '#e8f4fd',
  overrideBg:   '#fff3cd',
  assignedBg:   '#d4edda',
  altRowBg:     '#f7f9ff',
  calLessonBg:  '#ddeeff',
  stepsRowBg:   '#fffbe6',
  stepsRowText: '#5a4000',
  guideRowBg:   '#eef3ff',
  guideRowText: '#1a2744',
};

// ── Menu ──────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MUSE INC Sync')
    .addItem('\\u2B07  Pull From App',           'pullFromApp')
    .addItem('\\u2B06  Push To App',             'pushToApp')
    .addItem('\\uD83D\\uDCC5  Sync to Google Calendar', 'syncToCalendar')
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu('\\u2699  Settings')
        .addItem('Setup App Connection',  'setup')
        .addItem('Setup Google Calendar', 'setupCalendar')
    )
    .addToUi();
}

// ── onEdit ────────────────────────────────────────────────────────────────────

function onEdit(e) {
  var sheet = e.range.getSheet();
  var name  = sheet.getName();
  var col   = e.range.getColumn();
  var row   = e.range.getRow();

  if (name === MASTER_SHEET) {
    if (row < 2) return;
    if (col === COL_INSTRUCTOR_EMAIL) {
      handleInstructorAssignment(sheet, row, e.value);
      return;
    }
    for (var i = 0; i < MAX_LESSONS; i++) {
      if (col === COL_LESSON1_INSTR + (i * 3)) {
        if (e.value) {
          e.range.setBackground(COLOUR.overrideBg).setNote(
            'EN: Instructor override - this lesson has a different instructor than the student default.\\n' +
            'To revert: clear this cell, re-enter the default email in instructorEmail column.\\n\\n' +
            'VI: Giang vien duoc thay the - buoi hoc nay co giang vien khac mac dinh.\\n' +
            'De hoan tac: xoa o nay, nhap lai email mac dinh vao cot instructorEmail.'
          );
        } else {
          e.range.setBackground(null).clearNote();
        }
        return;
      }
    }
    for (var i = 0; i < MAX_LESSONS; i++) {
      if (col === COL_LESSON1_DATE + (i * 3)) {
        e.range.setNumberFormat('dd/mm/yy h:mm am/pm');
        return;
      }
    }
    return;
  }

  if (name === CAL_SHEET && row === 5 && (col === 2 || col === 4)) {
    renderMonthCalendarFromCells(sheet);
    return;
  }

  if (name === AUDIT_SHEET && row === 5 && (col === 2 || col === 4)) {
    renderAuditFromCells(sheet);
    return;
  }
}

// ── Instructor Assignment ─────────────────────────────────────────────────────

function handleInstructorAssignment(sheet, row, newEmail) {
  if (!newEmail) return;
  var instructorName = sheet.getRange(row, COL_INSTRUCTOR_NAME).getValue();
  var studentName    = sheet.getRange(row, 4).getValue();
  var label          = instructorName || newEmail;

  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    'EN: Apply instructor to all lessons? / VI: Ap dung giang vien cho tat ca buoi hoc?',
    'EN: Assign ' + label + ' to all empty lesson slots' +
      (studentName ? ' for ' + studentName : '') + '?\\n' +
    '  YES - fills every empty lesson instructor slot on this row\\n' +
    '  NO  - only updates the default; lesson slots stay as they are\\n\\n' +
    'VI: Phan cong ' + label + ' cho tat ca o giang vien con trong' +
      (studentName ? ' cua ' + studentName : '') + '?\\n' +
    '  YES - dien vao tat ca o giang vien con trong tren hang nay\\n' +
    '  NO  - chi cap nhat giang vien mac dinh; cac o buoi hoc giu nguyen',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  var filled = 0;
  for (var i = 0; i < MAX_LESSONS; i++) {
    var cell = sheet.getRange(row, COL_LESSON1_INSTR + (i * 3));
    if (!cell.getValue()) {
      cell.setValue(instructorName || newEmail)
          .setBackground(COLOUR.assignedBg)
          .setNote(
            'EN: Auto-filled from instructorEmail on ' + new Date().toLocaleDateString() + '\\n' +
            'VI: Tu dong dien tu instructorEmail vao ' + new Date().toLocaleDateString()
          );
      filled++;
    }
  }

  if (filled === 0) {
    ui.alert(
      'EN: No empty slots / VI: Khong co o trong',
      'EN: All lesson instructor cells already have a value. Edit individual cells to override.\\n\\n' +
      'VI: Tat ca o giang vien buoi hoc da co gia tri. Chinh sua tung o de thay doi rieng le.',
      ui.ButtonSet.OK
    );
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────

function setup() {
  var ui    = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  var urlRes = ui.prompt(
    'Setup (1/2)',
    'EN: Enter your Muse App URL (e.g. https://myapp.example.com)\\n' +
    'VI: Nhap URL ung dung Muse cua ban',
    ui.ButtonSet.OK_CANCEL
  );
  if (urlRes.getSelectedButton() !== ui.Button.OK) return;

  var keyRes = ui.prompt(
    'Setup (2/2)',
    'EN: Enter your API Key\\nVI: Nhap API Key cua ban',
    ui.ButtonSet.OK_CANCEL
  );
  if (keyRes.getSelectedButton() !== ui.Button.OK) return;

  props.setProperty('APP_URL', urlRes.getResponseText().trim().replace(/\\/$/, ''));
  props.setProperty('API_KEY', keyRes.getResponseText().trim());

  ui.alert(
    'Setup complete / Thiet lap hoan tat',
    'EN: App URL and API key saved. You can now use Pull From App and Push To App.\\n\\n' +
    'VI: URL va API key da duoc luu. Ban co the dung Pull From App va Push To App.',
    ui.ButtonSet.OK
  );
}

function setupCalendar() {
  var ui    = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var cals  = CalendarApp.getCalendarsByName(CALENDAR_NAME);
  var isNew = cals.length === 0;
  var cal   = isNew
    ? CalendarApp.createCalendar(CALENDAR_NAME, {
        color: CalendarApp.Color.TEAL,
        summary: 'MUSE INC lesson schedule - auto-synced from the scheduling spreadsheet',
      })
    : cals[0];

  props.setProperty('CALENDAR_ID', cal.getId());

  ui.alert(
    (isNew ? 'Calendar created' : 'Calendar connected') + ' / Da ket noi lich',
    'EN: Calendar: ' + CALENDAR_NAME + '\\n' +
    'Share with instructors: Google Calendar > three-dot menu > Settings and sharing > Share with specific people.\\n\\n' +
    'VI: Lich: ' + CALENDAR_NAME + '\\n' +
    'Chia se voi giang vien: Google Calendar > menu ba cham > Cai dat va chia se > Chia se voi nguoi cu the.',
    ui.ButtonSet.OK
  );
}

// ── Pull From App ─────────────────────────────────────────────────────────────

function pullFromApp() {
  var ui     = SpreadsheetApp.getUi();
  var props  = PropertiesService.getScriptProperties();
  var appUrl = props.getProperty('APP_URL');
  var apiKey = props.getProperty('API_KEY');

  if (!appUrl || !apiKey) {
    ui.alert(
      'Not configured / Chua thiet lap',
      'EN: Please run MUSE INC Sync > Settings > Setup App Connection first.\\n' +
      'VI: Vui long chay MUSE INC Sync > Settings > Setup App Connection truoc.',
      ui.ButtonSet.OK
    );
    return;
  }

  try {
    var existingById = {};
    try {
      readSheetRows(MASTER_SHEET).forEach(function(r) {
        if (r.enrollmentId) existingById[String(r.enrollmentId)] = r;
      });
    } catch(e) {}

    var response = UrlFetchApp.fetch(appUrl + '/_api/sheets/export', {
      method: 'post',
      headers: { 'x-api-key': apiKey },
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      throw new Error('Export failed ' + response.getResponseCode() + ': ' + response.getContentText());
    }

    var parsed        = parseSuperJSON(response.getContentText());
    var enrollments   = (parsed && parsed.data && parsed.data.flattenedEnrollments) || [];
    var events        = (parsed && parsed.data && parsed.data.events)               || [];
    var cancellations = (parsed && parsed.data && parsed.data.lessonCancellations)  || [];

    var PRESERVE = ['instructorId', 'instructorName', 'instructorEmail'];
    var merged = enrollments.map(function(row) {
      var ex = existingById[String(row.enrollmentId || '')];
      if (!ex) return row;
      var out = {};
      Object.keys(row).forEach(function(k) { out[k] = row[k]; });
      PRESERVE.forEach(function(f) { if (!out[f] && ex[f]) out[f] = ex[f]; });
      for (var i = 1; i <= MAX_LESSONS; i++) {
        var dt  = 'lesson' + i + 'DateTime';
        var ins = 'lesson' + i + 'Instructor';
        var st  = 'lesson' + i + 'Status';
        if (dt in ex)             out[dt]  = ex[dt];
        if (!out[ins] && ex[ins]) out[ins] = ex[ins];
        if (!out[st]  && ex[st])  out[st]  = ex[st];
      }
      return out;
    });

    writeSheetRows(MASTER_SHEET, buildEnrollmentHeaders(), merged);
    writeSheetRows(EVENTS_SHEET, buildEventHeaders(), events);
    if (cancellations.length > 0) writeSheetRows('Cancellations', buildCancellationHeaders(), cancellations);

    addSheetInstructions();

    ui.alert(
      'Pull complete / Tai du lieu hoan tat',
      'EN: ' + merged.length + ' enrollment(s) and ' + events.length + ' event(s) loaded.\\n' +
      'Next: assign instructors in the instructorEmail column, enter lesson dates, then Push To App.\\n\\n' +
      'VI: Da tai ' + merged.length + ' dang ky va ' + events.length + ' su kien.\\n' +
      'Tiep theo: phan cong giang vien o cot instructorEmail, nhap ngay buoi hoc, roi Push To App.',
      ui.ButtonSet.OK
    );
  } catch(err) {
    ui.alert('Pull failed / Tai that bai', err.message, ui.ButtonSet.OK);
  }
}

// ── Push To App ───────────────────────────────────────────────────────────────

function pushToApp() {
  var ui     = SpreadsheetApp.getUi();
  var props  = PropertiesService.getScriptProperties();
  var appUrl = props.getProperty('APP_URL');
  var apiKey = props.getProperty('API_KEY');

  if (!appUrl || !apiKey) {
    ui.alert(
      'Not configured / Chua thiet lap',
      'EN: Please run MUSE INC Sync > Settings > Setup App Connection first.\\n' +
      'VI: Vui long chay MUSE INC Sync > Settings > Setup App Connection truoc.',
      ui.ButtonSet.OK
    );
    return;
  }

  try {
    var enrollments = readSheetRows(MASTER_SHEET);
    var events      = readSheetRows(EVENTS_SHEET, true);

    var enrollRes = UrlFetchApp.fetch(appUrl + '/_api/sheets/import', {
      method: 'post',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ json: { table: 'flattenedEnrollments', rows: enrollments } }),
      muteHttpExceptions: true,
    });
    if (enrollRes.getResponseCode() !== 200) {
      throw new Error('Enrollments push failed ' + enrollRes.getResponseCode() + ': ' + enrollRes.getContentText());
    }

    var eventsRes = UrlFetchApp.fetch(appUrl + '/_api/sheets/import', {
      method: 'post',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ json: { table: 'events', rows: events } }),
      muteHttpExceptions: true,
    });
    if (eventsRes.getResponseCode() !== 200) {
      throw new Error('Events push failed ' + eventsRes.getResponseCode() + ': ' + eventsRes.getContentText());
    }

    var calendarId = props.getProperty('CALENDAR_ID');
    if (calendarId) {
      var choice = ui.alert(
        'Push complete / Day du lieu hoan tat',
        'EN: ' + enrollments.length + ' enrollment(s) and ' + events.length + ' event(s) sent.\\n' +
        'Also sync to Google Calendar now?\\n\\n' +
        'VI: Da gui ' + enrollments.length + ' dang ky va ' + events.length + ' su kien.\\n' +
        'Dong bo len Google Calendar ngay bay gio khong?',
        ui.ButtonSet.YES_NO
      );
      if (choice === ui.Button.YES) { syncToCalendar(); syncEventsToCalendar(); }
    } else {
      ui.alert(
        'Push complete / Day du lieu hoan tat',
        'EN: ' + enrollments.length + ' enrollment(s) and ' + events.length + ' event(s) sent.\\n' +
        'Tip: Run Settings > Setup Google Calendar to auto-create calendar events.\\n\\n' +
        'VI: Da gui ' + enrollments.length + ' dang ky va ' + events.length + ' su kien.\\n' +
        'Goi y: Chay Settings > Setup Google Calendar de tu dong tao su kien lich.',
        ui.ButtonSet.OK
      );
    }
  } catch(err) {
    ui.alert('Push failed / Day du lieu that bai', err.message, ui.ButtonSet.OK);
  }
}

// ── Google Calendar Sync ──────────────────────────────────────────────────────

function syncToCalendar() {
  var ui         = SpreadsheetApp.getUi();
  var props      = PropertiesService.getScriptProperties();
  var calendarId = props.getProperty('CALENDAR_ID');
  var appUrl     = props.getProperty('APP_URL') || '';
  var apiKey     = props.getProperty('API_KEY') || '';

  if (!calendarId) {
    ui.alert(
      'No calendar / Chua co lich',
      'EN: Please run MUSE INC Sync > Settings > Setup Google Calendar first.\\n' +
      'VI: Vui long chay MUSE INC Sync > Settings > Setup Google Calendar truoc.',
      ui.ButtonSet.OK
    );
    return;
  }

  var calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    ui.alert('Calendar not found', 'Please run Setup Google Calendar again.', ui.ButtonSet.OK);
    return;
  }

  var rows = readSheetRows(MASTER_SHEET);
  var created = 0, updated = 0;

  rows.forEach(function(row) {
    var studentName     = row.studentName     || 'Unknown Student';
    var studentEmail    = row.email           || '';
    var courseName      = row.courseName      || 'Unknown Course';
    var instructorName  = row.instructorName  || '';
    var instructorEmail = row.instructorEmail || '';
    var enrollmentId    = row.enrollmentId;

    for (var i = 1; i <= MAX_LESSONS; i++) {
      var dtVal = row['lesson' + i + 'DateTime'];
      if (!dtVal) continue;
      var lessonInstr = row['lesson' + i + 'Instructor'] || instructorName;
      var start = new Date(dtVal);
      if (isNaN(start.getTime())) continue;

      var end    = new Date(start.getTime() + LESSON_DURATION * 3600000);
      var tag    = '[muse:' + enrollmentId + ':' + i + ']';
      var title  = courseName + ' - Lesson ' + i + ' | ' + studentName;
      var cancelUrl = (appUrl && apiKey) ? makeCancelLink(appUrl, apiKey, enrollmentId, i) : '';

      var lines = [
        'Student: '    + studentName,
        'Course: '     + courseName,
        'Lesson: '     + i + ' of ' + (row.totalLessons || MAX_LESSONS),
      ];
      if (lessonInstr) lines.push('Instructor: ' + lessonInstr);
      if (cancelUrl) {
        lines.push('', 'Need to cancel? / Can huy buoi hoc?', cancelUrl,
          '(>24h: auto-approved | <24h: late cancel fee may apply)');
      }
      lines.push('', tag);

      var guests = [instructorEmail, studentEmail].filter(Boolean);
      var dayStart = new Date(start); dayStart.setHours(0,0,0,0);
      var dayEnd   = new Date(start); dayEnd.setHours(23,59,59,999);

      var existing = calendar.getEvents(dayStart, dayEnd).filter(function(ev) {
        return ev.getDescription().indexOf(tag) !== -1;
      });

      if (existing.length > 0) {
        var ev = existing[0];
        ev.setTitle(title);
        ev.setTime(start, end);
        ev.setDescription(lines.join('\\n'));
        var guestEmails = ev.getGuestList().map(function(g) { return g.getEmail(); });
        guests.forEach(function(em) { if (guestEmails.indexOf(em) === -1) ev.addGuest(em); });
        updated++;
      } else {
        var opts = { description: lines.join('\\n') };
        if (guests.length) opts.guests = guests.join(',');
        calendar.createEvent(title, start, end, opts);
        created++;
      }
    }
  });

  ui.alert(
    'Calendar sync complete / Dong bo lich hoan tat',
    'EN: Created: ' + created + ' | Updated: ' + updated + '\\n' +
    (created + updated > 0
      ? 'Instructors and students have been invited as calendar guests.\\n'
      : 'No scheduled lessons found.\\n') + '\\n' +
    'VI: Da tao: ' + created + ' | Da cap nhat: ' + updated + '\\n' +
    (created + updated > 0
      ? 'Giang vien va hoc vien da duoc moi lam khach trong lich.'
      : 'Khong tim thay buoi hoc nao da len lich.'),
    ui.ButtonSet.OK
  );
}

function syncEventsToCalendar() {
  var props      = PropertiesService.getScriptProperties();
  var calendarId = props.getProperty('CALENDAR_ID');
  if (!calendarId) return;
  var calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) return;

  readSheetRows(EVENTS_SHEET, true).forEach(function(row) {
    if (!row.title || !row.startAt) return;
    var start = new Date(row.startAt);
    if (isNaN(start.getTime())) return;
    var end = row.endAt ? new Date(row.endAt) : new Date(start.getTime() + 7200000);
    var tag = '[muse_event:' + row.id + ']';
    var desc = (row.caption || '') + '\\n' + tag;

    var dayStart = new Date(start); dayStart.setHours(0,0,0,0);
    var dayEnd   = new Date(start); dayEnd.setHours(23,59,59,999);
    var existing = calendar.getEvents(dayStart, dayEnd).filter(function(ev) {
      return ev.getDescription().indexOf(tag) !== -1;
    });

    if (existing.length > 0) {
      existing[0].setTitle(row.title); existing[0].setTime(start, end); existing[0].setDescription(desc);
    } else {
      calendar.createEvent(row.title, start, end, { description: desc });
    }
  });
}

// ── Monthly Calendar Sheet ────────────────────────────────────────────────────

function renderMonthCalendarFromCells(sheet) {
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  var DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  var monthName = String(sheet.getRange('B5').getValue()).trim();
  var month     = MONTHS.indexOf(monthName) + 1;
  var year      = parseInt(sheet.getRange('D5').getValue(), 10);
  if (!month || !year || year < 2000) return;

  var rows = readSheetRows(MASTER_SHEET);
  var lessonsByDay = {};

  rows.forEach(function(row) {
    for (var i = 1; i <= MAX_LESSONS; i++) {
      if ((row['lesson' + i + 'Status'] || '').toLowerCase() === 'cancelled') continue;
      var dtVal = row['lesson' + i + 'DateTime'];
      if (!dtVal) continue;
      var dt = new Date(dtVal);
      if (isNaN(dt.getTime()) || dt.getFullYear() !== year || dt.getMonth() + 1 !== month) continue;

      var key = year + '-' + String(month).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0');
      var h = dt.getHours(), m = dt.getMinutes();
      var timeStr = (h % 12 || 12) + ':' + String(m).padStart(2,'0') + (h >= 12 ? 'pm' : 'am');
      var instr = row['lesson' + i + 'Instructor'] || row.instructorName || '';

      if (!lessonsByDay[key]) lessonsByDay[key] = [];
      lessonsByDay[key].push({ time: timeStr, student: row.studentName || '?', course: row.courseName || '', instructor: instr });
    }
  });

  Object.keys(lessonsByDay).forEach(function(k) {
    lessonsByDay[k].sort(function(a,b) { return a.time < b.time ? -1 : 1; });
  });

  var daysInMonth = new Date(year, month, 0).getDate();
  var startDow    = new Date(year, month - 1, 1).getDay();
  var weeks = [], week = [];
  for (var p = 0; p < startDow; p++) week.push({ day: 0, lessons: [] });
  for (var d = 1; d <= daysInMonth; d++) {
    var key = year + '-' + String(month).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    week.push({ day: d, lessons: lessonsByDay[key] || [] });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  while (week.length > 0 && week.length < 7) week.push({ day: 0, lessons: [] });
  if (week.length === 7) weeks.push(week);

  var lastRow = Math.max(sheet.getLastRow(), 10);
  if (lastRow >= 6) sheet.getRange(6, 1, lastRow - 5, 7).clearContent().clearFormat();

  DAYS.forEach(function(name, col) {
    sheet.getRange(6, col + 1).setValue(name)
      .setBackground(COLOUR.subHeaderBg).setFontColor(COLOUR.headerText)
      .setFontWeight('bold').setHorizontalAlignment('center');
  });
  sheet.setRowHeight(6, 28);

  weeks.forEach(function(wk, wkIdx) {
    var sheetRow   = wkIdx + 7;
    var maxLessons = Math.max.apply(null, wk.map(function(d) { return d.lessons.length; }));
    sheet.setRowHeight(sheetRow, Math.max(72, 36 + maxLessons * 22));

    wk.forEach(function(dayObj, colIdx) {
      var cell = sheet.getRange(sheetRow, colIdx + 1);
      if (dayObj.day === 0) { cell.setBackground('#f8f8f8'); return; }

      var lines = [String(dayObj.day)];
      dayObj.lessons.forEach(function(l) {
        lines.push(l.time + '  ' + l.student);
        if (l.course) lines.push('  ' + l.course + (l.instructor ? ' - ' + l.instructor : ''));
      });

      cell.setValue(lines.join('\\n')).setWrap(true).setVerticalAlignment('top')
          .setBackground(dayObj.lessons.length ? COLOUR.calLessonBg : '#ffffff')
          .setBorder(true,true,true,true,false,false,'#cccccc',SpreadsheetApp.BorderStyle.SOLID);

      try {
        var rt = SpreadsheetApp.newRichTextValue().setText(lines.join('\\n'))
          .setTextStyle(0, String(dayObj.day).length,
            SpreadsheetApp.newTextStyle().setBold(true).setFontSize(11).build()).build();
        cell.setRichTextValue(rt);
      } catch(err) {}
    });
  });

  for (var c = 1; c <= 7; c++) sheet.setColumnWidth(c, 155);
}

// ── Audit Sheet ───────────────────────────────────────────────────────────────

function renderAuditFromCells(sheet) {
  var fromVal = sheet.getRange('B5').getValue();
  var toVal   = sheet.getRange('D5').getValue();
  if (!fromVal || !toVal) return;

  var startDate = new Date(fromVal); startDate.setHours(0,0,0,0);
  var endDate   = new Date(toVal);   endDate.setHours(23,59,59,999);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

  var rows = readSheetRows(MASTER_SHEET);
  var byInstructor = {};

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

  var lastRow = Math.max(sheet.getLastRow(), 10);
  if (lastRow > 5) sheet.getRange(6, 1, lastRow - 5, 5).clearContent().clearFormat();

  var instructors = Object.keys(byInstructor).sort();
  var total = instructors.reduce(function(s,n) { return s + byInstructor[n].length; }, 0);
  var r = 6;

  if (instructors.length === 0) {
    sheet.getRange(r, 1, 1, 5).merge()
      .setValue('EN: No lessons found for this date range.\\nVI: Khong tim thay buoi hoc nao trong khoang thoi gian nay.')
      .setFontStyle('italic').setFontColor('#888888');
    return;
  }

  sheet.getRange(r, 1, 1, 3).setValues([['Instructor / Giang vien','Lessons / So buoi','Period / Khoang thoi gian']])
    .setBackground(COLOUR.subHeaderBg).setFontColor(COLOUR.headerText).setFontWeight('bold');
  sheet.setRowHeight(r, 28); r++;

  var tz = Session.getScriptTimeZone();
  var periodStr = Utilities.formatDate(startDate, tz, 'dd/MM/yyyy') + ' - ' + Utilities.formatDate(endDate, tz, 'dd/MM/yyyy');

  instructors.forEach(function(name) {
    sheet.getRange(r, 1, 1, 3).setValues([[name, byInstructor[name].length, periodStr]])
      .setBackground(r % 2 === 0 ? COLOUR.altRowBg : '#ffffff');
    r++;
  });
  sheet.getRange(r, 1, 1, 2).setValues([['TOTAL / TONG', total]])
    .setFontWeight('bold').setBackground(COLOUR.instructorBg);
  r += 2;

  sheet.getRange(r, 1, 1, 5)
    .setValues([['Instructor / Giang vien','Student / Hoc vien','Course / Khoa hoc','Lesson / Buoi','Date & Time / Ngay gio']])
    .setBackground(COLOUR.subHeaderBg).setFontColor(COLOUR.headerText).setFontWeight('bold');
  sheet.setRowHeight(r, 28); r++;

  instructors.forEach(function(name) {
    var lessons = byInstructor[name].slice().sort(function(a,b) { return a.date - b.date; });
    lessons.forEach(function(l) {
      sheet.getRange(r, 1, 1, 5).setValues([[name, l.student, l.course, 'Lesson ' + l.num, l.date]])
        .setBackground(r % 2 === 0 ? COLOUR.altRowBg : '#ffffff');
      sheet.getRange(r, 5).setNumberFormat('dd/mm/yy h:mm am/pm');
      r++;
    });
    sheet.getRange(r, 1, 1, 2).setValues([['Subtotal: ' + name, lessons.length]])
      .setFontWeight('bold').setBackground(COLOUR.instructorBg);
    r++;
  });

  sheet.autoResizeColumns(1, 5);
}

// ── In-Sheet Bilingual Instructions ──────────────────────────────────────────

function addSheetInstructions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  _instructMaster(ss);
  _instructCalendar(ss);
  _instructAudit(ss);
  _instructEvents(ss);
  try {
    SpreadsheetApp.getUi().alert(
      'Instructions added! / Da them huong dan!',
      'EN: Bilingual instructions added to each sheet tab.\\n' +
      'Yellow rows = workflow steps | Blue rows = column guide\\n' +
      'All rows are frozen so they stay visible while scrolling.\\n\\n' +
      'VI: Huong dan song ngu da them vao moi tab.\\n' +
      'Hang vang = cac buoc thuc hien | Hang xanh = huong dan cot\\n' +
      'Tat ca hang duoc co dinh de luon hien thi khi cuon trang.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch(e) {}
}

function _styleRow(range, type) {
  var styles = {
    title: { bg: COLOUR.headerBg,    fg: COLOUR.headerText,   size: 13, bold: true  },
    steps: { bg: COLOUR.stepsRowBg,  fg: COLOUR.stepsRowText, size: 10, bold: false },
    guide: { bg: COLOUR.guideRowBg,  fg: COLOUR.guideRowText, size: 10, bold: false },
  };
  var s = styles[type] || styles.guide;
  range.setBackground(s.bg).setFontColor(s.fg).setFontSize(s.size)
    .setFontWeight(s.bold ? 'bold' : 'normal').setWrap(true).setVerticalAlignment('middle');
}

function _instructMaster(ss) {
  var sheet = ss.getSheetByName(MASTER_SHEET);
  if (!sheet) return;
  if (String(sheet.getRange(1,1).getValue()).indexOf('MASTER ENROLLMENTS') !== -1) return;

  sheet.insertRowsBefore(1, 4);

  var r1 = sheet.getRange(1, 1, 1, 12);
  r1.merge().setValue('MASTER ENROLLMENTS  |  QUAN LY DANG KY HOC');
  _styleRow(r1, 'title');
  sheet.setRowHeight(1, 44);

  var r2 = sheet.getRange(2, 1, 1, 12);
  r2.merge().setValue(
    'EN: This sheet manages all student enrollments, instructor assignments, and lesson schedules for the Muse app.\\n' +
    'VI: Trang nay quan ly tat ca dang ky hoc vien, phan cong giang vien va lich buoi hoc trong ung dung Muse.'
  );
  _styleRow(r2, 'steps');
  sheet.setRowHeight(2, 52);

  var r3 = sheet.getRange(3, 1, 1, 12);
  r3.merge().setValue(
    'EN: WORKFLOW:\\n' +
    '  1. Click MUSE INC Sync > Pull From App to load the latest student list\\n' +
    '  2. Find a student row, type the instructor email in the blue instructorEmail column\\n' +
    '     > The sheet will ask: apply to ALL lessons for this student? Click YES to fill all slots at once\\n' +
    '  3. To change the instructor for ONE lesson only > edit that lesson instructor cell directly (turns YELLOW)\\n' +
    '  4. Enter lesson dates in the lessonNDateTime columns  (format: dd/mm/yy 9:00am)\\n' +
    '  5. Click Push To App to save changes  >  Optionally Sync to Google Calendar to invite instructors\\n\\n' +
    'VI: QUY TRINH:\\n' +
    '  1. Nhan MUSE INC Sync > Pull From App de tai danh sach hoc vien moi nhat\\n' +
    '  2. Tim hang hoc vien, nhap email giang vien vao cot instructorEmail mau xanh\\n' +
    '     > Bang se hoi: ap dung cho TAT CA buoi hoc khong? Nhan YES de dien tat ca cung luc\\n' +
    '  3. De thay doi giang vien CHI cho mot buoi hoc > chinh sua o giang vien buoi do truc tiep (o chuyen VANG)\\n' +
    '  4. Nhap ngay gio buoi hoc vao cot lessonNDateTime  (dinh dang: dd/mm/yy 9:00am)\\n' +
    '  5. Nhan Push To App de luu thay doi  >  Tuy chon Sync to Google Calendar de moi giang vien'
  );
  _styleRow(r3, 'steps');
  sheet.setRowHeight(3, 195);

  var r4 = sheet.getRange(4, 1, 1, 12);
  r4.merge().setValue(
    'EN: COLUMN GUIDE:  ' +
    'Blue columns (instructorId, instructorName, instructorEmail) = edit these to assign instructors  |  ' +
    'lessonNDateTime = date and time of lesson N  format: dd/mm/yy h:mmam/pm  e.g. 25/04/26 10:00am  |  ' +
    'lessonNInstructor = leave BLANK for default instructor, or type here to OVERRIDE for that one lesson (turns yellow)  |  ' +
    'lessonNStatus = updated automatically by the app - do NOT edit manually\\n' +
    'VI: HUONG DAN COT:  ' +
    'Cot mau xanh (instructorId, instructorName, instructorEmail) = chinh sua de phan cong giang vien  |  ' +
    'lessonNDateTime = ngay gio buoi hoc N  dinh dang: dd/mm/yy h:mmam/pm  vd: 25/04/26 10:00am  |  ' +
    'lessonNInstructor = de TRONG de dung giang vien mac dinh, hoac nhap ten de DAT RIENG cho buoi do (o chuyen vang)  |  ' +
    'lessonNStatus = cap nhat tu dong boi ung dung - KHONG chinh sua thu cong'
  );
  _styleRow(r4, 'guide');
  sheet.setRowHeight(4, 80);

  sheet.setFrozenRows(5);
}

function _instructCalendar(ss) {
  var sheet = ss.getSheetByName(CAL_SHEET);
  if (!sheet) sheet = ss.insertSheet(CAL_SHEET);
  if (String(sheet.getRange(1,1).getValue()).indexOf('MONTHLY CALENDAR') !== -1) return;

  sheet.insertRowsBefore(1, 4);

  var r1 = sheet.getRange(1, 1, 1, 7);
  r1.merge().setValue('MONTHLY CALENDAR  |  LICH THANG');
  _styleRow(r1, 'title');
  sheet.setRowHeight(1, 44);

  var r2 = sheet.getRange(2, 1, 1, 7);
  r2.merge().setValue(
    'EN: A visual monthly lesson schedule. Days highlighted in blue have lessons. Each day shows lesson time, student name, course, and instructor.\\n' +
    'VI: Lich buoi hoc truc quan theo thang. Ngay co buoi hoc duoc to mau xanh. Moi ngay hien thi gio hoc, ten hoc vien, khoa hoc va giang vien.'
  );
  _styleRow(r2, 'steps');
  sheet.setRowHeight(2, 64);

  var r3 = sheet.getRange(3, 1, 1, 7);
  r3.merge().setValue(
    'EN: HOW TO USE:\\n' +
    '  1. Click cell B5 > choose a month from the dropdown > calendar rebuilds automatically\\n' +
    '  2. Click cell D5 > type a year and press Enter > calendar rebuilds automatically\\n' +
    '  No button or menu needed - just change the month or year cell below\\n\\n' +
    'VI: CACH SU DUNG:\\n' +
    '  1. Nhan o B5 > chon thang tu danh sach > lich tu dong cap nhat\\n' +
    '  2. Nhan o D5 > nhap nam roi nhan Enter > lich tu dong cap nhat\\n' +
    '  Khong can nhan nut hay vao menu - chi can thay doi o thang hoac nam ben duoi'
  );
  _styleRow(r3, 'guide');
  sheet.setRowHeight(3, 120);

  sheet.getRange(4, 1).setValue('Month / Thang:').setFontWeight('bold');
  sheet.getRange(4, 3).setValue('Year / Nam:').setFontWeight('bold');
  sheet.getRange(4, 5).setValue('Change these cells to update the calendar  |  Thay doi o nay de cap nhat lich')
    .setFontColor('#888888').setFontStyle('italic');
  sheet.setRowHeight(4, 28);

  var now    = new Date();
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  var rule   = SpreadsheetApp.newDataValidation()
    .requireValueInList(MONTHS, true)
    .setHelpText('EN: Pick a month  |  VI: Chon thang').build();

  sheet.getRange('B5').setDataValidation(rule).setValue(MONTHS[now.getMonth()])
    .setFontWeight('bold').setFontSize(12)
    .setNote('EN: Change this to switch month - calendar updates automatically.\\nVI: Thay doi de doi thang - lich tu dong cap nhat.');
  sheet.getRange('D5').setValue(now.getFullYear()).setFontWeight('bold').setFontSize(12)
    .setNumberFormat('0')
    .setNote('EN: Change this to switch year - calendar updates automatically.\\nVI: Thay doi de doi nam - lich tu dong cap nhat.');

  sheet.setFrozenRows(5);
  for (var c = 1; c <= 7; c++) sheet.setColumnWidth(c, 155);

  renderMonthCalendarFromCells(sheet);
}

function _instructAudit(ss) {
  var sheet = ss.getSheetByName(AUDIT_SHEET);
  if (!sheet) sheet = ss.insertSheet(AUDIT_SHEET);
  if (String(sheet.getRange(1,1).getValue()).indexOf('INSTRUCTOR AUDIT') !== -1) return;

  sheet.insertRowsBefore(1, 4);

  var r1 = sheet.getRange(1, 1, 1, 5);
  r1.merge().setValue('INSTRUCTOR AUDIT  |  BAO CAO GIANG VIEN');
  _styleRow(r1, 'title');
  sheet.setRowHeight(1, 44);

  var r2 = sheet.getRange(2, 1, 1, 5);
  r2.merge().setValue(
    'EN: Shows how many lessons each instructor taught in a date range, with a full lesson-by-lesson breakdown. Cancelled lessons are excluded.\\n' +
    'VI: Hien thi so buoi hoc moi giang vien da day trong khoang thoi gian chon, kem chi tiet tung buoi. Buoi hoc da huy tu dong duoc loai tru.'
  );
  _styleRow(r2, 'steps');
  sheet.setRowHeight(2, 64);

  var r3 = sheet.getRange(3, 1, 1, 5);
  r3.merge().setValue(
    'EN: HOW TO USE:\\n' +
    '  1. Click cell B5 > enter the FROM date  (format: dd/mm/yyyy  e.g. 01/04/2026)\\n' +
    '  2. Click cell D5 > enter the TO date    (format: dd/mm/yyyy  e.g. 30/04/2026)\\n' +
    '  The report appears automatically - no button needed. Change either date to refresh instantly.\\n\\n' +
    'VI: CACH SU DUNG:\\n' +
    '  1. Nhan o B5 > nhap ngay BAT DAU  (dinh dang: dd/mm/yyyy  vi du: 01/04/2026)\\n' +
    '  2. Nhan o D5 > nhap ngay KET THUC  (dinh dang: dd/mm/yyyy  vi du: 30/04/2026)\\n' +
    '  Bao cao tu dong hien thi - khong can nhan nut. Thay doi bat ky ngay nao de lam moi ngay.'
  );
  _styleRow(r3, 'guide');
  sheet.setRowHeight(3, 130);

  sheet.getRange(4, 1).setValue('From / Tu ngay:').setFontWeight('bold');
  sheet.getRange(4, 3).setValue('To / Den ngay:').setFontWeight('bold');
  sheet.getRange(4, 5).setValue('Set date range to generate report  |  Nhap khoang ngay de tao bao cao')
    .setFontColor('#888888').setFontStyle('italic');
  sheet.setRowHeight(4, 28);

  var now          = new Date();
  var firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  var lastOfMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  sheet.getRange('B5').setValue(firstOfMonth).setNumberFormat('dd/mm/yyyy').setFontWeight('bold')
    .setNote('EN: Set start date for the audit period.\\nVI: Nhap ngay bat dau cua khoang bao cao.');
  sheet.getRange('D5').setValue(lastOfMonth).setNumberFormat('dd/mm/yyyy').setFontWeight('bold')
    .setNote('EN: Set end date for the audit period.\\nVI: Nhap ngay ket thuc cua khoang bao cao.');

  sheet.setFrozenRows(5);
  renderAuditFromCells(sheet);
}

function _instructEvents(ss) {
  var sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) return;
  if (String(sheet.getRange(1,1).getValue()).indexOf('EVENTS') !== -1) return;

  sheet.insertRowsBefore(1, 3);

  var r1 = sheet.getRange(1, 1, 1, 7);
  r1.merge().setValue('EVENTS  |  SU KIEN');
  _styleRow(r1, 'title');
  sheet.setRowHeight(1, 44);

  var r2 = sheet.getRange(2, 1, 1, 7);
  r2.merge().setValue(
    'EN: Lists all Muse events (concerts, showcases, workshops, etc.). Use Pull From App to load the latest. Edit here, then Push To App to save.\\n' +
    'VI: Liet ke tat ca su kien Muse (bieu dien, showcase, workshop, v.v.). Dung Pull From App de tai moi nhat. Chinh sua tai day roi Push To App de luu.'
  );
  _styleRow(r2, 'steps');
  sheet.setRowHeight(2, 64);

  var r3 = sheet.getRange(3, 1, 1, 7);
  r3.merge().setValue(
    'EN: COLUMN GUIDE:\\n' +
    '  title    = event name shown in the app\\n' +
    '  caption  = short description shown below the title\\n' +
    '  flyerUrl = paste the full https:// URL of the event flyer image\\n' +
    '  startAt / endAt = date and time  (format: dd/mm/yy h:mmam/pm  e.g. 25/04/26 07:00pm)  |  leave endAt blank for a 2-hour default\\n' +
    '  isActive = TRUE to show event in the app  |  FALSE to hide it\\n\\n' +
    'VI: HUONG DAN COT:\\n' +
    '  title    = ten su kien hien thi trong ung dung\\n' +
    '  caption  = mo ta ngan hien thi ben duoi tieu de\\n' +
    '  flyerUrl = dan duong link day du https:// cua anh poster su kien\\n' +
    '  startAt / endAt = ngay gio  (dinh dang: dd/mm/yy h:mmam/pm  vi du: 25/04/26 07:00pm)  |  de trong endAt = mac dinh 2 gio\\n' +
    '  isActive = TRUE de hien thi su kien  |  FALSE de an su kien'
  );
  _styleRow(r3, 'guide');
  sheet.setRowHeight(3, 160);

  sheet.setFrozenRows(3);
}

// ── Sheet Read/Write Helpers ──────────────────────────────────────────────────

function buildEnrollmentHeaders() {
  var h = ['enrollmentId','userId','courseId','studentName','phone','email',
           'courseName','totalLessons','enrollmentStatus',
           'instructorId','instructorName','instructorEmail'];
  for (var i = 1; i <= MAX_LESSONS; i++) {
    h.push('lesson' + i + 'DateTime', 'lesson' + i + 'Instructor', 'lesson' + i + 'Status');
  }
  return h;
}

function buildEventHeaders() {
  return ['id','title','caption','flyerUrl','startAt','endAt','isActive'];
}

function buildCancellationHeaders() {
  return ['enrollmentId','lessonNumber','studentName','studentEmail',
          'courseName','scheduledAt','cancelledAt','hoursNotice','isLate'];
}

function isDateTimeHeader(h) {
  return /^lesson\\d+DateTime$/.test(h) ||
    ['startAt','endAt','scheduledAt','cancelledAt'].indexOf(h) !== -1;
}

function writeSheetRows(sheetName, headers, rows) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);

  var dateIdxs = [];
  headers.forEach(function(h, i) { if (isDateTimeHeader(h)) dateIdxs.push(i); });

  var values = [headers];
  rows.forEach(function(row) {
    values.push(headers.map(function(h, i) {
      var raw = row[h];
      if (dateIdxs.indexOf(i) !== -1 && raw && typeof raw === 'string') {
        var d = new Date(raw);
        if (!isNaN(d.getTime())) return d;
      }
      return normalizeCell(raw);
    }));
  });

  sheet.clear();
  sheet.getRange(1, 1, values.length, headers.length).setValues(values);

  if (values.length > 1) {
    dateIdxs.forEach(function(idx) {
      sheet.getRange(2, idx + 1, values.length - 1, 1).setNumberFormat('dd/mm/yy h:mm am/pm');
    });
  }

  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold').setBackground(COLOUR.headerBg).setFontColor(COLOUR.headerText);
  sheet.setFrozenRows(1);

  ['instructorId','instructorName','instructorEmail'].forEach(function(col) {
    var idx = headers.indexOf(col);
    if (idx >= 0 && values.length > 1) {
      sheet.getRange(2, idx + 1, values.length - 1, 1).setBackground(COLOUR.instructorBg);
    }
  });

  for (var r = 2; r < values.length; r++) {
    sheet.getRange(r + 1, 1, 1, headers.length)
      .setBackground(r % 2 === 0 ? COLOUR.altRowBg : '#ffffff');
  }

  if (sheetName === MASTER_SHEET) _applyHeaderNotes(sheet, headers);
  sheet.autoResizeColumns(1, headers.length);
}

function _applyHeaderNotes(sheet, headers) {
  var notes = {
    enrollmentId:     'EN: Auto-generated unique ID - do not edit.\\nVI: ID duy nhat tu dong tao - khong chinh sua.',
    userId:           'EN: Student account ID in the Muse app - do not edit.\\nVI: ID tai khoan hoc vien - khong chinh sua.',
    courseId:         'EN: Course ID in the Muse app - do not edit.\\nVI: ID khoa hoc - khong chinh sua.',
    studentName:      'EN: Student full name - pulled from the app.\\nVI: Ho ten day du hoc vien - lay tu ung dung.',
    phone:            'EN: Student phone number.\\nVI: So dien thoai hoc vien.',
    email:            'EN: Student email address.\\nVI: Dia chi email hoc vien.',
    courseName:       'EN: Name of the course.\\nVI: Ten khoa hoc.',
    totalLessons:     'EN: Total lessons in this course.\\nVI: Tong so buoi hoc cua khoa hoc nay.',
    enrollmentStatus: 'EN: Status: active, completed, or cancelled.\\nVI: Trang thai: active, completed, hoac cancelled.',
    instructorId:     'EN: Instructor account ID - filled automatically.\\nVI: ID tai khoan giang vien - tu dong dien.',
    instructorName:   'EN: Instructor name - filled automatically.\\nVI: Ten giang vien - tu dong dien.',
    instructorEmail:  'EN: KEY FIELD - type the instructor email here to assign them.\\nThe sheet will offer to apply to ALL lesson slots.\\nTo override one lesson only, edit that lesson instructor cell directly.\\nVI: TRUONG QUAN TRONG - nhap email giang vien vao day de phan cong.\\nBang se hoi co muon ap dung cho TAT CA buoi hoc khong.\\nDe thay doi rieng mot buoi, chinh sua o giang vien cua buoi do truc tiep.',
  };
  for (var i = 1; i <= MAX_LESSONS; i++) {
    notes['lesson' + i + 'DateTime'] =
      'EN: Date and time for lesson ' + i + '.\\nFormat: dd/mm/yy h:mmam/pm  e.g. 25/04/26 10:00am\\nLeave blank if not yet scheduled.\\n' +
      'VI: Ngay gio buoi hoc ' + i + '.\\nDinh dang: dd/mm/yy h:mmam/pm  vd: 25/04/26 10:00am\\nDe trong neu chua len lich.';
    notes['lesson' + i + 'Instructor'] =
      'EN: Instructor for lesson ' + i + ' only. Leave blank to use the default. Editing here highlights yellow as an override reminder.\\n' +
      'VI: Giang vien rieng cho buoi hoc ' + i + '. De trong de dung mac dinh. Chinh sua se to vang de nhac day la thay doi rieng le.';
    notes['lesson' + i + 'Status'] =
      'EN: Status for lesson ' + i + ': scheduled / completed / cancelled. Updated by the app - do not edit.\\n' +
      'VI: Trang thai buoi hoc ' + i + ': scheduled / completed / cancelled. Cap nhat boi ung dung - khong chinh sua.';
  }
  headers.forEach(function(h, idx) {
    if (notes[h]) sheet.getRange(1, idx + 1).setNote(notes[h]);
  });
}

function readSheetRows(sheetName, allowMissing) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    if (allowMissing) return [];
    throw new Error('Sheet not found: ' + sheetName);
  }
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

function normalizeCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return value.toISOString();
  return value;
}

function parseSuperJSON(text) {
  var raw = JSON.parse(text);
  return (raw && raw.json) ? raw.json : raw;
}

// ── Cancel Link Helper ────────────────────────────────────────────────────────

function makeCancelLink(appUrl, apiKey, enrollmentId, lessonNumber) {
  var msg  = enrollmentId + ':' + lessonNumber;
  var hmac = Utilities.computeHmacSha256Signature(
    Utilities.newBlob(msg).getBytes(),
    Utilities.newBlob(apiKey).getBytes()
  );
  var sig = hmac.map(function(b) {
    return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2);
  }).join('');
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
