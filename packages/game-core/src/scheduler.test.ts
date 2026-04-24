import assert from "node:assert/strict";
import test from "node:test";

import type { WorldEventWindow } from "@ai-western-town/contracts";

import {
  advanceWorldSimulation,
  evaluatePlayerInterrupt,
  resolvePlayerActionPolicy
} from "./index.js";
import type { WorldSimulationInput } from "./index.js";

function createEmptyEventWindow(worldTick: number): WorldEventWindow {
  return {
    tickRange: {
      from: worldTick,
      to: worldTick
    },
    events: []
  };
}

function createBaseInput(): WorldSimulationInput {
  return {
    worldTick: 10,
    playerCommand: {
      commandId: "cmd-1",
      commandType: "observe",
      parsedAction: {
        actionId: "act-1",
        actionClass: "investigate",
        actionType: "eavesdrop",
        targetSceneId: "saloon"
      },
      issuedAtTick: 10,
      consumesTick: false
    },
    playerContext: {
      currentSceneId: "saloon",
      currentMode: "free_explore",
      visibleNpcIds: ["npc-doctor", "npc-sheriff"],
      statusTags: [],
      recentPlayerActionIds: []
    },
    sceneGraph: {
      currentSceneId: "saloon",
      adjacentSceneIds: ["hotel"],
      travelEdges: [
        {
          fromSceneId: "saloon",
          toSceneId: "hotel",
          distanceTier: "near"
        },
        {
          fromSceneId: "saloon",
          toSceneId: "stable",
          distanceTier: "far"
        }
      ]
    },
    npcScheduleStates: [
      {
        npcId: "npc-doctor",
        currentSceneId: "saloon",
        sceneTier: "foreground",
        scheduleHeat: 90,
        cognitiveHeat: "active",
        interruptSensitivity: 0.9,
        availability: "available"
      },
      {
        npcId: "npc-sheriff",
        currentSceneId: "saloon",
        sceneTier: "foreground",
        scheduleHeat: 70,
        cognitiveHeat: "background",
        interruptSensitivity: 0.7,
        availability: "available"
      },
      {
        npcId: "npc-innkeeper",
        currentSceneId: "hotel",
        sceneTier: "near_field",
        scheduleHeat: 60,
        cognitiveHeat: "background",
        interruptSensitivity: 0.5,
        availability: "available"
      },
      {
        npcId: "npc-stablehand",
        currentSceneId: "stable",
        sceneTier: "far_field",
        scheduleHeat: 10,
        cognitiveHeat: "cooling",
        interruptSensitivity: 0.2,
        availability: "available"
      }
    ],
    activeLongActions: [],
    recentEventWindow: createEmptyEventWindow(10),
    farFieldBacklog: []
  };
}

test("resolvePlayerActionPolicy distinguishes free move and windowed travel", () => {
  const freeTravel = resolvePlayerActionPolicy({
    actionClass: "travel",
    actionType: "walk",
    urgencyTag: "none"
  });
  const windowedTravel = resolvePlayerActionPolicy({
    actionClass: "travel",
    actionType: "follow",
    urgencyTag: "windowed"
  });
  const socialItem = resolvePlayerActionPolicy({
    actionClass: "item",
    actionType: "request_item",
    itemActionType: "request",
    itemResolutionMode: "social_request"
  });

  assert.equal(freeTravel.consumesTick, false);
  assert.equal(windowedTravel.worldTickReason, "windowed_travel");
  assert.equal(windowedTravel.consumesTick, true);
  assert.equal(socialItem.resultingRunMode, "focused_dialogue");
});

test("advanceWorldSimulation consumes a tick for investigation and emits structured flow", () => {
  const result = advanceWorldSimulation(createBaseInput());

  assert.equal(result.advancedToTick, 11);
  assert.equal(result.resolvedRunMode, "settle");
  assert.equal(result.appendedEvents.length, 1);
  assert.equal(result.appendedEvents[0]?.heatLevel, "high");
  assert.equal(result.executionPlan.playerActionExecution.worldTickReason, "investigation_cost");
  assert.deepEqual(
    result.eventFlow.map((entry) => entry.kind),
    ["command.received", "tick.advanced", "scheduler.decided", "tick.settled"]
  );
  assert.equal(result.scheduleDecisions.foregroundFullNpcIds.length, 2);
  assert.equal(result.scheduleDecisions.nearFieldLightNpcIds.length, 1);
  assert.match(
    result.debugSummary.budgetNotes.join(" "),
    /overridden by action policy/
  );
});

test("social intervention opens or advances a focused dialogue thread", () => {
  const input = createBaseInput();
  input.playerCommand = {
    commandId: "cmd-2",
    commandType: "social",
    parsedAction: {
      actionId: "act-2",
      actionClass: "intervene",
      actionType: "question_doctor",
      targetNpcId: "npc-doctor"
    },
    issuedAtTick: 10,
    consumesTick: true
  };

  const result = advanceWorldSimulation(input);

  assert.equal(
    result.executionPlan.playerActionExecution.resultingRunMode,
    "focused_dialogue"
  );
  assert.equal(result.statePatches.nextDialogueThread?.anchorNpcId, "npc-doctor");
  assert.equal(result.statePatches.nextDialogueThread?.status, "active");
});

test("travel uses the destination step context when building the player loop frame", () => {
  const input = createBaseInput();
  input.playerCommand = {
    commandId: "cmd-travel",
    commandType: "move",
    parsedAction: {
      actionId: "act-travel",
      actionClass: "travel",
      actionType: "walk_to_hotel",
      targetSceneId: "hotel",
      urgencyTag: "none"
    },
    issuedAtTick: 10,
    consumesTick: false
  };
  input.playerStepContext = {
    currentSceneId: "saloon",
    currentSceneDisplayName: "Saloon",
    currentSceneSummary: "The current room smells like whiskey and dust.",
    visibleNpcIds: ["npc-doctor", "npc-sheriff"],
    visibleObjects: [],
    visibleAnomalies: [],
    availableSoftOpportunities: [],
    runMode: "free_explore"
  };
  Object.assign(input, {
    nextPlayerStepContext: {
      currentSceneId: "hotel",
      currentSceneDisplayName: "Hotel",
      currentSceneSummary: "A quiet lobby with a clear view of the front desk.",
      visibleNpcIds: ["npc-innkeeper"],
      visibleObjects: [],
      visibleAnomalies: [],
      availableSoftOpportunities: [],
      runMode: "free_explore"
    }
  });

  const result = advanceWorldSimulation(input);

  assert.equal(result.advancedToTick, 10);
  assert.equal(result.playerLoopFrame.sceneArrivalView?.arrivalKind, "travel");
  assert.equal(result.playerLoopFrame.sceneArrivalView?.sceneId, "hotel");
  assert.equal(result.playerLoopFrame.coarseObservation.sceneId, "hotel");
  assert.deepEqual(result.playerLoopFrame.coarseObservation.visibleNpcIds, [
    "npc-innkeeper"
  ]);
});

test("interrupt events suspend the active dialogue and surface an interrupt payload", () => {
  const input = createBaseInput();
  input.playerContext.currentMode = "focused_dialogue";
  input.playerContext.focusedNpcId = "npc-doctor";
  input.activeDialogueThread = {
    threadId: "dlg-doctor",
    sceneId: "saloon",
    anchorNpcId: "npc-doctor",
    participantNpcIds: ["npc-doctor"],
    status: "active",
    startedAtTick: 9,
    lastAdvancedAtTick: 10
  };
  input.recentEventWindow = {
    tickRange: {
      from: 10,
      to: 10
    },
    events: [
      {
        eventId: "evt-gunshot",
        eventType: "gunshot",
        worldTick: 10,
        originSceneId: "saloon",
        actorIds: ["npc-outlaw"],
        targetIds: ["npc-doctor"],
        tags: ["violence", "public"],
        heatLevel: "interrupt",
        interruptType: "violence",
        summary: "A gunshot interrupts the room."
      }
    ]
  };

  const result = advanceWorldSimulation(input);

  assert.equal(result.scheduleDecisions.chosenInterruptEventId, "evt-gunshot");
  assert.equal(result.statePatches.nextPendingInterrupt?.eventId, "evt-gunshot");
  assert.equal(result.statePatches.nextDialogueThread?.status, "suspended");
  assert.equal(result.visibleUpdate.insertedInterrupt?.interruptId, "evt-gunshot");
  assert.deepEqual(
    result.eventFlow.map((entry) => entry.kind),
    [
      "command.received",
      "tick.advanced",
      "scheduler.decided",
      "interrupt.selected",
      "tick.settled"
    ]
  );
});

test("evaluatePlayerInterrupt promotes only one visible interrupt and defers the rest as soft opportunities", () => {
  const result = evaluatePlayerInterrupt({
    currentSceneId: "saloon",
    currentStepResolved: true,
    visibleEventCandidates: [
      {
        eventId: "evt-1",
        eventType: "doctor_departure",
        worldTick: 12,
        originSceneId: "saloon",
        actorIds: ["npc-doctor"],
        targetIds: [],
        tags: ["departure"],
        heatLevel: "interrupt",
        interruptType: "forced_state_change",
        summary: "The doctor is about to leave."
      },
      {
        eventId: "evt-2",
        eventType: "whisper",
        worldTick: 12,
        originSceneId: "saloon",
        actorIds: ["npc-patron"],
        targetIds: [],
        tags: ["social"],
        heatLevel: "ordinary",
        summary: "A patron starts whispering nearby."
      }
    ]
  });

  assert.equal(result.selectedInterrupt?.interruptId, "evt-1");
  assert.equal(result.selectedInterrupt?.interruptType, "critical_departure");
  assert.equal(result.deferredSoftOpportunities.length, 1);
  assert.equal(result.deferredSoftOpportunities[0]?.opportunityType, "approach");
});
