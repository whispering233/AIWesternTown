# Task Card: W12 Web Shell

## Goal

建立浏览器版文字游戏基础壳，提供命令输入、场景展示和调试入口。

## Write Scope

- `apps/web/**`

## Read Scope

- [20-core-game-loop.md](C:/codex/project/AIWesternTown/doc/20-core-game-loop.md)
- [70-implementation-stack-and-delivery-plan.md](C:/codex/project/AIWesternTown/doc/70-implementation-stack-and-delivery-plan.md)

## Dependencies

- `W01`

## Out of Scope

- 游戏规则
- scheduler
- LLM 调用

## Deliverables

- Vite + React 基础壳
- 主界面布局
- 命令输入组件
- 场景反馈展示组件
- 调试入口占位

## Done Criteria

- Web 可启动
- 可展示假数据
- 为后续接入 SSE 和调试面板保留稳定入口

## Risks

- UI 层直接吸收业务逻辑
- 页面结构未预留调试视图

## Merge Notes

- 只消费 view model，不定义世界真相模型
