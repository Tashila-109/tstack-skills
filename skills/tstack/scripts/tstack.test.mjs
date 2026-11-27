import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Refusal, backlog, brief, check, checkSeats, exclude, isTransient, linkSkills, loadModels, lock, main, parseModels, parseSteps, preflight, prVerdict, refPath, seat, status, taskHome, unlock } from "./tstack.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPORT = "done\n\n## Remember\n\nnothing new\n\n## Follow-ups\n\nnone\n";
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
	const { dir, home, playbooks } = scratch();
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
	writeFileSync(join(task, "report.md"), REPORT);
	assert.equal(check(home, "demo"), "ok demo: 4 required files present");
	assert.throws(() => check(home, "../demo"), /task id must match/);
	writeFileSync(join(dir, "outside.md"), "traced elsewhere\n");
	rmSync(join(task, "evidence/grounding.md"));
	symlinkSync(join(dir, "outside.md"), join(task, "evidence/grounding.md"));
	assert.throws(() => check(home, "demo", 1), /is a link to outside the task directory/);
});

test("seat resolves roles to T3 targets, Herdr launch flags and standalone inherits", () => {
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
	assert.deepEqual(seat(models, "architect runners", "standalone"), [
		{ inherit: true, configured: "claude/claude-opus-5-5@high" },
		{ inherit: true, configured: "codex/gpt-6.1-sol" },
		{ inherit: true },
	]);
	assert.deepEqual(seat(models, "architect runners", "standalone", "claude-opus-5-5"), [{ inherit: true, configured: "codex/gpt-6.1-sol" }]);
	assert.throws(() => seat(models, "architect runners", undefined), /--runtime must be/);
	assert.throws(() => seat(models, "lead", "bogus"), /--runtime must be/);
	assert.throws(() => seat(parseModels("lead: grok/grok-4.7@high"), "lead", "t3"), /no T3 instance for harness grok/);
});

test("seat --cross picks the first seat outside the caller's model family", () => {
	const models = parseModels("review: inherit, claude/claude-opus-5-5@high, codex/gpt-6.1-sol@high\nsolo: claude/claude-sonnet-5-5");
	const kinds = (cross) => seat(models, "review", "herdr", cross).map((s) => s.kind);
	assert.deepEqual(kinds("claude-opus-5-5"), ["codex"]);
	assert.deepEqual(kinds("cursor/claude-opus-5-5@300k"), ["codex"]);
	assert.deepEqual(kinds("openai/gpt-6.1-sol"), ["claude"]);
	assert.deepEqual(kinds("grok-4.7"), ["claude"]);
	assert.throws(() => seat(models, "solo", "herdr", "claude-opus-5-5"), /no "solo" seat outside the claude family/);
	const openai = parseModels("pool: codex/o3@high, claude/claude-fable-5-2@high");
	assert.deepEqual(seat(openai, "pool", "herdr", "gpt-6.1-sol").map((s) => s.kind), ["claude"], "an o-series model is the same vendor as gpt");
});

test("seat --avoid prefers a seat whose model ran no candidate, then the one that ran the fewest", () => {
	const models = parseModels("pool: inherit, codex/gpt-6.1-sol@high, pi/openai/gpt-6.1-terra@high, claude/claude-fable-5-2@high, grok/grok-4.7");
	const model = (avoid) => seat(models, "pool", "standalone", "claude-opus-5-5", avoid)[0].configured;
	assert.equal(model(undefined), "codex/gpt-6.1-sol@high");
	assert.equal(model("gpt-6.1-sol"), "pi/openai/gpt-6.1-terra@high");
	assert.equal(model("gpt-6.1-sol, openai/gpt-6.1-terra"), "grok/grok-4.7");
	assert.equal(model("gpt-6.1-sol,gpt-6.1-terra,grok-4.7,gpt-6.1-sol,grok-4.7"), "pi/openai/gpt-6.1-terra@high");
	assert.throws(() => seat(models, "pool", "standalone", undefined, "gpt-6.1-sol"), /--avoid needs --cross/);
	const variants = parseModels("pool: cursor/gpt-6.1-sol@200k, cursor/gpt-6.1-sol@300k");
	assert.equal(seat(variants, "pool", "standalone", "claude-opus-5-5", "gpt-6.1-sol@200k")[0].configured, "cursor/gpt-6.1-sol@300k");
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

test("a combined role line gives each role its own seat, and a seat call names one role", () => {
	const models = parseModels("reflect judgment: claude/claude-opus-5-5@high\nreflect divergent, reflect synthesizer: grok/grok-4.7@high");
	assert.deepEqual(seat(models, "reflect divergent", "herdr")[0].args.slice(0, 2), ["--model", "grok-4.7"]);
	assert.throws(() => seat(models, "reflect judgment, divergent, synthesizer", "herdr"), /no line for role/);
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
	assert.throws(() => linkSkills(wt, join(wt, "typo")), /not a worktree of/);
	assert.equal(existsSync(join(wt, "typo")), false);
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
	writeFileSync(join(home, "tasks", "tamper", "report.md"), REPORT);
	assert.throws(() => check(home, "tamper"), /missing step 1 \(added to the playbook after the brief\): evidence\/grounding\.md/);
});

test("a model ID may contain @ when the last segment is not an effort", () => {
	const models = parseModels("lead: pi/cursor/claude-opus-5-5@300k@high\nfeature: pi/cursor/claude-opus-5-5@300k");
	assert.deepEqual(seat(models, "lead", "herdr")[0].args.slice(0, 4), ["--model", "cursor/claude-opus-5-5@300k", "--thinking", "high"]);
	assert.deepEqual(seat(models, "feature", "herdr")[0].args, ["--model", "cursor/claude-opus-5-5@300k"]);
});

test("the CLI runs when invoked through a symlink, as Claude's skills directory does", () => {
	const { dir } = scratch();
	const link = join(dir, "..", `${dir.split("/").at(-1)}-tstack.mjs`);
	execFileSync("ln", ["-s", join(HERE, "tstack.mjs"), link]);
	assert.equal(execFileSync("node", [link, "home"], { cwd: dir, encoding: "utf8" }).trim(), join(dir, ".tstack"));
});

test("a gate artifact counts only with a granted answer", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "gated.md"), "1. Design it.\n   Artifact: `decisions/design.md`\n");
	brief(home, "gated", { playbook: "gated", goal: "g", finish: "f", playbooksDir: playbooks });
	const file = join(home, "tasks", "gated", "decisions", "design.md");
	mkdirSync(join(home, "tasks", "gated", "decisions"));
	writeFileSync(file, "# Approve the design?\n\nKind: design-approval\n");
	assert.throws(() => check(home, "gated", 1), /decisions\/design\.md with a granted answer/);
	writeFileSync(file, "# Approve the design?\n\n## Answer\n\ndenied\nNot yet, 2026-10-05\n");
	assert.throws(() => check(home, "gated", 1), /granted answer/);
	writeFileSync(file, "# Approve the design?\n\n## Answer\n\ngranted\nShip it, 2026-10-05\n");
	assert.equal(check(home, "gated", 1), "ok gated: 1 required file present");
});

test("a question artifact counts only with an answered answer", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "asked.md"), "1. Ask which to take.\n   Artifact: `decisions/adopt.md`\n");
	brief(home, "asked", { playbook: "asked", goal: "g", finish: "f", kind: "scout", playbooksDir: playbooks });
	const file = join(home, "tasks", "asked", "decisions", "adopt.md");
	mkdirSync(join(home, "tasks", "asked", "decisions"));
	writeFileSync(file, "# Which items do we take?\n\nKind: question\n");
	assert.throws(() => check(home, "asked", 1), /decisions\/adopt\.md with the human's answer/);
	writeFileSync(file, "# Which items do we take?\n\nKind: question\n\n```text\n## Answer\n\nanswered\n```\n");
	assert.throws(() => check(home, "asked", 1), /with the human's answer/, "an answer inside a code block is no answer");
	writeFileSync(file, "# Which items do we take?\n\nKind: question\n\n## Answer\n\nanswered\nTake 1 and 3, 2026-11-21\n");
	assert.equal(check(home, "asked", 1), "ok asked: 1 required file present");
	writeFileSync(file, "# Which items do we take?\n\nKind: design-approval\n\n## Answer\n\nanswered\nTake 1 and 3, 2026-11-21\n");
	assert.throws(() => check(home, "asked", 1), /with a granted answer/, "a gate is not passed by an answered line");
	writeFileSync(file, "# Approve it?\n\nKind: design-approval\n\n## Proposal\n\nKind: question\n\n## Answer\n\nanswered\nyes, 2026-11-21\n");
	assert.throws(() => check(home, "asked", 1), /with a granted answer/, "a Kind line in the body does not turn a gate into a question");
});

test("every playbook briefs cleanly: steps numbered from 1 and artifacts inside the task", () => {
	const { home } = scratch();
	const dir = join(HERE, "../playbooks");
	for (const name of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
		const id = name.slice(0, -3);
		brief(home, id, { playbook: id, goal: "g", finish: "f", playbooksDir: dir });
		assert.ok(existsSync(join(home, "tasks", id, "brief.md")), name);
	}
});

test("a pr-delivery task is done only with babysit evidence", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	brief(home, "pr", { playbook: "plain", goal: "g", finish: "f", delivery: "pr", playbooksDir: playbooks });
	const task = join(home, "tasks", "pr");
	writeFileSync(join(task, "report.md"), REPORT);
	assert.throws(() => check(home, "pr"), /missing pr delivery: evidence\/babysit\.md/);
	writeFileSync(join(task, "evidence/babysit.md"), "drive: PR #1 merge-ready at abc123\n");
	assert.equal(check(home, "pr"), "ok pr: 2 required files present");
});

test("check-seats names each seat T3 does not advertise, and the ID it goes by", () => {
	const caps = {
		providers: [
			{ providerInstanceId: "claudeAgent", canRunChildTask: true, models: [{ id: "claude-opus-5-5", options: [{ id: "effort", options: [{ id: "medium" }, { id: "high" }] }] }] },
			{ providerInstanceId: "pi", canRunChildTask: true, models: [{ id: "openai/gpt-6.1-sol", options: [{ id: "thinking", options: [{ id: "xhigh" }] }] }] },
			{ providerInstanceId: "opencode", canRunChildTask: false, models: [] },
		],
	};
	const instances = "t3 instances: claude=claudeAgent/effort, pi=pi/thinking, open=opencode/x";
	assert.equal(checkSeats(parseModels(`lead: claude/claude-opus-5-5@high\nbug-fix: pi/openai/gpt-6.1-sol@xhigh\ncomment sicko: inherit\n${instances}`), caps, null), "ok: 2 seats advertised");
	assert.throws(() => checkSeats(parseModels(`bug-fix: pi/gpt-6.1-sol@xhigh\n${instances}`), caps, null), /bug-fix: pi gpt-6\.1-sol: model not advertised; advertised as openai\/gpt-6\.1-sol/);
	assert.throws(() => checkSeats(parseModels(`lead: claude/claude-opus-5-5@max\n${instances}`), caps, null), /effort max not offered \(medium, high\)/);
	assert.throws(() => checkSeats(parseModels(`review: open/some-model\n${instances}`), caps, null), /instance opencode cannot run child tasks/);
	const bare = { providers: [{ providerInstanceId: "claudeAgent", canRunChildTask: true }] };
	assert.throws(() => checkSeats(parseModels(`lead: claude/claude-opus-5-5\n${instances}`), bare, null), /model not advertised/);
});

test("check-seats reads a real T3 catalog: provider reasons, cross-provider limits, boolean options and panel families", () => {
	const caps = JSON.parse(readFileSync(new URL("./t3-catalog.fixture.json", import.meta.url), "utf8"));
	const instances = "t3 instances: claude=claudeAgent/effort, codex=codex/reasoningEffort, pi=pi/thinking, grok=grok/reasoningEffort, open=opencode/x";
	const roles = new Set(["lead", "interrogate reviewers"]);
	const ok = `lead: claude/claude-opus-5-5@high\ninterrogate reviewers: claude/claude-opus-5-5@high, codex/gpt-6.1-sol@high, pi/openai/gpt-6.1-sol@xhigh\n${instances}`;
	assert.equal(checkSeats(parseModels(ok), caps, roles), "ok: 3 seats advertised");
	const newer = `lead: claude/claude-fable-5-2@high\ninterrogate reviewers: claude/claude-fable-5-2@high, codex/gpt-6.1-terra@high, pi/openai/gpt-6.1-terra@xhigh\n${instances}`;
	assert.equal(checkSeats(parseModels(newer), caps, roles), "ok: 3 seats advertised");
	assert.throws(() => checkSeats(parseModels(`lead: grok/grok-4.7@high\ninterrogate reviewers: claude/claude-opus-5-5, codex/gpt-6.1-sol\n${instances}`), caps, roles), /grok-4\.7: instance grok cannot run child tasks here \(.*not logged in/);
	assert.throws(() => checkSeats(parseModels(`lead: claude/claude-haiku-4-5@high\ninterrogate reviewers: claude/claude-opus-5-5, codex/gpt-6.1-sol\n${instances}`), caps, roles), /effort high not offered \(no such option\)/);
	assert.throws(() => checkSeats(parseModels(`lead: haiku/claude-haiku-4-5@high\ninterrogate reviewers: claude/claude-opus-5-5, codex/gpt-6.1-sol\n${instances}, haiku=claudeAgent/thinking`), caps, roles), /thinking is an on\/off option, so drop the @high effort/);
	assert.throws(() => checkSeats(parseModels(`lead: claude/claude-opus-5-5\ninterrogate reviewers: claude/claude-opus-5-5@high, claude/claude-sonnet-5-5@high, inherit\n${instances}`), caps, roles), /interrogate reviewers: a panel needs seats from at least two model families/);
	assert.throws(() => checkSeats(parseModels(`lead: claude/claude-opus-5-5\ninterrogate reviewers: codex/gpt-6.1-sol, codex/gpt-6.1-sol, claude/claude-opus-5-5\n${instances}`), caps, roles), /the same seat is listed twice/);
	const noCross = { providers: caps.providers.map((p) => (p.providerInstanceId === "codex" ? { ...p, canRunCrossProviderChildTask: false } : p)) };
	assert.throws(() => checkSeats(parseModels(ok), noCross, roles), /cannot run a child for a parent on another provider/);
});

test("check-seats names missing and misspelled roles against the tstack-setup template", () => {
	const caps = JSON.parse(readFileSync(new URL("./t3-catalog.fixture.json", import.meta.url), "utf8"));
	const instances = "t3 instances: claude=claudeAgent/effort";
	assert.throws(() => checkSeats(parseModels(`lead: claude/claude-opus-5-5\ninterogate reviewers: inherit\n${instances}`), caps), (err) => {
		assert.match(err.message, /no line for role "interrogate reviewers"/);
		assert.match(err.message, /unknown role "interogate reviewers"/);
		assert.doesNotMatch(err.message, /role "lead"/);
		return true;
	});
	assert.doesNotThrow(() => {
		try {
			checkSeats(parseModels(`lead bug-fix: claude/claude-opus-5-5\n${instances}`), caps);
		} catch (err) {
			assert.doesNotMatch(err.message, /unknown role "lead bug-fix"/);
		}
	});
});

test("a models file refuses a malformed line and a role named twice", () => {
	assert.throws(() => parseModels("lead claude/claude-opus-5-5\n"), /line 1 is not "role: seats"/);
	assert.throws(() => parseModels("# c\nlead:\n"), /line 2 is not "role: seats"/);
	assert.throws(() => parseModels("review: inherit\nlead, review: inherit\n"), /names role "review" twice, again on line 2/);
	assert.equal(parseModels("# a comment: with a colon\n\nlead: inherit\n").get("lead"), "inherit");
});

test("the tstack-setup template is a complete, valid models file", () => {
	const setup = readFileSync(new URL("../../tstack-setup/SKILL.md", import.meta.url), "utf8");
	const template = parseModels(setup.match(/```text\n(# tstack models[\s\S]*?)```/)[1]);
	for (const role of ["arena runners", "arena cross-judge pool", "interrogate reviewers", "review"])
		assert.ok(new Set(seat(template, role, "t3").map((s) => s.model.split("/").pop().split("-")[0])).size >= 2, role);
});

test("check refuses a worker brief whose result has no verdict line", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	brief(home, "w", { playbook: "plain", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "w");
	writeFileSync(join(task, "report.md"), REPORT);
	mkdirSync(join(task, "briefs"));
	mkdirSync(join(task, "results"));
	writeFileSync(join(task, "briefs", "fix.md"), "GOAL fix it\n");
	assert.throws(() => check(home, "w"), /briefs\/fix\.md has no results\/fix\.md/);
	assert.equal(check(home, "w", 1), "ok w: 0 required files present", "a step check does not wait on running workers");
	writeFileSync(join(task, "results", "fix.md"), "changed a.js\n");
	assert.throws(() => check(home, "w"), /has no results\/fix\.md with a DONE/);
	writeFileSync(join(task, "results", "fix.md"), "changed a.js\nDONE fixed\n");
	assert.equal(check(home, "w"), "ok w: 1 required file present");
});

test("steps inside a code fence are not playbook steps, and steps must run from 1", () => {
	assert.deepEqual(parseSteps("1. Real.\n```text\n1. Example only.\n   Artifact: `evidence/x.md`\n```\n2. Next.\n").map((s) => s.n), [1, 2]);
	assert.deepEqual(parseSteps("```\n~~~\n1. Example only.\n```\n1. Real.\n").map((s) => s.text), ["Real."], "a ~~~ line inside a ``` fence neither opens nor closes it");
	assert.deepEqual(parseSteps("````md\n```\n1. Example only.\n````\n1. Real.\n").map((s) => s.text), ["Real."], "a shorter run inside a longer fence does not close it");
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "gappy.md"), "1. One.\n3. Three.\n");
	assert.throws(() => brief(home, "gappy", { playbook: "gappy", goal: "g", finish: "f", playbooksDir: playbooks }), /numbers its steps 1, 3/);
	assert.throws(() => brief(home, "scout", { playbook: "sample", goal: "g", finish: "f", kind: "scout", delivery: "pr", playbooksDir: playbooks }), /never opens a PR/);
});

test("every shipped playbook numbers its steps from 1 without gaps", () => {
	const dir = join(HERE, "..", "playbooks");
	for (const name of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
		const steps = parseSteps(readFileSync(join(dir, name), "utf8"));
		assert.deepEqual(steps.map((s) => s.n), steps.map((_, i) => i + 1), name);
	}
});

const PROVING = `### Proving

1. Prove it.
   Artifact: \`evidence/verify.md\`
`;

test("check refuses a proof that cites no evidence, or evidence that is missing or empty", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "proving.md"), PROVING);
	brief(home, "proof", { playbook: "proving", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "proof");
	writeFileSync(join(task, "evidence/verify.md"), "It works, I checked.\n");
	assert.throws(() => check(home, "proof", 1), /evidence\/verify\.md cites no file under evidence\//);
	writeFileSync(join(task, "evidence/verify.md"), "Only `evidence/verify.md` itself.\n");
	assert.throws(() => check(home, "proof", 1), /cites no file/, "a proof cannot cite itself");
	writeFileSync(join(task, "evidence/verify.md"), "| list hides it | archive | `evidence/proof/list.png` | passed |\n");
	assert.throws(() => check(home, "proof", 1), /cites evidence\/proof\/list\.png, which is missing or empty/);
	mkdirSync(join(task, "evidence/proof"));
	writeFileSync(join(task, "evidence/proof/list.png"), "");
	assert.throws(() => check(home, "proof", 1), /missing or empty/);
	writeFileSync(join(task, "evidence/proof/list.png"), "png");
	assert.equal(check(home, "proof", 1), "ok proof: 1 required file present");
	writeFileSync(join(task, "evidence/verify.md"), "Raw runs: `evidence/proof/`\n");
	assert.equal(check(home, "proof", 1), "ok proof: 1 required file present", "a non-empty folder counts");
	writeFileSync(join(task, "evidence/verify.md"), "skip: docs-only change, no surface to drive\n");
	assert.equal(check(home, "proof", 1), "ok proof: 1 required file present");
});

test("brief points at create-verification-skill only when a proving playbook meets a project without one", () => {
	const { dir, home, playbooks } = scratch();
	writeFileSync(join(playbooks, "proving.md"), PROVING);
	const read = (id) => readFileSync(join(home, "tasks", id, "brief.md"), "utf8");
	brief(home, "bare", { playbook: "proving", goal: "g", finish: "f", playbooksDir: playbooks });
	assert.match(read("bare"), /no `verify-\*` skill/);
	brief(home, "other", { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks });
	assert.doesNotMatch(read("other"), /verify-\*/);
	mkdirSync(join(dir, ".agents/skills/verify-app"), { recursive: true });
	brief(home, "equipped", { playbook: "proving", goal: "g", finish: "f", playbooksDir: playbooks });
	assert.doesNotMatch(read("equipped"), /verify-\*/);
});

test("check refuses a review past three rounds per answered checkpoint decision", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	brief(home, "rounds", { playbook: "plain", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "rounds");
	writeFileSync(join(task, "report.md"), REPORT);
	mkdirSync(join(task, "evidence/reviews"));
	mkdirSync(join(task, "decisions"));
	writeFileSync(join(task, "evidence/reviews/m3-spec.md"), "Head abc1234, round 9 brief\n");
	writeFileSync(join(task, "evidence/reviews/m3.md"), "Reviewed by a worker.\n\nHead abc1234, round 9\n");
	assert.throws(() => check(home, "rounds"), /reviews\/m3\.md does not open with "Head <sha>, round <n>"/, "a round below line 1 is not missed");
	writeFileSync(join(task, "evidence/reviews/m3.md"), "skip: nothing changed since the last review\n");
	assert.equal(check(home, "rounds"), "ok rounds: 1 required file present");
	writeFileSync(join(task, "evidence/reviews/m3.md"), "Head abc1234, round 3\n");
	assert.equal(check(home, "rounds"), "ok rounds: 1 required file present");
	writeFileSync(join(task, "evidence/reviews/m3.md"), "Head def5678, round 4\n");
	assert.throws(() => check(home, "rounds"), /review m3 is at round 4, past 3: .*decisions\/review-m3\.md/);
	writeFileSync(join(task, "decisions/review-m3.md"), "# Keep going?\n\n## Answer\n\n");
	assert.throws(() => check(home, "rounds"), /round 4/, "an unanswered decision is no checkpoint");
	writeFileSync(join(task, "decisions/review-m3.md"), "# Keep going?\n\n## Answer\n\nanswered\nyes, two more, 2026-10-12\n");
	assert.equal(check(home, "rounds"), "ok rounds: 1 required file present");
	writeFileSync(join(task, "evidence/reviews/m3.md"), "Head 1234567, round 7\n");
	assert.throws(() => check(home, "rounds"), /past 6: .*decisions\/review-m3-2\.md/);
	writeFileSync(join(task, "decisions/review-m3-2.md"), "## Answer\n\ngranted\ngo on, 2026-10-12\n");
	assert.equal(check(home, "rounds"), "ok rounds: 1 required file present");
});

test("check refuses a hashed document that changed after its latest grant, and a stale check-plan run", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	brief(home, "plan", { playbook: "plain", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "plan");
	writeFileSync(join(task, "report.md"), REPORT);
	mkdirSync(join(task, "decisions"));
	const hash = (text) => createHash("sha256").update(text).digest("hex");
	const gate = (name, text, answer = "granted") =>
		writeFileSync(join(task, "decisions", name), `# Approve?\n\nKind: design-approval\nSubject: \`design.md\` sha256 ${hash(text)}\n\n## Answer\n\n${answer}\nok, 2026-10-12\n`);
	writeFileSync(join(task, "design.md"), "v1\n");
	gate("design.md", "v1\n");
	assert.equal(check(home, "plan"), "ok plan: 1 required file present");
	writeFileSync(join(task, "design.md"), "v2\n");
	assert.throws(() => check(home, "plan"), /design\.md changed after decisions\/design\.md granted it/);
	gate("design-2.md", "v2\n", "denied");
	assert.throws(() => check(home, "plan"), /changed after decisions\/design\.md/, "a denied amendment grants nothing");
	gate("design-2.md", "v2\n");
	assert.equal(check(home, "plan"), "ok plan: 1 required file present");
	writeFileSync(join(task, "decisions/design-3.md"), `Subject: \`.tstack/tasks/plan/design.md\` sha256 ${hash("v2\n")}\n\n## Answer\n\ngranted\n`);
	assert.equal(check(home, "plan"), "ok plan: 1 required file present", "a path from the project root resolves too");
	const spec = join(task, "spec.md");
	writeFileSync(spec, "s1\n");
	writeFileSync(join(task, "evidence/check-plan.md"), `${spec} sha256 ${hash("s1\n")}\n1 phase sections, 0 problems\n`);
	assert.equal(check(home, "plan"), "ok plan: 1 required file present");
	writeFileSync(spec, "s2\n");
	assert.throws(() => check(home, "plan"), /evidence\/check-plan\.md checked an older/);
	writeFileSync(join(task, "evidence/check-plan.md"), `${spec} sha256 ${hash("s2\n")}\n1 phase sections, 2 problems\n`);
	assert.throws(() => check(home, "plan"), /not a clean check-plan\.mjs run/);
	writeFileSync(join(task, "decisions/design-4.md"), `Subject: \`design.md\` sha256 ${hash("v3\n")}\n\n\`\`\`text\n## Answer\n\ngranted\n\`\`\`\n`);
	writeFileSync(join(task, "evidence/check-plan.md"), `${spec} sha256 ${hash("s2\n")}\n1 phase sections, 0 problems\n`);
	assert.equal(check(home, "plan"), "ok plan: 1 required file present", "a grant inside a code fence grants nothing");
});

test("check holds the report's shape and a delegating step's worker results", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "fixing.md"), "1. Fix it.\n   Artifact: `evidence/fix.md`\n");
	brief(home, "fx", { playbook: "fixing", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "fx");
	writeFileSync(join(task, "evidence/fix.md"), "skip: did it myself\n");
	assert.throws(() => check(home, "fx", 1), /cites no results\/<name>\.md/);
	mkdirSync(join(task, "briefs"));
	mkdirSync(join(task, "results"));
	writeFileSync(join(task, "briefs/fix.md"), "SKILLS tdd\n");
	writeFileSync(join(task, "results/fix.md"), "changed a.js\n");
	writeFileSync(join(task, "evidence/fix.md"), "Brief `briefs/fix.md`, result `results/fix.md`. Diff reviewed.\n");
	assert.throws(() => check(home, "fx", 1), /cites results\/fix\.md, which has no DONE/);
	writeFileSync(join(task, "results/fix.md"), "changed a.js\nFAILED the worker gave up\n");
	assert.throws(() => check(home, "fx", 1), /cites no result that ends DONE/);
	writeFileSync(join(task, "results/fix.md"), "DONE first pass\nFAILED the rerun broke\n");
	assert.throws(() => check(home, "fx", 1), /cites no result that ends DONE/, "the last verdict line counts");
	writeFileSync(join(task, "briefs/fix-2.md"), "SKILLS tdd\n");
	writeFileSync(join(task, "results/fix-2.md"), "changed a.js\nDONE fixed\n");
	writeFileSync(join(task, "evidence/fix.md"), "Brief `briefs/fix.md`, result `results/fix.md`, then `briefs/fix-2.md`, result `results/fix-2.md`.\n");
	assert.equal(check(home, "fx", 1), "ok fx: 1 required file present", "a retry that ends DONE is enough");
	writeFileSync(join(task, "briefs/fix.md"), "SKILLS none\n");
	writeFileSync(join(task, "briefs/fix-2.md"), "SKILLS none\n");
	assert.throws(() => check(home, "fx", 1), /lists the tdd skill/);
	writeFileSync(join(task, "briefs/fix.md"), "SKILLS tdd\n");
	writeFileSync(join(task, "briefs/fix-2.md"), "SKILLS tdd\n");
	writeFileSync(join(task, "report.md"), "done \u2014 shipped\n\n## Remember\n");
	assert.throws(() => check(home, "fx"), /no ## Follow-ups heading[\s\S]*long dash/);
	writeFileSync(join(task, "report.md"), REPORT);
	assert.equal(check(home, "fx"), "ok fx: 2 required files present");
});

test("check --head refuses proof and review that name no commit with the head's tree", () => {
	const { dir, home, playbooks } = scratch();
	const git = (...args) => execFileSync("git", ["-C", dir, "-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8" }).trim();
	writeFileSync(join(dir, "a.txt"), "1\n");
	git("add", "a.txt");
	git("commit", "-q", "-m", "one");
	const one = git("rev-parse", "HEAD");
	git("commit", "-q", "--allow-empty", "-m", "same tree");
	const same = git("rev-parse", "HEAD");
	writeFileSync(join(dir, "a.txt"), "2\n");
	git("commit", "-q", "-am", "two");
	const two = git("rev-parse", "HEAD");
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	brief(home, "hd", { playbook: "plain", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "hd");
	writeFileSync(join(task, "report.md"), REPORT);
	writeFileSync(join(task, "evidence/verify.md"), `Head ${one.slice(0, 12)}\n`);
	assert.equal(check(home, "hd", undefined, same, dir), "ok hd: 1 required file present", "an empty commit keeps the tree");
	assert.throws(() => check(home, "hd", undefined, two, dir), /evidence\/verify\.md names no commit with the same tree/);
	assert.throws(() => check(home, "hd", undefined, "nothex", dir), /--head must be a commit SHA/);
	writeFileSync(join(task, "evidence/verify.md"), "skip: closed on the human's word\n");
	assert.equal(check(home, "hd", undefined, two, dir), "ok hd: 1 required file present", "a skipped step names no head");
	writeFileSync(join(task, "evidence/verify.md"), `skip: browser check, no UI\nHead ${one.slice(0, 12)}\n`);
	assert.throws(() => check(home, "hd", undefined, two, dir), /evidence\/verify\.md names no commit with the same tree/, "a skip line does not excuse stale proof beside it");
});

test("pr-state turns GitHub's state into one verdict, waiting for checks and review bots to settle", () => {
	const now = Date.parse("2026-10-14T12:00:00Z");
	const old = "2026-10-14T11:00:00Z";
	const run = (name, status, conclusion) => ({ __typename: "CheckRun", name, status, conclusion });
	const pr = (over = {}, checks = [run("test", "COMPLETED", "SUCCESS")]) => ({
		state: "OPEN", isDraft: false, mergeable: "MERGEABLE", mergeStateStatus: "CLEAN", reviewDecision: null, headRefOid: "abcdef1234567890",
		commits: { nodes: [{ commit: { committedDate: old, statusCheckRollup: { contexts: { nodes: checks } } } }] },
		reviewThreads: { nodes: [] }, comments: { nodes: [] }, reviews: { nodes: [] }, ...over,
	});
	assert.equal(prVerdict(pr(), now), "READY (head abcdef123456)");
	assert.equal(prVerdict(pr({ state: "MERGED" }), now), "MERGED (head abcdef123456)");
	assert.match(prVerdict(pr({ mergeable: "CONFLICTING" }), now), /^BLOCKER conflicts/);
	assert.match(prVerdict(pr({}, [run("lint", "COMPLETED", "FAILURE"), run("test", "IN_PROGRESS", null)]), now), /^BLOCKER failing-checks: lint/);
	assert.match(prVerdict(pr({}, [run("test", "IN_PROGRESS", null)]), now), /^WAITING checks: test/);
	assert.match(prVerdict(pr({}, [{ __typename: "StatusContext", context: "ci/legacy", state: "PENDING" }]), now), /^WAITING checks: ci\/legacy/);
	assert.match(
		prVerdict(pr({ reviewThreads: { nodes: [{ id: "PRRT_a", isResolved: false, path: "a.js", line: 3 }, { id: "PRRT_b", isResolved: false, path: "b.md", line: null }, { isResolved: true }] } }), now),
		/^BLOCKER review-threads: 2 unresolved: PRRT_a a\.js:3, PRRT_b b\.md \(head/,
	);
	assert.match(
		prVerdict(pr({ reviewThreads: { nodes: [{ id: "PRRT_a", isResolved: false, path: "a.js", line: 3 }] }, commits: { nodes: [{ commit: { statusCheckRollup: { contexts: { nodes: [{ __typename: "CheckRun", name: "ci", status: "COMPLETED", conclusion: "FAILURE" }] } } } }] } }), now),
		/^BLOCKER failing-checks: ci; review-threads: 1 unresolved: PRRT_a a\.js:3 /,
		"threads come first in babysit's order, so a failing check still lists them",
	);
	assert.match(
		prVerdict(pr({ mergeable: "CONFLICTING", reviewThreads: { nodes: [{ id: "PRRT_a", isResolved: false, path: "a.js", line: 3 }] } }), now),
		/^BLOCKER conflicts: merge the base branch in; review-threads: 1 unresolved: PRRT_a a\.js:3 \(head/,
		"a threads-only pass gets the IDs without fixing the conflict",
	);
	assert.match(
		prVerdict(pr({ isDraft: true, reviewThreads: { pageInfo: { hasNextPage: true }, nodes: [{ id: "PRRT_a", isResolved: true }] } }), now),
		/^BLOCKER draft: mark it ready; review-threads: 0 unresolved in the first 100, and more to read on GitHub \(head/,
		"an early blocker says when threads were cut off",
	);
	assert.match(prVerdict(pr({ reviewThreads: { pageInfo: { hasNextPage: true }, nodes: [] } }), now), /^BLOCKER too-many/);
	assert.match(prVerdict(pr({ reviews: { pageInfo: { hasPreviousPage: true }, nodes: [] } }), now), /^BLOCKER too-many/, "older reviews could hold a bot's findings on this head");
	assert.match(prVerdict(pr({ mergeable: "UNKNOWN", mergeStateStatus: "UNKNOWN" }), now), /^WAITING mergeable-unknown/);
	assert.match(prVerdict(pr({ updatedAt: "2026-10-14T11:58:00Z" }), now), /^WAITING settle: .*120s ago/, "a force-push of an old commit still settles");
	assert.match(prVerdict(pr({ reviews: { nodes: [{ submittedAt: "2026-10-14T11:57:00Z" }] } }), now), /^WAITING settle: .*180s ago/);
	assert.match(prVerdict(pr({ mergeStateStatus: "BEHIND" }), now), /^BLOCKER behind-base/);
	assert.match(prVerdict(pr({ reviewDecision: "REVIEW_REQUIRED", mergeStateStatus: "BLOCKED" }), now), /^WAITING review-required/);
	assert.match(prVerdict(pr({ mergeStateStatus: "BLOCKED" }), now), /^BLOCKER merge-blocked/);
	assert.match(prVerdict(pr({ mergeStateStatus: "BLOCKED" }, [run("Code Review Gate", "COMPLETED", "ACTION_REQUIRED")]), now), /^WAITING approval: Code Review Gate/);
	assert.match(prVerdict(pr({}, [run("Code Review Gate", "COMPLETED", "ACTION_REQUIRED"), run("lint", "COMPLETED", "FAILURE")]), now), /^BLOCKER failing-checks: lint \(/);
	assert.match(prVerdict(pr({}, []), now), /^READY ci-none/);
	assert.match(prVerdict(pr({ mergeStateStatus: "BLOCKED" }, []), now, ["build"]), /^WAITING checks: build \(required, not started\)/);
	assert.match(prVerdict(pr({}, [run("build", "COMPLETED", "SUCCESS")]), now, ["build"]), /^READY \(/);
	assert.match(prVerdict(pr({}, [run("lint", "COMPLETED", "FAILURE")]), now, ["build"]), /^BLOCKER failing-checks: lint/);
});

const PR_FIXTURE = JSON.parse(readFileSync(new URL("./pr-state.fixture.json", import.meta.url), "utf8"));
const fixturePr = (reviews = [], over = {}) => ({ ...PR_FIXTURE.pullRequest, reviews: { nodes: reviews.map((r) => (typeof r === "string" ? PR_FIXTURE.reviews[r] : r)) }, ...over });

test("pr-state blocks on a base that moved in this PR's files, and counts the rest", () => {
	const now = Date.parse(PR_FIXTURE.now);
	const { even, elsewhere, shared } = PR_FIXTURE.compare;
	assert.equal(prVerdict(fixturePr(), now, [], even), "READY (head c3c3c3c3c3c3)");
	assert.equal(prVerdict(fixturePr(), now, [], elsewhere), "READY base: main is 1 commit ahead, in none of this PR's files (head c3c3c3c3c3c3)");
	assert.equal(
		prVerdict(fixturePr(), now, [], shared),
		"BLOCKER base-moved: main is 3 commits ahead and changes files this PR changes: src/app.js; merge it in and run the proof again (head c3c3c3c3c3c3)",
	);
	assert.match(prVerdict(fixturePr(), now, [], { ...elsewhere, count: 300 }), /^BLOCKER base-moved: .* changes more files than pr-state reads;/, "a cut-off compare cannot rule out this PR's files");
	const manyFiles = { files: { ...PR_FIXTURE.pullRequest.files, pageInfo: { hasNextPage: true } } };
	assert.match(prVerdict(fixturePr([], manyFiles), now, [], elsewhere), /^BLOCKER base-moved/, "nor can a PR with more files than pr-state reads");
	const renamed = fixturePr();
	renamed.files = { pageInfo: { hasNextPage: false }, nodes: [{ path: "src/new-name.js", changeType: "RENAMED" }] };
	assert.match(prVerdict(renamed, now, [], elsewhere), /^BLOCKER base-moved: .*renames a file whose old path GitHub does not report/, "a base change to a renamed file's old path is invisible, so it blocks");
	assert.match(prVerdict(fixturePr([], { mergeable: "CONFLICTING" }), now, [], shared), /^BLOCKER conflicts/, "a conflict is the more specific cause");
	assert.match(prVerdict(fixturePr([], { mergeStateStatus: "BEHIND" }), now, [], elsewhere), /^BLOCKER behind-base/, "a branch rule can still ask for an up-to-date branch");
	assert.equal(prVerdict({ ...fixturePr(), state: "MERGED" }, now), "MERGED (head c3c3c3c3c3c3)");
});

test("pr-state waits for a review bot that reviews pushes, and blocks on its findings outside review threads", () => {
	const now = Date.parse(PR_FIXTURE.now);
	const recent = { updatedAt: "2026-11-21T11:48:00Z" };
	const twoHeads = ["codexOnOpen", "rabbitFirst", "humanReply", "rabbitSecond"];
	assert.equal(
		prVerdict(fixturePr(twoHeads, recent), now),
		"WAITING bot-review: coderabbitai reviewed earlier heads but not this one yet; the last push, comment, review or edit was 720s ago, and bots get 20 minutes (head c3c3c3c3c3c3)",
		"past the settle, a bot that reviewed two heads still gets its own wait",
	);
	assert.match(prVerdict(fixturePr([...twoHeads, "rabbitReply"], recent), now), /^WAITING bot-review: coderabbitai /, "a reply in a thread is not a review of the head");
	assert.equal(
		prVerdict(fixturePr(twoHeads), now),
		"READY bot-unreviewed: coderabbitai reviewed earlier heads but not this one in 20 minutes; ask once for a review of this head (head c3c3c3c3c3c3)",
		"a bot that paused or ran out of reviews cannot hold the PR forever, and the Codex connector, with one head, is not awaited",
	);
	assert.equal(prVerdict(fixturePr(["codexOnOpen", "rabbitFirst"], recent), now), "READY (head c3c3c3c3c3c3)", "a bot that reviewed one head gets only the settle");
	const restShaped = (r, oid) => ({ ...PR_FIXTURE.reviews[r], author: { login: "reviewer[bot]" }, commit: { oid } });
	assert.match(prVerdict(fixturePr([restShaped("rabbitFirst", "a1"), restShaped("rabbitSecond", "b2")], recent), now), /^WAITING bot-review: reviewer\[bot\] /);

	const onHead = [...twoHeads, "rabbitReply", "rabbitOutsideDiff"];
	assert.equal(
		prVerdict(fixturePr(onHead), now),
		"BLOCKER bot-findings: comments outside any review thread in coderabbitai PRR_rabbit4 (2 outside-diff, 1 nitpick): triage them, then react to each review; bot-rounds: chatgpt-codex-connector 1, coderabbitai 3 (head c3c3c3c3c3c3)",
	);
	const thread = { reviewThreads: { pageInfo: { hasNextPage: false }, nodes: [{ id: "PRRT_a", isResolved: false, path: "src/app.js", line: 12 }] } };
	assert.match(
		prVerdict(fixturePr(onHead, thread), now),
		/^BLOCKER review-threads: 1 unresolved: PRRT_a src\/app\.js:12; bot-findings: .*PRR_rabbit4 .*; bot-rounds: chatgpt-codex-connector 1, coderabbitai 3 \(head/,
		"threads come first, and the bot findings ride along so one push can answer both",
	);
	const failing = { commits: { nodes: [{ commit: { committedDate: "2026-11-21T11:00:00Z", statusCheckRollup: { contexts: { nodes: [{ __typename: "CheckRun", name: "test", status: "COMPLETED", conclusion: "FAILURE" }] } } } }] } };
	assert.match(prVerdict(fixturePr(onHead, failing), now), /^BLOCKER failing-checks: test; bot-findings: .*; bot-rounds: /);
	const triaged = { ...PR_FIXTURE.reviews.rabbitOutsideDiff, reactionGroups: [{ viewerHasReacted: false }, { viewerHasReacted: true }] };
	assert.equal(prVerdict(fixturePr([...twoHeads, triaged]), now), "READY (head c3c3c3c3c3c3)", "a reaction from the gh account marks the review triaged");
	const inlineOnly = { ...PR_FIXTURE.reviews.rabbitFirst, id: "PRR_inline", commit: { oid: PR_FIXTURE.pullRequest.headRefOid } };
	assert.equal(prVerdict(fixturePr([...twoHeads, inlineOnly]), now), "READY (head c3c3c3c3c3c3)", "the actionable count alone is the review's threads, so it blocks nothing");
	assert.match(prVerdict(fixturePr(onHead, { isDraft: true }), now, [], PR_FIXTURE.compare.shared), /^BLOCKER draft: mark it ready; bot-findings: /);
});

test("check holds a rework like a fix, unless it is skipped", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "reworking.md"), "1. Rework it.\n   Artifact: `evidence/rework.md`\n");
	brief(home, "rw", { playbook: "reworking", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "rw");
	writeFileSync(join(task, "evidence/rework.md"), "Rewrote it myself.\n");
	assert.throws(() => check(home, "rw", 1), /cites no results\/<name>\.md/);
	mkdirSync(join(task, "briefs"));
	mkdirSync(join(task, "results"));
	writeFileSync(join(task, "briefs/rework.md"), "SKILLS none\n");
	writeFileSync(join(task, "results/rework.md"), "DONE rewrote\n");
	writeFileSync(join(task, "evidence/rework.md"), "Brief `briefs/rework.md`, result `results/rework.md`.\n");
	assert.throws(() => check(home, "rw", 1), /lists the tdd skill/);
	writeFileSync(join(task, "briefs/rework.md"), "SKILLS tdd\n");
	check(home, "rw", 1);
	writeFileSync(join(task, "evidence/rework.md"), "skip: MODERNIZE, no rewrite\n");
	check(home, "rw", 1);
});

test("pr-state retries gh only on a failure that can pass on its own", () => {
	for (const message of ["HTTP 502: Bad Gateway", "HTTP 429", "You have exceeded a secondary rate limit", "read: connection reset by peer", "unexpected EOF", "dial tcp: i/o timeout"])
		assert.ok(isTransient(message), message);
	for (const message of ["API rate limit exceeded for user ID 1", "HTTP 404: Not Found", "Could not resolve to a PullRequest with the number of 9", "HTTP 401: Bad credentials"])
		assert.ok(!isTransient(message), message);
});

test("every skill's name matches its folder, so each one installs and invokes by that name", () => {
	const skills = join(HERE, "../..");
	for (const entry of readdirSync(skills, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const dir = entry.name;
		const name = readFileSync(join(skills, dir, "SKILL.md"), "utf8").match(/^name:\s*(\S+)/m)?.[1];
		assert.equal(name, dir);
	}
});

test("every skill marked for explicit use also tells Codex, which ignores the frontmatter flag", () => {
	const skills = join(HERE, "../..");
	for (const entry of readdirSync(skills, { withFileTypes: true })) {
		if (!entry.isDirectory()) continue;
		const explicit = /^disable-model-invocation:\s*true\s*$/m.test(readFileSync(join(skills, entry.name, "SKILL.md"), "utf8"));
		const file = join(skills, entry.name, "agents", "openai.yaml");
		const policy = existsSync(file) ? readFileSync(file, "utf8") : "";
		assert.equal(/allow_implicit_invocation:\s*false/.test(policy), explicit, entry.name);
	}
});

test("a granted close lets a task end with skipped delegating steps and a denied gate", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "gated-fix.md"), "1. Design it.\n   Artifact: `decisions/design.md`\n2. Fix it.\n   Artifact: `evidence/fix.md`\n");
	brief(home, "cl", { playbook: "gated-fix", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "cl");
	mkdirSync(join(task, "decisions"));
	writeFileSync(join(task, "decisions/design.md"), "# Approve?\n\n## Answer\n\ndenied\nnot this way, 2026-11-12\n");
	writeFileSync(join(task, "evidence/fix.md"), "skip: closed, see decisions/close.md\n");
	writeFileSync(join(task, "report.md"), REPORT);
	assert.throws(() => check(home, "cl"), /decisions\/design\.md with a granted answer[\s\S]*a skip: line does not excuse it/);
	writeFileSync(join(task, "decisions/close.md"), "# Close?\n\nKind: close\n");
	assert.throws(() => check(home, "cl"), /a skip: line does not excuse it/, "an unanswered close is no close");
	writeFileSync(join(task, "decisions/close.md"), "# Close?\n\nKind: close\n\n## Answer\n\ngranted\nclose it, 2026-11-12\n");
	assert.equal(check(home, "cl"), "ok cl: 3 required files present");
	writeFileSync(join(task, "report.md"), "skip: closed\n");
	assert.throws(() => check(home, "cl"), /report\.md has no ## Remember heading/, "a closed task still reports");
	writeFileSync(join(task, "report.md"), REPORT);
	mkdirSync(join(task, "evidence/reviews"));
	writeFileSync(join(task, "evidence/reviews/final.md"), "Standards reviewer started.\nskip: closed, see decisions/close.md\n");
	assert.equal(check(home, "cl"), "ok cl: 3 required files present", "a closed task's half-written review may carry its skip line below the start");
	rmSync(join(task, "decisions/close.md"));
	assert.throws(() => check(home, "cl"), /reviews\/final\.md does not open with/, "outside a close it may not");
});

test("a gate denied and granted again under its next name counts, and a closed task may skip its plan check", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "planned.md"), "1. Design it.\n   Artifact: `decisions/design.md`\n2. Spec it.\n   Artifact: `evidence/check-plan.md`\n");
	brief(home, "rg", { playbook: "planned", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "rg");
	mkdirSync(join(task, "decisions"));
	writeFileSync(join(task, "decisions/design.md"), "## Answer\n\ndenied\nchange the API, 2026-11-12\n");
	assert.throws(() => check(home, "rg", 1), /decisions\/design\.md with a granted answer/);
	writeFileSync(join(task, "decisions/design-2.md"), "## Answer\n\ngranted\nyes, 2026-11-12\n");
	assert.equal(check(home, "rg", 1), "ok rg: 1 required file present");
	rmSync(join(task, "decisions/design.md"));
	assert.throws(() => check(home, "rg", 1), /decisions\/design\.md with a granted answer/, "a revision needs its original");
	writeFileSync(join(task, "decisions/design.md"), "## Answer\n\ndenied\nchange the API, 2026-11-12\n");
	rmSync(join(task, "decisions/design-2.md"));
	const outside = join(home, "..", "granted.md");
	writeFileSync(outside, "## Answer\n\ngranted\nforged\n");
	symlinkSync(outside, join(task, "decisions/design-2.md"));
	assert.throws(() => check(home, "rg", 1), /link to outside the task directory/, "a revision may not point outside the task");
	rmSync(join(task, "decisions/design-2.md"));
	writeFileSync(join(task, "decisions/design-2.md"), "## Answer\n\ngranted\nyes, 2026-11-12\n");
	writeFileSync(join(task, "decisions/design-3.md"), "## Answer\n\ndenied\nno, 2026-11-12\n");
	assert.throws(() => check(home, "rg", 1), /granted answer/, "the latest answer decides");
	rmSync(join(task, "decisions/design-3.md"));
	writeFileSync(join(task, "spec-doc.md"), "v2\n");
	writeFileSync(join(task, "evidence/check-plan.md"), `${join(task, "spec-doc.md")} sha256 ${"0".repeat(64)}\nskip: closed, see decisions/close.md\n`);
	writeFileSync(join(task, "report.md"), REPORT);
	assert.throws(() => check(home, "rg"), /not a clean check-plan\.mjs run/);
	writeFileSync(join(task, "decisions/close.md"), "## Answer\n\ngranted\nclose it, 2026-11-12\n");
	assert.equal(check(home, "rg"), "ok rg: 3 required files present");
	writeFileSync(join(task, "spec.md"), "v2\n");
	writeFileSync(join(task, "decisions/spec.md"), `Subject: \`spec.md\` ${"0".repeat(64)}\n\n## Answer\n\ngranted\nyes\n`);
	assert.equal(check(home, "rg"), "ok rg: 3 required files present", "a closed task does not check granted documents for changes");
	writeFileSync(join(task, "decisions/design-3.md"), "# Approve the revision?\n");
	assert.equal(check(home, "rg"), "ok rg: 3 required files present", "a closed task's gate passes with an unanswered later revision");
	rmSync(join(task, "decisions/design-3.md"));
	const other = join(home, "tasks", "other-close.md");
	writeFileSync(other, "## Answer\n\ngranted\nanother task's close\n");
	rmSync(join(task, "decisions/close.md"));
	symlinkSync(other, join(task, "decisions/close.md"));
	assert.throws(() => check(home, "rg"), /link to outside the task directory/, "a close linked from elsewhere is refused");
	rmSync(join(task, "decisions/close.md"));
	writeFileSync(join(task, "decisions/close.md"), "## Answer\n\ngranted\nclose it, 2026-11-12\n");
	rmSync(join(task, "decisions/close.md"));
	assert.throws(() => check(home, "rg"), /spec\.md changed after decisions\/spec\.md granted it/);
});

test("check --head holds a closed task to a commit SHA but not to proof of that head", () => {
	const { dir, home, playbooks } = scratch();
	const git = (...args) => execFileSync("git", ["-C", dir, "-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8" }).trim();
	writeFileSync(join(dir, "a.txt"), "1\n");
	git("add", "a.txt");
	git("commit", "-q", "-m", "one");
	const one = git("rev-parse", "HEAD");
	writeFileSync(join(dir, "a.txt"), "2\n");
	git("commit", "-q", "-am", "two");
	const two = git("rev-parse", "HEAD");
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	brief(home, "ch", { playbook: "plain", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "ch");
	writeFileSync(join(task, "report.md"), REPORT);
	writeFileSync(join(task, "evidence/verify.md"), `Head ${one.slice(0, 12)}\n`);
	assert.throws(() => check(home, "ch", undefined, two, dir), /names no commit with the same tree/);
	mkdirSync(join(task, "decisions"));
	writeFileSync(join(task, "decisions/close.md"), "## Answer\n\ngranted\nclose it, 2026-11-12\n");
	assert.equal(check(home, "ch", undefined, two, dir), "ok ch: 1 required file present");
	assert.throws(() => check(home, "ch", undefined, "nothex", dir), /--head must be a commit SHA/);
});

test("check refuses a proof table row whose verdict is failed", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "proving.md"), "1. Prove it.\n   Artifact: `evidence/verify.md`\n");
	brief(home, "pf", { playbook: "proving", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "pf");
	mkdirSync(join(task, "evidence/proof"));
	writeFileSync(join(task, "evidence/proof/run.txt"), "ok\n");
	const table = (verdict) => `| Claim | Action | Evidence | Verdict |\n| --- | --- | --- | --- |\n| Saves the note | Save it | \`evidence/proof/run.txt\` | ${verdict} |\n`;
	writeFileSync(join(task, "evidence/verify.md"), table("failed"));
	assert.throws(() => check(home, "pf", 1), /has a failed claim: Saves the note/);
	writeFileSync(join(task, "evidence/verify.md"), "Claim | Action | Evidence | Verdict\n--- | --- | --- | ---\nSaves the note | Save it | `evidence/proof/run.txt` | failed\n");
	assert.throws(() => check(home, "pf", 1), /has a failed claim: Saves the note/, "a row without outer pipes counts");
	writeFileSync(join(task, "evidence/verify.md"), `Status options: \`passed\` | \`failed\`\n\n${table("passed")}`);
	assert.equal(check(home, "pf", 1), "ok pf: 1 required file present", "a prose line with pipes is no claim");
	writeFileSync(join(task, "evidence/verify.md"), "| Claim | Evidence | Verdict | Notes |\n| --- | --- | --- | --- |\n| Saves the note | `evidence/proof/run.txt` | failed | retry later |\n");
	assert.throws(() => check(home, "pf", 1), /has a failed claim: Saves the note/, "the Verdict column counts, not the last one");
	writeFileSync(join(task, "evidence/verify.md"), "| Claim | Evidence | Verdict |\n| - | - | - |\n| Saves A \\| B | `evidence/proof/run.txt` | failed |\n");
	assert.throws(() => check(home, "pf", 1), /has a failed claim: Saves A \\\| B/, "a one-hyphen separator and an escaped pipe both count");
	for (const verdict of ["**failed**", "`failed`", "_Failed_"]) {
		writeFileSync(join(task, "evidence/verify.md"), table(verdict));
		assert.throws(() => check(home, "pf", 1), /has a failed claim/, `${verdict} counts as failed`);
	}
	writeFileSync(join(task, "evidence/verify.md"), `${table("failed")}\nskip: no screenshot\n`);
	assert.throws(() => check(home, "pf", 1), /has a failed claim/, "a skip line does not hide a failed row");
	writeFileSync(join(task, "evidence/verify.md"), table("passed"));
	assert.equal(check(home, "pf", 1), "ok pf: 1 required file present");
});

test("check --head on pr delivery wants pr-state's READY or MERGED line for the head, and reviews name it on line 1", () => {
	const { dir, home, playbooks } = scratch();
	const git = (...args) => execFileSync("git", ["-C", dir, "-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8" }).trim();
	writeFileSync(join(dir, "a.txt"), "1\n");
	git("add", "a.txt");
	git("commit", "-q", "-m", "one");
	const one = git("rev-parse", "HEAD");
	writeFileSync(join(dir, "a.txt"), "2\n");
	git("commit", "-q", "-am", "two");
	const two = git("rev-parse", "HEAD");
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	brief(home, "prh", { playbook: "plain", goal: "g", finish: "f", delivery: "pr", playbooksDir: playbooks });
	const task = join(home, "tasks", "prh");
	writeFileSync(join(task, "report.md"), REPORT);
	writeFileSync(join(task, "evidence/babysit.md"), "drive mode, all green\n");
	assert.throws(() => check(home, "prh", undefined, two, dir), /babysit\.md.s latest pr-state line for \w+ is missing/);
	writeFileSync(join(task, "evidence/babysit.md"), `READY (head ${one.slice(0, 12)})\n`);
	assert.throws(() => check(home, "prh", undefined, two, dir), /is missing, not READY or MERGED/, "an older head's READY does not count");
	writeFileSync(join(task, "evidence/babysit.md"), `WAITING checks: ci (head ${two.slice(0, 12)})\nskip: no screenshot\n`);
	assert.throws(() => check(home, "prh", undefined, two, dir), /latest pr-state line for \w+ is WAITING/, "a stray skip line waives nothing");
	writeFileSync(join(task, "evidence/babysit.md"), `READY (head ${two.slice(0, 12)})\nBLOCKER review-threads: 1 unresolved (head ${two.slice(0, 12)})\n`);
	assert.throws(() => check(home, "prh", undefined, two, dir), /is BLOCKER, not READY or MERGED/, "the newest verdict for the head counts");
	writeFileSync(join(task, "evidence/babysit.md"), `WAITING checks: ci (head ${two.slice(0, 12)})\nREADY (head ${two.slice(0, 12)})\n`);
	assert.equal(check(home, "prh", undefined, two, dir), "ok prh: 2 required files present");
	mkdirSync(join(task, "evidence/reviews"));
	writeFileSync(join(task, "evidence/reviews/final.md"), `Base ${two}\n\nHead ${one.slice(0, 7)}, round 1\n`);
	assert.throws(() => check(home, "prh", undefined, two, dir), /final\.md names no commit[\s\S]*final\.md does not open with "Head <sha>, round <n>"/);
	writeFileSync(join(task, "evidence/reviews/final.md"), `Reviewed ${one}\n\nskip: the docs axis, nothing to read\n`);
	assert.throws(() => check(home, "prh", undefined, two, dir), /final\.md names no commit[\s\S]*final\.md does not open/, "a skip note inside a review is no skipped review");
	writeFileSync(join(task, "evidence/reviews/final.md"), `Head ${two.slice(0, 7)}, round 1\n\nBase ${one}\n`);
	assert.equal(check(home, "prh", undefined, two, dir), "ok prh: 2 required files present");
});

test("check refuses a committed document that changed after the commit its grant names", () => {
	const { dir, home, playbooks } = scratch();
	const git = (...args) => execFileSync("git", ["-C", dir, "-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8" }).trim();
	mkdirSync(join(dir, "docs/feat"), { recursive: true });
	writeFileSync(join(dir, "docs/feat/design.md"), "v1\n");
	git("add", "docs");
	git("commit", "-q", "-m", "design");
	const granted = git("rev-parse", "HEAD");
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	brief(home, "cd", { playbook: "plain", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "cd");
	writeFileSync(join(task, "report.md"), REPORT);
	mkdirSync(join(task, "decisions"));
	writeFileSync(join(task, "decisions/design.md"), `# Approve?\n\nSubject: \`docs/feat/design.md\` at ${granted.slice(0, 12)}\n\n## Answer\n\ngranted\nyes, 2026-11-12\n`);
	assert.equal(check(home, "cd", undefined, undefined, dir), "ok cd: 1 required file present");
	writeFileSync(join(dir, "docs/feat/design.md"), "v2\n");
	assert.throws(() => check(home, "cd", undefined, undefined, dir), /docs\/feat\/design\.md changed after decisions\/design\.md granted it/, "an uncommitted edit counts");
	git("commit", "-q", "-am", "rewrite");
	assert.throws(() => check(home, "cd", undefined, undefined, dir), /changed after decisions\/design\.md granted it/, "so does a committed one");
	writeFileSync(join(dir, "docs/feat/[draft].md"), "v1\n");
	writeFileSync(join(dir, "docs/feat/d.md"), "v1\n");
	git("add", "docs");
	git("commit", "-q", "-m", "draft");
	writeFileSync(join(task, "decisions/design.md"), `Subject: \`docs/feat/[draft].md\` at ${git("rev-parse", "HEAD")}\n\n## Answer\n\ngranted\nyes\n`);
	writeFileSync(join(dir, "docs/feat/d.md"), "v2\n");
	assert.equal(check(home, "cd", undefined, undefined, dir), "ok cd: 1 required file present", "a glob character in the path matches only that file");
	writeFileSync(join(task, "decisions/design.md"), "Subject: `docs/feat/design.md` at HEAD\n\n## Answer\n\ngranted\nyes\n");
	assert.throws(() => check(home, "cd", undefined, undefined, dir), /names its document at HEAD: write the commit SHA/);
	writeFileSync(join(task, "decisions/design.md"), `Subject: \`docs/feat/design.md\` at 0000000\n\n## Answer\n\ngranted\nyes\n`);
	assert.throws(() => check(home, "cd", undefined, undefined, dir), /at 0000000, which this checkout does not hold/);
});

test("every command refuses a flag it does not take", () => {
	assert.throws(() => main(["brief", "t1", "--playbook", "plain", "--goal", "g", "--finish", "f", "--deliver", "pr"]), /brief takes no --deliver; its flags are --playbook, --goal, --finish, --kind, --delivery, --design, --acceptance, --push, --merge/);
	assert.throws(() => main(["backlog", "t1", "--all", "1"]), /backlog takes no --all; its flags are none/);
	assert.throws(() => main(["check", "t1", "--trough", "1"]), /check takes no --trough/);
	assert.throws(() => main(["home", "--verbose", "1"]), /home takes no --verbose; its flags are none/);
	assert.throws(() => main(["lock", "simulator"]), /lock needs --task <id>/);
	assert.throws(() => main(["unlock", "--task", "t1"]), /unlock takes one lock name/);
	assert.throws(() => main(["preflight", "extra"]), /preflight takes no arguments/);
	assert.throws(() => main(["preflight", "--runtime", "cloud"]), /--runtime must be t3, herdr or standalone/);
	assert.throws(() => main(["seat", "lead", "--runtime", "t3", "--task", "../t1"]), /task id must match/);
});

const TEMPLATE = readFileSync(new URL("../../tstack-setup/SKILL.md", import.meta.url), "utf8").match(/```text\n(# tstack models[\s\S]*?)```/)[1];

function withGlobal(home, text) {
	const globalDir = join(home, "..", "global");
	mkdirSync(globalDir, { recursive: true });
	if (text !== undefined) writeFileSync(join(globalDir, "models.md"), text);
	return globalDir;
}

test("a task's models file overrides the project's and the global one for that task only", () => {
	const { home, playbooks } = scratch();
	brief(home, "t1", { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks });
	brief(home, "t2", { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks });
	const globalDir = withGlobal(home, "lead: claude/claude-opus-5-5@high\nreview: claude/claude-fable-5-2@high, codex/gpt-6.1-sol@high\nverify: claude/claude-opus-5-5@high\n");
	writeFileSync(join(home, "models.md"), "verify: codex/gpt-6.1-sol@high\n");
	writeFileSync(join(home, "tasks", "t1", "models.md"), "# 2026-11-21, the human: use fast mode for the coding and reviews\nreview: claude/claude-opus-5-5@high+fast, codex/gpt-6.1-sol+fast\n");
	const configured = (task, role) => seat(loadModels(home, globalDir, task), role, "standalone").map((s) => s.configured);
	assert.deepEqual(configured("t1", "review"), ["claude/claude-opus-5-5@high+fast", "codex/gpt-6.1-sol+fast"]);
	assert.deepEqual(configured("t1", "verify"), ["codex/gpt-6.1-sol@high"], "a role the task file leaves out keeps the project's line");
	assert.deepEqual(configured("t1", "lead"), ["claude/claude-opus-5-5@high"]);
	assert.deepEqual(configured("t2", "review"), ["claude/claude-fable-5-2@high", "codex/gpt-6.1-sol@high"], "another task keeps the shared file");
	assert.deepEqual(configured(undefined, "review"), ["claude/claude-fable-5-2@high", "codex/gpt-6.1-sol@high"]);
	assert.throws(() => loadModels(home, globalDir, "t9"), /no task t9 at/);
	assert.throws(() => loadModels(home, globalDir, "../t1"), /task id must match/);
	writeFileSync(join(home, "tasks", "t1", "models.md"), "herdr args claude: --dangerously-skip-permissions\n");
	assert.throws(() => loadModels(home, globalDir, "t1"), /tasks\/t1\/models\.md is allowed only in/);
	writeFileSync(join(home, "tasks", "t1", "models.md"), "review claude/claude-opus-5-5\n");
	assert.throws(() => loadModels(home, globalDir, "t1"), /tasks\/t1\/models\.md: models file line 1 is not "role: seats"/);
});

test("a +fast seat sets T3's fast option, and check-seats checks it in both catalog shapes", () => {
	const instances = "t3 instances: claude=claudeAgent/effort/fastMode, codex=codex/reasoningEffort/serviceTier=priority, pi=pi/thinking";
	const models = parseModels(`lead: claude/claude-opus-5-5@xhigh+fast\nfeature: codex/gpt-6.1-sol+FAST\nbug-fix: pi/openai/gpt-6.1-sol@high+fast\n${instances}`);
	assert.deepEqual(seat(models, "lead", "t3"), [
		{ providerInstanceId: "claudeAgent", model: "claude-opus-5-5", options: [{ id: "effort", value: "xhigh" }, { id: "fastMode", value: true }] },
	]);
	assert.deepEqual(seat(models, "feature", "t3"), [{ providerInstanceId: "codex", model: "gpt-6.1-sol", options: [{ id: "serviceTier", value: "priority" }] }]);
	assert.throws(() => seat(models, "bug-fix", "t3"), /no fast option for harness pi in the "t3 instances" line/);
	assert.throws(() => seat(models, "lead", "herdr"), /no Herdr fast-mode flag known for harness claude: drop \+fast/);
	assert.deepEqual(seat(models, "lead", "standalone"), [{ inherit: true, configured: "claude/claude-opus-5-5@xhigh+fast" }]);
	assert.equal(seat(models, "lead", "standalone", "gpt-6.1-sol")[0].configured, "claude/claude-opus-5-5@xhigh+fast", "--cross reads the family without +fast");
	assert.throws(() => seat(parseModels("lead: inherit+fast"), "lead", "t3"), /seat must be harness\/model\[@effort\]\[\+fast\] or inherit/);

	const template = parseModels(TEMPLATE).get("t3 instances");
	const fixture = JSON.parse(readFileSync(new URL("./t3-catalog.fixture.json", import.meta.url), "utf8"));
	const live = {
		providers: [
			{ providerInstanceId: "claudeAgent", canRunChildTask: true, models: [
				{ id: "claude-opus-5-5", options: [{ id: "effort", values: ["low", "high", "xhigh"], default: "medium" }, { id: "fastMode", values: [false, true] }] },
				{ id: "claude-fable-5-2", options: [{ id: "effort", values: ["high"] }] },
			] },
			{ providerInstanceId: "codex", canRunChildTask: true, models: [{ id: "gpt-6.1-sol", options: [{ id: "reasoningEffort", values: ["high"] }, { id: "serviceTier", values: ["default", "priority"] }] }] },
		],
	};
	for (const [shape, caps] of [["fixture", fixture], ["live", live]]) {
		const check = (lines) => checkSeats(parseModels(`${lines}\nt3 instances: ${template}`), caps, null);
		assert.equal(check("lead: claude/claude-opus-5-5@xhigh+fast\nfeature: codex/gpt-6.1-sol@high+fast"), "ok: 2 seats advertised", shape);
		assert.throws(() => check("lead: claude/claude-fable-5-2@high+fast"), /fastMode true not offered \(no such option\)/, shape);
		assert.throws(() => check("lead: claude/claude-opus-5-5@ultra"), /effort ultra not offered/, shape);
	}
	assert.throws(() => checkSeats(parseModels("lead: codex/gpt-6.1-sol+fast\nt3 instances: codex=codex/reasoningEffort/serviceTier=turbo"), live, null), /serviceTier turbo not offered \(default, priority\)/);
	assert.throws(() => checkSeats(parseModels("lead: claude/claude-opus-5-5@high\nt3 instances: claude=claudeAgent/fastMode"), live, null), /fastMode is an on\/off option, so drop the @high effort/);
});

test("preflight names each seat that will not resolve, a locked signing key and a logged-out gh", () => {
	const { dir, home, playbooks } = scratch();
	const git = (...args) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" });
	git("config", "user.name", "Test");
	git("config", "user.email", "test@example.com");
	git("config", "commit.gpgsign", "false");
	git("commit", "-q", "--allow-empty", "-m", "init");
	const bin = join(dir, "..", `${dir.split("/").at(-1)}-bin`);
	mkdirSync(bin);
	const script = (name, body) => {
		writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
		return join(bin, name);
	};
	script("gh", "exit 0");
	const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` };
	const globalDir = withGlobal(home, TEMPLATE);
	const run = (runtime, task) => preflight(home, runtime, task, { cwd: dir, env, globalDir });
	assert.match(run("t3"), /^ok: \d+ roles resolve on t3; commits need no signature; gh is logged in$/);
	assert.match(run("herdr"), /^ok: /);
	assert.match(run(undefined), /^ok: \d+ roles resolve; /);

	writeFileSync(join(globalDir, "models.md"), "lead: claude/claude-opus-5-5@high\nswarm workers: grok/grok-4.7\nt3 instances: claude=claudeAgent/effort\n");
	assert.throws(() => run("t3"), (err) => {
		assert.match(err.message, /^seat "verify": no line for role "verify" in the models file; run tstack-setup to write it$/m);
		assert.match(err.message, /^seat "swarm workers": no T3 instance for harness grok/m);
		assert.doesNotMatch(err.message, /seat "lead"/);
		return true;
	});
	rmSync(join(globalDir, "models.md"));
	assert.throws(() => run("t3"), /no models file at .*models\.md: run tstack-setup$/m);
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	brief(home, "own", { playbook: "plain", goal: "g", finish: "f", playbooksDir: playbooks });
	writeFileSync(join(home, "tasks", "own", "models.md"), TEMPLATE);
	assert.match(run("t3", "own"), /^ok: /, "a task's own complete models file is enough");
	writeFileSync(join(globalDir, "models.md"), TEMPLATE);

	const head = git("rev-parse", "HEAD");
	const refs = git("for-each-ref");
	git("config", "gpg.format", "openpgp");
	git("config", "commit.gpgsign", "true");
	git("config", "gpg.program", script("gpg-locked", "cat >/dev/null\necho 'gpg: signing failed: No pinentry' >&2\nexit 2"));
	assert.throws(() => run("t3"), /commit\.gpgsign is on, and a signed commit failed \(.+\): unlock your signing key/m);
	git("config", "gpg.program", script("gpg-open", "cat >/dev/null\nprintf '\\n[GNUPG:] SIG_CREATED D 1 8 00 1 X\\n' >&2\nprintf -- '-----BEGIN PGP SIGNATURE-----\\nfake\\n-----END PGP SIGNATURE-----\\n'"));
	assert.match(run("t3"), /; a signed commit works; /);
	assert.equal(git("rev-parse", "HEAD"), head, "preflight moves no ref");
	assert.equal(git("for-each-ref"), refs);
	const fresh = join(dir, "fresh");
	execFileSync("git", ["init", "-q", fresh]);
	for (const [k, v] of [["user.name", "Test"], ["user.email", "test@example.com"], ["gpg.format", "openpgp"], ["commit.gpgsign", "true"], ["gpg.program", git("config", "gpg.program").trim()]])
		execFileSync("git", ["-C", fresh, "config", k, v]);
	assert.match(preflight(home, "t3", undefined, { cwd: fresh, env, globalDir }), /; a signed commit works; /, "a repository with no commit can still prove its key");
	git("config", "commit.gpgsign", "false");

	script("gh", "echo 'You are not logged into any GitHub hosts. To log in, run: gh auth login' >&2\nexit 1");
	assert.throws(() => run("t3"), /gh is not logged in \(You are not logged into any GitHub hosts\. To log in, run: gh auth login\): run gh auth login$/m);
	brief(home, "local", { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks });
	assert.match(run("t3", "local"), /gh not needed for a local-only task$/);
	brief(home, "shipped", { playbook: "sample", goal: "g", finish: "f", delivery: "pr", playbooksDir: playbooks });
	assert.throws(() => run("t3", "shipped"), /gh is not logged in/);
	writeFileSync(join(home, "tasks", "local", "models.md"), "verify: claude/claude-opus-5-5@high+fast\n");
	assert.match(run("t3", "local"), /^ok: /);
	assert.throws(() => run("herdr", "local"), /seat "verify": no Herdr fast-mode flag known for harness claude/m);
	assert.throws(() => run("t3", "nope"), /no task nope at/);

	const long = "a".repeat(25);
	brief(home, long, { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks });
	assert.throws(() => run("herdr", long), new RegExp(`task id ${long} is 25 characters, and Herdr agent names hold 32, .*at most 24 characters$`, "m"));
	assert.match(run("t3", long), /^ok: /, "only Herdr limits the name");
	const fits = "a".repeat(24);
	brief(home, fits, { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks });
	assert.match(run("herdr", fits), /^ok: /);
	brief(home, "1-fix", { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks });
	assert.throws(() => run("herdr", "1-fix"), /task id 1-fix starts with "1", and Herdr agent names start with a letter/m);
	assert.match(run("t3", "1-fix"), /^ok: /, "only Herdr needs a leading letter");
});

test("lock is held by one task at a time, and a finished task must have released it", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	for (const id of ["t1", "t2"]) brief(home, id, { playbook: "plain", goal: "g", finish: "f", playbooksDir: playbooks });
	writeFileSync(join(home, "tasks", "t1", "report.md"), REPORT);
	const globalDir = withGlobal(home);
	assert.equal(lock(home, "simulator", "t1", globalDir), "locked simulator for task t1");
	assert.deepEqual(readdirSync(join(globalDir, "locks")), ["simulator"], "the draft the holder is written to is gone");
	writeFileSync(join(globalDir, "locks", "simulator.99.draft"), `task: t2\nhome: ${home}\nsince: now\n`);
	const checkT2 = () => {
		try {
			return check(home, "t2", undefined, undefined, process.cwd(), globalDir);
		} catch (err) {
			return err.message;
		}
	};
	assert.doesNotMatch(checkT2(), /holds lock/, "another task's draft is no lock");
	rmSync(join(globalDir, "locks", "simulator.99.draft"));
	assert.match(readFileSync(join(globalDir, "locks", "simulator"), "utf8"), new RegExp(`^task: t1\nhome: ${home}\nsince: \\d{4}-`));
	assert.match(lock(home, "simulator", "t1", globalDir), /^simulator is already locked for task t1 since /);
	assert.throws(() => lock(home, "simulator", "t2", globalDir), /simulator is locked by task t1 in .* since .*: notify that task's lead, and never ask the human to relay$/);
	const other = scratch();
	brief(other.home, "t1", { playbook: "plain", goal: "g", finish: "f", playbooksDir: playbooks });
	assert.throws(() => lock(other.home, "simulator", "t1", globalDir), /locked by task t1 in /, "the same task ID in another project is another task");
	assert.throws(() => unlock(home, "simulator", "t2", globalDir), /not by task t2: only that task's lead unlocks it/);
	assert.throws(() => check(home, "t1", undefined, undefined, undefined, globalDir), /task t1 still holds lock simulator: run tstack\.mjs unlock simulator --task t1/);
	assert.equal(check(home, "t1", 1, undefined, undefined, globalDir), "ok t1: 0 required files present", "a step check leaves a held lock alone");
	assert.equal(unlock(home, "simulator", "t1", globalDir), "unlocked simulator");
	assert.equal(unlock(home, "simulator", "t1", globalDir), "simulator is not locked");
	assert.equal(check(home, "t1", undefined, undefined, undefined, globalDir), "ok t1: 1 required file present");
	assert.equal(lock(home, "simulator", "t2", globalDir), "locked simulator for task t2");
	assert.throws(() => lock(home, "../desktop", "t1", globalDir), /lock name must match/);
	assert.throws(() => lock(home, "desktop", "t9", globalDir), /no task t9 at/);
});

test("lock is atomic: of many tasks racing for one lock, exactly one gets it", async () => {
	const { dir, home, playbooks } = scratch();
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	const ids = Array.from({ length: 8 }, (_, i) => `racer-${i}`);
	for (const id of ids) brief(home, id, { playbook: "plain", goal: "g", finish: "f", playbooksDir: playbooks });
	const env = { ...process.env, TSTACK_GLOBAL_DIR: withGlobal(home) };
	const runs = await Promise.all(
		ids.map((id) =>
			promisify(execFile)(process.execPath, [join(HERE, "tstack.mjs"), "lock", "port-5432", "--task", id], { cwd: dir, env }).then(
				() => 0,
				(err) => err.code,
			),
		),
	);
	assert.deepEqual(runs.sort(), [0, 1, 1, 1, 1, 1, 1, 1]);
});

test("an away grant lets the lead take its recommendation on a question until the human returns, and never on a gate", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	brief(home, "away", { playbook: "plain", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "away");
	writeFileSync(join(task, "report.md"), REPORT);
	mkdirSync(join(task, "decisions"));
	const decide = (name, kind, answer) =>
		writeFileSync(join(task, "decisions", name), `# Keep the cache key?\n\nKind: ${kind}\nSubject: the cache key\n\n## Recommendation\n\nKeep it.\n\n## Answer\n\n${answer}\n`);
	const grant = "# Take my recommendation on questions while the human is away\n\nKind: away\nSubject: question decisions in this task until the human writes again\n\n## Answer\n\n";
	decide("1.md", "question", "taken\nKeep it, under `decisions/away.md`, 2026-11-21");
	assert.throws(() => check(home, "away"), /decisions\/1\.md cites decisions\/away\.md, which is missing or not granted/);
	writeFileSync(join(task, "decisions/away.md"), `${grant}\`\`\`\ngranted\n\`\`\`\n`);
	assert.throws(() => check(home, "away"), /which is missing or not granted/, "a grant inside a code block is an example");
	writeFileSync(join(task, "decisions/away.md"), `${grant.replace("Kind: away", "Kind: question")}granted\nafk, 2026-11-21\n`);
	assert.throws(() => check(home, "away"), /cites decisions\/away\.md, which is not a Kind: away grant/);
	writeFileSync(join(task, "decisions/away.md"), `${grant}granted\nafk, take your recommendation, 2026-11-21\n`);
	assert.equal(check(home, "away"), "ok away: 1 required file present");
	assert.match(status(home, "away"), /^open decisions: none$/m, "a question the lead took is no longer open");
	decide("gate.md", "design-approval", "taken\nApprove it, 2026-11-21");
	assert.match(status(home, "away"), /decisions\/gate\.md/, "a taken gate still waits for the human");
	rmSync(join(task, "decisions/gate.md"));
	decide("4.md", "question", "Taken\nKeep it, 2026-11-21");
	assert.throws(() => check(home, "away"), /decisions\/4\.md is taken under no away grant/, "Taken in any case is a taken answer");
	assert.match(status(home, "away"), /decisions\/4\.md/, "a taken question that check refuses stays open");
	decide("4.md", "question", "answered\nKeep it, under `decisions/away.md`, 2026-11-21");
	assert.match(status(home, "away"), /decisions\/4\.md/, "an answered question that cites the grant is refused, so it stays open");
	rmSync(join(task, "decisions/4.md"));
	decide("review-m1.md", "question", "taken\nOne more round, under `decisions/away.md`, 2026-11-21");
	assert.throws(() => check(home, "away"), /decisions\/review-m1\.md is a review checkpoint, which waits for the human/);
	rmSync(join(task, "decisions/review-m1.md"));
	decide("2.md", "question", "taken\nKeep it, 2026-11-21");
	assert.throws(() => check(home, "away"), /decisions\/2\.md is taken under no away grant/);
	decide("2.md", "question", "answered\nKeep it, under `decisions/away.md`, 2026-11-21");
	assert.throws(() => check(home, "away"), /decisions\/2\.md cites decisions\/away\.md, so its answer must open with taken/);
	decide("2.md", "question", "answered\nkeep it, 2026-11-21");
	decide("design.md", "design-approval", "taken\nApprove it, under `decisions/away.md`, 2026-11-21");
	assert.throws(() => check(home, "away"), /decisions\/design\.md is a design-approval decision, which waits for the human/);
	decide("design.md", "design-approval", "granted\nApprove it, under `decisions/away.md`, 2026-11-21");
	assert.throws(() => check(home, "away"), /design-approval decision, which waits for the human/, "a gate granted under the away grant is the lead answering for the human");
	writeFileSync(join(task, "decisions/design.md"), "# Approve?\n\nKind: design-approval\n\n## ANSWER\n\ngranted\nApprove it, under `decisions/away.md`, 2026-11-21\n");
	assert.throws(() => check(home, "away"), /design-approval decision, which waits for the human/, "an uppercase heading is still the answer");
	writeFileSync(join(task, "decisions/close.md"), "# Close?\n\n## Answer\n\ntaken\nclose it, 2026-11-21\n");
	assert.throws(() => check(home, "away"), /decisions\/close\.md is a decision with no Kind line/);
	rmSync(join(task, "decisions/design.md"));
	rmSync(join(task, "decisions/close.md"));
	assert.equal(check(home, "away"), "ok away: 1 required file present");

	mkdirSync(join(task, "evidence/reviews"));
	writeFileSync(join(task, "evidence/reviews/m3.md"), "Head def5678, round 4\n");
	decide("review-m3.md", "question", "taken\nTwo more rounds, under `decisions/away.md`, 2026-11-21");
	assert.throws(() => check(home, "away"), /review m3 is at round 4/, "a taken answer is no review checkpoint");
	rmSync(join(task, "evidence/reviews/m3.md"));
	rmSync(join(task, "decisions/review-m3.md"));

	writeFileSync(join(task, "decisions/away.md"), `${grant}granted\nafk, 2026-11-21\n\n## Ended\n\n2026-11-22, when the human wrote again.\nTaken: \`decisions/1.md\`\n`);
	assert.equal(check(home, "away"), "ok away: 1 required file present");
	decide("3.md", "question", "taken\nKeep it, under `decisions/away.md`, 2026-11-22");
	assert.throws(() => check(home, "away"), /decisions\/3\.md is taken under decisions\/away\.md, which ended without listing it/);
	writeFileSync(join(task, "decisions/away-2.md"), `${grant}granted\nstepping out again, 2026-11-22\n`);
	decide("3.md", "question", "taken\nKeep it, under `decisions/away-2.md`, 2026-11-22");
	assert.equal(check(home, "away"), "ok away: 1 required file present", "a later absence is a new grant");
});

test("status lists every task's step, what waits on the human, finished workers nobody cited, held programs and size", () => {
	const { home, playbooks } = scratch();
	assert.equal(status(home), `0 tasks under ${join(home, "tasks")}`);
	brief(home, "beta", { playbook: "sample", goal: "g", finish: "f", delivery: "pr", playbooksDir: playbooks });
	brief(home, "alpha", { playbook: "sample", goal: "g", finish: "f", kind: "scout", playbooksDir: playbooks });
	const task = join(home, "tasks", "beta");
	for (const d of ["briefs", "results", "decisions", "evidence/reviews"]) mkdirSync(join(task, d), { recursive: true });
	writeFileSync(join(task, "evidence/grounding.md"), "traced\n");
	writeFileSync(join(task, "evidence/design.md"), "pick A\n");
	for (const name of ["fix", "review", "fenced", "late", "running"]) writeFileSync(join(task, "briefs", `${name}.md`), "GOAL x\n");
	writeFileSync(join(task, "results/fix.md"), "changed a.js\nDONE fixed\n");
	writeFileSync(join(task, "results/review.md"), "BLOCKED needs a key\n");
	writeFileSync(join(task, "results/fenced.md"), "FAILED broke\n");
	writeFileSync(join(task, "results/late.md"), "DONE first\nFAILED rerun\n");
	writeFileSync(join(task, "results/running.md"), "half written\n");
	writeFileSync(join(task, "evidence/dispatch.md"), "Result `results/fix.md`.\n\n```text\nresults/fenced.md\n```\n");
	writeFileSync(join(task, "evidence/reviews/final.md"), "Head abc1234, round 1\n\nresults/review.md\n");
	writeFileSync(join(task, "decisions/merge.md"), "# Merge PR #3?\n\nKind: question\n");
	writeFileSync(join(task, "decisions/fenced.md"), "# Fenced answer?\n\n```text\n## Answer\n\ngranted\n```\n");
	writeFileSync(join(task, "decisions/scope.md"), "# Widen scope?\n\n## Answer\n\nanswered\nno, 2026-11-21\n");
	writeFileSync(join(task, "decisions/design.md"), "# Approve?\n\n## Answer\n\ndenied\nnot yet, 2026-11-21\n");
	writeFileSync(join(task, "heartbeat.txt"), "sched-123\n");
	writeFileSync(join(task, "evidence/big.bin"), Buffer.alloc(2 * 1024 * 1024));
	mkdirSync(join(home, "tasks", "stray"));
	mkdirSync(join(home, "tasks", "Odd_Name"));
	writeFileSync(
		join(home, "autopilot-fixes.md"),
		"# Queue\n\n| # | Task | State |\n| --- | --- | --- |\n| 1 | `alpha` | **held**: the human stopped it, 2026-11-03 |\n| 2 | beta | waiting |\n| 3 | gamma | merged #4 |\n",
	);
	writeFileSync(join(home, "autopilot-fixes-heartbeat.txt"), "sched-9\n");
	writeFileSync(join(home, "autopilot-notes.md"), "No table yet.\n");
	assert.doesNotMatch(status(home), /\d (B|KB|MB)$/m, "size is opt-in, because walking a large task folder is slow");
	const lines = status(home, undefined, true).split("\n");
	assert.equal(lines[0], `4 tasks under ${join(home, "tasks")}`);
	assert.equal(lines[1], "Odd_Name: not a task ID");
	lines.splice(1, 1);
	assert.match(lines[1], /^alpha: sample, scout, local-only, created \d{4}-\d\d-\d\d, no step reached, \d+(\.\d)? (B|KB)$/);
	assert.deepEqual(lines.slice(2), [
		"  held: autopilot-fixes.md says **held**: the human stopped it, 2026-11-03",
		lines[3],
		"  open decision: decisions/fenced.md: Fenced answer?",
		"  open decision: decisions/merge.md: Merge PR #3?",
		"  finished workers no evidence file cites: 2, which status beta lists",
		"  briefs with no verdict yet: 1, which status beta lists",
		"  heartbeat: sched-123",
		"stray: no task.json",
		"program autopilot-fixes.md: 3 items, 1 held, 1 waiting, 1 merged, heartbeat sched-9",
		"  held: alpha: **held**: the human stopped it, 2026-11-03",
		"program autopilot-notes.md: no queue table with a State column",
	]);
	assert.match(lines[3], /^beta: sample, ship, pr, created \d{4}-\d\d-\d\d, step 1 of 3 reached, 2\.0 MB$/, "step 2 still lacks evidence/alternatives.md");
	writeFileSync(join(task, "evidence/alternatives.md"), "A, B\n");
	writeFileSync(join(task, "report.md"), REPORT);
	writeFileSync(join(task, "decisions/close.md"), "# Close?\n\n## Answer\n\ngranted\nclose it, 2026-11-21\n");
	assert.match(status(home, undefined, true), /^beta: .*, step 2 of 3 reached, report written, closed, 2\.0 MB$/m);
});

test("status <id> shows one task's steps and lists every item", () => {
	const { home, playbooks } = scratch();
	brief(home, "one", { playbook: "sample", goal: "make it work", finish: "tests pass", playbooksDir: playbooks });
	const task = join(home, "tasks", "one");
	mkdirSync(join(task, "briefs"));
	mkdirSync(join(task, "results"));
	writeFileSync(join(task, "evidence/grounding.md"), "traced\n");
	writeFileSync(join(task, "evidence/alternatives.md"), "A, B\n");
	writeFileSync(join(task, "briefs/fix.md"), "GOAL x\n");
	writeFileSync(join(task, "results/fix.md"), "DONE fixed\n");
	writeFileSync(join(task, "briefs/probe.md"), "GOAL y\n");
	writeFileSync(join(home, "autopilot-q.md"), "| Task | State |\n| --- | --- |\n| one | held: stopped by the human, 2026-11-21 |\n");
	assert.doesNotMatch(status(home, "one"), /^size:/m);
	const lines = status(home, "one", true).split("\n");
	assert.match(lines[1], /^playbook: sample, ship, local-only delivery, created \d{4}-\d\d-\d\d$/);
	assert.match(lines[4], /^size: \d+(\.\d)? (B|KB)$/);
	assert.deepEqual([lines[0], lines[2], lines[3], ...lines.slice(5)], [
		"task one",
		"goal: make it work",
		"finish: tests pass",
		"step 1 done: Ground the change.",
		"step 2 missing evidence/design.md: Design it.",
		"step 3 names no artifact: Ship it.",
		"reached: step 1 of 3",
		"report: not written",
		"closed: no",
		"held: 1",
		"  autopilot-q.md says held: stopped by the human, 2026-11-21",
		"hold requested, not yet acknowledged: none",
		"open decisions: none",
		"finished workers no evidence file cites: 1",
		"  results/fix.md ends DONE",
		"briefs with no verdict yet: 1",
		"  briefs/probe.md",
		"heartbeat: none",
	]);
	writeFileSync(join(task, "evidence/dispatch.md"), "Brief `briefs/fix.md`, result `results/fix.md`.\n");
	assert.match(status(home, "one"), /^finished workers no evidence file cites: none$/m, "a citation under evidence/ collects it");
	writeFileSync(join(home, "autopilot-q.md"), "| Task | State |\n| --- | --- |\n| one | hold requested: stopped by the human, 2026-11-27 |\n");
	assert.match(status(home, "one"), /^held: none\nhold requested, not yet acknowledged: 1\n  autopilot-q\.md says hold requested: stopped by the human, 2026-11-27$/m, "a hold the lead has not acknowledged shows apart from a held one");
	assert.match(status(home), /^  hold requested: autopilot-q\.md says hold requested: stopped by the human, 2026-11-27$/m);
	assert.doesNotMatch(status(home), /^  held: /m);
	assert.throws(() => status(home, "missing"), /no task missing at/);
	assert.throws(() => status(home, "../one"), /task id must match/);
	assert.throws(() => main(["status", "a", "b"]), /status takes at most one task id/);
	assert.throws(() => main(["status", "--verbose", "1"]), /status takes no --verbose; its flags are --size/);
});

test("status judges a revised decision by its newest file, and one bad task never hides the rest", () => {
	const { home, playbooks } = scratch();
	brief(home, "one", { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks });
	brief(home, "two", { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "one");
	mkdirSync(join(task, "decisions"));
	writeFileSync(join(task, "decisions/design.md"), "# Approve v1?\n\nKind: design-approval\n");
	writeFileSync(join(task, "decisions/design-2.md"), "# Approve v2?\n\nKind: design-approval\n\n## Answer\n\ngranted\nyes, 2026-11-21\n");
	assert.match(status(home, "one"), /^open decisions: none$/m, "design-2.md answers the gate design.md opened");
	writeFileSync(join(task, "decisions/design-3.md"), "# Approve v3?\n\nKind: design-approval\n");
	assert.match(status(home, "one"), /^  decisions\/design-3\.md: Approve v3\?$/m);
	const json = join(home, "tasks", "two", "task.json");
	writeFileSync(json, JSON.stringify({ ...JSON.parse(readFileSync(json, "utf8")), created: 42 }));
	assert.match(status(home), /^two: sample, .*created unknown/m);
	assert.match(status(home), /^one: /m);
});

test("refPath keeps a branch name whole in a URL path", () => {
	assert.equal(refPath("main"), "main");
	assert.equal(refPath("feature/login"), "feature/login");
	assert.equal(refPath("release#1"), "release%231");
	assert.equal(refPath("fix/a?b"), "fix/a%3Fb");
});

test("status counts a closed task's denied decision as waived, as check does", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "gated.md"), "1. Design it.\n   Artifact: `decisions/design.md`\n");
	brief(home, "shut", { playbook: "gated", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "shut");
	mkdirSync(join(task, "decisions"), { recursive: true });
	writeFileSync(join(task, "decisions/design.md"), "# Approve?\n\n## Answer\n\ndenied\nnot now, 2026-11-21\n");
	assert.match(status(home, "shut"), /^reached: no step$/m, "an open task still needs a granted answer");
	writeFileSync(join(task, "decisions/close.md"), "# Close?\n\n## Answer\n\ngranted\nclose it, 2026-11-21\n");
	assert.match(status(home, "shut"), /^reached: step 1/m);
});

test("a question a playbook names needs the human's answer, so an away grant cannot take it", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "adopting.md"), "1. Decide what to adopt.\n   Artifact: `decisions/adopt.md`\n");
	brief(home, "adopt", { playbook: "adopting", goal: "g", finish: "f", kind: "scout", playbooksDir: playbooks });
	const task = join(home, "tasks", "adopt");
	writeFileSync(join(task, "report.md"), REPORT);
	mkdirSync(join(task, "decisions"));
	writeFileSync(join(task, "decisions/away.md"), "# Away\n\nKind: away\n\n## Answer\n\ngranted\nafk, 2026-11-23\n");
	const adopt = (answer) => writeFileSync(join(task, "decisions/adopt.md"), `# Adopt candidate 1?\n\nKind: question\n\n## Answer\n\n${answer}\n`);
	adopt("taken\nAdopt it, under `decisions/away.md`, 2026-11-23");
	assert.throws(() => check(home, "adopt"), /missing step 1: decisions\/adopt\.md with the human's answer/);
	adopt("answered\nadopt candidate 1, 2026-11-23");
	assert.equal(check(home, "adopt"), "ok adopt: 2 required files present");
});

test("brief carries the design source and the delivery answers, and refuses values it does not know", () => {
	const { home, playbooks } = scratch();
	const base = { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks };
	const read = (id) => readFileSync(join(home, "tasks", id, "brief.md"), "utf8");
	brief(home, "plain", base);
	assert.doesNotMatch(read("plain"), /^(Design source|Acceptance|Push|Merge):/m, "no answer, no line");
	brief(home, "full", { ...base, delivery: "pr", design: "https://figma.example/file/abc", acceptance: "phase", push: "word", merge: "squash" });
	const text = read("full");
	assert.match(text, /^Design source: https:\/\/figma\.example\/file\/abc\. Prove the change against it, as the Prove against a design section of \S+proof\.md says\.$/m);
	assert.match(text, /^Acceptance: phase\. The human accepts each phase before the next one starts/m);
	assert.match(text, /^Push: word\. Push nothing until the human says so/m);
	assert.match(text, /^Merge: squash\. At Finish, merge with `gh pr merge <pr> --squash --match-head-commit <head SHA>`\.$/m);
	const task = JSON.parse(readFileSync(join(home, "tasks", "full", "task.json"), "utf8"));
	assert.deepEqual([task.design, task.acceptance, task.push, task.merge], ["https://figma.example/file/abc", "phase", "word", "squash"]);
	brief(home, "branch", { ...base, acceptance: "branch", push: "stage" });
	assert.match(read("branch"), /^Acceptance: branch\. The human reviews the whole branch once/m);
	assert.match(read("branch"), /^Push: stage\. Push the task branch after each verified stage commit/m);
	assert.throws(() => brief(home, "x1", { ...base, acceptance: "toString" }), /--acceptance must be phase or branch/);
	assert.throws(() => brief(home, "x2", { ...base, push: "always" }), /--push must be stage or word/);
	assert.throws(() => brief(home, "x3", { ...base, delivery: "pr", merge: "ff" }), /--merge must be squash, merge or rebase/);
	assert.throws(() => brief(home, "x4", { ...base, merge: "squash" }), /--merge names how a PR merges/);
	assert.throws(() => brief(home, "x5", { ...base, design: "  " }), /--design needs a link or a path/);
});

test("check wants every claim of a design-sourced proof to cite its evidence, except a blocked one", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "proving.md"), PROVING);
	brief(home, "ds", { playbook: "proving", goal: "g", finish: "f", design: "design/settings.png", playbooksDir: playbooks });
	brief(home, "nd", { playbook: "proving", goal: "g", finish: "f", playbooksDir: playbooks });
	const rows = [
		"| Claim | Action | Evidence | Verdict |",
		"| --- | --- | --- | --- |",
		"| Empty state matches | Open with no notes | `evidence/proof/empty.png` shows both | passed |",
		"| Long title wraps | Add a long title | the title wraps | passed |",
		"| Narrow width | Resize | needs a device | blocked |",
	].join("\n");
	for (const id of ["ds", "nd"]) {
		mkdirSync(join(home, "tasks", id, "evidence/proof"));
		writeFileSync(join(home, "tasks", id, "evidence/proof/empty.png"), "png");
		writeFileSync(join(home, "tasks", id, "evidence/verify.md"), `${rows}\n`);
	}
	assert.equal(check(home, "nd", 1), "ok nd: 1 required file present", "without a design source one citation is enough");
	assert.throws(() => check(home, "ds", 1), /has a claim that cites no file under evidence\/: Long title wraps/);
	assert.throws(() => check(home, "ds", 1), (err) => !/Narrow width/.test(err.message), "a blocked claim needs no citation");
	writeFileSync(join(home, "tasks", "ds", "evidence/verify.md"), `${rows.replace("the title wraps", "`evidence/verify.md` says so")}\n`);
	assert.throws(() => check(home, "ds", 1), /Long title wraps/, "a row cannot cite the proof itself");
	writeFileSync(join(home, "tasks", "ds", "evidence/verify.md"), `${rows.replace("the title wraps", "`evidence/proof/empty.png` too")}\n`);
	assert.equal(check(home, "ds", 1), "ok ds: 1 required file present");
	writeFileSync(join(home, "tasks", "ds", "evidence/verify.md"), `${rows}\nskip: the design has no screens for this change\n`);
	assert.equal(check(home, "ds", 1), "ok ds: 1 required file present", "a skip line excuses it, as it excuses citations");
});

test("check --head reruns a proof's reuse command against the head", () => {
	const { dir, home, playbooks } = scratch();
	const git = (...args) => execFileSync("git", ["-C", dir, "-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t", ...args], { encoding: "utf8" }).trim();
	mkdirSync(join(dir, "src"));
	writeFileSync(join(dir, "src/a.txt"), "1\n");
	writeFileSync(join(dir, "package.json"), "{}\n");
	writeFileSync(join(dir, "README.md"), "1\n");
	git("add", ".");
	git("commit", "-q", "-m", "one");
	const one = git("rev-parse", "HEAD");
	writeFileSync(join(dir, "README.md"), "2\n");
	git("commit", "-q", "-am", "docs");
	const docs = git("rev-parse", "HEAD");
	writeFileSync(join(dir, "src/a.txt"), "2\n");
	git("commit", "-q", "-am", "code");
	const code = git("rev-parse", "HEAD");
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	brief(home, "ru", { playbook: "plain", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "ru");
	writeFileSync(join(task, "report.md"), REPORT);
	const proof = (head) => `Head ${head.slice(0, 12)}\n\n| Claim | Evidence | Verdict |\n| --- | --- | --- |\n| Unit tests pass | reused, \`git diff --quiet ${one.slice(0, 12)} HEAD -- src package.json\` exits 0 | passed |\n`;
	writeFileSync(join(task, "evidence/verify.md"), proof(docs));
	assert.equal(check(home, "ru", undefined, docs, dir), "ok ru: 1 required file present", "a docs commit leaves src as it was");
	writeFileSync(join(task, "evidence/verify.md"), proof(code));
	assert.throws(() => check(home, "ru", undefined, code, dir), /reuses the run at \w+, but src package\.json changed before \w+: run that claim again/);
	writeFileSync(join(task, "evidence/verify.md"), proof(code).replace(one.slice(0, 12), "0000000"));
	assert.throws(() => check(home, "ru", undefined, code, dir), /reuses the run at 0000000, which this checkout does not hold/);
	writeFileSync(join(task, "evidence/verify.md"), proof(docs).replace("-- src package.json", "-- 'my app'"));
	assert.throws(() => check(home, "ru", undefined, docs, dir), /with a quoted or escaped path/, "a quoted path would split into pathspecs that match nothing");
	writeFileSync(join(task, "evidence/verify.md"), proof(code).replace("-- src package.json", "-- src/my app"));
	assert.throws(() => check(home, "ru", undefined, code, dir), /with src\/my, app, which neither commit holds/, "an unquoted space splits a path into words that diff as unchanged");
	writeFileSync(join(task, "evidence/verify.md"), proof(code).replace("-- src package.json", "-- :(top)src/missing"));
	assert.throws(() => check(home, "ru", undefined, code, dir), /with :\(top\)src\/missing, which neither commit holds/, "a magic pathspec is checked too");
	writeFileSync(join(task, "evidence/verify.md"), proof(docs).replace("-- src package.json", "-- ."));
	assert.throws(() => check(home, "ru", undefined, docs, dir), /but \. changed before/, "the repository root is a path both commits hold");
	writeFileSync(join(task, "evidence/verify.md"), proof(code).replace("-- src package.json", "-- ./src"));
	assert.throws(() => check(home, "ru", undefined, code, dir), /but \.\/src changed before/, "a ./ path reads from the root");
});

test("backlog appends each follow-up once, with an ID that a rerun keeps", () => {
	const { home, playbooks } = scratch();
	brief(home, "fx", { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks });
	brief(home, "none", { playbook: "sample", goal: "g", finish: "f", playbooksDir: playbooks });
	assert.throws(() => backlog(home, "fx"), /no report\.md for task fx/);
	writeFileSync(join(home, "tasks", "fx", "report.md"), "done\n\n## Remember\n\nx\n");
	assert.throws(() => backlog(home, "fx"), /has no ## Follow-ups heading/);
	writeFileSync(
		join(home, "tasks", "fx", "report.md"),
		[
			"done",
			"",
			"## Follow-ups",
			"",
			"These came up.",
			"",
			"- Retry the token refresh",
			"  when the network drops.",
			"1. Cache the avatar.",
			"- none",
			"```",
			"- a fenced line is no follow-up",
			"```",
			"",
			"## Remember",
			"",
			"- a lesson, not a follow-up",
			"",
		].join("\n"),
	);
	const path = join(home, "backlog.md");
	assert.equal(backlog(home, "fx"), `ok fx: added 2 follow-ups to ${path}`);
	const first = readFileSync(path, "utf8");
	assert.match(first, /^# Backlog\n/);
	assert.match(first, /^- `fx-[0-9a-f]{6}` Retry the token refresh when the network drops\. \(task `fx`, \d{4}-\d{2}-\d{2}\)$/m);
	assert.match(first, /^- `fx-[0-9a-f]{6}` Cache the avatar\. \(task `fx`, \d{4}-\d{2}-\d{2}\)$/m);
	assert.doesNotMatch(first, /fenced|lesson|none|These came up/);
	assert.equal(backlog(home, "fx"), `ok fx: no new follow-ups for ${path}`);
	assert.equal(readFileSync(path, "utf8"), first, "a rerun adds nothing");
	writeFileSync(join(home, "tasks", "none", "report.md"), REPORT);
	assert.equal(backlog(home, "none"), `ok none: no new follow-ups for ${path}`, "a prose line is no follow-up");
	assert.throws(() => backlog(home, "../fx"), /task id must match/);
});
