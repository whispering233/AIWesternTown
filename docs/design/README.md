# Game UI Design Docs

这组文档和本地静态示例共同组成 `AIWesternTown` 的 UI 规范参考层。

它们的职责不是直接驱动 `apps/web` 的工程实现，而是先把设计语言、布局规则、页面家族和扩展边界定义清楚，让后续迭代有稳定参照。

## Reading Order

建议按以下顺序阅读：

1. `docs/design/game-ui-style-guide.md`
2. `docs/design/game-ui-layout-blueprints.md`
3. `design/game-ui-system/index.html`

## What Each Asset Does

### `game-ui-style-guide.md`

负责定义：

- 样式语言
- 视觉边界
- 栏位职责
- panel 语法
- 后续迭代的判断标准

### `game-ui-layout-blueprints.md`

负责定义：

- Desktop first 的三栏母版
- 页面家族的版式蓝图
- 信息应该进入哪一栏
- 内容过载时应该如何拆页

### `design/game-ui-system/index.html`

负责提供：

- 本地可视化示例
- 样式 tokens 的展示
- 主界面布局示例
- 页面家族骨架示意

## Boundary With Engineering

以下原则保持稳定：

- 设计规范资产放在 `docs/design/` 和 `design/`
- 工程实现继续放在 `apps/web`
- 工程实现应参考这里的规则和示例
- 不把预览稿、样式草图或设计探索页直接并入产品入口

## Recommended Iteration Loop

后续每一轮 UI 设计建议都按这个顺序推进：

1. 先判断新增页面属于哪一个 `page family`
2. 在 `game-ui-layout-blueprints.md` 中确认骨架是否已覆盖
3. 如果页面类型有变化，先更新文档和本地预览示例
4. 规范确认后，再回到 `apps/web` 实现

这样能把“设计探索”和“工程落地”明确分层，避免后续样式和布局反复摇摆。
