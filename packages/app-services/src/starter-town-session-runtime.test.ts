import assert from "node:assert/strict";
import test from "node:test";

import type { PlayerCommandEnvelope, ProviderRequest, ProviderResponse } from "@ai-western-town/contracts";
import { createMemoryLogger } from "@ai-western-town/observability";

import { createStarterTownSessionRuntime } from "./index.js";

function createCommand(): PlayerCommandEnvelope {
  return {
    commandId: "cmd-approach-bartender",
    commandType: "social",
    parsedAction: {
      actionId: "act-approach-bartender",
      actionClass: "intervene",
      actionType: "ask_bartender_about_room",
      targetActorId: "bartender",
      targetNpcId: "bartender",
      tags: ["social", "probe", "public"]
    },
    issuedAtTick: 0,
    consumesTick: true,
    metadata: {
      commandText: "问问酒保刚才为什么突然安静"
    }
  };
}

test("starter town session runtime runs game, cognition, and visible outcome LLM rendering", async () => {
  const providerRequests: ProviderRequest[] = [];
  const runtime = createStarterTownSessionRuntime({
    modelRef: "test-local-model",
    llmGateway: {
      getProvider() {
        throw new Error("getProvider is not used by this app-service test.");
      },
      async healthCheck() {
        return {
          providerName: "fake-local",
          ok: true
        };
      },
      async invoke(request: ProviderRequest): Promise<ProviderResponse> {
        providerRequests.push(request);

        return {
          requestId: request.requestId,
          providerName: "fake-local",
          modelRef: request.modelRef,
          finishReason: "stop",
          rawText:
            '{"visibleText":"Mara keeps her answer short.","gestureTags":["guarded"]}',
          usage: {
            inputTokens: 42,
            outputTokens: 9
          }
        };
      }
    }
  });
  const initialState = runtime.createInitialState({
    currentSceneId: "saloon"
  });

  const result = await runtime.submitCommand(initialState, createCommand());

  assert.equal(result.nextState.worldTick, 1);
  assert.equal(providerRequests.length, 1);
  assert.equal(providerRequests[0]?.taskKind, "visible_outcome_render");
  assert.equal(providerRequests[0]?.modelRef, "test-local-model");
  assert.ok(
    result.worldEvents.some((event) =>
      event.summary?.includes("Mara keeps her answer short.")
    )
  );
  assert.equal(
    result.worldEvents.find((event) => event.payload?.llmTraceId)
      ?.sourceCommandId,
    "cmd-approach-bartender"
  );
  assert.equal(result.tickTrace.llmTraceIds?.length, 1);
  assert.equal(result.tickTrace.npcExecutions.length > 0, true);
  assert.equal(result.llmCalls.length, 1);
  assert.equal(result.llmCalls[0]?.traceId, result.tickTrace.llmTraceIds?.[0]);
});

test("starter town session runtime logs submitCommand success stages", async () => {
  const memory = createMemoryLogger();
  const runtime = createStarterTownSessionRuntime({
    logger: memory.logger,
    modelRef: "test-local-model",
    llmGateway: {
      getProvider() {
        throw new Error("getProvider is not used by this app-service test.");
      },
      async healthCheck() {
        return {
          providerName: "fake-local",
          ok: true
        };
      },
      async invoke(request: ProviderRequest): Promise<ProviderResponse> {
        return {
          requestId: request.requestId,
          providerName: "fake-local",
          modelRef: request.modelRef,
          finishReason: "stop",
          rawText:
            "{\"visibleText\":\"Mara keeps her answer short.\",\"gestureTags\":[\"guarded\"]}"
        };
      }
    }
  });
  const initialState = runtime.createInitialState({
    currentSceneId: "saloon"
  });

  await runtime.submitCommand(initialState, createCommand(), {
    requestId: "req-1",
    sessionId: "session-1"
  });

  const events = memory.records.map((record) => record.fields.event);

  assert.deepEqual(
    events.filter((event) => String(event).startsWith("submitCommand")),
    [
      "submitCommand.start",
      "submitCommand.worldTick.done",
      "submitCommand.npcCognition.done",
      "submitCommand.done"
    ]
  );
  assert.equal(memory.records[0]?.fields.requestId, "req-1");
  assert.equal(memory.records[0]?.fields.sessionId, "session-1");
  assert.equal(memory.records[0]?.fields.commandId, "cmd-approach-bartender");
});

test("starter town session runtime logs visible outcome fallback", async () => {
  const memory = createMemoryLogger();
  const runtime = createStarterTownSessionRuntime({
    logger: memory.logger,
    modelRef: "test-local-model",
    llmGateway: {
      getProvider() {
        throw new Error("getProvider is not used by this app-service test.");
      },
      async healthCheck() {
        return {
          providerName: "fake-local",
          ok: true
        };
      },
      async invoke(request: ProviderRequest): Promise<ProviderResponse> {
        return {
          requestId: request.requestId,
          providerName: "fake-local",
          modelRef: request.modelRef,
          finishReason: "timeout",
          rawText: "",
          errorCode: "provider_timeout",
          errorMessage: "Model service timed out."
        };
      }
    }
  });

  await runtime.submitCommand(
    runtime.createInitialState({
      currentSceneId: "saloon"
    }),
    createCommand(),
    {
      requestId: "req-2",
      sessionId: "session-2"
    }
  );

  const fallbackEvent = memory.records.find(
    (record) => record.fields.event === "llm.visibleOutcome.fallback"
  )?.fields;

  assert.equal(fallbackEvent?.requestId, "req-2");
  assert.equal(fallbackEvent?.reason, "timeout");
});
