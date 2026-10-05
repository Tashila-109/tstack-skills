# Skill mechanics

What changes when the document is a skill.
Everything else is in [writing for agents](SKILL.md).

## Frontmatter

A skill has frontmatter with `name`, matching its directory, and `description`.
An agent-only skill that humans never type carries `metadata.internal: true` and `user-invocable: false`, which hides it from Claude Code's slash menu; Pi and Codex ignore that field.
A project's own skill conventions, such as those in its `AGENTS.md`, take precedence.

## Invocation

A model-invoked skill keeps its description in the agent's context, so the agent and other skills can reach it and the human can still type its name.
The description is its always-loaded pointer; write it for the model, with its trigger branches.

A user-invoked skill sets `disable-model-invocation: true`.
Only the human can invoke it, and it costs no context load.
Its description is a one-line summary for the human.
Codex is the exception: it ignores that field and reads `policy.allow_implicit_invocation: false` from the skill's `agents/openai.yaml`, so without that file the skill stays model-invocable on Codex.

Make a skill model-invoked only when the agent or another skill must reach it on its own.
To send the agent to a user-invoked skill from a playbook or another skill, link its `SKILL.md`; the agent reads the file instead of invoking the skill.

Reference that two user-invoked skills both need belongs in a plain file both can point at, since neither can load the other.

## Splitting by invocation

Split off a model-invoked skill when a distinct word in your prompts should trigger it, or when another skill must reach it.
The new description is permanent context load, so the independent reach must be worth it.

## Routers

When user-invoked skills pile up past what the human remembers, one router skill can name the others and when to use each.
It can suggest them but cannot load them for the human.
