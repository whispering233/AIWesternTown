import assert from "node:assert/strict";
import test from "node:test";

import type {
  LLMCallTrace,
  Metadata,
  ProviderRequest,
  ProviderResponse
} from "@ai-western-town/contracts";

import {
  createLLMFixtureReplayProvider,
  exportLLMCallFixture
} from "../index.js";

test("exports a full llm call record as a provider-neutral fixture", () => {
  assert.equal(typeof exportLLMCallFixture, "function");

  const source = createSourceRecord();
  const fixture = exportLLMCallFixture(source, {
    exportedAt: "2026-04-26T08:00:00.000Z"
  });

  assert.equal(fixture.format, "ai-western-town.llm-fixture");
  assert.equal(fixture.version, 1);
  assert.equal(fixture.exportedAt, "2026-04-26T08:00:00.000Z");
  assert.equal(fixture.source.recordId, "llm-record-1");
  assert.equal(fixture.source.providerName, "local");
  assert.equal(
    fixture.request.messages[1]?.content,
    source.replay.request.messages[1]?.content
  );
  assert.equal(fixture.response.rawText, source.replay.response.rawText);
  assert.deepEqual(fixture.trace, source.trace);
});

test("replays a fixture through the same invoke contract as a real provider", async () => {
  assert.equal(typeof createLLMFixtureReplayProvider, "function");

  const fixture = exportLLMCallFixture(createSourceRecord(), {
    exportedAt: "2026-04-26T08:00:00.000Z"
  });
  const provider = createLLMFixtureReplayProvider([fixture]);
  const incomingRequest: ProviderRequest = {
    ...fixture.request,
    requestId: "req-replayed-live"
  };

  const response = await provider.invoke(incomingRequest);
  const miss = await provider.invoke({
    ...incomingRequest,
    requestId: "req-miss",
    messages: [
      {
        role: "user",
        content: "This request was never recorded."
      }
    ]
  });
  const health = await provider.healthCheck();

  assert.equal(provider.getName(), "fixture-replay");
  assert.equal(response.requestId, "req-replayed-live");
  assert.equal(response.providerName, "local");
  assert.equal(response.finishReason, "stop");
  assert.equal(
    response.rawText,
    "{\"visibleText\":\"The doctor lowers his voice.\"}"
  );
  assert.deepEqual(response.usage, {
    inputTokens: 31,
    outputTokens: 9
  });
  assert.equal(miss.finishReason, "error");
  assert.equal(miss.errorCode, "fixture_replay_miss");
  assert.equal(miss.rawText, "");
  assert.deepEqual(health, {
    providerName: "fixture-replay",
    ok: true
  });
});

test("matches replay requests by provider fields without depending on object key order", async () => {
  const fixture = exportLLMCallFixture(createSourceRecord(), {
    exportedAt: "2026-04-26T08:00:00.000Z"
  });
  const provider = createLLMFixtureReplayProvider([fixture]);
  const reorderedRequest: ProviderRequest = {
    messages: fixture.request.messages,
    timeoutMs: fixture.request.timeoutMs,
    topP: fixture.request.topP,
    temperature: fixture.request.temperature,
    maxOutputTokens: fixture.request.maxOutputTokens,
    maxInputTokens: fixture.request.maxInputTokens,
    responseFormat: fixture.request.responseFormat,
    modelRef: fixture.request.modelRef,
    mode: fixture.request.mode,
    taskKind: fixture.request.taskKind,
    requestId: "req-reordered"
  };

  const response = await provider.invoke(reorderedRequest);

  assert.equal(response.requestId, "req-reordered");
  assert.equal(response.finishReason, "stop");
  assert.equal(
    response.rawText,
    "{\"visibleText\":\"The doctor lowers his voice.\"}"
  );
});

function createSourceRecord(): {
  recordId: string;
  traceId: string;
  requestId: string;
  taskKind: ProviderRequest["taskKind"];
  stageName: string;
  invocationDecision: string;
  worldTick: number;
  npcId: string;
  tags: string[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  replay: {
    request: ProviderRequest;
    response: ProviderResponse;
  };
  trace: LLMCallTrace;
  metadata: Metadata;
  persisted: boolean;
} {
  const request: ProviderRequest = {
    requestId: "req-fixture-1",
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
    topP: 0.9,
    timeoutMs: 1000
  };
  const response: ProviderResponse = {
    requestId: "req-fixture-1",
    providerName: "local",
    modelRef: "local-model",
    finishReason: "stop",
    rawText: "{\"visibleText\":\"The doctor lowers his voice.\"}",
    usage: {
      inputTokens: 31,
      outputTokens: 9
    },
    capabilityFlags: ["json_object", "system_role"]
  };
  const trace: LLMCallTrace = {
    traceId: "llm-trace-1",
    taskKind: "visible_outcome_render",
    stageName: "act",
    invocationDecision: "authorized_and_needed",
    providerName: "local",
    modelRef: "local-model",
    finishReason: "stop",
    parseResult: "success",
    metadata: {
      requestId: "req-fixture-1"
    }
  };

  return {
    recordId: "llm-record-1",
    traceId: "llm-trace-1",
    requestId: "req-fixture-1",
    taskKind: "visible_outcome_render",
    stageName: "act",
    invocationDecision: "authorized_and_needed",
    worldTick: 185,
    npcId: "npc-doctor",
    tags: ["llm", "visible"],
    startedAt: "2026-04-25T10:00:00.000Z",
    completedAt: "2026-04-25T10:00:00.125Z",
    durationMs: 125,
    replay: {
      request,
      response
    },
    trace,
    metadata: {
      requestId: "req-fixture-1"
    },
    persisted: true
  };
}
