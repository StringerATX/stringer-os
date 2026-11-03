// ============================================================
// STRINGER OS — Code.gs (Final + Schedule)
// ============================================================

var CONFIG = {
  SHEET_ID: '1JoUPnPHXrhj6D5XEy86vdw6iuvopk7XlDq-c9wXaNhs',
};

var TOKENS = {
  'REDACTED_OWNER_TOKEN':       { name: 'Mac',      role: 'owner' },
  'REDACTED_CREW_TOKEN_1': { name: 'Christian', role: 'crew'  },
  'REDACTED_CREW_TOKEN_2':  { name: 'Mitchell',  role: 'crew'  },
  'REDACTED_WORK_TOKEN':     { name: 'Tracy',     role: 'work'  },
};

var TRADES = [
  'Administrative','Carpentry','City of Austin','Concrete','Drywall',
  'Electric','Flooring','Framing','General','HVAC','Inspections','Lighting',
  'Painting','Plumbing','Questions','Roofing','Tile','Wallpaper'
];

// ─── ENTRY POINT ─────────────────────────────────────────────
function doGet(e) {
  var token  = (e && e.parameter && e.parameter.t)      ? e.parameter.t      : '';
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  var user   = TOKENS[token];

  if (user) {
    var output;
    try {
      var result;
      if (!action) {
        result = getAppData_(user);
      } else {
        result = handleAction_(action, e.parameter, user);
      }
      output = ContentService.createTextOutput(JSON.stringify(result));
    } catch(err) {
      output = ContentService.createTextOutput(JSON.stringify({error: err.message}));
    }
    output.setMimeType(ContentService.MimeType.JSON);
    return output;
  }

  var tmpl = HtmlService.createTemplateFromFile('index');
  try {
    var sessionUser = getSessionUser_();
    tmpl.data = sessionUser
      ? JSON.stringify(getAppData_(sessionUser))
      : JSON.stringify({error:'unauthorized', email: Session.getActiveUser().getEmail()});
  } catch(err) {
    tmpl.data = JSON.stringify({error: err.message});
  }
  return tmpl.evaluate()
    .setTitle('Stringer OS')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .addMetaTag('viewport','width=device-width, initial-scale=1, minimum-scale=1');
}

// ─── ACTION ROUTER ───────────────────────────────────────────
function handleAction_(action, p, user) {
  if (action === 'updateTaskStatus')     return updateTaskStatus(p.id, p.status);
  if (action === 'updateTaskPriority')   return updateTaskPriority(p.id, p.priority);
  if (action === 'updateTaskToday')      return updateTaskToday(p.id, p.on);
  if (action === 'toggleShoppingStatus') return toggleShoppingStatus(p.id);
  if (action === 'updateTaskNotes')      return updateTaskNotes(p.id, p.notes);
  if (action === 'updateTaskDescription') return updateTaskDescription(p.id, p.description);
  if (action === 'deleteTask')           return deleteTask(p.id, p.reason || '');
  if (action === 'archiveDoneTasks')     return archiveDoneTasks(p.days, user);
  if (action === 'restoreTask')          return restoreTask(p.id);
  if (action === 'updateScheduleEntry')  return updateScheduleEntry(p.id, { date: p.date, person: p.person, startTime: p.startTime, endTime: p.endTime, location: p.location, project: p.project, notes: p.notes, status: p.status });
  if (action === 'addScheduleEntry')     return addScheduleEntry({ date: p.date, person: p.person, startTime: p.startTime, endTime: p.endTime, location: p.location, project: p.project, notes: p.notes });
  if (action === 'deleteScheduleEntry')  return deleteScheduleEntry(p.id, p.reason || '');
  if (action === 'addTask')              return addTask({ project: p.project, trade: p.trade, description: p.description, assignedTo: p.assignedTo, priority: p.priority, actionItem: p.actionItem||'', source: p.source||'App' });
  if (action === 'addShoppingItem')      return addShoppingItem({ project: p.project, trade: p.trade, material: p.material, qty: p.qty, unitCost: p.unitCost, vendor: p.vendor, source: p.source||'App' });
  if (action === 'savePersonalItems')    return savePersonalItems(JSON.parse(p.items || '[]'));
  if (action === 'saveIdeas')            return saveIdeas(JSON.parse(p.ideas || '[]'));
  if (action === 'addPerson')            return addPerson({ name: p.name, role: p.role, email: p.email, phone: p.phone, note: p.note, type: p.type });
  if (action === 'updateLastContact')    return updateLastContact(p.id, p.note, p.nextAction);
  if (action === 'updatePersonType')     return updatePersonType(p.id, p.type, p.role);
  if (action === 'updateTaskAssignee')   return updateTaskAssignee(p.id, p.assignedTo);
  if (action === 'addVoiceEntry')        return addVoiceEntry(p.raw);
  if (action === 'processVoiceEntry')    return processVoiceEntry(p.id);
  if (action === 'addProject')           return addProject({ name: p.name, status: p.status, client: p.client, location: p.location, color: p.color, budget: p.budget, permitNum: p.permitNum });
  return {error: 'Unknown action: ' + action};
}

// ─── AUTH ────────────────────────────────────────────────────
function getSessionUser_() {
  var USERS = {
    'REDACTED_OWNER_EMAIL':       { name: 'Mac',      role: 'owner' },
    'REDACTED_CREW_EMAIL_1':{ name: 'Christian', role: 'crew'  },
    'REDACTED_CREW_EMAIL_2': { name: 'Mitchell',  role: 'crew'  },
    'REDACTED_WORK_EMAIL':     { name: 'Tracy',     role: 'work'  },
  };
  var email = Session.getActiveUser().getEmail();
  var u = USERS[email];
  if (!u) return null;
  return { email: email, name: u.name, role: u.role };
}

// ─── DATA LOAD ───────────────────────────────────────────────
function getAppData_(user) {
  var ss       = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var projects = readTab_(ss, 'PROJECTS');
  var tasks    = readTab_(ss, 'TASKS');
  var shopping = readTab_(ss, 'SHOPPING');
  var schedule = readTab_(ss, 'SCHEDULE').map(normSched_);
  var people   = (user.role === 'owner') ? readTab_(ss, 'PEOPLE') : [];
  var voiceInbox = (user.role === 'owner')
    ? readTab_(ss, 'VOICE_INBOX').filter(function(v){ return v.Status === 'PENDING'; })
    : [];
  var tasksArchive = (user.role === 'owner')
    ? readTab_(ss, 'TASKS_ARCHIVE').sort(function(a, b){ return String(b.DeletedAt || '').localeCompare(String(a.DeletedAt || '')); }).slice(0, 30)
    : [];
  var personal = [], ideas = [];
  if (user.role !== 'work') {
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
    ideas = readTab_(ss, 'MAC_IDEAS').map(function(r) {
      // Body holds the full idea text and Link an optional Drive doc, so an idea
      // tile can open into something readable instead of being a bare title.
      // Both live only in the sheet - saveIdeas carries them through, because the
      // app does not send them when it archives or reorders an idea.
      return { id: String(r.ID), text: String(r.Text), category: String(r.Category || 'Film'),
               createdAt: String(r.CreatedAt || ''), body: plainCell_(r.Body), link: plainCell_(r.Link) };
    });
  }
  // Today holds a YYYY-MM-DD date, not a flag, so a task marked for today stops
  // being today tomorrow with nothing to reset and no nightly trigger to miss -
  // the same reasoning as LastDone on the rhythm rows. Normalized here because
  // Sheets hands back a Date object if the column ever loses its '@' format.
  tasks.forEach(function(t) { t.Today = plainCell_(t.Today); });
  // Per-person task view: everyone except the owner sees only their own tasks.
  // Crew also see tasks assigned to the generic "Crew". Tracy (work) sees only her own.
  if (user.role !== 'owner') {
    tasks = tasks.filter(function(t){
      return t.AssignedTo === user.name || (user.role === 'crew' && t.AssignedTo === 'Crew');
    });
  }
  return { user: user, projects: projects, tasks: tasks, shopping: shopping, schedule: schedule, personal: personal, ideas: ideas, people: people, voiceInbox: voiceInbox, tasksArchive: tasksArchive, trades: TRADES };
}

// Normalize schedule row: Sheets may auto-convert dates/times to Date objects
function normSched_(r) {
  function dstr(v) {
    if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    return String(v || '');
  }
  function tstr(v) {
    if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, Session.getScriptTimeZone(), 'h:mm a');
    return String(v || '');
  }
  return {
    ID: String(r.ID), Date: dstr(r.Date), Person: String(r.Person || ''),
    StartTime: tstr(r.StartTime), EndTime: tstr(r.EndTime),
    Location: String(r.Location || ''), Project: String(r.Project || ''),
    Notes: String(r.Notes || ''), Status: String(r.Status || 'PLANNED')
  };
}

// ─── SCHEDULE ────────────────────────────────────────────────
// f: { date, person, startTime, endTime, location, project, notes, status }
// SCHEDULE cols: 1 ID, 2 Date, 3 Person, 4 StartTime, 5 EndTime, 6 Location, 7 Project, 8 Notes, 9 Status
function updateScheduleEntry(id, f) {
  f = f || {};
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('SCHEDULE');
  var v = sheet.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      sheet.getRange(i+1, 1, 1, 9).setNumberFormat('@'); // keep dates/times as plain text
      function has(x){ return x !== undefined && x !== null; }
      if (has(f.date)      && f.date   !== '') sheet.getRange(i+1, 2).setValue(f.date);
      if (has(f.person)    && f.person !== '') sheet.getRange(i+1, 3).setValue(f.person);
      if (has(f.startTime))                    sheet.getRange(i+1, 4).setValue(f.startTime);
      if (has(f.endTime))                      sheet.getRange(i+1, 5).setValue(f.endTime);
      if (has(f.location))                     sheet.getRange(i+1, 6).setValue(f.location);
      if (has(f.project))                      sheet.getRange(i+1, 7).setValue(f.project);
      if (has(f.notes))                        sheet.getRange(i+1, 8).setValue(f.notes);
      if (has(f.status)    && f.status !== '') sheet.getRange(i+1, 9).setValue(f.status);
      return {success:true};
    }
  }
  return {error:'not found'};
}

function addScheduleEntry(s) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('SCHEDULE');
  var id = uid_();
  var row = sheet.getLastRow() + 1;
  sheet.getRange(row, 1, 1, 9).setNumberFormat('@');
  sheet.getRange(row, 1, 1, 9).setValues([[id, s.date, s.person, s.startTime||'', s.endTime||'', s.location||'', s.project||'', s.notes||'', 'PLANNED']]);
  return {success:true, id:id};
}

function deleteScheduleEntry(id, reason) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName('SCHEDULE');
  var v = sheet.getDataRange().getValues();
  var header = v[0];
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      archiveRow_(ss, 'SCHEDULE_ARCHIVE', header, v[i], reason || '');
      sheet.deleteRow(i+1);
      return {success:true};
    }
  }
  return {error:'not found'};
}

// ─── PROJECTS ────────────────────────────────────────────────
function addProject(p) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('PROJECTS');
  var id = p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  sheet.appendRow([id, p.name, p.status||'NEW', p.client||'', p.location||'', p.color||'#2a5a8c', p.budget||'', 0, p.permitNum||'', '', '', '0%']);
  return {success:true, id:id};
}

// ─── TASKS ───────────────────────────────────────────────────
function addTask(task) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('TASKS');
  var id = uid_();
  sheet.appendRow([id, task.project, task.trade||'General', task.description, task.assignedTo, task.priority, task.status||'NEW', task.actionItem||'', task.notes||'', task.vendor||'', task.source||'App', today_()]);
  return {success:true, id:id};
}

function updateTaskStatus(id, status) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('TASKS');
  var v = sheet.getDataRange().getValues();
  // CompletedAt (added 2026-09-15): stamped when a task goes DONE, cleared when it is
  // reopened. Feeds the monthly archive sweep. Column is created on first use.
  var doneCol = v[0].indexOf('CompletedAt');
  if (doneCol < 0) { doneCol = v[0].length; sheet.getRange(1, doneCol+1).setValue('CompletedAt'); }
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      sheet.getRange(i+1, 7).setValue(status);
      if (status === 'DONE') {
        if (!v[i][doneCol]) sheet.getRange(i+1, doneCol+1).setNumberFormat('@').setValue(today_());
      } else {
        sheet.getRange(i+1, doneCol+1).setValue('');
      }
      return {success:true};
    }
  }
  return {error:'not found'};
}

// Monthly archive sweep (owner only). Moves DONE tasks whose CompletedAt is older
// than `days` (default 30) to TASKS_ARCHIVE via archiveRow_, so every field is kept
// and the row stays readable/restorable. Rows with no CompletedAt are left in place
// and counted in skippedNoDate. Nothing is hard-deleted.
//   curl -sSL -G "$EXEC" --data-urlencode t=$TOKEN --data-urlencode action=archiveDoneTasks --data-urlencode days=30
function archiveDoneTasks(days, user) {
  if (!user || user.role !== 'owner') return {error:'owner only'};
  days = parseInt(days, 10) || 30;
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName('TASKS');
  var v = sheet.getDataRange().getValues();
  var header = v[0];
  var doneCol = header.indexOf('CompletedAt');
  if (doneCol < 0) return {error:'no CompletedAt column yet'};
  var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  var moved = 0, skipped = 0;
  for (var i = v.length - 1; i >= 1; i--) { // bottom-up so deletes never shift unprocessed rows
    if (String(v[i][6]) !== 'DONE') continue;
    var stamp = v[i][doneCol];
    if (!stamp) { skipped++; continue; }
    var when = (stamp instanceof Date) ? stamp : new Date(String(stamp));
    if (isNaN(when.getTime()) || when > cutoff) continue;
    var label = (stamp instanceof Date) ? Utilities.formatDate(stamp, Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(stamp);
    archiveRow_(ss, 'TASKS_ARCHIVE', header, v[i], 'Archive sweep: DONE ' + days + '+ days (completed ' + label + ')');
    sheet.deleteRow(i+1);
    moved++;
  }
  return {success:true, moved:moved, skippedNoDate:skipped, days:days};
}


// Mark a task for today, or clear the mark. An 'on' param of anything but
// 'false', '0' or empty writes today's date into the Today column; those three
// clear it.
//
// It stores a DATE, not TRUE/FALSE, on purpose. A boolean would need something
// to come along and reset it overnight, which is exactly the trap roadmap #2
// fell into. A date simply stops matching tomorrow. Column is created on first
// use, same as CompletedAt, so this is safe to deploy before the column exists.
function updateTaskToday(id, on) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('TASKS');
  var v = sheet.getDataRange().getValues();
  var col = v[0].indexOf('Today');
  if (col < 0) { col = v[0].length; sheet.getRange(1, col+1).setValue('Today'); }
  var off = (on === false || String(on) === 'false' || String(on) === '0' || String(on) === '');
  var want = off ? '' : today_();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      sheet.getRange(i+1, col+1).setNumberFormat('@').setValue(want);
      return {success:true, today:want};
    }
  }
  return {error:'not found'};
}

// Set a task's Priority (col 6). Enum is exact-case: HIGH / MEDIUM / LOW.
function updateTaskPriority(id, priority) {
  var ok = ['HIGH','MEDIUM','LOW'];
  if (ok.indexOf(String(priority)) < 0) return {error:'bad priority: ' + priority};
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('TASKS');
  var v = sheet.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      sheet.getRange(i+1, 6).setValue(priority);
      return {success:true};
    }
  }
  return {error:'not found'};
}

function updateTaskNotes(id, notes) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('TASKS');
  var v = sheet.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      sheet.getRange(i+1, 9).setValue(notes);
      return {success:true};
    }
  }
  return {error:'not found'};
}

function updateTaskDescription(id, description) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('TASKS');
  var v = sheet.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      sheet.getRange(i+1, 4).setValue(description); // col 4 = Description
      return {success:true};
    }
  }
  return {error:'not found'};
}

// Delete a task, but archive the full row to TASKS_ARCHIVE first (with date + reason)
// so nothing is ever truly lost. Archive tabs are sheet-only; the app never reads them.
function deleteTask(id, reason) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName('TASKS');
  var v = sheet.getDataRange().getValues();
  var header = v[0];
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      archiveRow_(ss, 'TASKS_ARCHIVE', header, v[i], reason);
      sheet.deleteRow(i+1);
      return {success:true};
    }
  }
  return {error:'not found'};
}

// Restore a task from TASKS_ARCHIVE back into TASKS, then remove the archive row.
function restoreTask(id) {
  var ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var arch = ss.getSheetByName('TASKS_ARCHIVE');
  if (!arch) return {error:'no archive'};
  var av = arch.getDataRange().getValues();
  var tasks = ss.getSheetByName('TASKS');
  var taskCols = tasks.getLastColumn();
  for (var i = 1; i < av.length; i++) {
    if (String(av[i][0]) === String(id)) {
      var original = av[i].slice(0, taskCols); // drop the trailing DeletedAt/DeletedReason
      tasks.appendRow(original);
      arch.deleteRow(i+1);
      return {success:true};
    }
  }
  return {error:'not found'};
}

// Append a deleted row to an archive tab, creating it (with headers) on first use.
// Archive columns = the source tab's headers + DeletedAt + DeletedReason.
function archiveRow_(ss, archiveName, sourceHeader, rowValues, reason) {
  var arch = ss.getSheetByName(archiveName);
  if (!arch) {
    arch = ss.insertSheet(archiveName);
    arch.appendRow(sourceHeader.concat(['DeletedAt', 'DeletedReason']));
    arch.setFrozenRows(1);
  }
  var when = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  var out = rowValues.slice();
  while (out.length < sourceHeader.length) out.push('');
  out = out.concat([when, reason || '']);
  var r = arch.getLastRow() + 1;
  arch.getRange(r, 1, 1, out.length).setNumberFormat('@'); // preserve values as text
  arch.getRange(r, 1, 1, out.length).setValues([out]);
}

// ─── SHOPPING ────────────────────────────────────────────────
function addShoppingItem(item) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('SHOPPING');
  var id = uid_();
  sheet.appendRow([id, item.project, item.trade||'General', item.material||item.description, item.qty||1, item.unitCost||'', item.vendor||'TBD', 'NEEDED', item.actionItem||'', item.notes||'', item.source||'App', today_()]);
  return {success:true, id:id};
}

function toggleShoppingStatus(id) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('SHOPPING');
  var v = sheet.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      sheet.getRange(i+1, 8).setValue(v[i][7] === 'BOUGHT' ? 'NEEDED' : 'BOUGHT');
      return {success:true};
    }
  }
  return {error:'not found'};
}

// ─── PERSONAL ────────────────────────────────────────────────
// Whole-tab rewrite. Two hardenings after the 2026-09-02 corruption (41 rows,
// 14 distinct ids, 3 rows lost): take a document lock so concurrent toggles
// cannot interleave, and write the block in ONE setValues call instead of
// clearContents + N appendRow (appendRow races against a concurrent clear).
function savePersonalItems(items) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) return {error:'busy, try again'};
  try {
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
  } finally {
    lock.releaseLock();
  }
}

// ─── IDEAS ───────────────────────────────────────────────────
// Hardened 2026-11-03 to the same shape as savePersonalItems: one document lock
// and one setValues, instead of clearContents followed by a row-at-a-time
// append. That old shape is what corrupted MAC_PERSONAL three times - two
// writes landing together against a half-cleared sheet - and it was only ever
// safe here because ideas were written rarely. The 11-02 archive feature
// changed that, since archiving an idea is now a write.
//
// Body and Link live only in the sheet. The app does not send them when it
// archives or reorders an idea, so they are read first and carried through, or
// one archive tap would wipe every idea's text.
function saveIdeas(ideas) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) return {error:'busy, try again'};
  try {
    var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('MAC_IDEAS');
    var cur = sheet.getDataRange().getValues();
    var hdr = cur.length ? cur[0] : [];
    var bi = hdr.indexOf('Body'), li = hdr.indexOf('Link');
    var prev = {};
    for (var r = 1; r < cur.length; r++) {
      var k = String(cur[r][0]).trim();
      if (k) prev[k] = { body: bi >= 0 ? cur[r][bi] : '', link: li >= 0 ? cur[r][li] : '' };
    }
    // Dedupe by id, last write wins - defence in depth against a bad payload.
    var seen = {}, clean = [];
    ideas.forEach(function(i) {
      if (!i || !i.id) return;
      var key = String(i.id);
      if (seen[key] === undefined) { seen[key] = clean.length; clean.push(i); }
      else { clean[seen[key]] = i; }
    });
    var rows = [['ID','Text','Category','CreatedAt','Body','Link']];
    clean.forEach(function(i) {
      var p = prev[String(i.id)] || {};
      rows.push([i.id, i.text, i.category||'Film', i.createdAt||today_(),
                 plainCell_(keep_(i.body, p.body)),
                 plainCell_(keep_(i.link, p.link))]);
    });
    sheet.clearContents();
    sheet.getRange(1, 5, Math.max(rows.length, 2), 2).setNumberFormat('@');
    sheet.getRange(1, 1, rows.length, 6).setValues(rows);
    SpreadsheetApp.flush();
    return {success:true, rows: clean.length};
  } finally {
    lock.releaseLock();
  }
}

// ─── PEOPLE ──────────────────────────────────────────────────
function addPerson(person) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('PEOPLE');
  var id = uid_();
  // col 10 = Type (Crew/Sub/Vendor/Client/Contact). Default Contact = not assignable.
  sheet.appendRow([id, person.name, person.role||'', person.email||'', person.phone||'', today_(), person.note||'', person.nextAction||'', person.project||'', person.type||'Contact']);
  return {success:true, id:id};
}

// Set a person's Type (assignability) and optionally their Role/trade.
function updatePersonType(id, type, role) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('PEOPLE');
  var v = sheet.getDataRange().getValues();
  var typeCol = v[0].indexOf('Type');
  if (typeCol < 0) { typeCol = v[0].length; sheet.getRange(1, typeCol+1).setValue('Type'); }
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      if (type !== undefined && type !== null && type !== '') sheet.getRange(i+1, typeCol+1).setValue(type);
      if (role !== undefined && role !== null && role !== '') sheet.getRange(i+1, 3).setValue(role); // col 3 = Role
      return {success:true};
    }
  }
  return {error:'not found'};
}

function updateTaskAssignee(id, who) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('TASKS');
  var v = sheet.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      sheet.getRange(i+1, 5).setValue(who); // col 5 = AssignedTo
      return {success:true};
    }
  }
  return {error:'not found'};
}

function updateLastContact(id, note, nextAction) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('PEOPLE');
  var v = sheet.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      sheet.getRange(i+1, 6).setValue(today_());
      sheet.getRange(i+1, 7).setValue(note);
      if (nextAction) sheet.getRange(i+1, 8).setValue(nextAction);
      return {success:true};
    }
  }
  return {error:'not found'};
}

// ─── VOICE INBOX ─────────────────────────────────────────────
function addVoiceEntry(raw) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('VOICE_INBOX');
  var id  = uid_();
  var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  sheet.appendRow([id, raw, '', '', 'App', now, 'PENDING']);
  return {success:true, id:id};
}

function processVoiceEntry(id) {
  var sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName('VOICE_INBOX');
  var v = sheet.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]) === String(id)) {
      sheet.getRange(i+1, 7).setValue('PROCESSED');
      return {success:true};
    }
  }
  return {error:'not found'};
}

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
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0], rows = [];
  for (var i = 1; i < data.length; i++) {
    var id = data[i][0];
    if (id === null || id === undefined || String(id).trim() === '') continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[String(headers[j]).trim()] = data[i][j];
    }
    rows.push(obj);
  }
  return rows;
}

function today_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function uid_() {
  return Utilities.getUuid();
}
