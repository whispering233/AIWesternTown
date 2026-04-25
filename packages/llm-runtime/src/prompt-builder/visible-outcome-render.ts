import type { BudgetLevel, PromptBlock, PromptSpec } from "@ai-western-town/contracts";

import type { VisibleOutcomeRenderResult } from "../guard/index.js";

export type VisibleOutcomeRenderPromptInput = {
  executionId: string;
  actorId: string;
  actionType: string;
  outcome: "success" | "partial" | "blocked" | "failed";
  outcomeReasonTags: string[];
  executionSummary: string;
  resolvedFacts: string[];
  visibleOutcome: {
    narrationLine?: string;
    dialogueLine?: string;
    gestureTags: string[];
    observerActorIds: string[];
  };
  audience: {
    observerActorIds: string[];
    perspective?: string;
    scenePrivacy?: "public" | "semi_public" | "private";
  };
  styleTags: string[];
  toneTags?: string[];
  maxVisibleTextChars: number;
  fallbackVisibleText?: string;
};

export type PromptBuildOptions = {
  budgetLevel?: BudgetLevel;
  includeAssistantExample?: boolean;
  traceTags?: string[];
};

const VISIBLE_OUTCOME_INPUT_BUDGET_TOKENS = 700;
const VISIBLE_OUTCOME_OUTPUT_BUDGET_TOKENS = 160;

export function buildVisibleOutcomeRenderPromptSpec(
  input: VisibleOutcomeRenderPromptInput,
  options: PromptBuildOptions = {}
): PromptSpec {
  const blocks: PromptBlock[] = [
    createBlock({
      key: "visible_outcome_policy",
      kind: "policy",
      role: "system",
      priority: "must_have",
      content: [
        "You are a constrained visible-text renderer for an NPC simulation.",
        "You are not the rule engine and cannot change execution facts.",
        "Return strict compact JSON only.",
        "Only fill player-visible text and authorized gesture tags."
      ].join("\n")
    }),
    createBlock({
      key: "visible_outcome_task",
      kind: "task",
      role: "user",
      priority: "must_have",
      content: [
        "Task: render the already resolved visible outcome.",
        "Use only the authoritative result and resolved facts below.",
        "Do not add new events, locations, relationships, secrets, outcomes, or state changes.",
        `Maximum visibleText length: ${input.maxVisibleTextChars} characters.`
      ].join("\n")
    }),
    createBlock({
      key: "visible_outcome_authoritative_result",
      kind: "context",
      role: "user",
      priority: "must_have",
      content: stringifySection("Authoritative execution result", {
        executionId: input.executionId,
        actorId: input.actorId,
        actionType: input.actionType,
        outcome: input.outcome,
        outcomeReasonTags: input.outcomeReasonTags,
        executionSummary: input.executionSummary,
        visibleOutcome: input.visibleOutcome,
        audience: input.audience,
        styleTags: input.styleTags,
        toneTags: input.toneTags ?? []
      })
    }),
    createBlock({
      key: "visible_outcome_resolved_facts",
      kind: "evidence",
      role: "user",
      priority: "important",
      content: stringifySection("Resolved facts allowed for rendering", {
        resolvedFacts: input.resolvedFacts
      }),
      canSummarize: true,
      canDrop: false
    }),
    createBlock({
      key: "visible_outcome_schema",
      kind: "schema",
      role: "user",
      priority: "must_have",
      content: [
        "Return exactly one JSON object with this shape:",
        '{"visibleText":"string","gestureTags":["string"]}',
        "Allowed fields: visibleText, gestureTags.",
        "Forbidden fields: outcome, outcomeReasonTags, actionType, stateMutations, emittedEvents, privateOutcome, shouldReflect.",
        "visibleText must be non-empty and must not exceed the configured maximum length.",
        "gestureTags must only reuse authorized style or gesture tags from the input."
      ].join("\n")
    })
  ];

  if (options.includeAssistantExample) {
    blocks.push(
      createBlock({
        key: "visible_outcome_example",
        kind: "example",
        role: "assistant",
        priority: "optional",
        content: '{"visibleText":"The doctor answers carefully.","gestureTags":["calm"]}',
        canDrop: true
      })
    );
  }

  return {
    taskKind: "visible_outcome_render",
    stageName: "act",
    purpose:
      "Render a compact player-visible line from an already resolved action execution result.",
    blocks,
    outputSchema: {
      schemaName: "VisibleOutcomeRenderResult",
      jsonShape: '{"visibleText":"string","gestureTags":["string"]}',
      validationRules: [
        "Only visibleText and gestureTags are allowed output fields.",
        "Do not return outcome, actionType, stateMutations, emittedEvents, privateOutcome, or shouldReflect.",
        "visibleText must be non-empty and must not exceed maxVisibleTextChars.",
        "gestureTags must only reuse authorized style or gesture tags.",
        "The rendered text must not introduce facts outside resolvedFacts and the authoritative execution result."
      ]
    },
    inputBudgetTokens: VISIBLE_OUTCOME_INPUT_BUDGET_TOKENS,
    outputBudgetTokens: VISIBLE_OUTCOME_OUTPUT_BUDGET_TOKENS,
    budgetLevel: options.budgetLevel ?? "normal",
    providerHints: {
      mode: "render",
      temperature: 0.2,
      topP: 0.9
    },
    debugMeta: {
      builderName: "VisibleOutcomeRenderPromptBuilder",
      traceTags: options.traceTags ?? [],
      sourceStage: "act"
    }
  };
}

export function buildVisibleOutcomeFallback(
  input: VisibleOutcomeRenderPromptInput
): VisibleOutcomeRenderResult {
  const visibleTextSource =
    input.fallbackVisibleText ??
    input.visibleOutcome.dialogueLine ??
    input.visibleOutcome.narrationLine ??
    input.executionSummary ??
    `${input.actorId} action resolved with outcome ${input.outcome}.`;

  return {
    visibleText: truncateVisibleText(
      visibleTextSource,
      input.maxVisibleTextChars
    ),
    gestureTags: [...input.visibleOutcome.gestureTags]
  };
}

function createBlock(block: PromptBlock): PromptBlock {
  return {
    ...block,
    estimatedTokens: estimateTokens(block.content)
  };
}

function stringifySection(title: string, value: unknown): string {
  return `${title}:\n${JSON.stringify(value, null, 2)}`;
}

function estimateTokens(content: string): number {
  return Math.max(1, Math.ceil(content.length / 4));
}

function truncateVisibleText(text: string, maxChars: number): string {
  const normalized = text.trim();

  if (normalized.length <= maxChars) {
    return normalized;
  }

  if (maxChars <= 3) {
    return normalized.slice(0, maxChars);
  }

  return `${normalized.slice(0, maxChars - 3).trimEnd()}...`;
}
