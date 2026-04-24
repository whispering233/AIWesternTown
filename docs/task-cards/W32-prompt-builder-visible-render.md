# Task Card: W32 Prompt Builder Visible Render

## Goal

先只实现 `visible_outcome_render` 的 PromptSpec、parser 和 guard，打通第一条本地 LLM 价值链。

## Write Scope

- `packages/llm-runtime/src/prompt-builder/**`
- `packages/llm-runtime/src/parser/**`
- `packages/llm-runtime/src/guard/**`

## Read Scope

- [50-llm-integration.md](C:/codex/project/AIWesternTown/doc/50-llm-integration.md)
- [51-prompt-builder-contract.md](C:/codex/project/AIWesternTown/doc/51-prompt-builder-contract.md)

## Dependencies

- `W30`

## Out of Scope

- `goal_tiebreak`
- 深反思
- 调试面板

## Deliverables

- `visible_outcome_render` DTO 到 PromptSpec 的 builder
- parser
- guard
- 规则回退路径

## Done Criteria

- 可把结构化可见结果交给本地模型渲染
- 解析失败会回退模板
- guard 能拒绝越权或非法输出

## Risks

- parser 对本地模型输出过度宽容
- builder 直接读取全局状态

## Merge Notes

- 只做一个 task，先把链路打稳
