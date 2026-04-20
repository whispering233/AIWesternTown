# 物品系统与交互设计

## 1. Document Overview

| Item | Content |
| --- | --- |
| Document title | `AIWesternTown item system and interaction solution` |
| Business goal | 为第一版定义稳定、可实现、可调试的物品系统，使物品成为世界运行中的一等实体，并让玩家与 NPC 都能围绕物品产生拿取、转移、藏匿、使用和发现后果。 |
| Scope | 覆盖物品世界实体语义、角色持有与场景容器边界、九类物品动作、隐蔽行为与发现规则、物品如何接入玩家循环、NPC 认知与 world tick 调度。 |
| Non-goals | 不覆盖装备槽与战斗属性；不覆盖商店经济、价格与买卖系统；不覆盖重量、耐久、容量数值模拟；不覆盖可移动容器；不展开数据库表设计和 REST/API 契约。 |
| Target readers | 产品设计者、玩法与仿真实现者、NPC 认知实现者、内容配置者、调试工具实现者、后续 schema/API 设计者。 |
| Assumptions | 母稿已锁定“规则主导，LLM 附着”的边界；玩家与 NPC 都需要支持对称物品行为；第一版只支持场景固定容器；数据模型与配置 schema 由 [43-item-schema-and-content-config.md](C:/codex/project/AIWesternTown/doc/43-item-schema-and-content-config.md) 承接。 |

## 2. Solution Overview

| Item | Content |
| --- | --- |
| Solution summary | 第一版采用“世界实体优先 + 真相与认知分层”的物品系统。规则层维护唯一物品占有真相；玩家与 NPC 都通过统一动作语义改变占有关系；感知、记忆、观察和调度层只消费结构化物品事实，不以文本反推真相。 |
| Sub-parts or sub-flows | `物品世界实体与占有语义`、`物品动作集与合法性判定`、`隐蔽行为、发现与后果`、`与玩家循环 / NPC 认知 / 世界调度的接入` |
| Key design decisions | 物品是运行时一等实体；角色携带物通过直接持有表达，不通过背包容器表达；场景固定容器与普通物品分离建模；`request` 先进入社交响应，不直接越权改状态；`steal` 与 `plant_back` 默认属于隐蔽动作。 |
| Overall constraints | 不能让物品只是文本装饰；不能让 NPC 自动全知所有物品位置；不能让自由文本直接创造新物品语义；不能把偷拿和放回简化成无后果的瞬时菜单；不能让同一物品同时存在多重占有真相。 |
| Dependencies | [00-master-design.md](C:/codex/project/AIWesternTown/doc/00-master-design.md)、[20-core-game-loop.md](C:/codex/project/AIWesternTown/doc/20-core-game-loop.md)、[25-scene-partition-and-visibility.md](C:/codex/project/AIWesternTown/doc/25-scene-partition-and-visibility.md)、[30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md)、[40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md)、[43-item-schema-and-content-config.md](C:/codex/project/AIWesternTown/doc/43-item-schema-and-content-config.md) |
| Risks and open confirmation items | 首批关键物与容器数量上限仍需实测；隐蔽动作的发现阈值与场景可见性如何共同计算仍需校准；是否需要独立的“搜身 / 搜查”动作仍为 `To be confirmed`；玩家 UI 如何呈现自己对外部物品关系的认知层仍待后续前端设计收敛。 |

## 3. 物品世界实体与占有语义

### 3.1 设计目标

本子部分负责定义物品在第一版世界中的基本存在方式，回答以下问题：

1. 什么对象算作“物品”
2. 玩家和 NPC 身上携带的物品如何表达
3. 场景容器和秘密藏匿位如何区分
4. 规则层的唯一物品真相如何形成

### 3.2 设计原则

- 物品是世界中的一等实体，不是纯叙事标签
- 物品位置与占有关系只能有一个权威真相来源
- 角色直接持有物品，不使用可移动容器模拟库存
- 容器和藏匿位都属于世界对象，但职责不同
- 真相层与认知层必须分离

### 3.3 设计思路

第一版采用“四态占有语义”：

1. `scene`
   - 物品显式位于某个场景，可被场景观察或拿取
2. `container`
   - 物品位于场景固定容器中，需要容器访问资格
3. `actor`
   - 物品由玩家或 NPC 直接持有，并通过 `carryMode` 与 `visibilityToOthers` 表达对外可见性
4. `hidden_stash`
   - 物品被藏在场景中的秘密藏匿位，不等于普通容器

关键约定：

- 第一版不做“背包中的容器”
- 第一版不做“多个角色共同持有”或“半持有”状态
- 玩家和 NPC 的 `inventoryItemIds` 都只是权威占有真相的投影结果

### 3.4 输入结构

```ts
type ItemWorldInitializationInput = {
  itemInstances: ItemInstanceSeedV1[];
  containerInstances: ContainerInstanceSeedV1[];
  ownershipSeeds: ItemOwnershipV1[];
  sceneTopology: SceneGraphSlice;
  actorIds: string[];
};
```

```ts
type ItemReachabilityContext = {
  currentSceneId: string;
  currentPartitionId?: string;
  visibleActorIds: string[];
  visibleContainerIds: string[];
  visibleLooseItemIds: string[];
};
```

### 3.5 输出结构

```ts
type ItemWorldRuntimeSlice = {
  sceneLooseItems: {
    sceneId: string;
    itemIds: string[];
  }[];
  containerContents: {
    containerId: string;
    itemIds: string[];
  }[];
  actorCarryState: {
    actorId: string;
    itemIds: string[];
  }[];
  hiddenStashState: {
    sceneId: string;
    stashSlotId: string;
    itemIds: string[];
  }[];
};
```

```ts
type ActorInventoryProjection = {
  actorId: string;
  inventoryItemIds: string[];
  obviousCarriedItemIds: string[];
  hiddenCarriedItemIds: string[];
};
```

### 3.6 处理流程

1. 会话初始化读取物品实例、容器实例与初始占有关系
2. 规则层校验每个 `itemId` 只命中一条有效占有关系
3. 根据占有真相生成场景、容器、角色、藏匿位四类运行时投影
4. 在每次物品动作结算后，只更新权威占有关系
5. 再由权威占有关系重新投影：
   - 场景可见散落物
   - 容器内物品
   - 玩家/NPC 当前持有物
   - 隐藏藏匿位内容

### 3.7 设计规格和约束

- 同一 `itemId` 同一时刻只能有一条有效占有记录
- `actor` 持有的物品必须明确：
  - `carryMode = in_hand | on_body | concealed`
  - `visibilityToOthers = obvious | noticeable | hidden`
- `container` 必须绑定固定 `sceneId`
- `hidden_stash` 默认不进入普通观察结果，除非命中发现链路
- 第一版不做“容器里再放容器”

### 3.8 与上下游的交互边界

- 上游依赖：
  - 物品实例、容器实例和初始占有 schema
  - 场景拓扑和场景分区真相
- 下游输出：
  - 玩家和 NPC 的库存投影
  - 场景散落物与容器内容切片
  - 物品可接触性判断输入
- 不负责：
  - 记忆写入
  - 自然语言渲染
  - 数据库存储细节

### 3.9 透出的接口设计

```ts
function buildItemWorldRuntime(
  input: ItemWorldInitializationInput
): ItemWorldRuntimeSlice
```

```ts
function projectActorInventory(
  actorId: string,
  ownerships: ItemOwnershipV1[]
): ActorInventoryProjection
```

### 3.10 调试要求

调试视图至少应展示：

- 某个物品当前的唯一占有真相
- 某个角色当前持有哪些物品
- 哪些物品是明显可见持有，哪些是贴身隐藏持有
- 某个场景当前的散落物、容器内容和藏匿位内容

### 3.11 示例

示例：

- `ledger_main` 当前由 `doctor` 持有
- `carryMode = concealed`
- `visibilityToOthers = hidden`

则世界真相表示：

- 账本在医生身上
- 医生自己的库存投影中包含它
- 其他角色默认不会在普通观察中看到它
- 若医生稍后把账本塞进旅店二楼抽屉，则占有关系从 `actor` 变成 `container`

### 3.12 待处理的问题

- `hidden_stash` 是否需要按场景模板统一定义，而不是临时自由创建，`To be confirmed`
- `visibilityToOthers` 是否应进一步区分“搜查可见”和“普通观察可见”，`To be confirmed`

## 4. 物品动作集与合法性判定

### 4.1 设计目标

本子部分负责定义第一版支持的物品动作集合，并明确规则层如何判断动作是否合法、是否可执行以及是否必须转入社交响应或隐蔽动作结算。

### 4.2 设计原则

- 动作语义统一，玩家与 NPC 共用同一套物品动作词汇
- 合法性由规则层硬判，不由 LLM 自由决定
- 请求与交付类动作优先进入社交交互，不直接越权改状态
- 隐蔽动作需要独立的暴露/发现后果，不等于普通拾取
- `use_item` 必须映射到受控效果

### 4.3 设计思路

第一版固定支持以下 9 个动作：

1. `pick_up`
2. `drop`
3. `put_into_container`
4. `take_from_container`
5. `give`
6. `request`
7. `steal`
8. `plant_back`
9. `use_item`

动作分类：

- `公开直接转移`
  - `pick_up`、`drop`、`put_into_container`、`take_from_container`、`give`
- `社交申请`
  - `request`
- `隐蔽转移`
  - `steal`、`plant_back`
- `效果触发`
  - `use_item`

### 4.4 输入结构

```ts
type ItemActionIntent = {
  actionId: string;
  actorId: string;
  actionType:
    | "pick_up"
    | "drop"
    | "put_into_container"
    | "take_from_container"
    | "give"
    | "request"
    | "steal"
    | "plant_back"
    | "use_item";
  itemId: string;
  targetActorId?: string;
  targetContainerId?: string;
  targetSceneId?: string;
};
```

```ts
type ItemActionContext = {
  currentTick: number;
  actorSceneId: string;
  ownership: ItemOwnershipV1;
  reachableItemIds: string[];
  reachableContainerIds: string[];
  visibleActorIds: string[];
  executionPolicyTags: string[];
};
```

### 4.5 输出结构

```ts
type ItemActionValidationResult = {
  actionId: string;
  isAllowed: boolean;
  resolutionMode: "direct" | "social_request" | "covert" | "effect" | "blocked";
  blockReasonTags: string[];
  requiredWitnessCheck: boolean;
  resultingOwnershipPatch?: ItemOwnershipV1;
};
```

```ts
type ItemActionExecutionResult = {
  actionId: string;
  success: boolean;
  emittedEventTypes: string[];
  ownershipPatch?: ItemOwnershipV1;
  followupPromptTags: string[];
};
```

### 4.6 处理流程

1. 解析动作意图，确认目标物品和目标对象
2. 读取当前占有真相和可接触性上下文
3. 校验动作类型是否在物品模板 `allowedActions` 中
4. 校验前置条件：
   - 是否在场或可接触
   - 是否由自己持有
   - 容器是否可访问
   - 目标角色是否在场
   - 当前策略和禁忌是否阻断
5. 根据动作类型决定结算模式：
   - `request` 进入 `social_request`
   - `steal` / `plant_back` 进入 `covert`
   - `use_item` 进入 `effect`
   - 其余默认 `direct`
6. 生成占有补丁、事件和后续认知线索

### 4.7 设计规格和约束

- `request` 不能直接改写占有真相，只能生成社交响应入口
- `give` 需要双方在场且目标角色可接收
- `steal` 可针对：
  - 他人直接持有物
  - 受限容器中的物
- `plant_back` 可把物品放回：
  - 场景
  - 场景容器
  - 既定藏匿位
- `use_item` 只允许走模板登记过的 `useEffectId`
- 动作失败时也应产出阻断原因标签，供认知与调试使用

### 4.8 与上下游的交互边界

- 上游依赖：
  - 玩家动作解析结果
  - NPC `Action Selection` 输出
  - 当前物品占有真相与 reachability 切片
- 下游输出：
  - 占有关系补丁
  - 物品相关事件
  - 发现/暴露检查输入
- 不负责：
  - 目击者是否注意到
  - 记忆与信念写入
  - 文本台词生成

### 4.9 透出的接口设计

```ts
function validateItemAction(
  intent: ItemActionIntent,
  context: ItemActionContext
): ItemActionValidationResult
```

```ts
function executeItemAction(
  validation: ItemActionValidationResult
): ItemActionExecutionResult
```

### 4.10 调试要求

调试视图至少展示：

- 当前动作属于哪一类物品动作
- 校验阶段命中的前置条件与阻断原因
- 动作进入了哪种结算模式
- 最终是否真的改写了占有关系

### 4.11 示例

示例：医生尝试从治安官身上暗中拿走账本。

1. `actionType = steal`
2. 当前账本由 `sheriff` 持有，且 `visibilityToOthers = noticeable`
3. 动作校验通过，但要求进行隐蔽暴露检查
4. 若成功，则占有关系改为：
   - `holderType = actor`
   - `actorId = doctor`
   - `carryMode = concealed`
   - `visibilityToOthers = hidden`
5. 同时产出 `item_stolen` 事件和后续目击者检查输入

### 4.12 待处理的问题

- 是否需要单独的 `inspect_container` 或 `search_person` 动作，`To be confirmed`
- `request` 是否应支持“请求放到某处”这种组合动作，`To be confirmed`

## 5. 隐蔽行为、发现与后果

### 5.1 设计目标

本子部分负责回答“偷拿或偷偷放回以后，谁会知道、谁只会起疑、谁完全不知道”，并明确这些结果如何进入观察、记忆和局势后果链路。

### 5.2 设计原则

- 世界真相改变不等于所有角色立即知道
- 发现链路建立在空间真相和感知能力之上
- 暴露结果要支持“看到”“怀疑”“只知道东西不见了”三层差异
- 隐蔽动作默认不进入全场公开播报
- 缺失发现也是有效后果

### 5.3 设计思路

第一版把物品隐蔽行为的后果拆成三层：

1. `witnessed`
   - 直接看到谁对什么物品做了什么
2. `noticed_irregularity`
   - 没看清过程，但注意到异常，例如“抽屉被翻过”“某人刚离开吧台”
3. `missing_or_misplaced_detected`
   - 事后发现物品不在原处或被放回原处

这三层结果分别影响：

- `Perceive`
- 工作记忆和怀疑更新
- 后续索要、找物、对质和站队

### 5.4 输入结构

```ts
type CovertItemResolutionInput = {
  executionResult: ItemActionExecutionResult;
  sceneId: string;
  partitionTopology: ScenePartitionTopologySlice;
  candidateWitnesses: WitnessCandidate[];
  affectedItemId: string;
};
```

```ts
type WitnessCandidate = {
  actorId: string;
  relationToScene: "same_partition" | "adjacent_partition" | "same_scene_far" | "off_scene";
  attentionState: "focused" | "available" | "distracted";
};
```

### 5.5 输出结构

```ts
type CovertItemResolutionResult = {
  witnessedByActorIds: string[];
  irregularityNoticedByActorIds: string[];
  delayedMissingCheckActorIds: string[];
  perceivedEventTags: string[];
};
```

### 5.6 处理流程

1. 隐蔽动作结算后，先确认发生地点与影响物品
2. 根据场景分区与可见性选出候选目击者
3. 结合物品持有可见性、容器可见性和目击者当前注意状态
4. 输出三层后果：
   - 直接目击
   - 异常察觉
   - 延迟发现缺失
5. 将这些结果转成结构化事件与认知输入：
   - `visibleActions`
   - `visibleClues`
   - `recentLocalEvents`

### 5.7 设计规格和约束

- `steal` 与 `plant_back` 默认必须走暴露检查
- 直接目击不要求看到完整细节，但必须知道“谁对物品做了动作”
- 仅察觉异常时，不得自动生成“知道犯人是谁”
- 延迟缺失发现通常发生在：
  - 原持有者试图使用物品
  - 原知情者去原位查看
  - 玩家或 NPC 主动检查容器/身上物
- 被放回的物品仍可能留下异常痕迹或认知残留

### 5.8 与上下游的交互边界

- 上游依赖：
  - 物品动作执行结果
  - 场景分区与可见性切片
  - 目击者候选集合
- 下游输出：
  - 直接进入感知阶段的物品事件
  - 对怀疑、记忆和找物行为的输入线索
- 不负责：
  - 最终社交后果文本
  - 长期记忆压缩

### 5.9 透出的接口设计

```ts
function resolveCovertItemConsequences(
  input: CovertItemResolutionInput
): CovertItemResolutionResult
```

### 5.10 调试要求

调试视图至少展示：

- 哪些角色被纳入目击者候选
- 为什么有人只察觉异常而非直接目击
- 哪些角色会在之后触发“物品不见了”的延迟发现
- 某次偷拿或放回最终向哪些认知输入写了什么

### 5.11 示例

示例：玩家从酒馆吧台抽屉偷拿钥匙。

- 酒馆老板在同分区，`attentionState = focused`
- 角落里的医生在同场景远端，`attentionState = distracted`

结果：

- 酒馆老板进入 `witnessed`
- 医生只进入 `noticed_irregularity`
- 若玩家之后把钥匙放回抽屉，老板可能只记住“有人动过抽屉”，但不一定当场发现钥匙已归位

### 5.12 待处理的问题

- 异常痕迹是否应作为独立 `visibleClue` 类型长期保留，`To be confirmed`
- 是否需要给“刚放回但摆放不自然”增加单独标签，`To be confirmed`

## 6. 与玩家循环、NPC 认知和世界调度的接入

### 6.1 设计目标

本子部分负责把物品系统接入现有主链路，明确物品如何进入玩家观察与机会、NPC 感知与动作、以及 world tick 调度与事件系统。

### 6.2 设计原则

- 物品系统不单独开一套仿真时钟
- 物品相关事件必须走统一 world tick 与事件结算链路
- 玩家和 NPC 的物品动作都要回到同一认知与调度骨架
- 机会层只暴露当前主体可知、可做的物品行为
- 调试与回放必须能解释“物品为什么会到这里”

### 6.3 设计思路

接入路径固定为：

`物品真相 -> 玩家可见观察 / NPC ObservableWorldSlice -> 机会或 ActionCandidate -> ItemAction -> WorldEvent -> Perceive / Reflect / 调度`

具体约定：

- 玩家在粗观察和深观察中可以看到：
  - 场景散落物
  - 显眼持有物
  - 可疑缺失或容器异常
- NPC 在 `Perceive` 阶段可以注意到：
  - 物品出现 / 消失
  - 他人公开持有或可疑藏匿
  - 容器被翻动或秘密证据被拿走
- `Action Selection` 可产出物品相关动作候选，但必须通过合法性判定
- 调度器只决定谁跑，不直接决定物品占有关系写入

### 6.4 输入结构

```ts
type ItemIntegrationInput = {
  worldTick: number;
  playerContext: PlayerContextSlice;
  npcScheduleStates: NPCScheduleState[];
  itemWorld: ItemWorldRuntimeSlice;
  recentItemEvents: string[];
};
```

### 6.5 输出结构

```ts
type ItemIntegrationOutput = {
  surfacedOpportunities: SurfacedOpportunity[];
  npcActionCandidates: ActionCandidate[];
  observableItemEvents: WorldEventRecord[];
  debugItemSummary: {
    movedItemIds: string[];
    discoveredIrregularityItemIds: string[];
  };
};
```

### 6.6 处理流程

1. 规则层从当前物品真相生成玩家观察输入和 NPC 可观察切片
2. 玩家深观察可把异常物品和容器状态转成机会
3. NPC 认知循环把物品事件纳入 `Perceive -> Appraise -> Update Working Memory`
4. 玩家或 NPC 选择物品动作后，进入统一动作合法性判定与结算
5. 结算结果写回：
   - 物品占有关系
   - 世界事件窗口
   - 认知输入与记忆候选
6. 调度器在下一 tick 再根据事件热度和可见性影响前台、近场、远场

### 6.7 设计规格和约束

- 玩家自己的持有物必须始终进入前端库存视图
- 玩家对外部物品的已知关系只来自观察、调查、对话或记忆，不得默认全知
- NPC 的 `inventoryItemIds` 只代表当前真实持有，不代表其知道所有相关物在哪里
- 物品事件必须可进入 `recentEventWindow`
- `ActionCandidate.targetObjectIds` 必须能指向物品实例 ID

### 6.8 与上下游的交互边界

- 上游依赖：
  - 核心玩法循环的观察与机会机制
  - NPC 认知主链路
  - 世界调度与事件窗口
- 下游输出：
  - 玩家物品机会
  - NPC 物品动作候选
  - item-related world events
- 不负责：
  - 前端 UI 样式
  - 数据库存储与 API 划分

### 6.9 【按需追加章节】与 LLM 的交互边界

第一版规则层负责：

- 物品动作合法性
- 占有关系写入
- 发现与缺失检查
- 物品事件结构化结果

LLM 可按需参与：

- 物品相关对话响应文本
- 物品异常的叙事化渲染
- 物品行为的社交意图解释

但 LLM 不得直接决定：

- 某个物品是否存在
- 某个角色是否真实持有
- 某次偷拿是否成功

### 6.10 透出的接口设计

```ts
function buildItemDrivenOpportunities(
  input: ItemIntegrationInput
): SurfacedOpportunity[]
```

```ts
function buildNpcItemActionCandidates(
  input: ItemIntegrationInput
): ActionCandidate[]
```

### 6.11 调试要求

调试视图至少应展示：

- 当前 tick 内哪些物品发生了占有变化
- 某个机会为什么能浮出或没能浮出
- 某个 NPC 为什么把某物视为高风险或高机会
- 某个物品事件为什么把某 NPC 拉入近场或下一轮高优先级

### 6.12 示例

示例：玩家在旅店二楼发现抽屉被翻动。

1. 深观察识别出异常容器状态
2. 系统浮出机会：
   - 继续检查抽屉
   - 询问最近来过二楼的人
   - 跟随刚离开的医生
3. 若玩家随后发现账本不见了，则这条物品缺失事件进入 `recentEventWindow`
4. 与账本相关的 NPC 在下一 tick 可被调度器提高热度

### 6.13 待处理的问题

- 物品相关机会是否应单独限制每轮浮出上限，`To be confirmed`
- 物品事件是否需要单独的热度衰减曲线，`To be confirmed`

## 7. 版本记录

- `v0.1`
  - 建立物品系统与交互设计文档第一版
  - 锁定物品为一等实体、角色直接持有、场景固定容器和真相/认知分层方案
  - 锁定九类物品动作、隐蔽行为发现链路和与玩法循环/认知/调度的接入边界
