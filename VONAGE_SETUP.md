# Vonage SMS Setup for LeadingLeads.co

Vonage replaces Twilio as your SMS provider. About 15 minutes total.

## What you'll need

- A working email address
- A credit card (for adding paid credit later — sign-up itself is free)
- A working US phone you can receive SMS at (for testing)

## Step 1 — Create the Vonage account (5 min)

1. Go to **https://www.vonage.com/communications-apis/sms/** → click **"Get started"** or **"Sign up"**
2. Fill in name, email, and create a password
3. Verify your email when prompted
4. Verify your personal phone number (Vonage sends a code via SMS)
5. When asked "what are you building?", pick **2-Factor Authentication** or **OTP / Verification**

You'll land in the Vonage / Nexmo dashboard at https://dashboard.nexmo.com

## Step 2 — Grab your API key and secret (1 min)

On the dashboard home page you'll see a panel called **"API Settings"** (or look in the left sidebar → **API Keys**).

Two values to copy:
- **API key** — short alphanumeric, e.g. `a1b2c3d4`
- **API secret** — longer string. Click the eye icon to reveal it.

Add them to your `.env` file:

```env
VONAGE_API_KEY=a1b2c3d4
VONAGE_API_SECRET=your_secret_value_here
```

## Step 3 — Decide on a sender (1 min)

Vonage has two options for the "from" field of your SMS:

**Option A — Alphanumeric Sender ID** (easier for testing)
- Use a brand name like `LeadingLeads` (max 11 characters, no spaces)
- Works in many countries WITHOUT registration
- **In the US it requires registration** for production traffic (more on this in Step 6)
- Cheaper — no number to rent

**Option B — Buy a phone number**
- Vonage dashboard → **Numbers → Buy numbers** → pick a US number (~$0.90/mo)
- Add the number (without the `+`) as `VONAGE_FROM` in `.env`, e.g. `15551234567`
- US toll-free numbers are an option too — slightly more expensive but better deliverability

For **getting started fast**, go with Option A:

```env
VONAGE_FROM=LeadingLeads
```

## Step 4 — Test it (1 min)

In your terminal:

```bash
cd "C:\Users\demia\OneDrive\Documents\Claude\Projects\LeadingLeads.co"
npm install
npm run test:sms +1YOUR_PERSONAL_NUMBER
```

If it works, your phone gets a test text within 30 seconds and the terminal prints:

```
✓ VONAGE_API_KEY found (a1b2...)
✓ VONAGE_API_SECRET found (hidden)
✓ VONAGE_FROM = "LeadingLeads"
✓ Message accepted by Vonage.
  Message ID:    abc123
  Status:        0 (delivered)
  Cost:          0.00845 USD
```

## Step 5 — IMPORTANT: trial vs. paid limits

Free signup gives you **€2.00 of free credit** (~250 messages at $0.008 each). After that you'll need to add a credit card.

While on trial:
- **You can only send to phone numbers you've verified** at https://dashboard.nexmo.com/your-numbers
- Add your personal phone there before testing

To send to anyone, **add a payment method** at https://dashboard.nexmo.com/billing-and-payments. No fixed monthly fees — you pay only for what you send.

## Step 6 — US SMS registration (required for production at scale)

US carriers require Application-to-Person (A2P) registration for any business sending SMS. Vonage handles this differently than Twilio:

- **Up to ~100 messages/day** — you can usually send without registration via "shared short codes." Good for testing.
- **For real production volume** — register your brand at Vonage dashboard → **Messages → 10DLC** (or **Toll-Free Verification** if you bought a toll-free number)
- Brand registration: ~$4 one-time + ~$2/month
- Campaign registration: ~$10 one-time + ~$1.50/month
- Approval typically takes 1-3 business days

You don't need this to start testing — it only kicks in at scale.

## Step 7 — Add env vars to Render

In your Render dashboard → leadingleads-co → **Environment** tab:

1. **Delete the old Twilio vars** (click trash icon on each):
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

2. **Add the new Vonage vars**:

| Name | Value |
|---|---|
| `VONAGE_API_KEY` | (from Step 2) |
| `VONAGE_API_SECRET` | (from Step 2) |
| `VONAGE_FROM` | `LeadingLeads` (or your purchased number without +) |

3. Click **Save Changes**. Render auto-redeploys.

## Step 8 — Push the code and verify

```bash
git add .
git commit -m "Switch SMS provider from Twilio to Vonage"
git push
```

Once Render redeploys, submit a quote at https://leadingleads-co.onrender.com/quote.html and the verification SMS should now arrive via Vonage.

## Costs at a glance

| Item | Cost |
|---|---|
| Account setup | Free + €2.00 trial credit |
| SMS to US (with Alpha sender) | ~$0.0085 each |
| Phone number (optional) | ~$0.90/month |
| US 10DLC brand registration | $4 one-time + $2/month |
| US 10DLC campaign | $10 one-time + $1.50/month |

At those rates, 1,000 verified leads/month costs **~$8.50 in SMS** — slightly cheaper than Twilio.

## Troubleshooting

| Error in logs | Fix |
|---|---|
| `Vonage error 4: Invalid Credentials` | API key or secret wrong. Re-copy from dashboard. |
| `Vonage error 15: Invalid sender address` | Your `VONAGE_FROM` value isn't allowed for the destination country. Try a numeric From (a Vonage number you bought) instead of alphanumeric. |
| `Vonage error 29: Non-whitelisted destination` | Trial account — verify the recipient number at https://dashboard.nexmo.com/your-numbers or upgrade. |
| `Vonage error 8/9: Account barred / quota exceeded` | Add credit at https://dashboard.nexmo.com/billing-and-payments |
| Messages send but never arrive | Check delivery logs at https://dashboard.nexmo.com/sms |

## Cleanup of old Twilio account

After Vonage is working:
1. Cancel any active Twilio phone numbers at https://console.twilio.com/us1/develop/phone-numbers/manage/active-numbers (otherwise you'll keep getting charged)
2. Close your Twilio account if you don't need it anymore (Twilio console → Account → Close my account)
3. **Rotate your Twilio Auth Token** if you haven't — the old one was visible in our chat history.

You're set.
