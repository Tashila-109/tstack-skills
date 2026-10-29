### Modernize

**You own the PR's idea, not just its branch.** A clean merge of the base does not prove the PR still belongs in the product.

The human's request to modernize a PR authorizes updating that PR's branch.
It does not authorize merging, closing, changing the base branch, or widening the PR's scope.
Never force-push.
Bring the base in by merge, so every push fast-forwards the PR's branch.

1. Establish the PR's intent.
   Fetch the PR's base and head, then record the PR's URL, state, base branch, head repository and branch, head SHA, author, checks and review state, and the merge base of its head with the fetched base.
   Read the title, body, linked issues, commits, review threads and the whole diff.
   Write the smallest coherent goal the PR was trying to reach before you judge how it reaches it.
   Write all of this to `evidence/intent.md`.
   Artifact: `evidence/intent.md`
2. Check what changed around it.
   Read the commits and diffs that landed on the base since the merge base, and search merged and open PRs whose titles, paths or behavior suggest a replacement or a competing change.
   Look past overlapping lines.
   Ask whether the same problem is already solved, whether the APIs, types, schemas, dependencies or boundaries it relies on changed, whether both sides now own the same behavior, whether the code it changes was deleted, moved or simplified on purpose, whether landing it would bring back an old behavior or a second way to do one thing, and whether its benefit still pays for its upkeep.
   A PR is not current because Git reports no conflicts.
   Write what you found, with the commits and PRs it rests on, to `evidence/drift.md`.
   Artifact: `evidence/drift.md`
3. Choose a disposition before you push anything.
   **MODERNIZE** when the goal is still useful and the implementation is still the right shape.
   **REWORK** when the goal is still useful but a mechanical update would keep the wrong implementation.
   **CLOSE** when the PR is superseded, obsolete, wrong in direction, or no longer worth its cost.
   Age alone is not evidence, and sunk effort is no reason to keep a PR alive.
   Write the disposition, its reason and its evidence to `evidence/disposition.md`.
   For REWORK, write the smallest credible rewrite there too.
   On REWORK or CLOSE, open a decision as [decisions](../references/decisions.md) says and stop until the human answers, because rewriting or closing someone's PR is their call.
   On an approved CLOSE, post the reason as a PR comment from a file, as babysit step 8 says, then run `gh pr close <pr>`, and mark steps 4 to 7 `skip: closed on the human's word`.
   Write the same skip line to `evidence/babysit.md`, and at Finish report the close instead of asking to merge, because nothing is left to merge.
   Artifact: `evidence/disposition.md`
4. Bring the base in.
   Fetch the PR head with `git fetch origin pull/<pr>/head`, which also works for a fork.
   Your task branch has no commits of its own yet, so move it to that head with `git reset --hard FETCH_HEAD`, then merge the fetched base into it.
   Resolve each conflict by the PR's intent and the base's newer invariants.
   When a conflict shows a product or architecture disagreement, stop and return to step 3 instead of guessing.
   Compare the PR's patch before and after, `git diff <old merge base>...<old head>` against `git diff <base>...HEAD`, and confirm no intended behavior disappeared and no behavior the base already has came back.
   Run the project's checks for the touched area, and tell real failures from ones that already fail on the base.
   Write the before-and-after comparison and the check results to `evidence/update.md`.
   Artifact: `evidence/update.md`
5. On an approved REWORK, rewrite it.
   Delegate the rewrite to a worker as [Takeover](takeover.md) step 4 says, with the **tdd** skill under SKILLS, and review its diff yourself.
   Write `evidence/rework.md`: the brief and result paths, and your review of the diff with anything you sent back.
   Without a REWORK, write `skip: <disposition>` there instead.
   Artifact: `evidence/rework.md`
6. Prove the PR still does what its intent says, on the real surface, as [proof](../references/proof.md) says.
   Artifact: `evidence/verify.md`
7. Run **Opening a PR**, pushing to the PR's own branch instead of opening a new PR.
   Push to the head repository from step 1, which is `origin` only when the PR is not from a fork.
   The branch name comes from whoever opened the PR, so check it with `git check-ref-format --branch '<PR branch>'` first, and pass the URL and branch as separate single-quoted arguments: `git push '<head repository URL>' 'HEAD:<PR branch>'`.
   Refuse a name that holds a quote, and tell the human.
   Leave the PR's title and description as they are unless the human says otherwise, and summarize the update in one PR comment, written as babysit step 8 says.
   When the push is refused because the branch moved, fetch and return to step 2 rather than overwrite new work.
   When you cannot push to that branch, such as a fork that refuses maintainer edits, stop and offer the human the **Takeover** playbook.
   Artifact: `results/comment-sicko.md`, `evidence/closing-pass.md`, `evidence/reviews/final.md`

Merging happens only at the router's Finish.

**Reply:** lead with MODERNIZE, REWORK or CLOSE and the reason, then what changed on the base that matters to this PR, any conflict in intent or that none was found, the update and push, the checks and their results, and what is left for the human. Keep what you observed apart from what you judged, and say what you could not verify.
