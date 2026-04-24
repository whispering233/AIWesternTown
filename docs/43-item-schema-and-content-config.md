# 物品数据模型与内容配置设计

## 1. Document Overview

| Item | Content |
| --- | --- |
| Document title | `AIWesternTown item schema and content configuration solution` |
| Business goal | 为第一版物品系统提供稳定、可复用、可校验的数据模型与内容配置 schema，使开发者、内容作者和会话装配器可以在不混淆职责的前提下定义物品模板、容器模板、实例、占有真相和初始认知。 |
| Scope | 覆盖物品模板与容器模板 schema、物品实例和容器实例 schema、权威占有关系 schema、初始认知 schema、使用效果 registry、会话装配覆盖和校验约束。 |
| Non-goals | 不覆盖数据库表设计与索引策略；不覆盖 REST/API 契约；不展开前端存档格式；不覆盖可移动容器 schema；不覆盖经济、装备、耐久和重量等扩展属性。 |
| Target readers | 数据模型设计者、内容配置者、仿真实现者、调试工具实现者、后续数据库/API 设计者。 |
| Assumptions | 物品系统采用“世界实体优先 + 真相与认知分层”方案；场景固定容器与普通物品分离建模；运行时库存只是占有真相的投影；物品交互设计由 [42-item-system-and-interaction.md](C:/codex/project/AIWesternTown/doc/42-item-system-and-interaction.md) 承接。 |

## 2. Solution Overview

| Item | Content |
| --- | --- |
| Solution summary | 第一版把物品相关 schema 拆成模板层、实例层、真相层、认知层和会话装配层。模板层定义能力边界，实例层定义世界具体对象，真相层定义唯一物品占有关系，认知层定义谁知道什么，会话装配层负责按剧本和测试场景覆盖开局。 |
| Sub-parts or sub-flows | `schema 分层与对象清单`、`权威占有与运行时投影 schema`、`认知与内容配置 schema`、`会话装配与校验流程` |
| Key design decisions | `ItemTemplate` 与 `ContainerTemplate` 分离；角色直接持有不通过容器表达；`ItemOwnership` 是唯一真相源；`ItemKnowledge` 不得反向定义真相；会话装配只允许覆盖实例、真相和认知，不重写模板能力。 |
| Overall constraints | 不能把物品模板与容器模板混成同一对象；不能让内容作者配置底层规则公式；不能让多个 schema 同时成为物品位置真相源；不能让配置层发明引擎不支持的新动作或新效果。 |
| Dependencies | [10-world-and-narrative.md](C:/codex/project/AIWesternTown/doc/10-world-and-narrative.md)、[30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md)、[40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md)、[42-item-system-and-interaction.md](C:/codex/project/AIWesternTown/doc/42-item-system-and-interaction.md) |
| Risks and open confirmation items | 首批 `affordanceTags` 枚举仍需收敛；是否需要独立的 `stashSlot` 模板仍为 `To be confirmed`；长期看是否要把 `ItemKnowledge` 升级为更完整的记忆写入 schema 需要后续验证；存档层是否保存“完整真相快照 + 派生投影”仍待后续工程实现确认。 |

## 3. Schema 分层与对象清单

### 3.1 设计目标

本子部分负责定义第一版物品 schema 的分层原则，并明确不同角色分别配置什么对象。

### 3.2 设计原则

- 模板、实例、真相、认知、装配必须分层
- 开发者定义能力边界，内容作者消费能力，不自创规则
- 会话装配只覆盖局内具体开局，不污染模板定义
- schema 命名和字段语义必须稳定且可校验

### 3.3 设计思路

第一版 schema 分为五层：

1. `template`
   - `ItemTemplateV1`
   - `ContainerTemplateV1`
   - `UseEffectDefV1`
2. `instance`
   - `ItemInstanceSeedV1`
   - `ContainerInstanceSeedV1`
3. `truth`
   - `ItemOwnershipV1`
4. `knowledge`
   - `ItemKnowledgeSeedV1`
5. `session assembly`
   - `SessionItemAssemblyV1`

角色边界：

- 开发者主要维护模板层
- 内容作者主要维护实例层、初始真相和初始认知
- 会话装配器或测试工具只改装配层覆盖

### 3.4 输入结构

```ts
type ItemSchemaBundleV1 = {
  itemTemplates: ItemTemplateV1[];
  containerTemplates: ContainerTemplateV1[];
  useEffects: UseEffectDefV1[];
  itemInstances: ItemInstanceSeedV1[];
  containerInstances: ContainerInstanceSeedV1[];
  ownership: ItemOwnershipV1[];
  knowledge: ItemKnowledgeSeedV1[];
};
```

### 3.5 输出结构

```ts
type ValidatedItemSchemaBundleV1 = ItemSchemaBundleV1 & {
  validationSummary: {
    itemTemplateCount: number;
    itemInstanceCount: number;
    ownershipCount: number;
    knowledgeCount: number;
    errors: string[];
  };
};
```

### 3.6 处理流程

1. 读取模板层定义
2. 校验实例是否都能找到对应模板
3. 校验每个物品实例只有一条有效初始占有真相
4. 校验认知记录只引用已存在的 actor 与 item
5. 输出校验后的物品 schema bundle

### 3.7 设计规格和约束

- 所有 ID 命名保持统一：
  - `templateId`
  - `itemId`
  - `containerId`
  - `useEffectId`
- enum 值统一使用小写蛇形或小写短横语义，不混用大小写
- 同一文档内不允许既叫 `holderId` 又叫 `actorId`
- 缺失字段语义必须通过 `To be confirmed` 标注，不得静默省略

### 3.8 与上下游的交互边界

- 上游依赖：
  - 世界与叙事内容包
  - 角色与场景 ID 池
- 下游输出：
  - 会话装配可消费的物品 schema
  - 运行时真相与认知初始化输入
- 不负责：
  - 数据库存储形式
  - API 入参与返回格式

### 3.9 透出的接口设计

```ts
function validateItemSchemaBundle(
  bundle: ItemSchemaBundleV1
): ValidatedItemSchemaBundleV1
```

### 3.10 调试要求

调试视图至少展示：

- 每层 schema 的对象数量
- 哪个实例缺少对应模板
- 哪个物品缺失占有真相或拥有多条真相
- 哪条认知记录引用了不存在的角色或物品

### 3.11 示例

示例：

- `ledger_main` 引用 `templateId = ledger`
- `hotel_room_2_drawer` 引用 `templateId = drawer_basic`
- `ledger_main` 只有一条初始占有：
  - `holderType = actor`
  - `actorId = sheriff`

这说明：

- 模板层与实例层关系正确
- 真相层无重复占有
- 认知层可再单独配置谁知道账本在哪里

### 3.12 待处理的问题

- 是否需要把 `affordanceTags` 和 `narrativeTags` 拆成注册表，`To be confirmed`

## 4. 权威占有与运行时投影 schema

### 4.1 设计目标

本子部分负责定义唯一物品真相的 schema，以及运行时如何从真相层派生出库存和场景内容投影。

### 4.2 设计原则

- `ItemOwnershipV1` 是唯一占有真相源
- 运行时投影不得反向定义真相
- 角色持有通过 `actor` 分支直接表达
- `hidden_stash` 与 `container` 语义分离

### 4.3 设计思路

`ItemOwnershipV1` 固定为以下四类分支：

- `scene`
- `container`
- `actor`
- `hidden_stash`

玩家与 NPC 当前库存不是单独配置对象，而是运行时投影：

`all items where holderType = actor and actorId = X`

### 4.4 输入结构

```ts
type ItemOwnershipV1 =
  | { itemId: string; holderType: "scene"; sceneId: string }
  | { itemId: string; holderType: "container"; containerId: string; sceneId: string }
  | {
      itemId: string;
      holderType: "actor";
      actorId: string;
      carryMode: "in_hand" | "on_body" | "concealed";
      visibilityToOthers: "obvious" | "noticeable" | "hidden";
    }
  | { itemId: string; holderType: "hidden_stash"; sceneId: string; stashSlotId: string };
```

### 4.5 输出结构

```ts
type DerivedItemProjectionV1 = {
  actorInventories: {
    actorId: string;
    inventoryItemIds: string[];
  }[];
  sceneLooseItems: {
    sceneId: string;
    itemIds: string[];
  }[];
  containerContents: {
    containerId: string;
    itemIds: string[];
  }[];
};
```

### 4.6 处理流程

1. 遍历全部 `ItemOwnershipV1`
2. 按 `holderType` 路由到对应投影桶
3. 对 `actor` 分支额外生成：
   - 当前库存
   - 对外显眼持有物
   - 当前隐藏持有物
4. 把派生结果交给玩家 UI、NPC 感知和调试层

### 4.7 设计规格和约束

- `scene` 分支不得携带 `containerId`
- `container` 分支必须同时绑定：
  - `containerId`
  - `sceneId`
- `actor` 分支必须同时携带：
  - `carryMode`
  - `visibilityToOthers`
- `hidden_stash` 不是普通容器，默认不进入容器列表投影
- 派生投影可以缓存，但必须由真相层重建，不得单独持久化为权威源

### 4.8 与上下游的交互边界

- 上游依赖：
  - 物品实例与容器实例
  - 场景与角色 ID 有效集
- 下游输出：
  - 玩家/NPC 库存投影
  - 场景与容器可见内容切片
  - 隐蔽行为与发现检查输入
- 不负责：
  - 认知是否知道这些投影
  - 行为合法性判定

### 4.9 透出的接口设计

```ts
function deriveItemProjections(
  ownerships: ItemOwnershipV1[]
): DerivedItemProjectionV1
```

### 4.10 调试要求

调试视图至少展示：

- 某个物品当前命中的 `holderType`
- 某个角色库存是由哪些 `actor` 分支投影出来的
- 哪些物品属于 `hidden_stash`，但不在普通容器投影中

### 4.11 示例

```ts
{
  itemId: "ledger_main",
  holderType: "actor",
  actorId: "doctor",
  carryMode: "concealed",
  visibilityToOthers: "hidden"
}
```

该记录说明：

- 世界真相是账本在医生身上
- 医生库存投影中包含它
- 其他角色的普通场景观察不应默认看到它

### 4.12 待处理的问题

- `carryMode` 与 `visibilityToOthers` 是否应该进一步拆成更细的规则档，`To be confirmed`

## 5. 认知与内容配置 schema

### 5.1 设计目标

本子部分负责定义内容作者如何配置具体物品、容器和初始认知，并明确“物品在哪里”和“谁知道它在哪里”为什么必须分开建模。

### 5.2 设计原则

- 内容作者配置世界对象和初始状态，不配置底层引擎规则
- 初始认知与占有真相分离
- `use_item` 的效果由开发者注册，不由内容作者自由发明
- 关键物标记只服务于剧情与调试，不改变基础占有语义

### 5.3 设计思路

内容层最小 schema 由以下对象组成：

```ts
type ItemTemplateV1 = {
  templateId: string;
  displayName: string;
  itemKind: "document" | "key" | "tool" | "consumable" | "valuable" | "misc";
  allowedActions: (
    | "pick_up"
    | "drop"
    | "put_into_container"
    | "take_from_container"
    | "give"
    | "request"
    | "steal"
    | "plant_back"
    | "use_item"
  )[];
  affordanceTags: string[];
  useEffectId?: string;
};

type ContainerTemplateV1 = {
  templateId: string;
  displayName: string;
  access: "open" | "closed" | "restricted";
  visibility: "public" | "low_profile" | "hidden";
};

type ItemInstanceSeedV1 = {
  itemId: string;
  templateId: string;
  displayNameOverride?: string;
  narrativeTags?: string[];
  isCritical?: boolean;
};

type ContainerInstanceSeedV1 = {
  containerId: string;
  templateId: string;
  sceneId: string;
  displayNameOverride?: string;
};

type ItemKnowledgeSeedV1 = {
  actorId: string;
  itemId: string;
  knowledgeType: "owns" | "saw" | "knows_location" | "suspects_holder" | "is_seeking";
  confidence: "low" | "medium" | "high";
};

type UseEffectDefV1 = {
  useEffectId: string;
  effectType:
    | "read_document"
    | "unlock_simple_access"
    | "consume_simple_item"
    | "deliver_proof"
    | "place_evidence";
  requiredAffordanceTags?: string[];
  outputEventType: string;
};
```

### 5.4 输入结构

```ts
type ContentItemConfigInput = {
  itemTemplates: ItemTemplateV1[];
  containerTemplates: ContainerTemplateV1[];
  itemInstances: ItemInstanceSeedV1[];
  containerInstances: ContainerInstanceSeedV1[];
  knowledge: ItemKnowledgeSeedV1[];
  useEffects: UseEffectDefV1[];
};
```

### 5.5 输出结构

```ts
type ContentItemConfigOutput = {
  enabledTemplateIds: string[];
  enabledItemIds: string[];
  enabledContainerIds: string[];
  initialKnowledgeSummary: {
    actorId: string;
    knownItemIds: string[];
  }[];
};
```

### 5.6 处理流程

1. 开发者定义模板层与 `useEffect` registry
2. 内容作者基于模板创建实例
3. 内容作者为物品和角色配置初始认知
4. 校验每个认知记录只引用已存在对象
5. 将模板、实例和认知打包进内容包

### 5.7 设计规格和约束

- 内容作者不得新建引擎未支持的 `actionType`
- `isCritical` 不能直接带来“不可偷”或“不可丢”之类特殊规则
- `knowledgeType = owns` 只表达“主体知道自己持有”
- `knowledgeType = knows_location` 可以过时，不保证世界真相仍然如此
- `useEffectId` 若存在，必须能在 registry 中解析到

### 5.8 与上下游的交互边界

- 上游依赖：
  - 场景、角色和剧情内容包
- 下游输出：
  - 物品与容器内容配置
  - 初始认知内容配置
  - `use_item` 可消费的效果注册表
- 不负责：
  - 会话内动态变更
  - 动作执行后的认知更新

### 5.9 透出的接口设计

```ts
function buildContentItemConfig(
  input: ContentItemConfigInput
): ContentItemConfigOutput
```

### 5.10 调试要求

调试视图至少展示：

- 某个物品实例来自哪个模板
- 某个容器实例来自哪个模板
- 哪个角色对某件物品拥有何种初始认知
- 哪些模板引用了 `useEffectId`

### 5.11 示例

示例：

- `ledger_main`
  - `templateId = ledger`
  - `isCritical = true`
- `doctor`
  - `knowledgeType = suspects_holder`
  - `itemId = ledger_main`
  - `confidence = medium`

这表示：

- 内容层定义了“失踪账本”这一具体物品实例
- 医生只怀疑账本在别人手里，并不拥有真相写入权

### 5.12 待处理的问题

- `knowledgeType` 是否需要补充“曾经持有过”或“知道原主人”类型，`To be confirmed`

## 6. 会话装配与校验流程

### 6.1 设计目标

本子部分负责定义如何在具体一局中启用、覆盖和校验物品配置，以支持不同剧本开局、测试场景和调试回放。

### 6.2 设计原则

- 会话装配只覆盖局部开局，不重写模板能力
- 开局覆盖必须可审计、可回放
- 覆盖优先级固定，避免内容包和测试配置互相污染
- 校验失败时应阻断开局，而不是带病运行

### 6.3 设计思路

`SessionItemAssemblyV1` 只负责四件事：

1. 启用哪些物品
2. 标记哪些物品是关键物
3. 覆盖开局占有真相
4. 覆盖开局认知

```ts
type SessionItemAssemblyV1 = {
  enabledItemIds: string[];
  criticalItemIds?: string[];
  ownershipOverrides?: ItemOwnershipV1[];
  knowledgeOverrides?: ItemKnowledgeSeedV1[];
};
```

### 6.4 输入结构

```ts
type SessionItemAssemblyInput = {
  baseBundle: ValidatedItemSchemaBundleV1;
  sessionAssembly?: SessionItemAssemblyV1;
};
```

### 6.5 输出结构

```ts
type SessionItemAssemblyOutput = {
  activeItemIds: string[];
  activeOwnerships: ItemOwnershipV1[];
  activeKnowledge: ItemKnowledgeSeedV1[];
  activeCriticalItemIds: string[];
};
```

### 6.6 处理流程

1. 读取基础物品 schema bundle
2. 若无会话覆盖，则直接启用默认配置
3. 若存在覆盖：
   - 先裁剪 `enabledItemIds`
   - 再应用 `ownershipOverrides`
   - 再应用 `knowledgeOverrides`
   - 最后应用 `criticalItemIds`
4. 对覆盖后的结果重新做：
   - 物品存在性校验
   - 唯一占有真相校验
   - 认知引用合法性校验
5. 输出会话激活结果

### 6.7 设计规格和约束

- `enabledItemIds` 之外的物品不得出现在最终激活结果里
- `ownershipOverrides` 不能引用未启用物品
- `knowledgeOverrides` 可以覆盖已有认知，也可以追加新认知
- `criticalItemIds` 必须是 `enabledItemIds` 的子集
- 会话覆盖不得修改模板的 `allowedActions` 与 `useEffectId`

### 6.8 与上下游的交互边界

- 上游依赖：
  - 基础物品 schema bundle
  - 剧情或测试开局覆盖
- 下游输出：
  - 世界初始化时可消费的物品真相
  - 初始认知输入
  - 调试可显示的关键物集合
- 不负责：
  - 运行中动态重配
  - 动作合法性执行

### 6.9 透出的接口设计

```ts
function assembleSessionItems(
  input: SessionItemAssemblyInput
): SessionItemAssemblyOutput
```

### 6.10 调试要求

调试视图至少展示：

- 本局启用了哪些物品
- 哪些物品被会话覆盖了开局归属
- 哪些认知记录来自基础包，哪些来自覆盖
- 哪些关键物参与了当前局

### 6.11 示例

示例：

- 基础包中 `ledger_main` 默认在 `sheriff` 身上
- 某个 narrative 会话通过 `ownershipOverrides` 把它改到 `hotel_room_2_drawer`
- 同时通过 `knowledgeOverrides` 让 `doctor` 知道抽屉位置

则这一局开场时：

- 世界真相：账本在旅店二楼抽屉里
- 医生初始知道账本位置
- 治安官不再默认持有账本

### 6.12 待处理的问题

- 会话装配是否需要支持按难度模板批量改写认知置信度，`To be confirmed`

## 7. 版本记录

- `v0.1`
  - 建立物品数据模型与内容配置设计文档第一版
  - 锁定模板层、实例层、真相层、认知层和会话装配层的分层方案
  - 锁定 `ItemOwnershipV1` 为唯一物品占有真相源
