# NPC Cognition Data Model Database Design

## 1. Document Overview

| Item | Content |
| --- | --- |
| Document title | `AIWesternTown NPC cognition data model` |
| Business goal | 为 NPC 认知循环提供可持久化、可检索、可回放的数据模型，支撑身份、目标、工作记忆、社交信念、长期记忆与认知事件日志。 |
| Scope | 覆盖 `npc_identity_profile`、`npc_goal_definition`、`npc_social_belief_edge`、`npc_working_memory_item`、`npc_long_term_memory_item`、`npc_memory_retrieval_summary`、`npc_cognition_event_log` 七张表及其关系。 |
| Non-goals | 不覆盖世界地图、玩家主存档、对话内容全文存储、向量检索基础设施、tick 内临时 `TickMemoryReadContext` 内存结构。 |
| Related systems | [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md), [35-memory-retrieval-and-recall.md](C:/codex/project/AIWesternTown/doc/35-memory-retrieval-and-recall.md), world simulation state store, internal cognition orchestrator |

当前版本采用如下存储假设：

- 单个物理 schema 或逻辑数据库实例默认对应单个存档上下文
- 因此本文档中的可变运行态表暂不显式携带 `save_id`
- 若后续需要让多个存档共享同一物理库，应把 `save_id` 或 `simulation_id` 升级为所有运行态表的复合主键前缀或分区键

## 2. Table Inventory

| Table name | Purpose | Core relationship |
| --- | --- | --- |
| `npc_identity_profile` | 存储 NPC 的稳定身份切片与认知人格基线 | 1:1 对应 `npc_id` |
| `npc_goal_definition` | 存储 NPC 的长期目标定义与优先级 | N:1 关联 `npc_identity_profile` |
| `npc_social_belief_edge` | 存储 NPC 对其他 actor 的社交信念边 | N:1 关联 `npc_identity_profile` |
| `npc_working_memory_item` | 存储 NPC 当前短时焦点与 concern 条目 | N:1 关联 `npc_identity_profile` |
| `npc_long_term_memory_item` | 存储长期记忆正文 | N:1 关联 `npc_identity_profile` |
| `npc_memory_retrieval_summary` | 存储长期记忆读取索引层 | N:1 关联 `npc_long_term_memory_item` |
| `npc_cognition_event_log` | 存储认知链路中用于回放、审计和调试的阶段结果摘要 | N:1 关联 `npc_identity_profile` |

## 3. Single Table Design

### 3.1 `npc_identity_profile`

#### 3.1.1 Table Summary

| Item | Content |
| --- | --- |
| Table name | `npc_identity_profile` |
| Purpose | 存储 NPC 稳定身份、公开人格、秘密、禁忌和核心驱动力等认知基线。 |
| Primary key | `npc_id` |
| Write pattern | 低频更新，以内容生产初始化、剧情推进和设计工具编辑为主。 |
| Read pattern | 高频读取，供 `Appraise`、`Goal Arbitration`、`Reflect` 使用。 |

#### 3.1.2 Field Definitions

| Column | Type | Nullable | Default | Key role | Description |
| --- | --- | --- | --- | --- | --- |
| `npc_id` | `UUID` | no | none | pk | NPC 主键，与仿真世界中的 actor id 对齐。 |
| `role_code` | `VARCHAR(64)` | no | none | index | 角色职业或社会身份代码，如 `doctor`、`sheriff`。 |
| `public_persona` | `TEXT` | no | none | normal | 面向外界的稳定公开人格摘要。 |
| `hidden_secrets_json` | `JSONB` | no | `'[]'` | normal | 秘密列表，供 `Appraise`、`Reflect` 判断风险。 |
| `taboos_json` | `JSONB` | no | `'[]'` | normal | 明确禁止触碰的价值或行为边界。 |
| `core_drives_json` | `JSONB` | no | `'[]'` | normal | 核心驱动力列表。 |
| `long_term_goal_refs_json` | `JSONB` | no | `'[]'` | normal | 该 NPC 默认长期目标引用列表，作为缓存字段存在。 |
| `is_active` | `BOOLEAN` | no | `true` | index | NPC 当前是否参与本局仿真。 |
| `created_at` | `TIMESTAMP` | no | `CURRENT_TIMESTAMP` | normal | 创建时间。 |
| `updated_at` | `TIMESTAMP` | no | `CURRENT_TIMESTAMP` | normal | 最近更新时间。 |

#### 3.1.3 Index Design

| Index name | Type | Columns | Purpose |
| --- | --- | --- | --- |
| `pk_npc_identity_profile` | primary | `npc_id` | 主键定位。 |
| `idx_npc_identity_role_code` | normal | `role_code` | 支持按职业筛选 NPC 模板或运行时角色。 |
| `idx_npc_identity_is_active` | normal | `is_active` | 支持快速筛选当前参与仿真的 NPC。 |

#### 3.1.4 Constraints and Data Rules

| Rule type | Content |
| --- | --- |
| Unique constraints | `npc_id` 全局唯一。 |
| Foreign key or logical relation | 逻辑上被 `npc_goal_definition`、`npc_social_belief_edge`、`npc_working_memory_item`、`npc_long_term_memory_item`、`npc_cognition_event_log` 引用。 |
| Enum or status values | `role_code` To be confirmed；建议由内容模板系统维护。 |
| Data validation | `hidden_secrets_json`、`taboos_json`、`core_drives_json` 必须为 JSON array。 |
| Soft delete strategy | 不使用软删，默认通过 `is_active` 表示是否参与当前仿真。 |
| Audit fields | `created_at`, `updated_at`。 |

#### 3.1.5 Lifecycle and Capacity

| Item | Content |
| --- | --- |
| Retention | 保留至角色模板或存档删除。 |
| Growth expectation | 数量级与 NPC 总量相同，通常较小。 |
| Archival strategy | 归档到存档快照时整表快照即可。 |
| Partition or sharding note | 不需要分片。 |

#### 3.1.6 Risks and Open Questions

- `long_term_goal_refs_json` 与 `npc_goal_definition` 之间存在冗余，需要明确谁是权威来源。
- `role_code` 是否应拆成 `role_code` 和 `faction_code`，To be confirmed。

### 3.2 `npc_goal_definition`

#### 3.2.1 Table Summary

| Item | Content |
| --- | --- |
| Table name | `npc_goal_definition` |
| Purpose | 存储 NPC 的长期目标池与目标属性。 |
| Primary key | `goal_id` |
| Write pattern | 中低频更新，设计期初始化，运行期可做状态更新。 |
| Read pattern | 高频读取，供 `Goal Arbitration` 使用。 |

#### 3.2.2 Field Definitions

| Column | Type | Nullable | Default | Key role | Description |
| --- | --- | --- | --- | --- | --- |
| `goal_id` | `UUID` | no | none | pk | 目标主键。 |
| `npc_id` | `UUID` | no | none | index | 所属 NPC。 |
| `goal_kind` | `VARCHAR(32)` | no | none | index | 目标类别，建议使用 `self_preserve`、`secrecy`、`relationship`、`status`、`investigation`、`ambition`。 |
| `summary` | `TEXT` | no | none | normal | 目标摘要。 |
| `priority_base` | `NUMERIC(5,4)` | no | `0.5` | normal | 基础优先级，范围建议 `0-1`。 |
| `is_long_term` | `BOOLEAN` | no | `true` | normal | 是否属于长期目标。 |
| `target_actor_ids_json` | `JSONB` | no | `'[]'` | normal | 目标涉及的 actor 列表。 |
| `blockers_json` | `JSONB` | no | `'[]'` | normal | 已知阻碍条件列表。 |
| `status` | `VARCHAR(24)` | no | `'active'` | index | 当前目标状态，建议 `active`、`blocked`、`failed`、`completed`。 |
| `created_at` | `TIMESTAMP` | no | `CURRENT_TIMESTAMP` | normal | 创建时间。 |
| `updated_at` | `TIMESTAMP` | no | `CURRENT_TIMESTAMP` | normal | 更新时间。 |

#### 3.2.3 Index Design

| Index name | Type | Columns | Purpose |
| --- | --- | --- | --- |
| `pk_npc_goal_definition` | primary | `goal_id` | 主键定位。 |
| `idx_goal_npc_status` | normal | `npc_id`, `status` | 快速读取当前可参与仲裁的目标。 |
| `idx_goal_npc_kind` | normal | `npc_id`, `goal_kind` | 按类别聚合目标。 |

#### 3.2.4 Constraints and Data Rules

| Rule type | Content |
| --- | --- |
| Unique constraints | `goal_id` 全局唯一。 |
| Foreign key or logical relation | `npc_id -> npc_identity_profile.npc_id`。 |
| Enum or status values | `goal_kind` 与 `status` 都应使用固定枚举。 |
| Data validation | `priority_base` 范围应限制在 `0-1`。 |
| Soft delete strategy | 不使用软删，状态字段承担生命周期表达。 |
| Audit fields | `created_at`, `updated_at`。 |

#### 3.2.5 Lifecycle and Capacity

| Item | Content |
| --- | --- |
| Retention | 与 NPC 生命周期一致。 |
| Growth expectation | 每个 NPC 通常为低个位数到十余条。 |
| Archival strategy | 存档快照保留完整状态。 |
| Partition or sharding note | 不需要。 |

#### 3.2.6 Risks and Open Questions

- 目标状态是否需要单独的历史表记录演化轨迹，To be confirmed。
- `blockers_json` 是否应拆成结构化关联表，当前先保持 JSONB。

### 3.3 `npc_social_belief_edge`

#### 3.3.1 Table Summary

| Item | Content |
| --- | --- |
| Table name | `npc_social_belief_edge` |
| Purpose | 存储 NPC 对其他 actor 的局部社会信念。 |
| Primary key | `edge_id` |
| Write pattern | 中高频更新，由 `Reflect` 后的状态更新器落地。 |
| Read pattern | 高频读取，供 `Perceive`、`Appraise` 使用。 |

#### 3.3.2 Field Definitions

| Column | Type | Nullable | Default | Key role | Description |
| --- | --- | --- | --- | --- | --- |
| `edge_id` | `UUID` | no | none | pk | 社会信念边主键。 |
| `npc_id` | `UUID` | no | none | unique/index | 观察者 NPC。 |
| `target_actor_id` | `UUID` | no | none | unique/index | 被观察 actor。 |
| `trust` | `NUMERIC(5,4)` | no | `0.5` | normal | 信任度。 |
| `fear` | `NUMERIC(5,4)` | no | `0.0` | normal | 恐惧度。 |
| `suspicion` | `NUMERIC(5,4)` | no | `0.0` | normal | 怀疑度。 |
| `dependency` | `NUMERIC(5,4)` | no | `0.0` | normal | 依赖度。 |
| `usefulness` | `NUMERIC(5,4)` | no | `0.0` | normal | 利用价值。 |
| `last_change_tick` | `BIGINT` | yes | none | normal | 最近变化的 tick。 |
| `updated_at` | `TIMESTAMP` | no | `CURRENT_TIMESTAMP` | normal | 更新时间。 |

#### 3.3.3 Index Design

| Index name | Type | Columns | Purpose |
| --- | --- | --- | --- |
| `pk_npc_social_belief_edge` | primary | `edge_id` | 主键定位。 |
| `uk_npc_social_pair` | unique | `npc_id`, `target_actor_id` | 确保单个 NPC 对同一目标只有一条信念边。 |
| `idx_social_target_actor` | normal | `target_actor_id` | 支持查询谁在关注某 actor。 |

#### 3.3.4 Constraints and Data Rules

| Rule type | Content |
| --- | --- |
| Unique constraints | `npc_id + target_actor_id` 唯一。 |
| Foreign key or logical relation | `npc_id -> npc_identity_profile.npc_id`；`target_actor_id` 逻辑关联 world actor 表。 |
| Enum or status values | N/A |
| Data validation | 数值字段建议限制在 `0-1`。 |
| Soft delete strategy | 不使用软删，删除表示边不存在。 |
| Audit fields | `updated_at`, `last_change_tick`。 |

#### 3.3.5 Lifecycle and Capacity

| Item | Content |
| --- | --- |
| Retention | 单局全程保留，存档时保留。 |
| Growth expectation | 最坏接近 `NPC * actor`，但实际通常稀疏。 |
| Archival strategy | 存档快照。 |
| Partition or sharding note | To be confirmed；大量 NPC 时可按 `npc_id` 分区。 |

#### 3.3.6 Risks and Open Questions

- 若世界 actor 包含玩家、NPC、临时角色，`target_actor_id` 的外键策略需要确认。
- 后续是否拆出 `leverage`、`authority_sensitivity` 等字段，To be confirmed。

### 3.4 `npc_working_memory_item`

#### 3.4.1 Table Summary

| Item | Content |
| --- | --- |
| Table name | `npc_working_memory_item` |
| Purpose | 存储 NPC 工作记忆焦点条目。 |
| Primary key | `wm_id` |
| Write pattern | 高频更新，由 `Update Working Memory` 与 `Reflect` 后效共同驱动。 |
| Read pattern | 高频读取，供 `Perceive`、`Goal Arbitration`、`Action Selection`、`Reflect` 使用。 |

#### 3.4.2 Field Definitions

| Column | Type | Nullable | Default | Key role | Description |
| --- | --- | --- | --- | --- | --- |
| `wm_id` | `UUID` | no | none | pk | 工作记忆条目主键，同时承担 concern id 语义。 |
| `npc_id` | `UUID` | no | none | index | 所属 NPC。 |
| `kind` | `VARCHAR(32)` | no | none | index | 工作记忆类别，如 `threat`、`opportunity`、`social`、`goal`、`clue`、`player_model`。 |
| `summary` | `TEXT` | no | none | normal | 当前焦点摘要。 |
| `source_observation_ids_json` | `JSONB` | no | `'[]'` | normal | 来源观察 id。 |
| `source_memory_ids_json` | `JSONB` | no | `'[]'` | normal | 来源长期记忆 id。 |
| `related_actor_ids_json` | `JSONB` | no | `'[]'` | normal | 相关 actor 列表。 |
| `related_goal_ids_json` | `JSONB` | no | `'[]'` | normal | 相关 goal 列表。 |
| `priority` | `NUMERIC(5,4)` | no | `0.0` | normal | 优先级。 |
| `confidence` | `NUMERIC(5,4)` | no | `0.0` | normal | 可信度。 |
| `emotional_charge` | `NUMERIC(5,4)` | no | `0.0` | normal | 情绪张力。 |
| `freshness` | `NUMERIC(5,4)` | no | `0.0` | normal | 新鲜度。 |
| `decay_rate` | `NUMERIC(5,4)` | no | `0.95` | normal | 衰减率。 |
| `status` | `VARCHAR(24)` | no | `'background'` | index | `active / background / cooling`。 |
| `first_seen_at_tick` | `BIGINT` | no | none | normal | 首次进入工作记忆的 tick。 |
| `last_updated_at_tick` | `BIGINT` | no | none | normal | 最近更新 tick。 |
| `expires_at_tick` | `BIGINT` | yes | none | normal | 过期 tick。 |
| `updated_at` | `TIMESTAMP` | no | `CURRENT_TIMESTAMP` | normal | 更新时间。 |

#### 3.4.3 Index Design

| Index name | Type | Columns | Purpose |
| --- | --- | --- | --- |
| `pk_npc_working_memory_item` | primary | `wm_id` | 主键定位。 |
| `idx_wm_npc_status_priority` | normal | `npc_id`, `status`, `priority` | 读取 active/background 条目并排序。 |
| `idx_wm_npc_kind` | normal | `npc_id`, `kind` | 按类别查找焦点。 |
| `idx_wm_expire_tick` | normal | `npc_id`, `expires_at_tick` | 支持过期清理。 |

#### 3.4.4 Constraints and Data Rules

| Rule type | Content |
| --- | --- |
| Unique constraints | `wm_id` 全局唯一。 |
| Foreign key or logical relation | `npc_id -> npc_identity_profile.npc_id`。 |
| Enum or status values | `kind`、`status` 使用固定枚举。 |
| Data validation | `priority`、`confidence`、`emotional_charge`、`freshness`、`decay_rate` 建议限制在 `0-1`。 |
| Soft delete strategy | 不使用软删；清理或过期后物理删除即可。 |
| Audit fields | `updated_at`, `first_seen_at_tick`, `last_updated_at_tick`。 |

#### 3.4.5 Lifecycle and Capacity

| Item | Content |
| --- | --- |
| Retention | 单局短期保留，存档时按快照保留。 |
| Growth expectation | 每个 NPC 同时保留 `6-10` 条。 |
| Archival strategy | 默认不做单表归档，依赖存档快照。 |
| Partition or sharding note | 不需要。 |

#### 3.4.6 Risks and Open Questions

- `activeConcernIds` 当前由 `status=active` + `wm_id` 推导，不单独存字段；后续若需要排序缓存字段，To be confirmed。
- 是否需要独立 working memory history 表用于调试，To be confirmed。

### 3.5 `npc_long_term_memory_item`

#### 3.5.1 Table Summary

| Item | Content |
| --- | --- |
| Table name | `npc_long_term_memory_item` |
| Purpose | 存储 NPC 的长期记忆正文。 |
| Primary key | `memory_id` |
| Write pattern | 中频写入，由 `Compress` 新建、合并和强化。 |
| Read pattern | 中高频读取，供长期记忆读取机制召回和重排。 |

#### 3.5.2 Field Definitions

| Column | Type | Nullable | Default | Key role | Description |
| --- | --- | --- | --- | --- | --- |
| `memory_id` | `UUID` | no | none | pk | 长期记忆主键。 |
| `npc_id` | `UUID` | no | none | index | 所属 NPC。 |
| `kind` | `VARCHAR(24)` | no | none | index | `episodic / social / player_model / clue`。 |
| `summary` | `TEXT` | no | none | normal | 长期记忆摘要正文。 |
| `importance` | `NUMERIC(5,4)` | no | `0.0` | normal | 重要度。 |
| `confidence` | `NUMERIC(5,4)` | no | `0.0` | normal | 置信度。 |
| `source_event_ids_json` | `JSONB` | no | `'[]'` | normal | 来源事件 id 列表。 |
| `related_actor_ids_json` | `JSONB` | no | `'[]'` | normal | 相关 actor 列表。 |
| `tags_json` | `JSONB` | no | `'[]'` | normal | 用于检索和重排的 tags。 |
| `reinforcement_count` | `INTEGER` | no | `0` | normal | 被再次验证或强化的次数。 |
| `first_stored_at_tick` | `BIGINT` | no | none | normal | 首次写入 tick。 |
| `last_reinforced_at_tick` | `BIGINT` | no | none | normal | 最近强化 tick。 |
| `created_at` | `TIMESTAMP` | no | `CURRENT_TIMESTAMP` | normal | 创建时间。 |
| `updated_at` | `TIMESTAMP` | no | `CURRENT_TIMESTAMP` | normal | 更新时间。 |

#### 3.5.3 Index Design

| Index name | Type | Columns | Purpose |
| --- | --- | --- | --- |
| `pk_npc_long_term_memory_item` | primary | `memory_id` | 主键定位。 |
| `idx_ltm_npc_kind_importance` | normal | `npc_id`, `kind`, `importance` | 支持按类型和重要度检索。 |
| `idx_ltm_npc_reinforced` | normal | `npc_id`, `last_reinforced_at_tick` | 支持近期强化记忆检索。 |

#### 3.5.4 Constraints and Data Rules

| Rule type | Content |
| --- | --- |
| Unique constraints | `memory_id` 全局唯一。 |
| Foreign key or logical relation | `npc_id -> npc_identity_profile.npc_id`。 |
| Enum or status values | `kind` 使用固定枚举。 |
| Data validation | `importance`、`confidence` 限制在 `0-1`。 |
| Soft delete strategy | To be confirmed；第一版默认不软删。 |
| Audit fields | `created_at`, `updated_at`, `first_stored_at_tick`, `last_reinforced_at_tick`。 |

#### 3.5.5 Lifecycle and Capacity

| Item | Content |
| --- | --- |
| Retention | 单局或存档全周期保留。 |
| Growth expectation | 中等增长，需要配合压缩和后续遗忘策略。 |
| Archival strategy | 可随存档整体快照；长期多局共享策略 To be confirmed。 |
| Partition or sharding note | To be confirmed；大规模时可按 `npc_id` 或存档分区。 |

#### 3.5.6 Risks and Open Questions

- 是否需要显式 `decay_score` 或 `is_archived` 字段，To be confirmed。
- 多局共享 NPC 模板时，长期记忆是否和模板分离，To be confirmed。

### 3.6 `npc_memory_retrieval_summary`

#### 3.6.1 Table Summary

| Item | Content |
| --- | --- |
| Table name | `npc_memory_retrieval_summary` |
| Purpose | 存储长期记忆读取索引层，供 `Cycle Prefetch` 和阶段检索轻量召回。 |
| Primary key | `summary_id` |
| Write pattern | 中频更新，由 `Compress` 新建或刷新。 |
| Read pattern | 高频读取，供长期记忆读取层召回。 |

#### 3.6.2 Field Definitions

| Column | Type | Nullable | Default | Key role | Description |
| --- | --- | --- | --- | --- | --- |
| `summary_id` | `UUID` | no | none | pk | 索引层条目主键。 |
| `memory_id` | `UUID` | no | none | unique/index | 对应长期记忆 id。 |
| `npc_id` | `UUID` | no | none | index | 所属 NPC。 |
| `kind` | `VARCHAR(24)` | no | none | index | 与长期记忆 kind 一致。 |
| `retrieval_hint` | `TEXT` | no | none | normal | 低成本检索用提示语。 |
| `tags_json` | `JSONB` | no | `'[]'` | normal | 用于规则召回的 tag 列表。 |
| `last_generated_at_tick` | `BIGINT` | no | none | normal | 最近生成 tick。 |
| `updated_at` | `TIMESTAMP` | no | `CURRENT_TIMESTAMP` | normal | 更新时间。 |

#### 3.6.3 Index Design

| Index name | Type | Columns | Purpose |
| --- | --- | --- | --- |
| `pk_npc_memory_retrieval_summary` | primary | `summary_id` | 主键定位。 |
| `uk_memory_retrieval_summary_memory` | unique | `memory_id` | 一条长期记忆只对应一条索引摘要。 |
| `idx_summary_npc_kind` | normal | `npc_id`, `kind` | 按 NPC 和记忆类型召回。 |

#### 3.6.4 Constraints and Data Rules

| Rule type | Content |
| --- | --- |
| Unique constraints | `memory_id` 唯一。 |
| Foreign key or logical relation | `memory_id -> npc_long_term_memory_item.memory_id`；`npc_id -> npc_identity_profile.npc_id`。 |
| Enum or status values | `kind` 使用固定枚举。 |
| Data validation | `tags_json` 必须为 JSON array。 |
| Soft delete strategy | 跟随长期记忆正文同步删除。 |
| Audit fields | `updated_at`, `last_generated_at_tick`。 |

#### 3.6.5 Lifecycle and Capacity

| Item | Content |
| --- | --- |
| Retention | 与长期记忆正文生命周期一致。 |
| Growth expectation | 数量级与长期记忆条目基本一致。 |
| Archival strategy | 随长期记忆一同快照。 |
| Partition or sharding note | 不单独分片。 |

#### 3.6.6 Risks and Open Questions

- 是否需要全文索引或向量索引专门支持 `retrieval_hint`，To be confirmed。
- `retrieval_hint` 是否拆成关键词层和自然语言层，To be confirmed。

### 3.7 `npc_cognition_event_log`

#### 3.7.1 Table Summary

| Item | Content |
| --- | --- |
| Table name | `npc_cognition_event_log` |
| Purpose | 存储认知链路中用于回放、调试和审计的阶段结果摘要。 |
| Primary key | `log_id` |
| Write pattern | 高频追加写。 |
| Read pattern | 调试、回放、问题分析时按 NPC/tick/stage 读取。 |

#### 3.7.2 Field Definitions

| Column | Type | Nullable | Default | Key role | Description |
| --- | --- | --- | --- | --- | --- |
| `log_id` | `UUID` | no | none | pk | 认知日志主键。 |
| `npc_id` | `UUID` | no | none | index | 所属 NPC。 |
| `tick` | `BIGINT` | no | none | index | 所属 tick。 |
| `stage_name` | `VARCHAR(32)` | no | none | index | 阶段名，如 `perceive`、`appraise`、`act`、`reflect`。 |
| `summary` | `TEXT` | no | none | normal | 阶段结果摘要。 |
| `payload_json` | `JSONB` | no | `'{}'` | normal | 结构化调试载荷。 |
| `source_ref_id` | `UUID` | yes | none | normal | 关联的 execution / reflection / memory id。 |
| `created_at` | `TIMESTAMP` | no | `CURRENT_TIMESTAMP` | normal | 写入时间。 |

#### 3.7.3 Index Design

| Index name | Type | Columns | Purpose |
| --- | --- | --- | --- |
| `pk_npc_cognition_event_log` | primary | `log_id` | 主键定位。 |
| `idx_cognition_log_npc_tick` | normal | `npc_id`, `tick` | 回放单个 NPC 单 tick 的认知链路。 |
| `idx_cognition_log_stage` | normal | `npc_id`, `stage_name`, `created_at` | 按阶段追查问题。 |

#### 3.7.4 Constraints and Data Rules

| Rule type | Content |
| --- | --- |
| Unique constraints | `log_id` 全局唯一。 |
| Foreign key or logical relation | `npc_id -> npc_identity_profile.npc_id`；`source_ref_id` 逻辑关联不同阶段结果。 |
| Enum or status values | `stage_name` 使用固定枚举。 |
| Data validation | `payload_json` 必须为对象。 |
| Soft delete strategy | 默认不软删，按存档或运维策略归档。 |
| Audit fields | `created_at`。 |

#### 3.7.5 Lifecycle and Capacity

| Item | Content |
| --- | --- |
| Retention | To be confirmed；建议开发环境长保留，正式局可按存档窗口保留。 |
| Growth expectation | 高频增长，是最可能膨胀的表。 |
| Archival strategy | 建议按 `tick` 或时间窗口归档。 |
| Partition or sharding note | 建议按存档 id 或时间窗口分区，To be confirmed。 |

#### 3.7.6 Risks and Open Questions

- `payload_json` 容易膨胀，需要日志裁剪策略。
- 是否拆分为 `world_event_log` 和 `cognition_debug_log` 两张表，To be confirmed。

## 4. Cross-Table Relationships

| From table | To table | Relationship | Notes |
| --- | --- | --- | --- |
| `npc_goal_definition` | `npc_identity_profile` | `N:1` | 一个 NPC 有多个目标定义。 |
| `npc_social_belief_edge` | `npc_identity_profile` | `N:1` | 一个 NPC 对多个 actor 形成信念边。 |
| `npc_working_memory_item` | `npc_identity_profile` | `N:1` | 一个 NPC 有多个短时焦点。 |
| `npc_long_term_memory_item` | `npc_identity_profile` | `N:1` | 一个 NPC 有多条长期记忆。 |
| `npc_memory_retrieval_summary` | `npc_long_term_memory_item` | `1:1` | 一条长期记忆对应一条读取索引。 |
| `npc_cognition_event_log` | `npc_identity_profile` | `N:1` | 一个 NPC 产生多条认知阶段日志。 |

## 5. Consistency and Transaction Notes

- `Compress` 写长期记忆正文和 `npc_memory_retrieval_summary` 时应放在同一事务内，避免正文和索引层失配。
- `Update Working Memory` 对同一 NPC 的短时焦点更新建议使用单事务，避免 active/background 状态半更新。
- `Reflect` 产生的 belief update hint 不应直接在反思事务中改社交边，应交由统一状态更新器处理。
- `npc_cognition_event_log` 允许 eventual consistency，失败时不应阻断主仿真流程，但应记录告警。
- 当前文档默认一套运行态表只服务一个存档上下文；若多个存档共库，所有写事务都必须带 `save_id` 或等价的分区键参与主键和索引设计。

## 6. Migration and Compatibility Impact

- 新增表属于增量设计，对现有项目兼容性风险低。
- `npc_working_memory_item` 与 `npc_long_term_memory_item` 的 JSONB 字段较多，后续若转结构化子表需要数据迁移。
- `npc_memory_retrieval_summary` 的存在意味着读取侧不应直接依赖长期记忆正文做首轮召回。
- 若后续引入向量检索，可能需要为 `npc_long_term_memory_item` 或 `npc_memory_retrieval_summary` 补充向量列；当前留为 To be confirmed。
- 若后续从“单存档单库”切换到“多存档共库”，需要把 `save_id` 引入 `npc_goal_definition`、`npc_social_belief_edge`、`npc_working_memory_item`、`npc_long_term_memory_item`、`npc_memory_retrieval_summary`、`npc_cognition_event_log`，并评估 `npc_identity_profile` 是否需要拆为模板层与运行态快照层。

## 7. Appendix

- 当前文档基于现有认知设计文档抽取稳定实体，未包含 tick 内纯内存结构，如 `TickMemoryReadContext`。
- 若后续需要正式 DDL，可在本设计稳定后单独生成，不在本文件内直接给出。
