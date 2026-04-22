# W00 Repo Bootstrap Design

## Context

This spec documents the approved conservative implementation for task card `W00-repo-bootstrap`.

The repository currently contains product and architecture documentation only. W00 is responsible for creating the first TypeScript monorepo skeleton without introducing business logic, shared DTOs, database schema, or LLM integration.

## Scope

- Create root monorepo configuration for `pnpm workspace`, `turbo`, and shared TypeScript defaults
- Create workspace shells for:
  - `apps/web`
  - `apps/local-host`
  - `apps/cloud-gateway`
  - `packages/contracts`
  - `packages/content-schema`
  - `packages/persistence`
  - `packages/game-core`
  - `packages/cognition-core`
  - `packages/llm-runtime`
  - `packages/app-services`
  - `packages/ui-sdk`
  - `packages/devtools`
- Create placeholder tracked directories for `content/starter-town` and `scripts`
- Ensure the whole repository can run empty `install`, `build`, and `test`

## Out Of Scope

- Shared contracts or schemas beyond empty package shells
- Runtime dependencies such as React, Fastify, Zod, Drizzle, Vitest, or Playwright
- Business logic, persistence logic, or app bootstrapping
- Cross-package dependency wiring

## Approach

### Root configuration

- `pnpm-workspace.yaml` registers `apps/*` and `packages/*`
- Root `package.json` stays private and contains only orchestration scripts plus `turbo` and `typescript`
- `turbo.json` defines `build`, `typecheck`, and `test`
- `tsconfig.base.json` defines a strict but minimal shared compiler baseline

### Workspace shell contract

Each workspace contains:

- `package.json`
- `tsconfig.json`
- `src/index.ts`

Each workspace exposes empty build and typecheck entry points through `tsc`, plus a no-op test script that succeeds intentionally.

### Boundary control

- No shared path aliases yet
- No package inter-dependencies yet
- No framework bootstrap yet
- No generated code or content schema yet

## Validation

Success is defined by:

- `pnpm install` completing successfully
- `pnpm build` completing successfully across every workspace
- `pnpm test` completing successfully across every workspace
- Workspace discovery functioning through `pnpm` and `turbo`
