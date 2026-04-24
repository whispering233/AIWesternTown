# AIWesternTown Worktree 任务卡索引

## 1. 文档定位

本文档用于管理第一版实现阶段的 `worktree` 并行开发任务卡，提供：

- 任务卡编号
- 波次划分
- 主写目录
- 依赖关系
- 当前目标

每张任务卡的具体内容位于：

- `doc/task-cards/`

## 2. 任务卡使用规则

### 2.1 编号规则

- `W00-W09`：波次 0，仓库骨架与共享契约
- `W10-W19`：波次 1，本地权威运行闭环
- `W20-W29`：波次 2，可玩主循环
- `W30-W39`：波次 3，本地 LLM 与调试链路

### 2.2 并行规则

1. `packages/contracts` 只能有一个 active owner。
2. 单张卡尽量只包含一个主写目录。
3. 任务卡若需要修改共享 DTO，应先拆出前置 contract 卡。
4. 未明确依赖完成前，不开下游集成卡。

## 3. 波次总览

### 波次 0：仓库骨架与共享定义

| 卡号 | 标题 | 主写目录 | 依赖 | 目标 |
| --- | --- | --- | --- | --- |
| `W00` | Repo Bootstrap | 根配置、`apps/*`、`packages/*` 空壳 | 无 | 建立 monorepo 基础骨架 |
| `W01` | Contracts Core | `packages/contracts` | `W00` | 落共享 DTO、事件、调试契约 |
| `W02` | Content Schema Starter | `packages/content-schema`、`content/starter-town` | `W01` | 落最小内容 schema 和 starter 内容包 |

### 波次 1：本地权威闭环

| 卡号 | 标题 | 主写目录 | 依赖 | 目标 |
| --- | --- | --- | --- | --- |
| `W10` | Local Host Shell | `apps/local-host` | `W01` | 起本地宿主、HTTP 命令入口、SSE |
| `W11` | Persistence Save Store | `packages/persistence` | `W01` | SQLite、save/load、event log |
| `W12` | Web Shell | `apps/web` | `W01` | 浏览器 UI 基础壳 |
| `W13` | Game Core Scheduler | `packages/game-core` | `W01` | `worldTick`、scheduler、run mode |

### 波次 2：可玩主循环

| 卡号 | 标题 | 主写目录 | 依赖 | 目标 |
| --- | --- | --- | --- | --- |
| `W20` | Player Loop Slice | `packages/game-core`、`packages/app-services` | `W02`、`W11`、`W13` | 移动、观察、机会浮出 |
| `W21` | Scene Visibility Slice | `packages/game-core/src/scene` | `W02`、`W13` | 分区拓扑和可见性基础规则 |
| `W22` | Cognition Lite | `packages/cognition-core` | `W11`、`W13` | 简化认知链四阶段 |
| `W23` | UI Playable Loop | `apps/web`、`packages/ui-sdk` | `W10`、`W12`、`W20`、`W21` | 可玩主界面接真实数据 |

### 波次 3：LLM 与调试链路

| 卡号 | 标题 | 主写目录 | 依赖 | 目标 |
| --- | --- | --- | --- | --- |
| `W30` | LLM Provider Local | `packages/llm-runtime/src/provider`、`gateway` | `W01` | `mock/local/cloud` provider 抽象 |
| `W31` | LLM Recorder And Trace | `packages/llm-runtime/src/recorder`、`packages/devtools/src/trace` | `W11`、`W30` | 调用录制、trace、SQLite debug log |
| `W32` | Prompt Builder Visible Render | `packages/llm-runtime/src/prompt-builder`、`parser`、`guard` | `W30` | 先打通 `visible_outcome_render` |
| `W33` | Debug Panel LLM | `apps/web/src/debug`、`packages/devtools/src/inspectors` | `W12`、`W31`、`W32` | 浏览器查看 LLM 调用全链路 |
| `W34` | LLM Fixture Replay | `packages/devtools/src/replay` | `W31` | 导出与回放 LLM fixture |

## 4. 推荐启动顺序

建议按以下顺序启动第一批 `worktree`：

1. `W00`
2. `W01`
3. `W02`

在 `W01` 合并后，再启动：

1. `W10`
2. `W11`
3. `W12`
4. `W13`

完成波次 1 后，再进入波次 2 与波次 3。

## 5. 当前建议入口

如果你准备直接分发开发任务，建议先阅读：

1. [70-implementation-stack-and-delivery-plan.md](C:/codex/project/AIWesternTown/doc/70-implementation-stack-and-delivery-plan.md)
2. 本索引文档
3. 对应任务卡正文

任务卡正文目录：

- [doc/task-cards/](C:/codex/project/AIWesternTown/doc/task-cards)
