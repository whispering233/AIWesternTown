# Game UI System Preview

这个目录是独立于工程实现的本地设计资产目录，用来承载：

- 设计规范的可视化示例
- 样式与布局说明
- 页面骨架示例

它不属于 `apps/web` 的工程实现入口。

## Files

- `index.html`
  - 主预览页，包含规范总览、Main Shell 示例、页面家族骨架
- `styles.css`
  - 预览页样式与设计 tokens
- `preview.js`
  - 轻量交互脚本，用于左栏 tabs 示例

## Related Docs

- `docs/design/README.md`
- `docs/design/game-ui-style-guide.md`
- `docs/design/game-ui-layout-blueprints.md`

## Usage

最简单的查看方式：

1. 直接在浏览器打开 `design/game-ui-system/index.html`
2. 或在仓库根目录运行一个静态服务器，再访问该路径

这个目录的内容是“设计参考资产”，后续工程实现可以参考它，但不应直接把这里的结构复制进产品入口。
