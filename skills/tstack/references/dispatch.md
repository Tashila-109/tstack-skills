# Dispatch

Read this before you launch a lead, delegate a worker, or run a skill that spawns subagents.
It owns the verbs, seats, depth, and how to read skill text written for Cursor.
The runtime reference owns the exact calls: [runtime-t3.md](runtime-t3.md) when the `t3-code` MCP tools are present, [runtime-herdr.md](runtime-herdr.md) when `HERDR_ENV=1`.
If neither applies, stop and tell the human that tstack needs T3 Code or Herdr.

`tstack.mjs` below means `node <tstack skill directory>/scripts/tstack.mjs`.

## Verbs

| Verb | Who | What it does |
| --- | --- | --- |
| launch-lead | a lead moving or handing off its own task, or a coordinator | Start a lead with the launch block below as its first message, in a new worktree, or in the task's existing worktree for a handoff. |
| delegate | lead, or a skill the lead runs | Start a worker on a seat with a written brief. Launch every independent worker before you wait on any. |
| collect | lead | Read a finished worker's result file and verdict. |
| report | a coordinator's lead | Send the coordinator a message without interrupting it. |
| notify | lead | Send another task's lead a message without interrupting it, such as a hold before a plan amendment or the granted change after it. Find its thread or agent in that task's `lead.txt`, or ask the human. Start the message with `from <your task id> lead:`. |
| decide | lead | Write a decision file and put it to the human, as [decisions.md](decisions.md) says. |
| watch-pr | lead | Wait for the PR's next verdict from `tstack.mjs pr-state`, which reads checks, review threads, conflicts and the base, without a sleep loop of your own. |
| hold | coordinator | Stop a lead's turn at once, on the human's stop. The held lead stops its running workers, as the runtime reference's collect says, makes no commits, pushes or new workers, and waits for the coordinator's release. A lead the human talks to is held by the human's own stop. |

### The launch block

launch-lead sends this as the lead's first message, with every path absolute:

```text
tstack launch
role: lead
task: <id>
home: <primary checkout>/.tstack
brief: <home>/tasks/<id>/brief.md
coordinator: <the coordinator's T3 thread id or Herdr agent name; leave the line out for a lead the human talks to>
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
Stop and ask the human to run `tstack-setup`.

When a seat fails to launch, because the provider is down, logged out, or lacks the model:
- a single-seat role stops, and the lead asks the human;
  on T3, `tstack.mjs check-seats` on a saved `orchestrator_capabilities` result names each failing seat, and the ID its model goes by when only the provider prefix differs;
- a panel continues with the seats that launched, and the result names each dropout.

Never run a seat on a different model than the one configured without the human's word.

## Depth

tstack depth is lead → worker, or coordinator → lead → worker in an autopilot program.

| Role | May | Never |
| --- | --- | --- |
| coordinator | launch-lead | delegate, write project files, run a task's playbook |
| lead | delegate; use its harness's own subagents for its own scoped reading; launch-lead to move or hand off its own task | launch a lead for another task |
| worker | use its harness's own subagents, on `inherit`, for its own scope | delegate, launch-lead, address the human or a coordinator, write Git |

A worker that runs a skill which spawns subagents, such as `how` with explorers, uses its harness's own subagent tool instead of delegate.
Its own subagents never write Git and never write tstack records.

## Reading text written for Cursor

Many skills and playbooks here were written for Cursor.
Read their Cursor terms this way:

| The text says | Do |
| --- | --- |
| Spawn a `Task` subagent, `subagent_type: generalPurpose`, with a `model` for a role | delegate on that role's seats from the models file, with [worker-preamble.md](worker-preamble.md). |
| `subagent_type: "comment-sicko"` | delegate on the `comment sicko` role, with the brief set to [the no-comments skill's Comment Sicko prompt](../../no-comments/references/comment-sicko.md) plus the scope. |
| `readonly: true` | Say "read-only: change no files" in the worker brief. |
| `run_in_background: true`, `environment: "cloud"`, `cloud_base_branch` | Ignore. Workers run on this machine, and delegate never blocks. |
| A role default such as `claude-opus-5-5-max`, used when the rule line is missing | Ignore. A missing line is a refusal, per Seats. |
| "If the Task tool rejects a slug, use the default" | Ignore. A seat that fails follows Seats. |
| Cursor's `/loop` | The runtime's wakes: a worker's completion, the human's message, a lead's report to its coordinator, or watch-pr. |
| `AskQuestion` | A lead uses decide, which asks the human. A worker writes `BLOCKED` in its result. |
| The agent store | `<home>/tasks/<id>/` for task records. |
| `agent-transcripts/`, or a transcript path under `~/.cursor/` | The runtime reference's History section. |
| `.cursor/skills/` in a project, `~/.cursor/skills/`, or `~/.cursor/plugins/` | `.agents/skills/` in the project, `~/.agents/skills/`, or the harness's own plugin folder. |
| The `mcps/` folder Cursor exposes | The MCP tools your harness lists. |
| `create-skill` | The [writing-for-agents skill](../../writing-for-agents/SKILL.md). |
| `control-cli`, `control-ui` | The project's `verify-*` skill, or [create-verification-skill](../../create-verification-skill/SKILL.md) if it has none. On T3, the tools in [Proving on the real surface](runtime-t3.md#proving-on-the-real-surface) drive a web UI or a simulator. |
| A worktree "off main" for a subagent | Workers share the lead's worktree. A candidate that needs its own checkout gets one through the runtime reference. |
| A subagent opens a PR or merges | Only the lead opens PRs, and only the lead or a coordinator merges, on the human's word. |

## Briefs

The brief is the product: a worker cannot ask you a question.
Every worker gets its own name, and so does each seat of a panel, such as `arena-runner-1` and `arena-runner-2`, so no two share a brief, a result, or a T3 request key.
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

A worker writes its result once, to the result path its preamble names, normally `<home>/tasks/<id>/results/<name>.md`, and ends with one verdict line: `DONE <summary>`, `BLOCKED <why>`, or `FAILED <why>`, as the [worker preamble](worker-preamble.md) says.
When a skill says a subagent returns its output in its response, such as reflect's reviewers or a swarm worker's report, that output goes in the worker's result file: on T3 you get back only its final line.
You own every worker's work.
Review the diff yourself and write your own summary.
Do not pass on what the worker said.
A second opinion is the same brief on a different model, and agreement is high signal.

`tstack.mjs check` refuses a task while a brief under `briefs/` has no result with a verdict line.
A worker you cancel, or a brief you never sent, still gets a result: `FAILED <why it never finished>`.

Give new work to a fresh worker with consolidated scope: the original brief, every later direction, and the previous result.
Continue an existing worker only when the work needs state that worker alone holds, such as uncommitted changes or a process it still runs.
