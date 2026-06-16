// Google Sheets API client for LeadingLeads.co
// Clean v2: append-only writes, no header auto-creation. The user manually
// pastes the header row when they set up the sheet — code never touches row 1.

const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SHEET_NAME = process.env.GOOGLE_SHEETS_TAB_NAME || 'Leads';
const LOCAL_TIMEZONE = process.env.LOCAL_TIMEZONE || 'America/New_York';

// 16-column schema. Order matches the header row the user pastes into Sheets.
const COLUMNS = [
    'submittedAt',      // A: Submitted
    'name',             // B: Name
    'phone',            // C: Phone
    'verified',         // D: Verified
    'consented',        // E: Consented
    'verifiedAt',       // F: Verified At
    'state',            // G: State
    'age',              // H: Age
    'coverageType',     // I: Coverage Type
    'coverageAmount',   // J: Coverage Amount
    'monthlyEstimate',  // K: Monthly Estimate
    'email',            // L: Email
    'consentVersion',   // M: Consent Version
    'ipAddress',        // N: IP Address
    'userAgent',        // O: Browser
    'leadId'            // P: Lead ID
];

const HEADER_LABELS = {
    submittedAt:      'Submitted',
    name:             'Name',
    phone:            'Phone',
    verified:         'Verified',
    consented:        'Consented',
    verifiedAt:       'Verified At',
    state:            'State',
    age:              'Age',
    coverageType:     'Coverage Type',
    coverageAmount:   'Coverage Amount',
    monthlyEstimate:  'Monthly Estimate',
    email:            'Email',
    consentVersion:   'Consent Version',
    ipAddress:        'IP Address',
    userAgent:        'Browser',
    leadId:           'Lead ID'
};

const DATE_COLUMNS = new Set(['submittedAt', 'verifiedAt']);

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
    if (!jsonBlob) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set.');
    const parsed = JSON.parse(jsonBlob);
    return {
        client_email: parsed.client_email,
        private_key: parsePrivateKey(parsed.private_key)
    };
}

function getClient() {
    if (sheetsClient) return sheetsClient;
    if (!SHEET_ID) throw new Error('GOOGLE_SHEETS_ID not set.');
    const auth = new google.auth.GoogleAuth({
        credentials: getCredentials(),
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
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

const LAST_COL_LETTER = columnLetter(COLUMNS.length);  // 'P'

function formatDateForSheets(value) {
    if (!value) return '';
    let d = value;
    if (typeof value === 'string') {
        d = new Date(value);
        if (isNaN(d.getTime())) return value;
    }
    if (!(d instanceof Date)) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: LOCAL_TIMEZONE,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).formatToParts(d);
    const get = type => (parts.find(p => p.type === type) || {}).value || '';
    return get('month') + '/' + get('day') + '/' + get('year') + ' ' +
           get('hour') + ':' + get('minute') + ':' + get('second');
}

// Boot check: just verify we can read the header row. We do NOT write to it.
async function initializeSheet() {
    const sheets = getClient();
    const headerRange = SHEET_NAME + '!A1:' + LAST_COL_LETTER + '1';
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: headerRange
    });
    const row = (res.data.values && res.data.values[0]) || [];
    const filled = row.filter(c => c && String(c).trim().length > 0).length;
    if (filled < COLUMNS.length) {
        console.warn(
            '[sheets] Header row in tab "' + SHEET_NAME + '" has ' + filled +
            ' filled cells, expected ' + COLUMNS.length +
            '. Make sure row 1 is populated correctly.'
        );
    } else {
        console.log(
            '[sheets] Headers verified — ' + COLUMNS.length +
            ' columns ready in tab "' + SHEET_NAME + '".'
        );
    }
}

async function appendRow(rowObject) {
    const sheets = getClient();
    const row = COLUMNS.map(col => {
        let v = rowObject[col];
        if (v === null || v === undefined) return '';
        if (typeof v === 'boolean') return v ? 'Yes' : 'No';
        if (DATE_COLUMNS.has(col) && v) return formatDateForSheets(v);
        return v;
    });
    await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: SHEET_NAME + '!A1:' + LAST_COL_LETTER,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] }
    });
}

async function getAllRows() {
    const sheets = getClient();
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: SHEET_NAME + '!A2:' + LAST_COL_LETTER
    });
    const rows = res.data.values || [];
    return rows.map((raw, idx) => {
        const obj = { _rowNumber: idx + 2 };
        COLUMNS.forEach((col, i) => {
            obj[col] = raw[i] || '';
        });
        return obj;
    });
}

async function findRowByLeadId(leadId) {
    if (!leadId) return null;
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
        if (DATE_COLUMNS.has(col) && value) cell = formatDateForSheets(value);
        const range = SHEET_NAME + '!' + columnLetter(colIdx + 1) + rowNumber;
        dataRequests.push({ range, values: [[cell]] });
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
    COLUMNS,
    HEADER_LABELS
};
