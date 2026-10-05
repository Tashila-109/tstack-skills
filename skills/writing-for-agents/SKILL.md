---
name: writing-for-agents
description: Write documents agents consume. Use when creating or editing a skill, a playbook, a brief, or AGENTS.md or CLAUDE.md.
---

# Writing for agents

A skill, a playbook, a worker brief, and an `AGENTS.md` line all steer an agent the same way.
The goal is that the agent takes the same process on every run, not that it produces the same output.
When the document is a skill, also read [skill mechanics](SKILL-MECHANICS.md).
Prose follows `unslop`, with one sentence per line.

## Pointers

A pointer is text already in the agent's context that names material outside it and says when to reach it.
A skill description is a pointer, and so is an `AGENTS.md` line that links a doc.
The pointer's wording decides when and how reliably the agent reaches the material.
When a needed document is missed, sharpen the pointer first; inline the material only if that fails.

A pointer states what the material is and lists the branches that should trigger it.
A branch is a distinct case the material handles.

- Put the leading word first.
- Write one trigger per branch; synonyms for one branch are one branch.
- Cut anything the material itself already says.

## Two loads

Context load is what always-loaded text costs the agent on every turn: an `AGENTS.md` line or a skill description.
Cognitive load is what the human must remember: which documents exist and when to use each.
Spend cognitive load where the human's judgment matters and remove it elsewhere.
Material behind a pointer costs only the pointer's line of context.

## Steps and reference

A document holds steps, the ordered actions, and reference, the rules and facts consulted on demand.
Place each piece by how soon the agent needs it:

1. steps in the file;
2. reference in the file;
3. reference in a separate file behind a pointer.

Inline what every branch needs, and move behind a pointer what only some branches reach.
Keep a concept's definition, rules, and caveats under one heading.
A document too long even when every line is live is sprawl; fix it by disclosing reference or splitting by branch.

## Completion criteria

End every step on a condition that tells the agent the step is done.
A vague end such as "understanding reached" invites the agent to stop early, pulled by the steps it can see ahead.
Sharpen the criterion first.
Hide later steps only when the criterion cannot be sharpened and early stopping is observed; hiding works only across a real context boundary, such as a worker brief.
A demanding criterion such as "every modified model accounted for" drives more thorough work than "produce a change list".
The best criteria are checkable and exhaustive.

## When to split

Split by sequence when later steps tempt the agent to rush the current one.
Split by invocation as [skill mechanics](SKILL-MECHANICS.md) describes.
Each split spends one of the two loads, so make it earn that.

## Leading words

A leading word is a compact concept the model already knows, such as _tracer bullet_, _red_, or _tight loop_.
Repeat the word, never its definition, and it anchors the behavior in few tokens.
Prefer an existing word; a coined one must be defined and recruits nothing the model already knows.
When a document spells out the same idea at several sites, look for the one word that replaces them.

Steer with the positive target.
A prohibition puts the forbidden behavior into context.
Keep a prohibition only as a hard guardrail with no positive phrasing, and pair it with the target behavior.

## Pruning

- Give each rule one owner and point to it from everywhere else.
- The environment is an owner too: `package.json`, config files, the directory layout, and `--help` output.
  Restate only what the agent cannot find by looking: the unwritten convention, the reason, the gotcha.
- Delete lines that no longer bear on what the document does, and lines gone stale.
- Delete any sentence the model already obeys by default; test that by running the document, not by debate.
  A leading word too weak to change the default needs a stronger word.
