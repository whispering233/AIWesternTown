import type {
  InterruptType,
  NpcStage,
  PlannedNpcExecution,
  ScheduleDecisionSet,
  SimulationDebugSummary,
  SimulationRunMode,
  WorldEventRecord,
  WorldEventWindow
} from "@ai-western-town/contracts";

import { buildPlayerLoopFrame } from "./player-loop.js";
import { getTargetNpcId, getTargetSceneId, resolvePlayerActionPolicy } from "./policy.js";
import type {
  DialogueThreadState,
  InterruptEvaluationInput,
  InterruptEvaluationResult,
  NPCScheduleState,
  PendingInterruptState,
  PlayerCommandEnvelope,
  PlayerContextSlice,
  PlayerVisibleWorldUpdate,
  SceneGraphSlice,
  SimulationEventFlowEntry,
  SimulationExecutionPlan,
  SimulationStatePatchSet,
  SurfacedOpportunity,
  PlayerStepContext,
  WorldSimulationInput,
  WorldSimulationResult
} from "./types.js";

const FULL_EXECUTION_STAGES: NpcStage[] = [
  "prefetch",
  "perceive",
  "appraise",
  "update_working_memory",
  "goal_arbitration",
  "action_selection",
  "act",
  "reflect",
  "compress"
];

const REACTIVE_EXECUTION_STAGES: NpcStage[] = ["perceive", "appraise", "act"];
const LIGHT_EXECUTION_STAGES: NpcStage[] = [
  "prefetch",
  "perceive",
  "appraise",
  "update_working_memory"
];

function isUnavailable(state: NPCScheduleState): boolean {
  return (
    state.availability === "incapacitated" || state.availability === "absent"
  );
}

function scoreNpc(
  npcState: NPCScheduleState,
  dialogue: DialogueThreadState | undefined,
  events: WorldEventWindow
): number {
  const eventInvolvement = events.events.some(
    (event) =>
      event.actorIds.includes(npcState.npcId) ||
      event.targetIds.includes(npcState.npcId)
  );

  let score = npcState.scheduleHeat;

  if (npcState.cognitiveHeat === "active") {
    score += 20;
  } else if (npcState.cognitiveHeat === "background") {
    score += 10;
  }

  if (dialogue?.anchorNpcId === npcState.npcId) {
    score += 100;
  }

  if (dialogue?.participantNpcIds.includes(npcState.npcId)) {
    score += 40;
  }

  if (eventInvolvement) {
    score += 25;
  }

  if (npcState.boundDialogueThreadId === dialogue?.threadId) {
    score += 30;
  }

  if (npcState.availability === "busy") {
    score -= 10;
  }

  return score;
}

function buildEmptyScheduleDecisionSet(): ScheduleDecisionSet {
  return {
    foregroundFullNpcIds: [],
    foregroundReactiveNpcIds: [],
    nearFieldLightNpcIds: [],
    nearFieldEscalatedNpcIds: [],
    deferredFarFieldNpcIds: []
  };
}

function buildEmptyVisibleUpdate(currentSceneId: string): PlayerVisibleWorldUpdate {
  return {
    primarySceneId: currentSceneId,
    visibleActionResults: [],
    reactiveMoments: [],
    worldHintLines: []
  };
}

function buildDefaultPlayerStepContext(
  input: WorldSimulationInput
): PlayerStepContext {
  return (
    input.playerStepContext ?? {
      currentSceneId: input.playerContext.currentSceneId,
      visibleNpcIds: [...input.playerContext.visibleNpcIds],
      visibleObjects: [],
      visibleAnomalies: [],
      availableSoftOpportunities: [],
      runMode: resolveRunMode(
        input.playerContext,
        input.activeDialogueThread,
        input.pendingInterrupt
      )
    }
  );
}

function resolvePlayerLoopStepContext(
  input: WorldSimulationInput
): PlayerStepContext {
  const action = input.playerCommand.parsedAction;
  const targetSceneId = getTargetSceneId(action);
  const nextStepContext = input.nextPlayerStepContext;

  if (
    nextStepContext &&
    targetSceneId &&
    (action.actionClass === "travel" || action.actionClass === "reposition") &&
    nextStepContext.currentSceneId === targetSceneId
  ) {
    return nextStepContext;
  }

  return buildDefaultPlayerStepContext(input);
}

function normalizeEventWindow(
  window: WorldEventWindow,
  worldTick: number
): WorldEventWindow {
  const from = Math.min(window.tickRange.from, worldTick);
  const to = Math.max(window.tickRange.to, worldTick);

  return {
    tickRange: { from, to },
    events: [...window.events]
  };
}

function appendWorldEvents(
  window: WorldEventWindow,
  events: WorldEventRecord[],
  worldTick: number
): WorldEventWindow {
  const normalized = normalizeEventWindow(window, worldTick);

  return {
    tickRange: {
      from: Math.min(
        normalized.tickRange.from,
        ...events.map((event) => event.worldTick)
      ),
      to: Math.max(normalized.tickRange.to, ...events.map((event) => event.worldTick))
    },
    events: [...normalized.events, ...events]
  };
}

function buildPlayerActionEvent(
  playerCommand: PlayerCommandEnvelope,
  worldTick: number,
  currentSceneId: string,
  worldTickReason: string,
  consumesTick: boolean
): WorldEventRecord {
  const targetNpcId = getTargetNpcId(playerCommand.parsedAction);
  const targetSceneId = getTargetSceneId(playerCommand.parsedAction);
  const actionType = playerCommand.parsedAction.actionType ?? playerCommand.commandType;
  const tags = [...(playerCommand.parsedAction.tags ?? []), worldTickReason];

  return {
    eventId: `evt-${worldTick}-${playerCommand.commandId}`,
    eventType: actionType,
    worldTick,
    originSceneId: targetSceneId ?? currentSceneId,
    actorIds: ["player"],
    targetIds: targetNpcId ? [targetNpcId] : [],
    tags,
    heatLevel: consumesTick ? "high" : "ordinary",
    sourceCommandId: playerCommand.commandId,
    summary: `Resolved player action ${actionType}.`,
    payload: {
      commandType: playerCommand.commandType,
      worldTickReason
    }
  };
}

function mapEventToSoftOpportunity(event: WorldEventRecord): SurfacedOpportunity {
  const tags = new Set(event.tags);

  let opportunityType: SurfacedOpportunity["opportunityType"] = "observe_more";
  if (tags.has("departure")) {
    opportunityType = "follow";
  } else if (tags.has("callout")) {
    opportunityType = "interrupt";
  } else if (tags.has("inspect")) {
    opportunityType = "inspect";
  } else if (tags.has("social")) {
    opportunityType = "approach";
  }

  return {
    opportunityId: `soft-${event.eventId}`,
    opportunityType,
    leadText: event.summary ?? `Follow up on ${event.eventType}.`,
    sourceFindingIds: [event.eventId],
    resolutionMode: opportunityType === "interrupt" ? "short_scene" : "atomic"
  };
}

function classifyPlayerInterruptType(event: WorldEventRecord) {
  const tags = new Set(event.tags);

  if (tags.has("callout") || event.eventType.includes("callout")) {
    return "forced_social_callout" as const;
  }

  if (
    event.interruptType === "violence" ||
    event.interruptType === "intrusion" ||
    tags.has("escalation")
  ) {
    return "imminent_escalation" as const;
  }

  if (tags.has("departure") || event.eventType.includes("departure")) {
    return "critical_departure" as const;
  }

  return "closing_secret_window" as const;
}

function scoreInterruptEvent(
  event: WorldEventRecord,
  player: PlayerContextSlice,
  dialogue?: DialogueThreadState
): number {
  let score = event.heatLevel === "interrupt" ? 100 : 0;

  if (event.originSceneId === player.currentSceneId) {
    score += 50;
  }

  if (
    player.focusedNpcId &&
    (event.actorIds.includes(player.focusedNpcId) ||
      event.targetIds.includes(player.focusedNpcId))
  ) {
    score += 30;
  }

  if (
    dialogue &&
    (event.actorIds.includes(dialogue.anchorNpcId) ||
      event.targetIds.includes(dialogue.anchorNpcId))
  ) {
    score += 25;
  }

  switch (event.interruptType) {
    case "violence":
      score += 30;
      break;
    case "public_reveal":
      score += 20;
      break;
    case "forced_state_change":
      score += 15;
      break;
    case "intrusion":
      score += 10;
      break;
    default:
      break;
  }

  return score + event.worldTick;
}

function toPendingInterruptState(
  event: WorldEventRecord,
  priority: number
): PendingInterruptState | undefined {
  if (!event.interruptType) {
    return undefined;
  }

  return {
    eventId: event.eventId,
    interruptType: event.interruptType,
    originSceneId: event.originSceneId,
    createdAtTick: event.worldTick,
    priority
  };
}

function buildNpcExecutions(
  scheduleDecisions: ScheduleDecisionSet,
  events: WorldEventWindow
): PlannedNpcExecution[] {
  const executions: PlannedNpcExecution[] = [];

  for (const npcId of scheduleDecisions.foregroundFullNpcIds) {
    executions.push({
      npcId,
      executionClass: "full",
      runStages: FULL_EXECUTION_STAGES,
      escalationReasonTags: ["foreground_priority"]
    });
  }

  for (const npcId of scheduleDecisions.foregroundReactiveNpcIds) {
    executions.push({
      npcId,
      executionClass: "reactive",
      runStages: REACTIVE_EXECUTION_STAGES,
      escalationReasonTags: ["foreground_reactive"]
    });
  }

  for (const npcId of scheduleDecisions.nearFieldLightNpcIds) {
    executions.push({
      npcId,
      executionClass: "light",
      runStages: LIGHT_EXECUTION_STAGES,
      escalationReasonTags: ["near_field_budget"]
    });
  }

  for (const npcId of scheduleDecisions.nearFieldEscalatedNpcIds) {
    const eventTags = events.events
      .filter(
        (event) => event.actorIds.includes(npcId) || event.targetIds.includes(npcId)
      )
      .flatMap((event) => event.tags);

    executions.push({
      npcId,
      executionClass: "full",
      runStages: FULL_EXECUTION_STAGES,
      escalationReasonTags: eventTags.length > 0 ? eventTags : ["near_field_escalated"]
    });
  }

  return executions;
}

function buildStatePatches(
  input: WorldSimulationInput,
  advancedToTick: number,
  scheduleDecisions: ScheduleDecisionSet,
  selectedInterrupt: PendingInterruptState | undefined,
  appendedEvents: WorldEventRecord[],
  executionPlan: SimulationExecutionPlan
): SimulationStatePatchSet {
  const targetNpcId = executionPlan.playerActionExecution.targetNpcId;

  let nextDialogueThread = input.activeDialogueThread;
  if (selectedInterrupt && input.activeDialogueThread) {
    nextDialogueThread = {
      ...input.activeDialogueThread,
      status: "suspended",
      lastAdvancedAtTick: advancedToTick
    };
  } else if (
    executionPlan.playerActionExecution.resultingRunMode === "focused_dialogue" &&
    targetNpcId
  ) {
    nextDialogueThread = {
      threadId:
        input.activeDialogueThread?.anchorNpcId === targetNpcId
          ? input.activeDialogueThread.threadId
          : `dlg-${targetNpcId}-${advancedToTick}`,
      sceneId: input.playerContext.currentSceneId,
      anchorNpcId: targetNpcId,
      participantNpcIds: [targetNpcId],
      status: "active",
      startedAtTick: input.activeDialogueThread?.startedAtTick ?? advancedToTick,
      lastAdvancedAtTick: advancedToTick
    };
  }

  const npcSchedulePatches = [
    ...scheduleDecisions.foregroundFullNpcIds.map((npcId) => ({
      npcId,
      sceneTier: "foreground" as const,
      lastFullTick: advancedToTick
    })),
    ...scheduleDecisions.foregroundReactiveNpcIds.map((npcId) => ({
      npcId,
      sceneTier: "foreground" as const,
      lastLightTick: advancedToTick
    })),
    ...scheduleDecisions.nearFieldLightNpcIds.map((npcId) => ({
      npcId,
      sceneTier: "near_field" as const,
      lastLightTick: advancedToTick
    })),
    ...scheduleDecisions.nearFieldEscalatedNpcIds.map((npcId) => ({
      npcId,
      sceneTier: "near_field" as const,
      lastFullTick: advancedToTick
    }))
  ];

  const promotedNpcIds = [...scheduleDecisions.nearFieldEscalatedNpcIds];
  const deferredNpcIds = [...scheduleDecisions.deferredFarFieldNpcIds];
  const involvedNpcIds = new Set([
    ...scheduleDecisions.foregroundFullNpcIds,
    ...scheduleDecisions.foregroundReactiveNpcIds,
    ...scheduleDecisions.nearFieldLightNpcIds,
    ...scheduleDecisions.nearFieldEscalatedNpcIds
  ]);

  const farFieldUpserts = input.farFieldBacklog
    .filter((item) => deferredNpcIds.includes(item.npcId))
    .map((item) => ({
      ...item,
      accumulatedHeat: item.accumulatedHeat + 1
    }));

  for (const npcId of deferredNpcIds) {
    if (!farFieldUpserts.some((item) => item.npcId === npcId)) {
      farFieldUpserts.push({
        npcId,
        summaryTags: ["deferred"],
        accumulatedHeat: 1,
        queuedAtTick: advancedToTick
      });
    }
  }

  return {
    nextDialogueThread,
    nextPendingInterrupt: selectedInterrupt,
    npcSchedulePatches,
    activeLongActionPatch: {
      upserts: [],
      removeNpcIds: input.activeLongActions
        .filter((action) => involvedNpcIds.has(action.npcId))
        .map((action) => action.npcId)
    },
    nearFieldQueuePatch: {
      promotedNpcIds,
      deferredNpcIds
    },
    farFieldBacklogPatch: {
      upserts: farFieldUpserts,
      removedNpcIds: promotedNpcIds
    },
    appendedEventIds: appendedEvents.map((event) => event.eventId)
  };
}

function buildVisibleUpdate(
  input: WorldSimulationInput,
  executionPlan: SimulationExecutionPlan,
  scheduleDecisions: ScheduleDecisionSet,
  selectedInterrupt: PendingInterruptState | undefined
): PlayerVisibleWorldUpdate {
  const visibleActionResults = executionPlan.playerActionExecution.consumesTick
    ? [
        {
          resultId: `action-${executionPlan.playerActionExecution.commandId}`,
          sourceCommandId: executionPlan.playerActionExecution.commandId,
          summary: `Resolved ${executionPlan.playerActionExecution.actionType}.`,
          tags: [executionPlan.playerActionExecution.worldTickReason]
        }
      ]
    : [];

  const reactiveMoments = scheduleDecisions.foregroundReactiveNpcIds.map((npcId) => ({
    npcId,
    reactionType: "react" as const,
    summary: `${npcId} remains in the foreground and reacts to the latest move.`
  }));

  const worldHintLines = [
    `run_mode_target:${executionPlan.playerActionExecution.resultingRunMode}`,
    `foreground_full:${scheduleDecisions.foregroundFullNpcIds.length}`,
    `near_field_light:${scheduleDecisions.nearFieldLightNpcIds.length}`
  ];

  const visibleUpdate: PlayerVisibleWorldUpdate = {
    primarySceneId: input.playerContext.currentSceneId,
    visibleActionResults,
    reactiveMoments,
    worldHintLines
  };

  if (selectedInterrupt) {
    visibleUpdate.insertedInterrupt = {
      interruptId: selectedInterrupt.eventId,
      interruptType: selectedInterrupt.interruptType,
      summary: `Interrupt queued from ${selectedInterrupt.originSceneId}.`
    };
    visibleUpdate.sceneMoodPatch = {
      sceneId: input.playerContext.currentSceneId,
      moodTags: ["interrupted", "high_tension"]
    };
  } else if (reactiveMoments.length > 0) {
    visibleUpdate.sceneMoodPatch = {
      sceneId: input.playerContext.currentSceneId,
      moodTags: ["reactive"]
    };
  }

  return visibleUpdate;
}

export function resolveRunMode(
  player: PlayerContextSlice,
  dialogue?: DialogueThreadState,
  interrupt?: PendingInterruptState
): "free_explore" | "focused_dialogue" | "interrupted" {
  if (interrupt) {
    return "interrupted";
  }

  if (dialogue?.status === "active" || player.currentMode === "focused_dialogue") {
    return "focused_dialogue";
  }

  return "free_explore";
}

export function buildSceneBubble(
  currentSceneId: string,
  sceneGraph: SceneGraphSlice,
  npcStates: NPCScheduleState[],
  events: WorldEventWindow
): {
  foregroundNpcIds: string[];
  nearFieldNpcIds: string[];
  farFieldNpcIds: string[];
} {
  const adjacentSceneIds = new Set(sceneGraph.adjacentSceneIds);
  const highHeatNpcIds = new Set(
    events.events
      .filter((event) => event.heatLevel !== "ordinary")
      .flatMap((event) => [...event.actorIds, ...event.targetIds])
  );

  const foregroundNpcIds: string[] = [];
  const nearFieldNpcIds: string[] = [];
  const farFieldNpcIds: string[] = [];

  for (const npcState of npcStates) {
    if (npcState.currentSceneId === currentSceneId) {
      foregroundNpcIds.push(npcState.npcId);
      continue;
    }

    if (
      adjacentSceneIds.has(npcState.currentSceneId) ||
      highHeatNpcIds.has(npcState.npcId) ||
      npcState.sceneTier === "near_field"
    ) {
      nearFieldNpcIds.push(npcState.npcId);
      continue;
    }

    farFieldNpcIds.push(npcState.npcId);
  }

  return {
    foregroundNpcIds,
    nearFieldNpcIds,
    farFieldNpcIds
  };
}

export function shouldEscalateNearFieldNpc(
  npcState: NPCScheduleState,
  events: WorldEventWindow
): boolean {
  const involvedEvents = events.events.filter(
    (event) =>
      event.actorIds.includes(npcState.npcId) ||
      event.targetIds.includes(npcState.npcId)
  );

  return (
    npcState.scheduleHeat >= 70 ||
    npcState.cognitiveHeat === "active" ||
    involvedEvents.some((event) => event.heatLevel !== "ordinary")
  );
}

export function chooseForegroundExecutions(
  runMode: "free_explore" | "focused_dialogue" | "interrupted",
  bubble: {
    foregroundNpcIds: string[];
    nearFieldNpcIds: string[];
    farFieldNpcIds: string[];
  },
  npcStates: NPCScheduleState[],
  dialogue?: DialogueThreadState,
  events?: WorldEventWindow
): ScheduleDecisionSet {
  const eventWindow = events ?? {
    tickRange: { from: 0, to: 0 },
    events: []
  };

  const npcStateMap = new Map(npcStates.map((state) => [state.npcId, state]));
  const foregroundCandidates: NPCScheduleState[] = bubble.foregroundNpcIds
    .map((npcId) => npcStateMap.get(npcId))
    .filter(
      (state): state is NPCScheduleState =>
        state !== undefined && !isUnavailable(state)
    );
  const sortedForeground = foregroundCandidates
    .sort(
      (left, right) => scoreNpc(right, dialogue, eventWindow) - scoreNpc(left, dialogue, eventWindow)
    );

  const fullBudget = Math.min(2, sortedForeground.length);
  const foregroundFullNpcIds = sortedForeground
    .slice(0, fullBudget)
    .map((state) => state.npcId);
  const foregroundReactiveNpcIds =
    runMode === "interrupted"
      ? []
      : sortedForeground
          .slice(fullBudget)
          .map((state) => state.npcId);

  const nearFieldCandidates: NPCScheduleState[] = bubble.nearFieldNpcIds
    .map((npcId) => npcStateMap.get(npcId))
    .filter(
      (state): state is NPCScheduleState =>
        state !== undefined && !isUnavailable(state)
    )
    .sort(
      (left, right) => scoreNpc(right, dialogue, eventWindow) - scoreNpc(left, dialogue, eventWindow)
    );

  const nearFieldLightNpcIds: string[] = [];
  const nearFieldEscalatedNpcIds: string[] = [];
  const selectedNearField = nearFieldCandidates[0];

  if (selectedNearField) {
    if (shouldEscalateNearFieldNpc(selectedNearField, eventWindow)) {
      nearFieldEscalatedNpcIds.push(selectedNearField.npcId);
    } else {
      nearFieldLightNpcIds.push(selectedNearField.npcId);
    }
  }

  return {
    foregroundFullNpcIds,
    foregroundReactiveNpcIds,
    nearFieldLightNpcIds,
    nearFieldEscalatedNpcIds,
    deferredFarFieldNpcIds: [...bubble.farFieldNpcIds]
  };
}

export function selectInterruptCandidate(
  events: WorldEventWindow,
  player: PlayerContextSlice,
  dialogue?: DialogueThreadState
): PendingInterruptState | undefined {
  const candidates = events.events
    .filter((event) => event.heatLevel === "interrupt")
    .filter(
      (event) =>
        event.originSceneId === player.currentSceneId ||
        (player.focusedNpcId
          ? event.actorIds.includes(player.focusedNpcId) ||
            event.targetIds.includes(player.focusedNpcId)
          : false) ||
        (dialogue
          ? event.actorIds.includes(dialogue.anchorNpcId) ||
            event.targetIds.includes(dialogue.anchorNpcId)
          : false)
    );

  let bestCandidate: { event: WorldEventRecord; score: number } | undefined;

  for (const candidate of candidates) {
    const score = scoreInterruptEvent(candidate, player, dialogue);
    if (!bestCandidate || score > bestCandidate.score) {
      bestCandidate = { event: candidate, score };
    }
  }

  return bestCandidate
    ? toPendingInterruptState(bestCandidate.event, bestCandidate.score)
    : undefined;
}

export function evaluatePlayerInterrupt(
  input: InterruptEvaluationInput
): InterruptEvaluationResult {
  if (!input.currentStepResolved) {
    return {
      deferredSoftOpportunities: input.visibleEventCandidates.map(
        mapEventToSoftOpportunity
      )
    };
  }

  const candidates = input.visibleEventCandidates.filter(
    (event) =>
      event.heatLevel === "interrupt" && event.originSceneId === input.currentSceneId
  );

  if (candidates.length === 0) {
    return {
      deferredSoftOpportunities: input.visibleEventCandidates.map(
        mapEventToSoftOpportunity
      )
    };
  }

  const sorted = [...candidates].sort((left, right) => {
    const leftWeight = left.interruptType === "violence" ? 2 : 1;
    const rightWeight = right.interruptType === "violence" ? 2 : 1;
    return rightWeight - leftWeight || right.worldTick - left.worldTick;
  });
  const selected = sorted[0];

  return {
    selectedInterrupt: {
      interruptId: selected.eventId,
      interruptType: classifyPlayerInterruptType(selected),
      reason: selected.summary ?? `Interrupt window opened for ${selected.eventType}.`
    },
    deferredSoftOpportunities: input.visibleEventCandidates
      .filter((event) => event.eventId !== selected.eventId)
      .map(mapEventToSoftOpportunity)
  };
}

export function advanceWorldSimulation(
  input: WorldSimulationInput
): WorldSimulationResult {
  const runModeBefore = resolveRunMode(
    input.playerContext,
    input.activeDialogueThread,
    input.pendingInterrupt
  );
  const playerStepContext = resolvePlayerLoopStepContext(input);
  const actionPolicy = resolvePlayerActionPolicy(input.playerCommand.parsedAction);
  const consumesTick = actionPolicy.consumesTick;
  const advancedToTick = consumesTick ? input.worldTick + 1 : input.worldTick;
  const targetNpcId = getTargetNpcId(input.playerCommand.parsedAction);
  const targetSceneId = getTargetSceneId(input.playerCommand.parsedAction);

  const executionPlan: SimulationExecutionPlan = {
    playerActionExecution: {
      commandId: input.playerCommand.commandId,
      actionType:
        input.playerCommand.parsedAction.actionType ?? input.playerCommand.commandType,
      consumesTick,
      worldTickReason: actionPolicy.worldTickReason,
      resultingRunMode: actionPolicy.resultingRunMode,
      targetSceneId,
      targetNpcId
    },
    npcExecutions: []
  };

  const eventFlow: SimulationEventFlowEntry[] = [
    {
      kind: "command.received",
      worldTick: input.worldTick,
      commandId: input.playerCommand.commandId,
      consumesTick,
      worldTickReason: actionPolicy.worldTickReason
    }
  ];

  if (!consumesTick) {
    const scheduleDecisions = buildEmptyScheduleDecisionSet();
    const visibleUpdate = buildEmptyVisibleUpdate(input.playerContext.currentSceneId);
    const playerLoopFrame = buildPlayerLoopFrame(
      {
        ...playerStepContext,
        runMode: runModeBefore
      },
      input.playerCommand.parsedAction
    );
    const debugSummary: SimulationDebugSummary = {
      worldTick: advancedToTick,
      runModeBefore,
      runModeAfter: runModeBefore,
      promotedNpcIds: [],
      suppressedNpcIds: [],
      interruptCandidates: [],
      budgetNotes: ["player action did not consume a world tick"]
    };

    return {
      advancedToTick,
      resolvedRunMode: runModeBefore,
      actionPolicy,
      playerLoopFrame,
      scheduleDecisions,
      executionPlan,
      visibleUpdate,
      statePatches: {
        npcSchedulePatches: [],
        activeLongActionPatch: {
          upserts: [],
          removeNpcIds: []
        },
        nearFieldQueuePatch: {
          promotedNpcIds: [],
          deferredNpcIds: []
        },
        farFieldBacklogPatch: {
          upserts: [],
          removedNpcIds: []
        },
        appendedEventIds: []
      },
      debugSummary,
      appendedEvents: [],
      eventFlow
    };
  }

  const appendedEvents = [
    buildPlayerActionEvent(
      input.playerCommand,
      advancedToTick,
      input.playerContext.currentSceneId,
      actionPolicy.worldTickReason,
      consumesTick
    )
  ];
  const effectiveEventWindow = appendWorldEvents(
    input.recentEventWindow,
    appendedEvents,
    advancedToTick
  );
  const bubble = buildSceneBubble(
    input.playerContext.currentSceneId,
    input.sceneGraph,
    input.npcScheduleStates,
    effectiveEventWindow
  );
  const scheduleDecisions = chooseForegroundExecutions(
    runModeBefore,
    bubble,
    input.npcScheduleStates,
    input.activeDialogueThread,
    effectiveEventWindow
  );
  const selectedInterrupt = selectInterruptCandidate(
    effectiveEventWindow,
    input.playerContext,
    input.activeDialogueThread
  );

  if (selectedInterrupt) {
    scheduleDecisions.chosenInterruptEventId = selectedInterrupt.eventId;
    executionPlan.interruptPlan = {
      eventId: selectedInterrupt.eventId,
      interruptType: selectedInterrupt.interruptType,
      originSceneId: selectedInterrupt.originSceneId,
      reason: `Interrupt selected with priority ${selectedInterrupt.priority}.`
    };
  }

  executionPlan.npcExecutions = buildNpcExecutions(
    scheduleDecisions,
    effectiveEventWindow
  );

  const runModeAfterTick: SimulationRunMode = "settle";
  eventFlow.push({
    kind: "tick.advanced",
    fromTick: input.worldTick,
    toTick: advancedToTick,
    runModeBefore,
    runModeAfter: runModeAfterTick
  });
  eventFlow.push({
    kind: "scheduler.decided",
    worldTick: advancedToTick,
    scheduleDecisions,
    npcExecutions: executionPlan.npcExecutions
  });

  if (selectedInterrupt) {
    eventFlow.push({
      kind: "interrupt.selected",
      worldTick: advancedToTick,
      interruptId: selectedInterrupt.eventId,
      interruptType: selectedInterrupt.interruptType,
      reason: executionPlan.interruptPlan?.reason ?? "interrupt selected"
    });
  }

  const statePatches = buildStatePatches(
    input,
    advancedToTick,
    scheduleDecisions,
    selectedInterrupt,
    appendedEvents,
    executionPlan
  );
  const visibleUpdate = buildVisibleUpdate(
    input,
    executionPlan,
    scheduleDecisions,
    selectedInterrupt
  );
  const playerLoopFrame = buildPlayerLoopFrame(
    {
      ...playerStepContext,
      runMode: runModeBefore
    },
    input.playerCommand.parsedAction
  );
  const interruptCandidates = effectiveEventWindow.events
    .filter((event) => event.heatLevel === "interrupt")
    .map((event) => event.eventId);
  const mismatchNote =
    input.playerCommand.consumesTick !== actionPolicy.consumesTick
      ? [
          `command envelope consumesTick=${String(
            input.playerCommand.consumesTick
          )} overridden by action policy`
        ]
      : [];

  const debugSummary: SimulationDebugSummary = {
    worldTick: advancedToTick,
    runModeBefore,
    runModeAfter: runModeAfterTick,
    promotedNpcIds: [...scheduleDecisions.nearFieldEscalatedNpcIds],
    suppressedNpcIds: [...scheduleDecisions.deferredFarFieldNpcIds],
    interruptCandidates,
    selectedInterruptReason: executionPlan.interruptPlan?.reason,
    budgetNotes: [
      `foreground full budget=${scheduleDecisions.foregroundFullNpcIds.length}/2`,
      `near field selected=${
        scheduleDecisions.nearFieldLightNpcIds.length +
        scheduleDecisions.nearFieldEscalatedNpcIds.length
      }/1`,
      ...mismatchNote
    ]
  };

  eventFlow.push({
    kind: "tick.settled",
    worldTick: advancedToTick,
    appendedEventIds: appendedEvents.map((event) => event.eventId),
    resultingRunMode: runModeAfterTick
  });

  return {
    advancedToTick,
    resolvedRunMode: runModeAfterTick,
    actionPolicy,
    playerLoopFrame,
    scheduleDecisions,
    executionPlan,
    visibleUpdate,
    statePatches,
    debugSummary,
    appendedEvents,
    eventFlow
  };
}
