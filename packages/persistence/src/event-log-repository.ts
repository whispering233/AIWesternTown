import { and, asc, eq, gte, lte, type InferSelectModel } from "drizzle-orm";

import {
  jsonParseObject,
  jsonParseStringArray,
  jsonStringify
} from "./json";
import { SaveRepository } from "./save-repository";
import { eventLogSelection, eventLogsTable } from "./schema";
import { PersistenceDatabase } from "./sqlite";
import type {
  AppendEventLogInput,
  EventHeatLevel,
  EventLogQuery,
  EventLogRecord,
  InterruptType
} from "./types";

export class EventLogRepository {
  public constructor(private readonly database: PersistenceDatabase) {}

  public append(saveId: string, input: AppendEventLogInput): EventLogRecord {
    validateEventInput(input);

    const record: EventLogRecord = {
      ...input,
      saveId,
      targetIds: input.targetIds,
      tags: input.tags,
      actorIds: input.actorIds,
      payload: input.payload ?? {},
      metadata: input.metadata ?? {},
      createdAt: input.createdAt ?? new Date().toISOString()
    };

    this.database.connection.insert(eventLogsTable).values({
      saveId: record.saveId,
      eventId: record.eventId,
      worldTick: record.worldTick,
      eventType: record.eventType,
      originSceneId: record.originSceneId,
      actorIdsJson: jsonStringify(record.actorIds),
      targetIdsJson: jsonStringify(record.targetIds),
      tagsJson: jsonStringify(record.tags),
      heatLevel: record.heatLevel,
      interruptType: record.interruptType ?? null,
      sourceCommandId: record.sourceCommandId ?? null,
      summary: record.summary ?? null,
      payloadJson: jsonStringify(record.payload),
      metadataJson: jsonStringify(record.metadata),
      createdAt: record.createdAt
    }).run();
    new SaveRepository(this.database).syncSnapshot(record.saveId, {
      worldTick: record.worldTick,
      updatedAt: record.createdAt
    });

    return record;
  }

  public appendMany(
    saveId: string,
    inputs: AppendEventLogInput[]
  ): EventLogRecord[] {
    return this.database.transaction(() =>
      inputs.map((input) => this.append(saveId, input))
    );
  }

  public listByTick(saveId: string, worldTick: number): EventLogRecord[] {
    const rows = this.database.connection
      .select(eventLogSelection)
      .from(eventLogsTable)
      .where(
        and(
          eq(eventLogsTable.saveId, saveId),
          eq(eventLogsTable.worldTick, worldTick)
        )
      )
      .orderBy(asc(eventLogsTable.createdAt), asc(eventLogsTable.eventId))
      .all();

    return rows.map((row) => this.toRecord(row));
  }

  public query(saveId: string, query: EventLogQuery = {}): EventLogRecord[] {
    const predicates = [eq(eventLogsTable.saveId, saveId)];

    if (query.fromTick !== undefined) {
      predicates.push(gte(eventLogsTable.worldTick, query.fromTick));
    }

    if (query.toTick !== undefined) {
      predicates.push(lte(eventLogsTable.worldTick, query.toTick));
    }

    const baseQuery = this.database.connection
      .select(eventLogSelection)
      .from(eventLogsTable)
      .where(and(...predicates))
      .orderBy(
        asc(eventLogsTable.worldTick),
        asc(eventLogsTable.createdAt),
        asc(eventLogsTable.eventId)
      );

    const rows = query.limit !== undefined
      ? baseQuery.limit(query.limit).all()
      : baseQuery.all();

    return rows.map((row) => this.toRecord(row));
  }

  private toRecord(
    row: InferSelectModel<typeof eventLogsTable>
  ): EventLogRecord {
    return {
      saveId: row.saveId,
      eventId: row.eventId,
      eventType: row.eventType,
      worldTick: row.worldTick,
      originSceneId: row.originSceneId,
      actorIds: jsonParseStringArray(row.actorIdsJson, "actor_ids_json"),
      targetIds: jsonParseStringArray(row.targetIdsJson, "target_ids_json"),
      tags: jsonParseStringArray(row.tagsJson, "tags_json"),
      heatLevel: row.heatLevel as EventHeatLevel,
      interruptType: (row.interruptType ?? undefined) as
        | InterruptType
        | undefined,
      sourceCommandId: row.sourceCommandId ?? undefined,
      summary: row.summary ?? undefined,
      payload: jsonParseObject(row.payloadJson, "payload_json"),
      metadata: jsonParseObject(row.metadataJson, "metadata_json"),
      createdAt: row.createdAt
    };
  }
}

function validateEventInput(input: AppendEventLogInput): void {
  if (input.heatLevel === "interrupt" && !input.interruptType) {
    throw new Error("interrupt events must include interruptType");
  }
}
