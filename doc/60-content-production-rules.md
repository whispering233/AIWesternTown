# 内容生产规则与自动校验设计

## 1. Document Overview

| Item | Content |
| --- | --- |
| Document title | `AIWesternTown content production rules solution` |
| Business goal | 为第一版内容包建立稳定、可复用、可自动校验的生产规则，使角色、秘密、事件、结局和文本内容能够被手写工具或生成工具统一产出，并在不依赖人工审核的前提下接入世界装配。 |
| Scope | 覆盖 `CharacterCard`、`SecretTemplate`、`EventTemplate`、`EndingTemplate`、文本模板的生产边界，内容包最小骨架，自动校验规则，装配前检查，以及失败降级与调试要求。 |
| Non-goals | 不展开完整 schema 字段明细；不覆盖数据库表设计、REST/API 契约、编辑器 UI；不定义首批具体角色与剧情文案；不引入人工审校流程；不重写运行时事件结算、Prompt Builder 或 LLM provider 细节。 |
| Target readers | 世界与内容设计者、内容工具实现者、装配器实现者、LLM 内容生成链路实现者、调试工具实现者。 |
| Assumptions | 母稿已锁定“双层内容系统 + 单一世界运行内核”；运行时继续遵守“规则主导，LLM 附着”；物品模板与容器模板由 [43-item-schema-and-content-config.md](C:/codex/project/AIWesternTown/doc/43-item-schema-and-content-config.md) 单独承接；文本渲染不得反向定义事实。 |

## 2. Solution Overview

| Item | Content |
| --- | --- |
| Solution summary | 第一版采用“统一内容对象骨架 + 纯规则校验主导”的方案。无论内容来源于人工撰写、脚本生成还是 LLM 草拟，进入世界内容包前都必须经过同一套对象职责检查、禁止项检查、引用完整性检查和装配前预检。 |
| Sub-parts or sub-flows | `内容对象分层与生产边界`、`角色与秘密生产规则`、`事件与结局模板生产规则`、`文本模板与可见表现规则`、`自动校验与装配前检查`、`失败降级与调试要求` |
| Key design decisions | 不设置人工审核为必经环节；生产规则先于具体文案；对象只定义可驱动系统的信息，不承载脚本式流程；LLM 生成内容不享有特权，和手写内容共用一套校验；文本永远消费已定结果，不反向发明世界事实。 |
| Overall constraints | 不能把角色写成主线傀儡；不能让秘密对象只剩文学描述而没有系统后果；不能让事件模板绕过统一事件结算链路；不能让文本模板输出新的事实、关系或结果；不能让内容包通过局前装配覆盖模板能力边界。 |
| Dependencies | [00-master-design.md](C:/codex/project/AIWesternTown/doc/00-master-design.md)、[10-world-and-narrative.md](C:/codex/project/AIWesternTown/doc/10-world-and-narrative.md)、[30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md)、[40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md)、[43-item-schema-and-content-config.md](C:/codex/project/AIWesternTown/doc/43-item-schema-and-content-config.md)、[50-llm-integration.md](C:/codex/project/AIWesternTown/doc/50-llm-integration.md)、[51-prompt-builder-contract.md](C:/codex/project/AIWesternTown/doc/51-prompt-builder-contract.md) |
| Risks and open confirmation items | 首批标签表与枚举仍需收敛；秘密传播提示是否要独立成模板对象仍待确认；文本模板的默认长度上限需要结合 UI 实测；是否需要为内容校验器输出更细的修复建议仍为 `To be confirmed`。 |

## 3. 内容对象分层与生产边界

### 3.1 设计目标

本子部分负责定义“哪些内容对象可以被生产”和“每类对象对系统负责什么”，避免后续把内容规则、运行时状态和文案润色混成一层。

### 3.2 设计原则

- 生产对象先服务系统驱动，再服务写作表达
- 对象职责必须单一且清晰
- 运行时真相、认知和可见文本必须分层
- 内容来源无差别，统一走规则校验

### 3.3 设计思路

第一版内容生产聚焦五类对象：

1. `CharacterCard`
   - 定义一个角色进入仿真所需的最小可玩人格骨架
2. `SecretTemplate`
   - 定义会影响目标、关系、风险和传播的隐藏事实类型
3. `EventTemplate`
   - 定义可复用的关键事件候选，不直接等于已发生事件
4. `EndingTemplate`
   - 定义可复用的收束方向与总结通道
5. `TextTemplate`
   - 定义受限文本表现规则，只消费已定结果 DTO

内容生产对象与运行时对象的边界：

- 生产对象只声明：
  - 角色动力
  - 冲突来源
  - 兼容条件
  - 可见表现约束
- 运行时对象负责：
  - 当前世界真相
  - 当前记忆与关系变化
  - tick 内事件结果
  - 最终玩家可见反馈

### 3.4 输入结构

```ts
type ContentProductionBundleV1 = {
  characterCards: CharacterCardProductionSpec[];
  secretTemplates: SecretTemplateProductionSpec[];
  eventTemplates: EventTemplateProductionSpec[];
  endingTemplates: EndingTemplateProductionSpec[];
  textTemplates: TextTemplateProductionSpec[];
};

type CharacterCardProductionSpec = {
  characterId: string;
  publicPersona: string;
  coreDrives: string[];
  longTermGoals: string[];
  shortTermPressures: string[];
  ownedSecretIds: string[];
  narrativeTags: string[];
  eligibleLineRoles: string[];
  speechProfile: string[];
};

type SecretTemplateProductionSpec = {
  secretId: string;
  truthSummary: string;
  ownerCharacterIds: string[];
  exposureRiskTags: string[];
  revealImpactTags: string[];
  propagationHints: string[];
};

type EventTemplateProductionSpec = {
  eventTemplateId: string;
  eventKind: string;
  requiredActorTags: string[];
  requiredContextTags: string[];
  outputEventTags: string[];
  visibleOutcomeChannel: string;
};

type EndingTemplateProductionSpec = {
  endingTemplateId: string;
  endingKind: string;
  requiredOutcomeTags: string[];
  resolutionTone: string;
};

type TextTemplateProductionSpec = {
  templateId: string;
  templateKind: string;
  requiredInputs: string[];
  forbiddenFactTypes: string[];
  toneTags: string[];
  maxLength: number;
};
```

### 3.5 输出结构

```ts
type ValidatedContentProductionBundleV1 = ContentProductionBundleV1 & {
  validationSummary: {
    errors: string[];
    warnings: string[];
    objectCounts: {
      characterCards: number;
      secretTemplates: number;
      eventTemplates: number;
      endingTemplates: number;
      textTemplates: number;
    };
  };
};
```

### 3.6 处理流程

1. 读取内容对象原始输入
2. 校验对象类型是否齐全且命名稳定
3. 校验对象职责是否越界
4. 校验跨对象引用是否闭合
5. 输出可装配 bundle 与校验报告

### 3.7 设计规格和约束

- 对象命名统一使用稳定 ID，不允许同义别名并存
- 同一条信息只能有一个主承载对象
- `TextTemplate` 不得替代 `EventTemplate` 定义行为结果
- `SecretTemplate` 不得替代 `CharacterCard` 定义角色长期目标
- `EventTemplate` 不得替代 `EndingTemplate` 定义终局总结

### 3.8 与上下游的交互边界

- 上游依赖：
  - 世界主题边界
  - 角色与剧情对象池
  - 已定义的标签与枚举表
- 下游输出：
  - 可供装配器读取的内容包
  - 可供校验器执行的检查目标
  - 可供调试视图展示的对象关系
- 不负责：
  - 运行时实例化
  - LLM 消息编译
  - 世界状态写入

### 3.9 透出的接口设计

```ts
function validateContentProductionBundle(
  bundle: ContentProductionBundleV1
): ValidatedContentProductionBundleV1
```

### 3.10 调试要求

调试视图至少展示：

- 每类内容对象数量
- 哪个对象缺少最低必需骨架
- 哪些引用未闭合
- 哪些对象触发了越界禁止项

### 3.11 示例

示例：

- `doctor` 角色卡声明：
  - `coreDrives = ["protect reputation", "hide debt"]`
  - `ownedSecretIds = ["doctor_debt_secret"]`
- `doctor_debt_secret` 声明：
  - `revealImpactTags = ["trust_drop", "blackmail_risk"]`

这里说明：

- “医生欠债”作为秘密对象负责后果标签
- “保护声誉”作为角色对象负责驱动力
- 两者相关，但不混写成一个对象

### 3.12 待处理的问题

- `speechProfile` 是否应进一步拆成专门的说话风格对象，`To be confirmed`

## 4. 角色与秘密生产规则

### 4.1 设计目标

本子部分负责定义第一版如何生产“能独立驱动 freeform 的角色”和“能稳定带来风险与传播的秘密”。

### 4.2 设计原则

- 角色必须先能脱离主线成立
- 秘密必须能改变行为，不只是设定说明
- 角色与秘密之间是关联关系，不是相互替代
- 所有描述都应支持自动检查

### 4.3 设计思路

`CharacterCard` 的核心任务不是写人物小传，而是回答四个系统问题：

1. 这个角色平时想维持什么
2. 这个角色当前最怕失去什么
3. 这个角色会因什么压力改变行为
4. 这个角色能进入哪些剧情兼容槽位

`SecretTemplate` 的核心任务不是写“惊人反转”，而是回答四个系统问题：

1. 这条隐藏事实属于谁或影响谁
2. 暴露后会改变哪些关系或风险
3. 它通常通过哪些场景或行为泄露
4. 它应触发哪些事件与结局候选

### 4.4 输入结构

```ts
type CharacterCardProductionChecklist = {
  requiresPublicPersona: true;
  requiresCoreDrives: true;
  requiresLongTermGoals: true;
  requiresShortTermPressures: true;
  requiresNarrativeCompatibility: true;
};

type SecretTemplateProductionChecklist = {
  requiresOwnerOrAffectedActors: true;
  requiresTruthSummary: true;
  requiresRevealImpactTags: true;
  requiresPropagationHints: true;
};
```

### 4.5 输出结构

```ts
type CharacterSecretValidationResult = {
  acceptedCharacterIds: string[];
  acceptedSecretIds: string[];
  rejectedCharacterIds: string[];
  rejectedSecretIds: string[];
  warnings: string[];
};
```

### 4.6 处理流程

1. 校验角色是否具备公开身份、动力、压力、秘密挂点和剧情兼容信息
2. 校验秘密是否具备归属、暴露影响和传播提示
3. 检查角色引用的秘密是否真实存在
4. 检查秘密是否能回连到至少一个角色、关系或事件后果

### 4.7 设计规格和约束

#### 4.7.1 CharacterCard

- 必须能单独支撑 freeform 局中的持续行为
- 必须至少包含一个“维持型目标”和一个“压力型目标”
- 不允许把角色写成只能在某条主线 stage 下才有行动理由
- `narrativeTags` 与 `eligibleLineRoles` 只能表达兼容性，不能表达强制归属
- `speechProfile` 只能描述表达倾向，不能定义事实权限

#### 4.7.2 SecretTemplate

- 必须具备明确的事实摘要，不能只写“有不可告人的过去”
- 必须至少声明一种暴露后果标签
- 必须至少声明一种可触发或可放大的传播提示
- 不允许用秘密直接定义具体台词或固定剧情顺序
- 若秘密涉及物品、地点或目击关系，必须引用外部对象 ID，而不是自由文本硬写

### 4.8 与上下游的交互边界

- 上游依赖：
  - 世界设定中的角色池
  - 已定义的地点、物品与关系 ID
- 下游输出：
  - freeform 可消费的角色驱动力
  - narrative 可消费的槽位兼容信息
  - 事件与结局可消费的秘密后果标签
- 不负责：
  - 运行时记忆写入
  - 关系数值公式

### 4.9 透出的接口设计

```ts
function validateCharacterAndSecretProduction(
  characters: CharacterCardProductionSpec[],
  secrets: SecretTemplateProductionSpec[]
): CharacterSecretValidationResult
```

### 4.10 调试要求

调试视图至少支持：

- 查看某角色缺了哪类驱动力信息
- 查看某秘密缺了哪些后果标签
- 查看角色与秘密的双向引用关系
- 标记“只能靠主线存在”的角色设计

### 4.11 示例

合格示例：

- `bartender`
  - `publicPersona = "calm host"`
  - `longTermGoals = ["keep saloon neutral"]`
  - `shortTermPressures = ["sheriff questions recent rumor"]`
- `rumor_source_secret`
  - `truthSummary = "bartender heard who hid the ledger"`
  - `revealImpactTags = ["suspicion_shift", "witness_value_up"]`

不合格示例：

- 角色描述只有“他在主线后半段会背叛医生”
- 秘密描述只有“她藏着一个大秘密”

### 4.12 待处理的问题

- 是否需要限制单角色挂载秘密数量上限，`To be confirmed`

## 5. 事件与结局模板生产规则

### 5.1 设计目标

本子部分负责定义事件模板和结局模板应如何被生产，既保证 narrative 有中心，又不把运行时变成脚本执行器。

### 5.2 设计原则

- 事件模板提供候选，不直接宣布发生
- 结局模板提供收束通道，不直接强推命中
- 模板优先复用，不为单条线过度定制
- 所有后果都通过统一事件结算链路落地

### 5.3 设计思路

`EventTemplate` 应表达：

- 适合在哪类上下文中进入候选池
- 哪类角色更可能触发或卷入
- 它会产出哪些标准事件标签
- 它偏向哪种可见表现通道

`EndingTemplate` 应表达：

- 它需要哪些累积结果标签才有资格命中
- 命中后生成哪种总结方向
- 它属于世界型收束还是叙事型收束

### 5.4 输入结构

```ts
type EventTemplateProductionRule = {
  requiresPreconditions: true;
  requiresActorCompatibility: true;
  requiresOutputEventTags: true;
  requiresVisibilityChannel: true;
};

type EndingTemplateProductionRule = {
  requiresOutcomeTags: true;
  requiresResolutionTone: true;
  requiresEndingKind: true;
};
```

### 5.5 输出结构

```ts
type EventEndingValidationResult = {
  acceptedEventTemplateIds: string[];
  acceptedEndingTemplateIds: string[];
  rejectedTemplateIds: string[];
  warnings: string[];
};
```

### 5.6 处理流程

1. 校验事件模板是否具备上下文前提和角色兼容描述
2. 校验事件模板是否只声明标准输出标签，不偷写最终状态
3. 校验结局模板是否只引用结果标签和收束语气
4. 检查剧情线引用是否都能解析到有效模板

### 5.7 设计规格和约束

#### 5.7.1 EventTemplate

- 不允许直接包含“某角色必定执行某动作”的硬指令
- 不允许直接包含世界状态 patch
- 允许声明：
  - 前置标签
  - 候选角色条件
  - 输出事件标签
  - 可见表现通道
- 必须能被多条线复用时仍保持语义稳定

#### 5.7.2 EndingTemplate

- 不允许直接绑定单一剧情线 stage 作为唯一命中依据
- 必须基于可解释的结果标签命中
- 必须能区分“世界自然收束”和“叙事导向收束”
- 必须给局后总结系统提供明确的结果方向标签

### 5.8 与上下游的交互边界

- 上游依赖：
  - 剧情线骨架
  - 标准事件标签与结局标签
- 下游输出：
  - 事件候选池引用
  - 收束判定候选
  - 局后总结方向
- 不负责：
  - tick 内排序与调度
  - 强打断时机
  - 最终文本渲染

### 5.9 透出的接口设计

```ts
function validateEventAndEndingTemplates(
  events: EventTemplateProductionSpec[],
  endings: EndingTemplateProductionSpec[]
): EventEndingValidationResult
```

### 5.10 调试要求

调试视图至少展示：

- 某事件模板被哪些剧情线引用
- 某结局模板依赖哪些结果标签
- 哪个模板因越权描述被拒绝
- 哪个模板因引用空标签集而不可装配

### 5.11 示例

合格事件模板：

- `public_confrontation`
  - `requiredContextTags = ["public_scene", "mutual_suspicion"]`
  - `outputEventTags = ["suspicion_spike", "reputation_risk"]`

不合格事件模板：

- “治安官在此 stage 必须逮捕医生并没收账本”

合格结局模板：

- `false_justice_resolution`
  - `requiredOutcomeTags = ["wrong_accusation_locked", "public_acceptance"]`

### 5.12 待处理的问题

- 是否需要为 `EventTemplate` 区分“后台事件候选”和“玩家可见事件候选”，`To be confirmed`

## 6. 文本模板与可见表现规则

### 6.1 设计目标

本子部分负责定义第一版文本内容如何生产，确保可见文本永远是已定结果的表现层，而不是新的规则来源。

### 6.2 设计原则

- 文本只渲染，不裁定
- 文本来源无差别，统一走同一校验
- 文本必须保留角色区分度，但不能污染事实层
- 模板渲染应支持无 LLM 降级

### 6.3 设计思路

第一版文本对象分为两类：

1. `模板化文本`
   - 由固定模板和插槽生成
   - 作为最低保底路径
2. `受限生成文本`
   - 基于已定 DTO 由 LLM 或生成器生成
   - 作为增强路径

两类文本共用同一生产规则：

- 输入必须是已定结果 DTO
- 输出必须受最大长度、语气标签和禁止事实类型约束
- 不允许在文本中发明：
  - 新物品位置
  - 新关系结论
  - 新事件结果
  - 新秘密真相

### 6.4 输入结构

```ts
type VisibleTextRenderInput = {
  templateKind: "visible_outcome" | "npc_dialogue" | "summary_line";
  resolvedFacts: string[];
  styleTags: string[];
  toneTags: string[];
  maxLength: number;
};

type TextTemplateRule = {
  requiredInputs: string[];
  forbiddenFactTypes: string[];
  toneTags: string[];
  maxLength: number;
};
```

### 6.5 输出结构

```ts
type TextTemplateValidationResult = {
  acceptedTemplateIds: string[];
  rejectedTemplateIds: string[];
  warnings: string[];
};
```

### 6.6 处理流程

1. 校验文本模板是否声明输入要求与禁止项
2. 校验模板是否存在无 LLM 保底路径
3. 生成文本后检查长度、占位符闭合和禁止事实类型
4. 若失败则回退到模板化短文本

### 6.7 设计规格和约束

- 所有文本模板都必须绑定 `templateKind`
- 所有文本模板都必须声明 `maxLength`
- `npc_dialogue` 不得通过台词新增状态结论
- `visible_outcome` 不得改写动作成败
- `summary_line` 不得发明未命中的结局理由
- LLM 生成文本和手写模板文本共享同一套禁止事实类型检查
- 第一版必须允许“仅模板文本，无生成增强”仍可玩

### 6.8 与上下游的交互边界

- 上游依赖：
  - `Act` 阶段已定结果
  - `visible_outcome_render` 的输入 DTO
  - 角色表达风格标签
- 下游输出：
  - 玩家可见短文本
  - 对话行
  - 局后总结短句
- 不负责：
  - 动作合法性
  - 事实解析
  - 关系更新

### 6.9 透出的接口设计

```ts
function validateTextTemplates(
  templates: TextTemplateProductionSpec[]
): TextTemplateValidationResult
```

### 6.10 调试要求

调试视图至少支持：

- 查看某条文本渲染输入 DTO
- 标记超长文本、未闭合占位符和禁止事实类型命中
- 查看失败时命中的回退模板
- 区分“模板渲染”和“生成增强”两种来源

### 6.11 示例

合格示例：

- 输入：
  - `resolvedFacts = ["doctor refused publicly", "suspicion increased"]`
  - `styleTags = ["calm", "redirect_topic"]`
- 输出：
  - “医生压低声音，把话题轻轻拨开，周围人的怀疑却更重了。”

不合格示例：

- “医生想起账本在旅店二楼抽屉里，于是决定今晚去偷回来。”

不合格原因：

- 发明了新的记忆事实
- 发明了新的物品位置
- 发明了新的未来动作

### 6.12 待处理的问题

- `summary_line` 是否需要单独的更短长度上限，`To be confirmed`

## 7. 自动校验与装配前检查

### 7.1 设计目标

本子部分负责定义内容对象进入会话装配前的自动检查链路，确保没有人工 gate 也能稳定拦截高风险内容。

### 7.2 设计原则

- 先拒绝明显错误，再允许进入装配
- 校验项尽量结构化，不依赖文案理解
- 校验失败不阻塞其他独立包的分析输出
- 预检结果必须可解释

### 7.3 设计思路

自动校验分为四层：

1. `骨架校验`
   - 必填字段、命名规则、枚举合法性
2. `引用校验`
   - ID 是否存在、双向关系是否闭合
3. `职责校验`
   - 是否越权声明不属于本对象的内容
4. `装配预检`
   - 是否足以构成 freeform 或 narrative 的最小可玩局

### 7.4 输入结构

```ts
type ContentAssemblyPreflightInput = {
  bundle: ContentProductionBundleV1;
  sessionMode: "freeform" | "narrative";
};
```

### 7.5 输出结构

```ts
type ContentAssemblyPreflightResult = {
  pass: boolean;
  blockingErrors: string[];
  warnings: string[];
  minimumPlayableCheck: {
    hasEnoughCharacters: boolean;
    hasEnoughTensionSources: boolean;
    hasEndingPath: boolean;
    hasRenderableTextFallback: boolean;
  };
};
```

### 7.6 处理流程

1. 执行对象层校验
2. 执行跨对象引用校验
3. 按 `sessionMode` 执行最小可玩性检查
4. 对 narrative 额外检查主线、支线、事件和结局引用闭合
5. 产出阻断项与警告项

### 7.7 设计规格和约束

- `freeform` 至少需要：
  - 可运行角色集
  - 初始张力来源
  - 至少一条收束通道
  - 文本保底模板
- `narrative` 额外至少需要：
  - `1` 条主线
  - 合法的角色槽位兼容映射
  - 至少一个可引用事件模板
  - 至少一个可引用结局模板
- 校验器必须把 `error` 与 `warning` 分开
- 校验器不得静默修复高风险越界内容

### 7.8 与上下游的交互边界

- 上游依赖：
  - 内容包原始输入
  - 会话模式
- 下游输出：
  - 是否允许装配
  - 阻断原因
  - 可展示给调试工具的预检结果
- 不负责：
  - 自动重写内容对象
  - 运行时热修复

### 7.9 透出的接口设计

```ts
function runContentAssemblyPreflight(
  input: ContentAssemblyPreflightInput
): ContentAssemblyPreflightResult
```

### 7.10 调试要求

调试面板至少展示：

- 哪条规则拦截了内容包
- 哪些警告不阻断装配
- freeform / narrative 各自缺了什么
- 校验报告与原始对象 ID 的映射

### 7.11 示例

示例 A：freeform 包只有 2 个角色、没有任何秘密或高张力关系。  
结果：`hasEnoughTensionSources = false`，阻断装配。

示例 B：narrative 包有主线，但主线引用了不存在的 `EventTemplate`。  
结果：引用校验失败，阻断 narrative 装配；若基础层完整，可降级为 freeform。

### 7.12 待处理的问题

- “最小可玩性”的角色与张力阈值是否要固定成默认数字，`To be confirmed`

## 8. 失败降级与调试要求

### 8.1 设计目标

本子部分负责定义内容生产或校验失败时系统如何降级，保证自动化流程既严格又不脆弱。

### 8.2 设计原则

- 模板失效不应污染运行时事实
- narrative 失败应优先降级，不优先崩局
- 文本生成失败应优先回退到短模板
- 失败原因必须可追溯

### 8.3 设计思路

第一版降级顺序：

1. 文本增强失败
   - 回退到模板短文本
2. 单个模板对象非法
   - 剔除该对象并记录阻断或警告
3. narrative 装配失败
   - 若基础层完整，则降级为 freeform
4. 基础层最小可玩性失败
   - 拒绝开局并返回校验报告

### 8.4 输入结构

```ts
type ContentFailureContext = {
  phase:
    | "production_validation"
    | "assembly_preflight"
    | "text_render"
    | "narrative_bind";
  objectId?: string;
  sessionMode?: "freeform" | "narrative";
  errorReason: string;
};
```

### 8.5 输出结构

```ts
type ContentFailureHandlingResult = {
  resolution:
    | "drop_object"
    | "fallback_text"
    | "downgrade_to_freeform"
    | "reject_session_start";
  logLevel: "warning" | "error";
  playerVisibleImpact: "none" | "minor" | "major";
};
```

### 8.6 处理流程

1. 识别失败所处阶段
2. 判断是否存在安全回退路径
3. 若有，则执行最小影响降级
4. 若无，则拒绝装配或拒绝开局
5. 记录结构化日志供调试查看

### 8.7 设计规格和约束

- 文本失败不得升级为事实失败
- narrative 装配失败不得偷偷保留半合法剧情线状态
- 被剔除对象必须带着原因进入日志
- 不允许为了“让内容过校验”而静默删除角色核心驱动力或秘密后果

### 8.8 与上下游的交互边界

- 上游依赖：
  - 校验器输出
  - narrative 装配器输出
  - 文本渲染器输出
- 下游输出：
  - 降级决策
  - 结构化错误日志
  - 开局失败原因
- 不负责：
  - 自动修文
  - 自动改剧情

### 8.9 透出的接口设计

```ts
function handleContentFailure(
  context: ContentFailureContext
): ContentFailureHandlingResult
```

### 8.10 调试要求

调试视图至少展示：

- 失败发生在哪个阶段
- 受影响对象 ID
- 命中的降级路径
- 是否影响玩家可见体验

### 8.11 示例

示例：

- `visible_outcome` 生成文本超长且命中禁止事实类型  
  - 处理：`fallback_text`
- 主线绑定缺少合法角色槽位  
  - 处理：`downgrade_to_freeform`
- 角色卡缺少长期目标且无短期压力  
  - 处理：`reject_session_start`

### 8.12 待处理的问题

- 是否需要把 `drop_object` 再细分为“装配前剔除”和“运行中屏蔽”，`To be confirmed`

## 9. 版本记录

- `v0.1`
  - 新增内容生产规则与自动校验设计文档
  - 锁定“纯规则校验主导，不引入人工审核”的第一版方向
  - 定义角色、秘密、事件、结局、文本模板的生产边界与自动预检要求
