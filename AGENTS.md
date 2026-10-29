# Working on tstack-skills

This repository is the tstack workflow as agent skills: a router, playbooks, engineering skills, principles, and one dependency-free script.
Read [README.md](README.md) to install and use it, and [docs/concepts.md](docs/concepts.md) for why it is built this way.

## Layout

```text
skills/tstack/              the router: roles, rules, intake table, principles index
  playbooks/                one file per kind of work
  references/               dispatch rules, the coordinator, the T3, Herdr and standalone runtimes, the worker preamble
  scripts/                  tstack.mjs (home, brief, check, seat, check-seats, pr-state, exclude, link-skills) and check-plan.mjs, with tests beside them
skills/tstack-setup/        project setup and the models file template
skills/<name>/              every other skill; agents/openai.yaml keeps Codex from invoking it on its own
docs/                       getting started, the guide, runtime guides, concepts and reference
LICENSE.md                  the MIT license and the third-party notices
```

## Rules

- Never name the upstream projects this skill set came from, in any file, file name, branch or commit message.
  Say "upstream" when you must refer to them.
  Keep the third-party notices in `LICENSE.md` as they are: their licenses require them.
  The maintainer's local Git hooks refuse a commit whose files or message name them.
- Scripts own facts and agents own judgment.
  A rule that can be checked exactly belongs in `tstack.mjs`, not in more skill text.
- One owner per rule.
  State it once, in the file that owns it, and link to it from everywhere else.
- Skills that came from upstream keep their wording, so a later upstream change ports with a small diff.
  Change a vendored sentence only to remove a name, retarget a Cursor-only rule, or add an `Artifact:` line or an "In a tstack task" note.
  The playbooks the router marks Adapted or Coordinator's program, `create-verification-skill` and `maintain-verification-skill` are tstack rewrites, so port upstream changes into them by hand.
  New text follows the `unslop` and `technical-writing` skills, one sentence per line.
- Simplest thing that works.
  No abstraction with one implementation and no config for a value that never changes.

## Checks

- `node --test skills/tstack/scripts/*.test.mjs` must pass, and so must `bun test ./skills/tstack/scripts/`.
- After editing a skill, reinstall from this checkout to try it: `npx skills add "$PWD" -g -a claude-code codex pi -y`.
- A claim that something works on a runtime names the date and version it was measured on, in that runtime's reference, not only in a commit message.

## Git

- Commit messages follow Conventional Commits, such as `feat(tstack): ...`.
- Never force-push, and never delete a branch or worktree whose work has not landed.
