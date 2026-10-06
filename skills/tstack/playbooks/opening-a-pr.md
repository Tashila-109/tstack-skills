### Opening a PR

Invoked at the end of every other playbook.

**In tstack.** The lead runs this in its task worktree, on branch `task/<id>`, and never merges.
Every delivery mode runs the cleanup in **PRs** below: the router's before-commit cleanup, `/no-comments`, `/technical-writing` and `/unslop` on the commit bodies.
`/no-comments` runs Comment Sicko as a worker, with its result at `results/comment-sicko.md`.
Record the cleanup in `evidence/closing-pass.md`, one line per changed file with its verdict and any fix.
The calling step names that artifact.
- `local-only` delivery stops after **Commits** and the cleanup: no push and no PR. The clean branch is the deliverable, and main merges it on the human's word.
- `pr` delivery pushes `task/<id>`, opens the PR ready against the default branch, or against the parent branch in an autopilot stack, then babysits it in `drive` mode to merge-ready, as [Babysit](babysit.md) says, and writes `evidence/babysit.md`, which `check` requires. Report done to main, with the PR's full URL and its head SHA, only once the PR is merge-ready: ending a turn to wait for watch-pr is not done. Main merges on the human's word.

**Worktree.** Work from the task's worktree off main. Workers share it. Two writers on the same branch each get their own checkout through the runtime reference. Dirty branch with unrelated work: patch out, fresh worktree, apply. Snarled worktree: reset from main, redo minimally.

**Commits.** Commit liberally. Rebase into small, ordered commits before opening PRs. Each commit is a future PR: landable, ordered to tell the story. Amend when the fix belongs in a just-made commit. New commit when separable.

**PRs.** Run the router's before-commit cleanup over the diff. Run `/no-comments` before review. Write every PR title, PR description, and commit body with `/technical-writing`, then apply `/unslop`. Apply every technical-writing layer except Diátaxis. Use one word for each action, keep articles, and avoid `-ing` when a plain verb works.

**Titles.** Use Conventional Commits in the form `type(scope): subject`. Use `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, or `perf` as the type. Use the changed area, such as `tstack` or `how`, as the scope. Keep the subject short and imperative. Name a real symbol when one carries the change. For example, `fix(tstack): retarget the opening-a-pr babysit trigger`. Do not add a trailing period.

**Descriptions.** The PR body is a briefing, not the lab notebook. A reviewer who has the diff should learn why the change exists, what it leaves out, what it could break, and how you proved it works, in under a minute. Write short, simple sentences with few identifiers. Do not write walls of text. The squash commit body is the PR body. If the body would make the squash commit longer than about 40 lines, cut the body.

Put each section under a `##` heading, not a bold lead-in, so the sections stand apart. Use these sections in order. Drop a section when it has nothing to say.

- `## Why` gives the problem and the approach in one to three short sentences. Do not list SHAs or rebase genealogy. Do not add a "based on main" preamble.
- `## What changed` has one to three short bullets. Name a real symbol or path only when it carries the change. Name both sides of a rename or retarget.
- `## Scope` always names what the PR covers and what it deliberately leaves out, for example a related follow-up or a known gap. Use one to three short items. Do not list symbols or paths, and do not write a file-by-file essay.
- `## Tradeoffs` names only rejected alternatives that a reviewer would otherwise ask about. Skip this section when there was no real choice.
- `## Blast Radius` gives one or two sentences on who or what the change touches and why that is safe or risky. If main is red, state the cost of leaving it red.
- `## Verification` has one to three bullets. Each bullet names a real run path and its outcome. For a performance change, report one primary number with its unit in `before → after` form. Link the arena or swarm directory for the remaining evidence. Do not include sample-size methodology, swarm recitals, or metric tables.

After these sections, attach videos or screenshots when they prove a claim. Do not paste full SHAs, swarm or arena lane recitals, lever-correction essays, file-by-file checklists, or "CLEAN" verdicts. Put these details in a linked artifact. A commit body does not restate its subject.

**Forge.** Use the GitHub CLI, `gh`, for create, edit, view, watch, and merge. Do not require Graphite (`gt`).

**Built-in PR tool.** When the run provides a built-in PR tool, create, edit, retarget, and mark ready through it, never through a forge CLI. Its own instructions say how. A PR made with the CLI misses what the tool tracks, such as a description later runs can edit. Use the resolved forge for everything the tool does not cover, and for every PR operation when the run has no such tool.

**Size and stacks.** Prefer five narrow PRs to one large PR. A stack is a base-branch chain. The root PR targets trunk. Each child branch rebases onto its parent's exact tip and its PR targets the parent branch. Without a built-in PR tool, create a child with `gh pr create --base <parent-branch>`, and retarget an existing child with `gh pr edit <pr> --base <parent-branch>`. Branch from trunk only for independent work. Rebase on trunk before substantial stack work.

**Readiness.** Open every PR ready, never as a draft. A built-in PR tool can default to draft, so set `draft: false` on every creation call through it. With `gh`, omit `--draft`. If a PR still opens as a draft, mark it ready through the PR tool, or run `gh pr ready <number>`. Run `gh pr view <number>` before you refer to PR status.

**Babysit.** In tstack a task delivers one PR, and the `pr` delivery line above says when its lead babysits it. Push back when feedback drifts from intent.

Only the lead opens a PR. It runs `interrogate` when the design is contested, the before-commit cleanup, and `/no-comments` first, then babysits it as the `pr` delivery line says.
