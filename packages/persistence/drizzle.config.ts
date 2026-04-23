import { defineConfig } from "drizzle-kit";

import { migrationConfig } from "./src/schema";

export default defineConfig(migrationConfig);
