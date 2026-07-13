---
name: prd-to-issues
description: Break a PRD into independently-grabbable GitHub issues using tracer-bullet vertical slices. Use when user wants to convert a PRD to issues, create implementation tickets, or break down a PRD into work items.
---

# PRD to Issues

Break a PRD into independently-grabbable GitHub issues using vertical slices (tracer bullets).

> **Tooling:** use whichever GitHub interface this environment provides — the
> `gh` CLI on a local machine, or the GitHub MCP tools (`mcp__github__*`) in a
> remote/web session where `gh` is unavailable. The `gh` commands below are
> illustrative; substitute the equivalent MCP call when `gh` is not present.

## Process

### 1. Locate the PRD

Ask the user for the PRD GitHub issue number (or URL).

If the PRD is not already in your context window, fetch it with `gh issue view <number>` (with comments).

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code.

### 3. Draft vertical slices

Break the PRD into **tracer bullet** issues. Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

Slices may be 'HITL' or 'AFK'. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
</vertical-slice-rules>

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices (if any) must complete first
- **User stories covered**: which user stories from the PRD this addresses

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Are the correct slices marked as HITL and AFK?

Iterate until the user approves the breakdown.

### 5. Create the GitHub issues

For each approved slice, create a GitHub issue using `gh issue create`. Use the issue body template below.

Create issues in dependency order (blockers first) so you can reference real issue numbers in the "Blocked by" field.

<issue-template>
## Parent PRD

#<prd-issue-number>

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation. Reference specific sections of the parent PRD rather than duplicating content.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- Blocked by #<issue-number> (if any)

Or "None - can start immediately" if no blockers.

## User stories addressed

Reference by number from the parent PRD:

- User story 3
- User story 7

</issue-template>

During issue creation, do NOT close or modify the parent PRD issue — only create
the child slices. (Updating the parent PRD as work lands is covered in Step 6.)

### 6. Track and close as work lands

Issues must reflect reality. A merged slice with a still-open issue is a bug in
the workflow.

**Child slice issues** — the PR that implements a slice MUST reference it with a
closing keyword (`Closes #<slice-number>`) in the PR body, so GitHub auto-closes
the slice on merge to the default branch. Tick the slice's acceptance criteria as
they are satisfied.

**Parent PRD issue** — do NOT rely on auto-close (a PRD is closed by *many* PRs,
not one). Instead:

- As each child slice merges, post a brief progress note on the parent PRD and
  check off that slice in a tracking checklist.
- Close the parent PRD only once **every** child slice has merged.
- For HITL slices that have no PR (e.g. "enable GitHub Pages", "on-device design
  review"), the maintainer closes them by hand once done — flag them in the
  progress note so they are not forgotten.

Never leave merged work behind an open issue that no longer reflects it.
