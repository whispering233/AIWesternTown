import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createStarterTownSessionRuntime } from "@ai-western-town/app-services";

import { buildLocalHostServer } from "./server.js";
import {
  loadLocalHostEnvFile,
  resolveLocalHostLLMRuntimeConfig,
  resolveLocalHostRuntimeConfig
} from "./config.js";

export * from "./server.js";
export * from "./session-store.js";
export * from "./config.js";

async function main(): Promise<void> {
  await loadLocalHostEnvFile();

  const config = resolveLocalHostRuntimeConfig();
  const llmConfig = resolveLocalHostLLMRuntimeConfig();
  const sessionRuntime = createStarterTownSessionRuntime({
    llmGatewayConfig: llmConfig.gateway,
    modelRef: llmConfig.modelRef,
    llmTimeoutMs: llmConfig.timeoutMs
  });
  const server = buildLocalHostServer({
    sessionRuntime
  });

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
