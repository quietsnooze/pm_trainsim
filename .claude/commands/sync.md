Sync the local repo with the latest GitHub main branch and clean up stale worktrees and merged branches.

Run the following git commands in order:

1. `git fetch origin --prune` — fetch all remotes and prune stale remote-tracking refs
2. `git checkout main` — switch to main (or confirm already on main)
3. `git pull origin main` — fast-forward to latest
4. `git worktree prune` — remove stale worktree metadata for any worktrees whose directories no longer exist
5. `git worktree list` — show the remaining worktrees so the user can see what is left
6. `git branch --merged main | grep -v '^\*\? *main$'` — list local branches that are fully merged into main (candidates for deletion); show the list to the user and **ask for confirmation before deleting any branches**

Report the result of each step clearly. If anything fails (e.g. there are uncommitted local changes blocking the checkout), stop and explain what needs to be resolved first.
