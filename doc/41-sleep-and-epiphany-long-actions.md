# 睡眠与顿悟长动作设计

## 1. 设计目标

本文档作为 [40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md) 的横向支撑文档，负责展开以下问题：

1. 当 NPC 进入 `睡眠 / 顿悟` 这类内部长动作时，世界如何继续推进
2. 长动作如何被调度、保持、打断和结算
3. 何时触发长期记忆的深度检索与整合
4. 何时允许发生有限的身份演化更新
5. 深度处理如何与现有 `Reflect / Compress / retrievalSummary` 机制对齐，而不污染基础身份档案

本文档不负责：

- 通用 `worldTick` 推进规则
- 普通前台 / 近场 / 远场调度规则
- 常规 `Perceive / Appraise / Reflect` 的逐 tick 读取侧机制
- 基础身份档案 schema 的重定义

这些内容分别由以下文档承接：

- [40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md)
- [35-memory-retrieval-and-recall.md](C:/codex/project/AIWesternTown/doc/35-memory-retrieval-and-recall.md)
- [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md)
- [37-npc-cognition-db-design.md](C:/codex/project/AIWesternTown/doc/37-npc-cognition-db-design.md)

## 2. 设计原则

### 2.1 睡眠 / 顿悟属于 NPC 内部长动作

第一版中，`睡眠` 和 `顿悟` 不作为新的全局世界模式存在，而作为单个 NPC 的 `long_action` 存在。

### 2.2 世界继续推进，长动作不冻结世界

当 NPC 进入 `睡眠 / 顿悟` 时，世界仍按 [40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md) 的既定规则继续推进。长动作只改变该 NPC 的可调度性，不改变全局时钟。

### 2.3 只在正常结算时触发深度处理

深度处理不是长动作进行中的后台持续任务。只有当 `睡眠 / 顿悟` 长动作正常 `resolved` 时，才允许触发一次深度检索与身份演化处理。

### 2.4 被打断则整次深处理任务丢弃

若长动作在 `holding` 期间被外部事件打断，则该长动作进入 `aborted`，整次深处理任务直接作废，不保留半成品推理结果，不做部分回写。

### 2.5 允许有限身份演化，不允许改写基础身份档案

深度处理允许更新“有限身份演化层”，例如：

- 当前自我叙事
- 活跃身份张力
- 阶段性偏移标签

但不得直接改写：

- 公开人设
- 秘密集合
- 核心驱动力
- 基础长期目标定义

### 2.6 深处理必须建立在已发生事实之上

深度处理只能消费：

- 近期结构化事件
- 近期反思结果
- 近期压缩结果
- 已存在长期记忆

不得创造未发生的世界事实，也不得用自由文本反向定义过去发生过什么。

## 3. 设计思路

### 3.1 方案比较

第一版可选方案有三类：

1. `长动作结算式`
   - 睡眠 / 顿悟作为可中断长动作存在
   - 只有正常结算时触发一次深处理
2. `后台异步整合式`
   - 长动作只打标记，深处理由后台异步任务完成
3. `渐进式插帧整合`
   - 长动作持续期间分多次做部分深处理

第一版采用 `长动作结算式`，原因如下：

- 与现有 `场景泡泡式分层调度` 最容易对齐
- 最容易实现“被打断则整次任务丢弃”
- 最容易做回放和调试，不会出现半完成状态

### 3.2 核心机制拆分

本设计把该机制拆成四个清晰单元：

1. `Long Action Lifecycle`
   - 负责进入、保持、打断、结算
2. `Deep Processing Trigger Gate`
   - 负责判断是否允许从 `resolved` 进入深处理
3. `Deep Retrieval & Integration`
   - 负责深层长期记忆与身份线索检索
4. `Identity Evolution Apply`
   - 负责把结果写到有限身份演化层和检索侧摘要

### 3.3 睡眠与顿悟的共同点和区别

两者共享同一套生命周期与深处理框架，但默认触发条件和读取重点不同：

- `sleep`
  - 偏休整、沉淀、延后整合
  - 更偏向近期事件压缩、关系回看和自我叙事稳定
- `epiphany`
  - 偏高压后模式突破、自我解释重组、立场再定位
  - 更偏向身份张力提升、策略模式重估和关键记忆重排

第一版不单独拆两套引擎，只通过 `actionKind` 和 query 偏好区分。

### 3.4 有限身份演化层的定位

为避免污染基础身份档案，本设计新增 `Identity Evolution Layer`，作为稳定身份和工作记忆之间的中层。

它表达的不是“这个角色本质上是谁”，而是：

- 这个角色最近如何理解自己
- 他最近被哪些身份张力困住
- 哪些内在叙事会更容易在后续检索中被命中

## 4. 输入结构

### 4.1 长动作状态输入

```ts
type NpcLongActionState = {
  actionId: string;
  npcId: string;
  actionKind: "sleep" | "epiphany";
  status: "entered" | "holding" | "resolved" | "aborted";
  enteredAtTick: number;
  expectedResolveAtTick?: number;
  sourceTriggerTags: string[];
  boundSceneId?: string;
  abortReasonTags: string[];
};
```

字段说明：

- `actionKind`
  - `sleep`：自然休眠、休整、沉淀
  - `epiphany`：顿悟、策略重组、自我解释突变
- `status`
  - `entered`：刚进入长动作
  - `holding`：长动作持续中
  - `resolved`：正常完成，允许深处理
  - `aborted`：被打断，不允许深处理

### 4.2 深处理触发输入

```ts
type DeepProcessingTrigger = {
  npcId: string;
  sourceLongActionId: string;
  triggerKind: "sleep_resolved" | "epiphany_resolved";
  triggerTick: number;
  recentEventIds: string[];
  recentReflectionIds: string[];
  recentCompressionIds: string[];
};
```

约束：

- 只有 `resolved` 的长动作能生成 `DeepProcessingTrigger`
- 同一个 `sourceLongActionId` 只能触发一次
- `aborted` 的长动作不得产生 trigger

### 4.3 深处理上下文输入

```ts
type DeepProcessingContext = {
  npcId: string;
  trigger: DeepProcessingTrigger;
  identityBase: NpcIdentityBaseSlice;
  identityEvolution?: IdentityEvolutionSlice;
  recentLongTermMemories: LongTermMemoryStoreSlice;
  recentEventWindow: WorldEventWindow;
  recentReflections: ReflectionResult[];
  recentCompressions: CompressionResult[];
};
```

### 4.4 基础身份切片输入

```ts
type NpcIdentityBaseSlice = {
  npcId: string;
  publicPersona: string;
  hiddenSecrets: string[];
  taboos: string[];
  coreDrives: string[];
  stableGoalIds: string[];
};
```

说明：

- 本结构在深处理中为只读输入
- 深处理不得直接返回对这些字段的覆盖写入

### 4.5 身份演化层输入

```ts
type IdentityEvolutionSlice = {
  npcId: string;
  currentSelfNarrative?: string;
  activeIdentityTensions: IdentityTensionItem[];
  reinforcedDriftTags: string[];
  lastDeepProcessedAtTick?: number;
};
```

```ts
type IdentityTensionItem = {
  tensionId: string;
  kind: "loyalty" | "self_image" | "fear" | "obsession" | "attachment" | "moral_strain";
  summary: string;
  targetActorIds: string[];
  intensity: number;
  direction: "rising" | "stable" | "fading";
  introducedAtTick: number;
  lastUpdatedAtTick: number;
};
```

### 4.6 深检索查询输入

```ts
type DeepRetrievalQuery = {
  requester: "deep_process";
  npcId: string;
  sourceLongActionId: string;
  triggerKind: DeepProcessingTrigger["triggerKind"];
  triggerTick: number;
  recentEventIds: string[];
  cueTexts: string[];
  memoryKinds: ("episodic" | "social" | "player_model" | "clue")[];
  identityTensionKinds: IdentityTensionItem["kind"][];
  maxMemoryResults: number;
  maxTensionResults: number;
};
```

### 4.7 深处理读取上下文

```ts
type DeepProcessingReadContext = {
  sourceLongActionId: string;
  npcId: string;
  triggerTick: number;
  memoryHits: RetrievedMemoryHit[];
  identityHits: IdentityTensionItem[];
};
```

设计说明：

- 不复用 `TickMemoryReadContext`
- 因为深处理不是常规逐 tick 认知阶段的一部分
- 但仍应复用统一检索引擎和命中结构

## 5. 输出结构

### 5.1 长动作状态补丁输出

```ts
type LongActionStatePatch = {
  actionId: string;
  npcId: string;
  nextStatus: "holding" | "resolved" | "aborted";
  appliedAtTick: number;
  abortReasonTags: string[];
};
```

### 5.2 深处理主输出

```ts
type DeepProcessingResult = {
  deepProcessId: string;
  npcId: string;
  sourceLongActionId: string;
  outcome: "applied" | "skipped";
  createdMemories: LongTermMemoryWrite[];
  mergedMemories: LongTermMemoryMerge[];
  reinforcedMemories: LongTermMemoryReinforcement[];
  retrievalSummaryWrites: RetrievalSummaryItem[];
  identityEvolutionPatch?: IdentityEvolutionPatch;
  nextCyclePriming?: NextCyclePrimingPatch;
  processingSummary: string;
};
```

### 5.3 身份演化补丁输出

```ts
type IdentityEvolutionPatch = {
  currentSelfNarrative?: string;
  addedTensions: IdentityTensionItem[];
  updatedTensions: {
    tensionId: string;
    intensity: number;
    direction: "rising" | "stable" | "fading";
    summary?: string;
  }[];
  clearedTensionIds: string[];
  reinforcedDriftTags: string[];
  appliedAtTick: number;
};
```

### 5.4 下一轮激活补丁输出

```ts
type NextCyclePrimingPatch = {
  npcId: string;
  primingTags: string[];
  suggestedConcernSeeds: string[];
  validUntilTick: number;
};
```

设计说明：

- 深处理不直接改 working memory
- 但允许为下一轮 `Cycle Prefetch` 提供少量激活提示
- 这样深处理结果能在之后被“想起”，而不是立即粗暴改写短时焦点

### 5.5 中断丢弃输出

```ts
type DeepProcessingAbortResult = {
  npcId: string;
  sourceLongActionId: string;
  outcome: "discarded";
  reasonTags: string[];
};
```

## 6. 处理流程

### 6.1 长动作进入

当 NPC 满足进入条件时，规则层创建 `NpcLongActionState`：

- `status = entered`
- 记录 `actionKind`
- 记录 `enteredAtTick`
- 写入 `sourceTriggerTags`

建议进入条件：

- 当前不在前台高压冲突中
- 当前不存在未完成的同类长动作
- 当前 availability 允许短时退出显性竞争

### 6.2 长动作保持期间的世界推进

当长动作进入 `holding` 后，世界继续按既有调度规则推进。

该 NPC 在保持期间的默认行为：

- 不参与普通前台完整链路竞争
- 仅以“被动存在”或“暂不可用”状态被世界看到
- 不主动触发新的显性社交动作

实现建议：

- 将其 `availability` 标记为 `busy`
- 将其调度优先级降到低位
- 允许外部高优先级事件直接把它拉出长动作

### 6.3 长动作打断

当外部事件命中打断条件时：

1. 当前长动作状态改为 `aborted`
2. 记录 `abortReasonTags`
3. 不生成 `DeepProcessingTrigger`
4. 若后续仍要进入睡眠/顿悟，必须重新创建新的长动作

建议打断条件包括：

- 当前场景出现强打断事件
- 与该 NPC 直接相关的高热冲突把它拉回前台
- 该 NPC 当前可用性被外部规则强制改变

### 6.4 长动作正常结算

当长动作达到正常完成条件时：

1. 当前长动作状态改为 `resolved`
2. 创建唯一的 `DeepProcessingTrigger`
3. 立即进入一次深处理

第一版建议：

- 深处理在结算当拍同步完成
- 不拆成后台异步任务
- 不保留跨拍半成品

### 6.5 深处理查询构造

深处理开始后，规则层构造 `DeepRetrievalQuery`。

建议输入线索来源：

- 最近高重要度事件摘要
- 最近高显著反思摘要
- 最近压缩后新增或强化的记忆主题
- 当前身份演化层中的张力项目
- 长动作类型自身的偏好标签

其中：

- `sleep` 更偏向近期关系、未解冲突、重复策略结果
- `epiphany` 更偏向身份张力、关键模式突破、自我叙事重组

### 6.6 深层长期记忆与身份线索检索

深处理阶段执行两类读取：

1. `Long-term memory deep retrieval`
   - 从长期记忆中召回与近期模式和身份张力最相关的记忆
2. `Identity tension retrieval`
   - 从有限身份演化层中召回当前最活跃的身份张力

第一版推荐上限：

- 长期记忆命中 `4-8`
- 身份张力命中 `2-4`

### 6.7 深整合与洞察生成

在检索结果基础上，系统生成一组有限的 `DeepInsight`，用于后续写回。

```ts
type DeepInsight = {
  insightId: string;
  kind: "memory_pattern" | "self_narrative_shift" | "tension_reinforcement" | "tension_resolution";
  summary: string;
  evidenceEventIds: string[];
  evidenceMemoryIds: string[];
  confidence: number;
  importance: number;
};
```

这些洞察不是世界事实，而是基于已发生事实做出的内部整合结果。

### 6.8 写回长期记忆与检索摘要

深处理可将 `DeepInsight` 映射为：

- 新增长期记忆
- 合并已有长期记忆
- 强化已有长期记忆
- 更新对应的 `retrievalSummary`

这一步必须遵守 [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md) 中 `Compress` 的写入边界：

- 不创造新事实
- 不直接改写 working memory
- 不直接改写世界状态

### 6.9 写回身份演化层

在长期记忆写回之后，深处理可生成一次 `IdentityEvolutionPatch`。

它允许：

- 更新 `currentSelfNarrative`
- 新增 / 强化 / 消退身份张力
- 增减 `reinforcedDriftTags`

它不允许：

- 改写基础身份档案
- 直接增删秘密
- 直接替换核心驱动力

### 6.10 生成下一轮激活提示

若深处理结果具有明确后续影响，可额外生成 `NextCyclePrimingPatch`。

该补丁的作用是：

- 让下一轮 `Cycle Prefetch` 更容易命中刚整合出的关键主题
- 让长动作后的 NPC 表现出“醒来后确实带着新念头”

### 6.11 结束与清理

处理结束后：

- `resolved` 长动作可从活跃长动作表中移除
- `aborted` 长动作只保留必要日志
- 本轮深处理上下文销毁，不跨任务保留

## 7. 设计规格和约束

### 7.1 生命周期约束

- 单个 NPC 同时最多只能有 `1` 个活跃内部长动作
- 同一个长动作只能经历一次 `resolved` 或 `aborted`
- `resolved` 与 `aborted` 互斥

### 7.2 打断约束

- 长动作默认可中断
- 一旦被打断，整次深处理任务直接丢弃
- 不允许“部分执行、部分回写”

### 7.3 深处理触发约束

- 只有 `sleep / epiphany` 的正常结算才允许触发
- 不允许由普通 tick 尾部随意触发
- 不允许通过调试接口直接伪造触发结果

### 7.4 深处理写回边界

深处理允许写回：

- 长期记忆项
- 检索摘要
- 有限身份演化层
- 下一轮激活提示

深处理不得直接写回：

- 世界事实
- 公开事件日志真相
- 基础身份档案
- 工作记忆正文
- 社交信念正文

### 7.5 一致性约束

- `IdentityEvolutionPatch` 和 `retrievalSummaryWrites` 必须基于同一组 `DeepInsight`
- 不允许出现“身份层已改，但长期记忆未留下依据”的回写
- 若写回过程失败，整次深处理建议事务性回滚

### 7.6 预算约束

第一版建议：

- 每次长动作结算只允许一次深处理
- 深处理总检索结果数不超过 `12`
- 深处理生成的长期记忆新增条目建议不超过 `2`
- 单次身份张力更新条目建议不超过 `3`

### 7.7 可见性约束

- 深处理默认不是玩家即时可见事件
- 玩家只能在后续 NPC 行为、态度和局势变化中间接感受到其结果
- 需要调试视图时，深处理日志只在开发者视图公开

### 7.8 与睡眠 / 顿悟表现文本的分离

- “NPC 似乎睡得不安稳”“他像是忽然想通了什么”这类文本不构成事实来源
- 真正权威的结果仍是：
  - 长动作状态
  - 深处理结果
  - 长期记忆写入
  - 身份演化补丁

## 8. 与 LLM 的交互边界

### 8.1 第一版规则层负责

- 长动作进入、保持、打断和结算判定
- 深处理触发门控
- 深检索查询构造
- 可写字段白名单控制
- 深处理预算与结果上限控制

### 8.2 第一版 LLM 可参与

- 基于检索结果生成有限 `DeepInsight` 摘要
- 生成 `currentSelfNarrative` 的自然语言版本
- 生成身份张力摘要文案
- 对检索摘要做自然语言提炼

### 8.3 第一版 LLM 不得直接决定

- 长动作是否被打断
- 打断后是否保留半成品
- 是否允许写基础身份档案
- 哪些世界事实被视为真实发生
- 哪些字段可以被写回

### 8.4 推荐交互模式

```text
resolve_long_action
-> build_deep_query
-> retrieve_memories_and_tensions
-> optional_llm_integrate
-> rule_validate_writable_fields
-> apply_memory_and_identity_patches
```

## 9. 与上下游认知阶段的交互边界

### 9.1 上游边界

本设计读取：

- 长动作状态
- 最近事件窗口
- 最近 `Reflect` 结果
- 最近 `Compress` 结果
- 长期记忆库
- 身份演化层

本设计不直接重跑完整常规认知链。

### 9.2 与常规长期记忆读取机制的边界

本设计不复用 [35-memory-retrieval-and-recall.md](C:/codex/project/AIWesternTown/doc/35-memory-retrieval-and-recall.md) 中的 `TickMemoryReadContext`，但应复用其统一检索引擎和命中结构。

这意味着：

- `deep_process` 是独立于常规 `perceive/appraise/reflect` 的特殊读取请求方
- 它不是普通逐 tick 认知读取的一部分
- 它只在长动作结算时出现

### 9.3 与 `Reflect / Compress` 的边界

- 常规 `Reflect` 负责解释“刚刚发生的事”
- 常规 `Compress` 负责决定“哪些意义值得留下”
- 本设计中的深处理负责在长动作结算时，对一段时间内的近期结果做更高层整合

深处理不是普通 `Reflect` 的直接替代，而是对其结果的再整编。

### 9.4 对下一轮认知的影响边界

深处理不会直接强写当前工作记忆，但可以通过：

- 长期记忆新增 / 强化
- 身份演化层更新
- `NextCyclePrimingPatch`

间接影响下一轮：

- `Cycle Prefetch`
- `Appraise`
- `Reflect`

## 10. 透出的接口设计

### 10.1 长动作生命周期接口

```ts
function enterInternalLongAction(
  npcId: string,
  kind: "sleep" | "epiphany",
  tick: number,
  triggerTags: string[]
): NpcLongActionState
```

```ts
function advanceInternalLongAction(
  state: NpcLongActionState,
  currentTick: number
): LongActionStatePatch
```

```ts
function abortInternalLongAction(
  state: NpcLongActionState,
  currentTick: number,
  reasonTags: string[]
): LongActionStatePatch
```

```ts
function resolveInternalLongAction(
  state: NpcLongActionState,
  currentTick: number,
  eventIds: string[],
  reflectionIds: string[],
  compressionIds: string[]
): DeepProcessingTrigger
```

### 10.2 深处理接口

```ts
function runDeepProcessing(
  context: DeepProcessingContext,
  query: DeepRetrievalQuery
): DeepProcessingResult
```

```ts
function buildDeepRetrievalQuery(
  context: DeepProcessingContext
): DeepRetrievalQuery
```

```ts
function applyIdentityEvolutionPatch(
  current: IdentityEvolutionSlice | undefined,
  patch: IdentityEvolutionPatch
): IdentityEvolutionSlice
```

## 11. 调试要求

调试视图至少展示：

### 11.1 长动作生命周期

- 当前活跃长动作列表
- 每个长动作的 `entered/holding/resolved/aborted` 状态
- 打断原因

### 11.2 深处理触发门控

- 哪些长动作具备结算资格
- 为什么某次 `resolved` 触发了深处理
- 为什么某次 `aborted` 被直接丢弃

### 11.3 深检索命中

- `DeepRetrievalQuery`
- 命中的长期记忆
- 命中的身份张力
- 被裁掉的候选

### 11.4 深整合结果

- 生成的 `DeepInsight`
- 每条 insight 的 evidence 来源
- 通过或被拒绝的写回项

### 11.5 回写结果

- 新增 / 合并 / 强化的长期记忆
- 更新后的 `retrievalSummary`
- `IdentityEvolutionPatch`
- `NextCyclePrimingPatch`

### 11.6 丢弃路径

- 哪些长动作被打断
- 被打断后是否确认没有产生任何深处理写回

## 12. 示例

### 12.1 睡眠正常结算

场景：

- 医生在连续多轮公开回避后回到诊所休息
- 当前不存在前台冲突
- 进入 `sleep` 长动作

流程：

1. 医生进入 `sleep`，状态变为 `holding`
2. 世界继续推进，医生在数个 tick 内不参与前台主响应
3. 长动作正常结算，状态变为 `resolved`
4. 规则层构造 `DeepProcessingTrigger`
5. 深处理检索到：
   - 多条与“玩家公开施压”相关的 player model 记忆
   - 一条与“公开回避暂时有效但秘密风险累积”相关的 episodic 记忆
   - 当前身份张力“必须维持专业形象 / 实则越来越恐惧暴露”
6. 深处理结果：
   - 强化两条已有长期记忆
   - 新增一条“玩家会在公开空间持续施压”的模式记忆
   - 更新身份演化层中的 `fear` 与 `self_image` 张力
   - 生成下一轮 priming：`public_secret_risk`

### 12.2 顿悟被打断

场景：

- 治安官因多轮矛盾信息准备进入 `epiphany`
- 刚进入 `holding`，小镇广场发生公开斗殴

流程：

1. 治安官进入 `epiphany`
2. 当前轮后续事件把他重新拉回前台
3. 长动作被标记为 `aborted`
4. 记录 `abortReasonTags = ["public_violence", "forced_return_to_foreground"]`
5. 不生成 `DeepProcessingTrigger`
6. 不产生长期记忆写回
7. 不产生身份演化补丁

## 13. 待处理的问题

1. `sleep` 和 `epiphany` 的进入条件是否应继续拆成不同规则集
2. `IdentityEvolutionLayer` 是否需要单独数据库表，还是先放在运行态存档结构中
3. `NextCyclePrimingPatch` 是否需要过期衰减机制
4. 深处理是否需要区分“纯记忆整合”和“身份重组”两种强度档
5. 深处理结果是否应允许有限影响后续 `Goal Arbitration`，还是只经由记忆与身份层间接影响
6. 是否需要专门的“恢复失败后重新尝试长动作”的冷却规则
