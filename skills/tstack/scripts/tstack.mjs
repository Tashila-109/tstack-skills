#!/usr/bin/env node
// tstack: the facts tstack-skills keeps on disk. No dependencies; runs on Node 20+ or Bun.
//
//   node tstack.mjs home
//   node tstack.mjs brief <id> --playbook <name> --goal <text> --finish <text> [--kind ship|scout] [--delivery local-only|pr]
//   node tstack.mjs check <id> [--through <step>]
//   node tstack.mjs seat <role> --runtime t3|herdr [--cross <model>]
//   node tstack.mjs check-seats <saved orchestrator_capabilities result>
//   node tstack.mjs exclude [--project-skills]
//   node tstack.mjs link-skills <worktree>
//
// Exit 0 on success, 1 on a refusal (the reason is on stderr), 2 on a usage error, 3 on anything unexpected.

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
const GRANTED = /^##\s+Answer\s*\n+\s*granted\b/im;

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

export function parseSteps(markdown) {
	const steps = [];
	let fenced = false;
	for (const line of markdown.split("\n")) {
		if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
		if (fenced) continue;
		const step = line.match(/^(\d+)\.\s+(.*)$/);
		if (step) {
			steps.push({ n: Number(step[1]), text: step[2].trim(), artifacts: [] });
			continue;
		}
		const artifact = line.match(/^\s*Artifact:\s*(.+)$/);
		if (artifact && steps.length) {
			const paths = [...artifact[1].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
			steps.at(-1).artifacts.push(...(paths.length ? paths : [artifact[1].trim()]));
		}
	}
	return steps;
}

function insideTask(taskDir, path) {
	const full = resolve(taskDir, path);
	const rel = relative(taskDir, full);
	if (!rel || rel.startsWith("..") || rel.startsWith(sep)) throw new Refusal(`artifact path leaves the task directory: ${path}`);
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
		"The final report goes in `report.md` in the task directory.",
		`\`node ${fileURLToPath(import.meta.url)} check ${id}\` must pass before you report done.`,
		...(learnings ? ["", "## Learnings from earlier tasks", "", learnings] : []),
		"",
	];
	const briefPath = join(taskDir, "brief.md");
	writeFileSync(briefPath, lines.join("\n"));
	return briefPath;
}

export function check(home, id, through) {
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
	const missing = wanted.filter(({ path }) => {
		const full = insideTask(taskDir, path);
		if (!existsSync(full) || !statSync(full).isFile()) return true;
		const text = readFileSync(full, "utf8");
		return path.startsWith("decisions/") ? !GRANTED.test(text) : !text.trim();
	});
	if (missing.length)
		throw new Refusal(
			missing
				.map((m) => `missing ${m.step}: ${m.path}${m.path.startsWith("decisions/") ? " with a granted answer" : ""}`)
				.join("\n"),
		);
	return `ok ${id}: ${wanted.length} required file${wanted.length === 1 ? "" : "s"} present`;
}

export function parseModels(text) {
	const lines = new Map();
	for (const raw of text.split("\n")) {
		const line = raw.trim();
		if (!line || line.startsWith("#")) continue;
		const at = line.indexOf(":");
		if (at < 1) continue;
		const value = line.slice(at + 1).trim();
		for (const key of line.slice(0, at).split(",")) lines.set(key.trim().toLowerCase(), value);
	}
	return lines;
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
	const key = role.trim().toLowerCase();
	const value =
		models.get(key) ?? models.get(key.split(",")[0].trim()) ?? (key.startsWith("lead ") ? models.get("lead") : undefined);
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
		throw new Usage(`--runtime must be t3 or herdr: ${runtime}`);
	});
}

export function checkSeats(models, caps) {
	const providers = new Map((caps.providers ?? []).filter((p) => p.canRunChildTask).map((p) => [p.providerInstanceId, p]));
	const problems = new Set();
	const checked = new Set();
	for (const role of models.keys()) {
		if (role === "t3 instances" || role.startsWith("herdr args")) continue;
		for (const s of seat(models, role, "t3")) {
			if (s.inherit) continue;
			checked.add(JSON.stringify(s));
			const where = `${role}: ${s.providerInstanceId} ${s.model}`;
			const provider = providers.get(s.providerInstanceId);
			const model = provider?.models?.find((m) => m.id === s.model);
			if (!provider) problems.add(`${where}: instance ${s.providerInstanceId} cannot run child tasks here`);
			else if (!model) {
				const near = (provider.models ?? []).filter((m) => m.id.endsWith(`/${s.model}`)).map((m) => m.id);
				problems.add(`${where}: model not advertised${near.length ? `; advertised as ${near.join(" or ")}` : ""}`);
			} else
				for (const o of s.options ?? []) {
					const values = model.options?.find((x) => x.id === o.id)?.options?.map((v) => v.id) ?? [];
					if (!values.includes(o.value)) problems.add(`${where}: ${o.id} ${o.value} not offered (${values.join(", ") || "no such option"})`);
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
			if (through !== undefined && !Number.isInteger(through)) throw new Usage(`--through must be a step number: ${f.through}`);
			return check(taskHome(), f._[0], through);
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
		case "exclude":
			return exclude(process.cwd(), f["project-skills"] === true);
		case "link-skills":
			if (f._.length !== 1) throw new Usage("link-skills takes one worktree path");
			return linkSkills(process.cwd(), f._[0]);
		default:
			throw new Usage("commands: home, brief, check, seat, check-seats, exclude, link-skills");
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
