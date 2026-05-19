// Google Sheets API client for LeadingLeads.co
// Uses a service account for server-to-server auth (no user OAuth flow).

const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SHEET_NAME = process.env.GOOGLE_SHEETS_TAB_NAME || 'Leads';

let sheetsClient = null;

function getClient() {
    if (sheetsClient) return sheetsClient;

    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '';
    // Render and many hosts escape newlines as literal "\n" — convert them back.
    key = key.replace(/\\n/g, '\n');

    if (!email || !key) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY must be set.');
    }
    if (!SHEET_ID) {
        throw new Error('GOOGLE_SHEETS_ID must be set.');
    }

    const auth = new google.auth.GoogleAuth({
        credentials: { client_email: email, private_key: key },
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

// Make sure the tab exists and has the header row. Safe to run on every startup.
async function initializeSheet() {
    const sheets = getClient();

    // Check existing tabs
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const tabExists = meta.data.sheets.some(s => s.properties.title === SHEET_NAME);

    if (!tabExists) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SHEET_ID,
            requestBody: {
                requests: [{ addSheet: { properties: { title: SHEET_NAME } } }]
            }
        });
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

async function appendRow(rowObject) {
    const sheets = getClient();
    const row = COLUMNS.map(col => {
        const v = rowObject[col];
        if (v === null || v === undefined) return '';
        if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
        if (v instanceof Date) return v.toISOString();
        return v;
    });
    await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A:A`,
        valueInputOption: 'RAW',
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
