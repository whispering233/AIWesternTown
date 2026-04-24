import type { PlannedNpcExecution } from "@ai-western-town/contracts";

import type {
  CognitionLiteInternalStage,
  CognitionLiteStageFlags,
  SchedulerBridgeMeta
} from "./types";

export function deriveCognitionLiteStageFlags(
  plannedExecution?: PlannedNpcExecution
): CognitionLiteStageFlags {
  if (!plannedExecution) {
    return {
      perceive: true,
      appraise: true,
      action_selection: true,
      act: true
    };
  }

  const schedulerStages = new Set(plannedExecution.runStages);
  const wantsAct = schedulerStages.has("act");

  return {
    perceive:
      schedulerStages.has("perceive") ||
      schedulerStages.has("appraise") ||
      schedulerStages.has("action_selection") ||
      wantsAct,
    appraise:
      schedulerStages.has("appraise") ||
      schedulerStages.has("action_selection") ||
      wantsAct,
    action_selection: schedulerStages.has("action_selection") || wantsAct,
    act: wantsAct
  };
}

export function buildSchedulerBridgeMeta(
  plannedExecution: PlannedNpcExecution
): SchedulerBridgeMeta {
  const flags = deriveCognitionLiteStageFlags(plannedExecution);
  const liteStages: CognitionLiteInternalStage[] = [
    "perceive",
    "appraise",
    "action_selection",
    "act"
  ];
  const internalStages = liteStages.filter((stage) => flags[stage]);
  const injectedStages: CognitionLiteInternalStage[] = [];
  const schedulerStages = new Set(plannedExecution.runStages);
  const notes: string[] = [];

  if (flags.action_selection && !schedulerStages.has("action_selection")) {
    injectedStages.push("action_selection");
    notes.push("Injected action_selection because scheduler requested act without it.");
  }

  if (flags.appraise && !schedulerStages.has("appraise")) {
    injectedStages.push("appraise");
    notes.push("Injected appraise because downstream lite stages depend on it.");
  }

  if (flags.perceive && !schedulerStages.has("perceive")) {
    injectedStages.push("perceive");
    notes.push("Injected perceive because downstream lite stages depend on it.");
  }

  return {
    schedulerStages: [...plannedExecution.runStages],
    internalStages,
    injectedStages,
    notes
  };
}
