# Herdr runtime

Use this when `HERDR_ENV=1` and the `t3-code` MCP tools are absent.
[dispatch.md](dispatch.md) owns the verbs, seats and depth.
This file owns the calls.
The calls were measured on Herdr 0.9.3, 2026-10-05, and `herdr agent list` reporting `cwd` on 0.9.5, 2026-10-30.
Confirming that a stopped worker ended, by its pane leaving `herdr pane list`, follows Herdr's documented commands and has not run live.
[Sending a prompt](#sending-a-prompt), [hold](#hold), [Worktrees in use](#worktrees-in-use), [Telling the human](#telling-the-human), [When get and read are unclear](#when-get-and-read-are-unclear) and the lead names follow Herdr 0.9.5 help and docs (2026-11-27); not yet measured live.

`tstack.mjs` means `node <tstack skill directory>/scripts/tstack.mjs`.
The `herdr` control commands this file runs return JSON.
Help, `--version` and the default `herdr api schema` output are plain text.
Read IDs from the response instead of predicting them.

## Facts to rely on

- `herdr agent prompt` types the message into the agent's pane, even while the agent is working.
  Whether a working agent drops its turn or takes the message later depends on its harness, so never count on a prompt stopping a turn.
  Herdr refuses to prompt a `blocked` agent with `agent_blocked`.
  Send every message as [Sending a prompt](#sending-a-prompt) says.
- Agent names match `[a-z][a-z0-9_-]{0,31}` and are unique on the Herdr server.
  The 32-character limit covers the whole name, suffix included, such as `<id>-lead-2`.
  `tstack.mjs preflight --runtime herdr --task <id>` refuses a task ID that does not start with a letter or is too long for its lead's handoff names.
  Keep each worker's `<name>` short enough that `<id>-<name>` fits too.
- `herdr agent start` returns `agent_not_ready` when the agent is blocked at startup, for example on a trust dialog.
  Never answer a trust dialog.
  Tell the human which tab it is in.
- Seats come from `tstack.mjs seat "<role>" --runtime herdr --task <id>` as `{ "kind", "args" }`.
  `args` already holds the model, the effort and the autonomy flags.
  A `+fast` seat is refused, because no fast-mode flag is known for these CLIs.

## Sending a prompt

Every message tstack sends another agent goes through these steps, except a hold, which [hold](#hold) sends at once.

1. Wait for the agent to settle: `herdr agent wait <name> --timeout 600000`.
   With no `--until`, it returns on `idle`, `done` or `blocked`.
2. On `blocked`, an approval or a question is on its screen.
   Do not prompt it.
   Read it with `herdr agent read <name> --source recent-unwrapped --lines 80`, tell the human as [Telling the human](#telling-the-human) says, and go back to step 1 once they have answered.
3. On a timeout, do not assume the agent is busy.
   Run `herdr agent get <name>` and `herdr agent read <name> --source recent-unwrapped --lines 80`, and act on what they show.
   When they leave it unclear, see [When get and read are unclear](#when-get-and-read-are-unclear).
4. On `idle` or `done`, send `herdr agent prompt <name> "<message>" --wait --until working --until blocked --timeout 30000`.
   It returns once the pane starts a turn or stops on a dialog.
   Herdr watches the pane, not your message, so that turn or dialog may belong to another sender's message.
5. An `agent_blocked` error means Herdr refused the message before typing it: go back to step 2.
   A `blocked` status after the send means the message was typed and a dialog followed.
   Read it and tell the human as step 2 says, but do not send the message again.
   On `agent_prompt_stalled`, which means no activity within five seconds, or on a timeout, the message may still have arrived or be queued, so do not send it again yet.
   Wait for the agent to settle as step 1 says, then read its screen with `--lines 400`.
   When the screen shows the message or a reply to it has come, do not send it again, and wait for the reply that confirms it.
   Send it once more only when the agent is `idle` or `done`, the screen does not show it, and no reply has come.
   When the agent has not settled, or the second send stalls too, tell the human as [Telling the human](#telling-the-human) says.

Another agent can prompt the same agent between steps 1 and 4, so your message can land mid-turn, and the state you see can come from that agent's message.
A message is delivered only once the recipient answers it, such as `held <id>:` for a hold or a reply that names your task.
Before you repeat consequential work, such as a launch block, also check the lead's task folder for any sign it started.

## Lead

### Your pane

The human starts you in a Herdr pane and talks to you there.
Intake moves a ship task started in the primary checkout into its own worktree and tab with launch-lead.

### launch-lead

A lead uses this to move a ship task out of the primary checkout, a coordinator uses it to start each lead, and both use it to relaunch a lead for a handoff.

1. Run `tstack.mjs seat "lead <playbook>" --runtime herdr --task <id>`.
2. From the primary checkout, which must be on the default branch with no uncommitted changes, run `git worktree add ~/.tstack/worktrees/<project>/<id> -b task/<id>`, where `<project>` is the primary checkout's directory name.
   An autopilot-stack item that builds on another item branches from that item's task branch instead: add that branch name as the last argument.
   If the primary checkout has a `skills-lock.json`, the skills are installed per project, so run `tstack.mjs link-skills <worktree>` too.
   For a handoff, skip this step: the worktree exists, and the new agent takes the next free name, such as `<id>-lead-2`, that `herdr agent list` does not show.
   The lead name below means the name this step chose: `<id>-lead`, or the free name for a handoff.
3. `herdr tab create --workspace "$HERDR_WORKSPACE_ID" --cwd <worktree> --label <id> --no-focus`, and keep `.result.tab.tab_id` and `.result.root_pane.pane_id`.
4. `herdr agent start <lead name> --kind <kind> --pane <pane> -- <args...>`.
   For `inherit`, start your own harness with your own model and effort, as delegate does.
5. Send the launch block to `<lead name>` as [Sending a prompt](#sending-a-prompt) steps 4 and 5 say.
   A coordinator sets `coordinator:` to its agent name, and a lead moving its own task leaves that line out.
6. Write the lead name, tab ID and worktree path to `<home>/tasks/<id>/lead.txt` before you end your turn, whether you are a coordinator or a lead moving or replacing its own task.
   Every later message to this lead goes to the name in `lead.txt`, never to a name rebuilt from the task ID.
   A coordinator then ends its turn, because the lead prompts it when it reports.
   A lead moving its own task tells the human to continue in the tab labelled `<id>`, and stops.

### report and decide (a coordinator's lead)

Send to the coordinator named in your launch block, as [Sending a prompt](#sending-a-prompt) says.
Start the message with `report <id>:`, `decision <id>:`, `handoff <id>:` or `held <id>:`, and for a decision end your turn after sending.
On `hold <id>:` from the coordinator, stop your workers as [collect](#collect) says, then send `held <id>:` naming each worker and whether its pane has left `herdr pane list`.

### notify (another task's lead)

Send `from <id> lead: ...` to the agent named in that task's `lead.txt`, as [Sending a prompt](#sending-a-prompt) says.

### delegate

1. Run `tstack.mjs seat "<role>" --runtime herdr --task <id>`.
   For `inherit`, start your own harness with your own model and effort.
2. Write each worker's brief, per dispatch.md.
3. Split a pane for each worker.
   The first is `herdr pane split --current --direction right --cwd "$PWD" --no-focus`.
   Each later one splits the previous worker's pane with `--direction down`.
4. `herdr agent start <id>-<name> --kind <kind> --pane <pane> -- <args...>`.
5. Send the filled worker preamble to `<id>-<name>` as [Sending a prompt](#sending-a-prompt) steps 4 and 5 say.
6. Start every independent worker before you wait on any.

### collect

`herdr agent wait <id>-<name> --timeout 1800000` for each worker in turn.
Then read its result file and close its pane with `herdr pane close <pane>`.
A `blocked` status means the worker hit an approval or a question.
Read it with `herdr agent read`, and tell the human as [Telling the human](#telling-the-human) says instead of answering it.
A timeout is not a failure.
Read the screen before deciding, and see [When get and read are unclear](#when-get-and-read-are-unclear) if it does not settle it.
To stop a running worker, close its pane with `herdr pane close <pane>`.
It has left Herdr once `herdr pane list` no longer shows that pane.
That does not prove every process it started has exited, because a process it detached, such as a dev server, can outlive the pane.

### A candidate that needs its own checkout

Cut a worktree from your branch: `git worktree add <path> -b <your task branch>-<name>`, then `tstack.mjs link-skills <path>` if the skills are installed per project.
Start the candidate's pane with `--cwd <path>`.
Remove the worktree after you have taken what you need from it.
Design sketches that only write files need no worktree: give each candidate its own directory under `<home>/tasks/<id>/evidence/`.

### Opening a PR

Herdr has no thread to link a PR to.
Give the human the PR's full URL instead.

### watch-pr

Run `tstack.mjs pr-state <pr number> --wait 540` as a background command, so your harness wakes you when it exits.
It returns as soon as the verdict is anything but `WAITING`, or after nine minutes.
On `WAITING review-required` or `WAITING approval`, tell the human the PR waits on their review or approval, and stop watching until they reply, because polling cannot clear a gate that waits on a person.
On any other `WAITING`, run it again; a review bot can take half an hour.
On any other verdict, read new review comments with `gh pr view <url> --comments` and act per the babysit playbook.
Never poll with a sleep loop of your own.

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

`<lead>` below is the agent name in `<home>/tasks/<id>/lead.txt`.
Send to it as [Sending a prompt](#sending-a-prompt) says.
To see where a quiet lead is, run `herdr agent get <lead>` and `herdr agent read <lead> --source recent-unwrapped --lines 80`.
A `blocked` status means an approval or question is on screen.
Read it and tell the human as [Telling the human](#telling-the-human) says.
Never type an answer into it yourself.

### hold

A hold is requested when you send it, and the task is held only once the lead acknowledges it.

1. Run `herdr agent get <lead>`.
   If it is `blocked`, a prompt is refused, so read its screen, tell the human the hold waits on that dialog, and send the hold once the dialog clears.
2. Otherwise send `herdr agent prompt <lead> "hold <id>: <the human's words>"` without waiting first, so the hold does not wait for the lead's turn to end.
3. The hold is requested until the lead sends `held <id>:`, naming each worker it stopped and whether that worker's pane has left `herdr pane list`.
   Only then is the task held.
4. If the lead settles without sending `held <id>:`, read its screen.
   Send the hold again when the screen does not show it, and tell the human when the lead still does not acknowledge it.

To release it, send `release <id>:` as [Sending a prompt](#sending-a-prompt) says.

### After the merge

`herdr tab close <tab>`, then run the lead's [After the merge](#after-the-merge) steps 1 and 2 for its worktree and branch.

## Telling the human

When a task needs the human, such as a blocked agent, a trust dialog or a hold the lead has not acknowledged, say so in your own pane.
Also raise a Herdr notification, which reaches the human even when they are in another tab: `herdr notification show "<id> needs you" --body "tab <tab label>: <reason>" --sound request`.
Its `shown` field says whether it appeared, because Herdr shows it only to an attached client and can drop it as rate-limited or busy.
A notification reaches the human only.
Another agent still needs a message sent as [Sending a prompt](#sending-a-prompt) says.

## When get and read are unclear

`herdr agent explain <name>` shows how Herdr classified the agent's screen, with the final state, the rule that matched and any fallback reason.
`herdr pane process-info --pane <pane>` lists the pane's foreground processes, each with its pid, command and working directory where the platform exposes them.
Use them when `herdr agent get` and `herdr agent read` leave it unclear whether an agent is working, blocked or gone.
Both only read.

## Heartbeat

Herdr has no scheduler, so there is no time-based heartbeat.
Your wakes are a worker finishing, a lead's report, and a background `pr-state` exiting.
On each wake, a lead runs `tstack.mjs status <id>` and collects each finished worker it lists and has not read, because one worker can finish while the lead waits on another.
An autonomous run with nothing to wake it keeps working inside its turn.
Before you end a turn with work left, tell the human what is left and what message continues it.

## Proving on the real surface

Drive a web UI, a CLI or a simulator with the project's `verify-*` skill.
Save screenshots and recordings into the task's `evidence/` folder, or the path your brief names, and cite that copy.

## History

Each harness keeps its own session files.
Where a skill reads chat history or transcripts, read this checkout's:
- Claude Code: `~/.claude/projects/<checkout path with each / and . turned into ->/`;
- Pi: `~/.pi/agent/sessions/--<checkout path without its leading /, with each / turned into ->--/`;
- Codex: the files under `~/.codex/sessions/` whose `cwd` is this checkout.

## Worktrees in use

A worktree is in use while any pane, with or without an agent in it, works inside it.
`herdr pane list` shows each pane's `cwd`, the directory Herdr opened it in, and `foreground_cwd`, the directory of its foreground process, when Herdr can resolve it.
A path is inside the worktree when it equals the worktree's path or starts with that path followed by `/`, so `/w/task-1` does not match `/w/task-10`.
A worktree is free only when no pane's `cwd` or `foreground_cwd` is inside it.
A pane with no `foreground_cwd` has an unknown owner.
Run `herdr pane process-info --pane <pane>`, and treat the worktree as in use until that shows no process inside it.

## Worker

Never run `herdr` commands.
Your final message is your verdict line.
The lead reads it from your screen and your result file.
