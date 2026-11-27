# tstack on Herdr

This guide shows how tstack maps onto Herdr, and how to check on running work.
[runtime-herdr.md](../../skills/tstack/references/runtime-herdr.md) owns the exact commands the agents run.

## What runs where

| Role | In Herdr | Checkout |
| --- | --- | --- |
| Lead | An agent in the pane where you started it. When the task moves, an agent named `<task id>-lead` in a new tab labelled with the task ID | Its own worktree under `~/.tstack/worktrees/<project>/<task id>`, on branch `task/<task id>` |
| Worker | An agent named `<task id>-<name>` in a pane beside the lead | The lead's worktree |
| Coordinator | Only for an autopilot: the agent in the pane where you asked for it, named `coordinator-<project>` | The project folder |

## Start a task

Open a Herdr pane, start Claude Code, Codex or Pi there, and invoke tstack with your goal and how you will know it is done:

| Harness | Command |
| --- | --- |
| Claude Code | `/tstack` |
| Codex | `$tstack` |
| Pi | `/skill:tstack` |

Your Herdr tabs are your task list, one per task.

A pane at the project root is the primary checkout, and a ship task does not run there.
The lead cuts a worktree on `task/<task id>`, opens a new tab labelled with the task ID, and starts a new lead on the `lead` seat in your models file.
It tells you which tab to continue in, and stops.
A read-only question can run in any checkout.

## How leads launch

A lead that moves its task, and a coordinator that starts leads, launch each with the model, effort and autonomy flags its seat names:

| Harness | Autonomy flags |
| --- | --- |
| Claude Code | `--permission-mode auto --prompt-suggestions false` |
| Codex | `--dangerously-bypass-approvals-and-sandbox` |
| Grok Build | `--permission-mode bypassPermissions` |
| Pi | none |

To change them, add a `herdr args <harness>: <flags>` line to `~/.tstack/models.md`.
Only that file may hold such a line.

A lead that an autopilot's coordinator launched reports by typing into the coordinator's pane, but only once the coordinator is idle.
What a busy agent does with a typed message depends on its harness, so leads wait first, and never type into an agent that shows an approval or a question.
Per Herdr 0.9.5 help and docs (2026-11-27); not yet measured live.

If a new agent stops at startup on a trust dialog, the launch reports which tab it is in.
Answer it yourself.
tstack never answers a trust dialog.

## Check on a lead

Open the lead's tab and ask it where the task stands.
From a shell, `herdr agent get <lead name>` shows the state of a lead that moved to its own tab.
The lead name is `<task id>-lead`, or a suffixed name such as `<task id>-lead-2` after a handoff, and whoever launches the lead, a coordinator or the lead itself, records it in `.tstack/tasks/<task id>/lead.txt`.
A `blocked` state means an approval or a question is on its screen.
Answer approvals yourself in that pane.
tstack also raises a Herdr notification naming the task's tab when it needs you.

## Stop running work

Stop the lead's turn in its pane, then tell it what to change.
The lead stops its workers and makes no commits, pushes or new workers until you tell it to go on.
To stop an autopilot, tell its coordinator, which holds every lead.
A lead counts as held only once it tells the coordinator it has stopped its workers, so ask the coordinator which leads are held and which still have a hold requested.

## After the merge

The lead removes its own worktree and `task/<task id>`, and tells you the tab can be closed.
Git refuses to remove a worktree with uncommitted changes, and the lead stops there instead of forcing it.
A clean worktree can still sit on a branch whose commits have not landed, so the lead deletes the branch only after its own check that the work landed: the merge reached the default branch for a local-only task, or the PR shows merged.
For follow-ups, the lead lists them in its final reply and adds them to `.tstack/backlog.md`, each with an ID, or files them in the tracker the project names.
To take one, open a new pane and name its ID, or its tracker issue, in your request.
