import { appraise } from "./stages/appraise.js";
import { act } from "./stages/act.js";
import { selectAction } from "./stages/action-selection.js";
import { perceive } from "./stages/perceive.js";
import {
  buildSchedulerBridgeMeta,
  deriveCognitionLiteStageFlags
} from "./scheduler-adapter.js";
import type { CognitionLiteRunInput, CognitionLiteRunResult } from "./types.js";

export function runCognitionLite(input: CognitionLiteRunInput): CognitionLiteRunResult {
  const stageFlags = deriveCognitionLiteStageFlags(input.plannedExecution);
  const perceiveResult = perceive(input.perceiveInput);
  let appraiseResult: CognitionLiteRunResult["appraise"];
  if (stageFlags.appraise) {
    if (!input.appraiseInput) {
      throw new Error("appraiseInput is required when appraise is enabled.");
    }

    appraiseResult = appraise({
      ...input.appraiseInput,
      perceivedItems: perceiveResult.perceivedItems
    });
  }

  let actionSelectionResult: CognitionLiteRunResult["actionSelectionResult"];
  if (stageFlags.action_selection) {
    if (!input.actionSelectionInput) {
      throw new Error("actionSelectionInput is required when action selection is enabled.");
    }

    actionSelectionResult = selectAction({
      ...input.actionSelectionInput,
      appraisalResults: appraiseResult?.appraisalResults ?? []
    });
  }

  let executionResult: CognitionLiteRunResult["executionResult"];
  if (stageFlags.act) {
    if (!input.actInput) {
      throw new Error("actInput is required when act is enabled.");
    }

    if (!actionSelectionResult) {
      throw new Error("action selection result is required before act.");
    }

    executionResult = act({
      ...input.actInput,
      selectionResult: actionSelectionResult
    });
  }

  return {
    npcId: input.npcId,
    stageFlags,
    schedulerBridge: input.plannedExecution
      ? buildSchedulerBridgeMeta(input.plannedExecution)
      : undefined,
    perceive: perceiveResult,
    appraise: appraiseResult,
    actionSelectionResult,
    executionResult
  };
}
