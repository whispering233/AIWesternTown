import { z } from "zod";

import { identifierSchema, nonEmptyStringSchema, tagsSchema } from "./primitives.js";

export const npcContentSchema = z.object({
  npcId: identifierSchema,
  displayName: nonEmptyStringSchema,
  role: nonEmptyStringSchema,
  homeSceneId: identifierSchema,
  startSceneId: identifierSchema,
  publicPersona: nonEmptyStringSchema,
  coreDrives: z.array(nonEmptyStringSchema),
  shortTermGoals: z.array(nonEmptyStringSchema),
  tags: tagsSchema
});

export type NpcContent = z.infer<typeof npcContentSchema>;
