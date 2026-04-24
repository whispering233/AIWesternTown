import { z } from "zod";

import { identifierSchema, nonEmptyStringSchema, tagsSchema } from "./primitives.js";

export const sceneCategorySchema = z.enum([
  "interior",
  "exterior",
  "service",
  "residence",
  "civic"
]);

export const travelTimeSchema = z.enum(["short", "medium", "long"]);

export const sceneConnectionSchema = z.object({
  toSceneId: identifierSchema,
  travelTime: travelTimeSchema
});

export const sceneContentSchema = z.object({
  sceneId: identifierSchema,
  displayName: nonEmptyStringSchema,
  summary: nonEmptyStringSchema,
  category: sceneCategorySchema,
  tags: tagsSchema,
  connections: z.array(sceneConnectionSchema)
});

export type SceneCategory = z.infer<typeof sceneCategorySchema>;
export type TravelTime = z.infer<typeof travelTimeSchema>;
export type SceneConnection = z.infer<typeof sceneConnectionSchema>;
export type SceneContent = z.infer<typeof sceneContentSchema>;
