---
name: chart
description: Draw a system as a Mermaid chart that cites the code behind each box and arrow, then check it and render it to themed SVG. Use for /chart, "draw", "diagram" or "map out" a system, an architecture, a data flow, a request path, a lifecycle or a data model, and for sketching a design before it is built.
---

# Chart

A chart answers one question for one reader, such as "where does an upload go after the API accepts it?".
Every box and arrow in a chart of existing code cites the file and line that make it true, so the reader can trust it and a later agent can tell when it went stale.
`chart.mjs` means `node <this skill's directory>/scripts/chart.mjs`, and its header lists its commands.

## 1. Name the reader and the question

Write down who reads the chart and what they will decide or understand from it.
A question too broad for one chart, such as "how does the whole app work?", becomes a set of charts at different zoom levels: the system and its neighbors, then the services inside it, then the modules inside one service.
The step is done when each planned chart has one question.

## 2. Pick the chart type

| The question | Mermaid type |
| --- | --- |
| What talks to what, and across which boundaries? | `architecture-beta`, or `C4Context` and `C4Container` |
| Where does data go, step by step? | `flowchart` with a `subgraph` per service or layer |
| What happens, in order, on one request or job? | `sequenceDiagram` |
| What states does one thing go through? | `stateDiagram-v2` |
| What is stored, and how do the records relate? | `erDiagram` |
| What are the types and who owns whom? | `classDiagram` |

## 3. Write the chart

Write each chart as a `.mmd` file.
Keep it outside the repo, or in the task folder in a tstack task, unless the human asks for it in the repo.

The first line says what the chart shows:
- `%% chart: code` maps code that exists;
- `%% chart: design` sketches a system that does not exist yet.

In a code chart, put a comment directly above every line that draws a box or an arrow, with no blank line between them:
- `%% src: <path>:<line>` cites where it is true, such as `%% src: api/upload.ts:42` or `%% src: api/upload.ts:40-58`;
- cite a folder, such as `%% src: services/billing`, for a box that stands for a whole service;
- list several citations with commas when an arrow joins two files;
- `%% new: <reason>` marks a box or arrow that is proposed and not built yet, and the chart draws each proposed box as proposed, as the classes below say.

Paths start from the repo root.
Cite the line that does the thing, such as the call that sends the message, not an import or a comment.
For a box, cite the line that defines it, or that creates or writes it when it is a file or a store.
A line in a skill or a doc is a fair citation for a step that a person or an agent follows.
Grouping and styling lines, such as `subgraph`, `end`, `class`, `classDef`, notes and the `{ }` attribute lines in an ER or class chart, take no citation.
A design chart needs no `src:` or `new:` comments, but it may cite the existing parts it builds on.
Draw its proposed boxes as proposed, so the reader can tell them from what exists.

Label each box and arrow in the reader's words, such as "Upload API" and "stores the file".
Keep function and variable names out of labels unless the reader works in that code.

Three classes mark meaning, and every theme draws them:
- `focus` is the part the question is about;
- `external` is a system the project does not own, such as a payment provider;
- `proposed` is a part that is not built yet; also add `classDef proposed stroke-dasharray: 6 4`, so that viewers without the theme still show it dashed.

Give a box a class with `class <id> proposed` in a flowchart, a state chart or an ER chart, and with `cssClass "<id>" proposed` in a class chart.
Sequence, C4 and architecture charts take no classes, so end a proposed part's label with "(proposed)" there.

## 4. Keep it readable

Aim for 20 arrows or fewer in one chart.
The check counts the arrows and says when a chart has more than 20.
Above that, split the chart by zoom level or by question, unless the reader needs the whole picture, such as a reference map of every service.
Leave out what does not change the answer, such as logging, retries, or a helper that only passes data through, and say in the hand-off what you left out.
To teach a flow with three or more parts, draw a short series where each chart adds one part to the last.

## 5. Check it

Run `chart.mjs check <chart.mmd>... --root <repo root>`.
It lists each chart's problems in line order.
It refuses a chart with no `chart:` line, a box or arrow in a code chart with no citation, a citation to a path or line that does not exist or that links outside the repo, and Mermaid that Pele cannot draw.
Fix each line it names.
Never delete a citation or mark a built part `new:` to get past it.
The step is done when the check prints `ok` for every chart.

## 6. Prove each arrow

The check proves that each citation exists, not that the cited code does what the arrow says.
Read each cited line and confirm it does what its box or arrow claims.
Confirm also that the citations cover everything the label claims, since a citation to part of the code passes the check.
In a tstack task the [charting playbook](../tstack/playbooks/charting.md) hands this to a reviewer who did not draw the chart.
Fix or remove every part that does not hold, then check again.
The step is done when every part of every code chart holds.

## 7. Render and show it

Run `chart.mjs render <chart.mmd>... --root <repo root> --theme clean`.
It checks again, then writes each SVG next to its `.mmd` file.
`clean` follows the viewer's light or dark setting, `blueprint` draws white lines on blueprint blue, and `t3` takes a T3 thread's colors.
The SVG takes the chart's file name, so to render a second theme, copy the `.mmd` under another name first.
For another look, copy `themes/clean.css`, change its `--pele-*` variables as https://pele.run/theming lists them, and pass the new file to `--theme`.
Keep Pele's default font, because Pele sizes each box for that font and a wider font can overflow it.

Show each chart to the reader as a `mermaid` code block, and give the SVG path.
On T3, also run `render` with `--theme t3`, which writes `<name>.html`, a page in the thread's own colors, and show that page with the [t3-visual skill](../t3-visual/SKILL.md).

## 8. Keep it in the repo

When the human asks for a chart in the repo, put the `.mmd` and its SVG in `docs/diagrams/`, unless the project keeps diagrams elsewhere.
After step 6, add `%% synced: <commit hash>` below the `chart:` line, naming the commit whose code you proved the chart against, as `git rev-parse HEAD` prints it.
`chart.mjs stale <chart.mmd>...` then names each cited file that differs from that commit, committed or not, and each new file in a cited folder.
When it does, prove the chart again against the new code, fix it, and move `synced:` forward.

## Hand off

Give each chart, its question, and its SVG path.
Say what each chart leaves out, and which parts are proposed.
For a chart in the repo, give the `stale` command that tells a later agent when to look again.
