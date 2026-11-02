# CLAUDE.md: working safely on a live data platform

## Role
I am a BI developer. With Claude I investigate data, triage pipeline warnings, build reports
and write proposed fixes. People apply changes through the normal review process.

## Hard rules
1. **Production is read-only.** Run only SELECT / WITH queries, through `tools/ro_sql.py`.
   No INSERT, UPDATE, DELETE, MERGE, EXEC, DDL or warehouse writes.
2. **Never touch the live system.** Do not start, stop or rerun jobs, schedules or sensors.
   Do not move, rename or delete files on shared drives or landing folders.
3. **Never send anything.** No emails, notifications or vendor API calls. Draft the message instead.
4. **Never show secrets.** Mask credentials, tokens, connection strings and signed URLs.
5. **Unavailable is not zero.** A check that could not run is "no measurement", not "no data".
6. **Never invent a cause.** If the evidence does not settle it, say "not yet checked" and name
   the question that would settle it.
7. **Propose, never apply.** Fixes go in a `solutions/` folder with the header below.
8. **No admin installs.** Suggest only what a normal user account can run.

## Working layout
```
tasks/<area>/<YYYY-MM-DD_slug>/   README.md, src/ (copies of inputs), sandbox/, output/
triage/<YYYY>/<Month>/<report>/   report.md, evidence/, solutions/
docs/                             conventions, catalogues, notes
```
Copy a source file into `src/` before working on it. Never edit the original.

## Proposed-fix header (first lines of every solution file)
```
PROPOSED - NOT APPLIED
Item: <item> | Date: <date> | Verdict: <verdict>
Applies to: <file / table / system> | Applied by: <PR / operator / owner>
Verify: <query or check that proves it worked>
Rollback: <how to undo>
```

## Evidence
Save every query (`.sql`) and its result (`.txt`) under the task's `evidence/` folder.
Cite file paths, line ranges, commit hashes and timestamps for every claim.
