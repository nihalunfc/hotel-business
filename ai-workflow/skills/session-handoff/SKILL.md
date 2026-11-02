---
name: session-handoff
description: Use when I say a session is done, closed, paused or on standby: write or update a handoff file in learning/_inbox that captures what was done and learned, for turning into lessons later.
---

# Session handoff

Capture the session's work so it can become a lesson. Change no other files.

1. **Find an existing handoff** in `learning/_inbox/handoff-*.md` with the same `Session:` line.
   - None: create `handoff-YYYY-MM-DD-<three-word-topic>.md` with `Handoff version: 1`, `Built version: 0`.
   - Same topic, reopened: edit in place, add 1 to `Handoff version`, add a line to `## Revision log`.
   - Different topic: new file with a `Related:` line.
2. **Gather** from the whole session: the problem, what was tried, what worked, the cause, the fix
   (proposed or applied, by whom), commands and queries used, and open questions. Mark guesses.
3. **Write** these sections: Summary · Problem · Steps taken · Cause · Fix · Concepts learned ·
   Gotchas · Evidence (paths, line ranges, commits, timestamps) · Open questions · Revision log.
4. **Clean it.** No secrets, server names, internal URLs or people's names. Change real numbers.
   Copy code or queries that exist only in the chat into `handoff-...-files/`.
