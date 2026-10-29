# Run work while you are away

Some work runs for hours: a loop toward a target, a PR waiting on CI, a queue of changes.
This page covers handing that work off, the one grant autopilot needs, and reading what happened when you come back.

## Earn the trust before the loop

A loop you do not trust only produces unchecked work faster, and the mess compounds with every iteration.
Before you leave one running, check that it has earned it:
- You have done the task once by hand, or watched an agent do it, so you know what good looks like.
- The agent has the tools and signals you would use yourself: the verification skill, the profiler, the logs.
- Every stage proves its work and can stop the line when the work misses the bar.
- You have read a few transcripts and turned the repeated failures into tools, skills or checks.

Make the loop autonomous only after all four hold.
Until then, run it while you watch.

To stop a run on purpose, tell the lead to pause, or that you are about to go offline.
The [Pause safely playbook](../../skills/tstack/playbooks/pause-safely.md) finishes or backs out of the current step, commits a work-in-progress checkpoint, and writes a resume note.
A fresh lead picks the work up from that note through the Session pickup playbook.
Saying "keep going" never triggers a pause.

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
It reads the PR's state with `tstack.mjs pr-state`, which waits for running checks and gives review bots ten minutes to post after the last push, comment or review.
On T3, the lead also arms T3's PR watch when it opens the PR, so when the PR waits only on your review, it ends its turn and your review wakes it.
On any other harness, the lead tells you the PR waits on your review, and your next message wakes it.

It fixes conflicts first, then review threads, then CI.
It reruns a failed check once, and a second identical failure counts as a real failure.
It verifies each bot comment against the code before it changes anything, and never rewrites published history.
When the PR is merge-ready, the lead asks you whether to merge, unless a grant of yours covers it.

## A queue of changes

An autopilot runs several tasks from one thread, so it has a coordinator.
Open a thread in the primary checkout, which on T3 means **Current checkout** mode with Full access, and ask for the autopilot.
The coordinator pins its own thread so T3 never settles it.
Autopilots need T3 Code or Herdr, because only they can start and hold leads for you.
Pick the one that matches who lands the work.

```text
$tstack autopilot these three fixes. Merge each one when its verification is clean.
```

Autopilot-full asks you once which items, if any, stay for you to merge, and records your answer as its grant.
Each item gets its own lead and PR, and those leads report to the coordinator instead of to you.
The coordinator asks you their decisions, audits each lead's evidence, and merges the PRs the grant covers one at a time.

```text
$tstack build these four changes as a stack. I will land it.
```

Autopilot-stack builds the same leads into one chain of PRs, each on top of the last, and merges nothing.
You review the chain bottom up and land it, or ask the coordinator to land it with Shipping.

Tell the coordinator to stop at any time.
It holds every lead: no more commits, pushes or workers until you release it.

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
