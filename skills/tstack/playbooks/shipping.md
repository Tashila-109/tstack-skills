### Shipping

**You own the verdicts. Verify each PR independently, find the verified run from the root, and hand it to main to land.** This is the half after `playbooks/babysit.md`. The lead verifies; main lands, on the human's word, as [Landing](#landing-main) says.

1. **Verify every PR independently.** Delegate one worker per PR on the `verify` seat, not batched, each exercising the real surface with the project's verification skill against the PR's parent versus its head. Each returns `PASS`, `PASS+NOTES` or `FAIL`, and posts that verdict on its own PR with `gh pr comment`. Safe means a verdict from an agent that did not write the code. CI green is not a verdict, and an approving bot review is not a verdict.
2. **Find the contiguous verified run rooted at the bottom.** Walk up from the lowest unmerged PR and stop at the first one without a passing verdict, where both `PASS` and `PASS+NOTES` pass. A verified PR sitting above an unverified one is not landable. Name the ceiling as a PR number and say what breaks the chain.
3. **Record what each verdict describes.** For each verified PR, record the verdict's head SHA, its base SHA, and the stable `git patch-id` of its base-to-head diff: `git diff <base>...<head> | git patch-id --stable`. A later rebase or base change can invalidate a verdict without touching a check, and main compares against this record before it lands each PR.
   Write `evidence/verdicts.md`: one row per PR, bottom to top, with its number and URL, verdict, verifier, head SHA, base SHA and patch-id, then the ceiling.
   Artifact: `evidence/verdicts.md`
4. **Report the run.** Tell main the verified run, the ceiling, what breaks the chain, and what verifying the next PR would take.

## Landing (main)

Main lands only on the human's explicit word to land these PRs, and only the run in the task's `evidence/verdicts.md`.
Land one PR at a time, bottom first:

- **Re-check the verdict still describes the patch.** Fetch, then compare the PR's current `git diff <base>...<head> | git patch-id --stable` with the recorded one. When they differ, stop: the verdict no longer covers the patch, so brief a new Shipping task for the rest.
- **Prepare only the bottom PR.** If it targets its parent branch and the parent has merged, retarget it with `gh pr edit <pr> --base <default>`. If GitHub says it is behind, bring the default branch in with `gh pr update-branch <pr>`, which merges and never force-pushes, then re-check the patch and wait for its checks.
- **Merge it.** When `gh pr view <pr> --json mergeable,mergeStateStatus,statusCheckRollup` shows it mergeable with every required check passed, run `gh pr merge <pr> --match-head-commit <head>`, where `<head>` is the head you just re-checked, using the project's merge method.
   Wait until `gh pr view <pr> --json state,mergedAt` shows it merged before touching the next PR.
- **Recompute after every merge.** Fetch, confirm the merged commit is on the default branch, drop the PR from the list, and repeat from the first check for the new bottom PR.
- **Stop at the ceiling.** Tell the human what landed, with each PR's full URL, the next unverified PR, and what verifying it would take.

Never arm auto-merge on a PR above the bottom one, and never read GitHub's auto-merge flag as proof that a stack is safe.

**Reply:** the verified run and its ceiling, each PR's verdict and who produced it, and what the next gap needs.
