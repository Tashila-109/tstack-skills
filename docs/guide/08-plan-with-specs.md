# Plan a feature with a grill, a spec and tickets

Some features are worth settling before anyone writes code.
The spec-driven playbook grills you until you and the lead share one understanding, then writes a design, a spec and tickets, and asks your approval at each.
Only then does it build, one ticket at a time.

Ask for it in your own words:

```text
$tstack I want offline sync for the notes app. Grill me first, then design and spec it. I want to approve the design, the spec and the tickets before any code.
```

## The grill

The lead runs the grill in its own thread on T3, or its own tab on Herdr.
Main tells you when the lead is waiting, and where.
This is the one time a lead talks to you directly.

The lead asks in rounds, a few questions at a time, each with options and its recommendation first.
It looks up facts itself and asks you only for decisions.
As terms and decisions settle, it writes them down: a glossary in `CONTEXT.md`, and a short decision record for each choice that would be hard to reverse.
When nothing is left to ask, it confirms with you that you share one understanding.

If you cannot sit in the lead's thread, say so.
The lead then sends each round through main as a question instead, which is slower.

## Three gates

| Gate | What you approve | Where it is |
| --- | --- | --- |
| Design | The problem, the decisions from the grill, the shape, the testing seams and the acceptance criteria | `docs/<branch>/design.md` |
| Spec | The user stories and the implementation and testing decisions | `docs/<branch>/spec.md` |
| Tickets | The breakdown into end-to-end tickets and their order | The task's `tickets/README.md` |

Before the design reaches you, two reviewers check it: one against your project's standards, and one against what the grill settled.
Main brings each gate to you with the lead's summary.
Approve it, or say what to change.
A change makes a new gate, and the gates after it come round again.

`tstack.mjs check` will not let the lead report done until each gate has your recorded `granted`.

## The build

Ticket `00` runs first.
A worker records what your app does today on every route the spec changes.
Then the lead works the tickets in order:
- each ticket goes to a fresh worker, who writes the failing test first, at the seams the design named;
- the lead reviews each ticket's diff, commits it, and has the two reviewers check it;
- tickets that do not depend on each other run at the same time.

After the last ticket, the reviewers check the whole branch, and a final worker drives every user-visible outcome in the spec against the baseline from ticket `00`.

## Larger programs

Spec-driven fits a feature you can cut into tickets.
For work that spans phases, each with its own live and performance checks, two playbooks share one spec format:
- Multi-phase plan writes and gates `design.md` and `spec.md`, then stops, so you can review the plan before anyone builds;
- Orchestrate runs the same gates, then asks you to authorize the build, pilots the first phase, and builds the rest.

`check-plan.mjs` checks the spec's structure before you see it: every phase has unit, live and performance boxes, and a regression lane against trunk.
It cannot tell whether the evidence is true; the reviewers and your gates do that.

## What you get

When it finishes, main asks whether to merge.
The report lists each gate and your answer, each ticket with its commit, each review's verdict, both end-to-end runs, and any review findings the lead chose not to fix, with the reason.
