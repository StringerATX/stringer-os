// ============================================================
// STRINGER OS - "Now" list sync to Google Tasks
// ============================================================
// Lives in its OWN standalone Apps Script project ("Stringer OS Now Sync"),
// NOT in the web app's Code.gs. The Tasks service adds an OAuth scope, and a new
// scope in the web app project would force a re-authorization of the live exec
// URL. Keeping it separate means the app itself is never touched.
//
// What it does, every 5 minutes:
//   1. Anything Mac checked off in the "Now" list on his phone gets marked DONE
//      in TASKS, with CompletedAt stamped, same as tapping DONE in the app.
//   2. Reads TASKS, picks Mac's top items for today, and rewrites "Now" to match.
//      The free Google Tasks home-screen widget shows that list.
//
// Order:
//   1. Open tasks starred for today (Today column == today), any assignee,
//      by priority.
//   2. Then Mac's open work (AssignedTo Mac or blank), by priority. Same rule
//      as the Work block on the MAC tab.
//   Capped at 10.
//
// The link between a Google Task and its TASKS row is kept in Script Properties
// (key "map", googleTaskId -> sheet ID), rebuilt every time the list is rewritten.
//
// Setup (once): Services + add "Google Tasks API" (identifier Tasks), paste this
// file, run setup(), approve the prompt. setup() makes the trigger and runs the
// first sync.

var NOW = {
  SHEET_ID: '1JoUPnPHXrhj6D5XEy86vdw6iuvopk7XlDq-c9wXaNhs',
  LIST_NAME: 'Now',
  MAX: 10,
  TZ: 'America/Chicago',
  EVERY_MIN: 5
};

// Safe to re-run. It clears its own triggers first, so running it again after a
// paste updates the schedule instead of stacking a second copy of it.
function setup() {
  ['pullInbox', 'syncNow'].forEach(function(fn) {
    ScriptApp.getProjectTriggers().forEach(function(t) {
      if (t.getHandlerFunction() === fn) ScriptApp.deleteTrigger(t);
    });
    ScriptApp.newTrigger(fn).timeBased().everyMinutes(NOW.EVERY_MIN).create();
  });
  pullInbox();
  syncNow();
}

function syncNow() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var map = JSON.parse(props.getProperty('map') || '{}');
    var listId = nowListId_();
    var have = (Tasks.Tasks.list(listId, {showCompleted: true, showHidden: true, maxResults: 100}).items) || [];

    // 1. Ticked on the phone -> DONE in the sheet.
    var ticked = have.filter(function(t) { return t.status === 'completed' && map[t.id]; })
                     .map(function(t) { return map[t.id]; });
    if (ticked.length) markDone_(ticked);

    // 2. Rebuild the list. Skip when nothing changed, so the widget does not flicker.
    var want = pickNow_();
    var haveOpen = have.filter(function(t) { return t.status !== 'completed'; })
                       .sort(function(a, b) { return String(a.position).localeCompare(String(b.position)); })
                       .map(function(t) { return t.title; });
    var same = !ticked.length && have.length === want.length &&
               haveOpen.join('\n') === want.map(function(w) { return w.title; }).join('\n');
    if (same) return;

    have.forEach(function(t) { Tasks.Tasks.remove(listId, t.id); });
    var newMap = {};
    // A new task with no "previous" lands at the top, so insert bottom-up.
    for (var i = want.length - 1; i >= 0; i--) {
      var made = Tasks.Tasks.insert({title: want[i].title, notes: want[i].notes}, listId);
      newMap[made.id] = want[i].id;
    }
    props.setProperty('map', JSON.stringify(newMap));
  } finally {
    lock.releaseLock();
  }
}

// Same writes as updateTaskStatus(id, 'DONE') in Code.gs: Status to DONE, and
// CompletedAt stamped as plain text if it is empty. Columns found by header.
function markDone_(ids) {
  var sheet = SpreadsheetApp.openById(NOW.SHEET_ID).getSheetByName('TASKS');
  var v = sheet.getDataRange().getValues();
  var iId = v[0].indexOf('ID'), iStat = v[0].indexOf('Status'), iDone = v[0].indexOf('CompletedAt');
  if (iDone < 0) { iDone = v[0].length; sheet.getRange(1, iDone + 1).setValue('CompletedAt'); }
  var today = Utilities.formatDate(new Date(), NOW.TZ, 'yyyy-MM-dd');
  var want = {};
  ids.forEach(function(id) { want[String(id)] = true; });
  for (var r = 1; r < v.length; r++) {
    if (!want[String(v[r][iId])]) continue;
    if (String(v[r][iStat]) === 'DONE') continue;
    sheet.getRange(r + 1, iStat + 1).setValue('DONE');
    if (!v[r][iDone]) sheet.getRange(r + 1, iDone + 1).setNumberFormat('@').setValue(today);
  }
}

function pickNow_() {
  var ss = SpreadsheetApp.openById(NOW.SHEET_ID);
  var v = ss.getSheetByName('TASKS').getDataRange().getValues();
  var h = v[0];
  var c = function(name) { return h.indexOf(name); };
  var iId = c('ID'), iProj = c('Project'), iDesc = c('Description'), iWho = c('AssignedTo'),
      iPri = c('Priority'), iStat = c('Status'), iToday = c('Today');
  var today = Utilities.formatDate(new Date(), NOW.TZ, 'yyyy-MM-dd');
  var PO = {HIGH: 0, MEDIUM: 1, LOW: 2};

  var names = {};
  var pv = ss.getSheetByName('PROJECTS').getDataRange().getValues();
  var pId = pv[0].indexOf('ID'), pName = pv[0].indexOf('Name');
  for (var p = 1; p < pv.length; p++) names[String(pv[p][pId])] = String(pv[p][pName]);

  var rows = [];
  for (var r = 1; r < v.length; r++) {
    var row = v[r];
    if (!String(row[iId]).trim()) continue;
    if (String(row[iStat]) === 'DONE') continue;
    var t = row[iToday];
    if (Object.prototype.toString.call(t) === '[object Date]') t = Utilities.formatDate(t, NOW.TZ, 'yyyy-MM-dd');
    var who = String(row[iWho] || '').trim();
    rows.push({
      id: String(row[iId]),
      order: r,
      flagged: iToday >= 0 && String(t).trim() === today,
      mine: who === 'Mac' || who === '',
      pri: PO[String(row[iPri])] === undefined ? 3 : PO[String(row[iPri])],
      title: String(row[iDesc] || '').trim(),
      notes: names[String(row[iProj])] || String(row[iProj] || '')
    });
  }
  var byPri = function(a, b) { return a.pri - b.pri || a.order - b.order; };
  var flagged = rows.filter(function(x) { return x.flagged; }).sort(byPri);
  var rest = rows.filter(function(x) { return !x.flagged && x.mine; }).sort(byPri);
  return flagged.concat(rest).filter(function(x) { return x.title; }).slice(0, NOW.MAX);
}

function nowListId_() {
  var lists = (Tasks.Tasklists.list({maxResults: 100}).items) || [];
  for (var i = 0; i < lists.length; i++) if (lists[i].title === NOW.LIST_NAME) return lists[i].id;
  return Tasks.Tasklists.insert({title: NOW.LIST_NAME}).id;
}

// ============================================================
// CAPTURE PULL - Google Tasks -> VOICE_INBOX
// ============================================================
// The missing half of the Inbox. Triage has worked since August but nothing
// ever fed it: addVoiceEntry in the web app stamps Source=App, meaning typed
// in by hand. This pulls anything captured by voice into VOICE_INBOX as
// PENDING, so it shows up on the INBOX tab to be routed.
//
// Every 5 minutes:
//   1. Reads every Google Tasks list EXCEPT the ones this project owns.
//   2. Appends each new open task to VOICE_INBOX, Status PENDING, Source Voice.
//   3. Marks that Google Task completed, so it drops out of the Tasks view and
//      cannot be pulled a second time.
//
// Why every list and not just the default one: which list "OK Google, add a
// task to ..." lands in depends on how the sentence comes out. Reading them
// all means a capture cannot sit stranded in a list nothing was watching.
//
// THE ONE LIST IT MUST NOT READ IS "Now". syncNow() wipes and rewrites that
// list every 5 minutes, so anything captured into it has about five minutes to
// live. It is skipped by id AND by title below. Do not collapse that to one
// check. If any other list is ever handed to a script, add it to CAP.SKIP.

var CAP = {
  SKIP: [NOW.LIST_NAME],   // lists this project writes - never pull from these
  MAX: 25,                 // per run, so a long list cannot time the trigger out
  SOURCE: 'Voice',
  TAB: 'VOICE_INBOX',
  REMEMBER: 100            // ids kept to block a re-pull; Script Properties cap 9KB
};

function pullInbox() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return;
  try {
    var props = PropertiesService.getScriptProperties();
    var pulled = JSON.parse(props.getProperty('pulled') || '[]');
    var seen = {};
    pulled.forEach(function(id) { seen[id] = 1; });

    var lists = (Tasks.Tasklists.list({maxResults: 100}).items) || [];
    var skipIds = {};
    lists.forEach(function(l) {
      if (CAP.SKIP.indexOf(l.title) >= 0) skipIds[l.id] = 1;
    });

    var rows = [], took = [];
    for (var i = 0; i < lists.length && rows.length < CAP.MAX; i++) {
      var l = lists[i];
      if (skipIds[l.id]) continue;                     // by id
      if (CAP.SKIP.indexOf(l.title) >= 0) continue;    // and by title
      var items = (Tasks.Tasks.list(l.id, {showCompleted: false, maxResults: 100}).items) || [];
      for (var j = 0; j < items.length && rows.length < CAP.MAX; j++) {
        var t = items[j];
        if (seen[t.id]) continue;              // completing it failed last run
        var raw = String(t.title || '').trim();
        if (!raw) continue;                    // Tasks allows an empty title
        var note = String(t.notes || '').trim();
        if (note) raw += ' - ' + note;
        rows.push(raw);
        took.push({list: l.id, task: t.id});
      }
    }
    if (!rows.length) return;

    // Sheet FIRST. If the append throws, nothing has been marked complete and
    // the next run picks the same items up again. The other order would drop a
    // capture on the floor, which is the one outcome that makes him stop
    // trusting it.
    appendInbox_(rows);

    took.forEach(function(d) {
      try {
        Tasks.Tasks.patch({status: 'completed'}, d.list, d.task);
      } catch (e) {
        // Left open on purpose. The id below keeps it from being pulled twice.
      }
      pulled.push(d.task);
    });
    props.setProperty('pulled', JSON.stringify(pulled.slice(-CAP.REMEMBER)));
  } finally {
    lock.releaseLock();
  }
}

// Columns are found by header, not by index, so an inserted column in
// VOICE_INBOX cannot silently write the wrong cell. One setValues for the whole
// block, for the same reason savePersonalItems had to stop using appendRow: two
// scripts appending a row at a time interleave and corrupt the tab.
function appendInbox_(rows) {
  var sheet = SpreadsheetApp.openById(NOW.SHEET_ID).getSheetByName(CAP.TAB);
  var header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
                    .map(function(x) { return String(x); });
  var stamp = Utilities.formatDate(new Date(), NOW.TZ, 'yyyy-MM-dd HH:mm');
  var fill = function(key, raw) {
    if (key === 'ID') return Utilities.getUuid();
    if (key === 'Raw') return raw;
    if (key === 'Source') return CAP.SOURCE;
    if (key === 'CreatedAt') return stamp;
    if (key === 'Status') return 'PENDING';
    return '';
  };
  var block = rows.map(function(raw) {
    return header.map(function(k) { return fill(k, raw); });
  });
  var at = sheet.getLastRow() + 1;
  // Plain text on CreatedAt so Sheets does not turn the stamp into a Date.
  var iDate = header.indexOf('CreatedAt');
  if (iDate >= 0) sheet.getRange(at, iDate + 1, block.length, 1).setNumberFormat('@');
  sheet.getRange(at, 1, block.length, header.length).setValues(block);
}
