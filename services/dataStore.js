// Data layer — Leads in Google Sheets, OTP codes in memory.

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

const POLICY_LABELS = {
    'term-10':   '10-Year Term',
    'term-20':   '20-Year Term',
    'term-30':   '30-Year Term',
    'whole':     'Whole Life',
    'universal': 'Universal Life'
};

async function initializeSchema() {
    await initializeSheet();
    console.log('[db] Google Sheets ready as the leads database.');
}

// Caches full quote details (annual, health class, BMI) for post-verify display
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
        submittedAt: new Date(),
        name: fullName,
        phone: lead.phone || '',
        email: lead.email || '',
        dob: lead.dateOfBirth || '',
        state: (lead.state || '').toUpperCase(),
        termPlan: POLICY_LABELS[lead.policyType] || lead.policyType || '',
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
    const filtered = verifiedOnly
        ? all.filter(r => r.verified === true || r.verified === 'Yes')
        : all;
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

async function saveOtp({ contact, method, requestId, expiresAt }) {
    const otpId = uuidv4();
    otpStore.set(contact, {
        otpId, method, requestId,
        expiresAt: new Date(expiresAt),
        verified: false, attempts: 0,
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
        requestId: entry.requestId,
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
