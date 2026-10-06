# Route work through main

You give main a goal and a way to check it.
Main picks a playbook, writes the brief, and starts a lead.
This page shows what a good request looks like, and how little of one you need.
Not sure which skill or playbook fits? Run `tstack-help`.

## Say the goal and the check

```text
$tstack users get two notifications after a retry. Repro first, then fix it. Done means one retry sends one notification.
```

That is a Bug fix request.
"Repro first" is a real constraint, and the Bug fix playbook keeps it.
"Done means ..." is the finish the lead must prove before it reports done.
If you give no finish, main proposes one.

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

## What main does with it

1. Main classifies the request.
   A change to the project is a ship task.
   A question is a scout task, whose deliverable is a report and never a PR.
2. Main picks the playbook from the intake table in the router, taking the first row that fits.
3. Main writes the brief with `tstack.mjs brief`, which freezes the playbook's steps and the files each step must leave.
4. Main starts the lead in its own worktree, on branch `task/<task id>`.
5. Main tells you what started and goes quiet until the lead needs you or finishes.

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

## Switch tasks with "new task"

Main can run several leads at once.
When you change subject, say so:

```text
$tstack new task. Find out why the cache entry survives logout. Don't change any code yet.
```

"New task" starts a separate lead instead of steering the last one.

## Ask where things stand

```text
where is the notifications task?
```

Main checks the lead's state and its task folder, and answers in outcomes.
