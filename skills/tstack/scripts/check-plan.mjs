#!/usr/bin/env node
// Checks the tstack spec checklist, not evidence truth or runtime approval.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const RULE =
	"Tests alone are not sufficient verification. A phase is verified only when its unit, live, and perf boxes are all checked.";
const LANES = "Configured seats from the models file";
const SUB_BLOCKS = [
	"Depends on.",
	"Files.",
	"Build.",
	"You see.",
	"Verify, unit.",
	"Verify, live.",
	"Verify, perf.",
	"Review gate.",
	"Delivery.",
];
const PROGRAM_H3 = [
	"Arm the program",
	"Spawn owners",
	"Delivery boundaries",
	"Verdict and delivery",
	"Boot recipe",
];
const PROGRAM_MARKERS = [
	"design.md",
	"spec.md",
	"granted decision records",
	"execution authorization",
	"lead",
	"human",
	"no Git writes",
];
const HOW_TO_READ_MARKERS = [
	"One box is one unit of work",
	"names the evidence",
	"Check a box only when its evidence exists",
	"playbooks/",
	RULE,
];
const PERF_ITEMS = ["Metric.", "Probe.", "Baseline.", "Rule."];
const BOX = /^\s*- \[[ x]\] (.*)$/;

const file = process.argv[2];
if (!file) {
	console.error("Usage: node check-plan.mjs <plan.md>");
	process.exit(2);
}

let raw;
try {
	raw = fs.readFileSync(file, "utf8").split(/\r?\n/);
} catch (error) {
	console.error(`${file}: ${error.message}`);
	process.exit(2);
}
const problems = [];
const fail = (line, message) => problems.push(`${file}:${line}: ${message}`);

let start = 0;
if (raw[0] === "---") {
	const end = raw.indexOf("---", 1);
	if (end === -1) fail(1, "unclosed frontmatter");
	else start = end + 1;
}

const lines = [];
let fence;
for (let i = start; i < raw.length; i++) {
	const text = raw[i];
	const n = i + 1;
	const opens = !fence && text.match(/^\s*(`{3,}|~{3,})(.*)$/);
	const closes = fence && text.match(/^\s*(`+|~+)[ \t]*$/);
	if (opens && !(opens[1][0] === "`" && opens[2].includes("`"))) {
		lines.push({ n, text, code: true });
		fence = opens[1];
		continue;
	}
	if (closes && closes[1][0] === fence[0] && closes[1].length >= fence.length) {
		lines.push({ n, text, code: true });
		fence = undefined;
		continue;
	}
	lines.push({ n, text, code: !!fence });
	if (fence) continue;
	if (/(?<![\w:])<[^>]+>/.test(text)) fail(n, "unfilled placeholder");
	const prose = text
		.replace(/`[^`]*`/g, "`")
		.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
		.replace(/\]\([^)]*\)/g, "]");
	if (/[\u2013\u2014]/.test(prose)) fail(n, "long dash");
	if (/[\u2018\u2019\u201c\u201d]/.test(prose)) fail(n, "curly quote");
	if (/: \S/.test(prose)) fail(n, "mid-sentence colon");
}

if (fence) fail(raw.length, "unclosed code fence");

const h2 = (l) =>
	!l.code && l.text.startsWith("## ") ? l.text.slice(3).trim() : null;
const sections = [];
for (const l of lines) {
	const title = h2(l);
	if (title !== null) sections.push({ title, n: l.n, body: [] });
	else if (sections.length) sections.at(-1).body.push(l);
}
const find = (title) => sections.find((s) => s.title === title);
const bodyText = (s) =>
	s.body
		.filter((l) => !l.code)
		.map((l) => l.text)
		.join("\n");
const boxes = (ls) =>
	ls
		.filter((l) => !l.code && BOX.test(l.text))
		.map((l) => ({ n: l.n, text: l.text.match(BOX)[1] }));

const h1 = lines.findIndex((l) => !l.code && l.text.startsWith("# "));
if (h1 === -1) fail(1, "no H1 title");
const howToRead = find("How to read this");
if (!howToRead) fail(1, 'no "## How to read this" section');
if (h1 !== -1 && howToRead) {
	const intro = lines
		.slice(h1 + 1)
		.filter((l) => l.n < howToRead.n && l.text.trim() !== "");
	if (intro.length >= 10)
		fail(lines[h1].n, `intro is ${intro.length} lines, under ten required`);
	for (const marker of HOW_TO_READ_MARKERS) {
		if (!bodyText(howToRead).includes(marker))
			fail(howToRead.n, `How to read this lacks "${marker}"`);
	}
}

const program = find("Program checklist");
if (program) {
	const h3s = program.body
		.filter((l) => !l.code && l.text.startsWith("### "))
		.map((l) => l.text.slice(4).trim());
	let cursor = 0;
	for (const name of PROGRAM_H3) {
		const at = h3s.findIndex((t, i) => i >= cursor && t.startsWith(name));
		if (at === -1)
			fail(program.n, `Program checklist lacks "### ${name}" in order`);
		else cursor = at + 1;
	}
	for (const marker of PROGRAM_MARKERS) {
		if (!bodyText(program).includes(marker))
			fail(program.n, `Program checklist lacks "${marker}"`);
	}
} else fail(1, 'no "## Program checklist" section');

const close = find("Close the program");
if (!close) fail(1, 'no "## Close the program" section');
const programIndex = sections.indexOf(program);
const closeIndex = sections.indexOf(close);
const phaseSections =
	programIndex === -1 || closeIndex === -1
		? []
		: sections.slice(programIndex + 1, closeIndex);
if (phaseSections.length === 0)
	fail(1, "no phase sections between Program checklist and Close the program");

const report = [];
for (const phase of phaseSections) {
	const heads = [];
	for (const l of phase.body) {
		if (l.code) continue;
		const m = l.text.match(/^\*\*([^*]+)\*\*(.*)$/);
		if (m && SUB_BLOCKS.includes(m[1]))
			heads.push({ name: m[1], n: l.n, rest: m[2].trim(), lines: [] });
		else if (heads.length) heads.at(-1).lines.push(l);
	}
	const names = heads.map((h) => h.name);
	if (names.join("|") !== SUB_BLOCKS.join("|")) {
		fail(
			phase.n,
			`${phase.title}: sub-blocks are [${names.join(", ")}], expected [${SUB_BLOCKS.join(", ")}]`,
		);
	}
	const block = (name) => heads.find((h) => h.name === name);
	const counts = {};
	for (const h of heads) counts[h.name] = boxes(h.lines).length;

	const depends = block("Depends on.");
	if (depends && depends.rest === "")
		fail(depends.n, `${phase.title}: Depends on names nothing`);
	for (const name of [
		"Files.",
		"Build.",
		"You see.",
		"Verify, unit.",
		"Delivery.",
	]) {
		const b = block(name);
		if (b && boxes(b.lines).length === 0)
			fail(b.n, `${phase.title}: ${name} has no box`);
	}
	for (const name of ["Verify, unit.", "Verify, live.", "Verify, perf."]) {
		const b = block(name);
		if (b && !b.rest.startsWith(RULE))
			fail(b.n, `${phase.title}: ${name} does not open with the rule`);
	}

	const live = block("Verify, live.");
	if (live) {
		if (!live.rest.includes(LANES))
			fail(live.n, `${phase.title}: Verify, live lacks "${LANES}"`);
		const lanes = boxes(live.lines).map((b) => ({
			...b,
			m: b.text.match(/^Lane (\d+)\. /),
		}));
		const numbers = lanes
			.filter((b) => b.m)
			.map((b) => Number(b.m[1]))
			.sort((a, b) => a - b);
		if (numbers.length === 0 || numbers.some((n, i) => n !== i + 1))
			fail(
				live.n,
				`${phase.title}: lanes must be numbered consecutively from 1`,
			);
		if (!lanes.some((b) => b.text.includes("Regression lane against trunk")))
			fail(live.n, `${phase.title}: no regression lane against trunk`);
		for (const lane of lanes) {
			if (!lane.m) fail(lane.n, `${phase.title}: live box is not a lane`);
			else if (!/Save `[^`]+`/.test(lane.text))
				fail(
					lane.n,
					`${phase.title}: lane ${lane.m[1]} names no evidence artifact`,
				);
			else if (!lane.text.includes("Pass when"))
				fail(lane.n, `${phase.title}: lane ${lane.m[1]} has no pass predicate`);
		}
	}

	const perf = block("Verify, perf.");
	if (perf) {
		const items = boxes(perf.lines).map((b) => b.text.split(" ")[0]);
		if (items.join("|") !== PERF_ITEMS.join("|"))
			fail(
				perf.n,
				`${phase.title}: perf boxes are [${items.join(", ")}], expected [${PERF_ITEMS.join(", ")}]`,
			);
	}

	const gate = block("Review gate.");
	if (gate) {
		const gateBoxes = boxes(gate.lines);
		if (gate.rest.startsWith("None.")) {
			if (gateBoxes.length)
				fail(gate.n, `${phase.title}: Review gate says None but has boxes`);
		} else {
			const text = gate.lines.map((l) => l.text).join("\n");
			if (gateBoxes.length === 0)
				fail(gate.n, `${phase.title}: Review gate has no box`);
			for (const word of ["screenshot", "operator"]) {
				if (!text.includes(word))
					fail(gate.n, `${phase.title}: Review gate lacks "${word}"`);
			}
		}
	}

	const total = boxes(phase.body).length;
	const cells = SUB_BLOCKS.filter((s) => s !== "Depends on.").map(
		(s) =>
			`${s
				.replace(/[ ,.]+/g, "-")
				.replace(/-$/, "")
				.toLowerCase()}=${counts[s] ?? 0}`,
	);
	report.push(`${phase.title}  boxes=${total}  ${cells.join(" ")}`);
}

const titles = sections.map((s) => s.title);
if (
	titles[0] !== "How to read this" ||
	titles[1] !== "Program checklist" ||
	closeIndex <= programIndex
) {
	fail(
		1,
		"sections must begin with How to read this, Program checklist, phases, then Close the program",
	);
}
for (const title of new Set(titles)) {
	if (titles.filter((t) => t === title).length > 1)
		fail(1, `duplicate section ${title}`);
}
if (close && boxes(close.body).length === 0)
	fail(close.n, "Close the program has no box");

if (closeIndex !== -1) {
	const tail = sections.slice(closeIndex + 1);
	for (const s of tail) {
		if (!s.title.startsWith("Appendix"))
			fail(s.n, `"## ${s.title}" after Close the program is not an appendix`);
	}
	for (const name of [
		"Prototype evidence",
		"Alternatives rejected",
		"Risks",
		"Links and reading list",
	]) {
		if (!tail.some((s) => s.title.includes(name)))
			fail(close.n, `no appendix for ${name}`);
	}
}

console.log(`${path.resolve(file)} sha256 ${createHash("sha256").update(fs.readFileSync(file)).digest("hex")}`);
for (const line of report) console.log(line);
console.log(
	`${phaseSections.length} phase sections, ${problems.length} problems`,
);
for (const p of problems) console.error(p);
process.exit(problems.length ? 1 : 0);
