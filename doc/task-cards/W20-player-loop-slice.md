# Task Card: W20 Player Loop Slice

## Goal

实现第一版玩家可玩的最小主循环：移动、粗观察、定向观察、机会浮出。

## Write Scope

- `packages/game-core/**`
- 必要的 `packages/app-services/**`

## Read Scope

- [20-core-game-loop.md](C:/codex/project/AIWesternTown/doc/20-core-game-loop.md)
- [25-scene-partition-and-visibility.md](C:/codex/project/AIWesternTown/doc/25-scene-partition-and-visibility.md)

## Dependencies

- `W02`
- `W11`
- `W13`

## Out of Scope

- 完整 NPC 认知链
- LLM 渲染
- Web UI 最终接线

## Deliverables

- 玩家动作分类
- 粗观察输出
- 定向观察输出
- 机会浮出规则

## Done Criteria

- 玩家能在 starter town 里移动
- 进入场景后有粗观察
- 可对目标进行定向观察
- 可生成少量结构化机会

## Risks

- 玩家反馈结构和 UI 预期不一致
- 观察与机会层过早写死文案

## Merge Notes

- 优先输出结构化结果，不在 core 内做复杂文本修饰
