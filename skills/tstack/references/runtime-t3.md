# T3 runtime

Use this when you run in a T3 Code thread: the `t3-code` MCP tools are available and `t3_thread_list` returns a `currentThreadId`.
[dispatch.md](dispatch.md) owns the verbs, seats and depth.
This file owns the calls.
The calls were measured on T3 Code (Nightly), 2026-10-05, and checked against T3's source on 2026-10-28.
Moving a lead with `t3_worktree_handoff` ran live on 2026-10-14.
On 2026-10-29 these ran live on a trial project: launches with a `clientRequestId`, including a retry that returned the same thread; delegated workers and their completion wakes; a failed seat stopping for the human; worktree-isolated arena candidates; PR linking, watching and unwatching with the `pr-state` loop; and an autopilot-full coordinator that pinned its thread, launched two leads, took their `queue` reports, armed a heartbeat and deleted it by its `scheduledTaskId`, merged under its grant, and archived the leads.
The surface tools, history, hold and worker cancellation follow T3's own tool definitions, and have not yet run in a live task, and neither has a heartbeat run firing.

`tstack.mjs` means `node <tstack skill directory>/scripts/tstack.mjs`.

## Facts to rely on

- Your own thread ID is `currentThreadId` in `t3_thread_list`.
- `t3_thread_launch` needs a Full access caller.
  Pass a `clientRequestId`, and after an error or a lost response, retry with the same key.
- A launched thread gets no completion wake.
  It reports by sending a message.
- `t3_thread_send` with mode `auto` takes over a busy target's turn.
  Mode `queue` waits for the busy turn to end and starts an idle target at once.
  Always send with `queue`.
- With a per-project install, a new T3 worktree gets the skills only through the project action that `tstack-setup` asks the human to add.
- `t3_worktree_status` says whether your thread is bound to a worktree.
  `t3_worktree_handoff` moves an unbound thread into a new worktree and keeps the conversation, but T3 marks the turn that calls it failed, and a `continuationPrompt` stays queued until the human's next message.
- A delegated worker runs in its parent's checkout, unless it was delegated with `isolation: "worktree"`.
  Its completion wakes the parent as a new turn, and the wake carries the worker's final message when it fits.
  A running delegate's `next` says to end your turn: do that, and never poll it.
- Seats come from `tstack.mjs seat`.
  A launch takes `modelSelection: { instanceId, model, options }`.
  A delegation takes `target: { providerInstanceId, model, options }`.
  The seat output uses `providerInstanceId`, so rename it to `instanceId` for a launch.

## Lead

### Your thread

The human opens a thread for each task and talks to you there.
A thread opened in New worktree mode already runs in its own worktree, on a branch T3 named, so intake's checkout check passes.
The worktree belongs to T3.
Never delete it yourself.

### launch-lead

A coordinator uses this to start each lead, and a lead uses it to hand off its task to a fresh thread.
A lead moving its own ship task out of the primary checkout uses [Moving your own task](#moving-your-own-task) instead.
It needs Full access.
Without it, ask the human to open a thread in New worktree mode and send the launch block as its first message, then stop.

1. Run `tstack.mjs seat "lead <playbook>" --runtime t3`.
2. Read the base branch: the primary checkout's current branch, which must be the default branch with no uncommitted changes.
   An autopilot-stack link uses the previous link's task branch instead.
3. Call `t3_thread_launch` with:
   - `title`: `<id> lead`
   - `workspaceStrategy`: `{ "type": "worktree", "baseRef": "<base>", "branch": "task/<id>", "startFromOrigin": false }`;
     for a handoff, `{ "type": "existing_worktree", "worktreePath": "<the lead's worktree>", "branch": "task/<id>" }`, and skip step 2
   - `modelSelection`: the seat, with `providerInstanceId` renamed to `instanceId`; leave it out for `inherit`
   - `message`: the launch block from dispatch.md; a coordinator sets `coordinator:` to its `currentThreadId`, and a lead moving its own task leaves that line out
   - `clientRequestId`: `<id>-lead`, or `<id>-lead-<n>` for the nth handoff
4. A coordinator writes the returned `threadId` to `<home>/tasks/<id>/lead.txt` and ends its turn, because the lead's reports arrive as new turns.
   A lead handing off its task tells the human to continue in the thread titled `<id> lead`, and stops.

### Moving your own task

When intake finds you in the primary checkout, move this thread instead of starting another.

1. Call `t3_worktree_status`.
   If it reports a worktree, you are already out of the primary checkout, so go on with intake.
2. Tell the human, in this turn, that the thread is moving to the worktree on `task/<id>` and that they should send any message to continue there.
3. Call `t3_worktree_handoff` as the last action of the turn, with `branch`: `task/<id>`, `baseRef`: the primary checkout's current branch, and `startFromOrigin`: `false`.
   Pass no `continuationPrompt`, because it waits behind the human's next message anyway.
4. When the human's next message arrives, run `git rev-parse --git-dir --git-common-dir`, confirm the two paths differ, and follow [Lead](../SKILL.md#lead).

### report and decide (a coordinator's lead)

Send with `t3_thread_send`: `{ "threadId": "<coordinator from the launch block>", "message": "...", "mode": "queue", "clientRequestId": "<id>-lead-<n>" }`.
Start the message with `report <id>:`, `decision <id>:` or `handoff <id>:`.
For a decision, end your turn after sending, and wait for the coordinator's answer.

### notify (another task's lead)

Send with `t3_thread_send`: `{ "threadId": "<the other lead's thread>", "message": "from <id> lead: ...", "mode": "queue", "clientRequestId": "<id>-notify-<n>" }`.

### delegate

1. Run `tstack.mjs seat "<role>" --runtime t3`.
   A panel prints one line per seat.
2. Write each worker's brief, per dispatch.md.
3. For each seat, call `delegate_task` with:
   - `task`: the filled worker preamble
   - `target`: the seat line; leave it out for `inherit`
   - `title`: `<id> <name>`
   - `role`: the closest of `implementation`, `research`, `review`, `design`, `test` or `general`
   - `mode`: `async`
   - `clientRequestId`: `<id>-<name>-<round>`, where round 1 is the first brief and each fix round adds one; keep it stable across retries of that round, because T3 answers a repeated key with the earlier task
4. When every independent worker is launched, end your turn.

### collect

Each completion wakes you with the worker's task ID and, when it fits, its final message, which is its verdict line.
Read the worker's result file.
Call `task_status` with the `taskId` only when the wake did not carry the final message.
A fix round is a new `delegate_task` with consolidated scope, never a message to the finished worker.
To stop a running worker, call `task_cancel` with its `taskId`.

### A candidate that needs its own checkout

Arena and swarm candidates that must build or run code need their own worktree, and T3 makes one for each:

1. Commit what the candidates start from, because an isolated worktree starts from your last commit and leaves uncommitted edits out.
2. Record `git status --porcelain` in your own worktree.
3. Delegate each candidate as [delegate](#delegate) says, with `isolation: "worktree"`.
   Its brief's SCOPE says it works in its own new worktree, and its SKILLS name each `SKILL.md` by absolute path in your checkout, because a per-project install may be missing from the new worktree.
4. After you collect it, read the candidate's `worktreePath` and `branch` with `t3_thread_read` on its child thread, and take what you need from that branch.
5. Confirm `git status --porcelain` in your worktree is unchanged, so the candidate never wrote outside its own.

T3 owns those worktrees and names their branches.
Never delete one yourself.

Design sketches that only write files need no worktree: give each candidate its own directory under `<home>/tasks/<id>/evidence/`.

### Opening and watching a PR

Right after `gh pr create`, call `link_pull_request` with the PR's `url`, so T3 shows the PR beside your thread and settles the thread when it merges.
Then call `watch_pull_request` with the same `url`.
The watch lasts across pushes, and a watched thread never auto-settles.

The watch wakes you on a failed check, passing required checks, the other checks settling, no checks reported for 15 minutes, a comment or review from another GitHub account, a conflict, or a close.
It never wakes on a merge, which ends it silently, on the base moving ahead without a conflict, or on review bots going quiet, and it misses comments posted before you armed it.
T3 ignores comments from the GitHub account it reads with, and only a top-level thread can watch.
So watch-pr on T3 pairs the watch with a `pr-state` loop inside your turn:

1. Handle the review threads already on the PR.
2. Run `tstack.mjs pr-state <pr> --wait 540`, with your shell's own timeout above 540 seconds and under the 600-second tool cap.
   It returns as soon as the verdict is anything but `WAITING`, or after nine minutes.
3. Act on the verdict as the babysit playbook says.
   After any `WAITING` other than `review-required` or `approval`, and after every push, go back to step 2 in the same turn.
4. On `WAITING review-required` or `WAITING approval`, tell the human the PR waits on their review or approval, and end your turn.
   The watch wakes you on their review, and you start again at step 1.
5. When you stop, or the PR merges, call `unwatch_pull_request`.

A wake is news, not a merge decision.

When T3's review guides are on, `write_pull_request_guides` with the PR's `url` writes a reviewer's tour of the change into the PR's Guide tab.
It fails when guides are off, which changes nothing else.

### After the merge

Leave your thread for the human to archive.
With `pr` delivery, the PR link settles it when the PR merges.
T3's storage settings remove merged worktrees when the human enables that (`storageCleanup.worktreeOnMerge` in `~/.t3/userdata/settings.json`).
Otherwise the worktree stays for the human.

## Coordinator

Start with Full access, and pin your own thread with `t3_thread_organize` and `{ "action": "pin" }`, so T3 never auto-settles it.

### Talking to a lead

Send with `t3_thread_send`: `{ "threadId": "<lead>", "message": "...", "mode": "queue", "clientRequestId": "<id>-coordinator-<n>" }`.
To see where a quiet lead is, read it with `t3_thread_read` or check its run status in `t3_thread_list`.
Never steer or restart a lead to check on it.

### hold

Call `t3_thread_interrupt` with the lead's `threadId`, then send `hold <id>: <the human's words>` with mode `queue`, which starts the now idle lead at once.
To release it, send `release <id>:` with mode `queue`.

### After the merge

Archive the lead's thread with `t3_thread_organize`.
The worktree follows the lead's rule above.
Never delete a T3 worktree yourself.

## Heartbeat

When a lead's long run has no event to wake it, or a coordinator runs an autopilot program, call `schedule_task` with `schedule: { "type": "interval", "everyMs": <ms> }` and a prompt that names the task or program and its predicate.
Give it a `title` that names the task or program.
Each run posts that prompt into your own thread.
Write the `scheduledTaskId` it returns to `<home>/tasks/<id>/heartbeat.txt`, or to `<home>/autopilot-<name>-heartbeat.txt` for a program.
Delete it by that ID with `delete_scheduled_task` when the lead reports done, the program's queue ends, or the human stops you, because a schedule outlives a stop and would start the work again.
The project holds other scheduled tasks, so never delete one whose ID you did not record.
`run_scheduled_task_now` runs it once, to prove it posts what you expect.

## Proving on the real surface

When the human has browser access on in T3, every session has T3's browser tools, a delegated worker's included.
Device access gives the simulator tools the same way.
Use them to drive a web UI or a simulator when the project's `verify-*` skill names no driver of its own.
An error saying the capability is unavailable means that access is off, so use the verify skill's driver instead.

- A web UI: call `preview_open`, then `preview_navigate` with `{ "target": { "kind": "environment-port", "port": <dev server port> } }`.
  Drive it with `preview_click`, `preview_type`, `preview_press` and `preview_wait_for`, and read it with `preview_snapshot`.
- A simulator: call `device_list`, then `device_open`, which returns the `agent-device` command for that device.
  Drive it with that command, and call `device_close` when you are done.
- Evidence: `preview_snapshot` with `save: true` returns a screenshot's path, `preview_recording_stop` returns the path of the recording `preview_recording_start` began, and `agent-device screenshot <path>` saves a simulator's screen.
  Copy each file into the task's `evidence/` folder, or the path your brief names, and cite that copy.

## History

T3 keeps every thread in the project, a delegated worker's included.
Where a skill reads chat history or transcripts, find threads by topic with `t3_thread_search`, list them newest first with `t3_thread_list`, and read one with `t3_thread_read`.
`t3_thread_search` covers one project, the calling thread's or the `projectId` you pass, so search once per project from `t3_project_list` when the work spans projects.
Bound each read with `maxCharsPerItem` and page with `afterPosition`.
Expand one item with `itemId` and `textOffset` only when it matters.

## Worktrees in use

A worktree is in use while a T3 thread is bound to it, whatever `worktree-audit.sh` says.
`t3_thread_list` does not return a thread's worktree, so page through it with `includeSubagents: true` and read each thread's `worktreePath` from `t3_thread_read`.

## Worker

Never call `delegate_task`, `t3_thread_launch` or `t3_thread_send`.
Your final message is your verdict line, which reaches your lead in its completion wake.
