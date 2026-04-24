# Task Card: W21 Scene Visibility Slice

## Goal

实现第一版场景分区、`visual / audio / notice` 基础规则，为观察与 NPC 感知提供稳定空间真相。

## Write Scope

- `packages/game-core/src/scene/**`

## Read Scope

- [25-scene-partition-and-visibility.md](C:/codex/project/AIWesternTown/doc/25-scene-partition-and-visibility.md)

## Dependencies

- `W02`
- `W13`

## Out of Scope

- 跨场景 travel loop
- React UI
- 数据库存储优化

## Deliverables

- Scene partition graph 读取
- Player projection
- visual/audio/notice 判定
- 单隐式分区降级逻辑

## Done Criteria

- 同场景不同分区能产出不同观察结果
- 旧场景可退化为单分区
- 可被 `player-loop` 和 `cognition-lite` 消费

## Risks

- 分区模型过细导致第一版过重
- 对外输出仍泄漏底层内部细节

## Merge Notes

- 控制字段数量，只保留第一版必需关系
