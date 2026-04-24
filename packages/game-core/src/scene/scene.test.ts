import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPartitionPerceptionSlice,
  buildSceneVisibilityProjection,
  derivePartitionRelation,
  readScenePartitionGraph,
  resolvePartitionRepositionPolicy,
  type ScenePartitionGraph
} from "../index";

function createSaloonGraph(): ScenePartitionGraph {
  return {
    sceneId: "saloon",
    defaultPlayerPartitionId: "bar_counter",
    partitions: [
      {
        partitionId: "front_door",
        sceneId: "saloon",
        displayName: "Front Door",
        publicLabel: "front door",
        partitionKind: "entry",
        playerVisible: true,
        defaultPlayerAccess: "open",
        capacityTier: "medium",
        exposureProfile: {
          visibilityExposure: "high",
          audibilityExposure: "medium"
        },
        tags: ["entry"]
      },
      {
        partitionId: "bar_counter",
        sceneId: "saloon",
        displayName: "Bar Counter",
        publicLabel: "bar counter",
        partitionKind: "service",
        playerVisible: true,
        defaultPlayerAccess: "open",
        capacityTier: "medium",
        exposureProfile: {
          visibilityExposure: "high",
          audibilityExposure: "high"
        },
        tags: ["bar"]
      },
      {
        partitionId: "corner_table",
        sceneId: "saloon",
        displayName: "Corner Table",
        publicLabel: "corner table",
        partitionKind: "social",
        playerVisible: true,
        defaultPlayerAccess: "contextual",
        capacityTier: "tight",
        exposureProfile: {
          visibilityExposure: "low",
          audibilityExposure: "medium"
        },
        tags: ["private"]
      },
      {
        partitionId: "stairs_landing",
        sceneId: "saloon",
        displayName: "Stairs Landing",
        publicLabel: "stairs landing",
        partitionKind: "transition",
        playerVisible: true,
        defaultPlayerAccess: "contextual",
        capacityTier: "tight",
        exposureProfile: {
          visibilityExposure: "medium",
          audibilityExposure: "high"
        },
        tags: ["elevated"]
      }
    ],
    links: [
      {
        fromPartitionId: "front_door",
        toPartitionId: "bar_counter",
        movementCost: "free",
        visualRelation: "clear",
        audioRelation: "clear",
        noticeRelation: "easy",
        transitionStyle: "open",
        tags: []
      },
      {
        fromPartitionId: "bar_counter",
        toPartitionId: "corner_table",
        movementCost: "light",
        visualRelation: "clear",
        audioRelation: "muffled",
        noticeRelation: "normal",
        transitionStyle: "through_crowd",
        tags: []
      },
      {
        fromPartitionId: "bar_counter",
        toPartitionId: "stairs_landing",
        movementCost: "light",
        visualRelation: "clear",
        audioRelation: "muffled",
        noticeRelation: "normal",
        transitionStyle: "through_threshold",
        tags: []
      },
      {
        fromPartitionId: "stairs_landing",
        toPartitionId: "corner_table",
        movementCost: "light",
        visualRelation: "partial",
        audioRelation: "clear",
        noticeRelation: "hard",
        transitionStyle: "edge_slide",
        tags: []
      }
    ]
  };
}

test("scene visibility distinguishes observation slices by partition", () => {
  const graph = createSaloonGraph();

  const fromBarCounter = buildSceneVisibilityProjection({
    sceneId: "saloon",
    sceneTopology: graph,
    playerPartitionId: "bar_counter",
    activeNpcPartitions: [
      {
        npcId: "npc-gambler",
        partitionId: "corner_table"
      }
    ]
  });
  const fromStairsLanding = buildSceneVisibilityProjection({
    sceneId: "saloon",
    sceneTopology: graph,
    playerPartitionId: "stairs_landing",
    activeNpcPartitions: [
      {
        npcId: "npc-gambler",
        partitionId: "corner_table"
      }
    ]
  });

  assert.equal(
    fromBarCounter.playerToNpcRelations[0]?.visualRelation,
    "clear"
  );
  assert.equal(
    fromBarCounter.playerToNpcRelations[0]?.audioRelation,
    "muffled"
  );
  assert.equal(
    fromStairsLanding.playerToNpcRelations[0]?.visualRelation,
    "partial"
  );
  assert.equal(
    fromStairsLanding.playerToNpcRelations[0]?.audioRelation,
    "clear"
  );
  assert.equal(
    fromStairsLanding.playerToNpcRelations[0]?.noticeRelation,
    "hard"
  );
});

test("readScenePartitionGraph falls back to a single implicit partition for legacy scenes", () => {
  const topology = readScenePartitionGraph("hotel_lobby", null);
  const projection = buildSceneVisibilityProjection({
    sceneId: "hotel_lobby",
    sceneTopology: null,
    activeNpcPartitions: [
      {
        npcId: "npc-innkeeper"
      }
    ],
    visibleObjects: [
      {
        objectId: "ledger"
      }
    ]
  });

  assert.equal(topology.fallbackMode, "scene_default");
  assert.equal(topology.graph.partitions.length, 1);
  assert.equal(projection.playerProjection.currentPartitionId, "scene_default");
  assert.equal(projection.playerProjection.visiblePartitionOptions.length, 0);
  assert.deepEqual(projection.playerToNpcRelations[0], {
    targetId: "npc-innkeeper",
    targetType: "npc",
    partitionId: "scene_default",
    visualRelation: "clear",
    audioRelation: "clear",
    noticeRelation: "normal"
  });
  assert.deepEqual(projection.objectRelations[0], {
    targetId: "ledger",
    targetType: "object",
    partitionId: "scene_default",
    visualRelation: "clear",
    audioRelation: "clear",
    noticeRelation: "normal"
  });
});

test("derivePartitionRelation supports sparse graph two-hop degradation", () => {
  const graph = createSaloonGraph();
  const relation = derivePartitionRelation(graph, "front_door", "stairs_landing");

  assert.equal(relation.derived, true);
  assert.equal(relation.pathLength, 2);
  assert.equal(relation.visualRelation, "partial");
  assert.equal(relation.audioRelation, "blocked");
  assert.equal(relation.noticeRelation, "easy");
});

test("perception slice is shaped for player-loop and cognition-lite consumers", () => {
  const graph = createSaloonGraph();
  const slice = buildPartitionPerceptionSlice("saloon", graph, "bar_counter", [
    {
      npcId: "npc-gambler",
      partitionId: "corner_table"
    },
    {
      npcId: "npc-barkeep",
      partitionId: "bar_counter"
    }
  ]);

  assert.equal(slice.playerProjection.currentPartitionId, "bar_counter");
  assert.equal(slice.playerToNpcRelations.length, 2);
  assert.equal(slice.npcToNpcRelations.length, 2);
  assert.deepEqual(slice.playerToNpcRelations[0], {
    npcId: "npc-gambler",
    partitionId: "corner_table",
    visualRelation: "clear",
    audioRelation: "muffled",
    noticeRelation: "normal"
  });
});

test("reposition policy marks committed moves as tick-consuming", () => {
  const graph = createSaloonGraph();
  graph.links.push({
    fromPartitionId: "front_door",
    toPartitionId: "corner_table",
    movementCost: "committed",
    visualRelation: "partial",
    audioRelation: "blocked",
    noticeRelation: "easy",
    transitionStyle: "through_crowd",
    tags: []
  });

  const policy = resolvePartitionRepositionPolicy(
    graph,
    "front_door",
    "corner_table"
  );

  assert.equal(policy.reachable, true);
  assert.equal(policy.consumesTick, true);
  assert.equal(policy.noticeRisk, "easy");
});

test("duplicate partition links are rejected before relation derivation can drift by direction", () => {
  const graph = createSaloonGraph();
  graph.links.push({
    fromPartitionId: "bar_counter",
    toPartitionId: "front_door",
    movementCost: "committed",
    visualRelation: "partial",
    audioRelation: "blocked",
    noticeRelation: "hard",
    transitionStyle: "through_crowd",
    tags: ["duplicate"]
  });

  const topology = readScenePartitionGraph("saloon", graph);

  assert.equal(topology.fallbackMode, "scene_default");
  assert.match(
    topology.issues[0] ?? "",
    /duplicate link between bar_counter and front_door/
  );
});
