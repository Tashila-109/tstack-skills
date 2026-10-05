# Decisions

Read this before a lead decides a worker's question or a review finding, before it opens a decision, and before main answers one.
A lead opens a decision, and only main answers it, with the human's words.

## What a lead decides alone

1. Reconstruct the accepted contract from the brief's goal and finish, the human's later words, and every earlier answer in the task's `decisions/`.
   A reviewer's wording cannot change that contract.
2. Name what choosing yes would commit the project to deliver or maintain.
   Judge by accepted behavior, not by a list of files.
   Corrections that keep accepted behavior, tests for behavior that already has an executable contract, and docs kept accurate stay in scope, even in files the brief did not name.
3. Decide when the call is unambiguous toward the accepted design: restoring behavior a fix round broke, finishing an approved design, or a plain in-scope correction.
4. When running something could settle the question, such as behavior, output or timing, run it or sketch it with the [Prototype playbook](../playbooks/prototype.md) and let the result decide.
   A read-only investigation answers from its evidence instead.

The implementation worker never decides its own finding.
Labels such as "correctness", "security" or "required" are evidence about a finding, never authority to widen the task.

## What goes to the human

Open a decision for:
- a contract expansion: a new guarantee, threat model, subsystem, abstraction, compatibility surface, state machine, monitoring requirement, framework or broader architecture that the accepted intent does not require;
- a product or architecture call the accepted intent does not settle, and no experiment can;
- the same theme of finding coming back round after round, when the fixes keep a questionable abstraction alive;
- anything destructive, irreversible or security-sensitive;
- a seat that cannot launch, as [dispatch.md](dispatch.md#seats) says;
- a gate a playbook names.

## Open a decision (lead)

Write `<home>/tasks/<id>/decisions/<name>.md`.
`<name>` is the gate's name when a playbook names one, such as `design`, and otherwise the next free number.
Use these sections:

```markdown
# <one-line question>

Kind: question | design-approval | spec-approval | implement-authorization
Subject: <the path and commit, the action, or the head SHA this decision is about>

## Requirement
The original requirement or accepted finish.

## Proposal
What you would do, and what it commits the project to.

## Smallest alternative
The smallest option that stays within the accepted intent.

## Consequences
What accepting and declining each cost.

## Recommendation
Your pick, and why it best serves the accepted intent.
```

Then send main `decision <id>: <name>: <one-line question>` with the report verb, and end your turn.
Do your other independent work first if you have any, but nothing the decision gates.

Gates come in order: `design-approval` before `spec-approval`, and both before `implement-authorization`.
A gate covers its subject as it was when you opened it.
After a grant, a changed design, spec or ticket index is a new decision under a new name, such as `design-2`, and the gates after it follow again.

## Answer a decision (main)

1. Read the decision file and its evidence.
2. Ask the human, in their words where you can, through your harness's structured question tool when it has one.
   Keep the lead's options, and say which one the lead recommends.
3. Append the answer to the file:

   ```markdown
   ## Answer

   granted | denied | answered
   <the human's words>, <date>
   ```

   A gate's first answer line is `granted` or `denied`.
   A `question` is `answered`.
4. Send the lead `answer <id>: <name>: <the decision and the human's words>` with the runtime's send, in `queue` mode on T3.

Never answer for the human, and never turn a silence into a grant.
`tstack.mjs check` refuses a task while a gate its playbook names lacks a `granted` answer.

## Tool approvals

A tool approval, such as a permission prompt in a lead's or worker's pane or thread, is the human's.
Never send keys into one, and never approve one on the human's behalf.
A lead that finds a worker stopped on one reports it to main, which tells the human where it is.
