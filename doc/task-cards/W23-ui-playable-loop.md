# Task Card: W23 UI Playable Loop

## Goal

把 Web UI 接到真实本地宿主和主循环输出，形成第一版可玩的浏览器体验。

## Write Scope

- `apps/web/**`
- `packages/ui-sdk/**`

## Read Scope

- [20-core-game-loop.md](C:/codex/project/AIWesternTown/doc/20-core-game-loop.md)
- [70-implementation-stack-and-delivery-plan.md](C:/codex/project/AIWesternTown/doc/70-implementation-stack-and-delivery-plan.md)

## Dependencies

- `W10`
- `W12`
- `W20`
- `W21`

## Out of Scope

- LLM debug panel
- 持久化内部实现
- 完整 NPC 行为可视化

## Deliverables

- 调命令接口的 client
- SSE 事件消费
- 主界面状态同步
- 可玩主循环页面

## Done Criteria

- 玩家可在浏览器里执行移动和观察
- 页面可显示结构化后果
- 事件刷新不需要手动刷新页面

## Risks

- 页面状态与 server 状态不同步
- UI 过早把临时字段当长期契约

## Merge Notes

- 优先通过 `ui-sdk` 适配，不在页面里散落 fetch 逻辑
