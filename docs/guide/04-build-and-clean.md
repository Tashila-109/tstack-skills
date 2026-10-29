# Build the change and clean the diff

The build playbooks share one habit: you say what you observed, and the playbook demands the evidence.
This page shows what to put in each request, and the cleanup every task ends with.

## Request each build playbook with what you know

A bug states the symptom and asks for a reproduction first:

```text
$tstack this command emits two records after a retry. Repro first, then fix and verify.
```

A feature states the behavior and what must not change:

```text
$tstack add a --json flag. The text output stays byte-identical. Verify both forms.
```

A refactor pins behavior before structure moves:

```text
$tstack move the parsing into one module, with zero behavior change. Record the current output first and prove it is unchanged after.
```

Both perf playbooks run `benchmark-checklist` on their numbers.
Perf issue vets its baseline and every number after it, and Hillclimb vets its harness before it freezes it.
[Verify and ship](05-verify-and-ship.md#vet-a-measured-number-with-benchmark-checklist) shows when to run it yourself.

## Get the cause before any fix

Sometimes you want the cause and no fix.
For a live symptom, such as a leak, an idle CPU spin or a visual glitch, the [Runtime forensics playbook](../../skills/tstack/playbooks/runtime-forensics.md) instruments the running process.
For a profile you already captured, the [Trace forensics playbook](../../skills/tstack/playbooks/trace-forensics.md) reads the artifact and maps the hot frame to source.
Both return a diagnosis, not a fix:

```text
$tstack here is a cpuprofile from the slow startup. Tell me where the time goes and which source lines own it. No fix yet.
```

## What each playbook leaves behind

Each step that runs a skill writes a file in the task's `evidence/` folder, and `tstack.mjs check` refuses to let the lead report done while one is missing.

| Playbook | Files |
| --- | --- |
| Bug fix | `repro.md`, `mechanism.md`, `fix.md`, `verify.md`, `red-green.md`, `closing-pass.md`, `reviews/final.md` |
| Feature | `grounding.md`, `design.md`, `throughput.md`, `dispatch.md`, `verify.md`, `interrogate.md`, `closing-pass.md`, `reviews/final.md` |
| Refactoring | `pin.md`, `design.md`, `dispatch.md`, `equivalence.md`, `verify.md`, `reader-load.md`, `closing-pass.md`, `reviews/final.md` |

Each also keeps the results of the workers the steps delegate in `results/`: `how.md` from the understanding skills, and `why.md` too for Bug fix, the fix or feature worker's result, and `comment-sicko.md` from the closing pass.
`check` requires those too, so a skill done inline instead of delegated shows up as a missing file.
Read them when you want to know how the lead reached its answer, not only what it changed.

## The failing test comes first

When a bug has a cheap local test path, the fix worker follows `tdd`: a test that fails for the intended reason, then the fix, then the same test passing.
The red and green output lands in `red-green.md`, and the commits keep the failing test before the fix.
When a test would need heavy setup or brittle mocks, the worker says so and uses the closest real check instead.

## The lead delegates the code

In Bug fix, Feature and Refactoring, the lead writes the brief and reviews the diff, and a worker on your seat for that playbook writes the code.
Separating the writer from the reviewer is the point.
The lead writes code itself only for a review repair that the next review covers, failing test first.

## Clean before delivery

Bug fix, Feature, Refactoring, Figure it out and Orchestrate end with Opening a PR, which runs the cleanup whatever the delivery mode:
- unneeded code comes out: narrating comments, unsupported guards, dead compatibility paths, and unrelated edits;
- `no-comments` hands the comments to a separate reviewer, Comment Sicko, who keeps only what code cannot say;
- `technical-writing` and `unslop` shape the commit messages and the PR description.

The lead records each changed file's verdict in `closing-pass.md`.

Then one reviewer from another model family reads the final diff before anything is pushed or merged.
On T3 and Herdr, a Claude lead gets the GPT seat from your `review` line, and a GPT lead gets the Claude seat.
On [any other harness](../runtimes/any-harness.md) the reviewer runs on your lead's model, and the lead records it as a same-family review.
The lead decides each finding, repairs what blocks, and has the new head reviewed again.
