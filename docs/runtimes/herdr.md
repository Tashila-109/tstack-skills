# tstack on Herdr

This guide shows how tstack maps onto Herdr, and how to check on running work.
[runtime-herdr.md](../../skills/tstack/references/runtime-herdr.md) owns the exact commands the agents run.

## What runs where

| Role | In Herdr | Checkout |
| --- | --- | --- |
| Main | The agent in the pane where you started it, named `main-<project>` | The project folder |
| Lead | An agent named `<task id>-lead` in a new tab labelled with the task ID | Its own worktree under `~/.tstack/worktrees/<project>/<task id>`, on branch `task/<task id>` |
| Worker | An agent named `<task id>-<name>` in a pane beside the lead | The lead's worktree |

## Start main

Open a Herdr pane in the project's primary checkout, start Claude Code, Codex or Pi there, and invoke tstack:

| Harness | Command |
| --- | --- |
| Claude Code | `/tstack` |
| Codex | `$tstack` |
| Pi | `/skill:tstack` |

Main names its own pane, so leads can reach it.

## How leads launch and report

Main starts each lead with the model, effort and autonomy flags its seat names:

| Harness | Autonomy flags |
| --- | --- |
| Claude Code | `--permission-mode auto` |
| Codex | `--dangerously-bypass-approvals-and-sandbox` |
| Grok Build | `--permission-mode bypassPermissions` |
| Pi | none |

To change them, add a `herdr args <harness>: <flags>` line to `~/.tstack/models.md`.
Only that file may hold such a line.

A lead reports by typing into main's pane, but only once main is idle.
A message typed into a busy agent takes over its turn, so leads wait for main first.

If a new agent stops at startup on a trust dialog, the launch reports which tab it is in.
Answer it yourself.
tstack never answers a trust dialog.

## Check on a lead

Ask main where a task stands, or look at the lead's tab yourself.
From a shell, `herdr agent get <task id>-lead` shows its state.
A `blocked` state means an approval or a question is on its screen.
Answer approvals yourself in that pane.

## After the merge

Main closes the lead's tab, removes its worktree, and deletes `task/<task id>`.
Git refuses to remove a worktree with work that has not landed, and main stops there instead of forcing it.
