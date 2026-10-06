# Recipes and pitfalls

Requests worth copying, then the mistakes the first real runs made.
Swap in your own paths and finish conditions.

## Recipes

Fix a bug through a failing test:

```text
$tstack the export writes duplicate rows when a retry lands mid-run. Repro first, then fix it. Done means one retry writes one row, and a test covers it.
```

Ask a question without changing code:

```text
$tstack how does the cache decide an entry is stale? Don't change any code.
```

Plan a large change you want to approve before anyone builds:

```text
$tstack plan moving the notes API to tRPC, in phases. I want to approve the design and the spec. Don't build yet.
```

Restate a noisy report before touching code:

```text
$tstack read this thread. restate the underlying issue in your own words, in plain english. Don't change any code yet.
```

A misreading shows up in the restatement, where it costs one message to correct.
Keep your own theory to yourself until the agent has stated its own.

Prototype before you pick:

```text
$tstack prototype a few options for the settings layout. Put them behind a switcher and send me screenshots of each.
```

You pick from things that run, not from descriptions.

Turn a settled design into a plan:

```text
$tstack turn this design into a plan. Small verifiable PRs, each with its own proof. Don't build yet.
```

Ask only after the design settles.
The plan is the deliverable.

Repro a report with proof, and fix it only if it repros:

```text
$tstack repro this with verify-<app>. If it repros on main, fix it and show me a recording as proof.
```

"If it repros on main" lets the run stop early when the bug is already gone.
The recording lets you check the fix before you read the diff.

Vet a number before you post it:

```text
$tstack use benchmark-checklist to vet this 40% speedup before it goes in the PR description.
```

You get faster, slower, no measurable difference or inconclusive, with the run count, the range and what limits the number.

Stop correcting the same mistake:

```text
$tstack use correct on this: agents keep adding config flags without registering them in the schema.
```

The fix is meant to land in the repo as architecture, a type, a lint or a test, so the next agent cannot make the mistake.
When the fix belongs in a skill, change it and test it in one task:

```text
$tstack update the review skill so it flags missing migrations, and eval the change.
```

Asking for the eval up front keeps the edit honest.
A fix written from one bad session tends to overfit that session.

Ask which skill fits, without starting work:

```text
/tstack-help how do I get a lead to show me its design before it writes code?
```

You get an answer, a prompt to send, and a link to the source.
Nothing runs until you send that prompt.

Deliver as a pull request instead of a local branch:

```text
$tstack add a --json flag. The text output stays byte-identical. Open a PR for it.
```

Check on everything at once:

```text
where does every task stand?
```

## Pitfalls

- **Reusing a project that already has tstack history.**
  Main reads the backlog, and when it says a task is done, main checks Git and asks you before redoing it.
  For a clean trial, use a fresh project.
- **A provider that is installed but not signed in where the runtime runs it.**
  On T3, a Grok worker failed because T3's own Grok provider was signed out, though the Grok CLI worked in a terminal.
  The lead stopped and asked instead of switching models.
  Sign in under T3's provider settings, then answer the decision.
- **Typing into a busy agent on Herdr.**
  A prompt sent to an agent mid-turn takes over that turn.
  tstack's own messages wait for the agent to be idle, and so should yours.
- **Starting main without auto mode on Herdr.**
  Main runs many small commands.
  Start Claude Code with `--permission-mode auto`, or approve each one as it comes.
- **Leading with your theory of the cause.**
  The agent searches wherever you pointed.
  Ask it to restate the problem first, then share your hunch.
- **Taking the first design.**
  One attempt locks in the first shape the model thought of.
  Ask for prototypes or `architect`, and pick from evidence.
- **Polishing an abstract plan.**
  Adversarial review of a plan with no code behind it invents risks that never happen.
  Settle the open questions with prototypes, then review what got built.
- **Looping before you trust the loop.**
  A loop that cannot verify its own work only makes unchecked work faster.
  Get the verification skill working first.
- **Trusting an unvetted number.**
  A warm cache or a skipped code path can fake a speedup.
  Ask for `benchmark-checklist` before the number goes anywhere.
- **Correcting the same mistake by hand.**
  A correction in chat helps one run.
  `correct` changes the repo so no later run repeats it.
- **A vague finish.**
  "Make it better" gives the lead nothing to prove.
  Give a command, an output or an artifact that can pass or fail.
- **Expecting a merge without saying so.**
  Nothing merges without your word, whatever else you asked for.
  Main asks; answer it.
- **Reading only the report.**
  The task folder holds the evidence behind every claim: the repro, the mechanism, the red and green runs, and each reviewer's findings.
  [Measuring a live task](../verification/README.md#measuring-a-live-task) shows how to check a run.
