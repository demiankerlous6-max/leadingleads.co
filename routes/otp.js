const express = require('express');
const router = express.Router();
const { sendOtp, verifyOtp } = require('../services/otpService');
const { updateLeadVerification } = require('../services/excelService');

// POST /api/otp/send  { contact, method }
router.post('/send', async (req, res, next) => {
    try {
        const { contact, method } = req.body;
        if (!contact || !method) {
            return res.status(400).json({ error: 'contact and method are required' });
        }

        // Basic per-method validation
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

// POST /api/otp/verify  { contact, code, leadId? }
router.post('/verify', async (req, res, next) => {
    try {
        const { contact, code, leadId } = req.body;
        if (!contact || !code) {
            return res.status(400).json({ error: 'contact and code are required' });
        }

        const result = await verifyOtp({ contact, code });
        if (result.verified && leadId) {
            await updateLeadVerification(leadId, result.method);
        }

        if (!result.verified) return res.status(400).json(result);
        res.json(result);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
