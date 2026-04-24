# Game UI Figma System Design

## 1. Context

本设计用于指导 `AIWesternTown` 当前 Web 端的 UI 规范化与 Figma 设计资产建设，参考代码范围为 `apps/web/src`。

用户目标不是重做视觉风格，而是在保留当前项目气质的前提下，建立一套能够持续迭代的设计体系，产出：

- 完整的 UI 规范文件
- 当前主界面的设计稿
- 面向后续游戏内页面扩展的骨架页
- 可在 Figma 内走查的预览流

当前 Web 端已经具备明确的视觉语言：

- 纸面感、编辑感、低饱和浅色层次
- serif 标题与较克制的边框系统
- 以阅读和叙事为中心的信息组织方式

因此本次工作的重点不是“换一种更炫的风格”，而是把现有风格整理成稳定的布局语法、页面骨架和 Figma 交付结构。

## 2. Goal

交付一套桌面优先的游戏内 UI Figma 体系，使后续 UI 设计与迭代优化可以在统一框架下稳定推进。

该体系需要同时满足以下目标：

- 保持当前 Web Shell 的视觉语言一致
- 让主栏只承载当前游玩回合，避免信息撑爆主栏
- 把世界状态、事件流、日志等信息迁移到左侧信息栏
- 为后续游戏内页面族建立可复用的骨架模板
- 在一个 Figma 文件内同时包含规范、设计稿、组件和预览

## 3. Non-Goals

本次不做以下内容：

- 不进行整体视觉重品牌或风格重构
- 不覆盖产品后台、存档管理、配置面板等外围页面
- 不产出完整移动端高保真设计系统
- 不在本阶段重写前端实现代码
- 不尝试建立过重的全量 Design System

## 4. Design Principles

### 4.1 Preserve The Existing Visual Language

保留当前项目的纸面感、serif 排版、细边框和克制留白，不引入与现有实现割裂的新审美方向。

### 4.2 Keep The Main Column Play-Focused

主栏只服务当前游玩回合，回答以下问题：

- 我现在在哪里
- 我现在能做什么
- 刚刚发生了什么直接后果
- 我要不要继续输入或推进

任何长历史、背景说明、世界状态汇总都不应长期占据主栏。

### 4.3 Move World Information To A Stable Left Rail

左侧栏负责承接世界状态、事件流和日志沉淀，通过标签页切换管理不同信息层。

### 4.4 Layout Before Decoration

本次优先建立信息分层、栏位职责、模块边界、页面骨架与组件秩序，而不是追求更多装饰元素。

### 4.5 Desktop First With Explicit Mobile Fallback

规范以桌面体验为主，移动端只记录降级策略与折叠规则，不在本次作为主要交付重心。

## 5. Scope

### 5.1 In Scope

- `apps/web/src` 当前主界面的视觉结构整理
- 游戏内页面族的骨架模板
- 桌面端三栏信息架构
- 左栏标签页世界信息模型
- Figma 文件的目录、组件与预览流设计

### 5.2 Page Family Covered

本次仅覆盖游戏内页面族：

- `Main Shell`
- `Scene Detail`
- `Character Sheet`
- `Consequence View`
- `Journal Timeline`

## 6. Source-Code Mapping

以下现有实现为本设计的重要参考源：

- `apps/web/src/App.tsx`
  - 当前整体页面结构
- `apps/web/src/app.css`
  - 当前视觉语言、栏位比例、留白和边框规则
- `apps/web/src/components/playable-loop-panel.tsx`
  - 主栏行动中枢的原型
- `apps/web/src/components/command-composer.tsx`
  - 自由输入与建议命令区
- `apps/web/src/components/debug-dock.tsx`
  - 右侧系统栏原型
- `apps/web/src/components/scene-feed.tsx`
  - 结果流的现有表达
- `apps/web/src/view-model/shell-view-model.ts`
  - 现有页面数据结构语义

设计稿和规范应尽量贴合上述实现中的真实结构约束，而不是脱离前端另起一套尺寸与职责模型。

## 7. Information Architecture

### 7.1 Global Shell

桌面端游戏内页面默认采用 `World-Play-System` 三段式结构：

- 左栏：`World Rail`
- 主栏：`Play Surface`
- 右栏：`System Rail`

### 7.2 Left Rail: World Rail

左栏承载“当前不一定立刻操作，但需要随时参考”的世界信息。

左栏固定包含：

- `Rail Header`
- `Rail Tabs`
- `Rail Content`

#### 7.2.1 Left Rail Tabs

左栏固定 3 个标签页：

- `状态`
- `事件流`
- `日志`

各标签职责如下：

- `状态`
  - 当前地点、时间、运行模式、追踪目标、风险或张力、关键线索摘要
- `事件流`
  - 玩家输入、系统接收、世界后果、关键人物反应的时间序列
- `日志`
  - 已知角色、已访问地点、已确认线索、关键记录等长期沉淀信息

#### 7.2.2 Left Rail Interaction Rules

- 标签切换不得改变主栏上下文
- 标签页应保留各自滚动位置
- 新事件到来只更新 badge 或提示点，不强制切换标签
- 左栏内容默认独立滚动，标签头保持固定

### 7.3 Main Column: Play Surface

主栏必须保持当前回合聚焦，不承载无限增长的历史流。

主栏建议固定为以下顺序：

1. `Scene Hero`
2. `Primary Action Frame`
3. `Immediate Consequence`
4. `Focused Input`
5. `Optional Local Detail`

#### 7.3.1 Main Column Rules

- 任一时刻只能有一个高强调主交互模块
- 长历史流不得常驻主栏
- 长说明、扩展背景、日志内容应迁往左栏或详情页
- 主动作数量建议控制在 `3-5` 个
- Hero 摘要必须保持简短，不承担长篇背景叙述

### 7.4 Right Rail: System Rail

右栏为可选次级信息栏。

开发阶段可承载：

- 当前 tick / trace
- session 信息
- run mode
- 调试摘要

产品化阶段也可替换为：

- 相关角色
- 风险等级
- 规则提示
- 当前目标

因此右栏在规范中应被定义为“插槽式侧栏”，而不是写死的 debug 专栏。

## 8. Layout Grammar

### 8.1 Canvas

建议采用以下桌面基准：

- 页面设计基准宽度：`1600`
- 主容器最大宽度：`1520`
- 左右安全边距：`40`
- 栏间距：`24-32`

该定义应与 `apps/web/src/app.css` 中已有 `--page-max-width: 1520px` 的约束保持一致。

### 8.2 Shell Width Ratio

`World-Play-System` 母版建议遵循以下宽度区间：

- 左栏：`320-360`
- 主栏：`760-840`
- 右栏：`280-320`

主栏必须始终是信息与交互的视觉中心。

### 8.3 Panel Grammar

所有面板都应遵循统一的 panel 语法：

- 只承载一个清晰主题
- 顶部结构统一为 `eyebrow -> title -> one-line description`
- 内边距与分组间距使用固定体系
- 主要通过边框、分隔线、留白和标题级别形成层次
- 默认不依赖大面积背景色块制造分层

### 8.4 Content Density

定义三种信息密度：

- `Hero Density`
  - 用于页面最重要的当前上下文
- `Action Density`
  - 用于玩家需要点击、比较和决策的内容
- `Reading Density`
  - 用于事件流、日志和说明类内容

一个页面中默认只允许一个 `Hero Density` 模块，通常位于主栏顶部。

## 9. Page Templates

### 9.1 Main Shell

用途：主循环游玩页面。

继承：

- 左栏：完整 `World Rail`
- 主栏：完整 `Play Surface`
- 右栏：`System Rail`

主栏内容：

- 当前场景 Hero
- 当前行动中枢
- 最近即时后果
- 命令输入

### 9.2 Scene Detail

用途：场景深入阅读与探索。

继承：

- 左栏继续保持世界上下文
- 主栏切为场景信息主导
- 右栏用于相关角色或邻近地点

主栏可包含：

- 场景概览
- 场景中对象与分区
- 在场角色
- 可探索节点

### 9.3 Character Sheet

用途：角色或 NPC 详情页。

继承：

- 左栏保持状态 / 事件流 / 日志切换
- 主栏顶部 hero 改为角色身份卡
- 主栏主体展示角色信息、传闻、关系与最近动态

### 9.4 Consequence View

用途：关键事件后果阅读页。

继承：

- 左栏继续提供历史和状态参考
- 主栏展示一次关键结果的收束、影响和下一步抓手

该页相对偏阅读，但仍需保留下一步行动出口。

### 9.5 Journal Timeline

用途：日志、线索、时间线与归档页。

继承：

- 左栏继续承担过滤与切换
- 主栏转为 `Ledger` 型纵向阅读结构
- 右栏可以弱化或省略

## 10. Component Strategy

### 10.1 Components To Standardize

建议进入规范库的组件分为五组：

#### 10.1.1 Shell Components

- `Page Header`
- `Panel Container`
- `Section Header`
- `World Rail`
- `System Rail`

#### 10.1.2 World Rail Components

- `WorldRail/Header`
- `WorldRail/TabBar`
- `WorldRail/Tab`
- `WorldRail/StatusSection`
- `WorldRail/EventItem`
- `WorldRail/LogEntry`

#### 10.1.3 Play Surface Components

- `Scene Hero`
- `Hero Meta Stat`
- `Primary Action Frame`
- `Movement Chip`
- `Opportunity Card`
- `Immediate Consequence Card`
- `Focused Input`
- `Suggestion Chip`

#### 10.1.4 System Rail Components

- `System Summary Card`
- `Trace Item`
- `Status Badge`
- `Mini Metric Row`

#### 10.1.5 Utility Components

- `Eyebrow`
- `Section Label`
- `Info Badge`
- `Divider Rule`
- `Inline Tag`
- `Button`
- `Empty State`

### 10.2 Components With Variants

优先为以下组件建立变体：

- `WorldRail/Tab`
  - default
  - active
  - with badge
  - with unread
- `Opportunity Card`
  - observe
  - eavesdrop
  - approach
  - follow
  - inspect
  - interrupt
- `Immediate Consequence Card`
  - npc reaction
  - world shift
  - system ack
  - new lead
- `Focused Input`
  - free command
  - contextual prompt
  - short scene reply

### 10.3 What Should Not Be Over-Componentized

以下内容应保留为页面级资产，不进入组件系统：

- 场景专属长文案编排
- 某次剧情事件的特殊内容组合
- 页面独有的信息排序
- 长段叙事说明
- 一次性探索型布局草稿

## 11. Figma File Structure

建议采用单文件、分区式组织，作为长期维护的设计母版仓库。

### 11.1 `00 Cover & Read Me`

包含：

- 文件用途
- 当前覆盖范围
- 与 `apps/web/src` 的关系
- 页面总览入口
- 使用说明

### 11.2 `01 Foundations`

包含：

- 桌面画板规则
- 三栏比例
- 栏间距与安全区
- Panel 留白与分组间距
- 主栏内容边界
- 左栏 tabs 使用规则
- 移动端降级说明

### 11.3 `02 Layout Templates`

包含：

- `Main Shell / World-Play-System`
- `Scene Detail`
- `Character Sheet`
- `Consequence View`
- `Journal Timeline`

每套模板建议同时提供：

- wire skeleton
- annotated layout
- 内容职责说明

### 11.4 `03 Components`

按组件分组展示默认态、变体与使用说明。

### 11.5 `04 Screens`

包含：

- `Main Shell` 高保真设计稿
- `Scene Detail` 中高保真骨架
- `Character Sheet` 中高保真骨架
- `Consequence View` 中高保真骨架
- `Journal Timeline` 中高保真骨架

### 11.6 `05 Prototype`

包含 Figma 内预览流，至少覆盖：

- `Main Shell`
- `Scene Detail`
- `Character Sheet`
- `Consequence View`
- `Journal Timeline`

### 11.7 `06 Spec Pages`

包含适合开发与设计共同阅读的规范说明页，例如：

- 页面选型规则
- 栏位职责规则
- 主栏内容边界
- 左栏标签页职责
- 信息迁移原则

## 12. Preview Strategy

本次需要同时满足两种“预览”需求：

### 12.1 Figma Prototype Preview

通过 prototype flow 让团队可以在 Figma 中走查主要页面路径，重点验证：

- 页面切换关系
- 世界信息与主游玩面的分工
- 主栏是否保持聚焦

### 12.2 Figma Spec Overview

通过 `Spec Pages` 把规范本身做成可阅读页面，便于后续 UI 设计和前端迭代统一对齐。

## 13. Recommended Figma Production Workflow

当进入实际 Figma 产出阶段，建议采用以下顺序：

1. 基于 `apps/web/src` 与当前运行页面整理参考布局
2. 先建立 `Foundations` 与 `Layout Templates`
3. 再建立跨页面复用组件
4. 回填当前 `Main Shell` 高保真页面
5. 补齐其他游戏内页面骨架
6. 串接 prototype flow
7. 最后整理 spec pages

对于 Web 页面外观参考，可以使用页面捕获作为排版参考，但最终可维护交付应以 Figma 中的结构化设计页为准，而不是以截图式捕获作为最终资产。

## 14. Risks And Mitigations

### 14.1 Left Rail Overload

风险：
左栏可能演变成所有信息的堆积区，导致切换成本过高。

缓解：

- 限制 tabs 为三类固定信息模型
- 每个 tab 内部分层保持克制
- 长详情跳转到专门页面，而不是无限展开在 rail 中

### 14.2 Main Column Re-Inflation

风险：
随着需求增加，团队可能再次把事件流、日志和长说明放回主栏。

缓解：

- 在规范中明确主栏只服务当前回合
- 对主栏历史流和描述长度设置上限
- 把信息迁移原则写入 spec pages

### 14.3 Component Library Becoming Too Heavy

风险：
Figma 组件系统过重，维护成本高于收益。

缓解：

- 仅组件化跨页面稳定对象
- 页面专属内容维持为页面资产
- 限制变体数量，避免过度设计

## 15. Deliverables

本设计阶段的目标交付应包括：

- 一份 Figma 单文件体系
- 一套桌面优先的布局与页面骨架规范
- 一组可复用的游戏内页面组件
- 当前主界面的高保真设计稿
- 其他游戏内页面的骨架设计稿
- 一条可走查的 prototype 预览流
- 一组开发可读的 Figma 规范说明页

## 16. Acceptance Criteria

当以下条件成立时，本设计视为准备进入 Figma 实作阶段：

- 已明确保留当前视觉语言，不做风格重构
- 已明确主栏与左栏的信息职责边界
- 已定义桌面优先的三栏母版及尺寸区间
- 已定义游戏内页面族的模板继承关系
- 已定义应组件化与不应组件化的边界
- 已定义 Figma 文件结构、设计稿、规范页和预览流范围

## 17. Next Step

本 spec 经用户确认后，下一步应进入实施计划阶段，明确：

- Figma 文件创建与页面搭建顺序
- 当前 Web 页面捕获与参考来源
- 各模板、组件和页面的实际制作批次
- 需要同步给前端的实现映射关系
