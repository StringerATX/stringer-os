# Deploy: day-plan columns on MAC_PERSONAL

**Date:** 2026-11-02
**Why:** adds `Slot`, `Days`, `Active`, `LastDone` to MAC_PERSONAL so the MAC tab can
render a wake-relative day plan. Without this, `savePersonalItems` would blank those
four columns on every checkbox tap, because it clears the tab and rewrites 5 columns.

**Do NOT paste the whole `Code_final.gs`.** That would mean restoring 4 tokens and 4
emails by hand. These are three surgical edits. None of them go near the tokens.

Open the sheet, Extensions > Apps Script, open `Code.gs`, and make the three edits
below. Use Ctrl+F to find each FIND block.

---

## Edit 1 of 3 — in `getAppData_`

### FIND (3 lines, inside `if (user.role !== 'work') {`)

```js
    personal = readTab_(ss, 'MAC_PERSONAL').map(function(r) {
      return { id: String(r.ID), description: String(r.Description), done: String(r.Done).toUpperCase() === 'TRUE', category: String(r.Category || 'daily'), createdAt: String(r.CreatedAt || '') };
    });
```

### REPLACE WITH

```js
    personal = readTab_(ss, 'MAC_PERSONAL').map(function(r) {
      // Slot/Days/Active/LastDone drive the wake-relative day plan. They live
      // only in the sheet - the app reads them and only writes LastDone.
      // Active defaults TRUE when blank so existing rows never silently vanish.
      return { id: String(r.ID), description: String(r.Description), done: String(r.Done).toUpperCase() === 'TRUE',
               category: String(r.Category || 'daily'), createdAt: String(r.CreatedAt || ''),
               slot: plainCell_(r.Slot), days: plainCell_(r.Days),
               active: String(r.Active === undefined || r.Active === null || r.Active === '' ? 'TRUE' : r.Active).toUpperCase() !== 'FALSE',
               lastDone: plainCell_(r.LastDone) };
    });
```

---

## Edit 2 of 3 — inside `savePersonalItems`

### FIND (starts right after the `tryLock` line)

```js
    var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('MAC_PERSONAL');
    // Dedupe by id, last write wins - defence in depth against a bad payload.
    var seen = {}, clean = [];
    items.forEach(function(i) {
      if (!i || !i.id) return;
      var key = String(i.id);
      if (seen[key] === undefined) { seen[key] = clean.length; clean.push(i); }
      else { clean[seen[key]] = i; }
    });
    var rows = [['ID','Description','Done','Category','CreatedAt']];
    clean.forEach(function(i) {
      rows.push([i.id, i.description, i.done ? 'TRUE' : 'FALSE', i.category||'daily', i.createdAt||today_()]);
    });
    sheet.clearContents();
    sheet.getRange(1, 1, rows.length, 5).setValues(rows);
    SpreadsheetApp.flush();
    return {success:true, rows: clean.length};
```

### REPLACE WITH

```js
    var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('MAC_PERSONAL');
    // Columns 6-9 (Slot, Days, Active, LastDone) are the day plan. This function
    // clears the whole tab and rewrites it, and the app does not send those four
    // on an ordinary checkbox tap - so read them first and carry them through,
    // or one tap would blank the entire plan. Payload wins when it supplies a
    // value, which is how the app writes LastDone.
    var prev = {}, cur = sheet.getDataRange().getValues();
    for (var r = 1; r < cur.length; r++) {
      var k = String(cur[r][0]).trim();
      if (k) prev[k] = { slot: cur[r][5], days: cur[r][6], active: cur[r][7], lastDone: cur[r][8] };
    }
    // Dedupe by id, last write wins - defence in depth against a bad payload.
    var seen = {}, clean = [];
    items.forEach(function(i) {
      if (!i || !i.id) return;
      var key = String(i.id);
      if (seen[key] === undefined) { seen[key] = clean.length; clean.push(i); }
      else { clean[seen[key]] = i; }
    });
    var rows = [['ID','Description','Done','Category','CreatedAt','Slot','Days','Active','LastDone']];
    clean.forEach(function(i) {
      var p = prev[String(i.id)] || {};
      rows.push([i.id, i.description, i.done ? 'TRUE' : 'FALSE', i.category||'daily', i.createdAt||today_(),
                 plainCell_(keep_(i.slot, p.slot)),
                 plainCell_(keep_(i.days, p.days)),
                 activeCell_(keep_(i.active, p.active)),
                 plainCell_(keep_(i.lastDone, p.lastDone))]);
    });
    sheet.clearContents();
    // Plain-text format on the plan columns so Sheets cannot turn a slot number
    // or a LastDone date into something else, same reason SCHEDULE uses '@'.
    sheet.getRange(1, 6, Math.max(rows.length, 2), 4).setNumberFormat('@');
    sheet.getRange(1, 1, rows.length, 9).setValues(rows);
    SpreadsheetApp.flush();
    return {success:true, rows: clean.length};
```

---

## Edit 3 of 3 — three new helper functions

### FIND

```js
// ─── HELPERS ─────────────────────────────────────────────────
function readTab_(ss, name) {
```

### REPLACE WITH

```js
// ─── HELPERS ─────────────────────────────────────────────────
// Sheets hands back a Date object for anything it decided was a date, which is
// why these exist: the day plan must survive a round trip as plain strings.
function plainCell_(v) {
  if (v === undefined || v === null) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v).trim();
}
// Payload value wins; fall back to what the sheet already held. Boolean false
// and the number 0 are real values and must not fall through.
function keep_(a, b) {
  if (a === undefined || a === null || a === '') return (b === undefined || b === null) ? '' : b;
  return a;
}
function activeCell_(v) {
  if (v === undefined || v === null || v === '') return 'TRUE';
  return String(v).toUpperCase() === 'FALSE' || v === false ? 'FALSE' : 'TRUE';
}

function readTab_(ss, name) {
```

---

## Then deploy

1. **Save** (the disk icon, or Ctrl+S)
2. **Deploy** > **Manage deployments**
3. Click the **pencil** on the existing deployment
4. **Version: New version**
5. **Deploy**

You MUST cut a New version. Saving alone leaves the live API running the old code.

## Then verify

Paste your app's exec URL into a browser with your token and no action on the end.
In the JSON that comes back, find the `personal` array and check that each item now
has **four new fields**: `slot`, `days`, `active`, `lastDone`. They will be empty
strings for now, and `active` will be `true`. Empty is correct at this point - the
columns do not exist in the sheet yet.

If `personal` items still show only `id`, `description`, `done`, `category` and
`createdAt`, the New version did not get cut. Go back to step 2.

Tell Hazel it is deployed and she will populate the columns.

## Why it is safe to deploy before the columns exist

`plainCell_` returns an empty string for a missing cell and `activeCell_` defaults to
`TRUE`, so reading a 5-column sheet with 9-column code is fine. The first
`savePersonalItems` call after this writes the 9-column header and the empty
columns, which is the migration. Nothing is lost either way.

## Tested before shipping

Ran against stubbed Apps Script objects in node:
- A 5-field payload (what a checkbox tap actually sends) preserved Slot, Days and
  Active on all four test rows
- `Active=FALSE` stayed FALSE, so an inactive item cannot silently turn back on
- A payload that supplies `lastDone` wins over the sheet value, and Slot still
  carried through on the same row
- The `@` text format lands on columns 6-9
