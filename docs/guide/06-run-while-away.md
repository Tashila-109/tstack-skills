# Run work while you are away

Some work runs for hours: a loop toward a target, a PR waiting on CI, a queue of changes.
This page covers handing that work off, the one grant autopilot needs, and reading what happened when you come back.

## A loop toward a checkable target

Autonomous run iterates until a predicate holds.
Give it the predicate and how to check it:

```text
$tstack get the flaky import test green on ten runs in a row. Run it autonomously and keep a decision log.
```

The lead writes the predicate to `evidence/predicate.md` before the first iteration, and logs one row per iteration to `evidence/decisions.tsv`.
It keeps changes that moved the predicate, reverts the ones that did not, and stops only when the predicate holds or it hits a genuine dead end.
It never relaxes the predicate to finish.

Hillclimb is the same loop for a number, such as startup time or bundle size.
It builds a measurement harness first and proves the harness can see the change, so a reported win is real.

## A PR that waits on CI and review

With PR delivery, the lead opens the PR ready and babysits it to merge-ready before it reports done.
It wakes on checks and reviews rather than polling:
- on T3, through `watch_pull_request`;
- on Herdr, through `gh pr checks --watch` in its pane.

It fixes conflicts first, then review threads, then CI.
It reruns a failed check once, and a second identical failure counts as a real failure.
It verifies each bot comment against the code before it changes anything, and never rewrites published history.
When the PR is merge-ready, main asks you whether to merge.

## A queue of changes

Hand main a list and pick the autopilot that matches who lands it.

```text
$tstack autopilot these three fixes. Merge each one when its verification is clean.
```

Autopilot-full asks you once which items, if any, stay for you to merge, and records your answer as its grant.
Each item gets its own lead and PR.
Main audits each lead's evidence, and merges the PRs the grant covers one at a time.

```text
$tstack build these four changes as a stack. I will land it.
```

Autopilot-stack builds the same leads into one chain of PRs, each on top of the last, and merges nothing.
You review the chain bottom up and land it, or ask main to land it with Shipping.

Say "stop" to main at any time.
Every lead holds: no more commits, pushes or workers until you release it.

## Read what happened

Each task's folder, `<project>/.tstack/tasks/<id>/`, holds the whole story:

| Path | What it tells you |
| --- | --- |
| `report.md` | What changed, how it was proved, and what is left |
| `evidence/` | Each step's file: the baseline, the predicate, the decision log, the babysit summary |
| `results/` | What each worker found, in its own words |
| `decisions/` | Each question the lead asked, and your recorded answer |

Start with `report.md`, then open the evidence it cites.
`evidence/decisions.tsv` shows every attempt in order, including the ones that were reverted.
