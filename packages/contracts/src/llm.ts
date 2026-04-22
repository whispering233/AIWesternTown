import { z } from "zod";

import { identifierSchema, metadataSchema } from "./base";

export const taskKindSchema = z.enum([
  "appraise_refine",
  "goal_tiebreak",
  "action_style_refine",
  "visible_outcome_render",
  "deep_reflect",
  "compression_generalize"
]);

export const providerModeSchema = z.enum(["classify", "summarize", "render"]);
export const budgetLevelSchema = z.enum(["normal", "tight", "critical"]);
export const messageRoleSchema = z.enum(["system", "user", "assistant"]);
export const promptBlockKindSchema = z.enum([
  "policy",
  "task",
  "context",
  "evidence",
  "schema",
  "example"
]);
export const promptPrioritySchema = z.enum([
  "must_have",
  "important",
  "optional"
]);

export const compiledMessageSchema = z.object({
  role: messageRoleSchema,
  content: z.string().min(1)
});

export const outputSchemaSpecSchema = z.object({
  schemaName: z.string().min(1),
  jsonShape: z.string().min(1),
  validationRules: z.array(z.string().min(1))
});

export const promptBlockSchema = z.object({
  key: z.string().min(1),
  kind: promptBlockKindSchema,
  role: messageRoleSchema,
  priority: promptPrioritySchema,
  content: z.string().min(1),
  estimatedTokens: z.number().int().positive().optional(),
  canSummarize: z.boolean().optional(),
  canDrop: z.boolean().optional()
});

export const promptSpecSchema = z.object({
  taskKind: taskKindSchema,
  stageName: z.string().min(1),
  purpose: z.string().min(1),
  blocks: z.array(promptBlockSchema).min(1),
  outputSchema: outputSchemaSpecSchema,
  inputBudgetTokens: z.number().int().positive(),
  outputBudgetTokens: z.number().int().positive(),
  budgetLevel: budgetLevelSchema,
  providerHints: z
    .object({
      mode: providerModeSchema.optional(),
      temperature: z.number().min(0).max(2).optional(),
      topP: z.number().min(0).max(1).optional()
    })
    .optional(),
  debugMeta: z.object({
    builderName: z.string().min(1),
    traceTags: z.array(z.string().min(1)),
    sourceStage: z.string().min(1)
  })
});

export const compiledPromptSchema = z
  .object({
    messages: z.array(compiledMessageSchema).min(1),
    roleSummary: z.object({
      systemBlocks: z.array(z.string()),
      userBlocks: z.array(z.string()),
      assistantBlocks: z.array(z.string())
    })
  })
  .superRefine((value, ctx) => {
    const assistantCount = value.messages.filter(
      (message) => message.role === "assistant"
    ).length;

    if (assistantCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["messages"],
        message: "compiled prompts can include at most one assistant example"
      });
    }
  });

export const providerRequestSchema = z.object({
  requestId: identifierSchema,
  taskKind: taskKindSchema,
  mode: providerModeSchema,
  modelRef: z.string().min(1),
  messages: z.array(compiledMessageSchema).min(1),
  responseFormat: z.enum(["json_object", "text"]).optional(),
  maxInputTokens: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive(),
  temperature: z.number().min(0).max(2),
  topP: z.number().min(0).max(1).optional(),
  timeoutMs: z.number().int().positive()
});

export const providerResponseSchema = z.object({
  requestId: identifierSchema,
  providerName: z.string().min(1),
  modelRef: z.string().min(1),
  finishReason: z.enum(["stop", "length", "timeout", "error"]),
  rawText: z.string(),
  usage: z
    .object({
      inputTokens: z.number().int().nonnegative().optional(),
      outputTokens: z.number().int().nonnegative().optional()
    })
    .optional(),
  capabilityFlags: z.array(z.string()).optional(),
  errorCode: z.string().min(1).optional(),
  errorMessage: z.string().min(1).optional(),
  metadata: metadataSchema.optional()
});

export const llmCallTraceSchema = z.object({
  traceId: identifierSchema,
  taskKind: taskKindSchema,
  stageName: z.string().min(1),
  invocationDecision: z.string().min(1),
  builderName: z.string().min(1).optional(),
  budgetLevel: budgetLevelSchema.optional(),
  trimmedBlocks: z.array(z.string()).optional(),
  providerName: z.string().min(1).optional(),
  modelRef: z.string().min(1).optional(),
  finishReason: z.enum(["stop", "length", "timeout", "error"]).optional(),
  parseResult: z.string().min(1).optional(),
  fallbackReason: z.string().min(1).optional(),
  metadata: metadataSchema.optional()
});

export type TaskKind = z.infer<typeof taskKindSchema>;
export type ProviderMode = z.infer<typeof providerModeSchema>;
export type BudgetLevel = z.infer<typeof budgetLevelSchema>;
export type MessageRole = z.infer<typeof messageRoleSchema>;
export type PromptBlockKind = z.infer<typeof promptBlockKindSchema>;
export type PromptPriority = z.infer<typeof promptPrioritySchema>;
export type CompiledMessage = z.infer<typeof compiledMessageSchema>;
export type OutputSchemaSpec = z.infer<typeof outputSchemaSpecSchema>;
export type PromptBlock = z.infer<typeof promptBlockSchema>;
export type PromptSpec = z.infer<typeof promptSpecSchema>;
export type CompiledPrompt = z.infer<typeof compiledPromptSchema>;
export type ProviderRequest = z.infer<typeof providerRequestSchema>;
export type ProviderResponse = z.infer<typeof providerResponseSchema>;
export type LLMCallTrace = z.infer<typeof llmCallTraceSchema>;
