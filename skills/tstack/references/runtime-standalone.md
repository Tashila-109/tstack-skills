# Standalone runtime

Use this when you do not run in a T3 Code thread and `HERDR_ENV` is not `1`: any other agent harness, such as Claude Code, Codex, Cursor, OpenCode, Gemini CLI or Pi on its own.
[dispatch.md](dispatch.md) owns the verbs, seats and depth.
This file owns the calls.
Written on 2026-10-28 from the T3 and Herdr references.
On 2026-10-30, Claude Code 2.1.312 ran the getting-started tutorial live: setup writing `inherit` seats, intake's launch-lead into a new session, a bug fix with subagent workers and a same-family final review, `check --head`, the merge and cleanup.
Not yet run live: watch-pr, a candidate's own checkout, notify, and any harness other than Claude Code.

There is no orchestrator here.
Nothing starts an agent for you, and nothing wakes you except the human's next message and your own tool results.
So the human does the steps T3 and Herdr automate, workers run as your harness's own subagents, and the autopilot programs are not available.

`tstack.mjs` means `node <tstack skill directory>/scripts/tstack.mjs`.

## Facts to rely on

- Every worker runs on your own harness and model, whatever seat the models file names.
  This is the exception to dispatch.md's rule against running a seat on another model.
- Seats come from `tstack.mjs seat "<role>" --runtime standalone`, which prints one line per seat, so a panel keeps its size.
  A configured seat prints as `{ "inherit": true, "configured": "<seat>" }`, and an `inherit` seat as `{ "inherit": true }`.
- Your harness may have a subagent tool, such as Claude Code's `Agent` or `Task`, Codex's subagents, Cursor's `Task`, or OpenCode's `task`.
- A role whose seats span model families, such as `review`, `interrogate reviewers` or `architect runners`, runs on one model here.
  Say so in the result and in the report, because the second opinion from a different family is missing.
- `seat review --cross <your model>` prints a seat from another family, or refuses when the line has none.
  Here either outcome means the review runs on your own model: run it, and record it in the review and the report as a same-family review.
- A worker that is itself a subagent usually cannot start subagents of its own.
  It runs a skill's explorers or reviewers in sequence, itself.

## Lead

### Your session

The human starts you in their harness and talks to you there.
If they started you in a worktree, intake's checkout check passes and you go on.

### launch-lead

A lead uses this to move a ship task out of the primary checkout, and to hand off its task to a fresh session.
A coordinator never runs here.

1. From the primary checkout, which must be on the default branch with no uncommitted changes, run `git worktree add ~/.tstack/worktrees/<project>/<id> -b task/<id>`, where `<project>` is the primary checkout's directory name.
   If the primary checkout is on another branch or has uncommitted changes, tell the human what blocks the move, and stop.
   If the primary checkout has a `skills-lock.json`, the skills are installed per project, so run `tstack.mjs link-skills <worktree>` too.
   For a handoff, skip this step: the worktree exists.
2. Write the launch block from dispatch.md to `<home>/tasks/<id>/launch.md`, with `runtime: standalone` and no `coordinator:` line.
3. Tell the human, in one message:
   - that the task moves to the worktree at its absolute path, on `task/<id>`, or for a handoff, that a fresh session takes over in the same worktree;
   - to start a new session of their agent with that path as its working directory and write access to the primary checkout, such as `cd <worktree> && claude --add-dir <primary checkout>` or `cd <worktree> && codex --add-dir <primary checkout>`, plus the permission mode they run this session with, or to open the folder in their editor;
     the lead there writes task records under `<home>` and commits through the primary checkout's `.git`;
   - to send the launch block as that session's first message, shown in full in a fenced block they can copy.
4. Stop.
   This session's part in the task ends here.

### report, notify and hold

A coordinator never runs here, so report and hold do not apply.
To notify another task's lead, write the message to `<home>/tasks/<your id>/notify-<other id>.md`, starting `from <your task id> lead:`, and ask the human to tell that lead to read it.

### delegate

1. Run `tstack.mjs seat "<role>" --runtime standalone`.
   A panel prints one line per seat.
2. Write each worker's brief, per dispatch.md.
3. If your harness has a subagent tool, start one subagent per seat with the filled worker preamble as its prompt.
   Start every independent worker before you wait on any, when your tool can run them in parallel.
4. If it has none, run each brief yourself, one at a time, as that worker would: read only what its brief gives you, do only its scope, and write its result file with its verdict line.
   Name in the result that the worker ran inline in the lead's session, because its eyes were not independent of yours.

### collect

Read each worker's result file and verdict line once its subagent returns.
A subagent that returns without writing its result file gets one from you: `FAILED <the subagent returned no result>`, with what it said.
To stop a running worker, use your harness's own stop for that subagent.

### A candidate that needs its own checkout

Arena and swarm candidates that must build or run code need their own worktree.
Run `git worktree add ~/.tstack/worktrees/<project>/<id>-<name> -b <your task branch>-<name>` from your task worktree, so the candidate starts from your commits, and `tstack.mjs link-skills <that path>` if the skills are installed per project.
Its brief's SCOPE names that absolute path as its checkout, and tells it to run every command there and edit files by absolute path.
Record `git status --porcelain` in your own worktree before, and confirm it is unchanged after you collect.
Remove the worktree once you have taken what you need, and keep its branch.
Design sketches that only write files need no worktree: give each candidate its own directory under `<home>/tasks/<id>/evidence/`.

### Opening a PR

There is no thread to link a PR to.
Give the human the PR's full URL instead.

### watch-pr

Run `tstack.mjs pr-state <pr number> --wait <seconds>`, at most 540.
Run it in the background when your harness wakes you as a background command exits.
Otherwise run it in the foreground, with `--wait` at least a minute below your shell tool's timeout, such as `--wait 540` under a 10-minute cap or `--wait 60` under a 2-minute one.
It checks the PR once a minute and returns as soon as the verdict is anything but `WAITING`, or when the wait runs out.
On `WAITING review-required` or `WAITING approval`, tell the human the PR waits on their review or approval, and end your turn, because polling cannot clear a gate that waits on a person.
Their next message wakes you.
On any other `WAITING`, run it again; a review bot can take half an hour.
On any other verdict, read new review comments with `gh pr view <url> --comments` and act per the babysit playbook.
Never poll with a sleep loop of your own.

### Heartbeat

There is none.
A long run continues only while your turn lasts, or when the human writes.
So an autonomous run keeps working inside its turn instead of ending the turn to wait for a wake.
Before you end a turn with work left, tell the human what is left and what message continues it.

### After the merge

You run inside the task's worktree, so cleaning it up is your last action before the final message.
Run each command with `git -C <primary checkout>`, so your shell never stands in a removed directory.

1. `git -C <primary checkout> worktree remove <your worktree>`.
   It refuses when the worktree has uncommitted changes.
2. Delete the branch only once its work has landed:
   - for `local-only`, `git -C <primary checkout> branch -d <your task branch>`, which refuses unless the merge reached the default branch;
   - for `pr`, once `gh pr view <pr> --json state` shows `MERGED`, `git -C <primary checkout> branch -D <your task branch>`, because a squash or rebase merge leaves the branch's own commits looking unmerged to Git.
3. Tell the human this session can be closed.

A refusal means stop and look, never force.

## Coordinator

The autopilot programs need an orchestrator to start and hold leads.
When intake picks `autopilot-full` or `autopilot-stack` here, tell the human those programs run on T3 Code or Herdr, and stop.
Offer instead to run the queue's items one at a time, each as an ordinary task the human starts with `/tstack` and that item's request.

## Proving on the real surface

Drive a web UI, a CLI or a simulator with the project's `verify-*` skill, or with the browser or device tools your harness has.
Save screenshots and recordings into the task's `evidence/` folder, or the path your brief names, and cite that copy.

## History

Where a skill reads chat history or transcripts, read your harness's own session files for this checkout when it keeps them, such as `~/.claude/projects/` for Claude Code, `~/.codex/sessions/` for Codex, and `~/.pi/agent/sessions/` for Pi.
When it keeps none you can read, say the history was not available.

## Worktrees in use

A worktree is in use while an agent session runs in it.
Nothing here can tell you which sessions are running, so ask the human before you treat a task's worktree as free.

## Worker

Never delegate or launch a lead.
Your final message is your verdict line, and your result file holds the rest.
