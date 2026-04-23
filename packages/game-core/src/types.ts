import type {
  InterruptType,
  PlayerCommandEnvelope as ContractPlayerCommandEnvelope,
  PlannedNpcExecution,
  ScheduleDecisionSet,
  SimulationDebugSummary,
  SimulationRunMode,
  WorldEventRecord,
  WorldEventWindow
} from "@ai-western-town/contracts";

export type ActionClass =
  | "free_explore"
  | "investigate"
  | "intervene"
  | "travel"
  | "reposition"
  | "item";

export type WorldTickReason =
  | "no_tick"
  | "investigation_cost"
  | "social_intervention"
  | "windowed_travel"
  | "reposition_cost"
  | "item_direct_transfer"
  | "item_social_request"
  | "item_covert_operation"
  | "item_effect_trigger";

export type KnownItemResolutionMode =
  | "direct"
  | "social_request"
  | "covert"
  | "effect";

export type UrgencyTag = "none" | "windowed" | "critical";
export type SceneTier = "foreground" | "near_field" | "far_field";
export type CognitiveHeat = "active" | "background" | "cooling";
export type Availability = "available" | "busy" | "incapacitated" | "absent";
export type DialogueThreadStatus = "active" | "suspended" | "closed";
export type LongActionKind = "sleep" | "epiphany";
export type LongActionStatus = "entered" | "holding";
export type DistanceTier = "same" | "near" | "far";
export type PlayerInterruptType =
  | "forced_social_callout"
  | "imminent_escalation"
  | "critical_departure"
  | "closing_secret_window";
export type OpportunityType =
  | "observe_more"
  | "eavesdrop"
  | "approach"
  | "interrupt"
  | "follow"
  | "inspect"
  | "exit";
export type OpportunityResolutionMode = "atomic" | "short_scene";

export type GameCoreParsedPlayerAction =
  ContractPlayerCommandEnvelope["parsedAction"] & {
    actionId?: string;
    actionClass?: ActionClass;
    targetSceneId?: string;
    targetPartitionId?: string;
    targetNpcId?: string;
    targetObjectId?: string;
    urgencyTag?: UrgencyTag;
  };

export type PlayerCommandEnvelope = Omit<
  ContractPlayerCommandEnvelope,
  "parsedAction"
> & {
  parsedAction: GameCoreParsedPlayerAction;
};

export type VisibleObjectSlice = {
  objectId: string;
  label?: string;
  tags?: string[];
};

export type VisibleAnomalySlice = {
  anomalyId: string;
  summary: string;
  tags?: string[];
};

export type SurfacedOpportunity = {
  opportunityId: string;
  opportunityType: OpportunityType;
  leadText: string;
  sourceFindingIds: string[];
  resolutionMode: OpportunityResolutionMode;
};

export type PlayerStepContext = {
  currentSceneId: string;
  localSceneClusterId?: string;
  visibleNpcIds: string[];
  visibleObjects: VisibleObjectSlice[];
  visibleAnomalies: VisibleAnomalySlice[];
  availableSoftOpportunities: SurfacedOpportunity[];
  runMode: Exclude<SimulationRunMode, "settle">;
};

export type PlayerActionExecutionPolicy = {
  consumesTick: boolean;
  worldTickReason: WorldTickReason;
  resultingRunMode: SimulationRunMode;
};

export type PlayerContextSlice = {
  currentSceneId: string;
  currentMode: "free_explore" | "focused_dialogue";
  visibleNpcIds: string[];
  focusedNpcId?: string;
  statusTags: string[];
  recentPlayerActionIds: string[];
};

export type SceneGraphSlice = {
  currentSceneId: string;
  adjacentSceneIds: string[];
  travelEdges: {
    fromSceneId: string;
    toSceneId: string;
    distanceTier: DistanceTier;
  }[];
};

export type NPCScheduleState = {
  npcId: string;
  currentSceneId: string;
  sceneTier: SceneTier;
  scheduleHeat: number;
  cognitiveHeat: CognitiveHeat;
  lastFullTick?: number;
  lastLightTick?: number;
  boundDialogueThreadId?: string;
  interruptSensitivity: number;
  availability: Availability;
};

export type ActiveLongActionSnapshot = {
  npcId: string;
  actionId: string;
  actionKind: LongActionKind;
  status: LongActionStatus;
  enteredAtTick: number;
  expectedResolveAtTick?: number;
  boundSceneId?: string;
};

export type DialogueThreadState = {
  threadId: string;
  sceneId: string;
  anchorNpcId: string;
  participantNpcIds: string[];
  status: DialogueThreadStatus;
  startedAtTick: number;
  lastAdvancedAtTick: number;
};

export type PendingInterruptState = {
  eventId: string;
  interruptType: InterruptType;
  originSceneId: string;
  createdAtTick: number;
  priority: number;
};

export type FarFieldBacklogItem = {
  npcId: string;
  summaryTags: string[];
  accumulatedHeat: number;
  queuedAtTick: number;
  mustResolveByTick?: number;
};

export type PlannedPlayerExecution = {
  commandId: string;
  actionType: string;
  consumesTick: boolean;
  worldTickReason: WorldTickReason;
  resultingRunMode: SimulationRunMode;
  targetSceneId?: string;
  targetNpcId?: string;
};

export type PlannedInterruptExecution = {
  eventId: string;
  interruptType: InterruptType;
  originSceneId: string;
  reason: string;
};

export type SimulationExecutionPlan = {
  playerActionExecution: PlannedPlayerExecution;
  npcExecutions: PlannedNpcExecution[];
  interruptPlan?: PlannedInterruptExecution;
};

export type VisibleActionResult = {
  resultId: string;
  sourceCommandId: string;
  summary: string;
  tags: string[];
};

export type VisibleReactiveMoment = {
  npcId: string;
  reactionType: "observe" | "react" | "follow_up";
  summary: string;
};

export type VisibleInterruptPayload = {
  interruptId: string;
  interruptType: InterruptType;
  summary: string;
};

export type SceneMoodPatch = {
  sceneId: string;
  moodTags: string[];
};

export type PlayerVisibleWorldUpdate = {
  primarySceneId: string;
  visibleActionResults: VisibleActionResult[];
  reactiveMoments: VisibleReactiveMoment[];
  insertedInterrupt?: VisibleInterruptPayload;
  sceneMoodPatch?: SceneMoodPatch;
  worldHintLines: string[];
};

export type NPCSchedulePatch = {
  npcId: string;
  sceneTier?: SceneTier;
  scheduleHeat?: number;
  lastFullTick?: number;
  lastLightTick?: number;
};

export type ActiveLongActionRuntimePatch = {
  upserts: ActiveLongActionSnapshot[];
  removeNpcIds: string[];
};

export type NearFieldQueuePatch = {
  promotedNpcIds: string[];
  deferredNpcIds: string[];
};

export type FarFieldBacklogPatch = {
  upserts: FarFieldBacklogItem[];
  removedNpcIds: string[];
};

export type SimulationStatePatchSet = {
  nextDialogueThread?: DialogueThreadState;
  nextPendingInterrupt?: PendingInterruptState;
  npcSchedulePatches: NPCSchedulePatch[];
  activeLongActionPatch: ActiveLongActionRuntimePatch;
  nearFieldQueuePatch: NearFieldQueuePatch;
  farFieldBacklogPatch: FarFieldBacklogPatch;
  appendedEventIds: string[];
};

export type WorldSimulationInput = {
  worldTick: number;
  playerCommand: PlayerCommandEnvelope;
  playerContext: PlayerContextSlice;
  sceneGraph: SceneGraphSlice;
  npcScheduleStates: NPCScheduleState[];
  activeLongActions: ActiveLongActionSnapshot[];
  recentEventWindow: WorldEventWindow;
  activeDialogueThread?: DialogueThreadState;
  pendingInterrupt?: PendingInterruptState;
  farFieldBacklog: FarFieldBacklogItem[];
};

export type SimulationEventFlowEntry =
  | {
      kind: "command.received";
      worldTick: number;
      commandId: string;
      consumesTick: boolean;
      worldTickReason: WorldTickReason;
    }
  | {
      kind: "tick.advanced";
      fromTick: number;
      toTick: number;
      runModeBefore: SimulationRunMode;
      runModeAfter: SimulationRunMode;
    }
  | {
      kind: "scheduler.decided";
      worldTick: number;
      scheduleDecisions: ScheduleDecisionSet;
      npcExecutions: PlannedNpcExecution[];
    }
  | {
      kind: "interrupt.selected";
      worldTick: number;
      interruptId: string;
      interruptType: InterruptType;
      reason: string;
    }
  | {
      kind: "tick.settled";
      worldTick: number;
      appendedEventIds: string[];
      resultingRunMode: SimulationRunMode;
    };

export type WorldSimulationResult = {
  advancedToTick: number;
  resolvedRunMode: SimulationRunMode;
  actionPolicy: PlayerActionExecutionPolicy;
  scheduleDecisions: ScheduleDecisionSet;
  executionPlan: SimulationExecutionPlan;
  visibleUpdate: PlayerVisibleWorldUpdate;
  statePatches: SimulationStatePatchSet;
  debugSummary: SimulationDebugSummary;
  appendedEvents: WorldEventRecord[];
  eventFlow: SimulationEventFlowEntry[];
};

export type InterruptEvaluationInput = {
  currentSceneId: string;
  visibleEventCandidates: WorldEventRecord[];
  activeDialogueThreadId?: string;
  currentStepResolved: boolean;
};

export type InterruptEvaluationResult = {
  selectedInterrupt?: {
    interruptId: string;
    interruptType: PlayerInterruptType;
    reason: string;
  };
  deferredSoftOpportunities: SurfacedOpportunity[];
};
