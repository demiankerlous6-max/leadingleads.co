const express = require('express');
const router = express.Router();
const POLICIES = require('../policies/policies');

router.get('/', (req, res) => {
    res.json({ policies: POLICIES });
});

router.get('/:id', (req, res) => {
    const policy = POLICIES.find(p => p.id === req.params.id);
    if (!policy) return res.status(404).json({ error: 'Policy not found' });
    res.json({ policy });
});

module.exports = router;
