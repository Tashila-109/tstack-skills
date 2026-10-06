---
name: teach
description: Teach the human a topic over several sessions, in a workspace that keeps their mission, sources, lessons, and learning records. For one explanation of code in front of you, use `explain`.
disable-model-invocation: true
argument-hint: "What do you want to learn?"
---

# Teach

The human wants to learn a topic over several sessions.
The workspace files carry what they have learned from one session to the next.
Each session teaches one lesson the human is ready for, then writes down what changed.

## Workspace

The current directory is the teaching workspace, for one topic.
Create each file or directory when it first has content.

| Path | Holds | Format |
| --- | --- | --- |
| `MISSION.md` | why the human is learning this topic | [mission format](MISSION-FORMAT.md) |
| `RESOURCES.md` | trusted sources and communities | [resources format](RESOURCES-FORMAT.md) |
| `GLOSSARY.md` | the workspace's terms | [glossary format](GLOSSARY-FORMAT.md) |
| `learning-records/NNNN-slug.md` | what the human has shown they know | [learning record format](LEARNING-RECORD-FORMAT.md) |
| `lessons/NNNN-slug.html` | one lesson per file | [Lessons](#lessons) |
| `reference/<name>.html` | compressed material for quick review | [Reference](#reference) |
| `assets/` | components that lessons share | [Lessons](#lessons) |
| `NOTES.md` | how the human likes to be taught, and your working notes | free form |

Number lessons and learning records from `0001`, one past the highest existing number.

## Each session

1. Read whichever of `MISSION.md`, `NOTES.md`, `GLOSSARY.md`, the learning records, and `assets/` exist.
   Done when you can name the mission and what the human already knows, or know the workspace is new.
2. If `MISSION.md` is missing or vague, interview the human about why they want to learn this, and write it before teaching anything.
   Done when the mission names a concrete outcome.
3. If `RESOURCES.md` does not yet cover what the next lesson needs, search for high-trust sources and add them.
   Done when every claim the lesson will make has a source to cite.
4. Pick the lesson.
   Teach what the human asks for; otherwise pick the next thing the mission needs that sits in their zone of proximal development: just past what the learning records show they know.
5. Write the lesson, then open it with `open` on macOS or `xdg-open` on Linux.
6. Answer the human's follow-up questions in the session.
7. Write down what the session showed.
   Done when every demonstrated understanding, stated prior knowledge, corrected misconception, settled term, and teaching preference is in a learning record, `GLOSSARY.md`, or `NOTES.md`.

Change `MISSION.md` only after the human confirms the new mission, and write a learning record saying why it moved.

## How people learn

Learning a topic in depth takes three things:

- **Knowledge**, from high-trust sources.
- **Skills**, from lessons that make the human practice the knowledge.
- **Wisdom**, from practicing with other people outside the workspace.

Some topics lean on knowledge, such as physics; others lean on skills, such as yoga.

Aim for storage strength, not fluency.
Fluency is recall in the moment, and it feels like mastery before it is.
Storage strength is recall weeks later, and it comes from desirable difficulty: retrieval practice, spacing, and, for skills only, interleaving related topics.

Difficulty works in opposite directions for the two:

- For knowledge, difficulty eats the working memory the human needs to understand, so keep the explanation easy.
- For skills, effortful retrieval is what builds storage strength, so make the practice hard enough to need it.

## Lessons

A lesson is one self-contained HTML file that teaches one tightly scoped thing tied to the mission.

- Keep it short enough to finish quickly, since working memory is small.
  End it on one tangible win the human can build on.
- Teach only the knowledge the target skill needs, then make the human practice it.
- Give practice a tight feedback loop, immediate and ideally automatic: a quiz, a small in-browser task, or a checklist of real-world steps.
- Write every quiz answer at the same length and format, so nothing but knowledge picks the right one.
- Cite a source from `RESOURCES.md` for every claim, and recommend one primary source to read or watch next.
- Link related lessons and reference documents.
- Remind the human to bring their questions back to you.
- Make it beautiful: clean typography, a calm layout in the spirit of Tufte, and a clean printout.

Build lessons from `assets/`.
Read it before writing a lesson and reuse what is there.
The first component a workspace earns is a shared stylesheet that every lesson links, so the lessons read as one course.
Put anything a second lesson could reuse, such as a quiz widget, a simulator, or a diagram helper, in `assets/` and link it instead of inlining it.

## Reference

Lessons are rarely reread; reference documents are.
A reference document holds the compressed essence of one or more lessons, laid out for quick lookup: syntax and snippets, an algorithm or flowchart, a sequence of poses, a training routine.
Write one when a lesson produces something the human will want to look up again.
Terms go in `GLOSSARY.md`, and every lesson uses its words.

## Wisdom

When a question needs judgment from practice, answer what you can, then point the human at a community from `RESOURCES.md`: a forum, a moderated subreddit, a class, or a local group.
Look for communities with a strong reputation.
If the human has said they do not want to join one, `RESOURCES.md` records that, and you stop suggesting them.

## In a tstack project

Teach writes its own files, so it runs in a session started in the workspace directory, outside any tstack task.
Keep the workspace out of project checkouts and `.tstack/`: lessons and learning records are not project files.
A lead or worker writes only its task's scope, and a coordinator writes only under `.tstack/`, so none of them runs teach.
To learn a codebase, keep the workspace elsewhere and use `explain` for the code in front of you.
