import { z } from "zod";

import {
  identifierSchema,
  metadataSchema,
  tagSchema,
  timestampSchema,
  tickSchema
} from "./base";
import { llmCallTraceSchema } from "./llm";
import { tickTraceRecordSchema } from "./tick-trace";
import { worldEventRecordSchema } from "./world-event";

export const debugRecordKindSchema = z.enum([
  "tick_trace",
  "llm_call",
  "event_append",
  "scheduler_note"
]);

const debugRecordBaseSchema = z.object({
  recordId: identifierSchema,
  worldTick: tickSchema,
  createdAt: timestampSchema,
  npcId: identifierSchema.optional(),
  tags: z.array(tagSchema).optional(),
  metadata: metadataSchema.optional()
});

export const schedulerNotePayloadSchema = z.object({
  message: z.string().min(1),
  relatedNpcIds: z.array(identifierSchema).optional(),
  relatedEventIds: z.array(identifierSchema).optional()
});

export const tickTraceDebugRecordSchema = debugRecordBaseSchema.extend({
  kind: z.literal("tick_trace"),
  trace: tickTraceRecordSchema
});

export const llmCallDebugRecordSchema = debugRecordBaseSchema.extend({
  kind: z.literal("llm_call"),
  trace: llmCallTraceSchema
});

export const eventAppendDebugRecordSchema = debugRecordBaseSchema.extend({
  kind: z.literal("event_append"),
  event: worldEventRecordSchema
});

export const schedulerNoteDebugRecordSchema = debugRecordBaseSchema.extend({
  kind: z.literal("scheduler_note"),
  note: schedulerNotePayloadSchema
});

export const debugRecordSchema = z.discriminatedUnion("kind", [
  tickTraceDebugRecordSchema,
  llmCallDebugRecordSchema,
  eventAppendDebugRecordSchema,
  schedulerNoteDebugRecordSchema
]);

export type DebugRecordKind = z.infer<typeof debugRecordKindSchema>;
export type SchedulerNotePayload = z.infer<typeof schedulerNotePayloadSchema>;
export type TickTraceDebugRecord = z.infer<typeof tickTraceDebugRecordSchema>;
export type LlmCallDebugRecord = z.infer<typeof llmCallDebugRecordSchema>;
export type EventAppendDebugRecord = z.infer<
  typeof eventAppendDebugRecordSchema
>;
export type SchedulerNoteDebugRecord = z.infer<
  typeof schedulerNoteDebugRecordSchema
>;
export type DebugRecord = z.infer<typeof debugRecordSchema>;
