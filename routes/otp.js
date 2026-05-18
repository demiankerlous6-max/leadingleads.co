const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp } = require('../services/otpService');
const { updateLeadVerification, getLeadById } = require('../services/excelService');
const { calculateQuote } = require('../services/quoteEngine');

// POST /api/otp/send  { contact, method }
router.post('/send', async (req, res, next) => {
    try {
        const { contact, method } = req.body;
        if (!contact || !method) {
            return res.status(400).json({ error: 'contact and method are required' });
        }

        if (method === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }
        if (method === 'sms') {
            const cleaned = contact.replace(/\s|-|\(|\)/g, '');
            if (!/^\+?\d{10,15}$/.test(cleaned)) {
                return res.status(400).json({ error: 'Invalid phone number' });
            }
        }

        const result = await sendOtp({ contact, method });
        res.json({ success: true, ...result });
    } catch (err) {
        next(err);
    }
});

// POST /api/otp/verify  { contact, code, leadId }
// On success, also returns the quote (which was withheld during initial submit).
router.post('/verify', async (req, res, next) => {
    try {
        const { contact, code, leadId } = req.body;
        if (!contact || !code) {
            return res.status(400).json({ error: 'contact and code are required' });
        }

        const result = await verifyOtp({ contact, code });
        if (!result.verified) {
            return res.status(400).json(result);
        }

        // Mark lead as verified and re-derive the quote from saved values
        if (leadId) {
            await updateLeadVerification(leadId, result.method);
            const lead = await getLeadById(leadId);
            if (lead) {
                // Reconstruct quote breakdown for display (recompute from saved inputs)
                const quote = calculateQuote({
                    age: Number(lead.age),
                    gender: String(lead.gender),
                    state: String(lead.state),
                    height: Number(lead.height),
                    weight: Number(lead.weight),
                    smokingStatus: String(lead.smokingStatus),
                    healthRating: String(lead.healthRating),
                    hasDiabetes: !!lead.hasDiabetes,
                    hasHeartDisease: !!lead.hasHeartDisease,
                    hasCancerHistory: !!lead.hasCancerHistory,
                    familyHistoryHeartDisease: !!lead.familyHistoryHeartDisease,
                    policyType: String(lead.policyType),
                    coverageAmount: Number(lead.coverageAmount)
                });
                return res.json({
                    verified: true,
                    method: result.method,
                    quote,
                    customer: {
                        firstName: lead.firstName,
                        state: lead.state
                    }
                });
            }
        }

        res.json(result);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
