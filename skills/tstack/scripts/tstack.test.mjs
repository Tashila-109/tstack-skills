import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Refusal, brief, check, parseModels, parseSteps, seat, taskHome } from "./tstack.mjs";

const PLAYBOOK = `### Sample

1. Ground the change.
   Artifact: \`evidence/grounding.md\`
2. Design it.
   - a sub-bullet that is not a step
   Artifact: \`evidence/design.md\`, \`evidence/alternatives.md\`
3. Ship it.
`;

function scratch() {
	const dir = realpathSync(mkdtempSync(join(tmpdir(), "tstack-test-")));
	execFileSync("git", ["init", "-q", "-b", "main", dir]);
	const playbooks = join(dir, "playbooks");
	mkdirSync(playbooks);
	writeFileSync(join(playbooks, "sample.md"), PLAYBOOK);
	return { dir, playbooks, home: join(dir, ".tstack") };
}

test("parseSteps keeps step numbers and the artifacts under each", () => {
	assert.deepEqual(parseSteps(PLAYBOOK), [
		{ n: 1, text: "Ground the change.", artifacts: ["evidence/grounding.md"] },
		{ n: 2, text: "Design it.", artifacts: ["evidence/design.md", "evidence/alternatives.md"] },
		{ n: 3, text: "Ship it.", artifacts: [] },
	]);
});

test("taskHome resolves the primary checkout from a linked worktree", () => {
	const { dir } = scratch();
	execFileSync("git", ["-C", dir, "-c", "commit.gpgsign=false", "commit", "-q", "--allow-empty", "-m", "init"]);
	const wt = join(dir, "..", `${dir.split("/").at(-1)}-wt`);
	execFileSync("git", ["-C", dir, "worktree", "add", "-q", wt]);
	assert.equal(taskHome(wt), join(dir, ".tstack"));
});

test("check refuses until every frozen artifact and the report exist", () => {
	const { home, playbooks } = scratch();
	brief(home, "demo", { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks });
	assert.throws(() => brief(home, "demo", { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks }), Refusal);
	assert.throws(() => check(home, "demo", 1), /missing step 1: evidence\/grounding\.md/);
	const task = join(home, "tasks", "demo");
	writeFileSync(join(task, "evidence/grounding.md"), "   \n");
	assert.throws(() => check(home, "demo", 1), /missing step 1/, "a blank file is not an artifact");
	writeFileSync(join(task, "evidence/grounding.md"), "traced model\n");
	assert.equal(check(home, "demo", 1), "ok demo: 1 required file present");
	writeFileSync(join(task, "evidence/design.md"), "pick A\n");
	writeFileSync(join(task, "evidence/alternatives.md"), "A, B\n");
	assert.throws(() => check(home, "demo"), /missing final report: report.md/);
	writeFileSync(join(task, "report.md"), "done\n");
	assert.equal(check(home, "demo"), "ok demo: 4 required files present");
});

test("seat resolves roles to T3 targets and Herdr launch flags", () => {
	const models = parseModels(`# budget: large
lead: claude/claude-opus-5-5@high
feature, refactoring: pi/openai/gpt-5.5@high
architect runners: claude/claude-opus-5-5@high, codex/gpt-6.1-sol, inherit
t3 instances: claude=claudeAgent/effort, codex=codex/reasoningEffort, pi=pi/thinking
herdr args pi: --no-session`);
	assert.deepEqual(seat(models, "lead feature", "t3"), [
		{ providerInstanceId: "claudeAgent", model: "claude-opus-5-5", options: [{ id: "effort", value: "high" }] },
	]);
	assert.deepEqual(seat(models, "Refactoring", "t3"), [
		{ providerInstanceId: "pi", model: "openai/gpt-5.5", options: [{ id: "thinking", value: "high" }] },
	]);
	assert.deepEqual(seat(models, "architect runners", "herdr"), [
		{ kind: "claude", args: ["--model", "claude-opus-5-5", "--effort", "high", "--permission-mode", "auto", "--prompt-suggestions", "false"] },
		{ kind: "codex", args: ["--model", "gpt-6.1-sol", "--dangerously-bypass-approvals-and-sandbox"] },
		{ inherit: true },
	]);
	assert.deepEqual(seat(models, "feature", "herdr"), [{ kind: "pi", args: ["--model", "openai/gpt-5.5", "--thinking", "high", "--no-session"] }]);
	assert.throws(() => seat(models, "swarm workers", "t3"), /run tstack-setup/);
	assert.throws(() => seat(parseModels("lead: grok/grok-4.7@high"), "lead", "t3"), /no T3 instance for harness grok/);
});
