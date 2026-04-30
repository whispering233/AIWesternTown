import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";

export type LocalHostRuntimeConfig = {
  port: number;
  host: string;
};

export type LocalHostEnv = Record<string, string | undefined>;

export type LoadLocalHostEnvFileOptions = {
  cwd?: string;
  env?: LocalHostEnv;
  fileName?: string;
};

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = "127.0.0.1";

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
