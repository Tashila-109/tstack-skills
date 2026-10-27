### Takeover

**You own finishing someone else's goal, and keeping their credit.** Do not defend an implementation because another person or agent already built it.

This playbook takes over a PR, branch or agent thread that someone else started.
To resume your own earlier task from its task folder, run **Session pickup** instead.
Never change the original PR or its branch, and never merge or close it, without the human's word for that action.

1. Inherit the work.
   Read the source PR, branch or thread, its review findings, and the human's later corrections.
   Resolve the handoff to real code: the current head SHA, its base, and any uncommitted work the source names.
   Record each contributor from `git log --format='%an <%ae>'` and the existing `Co-authored-by:` trailers, using only identities Git or GitHub shows, never a guessed email.
   The handoff is context, not proof.
   Write the source's URL, head, base, goal, open findings and contributors to `evidence/inherited.md`.
   Artifact: `evidence/inherited.md`
2. Check that the goal still belongs on the current base, as steps 2 and 3 of [Modernize](modernize.md) say.
   On REWORK or CLOSE, open a decision and stop until the human answers.
   Artifact: `evidence/drift.md`, `evidence/disposition.md`
3. Import the original commits.
   In your task worktree, start your task branch at the source head, so its commits keep their authors, then merge the fetched base into it as Modernize step 4 says.
   When the human asked to continue in place or to stack on the source, do that instead, and push to the source branch only on their word.
   Write how the branch was built, from which head, to `evidence/update.md`.
   Artifact: `evidence/update.md`
4. Finish the same goal, not a broader one.
   Reproduce the original failure, or the missing behavior, on the real surface first.
   Rework only what the goal needs, and simplify without dropping a behavior or surface the source meant to ship.
   Delegate the change to a worker on the seat of the work's kind, such as `bug-fix` or `feature`, with the **tdd** skill under SKILLS, and keep your fixes in commits of their own above the imported ones.
   Review the worker's diff yourself, then write `evidence/fix.md`: the brief and result paths, and your review of the diff with anything you sent back.
   Artifact: `evidence/fix.md`
5. Verify the original failure and the real workflows as [proof](../references/proof.md) says.
   Mocked tests that pass do not prove the user's experience works.
   List what stays unverified.
   Artifact: `evidence/verify.md`
6. Fetch the source again, because it may have moved while you worked.
   Bring in what improved, or write why you left it out, in `evidence/update.md`.
7. Run **Opening a PR**.
   After `## Why`, add a `## Credit` section that links the original PR and names each contributor from step 1.
   End the description with a `Co-authored-by:` trailer for each contributor, because a squash merge keeps only one author.
   At the router's Finish, when the project squashes, pass the description to `gh pr merge` with `--body`, so the trailers reach the merge commit.
   A model attribution never stands in for a contributor's credit.
   Artifact: `results/comment-sicko.md`, `evidence/closing-pass.md`, `evidence/reviews/final.md`

**Reply:** what you inherited, what you changed and why, how you verified it, how each contributor's credit was kept, and any decision left for the human, such as closing the original PR.
