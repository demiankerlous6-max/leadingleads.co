# LeadingLeads.co

Life insurance lead generation platform with quote engine, two-step verification, and Excel-based lead storage.

## Features

- **Landing page** with product overview and policy comparison
- **Policy catalog** describing five life insurance products (10/20/30-year term, whole, universal)
- **Multi-step quote form** with client- and server-side validation
- **Quote algorithm** modeled on 2026 industry rates (age, gender, smoking, BMI, health, conditions, state, coverage amount, policy type)
- **Input safety**: rejects nonsensical data (e.g. birthdate before 1900, age under 18 or over 85, BMI inputs out of human range, invalid ZIP/email/phone)
- **Two-step verification** via email (Nodemailer) or SMS (Twilio). Falls back to demo mode if credentials missing.
- **Excel storage** (.xlsx) for leads and OTP records — open with Excel/Numbers to view
- **Rate limiting and Helmet security headers**

## Project Structure

```
LeadingLeads.co/
├── package.json
├── server.js
├── .env.example          # copy to .env
├── routes/
│   ├── quote.js
│   ├── otp.js
│   ├── leads.js
│   └── policies.js
├── services/
│   ├── validation.js     # input validation rules
│   ├── quoteEngine.js    # premium calculation algorithm
│   ├── excelService.js   # Excel read/write
│   └── otpService.js     # email + SMS OTP
├── policies/
│   └── policies.js       # product catalog
├── public/               # frontend
│   ├── index.html
│   ├── quote.html
│   ├── policies.html
│   ├── css/style.css
│   └── js/
└── data/
    └── leadingleads.xlsx # auto-created on first run
```

## Setup

1. **Install Node.js 18+** (https://nodejs.org)

2. **Install dependencies**:
   ```bash
   cd LeadingLeads.co
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and fill in:
   - **Email**: Gmail App Password (https://myaccount.google.com/apppasswords), or SendGrid/Mailgun SMTP
   - **Twilio**: Account SID, Auth Token, and a Twilio phone number from https://console.twilio.com

   You can leave credentials blank for **demo mode** — OTP codes will print to the server console instead of being sent.

4. **Run the server**:
   ```bash
   npm start
   ```
   Open http://localhost:3000

5. **Find your leads**:
   Every submission is appended to `./data/leadingleads.xlsx`. Open it in Excel to review.

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/policies` | List all policy types |
| GET | `/api/policies/:id` | Get one policy |
| POST | `/api/quote` | Validate input, calculate quote, save lead |
| POST | `/api/otp/send` | Send a verification code by email or SMS |
| POST | `/api/otp/verify` | Verify the 6-digit code |
| GET | `/api/leads?verifiedOnly=true&limit=100` | List leads (admin) |
| GET | `/health` | Server health check |

## Quote Algorithm

The premium is calculated as:

```
annualPremium = baseRatePer1k(age) × (coverage / 1000)
              × policyTypeMultiplier
              × genderMultiplier
              × smokingMultiplier
              × healthMultiplier
              × stateMultiplier
              × bmiMultiplier
              × conditionsMultiplier
              × coverageDiscount
```

Constants are documented in `services/quoteEngine.js` and informed by:
- NerdWallet, ValuePenguin, Ramsey, Insuranceopedia 2026 average rate charts
- Policygenius state-by-state variation analysis
- Standard actuarial guidance (men pay ~23% more, smokers pay 2-3x more, rates accelerate after 45)

## Input Validation Rules

Server-side (`services/validation.js`):
- First/last name: 2–50 chars
- Date of birth: must be a valid date, after 1900, applicant 18–85
- State: must be a real US state code
- ZIP: 5 digits or 5+4
- Height: 36–96 inches
- Weight: 50–700 lbs
- Smoking: never, former, or current
- Health rating: excellent, good, average, or poor
- Coverage: $25,000–$5,000,000 in $1,000 increments
- Email: standard regex check
- Phone: US format (e.g. +1 555-123-4567)

Client-side mirrors these rules and additionally constrains the date picker's `min`/`max` to prevent UI nonsense.

## Marketing Launch Checklist

Once the site is live, prioritize:

1. **SEO foundations** — Create a sitemap.xml, robots.txt, and submit to Google Search Console. Target keywords: "term life insurance quote", "compare life insurance", "[state] life insurance rates".
2. **Google Ads** — Run small-budget search campaigns on high-intent keywords ("life insurance quote", "term life calculator"). Track conversions via verified-lead count.
3. **Facebook/Instagram Lead Ads** — Custom audiences for parents 25–55. The 2-minute quote form is the strongest hook.
4. **Content marketing** — Publish 1 blog post per week answering common questions ("How much life insurance do I need?", "Term vs whole life", "Life insurance with diabetes"). Each post should link to `/quote.html`.
5. **Email follow-up** — Use Mailchimp/SendGrid to nurture unverified leads with a 3-email drip campaign.
6. **Partnerships** — Reach out to financial planners, mortgage brokers, and HR benefit consultants for referral arrangements.
7. **Trust signals** — Add a Privacy Policy, Terms of Service, BBB rating, and customer testimonials before paid traffic.
8. **Analytics** — Add Google Analytics 4 and PostHog. Track funnel: landing → quote form start → step 4 → submit → verified.

## Production Notes

For a real launch, replace these MVP shortcuts:
- **Database**: migrate from Excel to PostgreSQL or MongoDB for concurrent writes at scale.
- **OTP storage**: move to Redis with TTL keys instead of Excel rows.
- **Auth**: add session/JWT for the admin leads endpoint (currently unprotected).
- **Compliance**: review state-by-state regulations for life insurance marketing (CAN-SPAM, TCPA for SMS, state-specific disclosure rules).
- **Hosting**: deploy to Render, Railway, or AWS. Use a managed database and SendGrid/Twilio with verified domain.

## License

Proprietary.
