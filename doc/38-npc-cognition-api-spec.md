# NPC Cognition Internal API Design Specification

## 1. Document Overview

| Item | Content |
| --- | --- |
| Document title | `AIWesternTown NPC cognition internal API` |
| Business goal | 为内部仿真编排器提供稳定、可审计的 NPC 认知阶段接口，支撑长期记忆预取、认知各阶段执行与压缩落地。 |
| Scope | 覆盖九个常规认知内部接口，以及 `long-actions/enter`、`long-actions/advance`、`long-actions/abort`、`long-actions/resolve`、`deep-processing/run` 五个横向编排接口。 |
| Non-goals | 不覆盖玩家公开 API、不覆盖内容生产后台、不覆盖流式对话接口、不覆盖批量存档管理接口。 |
| Target callers | 内部仿真编排器、开发调试工具、回放验证工具 |

## 2. API Inventory

| API name | Method | Path | Purpose |
| --- | --- | --- | --- |
| `memory_prefetch` | `POST` | `/internal/npcs/{npcId}/memory/prefetch` | 执行 `Cycle Prefetch`，返回背景激活记忆。 |
| `perceive_stage` | `POST` | `/internal/npcs/{npcId}/cognition/perceive` | 执行 `Perceive`。 |
| `appraise_stage` | `POST` | `/internal/npcs/{npcId}/cognition/appraise` | 执行 `Appraise`。 |
| `working_memory_update_stage` | `POST` | `/internal/npcs/{npcId}/cognition/working-memory/update` | 执行工作记忆更新。 |
| `goal_arbitration_stage` | `POST` | `/internal/npcs/{npcId}/cognition/goal-arbitration` | 执行目标仲裁。 |
| `action_selection_stage` | `POST` | `/internal/npcs/{npcId}/cognition/action-selection` | 执行动作选择。 |
| `act_stage` | `POST` | `/internal/npcs/{npcId}/cognition/act` | 执行动作并生成权威结果。 |
| `reflect_stage` | `POST` | `/internal/npcs/{npcId}/cognition/reflect` | 执行反思。 |
| `compress_stage` | `POST` | `/internal/npcs/{npcId}/cognition/compress` | 压缩反思候选为长期记忆写入结果。 |
| `enter_internal_long_action` | `POST` | `/internal/npcs/{npcId}/long-actions/enter` | 创建 `sleep` / `epiphany` 内部长动作。 |
| `advance_internal_long_action` | `POST` | `/internal/npcs/{npcId}/long-actions/advance` | 推进活跃长动作到 `holding` / `resolved`。 |
| `abort_internal_long_action` | `POST` | `/internal/npcs/{npcId}/long-actions/abort` | 以 `aborted` 结束长动作并丢弃深处理机会。 |
| `resolve_internal_long_action` | `POST` | `/internal/npcs/{npcId}/long-actions/resolve` | 把已满足结算条件的长动作标记为 `resolved` 并生成 `DeepProcessingTrigger`。 |
| `run_deep_processing` | `POST` | `/internal/npcs/{npcId}/deep-processing/run` | 在长动作正常结算后执行一次 `runDeepProcessing`。 |

## 3. Single API Design

### 3.1 `memory_prefetch`

#### 3.1.1 Basic Information

| Item | Content |
| --- | --- |
| API name | `memory_prefetch` |
| Method | `POST` |
| Path | `/internal/npcs/{npcId}/memory/prefetch` |
| Purpose | 为当前 tick 生成 `Cycle Prefetch` 结果。 |
| Caller | 内部仿真编排器 |
| Authentication | Internal service token |
| Authorization | 仅内部仿真服务可调用 |
| Idempotency | yes，同一 `npcId + tick` 输入应返回可重复结果 |

#### 3.1.2 Request Headers

| Header | Required | Example | Description |
| --- | --- | --- | --- |
| `Authorization` | yes | `Bearer <service-token>` | 内部服务认证令牌 |
| `X-Save-Id` | yes | `save-2026-04-18-01` | 存档或仿真实例上下文；属于 API / 编排层逻辑绑定字段 |

#### 3.1.3 Path Parameters

| Name | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `npcId` | `string(uuid)` | yes | `5cb4...` | NPC 主键 |

#### 3.1.4 Query Parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| N/A | N/A | no | N/A | N/A |

#### 3.1.5 Request Body

| Field | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `tick` | `integer` | yes | `184` | 当前 tick |
| `sceneId` | `string` | yes | `saloon` | 当前场景 |
| `activeConcernIds` | `array[string]` | yes | `["wm-2","wm-3"]` | 当前活跃 concern |
| `actorIds` | `array[string]` | no | `["player","sheriff"]` | 当前场景主要 actor |
| `goalIds` | `array[string]` | no | `["goal-hide-injury-truth"]` | 当前目标线索 |
| `maxResults` | `integer` | yes | `3` | 返回条目上限 |

#### 3.1.6 Response Body

| Field | Type | Always present | Example | Description |
| --- | --- | --- | --- | --- |
| `requester` | `string` | yes | `cycle_prefetch` | 固定为预取来源 |
| `hits` | `array[object]` | yes | `[]` | 预取命中的长期记忆结果 |
| `readContextPatch` | `object` | yes | `{}` | 写入 `TickMemoryReadContext.prefetchedHits` 的增量结果；若保留该字段，其 `prefetchedHits` 必须是完整命中对象数组，与 `hits` / `TickMemoryReadContext.prefetchedHits` 同形 |

#### 3.1.7 Status Codes and Business Errors

| Code | Condition | Response meaning |
| --- | --- | --- |
| `200` | 成功 | 返回预取结果 |
| `400` | 请求体缺字段或 `maxResults` 超界 | 调用参数无效 |
| `404` | `npcId` 不存在 | NPC 未找到 |
| `409` | 同一 tick 上下文冲突 | 读上下文状态不一致 |
| `500` | 内部检索异常 | 检索服务失败 |

#### 3.1.8 Pagination, Filtering, and Sorting

| Item | Content |
| --- | --- |
| Pagination | N/A |
| Filtering | 通过请求体中的 `actorIds`、`goalIds` 控制 |
| Sorting | 响应内按召回分排序 |
| Rate limiting | 内部接口，To be confirmed |

#### 3.1.9 Examples

- request example  
  `{"tick":184,"sceneId":"saloon","activeConcernIds":["wm-2"],"actorIds":["player"],"maxResults":3}`
- success response example  
  `{"requester":"cycle_prefetch","hits":[{"memoryId":"mem-player-probe-1","kind":"player_model","summary":"player tends to probe secrets in public","importance":0.82,"confidence":0.76,"relatedActorIds":["player"],"sourceEventIds":["evt-173"],"tags":["public_pressure","secret_risk"],"retrievalReasonTags":["actor_match","tag_match"],"score":0.91}],"readContextPatch":{"prefetchedHits":[{"memoryId":"mem-player-probe-1","kind":"player_model","summary":"player tends to probe secrets in public","importance":0.82,"confidence":0.76,"relatedActorIds":["player"],"sourceEventIds":["evt-173"],"tags":["public_pressure","secret_risk"],"retrievalReasonTags":["actor_match","tag_match"],"score":0.91}]}}`
- error response example  
  `{"code":"INVALID_MAX_RESULTS","message":"maxResults must be between 1 and 5"}`

#### 3.1.10 Risks and Open Questions

- `readContextPatch` 是否由服务端返回还是由编排器本地构造，To be confirmed。
- 若保留 `readContextPatch`，其职责仅是表达对 `TickMemoryReadContext.prefetchedHits` 的写入补丁，不引入独立中间结构。
- 预取是否允许直接读取 `retrievalSummary` 以外的正文，To be confirmed。

### 3.2 `perceive_stage`

#### 3.2.1 Basic Information

| Item | Content |
| --- | --- |
| API name | `perceive_stage` |
| Method | `POST` |
| Path | `/internal/npcs/{npcId}/cognition/perceive` |
| Purpose | 执行 `Perceive`，返回 `PerceivedItem[]`。 |
| Caller | 内部仿真编排器 |
| Authentication | Internal service token |
| Authorization | 仅内部仿真服务可调用 |
| Idempotency | yes，同一输入应返回同一结构结果 |

#### 3.2.2 Request Headers

| Header | Required | Example | Description |
| --- | --- | --- | --- |
| `Authorization` | yes | `Bearer <service-token>` | 内部认证 |
| `X-Save-Id` | yes | `save-2026-04-18-01` | 存档或仿真实例上下文 |

#### 3.2.3 Path Parameters

| Name | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `npcId` | `string(uuid)` | yes | `5cb4...` | NPC 主键 |

#### 3.2.4 Query Parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| N/A | N/A | no | N/A | N/A |

#### 3.2.5 Request Body

| Field | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `observableWorldSlice` | `object` | yes | `{...}` | 主文档定义的客观可观察世界切片 |
| `workingMemory` | `object` | yes | `{...}` | `NPCWorkingMemory` |
| `socialContextSlice` | `object` | yes | `{...}` | 当前局部关系切片 |
| `retrievedMemorySlice` | `object` | yes | `{...}` | 长期记忆读取侧生成的 `RetrievedMemorySlice` |

#### 3.2.6 Response Body

| Field | Type | Always present | Example | Description |
| --- | --- | --- | --- | --- |
| `perceivedItems` | `array[object]` | yes | `[]` | `PerceivedItem[]` |
| `debugMeta` | `object` | yes | `{}` | 原始候选数、保留数等调试信息 |

#### 3.2.7 Status Codes and Business Errors

| Code | Condition | Response meaning |
| --- | --- | --- |
| `200` | 成功 | 返回感知结果 |
| `400` | 缺少世界切片或 working memory | 请求无效 |
| `404` | NPC 或场景不存在 | 资源未找到 |
| `422` | 输入 slice 结构不合法 | 业务校验失败 |
| `500` | 内部计算错误 | 服务失败 |

#### 3.2.8 Pagination, Filtering, and Sorting

| Item | Content |
| --- | --- |
| Pagination | N/A |
| Filtering | N/A |
| Sorting | 响应内按 `salience` 降序 |
| Rate limiting | 内部接口，To be confirmed |

#### 3.2.9 Examples

- request example  
  `{"observableWorldSlice":{"sceneId":"saloon"},"workingMemory":{"activeConcernIds":["wm-2"]},"socialContextSlice":{"sceneId":"saloon"},"retrievedMemorySlice":{"memoryItems":[]}}`
- success response example  
  `{"perceivedItems":[{"observationId":"obs-1","salience":0.93}],"debugMeta":{"rawCount":5,"finalCount":2}}`
- error response example  
  `{"code":"INVALID_SOCIAL_CONTEXT","message":"sceneId mismatch"}`

#### 3.2.10 Risks and Open Questions

- `retrievedMemorySlice` 是否允许为空对象而不是空数组，To be confirmed。
- `debugMeta` 是否应在生产环境默认关闭，To be confirmed。

### 3.3 `appraise_stage`

#### 3.3.1 Basic Information

| Item | Content |
| --- | --- |
| API name | `appraise_stage` |
| Method | `POST` |
| Path | `/internal/npcs/{npcId}/cognition/appraise` |
| Purpose | 执行 `Appraise`，返回 `AppraisalResult[]`。 |
| Caller | 内部仿真编排器 |
| Authentication | Internal service token |
| Authorization | 仅内部仿真服务可调用 |
| Idempotency | yes |

#### 3.3.2 Request Headers

| Header | Required | Example | Description |
| --- | --- | --- | --- |
| `Authorization` | yes | `Bearer <service-token>` | 内部认证 |
| `X-Save-Id` | yes | `save-2026-04-18-01` | 存档或仿真实例上下文 |

#### 3.3.3 Path Parameters

| Name | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `npcId` | `string(uuid)` | yes | `5cb4...` | NPC 主键 |

#### 3.3.4 Query Parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `llmRefine` | `boolean` | no | `false` | 是否允许触发 LLM 精修 |

#### 3.3.5 Request Body

| Field | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `perceivedItems` | `array[object]` | yes | `[]` | `PerceivedItem[]` |
| `identitySlice` | `object` | yes | `{...}` | `NPCIdentitySlice` |
| `currentGoalState` | `object` | yes | `{...}` | `CurrentGoalState` |
| `socialBeliefSlice` | `object` | yes | `{...}` | `SocialBeliefSlice` |
| `retrievedBeliefSlice` | `object` | yes | `{...}` | `RetrievedBeliefSlice` |

#### 3.3.6 Response Body

| Field | Type | Always present | Example | Description |
| --- | --- | --- | --- | --- |
| `appraisalResults` | `array[object]` | yes | `[]` | `AppraisalResult[]` |
| `debugMeta` | `object` | yes | `{}` | 规则评分、是否触发 LLM 等 |

#### 3.3.7 Status Codes and Business Errors

| Code | Condition | Response meaning |
| --- | --- | --- |
| `200` | 成功 | 返回评价结果 |
| `400` | 请求体缺字段 | 请求无效 |
| `404` | NPC 不存在 | 资源未找到 |
| `422` | `perceivedItems` 为空且不允许空评价 | 业务约束失败 |
| `500` | 内部计算错误 | 服务失败 |

#### 3.3.8 Pagination, Filtering, and Sorting

| Item | Content |
| --- | --- |
| Pagination | N/A |
| Filtering | N/A |
| Sorting | 响应内按 `relevance` 降序 |
| Rate limiting | 内部接口，To be confirmed |

#### 3.3.9 Examples

- request example  
  `{"perceivedItems":[{"observationId":"obs-1"}],"identitySlice":{"npcId":"5cb4..."},"currentGoalState":{"activeGoalIds":["goal-hide"]},"socialBeliefSlice":{"relatedActors":[]},"retrievedBeliefSlice":{"beliefs":[]}}`
- success response example  
  `{"appraisalResults":[{"observationId":"obs-1","threat":0.88}],"debugMeta":{"llmRefined":false}}`
- error response example  
  `{"code":"EMPTY_PERCEIVED_ITEMS","message":"appraise requires at least one perceived item"}`

#### 3.3.10 Risks and Open Questions

- `llmRefine` 是否应由编排器传入还是由服务内部策略自动决定，To be confirmed。
- 是否需要批量评价多个 NPC 的接口，当前不覆盖。

### 3.4 `working_memory_update_stage`

#### 3.4.1 Basic Information

| Item | Content |
| --- | --- |
| API name | `working_memory_update_stage` |
| Method | `POST` |
| Path | `/internal/npcs/{npcId}/cognition/working-memory/update` |
| Purpose | 更新 `NPCWorkingMemory`。 |
| Caller | 内部仿真编排器 |
| Authentication | Internal service token |
| Authorization | 仅内部仿真服务可调用 |
| Idempotency | yes |

#### 3.4.2 Request Headers

| Header | Required | Example | Description |
| --- | --- | --- | --- |
| `Authorization` | yes | `Bearer <service-token>` | 内部认证 |
| `X-Save-Id` | yes | `save-2026-04-18-01` | 存档或仿真实例上下文 |

#### 3.4.3 Path Parameters

| Name | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `npcId` | `string(uuid)` | yes | `5cb4...` | NPC 主键 |

#### 3.4.4 Query Parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| N/A | N/A | no | N/A | N/A |

#### 3.4.5 Request Body

| Field | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `previousWorkingMemory` | `object` | yes | `{...}` | 旧 `NPCWorkingMemory` |
| `perceivedItems` | `array[object]` | yes | `[]` | 新感知结果 |
| `appraisalResults` | `array[object]` | yes | `[]` | 新评价结果 |
| `currentTick` | `integer` | yes | `184` | 当前 tick |

#### 3.4.6 Response Body

| Field | Type | Always present | Example | Description |
| --- | --- | --- | --- | --- |
| `workingMemory` | `object` | yes | `{...}` | 更新后的 `NPCWorkingMemory` |
| `activeConcernIds` | `array[string]` | yes | `["wm-2"]` | 当前活跃 concern ids |

#### 3.4.7 Status Codes and Business Errors

| Code | Condition | Response meaning |
| --- | --- | --- |
| `200` | 成功 | 返回新工作记忆 |
| `400` | 请求体缺字段 | 请求无效 |
| `404` | NPC 不存在 | 资源未找到 |
| `422` | working memory 超容量或字段非法 | 业务约束失败 |
| `500` | 内部更新错误 | 服务失败 |

#### 3.4.8 Pagination, Filtering, and Sorting

| Item | Content |
| --- | --- |
| Pagination | N/A |
| Filtering | N/A |
| Sorting | 返回条目按 rank score 排序 |
| Rate limiting | 内部接口，To be confirmed |

#### 3.4.9 Examples

- request example  
  `{"previousWorkingMemory":{"items":[]},"perceivedItems":[{"observationId":"obs-1"}],"appraisalResults":[{"observationId":"obs-1","threat":0.88}],"currentTick":184}`
- success response example  
  `{"workingMemory":{"items":[{"wmId":"wm-2"}]},"activeConcernIds":["wm-2"]}`
- error response example  
  `{"code":"WORKING_MEMORY_CAPACITY_EXCEEDED","message":"active item count exceeds limit"}`

#### 3.4.10 Risks and Open Questions

- 是否需要单独暴露 “只做衰减/清理” 的接口，To be confirmed。
- 当前接口默认调用方传完整旧状态，后续是否允许服务端读库补全，To be confirmed。

### 3.5 `goal_arbitration_stage`

#### 3.5.1 Basic Information

| Item | Content |
| --- | --- |
| API name | `goal_arbitration_stage` |
| Method | `POST` |
| Path | `/internal/npcs/{npcId}/cognition/goal-arbitration` |
| Purpose | 在候选目标中选出当前主导目标。 |
| Caller | 内部仿真编排器 |
| Authentication | Internal service token |
| Authorization | 仅内部仿真服务可调用 |
| Idempotency | yes |

#### 3.5.2 Request Headers

| Header | Required | Example | Description |
| --- | --- | --- | --- |
| `Authorization` | yes | `Bearer <service-token>` | 内部认证 |
| `X-Save-Id` | yes | `save-2026-04-18-01` | 存档或仿真实例上下文 |

#### 3.5.3 Path Parameters

| Name | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `npcId` | `string(uuid)` | yes | `5cb4...` | NPC 主键 |

#### 3.5.4 Query Parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `allowLlmTiebreak` | `boolean` | no | `false` | 是否允许平分时触发 LLM 裁决 |

#### 3.5.5 Request Body

| Field | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `goalLibrary` | `array[object]` | yes | `[]` | `GoalDefinition[]` |
| `workingMemory` | `object` | yes | `{...}` | `NPCWorkingMemory` |
| `appraisalResults` | `array[object]` | yes | `[]` | `AppraisalResult[]` |
| `identitySlice` | `object` | yes | `{...}` | `NPCIdentitySlice` |
| `worldConstraintSlice` | `object` | yes | `{...}` | `WorldConstraintSlice` |

#### 3.5.6 Response Body

| Field | Type | Always present | Example | Description |
| --- | --- | --- | --- | --- |
| `goalResult` | `object` | yes | `{...}` | `GoalArbitrationResult` |
| `debugMeta` | `object` | yes | `{}` | 候选得分分解 |

#### 3.5.7 Status Codes and Business Errors

| Code | Condition | Response meaning |
| --- | --- | --- |
| `200` | 成功 | 返回主导目标 |
| `400` | 参数缺失 | 请求无效 |
| `404` | NPC 不存在 | 资源未找到 |
| `422` | 无可执行目标 | 业务约束失败 |
| `500` | 内部仲裁失败 | 服务失败 |

#### 3.5.8 Pagination, Filtering, and Sorting

| Item | Content |
| --- | --- |
| Pagination | N/A |
| Filtering | N/A |
| Sorting | 候选内部按 `goalScore` 排序 |
| Rate limiting | 内部接口，To be confirmed |

#### 3.5.9 Examples

- request example  
  `{"goalLibrary":[{"goalId":"goal-hide"}],"workingMemory":{"activeConcernIds":["wm-2"]},"appraisalResults":[],"identitySlice":{"npcId":"5cb4..."},"worldConstraintSlice":{"sceneId":"saloon"}}`
- success response example  
  `{"goalResult":{"chosenGoalId":"goal-hide","chosenGoalKind":"secrecy"},"debugMeta":{"candidateCount":3}}`
- error response example  
  `{"code":"NO_EXECUTABLE_GOAL","message":"all candidate goals are blocked"}`

#### 3.5.10 Risks and Open Questions

- `goalLibrary` 是否由调用方传入，还是服务端按 `npcId` 读取数据库，To be confirmed。
- 是否需要批量 goal arbitration 接口，当前不覆盖。

### 3.6 `action_selection_stage`

#### 3.6.1 Basic Information

| Item | Content |
| --- | --- |
| API name | `action_selection_stage` |
| Method | `POST` |
| Path | `/internal/npcs/{npcId}/cognition/action-selection` |
| Purpose | 把主导目标转换为单个动作选择结果。 |
| Caller | 内部仿真编排器 |
| Authentication | Internal service token |
| Authorization | 仅内部仿真服务可调用 |
| Idempotency | yes |

#### 3.6.2 Request Headers

| Header | Required | Example | Description |
| --- | --- | --- | --- |
| `Authorization` | yes | `Bearer <service-token>` | 内部认证 |
| `X-Save-Id` | yes | `save-2026-04-18-01` | 存档或仿真实例上下文 |

#### 3.6.3 Path Parameters

| Name | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `npcId` | `string(uuid)` | yes | `5cb4...` | NPC 主键 |

#### 3.6.4 Query Parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `allowLlmStyleRefine` | `boolean` | no | `false` | 是否允许风格精修 |

#### 3.6.5 Request Body

| Field | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `goalResult` | `object` | yes | `{...}` | `GoalArbitrationResult` |
| `workingMemory` | `object` | yes | `{...}` | `NPCWorkingMemory` |
| `actionAffordanceSet` | `object` | yes | `{...}` | `ActionAffordanceSet` |
| `socialSlice` | `object` | yes | `{...}` | `ActionSelectionSocialSlice` |
| `policySlice` | `object` | yes | `{...}` | `ActionPolicySlice` |

#### 3.6.6 Response Body

| Field | Type | Always present | Example | Description |
| --- | --- | --- | --- | --- |
| `selectionResult` | `object` | yes | `{...}` | `ActionSelectionResult` |
| `debugMeta` | `object` | yes | `{}` | 候选动作与过滤原因 |

#### 3.6.7 Status Codes and Business Errors

| Code | Condition | Response meaning |
| --- | --- | --- |
| `200` | 成功 | 返回动作选择结果 |
| `400` | 缺少输入结构 | 请求无效 |
| `404` | NPC 不存在 | 资源未找到 |
| `422` | 无合法动作可选 | 业务约束失败 |
| `500` | 内部选择错误 | 服务失败 |

#### 3.6.8 Pagination, Filtering, and Sorting

| Item | Content |
| --- | --- |
| Pagination | N/A |
| Filtering | N/A |
| Sorting | 候选按 `actionScore` 排序 |
| Rate limiting | 内部接口，To be confirmed |

#### 3.6.9 Examples

- request example  
  `{"goalResult":{"chosenGoalId":"goal-hide"},"workingMemory":{"activeConcernIds":["wm-2"]},"actionAffordanceSet":{"candidates":[]},"socialSlice":{"audienceSize":3},"policySlice":{"forbiddenActionTags":[]}}`
- success response example  
  `{"selectionResult":{"chosenActionId":"act-steal-ledger","actionType":"interact","itemActionType":"steal","targetObjectIds":["ledger_main"]},"debugMeta":{"filteredOut":["act-leave-scene"]}}`
- error response example  
  `{"code":"NO_VALID_ACTION","message":"no candidate action passed policy and feasibility checks"}`

#### 3.6.10 Risks and Open Questions

- `allowLlmStyleRefine` 是否应完全隐藏在服务内部，To be confirmed。
- 候选动作是否需要独立调试查询接口，To be confirmed。
- 当 `selectionResult.itemActionType` 存在时，是否需要为 `actionType` / `itemActionType` 组合增加更严格校验错误码，To be confirmed。

### 3.7 `act_stage`

#### 3.7.1 Basic Information

| Item | Content |
| --- | --- |
| API name | `act_stage` |
| Method | `POST` |
| Path | `/internal/npcs/{npcId}/cognition/act` |
| Purpose | 执行动作并生成 `ActionExecutionResult`。 |
| Caller | 内部仿真编排器 |
| Authentication | Internal service token |
| Authorization | 仅内部仿真服务可调用 |
| Idempotency | yes，基于 `sourceActionId + tick` |

#### 3.7.2 Request Headers

| Header | Required | Example | Description |
| --- | --- | --- | --- |
| `Authorization` | yes | `Bearer <service-token>` | 内部认证 |
| `X-Save-Id` | yes | `save-2026-04-18-01` | 存档或仿真实例上下文 |

#### 3.7.3 Path Parameters

| Name | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `npcId` | `string(uuid)` | yes | `5cb4...` | NPC 主键 |

#### 3.7.4 Query Parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `renderVisibleOutcome` | `boolean` | no | `true` | 是否生成可见演出 |

#### 3.7.5 Request Body

| Field | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `selectionResult` | `object` | yes | `{...}` | `ActionSelectionResult` |
| `executionWorldStateSlice` | `object` | yes | `{...}` | `ExecutionWorldStateSlice` |
| `executionPolicySlice` | `object` | yes | `{...}` | `ExecutionPolicySlice` |
| `executionContextSlice` | `object` | yes | `{...}` | `ExecutionContextSlice` |

#### 3.7.6 Response Body

| Field | Type | Always present | Example | Description |
| --- | --- | --- | --- | --- |
| `executionResult` | `object` | yes | `{...}` | `ActionExecutionResult` |

#### 3.7.7 Status Codes and Business Errors

| Code | Condition | Response meaning |
| --- | --- | --- |
| `200` | 成功 | 返回执行结果 |
| `400` | 请求缺字段 | 请求无效 |
| `404` | NPC 或场景不存在 | 资源未找到 |
| `409` | 动作已执行或 tick 冲突 | 幂等或并发冲突 |
| `500` | 内部执行失败 | 服务失败 |

#### 3.7.8 Pagination, Filtering, and Sorting

| Item | Content |
| --- | --- |
| Pagination | N/A |
| Filtering | N/A |
| Sorting | N/A |
| Rate limiting | 内部接口，To be confirmed |

#### 3.7.9 Examples

- request example  
  `{"selectionResult":{"chosenActionId":"act-steal-ledger","actionType":"interact","itemActionType":"steal","targetObjectIds":["ledger_main"]},"executionWorldStateSlice":{"sceneId":"saloon"},"executionPolicySlice":{"blockedActionIds":[]},"executionContextSlice":{"actingNpcId":"5cb4..."}}`
- success response example  
  `{"executionResult":{"executionId":"exec-401","actionType":"interact","itemActionType":"steal","outcome":"success"}}`
- error response example  
  `{"code":"ACTION_ALREADY_EXECUTED","message":"action was already applied for this tick"}`

#### 3.7.10 Risks and Open Questions

- `renderVisibleOutcome` 若为 false，是否仍写 `visibleOutcome` 占位结构，To be confirmed。
- 是否需要独立的 world mutation 应用接口，当前不拆分。

### 3.8 `reflect_stage`

#### 3.8.1 Basic Information

| Item | Content |
| --- | --- |
| API name | `reflect_stage` |
| Method | `POST` |
| Path | `/internal/npcs/{npcId}/cognition/reflect` |
| Purpose | 执行轻量或深度反思，返回 `ReflectionResult`。 |
| Caller | 内部仿真编排器 |
| Authentication | Internal service token |
| Authorization | 仅内部仿真服务可调用 |
| Idempotency | yes |

#### 3.8.2 Request Headers

| Header | Required | Example | Description |
| --- | --- | --- | --- |
| `Authorization` | yes | `Bearer <service-token>` | 内部认证 |
| `X-Save-Id` | yes | `save-2026-04-18-01` | 存档或仿真实例上下文 |

#### 3.8.3 Path Parameters

| Name | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `npcId` | `string(uuid)` | yes | `5cb4...` | NPC 主键 |

#### 3.8.4 Query Parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `allowDeepReflectLlm` | `boolean` | no | `false` | 是否允许深度反思阶段调用 LLM |

#### 3.8.5 Request Body

| Field | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `executionResult` | `object` | yes | `{...}` | `ActionExecutionResult` |
| `workingMemory` | `object` | yes | `{...}` | `NPCWorkingMemory` |
| `eventWindow` | `object` | yes | `{...}` | `ReflectionEventWindow` |
| `identitySlice` | `object` | yes | `{...}` | `NPCIdentitySlice` |
| `beliefSlice` | `object` | yes | `{...}` | `ReflectionBeliefSlice` |
| `policySlice` | `object` | yes | `{...}` | `ReflectionPolicySlice` |

#### 3.8.6 Response Body

| Field | Type | Always present | Example | Description |
| --- | --- | --- | --- | --- |
| `reflectionResult` | `object` | yes | `{...}` | `ReflectionResult` |

#### 3.8.7 Status Codes and Business Errors

| Code | Condition | Response meaning |
| --- | --- | --- |
| `200` | 成功 | 返回反思结果 |
| `400` | 缺少执行结果或信念切片 | 请求无效 |
| `404` | NPC 不存在 | 资源未找到 |
| `422` | 反思输入不一致 | 业务约束失败 |
| `500` | 内部反思失败 | 服务失败 |

#### 3.8.8 Pagination, Filtering, and Sorting

| Item | Content |
| --- | --- |
| Pagination | N/A |
| Filtering | N/A |
| Sorting | `memoryCandidates` 建议按 importance 降序 |
| Rate limiting | 内部接口，To be confirmed |

#### 3.8.9 Examples

- request example  
  `{"executionResult":{"executionId":"exec-401"},"workingMemory":{"activeConcernIds":["wm-2"]},"eventWindow":{"recentEvents":[]},"identitySlice":{"npcId":"5cb4..."},"beliefSlice":{"actorBeliefs":[],"retrievedMemories":[]},"policySlice":{"significanceThreshold":0.7}}`
- success response example  
  `{"reflectionResult":{"reflectionId":"refl-88","mode":"deep"}}`
- error response example  
  `{"code":"INVALID_REFLECTION_INPUT","message":"belief slice and execution result belong to different ticks"}`

#### 3.8.10 Risks and Open Questions

- `beliefSlice.actorBeliefs` 与 `beliefSlice.retrievedMemories` 是否允许分源加载，To be confirmed。
- 深度反思是否应拆成单独接口，当前不拆。

### 3.9 `compress_stage`

#### 3.9.1 Basic Information

| Item | Content |
| --- | --- |
| API name | `compress_stage` |
| Method | `POST` |
| Path | `/internal/npcs/{npcId}/cognition/compress` |
| Purpose | 把反思候选压缩为长期记忆写入结果。 |
| Caller | 内部仿真编排器 |
| Authentication | Internal service token |
| Authorization | 仅内部仿真服务可调用 |
| Idempotency | yes |

#### 3.9.2 Request Headers

| Header | Required | Example | Description |
| --- | --- | --- | --- |
| `Authorization` | yes | `Bearer <service-token>` | 内部认证 |
| `X-Save-Id` | yes | `save-2026-04-18-01` | 存档或仿真实例上下文 |

#### 3.9.3 Path Parameters

| Name | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `npcId` | `string(uuid)` | yes | `5cb4...` | NPC 主键 |

#### 3.9.4 Query Parameters

| Name | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| N/A | N/A | no | N/A | N/A |

#### 3.9.5 Request Body

| Field | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `reflectionResult` | `object` | yes | `{...}` | `ReflectionResult` |
| `memoryCandidates` | `array[object]` | yes | `[]` | `ReflectionMemoryCandidate[]` |
| `existingMemories` | `object` | yes | `{...}` | `LongTermMemoryStoreSlice` |
| `compressionContext` | `object` | yes | `{...}` | `CompressionContextSlice` |
| `compressionPolicy` | `object` | yes | `{...}` | `CompressionPolicySlice` |

#### 3.9.6 Response Body

| Field | Type | Always present | Example | Description |
| --- | --- | --- | --- | --- |
| `compressionResult` | `object` | yes | `{...}` | `CompressionResult` |

#### 3.9.7 Status Codes and Business Errors

| Code | Condition | Response meaning |
| --- | --- | --- |
| `200` | 成功 | 返回压缩结果 |
| `400` | 请求缺字段 | 请求无效 |
| `404` | NPC 不存在 | 资源未找到 |
| `422` | 候选与现有记忆集不匹配 | 业务约束失败 |
| `500` | 内部压缩失败 | 服务失败 |

#### 3.9.8 Pagination, Filtering, and Sorting

| Item | Content |
| --- | --- |
| Pagination | N/A |
| Filtering | N/A |
| Sorting | 候选内部按 importance 排序后处理 |
| Rate limiting | 内部接口，To be confirmed |

#### 3.9.9 Examples

- request example  
  `{"reflectionResult":{"reflectionId":"refl-88"},"memoryCandidates":[{"candidateId":"mc-19"}],"existingMemories":{"memoryItems":[]},"compressionContext":{"npcId":"5cb4...","currentTick":184},"compressionPolicy":{"directStoreImportanceThreshold":0.8}}`
- success response example  
  `{"compressionResult":{"compressionId":"cmp-31","createdMemories":[],"reinforcedMemories":[]}}`
- error response example  
  `{"code":"INVALID_MEMORY_CANDIDATE_SET","message":"candidate npcId mismatch"}`

#### 3.9.10 Risks and Open Questions

- `existingMemories` 是否由调用方传切片还是服务端按 query 自取，To be confirmed。
- 是否需要把 `retrievalSummary` 更新拆成单独接口，当前不拆。

### 3.10 `enter_internal_long_action`

#### 3.10.1 Basic Information

| Item | Content |
| --- | --- |
| API name | `enter_internal_long_action` |
| Method | `POST` |
| Path | `/internal/npcs/{npcId}/long-actions/enter` |
| Purpose | 对应 [41-sleep-and-epiphany-long-actions.md](C:/codex/project/AIWesternTown/doc/41-sleep-and-epiphany-long-actions.md) 的 `enterInternalLongAction`，创建 `NpcLongActionState`。 |
| Caller | 内部仿真编排器 |
| Authentication | Internal service token |
| Authorization | 仅内部仿真服务可调用 |
| Idempotency | conditional，同一 `npcId + tick + kind` 在无活跃同类长动作时应返回同一 `actionId`；若已存在其他活跃长动作则返回冲突 |

#### 3.10.2 Request Body

| Field | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `kind` | `"sleep" \| "epiphany"` | yes | `"sleep"` | 长动作类型 |
| `tick` | `integer` | yes | `184` | 进入时 tick |
| `triggerTags` | `array[string]` | yes | `["fatigue","safe_indoor"]` | 对应 `sourceTriggerTags` |
| `boundSceneId` | `string` | no | `clinic_backroom` | 可选绑定场景 |

#### 3.10.3 Response Body

| Field | Type | Always present | Example | Description |
| --- | --- | --- | --- | --- |
| `longActionState` | `object` | yes | `{...}` | 新建后的 `NpcLongActionState`，初始 `status` 为 `entered` 或服务端已推进到 `holding` |

#### 3.10.4 Status Codes and Business Errors

| Code | Condition | Response meaning |
| --- | --- | --- |
| `200` | 成功 | 返回长动作状态 |
| `400` | `kind` 或 `triggerTags` 非法 | 请求无效 |
| `404` | NPC 不存在 | 资源未找到 |
| `409` | 已存在活跃长动作或进入条件不满足 | 生命周期冲突 |
| `500` | 内部状态创建失败 | 服务失败 |

#### 3.10.5 Notes

- 该接口属于横向编排能力，不属于常规逐 tick 八阶段，但其结果会影响后续调度与深处理门控。
- 返回结构复用 `NpcLongActionState`，不再为 API 层引入新术语。

### 3.11 `advance_internal_long_action`

#### 3.11.1 Basic Information

| Item | Content |
| --- | --- |
| API name | `advance_internal_long_action` |
| Method | `POST` |
| Path | `/internal/npcs/{npcId}/long-actions/advance` |
| Purpose | 对应 `advanceInternalLongAction`，推进长动作生命周期。 |
| Caller | 内部仿真编排器 |
| Authentication | Internal service token |
| Authorization | 仅内部仿真服务可调用 |
| Idempotency | yes，同一 `actionId + currentTick` 重放应返回相同 `LongActionStatePatch` |

#### 3.11.2 Request Body

| Field | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `state` | `object` | yes | `{...}` | 当前 `NpcLongActionState` |
| `currentTick` | `integer` | yes | `188` | 当前推进 tick |

#### 3.11.3 Response Body

| Field | Type | Always present | Example | Description |
| --- | --- | --- | --- | --- |
| `statePatch` | `object` | yes | `{...}` | `LongActionStatePatch`，`nextStatus` 只能是 `holding` 或 `resolved` |

#### 3.11.4 Status Codes and Business Errors

| Code | Condition | Response meaning |
| --- | --- | --- |
| `200` | 成功 | 返回状态补丁 |
| `400` | 缺少 `state` 或 `currentTick` | 请求无效 |
| `404` | NPC 或 `actionId` 不存在 | 资源未找到 |
| `409` | 状态已终态或 tick 回退 | 生命周期冲突 |
| `500` | 内部推进失败 | 服务失败 |

#### 3.11.5 Notes

- `advance` 只负责生命周期推进，不直接产生 `DeepProcessingTrigger`；触发器由 `resolve` 接口显式产出。

### 3.12 `abort_internal_long_action`

#### 3.12.1 Basic Information

| Item | Content |
| --- | --- |
| API name | `abort_internal_long_action` |
| Method | `POST` |
| Path | `/internal/npcs/{npcId}/long-actions/abort` |
| Purpose | 对应 `abortInternalLongAction`，把活跃长动作标记为 `aborted`。 |
| Caller | 内部仿真编排器 |
| Authentication | Internal service token |
| Authorization | 仅内部仿真服务可调用 |
| Idempotency | yes，同一 `actionId + currentTick + reasonTags` 重放应返回相同 `LongActionStatePatch` |

#### 3.12.2 Request Body

| Field | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `state` | `object` | yes | `{...}` | 当前 `NpcLongActionState` |
| `currentTick` | `integer` | yes | `186` | 打断发生 tick |
| `reasonTags` | `array[string]` | yes | `["public_violence","forced_return_to_foreground"]` | 对应 `abortReasonTags` |

#### 3.12.3 Response Body

| Field | Type | Always present | Example | Description |
| --- | --- | --- | --- | --- |
| `statePatch` | `object` | yes | `{...}` | `LongActionStatePatch`，`nextStatus` 固定为 `aborted` |

#### 3.12.4 Status Codes and Business Errors

| Code | Condition | Response meaning |
| --- | --- | --- |
| `200` | 成功 | 返回中断补丁 |
| `400` | `reasonTags` 为空 | 请求无效 |
| `404` | NPC 或 `actionId` 不存在 | 资源未找到 |
| `409` | 长动作已 `resolved` 或已 `aborted` | 生命周期冲突 |
| `500` | 内部中断失败 | 服务失败 |

#### 3.12.5 Notes

- `abort` 成功后不得再调用 `resolve`，且不得产生 `DeepProcessingTrigger`。

### 3.13 `resolve_internal_long_action`

#### 3.13.1 Basic Information

| Item | Content |
| --- | --- |
| API name | `resolve_internal_long_action` |
| Method | `POST` |
| Path | `/internal/npcs/{npcId}/long-actions/resolve` |
| Purpose | 对应 `resolveInternalLongAction`，在长动作正常结算时生成唯一 `DeepProcessingTrigger`。 |
| Caller | 内部仿真编排器 |
| Authentication | Internal service token |
| Authorization | 仅内部仿真服务可调用 |
| Idempotency | yes，同一 `actionId + currentTick` 只允许产出一次触发器 |

#### 3.13.2 Request Body

| Field | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `state` | `object` | yes | `{...}` | 当前 `NpcLongActionState` |
| `currentTick` | `integer` | yes | `190` | 结算 tick |
| `eventIds` | `array[string]` | yes | `["evt-173","evt-178"]` | 对应 `recentEventIds` |
| `reflectionIds` | `array[string]` | yes | `["refl-88"]` | 对应 `recentReflectionIds` |
| `compressionIds` | `array[string]` | yes | `["cmp-31"]` | 对应 `recentCompressionIds` |

#### 3.13.3 Response Body

| Field | Type | Always present | Example | Description |
| --- | --- | --- | --- | --- |
| `statePatch` | `object` | yes | `{...}` | `LongActionStatePatch`，`nextStatus` 固定为 `resolved` |
| `deepProcessingTrigger` | `object` | yes | `{...}` | `DeepProcessingTrigger` |

#### 3.13.4 Status Codes and Business Errors

| Code | Condition | Response meaning |
| --- | --- | --- |
| `200` | 成功 | 返回结算补丁与触发器 |
| `400` | 输入缺字段 | 请求无效 |
| `404` | NPC 或 `actionId` 不存在 | 资源未找到 |
| `409` | 长动作已终态，或该 `actionId` 已生成过 trigger | 生命周期冲突 |
| `422` | 当前状态不允许结算 | 业务约束失败 |
| `500` | 内部结算失败 | 服务失败 |

#### 3.13.5 Notes

- 该接口只表达“正常结算并触发深处理”的门控结果；是否实际执行深处理由后续 `run_deep_processing` 承接。

### 3.14 `run_deep_processing`

#### 3.14.1 Basic Information

| Item | Content |
| --- | --- |
| API name | `run_deep_processing` |
| Method | `POST` |
| Path | `/internal/npcs/{npcId}/deep-processing/run` |
| Purpose | 对应 `runDeepProcessing`，在 `sleep_resolved` / `epiphany_resolved` 后执行一次深处理。 |
| Caller | 内部仿真编排器 |
| Authentication | Internal service token |
| Authorization | 仅内部仿真服务可调用 |
| Idempotency | yes，同一 `sourceLongActionId` 最多成功执行一次 |

#### 3.14.2 Request Body

| Field | Type | Required | Example | Description |
| --- | --- | --- | --- | --- |
| `context` | `object` | yes | `{...}` | `DeepProcessingContext` |
| `query` | `object` | yes | `{...}` | `DeepRetrievalQuery`；通常由 `buildDeepRetrievalQuery` 规则层构造 |

#### 3.14.3 Response Body

| Field | Type | Always present | Example | Description |
| --- | --- | --- | --- | --- |
| `deepProcessingResult` | `object` | yes | `{...}` | `DeepProcessingResult` |

#### 3.14.4 Status Codes and Business Errors

| Code | Condition | Response meaning |
| --- | --- | --- |
| `200` | 成功 | 返回深处理结果 |
| `400` | `context` / `query` 缺字段 | 请求无效 |
| `404` | NPC 或 `sourceLongActionId` 不存在 | 资源未找到 |
| `409` | 同一长动作已执行过深处理 | 幂等或并发冲突 |
| `422` | trigger 与 query 不一致，或包含不可写字段 | 业务校验失败 |
| `500` | 内部深处理失败 | 服务失败 |

#### 3.14.5 Notes

- 该接口是横向支撑接口，消费 `Reflect` / `Compress` / 长期记忆等既有结果，但不属于常规逐 tick 八阶段。
- 第一版只把 `runDeepProcessing` 透出为正式内部 API；`buildDeepRetrievalQuery`、`applyIdentityEvolutionPatch` 仍保留为服务内辅助函数。

## 4. Shared Resource Model Notes

- `NPCWorkingMemory`、`PerceivedItem`、`AppraisalResult`、`GoalArbitrationResult`、`ActionSelectionResult`、`ActionExecutionResult`、`ReflectionResult`、`CompressionResult` 等资源模型以 [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md) 为准。
- 长期记忆读取相关 query/result 以 [35-memory-retrieval-and-recall.md](C:/codex/project/AIWesternTown/doc/35-memory-retrieval-and-recall.md) 为准。
- 长动作与深处理相关资源模型 `NpcLongActionState`、`LongActionStatePatch`、`DeepProcessingTrigger`、`DeepProcessingContext`、`DeepRetrievalQuery`、`DeepProcessingResult`、`IdentityEvolutionSlice`、`IdentityEvolutionPatch`、`NextCyclePrimingPatch` 以 [41-sleep-and-epiphany-long-actions.md](C:/codex/project/AIWesternTown/doc/41-sleep-and-epiphany-long-actions.md) 为准。
- API 文档只规范接口边界，不重复定义所有嵌套字段的完整子结构。
- 请求与响应 payload 默认复用主文档中的 camelCase 资源字段名；若底层持久化使用 snake_case 数据库列名，应由服务内部完成映射，而不是泄露到 API 契约层。
- 所有内部接口都必须带 `X-Save-Id`，用于把请求绑定到单个存档或仿真实例上下文。
- 在“单存档单库”部署下，服务端可以把 `X-Save-Id` 映射到唯一运行态库、schema 或服务实例，因此底层运行态表不要求物理携带 `save_id` 列。
- 若后续演进为“多存档共库”，则需要把同一逻辑上下文继续下沉到存储键设计，把 `save_id` 或等价分区键纳入相关表的主键、唯一键与索引。
- 当动作属于物品系统九类动作之一时，`ActionCandidate`、`ActionSelectionResult`、`ActionExecutionResult` 应追加可选字段 `itemActionType`；该字段是兼容性追加字段，不替代既有 `actionType`。
- `long-actions/*` 与 `deep-processing/run` 属于横向编排接口：它们与九个常规认知接口共享同一内部认证、资源模型命名与错误格式，但不属于常规逐 tick 八阶段执行序列。

## 5. Common Error Response Format

| Field | Type | Description |
| --- | --- | --- |
| `code` | `string` | 机器可读错误码 |
| `message` | `string` | 人类可读错误说明 |
| `requestId` | `string` | 请求追踪 id |
| `details` | `object` | 可选的结构化错误细节 |

## 6. Compatibility and Versioning

- 第一版建议使用内部路径前缀 `/internal/`，不直接暴露给外部客户端。
- 版本策略建议先使用无版本路径 + 文档约束；若接口稳定后，可迁移至 `/internal/v1/`，To be confirmed。
- 资源模型字段应尽量追加而不是破坏性修改，避免编排器与阶段服务之间失配。
- 一旦某阶段接口上线，应与 [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md) 的函数签名同步维护。

## 7. Appendix

- 当前 API 设计偏向内部编排与调试接口，而非面向玩家或外部服务的开放 API。
- 若后续改为模块内函数调用而不是 HTTP，本文件仍可作为稳定契约源，再下沉为 SDK 或 service interface。
