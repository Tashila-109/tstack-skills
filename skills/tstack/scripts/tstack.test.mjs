import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { Refusal, brief, check, checkSeats, exclude, linkSkills, loadModels, parseModels, parseSteps, prVerdict, seat, taskHome } from "./tstack.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
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
	writeFileSync(join(task, "report.md"), "done\n");
	assert.equal(check(home, "demo"), "ok demo: 4 required files present");
	assert.throws(() => check(home, "../demo"), /task id must match/);
	writeFileSync(join(dir, "outside.md"), "traced elsewhere\n");
	rmSync(join(task, "evidence/grounding.md"));
	symlinkSync(join(dir, "outside.md"), join(task, "evidence/grounding.md"));
	assert.throws(() => check(home, "demo", 1), /is a link to outside the task directory/);
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

test("seat --cross picks the first seat outside the caller's model family", () => {
	const models = parseModels("review: inherit, claude/claude-opus-5-5@high, codex/gpt-6.1-sol@high\nsolo: claude/claude-sonnet-5-5");
	const kinds = (cross) => seat(models, "review", "herdr", cross).map((s) => s.kind);
	assert.deepEqual(kinds("claude-opus-5-5"), ["codex"]);
	assert.deepEqual(kinds("cursor/claude-opus-5-5@300k"), ["codex"]);
	assert.deepEqual(kinds("openai/gpt-6.1-sol"), ["claude"]);
	assert.deepEqual(kinds("grok-4.7"), ["claude"]);
	assert.throws(() => seat(models, "solo", "herdr", "claude-opus-5-5"), /no "solo" seat outside the claude family/);
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
	writeFileSync(join(home, "tasks", "tamper", "report.md"), "done\n");
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

test("a pr-delivery task is done only with babysit evidence", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	brief(home, "pr", { playbook: "plain", goal: "g", finish: "f", delivery: "pr", playbooksDir: playbooks });
	const task = join(home, "tasks", "pr");
	writeFileSync(join(task, "report.md"), "done\n");
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
	for (const role of ["architect runners", "arena runners", "arena cross-judge pool", "interrogate reviewers", "review"])
		assert.ok(new Set(seat(template, role, "t3").map((s) => s.model.split("/").pop().split("-")[0])).size >= 2, role);
});

test("check refuses a worker brief whose result has no verdict line", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	brief(home, "w", { playbook: "plain", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "w");
	writeFileSync(join(task, "report.md"), "done\n");
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
	writeFileSync(join(task, "report.md"), "done\n");
	mkdirSync(join(task, "evidence/reviews"));
	mkdirSync(join(task, "decisions"));
	writeFileSync(join(task, "evidence/reviews/m3-spec.md"), "Head abc, round 9 brief\n");
	writeFileSync(join(task, "evidence/reviews/m3.md"), "Head abc, round 3\n");
	assert.equal(check(home, "rounds"), "ok rounds: 1 required file present");
	writeFileSync(join(task, "evidence/reviews/m3.md"), "Head def, round 4\n");
	assert.throws(() => check(home, "rounds"), /review m3 is at round 4, past 3: .*decisions\/review-m3\.md/);
	writeFileSync(join(task, "decisions/review-m3.md"), "# Keep going?\n\n## Answer\n\n");
	assert.throws(() => check(home, "rounds"), /round 4/, "an unanswered decision is no checkpoint");
	writeFileSync(join(task, "decisions/review-m3.md"), "# Keep going?\n\n## Answer\n\nanswered\nyes, two more, 2026-10-12\n");
	assert.equal(check(home, "rounds"), "ok rounds: 1 required file present");
	writeFileSync(join(task, "evidence/reviews/m3.md"), "Head 123, round 7\n");
	assert.throws(() => check(home, "rounds"), /past 6: .*decisions\/review-m3-2\.md/);
	writeFileSync(join(task, "decisions/review-m3-2.md"), "## Answer\n\ngranted\ngo on, 2026-10-12\n");
	assert.equal(check(home, "rounds"), "ok rounds: 1 required file present");
});

test("check refuses a hashed document that changed after its latest grant, and a stale check-plan run", () => {
	const { home, playbooks } = scratch();
	writeFileSync(join(playbooks, "plain.md"), "1. Ship it.\n");
	brief(home, "plan", { playbook: "plain", goal: "g", finish: "f", playbooksDir: playbooks });
	const task = join(home, "tasks", "plan");
	writeFileSync(join(task, "report.md"), "done\n");
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
	assert.match(prVerdict(pr({ reviewThreads: { nodes: [{ isResolved: false }, { isResolved: true }] } }), now), /^BLOCKER review-threads: 1 unresolved/);
	assert.match(prVerdict(pr({ reviewThreads: { pageInfo: { hasNextPage: true }, nodes: [] } }), now), /^BLOCKER too-many/);
	assert.match(prVerdict(pr({ mergeable: "UNKNOWN", mergeStateStatus: "UNKNOWN" }), now), /^WAITING mergeable-unknown/);
	assert.match(prVerdict(pr({ updatedAt: "2026-10-14T11:58:00Z" }), now), /^WAITING settle: .*120s ago/, "a force-push of an old commit still settles");
	assert.match(prVerdict(pr({ reviews: { nodes: [{ submittedAt: "2026-10-14T11:57:00Z" }] } }), now), /^WAITING settle: .*180s ago/);
	assert.match(prVerdict(pr({ mergeStateStatus: "BEHIND" }), now), /^BLOCKER behind-base/);
	assert.match(prVerdict(pr({ reviewDecision: "REVIEW_REQUIRED", mergeStateStatus: "BLOCKED" }), now), /^WAITING review-required/);
	assert.match(prVerdict(pr({ mergeStateStatus: "BLOCKED" }), now), /^BLOCKER merge-blocked/);
	assert.match(prVerdict(pr({}, []), now), /^READY ci-none/);
});
