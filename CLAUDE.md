# Stringer OS — Project Context (for Claude Code)

This file is the handoff brief. A fresh Claude Code session should read it top to
bottom and be able to continue exactly where the last one left off.

> **SECURITY:** This repo is **public**. Do **not** commit access tokens, crew
> emails, or client/financial data. Real tokens + emails live only in the deployed
> Apps Script `Code.gs` (and with Mac). The committed `Code_final.gs` has them
> replaced with `REDACTED_*` placeholders. See `.gitignore` for files kept local.

---

## What Stringer OS is

A mobile web app for **Stringer Industries LLC** (commercial general contractor,
Austin TX). It runs the field operation: projects, tasks, schedule, shopping/
materials, a people/subs CRM, personal checklist, creative ideas, and a universal
capture **Inbox with triage**.

- **Owner:** Mac (role `owner`, sees everything)
- **Crew:** Christian, Mitchell (role `crew`, see their own tasks + schedule + shopping)
- **Office/work:** Tracy (role `work`)

## Architecture

Google Sheet = database · Apps Script = JSON API · GitHub Pages = frontend host.

- **Sheet (database)** — ID `1JoUPnPHXrhj6D5XEy86vdw6iuvopk7XlDq-c9wXaNhs`
  Tabs: `PROJECTS`, `TASKS`, `SHOPPING`, `SCHEDULE`, `PEOPLE`, `VOICE_INBOX`,
  `MAC_PERSONAL`, `MAC_IDEAS`, `LIST` (hidden dropdowns), plus auto-created
  `TASKS_ARCHIVE`, `SCHEDULE_ARCHIVE`, and `TASKS_BACKUP_<stamp>` (from cleanup).
- **Apps Script (API)** — single file `Code.gs`, bound to the sheet
  (Extensions → Apps Script). Deployed as a web app, "Execute as me / Anyone can
  access". Source of truth committed here as **`Code_final.gs`** (redacted).
  The live exec URL is the `API` constant in `index.html` (source of truth).
- **Frontend** — `index.html`, vanilla JS, no framework/build. Hosted on GitHub
  Pages: `https://stringeratx.github.io/stringer-os?t=<TOKEN>`. Fetches the API on
  load, holds state in global `S`, renders via `innerHTML`, writes optimistically.

## Auth / tokens

Access is by `?t=<token>` URL param. There are four per-user tokens — owner (Mac),
two crew (Christian, Mitchell), and work (Tracy). **The token values and their
format are intentionally NOT documented here** — get them from Mac or the deployed
`Code.gs` `TOKENS` map. The token is the *only* security and the exec URL is already
public in `index.html`, so never publish a token or anything that reveals its
format (it would make them guessable).

## API pattern

`GET` the exec URL with a token:
- **No `action`** → returns the full app data as JSON (`user, projects, tasks,
  shopping, schedule, personal, ideas, people, voiceInbox, tasksArchive, trades`).
- **`&action=X&...params`** → a write. Actions currently supported:
  `updateTaskStatus, updateTaskPriority, updateTaskNotes, updateTaskDescription, deleteTask,
  restoreTask, updateTaskAssignee, toggleShoppingStatus, addTask, addShoppingItem,
  updateScheduleEntry, addScheduleEntry, deleteScheduleEntry, savePersonalItems,
  saveIdeas, updateTaskToday, addPerson, updateLastContact, updatePersonType, addVoiceEntry,
  processVoiceEntry, addProject, archiveDoneTasks` (owner only, `days` param, default 30),
  `updateShoppingItem, deleteProject` (owner only), `updateProject` (owner only).

To hit the API from a script, URL-encode params (e.g. `curl -sSL -G "$EXEC"
--data-urlencode "t=$TOKEN" --data-urlencode "action=addTask" ...`).

## Deployment process

- **Frontend:** edit `index.html`, commit + push to `main`. GitHub Pages serves it.
  Pages caches hard — append `&v=<n>` to the app URL to bust cache when verifying.
- **Backend:** Apps Script → open `Code.gs`, replace all with the current
  `Code_final.gs` contents (restore the real tokens/emails first!), **Save**, then
  **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
  This keeps the same exec URL. **You MUST cut a New version or the live API keeps
  running the old code.**

## Deployment gotchas (learned the hard way)

- **Row 1 is frozen on every tab.** A sort once pushed the header into the data and
  broke everything. Never unfreeze / never let headers get sorted into rows.
- **Backend edits need a New deployment version** to go live.
- **GitHub Pages caches aggressively** — bump `&v=` when verifying.
- **Exact enum case:** Priority = `HIGH/MEDIUM/LOW`; Status = `NEW/IN PROGRESS/
  ON HOLD/DONE`. The app matches exactly.
- **ASCII only when writing via the API.** Non-ASCII (em-dash `—`) got mangled to
  `�` through the curl path. Use plain hyphens.
- **Date/time cells** in SCHEDULE are plain-text formatted (`@`) so Sheets doesn't
  auto-convert them; `addScheduleEntry`/`updateScheduleEntry` set `@` before writing.
- Deleting a task/schedule entry **archives** the row (to `TASKS_ARCHIVE` /
  `SCHEDULE_ARCHIVE`) before removing — nothing is hard-deleted.

## Current feature status (as of 2026-08-31)

**MATERIAL DETAIL PAGE + PROJECT EDIT/DELETE - LIVE (Version 42, 2026-11-05 1:49 PM).**
Backend deployed by Claude patching the Monaco editor in Chrome; Mac did not touch it.
Verified live against both tokens: owner gets `not found` on `updateShoppingItem`,
`deleteProject` and `updateProject` with a bogus id (so the actions route), and a crew
token gets `owner only` on all three of `deleteProject`, `updateProject` and `addProject`
(so the gates hold). **Version 41 is the rollback.**
Mac's framing, and it is now the rule: **every tab should have a list and a tile
view, and everything you click into should behave the same way across the app.**
Build to that, not to one-off layouts.

- **`rShopping` never called `layBar()`.** The SHOPPING tab had no toggle button at
  all, so it silently inherited whatever layout was last set on another tab. That
  was the bug Mac hit when he said materials "aren't a tile right now." Fixed.
- **New material detail page** (`rMatDetail`, `openMat`/`closeMat`, `saveMat`), with
  scroll restore, same shape as the task detail page. Material, Project, Trade, Qty,
  UnitCost, Vendor and Notes are all editable, plus NEEDED/BOUGHT buttons, a line
  total, and an Open Link button when Notes holds a URL.
- **No schema change was needed.** SHOPPING already carried `UnitCost` and `Notes`;
  they were simply never surfaced. Check the sheet before assuming a migration.
- **Shopping rows now carry the project name**, colored by project, and `shX(s,hideProj)`
  takes a flag so rows inside a project detail do not repeat that project's own name.
- **Shopping filters are two dropdowns, not chips (2026-11-05).** Vendor and project
  chips were ~19 buttons that wrapped into a 440px-tall header on a phone, pushing the
  actual materials off the screen. They are now two `<select>` elements side by side.
  **They STACK rather than replace each other** — `S.sf` went from `{type,value}`
  (either/or) to `{vendor,project}` (both optional, both applied). Two dropdowns that
  silently cleared each other would read as broken. Measured on a 390x844 phone with
  8 projects and 10 vendors: first material moved from y=440 to y=239, and visible
  materials went 5 -> 7. Mac's real sheet has more projects, so the saving is larger.
- **`shList` mirrors `tiList` deliberately.** The checkbox stays its own tap so a list
  can still be ticked off in a store, and only the text opens the detail page. Do not
  "simplify" this into a plain `lrow`, it costs one-tap buy-off.
- **`updateShoppingItem` and `updateProject` look columns up from the header**, not by
  fixed index, and only write the fields actually sent. A partial call cannot blank the
  rest of the row and an inserted column cannot silently write the wrong cell.
- **`deleteProject` archives to `PROJECTS_ARCHIVE` then removes**, same as `deleteTask`.
  Tasks and materials are **deliberately not cascaded** — their rows stay in TASKS and
  SHOPPING so no work history vanishes with the project row. The confirm strip on the
  tile says how many rows will be left pointing at a gone project.
- Project delete lives **outside** the `.pcard`, because that card's own onclick opens
  the project and anything clickable inside it navigates instead of confirming.
- **SECURITY: `addProject` was never owner-gated in the backend.** The UI button has
  been owner-only since 11-03 but any crew token could post the action directly. Closed
  in this deploy, along with gates on `deleteProject` and `updateProject`. `updateProject`
  matters most: Budget and Actual are stripped from the crew payload entirely, so a crew
  token must not be able to write figures it is not allowed to read. **Any new write
  action needs its own server-side role check — the UI is not a gate.**
- People and Inbox gained the toggle. **Mac and Rhythm deliberately did not** (time-ordered
  checklists, a tile/list switch there changes nothing useful). Schedule deferred by
  agreement: doing it right means rethinking it, not bolting a toggle on.
- Verified: 44 backend logic checks against stubbed Apps Script objects (including every
  owner gate and the header-lookup behavior) and 42 checks in Chromium covering both
  layouts, the save and revert paths, and owner vs crew gating. No page errors.

**CALENDAR IS CHEAPER THAN THE ROADMAP SAYS (found 2026-11-05, not built).** Roadmap #3
and daily-plan blocker #3 both say the calendar is not connected and imply an external
server. **Apps Script has `CalendarApp` built in and this web app already runs "Execute
as me," so `getAppData_` can read Mac's calendar directly.** No OAuth dance, no hosted
service. Mac asked for Google Calendar items to show up in the app's SCHEDULE tab and
that is now a small job, not a big one. **It was deliberately NOT put in Version 42**,
because adding `CalendarApp` adds a new OAuth scope, which forces a re-authorization of
the deployed web app. If that goes wrong the exec URL starts failing for everyone, so it
deserves a deploy where the scope change is the only variable.

**CREW SEE PROJECTS, MONEY STRIPPED SERVER-SIDE - LIVE (Version 41, 2026-11-03 4:55 PM).**
Mac decided crew get every project field except the dollars.

- **Budget and Actual are removed from the PAYLOAD in `getAppData_`, not hidden in
  the UI.** This is the whole point and must not be "simplified" later. The token
  is the only security on this app and the exec URL is public in `index.html`, so
  a field left in the JSON is readable by anyone who opens the API directly. A
  frontend-only hide would protect nobody.
- Crew nav gained a PROJECTS sub-tab. They can open project detail and add tasks
  into a project. They cannot add projects - that button is owner-gated.
- `PercentComplete` used to live inside the money strip and would have vanished
  with it, so it now renders in its own strip when Budget is absent.
- Verified live against both tokens: owner gets 20 projects with Budget; Christian
  gets the same 20 with keys Client, Color, ID, InspectionsReq, Jurisdiction,
  Location, Name, PercentComplete, PermitNum, Status and no figure anywhere in the
  payload.

**Tiles/List toggle is now on every list, not just Today.** Project list, project
detail tasks and materials, shopping, and creative all route through a `tiX()`
style picker (`ti`, `tiD`, `shX`, `iX`) so the two layouts cannot drift. All of
them share one `lrow()` row shape. Remembered per device in `localStorage`
`sos_layout`. **Any new list must go through a picker, not call its tile renderer
directly.**

**`Crew` is now a real entry in `assigneeNames()` and the default in the add-task
pickers.** A task assigned to Crew already reached both Christian and Mitchell
through the server-side filter; what changed is that assigning to both is now the
default and naming one person is the deliberate act.

**THE TODAY FLAG - LIVE (frontend + backend Version 40, 2026-11-03 2:33 AM).**
Mac opened the STRINGER tab and found "100 something things". He was right, and
the view was worse than the data: it rendered every HIGH task and then every open
task underneath, so HIGH items appeared twice and the screen ran to ~150 rows
against 107 open tasks. On top of that **44 of the 107 are marked HIGH** - priority
had been used to mean "this matters", not "this is next" - so sorting by priority
moved almost nothing.

- **TASKS col 14 `Today` holds a DATE, not TRUE/FALSE.** A boolean would need
  something to clear it overnight, which is the exact trap roadmap #2 fell into. A
  date just stops matching tomorrow. **Do not "fix" this into a flag.** The column
  is auto-created on first use, same as `CompletedAt`.
- New action `updateTaskToday(id, on)`. Anything but `false`/`0`/empty sets today.
  `getAppData_` runs `Today` through `plainCell_` so a column that loses its `@`
  format and comes back as a Date still compares correctly.
- TODAY is now **Today / In progress / Everything else**, with Everything else
  collapsed into per-project groups carrying a count and a high count.
- A star on each row and a button on task detail toggle the flag. Optimistic write,
  reverts with a message on failure.
- **Tiles/List layout toggle**, remembered per device in `localStorage` key
  `sos_layout`.
- Verified: 21 backend logic checks against stubbed Apps Script objects, 23 checks
  in Chromium, and a live API probe confirming all 107 tasks carry `Today` as a
  string. Backend deployed by Claude driving the Apps Script editor in Chrome; Mac
  did not touch it.

**Who sets the flag:** Mac's intent is that he and Hazel decide together what
tomorrow looks like and mark those rows, with everything else lining up behind it.
The star is for in-the-moment changes, not the main path.

**THE DAY PLAN — LIVE (frontend + backend Version 39, 2026-11-02 11:44 PM).**
The MAC tab is now the day, not a list of responsibilities. Backend deployed by
Claude driving the Apps Script editor in Chrome; Mac did not touch it.

- **The day starts when Mac taps "Start my day", not at a fixed hour.** The wake
  stamp is `localStorage` keyed `sos_wake_<YYYY-MM-DD>`, so it is per-device and
  needs no backend. **This is also what killed roadmap #2:** a new date simply has
  no stamp, so there is nothing to reset overnight and no trigger to miss.
- **Rhythm ticks are a date, not a flag.** `isDone()` reads `LastDone === today`
  for rhythm rows, so tomorrow starts clean. Responsibilities (`p*`) are one-off
  and keep the plain `done` boolean. **Do not "fix" this by unifying them.**
- **`Slot` holds minutes after wake** (a plain number), or `CLOCK:HH:MM` for a wall
  time that does not move, or `ANYTIME` / `ONSITE` / `ASNEEDED`. `Days` blank means
  daily, otherwise a day list like `Thu`. This replaces `rhythmHour()`, which
  regexed the hour out of the description text and moved if the wording changed.
  `rhythmHour` is still used by the old RHYTHM tab and is still fragile.
- **`Active=FALSE` hides an item without deleting it.** Five supplement rows are
  switched off because Mac stated 11/1 he is on nothing but Adderall. Flip them on
  when he restarts. The point is that the day must not open with four failures.
- `pd1` (8am wake anchor) retired via Active=FALSE - the wake stamp replaces it.
  `pd5` reworded from "9:30am to noon" to "2.5 hours" since Slot now carries time.
  `pd23` breakfast added (Blender First shake, or 2 eggs and avocado) at +105.
- **The Work block is priority order, not today order**, and says so on screen.
  TASKS still has no date column. Giving Mac's own tasks a date or Today flag is
  the next real piece.
- Verified in Chromium against the live data shape: timeline off a 9:00 wake put
  Adderall 9:05 / walk 9:30 / kettlebell 10:15 / breakfast 10:45 / deep work 11:30,
  inactive meds hidden, day-of-week rows correct for the actual weekday, stale
  September `done` flags ignored, a LastDone of today reads done and an older one
  resets, and responsibilities kept their flag. No page errors.

**Where the live script actually is:** project `17fQKFbpZe6mdpNVl-ANQKD3LMz-AkUlFXNsI-1T6_L9WMdrioFItMqvt`,
**renamed "Stringer OS Backend" on 2026-11-05**, so it is no longer ambiguous. The
other project, still called "Untitled project" in script.google.com/home/my, is the
stale July duplicate the Aug audit said to delete. **If you see "Untitled project",
you are in the wrong one.**

**Hide-finished + archive everywhere — frontend LIVE (2026-11-02), no backend change.**
- **Project tiles carry a status badge.** `SC` gained the project statuses actually
  in use (COMPLETE, CLOSED, CANCELLED, PLANNING, SCHEDULING, ONGOING, AWAITING
  PAYMENT, COLLECTIONS); before this only task statuses were mapped, so the
  detail-page pill fell back to grey for every project status.
- **Finished projects are hidden** behind a "Show finished (n)" chip. The hidden set
  is `PDONE` = COMPLETE/CLOSED/CANCELLED/DONE. **AWAITING PAYMENT and COLLECTIONS
  are deliberately NOT in it** — a finished job you have not been paid for has to
  stay visible. Do not "tidy" them into PDONE.
- **MAC and CREATIVE items archive instead of vanishing.** Archiving prefixes the
  row's category with `archived:` (`isArch`/`baseCat` helpers), so the original
  category survives, the row is never removed from the sheet, and restore is one
  tap. Archived items drop out of MAC, RHYTHM and every creative filter chip,
  behind a "Show archived (n)" toggle. This needed no schema change because
  `savePersonalItems` and `saveIdeas` already rewrite their whole tab from the
  array the app sends.
- `rmI` (the old hard-delete for ideas) is still defined but **nothing in the UI
  calls it** — the × now calls `archI`.
- Verified in Chromium against stub data before push: cancelled project hidden then
  shown on toggle, AWAITING PAYMENT stayed visible, archived personal item hidden
  from both MAC and RHYTHM, archived idea hidden from all chips, no page errors.

**Live (frontend pushed + backend deployed):**
- Task detail page: description (editable), notes (editable, renders an "Open
  Attachment" button for URL notes), status buttons, notes preview in lists.
- Delete-with-archive + "Recently deleted" **restore** (undo) on the Today view.
- Schedule tab: day-grouped, per-person colors; owner adds/edits/deletes; owner can
  edit person/location/date/project; crew edit their own times/notes/status.
- **Inbox + triage** tab (owner): capture → triage each item into Task / Material /
  Idea / Schedule / Personal / Contact (or Dismiss). Capture tag (MAC/STRINGER/
  CREATIVE/PEOPLE) pre-selects the destination. Frontend-only (reuses add-actions).
- Shopping, projects, people CRM, personal checklist, creative ideas.

**Assignable subs — LIVE (deployed 2026-08-06).** People carry a `Type`
(Crew/Sub/Vendor/Client/Contact); assignee pickers = crew + Sub/Vendor people; task
detail has a **Reassign** control; People tab sets Type + trade. Backend has
`updateTaskAssignee`, `updatePersonType`, `addPerson` type. Tagged: Arnold=Sub/
Electrician, Josh Burleson & Mauro=Sub, Christian/Mitchell/Eric=Crew.

**Per-person task view — LIVE (deployed 2026-08-28).** In `getAppData_`, every
non-owner role is filtered to their own tasks: crew (Christian/Mitchell) see tasks
where `AssignedTo == their name` **or** `AssignedTo == "Crew"`; Tracy (`work`) sees
only her own. Deployed as a new version on 2026-08-28 and confirmed with Tracy —
she sees **8 distinct tasks** (after the Aug 31 dedupe; an earlier note said 7).
There is no UI filter control and none is needed — the filtering is server-side in
`getAppData_`. Do not "fix" this by adding a client-side assignee filter.

**Crew day view - frontend LIVE (2026-09-28), no backend change.** Phone-first
"today + next workday" view for one person, built into the existing `rToday`:
- Crew (Christian/Mitchell) now land on **MY DAY** (was MY TASKS). The owner gets a
  **CREW** sub-tab (between PROJECTS and SHOPPING) with a Christian/Mitchell picker.
- Tasks have no date column, so the SCHEDULE places them: a task on a project the
  person is booked at today goes under TODAY, the next workday's project under
  TOMORROW (Fri/Sat show NEXT WORKDAY = Monday), everything else under OPEN.
  Person match = `AssignedTo == name` or `"Crew"` (same rule as the server filter).
- 48px checkboxes write `updateTaskStatus` DONE; the row stays struck through for the
  session and a second tap restores the previous status. Failed writes revert + alert.
  Tapping the text opens the normal task detail page.
- Functions: `rCrewDay`, `crewTasks`, `crewItem`, `crewTick`, `nextWorkday`. The
  sub-nav now scrolls sideways at phone width (5 owner tabs no longer fit at 375px).
- It is only as good as the SCHEDULE: if nobody is booked, every task sits in OPEN.

**Rhythm tab + editable Priority — frontend LIVE, backend PENDING DEPLOY (2026-09-02).**
- **RHYTHM tab** (owner nav, between MAC and STRINGER) renders the MAC_PERSONAL daily
  rhythm as a time-ordered day. MAC is now "Responsibilities" and shows only the
  non-rhythm rows. A row counts as rhythm if its id starts with `pd` or its text names
  a time. Hours are parsed from the text; ones only implied ("morning", "after
  dinner") are inferred and shown with a `~`, and rows with no time at all go to an
  **Anytime** block rather than being given a made-up hour.
- **Priority is editable** in task detail, same button pattern as Status. This needed a
  new backend action `updateTaskPriority` (writes TASKS col 6). Live since the
  2026-09-16 backend redeploy. If the buttons ever revert and alert again, the
  backend is on an old version.
- **`savePersonalItems` hardened** in the same deploy (live 2026-09-16) — see the
  MAC_PERSONAL corruption note below.
- **DONE snaps back to the list (2026-09-16).** Tapping DONE on the task detail page
  closes the page and returns to the list you came from at the same scroll position,
  so the next task sits where the finished one was. Other statuses stay on the page.
  `openTask` records `S.listScroll`; `closeTask()` restores it and is also what the
  back arrow and delete use.
- **Readability pass:** the two secondary greys were failing on the dark ground
  (`#6b6860` ~3.5:1, `#3a3a36` ~1.7:1); now ~10:1 and ~6.3:1. Type scale raised
  throughout (9->13, 11->14, 13->16px). Because the palette got lighter, white-on-colour
  broke for the light badges — `onColor()` now picks dark or white per background.
- **Desktop layout** is CSS-only: at **>=720px** `body` drops its max-width entirely
  (`max-width:none`) and `.pad` becomes an auto-fill grid — 320px min columns, 400px
  above 1600px. Cards opt *in* to columns; everything else spans full width by
  default, so detail views cannot column-split. Line length is capped at 900px on
  `.td-desc`/`.td-notes` only, where long lines actually hurt.
  **Do not raise the 720px breakpoint.** It shipped at 900px on 09-02 and did not
  work: a browser window that is not maximised, or a laptop at 150% Windows display
  scaling, reports under 900px of CSS width even on a large monitor (measured: 887px),
  so those machines silently kept the 480px phone column. There is no max-width above
  the breakpoint on purpose — on a monitor this fills the screen like a spreadsheet.

**Data: synced 2026-11-02 from the Hazel ops chat, via the Sheets API rather than
this app's own actions.** What changed, so a later session is not surprised:
- **PROJECTS rewritten** (20 rows). Terrible Wine corrected from "IN PROGRESS 6%,
  actual $4,700" to **97%, actual $284,072.53** — the real billed figure is
  $558,523.84 but that includes phantom invoice 1093 ($274,451.31), which still
  needs voiding in QuickBooks. Bee Cave 40% -> 95%. Alamo Ritz Sign and Dracula
  closed. Keith Ruckus CANCELLED (job is dead). Stone Oak's **duplicate row merged**
  — there were two rows sharing the ID `alamo-stone-oak`. Metro moved to
  COLLECTIONS. **Added, were missing entirely:** Wilder House, Myers Creek Building
  1 (Mac GC), Myers Creek Building 2 (Christian GC), Alamo Lakeline (CLOSED).
  Note: billed revenue was written into the `Actual` column; if `Actual` was ever
  meant to be cost-to-date, that needs reversing.
- **Archive sweep run by hand**, NOT via `archiveDoneTasks`. 81 DONE rows moved
  TASKS -> TASKS_ARCHIVE (181 -> 104 live), and all 64 SCHEDULE rows (all dated
  Aug 3 - Oct 5) moved to SCHEDULE_ARCHIVE, which was nearly empty. Both stamped
  `DeletedAt` 2026-11-02 + a reason. **It ignored the 30-day rule and moved every
  DONE row regardless of date**, so "Recently deleted" on the Today view will show
  those 81 until real deletes push them down. Same cosmetic side effect as the
  09-15 sweep.
- **Two Tracy rows were marked DONE but are not done** and got swept into the
  archive with everything else: "Fix QuickBooks company info" (QuickBooks is STILL
  a sole proprietor under Mac's SSN) and "Texas Secretary of State entity search"
  (still open, certified Certificate of Formation still not ordered). Treat DONE
  flags on Tracy-assigned rows as unverified.
- **4 Rosette tasks added** (rows 183-186): balcony handrail design/fab/weld/install
  broken out of the old Aug 17 install-push row; pathway lighting sample for Matt,
  consolidating four scattered stale lighting tasks; tech room door won't close
  because the hardwood is too high, trim the doors (Matt asked 11-02); schedule the
  walkthrough for the June 2027 League of Women Voters office -> control/board room
  conversion.
- SHOPPING: the plexiglass line was on `alamo-park-north` but the work was **Stone
  Oak** scope; moved and marked BOUGHT (installed, invoice sent, awaiting payment).

**Data:** synced through 2026-09-28 (evening sync from the laptop: Terrible Wine
invoice 1118 paid in full + financial items closed, bee-caves checklist split into
Arnold/Mac tasks, Aurora pushed to week of 10/12, 10/5 San Antonio trip for
Christian + Mitchell, Rosette/Birol/Mueller updates, money + admin tasks, Oct 2-8
travel on the SCHEDULE). Before that 2026-09-22 (TASKS 138 -> 149) and 2026-09-15 (housekeeping pass: archive sweep 212 -> 133 tasks,
shelving install / TW full clean / Lori 9/12 flipped DONE; Tue-night reconcile: Terrible Wine opened 9/14,
public Fri 9/18; Aurora framing day; MAC_PERSONAL regimen rewritten to pd13-pd22).
Earlier: 2026-09-10 (Thu-night reconcile via the live API: new
`aurora-bakery` project, Terrible Wine CO issued 9/8 + soft open Mon 9/14, bee-caves
pole/draw status, Metro, Rosette, Park North, admin items). TASKS went 166 -> 164 on
2026-08-31 (6 rows flipped to DONE from the ops chat, 2 duplicate Tracy rows
archived). `VOICE_INBOX` is currently empty.

**MAC_PERSONAL corruption — root cause found and fixed 2026-09-02. READ THIS.**
The tab has now been mass-deduped three times (72 -> 18 on 08-24, 18 -> 17 on 08-31,
then **41 -> 15 on 09-02**). It was never a one-off: `savePersonalItems` did
`clearContents()` followed by one `appendRow()` per item, with no lock. Every
checkbox tap posts the whole array, so two taps in quick succession interleave and
appends land against a half-cleared sheet. By 09-02 it held **41 rows across only 14
distinct ids** (`pd5` x6, `pd1`/`pd3`/`pd4` x5) and had **destroyed three rows
outright** — `pd7` Guitar practice, `pd9` Creative work or drawing, `pd12` Nina Day.
Fix (in the pending deploy): take a `LockService` document lock and write the whole
block in ONE `setValues` call; the frontend also collapses duplicates on read via
`dedupePersonal()`, so a dirty sheet can no longer reach the UI. **`saveIdeas` got
the same treatment on 2026-11-03** (Version 40) — document lock, one `setValues`,
and Body/Link read first and carried through so an archive tap cannot blank them.
The 09-02 clean-up restored the 3 lost rows, dropped `p3` and `p4` (Jul 25 originals
restated by the Jul 29 `pd*` set: `p3` reworded `pd1`, and `pd2` already contains
"property loop"), and reset the 12 rhythm rows to not-done. **Current state: 15 rows
— 12 rhythm (`pd*`) + 3 responsibilities (`p2`, `p5`, `p8`).** One detail was lost
with `p4`: its "min 2x" target for the morning property loop is not in `pd2`.

## Sheet tabs — canonical vs archive (audited 2026-08-31)

11 tabs. Know the difference before touching any:
- **TASKS** (164 rows as of 2026-08-31) = the ONE canonical task list; the app reads
  only this.
- **TASKS_ARCHIVE / SCHEDULE_ARCHIVE** = the delete-with-archive feature (soft-deleted
  rows carry `DeletedAt`/`DeletedReason`). **Keep them** — not duplicates.
- **`TASKS_BACKUP_<stamp>` is GONE.** That stale Aug-3 pre-cleanup snapshot was
  deleted 2026-08-28 via `removeStaleBackup.gs` (`listTabs()` verified first), and
  its absence was re-confirmed against the sheet on 2026-08-31. If anyone ever
  reports "two task lists" again, a leftover backup tab is the thing to look for.
- Full set: PROJECTS, TASKS, SCHEDULE, SHOPPING, PEOPLE, VOICE_INBOX, MAC_PERSONAL,
  MAC_IDEAS, LIST, TASKS_ARCHIVE, SCHEDULE_ARCHIVE.

## Source of truth

- **The ops chat is named "Hazel Jones."** It is the **source of truth for task
  status.** The sheet is the database; Hazel is where status actually changes first.
  When they disagree, Hazel wins — reconcile the sheet to the chat, not the reverse.
  Hazel also authored `idea-vault-spark-lines.md` (Drive, Writing folder), which
  holds the full descriptions behind every `MAC_IDEAS` title.

## MAC_IDEAS (idea vault)

- `MAC_IDEAS` holds 30 entries. i29 "Back to Even" was added 11-02 and i30 "Monkeys
  Figured Out Answers" on 11-05. It was **titles only** until 2026-11-03, when the
  full descriptions were lifted out of **`idea-vault-spark-lines.md`** in Drive
  into the new `Body` column. That doc is still the origin and still worth reading,
  but the sheet is no longer a list of bare names.
- Categories in use: `Film` (8), `Essay / TikTok` (10), `Art` (6),
  `Infrastructure` (2), `Venture` (3), `Music` (1). **`Venture` replaced the old
  `Business`** category. The filter chips **are** hardcoded in `index.html` as the
  `IC` array (~line 199) — adding a category to the sheet without adding it there
  leaves those ideas visible only under the "All" chip. `IC` was updated 2026-08-31.
- IDs are `i1`..`i30`. **`CreatedAt` is NOT plain `YYYY-MM-DD` in the sheet**, whatever
  an older note said: every row holds a long JS date string like
  `Thu Nov 05 2026 00:00:00 GMT-0600 (Central Standard Time)`. Match that format when
  appending, and let `plainCell_` normalize it on read. The `saveIdeas` action
  takes a JSON array in the `ideas` param and **rewrites the whole tab** — there
  is no per-row idea edit.
- **`Body` and `Link` added 2026-11-03.** `Body` holds the full idea text, `Link`
  the origin chat or a Drive doc. All 28 bodies were populated on 11-03 from
  `idea-vault-spark-lines.md`; 25 carry a link (Hazel Jones, Nina's World and
  thatdopegirl have no single source). Longest body is ~1,900 chars.
- **The creative tab is tiles now**, each opening a detail page with the full body,
  an Edit box and an Open-the-source button.
- **`ideasPayload()` is mandatory for any new `saveIdeas` caller.** `saveIdeas`
  travels as a GET query string and 28 full bodies would blow the URL length, so
  `ideasPayload()` strips every body and lets the backend carry them through from
  the sheet. The one body being edited is the exception. Calling
  `JSON.stringify(S.ideas)` instead will either truncate the request or wipe every
  idea's text.
- `rmI` is still defined, still unreachable from the UI, and is now doubly unsafe:
  it hard-deletes AND skips the carry-through. Do not wire it up.

## Operational context (drives coordination)

- **Jurisdictions differ — keep separate.** Terrible Wine = **City of Austin**.
  bee-caves (the parking-lot job / Rollingwood / Chris Francis) = **City of Westlake
  Hills** (different inspectors/permits). PROJECTS has a `Jurisdiction` column but
  there's **no `updateProject` API action yet** to set it. OPEN: verify which
  jurisdiction **Alex Sanchez** belongs to (he appears on both an Austin and a
  bee-caves item — likely a mix-up).
- **bee-caves is Arnold's crew's job**; Mac only coordinates (Arnold ↔ customer ↔
  city). Mitchell is not on it. Mac + crew "float" between projects.
- **Scheduling rule:** when sliding work, **skip weekends** — pushed Friday work
  goes to Monday unless told otherwise. When a sub no-shows, slide *that sub's*
  entries, skip weekends, and **flag conflicts** (double-bookings, weekend landings,
  city reschedules) rather than applying silently.

## Pending work / roadmap

**Backend redeploy DONE 2026-09-16** (Mac, from the laptop, paste of
`Code_DEPLOY_LOCAL.gs` built from commit 0685020 + New version). Verified: the
`updateTaskPriority` probe returns `not found`, Priority edits stick, DONE stamps
`CompletedAt`. Live backend == repo `Code_final.gs` as of that commit. Note for the
regen: the paste file needs BOTH the 4 tokens and the 4 emails in `getSessionUser_`
restored; the real values live only in the deployed `Code.gs` and the local copies.

**Leftover from the Aug 24 audit (both items themselves are DONE as of 08-28):** if
`removeStaleBackup.gs` still exists as a file in the **Apps Script project**, delete
it there. The copy in this repo is kept as a record, like the other one-time scripts.

**Still owed (as of 2026-09-28):**
- **Desktop two-folder census and cleanup is STILL OWED** (see Machines / local
  folders). Needs a desktop day; every session since 9/10 has been on the laptop.
- MAC_PERSONAL has duplicated again: 55 rows on 2026-09-28 (was 24 on 09-15), e.g.
  `pd13`/`pd14`/`pd16` x4. The frontend `dedupePersonal()` hides it; the sheet needs a
  dedupe pass and the cause needs finding (the 09-02 lock fix is live, so something
  else is appending).
- (Backend redeploy: done 2026-09-16, see above. Next time the backend changes, the
  recipe is: regenerate `~/OneDrive/Desktop/stringer-os/Code_DEPLOY_LOCAL.gs` from
  `Code_final.gs` with tokens + emails restored, paste into Code.gs, Save, Deploy >
  Manage deployments > pencil > Version: New version > Deploy, then probe
  `action=updateTaskPriority&id=__probe__&priority=HIGH` for `not found`.)
- Overnight rhythm auto-reset is still roadmap #2 below.

**Recurring monthly step: archive sweep (manual trigger for now; automation candidate
later, e.g. an Apps Script time trigger on the 1st).** Move DONE tasks completed 30+
days ago from TASKS to TASKS_ARCHIVE. Nothing is deleted: `archiveRow_` copies every
column plus `DeletedAt` and a `DeletedReason` naming the sweep and the completion date,
and the row stays readable in the Archive tab and restorable via "Recently deleted".
- After the backend redeploy: one call does it:
  `curl -sSL -G "$EXEC" --data-urlencode t=$TOKEN --data-urlencode action=archiveDoneTasks --data-urlencode days=30`
  It uses the `CompletedAt` column (col 13, auto-created and stamped by
  `updateTaskStatus` from that deploy on). Rows with no `CompletedAt` are skipped and
  reported as `skippedNoDate`; check that number the first few months.
- **First sweep ran 2026-09-15 from the laptop, before `CompletedAt` existed**, so it
  used a proxy: DONE as of the 9/10 snapshot AND `CreatedAt` <= 2026-08-16 AND no
  date after Aug 15 in the text/notes. 79 rows moved via `deleteTask`, reason
  "Archive sweep 2026-09-15: ...". TASKS 212 -> 133. Six DONE rows were deliberately
  kept because their text dated them later (bar top, FIRE inspection, TCO, the Aug 17-19
  bee-caves items). Side effect: "Recently deleted" on the Today view shows sweep rows
  (newest 30) until real deletes push them down.
- Legacy DONE rows that never get a `CompletedAt` (the ones done before the deploy) will
  need one more proxy sweep or a hand-entered date; after that the column carries it.

**Roadmap:**
1. **Rotate the owner token** — needs Mac present. Change the owner token string in
   the live `Code.gs` `TOKENS` map, **redeploy as a New version**, then update
   anywhere Mac's app bookmark embeds `?t=`. Crew/work tokens are unaffected unless
   rotated too. Do not do this without Mac, or he loses app access from his phone.
2. ~~**Rhythm items should reset each morning**~~ **SOLVED 2026-11-02.** No trigger
   was needed in the end. Rhythm done-state is now `LastDone === today`, and the
   day itself only exists once Mac taps the wake stamp, which is per-date. A missed
   night cannot leave a stale tick because there is no nightly job to miss.
3. **AI-assisted triage + connector** — the big one. Goal: Mac tells Claude
   ("Arnold's guys no-showed at bee-caves, slide it") and Claude proposes the shifts
   + conflicts before touching anything. Preferred delivery: a **connector (MCP)**
   wrapping this API so it works from any Claude chat (needs a small hosted server).
   Optional in-app AI suggestions would need an Anthropic API key in Apps Script.
4. **`updateProject` action** — so jurisdiction/other project fields can be set via API.
5. **Per-user personal/creative tabs for crew** (independent).

**THE DAILY PLAN — the thing Mac actually wants (spec'd 2026-11-02).**
Mac opens the app on MAC and wants one ordered list for the whole day, woven from
the rhythm, his own to-dos, his project tasks and his calendar. His framing, in his
words: it is **the framework and the goal for the day, not a contract.** Falling
short is fine; what didn't happen moves and everything behind it shifts. Build for
that, not for a plan that scolds him.

Four things block it today, in the order they have to be fixed:
**Items 1 and 2 below are now SOLVED** — 1 by the wake stamp on 11-02, 2 by the
TASKS `Today` column on 11-03. What is left of this list is 3 and 4, the calendar
and the rhythm times.

1. **Rhythm items never reset** (roadmap #2 above). Nothing flips `done` back, so a
   stale tick makes a whole day read complete. **Nothing else here works until this
   does.** Preferred fix: a `LastDone` date per row compared against today, not a
   nightly trigger that clears flags — it survives a missed trigger and it gives
   Mac a streak history. Reset target is ~3am local.
2. **TASKS has no date column**, so nothing can say "this task is for today." The
   crew day view dodges this by reading SCHEDULE bookings; Mac is not booked on the
   SCHEDULE the way crew are, so he needs a real date or Today flag.
3. **Calendar is not connected at all** — nothing in the API reads it, so
   appointments are invisible to the app.
4. **Rhythm times are regex'd out of the description text** (`rhythmHour`), with
   "morning" -> 7am and so on. Too fragile to sequence a day on. Needs a real time
   field.

Distinction to preserve: **rhythm items reset, to-dos push.** "Drink water" is
recurring and simply comes back tomorrow; an unfinished to-do moves to tomorrow and
shifts the rest. Do not treat them the same.

Mac also wants **Google Calendar to hold the record of what actually happened** —
what got done, pushed or resolved each day — not just the forward plan. Open design
question flagged to him: read-only for appointments plus ONE end-of-day summary
entry is far more likely to survive than writing 8 generated blocks a day onto his
real calendar.

**Architecture note:** the endgame is NOT a smarter app. It is roadmap #3, the MCP
connector — Mac tells Claude "plan my day" in the ops chat, where the calendar, the
board, his health items and what he is behind on are all already visible, and the
finished plan lands in the app as today's list. The app is the display surface. An
auto-generating app will be wrong often enough that he stops trusting it, and the
day he stops trusting it he stops opening it.

Still needed from Mac before this can be built: the real fixed sequence of his
morning (he gave an example, not the list), roughly how many working hours a day
the plan should assume, and whether Spanish and guitar are daily rhythm items or
goals with milestones.

**Lane 2 queue — batch these into ONE Apps Script deploy, do not redeploy per item:**
- ~~`deleteProject`~~ ~~`updateProject`~~ **DONE in Version 42, 2026-11-05.** `updateProject`
  now unblocks the per-project "keep visible" pin, which is why the 11-02 hide-finished
  toggle is still global-only — the backend no longer stops that, only the UI does.
- **Google Calendar into the SCHEDULE tab via `CalendarApp`.** Mac asked for this 11-05.
  Small job, but it adds an OAuth scope and forces re-authorization, so give it a deploy
  of its own where that is the only change. See the calendar note above.
- The remaining daily-plan items above (3 and 4).
- Google Tasks -> VOICE_INBOX puller on a morning time trigger. **The Inbox triage
  half is fully built and works; nothing feeds it.** `addVoiceEntry` is the only
  writer and it stamps Source=`App`, i.e. typed in by hand. Mac's intent was Gemini
  on his Galaxy S26 -> Google Tasks -> a trigger pulls new items in -> he triages.
  That capture half was never built.
- Follow-ups Mac owns: confirm Alex Sanchez's jurisdiction; check with Arnold whether
  the two bee-caves concrete pours can have a weekend gap.

## Machines / local folders

- Desktop machine has two project folders touching Stringer OS; census and cleanup owed
  next desktop session (9/10/26).
- Laptop folder `~/OneDrive/Desktop/stringer-os` is **not a git clone** (no `.git`; its
  `index.html` is the Aug 3 build). Confirmed 9/10/26. Re-clone before any local edits
  there; the API URL it holds is still the live one.

## Google Drive layout (2026-09-28)

- Drive root holds exactly one Stringer ops file: the Google Sheet **Stringer Final
  Ops 2026** (the database, ID above).
- Every old xlsx copy of STRINGER OS / STRINGER 2026 OS / CONSTRUCTION OS / Final Ops
  now lives in root folder **OLD - DO NOT USE** (70 files moved 09-22, 32 more on
  09-28 from folders `1IR3IVV...` and `1GNdvKBd...`). Moves only, nothing deleted.
- Deliberately left in place: `Myer's Creek 2026 OS.xlsx` (different project, just
  matches "OS"), `Stringer_Reconciliation_2025-2026` (bookkeeping, not an OS copy).

## Files in this repo

- `index.html` — the frontend (live on GitHub Pages).
- `Code_final.gs` — backend source, **tokens/emails REDACTED**. Restore real values
  before deploying.
- `createScheduleTab.gs`, `cleanupData.gs`, `addPeopleType.gs`, `removeStaleBackup.gs`
  — one-time migration/seed/cleanup scripts (run once in Apps Script, then delete).
- `.gitignore` — keeps sensitive/local files out of this public repo.

Kept **local, not committed** (sensitive): `CLAUDE_CODE_HANDOFF.md`,
`CLAUDE_CODE_UPDATE_AUG3.md`, `DEPLOY_NEXT_STEPS.md`, `files.zip`, `.claude/`.
