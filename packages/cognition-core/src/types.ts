import type {
  JsonValue,
  PlannedNpcExecution,
  WorldEventRecord,
  WorldEventWindow
} from "@ai-western-town/contracts";

export type RawObservationType =
  | "speech"
  | "action"
  | "presence"
  | "event"
  | "clue";

export type WorkingMemoryStatus = "active" | "latent" | "resolved";
export type WorkingMemoryKind =
  | "concern"
  | "goal"
  | "threat"
  | "opportunity"
  | "player_model"
  | "observation";

export type WorkingMemoryItem = {
  wmId: string;
  kind: WorkingMemoryKind;
  summary: string;
  status: WorkingMemoryStatus;
  priority: number;
  relatedActorIds: string[];
  relatedGoalIds: string[];
  sourceObservationIds: string[];
  sourceMemoryIds: string[];
  tags: string[];
};

export type NPCWorkingMemory = {
  items: WorkingMemoryItem[];
  activeConcernIds: string[];
  activeIntent?: string;
  capacity: number;
  lastUpdatedAt: number;
};

export type ActorSnapshot = {
  actorId: string;
  displayName?: string;
  summary?: string;
  tags?: string[];
};

export type ActionSnapshot = {
  actionId: string;
  actionType: string;
  actorId: string;
  targetIds?: string[];
  summary: string;
  visibility?: "public" | "semi_public" | "private";
  tags?: string[];
};

export type DialogueSnippet = {
  snippetId: string;
  speakerId: string;
  targetActorIds?: string[];
  text: string;
  tags?: string[];
};

export type ClueSnapshot = {
  clueId: string;
  summary: string;
  actorIds?: string[];
  targetIds?: string[];
  tags?: string[];
  anomalyScore?: number;
};

export type PlayerActionSlice = {
  actionId: string;
  actionType: string;
  summary: string;
  targetActorIds?: string[];
  targetObjectIds?: string[];
  tags?: string[];
};

export type ObservableWorldSlice = {
  sceneId: string;
  tick: number;
  visibleActors: ActorSnapshot[];
  visibleActions: ActionSnapshot[];
  dialogueSnippets: DialogueSnippet[];
  visibleClues: ClueSnapshot[];
  recentLocalEvents: WorldEventRecord[];
  playerAction?: PlayerActionSlice;
};

export type RelationEdge = {
  actorId: string;
  trust: number;
  fear: number;
  suspicion: number;
  usefulness: number;
  recentChange?: number;
};

export type SocialContextSlice = {
  sceneId: string;
  relationEdges: RelationEdge[];
};

export type RetrievedMemoryItem = {
  memoryId: string;
  kind: "episodic" | "social" | "player_model" | "clue";
  summary: string;
  importance: number;
  lastAccessedTick?: number;
  relatedActorIds?: string[];
  relatedClueIds?: string[];
  relatedEventIds?: string[];
  tags?: string[];
};

export type RetrievedMemorySlice = {
  memoryItems: RetrievedMemoryItem[];
};

export type PartitionPerceptionSlice = {
  visibleActorIds?: string[];
  audibleActorIds?: string[];
  visibleClueIds?: string[];
  perceptionTags?: string[];
};

export type PartitionAwarePerceiveInput = {
  npcId: string;
  currentSceneId: string;
  currentPartitionId?: string;
  partitionSlice: PartitionPerceptionSlice;
  recentEventWindow: WorldEventWindow;
};

export type PerceivedItem = {
  observationId: string;
  rawType: RawObservationType;
  rawContent: string;
  sceneId: string;
  tick: number;
  actorIds: string[];
  targetIds: string[];
  salience: number;
  attentionReasonTags: string[];
  linkedMemoryIds: string[];
  linkedConcernIds: string[];
};

export type PerceiveDebugMeta = {
  rawCount: number;
  filteredCount: number;
  finalCount: number;
};

export type PerceiveInput = {
  observableWorldSlice: ObservableWorldSlice;
  workingMemory: NPCWorkingMemory;
  socialContextSlice: SocialContextSlice;
  retrievedMemorySlice: RetrievedMemorySlice;
  partitionAwareInput: PartitionAwarePerceiveInput;
};

export type PerceiveResult = {
  perceivedItems: PerceivedItem[];
  debugMeta: PerceiveDebugMeta;
};

export type GoalSummary = {
  goalId: string;
  summary: string;
  priority: number;
  tags?: string[];
};

export type NPCIdentitySlice = {
  npcId: string;
  role: string;
  publicPersona: string;
  hiddenSecrets: string[];
  longTermGoals: GoalSummary[];
  taboos: string[];
  coreDrives: string[];
};

export type CurrentGoalState = {
  activeGoalIds: string[];
  pendingGoalIds: string[];
  blockedGoalIds: string[];
};

export type SocialBeliefSlice = {
  relatedActors: {
    actorId: string;
    trust: number;
    fear: number;
    suspicion: number;
    dependency: number;
    usefulness: number;
  }[];
};

export type RetrievedBelief = {
  memoryId: string;
  summary: string;
  kind: "episodic" | "social" | "player_model" | "clue";
  importance: number;
  retrievalReasonTags?: string[];
  relatedActorIds?: string[];
  tags?: string[];
};

export type RetrievedBeliefSlice = {
  beliefs: RetrievedBelief[];
};

export type IdentityTensionItem = {
  tensionId: string;
  kind:
    | "loyalty"
    | "self_image"
    | "fear"
    | "obsession"
    | "attachment"
    | "moral_strain";
  summary: string;
  targetActorIds: string[];
  intensity: number;
  direction: "rising" | "stable" | "fading";
  introducedAtTick: number;
  lastUpdatedAtTick: number;
};

export type IdentityEvolutionSlice = {
  npcId: string;
  currentSelfNarrative?: string;
  activeIdentityTensions: IdentityTensionItem[];
  reinforcedDriftTags: string[];
  lastDeepProcessedAtTick?: number;
};

export type WorkingMemoryRecommendation =
  | "must_store"
  | "store_if_space"
  | "log_only"
  | "discard";

export type AppraisalResult = {
  observationId: string;
  relevance: number;
  threat: number;
  opportunity: number;
  socialRisk: number;
  anomaly: number;
  emotionalCharge: number;
  certainty: number;
  inferredIntentTags: string[];
  affectedGoalIds: string[];
  affectedActorIds: string[];
  workingMemoryRecommendation: WorkingMemoryRecommendation;
  appraisalSummary: string;
};

export type AppraiseDebugMeta = {
  llmRefined: false;
  evaluatedCount: number;
};

export type AppraiseInput = {
  perceivedItems: PerceivedItem[];
  identitySlice: NPCIdentitySlice;
  currentGoalState: CurrentGoalState;
  socialBeliefSlice: SocialBeliefSlice;
  retrievedBeliefSlice: RetrievedBeliefSlice;
  identityEvolutionSlice?: IdentityEvolutionSlice;
};

export type AppraiseResult = {
  appraisalResults: AppraisalResult[];
  debugMeta: AppraiseDebugMeta;
};

export type ItemActionType =
  | "pick_up"
  | "drop"
  | "put_into_container"
  | "take_from_container"
  | "give"
  | "request"
  | "steal"
  | "plant_back"
  | "use_item";

export type NpcActionType =
  | "speak"
  | "move"
  | "observe"
  | "use_item"
  | "interact"
  | "wait";

export type ActionCandidate = {
  actionId: string;
  actionType: NpcActionType;
  itemActionType?: ItemActionType;
  verb: string;
  targetActorIds?: string[];
  targetObjectIds?: string[];
  targetLocationId?: string;
  visibility: "public" | "semi_public" | "private";
  cost: number;
  riskBase: number;
  preconditions: string[];
  blockedBy?: string[];
  tags: string[];
};

export type ActionAffordanceSet = {
  npcId: string;
  sceneId: string;
  tick: number;
  candidates: ActionCandidate[];
};

export type ActionSelectionSocialSlice = {
  presentActors: {
    actorId: string;
    trust: number;
    fear: number;
    suspicion: number;
    authority: number;
    leverage: number;
  }[];
  audienceSize: number;
  privacyLevel: "public" | "semi_public" | "private";
};

export type ActionPolicySlice = {
  forbiddenActionTags: string[];
  preferredActionTags: string[];
  deceptionTolerance: number;
  aggressionTolerance: number;
  interruptionSensitivity: number;
};

export type ActionSelectionResult = {
  chosenActionId: string;
  actionType: NpcActionType;
  itemActionType?: ItemActionType;
  verb: string;
  targetActorIds: string[];
  targetObjectIds: string[];
  targetLocationId?: string;
  visibility: "public" | "semi_public" | "private";
  executionMode: "immediate" | "queued" | "hold";
  styleTags: string[];
  expectedEffectTags: string[];
  riskScore: number;
  goalAlignment: number;
  confidence: number;
  fallbackActionIds: string[];
  selectionReason: string;
};

export type ActionSelectionInput = {
  npcId: string;
  tick: number;
  sceneId: string;
  workingMemory: NPCWorkingMemory;
  appraisalResults: AppraisalResult[];
  affordances: ActionAffordanceSet;
  socialSlice: ActionSelectionSocialSlice;
  policySlice: ActionPolicySlice;
};

export type StateMutation = {
  domain:
    | "npc_state"
    | "scene_state"
    | "object_state"
    | "relationship"
    | "conversation";
  targetId: string;
  operation: "set" | "add" | "remove" | "move" | "start" | "end";
  path: string;
  value?: JsonValue;
};

export type VisibleOutcomePayload = {
  narrationLine?: string;
  dialogueLine?: string;
  gestureTags: string[];
  observerActorIds: string[];
};

export type PrivateOutcomePayload = {
  concealedEffects: string[];
  hiddenEventIds: string[];
};

export type ActionExecutionResult = {
  executionId: string;
  sourceActionId: string;
  actorId: string;
  actionType: ActionSelectionResult["actionType"];
  itemActionType?: ItemActionType;
  outcome: "success" | "partial" | "blocked" | "failed";
  outcomeReasonTags: string[];
  consumedTick: number;
  stateMutations: StateMutation[];
  emittedEvents: WorldEventRecord[];
  visibleOutcome: VisibleOutcomePayload;
  privateOutcome?: PrivateOutcomePayload;
  shouldReflect: boolean;
  executionSummary: string;
};

export type ActInput = {
  npcId: string;
  tick: number;
  sceneId: string;
  selectionResult: ActionSelectionResult;
  availableActorIds: string[];
  availableObjectIds: string[];
  reachableLocationIds?: string[];
  blockedActionTags?: string[];
  observerActorIds?: string[];
  consumeTickByDefault?: number;
};

export type CognitionLiteInternalStage =
  | "perceive"
  | "appraise"
  | "action_selection"
  | "act";

export type CognitionLiteStageFlags = Record<CognitionLiteInternalStage, boolean>;

export type SchedulerBridgeMeta = {
  schedulerStages: PlannedNpcExecution["runStages"];
  internalStages: CognitionLiteInternalStage[];
  injectedStages: CognitionLiteInternalStage[];
  notes: string[];
};

export type CognitionLiteRunInput = {
  npcId: string;
  perceiveInput: PerceiveInput;
  appraiseInput?: Omit<AppraiseInput, "perceivedItems">;
  actionSelectionInput?: Omit<ActionSelectionInput, "appraisalResults">;
  actInput?: Omit<ActInput, "selectionResult">;
  plannedExecution?: PlannedNpcExecution;
};

export type CognitionLiteRunResult = {
  npcId: string;
  stageFlags: CognitionLiteStageFlags;
  schedulerBridge?: SchedulerBridgeMeta;
  perceive: PerceiveResult;
  appraise?: AppraiseResult;
  actionSelectionResult?: ActionSelectionResult;
  executionResult?: ActionExecutionResult;
};
