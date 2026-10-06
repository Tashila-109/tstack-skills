# How tstack works

This page explains the ideas behind tstack: who does what, which rules hold, and why every skill step leaves a file behind.
For commands and paths, see the [reference](reference.md).

## One person, one lead per task

tstack lets one person run several coding agents without juggling them.
You open one thread or pane for each task and talk to that task's lead there.
The lead does the intake itself: it classifies the ask, picks a playbook, and derives a checkable finish.
It then runs the task in its own Git worktree and hands scoped jobs to workers.

Your list of threads or tabs is your task list.
T3's sidebar and Herdr's tabs show every task, so tstack keeps no backlog of its own.

Each role has a job and a list of things it never does.

| Role | Owns | Never |
| --- | --- | --- |
| Lead | One task: intake, its playbook, worktree, branch, commits, PR, worker briefs, decisions with you, the merge on your word, cleanup, its lessons | A second task, writing under `.tstack/` outside its task folder except `learnings.md` and `grants.md` |
| Coordinator | An autopilot program: its queue, launching a lead per item, relaying decisions, audits, merges under your grant | Editing project files, running a task's playbook, delegating workers, deciding for you |
| Worker | Its brief's scope, its evidence, its result file | Git writes, starting agents, addressing you |

Only the two autopilot programs use a coordinator.
Their leads report to it instead of to you, and the coordinator talks to you.

The depth stops at three: coordinator, lead, worker.
A plain task is only lead and worker.
Every extra layer between your intent and the agent doing the work loses detail and costs tokens.
A worker that needs help uses its own harness's subagents, which stay inside its scope.

## The rules

These hold for every role, whatever a playbook says:

1. Project files change only in a task's own worktree.
   The primary checkout changes only under `.tstack/`, and through the Git commands for creating a task's worktree, merging, and cleaning up on your word.
2. Merging, discarding work, and anything destructive or irreversible happen only on your explicit word for that action.
   A standing merge grant, which the lead writes to `.tstack/grants.md` only from your own words, counts as that word for the merges it covers.
3. Unlanded work is never torn down.
   When Git refuses to remove a worktree, that is a finding to look at, never an obstacle to force past.
4. A lead talks to you in its own thread.
   A lead that a coordinator launched talks to the coordinator instead.
   Workers never talk to you.
   When you type into a worker's thread, that agent follows you and says so in its next report.
5. Evidence is not authorization.
   A diagnosis or a recommendation authorizes nothing by itself.
6. Outcomes are reported faithfully, with the evidence, including failures.
7. Scripts own facts, and agents own judgment.

## Why every step leaves a file

tstack's predecessor measured how often its leads used the skills their playbooks named.
Across 38 tasks, leads almost never ran `how`, `architect`, `arena`, `interrogate` or `tdd`.
When loading a skill became a checked step, leads loaded the skill and threw the text away, such as with `tstack skill how >/dev/null`.
Router reminders that were not tied to a step fired in none of 8 tasks.

Two things did hold:
- a skill whose whole job ran in another agent, such as a two-reviewer review or a worker told to write the failing test first;
- a skill whose output was a file that the next step read.

So tstack builds playbooks around those two shapes.
Each step that runs a skill names an `Artifact:` file, such as `evidence/mechanism.md`, and the next step reads it.
`tstack.mjs check` refuses a task while any of those files is missing or blank, before the lead may report done.
Skills that spawn subagents, such as `how` with its explorers, run those subagents as real workers on the models you chose.

A file proves a step happened.
It does not prove the step was done well.
That judgment stays with the lead and with you.

## Seats and models

Skills ask for a role, such as `how explorer` or `architect runners`, never a model.
Your models file maps each role to one or more seats, each a harness, a model and an effort.
A panel of several seats on different model families gives a second opinion with different blind spots.

When a seat cannot launch, tstack stops and asks you.
It never runs your work on a model you did not choose.

## Runtimes

tstack needs something that can start agents and carry messages between them.
On T3 Code, each task is a thread in its own worktree, and workers are T3 child tasks that wake their lead when they finish.
On Herdr, each task is a tab, and workers get panes beside their lead.

The skills say what to do in runtime-neutral verbs, such as launch-lead and delegate.
Each runtime has one reference that maps those verbs to its own calls.
A new runtime needs a new reference, not new playbooks.

## What came from where

The playbooks, the engineering skills and the 24 principles are adapted from an upstream skill set written for Cursor.
They keep their names, and mostly their wording, so you can steer an agent by a principle's name.
tstack replaces the Cursor-only parts: the sticky mode, the subagent wrapper and the model rule.

The roles, the rules and the task records come from tstack's own history.
