---
name: domain-modeling
description: Build and sharpen a project's domain model. Use when settling or challenging project terminology, writing or editing CONTEXT.md, or recording or editing an ADR.
---

# Domain modeling

Build the project's domain model while you design.
This skill is for changing the model: challenging terms, testing them against scenarios, and writing the glossary and decisions down as they settle.
Reading `CONTEXT.md` for vocabulary needs no skill.

## Files

A single-context project keeps one `CONTEXT.md` at the repository root and its ADRs in `docs/adr/`.
A multi-context project has a `CONTEXT-MAP.md` at the root that lists each context's `CONTEXT.md`; each context may keep its own `docs/adr/` beside it, with system-wide decisions in the root `docs/adr/`.
When several contexts exist, work out which one the topic belongs to, and ask when you cannot tell.

Create files lazily.
Write `CONTEXT.md` when the first term settles and `docs/adr/` when the first ADR is needed.

[CONTEXT-FORMAT.md](CONTEXT-FORMAT.md) owns the glossary format.
[ADR-FORMAT.md](ADR-FORMAT.md) owns the ADR format and numbering.

## During the session

- When the human uses a term that conflicts with `CONTEXT.md`, say so at once: "The glossary defines cancellation as X, but you seem to mean Y. Which is it?"
- When a term is vague or overloaded, propose one precise term: "By account, do you mean the Customer or the User?"
- Test relationships with concrete scenarios that probe the edge cases between two concepts.
- When the human says how something works, check the code; surface any contradiction.
- When a term settles, update `CONTEXT.md` right then instead of batching.
- Keep `CONTEXT.md` a glossary: no implementation details, specs, or scratch notes.

## ADRs

Offer an ADR only when all three hold:

1. Hard to reverse: changing your mind later has a real cost.
2. Surprising without context: a future reader would ask why it was done this way.
3. A real trade-off: there were genuine alternatives and you chose one for stated reasons.

If any one is missing, skip the ADR.

## In a tstack task

`CONTEXT.md` and ADRs are project files.
The lead writes them in its checkout and commits them as a docs stage.
A worker writes them only when its brief assigns those paths.
Main never edits project files, so main challenges terms and leaves the writes to a lead.
