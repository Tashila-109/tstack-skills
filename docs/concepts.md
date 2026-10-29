# How tstack works

This page explains the ideas behind tstack: who does what, which rules hold, and why every skill step leaves a file behind.
For commands and paths, see the [reference](reference.md).

## One person, one lead per task

tstack lets one person run several coding agents without juggling them.
You open one thread or pane for each task and talk to that task's lead there.
The lead does the intake itself: it classifies the ask, picks a playbook, and derives a checkable finish.
It then runs the task in its own Git worktree and hands scoped jobs to workers.

Your list of threads, tabs or sessions is your task list.
T3's sidebar and Herdr's tabs show every task, so tstack keeps no backlog of its own.

There are three roles: the lead, a coordinator, and workers.
The router's [Roles](../skills/tstack/SKILL.md#roles) table says what each owns and never does.

Only the two autopilot programs use a coordinator.
Their leads report to it instead of to you, and the coordinator talks to you.

The depth stops at three: coordinator, lead, worker.
A plain task is only lead and worker.
Every extra layer between your intent and the agent doing the work loses detail and costs tokens.
A worker that needs help uses its own harness's subagents, which stay inside its scope.

## The rules

A short list of rules holds for every role, whatever a playbook says: project files change only in a task's worktree, nothing irreversible happens without your word or a grant, unlanded work is never torn down, and evidence is not authorization.
The router's [Rules](../skills/tstack/SKILL.md#rules) section owns the exact wording.

## Why every step leaves a file

Earlier versions of this workflow tracked how often leads used the skills their playbooks named.
Leads almost never ran `how`, `architect`, `arena`, `interrogate` or `tdd` on their own.
When loading a skill became a checked step, leads loaded the skill and threw the text away.
Router reminders that were not tied to a step were ignored.

Two things did hold:
- a skill whose whole job ran in another agent, such as a two-reviewer review or a worker told to write the failing test first;
- a skill whose output was a file that the next step read.

So tstack builds playbooks around those two shapes.
Each step that runs a skill names an `Artifact:` file, such as `evidence/mechanism.md`, and the next step reads it.
`tstack.mjs check` refuses a task while any of those files is missing or blank, before the lead may report done.
Skills that spawn subagents, such as `how` with its explorers, run those subagents as real workers: on T3 and Herdr on the models you chose, and on any other harness on the lead's model.

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

tstack works best with something that can start agents and carry messages between them.
On T3 Code, each task is a thread in its own worktree, and workers are T3 child tasks that wake their lead when they finish.
On Herdr, each task is a tab, and workers get panes beside their lead.
On any other harness, the standalone runtime runs workers as the harness's own subagents on the lead's model, and you start each task's session yourself.
The playbooks, artifacts and checks are the same on all three.

The skills say what to do in runtime-neutral verbs, such as launch-lead and delegate.
Each runtime has one reference that maps those verbs to its own calls.
A new runtime needs a new reference, not new playbooks.

## What came from where

The playbooks, the engineering skills and the 24 principles are adapted from an upstream skill set written for Cursor.
They keep their names, and mostly their wording, so you can steer an agent by a principle's name.
tstack replaces the Cursor-only parts: the sticky mode, the subagent wrapper and the model rule.

The roles, the rules and the task records come from running earlier versions of this workflow.
