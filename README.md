# tstack-skills

tstack runs coding work the way a small, careful team does.
You open one thread or pane per task and talk to that task's **lead**.
The lead works in its own Git worktree, follows a playbook for that kind of work, such as a bug fix or a feature, and hands scoped jobs to **workers** on the models you chose.
Every skill-bearing step leaves a file the next step reads, so the rigor is checked, not assumed.
Only you authorize a merge.

tstack-skills is the whole workflow as plain agent skills.
It runs on two runtimes:
- **[T3 Code](https://t3.codes)**, where each task is a thread in its own worktree, and workers are T3 child tasks;
- **[Herdr](https://herdr.dev)**, where each task is a tab, and workers get panes beside the lead.

Leads and workers run on Claude Code, Codex or Pi, and workers can also run on Grok Build.

## Requirements

- Node.js 20 or newer, with `npx`.
- Git, and the GitHub CLI `gh` if you want tasks delivered as pull requests.
- T3 Code, or Herdr 0.9.3 or newer.
- At least one agent CLI, signed in: Claude Code, Codex or Pi.
  Grok Build is optional, for worker seats.

## Install

Install every skill globally from this repository:

```sh
npx skills add Tashila-109/tstack-skills -g -a claude-code codex pi -y
```

The repository is private, so `npx skills` clones it with your own Git credentials.

This copies the skills to `~/.agents/skills`, which Codex and Pi read, and links them from `~/.claude/skills` and `~/.pi/agent/skills`.
Every project and every worktree then sees them.
To update, run the same command again, because installed skills are copies.

To install into one project only, run the command from that project without `-g`.
[Getting started](docs/getting-started.md#install-into-one-project) covers what that changes.

## Start

In your project, start your agent and run the setup skill once:

| Harness | Setup | Start a task |
| --- | --- | --- |
| Claude Code | `/tstack-setup` | `/tstack` |
| Codex, or any thread in T3 | `$tstack-setup` | `$tstack` |
| Pi | `/skill:tstack-setup` | `/skill:tstack` |

Then open a thread or pane for the task, and tell its lead what you want and how you will know it is done.
On T3, open the thread in **New worktree** mode, then send:

```text
$tstack users see "Hello, undefined" when they pass a name. Repro first, then fix it. Done means `node greet.mjs Ada` prints "Hello, Ada".
```

## Read further

Not sure which skill or playbook fits? Run `tstack-help`.

- [Getting started](docs/getting-started.md): install, set up a scratch project, and run one task end to end on T3 and on Herdr.
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
- [Concepts](docs/concepts.md) and [Reference](docs/reference.md): why the workflow works this way, and its files, commands, models file and skill list.
- [T3 Code](docs/runtimes/t3.md) and [Herdr](docs/runtimes/herdr.md): what each runtime shows you, where a task starts, and how to check on a lead.
- [Migrating from tstackv2](docs/migrating-from-tstackv2.md): move a project tstackv2 set up onto tstack-skills.
- [Plan](PLAN.md): the design decisions and the build phases.

## License

The skills under `skills/` include third-party text under the MIT license; the notices are in [LICENSES/](LICENSES/).
