---
name: tstack-help
description: Answer a question about tstack and pick the skill or playbook for a task, with one prompt the human can send. Use for /tstack-help, $tstack-help, /skill:tstack-help, "which skill do I use", "how do I use tstack", or "my tstack run went wrong".
disable-model-invocation: true
---

# tstack help

## The rule

A help question gets an answer and one prompt the human can send.
It never starts work, because a tstack run spends real tokens and the human asked how.
A request for work, such as "fix this bug", is not a help question.
Hand it to the [tstack router](../tstack/SKILL.md) and say so in one line.

Read the file you route to before you quote it, and trust it over this map.
Give the human the public copy of a guide page, as an absolute link.
The guide is at `https://github.com/Tashila-109/tstack-skills/blob/main/docs/guide/<page>.md`, and its pages are:
- [01-route-work](https://github.com/Tashila-109/tstack-skills/blob/main/docs/guide/01-route-work.md): one thread per task, and what goes in the prompt;
- [02-understand](https://github.com/Tashila-109/tstack-skills/blob/main/docs/guide/02-understand.md): `how`, `why`, `explain`, `recall`;
- [03-design](https://github.com/Tashila-109/tstack-skills/blob/main/docs/guide/03-design.md): `architect`, `arena`, `swarm`, `interrogate`, prototypes, plans;
- [04-build-and-clean](https://github.com/Tashila-109/tstack-skills/blob/main/docs/guide/04-build-and-clean.md): the build playbooks and the cleanup;
- [05-verify-and-ship](https://github.com/Tashila-109/tstack-skills/blob/main/docs/guide/05-verify-and-ship.md): proof, verification skills, merging;
- [06-run-while-away](https://github.com/Tashila-109/tstack-skills/blob/main/docs/guide/06-run-while-away.md): autonomous runs and autopilots;
- [07-principles](https://github.com/Tashila-109/tstack-skills/blob/main/docs/guide/07-principles.md): steering by principle name;
- [08-plan-across-phases](https://github.com/Tashila-109/tstack-skills/blob/main/docs/guide/08-plan-across-phases.md): multi-phase plan, orchestrate, and the grill, spec and tickets skills;
- [09-recipes-and-pitfalls](https://github.com/Tashila-109/tstack-skills/blob/main/docs/guide/09-recipes-and-pitfalls.md): prompts to copy and mistakes to avoid.

## Check the state

Check what changes the answer, and mention it only when it does:
- No `~/.tstack/models.md` means setup has not run.
  Point to [tstack-setup](../tstack-setup/SKILL.md).
- No `verify-*` skill in the project means agents have no scripted way to drive the app.
  Mention [create-verification-skill](../create-verification-skill/SKILL.md) when the question is about proving a change works.

If cost is the worry, point to "Keep the cost in check" in [getting started](https://github.com/Tashila-109/tstack-skills/blob/main/docs/getting-started.md).

## Pick a skill or playbook

The default answer is `$tstack` with a goal and a check that can pass or fail.
The router picks the playbook, and the playbook runs the skills its steps need.
Name a skill directly only when the human wants more or less of it than the playbook gives.
Read the skill before you recommend it, and give one example prompt.

| The human wants to | Use |
| --- | --- |
| Do any non-trivial task with rigor | the [router](../tstack/SKILL.md) |
| Know how code works now, or where new code should live | [how](../how/SKILL.md) |
| Know why code is shaped this way, or where a number came from | [why](../why/SKILL.md) |
| Understand a change or subsystem in this session | [explain](../explain/SKILL.md) |
| Learn a topic over several sessions | [teach](../teach/SKILL.md) |
| Catch up on their own recent work on a topic | [recall](../recall/SKILL.md) |
| Get findings with no code change | the [investigation](../tstack/playbooks/investigation.md) playbook |
| Diagnose a live symptom, or a captured profile, with no fix yet | [runtime-forensics](../tstack/playbooks/runtime-forensics.md) or [trace-forensics](../tstack/playbooks/trace-forensics.md) |
| Find what a small diff could break outside itself | [blast-radius](../blast-radius/SKILL.md) |
| Settle types and module shape before code | [architect](../architect/SKILL.md) |
| Get several attempts at one brief, merged | [arena](../arena/SKILL.md) |
| Check many slices in parallel | [swarm](../swarm/SKILL.md) |
| Have other models try to break a diff | [interrogate](../interrogate/SKILL.md) |
| Settle an open design question by running a sketch | the [prototype](../tstack/playbooks/prototype.md) playbook |
| Plan work in phases, with no build | the [multi-phase-plan](../tstack/playbooks/multi-phase-plan.md) playbook |
| Plan work in phases and build it | the [orchestrate](../tstack/playbooks/orchestrate.md) playbook |
| Stress-test a plan, or write a spec or tickets | [grilling](../grilling/SKILL.md), [to-spec](../to-spec/SKILL.md), [to-tickets](../to-tickets/SKILL.md) |
| Fix a bug, add a feature, or restructure code | the [bug-fix](../tstack/playbooks/bug-fix.md), [feature](../tstack/playbooks/feature.md) or [refactoring](../tstack/playbooks/refactoring.md) playbook |
| Fix a bug test-first | [tdd](../tdd/SKILL.md) |
| Improve a measured number | the [perf-issue](../tstack/playbooks/perf-issue.md) or [hillclimb](../tstack/playbooks/hillclimb.md) playbook |
| Vet a speedup before reporting it | [benchmark-checklist](../benchmark-checklist/SKILL.md) |
| Match two UIs pixel for pixel | the [visual-parity](../tstack/playbooks/visual-parity.md) playbook |
| Strip comments with a reviewer who did not write them | [no-comments](../no-comments/SKILL.md) |
| Clean AI tells out of prose | [unslop](../unslop/SKILL.md) |
| Write docs, a README, or a PR description to a standard | [technical-writing](../technical-writing/SKILL.md) |
| Hear the last reply again in plain words | [bro](../bro/SKILL.md) |
| Give agents a scripted way to drive the app | [create-verification-skill](../create-verification-skill/SKILL.md), then [maintain-verification-skill](../maintain-verification-skill/SKILL.md) |
| Open a PR, drive it to merge-ready, or land a stack | the [opening-a-pr](../tstack/playbooks/opening-a-pr.md), [babysit](../tstack/playbooks/babysit.md) or [shipping](../tstack/playbooks/shipping.md) playbook |
| Run toward a checkable target, or a large change they review later | the [autonomous-run](../tstack/playbooks/autonomous-run.md) or [figure-it-out](../tstack/playbooks/figure-it-out.md) playbook |
| Work through a queue of changes | the [autopilot-full](../tstack/playbooks/autopilot-full.md) or [autopilot-stack](../tstack/playbooks/autopilot-stack.md) playbook |
| Keep a decision trail for unattended work | [show-me-your-work](../show-me-your-work/SKILL.md) |
| Hand a full session to a fresh one, or resume or pause work | [handoff](../handoff/SKILL.md), the [session-pickup](../tstack/playbooks/session-pickup.md) or [pause-safely](../tstack/playbooks/pause-safely.md) playbook |
| Turn what a task taught into skill edits | [reflect](../reflect/SKILL.md) |
| Stop agents repeating a mistake in this repo | [correct](../correct/SKILL.md) |
| Write or edit a skill, playbook or brief | [writing-for-agents](../writing-for-agents/SKILL.md) |
| Pick models for each role | [tstack-setup](../tstack-setup/SKILL.md) |

If a skill beside this one is missing from the table, read its frontmatter and route by its description.
The `principle-*` skills are indexed in the router, and the human steers with their names, as [07-principles](https://github.com/Tashila-109/tstack-skills/blob/main/docs/guide/07-principles.md) shows.

## Close calls

- `how` explains what the code does now.
  `why` explains the reasons it is shaped that way.
  `explain` runs both and weaves one plain account, for one session.
  `teach` is a different job: a learning workspace over several sessions.
- `arena` gives every runner the same brief and merges the best parts into one result.
  `swarm` gives each worker its own slice, or races workers, and returns one table.
- `interrogate` reviews the diff with several models.
  `blast-radius` looks for breakage outside the diff and proves the one fact that makes the change safe.
- `recall` rebuilds the human's own context on a topic from recent sessions and the shared record.
  The `session-pickup` playbook resumes one specific prior run, and starts from the newest handoff file.
- `figure-it-out` designs one rigorous run and writes its phase list to a file.
  `orchestrate` plans and builds work that spans phases, behind the human's three gates.
  `autonomous-run` drives one task to a checkable predicate without stopping.

## Fix a bad run

| Symptom | Fix |
| --- | --- |
| The lead picked the wrong playbook | A brief freezes its playbook's steps. Open a new thread for the task and name the right playbook from the [intake table](../tstack/SKILL.md#playbooks) in the prompt. |
| A seat would not launch | A single-seat role stops and the lead asks you. Check the seat against what the runtime offers, then rerun [tstack-setup](../tstack-setup/SKILL.md). The rules are in [dispatch.md](../tstack/references/dispatch.md#seats), and on T3 `check-seats` names each failing seat. |
| A lead went quiet | Open its thread or tab. A blocked agent has an approval or question on screen, which only you answer. A lead waiting on a worker shows the worker's thread or pane. |
| A lead needs your answer | It wrote a decision file and asks you in its thread. [decisions.md](../tstack/references/decisions.md) says what goes to the human. |
| A lead is doing the wrong thing | Stop it in its thread or pane, then tell it what to change. It stops its workers and makes no commits or pushes until you say go on. Under an autopilot, tell the coordinator to stop, and it holds the lead as [T3](../tstack/references/runtime-t3.md#hold) or [Herdr](../tstack/references/runtime-herdr.md#hold) says. |
| The report claims success with no proof | Ask for the real command, output, or artifact. Steer with `apply prove it works`. |

For prompts to copy and the mistakes the first runs made, point to [09-recipes-and-pitfalls](https://github.com/Tashila-109/tstack-skills/blob/main/docs/guide/09-recipes-and-pitfalls.md).

## Invocations

| Harness | Setup | Start a task | Help |
| --- | --- | --- | --- |
| Claude Code | `/tstack-setup` | `/tstack` | `/tstack-help` |
| Codex, or any T3 thread | `$tstack-setup` | `$tstack` | `$tstack-help` |
| Pi | `/skill:tstack-setup` | `/skill:tstack` | `/skill:tstack-help` |

Open one thread or pane per task, and start it with the router's invocation and the task.
On T3, open the thread in New worktree mode.
A launched lead or worker needs no invocation: its first message names its role, and it reads the router by its path.

## Reply

Lead with the answer.
Give at most one prompt in a code block, in the human's harness syntax, then the link to the file it came from.
Keep it short unless the human asked for the whole map.
