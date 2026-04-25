import assert from "node:assert/strict";
import test from "node:test";

import {
  buildVisibleOutcomeFallback,
  buildVisibleOutcomeRenderPromptSpec,
  type VisibleOutcomeRenderPromptInput
} from "./index.js";

function createPromptInput(
  overrides: Partial<VisibleOutcomeRenderPromptInput> = {}
): VisibleOutcomeRenderPromptInput {
  return {
    executionId: "exec-401",
    actorId: "npc-doctor",
    actionType: "speak",
    outcome: "success",
    outcomeReasonTags: ["target_present", "scene_public"],
    executionSummary: "npc-doctor publicly deflected the question.",
    resolvedFacts: [
      "npc-doctor is in the saloon",
      "player and sheriff can observe the exchange"
    ],
    visibleOutcome: {
      dialogueLine: "npc-doctor deflects toward player.",
      gestureTags: ["calm", "brief_pause"],
      observerActorIds: ["player", "sheriff"]
    },
    audience: {
      observerActorIds: ["player", "sheriff"],
      perspective: "player-visible public exchange",
      scenePrivacy: "public"
    },
    styleTags: ["calm", "redirect_topic"],
    toneTags: ["plain", "western"],
    maxVisibleTextChars: 120,
    ...overrides
  };
}

test("builds a role-aware PromptSpec for visible outcome rendering", () => {
  const spec = buildVisibleOutcomeRenderPromptSpec(createPromptInput(), {
    budgetLevel: "normal",
    traceTags: ["test-trace"]
  });

  assert.equal(spec.taskKind, "visible_outcome_render");
  assert.equal(spec.stageName, "act");
  assert.equal(spec.providerHints?.mode, "render");
  assert.equal(spec.providerHints?.temperature, 0.2);
  assert.equal(spec.inputBudgetTokens, 700);
  assert.equal(spec.outputBudgetTokens, 160);
  assert.equal(spec.outputSchema.schemaName, "VisibleOutcomeRenderResult");
  assert.match(spec.outputSchema.jsonShape, /visibleText/);
  assert.match(spec.outputSchema.validationRules.join("\n"), /stateMutations/);
  assert.equal(spec.debugMeta.builderName, "VisibleOutcomeRenderPromptBuilder");
  assert.deepEqual(spec.debugMeta.traceTags, ["test-trace"]);

  const blockKeys = spec.blocks.map((block) => block.key);
  assert.equal(new Set(blockKeys).size, blockKeys.length);
  assert.ok(blockKeys.includes("visible_outcome_policy"));
  assert.ok(blockKeys.includes("visible_outcome_task"));
  assert.ok(blockKeys.includes("visible_outcome_authoritative_result"));
  assert.ok(blockKeys.includes("visible_outcome_schema"));
  assert.equal(
    spec.blocks.filter((block) => block.role === "assistant").length,
    0
  );

  const systemText = spec.blocks
    .filter((block) => block.role === "system")
    .map((block) => block.content)
    .join("\n");
  const userText = spec.blocks
    .filter((block) => block.role === "user")
    .map((block) => block.content)
    .join("\n");

  assert.doesNotMatch(systemText, /exec-401/);
  assert.doesNotMatch(systemText, /npc-doctor/);
  assert.match(userText, /exec-401/);
  assert.match(userText, /npc-doctor/);
});

test("builds a deterministic fallback from authoritative visible outcome", () => {
  const fallback = buildVisibleOutcomeFallback(
    createPromptInput({
      maxVisibleTextChars: 24,
      visibleOutcome: {
        narrationLine: "The doctor keeps his voice low and changes the subject.",
        gestureTags: ["calm", "brief_pause"],
        observerActorIds: ["player"]
      }
    })
  );

  assert.equal(fallback.visibleText.length <= 24, true);
  assert.match(fallback.visibleText, /^The doctor/);
  assert.deepEqual(fallback.gestureTags, ["calm", "brief_pause"]);
});
