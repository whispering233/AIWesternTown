import {
  IMPLICIT_SCENE_PARTITION_ID,
  type AudioRelation,
  type NoticeRelation,
  type PartitionLink,
  type PartitionRelation,
  type PartitionRepositionPolicy,
  type ScenePartition,
  type ScenePartitionGraph,
  type SceneTopologyReadResult,
  type VisualRelation
} from "./types";

const VISUAL_ORDER: VisualRelation[] = ["blocked", "partial", "clear"];
const AUDIO_ORDER: AudioRelation[] = ["blocked", "muffled", "clear"];
const NOTICE_ORDER: NoticeRelation[] = ["hard", "normal", "easy"];

function indexOfOrThrow<T extends string>(order: readonly T[], value: T): number {
  const index = order.indexOf(value);

  if (index === -1) {
    throw new Error(`Unknown ordered value: ${value}`);
  }

  return index;
}

function compareByOrder<T extends string>(
  order: readonly T[],
  left: T,
  right: T
): number {
  return indexOfOrThrow(order, left) - indexOfOrThrow(order, right);
}

function pickWeakerVisual(left: VisualRelation, right: VisualRelation): VisualRelation {
  return compareByOrder(VISUAL_ORDER, left, right) <= 0 ? left : right;
}

function pickWeakerAudio(left: AudioRelation, right: AudioRelation): AudioRelation {
  return compareByOrder(AUDIO_ORDER, left, right) <= 0 ? left : right;
}

function pickEasierNotice(left: NoticeRelation, right: NoticeRelation): NoticeRelation {
  return compareByOrder(NOTICE_ORDER, left, right) >= 0 ? left : right;
}

function degradeVisual(value: VisualRelation): VisualRelation {
  if (value === "clear") {
    return "partial";
  }

  return "blocked";
}

function degradeAudio(value: AudioRelation): AudioRelation {
  if (value === "clear") {
    return "muffled";
  }

  return "blocked";
}

function pickHeavierMovementCost(
  left: PartitionLink["movementCost"],
  right: PartitionLink["movementCost"]
): PartitionLink["movementCost"] {
  const weight = {
    free: 0,
    light: 1,
    committed: 2
  } as const;

  return weight[left] >= weight[right] ? left : right;
}

function buildImplicitPartition(sceneId: string): ScenePartition {
  return {
    partitionId: IMPLICIT_SCENE_PARTITION_ID,
    sceneId,
    displayName: "Scene Default",
    publicLabel: "scene",
    partitionKind: "social",
    playerVisible: true,
    defaultPlayerAccess: "open",
    capacityTier: "open",
    exposureProfile: {
      visibilityExposure: "medium",
      audibilityExposure: "medium"
    },
    tags: ["implicit_partition"]
  };
}

export function createImplicitScenePartitionGraph(
  sceneId: string
): ScenePartitionGraph {
  return {
    sceneId,
    defaultPlayerPartitionId: IMPLICIT_SCENE_PARTITION_ID,
    partitions: [buildImplicitPartition(sceneId)],
    links: []
  };
}

export function validateScenePartitionGraph(graph: ScenePartitionGraph): {
  isValid: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const partitionIds = new Set<string>();
  const linkCounts = new Map<string, number>();
  const normalizedLinkKeys = new Set<string>();

  if (graph.partitions.length === 0) {
    issues.push("scene topology must include at least one partition");
  }

  if (graph.partitions.length > 5) {
    issues.push("scene topology exceeds first-pass partition cap (5)");
  }

  for (const partition of graph.partitions) {
    if (partition.sceneId !== graph.sceneId) {
      issues.push(
        `partition ${partition.partitionId} sceneId ${partition.sceneId} does not match graph scene ${graph.sceneId}`
      );
    }

    if (partitionIds.has(partition.partitionId)) {
      issues.push(`duplicate partition id ${partition.partitionId}`);
    }

    partitionIds.add(partition.partitionId);
    linkCounts.set(partition.partitionId, 0);
  }

  if (!partitionIds.has(graph.defaultPlayerPartitionId)) {
    issues.push(
      `default player partition ${graph.defaultPlayerPartitionId} does not exist`
    );
  }

  for (const link of graph.links) {
    if (!partitionIds.has(link.fromPartitionId)) {
      issues.push(`link source partition ${link.fromPartitionId} does not exist`);
    }

    if (!partitionIds.has(link.toPartitionId)) {
      issues.push(`link target partition ${link.toPartitionId} does not exist`);
    }

    if (link.fromPartitionId === link.toPartitionId) {
      issues.push(`self link ${link.fromPartitionId} should be omitted`);
    }

    const normalizedLinkKey = [link.fromPartitionId, link.toPartitionId]
      .sort()
      .join("::");

    if (normalizedLinkKeys.has(normalizedLinkKey)) {
      issues.push(
        `duplicate link between ${link.fromPartitionId} and ${link.toPartitionId}`
      );
    } else {
      normalizedLinkKeys.add(normalizedLinkKey);
    }

    linkCounts.set(
      link.fromPartitionId,
      (linkCounts.get(link.fromPartitionId) ?? 0) + 1
    );
  }

  for (const partition of graph.partitions) {
    if (graph.partitions.length === 1) {
      break;
    }

    const outgoing = linkCounts.get(partition.partitionId) ?? 0;
    const incoming = graph.links.filter(
      (link) => link.toPartitionId === partition.partitionId
    ).length;

    if (outgoing + incoming === 0) {
      issues.push(`partition ${partition.partitionId} is isolated`);
    }

    if (outgoing > 4) {
      issues.push(
        `partition ${partition.partitionId} exceeds first-pass link cap (4)`
      );
    }
  }

  return {
    isValid: issues.length === 0,
    issues
  };
}

export function readScenePartitionGraph(
  sceneId: string,
  graph?: ScenePartitionGraph | null
): SceneTopologyReadResult {
  if (!graph) {
    return {
      sceneId,
      graph: createImplicitScenePartitionGraph(sceneId),
      fallbackMode: "scene_default",
      issues: []
    };
  }

  const validation = validateScenePartitionGraph(graph);

  if (!validation.isValid || graph.sceneId !== sceneId) {
    return {
      sceneId,
      graph: createImplicitScenePartitionGraph(sceneId),
      fallbackMode: "scene_default",
      issues:
        graph.sceneId !== sceneId
          ? [`scene topology sceneId ${graph.sceneId} does not match ${sceneId}`, ...validation.issues]
          : validation.issues
    };
  }

  return {
    sceneId,
    graph,
    fallbackMode: "partitioned",
    issues: []
  };
}

type NormalizedGraphCache = {
  partitionsById: Map<string, ScenePartition>;
  linksByFromId: Map<string, Map<string, PartitionLink>>;
};

function normalizeGraph(graph: ScenePartitionGraph): NormalizedGraphCache {
  const partitionsById = new Map(
    graph.partitions.map((partition) => [partition.partitionId, partition])
  );
  const linksByFromId = new Map<string, Map<string, PartitionLink>>();

  const setLink = (link: PartitionLink): void => {
    const existing = linksByFromId.get(link.fromPartitionId);

    if (existing) {
      existing.set(link.toPartitionId, link);
      return;
    }

    linksByFromId.set(
      link.fromPartitionId,
      new Map([[link.toPartitionId, link]])
    );
  };

  for (const link of graph.links) {
    setLink(link);

    const reverseLink: PartitionLink = {
      ...link,
      fromPartitionId: link.toPartitionId,
      toPartitionId: link.fromPartitionId
    };

    setLink(reverseLink);
  }

  return {
    partitionsById,
    linksByFromId
  };
}

function resolvePartitionId(
  graph: ScenePartitionGraph,
  partitionId?: string
): string {
  const normalized = normalizeGraph(graph);

  if (partitionId && normalized.partitionsById.has(partitionId)) {
    return partitionId;
  }

  return graph.defaultPlayerPartitionId;
}

function unreachableRelation(
  fromPartitionId: string,
  toPartitionId: string
): PartitionRelation {
  return {
    fromPartitionId,
    toPartitionId,
    visualRelation: "blocked",
    audioRelation: "blocked",
    noticeRelation: "hard",
    pathLength: null,
    derived: false,
    reachable: false
  };
}

function fromDirectLink(link: PartitionLink): PartitionRelation {
  return {
    fromPartitionId: link.fromPartitionId,
    toPartitionId: link.toPartitionId,
    visualRelation: link.visualRelation,
    audioRelation: link.audioRelation,
    noticeRelation: link.noticeRelation,
    movementCost: link.movementCost,
    pathLength: 1,
    derived: false,
    reachable: true
  };
}

function buildDerivedTwoHopRelation(
  firstHop: PartitionLink,
  secondHop: PartitionLink
): PartitionRelation {
  return {
    fromPartitionId: firstHop.fromPartitionId,
    toPartitionId: secondHop.toPartitionId,
    visualRelation: degradeVisual(
      pickWeakerVisual(firstHop.visualRelation, secondHop.visualRelation)
    ),
    audioRelation: degradeAudio(
      pickWeakerAudio(firstHop.audioRelation, secondHop.audioRelation)
    ),
    noticeRelation: pickEasierNotice(
      firstHop.noticeRelation,
      secondHop.noticeRelation
    ),
    movementCost: pickHeavierMovementCost(
      firstHop.movementCost,
      secondHop.movementCost
    ),
    pathLength: 2,
    derived: true,
    reachable: true
  };
}

function compareCandidateRelation(
  left: PartitionRelation,
  right: PartitionRelation
): number {
  const leftVisual = indexOfOrThrow(VISUAL_ORDER, left.visualRelation);
  const rightVisual = indexOfOrThrow(VISUAL_ORDER, right.visualRelation);

  if (leftVisual !== rightVisual) {
    return leftVisual - rightVisual;
  }

  const leftAudio = indexOfOrThrow(AUDIO_ORDER, left.audioRelation);
  const rightAudio = indexOfOrThrow(AUDIO_ORDER, right.audioRelation);

  if (leftAudio !== rightAudio) {
    return leftAudio - rightAudio;
  }

  const leftNotice = indexOfOrThrow(NOTICE_ORDER, left.noticeRelation);
  const rightNotice = indexOfOrThrow(NOTICE_ORDER, right.noticeRelation);

  return leftNotice - rightNotice;
}

export function derivePartitionRelation(
  graph: ScenePartitionGraph,
  fromPartitionId?: string,
  toPartitionId?: string
): PartitionRelation {
  const normalized = normalizeGraph(graph);
  const resolvedFrom = resolvePartitionId(graph, fromPartitionId);
  const resolvedTo = resolvePartitionId(graph, toPartitionId);

  if (resolvedFrom === resolvedTo) {
    return {
      fromPartitionId: resolvedFrom,
      toPartitionId: resolvedTo,
      visualRelation: "clear",
      audioRelation: "clear",
      noticeRelation: "normal",
      movementCost: "free",
      pathLength: 0,
      derived: false,
      reachable: true
    };
  }

  const directLink = normalized.linksByFromId
    .get(resolvedFrom)
    ?.get(resolvedTo);

  if (directLink) {
    return fromDirectLink(directLink);
  }

  const viaCandidates = normalized.linksByFromId.get(resolvedFrom);
  let bestDerivedRelation: PartitionRelation | undefined;

  for (const [midPartitionId, firstHop] of viaCandidates ?? []) {
    const secondHop = normalized.linksByFromId
      .get(midPartitionId)
      ?.get(resolvedTo);

    if (!secondHop) {
      continue;
    }

    const candidate = buildDerivedTwoHopRelation(firstHop, secondHop);
    if (
      !bestDerivedRelation ||
      compareCandidateRelation(candidate, bestDerivedRelation) > 0
    ) {
      bestDerivedRelation = candidate;
    }
  }

  return (
    bestDerivedRelation ?? unreachableRelation(resolvedFrom, resolvedTo)
  );
}

export function resolvePartitionRepositionPolicy(
  graph: ScenePartitionGraph,
  fromPartitionId?: string,
  toPartitionId?: string
): PartitionRepositionPolicy {
  const relation = derivePartitionRelation(graph, fromPartitionId, toPartitionId);

  return {
    consumesTick: relation.movementCost === "committed",
    noticeRisk: relation.noticeRelation,
    reachable: relation.reachable,
    movementCost: relation.movementCost
  };
}
