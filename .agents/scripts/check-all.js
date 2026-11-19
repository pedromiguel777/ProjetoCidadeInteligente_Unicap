#!/usr/bin/env node
"use strict";
// One command for the repo's own checks, so they run as a routine instead of
// when someone remembers the three separate invocations.
//
//   node .agents/scripts/check-all.js
//   node .agents/scripts/check-all.js --library /tmp/kit
//   node .agents/scripts/check-all.js --quiet
//
// Runs, in order: checks.test.js (the guards themselves), packs-check.js (the
// threejs map), kit-drift.js (installed kit vs library). git hooks are not used
// on purpose: they live in the git common dir, shared by every worktree.
//
// kit-drift needs a library clone; without one (--library, AI_DEV_KIT_LIBRARY,
// or /tmp/kit) it is reported as SKIP and does not fail the run. SKIP is loud
// on purpose -- silence would be the check pretending to pass.
// Exit codes: 0 all run and passed, 1 a check failed, 2 bad usage.
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const argv = process.argv.slice(2);
const quiet = argv.includes("--quiet");
const flag = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const root = path.resolve(flag("--root") || ".");
const scripts = path.join(root, ".agents", "scripts");

function resolveLibrary() {
  const explicit = flag("--library") || process.env.AI_DEV_KIT_LIBRARY;
  if (explicit) return { dir: path.resolve(explicit), why: flag("--library") ? "--library" : "AI_DEV_KIT_LIBRARY" };
  const fallback = "/tmp/kit";
  if (fs.existsSync(path.join(fallback, "skills"))) return { dir: fallback, why: "/tmp/kit" };
  return null;
}

const results = [];
function step(name, args, opts = {}) {
  const started = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const ms = Date.now() - started;
  const out = (r.stdout || "") + (r.stderr || "");
  const ok = r.status === 0;
  results.push({ name, ok, ms, status: r.status, out });
  if (!quiet) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (${ms} ms)`);
    if (!ok) for (const line of out.trim().split("\n").slice(-12)) console.log(`      ${line}`);
  }
  return ok;
}
function skip(name, why) {
  results.push({ name, ok: null, why });
  if (!quiet) console.log(`SKIP  ${name}  (${why})`);
}

if (!fs.existsSync(scripts)) {
  console.error("check-all: " + scripts + " not found (wrong --root?)");
  process.exit(2);
}

step("checks.test.js", ["--test", path.join(scripts, "checks.test.js")]);
step("packs-check.js", [path.join(scripts, "packs-check.js"), "--root", root]);

const lib = resolveLibrary();
if (lib) step(`kit-drift.js (library ${lib.dir})`, [path.join(scripts, "kit-drift.js"), "--root", root, "--library", lib.dir]);
else skip("kit-drift.js", "no library clone: pass --library <clone>, set AI_DEV_KIT_LIBRARY, or clone to /tmp/kit");

const failed = results.filter((r) => r.ok === false).length;
const skipped = results.filter((r) => r.ok === null).length;
if (quiet) {
  for (const r of results) console.log(`${r.ok === null ? "SKIP" : r.ok ? "PASS" : "FAIL"}  ${r.name}`);
}
console.log(`\ncheck-all: ${results.length - failed - skipped} passed, ${failed} failed, ${skipped} skipped`);
process.exitCode = failed ? 1 : 0;
