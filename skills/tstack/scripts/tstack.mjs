#!/usr/bin/env node
// tstack: the facts tstack-skills keeps on disk. No dependencies; runs on Node 20+ or Bun.
//
//   node tstack.mjs home
//   node tstack.mjs brief <id> --playbook <name> --goal <text> --finish <text> [--kind ship|scout] [--delivery local-only|pr]
//                         [--design <link or path>] [--acceptance phase|branch] [--push stage|word] [--merge squash|merge|rebase]
//   node tstack.mjs check <id> [--through <step>] [--head <sha>]
//   node tstack.mjs backlog <id>
//   node tstack.mjs status [<id>]
//   node tstack.mjs seat <role> --runtime t3|herdr|standalone [--task <id>] [--cross <model> [--avoid <model>,...]]
//   node tstack.mjs check-seats <saved orchestrator_capabilities result> [<saved search result>...] [--task <id>]
//   node tstack.mjs preflight [--runtime t3|herdr|standalone] [--task <id>]
//   node tstack.mjs lock <name> --task <id>
//   node tstack.mjs unlock <name> --task <id>
//   node tstack.mjs pr-state <pr number> [--wait <seconds, at most 540>]
//   node tstack.mjs exclude [--project-skills]
//   node tstack.mjs link-skills <worktree>
//
// Exit 0 on success, 1 on a refusal (the reason is on stderr), 2 on a usage error, 3 on anything unexpected.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, linkSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
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
// A whole file skipped: its first line is the skip line, so a stray skip note inside a finished file excuses nothing.
const WHOLLY_SKIPPED = /^\s*skip:\s*\S/;
const PR_VERDICT = /^(READY|MERGED|WAITING|BLOCKER|CLOSED)\b.*\(head ([0-9a-f]{12})\)\s*$/gm;
const LOOSE_COMMIT = /^Subject:[^\n`]*`[^`]+`\s+at\s+(?![0-9a-f]{7,40}\b)(\S+)/im;
const ANSWERED = /^##\s+Answer\s*\n+\s*(granted|answered)\b/im;
const QUESTION = /^Kind:\s*question\s*$/im;
const ANSWERED_QUESTION = /^##\s+Answer\s*\n+\s*answered\b/im;
const ANSWERED_OR_DENIED = /^##\s+Answer\s*\n+\s*(granted|answered|denied)\b/im;
const REVIEW_ROUNDS = 3;
const VERDICT = /^(DONE|BLOCKED|FAILED)\b/m;
const HASHED_SUBJECT = /^Subject:[^\n`]*`([^`]+)`[^\n]*?\b([0-9a-f]{64})\b/im;
const COMMITTED_SUBJECT = /^Subject:[^\n`]*`([^`]+)`[^\n]*?\b([0-9a-f]{7,40})\b/im;
const REVIEW_HEAD = /^Head ([0-9a-f]{7,40}), round (\d+)\s*$/;
const CHECKED_SPEC = /^(\/\S+) sha256 ([0-9a-f]{64})$/m;
// A proof that reuses an earlier run records the comparison as this command, and check --head runs it again against the head.
const REUSED = /`git diff --quiet ([0-9a-f]{7,40}) \S+ -- ([^`]+)`/g;
const LIST_ITEM = /^\s{0,3}(?:[-*+]|\d+[.)])\s+(.*\S)\s*$/;
const ACCEPTANCE = {
	phase: "The human accepts each phase before the next one starts: show its commit, its proof and a summary to review the code from, and wait for their word.",
	branch: "The human reviews the whole branch once, at Finish, so the phases run on without stopping for review.",
};
const PUSH = {
	stage: "Push the task branch after each verified stage commit, whatever the delivery.",
	word: "Push nothing until the human says so, not even the push that opens a PR.",
};
const MERGE_METHODS = ["squash", "merge", "rebase"];const AWAY_GRANT = /^away(-\d+)?\.md$/;
const CITED_GRANT = /\bdecisions\/(away(?:-\d+)?\.md)\b/;

export class Refusal extends Error {}
class Usage extends Error {}

const globalHome = () => process.env.TSTACK_GLOBAL_DIR ?? join(homedir(), ".tstack");

function existingTask(home, id) {
	if (!ID.test(id ?? "")) throw new Usage(`task id must match ${ID}: ${id}`);
	const dir = join(home, "tasks", id);
	if (!existsSync(join(dir, "task.json"))) throw new Refusal(`no task ${id} at ${dir}`);
	return dir;
}

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
	if (opts.design !== undefined && !opts.design.trim()) throw new Usage("--design needs a link or a path");
	if (opts.acceptance !== undefined && !Object.hasOwn(ACCEPTANCE, opts.acceptance)) throw new Usage(`--acceptance must be phase or branch: ${opts.acceptance}`);
	if (opts.push !== undefined && !Object.hasOwn(PUSH, opts.push)) throw new Usage(`--push must be stage or word: ${opts.push}`);
	if (opts.merge !== undefined && !MERGE_METHODS.includes(opts.merge)) throw new Usage(`--merge must be squash, merge or rebase: ${opts.merge}`);
	if (opts.merge !== undefined && delivery !== "pr") throw new Usage("--merge names how a PR merges, and a local-only task fast-forwards: drop it, or pass --delivery pr");
	const playbookPath = join(opts.playbooksDir ?? join(SKILL_DIR, "playbooks"), `${opts.playbook}.md`);
	if (!existsSync(playbookPath)) throw new Refusal(`no playbook named ${opts.playbook} at ${playbookPath}`);
	const taskDir = join(home, "tasks", id);
	if (existsSync(taskDir)) throw new Refusal(`task ${id} already exists at ${taskDir}`);

	const steps = parseSteps(readFileSync(playbookPath, "utf8"));
	if (steps.some((s, i) => s.n !== i + 1)) throw new Refusal(`playbook ${opts.playbook} numbers its steps ${steps.map((s) => s.n).join(", ")}; they must run from 1 without gaps`);
	for (const step of steps) for (const path of step.artifacts) insideTask(taskDir, path);
	const answers = Object.fromEntries(["design", "acceptance", "push", "merge"].filter((key) => opts[key] !== undefined).map((key) => [key, opts[key]]));
	const task = { id, playbook: opts.playbook, kind, delivery, ...answers, goal: opts.goal, finish: opts.finish, created: new Date().toISOString(), steps };

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
		...(opts.design ? [`Design source: ${opts.design}. Prove the change against it, as the Prove against a design section of ${join(SKILL_DIR, "references", "proof.md")} says.`] : []),
		...(opts.acceptance ? [`Acceptance: ${opts.acceptance}. ${ACCEPTANCE[opts.acceptance]}`] : []),
		...(opts.push ? [`Push: ${opts.push}. ${PUSH[opts.push]}`] : []),
		...(opts.merge ? [`Merge: ${opts.merge}. At Finish, merge with \`gh pr merge <pr> --${opts.merge} --match-head-commit <head SHA>\`.`] : []),
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

// The task's frozen steps, with every artifact its playbook names today added, so a tampered or stale task.json drops none.
function readTask(taskDir) {
	const task = JSON.parse(readFileSync(join(taskDir, "task.json"), "utf8"));
	task.steps ??= [];
	const playbookPath = ID.test(task.playbook ?? "") ? join(SKILL_DIR, "playbooks", `${task.playbook}.md`) : "";
	if (playbookPath && existsSync(playbookPath)) {
		for (const fresh of parseSteps(readFileSync(playbookPath, "utf8"))) {
			const frozen = task.steps.find((s) => s.n === fresh.n);
			if (!frozen) task.steps.push({ ...fresh, added: true });
			else frozen.artifacts = [...new Set([...frozen.artifacts, ...fresh.artifacts])];
		}
	}
	return task;
}

// A decision counts with a granted answer, and any other artifact once it is not blank.
function present(taskDir, path, text) {
	return path.startsWith("decisions/") ? !decisionGap(prose(latestDecision(taskDir, path, text))) : Boolean(text.trim());
}

export function check(home, id, through, head, cwd = process.cwd(), globalDir = globalHome()) {
	if (!ID.test(id)) throw new Usage(`task id must match ${ID}: ${id}`);
	const taskDir = join(home, "tasks", id);
	if (!existsSync(join(taskDir, "task.json"))) throw new Refusal(`no task ${id} at ${taskDir}`);
	const task = readTask(taskDir);
	const wanted = task.steps
		.filter((s) => through === undefined || s.n <= through)
		.flatMap((s) => s.artifacts.map((path) => ({ step: `step ${s.n}${s.added ? " (added to the playbook after the brief)" : ""}`, path })));
	if (through === undefined) {
		if (task.delivery === "pr") wanted.push({ step: "pr delivery", path: "evidence/babysit.md" });
		wanted.push({ step: "final report", path: "report.md" });
	}
	const problems = [];
	const closed = GRANTED.test(prose(readIfFile(insideTask(taskDir, "decisions/close.md"))));
	for (const { step, path } of wanted) {
		const full = insideTask(taskDir, path);
		const text = existsSync(full) && statSync(full).isFile() ? readFileSync(full, "utf8") : "";
		if (waived(closed, path, text)) continue;
		if (!present(taskDir, path, text))
			problems.push(`missing ${step}: ${path}${path.startsWith("decisions/") ? decisionGap(prose(latestDecision(taskDir, path, text))) : ""}`);
		else if (path === PROOF) problems.push(...proofGaps(taskDir, text, Boolean(task.design)).map((gap) => `${step}: ${path} ${gap}`));
		else if (DELEGATED.has(path)) problems.push(...delegationGaps(taskDir, path, text).map((gap) => `${step}: ${path} ${gap}`));
		else if (MAYBE_DELEGATED.has(path) && !SKIPPED.test(text)) problems.push(...delegationGaps(taskDir, path, text).map((gap) => `${step}: ${path} ${gap}`));
		else if (path === "report.md") problems.push(...reportGaps(text));
	}
	if (through === undefined) problems.push(...workerGaps(taskDir), ...lockGaps(home, id, globalDir));
	if (head !== undefined) problems.push(...headGaps(taskDir, head, cwd, task.delivery === "pr" && through === undefined, closed));
	problems.push(...reviewCapGaps(taskDir, closed), ...staleGaps(taskDir, cwd, closed), ...awayGaps(taskDir));
	if (problems.length) throw new Refusal(problems.join("\n"));
	return `ok ${id}: ${wanted.length} required file${wanted.length === 1 ? "" : "s"} present`;
}

// A gate a playbook names needs a granted answer, and a question it names needs an answered one.
function decisionGap(text) {
	// The Kind comes from the header above the first ## section, so a Proposal line cannot change what the gate needs.
	if (QUESTION.test(text.split(/^##\s/m)[0])) return ANSWERED_QUESTION.test(text) ? "" : " with the human's answer";
	return GRANTED.test(text) ? "" : " with a granted answer";
}

// A gate denied and reopened as <name>-2, -3 and so on is decided by its highest-numbered file.
function latestDecision(taskDir, path, text) {
	const name = path.match(/^decisions\/([a-z0-9][a-z0-9-]*?)\.md$/)?.[1];
	const dir = join(taskDir, "decisions");
	if (!name || !existsSync(dir) || !text.trim()) return text;
	const later = readdirSync(dir)
		.map((f) => ({ f, n: Number(f.match(new RegExp(`^${name}-(\\d+)\\.md$`))?.[1] ?? 0) }))
		.filter((d) => d.n > 1)
		.sort((a, b) => b.n - a.n)[0];
	return later ? readIfFile(insideTask(taskDir, `decisions/${later.f}`)) : text;
}

const plain = (cell) => cell.replace(/[*_`~]/g, "").trim().toLowerCase();

// Each table row below a separator line, with the plain header cells above that separator and the table's width.
// A row may drop its outer pipes, so split on them and drop the empty edge cells.
// Only rows below a separator are data, so a prose line with pipes is not one.
function tableRows(markdown) {
	const rows = [];
	let previous = [];
	let table;
	for (const line of prose(markdown).split("\n")) {
		// An escaped pipe, \|, belongs to its cell.
		const cells = line.split(/(?<!\\)\|/).map((cell) => cell.trim());
		const row = cells.slice(cells[0] === "" ? 1 : 0, cells.at(-1) === "" ? -1 : undefined);
		if (row.length > 1 && row.every((cell) => /^:?-+:?$/.test(cell))) table = { header: previous.map(plain), width: row.length };
		else if (table && row.length > 1) rows.push({ ...table, cells: row });
		else table = undefined;
		previous = row;
	}
	return rows;
}

function proofGaps(taskDir, text, design) {
	// The verdict is the column headed Verdict, or the last column when no header says so.
	const claims = tableRows(text).map(({ header, width, cells }) => ({ cells, said: plain(cells[header.includes("verdict") ? header.indexOf("verdict") : width - 1] ?? "") }));
	const failed = claims.filter(({ said }) => said === "failed").map(({ cells }) => `has a failed claim: ${cells[0]}: repair it and prove it again, or ask the human`);
	if (failed.length) return failed;
	// Against a design, every claim but a blocked one shows its side-by-side.
	const uncited = design ? claims.filter(({ said, cells }) => said !== "blocked" && ![...cells.join(" | ").matchAll(CITED)].some((m) => m[1] !== PROOF)).map(({ cells }) => cells[0]) : [];
	if (SKIPPED.test(text)) return [];
	const cited = [...new Set([...text.matchAll(CITED)].map((m) => m[1]))].filter((path) => path !== PROOF);
	if (!cited.length) return ["cites no file under evidence/ and has no skip: line (see references/proof.md)"];
	return [
		...uncited.map((claim) => `has a claim that cites no file under evidence/: ${claim}: a task with a design source shows a side-by-side of the design and the built screen in every row (see references/proof.md)`),
		...cited.filter((path) => !hasContent(insideTask(taskDir, path))).map((path) => `cites ${path}, which is missing or empty`),
	];
}

function delegationGaps(taskDir, path, text) {
	const cited = [...new Set(prose(text).match(RESULT) ?? [])];
	if (!cited.length) return [`cites no results/<name>.md: this step delegates${DELEGATED.has(path) ? ", and a skip: line does not excuse it" : " unless it holds a skip: line"}`];
	const verdicts = cited.map((r) => [...readIfFile(insideTask(taskDir, r)).matchAll(new RegExp(VERDICT, "gm"))].at(-1)?.[1]);
	const gaps = cited.filter((r, i) => !verdicts[i]).map((r) => `cites ${r}, which has no DONE, BLOCKED or FAILED line`);
	if (!gaps.length && !verdicts.includes("DONE")) gaps.push("cites no result that ends DONE: the work this step delegates never finished");
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
// A file that only records a skipped step, such as a closed PR's verify, holds a skip: line and names no commit.
function headGaps(taskDir, head, cwd, prDelivery, closed) {
	const tree = (rev) => {
		try {
			return execFileSync("git", ["rev-parse", "--verify", "--quiet", `${rev}^{tree}`], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
		} catch {
			return "";
		}
	};
	const want = /^[0-9a-f]{7,40}$/.test(head) ? tree(head) : "";
	if (!want) throw new Refusal(`--head must be a commit SHA in ${cwd}: ${head}`);
	// A closed task merges nothing, so its proof, review and PR state need not describe the head.
	if (closed) return [];
	const gaps = [PROOF, "evidence/reviews/final.md"]
		.filter((path) => existsSync(join(taskDir, path)))
		.filter((path) => {
			const text = readFileSync(join(taskDir, path), "utf8");
			const reviewed = path === PROOF ? null : text.split("\n", 1)[0].match(REVIEW_HEAD);
			const shas = reviewed ? [reviewed[1]] : path === PROOF ? [...new Set(text.match(/\b[0-9a-f]{7,40}\b/g) ?? [])] : [];
			if (!shas.length && (path === PROOF ? SKIPPED : WHOLLY_SKIPPED).test(text.trimStart())) return false;
			return !shas.some((sha) => tree(sha) === want);
		})
		.map((path) => `${path} names no commit with the same tree as ${head}: verify or review again on this head`);
	for (const [, sha, paths] of prose(readIfFile(join(taskDir, PROOF))).matchAll(REUSED)) {
		// Paths are split on spaces, so a quoted or escaped path would compare the wrong files: refuse it.
		if (/['"\\]/.test(paths)) {
			gaps.push(`${PROOF} reuses the run at ${sha} with a quoted or escaped path: list paths without quotes, or prove the claim again`);
			continue;
		}
		const words = paths.trim().split(/\s+/);
		// :(top) reads a path from the repository root, but :(top). and :(top)./src match nothing, so drop the dot first.
		const specs = words.map((p) => (p.startsWith(":") ? p : `:(top)${p.replace(/^\.(\/+|$)/, "")}`));
		// A path with a space splits into words that name nothing, and a diff of nothing passes: refuse a pathspec that matches no file in either commit.
		// Listing a commit's files against the empty tree reads each pathspec as git diff does, magic and all.
		const empty = execFileSync("git", ["hash-object", "-t", "tree", "--stdin"], { cwd, input: "", encoding: "utf8" }).trim();
		const holds = (commit, spec) => {
			try {
				return execFileSync("git", ["diff", "--name-only", empty, commit, "--", spec], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() !== "";
			} catch {
				return false;
			}
		};
		const absent = words.filter((p, i) => !holds(sha, specs[i]) && !holds(head, specs[i]));
		if (absent.length) {
			gaps.push(`${PROOF} reuses the run at ${sha} with ${absent.join(", ")}, which neither commit holds: name paths that exist, and prove a claim that reads a path with a space again`);
			continue;
		}
		try {
			execFileSync("git", ["diff", "--quiet", sha, head, "--", ...specs], { cwd, stdio: "ignore" });
		} catch (err) {
			gaps.push(
				err.status === 1
					? `${PROOF} reuses the run at ${sha}, but ${paths.trim()} changed before ${head}: run that claim again on this head`
					: `${PROOF} reuses the run at ${sha}, which this checkout does not hold: run check from the task's worktree`,
			);
		}
	}
	if (prDelivery) {
		const text = readIfFile(join(taskDir, "evidence", "babysit.md"));
		const latest = [...text.matchAll(PR_VERDICT)].filter((m) => tree(m[2]) === want).at(-1)?.[1];
		if (!WHOLLY_SKIPPED.test(text.trimStart()) && !["READY", "MERGED"].includes(latest))
			gaps.push(`evidence/babysit.md's latest pr-state line for ${head} is ${latest ?? "missing"}, not READY or MERGED: paste the pr-state output for this head`);
	}
	return gaps;
}

// Appends each list item under report.md's ## Follow-ups to <home>/backlog.md, once, with an ID that stays the same on a rerun.
export function backlog(home, id) {
	if (!ID.test(id)) throw new Usage(`task id must match ${ID}: ${id}`);
	const reportPath = join(home, "tasks", id, "report.md");
	if (!existsSync(reportPath)) throw new Refusal(`no report.md for task ${id} at ${reportPath}`);
	const lines = prose(readFileSync(reportPath, "utf8")).split("\n");
	const start = lines.findIndex((line) => /^##\s+Follow-ups\s*$/.test(line));
	if (start < 0) throw new Refusal(`${reportPath} has no ## Follow-ups heading`);
	const items = [];
	let open = false;
	for (const line of lines.slice(start + 1)) {
		if (/^#{1,6}\s/.test(line)) break;
		const item = line.match(LIST_ITEM);
		if (item) items.push(item[1]);
		else if (open && /^\s+\S/.test(line)) items[items.length - 1] += ` ${line.trim()}`;
		if (item || /^\S/.test(line)) open = Boolean(item);
	}
	const path = join(home, "backlog.md");
	const existing = readIfFile(path);
	const rows = new Map();
	for (const text of items.map((t) => t.replace(/\s+/g, " ")).filter((t) => !/^(none|n\/a)\.?$/i.test(t))) {
		const key = `${id}-${createHash("sha256").update(text).digest("hex").slice(0, 6)}`;
		if (!existing.includes(`\`${key}\``)) rows.set(key, text);
	}
	if (!rows.size) return `ok ${id}: no new follow-ups for ${path}`;
	const date = new Date().toISOString().slice(0, 10);
	const top = existing ? (existing.endsWith("\n") ? "" : "\n") : "# Backlog\n\nFollow-ups from finished tasks. Name an item's ID in a request to take it.\n\n";
	appendFileSync(path, `${top}${[...rows].map(([key, text]) => `- \`${key}\` ${text} (task \`${id}\`, ${date})`).join("\n")}\n`);
	return `ok ${id}: added ${rows.size} follow-up${rows.size === 1 ? "" : "s"} to ${path}`;
}

function readIfFile(path) {
	return existsSync(path) && statSync(path).isFile() ? readFileSync(path, "utf8") : "";
}

// The last DONE, BLOCKED or FAILED line in a worker's result, or undefined while it has none.
function resultVerdict(taskDir, name) {
	return [...readIfFile(join(taskDir, "results", name)).matchAll(new RegExp(VERDICT.source, "gm"))].at(-1)?.[1];
}

function mdFiles(dir) {
	return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith(".md")).sort() : [];
}

// Each brief whose worker has written no verdict yet.
function unfinishedBriefs(taskDir) {
	return mdFiles(join(taskDir, "briefs")).filter((name) => !resultVerdict(taskDir, name));
}

function workerGaps(taskDir) {
	return unfinishedBriefs(taskDir).map(
		(name) => `briefs/${name} has no results/${name} with a DONE, BLOCKED or FAILED line: collect its worker, or write why it never ran`,
	);
}

function reviewCapGaps(taskDir, closed) {
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
		const text = readFileSync(join(reviews, name), "utf8");
		const first = text.split("\n", 1)[0].match(REVIEW_HEAD);
		if (!first) {
			// A closed task's half-written review may carry its skip line below the start.
			if (!(closed ? SKIPPED : WHOLLY_SKIPPED).test(text.trimStart())) gaps.push(`evidence/reviews/${name} does not open with "Head <sha>, round <n>": write that line first, as two-axis-review step 6 says`);
			continue;
		}
		const round = Number(first[2]);
		const checkpoints = answered.filter((d) => d === `review-${label}.md` || new RegExp(`^review-${label}-\\d+\\.md$`).test(d)).length;
		if (round > REVIEW_ROUNDS * (checkpoints + 1))
			gaps.push(
				`review ${label} is at round ${round}, past ${REVIEW_ROUNDS * (checkpoints + 1)}: ask the human with an answered decisions/review-${label}${checkpoints ? `-${checkpoints + 1}` : ""}.md first`,
			);
	}
	return gaps;
}

// The bodies of every `## <heading>` section, joined, or undefined when the markdown has none.
function sections(markdown, heading) {
	const parts = markdown.split(/^(?=##\s)/m).filter((part) => new RegExp(`^##\\s+${heading}\\s*$`, "i").test(part.split("\n", 1)[0]));
	return parts.length ? parts.map((part) => part.slice(part.indexOf("\n") + 1)).join("\n") : undefined;
}

// A lead answers a question itself only under the human's granted away grant, and only until the human returns.
// What is wrong with one decision's use of an away grant: undefined when it neither opens with taken nor cites a grant, "" when its use is sound.
function awayGap(taskDir, name) {
	const text = prose(readIfFile(insideTask(taskDir, `decisions/${name}`)));
	const answer = sections(text, "Answer") ?? "";
	const taken = /^\s*taken\b/i.test(answer);
	const grant = answer.match(CITED_GRANT)?.[1];
	if (!taken && !grant) return undefined;
	const kind = text.match(/^Kind:\s*(\S+)/im)?.[1];
	const grantText = grant ? prose(readIfFile(insideTask(taskDir, `decisions/${grant}`))) : "";
	const ended = sections(grantText, "Ended");
	const listed = new Set([...(ended ?? "").matchAll(/\bdecisions\/([a-z0-9][a-z0-9-]*\.md)/g)].map((m) => m[1]));
	if (kind?.toLowerCase() !== "question")
		return `decisions/${name} is ${kind ? `a ${kind} decision` : "a decision with no Kind line"}, which waits for the human: an away grant answers question decisions only`;
	if (name.startsWith("review-")) return `decisions/${name} is a review checkpoint, which waits for the human: an away grant never answers one`;
	if (!taken) return `decisions/${name} cites decisions/${grant}, so its answer must open with taken`;
	if (!grant) return `decisions/${name} is taken under no away grant: cite the decisions/away.md the human granted`;
	if (!GRANTED.test(grantText)) return `decisions/${name} cites decisions/${grant}, which is missing or not granted`;
	if (!/^Kind:\s*away\b/im.test(grantText)) return `decisions/${name} cites decisions/${grant}, which is not a Kind: away grant`;
	if (ended !== undefined && !listed.has(name))
		return `decisions/${name} is taken under decisions/${grant}, which ended without listing it: ask the human, or list it there if you took it before they returned`;
	return "";
}

function awayGaps(taskDir) {
	const dir = join(taskDir, "decisions");
	return (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md") && !AWAY_GRANT.test(f)) : []).map((name) => awayGap(taskDir, name)).filter(Boolean);
}

function sha256(path) {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function staleGaps(taskDir, cwd, closed) {
	const gaps = [];
	const decisions = join(taskDir, "decisions");
	const latest = new Map();
	for (const name of existsSync(decisions) ? readdirSync(decisions) : []) {
		const [, family, n = "1"] = name.match(/^(.+?)(?:-(\d+))?\.md$/) ?? [];
		const text = family ? readFileSync(join(decisions, name), "utf8") : "";
		const loose = text.match(LOOSE_COMMIT);
		if (loose) gaps.push(`decisions/${name} names its document at ${loose[1]}: write the commit SHA, as references/decisions.md says`);
		const hashed = text.match(HASHED_SUBJECT);
		const subject = hashed ?? text.match(COMMITTED_SUBJECT);
		if (subject && GRANTED.test(prose(text)) && (latest.get(family)?.n ?? 0) < Number(n))
			latest.set(family, { n: Number(n), name, path: subject[1], ...(hashed ? { hash: subject[2] } : { commit: subject[2] }) });
	}
	for (const { name, path, hash, commit } of closed ? [] : latest.values()) {
		if (commit) {
			gaps.push(...committedGaps(cwd, name, path, commit));
			continue;
		}
		const full = isAbsolute(path) ? path : [resolve(taskDir, path), resolve(taskDir, "..", "..", "..", path)].find((p) => existsSync(p));
		if (!full || !existsSync(full)) gaps.push(`decisions/${name} grants ${path}, which is missing`);
		else if (sha256(full) !== hash) gaps.push(`${path} changed after decisions/${name} granted it: open the next decision as references/decisions.md says`);
	}
	const checked = join(taskDir, "evidence", "check-plan.md");
	const spec = existsSync(checked) ? readFileSync(checked, "utf8").match(CHECKED_SPEC) : null;
	const run = readIfFile(checked);
	const skippedRun = closed && SKIPPED.test(run);
	if (spec && !skippedRun && existsSync(spec[1]) && sha256(spec[1]) !== spec[2])
		gaps.push(`evidence/check-plan.md checked an older ${spec[1]}: run check-plan.mjs again and save its output`);
	if (existsSync(checked) && !skippedRun && !/^\d+ phase sections?, 0 problems$/m.test(run))
		gaps.push("evidence/check-plan.md is not a clean check-plan.mjs run: fix every problem and save the output that ends in 0 problems");
	return gaps;
}

// A committed document is stale when the checkout's copy, committed or not, differs from the one in the granted commit.
function committedGaps(cwd, name, path, commit) {
	const git = (args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
	try {
		git(["cat-file", "-e", `${commit}:${path}`]);
	} catch {
		return [`decisions/${name} grants ${path} at ${commit}, which this checkout does not hold: run check from the task's worktree`];
	}
	try {
		git(["diff", "--quiet", commit, "--", `:(top,literal)${path}`]);
		return [];
	} catch {
		return [`${path} changed after decisions/${name} granted it at ${commit}: open the next decision as references/decisions.md says`];
	}
}

function hasContent(path) {
	if (!existsSync(path)) return false;
	const stat = statSync(path);
	return stat.isDirectory() ? readdirSync(path).length > 0 : stat.size > 0;
}

// Bytes on disk under a path, counting a link as itself so nothing outside is read.
function diskSize(path) {
	const stat = lstatSync(path);
	return stat.isDirectory() ? readdirSync(path).reduce((sum, name) => sum + diskSize(join(path, name)), 0) : stat.size;
}

function humanSize(bytes) {
	const units = ["B", "KB", "MB", "GB", "TB"];
	let i = 0;
	for (; bytes >= 1024 && i < units.length - 1; i++) bytes /= 1024;
	return i ? `${bytes.toFixed(1)} ${units[i]}` : `${bytes} B`;
}

function markdownUnder(dir) {
	if (!existsSync(dir)) return [];
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory() ? markdownUnder(join(dir, e.name)) : e.isFile() && e.name.endsWith(".md") ? [join(dir, e.name)] : [],
	);
}

const firstLine = (text) => text.trim().split("\n", 1)[0];

// Each autopilot queue under home, with the state of every row in its table that has a State column.
function programs(home) {
	const files = existsSync(home) ? readdirSync(home).filter((f) => /^autopilot-[a-z0-9][a-z0-9-]*\.md$/.test(f)).sort() : [];
	return files.map((file) => {
		const items = tableRows(readFileSync(join(home, file), "utf8"))
			.filter(({ header }) => header.includes("state"))
			.map(({ header, cells }) => {
				const state = cells[header.indexOf("state")] ?? "";
				const task = plain(cells[header.includes("task") ? header.indexOf("task") : 0] ?? "");
				return { task, state, word: plain(state).match(/^[a-z]+(-[a-z]+)*/)?.[0] ?? "blank" };
			});
		return { file, items, heartbeat: firstLine(readIfFile(join(home, `${file.slice(0, -3)}-heartbeat.txt`))) };
	});
}

// A granted close ends a task with nothing to merge, so its remaining steps may hold skip lines and its decisions a denied answer.
function waived(closed, path, text) {
	return closed && path !== "report.md" && Boolean(text.trim()) && (SKIPPED.test(text) || (path.startsWith("decisions/") && ANSWERED_OR_DENIED.test(prose(text))));
}

function taskFacts(home, queues, id, sized) {
	const taskDir = join(home, "tasks", id);
	const task = readTask(taskDir);
	const text = (path) => readIfFile(insideTask(taskDir, path));
	const closed = GRANTED.test(prose(text("decisions/close.md")));
	const steps = task.steps.map((s) => ({ ...s, missing: s.artifacts.filter((path) => !present(taskDir, path, text(path)) && !waived(closed, path, text(path))) }));
	const cited = new Set([join(taskDir, "report.md"), ...markdownUnder(join(taskDir, "evidence"))].flatMap((f) => prose(readIfFile(f)).match(RESULT) ?? []));
	return {
		task,
		steps,
		reached: Math.max(0, ...steps.filter((s) => s.artifacts.length && !s.missing.length).map((s) => s.n)),
		report: Boolean(text("report.md").trim()),
		closed,
		held: queues.flatMap((q) => q.items.filter((i) => i.task === id && i.word === "held").map((i) => `${q.file} says ${i.state}`)),
		open: latestRevisions(mdFiles(join(taskDir, "decisions")))
			.map((name) => ({ name, body: prose(text(`decisions/${name}`)) }))
			.filter(({ name, body }) => {
				const gap = awayGap(taskDir, name);
				return gap === undefined ? !ANSWERED_OR_DENIED.test(body) : gap !== "";
			})
			.map(({ name, body }) => {
				const question = body.match(/^#\s+(.+)$/m)?.[1].trim();
				return `decisions/${name}${question ? `: ${question}` : ""}`;
			}),
		uncollected: mdFiles(join(taskDir, "results"))
			.map((name) => ({ name, verdict: resultVerdict(taskDir, name) }))
			.filter(({ name, verdict }) => verdict && !cited.has(`results/${name}`))
			.map(({ name, verdict }) => `results/${name} ends ${verdict}`),
		running: unfinishedBriefs(taskDir).map((name) => `briefs/${name}`),
		heartbeat: firstLine(text("heartbeat.txt")),
		size: sized ? humanSize(diskSize(taskDir)) : undefined,
	};
}

// Keeps only the highest-numbered revision of each decision, such as design-2.md over design.md, so a revised gate is judged by its newest file.
function latestRevisions(names) {
	const newest = new Map();
	for (const name of names) {
		const m = name.match(/^(.*?)(?:-(\d+))?\.md$/);
		const rev = Number(m[2] ?? 1);
		if (!(newest.get(m[1])?.rev >= rev)) newest.set(m[1], { name, rev });
	}
	return names.filter((name) => [...newest.values()].some((v) => v.name === name));
}

function summaryLine(f) {
	const reached = f.reached ? `step ${f.reached} of ${f.steps.length} reached` : "no step reached";
	const created = typeof f.task.created === "string" ? f.task.created.slice(0, 10) : "unknown";
	return [f.task.playbook, f.task.kind, f.task.delivery, `created ${created}`, reached, ...(f.report ? ["report written"] : []), ...(f.closed ? ["closed"] : []), ...(f.size ? [f.size] : [])].join(", ");
}

const UNCOLLECTED = "finished workers no evidence file cites";
const RUNNING = "briefs with no verdict yet";

function queueLines(q) {
	if (!q.items.length) return [`program ${q.file}: no queue table with a State column`];
	const counts = new Map();
	for (const { word } of q.items) counts.set(word, (counts.get(word) ?? 0) + 1);
	const tally = [...counts].map(([word, n]) => `${n} ${word}`).join(", ");
	return [
		`program ${q.file}: ${q.items.length} item${q.items.length === 1 ? "" : "s"}, ${tally}${q.heartbeat ? `, heartbeat ${q.heartbeat}` : ""}`,
		...q.items.filter((i) => i.word === "held").map((i) => `  held: ${i.task}: ${i.state}`),
	];
}

// Each task's progress, what waits on the human, and what waits to be collected, so a lead or coordinator can answer "where are we?".
export function status(home, id, sized = false) {
	const queues = programs(home);
	if (id !== undefined) {
		if (!ID.test(id)) throw new Usage(`task id must match ${ID}: ${id}`);
		const taskDir = join(home, "tasks", id);
		if (!existsSync(join(taskDir, "task.json"))) throw new Refusal(`no task ${id} at ${taskDir}`);
		const f = taskFacts(home, queues, id, sized);
		const list = (label, items) => [`${label}: ${items.length || "none"}`, ...items.map((item) => `  ${item}`)];
		return [
			`task ${id}`,
			`playbook: ${f.task.playbook}, ${f.task.kind}, ${f.task.delivery} delivery, created ${typeof f.task.created === "string" ? f.task.created.slice(0, 10) : "unknown"}`,
			`goal: ${f.task.goal}`,
			`finish: ${f.task.finish}`,
			...(f.size ? [`size: ${f.size}`] : []),
			...f.steps.map((s) => `step ${s.n} ${!s.artifacts.length ? "names no artifact" : s.missing.length ? `missing ${s.missing.join(", ")}` : "done"}: ${s.text}`),
			`reached: ${f.reached ? `step ${f.reached} of ${f.steps.length}` : "no step"}`,
			`report: ${f.report ? "written" : "not written"}`,
			`closed: ${f.closed ? "yes, decisions/close.md is granted" : "no"}`,
			...list("held", f.held),
			...list("open decisions", f.open),
			...list(UNCOLLECTED, f.uncollected),
			...list(RUNNING, f.running),
			`heartbeat: ${f.heartbeat || "none"}`,
		].join("\n");
	}
	const dir = join(home, "tasks");
	const ids = existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : [];
	const lines = [`${ids.length} task${ids.length === 1 ? "" : "s"} under ${dir}`];
	for (const name of ids) {
		if (!ID.test(name) || !existsSync(join(dir, name, "task.json"))) {
			lines.push(`${name}: ${ID.test(name) ? "no task.json" : "not a task ID"}`);
			continue;
		}
		let f;
		try {
			f = taskFacts(home, queues, name, sized);
		} catch (err) {
			lines.push(`${name}: unreadable: ${err.message}`);
			continue;
		}
		// What waits on the human comes in full; workers come as counts, which status <id> lists.
		lines.push(
			`${name}: ${summaryLine(f)}`,
			...f.held.map((item) => `  held: ${item}`),
			...f.open.map((item) => `  open decision: ${item}`),
			...[
				[UNCOLLECTED, f.uncollected],
				[RUNNING, f.running],
			]
				.filter(([, items]) => items.length)
				.map(([label, items]) => `  ${label}: ${items.length}, which status ${name} lists`),
			...(f.heartbeat ? [`  heartbeat: ${f.heartbeat}`] : []),
		);
	}
	lines.push(...queues.flatMap(queueLines));
	return lines.join("\n");
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

const PANELS = new Set(["arena runners", "arena cross-judge pool", "interrogate reviewers", "review"]);

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

const FAST = /\+fast$/i;

export function parseSeat(text) {
	if (text === "inherit") return { inherit: true };
	const fast = FAST.test(text);
	const m = text.replace(FAST, "").match(/^([a-z0-9][a-z0-9-]*)\/([A-Za-z0-9][A-Za-z0-9._:/+@[\]-]*)$/i);
	if (!m) throw new Refusal(`seat must be harness/model[@effort][+fast] or inherit, with no spaces or leading dashes: ${text}`);
	const at = m[2].lastIndexOf("@");
	const tail = at > 0 ? m[2].slice(at + 1) : "";
	const effort = EFFORTS.has(tail.toLowerCase()) ? tail.toLowerCase() : undefined;
	return { harness: m[1].toLowerCase(), model: effort ? m[2].slice(0, at) : m[2], effort, ...(fast ? { fast } : {}) };
}

// The vendor family: the model ID's first word, with OpenAI's o-series counted as gpt.
function family(model) {
	const word = model.split("/").pop().split("-")[0].toLowerCase();
	return /^o\d+$/.test(word) ? "gpt" : word;
}

function modelId(model) {
	return model.split("/").pop().toLowerCase();
}

export function seat(models, role, runtime, cross, avoid) {
	if (!["t3", "herdr", "standalone"].includes(runtime)) throw new Usage(`--runtime must be t3, herdr or standalone: ${runtime}`);
	const key = role.trim().toLowerCase();
	const value = models.get(key) ?? (key.startsWith("lead ") ? models.get("lead") : undefined);
	if (!value) throw new Refusal(`no line for role "${role}" in the models file; run tstack-setup to write it`);
	let seats = value.split(",").map((s) => parseSeat(s.trim()));
	if (avoid !== undefined && cross === undefined) throw new Usage("--avoid needs --cross");
	if (cross !== undefined) {
		const others = seats.filter((s) => !s.inherit && family(s.model) !== family(cross));
		if (!others.length) throw new Refusal(`no "${role}" seat outside the ${family(cross)} family; add one to that line`);
		const ran = (avoid ?? "").split(",").map((m) => m.trim()).filter(Boolean).map(modelId);
		const count = (s) => ran.filter((m) => m === modelId(s.model)).length;
		seats = [others.reduce((best, s) => (count(s) < count(best) ? s : best))];
	}
	return seats.map((parsed) => {
		if (parsed.inherit) return parsed;
		if (runtime === "t3") {
			// Each pair is <harness>=<instance>/<effort option>[/<fast option>[=<value>]], and a fast option with no value is on/off.
			const instances = new Map(
				(models.get("t3 instances") ?? "").split(",").filter(Boolean).map((pair) => {
					const at = pair.includes("=") ? pair.indexOf("=") : pair.length;
					const [instance, option, fast = ""] = pair.slice(at + 1).trim().split("/");
					const [fastId, fastValue = true] = fast.split("=");
					return [pair.slice(0, at).trim().toLowerCase(), { instance, option, fast: fastId ? { id: fastId, value: fastValue } : undefined }];
				}),
			);
			const t3 = instances.get(parsed.harness);
			if (!t3?.instance) throw new Refusal(`no T3 instance for harness ${parsed.harness}; add it to the "t3 instances" line`);
			if (parsed.effort && !t3.option) throw new Refusal(`no effort option ID for harness ${parsed.harness} in the "t3 instances" line`);
			if (parsed.fast && !t3.fast) throw new Refusal(`no fast option for harness ${parsed.harness} in the "t3 instances" line; add it after the effort option, such as fastMode or serviceTier=priority`);
			const options = [...(parsed.effort ? [{ id: t3.option, value: parsed.effort }] : []), ...(parsed.fast ? [t3.fast] : [])];
			return { providerInstanceId: t3.instance, model: parsed.model, ...(options.length ? { options } : {}) };
		}
		if (runtime === "herdr") {
			const flags = HERDR[parsed.harness];
			if (!flags) throw new Refusal(`no Herdr launch flags known for harness ${parsed.harness}`);
			if (parsed.fast) throw new Refusal(`no Herdr fast-mode flag known for harness ${parsed.harness}: drop +fast from the seat`);
			const override = models.get(`herdr args ${parsed.harness}`);
			const autonomy = override === undefined ? flags.autonomy : override.split(/\s+/).filter(Boolean);
			return {
				kind: parsed.harness,
				args: ["--model", parsed.model, ...(parsed.effort ? flags.effort(parsed.effort) : []), ...autonomy],
			};
		}
		// No orchestrator: every seat runs on the caller's own model, and the configured seat is kept so the lead can name what it could not honor.
		return { inherit: true, configured: `${parsed.harness}/${parsed.model}${parsed.effort ? `@${parsed.effort}` : ""}${parsed.fast ? "+fast" : ""}` };
	});
}

// T3 returns a short model list per instance and counts the rest in `omittedModels`, so a model can be missing only from the list.
// Each further catalog, such as an `orchestrator_capabilities` result for `search: "<model>"`, adds its models to the instance's.
// A model counts as not advertised only when some catalog lists that instance with nothing omitted.
function mergeCatalogs(catalogs) {
	const providers = new Map();
	for (const caps of catalogs)
		for (const p of caps.providers ?? []) {
			const seen = providers.get(p.providerInstanceId);
			const complete = !(p.omittedModels > 0);
			if (!seen) {
				providers.set(p.providerInstanceId, { ...p, models: [...(p.models ?? [])], complete, shortListOmitted: p.omittedModels ?? 0 });
				continue;
			}
			for (const m of p.models ?? []) if (!seen.models.some((x) => x.id === m.id)) seen.models.push(m);
			seen.complete ||= complete;
			seen.omittedModels = Math.min(seen.omittedModels ?? 0, p.omittedModels ?? 0);
		}
	return providers;
}

export function checkSeats(models, caps, roles = templateRoles()) {
	const providers = mergeCatalogs(Array.isArray(caps) ? caps : [caps]);
	const problems = new Set();
	const unlisted = new Set();
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
				const near = provider.models.filter((m) => m.id.endsWith(`/${s.model}`)).map((m) => m.id);
				if (near.length) problems.add(`${where}: model not advertised; advertised as ${near.join(" or ")}`);
				else if (!provider.complete)
					unlisted.add(`${where}: not in T3's short list, which left out ${provider.omittedModels} model${provider.omittedModels === 1 ? "" : "s"}; save orchestrator_capabilities with search "${s.model}" and pass that file too`);
				else problems.add(`${where}: model not advertised${provider.shortListOmitted > 0 ? `, unless a search for "${s.model}" lists it` : ""}`);
			} else
				for (const o of s.options ?? []) {
					// T3 lists an option's choices as `values`, or in older catalogs as `options` beside a `type`.
					const option = model.options?.find((x) => x.id === o.id);
					const values = option?.values ?? option?.options?.map((v) => v.id) ?? [];
					const onOff = option?.type === "boolean" || (values.length > 0 && values.every((v) => typeof v === "boolean"));
					if (onOff && o.value !== true) problems.add(`${where}: ${o.id} is an on/off option, so drop the @${o.value} effort`);
					else if (!onOff && !values.includes(o.value)) problems.add(`${where}: ${o.id} ${o.value} not offered (${values.join(", ") || "no such option"})`);
				}
		}
	}
	if (unlisted.size) problems.add(["incomplete catalog: these seats are unchecked until a search lists them", ...unlisted].join("\n"));
	if (problems.size) throw new Refusal([...problems].join("\n"));
	return `ok: ${checked.size} seat${checked.size === 1 ? "" : "s"} advertised`;
}

// The global file, then the project's, then with a task its own, each overriding the one before line by line.
export function loadModels(home, globalDir = globalHome(), task) {
	const merged = new Map();
	const read = (path) => {
		try {
			return existsSync(path) ? parseModels(readFileSync(path, "utf8")) : new Map();
		} catch (err) {
			throw err instanceof Refusal ? new Refusal(`${path}: ${err.message}`) : err;
		}
	};
	for (const [k, v] of read(join(globalDir, "models.md"))) merged.set(k, v);
	for (const path of [join(home, "models.md"), ...(task === undefined ? [] : [join(existingTask(home, task), "models.md")])])
		for (const [k, v] of read(path)) {
			if (k.startsWith("herdr args")) throw new Refusal(`"${k}" in ${path} is allowed only in ${join(globalDir, "models.md")}, because launch flags can grant an agent more access`);
			merged.set(k, v);
		}
	return merged;
}

const SIGN_MS = 60_000;
const errorLine = (text) => String(text ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "no output";

// What has stopped unattended runs before, each as a line saying what only the human can do about it.
export function preflight(home, runtime, task, { cwd = process.cwd(), env = process.env, globalDir = globalHome() } = {}) {
	if (runtime !== undefined && !["t3", "herdr", "standalone"].includes(runtime)) throw new Usage(`--runtime must be t3, herdr or standalone: ${runtime}`);
	const taskDir = task === undefined ? undefined : existingTask(home, task);
	const problems = [];
	let roles = 0;
	if (![join(globalDir, "models.md"), join(home, "models.md"), ...(taskDir ? [join(taskDir, "models.md")] : [])].some((p) => existsSync(p))) problems.push(`no models file at ${join(globalDir, "models.md")}: run tstack-setup`);
	else
		try {
			const models = loadModels(home, globalDir, task);
			for (const role of new Set([...(templateRoles() ?? []), ...models.keys()])) {
				if (role === "t3 instances" || role.startsWith("herdr args")) continue;
				roles++;
				try {
					seat(models, role, runtime ?? "standalone");
				} catch (err) {
					if (!(err instanceof Refusal)) throw err;
					problems.push(`seat "${role}": ${err.message}`);
				}
			}
		} catch (err) {
			if (!(err instanceof Refusal)) throw err;
			problems.push(`${err.message}: fix that file, or run tstack-setup`);
		}

	const git = (args, opts) => execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
	let signs = false;
	try {
		signs = git(["config", "--bool", "--get", "commit.gpgsign"]).trim() === "true";
	} catch {}
	// commit-tree writes one unreferenced commit object, which Git prunes later, and moves no ref.
	if (signs)
		try {
			// The empty tree needs no first commit, so a new repository can be checked too.
			const empty = git(["mktree"], { stdio: ["pipe", "pipe", "pipe"], input: "" }).trim();
			git(["commit-tree", "-S", "-m", "tstack preflight", empty], { timeout: SIGN_MS, env: { ...env, GIT_TERMINAL_PROMPT: "0" } });
		} catch (err) {
			const why = err.code === "ETIMEDOUT" ? `no passphrase within ${SIGN_MS / 1000} seconds` : errorLine(err.stderr);
			problems.push(`commit.gpgsign is on, and a signed commit failed (${why}): unlock your signing key, such as with its passphrase or your ssh-agent`);
		}

	const local = taskDir !== undefined && JSON.parse(readFileSync(join(taskDir, "task.json"), "utf8")).delivery === "local-only";
	if (!local)
		try {
			execFileSync("gh", ["auth", "status", "--active"], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 30_000 });
		} catch (err) {
			problems.push(err.code === "ENOENT" ? "gh is not installed: install the GitHub CLI, which PR delivery and pr-state need" : `gh is not logged in (${errorLine(err.stderr)}): run gh auth login`);
		}

	if (problems.length) throw new Refusal(problems.join("\n"));
	return `ok: ${roles} roles resolve${runtime ? ` on ${runtime}` : ""}; ${signs ? "a signed commit works" : "commits need no signature"}; ${local ? "gh not needed for a local-only task" : "gh is logged in"}`;
}

function lockPath(name, globalDir) {
	if (!ID.test(name ?? "")) throw new Usage(`lock name must match ${ID}: ${name}`);
	return join(globalDir, "locks", name);
}

// The lock's holder, or undefined when no lock is there, including one released while this reads it.
function holderOf(path) {
	let text;
	try {
		text = readFileSync(path, "utf8");
	} catch (err) {
		if (err.code === "ENOENT") return undefined;
		throw err;
	}
	const field = (key) => text.match(new RegExp(`^${key}: (.+)$`, "m"))?.[1] ?? "unknown";
	return { task: field("task"), home: field("home"), since: field("since") };
}

const heldBy = (holder) => `task ${holder.task} in ${holder.home} since ${holder.since}`;

// One machine's desktop, simulators, ports and local databases are shared by every task on it, so the lock lives in the global directory.
export function lock(home, name, task, globalDir = globalHome()) {
	const path = lockPath(name, globalDir);
	existingTask(home, task);
	mkdirSync(dirname(path), { recursive: true });
	for (let attempt = 0; ; attempt++) {
		// The holder is written to a private file first and linked into place, so no reader sees a half-written lock and a failed write leaves none.
		const draft = `${path}.${process.pid}.draft`;
		writeFileSync(draft, `task: ${task}\nhome: ${home}\nsince: ${new Date().toISOString()}\n`);
		try {
			linkSync(draft, path);
			return `locked ${name} for task ${task}`;
		} catch (err) {
			if (err.code !== "EEXIST") throw err;
		} finally {
			rmSync(draft, { force: true });
		}
		const holder = holderOf(path);
		// Released between the create and the read, so try the create once more.
		if (!holder && attempt === 0) continue;
		if (holder?.task === task && holder.home === home) return `${name} is already locked for task ${task} since ${holder.since}`;
		throw new Refusal(`${name} is locked by ${holder ? heldBy(holder) : "another task"} (${path}): notify that task's lead, and never ask the human to relay`);
	}
}

export function unlock(home, name, task, globalDir = globalHome()) {
	const path = lockPath(name, globalDir);
	if (!ID.test(task ?? "")) throw new Usage(`task id must match ${ID}: ${task}`);
	const holder = holderOf(path);
	if (!holder) return `${name} is not locked`;
	if (holder.task !== task || holder.home !== home) throw new Refusal(`${name} is locked by ${heldBy(holder)}, not by task ${task}: only that task's lead unlocks it`);
	rmSync(path);
	return `unlocked ${name}`;
}

function lockGaps(home, id, globalDir) {
	const dir = join(globalDir, "locks");
	return (existsSync(dir) ? readdirSync(dir) : [])
		.filter((name) => ID.test(name))
		.filter((name) => {
			const holder = holderOf(join(dir, name));
			return holder?.task === id && holder.home === home;
		})
		.map((name) => `task ${id} still holds lock ${name}: run tstack.mjs unlock ${name} --task ${id}`);
}

const SETTLE_MS = 10 * 60 * 1000;
// How long pr-state waits for a review bot to review the head, counted like the settle from the last push, comment or review.
// The bound lets a bot that paused or ran out of reviews end as READY bot-unreviewed instead of a wait that never ends.
const BOT_WAIT_MS = 2 * SETTLE_MS;
const FAILED_RUN = new Set(["FAILURE", "TIMED_OUT", "CANCELLED", "STARTUP_FAILURE", "STALE"]);
// Sections of a review bot's review body, such as CodeRabbit's, whose findings are in no review thread.
// Its "Actionable comments posted" count is not one of them, because those comments are the review's threads.
const BODY_FINDINGS = /\b(outside diff range|nitpick|duplicate) comments \((\d+)\)/gi;
const FINDING_NAMES = { "outside diff range": "outside-diff", nitpick: "nitpick", duplicate: "duplicate" };
// GitHub's compare API lists at most 300 changed files.
const COMPARE_FILES = 300;
const PR_QUERY = `query($owner: String!, $repo: String!, $n: Int!) { repository(owner: $owner, name: $repo) { pullRequest(number: $n) {
  state isDraft baseRefName mergeable mergeStateStatus reviewDecision headRefOid updatedAt
  commits(last: 1) { nodes { commit { committedDate statusCheckRollup { contexts(first: 100) { pageInfo { hasNextPage } nodes {
    __typename ... on CheckRun { name status conclusion } ... on StatusContext { context state } } } } } } }
  reviewThreads(first: 100) { pageInfo { hasNextPage } nodes { id isResolved path line } }
  files(first: 100) { pageInfo { hasNextPage } nodes { path changeType } }
  comments(last: 1) { nodes { createdAt } }
  reviews(last: 100) { pageInfo { hasPreviousPage } nodes { id submittedAt body author { __typename login } commit { oid } reactionGroups { viewerHasReacted } } }
} } }`;

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// What the review bots said on this PR. A bot's pass is a review with a body, because a review with an empty body is a reply in a thread.
// A bot's round count is how many heads it has passed.
function reviewBots(pr) {
	const bots = new Map();
	for (const r of pr.reviews?.nodes ?? []) {
		const login = r.author?.login;
		if (!login || !r.body?.trim() || !(r.author.__typename === "Bot" || login.endsWith("[bot]"))) continue;
		const bot = bots.get(login) ?? { heads: new Set(), onHead: [] };
		if (r.commit?.oid) bot.heads.add(r.commit.oid);
		if (r.commit?.oid === pr.headRefOid) bot.onHead.push(r);
		bots.set(login, bot);
	}
	// A bot that passed two heads reviews pushes. One that passed a single head, such as the Codex connector, may review only on request.
	const missing = [...bots].filter(([, b]) => b.heads.size >= 2 && !b.heads.has(pr.headRefOid)).map(([login]) => login);
	// Findings in the body of a pass on this head. A reaction from the gh account on that review marks them triaged.
	const findings = [];
	for (const [login, b] of bots)
		for (const r of b.onHead) {
			if (r.reactionGroups?.some((g) => g.viewerHasReacted)) continue;
			const counts = new Map();
			for (const [, label, n] of r.body.matchAll(BODY_FINDINGS)) {
				const name = FINDING_NAMES[label.toLowerCase()];
				if (!counts.has(name)) counts.set(name, Number(n));
			}
			const items = [...counts].filter(([, n]) => n > 0).map(([name, n]) => `${n} ${name}`);
			if (items.length) findings.push(`${login} ${r.id} (${items.join(", ")})`);
		}
	return {
		missing,
		findings: findings.length ? `bot-findings: comments outside any review thread in ${findings.join(", ")}: triage them, then react to each review` : "",
		rounds: bots.size ? `bot-rounds: ${[...bots].map(([login, b]) => `${login} ${b.heads.size}`).join(", ")}` : "",
	};
}

// One verdict for a PR from GitHub's own state. WAITING means nothing is wrong yet but it is not ready.
// `required` names the base branch's required checks, so one that has not started yet still counts as pending.
// `base` is the compare from the head to the base branch: how many commits the base is ahead, and the files those commits change.
export function prVerdict(pr, now = Date.now(), required = [], base) {
	const head = pr.headRefOid?.slice(0, 12) ?? "unknown";
	// An outdated thread still counts: branch protection's resolve-conversations rule counts it.
	// Every blocker lists the unresolved threads and the bot findings, so a threads-only pass can answer them without touching the blocker.
	const open = (pr.reviewThreads?.nodes ?? []).filter((t) => !t.isResolved);
	const more = pr.reviewThreads?.pageInfo?.hasNextPage ? " in the first 100, and more to read on GitHub" : "";
	const list = open.map((t) => `${t.id} ${t.path ?? "?"}${t.line ? `:${t.line}` : ""}`).join(", ");
	const threads = `review-threads: ${open.length} unresolved${more}${list ? `: ${list}` : ""}`;
	const bots = reviewBots(pr);
	const notes = [open.length || more ? threads : "", bots.findings, bots.rounds].filter(Boolean);
	const say = (verdict, reason) =>
		`${verdict}${reason ? ` ${reason}` : ""}${verdict === "BLOCKER" ? notes.filter((n) => n !== reason).map((n) => `; ${n}`).join("") : ""} (head ${head})`;
	if (pr.state === "MERGED") return say("MERGED");
	if (pr.state === "CLOSED") return say("CLOSED", "closed without merging");
	if (pr.isDraft) return say("BLOCKER", "draft: mark it ready");
	if (pr.mergeable === "CONFLICTING") return say("BLOCKER", "conflicts: merge the base branch in");
	// A base that moved in files this PR changes can break it with no conflict, so the proof has to run again on the merged tree.
	if (base?.behind) {
		const mine = new Set((pr.files?.nodes ?? []).map((f) => f.path));
		const shared = [...new Set(base.files.filter((f) => mine.has(f)))];
		// GitHub gives a renamed file's new path only, so a base change to its old path cannot be seen: block on any base change.
		const renamed = base.files.length > 0 && (pr.files?.nodes ?? []).some((f) => f.changeType === "RENAMED");
		const unread = base.count >= COMPARE_FILES || (base.count > 0 && pr.files?.pageInfo?.hasNextPage);
		const which = shared.length
			? `files this PR changes: ${shared.slice(0, 5).join(", ")}${shared.length > 5 ? ` and ${shared.length - 5} more` : ""}`
			: unread
				? "more files than pr-state reads"
				: "files, and this PR renames a file whose old path GitHub does not report";
		if (shared.length || unread || renamed)
			return say("BLOCKER", `base-moved: ${pr.baseRefName} is ${plural(base.behind, "commit")} ahead and changes ${which}; merge it in and run the proof again`);
	}
	const commit = pr.commits?.nodes?.[0]?.commit;
	// ponytail: reads the first 100 checks and threads; page through them if a PR ever has more.
	// It reads the last 100 reviews, and blocks when there are more, because an older bot review on this head could hold findings; and the first 100 files, so base-moved blocks when it cannot read them all.
	if (commit?.statusCheckRollup?.contexts?.pageInfo?.hasNextPage || pr.reviewThreads?.pageInfo?.hasNextPage || pr.reviews?.pageInfo?.hasPreviousPage)
		return say("BLOCKER", "too-many: over 100 checks, review threads or reviews, so read them on GitHub");
	const checks = (commit?.statusCheckRollup?.contexts?.nodes ?? []).map((c) =>
		c.__typename === "StatusContext"
			? { name: c.context, failed: ["FAILURE", "ERROR"].includes(c.state), pending: ["PENDING", "EXPECTED"].includes(c.state) }
			: { name: c.name, failed: FAILED_RUN.has(c.conclusion), pending: c.status !== "COMPLETED", approval: c.conclusion === "ACTION_REQUIRED" },
	);
	const failed = checks.filter((c) => c.failed).map((c) => c.name);
	if (failed.length) return say("BLOCKER", `failing-checks: ${failed.join(", ")}`);
	if (open.length) return say("BLOCKER", threads);
	if (bots.findings) return say("BLOCKER", bots.findings);
	if (pr.reviewDecision === "CHANGES_REQUESTED") return say("BLOCKER", "changes-requested");
	const reported = new Set(checks.map((c) => c.name));
	const pending = [...checks.filter((c) => c.pending).map((c) => c.name), ...required.filter((name) => !reported.has(name)).map((name) => `${name} (required, not started)`)];
	if (pending.length) return say("WAITING", `checks: ${pending.join(", ")}`);
	const latest = Math.max(
		...[commit?.committedDate, pr.updatedAt, pr.comments?.nodes?.[0]?.createdAt, ...(pr.reviews?.nodes ?? []).map((r) => r.submittedAt)].filter(Boolean).map((t) => Date.parse(t)),
	);
	const ago = Math.round((now - latest) / 1000);
	if (bots.missing.length && now - latest < BOT_WAIT_MS)
		return say("WAITING", `bot-review: ${bots.missing.join(", ")} reviewed earlier heads but not this one yet; the last push, comment, review or edit was ${ago}s ago, and bots get ${BOT_WAIT_MS / 60000} minutes`);
	if (now - latest < SETTLE_MS) return say("WAITING", `settle: the last push, comment, review or edit was ${ago}s ago, and review bots get ${SETTLE_MS / 60000} minutes`);
	if (pr.mergeable === "UNKNOWN" || pr.mergeStateStatus === "UNKNOWN") return say("WAITING", "mergeable-unknown: GitHub is still computing whether it merges");
	if (pr.mergeStateStatus === "BEHIND") return say("BLOCKER", "behind-base: merge the base branch in");
	if (pr.reviewDecision === "REVIEW_REQUIRED") return say("WAITING", "review-required: a human must review");
	// ACTION_REQUIRED is a gate waiting on a person, such as an owner's approval, not a failed run.
	const approval = checks.filter((c) => c.approval).map((c) => c.name);
	if (approval.length) return say("WAITING", `approval: ${approval.join(", ")} waits on a person`);
	if (pr.mergeStateStatus === "BLOCKED") return say("BLOCKER", "merge-blocked: a branch rule GitHub does not name blocks the merge");
	const ready = [];
	if (!checks.length) ready.push("ci-none: no checks reported; trust it only when a second run on the same head agrees");
	if (bots.missing.length) ready.push(`bot-unreviewed: ${bots.missing.join(", ")} reviewed earlier heads but not this one in ${BOT_WAIT_MS / 60000} minutes; ask once for a review of this head`);
	if (base?.behind) ready.push(`base: ${pr.baseRefName} is ${plural(base.behind, "commit")} ahead, in none of this PR's files`);
	return say("READY", ready.join("; "));
}

const TRANSIENT = /HTTP (5\d\d|429)|secondary rate limit|timed? ?out|connection (reset|refused)|\bEOF\b|temporar|could not resolve host|TLS handshake/i;

export const isTransient = (message) => TRANSIENT.test(message);

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Runs gh, and retries a server error, a secondary rate limit or a network failure four times with backoff.
// A spent primary rate limit resets within the hour, so it is not retried.
function gh(args) {
	for (let attempt = 0; ; attempt++) {
		try {
			return execFileSync("gh", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
		} catch (err) {
			const message = String(err.stderr || err.message).trim();
			if (attempt === 4 || !isTransient(message)) throw new Error(message);
			sleep(2000 * 2 ** attempt);
		}
	}
}

// A branch name as a URL path, so a character such as `#` or `?` stays part of the name.
export const refPath = (ref) => ref.split("/").map(encodeURIComponent).join("/");

// The base branch's required checks, from rulesets and from classic branch protection.
// Reading protection needs admin rights, so a refusal means only that this source is unknown.
function requiredChecks(base) {
	const sources = [
		[`repos/{owner}/{repo}/rules/branches/${refPath(base)}`, '.[] | select(.type == "required_status_checks") | .parameters.required_status_checks[].context'],
		[`repos/{owner}/{repo}/branches/${refPath(base)}/protection/required_status_checks`, ".contexts[]?"],
	];
	const names = new Set();
	for (const [path, jq] of sources) {
		try {
			for (const name of gh(["api", path, "--jq", jq]).split("\n")) if (name) names.add(name);
		} catch {}
	}
	return [...names];
}

// How far the base branch is ahead of the head, and the files it changed since they parted, in one compare call.
function baseAhead(pr) {
	const jq = "{behind: .ahead_by, count: (.files // [] | length), files: [.files[]? | .filename, (.previous_filename // empty)]}";
	return JSON.parse(gh(["api", `repos/{owner}/{repo}/compare/${pr.headRefOid}...${refPath(pr.baseRefName)}`, "--jq", jq]));
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
		let base;
		if (pr.state === "OPEN") {
			required ??= requiredChecks(pr.baseRefName);
			try {
				base = baseAhead(pr);
			} catch (err) {
				throw new Refusal(`gh could not compare PR ${number}'s head with ${pr.baseRefName}: ${err.message}`);
			}
		}
		const verdict = prVerdict(pr, Date.now(), required ?? [], base);
		const left = deadline - Date.now();
		if (!verdict.startsWith("WAITING") || left <= 0) return verdict;
		sleep(Math.min(60_000, left));
	}
}

const BOOLEAN_FLAGS = new Set(["--project-skills", "--size"]);

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

const ALLOWED = {
	home: [],
	brief: ["playbook", "goal", "finish", "kind", "delivery", "design", "acceptance", "push", "merge"],
	check: ["through", "head"],
	backlog: [],
	status: ["size"],
	seat: ["runtime", "task", "cross", "avoid"],
	"check-seats": ["task"],
	preflight: ["runtime", "task"],
	lock: ["task"],
	unlock: ["task"],
	"pr-state": ["wait"],
	exclude: ["project-skills"],
	"link-skills": [],
};

export function main(argv) {
	const [command, ...rest] = argv;
	const f = flags(rest);
	const unknown = Object.keys(f).filter((k) => k !== "_" && !(ALLOWED[command] ?? []).includes(k));
	if (command in ALLOWED && unknown.length)
		throw new Usage(`${command} takes no ${unknown.map((k) => `--${k}`).join(", ")}; its flags are ${ALLOWED[command].map((k) => `--${k}`).join(", ") || "none"}`);
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
		case "backlog":
			if (f._.length !== 1) throw new Usage("backlog takes one task id");
			return backlog(taskHome(), f._[0]);		case "status":
			if (f._.length > 1) throw new Usage("status takes at most one task id");
			return status(taskHome(), f._[0], f.size === true);
		case "seat":
			if (f._.length < 1) throw new Usage("seat takes a role name");
			return seat(loadModels(taskHome(), undefined, f.task), f._.join(" "), f.runtime, f.cross, f.avoid)
				.map((s) => JSON.stringify(s))
				.join("\n");
		case "check-seats": {
			if (!f._.length) throw new Usage("check-seats takes the paths of saved orchestrator_capabilities results, the short list first");
			const catalogs = f._.map((path) => {
				const caps = JSON.parse(readFileSync(path, "utf8"));
				return Array.isArray(caps) ? JSON.parse(caps[0].text) : caps;
			});
			return checkSeats(loadModels(taskHome(), undefined, f.task), catalogs);
		}
		case "preflight":
			if (f._.length) throw new Usage("preflight takes no arguments, only --runtime and --task");
			return preflight(taskHome(), f.runtime, f.task);
		case "lock":
		case "unlock":
			if (f._.length !== 1) throw new Usage(`${command} takes one lock name`);
			if (f.task === undefined) throw new Usage(`${command} needs --task <id>`);
			return (command === "lock" ? lock : unlock)(taskHome(), f._[0], f.task);
		case "pr-state":
			if (f._.length !== 1) throw new Usage("pr-state takes one PR number");
			return prState(f._[0], f.wait === undefined ? 0 : Number(f.wait));
		case "exclude":
			return exclude(process.cwd(), f["project-skills"] === true);
		case "link-skills":
			if (f._.length !== 1) throw new Usage("link-skills takes one worktree path");
			return linkSkills(process.cwd(), f._[0]);
		default:
			throw new Usage("commands: home, brief, check, backlog, status, seat, check-seats, preflight, lock, unlock, pr-state, exclude, link-skills");
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
