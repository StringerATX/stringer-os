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
  `updateTaskStatus, updateTaskNotes, updateTaskDescription, deleteTask,
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

## Current feature status (as of 2026-08-03)

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

**Built + pushed but BACKEND NOT YET DEPLOYED — assignable subs:**
- Frontend is live: assignee pickers draw from crew + Sub/Vendor people; task detail
  has a **Reassign** control; People tab shows/sets a person **Type**
  (Crew/Sub/Vendor/Client/Contact) + trade.
- **Pending to finish it:** (1) run `addPeopleType.gs` once (adds the `Type` column
  to PEOPLE, pre-tags Arnold=Sub/Electrician, Josh Burleson & Mauro Rodriguez=Sub);
  (2) redeploy `Code_final.gs` (adds `updateTaskAssignee`, `updatePersonType`,
  `addPerson` type param). Until then those actions return "Unknown action" and the
  dropdowns show only the 4 crew.

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

1. **Deploy assignable subs** — the one thing blocking full functionality (run
   `addPeopleType.gs` + redeploy `Code_final.gs`). Then tag remaining subs in-app.
2. **AI-assisted triage + connector** — the big one. Goal: Mac tells Claude
   ("Arnold's guys no-showed at bee-caves, slide it") and Claude proposes the shifts
   + conflicts before touching anything. Preferred delivery: a **connector (MCP)**
   wrapping this API so it works from any Claude chat (needs a small hosted server).
   Optional in-app AI suggestions would need an Anthropic API key in Apps Script.
3. **`updateProject` action** — so jurisdiction/other project fields can be set via API.
4. **Per-user personal/creative tabs for crew** (independent).
- Follow-ups Mac owns: confirm Alex Sanchez's jurisdiction; check with Arnold whether
  the two bee-caves concrete pours can have a weekend gap.

## Files in this repo

- `index.html` — the frontend (live on GitHub Pages).
- `Code_final.gs` — backend source, **tokens/emails REDACTED**. Restore real values
  before deploying.
- `createScheduleTab.gs`, `cleanupData.gs`, `addPeopleType.gs` — one-time
  migration/seed scripts (run once in Apps Script, then delete).
- `.gitignore` — keeps sensitive/local files out of this public repo.

Kept **local, not committed** (sensitive): `CLAUDE_CODE_HANDOFF.md`,
`CLAUDE_CODE_UPDATE_AUG3.md`, `DEPLOY_NEXT_STEPS.md`, `files.zip`, `.claude/`.
