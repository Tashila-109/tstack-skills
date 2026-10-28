# Getting started

In this tutorial you install tstack, make a tiny practice project with one bug, and have a tstack lead fix it end to end.
You finish with a merged fix and a folder of evidence that shows how the lead proved it.
It takes about 15 minutes, plus the time your agent spends working.

You can follow it in any agent harness.
Where T3 Code or Herdr does a step differently, the step says so.

## Before you start

You need:
- Node.js 20 or newer, with `npx`: check with `node --version`;
- Git: check with `git --version`;
- at least one agent harness you are signed in to, such as Claude Code, Codex, Cursor, OpenCode or Pi;
- optionally T3 Code, or Herdr 0.9.3 or newer, if you want workers on several models and tasks that start themselves.

## 1. Install the skills

Install every skill globally, naming the harnesses you use:

```sh
npx skills add Tashila-109/tstack-skills -g -a claude-code codex cursor opencode pi -y
```

Check that the router landed:

```sh
ls ~/.agents/skills/tstack/SKILL.md
```

The path prints.
Every project and every worktree on this machine now sees the skills.
To update them later, run the same install command again.

## 2. Make a practice project

Create a project with one deliberate bug:

```sh
mkdir -p ~/tstack-scratch && cd ~/tstack-scratch
git init -b main
cat > greet.mjs <<'EOF'
const [name] = process.argv.slice(3);
console.log(`Hello, ${name}`);
EOF
git add greet.mjs && git commit -m "feat: greet a name"
node greet.mjs Ada
```

It prints `Hello, undefined`.
That is the bug tstack will fix.

## 3. Set up tstack in the project

Start your agent in `~/tstack-scratch` and run the setup skill:

| Where | How |
| --- | --- |
| Claude Code, Cursor | `/tstack-setup` |
| Codex | `$tstack-setup` |
| Pi | `/skill:tstack-setup` |
| T3 Code | Open the project with `t3 app ~/tstack-scratch`, or add the folder in the sidebar. In its first thread, send `$tstack-setup`. |
| Herdr | Open a pane at `~/tstack-scratch`, start your agent there, and use its row above. |
| Anything else | `Read ~/.agents/skills/tstack-setup/SKILL.md and follow it.` |

Setup writes `~/.tstack/models.md`, which maps each role to a model, and adds `.tstack/` to the project's `.git/info/exclude`.
It never changes a tracked file.

On T3 and Herdr, setup asks for a budget and shows every role with its model.
Accept them, or change any model you lack access to.
On any other harness, every worker runs on your own model, so setup asks nothing about models.

Let the agent run shell commands without approving each one, because the lead runs many small ones.
In Claude Code that is `claude --permission-mode auto`, and in T3 it is the **Full access** permission mode.

## 4. Start the task

Send this request.
Use your harness's command from step 3, with `tstack` in place of `tstack-setup`:

```text
/tstack `node greet.mjs Ada` prints "Hello, undefined". Repro first, then fix it. Done means `node greet.mjs Ada` prints "Hello, Ada" and a test covers it.
```

The agent becomes the task's **lead**.
It tells you in one line which playbook runs the task, the finish it will prove, and how it will deliver.
Here that is the Bug fix playbook, your finish, and `local-only` delivery, which means a local merge with no pull request.

A ship task never runs in your project's main checkout, so the lead first puts it in its own Git worktree.
How that looks depends on where you run:

- **Any harness.**
  The lead makes a worktree under `~/.tstack/worktrees/tstack-scratch/` on branch `task/<task id>`.
  It gives you a command to start a new session there and a `tstack launch` block to send first.
  Run the command, paste the block, and continue in the new session.
- **T3 Code.**
  Open a new thread for the task first.
  In the composer, switch from **Current checkout** to **New worktree**, pick `main` as the base branch, and send the request there.
  The thread already runs in its own worktree, so the lead goes straight on.
- **Herdr.**
  The lead makes the worktree, opens a new tab labelled with the task ID, and starts a new lead there.
  Switch to that tab.
  If the new agent stops on a trust dialog, answer it yourself.

## 5. Watch the lead work

The lead copies the playbook's steps into its todo list and works through them:
1. It reproduces the bug and writes down what it saw.
2. It traces the cause: `process.argv.slice(3)` skips the name.
3. It hands the fix to a worker, which writes a failing test first, then the fix.
4. It verifies the fix itself, has the change reviewed, and runs `tstack.mjs check` on the task folder.

Where the workers show up depends on the runtime: as your harness's subagents, as T3 child threads under the lead, or as Herdr panes beside it.
You don't need to do anything while it works.

## 6. Merge

When the lead finishes, it tells you what was broken, how it was fixed, how it proved the fix, and asks whether to merge.
Reply:

```text
merge it
```

The lead fast-forwards `main` to the commit it verified.
Check it yourself:

```sh
cd ~/tstack-scratch
node greet.mjs Ada
git log --oneline
```

It prints `Hello, Ada`, and the log shows the lead's commits on top of yours.

The lead then tidies up.
On any harness and on Herdr, it removes its worktree and branch and tells you the session or tab can be closed.
On T3, the thread stays for you to archive, and the worktree stays unless you turned on T3's removal of merged worktrees.

## 7. Read what the lead left behind

Every task keeps its record in the project's `.tstack/tasks/<task id>/`:

```sh
ls ~/tstack-scratch/.tstack/tasks/*/
ls ~/tstack-scratch/.tstack/tasks/*/evidence/
```

You find:
- `brief.md`: the goal, the finish, and the playbook steps the lead copied into its todo list;
- `evidence/`: one file per step, such as `repro.md`, `mechanism.md`, `fix.md`, `verify.md`, `red-green.md` and `reviews/final.md`, each read by the step after it;
- `results/`: each worker's result;
- `report.md`: the lead's final report, with the principles it applied and lessons for later tasks.

The lead could not report done until `tstack.mjs check` passed on this folder.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| `/tstack` is not found | Rerun the install with your harness in `-a`, then restart the agent. On any harness, `Read ~/.agents/skills/tstack/SKILL.md and follow it.` always works. |
| The lead says there is no models file | Run the setup skill from step 3. |
| A seat would not launch, on T3 or Herdr | The lead stops and asks you. Sign in to that provider, or rerun setup and pick a model you have. |
| The new session can't write to the project | Start it with `--add-dir <project>`, as the lead's command shows, so it may write the task records and commit. |
| The lead keeps asking to approve commands | Turn on your harness's auto or full-access mode for this session. |
| Merge fails to fast-forward | `main` moved, or has uncommitted changes. The lead brings `main` into its branch, verifies again, and asks you again. |

## Install into one project

To keep tstack out of your global skills, run the install from inside a project, without `-g`:

```sh
cd ~/tstack-scratch
npx skills add Tashila-109/tstack-skills -a claude-code codex cursor opencode pi -y
```

The skills land in the project's `.agents/skills` and each harness's project folder, with a `skills-lock.json`.
`tstack-setup` excludes those paths through `.git/info/exclude`, so Git ignores them without a tracked change.

A new worktree does not contain ignored files, so leads link the skills into each worktree they make with `tstack.mjs link-skills`.
On T3, setup asks you to add a project action that does this for every new worktree.

## Keep the cost in check

tstack spends extra tokens on workers and review panels, which is the price of the rigor.
To spend fewer:
- Rerun setup and pick a smaller budget.
  `unlimited` runs every seat at `max`, `large` at `xhigh`, `medium` at `high`, and `small` at `medium`.
- Set a role to `inherit`, so it runs on the caller's own model.
- Shorten a panel in `~/.tstack/models.md`, because each seat runs one agent.
- Save tstack for work that needs rigor.
  A small, obvious edit does not.

## Next

- [Start a task](guide/01-route-work.md) shows how to word a request, and the rest of the guide follows the work from understanding to shipping.
- [Any harness](runtimes/any-harness.md), [T3 Code](runtimes/t3.md) and [Herdr](runtimes/herdr.md) explain what each runtime shows and how to check on a lead.
- [Concepts](concepts.md) explains why the workflow is built this way, and the [reference](reference.md) lists its files, commands and skills.
- Not sure which skill or playbook fits? Ask `/tstack-help`, or `$tstack-help` in Codex.
