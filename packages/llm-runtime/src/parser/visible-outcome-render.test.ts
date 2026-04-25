import assert from "node:assert/strict";
import test from "node:test";

import { parseVisibleOutcomeRenderResult } from "./index.js";

const fallback = {
  visibleText: "The doctor gives a guarded nod.",
  gestureTags: ["calm"]
};

test("parses a strict visible outcome JSON object", () => {
  const result = parseVisibleOutcomeRenderResult(
    "{\"visibleText\":\"The saloon goes still.\",\"gestureTags\":[\"calm\"]}",
    {
      fallback,
      guard: {
        maxVisibleTextChars: 80,
        allowedGestureTags: ["calm", "brief_pause"]
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.fallbackUsed, false);
  assert.deepEqual(result.value, {
    visibleText: "The saloon goes still.",
    gestureTags: ["calm"]
  });
});

test("falls back to the rule template when raw text is not strict JSON", () => {
  const result = parseVisibleOutcomeRenderResult(
    "The doctor lowers his voice.",
    {
      fallback,
      guard: {
        maxVisibleTextChars: 80
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.errorReason, "invalid_json");
  assert.deepEqual(result.fallback, fallback);
});

test("falls back when the model returns fields outside the visible text schema", () => {
  const result = parseVisibleOutcomeRenderResult(
    JSON.stringify({
      visibleText: "The doctor smiles.",
      actionType: "move"
    }),
    {
      fallback,
      guard: {
        maxVisibleTextChars: 80
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.errorReason, "forbidden_field");
  assert.deepEqual(result.fallback, fallback);
});

test("falls back when visible text exceeds the configured length", () => {
  const result = parseVisibleOutcomeRenderResult(
    JSON.stringify({
      visibleText: "This line is too long for the compact visible render."
    }),
    {
      fallback,
      guard: {
        maxVisibleTextChars: 24
      }
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.errorReason, "too_long");
});
