import assert from "node:assert/strict";
import test from "node:test";

import { starterTownContent } from "./index.js";

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

test("keeps player-facing starter town text in Chinese", () => {
  for (const scene of starterTownContent.scenes) {
    assertChineseText(scene.displayName, `scene ${scene.sceneId} displayName`);
    assertChineseText(scene.summary, `scene ${scene.sceneId} summary`);
  }

  for (const npc of starterTownContent.npcs) {
    assertChineseText(npc.displayName, `npc ${npc.npcId} displayName`);
    assertChineseText(npc.role, `npc ${npc.npcId} role`);
    assertChineseText(npc.publicPersona, `npc ${npc.npcId} publicPersona`);

    for (const drive of npc.coreDrives) {
      assertChineseText(drive, `npc ${npc.npcId} coreDrive`);
    }

    for (const goal of npc.shortTermGoals) {
      assertChineseText(goal, `npc ${npc.npcId} shortTermGoal`);
    }
  }

  for (const item of starterTownContent.items) {
    assertChineseText(item.displayName, `item ${item.itemId} displayName`);
  }
});

function assertChineseText(value: string, label: string): void {
  assert.match(value, /\p{Script=Han}/u, `${label} should contain Chinese text`);
}
