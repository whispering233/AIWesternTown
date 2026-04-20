# 世界与剧情线设计方案

## 1. Document Overview

| Item | Content |
| --- | --- |
| Document title | `AIWesternTown world and narrative solution` |
| Business goal | 为第一版定义稳定、可配置、可复用的世界叙事结构，使项目既能在不加载剧情线时仅靠角色内容形成可信涌现，又能在加载剧情线时产出更完整、更可收束的单局故事。 |
| Scope | 覆盖世界叙事层定位、`Freeform Sandbox / Narrative Sandbox` 双形态、角色卡与剧情线内容模型、开局装配规则、剧情线接入 `worldTick` 的方式、收束与调试边界。 |
| Non-goals | 不展开数据库表设计；不展开 REST/API 契约；不定义具体首批地点清单与完整角色池；不锁定某条具体主线的剧情文案；不展开数值权重公式和最终编辑器形态。 |
| Target readers | 产品设计者、世界与内容设计者、仿真编排实现者、调试工具实现者、后续 schema/API 设计者。 |
| Assumptions | 母稿已锁定“角色驱动的世界仿真 + 可选剧情线叠加层”；核心玩法循环由 [20-core-game-loop.md](C:/codex/project/AIWesternTown/doc/20-core-game-loop.md) 承接；世界调度与 `worldTick` 机制由 [40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md) 承接；NPC 认知链路由 [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md) 承接；LLM 职责边界由 [50-llm-integration.md](C:/codex/project/AIWesternTown/doc/50-llm-integration.md) 承接。 |

## 2. Solution Overview

| Item | Content |
| --- | --- |
| Solution summary | 第一版采用“双层内容系统 + 单一世界运行内核”的方案。基础层由地点、角色卡、关系种子、秘密和基础事件模板组成，保证无剧情线时仍能自然涌现。叙事层由 `1` 条主线骨架和若干按条件装配的支线组成，通过叙事偏置而不是行为命令影响世界演化。 |
| Sub-parts or sub-flows | `世界叙事层与会话形态`、`内容配置模型`、`开局装配与运行态`、`剧情线接入 worldTick`、`收束与调试边界` |
| Key design decisions | 世界仿真先于剧情线；角色卡是必需内容，剧情线是可选内容；剧情线采用中约束配置而非硬编码流程；`Freeform Sandbox` 与 `Narrative Sandbox` 共用同一运行骨架；剧情线只影响注意力、事件候选和收束可达性，不直接命令 NPC。 |
| Overall constraints | 不能让剧情线替代 NPC 主体性；不能让 narrative 模式变成脚本执行器；不能让 freeform 模式变成无收束的纯观察器；不能把角色、事件、结局全部写死在代码里；不能让叙事偏置绕过统一事件结算链路。 |
| Dependencies | [00-master-design.md](C:/codex/project/AIWesternTown/doc/00-master-design.md)、[20-core-game-loop.md](C:/codex/project/AIWesternTown/doc/20-core-game-loop.md)、[30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md)、[40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md)、[50-llm-integration.md](C:/codex/project/AIWesternTown/doc/50-llm-integration.md) |
| Risks and open confirmation items | 主线与支线数量上限仍需实测；角色槽位匹配失败时的降级策略待后续 schema 文档收敛；freeform 局的收束阈值需要验证；不同剧情包之间的互斥与优先级规则仍需 `To be confirmed`；叙事编辑器形态不在本文锁定。 |

## 3. 世界叙事层与会话形态

### 3.1 设计目标

本子部分负责定义“世界为何不会散”和“为什么不加载剧情线也能玩”的总体结构，给后续内容配置、调度接入和玩法表现提供统一前提。

### 3.2 设计原则

- 世界仿真先于叙事包装
- 角色主体性优先于剧情完整性
- 允许无剧情线运行
- narrative 模式只能在 freeform 之上叠加，不能另起一套逻辑
- 单局必须最终可收束、可复盘、可解释

### 3.3 设计思路

第一版世界内容拆成两层：

1. `基础角色涌现层`
   - 由地点、角色卡、关系种子、秘密和基础事件模板构成
   - 负责保证世界在没有主线的情况下仍会因目标冲突、误解扩散和秘密传播而自然升温

2. `可选剧情线层`
   - 由主线、支线、线索传播拓扑、关键事件池和候选结局构成
   - 负责让一局的局势更有中心、更有阶段感、更容易收束成完整故事

在此基础上，第一版定义两种会话形态：

- `Freeform Sandbox`
  - 只加载基础角色涌现层
  - 用于验证“只依靠角色设计也能形成可信涌现”

- `Narrative Sandbox`
  - 在 freeform 基础上，再加载 `1` 条主线和若干支线
  - 用于验证“在保留 NPC 主体性的同时，为单局提供故事骨架”

### 3.4 输入结构

```ts
type SessionNarrativeProfile = {
  sessionMode: "freeform" | "narrative";
  worldContentPackId: string;
  characterPackId: string;
  enabledSceneIds: string[];
  enabledCharacterIds: string[];
  enabledSecretIds: string[];
  enabledBaseEventTemplateIds: string[];
  narrativePackageId?: string;
};
```

字段说明：

- `sessionMode`
  - 当前会话内容形态
- `worldContentPackId`
  - 基础地点与世界元素内容包
- `characterPackId`
  - 基础角色内容包
- `enabledSceneIds`
  - 本局启用的地点集合
- `enabledCharacterIds`
  - 本局启用的角色集合
- `enabledSecretIds`
  - 本局启用的秘密集合
- `enabledBaseEventTemplateIds`
  - freeform 与 narrative 共用的基础事件模板
- `narrativePackageId`
  - narrative 模式下的剧情包标识；freeform 下为空

### 3.5 输出结构

```ts
type SessionNarrativeShape = {
  sessionMode: "freeform" | "narrative";
  requiresNarrativeState: boolean;
  worldStoryCenter: "emergent_only" | "main_line_guided";
  defaultEndingChannels: ("simulation" | "narrative")[];
  activeNarrativeLineIds: string[];
};
```

### 3.6 处理流程

1. 选择世界基础包和角色包
2. 判断当前会话是否启用剧情包
3. 若未启用，则形成 `Freeform Sandbox`
4. 若启用，则读取剧情包并装配主线与支线
5. 生成统一的会话叙事形态描述
6. 把该形态描述交给世界初始化和调度系统使用

### 3.7 设计规格和约束

- 角色卡与关系种子是所有会话的最低必需内容
- `Narrative Sandbox` 不能绕过 `Freeform Sandbox` 的基础世界状态初始化
- `Freeform Sandbox` 必须仍然支持单局收束、局后总结和行为解释
- 第一版 narrative 模式默认固定 `1` 条主线
- 支线数量上限 `To be confirmed`，但必须存在上限，避免故事中心再次发散

### 3.8 与上下游的交互边界

- 上游依赖：
  - 母稿中锁定的世界定位与内容原则
  - 内容设计者提供的地点、角色、秘密和剧情配置
- 下游输出：
  - 会话模式
  - 叙事运行态是否存在
  - 默认收束通道
  - 激活中的主线/支线列表
- 不负责：
  - 角色数据库结构
  - API/编辑器协议
  - 具体剧情文案落盘形式

### 3.9 透出的接口设计

```ts
function resolveSessionNarrativeShape(
  profile: SessionNarrativeProfile
): SessionNarrativeShape
```

### 3.10 调试要求

调试视图至少应展示：

- 当前会话是 `freeform` 还是 `narrative`
- 当前会话启用了哪些地点、角色、秘密
- 是否存在 narrative runtime state
- narrative 模式下的主线和支线装配结果

### 3.11 示例

示例 A：只加载“酒馆-治安所-旅店”场景包与 8 张角色卡，不加载剧情包。  
系统进入 `Freeform Sandbox`，这一局主要依赖角色间旧怨、疑心和秘密传播自然长出故事。

示例 B：在相同角色包上额外挂载“失踪账本”主线与“医生债务”“车站目击”支线。  
系统进入 `Narrative Sandbox`，这一局仍由角色驱动，但“失踪账本”会成为更容易升温的故事中心。

### 3.12 待处理的问题

- 是否允许在同一世界基础包上切换多个主线主题包，`To be confirmed`
- 是否允许 narrative 模式下完全不装配支线，`To be confirmed`

## 4. 内容配置模型

### 4.1 设计目标

本子部分负责定义开发者应配置哪些核心对象，才能同时支撑 freeform 涌现与 narrative 导向，并避免后续把内容硬编码进流程。

### 4.2 设计原则

- 内容对象应最小但可组合
- 角色内容与剧情内容解耦
- 主线与支线复用统一模型
- 事件与结局尽量模板化
- 对象字段以“能驱动系统”为准，而不是写作简介

### 4.3 设计思路

第一版采用以下五类核心内容对象：

1. `CharacterCard`
   - 定义角色可进入仿真的最小单元
2. `RelationshipSeed`
   - 定义角色之间高张力初始关系
3. `NarrativeLine`
   - 定义主线或支线的阶段结构、事件候选和收束方向
4. `EventTemplate`
   - 定义可复用关键事件模板
5. `EndingTemplate`
   - 定义可复用收束模板

其中：

- `CharacterCard + RelationshipSeed` 足以支撑 `Freeform Sandbox`
- `NarrativeLine + EventTemplate + EndingTemplate` 构成 `Narrative Sandbox` 的叠加层

### 4.4 输入结构

```ts
type CharacterCard = {
  characterId: string;
  displayName: string;
  roleType: string;
  publicPersona: string;
  coreDrives: string[];
  longTermGoals: string[];
  shortTermPressures: string[];
  ownedSecretIds: string[];
  initialRelationTags: string[];
  conflictStyle: string;
  riskTolerance: "low" | "medium" | "high";
  narrativeTags: string[];
  eligibleLineRoles: string[];
};

type RelationshipSeed = {
  relationshipId: string;
  sourceCharacterId: string;
  targetCharacterId: string;
  relationType: string;
  publicOrHidden: "public" | "hidden";
  intensity: number;
  stability: "stable" | "volatile";
  sharedHistory: string;
  volatileTriggers: string[];
};

type NarrativeLine = {
  lineId: string;
  title: string;
  lineType: "main" | "side";
  summary: string;
  themeTags: string[];
  requiredTags: string[];
  optionalTags: string[];
  roleSlots: NarrativeRoleSlot[];
  stages: NarrativeStage[];
  eventPool: NarrativeEventBinding[];
  candidateEndingIds: string[];
  failureEndingIds: string[];
};
```

### 4.5 输出结构

```ts
type NarrativeContentBundle = {
  characterCards: CharacterCard[];
  relationshipSeeds: RelationshipSeed[];
  narrativeLines: NarrativeLine[];
  eventTemplates: EventTemplateRef[];
  endingTemplates: EndingTemplateRef[];
};
```

### 4.6 处理流程

1. 内容设计者先定义地点、角色卡和关系种子
2. 若只支持 freeform，则到此即可形成可运行内容包
3. 若需要 narrative 模式，再定义主线与支线的 `NarrativeLine`
4. 把关键事件与候选结局抽取为模板
5. 通过标签、职责槽位和兼容条件，把角色内容与剧情内容连接起来

### 4.7 设计规格和约束

#### 4.7.1 CharacterCard

- 必须包含公开身份、长期目标、短期压力、秘密、行为倾向和剧情兼容标签
- 不能把角色写成“只存在于某条主线中的脚本角色”
- 必须能独立支撑 freeform 局

#### 4.7.2 RelationshipSeed

- 必须表达可被放大的关系张力，而不是一次性摘要
- 必须可被 freeform 和 narrative 共同消费

#### 4.7.3 NarrativeLine

- 主线与支线共用统一对象，靠 `lineType` 区分
- 每条线至少包含阶段、角色槽位、事件池和候选收束
- 第一版采用中约束，不允许把绝大多数关键节点写成强制串行脚本

#### 4.7.4 EventTemplate / EndingTemplate

- 应尽量被多条线复用
- 不得绕过统一事件结算链路直接写入世界事实

### 4.8 与上下游的交互边界

- 上游依赖：
  - 世界设定与主题边界
  - 内容设计者提供的角色与剧情草案
- 下游输出：
  - 可装配内容包
  - 角色与剧情兼容规则
  - 关键事件和收束模板引用
- 不负责：
  - 具体数据库字段类型
  - 编辑器 UI
  - 最终文案润色策略

### 4.9 【按需追加章节】对象职责映射

| Object | Primary responsibility | Required in freeform | Required in narrative |
| --- | --- | --- | --- |
| `CharacterCard` | 提供可仿真的角色主体 | Yes | Yes |
| `RelationshipSeed` | 提供初始社会张力 | Yes | Yes |
| `NarrativeLine` | 定义主线或支线叙事骨架 | No | Yes |
| `EventTemplate` | 提供可复用关键事件模板 | Yes | Yes |
| `EndingTemplate` | 提供通用或专属收束模板 | Yes | Yes |

### 4.10 透出的接口设计

```ts
function buildNarrativeContentBundle(
  inputs: NarrativeContentBundle
): NarrativeContentBundle
```

### 4.11 调试要求

调试视图至少应支持：

- 查看某张角色卡的 narrative tags 与 eligible roles
- 查看某条关系种子的强度与触发条件
- 查看某条剧情线的 stage、event pool、candidate endings
- 追踪某个事件模板被哪些剧情线引用

### 4.12 示例

示例：

- `CharacterCard(doctor)`
  - `roleType = healer`
  - `coreDrives = ["protect reputation", "hide debt"]`
  - `eligibleLineRoles = ["keeper", "witness"]`
- `NarrativeLine(missing_ledger_main)`
  - `lineType = main`
  - `roleSlots = ["keeper", "suspect", "witness"]`
  - 当 `doctor` 拥有 `keeper` 兼容标签时，可以进入该主线，但并不会因此失去 freeform 下的独立行为能力

### 4.13 待处理的问题

- `NarrativeLine` 中 stage 数量的默认上限，`To be confirmed`
- `EventTemplate` 是否需要显式区分“玩家可见事件”和“纯后台事件”，`To be confirmed`

## 5. 开局装配与运行态

### 5.1 设计目标

本子部分负责把内容对象转成一局真正可运行的世界状态，明确 freeform 与 narrative 如何共用同一初始化骨架，而不是分叉成两套系统。

### 5.2 设计原则

- 开局装配必须统一
- narrative 运行态是可选扩展槽，而不是另一套核心状态
- 装配结果必须可序列化、可回放
- 剧情线装配只发生在局前，不在运行中动态热插拔

### 5.3 设计思路

统一装配流程如下：

1. 加载世界基础包
2. 加载角色卡、关系种子、秘密和基础事件模板
3. 按随机种子生成初始角色实例和关系扰动
4. 若为 freeform，则直接生成会话状态
5. 若为 narrative，则先固定装配 `1` 条主线，再按条件抽取若干支线
6. 把剧情线的角色槽位映射到实际角色
7. 生成 narrative runtime state，并与基础世界状态一起落入会话快照

关键点：

- narrative 运行态可以为空
- narrative 为空时，世界仍然完整可运行
- 两种模式共用同一事件系统和收束系统，只是 narrative 额外提供偏置与候选

### 5.4 输入结构

```ts
type SessionAssemblyInput = {
  sessionSeed: string;
  narrativeProfile: SessionNarrativeProfile;
  contentBundle: NarrativeContentBundle;
  playerStartSceneId: string;
};

type NarrativeAssemblyResult = {
  mainLineId: string;
  sideLineIds: string[];
  roleAssignments: {
    lineId: string;
    slotId: string;
    characterId: string;
  }[];
};
```

### 5.5 输出结构

```ts
type SessionAssemblyOutput = {
  sessionId: string;
  sessionMode: "freeform" | "narrative";
  worldStateSnapshotId: string;
  activeCharacterIds: string[];
  activeRelationshipIds: string[];
  activeBaseEventTemplateIds: string[];
  narrativeState: NarrativeRuntimeState | null;
};
```

### 5.6 处理流程

1. 根据 `sessionSeed` 选定本局角色、秘密与关系扰动
2. 写入基础世界状态
3. 若 `sessionMode = freeform`，则令 `narrativeState = null`
4. 若 `sessionMode = narrative`，执行主线装配
5. 基于主线条件和角色兼容性抽取支线
6. 完成角色槽位匹配
7. 生成 narrative runtime state
8. 输出统一会话快照

### 5.7 设计规格和约束

- 主线装配失败时，本局不得继续以 narrative 模式运行
- 支线装配失败不应阻断整局开始，可降级为仅主线
- narrative runtime state 必须可序列化
- 不允许在运行中新增未通过初始化校验的主线
- 支线抽取规则至少应考虑：
  - 主线主题兼容性
  - 角色槽位兼容性
  - 地点覆盖度
  - 与已选支线的互斥关系

### 5.8 与上下游的交互边界

- 上游依赖：
  - 内容包
  - 随机种子
  - 玩家起始场景
- 下游输出：
  - 世界初始快照
  - narrative runtime state
  - 调度器可消费的活跃线列表
- 不负责：
  - 运行中 tick 推进
  - NPC 认知阶段执行

### 5.9 【按需追加章节】Narrative Runtime State

```ts
type NarrativeRuntimeState = {
  mainLine: {
    lineId: string;
    currentStageId: string;
    stageEnteredAtTick: number;
  };
  sideLines: {
    lineId: string;
    state: "inactive" | "active" | "resolved" | "failed";
    currentStageId?: string;
  }[];
  roleAssignments: {
    lineId: string;
    slotId: string;
    characterId: string;
  }[];
  pendingNarrativeEventIds: string[];
  candidateEndingIds: string[];
};
```

### 5.10 透出的接口设计

```ts
function assembleSessionState(
  input: SessionAssemblyInput
): SessionAssemblyOutput
```

### 5.11 调试要求

调试视图至少应展示：

- 本局装配使用的随机种子
- 当前主线和支线装配结果
- 每个剧情线槽位被哪个角色占用
- narrative runtime state 是否为空
- 支线为何被选中或被排除

### 5.12 示例

示例：

1. 系统读取主线 `missing_ledger_main`
2. 匹配到 `keeper = doctor`、`suspect = sheriff`、`witness = station_clerk`
3. 再从支线池中选入 `doctor_debt_side` 和 `bar_rumor_side`
4. 若 `railway_blackmail_side` 与当前主线冲突，则被排除
5. 输出统一会话快照，供世界调度器从 `worldTick = 0` 开始运行

### 5.13 待处理的问题

- 支线抽取算法是否需要显式评分公式，`To be confirmed`
- 同一角色承担多个剧情线槽位的上限，`To be confirmed`

## 6. 剧情线接入 worldTick

### 6.1 设计目标

本子部分负责定义剧情线如何接入世界推进、调度与事件层，同时保证 NPC 的行为仍由自身身份、记忆、关系和目标决定，而不是被剧情线直接操纵。

### 6.2 设计原则

- 剧情线提供压力，不提供命令
- worldTick 是唯一有效推进入口
- 关键事件是候选，不是必经脚本
- 叙事偏置只能通过规则层传导
- 同一世界事实只允许通过统一结算链路写入

### 6.3 设计思路

第一版在每个 `worldTick` 外挂一层轻量叙事覆盖：`Narrative Context Overlay`。

它只输出四类偏置：

- `attentionBias`
  - 哪些角色、地点、关系、秘密更值得进入当前视野
- `eventBias`
  - 哪些剧情相关关键事件更容易进入候选池
- `pressureBias`
  - 哪些怀疑、时间或社会压力正在上升
- `endingBias`
  - 哪些结局方向正在变得更可达

叙事偏置的作用路径是：

`NarrativeRuntimeState -> Narrative Context Overlay -> Scheduler / Event Candidate Builder -> Act -> World Event`

而不是：

`NarrativeRuntimeState -> 直接命令 NPC`

### 6.4 输入结构

```ts
type NarrativeOverlayInput = {
  worldTick: number;
  sessionMode: "freeform" | "narrative";
  narrativeState: NarrativeRuntimeState | null;
  recentEventWindow: WorldEventRef[];
  foregroundNpcIds: string[];
  nearFieldNpcIds: string[];
};
```

### 6.5 输出结构

```ts
type NarrativeContextOverlay = {
  attentionBiases: NarrativeAttentionBias[];
  eventBiases: NarrativeEventBias[];
  pressureBiases: NarrativePressureBias[];
  endingBiases: NarrativeEndingBias[];
};
```

### 6.6 处理流程

1. 每个 `worldTick` 开始前读取 narrative runtime state
2. 若当前为 freeform，则输出空 overlay
3. 若当前为 narrative，则根据主线/支线 stage 生成 overlay
4. 调度器利用 `attentionBiases` 调整前台和近场排序
5. 事件候选构造器利用 `eventBiases` 调整候选事件权重
6. 世界按统一规则完成 `Act -> World Event`
7. tick 结束后，用已发生事件推进 narrative runtime state

### 6.7 设计规格和约束

- `No Direct Command`
  - 剧情线不得直接命令 NPC 执行具体动作
- `No Fact Injection`
  - 剧情线不得绕过事件结算直接写入世界事实
- `No Motivation Override`
  - 剧情线不得覆盖 NPC 的长期目标、禁忌和社交信念
- `No Mandatory Beat`
  - 除结局判定外，剧情线中的关键事件默认都只是候选

进一步约束：

- 若无合格角色动机或前置条件，剧情事件必须允许自然失效
- overlay 只能加权，不能强制某 NPC 获得完整链路资格
- 叙事偏置不得让 NPC 凭空知道自己未感知的信息

### 6.8 与上下游的交互边界

- 上游依赖：
  - narrative runtime state
  - 最近事件窗口
  - 当前前台/近场 NPC 集合
- 下游输出：
  - 调度偏置
  - 关键事件候选加权
  - 收束倾向加权
- 不负责：
  - NPC 认知阶段内部推理
  - 自然语言台词生成
  - 事件最终合法性校验

### 6.9 【按需追加章节】阶段推进规则

每条剧情线的 stage 推进至少经过以下判定：

1. 当前 stage 的退出条件是否满足
2. 是否存在阻塞条件
3. 是否触发失败收束
4. 是否应切换到下一 stage
5. 是否需要刷新 `eventPool` 与 `candidateEndingIds`

第一版不要求所有 stage 都线性前进，但必须有可解释的状态跃迁记录。

### 6.10 透出的接口设计

```ts
function buildNarrativeContextOverlay(
  input: NarrativeOverlayInput
): NarrativeContextOverlay

function advanceNarrativeRuntimeState(
  state: NarrativeRuntimeState,
  recentEvents: WorldEventRef[]
): NarrativeRuntimeState
```

### 6.11 调试要求

调试视图至少应展示：

- 当前主线与支线 stage
- 本 tick 产生了哪些 attention/event/pressure/ending bias
- 哪些剧情事件进入候选池、哪些被过滤
- 某条 stage 为什么推进、停滞或失败

### 6.12 示例

示例：

- 主线当前处于 `suspicion_spreading`
- overlay 生成：
  - `attentionBias`: 提高酒馆、车站文员、治安官的排序
  - `eventBias`: 提高“旁听失言”“转交伪证”“公开试探”的候选权重
  - `pressureBias`: 提高“对治安官的不信任”环境压力
- 但如果车站文员当前不在前台、也没有相关感知基础，则该 NPC 不会被强制做出泄密行为

### 6.13 待处理的问题

- `pressureBias` 是否需要显式拆成社会压力、时间压力和资源压力三类，`To be confirmed`
- 是否需要给支线定义独立的中断优先级，`To be confirmed`

## 7. 收束、调试与扩展边界

### 7.1 设计目标

本子部分负责定义 freeform 与 narrative 两种会话如何共用收束和调试框架，并为后续 schema/API/内容扩展留出稳定边界。

### 7.2 设计原则

- 所有会话都必须可收束
- 收束逻辑先世界后叙事，但 narrative 可额外提供候选
- 调试结构必须统一
- 扩展内容优先复用对象模型，不优先新增流程分支

### 7.3 设计思路

第一版采用双通道收束：

1. `Simulation Ending`
   - 来源于世界自然状态
   - 例如时间耗尽、关系断裂、秘密全面扩散、强干预结局、脆弱平衡达成

2. `Narrative Ending`
   - 仅 narrative 模式存在
   - 来源于主线/支线定义的候选收束
   - 例如“账本真相被谁控制”“谁成为替罪羊”“谁失去镇上话语权”

判定原则：

- freeform 模式只检查 `Simulation Ending`
- narrative 模式同时检查 `Simulation Ending` 与 `Narrative Ending`
- 若两者同时满足，优先级规则 `To be confirmed`

### 7.4 输入结构

```ts
type EndingResolutionInput = {
  sessionMode: "freeform" | "narrative";
  worldStateSnapshotId: string;
  narrativeState: NarrativeRuntimeState | null;
  recentEventWindow: WorldEventRef[];
};
```

### 7.5 输出结构

```ts
type EndingResolutionOutput = {
  hasResolved: boolean;
  resolvedEndingType?: "simulation" | "narrative";
  endingTemplateId?: string;
  endingReasonSummary: string;
  keyCharacterOutcomeRefs: {
    characterId: string;
    outcomeTag: string;
  }[];
};
```

### 7.6 处理流程

1. 每个 tick 末尾检查世界自然收束条件
2. 若为 freeform，直接尝试输出 `Simulation Ending`
3. 若为 narrative，再检查 narrative runtime state 中的候选收束
4. 若命中结局，生成局后摘要、角色命运摘要与玩家影响总结
5. 将 narrative runtime、recent events、ending reason 一并写入复盘数据

### 7.7 设计规格和约束

- `Freeform Sandbox` 不得因缺少剧情线而缺少可判定结局
- `Narrative Ending` 不得绕过世界事实成立
- 局后总结必须能解释：
  - 为什么结束
  - 谁受到关键影响
  - 玩家如何改变了局势
- 调试结构必须统一展示：
  - 当前 narrative state
  - 当前 ending pressure
  - 关键事件链
  - 秘密传播路径

### 7.8 与上下游的交互边界

- 上游依赖：
  - 世界状态快照
  - 最近事件窗口
  - narrative runtime state
- 下游输出：
  - 结局判定结果
  - 局后总结输入
  - 回放所需摘要
- 不负责：
  - 局后文本最终文风渲染
  - 存档物理落盘细节

### 7.9 【按需追加章节】后续拆分建议

本文之后建议继续拆分以下专题文档：

- `内容 schema 与装配规则`
- `具体首批主线/支线内容包设计`
- `freeform 局收束阈值与 ending pressure 规则`
- `narrative ending 与 simulation ending 冲突规则`

### 7.10 透出的接口设计

```ts
function resolveSessionEnding(
  input: EndingResolutionInput
): EndingResolutionOutput
```

### 7.11 调试要求

调试视图至少应支持：

- 对比 freeform 与 narrative 两种会话的 ending pressure 演进
- 查看某一局为何没有触发 narrative ending
- 查看某个局后摘要引用了哪些事件与命运变化
- 回放某个剧情线 stage 的进入、停留与退出历史

### 7.12 示例

示例 A：freeform 局中，酒馆老板与治安官关系彻底断裂、秘密扩散到多数核心角色、玩家公开站队后局势不可逆，命中 `Simulation Ending: fragile_order_collapse`。

示例 B：narrative 局中，主线“失踪账本”已进入最终 stage，账本被医生掌控并公开嫁祸给治安官，同时满足世界事实条件，于是命中 `Narrative Ending: false_justice_resolution`。

### 7.13 待处理的问题

- `fragile balance` 是否应作为 freeform 专属收束类型，`To be confirmed`
- narrative 局未命中主线结局时，是否需要优先输出“主线失败结局”，`To be confirmed`
