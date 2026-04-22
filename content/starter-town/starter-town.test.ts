import assert from "node:assert/strict";
import test from "node:test";

import { starterTownContent } from "./index";

test("exports a validated starter town bundle", () => {
  assert.equal(starterTownContent.packId, "starter-town");
  assert.equal(starterTownContent.scenes.length, 4);
  assert.equal(starterTownContent.npcs.length, 3);
  assert.equal(starterTownContent.items.length, 3);
  assert.ok(
    starterTownContent.scenes.some((scene) =>
      scene.connections.some((connection) => connection.toSceneId === "sheriff_office")
    )
  );
});
