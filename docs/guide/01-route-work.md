# Start a task

You open one thread or pane per task and give its lead a goal and a way to check it.
The lead picks a playbook and runs the task.
This page shows how to open the thread, what a good request looks like, and how little of one you need.
Not sure which skill or playbook fits? Ask `tstack-help`.

The examples in this guide start with `$tstack`, the form Codex and T3 use.
In Claude Code or Cursor, type `/tstack` instead, and in Pi `/skill:tstack`, as the [invocations table](../reference.md#invocations) shows.

## One thread per task

Open a new thread for each task, and talk to that task's lead there.
Your threads or tabs are your task list.
When you change subject, open a new thread instead of steering the last one.

- **On T3**, open the thread in **New worktree** mode, pick the default branch as its base, and send `$tstack` with your request.
  T3 names the branch, and the thread runs on the model you picked in the composer.
- **On Herdr**, open a pane, start your harness, and invoke tstack with your request.
  A ship task started at the project root moves into its own tab, and the lead tells you which one to continue in.
- **On any other harness**, start your agent in the project and invoke tstack with your request.
  A ship task started at the project root gets its own worktree, and the lead tells you the folder to start a new session in and the message to send there.

[T3 Code](../runtimes/t3.md), [Herdr](../runtimes/herdr.md) and [any other harness](../runtimes/any-harness.md) cover each runtime.

## Say the goal and the check

```text
$tstack users get two notifications after a retry. Repro first, then fix it. Done means one retry sends one notification.
```

That is a Bug fix request.
"Repro first" is a real constraint, and the Bug fix playbook keeps it.
"Done means ..." is the finish the lead must prove before it reports done.
If you give no finish, the lead proposes one.

You do not name a playbook or list skills.
The playbook holds the order of the steps, and a hand-written list of skills usually drops or reorders steps the playbook would have kept.
Name a skill only when you want to override one choice.

## What goes in a prompt

A useful prompt carries up to five things, and each fits in a sentence:
- **The goal.** Say what is wrong, or what you want.
- **The done check.** It must be able to pass or fail. "Make it better" and "work on it for an hour" are not checks.
- **The proof to show.** Ask for the real command output, the stored value, a recording of the flow, or a before and after number.
- **What you already know.** A symptom, a repro step, a log line or a link saves the agent a search.
- **The real constraints.** "Repro first", "don't change any code yet", "zero behavior change" and "let me review before proceeding" each change what the lead does.

Two things are worth leaving out:
- **The how.** Say what to achieve, and leave room for a better path than the one you would pick.
- **Your theory of the cause, at first.** A stated guess narrows the search to wherever you pointed.
  Let the agent restate the problem before you share your hunch.

For a noisy report, such as a long thread or a vague bug, make the restatement the first step:

```text
$tstack read this thread. restate the underlying issue in your own words, in plain english. Don't change any code yet.
```

A misreading shows up in the restatement, before any code exists.
Correct it there, and it costs one message instead of one wrong fix.

## What the lead does with it

1. The lead classifies the request.
   A change to the project is a ship task.
   A question is a scout task, whose deliverable is a report and never a PR.
2. It picks the playbook from the intake table in the router, taking the first row that fits.
3. It derives a checkable finish if you gave none, and picks the delivery: usually `local-only`, or `pr` when you asked for one, as the router's [Intake](../../skills/tstack/SKILL.md#intake) says.
4. It writes the brief with `tstack.mjs brief`, which freezes the playbook's steps and the files each step must leave.
5. It tells you in one line which playbook, finish and delivery it chose, then runs the playbook.

## Prompts that route well

A feature names the behavior and what must not change:

```text
$tstack add a --json flag. The text output stays byte-identical. Verify both forms.
```

A refactor pins behavior before structure moves:

```text
$tstack move the parsing into one module, with zero behavior change. Record the current output first and prove it is unchanged after.
```

A question asks for an answer, not a change:

```text
$tstack how does the cache decide when an entry is stale? Don't change any code.
```

A big or vague effort goes to the figure-it-out playbook, which designs the run's phases before any code:

```text
$tstack migrate every caller from the sync store to the async one, with identical behavior. I want to review it tomorrow.
```
