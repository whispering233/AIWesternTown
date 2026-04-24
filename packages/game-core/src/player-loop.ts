import { getTargetNpcId, getTargetSceneId } from "./policy.js";
import type {
  CoarseObservationPayload,
  GameCoreParsedPlayerAction,
  ObservationFinding,
  ObservationTargetEntry,
  PlayerLoopFrame,
  PlayerStepContext,
  SceneArrivalView,
  SurfacedOpportunity,
  VisibleAnomalySlice,
  VisibleObjectSlice
} from "./types.js";

type OpportunityBuilderInput = {
  stepContext: PlayerStepContext;
  findings: ObservationFinding[];
  deepObservationTargets: ObservationTargetEntry[];
};

const MAX_SURFACED_OPPORTUNITIES = 3;

function buildSceneArrivalView(
  stepContext: PlayerStepContext,
  action?: GameCoreParsedPlayerAction
): SceneArrivalView {
  const actionClass = action?.actionClass;
  const arrivalKind =
    actionClass === "travel"
      ? "travel"
      : actionClass === "reposition"
        ? "reposition"
        : actionClass === "free_explore"
          ? "return"
          : "initial";

  return {
    sceneId: stepContext.currentSceneId,
    sceneDisplayName: stepContext.currentSceneDisplayName,
    sceneSummary: stepContext.currentSceneSummary,
    arrivalKind
  };
}

function buildHeadline(stepContext: PlayerStepContext): string {
  if (stepContext.visibleAnomalies.length > 0) {
    return `${stepContext.visibleAnomalies.length} notable irregularities stand out in ${stepContext.currentSceneDisplayName ?? stepContext.currentSceneId}.`;
  }

  if (stepContext.visibleNpcIds.length > 0) {
    return `${stepContext.visibleNpcIds.length} visible figures anchor the scene in ${stepContext.currentSceneDisplayName ?? stepContext.currentSceneId}.`;
  }

  if (stepContext.visibleObjects.length > 0) {
    return `Several visible objects offer points of interest in ${stepContext.currentSceneDisplayName ?? stepContext.currentSceneId}.`;
  }

  return `The scene is readable, but nothing immediately presses for attention in ${stepContext.currentSceneDisplayName ?? stepContext.currentSceneId}.`;
}

export function buildCoarseObservation(
  stepContext: PlayerStepContext
): CoarseObservationPayload {
  const summaryLines: string[] = [];

  if (stepContext.currentSceneSummary) {
    summaryLines.push(stepContext.currentSceneSummary);
  }

  if (stepContext.visibleAnomalies.length > 0) {
    summaryLines.push(
      `Open anomalies: ${stepContext.visibleAnomalies
        .map((entry) => entry.summary)
        .join("; ")}.`
    );
  }

  if (stepContext.visibleNpcIds.length > 0) {
    summaryLines.push(`Visible NPCs: ${stepContext.visibleNpcIds.join(", ")}.`);
  }

  if (stepContext.visibleObjects.length > 0) {
    summaryLines.push(
      `Visible objects: ${stepContext.visibleObjects
        .map((entry) => entry.label ?? entry.objectId)
        .join(", ")}.`
    );
  }

  if (summaryLines.length === 0) {
    summaryLines.push("No additional coarse detail is currently exposed.");
  }

  return {
    sceneId: stepContext.currentSceneId,
    headline: buildHeadline(stepContext),
    summaryLines,
    visibleNpcIds: [...stepContext.visibleNpcIds],
    visibleObjectIds: stepContext.visibleObjects.map((entry) => entry.objectId),
    visibleAnomalyIds: stepContext.visibleAnomalies.map((entry) => entry.anomalyId)
  };
}

function createCoarseFindingFromAnomaly(
  anomaly: VisibleAnomalySlice
): ObservationFinding {
  return {
    findingId: `finding-anomaly-${anomaly.anomalyId}`,
    targetId: anomaly.anomalyId,
    targetType: "anomaly",
    summary: anomaly.summary,
    detailLevel: "coarse",
    tags: [...(anomaly.tags ?? [])]
  };
}

function buildFocusedFinding(
  targetId: string,
  targetType: ObservationFinding["targetType"],
  summary: string,
  tags: string[]
): ObservationFinding {
  return {
    findingId: `finding-focused-${targetType}-${targetId}`,
    targetId,
    targetType,
    summary,
    detailLevel: "focused",
    tags
  };
}

function findVisibleObject(
  stepContext: PlayerStepContext,
  objectId: string
): VisibleObjectSlice | undefined {
  return stepContext.visibleObjects.find((entry) => entry.objectId === objectId);
}

function buildFocusedFindings(
  stepContext: PlayerStepContext,
  action?: GameCoreParsedPlayerAction
): ObservationFinding[] {
  if (!action) {
    return [];
  }

  const findings: ObservationFinding[] = [];
  const targetNpcId = getTargetNpcId(action);
  const targetSceneId = getTargetSceneId(action);

  if (action.actionClass === "investigate") {
    if (targetNpcId) {
      findings.push(
        buildFocusedFinding(
          targetNpcId,
          "npc",
          `Focused observation tightens the read on ${targetNpcId}.`,
          ["investigate", "social"]
        )
      );
    }

    if (action.targetObjectId) {
      const targetObject = findVisibleObject(stepContext, action.targetObjectId);
      findings.push(
        buildFocusedFinding(
          action.targetObjectId,
          "object",
          `A closer inspection sharpens detail around ${targetObject?.label ?? action.targetObjectId}.`,
          ["investigate", "inspect", ...(targetObject?.tags ?? [])]
        )
      );
    }

    if (!targetNpcId && !action.targetObjectId && stepContext.visibleAnomalies.length > 0) {
      const anomaly = stepContext.visibleAnomalies[0];
      findings.push(
        buildFocusedFinding(
          anomaly.anomalyId,
          "anomaly",
          `You isolate the anomaly and narrow it into a concrete lead: ${anomaly.summary}.`,
          ["investigate", ...(anomaly.tags ?? [])]
        )
      );
    }
  }

  if (action.actionClass === "travel" && targetSceneId) {
    findings.push(
      buildFocusedFinding(
        targetSceneId,
        "anomaly",
        `Arrival at ${targetSceneId} opens a fresh local read on the scene.`,
        ["arrival"]
      )
    );
  }

  return findings;
}

export function buildObservationFindings(
  stepContext: PlayerStepContext,
  action?: GameCoreParsedPlayerAction
): ObservationFinding[] {
  return [
    ...stepContext.visibleAnomalies.map(createCoarseFindingFromAnomaly),
    ...buildFocusedFindings(stepContext, action)
  ];
}

function inferObservationMode(
  targetType: ObservationTargetEntry["targetType"],
  tags: string[]
): ObservationTargetEntry["observationMode"] {
  const tagSet = new Set(tags);

  if (targetType === "npc") {
    return tagSet.has("departure") ? "shadow" : "look";
  }

  if (targetType === "object") {
    return "inspect";
  }

  return tagSet.has("audio") || tagSet.has("social") ? "eavesdrop" : "look";
}

export function buildDeepObservationTargets(
  stepContext: PlayerStepContext,
  findings: ObservationFinding[]
): ObservationTargetEntry[] {
  const targets: ObservationTargetEntry[] = [];

  for (const anomaly of stepContext.visibleAnomalies) {
    const findingId = `finding-anomaly-${anomaly.anomalyId}`;
    const tags = anomaly.tags ?? [];
    targets.push({
      targetId: anomaly.anomalyId,
      targetType: "anomaly",
      label: anomaly.summary,
      reason: "A visible anomaly is open for deeper inspection.",
      observationMode: inferObservationMode("anomaly", tags),
      findingIds: findings
        .filter((entry) => entry.targetId === anomaly.anomalyId)
        .map((entry) => entry.findingId)
        .includes(findingId)
        ? [findingId]
        : []
    });
  }

  for (const npcId of stepContext.visibleNpcIds) {
    const npcFindings = findings.filter(
      (entry) => entry.targetType === "npc" && entry.targetId === npcId
    );
    targets.push({
      targetId: npcId,
      targetType: "npc",
      label: npcId,
      reason:
        npcFindings.length > 0
          ? "Recent focused observation makes this NPC actionable."
          : "Visible NPCs remain valid targets for a directional read.",
      observationMode: inferObservationMode(
        "npc",
        npcFindings.flatMap((entry) => entry.tags)
      ),
      findingIds: npcFindings.map((entry) => entry.findingId)
    });
  }

  for (const visibleObject of stepContext.visibleObjects) {
    targets.push({
      targetId: visibleObject.objectId,
      targetType: "object",
      label: visibleObject.label ?? visibleObject.objectId,
      reason: "A visible object can be checked for concrete traces.",
      observationMode: inferObservationMode("object", visibleObject.tags ?? []),
      findingIds: findings
        .filter(
          (entry) =>
            entry.targetType === "object" &&
            entry.targetId === visibleObject.objectId
        )
        .map((entry) => entry.findingId)
    });
  }

  return targets.slice(0, 5);
}

function buildOpportunityFromFinding(
  finding: ObservationFinding
): SurfacedOpportunity {
  const tagSet = new Set(finding.tags);

  let opportunityType: SurfacedOpportunity["opportunityType"] = "observe_more";
  let resolutionMode: SurfacedOpportunity["resolutionMode"] = "atomic";

  if (tagSet.has("departure")) {
    opportunityType = "follow";
  } else if (tagSet.has("callout")) {
    opportunityType = "interrupt";
    resolutionMode = "short_scene";
  } else if (tagSet.has("social")) {
    opportunityType = "approach";
    resolutionMode = finding.detailLevel === "focused" ? "short_scene" : "atomic";
  } else if (tagSet.has("inspect") || finding.targetType === "object") {
    opportunityType = "inspect";
  } else if (tagSet.has("audio")) {
    opportunityType = "eavesdrop";
  }

  return {
    opportunityId: `opportunity-${finding.findingId}`,
    opportunityType,
    leadText: finding.summary,
    sourceFindingIds: [finding.findingId],
    resolutionMode
  };
}

function scoreOpportunity(opportunity: SurfacedOpportunity): number {
  let score = 0;

  switch (opportunity.opportunityType) {
    case "interrupt":
      score += 50;
      break;
    case "follow":
      score += 45;
      break;
    case "approach":
      score += 40;
      break;
    case "inspect":
      score += 30;
      break;
    case "eavesdrop":
      score += 25;
      break;
    case "observe_more":
      score += 20;
      break;
    case "exit":
      score += 5;
      break;
    default:
      break;
  }

  if (opportunity.resolutionMode === "short_scene") {
    score += 10;
  }

  return score;
}

export function buildSurfacedOpportunities(
  input: OpportunityBuilderInput
): SurfacedOpportunity[] {
  const seeded = [
    ...input.stepContext.availableSoftOpportunities,
    ...input.findings.map(buildOpportunityFromFinding)
  ];
  const deduped = new Map<string, SurfacedOpportunity>();

  for (const opportunity of seeded) {
    if (!deduped.has(opportunity.opportunityId)) {
      deduped.set(opportunity.opportunityId, opportunity);
    }
  }

  if (deduped.size === 0 && input.deepObservationTargets.length > 0) {
    const fallbackTarget = input.deepObservationTargets[0];
    deduped.set(`opportunity-fallback-${fallbackTarget.targetId}`, {
      opportunityId: `opportunity-fallback-${fallbackTarget.targetId}`,
      opportunityType: "observe_more",
      leadText: `Continue observing ${fallbackTarget.label}.`,
      sourceFindingIds: [...fallbackTarget.findingIds],
      resolutionMode: "atomic"
    });
  }

  return [...deduped.values()]
    .sort((left, right) => scoreOpportunity(right) - scoreOpportunity(left))
    .slice(0, MAX_SURFACED_OPPORTUNITIES);
}

export function buildPlayerLoopFrame(
  stepContext: PlayerStepContext,
  action?: GameCoreParsedPlayerAction
): PlayerLoopFrame {
  const observationFindings = buildObservationFindings(stepContext, action);
  const deepObservationTargets = buildDeepObservationTargets(
    stepContext,
    observationFindings
  );

  return {
    sceneArrivalView: buildSceneArrivalView(stepContext, action),
    coarseObservation: buildCoarseObservation(stepContext),
    observationFindings,
    deepObservationTargets,
    surfacedOpportunities: buildSurfacedOpportunities({
      stepContext,
      findings: observationFindings,
      deepObservationTargets
    })
  };
}
