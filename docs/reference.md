# Reference

Facts about tstack-skills, for lookup.
The router, [skills/tstack/SKILL.md](../skills/tstack/SKILL.md), owns how agents use them.

## Invocations

| Harness | Setup | Start a task |
| --- | --- | --- |
| Claude Code | `/tstack-setup` | `/tstack` |
| Codex, or any T3 thread | `$tstack-setup` | `$tstack` |
| Pi | `/skill:tstack-setup` | `/skill:tstack` |

You invoke tstack in the thread or pane you open for a task, and that agent becomes the task's lead.
Workers, and leads that a coordinator or a move or handoff starts, never need an invocation.
Their first message is a `tstack launch` block naming their role, and they read the router by its path.

## Install modes

| Mode | Command | Where the skills land | Worktrees |
| --- | --- | --- | --- |
| Global (default) | `npx skills add Tashila-109/tstack-skills -g -a claude-code codex pi -y` | `~/.agents/skills`, linked from `~/.claude/skills` and `~/.pi/agent/skills` | Every worktree sees them. |
| Per project | the same, without `-g`, run in the project | `.agents/skills`, `.claude/skills`, `.pi/skills`, and `skills-lock.json` | `tstack.mjs link-skills` links them into each new worktree. |

Installs are copies.
Rerun the command after the source changes.
Every skill marked `disable-model-invocation: true` carries `agents/openai.yaml` with `allow_implicit_invocation: false`, so Codex loads it only when asked.
Eight skills that agents may invoke on their own have no such file: `codebase-design`, `domain-modeling`, `grilling`, `handoff`, `to-spec`, `to-tickets`, `two-axis-review` and `writing-for-agents`.

## Files

| Path | Written by | Holds |
| --- | --- | --- |
| `~/.tstack/models.md` | `tstack-setup` | The seats for every role, the budget, the `t3 instances` line, and any `herdr args` lines. |
| `<project>/.tstack/models.md` | `tstack-setup`, on request | Lines that differ for this project. It may not hold `herdr args` lines. |
| `<project>/.tstack/grants.md` | lead or coordinator, from your words | Standing merge grants, each in the human's words with its date and what it covers. |
| `<project>/.tstack/learnings.md` | lead or coordinator | One-line lessons, which `tstack.mjs brief` copies into every new brief. |
| `<project>/.tstack/autopilot-<name>.md` | coordinator | An autopilot's queue, its order, and the human's merge grant in their words. |
| `<project>/.tstack/tasks/<id>/task.json` | `tstack.mjs brief` | The frozen playbook steps and the artifacts each step must write. |
| `<project>/.tstack/tasks/<id>/brief.md` | `tstack.mjs brief` | The goal, the finish, the steps, and the learnings. |
| `<project>/.tstack/tasks/<id>/lead.txt` | coordinator | An autopilot lead's T3 thread ID, or its Herdr tab and worktree. |
| `<project>/.tstack/tasks/<id>/evidence/` | lead | One file per `Artifact:` line, any other proof the lead keeps, and `handoff-N.md` when the lead hands off to a fresh session. |
| `<project>/.tstack/tasks/<id>/briefs/<name>.md` | lead | Each worker's brief. |
| `<project>/.tstack/tasks/<id>/results/<name>.md` | worker | Each worker's result. |
| `<project>/.tstack/tasks/<id>/decisions/<name>.md` | lead | A question for the human, and their answer under `## Answer`, whose first line is `granted`, `denied` or `answered`. |
| `<project>/.tstack/handoff/coordinator-<n>.md` | coordinator | A handoff for the next coordinator session. |
| `<project>/.tstack/tasks/<id>/report.md` | lead | The final report, with `## Remember` and `## Follow-ups`. |

`<project>` is always the primary checkout, even when an agent runs in a worktree.
`.tstack/` is excluded through `.git/info/exclude`.

## tstack.mjs

Run it as `node <tstack skill directory>/scripts/tstack.mjs <command>`.
It needs Node 20 or newer, or Bun, and no packages.

| Command | Does |
| --- | --- |
| `home` | Prints `<primary checkout>/.tstack`, from any checkout of the project. |
| `brief <id> --playbook <name> --goal <text> --finish <text> [--kind ship\|scout] [--delivery local-only\|pr]` | Creates the task directory with `task.json` and `brief.md`. Refuses an existing task ID. |
| `check <id> [--through <step>]` | Refuses until every artifact frozen for the task, and every artifact its playbook names, exists and is not blank. An artifact under `decisions/` also needs a `granted` answer. Without `--through`, it also requires `report.md`, and with `pr` delivery `evidence/babysit.md`. |
| `seat <role> --runtime t3\|herdr [--cross <model>]` | Prints one JSON line per seat: a T3 target, or a Herdr kind with its launch flags. With `--cross`, prints only the first seat whose model family differs from `<model>`'s, such as `gpt` for `claude-opus-5-5`. |
| `check-seats <file>` | Checks every seat in the models files against a saved T3 `orchestrator_capabilities` result: the instance can run child tasks, the model is advertised, and the effort value is offered. Names the advertised ID when only a provider prefix differs. |
| `exclude [--project-skills]` | Adds `/.tstack/`, and with the flag each per-project skill path, to `.git/info/exclude`. |
| `link-skills <worktree>` | Links a per-project install into a linked worktree. |

`scripts/check-plan.mjs <spec.md>` checks a multi-phase spec's structure: its sections in order, and unit, live and performance boxes in every phase, with a regression lane against trunk.
It prints one summary line per phase and the problem count, and exits 1 when there is a problem.

Exit codes are 0 for success, 1 for a refusal with its reason on stderr, 2 for a usage error, and 3 for anything unexpected.

## Models file

Each line is `<role>[, <role>...]: <seat>[, <seat>...]`.

- A seat is `harness/model@effort`.
  The model ID is the harness's own, so a Pi model is `provider/model`.
  The `@effort` part is optional.
  It counts as an effort only when it names one: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`, `ultracode` or `ultrathink`.
- The harness is `claude`, `codex`, `pi` or `grok`.
  `grok` is Grok Build, for worker seats, and the `t3 instances` line maps it to T3's Grok provider.
- `inherit` runs the role on the caller's own harness and model.
- A list of seats is a panel, with one agent per seat.
- A combined role a skill names, such as `reflect judgment, divergent, synthesizer`, resolves by its first role.
- `lead <playbook>` overrides `lead` for one playbook.
- `t3 instances: <harness>=<instance>/<effort option>, ...` maps harness names to T3 provider instances.
- `herdr args <harness>: <flags>` replaces a harness's autonomy flags on Herdr, and only `~/.tstack/models.md` may hold it.

| Role | Used by |
| --- | --- |
| `lead` | leads that launch-lead starts: a move out of the primary checkout, a handoff, or a coordinator's queue item |
| `feature`, `refactoring`, `bug-fix`, `perf-issue`, `hillclimb` | the playbook of that name, for its code-writing workers |
| `judgment and prose`, `hardest tasks` | any playbook, for judgment-heavy work or the hardest changes |
| `how explorer`, `how explainer` | the how skill |
| `why investigators`, `why synthesizer` | the why skill |
| `architect runners` | the architect skill |
| `arena runners`, `arena cross-judge pool` | the arena skill |
| `interrogate reviewers` | the interrogate skill |
| `swarm workers` | the swarm skill |
| `reflect tooling`, `reflect judgment`, `reflect divergent`, `reflect synthesizer` | the reflect skill |
| `comment sicko` | the no-comments skill |
| `review` | the two-axis-review skill, where the first seat reviews standards and the second spec, and Opening a PR's cross-model review, which takes the first seat outside the lead's model family |
| `verify` | the shipping playbook's per-PR verifiers, and the autopilots' live lanes |

## Verbs

[dispatch.md](../skills/tstack/references/dispatch.md) owns the verbs, and each runtime reference owns their calls.

| Verb | Who | Does |
| --- | --- | --- |
| launch-lead | lead, to move or hand off its own task, or a coordinator | Starts a lead in a new worktree on `task/<id>`, or in the task's existing worktree for a handoff. |
| delegate | lead | Starts a worker on a seat with a written brief. |
| collect | lead | Reads a finished worker's result. |
| report | a coordinator's lead | Messages the coordinator without interrupting it. |
| decide | lead | Writes a decision file and asks you in its thread. A coordinator's lead sends it to the coordinator. |
| watch-pr | lead | Gets woken by the PR's checks and reviews. |
| hold | coordinator | Stops a lead's turn at once on your stop, until you release it. A lead you talk to is held by your own stop. |

## Playbooks

The lead picks one per task from the [router's intake table](../skills/tstack/SKILL.md#playbooks).

| Status | Playbooks |
| --- | --- |
| Adapted, so `check` enforces each step's artifact | investigation, gardener, multi-phase-plan, orchestrate, babysit, shipping, bug-fix, feature, refactoring, figure-it-out, opening-a-pr |
| As written with `Artifact:` lines, so `check` enforces the files they name | runtime-forensics, trace-forensics, prototype, visual-parity, eval, authoring-a-skill, hillclimb, perf-issue, autonomous-run |
| As written, so `check` enforces only `report.md` | session-pickup, pause-safely, worktree-cleanup |
| Run by a coordinator across several tasks | autopilot-full, autopilot-stack |

## Skills

| Group | Skills |
| --- | --- |
| Router and setup | `tstack`, `tstack-setup`, `tstack-help` |
| Understand | `how`, `why`, `explain`, `recall`, `teach` |
| Plan | `grilling`, `grill-with-docs`, `domain-modeling`, `codebase-design`, `to-spec`, `to-tickets` |
| Design | `architect`, `arena`, `swarm`, `interrogate`, `figure-it-out` |
| Build and clean | `tdd`, `no-comments`, `unslop`, `technical-writing`, `typescript-best-practices`, `blast-radius`, `benchmark-checklist` |
| Review and verify | `two-axis-review`, `create-verification-skill`, `maintain-verification-skill` |
| Record and improve | `show-me-your-work`, `handoff`, `reflect`, `correct`, `bro`, `writing-for-agents` |
| Principles | 24 `principle-*` skills, indexed in the router |

Two close calls:
- `explain` is a quick explanation in this session, of code in front of you, built from `how` and `why`.
- `teach` runs a learning workspace over several sessions, with a mission, lessons and learning records.

`tstack-help` answers "which skill do I use" with one prompt to send, and never starts work.
Ask it with `/tstack-help`, `$tstack-help` or `/skill:tstack-help`.
