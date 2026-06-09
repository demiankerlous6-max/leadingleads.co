const express = require('express');
const router = express.Router();
const {
    validateQuoteInput,
    sanitizeQuoteInput,
    validateFEQuoteInput,
    sanitizeFEQuoteInput
} = require('../services/validation');
const { calculateQuote } = require('../services/quoteEngine');
const { saveLead } = require('../services/dataStore');

// POST /api/quote
// Returns the quote immediately and saves the lead with verified=false.
// Phone verification happens later when the user expresses interest.
router.post('/', async (req, res, next) => {
    try {
        const isFE = req.body.policyType === 'final-expense';
        const validation = isFE ? validateFEQuoteInput(req.body) : validateQuoteInput(req.body);
        if (!validation.valid) {
            return res.status(400).json({ error: 'Validation failed', details: validation.errors });
        }

        const input = isFE ? sanitizeFEQuoteInput(req.body) : sanitizeQuoteInput(req.body);
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
            zipCode: input.zipCode || '',
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

        // Return quote details — frontend shows them BEFORE asking for verification.
        res.json({
            leadId,
            contact: input.phone,
            customer: { firstName: input.firstName, state: input.state },
            quote: {
                monthlyPremium: quote.monthlyPremium,
                annualPremium: quote.annualPremium,
                healthClass: quote.healthClass,
                lumpSum: quote.lumpSum || null,
                coverageAmount: input.coverageAmount,
                policyType: input.policyType
            }
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
