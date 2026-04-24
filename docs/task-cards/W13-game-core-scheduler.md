# Task Card: W13 Game Core Scheduler

## Goal

实现 `worldTick`、scheduler、run mode 和事件推进骨架。

## Write Scope

- `packages/game-core/**`

## Read Scope

- [20-core-game-loop.md](C:/codex/project/AIWesternTown/doc/20-core-game-loop.md)
- [40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md)

## Dependencies

- `W01`

## Out of Scope

- React UI
- SQLite 细节
- LLM provider

## Deliverables

- tick executor
- scheduler
- run mode 切换
- 基础事件发射

## Done Criteria

- 给定玩家命令能稳定推进一轮 tick
- 支持 `free_explore`、`focused_dialogue`、`interrupted`
- 输出结构化事件流

## Risks

- 调度逻辑与 host 层耦合
- 事件模型不稳定导致下游频繁改动

## Merge Notes

- 只暴露 core 接口，不直接依赖 HTTP 或 DB
