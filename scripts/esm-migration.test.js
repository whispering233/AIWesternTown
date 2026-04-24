import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const repoRoot = process.cwd();

const esmPackages = [
  "apps/cloud-gateway",
  "apps/local-host",
  "packages/app-services",
  "packages/cognition-core",
  "packages/content-schema",
  "packages/contracts",
  "packages/devtools",
  "packages/game-core",
  "packages/llm-runtime",
  "packages/persistence",
  "packages/ui-sdk",
  "content/starter-town"
];

const nodeNextTsconfigs = [
  "apps/cloud-gateway/tsconfig.json",
  "apps/local-host/tsconfig.json",
  "packages/app-services/tsconfig.json",
  "packages/cognition-core/tsconfig.json",
  "packages/content-schema/tsconfig.json",
  "packages/contracts/tsconfig.json",
  "packages/devtools/tsconfig.json",
  "packages/game-core/tsconfig.json",
  "packages/llm-runtime/tsconfig.json",
  "packages/persistence/tsconfig.json",
  "packages/ui-sdk/tsconfig.json",
  "content/starter-town/tsconfig.json"
];

test("Node workspace packages declare ESM package metadata", async () => {
  for (const packageDir of esmPackages) {
    const packageJson = JSON.parse(
      await readFile(join(repoRoot, packageDir, "package.json"), "utf8")
    );

    assert.equal(
      packageJson.type,
      "module",
      `${packageDir} should declare type=module`
    );
  }
});

test("Node-targeted tsconfig files use NodeNext module resolution", async () => {
  for (const tsconfigPath of nodeNextTsconfigs) {
    const tsconfig = JSON.parse(
      await readFile(join(repoRoot, tsconfigPath), "utf8")
    );

    assert.equal(
      tsconfig.compilerOptions?.module,
      "NodeNext",
      `${tsconfigPath} should set compilerOptions.module=NodeNext`
    );
    assert.equal(
      tsconfig.compilerOptions?.moduleResolution,
      "NodeNext",
      `${tsconfigPath} should set compilerOptions.moduleResolution=NodeNext`
    );
  }
});
