import type { WorldEventRecord } from "@ai-western-town/contracts";

import { clamp01, overlaps } from "../helpers";
import type { ActInput, ActionExecutionResult, StateMutation } from "../types";

function buildStateMutations(input: ActInput): StateMutation[] {
  const { selectionResult } = input;

  switch (selectionResult.actionType) {
    case "speak":
      return [
        {
          domain: "conversation",
          targetId: input.npcId,
          operation: "add",
          path: "lastSpokenActionId",
          value: selectionResult.chosenActionId
        }
      ];
    case "move":
      return selectionResult.targetLocationId
        ? [
            {
              domain: "npc_state",
              targetId: input.npcId,
              operation: "move",
              path: "location.targetLocationId",
              value: selectionResult.targetLocationId
            }
          ]
        : [];
    case "observe":
      return [
        {
          domain: "npc_state",
          targetId: input.npcId,
          operation: "set",
          path: "attention.lastObservedActionId",
          value: selectionResult.chosenActionId
        }
      ];
    case "interact":
    case "use_item":
      return selectionResult.targetObjectIds.map((objectId) => ({
        domain: "object_state" as const,
        targetId: objectId,
        operation: "add" as const,
        path: "interaction.lastActorId",
        value: input.npcId
      }));
    case "wait":
      return [
        {
          domain: "npc_state",
          targetId: input.npcId,
          operation: "set",
          path: "stance",
          value: "holding"
        }
      ];
    default:
      return [];
  }
}

function buildVisibleLine(input: ActInput, outcome: ActionExecutionResult["outcome"]): {
  narrationLine?: string;
  dialogueLine?: string;
} {
  const subject = input.npcId;
  const targets = input.selectionResult.targetActorIds.join(", ");

  if (input.selectionResult.actionType === "speak") {
    return {
      dialogueLine:
        outcome === "blocked"
          ? `${subject} tries to ${input.selectionResult.verb}, but the opening is gone.`
          : `${subject} ${input.selectionResult.verb}${targets ? ` toward ${targets}` : ""}.`
    };
  }

  return {
    narrationLine:
      outcome === "blocked"
        ? `${subject} cannot ${input.selectionResult.verb} right now.`
        : `${subject} ${input.selectionResult.verb}.`
  };
}

function buildEvent(input: ActInput, outcome: ActionExecutionResult["outcome"]): WorldEventRecord {
  return {
    eventId: `evt-${input.tick}-${input.selectionResult.chosenActionId}`,
    eventType: `npc_${input.selectionResult.actionType}`,
    worldTick: input.tick,
    originSceneId: input.sceneId,
    actorIds: [input.npcId],
    targetIds: [
      ...input.selectionResult.targetActorIds,
      ...input.selectionResult.targetObjectIds
    ],
    tags: [
      input.selectionResult.actionType,
      input.selectionResult.visibility,
      outcome,
      ...input.selectionResult.expectedEffectTags,
      ...input.selectionResult.styleTags
    ],
    heatLevel:
      input.selectionResult.riskScore >= 0.7
        ? "high"
        : input.selectionResult.visibility === "public"
          ? "ordinary"
          : "ordinary",
    summary: `${input.npcId} ${input.selectionResult.verb} (${outcome}).`
  };
}

export function act(input: ActInput): ActionExecutionResult {
  const actorMissing = input.selectionResult.targetActorIds.some(
    (actorId) => !input.availableActorIds.includes(actorId)
  );
  const objectMissing = input.selectionResult.targetObjectIds.some(
    (objectId) => !input.availableObjectIds.includes(objectId)
  );
  const locationMissing =
    input.selectionResult.targetLocationId &&
    input.reachableLocationIds &&
    !input.reachableLocationIds.includes(input.selectionResult.targetLocationId);
  const policyBlocked =
    overlaps(input.blockedActionTags ?? [], input.selectionResult.expectedEffectTags) ||
    overlaps(input.blockedActionTags ?? [], input.selectionResult.styleTags);

  let outcome: ActionExecutionResult["outcome"] = "success";
  const outcomeReasonTags: string[] = [];

  if (actorMissing || objectMissing || locationMissing || policyBlocked) {
    outcome = "blocked";
    if (actorMissing) {
      outcomeReasonTags.push("target_actor_missing");
    }
    if (objectMissing) {
      outcomeReasonTags.push("target_object_missing");
    }
    if (locationMissing) {
      outcomeReasonTags.push("target_location_unreachable");
    }
    if (policyBlocked) {
      outcomeReasonTags.push("policy_blocked");
    }
  } else if (
    input.selectionResult.riskScore >= 0.85 &&
    input.selectionResult.confidence < 0.45
  ) {
    outcome = "partial";
    outcomeReasonTags.push("high_risk_partial");
  } else if (input.selectionResult.confidence < 0.2) {
    outcome = "failed";
    outcomeReasonTags.push("low_confidence_failure");
  } else {
    outcomeReasonTags.push(
      input.selectionResult.executionMode === "hold" ? "held_position" : "executed_as_planned"
    );
  }

  const visibleLine = buildVisibleLine(input, outcome);
  const stateMutations =
    outcome === "success" || outcome === "partial" ? buildStateMutations(input) : [];
  const emittedEvents =
    outcome === "failed" && input.selectionResult.executionMode === "hold"
      ? []
      : [buildEvent(input, outcome)];

  return {
    executionId: `exec-${input.tick}-${input.selectionResult.chosenActionId}`,
    sourceActionId: input.selectionResult.chosenActionId,
    actorId: input.npcId,
    actionType: input.selectionResult.actionType,
    itemActionType: input.selectionResult.itemActionType,
    outcome,
    outcomeReasonTags,
    consumedTick: input.consumeTickByDefault ?? 1,
    stateMutations,
    emittedEvents,
    visibleOutcome: {
      ...visibleLine,
      gestureTags: [...input.selectionResult.styleTags],
      observerActorIds: [...(input.observerActorIds ?? input.selectionResult.targetActorIds)]
    },
    privateOutcome:
      input.selectionResult.visibility === "private" || input.selectionResult.executionMode === "hold"
        ? {
            concealedEffects: [...input.selectionResult.expectedEffectTags],
            hiddenEventIds: emittedEvents
              .filter((event) => event.heatLevel !== "ordinary")
              .map((event) => event.eventId)
          }
        : undefined,
    shouldReflect:
      outcome !== "success" ||
      input.selectionResult.riskScore >= 0.65 ||
      input.selectionResult.executionMode === "hold" ||
      overlaps(input.selectionResult.expectedEffectTags, ["maintain_cover", "reduce_exposure"]),
    executionSummary:
      outcome === "success"
        ? `${input.npcId} executed ${input.selectionResult.verb} successfully.`
        : `${input.npcId} attempted ${input.selectionResult.verb} with outcome ${outcome}.`
  };
}
