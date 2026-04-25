import assert from "node:assert/strict";
import test from "node:test";

import {
  createLLMCallRecorder,
  type LLMCallRecord,
  type ProviderRequest
} from "../index.js";

function createProviderRequest(): ProviderRequest {
  return {
    requestId: "req-recorder-1",
    taskKind: "visible_outcome_render",
    mode: "render",
    modelRef: "local-model",
    messages: [
      {
        role: "system",
        content: "Return compact JSON only."
      },
      {
        role: "user",
        content: "Render the already resolved scene outcome."
      }
    ],
    responseFormat: "json_object",
    maxInputTokens: 700,
    maxOutputTokens: 160,
    temperature: 0.2,
    timeoutMs: 1000
  };
}

test("records provider request and response with trace linkage", async () => {
  const persisted: LLMCallRecord[] = [];
  const recorder = createLLMCallRecorder({
    maxEntries: 5,
    idFactory: (prefix) => `${prefix}-fixed`,
    now: (() => {
      const dates = [
        new Date("2026-04-25T10:00:00.000Z"),
        new Date("2026-04-25T10:00:00.125Z")
      ];

      return () => dates.shift() ?? new Date("2026-04-25T10:00:00.125Z");
    })(),
    sink: {
      append: (record) => {
        persisted.push(record);
      }
    }
  });

  const response = await recorder.recordInvocation(
    {
      request: createProviderRequest(),
      stageName: "act",
      invocationDecision: "authorized_and_needed",
      worldTick: 185,
      npcId: "npc-doctor",
      persist: true
    },
    async () => ({
      requestId: "req-recorder-1",
      providerName: "local",
      modelRef: "local-model",
      finishReason: "stop",
      rawText: "{\"visibleText\":\"The doctor lowers his voice.\"}",
      usage: {
        inputTokens: 31,
        outputTokens: 9
      }
    })
  );

  const recent = recorder.getRecentCalls();

  assert.equal(response.finishReason, "stop");
  assert.equal(recent.length, 1);
  assert.equal(recent[0]?.traceId, "llm-trace-fixed");
  assert.equal(recent[0]?.requestId, "req-recorder-1");
  assert.equal(recent[0]?.worldTick, 185);
  assert.equal(recent[0]?.npcId, "npc-doctor");
  assert.equal(recent[0]?.durationMs, 125);
  assert.deepEqual(recent[0]?.request.messages.map((message) => message.role), [
    "system",
    "user"
  ]);
  assert.equal(recent[0]?.response.providerName, "local");
  assert.equal(recent[0]?.trace.metadata?.requestId, "req-recorder-1");
  assert.equal(recent[0]?.trace.finishReason, "stop");
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0]?.traceId, "llm-trace-fixed");
});

test("keeps a bounded recent call buffer and truncates text previews", async () => {
  const recorder = createLLMCallRecorder({
    maxEntries: 2,
    maxTextPreviewChars: 8,
    idFactory: (() => {
      let next = 0;
      return (prefix) => `${prefix}-${++next}`;
    })()
  });

  for (const requestId of ["req-1", "req-2", "req-3"]) {
    await recorder.recordInvocation(
      {
        request: {
          ...createProviderRequest(),
          requestId,
          messages: [
            {
              role: "user",
              content: "0123456789abcdef"
            }
          ]
        },
        stageName: "act",
        invocationDecision: "authorized_and_needed"
      },
      async (request) => ({
        requestId: request.requestId,
        providerName: "mock",
        modelRef: request.modelRef,
        finishReason: "stop",
        rawText: "abcdefghijklmnopqrstuvwxyz"
      })
    );
  }

  const recent = recorder.getRecentCalls();

  assert.deepEqual(
    recent.map((record) => record.requestId),
    ["req-2", "req-3"]
  );
  assert.equal(recent[0]?.request.messages[0]?.contentPreview, "01234567");
  assert.equal(recent[0]?.response.rawTextPreview, "abcdefgh");
});
