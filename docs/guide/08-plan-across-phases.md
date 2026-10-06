# Plan work across phases

Some work is too large for one feature branch built in one pass.
Two playbooks plan it in phases and ask your approval before anyone builds:
- **Multi-phase plan** writes and gates `design.md` and `spec.md`, then stops, so you can review the plan before anyone builds;
- **Orchestrate** runs the same gates, then asks you to authorize the build, pilots the first phase, and builds the rest.

Ask for either in your own words:

```text
$tstack plan moving the notes API from REST to tRPC, in phases. I want to approve the design and the spec. Don't build yet.
```

```text
$tstack move the notes API from REST to tRPC, in phases. I want to approve the design, the spec and the build before any code.
```

## The gates

| Gate | What you approve | Where it is |
| --- | --- | --- |
| Design | The problem, the scope, the alternatives, the chosen approach and the acceptance criteria | `docs/<branch>/design.md` |
| Spec | The phases in order, who owns which paths, and how each phase is verified | `docs/<branch>/spec.md` |
| Implement | Starting the build, on the approved spec | Orchestrate only |

Main brings each gate to you with the lead's summary.
Approve it, or say what to change.
A change makes a new gate, and the gates after it come round again.

`tstack.mjs check` will not let the lead report done until each gate has your recorded `granted`.

## The spec

`check-plan.mjs` checks the spec's structure before you see it: every phase has unit, live and performance boxes, and a regression lane against trunk.
It cannot tell whether the evidence is true; the reviewers and your gates do that.

## The build

Orchestrate runs the first phase as a pilot, through implementation, review and real verification.
It fixes a bad brief or verification recipe before it runs more phases at once.
Each later phase goes to workers, one writer per checkout, and the lead reviews and verifies each phase before it commits it.

## What you get

A multi-phase plan ends with both documents, the phase order and owners, and the open questions.
An orchestrated build ends like any other task: main asks whether to merge, and the report lists each gate and your answer, each phase's evidence, and the final review.
