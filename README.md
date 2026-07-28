# Coaching — Pre-Session Survey

Branded pre-session survey for AI coaching clients. Static HTML (hosted via
GitHub Pages) that posts answers via webhook to a Google Apps Script, which
stores each submission as a response in a private Google Form.

```
client's browser ──POST (JSON)──▶ Apps Script doPost ──▶ Google Form responses
        ▲                                                        │
  GitHub Pages (index.html)                              optional linked Sheet
```

**No answers are ever stored in this repository.** The page is a shell;
submissions go straight to the private Google Form backend.

## Files

| File | What it is |
|---|---|
| `index.html` | The survey. Self-contained, brand tokens inlined, conditional logic in vanilla JS. |
| `apps-script/Code.gs` | Creates the Google Form (`setupForm`) **and** serves the webhook (`doPost`). Runs in the owner's Google account, not here. |

## Setup — one time, ~5 minutes

1. **Create the Apps Script project.** Go to [script.google.com](https://script.google.com)
   → **New project**. Delete the stub code, paste in the full contents of
   [`apps-script/Code.gs`](apps-script/Code.gs), save.

2. **Create the Form.** In the editor's function dropdown select **`setupForm`** → **Run**.
   Approve the authorization prompt. The log prints the Form's edit URL and
   stores the Form ID for the webhook.

3. **Deploy the webhook.** **Deploy → New deployment → Web app.**
   - Execute as: **Me**
   - Who has access: **Anyone**  ← required, otherwise respondents hit a login wall
   - Deploy, then copy the **Web app URL** (ends in `/exec`).

4. **Wire up the front end.** In `index.html`, set
   ```js
   const WEBHOOK_URL = "https://script.google.com/macros/s/…/exec";
   ```
   Commit and push.

5. **Enable GitHub Pages.** **Settings → Pages** → Deploy from a branch →
   `main`, `/ (root)`. The survey goes live at
   `https://mareikejens.github.io/coaching/`.

6. **Test end to end.** Open the Pages URL, submit a test run (name it "Test"),
   check it lands in the Form's Responses tab.

## Reading responses

Form → **Responses** tab, or link a Google Sheet from there. Every submission
also carries a `Raw submission (JSON)` safety-net field — if a field ever fails
to map, nothing is lost.

## Design notes

- Conditional logic lives in the front end; hidden questions are simply omitted
  from the payload.
- The POST uses `Content-Type: text/plain` to stay a CORS "simple request"
  (Apps Script web apps can't answer preflights).
- If the webhook is unreachable, the page shows the full payload for the
  respondent to copy-paste into an email — no answer is lost.
