// Two-step verification service for LeadingLeads.co
// Generates OTP codes and sends via email (Nodemailer) or SMS (Twilio).

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const {
    saveOtp,
    findActiveOtp,
    incrementOtpAttempts,
    markOtpVerified
} = require('./excelService');

const OTP_LENGTH = Number(process.env.OTP_LENGTH || 6);
const OTP_EXPIRY_MINUTES = Number(process.env.OTP_EXPIRY_MINUTES || 10);
const MAX_ATTEMPTS = 5;

// --- Twilio (lazy-loaded so app doesn't crash if creds are missing) ---
let twilioClient = null;
function getTwilioClient() {
    if (twilioClient) return twilioClient;
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    return twilioClient;
}

// --- Nodemailer ---
let mailTransporter = null;
function getMailTransporter() {
    if (mailTransporter) return mailTransporter;
    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER) return null;
    mailTransporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT || 587),
        secure: Number(process.env.EMAIL_PORT) === 465,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
    return mailTransporter;
}

function generateOtpCode() {
    const max = Math.pow(10, OTP_LENGTH);
    const code = crypto.randomInt(0, max).toString().padStart(OTP_LENGTH, '0');
    return code;
}

function hashCode(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
}

async function sendOtp({ contact, method }) {
    if (!['email', 'sms'].includes(method)) {
        throw new Error('Method must be "email" or "sms".');
    }

    const code = generateOtpCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await saveOtp({ contact, method, codeHash, expiresAt });

    if (method === 'email') {
        const transporter = getMailTransporter();
        if (!transporter) {
            // Demo mode: log code to console
            console.log(`[DEMO MODE] Email OTP for ${contact}: ${code}`);
            return { sent: true, demo: true, expiresInMinutes: OTP_EXPIRY_MINUTES };
        }
        await transporter.sendMail({
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
            to: contact,
            subject: 'Your LeadingLeads.co verification code',
            text: `Your verification code is: ${code}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you did not request this, you can ignore this email.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border:1px solid #e5e7eb; border-radius:8px;">
                    <h2 style="color:#2563EB; margin-top:0;">LeadingLeads.co</h2>
                    <p>Use the code below to verify your identity:</p>
                    <div style="font-size:32px; font-weight:bold; letter-spacing:6px; background:#f3f4f6; padding:16px; text-align:center; border-radius:6px;">${code}</div>
                    <p style="color:#6b7280; font-size:14px; margin-top:16px;">This code expires in ${OTP_EXPIRY_MINUTES} minutes. If you did not request this, you can ignore this email.</p>
                </div>`
        });
    } else {
        const client = getTwilioClient();
        if (!client) {
            console.log(`[DEMO MODE] SMS OTP for ${contact}: ${code}`);
            return { sent: true, demo: true, expiresInMinutes: OTP_EXPIRY_MINUTES };
        }
        await client.messages.create({
            body: `Your LeadingLeads.co verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: contact
        });
    }

    return { sent: true, demo: false, expiresInMinutes: OTP_EXPIRY_MINUTES };
}

async function verifyOtp({ contact, code }) {
    const record = await findActiveOtp(contact);
    if (!record) {
        return { verified: false, reason: 'No active code found. Please request a new one.' };
    }
    if (record.attempts >= MAX_ATTEMPTS) {
        return { verified: false, reason: 'Too many attempts. Please request a new code.' };
    }

    const submittedHash = hashCode(String(code).trim());
    if (submittedHash !== record.codeHash) {
        await incrementOtpAttempts(record.otpId);
        return { verified: false, reason: 'Invalid code.', attemptsRemaining: MAX_ATTEMPTS - record.attempts - 1 };
    }

    await markOtpVerified(record.otpId);
    return { verified: true, method: record.method };
}

module.exports = { sendOtp, verifyOtp };
