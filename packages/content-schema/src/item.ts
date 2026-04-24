import { z } from "zod";

import { identifierSchema, nonEmptyStringSchema, tagsSchema } from "./primitives.js";

export const itemCategorySchema = z.enum([
  "document",
  "access",
  "tool",
  "valuable",
  "misc"
]);

export const itemStartPlacementSchema = z.discriminatedUnion("holderType", [
  z.object({
    holderType: z.literal("scene"),
    sceneId: identifierSchema
  }),
  z.object({
    holderType: z.literal("npc"),
    npcId: identifierSchema
  })
]);

export const itemContentSchema = z.object({
  itemId: identifierSchema,
  displayName: nonEmptyStringSchema,
  category: itemCategorySchema,
  tags: tagsSchema,
  startPlacement: itemStartPlacementSchema
});

export type ItemCategory = z.infer<typeof itemCategorySchema>;
export type ItemStartPlacement = z.infer<typeof itemStartPlacementSchema>;
export type ItemContent = z.infer<typeof itemContentSchema>;
