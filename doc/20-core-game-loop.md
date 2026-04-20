# 核心玩法循环设计方案

## 1. Document Overview

| Item | Content |
| --- | --- |
| Document title | `AIWesternTown core game loop solution` |
| Business goal | 为第一版定义稳定、可实现、可调试的玩家核心玩法循环，使玩家以“游客/参与者”的身份在西部小镇中自由探索，通过观察、侦查和社交卷入逐步揭开局势与秘密。 |
| Scope | 覆盖单步交互循环、玩家动作类型、时间推进规则、机会生成、社交卷入、步后反馈、强打断边界，以及与世界调度/NPC 仿真的交互边界。 |
| Non-goals | 不覆盖完整世界观与叙事主题；不定义具体地点列表和角色池；不展开数据库设计和 API 契约；不锁定最终前端 UI 视觉样式；不细化单局结局阈值。 |
| Target readers | 产品设计者、仿真编排实现者、前端交互实现者、调试工具实现者、设计审阅者。 |
| Assumptions | 第一版玩家身份为“新来者/游客”；世界采用文本场景节点和 `worldTick` 驱动推进；世界调度、场景泡泡和强打断底层规则已由 `doc/40` 承接；NPC 认知与 LLM 边界已分别由 `doc/30` 与 `doc/50` 承接。 |

## 2. Solution Overview

| Item | Content |
| --- | --- |
| Solution summary | 第一版采用“场景驱动探索 + 观察转机会 + 社交卷入升温”的核心玩法循环。玩家先以自由探索者的身份在地点间移动，先感知场景异常，再通过主动侦查把异常转化为可执行机会，最后在关键节点卷入人际局势并立刻看到信息层面的后果。 |
| Sub-parts or sub-flows | `单步探索循环`、`玩家动作与时间推进`、`机会生成与社交卷入`、`步后反馈结构`、`强打断与节奏保护` |
| Key design decisions | 以场景而非对话树作为单步入口；移动采用“本地自由、追逐有代价”的混合时间规则；观察优先于接触；观察结果直接转成可执行机会；关键机会优先表现为社交卷入；反馈重点放在信息变化；强打断必须稀有且只处理不可逆窗口。 |
| Overall constraints | 不能把玩法做成纯事件摘要阅读器；不能让系统频繁打断自由探索；不能依赖显式好感度/怀疑值反馈维持可玩性；不能让自由输入直接越权改写世界事实。 |
| Dependencies | [00-master-design.md](C:/codex/project/AIWesternTown/doc/00-master-design.md)、[30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md)、[40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md)、[50-llm-integration.md](C:/codex/project/AIWesternTown/doc/50-llm-integration.md) |
| Risks and open confirmation items | 若机会提示过强会削弱探索感；若提示过弱会造成迷失；侦查动作的时间成本需要实测校准；自由输入的意图解析粒度仍需后续专题收敛；结局收束结构仍待独立展开。 |

## 3. 单步探索循环

### 3.1 设计目标

本子部分负责定义玩家一次标准交互步的体验骨架，确保第一版不是“读摘要并选回应”，而是“像游客一样进入地点、感知异动、主动深挖、决定是否卷入”。

### 3.2 设计原则

- 场景优先于对话树
- 观察优先于直接接触
- 半显性异常优先于完整真相
- 每一步都要提供下一步抓手
- 社交卷入是戏剧张力的主要抬升点

### 3.3 设计思路

第一版标准单步循环定义为：

`自由抵达地点 -> 自动粗观察 -> 主动区域观察 -> 定向深挖 -> 浮出机会 -> 原子动作或社交卷入 -> 立即可见后果 -> 回到探索态`

该循环的核心不是让系统把事件结论讲给玩家，而是通过“异常感 -> 深挖 -> 机会”逐层揭示局势。

### 3.4 输入结构

```ts
type PlayerStepContext = {
  currentSceneId: string;
  localSceneClusterId: string;
  visibleNpcIds: string[];
  visibleObjects: SceneObjectSlice[];
  visibleAnomalies: SceneAnomalySlice[];
  availableSoftOpportunities: OpportunityHint[];
  runMode: "free_explore" | "focused_dialogue" | "interrupted";
};
```

字段说明：

- `currentSceneId`
  - 玩家当前所在地点
- `localSceneClusterId`
  - 所属本地场景簇，用于判定普通移动是否免费
- `visibleNpcIds`
  - 当前可见或可感知的 NPC
- `visibleObjects`
  - 当前可关注的对象和痕迹
- `visibleAnomalies`
  - 当前对玩家开放的半显性异常集合
- `availableSoftOpportunities`
  - 非强打断的软机会提示
- `runMode`
  - 当前世界运行模式

### 3.5 输出结构

```ts
type PlayerStepFrame = {
  sceneArrivalView?: SceneArrivalView;
  coarseObservation: CoarseObservationPayload;
  deepObservationTargets: ObservationTargetEntry[];
  surfacedOpportunities: SurfacedOpportunity[];
  activeInteraction?: ActiveInteractionFrame;
  visibleConsequences: VisibleConsequenceBundle;
};
```

### 3.6 处理流程

1. 玩家抵达或切换到某个地点
2. 系统先生成一层粗观察结果
3. 玩家决定是否继续做区域观察
4. 区域观察产出可疑目标集合
5. 玩家对具体目标执行定向深挖
6. 系统把足够具体的线索转成少量机会入口
7. 玩家选择执行原子动作或进入短互动场景
8. 当前步结算并生成立刻可见的后果
9. 玩家重新回到探索态

### 3.7 设计规格和约束

- 进入地点时默认必须有 `粗观察`
- 粗观察只能给出气氛、在场人物、明显异常，不能直接给完整事件总结
- 主动侦查必须比粗观察多产出一层新的可行动信息
- 每轮浮出的明确机会建议控制在 `1-3` 个
- 关键机会应优先导向社交卷入，而不是纯搜查或纯菜单选择

### 3.8 与上下游的交互边界

- 上游依赖：
  - 场景状态切片
  - 当前可见 NPC/对象
  - 当前世界运行模式
  - 最近可见事件结果
- 下游输出：
  - 侦查目标
  - 机会入口
  - 互动场景上下文
  - 玩家可见后果
- 不负责：
  - NPC 认知阶段执行
  - 强打断硬判
  - 世界事实写入

### 3.9 透出的接口设计

```ts
function buildPlayerStepFrame(
  context: PlayerStepContext
): PlayerStepFrame
```

### 3.10 调试要求

调试视图至少应展示：

- 当前地点自动粗观察的来源
- 当前地点有哪些异常被隐藏、哪些被开放
- 哪些线索尚未具体到足以生成机会
- 本轮浮出的机会及其来源线索

### 3.11 示例

示例：玩家走进酒馆。

- 粗观察显示：气氛突然发紧，医生在吧台边明显不愿看向治安官，角落那桌刚停下低声争论。
- 玩家执行区域观察后，系统标出三个值得关注的目标：
  - 角落那桌的停顿
  - 医生的回避
  - 楼梯口带泥的脚印
- 玩家选择定向旁听角落那桌，于是浮出机会：
  - 继续旁听
  - 上前插话
  - 先装作没听见转去盯医生

### 3.12 待处理的问题

- 场景粗观察的文案密度是否应按地点类型分层，To be confirmed
- “可疑目标”的默认显示上限是否需要随运行模式变化，To be confirmed

## 4. 玩家动作与时间推进

### 4.1 设计目标

本子部分负责定义玩家在单步里能执行什么，以及哪些动作推进 `worldTick`，从而兼顾自由探索感和时机竞争感。

### 4.2 设计原则

- 让玩家敢逛，而不是被时间压着走
- 真正有信息价值或局势价值的动作才消耗时间
- 转场是否计时取决于是否存在窗口竞争
- 动作分类必须能直接映射到规则层

### 4.3 设计思路

第一版将玩家动作分成五类：

1. `自由探索动作`
2. `侦查动作`
3. `介入动作`
4. `追逐与转场动作`
5. `挪位动作（reposition）`

其中侦查、介入、窗口竞争型转场，以及带观察意图或暴露风险的 `reposition` 默认推动 `worldTick`。

### 4.4 输入结构

```ts
type ParsedPlayerAction = {
  actionId: string;
  actionClass:
    | "free_explore"
    | "investigate"
    | "intervene"
    | "travel"
    | "reposition";
  actionType: string;
  targetSceneId?: string;
  targetPartitionId?: string;
  targetNpcId?: string;
  targetObjectId?: string;
  urgencyTag?: "none" | "windowed" | "critical";
};
```

### 4.5 输出结构

```ts
type PlayerActionExecutionPolicy = {
  consumesTick: boolean;
  worldTickReason:
    | "no_tick"
    | "investigation_cost"
    | "social_intervention"
    | "windowed_travel"
    | "reposition_cost";
  resultingRunMode:
    | "free_explore"
    | "focused_dialogue"
    | "interrupted"
    | "settle";
};
```

### 4.6 处理流程

1. 规则层先识别玩家动作所属类别
2. 若是自由探索动作，则只更新前端定位态，不推进世界
3. 若是侦查动作，则推进 `worldTick`
4. 若是介入动作，则推进 `worldTick` 并优先生成社交响应
5. 若是转场动作，则依据是否存在追逐/抢时机属性决定是否推进 `worldTick`
6. 若是 `reposition` 动作，则先更新同场景站位，再依据是否带观察意图或暴露风险决定是否推进 `worldTick`

### 4.7 设计规格和约束

#### 4.7.1 自由探索动作

典型包括：

- 同场景簇内普通移动
- 切换视角焦点
- 查看当前地点公开信息
- 回看最近可见内容

默认 `不推进 worldTick`。

#### 4.7.2 侦查动作

典型包括：

- 区域观察
- 定向盯人
- 旁听
- 检查痕迹

默认 `推进 worldTick`。

#### 4.7.3 介入动作

典型包括：

- 搭话
- 插话
- 试探
- 隐瞒
- 附和
- 质疑
- 公开表态
- 向某人转告信息

默认 `推进 worldTick`。

#### 4.7.4 追逐与转场动作

典型包括：

- 跟上离场 NPC
- 跨区域赶场
- 在事件爆发前抢先到场

规则：

- 普通本地移动不推进时间
- 存在窗口竞争的转场推进时间

#### 4.7.5 挪位动作（reposition）

典型包括：

- 在同场景内靠近某个分区或目标
- 从吧台挪到楼梯口旁听
- 为降低被注意概率而换一个站位

规则：

- `reposition` 默认用于同场景内换位，不替代跨场景 `travel`
- 普通挪位默认不推进时间
- 带明显观察意图或社交暴露风险的挪位推进时间

### 4.8 与上下游的交互边界

- 与 [40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md) 对齐：
  - 玩家命令会进入调度器，但只有 `consumesTick = true` 的动作才进入标准局部步进并推进 `worldTick`
  - 纯 UI 行为不推进时间
- 向下游执行层透出：
  - 是否推进 `worldTick`
  - 当前动作的优先结算语义
  - 是否应切入 `focused_dialogue`

### 4.9 透出的接口设计

```ts
function resolvePlayerActionPolicy(
  action: ParsedPlayerAction,
  sceneContext: PlayerStepContext
): PlayerActionExecutionPolicy
```

### 4.10 调试要求

调试视图应能回答：

- 当前动作为什么推进或不推进 `worldTick`
- 哪些移动被识别为“本地自由移动”
- 哪些转场被识别为“窗口竞争转场”
- 当前动作为什么把运行模式切到 `focused_dialogue`

### 4.11 示例

示例 1：玩家从酒馆大厅走到吧台边，属于同场景簇内普通移动，不推进 `worldTick`。  
示例 2：玩家看到医生突然离开酒馆，立刻选择跟上，属于窗口竞争转场，推进 `worldTick`。  
示例 3：玩家站在原地旁听角落争执，属于侦查动作，推进 `worldTick`。

### 4.12 待处理的问题

- 是否需要给“连续侦查”增加边际成本，To be confirmed
- 本地场景簇的默认粒度是否应在地点设计文档中显式定义，To be confirmed

## 5. 机会生成与社交卷入

### 5.1 设计目标

本子部分负责定义观察结果如何转成“玩家现在可以做什么”，并明确关键机会为什么优先表现为社交卷入。

### 5.2 设计原则

- 观察不仅产出信息，也必须产出行动入口
- 机会数量必须少而清晰
- 关键机会优先让玩家卷入人与人之间的局势
- 选项控制节奏，自由输入提供突破口

### 5.3 设计思路

机会生成采用分层方案：

- 粗观察只给异常
- 深观察让异常变具体
- 只有足够具体时才浮出机会
- 普通机会按原子动作快速结算
- 关键机会展开为短互动场景

关键机会在第一版优先聚焦 `社交卷入`，例如被看见旁听、插话站队、被当面追问、选择隐瞒或摊牌。

### 5.4 输入结构

```ts
type OpportunityBuildInput = {
  currentSceneId: string;
  evidenceSlices: EvidenceSlice[];
  observationFindings: ObservationFinding[];
  visibleNpcStates: VisibleNpcStateSlice[];
  socialTensionTags: string[];
};
```

### 5.5 输出结构

```ts
type OpportunityBuildResult = {
  surfacedOpportunities: SurfacedOpportunity[];
  criticalOpportunityId?: string;
  suggestedInteractionMode: "atomic" | "short_scene";
};
```

```ts
type SurfacedOpportunity = {
  opportunityId: string;
  opportunityType:
    | "observe_more"
    | "eavesdrop"
    | "approach"
    | "interrupt"
    | "follow"
    | "inspect"
    | "exit";
  leadText: string;
  sourceFindingIds: string[];
  resolutionMode: "atomic" | "short_scene";
};
```

### 5.6 处理流程

1. 从观察结果中抽取结构化 finding
2. 识别哪些 finding 已经具体到可行动
3. 按当前局势和社交张力裁掉弱机会
4. 生成 `1-3` 个明确机会
5. 若命中关键社交场景，则将机会标记为 `short_scene`
6. 玩家执行机会后进入原子结算或短互动

### 5.7 设计规格和约束

#### 5.7.1 原子动作

适用于：

- 继续旁听
- 检查痕迹
- 观察某个方向
- 简单跟随

特点：

- 一步结算
- 节奏快
- 主要用于继续收集信息

#### 5.7.2 短互动场景

适用于：

- 插话
- 被发现旁听
- 被点名表态
- 当场试探
- 当场否认或隐瞒

特点：

- 展开为一小段专门互动
- 默认以选项为主
- 关键节点允许自由输入

#### 5.7.3 输入方式

第一版交互表达采用混合模式：

- 常规社交卷入以高质量选项为主
- 关键节点允许自由输入
- 自由输入先解析为受控意图，再进入规则层结算

### 5.8 与上下游的交互边界

- 上游接收：
  - 侦查结果
  - 当前可见 NPC 状态切片
  - 当前地点社交张力标签
- 下游透出：
  - 机会列表
  - 每个机会的结算模式
  - 自由输入时的意图槽位
- 不负责：
  - 自由输入的最终语义解析细则
  - NPC 认知链内部候选动作生成

### 5.9 【关键社交卷入类型】

第一版优先支持以下关键社交卷入类型：

- `试探`
- `插话`
- `站队`
- `装傻`
- `隐瞒`
- `施压`
- `退出`

这些类型的共同目标是改变信息流，而不是立即给出数值反馈。

### 5.10 透出的接口设计

```ts
function buildSurfacedOpportunities(
  input: OpportunityBuildInput
): OpportunityBuildResult
```

```ts
function classifyInteractionResolutionMode(
  opportunity: SurfacedOpportunity
): "atomic" | "short_scene"
```

### 5.11 调试要求

调试视图至少应展示：

- 某条线索为什么能或不能生成机会
- 某个机会为什么被判定为 `atomic` 或 `short_scene`
- 当前社交张力标签如何影响机会排序
- 自由输入被映射成了哪类受控意图

### 5.12 示例

示例：玩家旁听到“昨晚的尸体不该出现在火车站”。

- 系统生成 `继续旁听`、`上前插话`、`转去火车站查看` 三个机会
- 若玩家选择 `上前插话`，则进入短互动场景
- 短互动场景中默认出现选项：
  - 装作随口一问
  - 直接追问尸体的事
  - 说自己刚好也去过火车站
- 关键节点允许自由输入，系统再解析为 `试探 / 摊牌 / 误导` 等受控意图

### 5.13 待处理的问题

- 自由输入意图解析需要细到何种语气层级，To be confirmed
- 是否要支持“玩家先给态度，再补一句自定义台词”的复合交互，To be confirmed

## 6. 步后反馈结构

### 6.1 设计目标

本子部分负责定义一次有效动作结算后，玩家应该看到什么，从而保证“看懂后果”和“保持沉浸”同时成立。

### 6.2 设计原则

- 先给戏内反应，再给轻系统提示
- 反馈重点放在信息变化，不放在数值变化
- 每次反馈都要自然接回下一步行动
- 不用完整情报总结破坏神秘感

### 6.3 设计思路

每个有效动作结算后，系统固定产出三层反馈：

1. `戏内即时表现`
2. `轻量信息提示`
3. `新机会与局势入口`

这样玩家的感受应是：

`我做了什么 -> 世界立刻起反应 -> 我意识到信息发生了变化 -> 我知道下一步能抓什么`

### 6.4 输入结构

```ts
type StepResolutionInput = {
  executedActionId: string;
  sceneEventResults: SceneEventResult[];
  socialSignalResults: SocialSignalResult[];
  visibleStateDeltas: VisibleStateDelta[];
  nextOpportunityCandidates: SurfacedOpportunity[];
};
```

### 6.5 输出结构

```ts
type VisibleConsequenceBundle = {
  sceneReaction: SceneReactionPayload;
  infoShiftHint?: InfoShiftHint;
  newOpportunities: SurfacedOpportunity[];
  locationStateDelta?: LocationStateDelta;
  interruptFlag?: {
    hasInterrupt: boolean;
    interruptId?: string;
  };
};
```

### 6.6 处理流程

1. 根据执行结果先生成戏内即时表现
2. 判断本轮是否存在值得提示的信息变化
3. 若存在，则补一条轻量信息提示
4. 从结算后的局势中提取新的机会入口
5. 若存在强打断候选，则只挂标记，不在中途打断当前动作

### 6.7 设计规格和约束

#### 6.7.1 戏内即时表现

表现类型包括：

- 沉默
- 改口
- 盯视
- 离场
- 插话
- 气氛骤变

必须优先出现。

#### 6.7.2 轻量信息提示

提示目标是帮助玩家感知信息流变化，例如：

- 你感觉他意识到你知道得太多了。
- 这句话显然被旁边的人听进去了。
- 你没拿到正面答案，但你知道谁在回避这个话题。

约束：

- 默认每步最多 `1` 条
- 只能提示方向，不能给完整秘密传播列表

#### 6.7.3 新机会与局势入口

反馈后应自然补出下一步抓手，例如：

- 追上离场的人
- 继续逼问当前对象
- 转去另一个地点
- 检查刚暴露出的痕迹

### 6.8 与上下游的交互边界

- 上游依赖：
  - 玩家动作执行结果
  - 当前场景可见 NPC 响应
  - 可见状态差分
- 下游输出：
  - 玩家前端反馈载荷
  - 下一步机会入口
  - 强打断标记
- 不直接输出：
  - 隐藏数值变化
  - 全量关系变化表
  - 完整秘密传播图

### 6.9 透出的接口设计

```ts
function buildVisibleConsequenceBundle(
  input: StepResolutionInput
): VisibleConsequenceBundle
```

### 6.10 调试要求

调试视图应能回答：

- 为什么本轮生成了这条 `infoShiftHint`
- 为什么本轮没有生成信息提示
- 哪些新机会是由哪条可见后果触发的
- 哪些状态变化被故意留在玩家不可见层

### 6.11 示例

示例：玩家当众试探医生昨晚是否见过死者。

- 戏内即时表现：
  - 医生短暂沉默后转开视线
  - 治安官明显把注意力转了过来
- 轻量信息提示：
  - 你感觉你提到的话题已经不只落在医生耳朵里了。
- 新机会：
  - 继续追问医生
  - 转向治安官试探
  - 趁医生想走时跟上去

### 6.12 待处理的问题

- `infoShiftHint` 是否需要分“你知道了更多”和“别人意识到你知道了更多”两种提示模板，To be confirmed
- 是否要允许极少数特殊互动在一步内出现两层连续反馈，To be confirmed

## 7. 强打断与节奏保护

### 7.1 设计目标

本子部分负责定义什么情况下系统可以抢占玩家当前节奏，以及如何避免打断机制破坏自由探索。

### 7.2 设计原则

- 强打断必须稀有
- 只有高价值、低可逆窗口才允许强打断
- 绝大多数变化都应退化为软机会
- 强打断只抢下一次输入，不打断已提交动作的半程结算

### 7.3 设计思路

第一版采用 `严格稀有触发` 方案。  
强打断的定义为：

`如果玩家此刻不立刻处理，就会在短时间内失去一个高价值、低可逆的局势窗口。`

### 7.4 输入结构

```ts
type InterruptEvaluationInput = {
  currentSceneId: string;
  visibleEventCandidates: InterruptCandidateEvent[];
  activeDialogueThreadId?: string;
  currentStepResolved: boolean;
};
```

### 7.5 输出结构

```ts
type InterruptEvaluationResult = {
  selectedInterrupt?: {
    interruptId: string;
    interruptType:
      | "forced_social_callout"
      | "imminent_escalation"
      | "critical_departure"
      | "closing_secret_window";
    reason: string;
  };
  deferredSoftOpportunities: SurfacedOpportunity[];
};
```

### 7.6 处理流程

1. 当前步结算完成后，扫描前台场景中的打断候选
2. 过滤掉仅影响探索节奏、不影响窗口存续的普通变化
3. 若候选为空，则全部退化为软机会
4. 若候选不为空，则按优先级选出至多一个强打断
5. 将原对话线程标记为 `suspended` 或保持 `free_explore`
6. 在下一次玩家输入前插入强打断入口

### 7.7 设计规格和约束

#### 7.7.1 允许强打断的典型情形

- 有人当面拦下、质问、点名玩家
- 眼前冲突即将升级为不可忽视事件
- 关键人物即将脱离当前可接触状态
- 秘密窗口正在眼前关闭

#### 7.7.2 不允许强打断的典型情形

- 某处出现新的可疑迹象
- 某个 NPC 观感变化
- 别的地点可能发生了事
- 一个普通旁听机会出现
- 远场局势发生新波动

这些一律作为 `软机会` 处理。

#### 7.7.3 硬约束

- 单个 `worldTick` 最多 `1` 次强打断
- 同类强打断短时间内必须有冷却
- 只有前台场景事件能强打断
- 强打断只抢占下一次玩家输入

### 7.8 与上下游的交互边界

- 与 [40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md) 对齐：
  - 强打断只允许在当前动作结算完成后插入
  - 不允许打断已提交动作的半程结算
- 向前端交互层透出：
  - 是否出现打断
  - 打断的最短说明文本
  - 玩家的立刻选择入口

### 7.9 【玩家响应入口】

强打断出现后，第一版建议只提供极短决策口：

- `立刻回应`
- `跟上/介入`
- `暂不处理`

其中 `暂不处理` 必须存在，用于保留玩家主动放弃窗口的权利。

### 7.10 透出的接口设计

```ts
function evaluatePlayerInterrupt(
  input: InterruptEvaluationInput
): InterruptEvaluationResult
```

### 7.11 调试要求

调试视图至少应展示：

- 本轮有哪些打断候选
- 某个候选为什么被降级成软机会
- 当前命中的冷却规则
- 当前强打断为什么被允许抢占玩家输入

### 7.12 示例

示例：玩家刚在酒馆试探完医生，医生突然准备从后门离场。

- 若系统判断医生是当前关键线索承载者，且离场后短时间不可追上，则生成强打断：
  - `医生正试图从后门离开。`
  - 玩家入口：
    - 跟上去
    - 叫住他
    - 暂不处理

若只是某个普通旁观者转身离场，则不应强打断，只能作为软机会留给玩家。

### 7.13 待处理的问题

- 是否需要把“秘密窗口正在关闭”再拆成更严格的判定层级，To be confirmed
- 强打断冷却的默认 tick 数仍需实测校准，To be confirmed

## 8. 版本记录

- `v0.1`
  - 建立核心玩法循环设计文档第一版
  - 锁定第一版采用“场景驱动探索 + 观察转机会 + 社交卷入升温”的核心玩法循环
  - 明确玩家动作五分类、步后反馈三层结构和强打断稀有化边界
