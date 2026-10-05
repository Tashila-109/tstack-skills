# Verification records

Each file here is a dated record of a run that proved, or failed to prove, a claim about tstack-skills.
A claim that something works on a runtime belongs in a record, not in a commit message.

## Measuring a live task

Use this after a real task, to see which skills were applied and which were only claimed.
The task folder is `<project>/.tstack/tasks/<id>/`.

1. **Gate.** Run `node ~/.agents/skills/tstack/scripts/tstack.mjs check <id>` from the project.
   A pass means every frozen artifact, every granted gate and the report exist.
   It does not mean they are good.
2. **Workers.** List `results/`.
   Each file is one delegated worker: `how.md`, `why.md`, `comment-sicko.md`, `fix.md`, and the reviewers' `review-<label>-<axis>.md`.
   A skill a playbook step names but no result file shows was done inline, or not at all.
3. **Seats.** Check each worker ran on the seat its role names.
   On T3, the lead's transcript shows each `delegate_task` target.
   On Herdr, `ps` or the lead's transcript shows each agent's `--model` and effort flags.
4. **Reads.** In the lead's session transcript, count the `SKILL.md` files it read.
   Claude Code keeps transcripts under `~/.claude/projects/<path with dashes>/`.
   A principle the report cites with no read of its `SKILL.md` was name-dropped.
5. **Content.** Read each artifact against its step.
   A mechanism with no runtime evidence, or a review with no findings section, is paper even when the file exists.
6. **Decisions.** Read `decisions/`.
   Each one should be a call the [decisions reference](../../skills/tstack/references/decisions.md) sends to the human, with the human's answer recorded.

Record the counts and what did not hold, with the fix you made or proposed.
