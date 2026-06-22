// Opt-out registry. In-memory Set is the source of truth at runtime.
// On startup we hydrate it from a Google Sheets tab called "OptOut" if available.
// On each new opt-out we also append to that tab so the list persists across restarts.

const { google } = require('googleapis');

const SHEET_ID = process.env.GOOGLE_SHEETS_ID;
const OPTOUT_TAB = 'OptOut';

const optOutSet = new Set();   // stores normalized phone digits (last 10)

function normalize(phone) {
    if (!phone) return '';
    return String(phone).replace(/\D/g, '').slice(-10);
}

function isOptedOut(phone) {
    const n = normalize(phone);
    if (!n) return false;
    return optOutSet.has(n);
}

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
    return { client_email: parsed.client_email, private_key: parsePrivateKey(parsed.private_key) };
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

// Auto-create the OptOut tab if it doesn't exist, and write a 3-column header.
async function ensureOptOutTab() {
    const sheets = getClient();
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
    const existing = meta.data.sheets.find(s => s.properties.title === OPTOUT_TAB);
    if (existing) return;
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: OPTOUT_TAB } } }] }
    });
    await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: OPTOUT_TAB + '!A1:C1',
        valueInputOption: 'RAW',
        requestBody: { values: [['Phone', 'Opted Out At', 'Reason']] }
    });
    console.log('[optout] Created OptOut tab in Google Sheets');
}

// Called once at server start. Pulls existing opt-outs into memory.
async function loadOptOutsFromSheet() {
    try {
        await ensureOptOutTab();
        const sheets = getClient();
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: OPTOUT_TAB + '!A2:A'
        });
        const rows = res.data.values || [];
        let count = 0;
        for (const row of rows) {
            const n = normalize(row[0]);
            if (n) { optOutSet.add(n); count++; }
        }
        console.log('[optout] Loaded ' + count + ' opt-outs from sheet into memory.');
    } catch (err) {
        console.warn('[optout] Could not hydrate from sheet — using in-memory only.');
        console.warn('[optout] Reason:', err.message || err);
    }
}

async function addOptOut(phone, reason) {
    const n = normalize(phone);
    if (!n) return false;
    if (optOutSet.has(n)) return true;   // already opted out — idempotent
    optOutSet.add(n);
    // Persist to sheet (best-effort)
    try {
        await ensureOptOutTab();
        const sheets = getClient();
        const timestamp = new Date().toISOString();
        await sheets.spreadsheets.values.append({
            spreadsheetId: SHEET_ID,
            range: OPTOUT_TAB + '!A1:C',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[n, timestamp, reason || '']] }
        });
    } catch (err) {
        console.warn('[optout] Sheet persistence failed; opt-out kept in memory.');
        console.warn('[optout] Reason:', err.message || err);
    }
    return true;
}

module.exports = {
    loadOptOutsFromSheet,
    addOptOut,
    isOptedOut,
    normalize
};
