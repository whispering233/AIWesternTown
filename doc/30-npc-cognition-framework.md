# NPC 认知框架设计

## 1. 文档目标

本文档定义 `AIWesternTown` 项目中 NPC 认知系统的可执行设计，重点覆盖以下已进入细化阶段的认知模块：

- `Perceive`
- `Appraise`
- `Update Working Memory`
- `Goal Arbitration`
- `Action Selection`
- `Act`
- `Reflect`
- `Compress`

本文档服务于以下目的：

- 为实现代理提供统一、可执行、可调试的 NPC 认知规范
- 明确规则层与 LLM 层的职责边界
- 为长期记忆检索、关系演化和后续横向专题设计提供稳定输入接口

本文档是 [00-master-design.md](C:/codex/project/AIWesternTown/doc/00-master-design.md) 第 6、7、8 章的直接展开文档。

## 2. 认知循环总览

### 2.1 标准认知循环

NPC 的标准认知循环定义为：

`Perceive -> Appraise -> Update Working Memory -> Goal Arbitration -> Action Selection -> Act -> Reflect -> Compress`

其中：

- `Perceive`：构造“NPC 在这一刻注意到了什么”
- `Appraise`：判断这些输入对 NPC 的主观意义
- `Update Working Memory`：决定当前哪些问题真正占据 NPC 的注意力

### 2.2 当前文档覆盖范围

当前版本已经完成以下八个阶段的第一版正式设计：

- `Perceive`
- `Appraise`
- `Update Working Memory`
- `Goal Arbitration`
- `Action Selection`
- `Act`
- `Reflect`
- `Compress`

标准认知循环的 8 个阶段已经全部在本文档中完成第一版正式展开。

### 2.3 状态层约定

当前各阶段共同依赖以下状态层：

- `Identity`
  - 公开身份、秘密、长期目标、禁忌、核心驱动力
- `Long-term Memory`
  - 情景记忆、社交信念、传闻知识、玩家模型
- `Working Memory`
  - 当前焦点、当前 concern、当前意图附近的短时状态
- `Social Graph / Social Beliefs`
  - 当前局部关系判断

### 2.4 统一设计原则

- 每个阶段都必须是独立模块，而不是内联在一个大 prompt 中
- 世界规则和状态更新由规则层权威维护
- LLM 负责高不确定、高语义复杂度的判断，不直接拥有状态写入权
- 每个阶段都必须输出结构化结果，以便日志、调试、回放和测试

### 2.5 统一接口对齐约定

#### 2.5.1 统一工作记忆契约

认知循环中的唯一标准工作记忆结构为 `NPCWorkingMemory`。

- `Update Working Memory` 负责产出和更新它
- `Perceive`、`Goal Arbitration`、`Action Selection` 都读取它的不同切片
- 第一版不再并行维护第二套 `WorkingMemory` 结构

这意味着：

- 第 5 阶段输出可直接作为下一轮第 3 阶段输入
- 各阶段若只读取局部字段，应在各自章节中声明“读取子集”，而不是重新定义一套同名异构结构

#### 2.5.2 `concern` 与 `wmId` 的映射约定

第一版中，`concern` 不单独建模为独立对象，而是直接复用当前活跃 `WorkingMemoryItem`。

因此：

- `activeConcernIds` 存放的是活跃 `WorkingMemoryItem.wmId`
- `linkedConcernIds` 存放的是命中的 `WorkingMemoryItem.wmId`
- `supportingConcernIds` 存放的是支撑当前目标的 `WorkingMemoryItem.wmId`

如果后续需要把 `concern` 从工作记忆条目中拆出，再单独演化为新结构。

#### 2.5.3 `hold` 的语义约定

第一版中，`hold` 不是 `actionType`，而是 `executionMode`。

这意味着：

- `Action Selection` 仍然必须选出一个合法动作类型，例如 `observe` 或 `wait`
- 当 NPC 决定“暂不显性动作”时，使用 `executionMode = "hold"` 表达克制或延迟执行
- `Act` 阶段不得把 `hold` 当作独立动作类型消费

### 2.6 横向支撑文档

以下文档作为本文档的横向支撑规范使用：

- [35-memory-retrieval-and-recall.md](C:/codex/project/AIWesternTown/doc/35-memory-retrieval-and-recall.md)
  - 定义长期记忆读取时机、读取权限、query、缓存和阶段适配
- [36-npc-cognition-flowcharts.md](C:/codex/project/AIWesternTown/doc/36-npc-cognition-flowcharts.md)
  - 用 Mermaid 图展示认知主链路、读取支路和执行后闭环
- [37-npc-cognition-db-design.md](C:/codex/project/AIWesternTown/doc/37-npc-cognition-db-design.md)
  - 定义身份、目标、工作记忆、长期记忆、读取索引和认知日志的数据库模型
- [38-npc-cognition-api-spec.md](C:/codex/project/AIWesternTown/doc/38-npc-cognition-api-spec.md)
  - 定义内部编排器调用各认知阶段与预取/压缩模块的接口契约
- [42-item-system-and-interaction.md](C:/codex/project/AIWesternTown/doc/42-item-system-and-interaction.md)
  - 定义物品动作、隐蔽转移、发现后果与物品事件如何接入认知主链路
- [43-item-schema-and-content-config.md](C:/codex/project/AIWesternTown/doc/43-item-schema-and-content-config.md)
  - 定义物品模板、实例、占有真相和初始认知 schema

当前约定：

- `30-npc-cognition-framework.md` 负责主链路阶段语义和上下游输入输出
- 横向支撑文档负责存储、读取、流程图和服务接口等侧向专题
- 若主链路字段与支撑文档出现冲突，以本文档中的资源模型命名为准，再回补支撑文档

## 3. Perceive 阶段

### 3.1 设计目标

`Perceive` 的目标是把规则层提供的“客观可观察世界切片”转换成“当前 NPC 真正注意到的输入条目”。它不是世界快照复制器，而是注意力筛选器。

输出结果必须回答：

- NPC 此刻注意到了哪些刺激
- 这些刺激为什么值得被注意
- 它们与当前 concern、局部关系和既有记忆有何关联

### 3.2 设计原则

- 感知必须建立在规则层提供的客观输入之上
- 感知允许受到当前内部状态影响，但不得凭空创造外部事实
- 感知阶段只做“注意到什么”的构建，不做策略判断
- 感知结果必须结构化，不直接输出自由文本心理活动
- 感知必须体现注意力有限性，而不是全知扫描

### 3.3 设计思路

`Perceive` 采用“两层感知”设计：

1. `Raw Observation`
   - 读取客观可观察输入
2. `Contextual Attention`
   - 结合工作记忆、局部关系和少量检索记忆，决定哪些刺激真正被注意

这意味着：

- 原始输入来自世界
- 最终感知结果是“世界输入 + NPC 当前主观状态”共同作用的产物

### 3.4 输入结构

#### 3.4.1 `ObservableWorldSlice`

这是感知的主体输入，由规则层构造。

```ts
type ObservableWorldSlice = {
  sceneId: string;
  tick: number;
  visibleActors: ActorSnapshot[];
  visibleActions: ActionSnapshot[];
  dialogueSnippets: DialogueSnippet[];
  visibleClues: ClueSnapshot[];
  recentLocalEvents: WorldEvent[];
  playerAction?: PlayerAction;
};
```

字段说明：

- `visibleActors`
  - 当前场景中可被注意到的角色快照
- `visibleActions`
  - 当前 tick 或最近一段时间内发生的可见行为
- `dialogueSnippets`
  - NPC 可听到的公开或半公开对话片段
- `visibleClues`
  - 场景中的显性线索、异常物件、状态变化
- `recentLocalEvents`
  - 最近发生在本地场景的高层事件
- `playerAction`
  - 玩家刚刚执行且在当前场景可感知的动作

#### 3.4.2 `NPCWorkingMemory`

`Perceive` 读取统一工作记忆结构 `NPCWorkingMemory`，但只消费其中的当前有效子集。

```ts
type NPCWorkingMemory = {
  items: WorkingMemoryItem[];
  activeConcernIds: string[];
  activeIntent?: string;
  capacity: number;
  lastUpdatedAt: number;
};
```

用途：

- 决定注意偏置
- 判断什么更容易被注意到
- 第一版中默认从 `items` 中优先读取 `status = active` 的条目

#### 3.4.3 `SocialContextSlice`

`Perceive` 只读取当前场景相关角色的局部关系。

```ts
type SocialContextSlice = {
  sceneId: string;
  relationEdges: RelationEdge[];
};
```

每条 `RelationEdge` 至少包含：

- 对象角色 ID
- 信任度
- 恐惧度
- 怀疑度
- 利用价值
- 最近关系变化

#### 3.4.4 `RetrievedMemorySlice`

不是全量长时记忆，而是与当前场景候选刺激有关的少量记忆检索结果。

```ts
type RetrievedMemorySlice = {
  memoryItems: RetrievedMemoryItem[];
};
```

每条记忆至少包含：

- 记忆 ID
- 类型：情景 / 社交 / 线索 / 玩家模型
- 摘要文本
- 重要度
- 最近访问时间
- 关联 actor / clue / event

### 3.5 输出结构

#### 3.5.1 `PerceivedItem`

```ts
type PerceivedItem = {
  observationId: string;
  rawType: "speech" | "action" | "presence" | "event" | "clue";
  rawContent: string;
  sceneId: string;
  tick: number;
  actorIds: string[];
  targetIds: string[];
  salience: number;
  attentionReasonTags: string[];
  linkedMemoryIds: string[];
  linkedConcernIds: string[];
};
```

字段约束：

- `salience` 归一化到 `0-1`
- `attentionReasonTags` 只描述“为什么被注意到”
- `linkedMemoryIds` 只指向本轮参与上下文化的记忆
- `linkedConcernIds` 只指向当前命中的工作记忆焦点
- 第一版中 `linkedConcernIds` 直接存放 `WorkingMemoryItem.wmId`

### 3.6 处理流程

#### 3.6.1 Observe

读取 `ObservableWorldSlice`，形成原始观察候选。

这一阶段不做心理解释，只做客观采样。

#### 3.6.2 Pre-attentive Filter

对原始观察做低成本粗筛选。

默认筛选条件：

- 与当前场景直接相关
- 刚刚发生
- 与 NPC 自己有关
- 命中敏感对象、敏感地点或敏感关键词
- 来自高关系权重角色

#### 3.6.3 Contextual Attention

把粗筛结果与：

- 当前工作记忆
- 局部关系图
- 相关持久记忆

进行对照，补充注意力标签和显著性分数。

#### 3.6.4 Build Perceived Items

把经过上下文化处理的候选输入封装成 `PerceivedItem[]`，交给下游 `Appraise`。

### 3.7 设计规格和约束

#### 3.7.1 显著性评分

建议使用轻量显著性公式：

```text
salience =
  recency_weight * recentness +
  self_relevance_weight * self_relevance +
  social_weight * social_relevance +
  concern_match_weight * concern_match +
  memory_match_weight * memory_match +
  anomaly_weight * anomaly
```

#### 3.7.2 默认阈值

- `>= 0.8`
  - 高优先级，必须进入 `PerceivedItem`
- `0.5 - 0.79`
  - 中优先级，按容量保留
- `< 0.5`
  - 默认丢弃，除非命中强规则标签

#### 3.7.3 容量限制

- 每轮最多输出 `3-7` 条 `PerceivedItem`
- 同一 actor 在同一轮最多贡献有限条目
- 低显著性背景信息不进入下游

#### 3.7.4 去重约束

本质上描述同一刺激的多条观察应合并为一条更高显著性的 `PerceivedItem`。

### 3.8 与 LLM 的交互边界

#### 3.8.1 第一版默认不由 LLM 负责的部分

- 原始观察采样
- 粗筛选
- 显著性基础评分
- 关系和记忆命中判断

#### 3.8.2 第一版允许有限调用 LLM 的部分

当复杂社交语义难以靠规则判断时，可选加入：

`interpret_subtext_hint`

输入：

- 一条对话片段
- NPC 当前 concern
- 局部关系摘要

输出：

- 是否可能含试探、威胁、拉拢、撒谎暗示

第一版默认不启用。

### 3.9 与上下游认知阶段的交互边界

#### 3.9.1 上游边界

`Perceive` 只读取：

- 规则层可观察输入
- 少量工作记忆
- 局部关系图
- 少量检索记忆

不直接读取完整长时记忆或全局世界状态。

#### 3.9.2 下游边界

`Perceive` 只输出 `PerceivedItem[]`，不直接：

- 写入工作记忆
- 改关系图
- 生成计划
- 输出动作

### 3.10 透出的接口设计

```ts
function perceive(
  observable: ObservableWorldSlice,
  workingMemory: NPCWorkingMemory,
  social: SocialContextSlice,
  retrievedMemory: RetrievedMemorySlice
): PerceivedItem[]
```

### 3.11 调试要求

调试视图至少展示：

- 原始观察候选数
- 粗筛后保留数
- 最终 `PerceivedItem` 数
- 每条条目的 `salience`
- `attentionReasonTags`
- 命中的 `working memory` 条目
- 命中的 `memory ids`

### 3.12 示例

场景：酒馆。玩家当众问医生：“昨晚是谁受伤了？”

输入：

- 玩家提问
- 医生在场
- 治安官在场
- 酒馆老板在旁边
- 工作记忆：不要让昨晚的真相外泄
- 记忆检索：玩家昨天问过类似问题

输出：

```ts
[
  {
    observationId: "obs-1",
    rawType: "speech",
    rawContent: "玩家公开询问昨晚伤者",
    sceneId: "saloon",
    tick: 184,
    actorIds: ["player"],
    targetIds: ["doctor"],
    salience: 0.93,
    attentionReasonTags: ["goal_relevant", "secret_risk", "repeat_probe"],
    linkedMemoryIds: ["mem-77", "mem-12"],
    linkedConcernIds: ["wm-2"]
  },
  {
    observationId: "obs-2",
    rawType: "presence",
    rawContent: "治安官在场并可听到对话",
    sceneId: "saloon",
    tick: 184,
    actorIds: ["sheriff"],
    targetIds: ["doctor"],
    salience: 0.86,
    attentionReasonTags: ["threat_actor_present", "social_risk"],
    linkedMemoryIds: [],
    linkedConcernIds: ["wm-2"]
  }
]
```

### 3.13 待处理的问题

- `attentionReasonTags` 的固定枚举集
- `RetrievedMemorySlice` 的检索策略
- 是否需要区分“亲见”和“传闻”两类感知可信度
- 显著性公式各权重的默认值

## 4. Appraise 阶段

### 4.1 设计目标

`Appraise` 的目标是把 `PerceivedItem` 转换成“对当前 NPC 而言，这件事意味着什么”的结构化评价结果。

它需要回答：

- 这件事和我有多相关
- 它对我是威胁、机会还是噪音
- 它影响了我的哪些目标
- 它是否改变了我对某些角色的判断
- 它值不值得进入工作记忆

### 4.2 设计原则

- `Appraise` 只做意义判断，不做动作选择
- 主体输入必须是 `PerceivedItem[]`
- 可以用规则完成基础评分
- 可以按需调用 LLM 做语义精修
- 输出必须结构化，便于进入 `Update Working Memory`

### 4.3 设计思路

`Appraise` 采用“规则先跑，LLM 按需精修”的混合方式。

整体思路：

1. 先做基础相关性判断
2. 再判断威胁、机会、社交风险、异常和情绪冲击
3. 将当前输入映射到目标层
4. 给工作记忆模块提供优先级建议

### 4.4 输入结构

#### 4.4.1 `PerceivedItem[]`

这是 appraisal 的主输入。每条条目都来自 `Perceive` 的最终输出。

#### 4.4.2 `NPCIdentitySlice`

```ts
type NPCIdentitySlice = {
  npcId: string;
  role: string;
  publicPersona: string;
  hiddenSecrets: string[];
  longTermGoals: GoalSummary[];
  taboos: string[];
  coreDrives: string[];
};
```

用途：

- 判断是否触及秘密、禁忌或核心驱动力
- 判断是否与长期目标相关

#### 4.4.3 `CurrentGoalState`

```ts
type CurrentGoalState = {
  activeGoalIds: string[];
  pendingGoalIds: string[];
  blockedGoalIds: string[];
};
```

用途：

- 判断当前输入影响哪些目标

#### 4.4.4 `SocialBeliefSlice`

```ts
type SocialBeliefSlice = {
  relatedActors: {
    actorId: string;
    trust: number;
    fear: number;
    suspicion: number;
    dependency: number;
    usefulness: number;
  }[];
};
```

用途：

- 区分不同角色对当前输入的重要性和风险程度

#### 4.4.5 `RetrievedBeliefSlice`

```ts
type RetrievedBeliefSlice = {
  beliefs: {
    memoryId: string;
    summary: string;
    kind: "episodic" | "social" | "player_model" | "clue";
    importance: number;
  }[];
};
```

用途：

- 判断当前输入是否是重复模式、危险信号或已知线索延续
- 第一版中 `RetrievedBeliefSlice.beliefs.kind` 与长期记忆 `LongTermMemoryItem.kind` 保持一致

### 4.5 输出结构

#### 4.5.1 `AppraisalResult`

```ts
type AppraisalResult = {
  observationId: string;
  relevance: number;
  threat: number;
  opportunity: number;
  socialRisk: number;
  anomaly: number;
  emotionalCharge: number;
  certainty: number;
  inferredIntentTags: string[];
  affectedGoalIds: string[];
  affectedActorIds: string[];
  workingMemoryRecommendation: "must_store" | "store_if_space" | "log_only" | "discard";
  appraisalSummary: string;
};
```

### 4.6 处理流程

#### 4.6.1 Relevance Check

先判断这条输入与 NPC 是否真的相关。

建议维度：

- `self_relevance`
- `goal_relevance`
- `secret_relevance`
- `relationship_relevance`

#### 4.6.2 Valence And Meaning

判断这条输入对 NPC 的主观意义：

- 是威胁还是机会
- 是否构成社交风险
- 是否违背预期
- 是否带来明显情绪冲击
- 是否暗示某种他人意图

#### 4.6.3 Affected Goal Mapping

把输入与当前目标集合连接起来，输出“影响了哪些目标”。

#### 4.6.4 Priority Recommendation

生成对 `Update Working Memory` 的写入建议：

- `must_store`
- `store_if_space`
- `log_only`
- `discard`

### 4.7 设计规格和约束

#### 4.7.1 核心评价维度

第一版固定使用 7 个核心维度：

1. `relevance`
2. `threat`
3. `opportunity`
4. `socialRisk`
5. `anomaly`
6. `emotionalCharge`
7. `certainty`

#### 4.7.2 默认阈值

- `relevance >= 0.8`
  - 高相关，通常应进入当前焦点
- `threat >= 0.7`
  - 高威胁
- `opportunity >= 0.7`
  - 高机会
- `socialRisk >= 0.7`
  - 高社交风险
- `certainty < 0.4`
  - 更适合后续试探和调查，而非直接做强动作

### 4.8 与 LLM 的交互边界

#### 4.8.1 规则层优先负责

- `relevance` 基础评分
- `goal match`
- `secret match`
- `relation match`
- `anomaly` 基础判断
- `workingMemoryRecommendation` 初步映射

#### 4.8.2 LLM 适合负责

- 对话潜台词判断
- 他人意图轻量推断
- 社交风险的精细解释
- `appraisalSummary` 的自然语言摘要

#### 4.8.3 第一版推荐模式

```text
rule_appraise -> optional_llm_refine -> merged_appraisal_result
```

### 4.9 与上下游认知阶段的交互边界

#### 4.9.1 上游边界

`Appraise` 默认只读取：

- `PerceivedItem[]`
- 身份摘要
- 当前目标状态
- 局部社交判断
- 少量命中记忆

不直接读取原始全量世界状态。

#### 4.9.2 下游边界

`Appraise` 只输出 `AppraisalResult[]`，不直接：

- 写入工作记忆
- 修改关系图
- 生成动作
- 决定策略

### 4.10 透出的接口设计

```ts
function appraiseByRules(
  perceived: PerceivedItem,
  identity: NPCIdentitySlice,
  goals: CurrentGoalState,
  social: SocialBeliefSlice,
  beliefs: RetrievedBeliefSlice
): RuleAppraisalResult
```

```ts
function refineAppraisalByLLM(
  perceived: PerceivedItem,
  ruleResult: RuleAppraisalResult,
  compactContext: LLMAppraisalContext
): LLMAppraisalRefinement
```

```ts
function mergeAppraisal(
  ruleResult: RuleAppraisalResult,
  llmResult?: LLMAppraisalRefinement
): AppraisalResult
```

### 4.11 调试要求

调试视图至少展示：

- 输入的 `PerceivedItem`
- 规则层基础评分
- 是否触发 LLM 精修
- 最终 `AppraisalResult`
- `workingMemoryRecommendation`
- `affectedGoalIds`

### 4.12 示例

输入：

```ts
{
  observationId: "obs-1",
  rawType: "speech",
  rawContent: "玩家公开询问昨晚是谁受伤了",
  actorIds: ["player"],
  targetIds: ["doctor"],
  salience: 0.93,
  attentionReasonTags: ["goal_relevant", "secret_risk", "repeat_probe"],
  linkedMemoryIds: ["mem-77", "mem-12"],
  linkedConcernIds: ["wm-2"]
}
```

输出：

```ts
{
  observationId: "obs-1",
  relevance: 0.95,
  threat: 0.88,
  opportunity: 0.22,
  socialRisk: 0.81,
  anomaly: 0.63,
  emotionalCharge: 0.67,
  certainty: 0.74,
  inferredIntentTags: ["probe", "information_seeking", "public_pressure"],
  affectedGoalIds: ["goal-hide-injury-truth", "goal-maintain-cover"],
  affectedActorIds: ["player", "sheriff"],
  workingMemoryRecommendation: "must_store",
  appraisalSummary: "玩家正在公开试探与昨晚伤者相关的信息，这对秘密保护构成高风险。"
}
```

### 4.13 待处理的问题

- `RuleAppraisalResult` 的具体字段形态
- `inferredIntentTags` 的枚举集
- 哪些场景必须触发 LLM 精修
- `certainty` 是否需要独立于规则层计算
- `socialRisk` 与 `threat` 的边界是否需要进一步细分

## 5. Update Working Memory 阶段

### 5.1 设计目标

`Update Working Memory` 的目标是把 `PerceivedItem + AppraisalResult` 转换成当前真正占据 NPC 注意力的焦点集合。

它回答的问题是：

- 哪些新输入值得进入当前焦点
- 哪些旧焦点应该强化、降级、合并或淘汰
- 当前最重要的 `1-3` 个 concern 是什么

### 5.2 设计原则

- 工作记忆保存的是“当前关注问题”，不是原始观察流水
- 容量必须严格受限
- 新输入不一定新建条目，也可能刷新或合并旧条目
- 工作记忆是短时状态，不是长时记忆替代品

### 5.3 设计思路

`Update Working Memory` 采用“候选焦点生成 + 旧焦点合并更新 + 重排裁剪”的设计。

整体步骤：

1. 先清理和衰减旧焦点
2. 再把本轮 appraisal 结果转成候选焦点
3. 再与已有 working memory 做匹配、合并、刷新或新建
4. 最后排序、裁剪并提炼 `activeConcernIds`

### 5.4 输入结构

#### 5.4.1 `NPCWorkingMemory`

```ts
type NPCWorkingMemory = {
  items: WorkingMemoryItem[];
  activeConcernIds: string[];
  activeIntent?: string;
  capacity: number;
  lastUpdatedAt: number;
};
```

#### 5.4.2 `PerceivedItem[]`

来自 `Perceive`，提供本轮被注意到的刺激。

#### 5.4.3 `AppraisalResult[]`

来自 `Appraise`，提供这些刺激的主观意义判断。

#### 5.4.4 `tick / timestamp`

用于：

- 衰减
- 过期处理
- freshness 更新

### 5.5 输出结构

#### 5.5.1 `WorkingMemoryItem`

```ts
type WorkingMemoryItem = {
  wmId: string;
  kind: "threat" | "opportunity" | "social" | "goal" | "clue" | "player_model";
  summary: string;
  sourceObservationIds: string[];
  sourceMemoryIds: string[];
  relatedActorIds: string[];
  relatedGoalIds: string[];
  priority: number;
  confidence: number;
  emotionalCharge: number;
  freshness: number;
  decayRate: number;
  firstSeenAt: number;
  lastUpdatedAt: number;
  expiresAt?: number;
  status: "active" | "background" | "cooling";
};
```

字段约束：

- 第一版中 `wmId` 同时承担 `concernId` 的语义
- `activeConcernIds`、`linkedConcernIds`、`supportingConcernIds` 都应引用 `wmId`

#### 5.5.2 `WorkingMemoryCandidate`

```ts
type WorkingMemoryCandidate = {
  kind: WorkingMemoryItem["kind"];
  summary: string;
  relatedActorIds: string[];
  relatedGoalIds: string[];
  sourceObservationIds: string[];
  sourceMemoryIds: string[];
  initialPriority: number;
  confidence: number;
  emotionalCharge: number;
};
```

### 5.6 处理流程

#### 5.6.1 清理与衰减

先对旧工作记忆执行：

- 删除过期项
- 降低长时间未命中的 `priority`
- 把不再活跃的 `active` 项降到 `background` 或 `cooling`

建议公式：

```text
new_priority = old_priority * decayRate
```

#### 5.6.2 生成候选焦点

把本轮 `PerceivedItem + AppraisalResult` 转成候选焦点，而不是直接写入工作记忆。

#### 5.6.3 相似项匹配

候选焦点与已有工作记忆进行匹配，决定：

- `merge`
- `refresh`
- `create`

匹配维度建议：

- `kind` 是否一致
- `relatedActorIds` 是否重叠
- `relatedGoalIds` 是否重叠
- `summary` 是否语义相近
- 来源观察是否连续命中同一主题

#### 5.6.4 合并或创建

命中旧项时，更新：

- `priority`
- `confidence`
- `emotionalCharge`
- `freshness`
- `lastUpdatedAt`
- `sourceObservationIds`
- `relatedActorIds`
- `relatedGoalIds`

建议合并公式：

```text
merged_priority = max(old_priority, candidate_priority) + reinforcement_bonus
merged_confidence = weighted_average(old_confidence, candidate_confidence)
merged_emotional = max(old_emotional, candidate_emotional)
```

#### 5.6.5 重排与容量裁剪

更新完所有条目后，根据综合分排序：

```text
rank_score =
  priority * 0.45 +
  emotionalCharge * 0.2 +
  confidence * 0.15 +
  freshness * 0.2
```

排序后：

- 前 `N` 条进入 `active`
- 中间若干进入 `background`
- 尾部进入 `cooling` 或直接淘汰

#### 5.6.6 生成 `activeConcernIds`

从 `active` 条目中抽取当前最重要的 `1-3` 个 concern，供 `Goal Arbitration` 使用。

第一版映射规则：

- `activeConcernIds = active items.map(item => item.wmId)`
- 不单独生成独立于 `WorkingMemoryItem` 的 concern 实体

### 5.7 设计规格和约束

#### 5.7.1 容量设计

- `active` 条目：`3-5`
- `background` 条目：`3-5`
- 总量：`6-10`

#### 5.7.2 状态语义

- `active`
  - 当前最影响后续目标竞争的焦点
- `background`
  - 仍保留，但不直接主导当前选择
- `cooling`
  - 正在退出当前焦点，等待淘汰或再次被激活

#### 5.7.3 候选焦点映射规则

高威胁条目：

- 条件：`threat >= 0.7` 且 `must_store`
- 映射：`kind = threat`

高机会条目：

- 条件：`opportunity >= 0.7`
- 映射：`kind = opportunity`

高社交风险条目：

- 条件：`socialRisk >= 0.7`
- 映射：`kind = social`

高目标相关条目：

- 条件：`affectedGoalIds` 非空且 `relevance >= 0.75`
- 映射：`kind = goal`

#### 5.7.4 Summary 规则

工作记忆中的 `summary` 只描述当前焦点，不描述动作计划。

好例子：

- `玩家正在公开试探昨晚的伤者信息`
- `治安官在场使秘密暴露风险上升`

坏例子：

- `我很紧张，不知道怎么办`
- `也许我应该马上撒谎并离开这里`

### 5.8 与 LLM 的交互边界

#### 5.8.1 第一版默认不让 LLM 负责的部分

- 容量管理
- 优先级排序
- 淘汰逻辑
- 衰减逻辑

#### 5.8.2 第一版允许 LLM 有限参与的部分

- 对 `summary` 做短句精修

推荐方式：

- 规则层先生成模板化 summary
- 必要时用 LLM 做自然语言短句精修

### 5.9 与上下游认知阶段的交互边界

#### 5.9.1 上游边界

`Update Working Memory` 默认读取：

- 旧 `NPCWorkingMemory`
- 新 `PerceivedItem[]`
- 新 `AppraisalResult[]`

不直接回头读取完整世界状态。

#### 5.9.2 下游边界

`Update Working Memory` 只输出：

- 更新后的 `NPCWorkingMemory`
- `activeConcernIds`

不直接：

- 生成目标竞争结果
- 选择动作
- 写入长时记忆

### 5.10 透出的接口设计

```ts
function updateWorkingMemory(
  previous: NPCWorkingMemory,
  perceivedItems: PerceivedItem[],
  appraisalResults: AppraisalResult[],
  currentTick: number
): NPCWorkingMemory
```

### 5.11 调试要求

调试视图至少展示：

- 旧 `WorkingMemory`
- 候选焦点列表
- 匹配结果：`merge / refresh / create`
- 更新后的 `WorkingMemory`
- `activeConcernIds`
- 被淘汰或降级的条目

### 5.12 示例

当前工作记忆：

```ts
{
  items: [
    {
      wmId: "wm-1",
      kind: "goal",
      summary: "必须维持医生身份的正常形象",
      sourceObservationIds: ["obs-2"],
      sourceMemoryIds: ["mem-12"],
      relatedActorIds: ["doctor", "sheriff"],
      relatedGoalIds: ["goal-maintain-cover"],
      priority: 0.74,
      confidence: 0.82,
      emotionalCharge: 0.30,
      freshness: 0.65,
      decayRate: 0.92,
      firstSeenAt: 172,
      lastUpdatedAt: 180,
      status: "active"
    },
    {
      wmId: "wm-2",
      kind: "threat",
      summary: "玩家可能在试探昨晚的事件",
      sourceObservationIds: ["obs-7"],
      sourceMemoryIds: ["mem-77"],
      relatedActorIds: ["player"],
      relatedGoalIds: ["goal-hide-injury-truth"],
      priority: 0.78,
      confidence: 0.71,
      emotionalCharge: 0.52,
      freshness: 0.70,
      decayRate: 0.94,
      firstSeenAt: 179,
      lastUpdatedAt: 180,
      status: "active"
    }
  ],
  activeConcernIds: ["wm-1", "wm-2"],
  activeIntent: undefined,
  capacity: 8,
  lastUpdatedAt: 180
}
```

新 appraisal：

```ts
{
  observationId: "obs-9",
  relevance: 0.95,
  threat: 0.88,
  opportunity: 0.22,
  socialRisk: 0.81,
  anomaly: 0.63,
  emotionalCharge: 0.67,
  certainty: 0.74,
  affectedGoalIds: ["goal-hide-injury-truth", "goal-maintain-cover"],
  affectedActorIds: ["player", "sheriff"],
  workingMemoryRecommendation: "must_store",
  appraisalSummary: "玩家正在公开试探与昨晚伤者相关的信息，这对秘密保护构成高风险。"
}
```

更新后：

```ts
{
  items: [
    {
      wmId: "wm-2",
      kind: "threat",
      summary: "玩家正在公开试探昨晚伤者真相",
      sourceObservationIds: ["obs-7", "obs-9"],
      sourceMemoryIds: ["mem-77", "mem-12"],
      relatedActorIds: ["player", "doctor"],
      relatedGoalIds: ["goal-hide-injury-truth", "goal-maintain-cover"],
      priority: 0.93,
      confidence: 0.78,
      emotionalCharge: 0.67,
      freshness: 0.95,
      decayRate: 0.96,
      firstSeenAt: 179,
      lastUpdatedAt: 184,
      status: "active"
    },
    {
      wmId: "wm-3",
      kind: "social",
      summary: "治安官在场使秘密暴露风险上升",
      sourceObservationIds: ["obs-2"],
      sourceMemoryIds: [],
      relatedActorIds: ["sheriff", "doctor"],
      relatedGoalIds: ["goal-hide-injury-truth"],
      priority: 0.86,
      confidence: 0.74,
      emotionalCharge: 0.61,
      freshness: 0.91,
      decayRate: 0.95,
      firstSeenAt: 184,
      lastUpdatedAt: 184,
      status: "active"
    },
    {
      wmId: "wm-1",
      kind: "goal",
      summary: "必须维持医生身份的正常形象",
      sourceObservationIds: ["obs-2"],
      sourceMemoryIds: ["mem-12"],
      relatedActorIds: ["doctor", "sheriff"],
      relatedGoalIds: ["goal-maintain-cover"],
      priority: 0.72,
      confidence: 0.82,
      emotionalCharge: 0.30,
      freshness: 0.60,
      decayRate: 0.92,
      firstSeenAt: 172,
      lastUpdatedAt: 184,
      status: "background"
    }
  ],
  activeConcernIds: ["wm-2", "wm-3"],
  activeIntent: undefined,
  capacity: 8,
  lastUpdatedAt: 184
}
```

### 5.13 待处理的问题

- `WorkingMemoryItem.kind` 的固定枚举是否还需要扩展
- `summary` 精修是否要按角色口吻定制
- `cooling` 状态是否保留，还是直接二分为 `active/background`
- `rank_score` 的默认权重是否需要分角色调整
- 多个高威胁条目同时命中时的冲突处理策略

## 6. Goal Arbitration 阶段

### 6.1 设计目标

`Goal Arbitration` 的目标是把当前工作记忆中的多个焦点转换成“NPC 此刻最优先保护或争取什么”的主导目标。它不直接选动作，而是给动作选择模块提供足够窄、足够明确的目标上下文。

它需要回答：

- 当前同时存在多个 concern 时，哪个目标优先级最高
- 长期目标和短期威胁冲突时，谁优先
- 当前是保密、自保、维持关系，还是推进个人野心
- 哪些目标在这一轮被压制

### 6.2 设计原则

- 只做目标竞争，不直接生成动作
- 必须基于 `Working Memory` 和 `Goal State`
- 必须同时体现短期压力和长期动机
- 输出必须可解释，能说明“为什么选这个目标”
- 第一版优先由规则层完成仲裁，LLM 只做边缘裁决和摘要

### 6.3 设计思路

`Goal Arbitration` 把目标分成两层：

1. `Long-term Goals`
   - 稳定存在的角色目标，例如保住身份、保护秘密、报复某人、拉拢玩家
2. `Active Goal`
   - 当前这一轮真正压过其他目标、直接驱动行为的主导目标

整体思路：

1. 从目标库中激活候选目标
2. 根据当前焦点、威胁、机会和世界约束为目标打分
3. 处理目标之间的冲突
4. 选出唯一主导目标
5. 给下游 `Action Selection` 输出目标摘要和压制信息

### 6.4 输入结构

#### 6.4.1 `GoalDefinition[]`

角色预设目标池。

```ts
type GoalDefinition = {
  goalId: string;
  kind: "self_preserve" | "secrecy" | "relationship" | "status" | "investigation" | "ambition";
  summary: string;
  ownerNpcId: string;
  priorityBase: number;
  isLongTerm: boolean;
  targetActorIds?: string[];
  blockers?: string[];
};
```

#### 6.4.2 `NPCWorkingMemory`

重点读取：

- `items`
- `activeConcernIds`
- `activeIntent`

#### 6.4.3 `AppraisalResult[]`

提供：

- 哪些目标被威胁
- 哪些目标出现机会
- 哪些目标需要即时响应

#### 6.4.4 `NPCIdentitySlice`

用于读取：

- 核心驱动力
- 禁忌
- 长期目标优先级
- 角色职责

#### 6.4.5 `WorldConstraintSlice`

提供当前场景和规则层的执行约束。

```ts
type WorldConstraintSlice = {
  sceneId: string;
  availableTargets: string[];
  blockedActions: string[];
  urgencyFlags: string[];
};
```

### 6.5 输出结构

#### 6.5.1 `GoalArbitrationResult`

```ts
type GoalArbitrationResult = {
  chosenGoalId: string;
  chosenGoalSummary: string;
  chosenGoalKind: GoalDefinition["kind"];
  urgency: number;
  commitment: number;
  horizon: "immediate" | "short" | "session";
  supportingConcernIds: string[];
  supportingObservationIds: string[];
  suppressedGoalIds: string[];
  arbitrationReason: string;
};
```

字段说明：

- `chosenGoalId`
  - 当前主导目标
- `urgency`
  - 当前紧迫度
- `commitment`
  - NPC 对该目标的投入强度
- `horizon`
  - 目标生效的时间尺度
- `supportingConcernIds`
  - 是哪些焦点把它顶上来的
- 第一版中 `supportingConcernIds` 直接引用 `WorkingMemoryItem.wmId`
- `suppressedGoalIds`
  - 这一轮被压下去的目标
- `arbitrationReason`
  - 供调试和解释使用的短摘要

### 6.6 处理流程

#### 6.6.1 激活候选目标

从 `GoalDefinition[]` 中选出当前轮可能进入竞争的目标：

- 与当前 concern 相关
- 与当前场景可执行
- 与角色身份或长期动机一致

#### 6.6.2 计算目标得分

建议综合分公式：

```text
goal_score =
  base_priority * 0.25 +
  concern_support * 0.30 +
  threat_pressure * 0.20 +
  opportunity_pull * 0.10 +
  identity_alignment * 0.10 +
  feasibility * 0.05
```

#### 6.6.3 处理目标冲突

常见冲突：

- 保密 vs 维持关系
- 自保 vs 推进野心
- 调查真相 vs 维持表面正常
- 试探玩家 vs 避免暴露异常

第一版默认冲突优先级：

1. `self_preserve`
2. `secrecy`
3. `relationship`
4. `status`
5. `investigation`
6. `ambition`

#### 6.6.4 选出主导目标

选出分数最高且不被世界约束禁止的目标。

#### 6.6.5 生成目标摘要

把结果压缩为可交给 `Action Selection` 的目标上下文，包括：

- 当前主导目标是什么
- 为什么现在优先它
- 哪些目标被暂时压制

### 6.7 设计规格和约束

#### 6.7.1 第一版目标类别

第一版固定 6 类目标：

- `self_preserve`
- `secrecy`
- `relationship`
- `status`
- `investigation`
- `ambition`

#### 6.7.2 单主导目标约束

第一版只允许选出一个主导目标，不输出多目标组合。

#### 6.7.3 时间尺度约束

每个目标结果都必须带时间尺度：

- `immediate`
- `short`
- `session`

#### 6.7.4 可执行性约束

当前场景无法执行的目标，不能成为主导目标，只能保留为背景目标。

例如：

- 想私聊但目标不在场
- 想销毁证据但证据不在此处
- 想报复某人但没有当前执行窗口

### 6.8 与 LLM 的交互边界

#### 6.8.1 第一版规则层负责

- 候选目标生成
- 目标分数计算
- 冲突优先级
- 可执行性判断
- 最终主导目标选择

#### 6.8.2 第一版 LLM 适合负责

- 两个目标分数非常接近时的语义裁决
- `arbitrationReason` 的自然语言摘要
- 边界模糊时的主观偏向补充

#### 6.8.3 第一版推荐模式

```text
rule_goal_arbitration -> optional_llm_tiebreak -> final_goal_result
```

### 6.9 与上下游认知阶段的交互边界

#### 6.9.1 上游边界

`Goal Arbitration` 默认读取：

- `NPCWorkingMemory`
- `AppraisalResult[]`
- `GoalDefinition[]`
- `NPCIdentitySlice`
- `WorldConstraintSlice`

不直接读原始感知输入。

#### 6.9.2 下游边界

`Goal Arbitration` 只输出主导目标及其解释，不直接输出动作。

下游 `Action Selection` 再结合：

- 主导目标
- 当前场景
- 可选动作

来决定下一步行为。

### 6.10 透出的接口设计

```ts
function arbitrateGoal(
  goalLibrary: GoalDefinition[],
  workingMemory: NPCWorkingMemory,
  appraisalResults: AppraisalResult[],
  identity: NPCIdentitySlice,
  worldConstraints: WorldConstraintSlice
): GoalArbitrationResult
```

### 6.11 调试要求

调试视图至少展示：

- 候选目标列表
- 每个目标的 score breakdown
- 每个目标由哪些 concern 支撑
- 哪些目标被压制
- 最终选中的目标
- `arbitrationReason`

### 6.12 示例

场景：医生在酒馆，玩家公开追问昨晚伤者，治安官也在场。

当前工作记忆：

- 玩家正在公开试探昨晚伤者真相
- 治安官在场使秘密暴露风险上升
- 必须维持医生身份的正常形象

候选目标：

- `goal-hide-injury-truth`
- `goal-maintain-cover`
- `goal-probe-player-intent`

输出：

```ts
{
  chosenGoalId: "goal-hide-injury-truth",
  chosenGoalSummary: "优先阻止昨晚伤者信息继续外泄",
  chosenGoalKind: "secrecy",
  urgency: 0.92,
  commitment: 0.84,
  horizon: "immediate",
  supportingConcernIds: ["wm-2", "wm-3"],
  supportingObservationIds: ["obs-1", "obs-2"],
  suppressedGoalIds: ["goal-maintain-cover", "goal-probe-player-intent"],
  arbitrationReason: "公开追问与治安官在场同时出现，使保密目标在本轮压过形象维持与试探需求。"
}
```

### 6.13 待处理的问题

- `GoalDefinition` 是否要加入显式失败代价字段
- 目标冲突优先级是否允许因角色而异
- 是否允许“双主导目标”作为后续版本扩展
- `commitment` 和 `urgency` 是否要独立演化
- `relationship` 类目标是否需要细分为 `maintain / manipulate / repair`

## 7. Action Selection 阶段

### 7.1 设计目标

`Action Selection` 的目标是把 `Goal Arbitration` 产出的主导目标，转换成当前 tick 内最应该执行的具体动作方案。

它需要回答：

- 为了服务当前主导目标，现在最合适的动作是什么
- 在当前场景可执行动作中，哪个动作收益最高、风险最低或最符合身份
- 是立即说、立即做、试探、转移、观察，还是暂时不动作
- 这个动作需要面向谁、在哪执行、以什么风格执行

### 7.2 设计原则

- 只做动作选择，不直接修改世界状态
- 只在规则层声明的可执行动作集合中做选择，不凭空创造非法动作
- 优先输出可解释、可复现的结构化动作意图，而不是直接生成表演文本
- 必须同时考虑目标一致性、场景约束、社交风险和身份约束
- 第一版优先单动作输出，不做复杂多步计划

### 7.3 设计思路

`Action Selection` 采用“候选动作生成 + 可执行性过滤 + 多维打分 + 单动作裁决”的设计。

整体思路：

1. 从规则层提供的动作能力和场景 affordance 中收集候选动作
2. 依据主导目标、工作记忆和当前社交上下文，过滤掉不合适动作
3. 对剩余候选动作按目标收益、暴露风险、身份一致性和执行成本打分
4. 选出唯一主动作，并为 `Act` 阶段提供足够窄的执行规范

这里的关键边界是：

- `Goal Arbitration` 决定“为什么做”
- `Action Selection` 决定“现在做什么”
- `Act` 决定“具体如何落到世界和文本中”

### 7.4 输入结构

#### 7.4.1 `GoalArbitrationResult`

这是动作选择的主驱动输入，用于确定当前行为的中心目标。

重点读取：

- `chosenGoalId`
- `chosenGoalKind`
- `urgency`
- `commitment`
- `horizon`
- `suppressedGoalIds`

#### 7.4.2 `NPCWorkingMemory`

重点读取：

- 当前 `active` 焦点
- `activeConcernIds`
- 相关 actor / goal / threat 条目
- 当前是否已有 `activeIntent`

用途：

- 判断动作要优先回应什么压力
- 判断是应当继续推进当前行为，还是切换策略

#### 7.4.3 `ActionAffordanceSet`

由规则层根据当前地点、角色状态、可交互对象和能力模板生成。

```ts
type ActionAffordanceSet = {
  npcId: string;
  sceneId: string;
  tick: number;
  candidates: ActionCandidate[];
};
```

```ts
type ActionCandidate = {
  actionId: string;
  actionType: "speak" | "move" | "observe" | "use_item" | "interact" | "wait";
  verb: string;
  targetActorIds?: string[];
  targetObjectIds?: string[];
  targetLocationId?: string;
  visibility: "public" | "semi_public" | "private";
  cost: number;
  riskBase: number;
  preconditions: string[];
  blockedBy?: string[];
  tags: string[];
};
```

用途：

- 定义当前真正允许被选的动作范围
- 为动作评分提供基础成本和风险参数

#### 7.4.4 `ActionSelectionSocialSlice`

```ts
type ActionSelectionSocialSlice = {
  presentActors: {
    actorId: string;
    trust: number;
    fear: number;
    suspicion: number;
    authority: number;
    leverage: number;
  }[];
  audienceSize: number;
  privacyLevel: "public" | "semi_public" | "private";
};
```

用途：

- 判断动作在当前观众结构下的暴露风险
- 判断是否适合公开发言、私下接触或暂时克制

#### 7.4.5 `ActionPolicySlice`

用于提供角色级行为限制。

```ts
type ActionPolicySlice = {
  forbiddenActionTags: string[];
  preferredActionTags: string[];
  deceptionTolerance: number;
  aggressionTolerance: number;
  interruptionSensitivity: number;
};
```

用途：

- 保证动作不会违反身份、 taboo 或设计禁区
- 体现不同 NPC 的行为风格差异

### 7.5 输出结构

#### 7.5.1 `ActionSelectionResult`

```ts
type ActionSelectionResult = {
  chosenActionId: string;
  actionType: ActionCandidate["actionType"];
  verb: string;
  targetActorIds: string[];
  targetObjectIds: string[];
  targetLocationId?: string;
  visibility: ActionCandidate["visibility"];
  executionMode: "immediate" | "queued" | "hold";
  styleTags: string[];
  expectedEffectTags: string[];
  riskScore: number;
  goalAlignment: number;
  confidence: number;
  fallbackActionIds: string[];
  selectionReason: string;
};
```

字段说明：

- `executionMode`
  - `immediate`：本轮立刻进入 `Act`
  - `queued`：等待短前置条件完成后执行
  - `hold`：当前选择暂不外显执行，通常与 `observe` 或 `wait` 配合使用
- `styleTags`
  - 描述执行风格，而不是生成文本
- `expectedEffectTags`
  - 描述设计预期，例如 `deflect_attention`、`reduce_suspicion`
- `fallbackActionIds`
  - 当前动作失败或受阻时，可优先尝试的备选动作

### 7.6 处理流程

#### 7.6.1 候选动作收集

从 `ActionAffordanceSet.candidates` 中读取候选动作，并按 `GoalArbitrationResult` 做第一轮粗筛。

默认保留条件：

- 能直接服务当前主导目标
- 没有被前置条件完全阻断
- 不违反 `ActionPolicySlice`
- 当前场景有明确执行对象或执行位置

#### 7.6.2 可执行性过滤

过滤以下动作：

- 目标人物不在场
- 所需物品或地点不可达
- 当前公开度与动作要求冲突
- 风险超出角色容忍范围
- 会直接违反禁忌或当前被压制但更高优先级的隐含约束

#### 7.6.3 多维打分

对候选动作按多维度打分：

- `goal_alignment`
- `risk_fit`
- `social_fit`
- `identity_fit`
- `cost_efficiency`
- `urgency_fit`

建议综合分公式：

```text
action_score =
  goal_alignment * 0.35 +
  risk_fit * 0.20 +
  social_fit * 0.15 +
  identity_fit * 0.10 +
  cost_efficiency * 0.10 +
  urgency_fit * 0.10
```

其中：

- `goal_alignment`
  - 该动作对当前主导目标的直接支持度
- `risk_fit`
  - 该动作的风险是否在当前情境下可接受
- `social_fit`
  - 是否适合当前在场角色和公开度
- `identity_fit`
  - 是否符合角色身份、性格和禁忌
- `cost_efficiency`
  - 是否以较低成本实现足够效果
- `urgency_fit`
  - 是否符合当前时间尺度和紧迫程度

#### 7.6.4 单动作裁决

选择得分最高的单个动作。

若最高分低于安全阈值，则允许选择：

- `observe`
- `wait`

作为保守动作，避免角色做出违和或过度激进的行为。

如果当前最优策略是“暂不显性动作”，则：

- `actionType` 仍应为合法动作类型，通常是 `observe` 或 `wait`
- `executionMode` 设为 `hold`

#### 7.6.5 生成执行约束

为下游 `Act` 阶段补充执行约束：

- 目标对象
- 公开度
- 风格标签
- 预期效果
- 失败回退动作

### 7.7 设计规格和约束

#### 7.7.1 第一版动作类型约束

第一版固定支持以下动作类型：

- `speak`
- `move`
- `observe`
- `use_item`
- `interact`
- `wait`

后续若扩展：

- 不应直接在此层引入复杂组合动作
- 多步计划应留给更高层规划模块，而不是塞进本阶段

#### 7.7.2 单动作约束

第一版每轮只选一个主动作，不输出动作链。

例如：

- 可以选 `public_deflect`
- 不能同时选 `public_deflect + move_to_backroom + signal_ally`

#### 7.7.3 保守兜底约束

若所有显式动作都高风险、低收益或不可执行，必须允许输出保守动作：

- `observe`
- `wait`

这类结果不等于“NPC 卡住”，而是明确表达“当前最优策略是暂缓显性动作”。

若需要表达“暂缓显性动作”，应使用：

- 合法的 `actionType`
- `executionMode = "hold"`

#### 7.7.4 文本与动作分离约束

`Action Selection` 不直接产出完整台词、长解释或演出文本。

它只输出：

- 动作类型
- 目标
- 风格标签
- 执行约束

真正的文本生成放在 `Act` 阶段。

### 7.8 与 LLM 的交互边界

#### 7.8.1 第一版规则层负责

- 候选动作收集
- 可执行性过滤
- 基础动作评分
- 保守兜底判定
- 最终动作结构输出

#### 7.8.2 第一版 LLM 适合负责

- 社交动作之间的语义细分裁决
- `styleTags` 的补充建议
- `selectionReason` 的自然语言摘要

典型场景：

- `公开回避`
- `轻度试探`
- `含糊安抚`
- `强硬施压`

这些动作都属于 `speak`，但在语义风格上存在重要差异。

#### 7.8.3 第一版推荐模式

```text
rule_action_select -> optional_llm_style_refine -> final_action_selection
```

### 7.9 与上下游认知阶段的交互边界

#### 7.9.1 上游边界

`Action Selection` 默认读取：

- `GoalArbitrationResult`
- `NPCWorkingMemory`
- `ActionAffordanceSet`
- `ActionSelectionSocialSlice`
- `ActionPolicySlice`

不直接读取原始感知流或全量世界状态。

#### 7.9.2 下游边界

`Action Selection` 只输出结构化动作意图，不直接：

- 改写世界状态
- 生成最终对话文本
- 修改关系值
- 写入长时记忆

这些都属于 `Act` 或其后续阶段的职责。

### 7.10 透出的接口设计

```ts
function selectAction(
  goalResult: GoalArbitrationResult,
  workingMemory: NPCWorkingMemory,
  affordances: ActionAffordanceSet,
  social: ActionSelectionSocialSlice,
  policy: ActionPolicySlice
): ActionSelectionResult
```

### 7.11 调试要求

调试视图至少展示：

- 当前主导目标
- 候选动作列表
- 每个动作的 `score breakdown`
- 被过滤动作及原因
- 最终选中的动作
- `fallbackActionIds`
- `selectionReason`

### 7.12 示例

场景：酒馆内，玩家公开追问昨晚伤者，治安官在场，医生当前主导目标是继续保密。

输入摘要：

- `chosenGoalId = goal-hide-injury-truth`
- `chosenGoalKind = secrecy`
- `activeConcernIds = ["wm-2", "wm-3"]`
- 候选动作：
  - `act-public-deflect`
  - `act-invite-private-talk`
  - `act-stay-silent`
  - `act-leave-scene`

输出：

```ts
{
  chosenActionId: "act-public-deflect",
  actionType: "speak",
  verb: "deflect",
  targetActorIds: ["player"],
  targetObjectIds: [],
  targetLocationId: undefined,
  visibility: "public",
  executionMode: "immediate",
  styleTags: ["calm", "professional", "redirect_topic"],
  expectedEffectTags: ["deflect_attention", "preserve_cover", "avoid_escalation"],
  riskScore: 0.38,
  goalAlignment: 0.91,
  confidence: 0.84,
  fallbackActionIds: ["act-invite-private-talk", "act-stay-silent"],
  selectionReason: "在治安官在场的公开场合，直接回避并转移话题比离场或沉默更能同时保护秘密与维持医生身份。"
}
```

### 7.13 待处理的问题

- `ActionCandidate.tags` 的标准枚举是否要与内容模板系统共享
- `wait` 与 `observe` 是否需要拆分不同的执行语义
- `fallbackActionIds` 是否只保留前两个
- 某些高复杂社交动作是否需要在本阶段引入“战术姿态”中间层
- 当前评分公式是否要按 `GoalDefinition.kind` 使用不同权重

## 8. Act 阶段

### 8.1 设计目标

`Act` 的目标是把 `ActionSelectionResult` 转换成一次真正发生在世界中的执行结果。

它需要回答：

- 这次动作是否成功执行，还是被阻断、打断、部分完成
- 这次执行对世界状态产生了什么权威变更
- 玩家和旁观 NPC 实际看到了什么、听到了什么
- 本轮执行应沉淀出哪些事件记录，交给后续 `Reflect` 和记忆系统

### 8.2 设计原则

- `Act` 是执行阶段，不再重新仲裁目标或重选动作
- 世界真相、状态变化和结果判定必须由规则层权威维护
- LLM 可以负责受限演出，但不能越权创造世界事实
- 执行结果必须结构化、可回放、可调试
- 第一版优先单动作执行，不支持复杂动作链或长时任务编排

### 8.3 设计思路

`Act` 采用“规则层权威执行 + LLM 受限演出”的混合式设计。

整体思路：

1. 规则层根据 `ActionSelectionResult` 和当前世界状态，判定动作是否可执行
2. 规则层生成权威结果，包括成功、失败、部分成功、状态变更和事件记录
3. 若动作需要对外可见表现，则把已确定的结果交给 LLM 或模板层做受限渲染
4. 输出统一的 `ActionExecutionResult`，供 `Reflect`、日志系统和前端消费

关键边界：

- `Action Selection` 决定“做什么”
- `Act` 决定“发生了什么”
- `Reflect` 决定“这次发生意味着什么，并是否进入更长期的判断和记忆”

### 8.4 输入结构

#### 8.4.1 `ActionSelectionResult`

这是执行阶段的主输入。

重点读取：

- `chosenActionId`
- `actionType`
- `verb`
- `targetActorIds`
- `targetObjectIds`
- `targetLocationId`
- `visibility`
- `executionMode`
- `styleTags`
- `expectedEffectTags`

#### 8.4.2 `ExecutionWorldStateSlice`

由规则层提供的当前执行所需最小世界状态切片。

```ts
type ExecutionWorldStateSlice = {
  tick: number;
  sceneId: string;
  npcState: {
    npcId: string;
    locationId: string;
    posture?: string;
    inventoryItemIds: string[];
    statusFlags: string[];
  };
  targetActors: {
    actorId: string;
    locationId: string;
    statusFlags: string[];
    availability: "available" | "busy" | "incapacitated" | "absent";
  }[];
  targetObjects: {
    objectId: string;
    locationId: string;
    stateTags: string[];
    isUsable: boolean;
  }[];
  sceneFlags: string[];
};
```

用途：

- 判断动作当前是否真的可落地
- 为状态变更和事件记录提供权威上下文

#### 8.4.3 `ExecutionPolicySlice`

用于提供执行规则、冲突规则和权限边界。

```ts
type ExecutionPolicySlice = {
  blockedActionIds: string[];
  blockedActionTags: string[];
  interruptionRules: string[];
  visibilityRules: string[];
  sideEffectRules: string[];
};
```

用途：

- 判定动作是否被当前规则显式阻止
- 决定是否会触发额外副作用或观众传播

#### 8.4.4 `ExecutionContextSlice`

提供演出和记录所需的附加上下文。

```ts
type ExecutionContextSlice = {
  actingNpcId: string;
  observerActorIds: string[];
  audienceSize: number;
  scenePrivacy: "public" | "semi_public" | "private";
  currentDialogueThreadId?: string;
};
```

用途：

- 判断哪些角色能看到这次动作
- 支持对话渲染和事件广播

### 8.5 输出结构

#### 8.5.1 `ActionExecutionResult`

```ts
type ActionExecutionResult = {
  executionId: string;
  sourceActionId: string;
  actorId: string;
  actionType: ActionSelectionResult["actionType"];
  outcome: "success" | "partial" | "blocked" | "failed";
  outcomeReasonTags: string[];
  consumedTick: number;
  stateMutations: StateMutation[];
  emittedEvents: WorldEventRecord[];
  visibleOutcome: VisibleOutcomePayload;
  privateOutcome?: PrivateOutcomePayload;
  shouldReflect: boolean;
  executionSummary: string;
};
```

#### 8.5.2 `StateMutation`

```ts
type StateMutation = {
  domain: "npc_state" | "scene_state" | "object_state" | "relationship" | "conversation";
  targetId: string;
  operation: "set" | "add" | "remove" | "move" | "start" | "end";
  path: string;
  value?: string | number | boolean | string[];
};
```

#### 8.5.3 `WorldEventRecord`

```ts
type WorldEventRecord = {
  eventId: string;
  tick: number;
  sceneId: string;
  eventType: "speech" | "movement" | "interaction" | "status_change" | "social_signal";
  actorId: string;
  targetActorIds: string[];
  targetObjectIds: string[];
  visibility: "public" | "semi_public" | "private";
  summary: string;
  tags: string[];
};
```

#### 8.5.4 `VisibleOutcomePayload`

```ts
type VisibleOutcomePayload = {
  narrationLine?: string;
  dialogueLine?: string;
  gestureTags: string[];
  observerActorIds: string[];
};
```

#### 8.5.5 `PrivateOutcomePayload`

```ts
type PrivateOutcomePayload = {
  concealedEffects: string[];
  hiddenEventIds: string[];
};
```

### 8.6 处理流程

#### 8.6.1 执行前校验

首先校验 `ActionSelectionResult` 与当前世界状态是否仍然匹配。

检查内容包括：

- 目标是否仍在场
- 物品或位置是否仍可用
- 动作是否被 `ExecutionPolicySlice` 阻断
- `executionMode = hold` 时是否需要转成保守执行

#### 8.6.2 权威结果判定

规则层根据执行条件给出权威结果：

- `success`
- `partial`
- `blocked`
- `failed`

第一版建议优先使用显式规则，不在此阶段引入开放式结果生成。

#### 8.6.3 状态变更生成

若动作实际生效，则生成最小必要的 `StateMutation[]`。

常见例子：

- 改变 NPC 所在位置
- 开启或结束一段对话线程
- 修改物品占有关系
- 变更场景标记或会话状态

注意：

- 第一版不在 `Act` 阶段直接写长期记忆
- 关系变化若需要即时落地，也应以结构化 mutation 表达

#### 8.6.4 事件记录生成

把这次执行落成 `WorldEventRecord[]`。

事件记录是：

- 回放依据
- 观察系统输入
- `Reflect` 的重要上游输入

第一版要求每次执行至少生成一条事件记录，即使结果是 `blocked`。

#### 8.6.5 可见表现渲染

若本次动作需要对玩家或旁观者可见，则在权威结果已确定之后生成 `VisibleOutcomePayload`。

推荐模式：

- 规则层先产出结构化结果
- 模板层或 LLM 只在此基础上渲染简短台词、姿态和叙述

LLM 不得：

- 改写 `outcome`
- 发明未存在的角色、物品、地点
- 擅自新增未授权的状态变更

#### 8.6.6 反思触发标记

根据执行结果判断是否需要后续 `Reflect`：

- 高风险社交结果
- 目标失败或部分成功
- 产生新异常或新线索
- 对玩家或关键 NPC 产生明显影响

第一版输出布尔值 `shouldReflect`，由后续反思调度决定是否进入深处理。

### 8.7 设计规格和约束

#### 8.7.1 单动作执行约束

第一版中，每轮 `Act` 只消费一个 `ActionSelectionResult`，并产出一个 `ActionExecutionResult`。

不支持：

- 一个阶段内串行执行多个动作
- 在执行阶段临时插入新的主动作
- 长事务式多轮动作编排

#### 8.7.2 权威状态约束

`stateMutations` 是世界状态变化的唯一权威表达。

这意味着：

- 前端展示文本不能作为事实来源
- LLM 渲染文本不能反向定义世界状态
- 所有后续系统都应读取 mutation 和 event，而不是读取台词表面文本推断真相

#### 8.7.3 `hold` 执行约束

当 `executionMode = "hold"` 时：

- `actionType` 仍必须是合法动作类型
- 默认不产生高外显度结果
- 通常只生成低可见性的观察、等待或姿态调整事件

这类执行结果常见于：

- 继续观察
- 暂不接话
- 延迟靠近

#### 8.7.4 可见性约束

`visibleOutcome` 只描述对外可感知结果。

若存在隐藏效果，例如：

- 暗中记住某人反应
- 偷偷放回物品
- 未被旁人察觉的态度变化

则必须通过：

- `privateOutcome`
- 低可见性 `WorldEventRecord`

来表达，而不是混入公开叙述。

### 8.8 与 LLM 的交互边界

#### 8.8.1 第一版规则层负责

- 动作执行前校验
- `outcome` 判定
- `stateMutations` 生成
- `emittedEvents` 生成
- `shouldReflect` 判定

#### 8.8.2 第一版 LLM 适合负责

- 基于已定结果渲染简短对话或叙述
- 补充 `gestureTags`
- 在不改写事实的前提下，提升社交表现的自然度
- 生成 `executionSummary` 的自然语言摘要

#### 8.8.3 第一版推荐模式

```text
rule_execute_action -> optional_llm_render_visible_outcome -> final_action_execution_result
```

### 8.9 与上下游认知阶段的交互边界

#### 8.9.1 上游边界

`Act` 默认读取：

- `ActionSelectionResult`
- `ExecutionWorldStateSlice`
- `ExecutionPolicySlice`
- `ExecutionContextSlice`

不重新读取：

- 原始感知候选
- 全量目标竞争过程
- 未被选中的候选动作

#### 8.9.2 下游边界

`Act` 输出：

- `ActionExecutionResult`
- `StateMutation[]`
- `WorldEventRecord[]`

它不直接：

- 写长期记忆
- 完成反思性解释
- 重做目标仲裁

这些属于 `Reflect` 或其后续阶段的职责。

### 8.10 透出的接口设计

```ts
function act(
  selection: ActionSelectionResult,
  world: ExecutionWorldStateSlice,
  policy: ExecutionPolicySlice,
  context: ExecutionContextSlice
): ActionExecutionResult
```

### 8.11 调试要求

调试视图至少展示：

- 输入的 `ActionSelectionResult`
- 执行前校验结果
- 最终 `outcome`
- `stateMutations`
- `emittedEvents`
- `visibleOutcome`
- `shouldReflect`
- `executionSummary`

### 8.12 示例

场景：酒馆内，医生已被选定执行 `public_deflect`，治安官与玩家都在场。

输入摘要：

- `chosenActionId = act-public-deflect`
- `actionType = speak`
- `targetActorIds = ["player"]`
- `visibility = public`
- `executionMode = immediate`
- `styleTags = ["calm", "professional", "redirect_topic"]`

输出：

```ts
{
  executionId: "exec-401",
  sourceActionId: "act-public-deflect",
  actorId: "doctor",
  actionType: "speak",
  outcome: "success",
  outcomeReasonTags: ["target_present", "scene_public", "no_rule_block"],
  consumedTick: 184,
  stateMutations: [
    {
      domain: "conversation",
      targetId: "thread-saloon-12",
      operation: "set",
      path: "topic",
      value: "general_medical_advice"
    }
  ],
  emittedEvents: [
    {
      eventId: "evt-900",
      tick: 184,
      sceneId: "saloon",
      eventType: "speech",
      actorId: "doctor",
      targetActorIds: ["player"],
      targetObjectIds: [],
      visibility: "public",
      summary: "医生公开回避昨晚伤者问题并转移话题",
      tags: ["deflect", "public_response", "cover_preservation"]
    }
  ],
  visibleOutcome: {
    dialogueLine: "昨晚的事没什么值得渲染的，倒是你今天脸色不太好。",
    gestureTags: ["steady_gaze", "brief_pause", "topic_redirect"],
    observerActorIds: ["player", "sheriff", "bartender"]
  },
  privateOutcome: {
    concealedEffects: [],
    hiddenEventIds: []
  },
  shouldReflect: true,
  executionSummary: "医生成功在公开场合回避了追问，并把对话转向更安全的话题。"
}
```

### 8.13 待处理的问题

- `partial` 与 `failed` 的边界是否需要更细化
- `StateMutation.path` 是否要绑定统一状态 schema
- 是否需要把对话线程操作拆成独立 mutation domain
- `shouldReflect` 是否应改成多级触发强度而非布尔值
- `privateOutcome` 是否应与后续记忆写入接口直接对接

## 9. Reflect 阶段

### 9.1 设计目标

`Reflect` 的目标是把一次执行结果转化为“对 NPC 来说，这件事说明了什么”的结构化反思结果。

它需要回答：

- 这次执行是成功、受阻、冒险还是暴露了新问题
- 这次结果改变了 NPC 对自己、他人、玩家或局势的哪些判断
- 哪些结论应继续停留在工作记忆，哪些应作为长期记忆候选
- 是否需要调整目标权重、关系判断或后续关注点

### 9.2 设计原则

- `Reflect` 只解释已发生结果，不改写世界事实
- 反思必须建立在 `Act` 的权威输出之上，而不是从表演文本反推真相
- 第一版采用“轻量常驻反思 + 深度条件触发”
- 输出必须结构化，便于驱动下一轮 working memory、social belief 和 memory compression
- `Reflect` 可以生成判断和候选写入，但不直接写长期记忆

### 9.3 设计思路

`Reflect` 采用两级反思：

1. `Light Reflect`
   - 每次 `Act` 后都运行
   - 低成本评估结果是否符合预期、是否需要保留后续关注
2. `Deep Reflect`
   - 仅在高价值或高异常事件上触发
   - 负责更复杂的社会解释、失败归因和经验沉淀

整体思路：

1. 接收 `Act` 产出的执行结果和事件记录
2. 先做轻量结果评估和重要性判定
3. 若命中高价值条件，则进入深度反思
4. 产出结构化判断、关系更新建议、目标状态更新和记忆候选
5. 把结果交给下游 `Compress` 和 end-of-tick 状态更新器

关键边界：

- `Act` 决定“发生了什么”
- `Reflect` 决定“这意味着什么”
- `Compress` 决定“哪些结论值得固化进长期记忆”

### 9.4 输入结构

#### 9.4.1 `ActionExecutionResult`

这是反思阶段的主输入。

重点读取：

- `executionId`
- `sourceActionId`
- `outcome`
- `outcomeReasonTags`
- `stateMutations`
- `emittedEvents`
- `shouldReflect`
- `executionSummary`

#### 9.4.2 `NPCWorkingMemory`

用于判断这次结果与当前焦点之间的关系。

重点读取：

- `items`
- `activeConcernIds`
- `activeIntent`

用途：

- 判断哪些 concern 被强化
- 判断哪些焦点应该降级、淘汰或新建

#### 9.4.3 `ReflectionEventWindow`

提供以当前执行为中心的近期事件窗口。

```ts
type ReflectionEventWindow = {
  sceneId: string;
  currentTick: number;
  recentEvents: WorldEventRecord[];
};
```

用途：

- 支持“这不是单点事件，而是某种模式重复”的判断
- 为深度反思提供近期上下文

#### 9.4.4 `NPCIdentitySlice`

用于解释结果对角色自我认知和长期目标的影响。

重点读取：

- `role`
- `publicPersona`
- `hiddenSecrets`
- `longTermGoals`
- `taboos`
- `coreDrives`

#### 9.4.5 `ReflectionBeliefSlice`

提供与本次执行相关的现有信念或记忆摘要。

```ts
type ReflectionBeliefSlice = {
  actorBeliefs: {
    actorId: string;
    trust: number;
    suspicion: number;
    fear: number;
    usefulness: number;
  }[];
  retrievedMemories: {
    memoryId: string;
    kind: "episodic" | "social" | "player_model" | "clue";
    summary: string;
    importance: number;
  }[];
};
```

用途：

- 判断本次结果是否改变既有看法
- 支持“重复模式”与“意外偏差”识别
- 其中 `retrievedMemories` 子字段由长期记忆读取机制提供，`actorBeliefs` 由 social belief 状态层提供

#### 9.4.6 `ReflectionPolicySlice`

定义深度反思触发阈值和最大成本。

```ts
type ReflectionPolicySlice = {
  deepReflectOutcomeTags: string[];
  deepReflectEventTags: string[];
  significanceThreshold: number;
  maxMemoryCandidates: number;
};
```

用途：

- 控制哪些结果需要深度反思
- 避免所有动作都进入高成本解释

### 9.5 输出结构

#### 9.5.1 `ReflectionResult`

```ts
type ReflectionResult = {
  reflectionId: string;
  sourceExecutionId: string;
  mode: "light" | "deep";
  significance: number;
  outcomeAssessment: "expected" | "mixed" | "unexpected" | "costly_success" | "failure";
  updatedHypothesisTags: string[];
  actorBeliefUpdates: ActorBeliefUpdate[];
  goalStatusUpdates: GoalStatusUpdate[];
  workingMemoryEffects: ReflectionWorkingMemoryEffect;
  memoryCandidates: ReflectionMemoryCandidate[];
  followupConcernTags: string[];
  reflectionSummary: string;
};
```

#### 9.5.2 `ActorBeliefUpdate`

```ts
type ActorBeliefUpdate = {
  actorId: string;
  trustDeltaHint: number;
  suspicionDeltaHint: number;
  fearDeltaHint: number;
  reasoningTags: string[];
};
```

#### 9.5.3 `GoalStatusUpdate`

```ts
type GoalStatusUpdate = {
  goalId: string;
  status: "reinforced" | "progressed" | "blocked" | "failed" | "deprioritized";
  strength: number;
  reasonTags: string[];
};
```

#### 9.5.4 `ReflectionWorkingMemoryEffect`

```ts
type ReflectionWorkingMemoryEffect = {
  reinforceWmIds: string[];
  retireWmIds: string[];
  createItems: WorkingMemoryCandidate[];
};
```

#### 9.5.5 `ReflectionMemoryCandidate`

```ts
type ReflectionMemoryCandidate = {
  candidateId: string;
  kind: "episodic" | "social" | "player_model" | "clue";
  summary: string;
  importance: number;
  sourceEventIds: string[];
  relatedActorIds: string[];
  shouldCompress: boolean;
};
```

### 9.6 处理流程

#### 9.6.1 轻量反思常驻执行

每次 `Act` 结束后，先执行一次轻量反思。

轻量反思至少完成：

- 结果是否符合预期
- 本次结果的重要性评分
- 当前 working memory 是否需要最小调整
- 是否需要进入深度反思

#### 9.6.2 深度反思触发判定

满足以下任一情况时，应进入 `Deep Reflect`：

- `shouldReflect = true`
- `outcome` 为 `partial`、`blocked` 或 `failed`
- 命中秘密风险、关系突变、玩家异常行为等高价值标签
- 与近期事件组合后显示出重复模式或策略失效

第一版建议显式触发规则：

```text
deep_reflect =
  execution.shouldReflect
  OR outcome in {partial, blocked, failed}
  OR significance >= threshold
  OR high_value_tag_hit
```

#### 9.6.3 结果意义评估

把执行结果映射为主观意义。

核心判断维度建议：

- 目标结果是否推进
- 身份或秘密是否更安全
- 某个 actor 是否更可疑、更可用或更危险
- 当前策略是否有效

输出：

- `outcomeAssessment`
- `updatedHypothesisTags`
- `goalStatusUpdates`

#### 9.6.4 他人模型与关系判断更新

根据执行反馈更新对他人的临时判断。

常见例子：

- 玩家继续试探，`suspicion` 上升
- 治安官未立即介入，`fear` 下降
- 某角色公开配合，`trust` 小幅上升

第一版中这里只输出 `delta hint`，真正关系图落地由状态更新器统一应用。

#### 9.6.5 工作记忆后效生成

根据反思结果生成对 working memory 的后效：

- 强化哪些旧焦点
- 退休哪些已解决焦点
- 创建哪些新的反思型关注点

这里的目标不是重做第 5 阶段，而是补充“执行后新知道了什么”。

#### 9.6.6 长期记忆候选生成

把值得沉淀的结论整理成 `ReflectionMemoryCandidate[]`，供 `Compress` 使用。

典型候选：

- 事件型经验
- 对玩家的新判断
- 某角色的异常反应模式
- 某策略在某场景中的有效性结论

### 9.7 设计规格和约束

#### 9.7.1 两级反思约束

第一版必须明确区分：

- `light`
- `deep`

不允许所有事件都走同样高成本流程。

#### 9.7.2 事实来源约束

`Reflect` 只能读取：

- `ActionExecutionResult`
- `WorldEventRecord[]`
- 既有工作记忆与信念

不得把 `visibleOutcome.dialogueLine` 当作唯一事实来源。

#### 9.7.3 状态写入约束

`Reflect` 不直接：

- 写长期记忆
- 改写 `stateMutations`
- 回滚执行结果

它只输出：

- belief update hints
- goal status update
- working memory effects
- memory candidates

#### 9.7.4 候选数量约束

第一版默认限制：

- 每次 `Reflect` 最多输出 `1-3` 条 `memoryCandidates`
- 每次 `Reflect` 最多创建 `1-2` 条新的 reflection-based `WorkingMemoryCandidate`

### 9.8 与 LLM 的交互边界

#### 9.8.1 第一版规则层负责

- 轻量反思常驻执行
- 深度反思触发判定
- significance 基础评分
- 候选 memory 数量控制
- working memory 后效结构输出

#### 9.8.2 第一版 LLM 适合负责

- 深度反思中的社会意义解释
- 策略得失总结
- `updatedHypothesisTags` 补充
- `reflectionSummary` 的自然语言摘要

#### 9.8.3 第一版推荐模式

```text
rule_light_reflect -> optional_deep_reflect_by_llm -> merged_reflection_result
```

### 9.9 与上下游认知阶段的交互边界

#### 9.9.1 上游边界

`Reflect` 默认读取：

- `ActionExecutionResult`
- `NPCWorkingMemory`
- `ReflectionEventWindow`
- `NPCIdentitySlice`
- `ReflectionBeliefSlice`
- `ReflectionPolicySlice`

不直接重跑：

- `Perceive`
- `Appraise`
- `Goal Arbitration`
- `Action Selection`

#### 9.9.2 下游边界

`Reflect` 输出：

- `ReflectionResult`
- `ReflectionMemoryCandidate[]`
- `ReflectionWorkingMemoryEffect`

它不直接：

- 写长期记忆
- 完成记忆压缩
- 生成新动作

这些属于 `Compress` 或下一轮认知循环的职责。

### 9.10 透出的接口设计

```ts
function reflect(
  execution: ActionExecutionResult,
  workingMemory: NPCWorkingMemory,
  eventWindow: ReflectionEventWindow,
  identity: NPCIdentitySlice,
  beliefs: ReflectionBeliefSlice,
  policy: ReflectionPolicySlice
): ReflectionResult
```

### 9.11 调试要求

调试视图至少展示：

- 输入的 `ActionExecutionResult`
- 轻量反思结果
- 是否触发深度反思
- significance 与触发原因
- `actorBeliefUpdates`
- `goalStatusUpdates`
- `workingMemoryEffects`
- `memoryCandidates`
- `reflectionSummary`

### 9.12 示例

场景：医生刚刚在酒馆公开回避玩家追问，`Act` 结果为成功，但 `shouldReflect = true`，因为事件涉及秘密暴露风险。

输出：

```ts
{
  reflectionId: "refl-88",
  sourceExecutionId: "exec-401",
  mode: "deep",
  significance: 0.87,
  outcomeAssessment: "costly_success",
  updatedHypothesisTags: ["player_persistent_probe", "sheriff_now_observing", "cover_temporarily_preserved"],
  actorBeliefUpdates: [
    {
      actorId: "player",
      trustDeltaHint: -0.05,
      suspicionDeltaHint: 0.18,
      fearDeltaHint: 0,
      reasoningTags: ["repeat_probe", "public_pressure"]
    },
    {
      actorId: "sheriff",
      trustDeltaHint: 0,
      suspicionDeltaHint: 0.12,
      fearDeltaHint: 0.08,
      reasoningTags: ["present_during_secret_risk", "may_follow_up"]
    }
  ],
  goalStatusUpdates: [
    {
      goalId: "goal-hide-injury-truth",
      status: "progressed",
      strength: 0.61,
      reasonTags: ["public_deflection_worked", "risk_not_removed"]
    }
  ],
  workingMemoryEffects: {
    reinforceWmIds: ["wm-2", "wm-3"],
    retireWmIds: [],
    createItems: [
      {
        kind: "player_model",
        summary: "玩家会在公开场合持续试探昨晚事件",
        relatedActorIds: ["player"],
        relatedGoalIds: ["goal-hide-injury-truth"],
        sourceObservationIds: ["obs-1"],
        sourceMemoryIds: ["mem-77"],
        initialPriority: 0.79,
        confidence: 0.73,
        emotionalCharge: 0.44
      }
    ]
  },
  memoryCandidates: [
    {
      candidateId: "mc-19",
      kind: "player_model",
      summary: "玩家倾向于在公开场合施压并测试昨晚事件相关反应",
      importance: 0.83,
      sourceEventIds: ["evt-900"],
      relatedActorIds: ["player"],
      shouldCompress: true
    }
  ],
  followupConcernTags: ["public_secret_risk", "player_probe_pattern"],
  reflectionSummary: "虽然这次公开回避暂时成功，但玩家表现出持续施压模式，治安官在场也让后续风险上升。"
}
```

### 9.13 待处理的问题

- `significance` 是否应拆成社会重要性、目标重要性和情绪重要性
- `goalStatusUpdates` 是否需要直接挂接目标调度器
- `followupConcernTags` 是否应升级为正式 concern schema
- `light` 模式是否完全禁止调用 LLM
- 某些长期行为模式是否应在 `Reflect` 就直接触发 player model 更新

## 10. Compress 阶段

### 10.1 设计目标

`Compress` 的目标是把 `Reflect` 产出的记忆候选，整理为高质量、可检索、可持续维护的长期记忆。

它需要回答：

- 哪些反思结果值得进入长期记忆
- 这些候选应写成事件记忆、社交信念、玩家模型还是线索记忆
- 新候选与已有长期记忆是新增、合并、强化还是丢弃
- 如何在信息密度和记忆清洁度之间保持平衡

### 10.2 设计原则

- `Compress` 只负责长期记忆整编，不重新解释世界事实
- 事实来源必须是 `Reflect` 与权威事件记录，而不是自由文本表演
- 第一版采用“平衡压缩”，避免长期记忆过 sparse 或过 noisy
- 长期记忆必须结构化、可检索、可合并、可淘汰
- `Compress` 可以生成摘要和归并结论，但不得生成新动作或直接改写世界状态

### 10.3 设计思路

`Compress` 采用“候选筛选 + 相似记忆检索 + 归并决策 + 长期写入”的设计。

整体思路：

1. 接收 `Reflect` 产出的 `ReflectionMemoryCandidate[]`
2. 根据重要度、重复度和复用价值做初步筛选
3. 检索与候选语义相近的长期记忆项
4. 决定是 `create`、`merge`、`reinforce` 还是 `discard`
5. 输出新的长期记忆写入结果和压缩摘要

平衡压缩策略的核心是：

- 高重要度、高复用候选直接写入
- 中等重要度候选在“模式重复”或“会持续影响目标/关系/玩家模型”时写入
- 一次性、低重要度、低复用候选默认丢弃

关键边界：

- `Reflect` 决定“这件事意味着什么”
- `Compress` 决定“哪些意义值得留下”
- 后续的 `Perceive / Appraise / Reflect` 再把这些长期记忆检索回来使用

### 10.4 输入结构

#### 10.4.1 `ReflectionResult`

这是压缩阶段的主判断输入。

重点读取：

- `reflectionId`
- `mode`
- `significance`
- `outcomeAssessment`
- `updatedHypothesisTags`
- `actorBeliefUpdates`
- `goalStatusUpdates`
- `memoryCandidates`
- `reflectionSummary`

#### 10.4.2 `ReflectionMemoryCandidate[]`

这是压缩阶段的直接写入候选。

重点读取：

- `kind`
- `summary`
- `importance`
- `sourceEventIds`
- `relatedActorIds`
- `shouldCompress`

#### 10.4.3 `LongTermMemoryStoreSlice`

提供与当前候选最相关的一组现有长期记忆。

```ts
type LongTermMemoryStoreSlice = {
  memoryItems: LongTermMemoryItem[];
};
```

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

用途：

- 做相似检索和去重
- 支持“新建 / 合并 / 强化 / 丢弃”的决策

#### 10.4.4 `CompressionContextSlice`

提供压缩时需要的执行上下文。

```ts
type CompressionContextSlice = {
  npcId: string;
  currentTick: number;
  recentStoredMemoryIds: string[];
  memoryBudget: {
    maxCreatesPerTick: number;
    maxReinforcementsPerTick: number;
  };
};
```

用途：

- 避免同一轮重复写入
- 控制每轮长期记忆增长规模

#### 10.4.5 `CompressionPolicySlice`

定义平衡压缩策略的阈值。

```ts
type CompressionPolicySlice = {
  directStoreImportanceThreshold: number;
  mergeSimilarityThreshold: number;
  reinforcementSimilarityThreshold: number;
  discardBelowImportance: number;
  requirePatternRepeatForMidImportance: boolean;
};
```

用途：

- 控制不同重要度候选的去留
- 固化“平衡压缩”的策略门槛

### 10.5 输出结构

#### 10.5.1 `CompressionResult`

```ts
type CompressionResult = {
  compressionId: string;
  sourceReflectionId: string;
  createdMemories: LongTermMemoryWrite[];
  mergedMemories: LongTermMemoryMerge[];
  reinforcedMemories: LongTermMemoryReinforcement[];
  discardedCandidates: DiscardedMemoryCandidate[];
  retrievalSummary: RetrievalSummaryItem[];
  compressionSummary: string;
};
```

#### 10.5.2 `LongTermMemoryWrite`

```ts
type LongTermMemoryWrite = {
  memoryId: string;
  kind: LongTermMemoryItem["kind"];
  summary: string;
  importance: number;
  confidence: number;
  sourceEventIds: string[];
  relatedActorIds: string[];
  tags: string[];
};
```

#### 10.5.3 `LongTermMemoryMerge`

```ts
type LongTermMemoryMerge = {
  targetMemoryId: string;
  mergedCandidateIds: string[];
  newSummary?: string;
  importanceDelta: number;
  confidenceDelta: number;
  reinforcementCountDelta: number;
};
```

#### 10.5.4 `LongTermMemoryReinforcement`

```ts
type LongTermMemoryReinforcement = {
  targetMemoryId: string;
  candidateId: string;
  importanceDelta: number;
  confidenceDelta: number;
  reasonTags: string[];
};
```

#### 10.5.5 `DiscardedMemoryCandidate`

```ts
type DiscardedMemoryCandidate = {
  candidateId: string;
  reason: "low_importance" | "duplicate" | "one_off_noise" | "budget_limited";
};
```

#### 10.5.6 `RetrievalSummaryItem`

```ts
type RetrievalSummaryItem = {
  memoryId: string;
  kind: LongTermMemoryItem["kind"];
  retrievalHint: string;
  tags: string[];
};
```

### 10.6 处理流程

#### 10.6.1 候选预筛选

先按 `shouldCompress`、`importance` 和预算做第一轮筛选。

默认规则：

- `shouldCompress = false` 的候选默认丢弃
- 高重要度候选优先进入后续流程
- 低于 `discardBelowImportance` 的候选默认丢弃

#### 10.6.2 相似长期记忆检索

对每个候选检索相关长期记忆，判断是否已存在相近条目。

匹配维度建议：

- `kind` 是否一致
- `relatedActorIds` 是否重叠
- `summary` 是否语义相近
- `sourceEventIds` 是否有重合或延续关系
- `tags` 是否命中同一模式

#### 10.6.3 压缩决策

对每个候选输出以下之一：

- `create`
- `merge`
- `reinforce`
- `discard`

建议逻辑：

- 高重要度且无近似项：`create`
- 高相似且候选补充了新表述：`merge`
- 高相似但只是再次验证旧结论：`reinforce`
- 低价值、一次性、不可复用：`discard`

#### 10.6.4 记忆摘要归并

当执行 `create` 或 `merge` 时，需要生成适合长期存储的摘要。

摘要要求：

- 不写瞬时情绪噪声
- 不写未验证的自由联想
- 尽量写“可被未来检索和复用的结论”

好例子：

- `玩家会在公开场合持续试探与昨晚事件有关的话题`
- `治安官在涉及秘密问题时会保持观察但未立即介入`

坏例子：

- `我当时感觉很烦`
- `也许大家都在针对我`

#### 10.6.5 写入与强化结果生成

根据压缩决策生成：

- `createdMemories`
- `mergedMemories`
- `reinforcedMemories`
- `discardedCandidates`

同时更新用于未来检索的摘要提示。

#### 10.6.6 检索摘要生成

为新写入或刚被强化的重要记忆生成 `retrievalSummary`，供后续记忆检索系统使用。

这一步的目标是：

- 方便未来 `Perceive`/`Appraise` 快速命中关键长期记忆
- 降低每次都要扫全量长期记忆的成本

### 10.7 设计规格和约束

#### 10.7.1 平衡压缩约束

第一版采用平衡压缩，不允许：

- 所有中低重要候选都直接写入
- 只保留极少数超级重要记忆，导致角色缺乏经历沉淀

默认策略应让长期记忆既有代表性，又不过度膨胀。

#### 10.7.2 长期记忆质量约束

长期记忆项应满足：

- 可复用
- 可检索
- 低噪声
- 与未来决策相关

不满足这些条件的候选应倾向于 `discard` 或仅做轻度 `reinforce`。

#### 10.7.3 写入预算约束

第一版默认每次 `Compress`：

- 新建记忆不超过 `1-3` 条
- 强化已有记忆不超过 `1-3` 条
- 丢弃是默认允许且应常见发生的结果

#### 10.7.4 事实稳定性约束

`Compress` 写入的是“可长期保留的结论”，不是“完整回放原始事件”。

这意味着：

- 记忆摘要必须比 event 更抽象
- 不能把未经验证的猜想直接固化为高置信度长期记忆
- 如需保留不确定判断，应降低 `confidence` 或写为模式性提示

### 10.8 与 LLM 的交互边界

#### 10.8.1 第一版规则层负责

- 候选预筛选
- 预算控制
- 去重与相似性基础判断
- `create / merge / reinforce / discard` 的默认决策
- 写入结果结构化输出

#### 10.8.2 第一版 LLM 适合负责

- 中等重要度但语义复杂候选的泛化判断
- `newSummary` 的摘要润色
- `retrievalHint` 的自然语言提炼
- `compressionSummary` 的自然语言摘要

#### 10.8.3 第一版推荐模式

```text
rule_precompress_filter -> retrieve_similar_memories -> optional_llm_generalize -> finalize_compression_result
```

### 10.9 与上下游认知阶段的交互边界

#### 10.9.1 上游边界

`Compress` 默认读取：

- `ReflectionResult`
- `ReflectionMemoryCandidate[]`
- `LongTermMemoryStoreSlice`
- `CompressionContextSlice`
- `CompressionPolicySlice`

不直接重跑：

- `Act`
- `Reflect`
- 原始世界事件判定

#### 10.9.2 下游边界

`Compress` 输出：

- `CompressionResult`
- 新增/合并/强化后的长期记忆写入结果
- 未来检索用的 `retrievalSummary`

它不直接：

- 生成动作
- 修改工作记忆
- 改写反思结果

这些都属于下一轮认知循环或长期记忆存储层的职责。

### 10.10 透出的接口设计

```ts
function compressMemory(
  reflection: ReflectionResult,
  candidates: ReflectionMemoryCandidate[],
  existingMemories: LongTermMemoryStoreSlice,
  context: CompressionContextSlice,
  policy: CompressionPolicySlice
): CompressionResult
```

### 10.11 调试要求

调试视图至少展示：

- 输入的 `ReflectionResult`
- 输入候选列表及 importance
- 相似长期记忆检索结果
- 每个候选的压缩决策
- `created / merged / reinforced / discarded` 结果
- `retrievalSummary`
- `compressionSummary`

### 10.12 示例

场景：医生在公开回避事件后，`Reflect` 产出了一条玩家模型候选和一条事件型候选。

输入摘要：

- `reflectionId = refl-88`
- 候选：
  - `mc-19`: 玩家会在公开场合施压并测试昨晚事件相关反应
  - `mc-20`: 本次公开回避暂时成功但风险未解除
- 检索到已有长期记忆：
  - `mem-player-probe-1`: 玩家会试探敏感话题

输出：

```ts
{
  compressionId: "cmp-31",
  sourceReflectionId: "refl-88",
  createdMemories: [
    {
      memoryId: "mem-ep-442",
      kind: "episodic",
      summary: "医生曾在酒馆公开回避昨晚事件的追问，并暂时维持了表面掩护。",
      importance: 0.72,
      confidence: 0.78,
      sourceEventIds: ["evt-900"],
      relatedActorIds: ["doctor", "player", "sheriff"],
      tags: ["public_deflection", "cover_preserved", "secret_risk"]
    }
  ],
  mergedMemories: [],
  reinforcedMemories: [
    {
      targetMemoryId: "mem-player-probe-1",
      candidateId: "mc-19",
      importanceDelta: 0.08,
      confidenceDelta: 0.06,
      reasonTags: ["pattern_reconfirmed", "public_pressure_variant"]
    }
  ],
  discardedCandidates: [
    {
      candidateId: "mc-20",
      reason: "duplicate"
    }
  ],
  retrievalSummary: [
    {
      memoryId: "mem-player-probe-1",
      kind: "player_model",
      retrievalHint: "当玩家在公开场合追问敏感事件时，应优先命中这条玩家施压模式记忆。",
      tags: ["player_probe_pattern", "public_pressure"]
    },
    {
      memoryId: "mem-ep-442",
      kind: "episodic",
      retrievalHint: "涉及酒馆公开追问与医生掩护策略时，可检索这次成功回避的事件记忆。",
      tags: ["saloon", "deflection", "cover_event"]
    }
  ],
  compressionSummary: "本轮压缩新增一条事件记忆，并强化了一条玩家施压模式记忆，未让重复结论继续污染长期记忆。"
}
```

### 10.13 待处理的问题

- `LongTermMemoryItem` 是否需要显式遗忘或衰减字段
- `merge` 与 `reinforce` 的边界是否要更严格区分
- 不确定性较高的社会判断是否应拆成单独 memory kind
- `retrievalSummary` 是否应与向量检索或关键词检索策略绑定
- 是否需要单独的离线再压缩机制，定期清洗长期记忆库

## 11. 版本记录

- `v0.1`
  - 建立 NPC 认知框架子文档
  - 完成 `Perceive` 感知阶段第一版可执行草案
- `v0.2`
  - 完成 `Appraise` 评价阶段第一版可执行草案
- `v0.3`
  - 完成 `Update Working Memory` 阶段第一版可执行草案
- `v0.4`
  - 完成 `Goal Arbitration` 阶段第一版可执行草案
- `v0.5`
  - 完成 `Action Selection` 阶段第一版可执行草案
- `v0.6`
  - 完成 `Act` 阶段第一版可执行草案
- `v0.7`
  - 完成 `Reflect` 阶段第一版可执行草案
- `v0.8`
  - 完成 `Compress` 阶段第一版可执行草案
