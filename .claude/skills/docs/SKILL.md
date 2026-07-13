---
name: docs
description: Regenerate and surface the three reader-facing explainer pages (agent logic, activation order, deployment) plus the case-study index in chat. Use when the user asks to see "the docs", "the explainers", the agent-logic / deployment / activation guide, or to regenerate/refresh the documentation site index.
---

The `/docs` skill surfaces the **reader-facing documentation** for the Kill Team
simulator in chat. Scope is exactly four files — the three hand-authored
explainers plus the generated index. It does **not** surface the case-study
pages or the developer decision memory (`.claude/strategy-memory/`).

The four files (under `Pmkt_simulator/docs/`):

- `agent_logic_explainer.html` — how the search agent decides (MCTS/UCB, reward + Φ, rollouts, melee maximin).
- `activation_order_explainer.html` — initiative, the turn schedule, choosing who activates, Counteract.
- `deployment_explainer.html` — how the agent deploys (split across objectives, hard cover on Conceal, blast spacing).
- `index.html` — the case-study index, whose "agents" list is auto-generated from the strategy registry.

## Steps

1. **Regenerate the index** so its registry-generated agent list is current
   (the three explainers are **hand-authored** — do not overwrite them; only the
   index is generated):

   ```bash
   cd Pmkt_simulator && uv run python html_viewer.py --rebuild-all
   ```

2. **Verify the explainers are not stale** by running the documentation drift
   guard:

   ```bash
   cd Pmkt_simulator && uv run python -m pytest tests/test_docs_drift.py -q
   ```

   If it **fails**, the explainers have drifted from the code. Do NOT surface
   stale docs — report which invariant drifted and offer to update the relevant
   explainer (workflow rule #3) instead.

3. **Surface the four files in chat** using the file-sending tool (one call,
   all four paths), reader-facing only:

   - `Pmkt_simulator/docs/agent_logic_explainer.html`
   - `Pmkt_simulator/docs/activation_order_explainer.html`
   - `Pmkt_simulator/docs/deployment_explainer.html`
   - `Pmkt_simulator/docs/index.html`

   Do **not** include the per-study pages (`docs/case_*.html`, `docs/challenger/`)
   or the developer decision memory — those are out of scope for `/docs`. (If the
   user wants a specific case study, regenerate and surface that page directly via
   the case-study runner / `html_viewer.py`, not this skill.)

4. Briefly tell the user what you surfaced and note that the explainers open
   offline in any browser (self-contained).
