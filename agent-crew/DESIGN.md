# Hotel triage agent crew: design

Author: Nihal Vellaramkallingal Sulaiman ([@nihalunfc](https://github.com/nihalunfc)) · First recorded: 2026-11-05 · Status: design under review, nothing built yet

A multi-agent crew that watches the hotel data pipeline, works out why a check failed, fixes it in a safe dev copy, re-runs it in Dagster, checks the result, and tries again by itself until it passes or hits a limit. Then it hands a person a short report and a pull request to approve.

Three rules keep it cheap and safe:

- **Plain code does all the routine work.** Watching, collecting evidence, re-running Dagster, testing, logging and committing cost no tokens. A model is only called when judgment is needed.
- **The cheapest model goes first.** Claude Haiku 5.5 sorts each incident, Claude Sonnet 5.5 writes fixes, and Claude Opus 5.5 gets one try only when Sonnet fails twice. A small Python router picks the model for each step.
- **The Ledger records everything.** Every step is logged and committed, any step can be undone, and the original files are kept untouched with a fingerprint.

## Where we start

| Already in this repo | What the crew uses it for |
| --- | --- |
| `ai-workflow/skills/etl-triage/SKILL.md` | The Triager's instructions: the 7-rung evidence ladder and the 5 verdicts |
| `ai-workflow/CLAUDE.md` | Safety rules: production read-only, propose fixes, never send anything |
| `ai-workflow/tools/ro_sql.py` | The Collector's only way to query the warehouse |
| `ai-workflow/examples/triage_checks.sql` | Freshness, volume and completeness checks |
| `analytics/hbi/`, `analytics/build.py` | The pipeline: generate, stage, star schema, 10 quality checks, marts |
| `analytics/tests/` | Run by the Verifier after every fix |

- **Step 0: wrap the pipeline in Dagster.** Each build step becomes an asset and the 10 quality checks become asset checks, run locally with `dagster dev`.
- **Step 0b: a fault injector.** Breaks the pipeline in known ways (missing file, renamed column, late file, double load, empty source, revenue that doesn't tie out) and keeps an answer key, so verdicts, fixes and tokens per incident can be scored.

## The crew

| Role | Runs on | What it does | Tokens (est.) |
| --- | --- | --- | --- |
| Watcher | Code | Dagster sensor on failed runs and failed asset checks; opens an incident | 0 |
| Collector | Code | Evidence rungs 2-5 (run log, load history, MAX(date), landing folder) packed into a file capped at ~3K tokens | 0 |
| Memory | Code | Fingerprint (job + error type + message pattern); reuses an approved fix | 0 |
| Triager | Haiku 5.5 | One of the 5 verdicts plus confidence; low confidence goes to Sonnet | ~3K in, ~300 out |
| Fixer | Sonnet 5.5, then Opus 5.5 once | Only for "Real fault (ours)": a patch on a branch or a re-run plan | ~8K in, ~2K out per try |
| Gate | Code | Checks the action against the allow-list | 0 |
| Verifier | Code | Applies the fix in dev, re-materialises in Dagster, runs tests, quality checks and row counts | 0 |
| Ledger | Code | Logs and commits every step | 0 |
| Reporter | Haiku 5.5 | etl-triage report and PR description | ~4K in, ~800 out |

### Loop

1. Watcher opens an incident; Collector builds the evidence file.
2. Memory checks the fingerprint. Known fix: skip to step 5.
3. Triager gives a verdict. Source gap, manual step missed and false alarm go to the Reporter with a drafted note for the owner.
4. Real fault: the Fixer proposes a change.
5. Gate: run in dev now, or wait for a person.
6. Verifier re-runs and tests. Pass: go to the Reporter.
7. Fail: test output goes back to the Fixer. Sonnet 2 tries, Opus 1, then stop and hand over the full trail.
8. Ledger commits after every step. Reporter opens a PR; Memory saves the fingerprint once it is merged.

Budget cap per incident: 3 loops, 40,000 tokens or $0.50, whichever comes first.

## Automatic model switching

A Python router (`router.py`) calls the Claude API and picks the model per step. Claude Code keeps one main model per session and does not step down by itself, so the unattended loop uses the API; for interactive work the same roles can live in `.claude/agents/` as subagents with their own `model:` setting (verify against current Claude Code docs at build time).

| Step | First choice | Step up when | Step-up model |
| --- | --- | --- | --- |
| Triage | Haiku 5.5, low effort | Confidence < 0.7 or contradictory evidence | Sonnet 5.5 |
| Fix | Sonnet 5.5, medium effort | Verifier fails twice | Opus 5.5, once |
| Report | Haiku 5.5 | Never | None |

Token savers: prompt caching for the fixed instructions, evidence files instead of raw logs, structured JSON outputs, Batch API (50% off) for nightly reports, and fingerprint memory.

## Ledger

- Originals copied to `incidents/<id>/raw/`, read-only, with SHA-256 fingerprints. Nothing writes to `raw/`.
- A step never edits in place; it writes a new file version.
- One line per step in `ledger.jsonl`: time, agent, model, input/output hashes, change, tokens, cost, approver.
- One git commit per step on `crew/incident-<id>`, never on main.
- `ledger revert <step>` runs `git revert` on that commit and logs it. `ledger restore` puts the originals back from `raw/` and checks the hashes.

Worst case: delete the branch and nothing happened.

## Safety gate

| Action | Who decides |
| --- | --- |
| Re-run a failed partition in dev (idempotent) | Crew |
| Re-run after a late file arrives, in dev | Crew |
| Try a code patch on the incident branch in dev | Crew |
| Merge a code change into main | Person, via PR |
| Change a quality-check rule or quiet a check | Person |
| Anything outside dev, deleting data, messaging anyone | Never; drafted for a person |

## Cost (estimates until measured)

Prices per million tokens (input / output): Haiku 5.5 $0.10 / $0.50, Sonnet 5.5 $2 / $10, Opus 5.5 $4 / $20.

| Incident type | Models | Est. cost |
| --- | --- | --- |
| Known error | None | $0 |
| Source gap, manual step, false alarm | Haiku + Haiku | ~$0.001 |
| Real fault, first try | + Sonnet once | ~$0.04 |
| Real fault, every try | + Sonnet ×2 + Opus ×1 | ~$0.20-0.25 |

Build: ~200 practice incidents, ~$3-6. Running: ~30 incidents/month, under $2. Dagster OSS, Python and GitHub are free. Time: ~16 sessions of 2-3 hours.

## Milestones

1. Dagster wrap (3 sessions): whole graph green in `dagster dev`.
2. Fault injector (2): six faults, each turns the right check red.
3. Watcher, Collector, Ledger (3, no model): incident folder, evidence, `raw/` with hashes, one commit per step.
4. Triager on Haiku (2): scored against the answer key.
5. Fixer, Gate, Verifier loop (4): a renamed-column fault fixed and verified in dev unaided.
6. Memory and Reporter (2): repeat fault costs $0; every incident ends in a report and PR.

## Reuse

Clone, `pip install`, `dagster dev`, run the fault injector, set `ANTHROPIC_API_KEY`. All data is generated sample data.
