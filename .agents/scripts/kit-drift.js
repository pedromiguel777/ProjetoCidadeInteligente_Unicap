#!/usr/bin/env node
"use strict";
// Drift check between this project's installed kit files and the kit library.
// install-kit update copies SKILL.md and standards verbatim, with no record of
// local edits (only commands get a sha), so an edited file is overwritten
// silently. Run this before any `install-kit update`.
//
//   node .agents/scripts/kit-drift.js --library <ai-dev-kit clone>
//   node .agents/scripts/kit-drift.js --library <clone> --json
//   node .agents/scripts/kit-drift.js --library <clone> --warn
//
// --warn  always exit 0 (for hooks); the report is the point.
// Accepts lines in .agents/scripts/kit-drift.accept (globs, '#' comments) for
// divergences that are deliberate, e.g. standards trimmed on purpose.
// Exit codes: 0 in sync (or only accepted drift), 1 drift, 2 bad usage.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const sha = (p) => crypto.createHash("sha1").update(fs.readFileSync(p)).digest("hex");
const exists = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };

function globToRe(g) {
  const body = g.replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp("^" + body + "$");
}

function readAccept(root) {
  const file = path.join(root, ".agents", "scripts", "kit-drift.accept");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map(globToRe);
}

function walk(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) walk(abs, base, out);
    else if (e.isFile()) out.push(path.relative(base, abs).split(path.sep).join("/"));
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
  const root = path.resolve(flag("--root") || ".");
  const library = flag("--library") || process.env.AI_DEV_KIT_LIBRARY;
  const json = argv.includes("--json");
  const warn = argv.includes("--warn");

  const manifestFile = path.join(root, ".ai-dev-kit.json");
  if (!fs.existsSync(manifestFile)) {
    console.error("kit-drift: no .ai-dev-kit.json in " + root + " -- this project has no kit install");
    process.exit(2);
  }
  if (!library) {
    console.error("kit-drift: pass --library <ai-dev-kit clone> (or set AI_DEV_KIT_LIBRARY)");
    process.exit(2);
  }
  if (!fs.existsSync(path.join(library, "skills"))) {
    console.error("kit-drift: " + library + " does not look like the kit library (no skills/ folder)");
    process.exit(2);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const skillRoot = path.join(root, manifest.skillRoot || ".agents/skills");
  const pairs = [];

  for (const [name, rec] of Object.entries(manifest.skills || {})) {
    if (rec.dir === undefined) continue;
    pairs.push({
      label: `skill ${name}`,
      target: path.join(skillRoot, name, "SKILL.md"),
      source: path.join(library, "skills", rec.dir, name + ".md"),
    });
    for (const c of rec.companions || []) {
      pairs.push({
        label: `companion ${name}/${c}`,
        target: path.join(skillRoot, name, c),
        source: path.join(library, "skills", rec.dir, name + "." + c),
      });
    }
  }

  if (manifest.standards) {
    const libStandards = path.join(library, "coding-standards");
    for (const rel of walk(libStandards)) {
      pairs.push({
        label: `standard ${rel}`,
        target: path.join(root, "coding-standards", rel),
        source: path.join(libStandards, rel),
      });
    }
  }

  const accept = readAccept(root);
  const buckets = { edited: [], missing: [], unknown: [], accepted: [], ok: 0 };
  for (const p of pairs) {
    const rel = path.relative(root, p.target).split(path.sep).join("/");
    const hasTarget = exists(p.target);
    const hasSource = exists(p.source);
    if (!hasSource) { buckets.unknown.push({ rel, label: p.label, why: "not in this library version" }); continue; }
    const ok = hasTarget && sha(p.target) === sha(p.source);
    if (ok) { buckets.ok++; continue; }
    const entry = {
      rel, label: p.label,
      why: hasTarget ? "differs from the library" : "deleted locally; update recreates it",
    };
    if (accept.some((re) => re.test(rel))) {
      entry.why = hasTarget ? "differs, accepted as deliberate" : "removed, accepted as deliberate";
      buckets.accepted.push(entry);
    } else if (hasTarget) buckets.edited.push(entry);
    else buckets.missing.push(entry);
  }

  const drift = buckets.edited.length + buckets.missing.length;
  if (json) {
    console.log(JSON.stringify({
      library, inSync: buckets.ok, drift,
      edited: buckets.edited, missing: buckets.missing,
      accepted: buckets.accepted, unknown: buckets.unknown,
    }, null, 2));
  } else {
    const show = (title, list) => {
      if (!list.length) return;
      console.log(`\n${title} (${list.length})`);
      for (const e of list) console.log(`  ${e.rel}\n      ${e.why}`);
    };
    console.log(`kit-drift: ${buckets.ok} in sync, ${drift} drifted, ${buckets.accepted.length} accepted`);
    show("EDITED LOCALLY -- update will overwrite these", buckets.edited);
    show("MISSING LOCALLY -- update will recreate these", buckets.missing);
    show("NOT IN THIS LIBRARY VERSION", buckets.unknown);
    show("ACCEPTED (deliberate, listed in kit-drift.accept)", buckets.accepted);
    if (drift) console.log("\nStash or port these before running install-kit update.");
    else console.log("\nSafe to update.");
  }

  process.exitCode = drift && !warn ? 1 : 0;
}

if (require.main === module) main();
