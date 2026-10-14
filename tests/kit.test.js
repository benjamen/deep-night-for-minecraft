import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { test } from "node:test";

// The vendored kit must match the version it says it is: change the kit in bedrock-kit, not here.
test("the vendored kit has not drifted from the version recorded in KIT_VERSION.json", () => {
  const dir = new URL("../BP/scripts/kit/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("KIT_VERSION.json", dir), "utf8"));
  for (const [file, sha] of Object.entries(manifest.files)) {
    assert.ok(existsSync(new URL(file, dir)), `${file} is missing`);
    assert.equal(createHash("sha1").update(readFileSync(new URL(file, dir))).digest("hex").slice(0, 12), sha, `${file} was edited in this pack`);
  }
  for (const f of readdirSync(dir)) if (f !== "KIT_VERSION.json") assert.ok(f in manifest.files, `${f} is not part of the kit`);
});

test("the pack manifests agree: the behaviour pack depends on the resource pack at the same version", () => {
  const bp = JSON.parse(readFileSync(new URL("../BP/manifest.json", import.meta.url), "utf8"));
  const rp = JSON.parse(readFileSync(new URL("../RP/manifest.json", import.meta.url), "utf8"));
  const dep = bp.dependencies.find((d) => d.uuid);
  assert.equal(dep.uuid, rp.header.uuid);
  assert.deepEqual(dep.version, rp.header.version);
  assert.deepEqual(bp.header.version, rp.header.version, "bump both manifests together");
});
