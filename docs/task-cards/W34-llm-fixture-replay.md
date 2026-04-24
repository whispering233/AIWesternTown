# Task Card: W34 LLM Fixture Replay

## Goal

实现 LLM 调用 fixture 的导出与重放，支持脱离真实模型服务调试。

## Write Scope

- `packages/devtools/src/replay/**`
- 必要的 `packages/llm-runtime/src/recorder/**`

## Read Scope

- [70-implementation-stack-and-delivery-plan.md](C:/codex/project/AIWesternTown/doc/70-implementation-stack-and-delivery-plan.md)

## Dependencies

- `W31`

## Out of Scope

- Web 调试面板主界面
- 新的业务 task
- 云端 gateway

## Deliverables

- fixture 导出格式
- fixture 回放 runner
- 回放与真实调用的一致接口

## Done Criteria

- 一次历史调用可导出为 fixture
- 不启动本地模型也可重放结果
- 可用于 parser/guard/debug panel 联调

## Risks

- fixture 格式过于依赖某个 provider 原始输出
- 回放接口与真实接口不一致

## Merge Notes

- replay 必须模拟真实 provider 返回，不要走特判捷径
