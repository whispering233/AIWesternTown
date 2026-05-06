import assert from "node:assert/strict";
import test from "node:test";

import {
  createCloudProviderPlaceholder,
  createLocalProvider,
  createMockProvider,
  type ProviderRequest
} from "./index.js";
import { createMemoryLogger } from "@ai-western-town/observability";

function createProviderRequest(): ProviderRequest {
  return {
    requestId: "req-provider-1",
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
}

test("mock provider returns a deterministic structured provider response", async () => {
  const provider = createMockProvider({
    rawText: "{\"visibleText\":\"The doctor lowers his voice.\"}"
  });

  const response = await provider.invoke(createProviderRequest());

  assert.equal(provider.getName(), "mock");
  assert.equal(response.requestId, "req-provider-1");
  assert.equal(response.providerName, "mock");
  assert.equal(response.modelRef, "local-model");
  assert.equal(response.finishReason, "stop");
  assert.equal(
    response.rawText,
    "{\"visibleText\":\"The doctor lowers his voice.\"}"
  );
  assert.equal(provider.getCapabilities().supportsMockFallback, true);
});

test("local provider calls an OpenAI-compatible chat completion endpoint", async () => {
  const request = createProviderRequest();
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;

  const provider = createLocalProvider({
    baseUrl: "http://127.0.0.1:1234/v1",
    fetchFn: async (
      url: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1]
    ) => {
      capturedUrl = String(url);
      capturedInit = init;

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "{\"visibleText\":\"The saloon goes still.\"}"
              },
              finish_reason: "stop"
            }
          ],
          usage: {
            prompt_tokens: 31,
            completion_tokens: 9
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }
  });

  const response = await provider.invoke(request);
  const body = JSON.parse(String(capturedInit?.body));

  assert.equal(
    capturedUrl,
    "http://127.0.0.1:1234/v1/chat/completions"
  );
  assert.equal(capturedInit?.method, "POST");
  assert.deepEqual(body.messages, request.messages);
  assert.equal(body.model, "local-model");
  assert.deepEqual(body.response_format, {
    type: "json_object"
  });
  assert.equal(body.max_tokens, 160);
  assert.equal(body.temperature, 0.2);
  assert.equal(body.top_p, 0.9);
  assert.equal(response.providerName, "local");
  assert.equal(response.finishReason, "stop");
  assert.equal(response.rawText, "{\"visibleText\":\"The saloon goes still.\"}");
  assert.deepEqual(response.usage, {
    inputTokens: 31,
    outputTokens: 9
  });
});

test("local provider accepts an OpenAI-compatible server root base URL", async () => {
  let capturedUrl = "";

  const provider = createLocalProvider({
    baseUrl: "http://127.0.0.1:1234",
    fetchFn: async (
      url: Parameters<typeof fetch>[0],
      _init?: Parameters<typeof fetch>[1]
    ) => {
      capturedUrl = String(url);

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "root base URL works"
              },
              finish_reason: "stop"
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }
  });

  const response = await provider.invoke(createProviderRequest());

  assert.equal(
    capturedUrl,
    "http://127.0.0.1:1234/v1/chat/completions"
  );
  assert.equal(response.finishReason, "stop");
  assert.equal(response.rawText, "root base URL works");
});

test("local provider downgrades JSON object response format when capability is disabled", async () => {
  let capturedBody: Record<string, unknown> | undefined;
  const provider = createLocalProvider({
    baseUrl: "http://127.0.0.1:1234/v1",
    capabilities: {
      supportsJsonObject: false
    },
    fetchFn: async (
      _url: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1]
    ) => {
      capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "{\"visibleText\":\"Text mode still follows JSON prompt.\"}"
              },
              finish_reason: "stop"
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }
  });

  const response = await provider.invoke(createProviderRequest());

  assert.deepEqual(capturedBody?.response_format, {
    type: "text"
  });
  assert.equal(
    response.rawText,
    "{\"visibleText\":\"Text mode still follows JSON prompt.\"}"
  );
});

test("local provider health check rejects OpenAI-compatible error payloads", async () => {
  const provider = createLocalProvider({
    baseUrl: "http://127.0.0.1:1234",
    fetchFn: async () =>
      new Response(JSON.stringify({ error: "Unexpected endpoint or method." }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      })
  });

  const health = await provider.healthCheck();

  assert.equal(health.ok, false);
  assert.equal(health.errorCode, "provider_health_error");
  assert.match(health.errorMessage ?? "", /Unexpected endpoint or method/);
});

test("local provider returns structured errors for failed model calls", async () => {
  const provider = createLocalProvider({
    baseUrl: "http://127.0.0.1:1234/v1",
    fetchFn: async () =>
      new Response("model not loaded", {
        status: 503,
        statusText: "Service Unavailable"
      })
  });

  const response = await provider.invoke(createProviderRequest());

  assert.equal(response.providerName, "local");
  assert.equal(response.finishReason, "error");
  assert.equal(response.errorCode, "provider_http_error");
  assert.match(response.errorMessage ?? "", /503/);
  assert.match(response.errorMessage ?? "", /model not loaded/);
});

test("local provider treats fetch abort-shaped errors as timeouts", async () => {
  const provider = createLocalProvider({
    baseUrl: "http://127.0.0.1:1234/v1",
    fetchFn: async () => {
      const error = new Error("This operation was aborted");
      error.name = "AbortError";

      throw error;
    }
  });

  const response = await provider.invoke(createProviderRequest());

  assert.equal(response.providerName, "local");
  assert.equal(response.finishReason, "timeout");
  assert.equal(response.errorCode, "provider_timeout");
  assert.match(response.errorMessage ?? "", /1000ms/);
});

test("cloud provider placeholder returns a structured not-configured error", async () => {
  const provider = createCloudProviderPlaceholder();

  const response = await provider.invoke(createProviderRequest());

  assert.equal(provider.getName(), "cloud");
  assert.equal(response.providerName, "cloud");
  assert.equal(response.finishReason, "error");
  assert.equal(response.errorCode, "cloud_provider_not_configured");
  assert.equal(response.rawText, "");
});

test("local provider logs LLM request and response without authorization headers", async () => {
  const memory = createMemoryLogger();
  const provider = createLocalProvider({
    baseUrl: "http://127.0.0.1:1234/v1",
    apiKey: "secret-key",
    logger: memory.logger,
    llmLogging: {
      enabled: true,
      includeMessages: true,
      includeRawResponse: true,
      includeStack: true,
      maxTextLength: 1000
    },
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "{\"visibleText\":\"Logged response.\"}"
              },
              finish_reason: "stop"
            }
          ],
          usage: {
            prompt_tokens: 3,
            completion_tokens: 4
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
  });

  const response = await provider.invoke(createProviderRequest());
  const events = memory.records.map((record) => record.fields);

  assert.equal(response.finishReason, "stop");
  assert.equal(events[0]?.event, "llm.request");
  assert.equal(events[1]?.event, "llm.response");
  assert.equal(events[0]?.provider, "local");
  assert.equal(events[0]?.model, "local-model");
  assert.deepEqual(events[0]?.messages, createProviderRequest().messages);
  assert.equal(events[1]?.rawText, "{\"visibleText\":\"Logged response.\"}");
  assert.equal(JSON.stringify(events).includes("secret-key"), false);
  assert.equal(JSON.stringify(events).includes("authorization"), false);
});

test("local provider logs AbortError details before returning timeout response", async () => {
  const memory = createMemoryLogger();
  const provider = createLocalProvider({
    baseUrl: "http://127.0.0.1:1234/v1",
    logger: memory.logger,
    llmLogging: {
      enabled: true,
      includeMessages: true,
      includeRawResponse: true,
      includeStack: true,
      maxTextLength: 1000
    },
    fetchFn: async () => {
      const error = new Error("This operation was aborted");
      error.name = "AbortError";
      throw error;
    }
  });

  const response = await provider.invoke(createProviderRequest());
  const errorEvent = memory.records.find(
    (record) => record.fields.event === "llm.error"
  )?.fields;

  assert.equal(response.finishReason, "timeout");
  assert.equal(errorEvent?.errorName, "AbortError");
  assert.equal(errorEvent?.errorMessage, "This operation was aborted");
  assert.equal(typeof errorEvent?.durationMs, "number");
  assert.equal(typeof errorEvent?.stack, "string");
});

test("local provider logs non-2xx model responses as LLM errors", async () => {
  const memory = createMemoryLogger();
  const provider = createLocalProvider({
    baseUrl: "http://127.0.0.1:1234/v1",
    logger: memory.logger,
    llmLogging: {
      enabled: true,
      includeMessages: true,
      includeRawResponse: true,
      includeStack: true,
      maxTextLength: 1000
    },
    fetchFn: async () =>
      new Response("model not loaded", {
        status: 503,
        statusText: "Service Unavailable"
      })
  });

  const response = await provider.invoke(createProviderRequest());
  const errorEvent = memory.records.find(
    (record) => record.fields.event === "llm.error"
  )?.fields;

  assert.equal(response.finishReason, "error");
  assert.equal(response.errorCode, "provider_http_error");
  assert.equal(errorEvent?.finishReason, "error");
  assert.equal(errorEvent?.errorCode, "provider_http_error");
  assert.match(String(errorEvent?.errorMessage), /503/);
  assert.equal(errorEvent?.rawText, "model not loaded");
});
