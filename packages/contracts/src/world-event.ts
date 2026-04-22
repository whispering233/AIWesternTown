import { z } from "zod";

import {
  identifierSchema,
  jsonObjectSchema,
  metadataSchema,
  tagSchema,
  tickSchema
} from "./base";

export const eventHeatLevelSchema = z.enum(["ordinary", "high", "interrupt"]);

export const interruptTypeSchema = z.enum([
  "violence",
  "intrusion",
  "public_reveal",
  "forced_state_change"
]);

export const worldEventRecordSchema = z
  .object({
    eventId: identifierSchema,
    eventType: z.string().min(1),
    worldTick: tickSchema,
    originSceneId: identifierSchema,
    actorIds: z.array(identifierSchema),
    targetIds: z.array(identifierSchema).default([]),
    tags: z.array(tagSchema).default([]),
    heatLevel: eventHeatLevelSchema,
    interruptType: interruptTypeSchema.optional(),
    sourceCommandId: identifierSchema.optional(),
    summary: z.string().min(1).optional(),
    payload: jsonObjectSchema.optional(),
    metadata: metadataSchema.optional()
  })
  .superRefine((value, ctx) => {
    if (value.heatLevel === "interrupt" && !value.interruptType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["interruptType"],
        message: "interrupt events must include interruptType"
      });
    }
  });

export const tickRangeSchema = z
  .object({
    from: tickSchema,
    to: tickSchema
  })
  .refine((value) => value.from <= value.to, {
    message: "tickRange.from must be less than or equal to tickRange.to",
    path: ["from"]
  });

export const worldEventWindowSchema = z
  .object({
    tickRange: tickRangeSchema,
    events: z.array(worldEventRecordSchema)
  })
  .superRefine((value, ctx) => {
    value.events.forEach((event, index) => {
      if (
        event.worldTick < value.tickRange.from ||
        event.worldTick > value.tickRange.to
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["events", index, "worldTick"],
          message: "event worldTick must fall within tickRange"
        });
      }
    });
  });

export type EventHeatLevel = z.infer<typeof eventHeatLevelSchema>;
export type InterruptType = z.infer<typeof interruptTypeSchema>;
export type WorldEventRecord = z.infer<typeof worldEventRecordSchema>;
export type TickRange = z.infer<typeof tickRangeSchema>;
export type WorldEventWindow = z.infer<typeof worldEventWindowSchema>;
