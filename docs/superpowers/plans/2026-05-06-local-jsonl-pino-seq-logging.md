# Local JSONL Pino Seq Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured backend logging that writes JSONL files, records LLM requests/responses/errors, and can stream logs to a local Seq Web UI for searching and analysis.

**Architecture:** Create a small `packages/observability` boundary around Pino, JSONL file output, memory test logging, LLM field sanitization, and optional Seq HTTP ingestion. Inject that logger from `apps/local-host` into `packages/app-services` and `packages/llm-runtime` so game-core stays pure and all file/network logging remains infrastructure-owned.

**Tech Stack:** TypeScript ESM, Node test runner, Pino, Seq HTTP CLEF ingestion, Fastify, pnpm workspace, Docker Compose

---

## File Structure

- Modify: `pnpm-lock.yaml`
- Modify: `.gitignore`
- Create: `docker-compose.observability.yml`
- Create: `packages/observability/package.json`
- Create: `packages/observability/tsconfig.json`
- Create: `packages/observability/src/types.ts`
- Create: `packages/observability/src/sanitize.ts`
- Create: `packages/observability/src/seq-sink.ts`
- Create: `packages/observability/src/logger.ts`
- Create: `packages/observability/src/index.ts`
- Test: `packages/observability/src/logger.test.ts`
- Test: `packages/observability/src/sanitize.test.ts`
- Test: `packages/observability/src/seq-sink.test.ts`
- Modify: `packages/llm-runtime/package.json`
- Modify: `packages/llm-runtime/src/gateway/index.ts`
- Modify: `packages/llm-runtime/src/provider/local-provider.ts`
- Modify: `packages/llm-runtime/src/provider/openai-compatible-provider.ts`
- Test: `packages/llm-runtime/src/provider/provider.test.ts`
- Modify: `packages/app-services/package.json`
- Modify: `packages/app-services/src/starter-town-session-runtime.ts`
- Test: `packages/app-services/src/starter-town-session-runtime.test.ts`
- Modify: `apps/local-host/package.json`
- Modify: `apps/local-host/src/config.ts`
- Modify: `apps/local-host/src/index.ts`
- Modify: `apps/local-host/src/server.ts`
- Modify: `apps/local-host/src/session-store.ts`
- Test: `apps/local-host/src/config.test.ts`
- Test: `apps/local-host/src/local-host.test.ts`

## Dependency Decisions

- Add `pino` as a dependency of `@ai-western-town/observability`.
- Do not add `pino-seq` in the first implementation. Seq accepts newline-delimited CLEF through `POST /ingest/clef`, so a tiny explicit sink is easier to test and avoids transport lifecycle surprises.
- Add `@ai-western-town/observability` as a workspace dependency of `@ai-western-town/llm-runtime`, `@ai-western-town/app-services`, and `@ai-western-town/local-host`.
- Keep browser packages unchanged because first version only logs backend-observed requests and server-side chains.

### Task 1: Add the Shared Observability Package

**Files:**
- Modify: `packages/observability/package.json`
- Create: `packages/observability/tsconfig.json`
- Create: `packages/observability/src/index.ts`
- Create: `packages/observability/src/types.ts`
- Create: `packages/observability/src/logger.ts`
- Test: `packages/observability/src/logger.test.ts`

- [ ] **Step 1: Create package shell without logger implementation**

Create `packages/observability/package.json`:

```json
{
  "name": "@ai-western-town/observability",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "pnpm run build && node --test dist/**/*.test.js"
  },
  "dependencies": {
    "pino": "^10.3.1"
  },
  "devDependencies": {
    "@types/node": "^24.9.1"
  }
}
```

Create `packages/observability/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

Create `packages/observability/src/index.ts`:

```ts
export {};
```

- [ ] **Step 2: Install dependencies and update the lockfile**

Run: `pnpm install`

Expected: exit 0 and `pnpm-lock.yaml` includes `pino` under `packages/observability`.

- [ ] **Step 3: Write failing logger tests**

Create `packages/observability/src/logger.test.ts`:

```ts
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
```

- [ ] **Step 4: Run logger tests to verify they fail**

Run: `pnpm --filter @ai-western-town/observability test`

Expected: FAIL because `createMemoryLogger`, `createNoopLogger`, and `createPinoLogger` are not exported from `packages/observability/src/index.ts`.

- [ ] **Step 5: Add minimal logger types**

Create `packages/observability/src/types.ts`:

```ts
export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown> & {
  event: string;
};

export type LogBindings = Record<string, unknown>;

export type Logger = {
  debug(fields: LogFields, message?: string): void;
  info(fields: LogFields, message?: string): void;
  warn(fields: LogFields, message?: string): void;
  error(fields: LogFields, message?: string): void;
  child(bindings: LogBindings): Logger;
  flush?(): Promise<void> | void;
};

export type LoggerFactoryConfig = {
  enabled: boolean;
  level: LogLevel;
  filePath: string;
  console: boolean;
  seq: {
    enabled: boolean;
    url: string;
    apiKey?: string;
  };
};

export type MemoryLogRecord = {
  level: LogLevel;
  fields: LogFields;
  message?: string;
};
```

- [ ] **Step 6: Add minimal logger implementation**

Create `packages/observability/src/logger.ts`:

```ts
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import pino from "pino";

import type {
  LogBindings,
  LogFields,
  Logger,
  LoggerFactoryConfig,
  LogLevel,
  MemoryLogRecord
} from "./types.js";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export function createNoopLogger(): Logger {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
    child() {
      return createNoopLogger();
    },
    flush() {}
  };
}

export function createMemoryLogger(options: {
  level?: LogLevel;
  bindings?: LogBindings;
} = {}): { logger: Logger; records: MemoryLogRecord[] } {
  const records: MemoryLogRecord[] = [];
  const level = options.level ?? "debug";

  const buildLogger = (bindings: LogBindings): Logger => ({
    debug(fields, message) {
      pushMemoryRecord(records, level, "debug", bindings, fields, message);
    },
    info(fields, message) {
      pushMemoryRecord(records, level, "info", bindings, fields, message);
    },
    warn(fields, message) {
      pushMemoryRecord(records, level, "warn", bindings, fields, message);
    },
    error(fields, message) {
      pushMemoryRecord(records, level, "error", bindings, fields, message);
    },
    child(nextBindings) {
      return buildLogger({
        ...bindings,
        ...nextBindings
      });
    },
    flush() {}
  });

  return {
    logger: buildLogger(options.bindings ?? {}),
    records
  };
}

export function createPinoLogger(config: LoggerFactoryConfig): Logger {
  if (!config.enabled) {
    return createNoopLogger();
  }

  mkdirSync(dirname(config.filePath), {
    recursive: true
  });
  const destination = pino.destination({
    dest: config.filePath,
    mkdir: true,
    sync: false
  });
  const streams = [
    {
      stream: destination
    },
    ...(config.console
      ? [
          {
            stream: process.stdout
          }
        ]
      : [])
  ];
  const base = pino(
    {
      level: config.level,
      base: undefined
    },
    pino.multistream(streams)
  );

  return wrapPinoLogger(base, () => {
    destination.flushSync();
  });
}

function wrapPinoLogger(
  base: pino.Logger,
  flush: () => void,
  bindings: LogBindings = {}
): Logger {
  const write = (
    level: LogLevel,
    fields: LogFields,
    message?: string
  ): void => {
    base[level](
      {
        ...bindings,
        ...fields
      },
      message
    );
  };

  return {
    debug(fields, message) {
      write("debug", fields, message);
    },
    info(fields, message) {
      write("info", fields, message);
    },
    warn(fields, message) {
      write("warn", fields, message);
    },
    error(fields, message) {
      write("error", fields, message);
    },
    child(nextBindings) {
      return wrapPinoLogger(
        base,
        flush,
        {
          ...bindings,
          ...nextBindings
        }
      );
    },
    flush
  };
}

function pushMemoryRecord(
  records: MemoryLogRecord[],
  minLevel: LogLevel,
  level: LogLevel,
  bindings: LogBindings,
  fields: LogFields,
  message?: string
): void {
  if (LEVEL_RANK[level] < LEVEL_RANK[minLevel]) {
    return;
  }

  records.push({
    level,
    fields: {
      ...bindings,
      ...fields
    },
    message
  });
}
```

Update `packages/observability/src/index.ts`:

```ts
export * from "./types.js";
export * from "./logger.js";
```

- [ ] **Step 7: Run logger tests to verify they pass**

Run: `pnpm --filter @ai-western-town/observability test`

Expected: PASS with four logger tests.

- [ ] **Step 8: Commit observability logger base**

Run:

```powershell
git add pnpm-lock.yaml packages/observability
git commit -m "Add observability logger package"
```

Expected: commit succeeds and includes only `packages/observability/**` plus `pnpm-lock.yaml`.

### Task 2: Add LLM Sanitization and Seq Sink

**Files:**
- Create: `packages/observability/src/sanitize.ts`
- Create: `packages/observability/src/seq-sink.ts`
- Modify: `packages/observability/src/logger.ts`
- Modify: `packages/observability/src/index.ts`
- Test: `packages/observability/src/sanitize.test.ts`
- Test: `packages/observability/src/seq-sink.test.ts`

- [ ] **Step 1: Write failing sanitization tests**

Create `packages/observability/src/sanitize.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeLLMRequestBody,
  sanitizeLLMResponseText,
  serializeError
} from "./index.js";

test("sanitizeLLMRequestBody omits messages when disabled", () => {
  const sanitized = sanitizeLLMRequestBody(
    {
      model: "local-model",
      messages: [
        {
          role: "user",
          content: "private prompt"
        }
      ],
      temperature: 0.2
    },
    {
      includeMessages: false,
      includeRawResponse: true,
      includeStack: true,
      maxTextLength: 100
    }
  );

  assert.equal("messages" in sanitized, false);
  assert.equal(sanitized.model, "local-model");
  assert.equal(sanitized.temperature, 0.2);
});

test("sanitizeLLMResponseText truncates long raw responses", () => {
  const sanitized = sanitizeLLMResponseText("abcdef", {
    includeMessages: true,
    includeRawResponse: true,
    includeStack: true,
    maxTextLength: 3
  });

  assert.deepEqual(sanitized, {
    rawText: "abc",
    rawTextLength: 6,
    truncated: true
  });
});

test("serializeError includes stack only when enabled", () => {
  const error = new Error("This operation was aborted");
  error.name = "AbortError";

  const withStack = serializeError(error, true);
  const withoutStack = serializeError(error, false);

  assert.equal(withStack.errorName, "AbortError");
  assert.equal(withStack.errorMessage, "This operation was aborted");
  assert.equal(typeof withStack.stack, "string");
  assert.equal("stack" in withoutStack, false);
});
```

- [ ] **Step 2: Run sanitization tests to verify they fail**

Run: `pnpm --filter @ai-western-town/observability test`

Expected: FAIL because `sanitizeLLMRequestBody`, `sanitizeLLMResponseText`, and `serializeError` are not exported.

- [ ] **Step 3: Implement LLM sanitization helpers**

Create `packages/observability/src/sanitize.ts`:

```ts
export type LLMLoggingConfig = {
  includeMessages: boolean;
  includeRawResponse: boolean;
  includeStack: boolean;
  maxTextLength: number;
};

export function sanitizeLLMRequestBody(
  body: Record<string, unknown>,
  config: LLMLoggingConfig
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (key === "messages" && !config.includeMessages) {
      continue;
    }

    sanitized[key] = sanitizeValue(value, config.maxTextLength);
  }

  return sanitized;
}

export function sanitizeLLMResponseText(
  rawText: string,
  config: LLMLoggingConfig
): Record<string, unknown> {
  if (!config.includeRawResponse) {
    return {
      rawTextLength: rawText.length
    };
  }

  const value = truncateString(rawText, config.maxTextLength);

  return value.truncated
    ? {
        rawText: value.text,
        rawTextLength: rawText.length,
        truncated: true
      }
    : {
        rawText
      };
}

export function serializeError(
  error: unknown,
  includeStack: boolean
): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      ...(includeStack && error.stack ? { stack: error.stack } : {})
    };
  }

  return {
    errorName: "UnknownError",
    errorMessage: String(error)
  };
}

function sanitizeValue(value: unknown, maxTextLength: number): unknown {
  if (typeof value === "string") {
    return truncateString(value, maxTextLength).text;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeValue(entry, maxTextLength));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        sanitizeValue(nestedValue, maxTextLength)
      ])
    );
  }

  return value;
}

function truncateString(
  value: string,
  maxTextLength: number
): { text: string; truncated: boolean } {
  if (value.length <= maxTextLength) {
    return {
      text: value,
      truncated: false
    };
  }

  return {
    text: value.slice(0, maxTextLength),
    truncated: true
  };
}
```

Update `packages/observability/src/index.ts`:

```ts
export * from "./types.js";
export * from "./logger.js";
export * from "./sanitize.js";
```

- [ ] **Step 4: Run sanitization tests to verify they pass**

Run: `pnpm --filter @ai-western-town/observability test`

Expected: PASS for logger and sanitization tests.

- [ ] **Step 5: Write failing Seq sink tests**

Create `packages/observability/src/seq-sink.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { createSeqSink, formatSeqEvent } from "./index.js";

test("formatSeqEvent converts logger fields to CLEF", () => {
  const event = formatSeqEvent(
    "info",
    {
      event: "llm.error",
      requestId: "req-1",
      errorName: "AbortError"
    },
    "LLM failed"
  );

  assert.equal(event["@mt"], "LLM failed");
  assert.equal(event["@l"], "Information");
  assert.equal(event.event, "llm.error");
  assert.equal(event.requestId, "req-1");
  assert.equal(event.errorName, "AbortError");
});

test("seq sink posts CLEF to /ingest/clef with optional API key", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const sink = createSeqSink({
    url: "http://127.0.0.1:5341",
    apiKey: "seq-key",
    fetchFn: async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;

      return new Response(JSON.stringify({ MinimumLevelAccepted: null }), {
        status: 201,
        headers: {
          "content-type": "application/json"
        }
      });
    }
  });

  await sink.write("error", {
    event: "llm.error",
    errorName: "AbortError"
  });

  assert.equal(capturedUrl, "http://127.0.0.1:5341/ingest/clef");
  assert.equal(capturedInit?.method, "POST");
  assert.equal(
    new Headers(capturedInit?.headers).get("content-type"),
    "application/vnd.serilog.clef"
  );
  assert.equal(
    new Headers(capturedInit?.headers).get("x-seq-apikey"),
    "seq-key"
  );
  assert.match(String(capturedInit?.body), /"event":"llm.error"/);
});
```

- [ ] **Step 6: Run Seq sink tests to verify they fail**

Run: `pnpm --filter @ai-western-town/observability test`

Expected: FAIL because `createSeqSink` and `formatSeqEvent` are not exported.

- [ ] **Step 7: Implement Seq sink and wire it into Pino logger wrapper**

Create `packages/observability/src/seq-sink.ts`:

```ts
import type { LogFields, LogLevel } from "./types.js";

export type SeqSink = {
  write(level: LogLevel, fields: LogFields, message?: string): Promise<void>;
};

export type SeqSinkOptions = {
  url: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
};

const SEQ_LEVELS: Record<LogLevel, string> = {
  debug: "Debug",
  info: "Information",
  warn: "Warning",
  error: "Error"
};

export function formatSeqEvent(
  level: LogLevel,
  fields: LogFields,
  message?: string
): Record<string, unknown> {
  return {
    "@t": new Date().toISOString(),
    "@mt": message ?? fields.event,
    "@l": SEQ_LEVELS[level],
    ...fields
  };
}

export function createSeqSink(options: SeqSinkOptions): SeqSink {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const endpoint = new URL("/ingest/clef", normalizeSeqUrl(options.url)).toString();

  return {
    async write(level, fields, message) {
      const headers = new Headers({
        "content-type": "application/vnd.serilog.clef"
      });

      if (options.apiKey) {
        headers.set("x-seq-apikey", options.apiKey);
      }

      await fetchFn(endpoint, {
        method: "POST",
        headers,
        body: `${JSON.stringify(formatSeqEvent(level, fields, message))}\n`
      });
    }
  };
}

function normalizeSeqUrl(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}
```

Update `packages/observability/src/logger.ts` imports:

```ts
import { createSeqSink, type SeqSink } from "./seq-sink.js";
```

Create a `SeqSink` in `createPinoLogger()` when `config.seq.enabled` is true:

```ts
const seqSink = config.seq.enabled
  ? createSeqSink({
      url: config.seq.url,
      apiKey: config.seq.apiKey
    })
  : undefined;

return wrapPinoLogger(base, () => {
  destination.flushSync();
}, seqSink, config.seq.url);
```

Change `wrapPinoLogger()` signature and `write()` body:

```ts
function wrapPinoLogger(
  base: pino.Logger,
  flush: () => void,
  seqSink: SeqSink | undefined,
  seqUrl: string,
  bindings: LogBindings = {}
): Logger {
  const write = (
    level: LogLevel,
    fields: LogFields,
    message?: string
  ): void => {
    const mergedFields: LogFields = {
      ...bindings,
      ...fields
    };

    base[level](mergedFields, message);

    void seqSink?.write(level, mergedFields, message).catch(() => {
      base.warn(
        {
          event: "logger.seq_write_failed",
          seqUrl
        },
        "Seq log sink failed"
      );
    });
  };

  return {
    debug(fields, message) {
      write("debug", fields, message);
    },
    info(fields, message) {
      write("info", fields, message);
    },
    warn(fields, message) {
      write("warn", fields, message);
    },
    error(fields, message) {
      write("error", fields, message);
    },
    child(nextBindings) {
      return wrapPinoLogger(
        base,
        flush,
        seqSink,
        seqUrl,
        {
          ...bindings,
          ...nextBindings
        }
      );
    },
    flush
  };
}
```

Update `packages/observability/src/index.ts`:

```ts
export * from "./types.js";
export * from "./logger.js";
export * from "./sanitize.js";
export * from "./seq-sink.js";
```

- [ ] **Step 8: Run observability tests to verify they pass**

Run: `pnpm --filter @ai-western-town/observability test`

Expected: PASS for logger, sanitization, and Seq sink tests.

- [ ] **Step 9: Commit sanitization and Seq sink**

Run:

```powershell
git add packages/observability
git commit -m "Add LLM log sanitization and Seq sink"
```

Expected: commit succeeds with only `packages/observability/**` changes.

### Task 3: Add Local Host Logging Configuration and Seq Compose

**Files:**
- Modify: `.gitignore`
- Create: `docker-compose.observability.yml`
- Modify: `apps/local-host/package.json`
- Modify: `apps/local-host/src/config.ts`
- Test: `apps/local-host/src/config.test.ts`

- [ ] **Step 1: Write failing local-host logging config tests**

Append to `apps/local-host/src/config.test.ts`:

```ts
import { resolveLocalHostLoggingConfig } from "./config.js";

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
```

- [ ] **Step 2: Run config tests to verify they fail**

Run: `pnpm --filter @ai-western-town/local-host test`

Expected: FAIL because `resolveLocalHostLoggingConfig` is not exported and `@ai-western-town/local-host` does not depend on `@ai-western-town/observability`.

- [ ] **Step 3: Add observability dependency to local-host**

Modify `apps/local-host/package.json` dependencies:

```json
{
  "dependencies": {
    "@ai-western-town/app-services": "workspace:*",
    "@ai-western-town/contracts": "workspace:*",
    "@ai-western-town/llm-runtime": "workspace:*",
    "@ai-western-town/observability": "workspace:*",
    "fastify": "^5.6.1"
  }
}
```

Update scripts so focused local-host commands build observability first:

```json
{
  "scripts": {
    "build": "pnpm --filter @ai-western-town/observability build && pnpm --filter @ai-western-town/contracts build && pnpm --filter @ai-western-town/app-services build && tsc -p tsconfig.json",
    "typecheck": "pnpm --filter @ai-western-town/observability build && pnpm --filter @ai-western-town/contracts build && pnpm --filter @ai-western-town/app-services build && tsc -p tsconfig.json --noEmit",
    "test": "pnpm run build && node --test dist/**/*.test.js",
    "dev": "tsx src/index.ts"
  }
}
```

- [ ] **Step 4: Implement logging config parser**

Modify `apps/local-host/src/config.ts`:

```ts
import type { LLMLoggingConfig, LogLevel, LoggerFactoryConfig } from "@ai-western-town/observability";
```

Add:

```ts
export type LocalHostLoggingConfig = LoggerFactoryConfig & {
  llm: LLMLoggingConfig & {
    enabled: boolean;
  };
};

const DEFAULT_LOG_LEVEL: LogLevel = "debug";
const DEFAULT_LOG_DIR = "logs";
const DEFAULT_LOG_FILE = "local-host.jsonl";
const DEFAULT_SEQ_URL = "http://127.0.0.1:5341";
const DEFAULT_LLM_LOG_TEXT_LENGTH = 20_000;

export function resolveLocalHostLoggingConfig(
  env: LocalHostEnv = process.env,
  cwd = process.cwd()
): LocalHostLoggingConfig {
  return {
    enabled: parseBoolean(env.LOG_ENABLED, true),
    level: parseLogLevel(env.LOG_LEVEL, DEFAULT_LOG_LEVEL),
    filePath: resolve(
      cwd,
      env.LOG_DIR ?? DEFAULT_LOG_DIR,
      env.LOG_FILE ?? DEFAULT_LOG_FILE
    ),
    console: parseBoolean(env.LOG_CONSOLE, true),
    seq: {
      enabled: parseBoolean(env.LOG_SEQ_ENABLED, false),
      url: env.LOG_SEQ_URL ?? DEFAULT_SEQ_URL,
      apiKey: env.LOG_SEQ_API_KEY
    },
    llm: {
      enabled: parseBoolean(env.LOG_LLM_ENABLED, true),
      includeMessages: parseBoolean(env.LOG_LLM_INCLUDE_MESSAGES, true),
      includeRawResponse: parseBoolean(env.LOG_LLM_INCLUDE_RAW_RESPONSE, true),
      includeStack: parseBoolean(env.LOG_LLM_INCLUDE_STACK, true),
      maxTextLength: parsePositiveInteger(
        env.LOG_LLM_MAX_TEXT_LENGTH,
        DEFAULT_LLM_LOG_TEXT_LENGTH,
        "LOG_LLM_MAX_TEXT_LENGTH"
      )
    }
  };
}

function parseLogLevel(value: string | undefined, defaultValue: LogLevel): LogLevel {
  if (value === undefined) {
    return defaultValue;
  }

  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  throw new Error(
    `Invalid LOG_LEVEL "${value}". Expected debug, info, warn, or error.`
  );
}
```

- [ ] **Step 5: Add `.gitignore` and Seq Docker Compose**

Append to `.gitignore`:

```gitignore
logs/
.seq/
```

Create `docker-compose.observability.yml`:

```yaml
services:
  seq:
    image: datalust/seq:latest
    container_name: ai-western-town-seq
    environment:
      ACCEPT_EULA: "Y"
    ports:
      - "5341:80"
    volumes:
      - ./.seq:/data
    restart: unless-stopped
```

- [ ] **Step 6: Run config tests to verify they pass**

Run: `pnpm --filter @ai-western-town/local-host test`

Expected: PASS for config tests. If unrelated local-host tests fail because downstream packages do not yet build against observability, keep the failing output and continue to Task 4 before claiming local-host package pass.

- [ ] **Step 7: Commit local-host logging config and Seq compose**

Run:

```powershell
git add .gitignore docker-compose.observability.yml apps/local-host/package.json apps/local-host/src/config.ts apps/local-host/src/config.test.ts pnpm-lock.yaml
git commit -m "Add local logging configuration"
```

Expected: commit succeeds with config, compose, ignore, package, and lockfile changes.

### Task 4: Log Real OpenAI-Compatible LLM Requests and Responses

**Files:**
- Modify: `packages/llm-runtime/package.json`
- Modify: `packages/llm-runtime/src/gateway/index.ts`
- Modify: `packages/llm-runtime/src/provider/local-provider.ts`
- Modify: `packages/llm-runtime/src/provider/openai-compatible-provider.ts`
- Test: `packages/llm-runtime/src/provider/provider.test.ts`

- [ ] **Step 1: Write failing provider logging tests**

Append to `packages/llm-runtime/src/provider/provider.test.ts`:

```ts
import { createMemoryLogger } from "@ai-western-town/observability";

test("local provider logs LLM request and response without authorization headers", async () => {
  const memory = createMemoryLogger();
  const provider = createLocalProvider({
    baseUrl: "http://127.0.0.1:1234/v1",
    apiKey: "secret-key",
    logger: memory.logger,
    llmLogging: {
      enabled: true,
      includeMessages: true,
      includeRawResponse: true,
      includeStack: true,
      maxTextLength: 1000
    },
    fetchFn: async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "{\"visibleText\":\"Logged response.\"}"
              },
              finish_reason: "stop"
            }
          ],
          usage: {
            prompt_tokens: 3,
            completion_tokens: 4
          }
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
  });

  const response = await provider.invoke(createProviderRequest());
  const events = memory.records.map((record) => record.fields);

  assert.equal(response.finishReason, "stop");
  assert.equal(events[0]?.event, "llm.request");
  assert.equal(events[1]?.event, "llm.response");
  assert.equal(events[0]?.provider, "local");
  assert.equal(events[0]?.model, "local-model");
  assert.deepEqual(events[0]?.messages, createProviderRequest().messages);
  assert.equal(events[1]?.rawText, "{\"visibleText\":\"Logged response.\"}");
  assert.equal(JSON.stringify(events).includes("secret-key"), false);
  assert.equal(JSON.stringify(events).includes("authorization"), false);
});

test("local provider logs AbortError details before returning timeout response", async () => {
  const memory = createMemoryLogger();
  const provider = createLocalProvider({
    baseUrl: "http://127.0.0.1:1234/v1",
    logger: memory.logger,
    llmLogging: {
      enabled: true,
      includeMessages: true,
      includeRawResponse: true,
      includeStack: true,
      maxTextLength: 1000
    },
    fetchFn: async () => {
      const error = new Error("This operation was aborted");
      error.name = "AbortError";
      throw error;
    }
  });

  const response = await provider.invoke(createProviderRequest());
  const errorEvent = memory.records.find(
    (record) => record.fields.event === "llm.error"
  )?.fields;

  assert.equal(response.finishReason, "timeout");
  assert.equal(errorEvent?.errorName, "AbortError");
  assert.equal(errorEvent?.errorMessage, "This operation was aborted");
  assert.equal(typeof errorEvent?.durationMs, "number");
  assert.equal(typeof errorEvent?.stack, "string");
});

test("local provider logs non-2xx model responses as LLM errors", async () => {
  const memory = createMemoryLogger();
  const provider = createLocalProvider({
    baseUrl: "http://127.0.0.1:1234/v1",
    logger: memory.logger,
    llmLogging: {
      enabled: true,
      includeMessages: true,
      includeRawResponse: true,
      includeStack: true,
      maxTextLength: 1000
    },
    fetchFn: async () =>
      new Response("model not loaded", {
        status: 503,
        statusText: "Service Unavailable"
      })
  });

  const response = await provider.invoke(createProviderRequest());
  const errorEvent = memory.records.find(
    (record) => record.fields.event === "llm.error"
  )?.fields;

  assert.equal(response.finishReason, "error");
  assert.equal(response.errorCode, "provider_http_error");
  assert.equal(errorEvent?.finishReason, "error");
  assert.equal(errorEvent?.errorCode, "provider_http_error");
  assert.match(String(errorEvent?.errorMessage), /503/);
  assert.equal(errorEvent?.rawText, "model not loaded");
});
```

- [ ] **Step 2: Run provider tests to verify they fail**

Run: `pnpm --filter @ai-western-town/llm-runtime test`

Expected: FAIL because `@ai-western-town/llm-runtime` does not depend on observability and `LocalProviderOptions` does not accept `logger` or `llmLogging`.

- [ ] **Step 3: Add observability dependency and scripts**

Modify `packages/llm-runtime/package.json` dependencies:

```json
{
  "dependencies": {
    "@ai-western-town/contracts": "workspace:*",
    "@ai-western-town/observability": "workspace:*"
  }
}
```

Update scripts:

```json
{
  "scripts": {
    "build": "pnpm --filter @ai-western-town/observability build && pnpm --filter @ai-western-town/contracts build && tsc -p tsconfig.json",
    "typecheck": "pnpm --filter @ai-western-town/observability build && pnpm --filter @ai-western-town/contracts build && tsc -p tsconfig.json --noEmit",
    "test": "pnpm run build && node --test dist/**/*.test.js"
  }
}
```

Run: `pnpm install`

Expected: exit 0 and lockfile updates workspace dependency graph.

- [ ] **Step 4: Extend provider and gateway types**

Modify `packages/llm-runtime/src/provider/openai-compatible-provider.ts` imports:

```ts
import {
  createNoopLogger,
  sanitizeLLMRequestBody,
  sanitizeLLMResponseText,
  serializeError,
  type LLMLoggingConfig,
  type Logger
} from "@ai-western-town/observability";
```

Add to `OpenAICompatibleProviderOptions`:

```ts
logger?: Logger;
llmLogging?: (LLMLoggingConfig & { enabled: boolean });
```

Modify `packages/llm-runtime/src/provider/local-provider.ts` so `LocalProviderOptions` still omits only `name` and passes all options through.

Modify `packages/llm-runtime/src/gateway/index.ts`:

```ts
import type { LLMLoggingConfig, Logger } from "@ai-western-town/observability";

export type CreateLLMGatewayOptions = {
  logger?: Logger;
  llmLogging?: LLMLoggingConfig & {
    enabled: boolean;
  };
};

export function createLLMGateway(
  config: LLMGatewayConfig,
  options: CreateLLMGatewayOptions = {}
): LLMGateway {
  return new DefaultLLMGateway(createProviderFromConfig(config, options));
}

export function createProviderFromConfig(
  config: LLMGatewayConfig,
  options: CreateLLMGatewayOptions = {}
): LLMProvider {
  switch (config.provider) {
    case "mock":
      return createMockProvider(config.mock);
    case "local":
      return createLocalProvider({
        ...(config.local ?? {
          baseUrl: DEFAULT_LOCAL_BASE_URL
        }),
        logger: options.logger?.child({
          module: "llm-runtime",
          provider: "local"
        }),
        llmLogging: options.llmLogging
      });
    case "cloud":
      return createCloudProviderPlaceholder(config.cloud);
  }
}
```

- [ ] **Step 5: Implement provider logging around fetch**

In `OpenAICompatibleProvider.invoke()` compute URL, body, logger, and timing once:

```ts
const logger = this.#options.logger ?? createNoopLogger();
const llmLogging = this.#options.llmLogging ?? {
  enabled: false,
  includeMessages: false,
  includeRawResponse: false,
  includeStack: false,
  maxTextLength: 20_000
};
const startedAt = Date.now();
const url = joinProviderUrl(
  this.#options.baseUrl,
  this.#options.chatCompletionsPath ??
    getDefaultOpenAIPath(this.#options.baseUrl, "/chat/completions")
);
const requestBody = createChatCompletionBody(request, this.#capabilities);

if (llmLogging.enabled) {
  logger.info({
    event: "llm.request",
    provider: this.getName(),
    requestId: request.requestId,
    model: request.modelRef,
    url,
    ...sanitizeLLMRequestBody(requestBody, llmLogging)
  });
}
```

Use `url` and `requestBody` in `fetchFn()`. After `response.text()`, handle non-2xx responses with a logged provider error:

```ts
if (!response.ok) {
  const providerResponse = createProviderErrorResponse(
    request,
    this.getName(),
    "provider_http_error",
    `Model service returned ${response.status} ${response.statusText}: ${responseText}`
  );

  if (llmLogging.enabled) {
    logger.error({
      event: "llm.error",
      provider: this.getName(),
      requestId: request.requestId,
      model: request.modelRef,
      durationMs: Date.now() - startedAt,
      finishReason: providerResponse.finishReason,
      errorCode: providerResponse.errorCode,
      errorMessage: providerResponse.errorMessage,
      ...sanitizeLLMResponseText(responseText, llmLogging)
    });
  }

  return providerResponse;
}
```

Before returning a parsed completion response:

```ts
const mapped = this.#mapCompletionResponse(request, responseText);

if (llmLogging.enabled) {
  const fields = {
    event: mapped.finishReason === "error" ? "llm.error" : "llm.response",
    provider: this.getName(),
    requestId: request.requestId,
    model: request.modelRef,
    durationMs: Date.now() - startedAt,
    finishReason: mapped.finishReason,
    usage: mapped.usage,
    errorCode: mapped.errorCode,
    errorMessage: mapped.errorMessage,
    ...sanitizeLLMResponseText(responseText, llmLogging)
  };

  if (mapped.finishReason === "error") {
    logger.error(fields);
  } else {
    logger.info(fields);
  }
}

return mapped;
```

In the `catch` block before returning provider error response:

```ts
if (llmLogging.enabled) {
  logger.error({
    event: "llm.error",
    provider: this.getName(),
    requestId: request.requestId,
    model: request.modelRef,
    durationMs: Date.now() - startedAt,
    ...serializeError(error, llmLogging.includeStack)
  });
}
```

- [ ] **Step 6: Run provider tests to verify they pass**

Run: `pnpm --filter @ai-western-town/llm-runtime test`

Expected: PASS for provider tests including LLM request/response/error logging.

- [ ] **Step 7: Commit provider logging**

Run:

```powershell
git add packages/llm-runtime packages/observability pnpm-lock.yaml
git commit -m "Log OpenAI-compatible LLM calls"
```

Expected: commit succeeds with llm-runtime, observability type exports if changed, and lockfile changes.

### Task 5: Log `submitCommand` Business Stages

**Files:**
- Modify: `packages/app-services/package.json`
- Modify: `packages/app-services/src/starter-town-session-runtime.ts`
- Test: `packages/app-services/src/starter-town-session-runtime.test.ts`

- [ ] **Step 1: Write failing app-services logging tests**

Append to `packages/app-services/src/starter-town-session-runtime.test.ts`:

```ts
import { createMemoryLogger } from "@ai-western-town/observability";

test("starter town session runtime logs submitCommand success stages", async () => {
  const memory = createMemoryLogger();
  const runtime = createStarterTownSessionRuntime({
    logger: memory.logger,
    modelRef: "test-local-model",
    llmGateway: {
      getProvider() {
        throw new Error("getProvider is not used by this app-service test.");
      },
      async healthCheck() {
        return {
          providerName: "fake-local",
          ok: true
        };
      },
      async invoke(request: ProviderRequest): Promise<ProviderResponse> {
        return {
          requestId: request.requestId,
          providerName: "fake-local",
          modelRef: request.modelRef,
          finishReason: "stop",
          rawText:
            "{\"visibleText\":\"Mara keeps her answer short.\",\"gestureTags\":[\"guarded\"]}"
        };
      }
    }
  });
  const initialState = runtime.createInitialState({
    currentSceneId: "saloon"
  });

  await runtime.submitCommand(initialState, createCommand(), {
    requestId: "req-1",
    sessionId: "session-1"
  });

  const events = memory.records.map((record) => record.fields.event);

  assert.deepEqual(events.filter((event) => String(event).startsWith("submitCommand")), [
    "submitCommand.start",
    "submitCommand.worldTick.done",
    "submitCommand.npcCognition.done",
    "submitCommand.done"
  ]);
  assert.equal(memory.records[0]?.fields.requestId, "req-1");
  assert.equal(memory.records[0]?.fields.sessionId, "session-1");
  assert.equal(memory.records[0]?.fields.commandId, "cmd-approach-bartender");
});

test("starter town session runtime logs visible outcome fallback", async () => {
  const memory = createMemoryLogger();
  const runtime = createStarterTownSessionRuntime({
    logger: memory.logger,
    modelRef: "test-local-model",
    llmGateway: {
      getProvider() {
        throw new Error("getProvider is not used by this app-service test.");
      },
      async healthCheck() {
        return {
          providerName: "fake-local",
          ok: true
        };
      },
      async invoke(request: ProviderRequest): Promise<ProviderResponse> {
        return {
          requestId: request.requestId,
          providerName: "fake-local",
          modelRef: request.modelRef,
          finishReason: "timeout",
          rawText: "",
          errorCode: "provider_timeout",
          errorMessage: "Model service timed out."
        };
      }
    }
  });

  await runtime.submitCommand(
    runtime.createInitialState({
      currentSceneId: "saloon"
    }),
    createCommand(),
    {
      requestId: "req-2",
      sessionId: "session-2"
    }
  );

  const fallbackEvent = memory.records.find(
    (record) => record.fields.event === "llm.visibleOutcome.fallback"
  )?.fields;

  assert.equal(fallbackEvent?.requestId, "req-2");
  assert.equal(fallbackEvent?.reason, "timeout");
});
```

- [ ] **Step 2: Run app-services tests to verify they fail**

Run: `pnpm --filter @ai-western-town/app-services test`

Expected: FAIL because `CreateStarterTownSessionRuntimeOptions` has no `logger` and `submitCommand()` has no context parameter.

- [ ] **Step 3: Add observability dependency and scripts**

Modify `packages/app-services/package.json` dependencies:

```json
{
  "dependencies": {
    "@ai-western-town/contracts": "workspace:*",
    "@ai-western-town/content-schema": "workspace:*",
    "@ai-western-town/cognition-core": "workspace:*",
    "@ai-western-town/game-core": "workspace:*",
    "@ai-western-town/llm-runtime": "workspace:*",
    "@ai-western-town/observability": "workspace:*",
    "@ai-western-town/starter-town-content": "workspace:*"
  }
}
```

Update scripts to build observability before app-services:

```json
{
  "scripts": {
    "build": "pnpm --filter @ai-western-town/observability build && pnpm --filter @ai-western-town/content-schema build && pnpm --filter @ai-western-town/contracts build && pnpm --filter @ai-western-town/game-core build && pnpm --filter @ai-western-town/cognition-core build && pnpm --filter @ai-western-town/llm-runtime build && pnpm --filter @ai-western-town/starter-town-content build && tsc -p tsconfig.json",
    "typecheck": "pnpm --filter @ai-western-town/observability build && pnpm --filter @ai-western-town/content-schema build && pnpm --filter @ai-western-town/contracts build && pnpm --filter @ai-western-town/game-core build && pnpm --filter @ai-western-town/cognition-core build && pnpm --filter @ai-western-town/llm-runtime build && pnpm --filter @ai-western-town/starter-town-content build && tsc -p tsconfig.json --noEmit",
    "test": "pnpm run build && node --test dist/**/*.test.js"
  }
}
```

Run: `pnpm install`

Expected: exit 0 and lockfile updates workspace dependency graph.

- [ ] **Step 4: Extend runtime options and submitCommand context**

Modify `packages/app-services/src/starter-town-session-runtime.ts` imports:

```ts
import {
  createNoopLogger,
  serializeError,
  type LLMLoggingConfig,
  type Logger
} from "@ai-western-town/observability";
```

Add types:

```ts
export type StarterTownSubmitCommandContext = {
  requestId?: string;
  sessionId?: string;
  logger?: Logger;
};
```

Change interface:

```ts
submitCommand(
  state: StarterTownSessionState,
  playerCommand: PlayerCommandEnvelope,
  context?: StarterTownSubmitCommandContext
): Promise<StarterTownCommandResult>;
```

Add options:

```ts
logger?: Logger;
llmLogging?: LLMLoggingConfig & {
  enabled: boolean;
};
```

When creating the gateway:

```ts
createLLMGateway(options.llmGatewayConfig ?? defaultConfig, {
  logger: options.logger,
  llmLogging: options.llmLogging
});
```

- [ ] **Step 5: Implement submitCommand stage logs**

Inside `submitCommand()`:

```ts
const commandLogger = (context?.logger ?? options.logger ?? createNoopLogger()).child({
  module: "app-services",
  requestId: context?.requestId,
  sessionId: context?.sessionId,
  commandId: playerCommand.commandId
});
const startedAt = Date.now();

commandLogger.info({
  event: "submitCommand.start",
  worldTickBefore: state.worldTick,
  commandType: playerCommand.commandType,
  commandText: getPlayerCommandText(playerCommand)
});

try {
  const simulation = advanceWorldSimulation(
    buildWorldSimulationInput(bundle, state, playerCommand)
  );

  commandLogger.info({
    event: "submitCommand.worldTick.done",
    worldTickAfter: simulation.advancedToTick,
    appendedEventCount: simulation.appendedEvents.length,
    plannedNpcExecutionCount: simulation.executionPlan.npcExecutions.length
  });

  // existing cognition and rendering loop

  commandLogger.info({
    event: "submitCommand.npcCognition.done",
    cognitionResultCount: npcResults.length,
    npcWorldEventCount: npcWorldEvents.length
  });

  commandLogger.info({
    event: "submitCommand.done",
    durationMs: Date.now() - startedAt,
    worldTickAfter: nextState.worldTick,
    worldEventCount: worldEvents.length,
    llmCallCount: llmTraceIds.length
  });

  return result;
} catch (error) {
  commandLogger.error({
    event: "submitCommand.error",
    durationMs: Date.now() - startedAt,
    ...serializeError(error, true)
  });
  throw error;
}
```

Pass `commandLogger` into `renderVisibleOutcome()`:

```ts
logger: commandLogger.child({
  npcId: plannedExecution.npcId
})
```

Inside `renderVisibleOutcome()` log:

```ts
input.logger.info({
  event: "llm.visibleOutcome.start",
  worldTick: input.worldTick,
  npcId: input.npcId,
  model: input.modelRef
});
```

On provider timeout/error response:

```ts
input.logger.warn({
  event: "llm.visibleOutcome.fallback",
  reason: response.finishReason,
  requestId: request.requestId,
  errorCode: response.errorCode,
  errorMessage: response.errorMessage
});
```

On parsed success:

```ts
input.logger.info({
  event: "llm.visibleOutcome.done",
  requestId: request.requestId,
  traceId,
  finishReason: response.finishReason
});
```

- [ ] **Step 6: Run app-services tests to verify they pass**

Run: `pnpm --filter @ai-western-town/app-services test`

Expected: PASS for app-services tests including submitCommand logging.

- [ ] **Step 7: Commit submitCommand logging**

Run:

```powershell
git add packages/app-services pnpm-lock.yaml
git commit -m "Log starter town command runtime stages"
```

Expected: commit succeeds with app-services and lockfile changes.

### Task 6: Wire Logging Through Local Host HTTP, SSE, and Entrypoint

**Files:**
- Modify: `apps/local-host/src/index.ts`
- Modify: `apps/local-host/src/server.ts`
- Modify: `apps/local-host/src/session-store.ts`
- Test: `apps/local-host/src/local-host.test.ts`

- [ ] **Step 1: Write failing local-host request logging tests**

Append to `apps/local-host/src/local-host.test.ts`:

```ts
import { createMemoryLogger } from "@ai-western-town/observability";

test("local host logs HTTP request and response events", async () => {
  const memory = createMemoryLogger();
  const server = buildLocalHostServer({
    logger: false,
    observabilityLogger: memory.logger
  });

  await server.listen({
    port: 0,
    host: "127.0.0.1"
  });

  const baseUrl = `http://127.0.0.1:${getAddressInfo(server.server.address()).port}`;

  try {
    const response = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-http-1"
      },
      body: JSON.stringify({})
    });

    assert.equal(response.status, 201);

    const events = memory.records.map((record) => record.fields);

    assert.equal(events.some((event) => event.event === "http.request"), true);
    assert.equal(events.some((event) => event.event === "http.response"), true);
    assert.equal(
      events.find((event) => event.event === "http.request")?.requestId,
      "req-http-1"
    );
    assert.equal(
      events.find((event) => event.event === "http.response")?.statusCode,
      201
    );
  } finally {
    await server.close();
  }
});

test("local host passes request logger context into submitCommand", async () => {
  const memory = createMemoryLogger();
  const runtime = createStarterTownSessionRuntime({
    logger: memory.logger,
    modelRef: "test-local-model",
    llmGateway: createFakeLLMGateway(
      "{\"visibleText\":\"Mara keeps her answer short.\",\"gestureTags\":[\"guarded\"]}"
    )
  });
  const server = buildLocalHostServer({
    logger: false,
    observabilityLogger: memory.logger,
    sessionRuntime: runtime
  });

  await server.listen({
    port: 0,
    host: "127.0.0.1"
  });

  const baseUrl = `http://127.0.0.1:${getAddressInfo(server.server.address()).port}`;

  try {
    const createResponse = await fetch(`${baseUrl}/sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({})
    });
    const createPayload = createLocalSessionResponseSchema.parse(
      (await createResponse.json()) as CreateLocalSessionResponse
    );

    const commandResponse = await fetch(
      `${baseUrl}/sessions/${createPayload.session.sessionId}/commands`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-request-id": "req-command-1"
        },
        body: JSON.stringify({
          playerCommand: {
            commandId: "cmd-logged",
            commandType: "social",
            parsedAction: {
              actionId: "act-approach-bartender",
              actionClass: "intervene",
              actionType: "ask_bartender_about_room",
              targetActorId: "bartender",
              targetNpcId: "bartender",
              tags: ["social", "probe", "public"]
            },
            issuedAtTick: 0,
            consumesTick: true,
            metadata: {
              commandText: "问问酒保刚才为什么突然安静"
            }
          }
        })
      }
    );

    assert.equal(commandResponse.status, 202);

    const submitStart = memory.records.find(
      (record) => record.fields.event === "submitCommand.start"
    )?.fields;

    assert.equal(submitStart?.requestId, "req-command-1");
    assert.equal(submitStart?.sessionId, createPayload.session.sessionId);
    assert.equal(submitStart?.commandId, "cmd-logged");
  } finally {
    await server.close();
  }
});
```

- [ ] **Step 2: Run local-host tests to verify they fail**

Run: `pnpm --filter @ai-western-town/local-host test`

Expected: FAIL because `buildLocalHostServer()` has no `observabilityLogger` option and `InMemoryLocalSessionStore.submitCommand()` has no context parameter.

- [ ] **Step 3: Extend session-store submit context**

Modify `apps/local-host/src/session-store.ts` imports:

```ts
import type { Logger } from "@ai-western-town/observability";
```

Add:

```ts
export type LocalSessionCommandContext = {
  logger?: Logger;
  requestId?: string;
};
```

Change methods:

```ts
submitCommand(
  sessionId: string,
  playerCommand: PlayerCommandEnvelope,
  context: LocalSessionCommandContext = {}
): Promise<SubmitLocalCommandResponse> {
  return this.submitCommandAsync(sessionId, playerCommand, context);
}

private async submitCommandAsync(
  sessionId: string,
  playerCommand: PlayerCommandEnvelope,
  context: LocalSessionCommandContext
): Promise<SubmitLocalCommandResponse> {
  const state = this.getSessionState(sessionId);
  const commandResult = await this.sessionRuntime.submitCommand(
    state.appState,
    playerCommand,
    {
      logger: context.logger,
      requestId: context.requestId,
      sessionId
    }
  );
  // keep existing state update and publishing behavior
}
```

- [ ] **Step 4: Add local-host server logging hooks**

Modify `apps/local-host/src/server.ts` imports:

```ts
import {
  createNoopLogger,
  serializeError,
  type Logger
} from "@ai-western-town/observability";
```

Change options:

```ts
export type BuildLocalHostServerOptions = {
  sessionStore?: InMemoryLocalSessionStore;
  sessionRuntime?: StarterTownSessionRuntime;
  logger?: boolean;
  observabilityLogger?: Logger;
};
```

At the top of `buildLocalHostServer()`:

```ts
const appLogger = (options.observabilityLogger ?? createNoopLogger()).child({
  module: "local-host"
});
const requestStartedAt = new WeakMap<FastifyRequest, number>();
```

In `onRequest`:

```ts
requestStartedAt.set(request, Date.now());
appLogger.info({
  event: "http.request",
  requestId: getRequestId(request),
  method: request.method,
  url: request.url
});
```

Add `onResponse`:

```ts
server.addHook("onResponse", (request, reply, done) => {
  appLogger.info({
    event: "http.response",
    requestId: getRequestId(request),
    method: request.method,
    url: request.url,
    statusCode: reply.statusCode,
    durationMs: Date.now() - (requestStartedAt.get(request) ?? Date.now())
  });
  done();
});
```

In `setErrorHandler()` before sending response:

```ts
appLogger.error({
  event: "http.error",
  requestId: getRequestId(request),
  method: request.method,
  url: request.url,
  ...serializeError(error, true)
});
```

Add helper:

```ts
function getRequestId(request: FastifyRequest): string {
  const header = request.headers["x-request-id"];

  return typeof header === "string" && header.length > 0
    ? header
    : String(request.id);
}
```

- [ ] **Step 5: Pass command request context and log SSE**

In command route:

```ts
const requestId = getRequestId(request);
const routeLogger = appLogger.child({
  requestId,
  sessionId: request.params.sessionId
});
const response = contracts.submitLocalCommandResponseSchema.parse(
  await sessionStore.submitCommand(
    request.params.sessionId,
    body.playerCommand,
    {
      logger: routeLogger,
      requestId
    }
  )
);
```

In SSE route before writing snapshot:

```ts
const requestId = getRequestId(request);
const routeLogger = appLogger.child({
  requestId,
  sessionId: request.params.sessionId
});

routeLogger.info({
  event: "sse.connect"
});
```

In close handler:

```ts
routeLogger.info({
  event: "sse.disconnect"
});
```

- [ ] **Step 6: Wire entrypoint logger creation**

Modify `apps/local-host/src/index.ts` imports:

```ts
import { createPinoLogger } from "@ai-western-town/observability";
```

Import config:

```ts
resolveLocalHostLoggingConfig
```

Inside `main()`:

```ts
const loggingConfig = resolveLocalHostLoggingConfig();
const logger = createPinoLogger(loggingConfig);
const sessionRuntime = createStarterTownSessionRuntime({
  llmGatewayConfig: llmConfig.gateway,
  modelRef: llmConfig.modelRef,
  llmTimeoutMs: llmConfig.timeoutMs,
  logger,
  llmLogging: loggingConfig.llm
});
const server = buildLocalHostServer({
  sessionRuntime,
  observabilityLogger: logger
});
```

- [ ] **Step 7: Run local-host tests to verify they pass**

Run: `pnpm --filter @ai-western-town/local-host test`

Expected: PASS for local-host tests including HTTP logging and request context propagation.

- [ ] **Step 8: Commit local-host wiring**

Run:

```powershell
git add apps/local-host packages/app-services pnpm-lock.yaml
git commit -m "Wire local host structured logging"
```

Expected: commit succeeds with local-host wiring and any necessary type updates.

### Task 7: End-to-End Verification and Manual Seq Check

**Files:**
- Verify only unless a preceding task exposed a small integration fix.

- [ ] **Step 1: Run focused package tests**

Run:

```powershell
pnpm --filter @ai-western-town/observability test
pnpm --filter @ai-western-town/llm-runtime test
pnpm --filter @ai-western-town/app-services test
pnpm --filter @ai-western-town/local-host test
```

Expected: each command exits 0.

- [ ] **Step 2: Run root typecheck**

Run: `pnpm run typecheck`

Expected: exit 0 across the workspace.

- [ ] **Step 3: Start Seq locally**

Run:

```powershell
docker compose -f docker-compose.observability.yml up -d
```

Expected: container `ai-western-town-seq` is running and `http://127.0.0.1:5341` opens the Seq UI.

- [ ] **Step 4: Start local-host with logging enabled**

Run:

```powershell
$env:LOG_ENABLED="true"
$env:LOG_LEVEL="debug"
$env:LOG_SEQ_ENABLED="true"
$env:LOG_SEQ_URL="http://127.0.0.1:5341"
$env:LLM_PROVIDER="mock"
pnpm --filter @ai-western-town/local-host dev
```

Expected: local-host starts on the configured port and creates `logs/local-host.jsonl` after the first request.

- [ ] **Step 5: Send a smoke command**

In a second terminal:

```powershell
$session = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8787/sessions -ContentType "application/json" -Body "{}"
$body = @{
  playerCommand = @{
    commandId = "cmd-log-smoke"
    commandType = "social"
    parsedAction = @{
      actionId = "act-approach-bartender"
      actionClass = "intervene"
      actionType = "ask_bartender_about_room"
      targetActorId = "bartender"
      targetNpcId = "bartender"
      tags = @("social", "probe", "public")
    }
    issuedAtTick = 0
    consumesTick = $true
    metadata = @{
      commandText = "问问酒保刚才为什么突然安静"
    }
  }
} | ConvertTo-Json -Depth 10
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8787/sessions/$($session.session.sessionId)/commands" -Headers @{"x-request-id"="req-smoke-1"} -ContentType "application/json" -Body $body
```

Expected: command returns accepted response with `acceptedCommandId` equal to `cmd-log-smoke`.

- [ ] **Step 6: Verify JSONL file content**

Run:

```powershell
Get-Content logs\local-host.jsonl | Select-String '"requestId":"req-smoke-1"'
Get-Content logs\local-host.jsonl | Select-String '"event":"llm.request"'
Get-Content logs\local-host.jsonl | Select-String '"event":"llm.response"'
```

Expected: matching lines exist for `req-smoke-1`, `llm.request`, and `llm.response`.

- [ ] **Step 7: Verify Seq query manually**

Open `http://127.0.0.1:5341` and run these searches:

```text
event = 'llm.request'
```

```text
event = 'llm.response'
```

```text
requestId = 'req-smoke-1'
```

Expected: Seq shows the smoke command logs and the LLM request/response details as structured fields.

- [ ] **Step 8: Final repository checks**

Run:

```powershell
git status --short
git diff --stat
```

Expected: only intentional implementation files are changed. If all verification passed, commit any remaining changes:

```powershell
git add .
git commit -m "Add local JSONL and Seq logging"
```

Expected: final commit succeeds or reports nothing to commit if previous task commits already captured all changes.

## Self-Review Coverage

- Spec goal 1, unified config: Task 3.
- Spec goal 2, backend HTTP/SSE request and response logs: Task 6.
- Spec goal 3, `submitCommand` logs: Task 5.
- Spec goal 4, LLM request/response/error logs: Task 4.
- Spec goal 5, manual logging functions: Task 1 exposes `Logger`, `createPinoLogger`, `createMemoryLogger`, and `createNoopLogger`.
- Spec goal 6, local Web Server: Task 3 adds Seq compose, Task 7 verifies Seq UI.
- JSONL file output: Task 1.
- Secret avoidance and LLM truncation: Task 2 and Task 4.
- No browser-side active log upload: no task modifies `apps/web` or `packages/ui-sdk`.
