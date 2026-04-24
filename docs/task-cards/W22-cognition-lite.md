# Task Card: W22 Cognition Lite

## Goal

实现第一版简化 NPC 认知链，仅覆盖 `Perceive / Appraise / Action Selection / Act`。

## Write Scope

- `packages/cognition-core/**`

## Read Scope

- [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md)
- [38-npc-cognition-api-spec.md](C:/codex/project/AIWesternTown/doc/38-npc-cognition-api-spec.md)

## Dependencies

- `W11`
- `W13`

## Out of Scope

- 深反思
- 压缩
- 长动作深处理
- LLM 精修

## Deliverables

- 四阶段 orchestrator
- 最小阶段输入输出
- 与 scheduler 的接线点

## Done Criteria

- NPC 能对玩家动作或事件窗口做最小响应
- 可产出结构化动作结果
- 输出可被 `Act` 阶段结算

## Risks

- 过早追求八阶段完整实现
- 直接耦合数据库表实体

## Merge Notes

- 优先基于裁剪 slice 和 DTO 实现，不直接操作原始表模型
