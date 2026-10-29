#!/usr/bin/env node
// tstack: the facts tstack-skills keeps on disk. No dependencies; runs on Node 20+ or Bun.
//
//   node tstack.mjs home
//   node tstack.mjs brief <id> --playbook <name> --goal <text> --finish <text> [--kind ship|scout] [--delivery local-only|pr]
//   node tstack.mjs check <id> [--through <step>] [--head <sha>]
//   node tstack.mjs seat <role> --runtime t3|herdr|standalone [--cross <model>]
//   node tstack.mjs check-seats <saved orchestrator_capabilities result>
//   node tstack.mjs pr-state <pr number> [--wait <seconds, at most 540>]
//   node tstack.mjs exclude [--project-skills]
//   node tstack.mjs link-skills <worktree>
//
// Exit 0 on success, 1 on a refusal (the reason is on stderr), 2 on a usage error, 3 on anything unexpected.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
const GRANTED = /^##\s+Answer\s*\n+\s*granted\b/im;
const DELEGATED = new Set(["evidence/dispatch.md", "evidence/fix.md"]);
// A step that delegates only on some paths, such as modernize's rework: held like a fix unless it has a skip: line.
const MAYBE_DELEGATED = new Set(["evidence/rework.md"]);
const RESULT = /\bresults\/[a-z0-9][a-z0-9.-]*\.md\b/g;
const PROOF = "evidence/verify.md";
const CITED = /`(evidence\/[^`\s]+)`/g;
const SKIPPED = /^\s*skip:\s*\S/im;
const ANSWERED = /^##\s+Answer\s*\n+\s*(granted|answered)\b/im;
const REVIEW_ROUNDS = 3;
const VERDICT = /^(DONE|BLOCKED|FAILED)\b/m;
const HASHED_SUBJECT = /^Subject:[^\n`]*`([^`]+)`[^\n]*?\b([0-9a-f]{64})\b/im;
const CHECKED_SPEC = /^(\/\S+) sha256 ([0-9a-f]{64})$/m;

export class Refusal extends Error {}
class Usage extends Error {}

function gitCommonDir(cwd) {
	let common;
	try {
		common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
			cwd,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		throw new Refusal(`not inside a Git checkout: ${cwd}`);
	}
	if (!common.endsWith(`${sep}.git`)) throw new Refusal(`no primary checkout for Git dir ${common}`);
	return common;
}

export function taskHome(cwd = process.cwd()) {
	return join(dirname(gitCommonDir(cwd)), ".tstack");
}

const SKILL_DIRS = [".agents/skills", ".claude/skills", ".pi/skills"];

function projectSkills(primary) {
	const lock = join(primary, "skills-lock.json");
	if (!existsSync(lock)) throw new Refusal(`no per-project install: ${lock} is missing`);
	const names = Object.keys(JSON.parse(readFileSync(lock, "utf8")).skills ?? {});
	const bad = names.filter((n) => !ID.test(n));
	if (bad.length) throw new Refusal(`skills-lock.json names that are not skill names: ${bad.join(", ")}`);
	return names;
}

export function exclude(cwd, projectSkillsToo) {
	const common = gitCommonDir(cwd);
	const primary = dirname(common);
	const wanted = ["/.tstack/"];
	if (projectSkillsToo) {
		wanted.push("/skills-lock.json");
		for (const name of projectSkills(primary)) wanted.push(...SKILL_DIRS.map((d) => `/${d}/${name}`));
	}
	const path = join(common, "info", "exclude");
	const have = new Set(existsSync(path) ? readFileSync(path, "utf8").split("\n").map((l) => l.trim()) : []);
	const added = wanted.filter((line) => !have.has(line));
	if (added.length) {
		mkdirSync(dirname(path), { recursive: true });
		const text = existsSync(path) ? readFileSync(path, "utf8") : "";
		appendFileSync(path, `${text && !text.endsWith("\n") ? "\n" : ""}${added.join("\n")}\n`);
	}
	return added.length ? `added to ${path}:\n${added.join("\n")}` : `nothing to add to ${path}`;
}

export function linkSkills(cwd, worktree) {
	const primary = dirname(gitCommonDir(cwd));
	const target = resolve(worktree);
	if (target === primary) throw new Refusal("link-skills takes a linked worktree, not the primary checkout");
	if (!existsSync(target) || dirname(gitCommonDir(target)) !== primary) throw new Refusal(`not a worktree of ${primary}: ${target}`);
	let linked = 0;
	for (const name of projectSkills(primary)) {
		for (const dir of SKILL_DIRS) {
			const from = join(primary, dir, name);
			const to = join(target, dir, name);
			if (!existsSync(from) || existsSync(to) || isLink(to)) continue;
			mkdirSync(join(target, dir), { recursive: true });
			symlinkSync(from, to);
			linked++;
		}
	}
	return `linked ${linked} skill path${linked === 1 ? "" : "s"} into ${target}`;
}

function isLink(path) {
	try {
		return lstatSync(path).isSymbolicLink();
	} catch {
		return false;
	}
}

// The markdown with every fenced code line blanked, so an example never counts as the real thing.
export function prose(markdown) {
	let fence;
	return markdown
		.split("\n")
		.map((line) => {
			// A fence closes only on a bare run of its own character at least as long; a backtick info string opens none.
			const run = line.match(/^\s*(`{3,}|~{3,})(.*)$/);
			if (!fence && run && !(run[1][0] === "`" && run[2].includes("`"))) fence = run[1];
			else if (fence && run?.[1][0] === fence[0] && run[1].length >= fence.length && !run[2].trim()) fence = undefined;
			else if (!fence) return line;
			return "";
		})
		.join("\n");
}

export function parseSteps(markdown) {
	const steps = [];
	for (const line of prose(markdown).split("\n")) {
		const step = line.match(/^(\d+)\.\s+(.*)$/);
		const artifact = line.match(/^\s*Artifact:\s*(.+)$/);
		if (step) steps.push({ n: Number(step[1]), text: step[2].trim(), artifacts: [] });
		else if (artifact && steps.length) {
			const paths = [...artifact[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
			steps.at(-1).artifacts.push(...(paths.length ? paths : [artifact[1].trim()]));
		}
	}
	return steps;
}

function hasVerifySkill(primary) {
	return SKILL_DIRS.some((dir) => existsSync(join(primary, dir)) && readdirSync(join(primary, dir)).some((name) => name.startsWith("verify-")));
}

function insideTask(taskDir, path) {
	const full = resolve(taskDir, path);
	const rel = relative(taskDir, full);
	if (!rel || rel.startsWith("..") || rel.startsWith(sep)) throw new Refusal(`artifact path leaves the task directory: ${path}`);
	if (existsSync(full) && relative(realpathSync(taskDir), realpathSync(full)).startsWith(".."))
		throw new Refusal(`artifact ${path} is a link to outside the task directory: copy the file in instead`);
	return full;
}

export function brief(home, id, opts) {
	if (!ID.test(id)) throw new Usage(`task id must match ${ID}: ${id}`);
	for (const key of ["playbook", "goal", "finish"]) if (!opts[key]) throw new Usage(`--${key} is required`);
	if (!ID.test(opts.playbook)) throw new Usage(`--playbook must be a playbook name: ${opts.playbook}`);
	const kind = opts.kind ?? "ship";
	const delivery = opts.delivery ?? "local-only";
	if (!["ship", "scout"].includes(kind)) throw new Usage(`--kind must be ship or scout: ${kind}`);
	if (!["local-only", "pr"].includes(delivery)) throw new Usage(`--delivery must be local-only or pr: ${delivery}`);
	if (kind === "scout" && delivery === "pr") throw new Usage("a scout writes report.md and never opens a PR");
	const playbookPath = join(opts.playbooksDir ?? join(SKILL_DIR, "playbooks"), `${opts.playbook}.md`);
	if (!existsSync(playbookPath)) throw new Refusal(`no playbook named ${opts.playbook} at ${playbookPath}`);
	const taskDir = join(home, "tasks", id);
	if (existsSync(taskDir)) throw new Refusal(`task ${id} already exists at ${taskDir}`);

	const steps = parseSteps(readFileSync(playbookPath, "utf8"));
	if (steps.some((s, i) => s.n !== i + 1)) throw new Refusal(`playbook ${opts.playbook} numbers its steps ${steps.map((s) => s.n).join(", ")}; they must run from 1 without gaps`);
	for (const step of steps) for (const path of step.artifacts) insideTask(taskDir, path);
	const task = { id, playbook: opts.playbook, kind, delivery, goal: opts.goal, finish: opts.finish, created: new Date().toISOString(), steps };

	mkdirSync(join(taskDir, "evidence"), { recursive: true });
	writeFileSync(join(taskDir, "task.json"), `${JSON.stringify(task, null, "\t")}\n`);
	const learningsPath = join(home, "learnings.md");
	const learnings = existsSync(learningsPath) ? readFileSync(learningsPath, "utf8").trim() : "";
	const lines = [
		`# Task ${id}`,
		"",
		`Goal: ${opts.goal}`,
		`Finish: ${opts.finish}`,
		`Kind: ${kind}. Delivery: ${delivery}.`,
		`Playbook: ${opts.playbook}, at ${playbookPath}. Read it in full.`,
		`Task directory: ${taskDir}`,
		"",
		"## Steps",
		"",
		"Copy these into your todo list, in order, before any task-specific item.",
		"A step you skip stays on the list as `skip: <reason>`, and any artifact it names still gets written, holding that line.",
		"",
		...(steps.length
			? steps.map((s) => `${s.n}. ${s.text}${s.artifacts.length ? ` Artifact: ${s.artifacts.map((a) => `\`${a}\``).join(", ")}` : ""}`)
			: ["This playbook has no numbered steps. Follow its prose."]),
		"",
		...(steps.some((s) => s.artifacts.includes(PROOF)) && !hasVerifySkill(dirname(home))
			? [
					"This project has no `verify-*` skill.",
					"If the change has a UI, CLI or service surface, run create-verification-skill before you verify, or say in `evidence/verify.md` why not.",
					"",
				]
			: []),
		"The final report goes in `report.md` in the task directory.",
		`\`node ${fileURLToPath(import.meta.url)} check ${id} --head <head SHA>\` must pass before you report done.`,
		...(learnings ? ["", "## Learnings from earlier tasks", "", learnings] : []),
		"",
	];
	const briefPath = join(taskDir, "brief.md");
	writeFileSync(briefPath, lines.join("\n"));
	return briefPath;
}

export function check(home, id, through, head, cwd = process.cwd()) {
	if (!ID.test(id)) throw new Usage(`task id must match ${ID}: ${id}`);
	const taskDir = join(home, "tasks", id);
	const taskPath = join(taskDir, "task.json");
	if (!existsSync(taskPath)) throw new Refusal(`no task ${id} at ${taskDir}`);
	const task = JSON.parse(readFileSync(taskPath, "utf8"));
	const playbookPath = ID.test(task.playbook ?? "") ? join(SKILL_DIR, "playbooks", `${task.playbook}.md`) : "";
	if (playbookPath && existsSync(playbookPath)) {
		for (const fresh of parseSteps(readFileSync(playbookPath, "utf8"))) {
			const frozen = task.steps.find((s) => s.n === fresh.n);
			if (!frozen) task.steps.push({ ...fresh, added: true });
			else frozen.artifacts = [...new Set([...frozen.artifacts, ...fresh.artifacts])];
		}
	}
	const wanted = task.steps
		.filter((s) => through === undefined || s.n <= through)
		.flatMap((s) => s.artifacts.map((path) => ({ step: `step ${s.n}${s.added ? " (added to the playbook after the brief)" : ""}`, path })));
	if (through === undefined) {
		if (task.delivery === "pr") wanted.push({ step: "pr delivery", path: "evidence/babysit.md" });
		wanted.push({ step: "final report", path: "report.md" });
	}
	const problems = [];
	for (const { step, path } of wanted) {
		const full = insideTask(taskDir, path);
		const text = existsSync(full) && statSync(full).isFile() ? readFileSync(full, "utf8") : "";
		if (path.startsWith("decisions/") ? !GRANTED.test(prose(text)) : !text.trim())
			problems.push(`missing ${step}: ${path}${path.startsWith("decisions/") ? " with a granted answer" : ""}`);
		else if (path === PROOF) problems.push(...proofGaps(taskDir, text).map((gap) => `${step}: ${path} ${gap}`));
		else if (DELEGATED.has(path)) problems.push(...delegationGaps(taskDir, path, text).map((gap) => `${step}: ${path} ${gap}`));
		else if (MAYBE_DELEGATED.has(path) && !SKIPPED.test(text)) problems.push(...delegationGaps(taskDir, path, text).map((gap) => `${step}: ${path} ${gap}`));
		else if (path === "report.md") problems.push(...reportGaps(text));
	}
	if (through === undefined) problems.push(...workerGaps(taskDir));
	if (head !== undefined) problems.push(...headGaps(taskDir, head, cwd));
	problems.push(...reviewCapGaps(taskDir), ...staleGaps(taskDir));
	if (problems.length) throw new Refusal(problems.join("\n"));
	return `ok ${id}: ${wanted.length} required file${wanted.length === 1 ? "" : "s"} present`;
}

function proofGaps(taskDir, text) {
	if (SKIPPED.test(text)) return [];
	const cited = [...new Set([...text.matchAll(CITED)].map((m) => m[1]))].filter((path) => path !== PROOF);
	if (!cited.length) return ["cites no file under evidence/ and has no skip: line (see references/proof.md)"];
	return cited.filter((path) => !hasContent(insideTask(taskDir, path))).map((path) => `cites ${path}, which is missing or empty`);
}

function delegationGaps(taskDir, path, text) {
	const cited = [...new Set(prose(text).match(RESULT) ?? [])];
	if (!cited.length) return ["cites no results/<name>.md: this step delegates, with no skip"];
	const gaps = cited.filter((r) => !VERDICT.test(readIfFile(insideTask(taskDir, r)))).map((r) => `cites ${r}, which has no DONE, BLOCKED or FAILED line`);
	if (path !== "evidence/dispatch.md") {
		const briefs = (prose(text).match(/\bbriefs\/[a-z0-9][a-z0-9.-]*\.md\b/g) ?? []).map((b) => readIfFile(insideTask(taskDir, b)));
		if (!briefs.some((b) => /\btdd\b/.test(b))) gaps.push("cites no brief under briefs/ that lists the tdd skill");
	}
	return gaps;
}

function reportGaps(text) {
	const body = prose(text);
	return [
		...["## Remember", "## Follow-ups"].filter((h) => !new RegExp(`^${h}\\s*$`, "m").test(body)).map((h) => `report.md has no ${h} heading`),
		...(/\u2014/.test(body) ? ["report.md uses a long dash: rewrite the sentence, as the unslop skill says"] : []),
	];
}

// Each review or proof must name a commit whose tree is the head's, so a later commit cannot ride on old evidence.
function headGaps(taskDir, head, cwd) {
	const tree = (rev) => {
		try {
			return execFileSync("git", ["rev-parse", "--verify", "--quiet", `${rev}^{tree}`], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
		} catch {
			return "";
		}
	};
	const want = /^[0-9a-f]{7,40}$/.test(head) ? tree(head) : "";
	if (!want) throw new Refusal(`--head must be a commit SHA in ${cwd}: ${head}`);
	return [PROOF, "evidence/reviews/final.md"]
		.filter((path) => existsSync(join(taskDir, path)))
		.filter((path) => ![...new Set(readFileSync(join(taskDir, path), "utf8").match(/\b[0-9a-f]{7,40}\b/g) ?? [])].some((sha) => tree(sha) === want))
		.map((path) => `${path} names no commit with the same tree as ${head}: verify or review again on this head`);
}

function readIfFile(path) {
	return existsSync(path) && statSync(path).isFile() ? readFileSync(path, "utf8") : "";
}

function workerGaps(taskDir) {
	const briefs = join(taskDir, "briefs");
	if (!existsSync(briefs)) return [];
	return readdirSync(briefs)
		.filter((name) => name.endsWith(".md"))
		.filter((name) => {
			const result = join(taskDir, "results", name);
			return !(existsSync(result) && VERDICT.test(readFileSync(result, "utf8")));
		})
		.map((name) => `briefs/${name} has no results/${name} with a DONE, BLOCKED or FAILED line: collect its worker, or write why it never ran`);
}

function reviewCapGaps(taskDir) {
	const reviews = join(taskDir, "evidence", "reviews");
	if (!existsSync(reviews)) return [];
	const decisions = join(taskDir, "decisions");
	const answered = existsSync(decisions)
		? readdirSync(decisions).filter((name) => ANSWERED.test(prose(readFileSync(join(decisions, name), "utf8"))))
		: [];
	const gaps = [];
	for (const name of readdirSync(reviews)) {
		const label = name.match(/^([a-z0-9][a-z0-9-]*)\.md$/)?.[1];
		if (!label || /-(standards|spec|brief)$/.test(label)) continue;
		const round = Number(readFileSync(join(reviews, name), "utf8").split("\n", 1)[0].match(/\bround\s+(\d+)\b/i)?.[1] ?? 0);
		const checkpoints = answered.filter((d) => d === `review-${label}.md` || new RegExp(`^review-${label}-\\d+\\.md$`).test(d)).length;
		if (round > REVIEW_ROUNDS * (checkpoints + 1))
			gaps.push(
				`review ${label} is at round ${round}, past ${REVIEW_ROUNDS * (checkpoints + 1)}: ask the human with an answered decisions/review-${label}${checkpoints ? `-${checkpoints + 1}` : ""}.md first`,
			);
	}
	return gaps;
}

function sha256(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function staleGaps(taskDir) {
	const gaps = [];
	const decisions = join(taskDir, "decisions");
	const latest = new Map();
	for (const name of existsSync(decisions) ? readdirSync(decisions) : []) {
		const [, family, n = "1"] = name.match(/^(.+?)(?:-(\d+))?\.md$/) ?? [];
		const text = family ? readFileSync(join(decisions, name), "utf8") : "";
		const subject = text.match(HASHED_SUBJECT);
		if (subject && GRANTED.test(prose(text)) && (latest.get(family)?.n ?? 0) < Number(n))
			latest.set(family, { n: Number(n), name, path: subject[1], hash: subject[2] });
	}
	for (const { name, path, hash } of latest.values()) {
		const full = isAbsolute(path) ? path : [resolve(taskDir, path), resolve(taskDir, "..", "..", "..", path)].find((p) => existsSync(p));
		if (!full || !existsSync(full)) gaps.push(`decisions/${name} grants ${path}, which is missing`);
		else if (sha256(full) !== hash) gaps.push(`${path} changed after decisions/${name} granted it: open the next decision as references/decisions.md says`);
	}
	const checked = join(taskDir, "evidence", "check-plan.md");
	const spec = existsSync(checked) ? readFileSync(checked, "utf8").match(CHECKED_SPEC) : null;
	if (spec && existsSync(spec[1]) && sha256(spec[1]) !== spec[2])
		gaps.push(`evidence/check-plan.md checked an older ${spec[1]}: run check-plan.mjs again and save its output`);
	if (existsSync(checked) && !/^\d+ phase sections?, 0 problems$/m.test(readFileSync(checked, "utf8")))
		gaps.push("evidence/check-plan.md is not a clean check-plan.mjs run: fix every problem and save the output that ends in 0 problems");
	return gaps;
}

function hasContent(path) {
	if (!existsSync(path)) return false;
	const stat = statSync(path);
	return stat.isDirectory() ? readdirSync(path).length > 0 : stat.size > 0;
}

export function parseModels(text) {
	const lines = new Map();
	for (const [i, raw] of text.split("\n").entries()) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const at = line.indexOf(":");
		if (at < 1 || !line.slice(at + 1).trim()) throw new Refusal(`models file line ${i + 1} is not "role: seats": ${line}`);
		const value = line.slice(at + 1).trim();
		for (const raw of line.slice(0, at).split(",")) {
			const key = raw.trim().toLowerCase();
			if (lines.has(key)) throw new Refusal(`models file names role "${key}" twice, again on line ${i + 1}`);
			lines.set(key, value);
		}
	}
	return lines;
}

const PANELS = new Set(["architect runners", "arena runners", "arena cross-judge pool", "interrogate reviewers", "review"]);

function templateRoles() {
	const path = join(SKILL_DIR, "..", "tstack-setup", "SKILL.md");
	if (!existsSync(path)) return undefined;
	const block = readFileSync(path, "utf8").match(/```text\n(# tstack models[\s\S]*?)```/)?.[1];
	return block ? new Set([...parseModels(block).keys()].filter((k) => k !== "t3 instances")) : undefined;
}

const HERDR = {
	claude: { effort: (e) => ["--effort", e], autonomy: ["--permission-mode", "auto", "--prompt-suggestions", "false"] },
	codex: { effort: (e) => ["-c", `model_reasoning_effort="${e}"`], autonomy: ["--dangerously-bypass-approvals-and-sandbox"] },
	pi: { effort: (e) => ["--thinking", e], autonomy: [] },
	grok: { effort: (e) => ["--reasoning-effort", e], autonomy: ["--permission-mode", "bypassPermissions"] },
};

const EFFORTS = new Set(["off", "minimal", "low", "medium", "high", "xhigh", "max", "ultra", "ultracode", "ultrathink"]);

export function parseSeat(text) {
	if (text === "inherit") return { inherit: true };
	const m = text.match(/^([a-z0-9][a-z0-9-]*)\/([A-Za-z0-9][A-Za-z0-9._:/+@[\]-]*)$/i);
	if (!m) throw new Refusal(`seat must be harness/model[@effort] or inherit, with no spaces or leading dashes: ${text}`);
	const at = m[2].lastIndexOf("@");
	const tail = at > 0 ? m[2].slice(at + 1) : "";
	const effort = EFFORTS.has(tail.toLowerCase()) ? tail.toLowerCase() : undefined;
	return { harness: m[1].toLowerCase(), model: effort ? m[2].slice(0, at) : m[2], effort };
}

function family(model) {
	return model.split("/").pop().split("-")[0].toLowerCase();
}

export function seat(models, role, runtime, cross) {
	if (!["t3", "herdr", "standalone"].includes(runtime)) throw new Usage(`--runtime must be t3, herdr or standalone: ${runtime}`);
	const key = role.trim().toLowerCase();
	const value = models.get(key) ?? (key.startsWith("lead ") ? models.get("lead") : undefined);
	if (!value) throw new Refusal(`no line for role "${role}" in the models file; run tstack-setup to write it`);
	let seats = value.split(",").map((s) => parseSeat(s.trim()));
	if (cross !== undefined) {
		const other = seats.find((s) => !s.inherit && family(s.model) !== family(cross));
		if (!other) throw new Refusal(`no "${role}" seat outside the ${family(cross)} family; add one to that line`);
		seats = [other];
	}
	return seats.map((parsed) => {
		if (parsed.inherit) return parsed;
		if (runtime === "t3") {
			const instances = new Map(
				(models.get("t3 instances") ?? "").split(",").filter(Boolean).map((pair) => {
					const [name, target = ""] = pair.split("=").map((x) => x.trim());
					const [instance, option] = target.split("/");
					return [name.toLowerCase(), { instance, option }];
				}),
			);
			const t3 = instances.get(parsed.harness);
			if (!t3?.instance) throw new Refusal(`no T3 instance for harness ${parsed.harness}; add it to the "t3 instances" line`);
			if (parsed.effort && !t3.option) throw new Refusal(`no effort option ID for harness ${parsed.harness} in the "t3 instances" line`);
			return {
				providerInstanceId: t3.instance,
				model: parsed.model,
				...(parsed.effort ? { options: [{ id: t3.option, value: parsed.effort }] } : {}),
			};
		}
		if (runtime === "herdr") {
			const flags = HERDR[parsed.harness];
			if (!flags) throw new Refusal(`no Herdr launch flags known for harness ${parsed.harness}`);
			const override = models.get(`herdr args ${parsed.harness}`);
			const autonomy = override === undefined ? flags.autonomy : override.split(/\s+/).filter(Boolean);
			return {
				kind: parsed.harness,
				args: ["--model", parsed.model, ...(parsed.effort ? flags.effort(parsed.effort) : []), ...autonomy],
			};
		}
		// No orchestrator: every seat runs on the caller's own model, and the configured seat is kept so the lead can name what it could not honor.
		return { inherit: true, configured: `${parsed.harness}/${parsed.model}${parsed.effort ? `@${parsed.effort}` : ""}` };
	});
}

export function checkSeats(models, caps, roles = templateRoles()) {
	const providers = new Map((caps.providers ?? []).map((p) => [p.providerInstanceId, p]));
	const problems = new Set();
	const checked = new Set();
	for (const role of roles ?? []) if (!models.has(role)) problems.add(`no line for role "${role}"; every role needs one`);
	for (const role of models.keys()) {
		if (role === "t3 instances" || role.startsWith("herdr args")) continue;
		if (roles && !roles.has(role) && !(role.startsWith("lead ") && existsSync(join(SKILL_DIR, "playbooks", `${role.slice(5)}.md`))))
			problems.add(`unknown role "${role}"; check its spelling against the tstack-setup template`);
		const seats = seat(models, role, "t3");
		const real = seats.filter((s) => !s.inherit);
		if (new Set(real.map((s) => JSON.stringify(s))).size < real.length) problems.add(`${role}: the same seat is listed twice`);
		if (PANELS.has(role) && new Set(real.map((s) => family(s.model))).size < 2)
			problems.add(`${role}: a panel needs seats from at least two model families, and inherit does not count`);
		for (const s of real) {
			checked.add(JSON.stringify(s));
			const where = `${role}: ${s.providerInstanceId} ${s.model}`;
			const provider = providers.get(s.providerInstanceId);
			const model = provider?.models?.find((m) => m.id === s.model);
			const why = provider?.constraints?.length ? ` (${provider.constraints.join(" ")})` : "";
			if (!provider) problems.add(`${where}: no instance ${s.providerInstanceId} in this T3`);
			else if (!provider.canRunChildTask) problems.add(`${where}: instance ${s.providerInstanceId} cannot run child tasks here${why}`);
			else if (provider.canRunCrossProviderChildTask === false)
				problems.add(`${where}: instance ${s.providerInstanceId} cannot run a child for a parent on another provider${why}`);
			else if (!model) {
				const near = (provider.models ?? []).filter((m) => m.id.endsWith(`/${s.model}`)).map((m) => m.id);
				problems.add(`${where}: model not advertised${near.length ? `; advertised as ${near.join(" or ")}` : ""}`);
			} else
				for (const o of s.options ?? []) {
					const option = model.options?.find((x) => x.id === o.id);
					const values = option?.options?.map((v) => v.id) ?? [];
					if (option?.type === "boolean") problems.add(`${where}: ${o.id} is an on/off option, so drop the @${o.value} effort`);
					else if (!values.includes(o.value)) problems.add(`${where}: ${o.id} ${o.value} not offered (${values.join(", ") || "no such option"})`);
				}
		}
	}
	if (problems.size) throw new Refusal([...problems].join("\n"));
	return `ok: ${checked.size} seat${checked.size === 1 ? "" : "s"} advertised`;
}

export function loadModels(home, globalDir = process.env.TSTACK_GLOBAL_DIR ?? join(homedir(), ".tstack")) {
	const merged = new Map();
	const read = (path) => (existsSync(path) ? parseModels(readFileSync(path, "utf8")) : new Map());
	for (const [k, v] of read(join(globalDir, "models.md"))) merged.set(k, v);
	for (const [k, v] of read(join(home, "models.md"))) {
		if (k.startsWith("herdr args")) throw new Refusal(`"${k}" is allowed only in ${join(globalDir, "models.md")}, because launch flags can grant an agent more access`);
		merged.set(k, v);
	}
	return merged;
}

const SETTLE_MS = 10 * 60 * 1000;
const FAILED_RUN = new Set(["FAILURE", "TIMED_OUT", "CANCELLED", "STARTUP_FAILURE", "STALE"]);
const PR_QUERY = `query($owner: String!, $repo: String!, $n: Int!) { repository(owner: $owner, name: $repo) { pullRequest(number: $n) {
  state isDraft baseRefName mergeable mergeStateStatus reviewDecision headRefOid updatedAt
  commits(last: 1) { nodes { commit { committedDate statusCheckRollup { contexts(first: 100) { pageInfo { hasNextPage } nodes {
    __typename ... on CheckRun { name status conclusion } ... on StatusContext { context state } } } } } } }
  reviewThreads(first: 100) { pageInfo { hasNextPage } nodes { isResolved } }
  comments(last: 1) { nodes { createdAt } }
  reviews(last: 1) { nodes { submittedAt } }
} } }`;

// One verdict for a PR from GitHub's own state. WAITING means nothing is wrong yet but it is not ready.
// `required` names the base branch's required checks, so one that has not started yet still counts as pending.
export function prVerdict(pr, now = Date.now(), required = []) {
	const head = pr.headRefOid?.slice(0, 12) ?? "unknown";
	const say = (verdict, reason) => `${verdict}${reason ? ` ${reason}` : ""} (head ${head})`;
	if (pr.state === "MERGED") return say("MERGED");
	if (pr.state === "CLOSED") return say("CLOSED", "closed without merging");
	if (pr.isDraft) return say("BLOCKER", "draft: mark it ready");
	if (pr.mergeable === "CONFLICTING") return say("BLOCKER", "conflicts: merge the base branch in");
	const commit = pr.commits?.nodes?.[0]?.commit;
	// ponytail: reads the first 100 checks and threads; page through them if a PR ever has more.
	if (commit?.statusCheckRollup?.contexts?.pageInfo?.hasNextPage || pr.reviewThreads?.pageInfo?.hasNextPage)
		return say("BLOCKER", "too-many: over 100 checks or review threads, so read them on GitHub");
	const checks = (commit?.statusCheckRollup?.contexts?.nodes ?? []).map((c) =>
		c.__typename === "StatusContext"
			? { name: c.context, failed: ["FAILURE", "ERROR"].includes(c.state), pending: ["PENDING", "EXPECTED"].includes(c.state) }
			: { name: c.name, failed: FAILED_RUN.has(c.conclusion), pending: c.status !== "COMPLETED", approval: c.conclusion === "ACTION_REQUIRED" },
	);
	const failed = checks.filter((c) => c.failed).map((c) => c.name);
	if (failed.length) return say("BLOCKER", `failing-checks: ${failed.join(", ")}`);
	// An outdated thread still counts: branch protection's resolve-conversations rule counts it.
	const open = (pr.reviewThreads?.nodes ?? []).filter((t) => !t.isResolved).length;
	if (open) return say("BLOCKER", `review-threads: ${open} unresolved`);
	if (pr.reviewDecision === "CHANGES_REQUESTED") return say("BLOCKER", "changes-requested");
	const reported = new Set(checks.map((c) => c.name));
	const pending = [...checks.filter((c) => c.pending).map((c) => c.name), ...required.filter((name) => !reported.has(name)).map((name) => `${name} (required, not started)`)];
	if (pending.length) return say("WAITING", `checks: ${pending.join(", ")}`);
	const latest = Math.max(
		...[commit?.committedDate, pr.updatedAt, pr.comments?.nodes?.[0]?.createdAt, pr.reviews?.nodes?.[0]?.submittedAt].filter(Boolean).map((t) => Date.parse(t)),
	);
	if (now - latest < SETTLE_MS) return say("WAITING", `settle: the last push, comment, review or edit was ${Math.round((now - latest) / 1000)}s ago, and review bots get ${SETTLE_MS / 60000} minutes`);
	if (pr.mergeable === "UNKNOWN" || pr.mergeStateStatus === "UNKNOWN") return say("WAITING", "mergeable-unknown: GitHub is still computing whether it merges");
	if (pr.mergeStateStatus === "BEHIND") return say("BLOCKER", "behind-base: merge the base branch in");
	if (pr.reviewDecision === "REVIEW_REQUIRED") return say("WAITING", "review-required: a human must review");
	// ACTION_REQUIRED is a gate waiting on a person, such as an owner's approval, not a failed run.
	const approval = checks.filter((c) => c.approval).map((c) => c.name);
	if (approval.length) return say("WAITING", `approval: ${approval.join(", ")} waits on a person`);
	if (pr.mergeStateStatus === "BLOCKED") return say("BLOCKER", "merge-blocked: a branch rule GitHub does not name blocks the merge");
	if (!checks.length) return say("READY", "ci-none: no checks reported; trust it only when a second run on the same head agrees");
	return say("READY");
}

const TRANSIENT = /HTTP (5\d\d|429)|secondary rate limit|timed? ?out|connection (reset|refused)|\bEOF\b|temporar|could not resolve host|TLS handshake/i;

export const isTransient = (message) => TRANSIENT.test(message);

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Runs gh, and retries a server error, a secondary rate limit or a network failure four times with backoff.
// A spent primary rate limit resets within the hour, so it is not retried.
function gh(args) {
	for (let attempt = 0; ; attempt++) {
		try {
			return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
		} catch (err) {
			const message = String(err.stderr || err.message).trim();
			if (attempt === 4 || !isTransient(message)) throw new Error(message);
			sleep(2000 * 2 ** attempt);
		}
	}
}

// The base branch's required checks, from rulesets and from classic branch protection.
// Reading protection needs admin rights, so a refusal means only that this source is unknown.
function requiredChecks(base) {
	const sources = [
		[`repos/{owner}/{repo}/rules/branches/${base}`, '.[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context'],
		[`repos/{owner}/{repo}/branches/${base}/protection/required_status_checks`, ".contexts[]?"],
	];
	const names = new Set();
	for (const [path, jq] of sources) {
		try {
			for (const name of gh(["api", path, "--jq", jq]).split("\n")) if (name) names.add(name);
		} catch {}
	}
	return [...names];
}

export function prState(number, waitSeconds = 0) {
	if (!/^\d+$/.test(String(number))) throw new Usage(`pr-state takes a PR number: ${number}`);
	if (!(waitSeconds >= 0 && waitSeconds <= 540)) throw new Usage("--wait must be 0 to 540 seconds, under the 600-second tool cap");
	const deadline = Date.now() + waitSeconds * 1000;
	let required;
	for (;;) {
		let raw;
		try {
			raw = gh(["api", "graphql", "-F", "owner={owner}", "-F", "repo={repo}", "-F", `n=${number}`, "-f", `query=${PR_QUERY}`]);
		} catch (err) {
			throw new Refusal(`gh could not read PR ${number}: ${err.message}`);
		}
		const body = JSON.parse(raw);
		if (body.errors?.length || !body.data?.repository?.pullRequest) throw new Refusal(`gh could not read PR ${number}: ${JSON.stringify(body.errors ?? body)}`);
		const pr = body.data.repository.pullRequest;
		if (pr.state === "OPEN") required ??= requiredChecks(pr.baseRefName);
		const verdict = prVerdict(pr, Date.now(), required ?? []);
		if (!verdict.startsWith("WAITING") || Date.now() + 60_000 > deadline) return verdict;
		sleep(60_000);
	}
}

const BOOLEAN_FLAGS = new Set(["--project-skills"]);

function flags(args) {
	const out = { _: [] };
	for (let i = 0; i < args.length; i++) {
		if (!args[i].startsWith("--")) out._.push(args[i]);
		else if (BOOLEAN_FLAGS.has(args[i])) out[args[i].slice(2)] = true;
		else if (i + 1 >= args.length) throw new Usage(`${args[i]} needs a value`);
		else out[args[i].slice(2)] = args[++i];
	}
	return out;
}

export function main(argv) {
	const [command, ...rest] = argv;
	const f = flags(rest);
	switch (command) {
		case "home":
			return taskHome();
		case "brief":
			if (f._.length !== 1) throw new Usage("brief takes one task id");
			return brief(taskHome(), f._[0], f);
		case "check": {
			if (f._.length !== 1) throw new Usage("check takes one task id");
			const through = f.through === undefined ? undefined : Number(f.through);
			if (through !== undefined && !(Number.isInteger(through) && through > 0)) throw new Usage(`--through must be a step number: ${f.through}`);
			return check(taskHome(), f._[0], through, f.head);
		}
		case "seat":
			if (f._.length < 1) throw new Usage("seat takes a role name");
			return seat(loadModels(taskHome()), f._.join(" "), f.runtime, f.cross)
				.map((s) => JSON.stringify(s))
				.join("\n");
		case "check-seats": {
			if (f._.length !== 1) throw new Usage("check-seats takes the path of a saved orchestrator_capabilities result");
			const caps = JSON.parse(readFileSync(f._[0], "utf8"));
			return checkSeats(loadModels(taskHome()), Array.isArray(caps) ? JSON.parse(caps[0].text) : caps);
		}
		case "pr-state":
			if (f._.length !== 1) throw new Usage("pr-state takes one PR number");
			return prState(f._[0], f.wait === undefined ? 0 : Number(f.wait));
		case "exclude":
			return exclude(process.cwd(), f["project-skills"] === true);
		case "link-skills":
			if (f._.length !== 1) throw new Usage("link-skills takes one worktree path");
			return linkSkills(process.cwd(), f._[0]);
		default:
			throw new Usage("commands: home, brief, check, seat, check-seats, pr-state, exclude, link-skills");
	}
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		console.log(main(process.argv.slice(2)));
	} catch (err) {
		console.error(err.message);
		process.exit(err instanceof Usage ? 2 : err instanceof Refusal ? 1 : 3);
	}
}
