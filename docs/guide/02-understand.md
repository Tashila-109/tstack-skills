# Understand the code before changing it

Editing code you don't understand is how subtle regressions ship.
Five skills help: `how` explains what the code does now, `why` digs up the reasons it is shaped that way, `explain` blends both into one explanation, `chart` draws it, and `recall` rebuilds your own recent context on a topic.

Ask for any of them in a new thread, and the lead briefs a scout task on the Investigation playbook:

```text
$tstack how do we dedupe notifications? Is there an N+1 when we look up subscribers?
```

The lead runs `how`, and `why` when you ask why, writes the answer to `evidence/how.md`, and turns it into `report.md`.
`explain` and `recall` run only when your request names them.
The lead tells you the findings, not just a notice that the work is done.

## Start with a read-only investigation

When the cause is unclear, ask for findings, not a fix:

```text
$tstack investigate why background jobs time out every few hours. Give me what we know, what data you used, and your best hypotheses. Don't change any code yet.
```

"Don't change any code yet" routes this to the [Investigation playbook](../../skills/tstack/playbooks/investigation.md).
It traces the code, adds `why` for questions about motivation, and returns a cited explanation.
For a choice between options, it returns a recommendation with a trade-offs table.
Asking "what data you used" makes the agent separate its evidence from its guesses.
When the findings point at a fix, start the fix in a new thread.

## Trace behavior with how

`how` answers at the level of a senior engineer onboarding you onto the subsystem: the runtime flow, the key types, and the non-obvious parts.
It sends one read-only worker on your `judgment and prose` seat, which explores and explains in one pass.

## Dig up history with why

```text
$tstack why was the retry limit set to five? Does the reason still hold?
```

`why` answers from the record, not the code: the commits and PR discussions behind the target, and other sources when that trail is thin.
It cites what the authors wrote, marks its own inferences, and says what the record does not answer.
"Nobody wrote down why" is a valid answer.

`how` and `why` compose well.
"Do why first, then how" is a good request when you suspect the history explains the mess.

## Understand it properly with explain

```text
$tstack explain how this change affects retries. Convince me it fixes the cause and not the symptom.
```

`explain` runs `how` and `why`, then weaves what they find into one plain explanation.
"Convince me" turns the explanation into an argument you can poke at.

It works on the agent's own choices too:

```text
$tstack explain why you implemented it this way and not with a queue. What did you trade off, and why?
```

An agent that has to explain its work must read the code and back each claim with evidence, instead of stating it confidently and moving on.

`explain` is one explanation in this session.
To learn a topic over several sessions, with a workspace that keeps your lessons, use `teach`.

## Draw it with chart

```text
$tstack draw how an upload moves from the API to storage, as a data flow chart.
```

`chart` draws a Mermaid chart in which each box and arrow cites the file and line that make it true.
`chart.mjs check` refuses a chart with a missing or broken citation, and the Charting playbook has a reviewer who did not draw the chart read every citation.
It renders the chart to SVG in a clean light and dark theme, or in blueprint blue, and you can ask for any other look.
On T3, the `t3-visual` skill shows the chart inline in the thread, in the thread's own colors.
For a system that is not built yet, ask for a design chart, which marks each proposed part.
Ask for the charts in the repo, and `chart.mjs stale` later tells an agent which charts the code has moved past.

## Rebuild your context with recall

```text
$tstack recall the export work from last week.
```

`recall` reads your recent agent sessions and the shared record, such as issues and fixes, and hands back a short brief on where things stand.
Your old sessions hold context that a fresh agent lacks, so load it first, then hand over the new input:

```text
$tstack recall my work on the virtualized list from yesterday, then read this bug report.
```

## Learn from another project with a deep dive

```text
$tstack deep dive on https://github.com/acme/widgets. Which of its features would improve this project? Ideas only, copy nothing.
```

The [Deep dive playbook](../../skills/tstack/playbooks/deep-dive.md) clones the other project into the task folder at a recorded commit, and changes neither project.
Before anyone reads the code, it settles how much you may take: copy with a notice in your license file, adapt in your own words, or ideas only.
Name the rule in your request, as "Ideas only, copy nothing" does, and the lead records your words instead of asking.
Four or five read-only explorers each read one area, and the lead checks every claim their candidates rest on against both codebases.
You get a table ranked against your current design and one question: which candidates to take.
Each one you take becomes a line you start as its own task, and the rest go in the report's follow-ups with the reason each was left.
To review only what changed since you last took from the project, name the commit you took last.

## Why this comes first

The Feature and Refactoring playbooks start by running `how` over the code they touch.
Bug fix reproduces first, then runs `how` and `why` in its second step.
The design and the fix are built on that traced model.
An agent that starts editing without one tends to fix the symptom at the first plausible spot.
