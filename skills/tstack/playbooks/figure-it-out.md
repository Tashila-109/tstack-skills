### Figure it out

**You own the workflow, then the run.** For a large or cross-cutting effort, work the human reviews after stepping away, or a request no other playbook fits. The [figure-it-out skill](../../figure-it-out/SKILL.md) owns the method. This playbook makes each phase leave a file.

1. Run the skill's Phase A and Phase B. Frame the done predicate, the quantified scope and the rigor level, then design the phase list.
   Write the framing and the phase list to `evidence/workflow.md`.
   When the task builds an approved multi-phase spec, the spec is a required input. Before any code, confirm `design.md` and `spec.md` still match the Subject of their latest granted decisions in the planning task, and stop for a new decision on a mismatch. Map each spec phase to one phase in the list, with its unit, live and perf boxes and the evidence each will cite.
   Artifact: `evidence/workflow.md`
2. A run of more than a few hours earns one checkpoint. Put it to the human as a decision with `evidence/workflow.md` before starting it. A shorter run proceeds.
3. Run the phases under the skill's Phase C loop. Log each decision with the **show-me-your-work** skill as the step lands, into `evidence/decisions.tsv`.
   When a phase waits on workers or a PR with no event to wake you, follow the runtime reference's Heartbeat, so a finished worker never waits unseen.
   Artifact: `evidence/decisions.tsv`
4. Run Phase E. Check the whole against the predicate on the real product, not only the harness.
   Write the proof as [proof](../references/proof.md) says, ending with VERIFIED, NOT VERIFIED or INCONCLUSIVE.
   Artifact: `evidence/verify.md`
5. Run **Opening a PR**.
   Artifact: `results/comment-sicko.md`, `evidence/closing-pass.md`, `evidence/reviews/final.md`

**Reply:** the playbook you designed, the rigor level and why, the decision-trail path, what's verified against the predicate, and what's still open.
