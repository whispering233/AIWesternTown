# Task Card: W01 Contracts Core

## Goal

建立第一版共享契约层，为命令、事件、tick、LLM 调用和调试记录提供唯一类型来源。

## Write Scope

- `packages/contracts/**`

## Read Scope

- [38-npc-cognition-api-spec.md](C:/codex/project/AIWesternTown/doc/38-npc-cognition-api-spec.md)
- [40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md)
- [50-llm-integration.md](C:/codex/project/AIWesternTown/doc/50-llm-integration.md)
- [51-prompt-builder-contract.md](C:/codex/project/AIWesternTown/doc/51-prompt-builder-contract.md)

## Dependencies

- `W00`

## Out of Scope

- React 页面
- Fastify 路由
- SQLite migration

## Deliverables

- 玩家命令 schema
- 世界事件 schema
- tick trace schema
- LLM request / response schema
- debug record schema

## Done Criteria

- 关键 DTO 具备 TypeScript 类型和 Zod schema
- schema 测试可运行
- 其他包可以只依赖此处共享契约

## Risks

- 过度设计导致第一版实现过慢
- 下游包提前绕开契约直接自定义类型

## Merge Notes

- 本卡是共享事实层，未合并前不要在其他卡复制 DTO
