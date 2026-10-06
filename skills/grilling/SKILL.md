---
name: grilling
description: Grill the human about a plan, decision, or idea in rounds until you share one understanding. Use when the human wants their thinking stress-tested or says grill.
---

# Grilling

Interview the human until the two of you share one understanding of the plan.
Treat the plan as a design tree, where every decision branches into the decisions that depend on it.

## Rounds

The frontier is every decision whose prerequisites are settled.
Ask the whole frontier in one round, then wait for the answers.
A question that depends on another question still open in this round belongs to a later round.
After each round, recompute the frontier from the answers and ask the next round.

## Asking

Ask through your harness's structured ask-the-user tool when it has one: `AskUserQuestion` in Claude Code, `ask_user_question` in Grok Build, Devin and Pi with its ask extension, and `request_user_input` in Codex's Plan mode only.

- Put at most four questions in one call, and split a larger frontier into several calls.
- Give each question two to four options.
- Put your recommended option first and end its label with `(Recommended)`.
- Leave out an "Other" option; the tool adds a free-text one.
- Put each option's trade-off in its description, and keep each header to a word or two.

An answer typed under "Other" is the human's words; read it as they wrote it.
A skipped or declined question settles nothing, so ask it again in the next round.

When the tool is missing from this session, or the harness has none, number each question and give your recommended answer with it, in this format:

```text
**Q1. <title>**
<the question, with the options when there are several>
Recommended: <your answer and the reason>

---

**Q2. <title>**
...
```

## Facts and decisions

Facts are your job.
When a question needs a fact from the code, the files, or a tool, find it yourself or through a helper your role allows under [dispatch](../tstack/references/dispatch.md).
Ask the human only for what you cannot look up.
A lookup still running blocks only the questions downstream of it, so ask the rest of the frontier now.

Decisions are the human's.
Put each one to them and wait for the answer.

## Done

The grill is done when the frontier is empty: every branch visited and nothing silently assumed.
Act on the result only after the human confirms you share one understanding.

## In a tstack task

The lead runs a grill with the human in its own thread, and records each answer that settles a gate or a scope question as a decision, as [decisions](../tstack/references/decisions.md) says.
A lead that a coordinator launched opens a `question` decision instead, and a worker puts its open questions in its result.
