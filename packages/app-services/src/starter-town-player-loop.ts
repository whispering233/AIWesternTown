import type {
  ItemContent,
  NpcContent,
  SceneContent,
  StarterContentBundle
} from "@ai-western-town/content-schema";
import {
  buildPlayerLoopFrame,
  type PlayerLoopFrame,
  type PlayerStepContext,
  type SceneGraphSlice,
  type SurfacedOpportunity,
  type VisibleAnomalySlice,
  type VisibleObjectSlice
} from "@ai-western-town/game-core";

type BuildStarterTownStepOptions = {
  runMode?: PlayerStepContext["runMode"];
  availableSoftOpportunities?: SurfacedOpportunity[];
};

export type StarterTownPlayableSlice = {
  sceneGraph: SceneGraphSlice;
  playerStepContext: PlayerStepContext;
  playerLoopFrame: PlayerLoopFrame;
};

function requireScene(
  bundle: StarterContentBundle,
  sceneId: string
): SceneContent {
  const scene = bundle.scenes.find((entry) => entry.sceneId === sceneId);

  if (!scene) {
    throw new Error(`Unknown sceneId "${sceneId}" in starter content bundle`);
  }

  return scene;
}

function mapTravelTimeToDistanceTier(
  travelTime: SceneContent["connections"][number]["travelTime"]
): SceneGraphSlice["travelEdges"][number]["distanceTier"] {
  switch (travelTime) {
    case "short":
      return "near";
    case "medium":
    case "long":
    default:
      return "far";
  }
}

function buildSceneGraphSlice(
  bundle: StarterContentBundle,
  currentSceneId: string
): SceneGraphSlice {
  const scene = requireScene(bundle, currentSceneId);

  return {
    currentSceneId,
    adjacentSceneIds: scene.connections.map((entry) => entry.toSceneId),
    travelEdges: scene.connections.map((entry) => ({
      fromSceneId: currentSceneId,
      toSceneId: entry.toSceneId,
      distanceTier: mapTravelTimeToDistanceTier(entry.travelTime)
    }))
  };
}

function buildVisibleNpcList(
  bundle: StarterContentBundle,
  currentSceneId: string
): NpcContent[] {
  return bundle.npcs.filter((entry) => entry.startSceneId === currentSceneId);
}

function buildVisibleObjectList(
  bundle: StarterContentBundle,
  currentSceneId: string,
  visibleNpcs: NpcContent[]
): VisibleObjectSlice[] {
  const visibleNpcIds = new Set(visibleNpcs.map((entry) => entry.npcId));

  return bundle.items
    .filter((item) => {
      if (item.startPlacement.holderType === "scene") {
        return item.startPlacement.sceneId === currentSceneId;
      }

      return visibleNpcIds.has(item.startPlacement.npcId);
    })
    .map((item) => ({
      objectId: item.itemId,
      label: item.displayName,
      tags: [...item.tags]
    }));
}

function createSceneTagAnomaly(scene: SceneContent): VisibleAnomalySlice[] {
  const anomalies: VisibleAnomalySlice[] = [];

  if (scene.tags.includes("rumor_hub")) {
    anomalies.push({
      anomalyId: `${scene.sceneId}-rumor-current`,
      summary: "Conversations keep reorganizing around a rumor current.",
      tags: ["social", "audio"]
    });
  }

  if (scene.tags.includes("arrival_point") || scene.tags.includes("waiting_space")) {
    anomalies.push({
      anomalyId: `${scene.sceneId}-watchful-traffic`,
      summary: "People watch arrivals and departures more closely than they admit.",
      tags: ["departure", "social"]
    });
  }

  if (scene.tags.includes("town_center") || scene.tags.includes("records")) {
    anomalies.push({
      anomalyId: `${scene.sceneId}-official-pressure`,
      summary: "The room carries institutional pressure that changes how people speak.",
      tags: ["social", "callout"]
    });
  }

  return anomalies;
}

function createNpcAnomalies(visibleNpcs: NpcContent[]): VisibleAnomalySlice[] {
  return visibleNpcs.flatMap((npc) => {
    const anomalies: VisibleAnomalySlice[] = [];

    if (npc.tags.includes("under_pressure")) {
      anomalies.push({
        anomalyId: `${npc.npcId}-pressure-read`,
        summary: `${npc.displayName} is holding composure under visible pressure.`,
        tags: ["social"]
      });
    }

    if (npc.tags.includes("authority")) {
      anomalies.push({
        anomalyId: `${npc.npcId}-authority-shadow`,
        summary: `${npc.displayName} shifts the room simply by being present.`,
        tags: ["social", "callout"]
      });
    }

    return anomalies;
  });
}

function createObjectAnomalies(
  bundle: StarterContentBundle,
  currentSceneId: string,
  visibleObjects: VisibleObjectSlice[]
): VisibleAnomalySlice[] {
  const sceneItems = bundle.items.filter(
    (item) =>
      item.startPlacement.holderType === "scene" &&
      item.startPlacement.sceneId === currentSceneId
  );
  const criticalObjectIds = new Set(
    sceneItems.filter((item) => item.tags.includes("critical")).map((item) => item.itemId)
  );

  return visibleObjects
    .filter(
      (entry) =>
        criticalObjectIds.has(entry.objectId) ||
        entry.tags?.includes("records") ||
        entry.tags?.includes("medical")
    )
    .map((entry) => ({
      anomalyId: `${entry.objectId}-trace`,
      summary: `${entry.label ?? entry.objectId} looks like it could reveal more under inspection.`,
      tags: ["inspect", ...(entry.tags ?? [])]
    }));
}

function buildVisibleAnomalies(
  bundle: StarterContentBundle,
  scene: SceneContent,
  visibleNpcs: NpcContent[],
  visibleObjects: VisibleObjectSlice[]
): VisibleAnomalySlice[] {
  const anomalies = [
    ...createSceneTagAnomaly(scene),
    ...createNpcAnomalies(visibleNpcs),
    ...createObjectAnomalies(bundle, scene.sceneId, visibleObjects)
  ];

  if (anomalies.length > 0) {
    return anomalies.slice(0, 4);
  }

  return [
    {
      anomalyId: `${scene.sceneId}-ambient-read`,
      summary: "The scene is calm on the surface, but it still rewards a closer read.",
      tags: ["observe"]
    }
  ];
}

function buildDefaultSoftOpportunities(
  visibleNpcs: NpcContent[],
  visibleObjects: VisibleObjectSlice[]
): SurfacedOpportunity[] {
  const opportunities: SurfacedOpportunity[] = [];

  for (const npc of visibleNpcs) {
    opportunities.push({
      opportunityId: `soft-approach-${npc.npcId}`,
      opportunityType: "approach",
      leadText: `Approach ${npc.displayName} for a direct read.`,
      sourceFindingIds: [],
      resolutionMode: npc.tags.includes("authority") ? "short_scene" : "atomic"
    });
  }

  for (const objectEntry of visibleObjects) {
    if (objectEntry.tags?.includes("records") || objectEntry.tags?.includes("medical")) {
      opportunities.push({
        opportunityId: `soft-inspect-${objectEntry.objectId}`,
        opportunityType: "inspect",
        leadText: `Inspect ${objectEntry.label ?? objectEntry.objectId} before the scene shifts.`,
        sourceFindingIds: [],
        resolutionMode: "atomic"
      });
    }
  }

  return opportunities.slice(0, 3);
}

export function buildStarterTownPlayerStepContext(
  bundle: StarterContentBundle,
  currentSceneId: string,
  options: BuildStarterTownStepOptions = {}
): PlayerStepContext {
  const scene = requireScene(bundle, currentSceneId);
  const visibleNpcs = buildVisibleNpcList(bundle, currentSceneId);
  const visibleObjects = buildVisibleObjectList(bundle, currentSceneId, visibleNpcs);

  return {
    currentSceneId,
    currentSceneDisplayName: scene.displayName,
    currentSceneSummary: scene.summary,
    localSceneClusterId: "starter-town",
    visibleNpcIds: visibleNpcs.map((entry) => entry.npcId),
    visibleObjects,
    visibleAnomalies: buildVisibleAnomalies(bundle, scene, visibleNpcs, visibleObjects),
    availableSoftOpportunities:
      options.availableSoftOpportunities ??
      buildDefaultSoftOpportunities(visibleNpcs, visibleObjects),
    runMode: options.runMode ?? "free_explore"
  };
}

export function buildStarterTownPlayableSlice(
  bundle: StarterContentBundle,
  currentSceneId: string,
  options: BuildStarterTownStepOptions = {}
): StarterTownPlayableSlice {
  const playerStepContext = buildStarterTownPlayerStepContext(
    bundle,
    currentSceneId,
    options
  );

  return {
    sceneGraph: buildSceneGraphSlice(bundle, currentSceneId),
    playerStepContext,
    playerLoopFrame: buildPlayerLoopFrame(playerStepContext)
  };
}

export type { BuildStarterTownStepOptions };
