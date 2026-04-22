import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  parseStarterContentBundle,
  safeParseStarterContentBundle,
  type ItemContent,
  type NpcContent,
  type SceneContent,
  type StarterContentBundle
} from "./index";

function readJsonFile<T>(filename: string): T {
  const filePath = path.resolve(
    process.cwd(),
    "../../content/starter-town",
    filename
  );

  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function buildStarterTownBundle(): StarterContentBundle {
  return parseStarterContentBundle({
    packId: "starter-town",
    version: "0.1.0",
    scenes: readJsonFile<SceneContent[]>("scenes.json"),
    npcs: readJsonFile<NpcContent[]>("npcs.json"),
    items: readJsonFile<ItemContent[]>("items.json")
  });
}

test("accepts the starter-town content bundle", () => {
  const result = buildStarterTownBundle();

  assert.equal(result.packId, "starter-town");
  assert.equal(result.scenes.length, 4);
  assert.equal(result.npcs.length, 3);
  assert.equal(result.items.length, 3);
});

test("rejects bundles with unknown scene references", () => {
  const starterTownBundle = buildStarterTownBundle();
  starterTownBundle.npcs[0] = {
    ...starterTownBundle.npcs[0],
    startSceneId: "unknown-scene"
  };

  const result = safeParseStarterContentBundle(starterTownBundle);

  assert.equal(result.success, false);
  assert.match(JSON.stringify(result.error.issues), /unknown scene/);
});

test("rejects duplicate IDs within the same entity group", () => {
  const starterTownBundle = buildStarterTownBundle();
  starterTownBundle.items.push({
    ...starterTownBundle.items[0]
  });

  const result = safeParseStarterContentBundle(starterTownBundle);

  assert.equal(result.success, false);
  assert.match(JSON.stringify(result.error.issues), /Duplicate itemId/);
});
