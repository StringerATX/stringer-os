// Run once, then delete. Creates SCHEDULE tab with the week of Aug 3 seeded.
function createScheduleTab() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var old = ss.getSheetByName('SCHEDULE');
  if (old) ss.deleteSheet(old);
  var sheet = ss.insertSheet('SCHEDULE');

  var rows = [
    ['ID','Date','Person','StartTime','EndTime','Location','Project','Notes','Status'],

    // MONDAY AUG 3
    ['s001','2026-08-03','Mac','8:00 AM','10:00 AM','The Rosette','the-rosette','Cable tray install. Assess speaker mounts + lighting. Todd on site.','PLANNED'],
    ['s002','2026-08-03','Mac','10:30 AM','4:00 PM','Terrible Wine','terrible-wine','Airco HVAC day 1. Call DuShun Phillips + Alex Sanchez today.','PLANNED'],
    ['s003','2026-08-03','Christian','8:30 AM','4:00 PM','Terrible Wine','terrible-wine','Mirrors, sticker material, fan covers, address numbers.','PLANNED'],
    ['s004','2026-08-03','Mitchell','7:30 AM','4:00 PM','Bee Cave','bee-caves','Sonotube forms.','PLANNED'],

    // TUESDAY AUG 4
    ['s005','2026-08-04','Mitchell','7:30 AM','4:00 PM','Bee Cave','bee-caves','Rebar.','PLANNED'],
    ['s006','2026-08-04','Christian','8:30 AM','4:00 PM','Terrible Wine','terrible-wine','Bar top build start, 1x2 trim, paint touch-up.','PLANNED'],
    ['s007','2026-08-04','Mac','9:00 AM','4:00 PM','Terrible Wine','terrible-wine','Airco day 2. Call Arnold re fixtures/blanks.','PLANNED'],

    // WEDNESDAY AUG 5
    ['s008','2026-08-05','Mac','9:00 AM','11:00 AM','Bee Cave','bee-caves','City inspection - Alex Sanchez. If TW inspection collides, Mitchell covers this.','PLANNED'],
    ['s009','2026-08-05','Mac','1:00 PM','3:00 PM','Terrible Wine','terrible-wine','Mechanical inspection (tentative).','PLANNED'],
    ['s010','2026-08-05','Christian','8:30 AM','4:00 PM','Terrible Wine','terrible-wine','Threshold check, floor tape + mop round 1.','PLANNED'],
    ['s011','2026-08-05','Mac','3:30 PM','4:30 PM','Mueller','Mueller-Plaque','Site visit - must happen by Thursday. Ben Pedley.','PLANNED'],

    // THURSDAY AUG 6
    ['s012','2026-08-06','Mitchell','7:00 AM','3:00 PM','Bee Cave','bee-caves','Concrete pour day 1.','PLANNED'],
    ['s013','2026-08-06','Mac','10:30 AM','2:00 PM','Meals on Wheels','personal','Standing Thursday slot.','PLANNED'],
    ['s014','2026-08-06','Christian','9:00 AM','12:00 PM','Kevin Williams - Upper Branch Cove','kevin-dracula','TENTATIVE - Kevin asked for Thursday. Confirm time + scope from texts.','TENTATIVE'],
    ['s015','2026-08-06','Christian','1:00 PM','4:00 PM','Terrible Wine','terrible-wine','Punch list continues.','PLANNED'],

    // FRIDAY AUG 7
    ['s016','2026-08-07','Mitchell','7:00 AM','3:00 PM','Bee Cave','bee-caves','Concrete pour day 2.','PLANNED'],
    ['s017','2026-08-07','Christian','8:30 AM','4:00 PM','Terrible Wine','terrible-wine','Final punch: mop rounds, remaining paint.','PLANNED'],
    ['s018','2026-08-07','Mac','9:00 AM','4:00 PM','Float','terrible-wine','TW close-out. Birol door measurement if available.','PLANNED'],

    // SATURDAY AUG 8
    ['s019','2026-08-08','Mac','9:00 AM','2:00 PM','Myers Creek','personal','Nina Day - family work day. Pool build if not done Sunday.','PLANNED'],
  ];

  sheet.getRange(1, 1, rows.length, rows[0].length).setNumberFormat('@');
  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);

  ss.toast('SCHEDULE tab created with ' + (rows.length - 1) + ' entries.', 'Done', 5);
}
