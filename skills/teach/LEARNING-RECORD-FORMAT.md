# Learning record format

Learning records are the workspace's ADRs.
Each one records a non-obvious thing the human now knows, or already knew, and why it changes what to teach next.
Together they locate the zone of proximal development.

Records live in `learning-records/`, named `0001-slug.md`, `0002-slug.md`, one past the highest existing number.

```md
# {What was learned or established}

{One to three sentences: what the human now knows, and why it matters for later sessions.}
```

One paragraph is a complete record.
Add these only when they carry weight:

- `Status: active` or `Status: superseded by 0007`, when a later record replaces this one.
- **Evidence**: how the human showed it, such as a question answered or an exercise done.
- **Implications**: what it unlocks or rules out, when that is not obvious.

## When to write one

- The human showed they can use a non-trivial concept correctly; this raises the floor for the next lesson.
- The human stated prior knowledge; record how deep they claimed it goes, so no session reteaches it.
- A misconception was corrected; these predict stumbles on related topics.
- The mission moved; update `MISSION.md` too.

Skip material that was only covered, since coverage is not learning.
Skip anything `GLOSSARY.md` already holds as a definition.
Skip session logs.

When a later record contradicts an earlier one, mark the earlier one superseded instead of deleting it; how the understanding changed is itself signal.
