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
  Tell the human which tab it is in.
- Seats come from `tstack.mjs seat "<role>" --runtime herdr` as `{ "kind", "args" }`.
  `args` already holds the model, the effort and the autonomy flags.

## Lead

### Your pane

The human starts you in a Herdr pane and talks to you there.
Intake moves a ship task started in the primary checkout into its own worktree and tab with launch-lead.

### launch-lead

A lead uses this to move a ship task out of the primary checkout, and a coordinator uses it to start each lead.

1. Run `tstack.mjs seat "lead <playbook>" --runtime herdr`.
2. From the primary checkout, which must be on the default branch with no uncommitted changes, run `git worktree add ~/.tstack/worktrees/<project>/<id> -b task/<id>`, where `<project>` is the primary checkout's directory name.
   An autopilot-stack link branches from the previous link's task branch instead: add that branch name as the last argument.
   If the primary checkout has a `skills-lock.json`, the skills are installed per project, so run `tstack.mjs link-skills <worktree>` too.
3. `herdr tab create --workspace "$HERDR_WORKSPACE_ID" --cwd <worktree> --label <id> --no-focus`, and keep `.result.tab.tab_id` and `.result.root_pane.pane_id`.
4. `herdr agent start <id>-lead --kind <kind> --pane <pane> -- <args...>`.
5. `herdr agent prompt <id>-lead "<launch block>" --wait --until working --timeout 30000`.
   A coordinator sets `coordinator:` to its agent name, and a lead moving its own task leaves that line out.
6. A coordinator writes the tab ID and worktree path to `<home>/tasks/<id>/lead.txt` and ends its turn, because the lead prompts it when it reports.
   A lead moving its own task tells the human to continue in the tab labelled `<id>`, and stops.

### report and decide (a coordinator's lead)

Wait for the coordinator, then prompt it:
`herdr agent wait <coordinator> --until idle --until done --timeout 600000`, then `herdr agent prompt <coordinator> "report <id>: ..."`.
If the wait times out, the coordinator is still busy.
Wait again rather than prompting a working coordinator.
Start the message with `report <id>:`, `decision <id>:` or `handoff <id>:`, and for a decision end your turn after sending.

### notify (another task's lead)

Wait for the other lead the same way, then prompt it:
`herdr agent wait <lead> --until idle --until done --timeout 600000`, then `herdr agent prompt <lead> "from <id> lead: ..."`.

### delegate

1. Run `tstack.mjs seat "<role>" --runtime herdr`.
   For `inherit`, use your own lead seat.
2. Write each worker's brief, per dispatch.md.
3. Split a pane for each worker.
   The first is `herdr pane split --current --direction right --cwd "$PWD" --no-focus`.
   Each later one splits the previous worker's pane with `--direction down`.
4. `herdr agent start <id>-<name> --kind <kind> --pane <pane> -- <args...>`.
5. `herdr agent prompt <id>-<name> "<filled worker preamble>" --wait --until working --timeout 30000`.
6. Start every independent worker before you wait on any.

### collect

`herdr agent wait <id>-<name> --timeout 1800000` for each worker in turn.
Then read its result file and close its pane with `herdr pane close <pane>`.
A `blocked` status means the worker hit an approval or a question.
Read it with `herdr agent read`, and tell the human instead of answering it.
A timeout is not a failure.
Read the screen before deciding.
To stop a running worker, close its pane with `herdr pane close <pane>`.

### A candidate that needs its own checkout

Cut a worktree from your branch: `git worktree add <path> -b <your task branch>-<name>`, then `tstack.mjs link-skills <path>` if the skills are installed per project.
Start the candidate's pane with `--cwd <path>`.
Remove the worktree after you have taken what you need from it.
Design sketches that only write files need no worktree: give each candidate its own directory under `<home>/tasks/<id>/evidence/`.

### watch-pr

Run `gh pr checks <url> --watch --fail-fast` as a background command, so your harness wakes you when it exits.
Set no timeout of your own, because a review bot can take half an hour.
When it exits, read new review comments with `gh pr view <url> --comments`.
Never poll with a sleep loop.

### After the merge

You run inside the task's worktree, so cleaning it up is your last action before the final message.
Run each command with `git -C <primary checkout>`, so your shell never stands in a removed directory.

1. `git -C <primary checkout> worktree remove <your worktree>`.
   It refuses when the worktree has uncommitted changes.
2. Delete the branch only once its work has landed:
   - for `local-only`, `git -C <primary checkout> branch -d <your task branch>`, which refuses unless the merge reached the default branch;
   - for `pr`, once `gh pr view <pr> --json state` shows `MERGED`, `git -C <primary checkout> branch -D <your task branch>`, because a squash or rebase merge leaves the branch's own commits looking unmerged to Git.
3. Tell the human the task's tab can be closed.

A refusal means stop and look, never force.

## Coordinator

At the start of a session, name yourself so leads can reach you:
`herdr agent rename "$HERDR_PANE_ID" coordinator-<project>`, where `<project>` is the primary checkout's directory name, lowercased, with other characters turned into `-` and cut to fit.

### Talking to a lead

Wait for it to be idle, then prompt it: `herdr agent wait <id>-lead --until idle --until done --timeout 600000`, then `herdr agent prompt <id>-lead "..."`.
To see where a quiet lead is, run `herdr agent get <id>-lead` and `herdr agent read <id>-lead --source recent-unwrapped --lines 80`.
A `blocked` status means an approval or question is on screen.
Read it and tell the human.
Never type an answer into it yourself.

### hold

Prompt the lead without waiting first: `herdr agent prompt <id>-lead "hold <id>: <the human's words>"`.
A prompt to a working agent takes over its turn, which is what a hold needs.
To release it, wait for it to be idle, then prompt `release <id>:`.

### After the merge

`herdr tab close <tab>`, then run the lead's [After the merge](#after-the-merge) steps 1 and 2 for its worktree and branch.

## History

Each harness keeps its own session files.
Where a skill reads chat history or transcripts, read this checkout's:
- Claude Code: `~/.claude/projects/<checkout path with each / and . turned into ->/`;
- Pi: `~/.pi/agent/sessions/--<checkout path without its leading /, with each / turned into ->--/`;
- Codex: the files under `~/.codex/sessions/` whose `cwd` is this checkout.

## Worker

Never run `herdr` commands.
Your final message is your verdict line.
The lead reads it from your screen and your result file.
