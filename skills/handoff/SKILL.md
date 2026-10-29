---
name: handoff
description: Decide at a phase boundary whether a fresh session should take over, and if so write the handoff file it starts from. Use at a phase boundary, when the context window is running out, or when the human says handoff. An optional argument names what the next session will do.
---

# Handoff

A handoff file lets a fresh session continue the work without this session's context.
Decide first whether one is needed.

## Phase boundaries

A phase is a chunk of work that ends when you can say "done with that": the grill, the design, the implementation, the review.
Decide only at the boundary between two phases.
Mid-phase, keep working or split what is left across helpers; a summary written mid-phase loses the thread.

At a boundary, ask these in order and take the first yes:

1. **Continue?**
   Yes when the next phase needs this one's reasoning word for word, or the window still has room for it, about 150k tokens.
   Grill into design is the usual yes.
   Continuing costs nothing and loses nothing, so rule it out first.
2. **Clear?**
   Yes when nothing in this session matters to the next phase.
   Clearing a session that does matter loses the why behind the work, and reading the diff back does not recover it.
3. **Hand off?**
   Yes when the work is moving: to another harness, another directory or repository, another person, or a side task found mid-phase.
   In a tstack task, a lead whose window is out of room also hands off; see [In a tstack task](#in-a-tstack-task).
4. **Helper?**
   Yes when the next step runs without steering, such as a review of a frozen diff.
   Give it to a helper your role allows under [dispatch](../tstack/references/dispatch.md) and keep this session as it is.
5. **Otherwise compact**, with an instruction that names the next phase.

Clear and compact are commands the human types; an agent cannot run them on its own session.
Every answer except continue trades the session for a lossy summary of it, so pay that only when staying costs more.
These are judgment calls, and the same boundary can go either way.

## Write the file

Write to the path [In a tstack task](#in-a-tstack-task) gives, or, outside a task, to a new file in the OS temp directory, never the workspace.
Print the path when done.
If an argument named what the next session will do, shape the file around that.

Include:

- the goal and the next action;
- where the work stands: done, in progress, and the current branch and head;
- decisions and their reasons that no other file records, since the reasons are what a summary loses first;
- dead ends already tried;
- pointers to what already exists instead of copies of it: the brief, spec, tickets, design, ADRs, PRs, commits, and evidence files, by path or URL;
- a **Suggested skills** section naming the skills and playbooks the next session should load.

Redact secrets and personal data: API keys, tokens, passwords, and anything identifying a person.
Write `<redacted>` in their place.

## In a tstack task

A lead hands off when its window is out of room at a phase boundary; otherwise it continues or delegates.
Workers never hand off: each gets a fresh context per brief, and unfinished work goes in the result file.

1. Settle the checkout and workers as [pause-safely](../tstack/playbooks/pause-safely.md) steps 1 to 3 say.
   Commit a verified stage first if one is ready.
2. Write `tasks/<id>/evidence/handoff-N.md` under the task home, where N is one more than the highest existing handoff number, starting at 1.
   The brief and the evidence files already hold the task's identity and progress, so point at them instead of restating them.
3. Start the fresh lead as [Relaunching a lead](#relaunching-a-lead) says, then end the turn.
   A lead that a coordinator launched sends the coordinator `handoff <id>: at <boundary>, <path to the handoff file>` instead, naming the phase that ended and the one that starts, such as `at implement → review`, and the coordinator relaunches it.

## Relaunching a lead

Start a fresh lead on the same worktree and branch, once the old lead's turn has ended or, for your own handoff, as your last action.
Use the runtime's launch-lead for a handoff: [T3](../tstack/references/runtime-t3.md#launch-lead), [Herdr](../tstack/references/runtime-herdr.md#launch-lead) or [standalone](../tstack/references/runtime-standalone.md#launch-lead).

`git worktree list` shows the worktree and its branch.
Add one line under the launch block: `Pick up from <path to the handoff file>, following the session-pickup playbook.`
For your own handoff, leave the launch block's `coordinator:` line out, and tell the human which thread, tab or session to continue in.
A coordinator archives the old thread on T3 or closes the old tab on Herdr, and updates `<home>/tasks/<id>/lead.txt` with the new thread or tab.

## For a coordinator: handing off the coordinator

Hand off the coordinator itself when its own window runs short, or when the human says handoff.
The phase-boundary tree above does not apply to it.

1. Wait for a safe point:
   - no merge is half done;
   - no question to the human is half answered, and no decision is waiting on the coordinator to relay it;
   - every finished lead's `## Remember` and `## Follow-ups` are curated.

   Leave running leads alone.
2. Write `<home>/handoff/coordinator-N.md`, where N is one more than the highest existing number, starting at 1.
   Point at existing state instead of copying it, and include:
   - the next action;
   - the program file, each running task's ID, its `lead.txt`, and what the coordinator is waiting for from it;
   - open decisions, and replies owed to the human;
   - the human's standing instructions from this session, with their scope;
   - anything else only this session knows: dead ends, and the skills the next coordinator should load.

   Redact secrets and personal data as [Write the file](#write-the-file) says.
3. Tell the human the path, and to start a new thread in the primary checkout with the tstack skill and the same program.
   Then stop working in this session.

A new coordinator reads the newest `<home>/handoff/coordinator-*.md` first, as the tstack skill's [coordinator reference](../tstack/references/coordinator.md) says.
