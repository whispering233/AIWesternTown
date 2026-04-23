import { desc, eq, type InferSelectModel } from "drizzle-orm";

import { jsonParseObject, jsonStringify } from "./json";
import { saveSelection, savesTable } from "./schema";
import { PersistenceDatabase } from "./sqlite";
import type { CreateSaveInput, SaveRecord, SaveStatus } from "./types";

export class SaveRepository {
  public constructor(private readonly database: PersistenceDatabase) {}

  public create(input: CreateSaveInput): SaveRecord {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const updatedAt = input.updatedAt ?? createdAt;
    const record: SaveRecord = {
      saveId: input.saveId,
      name: input.name,
      status: input.status ?? "active",
      worldTick: input.worldTick ?? 0,
      metadata: input.metadata ?? {},
      createdAt,
      updatedAt
    };

    this.database.connection.insert(savesTable).values({
      saveId: record.saveId,
      name: record.name,
      status: record.status,
      worldTick: record.worldTick,
      metadataJson: jsonStringify(record.metadata),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    }).run();

    return record;
  }

  public getById(saveId: string): SaveRecord | undefined {
    const row = this.database.connection
      .select(saveSelection)
      .from(savesTable)
      .where(eq(savesTable.saveId, saveId))
      .get();

    return row ? this.toRecord(row) : undefined;
  }

  public list(): SaveRecord[] {
    const rows = this.database.connection
      .select(saveSelection)
      .from(savesTable)
      .orderBy(desc(savesTable.updatedAt), savesTable.saveId)
      .all();

    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(row: InferSelectModel<typeof savesTable>): SaveRecord {
    return {
      saveId: row.saveId,
      name: row.name,
      status: row.status as SaveStatus,
      worldTick: row.worldTick,
      metadata: jsonParseObject(row.metadataJson, "metadata_json"),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}
