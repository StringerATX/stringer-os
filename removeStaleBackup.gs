// Run once, then delete this file.
// Step 1: run listTabs() to SEE every tab + row count (read-only, changes nothing).
// Step 2: run removeStaleBackup() to delete the stale TASKS_BACKUP* snapshot tab(s).
// The live app never reads TASKS_BACKUP tabs, and TASKS is the canonical task list,
// so removing the backup is safe. TASKS_ARCHIVE / SCHEDULE_ARCHIVE are NOT touched.

var SHEET_ID = '1JoUPnPHXrhj6D5XEy86vdw6iuvopk7XlDq-c9wXaNhs';

function listTabs() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var lines = ss.getSheets().map(function(s){
    return s.getName() + '  |  rows=' + s.getLastRow() + '  cols=' + s.getLastColumn();
  });
  Logger.log('TABS (' + ss.getSheets().length + '):\n' + lines.join('\n'));
  ss.toast(ss.getSheets().length + ' tabs — see View > Logs', 'listTabs', 6);
}

function removeStaleBackup() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var removed = [];
  ss.getSheets().forEach(function(s){
    var name = s.getName();
    // Match the cleanup snapshots only. Does NOT match TASKS, TASKS_ARCHIVE, etc.
    if (/^TASKS_BACKUP/i.test(name)) {
      ss.deleteSheet(s);
      removed.push(name);
    }
  });
  var msg = removed.length ? ('Removed: ' + removed.join(', ')) : 'No TASKS_BACKUP tab found.';
  Logger.log(msg);
  ss.toast(msg, 'removeStaleBackup', 8);
}
