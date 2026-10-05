# First live task on T3: tstack-router setup-check-timeout

Date: 2026-10-05.
Project: tstack-router, the day it moved off tstackv2 (`f8266ba`).
Task: backlog item `setup-check-timeout`, with PR delivery, run by the human in T3 Code.
Method: [Measuring a live task](README.md#measuring-a-live-task).
Labels: **measured** means read from the lead's and main's session transcripts, the task folder, GitHub or Git.

Main and the lead ran on Claude Opus 5.5.
The project's `.tstack/models.md` moved every Grok worker seat to Pi on `gpt-6.1-sol` at `xhigh`, on the human's word from tstackv2's matrix.

## The run (measured)

| Time (+0530) | Event |
| --- | --- |
| 17:25 | Main wrote the brief with the bug-fix playbook, marked the backlog line running, and launched the lead in a T3 worktree. |
| 17:29 | Repro, `how`, `why` and the mechanism were written. |
| 17:30 | The fix worker's brief was written and the worker launched on the second try (see Seats). |
| 17:41 | The worker returned a red run before the fix and a green run after it. |
| 17:43 to 17:45 | The lead committed the red tests (`a9ddeb3`), then the fix, reran the original repro and ran `scripts/land-check.sh` (exit 0). |
| 17:46 | The Comment Sicko worker returned. |
| 17:48 | The lead opened PR #14 ready, armed `watch_pull_request`, and reported done to main. |
| 17:51 | CodeRabbit finished: "Review completed", no actionable comments. The lead confirmed the review covered `f8266ba..b427dfd` and reported merge-ready. |
| 17:53 | On "Yes lets merge it", main ran `gh pr merge 14 --merge --match-head-commit b427dfd…`, pulled `main`, archived the lead's thread and moved the backlog line to done. |

Elapsed from brief to merge: 28 minutes.

## Against the method

1. **Gate.** `tstack.mjs check` passed at the report with 10 files.
   It now refuses for the missing `evidence/babysit.md`, a rule added during this run (Fixes, 1).
2. **Workers.** Two were delegated: the fix worker (`results/fix.md`) and Comment Sicko (`results/comment-sicko.md`).
   `results/how.md` and `results/why.md` hold an honest `skip:` line with a reason: two functions the lead read in full, and one `git log -S`.
   The lead also skipped `architect` in `evidence/fix.md`, for a design of one variable and one helper.
3. **Seats.** The fix worker's first `delegate_task` failed with `model_unavailable`, because T3's Pi provider lists the model as `openai/gpt-6.1-sol`.
   The lead relaunched it under that ID with the same harness and effort, then told main.
   That followed the human's choice, but `dispatch.md` says a single seat that cannot launch stops, and the lead must not hand-assemble a model ID.
   Comment Sicko ran on `inherit`, as configured.
4. **Reads.** The lead read the router, the T3 runtime, `dispatch.md`, the worker preamble, the bug-fix playbook and Opening a PR.
   It read no principle `SKILL.md`, and its report says so and cites none.
   It never opened `babysit.md`.
5. **Content.** Every artifact carries runtime evidence.
   The mechanism rules out two hypotheses with the repro's output, and the CLI is killed at `1m0s`.
   `verify.md` reruns the same 65 s repro on the fix commit: `err=<nil>` and `deleted=0`.
   `closing-pass.md` records each Comment Sicko verdict.
   It dismisses a MUST KILL on the bound test, with the reason that the human's finish condition requires that test.
6. **Decisions.** None were opened, and none were needed.
   The one call for the human, the merge, went through main.

## What did not hold

- **The lead reported done before the PR was merge-ready.**
  Opening a PR still carried the upstream line "Opening a PR does not start a babysit", and an older tstack line saying the lead does not babysit.
  Those contradicted the new `pr` delivery line, and the lead followed them.
  It still behaved well once `watch_pull_request` woke it: it caught CodeRabbit's "processing" placeholder, waited for the real review, and confirmed the review's commit range.
- **The models file named a Pi model that T3 does not advertise.**
  The file was written by hand, which skipped `tstack-setup`'s check against `orchestrator_capabilities`.
- **Steps 3 to 5 wrote their artifacts late.**
  The lead wrote `fix.md`, `verify.md` and `red-green.md` after step 6 had started.
  The router says each step's artifact comes before the next step, and `check` cannot see the order.
- **The lead edited a test itself.**
  It raised a timeout budget from 3 s to 5 s for this Mac's load.
  The router allows lead code only as a review repair that a later review covers.

## Fixes

1. `9ef20bc`: Opening a PR now defers to the `pr` delivery line, which says the lead babysits to merge-ready before it reports done.
   `check` requires `evidence/babysit.md` for a `pr` task.
2. tstack-router's `.tstack/models.md` now names `pi/openai/gpt-6.1-sol@xhigh`, which resolves on T3 and on Herdr, since Pi's `--model` accepts `provider/id`.
3. No change for the late artifacts or the test edit.
   Watch them on the next runs before adding a rule.
