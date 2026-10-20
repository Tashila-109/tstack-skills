### Opening a PR

Invoked at the end of every other playbook.

**In tstack.** The lead runs this in its task worktree, on its task branch, and merges only at the router's Finish, on the human's word.
Every delivery mode runs the cleanup in **PRs** below: the router's before-commit cleanup, `/no-comments`, `/technical-writing` and `/unslop` on the commit bodies.
`/no-comments` runs Comment Sicko as a worker, with its result at `results/comment-sicko.md`.
Record the cleanup in `evidence/closing-pass.md`, one line per changed file with its verdict and any fix.
Then run the **Cross-model review** below.
The calling step names both artifacts.
- `local-only` delivery stops after **Commits**, the cleanup and the review: no push and no PR. The clean branch is the deliverable, and the lead merges it at the router's Finish, on the human's word.
- `pr` delivery pushes the task branch, opens the PR ready against the default branch, or against the parent branch in an autopilot stack, then babysits it in `drive` mode to merge-ready, as [Babysit](babysit.md) says, and writes `evidence/babysit.md`, which `check` requires. Go on to the router's Finish, with the PR's full URL and its head SHA, only once the PR is merge-ready: ending a turn to wait for watch-pr is not done.

**Cross-model review.** One reviewer from another model family reads the final diff before the branch leaves the worktree.
Skip it when `evidence/reviews/final.md` already names `HEAD` as its reviewed head, as a calling playbook's final `two-axis-review` does.
- Rebase per **Commits**, commit everything, and record the base and head SHAs.
  Nothing writes in the checkout until the reviewer is collected.
- Run `tstack.mjs seat review --runtime <runtime> --cross <your model ID>`.
  It prints the first `review` seat outside your model's family, so a Claude lead gets a GPT reviewer and a GPT lead gets a Claude reviewer.
- Write the brief to `briefs/review-final.md`: the checkout, the base and head SHAs with the `git diff <base>...<head>` command, the task's goal and finish as the spec, `AGENTS.md` and what it points at as the standards, and the line `Read <two-axis-review directory>/REVIEWER.md and review both axes.`, with the directory as an absolute path.
- Delegate one read-only worker on that seat, named `review-final`, with its result at `results/review-final.md`, as [dispatch](../references/dispatch.md) says.
- Decide each finding as [two-axis-review's step 7](../../two-axis-review/SKILL.md#7-act-on-the-findings) says, with this one reviewer in place of the two axes.
  A repair makes a new head, and the new head gets a fresh review.
- Write `evidence/reviews/final.md`: the reviewed head, the reviewer's seat and result path, its report, and your decision on each finding.
  The review is done when the recorded head is `HEAD` and no accepted Must is open.

**Worktree.** Work from the task's worktree off main. Workers share it. Two writers on the same branch each get their own checkout through the runtime reference. Dirty branch with unrelated work: patch out, fresh worktree, apply. Snarled worktree: start a fresh worktree off main and redo minimally, keeping the old branch until its work lands or the human drops it.

**Commits.** Commit liberally. Rebase into small, ordered commits before opening PRs. Each commit is a future PR: landable, ordered to tell the story. Amend when the fix belongs in a just-made commit. New commit when separable. Commit bodies don't restate the subject.

**PRs.** Run the router's before-commit cleanup over the diff before commit and `/no-comments` before review. Write every PR title, description, and commit body with `/technical-writing` (every layer except Diátaxis, and apply the STE vocabulary rules: one word per action, keep articles, a plain verb over `-ing` where one works), then apply `/unslop`.

**Titles.** Conventional Commits `type(scope): subject`, no trailing period. Type such as `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, or `perf`. Scope is the area, such as `tstack` or `how`. Subject is short, imperative, and names a real symbol when one carries the change, for example `fix(tstack): retarget the opening-a-pr babysit trigger`.

**Descriptions.** The PR body is a one-minute briefing, not a lab notebook, for a reviewer who has the diff. It says why the change exists, what it leaves out, what it could break, and how you proved it works. Write short, simple sentences with few identifiers, no walls of text. The body becomes the squash commit body, so keep that commit under about 40 lines. Use `##` headings, not bold lead-ins, in this order, and drop a section with nothing to say:

- `## Why`: the problem and approach, 1–3 short sentences. No SHAs, rebase genealogy, or "based on main" preamble.
- `## What changed`: 1–3 short bullets. Name a real symbol or path only when it carries the change. Name both sides of a rename or retarget.
- `## Scope`: always. 1–3 short items on what it covers and what it deliberately leaves out (a follow-up, a known gap). No symbols, paths, or file-by-file essay.
- `## Tradeoffs`: only rejected alternatives a reviewer would otherwise ask about. Skip when there was no real choice.
- `## Blast Radius`: 1–2 sentences on who or what it touches and why that is safe or risky. If main is red, state the cost of leaving it red.
- `## Verification`: 1–3 bullets, each a real run path and its outcome, taken from the task's `evidence/verify.md` when it has one. Perf: one primary number with its unit, `before → after`, and a link to the arena or swarm directory for the rest. No sample-size methodology, swarm recitals, or metric tables.

After the sections, attach videos or screenshots when they prove a claim. Full SHAs, swarm or arena lane recitals, lever-correction essays, file-by-file checklists, and "CLEAN" verdicts go in a linked artifact, not the body.

**Forge.** Use the GitHub CLI, `gh`, for create, edit, view, watch, and merge. Do not require Graphite (`gt`).

**PR tool.** Create, edit, retarget, and mark ready with `gh`, then link the PR to the thread as the runtime reference says, so the runtime tracks it.

**Size and stacks.** Prefer five narrow PRs to one large PR. In tstack a task delivers one PR, so split a large change into several tasks, stacked under [Autopilot-stack](autopilot-stack.md) when they are coupled. A stack is a base-branch chain. The root PR targets trunk. Each child branch starts from its parent's tip and its PR targets the parent branch. Create a child with `gh pr create --base <parent-branch>`, and retarget an existing child with `gh pr edit <pr> --base <parent-branch>`. As a parent merges, move its child onto trunk as [Shipping's Landing](shipping.md#landing) says. Branch from trunk only for independent work. Bring trunk and each parent in by merge, never by rebase, since a rebased pushed branch needs a force-push.

**Readiness.** Open every PR ready, never as a draft: omit `--draft`. If a PR still opens as a draft, run `gh pr ready <number>`. Run `gh pr view <number>` before you refer to PR status.

**Babysit.** In tstack a task delivers one PR, and the `pr` delivery line above says when its lead babysits it. Push back when feedback drifts from intent.

Only the lead opens a PR. It runs `interrogate` when the design is contested, the before-commit cleanup, `/no-comments` and the cross-model review first, then babysits it as the `pr` delivery line says.
