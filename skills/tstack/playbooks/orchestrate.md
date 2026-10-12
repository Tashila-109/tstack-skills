# Orchestrate

Own the program: scope, briefs, dependency order, review and evidence. Use this for work that spans several phases, and that is authorized to be built, not only planned. A task one worker can finish in the current session uses Feature or Autonomous run instead. For a plan with no build, use [Multi-phase plan](multi-phase-plan.md). Ceremony must earn its cost.

Read [dispatch](../references/dispatch.md) and [decisions](../references/decisions.md) before the first worker.
The lead delegates workers, commits stages, and merges on the human's word.
The human answers decisions.
Workers implement or verify their assigned scope and return evidence.

Open a todo list for the steps below. Keep skipped steps with a reason.

1. **Frame.** State the checkable finish predicate, scope, deadline and constraints. Identify independent work and shared writes. For a contested approach, use [arena](../../arena/SKILL.md). Record genuine product questions; a deadline does not approve them. Settle the three planning questions [Multi-phase plan](multi-phase-plan.md) step 1 names.
   Write them to `evidence/frame.md`.
   Artifact: `evidence/frame.md`
2. **Design.** Delegate one worker on the `judgment and prose` seat to write `design.md` under the project's docs directory for this branch, usually `docs/<branch>/`.
   Keep only `design.md` and `spec.md` there for this workflow.
   It covers the problem, alternatives, choice, boundaries and acceptance criteria.
   No implementation yet.
   Review it as [Multi-phase plan](multi-phase-plan.md) step 2 says, then commit it or record its hash.
3. **Design gate.** Open the `design` gate, a `design-approval` decision on `design.md` at its commit or hash, and wait for the human's answer.
   Reversible preparation cannot bypass this gate.
   Artifact: `decisions/design.md`
4. **Spec.** Delegate a worker to read the approved design and write `spec.md` beside it. Keep ordered phases, owned paths, dependencies, data contracts and verification in this one file. Use the skeleton and the checker from [Multi-phase plan](multi-phase-plan.md), and save the checker's clean output to `evidence/check-plan.md`. No tickets, per-phase document tree or separate orchestration database.
   Review it as [Multi-phase plan](multi-phase-plan.md) step 3 says, then commit it or record its hash.
   Artifact: `evidence/check-plan.md`
5. **Spec and implement gates.** Read the spec, open the `spec` gate, a `spec-approval` decision on `spec.md` at its commit or hash, and wait for the human's answer.
   Then open the `implement` gate, an `implement-authorization` decision on the granted spec, and wait for its answer before any pilot or implementation.
   Artifact: `decisions/spec.md`, `decisions/implement.md`
6. **Pilot.** Run the first representative phase through implementation, review and its real verification. Fix a bad brief or verification recipe before increasing concurrency. A cheap repeated unit needs a cheap pilot, not a second ceremony.
   Write what the pilot proved, and what you changed in the briefs or the recipe because of it, to `evidence/pilot.md`.
   Artifact: `evidence/pilot.md`
7. **Implement.** Delegate scoped work on the `feature`, `bug-fix` or `refactoring` seat as each phase needs. Run independent phases at once, one writer per checkout, and give a parallel writer its own checkout as the runtime reference says. Give coupled code one owner. Relay dependency results before starting dependents. Workers never publish.
   Converge on the target shape per [principle-outcome-oriented-execution](../../principle-outcome-oriented-execution/SKILL.md), and write no throwaway compatibility code between phases.
   Write `evidence/dispatch.md`: each worker's brief and result paths, the phase it owns, and your review of its diff.
   Artifact: `evidence/dispatch.md`
8. **Review and verify each phase.** Read each complete diff and result.
   Use `two-axis-review` where judgment or risk warrants it, labelled with the phase ID.
   Run the project's verification recipe against the combined artifact.
   Record commands, outcomes, the identity of the checked code and evidence paths in the spec's boxes.
   A worker's assertion or green CI alone is not proof of the requested behavior.
   Add one line per verified phase to `evidence/phases.md`: the phase ID, the verified head, the review aggregate and its verdict, and the verify evidence path.
   Repeat steps 7 and 8 for each phase, including the pilot.
   Commit each verified phase, then run `tstack.mjs check <id> --through 8` before the next phase starts.
   Artifact: `evidence/phases.md`
9. **Close.** Collect every finished worker.
   Check the original finish predicate; only verified work counts.
   Review the complete integrated branch with `two-axis-review` labelled `final`, then run [Opening a PR](opening-a-pr.md) for the task's delivery mode, loading `technical-writing`.
   Artifact: `evidence/reviews/final.md`, `results/comment-sicko.md`, `evidence/closing-pass.md`

## Brief

Every worker receives the goal, exclusive scope, input paths and reports, acceptance criteria, exact verification commands, constraints and report shape. Missing inputs are a reason to wait or narrow the task, not to guess. Size the brief to the task.

```text
GOAL        observable outcome
SCOPE       owned checkout and paths; paths excluded
CONTEXT     approved documents, upstream findings and required evidence
ACCEPTANCE  checkable criteria
VERIFY      exact discovered commands and runtime route
TIMEBOX     stop and return partial evidence at the agreed limit
FORBIDDEN   Git writes, starting other agents, unrelated edits, decision bypass
REPORT      status, files, checks and outcomes, evidence, remaining work
```

## Progress, failure and escalation

Keep the program's state in the task folder: the spec's boxes, `evidence/`, `results/` and `decisions/`.
When a decision trail helps, keep `evidence/decisions.tsv` with [show-me-your-work](../../show-me-your-work/SKILL.md).
Do not create a parallel queue service.
Collect finished results before advancing dependents.

On context pressure, use [handoff](../../handoff/SKILL.md) at the next phase boundary.
A worker that went quiet is replaced by a fresh worker with consolidated scope, as dispatch says, never by guessing at its state.
Stop on broken infrastructure and report the exact blocker with preserved partial evidence.

Escalate unresolved product choices, missing authorization, destructive operations and a failed plan under [decisions](../references/decisions.md).
Keep the decision gates intact even under deadline pressure.
A change to the granted design or spec runs as [Multi-phase plan](multi-phase-plan.md#amend-a-granted-plan) says, in this task.

**Reply:** the finish predicate, completed phases, verified evidence, abandoned scope and open decisions. Include PR links only when publication actually happened.
