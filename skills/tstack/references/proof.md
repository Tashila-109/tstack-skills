# Proof

A ship task ends with proof on the real surface, written to `evidence/verify.md`.
The proof is for the human.
It shows the work is correct and does what they asked, and it takes less time to review than the diff.
This file owns the proof's shape.
The project's `verify-*` skill owns how to launch, drive and capture.

## Run it

- Drive the change the way a user reaches it, with the project's `verify-*` skill.
  When the project has none and the change has a UI, CLI or service surface, run **create-verification-skill** first.
- Write one claim per acceptance criterion: the task's finish, then each criterion from the brief or spec.
- Trust a check only after you have seen it fail.
  Before you rely on a new assertion, break its condition once and watch it go red.
- After a repair, rerun the claims the repair could change.
  Run every claim once on the final head.

## Permission to test

When the human started the task with "full send" or "full stop", that request is the permission for the test methods the proof needs.
It replaces a project rule that says to ask before a method or to leave testing to the human, such as computer use, browser automation, simulators and devices, running the app or a dev server, and screenshots.
Rules about how to test still hold, such as the right command, fixture or check.
The permission covers only this task's proof.
It never covers production, data deletion, or a tool approval your harness shows.
Name each method you used in `evidence/verify.md`.

## Write it

`evidence/verify.md` opens with the head SHA it proves, then one table:

| Claim | Action | Evidence | Verdict |
| --- | --- | --- | --- |
| Archiving hides the note from the list | Archive `Quarterly plan` from its menu | `evidence/proof/archived-list.png` shows the list without it | passed |

- **Claim** is one criterion, in the human's words.
- **Action** is what a user does, with the command when it is not obvious.
- **Evidence** cites a file under `evidence/` and says in a few words what it shows.
  It can be a screenshot, a recording, a terminal transcript, a response body, or a read-back of stored data.
- **Verdict** is `passed`, `failed` or `blocked`.
  A blocked claim names what is missing, such as a locked screen, an OS permission or an expired login, and what the human must do about it.
  An inconclusive or partial run, or one on a different surface, is never `passed`.

Copy only the artifacts the table cites into `evidence/proof/`, at most 12, each the clearest view of its claim.
Raw run output stays where the verify skill writes it.
Give its folder once, below the table.
Then list what no agent could prove, such as native key delivery or a system dialog, and say whether the human should check it.

`tstack.mjs check` refuses a `verify.md` that cites no file under `evidence/`, or cites one that is missing or empty, unless it holds a `skip: <reason>` line.

## Show it

At Finish, show the human the table and its images, not a path to them.
- On T3, publish `verify.md` with its images inlined as a page with `html_render`.
- With `pr` delivery, the PR's `## Verification` bullets come from the table, and the screenshots go in the PR body when the forge accepts them.
- Elsewhere, put the table in the reply and give the absolute path of `evidence/proof/`.
