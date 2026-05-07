# AIWesternTown

AIWesternTown 是一个 TypeScript monorepo，用于实现 AI NPC 驱动的西部小镇文字叙事沙盒。第一版目标是跑通浏览器 UI、本地权威内核、世界 tick、简化 NPC 认知链、LLM 附着式渲染、结构化日志和可调试回放链路。

## 当前定位

项目采用“本地权威规则 + LLM 附着式渲染”的架构。世界状态、时间推进、NPC 执行结果和可见性判断由本地规则层决定；LLM 只负责受约束的文本渲染或有限语义能力，输出必须经过 parser、guard 和 fallback 机制。

## 技术栈

- 包管理：`pnpm`
- 工作区：`pnpm workspace`
- 任务编排：`Turborepo`
- 模块系统：TypeScript + ESM
- Web UI：React + Vite，位于 `apps/web`
- 本地宿主：Fastify，位于 `apps/local-host`
- 持久化：SQLite / Drizzle，位于 `packages/persistence`
- 结构化日志：Pino JSONL + 可选 Seq，位于 `packages/observability`

## 快速开始

安装依赖：

```powershell
pnpm install
```

复制本地配置：

```powershell
Copy-Item .env.example .env.local
```

如果只想先跑通流程，建议在当前终端临时使用 mock provider：

```powershell
$env:LLM_PROVIDER="mock"
$env:LLM_MOCK_RESPONSE='{"visibleText":"The town holds its breath.","gestureTags":["guarded"]}'
```

启动本地宿主：

```powershell
pnpm --filter @ai-western-town/local-host dev
```

另开一个终端启动 Web：

```powershell
pnpm --filter @ai-western-town/web dev
```

默认地址：

- Web UI：`http://127.0.0.1:5173`
- local-host：`http://127.0.0.1:8787`
- Seq UI：`http://127.0.0.1:5341`

## 常用命令

根目录命令：

```powershell
pnpm run build
pnpm run typecheck
pnpm run test
```

局部命令：

```powershell
pnpm --filter @ai-western-town/web dev
pnpm --filter @ai-western-town/web test
pnpm --filter @ai-western-town/local-host test
pnpm --filter @ai-western-town/game-core test
pnpm --filter @ai-western-town/llm-runtime test
pnpm --filter @ai-western-town/observability test
```

根 `pnpm run test` 会先运行 ESM 迁移检查，再通过 turbo 跑各包测试。

## 目录结构

- `apps/web`：浏览器 UI、命令输入、场景反馈和调试面板。
- `apps/local-host`：本地权威宿主、HTTP/SSE 接入、session 管理和用例编排入口。
- `apps/cloud-gateway`：云端辅助 gateway 占位。
- `packages/contracts`：全仓共享 DTO、事件模型、调试模型和 LLM 契约。
- `packages/game-core`：世界 tick、scheduler、玩家循环、场景与可见性规则。
- `packages/cognition-core`：简化 NPC 认知链和阶段编排。
- `packages/llm-runtime`：provider、prompt builder、parser、guard 和 recorder。
- `packages/observability`：结构化日志、JSONL、Seq sink、LLM 日志脱敏和测试 logger。
- `packages/persistence`：SQLite、migration、save/load、event log 和 repository 层。
- `packages/app-services`：用例编排层，连接 core、content、host 和 runtime。
- `packages/ui-sdk`：Web 访问 local-host 的 client、SSE 订阅和 view model 适配。
- `packages/devtools`：trace、replay、调试检查器和 fixture 管理。
- `content/starter-town`：starter town 内容包。
- `docs`：设计文档、实施方案和任务卡。
- `design/game-ui-system`：游戏 UI 设计系统静态预览。

## 本地配置

`.env.local` 会从当前目录向上查找并加载，且已被 git 忽略。常用配置项：

```powershell
LOCAL_HOST_PORT=8787
LOCAL_HOST_BIND=127.0.0.1
VITE_LOCAL_HOST_URL=http://127.0.0.1:8787
VITE_DEV_HOST=127.0.0.1
VITE_DEV_PORT=5173
```

LLM provider：

```powershell
LLM_PROVIDER=mock
LLM_MOCK_RESPONSE={"visibleText":"The town holds its breath.","gestureTags":["guarded"]}
```

本地 OpenAI-compatible provider 示例：

```powershell
LLM_PROVIDER=local
LLM_LOCAL_BASE_URL=http://127.0.0.1:1234/v1
LLM_LOCAL_MODEL=gemma-4-e2b-uncensored-hauhaucs-aggressive
LLM_LOCAL_SUPPORTS_JSON_OBJECT=false
LLM_TIMEOUT_MS=30000
```

## 日志与 Seq

local-host 默认写结构化 JSONL：

```powershell
LOG_ENABLED=true
LOG_LEVEL=debug
LOG_DIR=logs
LOG_FILE=local-host.jsonl
LOG_CONSOLE=true
```

Seq 默认关闭，显式打开后会把日志发送到 `LOG_SEQ_URL`：

```powershell
LOG_SEQ_ENABLED=true
LOG_SEQ_URL=http://127.0.0.1:5341
```

如果 Seq 配置了 ingestion API key：

```powershell
LOG_SEQ_API_KEY=your-seq-ingestion-key
```

LLM 日志默认会包含 messages、raw response 和 stack。处理敏感内容时可以关闭：

```powershell
LOG_LLM_ENABLED=false
LOG_LLM_INCLUDE_MESSAGES=false
LOG_LLM_INCLUDE_RAW_RESPONSE=false
LOG_LLM_INCLUDE_STACK=false
LOG_LLM_MAX_TEXT_LENGTH=20000
```

Seq UI 不需要保持打开。只要 Seq 后台服务或 Docker 容器在运行，项目就可以继续发送日志。若 ingestion 失败，JSONL 中会出现 `logger.seq_write_failed`；当前实现不负责把历史 JSONL 自动重放到 Seq。

Docker 启动 Seq：

```powershell
docker compose -f docker-compose.observability.yml up -d
```

Windows 安装版 Seq 通常以后台服务运行，默认 UI 地址同样是 `http://127.0.0.1:5341`。

## 设计文档

第一次进入项目建议先读：

1. `docs/README.md`
2. `docs/00-master-design.md`
3. `docs/70-implementation-stack-and-delivery-plan.md`
4. `docs/71-worktree-task-card-index.md`

按任务领域补读：

- 玩家循环：`docs/20-core-game-loop.md`
- 场景分区和可见性：`docs/25-scene-partition-and-visibility.md`
- NPC 认知：`docs/30-npc-cognition-framework.md`
- 持久化和状态：`docs/37-npc-cognition-db-design.md`、`docs/40-simulation-and-state.md`
- LLM 接入：`docs/50-llm-integration.md`、`docs/51-prompt-builder-contract.md`
- UI：`docs/design/game-ui-style-guide.md`、`docs/design/game-ui-layout-blueprints.md`

## 开发约定

- 共享 DTO、事件和调试记录优先定义在 `packages/contracts`。
- `game-core` 不依赖 React、Fastify、SQLite、Pino 或 provider。
- `llm-runtime` 不直接写世界状态，模型输出必须经过 parser/guard/fallback。
- `apps/web` 只消费 view model、事件流和 `ui-sdk`，不复制本地规则。
- 新增跨包导出时同步检查对应包的 `src/index.ts` 和 `package.json` `exports`。
- 修改 prompt/parser/guard 时覆盖成功解析、失败回退和守卫拒绝路径。
- 修改结构化日志时优先补充 `packages/observability`、`packages/llm-runtime` 或 `apps/local-host` 的行为测试。
