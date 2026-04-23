import assert from "node:assert/strict";
import test from "node:test";

import { starterTownContent } from "@ai-western-town/starter-town-content";
import { advanceWorldSimulation, resolvePlayerActionPolicy } from "@ai-western-town/game-core";
import type { WorldSimulationInput } from "@ai-western-town/game-core";

import {
  buildStarterTownPlayableSlice,
  buildStarterTownPlayerStepContext
} from "./starter-town-player-loop";

function createSimulationInput(
  currentSceneId: string,
  command: WorldSimulationInput["playerCommand"]
): WorldSimulationInput {
  const playableSlice = buildStarterTownPlayableSlice(starterTownContent, currentSceneId);

  return {
    worldTick: 0,
    playerCommand: command,
    playerContext: {
      currentSceneId,
      currentMode: "free_explore",
      visibleNpcIds: playableSlice.playerStepContext.visibleNpcIds,
      statusTags: [],
      recentPlayerActionIds: []
    },
    playerStepContext: playableSlice.playerStepContext,
    sceneGraph: playableSlice.sceneGraph,
    npcScheduleStates: starterTownContent.npcs.map((npc) => ({
      npcId: npc.npcId,
      currentSceneId: npc.startSceneId,
      sceneTier: npc.startSceneId === currentSceneId ? ("foreground" as const) : ("near_field" as const),
      scheduleHeat: npc.npcId === "doctor" ? 80 : 40,
      cognitiveHeat: npc.npcId === "doctor" ? ("active" as const) : ("background" as const),
      interruptSensitivity: 0.5,
      availability: "available" as const
    })),
    activeLongActions: [],
    recentEventWindow: {
      tickRange: { from: 0, to: 0 },
      events: []
    },
    farFieldBacklog: []
  };
}

test("starter town slice exposes movement edges and coarse observation on arrival", () => {
  const saloonSlice = buildStarterTownPlayableSlice(starterTownContent, "saloon");

  assert.ok(saloonSlice.sceneGraph.adjacentSceneIds.includes("hotel_lobby"));
  assert.ok(saloonSlice.playerStepContext.visibleNpcIds.includes("bartender"));
  assert.ok(saloonSlice.playerLoopFrame.coarseObservation.summaryLines.length >= 2);
  assert.ok(saloonSlice.playerLoopFrame.deepObservationTargets.length >= 1);

  const travelPolicy = resolvePlayerActionPolicy({
    actionClass: "travel",
    actionType: "walk_to_hotel",
    targetSceneId: "hotel_lobby",
    urgencyTag: "none"
  });

  assert.equal(travelPolicy.consumesTick, false);
});

test("starter town hotel lobby supports directional observation and surfaced opportunities", () => {
  const stepContext = buildStarterTownPlayerStepContext(
    starterTownContent,
    "hotel_lobby"
  );

  assert.ok(stepContext.visibleNpcIds.includes("doctor"));
  assert.ok(stepContext.visibleAnomalies.length >= 1);

  const result = advanceWorldSimulation(
    createSimulationInput("hotel_lobby", {
      commandId: "cmd-investigate-doctor",
      commandType: "observe",
      parsedAction: {
        actionId: "act-investigate-doctor",
        actionClass: "investigate",
        actionType: "observe_doctor",
        targetNpcId: "doctor"
      },
      issuedAtTick: 0,
      consumesTick: false
    })
  );

  assert.equal(result.advancedToTick, 1);
  assert.ok(
    result.playerLoopFrame.observationFindings.some(
      (entry) => entry.targetId === "doctor" && entry.detailLevel === "focused"
    )
  );
  assert.ok(
    result.playerLoopFrame.deepObservationTargets.some(
      (entry) => entry.targetType === "npc" && entry.targetId === "doctor"
    )
  );
  assert.ok(
    result.playerLoopFrame.surfacedOpportunities.some(
      (entry) =>
        entry.opportunityType === "approach" ||
        entry.opportunityType === "observe_more"
    )
  );
});
