import test from "node:test";
import assert from "node:assert/strict";

import type { WorldEventWindow } from "@ai-western-town/contracts";

import { act, deriveCognitionLiteStageFlags, runCognitionLite } from "./index";
import type { CognitionLiteRunInput } from "./types";

function buildEventWindow(tick: number): WorldEventWindow {
  return {
    tickRange: {
      from: tick,
      to: tick
    },
    events: []
  };
}

function buildBaseInput(): CognitionLiteRunInput {
  return {
    npcId: "npc-doctor",
    perceiveInput: {
      observableWorldSlice: {
        sceneId: "saloon",
        tick: 184,
        visibleActors: [
          {
            actorId: "npc-sheriff",
            displayName: "Sheriff",
            tags: ["authority"]
          }
        ],
        visibleActions: [],
        dialogueSnippets: [
          {
            snippetId: "dlg-1",
            speakerId: "player",
            targetActorIds: ["npc-doctor"],
            text: "Who got hurt last night?",
            tags: ["probe", "public"]
          }
        ],
        visibleClues: [],
        recentLocalEvents: [],
        playerAction: {
          actionId: "cmd-1",
          actionType: "speak",
          summary: "The player publicly asks about last night's injury.",
          targetActorIds: ["npc-doctor"],
          tags: ["public", "probe", "secret"]
        }
      },
      workingMemory: {
        items: [
          {
            wmId: "wm-1",
            kind: "concern",
            summary: "Hide the truth about last night's injury.",
            status: "active",
            priority: 0.95,
            relatedActorIds: ["player", "npc-sheriff"],
            relatedGoalIds: ["goal-hide-truth"],
            sourceObservationIds: [],
            sourceMemoryIds: [],
            tags: ["secret", "cover"]
          }
        ],
        activeConcernIds: ["wm-1"],
        capacity: 5,
        lastUpdatedAt: 183
      },
      socialContextSlice: {
        sceneId: "saloon",
        relationEdges: [
          {
            actorId: "player",
            trust: 0.2,
            fear: 0.1,
            suspicion: 0.8,
            usefulness: 0.4
          },
          {
            actorId: "npc-sheriff",
            trust: 0.3,
            fear: 0.6,
            suspicion: 0.7,
            usefulness: 0.8
          }
        ]
      },
      retrievedMemorySlice: {
        memoryItems: [
          {
            memoryId: "mem-1",
            kind: "player_model",
            summary: "player probes sensitive topics in public",
            importance: 0.8,
            relatedActorIds: ["player"],
            tags: ["probe", "public"]
          }
        ]
      },
      partitionAwareInput: {
        npcId: "npc-doctor",
        currentSceneId: "saloon",
        currentPartitionId: "bar",
        partitionSlice: {
          visibleActorIds: ["player", "npc-sheriff"],
          audibleActorIds: ["player", "npc-sheriff"]
        },
        recentEventWindow: buildEventWindow(184)
      }
    },
    appraiseInput: {
      identitySlice: {
        npcId: "npc-doctor",
        role: "doctor",
        publicPersona: "calm town doctor",
        hiddenSecrets: ["last night's injury"],
        longTermGoals: [
          {
            goalId: "goal-hide-truth",
            summary: "Hide the truth about last night's injury.",
            priority: 0.95,
            tags: ["secret", "cover"]
          }
        ],
        taboos: ["public_confession"],
        coreDrives: ["self_preservation"]
      },
      currentGoalState: {
        activeGoalIds: ["goal-hide-truth"],
        pendingGoalIds: [],
        blockedGoalIds: []
      },
      socialBeliefSlice: {
        relatedActors: [
          {
            actorId: "player",
            trust: 0.2,
            fear: 0.1,
            suspicion: 0.8,
            dependency: 0.1,
            usefulness: 0.4
          },
          {
            actorId: "npc-sheriff",
            trust: 0.3,
            fear: 0.7,
            suspicion: 0.6,
            dependency: 0.1,
            usefulness: 0.8
          }
        ]
      },
      retrievedBeliefSlice: {
        beliefs: [
          {
            memoryId: "belief-1",
            summary: "The player repeats public pressure when close to the truth.",
            kind: "player_model",
            importance: 0.8,
            tags: ["probe", "public"]
          }
        ]
      }
    },
    actionSelectionInput: {
      npcId: "npc-doctor",
      tick: 184,
      sceneId: "saloon",
      workingMemory: {
        items: [],
        activeConcernIds: ["wm-1"],
        capacity: 5,
        lastUpdatedAt: 183
      },
      affordances: {
        npcId: "npc-doctor",
        sceneId: "saloon",
        tick: 184,
        candidates: [
          {
            actionId: "act-deflect",
            actionType: "speak",
            verb: "deflects the question",
            targetActorIds: ["player"],
            visibility: "public",
            cost: 2,
            riskBase: 0.35,
            preconditions: [],
            tags: ["deflect", "cover", "discreet"]
          },
          {
            actionId: "act-watch",
            actionType: "observe",
            verb: "watches the room",
            visibility: "public",
            cost: 1,
            riskBase: 0.1,
            preconditions: [],
            tags: ["observe"]
          },
          {
            actionId: "act-wait",
            actionType: "wait",
            verb: "waits",
            visibility: "public",
            cost: 1,
            riskBase: 0.05,
            preconditions: [],
            tags: ["hold"]
          }
        ]
      },
      socialSlice: {
        presentActors: [
          {
            actorId: "player",
            trust: 0.2,
            fear: 0.1,
            suspicion: 0.8,
            authority: 0.2,
            leverage: 0.5
          },
          {
            actorId: "npc-sheriff",
            trust: 0.3,
            fear: 0.7,
            suspicion: 0.6,
            authority: 0.95,
            leverage: 0.8
          }
        ],
        audienceSize: 2,
        privacyLevel: "public"
      },
      policySlice: {
        forbiddenActionTags: ["public_confession"],
        preferredActionTags: ["deflect", "cover"],
        deceptionTolerance: 0.7,
        aggressionTolerance: 0.2,
        interruptionSensitivity: 0.8
      }
    },
    actInput: {
      npcId: "npc-doctor",
      tick: 184,
      sceneId: "saloon",
      availableActorIds: ["player", "npc-sheriff"],
      availableObjectIds: [],
      observerActorIds: ["player", "npc-sheriff"],
      consumeTickByDefault: 1
    }
  };
}

test("reactive scheduler plan injects action selection before act", () => {
  const input = buildBaseInput();
  input.plannedExecution = {
    npcId: "npc-doctor",
    executionClass: "reactive",
    runStages: ["perceive", "appraise", "act"],
    escalationReasonTags: ["foreground_reactive"]
  };

  const result = runCognitionLite(input);

  assert.equal(result.stageFlags.action_selection, true);
  assert.equal(result.schedulerBridge?.injectedStages.includes("action_selection"), true);
  assert.equal(result.actionSelectionResult?.actionType, "speak");
  assert.equal(result.executionResult?.outcome, "success");
  assert.equal(result.executionResult?.emittedEvents.length, 1);
});

test("light scheduler plan stops before action selection and act", () => {
  const input = buildBaseInput();
  input.plannedExecution = {
    npcId: "npc-doctor",
    executionClass: "light",
    runStages: ["prefetch", "perceive", "appraise", "update_working_memory"],
    escalationReasonTags: ["near_field_budget"]
  };
  delete input.actionSelectionInput;
  delete input.actInput;

  const result = runCognitionLite(input);

  assert.equal(result.stageFlags.act, false);
  assert.equal(result.actionSelectionResult, undefined);
  assert.equal(result.executionResult, undefined);
  const appraiseResult = result.appraise;
  assert.ok(appraiseResult);
  assert.equal(appraiseResult.appraisalResults.length > 0, true);
});

test("deriveCognitionLiteStageFlags defaults to full four-stage execution without scheduler input", () => {
  const flags = deriveCognitionLiteStageFlags();

  assert.deepEqual(flags, {
    perceive: true,
    appraise: true,
    action_selection: true,
    act: true
  });
});

test("perceive-only scheduler plan does not require appraise input", () => {
  const input = buildBaseInput() as {
    npcId: string;
    perceiveInput: CognitionLiteRunInput["perceiveInput"];
    plannedExecution?: CognitionLiteRunInput["plannedExecution"];
    appraiseInput?: CognitionLiteRunInput["appraiseInput"];
    actionSelectionInput?: CognitionLiteRunInput["actionSelectionInput"];
    actInput?: CognitionLiteRunInput["actInput"];
  };
  input.plannedExecution = {
    npcId: "npc-doctor",
    executionClass: "light",
    runStages: ["perceive"],
    escalationReasonTags: ["foreground_reactive"]
  };
  delete input.appraiseInput;
  delete input.actionSelectionInput;
  delete input.actInput;

  const result = runCognitionLite(input as CognitionLiteRunInput);

  assert.equal(result.stageFlags.appraise, false);
  assert.equal(result.appraise, undefined);
});

test("blocked act does not emit state mutations", () => {
  const result = act({
    npcId: "npc-doctor",
    tick: 184,
    sceneId: "saloon",
    selectionResult: {
      chosenActionId: "act-move",
      actionType: "move",
      verb: "backs away",
      targetActorIds: [],
      targetObjectIds: [],
      targetLocationId: "clinic",
      visibility: "public",
      executionMode: "immediate",
      styleTags: ["guarded"],
      expectedEffectTags: ["reduce_exposure"],
      riskScore: 0.4,
      goalAlignment: 0.6,
      confidence: 0.7,
      fallbackActionIds: [],
      selectionReason: "test"
    },
    availableActorIds: [],
    availableObjectIds: [],
    reachableLocationIds: []
  });

  assert.equal(result.outcome, "blocked");
  assert.deepEqual(result.stateMutations, []);
});
