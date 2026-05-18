// Test Twilio credentials end-to-end by sending a real SMS.
// Usage: node scripts/test-twilio.js +15551234567

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
    fail('Usage: node scripts/test-twilio.js +1XXXXXXXXXX\n   Pass the phone number you want to receive the test SMS.');
}
if (!/^\+\d{10,15}$/.test(RECIPIENT)) {
    fail('Phone number must be in E.164 format, e.g. +15551234567');
}

const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;

console.log('\nLeadingLeads.co — Twilio credential check\n');

if (!TWILIO_ACCOUNT_SID) fail('Missing TWILIO_ACCOUNT_SID in .env');
ok('TWILIO_ACCOUNT_SID found (' + TWILIO_ACCOUNT_SID.slice(0, 8) + '...)');

if (!TWILIO_AUTH_TOKEN) fail('Missing TWILIO_AUTH_TOKEN in .env');
ok('TWILIO_AUTH_TOKEN found (hidden)');

if (!TWILIO_PHONE_NUMBER) fail('Missing TWILIO_PHONE_NUMBER in .env');
if (!/^\+\d{10,15}$/.test(TWILIO_PHONE_NUMBER)) {
    fail('TWILIO_PHONE_NUMBER must be in E.164 format, e.g. +15551234567');
}
ok('TWILIO_PHONE_NUMBER found (' + TWILIO_PHONE_NUMBER + ')');

let twilio;
try {
    twilio = require('twilio');
} catch (err) {
    fail('Twilio SDK not installed. Run: npm install');
}

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

console.log('\nSending test SMS to ' + RECIPIENT + ' ...');

(async () => {
    try {
        const message = await client.messages.create({
            body: 'Test SMS from LeadingLeads.co — your Twilio integration is working. Code: 123456',
            from: TWILIO_PHONE_NUMBER,
            to: RECIPIENT
        });

        ok('Message accepted by Twilio.');
        console.log('   SID:     ' + message.sid);
        console.log('   Status:  ' + message.status);
        console.log('   Price:   ' + (message.price || 'pending'));

        console.log('\n\x1b[32mAll set!\x1b[0m Check ' + RECIPIENT + ' for the test message in the next 30 seconds.');
        console.log('If it doesn\'t arrive, view delivery status at:');
        console.log('   https://console.twilio.com/us1/monitor/logs/sms\n');
    } catch (err) {
        console.error('\n\x1b[31m✗ Twilio request failed.\x1b[0m');
        console.error('   Code:    ' + (err.code || 'unknown'));
        console.error('   Message: ' + err.message);
        console.error('   More:    ' + (err.moreInfo || 'n/a'));

        const hints = {
            20003: 'Authentication error — Account SID or Auth Token is wrong. Re-copy from https://console.twilio.com',
            21211: 'Invalid recipient phone — must be E.164 format (+1XXXXXXXXXX).',
            21608: 'Trial account — verify the recipient at https://console.twilio.com/us1/develop/phone-numbers/manage/verified or upgrade.',
            21610: 'Recipient has unsubscribed by replying STOP. They must text START to your number to opt back in.',
            30007: 'Carrier filtering — finish A2P 10DLC registration or switch to a toll-free number. See TWILIO_SETUP.md step 6.'
        };
        if (hints[err.code]) console.error('\n   Hint: ' + hints[err.code]);
        console.error();
        process.exit(1);
    }
})();
