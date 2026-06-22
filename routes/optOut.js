const express = require('express');
const router = express.Router();
const { addOptOut, normalize } = require('../services/optOut');

// POST /api/opt-out  { phone, reason? }
router.post('/', async (req, res, next) => {
    try {
        const { phone, reason } = req.body || {};
        const n = normalize(phone);
        if (!n || n.length !== 10) {
            return res.status(400).json({ error: 'Valid 10-digit US phone number required.' });
        }
        await addOptOut(n, reason || '');
        console.log('[optout] Recorded opt-out for ' + n.slice(0,3) + 'XXX' + n.slice(-4));
        res.json({ success: true, message: 'Opt-out recorded.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
