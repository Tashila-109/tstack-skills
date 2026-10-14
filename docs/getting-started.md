# Getting started

In this tutorial you install tstack, set up a small scratch project, and fix one bug in it end to end: first on T3 Code, then on Herdr.
You finish with a merged commit, and with the evidence each step of the Bug fix playbook left behind.
Allow about 30 minutes per runtime.

You need the [requirements](../README.md#requirements) installed and signed in.
You can follow only the T3 part or only the Herdr part.

## Install

Install every skill globally:

```sh
npx skills add Tashila-109/tstack-skills -g -a claude-code codex pi -y
```

Check that the router is installed where all three harnesses look:

```sh
ls ~/.agents/skills/tstack/SKILL.md ~/.claude/skills/tstack/SKILL.md
```

Both paths print.

## Make a scratch project

Create a project with one deliberate bug:

```sh
mkdir -p ~/tstack-scratch && cd ~/tstack-scratch
git init -b main
cat > greet.mjs <<'EOF'
const [name] = process.argv.slice(3);
console.log(`Hello, ${name}`);
EOF
git add greet.mjs && git commit -m "feat: greet a name"
```

Run it:

```sh
node greet.mjs Ada
```

It prints `Hello, undefined`.
That is the bug tstack will fix.

## Part 1: on T3 Code

### Set up the project

1. Open the project in T3: run `t3 app ~/tstack-scratch`, or add the folder in the T3 sidebar.
2. In the new thread, choose Claude as the provider.
3. Send:

   ```text
   $tstack-setup
   ```

4. Answer setup's questions.
   It asks for a budget, then shows every role with its harness, model and effort.
   Accept the roles, or change any you lack access to.

Setup writes `~/.tstack/models.md` and adds `.tstack/` to the project's `.git/info/exclude`.
It never changes a tracked file.

### Run the task

1. Open a new thread for the task.
   In the composer, switch from **Current checkout** to **New worktree**, and pick `main` as the base branch.
   T3 names the branch and makes the worktree.
2. Choose the model you want the lead to run on, and set the permission mode to **Full access**.
   The lead runs many small shell commands, and Full access spares you approving each one.
3. Send:

   ```text
   $tstack `node greet.mjs Ada` prints "Hello, undefined". Repro first, then fix it. Done means `node greet.mjs Ada` prints "Hello, Ada" and a test covers it.
   ```

This thread is the task's lead.
It does the intake itself, then tells you in one line which playbook it chose, the finish it will prove, and how it will deliver.
Here that is the Bug fix playbook, `local-only` delivery, and your finish.

The lead copies the playbook's steps into its todo list, reproduces the bug, and traces the cause.
It then delegates the fix to a worker.
The worker shows up as a child of the lead, on the model your `bug-fix` role names.

When the lead finishes, it tells you in its own thread what was broken, how it was fixed and proved, and asks whether to merge.

### Merge

Reply:

```text
merge it
```

The lead fast-forwards `main` to the task's head commit.
Check:

```sh
node greet.mjs Ada
git log --oneline
```

It prints `Hello, Ada`, and the log shows the lead's commits on top of yours.
The thread stays in the sidebar for you to archive.
The worktree stays too, unless you turned on T3's removal of merged worktrees.

## Part 2: on Herdr

Reset the scratch project so the bug is back:

```sh
cd ~/tstack-scratch
git reset --hard "$(git rev-list --max-parents=0 HEAD)"
```

### Start the task

1. Open a Herdr pane at `~/tstack-scratch`.
2. Start Claude Code in it: `claude --permission-mode auto`.
   The lead runs many small shell commands, and auto mode spares you approving each one.
   Plain `claude` works too, if you approve them as they come.
3. If you skipped Part 1, run `/tstack-setup` and answer its questions.

### Run the task

Type:

```text
/tstack `node greet.mjs Ada` prints "Hello, undefined". Repro first, then fix it. Done means `node greet.mjs Ada` prints "Hello, Ada" and a test covers it.
```

The pane is at the project root, which is the primary checkout, so the lead moves the task before it works.
It cuts a worktree under `~/.tstack/worktrees/tstack-scratch/` on branch `task/<task id>`, opens a new tab labelled with the task ID, and starts a new lead there.
It tells you which tab to continue in, and stops.
Switch to that tab.
The lead's workers open as panes beside it.
If a new agent stops on a trust dialog, answer it yourself in that pane.
tstack never answers one.

The new lead tells you which playbook, finish and delivery it chose, then runs the task.
When it finishes, it tells you the outcome and asks whether to merge.
Reply `merge it`, then check `node greet.mjs Ada` again.
The lead removes its own worktree and branch after the merge, and tells you the tab can be closed.

## See what the lead left behind

Every task keeps its record in the project's `.tstack/tasks/<task id>/`:

```sh
ls ~/tstack-scratch/.tstack/tasks/*/
ls ~/tstack-scratch/.tstack/tasks/*/evidence/
```

You find:
- `brief.md`: the goal, the finish, and the playbook steps the lead copied into its todo list;
- `evidence/repro.md`, `mechanism.md`, `fix.md`, `verify.md`, `red-green.md`, `closing-pass.md` and `reviews/final.md`: the files the Bug fix steps write, each read by the step after it;
- `results/`: each worker's result, such as `how.md`, `why.md` and `comment-sicko.md`;
- `report.md`: the lead's final report, with the principles it applied and any lessons for later tasks.

`node ~/.agents/skills/tstack/scripts/tstack.mjs check <task id> --head <head SHA>` passed on this folder before the lead could report done.

## Install into one project

To keep tstack out of your global skills, run the install from inside a project, without `-g`:

```sh
cd ~/tstack-scratch
npx skills add Tashila-109/tstack-skills -a claude-code codex pi -y
```

The skills land in the project's `.agents/skills`, `.claude/skills` and `.pi/skills`, with a `skills-lock.json`.
`tstack-setup` excludes those paths through `.git/info/exclude`, so Git ignores them without a tracked change.

A new worktree does not contain ignored files, so leads need the skills linked in:
- on Herdr, the lead that moves a task runs `tstack.mjs link-skills <worktree>` for its worktree;
- on T3, setup asks you to add a project action under Settings, then Project, then Actions, which runs on every new worktree.

## Keep the cost in check

tstack spends extra tokens on workers and review panels, which is the price of the rigor.
To spend fewer:
- Rerun `tstack-setup` and pick a smaller budget.
  `unlimited` runs every seat at `max`, `large` at `xhigh`, `medium` at `high`, and `small` at `medium`.
  With no budget, the template's efforts stay, from `high` to `max`.
- Set a role to `inherit`, so it runs on the caller's own harness and model.
- Shorten a panel list in `~/.tstack/models.md`, because each seat runs one agent.
- Save tstack for work that needs rigor.
  A small, obvious edit does not.

## Next

- [The guide](guide/01-route-work.md) starts with how to start a task and word the request, and the rest of its pages follow the work from understanding to shipping.
- [T3 Code](runtimes/t3.md) and [Herdr](runtimes/herdr.md) explain what each runtime shows and how to check on a quiet lead.
- [Concepts](concepts.md) explains why the workflow is built this way, and the [reference](reference.md) lists its files, commands and skills.
- Not sure which skill or playbook fits? Run `tstack-help`.
