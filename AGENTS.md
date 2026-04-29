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

- `apps/web`：浏览器界面、命令输入、场景反馈、调试面板。不要在这里实现世界规则或 NPC 认知真相。
- `apps/local-host`：本地权威宿主、HTTP/SSE 接入、会话管理和编排入口。避免把核心规则写进 host 层。
- `apps/cloud-gateway`：云端辅助 gateway。不要让它承载本地世界真相。
- `packages/contracts`：全仓共享 DTO、事件模型、调试模型和 LLM 契约。跨包契约应优先在这里定义。
- `packages/game-core`：`worldTick`、scheduler、玩家循环、场景与可见性规则。不得依赖 React、Fastify 或数据库驱动。
- `packages/cognition-core`：简化 NPC 认知链和阶段编排。
- `packages/llm-runtime`：provider、prompt builder、parser、guard、recorder。不得绕过 parser/guard 直接改世界状态。
- `packages/persistence`：SQLite、migration、save/load、event log、repository 层。
- `packages/app-services`：用例编排层，连接 core、content、host、runtime。
- `packages/ui-sdk`：Web 访问 local-host 的 client、SSE 订阅和 view model 适配。
- `packages/devtools`：trace、replay、调试检查器和 fixture 管理。
- `content/starter-town`：starter town 内容包。
- `docs`：设计文档、实施方案和任务卡。
- `design/game-ui-system`：游戏 UI 设计系统静态预览。

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
pnpm --filter @ai-western-town/local-host test
pnpm --filter @ai-western-town/game-core test
pnpm --filter @ai-western-town/llm-runtime test
```

根 `pnpm run test` 会先运行 `test:esm`，再通过 turbo 跑各包测试。修改跨包契约、构建输出或模块导入时，至少运行相关包测试，并优先补跑根级 `pnpm run typecheck` 或 `pnpm run test`。

## 实现边界

- `contracts` 是共享契约源。跨包 DTO、事件和调试记录不要在多个包里重复定义。
- `game-core` 保持纯规则层，不引入 UI、HTTP、SQLite 或 provider 依赖。
- `llm-runtime` 只提供模型调用链路、解析、守卫和录制，不直接读取数据库实体，不直接写世界状态。
- `apps/web` 只消费 view model、事件流和 `ui-sdk`，不要复制本地宿主或 core 的规则。
- `apps/local-host` 负责 I/O、session 和编排，核心业务规则应下沉到 `packages/*`。
- `persistence` 负责存储实现细节，其他包通过 repository 或服务边界访问。
- 内容包变更应同步考虑 `packages/content-schema` 的校验。

## 代码风格

- 使用 TypeScript 和 ESM `import` / `export`。
- 保持包边界清晰，优先复用本仓已有类型、helper 和测试模式。
- 新增导出时同步检查对应包的 `src/index.ts` 和 `package.json` `exports`。
- 不做无关重构；如果发现邻近代码问题，只有在它阻塞当前任务时才一并处理。
- 注释只写必要的领域约束或不明显的原因，避免解释代码表面行为。
- 文案、设计文档和代理说明默认使用中文；代码标识符保持英文。

## 测试约定

- 测试文件通常与源码同目录，命名为 `*.test.ts` 或 `*.test.tsx`。
- Node 侧包多使用 `node --test`；Web 包使用 `node --import tsx --test` 跑源码测试。
- 修改共享契约时，检查 `packages/contracts` 及所有依赖包的测试。
- 修改 scheduler、player loop、scene 或 cognition 时，优先补充行为级单测。
- 修改 LLM prompt/parser/guard 时，必须覆盖成功解析、失败回退和守卫拒绝路径。
- 修改持久化 schema 或 migration 时，补充 repository 或 migration 相关测试。

## 前端与 UI

- 前端实现优先遵循 `docs/design` 和 `design/game-ui-system`。
- UI 应服务于可玩文字沙盒和调试效率，避免营销页式结构。
- 调试面板应清晰展示 trace、prompt、raw output、parsed/fallback 等链路信息。
- 不在 UI 层臆造世界状态；展示数据应来自 view model、事件流或调试 DTO。
- 视觉变更完成后，优先用本地 dev server 验证页面是否能正常渲染。

## LLM 接入约束

- 先用 `mock` 跑通流程，再接 `local` 或 `cloud` provider。
- 所有模型调用必须经过 `PromptSpec`、provider、parser、guard、recorder 链路。
- 模型输出只能作为附着式语义能力或有限裁决输入，不能成为规则真相来源。
- 调试记录应保留 request、compiled messages、raw response、parsed result、validation result、fallback reason 和耗时等信息。
- fixture replay 应能脱离真实模型重放失败调用。

## Git 与协作

- 开始编辑前查看 `git status --short`。
- 不要还原用户或其他代理的未提交改动。
- 修改范围按包边界和任务卡收敛；避免一次任务跨太多目录。
- `packages/contracts` 同时只适合一个任务修改；如果必须改契约，先说明影响范围。
- 提交前确认相关测试和类型检查结果，并在回复中说明已运行的命令。

