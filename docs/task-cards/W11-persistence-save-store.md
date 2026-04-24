# Task Card: W11 Persistence Save Store

## Goal

建立本地 SQLite 持久化基础设施，支撑 save/load、world state 和 event log。

## Write Scope

- `packages/persistence/**`

## Read Scope

- [37-npc-cognition-db-design.md](C:/codex/project/AIWesternTown/doc/37-npc-cognition-db-design.md)
- [40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md)

## Dependencies

- `W01`

## Out of Scope

- Web 页面
- prompt builder
- 完整 NPC 逻辑

## Deliverables

- SQLite 初始化脚本
- migration 机制
- save repo
- event log repo
- session state repo

## Done Criteria

- 可创建新 save
- 可写入并读回一轮事件日志
- 可恢复基础 session 状态

## Risks

- 表设计过早耦合未实现字段
- 高频运行态和持久层写入策略不清

## Merge Notes

- 若运行态字段未定，可先做最小列集，不猜测深层认知字段
