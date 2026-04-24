import { defineConfig } from "drizzle-kit";

import { migrationConfig } from "./src/schema.js";

export default defineConfig(migrationConfig);
