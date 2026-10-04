# Phase 0 probes

Date: 2026-10-05.
Plan: [PLAN.md, Phase 0](../../PLAN.md#phase-0-probes).
Labels: **measured** means run and observed here. **Source** means read in the tool's source or docs, not run. **Pending** means not run yet.

Versions: Claude Code 2.1.289, Codex CLI 0.160.0, Pi 1.0.2, Grok Build 1.0.46, Herdr 0.9.3, `skills` CLI 1.7.0, T3 Code (Nightly) desktop with its bundled server.

Setup:
- a throwaway Git project, `tstack-probe`, with one commit;
- a linked worktree `tstack-probe-wt` on branch `probe/lead`, standing in for a lead's fresh worktree;
- three probe skills, each of which prints `PROBE-OK <name> <harness> <path>` when loaded:
  - `tstack-probe`: installed globally, `disable-model-invocation: true`;
  - `tstack-probe-model`: installed globally, invocable by the model;
  - `tstack-probe-local`: installed per project, `disable-model-invocation: true`.

## Probe 2: install layout and worktree visibility

### Install layout (measured)

`npx skills add <local path> -g -a claude-code codex pi -y` writes:
- a **copy** at `~/.agents/skills/<name>`, which Codex reads directly;
- a symlink to it from `~/.claude/skills/<name>`;
- a symlink to it from `~/.pi/agent/skills/<name>`.

Because it is a copy, not a link to the source, editing the source does not update installed skills.
Rerun `npx skills add` after each change.

Without `-g`, it writes the project's `.agents/skills/<name>` plus symlinks from `.claude/skills/<name>` and `.pi/skills/<name>`, and a `skills-lock.json` that records the source.
Adding `.agents/skills/`, `.claude/skills/`, `.pi/skills/`, `skills-lock.json` and `.tstack/` to `.git/info/exclude` left `git status` clean.
A new linked worktree contained only the tracked `README.md`.

### Which skills each harness loads (measured, headless)

Each cell is one headless run: `claude -p`, `codex exec` or `pi -p`.
Explicit invocation used `/name` on Claude, `$name` on Codex and `/skill:name` on Pi.

| Run | Claude Code | Codex | Pi |
| --- | --- | --- | --- |
| Main checkout, per-project skill, explicit | Loaded from `.claude/skills` | Loaded from `.agents/skills` | Loaded from `.agents/skills` |
| Worktree, global skill, explicit | Loaded from `~/.claude/skills` | Loaded from `~/.agents/skills` | Loaded from `~/.pi/agent/skills` |
| Worktree, per-project skill, explicit | Loaded from the **main checkout's** `.claude/skills` | Not discovered; the agent searched the disk and read the probe skill's source copy | Not discovered |
| Worktree, global skill, by the model's choice | Loaded through the Skill tool | Loaded by reading `SKILL.md` | Loaded by reading `SKILL.md` |

Conclusions:
- A global install reaches a lead's fresh worktree on all three harnesses.
  This confirms decision 4's global default.
- A per-project install does not reach a worktree for Codex or Pi.
  The per-project option must link the skills into each new worktree.
- Every harness loaded a model-invocable skill on its own when asked by description.
  A launch prompt can load the router that way, or by reading its `SKILL.md` path, without a slash command.
- Pi found the global skill through both `~/.pi/agent/skills` and `~/.agents/skills` and printed no collision warning in print mode.

## Probe 3: T3 worktree hook for the per-project option (source)

T3 runs a `runOnWorktreeCreate` script from the project's Actions list (`ProjectSetupScriptRunner` reads `project.scripts`).
A `t3.json` file's actions reach that list only after being imported under Settings, then Project, then Actions.
So the per-project option on T3 needs that one-time import.
Not run live, because global install is the default.

## Probe 6: Herdr prompt to a busy agent (measured)

Each harness ran as a Herdr agent in its own pane.
Each got a first prompt, a 900-word story ending in `FIRST-DONE`.
Once `agent_status` read `working`, it got a second prompt: `Reply with exactly SECOND-RECEIVED and nothing else.`

| Harness | Second prompt delivered | First task finished | Second answered |
| --- | --- | --- | --- |
| Claude Code | Yes, `ok` | No; no story was written | Yes |
| Codex | Yes, `ok` | No; no story was written | Yes |
| Pi | Yes, `ok` | No; no story was written | Yes |

A prompt sent to a working agent is not queued behind the current turn.
It steers the turn, and in all three runs the agent dropped the first task and answered only the second.
Consequences for the design:
- On Herdr, a lead must wait until main is idle before reporting: `herdr agent wait main --until idle --until done`, then `herdr agent prompt`.
- On T3, `t3_thread_send` mode `auto` also steers an active turn, and a delegated worker's completion is "steered into active turns where supported" (source: `delegate_task`'s tool description).
  Leads should report with mode `queue`, which the T3 probes below confirm waits.

Also found: `herdr tab create` accepts `--env KEY=VALUE`, so a Herdr lead's role and task can be bound per tab.

## Probes 1, 4 and 5: under T3 (measured)

The probe project was opened in T3 with the bundled CLI's `t3 app <path>`.
Main ran on Claude (`claude-opus-5-5`, full access) and followed `.tstack/probe/INSTRUCTIONS.md` in the probe project.
The lead and worker wrote their own records.

### Probe 1: skills under T3

- The human typed `$tstack-probe` as main's first message, and T3 ran it as `/tstack-probe`, which printed `PROBE-OK`.
  An explicit invocation of a `disable-model-invocation` skill works under T3.
- Main's skill listing held the global probe skills from `~/.claude/skills` and tstackv2's plugin skills under the `tstack:` namespace, side by side.
  Claude does not merge or shadow them, because plugin names are namespaced.
- Main loaded the model-invocable probe through the Skill tool.

### Probe 4: launch, model selection, and messages to main

- Main found its own thread ID in `t3_thread_list`'s `currentThreadId` field, matching `orchestrator_capabilities`'s `parentThreadId`.
  So main can put its ID in a lead's launch message.
- `t3_thread_launch` with `workspaceStrategy: worktree` created `~/.t3/worktrees/tstack-probe/probe-t3-lead` on branch `probe/t3-lead`.
- `modelSelection` with `options: [{"id":"reasoningEffort","value":"medium"}]` applied.
  T3's own runtime note told the lead "gpt-6.1-sol with medium reasoning effort", and `t3_thread_configuration` reported the same.
  The instance's default effort was `low`.
- The lead's `t3_thread_send` with mode `auto` to an idle main returned `delivery: started` and began a new main run.
- The lead's second send, with mode `queue` while main was writing a 1,615-word story in one tool call, returned `delivery: queued`.
  The story finished whole.
  The queued message then arrived as its own run after the busy run ended.
  Leads should report with `queue`.
- `delegate_task` with `target: { providerInstanceId: "pi", model: "openai/gpt-5.5", options: thinking=high }` ran a Pi worker at that model and effort, per the worker's own record.
  Its completion woke main as its own run.
  `task_status` returned `completed`, `result_available`, and the worker's final line.
- The worker ran in the project root, not a worktree, as the T3 port doc expected for delegated children.

### Probe 5: writing outside the worktree

The Codex lead, in full access, wrote to the main checkout's `.tstack/probe/` with no approval prompt.
A lead can keep task state in the primary project's `.tstack/`.

### Skills seen by the lead and worker

| Agent | Global skill by path | Model-invocable global skill | Per-project skill |
| --- | --- | --- | --- |
| Codex lead in a T3 worktree | Loaded from `~/.agents/skills` | Loaded | Absent from the worktree |
| Pi worker in the project root | Loaded from `~/.agents/skills` | Loaded from `~/.pi/agent/skills` | Not tested |

### What `orchestrator_capabilities` reports

| Instance ID | Driver | Can run a child task | Models | Effort option ID |
| --- | --- | --- | --- | --- |
| `claudeAgent` | `claudeAgent` | Yes | 12 | `effort` |
| `codex` | `codex` | Yes | 8 | `reasoningEffort` |
| `grok` | `grok` | Yes | 5 | `reasoningEffort` |
| `pi` | `pi` | Yes | 720 | `thinking` |
| `cursor` | `cursor` | Yes | 44 | `effort`, `reasoning` or `reasoning_effort`, by model |
| `opencode`, `antigravity` | Same as the ID | No, disabled and not installed | 0 | None |

The effort option ID differs by harness, and the allowed values differ by model.
The models file's `@effort` must be translated per instance, so `tstack-setup` records each instance's option ID from this output.
The full output was 224,239 characters, too large for an agent's tool result, and the harness saved it to an overflow file.
Setup should extract only the rows it needs.

## Side findings

- Codex 0.160.0 prints `failed to parse plugin hooks config .../tstack/2.0.0-dev/hooks/hooks.json: unknown field modules` on every run.
  tstackv2's Codex plugin hooks are not loading.
- All three harnesses loaded the globally installed `unslop` skill on their own for the story prompts.
