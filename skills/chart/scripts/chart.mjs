#!/usr/bin/env node
// chart: the facts behind a chart the chart skill draws. Runs on Node 20+ or Bun with nothing to install by hand.
//
//   node chart.mjs check <chart.mmd>... [--root <dir>]
//   node chart.mjs render <chart.mmd>... [--root <dir>] [--theme clean|blueprint|t3|<file.css>]
//   node chart.mjs stale <chart.mmd>... [--root <dir>]
//
// --root is the folder that `%% src:` paths start from: the Git checkout around the current folder by default.
// Rendering uses pele@1.9.0, which the first check or render installs into ~/.tstack/cache with npm.
// Set PELE to the path of a pele.js to use another copy.
// The t3 theme takes its colors from a T3 thread, so it writes an HTML page for T3's html_render instead of an SVG.
// check counts the arrows Pele draws, and says when a chart has more than 20.
//
// Exit 0 on success, 1 on a refusal (the reason is on stderr), 2 on a usage error, 3 on anything unexpected.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SKILL_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const PELE_VERSION = "1.9.0";
const PELE_CACHE = join(homedir(), ".tstack", "cache", `pele-${PELE_VERSION}`);
const KIND = /^%%\s*chart:\s*(\S+)\s*$/m;
const SYNCED = /^%%\s*synced:\s*(\S+)\s*$/m;
const SRC = /^%%\s*src:(.*)$/;
const NEW = /^%%\s*new:(.*)$/;
const CITE = /^(.+?)(?::(\d+)(?:-(\d+))?)?$/;
const ARROW_LIMIT = 20;
// Per diagram family, the keywords of lines that group, style or annotate a chart, and so draw no box or arrow of their own.
// Mermaid reads sequence keywords in any case and the rest only as written.
const KEYWORDS = {
	flowchart: /^(subgraph|end|direction|classDef|class|style|linkStyle|click)(?=\s|$)/,
	sequence: /^(autonumber|loop|alt|else|opt|par|par_over|and|rect|critical|option|break|end|activate|deactivate|destroy|note|box|links?)(?=\s|$)/i,
	state: /^(direction|classDef|class|style|note|--)(?=\s|$)/,
	class: /^(note|classDef|style|cssClass|direction|click|link|callback|namespace)(?=\s|$)/,
	er: /^(direction|style|classDef|class)(?=\s|$)/,
	c4: /^(Update\w*|title)(?=[\s(]|$)/,
	architecture: /^(group|junction)(?=\s|$)/,
};
const ANY_TYPE = /^(title|accTitle|accDescr)(?=[\s:{]|$)/;
// A class diagram line such as `Animal : +run()` adds a member to a box, not a box.
const CLASS_MEMBER = /^[\w$]+\s*:/;

function family(type) {
	if (type === "flowchart" || type === "graph") return "flowchart";
	if (type === "sequenceDiagram") return "sequence";
	if (type?.startsWith("stateDiagram")) return "state";
	if (type === "classDiagram") return "class";
	if (type === "erDiagram") return "er";
	if (type?.startsWith("C4")) return "c4";
	if (type === "architecture-beta") return "architecture";
	return null;
}

export class Refusal extends Error {}
class Usage extends Error {}

export function parseChart(text) {
	const lines = text.split("\n");
	const kind = text.match(KIND)?.[1] ?? null;
	const synced = text.match(SYNCED)?.[1] ?? null;
	const cites = [];
	const problems = [];
	const statements = [];
	let type = null;
	let keywords = null;
	let frontmatter = false;
	let attributes = false;
	let noteBody = false;
	let pending = { cites: [], isNew: false };
	const reset = () => (pending = { cites: [], isNew: false });

	lines.forEach((raw, i) => {
		const line = i + 1;
		const t = raw.trim();
		if (!type && t === "---") return void (frontmatter = !frontmatter);
		if (frontmatter) return;
		if (!t) return void reset();
		if (t.startsWith("%%")) {
			const src = t.match(SRC);
			const added = t.match(NEW);
			if (src) {
				const found = src[1].split(",").map((s) => s.trim()).filter(Boolean);
				if (!found.length) problems.push(`line ${line}: src: names no path`);
				for (const cite of found) cites.push({ line, cite });
				pending.cites.push(...found);
			} else if (added) {
				if (!added[1].trim()) problems.push(`line ${line}: new: needs a reason, such as "new: cache for the session lookups"`);
				pending.isNew = true;
			} else reset();
			return;
		}
		if (!type) {
			type = t.split(/\s+/)[0];
			keywords = KEYWORDS[family(type)] ?? null;
			return void reset();
		}
		if (attributes) {
			if (t.startsWith("}")) attributes = false;
			return void reset();
		}
		if (noteBody) {
			if (/^end\s+note$/i.test(t)) noteBody = false;
			return void reset();
		}
		const fam = family(type);
		if (fam === "state" && /^note\s/i.test(t) && !t.includes(":")) {
			noteBody = true;
			return void reset();
		}
		const keyword = ANY_TYPE.test(t) || keywords?.test(t);
		const opensBlock = t.endsWith("{");
		const attributeBlock = opensBlock && !keyword && (fam === "er" || fam === "class");
		const isStatement =
			!t.startsWith("}") && !keyword && (opensBlock ? attributeBlock : !(fam === "class" && CLASS_MEMBER.test(t)));
		if (isStatement) statements.push({ line, text: t, cites: pending.cites, isNew: pending.isNew });
		if (attributeBlock) attributes = true;
		reset();
	});
	return { kind, synced, type, statements, cites, problems };
}

function outside(full, root) {
	const rel = relative(root, full);
	return rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
}

export function resolveCite(cite, root) {
	const [, path, start, end] = cite.match(CITE);
	const full = resolve(root, path);
	if (isAbsolute(path) || outside(full, root)) return `${cite} is outside ${root}`;
	if (!existsSync(full)) return `${cite} does not exist under ${root}`;
	// Git tracks a link, not what it points to, so a citation through a link could change without stale seeing it.
	const real = realpathSync(full);
	if (real !== full) return outside(real, root) ? `${cite} is a link to a path outside ${root}` : `${cite} goes through a link: cite ${relative(root, real)} instead`;
	if (start === undefined) return null;
	if (statSync(full).isDirectory()) return `${cite} is a folder, so it takes no line number`;
	const content = readFileSync(full, "utf8");
	const count = content === "" ? 0 : content.replace(/\n$/, "").split("\n").length;
	const first = Number(start);
	const last = end === undefined ? first : Number(end);
	if (first < 1 || last < first) return `${cite} is not a line range`;
	if (last > count) return `${cite} is past the end of ${path}, which has ${count} lines`;
	return null;
}

function defaultRoot() {
	try {
		return realpathSync(execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
	} catch {
		throw new Usage(`${process.cwd()} is not inside a Git checkout: pass --root <the repo the chart cites>`);
	}
}

const lineOf = (problem) => Number(problem.match(/^line (\d+):/)?.[1] ?? 0);

export async function loadPele() {
	let entry = process.env.PELE;
	if (!entry) {
		entry = join(PELE_CACHE, "node_modules", "pele", "dist", "pele.js");
		if (!existsSync(entry)) {
			mkdirSync(PELE_CACHE, { recursive: true });
			try {
				execFileSync("npm", ["install", "--prefix", PELE_CACHE, "--no-audit", "--no-fund", "--ignore-scripts", "--loglevel=error", `pele@${PELE_VERSION}`], {
					stdio: ["ignore", "ignore", "pipe"],
				});
			} catch (err) {
				throw new Refusal(`could not install pele@${PELE_VERSION} into ${PELE_CACHE}: ${err.stderr?.toString().trim() || err.message}\nInstall it there by hand, or set PELE to the path of a pele.js.`);
			}
		}
	}
	return import(pathToFileURL(resolve(entry)).href);
}

export function checkChart(file, root, pele) {
	const text = readFileSync(file, "utf8");
	const chart = parseChart(text);
	const problems = [...chart.problems];
	if (chart.kind !== "code" && chart.kind !== "design") problems.push(`no "%% chart: code" or "%% chart: design" line`);
	if (chart.kind === "code")
		for (const s of chart.statements)
			if (!s.cites.length && !s.isNew) problems.push(`line ${s.line}: "${s.text}" has no src: or new: comment directly above it`);
	for (const { line, cite } of chart.cites) {
		const wrong = resolveCite(cite, root);
		if (wrong) problems.push(`line ${line}: ${wrong}`);
	}
	let svg = null;
	try {
		pele.parse(text);
		svg = pele.render(text).svg;
	} catch (err) {
		if (err?.name !== "PeleError") throw err;
		problems.push(`${err.line ? `line ${err.line}: ` : ""}Pele cannot draw it, ${err.code} error: ${err.message}`);
	}
	if (problems.length)
		throw new Refusal(`${file} (citations start from ${root}):\n${problems.sort((a, b) => lineOf(a) - lineOf(b)).map((p) => `  ${p}`).join("\n")}`);
	const added = chart.statements.filter((s) => s.isNew).length;
	const arrows = (svg.match(/<g class="pele-edge[" ]/g) ?? []).length;
	const over = arrows > ARROW_LIMIT ? `; more than ${ARROW_LIMIT} arrows, so split it unless the reader needs the whole picture` : "";
	return { chart, svg, summary: `ok ${file}: ${chart.kind} chart, ${arrows} arrows, ${chart.cites.length} citations, ${added} new${over}` };
}

function checkAll(files, root, pele) {
	const results = [];
	const refusals = [];
	for (const file of files) {
		try {
			results.push(checkChart(file, root, pele));
		} catch (err) {
			if (!(err instanceof Refusal)) throw err;
			refusals.push(err.message);
		}
	}
	if (refusals.length) throw new Refusal(refusals.join("\n"));
	return results;
}

export function check(files, root, pele) {
	return checkAll(files, root, pele)
		.map((r) => r.summary)
		.join("\n");
}

export function themeCss(theme) {
	if (theme.endsWith(".css")) {
		if (!existsSync(theme)) throw new Usage(`no theme file at ${theme}`);
		return readFileSync(theme, "utf8");
	}
	const path = join(SKILL_DIR, "themes", `${theme}.css`);
	if (!/^[a-z0-9-]+$/.test(theme) || !existsSync(path)) throw new Usage(`--theme must be clean, blueprint, t3, or the path of a .css file: ${theme}`);
	return readFileSync(path, "utf8");
}

export function styled(svg, css) {
	if (css.includes("]]>")) throw new Usage("the theme contains ]]>, which cannot go inside the SVG's style element");
	const open = svg.match(/^<svg\b[^>]*>/);
	if (!open) throw new Error("pele returned no <svg> element");
	return `${open[0]}<style><![CDATA[\n${css}]]></style>${svg.slice(open[0].length)}`;
}

export function render(files, root, pele, theme = "clean") {
	const css = themeCss(theme);
	const page = theme === "t3";
	const outputs = checkAll(files, root, pele).map(({ svg }, i) => {
		const out = join(dirname(files[i]), `${basename(files[i], extname(files[i]))}.${page ? "html" : "svg"}`);
		const themed = styled(svg, css);
		return [out, page ? `<!doctype html>\n<html><head><meta charset="utf-8"></head><body>${themed}</body></html>\n` : `${themed}\n`];
	});
	const seen = new Set();
	for (const [out] of outputs) {
		if (seen.has(out)) throw new Usage(`two charts would both write ${out}: give them different names`);
		seen.add(out);
	}
	for (const [out, content] of outputs) writeFileSync(out, content);
	return outputs.map(([out]) => `wrote ${out}`).join("\n");
}

function git(root, args) {
	return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

// A chart is stale when a cited path differs from the synced commit in the checkout, committed or not, or holds a new untracked file.
export function stale(files, root) {
	const fresh = [];
	const refused = [];
	for (const file of files) {
		const chart = parseChart(readFileSync(file, "utf8"));
		if (!chart.synced) {
			refused.push(`${file} has no "%% synced: <commit>" line, so nothing says when it last matched the code`);
			continue;
		}
		if (!/^[0-9a-f]{7,40}$/.test(chart.synced)) {
			refused.push(`${file}: synced: names ${chart.synced}, which moves; name a commit hash`);
			continue;
		}
		try {
			git(root, ["rev-parse", "--verify", "--quiet", `${chart.synced}^{commit}`]);
		} catch {
			refused.push(`${file}: ${chart.synced} is not a commit in ${root}`);
			continue;
		}
		const cited = [...new Set(chart.cites.map(({ cite }) => cite.match(CITE)[1]))];
		const away = cited.filter((p) => isAbsolute(p) || outside(resolve(root, p), root));
		if (away.length) {
			refused.push(`${file}: cites paths outside ${root}: ${away.join(", ")}`);
			continue;
		}
		const linked = cited.filter((p) => existsSync(resolve(root, p)) && realpathSync(resolve(root, p)) !== resolve(root, p));
		if (linked.length) {
			refused.push(`${file}: cites paths through a link, which Git does not follow, so run check and cite the real paths: ${linked.join(", ")}`);
			continue;
		}
		// check refuses a citation through a link, so each cited path is the file or folder Git tracks.
		const changed = cited.length
			? [...new Set([...git(root, ["--literal-pathspecs", "diff", "--name-only", chart.synced, "--", ...cited]).split("\n"), ...git(root, ["--literal-pathspecs", "ls-files", "--others", "--exclude-standard", "--", ...cited]).split("\n")].filter(Boolean))]
			: [];
		if (changed.length) refused.push(`stale ${file}: changed since ${chart.synced}:\n${changed.map((p) => `  ${p}`).join("\n")}`);
		else fresh.push(`fresh ${file}: no cited path changed since ${chart.synced}`);
	}
	if (refused.length) throw new Refusal([...refused, ...fresh].join("\n"));
	return fresh.join("\n");
}

const FLAGS = { check: ["root"], render: ["root", "theme"], stale: ["root"] };

function flags(command, args) {
	const out = { _: [] };
	for (let i = 0; i < args.length; i++) {
		if (!args[i].startsWith("--")) out._.push(args[i]);
		else if (!FLAGS[command].includes(args[i].slice(2))) throw new Usage(`${command} takes no ${args[i]}; it takes ${FLAGS[command].map((f) => `--${f}`).join(" and ")}`);
		else if (i + 1 >= args.length) throw new Usage(`${args[i]} needs a value`);
		else out[args[i].slice(2)] = args[++i];
	}
	return out;
}

export async function main(argv) {
	const [command, ...rest] = argv;
	if (!Object.hasOwn(FLAGS, command ?? "")) throw new Usage("commands: check, render, stale");
	const f = flags(command, rest);
	if (f.root && !existsSync(f.root)) throw new Usage(`no folder at ${f.root}`);
	const root = f.root ? realpathSync(f.root) : defaultRoot();
	if (!f._.length) throw new Usage(`${command} takes one or more chart files`);
	for (const file of f._) if (!existsSync(file)) throw new Usage(`no chart at ${file}`);
	switch (command) {
		case "check":
			return check(f._, root, await loadPele());
		case "render":
			return render(f._, root, await loadPele(), f.theme ?? "clean");
		default:
			return stale(f._, root);
	}
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		console.log(await main(process.argv.slice(2)));
	} catch (err) {
		console.error(err.message);
		process.exit(err instanceof Usage ? 2 : err instanceof Refusal ? 1 : 3);
	}
}
