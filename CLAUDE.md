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
  saveIdeas, addPerson, updateLastContact, updatePersonType, addVoiceEntry,
  processVoiceEntry, addProject`.

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

**Rhythm tab + editable Priority — frontend LIVE, backend PENDING DEPLOY (2026-09-02).**
- **RHYTHM tab** (owner nav, between MAC and STRINGER) renders the MAC_PERSONAL daily
  rhythm as a time-ordered day. MAC is now "Responsibilities" and shows only the
  non-rhythm rows. A row counts as rhythm if its id starts with `pd` or its text names
  a time. Hours are parsed from the text; ones only implied ("morning", "after
  dinner") are inferred and shown with a `~`, and rows with no time at all go to an
  **Anytime** block rather than being given a made-up hour.
- **Priority is editable** in task detail, same button pattern as Status. This needed a
  new backend action `updateTaskPriority` (writes TASKS col 6) — **redeploy
  `Code_final.gs` as a New version to activate.** Until then the buttons revert and
  alert; they do not silently fail.
- **`savePersonalItems` hardened** in the same pending deploy — see the MAC_PERSONAL
  corruption note below.
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

**Data:** synced through 2026-09-10 (Thu-night reconcile via the live API: new
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
`dedupePersonal()`, so a dirty sheet can no longer reach the UI. `saveIdeas` still
has the same unhardened shape but is written far less often — harden it if
MAC_IDEAS ever shows the same symptom.
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

- `MAC_IDEAS` is **titles only** — 28 entries as of 2026-08-31 (was 12). Full
  descriptions live in **`idea-vault-spark-lines.md`** in Drive, not in the sheet.
- Categories in use: `Film` (8), `Essay / TikTok` (8), `Art` (6),
  `Infrastructure` (2), `Venture` (3), `Music` (1). **`Venture` replaced the old
  `Business`** category. The filter chips **are** hardcoded in `index.html` as the
  `IC` array (~line 199) — adding a category to the sheet without adding it there
  leaves those ideas visible only under the "All" chip. `IC` was updated 2026-08-31.
- IDs are `i1`..`i28`, `CreatedAt` is plain `YYYY-MM-DD`. The `saveIdeas` action
  takes a JSON array in the `ideas` param and **rewrites the whole tab**
  (`clearContents` + re-append header) — there is no per-row idea edit.

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

**Immediate — redeploy `Code_final.gs` as a New version (2026-09-02).** Two changes
are committed but NOT live: `updateTaskPriority` (Priority editing is inert without
it — the buttons revert and alert) and the hardened `savePersonalItems` (lock +
single `setValues`, which is what stops the MAC_PERSONAL corruption recurring).
Deploy > Manage deployments > Edit > New version.

**Leftover from the Aug 24 audit (both items themselves are DONE as of 08-28):** if
`removeStaleBackup.gs` still exists as a file in the **Apps Script project**, delete
it there. The copy in this repo is kept as a record, like the other one-time scripts.

**Roadmap:**
1. **Rotate the owner token** — needs Mac present. Change the owner token string in
   the live `Code.gs` `TOKENS` map, **redeploy as a New version**, then update
   anywhere Mac's app bookmark embeds `?t=`. Crew/work tokens are unaffected unless
   rotated too. Do not do this without Mac, or he loses app access from his phone.
2. **Rhythm items should reset each morning** — they are daily recurring by nature,
   but nothing ever flips `done` back, so a stale August tick made the whole day read
   as complete. The 09-02 clean-up reset them by hand. Needs a real mechanism: either
   a dated last-completed column, or an Apps Script time trigger that clears `Done`
   for `pd*` rows overnight. Until then they will silently go stale again.
3. **AI-assisted triage + connector** — the big one. Goal: Mac tells Claude
   ("Arnold's guys no-showed at bee-caves, slide it") and Claude proposes the shifts
   + conflicts before touching anything. Preferred delivery: a **connector (MCP)**
   wrapping this API so it works from any Claude chat (needs a small hosted server).
   Optional in-app AI suggestions would need an Anthropic API key in Apps Script.
4. **`updateProject` action** — so jurisdiction/other project fields can be set via API.
5. **Per-user personal/creative tabs for crew** (independent).
- Follow-ups Mac owns: confirm Alex Sanchez's jurisdiction; check with Arnold whether
  the two bee-caves concrete pours can have a weekend gap.

## Machines / local folders

- Desktop machine has two project folders touching Stringer OS; census and cleanup owed
  next desktop session (9/10/26).
- Laptop folder `~/OneDrive/Desktop/stringer-os` is **not a git clone** (no `.git`; its
  `index.html` is the Aug 3 build). Confirmed 9/10/26. Re-clone before any local edits
  there; the API URL it holds is still the live one.

## Files in this repo

- `index.html` — the frontend (live on GitHub Pages).
- `Code_final.gs` — backend source, **tokens/emails REDACTED**. Restore real values
  before deploying.
- `createScheduleTab.gs`, `cleanupData.gs`, `addPeopleType.gs`, `removeStaleBackup.gs`
  — one-time migration/seed/cleanup scripts (run once in Apps Script, then delete).
- `.gitignore` — keeps sensitive/local files out of this public repo.

Kept **local, not committed** (sensitive): `CLAUDE_CODE_HANDOFF.md`,
`CLAUDE_CODE_UPDATE_AUG3.md`, `DEPLOY_NEXT_STEPS.md`, `files.zip`, `.claude/`.
