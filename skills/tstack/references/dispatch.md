# Dispatch

Read this before you launch a lead, delegate a worker, or run a skill that spawns subagents.
It owns the verbs, seats, depth, and how to read skill text written for Cursor.
The runtime reference owns the exact calls: [runtime-t3.md](runtime-t3.md) when the `t3-code` MCP tools are present, [runtime-herdr.md](runtime-herdr.md) when `HERDR_ENV=1`.
If neither applies, stop and tell the human that tstack needs T3 Code or Herdr.

`tstack.mjs` below means `node <tstack skill directory>/scripts/tstack.mjs`.

## Verbs

| Verb | Who | What it does |
| --- | --- | --- |
| launch-lead | main | Start a lead in its own worktree on branch `task/<id>`, with the launch block below as its first message. |
| delegate | lead, or a skill the lead runs | Start a worker on a seat with a written brief. Launch every independent worker before you wait on any. |
| collect | lead | Read a finished worker's result file and verdict. |
| report | lead | Send main a message without interrupting it. |
| decide | lead | Write a decision file, report it, and end your turn until main answers. |
| watch-pr | lead | Get woken when the PR's checks finish, someone comments, or it conflicts. |
| hold | main | Stop a lead's turn at once, on the human's stop. The held lead stops its running workers, as the runtime reference's collect says, makes no commits, pushes or new workers, and waits for main's release. |

### The launch block

Main sends this as the lead's first message, with every path absolute:

```text
tstack launch
role: lead
task: <id>
home: <primary checkout>/.tstack
brief: <home>/tasks/<id>/brief.md
main: <main's T3 thread id, or main's Herdr agent name>
runtime: t3 | herdr
router: <path to the tstack skill's SKILL.md>

Read the router file in full, then follow its Lead section.
```

A worker's first message is [worker-preamble.md](worker-preamble.md), filled in.

## Seats

A role names who does the work, such as `lead`, `feature`, `how explorer`, or `architect runners`.
The models file maps each role to seats: `~/.tstack/models.md`, overridden line by line by `<home>/models.md`.
A seat is `harness/model@effort`, or `inherit` for the caller's own harness and model.
A list of seats is a panel, with one agent per seat.
`lead <playbook>` falls back to `lead`.
`herdr args <harness>` lines, which replace a harness's autonomy flags on Herdr, are read only from `~/.tstack/models.md`. A project's file that sets one is refused, because a cloned repository must not choose the flags an agent launches with.

Resolve a role with `tstack.mjs seat "<role>" --runtime t3|herdr`.
It prints one JSON line per seat, in the shape the runtime reference passes on.
Never hand-assemble a model ID, an effort option, or launch flags.

When a role has no line, the script refuses.
Stop and tell main, which asks the human to run `tstack-setup`.

When a seat fails to launch, because the provider is down, logged out, or lacks the model:
- a single-seat role stops, and the lead reports to main, which asks the human;
  on T3, `tstack.mjs check-seats` on a saved `orchestrator_capabilities` result names each failing seat, and the ID its model goes by when only the provider prefix differs;
- a panel continues with the seats that launched, and the result names each dropout.

Never run a seat on a different model than the one configured without the human's word.

## Depth

tstack depth is main → lead → worker.

| Role | May | Never |
| --- | --- | --- |
| main | launch-lead | delegate, write project files, run a playbook |
| lead | delegate; use its harness's own subagents for its own scoped reading | launch another lead |
| worker | use its harness's own subagents, on `inherit`, for its own scope | delegate, launch-lead, report to main, write Git |

A worker that runs a skill which spawns subagents, such as `how` with explorers, uses its harness's own subagent tool instead of delegate.
Its own subagents never write Git and never write tstack records.

## Reading text written for Cursor

Many skills and playbooks here were written for Cursor.
Read their Cursor terms this way:

| The text says | Do |
| --- | --- |
| Spawn a `Task` subagent, `subagent_type: generalPurpose`, with a `model` for a role | delegate on that role's seats from the models file, with [worker-preamble.md](worker-preamble.md). |
| `subagent_type: "Comment Sicko"` | delegate on the `comment sicko` role, with the brief set to [the no-comments skill's Comment Sicko prompt](../../no-comments/references/comment-sicko.md) plus the scope. |
| `readonly: true` | Say "read-only: change no files" in the worker brief. |
| `run_in_background: true`, `environment: "cloud"`, `cloud_base_branch` | Ignore. Workers run on this machine, and delegate never blocks. |
| A role default such as `claude-opus-5-5-max`, used when the rule line is missing | Ignore. A missing line is a refusal, per Seats. |
| "If the Task tool rejects a slug, use the default" | Ignore. A seat that fails follows Seats. |
| Cursor's `/loop` | The runtime's wakes: a worker's completion, a lead's report, or watch-pr. |
| `AskQuestion` | main asks the human. A lead uses decide. A worker writes `BLOCKED` in its result. |
| The agent store | `<home>/tasks/<id>/` for task records. |
| `agent-transcripts/`, or a transcript path under `~/.cursor/` | The runtime reference's History section. |
| `.cursor/skills/` in a project, `~/.cursor/skills/`, or `~/.cursor/plugins/` | `.agents/skills/` in the project, `~/.agents/skills/`, or the harness's own plugin folder. |
| The `mcps/` folder Cursor exposes | The MCP tools your harness lists. |
| `create-skill` | The [writing-for-agents skill](../../writing-for-agents/SKILL.md). |
| `control-cli`, `control-ui` | The project's `verify-*` skill, or [create-verification-skill](../../create-verification-skill/SKILL.md) if it has none. On T3, the tools in [Proving on the real surface](runtime-t3.md#proving-on-the-real-surface) drive a web UI or a simulator. |
| A worktree "off main" for a subagent | Workers share the lead's worktree. A candidate that needs its own checkout gets one through the runtime reference. |
| A subagent opens a PR or merges | Only the lead opens PRs, and only main merges, on the human's word. |

## Briefs

The brief is the product: a worker cannot ask you a question.
Write each worker brief to `<home>/tasks/<id>/briefs/<name>.md` with these fields, sized to the unit:

```text
GOAL         one sentence, the outcome
SCOPE        paths this worker may write, paths it may not, and its checkout
CONTEXT      file and PR pointers; upstream results pasted in full when this unit depends on them
ACCEPTANCE   checkable criteria, one per line
VERIFY       exact commands, plus known gotchas
SKILLS       the SKILL.md paths to read before starting
FORBIDDEN    no Git writes, no fixes outside scope, plus unit-specific bans
REPORT       what the result file must contain
```

Missing fields mean the unit is not scoped yet: do not delegate it.
A one-command unit may collapse the template to a paragraph that still names goal, scope, the verify command, and the report shape.

## Results

A worker writes its result once, to the result path its preamble names, normally `<home>/tasks/<id>/results/<name>.md`, and ends with one verdict line: `DONE <summary>`, `BLOCKED <why>`, or `FAILED <why>`.
You own every worker's work.
Review the diff yourself and write your own summary.
Do not pass on what the worker said.
A second opinion is the same brief on a different model, and agreement is high signal.

Give new work to a fresh worker with consolidated scope: the original brief, every later direction, and the previous result.
Continue an existing worker only when the work needs state that worker alone holds, such as uncommitted changes or a process it still runs.
