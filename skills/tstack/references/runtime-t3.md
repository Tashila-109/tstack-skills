# T3 runtime

Use this when the `t3-code` MCP tools are available, for example `orchestrator_capabilities`.
[dispatch.md](dispatch.md) owns the verbs, seats and depth.
This file owns the calls.
The calls were measured on T3 Code (Nightly), 2026-10-05.
The surface tools, history, PR linking, hold, worker cancellation and the heartbeat were added on 2026-10-06 from T3's own tool definitions, and have not yet run in a live task.

`tstack.mjs` means `node <tstack skill directory>/scripts/tstack.mjs`.

## Facts to rely on

- Your own thread ID is `currentThreadId` in `t3_thread_list`.
- `t3_thread_launch` needs a Full access caller and has no retry key.
  After an error or a lost response, check `t3_thread_list` before launching again.
- A launched thread gets no completion wake.
  It reports by sending a message.
- `t3_thread_send` with mode `auto` takes over a busy target's turn.
  Mode `queue` waits for the busy turn to end and starts an idle target at once.
  Always send with `queue`.
- With a per-project install, a new T3 worktree gets the skills only through the project action that `tstack-setup` asks the human to add.
- A delegated worker runs in its parent's checkout, and its completion wakes the parent as a new turn.
  End your turn instead of polling.
- Seats come from `tstack.mjs seat`.
  A launch takes `modelSelection: { instanceId, model, options }`.
  A delegation takes `target: { providerInstanceId, model, options }`.
  The seat output uses `providerInstanceId`, so rename it to `instanceId` for a launch.

## Main

Start with Full access, and ask the human to pin this thread so T3 never auto-settles it.

### launch-lead

1. Run `tstack.mjs seat "lead <playbook>" --runtime t3`.
2. Read the base branch: the primary checkout's current branch, which must be the default branch with no uncommitted changes.
   An autopilot-stack link uses the previous link's task branch instead.
3. Call `t3_thread_launch` with:
   - `title`: `<id> lead`
   - `workspaceStrategy`: `{ "type": "worktree", "baseRef": "<base>", "branch": "task/<id>", "startFromOrigin": false }`
   - `modelSelection`: the seat, with `providerInstanceId` renamed to `instanceId`; leave it out for `inherit`
   - `message`: the launch block from dispatch.md, with `main:` set to your `currentThreadId`
4. Write the returned `threadId` to `<home>/tasks/<id>/lead.txt`.
5. End your turn.
   The lead's reports arrive as new turns.

### Talking to a lead

Send with `t3_thread_send`: `{ "threadId": "<lead>", "message": "...", "mode": "queue", "clientRequestId": "<id>-main-<n>" }`.
To see where a quiet lead is, read it with `t3_thread_read` or check its run status in `t3_thread_list`.
Never steer or restart a lead to check on it.

### hold

Call `t3_thread_interrupt` with the lead's `threadId`, then send `hold <id>: <the human's words>` with mode `queue`, which starts the now idle lead at once.
To release it, send `release <id>:` with mode `queue`.

### After the merge

Archive the lead's thread with `t3_thread_organize`.
T3's storage settings remove merged worktrees when the human enables that (`storageCleanup.worktreeOnMerge` in `~/.t3/userdata/settings.json`).
Otherwise leave the worktree for the human.
Never delete a T3 worktree yourself.

## Lead

### report and decide

Send with `t3_thread_send`: `{ "threadId": "<main from the launch block>", "message": "...", "mode": "queue", "clientRequestId": "<id>-lead-<n>" }`.
Start the message with `report <id>:` or `decision <id>:`.
For a decision, end your turn after sending, and wait for main's answer.

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

Each completion wakes you with a task ID.
Call `task_status` with that `taskId` to acknowledge it, then read the worker's result file.
A fix round is a new `delegate_task` with consolidated scope, never a message to the finished worker.
To stop a running worker, call `task_cancel` with its `taskId`.

### A candidate that needs its own checkout

Arena and swarm candidates that must build or run code need their own worktree.
Launch each with `t3_thread_launch`:
- `workspaceStrategy`: `{ "type": "worktree", "baseRef": "task/<id>", "branch": "task/<id>-<name>", "startFromOrigin": false }`
- `modelSelection`: from the seat
- `message`: the worker preamble

Follow it with `t3_thread_wait`, because a launched thread does not wake you.
Design sketches that only write files need no worktree: give each candidate its own directory under `<home>/tasks/<id>/evidence/`.

### Opening and watching a PR

Right after `gh pr create`, call `link_pull_request` with the PR's `url`, so T3 shows the PR beside your thread and settles the thread when it merges.

For watch-pr, call `watch_pull_request` with its `url`, handle the existing comments, then end your turn.
It wakes you when a check fails, the required checks pass, someone else comments or reviews, or the branch conflicts.
A wake is news, not a merge decision.

### heartbeat

When a long run has no event to wake you, call `schedule_task` with `schedule: { "type": "interval", "everyMs": <ms> }` and a prompt that names your task and its predicate.
Each run posts that prompt into your own thread.
Delete it with `delete_scheduled_task` before you report done.

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

## Worker

Never call `delegate_task`, `t3_thread_launch` or `t3_thread_send`.
Your final message is your verdict line, which your lead reads through `task_status`.
