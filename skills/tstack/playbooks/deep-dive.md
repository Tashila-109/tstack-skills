# Deep dive

**You own what this project takes from another one, and why.**
**Pin, rule, frame, explore, check, rank, decide.**

This scout reads another project, the source, and says which of its parts this project should take.
It changes neither project and writes only its task folder.
Brief it as a scout.
Building what the human takes is a separate ship task for each item.

1. **Pin the source.** Clone each source the human named into `sources/<name>/` in the task folder, even one already on this machine, and check out the commit they named or the default branch's head.
   Nobody writes in a clone.
   When the human asks only for what changed since an earlier commit, such as the last one this project took, record that base too.
   Write each source's URL or path, its commit SHA, any base, and its license, read from its license file, to `evidence/source.md`.
   Read nothing else in a source until step 2 is answered.
   Artifact: `evidence/source.md`
2. **Decide the reuse rule.** Open a `reuse` decision of kind `question`, as [decisions](../references/decisions.md) says, offering the three rules below.
   - copy: copy files or passages where the source's license allows it, adding the source's notice to this project's license file, such as `LICENSE.md`, in the same change;
   - adapt: rework the source's designs in this project's own shape and words, and paste nothing;
   - ideas only: take features and approaches, never text or code, so a builder works from the report and not from the source.

   Recommend one from the license in `evidence/source.md`, and ideas only for a source with no license.
   When the human's request already names the rule, write their words as the answer instead of asking.
   Artifact: `decisions/reuse.md`
3. **Frame.** Read this project's own account of itself: its `AGENTS.md` or `CLAUDE.md`, its README, and its architecture docs when it has them.
   Write to `evidence/frame.md` what this project is for, its current design in a few lines that cite paths, and the areas the human wants improved.
   Split the source into four or five areas by directory or concern, fewer only when it is too small to split that far, and list the paths each covers.
   The areas cover the whole source, or the diff from its base, except vendored, generated and dependency paths.
   Artifact: `evidence/frame.md`
4. **Explore.** Delegate one read-only worker per area on the `how explorer` seat, as [dispatch](../references/dispatch.md) says, and launch them all before you wait on any.
   Each brief gives the clone path and commit, its area's paths, `evidence/frame.md` and the answered reuse rule.
   It asks for each candidate worth taking: what it does, how it works with `path:line` citations at that commit, what in this project it would change or replace, citing paths, and how the reuse rule lets it be taken.
   Collect every result, and write `evidence/dispatch.md`: each worker's brief and result paths, and any area a worker left unread.
   Artifact: `evidence/dispatch.md`
5. **Check the claims.** Read every `path:line` a candidate rests on yourself, in the source and in this project.
   A claim that this project lacks something needs a search of this project that finds nothing.
   Mark each claim holds, wrong or unclear in `evidence/claims.md`, with the reason for each claim that does not hold.
   Drop each candidate whose claims fail, and add anything you found that spans areas, since no one explorer saw it.
   Artifact: `evidence/claims.md`
6. **Rank.** Rank the surviving candidates against the current design in `evidence/frame.md`.
   For each, name what it fixes or enables here, what it costs to build and maintain, what in the current design it conflicts with, and how the reuse rule lets it be taken.
   Drop a candidate this project already does as well, with its reason.
   Write the ranked table to `evidence/synthesis.md`, and under it one line per candidate the human can start a task from: `- <slug>: <playbook>: <what to take>, from <source path>; <what it changes here>`.
   Artifact: `evidence/synthesis.md`
7. **Decide what to take.** Open one `adopt` decision of kind `question` on `evidence/synthesis.md`, with the candidates you recommend taking, and ask the human which to take.
   Artifact: `decisions/adopt.md`
8. **Report.** Write `report.md` from `evidence/synthesis.md` and the answer.
   List each taken candidate's line from step 6, for the human to start in a new thread, and put each candidate not taken under `## Follow-ups`, one line each with the reason it was left.
   Throughput checkpoint stays one line: `throughput checkpoint: n/a, read-only deep dive`.
   Apply the **unslop** skill.

**Reply:** each source and its commit, the reuse rule, the ranked table, the claims that failed, the candidates the human took as task lines, and what was left with the reason for each.
