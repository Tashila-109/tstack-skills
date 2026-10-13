# pr-state and check-seats on live T3 and GitHub, 2026-10-14

This record checks two commands from PR #5 against live state: `tstack.mjs pr-state` on an open PR, and `tstack.mjs check-seats` on a live T3 catalog.

## pr-state on PR #5

The repository has no CI and no review bot.
The commands ran from the PR's worktree, in a T3 Claude thread with Full access.

| Time (local, +0530) | Command | Output |
| --- | --- | --- |
| 01:34 | `pr-state 5`, 27 seconds after the push | `WAITING settle: the last push, comment or review was 27s ago, and review bots get 10 minutes (head 98915c6dd89c)` |
| 01:34 to 01:42 | `pr-state 5 --wait 540` | Returned after 8 minutes 11 seconds with `WAITING settle: ... 525s ago`. It stopped before a sleep that would have passed its deadline, inside the 600-second tool cap. |
| 01:43 | `pr-state 5 --wait 180` | `READY ci-none: no checks reported; trust it only when a second run on the same head agrees (head 98915c6dd89c)` |
| 01:43 | `pr-state 5` | `READY ci-none`, on the same head. |
| 01:48 | `pr-state 5`, then `gh pr merge 5 --squash --match-head-commit 98915c6…` | `READY ci-none` on the same head, then merged as `0cff00e`. |

Earlier the same day, `pr-state 2` and `pr-state 4` printed `MERGED` for those two merged PRs.

## check-seats on a live catalog

| Time (local, +0530) | Grok in `orchestrator_capabilities` | `check-seats` on `~/.tstack/models.md` |
| --- | --- | --- |
| about 01:00 | `canRunChildTask: false`, constraints "Grok CLI is installed but not logged in. Run `grok login`." and "Provider is not authenticated." | Exit 1. It named all six roles with a Grok seat, each with T3's reason. |
| 01:31 | Unchanged, after the human ran `grok login` in a terminal. | Exit 1, the same six lines. |
| 01:43 | `canRunChildTask: true`, no constraints, five Grok models. | Exit 0: `ok: 8 seats advertised`. |

At 01:44 a `delegate_task` on `grok/grok-4.7` with `reasoningEffort: medium` completed with `OK grok-4.7`, so the catalog's answer matched a real launch.

## Findings

1. `pr-state` holds a PR with no CI and no bot at `WAITING` for ten minutes after the push, then reports `READY ci-none`, as designed.
2. One `--wait 540` call fits a Claude tool call and returns before its deadline.
3. T3's Grok provider took about ten minutes to pick up a terminal `grok login`.
   `check-seats` showed the reason the whole time, where before PR #5 it said only that the instance could not run child tasks.

## Not yet run

- `pr-state` on a PR with running checks, a failing check, an open review thread, or a review bot.
- The T3 watch for a human review, armed after `WAITING review-required`.
