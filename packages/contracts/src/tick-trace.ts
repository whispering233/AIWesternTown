import { z } from "zod";

import { identifierSchema, metadataSchema, tagSchema, tickSchema } from "./base.js";
import { playerCommandEnvelopeSchema } from "./player-command.js";

export const simulationRunModeSchema = z.enum([
  "free_explore",
  "focused_dialogue",
  "interrupted",
  "settle"
]);

export const npcExecutionClassSchema = z.enum([
  "full",
  "reactive",
  "light",
  "deferred"
]);

export const npcStageSchema = z.enum([
  "prefetch",
  "perceive",
  "appraise",
  "update_working_memory",
  "goal_arbitration",
  "action_selection",
  "act",
  "reflect",
  "compress"
]);

export const scheduleDecisionSetSchema = z.object({
  foregroundFullNpcIds: z.array(identifierSchema),
  foregroundReactiveNpcIds: z.array(identifierSchema),
  nearFieldLightNpcIds: z.array(identifierSchema),
  nearFieldEscalatedNpcIds: z.array(identifierSchema),
  deferredFarFieldNpcIds: z.array(identifierSchema),
  chosenInterruptEventId: identifierSchema.optional()
});

export const plannedNpcExecutionSchema = z.object({
  npcId: identifierSchema,
  executionClass: npcExecutionClassSchema,
  runStages: z.array(npcStageSchema),
  escalationReasonTags: z.array(tagSchema)
});

export const simulationDebugSummarySchema = z.object({
  worldTick: tickSchema,
  runModeBefore: simulationRunModeSchema,
  runModeAfter: simulationRunModeSchema,
  promotedNpcIds: z.array(identifierSchema),
  suppressedNpcIds: z.array(identifierSchema),
  interruptCandidates: z.array(identifierSchema),
  selectedInterruptReason: z.string().min(1).optional(),
  budgetNotes: z.array(z.string())
});

export const tickTraceRecordSchema = z.object({
  traceId: identifierSchema,
  worldTick: tickSchema,
  playerCommand: playerCommandEnvelopeSchema,
  runModeBefore: simulationRunModeSchema,
  runModeAfter: simulationRunModeSchema,
  scheduleDecisions: scheduleDecisionSetSchema,
  npcExecutions: z.array(plannedNpcExecutionSchema),
  appendedEventIds: z.array(identifierSchema),
  llmTraceIds: z.array(identifierSchema).optional(),
  debugSummary: simulationDebugSummarySchema,
  metadata: metadataSchema.optional()
});

export type SimulationRunMode = z.infer<typeof simulationRunModeSchema>;
export type NpcExecutionClass = z.infer<typeof npcExecutionClassSchema>;
export type NpcStage = z.infer<typeof npcStageSchema>;
export type ScheduleDecisionSet = z.infer<typeof scheduleDecisionSetSchema>;
export type PlannedNpcExecution = z.infer<typeof plannedNpcExecutionSchema>;
export type SimulationDebugSummary = z.infer<typeof simulationDebugSummarySchema>;
export type TickTraceRecord = z.infer<typeof tickTraceRecordSchema>;
