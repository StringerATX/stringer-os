// Run once, then delete. Adds a "Type" column to PEOPLE and pre-tags known subs.
// Type values: Crew / Sub / Vendor / Client / Contact. Assignable = Sub + Vendor.
// Everyone not tagged here defaults to "Contact" (not assignable) — retag in the app.
function addPeopleType() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('PEOPLE');
  if (!sh) { SpreadsheetApp.getUi && ss.toast('No PEOPLE tab', 'Error', 5); return; }
  var v = sh.getDataRange().getValues();
  var header = v[0];
  var typeCol = header.indexOf('Type');
  if (typeCol < 0) { typeCol = header.length; sh.getRange(1, typeCol + 1).setValue('Type'); }

  // name -> { type, role? }  (role only set when we want to correct/fill it)
  var TAG = {
    'Arnold':          { type: 'Sub', role: 'Electrician' },
    'Josh Burleson':   { type: 'Sub' },   // Airco Mechanical HVAC
    'Mauro Rodriguez': { type: 'Sub' }    // Airco ops/scheduling
  };

  var tagged = 0, defaulted = 0;
  for (var i = 1; i < v.length; i++) {
    var name = String(v[i][1] || '');
    var cur = (typeCol < v[i].length) ? String(v[i][typeCol] || '') : '';
    if (TAG[name]) {
      sh.getRange(i + 1, typeCol + 1).setValue(TAG[name].type);
      if (TAG[name].role) sh.getRange(i + 1, 3).setValue(TAG[name].role); // col 3 = Role
      tagged++;
    } else if (!cur) {
      sh.getRange(i + 1, typeCol + 1).setValue('Contact');
      defaulted++;
    }
  }
  sh.setFrozenRows(1);
  ss.toast('Type column ready. ' + tagged + ' subs tagged, ' + defaulted + ' set to Contact.', 'Done', 6);
}
