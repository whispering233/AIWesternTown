# Game UI Style Guide

## 1. Purpose

这份文档定义 `AIWesternTown` 游戏内 UI 的设计规范基线，目标不是直接驱动工程实现，而是为后续设计与前端开发提供稳定参考。

本规范优先服务以下产物：

- 样式语言
- 布局语法
- 页面骨架
- 组件使用边界
- 后续迭代的判断标准

配套文档与示例：

- `docs/design/game-ui-layout-blueprints.md`
- `design/game-ui-system/index.html`

## 1.1 Boundary

这套规范是“设计参考层”，不是“工程实现层”。

固定边界：

- 规范文档放在 `docs/design/`
- 本地设计示例放在 `design/`
- 工程实现继续放在 `apps/web`
- 不把预览稿直接混入产品入口结构

## 2. Current Direction

### 2.1 Visual Tone

当前方向不是重做视觉品牌，而是延续项目已经形成的气质：

- 纸面感
- 西部卷宗感
- 低饱和浅色层次
- serif 标题
- 细边框与留白驱动层级

### 2.2 What Must Stay Stable

以下内容在后续迭代中默认保持稳定：

- 标题使用 serif 家族
- 主体内容维持浅底深字
- 以边框、分隔线和留白组织层级
- 不引入厚重卡片系统
- 不引入多色强调和过度装饰

## 3. Layout System

### 3.1 Canvas

- 设计基准宽度：`1600`
- 主容器最大宽度：`1520`
- 页面左右安全边距：`40`
- 栏间距：`24-32`

### 3.2 Shell Grammar

桌面端采用三栏母版：

- `World Rail`
- `Play Surface`
- `System Rail`

推荐宽度区间：

- 左栏：`320-360`
- 主栏：`760-840`
- 右栏：`280-320`

### 3.3 Shell Behavior

三栏的行为也应保持稳定：

- 左栏优先承载持续性世界信息
- 主栏优先承载当前回合的单任务交互
- 右栏优先承载次级系统信息
- 主栏信息过载时，先拆页，不先继续堆 panel

### 3.4 Column Responsibilities

#### Left: `World Rail`

左栏只负责世界信息，不负责主回合交互。

允许承载：

- 状态
- 事件流
- 日志
- 人物索引
- 地点索引
- 卷宗摘要

不应承载：

- 当前回合的主操作按钮
- 长篇场景 hero
- 主输入框

#### Center: `Play Surface`

主栏只服务当前回合。

固定回答：

- 我现在在哪里
- 我现在能做什么
- 刚刚发生了什么直接后果
- 我要不要继续推进

不应承载：

- 完整历史事件流
- 长期日志
- 角色索引
- 远场世界总览

#### Right: `System Rail`

右栏是次级信息区，优先承载：

- 系统摘要
- 调试信息
- trace
- 运行模式

产品化后可替换为：

- 相关角色
- 风险提示
- 目标说明

## 4. Main Shell Structure

`Main Shell` 的主栏顺序固定为：

1. `Scene Hero`
2. `Primary Action Frame`
3. `Immediate Consequence`
4. `Focused Input`

### 4.1 Scene Hero

职责：

- 告知当前场景
- 给出一句核心局势摘要
- 展示时间 / 地点 / 模式

规则：

- 只允许一个 hero 区
- 摘要保持短
- 不把大段背景设定塞进 hero

### 4.2 Primary Action Frame

职责：

- 承载移动 leads
- 承载 surfaced opportunities
- 成为主栏最强交互区

规则：

- 动作数量建议控制在 `3-5`
- 过多动作要分组，不要全铺开
- 视觉密度应高于 hero、低于调试表格

### 4.3 Immediate Consequence

职责：

- 只保留最近 `1-2` 条最值得玩家立刻看到的反馈

规则：

- 不做成长历史 feed
- 不替代左栏事件流
- 只保留当前回合最强信号

### 4.4 Focused Input

职责：

- 承接玩家补充输入
- 保持自由输入能力

规则：

- 文案提示要贴当前场景
- 不抢 hero 和 action 的主位

## 5. World Rail Specification

左栏默认采用标签页切换。

固定三类标签：

- `状态`
- `事件流`
- `日志`

### 5.1 状态

包含：

- 当前地点
- 当前时间
- run mode
- 当前追踪目标
- 风险或张力提示

### 5.2 事件流

包含：

- 玩家输入
- 宿主接收
- 世界后果
- 关键人物反应

规则：

- 使用时间序列
- 每条只保留短摘要
- 长详情进入单独页面

### 5.3 日志

包含：

- 角色
- 地点
- 线索
- 传闻
- 调查条目

规则：

- 偏沉淀信息
- 偏可检索、可回看
- 不与实时事件流混写

## 6. Panel Grammar

所有 panel 使用同一套结构：

- eyebrow
- title
- one-line description
- divider
- content

统一规则：

- 单个 panel 只承载一个主题
- 依靠边框、分隔线、留白形成层级
- 不依赖厚重背景卡片

## 7. Typography

### 7.1 Heading

- 标题使用 serif
- 标题负责建立叙事气质
- 标题不宜过多层级并存

### 7.2 Utility Text

- 标签、状态、统计信息使用更克制的小号文字
- 统一 uppercase + tracking 规则

### 7.3 Body Text

- 行高保持舒展
- 以扫描速度为优先
- 文本长度过长时转到详情页或左栏

## 8. Spacing

推荐间距层级：

- 大区块：`32`
- Panel 内主要分组：`24`
- 常规分组：`16`
- 紧凑项：`8`

统一要求：

- 同一页面里不要混用过多 spacing 级别
- panel 顶部与首分组的距离固定
- 文字区和操作区分组要明显

## 9. Stable Tokens

以下 token 命名建议在后续迭代里尽量保持稳定：

- `--page-max-width`
- `--color-page`
- `--color-page-soft`
- `--color-surface-subtle`
- `--color-text-primary`
- `--color-text-secondary`
- `--color-text-tertiary`
- `--color-rule`
- `--color-rule-strong`

## 10. Page Family Templates

### 10.1 Main Shell

最完整的游玩页模板。

### 10.2 Scene Detail

用于场景深读：

- 场景分区
- 在场角色
- 探索节点

### 10.3 Character Sheet

用于角色深读：

- 身份卡
- 已知事实
- 关系
- 最近动态

### 10.4 Consequence View

用于关键后果页：

- 结果摘要
- 影响扩散
- 新线索

### 10.5 Journal Timeline

用于纵向归档页：

- 时间线
- 调查条目
- 线索 ledger

### 10.6 Settlement Overview

用于据点和区域扩展页：

- 据点摘要
- 区域分区
- 可去地点
- tension / 风险

### 10.7 Investigation Board

用于长线调查页：

- 线索分组
- 人物关联
- 未解问题
- 当前假设

## 11. Iteration Rules

后续任何页面设计都先回答这三个问题：

1. 这个页面的主任务是什么
2. 它属于哪一种 page family
3. 哪些信息应该在左栏，哪些必须留在主栏

如果一个设计同时把“历史流、索引、当前动作、长文案”都堆在主栏，说明它违反了这套规范。

## 12. Recommended Workflow

建议后续按这个顺序推进：

1. 先写清楚页面属于哪一类模板
2. 先对照 `game-ui-layout-blueprints.md`
3. 先画布局，不先堆组件
4. 再决定 panel 切分
5. 最后再加标题、状态和按钮细节

工程实现应参考本规范和 `design/game-ui-system/index.html`，而不是直接把示例页面原样搬进产品代码。
