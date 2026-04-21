# Task Card: W00 Repo Bootstrap

## Goal

建立 `TypeScript monorepo` 的基础骨架，使仓库具备统一安装、构建、测试和包解析能力。

## Write Scope

- 根目录配置文件
- `apps/*` 空壳
- `packages/*` 空壳

## Read Scope

- [70-implementation-stack-and-delivery-plan.md](C:/codex/project/AIWesternTown/doc/70-implementation-stack-and-delivery-plan.md)

## Dependencies

- 无

## Out of Scope

- 共享 DTO
- 业务逻辑
- 数据库 schema
- LLM 接入

## Deliverables

- `pnpm-workspace.yaml`
- `turbo.json`
- `tsconfig.base.json`
- 根 `package.json`
- 基础脚本命令

## Done Criteria

- 全仓可 `install`
- 全仓可执行空 `build`
- 全仓可执行空 `test`
- 工作区包解析正常

## Risks

- 目录过早定死后续包名
- 工具链版本不一致导致后续 CI 不稳

## Merge Notes

- 不写业务代码
- 不定义共享契约
