import { randomUUID } from "node:crypto";

import { starterTownContent } from "@ai-western-town/starter-town-content";
import type { StarterContentBundle, NpcContent } from "@ai-western-town/content-schema";
import type {
  PlayerCommandEnvelope,
  PlannedNpcExecution,
  ProviderRequest,
  TickTraceRecord,
  WorldEventRecord,
  WorldEventWindow
} from "@ai-western-town/contracts";
import {
  advanceWorldSimulation,
  getTargetNpcId,
  getTargetSceneId,
  type ActiveLongActionSnapshot,
  type DialogueThreadState,
  type FarFieldBacklogItem,
  type NPCScheduleState,
  type PendingInterruptState,
  type PlayerContextSlice,
  type SceneGraphSlice,
  type WorldSimulationInput
} from "@ai-western-town/game-core";
import {
  runNpcCognition,
  type ActionCandidate,
  type CognitionLiteRunInput,
  type NpcCognitionRunResult
} from "@ai-western-town/cognition-core";
import {
  buildVisibleOutcomeFallback,
  buildVisibleOutcomeRenderPromptSpec,
  createLLMCallRecorder,
  createLLMGateway,
  parseVisibleOutcomeRenderResult,
  type LLMCallRecord,
  type LLMCallRecorder,
  type LLMGateway,
  type LLMGatewayConfig,
  type VisibleOutcomeRenderPromptInput
} from "@ai-western-town/llm-runtime";

import { buildStarterTownPlayableSlice } from "./starter-town-player-loop.js";

export type StarterTownSessionState = {
  worldTick: number;
  currentSceneId: string;
  npcScheduleStates: NPCScheduleState[];
  activeLongActions: ActiveLongActionSnapshot[];
  recentEvents: WorldEventRecord[];
  activeDialogueThread?: DialogueThreadState;
  pendingInterrupt?: PendingInterruptState;
  farFieldBacklog: FarFieldBacklogItem[];
};

export type CreateStarterTownInitialStateOptions = {
  currentSceneId?: string;
};

export type StarterTownCommandResult = {
  nextState: StarterTownSessionState;
  worldEvents: WorldEventRecord[];
  tickTrace: TickTraceRecord;
  llmCalls: LLMCallRecord[];
};

export type StarterTownSessionRuntime = {
  createInitialState(
    options?: CreateStarterTownInitialStateOptions
  ): StarterTownSessionState;
  submitCommand(
    state: StarterTownSessionState,
    playerCommand: PlayerCommandEnvelope
  ): Promise<StarterTownCommandResult>;
  getRecentLLMCalls(): LLMCallRecord[];
};

export type CreateStarterTownSessionRuntimeOptions = {
  bundle?: StarterContentBundle;
  llmGateway?: LLMGateway;
  llmGatewayConfig?: LLMGatewayConfig;
  llmRecorder?: LLMCallRecorder;
  modelRef?: string;
  llmTimeoutMs?: number;
};

const DEFAULT_MODEL_REF = "gemma-4-e2b-uncensored-hauhaucs-aggressive";
const DEFAULT_LLM_TIMEOUT_MS = 10_000;
const DEFAULT_INITIAL_SCENE_ID = "hotel_lobby";
const MAX_RECENT_EVENTS = 30;

export function createStarterTownSessionRuntime(
  options: CreateStarterTownSessionRuntimeOptions = {}
): StarterTownSessionRuntime {
  const bundle = options.bundle ?? starterTownContent;
  const llmGateway =
    options.llmGateway ??
    createLLMGateway(
      options.llmGatewayConfig ?? {
        provider: "mock",
        mock: {
          rawText: '{"visibleText":"The room absorbs the move.","gestureTags":["plain"]}'
        }
      }
    );
  const llmRecorder = options.llmRecorder ?? createLLMCallRecorder();
  const modelRef = options.modelRef ?? DEFAULT_MODEL_REF;
  const timeoutMs = options.llmTimeoutMs ?? DEFAULT_LLM_TIMEOUT_MS;

  return {
    createInitialState(
      initialOptions: CreateStarterTownInitialStateOptions = {}
    ): StarterTownSessionState {
      const currentSceneId =
        initialOptions.currentSceneId ?? DEFAULT_INITIAL_SCENE_ID;

      return {
        worldTick: 0,
        currentSceneId,
        npcScheduleStates: createInitialNpcScheduleStates(bundle, currentSceneId),
        activeLongActions: [],
        recentEvents: [],
        farFieldBacklog: []
      };
    },

    async submitCommand(
      state: StarterTownSessionState,
      playerCommand: PlayerCommandEnvelope
    ): Promise<StarterTownCommandResult> {
      const simulation = advanceWorldSimulation(
        buildWorldSimulationInput(bundle, state, playerCommand)
      );
      const npcResults: NpcCognitionRunResult[] = [];
      const npcWorldEvents: WorldEventRecord[] = [];
      const llmTraceIds: string[] = [];

      for (const plannedExecution of simulation.executionPlan.npcExecutions) {
        const cognitionInput = buildNpcCognitionInput(
          bundle,
          state,
          playerCommand,
          plannedExecution,
          simulation.advancedToTick
        );
        const cognitionResult = runNpcCognition(cognitionInput);
        npcResults.push(cognitionResult);

        const execution = cognitionResult.lite.executionResult;
        if (!execution) {
          continue;
        }

        const renderResult = await renderVisibleOutcome({
          llmGateway,
          llmRecorder,
          modelRef,
          timeoutMs,
          worldTick: simulation.advancedToTick,
          npcId: plannedExecution.npcId,
          input: buildVisibleOutcomeInput(
            playerCommand,
            execution,
            simulation.appendedEvents
          )
        });
        llmTraceIds.push(renderResult.traceId);
        npcWorldEvents.push(
          ...execution.emittedEvents.map((event) => ({
            ...event,
            sourceCommandId: event.sourceCommandId ?? playerCommand.commandId,
            summary: renderResult.visibleText,
            payload: {
              ...(event.payload ?? {}),
              visibleText: renderResult.visibleText,
              gestureTags: renderResult.gestureTags ?? [],
              llmTraceId: renderResult.traceId
            }
          }))
        );
      }

      const worldEvents = [...simulation.appendedEvents, ...npcWorldEvents];
      const nextState = buildNextState(bundle, state, playerCommand, {
        advancedToTick: simulation.advancedToTick,
        npcScheduleStates: state.npcScheduleStates,
        activeLongActions: state.activeLongActions,
        recentEvents: [...state.recentEvents, ...worldEvents].slice(-MAX_RECENT_EVENTS),
        activeDialogueThread: simulation.statePatches.nextDialogueThread,
        pendingInterrupt: simulation.statePatches.nextPendingInterrupt,
        farFieldBacklog: applyFarFieldBacklogPatch(
          state.farFieldBacklog,
          simulation.statePatches.farFieldBacklogPatch
        )
      });
      const tickTrace: TickTraceRecord = {
        traceId: `trace-${simulation.advancedToTick}-${playerCommand.commandId}`,
        worldTick: simulation.advancedToTick,
        playerCommand,
        runModeBefore: simulation.debugSummary.runModeBefore,
        runModeAfter: simulation.debugSummary.runModeAfter,
        scheduleDecisions: simulation.scheduleDecisions,
        npcExecutions: simulation.executionPlan.npcExecutions,
        appendedEventIds: worldEvents.map((event) => event.eventId),
        llmTraceIds,
        debugSummary: {
          ...simulation.debugSummary,
          budgetNotes: [
            ...simulation.debugSummary.budgetNotes,
            `cognition_results=${npcResults.length}`,
            `llm_visible_renders=${llmTraceIds.length}`
          ]
        }
      };

      return {
        nextState,
        worldEvents,
        tickTrace,
        llmCalls: llmRecorder.getRecentCalls()
      };
    },

    getRecentLLMCalls(): LLMCallRecord[] {
      return llmRecorder.getRecentCalls();
    }
  };
}

function createInitialNpcScheduleStates(
  bundle: StarterContentBundle,
  currentSceneId: string
): NPCScheduleState[] {
  return bundle.npcs.map((npc) => ({
    npcId: npc.npcId,
    currentSceneId: npc.startSceneId,
    sceneTier: npc.startSceneId === currentSceneId ? "foreground" : "near_field",
    scheduleHeat: npc.startSceneId === currentSceneId ? 70 : 35,
    cognitiveHeat: npc.startSceneId === currentSceneId ? "active" : "background",
    interruptSensitivity: npc.tags.includes("authority") ? 0.8 : 0.5,
    availability: "available"
  }));
}

function buildWorldSimulationInput(
  bundle: StarterContentBundle,
  state: StarterTownSessionState,
  playerCommand: PlayerCommandEnvelope
): WorldSimulationInput {
  const playableSlice = buildStarterTownPlayableSlice(bundle, state.currentSceneId);
  const targetSceneId = getTargetSceneId(playerCommand.parsedAction);
  const nextPlayerStepContext = targetSceneId
    ? buildStarterTownPlayableSlice(bundle, targetSceneId).playerStepContext
    : undefined;

  return {
    worldTick: state.worldTick,
    playerCommand: playerCommand as WorldSimulationInput["playerCommand"],
    playerContext: buildPlayerContext(state, playableSlice.playerStepContext.visibleNpcIds),
    playerStepContext: playableSlice.playerStepContext,
    nextPlayerStepContext,
    sceneGraph: playableSlice.sceneGraph,
    npcScheduleStates: state.npcScheduleStates,
    activeLongActions: state.activeLongActions,
    recentEventWindow: buildRecentEventWindow(state),
    activeDialogueThread: state.activeDialogueThread,
    pendingInterrupt: state.pendingInterrupt,
    farFieldBacklog: state.farFieldBacklog
  };
}

function buildPlayerContext(
  state: StarterTownSessionState,
  visibleNpcIds: string[]
): PlayerContextSlice {
  return {
    currentSceneId: state.currentSceneId,
    currentMode:
      state.activeDialogueThread?.status === "active"
        ? "focused_dialogue"
        : "free_explore",
    visibleNpcIds,
    focusedNpcId: state.activeDialogueThread?.anchorNpcId,
    statusTags: [],
    recentPlayerActionIds: []
  };
}

function buildRecentEventWindow(state: StarterTownSessionState): WorldEventWindow {
  return {
    tickRange: {
      from: Math.max(0, state.worldTick - 10),
      to: state.worldTick
    },
    events: state.recentEvents.filter(
      (event) =>
        event.worldTick >= Math.max(0, state.worldTick - 10) &&
        event.worldTick <= state.worldTick
    )
  };
}

function buildNpcCognitionInput(
  bundle: StarterContentBundle,
  state: StarterTownSessionState,
  playerCommand: PlayerCommandEnvelope,
  plannedExecution: PlannedNpcExecution,
  tick: number
): CognitionLiteRunInput {
  const npc = requireNpc(bundle, plannedExecution.npcId);
  const playableSlice = buildStarterTownPlayableSlice(bundle, npc.startSceneId);
  const visibleNpcIds = playableSlice.playerStepContext.visibleNpcIds;
  const availableActorIds = ["player", ...visibleNpcIds];
  const playerCommandText = getPlayerCommandText(playerCommand);

  return {
    npcId: npc.npcId,
    plannedExecution,
    perceiveInput: {
      observableWorldSlice: {
        sceneId: npc.startSceneId,
        tick,
        visibleActors: visibleNpcIds.map((npcId) => {
          const visibleNpc = requireNpc(bundle, npcId);
          return {
            actorId: visibleNpc.npcId,
            displayName: visibleNpc.displayName,
            summary: visibleNpc.publicPersona,
            tags: [...visibleNpc.tags]
          };
        }),
        visibleActions: [],
        dialogueSnippets: [
          {
            snippetId: `${playerCommand.commandId}-snippet`,
            speakerId: "player",
            targetActorIds: getTargetNpcId(playerCommand.parsedAction)
              ? [getTargetNpcId(playerCommand.parsedAction) as string]
              : [npc.npcId],
            text: playerCommandText,
            tags: [...(playerCommand.parsedAction.tags ?? [])]
          }
        ],
        visibleClues: playableSlice.playerStepContext.visibleAnomalies.map(
          (anomaly) => ({
            clueId: anomaly.anomalyId,
            summary: anomaly.summary,
            tags: [...(anomaly.tags ?? [])],
            anomalyScore: 0.7
          })
        ),
        recentLocalEvents: state.recentEvents.filter(
          (event) => event.originSceneId === npc.startSceneId
        ),
        playerAction: {
          actionId: playerCommand.commandId,
          actionType:
            playerCommand.parsedAction.actionType ?? playerCommand.commandType,
          summary: playerCommandText,
          targetActorIds: getTargetNpcId(playerCommand.parsedAction)
            ? [getTargetNpcId(playerCommand.parsedAction) as string]
            : [],
          tags: [...(playerCommand.parsedAction.tags ?? [])]
        }
      },
      workingMemory: {
        items: [
          {
            wmId: `${npc.npcId}-wm-active-goal`,
            kind: "concern",
            summary: npc.shortTermGoals[0] ?? npc.coreDrives[0] ?? npc.publicPersona,
            status: "active",
            priority: 0.8,
            relatedActorIds: ["player"],
            relatedGoalIds: [`${npc.npcId}-goal-0`],
            sourceObservationIds: [],
            sourceMemoryIds: [],
            tags: [...npc.tags]
          }
        ],
        activeConcernIds: [`${npc.npcId}-wm-active-goal`],
        capacity: 5,
        lastUpdatedAt: Math.max(0, tick - 1)
      },
      socialContextSlice: {
        sceneId: npc.startSceneId,
        relationEdges: buildRelationEdges(availableActorIds)
      },
      retrievedMemorySlice: {
        memoryItems: [
          {
            memoryId: `${npc.npcId}-mem-player-pattern`,
            kind: "player_model",
            summary: "The player asks pointed questions in public spaces.",
            importance: 0.7,
            relatedActorIds: ["player"],
            tags: ["player", "probe", "public"]
          }
        ]
      },
      partitionAwareInput: {
        npcId: npc.npcId,
        currentSceneId: npc.startSceneId,
        partitionSlice: {
          visibleActorIds: availableActorIds,
          audibleActorIds: availableActorIds,
          perceptionTags: ["starter-town"]
        },
        recentEventWindow: buildRecentEventWindow(state)
      }
    },
    appraiseInput: {
      identitySlice: {
        npcId: npc.npcId,
        role: npc.role,
        publicPersona: npc.publicPersona,
        hiddenSecrets: [],
        longTermGoals: npc.coreDrives.map((drive, index) => ({
          goalId: `${npc.npcId}-drive-${index}`,
          summary: drive,
          priority: 0.7,
          tags: [...npc.tags]
        })),
        taboos: ["public_confession"],
        coreDrives: [...npc.coreDrives]
      },
      currentGoalState: {
        activeGoalIds: npc.coreDrives.map((_, index) => `${npc.npcId}-drive-${index}`),
        pendingGoalIds: [],
        blockedGoalIds: []
      },
      socialBeliefSlice: {
        relatedActors: buildRelationEdges(availableActorIds).map((edge) => ({
          actorId: edge.actorId,
          trust: edge.trust,
          fear: edge.fear,
          suspicion: edge.suspicion,
          dependency: 0.2,
          usefulness: edge.usefulness
        }))
      },
      retrievedBeliefSlice: {
        beliefs: [
          {
            memoryId: `${npc.npcId}-belief-player-pressure`,
            summary: "The player may be testing how locals react under public pressure.",
            kind: "player_model",
            importance: 0.7,
            relatedActorIds: ["player"],
            tags: ["probe", "public"]
          }
        ]
      }
    },
    actionSelectionInput: {
      npcId: npc.npcId,
      tick,
      sceneId: npc.startSceneId,
      workingMemory: {
        items: [],
        activeConcernIds: [`${npc.npcId}-wm-active-goal`],
        capacity: 5,
        lastUpdatedAt: Math.max(0, tick - 1)
      },
      affordances: {
        npcId: npc.npcId,
        sceneId: npc.startSceneId,
        tick,
        candidates: buildActionCandidates(npc, playerCommand)
      },
      socialSlice: {
        presentActors: buildRelationEdges(availableActorIds).map((edge) => ({
          actorId: edge.actorId,
          trust: edge.trust,
          fear: edge.fear,
          suspicion: edge.suspicion,
          authority: edge.actorId.includes("sheriff") ? 0.9 : 0.2,
          leverage: edge.usefulness
        })),
        audienceSize: availableActorIds.length,
        privacyLevel: "public"
      },
      policySlice: {
        forbiddenActionTags: ["public_confession"],
        preferredActionTags: ["deflect", "cover", "service", "observe"],
        deceptionTolerance: 0.7,
        aggressionTolerance: 0.2,
        interruptionSensitivity: 0.7
      }
    },
    actInput: {
      npcId: npc.npcId,
      tick,
      sceneId: npc.startSceneId,
      availableActorIds,
      availableObjectIds: playableSlice.playerStepContext.visibleObjects.map(
        (object) => object.objectId
      ),
      reachableLocationIds: playableSlice.sceneGraph.adjacentSceneIds,
      observerActorIds: availableActorIds,
      consumeTickByDefault: 1
    }
  };
}

function buildActionCandidates(
  npc: NpcContent,
  playerCommand: PlayerCommandEnvelope
): ActionCandidate[] {
  const targetNpcId = getTargetNpcId(playerCommand.parsedAction);
  const isTargeted = targetNpcId === npc.npcId;

  return [
    {
      actionId: `${npc.npcId}-answer-guarded`,
      actionType: "speak",
      verb: isTargeted ? "keeps the answer guarded" : "keeps watch from the edge",
      targetActorIds: ["player"],
      visibility: "public",
      cost: 2,
      riskBase: isTargeted ? 0.35 : 0.2,
      preconditions: [],
      tags: ["deflect", "cover", "discreet", ...npc.tags]
    },
    {
      actionId: `${npc.npcId}-observe-room`,
      actionType: "observe",
      verb: "watches the room",
      visibility: "public",
      cost: 1,
      riskBase: 0.1,
      preconditions: [],
      tags: ["observe", ...npc.tags]
    },
    {
      actionId: `${npc.npcId}-wait`,
      actionType: "wait",
      verb: "waits",
      visibility: "public",
      cost: 1,
      riskBase: 0.05,
      preconditions: [],
      tags: ["hold"]
    }
  ];
}

async function renderVisibleOutcome(input: {
  llmGateway: LLMGateway;
  llmRecorder: LLMCallRecorder;
  modelRef: string;
  timeoutMs: number;
  worldTick: number;
  npcId: string;
  input: VisibleOutcomeRenderPromptInput;
}): Promise<{
  traceId: string;
  visibleText: string;
  gestureTags?: string[];
}> {
  const fallback = buildVisibleOutcomeFallback(input.input);
  const spec = buildVisibleOutcomeRenderPromptSpec(input.input, {
    traceTags: ["starter-town", input.npcId]
  });
  const request: ProviderRequest = {
    requestId: `llm-req-${randomUUID()}`,
    taskKind: spec.taskKind,
    mode: spec.providerHints?.mode ?? "render",
    modelRef: input.modelRef,
    messages: compilePromptMessages(spec),
    responseFormat: "json_object",
    maxInputTokens: spec.inputBudgetTokens,
    maxOutputTokens: spec.outputBudgetTokens,
    temperature: spec.providerHints?.temperature ?? 0.2,
    topP: spec.providerHints?.topP,
    timeoutMs: input.timeoutMs
  };
  const response = await input.llmRecorder.recordInvocation(
    {
      request,
      stageName: spec.stageName,
      invocationDecision: "authorized_and_needed",
      worldTick: input.worldTick,
      npcId: input.npcId,
      builderName: spec.debugMeta.builderName,
      budgetLevel: spec.budgetLevel,
      tags: spec.debugMeta.traceTags,
      metadata: {
        sourceStage: spec.debugMeta.sourceStage
      }
    },
    (providerRequest) => input.llmGateway.invoke(providerRequest)
  );
  const recentCall = input.llmRecorder
    .getRecentCalls()
    .find((record) => record.requestId === request.requestId);
  const traceId = recentCall?.traceId ?? `llm-trace-${request.requestId}`;

  if (response.finishReason === "error" || response.finishReason === "timeout") {
    return {
      traceId,
      visibleText: fallback.visibleText,
      gestureTags: fallback.gestureTags
    };
  }

  const parsed = parseVisibleOutcomeRenderResult(response.rawText, {
    fallback,
    guard: {
      maxVisibleTextChars: input.input.maxVisibleTextChars,
      allowedGestureTags: buildAllowedGestureTags(input.input)
    }
  });

  if (parsed.ok) {
    return {
      traceId,
      visibleText: parsed.value.visibleText,
      gestureTags: parsed.value.gestureTags
    };
  }

  return {
    traceId,
    visibleText: parsed.fallback.visibleText,
    gestureTags: parsed.fallback.gestureTags
  };
}

function compilePromptMessages(spec: ReturnType<typeof buildVisibleOutcomeRenderPromptSpec>) {
  return (["system", "user", "assistant"] as const)
    .map((role) => ({
      role,
      blocks: spec.blocks.filter((block) => block.role === role)
    }))
    .filter((entry) => entry.blocks.length > 0)
    .map((entry) => ({
      role: entry.role,
      content: entry.blocks
        .map((block) => `[${block.key}]\n${block.content}`)
        .join("\n\n")
    }));
}

function buildVisibleOutcomeInput(
  playerCommand: PlayerCommandEnvelope,
  execution: NonNullable<NpcCognitionRunResult["lite"]["executionResult"]>,
  playerEvents: WorldEventRecord[]
): VisibleOutcomeRenderPromptInput {
  const safeStyleTags = uniqueStrings([
    ...execution.visibleOutcome.gestureTags,
    "guarded",
    "plain",
    "calm",
    "discreet",
    "defensive",
    "open"
  ]);

  return {
    executionId: execution.executionId,
    actorId: execution.actorId,
    actionType: execution.actionType,
    outcome: execution.outcome,
    outcomeReasonTags: [...execution.outcomeReasonTags],
    executionSummary: execution.executionSummary,
    resolvedFacts: [
      execution.executionSummary,
      ...execution.emittedEvents.map((event) => event.summary ?? event.eventType),
      ...playerEvents.map((event) => event.summary ?? event.eventType),
      `Player command: ${getPlayerCommandText(playerCommand)}`
    ],
    visibleOutcome: execution.visibleOutcome,
    audience: {
      observerActorIds: [...execution.visibleOutcome.observerActorIds],
      perspective: "player-visible starter town outcome",
      scenePrivacy: "public"
    },
    styleTags: safeStyleTags,
    toneTags: ["plain", "western"],
    maxVisibleTextChars: 180,
    fallbackVisibleText:
      execution.visibleOutcome.dialogueLine ??
      execution.visibleOutcome.narrationLine ??
      execution.executionSummary
  };
}

function buildAllowedGestureTags(
  input: VisibleOutcomeRenderPromptInput
): string[] {
  return uniqueStrings([
    ...input.visibleOutcome.gestureTags,
    ...input.styleTags,
    ...(input.toneTags ?? [])
  ]);
}

function buildNextState(
  bundle: StarterContentBundle,
  currentState: StarterTownSessionState,
  playerCommand: PlayerCommandEnvelope,
  partial: Omit<StarterTownSessionState, "worldTick" | "currentSceneId">
    & { advancedToTick: number }
): StarterTownSessionState {
  const targetSceneId = getTargetSceneId(playerCommand.parsedAction);
  const nextSceneId = targetSceneId ?? currentState.currentSceneId;

  return {
    worldTick: partial.advancedToTick,
    currentSceneId: nextSceneId,
    npcScheduleStates: applyNpcSchedulePatches(
      partial.npcScheduleStates.map((state) => ({
        ...state,
        sceneTier:
          state.currentSceneId === nextSceneId
            ? "foreground"
            : isAdjacentScene(bundle, nextSceneId, state.currentSceneId)
              ? "near_field"
              : "far_field"
      })),
      []
    ),
    activeLongActions: partial.activeLongActions,
    recentEvents: partial.recentEvents,
    activeDialogueThread: partial.activeDialogueThread,
    pendingInterrupt: partial.pendingInterrupt,
    farFieldBacklog: partial.farFieldBacklog
  };
}

function applyNpcSchedulePatches(
  states: NPCScheduleState[],
  patches: {
    npcId: string;
    sceneTier?: NPCScheduleState["sceneTier"];
    scheduleHeat?: number;
    lastFullTick?: number;
    lastLightTick?: number;
  }[]
): NPCScheduleState[] {
  return states.map((state) => {
    const patch = patches.find((entry) => entry.npcId === state.npcId);

    return patch
      ? {
          ...state,
          ...patch
        }
      : state;
  });
}

function applyFarFieldBacklogPatch(
  backlog: FarFieldBacklogItem[],
  patch: {
    upserts: FarFieldBacklogItem[];
    removedNpcIds: string[];
  }
): FarFieldBacklogItem[] {
  const removed = new Set(patch.removedNpcIds);
  const next = new Map(
    backlog
      .filter((item) => !removed.has(item.npcId))
      .map((item) => [item.npcId, item])
  );

  for (const item of patch.upserts) {
    next.set(item.npcId, item);
  }

  return [...next.values()];
}

function isAdjacentScene(
  bundle: StarterContentBundle,
  sceneId: string,
  candidateSceneId: string
): boolean {
  const scene = bundle.scenes.find((entry) => entry.sceneId === sceneId);

  return (
    scene?.connections.some((connection) => connection.toSceneId === candidateSceneId) ??
    false
  );
}

function buildRelationEdges(actorIds: string[]) {
  return actorIds.map((actorId) => ({
    actorId,
    trust: actorId === "player" ? 0.35 : 0.5,
    fear: actorId.includes("sheriff") ? 0.6 : 0.2,
    suspicion: actorId === "player" ? 0.65 : 0.35,
    usefulness: actorId === "player" ? 0.4 : 0.5
  }));
}

function requireNpc(bundle: StarterContentBundle, npcId: string): NpcContent {
  const npc = bundle.npcs.find((entry) => entry.npcId === npcId);

  if (!npc) {
    throw new Error(`Unknown starter town npc: ${npcId}`);
  }

  return npc;
}

function getPlayerCommandText(playerCommand: PlayerCommandEnvelope): string {
  return typeof playerCommand.metadata?.commandText === "string"
    ? playerCommand.metadata.commandText
    : playerCommand.commandType;
}

function uniqueStrings(values: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (value && !seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }

  return result;
}
