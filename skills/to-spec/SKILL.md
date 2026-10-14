---
name: to-spec
description: Write a spec from what a grill and an approved design already settled, by synthesis with no interview. Use when the human asks for a spec of work already discussed.
---

# To spec

Write the spec from what is already settled: the grill, the approved design, the code, the glossary, and the ADRs.
Synthesize; do not interview.
Every decision the spec needs was made earlier, so the spec records decisions instead of making them.

A decision the spec needs that nothing settled is a gap, not a guess.
Put that one question to the human, in a tstack task as a `question` decision, and write the rest while it is open.
A spec that must depart from the approved design is a design change: stop and get the design approved again before writing on.

## 1. Read the ground

Read the code in the area the work touches, the project's `CONTEXT.md`, and the ADRs for that area.
[Domain modeling](../domain-modeling/SKILL.md) owns those files.
Use the glossary's words throughout the spec, and respect every ADR the work touches.
Done when every module the spec will name either exists in the code or is named in the design.

## 2. Take the seams

The approved design's Testing seams section is the seam agreement.
Carry those seams into Testing decisions as they are; do not add one.

Without an approved design, sketch the seams first.
Prefer existing seams to new ones, and the highest seam possible.
The fewer seams the better; the ideal is one.
Confirm the sketch with the human before step 3.
In a tstack task, open a `question` decision under [decisions](../tstack/references/decisions.md#open-a-decision-lead) instead.

## 3. Write

Write the spec with the [template](#template).
Write it where the human says.

Name modules, interfaces, contracts, and schemas, never file paths or code snippets, which go stale fast.
One exception: a prototype snippet that says a decision more precisely than prose can, such as a state machine, a reducer, a schema, or a type shape.
Inline it in the decision it encodes, trimmed to the decision-rich lines, and say it came from a prototype.

## 4. Check

- Every user story traces to a grill decision or a design section.
- Every implementation decision agrees with the design.
- Testing decisions name only agreed seams.
- No file path or code snippet appears outside the prototype exception.

Done when all four hold.

## In a tstack task

The [Multi-phase plan](../tstack/playbooks/multi-phase-plan.md) playbook owns a task's spec: its skeleton, its checker and its gate.
In a task that runs it, follow that playbook instead of the template below.
Never edit the approved design while writing; a changed subject is a new decision under [decisions](../tstack/references/decisions.md#open-a-decision-lead).

## Template

```markdown
# <Feature> spec

## Problem

The problem the user faces, from the user's point of view.

## Solution

The solution, from the user's point of view.

## User stories

A long, numbered list that covers every aspect of the feature, each in this form:

1. As a <actor>, I want <feature>, so that <benefit>.

For example: As a mobile bank customer, I want to see the balance on my accounts, so that I can make better-informed decisions about my spending.

## Implementation decisions

The decisions made, such as:

- the modules built or changed, and their interfaces;
- architectural decisions and the reasons from the grill;
- schema changes and API contracts;
- specific interactions.

## Testing decisions

- What makes a good test here: external behavior through a public interface, never implementation details.
- The agreed seams, each with the behavior it observes.
- Prior art: similar tests already in the codebase.

## Out of scope

What this spec does not cover.

## Further notes

Anything else the implementer needs.
```
