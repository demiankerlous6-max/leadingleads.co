const express = require('express');
const router = express.Router();
const { listLeads, exportLeadsToExcelBuffer } = require('../services/dataStore');

// GET /api/leads (admin view, JSON)
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

// GET /api/leads/export — download all leads as a .xlsx file
// e.g. /api/leads/export?verifiedOnly=true
router.get('/export', async (req, res, next) => {
    try {
        const verifiedOnly = req.query.verifiedOnly === 'true';
        const buffer = await exportLeadsToExcelBuffer({ verifiedOnly });
        const filename = `leadingleads-export-${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
