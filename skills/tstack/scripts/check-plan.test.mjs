import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const PLAN = join(import.meta.dirname, "..", "playbooks", "multi-phase-plan.md");
const CHECKER = join(import.meta.dirname, "check-plan.mjs");

function filledSkeleton() {
	const src = readFileSync(PLAN, "utf8");
	const start = src.indexOf("```markdown\n") + "```markdown\n".length;
	const body = src.slice(start, src.indexOf("\n```", start));
	return body.replace(/<([^>]+)>/g, (_, inner) => {
		if (/screenshot|video|operator/i.test(inner)) return "Save screenshots and a video, post their paths to the operator and record the decision.";
		if (/evidence path/i.test(inner)) return "docs/task/evidence/p1.txt";
		return "filled";
	});
}

function check(text) {
	const file = join(mkdtempSync(join(tmpdir(), "tstack-plan-")), "spec.md");
	writeFileSync(file, text);
	return spawnSync("node", [CHECKER, file], { encoding: "utf8" });
}

test("the filled multi-phase skeleton passes the checker", () => {
	const r = check(filledSkeleton());
	assert.equal(r.stderr, "");
	assert.match(r.stdout, /\b0 problems\b/);
	assert.equal(r.status, 0);
});

test("a spec without a regression lane fails the checker", () => {
	const r = check(filledSkeleton().replace("Regression lane against trunk", "Lane against trunk"));
	assert.notEqual(r.status, 0);
});

test("each checklist rule fails a spec that breaks it", () => {
	const spec = filledSkeleton();
	const broken = [
		["Read `design.md`", "Read `<design>`", /unfilled placeholder/],
		["Return the verified artifact", "Return \u2014 the verified artifact", /long dash/],
		["The body is a how-to.", "Note: the body is a how-to.", /mid-sentence colon/],
		["- [ ] Metric.", "- [ ] Probe.", /perf boxes are \[Probe\., Probe\./],
		["post their paths to the operator", "post their paths to the team", /Review gate lacks "operator"/],
		["### Boot recipe", "### Boot steps", /lacks "### Boot recipe" in order/],
		["**You see.**", "**You get.**", /sub-blocks are/],
	];
	for (const [from, to, problem] of broken) {
		assert.ok(spec.includes(from), from);
		const r = check(spec.replace(from, to));
		assert.equal(r.status, 1, from);
		assert.match(r.stderr, problem, from);
	}
	assert.equal(spawnSync("node", [CHECKER], { encoding: "utf8" }).status, 2);
});
