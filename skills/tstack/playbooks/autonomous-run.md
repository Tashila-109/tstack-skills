### Autonomous run

**You own the exit condition. Define done, then drive to it without stopping.**

1. State the exit condition as a checkable predicate before the first iteration (tests green, repro fixed, all N PRs merged, pixel-diff zero).
   Write the predicate and how you will check it to `evidence/predicate.md`.
   Artifact: `evidence/predicate.md`
2. Pick the wake mechanism from the runtime's wakes: a worker's completion, a report, or watch-pr. An event to watch gets the wake for that event, with a long time-based heartbeat as fallback where the runtime has one. watch-pr covers a PR's checks, reviews and conflicts. A merge or a ref advancing has no wake of its own, so check it at each heartbeat. No event gets a fixed-interval heartbeat sized to when the result is worth re-checking.
3. Each iteration makes the smallest change the evidence justifies, verifies it against the predicate, commits if it advanced, discards changes that didn't help. Belt-and-suspenders that "might help" gets reverted, not left to ride.
   Sequence the work via the **sequence-verifiable-units** principle skill, verifying each unit before the next instead of batching checks at the end.
4. Mid-run discoveries are yours. Address broken skills, related bugs, flaky verifiers, review noise, tooling failures, orphaned follow-ups, and fixable drift yourself via the tstack skill. Put out-of-band fixes in their own PR. Do not park reversible work for the human or open a decision for it. Surface only irreversible actions, genuine product or preference calls no experiment can settle, or a real dead end. Keep the predicate as the main drive, and return to it after each side fix.
5. Checkpoint every iteration via the **show-me-your-work** skill, a row for what changed and whether the predicate moved.
   In a tstack task, the log is `evidence/decisions.tsv`.
   Artifact: `evidence/decisions.tsv`
6. Stop when the predicate is met. A plateau is not a stop, so keep going and pivot your approach to push past it. Surface a genuine dead end rather than spinning, and never relax the predicate to declare victory.

**Reply:** the exit condition, iterations run, what landed, what was discarded, final predicate state.
