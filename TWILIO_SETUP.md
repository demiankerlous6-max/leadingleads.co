# Twilio SMS Setup for LeadingLeads.co

This walks you through everything needed to send real verification codes to your customers' phones. Expect about **20 minutes total**, plus 1–3 business days waiting for A2P 10DLC approval if you're going to production.

## What you'll need before you start

- A US business name (can be a sole proprietorship — yourself is fine)
- A business address
- A federal EIN OR your SSN (for sole proprietors)
- A credit card (Twilio charges per message)
- A working US phone you can receive SMS at (for testing)

## Step 1 — Create the Twilio account (5 minutes)

1. Go to https://www.twilio.com/try-twilio
2. Sign up with your email. Verify your email when prompted.
3. Twilio will ask you to verify a personal phone number (so they can text you the verification code). Use your real phone.
4. On the welcome questionnaire:
   - "What do you want to build?" → **Verify users with SMS**
   - "Which language?" → **Node.js**
   - "What's your goal today?" → **Send my first SMS**

You'll land in the Twilio Console.

## Step 2 — Grab your credentials (2 minutes)

On the Twilio Console homepage (https://console.twilio.com), you'll see an "Account Info" panel:

- **Account SID** — looks like `AC1234567890abcdef...`
- **Auth Token** — click the eye icon to reveal it

Copy both into your `.env` file:

```env
TWILIO_ACCOUNT_SID=AC...your_value_here...
TWILIO_AUTH_TOKEN=your_auth_token_here
```

**Never commit `.env` to git.** It's already in `.gitignore`.

## Step 3 — Buy a phone number (3 minutes)

1. In the Twilio Console, go to **Phone Numbers → Manage → Buy a number** (or the direct link: https://console.twilio.com/us1/develop/phone-numbers/manage/search)
2. Filter:
   - **Country:** United States
   - **Capabilities:** SMS (check this box)
   - **Type:** Local (cheapest, ~$1.15/month) OR Toll-Free (~$2/month, better deliverability)
3. Click **Search**, pick a number, click **Buy**.

Add it to your `.env`:

```env
TWILIO_PHONE_NUMBER=+15551234567
```

The `+1` country code is required.

## Step 4 — Test it (1 minute)

In your project folder, run:

```bash
npm install
node scripts/test-twilio.js +1YOUR_PERSONAL_NUMBER
```

If it works, you'll get a real text on your phone saying "Test SMS from LeadingLeads.co" and the script will print a green success message. **Trial accounts can only send to phone numbers you've verified** (see Step 5).

## Step 5 — IMPORTANT: trial vs. paid account limits

Twilio gives you a free $15 trial credit. While on trial:

- You can only send to **verified phone numbers** (yours and any you manually add at https://console.twilio.com/us1/develop/phone-numbers/manage/verified)
- Every SMS includes a "Sent from your Twilio trial account" prefix

**To send to anyone:** upgrade your account (add a credit card at https://console.twilio.com/us1/billing/upgrade). Costs are pay-as-you-go: ~$0.0079 per SMS sent to the US.

## Step 6 — A2P 10DLC registration (required for production)

US carriers require any business sending SMS via a local 10-digit number to register through "A2P 10DLC" (Application-to-Person, 10-Digit Long Code). **Without this, your messages will be filtered out or throttled to ~1 message per second.**

1. In Twilio Console: **Messaging → Regulatory Compliance → A2P 10DLC** (direct link: https://console.twilio.com/us1/develop/sms/regulatory-compliance/a2p-10dlc)
2. **Register your Brand** (your business):
   - Business legal name
   - EIN (or SSN for sole prop)
   - Business address
   - Website URL (https://leadingleads.co — you must have a live site)
   - Vertical: "Financial Services" or "Insurance"
   - Cost: $4 one-time
3. **Register your Campaign** (the use case):
   - Use case: **Account Notification** or **2FA**
   - Campaign description: "Send one-time verification codes to users requesting a life insurance quote on leadingleads.co"
   - Sample messages: paste 2-3 real examples like "Your LeadingLeads.co verification code is 123456. It expires in 10 minutes."
   - Opt-in flow: describe how users consent (they enter their phone on the quote form and click Submit)
   - Cost: $10 one-time + $1.50/month
4. **Assign your phone number** to the approved campaign.

Approval typically takes 1–3 business days. You can develop and test before this lands — it only affects production-scale sending.

**Alternative: use a Toll-Free number instead** of a local number. Toll-free numbers don't need 10DLC registration, but they have their own (faster) verification process. Slightly higher cost (~$0.013/SMS) but simpler compliance.

## Step 7 — Verify the full app flow

Once your `.env` has all three Twilio values:

```bash
npm start
```

Open http://localhost:3000/quote.html, fill out the quote form with your verified phone number, and you should get the OTP via real SMS.

## Costs at a glance

| Item | Cost |
| --- | --- |
| Account setup | Free |
| Phone number (local) | $1.15/month |
| Phone number (toll-free) | $2.00/month |
| SMS to US (local number) | $0.0079 each |
| SMS to US (toll-free) | $0.013 each |
| A2P 10DLC Brand registration | $4 one-time |
| A2P 10DLC Campaign | $10 one-time + $1.50/month |
| **First-month total (production)** | **~$20** |

At those rates, 1,000 verified leads/month costs about **$10 in SMS + ~$3 in fees = $13/month**. Cheap.

## Troubleshooting

| Symptom | Cause / Fix |
| --- | --- |
| `Error: Authentication Error` | Account SID or Auth Token wrong. Copy them again from console. |
| `Error: 21211 Invalid 'To' Number` | Phone format wrong. Use `+1XXXXXXXXXX` (E.164 format). |
| `Error: 21608 trial account` | You're on trial. Add the recipient at the verified-numbers page or upgrade. |
| `Error: 30007 Carrier filtering` | You're sending from an unregistered local number. Complete A2P 10DLC or switch to toll-free. |
| Messages send but never arrive | Wait 1–2 minutes. If still nothing, check Twilio Console → Monitor → Logs → Messaging to see delivery status. |

## What's next

Once Twilio is working, your verification flow is end-to-end functional:

1. User fills out quote form on `/quote.html`
2. They enter their phone in the contact step
3. On submit, your server hits `/api/otp/send` which calls Twilio
4. Twilio delivers the SMS
5. User enters the code, server verifies it, and the lead is marked verified in your Excel file

You're ready to launch.
