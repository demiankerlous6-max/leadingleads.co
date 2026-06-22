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

// Current consent text version. If the consent box wording changes, bump this
// to 'v2-<date>'. Old verified rows keep their original version so you always
// know exactly what each user agreed to.
// Bump this whenever the consent box wording on /quote.html changes.
// v1: initial consent text
// v2: added explicit links to /partners.html and /opt-out.html
// v3: full TCPA "express written consent" language; covers automated/prerecorded/AI voice;
//     multi-party marketing partners; explicit Do Not Call override
const CONSENT_VERSION = 'v3-2026-06-22';

// Tracks whether the Sheets backend is healthy. If init or any write fails,
// we flip this off so the site keeps working without a database.
let sheetsAvailable = false;

async function initializeSchema() {
    try {
        await initializeSheet();
        sheetsAvailable = true;
        console.log('[db] Google Sheets ready as the leads database.');
    } catch (err) {
        sheetsAvailable = false;
        throw err;
    }
}

// In-memory cache of quote details keyed by lead_id — used to repaint
// the success page after verification even when Sheets is unreachable.
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
        state: lead.state,
        phone: lead.phone || ''
    });

    if (!sheetsAvailable) return leadId;

    const row = {
        submittedAt: new Date(),
        name: fullName,
        phone: lead.phone || '',
        verified: 'No',
        consented: 'No',
        verifiedAt: '',
        state: (lead.state || '').toUpperCase(),
        age: lead.age || '',
        coverageType: lead.coverageType || lead.policyType || '',
        coverageAmount: lead.coverageAmount || '',
        monthlyEstimate: lead.monthlyPremium,
        email: lead.email || '',
        consentVersion: '',
        leadId
    };
    try {
        await appendRow(row);
    } catch (err) {
        console.warn('[db] saveLead: write failed —', err.message || err);
        sheetsAvailable = false;
    }
    return leadId;
}

// Called when OTP verification succeeds — stamps the lead row with proof
// of consent + verification at that exact moment.
async function updateLeadVerification(leadId, method) {
    if (!sheetsAvailable) return false;
    try {
        const row = await findRowByLeadId(leadId);
        if (!row) return false;
        await updateRowFields(row._rowNumber, {
            verified: 'Yes',
            consented: 'Yes',
            verifiedAt: new Date(),
            consentVersion: CONSENT_VERSION
        });
        return true;
    } catch (err) {
        console.warn('[db] updateLeadVerification: failed —', err.message || err);
        sheetsAvailable = false;
        return false;
    }
}

async function getLeadById(leadId) {
    if (quoteCache.has(leadId)) {
        const cached = quoteCache.get(leadId);
        if (!sheetsAvailable) return { leadId, ...cached };
        try {
            const row = await findRowByLeadId(leadId);
            if (row) {
                const { _rowNumber, ...lead } = row;
                return { ...lead, ...cached };
            }
        } catch (err) {
            console.warn('[db] getLeadById: lookup failed —', err.message || err);
            sheetsAvailable = false;
        }
        return { leadId, ...cached };
    }
    if (!sheetsAvailable) return null;
    try {
        const row = await findRowByLeadId(leadId);
        if (!row) return null;
        const { _rowNumber, ...lead } = row;
        return {
            ...lead,
            monthlyPremium: Number(lead.monthlyEstimate || 0),
            annualPremium: Number(lead.monthlyEstimate || 0) * 12,
            healthClass: 'Standard',
            bmi: 0
        };
    } catch (err) {
        console.warn('[db] getLeadById: lookup failed —', err.message || err);
        sheetsAvailable = false;
        return null;
    }
}

async function listLeads({ limit = 100, verifiedOnly = false } = {}) {
    if (!sheetsAvailable) return [];
    try {
        const all = await getAllRows();
        const filtered = verifiedOnly
            ? all.filter(r => r.verified === 'Yes' || r.verified === true)
            : all;
        return filtered.slice(-limit).reverse().map(({ _rowNumber, ...r }) => r);
    } catch (err) {
        console.warn('[db] listLeads: failed —', err.message || err);
        sheetsAvailable = false;
        return [];
    }
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
    exportLeadsToExcelBuffer,
    CONSENT_VERSION
};
