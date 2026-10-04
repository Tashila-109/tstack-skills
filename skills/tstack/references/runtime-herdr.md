# Herdr runtime

Use this when `HERDR_ENV=1` and the `t3-code` MCP tools are absent.
[dispatch.md](dispatch.md) owns the verbs, seats and depth.
This file owns the calls.
The calls were measured on Herdr 0.9.3, 2026-10-05.

`tstack.mjs` means `node <tstack skill directory>/scripts/tstack.mjs`.
Every `herdr` command returns JSON.
Read IDs from the response instead of predicting them.

## Facts to rely on

- `herdr agent prompt` to an agent that is working takes over its turn.
  The agent drops what it was doing.
  Before prompting another agent, wait for it: `herdr agent wait <name> --until idle --until done --timeout 600000`.
- Agent names match `[a-z][a-z0-9_-]{0,31}` and are unique on the Herdr server.
- `herdr agent start` returns `agent_not_ready` when the agent is blocked at startup, for example on a trust dialog.
  Never answer a trust dialog.
  Tell main or the human which tab it is in.
- Seats come from `tstack.mjs seat "<role>" --runtime herdr` as `{ "kind", "args" }`.
  `args` already holds the model, the effort and the autonomy flags.

## Main

At the start of a session, name yourself so leads can reach you:
`herdr agent rename "$HERDR_PANE_ID" main-<project>`, where `<project>` is the primary checkout's directory name, lowercased, with other characters turned into `-` and cut to fit.

### launch-lead

1. Run `tstack.mjs seat "lead <playbook>" --runtime herdr`.
2. From the primary checkout, which must be on the default branch with no uncommitted changes, run `git worktree add ~/.tstack/worktrees/<project>/<id> -b task/<id>`.
3. `herdr tab create --workspace "$HERDR_WORKSPACE_ID" --cwd <worktree> --label <id> --no-focus`, and keep `.result.tab.tab_id` and `.result.root_pane.pane_id`.
4. `herdr agent start <id>-lead --kind <kind> --pane <pane> -- <args...>`.
5. `herdr agent prompt <id>-lead "<launch block>" --until working --timeout 30000`, with `main:` set to your agent name.
6. Write the tab ID and worktree path to `<home>/tasks/<id>/lead.txt`.
7. End your turn.
   The lead prompts you when it reports.

### Talking to a lead

Wait for it to be idle, then prompt it: `herdr agent wait <id>-lead --until idle --until done --timeout 600000`, then `herdr agent prompt <id>-lead "..."`.
To see where a quiet lead is, run `herdr agent get <id>-lead` and `herdr agent read <id>-lead --source recent-unwrapped --lines 80`.
A `blocked` status means an approval or question is on screen.
Read it and tell the human.
Never type an answer into it yourself.

### After the merge

1. `herdr tab close <tab>`.
2. `git worktree remove <worktree>`, then `git branch -d task/<id>`.
   Both refuse when work has not landed.
   A refusal means stop and look, never force.

## Lead

### report and decide

Wait for main, then prompt it:
`herdr agent wait <main> --until idle --until done --timeout 600000`, then `herdr agent prompt <main> "report <id>: ..."`.
If the wait times out, main is still busy.
Wait again rather than prompting a working main.
For a decision, start the message with `decision <id>:`, and end your turn after sending.

### delegate

1. Run `tstack.mjs seat "<role>" --runtime herdr`.
   For `inherit`, use your own lead seat.
2. Write each worker's brief, per dispatch.md.
3. Split a pane for each worker.
   The first is `herdr pane split --current --direction right --cwd "$PWD" --no-focus`.
   Each later one splits the previous worker's pane with `--direction down`.
4. `herdr agent start <id>-<name> --kind <kind> --pane <pane> -- <args...>`.
5. `herdr agent prompt <id>-<name> "<filled worker preamble>" --until working --timeout 30000`.
6. Start every independent worker before you wait on any.

### collect

`herdr agent wait <id>-<name> --timeout 1800000` for each worker in turn.
Then read its result file and close its pane with `herdr pane close <pane>`.
A `blocked` status means the worker hit an approval or a question.
Read it with `herdr agent read`, and report it to main instead of answering it.
A timeout is not a failure.
Read the screen before deciding.

### A candidate that needs its own checkout

Cut a worktree from your branch: `git worktree add <path> -b task/<id>-<name>`.
Start the candidate's pane with `--cwd <path>`.
Remove the worktree after you have taken what you need from it.
Design sketches that only write files need no worktree: give each candidate its own directory under `<home>/tasks/<id>/evidence/`.

### watch-pr

`gh pr checks <url> --watch --fail-fast` in your shell, then read new review comments with `gh pr view <url> --comments`.

## Worker

Never run `herdr` commands.
Your final message is your verdict line.
The lead reads it from your screen and your result file.
