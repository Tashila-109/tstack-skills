import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { existsSync, lstatSync, readFileSync, readlinkSync } from "node:fs";
import { Refusal, brief, check, exclude, linkSkills, loadModels, parseModels, parseSteps, seat, taskHome } from "./tstack.mjs";

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

test("a project's models file cannot set launch flags, and seats cannot smuggle flags", () => {
	const { home } = scratch();
	const globalDir = join(home, "..", "global");
	mkdirSync(home, { recursive: true });
	mkdirSync(globalDir, { recursive: true });
	writeFileSync(join(globalDir, "models.md"), "lead: codex/gpt-6.1-sol@high\nherdr args codex: --sandbox workspace-write\n");
	assert.deepEqual(seat(loadModels(home, globalDir), "lead", "herdr"), [
		{ kind: "codex", args: ["--model", "gpt-6.1-sol", "-c", 'model_reasoning_effort="high"', "--sandbox", "workspace-write"] },
	]);
	writeFileSync(join(home, "models.md"), "herdr args codex: -c model_provider=evil\n");
	assert.throws(() => loadModels(home, globalDir), /allowed only in/);
	assert.throws(() => seat(parseModels("lead: claude/--settings=/tmp/evil.json"), "lead", "herdr"), Refusal);
	assert.throws(() => seat(parseModels("lead: claude/opus --settings evil"), "lead", "herdr"), Refusal);
	assert.deepEqual(seat(parseModels("lead: claude/claude-opus-5-5[1m]@max"), "lead", "herdr")[0].args.slice(0, 4), ["--model", "claude-opus-5-5[1m]", "--effort", "max"]);
});

test("a combined role line resolves by its first role", () => {
	const models = parseModels("reflect judgment, reflect divergent, reflect synthesizer: claude/claude-opus-5-5@high");
	assert.deepEqual(seat(models, "reflect judgment, divergent, synthesizer", "herdr")[0].args.slice(0, 2), ["--model", "claude-opus-5-5"]);
	assert.throws(() => seat(models, "reflect divergent", "t3"), /no T3 instance/);
});

test("exclude and link-skills keep a per-project install out of Git and inside worktrees", () => {
	const { dir } = scratch();
	execFileSync("git", ["-C", dir, "-c", "commit.gpgsign=false", "commit", "-q", "--allow-empty", "-m", "init"]);
	assert.throws(() => exclude(dir, true), /no per-project install/);
	for (const d of [".agents/skills/how", ".claude/skills", ".pi/skills"]) mkdirSync(join(dir, d), { recursive: true });
	writeFileSync(join(dir, ".agents/skills/how/SKILL.md"), "x");
	execFileSync("ln", ["-s", "../../.agents/skills/how", join(dir, ".claude/skills/how")]);
	writeFileSync(join(dir, "skills-lock.json"), JSON.stringify({ version: 1, skills: { how: {} } }));
	assert.match(exclude(dir, true), /\/\.tstack\/\n\/skills-lock\.json\n\/\.agents\/skills\/how/);
	assert.match(exclude(dir, true), /nothing to add/);
	assert.doesNotMatch(execFileSync("git", ["-C", dir, "status", "--porcelain"], { encoding: "utf8" }), /skills|\.tstack/);
	const wt = join(dir, "..", `${dir.split("/").at(-1)}-links`);
	execFileSync("git", ["-C", dir, "worktree", "add", "-q", wt]);
	assert.equal(linkSkills(wt, wt), "linked 2 skill paths into " + wt);
	assert.equal(readFileSync(join(wt, ".claude/skills/how/SKILL.md"), "utf8"), "x");
	assert.ok(lstatSync(join(wt, ".agents/skills/how")).isSymbolicLink());
	assert.equal(existsSync(join(wt, ".pi/skills/how")), false);
	assert.equal(linkSkills(wt, wt), "linked 0 skill paths into " + wt);
	assert.throws(() => linkSkills(dir, dir), /not the primary checkout/);
	writeFileSync(join(dir, "skills-lock.json"), JSON.stringify({ skills: { "../../escape": {} } }));
	assert.throws(() => linkSkills(wt, wt), /not skill names/);
});

test("check keeps the playbook's artifacts even when task.json loses them", () => {
	const { home, playbooks } = scratch();
	brief(home, "tamper", { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks });
	assert.throws(() => brief(home, "x", { playbook: "../sample", goal: "g", finish: "f", playbooksDir: playbooks }), /playbook name/);
	const taskPath = join(home, "tasks", "tamper", "task.json");
	const task = JSON.parse(readFileSync(taskPath, "utf8"));
	task.playbook = "feature";
	task.steps = [];
	writeFileSync(taskPath, JSON.stringify(task));
	writeFileSync(join(home, "tasks", "tamper", "report.md"), "done\n");
	assert.throws(() => check(home, "tamper"), /missing step 1: evidence\/grounding\.md/);
});

test("a model ID may contain @ when the last segment is not an effort", () => {
	const models = parseModels("lead: pi/cursor/claude-opus-5-5@300k@high\nfeature: pi/cursor/claude-opus-5-5@300k");
	assert.deepEqual(seat(models, "lead", "herdr")[0].args.slice(0, 4), ["--model", "cursor/claude-opus-5-5@300k", "--thinking", "high"]);
	assert.deepEqual(seat(models, "feature", "herdr")[0].args, ["--model", "cursor/claude-opus-5-5@300k"]);
});

test("the CLI runs when invoked through a symlink, as Claude's skills directory does", () => {
	const { dir } = scratch();
	const link = join(dir, "..", `${dir.split("/").at(-1)}-tstack.mjs`);
	execFileSync("ln", ["-s", join(import.meta.dirname, "tstack.mjs"), link]);
	assert.equal(execFileSync("node", [link, "home"], { cwd: dir, encoding: "utf8" }).trim(), join(dir, ".tstack"));
});
