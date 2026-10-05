---
name: two-axis-review
description: Review a frozen diff or document on two separate axes, standards and spec, with one read-only reviewer worker per axis. Use when a lead reviews a stage, a branch, a PR head, a design, or a spec, or when the human asks to review the changes since a fixed point.
---

# Two-axis review

Review one frozen scope on two axes, each by its own reviewer:

- **Standards**: does the change follow this repo's documented standards and stay clear of the smell baseline?
- **Spec**: does the change do what its spec and ticket asked, no less, no more, and correctly?

A change can pass one axis and fail the other.
Code that follows every standard but builds the wrong thing passes standards and fails spec.
Code that does exactly what was asked but breaks the repo's conventions passes spec and fails standards.
Separate reviewers in separate contexts keep one axis from masking the other.

The lead runs this skill.
Each axis runs as a read-only worker delegated on a `review` seat, never as the lead's own subagent, so its report is a result file the lead keeps.
Main asks a lead for a review instead of running one, and a worker never delegates reviewers.

## 1. Freeze the scope

Pick the scope:

- `code`: the diff from a fixed point to a head commit.
- `doc`: one or more documents, such as a design or a spec, at a head commit.

Commit what the review covers, so the checkout is clean.
Stop writing, and let no worker write in this checkout until both reports are collected.
Record the head with `git rev-parse HEAD`.
For `code`, resolve the fixed point with `git rev-parse <fixed-point>`.
The diff is `git diff <base>...<head>` and the commits are `git log --oneline <base>..<head>`.
The fixed point is usually the task record's `base`, or the last reviewed head for a later stage.
A bad ref, an empty diff, or a missing document fails here, before any delegation.

## 2. Find the spec sources

List what the change was asked to do:

1. The ticket or stage brief the change implements.
2. The spec, design, or plan the task names, such as `docs/<branch>/spec.md`.
3. The task brief's goal and finish, and the human's later words in decisions and steers.
4. For a `doc` scope, the record the document must honor: the grill record for a design, the approved design for a spec.

Every tstack task has a brief, so the spec axis always has at least its goal and finish.

## 3. Find the standards sources

List the files that say how work is done in this repo: `AGENTS.md` and what it points at, `CONTRIBUTING.md`, style and docs conventions, and the owning skill or doc of any contract the change touches.
Leave out rules that tooling already enforces, such as the formatter's.
The reviewer brings the smell baseline from [REVIEWER.md](REVIEWER.md) itself.

## 4. Brief and delegate both reviewers

Write one brief per axis under the task home, at `tasks/<id>/evidence/reviews/<label>-standards.md` and `tasks/<id>/evidence/reviews/<label>-spec.md`.
`<label>` names the deliverable under review, such as `01` for a ticket, `design`, or `final` for the branch.
Every round on that deliverable reuses its label, so each round's briefs and aggregate replace the last round's, and `<label>.md` always covers the last reviewed head.
Each brief carries:

- the axis and the scope;
- the checkout and the head SHA, and for `code` the base SHA with the exact diff and log commands;
- for `doc`, the document paths;
- that axis's sources from step 2 or step 3, by absolute path;
- the line `Read <this skill's directory>/REVIEWER.md and follow the <axis> section.`, with the directory as an absolute path.

Resolve the seats with `tstack.mjs seat review --runtime <runtime>`.
The first seat reviews standards and the second reviews spec.
Delegate both at once, as [dispatch](../tstack/references/dispatch.md) says, named `review-<label>-standards` and `review-<label>-spec`, with result files at `tasks/<id>/results/review-<label>-<axis>.md`.
The `review` seats should run models from different families, so each axis also gets an independent model.
Both reviewers read the same checkout at once, and neither writes anything but its own result file.

## 5. Collect and check the freeze

Collect each reviewer once it is done, as the runtime reference says.
If a reviewer reports a head-changed incident, or `git rev-parse HEAD` no longer matches the recorded head, the review covers nothing.
Freeze again and rerun both axes.

## 6. Aggregate

Write `tasks/<id>/evidence/reviews/<label>.md` with:

- a first line naming the reviewed head;
- the scope, base, and each reviewer's name, seat and result path;
- `## Standards` and `## Spec`, each report verbatim or lightly cleaned;
- one closing line with each axis's verdict, its finding counts by severity, and the worst finding within that axis.

Never merge, dedupe, or rerank findings across the axes, and never name one worst finding overall.
That reranking is what the separation exists to prevent.

## 7. Act on the findings

Decide each finding under [decisions](../tstack/references/decisions.md#what-a-lead-decides-alone).
The scope counts as reviewed only when no accepted Must remains.
Only an accepted Must gets a repair and another review: the repair makes a new head, and a new head needs a fresh review on both axes.
A repair brief lists only the blocking findings.
The lead may write a repair itself, red first, when the next review round covers it.
First implementation still goes to a worker.
A code repair, written by the lead or by a worker, keeps its coverage.
It reruns the project's full test suite on the new head, not only the tests near the fix, because an edit can fail a test that reaches it from another file.
For each test it replaces, deletes, or loosens, it names the refusal or behavior that test checked and the test that checks it now.
A refusal or behavior left with no test gets a new test in the same repair.
A worker repair's brief asks for the suite result and that list in the worker's result.
The lead copies the list into the aggregate and into the next round's spec brief, so the spec reviewer checks each entry.
A Should or Could never opens a repair or a review round on its own.
Record each one in the aggregate with the reason it stays, or fix it only when the fix is trivial and the lead is writing a Must's repair itself.
The same rule holds for blocking and non-blocking findings from an external or agent review of a PR head.
When a finding recurs, encode the fix as a check instead of more text, as [principle-encode-lessons-in-structure](../principle-encode-lessons-in-structure/SKILL.md) says.
A round collects both axes on one frozen head for one deliverable.
A repair series follows that deliverable across heads under its one label.
After three complete rounds with an accepted Must still open, open a `question` decision named `review-<label>` under [decisions](../tstack/references/decisions.md#open-a-decision-lead), with the rounds and the open findings, and the last round's frozen head as its subject.
Wait for main's answer before another repair or round 4.
Record the repair series, round number, each earlier round's head and accepted Musts, and any checkpoint decision in the aggregate.
