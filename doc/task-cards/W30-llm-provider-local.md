# Task Card: W30 LLM Provider Local

## Goal

建立 `mock / local / cloud` 三态 provider 抽象，并先打通本地模型服务。

## Write Scope

- `packages/llm-runtime/src/provider/**`
- `packages/llm-runtime/src/gateway/**`

## Read Scope

- [50-llm-integration.md](C:/codex/project/AIWesternTown/doc/50-llm-integration.md)
- [51-prompt-builder-contract.md](C:/codex/project/AIWesternTown/doc/51-prompt-builder-contract.md)

## Dependencies

- `W01`

## Out of Scope

- prompt builder
- parser 细节
- 浏览器调试面板

## Deliverables

- provider interface
- mock provider
- local provider adapter
- cloud provider adapter 占位

## Done Criteria

- 可通过配置切换 provider
- local provider 能调用本地模型服务
- provider 错误可结构化返回

## Risks

- provider 泄漏厂商专有参数到上层
- 本地服务接口差异影响抽象稳定性

## Merge Notes

- 优先兼容 OpenAI-compatible 接口
