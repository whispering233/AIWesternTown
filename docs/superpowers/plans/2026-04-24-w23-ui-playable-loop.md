# W23 UI Playable Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the Web shell to the local host through `ui-sdk`, expose a playable move/observe loop, and keep scene updates flowing through SSE without page refresh.

**Architecture:** Add a small session runtime in `packages/ui-sdk`, then build a Web-side adapter that turns runtime state plus starter-scene metadata into a `ShellViewModel`. Reorder the main column so movement and surfaced opportunities sit ahead of the consequence feed, while all network and SSE behavior stays out of React components.

**Tech Stack:** TypeScript, React 19, Vite, Node test runner, local-host SSE, workspace packages

---

## File Structure

- Modify: `packages/ui-sdk/package.json`
- Modify: `packages/ui-sdk/src/index.ts`
- Create: `packages/ui-sdk/src/local-session-runtime.ts`
- Create: `packages/ui-sdk/src/local-session-runtime.test.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/app.css`
- Modify: `apps/web/src/index.ts`
- Modify: `apps/web/src/components/command-composer.tsx`
- Modify: `apps/web/src/components/scene-feed.tsx`
- Modify: `apps/web/src/components/debug-dock.tsx`
- Create: `apps/web/src/components/playable-loop-panel.tsx`
- Create: `apps/web/src/view-model/live-shell-view-model.ts`
- Create: `apps/web/src/view-model/live-shell-view-model.test.ts`
- Create: `apps/web/src/view-model/player-command-factory.ts`
- Create: `apps/web/src/view-model/player-command-factory.test.ts`
- Modify: `apps/web/src/view-model/shell-view-model.ts`
- Modify: `apps/web/src/view-model/mock-shell-view-model.ts`
- Create: `apps/web/src/components/playable-loop-panel.test.tsx`

### Task 1: Build and Test the `ui-sdk` Session Runtime

**Files:**
- Modify: `packages/ui-sdk/package.json`
- Modify: `packages/ui-sdk/src/index.ts`
- Create: `packages/ui-sdk/src/local-session-runtime.ts`
- Test: `packages/ui-sdk/src/local-session-runtime.test.ts`

- [ ] **Step 1: Write the failing runtime tests**

```ts
test("initializes a session and receives snapshot plus subsequent stream events", async () => {
  // create fake fetch + fake event source
  // initialize runtime
  // assert session, connection state, and cached events update
});

test("submitCommand forwards envelopes through the client and tracks last submitted command", async () => {
  // submit a command after initialize
  // assert request payload and runtime state
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-western-town/ui-sdk test`
Expected: FAIL because `local-session-runtime` does not exist and the test script does not yet execute real tests.

- [ ] **Step 3: Add the minimal runtime implementation**

```ts
export function createLocalSessionRuntime(options: LocalSessionRuntimeOptions) {
  // keep session, connectionState, cached stream events, last trace, and listeners
  // initialize by calling createSession() then subscribeToSessionEvents()
  // update state on snapshot / accepted / world.event / tick.trace
}
```

- [ ] **Step 4: Wire package exports and test script**

```json
{
  "scripts": {
    "test": "pnpm run build && node --test dist/**/*.test.js"
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ai-western-town/ui-sdk test`
Expected: PASS with the new runtime tests executing.

### Task 2: Add Web-Side Command and View-Model Adapters

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/view-model/player-command-factory.ts`
- Test: `apps/web/src/view-model/player-command-factory.test.ts`
- Create: `apps/web/src/view-model/live-shell-view-model.ts`
- Test: `apps/web/src/view-model/live-shell-view-model.test.ts`
- Modify: `apps/web/src/view-model/shell-view-model.ts`
- Modify: `apps/web/src/view-model/mock-shell-view-model.ts`

- [ ] **Step 1: Write the failing adapter tests**

```ts
test("buildMovementActions exposes adjacent scenes as commands", () => {
  // expect movement items for the current scene
});

test("buildShellViewModel folds command.accepted, world.event, and tick.trace into the right UI zones", () => {
  // expect feed entries, debug summary, and opportunity list
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-western-town/web test`
Expected: FAIL because the new adapter modules and test runner are missing.

- [ ] **Step 3: Implement a minimal command factory**

```ts
export function createMoveCommand(targetSceneId: string, issuedAtTick: number): PlayerCommandEnvelope {
  return {
    commandId: crypto.randomUUID(),
    commandType: "move",
    parsedAction: {
      actionType: "travel",
      targetLocationId: targetSceneId,
      tags: ["travel"]
    },
    issuedAtTick,
    consumesTick: false
  };
}
```

- [ ] **Step 4: Implement the live view-model adapter**

```ts
export function buildLiveShellViewModel(state: LiveShellState): ShellViewModel {
  // map current scene metadata to movement leads
  // map surfaced opportunities to action buttons
  // keep feed as player -> accepted -> world consequence
  // keep trace data in debug cards only
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ai-western-town/web test`
Expected: PASS for command-factory and view-model tests.

### Task 3: Rework the Main Column into a Playable Loop

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/app.css`
- Modify: `apps/web/src/index.ts`
- Modify: `apps/web/src/components/command-composer.tsx`
- Modify: `apps/web/src/components/scene-feed.tsx`
- Modify: `apps/web/src/components/debug-dock.tsx`
- Create: `apps/web/src/components/playable-loop-panel.tsx`
- Test: `apps/web/src/components/playable-loop-panel.test.tsx`

- [ ] **Step 1: Write the failing component test**

```tsx
test("renders movement and opportunity actions and calls submit handlers", () => {
  // render playable loop panel with one movement and one opportunity
  // invoke button clicks
  // assert handlers receive the expected command text or envelope intent
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-western-town/web test`
Expected: FAIL because the component does not yet exist.

- [ ] **Step 3: Implement the UI changes**

```tsx
<main className="main-column">
  <SceneHero scene={viewModel.scene} movement={viewModel.movement} />
  <PlayableLoopPanel
    opportunities={viewModel.opportunities}
    movement={viewModel.movement}
    onMovementSelect={handleMovementSelect}
    onOpportunitySelect={handleOpportunitySelect}
  />
  <SceneFeed entries={viewModel.feed} />
  <CommandComposer ... />
</main>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ai-western-town/web test`
Expected: PASS for component and adapter tests.

### Task 4: End-to-End Verification of the W23 Slice

**Files:**
- Verify only

- [ ] **Step 1: Typecheck the updated SDK**

Run: `pnpm --filter @ai-western-town/ui-sdk typecheck`
Expected: PASS

- [ ] **Step 2: Build the updated Web app**

Run: `pnpm --filter @ai-western-town/web build`
Expected: PASS

- [ ] **Step 3: Re-run focused tests**

Run: `pnpm --filter @ai-western-town/ui-sdk test && pnpm --filter @ai-western-town/web test`
Expected: PASS

- [ ] **Step 4: Review final diff**

Run: `git diff --stat`
Expected: only `apps/web/**`, `packages/ui-sdk/**`, and planning docs changed for this task.
