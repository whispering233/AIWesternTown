# Game UI Layout Blueprints

## 1. Purpose

这份文档定义 `AIWesternTown` 游戏内 UI 的版式蓝图。当前版本以 `design/game-ui-system/design.html` 和 `design/game-ui-system/design.png` 为主界面实现参考。

它重点回答：

1. 主界面三栏如何分工
2. 主栏叙事交互如何排序
3. 地图栏如何组织当前位置与移动入口
4. 后续页面扩展时哪些规则不能破坏

## 2. Desktop Main Shell

桌面端主界面使用固定三栏：

`Context Rail : Narrative Rail : Map Rail = 1 : 3 : 1`

| 区域 | 宽度比例 | 当前职责 |
| --- | --- | --- |
| Context Rail | `1` | 玩家状态、日志、NPC 人物卡、后续 tab 预留 |
| Narrative Rail | `3` | 当前场景叙事、对话、生成式选项、自由输入 |
| Map Rail | `1` | 总地图、当前位置、移动选项 |

统一外层规则：

- 顶栏只保留品牌与 session 状态
- 主体占满顶栏以下空间
- 三栏之间使用一致 gutter
- 三栏均为可滚动内容容器，但主栏优先保护对话窗口高度

移动端规则：

- 三栏纵向堆叠
- 顶栏不提供布局控制按钮
- 输入框与发送按钮可换行，不能溢出

## 3. Placement Decision Rules

| 问题 | 应放位置 |
| --- | --- |
| 这是玩家当前要读的叙事或对话吗 | 主栏 |
| 这是当前回合可选动作吗 | 主栏选项块 |
| 这是移动到其他地点吗 | 右栏“去往地点” |
| 这是地图、当前位置、出口、风险吗 | 右栏地图 tab |
| 这是玩家状态、历史日志、人物卡吗 | 左栏 |
| 这是 LLM trace、debug、transport 详情吗 | 独立调试页或 devtools，不放主界面右栏 |

## 4. Main Shell Blueprint

### 4.1 Top Bar

结构：

1. 品牌名
2. connection 状态
3. session 标识

不提供布局控制按钮或移动端抽屉按钮。

### 4.2 Left Context Rail

默认 tab：

1. `状态`
2. `日志`
3. `人物`

`状态` 推荐顺序：

1. 当前位置
2. 世界时间 / world tick
3. run mode
4. 携带物
5. 当前风险或张力

`日志` 使用短时间线。每条日志应有时间/序号、标题和一句摘要。

`人物` 使用可折叠人物卡。人物卡只保留玩家当前视角信息，不展开完整角色页。

### 4.3 Main Narrative Rail

主栏固定顺序：

1. `Scene Meta Tags`
2. `Narrative Text`
3. `Dialogue Window`
4. `Choice Block`
5. `Free Input Dock`

主栏不再放移动 leads。移动 leads 全部迁入右栏。

#### Scene Meta Tags

展示地点、时间/tick、模式、风险等短标签。

#### Narrative Text

展示当前场景生成式叙事。它是当前主栏的叙事锚点，不应被日志或调试信息挤压。

#### Dialogue Window

展示 NPC、玩家、旁白在当前上下文中的对话或即时反馈。

#### Choice Block

展示 `3-5` 个当前可执行选项。当前无骰子检定 UI，不展示 d20、成功率或复杂规则说明。

#### Free Input Dock

底部固定自由输入。发送后进入命令工厂和本地宿主链路。

### 4.4 Right Map Rail

右栏上方为地图 tab，下方为移动列表。

上方 tab：

- `总地图`
- `当前位置`

下方移动区：

- 标题固定为 `去往地点`
- 当前地点标记为 `current`
- 已知可去地点标记为 `known` 或 `lead`
- 锁定地点可标记为 `locked`

移动按钮只提交移动命令，不在前端直接改变 world state。

## 5. Page Family Matrix

当前主界面是 `Main Shell`。其他页面族仍可沿用三栏语法，右栏默认保持地图与相关地点上下文。

| Page Family | 主任务 | 主栏骨架 | 左栏重点 | 右栏重点 |
| --- | --- | --- | --- | --- |
| Main Shell | 推进当前回合 | Tags / Narrative / Dialogue / Choices / Input | 状态、日志、人物 | 地图、当前位置、移动 |
| Scene Detail | 深读当前场景 | 场景总览 / 分区 / 在场角色 / 可探索对象 | 日志、人物 | 当前位置、出口、风险 |
| Character Sheet | 深读角色 | 身份卡 / 已知事实 / 关系 / 最近动态 | 相关日志、线索 | 关联地点、风险 |
| Consequence View | 阅读关键后果 | 结果摘要 / 影响扩散 / 新线索 / 下一步出口 | 事件上下文 | 相关地点、移动出口 |
| Journal Timeline | 纵向归档与检索 | 时间线 / 调查条目 / 线索 ledger | 过滤器、索引 | 地点范围、标签说明 |
| Settlement Overview | 查看据点与区域 | 地图摘要 / 区域分区 / 可去地点 / tension | 地点日志、传闻 | 区域地图、旅行提示 |
| Investigation Board | 长线调查与推理 | 线索组 / 人物关联 / 未解问题 / 当前假设 | 原始事件流 | 相关地点、当前目标 |

## 6. Overflow Rules

- 主栏不能承载完整历史日志。
- 主栏不能承载调试面板。
- 移动入口不能与叙事选项混在同一块。
- 左栏人物卡不要展开成完整角色页。
- 右栏地图描述保持短，长场景解读进入 Scene Detail。
- 如果右栏地图成为高频阅读中心，应考虑拆出 Settlement Overview，而不是继续堆信息。

## 7. Expansion Workflow

新增 UI 前先确认：

1. 它是否属于现有三栏主界面
2. 它应该放入 Context、Narrative 还是 Map
3. 它是否需要新 page family
4. 它是否需要更新 `design.html` 或单独原型

只有这四个问题明确之后，再进入工程实现。
