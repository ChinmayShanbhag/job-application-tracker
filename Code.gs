const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY_HERE"; // Replace this with your actual key

// 1. Main function
function extractAndTrackJobEmails() {
  const sheet = getOrCreateSheet("Applications");
  setHeadersIfMissing(sheet);
  const data = sheet.getDataRange().getValues();

  const threads = GmailApp.search('subject:("Thank you for Applying" OR "application update") newer_than:3d');

  threads.forEach(thread => {
    const msg = thread.getMessages()[0];
    const messageId = msg.getId();
    const emailDate = msg.getDate();
    const body = msg.getPlainBody();

    if (findRowByMessageId(data, messageId) !== -1) return;

    const geminiResult = queryGemini(body);
    const company = extract(geminiResult, "Company Name");
    const role = extract(geminiResult, "Role Title");
    const rawStatus = extract(geminiResult, "Application Status");
    const status = classifyStatus(rawStatus, body);

    updateOrInsertRow(sheet, data, messageId, emailDate, company, role, status);
  });

  removeOldDuplicates(sheet);
  applyStatusColor(sheet);
  sortSheet(sheet);
}

// 2. Query Gemini
function queryGemini(emailBody) {
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=" + GEMINI_API_KEY;
  const prompt = {
    contents: [{
      parts: [{
        text: `Read the following job application email and extract exactly:
- Company Name
- Role Title
- Application Status (choose one of: "In Review", "Rejected", "Next Step")

Strict formatting rules:
- If the Role Title is missing or unclear, use exactly: "Not specified"
- Do NOT repeat or copy any Application Status into the Role Title
- Do NOT use values like "Unknown", "Not found", or system messages
- Output must be in the format:

**Company Name:** ...
**Role Title:** ...
**Application Status:** ...

Email content:
${emailBody}`
      }]
    }]
  };

  const options = {
    method: "POST",
    contentType: "application/json",
    payload: JSON.stringify(prompt)
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  return json.candidates?.[0]?.content?.parts?.[0]?.text || "No response";
}

// 3. Extract field from Gemini result
function extract(text, field) {
  const match = text.match(new RegExp(`\\*\\*${field}:\\*\\*\\s*(.+)`));
  return match ? match[1].trim() : "Not found";
}

// 4. Classify status with override for vague "Next Step"
function classifyStatus(rawStatus, emailBody) {
  const cleanStatus = rawStatus.trim();
  const lowerText = emailBody.toLowerCase();

  // Only allow "Next Step" if it passes all checks
  const nextStepTriggers = [
    "we would like to schedule an interview",
    "you are moving forward",
    "we’re excited to proceed",
    "you’ve been selected for next steps",
    "congratulations",
    "you've been shortlisted",
    "please book a time",
    "interview invitation",
    "move forward in the process"
  ];

  const falsePositiveTriggers = [
    "if selected",
    "if you meet the requirements",
    "if we decide to move forward",
    "we may contact you",
    "might reach out",
    "please check your dashboard",
    "application is under review",
    "we'll be in touch if",
    "depending on qualifications"
  ];

  if (cleanStatus === "Rejected") return "Rejected";

  if (cleanStatus === "Next Step") {
    const isFalsePositive = falsePositiveTriggers.some(phrase => lowerText.includes(phrase));
    const isRealNextStep = nextStepTriggers.some(phrase => lowerText.includes(phrase));

    return isRealNextStep && !isFalsePositive ? "Next Step" : "In Review";
  }

  return "In Review";
}


// 5. Check for existing messageId
function findRowByMessageId(data, messageId) {
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === messageId) return i;
  }
  return -1;
}

// 6. Find row by company + role
function findRowByCompanyAndRole(data, company, role) {
  for (let i = 1; i < data.length; i++) {
    if (
      data[i][2]?.toLowerCase() === company.toLowerCase() &&
      data[i][3]?.toLowerCase() === role.toLowerCase()
    ) {
      return i;
    }
  }
  return -1;
}

// 7. Insert or update row based on status change
function updateOrInsertRow(sheet, data, messageId, emailDate, company, role, status) {
  const existingIndex = findRowByCompanyAndRole(data, company, role);
  const now = new Date();

  if (existingIndex !== -1) {
    const existingStatus = data[existingIndex][4];
    if (existingStatus !== status) {
      const rowNum = existingIndex + 1;
      sheet.getRange(rowNum, 1, 1, 6).setValues([[messageId, emailDate, company, role, status, now]]);
      highlightUpdatedRow(sheet, rowNum);
    }
  } else {
    sheet.appendRow([messageId, emailDate, company, role, status, now]);
  }
}

// 8. Highlight recently updated row
function highlightUpdatedRow(sheet, rowNum) {
  const range = sheet.getRange(rowNum, 1, 1, 6);
  range.setBackground("#fff475");
  SpreadsheetApp.flush();
  Utilities.sleep(1000);
  range.setBackground(null);
}

// 9. Set headers and make them bold
function setHeadersIfMissing(sheet) {
  const headers = [
    'Email Message ID',
    'Email Date-Time',
    'Company Name',
    'Role Title',
    'Application Status',
    'Status Last Updated'
  ];
  const range = sheet.getRange(1, 1, 1, headers.length);
  const current = range.getValues()[0];
  const isMissing = current.some((cell, i) => cell !== headers[i]);
  if (isMissing) {
    range.setValues([headers]);
    range.setFontWeight("bold");
  }
}

// 10. Apply color codes to Application Status column
function applyStatusColor(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const statusRange = sheet.getRange(2, 5, lastRow - 1);

  const rules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Rejected")
      .setBackground("#f28b82")
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("In Review")
      .setBackground("#fff475")
      .setRanges([statusRange])
      .build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("Next Step")
      .setBackground("#81c995")
      .setRanges([statusRange])
      .build()
  ];

  sheet.setConditionalFormatRules(rules);
}

// 11. Sort by Status priority and date
function sortSheet(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const statusRank = { "Next Step": 1, "In Review": 2, "Rejected": 3 };

  data.sort((a, b) => {
    const rankA = statusRank[a[4]] || 4;
    const rankB = statusRank[b[4]] || 4;
    if (rankA !== rankB) return rankA - rankB;
    return new Date(b[1]) - new Date(a[1]); // Newest first
  });

  sheet.getRange(2, 1, data.length, headers.length).setValues(data);
}

// 12. Deduplicate older rows (by company + role)
function removeOldDuplicates(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const seen = new Map();
  const cleaned = [];

  // Loop from bottom (latest) to top, skipping header
  for (let i = data.length - 1; i > 0; i--) {
    const key = `${data[i][2]?.toLowerCase()}|${data[i][3]?.toLowerCase()}`; // Company | Role
    if (!seen.has(key)) {
      seen.set(key, true);
      cleaned.unshift(data[i]); // Keep latest
    }
  }

  // Clear and rewrite sheet
  const all = [headers, ...cleaned];
  sheet.clearContents();
  sheet.getRange(1, 1, all.length, all[0].length).setValues(all);
}


// 13. Create sheet if it doesn’t exist
function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}
