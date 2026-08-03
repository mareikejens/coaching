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
   **Always test twice: once normally, and once in a private/incognito window
   where you are NOT signed in to Google.** With "Who has access" set to
   anything stricter than **Anyone**, submissions from signed-in users (you)
   succeed while submissions from everyone else silently die on a Google
   login page — the exact failure this repo has already been bitten by.

## Updating the webhook code (after changing Code.gs)

Pasting new code into the editor is not enough — the live `/exec` URL keeps
running the old version until you bump the deployment:

1. Paste the new `Code.gs` contents over the old ones, save.
2. **Deploy → Manage deployments → ✎ (edit) → Version: New version → Deploy.**
   The `/exec` URL stays the same; no front-end change needed.
3. Confirm **Who has access: Anyone** while you're in that dialog.
4. Re-authorize when prompted — the failure-safety-net code needs the
   "send email as you" and Drive scopes the old version didn't use.
5. Re-run the end-to-end test, including the incognito variant above.

## Reading responses

Form → **Responses** tab, or link a Google Sheet from there. Every submission
also carries a `Raw submission (JSON)` safety-net field — if a field ever fails
to map, nothing is lost.

## Design notes

- Conditional logic lives in the front end; hidden questions are simply omitted
  from the payload.
- **Numbering convention (house rule for all surveys):** conditional follow-ups
  take the parent's number plus a letter suffix (04a, 12a), never their own
  integer, so the visible numbering never skips when a follow-up stays hidden.
- After changing questions, re-run `setupForm()` (creates a fresh form,
  re-stores its ID) and bump the web-app deployment to a new version so
  `doPost` runs the updated code. The `/exec` URL stays the same.
- The POST uses `Content-Type: text/plain` to stay a CORS "simple request"
  (Apps Script web apps can't answer preflights).
- If the webhook is unreachable, the page shows the full payload for the
  respondent to copy-paste into an email — no answer is lost.
- **Success is only trusted when the webhook itself replies `{ok:true}`.**
  An HTTP 200 alone proves nothing: Apps Script answers 200 even when
  `doPost` throws, and a Google login page is also a 200. The iframe
  fallback can't read Google's reply at all, so after a fallback submit the
  success panel additionally shows the answers and asks the respondent to
  email a copy.
- Every submit attempt is also written to the respondent's `localStorage`
  (keys starting `mj-survey-backup-`), recoverable via DevTools →
  Application → Local Storage even after the tab is closed.
- Server-side, `doPost` never discards a payload: a successful Form write
  emails a copy to the owner; a failed one emails the raw payload AND drops
  it as a `survey-failed-submission-*.json` file in Drive.
