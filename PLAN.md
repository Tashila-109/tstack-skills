# tstack-skills plan

tstack-skills packages the tstack workflow so it runs in any harness or ADE: engineering playbooks, skills and principles, plus the rules for who may do what.
The first two targets are T3 Code and Herdr.
Main, leads and workers run on Claude Code, Codex or Pi.

Written 2026-10-05 after a deep dive into tstackv2, the upstream skill set it adapts, and t3code.

## Decisions

| # | Decision | Consequence |
| --- | --- | --- |
| 1 | An independent fork of tstackv2, built for T3 and Herdr. | tstackv2 stays untouched. Its global installs are retired only after this repo proves out on real tasks. |
| 2 | Start from the upstream skill text with a thin tstack overlay. | Skill text is vendored with only names and Cursor-only model rules changed, so an upstream update ports with a small diff. The upstream revision is recorded outside this repository. |
| 3 | Enforce with artifact files and a bundled check script. | Each step that runs a skill writes a file that the next step reads. A zero-dependency script refuses to report done when a frozen artifact is missing. |
| 4 | Install globally by default, with a per-project, gitignored install as an option. | `npx skills add -g` writes `~/.agents/skills`, which Codex and Pi read, and `~/.claude/skills` links, which Claude reads. Every project and every worktree sees the same skills, with no hook needed. The per-project option excludes its folders through `.git/info/exclude`, and `tstack-setup` links them into each new worktree. Either way, a project's task state lives in its own gitignored `.tstack/`. |
| 5 | Drive Herdr directly through the `herdr` CLI. | There is no dependency on the tstack CLI. There is also no watcher, stall detector or approval-menu answerer on Herdr in v1. |
| 6 | Keep the upstream skill names. | `/how`, `architect` and `principle-*` keep their names, so you can steer by name. tstackv2's Pi links and plugins shadow these names until they are retired. |
| 7 | Invoke the router explicitly. | Main starts with `/tstack` (`$tstack` in T3 and Codex, `/skill:tstack` in Pi). Every lead and worker gets its role and the router in its launch prompt. |
| 8 | When a seat can't launch, stop and ask. | A single-seat role stops, and the lead reports to main, which asks the human. A panel runs with the seats that launched and names the dropout. A seat is never swapped for another model without the human's word. |
| 9 | One effort per seat. | Each seat names one effort, and the setup budget scales them all. tstackv2's small and big effort tiers and its size test are left out. |
| 10 | Upstream projects are not named in this repository. | Skill text, docs and commit messages name only tstack and the tools it runs on. The upstream MIT copyright notice stays in `LICENSES/`, as its license requires. |

## Why this shape

tstackv2's own scouts measured how often leads applied skills, across 38 tasks and then 8 more after enforcement.
- Leads loaded `how`, `architect`, `arena`, `interrogate`, `tdd` and `no-comments` about zero times.
- After loads were enforced, the loads became paper, such as `tstack skill how >/dev/null`.
- Router triggers that were not tied to a step fired in 0 of 8 tasks.
- What held: two-axis review, worker `tdd` with red-then-green output, and full architect and arena runs.

Both scouts reached the same conclusion.
A skill gets applied when another agent's whole job is that skill, or when its output is a file the next step reads.
A "read this skill" link, a self-reported load row, or a trigger with no step behind it does not hold.

The upstream skills were written for Cursor and lean on Cursor-only features to get applied.
This repo replaces each one:

| In Cursor | tstack-skills |
| --- | --- |
| A sticky router mode with a per-turn reminder | The `tstack` router, invoked once by main and loaded from every launch prompt |
| The `Task` tool with a model per role | The `delegate` verb: T3 `delegate_task` with a target model, or a Herdr agent pane |
| A subagent wrapper that reads the router before any work | `references/worker-preamble.md`, pasted into every delegated prompt |
| An always-applied rule mapping roles to models | A role → harness and model file that `tstack-setup` writes |
| `/loop` | T3 `schedule_task` and `watch_pull_request`. Herdr has no equivalent in v1. |
| The todo list holding the playbook steps | The same rule, plus `Artifact:` files that the check script verifies |

## Layout

```text
tstack-skills/
  PLAN.md  README.md  AGENTS.md
  LICENSES/                     third-party MIT notice
  docs/                         see Documentation below
  skills/
    tstack/                     the router
      SKILL.md                  roles, rules, intake table, non-negotiables, principles index, reply rules
      playbooks/*.md            Artifact: lines and verb calls added where adapted
      references/
        dispatch.md             verbs, seats, depth, and how to read text written for Cursor
        runtime-t3.md           verbs mapped to t3-code MCP tools
        runtime-herdr.md        verbs mapped to the herdr CLI
        worker-preamble.md      the first message every worker gets
        bugbot-triage.md
      scripts/tstack.mjs        home, brief, check and seat; Node, no dependencies
    tstack-setup/               models file, .tstack/ exclude rule, and the per-project install option's worktree links
    how/ why/ architect/ arena/ swarm/ interrogate/ no-comments/ tdd/ ...
    principle-*/                24 principles
```

## The verbs

Playbooks and skills call verbs.
Each runtime reference maps a verb to concrete calls, so the skill text stays portable.

| Verb | Who | T3 | Herdr |
| --- | --- | --- | --- |
| launch-lead | main | `t3_thread_launch` with `workspaceStrategy: worktree`, then a prompt naming the role, task, brief and absolute state path | `git worktree add`, `herdr tab create`, `herdr agent start <id>-lead --kind <k>`, `herdr agent prompt` |
| delegate | lead; a skill run by the lead | `delegate_task` (async) with a `target` from the models file; the completion wakes the lead | `herdr pane split`, `herdr agent start <id>-<name>`, `herdr agent prompt` |
| collect | lead | `task_status`, plus the worker's result file | `herdr agent wait`, then the worker's result file |
| report | lead to main | `t3_thread_send` to main's thread with mode `queue`, which waits for a busy main and starts an idle one (measured) | `herdr agent wait main --until idle --until done`, then `herdr agent prompt main "<text>"`, because a prompt to a busy agent takes over its turn (measured) |
| decide | lead to main to human | The lead writes a decision file, reports, and ends its turn. Main asks the human and sends the answer back. | Same |
| watch-pr | lead | `watch_pull_request` | `gh pr checks --watch` |

The depth stays main → lead → worker.
A worker that runs a dispatching skill, such as `how` with explorers, uses its harness's native subagents instead of `delegate`.

## Model and harness selection

Playbooks and skills name a role, never a model.
The roles keep the upstream role names, plus tstack's own:
- `lead`
- `feature`, `bug-fix` and `refactoring`
- `how explorer`, `how explainer`, `why investigators` and `why synthesizer`
- `architect runners`, `arena runners` and `arena cross-judge pool`
- `interrogate reviewers`, `swarm workers`, `comment sicko` and `review`
- `judgment and prose`

An optional `lead <playbook>` line overrides `lead` for one playbook.
Main is not a role.
It is whatever the human starts: the T3 thread they open, or the CLI they launch in a Herdr pane.

The models file maps each role to seats, one line per role.
A seat is `harness/model@effort`, and the model ID is the harness's own ID, so no separate model catalog is needed.

```text
# budget: large (xhigh)
lead: claude/claude-opus-5-5@high
feature, refactoring: grok/grok-4.7@xhigh
bug-fix: grok/grok-4.7@xhigh
how explorer: claude/claude-sonnet-5@high
architect runners: claude/claude-opus-5-5@high, codex/gpt-6.1-sol@high, grok/grok-4.7@xhigh
interrogate reviewers: claude/claude-opus-5-5@high, codex/gpt-6.1-sol@high, pi/xai/grok-4.7@high
review: claude/claude-opus-5-5@high, codex/gpt-6.1-sol@high
t3 instances: claude=claudeAgent/effort, codex=codex/reasoningEffort, pi=pi/thinking, grok=grok/reasoningEffort
```

- A list is a panel, with one agent per seat.
- `inherit` runs the seat on the caller's own harness and model.
- `t3 instances` maps each harness name to a T3 provider instance and that instance's effort option ID, so two accounts can be two harness names.
  The option ID differs by harness, as Phase 0 measured.
- The file lives at `~/.tstack/models.md`, and a project's `.tstack/models.md` overrides it line by line.
- A role with no line is a refusal, so `tstack-setup` writes every role.

Each runtime reference turns a seat into a launch, through `tstack.mjs seat`:

| Seat part | T3 | Herdr |
| --- | --- | --- |
| Harness | The provider instance named in `t3 instances` | `herdr agent start --kind <harness>` |
| Model | `delegate_task` `target.model`, or `t3_thread_launch` `modelSelection.model` | `--model <id>` |
| Effort | `target.options` or `modelSelection.options`, using the option ID that `orchestrator_capabilities` advertises | Claude `--effort`, Codex `-c model_reasoning_effort=`, Pi `--thinking`, Grok `--reasoning-effort` |

Helpers inside a worker use their harness's own subagent tool with `inherit`, never the models file.

`tstack-setup` writes the file:
1. It finds what the human can run.
   On T3 it calls `orchestrator_capabilities`, which lists instances, models, effort options and which providers can run child tasks.
   On Herdr it checks the installed CLIs.
2. It asks for a budget: unlimited, large, medium or small.
   The budget scales every seat's effort.
3. It shows each role with its seats, takes the human's changes, and refuses any seat it could not confirm.

Left out from tstackv2's matrix: slot names, the `maxLive` per-role cap, effort tiers, and the model catalog.

## Rules that carry over from tstackv2

- Main coordinates and never edits project files.
- Merging, discarding work, and anything destructive happen only on the human's explicit word.
- Unlanded work is never torn down.
- Workers never address the human. Leads report to main.
- Evidence is not authorization.
- Report outcomes, not mechanics, and label every claim as measured, inferred or a guess.
- Cite a principle only after reading its leaf skill, and name the decision it changed.
- Scripts own facts. Agents own judgment.

## Documentation

The docs follow the repo's own `technical-writing` skill: Diátaxis modes, plain sentences, one sentence per line.
A doc is done only after someone follows it on a scratch project and gets the result it promises.

| File | Mode | Covers |
| --- | --- | --- |
| `README.md` | Landing page | What tstack is, who it is for, requirements, the install command, and links into the docs. |
| `docs/getting-started.md` | Tutorial | Install globally, set up a scratch project with `tstack-setup`, then run one small task end to end on T3 and the same task on Herdr. It ends at a merged commit and the task's evidence folder. |
| `docs/guide/01-route-work.md` | How-to | Start main with `/tstack`. Prompt with a goal plus a check. Say "new task" to switch subjects. What main does and what the lead does. |
| `docs/guide/02-understand.md` | How-to | `how`, `why`, `explain`, `recall`. |
| `docs/guide/03-design.md` | How-to | `architect`, `arena`, `swarm`, `interrogate`, and how much design a task deserves. |
| `docs/guide/04-build-and-clean.md` | How-to | Feature, Bug fix and Refactoring prompts, plus `tdd`, `no-comments` and `unslop`. |
| `docs/guide/05-verify-and-ship.md` | How-to | Verification skills, Opening a PR, answering decisions, and merging on your word. |
| `docs/guide/06-run-while-away.md` | How-to | Autonomous run, `show-me-your-work`, and reading the evidence folder afterwards. |
| `docs/guide/07-principles.md` | How-to | Steering by principle name. |
| `docs/guide/08-plan-with-specs.md` | How-to | Grilling, spec-driven work, and tickets. |
| `docs/guide/09-recipes-and-pitfalls.md` | How-to | Prompts to copy and mistakes measured on real runs. |
| `docs/runtimes/t3.md` | How-to | One provider instance per role, pinning main, permission modes, which threads appear, and where questions and decisions show up. |
| `docs/runtimes/herdr.md` | How-to | Starting main in a pane, the tabs and panes each lead and worker gets, how leads report, and checking on a quiet lead. |
| `docs/reference.md` | Reference | The verbs, the models file and its role names, the `.tstack/` layout, `tstack.mjs` commands and exit codes, the playbook intake table, the skill list, and both install modes. |
| `docs/concepts.md` | Explanation | Roles and rules, why skill steps produce artifacts (with the scout evidence), and how tstack-skills differs from tstackv2. |
| `docs/migrating-from-tstackv2.md` | How-to | Removing tstackv2's Pi links and plugins, and finishing or moving work still in flight. |

Each guide page lands in the phase that ships the skills it describes, and the reference grows with it.

## Phases

### Phase 0: probes

Done on 2026-10-05; see the [probe record](docs/verification/2026-10-05-phase0-probes.md).
All six passed, with one design change: a message to a busy agent steers its turn, so leads report with T3's `queue` mode or after `herdr agent wait`.
A launch prompt loads the router by reading its `SKILL.md` path, which worked on all three harnesses without a slash command.

### Phase 1: the core loop

Done on 2026-10-05.
Getting started ran end to end on [Herdr](docs/verification/2026-10-05-herdr-e2e.md) and on [T3](docs/verification/2026-10-05-t3-e2e.md).
Both runs found and fixed real bugs, and both showed leads running `how` and `why` inline instead of delegating them, which Phase 3 measures on larger tasks.
The steps were:

1. Vendor the upstream skills with only names and Cursor-only model rules changed.
   Rename the router to `tstack` and `teach` to `explain`, matching tstackv2's naming.
   Defer the playbooks whose tooling is not ported: multi-phase-plan, orchestrate, babysit, shipping, autopilot-full and autopilot-stack.
2. Write `tstack.mjs` with `home`, `brief`, `check` and `seat`, and one test file.
3. Write the router from the upstream router plus tstackv2's roles, intake, reporting and learnings, with no CLI.
4. Write `dispatch.md`, both runtime references and the worker preamble.
   Point every dispatching skill's model rule at the models file and `dispatch.md`.
5. Add `Artifact:` lines to Investigation, Feature, Bug fix, Refactoring and Opening a PR, and add a figure-it-out playbook.
6. Write `tstack-setup`, with the models file, the `.tstack/` exclude rule, and the per-project option's worktree links.
7. Give every skill marked `disable-model-invocation: true` an `agents/openai.yaml` with `allow_implicit_invocation: false`.
   Codex ignores the frontmatter field, and a global install puts the skills in every repository.
8. Write the README, AGENTS.md, getting-started, both runtime pages, reference, concepts, and guide pages 01 to 05 and 07.
9. Verify getting-started by following it on a scratch project: one small task end to end on T3, and one on Herdr.
   Those two runs are this phase's end-to-end check.

### Phase 2: your skills that tstackv2 added

Done on 2026-10-05, not yet run on a live task.
The decision and ask-user-authority rules became `skills/tstack/references/decisions.md`, and `check` now needs a granted answer for each gate.
tstackv2's self-pass for small tasks is gone with its size test, so every gate goes to the human.
The steps were:

Rewrite these from tstackv2 without CLI calls:
- grilling, grill-with-docs, domain-modeling, codebase-design, writing-for-agents, to-spec, to-tickets, handoff and teach
- two-axis-review
- the spec-driven and gardener playbooks
- the decision and ask-user-authority rules

Write guide page 08 and add these skills to the reference.

### Phase 3: measure, then retire tstackv2

Started on 2026-10-05.
tstackv2's global installs are retired, and the migration guide is written.
Both tutorial runs showed leads doing `how`, `why` and the comment pass inline, so those steps now require the delegated workers' result files, which `check` enforces.
[Measuring a live task](docs/verification/README.md#measuring-a-live-task) is the method for steps 1 to 3, starting with tstack-router.
The first tstack-router run, on T3, is [recorded here](docs/verification/2026-10-05-tstack-router-live-t3.md).
The steps were:

1. Run real tasks on both runtimes.
2. Count dispatched workers and artifacts against paper loads, the way tstackv2's scouts did.
3. Fix what didn't hold.
4. Write `docs/migrating-from-tstackv2.md`, then follow it to remove tstackv2's global Pi links and its Claude and Codex plugins.
5. Write guide page 09 from what the runs showed.

### Phase 4: the remaining playbooks

Done on 2026-10-05.
Multi-phase plan and orchestrate came from tstackv2's adaptations, with `check-plan.mjs` and gates under `decisions/`.
Babysit, shipping and the two autopilots came from upstream, with `gh` for every PR operation and merges only through main.
Autopilot-full merges under one recorded grant from the human, and both autopilots are main's programs, not a lead's playbook.
The as-written playbooks gained `Artifact:` lines where a step leaves evidence.
None of these has run live yet; the first PR-delivery task in tstack-router is the first test of babysit.
The plan was:

These need real adaptation, and come back from upstream when they do:
- babysit, using `watch_pull_request` on T3
- shipping
- autopilot-full and autopilot-stack
- orchestrate and multi-phase-plan, without the upstream CLIs and cloud agents

These run as written today, and gain verb calls and `Artifact:` lines:
- autonomous-run, perf-issue, hillclimb and prototype
- eval, visual-parity and authoring-a-skill
- session-pickup, pause-safely and worktree-cleanup
- runtime-forensics and trace-forensics

Write guide page 06, and extend pages 04 and 05 for these playbooks.

## Left out of v1

These items are deliberately excluded:
- the upstream `automate-me`, `make-bot-ui` and `setup` skills and its automations, because they are Cursor- or Grok-specific, and `tstack-setup` replaces setup
- tstackv2's afk, quiet, stow, recovery and harness-adapters, because T3 covers them and Herdr v1 has no watcher
- a Herdr watcher; add one if leads go quiet without reporting
