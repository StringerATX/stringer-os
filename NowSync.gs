// ============================================================
// STRINGER OS - "Now" list sync to Google Tasks
// ============================================================
// Lives in its OWN standalone Apps Script project ("Stringer OS Now Sync"),
// NOT in the web app's Code.gs. The Tasks service adds an OAuth scope, and a new
// scope in the web app project would force a re-authorization of the live exec
// URL. Keeping it separate means the app itself is never touched.
//
// What it does: every 5 minutes it reads TASKS from the sheet, picks Mac's top
// items for today, and rewrites the Google Tasks list "Now" to match. The free
// Google Tasks home-screen widget on Mac's phone shows that list.
//
// Order:
//   1. Open tasks starred for today (Today column == today), any assignee,
//      by priority.
//   2. Then Mac's open work (AssignedTo Mac or blank), by priority. Same rule
//      as the Work block on the MAC tab.
//   Capped at 10. One-way only: the sheet drives the list. A box ticked in the
//   widget is cleared on the next run.
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
  var want = pickNow_();
  var listId = nowListId_();
  var have = (Tasks.Tasks.list(listId, {showCompleted: true, showHidden: true, maxResults: 100}).items) || [];

  // Skip the rewrite when nothing changed, so the widget does not flicker.
  var haveOpen = have.filter(function(t) { return t.status !== 'completed'; })
                     .sort(function(a, b) { return String(a.position).localeCompare(String(b.position)); })
                     .map(function(t) { return t.title; });
  var same = have.length === want.length && haveOpen.join('\n') === want.map(function(w) { return w.title; }).join('\n');
  if (same) return;

  have.forEach(function(t) { Tasks.Tasks.remove(listId, t.id); });
  // A new task with no "previous" lands at the top, so insert bottom-up.
  for (var i = want.length - 1; i >= 0; i--) {
    Tasks.Tasks.insert({title: want[i].title, notes: want[i].notes}, listId);
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
