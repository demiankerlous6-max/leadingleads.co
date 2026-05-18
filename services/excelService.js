// Excel-based data storage for LeadingLeads.co
// Stores leads, quotes, and OTP records in a single .xlsx workbook.

const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const EXCEL_PATH = process.env.EXCEL_FILE_PATH || path.join(__dirname, '..', 'data', 'leadingleads.xlsx');

const LEAD_HEADERS = [
    'leadId', 'createdAt', 'firstName', 'lastName', 'email', 'phone',
    'dateOfBirth', 'age', 'gender', 'state', 'zipCode',
    'height', 'weight', 'bmi', 'smokingStatus', 'healthRating',
    'hasDiabetes', 'hasHeartDisease', 'hasCancerHistory', 'familyHistoryHeartDisease',
    'policyType', 'coverageAmount', 'monthlyPremium', 'annualPremium', 'healthClass',
    'verified', 'verificationMethod', 'source', 'notes'
];

const OTP_HEADERS = [
    'otpId', 'createdAt', 'contact', 'method', 'codeHash', 'expiresAt', 'verified', 'attempts'
];

async function initializeWorkbook() {
    const dir = path.dirname(EXCEL_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    if (!fs.existsSync(EXCEL_PATH)) {
        const wb = new ExcelJS.Workbook();
        wb.creator = 'LeadingLeads.co';
        wb.created = new Date();

        const leadsSheet = wb.addWorksheet('Leads');
        leadsSheet.columns = LEAD_HEADERS.map(h => ({ header: h, key: h, width: 18 }));
        leadsSheet.getRow(1).font = { bold: true };
        leadsSheet.getRow(1).fill = {
            type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' }
        };
        leadsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

        const otpSheet = wb.addWorksheet('OTP');
        otpSheet.columns = OTP_HEADERS.map(h => ({ header: h, key: h, width: 20 }));
        otpSheet.getRow(1).font = { bold: true };

        await wb.xlsx.writeFile(EXCEL_PATH);
        console.log(`Created Excel database at ${EXCEL_PATH}`);
    }
}

async function loadWorkbook() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(EXCEL_PATH);
    return wb;
}

async function saveLead(leadData) {
    const wb = await loadWorkbook();
    const sheet = wb.getWorksheet('Leads');

    const leadId = uuidv4();
    const row = {
        leadId,
        createdAt: new Date().toISOString(),
        ...leadData
    };

    sheet.addRow(row);
    await wb.xlsx.writeFile(EXCEL_PATH);
    return leadId;
}

async function updateLeadVerification(leadId, method) {
    const wb = await loadWorkbook();
    const sheet = wb.getWorksheet('Leads');

    let updated = false;
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // header
        if (row.getCell('leadId').value === leadId) {
            row.getCell('verified').value = true;
            row.getCell('verificationMethod').value = method;
            updated = true;
        }
    });

    if (updated) await wb.xlsx.writeFile(EXCEL_PATH);
    return updated;
}

async function listLeads({ limit = 100, verifiedOnly = false } = {}) {
    const wb = await loadWorkbook();
    const sheet = wb.getWorksheet('Leads');
    const leads = [];

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const lead = {};
        LEAD_HEADERS.forEach((h, i) => {
            lead[h] = row.getCell(i + 1).value;
        });
        if (verifiedOnly && !lead.verified) return;
        leads.push(lead);
    });

    return leads.slice(-limit).reverse();
}

async function saveOtp({ contact, method, codeHash, expiresAt }) {
    const wb = await loadWorkbook();
    const sheet = wb.getWorksheet('OTP');
    const otpId = uuidv4();

    sheet.addRow({
        otpId,
        createdAt: new Date().toISOString(),
        contact,
        method,
        codeHash,
        expiresAt: expiresAt.toISOString(),
        verified: false,
        attempts: 0
    });

    await wb.xlsx.writeFile(EXCEL_PATH);
    return otpId;
}

async function findActiveOtp(contact) {
    const wb = await loadWorkbook();
    const sheet = wb.getWorksheet('OTP');

    let latest = null;
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const rowContact = row.getCell('contact').value;
        const expires = new Date(row.getCell('expiresAt').value);
        const verified = row.getCell('verified').value;

        if (rowContact === contact && !verified && expires > new Date()) {
            latest = {
                rowNumber,
                otpId: row.getCell('otpId').value,
                codeHash: row.getCell('codeHash').value,
                expiresAt: expires,
                attempts: Number(row.getCell('attempts').value || 0),
                method: row.getCell('method').value
            };
        }
    });

    return latest;
}

async function incrementOtpAttempts(otpId) {
    const wb = await loadWorkbook();
    const sheet = wb.getWorksheet('OTP');

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        if (row.getCell('otpId').value === otpId) {
            const current = Number(row.getCell('attempts').value || 0);
            row.getCell('attempts').value = current + 1;
        }
    });

    await wb.xlsx.writeFile(EXCEL_PATH);
}

async function markOtpVerified(otpId) {
    const wb = await loadWorkbook();
    const sheet = wb.getWorksheet('OTP');

    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        if (row.getCell('otpId').value === otpId) {
            row.getCell('verified').value = true;
        }
    });

    await wb.xlsx.writeFile(EXCEL_PATH);
}

module.exports = {
    initializeWorkbook,
    saveLead,
    updateLeadVerification,
    listLeads,
    saveOtp,
    findActiveOtp,
    incrementOtpAttempts,
    markOtpVerified
};
