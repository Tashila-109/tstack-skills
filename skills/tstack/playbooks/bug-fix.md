### Bug fix

**You own this task. Plan, review, verify.** Delegate investigation and the fix to subagents, stay in the lead.

Be scientific. Every shipped line traces to runtime evidence. Belt-and-suspenders that "might help" is a hypothesis, not a fix. It does not ship. When evidence refutes a hypothesis, revert what it motivated. The smallest change the evidence justifies ships, nothing more.

1. Reproduce it yourself on the matching surface with the project's `verify-*` skill, even when a debug or instrumentation protocol says to ask the user to reproduce. Ask the user only with a stated, specific reason the control surface cannot reach the target, and only after driving it as far as it goes. If it won't reproduce directly, synthesize the trigger, tighten conditions, or instrument until it fires.
   Write the exact repro command or steps and the failing output, verbatim, to `evidence/repro.md`.
   Artifact: `evidence/repro.md`
2. Binary-search the cause. Form the candidate hypotheses, then rule them out until one survives. Seed them with `how` over the affected subsystem and the **why** skill for regression history. Each pass, take the split that cuts the most remaining problem space, get runtime evidence, eliminate. When program state is unclear, add instrumentation or logging and read it as the code runs. Don't guess. Drive a long or stubborn hunt as an [Autonomous run](autonomous-run.md) loop. Confirm the surviving *mechanism* with runtime evidence before the step-3 architect/interrogate fan-out.
   Write `evidence/mechanism.md`: a How section and a Why section with what each found, the hypotheses in the order you ruled them out, and the surviving mechanism with its runtime evidence.
   Artifact: `results/how.md`, `results/why.md`, `evidence/mechanism.md`
3. Plan the fix. If it crosses a function boundary, `architect` first. Delegate implementation to a worker on the `bug-fix` seat with a specific scope.
   The worker's brief lists the **tdd** skill under SKILLS and points at `evidence/mechanism.md`.
   Review the worker's diff yourself, then write `evidence/fix.md`: the brief and result paths, and your review of the diff with anything you sent back.
   Artifact: `evidence/fix.md`
4. Verify on the same surface. The original repro now passes. Unit tests show branch behavior, not bug absence.
   Rerun the step 1 repro and write the proof as [proof](../references/proof.md) says, with the repro's passing output as the first claim's evidence.
   Artifact: `evidence/verify.md`
5. Stage the commits so the failing repro lands before the fix in git history. See the **tdd** skill for the failing-test-first cadence when the bug has a cheap local test path. Skip it when the test would be expensive, integration-heavy, or unclear.
   This is the canonical **sequence-verifiable-units** principle skill, the failing test first and the fix on top.
   Copy the red-then-green output from the worker's result into `evidence/red-green.md`, or write why no cheap test path existed and which check stood in for it.
   Artifact: `evidence/red-green.md`
6. Run **Opening a PR**.
   Artifact: `results/comment-sicko.md`, `evidence/closing-pass.md`, `evidence/reviews/final.md`

**Reply:** what was broken, root cause, fix, how you verified. Paste failing-then-passing repro output verbatim.
