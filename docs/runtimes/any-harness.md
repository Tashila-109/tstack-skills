# tstack on any other harness

This guide shows how tstack runs in an agent harness without T3 Code or Herdr, such as Claude Code, Codex, Cursor, OpenCode or Pi on their own.
tstack calls this the standalone runtime.
[runtime-standalone.md](../../skills/tstack/references/runtime-standalone.md) owns the exact steps the agents follow.

## What you keep and what you lose

You keep the whole workflow: intake, the playbooks, the artifact files, `tstack.mjs check`, the review rounds, the decisions, and the merge only on your word.

You lose the automation an orchestrator gives:

| On T3 or Herdr | Here |
| --- | --- |
| A lead moves its task into a new worktree and keeps going. | The lead makes the worktree, and you start a new session there. |
| Workers run on the models your models file names, so a panel mixes model families. | Workers run as your harness's own subagents, on your lead's model. A panel keeps its size but loses the second model family, and the lead says so. |
| Workers run in parallel and wake the lead when they finish. | Workers run as your harness's subagent tool allows. With no subagent tool, the lead runs each worker's brief itself, one at a time. |
| A PR review or a heartbeat wakes the lead. | Your next message wakes the lead. |
| The autopilot programs run a queue of tasks. | The lead offers to run the queue's items one task at a time. |

## Start a task

Start your agent in the project and invoke tstack with your goal and how you will know it is done:

| Harness | Command |
| --- | --- |
| Claude Code, Cursor | `/tstack` |
| Codex | `$tstack` |
| Pi | `/skill:tstack` |
| Anything else | `Read ~/.agents/skills/tstack/SKILL.md and follow it.`, then your request |

A ship task does not run in the primary checkout.
When you start at the project root, the lead makes a worktree at `~/.tstack/worktrees/<project>/<task id>` on branch `task/<task id>`.
It then gives you two things:
- the command to start a new session there, such as `cd ~/.tstack/worktrees/my-app/fix-greet && claude --permission-mode auto --add-dir ~/code/my-app`;
- a `tstack launch` block to send as that session's first message.

Start the new session, paste the block, and talk to the task's lead there.
The `--add-dir` part matters for a harness that limits where the agent may write, because the lead keeps its records in the primary checkout's `.tstack/` and commits through its `.git/`.
A read-only question can run in any checkout, so it needs no move.

To skip the move, start your agent in a worktree from the beginning.
Make one with `git worktree add`, or use your harness's own worktree mode, and invoke tstack there.

## Choose models

Setup still writes `~/.tstack/models.md`, with every seat set to `inherit`, because on this runtime every worker runs on the model your lead runs on.
To choose that model, pick it in your harness.
The seats only set how many workers a panel gets.
If you later run tstack on T3 Code or Herdr, run the setup skill there first so it can confirm a model for each role.

## Check on a lead

The lead is the session you talk to.
Ask it where the task stands.
Its evidence is in `.tstack/tasks/<task id>/` in the primary checkout.

## Stop running work

Stop the lead's turn the way your harness stops one, then tell it what to change.
The lead stops its subagents and makes no commits, pushes or new workers until you tell it to go on.

## After the merge

The lead removes its own worktree and `task/<task id>`, and tells you the session can be closed.
Git refuses to remove a worktree with work that has not landed, and the lead stops there instead of forcing it.
