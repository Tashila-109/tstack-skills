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

The lead runs the grill in its own thread or pane, with the human answering there.
That is the one place a lead talks to the human directly, and the tstack router's rule 4 names it.
Before the first round, the lead sends main `grill <id>: waiting for you in the lead's thread`, so main can tell the human where to go.
A worker puts its open questions in its result instead of grilling.
After each round, the lead appends the settled decisions to `tasks/<id>/evidence/grill.md` under the task home, which session pickup reads to rebuild the grill.
Answers in the grill settle the design but never authorize work; authorization stays with main, through the gates in [decisions](../tstack/references/decisions.md).
When the human confirms, the lead tells main the grill is done and moves on.
