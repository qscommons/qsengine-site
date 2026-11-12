// Turns the Markdown documentation in qsengine's docs/ folder into site pages.
//
//   docs/README.md          the contents: `## Group` headings and `- [Title](page.md): blurb` lines,
//                           in reading order. It drives the sidebar and the /docs index.
//   docs/<page>.md          one page each, written as plain GitHub Markdown (see docs/README.md).
//
// Each page becomes app/docs/<page>/page.mdx and the contents become app/docs-nav.json.
// Both are generated: edit docs/, never the output. Run with --watch to regenerate on every change,
// and add `-- <command>` to run a command (the dev server) alongside.
//
// QSENGINE_ROOT points at the qsengine checkout. The default, ../qsengine, is a clone of
// qscommons/qsengine next to this repository; the workflow checks the engine out into engine/.
// QSENGINE_REF is the engine branch or tag being built, used for links to files in that repository.

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const SITE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(SITE_DIR, process.env.QSENGINE_ROOT || "../qsengine");
const REF = process.env.QSENGINE_REF || "main";
const DOCS_DIR = path.join(ROOT, "docs");
const OUT_DIR = path.join(SITE_DIR, "app", "docs");
const NAV_FILE = path.join(SITE_DIR, "app", "docs-nav.json");
// Pages under app/docs/ that belong to the site itself and are never generated.
const KEEP = new Set(["layout.jsx", "page.jsx"]);

const fail = (file, msg) => {
  throw new Error(`${path.relative(ROOT, file)}: ${msg}`);
};

function readVersion() {
  const cargo = readFileSync(path.join(ROOT, "Cargo.toml"), "utf8");
  const v = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if (!v) throw new Error("could not read version from Cargo.toml");
  return v;
}

function readRepo() {
  const cargo = readFileSync(path.join(ROOT, "Cargo.toml"), "utf8");
  return cargo.match(/^repository\s*=\s*"([^"]+)"/m)?.[1] ?? "";
}

// `---` front matter with `key: value` lines. Values are strings, or true/false.
function frontMatter(src, file) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return [{}, src];
  const data = {};
  for (const line of m[1].split("\n")) {
    if (!line.trim()) continue;
    const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (!kv) fail(file, `front matter line not understood: ${line}`);
    let v = kv[2].trim();
    if (/^".*"$/.test(v)) v = JSON.parse(v);
    else if (v === "true" || v === "false") v = v === "true";
    data[kv[1]] = v;
  }
  return [data, src.slice(m[0].length)];
}

// docs/foo/bar.md -> /docs/foo/bar/ (and README.md -> /docs/).
function hrefOf(rel) {
  const p = rel.replace(/\\/g, "/").replace(/(^|\/)README\.md$/, "$1").replace(/\.md$/, "/");
  return `/docs/${p}`.replace(/\/+$/, "/");
}

// Links written for GitHub (relative .md files, files elsewhere in the repository) become site links.
function rewriteLink(target, fromRel, repo, file) {
  if (/^([a-z]+:|#|\/)/i.test(target)) return target;
  const [p, hash = ""] = target.split("#");
  const abs = path.posix.normalize(path.posix.join(path.posix.dirname(`docs/${fromRel}`), p));
  if (abs.startsWith("docs/") && abs.endsWith(".md")) {
    return hrefOf(abs.slice("docs/".length)) + (hash ? `#${hash}` : "");
  }
  if (abs.startsWith("..")) fail(file, `link leaves the repository: ${target}`);
  const kind = p.endsWith("/") ? "tree" : "blob";
  return `${repo}/${kind}/${REF}/${abs.replace(/\/$/, "")}${hash ? `#${hash}` : ""}`;
}

// Plain-Markdown text is not always valid MDX: `{`, `}` and a bare `<` mean code there.
// Escape them in prose, leaving inline code and inline maths alone.
function escapeProse(line) {
  return line
    .split(/(`+[^`]*?`+|\$[^$\n]+\$)/)
    .map((part, i) =>
      i % 2 ? part : part.replace(/[{}]/g, (c) => `\\${c}`).replace(/<(?![A-Za-z/])/g, "&lt;"),
    )
    .join("");
}

// ```output caption="..." bars="00:513 11:487"  ->  <Output ... />
// bars are label:value pairs; each bar is drawn against the sum of all values.
function outputBlock(meta, body, file) {
  const attrs = Object.fromEntries([...meta.matchAll(/(\w+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  let out = `<Output printed={${JSON.stringify(body)}}`;
  if (attrs.bars) {
    const pairs = attrs.bars.trim().split(/\s+/).map((b) => {
      const [label, value] = b.split(":");
      if (value === undefined || Number.isNaN(Number(value))) fail(file, `bad bar "${b}", expected label:value`);
      return [label, Number(value)];
    });
    const total = pairs.reduce((s, [, v]) => s + v, 0);
    out += ` rows={${JSON.stringify(pairs.map(([l, v]) => [l, v, total]))}}`;
  }
  if (attrs.caption) out += ` caption={${JSON.stringify(attrs.caption)}}`;
  return `${out} />`;
}

function toMdx(src, rel, ctx) {
  const file = path.join(DOCS_DIR, rel);
  const [meta, body] = frontMatter(src.replace(/\r\n/g, "\n"), file);
  const title = meta.title ?? body.match(/^# (.+)$/m)?.[1];
  if (!title) fail(file, "needs a `# Title` heading or a title in its front matter");

  const lines = body.replaceAll("{{version}}", ctx.version).replace(/<!--[\s\S]*?-->\n?/g, "").split("\n");
  const out = [`export const metadata = ${JSON.stringify({ title, ...(meta.description && { description: meta.description }) })};`, ""];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^(`{3,})\s*(\S*)\s*(.*)$/);
    if (fence) {
      const end = lines.findIndex((l, j) => j > i && l.startsWith(fence[1]) && !l.slice(fence[1].length).trim());
      if (end === -1) fail(file, `code block on line ${i + 1} is never closed`);
      const content = lines.slice(i + 1, end).join("\n");
      out.push(fence[2] === "output" ? outputBlock(fence[3], content, file) : lines.slice(i, end + 1).join("\n"));
      i = end;
      continue;
    }
    if (line.trim() === "$$") {
      const end = lines.findIndex((l, j) => j > i && l.trim() === "$$");
      if (end === -1) fail(file, `maths block on line ${i + 1} is never closed`);
      out.push(...lines.slice(i, end + 1));
      i = end;
      continue;
    }
    if (/^<[A-Za-z]/.test(line)) { // a line of HTML, such as an <a id> anchor, passes through
      out.push(line);
      continue;
    }
    const linked = line.replace(/(\]\()([^)\s]+)(\))/g, (_, a, t, b) => a + rewriteLink(t, rel, ctx.repo, file) + b);
    out.push(escapeProse(linked));
  }
  return { meta, mdx: out.join("\n") };
}

// README.md: `## Group` then `- [Title](page.md): blurb` lines.
function readContents(ctx, pages) {
  const file = path.join(DOCS_DIR, "README.md");
  const groups = [];
  for (const line of readFileSync(file, "utf8").replaceAll("{{version}}", ctx.version).split("\n")) {
    const g = line.match(/^## (.+)$/);
    if (g) groups.push({ group: g[1].trim(), items: [] });
    const it = line.match(/^- \[([^\]]+)\]\(([^)]+\.md)\)(?::\s*(.*))?$/);
    if (!it) continue;
    if (!groups.length) fail(file, `"${it[1]}" is listed before any ## group`);
    const rel = path.posix.normalize(it[2]);
    if (!pages.has(rel)) fail(file, `lists ${it[2]}, which does not exist`);
    groups.at(-1).items.push({
      href: hrefOf(rel),
      title: it[1],
      blurb: (it[3] ?? "").trim(),
    });
    pages.get(rel).listed = true;
  }
  for (const [rel, p] of pages) if (!p.listed) fail(file, `${rel} is not listed in the contents`);
  return groups;
}

function walk(dir, rel = "") {
  return readdirSync(dir).flatMap((name) => {
    const r = rel ? `${rel}/${name}` : name;
    if (statSync(path.join(dir, name)).isDirectory()) return walk(path.join(dir, name), r);
    return name.endsWith(".md") && r !== "README.md" ? [r] : [];
  });
}

function sync() {
  const ctx = { version: readVersion(), repo: readRepo() };
  const pages = new Map();
  for (const rel of walk(DOCS_DIR)) {
    const { meta, mdx } = toMdx(readFileSync(path.join(DOCS_DIR, rel), "utf8"), rel, ctx);
    pages.set(rel, { ...meta, mdx });
  }
  const nav = readContents(ctx, pages);

  for (const name of readdirSync(OUT_DIR)) {
    if (!KEEP.has(name)) rmSync(path.join(OUT_DIR, name), { recursive: true, force: true });
  }
  for (const [rel, { mdx }] of pages) {
    const dir = path.join(OUT_DIR, rel.replace(/\.md$/, ""));
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "page.mdx"), `{/* Generated from docs/${rel} by scripts/sync-docs.mjs. Edit that file instead. */}\n${mdx}`);
  }
  writeFileSync(NAV_FILE, `${JSON.stringify(nav, null, 2)}\n`);
  console.log(`docs: ${pages.size} pages from ${path.relative(process.cwd(), DOCS_DIR) || "."}`);
}

sync();

if (process.argv.includes("--watch")) {
  let timer;
  watch(DOCS_DIR, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try { sync(); } catch (e) { console.error(`docs: ${e.message}`); }
    }, 100);
  });
  console.log("docs: watching for changes");
}

// `sync-docs.mjs --watch -- next dev` runs the command alongside the watcher and stops with it.
const dash = process.argv.indexOf("--");
if (dash !== -1) {
  const child = spawn(process.argv.slice(dash + 1).join(" "), { stdio: "inherit", shell: true });
  child.on("exit", (code) => process.exit(code ?? 0));
}
