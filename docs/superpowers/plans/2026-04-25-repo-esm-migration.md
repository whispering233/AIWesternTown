# Repository ESM Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert all Node workspace packages in this repository from CommonJS semantics to ESM while keeping the workspace build, typecheck, and tests green.

**Architecture:** Migrate the repository package-by-package in dependency order so leaf schema/runtime packages move first, then their consumers. Standardize Node packages on `type: "module"` plus `module/moduleResolution: "NodeNext"`, rewrite relative imports to `.js`, and replace CommonJS runtime helpers like `__dirname` with ESM-safe equivalents.

**Tech Stack:** TypeScript, Node.js, pnpm workspaces, turbo, Vite, Drizzle, Fastify

---

### Task 1: Standardize Shared Node Module Settings

**Files:**
- Modify: `C:\codex\project\AIWesternTown\tsconfig.base.json`
- Modify: `C:\codex\project\AIWesternTown\apps\cloud-gateway\package.json`
- Modify: `C:\codex\project\AIWesternTown\packages\app-services\package.json`
- Modify: `C:\codex\project\AIWesternTown\packages\cognition-core\package.json`
- Modify: `C:\codex\project\AIWesternTown\packages\content-schema\package.json`
- Modify: `C:\codex\project\AIWesternTown\packages\contracts\package.json`
- Modify: `C:\codex\project\AIWesternTown\packages\devtools\package.json`
- Modify: `C:\codex\project\AIWesternTown\packages\game-core\package.json`
- Modify: `C:\codex\project\AIWesternTown\packages\llm-runtime\package.json`
- Modify: `C:\codex\project\AIWesternTown\packages\persistence\package.json`
- Modify: `C:\codex\project\AIWesternTown\content\starter-town\package.json`

- [ ] Switch Node defaults to `NodeNext`
- [ ] Add `type: "module"` and ESM `exports` where missing
- [ ] Keep package entrypoints aligned to `dist/index.js`

### Task 2: Rewrite Relative Imports for Node Packages

**Files:**
- Modify: `C:\codex\project\AIWesternTown\packages\content-schema\src\*.ts`
- Modify: `C:\codex\project\AIWesternTown\content\starter-town\*.ts`
- Modify: `C:\codex\project\AIWesternTown\packages\game-core\src\**\*.ts`
- Modify: `C:\codex\project\AIWesternTown\packages\cognition-core\src\**\*.ts`
- Modify: `C:\codex\project\AIWesternTown\packages\app-services\src\*.ts`
- Modify: `C:\codex\project\AIWesternTown\packages\persistence\src\*.ts`
- Modify: `C:\codex\project\AIWesternTown\packages\persistence\drizzle.config.ts`

- [ ] Add `.js` extensions to all relative runtime imports/exports in Node-targeted TypeScript
- [ ] Update tests alongside source files so `node --test dist/**/*.js` still resolves correctly
- [ ] Keep browser/Vite-only files on their existing bundler-style imports

### Task 3: Replace CommonJS Runtime Helpers

**Files:**
- Modify: `C:\codex\project\AIWesternTown\packages\persistence\src\sqlite.ts`
- Modify: `C:\codex\project\AIWesternTown\apps\web\vite.config.ts`

- [ ] Replace `__dirname` usage with `fileURLToPath(import.meta.url)`-based helpers
- [ ] Keep existing runtime behavior and path resolution unchanged

### Task 4: Add/Adjust Regression Coverage for ESM Boundaries

**Files:**
- Modify: `C:\codex\project\AIWesternTown\packages\content-schema\src\content-schema.test.ts`
- Modify: `C:\codex\project\AIWesternTown\packages\game-core\src\scheduler.test.ts`
- Modify: `C:\codex\project\AIWesternTown\packages\persistence\src\persistence.test.ts`
- Modify: `C:\codex\project\AIWesternTown\packages\app-services\src\starter-town-player-loop.test.ts`

- [ ] Keep existing package-level tests green under ESM output
- [ ] Add focused assertions only where migration changes module loading assumptions

### Task 5: Full Workspace Verification

**Files:**
- Verify only

- [ ] Run `pnpm --filter @ai-western-town/content-schema test`
- [ ] Run `pnpm --filter @ai-western-town/starter-town-content test`
- [ ] Run `pnpm --filter @ai-western-town/game-core test`
- [ ] Run `pnpm --filter @ai-western-town/cognition-core test`
- [ ] Run `pnpm --filter @ai-western-town/app-services test`
- [ ] Run `pnpm --filter @ai-western-town/persistence test`
- [ ] Run `pnpm --filter @ai-western-town/local-host test`
- [ ] Run `pnpm --filter @ai-western-town/ui-sdk test`
- [ ] Run `pnpm --filter @ai-western-town/web test`
- [ ] Run `pnpm typecheck`
- [ ] Run `pnpm test`
