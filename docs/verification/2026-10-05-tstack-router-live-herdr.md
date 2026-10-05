# First live task on Herdr: tstack-router dashboard-nits

Date: 2026-10-05.
Project: tstack-router at `5ed5dc6`, after the [T3 run](2026-10-05-tstack-router-live-t3.md) and its fixes (`9ef20bc`, `262eab4`).
Task: backlog item `dashboard-nits`, four small web fixes, with PR delivery, run by the human in a Herdr pane.
Method: [Measuring a live task](README.md#measuring-a-live-task).
Labels: **measured** means read from the main, lead and worker session files, the task folder, Herdr's agent list, GitHub or Git.

Main and the lead ran on Claude Opus 5.5 at `medium`, and the fix worker on Pi with `openai/gpt-6.1-sol` at `xhigh`.

## The run (measured)

| Time (+0530) | Event |
| --- | --- |
| 18:22 | Main confirmed `HERDR_ENV`, read `runtime-herdr.md`, and wrote the brief with the bug-fix playbook. |
| 18:23 | Main deleted its own new task folder and reran `brief` to reword it, then created the worktree and started the lead with `herdr agent start --kind claude`. |
| 18:25 | Repro, `how`, `why` and the mechanism were written. |
| 18:26 | The lead split a pane and started the fix worker with `--model openai/gpt-6.1-sol --thinking xhigh` from `tstack.mjs seat`. |
| 18:38 | The worker returned red, green, typecheck, lint, build and a harness for the `drive.sh` change. The lead closed its pane. |
| 18:46 | Five commits, test first. `land-check.sh` and `verify-p7`, `-p8` and `-p9` passed. Steps 3 to 5's artifacts were written together. |
| 18:47 | Comment Sicko returned no findings, with the greps that showed it. |
| 18:48 | PR #15 opened ready. The lead read `babysit.md` and waited for CodeRabbit before reporting. |
| 18:52 | CodeRabbit reviewed `eeeedae` with no actionable comments. The lead wrote `evidence/babysit.md`, passed `check` with 11 files, and reported merge-ready at the full head SHA. |
| 18:54 | Main merged with `gh pr merge 15 --merge --match-head-commit eeeedae…`, closed the lead's tab, removed the worktree and branch, and recorded two learnings and one follow-up. |

Elapsed from brief to merge: 32 minutes.

## Against the method

1. **Gate.** `tstack.mjs check` passed with 11 files, `evidence/babysit.md` among them.
2. **Workers.** Two were delegated: the fix worker and Comment Sicko.
   `results/how.md` and `results/why.md` hold an honest `skip:` line: a 6-line function, and one `git log -S`.
   `evidence/fix.md` skips `architect` with a reason.
3. **Seats.** The fix worker launched with the seat's exact flags, from `tstack.mjs seat bug-fix --runtime herdr`.
   Comment Sicko ran on `inherit`.
4. **Reads.** The lead read the router, the Herdr runtime, the playbook, Opening a PR and `babysit.md`.
5. **Content.** The repro found a wider bug than the backlog named: the M band fails from 999,950,000, not 999,999,950.
   The red test fails at `98f00eb` with `1000.0K` and `1000.0M`.
   `babysit.md` checks that CodeRabbit's coverage marker names the exact head.
6. **Decisions.** None were opened.
   Main merged without asking, under a standing instruction in Claude's project memory for tstack-router: "The PR merges should go ahead once it passes verificaton and the reviews" (2026-10-02).
   It checked that instruction's conditions on the exact head first and quoted it in its reply.

## What held that did not on T3

- The lead babysat before reporting done, and `check` required its evidence.
- Every seat launched on its first try.
- The merge was pinned to the reported head.

## What did not hold

- **The lead waited with a sleep loop.**
  It polled every 30 seconds, capped at 20 minutes, instead of `gh pr checks --watch`.
  `runtime-herdr.md` did not say to run the watch as a background command, which a Claude lead needs in order to wait on it.
- **Steps 3 to 5 wrote their artifacts late again**, all at 18:46:40, after the work.
  That makes two runs out of two.
- **Main reworded a brief by deleting its task folder** and running `brief` again.
  No lead had launched, so nothing was lost, but it steps around the rule that `brief` never reuses a task ID.
- **A standing merge grant lives outside tstack.**
  It sits in one harness's memory, so a main on another harness would not see it, and the router says to ask per merge.

## Fixes

1. `runtime-herdr.md` says to run `gh pr checks --watch` as a background command with no timeout of the lead's own, and never to poll with a sleep loop.
   `babysit.md` defers to the runtime references for the wait, and `runtime-t3.md` now owns T3's wake list.
2. Open: the late artifacts and the standing merge grant need the human's call.
