/**
 * Pre-Session Survey — Google Form backend.
 *
 * One file, two jobs:
 *   1. setupForm()  — run ONCE by hand: creates the Google Form with all
 *                     questions and stores its ID in Script Properties.
 *   2. doPost(e)    — the webhook: receives the JSON payload from
 *                     index.html and submits it as a real Form response,
 *                     so answers show up in the Form's "Responses" tab
 *                     (and its linked Sheet, if you connect one).
 *
 * Deploy steps live in ../README.md.
 */

var FORM_TITLE = 'AI Coaching — Pre-Session Survey (Mareike Jens)';

/**
 * Question spec. Single source of truth for BOTH form creation and
 * webhook mapping. `key` must match the payload keys sent by index.html.
 * Conditional questions (q4a, q4b, q13) exist as non-required items here —
 * the HTML front end owns the show/hide logic and simply omits them
 * from the payload when hidden.
 */
var QUESTIONS = [
  { key: 'name', title: '00 · Your name', type: 'text', required: true },

  { key: 'q1', title: '01 · Which tools are you currently using, even occasionally?', type: 'checkbox', required: true,
    choices: ['Claude', 'ChatGPT', 'Slack', 'Google Drive', 'Sana', 'Ashby'], other: true },

  { key: 'q2', title: "02 · For Claude — what's your access?", type: 'mc', required: true,
    choices: ['Shared team account', 'Personal free account', 'Personal Pro plan', 'Personal Max plan', 'Not sure'] },

  { key: 'q3', title: '03 · Which Claude surfaces and features have you used?', type: 'checkbox', required: true,
    choices: ['Claude.ai chat in the browser', 'Claude desktop app', 'Claude mobile app', 'Claude Code',
              'Claude Cowork', 'Claude in Chrome (browser extension)', 'Claude for Excel / Microsoft Office',
              'Claude Design', 'Projects (shared workspaces with knowledge)', 'Skills (reusable custom workflows)',
              'Connectors / integrations (Gmail, Drive, Calendar...)', 'None of these beyond basic chat'],
    other: true },

  { key: 'q4a', title: '04a · [If Claude Code] What have you built or tried with it?', type: 'paragraph' },

  { key: 'q4b', title: '04b · [If Claude Code] Do you have a GitHub account?', type: 'mc',
    choices: ['Yes', 'No'] },

  { key: 'q5', title: '05 · Do you use any automation platforms?', type: 'checkbox', required: true,
    choices: ['n8n', 'Make.com', 'Zapier', 'IFTTT', 'None'], other: true },

  { key: 'q6', title: '06 · What laptop are you working on?', type: 'mc', required: true,
    choices: ['Mac', 'Windows'], other: true },

  { key: 'q7', title: "07 · What's an AI use case you're already using? When did you last use it, and which business problem does it solve for you?", type: 'paragraph', required: true },

  { key: 'q8', title: '08 · Show me the real thing: prompt(s), chat share link, or full conversation', type: 'paragraph', required: true },

  { key: 'q9', title: "09 · What have you tried that didn't work? What got in the way?", type: 'paragraph' },

  { key: 'q10', title: '10 · How are you currently handling sensitive data when AI is involved?', type: 'paragraph', required: true },

  { key: 'q11', title: '11 · Which recurring tasks eat the most time right now — and which are repetitive (same steps every time)?', type: 'paragraph', required: true },

  { key: 'q12', title: '12 · How well do you understand how models like Claude work under the hood?', type: 'mc', required: true,
    choices: ['I have a solid mental model', "I know the basics but it's fuzzy", "Honestly, it's a black box to me"] },

  { key: 'q13', title: '13 · [If fuzzy / black box] Should the technical fundamentals be part of our coaching?', type: 'mc',
    choices: ['Yes - dedicated time on this', 'A little context along the way is enough', 'Skip the theory - I just want to use the tools'] },

  { key: 'q14', title: '14 · If you got only ONE thing out of this coaching series, what would it be?', type: 'text', required: true },

  { key: 'q15', title: '15 · HOMEWORK: The one use case we build together in session 1 (+ the real example you will bring)', type: 'paragraph', required: true },
];

var RAW_ITEM_TITLE = 'Raw submission (JSON, auto-filled — ignore)';

/**
 * Run this once from the Apps Script editor (select `setupForm`, hit Run).
 * Creates the Form, stores its ID, and logs both URLs.
 */
function setupForm() {
  var form = FormApp.create(FORM_TITLE);
  form.setDescription(
    'Backend store for the branded survey at the GitHub Pages URL. ' +
    'Responses arrive via webhook (Apps Script doPost) — this form is not filled out directly.'
  );

  QUESTIONS.forEach(function (q) {
    var item;
    switch (q.type) {
      case 'text':
        item = form.addTextItem();
        break;
      case 'paragraph':
        item = form.addParagraphTextItem();
        break;
      case 'mc':
        item = form.addMultipleChoiceItem();
        item.setChoiceValues(q.choices);
        if (q.other) item.showOtherOption(true);
        break;
      case 'checkbox':
        item = form.addCheckboxItem();
        item.setChoiceValues(q.choices);
        if (q.other) item.showOtherOption(true);
        break;
    }
    item.setTitle(q.title);
    // Required is NOT enforced form-side: the webhook submits programmatically
    // and conditional questions are legitimately absent. The HTML enforces it.
  });

  // Safety net: full payload always lands here, even if an item mapping fails.
  form.addParagraphTextItem().setTitle(RAW_ITEM_TITLE);

  PropertiesService.getScriptProperties().setProperty('FORM_ID', form.getId());

  Logger.log('Form created.');
  Logger.log('Edit / view responses: ' + form.getEditUrl());
  Logger.log('Form ID stored in Script Properties.');
}

/**
 * Webhook endpoint. index.html POSTs:
 *   { submittedAt: "...", answers: { name: "...", q1: [...], q2: "...", ... } }
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var answers = payload.answers || {};

    var formId = PropertiesService.getScriptProperties().getProperty('FORM_ID');
    if (!formId) throw new Error('FORM_ID not set — run setupForm() first.');
    var form = FormApp.openById(formId);

    var itemsByTitle = {};
    form.getItems().forEach(function (item) { itemsByTitle[item.getTitle()] = item; });

    var response = form.createResponse();
    var mappingErrors = [];

    QUESTIONS.forEach(function (q) {
      var value = answers[q.key];
      if (value === undefined || value === null || value === '') return;
      var item = itemsByTitle[q.title];
      if (!item) { mappingErrors.push(q.key + ': item not found'); return; }
      try {
        var itemResponse;
        switch (q.type) {
          case 'text':
            itemResponse = item.asTextItem().createResponse(String(value));
            break;
          case 'paragraph':
            itemResponse = item.asParagraphTextItem().createResponse(String(value));
            break;
          case 'mc':
            itemResponse = item.asMultipleChoiceItem().createResponse(String(value));
            break;
          case 'checkbox':
            var arr = Array.isArray(value) ? value.map(String) : [String(value)];
            itemResponse = item.asCheckboxItem().createResponse(arr);
            break;
        }
        response.withItemResponse(itemResponse);
      } catch (err) {
        mappingErrors.push(q.key + ': ' + err.message);
      }
    });

    // Always attach the raw payload so nothing is ever lost.
    var rawItem = itemsByTitle[RAW_ITEM_TITLE];
    if (rawItem) {
      var raw = JSON.stringify(payload, null, 2);
      if (mappingErrors.length) raw = 'MAPPING ERRORS: ' + mappingErrors.join('; ') + '\n\n' + raw;
      response.withItemResponse(rawItem.asParagraphTextItem().createResponse(raw));
    }

    response.submit();

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, mappingErrors: mappingErrors }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/** Optional: quick end-to-end test from the editor (run after setupForm + deploy). */
function testSubmission() {
  var fake = {
    postData: {
      contents: JSON.stringify({
        submittedAt: new Date().toISOString(),
        answers: {
          name: 'Test Run',
          q1: ['Claude', 'Slack'],
          q2: 'Shared team account',
          q3: ['Claude.ai chat in the browser'],
          q5: ['None'],
          q6: 'Mac',
          q7: 'Test use case.',
          q8: 'Test prompt.',
          q10: 'Test data handling.',
          q11: 'Test tasks.',
          q12: "I know the basics but it's fuzzy",
          q13: 'A little context along the way is enough',
          q14: 'Test outcome.',
          q15: 'Test homework.',
        },
      }),
    },
  };
  Logger.log(doPost(fake).getContent());
}
