# W23 UI Playable Loop Design

## 1. Context

任务卡 `doc/task-cards/W23-ui-playable-loop.md` 的目标是把 `apps/web` 接到真实本地宿主和主循环输出，形成第一版可玩的浏览器体验。

本设计遵守以下边界：

- 写入范围只包含 `apps/web/**` 与 `packages/ui-sdk/**`
- 浏览器通过 `ui-sdk` 访问 `local-host`
- 页面风格沿用当前 Web Shell 的排版、边框、留白和字体语言
- 允许重排主栏信息密度，使“移动 -> 观察 -> 后果”更像 playable loop
- 不在页面组件里散落 `fetch` 或 SSE 细节

本设计承接以下文档：

- `doc/20-core-game-loop.md`
- `doc/70-implementation-stack-and-delivery-plan.md`

## 2. Goal

交付一个可玩的 Web 主循环页面，使玩家可以在浏览器里：

- 创建本地 session
- 执行移动和观察类输入
- 自动接收宿主推送的世界事件
- 在页面里看到结构化后果
- 不通过手动刷新就完成状态更新

## 3. Non-Goals

本次不做以下内容：

- LLM debug panel 的扩展能力
- 持久化内部实现
- 完整 NPC 行为可视化
- 新增或修改 `contracts` 契约
- 改写现有 UI 的整体视觉语言

## 4. Architecture

本次实现采用四层单向闭环：

1. `local-host`
   - 提供 `POST /sessions`
   - 提供 `POST /sessions/:sessionId/commands`
   - 提供 `GET /sessions/:sessionId/events` SSE
2. `packages/ui-sdk`
   - 负责 HTTP 请求
   - 负责 SSE 订阅生命周期
   - 维护轻量 session runtime
3. `apps/web` view-model adapter
   - 把 runtime 状态与 host 事件折叠成页面所需 `ShellViewModel`
   - 负责 playable loop 的页面语义，而不是 transport 语义
4. `apps/web` React components
   - 渲染三栏页面
   - 主栏顺序重排为 `scene hero -> playable loop panel -> scene feed -> command composer`

该架构满足任务卡的“优先通过 `ui-sdk` 适配，不在页面里散落 fetch 逻辑”的约束，同时避免把当前页面语义错误地下沉成共享 SDK 契约。

## 5. Layer Boundaries

### 5.1 `packages/ui-sdk`

`ui-sdk` 负责：

- `createSession`
- `submitCommand`
- 订阅和关闭 SSE
- 保存当前连接状态
- 保存当前 `session`
- 保存最近一次提交命令
- 保存最近一条 `tick.trace`
- 缓存最近若干条 host 事件，供上层生成页面状态

`ui-sdk` 不负责：

- 生成页面中文文案
- 决定哪些事件进入主栏机会区
- 决定可去地点如何命名
- 把当前页面排版固化为共享协议

### 5.2 `apps/web`

`apps/web` 负责：

- 把 `ui-sdk` runtime 转成 `ShellViewModel`
- 把 starter town 当前场景切片折成 playable loop 页面
- 生成移动 leads 和机会动作按钮
- 生成主 feed 中的玩家输入、宿主接收和世界后果
- 把 `tick.trace` 折成右侧调试栏摘要

`apps/web` 不负责：

- 自行维护一套脱离宿主的世界真相
- 直接操作低层 SSE 或 HTTP 细节
- 依赖松散的 `world.event.payload` 作为主渲染事实源

## 6. Event Mapping

页面只依赖既有 host 事件类型：

- `session.snapshot`
- `command.accepted`
- `world.event`
- `tick.trace`

映射规则如下。

### 6.1 `session.snapshot`

用于更新：

- 顶部 session 标识
- `worldTick`
- 连接状态
- 最近已知的宿主 session 时间戳

不直接写入主 feed。

### 6.2 `command.accepted`

用于更新：

- 最近一次命令已被宿主接收的状态
- 主 feed 中的系统回执
- composer 的 `lastSubmittedCommand`

它表示“命令已进入宿主”，不表示“世界后果已经产生”。

### 6.3 `world.event`

用于更新：

- 主 feed 的后果流
- 当前主循环页面里的可见后果摘要
- 基于最近上下文的机会区刷新

`world.event` 是主栏“后果”区域的主体来源。

### 6.4 `tick.trace`

用于更新：

- 调试侧栏中的 trace 摘要
- 最近一次 tick 的模式变化和附加事件数量

`tick.trace` 不进入主 feed，避免叙事区被调试信息污染。

## 7. Playable Loop Layout

### 7.1 Layout Principle

保留现有页面风格和三栏结构，只重排主栏信息组织，使用户总是先看到：

1. 我在哪里
2. 我现在能做什么
3. 我刚刚造成了什么后果

### 7.2 Main Column Blocks

主栏固定为四块：

1. `scene hero`
2. `playable loop panel`
3. `scene feed`
4. `command composer`

### 7.3 `scene hero`

保留当前地点、时间、运行模式，同时新增 `movement leads`。

`movement leads` 的职责：

- 把可去相邻地点直接展示出来
- 标注这是“本地移动”还是“下一步转场”
- 成为浏览器里的首批可点击操作入口

### 7.4 `playable loop panel`

这是新增主组件，用于承接“观察转机会”的中心操作位。

它展示：

- 当前粗观察摘要
- 当前场景中浮出的 `surfacedOpportunities`
- 每个机会的类型标签，如 `observe`、`eavesdrop`、`approach`、`follow`、`inspect`
- 点击后会发送的命令文本

该面板的目标不是替代自由输入，而是把玩家在这一轮最值得做的动作前置。

### 7.5 `scene feed`

`scene feed` 的职责收窄为结果流。

内容顺序必须清晰区分：

- 玩家命令
- 宿主接收
- 世界后果

它不再承担建议动作入口的职责。

### 7.6 `command composer`

保留自由输入，作为：

- 不在建议动作内的补充命令入口
- 对当前机会的手动改写入口

按钮点击既可以直接提交，也可以把建议命令写入草稿后再提交。第一版优先直接提交，以减少额外点击。

## 8. View Model Changes

现有 `ShellViewModel` 继续作为页面总模型，但新增两类主循环结构。

### 8.1 Movement Model

新增 `movement` 区块，至少包含：

- 当前地点可去的地点列表
- 每个地点的显示标签
- 用于提交的命令文本
- 轻量提示文案，例如“本地移动”或“转场观察”

### 8.2 Opportunity Model

新增 `opportunities` 区块，至少包含：

- 机会 ID
- 机会展示标题
- 机会类型标签
- 机会说明文案
- 触发后提交的命令文本
- 是否偏向 `short_scene`

### 8.3 Debug Summary

右侧调试栏补充 transport 和 trace 摘要，例如：

- connection state
- current session id
- latest world tick
- latest trace world tick
- latest appended event count

## 9. Command Flow

页面命令流固定如下：

1. 页面启动时创建 session
2. 创建成功后立即建立 SSE 订阅
3. 玩家点击移动 lead、机会动作或提交自由输入
4. 页面先本地追加一条 `player` feed 项
5. 页面调用 `submitCommand`
6. 收到 `command.accepted` 后追加宿主回执
7. 收到 `world.event` 后刷新后果区
8. 收到 `tick.trace` 后刷新调试栏
9. 连接失败时切换连接状态并保留最近一次可见页面内容

此流程保证：

- 页面不会在没有宿主确认时伪造世界结果
- 页面状态更新不依赖手动刷新
- 主叙事区与调试区职责分离

## 10. Data Safety Rules

为了避免“UI 过早把临时字段当长期契约”，本次实现遵守以下规则：

- 页面主渲染依赖现有稳定 schema，而不是依赖 `payload` 内部松散字段
- 页面按钮提交普通命令文本，不新增页面专用私有协议
- 所有 transport 细节集中在 `ui-sdk`
- `apps/web` 只消费 runtime 和事件缓存，不直接控制网络层

## 11. File Plan

预计涉及以下文件。

### 11.1 `packages/ui-sdk`

- `packages/ui-sdk/src/index.ts`
  - 扩展为可维护 session runtime 的 SDK 出口
- 新增 runtime 或 adapter 文件
  - 承载事件缓存、连接状态和订阅封装

### 11.2 `apps/web`

- `apps/web/src/App.tsx`
  - 接入真实 runtime
  - 重排主栏结构
- `apps/web/src/view-model/shell-view-model.ts`
  - 扩充 movement 和 opportunities 结构
- `apps/web/src/view-model/mock-shell-view-model.ts`
  - 调整 mock 数据，使其匹配新结构
- 新增主循环面板组件
  - 承载 movement leads 与 surfaced opportunities
- `apps/web/src/components/scene-feed.tsx`
  - 收窄为结果流组件
- `apps/web/src/components/command-composer.tsx`
  - 适配机会动作和自由输入共存
- `apps/web/src/app.css`
  - 增补 playable loop panel 样式，保持原视觉语言

## 12. Testing Strategy

实现必须遵守 TDD，并覆盖以下验证面。

### 12.1 `packages/ui-sdk`

至少验证：

- 创建 session
- 提交命令
- SSE 事件被正确解析和分发
- SSE 解析失败时进入错误回调
- runtime 状态可被正确更新

### 12.2 `apps/web` view-model adapter

至少验证：

- `session.snapshot` 更新 header 和 session 状态
- `command.accepted` 进入主 feed 的系统回执
- `world.event` 进入主 feed 的后果区
- `tick.trace` 只更新调试区
- movement 和 opportunities 在新模型中可稳定生成

### 12.3 `apps/web` UI

至少验证：

- 页面能显示移动 leads
- 页面能显示机会动作
- 点击动作后会触发命令提交流程
- 主 feed 能显示玩家命令与后果

### 12.4 Completion Verification

完成前至少运行：

- `pnpm --filter @ai-western-town/ui-sdk test`
- `pnpm --filter @ai-western-town/web test`
- `pnpm --filter @ai-western-town/ui-sdk typecheck`
- `pnpm --filter @ai-western-town/web build`

## 13. Risks And Mitigations

### 13.1 页面状态与 server 状态不同步

缓解方式：

- 页面只把玩家输入当作本地回显
- 世界后果只认宿主事件
- session 与 trace 状态从 SSE 同步

### 13.2 UI 绑定临时字段

缓解方式：

- 主 UI 不依赖 `world.event.payload` 的任意可选字段
- 机会与移动命令由 Web adapter 生成，不要求 host 为页面定制契约

### 13.3 页面信息重新组织后失去现有风格一致性

缓解方式：

- 保留现有三栏结构
- 复用现有 serif 字体、细边框、纸面留白和浅色层次
- 只增补新的 panel，不替换整体样式系统

## 14. Acceptance Criteria

当以下条件成立时，本设计视为落地完成：

- 浏览器可创建本地 session
- 浏览器可消费 SSE 事件流
- 玩家可通过页面执行移动和观察
- 主栏能显示结构化后果
- 页面刷新不依赖手动 reload
- 网络访问逻辑不散落在页面组件中
- 页面视觉语言与当前 Web Shell 保持一致
