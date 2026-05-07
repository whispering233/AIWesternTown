import assert from "node:assert/strict";
import test from "node:test";

import {
  createLLMGateway,
  createLLMGatewayConfigFromEnv,
  type ProviderRequest
} from "./index.js";
import { createMemoryLogger } from "@ai-western-town/observability";

function createProviderRequest(): ProviderRequest {
  return {
    requestId: "req-gateway-1",
    taskKind: "action_style_refine",
    mode: "classify",
    modelRef: "mock-model",
    messages: [
      {
        role: "system",
        content: "Return JSON only."
      },
      {
        role: "user",
        content: "Refine style tags."
      }
    ],
    responseFormat: "json_object",
    maxInputTokens: 450,
    maxOutputTokens: 100,
    temperature: 0,
    timeoutMs: 1000
  };
}

test("gateway switches providers through explicit configuration", async () => {
  const gateway = createLLMGateway({
    provider: "mock",
    mock: {
      rawText: "{\"styleTags\":[\"calm\"],\"selectionReason\":\"steady\"}"
    }
  });

  const response = await gateway.invoke(createProviderRequest());

  assert.equal(gateway.getProvider().getName(), "mock");
  assert.equal(response.providerName, "mock");
  assert.equal(
    response.rawText,
    "{\"styleTags\":[\"calm\"],\"selectionReason\":\"steady\"}"
  );
});

test("gateway logs mock provider LLM request and response when enabled", async () => {
  const memory = createMemoryLogger();
  const gateway = createLLMGateway(
    {
      provider: "mock",
      mock: {
        rawText: "{\"styleTags\":[\"calm\"],\"selectionReason\":\"steady\"}"
      }
    },
    {
      logger: memory.logger,
      llmLogging: {
        enabled: true,
        includeMessages: true,
        includeRawResponse: true,
        includeStack: true,
        maxTextLength: 1000
      }
    }
  );

  const response = await gateway.invoke(createProviderRequest());
  const events = memory.records.map((record) => record.fields);

  assert.equal(response.finishReason, "stop");
  assert.equal(events[0]?.event, "llm.request");
  assert.equal(events[0]?.provider, "mock");
  assert.equal(events[0]?.model, "mock-model");
  assert.deepEqual(events[0]?.messages, createProviderRequest().messages);
  assert.equal(events[1]?.event, "llm.response");
  assert.equal(events[1]?.provider, "mock");
  assert.equal(events[1]?.rawText, response.rawText);
});

test("gateway resolves local provider settings from environment-like config", () => {
  const config = createLLMGatewayConfigFromEnv({
    LLM_PROVIDER: "local",
    LLM_LOCAL_BASE_URL: "http://127.0.0.1:1234/v1",
    LLM_LOCAL_API_KEY: "local-secret"
  });
  const gateway = createLLMGateway(config);

  assert.equal(config.provider, "local");
  assert.equal(config.local?.baseUrl, "http://127.0.0.1:1234/v1");
  assert.equal(gateway.getProvider().getName(), "local");
});

test("gateway defaults local provider to the local OpenAI-compatible service", () => {
  const config = createLLMGatewayConfigFromEnv({
    LLM_PROVIDER: "local"
  });

  assert.equal(config.provider, "local");
  assert.equal(config.local?.baseUrl, "http://127.0.0.1:1234/v1");
  assert.equal(config.local?.apiKey, undefined);
});

test("gateway rejects unknown provider configuration values", () => {
  assert.throws(
    () =>
      createLLMGatewayConfigFromEnv({
        LLM_PROVIDER: "remote"
      }),
    /Unsupported LLM_PROVIDER/
  );
});
