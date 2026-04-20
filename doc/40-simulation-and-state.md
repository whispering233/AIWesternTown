# 世界推进与状态仿真设计

## 1. 设计目标

本设计负责把母稿中“世界推进与仿真规则”章节展开成可实现的正式子设计，回答以下问题：

1. 世界时间如何推进
2. 玩家动作如何消耗时间并触发局部世界步进
3. 哪些 NPC 在当前 tick 获得完整行动机会，哪些只做轻量更新
4. 后台世界如何在不失控的前提下低速继续运行
5. 强打断事件如何判定、插入和恢复对话
6. 调度器需要维护哪些最小状态字段，才能支撑回放、调试和后续实现

本设计默认服务于第一版目标：

- 保证玩家当前场景最活跃
- 保留“世界没有暂停”的体验
- 优先控制工程复杂度和调试成本
- 与现有 NPC 认知链路设计直接兼容

本文档承接以下上位设计和已定约束：

- [00-master-design.md](C:/codex/project/AIWesternTown/doc/00-master-design.md)
- [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md)
- [35-memory-retrieval-and-recall.md](C:/codex/project/AIWesternTown/doc/35-memory-retrieval-and-recall.md)
- [36-npc-cognition-flowcharts.md](C:/codex/project/AIWesternTown/doc/36-npc-cognition-flowcharts.md)
- [37-npc-cognition-db-design.md](C:/codex/project/AIWesternTown/doc/37-npc-cognition-db-design.md)
- [38-npc-cognition-api-spec.md](C:/codex/project/AIWesternTown/doc/38-npc-cognition-api-spec.md)
- [41-sleep-and-epiphany-long-actions.md](C:/codex/project/AIWesternTown/doc/41-sleep-and-epiphany-long-actions.md)

## 2. 设计原则

### 2.1 局部优先而非全局等精度

第一版不做“全镇每 tick 所有 NPC 全量高精度仿真”，而采用以玩家当前场景为中心的泡泡式分层推进。

### 2.2 玩家动作驱动显式时间

第一版把“玩家提交一次玩家命令，再由规则层判定是否 `consumesTick`”视为显式时间推进入口。玩家阅读文本、查看日志和 UI 操作不推进世界。

### 2.3 分层推进，不同精度

前台层、近场层、远场层同时存在，但结算精度不同：

- 前台层优先获得完整认知链路
- 近场层默认获得轻量链路
- 远场层主要以摘要补算和延迟结算维持存在感

### 2.4 硬规则优先于语义自由判断

强打断、升级条件、执行上限、重入限制、对话恢复条件等关键行为由规则层硬判，不交给 LLM 自由决定。

### 2.5 调度器不拥有世界真相

调度器只负责：

- 决定当前运行模式
- 决定谁先跑
- 决定跑多重
- 决定是否允许插入强打断

调度器不直接写入 NPC 认知事实、关系状态和长期记忆。

### 2.6 先保可解释性，再追求真实感

若“更像真实世界”和“更容易理解与调试”发生冲突，第一版优先后者。

## 3. 设计思路

### 3.1 总体方案

本设计采用 `场景泡泡式分层调度`。

世界始终维护统一的 `worldTick`，但每次只对与玩家当前局势最相关的局部世界做高精度结算。玩家所在场景定义为泡泡中心。当前场景内 NPC 属于 `前台层`，邻近场景或被高热事件拉近的关键相关者属于 `近场层`，其余核心 NPC 属于 `远场层`。

第一版默认：

- 玩家命令会进入调度器
- 只有 `consumesTick = true` 的动作才进入 `1` 次局部世界步进并推进 `1` 个 `worldTick`
- 对话期间世界不暂停，但后台只低速继续
- 每个局部 tick 最多推进少数前台 NPC 的完整链路
- 近场层每 tick 只允许有限补步，默认轻量，不直接制造复杂连锁
- 远场层不参与逐拍演出，只做延迟摘要推进
- 只有极端事件允许强打断，并且只在当前玩家动作结算完成后生效

### 3.2 运行模式状态机

第一版把调度运行模式固定为四种：

1. `free_explore`
   - 玩家未锁定主对话线程
   - 当前场景允许更多轻量环境反应
2. `focused_dialogue`
   - 玩家正与某个 NPC 处于主对话线程
   - 当前对话对象获得前台第一优先级
3. `interrupted`
   - 当前轮命中强打断事件
   - 原对话线程可被挂起但不默认销毁
4. `settle`
   - 每次局部 tick 末尾的收束态
   - 汇总本轮可见结果，刷新队列和挂起状态

### 3.3 场景泡泡分层

泡泡分层由“空间邻近 + 叙事相关”共同决定，而不是只看地图距离。

- `foreground`
  - 玩家当前场景中的 NPC
- `near_field`
  - 邻近场景 NPC
  - 或近期被高热事件命中、需要快速响应的关键相关者
- `far_field`
  - 不在当前局势焦点内的其余核心 NPC

### 3.4 调度优先级来源

调度器决定谁先跑时，至少参考以下四个维度：

1. `sceneTier`
2. `eventHeat`
3. `cognitiveHeat`
4. `dialogueBinding`

其中：

- `eventHeat` 来自最近事件窗口
- `cognitiveHeat` 由现有工作记忆状态映射得到，例如 `active/background/cooling`
- `dialogueBinding` 用于保证主对话对象在聚焦对话态始终优先

## 4. 输入结构

### 4.1 世界调度主输入

```ts
type WorldSimulationInput = {
  worldTick: number;
  playerCommand: PlayerCommandEnvelope;
  playerContext: PlayerContextSlice;
  sceneGraph: SceneGraphSlice;
  npcScheduleStates: NPCScheduleState[];
  recentEventWindow: WorldEventWindow;
  activeDialogueThread?: DialogueThreadState;
  pendingInterrupt?: PendingInterruptState;
  farFieldBacklog: FarFieldBacklogItem[];
};
```

字段说明：

- `worldTick`
  - 当前全局 tick 编号
- `playerCommand`
  - 玩家本次提交的结构化动作包
- `playerContext`
  - 玩家当前场景、当前模式和聚焦对象
- `sceneGraph`
  - 场景邻接与距离层级信息
- `npcScheduleStates`
  - 当前所有核心 NPC 的调度快照
- `recentEventWindow`
  - 最近若干 tick 的结构化事件窗口
- `activeDialogueThread`
  - 当前前台主对话线程
- `pendingInterrupt`
  - 尚未消费的强打断入口
- `farFieldBacklog`
  - 远场待补算摘要账本

### 4.2 玩家动作输入

```ts
type PlayerCommandEnvelope = {
  commandId: string;
  commandType: "dialogue" | "move" | "observe" | "social" | "system";
  parsedAction: ParsedPlayerAction;
  issuedAtTick: number;
  consumesTick: boolean;
};
```

约束：

- 玩家命令默认先进入世界调度器，再由规则层给出 `consumesTick`
- 阅读、回看、日志与纯 UI 行为默认不进入标准局部步进
- 自由探索、普通本地移动、普通 `reposition` 默认可进入调度器但 `consumesTick = false`
- 侦查、介入、窗口竞争转场，以及带明显观察意图或暴露风险的 `reposition` 默认 `consumesTick = true`

### 4.3 玩家上下文输入

```ts
type PlayerContextSlice = {
  currentSceneId: string;
  currentMode: "free_explore" | "focused_dialogue";
  visibleNpcIds: string[];
  focusedNpcId?: string;
  statusTags: string[];
  recentPlayerActionIds: string[];
};
```

### 4.4 场景图输入

```ts
type SceneGraphSlice = {
  currentSceneId: string;
  adjacentSceneIds: string[];
  travelEdges: {
    fromSceneId: string;
    toSceneId: string;
    distanceTier: "same" | "near" | "far";
  }[];
};
```

第一版说明：

- 不要求真实地图坐标
- 只要求能支撑 `same / near / far` 的场景分层

### 4.5 NPC 调度状态输入

```ts
type NPCScheduleState = {
  npcId: string;
  currentSceneId: string;
  sceneTier: "foreground" | "near_field" | "far_field";
  scheduleHeat: number;
  cognitiveHeat: "active" | "background" | "cooling";
  lastFullTick?: number;
  lastLightTick?: number;
  boundDialogueThreadId?: string;
  interruptSensitivity: number;
  availability: "available" | "busy" | "incapacitated" | "absent";
};
```

字段来源约定：

- `cognitiveHeat` 由现有工作记忆状态映射得到
- `scheduleHeat` 由场景分层、事件热度和对话绑定共同形成

### 4.6 事件窗口输入

```ts
type WorldEventWindow = {
  tickRange: {
    from: number;
    to: number;
  };
  events: WorldEventRecord[];
};
```

事件窗口至少要支持以下派生判断：

- 是否命中高热事件
- 是否命中强打断事件
- 是否把远场 NPC 拉入近场层
- 是否让近场轻量链路升级为完整链路

### 4.7 对话线程输入

```ts
type DialogueThreadState = {
  threadId: string;
  sceneId: string;
  anchorNpcId: string;
  participantNpcIds: string[];
  status: "active" | "suspended" | "closed";
  startedAtTick: number;
  lastAdvancedAtTick: number;
};
```

### 4.8 强打断输入

```ts
type PendingInterruptState = {
  eventId: string;
  interruptType: "violence" | "intrusion" | "public_reveal" | "forced_state_change";
  originSceneId: string;
  createdAtTick: number;
  priority: number;
};
```

### 4.9 远场补算输入

```ts
type FarFieldBacklogItem = {
  npcId: string;
  summaryTags: string[];
  accumulatedHeat: number;
  queuedAtTick: number;
  mustResolveByTick?: number;
};
```

## 5. 输出结构

### 5.1 世界调度主输出

```ts
type WorldSimulationResult = {
  advancedToTick: number;
  resolvedRunMode: "free_explore" | "focused_dialogue" | "interrupted" | "settle";
  scheduleDecisions: ScheduleDecisionSet;
  executionPlan: SimulationExecutionPlan;
  visibleUpdate: PlayerVisibleWorldUpdate;
  statePatches: SimulationStatePatchSet;
  debugSummary: SimulationDebugSummary;
};
```

### 5.2 调度决策输出

```ts
type ScheduleDecisionSet = {
  foregroundFullNpcIds: string[];
  foregroundReactiveNpcIds: string[];
  nearFieldLightNpcIds: string[];
  nearFieldEscalatedNpcIds: string[];
  deferredFarFieldNpcIds: string[];
  chosenInterruptEventId?: string;
};
```

### 5.3 执行计划输出

```ts
type SimulationExecutionPlan = {
  playerActionExecution: PlannedPlayerExecution;
  npcExecutions: PlannedNpcExecution[];
  interruptPlan?: PlannedInterruptExecution;
};
```

```ts
type PlannedNpcExecution = {
  npcId: string;
  executionClass: "full" | "reactive" | "light" | "deferred";
  runStages: (
    | "prefetch"
    | "perceive"
    | "appraise"
    | "update_working_memory"
    | "goal_arbitration"
    | "action_selection"
    | "act"
    | "reflect"
    | "compress"
  )[];
  escalationReasonTags: string[];
};
```

设计意图：

- 调度器输出“谁跑哪些阶段”
- 世界事实由各阶段权威执行结果决定

### 5.4 玩家可见更新输出

```ts
type PlayerVisibleWorldUpdate = {
  primarySceneId: string;
  visibleActionResults: VisibleActionResult[];
  reactiveMoments: VisibleReactiveMoment[];
  insertedInterrupt?: VisibleInterruptPayload;
  sceneMoodPatch?: SceneMoodPatch;
  worldHintLines: string[];
};
```

约束：

- 每 tick 最多一个 `insertedInterrupt`
- 每 tick 最多一组局势播报入口
- 远场摘要默认不直接进入玩家可见层

### 5.5 调度状态补丁输出

```ts
type SimulationStatePatchSet = {
  nextDialogueThread?: DialogueThreadState;
  nextPendingInterrupt?: PendingInterruptState;
  npcSchedulePatches: NPCSchedulePatch[];
  nearFieldQueuePatch: NearFieldQueuePatch;
  farFieldBacklogPatch: FarFieldBacklogPatch;
  appendedEventIds: string[];
};
```

### 5.6 调试摘要输出

```ts
type SimulationDebugSummary = {
  worldTick: number;
  runModeBefore: string;
  runModeAfter: string;
  promotedNpcIds: string[];
  suppressedNpcIds: string[];
  interruptCandidates: string[];
  selectedInterruptReason?: string;
  budgetNotes: string[];
};
```

## 6. 处理流程

### 6.1 接收玩家动作并决定是否消耗 tick

1. 调度器接收 `PlayerCommandEnvelope`
2. 若 `consumesTick = false`，则不推进世界
3. 若 `consumesTick = true`，则进入标准局部步进

### 6.2 推进全局 tick 并确定运行模式

1. `worldTick += 1`
2. 若存在 `pendingInterrupt`，优先切入 `interrupted`
3. 否则依据 `activeDialogueThread` 判断：
   - 有活跃主对话线程时进入 `focused_dialogue`
   - 否则进入 `free_explore`
4. 当前轮尾部统一进入 `settle`

### 6.3 先结算玩家动作

玩家动作必须先落地，再允许 NPC 响应。

玩家动作执行结果至少沉淀为：

- 世界状态改动
- 结构化事件
- 当前场景可见变化

这些结果写入 `recentEventWindow`，作为当前轮所有 NPC 的共享事实输入。

### 6.4 构造场景泡泡分层

1. 根据 `currentSceneId` 构造 `foreground`
2. 根据 `sceneGraph.adjacentSceneIds` 和事件热度构造 `near_field`
3. 其余核心 NPC 归为 `far_field`
4. 若远端 NPC 被高热事件命中，可临时提升到 `near_field`

建议提升条件包括：

- 最近 2 tick 内被公开提及
- 与关键秘密传播事件直接相关
- 当前对话对象正在针对该 NPC
- 最近事件窗口中多次命中同一高风险标签

### 6.5 选择前台完整链路 NPC

按以下优先级排序前台层：

1. 当前对话锚点 NPC
2. 当前场景中刚卷入公开事件的 NPC
3. 与玩家动作直接相关的 NPC
4. 其余前台 NPC 轮转补位

第一版默认：

- 每 tick 最多选择 `2` 个前台 NPC 跑完整链路
- 同一 NPC 同 tick 不得重复获得完整链路资格

### 6.6 选择前台轻反应 NPC

当前场景中未入选完整链路的 NPC 自动进入轻反应候选。

轻反应默认只允许：

- 插话
- 警觉
- 靠近
- 离场
- 沉默观察

默认不进入完整 `Goal -> Action -> Act` 链路。

### 6.7 选择近场补步 NPC

1. 从近场层优先队列中按 `heat` 最高选 `1` 个 NPC
2. 默认只跑轻量链路：
   - `prefetch`
   - `perceive`
   - `appraise`
   - `update_working_memory`
3. 命中升级条件时，允许升级为完整链路

建议升级条件：

- 命中高热事件
- 与当前秘密风险直接相关
- 当前轮被强烈指向或需要迅速回应
- 连续多个 tick 维持高热未消退

### 6.8 更新远场摘要账本

1. 本轮未激活的远场 NPC 不执行完整链路
2. 只更新 backlog：
   - 热度
   - 到期 tick
   - 摘要标签
3. 每累计 `3` 次 `consumesTick = true` 的玩家动作，可挑选极少数远场 NPC 做一次低频补算
4. 远场补算结果默认不直接逐条播报给玩家

### 6.9 统一检查强打断候选

所有当前轮执行结果和事件写入后，统一扫描 `recentEventWindow`。

处理规则：

1. 只从候选中选出 `1` 个最高优先级强打断事件
2. 强打断只在当前轮末进入可见层
3. 不允许打断当前已提交动作的半程结算

### 6.10 进入结算收束态

收束态负责：

- 汇总本轮可见结果
- 决定是否插入局势播报
- 决定是否挂起或恢复对话线程
- 更新调度队列和挂起状态

### 6.11 生成玩家可见结果

最终输出给前端的内容只包含：

- 玩家本轮动作直接后果
- 当前场景内可见 NPC 响应
- 必要的单条局势提示
- 最多一个强打断入口

不直接暴露：

- 远场详细链路
- 后台未落地的认知摘要
- 调度器内部优先级细节

## 7. 设计规格和约束

### 7.1 时间粒度

- 玩家命令会先进入调度器；只有 `consumesTick = true` 的动作才推进 `worldTick`
- 玩家阅读文本不推进时间
- NPC 连续文本表现不自动额外消耗 tick，除非中间产生新的结构化动作或事件

### 7.2 场景泡泡约束

- `foreground` 由玩家当前场景定义
- `near_field` 由邻近场景和高热相关者共同定义
- `far_field` 为剩余核心 NPC
- 场景泡泡不要求真实几何坐标

### 7.3 每 tick 调度上限

- 前台完整链路 NPC 最多 `2` 个
- 近场轻量补步 NPC 最多 `1` 个
- 每 tick 最多一个近场升级为完整链路的 NPC
- 每 tick 最多一个强打断入口
- 每 tick 最多一组局势播报入口

### 7.4 同 tick 不重入

同一 NPC 在同一个 `worldTick` 内最多只允许：

- `1` 次完整链路
- 或 `1` 次轻量链路

若同一 tick 已经跑过完整链路，后续再被事件命中，也只能加入下轮优先队列，不能再次完整执行。

### 7.5 轻量补步约束

近场轻量链路默认只允许：

- 更新工作记忆热度
- 刷新风险和机会判断
- 申请升级资格
- 更新摘要账本

默认不直接制造复杂新连锁。

### 7.6 事件等级划分

第一版把事件分成三层：

1. `普通事件`
   - 只影响当前场景和本地响应
2. `高热事件`
   - 会把相关 NPC 拉入近场高优先队列
3. `强打断事件`
   - 可以抢占下一次玩家输入

### 7.7 强打断硬判条件

满足以下任一条件才允许强打断：

- 事件发生在玩家当前场景
- 事件会立刻改变当前交互对象是否在场或是否可对话
- 事件属于暴力、闯入、公开揭密、逮捕、逃跑等高冲击行为
- 若不立刻告知，会导致玩家对当前局势的理解明显失真

### 7.8 强打断插入约束

- 强打断只抢占下一次玩家输入
- 不抢占当前已提交动作
- 原对话线程可被 `suspended`，但不默认销毁

### 7.9 对话恢复约束

强打断结束后，不自动假设原对话可继续。

规则层必须重新检查：

- 对话对象是否仍在场
- 是否仍可交互
- 当前情境是否允许恢复原话题

通过检查后，`dialogueThread.status` 才可从 `suspended` 变回 `active`。

### 7.10 远场补算约束

- 远场变化默认不逐条播报
- 远场补算结果不能回溯改写玩家已经看到的事实
- 远场补算只影响后续行为和后续可见结果

### 7.11 调度器最小状态字段

第一版建议调度器维护以下最小状态：

- `worldTick`
- `runMode`
- `currentSceneId`
- `foregroundNpcIds`
- `nearFieldQueue`
- `farFieldBacklog`
- `dialogueThread`
- `interruptState`
- `npcScheduleState`
- `eventWindow`
- `playerActionLedger`

### 7.12 状态归属约束

调度器不重复保存：

- NPC 工作记忆正文
- 社交信念正文
- 长期记忆正文
- 世界事实权威状态

这些仍属于各自的权威存储和执行阶段。

### 7.13 横向支撑文档约束

以下特殊主题由横向支撑文档继续展开：

- `睡眠 / 顿悟` 这类 NPC 内部长动作及其深处理流程
  - 见 [41-sleep-and-epiphany-long-actions.md](C:/codex/project/AIWesternTown/doc/41-sleep-and-epiphany-long-actions.md)
- `物品占有关系、隐蔽转移、发现后果与物品相关机会`
  - 见 [42-item-system-and-interaction.md](C:/codex/project/AIWesternTown/doc/42-item-system-and-interaction.md)
- `物品模板、实例、占有真相与会话装配 schema`
  - 见 [43-item-schema-and-content-config.md](C:/codex/project/AIWesternTown/doc/43-item-schema-and-content-config.md)

## 8. 与 LLM 的交互边界

### 8.1 第一版规则层负责

规则层负责：

- 世界 tick 推进
- 运行模式切换
- 场景泡泡分层
- 调度优先级排序
- 强打断硬判
- 每 tick 预算和上限控制
- 对话挂起与恢复判定
- 调度状态补丁写入

### 8.2 第一版 LLM 可参与

LLM 可以参与：

- 对局势提示做受限文本渲染
- 对强打断可见文案做受限生成
- 对近场或远场摘要做低成本压缩
- 在已确定的权威执行结果之上生成叙事化描述

### 8.3 第一版 LLM 不得直接决定

LLM 不得直接决定：

- 哪个 NPC 在本 tick 获得执行资格
- 是否允许强打断
- 哪个远场 NPC 被拉入近场层
- 同 tick 是否允许重入
- 对话线程是否可以恢复

### 8.4 文本与事实分离约束

调度器和后续阶段只能以结构化事件、状态补丁和执行结果为事实来源，不能以 LLM 渲染文本反推世界真相。

## 9. 与上下游认知阶段的交互边界

### 9.1 上游边界

本调度器上游默认读取：

- 玩家动作解析结果
- 当前世界状态切片
- 场景图和场景邻接信息
- 事件窗口
- 对话线程状态
- NPC 调度状态快照

调度器不直接重跑：

- `Perceive`
- `Appraise`
- `Goal Arbitration`
- `Action Selection`
- `Act`
- `Reflect`
- `Compress`

调度器只决定哪些 NPC、以什么精度、在什么顺序进入这些阶段。

### 9.2 下游边界

调度器向下游输出：

- 运行模式决议
- 分层调度结果
- 每个 NPC 的执行等级和阶段范围
- 强打断插入计划
- 调度状态补丁

下游阶段再分别产出：

- 结构化动作
- 执行结果
- 事件记录
- 反思结果
- 长期记忆压缩结果

### 9.3 与 NPC 认知框架的对齐约束

本设计与 [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md) 的对齐点如下：

- `cognitiveHeat` 直接复用 `active/background/cooling` 的状态语义
- `hold` 仍是执行模式，不是调度模式
- `shouldReflect` 仍由 `Act` 结果决定，不由调度器替代
- `Act -> World Event -> Reflect -> Compress` 的闭环不被本设计改写

### 9.4 与 API 规范的对齐约束

本设计与 [38-npc-cognition-api-spec.md](C:/codex/project/AIWesternTown/doc/38-npc-cognition-api-spec.md) 的对齐点如下：

- 同 tick 不重入与 `sourceActionId + tick` 幂等约束兼容
- 当前轮执行计划以 `tick` 为统一编号
- 调度器不绕过既有阶段接口直接写认知事实

## 10. 透出的接口设计

### 10.1 世界调度主接口

```ts
function advanceWorldSimulation(
  input: WorldSimulationInput
): WorldSimulationResult
```

### 10.2 关键内部辅助接口

```ts
function resolveRunMode(
  player: PlayerContextSlice,
  dialogue?: DialogueThreadState,
  interrupt?: PendingInterruptState
): "free_explore" | "focused_dialogue" | "interrupted"
```

```ts
function buildSceneBubble(
  currentSceneId: string,
  sceneGraph: SceneGraphSlice,
  npcStates: NPCScheduleState[],
  events: WorldEventWindow
): {
  foregroundNpcIds: string[];
  nearFieldNpcIds: string[];
  farFieldNpcIds: string[];
}
```

```ts
function chooseForegroundExecutions(
  runMode: "free_explore" | "focused_dialogue" | "interrupted",
  bubble: {
    foregroundNpcIds: string[];
    nearFieldNpcIds: string[];
    farFieldNpcIds: string[];
  },
  npcStates: NPCScheduleState[],
  dialogue?: DialogueThreadState,
  events?: WorldEventWindow
): ScheduleDecisionSet
```

```ts
function shouldEscalateNearFieldNpc(
  npcState: NPCScheduleState,
  events: WorldEventWindow
): boolean
```

```ts
function selectInterruptCandidate(
  events: WorldEventWindow,
  player: PlayerContextSlice,
  dialogue?: DialogueThreadState
): PendingInterruptState | undefined
```

```ts
function applySimulationStatePatches(
  current: WorldSimulationInput,
  result: WorldSimulationResult
): WorldSimulationState
```

### 10.3 与执行编排器的接口契约

调度器向下游执行编排器透出：

- 本 tick 需要执行的玩家动作
- 需要跑完整链路的 NPC 列表
- 需要跑轻量链路的 NPC 列表
- 被挂起的远场 NPC 列表
- 强打断插入计划

## 11. 调试要求

调试视图至少应展示：

### 11.1 世界时间与运行模式

- 当前 `worldTick`
- 当前 `runMode`
- 上一轮与本轮的模式切换原因

### 11.2 场景泡泡分层结果

- 当前 `foreground`
- 当前 `near_field`
- 当前 `far_field`
- 每个 NPC 被分到该层的原因

### 11.3 调度决策结果

- 哪些 NPC 获得完整链路资格
- 哪些 NPC 只获得轻反应资格
- 哪些近场 NPC 被升级
- 哪些远场 NPC 被挂起

### 11.4 事件热度与打断判定

- 最近事件窗口
- 每个事件的热度等级
- 强打断候选列表
- 最终被选中的强打断事件和原因

### 11.5 对话挂起与恢复

- 当前对话线程状态
- 是否被挂起
- 恢复失败的具体阻断原因

### 11.6 预算与限制命中情况

- 是否命中每 tick 上限
- 是否因重入限制压制了某个 NPC
- 是否因远场预算限制延后了某个补算

### 11.7 回放要求

单个 tick 回放至少应还原：

- 玩家动作
- 前台完整链路选择
- 同场景轻反应
- 近场补步
- 强打断插入与否
- 关键状态补丁

## 12. 示例

### 12.1 场景：玩家在酒馆与医生交谈

初始条件：

- 玩家位于 `saloon`
- 当前存在主对话线程：`player <-> doctor`
- 治安官也在酒馆
- 旅店老板位于邻近场景 `hotel`
- 马厩工位于远场 `stable`

玩家动作：

- 玩家在公开场合追问昨晚受伤者的事

本轮标准结算：

1. `worldTick` 从 `184` 推进到 `185`
2. 当前模式进入 `focused_dialogue`
3. 玩家动作先落地，写入一条公开试探事件
4. 医生作为当前对话锚点，获得前台完整链路资格
5. 治安官作为同场景旁观者，只获得轻反应资格
6. 旅店老板因最近秘密传播事件命中高热，进入近场层并获得一次轻量补步
7. 马厩工留在远场 backlog，不在本轮展开
8. 医生成功执行公开回避动作，`Act` 产出 `public_deflect` 事件
9. 治安官生成轻反应：更警觉，但未发起完整行动
10. 旅店老板在近场轻量链路中更新工作记忆，记录“昨晚事件开始外溢”
11. 当前轮未发生强打断
12. 收束态生成玩家可见结果：医生公开回避、治安官目光转冷、气氛变紧绷

### 12.2 场景：对话中发生枪响

初始条件：

- 玩家在酒馆与治安官交谈
- 酒馆外街道上有两名 NPC 冲突升级

本轮执行：

1. 玩家提交一次追问动作，结算进入本轮 tick
2. 前台对话响应完成
3. 当前轮末，街道事件升级为枪响
4. 该事件发生在玩家当前场景的可感知范围内，且会立刻改变局势理解
5. 规则层判定为 `violence` 型强打断
6. 当前对话线程标记为 `suspended`
7. 下一次玩家输入前，系统先插入“外头传来枪响”的强打断可见结果
8. 后续重新检查原对话是否还能恢复

## 13. 待处理的问题

以下问题当前仍保留为下一轮设计收敛议题：

1. `near_field` 的默认热度计算公式是否要显式量化
2. 远场补算是否需要区分“纯摘要补算”和“低频完整补算”两种模式
3. 强打断事件是否需要继续拆成多级优先级，而不只是单一入口竞争
4. 对话线程的多人参与模型是否需要独立专题设计
5. `sceneMoodPatch` 是否应成为独立状态域，而不是纯前端表现层
6. 远场 backlog 的过期与清理策略是否要绑定局势阶段而非固定 tick 数
7. 调度器状态是否需要单独持久化到数据库表，还是只保留在运行态存档快照中

## 14. 版本记录

- `v0.1`
  - 建立世界推进与状态仿真设计文档第一版
  - 锁定第一版采用“场景泡泡式分层调度”
  - 明确只有 `consumesTick = true` 的玩家动作才推进 `worldTick`
  - 明确四种运行模式、三层事件等级和强打断硬判条件
  - 明确调度器的最小状态字段、输入输出结构和主处理流程
