# AI Workflow: Claude Code for safe BI work

How I use Claude Code as a BI developer on a live data platform: fast investigation, with no risk to production.
Everything here is generic and works on any SQL Server, Azure SQL or SQLite warehouse.

| File | What it does |
| :-- | :-- |
| [CLAUDE.md](CLAUDE.md) | Hard rules for the agent: production is read-only, SELECT-only SQL, never rerun jobs or send messages, never show secrets, and fixes are written as proposals that a person reviews |
| [skills/etl-triage](skills/etl-triage/SKILL.md) | A repeatable method for pipeline warnings: snapshot the monitor, carry forward old verdicts, look for problems hidden in green checks, climb a seven-rung evidence ladder, give one of five verdicts, and write a two-page report |
| [skills/session-handoff](skills/session-handoff/SKILL.md) | Turns each work session into a cleaned handoff note, so every fix becomes reusable knowledge |
| [tools/ro_sql.py](tools/ro_sql.py) | A read-only SQL runner. It refuses anything but a single SELECT or WITH, opens SQLite read-only, always rolls back, and reads the connection string only from the environment. Tested in [analytics/tests/test_ro_sql.py](../analytics/tests/test_ro_sql.py) |
| [examples/triage_checks.sql](examples/triage_checks.sql) | Freshness, volume and completeness checks against this repository's demo warehouse |

## Try it on the demo warehouse

```bash
pip install -r analytics/requirements.txt
python analytics/build.py
python ai-workflow/tools/ro_sql.py ai-workflow/examples/triage_checks.sql --sqlite data/generated/warehouse.sqlite
```

## The five triage verdicts

| Verdict | Meaning |
| :-- | :-- |
| Real fault (ours) | Our job, schedule or code broke |
| Source gap | The pipeline is fine, but the source sent nothing |
| Manual step missed | A person's export or file drop did not happen |
| False alarm | The data is right; the check's rule cannot see why |
| Not yet checked | Not investigated yet, and said so honestly |

Next step: run the same checks against a cloud warehouse (Azure SQL Database) as part of a scheduled ETL pipeline.
