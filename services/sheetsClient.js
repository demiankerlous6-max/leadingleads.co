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
            throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON could not be parsed: ' + err.message);
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

// Visible: Name, Phone, Email, DOB, Term Plan, Quote
// Hidden (internal): leadId, verified
const COLUMNS = ['leadId', 'name', 'phone', 'email', 'dob', 'termPlan', 'quote', 'verified'];

const HEADER_LABELS = {
    leadId: 'Lead ID',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    dob: 'DOB',
    termPlan: 'Term Plan',
    quote: 'Estimated Quote',
    verified: 'Verified'
};

const COLUMN_FORMATS = {
    leadId:   { numberFormat: { type: 'TEXT' }, width: 0, hidden: true },
    name:     { width: 180 },
    phone:    { numberFormat: { type: 'TEXT' }, width: 150 },
    email:    { width: 230 },
    dob:      { numberFormat: { type: 'DATE', pattern: 'mmm d, yyyy' }, width: 130 },
    termPlan: { width: 140 },
    quote:    { numberFormat: { type: 'CURRENCY', pattern: '$#,##0.00"/mo"' }, width: 150 },
    verified: { width: 0, hidden: true }
};

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
    const headerCheck = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: headerRange
    });
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
        await applyFormatting(sheets, sheetId);
    } else {
        console.log('[sheets] Headers already exist — leaving them untouched');
    }
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

async function applyFormatting(sheets, sheetId) {
    const requests = [];

    requests.push({
        updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount'
        }
    });

    requests.push({
        repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: COLUMNS.length },
            cell: {
                userEnteredFormat: {
                    backgroundColor: { red: 0.96, green: 0.96, blue: 0.96 },
                    textFormat: { bold: true, fontSize: 11 },
                    horizontalAlignment: 'LEFT',
                    verticalAlignment: 'MIDDLE',
                    padding: { top: 6, bottom: 6, left: 8, right: 8 }
                }
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)'
        }
    });

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
                    properties: { pixelSize: fmt.width || 20, hiddenByUser: !!fmt.hidden },
                    fields: 'pixelSize,hiddenByUser'
                }
            });
        }
    });

    requests.push({
        updateDimensionProperties: {
            range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 36 },
            fields: 'pixelSize'
        }
    });

    requests.push({ clearBasicFilter: { sheetId } });
    requests.push({
        setBasicFilter: {
            filter: { range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: COLUMNS.length } }
        }
    });

    try {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SHEET_ID,
            requestBody: { requests }
        });
        console.log('[sheets] Applied formatting');
    } catch (err) {
        console.warn('[sheets] Formatting partially applied: ' + err.message);
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
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

const DATE_COLUMNS = new Set(['dob']);

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
        range: SHEET_NAME + '!A:A',
        valueInputOption: 'USER_ENTERED',
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
