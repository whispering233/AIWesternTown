import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildLocalHostServer } from "./server.js";

export * from "./server.js";
export * from "./session-store.js";

async function main(): Promise<void> {
  const server = buildLocalHostServer();
  const port = Number.parseInt(process.env.LOCAL_HOST_PORT ?? "8787", 10);
  const host = process.env.LOCAL_HOST_BIND ?? "127.0.0.1";

  await server.listen({
    port,
    host
  });
}

const executedFilePath = process.argv[1] ? resolve(process.argv[1]) : undefined;
const moduleFilePath = fileURLToPath(import.meta.url);

if (executedFilePath && executedFilePath === moduleFilePath) {
  void main();
}
