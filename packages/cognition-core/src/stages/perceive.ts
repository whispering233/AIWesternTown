import type { WorldEventRecord } from "@ai-western-town/contracts";

import { buildStageId, clamp01, includesAnyTerm, maxOrZero, overlaps, uniqueStrings } from "../helpers";
import type {
  ClueSnapshot,
  PerceiveInput,
  PerceiveResult,
  PerceivedItem,
  RawObservationType,
  RetrievedMemoryItem,
  WorkingMemoryItem
} from "../types";

type RawObservationCandidate = {
  sourceId: string;
  rawType: RawObservationType;
  rawContent: string;
  sceneId: string;
  tick: number;
  actorIds: string[];
  targetIds: string[];
  tags: string[];
  anomalyScore: number;
  baseRecency: number;
  explicitKeep: boolean;
  clueId?: string;
};

function fromWorldEvent(event: WorldEventRecord): RawObservationCandidate {
  return {
    sourceId: event.eventId,
    rawType: "event",
    rawContent: event.summary ?? event.eventType,
    sceneId: event.originSceneId,
    tick: event.worldTick,
    actorIds: [...event.actorIds],
    targetIds: [...event.targetIds],
    tags: [...event.tags],
    anomalyScore: event.heatLevel === "interrupt" ? 1 : event.heatLevel === "high" ? 0.7 : 0.3,
    baseRecency: event.heatLevel === "interrupt" ? 1 : 0.75,
    explicitKeep: event.heatLevel !== "ordinary"
  };
}

function fromClue(
  clue: ClueSnapshot,
  sceneId: string,
  tick: number
): RawObservationCandidate {
  return {
    sourceId: clue.clueId,
    rawType: "clue",
    rawContent: clue.summary,
    sceneId,
    tick,
    actorIds: [...(clue.actorIds ?? [])],
    targetIds: [...(clue.targetIds ?? [])],
    tags: [...(clue.tags ?? [])],
    anomalyScore: clue.anomalyScore ?? 0.6,
    baseRecency: 0.7,
    explicitKeep: (clue.anomalyScore ?? 0) >= 0.7,
    clueId: clue.clueId
  };
}

function buildRawCandidates(input: PerceiveInput): RawObservationCandidate[] {
  const { observableWorldSlice } = input;
  const candidates: RawObservationCandidate[] = [];

  if (observableWorldSlice.playerAction) {
    candidates.push({
      sourceId: observableWorldSlice.playerAction.actionId,
      rawType:
        observableWorldSlice.playerAction.actionType === "speak" ? "speech" : "action",
      rawContent: observableWorldSlice.playerAction.summary,
      sceneId: observableWorldSlice.sceneId,
      tick: observableWorldSlice.tick,
      actorIds: ["player"],
      targetIds: uniqueStrings([
        ...(observableWorldSlice.playerAction.targetActorIds ?? []),
        ...(observableWorldSlice.playerAction.targetObjectIds ?? [])
      ]),
      tags: ["player_action", ...(observableWorldSlice.playerAction.tags ?? [])],
      anomalyScore: 0.7,
      baseRecency: 1,
      explicitKeep: true
    });
  }

  for (const action of observableWorldSlice.visibleActions) {
    candidates.push({
      sourceId: action.actionId,
      rawType: "action",
      rawContent: action.summary,
      sceneId: observableWorldSlice.sceneId,
      tick: observableWorldSlice.tick,
      actorIds: [action.actorId],
      targetIds: [...(action.targetIds ?? [])],
      tags: [...(action.tags ?? [])],
      anomalyScore: action.visibility === "private" ? 0.55 : 0.35,
      baseRecency: 0.9,
      explicitKeep: false
    });
  }

  for (const snippet of observableWorldSlice.dialogueSnippets) {
    candidates.push({
      sourceId: snippet.snippetId,
      rawType: "speech",
      rawContent: snippet.text,
      sceneId: observableWorldSlice.sceneId,
      tick: observableWorldSlice.tick,
      actorIds: [snippet.speakerId],
      targetIds: [...(snippet.targetActorIds ?? [])],
      tags: [...(snippet.tags ?? [])],
      anomalyScore: 0.4,
      baseRecency: 0.85,
      explicitKeep: false
    });
  }

  for (const actor of observableWorldSlice.visibleActors) {
    candidates.push({
      sourceId: `presence-${actor.actorId}`,
      rawType: "presence",
      rawContent: actor.summary ?? `${actor.displayName ?? actor.actorId} is present.`,
      sceneId: observableWorldSlice.sceneId,
      tick: observableWorldSlice.tick,
      actorIds: [actor.actorId],
      targetIds: [],
      tags: ["presence", ...(actor.tags ?? [])],
      anomalyScore: 0.2,
      baseRecency: 0.55,
      explicitKeep: false
    });
  }

  for (const clue of observableWorldSlice.visibleClues) {
    candidates.push(fromClue(clue, observableWorldSlice.sceneId, observableWorldSlice.tick));
  }

  for (const event of observableWorldSlice.recentLocalEvents) {
    candidates.push(fromWorldEvent(event));
  }

  const existingEventIds = new Set(
    observableWorldSlice.recentLocalEvents.map((event) => event.eventId)
  );
  for (const event of input.partitionAwareInput.recentEventWindow.events) {
    if (!existingEventIds.has(event.eventId)) {
      candidates.push(fromWorldEvent(event));
    }
  }

  return candidates;
}

function matchesWorkingMemory(
  candidate: RawObservationCandidate,
  memoryItem: WorkingMemoryItem
): boolean {
  return (
    candidate.actorIds.some((actorId) => memoryItem.relatedActorIds.includes(actorId)) ||
    overlaps(candidate.tags, memoryItem.tags) ||
    includesAnyTerm(candidate.rawContent, [memoryItem.summary])
  );
}

function matchesRetrievedMemory(
  candidate: RawObservationCandidate,
  memoryItem: RetrievedMemoryItem
): boolean {
  return (
    candidate.actorIds.some((actorId) =>
      (memoryItem.relatedActorIds ?? []).includes(actorId)
    ) ||
    overlaps(candidate.tags, memoryItem.tags ?? []) ||
    includesAnyTerm(candidate.rawContent, [memoryItem.summary])
  );
}

function isPartitionVisible(candidate: RawObservationCandidate, input: PerceiveInput): boolean {
  const { partitionSlice } = input.partitionAwareInput;
  const visibleActors = new Set(partitionSlice.visibleActorIds ?? []);
  const audibleActors = new Set(partitionSlice.audibleActorIds ?? []);
  const visibleClues = new Set(partitionSlice.visibleClueIds ?? []);

  if (candidate.rawType === "clue" && candidate.clueId) {
    return visibleClues.size === 0 || visibleClues.has(candidate.clueId);
  }

  if (candidate.actorIds.length === 0) {
    return true;
  }

  const actorVisible = candidate.actorIds.some(
    (actorId) => visibleActors.has(actorId) || audibleActors.has(actorId)
  );

  return visibleActors.size === 0 && audibleActors.size === 0 ? true : actorVisible;
}

export function perceive(input: PerceiveInput): PerceiveResult {
  const rawCandidates = buildRawCandidates(input);
  const activeWorkingMemory = input.workingMemory.items.filter(
    (item) =>
      item.status === "active" || input.workingMemory.activeConcernIds.includes(item.wmId)
  );

  const filteredCandidates = rawCandidates.filter(
    (candidate) =>
      candidate.sceneId === input.observableWorldSlice.sceneId &&
      isPartitionVisible(candidate, input)
  );

  const socialByActor = new Map(
    input.socialContextSlice.relationEdges.map((edge) => [edge.actorId, edge])
  );

  const perceivedItems = filteredCandidates
    .map((candidate, index): PerceivedItem & { score: number } => {
      const matchedConcerns = activeWorkingMemory.filter((item) =>
        matchesWorkingMemory(candidate, item)
      );
      const matchedMemories = input.retrievedMemorySlice.memoryItems.filter((item) =>
        matchesRetrievedMemory(candidate, item)
      );
      const socialRelevance = maxOrZero(
        candidate.actorIds.map((actorId) => {
          const edge = socialByActor.get(actorId);
          if (!edge) {
            return 0;
          }

          return clamp01(
            Math.max(edge.trust, edge.fear, edge.suspicion, edge.usefulness)
          );
        })
      );
      const selfRelevance = candidate.targetIds.includes(input.partitionAwareInput.npcId)
        ? 1
        : candidate.actorIds.includes(input.partitionAwareInput.npcId)
          ? 0.8
          : candidate.tags.includes("player_action")
            ? 0.7
            : 0.2;
      const concernMatch = matchedConcerns.length > 0 ? 1 : 0;
      const memoryMatch = matchedMemories.length > 0 ? 0.8 : 0;
      const anomaly = clamp01(candidate.anomalyScore);
      const score = clamp01(
        candidate.baseRecency * 0.25 +
          selfRelevance * 0.2 +
          socialRelevance * 0.15 +
          concernMatch * 0.2 +
          memoryMatch * 0.1 +
          anomaly * 0.1
      );
      const attentionReasonTags = uniqueStrings([
        candidate.tags.includes("player_action") ? "player_action_visible" : undefined,
        selfRelevance >= 0.8 ? "self_relevant" : undefined,
        concernMatch > 0 ? "concern_match" : undefined,
        memoryMatch > 0 ? "memory_match" : undefined,
        socialRelevance >= 0.6 ? "social_weighted" : undefined,
        anomaly >= 0.7 ? "anomaly_hit" : undefined,
        candidate.baseRecency >= 0.9 ? "fresh_stimulus" : undefined
      ]);

      return {
        observationId: buildStageId("obs", candidate.tick, index),
        rawType: candidate.rawType,
        rawContent: candidate.rawContent,
        sceneId: candidate.sceneId,
        tick: candidate.tick,
        actorIds: [...candidate.actorIds],
        targetIds: [...candidate.targetIds],
        salience: score,
        attentionReasonTags,
        linkedMemoryIds: matchedMemories.map((memory) => memory.memoryId),
        linkedConcernIds: matchedConcerns.map((memory) => memory.wmId),
        score
      };
    })
    .filter((item) => item.score >= 0.35 || item.attentionReasonTags.length > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 7)
    .map(({ score: _score, ...item }) => item);

  return {
    perceivedItems,
    debugMeta: {
      rawCount: rawCandidates.length,
      filteredCount: filteredCandidates.length,
      finalCount: perceivedItems.length
    }
  };
}
