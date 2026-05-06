import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  loadLocalHostEnvFile,
  resolveLocalHostLoggingConfig,
  resolveLocalHostLLMRuntimeConfig,
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

test("resolves local LLM runtime settings with the configured default local model", () => {
  const config = resolveLocalHostLLMRuntimeConfig({
    LLM_PROVIDER: "local"
  });

  assert.equal(config.gateway.provider, "local");
  assert.equal(config.gateway.local?.capabilities?.supportsJsonObject, false);
  assert.equal(
    config.modelRef,
    "gemma-4-e2b-uncensored-hauhaucs-aggressive"
  );
  assert.equal(config.timeoutMs, 10_000);
});

test("resolves logging defaults for local development", () => {
  const config = resolveLocalHostLoggingConfig({}, "C:\\repo");

  assert.equal(config.enabled, true);
  assert.equal(config.level, "debug");
  assert.equal(config.console, true);
  assert.equal(config.filePath, "C:\\repo\\logs\\local-host.jsonl");
  assert.equal(config.seq.enabled, false);
  assert.equal(config.seq.url, "http://127.0.0.1:5341");
  assert.equal(config.llm.enabled, true);
  assert.equal(config.llm.includeMessages, true);
  assert.equal(config.llm.includeRawResponse, true);
  assert.equal(config.llm.includeStack, true);
  assert.equal(config.llm.maxTextLength, 20000);
});

test("resolves logging overrides from environment", () => {
  const config = resolveLocalHostLoggingConfig(
    {
      LOG_ENABLED: "false",
      LOG_LEVEL: "warn",
      LOG_DIR: "runtime-logs",
      LOG_FILE: "debug.jsonl",
      LOG_CONSOLE: "false",
      LOG_SEQ_ENABLED: "true",
      LOG_SEQ_URL: "http://127.0.0.1:9999",
      LOG_SEQ_API_KEY: "key-1",
      LOG_LLM_ENABLED: "false",
      LOG_LLM_INCLUDE_MESSAGES: "false",
      LOG_LLM_INCLUDE_RAW_RESPONSE: "false",
      LOG_LLM_INCLUDE_STACK: "false",
      LOG_LLM_MAX_TEXT_LENGTH: "123"
    },
    "C:\\repo"
  );

  assert.equal(config.enabled, false);
  assert.equal(config.level, "warn");
  assert.equal(config.console, false);
  assert.equal(config.filePath, "C:\\repo\\runtime-logs\\debug.jsonl");
  assert.deepEqual(config.seq, {
    enabled: true,
    url: "http://127.0.0.1:9999",
    apiKey: "key-1"
  });
  assert.equal(config.llm.enabled, false);
  assert.equal(config.llm.includeMessages, false);
  assert.equal(config.llm.includeRawResponse, false);
  assert.equal(config.llm.includeStack, false);
  assert.equal(config.llm.maxTextLength, 123);
});
