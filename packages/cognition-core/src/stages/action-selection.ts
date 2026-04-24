import { clamp01, maxOrZero, overlaps, uniqueStrings } from "../helpers.js";
import type {
  ActionCandidate,
  ActionSelectionInput,
  ActionSelectionResult,
  AppraisalResult,
  NpcActionType
} from "../types.js";

function getDominantAppraisal(appraisals: AppraisalResult[]): AppraisalResult | undefined {
  return [...appraisals].sort((left, right) => {
    const leftWeight = Math.max(
      left.relevance,
      left.threat,
      left.opportunity,
      left.socialRisk,
      left.anomaly
    );
    const rightWeight = Math.max(
      right.relevance,
      right.threat,
      right.opportunity,
      right.socialRisk,
      right.anomaly
    );

    return rightWeight - leftWeight;
  })[0];
}

function isCandidateViable(
  candidate: ActionCandidate,
  input: ActionSelectionInput
): boolean {
  if ((candidate.blockedBy?.length ?? 0) > 0) {
    return false;
  }

  if (overlaps(candidate.tags, input.policySlice.forbiddenActionTags)) {
    return false;
  }

  if ((candidate.targetActorIds?.length ?? 0) > 0) {
    const presentActors = new Set(input.socialSlice.presentActors.map((actor) => actor.actorId));
    const anyPresent = candidate.targetActorIds?.some((actorId) => presentActors.has(actorId));
    if (!anyPresent) {
      return false;
    }
  }

  return true;
}

function scoreGoalAlignment(
  candidate: ActionCandidate,
  focus: AppraisalResult | undefined,
  privacyLevel: ActionSelectionInput["socialSlice"]["privacyLevel"]
): number {
  if (!focus) {
    return candidate.actionType === "wait" || candidate.actionType === "observe" ? 0.55 : 0.3;
  }

  let score = 0.2;

  if (candidate.actionType === "observe" && focus.certainty < 0.6) {
    score += 0.4;
  }

  if (candidate.actionType === "speak" && (focus.socialRisk >= 0.5 || focus.threat >= 0.5)) {
    score += 0.35;
  }

  if (
    candidate.actionType === "speak" &&
    overlaps(candidate.tags, ["deflect", "cover"]) &&
    (focus.socialRisk >= 0.6 || focus.threat >= 0.6)
  ) {
    score += 0.3;
  }

  if (candidate.actionType === "move" && focus.threat >= 0.7) {
    score += 0.25;
  }

  if ((candidate.actionType === "interact" || candidate.actionType === "use_item") && focus.opportunity >= 0.6) {
    score += 0.25;
  }

  if (candidate.actionType === "wait" && focus.certainty < 0.45) {
    score += 0.2;
  }

  if (overlaps(candidate.tags, focus.inferredIntentTags)) {
    score += 0.2;
  }

  if (privacyLevel === candidate.visibility) {
    score += 0.1;
  }

  return clamp01(score);
}

function scoreSocialFit(
  candidate: ActionCandidate,
  input: ActionSelectionInput,
  focus: AppraisalResult | undefined
): number {
  const audiencePressure = clamp01(input.socialSlice.audienceSize / 4);
  const presentAuthority = maxOrZero(
    input.socialSlice.presentActors.map((actor) => actor.authority)
  );

  if (candidate.actionType === "observe" || candidate.actionType === "wait") {
    return clamp01(0.75 + (focus?.certainty ?? 0) * 0.1);
  }

  let score = candidate.visibility === input.socialSlice.privacyLevel ? 0.7 : 0.4;
  if (candidate.visibility === "public" && input.socialSlice.privacyLevel === "public") {
    score += 0.15;
  }
  if (candidate.visibility === "private" && audiencePressure > 0.5) {
    score -= 0.2;
  }
  if (candidate.actionType === "speak" && presentAuthority > 0.6 && (focus?.threat ?? 0) > 0.5) {
    score += 0.1;
  }

  return clamp01(score);
}

function buildFallbackSelection(
  input: ActionSelectionInput,
  reason: string
): ActionSelectionResult {
  return {
    chosenActionId: `synthetic-wait-${input.tick}`,
    actionType: "wait",
    verb: "wait",
    targetActorIds: [],
    targetObjectIds: [],
    visibility: input.socialSlice.privacyLevel,
    executionMode: "hold",
    styleTags: ["guarded"],
    expectedEffectTags: ["hold_position"],
    riskScore: 0.05,
    goalAlignment: 0.3,
    confidence: 0.6,
    fallbackActionIds: [],
    selectionReason: reason
  };
}

function deriveExpectedEffects(
  actionType: NpcActionType,
  focus: AppraisalResult | undefined
): string[] {
  if (actionType === "observe") {
    return ["gather_information"];
  }

  if (actionType === "move") {
    return focus && focus.threat >= 0.7
      ? ["reduce_exposure", "reposition"]
      : ["reposition"];
  }

  if (actionType === "speak") {
    return focus && focus.threat >= focus.opportunity
      ? ["deflect_attention", "maintain_cover"]
      : ["open_dialogue"];
  }

  if (actionType === "wait") {
    return ["hold_position"];
  }

  if (actionType === "use_item" || actionType === "interact") {
    return ["change_object_state"];
  }

  return ["advance_goal"];
}

export function selectAction(input: ActionSelectionInput): ActionSelectionResult {
  const focus = getDominantAppraisal(input.appraisalResults);
  const viableCandidates = input.affordances.candidates.filter((candidate) =>
    isCandidateViable(candidate, input)
  );

  if (viableCandidates.length === 0) {
    return buildFallbackSelection(
      input,
      "No viable action candidates remained after presence and policy filtering."
    );
  }

  const scored = viableCandidates
    .map((candidate) => {
      const goalAlignment = scoreGoalAlignment(
        candidate,
        focus,
        input.socialSlice.privacyLevel
      );
      const deceptionPressure =
        overlaps(candidate.tags, ["deceive", "cover", "deflect"]) ? 0.2 : 0;
      const aggressionPressure = overlaps(candidate.tags, ["attack", "threaten"]) ? 0.25 : 0;
      const tolerance = clamp01(
        1 -
          Math.max(
            deceptionPressure - input.policySlice.deceptionTolerance,
            aggressionPressure - input.policySlice.aggressionTolerance,
            0
          )
      );
      const riskScore = clamp01(candidate.riskBase + (focus?.socialRisk ?? 0) * 0.2);
      const riskFit = clamp01(tolerance * (1 - riskScore * 0.75));
      const socialFit = scoreSocialFit(candidate, input, focus);
      const identityFit = clamp01(
        0.5 +
          (overlaps(candidate.tags, input.policySlice.preferredActionTags) ? 0.3 : 0) -
          (overlaps(candidate.tags, input.policySlice.forbiddenActionTags) ? 0.5 : 0)
      );
      const costEfficiency = clamp01(1 - candidate.cost / 10);
      const urgencyFit = clamp01(
        Math.max(
          focus?.threat ?? 0,
          focus?.opportunity ?? 0,
          focus?.relevance ?? 0.3,
          candidate.actionType === "observe" ? 0.45 : 0
        )
      );
      const totalScore = clamp01(
        goalAlignment * 0.35 +
          riskFit * 0.2 +
          socialFit * 0.15 +
          identityFit * 0.1 +
          costEfficiency * 0.1 +
          urgencyFit * 0.1
      );

      return {
        candidate,
        totalScore,
        goalAlignment,
        riskScore
      };
    })
    .sort((left, right) => right.totalScore - left.totalScore);

  const chosen = scored[0];
  const executionMode =
    chosen.candidate.actionType === "observe" || chosen.candidate.actionType === "wait"
      ? focus && focus.certainty >= 0.55 && focus.threat >= 0.45
        ? "immediate"
        : "hold"
      : chosen.candidate.preconditions.length > 0
        ? "queued"
        : "immediate";
  const expectedEffectTags = deriveExpectedEffects(chosen.candidate.actionType, focus);
  const styleTags = uniqueStrings([
    overlaps(chosen.candidate.tags, ["discreet", "quiet", "隐蔽"]) ? "discreet" : undefined,
    focus && focus.threat >= 0.65 ? "defensive" : undefined,
    focus && focus.opportunity > focus.threat ? "open" : undefined,
    executionMode === "hold" ? "guarded" : undefined
  ]);
  const confidence = clamp01(chosen.totalScore * 0.6 + (focus?.certainty ?? 0.5) * 0.4);

  return {
    chosenActionId: chosen.candidate.actionId,
    actionType: chosen.candidate.actionType,
    itemActionType: chosen.candidate.itemActionType,
    verb: chosen.candidate.verb,
    targetActorIds: [...(chosen.candidate.targetActorIds ?? [])],
    targetObjectIds: [...(chosen.candidate.targetObjectIds ?? [])],
    targetLocationId: chosen.candidate.targetLocationId,
    visibility: chosen.candidate.visibility,
    executionMode,
    styleTags: styleTags.length > 0 ? styleTags : ["plain"],
    expectedEffectTags,
    riskScore: chosen.riskScore,
    goalAlignment: chosen.goalAlignment,
    confidence,
    fallbackActionIds: scored.slice(1, 3).map((entry) => entry.candidate.actionId),
    selectionReason: focus
      ? `Chose ${chosen.candidate.verb} to answer observation ${focus.observationId}.`
      : `Chose ${chosen.candidate.verb} as the safest available default action.`
  };
}
