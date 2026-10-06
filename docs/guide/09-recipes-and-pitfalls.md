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
- **A vague finish.**
  "Make it better" gives the lead nothing to prove.
  Give a command, an output or an artifact that can pass or fail.
- **Expecting a merge without saying so.**
  Nothing merges without your word, whatever else you asked for.
  Main asks; answer it.
- **Reading only the report.**
  The task folder holds the evidence behind every claim: the repro, the mechanism, the red and green runs, and each reviewer's findings.
  [Measuring a live task](../verification/README.md#measuring-a-live-task) shows how to check a run.
