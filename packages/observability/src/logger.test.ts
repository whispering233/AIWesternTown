import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createMemoryLogger,
  createNoopLogger,
  createPinoLogger
} from "./index.js";

test("pino logger writes one JSONL record per event", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "aiwt-logs-"));
  const logFilePath = join(tempDir, "local-host.jsonl");

  try {
    const logger = createPinoLogger({
      enabled: true,
      level: "debug",
      filePath: logFilePath,
      console: false,
      seq: {
        enabled: false,
        url: "http://127.0.0.1:5341"
      }
    });

    logger.info({
      event: "test.event",
      module: "test",
      answer: 42
    });
    await logger.flush?.();

    const lines = (await readFile(logFilePath, "utf8"))
      .trim()
      .split(/\r?\n/);
    const parsed = JSON.parse(lines[0] ?? "{}") as Record<string, unknown>;

    assert.equal(lines.length, 1);
    assert.equal(parsed.event, "test.event");
    assert.equal(parsed.module, "test");
    assert.equal(parsed.answer, 42);
  } finally {
    await rm(tempDir, {
      recursive: true,
      force: true
    });
  }
});

test("logger level filters debug events below info", () => {
  const memory = createMemoryLogger({
    level: "info"
  });

  memory.logger.debug({
    event: "debug.hidden"
  });
  memory.logger.info({
    event: "info.visible"
  });

  assert.deepEqual(
    memory.records.map((record) => record.fields.event),
    ["info.visible"]
  );
});

test("child logger merges bindings into each record", () => {
  const memory = createMemoryLogger({
    level: "debug"
  });
  const logger = memory.logger.child({
    module: "local-host",
    requestId: "req-1"
  });

  logger.info({
    event: "http.request",
    method: "POST"
  });

  assert.equal(memory.records[0]?.fields.module, "local-host");
  assert.equal(memory.records[0]?.fields.requestId, "req-1");
  assert.equal(memory.records[0]?.fields.method, "POST");
});

test("noop logger accepts events without side effects", () => {
  const logger = createNoopLogger();

  assert.doesNotThrow(() => {
    logger.error({
      event: "discarded.event",
      message: "not persisted"
    });
  });
});
