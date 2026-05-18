# LeadingLeads.co — Marketing Playbook

A practical, step-by-step plan for driving qualified, verified leads to the site. Sequenced from cheapest/fastest to broadest reach.

## Phase 1: Foundation (Week 1)

Goal: make sure the site is launch-ready before spending on traffic.

- Buy the leadingleads.co domain (if not yet owned). Point it at the production host.
- Deploy with HTTPS (Render, Railway, or Vercel are easiest). Free SSL via Let's Encrypt.
- Add Google Analytics 4 and a simple event tracker — fire events for `quote_started`, `quote_step_complete`, `quote_submitted`, `otp_verified`.
- Write a Privacy Policy and Terms of Service. Use Termly or iubenda. Required before running ads on Google/Meta.
- Configure SendGrid or Mailgun with a verified domain (`noreply@leadingleads.co`). Improves OTP email deliverability vs. Gmail.
- Twilio: buy a US toll-free number, register A2P 10DLC campaign. Without this, SMS OTPs are rate-limited and may fail in production.

## Phase 2: SEO (Weeks 2–8)

Free traffic, slowest to build but most durable.

Target keyword clusters:
- Transactional: "[state] life insurance quote", "term life insurance calculator", "compare life insurance"
- Informational: "how much life insurance do I need", "term vs whole life", "life insurance for [condition]"

Action items:
- Create state landing pages — `/quote/california`, `/quote/texas`, etc. Each page should mention the state's average rates and link to the universal quote form.
- Publish one 1,200-word blog post per week. Topic ideas: 12 in a backlog, then refresh quarterly.
- Add `sitemap.xml`, `robots.txt`, structured data (schema.org/InsuranceAgency, FAQPage).
- Build backlinks: submit to insurance directories (Insurify, Policygenius alternatives lists). Pitch guest posts to personal finance blogs.

## Phase 3: Paid Acquisition (Week 3+)

Run in parallel with SEO once analytics + the quote funnel are stable.

### Google Ads
- Start with $20/day on a tightly themed search campaign.
- Keywords: "term life insurance quote", "life insurance calculator", "compare term life".
- Use exact and phrase match. Add negative keywords: "free", "for dogs", "jobs", "license".
- Landing page: `/quote.html` directly (not the homepage).
- Track verified leads as the conversion event in Google Ads — not raw submits.

### Meta Ads (Facebook + Instagram)
- Audience: U.S., age 28–55, parents, homeowners, household income $50k+.
- Creative: 15-second video showing the 2-minute quote in action.
- Use Meta's Lead Ads format to capture email/phone in-platform; pipe through Zapier to `/api/leads` (you'll need to add an inbound webhook for this).

### LinkedIn (B2B, optional)
- Target HR managers, benefits consultants, financial advisors.
- Offer a "group quote tool" if you build a B2B variant.

## Phase 4: Lifecycle & Retention (ongoing)

Verified leads are worth 5–10× unverified ones. Nurture both.

### Email drip for unverified leads
1. Day 0 (after submission): "Your quote is ready — verify to see it"
2. Day 2: "Why verification matters" + social proof
3. Day 7: "Last chance" + a discount code from your underwriting partner

### Email drip for verified leads
1. Day 0: "An agent will call you within 1 business day"
2. Day 3: Educational — "Term vs whole, which is right for you?"
3. Day 10: "Refer a friend — get a $25 Amazon gift card"

Use SendGrid, Mailchimp, or Customer.io. All can read your Excel/leads via Zapier or a small sync script.

## Phase 5: Partnerships

The highest-quality leads come from referrals. Target:
- Mortgage brokers — they meet first-time homebuyers who need term life.
- Financial advisors / CFPs — they advise on coverage needs.
- HR benefits consultants — group voluntary life coverage.
- Real estate agents — newly-mortgaged clients.

Build a partner portal at `/partner` with a unique tracking code per partner. Pay a referral fee per verified lead.

## KPIs to Track

| Metric | Target (3 months) |
| --- | --- |
| Site visitors / month | 5,000+ |
| Quote starts (form opened) | 800+ |
| Quote submissions | 200+ |
| Verified leads | 100+ |
| Cost per verified lead | < $25 |
| Verified-to-policy conversion | > 15% |

## Budget Template (first 90 days)

| Item | Cost |
| --- | --- |
| Domain + hosting | $40 |
| SendGrid + Twilio (~1k OTPs) | $80 |
| Google Ads | $1,800 |
| Meta Ads | $1,200 |
| Content writing (12 posts) | $1,200 |
| Legal (T&C + privacy) | $300 |
| **Total** | **~$4,620** |

At $25/verified lead, that's ~185 leads. At 15% policy conversion and a $400 average commission per policy issued, payback breakeven is ~28 conversions.
