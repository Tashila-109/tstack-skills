import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { Refusal, check, loadPele, parseChart, render, stale, styled } from "./chart.mjs";

const PELE_ENTRY = process.env.PELE ?? join(homedir(), ".tstack", "cache", "pele-1.9.0", "node_modules", "pele", "dist", "pele.js");

class PeleError extends Error {
	name = "PeleError";
	constructor(message, line) {
		super(message);
		this.code = "syntax";
		this.line = line;
	}
}

const SCRIPT = fileURLToPath(new URL("./chart.mjs", import.meta.url));

// Draws one pele-edge group for each "-->" in the chart, as the real Pele draws one per arrow.
const fakePele = {
	parse(text) {
		if (text.includes("BROKEN")) throw new PeleError("unexpected token", 4);
	},
	render(text) {
		if (text.includes("EXPLODE")) throw new Error("renderer crashed");
		const edges = '<g class="pele-edge"/>'.repeat(text.split("-->").length - 1);
		return { svg: `<svg xmlns="http://www.w3.org/2000/svg" class="pele">${edges}<g/></svg>` };
	},
};

function cli(args, cwd) {
	try {
		return { status: 0, out: execFileSync("node", [SCRIPT, ...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) };
	} catch (err) {
		return { status: err.status, out: err.stderr };
	}
}

function scratch() {
	const dir = realpathSync(mkdtempSync(join(tmpdir(), "chart-test-")));
	execFileSync("git", ["init", "-q", "-b", "main", dir]);
	mkdirSync(join(dir, "src"));
	writeFileSync(join(dir, "src", "api.ts"), "one\ntwo\nthree\n");
	writeFileSync(join(dir, "src", "db.ts"), "one\n");
	execFileSync("git", ["-C", dir, "add", "."]);
	execFileSync("git", ["-C", dir, "-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init"]);
	return dir;
}

function chart(dir, name, text) {
	const file = join(dir, name);
	writeFileSync(file, text);
	return file;
}

const CODE = `%% chart: code
flowchart LR
  %% src: src/api.ts:2
  A[API] --> B[(DB)]
  %% new: a cache in front of the database
  A --> C[Cache]
  class C proposed
`;

test("parseChart takes the kind, the diagram type, and the citation above each statement", () => {
	const parsed = parseChart(CODE);
	assert.equal(parsed.kind, "code");
	assert.equal(parsed.type, "flowchart");
	assert.deepEqual(
		parsed.statements.map((s) => [s.line, s.cites, s.isNew]),
		[
			[4, ["src/api.ts:2"], false],
			[6, [], true],
		],
	);
});

test("parseChart drops a citation when another comment comes between it and its line", () => {
	const parsed = parseChart("%% chart: code\nflowchart LR\n  %% src: src/api.ts\n  %% the database\n  A --> B\n  %% src: src/api.ts\n  %% new: a cache\n  B --> C\n");
	assert.deepEqual(
		parsed.statements.map((s) => [s.text, s.cites, s.isNew]),
		[
			["A --> B", [], false],
			["B --> C", ["src/api.ts"], true],
		],
	);
});

test("parseChart skips grouping and styling lines, and a blank line drops a citation", () => {
	const parsed = parseChart(`%% chart: code
flowchart TB
  %% src: src/api.ts
  subgraph Backend
    A --> B
  end
  %% src: src/db.ts

  B --> C
  classDef proposed stroke-dasharray: 6 4
`);
	assert.deepEqual(
		parsed.statements.map((s) => [s.text, s.cites]),
		[
			["A --> B", []],
			["B --> C", []],
		],
	);
});

test("parseChart demands citations for boxes whose names look like keywords of another diagram type", () => {
	const parsed = parseChart("%% chart: code\nflowchart LR\n  Box --> Group\n  Note --> Loop\n  End[End]\n");
	assert.deepEqual(
		parsed.statements.map((s) => s.text),
		["Box --> Group", "Note --> Loop", "End[End]"],
	);
});

test("parseChart skips C4 layout calls, state note bodies, class members, and style classes in an ER chart", () => {
	const kept = (text) => parseChart(text).statements.map((s) => s.text);
	assert.deepEqual(kept('%% chart: code\nC4Context\n  Person(a, "A")\n  UpdateLayoutConfig($c4ShapeInRow="1")\n'), ['Person(a, "A")']);
	assert.deepEqual(kept("%% chart: code\nstateDiagram-v2\n  note right of Idle\n    waits for input\n  end note\n  Idle --> Busy\n"), ["Idle --> Busy"]);
	assert.deepEqual(kept("%% chart: code\nclassDiagram\n  Animal : +run()\n  Animal <|-- Dog\n"), ["Animal <|-- Dog"]);
	assert.deepEqual(kept("%% chart: code\nerDiagram\n  USER ||--o{ ORDER : places\n  class ORDER proposed\n"), ["USER ||--o{ ORDER : places"]);
});

test("parseChart checks each class inside a class diagram namespace", () => {
	const parsed = parseChart("%% chart: code\nclassDiagram\n  namespace Shop {\n    class Cart\n    class Order {\n      +id\n    }\n  }\n");
	assert.deepEqual(
		parsed.statements.map((s) => s.text),
		["class Cart", "class Order {"],
	);
});

test("parseChart cites an ER or class box once and skips its attribute lines", () => {
	const er = parseChart(`%% chart: code
erDiagram
  %% src: src/db.ts:1
  USER {
    string id
  }
  %% src: src/db.ts
  USER ||--o{ ORDER : places
`);
	assert.deepEqual(
		er.statements.map((s) => s.text),
		["USER {", "USER ||--o{ ORDER : places"],
	);
	const cls = parseChart(`%% chart: code
classDiagram
  %% src: src/api.ts
  class Api
`);
	assert.deepEqual(
		cls.statements.map((s) => s.text),
		["class Api"],
	);
});

test("parseChart treats a C4 boundary as grouping and checks the boxes inside it", () => {
	const parsed = parseChart(`%% chart: code
C4Container
  System_Boundary(b, "Shop") {
    %% src: src/api.ts
    Container(api, "API")
  }
`);
	assert.deepEqual(
		parsed.statements.map((s) => [s.text, s.cites]),
		[['Container(api, "API")', ["src/api.ts"]]],
	);
});

test("check passes a code chart whose every box and arrow is cited or new", () => {
	const dir = scratch();
	assert.match(check([chart(dir, "a.mmd", CODE)], dir, fakePele), /ok .*a\.mmd: code chart, 2 arrows, 1 citations, 1 new$/);
});

test("check counts the arrows Pele draws and says when a chart has more than 20", () => {
	const dir = scratch();
	const arrows = Array.from({ length: 21 }, (_, i) => `  N${i} --> N${i + 1}`).join("\n");
	assert.match(check([chart(dir, "big.mmd", `%% chart: design\nflowchart LR\n${arrows}\n`)], dir, fakePele), /21 arrows, 0 citations, 0 new; more than 20 arrows, so split it/);
});

test("check refuses a code chart with an uncited arrow, and names its line", () => {
	const dir = scratch();
	const file = chart(dir, "a.mmd", CODE.replace("  %% src: src/api.ts:2\n", ""));
	assert.throws(() => check([file], dir, fakePele), (err) => err instanceof Refusal && /line 3: "A\[API\] --> B\[\(DB\)\]" has no src: or new:/.test(err.message));
});

test("check lists a chart's problems in line order", () => {
	const dir = scratch();
	const file = chart(dir, "a.mmd", "%% chart: code\nflowchart LR\n  A --> B\n  %% src: src/gone.ts\n  B --> C\n  %% new:\n  C --> D\n");
	assert.throws(() => check([file], dir, fakePele), (err) => {
		const lines = err.message.split("\n").slice(1).map((l) => Number(l.match(/line (\d+)/)[1]));
		return lines.length === 3 && lines.join() === [...lines].sort((a, b) => a - b).join();
	});
});

test("check refuses citations that are missing, past the end of a file, or outside the root", () => {
	const dir = scratch();
	const file = chart(
		dir,
		"a.mmd",
		`%% chart: code
flowchart LR
  %% src: src/gone.ts
  A --> B
  %% src: src/api.ts:4
  B --> C
  %% src: ../elsewhere.ts
  C --> D
  %% src: src
  D --> E
`,
	);
	assert.throws(
		() => check([file], dir, fakePele),
		(err) =>
			/src\/gone\.ts does not exist/.test(err.message) &&
			/src\/api\.ts:4 is past the end of src\/api\.ts, which has 3 lines/.test(err.message) &&
			/\.\.\/elsewhere\.ts is outside/.test(err.message) &&
			!/src does not exist/.test(err.message),
	);
});

test("resolveCite refuses a link out of the root and a line in an empty file, and allows a folder named ..x", () => {
	const dir = scratch();
	symlinkSync("/etc/hosts", join(dir, "src", "out.ts"));
	writeFileSync(join(dir, "src", "empty.ts"), "");
	mkdirSync(join(dir, "..x"));
	writeFileSync(join(dir, "..x", "a.ts"), "one\n");
	const file = chart(dir, "a.mmd", "%% chart: code\nflowchart LR\n  %% src: src/out.ts\n  A --> B\n  %% src: src/empty.ts:1\n  B --> C\n  %% src: ..x/a.ts:1\n  C --> D\n");
	assert.throws(
		() => check([file], dir, fakePele),
		(err) =>
			/src\/out\.ts is a link to a path outside/.test(err.message) &&
			/src\/empty\.ts:1 is past the end of src\/empty\.ts, which has 0 lines/.test(err.message) &&
			!/\.\.x/.test(err.message),
	);
});

test("check passes a design chart without citations but still checks any it has", () => {
	const dir = scratch();
	const design = "%% chart: design\nflowchart LR\n  A --> B\n";
	assert.match(check([chart(dir, "d.mmd", design)], dir, fakePele), /design chart/);
	const cited = chart(dir, "e.mmd", "%% chart: design\nflowchart LR\n  %% src: src/nope.ts\n  A --> B\n");
	assert.throws(() => check([cited], dir, fakePele), /src\/nope\.ts does not exist/);
});

test("check refuses a chart with no kind line, an empty new: reason, or a Pele error", () => {
	const dir = scratch();
	assert.throws(() => check([chart(dir, "a.mmd", "flowchart LR\n  A --> B\n")], dir, fakePele), /no "%% chart: code" or "%% chart: design" line/);
	assert.throws(() => check([chart(dir, "b.mmd", "%% chart: code\nflowchart LR\n  %% new:\n  A --> B\n")], dir, fakePele), /line 3: new: needs a reason/);
	assert.throws(() => check([chart(dir, "c.mmd", "%% chart: design\nflowchart LR\n  A --> B\n  BROKEN\n")], dir, fakePele), /line 4: Pele cannot draw it, syntax error: unexpected token/);
});

test("render writes a themed SVG beside each chart, and writes nothing when a check fails", () => {
	const dir = scratch();
	const good = chart(dir, "good.mmd", CODE);
	assert.match(render([good], dir, fakePele, "blueprint"), /wrote .*good\.svg/);
	const svg = readFileSync(join(dir, "good.svg"), "utf8");
	assert.match(svg, /^<svg[^>]*><style><!\[CDATA\[\n\.pele \{/);
	assert.match(svg, /--pele-bg: #0f3a6b/);
	const bad = chart(dir, "bad.mmd", "flowchart LR\n  A --> B\n");
	assert.throws(() => render([good, bad], dir, fakePele), Refusal);
	assert.equal(existsSync(join(dir, "bad.svg")), false);
	assert.throws(() => render([good], dir, fakePele, "neon"), /--theme must be clean, blueprint, t3, or the path of a \.css file/);
});

test("render takes a theme file, refuses one that would break the SVG, and writes nothing when a later chart fails", () => {
	const dir = scratch();
	const good = chart(dir, "good.mmd", CODE);
	writeFileSync(join(dir, "mine.css"), ".pele { --pele-bg: #123456; }");
	render([good], dir, fakePele, join(dir, "mine.css"));
	assert.match(readFileSync(join(dir, "good.svg"), "utf8"), /#123456/);
	writeFileSync(join(dir, "bad.css"), "/* ]]> */");
	assert.throws(() => render([good], dir, fakePele, join(dir, "bad.css")), /contains \]\]>/);
	const first = chart(dir, "first.mmd", CODE);
	const crash = chart(dir, "crash.mmd", "%% chart: design\nflowchart LR\n  EXPLODE --> B\n");
	assert.throws(() => render([first, crash], dir, fakePele), /renderer crashed/);
	assert.equal(existsSync(join(dir, "first.svg")), false);
	mkdirSync(join(dir, "other"));
	const twin = chart(dir, "other/../good.mermaid", CODE);
	assert.throws(() => render([good, twin], dir, fakePele), /two charts would both write .*good\.svg/);
});

test("render with the t3 theme writes a page whose colors come from the T3 thread", () => {
	const dir = scratch();
	assert.match(render([chart(dir, "flow.mmd", CODE)], dir, fakePele, "t3"), /wrote .*flow\.html/);
	const page = readFileSync(join(dir, "flow.html"), "utf8");
	assert.match(page, /^<!doctype html>\n<html><head><meta charset="utf-8"><\/head><body><svg[^>]*><style>/);
	assert.match(page, /--pele-fg: var\(--foreground\)/);
	assert.match(page, /<\/svg><\/body><\/html>\n$/);
	assert.equal(existsSync(join(dir, "flow.svg")), false);
});

test("styled puts the theme first inside the svg element", () => {
	assert.equal(styled('<svg a="1"><g/></svg>', "x{}"), '<svg a="1"><style><![CDATA[\nx{}]]></style><g/></svg>');
});

test("stale names the cited files that changed since the synced commit", () => {
	const dir = scratch();
	const sha = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const file = chart(dir, "a.mmd", `%% synced: ${sha}\n${CODE}`);
	assert.match(stale([file], dir), /fresh .*a\.mmd: no cited path changed/);
	writeFileSync(join(dir, "src", "api.ts"), "changed\n");
	assert.throws(() => stale([file], dir), (err) => err instanceof Refusal && /stale .*a\.mmd: changed since/.test(err.message) && /src\/api\.ts/.test(err.message));
	assert.throws(() => stale([chart(dir, "b.mmd", CODE)], dir), /has no "%% synced: <commit>" line/);
	assert.throws(() => stale([chart(dir, "c.mmd", `%% synced: deadbeef\n${CODE}`)], dir), /deadbeef is not a commit/);
});

test("stale counts an untracked file in a cited folder, refuses a moving synced name, and reports every chart", () => {
	const dir = scratch();
	const sha = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const folder = chart(dir, "folder.mmd", `%% synced: ${sha}\n%% chart: code\nflowchart LR\n  %% src: src\n  A --> B\n`);
	assert.match(stale([folder], dir), /fresh/);
	writeFileSync(join(dir, "src", "new.ts"), "x\n");
	assert.throws(() => stale([folder], dir), /stale .*folder\.mmd[\s\S]*src\/new\.ts/);
	symlinkSync("api.ts", join(dir, "src", "link.ts"));
	execFileSync("git", ["-C", dir, "add", "."]);
	execFileSync("git", ["-C", dir, "-c", "commit.gpgsign=false", "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "link"]);
	const linkSha = execFileSync("git", ["-C", dir, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
	const linked = chart(dir, "linked.mmd", `%% synced: ${linkSha}\n%% chart: code\nflowchart LR\n  %% src: src/link.ts:1\n  A --> B\n`);
	assert.match(stale([linked], dir), /fresh/);
	writeFileSync(join(dir, "src", "api.ts"), "changed\n");
	assert.throws(() => stale([linked], dir), /stale .*linked\.mmd[\s\S]*src\/api\.ts/);
	execFileSync("git", ["-C", dir, "checkout", "-q", "--", "src/api.ts"]);
	assert.match(stale([linked], dir), /fresh/);
	rmSync(join(dir, "src", "api.ts"));
	assert.throws(() => stale([linked], dir), /stale .*linked\.mmd[\s\S]*src\/api\.ts/);
	assert.throws(() => stale([chart(dir, "head.mmd", `%% synced: HEAD\n${CODE}`)], dir), /names HEAD, which moves/);
	assert.throws(() => stale([chart(dir, "away.mmd", `%% synced: ${sha}\n%% chart: code\nflowchart LR\n  %% src: ../x.ts\n  A --> B\n`)], dir), /cites paths outside .*\.\.\/x\.ts/);
	assert.throws(
		() => stale([chart(dir, "none.mmd", CODE), chart(dir, "also.mmd", CODE)], dir),
		(err) => /none\.mmd has no/.test(err.message) && /also\.mmd has no/.test(err.message),
	);
});

test("the command line refuses unknown commands, unknown flags and a missing root with exit code 2", () => {
	const dir = scratch();
	const outsideGit = realpathSync(mkdtempSync(join(tmpdir(), "chart-nogit-")));
	assert.deepEqual(cli(["bogus"], outsideGit), { status: 2, out: "commands: check, render, stale\n" });
	const bad = cli(["render", "a.mmd", "--theem", "blueprint"], dir);
	assert.equal(bad.status, 2);
	assert.match(bad.out, /render takes no --theem/);
	const root = cli(["stale", "a.mmd", "--root", join(dir, "nope")], dir);
	assert.equal(root.status, 2);
	assert.match(root.out, /no folder at/);
	const nogit = cli(["stale", "a.mmd"], outsideGit);
	assert.equal(nogit.status, 2);
	assert.match(nogit.out, /not inside a Git checkout/);
});

// Bun ignores the skip option, so pick test.skip by hand when Pele is not cached.
(existsSync(PELE_ENTRY) ? test : test.skip)("the real Pele checks and draws every diagram type a chart uses", async () => {
	process.env.PELE ??= PELE_ENTRY;
	const pele = await loadPele();
	const dir = scratch();
	const files = [
		["flow.mmd", CODE],
		["seq.mmd", "%% chart: code\nsequenceDiagram\n  %% src: src/api.ts:1\n  participant A as API\n  %% src: src/api.ts:3\n  A->>B: save\n"],
		["er.mmd", "%% chart: code\nerDiagram\n  %% src: src/db.ts:1\n  USER {\n    string id\n  }\n  %% src: src/db.ts\n  USER ||--o{ ORDER : places\n"],
		["arch.mmd", "%% chart: design\narchitecture-beta\n  group api(cloud)[API]\n  service db(database)[DB] in api\n"],
		["state.mmd", "%% chart: design\nstateDiagram-v2\n  [*] --> Idle\n  Idle --> Busy: go\n"],
		["class.mmd", "%% chart: code\nclassDiagram\n  %% src: src/api.ts:1\n  class Api\n  Api : +save()\n  %% src: src/db.ts:1\n  Api --> Db\n"],
		["c4.mmd", '%% chart: code\nC4Context\n  %% src: src/api.ts:1\n  Person(a, "A")\n  %% src: src/db.ts:1\n  System(b, "B")\n  %% src: src/api.ts:2\n  Rel(a, b, "uses")\n  UpdateLayoutConfig($c4ShapeInRow="1")\n'],
	].map(([name, text]) => chart(dir, name, text));
	assert.match(check(files, dir, pele), /seq\.mmd: code chart, 1 arrows[\s\S]*class\.mmd: code chart, 1 arrows[\s\S]*c4\.mmd: code chart, 1 arrows/);
	assert.match(render(files, dir, pele), /state\.svg/);
	assert.match(readFileSync(join(dir, "flow.svg"), "utf8"), /class="pele-node[^"]*proposed"/);
	assert.throws(() => check([chart(dir, "bad.mmd", "%% chart: design\nflowchart LR\n  A -->\n")], dir, pele), /Pele cannot draw it/);
});
