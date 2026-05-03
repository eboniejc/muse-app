
const GOOGLE_APPS_SCRIPT_CONTENT = `
// ── MUSE INC Google Sheets Manager ───────────────────────────────────────────
//
// SETUP:
//   1. Paste this into Extensions > Apps Script (replace everything), Save
//   2. Run "installTrigger" once from the editor
//   3. Run "setupSheets" once to build the sheet tabs
//   4. Use MUSE INC Sync menu to Pull / Push
//
// ─────────────────────────────────────────────────────────────────────────────

var LESSONS_SHEET   = 'Lessons';
var EVENTS_SHEET    = 'Events';
var CAL_SHEET       = 'Monthly Calendar';
var AUDIT_SHEET     = 'Audit';
var ROOMS_SHEET     = 'Practice Room Schedule';
var HOURS_SHEET     = 'Practice Hours';
var CALENDAR_NAME   = 'MUSE INC Schedule';
var LESSON_DURATION = 1; // hours
var VN_TZ           = 'Asia/Ho_Chi_Minh';

// Columns in Practice Hours sheet (1-indexed)
var PH_COL_NAME      = 1;
var PH_COL_EMAIL     = 2;
var PH_COL_USED      = 3;
var PH_COL_REMAINING = 4;
var PH_COL_TOTAL     = 5;
var PH_COL_OVERRIDE  = 6;
var PH_COL_PERIOD    = 7;
var PH_COL_USERID    = 8;
var PH_COL_COUNT     = 8;

var TIME_SLOTS = (function() {
  var slots = [];
  for (var h = 9; h <= 20; h++) {
    var ampm = h < 12 ? 'am' : 'pm';
    var h12  = h <= 12 ? h : h - 12;
    slots.push(h12 + ':00' + ampm);
    if (h < 20) slots.push(h12 + ':30' + ampm);
  }
  return slots;
})();

var C = {
  navy:        '#1a2744',
  navyMid:     '#2c3e6b',
  white:       '#ffffff',
  altRow:      '#f4f7ff',
  readonly:    '#f0f2f8',
  inputBg:     '#ffffff',
  calBlue:     '#ddeeff',
  calBlueDark: '#b8d4f5',
  stepsYel:    '#fffbe6',
  stepsText:   '#5a4000',
  hintText:    '#888888',
  labelText:   '#333333',
  mutedBorder: '#dce3f5',
  statusDone:  '#e6f9ed',
  statusWait:  '#fff7e0',
  statusCxl:   '#fde8e8',
};

// Pastel palette — one colour per student enrollment for quick visual scanning
var ENROLLMENT_PALETTE = [
  '#ffe8e8', // rose
  '#fff4e0', // amber
  '#e8f9ee', // mint
  '#e8f0ff', // periwinkle
  '#f5e8ff', // lavender
  '#ffe8f8', // blush
  '#e8fffe', // aqua
  '#f9ffe8', // lime
];

// Hardcoded instructor list — always available in the dropdown
var STATIC_INSTRUCTORS = [
  'Djzbuzhh1304@gmail.com',
  'dj.jakeryan95@gmail.com',
  'djnapple@gmail.com',
  'thienga1110@gmail.com',
  'Info.djphat@gmail.com',
];

// Columns in the Lessons sheet (1-indexed)
var COL_ENROLLMENT_ID = 1;
var COL_STUDENT_NAME  = 2;
var COL_EMAIL         = 3;
var COL_COURSE_NAME   = 4;
var COL_LESSON_NUM    = 5;
var COL_DATE          = 6;
var COL_TIME          = 7;
var COL_INSTRUCTOR    = 8;
var COL_STATUS        = 9;
var LESSONS_COL_COUNT = 9;

// ── Install trigger ───────────────────────────────────────────────────────────

function installTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'onEditInstallable') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onEditInstallable').forSpreadsheet(ss).onEdit().create();
  Logger.log('Trigger installed OK.');
}

// ── Setup all sheets ──────────────────────────────────────────────────────────

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  _ensureLessonsSheet(ss);
  _ensureEventsSheet(ss);
  _ensureCalendarSheet(ss);
  _ensureAuditSheet(ss);
  _ensurePracticeRoomsSheet(ss);
  _ensurePracticeHoursSheet(ss);
  Logger.log('Sheets ready.');
}

// ── Menu ──────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('MUSE INC Sync')
    .addItem('Pull From App',              'pullFromApp')
    .addItem('Push To App',               'pushToApp')
    .addItem('Push Hour Overrides to App', 'pushPracticeHourOverrides')
    .addItem('Sync to Google Calendar',   'syncToCalendar')
    .addItem('Fill Instructor Down',      'fillInstructorDown')
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu('Settings')
        .addItem('Setup App Connection',  'setup')
        .addItem('Setup Google Calendar', 'setupCalendar')
    )
    .addToUi();
}

function onEdit(e)            { _handleEdit(e); }
function onEditInstallable(e) { _handleEdit(e); }

function _handleEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var name  = sheet.getName();
  var col   = e.range.getColumn();
  var row   = e.range.getRow();

  if (name === LESSONS_SHEET && row > 1) {
    // Format date column automatically
    if (col === COL_DATE) {
      e.range.setNumberFormat('dd/mm/yyyy');
    }
    return;
  }

  if (name === CAL_SHEET && row <= 2 && (col === 2 || col === 4)) {
    renderCalendar(sheet); return;
  }
  if (name === AUDIT_SHEET && row <= 2 && (col === 2 || col === 4)) {
    renderAudit(sheet); return;
  }
}

// ── Fill Instructor Down ──────────────────────────────────────────────────────
// Fills the selected instructor into all empty instructor cells
// for the same student (same enrollmentId).

function fillInstructorDown() {
  var ui    = SpreadsheetApp.getUi();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LESSONS_SHEET);
  if (!sheet) { ui.alert('No Lessons sheet found.', ui.ButtonSet.OK); return; }

  var active = sheet.getActiveCell();
  if (active.getColumn() !== COL_INSTRUCTOR || active.getRow() < 2) {
    ui.alert('Select a cell in the Instructor column first.', ui.ButtonSet.OK);
    return;
  }

  var instrValue = active.getValue();
  if (!instrValue) { ui.alert('The selected instructor cell is empty.', ui.ButtonSet.OK); return; }

  var enrollmentId = sheet.getRange(active.getRow(), COL_ENROLLMENT_ID).getValue();
  if (!enrollmentId) { ui.alert('No enrollment ID found on this row.', ui.ButtonSet.OK); return; }

  var lastRow = sheet.getLastRow();
  var data = sheet.getRange(2, COL_ENROLLMENT_ID, lastRow - 1, LESSONS_COL_COUNT).getValues();
  var filled = 0;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][COL_ENROLLMENT_ID - 1]) !== String(enrollmentId)) continue;
    var instrCell = sheet.getRange(i + 2, COL_INSTRUCTOR);
    if (!instrCell.getValue()) {
      instrCell.setValue(instrValue);
      filled++;
    }
  }
  ui.alert('Done', 'Filled ' + filled + ' empty instructor cells for this student.', ui.ButtonSet.OK);
}

// ── Pull From App ─────────────────────────────────────────────────────────────

function pullFromApp() {
  var ui     = SpreadsheetApp.getUi();
  var props  = PropertiesService.getScriptProperties();
  var appUrl = props.getProperty('APP_URL');
  var apiKey = props.getProperty('API_KEY');
  if (!appUrl || !apiKey) {
    ui.alert('Not configured', 'Run MUSE INC Sync > Settings > Setup App Connection first.', ui.ButtonSet.OK);
    return;
  }
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('Fetching data from app…', 'MUSE INC Sync', 60);

    // ── Fetch all three endpoints in parallel ─────────────────────────────────
    var responses = UrlFetchApp.fetchAll([
      { url: appUrl + '/_api/sheets/export',                  method: 'post', headers: { 'x-api-key': apiKey }, muteHttpExceptions: true },
      { url: appUrl + '/_api/sheets/rooms-export',            method: 'get',  headers: { 'x-api-key': apiKey }, muteHttpExceptions: true },
      { url: appUrl + '/_api/sheets/practice-hours-export',   method: 'get',  headers: { 'x-api-key': apiKey }, muteHttpExceptions: true },
    ]);

    // ── Lessons + Events ──────────────────────────────────────────────────────
    if (responses[0].getResponseCode() !== 200) throw new Error('Export failed ' + responses[0].getResponseCode() + ': ' + responses[0].getContentText());
    var parsed        = parseSuperJSON(responses[0].getContentText());
    var lessonRows    = (parsed && parsed.data && parsed.data.lessonRows)  || [];
    var events        = (parsed && parsed.data && parsed.data.events)      || [];
    var cancellations = (parsed && parsed.data && parsed.data.lessonCancellations) || [];

    if (lessonRows.length === 0) {
      var ok = ui.alert('Warning', 'Server returned 0 lesson rows. Sheet will be empty. Continue?', ui.ButtonSet.YES_NO);
      if (ok !== ui.Button.YES) return;
    }

    var instructors = _extractInstructors(lessonRows);
    _writeLessonsSheet(lessonRows, instructors);
    _writeEventsSheet(events);
    _ensureCalendarSheet(SpreadsheetApp.getActiveSpreadsheet());
    _ensureAuditSheet(SpreadsheetApp.getActiveSpreadsheet());
    renderCalendar(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CAL_SHEET));
    renderAudit(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(AUDIT_SHEET));
    if (cancellations.length) _writeCancellationsSheet(cancellations);

    // ── Practice Room Schedule ────────────────────────────────────────────────
    if (responses[1].getResponseCode() === 200) {
      try {
        var roomsParsed = parseSuperJSON(responses[1].getContentText());
        _writePracticeRoomsSheet((roomsParsed && roomsParsed.bookings) || []);
      } catch(e) { Logger.log('Practice rooms write error: ' + e.message); }
    }

    // ── Practice Hours ────────────────────────────────────────────────────────
    if (responses[2].getResponseCode() === 200) {
      try {
        var hoursParsed = parseSuperJSON(responses[2].getContentText());
        _writePracticeHoursSheet((hoursParsed && hoursParsed.students) || []);
      } catch(e) { Logger.log('Practice hours write error: ' + e.message); }
    }

    SpreadsheetApp.getActiveSpreadsheet().toast(
      lessonRows.length + ' lessons, ' + events.length + ' events, rooms & hours synced.',
      'Pull complete ✓', 5);
  } catch(err) { ui.alert('Pull failed', err.message, ui.ButtonSet.OK); }
}

// ── Push To App ───────────────────────────────────────────────────────────────

function pushToApp() {
  var ui     = SpreadsheetApp.getUi();
  var props  = PropertiesService.getScriptProperties();
  var appUrl = props.getProperty('APP_URL');
  var apiKey = props.getProperty('API_KEY');
  if (!appUrl || !apiKey) {
    ui.alert('Not configured', 'Run MUSE INC Sync > Settings > Setup App Connection first.', ui.ButtonSet.OK);
    return;
  }
  try {
    var lessonRows = _readLessonsSheet();
    var events     = _readEventsSheet();

    var confirm = ui.alert(
      'Confirm Push',
      'Send ' + lessonRows.length + ' lesson rows and ' + events.length + ' events to the app. Continue?',
      ui.ButtonSet.YES_NO
    );
    if (confirm !== ui.Button.YES) return;

    SpreadsheetApp.getActiveSpreadsheet().toast('Sending to app…', 'MUSE INC Sync', 60);

    var r1 = UrlFetchApp.fetch(appUrl + '/_api/sheets/import', {
      method: 'post',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ json: { table: 'lessonRows', rows: lessonRows } }),
      muteHttpExceptions: true
    });
    if (r1.getResponseCode() !== 200) throw new Error('Lessons push failed: ' + r1.getContentText());

    var r2 = UrlFetchApp.fetch(appUrl + '/_api/sheets/import', {
      method: 'post',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ json: { table: 'events', rows: events } }),
      muteHttpExceptions: true
    });
    if (r2.getResponseCode() !== 200) throw new Error('Events push failed: ' + r2.getContentText());

    var calId = props.getProperty('CALENDAR_ID');
    if (calId) {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        lessonRows.length + ' lessons sent.', 'Push complete ✓', 4);
      var choice = ui.alert('Sync Calendar?',
        'Sync ' + lessonRows.length + ' lessons to Google Calendar now?',
        ui.ButtonSet.YES_NO);
      if (choice === ui.Button.YES) { syncToCalendar(); syncEventsToCalendar(); }
    } else {
      SpreadsheetApp.getActiveSpreadsheet().toast(
        lessonRows.length + ' lessons and ' + events.length + ' events sent.',
        'Push complete ✓', 5);
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

  var rows = _readLessonsSheet();
  var created = 0, updated = 0, apiCalls = 0;

  // Pre-fetch all muse-tagged events once so date changes are found regardless of old date
  var scanFrom = new Date(); scanFrom.setFullYear(scanFrom.getFullYear() - 2);
  var scanTo   = new Date(); scanTo.setFullYear(scanTo.getFullYear() + 2);
  var allEvents = calendar.getEvents(scanFrom, scanTo);
  var tagMap = {};
  allEvents.forEach(function(ev) {
    var desc = ev.getDescription() || '';
    var match = desc.match(/\\[muse:\\d+:\\d+\\]/);
    if (match) tagMap[match[0]] = ev;
  });

  rows.forEach(function(row) {
    if (!row.scheduledAt) return;
    var start = new Date(row.scheduledAt);
    if (isNaN(start.getTime())) return;
    var end   = new Date(start.getTime() + LESSON_DURATION * 3600000);

    var eId   = row.enrollmentId;
    var lessonNum = row.lessonNumber;
    // Skip contest rows — their lesson numbers are strings like "Contest 1"
    if (!/^\\d+$/.test(String(lessonNum))) return;
    var tag   = '[muse:' + eId + ':' + lessonNum + ']';
    var title = (row.courseName || 'Lesson') + ' - Lesson ' + lessonNum + ' | ' + (row.studentName || '');

    var cancelUrl = (appUrl && apiKey) ? makeCancelLink(appUrl, apiKey, eId, lessonNum) : '';
    var lines = [
      'Student: ' + (row.studentName || ''),
      'Course: ' + (row.courseName || ''),
      'Lesson: ' + lessonNum
    ];
    if (row.instructor) lines.push('Instructor: ' + row.instructor);
    if (cancelUrl) lines.push('', 'Cancel: ' + cancelUrl);
    lines.push('', tag);

    var guests = [row.email, 'museincproperty@gmail.com'].filter(Boolean);

    if (apiCalls > 0 && apiCalls % 10 === 0) Utilities.sleep(1000);
    var existingEv = tagMap[tag];
    if (existingEv) {
      existingEv.setTitle(title); existingEv.setTime(start, end); existingEv.setDescription(lines.join('\\n'));
      var ge = existingEv.getGuestList().map(function(g) { return g.getEmail(); });
      guests.forEach(function(em) { if (ge.indexOf(em) === -1) existingEv.addGuest(em); });
      updated++;
    } else {
      var opts = { description: lines.join('\\n') };
      if (guests.length) opts.guests = guests.join(',');
      calendar.createEvent(title, start, end, opts);
      created++;
    }
    apiCalls++;
  });

  // ── Delete orphaned events (events with [muse:N:N] tags no longer in sheet) ──
  var currentTags = {};
  rows.forEach(function(row) {
    if (row.scheduledAt && /^\\d+$/.test(String(row.lessonNumber))) {
      currentTags['[muse:' + row.enrollmentId + ':' + row.lessonNumber + ']'] = true;
    }
  });

  var toDelete = [];
  allEvents.forEach(function(ev) {
    var desc = ev.getDescription() || '';
    var match = desc.match(/\\[muse:\\d+:\\d+\\]/);
    if (match && !currentTags[match[0]]) toDelete.push(ev);
  });

  var deleted = 0;
  if (toDelete.length > 0) {
    var confirmMsg = rows.length === 0
      ? 'WARNING: The Lessons sheet is empty.\\nThis will delete ALL ' + toDelete.length + ' calendar event(s).\\n\\nAre you sure?'
      : 'This will delete ' + toDelete.length + ' orphaned event(s) no longer in the sheet.\\n\\nContinue?';
    var go = ui.alert('Confirm deletions', confirmMsg, ui.ButtonSet.YES_NO);
    if (go === ui.Button.YES) {
      toDelete.forEach(function(ev, i) { if (i > 0 && i % 10 === 0) Utilities.sleep(1000); ev.deleteEvent(); deleted++; });
    }
  }

  ui.alert('Calendar sync complete',
    'Created ' + created + ' | Updated ' + updated + ' | Deleted ' + deleted,
    ui.ButtonSet.OK);
}

function syncEventsToCalendar() {
  var props = PropertiesService.getScriptProperties();
  var calId = props.getProperty('CALENDAR_ID'); if (!calId) return;
  var calendar = CalendarApp.getCalendarById(calId); if (!calendar) return;

  // Pre-fetch all muse_event-tagged events once so date changes are found regardless of old date
  var scanFrom = new Date(); scanFrom.setFullYear(scanFrom.getFullYear() - 2);
  var scanTo   = new Date(); scanTo.setFullYear(scanTo.getFullYear() + 2);
  var allEvents = calendar.getEvents(scanFrom, scanTo);
  var tagMap = {};
  allEvents.forEach(function(ev) {
    var desc = ev.getDescription() || '';
    var match = desc.match(/\\[muse_event:[^\\]]+\\]/);
    if (match) tagMap[match[0]] = ev;
  });

  var currentTags = {};
  _readEventsSheet().forEach(function(row) {
    if (!row.title || !row.startAt) return;
    var start = new Date(row.startAt); if (isNaN(start.getTime())) return;
    var end = row.endAt ? new Date(row.endAt) : new Date(start.getTime() + 7200000);
    var tag = '[muse_event:' + row.id + ']';
    var desc = (row.caption || '') + '\\n' + tag;
    var guests = 'museincproperty@gmail.com';
    var ex = tagMap[tag];
    if (ex) { ex.setTitle(row.title); ex.setTime(start, end); ex.setDescription(desc); ex.addGuest(guests); }
    else calendar.createEvent(row.title, start, end, { description: desc, guests: guests });
    currentTags[tag] = true;
  });

  // Delete orphaned event entries no longer in the Events sheet
  allEvents.forEach(function(ev) {
    var desc = ev.getDescription() || '';
    var match = desc.match(/\\[muse_event:[^\\]]+\\]/);
    if (match && !currentTags[match[0]]) ev.deleteEvent();
  });
}

// ── Settings ──────────────────────────────────────────────────────────────────

function setup() {
  var ui    = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var urlRes = ui.prompt('Setup (1/2)', 'Enter your Muse App URL (e.g. https://myapp.example.com)', ui.ButtonSet.OK_CANCEL);
  if (urlRes.getSelectedButton() !== ui.Button.OK) return;
  var keyRes = ui.prompt('Setup (2/2)', 'Enter your API Key', ui.ButtonSet.OK_CANCEL);
  if (keyRes.getSelectedButton() !== ui.Button.OK) return;
  props.setProperty('APP_URL', urlRes.getResponseText().trim().replace(/\\/$/, ''));
  props.setProperty('API_KEY', keyRes.getResponseText().trim());
  ui.alert('Done', 'Connection saved.', ui.ButtonSet.OK);
}

function setupCalendar() {
  var ui    = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var cals  = CalendarApp.getCalendarsByName(CALENDAR_NAME);
  var cal   = cals.length ? cals[0] : CalendarApp.createCalendar(CALENDAR_NAME, { color: CalendarApp.Color.TEAL });
  props.setProperty('CALENDAR_ID', cal.getId());
  ui.alert('Done', 'Calendar ready: ' + CALENDAR_NAME + '\\nShare it with instructors via Google Calendar settings.', ui.ButtonSet.OK);
}

// ── Lessons Sheet ─────────────────────────────────────────────────────────────

function _ensureLessonsSheet(ss) {
  var sheet = ss.getSheetByName(LESSONS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(LESSONS_SHEET);
    _formatLessonsHeader(sheet);
  }
  return sheet;
}

function _formatLessonsHeader(sheet) {
  var headers = ['Enrollment ID', 'Student Name', 'Email', 'Course', 'Lesson #', 'Date', 'Time', 'Instructor', 'Status'];
  sheet.getRange(1, 1, 1, LESSONS_COL_COUNT).setValues([headers])
    .setBackground(C.navy).setFontColor(C.white).setFontWeight('bold');

  // Column widths
  sheet.setColumnWidth(COL_ENROLLMENT_ID, 100);
  sheet.setColumnWidth(COL_STUDENT_NAME,  160);
  sheet.setColumnWidth(COL_EMAIL,         200);
  sheet.setColumnWidth(COL_COURSE_NAME,   180);
  sheet.setColumnWidth(COL_LESSON_NUM,    70);
  sheet.setColumnWidth(COL_DATE,          110);
  sheet.setColumnWidth(COL_TIME,          90);
  sheet.setColumnWidth(COL_INSTRUCTOR,    150);
  sheet.setColumnWidth(COL_STATUS,        90);

  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(5);
}

function _writeLessonsSheet(lessonRows, instructors) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LESSONS_SHEET) || ss.insertSheet(LESSONS_SHEET);
  var tz    = VN_TZ;

  // Preserve existing instructor overrides keyed by enrollmentId+lessonNumber
  var existingInstrs = {};
  if (sheet.getLastRow() > 1) {
    var existing = sheet.getRange(2, 1, sheet.getLastRow() - 1, LESSONS_COL_COUNT).getValues();
    existing.forEach(function(r) {
      var key = String(r[COL_ENROLLMENT_ID-1]) + '-' + String(r[COL_LESSON_NUM-1]);
      if (r[COL_INSTRUCTOR-1]) existingInstrs[key] = r[COL_INSTRUCTOR-1];
    });
  }

  sheet.clearContents();
  sheet.clearFormats();
  _formatLessonsHeader(sheet);

  if (lessonRows.length === 0) return;

  var values = lessonRows.map(function(row) {
    var key = String(row.enrollmentId) + '-' + String(row.lessonNumber);
    var instructor = existingInstrs[key] || row.instructor || '';

    // Split scheduledAt into date and time
    var dateVal = '';
    var timeVal = '';
    if (row.scheduledAt) {
      var dt = new Date(row.scheduledAt);
      if (!isNaN(dt.getTime())) {
        dateVal = dt; // will be formatted as date
        // Convert UTC → Vietnam local time (UTC+7) before formatting
        var vnMs   = dt.getTime() + 7 * 60 * 60 * 1000;
        var vnDate = new Date(vnMs);
        var h = vnDate.getUTCHours(), m = vnDate.getUTCMinutes();
        var ampm = h >= 12 ? 'pm' : 'am';
        var h12  = h % 12 || 12;
        timeVal  = h12 + ':' + (m < 10 ? '0' : '') + m + ampm;
      }
    }

    return [
      row.enrollmentId,
      row.studentName || '',
      row.email || '',
      row.courseName || '',
      row.lessonNumber,
      dateVal,
      timeVal,
      instructor,
      row.status || '',
    ];
  });

  sheet.getRange(2, 1, values.length, LESSONS_COL_COUNT).setValues(values);

  // Format date column
  sheet.getRange(2, COL_DATE, values.length, 1).setNumberFormat('dd/mm/yyyy');

  // Date validation shows the calendar picker UI
  var dateRule = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, COL_DATE, values.length, 1).setDataValidation(dateRule);

  // Time dropdown
  var timeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(TIME_SLOTS, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, COL_TIME, values.length, 1).setDataValidation(timeRule);

  // Instructor dropdown (always available — includes static list)
  var instructorOptions = instructors.length ? instructors : STATIC_INSTRUCTORS;
  var instrRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(instructorOptions, true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, COL_INSTRUCTOR, values.length, 1).setDataValidation(instrRule);

  // Per-enrollment pastel row colours + editable column whites
  var enrollmentColors = _buildEnrollmentColors(lessonRows);
  _applyRowStyles(sheet, 2, values, enrollmentColors);

  // Status column colour coding
  _applyStatusColors(sheet, 2, values.length);
}

function _readLessonsSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LESSONS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var tz   = VN_TZ;
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, LESSONS_COL_COUNT).getValues();
  var rows = [];

  data.forEach(function(r) {
    var enrollmentId = r[COL_ENROLLMENT_ID - 1];
    var lessonNumber = r[COL_LESSON_NUM - 1];
    if (!enrollmentId || !lessonNumber) return;

    var dateVal = r[COL_DATE - 1];
    var timeRaw = r[COL_TIME - 1];
    var scheduledAt = null;

    if (dateVal) {
      var d = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
      if (!isNaN(d.getTime())) {
        // Sheets auto-converts time-looking strings ("9:00am") to Date objects
        // or fractional-day numbers. Handle all three cases.
        var hour = 0, minute = 0;
        if (timeRaw instanceof Date) {
          // Date with epoch Dec 30 1899 — use UTC hours/minutes
          hour   = timeRaw.getUTCHours();
          minute = timeRaw.getUTCMinutes();
        } else if (typeof timeRaw === 'number' && timeRaw > 0 && timeRaw < 1) {
          // Fractional day: 0.375 = 9am, 0.5 = noon, etc.
          var totalMins = Math.round(timeRaw * 24 * 60);
          hour   = Math.floor(totalMins / 60);
          minute = totalMins % 60;
        } else {
          var timeStr = String(timeRaw || '').trim();
          if (timeStr) {
            var tm = timeStr.match(/^(\\d{1,2}):(\\d{2})(am|pm)$/i);
            if (tm) {
              hour   = parseInt(tm[1], 10);
              minute = parseInt(tm[2], 10);
              if (tm[3].toLowerCase() === 'pm' && hour < 12) hour += 12;
              if (tm[3].toLowerCase() === 'am' && hour === 12) hour = 0;
            }
          }
        }
        // Build datetime in Vietnam timezone (UTC+7) → convert to UTC
        var dateStr = Utilities.formatDate(d, tz, 'yyyy-MM-dd');
        var parts   = dateStr.split('-');
        var year    = parseInt(parts[0], 10);
        var month   = parseInt(parts[1], 10) - 1;
        var day     = parseInt(parts[2], 10);
        var utcMs   = Date.UTC(year, month, day, hour, minute, 0) - 7 * 60 * 60 * 1000;
        scheduledAt = new Date(utcMs).toISOString();
      }
    }

    rows.push({
      enrollmentId: enrollmentId,
      lessonNumber: lessonNumber,
      scheduledAt:  scheduledAt,
      instructor:   String(r[COL_INSTRUCTOR - 1] || ''),
      studentName:  String(r[COL_STUDENT_NAME - 1] || ''),
      courseName:   String(r[COL_COURSE_NAME - 1] || ''),
      email:        String(r[COL_EMAIL - 1] || ''),
    });
  });

  return rows;
}

function _extractInstructors(lessonRows) {
  var seen = {}, list = [];
  // Seed with static instructors first
  STATIC_INSTRUCTORS.forEach(function(email) {
    if (!seen[email]) { seen[email] = true; list.push(email); }
  });
  // Add any additional instructors from DB data
  lessonRows.forEach(function(r) {
    var n = String(r.instructor || '').trim();
    if (n && !seen[n]) { seen[n] = true; list.push(n); }
  });
  return list;
}

function _buildEnrollmentColors(lessonRows) {
  var seen = {}, idx = 0, colors = {};
  lessonRows.forEach(function(row) {
    var eid = String(row.enrollmentId);
    if (!seen[eid]) {
      seen[eid] = true;
      colors[eid] = ENROLLMENT_PALETTE[idx % ENROLLMENT_PALETTE.length];
      idx++;
    }
  });
  return colors;
}

// Batch-apply per-enrollment pastel backgrounds to read-only columns
// and white to editable columns. Much faster than per-cell loops.
function _applyRowStyles(sheet, startRow, values, enrollmentColors) {
  var readonlyCols = [COL_ENROLLMENT_ID, COL_STUDENT_NAME, COL_EMAIL, COL_COURSE_NAME, COL_LESSON_NUM];
  var editableCols = [COL_DATE, COL_TIME, COL_INSTRUCTOR];
  var count = values.length;

  readonlyCols.forEach(function(col) {
    var bgs = values.map(function(r) {
      return [enrollmentColors[String(r[COL_ENROLLMENT_ID - 1])] || C.readonly];
    });
    sheet.getRange(startRow, col, count, 1).setBackgrounds(bgs);
  });

  var whiteBgs = values.map(function() { return [C.inputBg]; });
  editableCols.forEach(function(col) {
    sheet.getRange(startRow, col, count, 1).setBackgrounds(whiteBgs);
  });
}

// Batch colour-code the Status column: green=completed, red=cancelled,
// amber=has a date (scheduled), grey=no date yet.
function _applyStatusColors(sheet, startRow, count) {
  var statusVals = sheet.getRange(startRow, COL_STATUS, count, 1).getValues();
  var dateVals   = sheet.getRange(startRow, COL_DATE,   count, 1).getValues();
  var bgs = statusVals.map(function(sr, i) {
    var s = String(sr[0] || '').toLowerCase().trim();
    var hasDate = !!dateVals[i][0];
    return [s === 'completed' ? C.statusDone
          : s === 'cancelled' ? C.statusCxl
          : hasDate           ? C.statusWait
          : C.readonly];
  });
  sheet.getRange(startRow, COL_STATUS, count, 1).setBackgrounds(bgs);
}

// ── Events Sheet ──────────────────────────────────────────────────────────────

function _ensureEventsSheet(ss) {
  var sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) sheet = ss.insertSheet(EVENTS_SHEET);
  _formatEventsHeader(sheet);
  return sheet;
}

function _formatEventsHeader(sheet) {
  var headers = ['id','title','caption','flyerUrl','startAt','endAt','isActive'];
  sheet.getRange(1, 1, 1, 7).setValues([headers])
    .setBackground(C.navy).setFontColor(C.white).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function _writeEventsSheet(events) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(EVENTS_SHEET) || ss.insertSheet(EVENTS_SHEET);
  sheet.clearContents();
  _formatEventsHeader(sheet);
  if (!events.length) return;

  var headers = ['id','title','caption','flyerUrl','startAt','endAt','isActive'];
  var dateIdxs = [4, 5]; // startAt, endAt (0-indexed)
  var values = events.map(function(row) {
    return headers.map(function(h, i) {
      var v = row[h];
      if (dateIdxs.indexOf(i) !== -1 && v && typeof v === 'string') {
        var d = new Date(v); if (!isNaN(d.getTime())) return d;
      }
      if (v === null || v === undefined) return '';
      if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
      return v;
    });
  });

  sheet.getRange(2, 1, values.length, 7).setValues(values);
  sheet.getRange(2, 5, values.length, 1).setNumberFormat('dd/mm/yy h:mm am/pm');
  sheet.getRange(2, 6, values.length, 1).setNumberFormat('dd/mm/yy h:mm am/pm');
}

function _readEventsSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var tz      = VN_TZ;
  var headers = ['id','title','caption','flyerUrl','startAt','endAt','isActive'];
  var data    = sheet.getRange(2, 1, sheet.getLastRow() - 1, 7).getValues();
  var rows    = [];
  data.forEach(function(r) {
    if (!r[1]) return; // skip rows without title
    var obj = {};
    headers.forEach(function(h, i) {
      var v = r[i];
      if (v instanceof Date) v = Utilities.formatDate(v, tz, 'd/M/yyyy H:mm:ss');
      if (v === '') v = null;
      obj[h] = v;
    });
    rows.push(obj);
  });
  return rows;
}

// ── Cancellations Sheet ───────────────────────────────────────────────────────

function _writeCancellationsSheet(cancellations) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Cancellations') || ss.insertSheet('Cancellations');
  var headers = ['enrollmentId','lessonNumber','studentName','studentEmail','courseName','scheduledAt','cancelledAt','hoursNotice','isLate'];
  var dateHeaders = { scheduledAt: true, cancelledAt: true };
  sheet.clearContents();
  sheet.clearFormats();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setBackground(C.navy).setFontColor(C.white).setFontWeight('bold');
  if (!cancellations.length) { sheet.setFrozenRows(1); return; }
  var values = cancellations.map(function(row) {
    return headers.map(function(h) {
      var v = row[h];
      if (v === null || v === undefined) return '';
      if (dateHeaders[h] && typeof v === 'string') {
        var d = new Date(v);
        if (!isNaN(d.getTime())) return d;
      }
      return v;
    });
  });
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  // Format scheduledAt (col 6) and cancelledAt (col 7) in Vietnam timezone
  var dateFmt = 'dd/mm/yy h:mm am/pm';
  sheet.getRange(2, 6, values.length, 1).setNumberFormat(dateFmt);
  sheet.getRange(2, 7, values.length, 1).setNumberFormat(dateFmt);
  sheet.setFrozenRows(1);
}

// ── Calendar Sheet ────────────────────────────────────────────────────────────

function _ensureCalendarSheet(ss) {
  var sheet = ss.getSheetByName(CAL_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CAL_SHEET);
    _buildCalendarControls(sheet);
    renderCalendar(sheet);
  }
  return sheet;
}

function _buildCalendarControls(sheet) {
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var vnNow  = Utilities.formatDate(new Date(), VN_TZ, 'yyyy-MM').split('-');
  sheet.getRange(1, 1).setValue('Month:').setFontWeight('bold');
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(MONTHS, true).build();
  sheet.getRange('B1').setDataValidation(rule).setValue(MONTHS[parseInt(vnNow[1], 10) - 1]).setFontWeight('bold');
  sheet.getRange(1, 3).setValue('Year:').setFontWeight('bold');
  sheet.getRange('D1').setValue(parseInt(vnNow[0], 10)).setNumberFormat('0').setFontWeight('bold');
  sheet.getRange(1, 5).setValue('Change B1 / D1 to switch month or year')
    .setFontColor(C.hintText).setFontStyle('italic');
  sheet.setFrozenRows(2);
  for (var c = 1; c <= 7; c++) sheet.setColumnWidth(c, 155);
}

function renderCalendar(sheet) {
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  // Auto-detect which row holds the controls (scan rows 1-3)
  var ctrlRow = 1;
  for (var r = 1; r <= 3; r++) {
    if (MONTHS.indexOf(String(sheet.getRange(r, 2).getValue()).trim()) !== -1) { ctrlRow = r; break; }
  }
  var monthVal = sheet.getRange(ctrlRow, 2).getValue();
  var yearVal  = sheet.getRange(ctrlRow, 4).getValue();
  var month    = MONTHS.indexOf(String(monthVal).trim()) + 1;
  var year     = parseInt(yearVal, 10);
  if (!month || !year || year < 2000 || year > 2100) return;
  var headerRow  = ctrlRow + 1;
  var gridStart  = ctrlRow + 2;

  var lessonsByDay = {};
  try {
    var ss    = SpreadsheetApp.getActiveSpreadsheet();
    var calTz = VN_TZ;
    var lsheet = ss.getSheetByName(LESSONS_SHEET);
    if (lsheet && lsheet.getLastRow() > 1) {
      var data = lsheet.getRange(2, 1, lsheet.getLastRow() - 1, LESSONS_COL_COUNT).getValues();
      data.forEach(function(r) {
        if ((String(r[COL_STATUS-1]||'')).toLowerCase() === 'cancelled') return;
        var dateVal = r[COL_DATE-1];
        var timeVal = String(r[COL_TIME-1]||'');
        if (!dateVal) return;
        var d = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (isNaN(d.getTime())) return;
        // Use spreadsheet timezone to extract date parts to avoid runtime-timezone drift
        var dateParts = Utilities.formatDate(d, calTz, 'yyyy-MM-dd').split('-');
        if (parseInt(dateParts[0], 10) !== year || parseInt(dateParts[1], 10) !== month) return;
        var key = String(parseInt(dateParts[2], 10));
        if (!lessonsByDay[key]) lessonsByDay[key] = [];
        lessonsByDay[key].push({
          time:     timeVal || '',
          student:  String(r[COL_STUDENT_NAME-1]||'?'),
          course:   String(r[COL_COURSE_NAME-1]||''),
          instructor: String(r[COL_INSTRUCTOR-1]||'')
        });
      });
    }
  } catch(e) { Logger.log('renderCalendar error: ' + e.message); }

  var todayVn     = Utilities.formatDate(new Date(), VN_TZ, 'yyyy-MM-dd').split('-');
  var todayYear   = parseInt(todayVn[0], 10);
  var todayMonth  = parseInt(todayVn[1], 10);
  var todayDay    = parseInt(todayVn[2], 10);
  var daysInMonth = new Date(year, month, 0).getDate();
  var startDow    = new Date(year, month - 1, 1).getDay();
  var weeks = [], week = [];
  for (var p = 0; p < startDow; p++) week.push(0);
  for (var d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  while (week.length && week.length < 7) week.push(0);
  if (week.length) weeks.push(week);

  var lastRow = Math.max(sheet.getLastRow(), gridStart + 5);
  if (lastRow >= gridStart) sheet.getRange(gridStart, 1, lastRow - gridStart + 1, 7).clearContent().clearFormat();

  DAYS.forEach(function(name, col) {
    sheet.getRange(headerRow, col + 1).setValue(name)
      .setBackground(C.navyMid).setFontColor(C.white).setFontWeight('bold')
      .setHorizontalAlignment('center');
  });

  weeks.forEach(function(wk, wkIdx) {
    var sheetRow = wkIdx + gridStart;
    var maxL = 0;
    wk.forEach(function(day) { if (day && lessonsByDay[String(day)]) maxL = Math.max(maxL, lessonsByDay[String(day)].length); });
    sheet.setRowHeight(sheetRow, Math.max(72, 36 + maxL * 22));
    wk.forEach(function(day, colIdx) {
      var cell = sheet.getRange(sheetRow, colIdx + 1);
      if (!day) { cell.setBackground('#f5f5f5'); return; }
      var lessons = lessonsByDay[String(day)] || [];
      var lines   = [String(day)];
      lessons.forEach(function(l) {
        lines.push((l.time ? l.time + '  ' : '') + l.student);
        if (l.course) lines.push('  ' + l.course + (l.instructor ? ' - ' + l.instructor : ''));
      });
      var isToday = day === todayDay && month === todayMonth && year === todayYear;
      var bg = isToday ? C.calBlueDark : (lessons.length ? C.calBlue : C.white);
      cell.setValue(lines.join('\\n')).setWrap(true).setVerticalAlignment('top')
        .setBackground(bg)
        .setFontWeight(isToday ? 'bold' : 'normal')
        .setBorder(true,true,true,true,false,false,'#cccccc',SpreadsheetApp.BorderStyle.SOLID);
    });
  });
}

// ── Audit Sheet ───────────────────────────────────────────────────────────────

function _ensureAuditSheet(ss) {
  var sheet = ss.getSheetByName(AUDIT_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(AUDIT_SHEET);
    _buildAuditControls(sheet);
    renderAudit(sheet);
  }
  return sheet;
}

function _buildAuditControls(sheet) {
  var vnNow  = Utilities.formatDate(new Date(), VN_TZ, 'yyyy-MM').split('-');
  var vnYear = parseInt(vnNow[0], 10);
  var vnMon  = parseInt(vnNow[1], 10) - 1; // 0-indexed
  var from   = new Date(vnYear, vnMon, 1);
  var to     = new Date(vnYear, vnMon + 1, 0);
  sheet.getRange(1, 1).setValue('From:').setFontWeight('bold');
  sheet.getRange('B1').setValue(from).setNumberFormat('dd/mm/yyyy').setFontWeight('bold');
  sheet.getRange(1, 3).setValue('To:').setFontWeight('bold');
  sheet.getRange('D1').setValue(to).setNumberFormat('dd/mm/yyyy').setFontWeight('bold');
  sheet.getRange(1, 5).setValue('Change B1 / D1 to switch date range')
    .setFontColor(C.hintText).setFontStyle('italic');
  sheet.setFrozenRows(2);
}

function renderAudit(sheet) {
  // Auto-detect which row holds the controls (scan rows 1-3 for a Date value in col B)
  var ctrlRow = 1;
  for (var r = 1; r <= 3; r++) {
    if (sheet.getRange(r, 2).getValue() instanceof Date) { ctrlRow = r; break; }
  }
  var fromVal = sheet.getRange(ctrlRow, 2).getValue();
  var toVal   = sheet.getRange(ctrlRow, 4).getValue();
  var gridStart = ctrlRow + 2;
  if (!fromVal || !toVal) return;
  var fromDate = new Date(fromVal);
  var toDate   = new Date(toVal);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return;
  // Compare date strings in Vietnam timezone to avoid runtime-timezone boundary issues
  var startStr = Utilities.formatDate(fromDate, VN_TZ, 'yyyy-MM-dd');
  var endStr   = Utilities.formatDate(toDate,   VN_TZ, 'yyyy-MM-dd');

  var byInstructor = {};
  try {
    var ss     = SpreadsheetApp.getActiveSpreadsheet();
    var lsheet = ss.getSheetByName(LESSONS_SHEET);
    if (lsheet && lsheet.getLastRow() > 1) {
      var data = lsheet.getRange(2, 1, lsheet.getLastRow() - 1, LESSONS_COL_COUNT).getValues();
      data.forEach(function(r) {
        if ((String(r[COL_STATUS-1]||'')).toLowerCase() === 'cancelled') return;
        var dateVal = r[COL_DATE-1];
        if (!dateVal) return;
        var dt = dateVal instanceof Date ? dateVal : new Date(dateVal);
        if (isNaN(dt.getTime())) return;
        var dtStr = Utilities.formatDate(dt, VN_TZ, 'yyyy-MM-dd');
        if (dtStr < startStr || dtStr > endStr) return;
        var instr = (String(r[COL_INSTRUCTOR-1]||'') || 'Unassigned').trim();
        if (!byInstructor[instr]) byInstructor[instr] = [];
        byInstructor[instr].push({
          student: String(r[COL_STUDENT_NAME-1]||''),
          course:  String(r[COL_COURSE_NAME-1]||''),
          num:     r[COL_LESSON_NUM-1],
          date:    dt
        });
      });
    }
  } catch(e) { Logger.log('renderAudit error: ' + e.message); return; }

  var lastRow = Math.max(sheet.getLastRow(), gridStart + 5);
  if (lastRow >= gridStart) sheet.getRange(gridStart, 1, lastRow - gridStart + 1, 5).clearContent().clearFormat();

  var instructors = Object.keys(byInstructor).sort();
  var total = instructors.reduce(function(s,n) { return s + byInstructor[n].length; }, 0);
  var r = gridStart;

  if (!instructors.length) {
    sheet.getRange(r,1,1,5).merge().setValue('No lessons found for this date range.')
      .setFontStyle('italic').setFontColor(C.hintText);
    return;
  }

  sheet.getRange(r,1,1,3).setValues([['Instructor','Lessons','Period']])
    .setBackground(C.navyMid).setFontColor(C.white).setFontWeight('bold');
  r++;

  var tz     = VN_TZ;
  var period = Utilities.formatDate(fromDate, tz, 'dd/MM/yyyy') + ' - ' + Utilities.formatDate(toDate, tz, 'dd/MM/yyyy');
  instructors.forEach(function(name) {
    sheet.getRange(r,1,1,3).setValues([[name, byInstructor[name].length, period]])
      .setBackground(r%2===0 ? C.altRow : C.white);
    r++;
  });
  sheet.getRange(r,1,1,2).setValues([['TOTAL', total]]).setFontWeight('bold'); r += 2;

  sheet.getRange(r,1,1,5).setValues([['Instructor','Student','Course','Lesson #','Date & Time']])
    .setBackground(C.navyMid).setFontColor(C.white).setFontWeight('bold');
  r++;
  instructors.forEach(function(name) {
    var lessons = byInstructor[name].slice().sort(function(a,b) { return a.date - b.date; });
    lessons.forEach(function(l) {
      sheet.getRange(r,1,1,5).setValues([[name, l.student, l.course, 'Lesson ' + l.num, l.date]])
        .setBackground(r%2===0 ? C.altRow : C.white);
      sheet.getRange(r,5).setNumberFormat('dd/mm/yy h:mm am/pm');
      r++;
    });
    sheet.getRange(r,1,1,2).setValues([['Subtotal: '+name, lessons.length]]).setFontWeight('bold');
    r++;
  });
  sheet.autoResizeColumns(1, 5);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function parseSuperJSON(text) {
  try {
    var r = JSON.parse(text);
    return (r && r.json) ? r.json : r;
  } catch(e) {
    throw new Error('Invalid response from server: ' + e.message);
  }
}

function makeCancelLink(appUrl, apiKey, enrollmentId, lessonNumber) {
  var msg  = enrollmentId + ':' + lessonNumber;
  var hmac = Utilities.computeHmacSha256Signature(Utilities.newBlob(msg).getBytes(), Utilities.newBlob(apiKey).getBytes());
  var sig  = hmac.map(function(b) { return ('0'+(b<0?b+256:b).toString(16)).slice(-2); }).join('');
  return appUrl + '/_api/lessons/cancel?e=' + enrollmentId + '&l=' + lessonNumber + '&sig=' + sig;
}

// ── Practice Room Schedule ────────────────────────────────────────────────────

function syncPracticeRooms() {
  var ui    = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var appUrl = props.getProperty('APP_URL');
  var apiKey = props.getProperty('API_KEY');
  if (!appUrl || !apiKey) {
    ui.alert('Not configured', 'Run MUSE INC Sync > Settings > Setup App Connection first.', ui.ButtonSet.OK);
    return;
  }
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('Fetching room bookings\\u2026', 'MUSE INC Sync', 30);
    var res = UrlFetchApp.fetch(appUrl + '/_api/sheets/rooms-export', {
      method: 'get',
      headers: { 'x-api-key': apiKey },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) throw new Error('Rooms export failed ' + res.getResponseCode() + ': ' + res.getContentText());
    var parsed   = parseSuperJSON(res.getContentText());
    var bookings = (parsed && parsed.bookings) || [];
    _writePracticeRoomsSheet(bookings);
    SpreadsheetApp.getActiveSpreadsheet().toast(bookings.length + ' bookings synced.', 'Practice Room Schedule \\u2713', 5);
  } catch(err) { ui.alert('Sync failed', err.message, ui.ButtonSet.OK); }
}

function _ensurePracticeRoomsSheet(ss) {
  var sheet = ss.getSheetByName(ROOMS_SHEET);
  if (!sheet) sheet = ss.insertSheet(ROOMS_SHEET);
  return sheet;
}

function _writePracticeRoomsSheet(bookings) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(ROOMS_SHEET) || ss.insertSheet(ROOMS_SHEET);
  sheet.clearContents();
  sheet.clearFormats();
  var headers = ['Date', 'Start Time', 'End Time', 'Room', 'Student', 'Email', 'Status'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setBackground(C.navy).setFontColor(C.white).setFontWeight('bold');
  sheet.setFrozenRows(1);
  if (!bookings.length) return;
  var values = bookings.map(function(b) {
    return [b.date || '', b.startTime || '', b.endTime || '', b.roomName || '', b.studentName || '', b.studentEmail || '', b.status || ''];
  });
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  var rowBgs = values.map(function(_, i) {
    var bg = i % 2 === 0 ? C.white : C.altRow;
    return Array(headers.length).fill(bg);
  });
  sheet.getRange(2, 1, values.length, headers.length).setBackgrounds(rowBgs);
}

// ── Practice Hours ────────────────────────────────────────────────────────────

function syncPracticeHours() {
  var ui    = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var appUrl = props.getProperty('APP_URL');
  var apiKey = props.getProperty('API_KEY');
  if (!appUrl || !apiKey) {
    ui.alert('Not configured', 'Run MUSE INC Sync > Settings > Setup App Connection first.', ui.ButtonSet.OK);
    return;
  }
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast('Fetching practice hours\\u2026', 'MUSE INC Sync', 30);
    var res = UrlFetchApp.fetch(appUrl + '/_api/sheets/practice-hours-export', {
      method: 'get',
      headers: { 'x-api-key': apiKey },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) throw new Error('Hours export failed ' + res.getResponseCode() + ': ' + res.getContentText());
    var parsed   = parseSuperJSON(res.getContentText());
    var students = (parsed && parsed.students) || [];
    _writePracticeHoursSheet(students);
    SpreadsheetApp.getActiveSpreadsheet().toast(students.length + ' students synced.', 'Practice Hours \\u2713', 5);
  } catch(err) { ui.alert('Sync failed', err.message, ui.ButtonSet.OK); }
}

function pushPracticeHourOverrides() {
  var ui    = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();
  var appUrl = props.getProperty('APP_URL');
  var apiKey = props.getProperty('API_KEY');
  if (!appUrl || !apiKey) {
    ui.alert('Not configured', 'Run MUSE INC Sync > Settings > Setup App Connection first.', ui.ButtonSet.OK);
    return;
  }
  try {
    var rows = _readPracticeHoursSheet();
    if (!rows.length) { ui.alert('No data', 'Run Sync Practice Hours first.', ui.ButtonSet.OK); return; }
    var confirm = ui.alert('Confirm Push', 'Push hour overrides for ' + rows.length + ' students?', ui.ButtonSet.YES_NO);
    if (confirm !== ui.Button.YES) return;
    SpreadsheetApp.getActiveSpreadsheet().toast('Pushing overrides\\u2026', 'MUSE INC Sync', 30);
    var r = UrlFetchApp.fetch(appUrl + '/_api/sheets/import', {
      method: 'post',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ json: { table: 'practiceHours', rows: rows } }),
      muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) throw new Error('Push failed: ' + r.getContentText());
    var result = parseSuperJSON(r.getContentText());
    ui.alert('Done', 'Overrides updated for ' + (result.count || rows.length) + ' students.', ui.ButtonSet.OK);
  } catch(err) { ui.alert('Push failed', err.message, ui.ButtonSet.OK); }
}

function _ensurePracticeHoursSheet(ss) {
  var sheet = ss.getSheetByName(HOURS_SHEET);
  if (!sheet) sheet = ss.insertSheet(HOURS_SHEET);
  return sheet;
}

function _writePracticeHoursSheet(students) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(HOURS_SHEET) || ss.insertSheet(HOURS_SHEET);
  sheet.clearContents();
  sheet.clearFormats();
  sheet.setConditionalFormatRules([]);
  var headers = ['Student Name', 'Email', 'Hours Used', 'Hours Remaining', 'Total Allotted', 'Override Total', 'Period Start', 'User ID'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    .setBackground(C.navy).setFontColor(C.white).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.hideColumns(PH_COL_USERID);
  if (!students.length) return;
  var values = students.map(function(s) {
    return [
      s.studentName || '',
      s.email || '',
      s.hoursUsed || 0,
      s.hoursRemaining || 0,
      s.effectiveTotal || 30,
      (s.overrideTotal !== null && s.overrideTotal !== undefined) ? s.overrideTotal : '',
      s.periodStart || '',
      s.userId || '',
    ];
  });
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
  // Read-only columns
  [PH_COL_NAME, PH_COL_EMAIL, PH_COL_USED, PH_COL_REMAINING, PH_COL_TOTAL, PH_COL_PERIOD, PH_COL_USERID].forEach(function(col) {
    sheet.getRange(2, col, values.length, 1).setBackground(C.readonly);
  });
  // Override Total is editable
  sheet.getRange(2, PH_COL_OVERRIDE, values.length, 1).setBackground(C.inputBg);
  // Conditional formatting on Hours Remaining
  var remRange = sheet.getRange(2, PH_COL_REMAINING, values.length, 1);
  var rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberEqualTo(0)
    .setBackground('#fde8e8').setFontColor('#cc0000')
    .setRanges([remRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThanOrEqualTo(5)
    .setBackground('#fff7e0').setFontColor('#856404')
    .setRanges([remRange]).build());
  sheet.setConditionalFormatRules(rules);
  sheet.autoResizeColumns(1, 7);
}

function _readPracticeHoursSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(HOURS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, PH_COL_COUNT).getValues();
  var rows = [];
  data.forEach(function(r) {
    var userId = r[PH_COL_USERID - 1];
    if (!userId) return;
    var ov = r[PH_COL_OVERRIDE - 1];
    rows.push({ userId: userId, overrideTotal: (ov !== '' && ov !== null && ov !== undefined) ? ov : null });
  });
  return rows;
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
