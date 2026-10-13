# T3 worktree handoff, 2026-10-14

This record checks whether `t3_worktree_handoff` can move a lead's own thread out of the primary checkout, in place of starting a new lead thread with launch-lead.

## Setup

- T3 Code, a Claude thread on `claudeAgent/claude-opus-5-5` with Full access, in the tstack-skills primary checkout on `main` at `29d3612`.
- `t3_worktree_status` before the call: `attached: false`, branch `main`, `defaultStartFromOrigin: true`.

## The call

`t3_worktree_handoff` with `branch: feat/t3-integration`, `baseRef: main`, `startFromOrigin: false`, and a `continuationPrompt` that asked the next turn to check the move and start the work.
It returned the worktree path `~/.t3/worktrees/tstack-skills/feat-t3-integration`, `setupScript: no-script`, and `continuation: scheduled, queued`.

## What happened

| Time (UTC) | Event |
| --- | --- |
| 19:16:05 | The handoff ran as the turn's last call. T3 recorded that run (ordinal 4) as `failed`, because the move detaches the provider session. |
| 19:16:05 | The continuation was queued as run 5, `queued`, with no start time. |
| 19:32:01 | The human sent a message. It started as run 6, ahead of run 5. Run 5 was still `queued`, and `t3_queue_list` still listed it. |
| 19:32 | In run 6, `t3_worktree_status` reported `attached: true` on `feat/t3-integration`, and `git rev-parse --git-dir --git-common-dir` printed two different paths. The agent still had the whole earlier conversation. |
| 19:39 | The agent cancelled run 5 with `t3_queue_cancel`, so it would not start the work a second time. |

## Findings

1. The move works and keeps the conversation.
   The thread is bound to the new worktree, and the agent kept its context.
2. The continuation does not start on its own.
   It waited 16 minutes, until the human's next message, and that message ran first.
   A lead should pass no `continuationPrompt`, tell the human to send a message, and end its turn.
3. T3 shows the moving turn as failed.
   The human should hear that this is expected.

## Changes made

- `skills/tstack/references/runtime-t3.md` gains **Moving your own task**, which uses `t3_worktree_status` and `t3_worktree_handoff` with no `continuationPrompt`, and a fact line on the failed turn and the queued continuation.
- The router's intake step 8 moves the thread on T3 and starts a new lead only on Herdr.
- `docs/runtimes/t3.md` tells the human to send a message after the move.

## Not yet run

- The move from inside a real tstack intake, with a task ID and `task/<id>`.
- A thread without Full access.
- A project with a T3 setup script, which the handoff runs by default.
