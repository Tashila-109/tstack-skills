# Design before writing code

One attempt at a hard design locks in the first shape a model thought of.
`architect` settles types and boundaries before implementation, `arena` runs several attempts at one brief and merges the best parts, `interrogate` has other models try to break the result, and `swarm` covers many slices at once.
The Feature playbook runs `architect` on every feature, and the rest when a step calls for them.
The two most common design mistakes are taking the first design and polishing a plan that no code has tested.
This page fixes both: prototypes answer the open questions, a README sets the target, and the written plan comes last.

## Settle the shape with architect

`architect` grounds itself in the code with `how`, then runs `arena` to sketch competing designs.
Each sketch starts from how a caller would use the code, then names the types, signatures and module map.
The runners come from your `architect runners` seats, so three different model families sketch independently.
The lead picks one, writes the candidates and the pick to `evidence/design.md`, and the workers build from that file.

To see the design before any code is written, say so when you start the task:

```text
$tstack design the import pipeline before writing code, and show me the design first. I care most about how callers use it.
```

The lead then opens a decision with the design, asks you in its own thread, and waits for your answer.

The design is not sacred once code starts.
If the same workaround shows up in unrelated places, or types only compile with `any` or forced casts, `architect` treats that as proof the design is wrong.
It scraps the sketch and starts over instead of patching around it.

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

## Prototype instead of debating

Never take the first design.
Ask for a few, and pick from evidence you can see:

```text
$tstack prototype a few options for the new dropdown menu. Take screenshots or recordings for me to compare.
```

The [Prototype playbook](../../skills/tstack/playbooks/prototype.md) builds throwaway sketches in a scratch directory, puts the variants behind one switcher, drives each one, and captures screenshots or timings.
It also works for behavior and algorithms, not only UI.
Prototypes let the lead answer its own open questions by running something instead of asking you.

The same idea scales up to a real design.
Pair `architect` with prototypes, and keep a review gate:

```text
$tstack we need rate limiting for external webhooks. Architect it first, and answer open questions with prototypes. Let me review before proceeding.
```

Do not spend reviewers on an abstract plan.
`interrogate` belongs on a diff, because reviewers of a plan with no code behind it invent risks that never happen.
Let prototypes settle the questions, then review what got built.

When several writers build competing options at once, give parallel writers their own checkout.
`arena` already does this for its runners.

## Write the README first for shared code

For a package or API that other code will use, start with the doc a user would read:

```text
$tstack write a tutorial for how I would use the new config package first. Then explain why it beats the current one.
```

Writing the tutorial first forces the caller's view, and the doc becomes a target the agent checks its work against.
Name `technical-writing` when the doc itself matters, so a tutorial stays a tutorial.

## Plan after the design settles

When you want a written plan, ask for it once the design is settled:

```text
$tstack turn this design into a plan. Small verifiable PRs, each with its own verification steps. Don't build yet.
```

The [Multi-phase plan playbook](../../skills/tstack/playbooks/multi-phase-plan.md) settles open questions by prototype, then writes the design and the spec for your approval, and does not build.
To plan and then build, ask for [Orchestrate](../../skills/tstack/playbooks/orchestrate.md).
[Plan work across phases](08-plan-across-phases.md) covers both, and the gates they ask you to approve.

For a migration, state the bar in the prompt, such as "the result must match the original exactly, bugs included".
That keeps the migration from quietly fixing things on the way, which would make the old and new output impossible to compare.

## How much design a task deserves

- A small, finished change you are unsure about needs `interrogate` alone.
- A change that crosses function boundaries or moves ownership earns `architect`, which brings `arena` with it.
- A standalone choice where independent attempts help, such as a format or an algorithm, is `arena` directly.
- A coverage matrix or a set of parallel checks is `swarm`.
- An open question you could answer by running something, such as a layout or a timing, gets a prototype.
- Work that spans several PRs gets a plan, written after the design settles.
- A contested design that is expensive to reverse gets `architect`, then `interrogate` before it ships.

The playbooks already apply this ladder.
Ask for more or less scrutiny in your request when the default does not fit.
