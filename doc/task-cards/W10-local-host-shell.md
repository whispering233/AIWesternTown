# Task Card: W10 Local Host Shell

## Goal

建立本地权威宿主，提供命令入口、会话生命周期和 SSE 事件流。

## Write Scope

- `apps/local-host/**`
- 必要的 `packages/ui-sdk/**` 接口适配

## Read Scope

- [40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md)
- [70-implementation-stack-and-delivery-plan.md](C:/codex/project/AIWesternTown/doc/70-implementation-stack-and-delivery-plan.md)

## Dependencies

- `W01`

## Out of Scope

- scheduler 业务实现
- React 页面
- LLM prompt builder

## Deliverables

- Fastify server
- session 初始化接口
- 命令提交接口
- SSE 订阅接口

## Done Criteria

- 浏览器可创建本地 session
- 浏览器可发一条命令
- 浏览器可收到 SSE 假事件流

## Risks

- 路由层吞掉业务逻辑
- SSE 事件模型和 `contracts` 漂移

## Merge Notes

- 路由层只做输入输出编排，不写核心规则
