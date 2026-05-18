const express = require('express');
const router = express.Router();
const { listLeads } = require('../services/excelService');

// GET /api/leads (admin view)
router.get('/', async (req, res, next) => {
    try {
        const verifiedOnly = req.query.verifiedOnly === 'true';
        const limit = Math.min(Number(req.query.limit) || 100, 500);
        const leads = await listLeads({ limit, verifiedOnly });
        res.json({ count: leads.length, leads });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
