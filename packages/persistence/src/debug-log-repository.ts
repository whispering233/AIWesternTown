import { and, asc, eq, gte, lte, type InferSelectModel } from "drizzle-orm";

import {
  jsonParseObject,
  jsonParseStringArray,
  jsonStringify
} from "./json.js";
import { debugLogSelection, debugLogsTable } from "./schema.js";
import { PersistenceDatabase } from "./sqlite.js";
import type {
  AppendLlmDebugLogInput,
  LlmDebugLogQuery,
  LlmDebugLogRecord
} from "./types.js";

export class DebugLogRepository {
  public constructor(private readonly database: PersistenceDatabase) {}

  public appendLlmCall(
    saveId: string,
    input: AppendLlmDebugLogInput
  ): LlmDebugLogRecord {
    const record: LlmDebugLogRecord = {
      ...input,
      saveId,
      kind: "llm_call",
      tags: input.tags,
      payload: input.payload,
      metadata: input.metadata ?? {},
      createdAt: input.createdAt ?? new Date().toISOString()
    };

    this.database.connection.insert(debugLogsTable).values({
      saveId: record.saveId,
      recordId: record.recordId,
      kind: record.kind,
      worldTick: record.worldTick,
      traceId: record.traceId,
      requestId: record.requestId,
      npcId: record.npcId ?? null,
      tagsJson: jsonStringify(record.tags),
      payloadJson: jsonStringify(record.payload),
      metadataJson: jsonStringify(record.metadata),
      createdAt: record.createdAt
    }).run();

    return record;
  }

  public queryLlmCalls(
    saveId: string,
    query: LlmDebugLogQuery = {}
  ): LlmDebugLogRecord[] {
    const predicates = [
      eq(debugLogsTable.saveId, saveId),
      eq(debugLogsTable.kind, "llm_call")
    ];

    if (query.traceId !== undefined) {
      predicates.push(eq(debugLogsTable.traceId, query.traceId));
    }

    if (query.requestId !== undefined) {
      predicates.push(eq(debugLogsTable.requestId, query.requestId));
    }

    if (query.fromTick !== undefined) {
      predicates.push(gte(debugLogsTable.worldTick, query.fromTick));
    }

    if (query.toTick !== undefined) {
      predicates.push(lte(debugLogsTable.worldTick, query.toTick));
    }

    const baseQuery = this.database.connection
      .select(debugLogSelection)
      .from(debugLogsTable)
      .where(and(...predicates))
      .orderBy(
        asc(debugLogsTable.worldTick),
        asc(debugLogsTable.createdAt),
        asc(debugLogsTable.recordId)
      );

    const rows = query.limit !== undefined
      ? baseQuery.limit(query.limit).all()
      : baseQuery.all();

    return rows.map((row) => this.toLlmRecord(row));
  }

  private toLlmRecord(
    row: InferSelectModel<typeof debugLogsTable>
  ): LlmDebugLogRecord {
    if (!row.traceId || !row.requestId) {
      throw new Error("llm_call debug logs must include traceId and requestId");
    }

    return {
      saveId: row.saveId,
      recordId: row.recordId,
      kind: "llm_call",
      worldTick: row.worldTick,
      traceId: row.traceId,
      requestId: row.requestId,
      npcId: row.npcId ?? undefined,
      tags: jsonParseStringArray(row.tagsJson, "tags_json"),
      payload: jsonParseObject(row.payloadJson, "payload_json"),
      metadata: jsonParseObject(row.metadataJson, "metadata_json"),
      createdAt: row.createdAt
    };
  }
}
