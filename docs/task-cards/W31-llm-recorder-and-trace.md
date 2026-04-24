# Task Card: W31 LLM Recorder And Trace

## Goal

实现 LLM 调用录制、trace 关联和关键调用落盘。

## Write Scope

- `packages/llm-runtime/src/recorder/**`
- `packages/devtools/src/trace/**`
- 必要的 `packages/persistence/**`

## Read Scope

- [50-llm-integration.md](C:/codex/project/AIWesternTown/doc/50-llm-integration.md)
- [70-implementation-stack-and-delivery-plan.md](C:/codex/project/AIWesternTown/doc/70-implementation-stack-and-delivery-plan.md)

## Dependencies

- `W11`
- `W30`

## Out of Scope

- Web 调试面板
- prompt builder
- fixture replay

## Deliverables

- request/response recorder
- traceId 关联
- SQLite debug log 写入
- 最近调用缓存

## Done Criteria

- 每次调用都有 `traceId` 和 `requestId`
- 最近调用可在内存缓冲读取
- 关键调用可落盘

## Risks

- 调试记录泄漏过多无关上下文
- 高频落盘影响本地性能

## Merge Notes

- 先做最小记录字段集，避免变成全文存档系统
