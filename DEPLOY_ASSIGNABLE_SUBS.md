# Deploy: Assignable Subs

Self-contained checklist to finish shipping the assignable-subs feature.
Frontend is already live; this deploys the backend + runs the one-time migration.
Do this on the laptop at Apps Script (browser steps) — no secrets are in this file.

Exec URL (same one in `index.html`, kept the same across redeploys):
`https://script.google.com/macros/s/AKfycbyT8H0cR4gzOOgRsqMULSkHTaClDWpEKq8p28T-pBtMwUIUEbk9H4nOGrGoE88DrR22pw/exec`

---

## Phase 1 — Run `addPeopleType.gs` ONCE

1. Sheet -> Extensions -> Apps Script.
2. Add a file (+ -> Script), name it `addPeopleType`.
3. Paste the full contents of `addPeopleType.gs` from this repo. Save (Ctrl+S).
4. Function dropdown -> select `addPeopleType` -> Run. Approve auth on first run.
5. Watch for the Sheet toast: "Type column ready. N subs tagged, M set to Contact."

CHECK: PEOPLE tab has a `Type` column (col 10). Arnold = Sub (Role Electrician),
Josh Burleson = Sub, Mauro Rodriguez = Sub, everyone else = Contact. Row 1 frozen.

(Optional) delete the `addPeopleType` script file after it runs — it is one-time.

---

## Phase 2 — Redeploy backend with a NEW version

1. Apps Script -> open the live `Code.gs`.
2. BEFORE overwriting: copy out the real `TOKENS` map and the `USERS` map (emails)
   from the current live `Code.gs` — you will paste them back in step 4.
3. Select all -> replace with the full contents of `Code_final.gs` from this repo.
4. Restore the real values that are `REDACTED_*` in the committed copy:
   - `TOKENS` map (top of file): the 4 real token strings.
   - `getSessionUser_` `USERS` map: the 4 real emails.
   DO NOT paste real tokens/emails into `Code_final.gs` in the repo (repo is public).
5. Save (Ctrl+S).
6. Deploy -> Manage deployments -> pencil (Edit) -> Version: New version -> Deploy.
   A plain Save does NOT go live. You MUST cut a New version. Exec URL stays the same.

CHECK: deploy succeeds, exec URL unchanged.

---

## Phase 3 — Verify (non-destructive)

Calling a new action with a fake id returns `{"error":"not found"}` if deployed,
or `{"error":"Unknown action: ..."}` if the redeploy did not take. No data mutated.

Run in Git Bash (paste the OWNER token locally; do not commit it):

```bash
EXEC='https://script.google.com/macros/s/AKfycbyT8H0cR4gzOOgRsqMULSkHTaClDWpEKq8p28T-pBtMwUIUEbk9H4nOGrGoE88DrR22pw/exec'
TOKEN='PASTE_OWNER_TOKEN'
curl -sSL -G "$EXEC" --data-urlencode "t=$TOKEN" --data-urlencode "action=updateTaskAssignee" --data-urlencode "id=__deploytest__" --data-urlencode "assignedTo=x"; echo
curl -sSL -G "$EXEC" --data-urlencode "t=$TOKEN" --data-urlencode "action=updatePersonType" --data-urlencode "id=__deploytest__" --data-urlencode "type=Sub"; echo
```

Both should print `{"error":"not found"}`.

Also confirm the migration: load the app URL with `?t=<owner>&v=<n>` and open the
People tab — persons should show a Type, and the assignee pickers on tasks should
now list Sub/Vendor people (Arnold etc.) in addition to the 4 crew.

---

## Phase 4 — Update docs, commit, push

Once verified, in CLAUDE.md move assignable subs from "Built + pushed but BACKEND
NOT YET DEPLOYED" to Live, drop the finished deploy item from the roadmap, then:

```bash
git add CLAUDE.md
git commit -m "Assignable subs: backend deployed + migration run (mark live)"
git push
```

(You can delete this checklist file in the same commit once it is done.)
