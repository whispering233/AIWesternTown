import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildLocalHostServer } from "./server.js";
import {
  loadLocalHostEnvFile,
  resolveLocalHostRuntimeConfig
} from "./config.js";

export * from "./server.js";
export * from "./session-store.js";
export * from "./config.js";

async function main(): Promise<void> {
  await loadLocalHostEnvFile();

  const server = buildLocalHostServer();
  const config = resolveLocalHostRuntimeConfig();

  await server.listen({
    port: config.port,
    host: config.host
  });
}

const executedFilePath = process.argv[1] ? resolve(process.argv[1]) : undefined;
const moduleFilePath = fileURLToPath(import.meta.url);

if (executedFilePath && executedFilePath === moduleFilePath) {
  void main();
}
