# Run work while you are away

Some work runs for hours: a loop toward a target, a PR waiting on CI, a queue of changes.
This page covers handing that work off, stepping away from a task that is already running, the one grant autopilot needs, and reading what happened when you come back.

## Earn the trust before the loop

A loop you do not trust only produces unchecked work faster, and the mess compounds with every iteration.
Before you leave one running, check that it has earned it:
- You have done the task once by hand, or watched an agent do it, so you know what good looks like.
- The agent has the tools and signals you would use yourself: the verification skill, the profiler, the logs.
- Every stage proves its work and can stop the line when the work misses the bar.
- You have read a few transcripts and turned the repeated failures into tools, skills or checks.

Make the loop autonomous only after all four hold.
Until then, run it while you watch.

Before unattended work, the lead runs a preflight.
It checks that every role resolves to a seat, that a signed commit works when your project signs commits, and that `gh` is logged in.
Then it asks you once for everything only you can fix, such as a locked signing key, a login, or a missing seat.
Answer before you leave, so the run does not stop on the first commit.

Two tasks on one machine can need the same simulator, port or local database.
A lead takes a lock on it first, and when another task holds it, the two leads settle it between them without asking you to relay, except on the standalone runtime, where you pass on the note the waiting lead writes.

To stop a run on purpose, tell the lead to pause.
The [Pause safely playbook](../../skills/tstack/playbooks/pause-safely.md) finishes or backs out of the current step, commits a work-in-progress checkpoint, and writes a resume note.
A fresh lead picks the work up from that note through the Session pickup playbook.
Saying "keep going", or that you are away, never triggers a pause.

## Step away from a running task

When you leave in the middle of a task, tell its lead, such as "afk", "I'm away", "stepping out", "going to bed" or "babysit the rest".
The lead keeps running the playbook it is in, and records your words as an away grant in the task's `decisions/away.md`.
Under that grant it answers its own question decisions with the option it recommended, and marks each answer as taken under the grant.
Design and spec gates, merges, and anything destructive still wait for you.
On T3 the lead also arms a heartbeat, a scheduled wake that keeps it checking on its workers while you are gone.

When you write again, the lead's reply opens with every decision it took while you were away, and the grant ends.
Overrule any of them in your reply.
`tstack.mjs check` refuses a gate the lead answered under the grant, and, once the grant has ended, a taken question that the grant file does not list.
[decisions.md](../../skills/tstack/references/decisions.md#while-the-human-is-away) owns the exact rules.

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
A bot that has reviewed two earlier heads gets up to twenty minutes to review the new one, and its findings outside review threads block until the lead answers them.
When the base branch moves in files the PR changes, the lead merges it in and proves the change again, even with no conflict.
On T3, the lead arms T3's PR watch while the PR waits on checks or a review, and ends its turn until a check result or a review wakes it.
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
$tstack autopilot these four changes, but don't merge. I will land them.
```

Autopilot-stack is Autopilot-full without the merge.
You get verified PRs, each with its audit verdict, and a PR stacks on another only when it builds on it.
You review and land them, a stack bottom up, or ask the coordinator to land them with Shipping.

Tell the coordinator to stop at any time.
It holds every lead: no more commits, pushes or workers until you release it.

## Read what happened

Each task's folder, `<project>/.tstack/tasks/<id>/`, holds the whole story:

| Path | What it tells you |
| --- | --- |
| `report.md` | What changed, how it was proved, and what is left |
| `evidence/` | Each step's file: the baseline, the predicate, the decision log, the babysit summary |
| `results/` | What each worker found, in its own words |
| `decisions/` | Each question the lead asked, and your recorded answer or the one it took under an away grant |

Ask the lead or the coordinator "where are we?" for the short version.
It answers from `tstack.mjs status`, which lists each task's step, the decisions waiting on you, and finished worker results nobody has read yet.

Start with `report.md`, then open the evidence it cites.
`evidence/decisions.tsv` shows every attempt in order, including the ones that were reverted.
