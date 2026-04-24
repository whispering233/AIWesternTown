import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const currentDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
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
});
