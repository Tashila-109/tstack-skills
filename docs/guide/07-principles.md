# Steer with principle names

tstack ships 24 engineering principles as skills.
Leads read the ones a step applies, and their final report names each principle and the decision it changed.
You use the names to steer: each name points at a complete rule the agent can read, so one phrase redirects work more precisely than a paragraph.

## Steering in practice

When a lead is about to add a new adapter beside three old ones:

```text
use subtract before you add. Delete the obsolete adapters first, then design what's left.
```

When a lead claims success because the build passed:

```text
apply prove it works. Run the real import and show me the written records.
```

When two attempts are about to write to the same branch:

```text
separate before serializing shared state. Give each attempt its own worktree.
```

Send these to main, which relays them to the lead, or type them into the lead's thread yourself.

A principle the report names with no decision behind it was name-dropped, not applied.
Leads may cite only principles whose `SKILL.md` they read during the task.

## The 24

The core principles decide how much to build and when to rethink:
- **Laziness Protocol**: prefer deletion and the smallest change that solves the problem.
- **Foundational Thinking**: choose the core data structures before writing logic.
- **Redesign from First Principles**: integrate a new requirement as if it had been there from day one.
- **Attack the Premise**: question the premise two failed fixes shared.
- **Subtract Before You Add**: remove dead weight before building on it.
- **Minimize Reader Load**: collapse layers and hidden state a reader must hold.
- **Outcome-Oriented Execution**: converge on the target design instead of keeping throwaway compatibility.
- **Experience First**: choose the user's result over implementation convenience.
- **Exhaust the Design Space**: build two or three competing prototypes when there is no precedent.
- **Build the Lever**: build the script that does or proves the work.

The architecture principles decide where state, validation and compatibility live:
- **Model the Domain**: encode repeated rules in one structure, not scattered conditionals.
- **Boundary Discipline**: validate at the boundary and trust internal types.
- **Type System Discipline**: make illegal states unrepresentable.
- **Make Operations Idempotent**: converge retries on the same end state.
- **Migrate Callers Then Delete Legacy APIs**: migrate and delete in one wave.
- **Separate Before Serializing Shared State**: remove the sharing before adding coordination.

The verification principles define what counts as proof:
- **Prove It Works**: verify the real artifact, not a proxy.
- **Fix Root Causes**: reproduce and trace to the cause before changing code.
- **Sequence Work into Verifiable Units**: end each small unit in a check before starting the next.
- **Test Behavior, Not Implementation**: call the code the way its users do and assert a literal expected value.
- **Explain the Number**: find what limits a measured number before trusting it.

The delegation principles keep parallel work sane:
- **Guard the Context Window**: route bulk reading to subagents and keep summaries.
- **Never Block on the Human**: proceed on reversible work and present the result.

And one meta principle:
- **Encode Lessons in Structure**: turn advice repeated twice into a check or a script.

Skim the list now, and come back when an agent does something one of these names would have prevented.
