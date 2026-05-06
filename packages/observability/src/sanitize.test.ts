import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeLLMRequestBody,
  sanitizeLLMResponseText,
  serializeError
} from "./index.js";

test("sanitizeLLMRequestBody omits messages when disabled", () => {
  const sanitized = sanitizeLLMRequestBody(
    {
      model: "local-model",
      messages: [
        {
          role: "user",
          content: "private prompt"
        }
      ],
      temperature: 0.2
    },
    {
      includeMessages: false,
      includeRawResponse: true,
      includeStack: true,
      maxTextLength: 100
    }
  );

  assert.equal("messages" in sanitized, false);
  assert.equal(sanitized.model, "local-model");
  assert.equal(sanitized.temperature, 0.2);
});

test("sanitizeLLMResponseText truncates long raw responses", () => {
  const sanitized = sanitizeLLMResponseText("abcdef", {
    includeMessages: true,
    includeRawResponse: true,
    includeStack: true,
    maxTextLength: 3
  });

  assert.deepEqual(sanitized, {
    rawText: "abc",
    rawTextLength: 6,
    truncated: true
  });
});

test("serializeError includes stack only when enabled", () => {
  const error = new Error("This operation was aborted");
  error.name = "AbortError";

  const withStack = serializeError(error, true);
  const withoutStack = serializeError(error, false);

  assert.equal(withStack.errorName, "AbortError");
  assert.equal(withStack.errorMessage, "This operation was aborted");
  assert.equal(typeof withStack.stack, "string");
  assert.equal("stack" in withoutStack, false);
});
