# Game UI System Preview

这个目录是独立于工程实现的本地设计资产目录，用来承载：

- 设计规范的可视化示例
- 样式与布局说明
- 页面骨架示例

它不属于 `apps/web` 的工程实现入口。

## Files

- `design.html`
  - 当前 game UI 重构目标稿，作为 `apps/web` 主界面实现的优先参考
- `design.png`
  - 当前目标稿截图，用于快速视觉对照
- `index.html`
  - 历史主预览页，包含规范总览、旧 Main Shell 示例、页面家族骨架
- `styles.css`
  - `index.html` 预览页样式与设计 tokens
- `preview.js`
  - `index.html` 的轻量交互脚本，用于左栏 tabs 示例

## Related Docs

- `docs/design/README.md`
- `docs/design/game-ui-style-guide.md`
- `docs/design/game-ui-layout-blueprints.md`

## Usage

最简单的查看方式：

1. 直接在浏览器打开 `design/game-ui-system/design.html`
2. 或在仓库根目录运行一个静态服务器，再访问该路径

当前 `apps/web` 主界面重构优先参考 `design.html` 和 `design.png`。`index.html` 仍保留为历史规范总览，不作为当前布局的直接实现目标。
