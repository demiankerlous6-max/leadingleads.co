# Google Sheets as Database — Setup Guide

LeadingLeads.co stores all verified leads in a Google Sheet you own. This guide takes you from zero to a working integration in about 15 minutes.

## What you'll end up with

- A Google Sheet you can open anytime to view, sort, filter, and share leads with agents
- Three environment variables (`GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`) added to Render
- A working app that writes a new row every time someone gets verified

## Step 1 — Create the Google Sheet (1 min)

1. Go to https://sheets.google.com
2. Click the big colorful "+" or "Blank spreadsheet"
3. Rename it from "Untitled spreadsheet" to **"LeadingLeads Leads Database"** (or anything you like)
4. **Copy the spreadsheet ID** from the URL. The URL looks like:
   ```
   https://docs.google.com/spreadsheets/d/1AbcDefGhIJklMnopQrStUvWxYz0123456789ABCDEF/edit
   ```
   The ID is the long string between `/d/` and `/edit`. **Save this** — you'll paste it as `GOOGLE_SHEETS_ID`.

You don't need to add headers — the app creates them automatically on first run.

## Step 2 — Create a Google Cloud project (3 min)

A service account is how your server talks to Google Sheets without you logging in. It lives inside a Google Cloud project.

1. Go to https://console.cloud.google.com
2. If this is your first time, accept the terms and pick a country
3. At the top, click the project dropdown → **"New Project"**
4. Name it `leadingleads` → click **Create**
5. Wait ~10 seconds for it to provision, then make sure it's selected in the top dropdown

## Step 3 — Enable the Sheets API (1 min)

1. In the left sidebar (☰ menu) → **"APIs & Services" → "Library"**
2. Search for **"Google Sheets API"**
3. Click it → click **Enable**

That's it. The API is now available for your project.

## Step 4 — Create a service account (3 min)

1. ☰ menu → **"APIs & Services" → "Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top → **"Service account"**
3. Service account name: `leadingleads-app`
4. Click **Create and Continue**
5. Role section: leave blank or pick **Basic → Viewer** (the sheet permission is what actually matters, granted in step 5)
6. Click **Continue** → **Done**

You'll see your new service account in the list. **Copy the email address** — it looks like:
```
leadingleads-app@leadingleads-12345.iam.gserviceaccount.com
```
Save this — you'll paste it as `GOOGLE_SERVICE_ACCOUNT_EMAIL`.

## Step 5 — Generate the service account key (2 min)

1. Click the service account email in the list
2. Go to the **Keys** tab
3. Click **"Add Key" → "Create new key"**
4. Choose **JSON** → click **Create**

A file like `leadingleads-12345-abc.json` downloads automatically. Open it in a text editor — you'll see something like:

```json
{
  "type": "service_account",
  "project_id": "leadingleads-12345",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEF...\n-----END PRIVATE KEY-----\n",
  "client_email": "leadingleads-app@leadingleads-12345.iam.gserviceaccount.com",
  ...
}
```

The `private_key` value (everything between the quotes, including `\n` escapes) is what you'll paste as `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. **Keep this file safe and never commit it to git** — anyone with this key has access to whatever you've shared with the service account.

## Step 6 — Share your sheet with the service account (1 min)

This is the critical step. The service account can't access your sheet by default.

1. Open your Google Sheet from Step 1
2. Click the green **Share** button (top right)
3. Paste the service account email (from Step 4)
4. Set the role to **Editor**
5. **Uncheck** "Notify people" (it's an automated account, no inbox)
6. Click **Share**

## Step 7 — Add the variables to Render (2 min)

In your Render dashboard:
1. Open your **leadingleads** web service
2. Go to **Environment** → **"Add Environment Variable"**

Add these three:

| Name | Value |
|---|---|
| `GOOGLE_SHEETS_ID` | (the ID from Step 1) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | (the email from Step 4) |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | (the `private_key` value from Step 5 — see note below) |

**Important about the private key:** Render usually accepts it as-is — paste it including the `\n` escapes. If you have problems, wrap the entire value in double quotes. Both `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines must be included.

Click **Save Changes**. Render will auto-redeploy.

## Step 8 — Verify it works

In Render's **Logs** tab, after deploy you should see:

```
[sheets] Wrote header row to "Leads"
[db] Google Sheets ready as the leads database.
LeadingLeads.co server running on http://localhost:10000
```

Then in your sheet, **row 1 should now contain headers**: `leadId`, `createdAt`, `firstName`, etc. The app wrote them automatically.

## Step 9 — Test the full flow

Submit a quote on your live site (`https://leadingleads.onrender.com/quote.html`). After verification, a new row appears in your Google Sheet within ~2 seconds.

## Free tier limits to know about

| Limit | Value | What it means for you |
|---|---|---|
| Spreadsheet cells | 10 million | ~330,000 lead rows. You won't hit this. |
| Write requests | 60 per minute per service account | Up to 60 new leads per minute. Plenty for an MVP. |
| Read requests | 300 per minute | Plenty. |

If you ever exceed these, the app will queue requests automatically — no data loss, just slight delays.

## Troubleshooting

| Error in logs | Fix |
|---|---|
| `GOOGLE_SHEETS_ID must be set` | Env var missing. Add it in Render. |
| `The caller does not have permission` | You forgot Step 6 — share the sheet with the service account email. |
| `invalid_grant: Invalid JWT Signature` | Private key wasn't pasted correctly. Re-copy from the JSON file, including the BEGIN/END lines. |
| `Requested entity was not found` | The Sheet ID is wrong — re-check the URL. |
| `error:1E08010C:DECODER routines::unsupported` | Private key newlines weren't converted. Wrap the value in double quotes when adding to Render. |

## Working with your data

- **View leads**: Open the sheet. Newest at the bottom.
- **Sort/filter**: Use Google Sheets' built-in tools. Filter by `verified = TRUE`, sort by `createdAt`, etc.
- **Share with agents**: Use the green Share button. Give agents "Viewer" or "Commenter" access — they can see leads without breaking the integration.
- **Export to Excel**: `https://leadingleads.onrender.com/api/leads/export` returns a .xlsx file.
- **Add notes**: Edit the `notes` column directly in the sheet. The app reads but never overwrites this column.

You're all set.
