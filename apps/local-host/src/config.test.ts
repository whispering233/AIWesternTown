import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadLocalHostEnvFile,
  resolveLocalHostRuntimeConfig
} from "./config.js";

test("loads local-host runtime settings from a .env.local file", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "aiwt-env-"));
  const env: Record<string, string | undefined> = {};

  try {
    await writeFile(
      join(tempDir, ".env.local"),
      [
        "LOCAL_HOST_PORT=9876",
        "LOCAL_HOST_BIND=0.0.0.0",
        "VITE_LOCAL_HOST_URL=http://127.0.0.1:9876"
      ].join("\n")
    );

    const loaded = await loadLocalHostEnvFile({
      cwd: tempDir,
      env
    });
    const config = resolveLocalHostRuntimeConfig(env);

    assert.equal(loaded, true);
    assert.equal(config.port, 9876);
    assert.equal(config.host, "0.0.0.0");
    assert.equal(env.VITE_LOCAL_HOST_URL, "http://127.0.0.1:9876");
  } finally {
    await rm(tempDir, {
      recursive: true,
      force: true
    });
  }
});

test("keeps explicit process environment values ahead of .env.local", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "aiwt-env-"));
  const env: Record<string, string | undefined> = {
    LOCAL_HOST_PORT: "1111"
  };

  try {
    await writeFile(join(tempDir, ".env.local"), "LOCAL_HOST_PORT=2222\n");

    await loadLocalHostEnvFile({
      cwd: tempDir,
      env
    });
    const config = resolveLocalHostRuntimeConfig(env);

    assert.equal(config.port, 1111);
  } finally {
    await rm(tempDir, {
      recursive: true,
      force: true
    });
  }
});
