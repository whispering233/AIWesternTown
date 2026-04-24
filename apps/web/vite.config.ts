import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ai-western-town/ui-sdk": resolve(
        __dirname,
        "../../packages/ui-sdk/src/index.ts"
      ),
      "@ai-western-town/contracts": resolve(
        __dirname,
        "../../packages/contracts/src/index.ts"
      )
    }
  }
});
