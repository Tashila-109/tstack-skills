# Reference

Facts about tstack-skills, for lookup.
The router, [skills/tstack/SKILL.md](../skills/tstack/SKILL.md), owns how agents use them.

## Invocations

| Harness | Setup | Start a task |
| --- | --- | --- |
| Claude Code, Cursor | `/tstack-setup` | `/tstack` |
| Codex, or any T3 thread | `$tstack-setup` | `$tstack` |
| Pi | `/skill:tstack-setup` | `/skill:tstack` |
| Any other harness | `Read ~/.agents/skills/tstack-setup/SKILL.md and follow it.` | `Read ~/.agents/skills/tstack/SKILL.md and follow it.`, then your request |

You invoke tstack in the thread, pane or session you open for a task, and that agent becomes the task's lead.
Workers, and leads that a coordinator or a move or handoff starts, never need an invocation.
Their first message is a `tstack launch` block naming their role, and they read the router by its path.

## Install modes

| Mode | Command | Where the skills land | Worktrees |
| --- | --- | --- | --- |
| Global (default) | `npx skills add Tashila-109/tstack-skills -g -a <agents> -y`, such as `-a claude-code codex cursor opencode pi` | `~/.agents/skills`, linked from each harness's own folder, such as `~/.claude/skills` and `~/.pi/agent/skills` | Every worktree sees them. |
| Per project | the same, without `-g`, run in the project | `.agents/skills`, `.claude/skills`, `.pi/skills`, and `skills-lock.json` | `tstack.mjs link-skills` links them into each new worktree. |

Installs are copies.
Rerun the command after the source changes.
Every skill marked `disable-model-invocation: true` carries `agents/openai.yaml` with `allow_implicit_invocation: false`, so Codex loads it only when asked.
Ten skills that agents may invoke on their own have no such file: `chart`, `codebase-design`, `domain-modeling`, `grilling`, `handoff`, `t3-visual`, `to-spec`, `to-tickets`, `two-axis-review` and `writing-for-agents`.

## Files

| Path | Written by | Holds |
| --- | --- | --- |
| `~/.tstack/models.md` | `tstack-setup` | The seats for every role, the budget, the `t3 instances` line, and any `herdr args` lines. |
| `<project>/.tstack/models.md` | `tstack-setup`, on request | Lines that differ for this project. It may not hold `herdr args` lines. |
| `<project>/.tstack/tasks/<id>/models.md` | lead, from your words | Lines that differ for one task, such as fast mode for its coding, under a `#` line with your words and the date. It may not hold `herdr args` lines. |
| `~/.tstack/locks/<name>` | `tstack.mjs lock` | The task and project that hold a shared resource, such as the desktop, a simulator or a port, and since when. |
| `<project>/.tstack/grants.md` | lead or coordinator, from your words | Standing merge grants, each in the human's words with its date and what it covers. |
| `<project>/.tstack/learnings.md` | lead or coordinator | One-line lessons, which `tstack.mjs brief` copies into every new brief. |
| `<project>/.tstack/backlog.md` | `tstack.mjs backlog`, at a task's Finish | Follow-ups from finished tasks, one line each with its ID, its text, its source task and the date. A lead deletes the line of an item its task finished. |
| `<project>/.tstack/autopilot-<name>.md` | coordinator | An autopilot's queue as a table with `Task` and `State` columns, its order, and the human's merge grant in their words. A held item's State starts with `held:`. |
| `<project>/.tstack/autopilot-<name>-heartbeat.txt` | coordinator, on T3 | The ID of the scheduled task the coordinator armed as the program's check-in. |
| `<project>/.tstack/tasks/<id>/task.json` | `tstack.mjs brief` | The frozen playbook steps and the artifacts each step must write. |
| `<project>/.tstack/tasks/<id>/brief.md` | `tstack.mjs brief` | The goal, the finish, the design source and delivery answers when it was given them, the steps, and the learnings. |
| `<project>/.tstack/tasks/<id>/lead.txt` | whoever launches the lead | A lead's T3 thread ID, or its Herdr agent name, tab and worktree. |
| `<project>/.tstack/tasks/<id>/launch.md` | lead, on the standalone runtime | The launch block you send as the first message of the task's new session. |
| `<project>/.tstack/tasks/<id>/notify-<other id>.md` | the lead, on the standalone runtime | A message for another task's lead, which you tell that lead to read. |
| `<project>/.tstack/tasks/<id>/heartbeat.txt` | lead, on T3 | The ID of the scheduled task the lead armed as its heartbeat, removed when the lead deletes that schedule. |
| `<project>/.tstack/tasks/<id>/evidence/` | lead | One file per `Artifact:` line, any other proof the lead keeps, and `handoff-N.md` when the lead hands off to a fresh session. |
| `<project>/.tstack/tasks/<id>/briefs/<name>.md` | lead | Each worker's brief. |
| `<project>/.tstack/tasks/<id>/results/<name>.md` | worker | Each worker's result. |
| `<project>/.tstack/tasks/<id>/sources/<name>/` | lead, in deep-dive | A read-only clone of a project the deep-dive playbook reads, at the commit `evidence/source.md` records. |
| `<project>/.tstack/tasks/<id>/decisions/<name>.md` | lead | A question for the human, and their answer under `## Answer`, whose first line is `granted`, `denied` or `answered`, or `taken` when the lead took its own recommendation on a question under an away grant. |
| `<project>/.tstack/tasks/<id>/decisions/away.md` | lead, from your words | An away grant: your words when you said you were away, and from your next message an `## Ended` section listing each decision the lead took under it. A later absence gets `away-2.md`, and so on. |
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
| `brief <id> --playbook <name> --goal <text> --finish <text> [--kind ship\|scout] [--delivery local-only\|pr] [--design <link or path>] [--acceptance phase\|branch] [--push stage\|word] [--merge squash\|merge\|rebase]` | Creates the task directory with `task.json` and `brief.md`. Refuses an existing task ID. `--design` adds a `Design source:` line that points at proof.md's design section. `--acceptance`, `--push` and `--merge` each add a line that says what the answer means: the human accepts each phase or reviews the branch once, the lead pushes after each verified stage or only on the human's word, and the `gh pr merge` method to use at Finish. `--merge` needs `--delivery pr`. |
| `check <id> [--through <step>] [--head <sha>]` | Refuses a task ID that is not a plain name and a step below 1. Refuses until every artifact frozen for the task, and every artifact its playbook names, exists, is not blank, and is not a link to a file outside the task directory. An artifact under `decisions/` also needs a `granted` answer, or an `answered` one when its `Kind:` is `question`, and `evidence/verify.md` must cite a non-empty file under `evidence/` or hold a `skip:` line, and has no table row whose verdict is `failed`, skip line or not. Every review aggregate under `evidence/reviews/` opens with `Head <sha>, round <n>` or with a `skip:` line, and one past round 3 needs an answered `review-<label>` decision for each further three rounds. A document a granted decision cites by commit SHA, never a name such as `HEAD`, or by SHA-256 must still match that version in its latest granted decision, and a spec path and hash recorded in `evidence/check-plan.md` must still match. Without `--through`, it also requires `report.md`, with `pr` delivery `evidence/babysit.md`, a result with a `DONE`, `BLOCKED` or `FAILED` line for every brief under `briefs/`, and no lock under `~/.tstack/locks` that the task still holds. `report.md` needs `## Remember` and `## Follow-ups` headings and no long dash. `evidence/dispatch.md` and `evidence/fix.md` must cite `results/<name>.md` files with verdict lines, at least one of them ending `DONE` on its last verdict line, and `fix.md` a brief that lists `tdd`. In a task with a granted `decisions/close.md`, any other artifact may hold a `skip:` line instead, delegating steps included, a gate may hold a `denied` answer, and granted documents and `--head` evidence are no longer compared, because nothing will merge. A grant counts only outside a code block, and `evidence/check-plan.md` must end in `0 problems`. A decision whose answer opens with `taken`, or cites an away grant, must be a `question`, other than a `review-<label>` checkpoint, answered `taken` in any case that cites a granted `decisions/away.md` or `away-<n>.md`, and once that grant has an `## Ended` section, the section must list it. A `taken` answer never counts toward the review cap. With `--head`, `evidence/verify.md` must name a commit with the same tree as that SHA, and so must the first line of `evidence/reviews/final.md`, run from the task's checkout. On a `pr` task without `--through`, the newest `pr-state` line in `evidence/babysit.md` for that tree must be `READY` or `MERGED`, unless the file opens with a `skip:` line. Also with `--head`, each `` `git diff --quiet <sha> <rev> -- <paths>` `` that `evidence/verify.md` records for a reused claim must still exit 0 when run with the head in place of `<rev>`, and each path must be unquoted and exist in one of the two commits. In a task briefed with `--design`, every row of the proof table cites a file under `evidence/` unless its verdict is `blocked`. Every command refuses a flag it does not take. |
| `backlog <id>` | Appends each list item under the `## Follow-ups` heading of the task's `report.md` to `<project>/.tstack/backlog.md`, as `` `<task id>-<6 hex>` `` with its text, the task and the date. The ID comes from the item's text, so a rerun adds only items that are new. Skips prose lines and an item that says `none`, and refuses a report with no `## Follow-ups` heading. |
| `status [<id>] [--size]` | With no ID, prints one line per task under `<home>/tasks`: its playbook, kind, delivery, creation date, the highest step whose artifacts are all present, whether `report.md` is written, whether a granted `decisions/close.md` closed it and, with `--size`, the folder's size on disk. Under that line it names the task's held state from an autopilot queue, each open decision, the count of finished workers no evidence file cites, the count of briefs with no verdict yet, and the heartbeat ID. An open decision has no `granted`, `denied` or `answered` answer outside a code block. A finished worker's result has a `DONE`, `BLOCKED` or `FAILED` line, and it counts as cited once a `.md` file under `evidence/`, or `report.md`, names it. Then it prints one line per `autopilot-<name>.md`, counting its items by the first word of each `State` cell, with its heartbeat ID and each held item. With an ID, it prints that task's goal, finish, size with `--size`, each step as done, missing its artifacts or naming none, and every item in full. Summing a size reads every file's metadata, so a task folder of a million files takes most of a minute, which is why `--size` is opt-in and the heartbeat leaves it off. |
| `seat <role> --runtime t3\|herdr\|standalone [--task <id>] [--cross <model> [--avoid <model>,...]]` | Prints one JSON line per seat: a T3 target, a Herdr kind with its launch flags, or on standalone `inherit` with the configured seat. With `--task`, the task's `models.md` overrides the project's and the global lines, and an unknown task is refused. With `--cross`, prints only the first seat whose model family differs from `<model>`'s, such as `gpt` for `claude-opus-5-5`. `--avoid` lists model IDs, one per use, and among those seats picks the first whose model is listed fewest times. |
| `check-seats <file> [--task <id>]` | Checks every seat in the models files, and with `--task` the task's file too, against a saved T3 `orchestrator_capabilities` result: the instance can run child tasks, with T3's reason when it cannot, the model is advertised, and the effort and fast values are offered. It reads an option's choices as `values` or as `options`, the two shapes T3 has used. Names the advertised ID when only a provider prefix differs. Also refuses a role the tstack-setup template has with no line, a role it does not know, a seat listed twice in a role, and a panel role (`arena runners`, `arena cross-judge pool`, `interrogate reviewers`, `review`) with fewer than two model families. |
| `preflight [--runtime t3\|herdr\|standalone] [--task <id>]` | Prints one line per problem that would stop unattended work, each with what only you can do about it, and exits 1 when there is one. Every role in the models files resolves to a seat on that runtime, or without `--runtime` has a line whose seats parse. When `commit.gpgsign` is on, a signed `git commit-tree` of `HEAD`'s tree succeeds within 60 seconds, which writes one unreferenced commit object and moves no ref. `gh auth status --active` succeeds, except for a task whose delivery is `local-only`. On `--runtime herdr` with `--task`, the task ID is at most 24 characters, so `<id>-lead-99` fits Herdr's 32-character agent names. |
| `lock <name> --task <id>` | Creates `~/.tstack/locks/<name>` with an exclusive create, naming the task, its project and the time. Prints that it already holds the lock when the same task asks again, and refuses with the holder's task, project and time when another task holds it. The name is a plain name such as `simulator-iphone-17` or `port-5432`, and the task must exist. |
| `unlock <name> --task <id>` | Removes the lock the task holds. Prints that it is not locked when no task holds it, and refuses when another task does. |
| `pr-state <pr number> [--wait <seconds>]` | Prints one verdict for a PR from GitHub's own state: `READY`, `WAITING` with checks running, mergeability GitHub has not computed yet, a review bot's ten-minute settle, a review bot that reviewed two earlier heads but not this one (`bot-review`, for up to 20 minutes) or a required review, `BLOCKER` with a draft, conflicts, a base that changed files the PR changes (`base-moved`), failing checks, unresolved threads (outdated ones too), findings in a review bot's review body on this head that are in no thread (`bot-findings`, such as CodeRabbit's outside-diff, nitpick and duplicate comments), requested changes, a base ahead that a branch rule requires, a branch rule GitHub does not name, or over 100 checks, threads or reviews, or `MERGED` or `CLOSED`. A bot is a review author of type `Bot` or a login ending in `[bot]`, and only its reviews with a body count, because an empty one is a thread reply. A reaction from the gh account on a bot's review marks its body findings triaged. Every `BLOCKER` also lists each unresolved thread's ID, path and line, the bot findings, and each bot's round count as `bot-rounds`, the heads it has reviewed. `READY ci-none` means no checks reported, `READY bot-unreviewed` names a bot that did not review the head in 20 minutes, and `READY base:` counts the commits the base is ahead when they change none of the PR's files. Each read makes one GitHub compare call beside the GraphQL query, and when the base is ahead but the compare or the PR's file list is too long to read whole, it blocks as `base-moved`. With `--wait`, up to 540 seconds, it rereads every minute while the verdict is `WAITING`. |
| `exclude [--project-skills]` | Adds `/.tstack/`, and with the flag `/skills-lock.json` and each per-project skill path, to `.git/info/exclude`. |
| `link-skills <worktree>` | Links a per-project install into a linked worktree. |

`scripts/check-plan.mjs <spec.md>` checks a multi-phase spec's structure: its sections in order, and unit, live and performance boxes in every phase, with a regression lane against trunk.
It prints one summary line per phase and the problem count, and exits 1 when there is a problem.

The chart skill's `scripts/chart.mjs` has three commands, each taking one or more `.mmd` files and `--root`, the folder that citations start from:
- `check` refuses a chart with no `%% chart: code` or `%% chart: design` line, a box or arrow in a code chart with no `%% src:` or `%% new:` comment above it, a citation to a path or line that does not exist or that goes through a link, and Mermaid that Pele cannot draw, and it counts the arrows Pele draws and says when a chart has more than 20;
- `render [--theme clean|blueprint|t3|<file.css>]` runs the same checks, then writes a themed SVG next to each chart, or with `t3` an HTML page for T3's `html_render`;
- `stale` names each cited file that differs from the chart's `%% synced:` commit, committed or not, and each new untracked file under a cited folder.

It needs Node 20 or newer, or Bun, and npm on first use, when it installs `pele@1.9.0` into `~/.tstack/cache`.
Set `PELE` to the path of a `pele.js` to use another copy.

Exit codes are 0 for success, 1 for a refusal with its reason on stderr, 2 for a usage error, and 3 for anything unexpected.

## Models file

Each line is `<role>[, <role>...]: <seat>[, <seat>...]`.

- A seat is `harness/model@effort`.
  The model ID is the harness's own, so a Pi model is `provider/model`.
  The `@effort` part is optional.
  It counts as an effort only when it names one: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`, `ultra`, `ultracode` or `ultrathink`.
- A seat that ends in `+fast`, such as `claude/claude-opus-5-5@xhigh+fast`, runs in fast mode on T3, through the fast option its harness has in the `t3 instances` line.
  Herdr refuses it, and on standalone it runs on your own model like every seat.
- The harness is usually `claude`, `codex`, `pi` or `grok`, and on T3 it may be any name the `t3 instances` line defines.
  `grok` is Grok Build, for worker seats, and the `t3 instances` line maps it to T3's Grok provider.
- `inherit` runs the role on the caller's own harness and model.
  On the standalone runtime every seat does, so the seats only set how many workers a panel gets.
- A list of seats is a panel, with one agent per seat.
- One line can name several roles, comma-separated, and each role still gets its own seat call.
- `lead <playbook>` overrides `lead` for one playbook.
- `t3 instances: <harness>=<instance>/<effort option>[/<fast option>[=<value>]], ...` maps harness names to T3 provider instances.
  A fast option without a value is an on/off option, such as `claude=claudeAgent/effort/fastMode`, and one with a value is set to it, such as `codex=codex/reasoningEffort/serviceTier=priority`.
- A task's `models.md` overrides the project's and the global lines for that task, when a command gets `--task <id>`.
  The lead writes it from your words for that task.
- `herdr args <harness>: <flags>` replaces a harness's autonomy flags on Herdr, and only `~/.tstack/models.md` may hold it.

| Role | Used by |
| --- | --- |
| `lead` | leads that launch-lead starts on T3 or Herdr: a move out of the primary checkout on Herdr, a handoff, or a coordinator's queue item |
| `feature`, `refactoring`, `bug-fix`, `perf-issue`, `hillclimb` | the playbook of that name, for its code-writing workers |
| `judgment and prose` | any playbook, for judgment-heavy work, and the how and why skills |
| `explorer` | read-only reading for large plans and charts, the read-only explorers of the charting, deep-dive and multi-phase-plan playbooks, and the automate-me skill |
| `arena runners`, `arena cross-judge pool` | the arena skill, whose one judge `seat --cross --avoid` picks from the pool in order, as its Phase C says |
| `interrogate reviewers` | the interrogate skill, and thermo-review, which takes the first seat and the first seat of another family |
| `swarm workers` | the swarm skill |
| `comment sicko` | the no-comments skill |
| `review` | the two-axis-review skill, where the first seat reviews standards and the second spec, and Opening a PR's cross-model review, which takes the first seat outside the lead's model family |
| `verify` | the shipping playbook's per-PR verifiers, the autopilots' live lanes, and two-axis-review's run after each repair |

## Verbs

[dispatch.md](../skills/tstack/references/dispatch.md) owns the verbs, and each runtime reference owns their calls.

| Verb | Who | Does |
| --- | --- | --- |
| launch-lead | a lead handing off, a lead moving a ship task on Herdr or standalone, or a coordinator | Starts a lead in a new worktree on `task/<id>`, or in the task's existing worktree for a handoff. On T3 a lead moves its own task by moving its thread instead. On standalone, the lead makes the worktree and you start the new session. |
| delegate | lead | Starts a worker on a seat with a written brief. |
| collect | lead | Reads a finished worker's result. |
| report | a coordinator's lead | Messages the coordinator without interrupting it. |
| notify | lead | Messages another task's lead without interrupting it, such as a hold before a plan amendment. The receiver acts only on the granted decision it names. |
| decide | lead | Writes a decision file and asks you in its thread. A coordinator's lead sends it to the coordinator. |
| watch-pr | lead | Waits for the PR's next verdict from `tstack.mjs pr-state`. On T3, the lead also arms T3's PR watch when it opens the PR. |
| hold | coordinator | Asks a lead to stop at once on your stop, and counts it held once the lead acknowledges, until you release it. A lead you talk to is held by your own stop. |

## Playbooks

The lead picks one per task from the [router's intake table](../skills/tstack/SKILL.md#playbooks).

| Status | Playbooks |
| --- | --- |
| Adapted, so `check` enforces the `Artifact:` paths each names; opening-a-pr names none, and `pr` delivery adds `evidence/babysit.md` | deep-dive, investigation, gardener, charting, multi-phase-plan, babysit, shipping, bug-fix, feature, refactoring, takeover, modernize, figure-it-out, opening-a-pr |
| As written with `Artifact:` lines, so `check` enforces the files they name | runtime-forensics, trace-forensics, prototype, visual-parity, eval, authoring-a-skill, hillclimb, perf-issue, autonomous-run |
| As written, so `check` enforces only `report.md` | session-pickup, pause-safely, worktree-cleanup |
| Run by a coordinator across several tasks | autopilot-full, autopilot-stack |

## Skills

Ask `tstack-help` what a skill does and when to use it.

| Group | Skills |
| --- | --- |
| Router and setup | `tstack`, `tstack-setup`, `tstack-help` |
| Understand | `how`, `why`, `explain`, `chart`, `recall`, `teach`, `in-your-own-words`, `ketchup`, `sharpen` |
| Plan | `grilling`, `grill-with-docs`, `domain-modeling`, `codebase-design`, `to-spec`, `to-tickets` |
| Design | `architect`, `arena`, `swarm`, `interrogate`, `figure-it-out` |
| Build and clean | `tdd`, `no-comments`, `unslop`, `technical-writing`, `typescript-best-practices`, `blast-radius`, `benchmark-checklist` |
| Review and verify | `two-axis-review`, `thermo-review`, `thermo-nuclear-review`, `thermo-nuclear-code-quality-review`, `create-verification-skill`, `maintain-verification-skill`, `create-formal-verification-skill`, `maintain-formal-verification-skill` |
| Record and improve | `show-me-your-work`, `t3-visual`, `handoff`, `reflect`, `correct`, `automate-me`, `bro`, `writing-for-agents` |
| Principles | 24 `principle-*` skills, indexed in the router |

Two close calls:
- `explain` is a quick explanation in this session, of code in front of you, built from `how` and `why`.
- `teach` runs a learning workspace over several sessions, with a mission, lessons and learning records.

`tstack-help` answers "which skill do I use" with one prompt to send, and never starts work.
Ask it with `/tstack-help`, `$tstack-help` or `/skill:tstack-help`.
