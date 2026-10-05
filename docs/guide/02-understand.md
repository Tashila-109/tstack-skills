# Understand the code before changing it

Editing code you don't understand is how subtle regressions ship.
Four skills help: `how` explains what the code does now, `why` digs up the reasons it is shaped that way, `explain` blends both into one explanation, and `recall` rebuilds your own recent context on a topic.

Ask main for any of them, and it briefs a scout task on the Investigation playbook:

```text
$tstack how do we dedupe notifications? Is there an N+1 when we look up subscribers?
```

The lead runs the skill, writes its output to `evidence/how.md`, and turns it into `report.md`.
Main relays the findings, not just a notice that the work is done.

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

## Rebuild your context with recall

```text
$tstack recall the export work from last week.
```

`recall` reads your recent agent sessions and the shared record, such as issues and fixes, and hands back a short brief on where things stand.

## Why this comes first

The Bug fix, Feature and Refactoring playbooks all start by running `how` over the code they touch, and Bug fix runs `why` too.
Their first artifact is that traced model, and the design and the fix are built on it.
An agent that starts editing without one tends to fix the symptom at the first plausible spot.
