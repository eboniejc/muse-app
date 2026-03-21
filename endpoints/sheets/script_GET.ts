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
    .addToUi();
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

    writeSheetRows(MASTER_SHEET, buildEnrollmentHeaders(), enrollmentRows);
    writeSheetRows(EVENTS_SHEET, buildEventHeaders(), eventsRows);

    ui.alert("Pull complete: " + enrollmentRows.length + " enrollment row(s), " + eventsRows.length + " event(s)");
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

      const descLines = [
        "Student: " + studentName,
        "Course: " + courseName,
        "Lesson: " + i,
      ];
      if (instructorName) descLines.push("Instructor: " + instructorName);
      descLines.push(uniqueTag);
      const description = descLines.join("\\n");

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
        // Add instructor as guest if not already present
        if (instructorEmail) {
          const guestEmails = event.getGuestList().map(function(g) { return g.getEmail(); });
          if (guestEmails.indexOf(instructorEmail) === -1) {
            event.addGuest(instructorEmail);
          }
        }
        updated++;
      } else {
        const opts = { description: description };
        if (instructorEmail) opts.guests = instructorEmail;
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
      ? "Instructors with email addresses in the sheet have been invited as calendar guests."
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

// ─── Sheet Helpers ───────────────────────────────────────────────────────────

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
    headers.push("lesson" + i + "Ebook");
    headers.push("lesson" + i + "EbookUnlocked");
  }

  return headers;
}

function buildEventHeaders() {
  return ["id", "title", "caption", "flyerUrl", "startAt", "endAt", "isActive"];
}

function writeSheetRows(sheetName, headers, rows) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);

  const values = [headers];
  rows.forEach(function(row) {
    values.push(headers.map(function(h) { return normalizeCell(row[h]); }));
  });

  sheet.clear();
  const numRows = values.length || 1;
  sheet.getRange(1, 1, numRows, headers.length).setValues(values.length ? values : [headers]);

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
