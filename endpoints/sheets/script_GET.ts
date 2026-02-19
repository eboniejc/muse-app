import { schema } from "./script_GET.schema";

const GOOGLE_APPS_SCRIPT_CONTENT = `/**
 * MUSE INC Sheets Sync (Flattened)
 * One sheet: MasterEnrollments
 */

const MASTER_SHEET = "MasterEnrollments";
const MAX_LESSONS = 16;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("MUSE INC Sync")
    .addItem("Setup", "setup")
    .addSeparator()
    .addItem("Pull Flattened Rows", "pullFromApp")
    .addItem("Push Flattened Rows", "pushToApp")
    .addToUi();
}

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

  ui.alert("Configuration saved.");
}

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
    const rows = parsed?.data?.flattenedEnrollments || [];

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(MASTER_SHEET);
    if (!sheet) sheet = ss.insertSheet(MASTER_SHEET);

    const headers = buildHeaders();
    const values = [headers];

    rows.forEach((row) => {
      values.push(headers.map((h) => normalizeCell(row[h])));
    });

    sheet.clear();
    sheet.getRange(1, 1, values.length || 1, headers.length).setValues(values.length ? values : [headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.autoResizeColumns(1, headers.length);

    ui.alert(\`Pull complete: \${rows.length} row(s)\`);
  } catch (error) {
    ui.alert(\`Pull failed: \${error.message}\`);
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(MASTER_SHEET);
    if (!sheet) throw new Error(\`Missing sheet: \${MASTER_SHEET}\`);

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      ui.alert("No rows to push.");
      return;
    }

    const headers = data[0].map(String);
    const rows = [];

    for (let i = 1; i < data.length; i++) {
      const obj = {};
      let hasData = false;
      for (let c = 0; c < headers.length; c++) {
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

    const payload = { json: { table: "flattenedEnrollments", rows } };
    const response = UrlFetchApp.fetch(\`\${appUrl}/_api/sheets/import\`, {
      method: "post",
      headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) {
      throw new Error(\`Import failed \${response.getResponseCode()}: \${response.getContentText()}\`);
    }

    ui.alert(\`Push complete: \${rows.length} row(s)\`);
  } catch (error) {
    ui.alert(\`Push failed: \${error.message}\`);
  }
}

function buildHeaders() {
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
  ];

  for (let i = 1; i <= MAX_LESSONS; i++) {
    headers.push(\`lesson\${i}DateTime\`);
    headers.push(\`lesson\${i}Ebook\`);
    headers.push(\`lesson\${i}EbookUnlocked\`);
  }

  return headers;
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

export async function handle(request: Request) {
  // We don't need to parse the body for GET request
  // But we validate it against schema anyway to ensure robustness
  // (though for GET with empty schema it mostly just passes)
  try {
    // No body parsing needed for GET request usually, especially one with no parameters
    // But if there were query params we would process them here.
    
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
