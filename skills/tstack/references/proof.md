# Proof

A ship task ends with proof on the real surface, written to `evidence/verify.md`.
The proof is for the human.
It shows the work is correct and does what they asked, and it takes less time to review than the diff.
This file owns the proof's shape.
The project's `verify-*` skill owns how to launch, drive and capture.

## Run it

- Drive the change the way a user reaches it, with the project's `verify-*` skill.
  When the project has none and the change has a UI, CLI or service surface, run **create-verification-skill** first.
- Take the lock for a shared surface first, as [Shared resources](dispatch.md#shared-resources) says.
- Write one claim per acceptance criterion: the task's finish, then each criterion from the brief or spec.
- Trust a check only after you have seen it fail.
  Before you rely on a new assertion, break its condition once and watch it go red.
- For a change to a screen, capture that screen on the base too, so the proof can show it before and after.
  A screen the change adds has no base: show it after only, and say in its row that it is new.
- After a repair, rerun the claims the repair could change.
  Run every claim once on the final head, or reuse its earlier pass as [Budget](#budget) says.

## Budget

Every repair round runs the proof again, so a slow proof costs the human time on each round.

- Run the checks most likely to fail and the cheapest checks first, and the long live proof last.
  A perf guard, a type check or a lint that the change could break runs before the full drive, so its failure costs minutes instead of the whole proof.
- Reuse a claim that passed on an earlier commit when nothing it reads has changed since.
  Name the paths it reads, such as its source folder, its tests and the lockfile.
  Record the comparison in its Evidence cell as the command `git diff --quiet <passed SHA> <head SHA> -- <paths>`, which exits 0 when those paths are the same in both commits.
  `tstack.mjs check --head` runs that command again against the head and refuses the proof when the paths differ.
  It splits the paths on spaces, so prove a claim that reads a path with a space again instead of reusing it.
  A live claim reads everything that builds into the app, so name all of it.
- After each verified phase, and once the proof passes on the final head, delete the raw run output under the task folder that no decision, `evidence/verify.md` or `report.md` names, such as the recordings, traces and logs of earlier rounds.
  The files in `evidence/proof/` and the final run's folder stay.
  This deletes only output that this task's own runs wrote.
  The final head has the base branch merged in, as the cross-model review in [Opening a PR](../playbooks/opening-a-pr.md) says.

## Permission to test

A task under the router's [full stop or full send](../SKILL.md#autonomy) carries the permission for the test methods the proof needs.
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
A proof against a design keeps one side-by-side for each row that shows a screen, however many rows it has.
Raw run output stays where the verify skill writes it.
Give its folder once, below the table.
Then list what no agent could prove, such as native key delivery or a system dialog, and say whether the human should check it.

`tstack.mjs check` refuses a `verify.md` that cites no file under `evidence/`, or cites one that is missing or empty, unless it holds a `skip: <reason>` line.
It also refuses a table row whose verdict is `failed`: repair the claim and prove it again, or ask the human.

## Prove against a design

A brief with a `Design source:` line names the design the change must match, such as a Figma link or a design file.
Prove the change against that design, not only against the brief's words.

- Before you run anything, write the table's Claim and Action columns as the scenario matrix.
  Give each screen the design shows a row for each state the design or the brief names, such as empty, loading, error, long content and a narrow window.
  Then add a row for each edge case you find in the code.
- For each row that shows a screen, export the matching frame from the design source, and capture the built screen in the same state at the same size.
  Join the two into one image with the design on the left, such as with `magick design.png built.png +append side-by-side.png`, and cite that image in the row's Evidence cell.
  A row for a criterion with no screen, such as who may call an API, cites the evidence that proves it, such as the response body.
- A state the brief names that the design has no frame for still gets a row: capture the built screen alone, cite it, and name the missing frame below the table, so the human can ask the designer for it.
- Name each place the built screen departs from the design on purpose, and why, below the table.

`tstack.mjs check` refuses a proof against a design while a row cites no file under `evidence/`, unless its verdict is `blocked` or `verify.md` holds a `skip:` line.

## Show it

At Finish, show the human the table and its images, not a path to them.
- On T3, publish `verify.md` with its images inlined as a page, following the [t3-visual skill](../../t3-visual/SKILL.md).
- With `pr` delivery, the PR's `## Verification` bullets come from the table.
  The PR body shows the images too, attached as [Opening a PR](../playbooks/opening-a-pr.md) says: each changed screen before and after, a new screen after only, a removed screen before only with what shows it is gone, such as the updated navigation, or a design proof's side-by-sides, and a recording when the change is motion or timing.
- Elsewhere, put the table in the reply and give the absolute path of `evidence/proof/`.
