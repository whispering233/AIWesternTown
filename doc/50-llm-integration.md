# LLM 集成与 Prompt Builder 设计方案

## 1. Document Overview

| Item | Content |
| --- | --- |
| Document title | `AIWesternTown LLM integration and prompt builder solution` |
| Business goal | 为第一版 NPC 仿真系统定义稳定、可控、可降级、可调试的大模型集成方案，使 LLM 在不越权的前提下承担高语义复杂度判断、受限文本渲染和摘要能力。 |
| Scope | 覆盖 provider 抽象、阶段级 LLM 调用地图、调用触发与授权、Prompt Builder、预算与裁剪、降级路径、输出解析、安全回收、日志调试和默认配置。 |
| Non-goals | 不覆盖玩家公开 API；不重复展开 NPC 八阶段业务语义；不定义数据库表结构；不锁定具体云厂商 SDK；不定义最终前端 UI 展示。 |
| Target readers | 仿真编排器实现者、NPC 认知阶段实现者、Prompt Builder 实现者、调试工具实现者、设计审阅者。 |
| Assumptions | 第一版采用“规则主导，LLM 附着”的混合架构；世界状态与动作合法性由规则层权威维护；NPC 八阶段主链路与调度器设计已由 `doc/30` 和 `doc/40` 锁定；Prompt Builder 可接受阶段编排器传入的裁剪后 DTO。 |

## 2. Solution Overview

| Item | Content |
| --- | --- |
| Solution summary | 第一版采用“规则层先算，LLM 按需补语义”的保守集成方案。系统先由规则层决定资格、候选、合法性、状态写入与事实结果，再在少数高语义复杂节点调用 LLM 完成精修、摘要或可见文本渲染。 |
| Sub-parts or sub-flows | `provider 抽象与调用模式`、`调用编排与阶段授权`、`阶段级 LLM 调用地图`、`Prompt Builder 体系`、`预算/裁剪/降级`、`输出解析与安全回收`、`日志调试与默认配置` |
| Key design decisions | 规则层垄断事实与状态写入；所有 LLM 调用必须先生成 `PromptSpec`；Prompt Builder 输出 role-aware 消息而非裸字符串；默认关闭大多数深调用；非法输出直接丢弃并回退规则结果。 |
| Overall constraints | 不能让 LLM 直接决定动作资格、世界真相、状态写入、强打断、结局判定；不能让 Prompt Builder 自行读取全局状态；不能因模型超时或格式错误阻塞 world tick。 |
| Dependencies | [00-master-design.md](C:/codex/project/AIWesternTown/doc/00-master-design.md)、[30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md)、[38-npc-cognition-api-spec.md](C:/codex/project/AIWesternTown/doc/38-npc-cognition-api-spec.md)、[40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md)、[51-prompt-builder-contract.md](C:/codex/project/AIWesternTown/doc/51-prompt-builder-contract.md) |
| Risks and open confirmation items | provider 能力差异会影响 structured response 稳定性；默认预算数值仍需实测校准；few-shot 是否需要注册中心仍待观察；本地模型 provider 的结构化输出可靠性仍待验证。 |

## 3. Provider 抽象与调用模式

### 3.1 设计目标

本子部分的目标是为上层认知阶段和 Prompt Builder 提供统一的模型调用入口，使业务逻辑不依赖具体厂商 SDK，同时保留云端、本地和 mock 三类 provider 的接入能力。

### 3.2 设计原则

- provider 关注“如何调模型”，不关注“为什么调模型”
- provider 暴露稳定调用模式，而不是直接暴露某家厂商的原始参数
- provider 不拥有世界状态和业务规则解释权
- provider 必须支持超时、失败、格式错误和能力缺失时的显式回报
- provider 能力差异由 adapter 和 capability 描述吸收，不泄漏到阶段逻辑中

### 3.3 设计思路

第一版采用“统一业务调用模式 + provider capability / 运行保障能力描述”的思路。

上层业务只认三类调用模式：

1. `classify`
2. `summarize`
3. `render`
`healthCheck()` 和 mock fallback 不属于 `ProviderMode`；它们是 provider 生命周期探测与运行保障能力，用于可用性检查、降级和兜底，不作为业务调用 mode 暴露给上层。

这样阶段实现不需要知道底层是云端模型、本地模型还是 mock，只需要知道当前要做的是分类、摘要还是渲染；至于健康检查和 mock 兜底，由 provider 编排或运行时策略处理。

### 3.4 输入结构

provider 层直接接收统一编译后的请求对象：

```ts
type ProviderMode = "classify" | "summarize" | "render";

type CompiledMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type ProviderRequest = {
  requestId: string;
  taskKind: TaskKind;
  mode: ProviderMode;
  modelRef: string;
  messages: CompiledMessage[];
  responseFormat?: "json_object" | "text";
  maxInputTokens: number;
  maxOutputTokens: number;
  temperature: number;
  topP?: number;
  timeoutMs: number;
};
```

### 3.5 输出结构

```ts
type ProviderResponse = {
  requestId: string;
  providerName: string;
  modelRef: string;
  finishReason: "stop" | "length" | "timeout" | "error";
  rawText: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
  capabilityFlags?: string[];
  errorCode?: string;
  errorMessage?: string;
};
```

### 3.6 处理流程

1. 编排器或阶段服务根据 `taskKind` 生成 `PromptSpec`
2. Prompt Compiler 把 `PromptSpec` 编译成 `ProviderRequest`
3. provider adapter 选择具体模型与 SDK
4. provider 返回 `ProviderResponse`
5. Response Parser 把 `rawText` 收回结构化结果
6. 阶段服务决定合并、丢弃或回退

### 3.7 设计规格和约束

- 第一版 provider 必须支持云端、本地、mock 三类实现
- provider 必须显式声明是否支持 JSON response format、最大输出 token、超时控制
- provider 不得在内部默默重试超过一次，避免 world tick 延迟失控
- provider 错误必须带机器可读 `errorCode`
- provider 不得自行改写上层给定的 role 分布和 schema 约束

### 3.8 与上下游的交互边界

- 上游：接收 Prompt Compiler 的统一请求对象
- 下游：只返回原始文本、usage 和错误，不直接返回业务对象
- 不负责：阶段授权判断、预算裁剪、业务字段校验、状态更新

### 3.9 透出的接口设计

```ts
interface LLMProvider {
  getName(): string;
  getCapabilities(): ProviderCapability;
  invoke(request: ProviderRequest): Promise<ProviderResponse>;
  healthCheck(): Promise<ProviderHealthResult>;
}

type ProviderCapability = {
  supportsJsonObject: boolean;
  supportsSystemRole: boolean;
  supportsAssistantRole: boolean;
  maxContextTokens?: number;
  recommendedTimeoutMs?: number;
  supportsMockFallback?: boolean;
};
```

### 3.10 调试要求

调试日志至少记录：

- `requestId`
- `providerName`
- `modelRef`
- `taskKind`
- `mode`
- `timeoutMs`
- `finishReason`
- `inputTokens / outputTokens`
- `errorCode`

### 3.11 示例

示例：`action_style_refine` 使用云端 provider。

- 上游提交 `mode = classify`
- provider 选择低温小模型
- response format 指定为 `json_object`
- 若超时则返回 `finishReason = timeout`

### 3.12 待处理的问题

- 本地 provider 是否需要强制只支持 `summarize / render` 两类低风险任务，To be confirmed
- provider capability 是否需要落到配置文件并支持热切换，To be confirmed

## 4. 调用编排与阶段授权

### 4.1 设计目标

本子部分负责定义“谁决定是否调用 LLM、什么时候能调用、调用失败后怎么回退”，防止阶段服务绕开预算和授权体系各自为政。

### 4.2 设计原则

- 是否调用 LLM 由编排器显式授权，不由阶段内部自由决定
- 规则路径先跑，LLM 路径只做补充
- 授权必须可审计、可回放、可解释
- 同类调用应有稳定触发条件，避免随机性决策

### 4.3 设计思路

第一版采用“规则先算 + orchestrator 授权位”的模式。阶段服务必须先得到规则结果，再根据上游授权位和当前预算决定是否调用 LLM。

`doc/38` 中已有的：

- `llmRefine`
- `allowLlmTiebreak`
- `allowLlmStyleRefine`
- `allowDeepReflectLlm`

统一被视为编排器下发的授权位，而不是阶段服务内部策略的别名。

### 4.4 输入结构

```ts
type LLMInvocationContext = {
  taskKind: TaskKind;
  stageName: string;
  authorizationFlag: boolean;
  triggerReasonTags: string[];
  budgetLevel: BudgetLevel;
  remainingBudget: {
    perTickCalls: number;
    perNpcCalls: number;
    perSessionCalls: number;
  };
  scoreGap?: number;
  semanticComplexity?: "low" | "medium" | "high";
};
```

### 4.5 输出结构

```ts
type LLMInvocationDecision = {
  shouldInvoke: boolean;
  reason:
    | "authorized_and_needed"
    | "disabled_by_policy"
    | "budget_exhausted"
    | "insufficient_value"
    | "fallback_to_rules";
  budgetLevel: BudgetLevel;
  downgradeMode?: "rule_only" | "template_only" | "skip_deep_call";
};
```

### 4.6 处理流程

1. 规则层先产出基础结果
2. 编排器读取阶段授权位和运行态预算
3. 若未授权，直接返回 `rule_only`
4. 若授权，但任务价值不足或预算不足，仍返回 `rule_only`
5. 只有同时满足“已授权 + 命中触发条件 + 预算足够”才调用 LLM

### 4.7 设计规格和约束

第一版推荐触发条件：

- 分数接近：前两名候选差值低于阈值
- 社交语义复杂：潜台词、模糊威胁、安抚/施压细分
- 深反思显式触发：`shouldReflect = true` 且 significance 命中阈值
- 文本渲染明确需要：对玩家可见文本必须输出时

第一版默认关闭矩阵：

| TaskKind | 默认开关 | 说明 |
| --- | --- | --- |
| `appraise_refine` | 关闭 | 仅复杂潜台词时开放 |
| `goal_tiebreak` | 关闭 | 仅近似平分时开放 |
| `action_style_refine` | 关闭 | 仅 `speak` 类语义姿态细分时开放 |
| `visible_outcome_render` | 开启 | 但仅限可见文本渲染 |
| `deep_reflect` | 关闭 | 仅深度反思显式触发时开放 |
| `compression_generalize` | 关闭 | 仅中等重要度候选语义复杂时开放 |

### 4.8 与上下游的交互边界

- 上游：接收阶段规则结果、预算状态、调度上下文
- 下游：给 Prompt Builder 一个“允许 or 不允许”的清晰结论
- 不负责：构造 prompt、解析模型输出、写入世界状态

### 4.9 透出的接口设计

```ts
function decideLLMInvocation(
  context: LLMInvocationContext
): LLMInvocationDecision
```

### 4.10 调试要求

必须记录：

- 是否授权
- 实际是否调用
- 触发原因
- 被预算压制的原因
- 回退模式

### 4.11 示例

示例：`goal_tiebreak`

- 规则层给两个候选目标，得分差 `0.03`
- 编排器检查 `allowLlmTiebreak = true`
- 当前 NPC 本 tick 尚未用过预算
- 决策结果：`shouldInvoke = true`

### 4.12 待处理的问题

- 是否要给不同 NPC 设置不同的 LLM 热度配额，To be confirmed
- score gap 阈值是否按 taskKind 单独配置，To be confirmed

## 5. 阶段级 LLM 调用地图

### 5.1 设计目标

本子部分负责把 LLM 能做什么、不能做什么按认知阶段写死，防止职责边界在实现时重新漂移。

### 5.2 设计原则

- 每个阶段都必须先有纯规则可运行路径
- LLM 只能补“解释”和“表现”，不能改“事实”和“资格”
- 阶段边界比 prompt 技巧优先级更高

### 5.3 设计思路

按八阶段把 LLM 权限压缩成最小集。

### 5.4 输入结构

本部分主要消费各阶段已有的结构化输入与授权位，不新增独立 DTO。

### 5.5 输出结构

输出为阶段级职责表：

| 阶段 | 规则层负责 | LLM 允许参与 | LLM 禁止事项 |
| --- | --- | --- | --- |
| `Perceive` | 观察采样、粗筛、显著性评分 | 默认不参与；可选潜台词 hint | 不能决定被观察事实 |
| `Appraise` | relevance/threat 基础评分 | 社交语义精修、摘要 | 不能修改 observation 或创造事实 |
| `Update Working Memory` | 容量、排序、淘汰 | 短摘要润色 | 不能管理 working memory 容量 |
| `Goal Arbitration` | 候选目标与得分 | 接近平分时语义裁决 | 不能生成新目标 |
| `Action Selection` | 候选动作、过滤、评分、最终动作 | `styleTags` 精修 | 不能新增动作类型 |
| `Act` | 执行校验、结果、状态补丁、事件 | 可见文本渲染 | 不能改执行结果 |
| `Reflect` | 轻反思、significance、候选数量控制 | 深反思社会意义解释 | 不能直接写长期记忆 |
| `Compress` | 预筛选、相似判断、默认 create/merge/reinforce/discard | 中等复杂候选泛化 | 不能直接越过压缩策略写库 |

### 5.6 处理流程

每个阶段都遵循：

`rule path -> optional llm branch -> merge or discard -> next stage`

### 5.7 设计规格和约束

- 任何阶段都不得让 LLM 直接拥有世界状态写入权
- 任何阶段的最终结构化输出必须由规则层 schema 校验
- 任何文本渲染不得反向定义事实

### 5.8 与上下游的交互边界

- 与 `doc/30`：本节只重新确认 LLM 边界，不重复阶段语义
- 与 `doc/40`：调度资格和强打断仍完全由规则层负责
- 与 `doc/51`：Prompt Builder 契约由支撑文档承接

### 5.9 透出的接口设计

本节不新增函数接口，透出的是阶段级治理规则和默认开关矩阵。

### 5.10 调试要求

调试视图应能按阶段显示：

- 是否命中 LLM 分支
- 使用哪个 `taskKind`
- 合并结果还是回退规则结果

### 5.11 示例

示例：`Action Selection`

- 规则层选出 `actionType = speak`
- LLM 仅补 `styleTags = ["calm", "redirect_topic"]`
- 若模型返回“离场”之类新动作，结果直接作废

### 5.12 待处理的问题

- `Perceive` 的潜台词 hint 是否值得在 V1 完全关闭，To be confirmed

## 6. Prompt Builder 体系

### 6.1 设计目标

本子部分负责定义如何把阶段输入稳定编织成一次可控的 LLM 调用，并把“哪段话以什么 role 对模型说”固化为工程契约。

### 6.2 设计原则

- 采用按阶段拆分的结构化 Prompt Builder
- Builder 只消费裁剪后的阶段 DTO，不直接读全局状态
- 先生成 `PromptSpec`，再做 role-aware 编译
- 所有调用都必须显式绑定输出 schema
- Builder 的职责是给足最小必要上下文，而不是尽可能塞满背景

### 6.3 设计思路

总体链路固定为：

`stage orchestrator -> stage DTO -> Prompt Builder -> PromptSpec -> Prompt Compiler -> ProviderRequest`

Prompt Builder 负责“组装语义块”；Prompt Compiler 负责“把语义块编译成最终 role 消息数组”。

### 6.4 输入结构

每个 builder 吃各自的 DTO。典型例子：

- `AppraisePromptInput`
- `GoalTiebreakPromptInput`
- `ActionStylePromptInput`
- `VisibleOutcomeRenderPromptInput`
- `DeepReflectPromptInput`
- `CompressionGeneralizePromptInput`

详细契约见 [51-prompt-builder-contract.md](C:/codex/project/AIWesternTown/doc/51-prompt-builder-contract.md)。

### 6.5 输出结构

Builder 的统一产物为 `PromptSpec`，至少包含：

- `taskKind`
- `stageName`
- `purpose`
- `blocks`
- `outputSchema`
- `inputBudgetTokens`
- `outputBudgetTokens`
- `budgetLevel`
- `providerHints`
- `debugMeta`

### 6.6 处理流程

1. 阶段服务构造专用 DTO
2. Builder 生成 `PromptSpec`
3. 裁剪器按 `must_have / important / optional` 先做预算裁剪
4. 编译器按 role 生成最终消息
5. provider 调用
6. parser 回收结果

### 6.7 设计规格和约束

#### 6.7.1 Role-Aware 规则

- `system`：只放稳定权限边界、调用身份、格式纪律
- `user`：放本次任务、上下文、证据和字段要求
- `assistant`：默认关闭；仅在格式不稳时放一个极短合法示例

#### 6.7.2 System 边界

允许进入 `system` 的内容：

- 你是谁
- 你没有什么权限
- 你只能返回什么格式

禁止进入 `system` 的内容：

- 当前剧情事实
- 当前世界状态
- 当前 NPC 情绪
- 长篇角色背景
- few-shot 示例

#### 6.7.3 Schema 约束

第一版不能只写“请返回 JSON”，必须显式给出字段形状和校验规则。

### 6.8 与上下游的交互边界

- 上游：接收 DTO 与预算档位
- 下游：向 provider 只输出编译后的消息和结构化 response format
- 不负责：决定是否调用 LLM、解析业务结果、状态合并

### 6.9 【横向支撑文档】

Prompt Builder 的详细资源模型、compiler/parser 契约和最终消息样例统一放在 [51-prompt-builder-contract.md](C:/codex/project/AIWesternTown/doc/51-prompt-builder-contract.md)，本章只保留方案层规则，避免与接口层混写。

### 6.10 透出的接口设计

```ts
interface PromptBuilder<TInput> {
  build(input: TInput, options: PromptBuildOptions): PromptSpec;
}

type PromptBuildOptions = {
  budgetLevel: BudgetLevel;
  includeAssistantExample: boolean;
  traceTags: string[];
};
```

### 6.11 调试要求

至少记录：

- `builderName`
- `taskKind`
- 原始 block 数
- 裁剪后 block 数
- 最终 role 分布
- 是否使用 assistant 示例

### 6.12 示例

示例：`action_style_refine`

- `system`：你不是规则引擎；不能改动作类型；只返回 JSON
- `user`：当前目标、当前 concern、已选动作、观众结构、证据包
- `assistant`：可选的极短 JSON 示例

### 6.13 待处理的问题

- 是否需要统一 few-shot registry，To be confirmed
- 某些 `summarize` 类 taskKind 是否允许完全不使用 `assistant` 示例，默认是

## 7. 预算、裁剪与降级

### 7.1 设计目标

本子部分负责把模型窗口上限、工程软预算、上下文裁剪和降级路径统一起来，保证系统在成本、延迟和可靠性之间保持可控。

### 7.2 设计原则

- 预算按 `taskKind` 给软上限，不随模型窗口线性增长
- 预算裁剪先于最终消息编译
- 宁可不调，也不要裁掉核心边界后硬调
- 降级必须保证 world tick 不阻塞

### 7.3 设计思路

第一版预算公式：

`effective_budget = min(model_context_cap, task_kind_soft_budget, runtime_remaining_budget)`

### 7.4 输入结构

```ts
type PromptBudgetContext = {
  taskKind: TaskKind;
  modelContextCap?: number;
  budgetLevel: BudgetLevel;
  runtimeBudget: {
    tickRemainingCalls: number;
    sessionRemainingCalls: number;
  };
};
```

### 7.5 输出结构

```ts
type PromptTrimResult = {
  finalInputBudgetTokens: number;
  finalOutputBudgetTokens: number;
  keptBlockKeys: string[];
  droppedBlockKeys: string[];
  summarizedBlockKeys: string[];
  shouldSkipLLM: boolean;
  skipReason?: string;
};
```

### 7.6 处理流程

1. 按 `taskKind` 选默认软预算
2. 根据 `budgetLevel` 做倍率缩减
3. 估算 token
4. 若超预算，先删 `optional`
5. 仍超预算，把部分 `important` 压缩成短摘要
6. 仍超预算，删除低相关 `important`
7. 若 `must_have` 仍装不下，直接跳过 LLM

### 7.7 设计规格和约束

#### 7.7.1 默认软预算

| TaskKind | 输入预算 | 输出预算 |
| --- | --- | --- |
| `appraise_refine` | 600 | 120 |
| `goal_tiebreak` | 500 | 80 |
| `action_style_refine` | 450 | 100 |
| `visible_outcome_render` | 700 | 160 |
| `deep_reflect` | 1200 | 220 |
| `compression_generalize` | 900 | 180 |

#### 7.7.2 预算档位

| BudgetLevel | 规则 |
| --- | --- |
| `normal` | 使用默认预算 |
| `tight` | 输入预算乘 `0.7`，输出预算乘 `0.8` |
| `critical` | 除 `visible_outcome_render` 外默认跳过非必要调用 |

#### 7.7.3 裁剪优先级

- `must_have`：任务目标、schema、权限边界、直接证据
- `important`：当前目标摘要、局部关系、1-2 条高相关记忆
- `optional`：风格示例、历史补充、扩展背景

#### 7.7.4 降级顺序

1. 先关掉纯润色型调用
2. 再关掉可替代语义精修
3. 最后才关掉深反思和复杂压缩

### 7.8 与上下游的交互边界

- 上游：接收 PromptSpec 和运行态预算
- 下游：产出裁剪后的 PromptSpec 或 `skip_llm_due_to_budget`
- 不负责：provider 调用和 parser 合并

### 7.9 透出的接口设计

```ts
function trimPromptSpec(
  spec: PromptSpec,
  context: PromptBudgetContext
): PromptTrimResult
```

### 7.10 调试要求

必须记录：

- 预算前估算 token
- 预算后估算 token
- 被删除 block
- 被摘要 block
- 是否跳过 LLM
- fallback reason

### 7.11 示例

示例：`deep_reflect` 在 `tight` 档位下：

- 默认输入预算 `1200`
- 乘 `0.7` 后为 `840`
- 删除 `optional` 历史背景
- 把两条相关记忆压缩成单条摘要

### 7.12 待处理的问题

- token 估算器是使用 provider 回传 usage 反向校准还是本地估算，To be confirmed

## 8. 输出解析与安全回收

### 8.1 设计目标

本子部分负责定义“模型输出如何被安全收回成结构化结果”，保证越权内容、格式错误和幻觉不会直接污染规则层。

### 8.2 设计原则

- parser 是强边界，不是宽容拼接器
- 非法输出优先丢弃，不优先修补
- parser 后的结果仍需规则层二次校验
- 任意失败都必须能回退规则结果

### 8.3 设计思路

采用“raw text -> schema parse -> business guard -> merge or discard”的四步回收链路。

### 8.4 输入结构

```ts
type ParserInput = {
  taskKind: TaskKind;
  rawText: string;
  expectedSchemaName: string;
  guardContext?: Record<string, unknown>;
};
```

### 8.5 输出结构

```ts
type ParserResult<T> = {
  success: boolean;
  parsed?: T;
  failureReason?:
    | "invalid_json"
    | "schema_violation"
    | "forbidden_field"
    | "illegal_fact"
    | "too_long";
};
```

### 8.6 处理流程

1. 解析 JSON 或文本字段
2. 校验 schema 必填字段
3. 执行业务守卫
4. 成功则进入阶段合并
5. 失败则记录日志并回退规则结果

### 8.7 设计规格和约束

#### 8.7.1 通用守卫

- 不允许输出 schema 外字段
- 不允许新增未给定事实
- 不允许修改 `actionType`、`goalId` 等权威字段
- 长文本字段超长时截断或判失败，按 taskKind 配置

#### 8.7.2 合并策略

- `appraise_refine`：只允许覆盖语义解释字段
- `goal_tiebreak`：只允许覆盖平分裁决理由，不覆盖候选集合
- `action_style_refine`：只允许回填 `styleTags` 与 `selectionReason`
- `visible_outcome_render`：只允许回填可见文本，不影响 `stateMutations`

### 8.8 与上下游的交互边界

- 上游：接收 provider 原始返回
- 下游：返回业务可消费的结构体或失败原因
- 不负责：再次调模型修复失败输出

### 8.9 透出的接口设计

```ts
function parseLLMResult<T>(input: ParserInput): ParserResult<T>
```

### 8.10 调试要求

必须记录：

- `expectedSchemaName`
- 解析失败原因
- 是否命中 guard
- 最终是否回退规则结果

### 8.11 示例

示例：`action_style_refine` 返回：

```json
{
  "styleTags": ["calm", "professional"],
  "selectionReason": "公开回避更稳妥",
  "actionType": "leave_scene"
}
```

解析器命中 `forbidden_field / illegal_fact`，结果整次丢弃。

### 8.12 待处理的问题

- 对于轻微格式错误是否允许一次本地修复，第一版默认不允许

## 9. 调试、日志与回放

### 9.1 设计目标

本子部分负责保证 LLM 调用可解释、可回放、可定位问题，避免“模型看起来说对了但不知道为什么”。

### 9.2 设计原则

- 记录结构化日志，不只记录最终文本
- 记录决策原因，而不是只记录结果
- 记录裁剪信息，否则无法分析 prompt 质量

### 9.3 设计思路

把日志拆成四层：

1. 授权层
2. Prompt Builder 层
3. Provider 调用层
4. Parser/回退层

### 9.4 输入结构

日志输入来自上述各层的结构化事件，不新增业务输入。

### 9.5 输出结构

```ts
type LLMCallTrace = {
  traceId: string;
  taskKind: TaskKind;
  stageName: string;
  invocationDecision: string;
  builderName?: string;
  budgetLevel?: BudgetLevel;
  trimmedBlocks?: string[];
  providerName?: string;
  modelRef?: string;
  finishReason?: string;
  parseResult?: string;
  fallbackReason?: string;
};
```

### 9.6 处理流程

1. 编排器生成授权日志
2. Builder 记录 block 与裁剪日志
3. provider 记录 usage 与 finish reason
4. parser 记录成功/失败与 fallback

### 9.7 设计规格和约束

- 最终编译后的消息内容应支持采样存档，默认脱敏
- 必须支持按 `npcId + tick + taskKind` 检索调用轨迹
- 调试面板至少能看到本次调用为什么触发、裁了什么、最终回退没有

### 9.8 与上下游的交互边界

- 与 `doc/40`：调度器调试视图需要显示预算命中与 LLM 调用原因
- 与 `doc/37`：若后续落库，日志表结构应与认知日志对齐，当前 To be confirmed

### 9.9 透出的接口设计

```ts
function appendLLMTrace(trace: LLMCallTrace): void
```

### 9.10 调试要求

调试视图至少展示：

- 本 tick 调用了哪些 taskKind
- 哪些调用被预算压制
- 哪些调用解析失败
- 哪些调用最终影响了玩家可见文本

### 9.11 示例

示例 trace：

`tick=185, npc=doctor, taskKind=action_style_refine, authorized=true, budgetLevel=normal, trimmedBlocks=[history_2], provider=openai_cloud, finishReason=stop, parseResult=success`

### 9.12 待处理的问题

- 是否默认持久化最终编译后的消息正文，涉及隐私和存储膨胀，To be confirmed

## 10. V1 默认配置与落地顺序

### 10.1 设计目标

本子部分负责把前文决策收束为可直接落地的默认配置，避免实现阶段再次发散。

### 10.2 设计原则

- 先跑通、再扩展
- 先最保守、后逐步放开
- 所有默认值必须能让系统在没有深调用的情况下仍可运行

### 10.3 设计思路

第一版落地顺序建议：

1. provider 抽象与 mock
2. `visible_outcome_render`
3. `action_style_refine`
4. `goal_tiebreak`
5. `deep_reflect`
6. `compression_generalize`
7. `appraise_refine`

### 10.4 输入结构

本节以配置表为主。

### 10.5 输出结构

第一版默认配置表：

| 项目 | 默认值 |
| --- | --- |
| `defaultProviderMode` | 云端主 provider + mock fallback |
| `assistantExampleDefault` | 关闭 |
| `visible_outcome_render` | 开启 |
| 其余 taskKind | 默认关闭 |
| `maxLlmCallsPerNpcPerTick` | 1 |
| `maxDeepCallsPerTick` | 1 |
| `parserRepair` | 关闭 |
| `providerRetry` | 最多 1 次 |

### 10.6 处理流程

1. 先实现 mock provider 和 parser
2. 先把 `visible_outcome_render` 跑通
3. 再接 `action_style_refine`
4. 等日志稳定后再放开深调用

### 10.7 设计规格和约束

- 第一版必须允许“所有精修关闭，仅模板渲染开启”仍然可玩
- 第一版不得把成功体验建立在多个高成本深调用必须同时成功的前提上

### 10.8 与上下游的交互边界

- 与 `doc/30`：不改阶段语义，只给出默认开关和落地顺序
- 与 `doc/40`：预算与调度热度联动，但不由本节决定具体 UI 展示

### 10.9 透出的接口设计

本节不新增运行时接口，主要产出配置源与 rollout 顺序。

### 10.10 调试要求

上线前至少验证：

- 关闭全部精修仍能跑通一局
- provider 超时后世界推进不阻塞
- parser 丢弃非法输出后无状态污染

### 10.11 示例

示例 rollout：

- Sprint 1：provider + parser + `visible_outcome_render`
- Sprint 2：`action_style_refine` + 日志面板
- Sprint 3：`goal_tiebreak` + `deep_reflect`

### 10.12 待处理的问题

- 首批云端模型接入顺序仍需结合成本和结构化输出稳定性选型，To be confirmed

## 11. 版本记录

- `v0.1`
  - 建立 LLM 集成与 Prompt Builder 主设计文档
  - 锁定第一版采用“规则主导，LLM 附着”的保守集成方案
  - 固化 provider 抽象、阶段调用地图、预算裁剪、降级和安全回收方案
  - 引入 Prompt Builder 作为正式子体系，并把接口细节下沉到支撑文档
