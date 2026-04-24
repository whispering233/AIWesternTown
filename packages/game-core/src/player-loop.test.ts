import assert from "node:assert/strict";
import test from "node:test";

import { buildPlayerLoopFrame } from "./index.js";
import type { PlayerStepContext } from "./index.js";

function createStepContext(): PlayerStepContext {
  return {
    currentSceneId: "saloon",
    currentSceneDisplayName: "The Gilded Spur Saloon",
    currentSceneSummary:
      "A busy saloon where gossip, deals, and grudges mix under lamp smoke.",
    localSceneClusterId: "starter-town",
    visibleNpcIds: ["bartender", "doctor"],
    visibleObjects: [
      {
        objectId: "office_key",
        label: "Office Key",
        tags: ["inspect", "utility"]
      }
    ],
    visibleAnomalies: [
      {
        anomalyId: "saloon-rumor-current",
        summary: "Conversations keep reorganizing around a rumor current.",
        tags: ["social", "audio"]
      }
    ],
    availableSoftOpportunities: [],
    runMode: "free_explore"
  };
}

test("buildPlayerLoopFrame returns coarse observation, directional targets, and trimmed opportunities", () => {
  const frame = buildPlayerLoopFrame(createStepContext(), {
    actionClass: "investigate",
    actionType: "observe_doctor",
    targetNpcId: "doctor"
  });

  assert.equal(frame.coarseObservation.sceneId, "saloon");
  assert.match(frame.coarseObservation.headline, /notable irregularities/i);
  assert.ok(
    frame.coarseObservation.summaryLines.some((line) =>
      line.includes("Conversations keep reorganizing")
    )
  );
  assert.ok(
    frame.deepObservationTargets.some(
      (entry) => entry.targetType === "npc" && entry.targetId === "doctor"
    )
  );
  assert.ok(
    frame.deepObservationTargets.some(
      (entry) => entry.targetType === "object" && entry.targetId === "office_key"
    )
  );
  assert.ok(
    frame.observationFindings.some(
      (entry) => entry.targetType === "npc" && entry.detailLevel === "focused"
    )
  );
  assert.ok(frame.surfacedOpportunities.length >= 1);
  assert.ok(frame.surfacedOpportunities.length <= 3);
  assert.ok(
    frame.surfacedOpportunities.some(
      (entry) =>
        entry.opportunityType === "approach" &&
        entry.resolutionMode === "short_scene"
    )
  );
});
