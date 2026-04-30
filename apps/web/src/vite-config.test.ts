import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";

import viteConfig, { resolveWebDevServerConfig } from "../vite.config";

test("Vite reads app env files from the repository root", () => {
  const config = resolveViteConfigObject();

  assert.equal(config.envDir, resolve(import.meta.dirname, "../../.."));
});

test("Vite dev server host and port can be controlled by env", () => {
  assert.deepEqual(
    resolveWebDevServerConfig({
      VITE_DEV_HOST: "0.0.0.0",
      VITE_DEV_PORT: "4317"
    }),
    {
      host: "0.0.0.0",
      port: 4317
    }
  );
});

function resolveViteConfigObject() {
  if (typeof viteConfig === "function") {
    return viteConfig({
      command: "serve",
      mode: "development",
      isSsrBuild: false,
      isPreview: false
    });
  }

  return viteConfig;
}
