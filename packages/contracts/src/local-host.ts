import { z } from "zod";

import {
  identifierSchema,
  metadataSchema,
  timestampSchema,
  tickSchema
} from "./base.js";
import { playerCommandEnvelopeSchema } from "./player-command.js";
import { tickTraceRecordSchema } from "./tick-trace.js";
import { worldEventRecordSchema } from "./world-event.js";

export const localSessionStatusSchema = z.enum(["active", "closed"]);

export const localSessionSchema = z.object({
  sessionId: identifierSchema,
  status: localSessionStatusSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
  worldTick: tickSchema,
  metadata: metadataSchema.optional()
});

export const createLocalSessionRequestSchema = z.object({
  metadata: metadataSchema.optional()
});

export const createLocalSessionResponseSchema = z.object({
  session: localSessionSchema
});

export const submitLocalCommandRequestSchema = z.object({
  playerCommand: playerCommandEnvelopeSchema
});

export const submitLocalCommandResponseSchema = z.object({
  session: localSessionSchema,
  acceptedCommandId: identifierSchema,
  emittedEventIds: z.array(identifierSchema)
});

const localHostStreamEventBaseSchema = z.object({
  eventId: identifierSchema,
  sessionId: identifierSchema,
  sequence: z.number().int().positive(),
  emittedAt: timestampSchema
});

export const sessionSnapshotStreamEventSchema =
  localHostStreamEventBaseSchema.extend({
    type: z.literal("session.snapshot"),
    session: localSessionSchema
  });

export const commandAcceptedStreamEventSchema =
  localHostStreamEventBaseSchema.extend({
    type: z.literal("command.accepted"),
    playerCommand: playerCommandEnvelopeSchema,
    session: localSessionSchema
  });

export const worldEventStreamEventSchema = localHostStreamEventBaseSchema.extend({
  type: z.literal("world.event"),
  event: worldEventRecordSchema
});

export const tickTraceStreamEventSchema = localHostStreamEventBaseSchema.extend({
  type: z.literal("tick.trace"),
  trace: tickTraceRecordSchema
});

export const localHostStreamEventSchema = z.discriminatedUnion("type", [
  sessionSnapshotStreamEventSchema,
  commandAcceptedStreamEventSchema,
  worldEventStreamEventSchema,
  tickTraceStreamEventSchema
]);

export type LocalSessionStatus = z.infer<typeof localSessionStatusSchema>;
export type LocalSession = z.infer<typeof localSessionSchema>;
export type CreateLocalSessionRequest = z.infer<
  typeof createLocalSessionRequestSchema
>;
export type CreateLocalSessionResponse = z.infer<
  typeof createLocalSessionResponseSchema
>;
export type SubmitLocalCommandRequest = z.infer<
  typeof submitLocalCommandRequestSchema
>;
export type SubmitLocalCommandResponse = z.infer<
  typeof submitLocalCommandResponseSchema
>;
export type SessionSnapshotStreamEvent = z.infer<
  typeof sessionSnapshotStreamEventSchema
>;
export type CommandAcceptedStreamEvent = z.infer<
  typeof commandAcceptedStreamEventSchema
>;
export type WorldEventStreamEvent = z.infer<typeof worldEventStreamEventSchema>;
export type TickTraceStreamEvent = z.infer<typeof tickTraceStreamEventSchema>;
export type LocalHostStreamEvent = z.infer<typeof localHostStreamEventSchema>;
