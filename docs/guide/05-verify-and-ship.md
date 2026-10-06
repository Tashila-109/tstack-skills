# Verify the result and ship it

"It compiles" is not evidence.
The lead must prove the change on the real thing before it reports done, and only you decide whether it merges.
This page covers stating a finish, vetting a measured number, giving agents a way to drive your app, answering decisions, and merging.
Verification is the slowest step in most agent work, because it usually waits on a human.
Make the agent able to do it, and you stop being the bottleneck.

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
- a UI change walks the changed flow in the running app, and when it must match a reference pixel for pixel, the [Visual parity playbook](../../skills/tstack/playbooks/visual-parity.md) diffs screenshots against a frozen baseline instead of judging by eye;
- a parser or migration replays a saved input;
- a performance change compares before and after measurements;
- a storage change reads back the written value.

Ask for the proof as an artifact you can inspect yourself: the failing test and then the passing one, a before and after recording, the trace, the screenshot.
If the fix already merged, ask for the same check again on the default branch.
An artifact beats a plausible explanation, because you can challenge it without replaying the run.

## Vet a measured number with benchmark-checklist

A before and after number is the easiest evidence to get wrong by accident.
A warm cache, a debug build on one side, or work that never ran inside the timed region can each fake a speedup.
Before you report or act on a number, ask for the check:

```text
$tstack use benchmark-checklist to vet the export speedup before it goes in the PR.
```

[benchmark-checklist](../../skills/benchmark-checklist/SKILL.md) asks seven questions, and wants evidence from a run for each:

1. What limits the number, and why isn't it double?
2. Did every side run tuned the way production runs?
3. Does the result break a physical limit, such as disk bandwidth or core count?
4. Did anything error or return wrong output?
5. Does it reproduce over alternating runs, with a median and a range?
6. Does it matter end to end, on the path a user waits on?
7. Did the work actually happen inside the timed region?

The verdict is faster, slower, no measurable difference, or inconclusive, with the run count, the range and the limiter.
The Perf issue and Hillclimb playbooks already run it, so ask for it yourself when you measured something outside them, or when someone else's number looks too good.
It is the working form of the Explain the Number principle.

## Give agents a way to drive your app

The UI check above needs a scripted way to run your app.
If your project has none, ask:

```text
$tstack create a verification skill for this project.
```

`create-verification-skill` works out how the app launches, what can drive it, and what evidence proves each feature works.
It writes a project skill named `verify-<app>`, with a feature map, and proves it once end to end before handing it over.
From then on, "verify it in the app" is a step any lead can run.

Name it in a request when you want the proof in a specific form:

```text
$tstack build the bulk-archive action. Use verify-<app> to verify your changes, and show me a recording and screenshots as proof.
```

```text
$tstack repro this with verify-<app>. If it repros on the default branch, fix it and show me a recording as proof.
```

Treat the verification skill as infrastructure.
Commit it, so every person and every agent drives the app the same way.
Then build the lever: when agents keep writing throwaway scripts to click through the app, ask for a small control CLI that the skill calls instead.
Agents spend fewer tokens, and every run becomes repeatable.
A CLI that agents use well has these traits:
- a few composable commands that each do real work, not many thin ones;
- a `--dry-run` option on anything destructive;
- subcommands that reveal features gradually;
- error messages that say what to do instead;
- rich `--help` text;
- machine-readable output, such as JSON.

Make the dev setup repeatable too: seeded data, test users, and one command that brings the environment up the same way every time.

Apps change and feature maps rot.
Run `maintain-verification-skill` regularly, such as once a day, so the skill stays true.
It audits the skill against the app, and ships at most one PR of proven corrections.

## Answer decisions

When a lead needs your call, it writes the question, the options and its recommendation to the task's `decisions/` folder, and asks you in its own thread.
It uses the harness's question tool when it has one.
Answer in your own words, and the lead records them in the same file.
A lead that an autopilot's coordinator launched asks the coordinator instead, and the coordinator asks you.

## Merge on your word

When a lead finishes, it runs `tstack.mjs check`, and tells you what changed, who it is for, how it was proved, and what the next maintainer inherits.
For `pr` delivery it gives you the PR's URL.
Then it asks whether to merge.

| Delivery | What the lead produces | What the lead does on your word |
| --- | --- | --- |
| `local-only`, the default | A clean task branch with small ordered commits | Fast-forwards the default branch to the head commit you saw, which needs the primary checkout on that branch with no uncommitted changes, then cleans up |
| `pr` | A pushed branch and an open PR, watched for checks and reviews | Merges the PR with `gh pr merge`, pinned to the head commit you saw, using your project's merge method |

Ask for PR delivery in your request, such as "open a PR for it".
Nothing merges without your explicit word, whatever else you said.

To stop being asked, give the lead a standing grant, such as "merge PRs once the verification and the reviews pass".
The lead writes it to `.tstack/grants.md` in your words, checks its conditions on the exact commit before each merge, and quotes it whenever it uses it.
Delete the file, or tell the lead, to withdraw it.

## Land a stack of PRs

A green check list does not mean a stack is safe to land.
Ask for Shipping:

```text
$tstack ship the open stack from #41 up.
```

The lead has a worker who did not write the code verify each PR on the real surface, then finds the run of verified PRs from the bottom.
It records each verdict with the patch it covered in `evidence/verdicts.md`.
On your word, the lead lands that run one PR at a time, bottom first.
Before each merge it checks the PR's patch still matches its verdict, and it stops at the first PR that changed or was never verified.
