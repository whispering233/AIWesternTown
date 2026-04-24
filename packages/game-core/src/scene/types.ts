import type { WorldEventWindow } from "@ai-western-town/contracts";

export const IMPLICIT_SCENE_PARTITION_ID = "scene_default";

export type VisualRelation = "clear" | "partial" | "blocked";
export type AudioRelation = "clear" | "muffled" | "blocked";
export type NoticeRelation = "easy" | "normal" | "hard";
export type MovementCost = "free" | "light" | "committed";
export type TransitionStyle =
  | "open"
  | "through_crowd"
  | "through_threshold"
  | "edge_slide";
export type FallbackMode = "partitioned" | "scene_default";

export type ScenePartition = {
  partitionId: string;
  sceneId: string;
  displayName: string;
  publicLabel: string;
  partitionKind:
    | "entry"
    | "social"
    | "service"
    | "private_edge"
    | "transition";
  playerVisible: boolean;
  defaultPlayerAccess: "open" | "contextual" | "hidden";
  capacityTier: "tight" | "medium" | "open";
  exposureProfile: {
    visibilityExposure: "low" | "medium" | "high";
    audibilityExposure: "low" | "medium" | "high";
  };
  tags: string[];
};

export type PartitionLink = {
  fromPartitionId: string;
  toPartitionId: string;
  movementCost: MovementCost;
  visualRelation: VisualRelation;
  audioRelation: AudioRelation;
  noticeRelation: NoticeRelation;
  transitionStyle: TransitionStyle;
  tags: string[];
};

export type ScenePartitionGraph = {
  sceneId: string;
  defaultPlayerPartitionId: string;
  partitions: ScenePartition[];
  links: PartitionLink[];
};

export type SceneTopologyReadResult = {
  sceneId: string;
  graph: ScenePartitionGraph;
  fallbackMode: FallbackMode;
  issues: string[];
};

export type PartitionRelation = {
  fromPartitionId: string;
  toPartitionId: string;
  visualRelation: VisualRelation;
  audioRelation: AudioRelation;
  noticeRelation: NoticeRelation;
  movementCost?: MovementCost;
  pathLength: 0 | 1 | 2 | null;
  derived: boolean;
  reachable: boolean;
};

export type PartitionLocator = {
  npcId: string;
  partitionId?: string;
};

export type VisibleObjectLocator = {
  objectId: string;
  partitionId?: string;
};

export type PlayerPartitionOption = {
  partitionId: string;
  label: string;
  moveHint?: string;
  visualRelation: VisualRelation;
  audioRelation: AudioRelation;
  noticeRelation: NoticeRelation;
};

export type PlayerPartitionProjection = {
  currentPartitionId: string;
  visiblePartitionOptions: PlayerPartitionOption[];
  spatialSummaryLines: string[];
  fallbackMode: FallbackMode;
};

export type PartitionPerceptionRelation = {
  targetId: string;
  targetType: "npc" | "object" | "partition";
  partitionId: string;
  visualRelation: VisualRelation;
  audioRelation: AudioRelation;
  noticeRelation: NoticeRelation;
};

export type PartitionOpportunityHint = {
  partitionId: string;
  opportunityType: "observe_more" | "eavesdrop" | "approach";
  reason: string;
};

export type SceneVisibilityContext = {
  sceneId: string;
  sceneTopology?: ScenePartitionGraph | null;
  playerPartitionId?: string;
  activeNpcPartitions?: PartitionLocator[];
  visibleObjects?: VisibleObjectLocator[];
};

export type SceneVisibilityProjection = {
  playerProjection: PlayerPartitionProjection;
  playerToNpcRelations: PartitionPerceptionRelation[];
  objectRelations: PartitionPerceptionRelation[];
  partitionOpportunityHints: PartitionOpportunityHint[];
};

export type PlayerToNpcPartitionRelation = {
  npcId: string;
  partitionId: string;
  visualRelation: VisualRelation;
  audioRelation: AudioRelation;
  noticeRelation: NoticeRelation;
};

export type NpcToNpcPartitionRelation = {
  sourceNpcId: string;
  sourcePartitionId: string;
  targetNpcId: string;
  targetPartitionId: string;
  visualRelation: VisualRelation;
  audioRelation: AudioRelation;
  noticeRelation: NoticeRelation;
};

export type PartitionPerceptionSlice = {
  playerProjection: PlayerPartitionProjection;
  playerToNpcRelations: PlayerToNpcPartitionRelation[];
  npcToNpcRelations: NpcToNpcPartitionRelation[];
};

export type PartitionAwarePerceiveInput = {
  npcId: string;
  currentSceneId: string;
  currentPartitionId: string;
  partitionSlice: PartitionPerceptionSlice;
  recentEventWindow?: WorldEventWindow;
};

export type PartitionRepositionPolicy = {
  consumesTick: boolean;
  noticeRisk: NoticeRelation;
  reachable: boolean;
  movementCost?: MovementCost;
};
