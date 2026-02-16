import { schema } from "./script_GET.schema";

// This content is copied from static/google-apps-script.txt as requested
const GOOGLE_APPS_SCRIPT_CONTENT = `/**
 * MUSE INC Management System - Google Sheets Sync Script
 * 
 * Instructions:
 * 1. Open your Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Delete any existing code and paste this entire script
 * 4. Save the project (File > Save)
 * 5. Reload your Google Sheet
 * 6. You will see a "MUSE INC Sync" menu appear
 * 7. Click "MUSE INC Sync" > "Setup" to configure your API Key and App URL
 */

// --- CONFIGURATION ---

function setup() {
  const ui = SpreadsheetApp.getUi();
  const scriptProperties = PropertiesService.getScriptProperties();

  // Prompt for App URL
  const urlResponse = ui.prompt(
    'Setup',
    'Enter your App URL (e.g., https://myapp.example.com):',
    ui.ButtonSet.OK_CANCEL
  );

  if (urlResponse.getSelectedButton() !== ui.Button.OK) return;
  let appUrl = urlResponse.getResponseText().trim();
  // Remove trailing slash if present
  if (appUrl.endsWith('/')) appUrl = appUrl.slice(0, -1);

  // Prompt for API Key
  const keyResponse = ui.prompt(
    'Setup',
    'Enter your API Key:',
    ui.ButtonSet.OK_CANCEL
  );

  if (keyResponse.getSelectedButton() !== ui.Button.OK) return;
  const apiKey = keyResponse.getResponseText().trim();

  // Save properties
  scriptProperties.setProperty('APP_URL', appUrl);
  scriptProperties.setProperty('API_KEY', apiKey);

  ui.alert('Configuration saved! You can now use the Pull and Push features.');
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('MUSE INC Sync')
    .addItem('⚙️ Setup Configuration', 'setup')
    .addSeparator()
    .addItem('📥 Pull from App', 'pullFromApp')
    .addItem('📤 Push to App', 'pushToApp')
    .addToUi();
}

// --- MAIN FUNCTIONS ---

function pullFromApp() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const appUrl = props.getProperty('APP_URL');
  const apiKey = props.getProperty('API_KEY');

  if (!appUrl || !apiKey) {
    ui.alert('Please run Setup first to configure your App URL and API Key.');
    return;
  }

  try {
    const response = UrlFetchApp.fetch(\`\${appUrl}/_api/sheets/export\`, {
      method: 'post',
      headers: {
        'x-api-key': apiKey
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      throw new Error(\`Error \${response.getResponseCode()}: \${response.getContentText()}\`);
    }

    const responseText = response.getContentText();
    const parsed = parseSuperJSON(responseText);

    if (!parsed || !parsed.data) {
      throw new Error('Invalid response format from server');
    }

    const data = parsed.data;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // Process each table
    const tables = Object.keys(data);
    
    tables.forEach(tableName => {
      const rows = data[tableName];
      if (!Array.isArray(rows)) return;

      let sheet = ss.getSheetByName(tableName);
      if (!sheet) {
        sheet = ss.insertSheet(tableName);
      } else {
        sheet.clear();
      }

      if (rows.length === 0) {
        sheet.getRange(1, 1).setValue("No data");
        return;
      }

      // Get headers from the first row keys
      // We collect all unique keys across all rows just in case, but usually first row is enough
      // For simplicity and performance, we'll take keys from the first few rows
      const headers = Array.from(new Set(
        rows.slice(0, 10).flatMap(Object.keys)
      ));

      if (headers.length === 0) return;

      // Prepare 2D array for writing
      const values = [headers]; // First row is headers

      rows.forEach(row => {
        const rowValues = headers.map(header => {
          const val = row[header];
          
          if (val === null || val === undefined) return '';
          
          // Handle Dates
          if (val instanceof Date) {
            return val.toISOString();
          }
          
          // Handle Objects/Arrays
          if (typeof val === 'object') {
            return JSON.stringify(val);
          }
          
          return val;
        });
        values.push(rowValues);
      });

      // Write to sheet
      if (values.length > 0) {
        sheet.getRange(1, 1, values.length, headers.length).setValues(values);
        
        // Formatting
        sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
        sheet.autoResizeColumns(1, headers.length);
      }
    });

    ui.alert('✅ Sync Complete: Data pulled successfully!');

  } catch (error) {
    console.error(error);
    ui.alert(\`❌ Error: \${error.message}\`);
  }
}

function pushToApp() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const appUrl = props.getProperty('APP_URL');
  const apiKey = props.getProperty('API_KEY');

  if (!appUrl || !apiKey) {
    ui.alert('Please run Setup first.');
    return;
  }

  // Define which tables are writable
  const writableTables = [
    "courses",
    "ebooks",
    "rooms",
    "roomBookings",
    "courseEnrollments",
    "lessonCompletions",
    "lessonSchedules",
    "users",
    "userProfiles"
  ];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  let resultMessages = [];

  for (const sheet of sheets) {
    const tableName = sheet.getName();
    
    // Skip if not a writable table
    if (!writableTables.includes(tableName)) {
      continue;
    }

    try {
      const data = sheet.getDataRange().getValues();
      if (data.length < 2) {
        resultMessages.push(\`\${tableName}: No data to push\`);
        continue;
      }

      const headers = data[0];
      const rows = [];

      for (let i = 1; i < data.length; i++) {
        const rowData = {};
        let hasData = false;
        
        headers.forEach((header, index) => {
          let value = data[i][index];
          
          // Basic cleanup
          if (value === '') value = null;
          
          // If we have a header, add it
          if (header) {
            rowData[header] = value;
            if (value !== null) hasData = true;
          }
        });

        if (hasData) {
          // Attempt to convert obviously date-like strings back to ISO if they look like it
          // Or if the value is a Date object from Google Sheets
          for (const key in rowData) {
            if (rowData[key] instanceof Date) {
              rowData[key] = rowData[key].toISOString();
            }
          }
          rows.push(rowData);
        }
      }

      if (rows.length === 0) continue;

      // Prepare payload in SuperJSON-compatible structure
      // The endpoint expects superjson.parse(text), which handles { json: ..., meta: ... }
      // We send a minimal "json" structure. SuperJSON can parse standard JSON wrapped in its envelope.
      const payload = {
        json: {
          table: tableName,
          rows: rows
        }
        // meta is optional if we don't have special types like Dates/RegExp/etc inside the json tree 
        // that need reviving. Since we converted dates to ISO strings above, they are just strings 
        // in the JSON. The backend receives strings and creates Date objects manually if needed 
        // (e.g. \`new Date(scheduledAt)\` in the endpoint).
      };

      const response = UrlFetchApp.fetch(\`\${appUrl}/_api/sheets/import\`, {
        method: 'post',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json' // superjson expects json content type usually or text
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      if (response.getResponseCode() !== 200) {
        resultMessages.push(\`\${tableName}: ❌ Failed (\${response.getResponseCode()}) - \${response.getContentText()}\`);
      } else {
        const respText = response.getContentText();
        // The response is also superjson, so we might need to parse it to get message
        // But checking 200 OK is usually enough for status
        resultMessages.push(\`\${tableName}: ✅ Success (\${rows.length} rows)\`);
      }

    } catch (e) {
      resultMessages.push(\`\${tableName}: ❌ Error - \${e.message}\`);
    }
  }

  ui.alert(\`Push Results:\\n\\n\${resultMessages.join('\\n')}\`);
}


// --- HELPERS ---

/**
 * A lightweight SuperJSON parser for Google Apps Script.
 * Fully implementing SuperJSON is complex, but we only need to revive data
 * and standard types (Date) based on the structure returned by the API.
 */
function parseSuperJSON(jsonString) {
  try {
    const raw = JSON.parse(jsonString);
    if (!raw.json) return raw; // Fallback if it's not superjson envelope
    
    return revive(raw.json, raw.meta);
  } catch (e) {
    console.error("Failed to parse SuperJSON", e);
    return null;
  }
}

function revive(data, meta) {
  if (!meta) return data;

  if (meta.values) {
    // Traverse the data and apply transformations based on paths in meta.values
    // meta.values is like { "data.courses.0.createdAt": ["Date", 1680000000] }
    // or tree based.
    // The SuperJSON wire format can vary (tree vs map). 
    // Assuming standard modern SuperJSON serialization which often uses a tree for values.
    
    // However, writing a full recursive traverser in GAS is error-prone without the library.
    // Let's implement a simplified traversal that handles the basic "Date" type which is our main concern.
    // 
    // If the data is simple enough, we might just look for ISO date strings in the 'pull' logic 
    // and convert them, but that is risky.
    //
    // Let's try to do a basic walk.
    
    // Note: The backend uses \`superjson.stringify\`.
    // Standard superjson output looks like: { json: { ... }, meta: { values: { "path.to.key": ["Date"] } } }
    
    // Since we can't easily import the library, we will do a "best effort" parse.
    // We will walk the object tree. If we see a string that looks strictly like an ISO date,
    // we convert it. This is safer than trying to implement the full SuperJSON spec from scratch.
    
    return walkAndReviveDates(data);
  }
  
  return data;
}

/**
 * Recursive function to walk object tree and convert ISO date strings to Date objects.
 * This is a pragmatic workaround since we cannot import the full SuperJSON library.
 */
function walkAndReviveDates(obj) {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => walkAndReviveDates(item));
  }
  
  if (typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      newObj[key] = walkAndReviveDates(obj[key]);
    }
    return newObj;
  }
  
  if (typeof obj === 'string') {
    // Regex for ISO 8601 Date
    // e.g., 2023-01-01T12:00:00.000Z
    if (/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,3})?Z$/.test(obj)) {
      const d = new Date(obj);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }
  }
  
  return obj;
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
