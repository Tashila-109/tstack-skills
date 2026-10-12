# Multi-phase plan

The plan is the deliverable. Do not implement. A small change with an obvious approach can use Feature directly; explain that choice rather than manufacturing phases. To plan and then build, use [Orchestrate](orchestrate.md), which runs these same steps and continues into implementation.

Read [dispatch](../references/dispatch.md) and [decisions](../references/decisions.md).
Use the principles index in the `tstack` skill and read each applicable leaf.
Design and spec documents live in the project's docs directory for this branch, normally `docs/<branch>/`: keep only `design.md` and `spec.md` there for this workflow.
When the frame keeps planning documents out of Git, they live in the task folder instead, and every gate cites them by SHA-256.
Run state and evidence stay under `tasks/<id>/` in the task home, with a decision trail at `tasks/<id>/evidence/decisions.tsv` when one helps.

1. **Frame and explore.** State the outcome, scope boundaries, constraints and definition of done. Resolve empirical questions with scoped probes through [Prototype](prototype.md). Preserve the actual commands, code identity and artifacts, including inconclusive results. A read-only request does not authorize a prototype that changes the project or a live system.
   Inspect the affected code, conventions, dependencies and verification routes, with read-only workers on the `how explorer` seat for large reads. Workers return file pointers and findings.
   Settle three questions before any design, because each one reshapes the design when it arrives late: whether planning documents are committed or stay in the task folder, which platforms the work targets, and how code from reference projects may be reused, whether copied with its notice, adapted, or taken as ideas only.
   Take each answer from the human's request, and ask through decide when it is silent.
   Write the outcome, scope, constraints, the three answers, probe results and the verification routes you found to `evidence/frame.md`.
   Artifact: `evidence/frame.md`
2. **Design, then gate.** Delegate one worker on the `judgment and prose` seat to write `design.md`.
   It covers the problem, included and excluded scope, constraints, alternatives, the chosen approach, data boundaries, failure cases and observable acceptance criteria.
   Use [arena](../../arena/SKILL.md) for competing designs when evidence is needed.
   Read the finished document yourself, then review it with **two-axis-review** in `doc` scope, labelled `design`.
   Commit it, or record its `shasum -a 256` when it stays out of Git, then open the `design` gate, a `design-approval` decision on `design.md` at that commit or hash, and wait for the human's answer.
   Do not write `spec.md` while the design decision is unanswered.
   Artifact: `evidence/reviews/design.md`, `decisions/design.md`
3. **Spec, then gate.** Delegate the spec to a worker who reads the approved design and writes `spec.md` beside it, using the skeleton below. Keep the headings and sub-blocks in order. Repeat the phase section for each independently verifiable change. Name dependencies, key types, owned paths, acceptance criteria and exact verification commands. Order dependencies before consumers. A phase is not a file-count quota or a mandatory PR.
   Each box names the evidence that will check it. Keep boxes unchecked until that evidence exists. Write the body as a how-to using [Technical writing](../../technical-writing/SKILL.md), then [Unslop](../../unslop/SKILL.md). Appendices hold rationale, alternatives and risks. Replace every placeholder.
   Tests alone are not sufficient verification. A phase is verified only when its unit, live, and perf boxes are all checked. The live lanes exercise the affected surface using the project's actual verification skill or driver: look for `.agents/skills/verify-*/SKILL.md` and existing commands. Missing tools or credentials are blockers, not assumed proof. Use configured seats from the models file, not a hardcoded model or lane count.
   Include a regression lane against trunk and the exact candidate. When trunk lacks the feature, record that fact and check the added behavior plus the end state the user waits for. Performance verification names a metric both versions produce, an interleaved probe, the trunk baseline measured first and a numeric failure threshold. When the scenarios differ, use absolute budgets for the added work and user-visible end state rather than a ratio between unlike scenarios. Interaction changes need operator review with screenshots before delivery, and a video when the change is motion or timing. A phase without an interaction may say its additional review gate is None. That never waives the design and spec gates.
   Run `node <tstack skill directory>/scripts/check-plan.mjs docs/<branch>/spec.md`, fix every diagnostic, and save its final clean output to `evidence/check-plan.md`.
   That output names the spec's SHA-256, and `tstack.mjs check` refuses it once the spec has changed, so run the checker again after every edit.
   The checker is structural: it cannot verify that the evidence is true, approve anything, or authorize execution.
   Read the finished spec, review it with **two-axis-review** in `doc` scope, labelled `spec`, and run the checker again on the reviewed spec.
   Commit it or record its hash, open the `spec` gate, a `spec-approval` decision on `spec.md` at that commit or hash, and wait for the human's answer.
   A deadline, a tool call or a passing checker never answers a decision.
   Artifact: `evidence/reviews/spec.md`, `evidence/check-plan.md`, `decisions/spec.md`
4. **Hand back.** Return both document paths, the phase order and ownership, the prototype findings, open questions, the verification requirements and the checker output in `report.md`.
   The lead commits the documents; workers return uncommitted files and evidence.

## Amend a granted plan

Run this in the planning task's own thread when the human changes a design or spec after its gate, or when a build finds the plan wrong.
- Write `evidence/amendment-<n>.md`: the human's words or the builder's finding, the sections it changes, and which phases are already built.
  A built phase stays as it was accepted.
  A correction to built code becomes a named repair in a later phase, with its real path and its test.
- When a lead is building from this plan, notify it to hold any commit that depends on the change, as [dispatch](../references/dispatch.md) says.
- Probe any claim the change makes about a mechanism, such as a constraint, an API or a platform's behavior, before a reviewer has to.
  Save the probe and its result table under `evidence/probes/`.
- Delegate the edit, scoped to the changed sections, then review it with **two-axis-review**, labelled `amend-<n>`.
  Run the checker again when the spec changed.
- Open the next gate for each changed document, as [decisions](../references/decisions.md) names it, such as `design-2` or `spec-3`.
- After the grant, notify the building lead once, with the granted decision paths, each document's commit or hash, and what changes in each phase.

## Spec skeleton

```markdown
# <Program> spec

<Under ten lines describing what changes, for whom, and the phases in order.>

## How to read this

One box is one unit of work. Every box names the evidence that checks it. Check a box only when its evidence exists. The body is a how-to. The appendices explain and record.

Execution follows the orchestrate playbook in playbooks/ of the tstack skill, in its own task.
<Name who owns each phase and the authorized delivery boundary.>

Tests alone are not sufficient verification. A phase is verified only when its unit, live, and perf boxes are all checked.

## Program checklist

### Arm the program

- [ ] Read `design.md` and `spec.md`. Confirm their granted decision records and the execution authorization before implementation. Save the approval evidence path.
- [ ] Read dispatch.md and the applicable leaf skills. Record their paths with the task brief.
- [ ] On an operator hold, stop new dispatch and preserve current evidence.
The lead pauses dispatch and takes the human's steer.

### Spawn owners

- [ ] <Assign configured seats, exclusive paths, dependencies and acceptance checks. Record each worker's name.> Workers have no Git writes.
- [ ] <Name independent phases and the evidence each dependent phase consumes.>

### Delivery boundaries

- [ ] <State whether delivery is local-only or a pull request. Record the result without inventing a PR.>
The lead commits stages and merges on the human's word.

### Verdict and delivery

- [ ] Review the exact candidate and its unit, live, perf and audit evidence. Run two or more audit lanes, each with its own focus, that read the diff and the evidence and distrust the PR body or report. A defect a lane files as a note is still a finding. Each behavior finding gets a red test covering every site with the same defect, or a repro receipt where no test can show it. Record the verdict and code identity. Recheck changed code before acceptance.

### Boot recipe

- [ ] <Name the real verification skill, commands, owned environment, prerequisites and readiness check. Record each lane's code identity and evidence directory.>

## <Task as a verb phrase> (<phase id>)

**Depends on.** <Phase id and input artifact, or None.>

**Files.**

- [ ] <Name each owned path and edit, creation or deletion. Record the diff.>

**Build.**

- [ ] <Name the change, symbol and data contract. Record its artifact.>

**You see.**

- [ ] <Name an observable result and its evidence.>

**Verify, unit.** Tests alone are not sufficient verification. A phase is verified only when its unit, live, and perf boxes are all checked.

- [ ] <Name the test case, exact command, expected result and output path.>

**Verify, live.** Tests alone are not sufficient verification. A phase is verified only when its unit, live, and perf boxes are all checked. Configured seats from the models file.

- [ ] Lane 1. Regression lane against trunk. Run <scenario> on trunk and the candidate. If trunk lacks the feature, record that fact and check <added behavior and end state>. Save `<evidence path>`. Pass when <predicate>.
- [ ] Lane 2. <Scenario using the boot recipe>. Save `<evidence path>`. Pass when <predicate>.

**Verify, perf.** Tests alone are not sufficient verification. A phase is verified only when its unit, live, and perf boxes are all checked.

- [ ] Metric. <Name the metric produced on both versions and its unit.>
- [ ] Probe. <Name the interleaved command or procedure and output path.>
- [ ] Baseline. <Record the measured trunk value first.>
- [ ] Rule. <Name the numeric failure threshold or absolute budgets for unlike scenarios.>

**Review gate.** The operator reviews interaction changes before delivery.

- [ ] <Save screenshots, and a video when the change is motion or timing, post their paths to the operator and record the decision. For no interaction change, replace this gate with None plus the reason and remove this box.>

**Delivery.**

- [ ] Return the verified artifact and evidence.
With pull-request delivery, the lead pushes, opens the PR, and merges on the human's word.
A local-only program neither pushes nor opens a PR.

## Close the program

- [ ] Confirm every required box has real evidence, preserve blockers and return the report.
The lead reports done after every worker has returned a result or a failure, then cleans up as the router's Finish says.

## Appendix A. Prototype evidence

<Questions probed, exact code identity, commands, artifacts and unproven claims.>

## Appendix B. Alternatives rejected

<Alternatives and reasons, or an explicit explanation that the constraints dictated the approach.>

## Appendix C. Risks

<Risks, owning phases and unavailable verification prerequisites.>

## Appendix D. Links and reading list

<Applicable docs and leaf skills, plus the canonical decision-trail path.>
```
