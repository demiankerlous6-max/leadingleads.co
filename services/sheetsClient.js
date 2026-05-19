// Google Sheets API client for LeadingLeads.co
// Uses a service account for server-to-server auth (no user OAuth flow).

const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SHEET_NAME = process.env.GOOGLE_SHEETS_TAB_NAME || 'Leads';

let sheetsClient = null;

function parsePrivateKey(raw) {
    if (!raw) return '';
    let key = raw.trim();
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
        key = key.slice(1, -1);
    }
    key = key.replace(/\\n/g, '\n');
    if (!key.endsWith('\n')) key += '\n';
    return key;
}

function getCredentials() {
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
                'GOOGLE_SERVICE_ACCOUNT_JSON is set but could not be parsed as JSON. ' + err.message
            );
        }
    }
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = parsePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
    if (!email || !key) {
        throw new Error('Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON.');
    }
    return { client_email: email, private_key: key };
}

function getClient() {
    if (sheetsClient) return sheetsClient;
    if (!SHEET_ID) throw new Error('GOOGLE_SHEETS_ID must be set.');
    const creds = getCredentials();
    const auth = new google.auth.GoogleAuth({
        credentials: creds,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
}

// =====================================================================
// SIMPLIFIED COLUMN SET — agent-friendly, 20 columns
// =====================================================================
// Column keys are camelCase (used in code). Display headers below are
// Title Case (what shows in the sheet).
const COLUMNS = [
    'leadId',
    'date',
    'name',
    'phone',
    'email',
    'age',
    'gender',
    'state',
    'height',
    'weight',
    'bmi',
    'smoking',
    'health',
    'conditions',
    'policyType',
    'coverage',
    'monthlyPremium',
    'annualPremium',
    'healthClass',
    'verified',
    'notes'
];

const HEADER_LABELS = {
    leadId: 'Lead ID',
    date: 'Date',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    age: 'Age',
    gender: 'Gender',
    state: 'State',
    height: 'Height',
    weight: 'Weight',
    bmi: 'BMI',
    smoking: 'Smoking',
    health: 'Health',
    conditions: 'Conditions',
    policyType: 'Policy',
    coverage: 'Coverage',
    monthlyPremium: 'Monthly Premium',
    annualPremium: 'Annual Premium',
    healthClass: 'Class',
    verified: 'Verified',
    notes: 'Notes'
};

// Per-column display rules
const COLUMN_FORMATS = {
    leadId:         { numberFormat: { type: 'TEXT' }, width: 0,   hidden: true },   // hidden — only used by code
    date:           { numberFormat: { type: 'DATE_TIME', pattern: 'mmm d, yyyy h:mm am/pm' }, width: 150 },
    name:           { width: 140 },
    phone:          { numberFormat: { type: 'TEXT' }, width: 130 },
    email:          { width: 200 },
    age:            { numberFormat: { type: 'NUMBER', pattern: '0' }, width: 60 },
    gender:         { width: 80 },
    state:          { width: 60 },
    height:         { numberFormat: { type: 'NUMBER', pattern: '0" in"' }, width: 70 },
    weight:         { numberFormat: { type: 'NUMBER', pattern: '0" lbs"' }, width: 85 },
    bmi:            { numberFormat: { type: 'NUMBER', pattern: '0.0' }, width: 60 },
    smoking:        { width: 90 },
    health:         { width: 90 },
    conditions:     { width: 200, wrap: true },
    policyType:     { width: 140 },
    coverage:       { numberFormat: { type: 'CURRENCY', pattern: '$#,##0' }, width: 110 },
    monthlyPremium: { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' }, width: 120 },
    annualPremium:  { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' }, width: 120 },
    healthClass:    { width: 130 },
    verified:       { width: 80 },
    notes:          { width: 250, wrap: true }
};

// =====================================================================
// INITIALIZATION
// =====================================================================

async function initializeSheet() {
    const sheets = getClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const existingTab = meta.data.sheets.find(s => s.properties.title === SHEET_NAME);
    let sheetId = existingTab ? existingTab.properties.sheetId : null;

    if (!existingTab) {
        const created = await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SHEET_ID,
            requestBody: { requests: [{ addSheet: { properties: { title: SHEET_NAME } } }] }
        });
        sheetId = created.data.replies[0].addSheet.properties.sheetId;
        console.log(`[sheets] Created tab "${SHEET_NAME}"`);
    }

    // Write Title-Case header labels into row 1 (always overwrite — keeps headers in sync)
    const headerRange = `${SHEET_NAME}!A1:${columnLetter(COLUMNS.length)}1`;
    await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: headerRange,
        valueInputOption: 'RAW',
        requestBody: { values: [COLUMNS.map(c => HEADER_LABELS[c] || c)] }
    });

    await applyFormatting(sheets, sheetId);
}

function columnLetter(n) {
    let s = '';
    while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

// =====================================================================
// FORMATTING
// =====================================================================
async function applyFormatting(sheets, sheetId) {
    const requests = [];

    // 1) Freeze header row
    requests.push({
        updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount'
        }
    });

    // 2) Header row: bold, light gray background, vertical center, no bright colors
    requests.push({
        repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: COLUMNS.length },
            cell: {
                userEnteredFormat: {
                    backgroundColor: { red: 0.96, green: 0.96, blue: 0.96 }, // #F5F5F5 — neutral gray
                    textFormat: { bold: true, fontSize: 11 },
                    horizontalAlignment: 'LEFT',
                    verticalAlignment: 'MIDDLE',
                    padding: { top: 6, bottom: 6, left: 8, right: 8 }
                }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)'
        }
    });

    // 3) Body rows: padded, vertical center, optional wrapping per column
    requests.push({
        repeatCell: {
            range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: COLUMNS.length },
            cell: {
                userEnteredFormat: {
                    verticalAlignment: 'MIDDLE',
                    padding: { top: 4, bottom: 4, left: 8, right: 8 }
                }
            },
            fields: 'userEnteredFormat(verticalAlignment,padding)'
        }
    });

    // 4) Per-column number formats, widths, hidden flag, and wrap
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
        if (fmt.width !== undefined) {
            requests.push({
                updateDimensionProperties: {
                    range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
                    properties: {
                        pixelSize: fmt.width || 20,
                        hiddenByUser: !!fmt.hidden
                    },
                    fields: 'pixelSize,hiddenByUser'
                }
            });
        }
        if (fmt.wrap) {
            requests.push({
                repeatCell: {
                    range: { sheetId, startRowIndex: 1, startColumnIndex: i, endColumnIndex: i + 1 },
                    cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } },
                    fields: 'userEnteredFormat.wrapStrategy'
                }
            });
        }
    });

    // 5) Slightly taller default row height for breathing room
    requests.push({
        updateDimensionProperties: {
            range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 36 },
            fields: 'pixelSize'
        }
    });

    // 6) Re-apply basic filter (idempotent: clear then set)
    requests.push({ clearBasicFilter: { sheetId } });
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
        console.log(`[sheets] Applied clean formatting to "${SHEET_NAME}"`);
    } catch (err) {
        console.warn(`[sheets] Formatting partially applied: ${err.message}`);
    }
}

// =====================================================================
// ROW I/O
// =====================================================================

function formatDateForSheets(value) {
    let d = value;
    if (typeof value === 'string') {
        d = new Date(value);
        if (isNaN(d.getTime())) return value;
    }
    if (!(d instanceof Date)) return value;
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const DATE_COLUMNS = new Set(['date']);

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
        valueInputOption: 'USER_ENTERED',
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
        const obj = { _rowNumber: idx + 2 };
        COLUMNS.forEach((col, i) => {
            let v = rawRow[i] ?? '';
            if (v === 'TRUE' || v === 'Yes') v = true;
            else if (v === 'FALSE' || v === 'No') v = false;
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
    const dataRequests = [];
    Object.entries(updates).forEach(([col, value]) => {
        const colIdx = COLUMNS.indexOf(col);
        if (colIdx === -1) return;
        let cell = value;
        if (typeof value === 'boolean') cell = value ? 'Yes' : 'No';
        if (value instanceof Date) cell = formatDateForSheets(value);
        dataRequests.push({
            range: `${SHEET_NAME}!${columnLetter(colIdx + 1)}${rowNumber}`,
            values: [[cell]]
        });
    });
    if (dataRequests.length === 0) return;
    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { valueInputOption: 'USER_ENTERED', data: dataRequests }
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
