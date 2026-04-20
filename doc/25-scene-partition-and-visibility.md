# 场景分区与可见性设计方案

## 1. Document Overview

| Item | Content |
| --- | --- |
| Document title | `AIWesternTown scene partition and visibility solution` |
| Business goal | 为第一版文字叙事沙盒补充一层稳定、可配置、可调试的场景内空间真相，用于约束观察、旁听、被注意到和同场景站位差异，避免玩家与 NPC 对空间关系的理解产生运行漂移。 |
| Scope | 覆盖场景分区拓扑模型、玩家空间投影、观察与可见性判定、同场景分区移动、接入 `core game loop` 与 `worldTick` 的方式、内容配置策略、降级规则与调试要求。 |
| Non-goals | 不设计大地图或开放世界 travel loop；不引入连续坐标、朝向、掩体角度和几何级遮挡；不展开数据库表设计；不展开 REST/API 契约；不把第一版文字 MUD 扩展为潜行或战棋玩法。 |
| Target readers | 产品设计者、玩法与仿真实现者、内容配置者、调试工具实现者、后续 schema/API 设计者。 |
| Assumptions | 项目当前仍以文本场景节点为主；玩家体验主循环由 [20-core-game-loop.md](C:/codex/project/AIWesternTown/doc/20-core-game-loop.md) 承接；世界调度与 `worldTick` 机制由 [40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md) 承接；NPC 认知主链路由 [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md) 承接；第一版目标是防止空间理解漂移，而不是提供复杂地图玩法。 |

## 2. Solution Overview

| Item | Content |
| --- | --- |
| Solution summary | 第一版在现有 `sceneGraph` 之下增加一层轻量 `scene partition topology`。每个高价值场景被拆成 `3-5` 个分区，通过稀疏关系边定义 `视线范围 / 旁听范围 / 被注意难度`。玩家侧只看到压缩后的空间投影，NPC 内部使用更精细的感知切片；两者共享同一底层空间真相。 |
| Sub-parts or sub-flows | `设计定位与系统边界`、`分区拓扑内容模型`、`玩家空间投影与交互接入`、`worldTick 与 NPC 感知接入`、`配置、模板与降级策略` |
| Key design decisions | 采用分区级而非场景级或细视线级模型；`视线范围` 与 `旁听范围` 同级建模；玩家与 NPC 共享同一套分区真相但展示精度不同；分区拓扑走内容配置，不硬编码进逻辑；只覆盖关键场景，不要求全镇立刻细分。 |
| Overall constraints | 第一版不得把文字游戏推进成地图模拟器；机会生成与 NPC 感知必须经过分区过滤；旧场景必须允许退化为单隐式分区；配置复杂度必须受 `3-5` 个分区、稀疏边和模板化原型约束。 |
| Dependencies | [00-master-design.md](C:/codex/project/AIWesternTown/doc/00-master-design.md)、[20-core-game-loop.md](C:/codex/project/AIWesternTown/doc/20-core-game-loop.md)、[30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md)、[40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md)、[10-world-and-narrative.md](C:/codex/project/AIWesternTown/doc/10-world-and-narrative.md) |
| Risks and open confirmation items | 分区数量与边数量仍需实测；哪些场景进入第一批拓扑覆盖范围仍需确认；二跳衰减规则是否足够稳定需要验证；是否需要为人群密度加入统一修正仍为 `To be confirmed`；后续编辑器形态不在本文锁定。 |

## 3. 设计定位与系统边界

### 3.1 设计目标

本子部分负责定义这一层设计为什么存在、它解决什么问题、以及它明确不解决什么问题，避免后续把“防漂移层”误扩成完整地图玩法。

### 3.2 设计原则

- 空间真相服务于感知稳定，而不是地图探索复杂度
- 同一场景不等于同一感知空间
- 玩家与 NPC 共享底层真相，但表现精度不同
- `视线范围` 与 `旁听范围` 并列，不互相替代
- 新层应插入现有循环，而不是另起一套玩法系统

### 3.3 设计思路

第一版在已有“场景节点世界”之下增加一层“场景内分区拓扑”：

1. `场景层`
   - 继续由既有 `sceneGraph` 负责地点与地点之间的关系
   - 不改写当前 `same / near / far` 场景图思想

2. `分区层`
   - 仅在关键场景内新增少量 `partition`
   - 用于表达吧台、角落桌、楼梯口、前门这类稳定站位

3. `感知投影层`
   - 对 NPC 提供更精细的分区感知切片
   - 对玩家只提供文本摘要、可选分区入口与轻量示意信息

本层只负责这些问题：

- 玩家从当前站位能看见什么
- 玩家从当前站位能听见什么
- 玩家靠近或停留时是否容易被注意到
- NPC 是否能依据同一套空间真相做出稳定感知

本层不负责这些问题：

- 大地图路径规划
- 连续距离或朝向模拟
- 战斗站位系统
- 几何级潜行与掩体玩法

### 3.4 输入结构

```ts
type SceneVisibilityContext = {
  sceneId: string;
  sceneTopology: ScenePartitionGraph | null;
  playerPartitionId: string;
  activeNpcPartitions: {
    npcId: string;
    partitionId?: string;
  }[];
  visibleSceneFacts: SceneFactSlice[];
};
```

### 3.5 输出结构

```ts
type SceneVisibilityProjection = {
  playerProjection: PlayerPartitionProjection;
  playerToNpcRelations: PartitionPerceptionRelation[];
  partitionOpportunityHints: OpportunityHint[];
};
```

### 3.6 处理流程

1. 读取当前场景是否存在分区拓扑
2. 若不存在，则退化为单隐式分区
3. 若存在，则确定玩家当前分区与关键 NPC 当前分区
4. 基于分区关系构造 `visual / audio / notice` 切片
5. 对玩家生成压缩投影，对 NPC 保留更细粒度输入
6. 把结果交给观察、机会生成和 `Perceive` 阶段使用

### 3.7 设计规格和约束

- 第一版分区层只作为规则层真相，不要求玩家总能显式看到所有分区细节
- 玩家侧空间表达必须保持文本优先；轻量示意图只作为可选辅助手段
- 所有观察、旁听和“是否被注意到”的判定必须允许回溯到分区关系
- 第一版不允许同一角色同时占据多个分区
- `To be confirmed`：是否允许部分超大场景拆成两层拓扑，而不是单层分区

### 3.8 与上下游的交互边界

- 上游依赖：
  - 当前场景
  - 当前玩家站位
  - 当前场景内关键 NPC 站位
  - 现有世界事实切片
- 下游输出：
  - 玩家空间投影
  - 玩家到关键目标的感知关系
  - 可生成机会的空间约束
- 不负责：
  - 跨场景 travel
  - 角色路径搜索
  - 前端完整地图渲染

### 3.9 透出的接口设计

```ts
function buildSceneVisibilityProjection(
  context: SceneVisibilityContext
): SceneVisibilityProjection
```

### 3.10 调试要求

调试视图至少应展示：

- 当前场景是否启用分区拓扑
- 玩家当前所在分区
- 当前关键 NPC 所在分区
- 玩家到每个关键目标的 `visual / audio / notice` 判定

### 3.11 示例

示例：玩家位于 `saloon / bar_counter`，两名可疑 NPC 位于 `corner_table`。  
系统不再默认“玩家在酒馆就知道酒馆里的一切”，而是基于 `bar_counter -> corner_table` 的关系判断玩家“能看见争执，但听不清内容”。

### 3.12 待处理的问题

- 是否需要为极端特殊场景增加“隐藏分区”概念，`To be confirmed`
- 是否需要区分“玩家已知分区”和“内部存在但未公开分区”，`To be confirmed`

## 4. 分区拓扑内容模型

### 4.1 设计目标

本子部分负责定义分区节点、关系边和场景级拓扑对象，使空间真相可配置、可复用、可校验，而不是写死在代码里。

### 4.2 设计原则

- 采用节点加稀疏边，而不是全连接矩阵
- 对象字段应直接服务感知和机会生成
- 模型允许模板复用和少量覆盖
- 字段采用离散等级，不采用连续距离数值

### 4.3 设计思路

第一版分区拓扑由三类核心对象组成：

1. `ScenePartition`
   - 场景内可站位、可观察、可靠近的最小稳定节点
2. `PartitionLink`
   - 两个分区之间的移动与感知关系边
3. `ScenePartitionGraph`
   - 某个场景的完整拓扑定义

关键点：

- 不要求为每个分区写满 `N x N` 关系
- 只配置关键直连边
- 其余关系由默认规则和二跳衰减推导

### 4.4 输入结构

```ts
type ScenePartition = {
  partitionId: string;
  sceneId: string;
  displayName: string;
  publicLabel: string;
  partitionKind:
    | "entry"
    | "social"
    | "service"
    | "private_edge"
    | "transition";
  playerVisible: boolean;
  defaultPlayerAccess: "open" | "contextual" | "hidden";
  capacityTier: "tight" | "medium" | "open";
  exposureProfile: {
    visibilityExposure: "low" | "medium" | "high";
    audibilityExposure: "low" | "medium" | "high";
  };
  tags: string[];
};

type PartitionLink = {
  fromPartitionId: string;
  toPartitionId: string;
  movementCost: "free" | "light" | "committed";
  visualRelation: "clear" | "partial" | "blocked";
  audioRelation: "clear" | "muffled" | "blocked";
  noticeRelation: "easy" | "normal" | "hard";
  transitionStyle:
    | "open"
    | "through_crowd"
    | "through_threshold"
    | "edge_slide";
  tags: string[];
};

type ScenePartitionGraph = {
  sceneId: string;
  defaultPlayerPartitionId: string;
  partitions: ScenePartition[];
  links: PartitionLink[];
};
```

### 4.5 输出结构

```ts
type SceneTopologyPack = {
  sceneId: string;
  topologyVersion: string;
  partitionGraph: ScenePartitionGraph;
};
```

### 4.6 处理流程

1. 内容层为场景选择一个分区原型或直接定义拓扑
2. 配置分区节点及其暴露标签
3. 配置关键直连边
4. 运行校验器检查孤立分区、超上限和冲突定义
5. 输出可供会话装配和调试工具读取的 `SceneTopologyPack`

### 4.7 设计规格和约束

- 每个场景建议 `3-5` 个分区
- 每个分区建议最多 `2-4` 条显式边
- `visualRelation`、`audioRelation`、`noticeRelation` 只允许离散等级
- 第一版不允许直接配置连续距离或朝向角度
- 若两个分区之间不存在直连边，但存在两跳路径，则允许按默认规则做衰减推导
- 若不存在路径，则默认不可见、不可旁听、不可到达

### 4.8 与上下游的交互边界

- 上游依赖：
  - 世界内容包
  - 关键场景名单
  - 内容模板与原型定义
- 下游输出：
  - 可装配的场景拓扑
  - 校验通过的分区图
- 不负责：
  - 运行时角色位置更新
  - 玩家侧文案生成

### 4.9 【按需追加章节】稀疏拓扑默认推导

为避免数据爆炸，第一版允许对未显式配置的间接关系采用默认推导：

- `visualRelation`
  - 两跳路径时降一级，例如 `clear -> partial`
- `audioRelation`
  - 两跳路径时降一级，例如 `clear -> muffled`
- `noticeRelation`
  - 取路径上更容易暴露的一段

若默认推导与场景语义不一致，内容层应通过显式边覆盖。

### 4.10 透出的接口设计

```ts
function validateScenePartitionGraph(
  graph: ScenePartitionGraph
): {
  isValid: boolean;
  issues: string[];
}

function derivePartitionRelation(
  graph: ScenePartitionGraph,
  fromPartitionId: string,
  toPartitionId: string
): PartitionPerceptionRelation
```

### 4.11 调试要求

调试视图至少应支持：

- 查看某个场景的分区列表
- 查看两分区之间的直接边或推导结果
- 标记某个分区是否为玩家公开分区
- 标记拓扑校验失败原因

### 4.12 示例

酒馆示例：

- 分区：
  - `front_door`
  - `bar_counter`
  - `corner_table`
  - `stairs_landing`
- 关键边：
  - `front_door <-> bar_counter`
  - `bar_counter <-> corner_table`
  - `bar_counter <-> stairs_landing`
  - `stairs_landing <-> corner_table`

由此可以稳定表达：

- 在吧台能看见角落桌，但听不清
- 在楼梯口看不全角落桌，但更容易旁听
- 在前门附近最容易被整场注意到

### 4.13 待处理的问题

- 是否需要允许单向关系边，例如“听得到但回声方向难判断”，`To be confirmed`
- 是否需要把 `movementCost` 与 tick 消耗策略完全解耦，`To be confirmed`

## 5. 玩家空间投影与交互接入

### 5.1 设计目标

本子部分负责定义玩家如何感知这层空间真相，以及这层真相如何接入当前文字 MUD 的观察、侦查、机会生成和分区内移动。

### 5.2 设计原则

- 玩家看到的是压缩后的空间投影，而不是内部矩阵
- 文本描述优先，分区入口和示意信息作为辅助
- 分区内移动应足够轻，不破坏文字游戏节奏
- 机会必须经过空间过滤

### 5.3 设计思路

玩家当前上下文从“只知道当前场景”改为“当前场景 + 当前分区”。

这会直接影响四个环节：

1. `粗观察`
   - 返回当前分区可见、可听与可达信息
2. `主动侦查`
   - 先看目标分区关系，再决定能拿到什么线索
3. `机会生成`
   - 只有当前站位支持的机会才能浮出
4. `分区内移动`
   - 允许在同场景内换位，如“去楼梯口”“靠近角落桌”

### 5.4 输入结构

```ts
type PlayerPartitionProjection = {
  currentPartitionId: string;
  visiblePartitionOptions: {
    partitionId: string;
    label: string;
    moveHint?: string;
  }[];
  spatialSummaryLines: string[];
};

type PartitionPerceptionRelation = {
  targetId: string;
  targetType: "npc" | "object" | "partition";
  visualRelation: "clear" | "partial" | "blocked";
  audioRelation: "clear" | "muffled" | "blocked";
  noticeRelation: "easy" | "normal" | "hard";
};
```

### 5.5 输出结构

```ts
type PlayerPartitionStepResult = {
  projection: PlayerPartitionProjection;
  observationFindings: ObservationFinding[];
  surfacedOpportunities: SurfacedOpportunity[];
};
```

### 5.6 处理流程

1. 读取玩家当前分区
2. 对当前分区可见对象生成粗观察摘要
3. 依据 `visual / audio / notice` 关系构造可侦查目标
4. 玩家若执行 `reposition`，先更新当前分区
5. 再按新站位重算可见、可听和可达机会
6. 只输出当前站位支持的观察结论与机会入口

### 5.7 设计规格和约束

- 玩家侧必须同时支持：
  - 文本空间提示
  - 可选分区入口
  - `To be confirmed`：关键场景轻量示意图
- `reposition` 动作默认不切换场景
- 普通挪位默认不推进 `worldTick`
- 带明显观察意图或社交暴露风险的挪位可以推进 `worldTick`
- 若当前站位不支持看清或听清，则系统不得直接输出完整观察结论

### 5.8 与上下游的交互边界

- 上游依赖：
  - 当前场景分区图
  - 玩家当前分区
  - 当前可见 NPC 和对象
- 下游输出：
  - 玩家空间投影
  - 空间约束后的观察结果
  - 空间约束后的机会列表
- 不负责：
  - 自由文本意图解析细则
  - NPC 主动换位策略

### 5.9 【按需追加章节】玩家动作改动建议

建议在现有 `ParsedPlayerAction` 中增加：

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

### 5.10 透出的接口设计

```ts
function buildPlayerPartitionProjection(
  graph: ScenePartitionGraph | null,
  currentPartitionId: string
): PlayerPartitionProjection

function resolvePartitionRepositionPolicy(
  fromPartitionId: string,
  toPartitionId: string,
  graph: ScenePartitionGraph | null
): {
  consumesTick: boolean;
  noticeRisk: "easy" | "normal" | "hard";
}
```

### 5.11 调试要求

调试视图至少应回答：

- 玩家当前为什么只能“看见”而不能“听清”
- 某个机会为什么没有浮出
- 当前有哪些可去分区入口
- 某次挪位为什么推进或不推进 `worldTick`

### 5.12 示例

玩家位于 `bar_counter`，观察 `corner_table`：

- 可见：
  - 两人在低声争执
  - 桌面上有一件物体被很快压住
- 不可直接获得：
  - 完整对话内容
- 可浮出机会：
  - `继续观察`
  - `靠近角落桌`
  - `去楼梯口旁听`

### 5.13 待处理的问题

- 是否要允许“玩家先选态度，再决定换位”的复合动作，`To be confirmed`
- 玩家是否需要极少量“当前位置风险提示”，`To be confirmed`

## 6. worldTick 与 NPC 感知接入

### 6.1 设计目标

本子部分负责定义场景分区与可见性层如何接入现有 `worldTick` 结算与 NPC `Perceive` 阶段，而不重写既有调度器框架。

### 6.2 设计原则

- 分区层是 tick 内前置判定层，而不是独立时间系统
- 不改写现有 `scene bubble` 思想
- 只扩展 `Perceive` 输入，不重写整条认知链
- 玩家动作先更新站位，再生成感知切片

### 6.3 设计思路

每个有效玩家动作后，在 NPC 响应前插入一层统一的空间切片更新：

`玩家动作 -> 更新玩家分区/相关 NPC 分区 -> 构造分区感知切片 -> NPC Perceive -> 后续认知链 -> 玩家可见结果`

这层的职责是把“谁现在能看见什么、听见什么、是否容易注意到某人”稳定化，然后交给现有调度与认知流程使用。

### 6.4 输入结构

```ts
type PartitionPerceptionSlice = {
  playerProjection: PlayerPartitionProjection;
  playerToNpcRelations: {
    npcId: string;
    visualRelation: "clear" | "partial" | "blocked";
    audioRelation: "clear" | "muffled" | "blocked";
    noticeRelation: "easy" | "normal" | "hard";
  }[];
  npcToNpcRelations: {
    sourceNpcId: string;
    targetNpcId: string;
    visualRelation: "clear" | "partial" | "blocked";
    audioRelation: "clear" | "muffled" | "blocked";
    noticeRelation: "easy" | "normal" | "hard";
  }[];
};
```

### 6.5 输出结构

```ts
type PartitionAwarePerceiveInput = {
  npcId: string;
  currentSceneId: string;
  currentPartitionId?: string;
  partitionSlice: PartitionPerceptionSlice;
  recentEventWindow: WorldEventWindow;
};
```

### 6.6 处理流程

1. 结算玩家动作及其站位变化
2. 更新当前场景关键 NPC 的分区位置
3. 构造 `PartitionPerceptionSlice`
4. 将切片附加到前台与近场 NPC 的 `Perceive` 输入
5. NPC 根据切片决定自己能感知到哪些可见、可听与暴露事实
6. 后续 `Appraise -> Goal -> Action` 继续使用现有链路

### 6.7 设计规格和约束

- 没有分区图的场景应退化为单隐式分区，不得阻塞既有流程
- NPC 不得因为“同场景”就默认知道同场景所有细节
- `Perceive` 阶段必须能区分：
  - 只看见动作
  - 只听见关键词
  - 既看见也听见
  - 观察/换位行为是否容易被注意到
- 第一版只要求关键角色接入分区感知切片；远场摘要默认不逐对计算 `npcToNpcRelations`

### 6.8 与上下游的交互边界

- 上游依赖：
  - 当前世界调度输入
  - 当前场景拓扑
  - 玩家和关键 NPC 当前分区
  - 最近事件窗口
- 下游输出：
  - 空间感知切片
  - 分区约束后的 `Perceive` 输入
- 不负责：
  - 角色换位的高层行为规划
  - 非关键远场角色的全量空间模拟

### 6.9 【按需追加章节】最小接口改动建议

建议在现有对象中增加：

- `PlayerContextSlice.currentPartitionId`
- `NPCScheduleState.currentPartitionId`
- `WorldSimulationInput.sceneTopology?: ScenePartitionGraph`

并新增辅助接口：

```ts
function buildPartitionPerceptionSlice(
  sceneTopology: ScenePartitionGraph | null,
  playerPartitionId: string,
  npcPartitions: { npcId: string; partitionId?: string }[],
  sceneFacts: SceneFactSlice[]
): PartitionPerceptionSlice
```

### 6.10 透出的接口设计

```ts
function attachPartitionSliceToPerceiveInput(
  input: PartitionAwarePerceiveInput
): PartitionAwarePerceiveInput
```

### 6.11 调试要求

调试视图至少应支持：

- 查看某 NPC 当前在哪个分区
- 查看该 NPC 对玩家或另一 NPC 的分区感知关系
- 回答“为什么这个 NPC 注意到了玩家靠近”
- 回答“为什么这个 NPC 只知道有争执，但不知道具体说了什么”

### 6.12 示例

玩家从 `bar_counter` 移到 `stairs_landing` 后：

- 玩家对 `corner_table` 的视觉关系从 `clear` 降为 `partial`
- 玩家对 `corner_table` 的听觉关系从 `muffled` 升为 `clear`
- 角落桌 NPC 对玩家的 `noticeRelation` 从 `normal` 变为 `hard`

于是系统可以稳定得到：

- 玩家更容易旁听关键词
- 玩家更难被立即察觉
- NPC 不会再错误地把“吧台观察”与“楼梯口偷听”视为同一种输入

### 6.13 待处理的问题

- 是否需要为同分区多人场景增加额外“噪音修正”，`To be confirmed`
- 是否需要显式记录“换位被谁看见”的结构化事件，`To be confirmed`

## 7. 配置、模板与降级策略

### 7.1 设计目标

本子部分负责控制内容规模与配置成本，确保分区层不会演变成全量地图数据爆炸或硬编码泥潭。

### 7.2 设计原则

- 关键场景优先，非关键场景延后
- 模板优先于从零手写
- 旧内容必须可平滑降级
- 内容配置必须有自动校验

### 7.3 设计思路

第一版不要求全镇所有地点都立刻配置分区图。建议只覆盖：

- 酒馆
- 旅店大厅
- 治安所
- 火车站/街口等高观察价值地点

为降低配置成本，引入 `scene topology template`：

- `saloon`
- `hotel_lobby`
- `office_frontroom`
- `street_frontage`
- `station_platform`

内容设计者优先从原型实例化，再做少量覆盖，而不是每个地点从零配置。

### 7.4 输入结构

```ts
type SceneTopologyTemplateRef = {
  templateId:
    | "saloon"
    | "hotel_lobby"
    | "office_frontroom"
    | "street_frontage"
    | "station_platform";
  sceneId: string;
  overrides?: {
    addTags?: string[];
    exposureAdjustments?: Record<string, "low" | "medium" | "high">;
    linkOverrides?: {
      fromPartitionId: string;
      toPartitionId: string;
      visualRelation?: "clear" | "partial" | "blocked";
      audioRelation?: "clear" | "muffled" | "blocked";
      noticeRelation?: "easy" | "normal" | "hard";
    }[];
  };
};
```

### 7.5 输出结构

```ts
type ResolvedSceneTopologyPack = {
  sceneId: string;
  templateId?: string;
  topology: ScenePartitionGraph | null;
  fallbackMode: "partitioned" | "scene_default";
};
```

### 7.6 处理流程

1. 判断场景是否属于首批分区覆盖范围
2. 若属于，则优先从模板实例化拓扑
3. 应用少量覆盖项
4. 执行拓扑校验
5. 若无拓扑或校验失败，则回退到 `scene_default`

### 7.7 设计规格和约束

- 只有高价值场景进入第一批拓扑覆盖
- 模板应提供默认分区结构与默认关系边
- 内容配置者不需要提供几何平面图
- 旧场景无拓扑时默认退化为：
  - 单隐式分区 `scene_default`
  - `visualRelation = clear`
  - `audioRelation = clear`
  - `noticeRelation = normal`
- 校验器至少检查：
  - 分区数是否超限
  - 是否存在孤立分区
  - 是否缺少默认入口分区
  - 玩家公开分区是否可达

### 7.8 与上下游的交互边界

- 上游依赖：
  - 世界内容包
  - 首批场景名单
  - 分区原型模板
- 下游输出：
  - 可装配拓扑或回退策略
  - 校验结果
- 不负责：
  - 可视化编辑器
  - 长期内容生产平台

### 7.9 【按需追加章节】配置成本控制建议

建议为内容生产设定以下硬上限：

- 每个场景最多 `5` 个分区
- 每个分区最多 `4` 条显式边
- 每个世界内容包首批最多 `4-5` 个分区化场景

超过上限时，优先合并分区，而不是继续细化规则。

### 7.10 透出的接口设计

```ts
function resolveSceneTopologyPack(
  sceneId: string,
  templateRef?: SceneTopologyTemplateRef
): ResolvedSceneTopologyPack
```

### 7.11 调试要求

调试视图至少应支持：

- 查看某场景是否命中拓扑模板
- 查看哪些覆盖项被应用
- 查看某场景为何退化为 `scene_default`
- 查看拓扑校验报告

### 7.12 示例

示例：`saloon_main` 使用 `saloon` 模板。

- 默认得到 `front_door / bar_counter / corner_table / stairs_landing`
- 内容层只把 `stairs_landing -> corner_table` 覆盖为：
  - `visualRelation = partial`
  - `audioRelation = clear`
  - `noticeRelation = hard`

这样就能快速得到“适合偷听但看不全”的语义，而不必从零手工造图。

### 7.13 待处理的问题

- 后续是否需要面向内容作者的可视化校验工具，`To be confirmed`
- 是否要把“关键场景名单”独立成世界内容包元数据，`To be confirmed`

## 8. 版本记录

- `v0.1`
  - 建立场景分区与可见性设计文档第一版
  - 锁定第一版采用“分区级空间真相 + 玩家压缩投影 + NPC 精细感知”的方案
  - 明确分区拓扑对象、接入玩家循环与 `worldTick` 的方式、模板化配置与降级规则
