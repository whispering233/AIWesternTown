# 长期记忆检索与回忆机制设计

## 1. 文档目标

本文档定义 `AIWesternTown` 项目中 NPC 长期记忆的读取侧机制，重点回答以下问题：

- NPC 在认知循环的哪些时机读取长期记忆
- 长期记忆读取由谁发起、如何限流、如何缓存
- 检索结果如何适配 `Perceive`、`Appraise`、`Reflect`
- 如何避免长期记忆读取过多、过脏、过贵

本文档是 [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md) 的横向支撑文档，服务于认知主链路中所有涉及长期记忆“读取”的阶段，但不直接回填阶段正文，待方案稳定后再统一回填。

## 2. 设计范围

### 2.1 本文档覆盖内容

本文档覆盖：

- `Cycle Prefetch`
- `Stage Retrieval`
- `TickMemoryReadContext`
- 阶段 query 构造
- 阶段结果适配
- 排序、去重、缓存和读取账本

### 2.2 本文档不覆盖内容

本文档不覆盖：

- 长期记忆写入与压缩
  - 由 [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md) 中 `Compress` 阶段负责
- 长期记忆 schema 的最终存储实现
  - 由后续存储层文档负责
- 关系图更新与 player model 的状态落地
  - 由后续 social belief 专题负责

## 3. 设计目标

长期记忆读取机制需要满足以下目标：

- 让 NPC 在合适时机“想起相关的旧事”，而不是全知或失忆
- 让不同认知阶段读取到适合自己的长期记忆切片
- 保持读取成本可控，避免每个阶段都扫全量长期记忆
- 保证同一 tick 内的读取有状态、可复用、可调试
- 为后续更复杂的向量检索或混合检索预留接口

## 4. 设计原则

- 读取与写入解耦，读取机制不负责长期记忆压缩与写入
- 第一版采用“混合读取”
  - 每轮一次轻量预取
  - 允许特定阶段按需追加检索
- 长期记忆读取不是自由访问，必须经过统一读取层
- 检索结果必须是小结果集、带理由、可裁剪
- 同一 tick 内必须避免无意义重复读取

## 5. 总体设计思路

### 5.1 混合读取模型

长期记忆读取采用两层设计：

1. `Cycle Prefetch`
   - 每轮认知循环开始时进行一次轻量预取
   - 提供“背景激活集”
2. `Stage Retrieval`
   - 在允许的阶段按需追加检索
   - 提供“被当前刺激或结果触发想起的记忆”

### 5.2 第一版阶段读取权限

第一版默认允许直接读取长期记忆的阶段：

- `Perceive`
- `Appraise`
- `Reflect`

第一版默认不允许直接读取长期记忆的阶段：

- `Update Working Memory`
- `Goal Arbitration`
- `Action Selection`
- `Act`

特殊情况：

- `Compress` 允许做“相似长期记忆检索”，但它属于写入侧去重，不属于认知读取

### 5.3 特殊读取请求方例外

在上述“阶段读取权限”之外，第一版额外允许一种不属于常规逐 tick 阶段的特殊读取请求方：

- `deep_process`
  - 仅用于 [41-sleep-and-epiphany-long-actions.md](C:/codex/project/AIWesternTown/doc/41-sleep-and-epiphany-long-actions.md) 定义的长动作结算深处理
  - 不属于 `Perceive / Appraise / Reflect` 任一常规阶段
  - 不复用 `TickMemoryReadContext`
  - 但复用同一套 `Memory Retrieval Engine` 与统一命中结构

因此，`deep_process` 是统一读取契约下的特殊 requester，而不是对常规阶段读取权限的扩张。

### 5.4 统一读取层

长期记忆读取不由每个阶段直接实现，而是拆成：

- `Memory Retrieval Engine`
- `Stage Query Builder`
- `Stage Result Adapter`
- `TickMemoryReadContext`

这样可以做到：

- 检索核心统一
- 阶段差异局部化
- 调试和回放可控

## 6. 读取时机设计

### 6.1 `Cycle Prefetch`

#### 6.1.1 设计目标

在每轮认知循环开始时，先激活一小组与当前场景、角色、近期焦点最相关的长期记忆。

#### 6.1.2 用途

- 提供当前轮的背景激活集
- 让 NPC 的认知看起来像“脑中本来浮着几件事”
- 降低后续阶段每次都从零检索的成本

#### 6.1.3 第一版约束

- 返回结果数建议 `2-3`
- 不追求覆盖所有相关长期记忆
- 以低成本规则召回为主

### 6.2 `Perceive` 读取

#### 6.2.1 设计目标

把当前刺激与少量相关旧记忆连接起来，用于形成注意偏置。

#### 6.2.2 读取特点

- 偏 cue-driven
- 快、小、低语义深度
- 适合 actor、关键词、tag 命中

### 6.3 `Appraise` 读取

#### 6.3.1 设计目标

为当前输入提供更具主观意义的背景，例如秘密风险、玩家模式和关系历史。

#### 6.3.2 读取特点

- 比 `Perceive` 更语义化
- 更依赖 goal、identity、social belief 相关命中
- 结果集仍需保持小规模

### 6.4 `Reflect` 读取

#### 6.4.1 设计目标

用于判断“这是不是重复模式”“这个人是否再次表现出同类行为”“这条策略是不是又失效了”。

#### 6.4.2 读取特点

- 允许最高比例的模式检索与语义相似
- 允许回看最近相关长期记忆和既有判断
- 不追求低延迟极限，但仍需限制结果规模

## 7. 读取侧组件设计

### 7.1 `Memory Retrieval Engine`

#### 7.1.1 设计目标

作为长期记忆读取的唯一统一入口。

#### 7.1.2 职责

- 接收标准化 query
- 执行候选召回
- 执行基础排序与裁剪
- 返回统一结构化检索结果

#### 7.1.3 非职责

- 不直接决定阶段如何消费结果
- 不负责 working memory 更新
- 不负责长期记忆写入
- 不要求所有 requester 都属于常规逐 tick 阶段

### 7.2 `Stage Query Builder`

每个允许读取的阶段都有各自的 query builder：

- `PerceiveQueryBuilder`
- `AppraiseQueryBuilder`
- `ReflectQueryBuilder`

其职责是：

- 把阶段上下文转换成标准化 `MemoryRetrievalQuery`
- 决定该阶段允许检索的 memory kind
- 决定返回上限和 cue 结构

`deep_process` 不属于 `Stage Query Builder` 覆盖范围；它作为长动作结算时的特殊 requester，可单独构造 query，但仍进入同一个 `Memory Retrieval Engine`。

### 7.3 `Stage Result Adapter`

统一检索结果不会直接暴露给阶段，而是经过阶段适配。

适配目标：

- `RetrievedMemorySlice`
- `RetrievedBeliefSlice`
- `ReflectionRetrievedMemorySlice`

这样可以保证：

- 阶段只看到自己该看到的结构
- 不同阶段之间不会共享一套脏字段

## 8. 读取侧状态管理

### 8.1 `TickMemoryReadContext`

#### 8.1.1 设计目标

为单个 tick 内的长期记忆读取提供统一上下文。

#### 8.1.2 生命周期

- 创建于 `tick_start`
- 销毁于 `tick_end`
- 仅服务于 `cycle_prefetch / perceive / appraise / reflect`

#### 8.1.3 核心作用

- 承接预取结果
- 承接阶段检索缓存
- 记录本 tick 内长期记忆命中历史

### 8.2 `PrefetchBuffer`

用于存放 `Cycle Prefetch` 结果。

特点：

- 小规模
- 全轮可读
- 作为各阶段读取的第一优先级背景池

### 8.3 `StageRetrievalCache`

用于缓存同一 tick 内的阶段检索结果。

设计目标：

- 避免相同 query 重复查库
- 让 `Perceive` 和 `Appraise` 能复用本轮已有命中

### 8.4 `RetrievalLedger`

用于记录：

- 哪条长期记忆被哪个阶段命中过
- 是否已升级为更高优先级命中
- 是否已经成为 working memory 的来源

它的作用是：

- 避免同一记忆在单轮内反复污染多个阶段
- 为调试提供命中轨迹

## 9. 输入结构

### 9.1 `MemoryRetrievalQuery`

```ts
type MemoryRetrievalQuery = {
  requester: "cycle_prefetch" | "perceive" | "appraise" | "reflect" | "deep_process";
  npcId: string;
  tick: number;
  sceneId?: string;
  actorIds?: string[];
  goalIds?: string[];
  eventIds?: string[];
  cueTexts: string[];
  memoryKinds?: ("episodic" | "social" | "player_model" | "clue")[];
  tags?: string[];
  recencyWindow?: number;
  maxResults: number;
};
```

字段说明：

- `requester`
  - 发起读取的请求方
  - 常规逐 tick requester 为 `cycle_prefetch / perceive / appraise / reflect`
  - `deep_process` 为长动作结算深处理专用 requester，不进入常规阶段权限与 `TickMemoryReadContext`
- `cueTexts`
  - 当前要“想起什么”的语义线索
- `memoryKinds`
  - 当前阶段允许检索的长期记忆类别
- `maxResults`
  - 强制限流上限

### 9.2 `TickMemoryReadContext`

```ts
type TickMemoryReadContext = {
  tick: number;
  npcId: string;
  prefetchedHits: RetrievedMemoryHit[];
  stageCache: StageRetrievalCacheEntry[];
  ledger: RetrievalLedgerEntry[];
};
```

说明：

- `prefetchedHits` 始终保存完整的 `RetrievedMemoryHit[]`
- 若外部接口或编排器使用 `readContextPatch` 承接预取结果，则其 `prefetchedHits` 数据形状必须与这里一致，表示“写入 `TickMemoryReadContext.prefetchedHits` 的完整命中对象增量”，而不是仅传 `memoryId[]`
- `readContextPatch` 是否由服务端直接返回，还是由编排器根据 `MemoryRetrievalResult.hits` 本地构造，仍保持开放

### 9.3 `StageRetrievalCacheEntry`

```ts
type StageRetrievalCacheEntry = {
  stage: "perceive" | "appraise" | "reflect";
  queryFingerprint: string;
  result: MemoryRetrievalResult;
};
```

### 9.4 `RetrievalLedgerEntry`

```ts
type RetrievalLedgerEntry = {
  memoryId: string;
  firstHitStage: "cycle_prefetch" | "perceive" | "appraise" | "reflect";
  hitCountInTick: number;
  promotedToWorkingMemory: boolean;
  consumedByStages: ("perceive" | "appraise" | "reflect")[];
};
```

说明：

- `RetrievalLedgerEntry` 只记录常规逐 tick 读取命中轨迹
- `deep_process` 不写入该 ledger，因为它不属于单 tick 阶段读取

### 9.5 `RetrievedMemoryHit`

```ts
type RetrievedMemoryHit = {
  memoryId: string;
  kind: "episodic" | "social" | "player_model" | "clue";
  summary: string;
  importance: number;
  confidence: number;
  relatedActorIds: string[];
  sourceEventIds: string[];
  tags: string[];
  retrievalReasonTags: string[];
  score: number;
};
```

### 9.6 `MemoryRetrievalResult`

```ts
type MemoryRetrievalResult = {
  requester: MemoryRetrievalQuery["requester"];
  hits: RetrievedMemoryHit[];
};
```

### 9.7 `LongTermMemoryStoreSlice`

```ts
type LongTermMemoryStoreSlice = {
  memoryItems: LongTermMemoryItem[];
};
```

### 9.8 `LongTermMemoryItem`

```ts
type LongTermMemoryItem = {
  memoryId: string;
  kind: "episodic" | "social" | "player_model" | "clue";
  summary: string;
  importance: number;
  confidence: number;
  sourceEventIds: string[];
  relatedActorIds: string[];
  tags: string[];
  reinforcementCount: number;
  firstStoredAt: number;
  lastReinforcedAt: number;
};
```

说明：

- 本定义与 [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md) 中 `Compress` 阶段保持一致
- 第一版不在本文件内再次扩展长期记忆写入字段，避免读取侧与写入侧 schema 漂移

## 10. 阶段适配输出结构

### 10.1 `RetrievedMemorySlice`

```ts
type RetrievedMemorySlice = {
  memoryItems: RetrievedMemoryHit[];
};
```

### 10.2 `RetrievedBeliefSlice`

```ts
type RetrievedBeliefSlice = {
  beliefs: RetrievedMemoryHit[];
};
```

### 10.3 `ReflectionRetrievedMemorySlice`

```ts
type ReflectionRetrievedMemorySlice = {
  patterns: RetrievedMemoryHit[];
};
```

### 10.4 与主认知文档的兼容映射

为避免当前支撑文档与主认知文档命名漂移，第一版兼容关系固定如下：

- 本文 `RetrievedMemorySlice`
  - 对应 [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md) 中 `Perceive` 的 `RetrievedMemorySlice`
- 本文 `RetrievedBeliefSlice`
  - 对应 [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md) 中 `Appraise` 的 `RetrievedBeliefSlice`
- 本文 `ReflectionRetrievedMemorySlice`
  - 只负责填充主文档 `ReflectionBeliefSlice.retrievedMemories`
  - 不负责提供 `ReflectionBeliefSlice.actorBeliefs`

这意味着：

- `Reflect` 的输入仍然是主文档定义的 `ReflectionBeliefSlice`
- 长期记忆读取机制只是其中 `retrievedMemories` 子字段的来源之一

## 11. 命中与排序规则

### 11.1 两段式读取

第一版读取分两段：

1. `Candidate Recall`
   - 先用轻量信号召回一小批候选
2. `Stage Re-rank`
   - 再按阶段需求重排并裁剪为最终结果

### 11.2 基础召回信号

召回阶段优先考虑：

- `actorIds` 命中
- `goalIds` 命中
- `tags` 命中
- `sceneId` 或场景语境命中
- `retrievalHint` 的关键词或短语命中

### 11.3 统一基础打分

建议第一版基础打分公式：

```text
retrieval_score =
  cue_match * 0.25 +
  actor_match * 0.20 +
  goal_match * 0.15 +
  kind_fit * 0.10 +
  importance * 0.10 +
  confidence * 0.08 +
  recency_signal * 0.05 +
  reinforcement_signal * 0.04 +
  stage_bonus * 0.03
```

### 11.4 阶段重排偏好

#### 11.4.1 `Perceive`

强调：

- `actor_match`
- `cue_match`
- 近期强化信号

弱化：

- 高抽象语义相似

#### 11.4.2 `Appraise`

强调：

- `goal_match`
- `kind_fit`
- `confidence`

优先记忆类型：

- `social`
- `player_model`
- `clue`

#### 11.4.3 `Reflect`

强调：

- 模式重复
- 语义相似
- `importance`
- `reinforcement_signal`

## 12. `retrievalSummary` 与记忆正文的分工

### 12.1 `retrievalSummary` 的职责

`retrievalSummary` 是读取索引层，主要用于：

- 快速召回
- tag 命中
- retrieval hint 命中
- 低成本预取

它不承担完整事实表达。

### 12.2 `LongTermMemoryItem.summary` 的职责

`LongTermMemoryItem.summary` 是长期存储正文，主要用于：

- 重排
- 合并判断
- 返回给上游阶段消费

### 12.3 推荐读取路径

第一版推荐：

- 先用 `retrievalSummary` 做轻量召回
- 再用 `LongTermMemoryItem.summary` 做候选重排

## 13. 读取流程设计

### 13.1 `tick_start`

```text
tick_start
-> build_prefetch_query()
-> prefetchMemories()
-> write TickMemoryReadContext.prefetchedHits
```

### 13.2 `Perceive`

```text
perceive
-> read prefetchedHits
-> if not enough, build_perceive_query()
-> retrieveMemoriesForStage()
-> adaptRetrievalForPerceive()
```

### 13.3 `Appraise`

```text
appraise
-> read prefetchedHits
-> read stageCache
-> if not enough, build_appraise_query()
-> retrieveMemoriesForStage()
-> adaptRetrievalForAppraise()
```

### 13.4 `Reflect`

```text
reflect
-> read prefetchedHits
-> read stageCache
-> if needed, build_reflect_query()
-> retrieveMemoriesForStage()
-> adaptRetrievalForReflect()
-> write ReflectionBeliefSlice.retrievedMemories
```

## 14. 接口设计

### 14.1 预取接口

```ts
function prefetchMemories(
  query: MemoryRetrievalQuery,
  memoryStore: LongTermMemoryStoreSlice
): MemoryRetrievalResult
```

### 14.2 阶段检索接口

```ts
function retrieveMemoriesForStage(
  query: MemoryRetrievalQuery,
  readContext: TickMemoryReadContext,
  memoryStore: LongTermMemoryStoreSlice
): MemoryRetrievalResult
```

说明：

- 本接口仅服务常规逐 tick 阶段读取
- `deep_process` 虽复用 `MemoryRetrievalQuery` 与统一检索引擎，但不通过该接口进入 `TickMemoryReadContext`

### 14.3 阶段适配接口

```ts
function adaptRetrievalForPerceive(
  result: MemoryRetrievalResult
): RetrievedMemorySlice
```

```ts
function adaptRetrievalForAppraise(
  result: MemoryRetrievalResult
): RetrievedBeliefSlice
```

```ts
function adaptRetrievalForReflect(
  result: MemoryRetrievalResult
): ReflectionRetrievedMemorySlice
```

## 15. 设计规格和约束

### 15.1 结果上限约束

第一版建议：

- `Cycle Prefetch`：`2-3`
- `Perceive`：`3-5`
- `Appraise`：`2-4`
- `Reflect`：`4-6`

### 15.2 重复读取约束

第一版必须满足：

- 同一 `queryFingerprint + stage` 在同一 tick 内只实际查库一次
- 同一 `memoryId` 在同一 tick 内不应被多个阶段无意义重复召回
- 若同一条记忆已升级为 working memory 来源，本 tick 默认不再重复返回

### 15.3 `queryFingerprint` 约束

第一版推荐：

```text
fingerprint =
  requester
  + sceneId
  + sorted(actorIds)
  + sorted(goalIds)
  + sorted(tags)
  + normalized(cueTexts)
```

### 15.4 升级命中约束

允许同一条记忆在不同阶段被“升级使用”，但不允许被重复当作新命中。

推荐结构：

```ts
type RetrievalPromotion = {
  memoryId: string;
  fromStage: "perceive" | "appraise";
  toStage: "appraise" | "reflect";
  reason: "goal_relevance_upgrade" | "pattern_detected" | "social_risk_upgrade";
};
```

### 15.5 语义检索占比约束

第一版不应让语义相似主导所有阶段。

推荐：

- `Cycle Prefetch`
  - 低语义、高规则召回
- `Perceive`
  - actor/tag/关键词优先
- `Appraise`
  - 规则命中 + 少量语义相似
- `Reflect`
  - 允许最高比例的语义相似和模式检索

## 16. 与认知主链路的交互边界

### 16.1 上游边界

长期记忆读取机制读取：

- 长期记忆存储切片
- 压缩阶段生成的 `retrievalSummary`
- 当前 tick 的读取上下文
- 阶段自己的 query

### 16.2 下游边界

长期记忆读取机制只输出：

- 结构化检索结果
- 阶段适配后的读取切片
- 本 tick 的读取状态更新

它不直接：

- 写长期记忆
- 改 working memory
- 改 relationship graph
- 产出动作或目标

## 17. 与 LLM 的交互边界

### 17.1 第一版规则层负责

- query 构造
- 候选召回
- 基础排序
- 去重与裁剪
- 缓存与 ledger 管理

### 17.2 第一版 LLM 适合负责

- 复杂 cue 文本的语义扩展
- 少量中等复杂度记忆相似性的补充判断
- 复杂 `retrievalReasonTags` 的摘要化解释

### 17.3 第一版推荐模式

```text
rule_recall_candidates -> stage_rerank -> optional_semantic_refine -> adapted_stage_slice
```

## 18. 调试要求

调试视图至少展示：

- 当前 tick 的 `prefetchedHits`
- 每个阶段的 query
- query fingerprint
- cache hit / miss
- ledger 中的命中轨迹
- 最终返回结果与 `retrievalReasonTags`
- 被裁剪掉的候选及原因

## 19. 示例

场景：玩家在酒馆再次公开提起“昨晚的事”，医生进入新一轮认知循环。

### 19.1 `Cycle Prefetch`

输入线索：

- 当前 scene = `saloon`
- 当前 active concerns = 秘密风险、玩家试探

预取结果：

- 玩家会公开施压的 player model 记忆
- 上一轮酒馆公开回避成功的 episodic 记忆

### 19.2 `Perceive` 读取

输入 cue：

- `actorIds = ["player"]`
- `cueTexts = ["昨晚", "公开追问"]`

返回：

- 命中一条玩家公开施压模式记忆
- 命中理由：`actor_match`, `tag_match`, `repeat_pattern`

### 19.3 `Appraise` 读取

输入 cue：

- `goalIds = ["goal-hide-injury-truth"]`
- `cueTexts = ["秘密暴露风险", "玩家施压"]`

返回：

- 命中一条 player model
- 命中一条 social / clue 相关记忆
- 命中理由：`goal_match`, `secret_related`, `player_model_match`

### 19.4 `Reflect` 读取

输入 cue：

- 当前执行结果是“公开回避成功但风险未解除”

返回：

- 命中一条类似场景下的策略经验记忆
- 命中一条玩家模式重复记忆

## 20. 待处理的问题

- `retrievalSummary` 是否要拆成关键词索引和自然语言 hint 两层
- 长期记忆存储层是否需要显式 recency/decay 字段供读取排序使用
- 第一版是否引入向量检索，还是仅用规则+标签+轻语义重排
- `Reflect` 阶段的模式检索是否要单独设计更强的 query schema
- 稳定后如何回填 [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md)
