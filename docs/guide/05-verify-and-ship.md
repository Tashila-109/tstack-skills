# Verify the result and ship it

"It compiles" is not evidence.
The lead must prove the change on the real thing before it reports done, and only you decide whether it merges.
This page covers stating a finish, giving agents a way to drive your app, answering decisions, and merging.

## State the finish up front

Put what done means in your first request:

```text
$tstack add JSON output to this command. The text output stays byte-identical, the JSON parses, and both run against the sample project. Show me the evidence.
```

The lead now has three checks it can run, not a mood to satisfy.
Its report carries the exact commands and their output.
A check it could not run is reported as inconclusive, and a confident report with no evidence is a red flag.

Match the check to the change:
- a CLI change runs the real command;
- a UI change walks the changed flow in the running app;
- a parser or migration replays a saved input;
- a performance change compares before and after measurements;
- a storage change reads back the written value.

## Give agents a way to drive your app

The UI check above needs a scripted way to run your app.
If your project has none, ask main:

```text
$tstack create a verification skill for this project.
```

`create-verification-skill` works out how the app launches, what can drive it, and what evidence proves each feature works.
It writes a project skill named `verify-<app>`, with a feature map, and proves it once end to end before handing it over.
From then on, "verify it in the app" is a step any lead can run.
`maintain-verification-skill` audits that skill when the app drifts.

## Answer decisions

A lead never asks you directly.
When it needs your call, it writes the question, the options and its recommendation to the task's `decisions/` folder, and main asks you.
Answer main in your own words.
Main records your answer in the same file and sends it to the lead.

## Merge on your word

When a lead finishes, main runs `tstack.mjs check`, reads the report, and tells you what changed, who it is for, how it was proved, and what the next maintainer inherits.
Then it asks whether to merge.

| Delivery | What the lead produces | What main does on your word |
| --- | --- | --- |
| `local-only`, the default | A clean branch, `task/<task id>`, with small ordered commits | Fast-forwards your branch to it, then cleans up the worktree |
| `pr` | A pushed branch and an open PR, watched for checks and reviews | Merges the PR with `gh pr merge`, pinned to the commit the lead reported, using your project's merge method |

Ask for PR delivery in your request, such as "open a PR for it".
Nothing merges without your explicit word, whatever else you said.

## Land a stack of PRs

A green check list does not mean a stack is safe to land.
Ask for Shipping:

```text
$tstack ship the open stack from #41 up.
```

The lead has a worker who did not write the code verify each PR on the real surface, then finds the run of verified PRs from the bottom.
It records each verdict with the patch it covered in `evidence/verdicts.md`.
On your word, main lands that run one PR at a time, bottom first.
Before each merge it checks the PR's patch still matches its verdict, and it stops at the first PR that changed or was never verified.
