const express = require('express');
const router = express.Router();
const { validateQuoteInput, sanitizeQuoteInput } = require('../services/validation');
const { calculateQuote } = require('../services/quoteEngine');
const { saveLead } = require('../services/excelService');

// POST /api/quote
// Validates input, calculates a quote, and saves an unverified lead.
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

        res.json({
            leadId,
            quote,
            customer: {
                firstName: input.firstName,
                lastName: input.lastName,
                email: input.email,
                phone: input.phone,
                state: input.state
            }
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
