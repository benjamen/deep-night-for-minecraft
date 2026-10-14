import assert from "node:assert/strict";
import { test } from "node:test";
import { auditPack } from "../scripts/audit-pack.mjs";

test("the pack audit finds no problems (manifests agree, icons exist, imports and resources resolve)", () => {
  assert.deepEqual(auditPack(new URL("..", import.meta.url).pathname), []);
});
