# LeadingLeads Database Schema

This document describes the Google Sheets database schema and the **exact procedure** to change a column without breaking the code.

The golden rule: **the code and the sheet must always have the same columns in the same order.** If they fall out of sync, the next write puts data in the wrong column.

---

## Current schema (14 columns)

| # | Column letter | Header (in sheet) | Internal code name | When written | Notes |
|---|---|---|---|---|---|
| 1 | A | Submitted | `submittedAt` | Form submit | Auto-formatted MM/DD/YYYY HH:MM:SS in America/New_York |
| 2 | B | Name | `name` | Form submit | First + Last combined |
| 3 | C | Phone | `phone` | Form submit | Digits only |
| 4 | D | Verified | `verified` | Form submit ("No") → OTP success ("Yes") | |
| 5 | E | Consented | `consented` | Form submit ("No") → OTP success ("Yes") | |
| 6 | F | Verified At | `verifiedAt` | OTP success | Same format as Submitted |
| 7 | G | State | `state` | Form submit | 2-letter code (OH, TX, etc.) |
| 8 | H | Age | `age` | Form submit | |
| 9 | I | Coverage Type | `coverageType` | Form submit | level / graded-modified / guaranteed / etc. |
| 10 | J | Coverage Amount | `coverageAmount` | Form submit | Dollars, no formatting |
| 11 | K | Monthly Estimate | `monthlyEstimate` | Form submit | Dollars, two decimal places |
| 12 | L | Email | `email` | Form submit | Blank if not provided |
| 13 | M | Consent Version | `consentVersion` | OTP success | e.g. `v1-2026-06-15` |
| 14 | N | Lead ID | `leadId` | Form submit | Internal UUID, mostly for debugging |

The header row (paste into A1):

```
Submitted	Name	Phone	Verified	Consented	Verified At	State	Age	Coverage Type	Coverage Amount	Monthly Estimate	Email	Consent Version	Lead ID
```

---

## How to change a column (the only safe procedure)

**Doing only one of these steps will break the database. Always do both, in the same change.**

### Step 1 — Update the code

Open `services/sheetsClient.js`. Two places to edit:

```js
const COLUMNS = [
    'submittedAt',     // A: Submitted
    'name',            // B: Name
    // ... add/remove/reorder entries here ...
];

const HEADER_LABELS = {
    submittedAt: 'Submitted',
    name: 'Name',
    // ... matching entries here ...
};
```

The order of `COLUMNS` determines which column letter each field lands in. `HEADER_LABELS` only affects what text the sheet would show if headers were empty (we don't auto-write headers anymore, but keep them in sync for clarity).

If the new column needs to be filled at form submit: edit `saveLead` in `services/dataStore.js`, add the field to the `row` object.

If the new column needs to be filled at verification: edit `updateLeadVerification` in `services/dataStore.js`, add the field to the `updateRowFields` call.

If the new column is a date or timestamp: add the internal name to `DATE_COLUMNS` in `sheetsClient.js`.

### Step 2 — Update the sheet header row

Open the Google Sheet. **Clear row 1 entirely first.** Then paste a new header row that exactly matches the new `COLUMNS` order, with the friendly names from `HEADER_LABELS`.

Re-bold row 1 (Ctrl+B). Confirm View → Freeze → 1 row is still in effect.

### Step 3 — Deploy

```
git add -A
git commit -m "Schema change: <describe what changed>"
git push origin main
```

Render redeploys. Watch the logs — you want to see:

```
[sheets] Headers verified — 14 columns ready in tab "Leads".
```

If you see `Header row in tab "Leads" has X filled cells, expected 14` (or a different number), the code and sheet are out of sync. Fix whichever is wrong.

---

## Existing rows when the schema changes

**Important:** if you add or remove columns, **existing rows in the sheet keep their old layout**. The code will read them assuming the new layout, which will misalign fields.

You have three options when changing schema after launch:

1. **Migrate the old data** by hand — copy old rows into the new layout in Sheets
2. **Archive the old sheet** — make a copy, then clear data rows from the live sheet and start fresh
3. **Add new columns only at the end** — existing rows just have blanks in the new columns, which is fine

Option 3 is the safest for non-breaking changes. Adding `Lead ID` at column N is an example.

---

## Consent versioning

The `Consent Version` column tracks which version of the consent box text the user agreed to. The current version is defined in `services/dataStore.js`:

```js
const CONSENT_VERSION = 'v1-2026-06-15';
```

When the consent text on `public/quote.html` changes:

1. Update the new text on the page
2. Bump the version constant — e.g. `'v2-2026-09-01'`
3. Keep a reference somewhere (this file, a private doc, your notes) of what each version's text was

Old verified rows keep their original version string, so you always know exactly what each user agreed to.

---

## TL;DR

1. **Code source of truth**: `COLUMNS` array in `services/sheetsClient.js`
2. **Sheet source of truth**: row 1 of the Leads tab
3. They must match. Any change needs both edited at the same time.
4. Push code → check Render logs → confirm headers verified.
