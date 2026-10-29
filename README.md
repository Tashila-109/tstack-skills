# tstack-skills

Agent skills that make your coding agent work like a small, careful engineering team.

You describe a task and how you will know it is done.
A **lead** agent picks the right playbook, such as a bug fix, a feature or a refactor, and runs it in its own Git worktree.
It hands scoped jobs to **worker** agents, checks their work, and asks you before anything merges.
Every step leaves an evidence file that the next step reads, and a script refuses to call the task done while one is missing.
So the rigor is checked, not assumed.

```text
/tstack users see "Hello, undefined" when they pass a name. Repro first, then fix it.
Done means `node greet.mjs Ada` prints "Hello, Ada".
```

The lead reproduces the bug, traces the cause, has a worker write a failing test and the fix, gets it reviewed, and comes back with the proof and one question: merge it?

## What you get

- **Playbooks for each kind of work.**
  Bug fix, feature, refactoring, investigation, performance, prototype, opening and babysitting a PR, multi-phase plans, and more.
  The lead picks one at intake and tells you which.
- **Skills behind the steps.**
  Exploring code (`how`, `why`), design bakeoffs (`architect`, `arena`), adversarial review (`interrogate`, `two-axis-review`), test-first fixes (`tdd`), and 24 engineering principles you can steer by name.
- **Evidence you can read.**
  Each task keeps its brief, the repro, the mechanism, the red and green test runs, each reviewer's findings, and a final report in `.tstack/tasks/<id>/`.
- **You stay in charge.**
  Nothing merges, deploys or gets deleted without your word.

## Where it runs

tstack works in any agent harness that loads skills.
An orchestrator adds automation on top.

| Runtime | Workers run as | Tasks start | Best for |
| --- | --- | --- | --- |
| **Any harness**: Claude Code, Codex, Cursor, OpenCode, Pi and others | Your harness's own subagents, on your lead's model | You open a session per task; the lead makes the worktree and tells you where | Trying tstack, or working in the tool you already use |
| **[T3 Code](https://t3.codes)** | T3 child tasks, on the model each role names, waking the lead when done | You open a thread in **New worktree** mode | Running several tasks at once with a sidebar of threads |
| **[Herdr](https://herdr.dev)** | Agent panes beside the lead, on the model each role names | You start a pane; the lead opens a tab per task | Terminal-first work across Claude Code, Codex and Pi |

[What changes without an orchestrator](docs/runtimes/any-harness.md#what-you-keep-and-what-you-lose) lists the trade-offs.

## Quick start

You need Node.js 20 or newer, Git, and at least one agent harness you are signed in to.
Install the GitHub CLI `gh` if you want tasks delivered as pull requests.

**1. Install the skills globally**, choosing the harnesses you use:

```sh
npx skills add Tashila-109/tstack-skills -g -a claude-code codex cursor opencode pi -y
```

Leave out `-a ... -y` to pick harnesses from a list.

**2. Set up a project.**
Start your agent in a Git repository with at least one commit, and run the setup skill once:

| Harness | Setup | Start a task |
| --- | --- | --- |
| Claude Code, Cursor | `/tstack-setup` | `/tstack` |
| Codex, or any T3 thread | `$tstack-setup` | `$tstack` |
| Pi | `/skill:tstack-setup` | `/skill:tstack` |
| Anything else | `Read ~/.agents/skills/tstack-setup/SKILL.md and follow it.` | `Read ~/.agents/skills/tstack/SKILL.md and follow it.`, then your request |

**3. Start a task** with your goal and how you will know it is done.
The lead tells you which playbook it chose and where to continue.

[Getting started](docs/getting-started.md) walks through a first task end to end in about 15 minutes.

## Documentation

- [Getting started](docs/getting-started.md): install, fix a bug in a practice project, and read what the lead left behind.
- The guide:
  [start a task](docs/guide/01-route-work.md),
  [understand the code](docs/guide/02-understand.md),
  [design](docs/guide/03-design.md),
  [build and clean up](docs/guide/04-build-and-clean.md),
  [verify and ship](docs/guide/05-verify-and-ship.md),
  [run while away](docs/guide/06-run-while-away.md),
  [steer by principle](docs/guide/07-principles.md),
  [plan across phases](docs/guide/08-plan-across-phases.md), and
  [recipes and pitfalls](docs/guide/09-recipes-and-pitfalls.md).
- Runtimes: [any harness](docs/runtimes/any-harness.md), [T3 Code](docs/runtimes/t3.md) and [Herdr](docs/runtimes/herdr.md).
- [Concepts](docs/concepts.md): why the workflow is built this way.
- [Reference](docs/reference.md): files, commands, the models file and every skill.

Not sure which skill or playbook fits? Ask `/tstack-help`, `$tstack-help` in Codex, or `/skill:tstack-help` in Pi.

## Contributing

[AGENTS.md](AGENTS.md) has the repository's layout, rules and checks.
Run the script tests with `node --test skills/tstack/scripts/*.test.mjs`.
Report security problems privately, as [SECURITY.md](SECURITY.md) says.

## License

MIT, in [LICENSE.md](LICENSE.md), which also holds the notices for the third-party MIT text these skills adapt.
