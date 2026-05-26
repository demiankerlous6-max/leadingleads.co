// Temporary in-memory data store.
// No persistence — all leads disappear when the server restarts.
// Replace with a real database (Airtable, Supabase, new Google Sheet, etc.) when ready.

const { v4: uuidv4 } = require('uuid');
const ExcelJS = require('exceljs');

const POLICY_LABELS = {
    'term-10':   '10-Year Term',
    'term-20':   '20-Year Term',
    'term-30':   '30-Year Term',
    'whole':     'Whole Life',
    'universal': 'Universal Life'
};

// In-memory stores
const leadsStore = new Map();   // leadId -> lead object
const otpStore   = new Map();   // contact -> otp record

async function initializeSchema() {
    console.log('[db] In-memory store ready (no persistence — leads lost on restart).');
}

// =================== LEADS ===================
async function saveLead(lead) {
    const leadId = uuidv4();
    const stored = {
        leadId,
        createdAt: new Date().toISOString(),
        name: [lead.firstName, lead.lastName].filter(Boolean).join(' '),
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone || '',
        email: lead.email || '',
        dob: lead.dateOfBirth || '',
        state: (lead.state || '').toUpperCase(),
        termPlan: POLICY_LABELS[lead.policyType] || lead.policyType || '',
        policyType: lead.policyType,
        coverageAmount: lead.coverageAmount,
        monthlyPremium: lead.monthlyPremium,
        annualPremium: lead.annualPremium,
        healthClass: lead.healthClass || 'Standard',
        bmi: lead.bmi,
        verified: !!lead.verified
    };
    leadsStore.set(leadId, stored);
    console.log('[db] Saved lead', leadId, '(' + stored.name + ')');
    return leadId;
}

async function updateLeadVerification(leadId, method) {
    const lead = leadsStore.get(leadId);
    if (!lead) return false;
    lead.verified = true;
    lead.verificationMethod = method;
    return true;
}

async function getLeadById(leadId) {
    return leadsStore.get(leadId) || null;
}

async function listLeads({ limit = 100, verifiedOnly = false } = {}) {
    const all = Array.from(leadsStore.values());
    const filtered = verifiedOnly ? all.filter(r => r.verified) : all;
    return filtered.slice(-limit).reverse();
}

// =================== OTP (in-memory) ===================
setInterval(() => {
    const now = new Date();
    for (const [contact, entry] of otpStore.entries()) {
        if (entry.expiresAt < now) otpStore.delete(contact);
    }
}, 5 * 60 * 1000);

async function saveOtp({ contact, method, codeHash, expiresAt }) {
    const otpId = uuidv4();
    otpStore.set(contact, {
        otpId, method, codeHash,
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
    const sheet = wb.addWorksheet('Leads');
    const headers = ['Name', 'Phone', 'Email', 'DOB', 'State', 'Term Plan', 'Estimated Quote', 'Verified'];
    sheet.columns = headers.map(h => ({ header: h, key: h, width: 18 }));
    sheet.getRow(1).font = { bold: true };
    leads.forEach(l => sheet.addRow({
        Name: l.name, Phone: l.phone, Email: l.email, DOB: l.dob,
        State: l.state, 'Term Plan': l.termPlan,
        'Estimated Quote': l.monthlyPremium, Verified: l.verified ? 'Yes' : 'No'
    }));
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
