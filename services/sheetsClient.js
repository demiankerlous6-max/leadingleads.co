// Google Sheets API client for LeadingLeads.co — minimal version.

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
        const parsed = JSON.parse(jsonBlob);
        return { client_email: parsed.client_email, private_key: parsePrivateKey(parsed.private_key) };
    }
    return {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: parsePrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)
    };
}

function getClient() {
    if (sheetsClient) return sheetsClient;
    if (!SHEET_ID) throw new Error('GOOGLE_SHEETS_ID must be set.');
    const auth = new google.auth.GoogleAuth({
        credentials: getCredentials(),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
}

const COLUMNS = ['leadId', 'submittedAt', 'name', 'phone', 'email', 'dob', 'state', 'termPlan', 'quote', 'verified'];

const HEADER_LABELS = {
    leadId: 'Lead ID',
    submittedAt: 'Submitted Time',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    dob: 'DOB',
    state: 'State',
    termPlan: 'Term Plan',
    quote: 'Estimated Quote',
    verified: 'Verified'
};

const COLUMN_FORMATS = {
    leadId:      { width: 0,   hidden: true },
    submittedAt: { width: 170, numberFormat: { type: 'DATE_TIME', pattern: 'yyyy-mm-dd HH:mm:ss' } },
    name:        { width: 160 },
    phone:       { width: 140, numberFormat: { type: 'TEXT' } },
    email:       { width: 220 },
    dob:         { width: 110, numberFormat: { type: 'DATE', pattern: 'mm/dd/yyyy' } },
    state:       { width: 70 },
    termPlan:    { width: 130 },
    quote:       { width: 130, numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00' } },
    verified:    { width: 90 }
};

function columnLetter(n) {
    let s = '';
    while (n > 0) {
        const m = (n - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

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
        console.log('[sheets] Created tab "' + SHEET_NAME + '"');
    }

    const headerRange = SHEET_NAME + '!A1:' + columnLetter(COLUMNS.length) + '1';
    const headerCheck = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: headerRange });
    const headersExist = headerCheck.data.values &&
        headerCheck.data.values.length > 0 &&
        headerCheck.data.values[0].some(c => c && String(c).trim().length > 0);

    if (!headersExist) {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: headerRange,
            valueInputOption: 'RAW',
            requestBody: { values: [COLUMNS.map(c => HEADER_LABELS[c] || c)] }
        });
        console.log('[sheets] Wrote default headers');
        await applyBasicFormatting(sheets, sheetId);
    } else {
        console.log('[sheets] Headers already exist — leaving them untouched');
    }
}

async function applyBasicFormatting(sheets, sheetId) {
    const requests = [];
    COLUMNS.forEach((col, i) => {
        const fmt = COLUMN_FORMATS[col];
        if (!fmt) return;
        requests.push({
            updateDimensionProperties: {
                range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
                properties: { pixelSize: fmt.width || 100, hiddenByUser: !!fmt.hidden },
                fields: 'pixelSize,hiddenByUser'
            }
        });
        if (fmt.numberFormat) {
            requests.push({
                repeatCell: {
                    range: { sheetId, startRowIndex: 1, startColumnIndex: i, endColumnIndex: i + 1 },
                    cell: { userEnteredFormat: { numberFormat: fmt.numberFormat } },
                    fields: 'userEnteredFormat.numberFormat'
                }
            });
        }
    });
    requests.push({
        repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: COLUMNS.length },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: 'userEnteredFormat.textFormat.bold'
        }
    });
    try {
        await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests } });
        console.log('[sheets] Applied basic formatting');
    } catch (err) {
        console.warn('[sheets] Formatting skipped: ' + err.message);
    }
}

function formatDateForSheets(value) {
    let d = value;
    if (typeof value === 'string') {
        d = new Date(value);
        if (isNaN(d.getTime())) return value;
    }
    if (!(d instanceof Date)) return value;
    const pad = n => String(n).padStart(2, '0');
    // Always include time — Sheets respects the column format
    // (DATE columns show just the date, DATE_TIME columns show both)
    return pad(d.getMonth() + 1) + '/' + pad(d.getDate()) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}

const DATE_COLUMNS = new Set(['dob', 'submittedAt']);

// Safety check: if headers were ever deleted, recreate them before appending.
async function ensureHeaders(sheets) {
    const headerRange = SHEET_NAME + '!A1:' + columnLetter(COLUMNS.length) + '1';
    const headerCheck = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: headerRange
    });
    const exists = headerCheck.data.values &&
        headerCheck.data.values.length > 0 &&
        headerCheck.data.values[0].some(c => c && String(c).trim().length > 0);
    if (!exists) {
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: headerRange,
            valueInputOption: 'RAW',
            requestBody: { values: [COLUMNS.map(c => HEADER_LABELS[c] || c)] }
        });
        console.log('[sheets] Headers were missing — recreated them');
    }
}

async function appendRow(rowObject) {
    const sheets = getClient();

    // Make sure headers exist before adding any data row.
    await ensureHeaders(sheets);

    const row = COLUMNS.map(col => {
        let v = rowObject[col];
        if (v === null || v === undefined || v === '') return '';
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        if (DATE_COLUMNS.has(col)) return formatDateForSheets(v);
        return v;
    });

    // INSERT_ROWS forces a new row at the bottom of the table — never overwrites.
    // Range A1 anchors the search to the table starting at row 1.
    await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: SHEET_NAME + '!A1',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [row] }
    });
}

async function getAllRows() {
    const sheets = getClient();
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: SHEET_NAME + '!A2:' + columnLetter(COLUMNS.length)
    });
    const rows = res.data.values || [];
    return rows.map((rawRow, idx) => {
        const obj = { _rowNumber: idx + 2 };
        COLUMNS.forEach((col, i) => {
            let v = rawRow[i] || '';
            if (v === 'TRUE' || v === 'Yes') v = true;
            else if (v === 'FALSE' || v === 'No') v = false;
            obj[col] = v;
        });
        return obj;
    });
}

async function findRowByLeadId(leadId) {
    const all = await getAllRows();
    const found = all.find(r => r.leadId === leadId);
    if (!found) {
        console.log('[sheets] findRowByLeadId: NOT FOUND for ' + leadId + '. Total rows: ' + all.length);
        if (all.length > 0) {
            console.log('[sheets] First row leadId: ' + all[0].leadId + ' (length ' + (all[0].leadId || '').length + ')');
            console.log('[sheets] Searched for leadId length: ' + (leadId || '').length);
        }
    } else {
        console.log('[sheets] findRowByLeadId: matched row ' + found._rowNumber + ' for ' + leadId);
    }
    return found || null;
}

async function updateRowFields(rowNumber, updates) {
    const sheets = getClient();
    const dataRequests = [];
    Object.entries(updates).forEach(([col, value]) => {
        const colIdx = COLUMNS.indexOf(col);
        if (colIdx === -1) return;
        let cell = value;
        if (typeof value === 'boolean') cell = value ? 'Yes' : 'No';
        dataRequests.push({
            range: SHEET_NAME + '!' + columnLetter(colIdx + 1) + rowNumber,
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
