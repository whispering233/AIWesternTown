import test from "node:test";
import assert from "node:assert/strict";

import {
  compiledPromptSchema,
  debugRecordSchema,
  playerCommandEnvelopeSchema,
  providerRequestSchema,
  taskKindSchema,
  worldEventWindowSchema
} from "./index";

test("accepts valid item player command envelopes", () => {
  const result = playerCommandEnvelopeSchema.safeParse({
    commandId: "cmd-1",
    commandType: "item",
    parsedAction: {
      actionType: "use_item",
      itemActionType: "drink",
      itemResolutionMode: "direct",
      targetActorId: "npc-doctor"
    },
    issuedAtTick: 184,
    consumesTick: true
  });

  assert.equal(result.success, true);
});

test("rejects item commands without item-specific parsed action fields", () => {
  const result = playerCommandEnvelopeSchema.safeParse({
    commandId: "cmd-2",
    commandType: "item",
    parsedAction: {
      actionType: "use_item"
    },
    issuedAtTick: 184,
    consumesTick: true
  });

  assert.equal(result.success, false);
});

test("accepts interrupt events inside a matching world event window", () => {
  const result = worldEventWindowSchema.safeParse({
    tickRange: {
      from: 185,
      to: 186
    },
    events: [
      {
        eventId: "evt-1",
        eventType: "gunshot",
        worldTick: 185,
        originSceneId: "saloon",
        actorIds: ["npc-outlaw"],
        targetIds: ["npc-sheriff"],
        tags: ["violence", "public"],
        heatLevel: "interrupt",
        interruptType: "violence",
        summary: "A gunshot breaks the conversation."
      }
    ]
  });

  assert.equal(result.success, true);
});

test("rejects interrupt events without interruptType", () => {
  const result = worldEventWindowSchema.safeParse({
    tickRange: {
      from: 185,
      to: 185
    },
    events: [
      {
        eventId: "evt-2",
        eventType: "reveal",
        worldTick: 185,
        originSceneId: "saloon",
        actorIds: ["npc-doctor"],
        heatLevel: "interrupt"
      }
    ]
  });

  assert.equal(result.success, false);
});

test("rejects compiled prompts with more than one assistant example", () => {
  const result = compiledPromptSchema.safeParse({
    messages: [
      {
        role: "system",
        content: "Return JSON only."
      },
      {
        role: "user",
        content: "Refine style tags."
      },
      {
        role: "assistant",
        content: "{\"styleTags\":[\"calm\"]}"
      },
      {
        role: "assistant",
        content: "{\"styleTags\":[\"firm\"]}"
      }
    ],
    roleSummary: {
      systemBlocks: ["policy"],
      userBlocks: ["task", "schema"],
      assistantBlocks: ["example_a", "example_b"]
    }
  });

  assert.equal(result.success, false);
});

test("rejects deep processing task kinds in first-version provider requests", () => {
  const taskKindResult = taskKindSchema.safeParse("deep_processing_integrate");
  assert.equal(taskKindResult.success, false);

  const requestResult = providerRequestSchema.safeParse({
    requestId: "req-1",
    taskKind: "deep_processing_integrate",
    mode: "classify",
    modelRef: "mock-small",
    messages: [
      {
        role: "system",
        content: "Return JSON only."
      }
    ],
    responseFormat: "json_object",
    maxInputTokens: 600,
    maxOutputTokens: 120,
    temperature: 0,
    timeoutMs: 1000
  });

  assert.equal(requestResult.success, false);
});

test("accepts llm_call debug records", () => {
  const result = debugRecordSchema.safeParse({
    recordId: "dbg-1",
    kind: "llm_call",
    worldTick: 185,
    createdAt: "2026-04-22T18:30:00+08:00",
    trace: {
      traceId: "trace-1",
      taskKind: "action_style_refine",
      stageName: "action_selection",
      invocationDecision: "authorized_and_needed",
      budgetLevel: "normal",
      providerName: "mock",
      modelRef: "mock-small",
      finishReason: "stop",
      parseResult: "success"
    }
  });

  assert.equal(result.success, true);
});
