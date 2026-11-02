---
name: etl-triage
description: Use when asked to triage pipeline or data-quality warnings: investigate each non-green check read-only, give one verdict per item with evidence, and write a short report with proposed fixes.
---

# ETL triage

The monitor says *what* looks wrong. Triage finds out *why*, and whether anyone must act.
The monitor's suggested cause is a hypothesis, not a verdict.

Follow every rule in `CLAUDE.md` (read-only, propose never apply, mask secrets).

## Procedure (same order every run)

1. **Snapshot.** Record the time and the counts: total, healthy, warning, failed, no run, unknown.
   List every non-green item, including report and audit checks.
2. **Carry forward.** Open the last report. Same item, same error type, nothing changed: reuse the
   verdict and mark it "carried forward from <date>". Items gone from the monitor go under
   "Resolved since last report". Items left "not yet checked" go first today.
3. **Look inside the green.** Healthy checks that hide a failed last run, a zero-row load on a feed
   that normally has rows, or a healthy report built on a warning feed.
4. **Group by root cause.** One upstream fault can turn several checks yellow.
5. **Investigate** each item, climbing only as far as needed:

| Rung | Question | Evidence |
| --- | --- | --- |
| 1 | What exactly does the monitor say? | Quote it |
| 2 | Did the job run, and what did it do? | Job log: rows read, inserted, warnings |
| 3 | What did the load record? | Load-history table, last 10-15 runs |
| 4 | Is the data current? | `MAX(date)` in the target table, per entity |
| 5 | Did the input arrive? | Landing folder vs archive: names, sizes, times |
| 6 | Did the source have activity? | Source system or export (campaigns, sales, sends) |
| 7 | What depends on it? | Downstream reports and dashboards |

6. **One verdict per item:**

| Verdict | Meaning | Usual next step |
| --- | --- | --- |
| Real fault (ours) | Our job, schedule or code broke | Named action for the platform owner |
| Source gap | Pipeline fine, source sent nothing | Ask the business owner; quiet or retire the check |
| Manual step missed | A person's export or file drop did not happen | Who exports what, into which folder |
| False alarm | Data is right; the check's rule cannot see why | Explain the blind spot; propose a rule fix |
| Not yet checked | Not investigated this run | First in the next run |

7. **Timing false alarms to rule out first:** the run is still going; the check ran before the
   job's window; the job is manual or sensor-triggered, not scheduled.
8. **Solutions** for every verdict that needs a change, in `solutions/<item>/`, with the
   proposed-fix header.
9. **Report**, at most ~900 words:

```markdown
# Data pipeline triage: <date>
**Status: ALL CLEAR | WARNINGS | ACTION NEEDED.** <N> checks: <g> green, <w> warning, <f> failed.

| Item | Verdict | Cause and next step (owner) | Investigated | Solution |
| --- | --- | --- | --- | --- |

## Resolved since last report
## Details (one short section per item: evidence, cause, fix, when it clears)
```

Re-running on the same day: move the old report to `previous-reports/report_v<N>.md` first.
Never overwrite.
