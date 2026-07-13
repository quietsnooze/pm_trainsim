---
name: update-docs
description: Bring ALL project knowledge + generated artifacts current with the code, then leave the repo PR-ready. Updates CLAUDE.md and the knowledge files (README, docs/rules/*.md, the three hand-authored explainers, team-doc interpretations, .claude/strategy-memory), regenerates the docs site, case studies and battles, and reviews/closes delivered GitHub issues. Use when the user asks to "update/refresh the docs" or "make everything current", when **preparing a PR** (run it before opening/marking ready), and after **creating or changing a document, rules file, case study, battle, scenario, strategy, or team** so docs never drift. The companion to /audit (read-only check) and /docs (surface reader pages) — this skill is the one that actually mutates and commits.
---

The `/update-docs` skill makes **everything that describes or is generated from
the code current with the code**, then leaves the working tree PR-ready. It is
the **mutating** counterpart to the two read/surface skills:

- **`/audit`** — read-only: *detects* drift and reports a table. Never mutates.
- **`/docs`** — surfaces the four reader-facing pages in chat. Doesn't update knowledge.
- **`/update-docs`** (this) — *fixes* drift end-to-end: edits the hand-authored
  knowledge, regenerates every artifact, reconciles GitHub issues, commits, and
  (when preparing a PR) pushes + opens/updates a draft PR.

It honours the standing maintainer rules: **keep artifacts current, do NOT
curate** case-study outcomes to chase a 50/50 (PROJECT_LOG note), **never
auto-promote** a strategy to champion (workflow rule #7), and **never close a PRD
umbrella** issue until every child slice has merged (workflow rule #6).

All paths are relative to the repo root `/home/user/Pmkt_simulator`; the package
lives under `Pmkt_simulator/`. Run Python from the package dir
(`cd /home/user/Pmkt_simulator/Pmkt_simulator`) and always use
`uv run python -m pytest`, never bare `pytest`.

---

## Step 0 — Scope the run from what changed

Don't guess; read the diff. Determine what this run must touch:

```bash
git -C /home/user/Pmkt_simulator status --short
git -C /home/user/Pmkt_simulator diff --stat $(git -C /home/user/Pmkt_simulator merge-base origin/main HEAD)..HEAD
```

Map changed areas → knowledge files that must be hand-edited (Step 1) and
generators that must be re-run (Step 2). If nothing in the diff touches a given
area, skip its hand-edit but **still** run the generators + currency checks
(cheap, and catches pre-existing drift).

**Discover artifacts dynamically** so this skill stays current as new files are
added (this is how it "keeps itself current" — never hardcode the list):

```bash
ls Pmkt_simulator/docs/*_explainer.html                         # hand-authored explainers
ls Pmkt_simulator/docs/rules/*.md                               # per-subsystem rules
ls Pmkt_simulator/data/case_studies/*.json \
   Pmkt_simulator/data/case_studies/challenger/*.json \
   Pmkt_simulator/data/case_studies/battles/*.json              # teaching / challenger / battles
ls Pmkt_simulator/data/scenarios/*.yaml                         # scenarios (incl. battle_*.yaml)
ls Pmkt_simulator/pmkt_simulator/data/team_docs/*.yaml          # team-doc interpretations
ls .claude/strategy-memory/*.md                                 # decision memory
```

---

## Step 1 — Hand-authored knowledge (review & edit; needs judgment)

These are **not** generated — read them against the change and edit what drifted
(workflow rule #3). A generator can't write these for you.

- **`Pmkt_simulator/CLAUDE.md`** — the developer guide. Update the module map,
  the "Kill Team rules implemented" list, the policy table, the Key-data-classes
  notes, and the workflow rules whenever the architecture, rules model, CLI, or
  process changed. **If this run added a new kind of artifact, generator, shelf,
  or skill, document it here** (and in Step 7 update this skill too).
- **`Pmkt_simulator/README.md`** — user-facing overview/CLI. Update when the CLI
  or headline behaviour changed.
- **`Pmkt_simulator/docs/rules/*.md`** (indexed by `rules/index.md`) — when a
  **game rule** changed, edit the matching subsystem file (board-and-terrain,
  activation, actions, combat, objectives-and-orders, teams-and-weapons,
  equipment).
- **The three hand-authored explainers** under `Pmkt_simulator/docs/` — edit when
  the matching subsystem changed; `tests/test_docs_drift.py` enforces they track
  the code:
  - `agent_logic_explainer.html` — `SearchPolicy` search/rollout/reward, the Φ
    potential in `state_helpers`, rollout policies, melee maximin, and §11's RL agent.
  - `activation_order_explainer.html` — initiative, the turn schedule,
    `choose_activation`/`activation_value`, Counteract.
  - `deployment_explainer.html` — `plan_deployment` / `killzone` deployment.
- **Team-doc interpretations** `pmkt_simulator/data/team_docs/<team>.yaml` — when
  what the engine models for a team changed (the ✓/◑/✕ status or `sim:` prose).
- **`.claude/strategy-memory/`** (per-family file + `DECISIONS.md` index) — when a
  strategy was added, promoted, demoted, or tuned (workflow rule #7). **Promotion
  to champion is a maintainer call — record the verdict; never decide it here.**

If you edit an explainer, keep its worked examples consistent with the current
defaults, and preserve the tokens the drift guard asserts (board dims, constants,
`plan_deployment`, "round-robin", "Conceal", etc.).

---

## Step 2 — Regenerate every generated artifact

Run only the generators whose inputs changed (per Step 0), but when in doubt run
them all — they are byte-reproducible, so a no-op regen leaves no diff.

- **Canonical team data** (only if the KT24 dump / transform changed):
  ```bash
  cd /home/user/Pmkt_simulator/Pmkt_simulator && uv run python kt24_transform.py
  ```
- **Case studies + battles + per-study HTML + index** (after any engine, data,
  scenario, or trace-output change). This regenerates JSON artifacts and rebuilds
  the docs pages at the end:
  ```bash
  cd /home/user/Pmkt_simulator/Pmkt_simulator && uv run python regen_case_studies.py --html --workers 4
  ```
  This is the slow one (battles run at `search_iter=400`). Run it in the
  background and wait for completion. Battle outcomes are **kept current, not
  curated** — do not rebalance to chase 50/50.
- **Docs index + explainer links** (sufficient on its own if you only edited
  hand-authored docs and did NOT regenerate case studies):
  ```bash
  cd /home/user/Pmkt_simulator/Pmkt_simulator && uv run python html_viewer.py --rebuild-all
  ```
- **Team reference docs** (only if a `team_docs/<team>.yaml` or team data changed):
  ```bash
  cd /home/user/Pmkt_simulator/Pmkt_simulator && uv run python team_doc.py --all
  ```

---

## Step 3 — Verify currency & drift (must be green before committing)

```bash
cd /home/user/Pmkt_simulator/Pmkt_simulator && uv run python -m pytest tests/test_docs_drift.py tests/test_html_viewer.py tests/test_model_icons.py -q
```

Then confirm a re-run of the generators leaves **no** diff beyond what this run
intends (byte-reproducibility):

```bash
git -C /home/user/Pmkt_simulator status --short Pmkt_simulator/docs/ Pmkt_simulator/data/
```

Run the **test suite** matching the blast radius (workflow rule #4): the fast
suite always; the **slow** suite when the change touched `engine/policy.py`,
`trace_viewer.py`, `engine/actions.py` action singletons, or
initiative/activation (it also catches stale committed-artifact outcomes — a
brittle smoke test that loads a refreshed artifact may need its expected
numbers updated to the current deterministic result, which is "kept current, not
curated", not a regression).

```bash
cd /home/user/Pmkt_simulator/Pmkt_simulator && uv run python -m pytest -q          # fast
cd /home/user/Pmkt_simulator/Pmkt_simulator && uv run python -m pytest -m slow -q   # when in blast radius
cd /home/user/Pmkt_simulator/Pmkt_simulator && uv run ruff check .
```

---

## Step 4 — GitHub issues & PRs (review and close what's delivered)

Use the GitHub MCP tools (load via ToolSearch; scope is `quietsnooze/pmkt_simulator`).
Workflow rule #6 — issues must reflect reality:

- The delivering PR for a tracked issue must carry `Closes #N` in its body so the
  issue auto-closes on merge. Add it if missing.
- **Close** any open issue whose work is already delivered (cross-check open
  issue titles against the code / CLAUDE.md). Tick acceptance criteria.
- **PRD umbrella** issues: post a brief progress note and check off merged
  slices, but **only close the umbrella once every child slice has merged** —
  never close it early. HITL slices with no PR are closed by the maintainer; flag
  them so they aren't forgotten.
- Do not open new issues here unless the run genuinely surfaced undelivered work.

If an issue's status is ambiguous, **flag it for the maintainer** rather than
closing it.

---

## Step 5 — Commit

Stage and commit the knowledge edits + regenerated artifacts together with a
clear message describing what was brought current. If on the default branch,
branch first. Commit only when Step 3 is green.

```bash
git -C /home/user/Pmkt_simulator add -A
git -C /home/user/Pmkt_simulator commit -m "Docs/artifacts: bring <area> current with <change>"
```

---

## Step 6 — When preparing a PR

If this run is part of preparing a PR (the user said so, or you're about to open
one):

1. `git push -u origin <branch>` (retry on network error with backoff).
2. Create the PR as a **draft** if none exists (or update the existing one). Check
   for a PR template (`.github/pull_request_template.md` etc.) and mirror its
   headings; otherwise write a normal body. Reference issues with `Closes #N`.
3. Surface the reader-facing pages if useful (delegate to `/docs`, or send the
   specific regenerated case-study / battle HTML the change affected).

Do **not** merge — merging is the maintainer's call.

---

## Step 7 — Keep this skill current (self-maintenance)

This skill stays accurate for *individual* new files automatically because Step 0
discovers them by glob. But if this run introduced a **new category** that the
globs/generators above don't cover — a new docs shelf, a new generator script, a
new hand-authored explainer, a new rules-doc subsystem, a new knowledge file, or
a new skill — then **edit this `SKILL.md`** (add the path/command to the relevant
step) and the **CLAUDE.md skills list** in the same run, so the next invocation
covers it. A skill that doesn't update itself is how drift starts.

---

## Final report

Tell the user, concisely:

- which hand-authored knowledge files you edited and why;
- which generators you re-ran and whether the regen produced a diff;
- test/lint results (state the numbers: `N passed, M skipped`);
- which issues you closed / flagged;
- whether the branch was pushed / a draft PR opened or updated.
