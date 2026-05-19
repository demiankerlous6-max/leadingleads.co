// Data persistence — Leads in Google Sheets (simplified schema), OTP codes in memory.

const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');
const {
    initializeSheet,
    appendRow,
    getAllRows,
    findRowByLeadId,
    updateRowFields,
    COLUMNS
} = require('./sheetsClient');

// =================== Display formatters ===================

const POLICY_LABELS = {
    'term-10':   '10-Year Term',
    'term-20':   '20-Year Term',
    'term-30':   '30-Year Term',
    'whole':     'Whole Life',
    'universal': 'Universal Life'
};

function title(s) {
    if (!s) return '';
    return String(s).charAt(0).toUpperCase() + String(s).slice(1).toLowerCase();
}

function buildConditionsString(lead) {
    const list = [];
    if (lead.hasDiabetes)               list.push('Diabetes');
    if (lead.hasHeartDisease)           list.push('Heart disease');
    if (lead.hasCancerHistory)          list.push('Cancer history');
    if (lead.familyHistoryHeartDisease) list.push('Family heart disease');
    return list.length ? list.join(', ') : 'None';
}

// =================== INITIALIZATION ===================
async function initializeSchema() {
    await initializeSheet();
    console.log('[db] Google Sheets ready as the leads database.');
}

// =================== LEADS ===================
async function saveLead(lead) {
    const leadId = uuidv4();
    const row = {
        leadId,
        date: new Date().toISOString(),
        name: [lead.firstName, lead.lastName].filter(Boolean).join(' '),
        phone: lead.phone || '',
        email: lead.email || '',
        age: lead.age,
        gender: title(lead.gender),
        state: (lead.state || '').toUpperCase(),
        height: lead.height,
        weight: lead.weight,
        bmi: lead.bmi,
        smoking: title(lead.smokingStatus),
        health: title(lead.healthRating),
        conditions: buildConditionsString(lead),
        policyType: POLICY_LABELS[lead.policyType] || lead.policyType,
        coverage: lead.coverageAmount,
        monthlyPremium: lead.monthlyPremium,
        annualPremium: lead.annualPremium,
        healthClass: lead.healthClass || '',
        verified: lead.verified ? 'Yes' : 'No',
        notes: lead.notes || ''
    };
    await appendRow(row);
    return leadId;
}

async function updateLeadVerification(leadId, method) {
    const row = await findRowByLeadId(leadId);
    if (!row) return false;
    await updateRowFields(row._rowNumber, { verified: 'Yes' });
    return true;
}

async function getLeadById(leadId) {
    const row = await findRowByLeadId(leadId);
    if (!row) return null;
    const { _rowNumber, ...lead } = row;
    return lead;
}

async function listLeads({ limit = 100, verifiedOnly = false } = {}) {
    const all = await getAllRows();
    const filtered = verifiedOnly ? all.filter(r => r.verified === true || r.verified === 'Yes') : all;
    return filtered.slice(-limit).reverse().map(({ _rowNumber, ...r }) => r);
}

// =================== OTP (in-memory) ===================
const otpStore = new Map();

setInterval(() => {
    const now = new Date();
    for (const [contact, entry] of otpStore.entries()) {
        if (entry.expiresAt < now) otpStore.delete(contact);
    }
}, 5 * 60 * 1000);

async function saveOtp({ contact, method, codeHash, expiresAt }) {
    const otpId = uuidv4();
    otpStore.set(contact, {
        otpId,
        method,
        codeHash,
        expiresAt: new Date(expiresAt),
        verified: false,
        attempts: 0,
        createdAt: new Date()
    });
    return otpId;
}

async function findActiveOtp(contact) {
    const entry = otpStore.get(contact);
    if (!entry) return null;
    if (entry.verified) return null;
    if (entry.expiresAt < new Date()) {
        otpStore.delete(contact);
        return null;
    }
    return {
        otpId: entry.otpId,
        codeHash: entry.codeHash,
        expiresAt: entry.expiresAt,
        attempts: entry.attempts,
        method: entry.method
    };
}

async function incrementOtpAttempts(otpId) {
    for (const entry of otpStore.values()) {
        if (entry.otpId === otpId) { entry.attempts += 1; return; }
    }
}

async function markOtpVerified(otpId) {
    for (const entry of otpStore.values()) {
        if (entry.otpId === otpId) { entry.verified = true; return; }
    }
}

// =================== EXCEL EXPORT ===================
async function exportLeadsToExcelBuffer({ verifiedOnly = false } = {}) {
    const leads = await listLeads({ limit: 100000, verifiedOnly });
    const wb = new ExcelJS.Workbook();
    wb.creator = 'LeadingLeads.co';
    wb.created = new Date();
    const sheet = wb.addWorksheet('Leads');
    sheet.columns = COLUMNS.filter(c => c !== 'leadId').map(h => ({ header: h, key: h, width: 18 }));
    sheet.getRow(1).font = { bold: true };
    leads.forEach(lead => sheet.addRow(lead));
    return await wb.xlsx.writeBuffer();
}

module.exports = {
    initializeSchema,
    saveLead,
    updateLeadVerification,
    getLeadById,
    listLeads,
    saveOtp,
    findActiveOtp,
    incrementOtpAttempts,
    markOtpVerified,
    exportLeadsToExcelBuffer
};
