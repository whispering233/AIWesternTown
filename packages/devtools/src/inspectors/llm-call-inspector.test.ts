import assert from "node:assert/strict";
import test from "node:test";

import { buildLLMDebugPanelModel } from "./llm-call-inspector.js";
import type { LLMInspectorCallRecord } from "./llm-call-inspector.js";

test("builds a bounded llm debug panel model with selected call details", () => {
  const model = buildLLMDebugPanelModel(
    [
      createRecord({
        recordId: "llm-record-1",
        traceId: "llm-trace-1",
        requestId: "req-1",
        startedAt: "2026-04-25T09:58:00.000Z"
      }),
      createRecord({
        recordId: "llm-record-2",
        traceId: "llm-trace-2",
        requestId: "req-2",
        startedAt: "2026-04-25T10:00:00.000Z",
        parseResult: "schema_violation",
        fallbackReason: "guard_rejected_forbidden_field",
        rawTextPreview: "{\"actionType\":\"leave_scene\"}"
      }),
      createRecord({
        recordId: "llm-record-3",
        traceId: "llm-trace-3",
        requestId: "req-3",
        startedAt: "2026-04-25T10:01:00.000Z"
      })
    ],
    {
      maxCalls: 2,
      selectedRequestId: "req-2"
    }
  );

  assert.deepEqual(
    model.calls.map((call) => call.requestId),
    ["req-3", "req-2"]
  );
  assert.equal(model.selectedCall?.recordId, "llm-record-2");
  assert.equal(model.selectedCall?.prompt.messages[0]?.role, "system");
  assert.equal(
    model.selectedCall?.prompt.messages[0]?.contentPreview,
    "Return JSON only."
  );
  assert.equal(
    model.selectedCall?.rawOutput.rawTextPreview,
    "{\"actionType\":\"leave_scene\"}"
  );
  assert.equal(
    model.selectedCall?.parsedFallback.parseResult,
    "schema_violation"
  );
  assert.equal(
    model.selectedCall?.parsedFallback.fallbackReason,
    "guard_rejected_forbidden_field"
  );
  assert.equal(model.selectedCall?.parsedFallback.trimmedBlocksLabel, "history_2");
});

test("selects the newest recent llm call by default", () => {
  const model = buildLLMDebugPanelModel([
    createRecord({
      recordId: "llm-record-1",
      traceId: "llm-trace-1",
      requestId: "req-1",
      startedAt: "2026-04-25T09:58:00.000Z"
    }),
    createRecord({
      recordId: "llm-record-2",
      traceId: "llm-trace-2",
      requestId: "req-2",
      startedAt: "2026-04-25T10:00:00.000Z"
    })
  ]);

  assert.equal(model.selectedCall?.requestId, "req-2");
  assert.equal(model.calls[0]?.requestId, "req-2");
});

test("builds an empty model when there are no recent llm calls", () => {
  const model = buildLLMDebugPanelModel([]);

  assert.equal(model.calls.length, 0);
  assert.equal(model.selectedCall, undefined);
  assert.match(model.emptyMessage, /No LLM calls/i);
});

function createRecord(
  overrides: {
    recordId: string;
    traceId: string;
    requestId: string;
    startedAt: string;
    parseResult?: string;
    fallbackReason?: string;
    rawTextPreview?: string;
  }
): LLMInspectorCallRecord {
  return {
    recordId: overrides.recordId,
    traceId: overrides.traceId,
    requestId: overrides.requestId,
    taskKind: "visible_outcome_render",
    stageName: "act",
    invocationDecision: "authorized_and_needed",
    worldTick: 185,
    npcId: "npc-doctor",
    tags: ["llm", "visible"],
    startedAt: overrides.startedAt,
    completedAt: "2026-04-25T10:00:00.125Z",
    durationMs: 125,
    persisted: false,
    metadata: {
      requestId: overrides.requestId
    },
    request: {
      taskKind: "visible_outcome_render",
      mode: "render",
      modelRef: "local-model",
      responseFormat: "json_object",
      maxInputTokens: 700,
      maxOutputTokens: 160,
      temperature: 0.2,
      timeoutMs: 1000,
      messages: [
        {
          role: "system",
          contentLength: 17,
          contentPreview: "Return JSON only."
        },
        {
          role: "user",
          contentLength: 42,
          contentPreview: "Render the resolved visible outcome."
        }
      ]
    },
    response: {
      providerName: "local",
      modelRef: "local-model",
      finishReason: "stop",
      rawTextLength: overrides.rawTextPreview?.length ?? 45,
      rawTextPreview:
        overrides.rawTextPreview ??
        "{\"visibleText\":\"The doctor lowers his voice.\"}",
      usage: {
        inputTokens: 31,
        outputTokens: 9
      },
      capabilityFlags: ["json_object"]
    },
    trace: {
      traceId: overrides.traceId,
      taskKind: "visible_outcome_render",
      stageName: "act",
      invocationDecision: "authorized_and_needed",
      builderName: "VisibleOutcomeRenderPromptBuilder",
      budgetLevel: "normal",
      trimmedBlocks: ["history_2"],
      providerName: "local",
      modelRef: "local-model",
      finishReason: "stop",
      parseResult: overrides.parseResult ?? "success",
      fallbackReason: overrides.fallbackReason,
      metadata: {
        requestId: overrides.requestId
      }
    }
  };
}
