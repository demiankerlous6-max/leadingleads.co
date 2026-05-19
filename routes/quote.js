const express = require('express');
const router = express.Router();
const { validateQuoteInput, sanitizeQuoteInput } = require('../services/validation');
const { calculateQuote } = require('../services/quoteEngine');
const { saveLead } = require('../services/dataStore');
const { sendOtp } = require('../services/otpService');

// POST /api/quote
// Validates input, calculates quote (stored on lead), sends OTP.
// Quote is NOT returned to the client until phone is verified.
router.post('/', async (req, res, next) => {
    try {
        const { valid, errors } = validateQuoteInput(req.body);
        if (!valid) {
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const input = sanitizeQuoteInput(req.body);
        const quote = calculateQuote(input);

        const leadId = await saveLead({
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            dateOfBirth: input.dateOfBirth,
            age: input.age,
            gender: input.gender,
            state: input.state,
            zipCode: input.zipCode,
            height: input.height,
            weight: input.weight,
            bmi: quote.bmi,
            smokingStatus: input.smokingStatus,
            healthRating: input.healthRating,
            hasDiabetes: input.hasDiabetes,
            hasHeartDisease: input.hasHeartDisease,
            hasCancerHistory: input.hasCancerHistory,
            familyHistoryHeartDisease: input.familyHistoryHeartDisease,
            policyType: input.policyType,
            coverageAmount: input.coverageAmount,
            monthlyPremium: quote.monthlyPremium,
            annualPremium: quote.annualPremium,
            healthClass: quote.healthClass,
            verified: false,
            verificationMethod: '',
            smsConsent: input.smsConsent,
            smsConsentTimestamp: input.smsConsentTimestamp,
            source: req.body.source || 'website',
            notes: ''
        });

        // Send OTP immediately — verification gates the quote reveal
        let otpResult;
        try {
            otpResult = await sendOtp({ contact: input.phone, method: 'sms' });
        } catch (err) {
            return res.status(502).json({
                error: 'Could not send verification code. Please try again.',
                details: err.message
            });
        }

        res.json({
            leadId,
            contact: input.phone,
            method: 'sms',
            demo: !!otpResult.demo,
            expiresInMinutes: otpResult.expiresInMinutes,
            customer: {
                firstName: input.firstName,
                state: input.state
            }
            // NOTE: quote intentionally omitted — revealed after OTP verify.
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
