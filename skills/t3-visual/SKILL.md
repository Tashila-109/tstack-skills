---
name: t3-visual
description: Show a visual inline in a T3 Code thread with T3's html_preview and html_render tools, such as a chart of numbers, a diagram from the chart skill, a before and after, a mockup, a comparison table, or a page of evidence. Use on T3 whenever a picture answers faster than words, whenever numbers have a trend or a comparison, and for /t3-visual.
---

# T3 visual

On T3, a reply can carry a page above it.
The page is a self-contained HTML document that T3 draws in the thread with the thread's own colors, in light and dark.
`html_preview` draws a page off screen and returns a screenshot, the console output and the page's height.
`html_render` shows the page in the thread.
Their tool descriptions own the layout and theme rules, so read them before you build the first page.
Without these tools you are not on T3, so write the page to a file, give its absolute path, and put what it shows in the reply.

## 1. Decide what to show

Show a page when it answers faster than text:

| What you have | What to show |
| --- | --- |
| Numbers with a trend or a comparison, such as timings before and after a change | A bar, line or dot chart |
| A system, a data flow, a request path or a data model | A chart from the [chart skill](../chart/SKILL.md) |
| A change to a UI or a layout | Before and after screenshots side by side, or a mockup |
| Options to compare on several points | A table, with the deciding cells marked |
| Verification results with screenshots | An evidence page, as [proof.md](../tstack/references/proof.md) asks |

A single number, a short list, or a fact needs no page.
Show one idea per page, and show the pages in the order the reader needs them.

## 2. Build the page

Write the page to a file first.
In a tstack task, put it in the task's `evidence/` folder.
Elsewhere, put it in a scratch folder outside the repo.
The file lets you cite the page, show it again, and hand it from a worker to its lead.

- Inline every style and script, and draw charts as inline SVG.
  A library from a CDN loads as-is, so the page breaks when that URL changes or the network is off.
- Take every color from T3's theme variables, such as `--foreground`, `--muted-foreground`, `--border`, and `--chart-1` to `--chart-6` for data series, so the page reads in both light and dark.
- Give a local image as a `data:` URI, so the page file carries it, or by its absolute path, which `html_preview` inlines.
- Label each axis with its unit, start a bar chart's axis at zero, and label each series beside its line or bar when there are four or fewer.
- Give the question the page answers to `html_render` as its title, and leave the page itself without a banner title.

For a chart from the chart skill, run `chart.mjs render <chart.mmd> --theme t3`.
It writes `<name>.html` beside the chart, a page that draws the chart in the thread's colors.

## 3. Preview it

Pass the page to `html_preview` with `appearance: "dark"`, then again with `appearance: "light"`.
If it says the browser is still installing, call it again in a minute.
Look at each screenshot for clipped or overlapping text, labels too faint to read, and empty space.
Fix every error the console output lists.
Check it at `width: 390` too when the page has a wide table or side-by-side images, because a phone shows the thread at about that width.
The step is done when both screenshots read correctly and the console shows no errors.

## 4. Show it

Call `html_render` with the page, its title, and the `contentHeight` that `html_preview` returned as its height.
The reply says what the page means, the conclusion or the decision it supports, and never describes or repeats the page.

## A running app

To show a web app or a simulator as it runs, follow [Proving on the real surface](../tstack/references/runtime-t3.md#proving-on-the-real-surface).
Use T3's browser and device tools only when the request or the project's verify skill asks for that work, and close each preview tab you opened.
A screenshot you saved from them goes into a page by its absolute path.

## In a tstack task

A worker's `html_render` shows only in the worker's own thread, which the human may never open.
So a worker writes its page to the task folder and returns the path, and the lead previews and shows it.
A PR body or a message to another service takes a file, such as a PNG screenshot, not a page.
