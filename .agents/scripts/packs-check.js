#!/usr/bin/env node
"use strict";
// Keeps threejs-packs.json honest: the map between the account's aggregated
// packs and the per-skill SKILL.md files in this repo. Without it the map
// ages silently whenever a skill is added, renamed or removed on either side.
//
//   node .agents/scripts/packs-check.js
//   node .agents/scripts/packs-check.js --json
//
// Checks: total vs declared counts, duplicate names, mapped skill missing from
// the repo, repo skill missing from the map, folder name vs frontmatter name,
// and the account block (packs + individual) against the map's own split.
// The account block is a recording, not a live query: refresh it from the
// skills tool whenever the account changes.
// Exit codes: 0 clean, 1 findings, 2 bad usage.
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv.includes("--root")
  ? process.argv[process.argv.indexOf("--root") + 1] : ".");
const json = process.argv.includes("--json");
const PREFIXES = ["threejs-", "nixie-", "webgpu-"];

function frontmatterName(file) {
  try {
    const head = fs.readFileSync(file, "utf8").split("\n").slice(0, 6).join("\n");
    const m = head.match(/^name:\s*(.+)$/m);
    return m ? m[1].trim() : null;
  } catch { return null; }
}

function main() {
  const mapFile = path.join(root, "threejs-packs.json");
  if (!fs.existsSync(mapFile)) {
    console.error("packs-check: no threejs-packs.json in " + root);
    process.exit(2);
  }
  const map = JSON.parse(fs.readFileSync(mapFile, "utf8"));
  const skillRoot = path.join(root, ".agents", "skills");
  const findings = [];
  const add = (check, msg) => findings.push({ check, msg });

  const packed = Object.values(map.packs || {}).flat();
  const individual = map.individual || [];
  const mapped = [...packed, ...individual];

  if (mapped.length !== map.counts.source_skills)
    add("count", `${mapped.length} skills mapped, counts.source_skills says ${map.counts.source_skills}`);

  const dupes = mapped.filter((s, i) => mapped.indexOf(s) !== i);
  if (dupes.length) add("duplicate", [...new Set(dupes)].join(", "));

  for (const s of mapped) {
    const file = path.join(skillRoot, s, "SKILL.md");
    if (!fs.existsSync(file)) { add("missing-in-repo", s); continue; }
    const declared = frontmatterName(file);
    if (declared !== s) add("name-mismatch", `${s}: frontmatter says ${declared ?? "(none)"}`);
  }

  const onDisk = fs.existsSync(skillRoot)
    ? fs.readdirSync(skillRoot, { withFileTypes: true })
        .filter((e) => e.isDirectory() && PREFIXES.some((p) => e.name.startsWith(p)))
        .map((e) => e.name)
    : [];
  for (const d of onDisk) if (!mapped.includes(d)) add("missing-in-map", d);

  const counts = map.counts || {};
  if (counts.account_packs !== Object.keys(map.packs || {}).length)
    add("count", `counts.account_packs says ${counts.account_packs}, map has ${Object.keys(map.packs || {}).length} packs`);
  if (counts.packed_skills !== packed.length)
    add("count", `counts.packed_skills says ${counts.packed_skills}, map packs ${packed.length}`);
  if (counts.individual_skills !== individual.length)
    add("count", `counts.individual_skills says ${counts.individual_skills}, map lists ${individual.length}`);

  const account = map.account || [];
  if (!account.length) add("account", "no account block recorded; the account side cannot be checked");
  else {
    const recordedPacks = account.filter((n) => n.endsWith("-pack")).sort();
    const recordedInd = account.filter((n) => !n.endsWith("-pack")).sort();
    const mapPacks = Object.keys(map.packs || {}).sort();
    if (JSON.stringify(recordedPacks) !== JSON.stringify(mapPacks))
      add("account", `account packs differ: ${recordedPacks.filter((p) => !mapPacks.includes(p)).join(", ") || "(none extra)"} recorded, ${mapPacks.filter((p) => !recordedPacks.includes(p)).join(", ") || "(none extra)"} mapped`);
    if (JSON.stringify(recordedInd) !== JSON.stringify([...individual].sort()))
      add("account", `account individual skills differ: recorded ${recordedInd.length}, mapped ${individual.length}`);
  }

  if (json) console.log(JSON.stringify({ ok: findings.length === 0, counts: { mapped: mapped.length, onDisk: onDisk.length, packs: Object.keys(map.packs || {}).length }, findings }, null, 2));
  else if (!findings.length) console.log(`packs-check: clean -- ${mapped.length} skills mapped, ${onDisk.length} on disk, ${Object.keys(map.packs || {}).length} packs, ${individual.length} individual`);
  else {
    console.log(`packs-check: ${findings.length} finding(s)`);
    for (const f of findings) console.log(`  ${f.check}: ${f.msg}`);
    console.log("\nUpdate threejs-packs.json (or the skills themselves) until this is clean.");
  }
  process.exitCode = findings.length ? 1 : 0;
}

if (require.main === module) main();
