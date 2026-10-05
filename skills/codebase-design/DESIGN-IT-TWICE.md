# Design it twice

Use this when the human wants alternative interfaces for a chosen deepening candidate.
Your first interface is unlikely to be the best one (Ousterhout), so compare several radically different designs.
The terms come from [codebase design](SKILL.md).

## 1. Frame the problem

Write down, for the human and for the designers:

- the constraints any interface must satisfy;
- the dependencies and their categories from [deepening](DEEPENING.md);
- a rough code sketch that makes the constraints concrete, not a proposal.

Show this to the human, then start the designs at once; the human reads while they run.

## 2. Get three or more designs

Give each designer the same technical brief (paths, coupling, dependency categories, what sits behind the seam, the [codebase design](SKILL.md) glossary, and the `CONTEXT.md` terms) plus one distinct constraint:

- Minimize the interface: one to three entry points, maximum leverage each.
- Maximize flexibility: many use cases and extension points.
- Make the most common caller's case trivial.
- Put ports and adapters at every cross-seam dependency, when the candidate has such dependencies.

Designers are read-only helpers the designing agent launches under [dispatch](../tstack/references/dispatch.md).
A lead that wants independent candidates with a judge uses [architect](../architect/SKILL.md) instead.

Each design returns:

1. the interface: types, methods, parameters, invariants, ordering, and error modes;
2. a caller's usage example;
3. what the implementation hides behind the seam;
4. the dependency strategy and adapters;
5. where leverage is high and where it is thin.

## 3. Compare and recommend

Present each design, then compare them by depth, locality, and seam placement.
Recommend one, or a hybrid when parts of different designs combine well, and say why.
