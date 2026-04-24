import {
  clamp01,
  includesAnyTerm,
  maxOrZero,
  overlaps,
  uniqueStrings
} from "../helpers";
import type {
  AppraiseInput,
  AppraiseResult,
  AppraisalResult,
  GoalSummary,
  RetrievedBelief
} from "../types";

// First-pass appraisal still matches against free-form observation text.
// The current content/debug pipeline can emit either Chinese or English summaries,
// so these fallback lexicons intentionally stay bilingual for recall.
// Output tags remain normalized in English, and this should eventually move to
// an upstream normalization or centralized lexicon layer.
const THREAT_TERMS = [
  "threat",
  "violence",
  "reveal",
  "expose",
  "accuse",
  "probe",
  "pressure",
  "gun",
  "blood",
  "secret",
  "质问",
  "暴力",
  "揭露",
  "秘密"
];

const OPPORTUNITY_TERMS = [
  "help",
  "offer",
  "ally",
  "chance",
  "gain",
  "cooperate",
  "give",
  "帮助",
  "合作",
  "机会"
];

function goalMatchesObservation(goal: GoalSummary, rawContent: string, tags: string[]): boolean {
  return (
    includesAnyTerm(rawContent, [goal.summary, ...(goal.tags ?? [])]) ||
    overlaps(tags, goal.tags ?? [])
  );
}

function beliefSupportsObservation(
  rawContent: string,
  tags: string[],
  belief: RetrievedBelief
): boolean {
  return (
    includesAnyTerm(rawContent, [belief.summary]) ||
    overlaps(tags, belief.tags ?? []) ||
    rawContent.includes(belief.kind)
  );
}

function inferIntentTags(
  rawContent: string,
  attentionReasonTags: string[],
  threat: number,
  opportunity: number
): string[] {
  const inferred = uniqueStrings([
    includesAnyTerm(rawContent, ["probe", "question", "追问", "试探"]) ? "probe" : undefined,
    includesAnyTerm(rawContent, ["threat", "force", "威胁"]) ? "threaten" : undefined,
    includesAnyTerm(rawContent, ["help", "offer", "帮助"]) ? "assist" : undefined,
    attentionReasonTags.includes("memory_match") ? "pattern_repeat" : undefined,
    threat >= 0.7 ? "pressure" : undefined,
    opportunity >= 0.65 ? "opening" : undefined
  ]);

  return inferred.length > 0 ? inferred : ["observe"];
}

export function appraise(input: AppraiseInput): AppraiseResult {
  const goalSummaries = input.identitySlice.longTermGoals.filter((goal) =>
    input.currentGoalState.activeGoalIds.includes(goal.goalId)
  );
  const socialBeliefByActor = new Map(
    input.socialBeliefSlice.relatedActors.map((actor) => [actor.actorId, actor])
  );

  const appraisalResults: AppraisalResult[] = input.perceivedItems.map((perceived) => {
    const goalMatches = goalSummaries.filter((goal) =>
      goalMatchesObservation(goal, perceived.rawContent, perceived.attentionReasonTags)
    );
    const matchedBeliefs = input.retrievedBeliefSlice.beliefs.filter((belief) =>
      beliefSupportsObservation(
        perceived.rawContent,
        perceived.attentionReasonTags,
        belief
      )
    );
    const actorBeliefs = perceived.actorIds
      .map((actorId) => socialBeliefByActor.get(actorId))
      .filter((actor): actor is NonNullable<typeof actor> => actor !== undefined);
    const relationRelevance = maxOrZero(
      actorBeliefs.map((belief) =>
        clamp01(
          Math.max(
            belief.trust,
            belief.fear,
            belief.suspicion,
            belief.dependency,
            belief.usefulness
          )
        )
      )
    );
    const secretRelevance = includesAnyTerm(
      perceived.rawContent,
      input.identitySlice.hiddenSecrets
    )
      ? 1
      : perceived.attentionReasonTags.includes("anomaly_hit")
        ? 0.45
        : 0;
    const identityTensionRelevance = maxOrZero(
      (input.identityEvolutionSlice?.activeIdentityTensions ?? []).map((tension) =>
        includesAnyTerm(perceived.rawContent, [tension.summary]) ? tension.intensity : 0
      )
    );
    const relevance = clamp01(
      perceived.salience * 0.35 +
        (goalMatches.length > 0 ? 1 : 0) * 0.25 +
        secretRelevance * 0.2 +
        relationRelevance * 0.1 +
        identityTensionRelevance * 0.1
    );
    const keywordThreat = includesAnyTerm(perceived.rawContent, THREAT_TERMS) ? 1 : 0;
    const keywordOpportunity = includesAnyTerm(perceived.rawContent, OPPORTUNITY_TERMS)
      ? 1
      : 0;
    const fearOrSuspicion = maxOrZero(
      actorBeliefs.map((belief) => Math.max(belief.fear, belief.suspicion))
    );
    const usefulness = maxOrZero(actorBeliefs.map((belief) => belief.usefulness));
    const trust = maxOrZero(actorBeliefs.map((belief) => belief.trust));
    const publicExposure =
      perceived.rawType === "speech" || perceived.rawType === "presence" ? 0.7 : 0.35;
    const anomaly = clamp01(
      perceived.rawType === "clue"
        ? Math.max(0.55, perceived.salience * 0.8)
        : perceived.attentionReasonTags.includes("anomaly_hit")
          ? 0.65
          : perceived.salience * 0.35
    );
    const threat = clamp01(
      secretRelevance * 0.35 +
        fearOrSuspicion * 0.25 +
        keywordThreat * 0.2 +
        anomaly * 0.1 +
        identityTensionRelevance * 0.1
    );
    const opportunity = clamp01(
      keywordOpportunity * 0.35 +
        usefulness * 0.25 +
        trust * 0.2 +
        (goalMatches.length > 0 ? 0.2 : 0)
    );
    const socialRisk = clamp01(
      publicExposure * 0.35 + fearOrSuspicion * 0.35 + threat * 0.3
    );
    const emotionalCharge = clamp01(
      Math.max(threat, opportunity * 0.85, anomaly * 0.7) * 0.9 + relevance * 0.1
    );
    const beliefSupport = maxOrZero(
      matchedBeliefs.map((belief) => clamp01(belief.importance))
    );
    const certainty = clamp01(
      0.55 + beliefSupport * 0.2 + trust * 0.1 - anomaly * 0.15 - keywordThreat * 0.05
    );
    const inferredIntentTags = inferIntentTags(
      perceived.rawContent,
      perceived.attentionReasonTags,
      threat,
      opportunity
    );
    const affectedGoalIds = uniqueStrings(goalMatches.map((goal) => goal.goalId));
    const affectedActorIds = uniqueStrings([...perceived.actorIds, ...perceived.targetIds]);

    let workingMemoryRecommendation: AppraisalResult["workingMemoryRecommendation"] =
      "discard";
    if (relevance >= 0.8 || threat >= 0.7 || opportunity >= 0.7 || socialRisk >= 0.7) {
      workingMemoryRecommendation = "must_store";
    } else if (relevance >= 0.55 || anomaly >= 0.55) {
      workingMemoryRecommendation = "store_if_space";
    } else if (certainty < 0.5 || perceived.salience >= 0.45) {
      workingMemoryRecommendation = "log_only";
    }

    const appraisalSummary =
      threat >= opportunity
        ? `Observation ${perceived.observationId} reads as pressure on current concerns.`
        : `Observation ${perceived.observationId} may open a usable opportunity.`;

    return {
      observationId: perceived.observationId,
      relevance,
      threat,
      opportunity,
      socialRisk,
      anomaly,
      emotionalCharge,
      certainty,
      inferredIntentTags,
      affectedGoalIds,
      affectedActorIds,
      workingMemoryRecommendation,
      appraisalSummary
    };
  });

  return {
    appraisalResults,
    debugMeta: {
      llmRefined: false,
      evaluatedCount: appraisalResults.length
    }
  };
}
