---
name: tstack-setup
description: Set up tstack in a project and write the models file that maps each role to a harness, model and effort. Use for /tstack-setup, $tstack-setup, /skill:tstack-setup, "set up tstack", or when the tstack router finds no models file.
disable-model-invocation: true
---

# tstack setup

Run this from the project's primary checkout, a Git repository with at least one commit.
Ask the human only what the machine cannot answer, through your harness's structured question tool when it has one.
`tstack.mjs` means `node <the tstack skill's directory>/scripts/tstack.mjs`; the tstack skill sits beside this one.

## 1. Check the install

The skills are installed in one of two ways:
- **globally** (the default): `~/.agents/skills/tstack/SKILL.md` exists, and your harness's own skills folder, such as `~/.claude/skills`, links to it when the harness does not read `~/.agents/skills`;
- **per project**: `<primary checkout>/.agents/skills/tstack/SKILL.md` and `<primary checkout>/skills-lock.json` exist.

If neither holds, give the human the install command and stop.
`<source>` is `Tashila-109/tstack-skills`, or the path of a local clone.
`<agents>` lists the harnesses they use, such as `claude-code codex cursor opencode pi`.

```sh
npx skills add <source> -g -a <agents> -y   # global
npx skills add <source> -a <agents> -y      # per project
```

Installed skills are copies.
After the source changes, the human reruns the same command.

## 2. Prepare the project

1. Run `tstack.mjs home`, and create that directory if it is missing.
2. Run `tstack.mjs exclude`, adding `--project-skills` for a per-project install.
   It writes `.git/info/exclude`, so no tracked file changes.
3. For a per-project install on T3, ask the human to add one project action under Settings → Project → Actions, so each new worktree gets the skills:
   - command: `node "$T3CODE_PROJECT_ROOT/.agents/skills/tstack/scripts/tstack.mjs" link-skills "$T3CODE_WORKTREE_PATH"`
   - turn on **Run on worktree create**, and wait for it before the agent starts.

   On Herdr, launch-lead links each new worktree itself.
4. On T3, read `storageCleanup.worktreeOnMerge` in `~/.t3/userdata/settings.json`.
   If it is not `true`, tell the human that each merged task's worktree stays on disk until they remove it, and suggest turning on worktree removal on merge in T3's storage settings.

## 3. Find what can run

**On T3**, where the `t3-code` tools are available, call `orchestrator_capabilities`.
Its result is large, often over 200,000 characters.
When your harness saves it to a file, read only what you need with `jq`:

```sh
jq -r '.providers[] | [.providerInstanceId, .driverKind, .canRunChildTask, (.models | length)] | @tsv' <file>
jq '.providers[] | select(.providerInstanceId == "<instance>") | .models[] | select(.id == "<model>") | [.options[]? | {id, values: [.options[]?.id]}]' <file>
```

Use only instances with `canRunChildTask` true.
The first command fills the `t3 instances` line: each harness name, its instance ID, and its effort option ID (`effort` on Claude, `reasoningEffort` on Codex and Grok, `thinking` on Pi).
The second confirms that a seat's model exists and which effort values it allows.

**On Herdr**, check which agent CLIs are installed with `command -v claude codex pi grok`.
A CLI cannot list its models here, so confirm each distinct harness and model pair with one short headless call when the human agrees.
A model the human will not confirm stays out of the file.

**On any other harness**, the [standalone runtime](../tstack/references/runtime-standalone.md) runs every worker on your own model, so the seats only set how many workers a panel gets.
Keep an existing models file.
Otherwise write the template below as it stands to `~/.tstack/models.md`, skip steps 4 and 5, and tell the human the seats take effect only if they run tstack on T3 Code or Herdr later.

## 4. Choose the budget

Ask the human for one:
- `unlimited`: `max`;
- `large`: `xhigh`;
- `medium`: `high`;
- `small`: `medium`.

The budget sets every seat's effort.
With no budget, the template's efforts stay, from `high` to `max`.
When a model does not allow that value, use the highest value it allows at or below it.

## 5. Confirm the roles

Start from the existing models file, or the template below.
Replace every seat on a harness or model you could not confirm with the human's choice.
Show every role with its seats, then ask whether to accept them or change specific roles.
`inherit` is always valid.
It runs the role on the caller's own harness and model.
Never write a seat you could not confirm.

```text
# tstack models. One line per role. A seat is harness/model@effort, a list is a panel, and inherit means the caller's own harness and model.
# budget: none, the template's efforts
lead: claude/claude-opus-5-5@xhigh
feature, refactoring: pi/openai/gpt-6.1-sol@xhigh
bug-fix: pi/openai/gpt-6.1-sol@xhigh
perf-issue, hillclimb: pi/openai/gpt-6.1-sol@xhigh
judgment and prose, hardest tasks: claude/claude-opus-5-5@high
how explorer: claude/claude-sonnet-5-5@max
how explainer: claude/claude-opus-5-5@high
why investigators: grok/grok-4.7@xhigh
why synthesizer: claude/claude-opus-5-5@high
reflect tooling: codex/gpt-6.1-sol@xhigh
reflect judgment, reflect divergent, reflect synthesizer: claude/claude-opus-5-5@high
architect runners: claude/claude-opus-5-5@high, codex/gpt-6.1-sol@high, grok/grok-4.7@xhigh
arena runners: claude/claude-opus-5-5@high, codex/gpt-6.1-sol@high, grok/grok-4.7@xhigh
arena cross-judge pool: claude/claude-opus-5-5@high, codex/gpt-6.1-sol@high, grok/grok-4.7@xhigh
interrogate reviewers: claude/claude-opus-5-5@high, codex/gpt-6.1-sol@high, grok/grok-4.7@xhigh
swarm workers: grok/grok-4.7@xhigh
comment sicko: inherit
review: claude/claude-opus-5-5@high, codex/gpt-6.1-sol@high
verify: claude/claude-opus-5-5@high
t3 instances: claude=claudeAgent/effort, codex=codex/reasoningEffort, pi=pi/thinking, grok=grok/reasoningEffort
```

`lead <playbook>` lines are optional and override `lead` for one playbook.
`herdr args <harness>: <flags>` lines replace a harness's autonomy flags on Herdr, and only `~/.tstack/models.md` may hold them.

## 6. Write the file

Write `~/.tstack/models.md` by default, replacing the whole file so a rerun gives the same result.
Write `<home>/models.md` only when the human wants this project to differ, and put only the differing lines in it.
Then run `tstack.mjs seat lead --runtime t3`, `--runtime herdr` or `--runtime standalone`, for the runtime in use, and confirm it prints a seat.
On T3, also run `tstack.mjs check-seats <file>` on the saved `orchestrator_capabilities` result, and fix every line it names.
It names a provider T3 cannot run with T3's own reason, such as a CLI that is not logged in, and a panel role whose seats share one model family.
It checks the global and the project file together, so run it again whenever either file changes, including a project file written by hand.

## 7. Offer verification skills

If the project has no `verify-*` skill and no other way to drive the app for proof, offer once to run [create-verification-skill](../create-verification-skill/SKILL.md).
If the project has no formal verification skill, a project skill that runs a model checker, a prover, or another verifier against its code, offer once to run [create-formal-verification-skill](../create-formal-verification-skill/SKILL.md), so agents can prove a key property holds in every case in scope, not only the cases tests reach.
If the human declines either, move on.

## 8. Report

Tell the human what was set up: the runtime, the install mode, the models file path, the budget, and any role left as `inherit` or changed from the template.
Then tell them how to start: `/tstack` in Claude Code or Cursor, `$tstack` in T3 or Codex, `/skill:tstack` in Pi.
On a harness with no way to invoke a skill by name, they start a message with `Read ~/.agents/skills/tstack/SKILL.md and follow it.`, or the per-project path.
