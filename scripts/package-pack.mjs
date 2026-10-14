#!/usr/bin/env node
// Builds <pack>/dist/<name>-<version>.mcaddon (a zip of the BP and RP folders) after the audit passes. Double-clicking the
// file on a PC opens Minecraft and imports both packs. Usage: node package-pack.mjs <pack-folder> [--skip-audit]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { auditPack } from "./audit-pack.mjs";

const root = resolve(process.argv[2] ?? ".");
if (!process.argv.includes("--skip-audit")) {
  const problems = auditPack(root);
  if (problems.length) {
    for (const p of problems) console.log(`PROBLEM: ${p}`);
    console.log("not packaging: fix the problems above");
    process.exit(1);
  }
}
const manifest = JSON.parse(readFileSync(join(root, "BP", "manifest.json"), "utf8"));
const name = basename(root).replace(/-for-minecraft$/, "");
const version = manifest.header.version.join(".");
const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });
const out = join(dist, `${name}-${version}.mcaddon`);
if (existsSync(out)) rmSync(out);
execFileSync("zip", ["-qr", out, "BP", "RP", "-x", "*.DS_Store"], { cwd: root });
console.log(`wrote ${out}`);
