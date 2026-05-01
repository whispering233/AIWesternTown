# Local LLM End-to-End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a real local LLM provider into the playable command path while keeping `local-host` limited to session, HTTP, and SSE responsibilities.

**Architecture:** `local-host` delegates command handling to an app-services session use case. `app-services` owns the end-to-end command orchestration across `game-core`, `cognition-core`, and `llm-runtime`. `cognition-core` exposes a stable `runNpcCognition` facade and keeps the current lite implementation as an internal strategy.

**Tech Stack:** TypeScript ESM, pnpm workspace, Node test runner, Fastify, existing `llm-runtime` OpenAI-compatible provider.

---

## File Structure

- Modify `packages/cognition-core/src/orchestrator.ts` to add the stable cognition facade.
- Modify `packages/cognition-core/src/types.ts` to add facade input/output types.
- Modify `packages/cognition-core/src/index.ts` only if exports need to stay explicit.
- Create `packages/app-services/src/starter-town-session-runtime.ts` for the command use case and LLM visible render integration.
- Modify `packages/app-services/src/index.ts` to export the runtime.
- Modify `packages/app-services/package.json` to depend on `contracts`, `cognition-core`, and `llm-runtime`.
- Modify `apps/local-host/src/config.ts` to load LLM config, including the default local model `gemma-4-e2b-uncensored-hauhaucs-aggressive`.
- Modify `apps/local-host/src/session-store.ts` so it owns session state and delegates command handling to app-services.
- Modify `apps/local-host/src/server.ts` because command submission becomes async.
- Modify `apps/local-host/src/index.ts` to construct the app-services runtime from env.
- Modify `apps/local-host/package.json` to depend on `app-services` and `llm-runtime`.
- Test `packages/cognition-core/src/cognition-core.test.ts`, `packages/app-services/src/starter-town-session-runtime.test.ts`, `apps/local-host/src/config.test.ts`, and `apps/local-host/src/local-host.test.ts`.

---

### Task 1: Cognition Facade

**Files:**
- Modify: `packages/cognition-core/src/types.ts`
- Modify: `packages/cognition-core/src/orchestrator.ts`
- Test: `packages/cognition-core/src/cognition-core.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that calls `runNpcCognition(input)` with the existing base fixture and asserts the result exposes a strategy label while preserving the lite execution result:

```ts
const result = runNpcCognition(input);
assert.equal(result.strategy, "lite");
assert.equal(result.lite.executionResult?.outcome, "success");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-western-town/cognition-core test`

Expected: TypeScript build fails because `runNpcCognition` is not exported.

- [ ] **Step 3: Implement the facade**

Add:

```ts
export type NpcCognitionRunInput = CognitionLiteRunInput;
export type NpcCognitionRunResult = {
  npcId: string;
  strategy: "lite";
  lite: CognitionLiteRunResult;
};

export function runNpcCognition(input: NpcCognitionRunInput): NpcCognitionRunResult {
  return {
    npcId: input.npcId,
    strategy: "lite",
    lite: runCognitionLite(input)
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai-western-town/cognition-core test`

Expected: all cognition-core tests pass.

---

### Task 2: App-Services Session Runtime

**Files:**
- Create: `packages/app-services/src/starter-town-session-runtime.ts`
- Modify: `packages/app-services/src/index.ts`
- Modify: `packages/app-services/package.json`
- Test: `packages/app-services/src/starter-town-session-runtime.test.ts`

- [ ] **Step 1: Write the failing test**

Create a test with a fake gateway returning:

```json
{"visibleText":"Mara keeps her answer short.","gestureTags":["guarded"]}
```

Assert that `runtime.submitCommand(...)` returns:

- `worldTick = 1`
- at least one `worldEvents` item whose summary contains `Mara keeps her answer short.`
- `tickTrace.llmTraceIds` with one trace id
- one recent LLM call record from the recorder

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-western-town/app-services test`

Expected: TypeScript build fails because `createStarterTownSessionRuntime` does not exist.

- [ ] **Step 3: Implement minimal runtime**

Implement `createStarterTownSessionRuntime(options)` with:

- `createInitialState()`
- `submitCommand(state, playerCommand)`
- one current-scene starter town state
- call to `advanceWorldSimulation`
- call to `runNpcCognition`
- call to `buildVisibleOutcomeRenderPromptSpec`
- provider request construction from PromptSpec blocks
- `LLMCallRecorder.recordInvocation`
- `parseVisibleOutcomeRenderResult` and fallback
- return updated state, world events, tick trace, and recent LLM calls

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai-western-town/app-services test`

Expected: all app-services tests pass.

---

### Task 3: Local-Host Delegation

**Files:**
- Modify: `apps/local-host/src/session-store.ts`
- Modify: `apps/local-host/src/server.ts`
- Modify: `apps/local-host/package.json`
- Test: `apps/local-host/src/local-host.test.ts`

- [ ] **Step 1: Write the failing test**

Update the existing SSE test so server construction receives an app-services runtime with a fake LLM response and asserts:

- a `world.event` summary includes the LLM-rendered text
- `tick.trace.llmTraceIds` has one id
- the trace has an NPC execution

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-western-town/local-host test`

Expected: fails because `sessionStore.submitCommand` is synchronous and still emits fake events.

- [ ] **Step 3: Delegate to app-services**

Change `InMemoryLocalSessionStore` so each session has an app-services state. Change `submitCommand` to async, call `runtime.submitCommand`, update only session metadata/worldTick, and publish app-services returned world events and tick trace.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai-western-town/local-host test`

Expected: all local-host tests pass.

---

### Task 4: Local LLM Configuration

**Files:**
- Modify: `apps/local-host/src/config.ts`
- Modify: `apps/local-host/src/index.ts`
- Test: `apps/local-host/src/config.test.ts`

- [ ] **Step 1: Write the failing test**

Add a config test asserting:

```ts
const config = resolveLocalHostLLMRuntimeConfig({ LLM_PROVIDER: "local" });
assert.equal(config.gateway.provider, "local");
assert.equal(config.modelRef, "gemma-4-e2b-uncensored-hauhaucs-aggressive");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-western-town/local-host test`

Expected: TypeScript build fails because `resolveLocalHostLLMRuntimeConfig` does not exist.

- [ ] **Step 3: Implement config**

Add `resolveLocalHostLLMRuntimeConfig(env)` returning `{ gateway, modelRef, timeoutMs }`, with `LLM_LOCAL_MODEL` defaulting to `gemma-4-e2b-uncensored-hauhaucs-aggressive`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai-western-town/local-host test`

Expected: all local-host tests pass.

---

### Task 5: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
pnpm --filter @ai-western-town/cognition-core test
pnpm --filter @ai-western-town/app-services test
pnpm --filter @ai-western-town/local-host test
```

Expected: all focused tests pass.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
pnpm run typecheck
```

Expected: root typecheck passes.
