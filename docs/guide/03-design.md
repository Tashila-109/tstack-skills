# Design before writing code

One attempt at a hard design locks in the first shape a model thought of.
`architect` settles types and boundaries before implementation, `arena` runs several attempts at one brief and merges the best parts, `interrogate` has other models try to break the result, and `swarm` covers many slices at once.
The Feature playbook runs `architect` on every feature, and the rest when a step calls for them.

## Settle the shape with architect

`architect` grounds itself in the code with `how`, then runs `arena` to sketch competing designs.
Each sketch starts from how a caller would use the code, then names the types, signatures and module map.
The runners come from your `architect runners` seats, so three different model families sketch independently.
The lead picks one, writes the candidates and the pick to `evidence/design.md`, and the workers build from that file.

To see the design before any code is written, say so when you start the task:

```text
$tstack design the import pipeline before writing code, and show me the design first. I care most about how callers use it.
```

The lead then sends main a decision with the design, and waits for your answer.

## Fan out attempts with arena

`arena` gives the same brief to several runners, each in its own directory or worktree.
A judge on a different model family scores each candidate against a rubric, and the lead reads every candidate, picks a base, and grafts in the best ideas from the rest.
Feature uses it when the implementation still admits several valid shapes after the design.

## Cover slices with swarm

`swarm` sends one worker per slice, such as one per package, each with its own scope and check.
Each worker reports `PASS`, `ISSUES` or `BLOCKED`, and the lead returns one table.
Use `swarm` for coverage, and `arena` for picking the best of several attempts at one thing.

## Break it with interrogate

`interrogate` sends the same diff, intent and rubric to reviewers on your `interrogate reviewers` seats.
A finding two models raise independently is strong signal.
The lead sorts every finding into act on, consider, noted and dismissed, with a reason for each dismissal, and applies nothing automatically.
Feature runs it when the design is contested.

## How much design a task deserves

- A small, finished change you are unsure about needs `interrogate` alone.
- A change that crosses function boundaries or moves ownership earns `architect`, which brings `arena` with it.
- A standalone choice where independent attempts help, such as a format or an algorithm, is `arena` directly.
- A coverage matrix or a set of parallel checks is `swarm`.
- A contested design that is expensive to reverse gets `architect`, then `interrogate` before it ships.

The playbooks already apply this ladder.
Ask for more or less scrutiny in your request when the default does not fit.
