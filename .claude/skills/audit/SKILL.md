---
name: audit
description: Read-only project consistency audit — run after parallel work streams merge to confirm the repo is in a coherent state. Checks git state, the full test suite, docs drift, dependency-file sync, strategy registry ↔ decision-memory parity, and issue/PR lifecycle, then reports a pass/fail table plus any maintainer judgment calls. Use when the user asks to "audit the project", "check everything is up to date", "is the repo consistent", or after merging several branches.
---

The `/audit` skill runs a **read-only** consistency audit of the Kill Team
simulator and reports a pass/fail table. It is the companion to `/docs`: where
`/docs` surfaces the reader-facing pages, `/audit` verifies the whole repo is in
a coherent state after parallel work streams have landed.

**This skill never commits, pushes, or mutates source.** It only reads, runs
tests, and regenerates *generated* artifacts to compare against what is committed
(a non-empty diff is a finding, not a fix). The genuine judgment calls it
surfaces — promoting a challenger to champion, whether a regenerated case study
still teaches its lesson, whether a PRD umbrella should close — stay with the
coordinator/maintainer. The audit **reports and flags**; it does not decide.

For the broad codebase-scan checks (steps 5–6) you may dispatch a **read-only
`Explore` agent** to fan out, but the coordinator owns the final table.

## Steps

Run the checks below. Most are independent — batch the shell commands in
parallel where possible. Collect results into the final table (step 7).

1. **Git state.**
   ```bash
   git -C /home/user/Pmkt_simulator status --short                 # expect empty (clean tree)
   git -C /home/user/Pmkt_simulator branch --show-current
   git -C /home/user/Pmkt_simulator rev-list --left-right --count origin/main...HEAD
   ```
   PASS = clean working tree and the working branch is not behind `origin/main`
   (0 behind; ahead is fine if there is unpushed work in progress). A stale local
   `main` checkout is a cosmetic note, not a failure.

2. **Full test suite** (including slow tests — an audit is a pre-release-grade
   check, so do **not** skip the slow markers):
   ```bash
   cd /home/user/Pmkt_simulator/Pmkt_simulator && uv run python -m pytest -m "" -q
   ```
   This takes a few minutes (slow tests run subprocess duels). Run it in the
   background and wait for completion. PASS = exit 0, no failures (skips/xfails
   are fine). Always use `uv run python -m pytest`, never bare `pytest`.

3. **Docs drift + generated-doc currency.** Regenerate the index, run the drift
   guard, and confirm the regeneration produced **no** git diff:
   ```bash
   cd /home/user/Pmkt_simulator/Pmkt_simulator && uv run python html_viewer.py --rebuild-all
   cd /home/user/Pmkt_simulator/Pmkt_simulator && uv run python -m pytest tests/test_docs_drift.py -q
   git -C /home/user/Pmkt_simulator status --short docs/ Pmkt_simulator/docs/
   ```
   PASS = drift guard green AND the rebuild leaves no diff (committed docs are
   current). A diff means generated docs were committed stale — flag it and offer
   to commit the regenerated output (do not commit as part of the audit).

4. **Dependency-file sync** (workflow rule #1). The two `requirements.txt`
   (repo root + `Pmkt_simulator/`), `packages.txt`, and `pyproject.toml`
   `[project].dependencies` must agree:
   ```bash
   diff /home/user/Pmkt_simulator/requirements.txt /home/user/Pmkt_simulator/Pmkt_simulator/requirements.txt
   ```
   PASS = the two `requirements.txt` are identical, `pyyaml` is in both,
   `libyaml-dev` is in `packages.txt`, and `pyproject.toml` lists the same base
   deps. (`torch` lives only in the `rl` optional extra — it must NOT appear in
   either `requirements.txt`.) Also confirm `uv.lock` is committed and current
   (`uv lock --locked` exits 0 if it is up to date).

5. **Strategy registry ↔ decision-memory parity** (workflow rule #7). The
   registry is the source of truth for *what* the strategies are; the memory is
   the source of truth for *why* the ranking is what it is — they must not drift:
   ```bash
   cd /home/user/Pmkt_simulator/Pmkt_simulator && uv run python -c "
   from pmkt_simulator.engine import strategies as S
   print('CHAMPION =', S.CHAMPION)
   for e in S._ENTRIES: print(f'{e.name:16} {e.family:10} {e.role}')
   "
   ```
   Cross-check every registry entry's `(name, family, role)` against the ladder
   table in `.claude/strategy-memory/DECISIONS.md` and confirm each family has a
   memory file (`baseline.md`, `search.md`, `rl.md`, …). PASS = every champion/
   challenger in the registry has a corresponding memory entry and vice-versa.

6. **Issue / PR lifecycle** (workflow rule #6). Use the GitHub MCP tools
   (load via ToolSearch). Confirm:
   - no open PR is actually merged-but-unclosed;
   - no open issue describes work that is already delivered (cross-check open
     issue titles against CLAUDE.md / the code). PRD **umbrella** issues
     legitimately stay open until every child slice merges — list these as
     "verify children", not as failures.
   PASS = no clearly-delivered issue left open; flag the doubtful ones for the
   maintainer to triage.

7. **Report the table.** Emit a single pass/fail table (one row per check above)
   plus a short **"maintainer judgment calls"** list for anything that needs a
   human decision (a stale generated artifact to commit, an issue that looks done,
   a registry/memory mismatch). State the test-suite numbers explicitly
   (`N passed, M skipped, K xfailed`). Do **not** commit, push, or close issues as
   part of the audit — offer to, and let the coordinator drive each fix.
