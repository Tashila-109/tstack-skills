# tstack-skills plan

tstack-skills packages the tstack workflow so it runs in any harness or ADE: engineering playbooks, skills and principles, plus the rules for who may do what.
The first two targets are T3 Code and Herdr.
Leads, workers and coordinators run on Claude Code, Codex or Pi.

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
| 7 | Invoke the router explicitly. | Each task thread starts with `/tstack` (`$tstack` in T3 and Codex, `/skill:tstack` in Pi). Every launched lead and worker gets its role and the router in its launch prompt. |
| 8 | When a seat can't launch, stop and ask. | A single-seat role stops, and the lead asks the human. A panel runs with the seats that launched and names the dropout. A seat is never swapped for another model without the human's word. |
| 9 | One effort per seat. | Each seat names one effort, and the setup budget scales them all. tstackv2's small and big effort tiers and its size test are left out. |
| 10 | Upstream projects are not named in this repository. | Skill text, docs and commit messages name only tstack and the tools it runs on. The upstream MIT copyright notice stays in `LICENSES/`, as its license requires. |
| 11 | The human talks to one lead per task, decided 2026-10-07. | Each task is a thread the human opens in its own worktree, and its lead does intake, asks the human for decisions, and merges on their word. Main is gone, with its backlog, relays and session reconcile. A coordinator runs only the autopilot programs. |

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
| A sticky router mode with a per-turn reminder | The `tstack` router, invoked at the start of each task thread and loaded from every launch prompt |
| The `Task` tool with a model per role | The `delegate` verb: T3 `delegate_task` with a target model, or a Herdr agent pane |
| A subagent wrapper that reads the router before any work | `references/worker-preamble.md`, pasted into every delegated prompt |
| An always-applied rule mapping roles to models | A role → harness and model file that `tstack-setup` writes |
| `/loop` | T3 `schedule_task` and `watch_pull_request`. Herdr has no equivalent in v1. |
| The todo list holding the playbook steps | The same rule, plus `Artifact:` files that the check script verifies |

## Layout

[AGENTS.md](AGENTS.md#layout) owns the repository layout.

## The verbs

Playbooks and skills call verbs, and each runtime reference maps a verb to concrete calls, so the skill text stays portable.
[dispatch.md](skills/tstack/references/dispatch.md) owns the verbs, and [runtime-t3.md](skills/tstack/references/runtime-t3.md) and [runtime-herdr.md](skills/tstack/references/runtime-herdr.md) own their calls.

## Model and harness selection

Playbooks and skills name a role, never a model.
The models file maps each role to seats, and a seat is `harness/model@effort` in the harness's own model ID, so no separate model catalog is needed.
The [tstack-setup](skills/tstack-setup/SKILL.md) template owns the roles and the file's shape, `tstack.mjs seat` turns a seat into a launch, and [the reference](docs/reference.md#models-file) documents both.

Left out from tstackv2's matrix: slot names, the `maxLive` per-role cap, effort tiers, and the model catalog.

## Rules that carry over from tstackv2

- Project files change only in a task's own worktree.
- Merging, discarding work, and anything destructive happen only on the human's explicit word.
- Unlanded work is never torn down.
- Workers never address the human. Leads talk to the human directly.
- Evidence is not authorization.
- Report outcomes, not mechanics, and label every claim as measured, inferred or a guess.
- Cite a principle only after reading its leaf skill, and name the decision it changed.
- Scripts own facts. Agents own judgment.

## Documentation

The docs follow the repo's own `technical-writing` skill: Diátaxis modes, plain sentences, one sentence per line.
A doc is done only after someone follows it on a scratch project and gets the result it promises.
[README.md](README.md) links every page.

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

Done on 2026-10-05.
No record under `docs/verification/` shows these skills running in a live task.
The decision and ask-user-authority rules became `skills/tstack/references/decisions.md`, and `check` now needs a granted answer for each gate.
tstackv2's self-pass for small tasks is gone with its size test, so every gate goes to the human.
The steps were:

Rewrite these from tstackv2 without CLI calls:
- grilling, grill-with-docs, domain-modeling, codebase-design, writing-for-agents, to-spec, to-tickets, handoff and teach
- two-axis-review
- the gardener playbook
- the decision and ask-user-authority rules

Write guide page 08 and add these skills to the reference.

### Phase 3: measure, then retire tstackv2

In progress since 2026-10-05.
Steps 4 and 5 are done.
Steps 1 to 3 have one run per runtime recorded, and both runs were a Bug fix task with PR delivery, so the larger playbooks are not measured yet.
tstackv2's global installs are retired, and the migration guide is written.
Both tutorial runs showed leads doing `how`, `why` and the comment pass inline, so those steps now require the delegated workers' result files, which `check` enforces.
[Measuring a live task](docs/verification/README.md#measuring-a-live-task) is the method for steps 1 to 3, starting with tstack-router.
The first tstack-router run, on T3, is [recorded here](docs/verification/2026-10-05-tstack-router-live-t3.md).
The first Herdr run is [recorded here](docs/verification/2026-10-05-tstack-router-live-herdr.md).
The steps were:

1. Run real tasks on both runtimes.
2. Count dispatched workers and artifacts against paper loads, the way tstackv2's scouts did.
3. Fix what didn't hold.
4. Write `docs/migrating-from-tstackv2.md`, then follow it to remove tstackv2's global Pi links and its Claude and Codex plugins.
5. Write guide page 09 from what the runs showed.

### Phase 4: the remaining playbooks

Done on 2026-10-05.
Multi-phase plan and orchestrate came from tstackv2's adaptations, with `check-plan.mjs` and gates under `decisions/`.
Babysit, shipping and the two autopilots came from upstream, with `gh` for every PR operation and merges only on the human's word.
Autopilot-full merges under one recorded grant from the human, and since Phase 5 both autopilots are a coordinator's programs, not a lead's playbook.
The as-written playbooks gained `Artifact:` lines where a step leaves evidence.
Babysit has run live on both runtimes, on [T3](docs/verification/2026-10-05-tstack-router-live-t3.md) and on [Herdr](docs/verification/2026-10-05-tstack-router-live-herdr.md).
Shipping and the two autopilots have not yet run in a live task.
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

### Phase 5: one lead per task

Started 2026-10-07.
The human found a main thread with several tasks crowded, and paying twice for every report and decision.
T3 and Herdr already list each task as a thread or tab, so the lead now does main's intake, decisions, merge and cleanup itself.
A coordinator keeps main's relay only for the two autopilots.
The steps are:

1. Rewrite the router, dispatch, decisions, both runtime references, the playbooks and the skills that named main.
2. Rewrite the docs for one thread per task.
3. Run one task end to end on each runtime, and record each run under `docs/verification/`.

## Left out of v1

These items are deliberately excluded:
- the upstream `automate-me`, `make-bot-ui` and `setup` skills and its automations, because they are Cursor- or Grok-specific, and `tstack-setup` replaces setup
- tstackv2's afk, quiet, stow, recovery and harness-adapters, because T3 covers them and Herdr v1 has no watcher
- a Herdr watcher; add one if leads go quiet without reporting
- the spec-driven playbook, removed on 2026-10-06 because upstream has none and multi-phase plan and orchestrate already gate a plan on the human's approval; `to-spec` and `to-tickets` stay as standalone skills
