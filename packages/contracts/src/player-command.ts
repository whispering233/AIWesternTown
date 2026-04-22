import { z } from "zod";

import {
  identifierSchema,
  jsonValueSchema,
  metadataSchema,
  tagSchema,
  tickSchema
} from "./base";

export const playerCommandTypeSchema = z.enum([
  "dialogue",
  "move",
  "observe",
  "social",
  "item",
  "system"
]);

export const itemResolutionModeSchema = z.enum([
  "direct",
  "social_request",
  "covert",
  "effect"
]);

export const parsedPlayerActionSchema = z
  .object({
    actionType: z.string().min(1).optional(),
    targetActorId: identifierSchema.optional(),
    targetLocationId: identifierSchema.optional(),
    itemActionType: z.string().min(1).optional(),
    itemResolutionMode: itemResolutionModeSchema.optional(),
    tags: z.array(tagSchema).optional()
  })
  .catchall(jsonValueSchema);

export const playerCommandEnvelopeSchema = z
  .object({
    commandId: identifierSchema,
    commandType: playerCommandTypeSchema,
    parsedAction: parsedPlayerActionSchema,
    issuedAtTick: tickSchema,
    consumesTick: z.boolean(),
    metadata: metadataSchema.optional()
  })
  .superRefine((value, ctx) => {
    if (value.commandType === "item") {
      if (!value.parsedAction.itemActionType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parsedAction", "itemActionType"],
          message: "item commands must include parsedAction.itemActionType"
        });
      }

      if (!value.parsedAction.itemResolutionMode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parsedAction", "itemResolutionMode"],
          message: "item commands must include parsedAction.itemResolutionMode"
        });
      }
    }
  });

export type PlayerCommandType = z.infer<typeof playerCommandTypeSchema>;
export type ItemResolutionMode = z.infer<typeof itemResolutionModeSchema>;
export type ParsedPlayerAction = z.infer<typeof parsedPlayerActionSchema>;
export type PlayerCommandEnvelope = z.infer<typeof playerCommandEnvelopeSchema>;
