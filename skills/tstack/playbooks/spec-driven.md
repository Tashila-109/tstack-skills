# Spec driven

Settle the work with the human, write it down, get each document approved, then build it one ticket at a time.
Use [Feature](feature.md) when the shape is already clear; use this playbook when the work needs a grill and the human wants to approve the design, the spec, and the tickets.

Read [dispatch](../references/dispatch.md) before the first worker and [decisions](../references/decisions.md) before the first gate.
The lead runs steps 1 to 4 in one context, because the grill's reasoning is what the design, spec, and tickets are made of, and a worker would get only a summary of it.
From step 6 on, the lead coordinates: a fresh worker per ticket on the `feature` seat, two reviewers per review on the `review` seats, and a worker per end-to-end lane on the `verify` seat.

`<task>` is `tasks/<id>/` under the task home.
`<docs>` is the project's docs directory for this branch, normally `docs/<branch>/`.
Every step leaves a record, so a fresh lead after a handoff finds its place from these files alone.
Never edit `design.md`, `spec.md`, or the ticket index after its gate is granted: a changed subject is a new decision, and the gates after it follow again.

1. **Grill.** Load `grilling` and `domain-modeling` and follow both for the whole grill.
   - `grilling` runs the rounds, asks them through your harness's structured question tool, and owns the round record in `<task>/evidence/grill.md`.
     Its "In a tstack task" section owns telling main that the human is needed in your thread.
   - `domain-modeling` writes `CONTEXT.md` and ADRs the moment a term or a decision settles.
   - Find facts yourself, or with a read-only `how explorer` worker for a large read.
     Put only decisions to the human.
   - When the frontier is empty and the human confirms you share one understanding, commit `CONTEXT.md` and any ADRs as one docs stage.
   - If the human cannot come to your thread, run each round as one `question` decision instead, with the round's numbered questions in it.
     Each round then costs a relay through main, so use this only as the fallback.

   Artifact: `evidence/grill.md`
2. **Design.** Write `<docs>/design.md` yourself, right after the grill.
   Load `codebase-design` for the vocabulary of modules, interfaces, and seams.
   Write the prose with `technical-writing`, then `unslop`.
   Use these sections in order:
   - **Problem.**
   - **Decisions from the grill**, each with the human's answer.
   - **Shape**: the modules, their interfaces, and the seams between them.
   - **Alternatives rejected**, each with the reason.
   - **Failure behavior**: what the user sees and what the system keeps when each part fails.
   - **Testing seams**: each seam, the behavior it observes, and the prior-art test beside it.
     Choose them by the seam rule in `to-spec` step 2.
     This section is the seam agreement that `to-spec` and `tdd` read.
   - **Acceptance criteria**, each one checkable.
   - **Out of scope.**

   Commit `design.md`.
   Review it with `two-axis-review` on a `doc` scope with the label `design`, and act on the findings as that skill says.
   Then open the `design` gate, a `design-approval` decision on `<docs>/design.md` at its commit, and wait for main's answer.
   On a denial, revise from the human's words, commit, and open `design-2`.

   Artifact: `evidence/reviews/design.md`, `decisions/design.md`
3. **Spec.** Load `to-spec` and write `<docs>/spec.md` beside the approved design.
   Commit it, then open the `spec` gate, a `spec-approval` decision on `<docs>/spec.md` at its commit, and wait for main's answer.

   Artifact: `decisions/spec.md`
4. **Tickets.** Load `to-tickets` and write the tickets and their index under `<task>/tickets/`.
   Open the `implement` gate, an `implement-authorization` decision on `<task>/tickets/README.md`, with the ticket count, the frontier, and the three `to-tickets` questions, and wait for main's answer.
   On a denial, revise the tickets and the index, and open `implement-2`.

   Artifact: `tickets/README.md`, `decisions/implement.md`
5. **Phase boundary.** Load `handoff` and decide at this boundary.
   From here the context fills with results and reviews, and the committed docs and tickets carry the grill's reasoning.
   Its tree decides whether to continue or hand off, as `handoff at tickets → implement`.
6. **Implement.** Work the frontier until every ticket but the last is `done`:
   - The frontier is every `ready` ticket whose blockers are all `done`.
     At first it is ticket `00` alone, which runs as step 8 says and is `done` once its lane passes.
   - Write each frontier ticket's brief from the template below at `<task>/briefs/NN-slug.md`, and delegate it on the `feature` seat.
     Run parallel-safe tickets at once.
     Run any other ticket alone, with no other writer in your checkout and no review in progress there.
   - When a worker is done, read its complete diff and result, run the typecheck and the tests, then commit the ticket as one stage, with the ticket number in the subject.
   - Review the ticket under step 7 with the label `NN`.
   - When the review passes, set the ticket's `Status: done <sha>` to the ticket's last commit and recompute the frontier.

   While a review reads your checkout, keep collecting finished workers, but commit nothing until both reports are in.
   Decide a worker's question, a missing seam, or a spec gap under [decisions](../references/decisions.md); a product call becomes a `question` decision.
   Write `<task>/evidence/implement.md` with one line per ticket: its commit, its review label, and each axis's verdict.

   Artifact: `evidence/implement.md`
7. **Review.** Review each ticket, then the whole branch, with `two-axis-review` on a `code` scope.
   - **Per ticket**: label `NN`, base the head before the ticket's first commit, head the ticket's last commit.
     Spec sources are the ticket, `spec.md`, and `design.md`.
   - **Whole branch**: label `final`, after the last implementation ticket is `done`, base the branch's fork point from the default branch, head the branch head.
     Spec sources are `spec.md`, `design.md`, and the ticket index.

   [Two-axis review](../../two-axis-review/SKILL.md#7-act-on-the-findings) owns which findings get a repair, the repair rounds, and when they become a decision.
   Repair through a `feature` worker briefed with the blocking findings, or yourself when the repair is small.

   Artifact: `evidence/reviews/final.md`
8. **End-to-end lanes.** Each lane is a read-only worker on the `verify` seat in your checkout.
   - Its brief names the head SHA, the project's verification skill or recipe, the routes the spec changes, and the commands, and asks for the evidence.
     Look for the verification skill at `.agents/skills/verify-*/SKILL.md` first, then the project's documented recipe.
   - When the project has a feature map, the brief names the map entries the changed routes touch, by feature file and sub-feature ID.
     The lane reports each named sub-feature ID with its result and evidence, a skipped entry point as skipped, and each surface it drove that the map does not list.
   - Never edit the map or invent a map entry in the task.
     For an unmapped surface, or a lane that failed because the map pointed at the wrong one, add a `## Follow-ups` line for [maintain-verification-skill](../../maintain-verification-skill/SKILL.md) that names it.
     A lane that reached and proved its routes still passes on its evidence when the map missed a surface.
   - **Ticket `00`** runs before the first implementation commit, on the default branch, with its result at `<task>/evidence/e2e/baseline.md`.
     It records what the default branch does on each route, or that it lacks the feature.
   - **The last ticket** runs after the whole-branch review passes, on its head, with its result at `<task>/evidence/e2e/final.md`.
     It checks every user-visible outcome in the spec against the baseline.

   A wrong-surface or inconclusive lane is not a pass.
   A failing final lane becomes a fix ticket, numbered after the last ticket and noted in `implement.md`, since the approved index stays unchanged.
   The fix ticket goes through steps 6 and 7, then the whole-branch review and the final lane run again on the new head.

   Artifact: `evidence/e2e/baseline.md`, `evidence/e2e/final.md`
9. **Deliver.** Run [Opening a PR](opening-a-pr.md) for the task's delivery mode, and load `technical-writing`.

   Artifact: `evidence/closing-pass.md`

## Per-ticket brief

Name every skill file by its absolute path, resolved from this playbook's directory.

```text
GOAL        the ticket's "What to build", verbatim
POINTERS    absolute paths to spec.md, design.md, the ticket, CONTEXT.md, and the ADRs it touches; SHAs of the commits for its blockers; pointers only, no copies
SEAMS       the approved testing seams this ticket touches, by name
METHOD      read <tdd skill directory>/SKILL.md and follow its loop: red, then green, one slice at a time at those seams;
            read <codebase-design skill directory>/SKILL.md when an interface's shape is in question;
            typecheck and run single test files often, and the full suite once at the end
SCOPE       the checkout, the files and area the ticket owns, and whether it is parallel-safe;
            name any file outside that scope you had to touch, and why, under REPORT's remaining work
ACCEPTANCE  the ticket's criteria, verbatim
VERIFY      the exact typecheck, single-test, and full-suite commands
FORBIDDEN   Git writes, starting other agents, and work beyond the ticket, including refactors, which belong to review
REPORT      files changed, each command with its outcome, the seams tested, and remaining work
```

**Reply:** what was built, each gate with its decision file, each ticket with its commit, each review's verdict per axis, both end-to-end lanes, the Should and Could findings left unfixed, and the `## Remember` and `## Follow-ups` sections when either has an entry.
