# Decisions

Read this before a lead decides a worker's question or a review finding, and before it opens a decision.
A lead opens a decision, and only the human answers it, except a `question` the lead takes under an away grant.

## What a lead decides alone

1. Reconstruct the accepted contract from the brief's goal and finish, the human's later words, and every earlier answer in the task's `decisions/`.
   A reviewer's wording cannot change that contract.
2. Name what choosing yes would commit the project to deliver or maintain.
   Judge by accepted behavior, not by a list of files.
   Corrections that keep accepted behavior, tests for behavior that already has an executable contract, and docs kept accurate stay in scope, even in files the brief did not name.
3. Decide when the call is unambiguous toward the accepted design: restoring behavior a fix round broke, finishing an approved design, or a plain in-scope correction.
4. When running something could settle the question, such as behavior, output or timing, run it or sketch it with the [Prototype playbook](../playbooks/prototype.md) and let the result decide.
   A read-only investigation answers from its evidence instead.

5. Judge a finding's severity yourself, whatever label the reviewer gave it.
   Another path, a rare case, a small cost, or compatibility the accepted intent does not need is a Could, unless it touches correctness of the intended case, security, or data.
   When repairs grew the diff past what the intent needs, cut it back before the next review round.

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

Kind: question | design-approval | spec-approval | close
Subject: <the path and commit, the path and its SHA-256 for a document kept out of Git, the action, or the head SHA this decision is about>

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

Then ask the human, as [Ask the human](#ask-the-human) says.

Gates come in order: `design-approval` before `spec-approval`.
A gate covers its subject as it was when you opened it.
After a grant, a changed design or spec is a new decision under a new name, such as `design-2`, and the gates after it follow again.
Write the Subject of a committed document as its path from the repository root in backticks, then `at` and the SHA, 7 to 40 hex characters, of the commit that holds the version you ask about, never a name such as `HEAD`.
For a document kept out of Git, write its path in backticks followed by its SHA-256.
`tstack.mjs check` refuses a task when either document differs from what its latest granted decision names, including an uncommitted edit.

## Ask the human

1. Start the independent work the decision does not gate, such as workers that can run meanwhile.
2. Ask the human in your thread, through your harness's structured question tool when it has one, and otherwise in plain text, ending your turn.
   Give the one-line question, the options, and which one you recommend, with the decision file's path.
3. When they answer, append it to the file:

   ```markdown
   ## Answer

   granted | denied | answered
   <the human's words>, <date>
   ```

   A gate's first answer line is `granted` or `denied`.
   A `question` is `answered`, or `taken` under an away grant, as [While the human is away](#while-the-human-is-away) says.
4. Continue with the work the decision gated.

Never answer for the human, except a `question` under an away grant, and never turn a silence into a grant.
Record the human's words as they wrote them.
`tstack.mjs check` refuses a task while a gate its playbook names lacks a `granted` answer, and while a `question` its playbook names lacks an `answered` one.

A `denied` gate stops the work it gates.
When the human said what to change, revise and open the gate again under its next name, such as `design-2`.
`tstack.mjs check` reads a gate from its highest-numbered file, so the newest answer decides it.
Otherwise close the task, as [Close a task](#close-a-task) says.

### While the human is away

When the human says they are away, such as "afk", "I'm away", "stepping out", "going to bed" or "babysit the rest", record an away grant before you go on.
Write `<home>/tasks/<id>/decisions/away.md`, or `away-2.md` and so on for a later absence:

```markdown
# Take the lead's recommendation on questions while the human is away

Kind: away
Subject: question decisions in this task until the human writes again

## Answer

granted
<the human's words>, <date>
```

Arm your heartbeat if none is armed, when the runtime has one, as its reference's Heartbeat says.
Keep running the playbook you are in, because away mode never switches playbooks.

Under the grant, answer a `question` decision yourself instead of asking it.
Take the option your Recommendation names, append the answer, and go on:

```markdown
## Answer

taken
<the option you took>, under `decisions/away.md`, <date>
```

Everything else still waits for the human: every gate, a question about anything destructive, irreversible or security-sensitive, a seat that cannot launch, and a `review-<label>` checkpoint, whose taken answer allows no more rounds.
Ask those as before, and keep doing the work they do not gate.

The grant ends at the human's next message.
Before you reply, append to the grant file:

```markdown
## Ended

<date>, when the human wrote again.
Taken: `decisions/3.md`, `decisions/4.md`
```

Open your reply with each decision you took under it: its question, the option you took, and its path.
Delete the heartbeat you armed for it.
When the human overrules a taken decision, record their answer in the next free decision file and revise the work it changed.

`tstack.mjs check` refuses a `taken` answer on any kind but `question`, and an answer that cites an away grant but does not open with `taken`.
It also refuses a taken answer whose grant is missing or not granted, or whose grant's `## Ended` section does not list it.

A coordinator and the leads it launched take no away grant, because the coordinator never decides for the human.

## Close a task

Some tasks end with nothing to merge: the bug no longer reproduces, a gate is denied, the disposition is CLOSE, or the human declines the merge.
Open a `close` decision named `close`, with the reason and its evidence, and ask the human.
A close ends this task only. Closing a PR, deleting a branch or anything else outside the task needs the human's word for that action, so name it in the Proposal when you want it.
When they grant it, write `skip: closed, see decisions/close.md` in every artifact the playbook names that is not finished, whether unwritten or written in part, such as an unanswered gate or a stale `evidence/check-plan.md`, and in `evidence/babysit.md` for `pr` delivery, write `report.md`, and follow the router's Finish.
Only in a task with a granted `decisions/close.md` does `tstack.mjs check` accept a skip line on a step that delegates, and a gate with a `denied` answer or a skip line, and it stops checking granted documents for later changes, because nothing will merge.

## For a coordinator's lead

A lead that a coordinator launched sends the coordinator `decision <id>: <name>: <one-line question>` with the report verb instead of asking the human, and ends its turn after starting its ungated work.
The coordinator reads the decision file and its evidence, asks the human as [Ask the human](#ask-the-human) says, keeping the lead's options and naming the lead's recommendation, and appends the answer.
It then sends the lead `answer <id>: <name>: <the decision and the human's words>` as the runtime reference's Talking to a lead says, in `queue` mode on T3.

## Tool approvals

A tool approval, such as a permission prompt in a lead's or worker's pane or thread, is the human's.
Never send keys into one, and never approve one on the human's behalf.
A lead that finds a worker stopped on one tells the human where it is.
