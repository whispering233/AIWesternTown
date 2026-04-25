import assert from "node:assert/strict";
import test from "node:test";

import { createLLMTraceStore, linkLLMTraceToTickTrace } from "../index.js";
import type { LLMCallTrace, TickTraceRecord } from "@ai-western-town/contracts";

function createLLMTrace(traceId: string, requestId: string): LLMCallTrace {
  return {
    traceId,
    taskKind: "visible_outcome_render",
    stageName: "act",
    invocationDecision: "authorized_and_needed",
    providerName: "local",
    modelRef: "local-model",
    finishReason: "stop",
    metadata: {
      requestId
    }
  };
}

function createTickTrace(): TickTraceRecord {
  return {
    traceId: "tick-trace-1",
    worldTick: 185,
    playerCommand: {
      commandId: "cmd-1",
      commandType: "observe",
      parsedAction: {
        actionType: "look"
      },
      issuedAtTick: 184,
      consumesTick: true
    },
    runModeBefore: "free_explore",
    runModeAfter: "settle",
    scheduleDecisions: {
      foregroundFullNpcIds: [],
      foregroundReactiveNpcIds: [],
      nearFieldLightNpcIds: [],
      nearFieldEscalatedNpcIds: [],
      deferredFarFieldNpcIds: []
    },
    npcExecutions: [],
    appendedEventIds: [],
    debugSummary: {
      worldTick: 185,
      runModeBefore: "free_explore",
      runModeAfter: "settle",
      promotedNpcIds: [],
      suppressedNpcIds: [],
      interruptCandidates: [],
      budgetNotes: []
    }
  };
}

test("stores recent llm traces by traceId and requestId", () => {
  const store = createLLMTraceStore({ maxEntries: 2 });

  store.appendLLMTrace(createLLMTrace("llm-trace-1", "req-1"));
  store.appendLLMTrace(createLLMTrace("llm-trace-2", "req-2"));
  store.appendLLMTrace(createLLMTrace("llm-trace-3", "req-3"));

  assert.equal(store.getLLMTraceByTraceId("llm-trace-1"), undefined);
  assert.equal(store.getLLMTraceByTraceId("llm-trace-3")?.traceId, "llm-trace-3");
  assert.equal(store.getLLMTraceByRequestId("req-2")?.traceId, "llm-trace-2");
  assert.deepEqual(
    store.listRecentLLMTraces().map((trace) => trace.traceId),
    ["llm-trace-2", "llm-trace-3"]
  );
});

test("links llm trace ids onto tick traces without duplicates", () => {
  const linked = linkLLMTraceToTickTrace(createTickTrace(), "llm-trace-1");
  const relinked = linkLLMTraceToTickTrace(linked, "llm-trace-1");

  assert.deepEqual(relinked.llmTraceIds, ["llm-trace-1"]);
});
