import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = resolve(currentDir, "../..");

export type WebDevServerEnv = Partial<
  Record<"VITE_DEV_HOST" | "VITE_DEV_PORT", string>
>;

export function resolveWebDevServerConfig(env: WebDevServerEnv) {
  const server: {
    host?: string;
    port?: number;
  } = {};

  if (env.VITE_DEV_HOST) {
    server.host = env.VITE_DEV_HOST;
  }

  if (env.VITE_DEV_PORT) {
    const port = Number.parseInt(env.VITE_DEV_PORT, 10);

    if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
      throw new Error(
        `Invalid VITE_DEV_PORT "${env.VITE_DEV_PORT}". Expected an integer from 1 to 65535.`
      );
    }

    server.port = port;
  }

  return server;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, "");

  return {
    envDir: workspaceRoot,
    server: resolveWebDevServerConfig(env),
    plugins: [react()],
    resolve: {
      alias: {
        "@ai-western-town/ui-sdk": resolve(
          currentDir,
          "../../packages/ui-sdk/src/index.ts"
        ),
        "@ai-western-town/contracts": resolve(
          currentDir,
          "../../packages/contracts/src/index.ts"
        )
      }
    }
  };
});
