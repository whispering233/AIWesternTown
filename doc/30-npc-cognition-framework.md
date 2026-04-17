# NPC 认知框架设计

## 1. 文档目标

本文档定义 `AIWesternTown` 项目中 NPC 认知系统的可执行设计，重点覆盖以下三个已进入细化阶段的认知模块：

- `Perceive`
- `Appraise`
- `Update Working Memory`

本文档服务于以下目的：

- 为实现代理提供统一、可执行、可调试的 NPC 认知规范
- 明确规则层与 LLM 层的职责边界
- 为后续 `Goal Arbitration`、`Action Selection`、`Reflect` 提供稳定输入接口

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

当前版本已经完成以下三个阶段的第一版正式设计：

- `Perceive`
- `Appraise`
- `Update Working Memory`

以下阶段尚未在本文档中正式展开：

- `Goal Arbitration`
- `Action Selection`
- `Reflect`
- `Compress`

### 2.3 状态层约定

当前三阶段共同依赖以下状态层：

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

#### 3.4.2 `WorkingMemory`

`Perceive` 不读取全部工作记忆，只读取当前焦点和活跃 concern。

```ts
type WorkingMemory = {
  currentFocus: WorkingMemoryItem[];
  activeConcerns: string[];
  currentIntent?: string;
  lastUpdatedAt: number;
};
```

用途：

- 决定注意偏置
- 判断什么更容易被注意到

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
  workingMemory: WorkingMemory,
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
    kind: "episodic" | "social" | "rumor" | "player_model";
    importance: number;
  }[];
};
```

用途：

- 判断当前输入是否是重复模式、危险信号或已知线索延续

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
items = [
  {
    wmId: "wm-1",
    kind: "goal",
    summary: "必须维持医生身份的正常形象",
    priority: 0.74,
    confidence: 0.82,
    emotionalCharge: 0.30,
    freshness: 0.65,
    status: "active"
  },
  {
    wmId: "wm-2",
    kind: "threat",
    summary: "玩家可能在试探昨晚的事件",
    priority: 0.78,
    confidence: 0.71,
    emotionalCharge: 0.52,
    freshness: 0.70,
    status: "active"
  }
]
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
items = [
  {
    wmId: "wm-2",
    kind: "threat",
    summary: "玩家正在公开试探昨晚伤者真相",
    priority: 0.93,
    confidence: 0.78,
    emotionalCharge: 0.67,
    freshness: 0.95,
    status: "active"
  },
  {
    wmId: "wm-3",
    kind: "social",
    summary: "治安官在场使秘密暴露风险上升",
    priority: 0.86,
    confidence: 0.74,
    emotionalCharge: 0.61,
    freshness: 0.91,
    status: "active"
  },
  {
    wmId: "wm-1",
    kind: "goal",
    summary: "必须维持医生身份的正常形象",
    priority: 0.72,
    confidence: 0.82,
    emotionalCharge: 0.30,
    freshness: 0.60,
    status: "background"
  }
]
```

### 5.13 待处理的问题

- `WorkingMemoryItem.kind` 的固定枚举是否还需要扩展
- `summary` 精修是否要按角色口吻定制
- `cooling` 状态是否保留，还是直接二分为 `active/background`
- `rank_score` 的默认权重是否需要分角色调整
- 多个高威胁条目同时命中时的冲突处理策略

## 6. 版本记录

- `v0.1`
  - 建立 NPC 认知框架子文档
  - 完成 `Perceive` 感知阶段第一版可执行草案
- `v0.2`
  - 完成 `Appraise` 评价阶段第一版可执行草案
- `v0.3`
  - 完成 `Update Working Memory` 阶段第一版可执行草案
