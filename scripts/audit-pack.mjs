#!/usr/bin/env node
// Audits a Bedrock add-on (a folder with BP/ and RP/) for the mistakes that stop it loading or leave things invisible:
// bad JSON, manifest versions that disagree, missing pack icons, script imports that do not resolve, and resource
// references (textures, sounds, particles, models) that point at files that are not there. Works for any pack.
// Usage: node audit-pack.mjs <pack-folder>        Exit code 1 if there are problems.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function auditPack(root) {
  const problems = [];
  const bad = (msg) => problems.push(msg);
  const walk = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; }) : []);
  const rel = (p) => relative(root, p);
  const read = (p) => readFileSync(p, "utf8");
  const json = (p) => { try { return JSON.parse(read(p)); } catch (e) { bad(`${rel(p)}: not valid JSON (${e.message})`); return undefined; } };

  const BP = join(root, "BP"), RP = join(root, "RP");
  for (const f of walk(root).filter((p) => p.endsWith(".json") && !p.includes("node_modules") && !p.includes("/dist/") && !p.includes("/.git/"))) json(f);

  const bp = json(join(BP, "manifest.json")), rp = json(join(RP, "manifest.json"));
  if (!bp || !rp) return problems;
  const v = (a) => (a ?? []).join(".");
  for (const [name, m] of [["BP", bp], ["RP", rp]]) {
    for (const mod of m.modules ?? []) if (v(mod.version) !== v(m.header.version)) bad(`${name} module ${mod.type} version ${v(mod.version)} differs from the pack version ${v(m.header.version)}`);
    if (!existsSync(join(root, name, "pack_icon.png"))) bad(`${name}/pack_icon.png is missing`);
  }
  const uuids = [bp.header.uuid, rp.header.uuid, ...(bp.modules ?? []).map((x) => x.uuid), ...(rp.modules ?? []).map((x) => x.uuid)];
  if (new Set(uuids).size !== uuids.length) bad("two uuids in the manifests are the same");
  const dep = (bp.dependencies ?? []).find((d) => d.uuid === rp.header.uuid);
  if (!dep) bad("the BP does not depend on the RP uuid (the resources would not come with the scripts)");
  else if (v(dep.version) !== v(rp.header.version)) bad(`the BP depends on RP ${v(dep.version)} but the RP is ${v(rp.header.version)}`);
  if (v(bp.header.version) !== v(rp.header.version)) bad(`BP ${v(bp.header.version)} and RP ${v(rp.header.version)} versions differ`);

  // Scripts: entry exists and every relative import resolves.
  const entry = (bp.modules ?? []).find((m) => m.type === "script")?.entry;
  if (entry && !existsSync(join(BP, entry))) bad(`script entry ${entry} does not exist`);
  for (const f of walk(join(BP, "scripts")).filter((p) => p.endsWith(".js"))) {
    for (const m of read(f).matchAll(/(?:from\s+|import\s+)"(\.[^"]+)"/g)) if (!existsSync(resolve(dirname(f), m[1]))) bad(`${rel(f)} imports ${m[1]}, which does not exist`);
  }

  // Resources.
  const tex = (path) => ["png", "tga", "jpg"].some((e) => existsSync(join(RP, `${path}.${e}`)));
  for (const name of ["terrain_texture", "item_texture"]) {
    const j = existsSync(join(RP, "textures", `${name}.json`)) && json(join(RP, "textures", `${name}.json`));
    if (!j) continue;
    for (const [key, d] of Object.entries(j.texture_data ?? {})) for (const t of [].concat(d.textures ?? [])) if (typeof t === "string" && !tex(t)) bad(`${name}.json: ${key} points at ${t}, which does not exist`);
  }
  const snd = join(RP, "sounds", "sound_definitions.json");
  if (existsSync(snd)) for (const [id, d] of Object.entries(json(snd)?.sound_definitions ?? {})) for (const s of d.sounds ?? []) if (!existsSync(join(RP, `${s.name ?? s}.ogg`)) && !existsSync(join(RP, `${s.name ?? s}.fsb`))) bad(`sound ${id}: ${s.name ?? s} has no file`);
  for (const f of walk(join(RP, "particles")).filter((p) => p.endsWith(".json"))) {
    const t = json(f)?.particle_effect?.description?.basic_render_parameters?.texture;
    if (t && !tex(t)) bad(`${rel(f)}: texture ${t} does not exist`);
  }
  const geo = new Set();
  for (const f of walk(join(RP, "models")).filter((p) => p.endsWith(".json"))) for (const g of json(f)?.["minecraft:geometry"] ?? []) geo.add(g.description.identifier);
  for (const f of walk(join(BP, "blocks")).filter((p) => p.endsWith(".json"))) for (const m of read(f).matchAll(/"(geometry\.[A-Za-z0-9_.]+)"/g)) if (!geo.has(m[1])) bad(`${rel(f)}: geometry ${m[1]} is not defined in RP/models`);
  const langs = join(RP, "texts", "languages.json");
  if (existsSync(langs)) for (const l of json(langs) ?? []) if (!existsSync(join(RP, "texts", `${l}.lang`))) bad(`languages.json lists ${l} but texts/${l}.lang is missing`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(process.argv[2] ?? ".");
  const problems = auditPack(root);
  for (const p of problems) console.log(`PROBLEM: ${p}`);
  console.log(problems.length ? `${problems.length} problem(s)` : "0 problems");
  process.exit(problems.length ? 1 : 0);
}
