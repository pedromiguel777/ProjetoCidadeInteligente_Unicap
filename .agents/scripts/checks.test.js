#!/usr/bin/env node
"use strict";
// Guards the guards: packs-check.js and kit-drift.js must exit 1 on drift and 0
// when clean. Both are the only thing keeping a stale map or a silent kit
// overwrite from going unnoticed, so a refactor that turns them into
// always-pass has to break this test.
//
//   node --test .agents/scripts/checks.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const PACKS = path.join(__dirname, "packs-check.js");
const KIT = path.join(__dirname, "kit-drift.js");
const ALL = path.join(__dirname, "check-all.js");
const fm = (name) => `---\nname: ${name}\ndescription: fixture\n---\n\n# ${name}\n`;

function tmp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "checks-test-"));
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function run(script, args, cwd, env) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, encoding: "utf8", env: env || process.env });
  return { status: r.status, out: r.stdout + r.stderr };
}

// The usage errors are exit 2, not 1: a missing manifest, a missing library or
// a missing map is a broken invocation, never drift.
function noKitEnv() {
  const env = { ...process.env };
  delete env.AI_DEV_KIT_LIBRARY;
  return env;
}

// packs-check fixture: one pack with one member, one individual skill.
function packsRoot(dir) {
  write(path.join(dir, "threejs-packs.json"), JSON.stringify({
    source: "fixture",
    why: "fixture",
    repo: ".agents/skills/<name>/SKILL.md",
    counts: { source_skills: 2, account_packs: 1, packed_skills: 1, individual_skills: 1 },
    account: ["threejs-alpha-pack", "threejs-beta"],
    packs: { "threejs-alpha-pack": ["threejs-alpha"] },
    individual: ["threejs-beta"],
  }, null, 2));
  write(path.join(dir, ".agents/skills/threejs-alpha/SKILL.md"), fm("threejs-alpha"));
  write(path.join(dir, ".agents/skills/threejs-beta/SKILL.md"), fm("threejs-beta"));
  return dir;
}

// kit-drift fixture: a manifest, its installed skill and the matching library.
function kitRoot(dir) {
  const library = path.join(dir, "library");
  write(path.join(dir, ".ai-dev-kit.json"), JSON.stringify({
    tool: "codex",
    skillRoot: ".agents/skills",
    standards: false,
    skills: { alpha: { dir: "dur", companions: [] } },
  }, null, 2));
  write(path.join(library, "skills/dur/alpha.md"), fm("alpha"));
  write(path.join(dir, ".agents/skills/alpha/SKILL.md"), fm("alpha"));
  return { root: dir, library };
}

test("packs-check exits 0 when the map matches the repo", (t) => {
  const dir = tmp();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const r = run(PACKS, [], packsRoot(dir));
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /clean/);
});

test("packs-check exits 1 when a mapped skill is gone", (t) => {
  const dir = tmp();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  packsRoot(dir);
  fs.rmSync(path.join(dir, ".agents/skills/threejs-beta"), { recursive: true });
  const r = run(PACKS, [], dir);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /missing-in-repo: threejs-beta/);
});

test("packs-check exits 1 when a skill on disk is not in the map", (t) => {
  const dir = tmp();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  packsRoot(dir);
  write(path.join(dir, ".agents/skills/threejs-gamma/SKILL.md"), fm("threejs-gamma"));
  const r = run(PACKS, ["--json"], dir);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /missing-in-map/);
  assert.match(r.out, /"ok": false/);
});

test("packs-check exits 1 when the frontmatter name drifts from the folder", (t) => {
  const dir = tmp();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  packsRoot(dir);
  write(path.join(dir, ".agents/skills/threejs-beta/SKILL.md"), fm("outro-nome"));
  const r = run(PACKS, [], dir);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /name-mismatch/);
});

test("kit-drift exits 0 when installed files match the library", (t) => {
  const dir = tmp();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { root, library } = kitRoot(dir);
  const r = run(KIT, ["--root", root, "--library", library], root);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /1 in sync, 0 drifted/);
});

test("kit-drift exits 1 when a skill was edited locally", (t) => {
  const dir = tmp();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { root, library } = kitRoot(dir);
  fs.appendFileSync(path.join(root, ".agents/skills/alpha/SKILL.md"), "\nedit local\n");
  const r = run(KIT, ["--root", root, "--library", library], root);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /EDITED LOCALLY/);
});

test("kit-drift exits 1 when a skill is missing locally", (t) => {
  const dir = tmp();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { root, library } = kitRoot(dir);
  fs.rmSync(path.join(root, ".agents/skills/alpha/SKILL.md"));
  const r = run(KIT, ["--root", root, "--library", library, "--json"], root);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /"drift": 1/);
});

test("kit-drift exits 2 when the project has no manifest", (t) => {
  const dir = tmp();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const library = path.join(dir, "library");
  write(path.join(library, "skills/dur/alpha.md"), fm("alpha"));
  const r = run(KIT, ["--root", dir, "--library", library], dir);
  assert.equal(r.status, 2, r.out);
  assert.match(r.out, /no \.ai-dev-kit\.json/);
});

test("kit-drift exits 2 when no library is given", (t) => {
  const dir = tmp();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { root } = kitRoot(dir);
  const r = run(KIT, ["--root", root], root, noKitEnv());
  assert.equal(r.status, 2, r.out);
  assert.match(r.out, /pass --library/);
});

test("packs-check exits 2 when threejs-packs.json is missing", (t) => {
  const dir = tmp();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const r = run(PACKS, ["--root", dir], dir);
  assert.equal(r.status, 2, r.out);
  assert.match(r.out, /no threejs-packs\.json/);
});

test("check-all exits 2 when --root has no .agents/scripts", (t) => {
  const dir = tmp();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const r = run(ALL, ["--root", dir], dir);
  assert.equal(r.status, 2, r.out);
  assert.match(r.out, /not found \(wrong --root\?\)/);
});

test("kit-drift keeps exit 0 under --warn, with the drift still reported", (t) => {
  const dir = tmp();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const { root, library } = kitRoot(dir);
  fs.appendFileSync(path.join(root, ".agents/skills/alpha/SKILL.md"), "\nedit local\n");
  const r = run(KIT, ["--root", root, "--library", library, "--warn"], root);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /1 drifted/);
});
