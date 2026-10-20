### Shipping

**You own the verdicts. Verify each PR independently, find the verified run from the root, and land it on the human's word.** This is the half after `playbooks/babysit.md`. The lead verifies, then lands as [Landing](#landing) says. Under an autopilot, the coordinator lands instead, auditing the verdicts the lead's `verify` workers wrote rather than delegating its own.

1. **Verify every PR independently.** Delegate one worker per PR on the `verify` seat, not batched, each exercising the real surface with the project's verification skill against the PR's parent versus its head. Each writes its proof in its result as [proof](../references/proof.md) says, returns `PASS`, `PASS+NOTES` or `FAIL`, and posts that verdict on its own PR with `gh pr comment`. Safe means a verdict from an agent that did not write the code. CI green is not a verdict, and an approving bot review is not a verdict.
2. **Find the contiguous verified run rooted at the bottom.** Walk up from the lowest unmerged PR and stop at the first one without a passing verdict, where both `PASS` and `PASS+NOTES` pass. A verified PR sitting above an unverified one is not landable. Name the ceiling as a PR number and say what breaks the chain.
3. **Record what each verdict describes.** For each verified PR, record the verdict's head SHA, its base SHA, and the stable `git patch-id` of its base-to-head diff: `git diff <base>...<head> | git patch-id --stable`. A later rebase or base change can invalidate a verdict without touching a check, and Landing compares against this record before each PR lands.
   Write `evidence/verdicts.md`: one row per PR, bottom to top, with its number and URL, verdict, verifier, head SHA, base SHA and patch-id, then the ceiling.
   Artifact: `evidence/verdicts.md`
4. **Report the run.** Tell the human the verified run, the ceiling, what breaks the chain, and what verifying the next PR would take, and ask whether to land the run.

## Landing

Land only on the human's explicit word to land these PRs, or under an autopilot grant that covers them, and only the run in the task's `evidence/verdicts.md`.
Land one PR at a time, bottom first:

- **Move a child onto the default branch once its parent merges.** If the bottom PR targets its parent branch and the parent has merged, retarget it with `gh pr edit <pr> --base <default>`, then bring the merge result in with `gh pr update-branch <pr>`, which merges and never force-pushes, so the PR holds only its own patch.
  Apart from this move and the update the merge-result test below calls for, nobody changes a branch or base while the run lands, because a merge lands whatever its branch and base hold at that moment, verdict or not.
- **Re-check the verdict still describes the patch.** Fetch, then compare the PR's current `git diff <base>...<head> | git patch-id --stable` with the recorded one. When they differ, stop: the verdict no longer covers the patch, so brief a new Shipping task for the rest.
- **Test the merge result, not every move of the default branch.** Fetch, and ask whether the default branch's changes since the PR's base can affect the patch, because updating for every move never ends.
  Bring the default branch in with `gh pr update-branch <pr>`, re-check the patch and wait for its checks when the code that would land was never tested together: a conflict, a file both sides changed, or a change to which checks run for the PR.
  A lockfile both sides changed needs no update when a frozen install passes on a local merge of the two, because that install tests the lockfile that would land.
  When the default branch changed code the patch calls or a dependency it uses, run the patch's checks on a local merge of the two, and merge on a pass.
  Otherwise merge without updating, unless GitHub reports the PR behind a branch that must be up to date.
- **Merge it.** When `gh pr view <pr> --json mergeable,mergeStateStatus,statusCheckRollup` shows it mergeable with every required check passed, run `gh pr merge <pr> --match-head-commit <head>`, where `<head>` is the head you just re-checked, using the project's merge method.
   Wait until `gh pr view <pr> --json state,mergedAt,baseRefName` shows it merged into the default branch before touching the next PR, because a merge command can report success when a merge queue only queued the PR, and a PR whose base is still its parent's branch merges into that branch.
- **Recompute after every merge.** Fetch, confirm the merged commit is on the default branch, drop the PR from the list, and repeat from the first check for the new bottom PR.
- **Stop at the ceiling.** Tell the human what landed, with each PR's full URL, the next unverified PR, and what verifying it would take.

Never arm auto-merge on a PR above the bottom one, or on a bottom PR whose verdict does not cover its current head, because auto-merge lands whatever head is ready.
Never read GitHub's auto-merge flag as proof that a stack is safe.

**Reply:** the verified run and its ceiling, each PR's verdict and who produced it, and what the next gap needs.
