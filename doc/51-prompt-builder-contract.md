# Prompt Builder 与 Role-Aware Compiler 支撑契约

## 1. Document Overview

| Item | Content |
| --- | --- |
| Document title | `AIWesternTown prompt builder and parser contract` |
| Business goal | 为 `doc/50-llm-integration.md` 中的 Prompt Builder 体系提供可实现、可测试、可复用的资源模型与接口契约。 |
| Scope | 覆盖 `PromptSpec`、`PromptBlock`、阶段输入 DTO、role-aware compiler、最终消息结构、response parser、builder registry 与调试要求。 |
| Non-goals | 不重复定义阶段业务语义；不锁定具体 provider SDK；不定义数据库持久化表结构。 |
| Target readers | Prompt Builder 实现者、provider adapter 实现者、parser 实现者、设计审阅者。 |
| Assumptions | 已采用 `system / user / assistant` 三角色消息结构；所有 Builder 都由阶段编排器驱动；上游已提供裁剪后 DTO。 |

## 2. Contract Overview

| Item | Content |
| --- | --- |
| Contract summary | Prompt Builder 的统一产物是 `PromptSpec`，不是裸字符串。`PromptSpec` 先表达语义块，再由 compiler 编译成最终 role 消息数组，随后交给 provider；provider 返回的原始文本由 parser 按 schema 收回。 |
| Covered sub-parts | `PromptSpec 资源模型`、`阶段 DTO 契约`、`Role-Aware compiler`、`最终消息样例`、`parser 契约`、`builder registry` |
| Key design decisions | block 级优先级裁剪；role 显式绑定；assistant 示例默认关闭；schema 是 parser 与 builder 的共享契约；compiler 不得重写 Builder 指定的 role。 |
| Overall constraints | Builder 不得自行读全局状态；compiler 不得把动态事实提升为 system；parser 不得宽容接受越权字段。 |
| Dependencies | [50-llm-integration.md](C:/codex/project/AIWesternTown/doc/50-llm-integration.md)、[30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md) |
| Risks and open confirmation items | block token 估算误差仍会影响裁剪质量；本地模型对 role 的服从度可能低于云端模型；某些 taskKind 是否需要 few-shot registry 仍待验证。 |

## 3. PromptSpec 资源模型

### 3.1 设计目标

定义所有 Builder 的统一产物，使上层编排、预算裁剪、compiler、provider 和 parser 在同一份结构上协同，而不是围绕大字符串做脆弱处理。

### 3.2 设计原则

- `PromptSpec` 是 Builder 的唯一正式产物
- `PromptSpec` 描述调用，不描述业务执行过程
- `PromptSpec.blocks` 必须支持优先级裁剪和 role-aware 编译
- schema 必须显式声明，不能省略为自由文本约定

### 3.3 设计思路

把 prompt 拆成一组带类型的 block，再由编译器根据 role 组装最终消息。

### 3.4 输入结构

`PromptSpec` 由各 Builder 基于阶段 DTO 生成，本节不定义额外输入。

### 3.5 输出结构

```ts
type TaskKind =
  | "appraise_refine"
  | "goal_tiebreak"
  | "action_style_refine"
  | "visible_outcome_render"
  | "deep_reflect"
  | "compression_generalize";

type MessageRole = "system" | "user" | "assistant";
type PromptBlockKind = "policy" | "task" | "context" | "evidence" | "schema" | "example";
type PromptPriority = "must_have" | "important" | "optional";
type BudgetLevel = "normal" | "tight" | "critical";

interface PromptBlock {
  key: string;
  kind: PromptBlockKind;
  role: MessageRole;
  priority: PromptPriority;
  content: string;
  estimatedTokens?: number;
  canSummarize?: boolean;
  canDrop?: boolean;
}

interface OutputSchemaSpec {
  schemaName: string;
  jsonShape: string;
  validationRules: string[];
}

interface PromptSpec {
  taskKind: TaskKind;
  stageName: string;
  purpose: string;
  blocks: PromptBlock[];
  outputSchema: OutputSchemaSpec;
  inputBudgetTokens: number;
  outputBudgetTokens: number;
  budgetLevel: BudgetLevel;
  providerHints?: {
    mode?: "classify" | "summarize" | "render";
    temperature?: number;
    topP?: number;
  };
  debugMeta: {
    builderName: string;
    traceTags: string[];
    sourceStage: string;
  };
}
```

其中 `providerHints.mode` 仅对应 provider 的三类业务调用模式：`classify | summarize | render`。健康检查与 mock fallback 属于 provider 运行保障能力，不由 Prompt Builder 作为第四种 mode 输出。

### 3.6 处理流程

1. Builder 接收阶段 DTO
2. 生成 `PromptSpec.blocks`
3. 预算裁剪器按优先级裁剪 blocks
4. compiler 按 role 编译
5. provider 调用

### 3.7 设计规格和约束

- `systemRules` 不再作为顶层字段存在，统一落到 `PromptBlock(role=system, kind=policy)`
- `outputSchema.validationRules` 必须可被 parser 和守卫复用
- `blocks` 内不得出现空 content
- 同一 `key` 在同一 `PromptSpec` 内必须唯一

### 3.8 与上下游的交互边界

- 上游：Builder 从 DTO 生成 `PromptSpec`
- 下游：compiler、trim、provider 都只消费 `PromptSpec`
- 不负责：决定是否调用 LLM

### 3.9 透出的接口设计

```ts
type PromptBuildResult = {
  spec: PromptSpec;
};
```

### 3.10 调试要求

记录：

- `builderName`
- block 数量
- block 优先级分布
- schemaName

### 3.11 示例

`action_style_refine` 的 `PromptSpec` 至少包含：

- `policy` block：不能改动作类型
- `task` block：只精修风格与短理由
- `context` block：当前目标、当前 concern
- `evidence` block：当前观众结构、直接事件
- `schema` block：`styleTags` 与 `selectionReason`

### 3.12 待处理的问题

- `OutputSchemaSpec.jsonShape` 是否进一步升级为统一 schema object，To be confirmed

## 4. 阶段输入 DTO 契约

### 4.1 设计目标

确保 Builder 只消费阶段允许看到的裁剪后输入，避免 Builder 自行抓取数据库实体或全局 world state。

### 4.2 设计原则

- 每个 taskKind 一个专用 DTO
- DTO 只包含当前任务需要的最小必要上下文
- DTO 字段名应与阶段资源模型保持一致

### 4.3 设计思路

DTO 按 taskKind 分族：

- `AppraisePromptInput`
- `GoalTiebreakPromptInput`
- `ActionStylePromptInput`
- `VisibleOutcomeRenderPromptInput`
- `DeepReflectPromptInput`
- `CompressionGeneralizePromptInput`

### 4.4 输入结构

示例：`ActionStylePromptInput`

```ts
interface ActionStylePromptInput {
  npcIdentitySummary: {
    name: string;
    role: string;
    publicPersona: string;
    coreDrives: string[];
    taboos: string[];
  };
  dominantGoalSummary: string;
  workingConcernSummary: string;
  chosenAction: {
    actionType: string;
    targetActorId?: string;
    targetLocationId?: string;
    executionMode?: string;
    draftStyleTags: string[];
    ruleBasedReason: string;
  };
  localSocialContext: {
    audienceSummary: string;
    targetRelationSummary?: string;
    exposureRisk: string;
  };
  evidence: {
    triggeringObservationSummaries: string[];
    recentRelevantEventSummaries: string[];
  };
}
```

### 4.5 输出结构

Builder 输出 `PromptSpec`，不直接输出最终消息。

### 4.6 处理流程

1. 阶段服务对原始阶段结果做裁剪与摘要
2. 构造专用 DTO
3. Builder 用 DTO 织出 blocks

### 4.7 设计规格和约束

- DTO 不得含未裁剪的完整长期记忆正文
- DTO 不得含数据库物理列名
- DTO 中的文本字段应已去除无关背景和调试信息

### 4.8 与上下游的交互边界

- 上游：阶段服务负责构造 DTO
- 下游：Builder 负责把 DTO 编成 `PromptSpec`

### 4.9 透出的接口设计

```ts
type StagePromptInput =
  | AppraisePromptInput
  | GoalTiebreakPromptInput
  | ActionStylePromptInput
  | VisibleOutcomeRenderPromptInput
  | DeepReflectPromptInput
  | CompressionGeneralizePromptInput;
```

### 4.10 调试要求

记录 DTO 版本号和字段摘要，避免后续 schema 漂移。

### 4.11 示例

`VisibleOutcomeRenderPromptInput` 应只含：

- 权威执行结果
- 观众视角
- styleTags
- 输出长度约束

### 4.12 待处理的问题

- DTO 是否需要单独 version 字段，To be confirmed

## 5. Role-Aware Compiler

### 5.1 设计目标

把 `PromptSpec` 编译成 provider 可执行的消息数组，同时保持 role 语义、预算裁剪结果和 schema 纪律不漂移。

### 5.2 设计原则

- 先裁剪，再编译
- `system` 承载边界，`user` 承载任务，`assistant` 仅作示例
- compiler 不得重写 Builder 指定的 role

### 5.3 设计思路

编译器按 `role` 聚合 blocks：

1. 合并 `system`
2. 合并 `user`
3. 按需插入 `assistant`

### 5.4 输入结构

```ts
type PromptCompileOptions = {
  enableAssistantExamples: boolean;
  mergeAdjacentBlocksOfSameRole: boolean;
};
```

### 5.5 输出结构

```ts
type CompiledPrompt = {
  messages: {
    role: MessageRole;
    content: string;
  }[];
  roleSummary: {
    systemBlocks: string[];
    userBlocks: string[];
    assistantBlocks: string[];
  };
};
```

### 5.6 处理流程

1. 接收裁剪后的 `PromptSpec`
2. 收集 `system` blocks
3. 收集 `user` blocks
4. 若允许，插入最多一条 `assistant` 示例
5. 输出最终消息数组

### 5.7 设计规格和约束

- `system` 中只能出现稳定边界与格式纪律
- `user` 中必须同时包含任务目标与 schema 要求
- `assistant` 示例默认关闭，开启时最多 1 条
- 若缺少 `task` 或 `schema` block，编译器应直接报错

### 5.8 与上下游的交互边界

- 上游：消费裁剪后的 `PromptSpec`
- 下游：输出 provider 可执行消息
- 不负责：provider 调用和 parser

### 5.9 透出的接口设计

```ts
function compilePromptSpec(
  spec: PromptSpec,
  options: PromptCompileOptions
): CompiledPrompt
```

### 5.10 调试要求

记录：

- 最终 role 数量
- 每个 role 包含哪些 block keys
- 是否启用 assistant 示例

### 5.11 示例

最终消息样例：

```json
[
  {
    "role": "system",
    "content": "You are a constrained semantic refiner for an NPC cognition system.\nYou are not the rule engine.\nReturn compact JSON only."
  },
  {
    "role": "user",
    "content": "Task: refine style tags for an already selected legal action.\nCurrent goal: protect public cover while reducing suspicion.\nOutput schema: {\"styleTags\":[\"string\"],\"selectionReason\":\"string\"}"
  }
]
```

### 5.12 待处理的问题

- 对不支持 `system` role 的 provider 是否需要兼容降级编译，To be confirmed

## 6. Response Parser 契约

### 6.1 设计目标

把 provider 原始文本收回到固定 schema，并在越权或格式错误时保护规则层不被污染。

### 6.2 设计原则

- parser 默认严格
- guard 校验属于 parser 契约的一部分
- 失败优先回退，不优先修补

### 6.3 设计思路

`rawText -> parse -> schema validate -> business guard -> typed result`

### 6.4 输入结构

```ts
type ParseGuardContext = {
  immutableFields?: string[];
  forbiddenFacts?: string[];
  maxFieldLengths?: Record<string, number>;
};
```

### 6.5 输出结构

```ts
type TypedParseResult<T> = {
  ok: boolean;
  value?: T;
  errorReason?: string;
};
```

### 6.6 处理流程

1. 尝试解析 JSON
2. 做字段存在性校验
3. 做字段类型校验
4. 做业务守卫校验
5. 返回 typed result

### 6.7 设计规格和约束

- 对 `styleTags` 类字段必须校验数组类型
- 对 `selectionReason` 类字段必须校验长度
- 若输出试图改写 `actionType`，直接失败

### 6.8 与上下游的交互边界

- 上游：provider response
- 下游：阶段 merge logic

### 6.9 透出的接口设计

```ts
interface ResponseParser<T> {
  parse(rawText: string, guard?: ParseGuardContext): TypedParseResult<T>;
}
```

### 6.10 调试要求

记录原始失败原因和命中的 guard 类型。

### 6.11 示例

若模型返回：

```json
{"styleTags":"calm","selectionReason":"ok"}
```

则 parser 返回 `ok = false, errorReason = schema_violation`。

### 6.12 待处理的问题

- 某些 provider 若支持原生 schema 响应，parser 是否仍需走文本解析路径，To be confirmed

## 7. Builder Registry 与默认映射

### 7.1 设计目标

统一管理 taskKind 到 Builder、compiler 选项、parser 和默认预算模板的映射关系。

### 7.2 设计原则

- 映射集中管理
- taskKind 是注册中心的主键
- 运行期不要分散硬编码

### 7.3 设计思路

采用 registry：

`taskKind -> builder -> parser -> defaults`

### 7.4 输入结构

```ts
type BuilderRegistryEntry = {
  builderName: string;
  parserName: string;
  defaultIncludeAssistantExample: boolean;
  defaultInputBudgetTokens: number;
  defaultOutputBudgetTokens: number;
};
```

### 7.5 输出结构

```ts
type BuilderRegistry = Record<TaskKind, BuilderRegistryEntry>;
```

### 7.6 处理流程

1. 编排器决定 taskKind
2. registry 提供 builder、parser、默认预算
3. runtime 叠加 budgetLevel 与 provider 选择

### 7.7 设计规格和约束

第一版 registry 默认：

- `visible_outcome_render`：示例关闭
- `action_style_refine`：示例关闭
- `goal_tiebreak`：示例关闭
- `deep_reflect`：示例关闭

### 7.8 与上下游的交互边界

- 上游：编排器提供 taskKind
- 下游：Builder/Parser/Compiler 使用 registry 配置

### 7.9 透出的接口设计

```ts
function getBuilderRegistryEntry(taskKind: TaskKind): BuilderRegistryEntry
```

### 7.10 调试要求

调试面板应能显示某 taskKind 当前命中的 registry 配置。

### 7.11 示例

`taskKind = action_style_refine`

- builder: `ActionStylePromptBuilder`
- parser: `ActionStyleResultParser`
- assistant example: `false`
- budget: `450 / 100`

### 7.12 待处理的问题

- registry 是否需要支持按 provider 覆盖默认预算，To be confirmed

## 8. 版本记录

- `v0.1`
  - 新建 Prompt Builder 与 role-aware compiler 支撑契约文档
  - 固化 `PromptSpec`、阶段 DTO、compiler、parser 和 registry 的第一版接口边界
