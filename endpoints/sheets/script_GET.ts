import { schema } from "./script_GET.schema";

const GOOGLE_APPS_SCRIPT_CONTENT = `/**
 * MUSE INC Sheets Sync v2
 * Sheets: MasterEnrollments + Events
 * Features: Two-way app sync, Google Calendar integration, instructor notifications
 */

const MASTER_SHEET = "MasterEnrollments";
const EVENTS_SHEET = "Events";
const MAX_LESSONS = 16;
const CALENDAR_NAME = "MUSE INC Schedule";
const LESSON_DURATION_HOURS = 1; // Change to 1.5 or 2 if your lessons are longer

// ─── Menu ────────────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("MUSE INC Sync")
    .addItem("Setup App Connection", "setup")
    .addItem("Setup Google Calendar", "setupCalendar")
    .addSeparator()
    .addItem("Pull From App", "pullFromApp")
    .addItem("Push To App", "pushToApp")
    .addSeparator()
    .addItem("Sync Lessons to Google Calendar", "syncToCalendar")
    .addItem("Sync Events to Google Calendar", "syncEventsToCalendar")
    .addSeparator()
    .addItem("View Monthly Calendar", "renderMonthCalendar")
    .addItem("View Instructor Audit", "renderAuditSheet")
    .addToUi();
}

// ─── onEdit trigger ──────────────────────────────────────────────────────────

/**
 * Automatically fills all lessonNInstructor columns when instructorEmail is
 * set or changed on a MasterEnrollments row.
 *
 * Column layout (1-indexed):
 *   11 = instructorName  |  12 = instructorEmail
 *   14 = lesson1Instructor, 17 = lesson2Instructor, ... (+3 per lesson)
 *
 * Cells that already have a per-lesson override are left untouched.
 * To force-overwrite all, clear the lessonNInstructor cells first, then
 * re-enter the instructorEmail.
 */
function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  if (sheet.getName() !== MASTER_SHEET) return;

  var col = range.getColumn();
  var row = range.getRow();

  // React only to instructorEmail column (col 12) and not the header row
  if (col !== 12 || row < 2) return;

  // Read instructorName from col 11 on the same row
  var instructorName = sheet.getRange(row, 11).getValue();

  // Fill empty lessonNInstructor cells: col 14, 17, 20 ... (14 + i*3)
  for (var i = 0; i < MAX_LESSONS; i++) {
    var instrCol = 14 + (i * 3);
    var cell = sheet.getRange(row, instrCol);
    if (!cell.getValue()) {
      cell.setValue(instructorName);
    }
  }
}

// ─── Setup ───────────────────────────────────────────────────────────────────

function setup() {
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();

  const urlResponse = ui.prompt(
    "Setup",
    "Enter your App URL (e.g., https://myapp.example.com):",
    ui.ButtonSet.OK_CANCEL
  );
  if (urlResponse.getSelectedButton() !== ui.Button.OK) return;

  let appUrl = urlResponse.getResponseText().trim();
  if (appUrl.endsWith("/")) appUrl = appUrl.slice(0, -1);

  const keyResponse = ui.prompt(
    "Setup",
    "Enter your API Key:",
    ui.ButtonSet.OK_CANCEL
  );
  if (keyResponse.getSelectedButton() !== ui.Button.OK) return;

  scriptProperties.setProperty("APP_URL", appUrl);
  scriptProperties.setProperty("API_KEY", keyResponse.getResponseText().trim());

  ui.alert("App connection configured.");
}

function setupCalendar() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  const calendars = CalendarApp.getCalendarsByName(CALENDAR_NAME);
  let calendar;
  if (calendars.length > 0) {
    calendar = calendars[0];
    props.setProperty("CALENDAR_ID", calendar.getId());
    ui.alert(
      'Using existing calendar: "' + CALENDAR_NAME + '"\\n\\n' +
      "Calendar ID saved.\\n\\n" +
      "To share with instructors: open Google Calendar, find \\"" + CALENDAR_NAME + "\\"" +
      ", click the three-dot menu, choose Settings and sharing, then Share with specific people."
    );
  } else {
    calendar = CalendarApp.createCalendar(CALENDAR_NAME, {
      color: CalendarApp.Color.TEAL,
      summary: "MUSE INC lesson schedule — auto-synced from the scheduling app",
    });
    props.setProperty("CALENDAR_ID", calendar.getId());
    ui.alert(
      'Created calendar: "' + CALENDAR_NAME + '"\\n\\n' +
      "Calendar ID: " + calendar.getId() + "\\n\\n" +
      "Share this calendar with your instructors via Google Calendar settings so they can see their schedule.\\n\\n" +
      "TIP: If you add instructor email addresses to the sheet, they will be invited as guests to their lesson events automatically."
    );
  }
}

// ─── Pull / Push ─────────────────────────────────────────────────────────────

function pullFromApp() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const appUrl = props.getProperty("APP_URL");
  const apiKey = props.getProperty("API_KEY");

  if (!appUrl || !apiKey) {
    ui.alert("Please run Setup first.");
    return;
  }

  try {
    // Snapshot existing sheet data BEFORE pulling so we can preserve manual entries
    var existingByEnrollmentId = {};
    try {
      var existingRows = readSheetRows(MASTER_SHEET);
      existingRows.forEach(function(row) {
        if (row.enrollmentId) {
          existingByEnrollmentId[String(row.enrollmentId)] = row;
        }
      });
    } catch(e) {
      // Sheet may not exist yet — that is fine
    }

    const response = UrlFetchApp.fetch(\`\${appUrl}/_api/sheets/export\`, {
      method: "post",
      headers: { "x-api-key": apiKey },
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      throw new Error(\`Export failed \${response.getResponseCode()}: \${response.getContentText()}\`);
    }

    const parsed = parseSuperJSON(response.getContentText());
    const enrollmentRows = parsed?.data?.flattenedEnrollments || [];
    const eventsRows = parsed?.data?.events || [];

    // Merge: preserve instructor columns and lesson dates from existing sheet
    // when the server returns empty (e.g. instructor not yet linked in the app)
    var PRESERVE_IF_EMPTY = ["instructorId", "instructorName", "instructorEmail"];
    var mergedRows = enrollmentRows.map(function(row) {
      var eid = String(row.enrollmentId || "");
      var existing = existingByEnrollmentId[eid];
      if (!existing) return row;

      var merged = {};
      Object.keys(row).forEach(function(k) { merged[k] = row[k]; });

      // Keep manually-entered instructor info if server has none
      PRESERVE_IF_EMPTY.forEach(function(field) {
        if (!merged[field] && existing[field]) {
          merged[field] = existing[field];
        }
      });

      // Dates: sheet is always the source of truth for existing rows.
      // If the user deleted a date (cell is null/empty), that deletion is respected —
      // the server value is NOT restored. Only new rows (not yet in the sheet) get
      // their dates filled from the server.
      for (var i = 1; i <= MAX_LESSONS; i++) {
        var dtKey = "lesson" + i + "DateTime";
        var instrKey = "lesson" + i + "Instructor";
        var statusKey = "lesson" + i + "Status";
        // Use sheet value if the key exists (null = deliberately deleted)
        if (dtKey in existing) merged[dtKey] = existing[dtKey];
        if (!merged[instrKey] && existing[instrKey]) merged[instrKey] = existing[instrKey];
        // Status: server value always wins (it's computed from DB); only fall back if server sends nothing
        if (!merged[statusKey] && existing[statusKey]) merged[statusKey] = existing[statusKey];
      }

      return merged;
    });

    const cancellationRows = parsed?.data?.lessonCancellations || [];

    writeSheetRows(MASTER_SHEET, buildEnrollmentHeaders(), mergedRows);
    writeSheetRows(EVENTS_SHEET, buildEventHeaders(), eventsRows);
    if (cancellationRows.length > 0) {
      writeSheetRows("Cancellations", buildCancellationHeaders(), cancellationRows);
    }

    ui.alert("Pull complete: " + mergedRows.length + " enrollment row(s), " + eventsRows.length + " event(s)" + (cancellationRows.length > 0 ? ", " + cancellationRows.length + " cancellation(s)" : ""));
  } catch (error) {
    ui.alert("Pull failed: " + error.message);
  }
}

function pushToApp() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const appUrl = props.getProperty("APP_URL");
  const apiKey = props.getProperty("API_KEY");

  if (!appUrl || !apiKey) {
    ui.alert("Please run Setup first.");
    return;
  }

  try {
    const enrollmentRows = readSheetRows(MASTER_SHEET);
    const eventsRows = readSheetRows(EVENTS_SHEET, true);

    const enrollmentPayload = { json: { table: "flattenedEnrollments", rows: enrollmentRows } };
    const enrollmentsResponse = UrlFetchApp.fetch(\`\${appUrl}/_api/sheets/import\`, {
      method: "post",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      payload: JSON.stringify(enrollmentPayload),
      muteHttpExceptions: true,
    });

    if (enrollmentsResponse.getResponseCode() !== 200) {
      throw new Error(\`Enrollments import failed \${enrollmentsResponse.getResponseCode()}: \${enrollmentsResponse.getContentText()}\`);
    }

    const eventsPayload = { json: { table: "events", rows: eventsRows } };
    const eventsResponse = UrlFetchApp.fetch(\`\${appUrl}/_api/sheets/import\`, {
      method: "post",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      payload: JSON.stringify(eventsPayload),
      muteHttpExceptions: true,
    });

    if (eventsResponse.getResponseCode() !== 200) {
      throw new Error(\`Events import failed \${eventsResponse.getResponseCode()}: \${eventsResponse.getContentText()}\`);
    }

    // After a successful push, offer to also sync to Google Calendar
    const calendarId = props.getProperty("CALENDAR_ID");
    if (calendarId) {
      const choice = ui.alert(
        "Push complete",
        enrollmentRows.length + " enrollment(s) and " + eventsRows.length + " event(s) pushed to the app. Instructors have been notified of any new lesson schedules.\\n\\nAlso sync to Google Calendar now?",
        ui.ButtonSet.YES_NO
      );
      if (choice === ui.Button.YES) {
        syncToCalendar();
        syncEventsToCalendar();
      }
    } else {
      ui.alert(
        "Push complete: " + enrollmentRows.length + " enrollment(s), " + eventsRows.length + " event(s)\\n\\n" +
        "Tip: Run Setup Google Calendar to automatically create calendar events for each lesson."
      );
    }
  } catch (error) {
    ui.alert("Push failed: " + error.message);
  }
}

// ─── Google Calendar Sync ────────────────────────────────────────────────────

/**
 * Syncs all scheduled lessons from the MasterEnrollments sheet to Google Calendar.
 * Creates a new event if none exists, or updates the existing one.
 * If the instructor's email is in the sheet, they are added as a guest
 * so the event appears in their personal Google Calendar automatically.
 */
function syncToCalendar() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const calendarId = props.getProperty("CALENDAR_ID");
  const appUrl = props.getProperty("APP_URL") || "";
  const apiKey = props.getProperty("API_KEY") || "";

  if (!calendarId) {
    ui.alert('Please run "Setup Google Calendar" first.');
    return;
  }

  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    ui.alert("Calendar not found. Please run Setup Google Calendar again.");
    return;
  }

  const rows = readSheetRows(MASTER_SHEET);
  let created = 0;
  let updated = 0;

  rows.forEach(function(row) {
    const studentName = row.studentName || "Unknown Student";
    const studentEmail = row.email || "";
    const courseName = row.courseName || "Unknown Course";
    const instructorName = row.instructorName || "";
    const instructorEmail = row.instructorEmail || "";
    const enrollmentId = row.enrollmentId;

    for (var i = 1; i <= MAX_LESSONS; i++) {
      const dateTimeVal = row["lesson" + i + "DateTime"];
      if (!dateTimeVal) continue;

      const lessonDate = new Date(dateTimeVal);
      if (isNaN(lessonDate.getTime())) continue;

      const endDate = new Date(lessonDate.getTime() + LESSON_DURATION_HOURS * 60 * 60 * 1000);

      // Unique tag embedded in description so we can find/update this event later
      const uniqueTag = "[muse:" + enrollmentId + ":" + i + "]";
      const title = courseName + " — Lesson " + i + " | " + studentName;

      // Cancel link — signed with HMAC so only valid for this lesson
      var cancelLink = (appUrl && apiKey)
        ? makeCancelLink(appUrl, apiKey, enrollmentId, i)
        : "";

      const descLines = [
        "Student: " + studentName,
        "Course: " + courseName,
        "Lesson: " + i,
      ];
      if (instructorName) descLines.push("Instructor: " + instructorName);
      if (cancelLink) {
        descLines.push("");
        descLines.push("Need to cancel? Click the link below (>24h: auto-approved | <24h: late cancel fee may apply):");
        descLines.push(cancelLink);
      }
      descLines.push("");
      descLines.push(uniqueTag);
      const description = descLines.join("\\n");

      // Combine all guest emails (instructor + student)
      const guestList = [instructorEmail, studentEmail].filter(function(e) { return !!e; });
      const guestsStr = guestList.join(",");

      // Search only on the same day — much faster than a full calendar scan
      const dayStart = new Date(lessonDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(lessonDate);
      dayEnd.setHours(23, 59, 59, 999);

      const existingEvents = calendar.getEvents(dayStart, dayEnd).filter(function(e) {
        return e.getDescription().indexOf(uniqueTag) !== -1;
      });

      if (existingEvents.length > 0) {
        const event = existingEvents[0];
        event.setTitle(title);
        event.setTime(lessonDate, endDate);
        event.setDescription(description);
        // Add instructor and student as guests if not already present
        const existingGuestEmails = event.getGuestList().map(function(g) { return g.getEmail(); });
        guestList.forEach(function(email) {
          if (existingGuestEmails.indexOf(email) === -1) {
            event.addGuest(email);
          }
        });
        updated++;
      } else {
        const opts = { description: description };
        if (guestsStr) opts.guests = guestsStr;
        calendar.createEvent(title, lessonDate, endDate, opts);
        created++;
      }
    }
  });

  ui.alert(
    "Calendar sync complete!\\n\\n" +
    "Created: " + created + " new lesson event(s)\\n" +
    "Updated: " + updated + " existing event(s)\\n\\n" +
    (created + updated > 0
      ? "Instructors and students with emails in the sheet have been invited as calendar guests."
      : "No scheduled lessons found.")
  );
}

/**
 * Syncs events from the Events sheet to Google Calendar.
 */
function syncEventsToCalendar() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const calendarId = props.getProperty("CALENDAR_ID");

  if (!calendarId) {
    ui.alert('Please run "Setup Google Calendar" first.');
    return;
  }

  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) {
    ui.alert("Calendar not found. Please run Setup Google Calendar again.");
    return;
  }

  const rows = readSheetRows(EVENTS_SHEET, true);
  let created = 0;
  let updated = 0;

  rows.forEach(function(row) {
    if (!row.title || !row.startAt) return;

    const startDate = new Date(row.startAt);
    if (isNaN(startDate.getTime())) return;

    // Default event duration: 2 hours if no end time provided
    const endDate = row.endAt ? new Date(row.endAt) : new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

    const uniqueTag = "[muse_event:" + row.id + "]";
    const description = (row.caption ? row.caption + "\\n" : "") + uniqueTag;

    const dayStart = new Date(startDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(startDate);
    dayEnd.setHours(23, 59, 59, 999);

    const existingEvents = calendar.getEvents(dayStart, dayEnd).filter(function(e) {
      return e.getDescription().indexOf(uniqueTag) !== -1;
    });

    if (existingEvents.length > 0) {
      const event = existingEvents[0];
      event.setTitle(row.title);
      event.setTime(startDate, endDate);
      event.setDescription(description);
      updated++;
    } else {
      calendar.createEvent(row.title, startDate, endDate, { description: description });
      created++;
    }
  });

  ui.alert("Events calendar sync complete!\\n\\nCreated: " + created + "\\nUpdated: " + updated);
}

// ─── Instructor Audit ────────────────────────────────────────────────────────

/**
 * Builds an Audit worksheet showing how many lessons each instructor taught
 * within a user-entered date range, with a full lesson-by-lesson detail section.
 */
function renderAuditSheet() {
  const ui = SpreadsheetApp.getUi();

  const startRes = ui.prompt("Instructor Audit", "Start date (DD/MM/YYYY):", ui.ButtonSet.OK_CANCEL);
  if (startRes.getSelectedButton() !== ui.Button.OK) return;

  const endRes = ui.prompt("Instructor Audit", "End date (DD/MM/YYYY):", ui.ButtonSet.OK_CANCEL);
  if (endRes.getSelectedButton() !== ui.Button.OK) return;

  function parseVNDate(str) {
    var parts = str.trim().split("/");
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  }

  var startDate = parseVNDate(startRes.getResponseText());
  var endDate = parseVNDate(endRes.getResponseText());

  if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    ui.alert("Invalid dates. Please use DD/MM/YYYY format (e.g. 01/04/2026).");
    return;
  }
  endDate.setHours(23, 59, 59, 999);

  var rows = readSheetRows(MASTER_SHEET);

  // { instructorName: [{student, course, lessonNum, date, enrollmentId}] }
  var instructorLessons = {};

  rows.forEach(function(row) {
    for (var i = 1; i <= MAX_LESSONS; i++) {
      var dateVal = row["lesson" + i + "DateTime"];
      var status = (row["lesson" + i + "Status"] || "").trim().toLowerCase();
      // Per-lesson instructor takes priority; fall back to course-level instructor
      var instrName = (row["lesson" + i + "Instructor"] || row.instructorName || "").trim();
      if (!dateVal || !instrName) continue;
      if (status === "cancelled") continue; // skip cancelled lessons

      var lessonDate = new Date(dateVal);
      if (isNaN(lessonDate.getTime())) continue;
      if (lessonDate < startDate || lessonDate > endDate) continue;

      if (!instructorLessons[instrName]) instructorLessons[instrName] = [];
      instructorLessons[instrName].push({
        student: row.studentName || "",
        course: row.courseName || "",
        lessonNum: i,
        date: lessonDate,
      });
    }
  });

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var auditSheet = ss.getSheetByName("Audit");
  if (!auditSheet) auditSheet = ss.insertSheet("Audit");
  auditSheet.clear();
  auditSheet.clearFormats();

  var startStr = startRes.getResponseText().trim();
  var endStr = endRes.getResponseText().trim();
  var instructorNames = Object.keys(instructorLessons).sort();
  var totalLessons = instructorNames.reduce(function(s, n) { return s + instructorLessons[n].length; }, 0);

  // ── Title ────────────────────────────────────────────────────────────────
  auditSheet.getRange(1, 1, 1, 5).merge()
    .setValue("MUSE INC — Instructor Audit: " + startStr + " to " + endStr)
    .setBackground("#1a2744").setFontColor("#ffffff")
    .setFontWeight("bold").setFontSize(14)
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  auditSheet.setRowHeight(1, 44);

  // ── Summary table ────────────────────────────────────────────────────────
  var r = 3;
  auditSheet.getRange(r, 1, 1, 3).setValues([["Instructor", "Lessons Taught", "Period"]])
    .setFontWeight("bold").setBackground("#2c3e6b").setFontColor("#ffffff");
  auditSheet.setRowHeight(r, 28);
  r++;

  if (instructorNames.length === 0) {
    auditSheet.getRange(r, 1).setValue("No lessons found in this period.");
    r++;
  } else {
    instructorNames.forEach(function(name) {
      auditSheet.getRange(r, 1, 1, 3).setValues([[name, instructorLessons[name].length, startStr + " — " + endStr]]);
      r++;
    });
    // Totals row
    auditSheet.getRange(r, 1, 1, 2).setValues([["TOTAL", totalLessons]])
      .setFontWeight("bold").setBackground("#e8f4fd");
    r++;
  }

  r += 2;

  // ── Detail table ─────────────────────────────────────────────────────────
  auditSheet.getRange(r, 1, 1, 5).setValues([["Instructor", "Student", "Course", "Lesson #", "Date & Time"]])
    .setFontWeight("bold").setBackground("#2c3e6b").setFontColor("#ffffff");
  auditSheet.setRowHeight(r, 28);
  r++;

  instructorNames.forEach(function(name) {
    var lessons = instructorLessons[name].slice().sort(function(a, b) { return a.date - b.date; });
    var groupStart = r;

    lessons.forEach(function(l) {
      auditSheet.getRange(r, 1, 1, 5).setValues([[name, l.student, l.course, "Lesson " + l.lessonNum, l.date]]);
      auditSheet.getRange(r, 5).setNumberFormat("d/M/yyyy h:mm am/pm");
      r++;
    });

    // Instructor subtotal
    auditSheet.getRange(r, 1, 1, 2).setValues([["Subtotal: " + name, lessons.length]])
      .setFontWeight("bold").setBackground("#e8f4fd");
    r++;
  });

  auditSheet.autoResizeColumns(1, 5);
  auditSheet.setFrozenRows(1);
  ss.setActiveSheet(auditSheet);

  ui.alert(
    "Audit complete!\\n\\n" +
    "Period: " + startStr + " — " + endStr + "\\n" +
    "Total lessons: " + totalLessons + "\\n" +
    "Instructors: " + instructorNames.join(", ")
  );
}

// ─── Monthly Calendar View ───────────────────────────────────────────────────

/**
 * Renders a visual monthly calendar in the "Monthly Calendar" sheet tab.
 * Each day cell shows all lessons scheduled that day.
 * Prompts for month and year, then rebuilds the grid.
 */
function renderMonthCalendar() {
  const ui = SpreadsheetApp.getUi();
  const now = new Date();

  const monthRes = ui.prompt(
    "Monthly Calendar",
    "Enter month number (1–12):",
    ui.ButtonSet.OK_CANCEL
  );
  if (monthRes.getSelectedButton() !== ui.Button.OK) return;

  const yearRes = ui.prompt(
    "Monthly Calendar",
    "Enter year (e.g. " + now.getFullYear() + "):",
    ui.ButtonSet.OK_CANCEL
  );
  if (yearRes.getSelectedButton() !== ui.Button.OK) return;

  const month = parseInt(monthRes.getResponseText().trim(), 10);
  const year = parseInt(yearRes.getResponseText().trim(), 10);

  if (isNaN(month) || month < 1 || month > 12 || isNaN(year) || year < 2020) {
    ui.alert("Invalid month or year. Please enter a month 1–12 and a 4-digit year.");
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let calSheet = ss.getSheetByName("Monthly Calendar");
  if (!calSheet) calSheet = ss.insertSheet("Monthly Calendar");

  calSheet.clear();
  calSheet.clearFormats();

  // ── Gather lessons for this month ──────────────────────────────────────────

  const rows = readSheetRows(MASTER_SHEET);
  const lessonsByDay = {}; // "YYYY-MM-DD" → [{time, student, course, instructor}]

  rows.forEach(function(row) {
    const studentName = row.studentName || "Unknown";
    const courseName  = row.courseName  || "Unknown";
    const instrName   = row.instructorName || "";

    for (var i = 1; i <= MAX_LESSONS; i++) {
      const dtVal = row["lesson" + i + "DateTime"];
      if (!dtVal) continue;
      const dt = new Date(dtVal);
      if (isNaN(dt.getTime())) continue;
      if (dt.getFullYear() !== year || dt.getMonth() + 1 !== month) continue;

      const dayKey = year + "-" +
        String(month).padStart(2, "0") + "-" +
        String(dt.getDate()).padStart(2, "0");

      const h = dt.getHours(), m = dt.getMinutes();
      const ampm = h >= 12 ? "PM" : "AM";
      const h12 = h % 12 || 12;
      const timeStr = h12 + ":" + String(m).padStart(2, "0") + " " + ampm;

      if (!lessonsByDay[dayKey]) lessonsByDay[dayKey] = [];
      lessonsByDay[dayKey].push({
        time: timeStr,
        student: studentName,
        course: courseName,
        instructor: instrName,
      });
    }
  });

  // Sort each day's lessons by time
  Object.keys(lessonsByDay).forEach(function(k) {
    lessonsByDay[k].sort(function(a, b) { return a.time < b.time ? -1 : 1; });
  });

  // ── Build week grid data ───────────────────────────────────────────────────

  const MONTH_NAMES = ["January","February","March","April","May","June",
                       "July","August","September","October","November","December"];
  const DAY_NAMES   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDow    = new Date(year, month - 1, 1).getDay(); // 0=Sun

  // Build weeks: each week is array of 7 {day, lessons} objects
  const weeks = [];
  let week = [];

  // Leading empty days
  for (var d = 0; d < startDow; d++) week.push({ day: 0, lessons: [] });

  for (var day = 1; day <= daysInMonth; day++) {
    const dayKey = year + "-" +
      String(month).padStart(2, "0") + "-" +
      String(day).padStart(2, "0");
    week.push({ day: day, lessons: lessonsByDay[dayKey] || [] });
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  // Trailing empty days
  while (week.length < 7 && week.length > 0) week.push({ day: 0, lessons: [] });
  if (week.length > 0) weeks.push(week);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Title row (spans all 7 columns)
  calSheet.getRange(1, 1, 1, 7).merge()
    .setValue(MONTH_NAMES[month - 1] + " " + year + " — MUSE INC Schedule")
    .setBackground("#1a2744").setFontColor("#ffffff")
    .setFontWeight("bold").setFontSize(14)
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  calSheet.setRowHeight(1, 44);

  // Day-of-week header row
  for (var col = 0; col < 7; col++) {
    calSheet.getRange(2, col + 1)
      .setValue(DAY_NAMES[col])
      .setBackground("#2c3e6b").setFontColor("#ffffff")
      .setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle");
  }
  calSheet.setRowHeight(2, 28);

  // Week rows
  weeks.forEach(function(wk, wkIdx) {
    const sheetRow = wkIdx + 3;

    // Row height = tallest day in the week
    const maxLessons = Math.max.apply(null, wk.map(function(d) { return d.lessons.length; }));
    const rowH = Math.max(72, 36 + maxLessons * 22);
    calSheet.setRowHeight(sheetRow, rowH);

    wk.forEach(function(dayObj, colIdx) {
      const cell = calSheet.getRange(sheetRow, colIdx + 1);

      if (dayObj.day === 0) {
        // Empty padding cell
        cell.setBackground("#f0f0f0");
        return;
      }

      const hasLessons = dayObj.lessons.length > 0;
      const lines = [String(dayObj.day)];
      dayObj.lessons.forEach(function(l) {
        lines.push(l.time + "  " + l.student);
        lines.push("  " + l.course + (l.instructor ? " · " + l.instructor : ""));
      });

      cell.setValue(lines.join("\\n"));
      cell.setWrap(true).setVerticalAlignment("top");
      cell.setBackground(hasLessons ? "#ddeeff" : "#ffffff");

      // Bold the date number via RichTextValue
      try {
        const rt = SpreadsheetApp.newRichTextValue()
          .setText(lines.join("\\n"))
          .setTextStyle(0, String(dayObj.day).length,
            SpreadsheetApp.newTextStyle().setBold(true).setFontSize(11).build())
          .build();
        cell.setRichTextValue(rt);
      } catch(e) {
        // RichText not supported in all contexts — plain text fallback already set
      }

      cell.setBorder(true, true, true, true, false, false,
        "#cccccc", SpreadsheetApp.BorderStyle.SOLID);
    });
  });

  // Column widths
  for (var c = 1; c <= 7; c++) calSheet.setColumnWidth(c, 155);
  calSheet.setFrozenRows(2);

  // Bring the sheet to front
  ss.setActiveSheet(calSheet);

  ui.alert(
    "Monthly Calendar refreshed!\\n\\n" +
    MONTH_NAMES[month - 1] + " " + year + "\\n" +
    "Days with lessons are highlighted blue.\\n\\n" +
    "Run \\"View Monthly Calendar\\" again to switch month."
  );
}

// ─── Cancel Link Helpers ──────────────────────────────────────────────────────

/**
 * Generates a signed cancellation URL for a specific lesson.
 * Uses HMAC-SHA256 with the stored API key as the secret —
 * the same key already stored in script properties.
 */
function makeCancelLink(appUrl, apiKey, enrollmentId, lessonNumber) {
  var message = enrollmentId + ":" + lessonNumber;
  var keyBytes = Utilities.newBlob(apiKey).getBytes();
  var msgBytes = Utilities.newBlob(message).getBytes();
  var hmacBytes = Utilities.computeHmacSha256Signature(msgBytes, keyBytes);
  var sig = hmacBytes.map(function(b) {
    return ("0" + (b < 0 ? b + 256 : b).toString(16)).slice(-2);
  }).join("");
  return appUrl + "/_api/lessons/cancel?e=" + enrollmentId + "&l=" + lessonNumber + "&sig=" + sig;
}

// ─── Sheet Helpers ───────────────────────────────────────────────────────────

function buildCancellationHeaders() {
  return [
    "enrollmentId", "lessonNumber", "studentName", "studentEmail",
    "courseName", "scheduledAt", "cancelledAt", "hoursNotice", "isLate"
  ];
}

function buildEnrollmentHeaders() {
  const headers = [
    "enrollmentId",
    "userId",
    "courseId",
    "studentName",
    "phone",
    "email",
    "courseName",
    "totalLessons",
    "enrollmentStatus",
    // Instructor columns — filled automatically on Pull, editable for re-assignment
    "instructorId",
    "instructorName",
    "instructorEmail",
  ];

  for (var i = 1; i <= MAX_LESSONS; i++) {
    headers.push("lesson" + i + "DateTime");
    headers.push("lesson" + i + "Instructor");
    headers.push("lesson" + i + "Status");
  }

  return headers;
}

function buildEventHeaders() {
  return ["id", "title", "caption", "flyerUrl", "startAt", "endAt", "isActive"];
}

// Columns that should be displayed as human-readable date/time
function isDateTimeHeader(h) {
  return /^lesson\d+DateTime$/.test(h) || h === "startAt" || h === "endAt" || h === "scheduledAt" || h === "cancelledAt";
}

function writeSheetRows(sheetName, headers, rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  // Find which column indices are date/time columns
  const dateColIndices = [];
  headers.forEach(function(h, idx) {
    if (isDateTimeHeader(h)) dateColIndices.push(idx);
  });

  const values = [headers];
  rows.forEach(function(row) {
    values.push(headers.map(function(h, idx) {
      const raw = row[h];
      // Convert ISO strings in date columns to actual Date objects so Sheets
      // stores them as date values (displayed in the sheet's local timezone)
      if (dateColIndices.indexOf(idx) !== -1 && raw && typeof raw === "string") {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d;
      }
      return normalizeCell(raw);
    }));
  });

  sheet.clear();
  const numRows = values.length || 1;
  sheet.getRange(1, 1, numRows, headers.length).setValues(values.length ? values : [headers]);

  // Format date/time columns as "M/d/yyyy h:mm am/pm" (Vietnam local time)
  if (values.length > 1) {
    dateColIndices.forEach(function(idx) {
      sheet.getRange(2, idx + 1, values.length - 1, 1)
        .setNumberFormat("d/M/yyyy h:mm am/pm");
    });
  }

  // Style the header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#1a2744");
  headerRange.setFontColor("#ffffff");
  sheet.setFrozenRows(1);

  // Highlight instructor columns in light blue so they stand out
  const instructorCols = ["instructorId", "instructorName", "instructorEmail"];
  instructorCols.forEach(function(col) {
    const idx = headers.indexOf(col);
    if (idx >= 0 && values.length > 1) {
      sheet.getRange(2, idx + 1, values.length - 1, 1).setBackground("#e8f4fd");
    }
  });

  sheet.autoResizeColumns(1, headers.length);
}

function readSheetRows(sheetName, allowMissing) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    if (allowMissing) return [];
    throw new Error("Missing sheet: " + sheetName);
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];

  const headers = data[0].map(String);
  const rows = [];

  for (var i = 1; i < data.length; i++) {
    const obj = {};
    let hasData = false;
    for (var c = 0; c < headers.length; c++) {
      const key = headers[c];
      if (!key) continue;
      let value = data[i][c];
      if (value instanceof Date) value = value.toISOString();
      if (value === "") value = null;
      obj[key] = value;
      if (value !== null && value !== undefined) hasData = true;
    }
    if (hasData) rows.push(obj);
  }

  return rows;
}

function normalizeCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return value.toISOString();
  return value;
}

function parseSuperJSON(text) {
  const raw = JSON.parse(text);
  return raw && raw.json ? raw.json : raw;
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
