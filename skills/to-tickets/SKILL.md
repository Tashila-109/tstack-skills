---
name: to-tickets
description: Break an approved spec or plan into tracer-bullet tickets, each naming the tickets that block it, as one file per ticket plus an index. Use when the human asks to split a spec or plan into tickets.
---

# To tickets

Break the work into tickets: tracer-bullet vertical slices, each naming the tickets that block it.
The tickets are a task graph, not a list of steps.
The frontier is every ticket whose blockers are all done, and any frontier ticket can start.

## 1. Gather

Read the whole spec, the design it came from, the project's `CONTEXT.md`, and the ADRs for the area.
Use the glossary's words in ticket titles and bodies, and respect the ADRs.
A ticket that needs a decision the spec does not make is a spec gap: put that question to the human, in a tstack task as a `question` decision, instead of deciding it in a ticket.

## 2. Look for prefactoring

Read the code the work touches and look for changes that would make the slices easier.
Make the change easy, then make the easy change.
Done when you have either named the prefactor tickets or found nothing worth one.

## 3. Draft vertical slices

- Each slice cuts a narrow but complete path through every layer it touches, such as schema, API, UI, and tests: vertical, never one layer.
- A finished slice is demoable or verifiable on its own.
- Each slice fits in one fresh context window, since each ticket gets a fresh implementer.
- Prefactoring comes first.

Give each ticket its blocking edges: the tickets that must be done before it can start.
A ticket depends only on tickets that genuinely gate it; a needless edge shrinks the frontier.

Wide refactors are the exception to vertical slicing.
A wide refactor is one mechanical change, such as renaming a column or retyping a shared symbol, whose blast radius crosses the codebase, so no vertical slice can land green.
Sequence it as expand-contract:

1. Expand: add the new form beside the old, so nothing breaks.
2. Migrate the call sites in batches sized by blast radius, such as one package or directory each, each batch its own ticket blocked by the expand, with CI green after every batch because the old form still exists.
3. Contract: delete the old form in a ticket blocked by every migrate batch.

Every ticket must end green, because each one is committed as a verified stage.
When a batch cannot stay green alone, merge it with the batches it breaks without into one ticket.
If that ticket no longer fits one fresh context, put the slicing conflict to the human before the breakdown is approved.

Mark each ticket parallel-safe or not.
It is parallel-safe when it shares no invariant and edits none of the same code as any ticket that could be on the frontier at the same time.
Separate edits in one file are fine: parallel tickets run in their own worktrees, and the lead merges each one.
The reason names the area it owns or the ticket it collides with.

## 4. Write the tickets

Write one file per ticket, numbered in dependency order with blockers first, as `NN-slug.md` from the [ticket template](#ticket-template).
Write them where the human says.
Every ticket starts with `Status: ready`.

Describe behavior, not files: no file paths or code snippets, which go stale fast.
One exception: a prototype snippet that says a decision more precisely than prose can, such as a state machine, a reducer, a schema, or a type shape.
Inline it, trimmed to the decision-rich lines, and say it came from a prototype.

## 5. Write the index

Write `README.md` beside the tickets from the [index template](#index-template).
The index is the breakdown the human approves: each ticket's title, blockers, what it delivers, and whether it is parallel-safe.
Done when every ticket file has exactly one index row and every blocker named in a row is a ticket in the set.

## 6. Get the breakdown approved

Put these three questions to the human with the index:

- Does the granularity feel right, or is it too coarse or too fine?
- Are the blocking edges right, with each ticket depending only on tickets that genuinely gate it?
- Should any tickets be merged or split?

Revise the tickets and the index until the human approves the breakdown.
In a tstack task the approval is the playbook's implement-authorization on the index, so the questions go into that decision.

## In a tstack task

The lead writes the tickets in its own context, right after the spec is approved.
Tickets are execution state, not project files: they stay uncommitted under the task home, and the committed spec stays the durable record.

Bracket the set with two verification tickets, both run on the `verify` seat:

- Ticket `00` is the end-to-end baseline on trunk.
  It blocks every ticket that has no other blocker, so it runs before the first implementation commit.
  It records what trunk does on the routes the spec changes, or that trunk lacks the feature.
- The last ticket is the final end-to-end run on the candidate.
  Every other ticket blocks it.
  Its criteria are the spec's user-visible outcomes, checked against the baseline.

Never edit the approved index; a changed subject is a new decision under [decisions](../tstack/references/decisions.md#open-a-decision-lead).
The lead tracks progress in each ticket's `Status` line instead: `ready`, then `done <sha>` once the ticket is committed, reviewed, and verified.

## Ticket template

```markdown
# NN: <title>

**What to build:** the end-to-end behavior this ticket makes work, from the user's point of view, not a list of layers.

**Blocked by:** the numbers and titles of the tickets that gate this one, or "None (can start immediately)".

**Parallel-safe:** yes or no, with the reason.

Status: ready

- [ ] Acceptance criterion 1
- [ ] Acceptance criterion 2
```

## Index template

```markdown
# Tickets: <feature>

Spec: <spec path>.
Design: <design path>.

| # | Title | Blocked by | Delivers | Parallel-safe |
| --- | --- | --- | --- | --- |
| 00 | End-to-end baseline on trunk | None | <what trunk does today> | yes |
| 01 | <title> | 00 | <end-to-end behavior> | <yes or no> |
```
