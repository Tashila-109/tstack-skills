# MISSION.md format

`MISSION.md` sits at the workspace root and says why the human is learning the topic.
Every choice of lesson, source, and exercise traces back to it.

```md
# Mission: {Topic}

## Why

{One to three sentences on the real-world outcome the human is after: what changes in their work or life once they have this skill.}

## Success looks like

- {Something specific and observable the human will be able to do}

## Constraints

- {Time, budget, commitments, or learning preferences that bound the approach}

## Out of scope

- {Nearby topics the human does not want to chase yet}
```

## Rules

- One mission per workspace; two unrelated topics are two workspaces.
- Name a concrete outcome: "ship a Rust CLI to my team" beats "learn Rust".
- If the human cannot say why, interview them before writing anything.
  A bad mission steers worse than none.
- Keep it to one screen; past that it has become a plan.
- When the goal moves, update the file after the human confirms, so a stale mission never steers a session.
