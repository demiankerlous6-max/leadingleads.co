// Two-step verification for LeadingLeads.co
// Uses Vonage Verify v1 REST API directly (bypasses SDK to avoid parameter quirks).

const {
    saveOtp,
    findActiveOtp,
    incrementOtpAttempts,
    markOtpVerified
} = require('./dataStore');

const BRAND = process.env.VONAGE_BRAND || 'LeadingLeads';
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 2);
const PIN_EXPIRY_SECONDS = 120; // 2 minutes
const MAX_ATTEMPTS = 5;

const VONAGE_START_URL = 'https://api.nexmo.com/verify/json';
const VONAGE_CHECK_URL = 'https://api.nexmo.com/verify/check/json';

function toE164Digits(phone) {
    let digits = String(phone).replace(/[^\d]/g, '');
    if (digits.length === 10) digits = '1' + digits;
    return digits;
}

function haveCreds() {
    return Boolean(process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET);
}

async function sendOtp({ contact, method }) {
    if (!['sms', 'voice'].includes(method)) method = 'sms';

    if (!haveCreds()) {
        const fakeCode = String(Math.floor(100000 + Math.random() * 900000));
        console.log('[DEMO MODE] OTP for ' + contact + ' via ' + method + ': ' + fakeCode);
        await saveOtp({
            contact,
            method,
            requestId: 'demo:' + fakeCode,
            expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
        });
        return { sent: true, demo: true, expiresInMinutes: OTP_EXPIRY_MINUTES };
    }

    const params = new URLSearchParams({
        api_key: process.env.VONAGE_API_KEY,
        api_secret: process.env.VONAGE_API_SECRET,
        number: toE164Digits(contact),
        brand: BRAND,
        code_length: '6',
        workflow_id: method === 'voice' ? '6' : '1',
        pin_expiry: String(PIN_EXPIRY_SECONDS)
    });

    let result;
    try {
        const response = await fetch(VONAGE_START_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        result = await response.json();
    } catch (err) {
        throw new Error('Network error contacting Vonage: ' + err.message);
    }

    console.log('[OTP] Vonage verify.start response:', JSON.stringify(result));

    // Status 10 = concurrent verification — adopt the existing request_id
    if (result.status === '10' && result.request_id) {
        console.log('[OTP] Adopting existing concurrent request_id: ' + result.request_id);
        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
        await saveOtp({
            contact,
            method,
            requestId: result.request_id,
            expiresAt
        });
        return {
            sent: true,
            demo: false,
            reused: true,
            expiresInMinutes: OTP_EXPIRY_MINUTES,
            requestId: result.request_id
        };
    }

    if (result.status !== '0') {
        throw new Error('Vonage status ' + result.status + ': ' + (result.error_text || 'unknown'));
    }
    if (!result.request_id) {
        throw new Error('Vonage returned no request_id. Full response: ' + JSON.stringify(result));
    }

    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    await saveOtp({
        contact,
        method,
        requestId: result.request_id,
        expiresAt
    });
    console.log('[OTP] Saved requestId for ' + contact + ': ' + result.request_id);

    return {
        sent: true,
        demo: false,
        expiresInMinutes: OTP_EXPIRY_MINUTES,
        requestId: result.request_id
    };
}

async function verifyOtp({ contact, code }) {
    const record = await findActiveOtp(contact);
    if (!record) {
        return { verified: false, reason: 'No active code found. Please request a new one.' };
    }
    if (record.attempts >= MAX_ATTEMPTS) {
        return { verified: false, reason: 'Too many attempts. Please request a new code.' };
    }

    console.log('[OTP] Verifying for ' + contact + ' with requestId: ' + record.requestId);

    if (record.requestId && record.requestId.startsWith('demo:')) {
        const expectedCode = record.requestId.slice(5);
        if (String(code).trim() === expectedCode) {
            await markOtpVerified(record.otpId);
            return { verified: true, method: record.method };
        }
        await incrementOtpAttempts(record.otpId);
        return {
            verified: false,
            reason: 'Invalid code.',
            attemptsRemaining: MAX_ATTEMPTS - record.attempts - 1
        };
    }

    if (!haveCreds()) {
        return { verified: false, reason: 'Verification service is not configured.' };
    }

    const params = new URLSearchParams({
        api_key: process.env.VONAGE_API_KEY,
        api_secret: process.env.VONAGE_API_SECRET,
        request_id: record.requestId,
        code: String(code).trim()
    });

    let result;
    try {
        const response = await fetch(VONAGE_CHECK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });
        result = await response.json();
    } catch (err) {
        await incrementOtpAttempts(record.otpId);
        return { verified: false, reason: 'Network error. Please try again.' };
    }

    console.log('[OTP] Vonage verify.check response:', JSON.stringify(result));

    if (result.status === '0') {
        await markOtpVerified(record.otpId);
        return { verified: true, method: record.method };
    }

    await incrementOtpAttempts(record.otpId);
    return {
        verified: false,
        reason: result.error_text || 'Invalid code.',
        attemptsRemaining: MAX_ATTEMPTS - record.attempts - 1
    };
}

module.exports = { sendOtp, verifyOtp };
