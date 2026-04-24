# Task Card: W33 Debug Panel LLM

## Goal

在浏览器中提供 LLM 调试面板，查看 prompt、原始输出、解析结果和回退原因。

## Write Scope

- `apps/web/src/debug/**`
- `packages/devtools/src/inspectors/**`

## Read Scope

- [70-implementation-stack-and-delivery-plan.md](C:/codex/project/AIWesternTown/doc/70-implementation-stack-and-delivery-plan.md)

## Dependencies

- `W12`
- `W31`
- `W32`

## Out of Scope

- provider 实现
- 业务规则
- fixture replay runner

## Deliverables

- LLM Calls 列表视图
- Prompt 视图
- Raw Output 视图
- Parsed / Fallback 视图

## Done Criteria

- 浏览器可以查看最近 LLM 调用
- 可以定位某次调用的原始输出和回退原因
- 不需要打开终端也能排查常见问题

## Risks

- 调试面板反过来依赖业务层内部结构
- 页面一次加载过多记录导致卡顿

## Merge Notes

- 优先消费 recorder 暴露的调试 DTO，不直接读取数据库表
