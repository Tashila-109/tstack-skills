#!/usr/bin/env node
// tstack: the facts tstack-skills keeps on disk. No dependencies; runs on Node 20+ or Bun.
//
//   node tstack.mjs home
//   node tstack.mjs brief <id> --playbook <name> --goal <text> --finish <text> [--kind ship|scout] [--delivery local-only|pr]
//   node tstack.mjs check <id> [--through <step>]
//   node tstack.mjs seat <role> --runtime t3|herdr
//
// Exit 0 on success, 1 on a refusal (the reason is on stderr), 2 on a usage error, 3 on anything unexpected.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const ID = /^[a-z0-9][a-z0-9-]{0,47}$/;

export class Refusal extends Error {}
class Usage extends Error {}

export function taskHome(cwd = process.cwd()) {
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
	return join(dirname(common), ".tstack");
}

export function parseSteps(markdown) {
	const steps = [];
	for (const line of markdown.split("\n")) {
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
	const kind = opts.kind ?? "ship";
	const delivery = opts.delivery ?? "local-only";
	if (!["ship", "scout"].includes(kind)) throw new Usage(`--kind must be ship or scout: ${kind}`);
	if (!["local-only", "pr"].includes(delivery)) throw new Usage(`--delivery must be local-only or pr: ${delivery}`);
	const playbookPath = join(opts.playbooksDir ?? join(SKILL_DIR, "playbooks"), `${opts.playbook}.md`);
	if (!existsSync(playbookPath)) throw new Refusal(`no playbook named ${opts.playbook} at ${playbookPath}`);
	const taskDir = join(home, "tasks", id);
	if (existsSync(taskDir)) throw new Refusal(`task ${id} already exists at ${taskDir}`);

	const steps = parseSteps(readFileSync(playbookPath, "utf8"));
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
	const wanted = task.steps
		.filter((s) => through === undefined || s.n <= through)
		.flatMap((s) => s.artifacts.map((path) => ({ step: `step ${s.n}`, path })));
	if (through === undefined) wanted.push({ step: "final report", path: "report.md" });
	const missing = wanted.filter(({ path }) => {
		const full = insideTask(taskDir, path);
		return !existsSync(full) || !statSync(full).isFile() || !readFileSync(full, "utf8").trim();
	});
	if (missing.length) throw new Refusal(missing.map((m) => `missing ${m.step}: ${m.path}`).join("\n"));
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

export function parseSeat(text) {
	if (text === "inherit") return { inherit: true };
	const m = text.match(/^([a-z0-9][a-z0-9-]*)\/([A-Za-z0-9][A-Za-z0-9._:/+[\]-]*?)(?:@([a-z0-9-]+))?$/i);
	if (!m) throw new Refusal(`seat must be harness/model[@effort] or inherit, with no spaces or leading dashes: ${text}`);
	return { harness: m[1].toLowerCase(), model: m[2], effort: m[3] };
}

export function seat(models, role, runtime) {
	const key = role.trim().toLowerCase();
	const value = models.get(key) ?? (key.startsWith("lead ") ? models.get("lead") : undefined);
	if (!value) throw new Refusal(`no line for role "${role}" in the models file; run tstack-setup to write it`);
	return value.split(",").map((s) => {
		const parsed = parseSeat(s.trim());
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

function flags(args) {
	const out = { _: [] };
	for (let i = 0; i < args.length; i++) {
		if (args[i].startsWith("--")) {
			if (i + 1 >= args.length) throw new Usage(`${args[i]} needs a value`);
			out[args[i].slice(2)] = args[++i];
		} else out._.push(args[i]);
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
			return seat(loadModels(taskHome()), f._.join(" "), f.runtime)
				.map((s) => JSON.stringify(s))
				.join("\n");
		default:
			throw new Usage("commands: home, brief, check, seat");
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
	try {
		console.log(main(process.argv.slice(2)));
	} catch (err) {
		console.error(err.message);
		process.exit(err instanceof Usage ? 2 : err instanceof Refusal ? 1 : 3);
	}
}
