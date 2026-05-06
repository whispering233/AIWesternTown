import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

import {
  createLLMGatewayConfigFromEnv,
  type LLMGatewayConfig
} from "@ai-western-town/llm-runtime";
import type {
  LLMLoggingConfig,
  LogLevel,
  LoggerFactoryConfig
} from "@ai-western-town/observability";

export type LocalHostRuntimeConfig = {
  port: number;
  host: string;
};

export type LocalHostLLMRuntimeConfig = {
  gateway: LLMGatewayConfig;
  modelRef: string;
  timeoutMs: number;
};

export type LocalHostLoggingConfig = LoggerFactoryConfig & {
  llm: LLMLoggingConfig & {
    enabled: boolean;
  };
};

export type LocalHostEnv = Record<string, string | undefined>;

export type LoadLocalHostEnvFileOptions = {
  cwd?: string;
  env?: LocalHostEnv;
  fileName?: string;
};

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_LOCAL_LLM_MODEL = "gemma-4-e2b-uncensored-hauhaucs-aggressive";
const DEFAULT_LLM_TIMEOUT_MS = 10_000;
const DEFAULT_LOG_LEVEL: LogLevel = "debug";
const DEFAULT_LOG_DIR = "logs";
const DEFAULT_LOG_FILE = "local-host.jsonl";
const DEFAULT_SEQ_URL = "http://127.0.0.1:5341";
const DEFAULT_LLM_LOG_TEXT_LENGTH = 20_000;

export async function loadLocalHostEnvFile(
  options: LoadLocalHostEnvFileOptions = {}
): Promise<boolean> {
  const envFilePath = findEnvFile(
    options.cwd ?? process.cwd(),
    options.fileName ?? ".env.local"
  );

  if (!envFilePath) {
    return false;
  }

  const env = options.env ?? process.env;
  const contents = await readFile(envFilePath, "utf8");

  for (const [key, value] of parseEnvFile(contents)) {
    if (env[key] === undefined) {
      env[key] = value;
    }
  }

  return true;
}

export function resolveLocalHostRuntimeConfig(
  env: LocalHostEnv = process.env
): LocalHostRuntimeConfig {
  return {
    port: parsePort(env.LOCAL_HOST_PORT),
    host: env.LOCAL_HOST_BIND ?? DEFAULT_HOST
  };
}

export function resolveLocalHostLLMRuntimeConfig(
  env: LocalHostEnv = process.env
): LocalHostLLMRuntimeConfig {
  const gateway = createLLMGatewayConfigFromEnv(env);

  if (gateway.provider === "local") {
    gateway.local = {
      ...gateway.local,
      baseUrl: gateway.local?.baseUrl ?? "http://127.0.0.1:1234/v1",
      capabilities: {
        ...(gateway.local?.capabilities ?? {}),
        supportsJsonObject: parseBoolean(
          env.LLM_LOCAL_SUPPORTS_JSON_OBJECT,
          false
        )
      }
    };
  }

  return {
    gateway,
    modelRef: env.LLM_LOCAL_MODEL ?? env.LLM_MODEL ?? DEFAULT_LOCAL_LLM_MODEL,
    timeoutMs: parsePositiveInteger(
      env.LLM_TIMEOUT_MS,
      DEFAULT_LLM_TIMEOUT_MS,
      "LLM_TIMEOUT_MS"
    )
  };
}

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

function findEnvFile(startDir: string, fileName: string): string | undefined {
  let currentDir = resolve(startDir);
  const rootDir = parse(currentDir).root;

  while (true) {
    const candidate = join(currentDir, fileName);

    if (existsSync(candidate)) {
      return candidate;
    }

    if (currentDir === rootDir) {
      return undefined;
    }

    currentDir = dirname(currentDir);
  }
}

function parseEnvFile(contents: string): [string, string][] {
  const entries: [string, string][] = [];

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalizedLine = line.startsWith("export ")
      ? line.slice("export ".length).trimStart()
      : line;
    const separatorIndex = normalizedLine.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const rawValue = normalizedLine.slice(separatorIndex + 1).trim();

    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }

    entries.push([key, unquoteValue(rawValue)]);
  }

  return entries;
}

function unquoteValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PORT;
  }

  const port = Number.parseInt(value, 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error(
      `Invalid LOCAL_HOST_PORT "${value}". Expected an integer from 1 to 65535.`
    );
  }

  return port;
}

function parsePositiveInteger(
  value: string | undefined,
  defaultValue: number,
  envName: string
): number {
  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${envName} "${value}". Expected a positive integer.`);
  }

  return parsed;
}

function parseLogLevel(
  value: string | undefined,
  defaultValue: LogLevel
): LogLevel {
  if (value === undefined) {
    return defaultValue;
  }

  if (
    value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error"
  ) {
    return value;
  }

  throw new Error(
    `Invalid LOG_LEVEL "${value}". Expected debug, info, warn, or error.`
  );
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return value === "true" || value === "1";
}
