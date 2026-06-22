// LeadingLeads.co - Main Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

const quoteRoutes = require('./routes/quote');
const otpRoutes = require('./routes/otp');
const leadRoutes = require('./routes/leads');
const policyRoutes = require('./routes/policies');
const { initializeSchema } = require('./services/dataStore');

const app = express();
const PORT = process.env.PORT || 3000;

// Render/Heroku/most hosts put us behind a reverse proxy.
// This tells Express to trust the X-Forwarded-* headers so rate-limiting
// and IP detection work correctly.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // Meta Pixel loads from connect.facebook.net
            scriptSrc: ["'self'", "'unsafe-inline'", "https://connect.facebook.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            // Facebook tracking pixel image goes to www.facebook.com
            imgSrc: ["'self'", "data:", "https:", "https://www.facebook.com"],
            connectSrc: ["'self'", "https://connect.facebook.net", "https://www.facebook.com"]
        }
    }
}));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});

const otpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many OTP requests, please wait before trying again.' }
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/quote', apiLimiter, quoteRoutes);
app.use('/api/otp', otpLimiter, otpRoutes);
app.use('/api/leads', apiLimiter, leadRoutes);
app.use('/api/policies', policyRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error'
    });
});

// Start server — boot even if the Google Sheets DB is unreachable.
// Quote, OTP, and the rest of the site still work; leads just won't be saved.
(async () => {
    try {
        await initializeSchema();
        console.log(`Database: Google Sheets (${process.env.GOOGLE_SHEETS_ID})`);
    } catch (err) {
        console.warn('[db] Google Sheets unavailable — running without lead storage.');
        console.warn('[db] Reason:', err.message || err);
        // Site continues to start. Re-enable by fixing GOOGLE_SERVICE_ACCOUNT_JSON.
    }
    app.listen(PORT, () => {
        console.log(`\nLeadingLeads.co server running on http://localhost:${PORT}`);
    });
})();
