# AIWesternTown 代理协作说明

本文件面向在本仓库内工作的实现代理。除非用户给出更具体的指令，默认遵循这里的约定。

## 项目概览

AIWesternTown 是一个 TypeScript monorepo，用于实现 AI NPC 驱动的西部小镇文字叙事沙盒。第一版目标是跑通浏览器 UI、本地权威内核、世界 tick、简化 NPC 认知链、LLM 附着式渲染与可调试回放链路。

仓库采用：

- 包管理：`pnpm`
- 工作区：`pnpm workspace`
- 任务编排：`Turborepo`
- 模块系统：ESM，根 `package.json` 设置了 `"type": "module"`
- 前端：`apps/web` 使用 React + Vite
- 本地宿主：`apps/local-host` 使用 Fastify
- 持久化：`packages/persistence` 使用 SQLite / Drizzle

## 关键目录

- `apps/web`：浏览器游戏主界面、三栏 shell、叙事交互、命令输入、地图与移动入口。不要在这里实现世界规则或 NPC 认知真相。
- `apps/local-host`：本地权威宿主、HTTP/SSE 接入、会话管理和编排入口。避免把核心规则写进 host 层。
- `apps/cloud-gateway`：云端辅助 gateway。不要让它承载本地世界真相。
- `packages/contracts`：全仓共享 DTO、事件模型、调试模型和 LLM 契约。跨包契约应优先在这里定义。
- `packages/game-core`：`worldTick`、scheduler、玩家循环、场景与可见性规则。不得依赖 React、Fastify 或数据库驱动。
- `packages/cognition-core`：简化 NPC 认知链和阶段编排。
- `packages/llm-runtime`：provider、prompt builder、parser、guard、recorder。不得绕过 parser/guard 直接改世界状态。
- `packages/observability`：结构化日志边界，负责 Pino JSONL、内存测试 logger、LLM 字段脱敏和可选 Seq ingestion。不得把文件或网络日志实现散落到 core 包里。
- `packages/persistence`：SQLite、migration、save/load、event log、repository 层。
- `packages/app-services`：用例编排层，连接 core、content、host、runtime。
- `packages/ui-sdk`：Web 访问 local-host 的 client、SSE 订阅和 view model 适配。
- `packages/devtools`：trace、replay、调试检查器和 fixture 管理。
- `content/starter-town`：starter town 内容包。玩家可见的场景、NPC、item 文案默认使用中文；`sceneId`、`npcId`、`itemId`、tag、enum 等系统字段保持英文稳定。
- `docs`：设计文档、实施方案和任务卡。
- `design/game-ui-system`：游戏 UI 设计系统静态预览。当前只保留 `design.html`、`design.png` 和目录 `README.md` 作为主界面实现参考。

## 开工前阅读

第一次进入项目或任务上下文不明确时，先读：

1. `docs/README.md`
2. `docs/00-master-design.md`
3. `docs/70-implementation-stack-and-delivery-plan.md`
4. `docs/71-worktree-task-card-index.md`

然后按任务领域补读对应文档：

- 玩家循环、时间推进：`docs/20-core-game-loop.md`
- 场景分区、可见性：`docs/25-scene-partition-and-visibility.md`
- NPC 认知：`docs/30-npc-cognition-framework.md`、`docs/35-memory-retrieval-and-recall.md`、`docs/36-npc-cognition-flowcharts.md`
- 持久化和数据模型：`docs/37-npc-cognition-db-design.md`、`docs/40-simulation-and-state.md`
- 物品系统：`docs/42-item-system-and-interaction.md`、`docs/43-item-schema-and-content-config.md`
- LLM 接入：`docs/50-llm-integration.md`、`docs/51-prompt-builder-contract.md`
- UI：`docs/design/game-ui-style-guide.md`、`docs/design/game-ui-layout-blueprints.md`

如果子文档与母设计稿存在冲突，优先使用更具体、更新的子文档；如果仍不确定，在实现前说明假设。

## 常用命令

在仓库根目录运行：

```powershell
pnpm install
pnpm run build
pnpm run typecheck
pnpm run test
```

常用局部命令：

```powershell
pnpm --filter @ai-western-town/web dev
pnpm --filter @ai-western-town/web build
pnpm --filter @ai-western-town/web test
pnpm --filter @ai-western-town/starter-town-content test
pnpm --filter @ai-western-town/app-services test
pnpm --filter @ai-western-town/local-host test
pnpm --filter @ai-western-town/game-core test
pnpm --filter @ai-western-town/llm-runtime test
pnpm --filter @ai-western-town/observability test
```

根 `pnpm run test` 会先运行 `test:esm`，再通过 turbo 跑各包测试。修改跨包契约、构建输出或模块导入时，至少运行相关包测试，并优先补跑根级 `pnpm run typecheck` 或 `pnpm run test`。

## 实现边界

- `contracts` 是共享契约源。跨包 DTO、事件和调试记录不要在多个包里重复定义。
- `game-core` 保持纯规则层，不引入 UI、HTTP、SQLite 或 provider 依赖。
- `llm-runtime` 只提供模型调用链路、解析、守卫和录制，不直接读取数据库实体，不直接写世界状态。
- `apps/web` 只消费 view model、事件流和 `ui-sdk`，不要复制本地宿主或 core 的规则。
- `apps/local-host` 负责 I/O、session 和编排，核心业务规则应下沉到 `packages/*`。
- `observability` 是后端日志基础设施边界。JSONL、Seq、Pino、日志脱敏和测试 logger 只应通过该包暴露，不要在 `game-core`、`cognition-core` 或 UI 层直接引入日志传输实现。
- `persistence` 负责存储实现细节，其他包通过 repository 或服务边界访问。
- 内容包变更应同步考虑 `packages/content-schema` 的校验。
- 内容包只承载世界初始内容和玩家可见文本，不应承载运行时规则；修改名称、描述、目标等文案时优先保持已有 ID、引用、tag 和 enum 不变。

## 代码风格

- 使用 TypeScript 和 ESM `import` / `export`。
- 保持包边界清晰，优先复用本仓已有类型、helper 和测试模式。
- 新增导出时同步检查对应包的 `src/index.ts` 和 `package.json` `exports`。
- 不做无关重构；如果发现邻近代码问题，只有在它阻塞当前任务时才一并处理。
- 注释只写必要的领域约束或不明显的原因，避免解释代码表面行为。
- 文案、设计文档和代理说明默认使用中文；代码标识符保持英文。

## 内容包与本地化

- `content/starter-town` 的玩家可见文本默认中文化，包括场景 `displayName` / `summary`、NPC `displayName` / `role` / `publicPersona` / `coreDrives` / `shortTermGoals`、item `displayName`。
- 系统标识符保持英文，不随展示文本翻译：`sceneId`、`npcId`、`itemId`、`category`、`tags`、`travelTime`、`holderType` 等字段必须继续作为稳定契约使用。
- 当前 item schema 只有 `displayName`，没有独立 `summary` / `description`。如果需要物品描述，先扩展 `packages/content-schema/src/item.ts`，再同步 app-services、UI 和测试。
- 内容包改动至少运行 `pnpm --filter @ai-western-town/starter-town-content test`；如果影响装配或前端可见流程，继续运行 `pnpm --filter @ai-western-town/app-services test` 或相关 UI 测试。

## 测试约定

- 测试文件通常与源码同目录，命名为 `*.test.ts` 或 `*.test.tsx`。
- Node 侧包多使用 `node --test`；Web 包使用 `node --import tsx --test` 跑源码测试。
- 修改共享契约时，检查 `packages/contracts` 及所有依赖包的测试。
- 修改 scheduler、player loop、scene 或 cognition 时，优先补充行为级单测。
- 修改 LLM prompt/parser/guard 时，必须覆盖成功解析、失败回退和守卫拒绝路径。
- 修改持久化 schema 或 migration 时，补充 repository 或 migration 相关测试。

## 前端与 UI

- 前端实现优先遵循 `docs/design` 和 `design/game-ui-system`。
- UI 应服务于可玩文字沙盒和叙事交互效率，避免营销页式结构。
- 当前主界面使用 `Context / Narrative / Map = 1:3:1` 三栏：左栏承载状态、日志、人物卡和未来扩展 tab；主栏承载地点标签、场景叙事、聊天、生成选项和自由输入；右栏承载总地图、当前位置和移动选项。
- 主界面右栏不再承载调试页。LLM trace、prompt、raw output、parsed/fallback 等调试能力应进入独立调试页、devtools 或后续专用入口。
- 不在 UI 层臆造世界状态；展示数据应来自 view model、事件流或调试 DTO。
- 视觉变更完成后，优先用本地 dev server 验证页面是否能正常渲染。

## LLM 接入约束

- 先用 `mock` 跑通流程，再接 `local` 或 `cloud` provider。
- 所有模型调用必须经过 `PromptSpec`、provider、parser、guard、recorder 链路。
- 模型输出只能作为附着式语义能力或有限裁决输入，不能成为规则真相来源。
- 调试记录应保留 request、compiled messages、raw response、parsed result、validation result、fallback reason 和耗时等信息。
- fixture replay 应能脱离真实模型重放失败调用。

## 本地日志与 Seq

- local-host 默认启用结构化日志并写入 `logs/local-host.jsonl`；`logs/` 已被 git 忽略。
- `LOG_ENABLED=false` 会关闭结构化日志输出；`LOG_SEQ_ENABLED=true` 才会把日志发送到 Seq。
- Seq UI 不需要保持打开。只要 Seq 后台服务或 Docker 容器在运行，`local-host` 就可以通过 `LOG_SEQ_URL` 发送日志。
- LLM prompt 和 raw response 默认会进入结构化日志。处理敏感内容时优先使用 `LOG_LLM_INCLUDE_MESSAGES=false`、`LOG_LLM_INCLUDE_RAW_RESPONSE=false` 或 `LOG_LLM_ENABLED=false`。
- Seq ingestion 失败会记录 `logger.seq_write_failed`。当前实现不负责把历史 JSONL 自动重放到 Seq。
- 可选 Docker 启动方式：`docker compose -f docker-compose.observability.yml up -d`；Windows 安装版 Seq 默认可使用 `http://127.0.0.1:5341`。

## Git 与协作

- 开始编辑前查看 `git status --short`。
- 不要还原用户或其他代理的未提交改动。
- 修改范围按包边界和任务卡收敛；避免一次任务跨太多目录。
- `packages/contracts` 同时只适合一个任务修改；如果必须改契约，先说明影响范围。
- 提交前确认相关测试和类型检查结果，并在回复中说明已运行的命令。

