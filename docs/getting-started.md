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
2. In the new thread, choose Claude as the provider, and set the permission mode to **Full access**.
   Main needs full access to start leads in their own worktrees.
3. Pin the thread, so T3 never settles it while tasks run.
4. Send:

   ```text
   $tstack-setup
   ```

5. Answer setup's questions.
   It asks for a budget, then shows every role with its harness, model and effort.
   Accept the roles, or change any you lack access to.

Setup writes `~/.tstack/models.md` and adds `.tstack/` to the project's `.git/info/exclude`.
It never changes a tracked file.

### Run the task

Send:

```text
$tstack `node greet.mjs Ada` prints "Hello, undefined". Repro first, then fix it. Done means `node greet.mjs Ada` prints "Hello, Ada" and a test covers it.
```

Main picks the Bug fix playbook, writes the brief, and starts a lead.
A new thread named `<task id> lead` appears in the sidebar.
It runs in its own worktree on branch `task/<task id>`.

Watch the lead thread if you like.
It copies the playbook's steps into its todo list, reproduces the bug, and traces the cause.
It then delegates the fix to a worker.
The worker shows up as a child of the lead, on the model your `bug-fix` role names.

When the lead finishes, it messages main.
Main tells you what was broken, how it was fixed and proved, and asks whether to merge.

### Merge

Reply:

```text
merge it
```

Main fast-forwards `main` to the task branch.
Check:

```sh
node greet.mjs Ada
git log --oneline
```

It prints `Hello, Ada`, and the log shows the lead's commits on top of yours.

## Part 2: on Herdr

Reset the scratch project so the bug is back:

```sh
cd ~/tstack-scratch
git reset --hard "$(git rev-list --max-parents=0 HEAD)"
```

### Start main

1. Open a Herdr pane at `~/tstack-scratch`.
2. Start Claude Code in it: `claude --permission-mode auto`.
   Main runs many small shell commands, and auto mode spares you approving each one.
   Plain `claude` works too, if you approve them as they come.
3. If you skipped Part 1, run `/tstack-setup` and answer its questions.

### Run the task

Type:

```text
/tstack `node greet.mjs Ada` prints "Hello, undefined". Repro first, then fix it. Done means `node greet.mjs Ada` prints "Hello, Ada" and a test covers it.
```

Main names its pane `main-tstack-scratch`, cuts a worktree under `~/.tstack/worktrees/tstack-scratch/`, and opens a new Herdr tab for the lead.
The lead's workers open as panes beside it.
If a new agent stops on a trust dialog, answer it yourself in that pane.
tstack never answers one.

The lead reports back after a few minutes.
The tutorial's task took about 6 when this guide was last checked.
Main then asks whether to merge.
Reply `merge it`, then check `node greet.mjs Ada` again.
Main closes the lead's tab and removes its worktree after the merge.

## See what the lead left behind

Every task keeps its record in the project's `.tstack/tasks/<task id>/`:

```sh
ls ~/tstack-scratch/.tstack/tasks/*/
ls ~/tstack-scratch/.tstack/tasks/*/evidence/
```

You find:
- `brief.md`: the goal, the finish, and the playbook steps the lead copied into its todo list;
- `evidence/repro.md`, `mechanism.md`, `fix.md`, `verify.md`, `red-green.md` and `closing-pass.md`: one file per Bug fix step, each read by the step after it;
- `report.md`: the lead's final report, with the principles it applied and any lessons for later tasks.

`node ~/.agents/skills/tstack/scripts/tstack.mjs check <task id>` passed on this folder before the lead could report done.

## Install into one project

To keep tstack out of your global skills, run the install from inside a project, without `-g`:

```sh
cd ~/tstack-scratch
npx skills add Tashila-109/tstack-skills -a claude-code codex pi -y
```

The skills land in the project's `.agents/skills`, `.claude/skills` and `.pi/skills`, with a `skills-lock.json`.
`tstack-setup` excludes those paths through `.git/info/exclude`, so Git ignores them without a tracked change.

A new worktree does not contain ignored files, so leads need the skills linked in:
- on Herdr, main runs `tstack.mjs link-skills <worktree>` for each lead;
- on T3, setup asks you to add a project action under Settings, then Project, then Actions, which runs on every new worktree.

## Next

- [T3 Code](runtimes/t3.md) and [Herdr](runtimes/herdr.md) explain what each runtime shows and how to check on a quiet lead.
