// Two-step verification for LeadingLeads.co — Vonage Verify v2 API.
// No 10DLC registration needed: Vonage uses their pre-registered shared
// infrastructure. We call their API, they generate + send + verify the code.

const {
    saveOtp,
    findActiveOtp,
    incrementOtpAttempts,
    markOtpVerified
} = require('./dataStore');

const BRAND = process.env.VONAGE_BRAND || 'LeadingLeads';
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const MAX_ATTEMPTS = 5;

// Lazy-loaded Vonage client
let vonageClient = null;
function getVonageClient() {
    if (vonageClient) return vonageClient;
    if (!process.env.VONAGE_API_KEY || !process.env.VONAGE_API_SECRET) return null;
    const { Vonage } = require('@vonage/server-sdk');
    vonageClient = new Vonage({
        apiKey: process.env.VONAGE_API_KEY,
        apiSecret: process.env.VONAGE_API_SECRET
    });
    return vonageClient;
}

// Strip the phone to digits only (Vonage Verify expects no leading +)
function toE164Digits(phone) {
    return String(phone).replace(/[^\d]/g, '');
}

async function sendOtp({ contact, method }) {
    // method is 'sms' or 'voice' — we'll pass it as the channel to Vonage
    if (!['sms', 'voice'].includes(method)) {
        method = 'sms';
    }

    const client = getVonageClient();

    // Demo mode (no credentials configured) — print to console for testing
    if (!client) {
        const fakeCode = String(Math.floor(100000 + Math.random() * 900000));
        console.log(`[DEMO MODE] OTP for ${contact} via ${method}: ${fakeCode}`);
        // Store the demo code in our local store so verifyOtp can match it
        await saveOtp({
            contact,
            method,
            requestId: 'demo:' + fakeCode,
            expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000)
        });
        return { sent: true, demo: true, expiresInMinutes: OTP_EXPIRY_MINUTES };
    }

    // Live mode — call Vonage Verify v1 (uses API key/secret, no Application ID needed)
    try {
        const result = await client.verify.start({
            number: toE164Digits(contact),
            brand: BRAND,
            code_length: 6,
            workflow_id: method === 'voice' ? 6 : 1  // 1 = SMS only, 6 = voice only
        });

        if (result.status !== '0') {
            throw new Error(result.error_text || 'Vonage rejected the request (status ' + result.status + ')');
        }

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
            expiresInMinutes: OTP_EXPIRY_MINUTES,
            requestId: result.request_id
        };
    } catch (err) {
        const detail = err.response && err.response.detail ? err.response.detail : err.message;
        throw new Error('Vonage Verify failed: ' + detail);
    }
}

async function verifyOtp({ contact, code }) {
    const record = await findActiveOtp(contact);
    if (!record) {
        return { verified: false, reason: 'No active code found. Please request a new one.' };
    }
    if (record.attempts >= MAX_ATTEMPTS) {
        return { verified: false, reason: 'Too many attempts. Please request a new code.' };
    }

    // Demo mode — compare against the in-memory fake code we generated
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

    // Live mode — ask Vonage to verify
    const client = getVonageClient();
    if (!client) {
        return { verified: false, reason: 'Verification service is not configured.' };
    }

    try {
        const result = await client.verify.check({
            request_id: record.requestId,
            code: String(code).trim()
        });

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
    } catch (err) {
        await incrementOtpAttempts(record.otpId);
        return {
            verified: false,
            reason: 'Invalid code.',
            attemptsRemaining: MAX_ATTEMPTS - record.attempts - 1
        };
    }
}

module.exports = { sendOtp, verifyOtp };
