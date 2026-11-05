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

function setup() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'syncNow') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncNow').timeBased().everyMinutes(NOW.EVERY_MIN).create();
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
