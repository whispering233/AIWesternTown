import assert from "node:assert/strict";
import test from "node:test";

import { guardVisibleOutcomeRenderResult } from "./index.js";

test("accepts a visible outcome render result that only fills visible text", () => {
  const result = guardVisibleOutcomeRenderResult(
    {
      visibleText: "The doctor lowers his voice.",
      gestureTags: ["calm", "brief_pause"]
    },
    {
      maxVisibleTextChars: 80,
      allowedGestureTags: ["calm", "brief_pause"],
      forbiddenFacts: ["secret tunnel"]
    }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    visibleText: "The doctor lowers his voice.",
    gestureTags: ["calm", "brief_pause"]
  });
});

test("rejects forbidden fields that would rewrite authoritative execution state", () => {
  const result = guardVisibleOutcomeRenderResult(
    {
      visibleText: "The doctor leaves.",
      outcome: "failed",
      stateMutations: [{ path: "stance", value: "gone" }]
    },
    {
      maxVisibleTextChars: 80
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.errorReason, "forbidden_field");
  assert.match(result.detail, /outcome/);
});

test("rejects visible text that mentions forbidden facts", () => {
  const result = guardVisibleOutcomeRenderResult(
    {
      visibleText: "The doctor reveals the secret tunnel behind the bar."
    },
    {
      maxVisibleTextChars: 80,
      forbiddenFacts: ["secret tunnel"]
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.errorReason, "illegal_fact");
  assert.match(result.detail, /secret tunnel/);
});

test("rejects gesture tags outside the authorized set", () => {
  const result = guardVisibleOutcomeRenderResult(
    {
      visibleText: "The doctor pauses.",
      gestureTags: ["calm", "draws_weapon"]
    },
    {
      maxVisibleTextChars: 80,
      allowedGestureTags: ["calm"]
    }
  );

  assert.equal(result.ok, false);
  assert.equal(result.errorReason, "illegal_fact");
  assert.match(result.detail, /draws_weapon/);
});
