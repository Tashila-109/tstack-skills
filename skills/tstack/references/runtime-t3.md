# T3 runtime

Use this when you run in a T3 Code thread: the `t3-code` MCP tools are available and `t3_thread_list` returns a `currentThreadId`.
[dispatch.md](dispatch.md) owns the verbs, seats and depth.
This file owns the calls.
The calls were measured on T3 Code (Nightly), 2026-10-05, and checked against T3's source on 2026-10-28.
Moving a lead with `t3_worktree_handoff` ran live on 2026-10-14.
On 2026-10-29 these ran live on a trial project: launches with a `clientRequestId`, including a retry that returned the same thread; delegated workers and their completion wakes; a failed seat stopping for the human; worktree-isolated arena candidates; PR linking, watching and unwatching with the `pr-state` loop; and an autopilot-full coordinator that pinned its thread, launched two leads, took their `queue` reports, armed a heartbeat and deleted it by its `scheduledTaskId`, merged under its grant, and archived the leads.
On 2026-11-01, on T3 Code 0.1.6-nightly.20261031, `html_preview` drew a chart page from `chart.mjs render --theme t3` in the thread's dark and light colors with no console errors, and `html_render` showed it.
On 2026-11-03, on T3 Code 0.1.7-nightly.20261103.4119, a lead ran the charting playbook live on a trial project. It ran `chart.mjs check`, a verify worker reviewed the citations, the lead rendered and showed the `--theme t3` page, and a chart committed in a PR passed `stale` until a cited file changed.
On 2026-11-02 a heartbeat run fired live in a coordinator's thread, an hour after the human interrupted its program, and the coordinator then deleted it.
That run's T3 version was not recorded, so a heartbeat run still needs a live run on a recorded version before it counts as measured.
The surface tools, history, hold and worker cancellation follow T3's own tool definitions, and have not yet run in a live task.
On 2026-11-27 this file was checked against T3's source at commit 4f7c529085, beside an installed T3 Code 0.1.14-nightly.20261127.5332.
Each line that check changed says "per T3 source at 4f7c529085 (2026-11-27); not yet measured live", and keeps that mark until a live run on a recorded version replaces it.

`tstack.mjs` means `node <tstack skill directory>/scripts/tstack.mjs`.

## Facts to rely on

- Your own thread ID is `currentThreadId` in `t3_thread_list`.
- `t3_thread_launch` starts the new thread in its caller's runtime and interaction modes, and refuses a broader mode than the caller's, per T3 source at 4f7c529085 (2026-11-27); not yet measured live.
  So a supervised caller may launch, and its thread asks for approvals as the caller does.
  Below Full access, T3 skips the project action that runs on worktree create, so with a per-project install the new worktree would start with no skills.
  So below Full access, when the primary checkout has a `skills-lock.json`, do not launch: use the refused-launch fallback in [launch-lead](#launch-lead), whose New worktree thread runs that action.
  Pass a `clientRequestId`, and after an error or a lost response, retry with the same key.
- T3 starts a top-level thread only when the human asked for a new thread.
  A coordinator's leads and a lead's handoff are that ask, because the human asked for the program or the handoff.
  A worker is never a new thread: it is a `delegate_task`.
- A launched thread gets no completion wake.
  It reports by sending a message.
- `t3_thread_send` with mode `auto` starts an idle target, steers a busy target's turn, or queues, per T3 source at 4f7c529085 (2026-11-27); not yet measured live.
  Mode `queue` waits for the busy turn to end and starts an idle target at once.
  Always send with `queue`, so a report arrives as a turn of its own.
  T3 refuses a send to a target that runs with broader modes than the sender's.
  The result's `delivery` says `started` or `queued`, and its `runId` names a queued message.
  Before you send the same message again, call `t3_queue` with `action: "list"` on the target thread, and `action: "read"` with that `runId` as `queuedRunId`, per T3 source at 4f7c529085 (2026-11-27); not yet measured live.
  A message still queued arrives on its own, so edit or cancel it there instead of sending a duplicate.
  Never use `promote_to_steer` for a report, because it steers the running turn.
- With a per-project install, a new T3 worktree gets the skills only through the project action that `tstack-setup` asks the human to add.
- `t3_worktree_status` says whether your thread is bound to a worktree.
  `t3_worktree_handoff` moves an unbound thread into a new worktree and keeps the conversation.
  On 2026-10-14, T3 marked the turn that called it failed, and a `continuationPrompt` stayed queued until the human's next message.
  T3's source now reports the continuation as `skipped`, or as `scheduled` with `started` or `queued`, and schedules a supplied prompt to start the next turn in the worktree, per T3 source at 4f7c529085 (2026-11-27); not yet measured live.
- Call `orchestrator_capabilities` once in each thread before that thread's first `delegate_task`, and again only after an error or a provider change the human names.
  A coordinator's check does not cover a lead's thread, so each lead checks in its own.
  T3 returns a short model list for each instance, with `omittedModels` counting the rest, and its `search` input finds the others.
  When `check-seats` reports an incomplete catalog, save `orchestrator_capabilities` with `search` set to each model it names, and run `check-seats` again with the short list first and every search result after it.
- A native subagent of your own harness serves a foreground worker on your own provider and model with no settings beyond yours, per T3 source at 4f7c529085 (2026-11-27); not yet measured live.
  Every tstack worker runs in the background with `mode: "async"`, and T3 sends a background worker through `delegate_task`, so every seat uses it, `inherit` included.
- Leave out `runtimeMode` on `delegate_task`, so the worker inherits yours.
  A narrower mode pauses the worker for the human's approval, and T3 refuses a broader one.
- A delegated worker runs in its parent's checkout, unless it was delegated with `isolation: "worktree"`.
  Its completion wakes the parent as a new turn, and the wake carries the worker's final message when it fits.
  A running delegate's `next` says to end your turn: do that, and never poll it.
- Seats come from `tstack.mjs seat`.
  A `+fast` seat sets `fastMode` on a Claude model and `serviceTier` `priority` on a Codex model, which T3 Code 0.1.12-nightly.20261121.5038 offered on 2026-11-21.
  That T3 listed each option's choices as `values`, and `check-seats` reads that shape and the older `options` one.
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
When the launch is refused, ask the human to open a thread in New worktree mode and send the launch block as its first message, then stop.
A coordinator adds one line under that launch block: `First send the coordinator report <id>: thread <your currentThreadId>.`, and writes that thread ID to `<home>/tasks/<id>/lead.txt` when the report arrives.
For a refused handoff, ask instead for a thread in the lead's existing worktree, at its path on `task/<id>`, so the replacement keeps the branch and any uncommitted work, and never for a new worktree.

1. Run `tstack.mjs seat "lead <playbook>" --runtime t3 --task <id>`.
2. Pick the base, per T3 source at 4f7c529085 (2026-11-27); not yet measured live:
   - a base the human or the brief names;
   - otherwise, for an item that builds on another item, such as in autopilot-stack, or on commits not yet pushed, that local branch, with `startFromOrigin: false`;
   - otherwise, for independent work, the default branch on its remote, such as `origin/main`, with `startFromOrigin: true`, or the local default branch with `false` when the project has no remote.
     Take the remote from `git remote`: the only one, or with several, the one the local default branch tracks, `git for-each-ref --format='%(upstream:remotename)' refs/heads/<default>`.
     When there are several and that prints nothing, ask the human which remote to use.
     Take that remote's default branch from `git rev-parse --abbrev-ref <remote>/HEAD`, after `git remote set-head <remote> --auto` when that ref is missing.
     Use the local default branch with `false` only when `git remote` prints nothing.
3. Call `t3_thread_launch` with:
   - `title`: `<id> lead`
   - `workspaceStrategy`: `{ "type": "worktree", "baseRef": "<base>", "branch": "task/<id>", "startFromOrigin": <from step 2> }`;
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
   Pass no `continuationPrompt`, because the one measured on 2026-10-14 waited behind the human's next message.
   T3 now schedules a supplied prompt to start the next turn by itself, per T3 source at 4f7c529085 (2026-11-27); not yet measured live, so pass one only after a live run on a recorded version shows it starting.
4. When the human's next message arrives, run `git rev-parse --git-dir --git-common-dir`, confirm the two paths differ, and follow [Lead](../SKILL.md#lead).

### report and decide (a coordinator's lead)

Send with `t3_thread_send`: `{ "threadId": "<coordinator from the launch block>", "message": "...", "mode": "queue", "clientRequestId": "<id>-lead-<n>" }`.
Start the message with `report <id>:`, `decision <id>:` or `handoff <id>:`.
For a decision, end your turn after sending, and wait for the coordinator's answer.

### notify (another task's lead)

Send with `t3_thread_send`: `{ "threadId": "<the other lead's thread>", "message": "from <id> lead: ...", "mode": "queue", "clientRequestId": "<id>-notify-<n>" }`.

### delegate

1. Run `tstack.mjs seat "<role>" --runtime t3 --task <id>`.
   A panel prints one line per seat.
2. Write each worker's brief, per dispatch.md.
3. For each seat, call `delegate_task` with:
   - `task`: the filled worker preamble
   - `target`: the seat line; leave it out for `inherit`
   - `title`: `<id> <name>`
   - `role`: the closest of `implementation`, `research`, `review`, `design`, `test` or `general`
   - `mode`: `async`
   - `clientRequestId`: `<id>-<name>-<round>`, where round 1 is the first brief and each fix round, or restart of a worker you stopped, adds one; keep it stable when you resend the same request, because T3 answers a repeated key with the earlier task
4. When every independent worker is launched, end your turn.

### collect

Each completion wakes you with the worker's task ID and, when it fits, its final message, which is its verdict line.
Read the worker's result file.
Call `task_status` with the `taskId` only when the wake did not carry the final message.
When the human asks you to wait on a thread, call `t3_thread_wait` with its `threadId`, per T3 source at 4f7c529085 (2026-11-27); not yet measured live.
With no `runId` it waits on the latest run, and `untilDelegatedWorkSettled: true` also waits for that thread's own workers and names the run with its answer as `resultRun`.
On a timeout with `next`, follow `next` and end your turn.
A fix round is a new `delegate_task` with consolidated scope, never a message to the finished worker.
To stop a running worker, call `task_cancel` with its `taskId`.
It has ended once `task_status` shows a `workState` other than `working` or `waiting_for_children`.

### A candidate that needs its own checkout

Arena and swarm candidates that must build or run code need their own worktree, and T3 makes one for each:

1. Commit what the candidates start from, because an isolated worktree starts from your last commit and leaves uncommitted edits out.
   In a project folder that holds several repositories, each repository's worktree starts from your branch in that repository when it points at your commit, per T3 source at 4f7c529085 (2026-11-27); not yet measured live.
   So commit in every repository the candidates use, and check that each repository's branch points at the commit you mean.
2. Record `git status --porcelain` in your own worktree.
3. Delegate each candidate as [delegate](#delegate) says, with `isolation: "worktree"`.
   Its brief's SCOPE says it works in its own new worktree, and its SKILLS name each `SKILL.md` by absolute path in your checkout, because a per-project install may be missing from the new worktree.
4. After you collect it, read the candidate's `worktreePath` and `branch` with `t3_thread_read` on its child thread, and take what you need from that branch.
5. Confirm `git status --porcelain` in your worktree is unchanged.
   An unchanged status shows no stray edit is left, but not that the candidate never wrote there, so also read the candidate's result for any path outside its own worktree.

T3 owns those worktrees and names their branches.
Never delete one yourself.

Design sketches that only write files need no worktree: give each candidate its own directory under `<home>/tasks/<id>/evidence/`.

### Opening and watching a PR

This section reflects T3's PR tools and its PR instructions, per T3 source at 4f7c529085 (2026-11-27); not yet measured live.
When T3 lists the `pull_request_*` tools, use them, not `gh`, for each PR step a playbook names that they cover:

| A playbook says | On T3 |
| --- | --- |
| `gh pr create` | `pull_request_create`, which pushes your branch, opens the PR and links it to your thread |
| `gh pr view` | `pull_request_read`, whose `headSha` the review and merge tools need |
| `gh pr edit`, `gh pr ready`, `gh pr close` | `pull_request_update` |
| `gh pr comment`, or a reply to or resolve of a review thread | `pull_request_respond` |
| `gh pr merge <pr> --match-head-commit <sha>` | `pull_request_merge` with `expectedHeadSha` set to that SHA, and the brief's method |
| a failed check's log or a rerun | `ci_logs` and `ci_rerun` |

`tstack.mjs pr-state` still gives the verdict, because it reads GitHub's own state.
Use `gh` for anything the tools do not cover, such as `--attach` on images, a reaction, or `gh pr update-branch`.

Right after you create a PR any other way, or push to one you take over, call `link_pull_request` with its `url`, or `link_pull_requests` with every layer of a stack.
A linked PR shows beside your thread, and T3 settles the thread when it merges.

Watch only while the PR waits on something that will happen without you, such as running checks, a review, or the human's approval.

1. Handle the review threads already on the PR, because a watch wakes you only on new ones.
2. Push every fix, then run `tstack.mjs pr-state <pr number>` once, without `--wait`.
3. Act on a verdict that is not `WAITING` as the babysit playbook says.
4. On `WAITING`, when no watch is armed yet or its last result said it is exhausted, call `watch_pull_request` with the PR's `url`, and with `until: "merged"` when you will act on the PR after its checks, such as answering a review or merging under a grant, then end your turn.
   `until` sets how long the thread shows as working, not how long the watch lasts: the default `checks` until checks finish, and `merged` until the PR merges, closes or is unwatched.
   The watch itself stays on either way, so a review that lands after green checks still wakes you.
   On `WAITING review-required` or `WAITING approval`, first tell the human the PR waits on their review or approval.
   Once the watch is armed, run `pr-state` once more before you end your turn, because a review that landed before the watch was armed wakes nothing.
   This also covers a result whose `next` says the checks already pass.
   Act on a verdict that is not `WAITING` now, and on a `WAITING` that only a review, an approval or another event will end, leave the watch armed and end your turn.
   With a watch already armed, skip the call and end your turn.
5. On each wake, start again at step 1.
   A wake is news, not a merge decision.
6. When you stop, or the PR merges, call `unwatch_pull_request`.

The watch lasts across pushes and past green checks, whatever its `until`, so never call `watch_pull_request` again on a wake, unless its result says it is exhausted or you unwatched it.
It wakes you on a failed check, passing required checks, the other checks settling, checks awaiting approval, no checks reported for 15 minutes, a new comment or review from another GitHub account, a conflict, a removal from the merge queue, and once on a merge or close that you did not make from the command line.
It never wakes on the base moving ahead without a conflict, or on review bots going quiet.
After ten wakes in a row for comments only, it stops waking, and its result says it is exhausted, so arm it again only when the PR still waits.
T3 ignores comments from the GitHub account it reads with, and only a top-level thread can watch, so a worker never watches.

`pr-state` holds `WAITING` through a review bot's settle window, and no watch event marks the end of that window.
When the only wait left is one no watch event ends, such as a settle window, `bot-review`, or mergeability GitHub has not computed yet, arm the [heartbeat](#heartbeat) with that wait as its predicate, rather than a loop or a sleep in your turn.
Delete it when `pr-state` moves past that wait.

Because the watch never wakes on a moved base, a `READY` can go stale while the PR waits on the human.
`pr-state` compares the head with the base on every read, so start every wake at step 1, even a wake for a comment you need not answer.
The router's [Finish](../SKILL.md#finish) runs `pr-state` once more before the merge, so a base that moved after the last wake still shows as `BLOCKER base-moved`.
Never arm a timer to poll the base.

An approving `pull_request_review` needs `expectedHeadSha`, the `headSha` from the `pull_request_read` you reviewed, and T3 refuses it when the head has moved.
`pull_request_merge` with `stack: true` merges every open layer below the PR too, so pass it only under a grant that names each of those PRs.

When T3's review guides are on, `write_pull_request_guides` with `{ "pullRequests": [{ "url": "<PR URL>" }] }` starts a run that writes a reviewer's tour of the change into the PR's Guide tab, for up to 20 PRs at once.
Read the result with `read_pull_request_guide`.
It fails when guides are off, which changes nothing else.

### After the merge

Leave your thread for the human to archive.
With `pr` delivery, the PR link settles it when the PR merges.
T3's storage settings remove merged worktrees when the human enables that (`storageCleanup.worktreeOnMerge` in `~/.t3/userdata/settings.json`).
Otherwise the worktree stays for the human.

## Coordinator

Start with Full access, so your leads launch with it and their worktrees run the project action that runs on worktree create.
A supervised coordinator can launch leads too, per T3 source at 4f7c529085 (2026-11-27); not yet measured live, and its leads ask the human for each approval, and with a per-project install it launches them as [Facts to rely on](#facts-to-rely-on) says.
Pin your own thread with `t3_thread_organize` and `{ "action": "pin" }`, so T3 never auto-settles it.

### Talking to a lead

Send with `t3_thread_send`: `{ "threadId": "<lead>", "message": "...", "mode": "queue", "clientRequestId": "<id>-coordinator-<n>" }`.
To see where a quiet lead is, read it with `t3_thread_read` or check its run status in `t3_thread_list`.
Never steer or restart a lead to check on it.

### hold

Call `t3_thread_interrupt` with the lead's `threadId`, then send `hold <id>: <the human's words>` with mode `queue`, which starts the now idle lead at once.
When the interrupt returns `interrupt_requested`, the turn may still be ending, so the hold can arrive as `queued` and start once it ends, per T3 source at 4f7c529085 (2026-11-27); not yet measured live.
When the send is refused because the lead runs with broader modes than yours, tell the human to hold that lead in its own thread.
To release it, send `release <id>:` with mode `queue`.

### After the merge

Archive the lead's thread with `t3_thread_organize`.
The worktree follows the lead's rule above.
Never delete a T3 worktree yourself.

## Heartbeat

When a lead's long run has no event to wake it, a lead records an away grant, or a coordinator runs an autopilot program, call `schedule_task` with `schedule: { "type": "interval", "everyMs": <ms> }`, a `title` that names the task or program, and the prompt below.
Each run posts that prompt into your own thread.
Write the `scheduledTaskId` it returns to `<home>/tasks/<id>/heartbeat.txt`, or to `<home>/autopilot-<name>-heartbeat.txt` for a program.

A lead's prompt, with every `<...>` filled in:

```text
tstack heartbeat for task <id>, until <predicate>.
Run node <path to tstack.mjs> status <id>.
If the human stopped or interrupted you and has not since told you to go on, or status shows the task held or closed, call delete_scheduled_task with the ID in <home>/tasks/<id>/heartbeat.txt, delete that file, and end your turn.
Otherwise collect each finished worker that status lists and you have not read, then check the predicate.
```

A coordinator's prompt names its program and runs `status` with no ID.
It deletes the schedule the same way when the human stopped or interrupted the coordinator and has not since told it to go on, or the program is held or its queue has ended, and otherwise runs the program playbook's check-in.
The prompt carries the delete because a human interrupt ends your turn without giving you another one to delete the schedule, and a schedule outlives a stop and would start the work again.
Delete it the same way when the lead reports done, an away grant you armed it for ends, the program's queue ends, or the human stops you.
When the human releases a hold, keep the recorded heartbeat when `list_scheduled_tasks` still shows its ID. Otherwise arm a new one and write its ID file, because work that waits for a later wake has no other one.
The project holds other scheduled tasks, so never delete one whose ID you did not record.
`run_scheduled_task_now` runs it once, to prove it posts what you expect.

## Proving on the real surface

When the human has browser access on in T3, every session has T3's browser tools, a delegated worker's included.
Device access gives the simulator tools the same way.
Use them to drive a web UI or a simulator only when the current request, your brief, or the project's `verify-*` skill asks for that work.
Rules below follow T3's browser and device instructions, per T3 source at 4f7c529085 (2026-11-27); not yet measured live.
For a web UI, switch to another browser driver, such as one a verify skill names, only when the tools are absent, `preview_open` says the browser is unsupported, the human asks, or two preview calls fail on one step, and quote the error when you switch.
For a simulator, always use the device tools, even when a verify skill or a brief names another driver such as `xcrun simctl`, `idb` or `adb`.
Drive a device another way only when the human explicitly asks.
Those commands stay fine for builds, installs, logs and what `agent-device` cannot do.

- A web UI: call `preview_status` first, and reuse a tab it lists that can be automated.
  Otherwise call `preview_open`, then `preview_navigate` with `{ "target": { "kind": "environment-port", "port": <dev server port> } }`.
  Drive it with `preview_act`, whose `action` is `click`, `type`, `press`, `hover`, `select`, `drag`, `upload` or `scroll`, and `preview_wait_for`, and read it with `preview_snapshot`.
  T3 0.1.9-nightly.20261111 offered these on 2026-11-12, in place of the separate click, type and press tools.
  Prefer the snapshot's locators to coordinates.
  Before you reply, close each tab you opened, unless the human asked for it or uses it.
- A simulator: call `device_list` unless your brief gives the device's `hostId` and `id`, then `device_open` with both, which returns the `agent-device` command for that device.
  Run `open <app>` with that command before any snapshot, screenshot or input, drive the app with it, and look at the screen with `device_screenshot`.
  When a device tool or its command fails, quote the error and follow its advice once, and if it still fails, tell the human and stop.
  Never reuse or close another session's device, and call `device_close` only on the session you opened.
  A lead that delegates device work passes the `hostId` and device `id` and tells the worker to use `device_open`.
- Evidence: `preview_snapshot` with `save: true` returns a screenshot's path, `preview_recording_stop` returns the path of the recording `preview_recording_start` began, and `agent-device screenshot <path>` saves a simulator's screen.
  Copy each file into the task's `evidence/` folder, or the path your brief names, and cite that copy.

## Showing a visual

To show a chart, a comparison or an evidence page in a thread, follow the [t3-visual skill](../../t3-visual/SKILL.md), which owns `html_preview` and `html_render`.

## History

T3 keeps every thread in the project, a delegated worker's included.
Where a skill reads chat history or transcripts, find threads by topic with `t3_thread_search`, list them newest first with `t3_thread_list`, and read one with `t3_thread_read`.
`t3_thread_search` covers one project, the calling thread's or the `projectId` you pass, so search once per project from `t3_project_list` when the work spans projects.
It searches active threads only, skips delegated workers, and is not exhaustive, per T3 source at 4f7c529085 (2026-11-27); not yet measured live.
To find every worker, page through `t3_thread_list` with `includeSubagents: true`, then read each by its ID.
`t3_thread_read` returns the newest items first.
Bound each read with `maxCharsPerItem`, and page back with `beforePosition` set to the earliest position you read, or read from the start with `afterPosition: -1` and go on with the `nextPosition` it returns.
Expand one item with `itemId` and `textOffset` only when it matters.

## Worktrees in use

A worktree is in use while a T3 thread is bound to it, whatever `worktree-audit.sh` says.
`t3_thread_list` does not return a thread's worktree, so page through it with `includeSubagents: true` and read each thread's `worktreePath` from `t3_thread_read`.

## Worker

Never call `delegate_task`, `t3_thread_launch` or `t3_thread_send`.
Your final message is your verdict line, which reaches your lead in its completion wake.
