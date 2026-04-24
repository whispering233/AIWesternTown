# Task Card: W02 Content Schema Starter

## Goal

建立最小内容 schema，并提供一个可校验的 starter town 内容包。

## Write Scope

- `packages/content-schema/**`
- `content/starter-town/**`

## Read Scope

- [10-world-and-narrative.md](C:/codex/project/AIWesternTown/doc/10-world-and-narrative.md)
- [25-scene-partition-and-visibility.md](C:/codex/project/AIWesternTown/doc/25-scene-partition-and-visibility.md)
- [42-item-system-and-interaction.md](C:/codex/project/AIWesternTown/doc/42-item-system-and-interaction.md)
- [43-item-schema-and-content-config.md](C:/codex/project/AIWesternTown/doc/43-item-schema-and-content-config.md)
- [60-content-production-rules.md](C:/codex/project/AIWesternTown/doc/60-content-production-rules.md)

## Dependencies

- `W01`

## Out of Scope

- 数据库存档
- 编辑器 UI
- 世界运行逻辑

## Deliverables

- 场景 schema
- NPC schema
- 物品 schema
- starter town 样例内容

## Done Criteria

- starter content 可以通过 schema 校验
- 至少覆盖场景、NPC、物品三类内容
- 后续 `save bootstrap` 可直接消费

## Risks

- schema 与运行时 DTO 漂移
- 内容字段过多导致第一版难以装配

## Merge Notes

- 若发现共享字段应抽到 `contracts`，另开卡处理
