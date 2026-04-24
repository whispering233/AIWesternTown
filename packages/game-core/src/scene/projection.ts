import {
  type PartitionAwarePerceiveInput,
  type PartitionLocator,
  type PartitionPerceptionRelation,
  type PartitionPerceptionSlice,
  type PartitionRelation,
  type PlayerPartitionProjection,
  type PlayerPartitionOption,
  type ScenePartitionGraph,
  type SceneVisibilityContext,
  type SceneVisibilityProjection,
  type VisibleObjectLocator
} from "./types.js";
import {
  derivePartitionRelation,
  readScenePartitionGraph
} from "./graph.js";
import type {
  NpcToNpcPartitionRelation,
  PlayerToNpcPartitionRelation
} from "./types.js";

function buildMoveHint(relation: PartitionRelation): string | undefined {
  if (!relation.reachable || relation.pathLength === null) {
    return undefined;
  }

  if (relation.pathLength === 1) {
    return relation.movementCost === "committed"
      ? "requires a committed move"
      : "reachable from here";
  }

  return "reachable with an extra shift";
}

function asPartitionRelation(
  targetId: string,
  targetType: PartitionPerceptionRelation["targetType"],
  partitionId: string,
  relation: PartitionRelation
): PartitionPerceptionRelation {
  return {
    targetId,
    targetType,
    partitionId,
    visualRelation: relation.visualRelation,
    audioRelation: relation.audioRelation,
    noticeRelation: relation.noticeRelation
  };
}

function toPlayerToNpcRelation(
  npcId: string,
  partitionId: string,
  relation: PartitionRelation
): PlayerToNpcPartitionRelation {
  return {
    npcId,
    partitionId,
    visualRelation: relation.visualRelation,
    audioRelation: relation.audioRelation,
    noticeRelation: relation.noticeRelation
  };
}

function toNpcToNpcRelation(
  source: PartitionLocator,
  sourcePartitionId: string,
  target: PartitionLocator,
  targetPartitionId: string,
  relation: PartitionRelation
): NpcToNpcPartitionRelation {
  return {
    sourceNpcId: source.npcId,
    sourcePartitionId,
    targetNpcId: target.npcId,
    targetPartitionId,
    visualRelation: relation.visualRelation,
    audioRelation: relation.audioRelation,
    noticeRelation: relation.noticeRelation
  };
}

function sortPartitionOptions(
  left: PlayerPartitionOption,
  right: PlayerPartitionOption
): number {
  const visualWeight = {
    clear: 2,
    partial: 1,
    blocked: 0
  } as const;
  const audioWeight = {
    clear: 2,
    muffled: 1,
    blocked: 0
  } as const;
  const leftScore = visualWeight[left.visualRelation] + audioWeight[left.audioRelation];
  const rightScore =
    visualWeight[right.visualRelation] + audioWeight[right.audioRelation];

  if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }

  return left.label.localeCompare(right.label);
}

export function buildPlayerPartitionProjection(
  sceneId: string,
  sceneTopology: ScenePartitionGraph | null | undefined,
  currentPartitionId?: string
): PlayerPartitionProjection {
  const topology = readScenePartitionGraph(sceneId, sceneTopology);
  const resolvedCurrentPartitionId =
    currentPartitionId &&
    topology.graph.partitions.some(
      (partition) => partition.partitionId === currentPartitionId
    )
      ? currentPartitionId
      : topology.graph.defaultPlayerPartitionId;

  const visiblePartitionOptions = topology.graph.partitions
    .filter((partition) => partition.partitionId !== resolvedCurrentPartitionId)
    .filter((partition) => partition.playerVisible)
    .map((partition) => {
      const relation = derivePartitionRelation(
        topology.graph,
        resolvedCurrentPartitionId,
        partition.partitionId
      );

      return {
        partitionId: partition.partitionId,
        label: partition.publicLabel,
        moveHint: buildMoveHint(relation),
        visualRelation: relation.visualRelation,
        audioRelation: relation.audioRelation,
        noticeRelation: relation.noticeRelation
      };
    })
    .filter(
      (option) =>
        option.visualRelation !== "blocked" ||
        option.audioRelation !== "blocked" ||
        option.moveHint !== undefined
    )
    .sort(sortPartitionOptions);

  const spatialSummaryLines = [
    `scene_mode:${topology.fallbackMode}`,
    `current_partition:${resolvedCurrentPartitionId}`,
    `reachable_partitions:${visiblePartitionOptions.length}`
  ];

  return {
    currentPartitionId: resolvedCurrentPartitionId,
    visiblePartitionOptions,
    spatialSummaryLines,
    fallbackMode: topology.fallbackMode
  };
}

function buildNpcRelations(
  graph: ScenePartitionGraph,
  playerPartitionId: string,
  npcPartitions: PartitionLocator[]
): {
  projectionRelations: PartitionPerceptionRelation[];
  sliceRelations: PlayerToNpcPartitionRelation[];
} {
  const projectionRelations: PartitionPerceptionRelation[] = [];
  const sliceRelations: PlayerToNpcPartitionRelation[] = [];

  for (const npc of npcPartitions) {
    const relation = derivePartitionRelation(
      graph,
      playerPartitionId,
      npc.partitionId
    );
    const resolvedPartitionId = relation.toPartitionId;

    projectionRelations.push(
      asPartitionRelation(npc.npcId, "npc", resolvedPartitionId, relation)
    );
    sliceRelations.push(
      toPlayerToNpcRelation(npc.npcId, resolvedPartitionId, relation)
    );
  }

  return {
    projectionRelations,
    sliceRelations
  };
}

function buildObjectRelations(
  graph: ScenePartitionGraph,
  playerPartitionId: string,
  objects: VisibleObjectLocator[]
): PartitionPerceptionRelation[] {
  return objects.map((object) => {
    const relation = derivePartitionRelation(
      graph,
      playerPartitionId,
      object.partitionId
    );

    return asPartitionRelation(
      object.objectId,
      "object",
      relation.toPartitionId,
      relation
    );
  });
}

function buildPartitionOpportunityHints(
  projection: ReturnType<typeof buildPlayerPartitionProjection>
): SceneVisibilityProjection["partitionOpportunityHints"] {
  return projection.visiblePartitionOptions.map((option) => {
    if (
      option.visualRelation === "blocked" &&
      option.audioRelation !== "blocked"
    ) {
      return {
        partitionId: option.partitionId,
        opportunityType: "eavesdrop" as const,
        reason: "audio carries better than line of sight"
      };
    }

    if (option.visualRelation === "partial") {
      return {
        partitionId: option.partitionId,
        opportunityType: "observe_more" as const,
        reason: "repositioning should improve the visible slice"
      };
    }

    return {
      partitionId: option.partitionId,
      opportunityType: "approach" as const,
      reason: "partition is directly actionable from the current stance"
    };
  });
}

function buildNpcToNpcRelations(
  graph: ScenePartitionGraph,
  npcPartitions: PartitionLocator[]
): NpcToNpcPartitionRelation[] {
  const relations: NpcToNpcPartitionRelation[] = [];

  for (const source of npcPartitions) {
    for (const target of npcPartitions) {
      if (source.npcId === target.npcId) {
        continue;
      }

      const relation = derivePartitionRelation(
        graph,
        source.partitionId,
        target.partitionId
      );

      relations.push(
        toNpcToNpcRelation(
          source,
          relation.fromPartitionId,
          target,
          relation.toPartitionId,
          relation
        )
      );
    }
  }

  return relations;
}

export function buildSceneVisibilityProjection(
  context: SceneVisibilityContext
): SceneVisibilityProjection {
  const topology = readScenePartitionGraph(context.sceneId, context.sceneTopology);
  const playerProjection = buildPlayerPartitionProjection(
    context.sceneId,
    topology.graph,
    context.playerPartitionId
  );
  const npcRelations = buildNpcRelations(
    topology.graph,
    playerProjection.currentPartitionId,
    context.activeNpcPartitions ?? []
  );

  return {
    playerProjection,
    playerToNpcRelations: npcRelations.projectionRelations,
    objectRelations: buildObjectRelations(
      topology.graph,
      playerProjection.currentPartitionId,
      context.visibleObjects ?? []
    ),
    partitionOpportunityHints: buildPartitionOpportunityHints(playerProjection)
  };
}

export function buildPartitionPerceptionSlice(
  sceneId: string,
  sceneTopology: ScenePartitionGraph | null | undefined,
  playerPartitionId: string | undefined,
  npcPartitions: PartitionLocator[]
): PartitionPerceptionSlice {
  const topology = readScenePartitionGraph(sceneId, sceneTopology);
  const playerProjection = buildPlayerPartitionProjection(
    sceneId,
    topology.graph,
    playerPartitionId
  );
  const npcRelations = buildNpcRelations(
    topology.graph,
    playerProjection.currentPartitionId,
    npcPartitions
  );

  return {
    playerProjection,
    playerToNpcRelations: npcRelations.sliceRelations,
    npcToNpcRelations: buildNpcToNpcRelations(topology.graph, npcPartitions)
  };
}

export function attachPartitionSliceToPerceiveInput(
  input: PartitionAwarePerceiveInput
): PartitionAwarePerceiveInput {
  return input;
}
