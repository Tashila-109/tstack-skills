# Plan work across phases

Some work is too large for one feature branch built in one pass.
The **Multi-phase plan** playbook plans it in phases: it writes and gates `design.md` and `spec.md`, then stops, so you can review the plan before anyone builds.
To build it, start a **Figure it out** task on the approved spec.

Ask in your own words:

```text
$tstack plan moving the notes API from REST to tRPC, in phases. I want to approve the design and the spec. Don't build yet.
```

```text
$tstack figure it out: build the approved spec in docs/notes-trpc/spec.md, phase by phase.
```

## Settle it before you build

You can run three of the planning skills yourself, before or without a playbook:
- `grilling` stress-tests a plan, one round of questions at a time, until you and the agent share one understanding.
  `grill-with-docs` does the same and writes the glossary and decision records as they settle.
- `to-spec` writes a spec from what a grill and an approved design already settled, with no interview.
- `to-tickets` splits an approved spec or plan into tracer-bullet tickets, one file each, with an index.

```text
$tstack grill me on this plan before anyone builds. The plan: move the notes API to tRPC.
```

A lead grills you in its own thread, because it is the agent you talk to.
A lead that an autopilot's coordinator launched opens a `question` decision instead, and the coordinator asks you.
A worker puts its open questions in its result file.
[decisions.md](../../skills/tstack/references/decisions.md) says what goes to you.

`domain-modeling` and `codebase-design` give the grill and the design a shared vocabulary, and `handoff` and `two-axis-review` serve the lead's own steps.
`handoff` writes the file a fresh session starts from, and `two-axis-review` reviews a frozen diff or document on standards and on spec.
You rarely call these yourself.

## What it asks first

Before any design, the lead settles six questions, from your request when it answers them, and by asking you when it does not:
- whether the planning documents are committed or stay in the task folder;
- which platforms the work targets;
- how code from reference projects may be reused;
- whether you accept each phase before the next one starts, or review the whole branch once;
- whether the lead pushes after each verified stage, or only on your word;
- which method merges a PR, squash, merge or rebase.

A task that builds from the plan carries the last three in its brief.

## The gates

| Gate | What you approve | Where it is |
| --- | --- | --- |
| Design | The problem, the scope, the alternatives, the chosen approach and the acceptance criteria | `docs/<branch>/design.md`, or the task folder when the project keeps planning docs out of Git |
| Spec | The phases in order, who owns which paths, and how each phase is verified | `docs/<branch>/spec.md`, or the task folder |

The lead brings each gate to you in its thread, with its summary.
Approve it, or say what to change.
A change makes a new gate, and the gates after it come round again.

`tstack.mjs check` will not let the lead report done until each gate has your recorded `granted`.

## The spec

`check-plan.mjs` checks the spec's structure before you see it: every phase has unit, live and performance boxes, and a regression lane against trunk.
It cannot tell whether the evidence is true; the reviewers and your gates do that.

## The build

A Figure it out task builds the spec in its own thread.
It designs its phase list from the spec, puts a long run to you as one checkpoint, and logs each decision as it lands.

## What you get

A multi-phase plan ends with both documents, the phase order and owners, and the open questions.
The build ends like any other task: the lead asks whether to merge, and the report lists each phase's evidence and the final review.
