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

// =================== INITIALIZATION ===================
async function initializeSchema() {
    await initializeSheet();
    console.log('[db] Google Sheets ready as the leads database.');
}

// =================== LEADS ===================
// In-memory cache of full quote details for each lead.
// The sheet only stores the essentials; this holds annual premium,
// health class, and BMI for the post-verification display.
const quoteCache = new Map();

async function saveLead(lead) {
    const leadId = uuidv4();
    const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(' ');

    quoteCache.set(leadId, {
        name: fullName,
        monthlyPremium: lead.monthlyPremium,
        annualPremium: lead.annualPremium,
        healthClass: lead.healthClass || 'Standard',
        bmi: lead.bmi,
        state: lead.state
    });

    const row = {
        leadId,
        name: fullName,
        phone: lead.phone || '',
        email: lead.email || '',
        dob: lead.dateOfBirth || '',
        quote: lead.monthlyPremium,
        verified: lead.verified ? 'Yes' : 'No'
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
    // Prefer the in-memory quote cache (has the extra fields).
    // Fall back to the sheet if the cache was cleared (server restart).
    if (quoteCache.has(leadId)) {
        const cached = quoteCache.get(leadId);
        const row = await findRowByLeadId(leadId);
        if (row) {
            const { _rowNumber, ...lead } = row;
            return { ...lead, ...cached };
        }
        return { leadId, ...cached };
    }
    const row = await findRowByLeadId(leadId);
    if (!row) return null;
    const { _rowNumber, ...lead } = row;
    return {
        ...lead,
        monthlyPremium: Number(lead.quote || 0),
        annualPremium: Number(lead.quote || 0) * 12,
        healthClass: 'Standard',
        bmi: 0
    };
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
