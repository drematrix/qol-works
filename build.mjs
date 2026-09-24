// QOL Works — static build.
// Renders src/index.html (a template) with the copy in content/*.json and writes dist/.
// No dependencies: run with `node build.mjs`. Vercel runs this on every push.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, "dist");

// ---------- content ----------
function loadContent() {
  const dir = path.join(ROOT, "content");
  const content = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    try { content[f.replace(/\.json$/, "")] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); }
    catch (e) { throw new Error(`content/${f} is not valid JSON: ${e.message}`); }
  }
  return content;
}

// ---------- tiny template engine ----------
//  {{path}}            text (escaped; a line break in the copy becomes <br>)
//  {{attr path}}       attribute value (escaped, no <br>)
//  {{json path}}       JSON, for data read by the page's script
//  {{count path}}      number of items in a list, two digits ("04")
//  {{#each path}}…{{/each}}   repeat for every item; inside: {{.}} {{field}} {{@num}} {{@index}}
//  {{?first a|b}}      "a" on the first item of the innermost loop, otherwise "b" (text after "?first " is used verbatim)
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escText = (s) => esc(s).replace(/\r?\n/g, "<br>");
const escAttr = (s) => esc(s).replace(/"/g, "&quot;").replace(/\r?\n/g, " ");

function lookup(p, stack) {
  if (p === ".") return stack[stack.length - 1].item;
  const parts = p.split(".");
  for (let i = stack.length - 1; i >= 0; i--) {
    let v = stack[i].item;
    if (v === null || typeof v !== "object" || !(parts[0] in v)) continue;
    for (const k of parts) {
      if (v === null || v === undefined) break;
      v = v[k];
    }
    if (v !== undefined && v !== null) return v;
  }
  throw new Error(`Missing copy: "${p}". Check the content files — a field or list item may have been deleted.`);
}

function findClose(tpl, from) {
  const re = /\{\{(#each\s+[^}]+|\/each)\}\}/g;
  re.lastIndex = from;
  let depth = 1, m;
  while ((m = re.exec(tpl))) {
    depth += m[1].startsWith("#each") ? 1 : -1;
    if (depth === 0) return m;
  }
  throw new Error("Template error: {{#each}} without {{/each}}");
}

function render(tpl, stack) {
  let out = "", i = 0;
  const open = /\{\{#each\s+([^}\s]+)\s*\}\}/g;
  while (true) {
    open.lastIndex = i;
    const m = open.exec(tpl);
    if (!m) { out += renderTags(tpl.slice(i), stack); break; }
    out += renderTags(tpl.slice(i, m.index), stack);
    const close = findClose(tpl, open.lastIndex);
    const inner = tpl.slice(open.lastIndex, close.index);
    const list = lookup(m[1], stack);
    if (!Array.isArray(list)) throw new Error(`"${m[1]}" should be a list`);
    list.forEach((item, idx) => {
      out += render(inner, [...stack, { item, idx }]);
    });
    i = close.index + close[0].length;
  }
  return out;
}

function renderTags(s, stack) {
  return s.replace(/\{\{(\?first\s+[^}]*|[a-z]+\s+[^}\s]+|[^}\s]+)\}\}/g, (all, expr) => {
    const top = stack[stack.length - 1];
    if (expr.startsWith("?first")) {
      const [a, b = ""] = expr.slice("?first ".length).split("|");
      return top.idx === 0 ? a : b;
    }
    if (expr === "@num") return String(top.idx + 1).padStart(2, "0");
    if (expr === "@index") return String(top.idx);
    const sp = expr.indexOf(" ");
    if (sp > 0) {
      const fn = expr.slice(0, sp), p = expr.slice(sp + 1);
      const v = lookup(p, stack);
      if (fn === "attr") return escAttr(v);
      if (fn === "json") return JSON.stringify(v).replace(/</g, "\\u003c");
      if (fn === "count") return String(v.length).padStart(2, "0");
      throw new Error(`Unknown template helper "${fn}"`);
    }
    return escText(lookup(expr, stack));
  });
}

export function build({ write = true } = {}) {
  const content = loadContent();
  const tpl = fs.readFileSync(path.join(ROOT, "src", "index.html"), "utf8");
  const html = render(tpl, [{ item: content, idx: 0 }]);
  const left = html.match(/\{\{[^}]*\}\}/);
  if (left) throw new Error(`Unrendered template tag: ${left[0]}`);
  if (write) {
    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "index.html"), html);
    for (const d of ["assets", "admin"]) fs.cpSync(path.join(ROOT, d), path.join(OUT, d), { recursive: true });
  }
  return html;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    const html = build();
    console.log(`Built dist/index.html (${(html.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.error("\nBUILD FAILED: " + e.message + "\n");
    process.exit(1);
  }
}
