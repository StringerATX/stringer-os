// ============================================================
// STRINGER OS — cleanupData.gs
// One-time TASKS cleanup: normalize Project column to IDs + dedupe.
// Run once from Apps Script, review the log, then delete this file.
//
// SAFETY:
//  1. Leave DRY_RUN = true first. Run cleanupData(), open View > Logs,
//     and read the planned changes. NOTHING is written while DRY_RUN.
//  2. When the plan looks right, set DRY_RUN = false and run again.
//     It first copies TASKS to a TASKS_BACKUP_<timestamp> sheet, then
//     rewrites TASKS in place (header row preserved, stays frozen).
//  3. If anything looks wrong afterward, the backup sheet has the
//     original rows — copy them back.
// ============================================================

var DRY_RUN = true;

var SHEET_ID = '1JoUPnPHXrhj6D5XEy86vdw6iuvopk7XlDq-c9wXaNhs';

// Source Project value (trimmed, lower-cased) -> canonical ID used by the app.
var PROJECT_MAP = {
  'terrible wine':            'terrible-wine',
  'bee cave lighting':        'bee-caves',
  'the rosette':              'the-rosette',
  'birol kuyel':              'birol-kuyel',
  'metro':                    'metro-tim',
  'nina estate':              'nina-estate',
  'personal':                 'personal',
  'collections':              'collections',
  'san antonio park north':   'alamo-park-north',
  // Mueller triplicate -> single canonical project ID
  'mueller dedication plaque':'Mueller-Plaque',
  'mueller-plaque':           'Mueller-Plaque',
  'mueller plaque':           'Mueller-Plaque'
};

function normProject_(v) {
  var key = String(v == null ? '' : v).trim().toLowerCase();
  if (PROJECT_MAP.hasOwnProperty(key)) return PROJECT_MAP[key];
  return String(v == null ? '' : v).trim(); // already an ID or unknown: leave as-is
}

// Dedupe key: canonical project + normalized description (case/space/punctuation-insensitive).
function dedupeKey_(projectId, description) {
  var d = String(description == null ? '' : description)
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return projectId + '||' + d;
}

// Higher score = keep this row when two share a dedupe key.
// Prefer rows that carry real progress/detail over blank NEW stubs.
function completeness_(row, idx) {
  // TASKS columns: 0 ID,1 Project,2 Trade,3 Description,4 AssignedTo,
  //                5 Priority,6 Status,7 ActionItem,8 Notes,9 Vendor,10 Source,11 CreatedAt
  var score = 0;
  var status = String(row[6] || '').toUpperCase();
  if (status && status !== 'NEW') score += 4;          // has moved past NEW
  if (String(row[8] || '').trim()) score += 3;         // has Notes
  if (String(row[7] || '').trim()) score += 2;         // has ActionItem
  if (String(row[4] || '').trim()) score += 1;         // has an assignee
  return score * 1000 - idx; // tie-break: keep the earlier row
}

function cleanupData() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('TASKS');
  if (!sheet) { Logger.log('TASKS sheet not found.'); return; }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) { Logger.log('TASKS has no data rows.'); return; }

  var header = values[0];
  var rows = values.slice(1).filter(function(r) {
    return String(r[0] == null ? '' : r[0]).trim() !== ''; // skip blank-ID rows
  });

  var projRenames = [];
  rows.forEach(function(r) {
    var before = String(r[1] == null ? '' : r[1]);
    var after = normProject_(before);
    if (before.trim() !== after) projRenames.push(before + '  ->  ' + after);
    r[1] = after; // normalize Project column in the working copy
  });

  // Dedupe on (project + description), keeping the most complete row.
  var best = {};   // key -> {row, score}
  var order = [];  // preserve first-seen key order for stable output
  rows.forEach(function(r, i) {
    var key = dedupeKey_(r[1], r[3]);
    var score = completeness_(r, i);
    if (!best.hasOwnProperty(key)) { best[key] = { row: r, score: score }; order.push(key); }
    else if (score > best[key].score) { best[key] = { row: r, score: score }; }
  });

  var kept = order.map(function(k) { return best[k].row; });
  var removed = rows.length - kept.length;

  Logger.log('=== TASKS cleanup plan ===');
  Logger.log('Rows in (non-blank): ' + rows.length);
  Logger.log('Project column renames: ' + projRenames.length);
  projRenames.forEach(function(s) { Logger.log('  ' + s); });
  Logger.log('Duplicate rows removed: ' + removed);
  Logger.log('Rows out: ' + kept.length);

  if (DRY_RUN) {
    Logger.log('DRY_RUN = true. No changes written. Set DRY_RUN = false to apply.');
    ss.toast('Dry run complete — see View > Logs. ' + removed + ' dupes, ' + projRenames.length + ' renames.', 'Cleanup preview', 8);
    return;
  }

  // --- Apply for real ---
  // 1) Backup
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  var backup = sheet.copyTo(ss).setName('TASKS_BACKUP_' + stamp);
  Logger.log('Backup created: ' + backup.getName());

  // 2) Rewrite TASKS: clear data rows below the header, write kept rows.
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  if (kept.length) {
    sheet.getRange(2, 1, kept.length, header.length).setValues(
      kept.map(function(r) {
        var out = r.slice(0, header.length);
        while (out.length < header.length) out.push('');
        return out;
      })
    );
  }
  sheet.setFrozenRows(1); // keep the header frozen (lesson learned)

  Logger.log('Applied. TASKS now has ' + kept.length + ' data rows. Backup: ' + backup.getName());
  ss.toast('Cleanup applied. ' + removed + ' dupes removed, ' + projRenames.length + ' renames. Backup: ' + backup.getName(), 'Done', 8);
}
