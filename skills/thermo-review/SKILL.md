---
name: thermo-review
description: "Launch both thermo-nuclear review passes in parallel, then synthesize their findings. Use for thermo review, double thermo review, or combined bug/security and code-quality branch audits."
disable-model-invocation: true
---

# Thermo Review

Run the two thermo review passes as read-only reviewers in parallel, then synthesize their results.

## Workflow

1. Determine the review scope from the user request, PR, current branch, or relevant changed files.
2. Gather the diff and any file/context excerpts needed for reviewers to evaluate the change without guessing.
   Resolve the diff once, as `git diff <base>...HEAD`, `git diff --staged`, or `git diff HEAD`, and give both reviewers that same scope.
3. Launch both reviewers in the same message:
   - The [thermo-nuclear-review](../thermo-nuclear-review/SKILL.md) rubric for bugs, breakages, security, devex regressions, feature-flag leaks, and other branch-audit risks.
   - The [thermo-nuclear-code-quality-review](../thermo-nuclear-code-quality-review/SKILL.md) rubric for maintainability, structure, file-size growth, spaghetti, abstractions, and codebase-health risks.
4. Pass each reviewer the same scoped diff and the full contents of the changed files.
   Ask it to read its rubric `SKILL.md` first, then return prioritized findings with file references and evidence.
5. After both finish, synthesize the results with findings first, deduplicated across reviewers.
   Weight overlapping findings more heavily, resolve disagreements with your own judgment, and keep summaries brief.

If individual summaries are already visible to the user, do not restate them wholesale.
Surface the unified verdict, the highest-signal findings, and any remaining uncertainty.

## In a tstack task

A lead delegates the two reviewers as read-only workers, as the tstack skill's [dispatch reference](../tstack/references/dispatch.md) says, both in one response.
Resolve the seats with `node <tstack skill directory>/scripts/tstack.mjs seat "interrogate reviewers" --runtime <runtime>`.
Run the bug and security reviewer on the first seat.
Run the code-quality reviewer on the first seat of a different model family on that line.

Each brief tells the worker to read the absolute path of its rubric `SKILL.md` first, and passes the resolved diff scope and the full changed-file contents.
The bug and security worker writes `results/thermo-bugs.md`, and the code-quality worker writes `results/thermo-quality.md`.

Synthesize after both results arrive.
Name each reviewer's model family, and weight findings both reviewers found.

Outside a tstack task, use the harness's own subagents, one per rubric, and give each the same material.
