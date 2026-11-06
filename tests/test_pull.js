// pullInbox() against stubbed Apps Script objects.
// The thing that matters most: it must never read the "Now" list, and it must
// never pull the same capture twice.
const fs = require('fs');
const src = fs.readFileSync('/home/claude/stringer-os/NowSync.gs', 'utf8');

let fails = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) { fails++; console.log('FAIL ' + label + '\n  got  ' + JSON.stringify(got) + '\n  want ' + JSON.stringify(want)); }
  else console.log('pass  ' + label);
};

// ---- the world the script runs in -------------------------------------
function makeEnv(opts) {
  opts = opts || {};
  const env = {
    lists: opts.lists || [
      { id: 'L_default', title: 'My Tasks' },
      { id: 'L_now',     title: 'Now' }
    ],
    tasks: JSON.parse(JSON.stringify(opts.tasks || {
      L_default: [
        { id: 't1', title: 'order the paint for terrible wine', status: 'needsAction' },
        { id: 't2', title: 'call arnold about the breakers', notes: 'bee cave', status: 'needsAction' }
      ],
      L_now: [
        { id: 'n1', title: 'DO NOT PULL ME', status: 'needsAction' }
      ]
    })),
    props: Object.assign({}, opts.props || {}),
    sheetRows: (opts.sheetRows || [['ID','Raw','Routed','RoutedTo','Source','CreatedAt','Status']]).map(r => r.slice()),
    reads: [],            // which list ids were read
    patched: [],          // which tasks were completed
    formats: [],
    lockHeld: opts.lockHeld === true,
    uuid: 0,
    failAppend: opts.failAppend === true
  };

  const sheet = {
    getLastColumn: () => env.sheetRows[0].length,
    getLastRow: () => env.sheetRows.length,
    getRange: (row, col, nRows, nCols) => ({
      getValues: () => {
        const out = [];
        for (let r = 0; r < (nRows || 1); r++) {
          const src = env.sheetRows[row - 1 + r] || [];
          out.push(src.slice(col - 1, col - 1 + (nCols || 1)));
        }
        return out;
      },
      setValues: (block) => {
        if (env.failAppend) throw new Error('sheet write blew up');
        block.forEach((line, r) => {
          const target = row - 1 + r;
          while (env.sheetRows.length <= target) env.sheetRows.push([]);
          line.forEach((v, c) => { env.sheetRows[target][col - 1 + c] = v; });
        });
      },
      setNumberFormat: (f) => { env.formats.push({ row, col, nRows, f }); return sheet.getRange(row, col, nRows, nCols); }
    })
  };

  const g = {
    NOW: null,
    LockService: { getScriptLock: () => ({ tryLock: () => !env.lockHeld, releaseLock: () => {} }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in env.props ? env.props[k] : null),
      setProperty: (k, v) => { env.props[k] = v; }
    })},
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }) },
    Utilities: {
      getUuid: () => 'uuid-' + (++env.uuid),
      formatDate: () => '2026-11-06 02:30'
    },
    Tasks: {
      Tasklists: { list: () => ({ items: env.lists }) },
      Tasks: {
        list: (listId) => { env.reads.push(listId); return { items: (env.tasks[listId] || []).filter(t => t.status !== 'completed') }; },
        patch: (body, listId, taskId) => {
          if (opts.patchThrowsFor && opts.patchThrowsFor.indexOf(taskId) >= 0) throw new Error('patch failed');
          env.patched.push(taskId);
          (env.tasks[listId] || []).forEach(t => { if (t.id === taskId) t.status = 'completed'; });
        },
        remove: () => {}, insert: () => ({ id: 'x' })
      }
    },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => ({ timeBased: () => ({ everyMinutes: () => ({ create: () => {} }) }) }) },
    SpreadsheetAppStub: sheet
  };
  // eslint-disable-next-line no-new-func
  new Function(Object.keys(g).join(','), src + '\n;this.__pullInbox = pullInbox; this.__CAP = CAP; this.__NOW = NOW;')
    .call(g, ...Object.keys(g).map(k => g[k]));
  env.run = () => g.__pullInbox();
  env.CAP = g.__CAP;
  return env;
}

const inboxRows = env => env.sheetRows.slice(1);
const col = (env, name) => env.sheetRows[0].indexOf(name);

// ---- 1. the happy path ------------------------------------------------
let e = makeEnv();
e.run();
check('pulls both open captures from the default list', inboxRows(e).length, 2);
check('the raw text is the spoken title',
  inboxRows(e).map(r => r[col(e, 'Raw')]),
  ['order the paint for terrible wine', 'call arnold about the breakers - bee cave']);
check('a Google Tasks note is carried into the text',
  inboxRows(e)[1][col(e, 'Raw')].includes('bee cave'), true);
check('lands as PENDING so it shows on the INBOX tab',
  [...new Set(inboxRows(e).map(r => r[col(e, 'Status')]))], ['PENDING']);
check('Source says Voice, not App', [...new Set(inboxRows(e).map(r => r[col(e, 'Source')]))], ['Voice']);
check('every row gets its own id',
  new Set(inboxRows(e).map(r => r[col(e, 'ID')])).size, 2);
check('Routed and RoutedTo are left blank for triage to fill',
  inboxRows(e).map(r => [r[col(e, 'Routed')], r[col(e, 'RoutedTo')]]), [['', ''], ['', '']]);
check('CreatedAt is forced to plain text so Sheets cannot make it a Date',
  e.formats.some(f => f.col === col(e, 'CreatedAt') + 1), true);

// ---- 2. THE important one: the Now list is untouchable ----------------
check('never even reads the Now list', e.reads.indexOf('L_now'), -1);
check('nothing from the Now list reached the inbox',
  inboxRows(e).some(r => String(r[col(e, 'Raw')]).includes('DO NOT PULL')), false);
check('the Now list task was not completed either', e.patched.indexOf('n1'), -1);

// a renamed default list that happens to be called Now is still skipped
e = makeEnv({ lists: [{ id: 'L_default', title: 'Now' }], tasks: { L_default: [{ id: 't1', title: 'x', status: 'needsAction' }] } });
e.run();
check('a list titled Now is skipped even when it is the only list', inboxRows(e).length, 0);

// ---- 3. pulled captures get completed and never come back ------------
e = makeEnv();
e.run();
check('each pulled task is marked completed in Google Tasks', e.patched.sort(), ['t1', 't2']);
const firstCount = inboxRows(e).length;
e.run();  // second pass, same env
check('a second run adds nothing (completed tasks are gone)', inboxRows(e).length, firstCount);

// if the complete call fails, the id guard still blocks the re-pull
e = makeEnv({ patchThrowsFor: ['t1', 't2'] });
e.run();
check('a failed complete still leaves the capture in the inbox', inboxRows(e).length, 2);
check('the ids are remembered even though completing failed',
  JSON.parse(e.props.pulled || '[]').sort(), ['t1', 't2']);
e.run();
check('and the next run does NOT pull them a second time', inboxRows(e).length, 2);

// ---- 4. a failed sheet write must lose nothing -----------------------
e = makeEnv({ failAppend: true });
let threw = false;
try { e.run(); } catch (err) { threw = true; }
check('a sheet failure does not silently swallow the capture', threw, true);
check('and nothing was completed, so the next run retries it', e.patched, []);

// ---- 5. edges --------------------------------------------------------
e = makeEnv({ tasks: { L_default: [
  { id: 'b1', title: '   ', status: 'needsAction' },
  { id: 'b2', title: '', status: 'needsAction' },
  { id: 'b3', title: 'real one', status: 'needsAction' }
], L_now: [] } });
e.run();
check('blank titles are skipped, the real one is kept',
  inboxRows(e).map(r => r[col(e, 'Raw')]), ['real one']);

e = makeEnv({ tasks: { L_default: Array.from({ length: 40 }, (_, i) => ({ id: 'm' + i, title: 'item ' + i, status: 'needsAction' })), L_now: [] } });
e.run();
check('one run is capped so the trigger cannot time out', inboxRows(e).length, e.CAP.MAX);
e.run();
check('the rest arrive on the following run', inboxRows(e).length, 40);

e = makeEnv({ tasks: { L_default: [], L_now: [] } });
e.run();
check('an empty list writes nothing at all', e.sheetRows.length, 1);

e = makeEnv({ lockHeld: true });
e.run();
check('a held lock makes it bow out rather than double-write', inboxRows(e).length, 0);

// a third list the user made by hand is read too
e = makeEnv({
  lists: [{ id: 'L_default', title: 'My Tasks' }, { id: 'L_now', title: 'Now' }, { id: 'L_mine', title: 'Stringer' }],
  tasks: { L_default: [], L_now: [], L_mine: [{ id: 'z1', title: 'from a hand made list', status: 'needsAction' }] }
});
e.run();
check('a list the user made himself is pulled from as well',
  inboxRows(e).map(r => r[col(e, 'Raw')]), ['from a hand made list']);

// an inserted column must not shift the data
e = makeEnv({ sheetRows: [['ID','Raw','Priority','Routed','RoutedTo','Source','CreatedAt','Status']] });
e.run();
check('an inserted VOICE_INBOX column cannot misplace the write',
  inboxRows(e).map(r => [r[1], r[5], r[7]]),
  [['order the paint for terrible wine', 'Voice', 'PENDING'],
   ['call arnold about the breakers - bee cave', 'Voice', 'PENDING']]);

// the remembered-id list has to stay under the Script Properties size cap
e = makeEnv({ props: { pulled: JSON.stringify(Array.from({ length: 140 }, (_, i) => 'oldid' + i)) } });
e.run();
const kept = JSON.parse(e.props.pulled);
check('the remembered id list is capped', kept.length, e.CAP.REMEMBER);
check('and stays well under the 9KB Script Properties limit', e.props.pulled.length < 9000, true);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall ' + '' + 'passed');
process.exit(fails ? 1 : 0);
