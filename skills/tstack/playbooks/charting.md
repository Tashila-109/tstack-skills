### Charting

**You own charts the reader can trust.**
**Frame, map, draw, prove, show.**

The **chart** skill owns how a chart is written, checked and rendered.
This playbook adds the task around it: a map of the code before drawing, and a reviewer who did not draw the chart.
Brief it as a scout when the charts stay in the task folder, and as a ship task when the human wants them in the repo.

1. **Frame.** Run the chart skill's steps 1 and 2.
   Write each chart's reader, question and Mermaid type to `evidence/frame.md`, and say whether each one is a code or a design chart and whether it goes in the repo.
   Artifact: `evidence/frame.md`
2. **Map.** Find the parts and flows that answer each question, with the file and line of each.
   For a large system, delegate the reading on the `how explorer` seat, one worker per area, each returning its parts and flows with `path:line` citations.
   For a design chart, map the existing code it builds on.
   Write the map to `evidence/map.md`, and name the commit you read it at.
   Artifact: `evidence/map.md`
3. **Draw.** Run the chart skill's steps 3 to 5 from the map.
   Keep the charts in `charts/` in the task folder, or in the task's worktree when they go in the repo.
   Paste the `chart.mjs check` output to `evidence/check.md`.
   Artifact: `evidence/check.md`
4. **Prove.** Delegate one worker on the `verify` seat that did not draw the charts.
   Its brief gives the chart files and the repo root, and asks it to read each citation and report every box and arrow as holds, wrong, or unclear, with the reason for each part that does not hold.
   For a design chart, it checks the cited existing parts and that every proposed part is drawn as proposed.
   It also names the commit it read, as `git rev-parse HEAD` prints it.
   Fix every part it reports wrong or unclear, and run the check again.
   Name the worker's result and its commit in `evidence/review.md`, with what you fixed.
   Artifact: `results/chart-review.md`, `evidence/review.md`
5. **Render.** Run the chart skill's step 7, with the theme the human asked for or `clean`.
   On T3, also render with `--theme t3`, and show each page with the t3-visual skill.
   Write each SVG and page path to `evidence/render.md`.
   Artifact: `evidence/render.md`
6. **Deliver.** For a scout, the charts stay in the task folder.
   For charts in the repo, run the chart skill's step 8 with the commit the reviewer read in step 4, then commit the `.mmd` and SVG files on the task branch.
   With `pr` delivery, run **Opening a PR**.

**Reply:** each chart as a `mermaid` block with its question and SVG path, the parts each chart leaves out, the proposed parts, and the review result. For charts in the repo, the `stale` command.
