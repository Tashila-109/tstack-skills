# Migrating a project from tstackv2

This guide moves a project that tstackv2 set up onto tstack-skills.
tstack-skills reads the project's backlog and learnings as they are.
What changes is where the skills come from, and one section of the project's `AGENTS.md`.

## Before you start

Finish or park every tstackv2 task that is still running in the project.
Its worktrees live under `~/.tstack/worktrees/<project>/`.
tstack-skills never touches them, and never deletes a worktree whose work has not landed.
To keep a tstackv2 task going, reinstall tstackv2 from its clone with `bun <clone>/bin/tstack install`, finish the task, and remove it again.

## 1. Remove tstackv2's global installs

Do this once per machine, not per project.
tstackv2 installed:
- a Claude Code plugin and marketplace, both named `tstack`;
- a Codex plugin and marketplace, both named `tstack`;
- one link per skill in `~/.pi/agent/skills` and in `~/.config/devin/skills`, each pointing into the tstackv2 clone;
- the Pi extensions `tstack.ts`, `tstack-header`, `tstack-footer` and `tstack-shared` in `~/.pi/agent/extensions`;
- the Grok hook `~/.grok/hooks/tstack-worker-git.json`;
- the launcher `~/.tstack/bin/tstack`.

Remove them:

```sh
claude plugin uninstall tstack@tstack && claude plugin marketplace remove tstack
codex plugin remove tstack@tstack && codex plugin marketplace remove tstack
```

Then delete the Pi and Devin links that point into the tstackv2 clone, the Pi extensions, the Grok hook and the launcher.
Leave `~/.tstack/worktrees/` alone.

Restart every agent session that had tstackv2 loaded.
Until then, its hooks call the removed launcher and fail.

## 2. Install tstack-skills

```sh
npx skills add Tashila-109/tstack-skills -g -a claude-code codex pi -y
```

## 3. Set up the project

Start your agent in the project and run `/tstack-setup` (`$tstack-setup` in T3 or Codex, `/skill:tstack-setup` in Pi).

Setup finds the tstackv2 section in `AGENTS.md`, the one that says main runs `tstack session-start`, and offers to remove it.
That section sends main to a CLI that no longer exists, so remove it.
It is a tracked file, so setup changes it only on your word and leaves the commit to you.

Setup also notices tstackv2's tracked `.tstack/config.json` and `.tstack/matrix.json`.
tstack-skills does not read them.
Delete them when you like, in their own commit.
Your model choices now live in `~/.tstack/models.md`, which setup writes.

## What carries over

| tstackv2 file | In tstack-skills |
| --- | --- |
| `.tstack/backlog.md` | Read by main as it is. New lines use `- <id>: <summary>`. |
| `.tstack/learnings.md` | Copied into every new brief, as before. |
| `.tstack/tasks/<id>/` | Kept as history. A new task cannot reuse an old ID. |
| `.tstack/config.json`, `.tstack/matrix.json` | Not read. Setup's models file replaces the matrix. |
| `.gitignore` lines for `.tstack/...` | Still valid. Setup also adds `/.tstack/` to `.git/info/exclude`. |

## What is different

- Start main with `/tstack`, `$tstack` or `/skill:tstack`.
  There is no `tstack session-start`.
- On Herdr, nothing watches leads in the background.
  A lead reports when it finishes or needs you, and you can ask main where any task stands.
- Main never answers a tool approval for a lead.
  An approval prompt appears in the lead's own pane or thread, for you to answer.
