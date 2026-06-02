// Test Vonage Verify API end-to-end.
// Usage: node scripts/test-vonage.js +15551234567

require('dotenv').config();

const RECIPIENT = process.argv[2];

function fail(msg) {
    console.error('\n\x1b[31m✗  ' + msg + '\x1b[0m\n');
    process.exit(1);
}
function ok(msg) {
    console.log('\x1b[32m✓\x1b[0m ' + msg);
}

if (!RECIPIENT) {
    fail('Usage: node scripts/test-vonage.js +1XXXXXXXXXX\n   Pass the phone number you want to verify.');
}
if (!/^\+\d{10,15}$/.test(RECIPIENT)) {
    fail('Phone number must be in E.164 format, e.g. +15551234567');
}

const { VONAGE_API_KEY, VONAGE_API_SECRET, VONAGE_BRAND } = process.env;

console.log('\nLeadingLeads.co — Vonage Verify credential check\n');

if (!VONAGE_API_KEY) fail('Missing VONAGE_API_KEY in .env');
ok('VONAGE_API_KEY found (' + VONAGE_API_KEY.slice(0, 4) + '...)');

if (!VONAGE_API_SECRET) fail('Missing VONAGE_API_SECRET in .env');
ok('VONAGE_API_SECRET found (hidden)');

const brand = VONAGE_BRAND || 'LeadingLeads';
ok('Brand = "' + brand + '"');

let Vonage;
try {
    Vonage = require('@vonage/server-sdk').Vonage;
} catch (err) {
    fail('Vonage SDK not installed. Run: npm install');
}

const client = new Vonage({ apiKey: VONAGE_API_KEY, apiSecret: VONAGE_API_SECRET });
const toDigits = RECIPIENT.replace(/[^\d]/g, '');

console.log('\nStarting Verify request for ' + RECIPIENT + ' ...');

(async () => {
    let requestId;
    try {
        const result = await client.verify.start({
            number: toDigits,
            brand: brand,
            code_length: 6,
            workflow_id: 1
        });
        if (result.status !== '0') {
            fail('Vonage rejected request (status ' + result.status + '): ' + (result.error_text || 'unknown'));
        }
        requestId = result.request_id;
        ok('Verify request started.');
        console.log('   Request ID:    ' + requestId);
        console.log('\n\x1b[32mCheck your phone now\x1b[0m for an SMS from Vonage with a 6-digit code.');
        console.log('Then re-run this script with the code as the 3rd argument:');
        console.log('   node scripts/test-vonage.js ' + RECIPIENT + ' YOUR_CODE');
        console.log('   (paste the requestId into VERIFY_REQUEST_ID env var when you do)');
        console.log('   export VERIFY_REQUEST_ID=' + requestId + '\n');
    } catch (err) {
        console.error('\n\x1b[31m✗ Vonage Verify request failed.\x1b[0m');
        const detail = err.response && err.response.detail ? err.response.detail : err.message;
        console.error('   ' + detail);

        // Common Verify error decoder
        if (detail.includes('Concurrent verifications')) {
            console.error('\n   Hint: There is already an active verification for this number.');
            console.error('   Wait ~5 minutes for it to expire, then retry.');
        }
        if (detail.includes('Invalid value: \'brand\'')) {
            console.error('\n   Hint: Brand must be a non-empty string under 16 chars.');
        }
        if (detail.includes('Low balance')) {
            console.error('\n   Hint: Top up your Vonage balance at https://dashboard.nexmo.com/billing-and-payments');
        }

        process.exit(1);
    }

    // If a code was passed as 3rd arg, also try to verify it
    const code = process.argv[3];
    const passedRequestId = process.env.VERIFY_REQUEST_ID || requestId;

    if (code) {
        console.log('\nVerifying code "' + code + '" against request ' + passedRequestId + ' ...');
        try {
            const result = await client.verify.check({ requestId: passedRequestId, code: code });
            if (result.status === '0') {
                ok('Code verified successfully!');
                console.log('\n\x1b[32mAll set! Vonage Verify is working end-to-end.\x1b[0m\n');
            } else {
                console.error('\n\x1b[31m✗ Code verification failed.\x1b[0m');
                console.error('   ' + (result.error_text || 'unknown') + '\n');
                process.exit(1);
            }
        } catch (err) {
            console.error('\n\x1b[31m✗ Code verification failed.\x1b[0m');
            console.error('   ' + err.message + '\n');
            process.exit(1);
        }
    }
})();
