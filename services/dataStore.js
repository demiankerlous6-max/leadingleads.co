// Data persistence — Leads in Google Sheets, OTP codes in memory.
// Same function names as before so routes don't need changes.

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

// ============== INITIALIZATION ==============

async function initializeSchema() {
    await initializeSheet();
    console.log('[db] Google Sheets ready as the leads database.');
}

// ============== LEADS ==============

async function saveLead(lead) {
    const leadId = uuidv4();
    const row = {
        leadId,
        createdAt: new Date().toISOString(),
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email || '',
        phone: lead.phone,
        dateOfBirth: lead.dateOfBirth,
        age: lead.age,
        gender: lead.gender,
        state: lead.state,
        zipCode: lead.zipCode || '',
        height: lead.height,
        weight: lead.weight,
        bmi: lead.bmi,
        smokingStatus: lead.smokingStatus,
        healthRating: lead.healthRating,
        hasDiabetes: !!lead.hasDiabetes,
        hasHeartDisease: !!lead.hasHeartDisease,
        hasCancerHistory: !!lead.hasCancerHistory,
        familyHistoryHeartDisease: !!lead.familyHistoryHeartDisease,
        policyType: lead.policyType,
        coverageAmount: lead.coverageAmount,
        monthlyPremium: lead.monthlyPremium,
        annualPremium: lead.annualPremium,
        healthClass: lead.healthClass,
        verified: !!lead.verified,
        verificationMethod: lead.verificationMethod || '',
        smsConsent: !!lead.smsConsent,
        smsConsentTimestamp: lead.smsConsentTimestamp || '',
        source: lead.source || 'website',
        notes: lead.notes || ''
    };
    await appendRow(row);
    return leadId;
}

async function updateLeadVerification(leadId, method) {
    const row = await findRowByLeadId(leadId);
    if (!row) return false;
    await updateRowFields(row._rowNumber, {
        verified: true,
        verificationMethod: method
    });
    return true;
}

async function getLeadById(leadId) {
    const row = await findRowByLeadId(leadId);
    if (!row) return null;
    // Strip the internal _rowNumber before returning
    const { _rowNumber, ...lead } = row;
    return lead;
}

async function listLeads({ limit = 100, verifiedOnly = false } = {}) {
    const all = await getAllRows();
    const filtered = verifiedOnly ? all.filter(r => r.verified === true) : all;
    // Most recent first; sheets append at the bottom, so reverse
    return filtered.slice(-limit).reverse().map(({ _rowNumber, ...r }) => r);
}

// ============== OTP (in-memory, ephemeral) ==============
// OTP codes live 10 minutes. Storing them in memory is fine:
//  - No Sheets API write per OTP request (avoids rate limits)
//  - On server restart any in-flight codes are lost — user just clicks "Resend"

const otpStore = new Map(); // contact -> { otpId, codeHash, expiresAt, verified, attempts, method, createdAt }

// Periodically clean up expired entries so the Map doesn't grow forever
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
        if (entry.otpId === otpId) {
            entry.attempts += 1;
            return;
        }
    }
}

async function markOtpVerified(otpId) {
    for (const entry of otpStore.values()) {
        if (entry.otpId === otpId) {
            entry.verified = true;
            return;
        }
    }
}

// ============== EXCEL EXPORT (snapshot of the Sheets data) ==============

async function exportLeadsToExcelBuffer({ verifiedOnly = false } = {}) {
    const leads = await listLeads({ limit: 100000, verifiedOnly });
    const wb = new ExcelJS.Workbook();
    wb.creator = 'LeadingLeads.co';
    wb.created = new Date();

    const sheet = wb.addWorksheet('Leads');
    sheet.columns = COLUMNS.map(h => ({ header: h, key: h, width: 18 }));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };

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
