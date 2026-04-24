import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema.js";

export type PersistenceDatabaseOptions = {
  filename: string;
};

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));

export class PersistenceDatabase {
  private readonly client: Database.Database;
  private readonly database: ReturnType<typeof drizzle<typeof schema>>;

  public constructor(options: PersistenceDatabaseOptions) {
    if (options.filename !== ":memory:") {
      mkdirSync(dirname(options.filename), { recursive: true });
    }

    this.client = new Database(options.filename);
    this.client.pragma("foreign_keys = ON");
    this.client.pragma("journal_mode = WAL");
    this.client.pragma("busy_timeout = 5000");
    this.database = drizzle(this.client, { schema });
    this.initializeMigrations();
  }

  public get connection(): ReturnType<typeof drizzle<typeof schema>> {
    return this.database;
  }

  public transaction<T>(callback: () => T): T {
    return this.client.transaction(() => callback())();
  }

  public close(): void {
    this.client.close();
  }

  private initializeMigrations(): void {
    migrate(this.database, {
      migrationsFolder
    });
  }
}
