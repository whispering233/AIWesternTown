# AIWesternTown 技术栈与实施方案

## 1. 文档定位

本文档用于把现有设计文档落成第一版可执行实现方案，回答以下问题：

1. 第一版应采用什么技术栈
2. 仓库应该如何组织，才能支撑 Web 首发和后续桌面化
3. 本地权威内核、浏览器 UI、云端辅助服务之间如何分工
4. 本地 LLM 如何接入、调试、回放和降级
5. 如何为 `worktree` 并行开发划定稳定任务边界

本文档承接以下上位设计：

- [00-master-design.md](C:/codex/project/AIWesternTown/doc/00-master-design.md)
- [20-core-game-loop.md](C:/codex/project/AIWesternTown/doc/20-core-game-loop.md)
- [25-scene-partition-and-visibility.md](C:/codex/project/AIWesternTown/doc/25-scene-partition-and-visibility.md)
- [30-npc-cognition-framework.md](C:/codex/project/AIWesternTown/doc/30-npc-cognition-framework.md)
- [38-npc-cognition-api-spec.md](C:/codex/project/AIWesternTown/doc/38-npc-cognition-api-spec.md)
- [40-simulation-and-state.md](C:/codex/project/AIWesternTown/doc/40-simulation-and-state.md)
- [50-llm-integration.md](C:/codex/project/AIWesternTown/doc/50-llm-integration.md)
- [51-prompt-builder-contract.md](C:/codex/project/AIWesternTown/doc/51-prompt-builder-contract.md)

## 2. 第一版实现目标

第一版采用“可玩 Demo 优先，但骨架不返工”的路线。

第一版必须验证：

1. 玩家可以在浏览器里完成一轮稳定的文字探索循环
2. 本地游戏内核可以用 `worldTick` 推进世界
3. 至少一条简化 NPC 认知链可以驱动 NPC 响应
4. LLM 可以作为附着能力接入，而不是成为规则真相来源
5. 整个系统可调试、可回放、可恢复

第一版不追求：

- 微服务拆分
- 多人模式
- 完整八阶段全量实现
- 云端权威存档
- 复杂编辑器后台

## 3. 总体实现路线

### 3.1 架构结论

第一版采用：

`TypeScript monorepo + 本地权威内核 + 浏览器 Web UI + 云端辅助服务`

这里的核心约束是：

- 世界真相、本地存档、运行态和事件日志由本地权威进程维护
- 浏览器只负责输入、展示和调试视图
- 云端只承载 LLM gateway、遥测、内容更新清单等辅助能力
- 第一版优先做单进程模块化单体，不做分布式拆分

### 3.2 为什么选择 TypeScript monorepo

原因如下：

1. `web`、`local-host`、`game-core`、`llm-runtime` 可以直接共享 DTO 与 schema，避免前后端重复定义。
2. 该项目的核心复杂度在状态机、调度器、规则链和调试链路，而不是吞吐量或多机部署。
3. 后续桌面版可以复用同一套 Web UI 和本地宿主进程，不需要重写核心。
4. [38-npc-cognition-api-spec.md](C:/codex/project/AIWesternTown/doc/38-npc-cognition-api-spec.md) 已明确指出：内部接口第一版可以先作为模块内函数调用，再演化成 HTTP 或 SDK。

## 4. 技术栈选择

### 4.1 基础工程

- 语言：`TypeScript`
- 包管理：`pnpm workspace`
- 仓库任务编排：`Turborepo`
- 代码质量：`ESLint` + `Prettier`
- 类型校验：`tsc --build`

### 4.2 浏览器端

- UI：`React`
- 构建：`Vite`
- 状态管理：优先使用 React 自身状态和轻量 view model；第一版不引入复杂全局状态库
- 路由：如需要可用 `react-router`
- 调试视图：内置在 Web App，不单独做第二个前端

### 4.3 本地宿主端

- 本地 API / 编排层：`Fastify`
- 推送通道：`Server-Sent Events`
- 日志：`Pino`
- 配置：`.env.local` + 明确运行模式切换

### 4.4 数据与持久化

- 本地数据库：`SQLite`
- Node 驱动：`better-sqlite3`
- SQL / migration：`Drizzle` 为主，必要处保留手写 SQL
- 内容数据：文件化内容包 + schema 校验

### 4.5 共享契约与校验

- 运行时 schema：`Zod`
- 共享契约：`packages/contracts`
- 内容 schema：`packages/content-schema`

### 4.6 测试与验证

- 单测：`Vitest`
- Web 冒烟测试：`Playwright`
- 调试与回放：自研 `devtools` 包

### 4.7 桌面化路径

后续桌面版优先采用：

- `Electron` 包装 `web + local-host`

原因是：

- 第一版最不返工
- 与浏览器版结构兼容
- 本地权威宿主进程可直接复用

若后期对包体和原生感有更高要求，再评估 `Tauri`，但不作为第一版前置决策。

## 5. 仓库最小目录结构

```text
AIWesternTown/
  apps/
    web/
    local-host/
    cloud-gateway/
  packages/
    contracts/
    content-schema/
    persistence/
    game-core/
    cognition-core/
    llm-runtime/
    app-services/
    ui-sdk/
    devtools/
  content/
    starter-town/
  scripts/
  doc/
```

### 5.1 包职责

#### `apps/web`

- 浏览器界面
- 命令输入
- 场景反馈展示
- 调试面板

不得承担：

- 世界规则
- NPC 认知计算
- 数据库存取真相

#### `apps/local-host`

- 本地权威宿主
- Fastify 路由
- 会话管理
- 调度编排入口
- SSE 推送

不得承担：

- 重业务规则实现
- Prompt 构造细节
- 前端视图逻辑

#### `apps/cloud-gateway`

- 云端 LLM gateway
- 遥测上报入口
- 更新清单、内容包 manifest

不得承担：

- 本地世界真相
- 主存档权威

#### `packages/contracts`

- 玩家命令 DTO
- 事件模型
- 调度输入输出
- LLM request / response 契约
- 调试记录 DTO

这是全仓唯一共享事实层。

#### `packages/game-core`

- `worldTick`
- scheduler
- run mode
- 玩家主循环规则
- 事件结算骨架
- 场景与可见性规则

#### `packages/cognition-core`

- 简化认知链
- `Perceive / Appraise / Action Selection / Act`
- 阶段编排与结果合并

#### `packages/llm-runtime`

- provider 抽象
- 本地 / 云端 / mock provider
- prompt builder
- parser
- guard
- 调用录制器

#### `packages/persistence`

- SQLite 初始化
- migrations
- save/load
- event log
- repo 层

#### `packages/app-services`

- 用例编排
- DTO 裁剪
- core 与 host 的粘合层

#### `packages/ui-sdk`

- Web 访问 local-host 的 client
- SSE 订阅
- view model 适配

#### `packages/devtools`

- trace
- replay
- 调试检查器
- fixture 管理

## 6. 关键边界约束

### 6.1 必须稳定的边界

以下边界第一版就必须稳住：

1. `contracts` 是唯一共享契约源
2. `game-core` 不依赖 React、Fastify、SQLite 驱动
3. `llm-runtime` 不直接读数据库实体
4. `apps/web` 只消费 view model 和事件流
5. `local-host` 只做编排与 I/O，不吞掉规则逻辑

### 6.2 第一版允许降级的点

- NPC 八阶段先实现四阶段
- 长动作、深处理、深反思可先挂空或规则降级
- 第一版只做一个 starter town
- LLM 先只接 `visible_outcome_render` 与少量 `goal_tiebreak`

### 6.3 第一版不能降级错的点

- `worldTick`
- scheduler
- event 模型
- save/load
- provider 抽象
- parser/guard
- debug/replay

## 7. 通信与运行模式

### 7.1 本地运行模型

浏览器 UI 与本地宿主之间采用：

- 命令提交：`HTTP POST`
- 世界更新与调试推送：`SSE`

第一版不默认上 WebSocket，原因如下：

- `POST + SSE` 更容易调试和回放
- 对文字 MUD 节奏已足够
- 本地端实现更简单

### 7.2 运行模式

建议支持：

- `LLM_PROVIDER=mock`
- `LLM_PROVIDER=local`
- `LLM_PROVIDER=cloud`

并允许在开发配置中独立控制：

- 是否开启遥测
- 是否启用 fixture replay
- 是否把调试记录落 SQLite

## 8. 本地 LLM 接入与调试方案

### 8.1 本地 LLM 调试目标

本地 LLM 接入的目标不是“让模型直接控制世界”，而是：

1. 提供可选语义渲染能力
2. 对少量高价值语义裁决点做附着式补强
3. 保证输出可校验、可回退、可回放

### 8.2 调试链路

```text
game-core / cognition-core
  -> app-services 生成阶段 DTO
  -> llm-runtime/prompt-builder 生成 PromptSpec
  -> llm-runtime/gateway 选择 provider
  -> local provider 调本地模型服务
  -> parser 解析输出
  -> guard + zod 校验
  -> recorder 录制
  -> devtools / web debug panel 展示
```

### 8.3 Provider 模式

统一抽象三类 provider：

1. `mock`
2. `local`
3. `cloud`

建议本地调试顺序：

1. 先用 `mock` 跑通业务流程
2. 再把 `visible_outcome_render` 接到 `local`
3. 稳定后再尝试 `goal_tiebreak`
4. 最后才考虑扩展更多 task

### 8.4 本地 provider 约束

本地 provider 必须只暴露统一接口：

```ts
interface LLMProvider {
  getName(): string;
  invoke(request: ProviderRequest): Promise<ProviderResponse>;
  healthCheck(): Promise<ProviderHealthResult>;
}
```

并强制要求：

- 不绕开 `PromptSpec`
- 不绕开 parser
- 不绕开 guard
- 不直接写世界状态

### 8.5 调试记录字段

每次 LLM 调用至少记录：

- `traceId`
- `requestId`
- `taskKind`
- `stageName`
- `npcId`
- `providerName`
- `modelRef`
- `inputDtoSummary`
- `compiledMessages`
- `rawResponseText`
- `parsedResult`
- `validationResult`
- `fallbackReason`
- `durationMs`
- `tokenUsage`

### 8.6 调试记录存储

建议分两层：

1. 内存环形缓冲
   - 用于当前页面调试
   - 保留最近 `200-500` 次调用
2. SQLite 持久化
   - 仅落关键调用
   - 用于回放和问题复盘

### 8.7 必备调试面板

第一版至少提供以下四个视图：

1. `Calls`
   - 当前 session 最近调用列表
2. `Prompt`
   - 最终发送给模型的消息
3. `Raw Output`
   - 模型原始返回
4. `Parsed / Fallback`
   - parser 结果、guard 判定和回退原因

### 8.8 录制与回放

第一版必须支持把一次调用导出为 fixture，并脱离模型重放。

这样可以隔离两类问题：

- 模型不稳定
- 业务代码有 bug

### 8.9 第一版允许接入的 LLM 任务

优先顺序如下：

1. `visible_outcome_render`
2. `goal_tiebreak`
3. `action_style_refine`

第一版不建议优先接入：

- `appraise_refine`
- `deep_reflect`
- `compression_generalize`

## 9. 数据与持久化方案

### 9.1 本地权威数据

以下数据本地权威：

- save 元数据
- 当前世界状态
- NPC 运行态
- event log
- 调试 trace

### 9.2 事件日志

第一版建议采用 append-only 思路写事件日志。

好处：

- 便于回放
- 便于审计
- 便于调试 scheduler 和认知链

### 9.3 内容包

内容包采用文件化管理并在装配时校验。

第一版至少包含：

- 场景
- NPC
- 物品
- starter narrative

## 10. 验证与测试策略

### 10.1 必做测试

1. `contracts` 的 schema 测试
2. `game-core` 的 tick 推进单测
3. `cognition-core` 的简化阶段单测
4. `llm-runtime` 的 parser/guard 测试
5. `web + local-host` 的 Playwright 冒烟测试

### 10.2 必做调试能力

1. 能查看最近一次玩家命令触发的 tick trace
2. 能查看本轮 NPC 调度排序
3. 能查看一条 LLM 调用的完整链路
4. 能用 fixture 重放一次失败调用

## 11. worktree 并行开发策略

### 11.1 基本原则

不要按“玩法点子”拆任务，而要按：

- 包边界
- 契约边界
- 写入目录所有权

### 11.2 并行规则

1. `packages/contracts` 同时只允许一个 worktree 修改
2. 单张任务卡尽量只写一个主目录
3. `apps/web` 和 `packages/game-core` 尽量分离 owner
4. `llm-runtime` 与 `cognition-core` 可并行，但共享 DTO 变更必须先合并 `contracts`
5. 同时活跃的 worktree 建议不超过 `4`

### 11.3 波次建议

推荐按以下波次推进：

1. 波次 0：仓库骨架、共享契约、内容 schema
2. 波次 1：本地宿主、持久化、Web 壳、scheduler
3. 波次 2：玩家主循环、场景可见性、简化认知链、可玩 UI
4. 波次 3：LLM provider、录制、prompt builder、debug panel、fixture replay

具体任务卡见：

- [71-worktree-task-card-index.md](C:/codex/project/AIWesternTown/doc/71-worktree-task-card-index.md)

## 12. 实施结论

第一版的最佳实现路径是：

1. 使用 `TypeScript monorepo`
2. 以 `local-host + game-core + web` 组成最小闭环
3. 用 `SQLite + event log + debug trace` 保证可复盘
4. 把 LLM 严格放在 provider / parser / guard / recorder 链路内
5. 用 `worktree` 按包边界并行，而不是按松散功能点并行

该方案能同时满足：

- 第一版尽快做出可玩 Demo
- 后续桌面版不返工核心架构
- 本地 LLM 可调试、可降级、可回放
