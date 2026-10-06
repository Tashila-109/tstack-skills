# Understand the code before changing it

Editing code you don't understand is how subtle regressions ship.
Four skills help: `how` explains what the code does now, `why` digs up the reasons it is shaped that way, `explain` blends both into one explanation, and `recall` rebuilds your own recent context on a topic.

Ask for any of them in a new thread, and the lead briefs a scout task on the Investigation playbook:

```text
$tstack how do we dedupe notifications? Is there an N+1 when we look up subscribers?
```

The lead runs the skill, writes its output to `evidence/how.md`, and turns it into `report.md`.
The lead tells you the findings, not just a notice that the work is done.

## Start with a read-only investigation

When the cause is unclear, ask for findings, not a fix:

```text
$tstack investigate why background jobs time out every few hours. Give me what we know, what data you used, and your best hypotheses. Don't change any code yet.
```

"Don't change any code yet" routes this to the [Investigation playbook](../../skills/tstack/playbooks/investigation.md).
It runs `how`, adds `why` for questions about motivation, and returns a cited explanation.
For a choice between options, it returns a recommendation with a trade-offs table.
Asking "what data you used" makes the agent separate its evidence from its guesses.
When the findings point at a fix, start the fix in a new thread.

## Trace behavior with how

`how` answers at the level of a senior engineer onboarding you onto the subsystem: the runtime flow, the key types, and the non-obvious parts.
For a narrow question, it reads and explains directly.
For a large subsystem, it first sends two to four read-only explorers on your `how explorer` seats, then an explainer on your `how explainer` seat writes one account.

## Dig up history with why

```text
$tstack why was the retry limit set to five? Does the reason still hold?
```

`why` starts from source control, then queries whatever evidence the agent's tools reach, such as the issue tracker, docs, chat, observability and error tracking.
Its report separates direct evidence from inference, and says "appears to" when the record is thin.
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

## Rebuild your context with recall

```text
$tstack recall the export work from last week.
```

`recall` reads your recent agent sessions and the shared record, such as issues and fixes, and hands back a short brief on where things stand.
Your old sessions hold context that a fresh agent lacks, so load it first, then hand over the new input:

```text
$tstack recall my work on the virtualized list from yesterday, then read this bug report.
```

## Why this comes first

The Bug fix, Feature and Refactoring playbooks all start by running `how` over the code they touch, and Bug fix runs `why` too.
Their first artifact is that traced model, and the design and the fix are built on it.
An agent that starts editing without one tends to fix the symptom at the first plausible spot.
