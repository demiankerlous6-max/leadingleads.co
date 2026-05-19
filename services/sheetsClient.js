// Google Sheets API client for LeadingLeads.co
// Uses a service account for server-to-server auth (no user OAuth flow).

const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SHEET_NAME = process.env.GOOGLE_SHEETS_TAB_NAME || 'Leads';

let sheetsClient = null;

function parsePrivateKey(raw) {
    if (!raw) return '';
    let key = raw.trim();
    // Strip surrounding quotes that some hosts wrap around env vars
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
        key = key.slice(1, -1);
    }
    // Convert literal \n escape sequences into real newlines
    key = key.replace(/\\n/g, '\n');
    // Make sure it ends with a newline (some libs require it)
    if (!key.endsWith('\n')) key += '\n';
    return key;
}

function getCredentials() {
    // Preferred: GOOGLE_SERVICE_ACCOUNT_JSON contains the entire JSON file as a single string.
    const jsonBlob = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (jsonBlob) {
        try {
            const parsed = JSON.parse(jsonBlob);
            if (!parsed.client_email || !parsed.private_key) {
                throw new Error('JSON is missing client_email or private_key.');
            }
            return {
                client_email: parsed.client_email,
                private_key: parsePrivateKey(parsed.private_key)
            };
        } catch (err) {
            throw new Error(
                'GOOGLE_SERVICE_ACCOUNT_JSON is set but could not be parsed as JSON. ' +
                'Make sure you pasted the complete contents of the downloaded service account JSON file. ' +
                'Underlying error: ' + err.message
            );
        }
    }

    // Fallback: separate email + private key env vars
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = parsePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
    if (!email || !key) {
        throw new Error(
            'Missing Google credentials. Set either GOOGLE_SERVICE_ACCOUNT_JSON (preferred) ' +
            'or both GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.'
        );
    }
    return { client_email: email, private_key: key };
}

function getClient() {
    if (sheetsClient) return sheetsClient;

    if (!SHEET_ID) {
        throw new Error('GOOGLE_SHEETS_ID must be set.');
    }

    const creds = getCredentials();

    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
}

// Column order — must match what we write in dataStore.js
const COLUMNS = [
    'leadId', 'createdAt', 'firstName', 'lastName', 'email', 'phone',
    'dateOfBirth', 'age', 'gender', 'state', 'zipCode',
    'height', 'weight', 'bmi', 'smokingStatus', 'healthRating',
    'hasDiabetes', 'hasHeartDisease', 'hasCancerHistory', 'familyHistoryHeartDisease',
    'policyType', 'coverageAmount', 'monthlyPremium', 'annualPremium', 'healthClass',
    'verified', 'verificationMethod', 'smsConsent', 'smsConsentTimestamp',
    'source', 'notes'
];

// Per-column formatting rules. Numeric/date columns get explicit formats;
// the phone column is forced to TEXT so leading + and 0 aren't stripped.
const COLUMN_FORMATS = {
    leadId:                     { numberFormat: { type: 'TEXT' }, width: 220 },
    createdAt:                  { numberFormat: { type: 'DATE_TIME', pattern: 'yyyy-mm-dd hh:mm' }, width: 140 },
    firstName:                  { width: 110 },
    lastName:                   { width: 110 },
    email:                      { width: 200 },
    phone:                      { numberFormat: { type: 'TEXT' }, width: 140 },
    dateOfBirth:                { numberFormat: { type: 'DATE', pattern: 'yyyy-mm-dd' }, width: 110 },
    age:                        { numberFormat: { type: 'NUMBER', pattern: '0' }, width: 60 },
    gender:                     { width: 80 },
    state:                      { width: 60 },
    zipCode:                    { numberFormat: { type: 'TEXT' }, width: 80 },
    height:                     { numberFormat: { type: 'NUMBER', pattern: '0" in"' }, width: 70 },
    weight:                     { numberFormat: { type: 'NUMBER', pattern: '0" lbs"' }, width: 80 },
    bmi:                        { numberFormat: { type: 'NUMBER', pattern: '0.0' }, width: 60 },
    smokingStatus:              { width: 100 },
    healthRating:               { width: 100 },
    hasDiabetes:                { width: 90 },
    hasHeartDisease:            { width: 110 },
    hasCancerHistory:           { width: 110 },
    familyHistoryHeartDisease:  { width: 130 },
    policyType:                 { width: 100 },
    coverageAmount:             { numberFormat: { type: 'CURRENCY', pattern: '$#,##0' }, width: 110 },
    monthlyPremium:             { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' }, width: 110 },
    annualPremium:              { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' }, width: 110 },
    healthClass:                { width: 120 },
    verified:                   { width: 80 },
    verificationMethod:         { width: 130 },
    smsConsent:                 { width: 100 },
    smsConsentTimestamp:        { numberFormat: { type: 'DATE_TIME', pattern: 'yyyy-mm-dd hh:mm' }, width: 140 },
    source:                     { width: 90 },
    notes:                      { width: 250 }
};

// Make sure the tab exists, has the header row, and is fully formatted.
async function initializeSheet() {
    const sheets = getClient();

    // Check existing tabs
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const existingTab = meta.data.sheets.find(s => s.properties.title === SHEET_NAME);
    let sheetId = existingTab ? existingTab.properties.sheetId : null;

    if (!existingTab) {
        const created = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SHEET_ID,
            requestBody: {
                requests: [{ addSheet: { properties: { title: SHEET_NAME } } }]
            }
        });
        sheetId = created.data.replies[0].addSheet.properties.sheetId;
        console.log(`[sheets] Created tab "${SHEET_NAME}"`);
    }

    // Check if header row exists; write it if missing
    const headerRange = `${SHEET_NAME}!A1:${columnLetter(COLUMNS.length)}1`;
    const headerCheck = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: headerRange
    });
    if (!headerCheck.data.values || headerCheck.data.values.length === 0) {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: headerRange,
            valueInputOption: 'RAW',
            requestBody: { values: [COLUMNS] }
        });
        console.log(`[sheets] Wrote header row to "${SHEET_NAME}"`);
    }

    // Apply formatting (idempotent — safe to run every startup)
    await applyFormatting(sheets, sheetId);
}

async function applyFormatting(sheets, sheetId) {
    const requests = [];

    // 1) Freeze the header row
    requests.push({
        updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount'
        }
    });

    // 2) Style the header row (white text on blue, bold, centered)
    requests.push({
        repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: COLUMNS.length },
            cell: {
                userEnteredFormat: {
                    backgroundColor: { red: 0.145, green: 0.388, blue: 0.922 }, // #2563EB
                    textFormat: {
                        foregroundColor: { red: 1, green: 1, blue: 1 },
                        bold: true,
                        fontSize: 11
                    },
                    horizontalAlignment: 'CENTER',
                    verticalAlignment: 'MIDDLE'
                }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
        }
    });

    // 3) Per-column number formats + widths
    COLUMNS.forEach((col, i) => {
        const fmt = COLUMN_FORMATS[col];
        if (!fmt) return;

        if (fmt.numberFormat) {
            requests.push({
                repeatCell: {
                    range: { sheetId, startRowIndex: 1, startColumnIndex: i, endColumnIndex: i + 1 },
                    cell: { userEnteredFormat: { numberFormat: fmt.numberFormat } },
                    fields: 'userEnteredFormat.numberFormat'
                }
            });
        }
        if (fmt.width) {
            requests.push({
                updateDimensionProperties: {
                    range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
                    properties: { pixelSize: fmt.width },
                    fields: 'pixelSize'
                }
            });
        }
    });

    // 4) Add alternating row banding for readability (skip if already exists)
    try {
        requests.push({
            addBanding: {
                bandedRange: {
                    range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: COLUMNS.length },
                    rowProperties: {
                        headerColor: { red: 0.145, green: 0.388, blue: 0.922 },
                        firstBandColor: { red: 1, green: 1, blue: 1 },
                        secondBandColor: { red: 0.949, green: 0.961, blue: 0.980 } // #F1F5F9
                    }
                }
            }
        });
    } catch (e) { /* banding already exists, ignore */ }

    // 5) Add a basic filter so users can sort/filter from row 1
    requests.push({
        setBasicFilter: {
            filter: {
                range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: COLUMNS.length }
            }
        }
    });

    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SHEET_ID,
            requestBody: { requests }
        });
        console.log(`[sheets] Applied formatting to "${SHEET_NAME}"`);
    } catch (err) {
        // Banding/filter may already exist — log but don't crash
        if (err.message && err.message.includes('already exists')) {
            console.log(`[sheets] Formatting already in place — skipping duplicates.`);
        } else {
            console.warn(`[sheets] Formatting partially applied: ${err.message}`);
        }
    }
}

function columnLetter(n) {
    // 1 -> A, 26 -> Z, 27 -> AA
    let s = '';
    while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

function formatDateForSheets(value) {
    // Accept Date objects or ISO strings; output "yyyy-mm-dd hh:mm" which Sheets parses as a date.
    let d = value;
    if (typeof value === 'string') {
        d = new Date(value);
        if (isNaN(d.getTime())) return value; // pass through if not a date
    }
    if (!(d instanceof Date)) return value;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Columns that Sheets should interpret as dates
const DATE_COLUMNS = new Set(['createdAt', 'dateOfBirth', 'smsConsentTimestamp']);

async function appendRow(rowObject) {
    const sheets = getClient();
    const row = COLUMNS.map(col => {
        let v = rowObject[col];
        if (v === null || v === undefined || v === '') return '';
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        if (DATE_COLUMNS.has(col)) return formatDateForSheets(v);
        return v;
    });
    await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A:A`,
        valueInputOption: 'USER_ENTERED', // lets Sheets parse numbers/dates and respect column formats
        requestBody: { values: [row] }
    });
}

async function getAllRows() {
    const sheets = getClient();
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A2:${columnLetter(COLUMNS.length)}`
    });
    const rows = res.data.values || [];
    return rows.map((rawRow, idx) => {
        const obj = { _rowNumber: idx + 2 }; // sheet row number (1-indexed, after header)
        COLUMNS.forEach((col, i) => {
            let v = rawRow[i] ?? '';
            if (v === 'TRUE') v = true;
            else if (v === 'FALSE') v = false;
            obj[col] = v;
        });
        return obj;
    });
}

async function findRowByLeadId(leadId) {
    const all = await getAllRows();
    return all.find(r => r.leadId === leadId) || null;
}

async function updateRowFields(rowNumber, updates) {
    const sheets = getClient();
    // For each field in updates, find the column letter and update that cell
    const dataRequests = [];
    Object.entries(updates).forEach(([col, value]) => {
        const colIdx = COLUMNS.indexOf(col);
        if (colIdx === -1) return;
        const cellRange = `${SHEET_NAME}!${columnLetter(colIdx + 1)}${rowNumber}`;
        let cell = value;
        if (typeof value === 'boolean') cell = value ? 'TRUE' : 'FALSE';
        if (value instanceof Date) cell = value.toISOString();
        dataRequests.push({ range: cellRange, values: [[cell]] });
    });
    if (dataRequests.length === 0) return;
    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { valueInputOption: 'RAW', data: dataRequests }
    });
}

module.exports = {
    initializeSheet,
    appendRow,
    getAllRows,
    findRowByLeadId,
    updateRowFields,
    COLUMNS
};
