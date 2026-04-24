import { z } from "zod";

import { itemContentSchema, type ItemContent } from "./item.js";
import { npcContentSchema, type NpcContent } from "./npc.js";
import { identifierSchema, nonEmptyStringSchema } from "./primitives.js";
import { sceneContentSchema, type SceneContent } from "./scene.js";

const baseStarterContentBundleSchema = z.object({
  packId: identifierSchema,
  version: nonEmptyStringSchema,
  scenes: z.array(sceneContentSchema),
  npcs: z.array(npcContentSchema),
  items: z.array(itemContentSchema)
});

function addDuplicateIssues<TEntry extends SceneContent | NpcContent | ItemContent>(
  ctx: z.RefinementCtx,
  entries: TEntry[],
  selectId: (entry: TEntry) => string,
  idLabel: string,
  pathSegment: "scenes" | "npcs" | "items"
): void {
  const seen = new Map<string, number>();

  entries.forEach((entry, index) => {
    const value = selectId(entry);
    const firstIndex = seen.get(value);

    if (firstIndex === undefined) {
      seen.set(value, index);
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Duplicate ${idLabel} "${value}" is not allowed`,
      path: [pathSegment, index, idLabel]
    });
  });
}

export const starterContentBundleSchema = baseStarterContentBundleSchema.superRefine(
  (bundle, ctx) => {
    addDuplicateIssues(ctx, bundle.scenes, (scene) => scene.sceneId, "sceneId", "scenes");
    addDuplicateIssues(ctx, bundle.npcs, (npc) => npc.npcId, "npcId", "npcs");
    addDuplicateIssues(ctx, bundle.items, (item) => item.itemId, "itemId", "items");

    const sceneIds = new Set(bundle.scenes.map((scene) => scene.sceneId));
    const npcIds = new Set(bundle.npcs.map((npc) => npc.npcId));

    bundle.scenes.forEach((scene, sceneIndex) => {
      scene.connections.forEach((connection, connectionIndex) => {
        if (!sceneIds.has(connection.toSceneId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Scene connection references unknown scene "${connection.toSceneId}"`,
            path: ["scenes", sceneIndex, "connections", connectionIndex, "toSceneId"]
          });
        }
      });
    });

    bundle.npcs.forEach((npc, npcIndex) => {
      if (!sceneIds.has(npc.homeSceneId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `NPC homeSceneId references unknown scene "${npc.homeSceneId}"`,
          path: ["npcs", npcIndex, "homeSceneId"]
        });
      }

      if (!sceneIds.has(npc.startSceneId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `NPC startSceneId references unknown scene "${npc.startSceneId}"`,
          path: ["npcs", npcIndex, "startSceneId"]
        });
      }
    });

    bundle.items.forEach((item, itemIndex) => {
      if (
        item.startPlacement.holderType === "scene" &&
        !sceneIds.has(item.startPlacement.sceneId)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Item placement references unknown scene "${item.startPlacement.sceneId}"`,
          path: ["items", itemIndex, "startPlacement", "sceneId"]
        });
      }

      if (
        item.startPlacement.holderType === "npc" &&
        !npcIds.has(item.startPlacement.npcId)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Item placement references unknown NPC "${item.startPlacement.npcId}"`,
          path: ["items", itemIndex, "startPlacement", "npcId"]
        });
      }
    });

    if (bundle.scenes.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Starter content bundle must contain at least one scene",
        path: ["scenes"]
      });
    }

    if (bundle.npcs.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Starter content bundle must contain at least one NPC",
        path: ["npcs"]
      });
    }

    if (bundle.items.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Starter content bundle must contain at least one item",
        path: ["items"]
      });
    }

    const totalConnections = bundle.scenes.reduce(
      (connectionCount, scene) => connectionCount + scene.connections.length,
      0
    );

    if (totalConnections < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Starter content bundle must contain at least one scene connection",
        path: ["scenes"]
      });
    }
  }
);

export type StarterContentBundle = z.infer<typeof starterContentBundleSchema>;

export function safeParseStarterContentBundle(input: unknown) {
  return starterContentBundleSchema.safeParse(input);
}

export function parseStarterContentBundle(input: unknown): StarterContentBundle {
  return starterContentBundleSchema.parse(input);
}
