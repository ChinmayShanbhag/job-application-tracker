# 📬 Job Application Tracker (Gmail → Gemini → Google Sheets)

This Google Apps Script automatically tracks your job applications by scanning your Gmail inbox, extracting key details using Gemini AI, and logging them into a Google Sheet called **"Applications"**.

> 🔒 **Your data stays private.** This script runs entirely within your Google account — no data is stored externally, and Gemini API requests are limited to only the email content needed for extracting status info.

No more manual tracking. This tool helps you keep an organized, color-coded record of all your job statuses — with automatic updates when your application progresses or gets rejected.

---

## ✨ Features

- ✅ Scans Gmail for job application emails (e.g. "Thank you for applying", "application update")
- ✅ Uses Google Gemini API to extract:
  - **Company Name**
  - **Role Title**
  - **Application Status** — one of: `"In Review"`, `"Rejected"`, `"Next Step"`
- ✅ Tracks each email uniquely using Gmail **Message ID**
- ✅ Detects status changes (e.g. "In Review" → "Rejected") and **updates** the row
- ✅ Highlights updated rows temporarily (yellow flash)
- ✅ Color-codes application status:
  - Green → Next Step
  - Yellow → In Review
  - Red → Rejected
- ✅ Auto-sorts the sheet: best opportunities at the top
- ✅ Avoids duplicate entries by company + role
- ✅ Includes `Status Last Updated` timestamp

---

## 📋 Sheet Format

Make sure your Google Sheet is named exactly:

```
Applications
```

It will automatically have this column structure:

| Email Message ID | Email Date-Time | Company Name | Role Title | Application Status | Status Last Updated |
|------------------|------------------|----------------|-------------|---------------------|-----------------------|

---

## 🧠 How It Works

1. Gmail is searched for recent emails with job-related subjects.
2. Gemini extracts structured info.
3. Sheet is updated:
   - New row → if application is new
   - Updated row → if status changed
   - Skipped → if duplicate message or no change
4. Sheet is sorted and color-coded.

---

## 🚀 How to Set Up

### 1. Create a Google Sheet
- Open [Google Sheets](https://sheets.new)
- Name it: `Applications`

### 2. Open the Script Editor
- Go to `Extensions > Apps Script`
- Delete any boilerplate
- Paste contents of `Code.gs` (from this repo)

### 3. Add Your Gemini API Key
In the script, find this line:

```javascript
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE";
```

> 💡 Get your key from [Google AI Studio](https://makersuite.google.com/app/apikey)

Paste your API key in quotes.

### 4. Save & Run
- Click `Run > extractAndTrackJobEmails`
- The first time, you'll need to authorize permissions

---

## ⏰ Automate It (Optional)

To run daily or hourly:
1. In the Apps Script menu: `Triggers` > `+ Add Trigger`
2. Select:
   - Function: `extractAndTrackJobEmails`
   - Event source: `Time-driven`
   - Frequency: e.g., `Every day` or `Every 6 hours`

---

## 🔐 Permissions Required

When authorizing, you'll see requests for:
- Gmail (read-only): to find job-related emails
- Google Sheets: to edit your tracking sheet
- External services: to call Gemini API

---


## 📄 License

MIT License – feel free to use, adapt, or fork.

---

## 🧑‍💻 Built by [Chinmay Shanbhag](https://www.linkedin.com/in/chinmay-shanbhag)

This tool was built out of job search frustration — now it's yours too.
