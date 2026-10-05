# ADR format

ADRs live in `docs/adr/` as `NNNN-slug.md`.
Number the next one by scanning `docs/adr/` for the highest number and adding one.

## Template

```md
# {Short title of the decision}

{One to three sentences: the context, the decision, and why.}
```

One paragraph is enough.
The record's value is that the decision and its reason are written down.

Add a section only when it carries something the paragraph cannot:

- `Status` frontmatter (`proposed`, `accepted`, `deprecated`, or `superseded by ADR-NNNN`) when the decision may be revisited.
- Considered options, when a rejected alternative is likely to be proposed again.
- Consequences, when a downstream effect is not obvious.

## What qualifies

The three tests in [domain-modeling](SKILL.md#adrs) decide whether to offer an ADR.
Decisions that usually pass them:

- Architectural shape, such as an event-sourced write model with a projected read model.
- How contexts integrate, such as domain events instead of synchronous calls.
- Technology with lock-in: the database, message bus, auth provider, or deployment target, not every library.
- Ownership and scope, including what a context deliberately does not own.
- Deliberate deviations from the obvious path, so the next engineer does not undo them.
- Constraints the code cannot show, such as compliance rules or a partner's latency contract.
- A rejected alternative whose rejection is not obvious.
